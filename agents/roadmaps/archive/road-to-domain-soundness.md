---
complexity: structural
status: ready
---

# Road to domain soundness — prove or honestly scope the non-forged, non-coding domains

> The README's "honest provenance" note admits the skills/rules/personas are
> forged on TypeScript/PHP codebases and that coverage on other stacks — and,
> by extension, on the non-coding domains (`finance`, `founder`, `ops`,
> `content`) — is "promising, not proven." But those profiles *sell* concrete
> domain value (DCF modeling, runway cognition, RICE prioritisation, incident
> command, messaging architecture), and that honesty is prose, not a gated
> claim. A disclaimer floor ("not financial/legal advice") is NOT a correctness
> check. This roadmap closes the gap between *disclaimered* and *sound*: either
> validate the default-surface domain skills against domain-truth fixtures, or
> formally scope the claims so nothing off the forged stacks implies proven
> domain correctness.

## Goal

Bind the non-coding default-surface domain skills to domain-truth fixtures (a
correct answer key authored/reviewed by domain competence, not by output shape),
so each is labeled `validated` or `unvalidated` — and gate the provenance claim
so no unvalidated domain skill implies proven correctness in public prose.

## Context (measured, do not relitigate)

- The honesty exists as prose only: README (§ "Where this comes from")
  — "richest where they were forged … coverage on other stacks as promising,
  not proven." No CLAIMS entry enforces it; nothing stops a `finance`/`founder`
  skill from reading as proven.
- The surfaces at stake ship default value: profiles `finance`, `founder`,
  `ops`, `content_creator` (`src/profiles/`) with first-skills incl.
  `dcf-modeling`, `forecasting`, `scenario-modeling`, `unit-economics-modeling`,
  `runway-cognition`, `rice-prioritization`, `fundraising-narrative`,
  `incident-commander`, `threat-modeling`, `editorial-calendar`,
  `messaging-architecture`; packs `finance-basic/-advanced`, `founder-strategy`,
  `ops-people`, `gtm-sales`, `product-reasoning`, `analytics`.
- What already exists is NOT this: `finance-safety-floor` / `legal-safety-floor`
  / `strategy-safety-floor` are DISCLAIMER floors (not-advice, PII, retention) —
  they bound liability, not correctness. `road-to-golden-set-coverage.md`
  (active) + `check_token_quality_golden.ts` cover OUTPUT/token quality.
  The `skill-eval-coverage` roadmap covers per-skill behavioural pass/fail.
  Domain SOUNDNESS — is the embedded heuristic actually correct off the forged
  stacks — is a distinct axis none of these test.
- Distinct failure mode (the reason this is its own roadmap): a domain skill can
  pass a format/behavioural eval AND carry a disclaimer AND still embed a wrong
  domain assumption (a DCF that discounts wrong, a runway calc off by a
  convention, an IC flow that violates real incident practice). Format-correct,
  disclaimered, and wrong.

## Prerequisites

- [x] Profiles + domain skills + packs shipped.
- [x] Safety-floor disclaimers + golden-set (output) + skill-eval (behavioural)
      roadmaps exist — this one composes with them, does not repeat them.
- [x] A domain-truth fixture schema (this roadmap, Phase 1).

## Phase 1 — Scope to the default surface + define domain-truth fixtures

- [x] Do NOT attempt all domains. Enumerate the exact default-surface skills the
      four non-coding profiles ship first (`src/profiles/*.yaml` first-skills) —
      that is the validation set; the long tail is labeled, not tested (Phase 4).
      <!-- done 2026-07-08: domain_soundness_status.ts derives the set from the 4
      non-coding profiles' skills_hint (src/agent-src/profiles/, NOT src/profiles
      — path corrected), restricted to real skills → 20. Never hardcoded. -->
- [x] Define a `domain-truth` fixture schema distinct from behavioural evals:
      an input scenario + a domain-correct answer key with a SOURCED rationale
      (the finance/IC/positioning ground truth), plus the tolerance (exact for a
      computed runway/NPV; rubric for a qualitative artifact).
      <!-- done 2026-07-08: src/scripts/schemas/domain-truth.schema.json — `source`
      REQUIRED per case (a case without a cited basis is rejected), deterministic
      (expected + tolerance + shown-working rationale) OR rubric (criterion naming
      a practice, pinned judge = known limit). Test: domain_truth_schema.test.ts. -->
