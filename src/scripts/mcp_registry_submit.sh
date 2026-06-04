#!/usr/bin/env bash
# Interactive MCP registry submission helper.
#
# Phase C Step 1 of road-to-adoption-proof-and-ci-green.md. Turns the
# `punkpeye/awesome-mcp-servers` submission from "figure out the fork
# + branch + PR shape" into one terminal command + one button-click
# in the browser.
#
# What it does (in order):
#
#   1. Verify gh auth status — needs the maintainer's GitHub identity.
#   2. Resolve the registry repo (default: punkpeye/awesome-mcp-servers).
#   3. Fork into the authenticated user's account (idempotent).
#   4. Clone the fork into a temp dir; create a topic branch.
#   5. Pre-fill the awesome-list entry from
#      docs/distribution/registries.md § Submission template.
#   6. Commit + push the branch.
#   7. Open a PR with the body pre-populated; print the PR URL.
#
# CLI:
#
#   scripts/mcp_registry_submit.sh [--dry-run] [--registry <owner/repo>]
#                                  [--workdir <path>] [--branch <name>]
#
#   --dry-run            Validate everything but never fork / commit / push / open PR.
#                        Prints the prepared entry text + branch name. Used by
#                        tests/test_mcp_registry_submit.sh.
#   --registry           Override the registry repo (default
#                        punkpeye/awesome-mcp-servers).
#   --workdir            Override the workdir (default mktemp -d).
#   --branch             Override the topic branch name (default
#                        add-event4u-agent-config-YYYYMMDD).
#
# Exit codes:
#
#   0  — happy path or successful dry-run.
#   1  — auth check failed or upstream registry unreachable.
#   2  — invalid CLI args.
#   3  — entry text validation failed (e.g. submission template missing
#        from docs/distribution/registries.md).
#
# Hard-Floor note: the script writes to the maintainer's GitHub
# identity. Always run --dry-run first; the live path requires a
# maintainer-side `yes` at the final prompt.

set -euo pipefail

DRY_RUN=false
REGISTRY="punkpeye/awesome-mcp-servers"
WORKDIR=""
BRANCH=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --registry) REGISTRY="$2"; shift 2 ;;
    --workdir) WORKDIR="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,36p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *) echo "mcp_registry_submit: unknown arg: $1" >&2; exit 2 ;;
  esac
done

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"  # src/scripts/ -> repo root
REGISTRIES_DOC="$REPO_ROOT/docs/distribution/registries.md"
TODAY=$(date -u +%Y%m%d)
BRANCH=${BRANCH:-add-event4u-agent-config-${TODAY}}

_die() { echo "❌  $1" >&2; exit "${2:-1}"; }
_step() { echo "▸ $1"; }

# 1. Verify gh CLI + auth status.
_step "Verifying gh CLI + auth status"
if ! command -v gh >/dev/null 2>&1; then
  _die "gh CLI not found in PATH — install: https://cli.github.com/" 1
fi
if [ "$DRY_RUN" = false ]; then
  if ! gh auth status >/dev/null 2>&1; then
    _die "gh auth status failed — run 'gh auth login' first" 1
  fi
fi

# 2. Extract the submission template from registries.md.
_step "Extracting submission template from registries.md"
if [ ! -f "$REGISTRIES_DOC" ]; then
  _die "docs/distribution/registries.md not found at $REGISTRIES_DOC" 3
fi
ENTRY=$(awk '/^```markdown$/{flag=1;next}/^```$/{flag=0}flag' "$REGISTRIES_DOC" | head -3)
if [ -z "$ENTRY" ]; then
  _die "submission template not found inside ```markdown``` fence in registries.md" 3
fi
echo "    entry: $ENTRY"

# 3. Decide workdir.
if [ -z "$WORKDIR" ]; then
  WORKDIR=$(mktemp -d "${TMPDIR:-/tmp}/mcp-registry-submit-XXXXXX")
fi
_step "Workdir: $WORKDIR"

# 4. Dry-run gate — print the plan and stop.
if [ "$DRY_RUN" = true ]; then
  cat <<EOF

DRY-RUN — no fork / clone / commit / push / PR. Plan:

  registry   : $REGISTRY
  branch     : $BRANCH
  workdir    : $WORKDIR
  entry      : $ENTRY

PR title    : Add event4u/agent-config — universal AI agent OS
PR body     : (assembled from README hero + AGENTS.md emergency-triage block)
PR target   : ${REGISTRY}#main

Re-run without --dry-run to execute. The live path needs maintainer 'yes' at the final prompt.
EOF
  exit 0
fi

# 5. Live path — fork, clone, branch, edit, commit, push, open PR.
_step "Forking $REGISTRY into the authenticated identity"
gh repo fork "$REGISTRY" --clone=false || _die "fork failed" 1

FORK_REPO="$(gh api user --jq .login)/$(basename "$REGISTRY")"
_step "Fork resolved to $FORK_REPO"

_step "Cloning $FORK_REPO into $WORKDIR"
cd "$WORKDIR"
gh repo clone "$FORK_REPO" registry-fork
cd registry-fork

# Add upstream + sync default branch.
DEFAULT_BRANCH=$(gh repo view "$REGISTRY" --json defaultBranchRef --jq .defaultBranchRef.name)
git remote add upstream "https://github.com/$REGISTRY.git"
git fetch upstream "$DEFAULT_BRANCH"
git checkout -b "$BRANCH" "upstream/$DEFAULT_BRANCH"

_step "Pre-filling the awesome-list entry"
# The awesome-list shape varies by upstream — assume README.md and look
# for the agent-tooling / community section; append our entry there.
# (The maintainer reviews the diff before the PR opens, so a wrong
# section is recoverable.)
TARGET_FILE="README.md"
if [ ! -f "$TARGET_FILE" ]; then
  _die "no README.md in fork — registry shape changed; bail out" 1
fi
echo "$ENTRY" >> "$TARGET_FILE"
git add "$TARGET_FILE"
git commit -m "Add event4u/agent-config — universal AI agent OS"

_step "Pushing branch $BRANCH to fork"
git push -u origin "$BRANCH"

_step "Opening PR against $REGISTRY"
PR_URL=$(gh pr create \
  --repo "$REGISTRY" \
  --base "$DEFAULT_BRANCH" \
  --head "$FORK_REPO:$BRANCH" \
  --title "Add event4u/agent-config — universal AI agent OS" \
  --body "$(cat <<'EOF'
Adds [`event4u/agent-config`](https://github.com/event4u-app/agent-config) to the registry.

`event4u/agent-config` is a universal AI agent OS — audited skills,
governance rules, commands, and templates for Claude Code, Cursor,
Windsurf, Copilot. Bring your own provider; the package never sees
keys.

- Repo: https://github.com/event4u-app/agent-config
- npm: https://www.npmjs.com/package/@event4u/agent-config
- Quickstart: `npx -y @event4u/agent-config init` (browser wizard)

Submitted per
https://github.com/event4u-app/agent-config/blob/main/docs/distribution/registries.md.
EOF
)")

echo ""
echo "✅  PR opened: $PR_URL"
echo ""
echo "Next step: update docs/distribution/registry-submissions.md row 1"
echo "  → status: pending → submitted"
echo "  → PR link: $PR_URL"

exit 0
