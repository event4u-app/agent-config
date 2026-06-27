---
complexity: structural
status: ready
---

# Road to artifact-completeness scoring rubrics

> Give AC a **unified rubric layer** that scores produced artifacts —
> roadmaps, PR reviews, architecture decisions, tickets — against their
> acceptance criteria **plus the dimensions the current code-focused judges
> miss**: risk, tests, migration effort, maintainability. Reuse the existing
> judge-harness + council consensus-scoring; **build no new scorer**. Score and
> surface gaps; **never auto-gate** an artifact on a number.

## Goal

Replace "best artifact by feel" with an explicit, reusable rubric per artifact
type, so a roadmap/PR/ADR/ticket is scored on **completeness against acceptance
criteria + risk + tests + migration + maintainability**, with the score and the
*specific missing dimensions* surfaced to the human. This is the one verified,
low-regret addition distilled from a second external read — and it converges
with the internal council's standing line: **rubric-based judging, never a
verbosity/length scorer.**

## Context

A second-opinion read proposed an orchestration track (model-racing + judge +
scoring). Repo verification showed ~80% already shipped — `subagent-orchestration`
(`do-competitively`, `judge-with-debate`), `ai-council` (fan-out → consensus →
synthesis), and four `judge-*` skills. The **only** non-redundant residue worth
a track is this: the existing judges are **code-focused** (`judge-code-quality`,
`judge-bug-hunter`, `judge-security-auditor`, `judge-test-coverage`); there is no
unified **artifact-completeness** rubric for non-code deliverables (roadmaps,
PR-as-artifact, ADR/architecture, tickets) that scores acceptance-criteria fit +
risk/tests/migration/maintainability.

Both opinions reject the same things: the verbosity/length scorer (length-biased
46.7% in the source), anti-refusal axes, and any offensive content. This track
inherits those rejects.

## Relationship to siblings

