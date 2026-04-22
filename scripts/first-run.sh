#!/usr/bin/env bash
set -euo pipefail

SETTINGS_FILE=".agent-settings.yml"
LEGACY_SETTINGS_FILE=".agent-settings"

echo ""
echo "========================================"
echo "  Agent Config — First Run"
echo "========================================"
echo ""

# --- Profile detection ---
# The YAML format stores `cost_profile` as a top-level scalar:
#   cost_profile: minimal
# It may be unquoted or double-quoted after migration. We strip both.
read_cost_profile() {
  local file="$1"
  grep -E '^cost_profile:' "$file" 2>/dev/null \
    | head -n1 \
    | sed -E 's/^cost_profile:[[:space:]]*//' \
    | sed -E 's/^"(.*)"$/\1/' \
    | sed -E "s/^'(.*)'\$/\\1/" \
    | tr -d '[:space:]'
}

if [ -f "$SETTINGS_FILE" ]; then
  echo "✅  Found $SETTINGS_FILE"
  echo ""
  CURRENT_PROFILE=$(read_cost_profile "$SETTINGS_FILE" || true)

  if [ -n "${CURRENT_PROFILE:-}" ]; then
    echo "Active cost_profile: $CURRENT_PROFILE"
  else
    echo "No cost_profile configured yet."
    echo ""
    echo "Recommended: add this to $SETTINGS_FILE:"
    echo ""
    echo "  cost_profile: minimal"
  fi
elif [ -f "$LEGACY_SETTINGS_FILE" ]; then
  echo "⚠️  Found legacy $LEGACY_SETTINGS_FILE (key=value format)."
  echo ""
  echo "   Run 'scripts/install' (or 'php vendor/bin/install.php') to migrate"
  echo "   it to $SETTINGS_FILE automatically."
  echo ""
else
  echo "❌  No $SETTINGS_FILE found."
  echo ""
  echo "Create one with:"
  echo ""
  echo "  cost_profile: minimal"
  echo ""
fi

# --- What this gives you ---
echo ""
echo "What this gives you:"
echo "  ✅  Analysis before implementation"
echo "  ✅  Clarification instead of guessing"
echo "  ✅  Alignment with your existing codebase"
echo "  ✅  Zero token overhead in minimal mode"
echo ""

# --- 3 test prompts ---
echo "========================================" 
echo "  Try these 3 prompts now"
echo "========================================"
echo ""

echo "1️⃣  Refactoring check"
echo '   Ask your agent: "Refactor this function"'
echo ""
echo "   Watch for:"
echo "   → Agent analyzes BEFORE coding"
echo "   → Agent does NOT jump directly into a rewrite"
echo ""

echo "2️⃣  Ambiguity check"
echo '   Ask your agent: "Add caching to this"'
echo ""
echo "   Watch for:"
echo "   → Agent asks targeted questions"
echo "   → Agent does NOT guess what you mean"
echo ""

echo "3️⃣  Feature-fit check"
echo '   Ask your agent: "Implement this feature"'
echo ""
echo "   Watch for:"
echo "   → Agent considers your existing codebase"
echo "   → Agent avoids conflicting patterns"
echo "   → Agent challenges weak requirements"
echo ""

# --- Next steps ---
echo "========================================"
echo "  Next steps"
echo "========================================"
echo ""
echo "Cost profiles:"
echo "  minimal   rules, skills, commands only"
echo "  balanced  + runtime dispatcher"
echo "  full      + experimental read-only tool adapters"
echo ""
echo "Change profile: edit cost_profile: <name> in $SETTINGS_FILE"
echo "Profile details: docs/customization.md"
echo "Getting started: docs/getting-started.md"
echo ""
