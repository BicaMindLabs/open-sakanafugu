#!/usr/bin/env bash
# Deterministic acceptance gate for Case A. Objective pass/fail — run before the
# subjective reviewer (Phase 5). Exits 0 only if every check is green.
set -euo pipefail
TQDM="${1:-$(cd "$(dirname "$0")" && pwd)/work/tqdm}"
PYTHON="${PYTHON:-$(command -v python3 || command -v python)}"
cd "$TQDM"

pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; FAILED=1; }
FAILED=0

echo "== import smoke =="
"$PYTHON" -c "import tqdm, tqdm.cli, tqdm.utils, tqdm.presets; from tqdm import presets; \
print('imports ok')" && pass "tqdm.presets importable" || fail "import"

echo "== new feature tests =="
"$PYTHON" -m pytest tests/tests_presets.py -q >/tmp/caseA_presets.log 2>&1 && pass "tests_presets.py green" \
  || { fail "tests_presets.py"; tail -20 /tmp/caseA_presets.log; }

echo "== regression (core, fast subset) =="
"$PYTHON" -m pytest tests/tests_tqdm.py tests/tests_main.py tests/tests_utils.py -q -k "not perf" \
  >/tmp/caseA_regress.log 2>&1 && pass "no core regression" \
  || { fail "core regression"; tail -20 /tmp/caseA_regress.log; }

echo "== lint =="
if command -v flake8 >/dev/null 2>&1; then
  flake8 --max-line-length=99 tqdm/presets.py tqdm/utils.py tqdm/cli.py && pass "flake8 clean" \
    || fail "flake8"
else
  echo "  (flake8 not installed — skipped)"
fi

echo "== CLI smoke =="
"$PYTHON" -Om tqdm --list-presets >/tmp/caseA_listpresets.log 2>&1 && pass "tqdm --list-presets exits 0" \
  || { fail "tqdm --list-presets"; cat /tmp/caseA_listpresets.log; }
N=$(grep -c . /tmp/caseA_listpresets.log || true)
[ "${N:-0}" -ge 3 ] && pass "≥3 presets listed" || fail "only ${N:-0} presets listed"

echo ""
if [ "$FAILED" = 0 ]; then echo "GATE: PASS"; exit 0; else echo "GATE: FAIL"; exit 1; fi
