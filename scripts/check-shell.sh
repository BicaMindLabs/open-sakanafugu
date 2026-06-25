#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$HERE/run-ts.mjs" "$HERE/check-shell.ts" "$@"
