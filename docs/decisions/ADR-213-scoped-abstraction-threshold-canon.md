---
adr: 213
status: accepted
date: 2026-08-03
decision: scoped-abstraction-threshold-canon
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopen when a fifth artifact class needs its own bar, when agent-trace
  evidence shows scoped per-class rules being misapplied in practice
  (the council flagged this as the unmeasured risk of scope-differentiation),
  or when the code-level base bar itself is challenged with new evidence.
---

# ADR-213 — Extraction thresholds are a scoped per-class canon, not one number

## Status

**Accepted** · 2026-08-03.

## Context

Four shipped artifacts stated four different numeric thresholds for when to
extract a repeated structure, with no scope tags and no cross-references:

- `src/rules/architecture.md` + `docs/guidelines/component-oriented-and-oop-development.md` — "two real repetitions before you extract"
- `src/skills/fe-design/SKILL.md` — "Extract when used 3+ times"
- `src/skills/ui-component-architect/SKILL.md` — "≥4 repeats AND real state", including the sentence "One or two repeats … is not a component", which literally negates the rule's "two"
- `src/skills/tailwind-engineer/SKILL.md` — "Extract only when duplicated ≥ 3 times"

All four can load into one agent context simultaneously; an agent cannot
comply with all of them. Separately, `minimal-safe-diff-mechanics` records a
settled decision that the code-level bar is the **second** real repetition and
that the borrowed "Rule of Three" was not adopted — a lock the UI skills were
silently forking.

## Decision

1. **The thresholds are deliberately different bars for different artifact
   classes** — extraction cost scales with the artifact (pure helper ≪
   stateful component), so the bar scales with it. This is scope
   differentiation, not drift.
2. **The canon lives in ONE place**: [`docs/guidelines/abstraction-thresholds.md`](../guidelines/abstraction-thresholds.md)
   (code-level 2 · UI shell 3+ · stateful component ~4 + real state ·
   utility-class string ≥ 3). Every other site keeps its number but names its
   artifact class and cites the canon.
3. **The settled code-level lock stays** — this ADR scopes it, it does not
   overturn it: 2 remains the operative bar for code-level abstraction; the UI
   rows are carve-outs above it, never a license to lower it.
4. **Drift is machine-checked**: `src/scripts/lint_abstraction_thresholds.ts`
   (CI gate, registered in `gate-coverage.yml`) fails on any numeric extraction
   threshold outside the canon's allowlisted sites, and on any allowlisted site
   whose number silently changes; `tests/scripts/lint_abstraction_thresholds.test.ts`
   pins the canon rows.
5. **No consumer settings key** for the thresholds — they are artifact-class
   invariants, not team preferences (council: unanimous YAGNI).
6. **Companion fix**: `architecture.md` "apply modern standards to new code
   only" now cross-references the [`active-remediation`](../../src/rules/active-remediation.md)
   ladder, which governs modernizing existing touched code — the two defaults
   no longer read as contradictory.

## Consequences

- Agents loading rule + guideline + UI skills receive one coherent, scoped
  instruction set instead of contradictory numbers.
- A future edit that introduces or changes a bare threshold fails CI instead
  of silently forking the canon again.
- The known residual risk (council round 2): scoped conditional rules can be
  misapplied by weaker agents — the concrete per-class tags in the canon table
  are the mitigation; trace evidence of misapplication is the reopen trigger.

## Alternatives considered

- **One unified number everywhere (Option A)** — rejected: consistent but
  wrong; a stateful component extraction legitimately costs more than a helper
  extraction and deserves a higher bar (council: unanimous).
- **Drop all numbers, qualitative only (Option C)** — rejected: agents lose a
  crisp, checkable heuristic; ambiguity in exactly the situations the numbers
  exist to resolve.
- **Expand `component-oriented-and-oop-development.md` instead of a new
  guideline** — rejected: that guideline covers *how* to structure; extraction
  *timing* is orthogonal and the canon must stay small enough to cite whole.

## References

- [`docs/guidelines/abstraction-thresholds.md`](../guidelines/abstraction-thresholds.md) — the canon.
- Council session 2026-08-03 (claude-sonnet-4-5 + gpt-4o, unanimous on Option B, the canon home, lint+test, no settings key, one-line cross-ref).
- [`minimal-safe-diff-mechanics`](../guidelines/agent-infra/minimal-safe-diff-mechanics.md) — the settled code-level lock this ADR scopes.
