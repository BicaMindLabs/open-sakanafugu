#!/usr/bin/env bash
# Batch: run N SWE-bench-lite instances through both solvers, log resolved-rate.
#
#   N=20 ./run_batch.sh
#
# Prereqs: fetch_dataset.sh; each repo cloned under work/repos/<repo> with deps.
# Rows appended to results.csv: instance_id,solver,resolved,wallclock_s
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DS="$HERE/work/dataset.jsonl"
N="${N:-10}"
RESULTS="$HERE/results.csv"
[ -f "$RESULTS" ] || echo "instance_id,solver,resolved,wallclock_s" > "$RESULTS"

[ -s "$DS" ] || { echo "run fetch_dataset.sh first"; exit 1; }

mapfile -t IDS < <(head -n "$N" "$DS" | python3 -c 'import json,sys;[print(json.loads(l)["instance_id"]) for l in sys.stdin]')

for id in "${IDS[@]}"; do
  for solver in single orchestrated; do
    echo "=== $id / $solver ==="
    t0=$(date +%s 2>/dev/null || python3 -c 'import time;print(int(time.time))')
    if "$HERE/solve-instance.sh" "$id" "$solver" 2>&1 | grep -q "^RESOLVED"; then R=1; else R=0; fi
    dt=$(( $(date +%s 2>/dev/null || python3 -c 'import time;print(int(time.time))') - t0 ))
    echo "$id,$solver,$R,$dt" >> "$RESULTS"
  done
done

echo ""; echo "=== aggregate resolved-rate ==="
python3 - "$RESULTS" <<'PY'
import csv,sys,collections
rows=list(csv.DictReader(open(sys.argv[1])))
by=collections.defaultdict(lambda:[0,0])
for r in rows:
    by[r["solver"]][1]+=1
    if r["resolved"]=="1": by[r["solver"]][0]+=1
for s,(ok,n) in by.items():
    print(f"  {s}: {ok}/{n} resolved ({100*ok//n if n else 0}%)")
PY
