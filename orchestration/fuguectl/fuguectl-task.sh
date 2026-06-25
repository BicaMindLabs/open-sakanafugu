#!/usr/bin/env bash
# fuguectl-task.sh — thin shell bridge to the TypeScript TASK commands
#
#   new  "<title>" [P0|P1|P2]     create TASK-<date>-<NNN>.md under $TASKS, print path
#   log  <task-file> "<message>"  append timestamped log to the "Log" section
#   done <task-file>              Status: DONE + Completed time
#   env: TASKS = task directory (default ~/.claude/tasks)
#   env: FUGUE_ENGINE_CLI overrides the built engine CLI path
set -uo pipefail
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/fuguectl-lib.sh"

sub="${1:-}"; shift || true
case "$sub" in
  new|log|done) fx_run_engine task "$sub" "$@";;
  ''|-h|--help) sed -n '2,9p' "$0";;
  *) die "unknown subcommand '$sub' (new|log|done)";;
esac
