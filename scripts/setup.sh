#!/usr/bin/env bash
# setup.sh — One-time setup for agent-config in a project
# Adds post-install/update hooks to the root composer.json so that
# install.sh runs automatically on every `composer install` / `composer update`.
#
# Usage:
#   bash vendor/event4u/agent-config/scripts/setup.sh
#
# Idempotent: safe to run multiple times. Skips if hooks already exist.

set -euo pipefail

# --- Configuration ---
HOOK_CMD="bash vendor/event4u/agent-config/scripts/install.sh --quiet"
COMPOSER_JSON="composer.json"

# --- Logging ---
log_info()  { echo "  ✅  $*"; }
log_warn()  { echo "  ⚠️  $*"; }
log_skip()  { echo "  ⏭️  $*"; }
log_error() { echo "  ❌  $*" >&2; }

# --- Find project root ---
find_project_root() {
  local dir
  dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

  # If called from vendor/event4u/agent-config/scripts/, go up 4 levels
  if [[ -f "$dir/$COMPOSER_JSON" ]]; then
    echo "$dir"
    return
  fi

  # Fallback: current working directory
  if [[ -f "$PWD/$COMPOSER_JSON" ]]; then
    echo "$PWD"
    return
  fi

  log_error "Cannot find project root (no composer.json found)"
  exit 1
}

# --- Detect JSON tool ---
# Fallback chain: php → node → jq → python3
JSON_TOOL=""
detect_json_tool() {
  if command -v php &>/dev/null; then
    JSON_TOOL="php"
  elif command -v node &>/dev/null; then
    JSON_TOOL="node"
  elif command -v jq &>/dev/null; then
    JSON_TOOL="jq"
  elif command -v python3 &>/dev/null; then
    JSON_TOOL="python3"
  else
    log_error "No JSON tool found. Need one of: php, node, jq, python3"
    exit 1
  fi
}

# --- Unified JSON helper ---
# Dispatches to the detected tool. Actions: hook_exists, add_hook
composer_json_cmd() {
  local file="$1" action="$2" event="${3:-}" cmd="${4:-}"
  case "$JSON_TOOL" in
    php)     _cmd_php "$file" "$action" "$event" "$cmd" ;;
    node)    _cmd_node "$file" "$action" "$event" "$cmd" ;;
    jq)      _cmd_jq "$file" "$action" "$event" "$cmd" ;;
    python3) _cmd_python "$file" "$action" "$event" "$cmd" ;;
  esac
}

