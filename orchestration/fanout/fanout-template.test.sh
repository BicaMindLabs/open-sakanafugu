#!/usr/bin/env bash
# fanout-template.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
T="$HERE/fanout-template.sh"
pass=0; fail=0
ok(){ if eval "$2"; then echo "  ✓ $1"; pass=$((pass+1)); else echo "  ✗ $1"; fail=$((fail+1)); fi; }

echo "fanout-template tests"

out="$(bash "$T" impl --set ROLE=backend --set SCOPE=write-parser --set FILES=src/p.py)"
ok "impl template renders with substituted values" 'echo "$out" | grep -q "Your role: backend" && echo "$out" | grep -q "write-parser" && echo "$out" | grep -q "src/p.py"'
ok "set placeholders are replaced" '! echo "$out" | grep -q "{{ROLE}}"'

# unset placeholders are kept
out2="$(bash "$T" impl --set ROLE=x)"
ok "unset {{SCOPE}} is kept" 'echo "$out2" | grep -q "{{SCOPE}}"'

# review / analysis templates exist
ok "review template renders" 'bash "$T" review --set REVIEWER=Codex --set DIFF_RANGE=main...HEAD --set DIFF=x | grep -q "VERDICT: ACCEPTED"'
ok "analysis template renders" 'bash "$T" analysis --set ROLE=reviewer | grep -q "must use the Write tool"'

# errors
bash "$T" >/dev/null 2>&1; ok "no name → non-0" '[ "$?" -ne 0 ]'
bash "$T" nope >/dev/null 2>&1; ok "unknown template → non-0" '[ "$?" -ne 0 ]'
bash "$T" impl --set BADFORMAT >/dev/null 2>&1; ok "--set without = → non-0" '[ "$?" -ne 0 ]'

echo "fanout-template: $pass passed, $fail failed"
[ "$fail" -eq 0 ]
