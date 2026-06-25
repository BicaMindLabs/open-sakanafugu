#!/usr/bin/env bash
# fuguectl-allocate.test.sh — self-test for the allocate shell bridge.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
A="$HERE/fuguectl-allocate.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_ALLOCATION="$TMP/allocation.tsv"
export FUGUE_ALLOCATION_STATS="$TMP/stats.tsv"
export FUGUE_ALLOCATION_LEDGER="$TMP/ledger.tsv"
export FUGUE_ALLOCATE_KAPPA=7
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_ALLOCATE_CALLS="$TMP/allocate-calls.txt"

# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

cat > "$FUGUE_ALLOCATION" <<'EOF'
code	minimax,doubao,glm
fallback	mimo
EOF

cat > "$FUGUE_ENGINE_CLI" <<'EOF'
const fs = require('node:fs');

fs.appendFileSync(process.env.FUGUE_ALLOCATE_CALLS, `${process.argv.slice(2).join(' ')}\n`);
const args = process.argv.slice(2);
if (args[0] !== 'allocate') {
  console.error('expected allocate root command');
  process.exit(2);
}
for (const flag of ['--table', '--stats', '--ledger', '--kappa']) {
  const index = args.indexOf(flag);
  if (index === -1 || !args[index + 1]) {
    console.error(`missing ${flag}`);
    process.exit(2);
  }
}
process.exit(0);
EOF
chmod +x "$FUGUE_ENGINE_CLI"

echo "fuguectl-allocate tests"

bash "$A" code --top >/dev/null
ok "allocate shim injects table/stats/ledger/kappa" 'grep -q "^allocate --table $FUGUE_ALLOCATION --stats $FUGUE_ALLOCATION_STATS --ledger $FUGUE_ALLOCATION_LEDGER --kappa 7 code --top$" "$FUGUE_ALLOCATE_CALLS"'

bash "$A" feed --from-ledger --result ok --fail cc-zeta >/dev/null
ok "allocate shim preserves feed flags" 'grep -q "^allocate --table $FUGUE_ALLOCATION --stats $FUGUE_ALLOCATION_STATS --ledger $FUGUE_ALLOCATION_LEDGER --kappa 7 feed --from-ledger --result ok --fail cc-zeta$" "$FUGUE_ALLOCATE_CALLS"'

help="$(bash "$A" --help)"
ok "help prints allocate commands" 'case "$help" in *"record <task-type>"*) true;; *) false;; esac'
ok "help does not call engine" '[ "$(grep -c . "$FUGUE_ALLOCATE_CALLS")" -eq 2 ]'

tdone
