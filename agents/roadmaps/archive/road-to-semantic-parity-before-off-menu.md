---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Archiving is wrong (the defect is live and unowned), parking repeats the failure (the parked menu-economy roadmap already carries the verify line this corrects, and carrying it wrong is the defect), and merging into that file is blocked because it is parked on five unmoved entry conditions this work does not touch."
relates:
  - slug: road-to-skill-menu-economy
    relation: extends
---
# Road to semantic parity before off menu

> **Source:** `agents/tmp.old/inbox-2026-09-ab/t07/` — an external multi-loop
> planning session over the skill-reachability surface, delivered as a
> transcript plus four plan revisions.

## Goal

A byte-equal skill body is not a complete delivery proof, and one parked
roadmap's completeness verify currently says it is. The MCP-lite carrier
`ContentEntry` (`src/cli/mcp/content.ts:30-44`) transports exactly eight
fields — `name`, `description`, `body`, `source`, `kind`, `mime_type`,
`personas`, `trigger_text`. Every host-level runtime semantic a skill can
declare travels in none of them. So a proof of the form "`read_skill` returns
a body byte-equal to the projected file" can pass while the skill arrives
stripped of the semantics that decide how it executes. This roadmap makes that
gap measurable and turns it into an eligibility precondition, so that no future
menu-exclusion step can be discharged by a proof that never looked.

Falsifiable: after Phase 2, a fixture skill declaring a runtime semantic outside
the eight carried fields must fail the parity check, and a skill declaring none
must pass it.

## Phase 1 — Census the gap

- [x] **1.1 Enumerate the declared-but-uncarried semantic set.** Diff the
      `ContentEntry` field list against the skill frontmatter schema's declared
      properties, and emit the difference as a generated report under
      `agents/evidence/analysis/`. No verdict, no threshold — the report states
      per field whether the MCP-lite carrier transports it.
      verify: `diff` of the report against a re-run is byte-equal; every field
      in `src/scripts/schemas/skill.schema.json` appears in exactly one column
      Done 2026-09-29. Generator: `src/scripts/semantic_parity_census.ts`, report
      `agents/evidence/analysis/semantic-parity-census.md`, pinned to `3671542d0`. Both
      limbs, with output: · **byte-equal** — written twice, `diff run1 run2` returns
      nothing; the report pins the commit and carries no wall-clock date, so re-runs at
      one commit cannot differ. · **exactly one column** — 38 declared properties split
      4 carried / 1 partial / 33 dropped, and 4+1+33 = 38. The split is derived from the
      carrier source (`buildEntry` reads `fm.name`, `fm.description`, `fm.source`,
      `fm.personas`; `triggerText` keeps only `INDEXED_TRIGGER_KEYS`), never from the
      schema, so `dropped` is the remainder and the three are total and disjoint by
      construction. Per Risk 2 the report header names the one carrier it measured.

- [x] **1.2 Count the corpus against that set.** Per skill, which uncarried
      semantics it actually declares today. This is the number that says whether
      the gap is theoretical or live.
      verify: the report's total equals `ls src/skills/*/SKILL.md | wc -l`; the
      per-field counts reproduce under a second run
      Done 2026-09-29. Both limbs, with output: · **total** — the report reads
      `299 file(s)` and `ls src/skills/*/SKILL.md | wc -l` returns 299. · **reproduce** —
      the second run is byte-equal to the first, per-field counts included. The gap is
      **live, not theoretical**: `domain`, `model_tier`, `packs` and `workspaces` are each
      declared by all 299 skills, and **299 of 299 declare at least one semantic the
      carrier does not transport whole**.

## Phase 2 — Make it an eligibility predicate, not a paragraph

