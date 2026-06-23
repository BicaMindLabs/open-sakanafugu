#!/usr/bin/env bash
# Shared helpers for Claude Code model launchers in ~/bin/cc-*.

cc_model_source_secrets() {
  local real_home="${REAL_HOME:-${HOME:-}}"
  local secret_file

  for secret_file in \
    "$real_home/.config/cc-model-secrets.env" \
    "$HOME/.config/cc-model-secrets.env"; do
    [ -n "$secret_file" ] || continue
    [ -r "$secret_file" ] || continue
    # shellcheck disable=SC1090
    . "$secret_file"
  done
}

cc_model_source_secrets

cc_model_unset_proxies() {
  unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY all_proxy NO_PROXY no_proxy
}

cc_model_usage() {
  local command="${CC_MODEL_COMMAND:-cc-model}"
  local default_model="${CC_MODEL_SELECTED:-${MODEL:-}}"
  cat >&2 <<EOF
Usage: $command [options] [claude-code args...]

Options:
  -l, --list           List configured models
  -m, --model MODEL    Pick the startup model
  --doctor             Check launcher config without starting Claude Code
  --env                Print non-secret runtime environment
  -h, --help           Show this help

Default model: ${default_model:-unknown}
EOF
}

cc_model_print_models() {
  printf '%s\n' "${MODELS[@]}"
}

cc_model_json_options() {
  local description_prefix="$1"
  local value_prefix="${2:-}"
  local out="["
  local model value

  for model in "${MODELS[@]}"; do
    value="${value_prefix}${model}"
    out+="{\"value\":\"${value}\",\"label\":\"${model}\",\"description\":\"${description_prefix} · ${model}\"},"
  done
  printf '%s' "${out%,}]"
}

cc_model_reset_plugins() {
  local plug_dir="$HOME/.claude/plugins"
  [ -d "$plug_dir" ] || return 0

  printf '%s\n' '{"version":2,"plugins":{}}' > "$plug_dir/installed_plugins.json" 2>/dev/null || true
  printf '%s\n' '{}' > "$plug_dir/known_marketplaces.json" 2>/dev/null || true

  local d base
  for d in "$plug_dir/cache"/* "$plug_dir/marketplaces"/*; do
    [ -e "$d" ] || continue
    base="$(basename "$d" 2>/dev/null || true)"
    case "$base" in
      claude-plugins-official|"") ;;
      *) rm -rf "$d" ;;
    esac
  done
}

cc_model_secret_status() {
  if [ -n "${CC_MODEL_AUTH_VALUE:-}" ]; then
    printf 'set'
  else
    printf 'missing'
  fi
}

cc_model_json_status() {
  local env_name="$1"
  local label="$2"
  local value="${!env_name:-}"

  [ -n "$value" ] || return 0
  if command -v python3 >/dev/null 2>&1 && ENV_NAME="$env_name" python3 - <<'PY' 2>/dev/null
import json
import os

json.loads(os.environ[os.environ["ENV_NAME"]])
PY
  then
    echo "  $label: ok"
  else
    echo "  $label: invalid JSON ($env_name)"
    return 1
  fi
}

cc_model_doctor() {
  local ok=0
  local cli="${CC_MODEL_CLI:-${CLAUDE_CLI:-}}"
  local patch_marker="${CC_MODEL_PATCH_MARKER:-}"
  local prompt_file="${CC_MODEL_PROMPT_FILE:-}"

  echo "${CC_MODEL_COMMAND:-cc-model} doctor"
  echo "  provider: ${CC_MODEL_PROVIDER:-unknown}"
  echo "  home:     ${HOME:-unknown}"
  echo "  endpoint: ${ANTHROPIC_BASE_URL:-unknown}"
  echo "  model:    ${CC_MODEL_SELECTED:-${MODEL:-unknown}}"
  [ -n "${ANTHROPIC_DEFAULT_OPUS_MODEL:-}" ] && echo "  opus:     $ANTHROPIC_DEFAULT_OPUS_MODEL"
  [ -n "${ANTHROPIC_DEFAULT_SONNET_MODEL:-}" ] && echo "  sonnet:   $ANTHROPIC_DEFAULT_SONNET_MODEL"
  [ -n "${ANTHROPIC_DEFAULT_HAIKU_MODEL:-}" ] && echo "  haiku:    $ANTHROPIC_DEFAULT_HAIKU_MODEL"
  [ -n "${ANTHROPIC_SMALL_FAST_MODEL:-}" ] && echo "  fast:     $ANTHROPIC_SMALL_FAST_MODEL"
  [ -n "${CLAUDE_CODE_SUBAGENT_MODEL:-}" ] && echo "  subagent: $CLAUDE_CODE_SUBAGENT_MODEL"
  [ -n "${CLAUDE_CODE_MAX_OUTPUT_TOKENS:-}" ] && echo "  max_out:  $CLAUDE_CODE_MAX_OUTPUT_TOKENS"
  if [ -n "${CLAUDE_CODE_DISABLE_THINKING:-}" ] || [ -n "${MAX_THINKING_TOKENS:-}" ]; then
    local thinking_state="enabled"
    if [ "${CLAUDE_CODE_DISABLE_THINKING:-0}" = "1" ] || [ "${MAX_THINKING_TOKENS:-}" = "0" ]; then
      thinking_state="disabled"
    fi
    echo "  thinking: $thinking_state / max=${MAX_THINKING_TOKENS:-default}"
  fi
  echo "  auth:     ${CC_MODEL_AUTH_LABEL:-api key} = $(cc_model_secret_status)"

	  if command -v python3 >/dev/null 2>&1; then
	    local am_count
	    am_count=$(python3 -c 'import json,sys
try:
    am=json.load(open(sys.argv[1])).get("availableModels")
    print(len(am) if isinstance(am,list) else -1)
except Exception:
    print(0)' "$HOME/.claude/settings.json" 2>/dev/null)
	    if [ "${am_count:-0}" -gt 0 ]; then
	      echo "  models:   $am_count selectable via '/model <name>' or -m (picker shows default+tiers only)"
	    else
	      echo "  models:   availableModels not synced — run cc-${CC_MODEL_PROVIDER:-model} once"
	    fi
	  fi
  cc_model_json_status CLAUDE_CODE_EXTRA_BODY extra_body || ok=1
  cc_model_json_status CLAUDE_CODE_EXTRA_METADATA metadata || ok=1

	  if [ -n "$cli" ] && [ -f "$cli" ]; then
    echo "  cli:      ok ($cli)"
    if [ -n "$patch_marker" ]; then
      if grep -Iq . "$cli" 2>/dev/null; then
        if grep -q "$patch_marker" "$cli" 2>/dev/null; then
          echo "  patch:    ok ($patch_marker)"
        else
          echo "  patch:    missing marker ($patch_marker)"
          ok=1
        fi
      else
        echo "  patch:    skipped (native binary)"
      fi
    fi
  else
    echo "  cli:      missing (${cli:-unset})"
    ok=1
  fi

  if [ -n "$prompt_file" ]; then
    if [ -f "$prompt_file" ]; then
      echo "  prompt:   ok ($prompt_file)"
    else
      echo "  prompt:   absent ($prompt_file)"
    fi
  fi

  return "$ok"
}

cc_model_print_env() {
  env | LC_ALL=C sort | grep -E '^(ANTHROPIC_|CLAUDE_CODE_|MAX_|API_TIMEOUT_MS|BASH_).*' | \
    sed -E 's/(ANTHROPIC_API_KEY|ANTHROPIC_AUTH_TOKEN)=.*/\1=<redacted>/'
}

