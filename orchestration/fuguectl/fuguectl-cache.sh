#!/usr/bin/env bash
# fuguectl-cache.sh — thin shell bridge to the TypeScript join-result cache.
#
#   init    <round> <task_id:agent> [...]   declare N tasks this round
#   put     <round> <task_id> <file>        store a task result + mark done
#   fail    <round> <task_id> [reason]      mark a task failed
#   status  <round>                         print done/fail/pending counts
#   barrier <round> [--wait [secs]] [--require-success]
#   collect <round>                         output result paths of done tasks
#   list    <round>                         detail
#   resume  <round>                         print unreturned task_id<TAB>agent
#   env: FUGUE_CACHE, FUGUE_ENGINE_CLI
set -uo pipefail
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/fuguectl-lib.sh"

case "${1:-}" in
  ''|-h|--help) sed -n '2,13p' "$0";;
  *) fx_run_engine cache --cache "$(fx_cache_root)" "$@";;
esac
