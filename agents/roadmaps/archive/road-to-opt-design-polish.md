---
status: ready
complexity: lightweight
---

# Road to opt design polish — consolidate the slop canon, close the states gap

> **Un-parked 2026-07-11 on the maintainer's explicit exclusive request**
> (the resume trigger the parked note reserved). Executing now.

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). A source-level
> comparison against a reconstructed design-harness prompt and a leaked
> design-canvas profile confirmed our design cluster is broader and mostly
> stronger (corpus-grounded selection, deterministic slop linter, WCAG
> depth) — wholesale adoption is rejected. Three narrow mechanisms and one
> principle survive the comparison.

## Goal

One canonical AI-slop trope catalog cited by both the mechanical linter
and the judgment skills, an interaction-states completeness pass, a
parallel polish aggregation (only if the current review runs serially),
and the "ask before adding material" principle folded into design
fidelity.

## Prerequisites

- Design-corpus vendoring locks stay closed (archive: design-mechanism
  harvest — palette/font/easing vendoring rejected by council; nothing
  here reopens them).

## Provenance

Sources referenced anonymously per `source-confidentiality`; real links
retained encrypted:

- Source A (design-harness reconstruction): `ENC1:IFja8Tn00mu2A3KCl6qThuPeF3xQLo559KVP6lsVK/ieVxE3GQH01pbqwRtQMDoWKALML5XXGAFivH5NaCCd4Gqv3CaBE1Gpf1YUvFZDAk8AYm9x3B6mQXyimyVJ5kppTJndWXf5jyQ+7f0oOz2QJ/cC7E4xV25UgQ==`
- Source B (leaked design-canvas profile): `ENC1:AtE+jtEKxbFoG71WG7uALX049s2/EnHhPgO8ZFbUXELDvCvYINu8DYvyNBvrhMtB6631vB27BRkW51BZZcZQSVN8YTrVMWXwuHmdMuVb78xbQ/v1ro7HGnDoweCWMSJwTdcjlsjA8FJPxbgnKNINik0WQ8qp2sILqjFHTc1Wq+NXi6tDCXaemBG/cHQsTatPy00Iqq4=`

## Phase 1 — canonical AI-slop trope catalog (S)

Our slop knowledge is scattered across at least four skills plus the
deterministic linter. Source A names the tropes more sharply — including
the current-generation tell: warm editorial (cream + serif + terracotta)
is today's default-template signature, exactly as purple gradients were
the previous generation's.

- [x] Create ONE canonical trope catalog (single reference file in the
      design cluster): silent default fonts as tells, the default-SaaS
      card signature (radius + accent-border combos), decorative emoji,
      the warm-editorial tell, plus the tropes already encoded in
      `lint_design_slop.ts` and the design skills.
      <!-- done: the catalog already existed — docs/guidelines/design-antipatterns.md (V/T/C/L/M/CP/Q ID scheme + ownership table). All named tropes present (T7 fonts, V1/V3/V8 card signature, CP5 emoji, C5 warm-editorial). Extended, not recreated. -->
- [x] Point `lint_design_slop.ts` (mechanical layer) and the judgment
      skills (`design-intelligence`, `fe-design`, `design-review`) at the
      catalog instead of restating fragments — one source of truth, two
      enforcement layers.
      <!-- done: linter already cites via catalogId; design-review already cites. Collapsed the duplicated inline first-impulse tell-lists in design-intelligence (was 5 hardcoded tells) and fe-design (was 5) to catalog-ID citations. -->
- [x] Keep the catalog generation-dated: tells rotate as model defaults
      rotate; the file carries a "current-generation tells" section with
      a review trigger, not timeless claims.
      <!-- done: added "## Current-generation tells (generation-dated — review 2026-Q4)" naming warm-editorial (C5+T2+T7) as this generation, gradient-dark (C1+C2) as previous, with a rotate-review trigger. -->


**Exit criteria:** catalog exists; ≥ 2 skills + the linter cite it;
duplicated trope prose removed from the citing skills.

## Phase 2 — interaction-states completeness pass (S)

- [x] Verify overlap first: does `design-review`'s existing audit already
      cover the six interaction states (default / hover / active /
      disabled / focus / loading) with timing bands? If yes, tighten that
      section and stop — no new skill.
      <!-- done: gap confirmed — design-review Phase 1 had loose bullets covering 5/6 states (no explicit "default"), no timing bands (those lived only in fe-design § Motion); accessibility-auditor had no 6-state checklist. -->
- [x] If a real gap remains: add the 6-state checklist (+ transition
      timing bands 0.15–0.3 s micro / 0.3–0.5 s structural) to the
      narrowest existing surface (`design-review` or
      `accessibility-auditor` § focus), never as a new standalone skill.
      <!-- done: replaced design-review Phase 1's loose bullets with a structured 6-state checklist (adds explicit "default"). Timing references fe-design § Motion as the single source of truth instead of introducing the roadmap's rougher band set as a competing third authority; reduced-motion (M5/Q4) noted. No new skill. -->


**Exit criteria:** every UI-review path asserts the six states exactly
once (no duplicate checklist across skills).

## Phase 3 — parallel polish aggregation (S, conditional)

- [x] Check how `design-review` sequences its passes today. If serial:
      adopt the parallel-4 aggregation shape — a11y + slop + hierarchy +
      states fan out (subagents where available), findings dedupe into a
      Blockers / Quality / Polish triage. If already parallel or the
      review is cheap enough serially, record the no-op decision inline.
      <!-- decision: NO-OP (documented in design-review § Async-verifier pattern). Passes are serial but NOT cleanly 4-way independent (shared live browser session; later phases depend on earlier navigation), and the expensive browser-probing is already offloaded by the async verifier — the fan-out's main win is already captured. Reconsider trigger recorded: standalone heavy batch over many independent surfaces. -->


**Exit criteria:** decision recorded; if adopted, the fan-out uses the
existing orchestration surface (no new runtime).

## Phase 4 — fidelity principle + follow-up flags

- [x] Fold the "ask before adding material — no filler content the user
      didn't request" principle as one line into `design-fidelity.md`
      (it already gates omissions/additions; this names generated filler
      explicitly).
      <!-- done: added a bullet to design-fidelity § Asset & imagery discipline naming unrequested filler explicitly. -->
- [x] Record the async silent-verifier-subagent pattern (background
      verifier owns UI verification via screenshots; main agent forbidden
      from self-checking; silent on pass) as a LOW-PRIORITY candidate in
      the subagent-harvest roadmap's live-app judge item — needs real
      screenshot tooling; do not build here.
      <!-- done: subagent-harvest roadmap is archived; recorded the candidate in its durable descendant — subagent-orchestration § 8 do-with-live-app-judge (low-priority, gated on real screenshot tooling + verdict_changed_outcome evidence). -->


## Acceptance criteria

- No design-corpus vendoring reopened; no new standalone skill unless the
  Phase-2 overlap check proves a gap.
- The trope catalog is the single source both enforcement layers cite —
  grep shows no remaining duplicated trope lists.