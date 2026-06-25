#!/usr/bin/env bash
# fuguectl-summary.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S="$HERE/fuguectl-summary.sh"; C="$HERE/fuguectl-cache.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_CACHE="$TMP/cache"
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_SUMMARY_CALLS="$TMP/summary-calls.txt"
# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

cat > "$FUGUE_ENGINE_CLI" <<'EOF'
const fs = require('node:fs');
const path = require('node:path');

fs.appendFileSync(process.env.FUGUE_SUMMARY_CALLS, `${process.argv.slice(2).join(' ')}\n`);

const args = process.argv.slice(2);
const die = (message) => {
  console.error(message);
  process.exit(2);
};
const [root, round] = args;
if (root !== 'summary') die('expected summary');
const cacheIndex = args.indexOf('--cache');
if (!round || cacheIndex === -1) die('usage: summary <round> --cache <dir>');
const cache = args[cacheIndex + 1];
const taskIndex = args.indexOf('--task');
const task = taskIndex === -1 ? '' : args[taskIndex + 1];
const dir = path.join(cache, `round-${round}`);
const manifest = path.join(dir, 'manifest.tsv');
if (!fs.existsSync(manifest)) die(`round-${round} not init`);
const rows = fs.readFileSync(manifest, 'utf8').trim().split(/\n/u).filter(Boolean).map((line) => {
  const [id, agent] = line.split('\t');
  const statusPath = path.join(dir, `${id}.status`);
  const status = fs.existsSync(statusPath) ? fs.readFileSync(statusPath, 'utf8').trim() : 'pending';
  return { id, agent, status };
});
const done = rows.filter((row) => row.status === 'done').length;
const fail = rows.filter((row) => row.status === 'fail').length;
const startedPath = path.join(dir, '.started');
const elapsed = fs.existsSync(startedPath)
  ? `${Math.max(0, Math.floor(Date.now() / 1000) - Number.parseInt(fs.readFileSync(startedPath, 'utf8'), 10))}s`
  : '?';
const status = `round-${round}: total=${rows.length} done=${done} fail=${fail} pending=${rows.length - done - fail}`;
const summary = [
  `### Round ${round} summary — ${status} — elapsed ${elapsed}`,
  ...rows.map((row) => `  ${row.id.padEnd(22)} ${row.agent.padEnd(14)} ${row.status}`),
].join('\n');
process.stdout.write(`${summary}\n`);
if (task) {
  if (!fs.existsSync(task)) die(`no TASK file ${task}`);
  fs.appendFileSync(task, `\n${summary}\n`);
  process.stderr.write(`→ written to ${task}\n`);
}
EOF

echo "fuguectl-summary tests"
echo r > "$TMP/a.md"

bash "$C" init 1 t1:cc-deepseek t2:cc-glm >/dev/null
bash "$C" put 1 t1 "$TMP/a.md" >/dev/null
bash "$C" fail 1 t2 "timeout" >/dev/null

out="$(bash "$S" 1)"
ok "summary has Round 1 title" 'echo "$out" | grep -q "Round 1 summary"'
ok "summary has counts done=1 fail=1" 'echo "$out" | grep -q "done=1 fail=1"'
ok "summary lists task detail" 'echo "$out" | grep -q "t1" && echo "$out" | grep -q "cc-glm"'

# --task write
TASKF="$TMP/task.md"; printf '## Log\n' > "$TASKF"
bash "$S" 1 --task "$TASKF" >/dev/null 2>&1
ok "--task writes summary into file" 'grep -q "Round 1 summary" "$TASKF"'

# round not init → non-0
bash "$S" 9 >/dev/null 2>&1; ok "round not init → non-0" '[ "$?" -ne 0 ]'
ok "shell delegates to engine CLI" 'grep -q "^summary 1 --cache " "$FUGUE_SUMMARY_CALLS"'

tdone
