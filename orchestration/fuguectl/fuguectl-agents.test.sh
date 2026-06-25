#!/usr/bin/env bash
# fuguectl-agents.test.sh — Agent Runtime Registry shell helper tests
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
A="$HERE/fuguectl-agents.sh"
FG="$HERE/fuguectl"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

printf '%s\n' \
  "const fs = require('node:fs');" \
  "const args = process.argv.slice(2);" \
  "fs.appendFileSync(process.env.FUGUE_AGENT_CALLS, args.join(' ') + '\\n');" \
  "const root = args[0];" \
  "const cmd = args[1];" \
  "const file = args[2];" \
  "const id = args[3];" \
  "if (root !== 'agent-registry') {" \
  "  console.error('expected agent-registry');" \
  "  process.exit(9);" \
  "}" \
  "if (cmd === 'template') {" \
  "  process.stdout.write('{\\n  \"agents\": [\\n    {\"id\": \"cc-deepseek\", \"harness\": \"fugue-cc\"},\\n    {\"id\": \"coder\", \"harness\": \"codex\", \"target\": \"gpt-5.5\"},\\n    {\"id\": \"opencode-kimi\", \"harness\": \"opencode\"}\\n  ]\\n}\\n');" \
  "} else if (cmd === 'validate') {" \
  "  if (!file || !fs.existsSync(file)) {" \
  "    console.error('no agent registry at ' + (file || ''));" \
  "    process.exit(1);" \
  "  }" \
  "  const text = fs.readFileSync(file, 'utf8');" \
  "  if (/\"id\":\"coder\".*\"id\":\"coder\"/.test(text)) {" \
  "    console.error('registry has duplicate agent \"coder\"');" \
  "    process.exit(1);" \
  "  }" \
  "  if (text.includes('\"claude-code\"')) {" \
  "    console.error('agents[0].harness must be one of fugue-cc, codex, opencode');" \
  "    process.exit(1);" \
  "  }" \
  "  process.stdout.write('OK agent registry valid: 3 agents\\n');" \
  "} else if (cmd === 'list') {" \
  "  process.stdout.write('coder\\tcodex\\tgpt-5.5\\t*\\n');" \
  "} else if (cmd === 'resolve') {" \
  "  if (id !== 'coder') {" \
  "    console.error('agent \"' + (id || '') + '\" not found');" \
  "    process.exit(1);" \
  "  }" \
  "  process.stdout.write('id\\tcoder\\nharness\\tcodex\\ntarget\\tgpt-5.5\\n');" \
  "} else {" \
  "  console.error('bad command ' + (cmd || ''));" \
  "  process.exit(1);" \
  "}" \
  > "$FUGUE_ENGINE_CLI"
chmod +x "$FUGUE_ENGINE_CLI"
export FUGUE_AGENT_CALLS="$TMP/calls"

echo "fuguectl-agents tests"

REG="$TMP/agents.json"
bash "$A" template > "$REG"
ok "template writes agents array" 'grep -q "\"agents\"" "$REG"'
ok "template includes codex reviewer profile" 'grep -q "\"harness\": \"codex\"" "$REG" && grep -q "\"id\": \"coder\"" "$REG"'

out="$(bash "$A" validate "$REG")"
ok "validate accepts template" 'echo "$out" | grep -q "OK agent registry valid: 3 agents"'

list="$(bash "$A" list "$REG")"
ok "list includes coder target" 'echo "$list" | grep -q "$(printf "coder\tcodex\tgpt-5.5")"'

resolved="$(bash "$A" resolve "$REG" coder)"
ok "resolve prints harness" 'echo "$resolved" | grep -q "$(printf "harness\tcodex")"'
ok "resolve prints target" 'echo "$resolved" | grep -q "$(printf "target\tgpt-5.5")"'

top="$(bash "$FG" agents template)"
ok "top-level agents entrypoint works" 'echo "$top" | grep -q "\"opencode\""'

cat > "$TMP/dupe.json" <<'JSON'
{"agents":[{"id":"coder","harness":"codex"},{"id":"coder","harness":"opencode"}]}
JSON
bash "$A" validate "$TMP/dupe.json" >/dev/null 2>&1
ok "duplicate id rejected" '[ "$?" -ne 0 ]'

cat > "$TMP/bad-harness.json" <<'JSON'
{"agents":[{"id":"bad","harness":"claude-code"}]}
JSON
bash "$A" validate "$TMP/bad-harness.json" >/dev/null 2>&1
ok "invalid harness rejected" '[ "$?" -ne 0 ]'

bash "$A" resolve "$REG" missing-agent >/dev/null 2>&1
ok "unknown agent rejected" '[ "$?" -ne 0 ]'

bash "$A" nope >/dev/null 2>&1
ok "unknown subcommand rejected" '[ "$?" -ne 0 ]'

ok "shell delegates to engine CLI" 'grep -q "^agent-registry resolve .* coder$" "$FUGUE_AGENT_CALLS"'

tdone
