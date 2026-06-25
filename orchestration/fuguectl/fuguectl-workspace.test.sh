#!/usr/bin/env bash
# fuguectl-workspace.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
W="$HERE/fuguectl-workspace.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_WORKSPACE_CALLS="$TMP/workspace-calls.txt"
# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

printf '%s\n' \
  "const fs = require('node:fs');" \
  "const argv = process.argv.slice(2);" \
  "fs.appendFileSync(process.env.FUGUE_WORKSPACE_CALLS, argv.join(' ') + '\\n');" \
  "const root = argv[0];" \
  "const cmd = argv[1];" \
  "const args = argv.slice(2);" \
  "if (root !== 'workspace') {" \
  "  console.error('expected workspace');" \
  "  process.exit(9);" \
  "}" \
  "let name = '';" \
  "for (let i = 0; i < args.length; i += 1) {" \
  "  const arg = args[i];" \
  "  if (['--dir', '--allocation', '--stats', '--experience', '--task'].includes(arg)) {" \
  "    i += 1;" \
  "  } else if (!arg.startsWith('--')) {" \
  "    name = arg;" \
  "    break;" \
  "  }" \
  "}" \
  "if (cmd === 'list') {" \
  "  process.stdout.write('  code       You are at the code station.\\n  review     Review only correctness.\\n  main       Plan and route.\\n  sql        SQL station.\\n  web        Web station.\\n  chinese    Chinese docs.\\n');" \
  "} else if (cmd === 'show' && name === 'code') {" \
  "  process.stdout.write('prompt: code\\nmodels: @bench:code\\ntools: read,edit,write,bash\\n');" \
  "} else if (cmd === 'model' && name === 'code') {" \
  "  process.stdout.write('minimax,doubao,glm\\n');" \
  "} else if (cmd === 'model' && name === 'review') {" \
  "  process.stdout.write('coder\\n');" \
  "} else if (cmd === 'context' && name === 'code') {" \
  "  const taskIndex = args.indexOf('--task');" \
  "  const task = taskIndex === -1 ? '' : args[taskIndex + 1] || '';" \
  "  const taskBlock = task.length > 0 ? '### Task\\n' + task + '\\n\\n' : '';" \
  "  process.stdout.write('## Context - workspace: code\\n\\n### System Prompt\\nDo not call Gemini.\\n\\n### Workspace Prompt\\ncode station\\n\\n### Tools\\nread edit write bash  (only this station enabled, the rest not exposed)\\n\\n### Memory\\nscope: event,experience  (only memory relevant to this scope, not the full archive)\\n\\n### History\\nlast few conversation rounds + key execution trace (not the full transcript)\\n\\n' + taskBlock + '> suggested model(bench): minimax,doubao,glm\\n');" \
  "} else {" \
  "  console.error('no workspace ' + (name || ''));" \
  "  process.exit(1);" \
  "}" \
  > "$FUGUE_ENGINE_CLI"

echo "fuguectl-workspace tests"

ok "list shows >=6 stations" '[ "$(bash "$W" list | grep -c .)" -ge 6 ]'
ok "list includes code/review/main" 'o=$(bash "$W" list); [[ "$o" == *"code"* && "$o" == *"review"* && "$o" == *"main"* ]]'

ok "show code has models field" 'o=$(bash "$W" show code); [[ "$o" == *"models:"* ]]'

# model: @bench:code → resolved via allocation to minimax,...
ok "model code → bench resolves to minimax" 'o=$(bash "$W" model code); [[ "$o" == *"minimax"* ]]'
ok "model review → coder" '[ "$(bash "$W" model review)" = "coder" ]'

# context: all five layers present (Zleap format)
ctx="$(bash "$W" context code)"
for sec in "System Prompt" "Workspace Prompt" "### Tools" "### Memory" "### History"; do
  ok "context has [$sec]" '[[ "$ctx" == *"$sec"* ]]'
done
ok "context carries global no-Gemini rule" '[[ "$ctx" == *"Do not call Gemini"* ]]'
ok "context code exposes only this station tools(incl edit)" '[[ "$ctx" == *"edit"* ]]'

# --task injection (capture then substring-match, avoids pipefail+grep -q SIGPIPE)
ok "context --task injects task" 'o=$(bash "$W" context code --task "doX"); [[ "$o" == *"doX"* ]]'

bash "$W" context nope >/dev/null 2>&1; ok "unknown workspace → non-0" '[ "$?" -ne 0 ]'
o=$(bash "$W" 2>&1); ok "no subcommand → shows help(incl list)" '[[ "$o" == *"list"* ]]'
ok "shell delegates to engine CLI" 'grep -q "^workspace context --dir .* --allocation .* --stats .* --experience .* code --task doX$" "$FUGUE_WORKSPACE_CALLS"'

tdone
