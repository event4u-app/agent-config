---
adr: 046
status: accepted
date: 2026-06-03
decision: thin-command-principle
supersedes: —
superseded_by: —
phase: v6.0.0 · D structural restructure
type: decision
---

# ADR-046 — The Thin-Command Principle: commands orchestrate, skills + scripts implement

## Status

**Accepted** · 2026-06-03. Authored as Phase 7 / Step 20 of
[`road-to-6.0.0-d-structural-restructure`](../../agents/roadmaps/road-to-6.0.0-d-structural-restructure.md)
(feedback-3: "it is an architecture decision, not just structure"). Composes with
[`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) (the flat `src/skills/` +
`src/rules/` shared library a command composes from) and
[`ADR-044`](ADR-044-command-naming-scheme-hyphenated.md) (naming).

## Context

6.0.0-D makes the path the unit of command ownership
(`src/domains/<pack>/<verb>/command.md`) and keeps skills + rules flat and shared.
That structure only pays off if commands stay **thin**: a command's `.md` is a
short orchestration spec, and the heavy logic lives in reusable skills + scripts
that many commands can compose.

Without this principle, every command re-implements its own workflow inline, the
`.md` files balloon, logic duplicates across sibling commands, and the "merge N
commands into one" consolidation planned for 6.1 becomes impossible — there is
nothing shared to fold into. The thin-command shape is the precondition that
makes both the flat library (ADR-043) and the future consolidation tractable.

## Decision

1. **A command is a THIN base.** Its `command.md` is a short orchestration spec:
   it states intent, lists the skills it triggers and the scripts it runs, names
   the safety gates, and sequences them. It does **not** inline detailed
   procedure.

2. **Heavy logic lives in `src/skills/` and scripts.** Calculations,
   multi-step procedures, provider calls, parsing, and orchestration detail
   belong in a skill (preferably) or a script (TypeScript preferred, Python where
   the surrounding tooling is Python) — never in the command body.

3. **When commands merge or are cut, the removed pieces become skills.** A
   consolidation never deletes behavior: the survivor composes the behavior of
   the folded commands as skills. This is what keeps 6.1 consolidation
   non-destructive.

4. **Interactivity is an allowed merge mechanism.** A thin command MAY ask ONE
   short clarifying question to disambiguate instead of splitting into several
   commands (e.g. `fix-pr-comments` detecting new bot/human comments and asking
   which to fix). The question must work non-interactively in CI (honor
   `--yes` / `--json` / explicit flags, detect a non-TTY, fall back to a safe
   default — destructive defaults are never silent).

5. **The command body never embeds credentials or free-form execution.** Per the
   tool-safety floor, a command declares the skills/scripts it composes; it does
   not inline secrets or arbitrary code.

## Consequences

- **Positive.** Command `.md` files stay scannable and reviewable; logic is
  written once in a skill and reused across every command that needs it.
- **Positive.** Consolidation (6.1) is a fold, not a rewrite: the behavior is
  already a composable skill.
- **Positive.** The flat shared library (ADR-043) has real consumers — commands
  reference skills by slug, the dependency is declared in `pack.yaml`.
- **Negative / accepted.** Authoring a new command now means authoring (or
  reusing) a skill for its logic — a slightly higher up-front cost than inlining,
  paid back the first time a second command needs the same behavior.
- **Negative / accepted.** The principle is a discipline, not (yet) a hard lint.
  A future lint could bound command-body size or flag inlined procedure; until
  then it is enforced in review.

## Alternatives considered

- **Fat commands (logic inline in `.md`).** Rejected: duplicates logic across
  siblings, balloons the files, and makes consolidation a rewrite instead of a
  fold.
- **Logic in commands, skills as thin pointers.** Rejected: inverts the reuse
  story — skills are the shared library; commands are the per-pack entry points.

## References

- [`ADR-043`](ADR-043-monorepo-collapse-to-src-domains.md) — flat shared skills/rules library.
- [`ADR-044`](ADR-044-command-naming-scheme-hyphenated.md) — command naming.
- [`command-clusters.md`](../contracts/command-clusters.md) — command justification + cluster contract.
- `tool-safety` / `runtime-safety` rules — no inlined credentials or free-form execution.
