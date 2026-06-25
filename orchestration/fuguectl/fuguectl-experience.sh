#!/usr/bin/env bash
# fuguectl-experience.sh — thin shell bridge to the TypeScript Experience memory commands
# Completed task → extract reusable method → **redact** → bucket by workspace → inject into context for future similar tasks.
# (Zleap's three-part memory has Experience: reusable method, redacted, filed by workspace. This repo implements it as files, not a DB.)
#   add  <ws> "<title>" [--from <file>]   store one experience (body from --from or stdin; rejected if redaction fails)
#   list [<ws>]                           list experiences
#   recall <ws> [--query kw] [--limit N]  fetch experiences relevant to this ws (default limit 3, for context injection)
#   show <ws> <slug>                      print one
#   env: FUGUE_EXPERIENCE (default ${FUGUE_STATE:-~/.config/fugue}/experience)
#        FUGUE_ENGINE_CLI overrides the built engine CLI path
set -uo pipefail
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/fuguectl-lib.sh"
STORE="${FUGUE_EXPERIENCE:-${FUGUE_STATE:-$HOME/.config/fugue}/experience}"

sub="${1:-}"; shift || true
case "$sub" in
  add|list|recall|show) fx_run_engine experience "$sub" --store "$STORE" "$@";;
  ''|-h|--help) sed -n '2,13p' "$0";;
  *) die "unknown subcommand '$sub' (add|list|recall|show)";;
esac
