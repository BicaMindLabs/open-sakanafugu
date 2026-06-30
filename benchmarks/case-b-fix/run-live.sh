#!/usr/bin/env bash
# Case B — LIVE run with local CLIs. Mission: make all commander tests green
# by finding & fixing the 3 injected bugs in lib/command.js.
#   writer (fixer) = $WRITER (claude | codex), default claude
#   reviewer        = codex (gen != review)
#
#   ./run-live.sh orchestrated                  # claude fixes + codex reviews + gate + auto-fix loop
#   WRITER=codex ./run-live.sh orchestrated     # codex fixes + codex reviews (same-family, demo)
#   ./run-live.sh single                        # one writer, one pass
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$HERE/work/commander"
CODEX="${CODEX:-/Applications/Codex.app/Contents/Resources/codex}"
CLAUDE="${CLAUDE:-claude}"
WRITER="${WRITER:-claude}"
RESULTS="$HERE/results-live.csv"
MAX_ROUNDS=3
T0=$(date +%s 2>/dev/null || python3 -c 'import time;print(int(time.time()))')

[ -d "$WORK/.git" ] || { echo "run setup.sh first"; exit 1; }
mkdir -p "$HERE/work"
log(){ echo "[caseB/$MODE/$WRITER] $*"; }

# reset to the buggy baseline (3 bugs + tests present), then snapshot
reset_work(){ ( cd "$WORK" && git checkout -q caseB-buggy && git clean -fdq -e node_modules ); }
snapshot(){ ( cd "$WORK" && git add -A && git -c user.email=caseB@local -c user.name=caseB commit -q -m "$1" >/dev/null 2>&1 || true ); }
impl(){ log "fix $2"; write_with "$1" "$2"; }
cur_sha(){ ( cd "$WORK" && git rev-parse HEAD ); }

write_with(){
  local pf="$1" tag="$2"
  if [ "$WRITER" = codex ]; then
    ( cd "$WORK" && "$CODEX" exec "$(cat "$pf")" -C "$WORK" --skip-git-repo-check \
        -s workspace-write -o "$HERE/work/live-$tag.out" >"$HERE/work/live-$tag.log" 2>&1 </dev/null )
  else
    ( cd "$WORK" && "$CLAUDE" ${CLAUDE_MODEL:+--model "$CLAUDE_MODEL"} -p "$(cat "$pf")" --permission-mode bypassPermissions \
        --output-format text >"$HERE/work/live-$tag.log" 2>&1 </dev/null )
  fi
}

run_gate(){ "$HERE/gate.sh" "$WORK" >"$HERE/work/gate-$MODE.log" 2>&1; [ $? = 0 ] && echo pass || echo fail; }

run_review(){
  ( cd "$WORK" && git --no-pager diff caseB-buggy -- lib ) >"$HERE/work/review-diff.txt"
  cat >"$HERE/work/review-ask.md" <<EOF
You are an INDEPENDENT reviewer fixing a real bug (do not modify test files).
Review this diff to lib/command.js (the task was: make the 3 caseB bug tests pass WITHOUT breaking anything):
$(cat "$HERE/work/review-diff.txt")

Check: does it correctly fix negative-number handling (decimals, optional values, variadic)?
Any regression risk to other parsing? Any over-broad/hacky change?
First line MUST be exactly "VERDICT: ACCEPTED" or "VERDICT: NEEDS FIX". Then numbered findings. Concise.
EOF
  "$CODEX" exec -C "$WORK" --skip-git-repo-check -s read-only -o "$HERE/work/verdict.txt" \
    "$(cat "$HERE/work/review-ask.md")" >"$HERE/work/review.log" 2>&1 </dev/null || true
  grep -m1 -iE 'VERDICT:' "$HERE/work/verdict.txt" 2>/dev/null | tr '[:lower:]' '[:upper:]' || echo "VERDICT: NEEDS FIX"
}

run_fix(){
  local v; v="$(run_review)"
  [ "${v/ACCEPTED/}" != "$v" ] && { echo "$v"; return; }
  cat >"$HERE/work/fix-ask.md" <<EOF
Fix the remaining failing tests in lib/command.js. Do NOT edit tests/. Minimal edits only.
Latest review verdict:
$(cat "$HERE/work/verdict.txt" 2>/dev/null)
Latest gate log (failing tests):
$(grep -E 'caseB|✖' "$HERE/work/gate-$MODE.log" 2>/dev/null | head -15)
Apply minimum edits to make ALL tests green and reach VERDICT: ACCEPTED. Then print DONE.
EOF
  log "fix round"; write_with "$HERE/work/fix-ask.md" fix; snapshot "round fix"; echo "FIXED"
}

score(){ local g="$1" v="$2"; local s=0; [ "$g" = pass ] && s=$((s+2)); [ "${v/ACCEPTED/}" != "$v" ] && s=$((s+1)); echo "$s"; }

record(){ local gp="$1" rounds="$2" verdict="$3"; local dt=$(( $(date +%s 2>/dev/null || python3 -c 'import time;print(int(time.time()))') - T0 ))
  [ -f "$RESULTS" ] || echo "mode,writer,gate_pass,review_rounds,wallclock_s,final_verdict" >"$RESULTS"
  echo "$MODE,$WRITER,$gp,$rounds,$dt,$verdict" >>"$RESULTS"
  log "RESULT gate=$gp rounds=$rounds ${dt}s verdict=$verdict -> $RESULTS"; }

MODE="${1:-orchestrated}"
if [ "$MODE" = orchestrated ]; then
  reset_work; snapshot buggy-start
  impl "$HERE/prompts/fix-task.md" initial
  snapshot initial-fix
  best_sha="$(cur_sha)"; best_score=-1; rounds=0; final="NEEDS FIX"
  for r in $(seq 1 $MAX_ROUNDS); do
    rounds=$r
    g="$(run_gate)"; v="$(run_review)"; s="$(score "$g" "$v")"
    log "round $r: gate=$g verdict=$v score=$s"
    if [ "$g" = pass ] && [ "${v/ACCEPTED/}" != "$v" ]; then final="ACCEPTED"; snapshot "done-r$r"; break; fi
    if [ "$s" -gt "$best_score" ]; then best_score=$s; best_sha="$(cur_sha)"; else ( cd "$WORK" && git reset --hard "$best_sha" >/dev/null 2>&1 ); fi
    run_fix >/dev/null
  done
  g="$(run_gate)"; [ "$g" = pass ] && final="ACCEPTED"
  record "$g" "$rounds" "$final"

elif [ "$MODE" = single ]; then
  reset_work; snapshot buggy-start
  impl "$HERE/prompts/fix-task-whole.md" whole
  snapshot single-fix
  v="$(run_review)"; g="$(run_gate)"; log "first pass: gate=$g verdict=$v"
  if [ "$g" != pass ] || [ "${v/ACCEPTED/}" = "$v" ]; then run_fix >/dev/null; fi
  g="$(run_gate)"; [ "$g" = pass ] && final="ACCEPTED" || final="NEEDS FIX"
  record "$g" 1 "$final"
else
  echo "usage: $0 orchestrated|single"; exit 2
fi
