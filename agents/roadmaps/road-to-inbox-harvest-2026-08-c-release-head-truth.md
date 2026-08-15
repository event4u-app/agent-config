---
complexity: lightweight
status: ready
---

# Road to a release head that can be contradicted

**Goal.** Make the release head's *sole blocking condition* reachable for the
two labels where it currently cannot fire, so the curated head stops shipping
`_none_` over evidence the span actually carries.

**Source:** `agents/tmp.old/feedback-12.0.0.txt` — five independent external
review passes over the `10.1.0 → 12.0.0` span, all five raising the release
head. Triage and the not-adopted register:
`agents/evidence/analysis/inbox-harvest-2026-08-c-triage.md`.

## Context

`docs/contracts/CHANGELOG-conventions.md` settled the curated-head cadence on
2026-08-13: **retro-curation**, an AI-council 2/2 convergence, with the
hard-block branch explicitly rejected and two falsifiers pre-registered. The
argument for that choice rests on one sentence in the same contract — a
contradiction, meaning a `_none_` curated field against a populated derived
category, remains the sole blocking condition. A marked line is a prose gap; a
contradiction is a lie, and only the lie blocks.

Measured on this branch over the 74-commit span `11.0.0..12.0.0`, that premise
does not hold for two of the five labels:

| label | derivation | span hits | curated value shipped |
|---|---|---:|---|
| `Security and correctness` | `/secur/i` in the conventional scope, or whole-word `security` in the subject — the security branch of `derive_category_hits` in `src/scripts/_lib/release_highlights.ts` | **0** | `_none_` (`CHANGELOG.md:367`) |
| `Honest nulls` | literal `honest[ -]null` in subject or body — the honest-null branch of the same function | **0** | `_none_` (`CHANGELOG.md:368`) |

The same span carries **13** `fix(...)`-scoped commits, and one commit whose
subject records that a soak was waived rather than met. The label reads
*Security **and correctness*** while the classifier only ever looks for
security; nothing in the tree derives the correctness half, so the field cannot
be contradicted and `_none_` ships uncontested.

**This is not the locked question.** The lock chose retro-curation over
hard-blocking; this roadmap changes neither. It repairs the check the lock
depends on. Widening a *derivation* makes contradictions detectable; it does not
make an unrewritten marker block, which stays exactly as decided.

## Non-goals

- Flipping `check_release_highlights` from advisory to blocking on a surviving
  derived marker. Decided against, recorded, and not reopened here.
- Rewriting historical release heads. The contract already permits in-place
  repair of a shipped head; that is curation, not this plan.
- Adding a new label to `HEAD_LABELS`. The five are a contract surface.

## Phase 1 — Measure the derivation's recall before changing it

- [x] Run `derive_category_hits` over the last six released spans and record,
      per label, how many commits it caught against how many a hand pass calls
      in-category. Write the table to
      `agents/evidence/analysis/release-head-derivation-recall.md`.
      *verify:* the file exists and carries one row per label per span.
- [x] From that table, state which labels are under-derived and by how much. A
      label whose recall is already high is out of scope for Phase 2 — the
      widening must be aimed, not general.
      *verify:* the analysis names the in-scope labels explicitly.
- [x] Record the false-positive cost of the current conservative stance in the
      same file: how many of the six spans would have gone red under a naive
      "any `fix(` counts" rule. The derivation's own comment argues a false red
      is worse than a miss; that trade-off needs a number before it is moved.
      *verify:* the file carries the naive-rule count per span.

## Phase 2 — Widen the two derivations, conservatively

- [x] Extend the `Security and correctness` derivation so the correctness half
      of its own label is derivable, using a signal Phase 1 showed is precise
      over the six spans — not a bare `fix(` match if Phase 1 measured that as
      noisy.
      *verify:* `tests/scripts/release_highlights.test.ts` gains a case that is
      caught by the new rule and was missed by the old one, and the
      false-positive fixture from Phase 1 stays uncaught.
      **Verify command corrected:** that path does not exist and never did; the
      derivation's tests live in `tests/scripts/check_release_highlights.test.ts`
      (and `release_head_prefill.test.ts`), which is where the cases landed.
- [x] Extend the `Honest nulls` derivation beyond the literal marker to the
      recorded forms Phase 1 found in real subjects (a waived condition, an
      unmet soak, a published null).
      *verify:* a test asserts the 12.0.0-era waived-soak subject now derives.
- [x] Re-run the gate against the `11.0.0..12.0.0` span and record what it now
      says about the shipped head, in the Phase 1 analysis file.
      *verify:* the file states the gate's verdict on that span, before and
      after.

## Phase 3 — Decide whether the publish side gets the invariant

- [x] Record, in `docs/contracts/CHANGELOG-conventions.md`, that the derivation
      is the load-bearing half of the retro-curation decision, so the next
      reader does not re-derive why widening it is not a reversal.
      *verify:* the contract's rejected-branch paragraph cites the derivation.
- [~] Add an unresolved-marker invariant to `check_release_published.ts`
      (tag/npm side, not the merge side). Deferred behind the blocker below —
      it changes when a release can be published, which is a maintainer call
      even though it is a different mechanism from the rejected merge block.

