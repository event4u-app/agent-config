#!/usr/bin/env bash
# Install git hooks for this repository.
# Run once: bash src/scripts/install-hooks.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# This installer lives at src/scripts/install-hooks.sh, so the repo root
# (which owns .git/) is two levels up.
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# Resolve the SHARED hooks dir via git so this also works from a linked worktree
# (where $PROJECT_ROOT/.git is a file, not a dir, and a literal .git/hooks path
# would break under `set -e`). --git-common-dir points at the main .git even from
# a worktree; fall back to the literal path only outside a git repo.
if COMMON_GIT_DIR="$(git -C "$PROJECT_ROOT" rev-parse --git-common-dir 2>/dev/null)"; then
    case "$COMMON_GIT_DIR" in /*) : ;; *) COMMON_GIT_DIR="$PROJECT_ROOT/$COMMON_GIT_DIR" ;; esac
    HOOKS_DIR="$COMMON_GIT_DIR/hooks"
else
    HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
fi

mkdir -p "$HOOKS_DIR"

cat > "$HOOKS_DIR/pre-push" << 'EOF'
#!/usr/bin/env bash
# Pre-push hook: mirror the CI "Sync + Generate Tools Consistency" gate LOCALLY
# so derived-output drift is caught BEFORE push, not in remote CI.
#
# History: the remote "Consistency" check failed in a large share of PRs because
# the old hook only verified dist sync + the COMMAND count — it missed
# guideline/skill/rule count drift and the generate-tools / router / corpus
# outputs (e.g. a new guideline bumping the count in README + docs/architecture).
# `task consistency` is the EXACT CI mirror (sync-check + sync + generate-tools
# + compile-router + compile-corpus + `git diff --quiet`),
# so any derived-output drift blocks the push here. Runtime ~10s: three
# consecutive timed runs on 2026-08-30 measured 9.79s / 10.19s / 10.26s
# (road-to-agent-turnaround 3.2). The header said "~15-40s" until then, which
# over-stated this half of the hook by 1.5-4x while the hook AS A WHOLE was far
# more expensive than either number — see the preflight block below. Still
# cheaper than a red CI run and a fixup re-push.

# A delete-only push has no content to gate, so every check below is answering
# a question nobody asked. Measured 2026-08-18 during the 14.0.0 release:
# `git push origin --delete release/14.0.0` was refused by the branch-freshness
# gate because the CHECKED-OUT branch was behind main — a fact with no bearing
# on removing a remote ref. The deletion had to go through the GitHub API to
# happen at all, which routes around the whole hook rather than around one gate.
#
# Git feeds pre-push one line per ref on stdin:
#   <local ref> <local sha> <remote ref> <remote sha>
# and a deletion carries the all-zero local sha. Reading stdin is safe here:
# nothing below consumes it.
delete_only=1
saw_ref=0
while read -r _local_ref local_sha _remote_ref _remote_sha; do
    [ -z "${local_sha:-}" ] && continue
    saw_ref=1
    # Any non-zero character means a real object is being pushed.
    case "$local_sha" in
        *[!0]*) delete_only=0 ;;
    esac
done
if [ "$saw_ref" = "1" ] && [ "$delete_only" = "1" ]; then
    echo "🗑️  Delete-only push — no ref advances, so the content gates have nothing to check. Skipping."
    exit 0
fi

fail=0

if ! command -v task >/dev/null 2>&1; then
    echo "⚠️  'task' (go-task) not found — cannot run the consistency gate locally."
    echo "    Install it (https://taskfile.dev) so pre-push can mirror the CI check;"
    echo "    skipping the consistency check for this push."
else
    echo "🔍 Consistency — mirroring the CI 'Sync + Generate Tools Consistency' gate..."
    if ! task consistency; then
        echo "❌  Derived outputs drifted (counts / dist / generated tool trees / router / corpus)."
        echo "    'task consistency' just regenerated them into your working tree —"
        echo "    review + 'git add' the changes (or run 'task consistency-fix'), commit, then re-push."
        fail=1
    fi
fi

# road-to-local-ci-trust Phase 2: the CI-only repo-content gates, as one task.
# Deliberately placed AFTER the consistency block above — `task consistency`
# runs `task sync`, which generates the `.augment/` projection. Several
# preflight gates read that tree, so on a FRESH worktree (this repo's standard
# workflow) running preflight first would fail with "produced by regeneration
# but absent before" — red for a reason the contributor did not cause, which is
# exactly the anti-pattern this gate set exists to avoid.
#
# BUDGET: measured 36.05s on 2026-08-30 (road-to-agent-turnaround 3.2, a clean
# exit-0 run), against the 25s `pre_push_budget_seconds` ceiling in
# src/config/ci-local-parity.yml. That is 44% OVER, and the header claimed 15s
# until this measurement. The ceiling's own comment calls it "a real budget, not
# a wish" — and nothing measures the hook, so the gate set grew past it with no
# signal. Recorded rather than fixed here: narrowing preflight to the pushed
# paths is one edit away from turning a push-blocking mirror into a partial one,
# which is how drift reaches CI instead of the developer.
#
# The hook's local cost is therefore ~46s (10s consistency + 36s preflight),
# which is what the 67s median `git push` in the ten-session corpus is mostly
# made of. `check_enforcement_coverage` (30.7s) stays out of preflight by design.
echo "🔍 Preflight — the CI-only repo-content gates..."
if [ "${AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT:-}" = "1" ]; then
    echo "⏭️  skipped via AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT=1"
elif ! command -v task >/dev/null 2>&1; then
    echo "⚠️  'task' not found — skipping preflight for this push."
elif ! task preflight; then
    echo "❌  Preflight failed. These gates run in CI too, so pushing now buys a"
    echo "    red run and a fixup re-push. Fix the failures above, or"
    echo "    AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT=1 for a genuine WIP push."
    exit 1
fi

echo "🔍 Checking for leftover conflict markers / unmerged paths..."
if ! ./scripts-run src/scripts/check_no_conflict_markers --quiet; then
    echo "❌  Conflict markers or unmerged paths present. Resolve them (e.g. 'git checkout HEAD -- <file>' or finish the merge), then re-push."
    fail=1
fi

# Changed-files static pass (typecheck + lint) — the deterministic backstop to
# the behavioural verify-before-complete rule (#818). Catches the compile/lint
# errors that reach remote CI "Static Checks" (e.g. TS18048). Runs only when
# the push touches .ts, so docs-only pushes stay fast. Skip a genuine WIP push
# with AGENT_CONFIG_SKIP_PREPUSH_STATIC=1 (the agent cannot use --no-verify).
echo "🔍 Static check on changed TypeScript (typecheck + lint)..."
if [ "${AGENT_CONFIG_SKIP_PREPUSH_STATIC:-}" = "1" ]; then
    echo "⏭️  skipped via AGENT_CONFIG_SKIP_PREPUSH_STATIC=1"
else
    base="$(git merge-base HEAD origin/main 2>/dev/null || echo HEAD~1)"
    changed_ts="$(git diff --name-only --diff-filter=d "$base"...HEAD -- '*.ts' 2>/dev/null || true)"
    if [ -n "$changed_ts" ]; then
        if ! npx eslint $changed_ts; then
            echo "❌  ESLint failed on changed TypeScript. Fix before pushing (or AGENT_CONFIG_SKIP_PREPUSH_STATIC=1 for a WIP push)."
            fail=1
        fi
        if ! npm run --silent typecheck; then
            echo "❌  Typecheck (tsc) failed — this is the class of error remote CI 'Static Checks' catches (#818). Fix before pushing."
            fail=1
        fi
    else
        echo "⏭️  no changed .ts vs origin/main — skipping."
    fi
fi

if [ $fail -ne 0 ]; then
    echo ""
    echo "   Push blocked — fix the failures above and re-push."
    echo "   Bypass for a WIP push:  git push --no-verify"
    exit 1
fi
EOF

chmod +x "$HOOKS_DIR/pre-push"
echo "✅  Pre-push hook installed." >&2

# Pre-commit: marketplace consistency -----------------------------------------
#
# Distribution manifests (.claude-plugin/marketplace.json) drift silently —
# adding a skill on disk without updating the manifest renders it invisible to
# Claude Code Plugin Marketplace consumers. CI catches it, but a structural
# pre-commit gate stops the bad commit from landing in the first place.
# Runtime is ~40 ms; always-on is cheaper than scoped detection.

cat > "$HOOKS_DIR/pre-commit" << 'EOF'
#!/usr/bin/env bash
# Pre-commit hook: verify .claude-plugin/marketplace.json lists every skill
# that exists on disk under the committed skill sources (dist/agent-src/skills/
# + .claude-plugin/skills/), AND verify
# agents/roadmaps-progress.md is in sync with the current state of
# agents/roadmaps/ (roadmap-progress-sync Iron Law).

./scripts-run src/scripts/lint_marketplace
status=$?

if [ $status -ne 0 ]; then
    echo ""
    echo "❌  Commit blocked — .claude-plugin/marketplace.json is out of sync."
    echo "   Add the missing skill to the manifest (or remove the stale entry),"
    echo "   then re-stage and commit. To bypass for an unrelated WIP commit:"
    echo "       git commit --no-verify"
    exit 1
fi

# Roadmap dashboard sync — only fires when staged changes touch a roadmap
# file or the dashboard itself, so unrelated commits stay fast.
if git diff --cached --name-only | grep -qE '^agents/roadmaps(-progress\.md|/)'; then
    ./scripts-run src/scripts/roadmap_progress_hook --check
    rstatus=$?
    if [ $rstatus -ne 0 ]; then
        # The check fails for THREE distinct reasons and prints the real one
        # above: a stale dashboard, an unresolved `[~]` deferred item (Iron
        # Law 3), or a completed-but-unarchived roadmap. Naming only the first
        # sent a maintainer chasing a regeneration that was already correct —
        # and a safety gate whose text points at the wrong cause trains people
        # to distrust the gate, which costs more than the wrong message.
        echo ""
        echo "❌  Commit blocked — the roadmap dashboard gate failed."
        echo "   The cause is printed above. The three it reports:"
        echo "     · dashboard stale      → './agent-config roadmap:progress',"
        echo "                               then stage agents/roadmaps-progress.md"
        echo "     · Iron Law 3           → unresolved '[~]' deferred items. Surface"
        echo "                               them and ask the user; NOT the agent's"
        echo "                               to clear (roadmap-management § 4b)"
        echo "     · completed roadmap    → 'git mv' it into agents/roadmaps/archive/,"
        echo "                               then regenerate"
        echo "   To bypass for an unrelated WIP commit: git commit --no-verify"
        exit 1
    fi

    # Empty-roadmap backstop — refuse 0-byte / whitespace-only roadmap files.
    # An external "chore: add uncomitted roadmaps" auto-commit has twice staged
    # 0-byte placeholders; this gate stops the class from landing.
    if ! ./scripts-run src/scripts/lint_empty_roadmaps --quiet; then
        echo ""
        echo "❌  Commit blocked — empty (0-byte / whitespace-only) roadmap file staged."
        ./scripts-run src/scripts/lint_empty_roadmaps || true
        echo "   To bypass for an unrelated WIP commit: git commit --no-verify"
        exit 1
    fi
fi

# Phase-0 pack gates (road-to-6.0.0-D) — pack.yaml schema + dependency/DAG +
# single-namespace collision lints. Only fires when staged changes touch pack
# sources, the packs vocab, or the gate scripts themselves, so unrelated
# commits stay fast.
if git diff --cached --name-only | grep -qE '^(packages/|src/config/discovery/packs\.yml|src/scripts/(validate_pack_yaml|lint_pack_dependencies|lint_namespace_collisions|generate_pack_manifests)\.ts|src/scripts/schemas/pack\.schema\.json|src/scripts/pack_dependency_allowlist\.json)'; then
    if ! ./scripts-run src/scripts/validate_pack_yaml \
        || ! ./scripts-run src/scripts/lint_pack_dependencies \
        || ! ./scripts-run src/scripts/lint_namespace_collisions; then
        echo ""
        echo "❌  Commit blocked — Phase-0 pack gate failed (schema / dependency / namespace)."
        echo "   Run 'task generate-pack-manifests' if manifests drifted, fix the"
        echo "   reported reference, then re-stage and commit."
        echo "   To bypass for an unrelated WIP commit: git commit --no-verify"
        exit 1
    fi
fi

# Knowledge team-sharing gate (road-to-knowledge-system Phase 3) — refuses a
# gitignored agents/memory/intake/ file staged by accident, and refuses a
# agents/knowledge/ page marked visibility: private (belongs in the
# user-global store, never the team-shared repo). Only fires when staged
# changes touch agents/knowledge/ or agents/memory/intake/, so unrelated
# commits stay fast.
if git diff --cached --name-only | grep -qE '^(agents/knowledge/|agents/memory/intake/)'; then
    if ! ./scripts-run src/scripts/check_knowledge_sharing; then
        echo ""
        echo "❌  Commit blocked — knowledge team-sharing gate failed."
        echo "   Unstage the intake/private file, or drop the private page from"
        echo "   this commit (it belongs in the user-global knowledge store)."
        echo "   To bypass for an unrelated WIP commit: git commit --no-verify"
        exit 1
    fi
fi
EOF

chmod +x "$HOOKS_DIR/pre-commit"
echo "✅  Pre-commit hook installed." >&2

# Chat-history bridge hooks ----------------------------------------------------
#
# Augment IDE plugin (and any other agent surface without native chat
# lifecycle hooks) cannot fire SessionStart/Stop/PostToolUse. Git hooks
# are the platform-agnostic lifecycle surface that fires regardless of
# IDE — every commit, merge, checkout, and rewrite turns into a phase
# boundary in agents/runtime/.agent-chat-history when an agent session is active.
#
# The hooks are silent no-ops when no agent session is active (the
# chat_history.ts hook-append script returns "skipped_no_sidecar" with
# exit 0) and `|| true` belt-and-suspenders ensures git operations are
# never blocked.

write_chat_history_hook() {
    local name="$1"
    local phase_tag="$2"
    cat > "$HOOKS_DIR/$name" << EOF
#!/usr/bin/env bash
# $name: append a phase boundary to agents/runtime/.agent-chat-history when an agent
# session is active. Silent no-op otherwise. Never blocks git.

if [ -x ./agent-config ]; then
    ref="\$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    payload="{\"phase\":\"$phase_tag\",\"source\":\"git-hook:\$ref\"}"
    ./agent-config chat-history:checkpoint --payload "\$payload" \
        >/dev/null 2>&1 || true
fi
# NOTE: no explicit exit 0 here — the auto-sync block (appended below
# for post-merge / post-checkout) needs to run after this. Every
# command above is guarded by "|| true", so the implicit exit is 0.
EOF
    chmod +x "$HOOKS_DIR/$name"
    echo "✅  $name hook installed." >&2
}

write_chat_history_hook "post-commit"   "git:post-commit"
write_chat_history_hook "post-merge"    "git:post-merge"
write_chat_history_hook "post-checkout" "git:post-checkout"
write_chat_history_hook "post-rewrite"  "git:post-rewrite"

# Auto-sync agent-tool projections after pull / branch-switch ---------------
#
# When `.agent-src.uncondensed/`, `dist/agent-src/`, `src/scripts/condense.ts`,
# `agents/.agent-tools.yml`, or `Taskfile.yml` change between the previous and
# new HEAD, the developer's working tree has stale `.claude/`,
# `.augment/`, etc. projections until they remember to run `task sync`.
# These hooks bridge that gap: fast idempotent re-projection.
#
# The same staleness bites the compiled CLI: the Claude/agent hooks run
# `./agent-config` → `dist/cli/` (gitignored tsc output). A pull that adds
# or moves a TS module leaves `dist/` stale and EVERY subsequent tool-use
# hook fails with ERR_MODULE_NOT_FOUND until someone rebuilds. So when the
# range touches TS sources, rebuild via `npm run build:cli` — tsc only,
# deliberately NOT the full `npm run build`: the install-bundle step
# rewrites the committed `dist/install/install.mjs` and has produced
# spurious tracked diffs from worktrees before.
#
# Bypass: `git pull --no-verify` does not exist, but devs can disable the
# hooks per-command via `git -c core.hooksPath=/dev/null ...` or by
# editing the file. Runtime ~200 ms when nothing relevant changed
# (path-diff check exits early); ~2 s on full re-projection; ~2 s extra
# for the tsc rebuild when TS sources changed.

append_auto_sync_block() {
    local name="$1"
    local arg_offset="$2"   # post-merge: $1=is_squash; post-checkout: $3=is_branch
    cat >> "$HOOKS_DIR/$name" << EOF

# --- auto-sync agent-tool projections ---------------------------------------
# Skip when this is a file-checkout (post-checkout \$3 = 0) — only fire on
# branch switches and merges, where source files realistically changed.
if [ "$name" = "post-checkout" ] && [ "\${3:-1}" = "0" ]; then
    exit 0
fi

# Range: prev..new. For post-merge git provides ORIG_HEAD; for
# post-checkout the previous SHA is \$1.
if [ "$name" = "post-merge" ]; then
    prev="\$(git rev-parse ORIG_HEAD 2>/dev/null || echo)"
    new="\$(git rev-parse HEAD 2>/dev/null || echo)"
elif [ "$name" = "post-checkout" ]; then
    prev="\${1:-}"
    new="\${2:-}"
fi

if [ -n "\$prev" ] && [ -n "\$new" ] && [ "\$prev" != "\$new" ]; then
    changed="\$(git diff --name-only "\$prev" "\$new" 2>/dev/null)"
    if printf '%s\n' "\$changed" | \\
        grep -qE '^(dist/agent-src/|\\.agent-src\\.uncondensed/|src/scripts/condense\\.ts|\\.agent-tools\\.yml|Taskfile\\.yml)'; then
        if command -v task >/dev/null 2>&1; then
            task sync >/dev/null 2>&1 || true
            task generate-tools >/dev/null 2>&1 || true
        fi
    fi
    # TS sources changed → the gitignored tsc output (dist/cli, dist/scripts,
    # …) is stale and the ./agent-config hook chain breaks with
    # ERR_MODULE_NOT_FOUND. Rebuild tsc output only (build:cli), never the
    # full build (install-bundle rewrites committed dist/install/install.mjs).
    # Skip silently without node_modules (fresh clone / bare worktree).
    if printf '%s\n' "\$changed" | \\
        grep -qE '^(src/(cli|server|shared|install|scripts)/|tsconfig\\.json|package\\.json)'; then
        if command -v npm >/dev/null 2>&1 && [ -d node_modules ]; then
            npm run build:cli >/dev/null 2>&1 || true
        fi
    fi
fi
EOF
}

append_auto_sync_block "post-merge"    "1"
append_auto_sync_block "post-checkout" "3"
echo "✅  Auto-sync block appended to post-merge / post-checkout hooks." >&2
