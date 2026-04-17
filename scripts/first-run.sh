#!/usr/bin/env bash
set -euo pipefail

SETTINGS_FILE=".agent-settings"

echo ""
echo "========================================"
echo "  Agent Config — First Run"
echo "========================================"
echo ""

# --- Profile detection ---
if [ -f "$SETTINGS_FILE" ]; then
  echo "✅  Found $SETTINGS_FILE"
  echo ""
  CURRENT_PROFILE=$(grep -E '^cost_profile=' "$SETTINGS_FILE" 2>/dev/null | head -n1 | cut -d'=' -f2 || true)

  if [ -n "${CURRENT_PROFILE:-}" ]; then
    echo "Active cost_profile: $CURRENT_PROFILE"
  else
    echo "No cost_profile configured yet."
    echo ""
    echo "Recommended: add this to $SETTINGS_FILE:"
    echo ""
    echo "  cost_profile=minimal"
  fi
else
  echo "❌  No $SETTINGS_FILE found."
  echo ""
  echo "Create one with:"
  echo ""
  echo "  cost_profile=minimal"
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
echo "Stay on minimal?  → Lightest setup, governance only"
echo "Ready for more?   → Set cost_profile=balanced in $SETTINGS_FILE"
echo "Want everything?  → Set cost_profile=full"
echo ""
echo "Full docs: docs/getting-started.md"
echo ""
