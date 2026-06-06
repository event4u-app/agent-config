---
adr: 030
status: accepted
date: 2026-05-28
decision: claude-code-command-projection
supersedes: —
superseded_by: —
phase: road-to-claude-code-global-distribution Phase 3
type: structural
review_date: 2026-06-11
---

# ADR-030 — Claude Code command-projection strategy: native slash-only

## Status

**Accepted** · 2026-05-28. Three conditions enumerated below; all three
verified empirically in the same session, so the decision lands
**without** soak. The 14-day kill-switch keeps the revert path one
commit away; review date 2026-06-11 closes the window.

## Context

The package ships commands as `.agent-src/commands/<cluster>/<sub>.md`
(canonical source) and projects them per-tool through
`scripts/condense.py`. Pre-2026-05-28 the Claude Code projection was a
single path: `generate_claude_commands` rewrote each command into
`.claude/skills/<flat-slug>/SKILL.md` with
`disable-model-invocation: true` in the source frontmatter.

The 2026-05-28 diagnostic surfaced the failure mode:

- `.claude/commands/` was never populated — commands carried no
  filesystem channel into Claude Code's native slash router.
- The skills-projection target was filtered out of the
  model-invokable skill list (`disable-model-invocation: true`).
- `_CLAUDE_SKILL_BUNDLE` shipped `rules` / `skills` / `personas` but
  **no** `commands` subtree.

Net result: Claude Code received zero command surface from the package
outside the cwd-local repo install. Augment Code and Cursor bundles
already shipped `commands/`; Claude Code was the outlier.

## Decision

Adopt **Option B (native slash-only)**:

1. Ship `.agent-src/commands/` directly into Claude Code's native
   slash-command surface at `~/.claude/commands/` via the global
   deploy bundle (`_CLAUDE_SKILL_BUNDLE` in `scripts/install.py` and
   its TypeScript mirror in `src/install/wizard-plan.ts`).
   Subdirectory layout maps 1:1 to the `/<cluster>:<sub>` namespace
   per Claude Code's filesystem-channel convention. No separate
   `condense.py` projector — the source tree already follows the
   target layout, so the global-install copy is the projection.
2. Keep `condense.py::generate_claude_commands` (skills-list
   projection at `.claude/skills/`) unchanged **for now** —
   backwards compat for any consumer already discovering commands
   via `.claude/skills/`. Retirement deferred to a separate roadmap
   if needed.

Rejected alternatives:

- **Option A — dual projection (slash + skills, both active).**
  Conservative, but doubles maintenance surface and keeps the
  filter-out-of-skill-list semantics. Verdict: only useful if Option B
  fails the kill-switch window.
- **Option C — commands_unsupported (no Claude Code command
  surface).** Eliminates the bug class by removing the feature.
  Verdict: regression in product surface; Claude Code consumers lose
  parity with Augment / Cursor.

### Council convergence

Session 2026-05-28, design mode, 2 rounds, $0.06 actual.
Members: `claude-sonnet-4-5` + `gpt-4o`. Both converged on Option B,
CONDITIONAL on the three verifications below. Responses captured at
`agents/runtime/council/responses/claude-code-distribution.json`. <!-- council-ref-allowed: ADR decision trace -->

### Three conditions (all verified 2026-05-28)

1. **Plugin loader reads `.claude/commands/` for globally-installed
   plugins (not just cwd-local).**
   Verified empirically: `~/.claude/commands/probe/sub.md` →
   `/probe:sub` routed successfully via
   `echo '' | claude --print "/probe:sub"`. Native filesystem channel
   works for user-scope at top-level AND in subdirectories.
2. **Command parser tolerates `disable-model-invocation: true` in
   frontmatter (or strip during projection).**
   Verified empirically: probe command carrying the package's full
   rich frontmatter routed successfully. Subtle behaviour:
   `disable-model-invocation: true` hides the command from `/help`
   listing but keeps it slash-invokable when typed directly — the
   desired UX for heavyweight commands. No frontmatter-strip step
   required.
3. **Kill-switch defined: if native slash doesn't resolve in
   production within 14 days, fall back to dual-projection with
   deprecation timeline.**
   The kill-switch is the inverse of Phase 4 Step 1 — remove
   `(".agent-src/commands", "commands")` from `_CLAUDE_SKILL_BUNDLE`
   in `scripts/install.py` and `src/install/wizard-plan.ts`. One-line
   revert per file. Tracked by review date 2026-06-11.

## Consequences

**Positive:**

- `~/.claude/commands/<cluster>/<sub>.md` lands the package's full
  command surface natively in Claude Code, matching Augment and
  Cursor parity.
- `disable-model-invocation: true` semantics preserved — heavyweight
  commands stay invokable but hidden from auto-complete, the intended
  UX.
- No frontmatter mangling — the source command file is the artifact
  that ships, no projection transform needed.

**Negative / accepted:**

- Two projection paths coexist (`.claude/commands/` for slash routing
  + `.claude/skills/` for the legacy skills-projection list). Cost is
  one extra subtree per install; benefit is no consumer-breaking
  during the 14-day kill-switch window. Retirement of the skills
  projection is a separate decision.
- Frontmatter shipped to Claude Code carries package-internal fields
  (`tier`, `cluster`, `sub`, `lifecycle`, `trust`, `install`, etc.)
  the runtime ignores. Empirically tolerated; documented as
  belt-and-braces against future runtime tightening.

## Alternatives considered

See § Decision above — Option A (dual projection) and Option C
(commands_unsupported) explicitly rejected with stated rationale.

## References

- Roadmap:
  `agents/roadmaps/road-to-claude-code-global-distribution.md` Phase 3.
- Council session responses:
  `agents/runtime/council/responses/claude-code-distribution.json`. <!-- council-ref-allowed: ADR decision trace -->
- Empirical verification: `~/.claude/commands/probe/sub.md` route
  test, 2026-05-28 (Condition 1 + Condition 2).
- Mirror implementation: `scripts/install.py::_CLAUDE_SKILL_BUNDLE`
  and `src/install/wizard-plan.ts::CLAUDE_SKILL_BUNDLE` — both
  include `(".agent-src/commands", "commands")` so a global install
  drops `~/.claude/commands/<cluster>/<sub>.md` directly.
- Predecessor projection: `scripts/condense.py::generate_claude_commands`
  (skills-list, retained pending separate retirement decision).
