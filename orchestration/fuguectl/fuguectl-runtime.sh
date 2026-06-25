#!/usr/bin/env bash
# fuguectl-runtime.sh — thin shell bridge to the TypeScript fugue-cc runtime sync.
# fugue-cc runtime provider sync
#
# Adaptations to do after a fugue-cc provider upgrade:
#   1. is the grafting dependency (api_shortcuts.py) still there —— claude+url grafting relies entirely on it
#   2. provider daemon must restart —— runtime updates do not restart a running daemon
#   3. re-run preflight (provider.config still sound under the new version + no-Gemini)
#   4. record the new version, for next comparison
#
#   check            print current/last provider version + whether drifted + grafting soundness
#   adapt [--apply]  if drifted, adapt: verify grafting → (--apply stops daemon) → preflight → record version
#                    without --apply = dry-run (report only, does not touch daemon / does not write stamp)
#   env: FUGUE_CC_BIN(default fugue-cc) / FUGUE_CC_WORK / FUGUE_CC_CLAUDE / FUGUE_STATE(default ~/.config/fugue) / FUGUE_CC_INSTALL(override install path)
set -uo pipefail
# shellcheck source=/dev/null
. "$(dirname "${BASH_SOURCE[0]}")/fuguectl-lib.sh"

sub="${1:-}"; shift || true
case "$sub" in
  check|adapt) fx_run_engine runtime "$sub" "$@";;
  ''|-h|--help) sed -n '2,14p' "$0";;
  *) die "unknown subcommand '$sub' (check|adapt)";;
esac
