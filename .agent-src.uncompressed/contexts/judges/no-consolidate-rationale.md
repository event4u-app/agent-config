---
audience: maintainers
status: stable
stability: stable
purpose: >
  Locked decision rationale for Phase 3a of the
  road-to-structural-optimization roadmap. The four `judge-*` skills
  are intentionally **not** consolidated under a shared procedure
  context. Future maintainers reading this file should not retry the
  pattern without invalidating the data here.
---

# Why `judge-*` skills are NOT consolidated

The Phase 3a spike on the road-to-structural-optimization roadmap
(see `agents/roadmaps/archive/road-to-structural-optimization.md` § 3a)
evaluated extracting a shared procedure file
(`contexts/judges/judge-shared-procedure.md`) loaded by all four
`judge-*` skills. The locked Q1=A shape (separate skills + shared
procedure context) was implemented and benchmarked. **Outcome: net
LOC negative.** The pattern is rejected for this family.

## The numbers

Spike measurements on `judge-test-coverage` (the smallest persona,
chosen per roadmap 3a.0):

| State | Skill LOC | Shared LOC | Total per family of 4 |
|---|---|---|---|
| Baseline (4 separate) | 153 + 157 + 157 + 166 = **633** | 0 | 633 |
| Slim attempt #1 | 138 | 134 | 4 × 138 + 134 = 686 ❌ |
| Slim attempt #2 (aggressive) | 133 | 117 | 4 × 133 + 117 = 649 ❌ |

The success-criteria threshold from the roadmap (≥ 30 % per-skill
LOC reduction) maps to 153 → ≤ 107 for `judge-test-coverage`. The
aggressive attempt landed at 133 — a 13 % reduction. To go further,
each skill would have to surrender persona-specific content (analysis
rubric, anti-pattern list, severity definitions, scope-boundary Do
NOTs) — exactly the content that makes each persona reviewable.

## Why the math doesn't work

A judge skill is **not** procedurally complex. Its value is the
persona surface:

- a 6–11 row analysis table tailored to the lens (correctness, security,
  test gaps, code quality)
- a list of persona-specific anti-patterns and gotchas
- a severity legend with thresholds calibrated to the lens
- scope-boundary Do NOTs that route to sibling judges

Procedural overhead (verdict semantics, validation scaffold,
output-format frame, runtime boundary, model fallback) is small in
absolute terms — extracting it adds a context file but only saves
~15–25 LOC per skill. With four skills, the per-skill saving is
amortized against the shared file once; below five or six skills,
the structural tax dominates.

The same argument applies to procedural duplication in any small
skill family where the procedural skeleton is short and the persona
table is the bulk of the file.

## Decision

Phase 3a is closed with status **DO NOT CONSOLIDATE**. The four
`judge-*` skills remain separate, self-contained, and free of
`load_context:` indirection. Each skill's "Procedure" section carries
its full procedural body inline. This trades minor maintenance
duplication for full persona isolation and zero structural tax.

Phase 3b (`project-analysis-*`, 8 skills, 959 LOC) and Phase 3c
(`skill-*`, 4 skills, 782 LOC) **continue independently** per the
roadmap's "3b/3c continue independently" abort note. The math there
is more favorable: 8 stack-specific analysis skills share a much
larger procedural skeleton (project discovery, version resolution,
docs loading, architecture mapping) than 4 judge skills do.

## Reopening conditions

Reopen this decision **only** if at least one of these holds:

1. The `judge-*` family grows to ≥ 6 skills (procedural amortization
   crosses break-even).
2. A new persona-orthogonal procedural step is introduced that all
   judges must execute identically (e.g. a CI-integrated verdict
   reporter), and that step is non-trivial (≥ 30 LOC).
3. The success-criteria threshold in
   `road-to-structural-optimization.md` § 3a is renegotiated to a
   lower per-skill LOC bar (with explicit justification — the 30 %
   bar exists because anything less is structural noise).

Until one of those holds, treat any "let's extract shared procedure
across the judges" proposal as a regression and cite this file.

## See also

- [`road-to-structural-optimization`](../../../agents/roadmaps/road-to-structural-optimization.md)
  § Phase 3a — the spike that produced this decision.
- [`persona-voice-rubric`](persona-voice-rubric.md) — the voice
  preservation rubric used during the spike (still applies if Phase
  3b or 3c needs the same check).
- Sibling judges, all kept inline:
  [`judge-bug-hunter`](../../skills/judge-bug-hunter/SKILL.md),
  [`judge-code-quality`](../../skills/judge-code-quality/SKILL.md),
  [`judge-security-auditor`](../../skills/judge-security-auditor/SKILL.md),
  [`judge-test-coverage`](../../skills/judge-test-coverage/SKILL.md).
