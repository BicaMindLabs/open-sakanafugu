#!/usr/bin/env bash
# fuguectl-plan.sh — thin shell bridge to the TypeScript planning panel command.
# multi-model planning panel: send "decompose goal" to N planning models at once, each Writes its plan,
#                  then the planner(Claude) synthesizes. This is the design panel pattern.
#   fuguectl-plan.sh "<goal>" [--models m1,m2,..] [--out <dir>]
#   default models = cc-deepseek,cc-kimi,coder   (cross-family, different perspectives)
#   default out    = <cache_root>/plans
#   env: FUGUE_CC_BIN(stub for tests) / FUGUE_CACHE / FUGUE_ENGINE_CLI
set -uo pipefail
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/fuguectl-lib.sh"

case "${1:-}" in
  -h|--help) sed -n '2,8p' "$0";;
  *) fx_run_engine plan "$@";;
esac
