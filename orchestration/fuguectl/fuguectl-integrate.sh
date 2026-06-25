#!/usr/bin/env bash
# fuguectl-integrate.sh — thin shell bridge to the TypeScript worktree integrator.
#
#   --work <repo>          main repo (cherry-pick target; must be a git repo)
#   --agents "a b c"       agents to integrate (worktree names), space-separated
#   --ws-parent <dir>      worktree parent dir (relative to work or absolute; default .fugue-cc/workspaces)
#   --onconflict abort|skip  conflict handling: abort keeps main clean(default) / skip leaves conflict for human
#   --ownership <file>     TSV: agent<TAB>owned-globs<TAB>forbidden-globs
#   --task <file>          append the summary into the TASK file (optional)
#   --dry                  only print who would be integrated, do not touch git
#   env: FUGUE_ENGINE_CLI
set -uo pipefail
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/fuguectl-lib.sh"

case "${1:-}" in
  -h|--help) sed -n '2,11p' "$0";;
  *) fx_run_engine integrate "$@";;
esac
