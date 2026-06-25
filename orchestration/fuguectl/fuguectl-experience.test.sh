#!/usr/bin/env bash
# fuguectl-experience.test.sh
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
E="$HERE/fuguectl-experience.sh"
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
export FUGUE_EXPERIENCE="$TMP/exp"
export FUGUE_ENGINE_CLI="$TMP/fugue-engine"
export FUGUE_EXPERIENCE_CALLS="$TMP/experience-calls.txt"
# shellcheck source=/dev/null
. "$HERE/fuguectl-testlib.sh"

printf '%s\n' \
  "const fs = require('node:fs');" \
  "const path = require('node:path');" \
  "const args = process.argv.slice(2);" \
  "fs.appendFileSync(process.env.FUGUE_EXPERIENCE_CALLS, args.join(' ') + '\\n');" \
  "const root = args[0];" \
  "const cmd = args[1];" \
  "const die = (message) => { console.error(message); process.exit(1); };" \
  "const readStdin = () => fs.readFileSync(0, 'utf8').replace(/\\n$/u, '');" \
  "const slugify = (title) => title.replace(/[ /]/g, '-').replace(/[\"'\\\`]/g, '');" \
  "const field = (text, key) => {" \
  "  const line = text.split(/\\r?\\n/u).find((item) => item.startsWith(key + ': '));" \
  "  return line === undefined ? '' : line.slice(key.length + 2);" \
  "};" \
  "const bodyOf = (text) => text.replace(/^---\\n[\\s\\S]*?\\n---\\n/u, '').replace(/\\n+$/u, '');" \
  "const parseExperienceArgs = () => {" \
  "  const storeIndex = args.indexOf('--store');" \
  "  if (storeIndex === -1) die('missing --store');" \
  "  return { store: args[storeIndex + 1], rest: args.slice(2).filter((_, index) => index !== storeIndex - 2 && index !== storeIndex - 1) };" \
  "};" \
  "if (root === 'workspace' && cmd === 'context') {" \
  "  const store = process.env.FUGUE_EXPERIENCE;" \
  "  let injected = '';" \
  "  const dir = path.join(store, 'code');" \
  "  if (fs.existsSync(dir)) {" \
  "    for (const name of fs.readdirSync(dir).filter((item) => item.endsWith('.md'))) injected += fs.readFileSync(path.join(dir, name), 'utf8') + '\\n';" \
  "  }" \
  "  process.stdout.write('## Context - workspace: code\\n\\n' + injected);" \
  "  process.exit(0);" \
  "}" \
  "if (root !== 'experience') die('expected experience');" \
  "const parsed = parseExperienceArgs();" \
  "const store = parsed.store;" \
  "const rest = parsed.rest;" \
  "if (cmd === 'add') {" \
  "  const ws = rest[0];" \
  "  const title = rest[1];" \
  "  const tail = rest.slice(2);" \
  "  if (!ws || !title) die('usage: add <ws> <title>');" \
  "  const fromIndex = tail.indexOf('--from');" \
  "  const body = fromIndex === -1 ? readStdin() : fs.readFileSync(tail[fromIndex + 1], 'utf8').replace(/\\n$/u, '');" \
  "  if (body.length === 0) die('experience body is empty');" \
  "  if (/sk-[A-Za-z0-9_-]{20,}|tp-[a-z0-9]{30,}|[0-9a-f]{32}\\.[A-Za-z0-9]{16}/u.test(body)) die('body contains a suspected key; redact first');" \
  "  const dir = path.join(store, ws);" \
  "  fs.mkdirSync(dir, { recursive: true });" \
  "  const slug = slugify(title);" \
  "  const file = path.join(dir, slug + '.md');" \
  "  fs.writeFileSync(file, '---\\nworkspace: ' + ws + '\\ntitle: ' + title + '\\ncreated: 1\\n---\\n' + body + '\\n');" \
  "  process.stdout.write('experience stored: ' + file + '\\n');" \
  "} else if (cmd === 'list') {" \
  "  const ws = rest[0];" \
  "  const base = ws === undefined ? store : path.join(store, ws);" \
  "  if (!fs.existsSync(base)) { process.stdout.write('(no experiences yet)\\n'); process.exit(0); }" \
  "  const files = [];" \
  "  const visit = (dir) => {" \
  "    for (const name of fs.readdirSync(dir)) {" \
  "      const file = path.join(dir, name);" \
  "      if (fs.statSync(file).isDirectory()) visit(file);" \
  "      else if (name.endsWith('.md')) files.push(file);" \
  "    }" \
  "  };" \
  "  visit(base);" \
  "  for (const file of files.sort()) {" \
  "    const text = fs.readFileSync(file, 'utf8');" \
  "    process.stdout.write('  ' + path.basename(path.dirname(file)).padEnd(12) + ' ' + field(text, 'title') + '\\n');" \
  "  }" \
  "} else if (cmd === 'recall') {" \
  "  const ws = rest[0];" \
  "  const queryIndex = rest.indexOf('--query');" \
  "  const query = queryIndex === -1 ? '' : rest[queryIndex + 1];" \
  "  const dir = path.join(store, ws);" \
  "  if (!fs.existsSync(dir)) process.exit(0);" \
  "  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => path.join(dir, name));" \
  "  for (const file of files) {" \
  "    const text = fs.readFileSync(file, 'utf8');" \
  "    if (query && !text.includes(query)) continue;" \
  "    process.stdout.write('[experience] ' + field(text, 'title') + '\\n' + bodyOf(text) + '\\n\\n');" \
  "  }" \
  "} else if (cmd === 'show') {" \
  "  const ws = rest[0];" \
  "  const slug = rest[1];" \
  "  const file = path.join(store, ws, slug + '.md');" \
  "  if (!fs.existsSync(file)) die('no experience ' + ws + '/' + slug);" \
  "  process.stdout.write(fs.readFileSync(file, 'utf8'));" \
  "} else {" \
  "  die('unknown experience command ' + cmd);" \
  "}" \
  > "$FUGUE_ENGINE_CLI"

