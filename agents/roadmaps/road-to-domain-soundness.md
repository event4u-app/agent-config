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

- [ ] For each deterministic target (`runway-cognition`,
      `unit-economics-modeling`, `dcf-modeling`, `forecasting`,
      `scenario-modeling`): author fixtures whose answer key is a *computed*
      correct result with the working shown — a maintainer without the domain
      must be able to check the key against a cited method, not against the
      skill's own output.
      <!-- OPEN — blocked on `domain-competence-for-answer-keys`. Schema + status
      tool + ratchet + honest labeling are landed; a SOURCED correct key needs
      domain competence and must NOT be the skill's own output. Left open, not
      cancelled. -->
- [ ] For each rubric target (`fundraising-narrative`, `messaging-architecture`,
      `editorial-calendar`, `incident-commander`): author a rubric grounded in a
      cited external standard/practice (e.g. an IC framework for
      `incident-commander`), so "sound" means "matches a named practice," not
      "reads well."
      <!-- OPEN — same `domain-competence-for-answer-keys` block; the rubric must
      name a cited practice, which needs domain competence to ground. -->
- [x] Every fixture cites its ground-truth source; a fixture without a citable
      basis is not a domain-truth fixture and is rejected.
      <!-- done 2026-07-08 (schema-enforced): `source` is REQUIRED on every case,
      so a fixture without a citable basis fails validation by construction
      (tested). The per-skill fixtures that satisfy it are the deferred authoring. -->

**Exit:** default-surface domain skills carry domain-truth fixtures with sourced
answer keys; deterministic scorer + rubric harness run them.
**Rollback:** none — additive fixtures.

## Phase 3 — Run + gate the provenance claim

- [ ] Run the fixtures on a fixed host; record pass/fail per skill. A skill that
      fails its domain-truth fixture is `unvalidated` regardless of format quality.
      <!-- OPEN — blocked on `measurement-spend`: needs authorized fixture-run
      spend on a fixed host. Moot until Phase 2 authors fixtures; the ratchet +
      status tool are ready to record results the moment fixtures land. -->
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

- [ ] Validated skills → `validated (domain-truth, N, source)` label + backed
      CLAIMS entry.
      <!-- OPEN — 0/20 validated today (Phase 2/3-run deferred): nothing to label
      `validated` yet. The mechanism is built (domain_soundness_status marks a
      skill validated once its domain-truth fixture is present + passing); flips
      as the first fixture lands. -->
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

### blocker: domain-competence-for-answer-keys
- **Status:** open
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
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 (fixture runs)
- **What to do:** authorize the fixture-run spend across the validation set on a
  fixed host.
- **Resolved when:** a pinned domain-truth result set exists and the provenance
  CLAIMS gate is green.
