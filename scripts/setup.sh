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

# --- Check if jq is available ---
check_jq() {
  if ! command -v jq &>/dev/null; then
    log_error "jq is required but not installed."
    echo "  Install: brew install jq (macOS) or apt-get install jq (Linux)"
    exit 1
  fi
}

# --- Check if hook already exists ---
hook_exists() {
  local file="$1" event="$2"
  local existing
  existing=$(jq -r ".scripts[\"$event\"] // empty" "$file" 2>/dev/null)

  if [[ -z "$existing" ]]; then
    return 1  # No hook
  fi

  # Check if it's a string containing our command
  if [[ "$existing" == *"agent-config/scripts/install.sh"* ]]; then
    return 0  # Our hook exists
  fi

  # Check if it's an array containing our command
  if jq -e ".scripts[\"$event\"][] | select(contains(\"agent-config/scripts/install.sh\"))" "$file" &>/dev/null; then
    return 0  # Our hook exists in array
  fi

  return 1  # Hook exists but not ours
}

# --- Add hook to composer.json ---
add_hook() {
  local file="$1" event="$2"
  local existing

  existing=$(jq -r ".scripts[\"$event\"] // empty" "$file" 2>/dev/null)

  if [[ -z "$existing" ]]; then
    # No existing hook — add as string
    jq --arg event "$event" --arg cmd "$HOOK_CMD" \
      '.scripts[$event] = $cmd' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  elif jq -e ".scripts[\"$event\"] | type == \"string\"" "$file" &>/dev/null; then
    # Existing string hook — convert to array, append ours
    jq --arg event "$event" --arg cmd "$HOOK_CMD" \
      '.scripts[$event] = [.scripts[$event], $cmd]' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  elif jq -e ".scripts[\"$event\"] | type == \"array\"" "$file" &>/dev/null; then
    # Existing array hook — append ours
    jq --arg event "$event" --arg cmd "$HOOK_CMD" \
      '.scripts[$event] += [$cmd]' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  fi
}

# --- Ensure scripts key exists ---
ensure_scripts_key() {
  local file="$1"
  if ! jq -e '.scripts' "$file" &>/dev/null; then
    jq '. + {"scripts": {}}' "$file" > "$file.tmp" && mv "$file.tmp" "$file"
  fi
}

# --- Main ---
main() {
  check_jq

  local root
  root=$(find_project_root)
  local file="$root/$COMPOSER_JSON"

  echo ""
  echo "  🔧 agent-config setup"
  echo "  Project: $root"
  echo ""

  ensure_scripts_key "$file"

  local changed=false

  for event in "post-install-cmd" "post-update-cmd"; do
    if hook_exists "$file" "$event"; then
      log_skip "$event hook already configured"
    else
      add_hook "$file" "$event"
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
