---
adr: 044
status: accepted
date: 2026-06-03
decision: command-naming-scheme-hyphenated
supersedes: —
superseded_by: —
phase: v6.0.0 · D structural restructure
type: decision
---

# ADR-044 — Command naming scheme: `<pack>-<verb>`, hyphenated, no colon namespacing

## Status

**Accepted** · 2026-06-03. Authored as Phase 4b / Step 11 of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/road-to-6.0.0-d-structural-restructure.md).
Builds on [`ADR-041`](ADR-041-controlled-command-verbs.md) (controlled verb
allowlist — still applies, unchanged) and
[`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) (the `src/domains/<pack>/`
collapse that gives each command a pack-physical home). Sits alongside the
locked-cluster contract ([`command-clusters.md`](../contracts/command-clusters.md)).

## Context

6.0.0-D moves every command into `src/domains/<pack>/<verb>/command.md` — the
path now carries pack ownership. With ownership in the path, the historical
**colon cluster syntax** (`feature:plan`, `git:pr`, `git:pr:create`) is no longer
needed to express grouping, and it actively fights the Claude Code projection.

The naming question was settled by an **authoritative claude-code-guide finding**
plus the AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-03):

1. **Claude Code SHADOWS a bare colon cluster-head** when a same-named
   subdirectory exists. Observed: with `/create-pr` and
   `/create-pr:description-only` both present, the bare `/create-pr` head is
   hidden and only the sub is shown. A cluster head with no default action
   becomes invisible.
2. **Claude Code does NOT support two-colon multi-level invocation**
   (`git:pr:create` ✗). Only a single colon level resolves.

So colon namespacing cannot express the `git/pr/create` depth the domain tree
now has, and bare cluster heads disappear from the surface anyway.

## Decision

1. **`<pack>-<verb>`, hyphenated.** Every project command is invoked as a flat,
   hyphenated name. `feature:plan` → `feature-plan`; `git:pr:create` →
   `git-pr-create`; `git:commit` → `git-commit`. No colon namespacing for
   project commands.

2. **Cluster heads fold away.** A bare orchestrator command with no default
   action is not a visible command. Its sub-commands render as standalone flat
   hyphenated commands. (The *structural* move of head files into the flat layout
   is Step 13; the *behavioral* folding of N routers into one is staged in 6.0.x
   per the scope-line rule, not done here.)

3. **A sub-action is a separate command only if it is a distinct workflow** —
   otherwise it is a **flag** on the parent. `commit --in-chunks`, not
   `commit-in-chunks`, once the merge evidence (Step 13b) confirms the split is
   artificial. Sibling variants that differ only in a parameter are flags, never
   a second command.

4. **The controlled-verb allowlist (ADR-041) still applies, unchanged.** The
   leading token of every visible command must be drawn from
   [`config/discovery/command-verbs.yml`](../../config/discovery/command-verbs.yml).
   This ADR governs the *shape* (`<pack>-<verb>`, hyphenated); ADR-041 governs the
   *verb vocabulary*. They compose.

5. **Same short-descriptive-name discipline for skills and rules.** The flat
   `src/skills/` and `src/rules/` library is a single global namespace. Names are
   short, descriptive, and globally unique after normalization (lowercase,
   `_`→`-`) — enforced by the single-namespace collision lint (Phase 0, Step 4).
   No skill / rule / command name may collide across the three surfaces.

6. **6.0.0-D is rename + alias only — NO consolidation.** Every renamed command
   keeps its old invocation working as a deprecation alias (`replaces:` /
   `superseded_by`, routed by `migrate`). Nothing is removed in 6.0-D. Merging
   clusters, dropping old aliases, and converting surplus leaf commands to skills
   are Phase 8 / 6.1 work (their own roadmap).

## Consequences

- **Positive.** The surface reads as a flat, predictable verb vocabulary scoped
  by pack prefix. Every command resolves under Claude Code (no shadowed heads, no
  unsupported two-colon depth). The `src/domains/<pack>/<verb>/` path and the
  `<pack>-<verb>` invocation name line up one-to-one.
- **Positive.** Rename-with-alias means zero breakage in 6.0-D: old colon
  invocations keep resolving through the deprecation alias until a later major.
- **Negative / accepted.** Flat hyphenated names are longer than the colon sub
  (`git-pr-create` vs `git:pr:create`). The gain — universal resolvability and a
  single namespace — outweighs the few extra characters.
- **Negative / accepted.** The fold of cluster heads into flat subs increases the
  raw command *count* in the tree before 6.1 consolidation shrinks it. This is the
  cost of "structure first, consolidate second" (the feedback-2 guardrail).

## Alternatives considered

- **Keep colon namespacing (`git:pr:create`).** Rejected: Claude Code does not
  resolve two-colon depth, and bare heads are shadowed — the syntax cannot
  express the domain tree.
- **Single colon level only (`git:commit`, `git-pr-create` for depth-3).**
  Rejected: mixing colon and hyphen by depth is inconsistent and surprising; a
  uniform hyphenated scheme is simpler to teach and to lint.
- **Consolidate while renaming.** Rejected per the feedback-2 hard guardrail:
  "Erst Strukturbruch. Dann Konsolidierungsroadmap." Doing both at once makes the
  6.0 break un-reviewable and risky.

## References

- [`ADR-041`](ADR-041-controlled-command-verbs.md) — controlled verb allowlist (composes with this ADR).
- [`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) — `src/domains/<pack>/` collapse.
- [`command-clusters.md`](../contracts/command-clusters.md) — locked clusters + sub-command naming + command justification.
- [`agents/reports/command-classification-6.0.0-d.md`](../../agents/reports/command-classification-6.0.0-d.md) — the 150-command rename worksheet driven by this scheme (Step 12).
