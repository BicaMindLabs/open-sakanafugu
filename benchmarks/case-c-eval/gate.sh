#!/usr/bin/env bash
# Case C gate: FuguNano engine `npm run check` (typecheck + lint + test) fully green.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-$HERE/work/fugunano}"
cd "$WORK/engine"
LOG="$HERE/gate.log"
if npm run check >"$LOG" 2>&1; then
  echo "GATE: PASS"
  grep -E 'Test Files|Tests ' "$LOG" | tail -2
  exit 0
else
  echo "GATE: FAIL"
  tail -30 "$LOG"
  exit 1
fi
