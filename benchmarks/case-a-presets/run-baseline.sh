#!/usr/bin/env bash
# Case A — single-model baseline. The WHOLE feature goes to one model in one pass:
# no parallel split, no gen!=review loop. Use this to build the comparison rows.
#
#   ./run-baseline.sh <agent> <harness>
#   ./run-baseline.sh cc-glm fugue-cc      # B1 — single weak model
#   ./run-baseline.sh cc-claude fugue-cc   # B2 — single strong model
#   ./run-baseline.sh gpt-5.5 codex        # B3 — single strong (codex)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
cd "${FUGUNANO_ROOT:-$(git rev-parse --show-toplevel)}"
FO="orchestration/fuguectl/fuguectl"
WORK="${FUGUE_CC_WORK:?set FUGUE_CC_WORK to the tqdm provider project}"
PYTHON="${PYTHON:-$(command -v python3 || command -v python)}"
AGENT="${1:-cc-glm}"; HARNESS="${2:-fugue-cc}"

# one TASK for the whole feature, one model, one pass
F="$("$FO" task new "tqdm presets (baseline $AGENT)" P1)"
echo "==> baseline: $AGENT via $HARNESS — whole feature, single pass"
"$FO" dispatch "$AGENT" --harness "$HARNESS" \
  --prompt-file "$HERE/prompts/baseline-whole.md" --task "$F" \
  --out "$HERE/work/baseline-$AGENT.out"

# same gate as the orchestrated run (apples-to-apples)
( cd "$WORK" && "$PYTHON" -m pip install -e . >/dev/null 2>&1; "$HERE/gate.sh" "$WORK" ) \
  && echo "==> baseline $AGENT: GATE PASS" || echo "==> baseline $AGENT: GATE FAIL"
echo "==> subjectively score with rubric.md, then append a row to results.csv"
