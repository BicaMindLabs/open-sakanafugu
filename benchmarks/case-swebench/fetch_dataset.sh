#!/usr/bin/env bash
# Download SWE-bench-lite dev split (parquet) and flatten to JSONL. CC-BY-4.0 — keep attribution.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; mkdir -p "$HERE/work"
OUT="$HERE/work/dataset.jsonl"
URL="https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite/resolve/main/data/dev-00000-of-00001.parquet"
PYTHON="${PYTHON:-$(command -v python3 || command -v python)}"

if [ -s "$OUT" ]; then echo "dataset present: $OUT ($(wc -l <"$OUT") instances)"; exit 0; fi
echo "==> fetching SWE-bench-lite dev (parquet) -> work/dataset.parquet"
if command -v curl >/dev/null; then curl -fsSL "$URL" -o "$HERE/work/dataset.parquet";
  elif command -v wget >/dev/null; then wget -qO "$HERE/work/dataset.parquet" "$URL";
  else echo "need curl or wget"; exit 1; fi

echo "==> converting parquet -> JSONL"
"$PYTHON" - <<'PY' "$HERE/work/dataset.parquet" "$OUT"
import json, sys
src, dst = sys.argv[1], sys.argv[2]
try:
    import pyarrow.parquet as pq
    rows = pq.read_table(src).to_pylist()
except Exception:
    import pandas as pd
    rows = pd.read_parquet(src).to_dict("records")
with open(dst, "w") as f:
    for r in rows:
        f.write(json.dumps(r) + "\n")
print(f"  {len(rows)} instances")
PY
echo "==> written to $OUT ($(wc -l <"$OUT") instances)"
echo "    fields: instance_id, repo, base_commit, problem_statement, patch, test_patch, FAIL_TO_PASS, PASS_TO_PASS"
