#!/usr/bin/env bash
# fuguectl-run.test.sh — run status facade: set/round/clear + aggregate JSON(cache+loop) + JSON validity
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
R="$HERE/fuguectl-run.sh"; LOOP="$HERE/fuguectl-loop.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_CACHE="$TMP/cache"
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
cd "$TMP" || exit 1
# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"
js(){ bash "$R" status; }   # JSON

cat > "$FUGUE_ENGINE_CLI" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');

const args = process.argv.slice(2);
const opt = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? '' : args[index + 1] || '';
};
const withoutCache = () => {
  const out = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--cache') {
      i += 1;
    } else {
      out.push(args[i]);
    }
  }
  return out;
};
const [root, sub, round] = withoutCache();
if (root !== 'cache' || sub !== 'status' || !round) process.exit(2);
const cache = opt('--cache');
const dir = path.join(cache, `round-${round}`);
const manifest = path.join(dir, 'manifest.tsv');
if (!fs.existsSync(manifest)) process.exit(2);
const rows = fs.readFileSync(manifest, 'utf8').trim().split(/\n/u).filter(Boolean);
let done = 0;
let fail = 0;
for (const row of rows) {
  const id = row.split('\t')[0];
  const status = fs.existsSync(path.join(dir, `${id}.status`))
    ? fs.readFileSync(path.join(dir, `${id}.status`), 'utf8').trim()
    : '';
  if (status === 'done') done += 1;
  if (status === 'fail') fail += 1;
}
process.stdout.write(`round-${round}: total=${rows.length} done=${done} fail=${fail} pending=${rows.length - done - fail}\n`);
EOF
chmod +x "$FUGUE_ENGINE_CLI"

echo "fuguectl-run tests"

# no active run → status non-0
bash "$R" status >/dev/null 2>&1; ok "no active run → status non-0" '[ "$?" -ne 0 ]'
# set: no file → non-0
bash "$R" set --task /no/such/file >/dev/null 2>&1; ok "set no TASK file → non-0" '[ "$?" -ne 0 ]'

# create TASK + set
printf '# TASK-test\nStatus: IN_PROGRESS\n' > "$TMP/TASK.md"
bash "$R" set --task "$TMP/TASK.md" --round 2 >/dev/null
ok "set writes run.meta" '[ -f "$FUGUE_CACHE/run.meta" ]'
ok "status JSON has round 2" 'js | grep -q "\"round\": 2"'
ok "status JSON has task_status IN_PROGRESS" 'js | grep -q "IN_PROGRESS"'
ok "initialized=false when no cache/loop" 'js | grep -q "\"initialized\": false"'

# JSON must be valid (hard requirement for machine face)
ok "status output is valid JSON" 'js | python3 -c "import sys,json; json.load(sys.stdin)"'

# start cache round 2: declare 2 tasks, put 1 → pending=1, barrier open
ROUND="$FUGUE_CACHE/round-2"
mkdir -p "$ROUND"
printf 't1\tcc-deepseek\nt2\tcc-glm\n' > "$ROUND/manifest.tsv"
printf 'r1\n' > "$ROUND/t1.result"
printf 'done\n' > "$ROUND/t1.status"
ok "cache reflects: total=2" 'js | grep -q "\"total\": 2"'
ok "cache reflects: pending=1" 'js | grep -q "\"pending\": 1"'
ok "cache reflects: barrier open" 'js | grep -q "\"barrier\": \"open\""'
ok "next hints waiting on barrier" 'bash "$R" next | grep -q barrier'
ok "JSON still valid(incl cache)" 'js | python3 -c "import sys,json; json.load(sys.stdin)"'

# all collected → barrier passed
printf 'fail\n' > "$ROUND/t2.status"
printf 'x\n' > "$ROUND/t2.reason"
ok "all returned → barrier passed" 'js | grep -q "\"barrier\": \"passed\""'

# loop: init + record NEEDSFIX → decision CONTINUE into JSON
bash "$LOOP" init --max 3 >/dev/null
bash "$LOOP" record 1 --gate pass --verdict NEEDSFIX --findings 2 >/dev/null
ok "loop reflects: initialized true" 'js | grep -q "\"initialized\": true"'
ok "loop reflects: decision CONTINUE" 'js | grep -q "\"decision\": \"CONTINUE\""'
ok "JSON still valid(incl loop)" 'js | python3 -c "import sys,json; d=json.load(sys.stdin); assert d[\"loop\"][\"decision\"]==\"CONTINUE\""'

# --human summary
ok "--human has run/cache/loop/next" 'o="$(bash "$R" status --human)"; case "$o" in *run:*cache:*loop:*next:*) true;; *) false;; esac'

# round command updates
bash "$R" round 3 >/dev/null
ok "round 3 → JSON round 3" 'js | grep -q "\"round\": 3"'

# clear
bash "$R" clear >/dev/null
ok "no run.meta after clear" '[ ! -f "$FUGUE_CACHE/run.meta" ]'
bash "$R" next >/dev/null 2>&1; ok "next non-0 after clear" '[ "$?" -ne 0 ]'

# unknown subcommand
bash "$R" bogus >/dev/null 2>&1; ok "unknown subcommand → non-0" '[ "$?" -ne 0 ]'

tdone
