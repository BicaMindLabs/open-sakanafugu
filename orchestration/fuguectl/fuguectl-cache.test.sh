#!/usr/bin/env bash
# fuguectl-cache.test.sh — self-test for the cache shell bridge.
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CACHE="$HERE/fuguectl-cache.sh"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export FUGUE_CACHE="$TMP/cache"
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_CACHE_CALLS="$TMP/cache-calls.txt"

# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

cat > "$FUGUE_ENGINE_CLI" <<'EOF'
const fs = require('node:fs');

fs.appendFileSync(process.env.FUGUE_CACHE_CALLS, `${process.argv.slice(2).join(' ')}\n`);
const args = process.argv.slice(2);
if (args[0] !== 'cache') {
  console.error('expected cache root command');
  process.exit(2);
}
const cacheIndex = args.indexOf('--cache');
if (cacheIndex === -1 || !args[cacheIndex + 1]) {
  console.error('missing --cache');
  process.exit(2);
}
process.exit(0);
EOF
chmod +x "$FUGUE_ENGINE_CLI"

echo "fuguectl-cache tests"

bash "$CACHE" init 1 t1:cc-deepseek t2:cc-glm >/dev/null
ok "cache shim injects cache root" 'grep -q "^cache --cache $FUGUE_CACHE init 1 t1:cc-deepseek t2:cc-glm$" "$FUGUE_CACHE_CALLS"'

bash "$CACHE" barrier 1 --require-success >/dev/null
ok "cache shim preserves barrier flags" 'grep -q "^cache --cache $FUGUE_CACHE barrier 1 --require-success$" "$FUGUE_CACHE_CALLS"'

help="$(bash "$CACHE" --help)"
ok "help prints cache commands" 'echo "$help" | grep -q "barrier <round>"'
ok "help does not call engine" '[ "$(grep -c . "$FUGUE_CACHE_CALLS")" -eq 2 ]'

tdone