# --- PHP implementation ---
_cmd_php() {
  local file="$1" action="$2" event="$3" cmd="$4"
  php -r "
    \$file = '$file';
    \$json = json_decode(file_get_contents(\$file), true);
    if (\$json === null) { exit(1); }
    \$event = '$event'; \$cmd = '$cmd';
    if ('$action' === 'hook_exists') {
      if (!isset(\$json['scripts'][\$event])) { exit(1); }
      \$val = \$json['scripts'][\$event];
      if (is_string(\$val) && str_contains(\$val, 'agent-config/scripts/install.sh')) { exit(0); }
      if (is_array(\$val)) {
        foreach (\$val as \$v) {
          if (is_string(\$v) && str_contains(\$v, 'agent-config/scripts/install.sh')) { exit(0); }
        }
      }
      exit(1);
    }
    if ('$action' === 'add_hook') {
      if (!isset(\$json['scripts'])) { \$json['scripts'] = []; }
      if (!isset(\$json['scripts'][\$event])) {
        \$json['scripts'][\$event] = \$cmd;
      } elseif (is_string(\$json['scripts'][\$event])) {
        \$json['scripts'][\$event] = [\$json['scripts'][\$event], \$cmd];
      } elseif (is_array(\$json['scripts'][\$event])) {
        \$json['scripts'][\$event][] = \$cmd;
      }
      file_put_contents(\$file, json_encode(\$json, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) . \"\n\");
    }
  "
}

# --- Node.js implementation ---
_cmd_node() {
  local file="$1" action="$2" event="$3" cmd="$4"
  node -e "
    const fs = require('fs');
    const file = '$file';
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    const event = '$event', cmd = '$cmd';
    if ('$action' === 'hook_exists') {
      if (!json.scripts || !json.scripts[event]) process.exit(1);
      const val = json.scripts[event];
      if (typeof val === 'string' && val.includes('agent-config/scripts/install.sh')) process.exit(0);
      if (Array.isArray(val) && val.some(v => v.includes('agent-config/scripts/install.sh'))) process.exit(0);
      process.exit(1);
    }
    if ('$action' === 'add_hook') {
      if (!json.scripts) json.scripts = {};
      if (!json.scripts[event]) {
        json.scripts[event] = cmd;
      } else if (typeof json.scripts[event] === 'string') {
        json.scripts[event] = [json.scripts[event], cmd];
      } else if (Array.isArray(json.scripts[event])) {
        json.scripts[event].push(cmd);
      }
      fs.writeFileSync(file, JSON.stringify(json, null, 4) + '\n');
    }
  "
}

# --- jq implementation ---
_cmd_jq() {
  local file="$1" action="$2" event="$3" cmd="$4"
  if [[ "$action" == "hook_exists" ]]; then
    local existing
    existing=$(jq -r ".scripts[\"$event\"] // empty" "$file" 2>/dev/null)
    [[ -z "$existing" ]] && return 1
    [[ "$existing" == *"agent-config/scripts/install.sh"* ]] && return 0
    jq -e ".scripts[\"$event\"][] | select(contains(\"agent-config/scripts/install.sh\"))" "$file" &>/dev/null && return 0
    return 1
  fi
  if [[ "$action" == "add_hook" ]]; then
    local existing
    existing=$(jq -r ".scripts[\"$event\"] // empty" "$file" 2>/dev/null)
    if [[ -z "$existing" ]]; then
      jq --arg e "$event" --arg c "$cmd" '.scripts[$e] = $c' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    elif jq -e ".scripts[\"$event\"] | type == \"string\"" "$file" &>/dev/null; then
      jq --arg e "$event" --arg c "$cmd" '.scripts[$e] = [.scripts[$e], $c]' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    elif jq -e ".scripts[\"$event\"] | type == \"array\"" "$file" &>/dev/null; then
      jq --arg e "$event" --arg c "$cmd" '.scripts[$e] += [$c]' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    fi
  fi
}

# --- Python implementation ---
_cmd_python() {
  local file="$1" action="$2" event="$3" cmd="$4"
  python3 -c "
import json, sys
with open('$file') as f: data = json.load(f)
event, cmd = '$event', '$cmd'
if '$action' == 'hook_exists':
    scripts = data.get('scripts', {})
    val = scripts.get(event)
    if val is None: sys.exit(1)
    if isinstance(val, str) and 'agent-config/scripts/install.sh' in val: sys.exit(0)
    if isinstance(val, list) and any('agent-config/scripts/install.sh' in v for v in val): sys.exit(0)
    sys.exit(1)
if '$action' == 'add_hook':
    if 'scripts' not in data: data['scripts'] = {}
    if event not in data['scripts']:
        data['scripts'][event] = cmd
    elif isinstance(data['scripts'][event], str):
        data['scripts'][event] = [data['scripts'][event], cmd]
    elif isinstance(data['scripts'][event], list):
        data['scripts'][event].append(cmd)
    with open('$file', 'w') as f: json.dump(data, f, indent=4, ensure_ascii=False); f.write('\n')
  "
}

# --- Main ---
main() {
  detect_json_tool

  local root
  root=$(find_project_root)
  local file="$root/$COMPOSER_JSON"

  echo ""
  echo "  🔧 agent-config setup"
  echo "  Project: $root"
  echo "  JSON tool: $JSON_TOOL"
  echo ""

  local changed=false

  for event in "post-install-cmd" "post-update-cmd"; do
    if composer_json_cmd "$file" "hook_exists" "$event"; then
      log_skip "$event hook already configured"
    else
      composer_json_cmd "$file" "add_hook" "$event" "$HOOK_CMD"
      log_info "Added $event hook"
      changed=true
    fi
  done

  echo ""

  if [[ "$changed" == "true" ]]; then
    local install_script="$root/vendor/event4u/agent-config/scripts/install.sh"
    if [[ -f "$install_script" ]]; then
      log_info "Running install.sh now..."
      bash "$install_script"
    else
      log_warn "install.sh not found in vendor yet — will run on next composer install/update."
    fi
    echo ""
    log_info "Setup complete! Hooks will run automatically on composer install/update."
    log_warn "Commit the updated composer.json to your repository."
  else
    log_skip "Nothing to do — already configured."
  fi
}

main "$@"