- [x] **2.1 Add a `body-portable` predicate over the census.** A skill is
      body-portable when it declares no semantic the carrier drops. The
      predicate is a pure function over parsed frontmatter, with a fixture
      directory holding one portable and one non-portable case. It decides
      eligibility only; it marks nothing and excludes nothing.
      verify: the non-portable fixture returns false and the portable one true;
      a fixture declaring an unknown key returns false, not true
      Done 2026-09-29. Predicate: `isBodyPortable` in `src/scripts/_lib/body_portable.ts`
      — pure, reads nothing, depends only on its argument and the two carrier constants.
      Fixtures: `tests/scripts/fixtures/body-portable/{portable,non-portable,unknown-key}/SKILL.md`.
      Tests: `tests/scripts/body_portable.test.ts`, 10 passed. Every limb: · **portable →
      true**, · **non-portable → false** (and `classifyPortability` names `execution` and
      `model_tier` rather than only refusing), · **unknown key → false, not true** — it
      falls to the dropped branch, which is the fail-closed direction; asserting
      portability for a key whose carrier behaviour is unestablished would be a claim from
      ignorance. `triggers` is `partial`, so declaring it alone already fails.
      **Sensitivity checked, not assumed:** neutralising the fail-closed branch turned
      exactly the two unknown-key tests red (2 failed / 8 passed) and the predicate was
      restored from a copy, not from `git checkout`. The predicate decides eligibility
      only: it marks nothing, excludes nothing, and nothing in the tree consumes it as an
      exclusion trigger (Risk 1).

- [x] **2.2 Bind the predicate into the parked roadmap's completeness verify.**
      `agents/roadmaps/later/road-to-skill-menu-economy.md` records that
      byte-equality is necessary and not sufficient, and names this predicate as
      the missing limb. Text-only edit to a parked file; no step is added and no
      plan changes.
      verify: the parked file's completeness verify cites the predicate by path;
      `lint_roadmap_*` stays green
      Done 2026-09-29. Text-only edit to `agents/roadmaps/later/road-to-skill-menu-economy.md`,
      under owner ruling E5 where the completeness invariant ("no skill leaves the
      install") is asserted. The added paragraph records that byte-equality is necessary
      and **not** sufficient, cites `src/scripts/_lib/body_portable.ts` by path and the
      census by path, and carries the measured 4/1/33 split and the 299-of-299 figure. No
      step was added, no checkbox moved, and no plan changed.

## Acceptance criteria

- The uncarried-semantic set is a generated artifact, not a sentence, and
  reproduces byte-equal.
- A fixture declaring a dropped semantic fails the predicate.
- No skill is marked, excluded, or modified by this work.
- The parked roadmap's completeness proof no longer reads as sufficient on
  byte-equality alone.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-29 | reviewer: agent -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The predicate becomes read as a permission to exclude | product | `body-portable` returns a boolean over every skill, and a committed list of skills marked false is one step from a menu-exclusion step discharged by citing it. That is the laundering the parked roadmap's own Risk 1 names: a measurement of carrier coverage reused as a verdict about which skills matter. The predicate would then have caused the exclusion it was built to make impossible without proof. | Step 2.1 states in the source that the predicate decides eligibility only, and it marks nothing and excludes nothing. Nothing in the tree consumes it as an exclusion trigger and no exclusion mechanism exists to consume it, so the misuse requires building the missing half first. The acceptance criteria require that no skill is marked, excluded or modified by this work. | Phase 2 — Make it an eligibility predicate, not a paragraph |
| 2 | The uncarried set is derived from one carrier and a second delivery path drops a different set | implementation | The census diffs the skill frontmatter schema against `ContentEntry`'s eight fields — one carrier, MCP-lite. A different delivery path drops a different set, so a skill reading `body-portable: true` against this report can still arrive stripped over another route. A report whose scope is not stated in the report gets quoted as general, and the eligibility claim silently over-reaches. | Step 1.1 requires the report header to name the carrier it measured, so the scope travels with the artifact rather than with whoever remembers it. A second carrier is a second report rather than an edit to this one, which keeps each report's denominator intact instead of merging two field sets into one unattributable list. | Phase 1 — Census the gap |
| 3 | The census is written and never read | product | This surface already carries generated reports nobody consumes, and a per-field, per-skill table under `agents/evidence/analysis/` is the same shape. Phase 1 is also the cheap half, so it can plausibly land alone and sit there reproducing byte-equal forever while the parked roadmap's completeness verify still reads as sufficient on byte-equality — which is the actual defect. | Step 2.2 gives the census exactly one named consumer, the parked roadmap's completeness verify, and Phase 1 does not close without Phase 2 accepting it. That ordering makes the consumer a precondition of the report rather than a hoped-for follow-up, which is the difference between this and the reports it would otherwise join. | Phase 1 — Census the gap |
