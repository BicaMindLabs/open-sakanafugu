#!/usr/bin/env bash
# install-skill.sh — install fanout as a Claude Code skill (~/.claude/skills/fanout)
# Backs up first if it already exists (never silently overwrites). After install, reopen a Claude Code session to summon it with /fanout.
#   env: CLAUDE_SKILLS_DIR (default ~/.claude/skills) — install elsewhere / for testing
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/orchestration/fanout"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/fanout"

[ -f "$SRC/SKILL.md" ] || { echo "✗ cannot find $SRC/SKILL.md" >&2; exit 1; }
mkdir -p "$(dirname "$DEST")"

if [ -e "$DEST" ]; then
  bak="$DEST.bak.$(date +%Y%m%d-%H%M%S)"
  mv "$DEST" "$bak"
  echo "ℹ backed up the existing skill → $bak"
fi

cp -R "$SRC" "$DEST"
chmod +x "$DEST/fanout" 2>/dev/null || true
chmod +x "$DEST"/*.sh 2>/dev/null || true

echo "✓ fanout skill installed to $DEST"
echo "  Next: reopen a Claude Code session → type /fanout or say \"use fanout to do X / multi-agent collaboration\""
echo "  Self-test: $DEST/fanout selftest"
echo "  Note: the real API key does not travel with the skill, it still lives in ~/.config/cc-model-secrets.env"
