#!/usr/bin/env bash
# check-docs.sh — docs-vs-code drift gate (inspired by lavish-axi's `build:skill --check`, adapted for this repo's dual-variant SKILL.md)
#
# Does not "generate" SKILL.md (the private/generalized variants are intentionally different), only verifies that the README's public listing matches the actual code:
#   1. every user subcommand in the `fanout` driver appears in README.md's CLI table
#   2. the README's claimed "N subcommands" == the actual subcommand count
#   3. the README's claimed "N test suites" == the actual *.test.sh file count
#
# Catches "added loop/integrate but the README still says 14 subcommands / 13 test suites" drift.
# Exit codes: 0 consistent / 1 drift (prints findings)
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FANOUT="$ROOT/orchestration/fanout/fanout"
RM_EN="$ROOT/README.md"
FANOUT_DIR="$ROOT/orchestration/fanout"

fail=0
no(){ echo "  ✗ $1"; fail=1; }
ok(){ echo "  ✓ $1"; }

[ -f "$FANOUT" ] || { echo "check-docs: cannot find $FANOUT" >&2; exit 2; }
echo "── check-docs: docs vs code ──"

# 1) extract user subcommands from the driver case (strip aliases, take the first; drop help / selftest / *)
mapfile -t SUBS < <(
  grep -oE '^[[:space:]]+[a-z][a-z0-9|_-]*\)' "$FANOUT" \
    | tr -d ' )' | sed 's/|.*//' \
    | grep -vxE 'help|selftest'
)
N_SUBS="${#SUBS[@]}"
[ "$N_SUBS" -ge 1 ] || { echo "check-docs: parsed no subcommands from the driver" >&2; exit 2; }

# every subcommand must be documented in the README (written as `fanout <sub>` in the CLI table)
for s in "${SUBS[@]}"; do
  miss=""
  grep -qF "fanout $s" "$RM_EN" || miss="$miss README.md"
  [ -z "$miss" ] && ok "subcommand '$s' documented" || no "subcommand '$s' not found in:$miss (add a CLI table row)"
done

# 2) subcommand-count claim consistent
grep -qF "$N_SUBS subcommands" "$RM_EN" \
  && ok "$(basename "$RM_EN"): subcommand-count claim = $N_SUBS" \
  || no "$(basename "$RM_EN"): did not find '$N_SUBS subcommands' (actual $N_SUBS; fix the README's subcommand count)"

# 3) test-suite-count claim consistent
N_SUITES="$(find "$FANOUT_DIR" -maxdepth 1 -name '*.test.sh' | grep -c .)"
grep -qF "$N_SUITES test suites" "$RM_EN" \
  && ok "$(basename "$RM_EN"): test-suite-count claim = $N_SUITES" \
  || no "$(basename "$RM_EN"): did not find '$N_SUITES test suites' (actual $N_SUITES; fix the README's test-suite count)"

echo ""
if [ "$fail" -eq 0 ]; then echo "✓ check-docs: docs and code are consistent ($N_SUBS subcommands · $N_SUITES test suites)"; exit 0
else echo "✗ check-docs: docs drift (✗ above) — fix the README and re-run"; exit 1; fi
