#!/usr/bin/env bash
# Case B setup: clone commander.js, tag a clean baseline, inject 3 related bugs + tests.
# Idempotent. Zero native deps (commander has no runtime deps).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-$HERE/work/commander}"

echo "==> clone commander -> $WORK"
mkdir -p "$(dirname "$WORK")"
if [ ! -d "$WORK/.git" ]; then
  git clone https://github.com/tj/commander.js.git "$WORK"
fi
cd "$WORK"

# pin a fixed tag for reproducibility if provided, else use latest
if [ -n "${COMMANDER_TAG:-}" ]; then git fetch --tags && git checkout "$COMMANDER_TAG"; fi
git rev-parse --short HEAD | tee "$HERE/work/commander.sha"
git tag -f caseB-clean HEAD >/dev/null   # clean baseline for reset_work
npm install --silent

echo "==> verify clean baseline is green"
node --test 2>&1 | tail -3

echo "==> inject 3 bugs + copy tests"
cp "$HERE/inject-bugs.mjs" "$WORK/inject-bugs.mjs"
cp "$HERE/tests/caseB-bug1.test.js" "$WORK/tests/"
cp "$HERE/tests/caseB-bug2.test.js" "$WORK/tests/"
cp "$HERE/tests/caseB-bug3.test.js" "$WORK/tests/"
node inject-bugs.mjs
git add -A && git -c user.email=caseB@local -c user.name=caseB commit -q -m "caseB: inject 3 bugs + tests"
git tag -f caseB-buggy HEAD >/dev/null

echo "==> buggy gate (expect: 3 caseB tests FAIL, rest pass)"
node --test 2>&1 | grep -E 'caseB|pass [0-9]|fail [0-9]' | tail -8
echo "==> setup done. clean=caseB-clean  buggy=caseB-buggy"
