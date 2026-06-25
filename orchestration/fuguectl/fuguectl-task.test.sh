#!/usr/bin/env bash
# fuguectl-task.test.sh — self-test for fuguectl-task.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$HERE/fuguectl-task.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export TASKS="$TMP/tasks"
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_TASK_CALLS="$TMP/task-calls.txt"

# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

printf '%s\n' \
  "const fs = require('node:fs');" \
  "const path = require('node:path');" \
  "const argv = process.argv.slice(2);" \
  "fs.appendFileSync(process.env.FUGUE_TASK_CALLS, argv.join(' ') + '\\n');" \
  "const root = argv[0];" \
  "const cmd = argv[1];" \
  "const args = argv.slice(2);" \
  "if (root !== 'task') {" \
  "  console.error('expected task');" \
  "  process.exit(9);" \
  "}" \
  "const tasks = process.env.TASKS || path.join(process.env.HOME || '.', '.claude/tasks');" \
  "const stamp = '2026-06-25 12:00';" \
  "const day = '2026-06-25';" \
  "const die = (message) => { console.error(message); process.exit(1); };" \
  "if (cmd === 'new') {" \
  "  const title = args[0];" \
  "  if (!title) die('missing title');" \
  "  let priority = 'P1';" \
  "  const idx = args.indexOf('--priority');" \
  "  if (idx !== -1) priority = args[idx + 1] || '';" \
  "  else if (args[1]) priority = args[1];" \
  "  if (!['P0', 'P1', 'P2'].includes(priority)) die('invalid --priority');" \
  "  fs.mkdirSync(tasks, { recursive: true });" \
  "  let n = 1;" \
  "  let file = '';" \
  "  while (true) {" \
  "    file = path.join(tasks, 'TASK-' + day + '-' + String(n).padStart(3, '0') + '.md');" \
  "    if (!fs.existsSync(file)) break;" \
  "    n += 1;" \
  "  }" \
  "  const id = 'TASK-' + day + '-' + String(n).padStart(3, '0');" \
  "  fs.writeFileSync(file, [" \
  "    '# ' + id + ': ' + title," \
  "    'Status: IN_PROGRESS'," \
  "    'Priority: ' + priority," \
  "    'Created: ' + stamp," \
  "    'Completed: -'," \
  "    ''," \
  "    '## Requirements'," \
  "    title," \
  "    ''," \
  "    '## Subtasks'," \
  "    '- [ ] (task1) - <scope> (Implementer: cc-xxx, file: ...)'," \
  "    '- [ ] Final Review (Reviewer: coder)'," \
  "    ''," \
  "    '## Output files'," \
  "    '- ...'," \
  "    ''," \
  "    '## Log'," \
  "    ''," \
  "  ].join('\\n'));" \
  "  process.stdout.write(file + '\\n');" \
  "} else if (cmd === 'log') {" \
  "  const file = args[0];" \
  "  const messageParts = args.slice(1);" \
  "  if (!file || !fs.existsSync(file)) die('no task file');" \
  "  fs.appendFileSync(file, '- [' + stamp + '] ' + messageParts.join(' ') + '\\n');" \
  "  process.stdout.write('logged -> ' + file + '\\n');" \
  "} else if (cmd === 'done') {" \
  "  const file = args[0];" \
  "  if (!file || !fs.existsSync(file)) die('no task file');" \
  "  const next = fs.readFileSync(file, 'utf8').replace(/^Status: .*$/m, 'Status: DONE').replace(/^Completed: .*$/m, 'Completed: ' + stamp);" \
  "  fs.writeFileSync(file, next);" \
  "  process.stdout.write('done -> ' + file + '\\n');" \
  "} else {" \
  "  die('unknown task command ' + (cmd || ''));" \
  "}" \
  > "$FUGUE_ENGINE_CLI"

echo "fuguectl-task tests"

F="$(bash "$T" new "test task title" P0)"
ok "new returns path and file exists" '[ -f "$F" ]'
ok "new filename like TASK-<date>-NNN.md" 'echo "$F" | grep -qE "TASK-[0-9]{4}-[0-9]{2}-[0-9]{2}-[0-9]{3}\.md$"'
ok "Status: IN_PROGRESS" 'grep -q "^Status: IN_PROGRESS" "$F"'
ok "Priority written P0" 'grep -q "^Priority: P0" "$F"'
ok "title goes into title line" 'grep -q "test task title" "$F"'
ok "has Log section" 'grep -q "^## Log" "$F"'

# second new should increment the number (no overwrite)
F2="$(bash "$T" new "second" )"
ok "second new different file" '[ "$F" != "$F2" ]'

bash "$T" log "$F" "first log entry" >/dev/null
ok "log appends to file" 'grep -q "first log entry" "$F"'
ok "log has timestamp" 'grep -qE "^- \[[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}\] first log entry" "$F"'
ok "log forwards multi-word message for TS joining" 'bash "$T" log "$F" first second >/dev/null && grep -q "first second" "$F"'

bash "$T" "done" "$F" >/dev/null
ok "done → Status: DONE" 'grep -q "^Status: DONE" "$F"'
ok "done wrote Completed time" 'grep -qE "^Completed: [0-9]{4}-" "$F"'
ok "done no longer IN_PROGRESS" '! grep -q "^Status: IN_PROGRESS" "$F"'

# misuse
bash "$T" new >/dev/null 2>&1; ok "new without title → non-0 exit" '[ "$?" -ne 0 ]'
bash "$T" log /no/such/file x >/dev/null 2>&1; ok "log nonexistent file → non-0" '[ "$?" -ne 0 ]'
ok "shell delegates positional priority to engine CLI" 'grep -q "^task new test task title P0$" "$FUGUE_TASK_CALLS"'
ok "shell delegates split log words to engine CLI" 'grep -q "^task log .* first second$" "$FUGUE_TASK_CALLS"'

tdone