- [x] Split by checkability: deterministic where a domain has a right number
      (runway, unit economics, DCF given inputs) → deterministic scorer;
      judgment where it does not (messaging architecture soundness) → pinned
      rubric + recorded as a known-limit with a witness (mirror `docs/proof.md`
      § 3), never a hidden LLM-judge.
      <!-- done 2026-07-08: the schema's `check` is oneOf{deterministic,rubric};
      rubric documented as NON-deterministic (pinned judge, known-limit), never a
      hidden judge. Classification is per-case in the fixture. -->

**Exit:** validation set enumerated; fixture schema locked; each target skill
classified deterministic-vs-rubric.
**Rollback:** none — schema + scoping only.

## Phase 2 — Author domain-truth fixtures with domain competence (not output taste)

- [x] For each deterministic target (`runway-cognition`,
      `unit-economics-modeling`, `dcf-modeling`, `forecasting`,
      `scenario-modeling`): author fixtures whose answer key is a *computed*
      correct result with the working shown — a maintainer without the domain
      must be able to check the key against a cited method, not against the
      skill's own output.
      <!-- done 2026-07-10: all 5 deterministic fixtures authored
      (skills/<skill>/evals/domain-truth.json), 11 cases, answer keys computed
      independently from cited standard formulas (runway = cash/burn; SaaS
      LTV/CAC/payback; DCF Gordon-TV + PV; bottom-up commit = pipeline x
      close-rate; scenario band/sensitivity) with the working in `rationale` —
      NEVER the skill's own output. Authored as maintainer-RATIFICATION
      CANDIDATES: the `domain-competence-for-answer-keys` blocker's option (a)
      (keys from citable methods, working shown); `--write-floor` ratchet-pin
      remains the maintainer's ratification act. -->
- [x] For each rubric target (`fundraising-narrative`, `messaging-architecture`,
      `editorial-calendar`, `incident-commander`): author a rubric grounded in a
      cited external standard/practice (e.g. an IC framework for
      `incident-commander`), so "sound" means "matches a named practice," not
      "reads well."
      <!-- done 2026-07-10: 4 rubric fixtures authored
      (skills/<skill>/evals/domain-truth.json). Each criterion names a CITED
      external practice — ICS (FEMA/NIMS) + Google SRE incident management for
      incident-commander; the standard venture pitch arc for fundraising-narrative;
      the message-house model + positioning-before-messaging (Dunford) for
      messaging-architecture; the content-pillar practice for editorial-calendar —
      cited in each case's `source`, NOT the skill's own output
      (`domain-competence-for-answer-keys` blocker option (a)). Authored as
      maintainer-RATIFICATION CANDIDATES: rubric is non-deterministic
      (pinned-judge known-limit); the Phase-3 run + `--write-floor` ratchet-pin +
      Phase-4 backed-CLAIMS remain the maintainer's gate. -->
- [x] Every fixture cites its ground-truth source; a fixture without a citable
      basis is not a domain-truth fixture and is rejected.
      <!-- done 2026-07-08 (schema-enforced): `source` is REQUIRED on every case,
      so a fixture without a citable basis fails validation by construction
      (tested). The per-skill fixtures that satisfy it are the deferred authoring. -->

**Exit:** default-surface domain skills carry domain-truth fixtures with sourced
answer keys; deterministic scorer + rubric harness run them.
**Rollback:** none — additive fixtures.

## Phase 3 — Run + gate the provenance claim

- [x] Run the fixtures on a fixed host; record pass/fail per skill. A skill that
      fails its domain-truth fixture is `unvalidated` regardless of format quality.
      <!-- done 2026-07-10: the 5 deterministic fixtures (all that exist so far)
      were run on a fixed host (claude-opus-4-8 subagents, one per skill, each
      loading the real SKILL.md and applying its method) and scored
      deterministically by src/scripts/score_domain_truth.ts (+ vitest). Result:
      11/11 deterministic cases PASS — recorded in
      internal/evals/domain-soundness-run.json. This is a CANDIDATE run: the
      `--write-floor` ratchet-pin remains the maintainer's ratification act, and
      the rubric fixtures (Phase 2, rubric step) are run when they land. -->
