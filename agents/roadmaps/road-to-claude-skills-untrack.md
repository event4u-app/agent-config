---
status: ready
complexity: structural
parent_roadmap: linter-debt-and-meta-subtraction
---

# Roadmap: Untrack `.claude/skills/` (follow-up to projection cleanup)

> Follow-up PR split from the `.claude/` projection cleanup. That change
> untracked `.claude/{rules,personas,user-types}/` (pure projections) but
> **kept `.claude/skills/` + `.claude/settings.json` tracked**, because
> verification showed `.claude/skills/` is load-bearing by Claude Code's
> own filesystem convention — not just by our manifest.
>
> This roadmap investigates whether `.claude/skills/` can also be
> untracked (so `.claude/` reduces to `settings.json` only). It is an
> **investigation, not a foregone conclusion** — a legitimate outcome is
> "keep `.claude/skills/` tracked" recorded as an ADR.

## Goal

Decide — with evidence from a real Claude Code instance — whether the
Claude Code plugin distribution can resolve skills without a tracked
`.claude/skills/` tree, and if so, repoint the toolchain and untrack it.

## Verified constraints (carried from the cleanup investigation)

- `.claude-plugin/marketplace.json` references `./.claude/skills/<name>`
  (365 entries); marketplace is consumed as a **git repo**, so referenced
  paths must exist in the committed tree.
- `.claude/skills/<name>/SKILL.md` is "Claude Code's filesystem-channel
  convention" (ADR-030) — not freely relocatable by us.
- The **consumer installer** (`scripts/install.sh` ~line 525) creates
  `.claude/skills/` symlinks on every install, independent of the
  marketplace — this channel needs the layout regardless.
- `scripts/lint_marketplace.py` (`CLAUDE_SKILLS_DIR`) and the pre-commit
  hook (`scripts/install-hooks.sh`) are hardcoded to `.claude/skills/`.
- Entries are symlinks → near-zero content cost; PR churn occurs only when
  the skill *set* changes (add / rename / remove), not on content edits.

## Phase 1 — Spike: does Claude Code register skills off `.agent-src/skills/`?

- [ ] In a scratch Claude Code instance, point a marketplace plugin's
      `skills[]` at `./.agent-src/skills/<name>` and confirm the skills
      register (or fail). Capture the result verbatim.
- [ ] Confirm whether the consumer filesystem channel (`install.sh`) can
      drop `.claude/skills/` or whether it independently requires it.
- [ ] Record both findings in the decision note.

## Phase 2 — Decision gate (ADR)

- [ ] If **both** channels work without a tracked `.claude/skills/`:
      proceed to Phase 3.
- [ ] If **either** channel requires `.claude/skills/`: stop here, write an
      ADR ("`.claude/skills/` stays tracked — Claude Code convention"),
      mark Phase 3–4 steps `[-]` cancelled with the ADR as rationale.

## Phase 3 — Implement (conditional on Phase 2)

- [ ] Repoint the `marketplace.json` generator to the chosen source path.
- [ ] Update `scripts/lint_marketplace.py` (`CLAUDE_SKILLS_DIR` + reverse
      drift check) to the new location.
- [ ] Update the pre-commit hook in `scripts/install-hooks.sh`.
- [ ] Update `scripts/install.sh` skill-symlink step if the consumer
      channel changes.
- [ ] Add `/.claude/skills/` to `.gitignore` and `git rm -r --cached` it.

## Phase 4 — Verify

- [ ] `python3 scripts/lint_marketplace.py` green against the new layout.
- [ ] `task generate-tools` regenerates cleanly; `.claude/skills/` stays
      ignored.
- [ ] Plugin registration confirmed in a real Claude Code instance.

## Acceptance criteria

- A recorded decision (ADR) on whether `.claude/skills/` can be untracked,
  backed by a real Claude Code registration test — not reasoning alone.
- If untracked: marketplace lint + generate-tools + plugin registration
  all green; `.claude/` contains only `settings.json` in git.
- If kept: ADR documents the Claude Code convention as the binding reason,
  closing the question so it is not relitigated.