# Sync availableModels in the env's settings.json from ${MODELS[@]} so the
# native-binary /model picker shows the full list. Native claude.exe ignores
# the old cli.js patch env var ANTHROPIC_CUSTOM_MODEL_OPTIONS_JSON; the native
# mechanism is the settings.json "availableModels" allowlist (which IS what the
# /model picker renders). See claude docs: model-config availableModels.
cc_model_sync_available_models() {
  command -v python3 >/dev/null 2>&1 || return 0
  [ "${#MODELS[@]}" -gt 0 ] || return 0
  CC_AM_MODELS="$(printf '%s\n' "${MODELS[@]}")" CC_AM_FILE="$HOME/.claude/settings.json" \
    python3 - <<'PY' 2>/dev/null || true
import json, os
sf = os.environ["CC_AM_FILE"]
models = [m for m in os.environ.get("CC_AM_MODELS", "").splitlines() if m]
try:
    with open(sf) as f:
        d = json.load(f)
    if not isinstance(d, dict):
        d = {}
except Exception:
    d = {}
if d.get("availableModels") == models:
    raise SystemExit(0)          # already in sync, don't rewrite
d["availableModels"] = models
os.makedirs(os.path.dirname(sf), exist_ok=True)
with open(sf, "w") as f:
    json.dump(d, f, indent=2)
PY
}

cc_model_handle_common_command() {
  case "${1:-}" in
    -h|--help)
      cc_model_usage
      exit 0
      ;;
    --doctor|doctor)
      cc_model_doctor
      exit $?
      ;;
    --env)
      cc_model_print_env
      exit 0
      ;;
  esac
  cc_model_sync_available_models
}

