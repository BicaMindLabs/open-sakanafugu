#!/usr/bin/env bash
# Case A setup: clone tqdm at a pinned commit into a worktree-ready layout + deps + baseline gate.
# Safe to re-run. Reproducibility: pin with TQDM_PIN=<sha> or TQDM_TAG=<tag>.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-$HERE/work/tqdm}"
PYTHON="${PYTHON:-$(command -v python3 || command -v python)}"

echo "==> clone tqdm -> $WORK"
mkdir -p "$(dirname "$WORK")"
if [ ! -d "$WORK/.git" ]; then
  git clone https://github.com/tqdm/tqdm.git "$WORK"
fi
cd "$WORK"
if [ -n "${TQDM_TAG:-}" ]; then git fetch --tags && git checkout "$TQDM_TAG"; fi
if [ -n "${TQDM_PIN:-}" ]; then git fetch --depth 1 origin "$TQDM_PIN" && git checkout "$TQDM_PIN"; fi
git rev-parse --short HEAD | tee "$HERE/work/tqdm.sha"
git tag -f caseA-baseline HEAD >/dev/null   # stable baseline ref for run-live.sh reset_work
echo "    (override with TQDM_TAG=... or TQDM_PIN=<sha> for strict reproducibility)"

echo "==> install deps (best-effort; core tests need pytest only)"
"$PYTHON" -m pip install -e . >/dev/null 2>&1 || "$PYTHON" -m pip install -e .
"$PYTHON" -m pip install -q pytest pytest-timeout pytest-asyncio flake8 2>/dev/null || true

echo "==> baseline gate (MUST be green before any feature work)"
"$PYTHON" -c "import tqdm; print('import ok', tqdm.__version__)"
"$PYTHON" -m pytest tests/tests_tqdm.py tests/tests_main.py tests/tests_utils.py -q -k "not perf"
echo "==> setup done. repo ready at: $WORK"
