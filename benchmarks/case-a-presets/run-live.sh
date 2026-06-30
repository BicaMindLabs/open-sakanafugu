#!/usr/bin/env bash
# Case A — LIVE run with local CLIs (no fugue-cc fleet needed).
#   writer (implementer/fixer) = $WRITER (claude | codex), default claude
#   reviewer                    = codex (local, gen != review)
#
#   ./run-live.sh orchestrated                 # claude writes 5 files + codex reviews + gate + auto-fix loop
#   WRITER=codex ./run-live.sh single          # codex does the whole feature alone, one pass
#   ./run-live.sh single                       # claude alone, one pass
#
# Headcount policy (kept honest): orchestrated = claude write + codex review (two
# families). single = one writer only. So this isolates the value of [independent
# review + objective gate + fix loop] layered on a writer.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$HERE/work/tqdm"
CODEX="${CODEX:-/Applications/Codex.app/Contents/Resources/codex}"
CLAUDE="${CLAUDE:-claude}"
WRITER="${WRITER:-claude}"
PYTHON="${PYTHON:-$(command -v python3 || command -v python)}"
MODE="${1:-orchestrated}"
RESULTS="$HERE/results-live.csv"
MAX_ROUNDS=3
T0=$(date +%s 2>/dev/null || python3 -c 'import time;print(int(time.time))')

[ -d "$WORK/.git" ] || { echo "run setup.sh first"; exit 1; }
mkdir -p "$HERE/work"
log(){ echo "[live/$MODE/$WRITER] $*"; }

reset_work(){ ( cd "$WORK" && git reset --hard caseA-baseline >/dev/null 2>&1 && git clean -fdq >/dev/null 2>&1 ); }
snapshot(){ ( cd "$WORK" && git add -A && git -c user.email=live@local -c user.name=live commit -q -m "$1" >/dev/null 2>&1 || true ); }
cur_sha(){ ( cd "$WORK" && git rev-parse HEAD ); }

# writer-agnostic: claude -p | codex exec. Both edit files in $WORK, log to live-<tag>.log
write_with(){
  local pf="$1" tag="$2"
  if [ "$WRITER" = codex ]; then
    ( cd "$WORK" && "$CODEX" exec "$(cat "$pf")" -C "$WORK" --skip-git-repo-check \
        -s workspace-write -o "$HERE/work/live-$tag.out" >"$HERE/work/live-$tag.log" 2>&1 )
  else
    ( cd "$WORK" && "$CLAUDE" ${CLAUDE_MODEL:+--model "$CLAUDE_MODEL"} -p "$(cat "$pf")" --permission-mode bypassPermissions \
        --output-format text >"$HERE/work/live-$tag.log" 2>&1 )
  fi
}
impl(){ log "impl $2"; write_with "$1" "$2"; }

run_gate(){ "$HERE/gate.sh" "$WORK" >"$HERE/work/gate-$MODE.log" 2>&1; local rc=$?; [ $rc = 0 ] && echo pass || echo fail; }

run_review(){
  ( cd "$WORK" && git --no-pager diff "$(git rev-parse HEAD^ 2>/dev/null)"..HEAD ) >"$HERE/work/review-diff.txt" 2>/dev/null || \
    ( cd "$WORK" && git --no-pager diff ) >"$HERE/work/review-diff.txt"
  cat >"$HERE/work/review-ask.md" <<EOF
You are an INDEPENDENT reviewer (do not modify any file). The contract is:
$(cat "$HERE/CONTRACT.md")

Review the diff below for the tqdm "presets" feature:
$(cat "$HERE/work/review-diff.txt")

Check correctness vs contract, security (path traversal / JSON injection), test coverage, regression risk, code quality.
First line MUST be exactly "VERDICT: ACCEPTED" or "VERDICT: NEEDS FIX". Then a numbered findings list (file:line + one line). Be concise.
EOF
  "$CODEX" exec -C "$WORK" --skip-git-repo-check -s read-only -o "$HERE/work/verdict.txt" \
    "$(cat "$HERE/work/review-ask.md")" >"$HERE/work/review.log" 2>&1 || true
  grep -m1 -iE 'VERDICT:' "$HERE/work/verdict.txt" 2>/dev/null | tr '[:lower:]' '[:upper:]' || echo "VERDICT: NEEDS FIX"
}

run_fix(){
  local v; v="$(run_review)"
  [ "${v/ACCEPTED/}" != "$v" ] && { echo "$v"; return; }
  cat >"$HERE/work/fix-ask.md" <<EOF
Fix the failing review/gate for the tqdm "presets" feature. Only edit files in scope; do not rewrite from scratch.
Contract: $(cat "$HERE/CONTRACT.md")

Latest review verdict:
$(cat "$HERE/work/verdict.txt" 2>/dev/null)

Latest gate log:
$(tail -25 "$HERE/work/gate-$MODE.log" 2>/dev/null)

Apply the minimum edits to reach VERDICT: ACCEPTED and a green gate. Then print "DONE".
EOF
  log "fix round"; write_with "$HERE/work/fix-ask.md" fix; snapshot "round fix"; echo "FIXED"
}

score(){ local g="$1" v="$2"; local s=0; [ "$g" = pass ] && s=$((s+2)); [ "${v/ACCEPTED/}" != "$v" ] && s=$((s+1)); echo "$s"; }

record(){ local gp="$1" rounds="$2" verdict="$3"; local dt=$(( $(date +%s 2>/dev/null || python3 -c 'import time;print(int(time.time))') - T0 ))
  [ -f "$RESULTS" ] || echo "mode,writer,gate_pass,review_rounds,wallclock_s,final_verdict" >"$RESULTS"
  echo "$MODE,$WRITER,$gp,$rounds,$dt,$verdict" >>"$RESULTS"
  log "RESULT gate=$gp rounds=$rounds ${dt}s verdict=$verdict -> $RESULTS"; }

if [ "$MODE" = orchestrated ]; then
  reset_work; snapshot baseline
  impl "$HERE/prompts/t1-presets.md" t1 & impl "$HERE/prompts/t2-cli.md" t2 & \
    impl "$HERE/prompts/t3-tests.md" t3 & impl "$HERE/prompts/t4-docs.md" t4 & \
    impl "$HERE/prompts/t5-utils.md" t5 & wait
  snapshot impl
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
  reset_work; snapshot baseline
  impl "$HERE/prompts/baseline-whole.md" whole
  snapshot single-impl
  v="$(run_review)"; g="$(run_gate)"; log "first pass: gate=$g verdict=$v"
  if [ "$g" != pass ] || [ "${v/ACCEPTED/}" = "$v" ]; then run_fix >/dev/null; fi
  g="$(run_gate)"; [ "$g" = pass ] && final="ACCEPTED" || final="NEEDS FIX"
  record "$g" 1 "$final"
else
  echo "usage: $0 orchestrated|single"; exit 2
fi
