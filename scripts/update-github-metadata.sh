#!/usr/bin/env bash
# scripts/update-github-metadata.sh
#
# Step-12 Phase 6 L113 — apply the Universal-OS reframe to GitHub repo
# metadata (description + topics). Drafted per AI-Council verdict
# 2026-05-15-step12-final-push (Decision 3 AMEND: reviewable script,
# explicit maintainer approval to execute).
#
# Iron Law (.augment/rules/non-destructive-by-default.md):
#   GitHub repo description/topics are PUBLIC project metadata.
#   This script does NOT auto-run. Maintainer must invoke it explicitly.
#
# Usage:
#   ./scripts/update-github-metadata.sh            # dry-run (prints curl payload)
#   ./scripts/update-github-metadata.sh --apply    # actually call the API
#
# Rollback:
#   gh api repos/event4u-app/agent-config --method PATCH \
#     -f description="agent-config — Behavior, Memory and Delivery Governance for AI Agents"
#   (Topics: re-PUT the original list from `gh api repos/event4u-app/agent-config | jq .topics`.)
set -euo pipefail

OWNER_REPO="event4u-app/agent-config"

NEW_DESCRIPTION="Universal AI Agent OS — governed skills, rules, commands for developers, founders, creators, GTM, finance/ops"

# Existing topics preserved; reframe topics appended.
TOPICS=(
  "agent-rules"
  "agent-skills"
  "agentic-ai"
  "agentskills-standard"
  "ai-coding"
  "augment-agent"
  "claude-code"
  "copilot"
  "devcontainer"
  "governance"
  "laravel"
  "php"
  "react"
  "symfony"
  "universal-ai-os"
  "ai-governance"
  "non-developer-tools"
)

APPLY="${1:-}"

if [[ "${APPLY}" != "--apply" ]]; then
  echo "=== DRY RUN — no API call ==="
  echo "Target repo:     ${OWNER_REPO}"
  echo "New description: ${NEW_DESCRIPTION}"
  echo "New topics:"
  printf '  - %s\n' "${TOPICS[@]}"
  echo
  echo "To apply, re-run with --apply (requires gh authenticated as repo admin)."
  exit 0
fi

# Apply path — requires gh CLI authenticated.
if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI not found. Install from https://cli.github.com." >&2
  exit 1
fi

echo "Applying description …"
gh api "repos/${OWNER_REPO}" \
  --method PATCH \
  -f "description=${NEW_DESCRIPTION}" \
  --silent

echo "Applying topics …"
TOPIC_ARGS=()
for t in "${TOPICS[@]}"; do
  TOPIC_ARGS+=(-f "names[]=${t}")
done
gh api "repos/${OWNER_REPO}/topics" \
  --method PUT \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  "${TOPIC_ARGS[@]}" \
  --silent

echo "Done. Verify at https://github.com/${OWNER_REPO}"
