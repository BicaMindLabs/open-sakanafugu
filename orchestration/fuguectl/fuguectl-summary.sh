#!/usr/bin/env bash
# fuguectl-summary.sh — thin shell bridge to the TypeScript round summary command.
# round observability: cache-status summary table (optionally written into the TASK file)
#   fuguectl-summary.sh <round> [--task <file>]
#   env: FUGUE_CACHE, FUGUE_ENGINE_CLI
set -uo pipefail
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/fuguectl-lib.sh"

round="${1:-}"; shift || true
case "$round" in
  ''|-h|--help) sed -n '2,5p' "$0";;
  *) fx_run_engine summary "$round" --cache "$(fx_cache_root)" "$@";;
esac
