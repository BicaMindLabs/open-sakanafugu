#!/usr/bin/env bash
# fuguectl-runtime.test.sh — use a stub fugue-cc to test version drift + grafting + stamp (never touches real fugue-cc)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
S="$HERE/fuguectl-runtime.sh"
FG="$HERE/fuguectl"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_RUNTIME_CALLS="$TMP/runtime-calls.txt"
# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

printf '%s\n' \
  "const cp = require('node:child_process');" \
  "const fs = require('node:fs');" \
  "const path = require('node:path');" \
  "const args = process.argv.slice(2);" \
  "fs.appendFileSync(process.env.FUGUE_RUNTIME_CALLS, args.join(' ') + '\\n');" \
  "const die = (message) => { console.error(message); process.exit(2); };" \
  "const opt = (name, fallback = '') => {" \
  "  const index = args.indexOf(name);" \
  "  return index === -1 ? fallback : args[index + 1] || fallback;" \
  "};" \
  "const has = (name) => args.includes(name);" \
  "const versionOutput = (bin) => {" \
  "  try { return cp.execFileSync(bin, ['version'], { encoding: 'utf8' }); } catch { return ''; }" \
  "};" \
  "const versionOf = (text) => (text.match(/v[0-9]+\\.[0-9]+\\.[0-9]+/u) || [''])[0];" \
  "const graftingOk = (install) => fs.existsSync(path.join(install, 'lib/provider_profiles/api_shortcuts.py'));" \
  "const root = args[0];" \
  "const sub = args[1];" \
  "if (root !== 'runtime') die('expected runtime');" \
  "const bin = opt('--bin', process.env.FUGUE_CC_BIN || 'fugue-cc');" \
  "const state = opt('--state', process.env.FUGUE_STATE || path.join(process.env.HOME || '', '.config/fugue'));" \
  "const driver = opt('--driver-name', process.env.FUGUE_DRIVER_NAME || 'fuguectl');" \
  "const install = opt('--install', process.env.FUGUE_CC_INSTALL || path.join(process.env.HOME || '', '.local/share/codex-dual'));" \
  "const stamp = path.join(state, 'runtime-version');" \
  "const current = versionOf(versionOutput(bin));" \
  "if (sub === 'check') {" \
  "  const last = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : '(none)';" \
  "  process.stdout.write('fugue-cc provider current: ' + (current || 'unknown') + '   last recorded: ' + last + '\\n');" \
  "  if (!current) process.exit(0);" \
  "  process.stdout.write(current !== last ? '  version drift (' + last + ' -> ' + current + '): run \\'' + driver + ' runtime adapt --apply\\' to adapt\\n' : '  no drift\\n');" \
  "  process.stdout.write(graftingOk(install) ? '  grafting api_shortcuts.py present (' + install + ')\\n' : '  grafting api_shortcuts.py is gone - claude+url grafting may break, check the new fugue-cc version manually\\n');" \
  "} else if (sub === 'adapt') {" \
  "  if (!current) die('cannot get fugue-cc provider version');" \
  "  const apply = has('--apply');" \
  "  const last = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : '';" \
  "  process.stdout.write('fugue-cc runtime adapt (' + (last || 'none') + ' -> ' + current + ')' + (apply ? '' : ' [dry-run]') + '\\n');" \
  "  process.stdout.write(graftingOk(install) ? '  grafting api_shortcuts.py present\\n' : '  grafting dependency lost - new fugue-cc may have changed provider_profiles, grafting scheme needs manual adaptation\\n');" \
  "  const work = opt('--work', process.env.FUGUE_CC_WORK || '');" \
  "  const claude = opt('--claude', process.env.FUGUE_CC_CLAUDE || '');" \
  "  const projects = [work, claude].filter(Boolean);" \
  "  if (projects.length === 0) process.stdout.write('  FUGUE_CC_WORK/FUGUE_CC_CLAUDE unset - skip provider restart (set them and re-run)\\n');" \
  "  for (const project of projects) {" \
  "    if (apply) process.stdout.write('  stopped provider daemon @ ' + project + ' - next cd starts it and loads new code\\n');" \
  "    else process.stdout.write('  [dry] need to restart provider daemon @ ' + project + ' (provider update does not auto-restart, old code keeps running)\\n');" \
  "  }" \
  "  if (apply && work && fs.existsSync(path.join(work, '.fugue-cc/provider.config'))) process.stdout.write('  config validation (no-Gemini + sound):\\n    config OK\\n');" \
  "  if (apply) {" \
  "    fs.mkdirSync(state, { recursive: true });" \
  "    fs.writeFileSync(stamp, current + '\\n');" \
  "    process.stdout.write('  recorded ' + current + ' -> ' + stamp + '\\n');" \
  "  } else {" \
  "    process.stdout.write('  [dry] stamp not written; add --apply to commit\\n');" \
  "  }" \
  "} else {" \
  "  die('unknown runtime command ' + sub);" \
  "}" \
  > "$FUGUE_ENGINE_CLI"