echo "fuguectl-experience tests"

# add via stdin
echo "use defensive copy(intervals[0][:]) to avoid mutating the input interval" | bash "$E" add code "defensive-copy-trick" >/dev/null
ok "add stored" '[ -f "$FUGUE_EXPERIENCE/code/defensive-copy-trick.md" ]'
ok "record has body" 'grep -q "defensive copy" "$FUGUE_EXPERIENCE/code/defensive-copy-trick.md"'
ok "record has frontmatter" 'grep -q "^workspace: code" "$FUGUE_EXPERIENCE/code/defensive-copy-trick.md"'

# redaction: body has plaintext key → reject (build fake key at runtime, no literal sk- in the file, avoids scan-secrets false positive)
FAKEKEY="sk-$(printf 'a%.0s' $(seq 25))"
echo "use this key $FAKEKEY" | bash "$E" add code "bad-experience" >/dev/null 2>&1
ok "has key → reject(non-0)" '[ "$?" -ne 0 ]'
ok "bad experience not stored" '[ ! -f "$FUGUE_EXPERIENCE/code/bad-experience.md" ]'

# list (capture to avoid SIGPIPE)
ok "list has title" 'o=$(bash "$E" list code); grep -q defensive-copy <<<"$o"'

# recall
out="$(bash "$E" recall code)"
ok "recall emits body" 'echo "$out" | grep -q "defensive copy"'
ok "recall has [experience] marker" 'echo "$out" | grep -q "\[experience\]"'
ok "recall drops frontmatter(no created:)" '! echo "$out" | grep -q "^created:"'

# empty ws → empty output, exit 0
ok "recall empty ws → empty" '[ -z "$(bash "$E" recall nonexistent)" ]'

# query filter
echo "qwen3 SQL last 30 days uses DATE_SUB(CURDATE(),INTERVAL 30 DAY)" | bash "$E" add sql "sql-date-window" >/dev/null
ok "recall --query hits" 'o=$(bash "$E" recall sql --query DATE_SUB); grep -q DATE_SUB <<<"$o"'

# show
ok "show prints record" 'o=$(bash "$E" show code defensive-copy-trick); grep -q "title: defensive-copy-trick" <<<"$o"'

# integration: workspace context injects this ws's experience (FUGUE_EXPERIENCE already exported)
ctx="$(bash "$HERE/fuguectl-workspace.sh" context code)"
ok "workspace context injects experience" 'echo "$ctx" | grep -q "defensive copy"'
ok "shell delegates to engine CLI" 'grep -q "^experience add --store .* code defensive-copy-trick$" "$FUGUE_EXPERIENCE_CALLS"'

tdone
