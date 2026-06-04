#!/usr/bin/env python3
"""One-shot bootstrap — inject `tier: N` frontmatter into every slash command.

Per Phase 4 Step 3 of `agents/roadmaps/road-to-distribution-maturity.md`.

Walks `.agent-src.uncondensed/commands/**.md`. For each file:

- Tier-0 promotions match TIER_0 below — typed by hand.
- Tier-1 promotions match TIER_1 below — typed by hand.
- Everything else defaults to **Tier-2** (per the contract).

Idempotent — re-running is a no-op once tiers are tagged. The lint
script `scripts/lint_command_tiers.py` enforces drift from here on.

Run from repo root: `python3 scripts/_bootstrap_tier_frontmatter.py`.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
COMMANDS_DIRS = (
    REPO_ROOT / ".agent-src.uncondensed" / "commands",
    REPO_ROOT / ".agent-src" / "commands",
)

# Tier-0 — daily-driver slash commands (per docs/contracts/command-surface-tiers.md).
# Paths are relative to COMMANDS_DIR.
TIER_0 = {
    "onboard.md",
    "commit.md",
    "work.md",
    "implement-ticket.md",
    "agent-status.md",
    "agent-handoff.md",
}

# Tier-1 — power-user / maintainer / orchestrator slash commands.
TIER_1 = {
    "create-pr.md",
    "review-changes.md",
    "optimize.md",
    "roadmap.md",
    "feature.md",
    "fix.md",
    "judge.md",
    "memory.md",
    "council.md",
    "agents.md",
    "commit/in-chunks.md",
    "create-pr/description-only.md",
    "quality-fix.md",
    "prepare-for-review.md",
    "estimate-ticket.md",
    "refine-ticket.md",
    "bug-fix.md",
    "bug-investigate.md",
    "jira-ticket.md",
    "condense.md",
    "mode.md",
    "project-analyze.md",
    "project-health.md",
    "rule-compliance-audit.md",
    "threat-model.md",
    "set-cost-profile.md",
    "sync-agent-settings.md",
    "sync-gitignore.md",
    "upstream-contribute.md",
}

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)


def classify(rel_path: str) -> int:
    if rel_path in TIER_0:
        return 0
    if rel_path in TIER_1:
        return 1
    return 2


def inject_tier(text: str, tier: int) -> tuple[str, bool]:
    """Inject `tier: N` into the frontmatter block. Returns (new_text, changed).

    If frontmatter already contains `tier:`, the existing value wins
    (idempotent — bootstrap never overrides a manual tag).
    """
    m = FRONTMATTER_RE.match(text)
    if not m:
        return text, False
    block = m.group(1)
    if re.search(r"^tier:\s*[012]\s*$", block, re.MULTILINE):
        return text, False
    # Insert `tier: N` right after the `name:` line if present, else at
    # the top of the block.
    name_match = re.search(r"^(name:\s*\S+)$", block, re.MULTILINE)
    if name_match:
        new_block = (
            block[: name_match.end()]
            + f"\ntier: {tier}"
            + block[name_match.end() :]
        )
    else:
        new_block = f"tier: {tier}\n{block}"
    new_fm = f"---\n{new_block}\n---\n"
    return new_fm + text[m.end() :], True


def main() -> int:
    overall_tagged = 0
    overall_skipped = 0
    for commands_dir in COMMANDS_DIRS:
        if not commands_dir.is_dir():
            print(f"[bootstrap-tier] no commands dir: {commands_dir}")
            continue
        files = sorted(commands_dir.rglob("*.md"))
        tagged = 0
        skipped = 0
        by_tier = {0: 0, 1: 0, 2: 0}
        for path in files:
            rel = path.relative_to(commands_dir).as_posix()
            # Sub-AGENTS.md files are not slash commands.
            if rel.endswith("AGENTS.md"):
                continue
            tier = classify(rel)
            by_tier[tier] += 1
            text = path.read_text(encoding="utf-8")
            new_text, changed = inject_tier(text, tier)
            if changed:
                path.write_text(new_text, encoding="utf-8")
                tagged += 1
            else:
                skipped += 1
        overall_tagged += tagged
        overall_skipped += skipped
        rel_label = commands_dir.relative_to(REPO_ROOT)
        print(
            f"[bootstrap-tier] dir={rel_label} tagged={tagged} "
            f"skipped={skipped} tier-0={by_tier[0]} "
            f"tier-1={by_tier[1]} tier-2={by_tier[2]}"
        )
    print(
        f"[bootstrap-tier] total: tagged={overall_tagged} "
        f"skipped={overall_skipped}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
