#!/usr/bin/env bash
# fuguectl-goal.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
G="$HERE/fuguectl-goal.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_GOAL_CALLS="$TMP/goal-calls.txt"
# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

printf '%s\n' \
  "const fs = require('node:fs');" \
  "const cp = require('node:child_process');" \
  "const args = process.argv.slice(2);" \
  "fs.appendFileSync(process.env.FUGUE_GOAL_CALLS, args.join(' ') + '\\n');" \
  "const root = args[0];" \
  "const cmd = args[1];" \
  "const file = args[2];" \
  "if (root !== 'goal') {" \
  "  console.error('expected goal');" \
  "  process.exit(9);" \
  "}" \
  "const field = (text, key) => {" \
  "  const line = text.split(/\\r?\\n/u).find((item) => item.startsWith(key + ':'));" \
  "  return line === undefined ? '' : line.slice(key.length + 1).trim();" \
  "};" \
  "const read = (path) => {" \
  "  if (!path || !fs.existsSync(path)) {" \
  "    console.error('no goal spec at ' + (path || ''));" \
  "    process.exit(1);" \
  "  }" \
  "  return fs.readFileSync(path, 'utf8');" \
  "};" \
  "if (cmd === 'template') {" \
  "  process.stdout.write(['outcome: <one-line goal>', 'gate: <runnable acceptance command; met = exit 0>', 'rubric: <focus areas for the reviewer>', 'rounds: 3', 'allocate: auto', ''].join('\\n'));" \
  "} else if (cmd === 'show') {" \
  "  const text = read(file);" \
  "  process.stdout.write('outcome:  ' + field(text, 'outcome') + '\\n');" \
  "  process.stdout.write('gate:     ' + field(text, 'gate') + '\\n');" \
  "  process.stdout.write('rubric:   ' + field(text, 'rubric') + '\\n');" \
  "  process.stdout.write('rounds:   ' + (field(text, 'rounds') || '3') + '\\n');" \
  "  process.stdout.write('allocate: ' + (field(text, 'allocate') || 'auto') + '\\n');" \
  "} else if (cmd === 'check') {" \
  "  const text = read(file);" \
  "  const gate = field(text, 'gate');" \
  "  if (gate.length === 0) {" \
  "    process.stdout.write('[warn] goal-gate: no gate command in spec\\nGOAL NOT MET\\n');" \
  "    process.exit(1);" \
  "  }" \
  "  const result = cp.spawnSync(gate, { shell: true, stdio: 'ignore' });" \
  "  if (result.status === 0) {" \
  "    process.stdout.write('[ok] goal-gate: gate passed (exit 0)\\nGOAL MET\\n');" \
  "    process.exit(0);" \
  "  }" \
  "  process.stdout.write('[fail] goal-gate: gate failed (exit ' + String(result.status || 1) + ')\\nGOAL NOT MET\\n');" \
  "  process.exit(1);" \
  "} else {" \
  "  console.error('unknown goal command ' + (cmd || ''));" \
  "  process.exit(1);" \
  "}" \
  > "$FUGUE_ENGINE_CLI"

echo "fuguectl-goal tests"

ok "template has outcome+gate" 'bash "$G" template | grep -q "outcome:" && bash "$G" template | grep -q "gate:"'

printf 'outcome: example\ngate: true\nrubric: no regression\nrounds: 2\n' > "$TMP/g.spec"
bash "$G" check "$TMP/g.spec" >/dev/null 2>&1; ok "gate=true → check met(0)" '[ "$?" -eq 0 ]'

printf 'outcome: bad\ngate: false\n' > "$TMP/bad.spec"
bash "$G" check "$TMP/bad.spec" >/dev/null 2>&1; ok "gate=false → not met(non-0)" '[ "$?" -ne 0 ]'

ok "show parses outcome=example" 'o=$(bash "$G" show "$TMP/g.spec"); case "$o" in *"outcome:  example"*) true;; *) false;; esac'
ok "show parses rounds=2" 'o=$(bash "$G" show "$TMP/g.spec"); case "$o" in *"rounds:   2"*) true;; *) false;; esac'

# gate with && compound command
printf 'outcome: x\ngate: true && true\n' > "$TMP/cmp.spec"
bash "$G" check "$TMP/cmp.spec" >/dev/null 2>&1; ok "compound gate(&&) evaluates correctly" '[ "$?" -eq 0 ]'

printf 'outcome: no gate\n' > "$TMP/nogate.spec"
bash "$G" check "$TMP/nogate.spec" >/dev/null 2>&1; ok "no gate line → non-0" '[ "$?" -ne 0 ]'
bash "$G" check /no/such >/dev/null 2>&1; ok "spec not exist → non-0" '[ "$?" -ne 0 ]'
bash "$G" bogus >/dev/null 2>&1; ok "unknown subcommand → non-0" '[ "$?" -ne 0 ]'
ok "shell delegates to engine CLI" 'grep -q "^goal check .*g.spec$" "$FUGUE_GOAL_CALLS"'

tdone