# ============================================================================
# cc_model_launch — shared launcher tail. The provider head must first set:
#   MODEL                selected model
#   MODELS[]             full model list (picker / availableModels)
#   CC_OPUS/CC_SONNET/CC_HAIKU/CC_FAST/CC_SUBAGENT   tier mappings (optional)
#   CC_MODEL_DISPLAY     brand label (e.g. "GLM Coding")
#   CC_MODEL_COMMAND CC_MODEL_PROVIDER CC_MODEL_PATCH_MARKER CC_MODEL_PROMPT_FILE
#   CC_MODEL_AUTH_LABEL CC_MODEL_AUTH_VALUE   for doctor
#   ANTHROPIC_BASE_URL + auth (API_KEY or AUTH_TOKEN) + any provider quirks
# Optional: CC_MODEL_POST_HOOK (command run after the session, no-exec mode).
# Call as the last line:  cc_model_launch "$@"
# ============================================================================
cc_model_launch() {
  export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS="${CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS:-1}"
  export ANTHROPIC_MODEL="$MODEL"
  export ANTHROPIC_CUSTOM_MODEL_OPTION="$MODEL"
  export ANTHROPIC_CUSTOM_MODEL_OPTION_NAME="$MODEL"
  export ANTHROPIC_CUSTOM_MODEL_OPTION_DESCRIPTION="${CC_MODEL_DISPLAY:-$CC_MODEL_PROVIDER} · $MODEL"
  ANTHROPIC_CUSTOM_MODEL_OPTIONS_JSON="$(cc_model_json_options "${CC_MODEL_DISPLAY:-$CC_MODEL_PROVIDER}")"
  export ANTHROPIC_CUSTOM_MODEL_OPTIONS_JSON
  export ANTHROPIC_DEFAULT_OPUS_MODEL="${CC_OPUS:-$MODEL}"
  export ANTHROPIC_DEFAULT_SONNET_MODEL="${CC_SONNET:-$MODEL}"
  export ANTHROPIC_DEFAULT_HAIKU_MODEL="${CC_HAIKU:-$MODEL}"
  export ANTHROPIC_SMALL_FAST_MODEL="${CC_FAST:-${CC_HAIKU:-$MODEL}}"
  export CLAUDE_CODE_SUBAGENT_MODEL="${CC_SUBAGENT:-${CC_SONNET:-$MODEL}}"

  # common hardening defaults (head may pre-export to override any of these)
  export ENABLE_TOOL_SEARCH="${ENABLE_TOOL_SEARCH:-false}"
  export CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC="${CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:-1}"
  export DISABLE_TELEMETRY="${DISABLE_TELEMETRY:-1}"
  export DISABLE_ERROR_REPORTING="${DISABLE_ERROR_REPORTING:-1}"
  export DISABLE_BUG_COMMAND="${DISABLE_BUG_COMMAND:-1}"
  export DISABLE_AUTOUPDATER="${DISABLE_AUTOUPDATER:-1}"
  export MAX_MCP_OUTPUT_TOKENS="${MAX_MCP_OUTPUT_TOKENS:-25000}"
  export API_TIMEOUT_MS="${API_TIMEOUT_MS:-3000000}"
  export BASH_DEFAULT_TIMEOUT_MS="${BASH_DEFAULT_TIMEOUT_MS:-600000}"
  export BASH_MAX_TIMEOUT_MS="${BASH_MAX_TIMEOUT_MS:-1200000}"

  # resolve Claude Code executable: native binary preferred, patchable cli.js fallback
  local cli="$HOME/opt/node_modules/@anthropic-ai/claude-code/bin/claude.exe"
  [ -f "$cli" ] || cli="$HOME/opt/node_modules/@anthropic-ai/claude-code/cli.js"
  export CC_MODEL_SELECTED="$MODEL"
  export CC_MODEL_CLI="$cli"

  cc_model_handle_common_command "${1:-}"

  local tag="${CC_MODEL_COMMAND:-cc-model}"
  if [ ! -f "$cli" ]; then
    echo "[$tag] ❌ Claude Code executable does not exist: $cli" >&2
    echo "      first: cd $HOME/opt && npm install @anthropic-ai/claude-code" >&2
    exit 1
  fi
  # old cli.js needs a brand patch; native binary skips it
  if [ "${cli##*/}" != "claude.exe" ] && [ -n "${CC_MODEL_PATCH_MARKER:-}" ] \
     && ! grep -q "$CC_MODEL_PATCH_MARKER" "$cli" 2>/dev/null; then
    "$HOME/bin/apply-${CC_MODEL_PROVIDER}-patch.sh" >&2 || { echo "[$tag] patch failed" >&2; exit 1; }
  fi

  cc_model_reset_plugins
  echo "[$tag] model=$MODEL  (opus→$ANTHROPIC_DEFAULT_OPUS_MODEL sonnet→$ANTHROPIC_DEFAULT_SONNET_MODEL haiku→$ANTHROPIC_DEFAULT_HAIKU_MODEL)  endpoint=$ANTHROPIC_BASE_URL" >&2
  [ -z "${CC_MODEL_AUTH_VALUE:-}" ] && echo "[$tag] ⚠️  ${CC_MODEL_AUTH_LABEL:-API key} not set" >&2

  local extra=()
  [ -f "${CC_MODEL_PROMPT_FILE:-}" ] && extra=(--append-system-prompt "$(cat "$CC_MODEL_PROMPT_FILE")")

  if [ -n "${CC_MODEL_POST_HOOK:-}" ]; then
    "$cli" "${extra[@]}" "$@"; local rc=$?
    eval "$CC_MODEL_POST_HOOK" >/dev/null 2>&1 || true
    exit "$rc"
  fi
  exec "$cli" "${extra[@]}" "$@"
}