# stub fugue-cc: version → fake version + Install path; others(kill) → no-op
cat > "$TMP/fugue-cc" <<EOF
#!/usr/bin/env bash
case "\$1" in
  version) echo "fugue-cc runtime v9.9.9 abc 2026-01-01"; echo "Install path: $TMP/install";;
  *) exit 0;;
esac
EOF
chmod +x "$TMP/fugue-cc"
export FUGUE_CC_BIN="$TMP/fugue-cc" FUGUE_STATE="$TMP/state" FUGUE_CC_INSTALL="$TMP/install"
unset FUGUE_CC_WORK FUGUE_CC_CLAUDE 2>/dev/null || true

mkdir -p "$TMP/install/lib/provider_profiles"
touch "$TMP/install/lib/provider_profiles/api_shortcuts.py"

echo "fuguectl-runtime tests"

out="$(bash "$S" check)"
ok "check reports version drift (none → v9.9.9)" 'echo "$out" | grep -q "version drift"'
ok "check: grafting api_shortcuts.py present" 'echo "$out" | grep -q "grafting api_shortcuts.py present"'
out_runtime="$(bash "$FG" runtime check)"
ok "runtime entrypoint suggests fuguectl runtime adapt" 'echo "$out_runtime" | grep -q "fuguectl runtime adapt --apply"'

bash "$S" adapt >/dev/null 2>&1
ok "dry-run does not write stamp" '[ ! -f "$FUGUE_STATE/runtime-version" ]'

bash "$S" adapt --apply >/dev/null 2>&1
ok "apply writes stamp=current version" 'grep -q "v9.9.9" "$FUGUE_STATE/runtime-version" 2>/dev/null'

out2="$(bash "$S" check)"
ok "after apply check shows no drift" 'echo "$out2" | grep -q "no drift"'

rm "$TMP/install/lib/provider_profiles/api_shortcuts.py"
out3="$(bash "$S" check)"
ok "missing grafting is detected" 'echo "$out3" | grep -q "api_shortcuts.py is gone"'

# adapt with FUGUE_CC_WORK + clean config → run --config-only validation (stub fugue-cc, never touches real daemon)
touch "$TMP/install/lib/provider_profiles/api_shortcuts.py"   # restore grafting
mkdir -p "$TMP/work/.fugue-cc"
printf '[agents.cc-deepseek]\nmodel = "deepseek-v4-pro"\n' > "$TMP/work/.fugue-cc/provider.config"
OUT4="$TMP/adapt-with-work.out"
FUGUE_CC_WORK="$TMP/work" bash "$S" adapt --apply >"$OUT4" 2>&1
ok "adapt with FUGUE_CC_WORK runs config validation" 'grep -q "config validation" "$OUT4"'
ok "adapt with FUGUE_CC_WORK still records stamp" 'grep -q "v9.9.9" "$FUGUE_STATE/runtime-version"'

bash "$S" nope >/dev/null 2>&1; ok "unknown subcommand → nonzero" '[ "$?" -ne 0 ]'
ok "shell delegates to engine CLI" 'grep -q "^runtime check$" "$FUGUE_RUNTIME_CALLS"'

tdone