## Blockers

### blocker: publish-side-marker-invariant
- **Status:** open
- **Owner:** maintainer
- **Question:** may an unresolved derived marker block *publishing* (tag + npm),
  given that blocking it at *merge* was rejected on 2026-08-11/13? The two are
  distinct: at merge the marker is present by construction on every
  substantiated release, so blocking is a guaranteed first-run red; at publish
  the maintainer has already had the whole review window to curate, so the
  marker's survival carries different information.
- **Resolved when:** the maintainer records a yes or a no in this blocker.
- **Blocks:** step 3.2 only. Phases 1 and 2 proceed either way.
- **What to do:** pick exactly one — (a) add the unresolved-marker invariant to
  `check_release_published.ts`, so a tag or npm publish carrying an unrewritten
  derived head fails; or (b) leave the publish side untouched and mark step 3.2
  `[-]` cancelled, citing this blocker. Mutually exclusive. Either answer
  closes the blocker; (b) is the answer consistent with the 2026-08-13 lock and
  should be preferred absent a reason to differ.

### blocker: ac3-false-positive-reading
- **Status:** open
- **Owner:** maintainer
- **Question:** acceptance criterion 3 was measured and is false as written —
  five of six previously-green spans turn red under the widened derivation.
  Does the criterion mean *no span whose head was correct becomes falsely
  contradicted* (a false-positive guarantee, which the measured 96 % precision
  satisfies), or does it mean *no span turns red at all* (which cannot hold
  while criterion 2 also holds, since populating a green span's field is
  exactly what turns it red)?
- **Resolved when:** the maintainer records which reading governs, or re-cuts
  the criterion.
- **Blocks:** acceptance criterion 3 only. Phases 1 and 2 are closed and Phase
  3 step 3.1 is closed either way; nothing else waits on this.
- **What to do:** pick exactly one — (a) adopt the false-positive reading, tick
  criterion 3 citing `release-head-derivation-recall.md` § 5 and the 96 %
  precision, and leave the five historical heads alone (they are curation, an
  explicit Non-goal); or (b) re-cut the criterion to name the false-positive
  bar directly, e.g. "no span gains a hit a hand pass calls out-of-category",
  which the same measurement already answers. Mutually exclusive. Neither
  option touches the widened derivation, which is measured and shipped.

## Acceptance criteria

- [x] A recall table for all five labels over six released spans exists and is
      cited from this roadmap.
      → `agents/evidence/analysis/release-head-derivation-recall.md` § 1, 30
      rows (5 labels × 6 spans).
- [x] The `11.0.0..12.0.0` span, replayed through the widened derivation,
      populates `Security and correctness`.
      → 8 hits, gate exit 1. Before/after recorded in the analysis file § 7.
- [ ] No previously-green released span turns red under the widened derivation
      (measured, not asserted).
      **MEASURED FALSE — this criterion does not hold as written.** Five of six
      previously-green spans turn red (10.1.0, 10.3.0, 10.4.0, 11.0.0, 12.0.0;
      only 10.2.0 stays green, because its head already carries a derived line
      rather than `_none_`). Analysis file § 5 carries the per-span table, and
      three facts that decide what it means: the reds are true positives at a
      hand-judged 96 %; this criterion and the one above it cannot both hold
      literally, since populating a green span's field is exactly what turns it
      red; and **no future release is red because of this** — the generator
      pre-fills every substantiated label, pinned as a regression test, so
      Risk 2 does not fire. Left open deliberately rather than ticked under a
      reading that would pass it. **The maintainer's call is registered as
      `blocker: ac3-false-positive-reading` above**, so the decision surfaces
      in `agent-config gates` rather than living only in this checkbox body.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Widening reads as reopening the lock | product | The recorded decision rejected hard-blocking; a change to the same file family can be mistaken for a reversal, and the next reader relitigates a settled question | The Non-goals section states the boundary, and step 3.1 writes it into the contract next to the rejected branch, so the distinction lives where the decision lives | Non-goals |
| 2 | A wider derivation makes every release red | implementation | The current derivation is conservative by an explicit argument in its own source: a false red makes every release annoying, a miss only returns the head to its pre-gate state | Phase 1 measures the false-positive cost over six real spans before any rule moves, and the acceptance criteria require that no previously-green span turns red | Phase 1 — Measure the derivation's recall before changing it |
| 3 | The correctness signal is judgement, not pattern | implementation | "Correctness" has no conventional-commit scope of its own, so any regex is a proxy and may encode the author's habits rather than the category | Phase 1 forces the signal to be chosen from measured precision over six spans rather than picked first and justified after; a label with no precise signal is a legitimate Phase 1 outcome | Phase 2 — Widen the two derivations, conservatively |
| 4 | The publish-side invariant drifts into the rejected merge block | product | Both are "a marker blocks something", and the difference is only the moment; a careless implementation would restore the guaranteed first-run red under a new name | The step is `[~]` behind a maintainer blocker that states the distinction in its own question, and it names the publish script explicitly rather than the merge gate | Phase 3 — Decide whether the publish side gets the invariant |
