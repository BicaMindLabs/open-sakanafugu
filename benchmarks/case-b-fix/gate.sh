#!/usr/bin/env bash
# Deterministic gate for Case B: ALL commander tests green (incl. the 3 caseB bug tests).
# Exit 0 only when fully green. Bug-fixed == pass; partial fix == fail.
set -uo pipefail
WORK="${1:-$(cd "$(dirname "$0")" && pwd)/work/commander}"
cd "$WORK"

echo "== commander: node --test (full suite) =="
LOG=/tmp/caseB-gate.log
if node --test >"$LOG" 2>&1; then
  echo "GATE: PASS"
  grep -E '^# (pass|fail|tests)' "$LOG" | tail -4
  exit 0
else
  echo "GATE: FAIL — failing tests:"
  grep -E '✖|not ok|caseB' "$LOG" | grep -iE 'caseB|✖' | head -12
  exit 1
fi