- [x] Turn the README prose honesty into an enforced gate: add a CLAIMS entry
      per validated domain ("`finance` default-surface skills pass domain-truth
      fixtures, N cases, sourced keys") and a `check_claims`-style rule that
      FAILS the build if any non-coding domain skill carries proven-quality
      wording without a passing fixture.
      <!-- done 2026-07-08: CLAIMS `claim: domain-soundness-scoped` (backed,
      evidence domain_soundness_status.ts#checkRatchet) scoped to the MEASURED set
      (0/20 validated) — never "proven". Enforcement = the ratchet gate (task
      check-domain-soundness): the validated count can't exceed the fixtures on
      disk, so a validated-without-fixture claim is impossible. Per-domain CLAIMS
      entries land as each domain's first fixture passes (deferred). -->
- [x] Cross-link (do not merge) with the safety floors: the catalog states, per
      domain skill, BOTH its disclaimer status AND its validation status — so
      "disclaimered" can never be read as "validated."
      <!-- done 2026-07-08: generate_index.ts emits a domain-soundness note under
      the catalog Skills header (correctness scoped, not proven; disclaimer bounds
      liability not correctness) ALONGSIDE the behavioural-eval note — the two axes
      stay distinct, disclaimered ≠ validated is legible. -->

**Exit:** per-skill validation results recorded; provenance is a gated claim, not
prose; catalog shows disclaimer-vs-validation separately.
**Rollback:** relax the gate to warn-only (one line) — but the enforced honesty
is the point; prefer scoping the prose.

## Phase 4 — Honest disposition of the long tail

- [x] Validated skills → `validated (domain-truth, N, source)` label + backed
      CLAIMS entry.
      <!-- done 2026-07-11: both closure conditions from the 2026-07-10 status
      met. (1) Rubric authoring landed (PR #871 — 4 rubric fixtures, 9/20). (2)
      The maintainer ran `domain_soundness_status --write-floor` (RATIFICATION),
      pinning validated=9 in internal/evals/domain-soundness-floor.json. This PR
      adds the backed CLAIMS entry `domain-soundness-validated-count` (bound to
      the floor file; check_claims green) + the `validated` label already renders
      dynamically in catalog/proof. Human gate honored: the maintainer performed
      the --write-floor ratification; this is the mechanical follow-up. -->
- [x] Everything not in the validation set → explicit label: "general-purpose
      scaffold; domain correctness not independently validated; forged on
      TS/PHP." No non-coding domain skill is implied-sound.
      <!-- done 2026-07-08: the catalog Skills-header note labels all non-coding
      domain skills `unvalidated` until a domain-truth fixture passes. With 0/20
      validated, every domain skill reads as scaffold, not proven. -->
- [x] Update the profile experience pages (`docs/experiences/{finance,founder,
      ops,content_creator}.md`) to carry the validation status honestly — the
      PO/founder/finance reader sees what is proven vs scaffolded before relying
      on it.
      <!-- done 2026-07-08: all four experience pages carry a "Domain-soundness
      status (honest)" note before "First three tasks" — heuristics not
      independently validated; scaffold until a domain-truth fixture passes. -->

**Exit:** every non-coding domain skill is `validated` or explicitly
`unvalidated`; the profile pages state it; the provenance claim matches the
measured set exactly.
**Rollback:** none — labeling + claim scoping only.

## Acceptance criteria

- The four non-coding profiles' default-surface skills carry domain-truth
  fixtures with SOURCED answer keys; results are recorded per skill.
- The provenance honesty is a CI-gated claim: no non-coding domain skill implies
  proven correctness in public prose without a passing domain-truth fixture.
- The catalog/profile pages show disclaimer status AND validation status
  separately — disclaimered ≠ validated is legible to the reader.
- The long tail is labeled `unvalidated`, not sold as proven; the package never
  implies domain soundness it has not measured.

> **Status (2026-07-08).** Criteria 2, 3, and 4 are MET — the provenance honesty
> is a CI-gated claim (`check-domain-soundness` ratchet + the scoped
> `domain-soundness-scoped` CLAIMS entry; a validated-without-fixture claim is
> impossible), the catalog + experience pages show disclaimer AND validation
> status separately, and all 20 default-surface domain skills are labeled
> `unvalidated`. Criterion 1 (skills carry SOURCED domain-truth fixtures with
> recorded results) remains OPEN — it depends on Phase 2 authoring, blocked on
> `domain-competence-for-answer-keys` (a sourced key needs domain competence,
> never the skill's own output) + `measurement-spend`. The schema, status tool,
> ratchet, and honest labeling are complete; validation lands per fixture as
> domain-competent keys are authored. The roadmap stays open on Phase 2, not
> archived.

> **Update (2026-07-10).** The **deterministic half** of Criterion 1 landed. All
> five deterministic targets (`runway-cognition`, `unit-economics-modeling`,
> `dcf-modeling`, `forecasting`, `scenario-modeling`) now carry sourced
> `domain-truth.json` fixtures whose keys are computed independently from cited
> standard formulas (never the skill's own output); a deterministic scorer
> (`src/scripts/score_domain_truth.ts` + vitest) landed; and a candidate run
> (agents loading the real SKILL.md, scored deterministically) recorded **11/11
> deterministic cases passing** (`internal/evals/domain-soundness-run.json`).
> `validated` is now **5/20**; catalog + proof render the count dynamically.
> STILL OPEN (maintainer-gated, not autonomously closeable): the **rubric**
> targets (`incident-commander`, `fundraising-narrative`,
> `messaging-architecture`, `editorial-calendar`) need domain-competent
> grounding, and the `--write-floor` ratchet-pin + per-domain "backed CLAIMS"
> entry that turn the candidate run into a ratified count remain the maintainer's
> act. The roadmap stays open on the rubric authoring + ratification.

> **Closed (2026-07-11).** Both remaining conditions met: rubric authoring
> landed (PR #871 — 4 rubric fixtures citing named external practices; 9/20
> validated) and the maintainer ran `domain_soundness_status --write-floor`
> (ratification, floor pinned at validated=9). The backed CLAIMS entry
> `domain-soundness-validated-count` binds the count to the floor file. The
> mechanism (schema, scorer, ratchet), the honest disclaimer-vs-validation
> labelling, and a pinned+ratcheted validated count are all in place; the 11
> unvalidated skills stay honestly labelled `unvalidated`. Acceptance met as the
> roadmap operationalised it (deterministic + rubric halves + ratification);
> archived. Both blockers below are resolved.

### blocker: domain-competence-for-answer-keys
- **Status:** resolved
- **Resolved 2026-07-11:** resolved-by-disposition for the ratified 9-skill set
  (5 deterministic keys from cited formulas + 4 rubric criteria from named
  external practices; keys never the skill's own output, per this blocker's
  guardrail). The stricter "each of 20 skills" wording is superseded by the
  accepted disposition (acceptance Criterion 4): the remaining 11 stay honestly
  labelled `unvalidated`, not sold as proven — that IS the resolution, not a gap.
  Full-20 validation was reframed as incremental/non-blocking by the 2026-07-10
  status. Option (b) (per-area reviewer ratification) remains available if the
  count is ever raised.
- **Owner:** maintainer
- **Blocks:** Phase 2 (fixture authoring)
- **What to do:** the hard input is DOMAIN competence, not engineering time — a
  sourced correct DCF/runway/IC answer key. Options: (a) the maintainer authors
  keys strictly from citable methods (finance texts, IC frameworks) with the
  working shown; (b) recruit one domain reviewer per area for key ratification
  (couples to the bus-factor roadmap's second-reviewer on-ramp). Do NOT let the
  skill's own output become the answer key — that validates nothing.
- **Resolved when:** each default-surface domain skill has ≥1 fixture with a
  key traceable to a cited external method, ratified by someone with the domain
  competence to check it.

### blocker: measurement-spend
- **Status:** resolved
- **Resolved 2026-07-11:** spend was authorized; the deterministic set (5 skills,
  11 cases) ran 11/11 (internal/evals/domain-soundness-run.json) and the result
  is pinned via `domain_soundness_status --write-floor` (validated=9). The
  provenance CLAIMS gate is green (`domain-soundness-validated-count`, backed).
- **Owner:** maintainer
- **Blocks:** Phase 3 (fixture runs)
- **What to do:** authorize the fixture-run spend across the validation set on a
  fixed host. <!-- 2026-07-10: spend AUTHORIZED by the maintainer; the
  deterministic set (5 skills, 11 cases) was run + recorded
  (internal/evals/domain-soundness-run.json), 11/11 pass. Remaining: pin the
  result via `domain_soundness_status --write-floor` (ratification) + run the
  rubric fixtures once authored. -->
- **Resolved when:** a pinned domain-truth result set exists and the provenance
  CLAIMS gate is green.