- Shares the **judge-calibration sliver** with
  [road-to-injection-defense-pressure-corpus.md](road-to-injection-defense-pressure-corpus.md)
  (its Phase 2.2): synthetic monotonicity + strict quality-tier ordering +
  gold-slice rank correlation (Spearman / Cohen's κ). Build the sliver once;
  both tracks consume it. Whichever track reaches it first owns the build; the
  other references it.
- Reuses existing format contracts as the "what good looks like" anchors:
  `emit-tickets`, `adr-create`, `decision-record`, `estimate-ticket`,
  `rice-prioritization`, `roadmap-management`/`roadmap-writing`.

## Do-not-build (inherited + track-specific)

- [-] **No verbosity / length scorer** — completeness ≠ length; the source's
  length-dominated scorer is the anti-pattern this track exists to avoid.
- [-] **No new standalone scorer/judge engine** — extend the existing
  judge-harness + council consensus-scoring; duplicating them is rebuild.
- [-] **No auto-gate** — a low score surfaces gaps and a recommendation; it never
  blocks/auto-rejects an artifact. Human decides (per `user-interaction`).
- [-] **No anti-refusal / offensive axes.**

## Prerequisites

- Existing skills in scope: `judge-code-quality` (+ siblings), `ai-council`
  (consensus-scoring), `roadmap-management`, `refine-ticket`/`estimate-ticket`,
  `code-review`/`requesting-code-review`, `adr-create`/`decision-record`.
- Rubric contract: each rubric = a small, versionable schema of **named
  dimensions** with a per-dimension criterion and weight, an
  **acceptance-criteria-fit** dimension, and the four cross-cutting dimensions
  (**risk, tests, migration effort, maintainability**). Output = per-dimension
  score + named gaps, never a single opaque number.

## Automation & human gates

- Schema authoring (Phase 1) is fully in-session — no model API.
- Any billable judge/council scoring run is **human-gated**, consistent with
  prior eval discipline.
- No `task ci` / full-pipeline steps scheduled; verify with the narrowest tool.

## Phase 1 — Rubric schemas (deterministic, no API)

Define the dimension sets per artifact type. Anchor each dimension on an existing
format contract so the rubric measures *real* completeness, not a guess.

- [x] **1.1 `roadmap-score`** — dimensions: acceptance-criteria-fit, phase
  decomposition, risk, tests/verification per step, migration effort,
  maintainability/owner, do-not-build clarity. Anchor: `roadmap-management` /
  `roadmap-writing` conventions.
- [x] **1.2 `pr-review-score`** — dimensions: evidence-fit (claims traced to
  diff), concrete fixes vs vague notes, risk/blast-radius, test coverage of the
  change, migration/rollback, maintainability. Anchor: `code-review` /
  `requesting-code-review` / `receiving-code-review`.
- [x] **1.3 `architecture-score`** — dimensions: decision clarity, alternatives
  considered, consequences, risk, reversibility/migration, maintainability,
  ADR-format completeness. Anchor: `adr-create` / `decision-record`.
- [x] **1.4 `ticket-quality-score`** — dimensions: acceptance-criteria present,
  DoR, estimate/sizing, risk, test plan, dependencies, maintainability. Anchor:
  `refine-ticket` / `estimate-ticket` / `emit-tickets`.
- [x] **1.5 Schema review** — confirm every rubric carries the four cross-cutting
  dimensions (risk, tests, migration, maintainability) + acceptance-criteria-fit;
  confirm no length/verbosity dimension leaked in. Verify by inspection against
  the Do-not-build list.

## Phase 2 — Wire rubrics into the existing judge + calibrate

Reuse, don't rebuild. The rubric is *data* the existing judge/council consumes.

- [x] **2.1 Adapter into judge-harness / council** — feed a rubric schema to the
  existing judge (or council consensus-scoring) so it returns per-dimension
  scores + named gaps. No new engine. Verify: a sample artifact returns a filled
  rubric, not a single number.
- [x] **2.2 Calibrate via the shared sliver** — run the judge-calibration sliver
  (monotonicity: degrading one dimension lowers that dimension's score;
  strict-tier ordering across hand-built EXCELLENT→TERRIBLE artifacts; per-axis
  ablation to confirm no single dimension dominates). Add a small **gold slice**
  (hand- or council-labelled artifacts) and report **rank correlation**
  (Spearman / κ) of rubric vs gold. Build the sliver here only if the sibling
  pressure-corpus roadmap has not already built it.
- [x] **2.3 Anti-length guard** — explicitly verify (via the ablation) that a
  longer artifact does not score higher *ceteris paribus*; if length correlates,
  it is a calibration bug to fix, per the Do-not-build list.

## Phase 3 — Integrate at the point of production (optional, surfacing-only)

Offer the rubric as a scoring pass where artifacts are produced — never as a gate.

- [x] **3.1 Roadmap pass** — `roadmap-create` / `roadmap-management` can run
  `roadmap-score` and surface gaps; human decides. Verify on an existing roadmap.
- [x] **3.2 Review pass** — `code-review` / `requesting-code-review` can run
  `pr-review-score`; surfaces evidence-fit + missing risk/test dimensions.
- [x] **3.3 Ticket pass** — `refine-ticket` / `estimate-ticket` can run
  `ticket-quality-score` against DoR before emit.
- [x] **3.4 ADR pass** — `adr-create` / `decision-record` can run
  `architecture-score`.
- [x] **3.5 Surfacing discipline** — every integration emits *score + named gaps
  + recommendation* and hands the decision to the human (no auto-gate, no
  auto-reject). Verify the surfacing shape against `user-interaction`.

## Acceptance criteria

- Four rubric schemas exist, each carrying acceptance-criteria-fit + risk + tests
  + migration + maintainability, with **no** length/verbosity dimension.
- The rubrics run through the **existing** judge/council (no new scorer), and the
  scorer is calibrated (monotone, strictly tier-ordered, length-neutral, with a
  reported gold-slice rank correlation).
- At least one production integration surfaces score + named gaps to the human
  without auto-gating.
- The Do-not-build list is honoured: no verbosity scorer, no new engine, no
  auto-gate, no offensive axes.
