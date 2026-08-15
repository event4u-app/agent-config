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
- [-] Add an unresolved-marker invariant to `check_release_published.ts`
      (tag/npm side, not the merge side). **Cancelled 2026-08-15 by maintainer
      decision** on `blocker: publish-side-marker-invariant`: the publish side
      stays untouched, consistent with the 2026-08-13 lock. The 11-of-11
      uncurated-marker finding is a *curation* gap, not a publish gap — a
      publish block would stop the release without producing the curation. The
      finding stands recorded in `docs/contracts/CHANGELOG-conventions.md` as a
      fired falsifier, which is where a decision about the lock belongs.

## Blockers

### blocker: publish-side-marker-invariant
- **Status:** resolved <!-- 2026-08-15 — maintainer chose (b): publish side untouched -->
- **Owner:** maintainer
- **Question:** may an unresolved derived marker block *publishing* (tag + npm),
  given that blocking it at *merge* was rejected on 2026-08-11/13? The two are
  distinct: at merge the marker is present by construction on every
  substantiated release, so blocking is a guaranteed first-run red; at publish
  the maintainer has already had the whole review window to curate, so the
  marker's survival carries different information.
- **Blocks:** step 3.2 only. Phases 1 and 2 proceed either way.
- **Recommendation:** **(b)** — leave the publish side untouched. The
  2026-08-13 lock stands, and the finding this branch adds does not argue for
  blocking *publishing*: 11 marked lines shipped across 6 of 6 releases and not
  one was curated in place, which is a **curation** gap, not a publish gap. A
  publish-side block would stop the release without producing the curation, and
  it is the same "add a gate where nothing was blocked" move the council
  rejected on 2026-08-11. The fired falsifier belongs in its own decision about
  the lock, not smuggled in through this step.
- **If you do nothing:** step 3.2 stays `[~]` deferred and the roadmap cannot
  reach `count_open == 0`. That also means Iron Law 3 keeps this roadmap out of
  the archive indefinitely — which is the one reason not to leave it forever.
  No release, gate or user is blocked meanwhile.
- **What to do:** pick exactly one.
  1. **(b) Leave the publish side alone — recommended, ~1 minute.** In
     `agents/roadmaps/archive/road-to-inbox-harvest-2026-08-c-release-head-truth.md`,
     change step 3.2's `- [~]` to `- [-]` (cancelled) with the reason "publish
     side untouched per the 2026-08-13 lock", set this blocker's `Status:` to
     `resolved`, and run `agent-config roadmap:progress`. Effect: the deferral
     disappears and the roadmap can close. Cost: none beyond the record.
  2. **(a) Add the publish-side invariant — half a day, and it is real work.**
     Add an unresolved-marker check to `src/scripts/check_release_published.ts`
     so a tag or npm publish carrying an unrewritten derived head fails, with a
     test in `tests/scripts/check_release_published.test.ts`. Effect: a release
     cannot ship an uncurated head. Cost: the next release is red until someone
     curates, which is exactly the guaranteed-first-run-red the shared
     classifier was built to remove — read `docs/contracts/CHANGELOG-conventions.md`
     § the rejected branch before choosing this.
- **Resolved when:** step 3.2 reads `[-]` or the invariant ships with a test,
  and this blocker's `Status:` reads `resolved`.

### blocker: ac3-false-positive-reading
- **Status:** resolved <!-- 2026-08-15 — maintainer chose (a): false-positive reading -->
- **Owner:** maintainer
- **Blocks:** acceptance criterion 3 only. Phases 1 and 2 are closed and Phase
  3 step 3.1 is closed either way; nothing else waits on this.
- **Question:** acceptance criterion 3 was measured and is false as written —
  five of six previously-green spans turn red under the widened derivation.
  Does it mean *no span whose head was correct becomes falsely contradicted*,
  or *no span turns red at all*?
- **Recommendation:** **(a)** — adopt the false-positive reading. The literal
  reading cannot coexist with criterion 2 on the same branch: criterion 2
  requires the 12.0.0 span to populate `Security and correctness`, and that
  span is green today, so satisfying 2 turns a green span red *by
  construction*. One of the two has to give, and (a) keeps the one backed by a
  measurement (96 % hand-judged precision, 44 of 46).
- **If you do nothing:** nothing breaks. The widened derivation is merged and
  working regardless; the only cost is that this roadmap stays open and does
  not archive, so it keeps appearing in `agent-config gates`. There is no
  deadline and no second decision waiting behind it.
- **What to do:** pick exactly one.
  1. **(a) Adopt the false-positive reading — recommended, ~2 minutes.**
     Edit `agents/roadmaps/archive/road-to-inbox-harvest-2026-08-c-release-head-truth.md`:
     flip acceptance criterion 3 from `- [ ]` to `- [x]` and replace its
     MEASURED-FALSE note with one line citing
     `agents/evidence/analysis/release-head-derivation-recall.md` § 5. Then set
     this blocker's `Status:` to `resolved` and run
     `agent-config roadmap:progress`. Effect: the roadmap reaches
     `count_open == 0` and archives. Cost: the criterion's wording stays
     imprecise in the record, with § 5 carrying the correction.
  2. **(b) Re-cut the criterion — ~10 minutes.** In the same file, rewrite
     criterion 3 to name the false-positive bar directly: "no span gains a hit
     a hand pass calls out-of-category". Then tick it — the same measurement
     already answers it — resolve this blocker and run
     `agent-config roadmap:progress`. Effect: identical outcome, and the
     recorded criterion is precise for whoever reads it next. Cost: one more
     edit, and the acceptance criteria of a merged PR change after the fact.
- **Resolved when:** criterion 3 is ticked under either reading and this
  blocker's `Status:` reads `resolved`.

## Acceptance criteria

- [x] A recall table for all five labels over six released spans exists and is
      cited from this roadmap.
      → `agents/evidence/analysis/release-head-derivation-recall.md` § 1, 30
      rows (5 labels × 6 spans).
- [x] The `11.0.0..12.0.0` span, replayed through the widened derivation,
      populates `Security and correctness`.
      → 8 hits, gate exit 1. Before/after recorded in the analysis file § 7.
- [x] No previously-green released span turns red under the widened derivation
      (measured, not asserted).
      **Read as the false-positive guarantee, per the maintainer decision of
      2026-08-15** (`blocker: ac3-false-positive-reading`, resolved): no span
      whose head was correct becomes falsely contradicted — satisfied at a
      hand-judged 96 % precision (44 of 46). The literal reading is
      unsatisfiable alongside criterion 2 and was measured false: five of six
      previously-green spans turn red, all of them true positives. Per-span
      table, the three facts that decide it, and why no future release goes red:
      `agents/evidence/analysis/release-head-derivation-recall.md` § 5.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-15 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Widening reads as reopening the lock | product | The recorded decision rejected hard-blocking; a change to the same file family can be mistaken for a reversal, and the next reader relitigates a settled question | The Non-goals section states the boundary, and step 3.1 writes it into the contract next to the rejected branch, so the distinction lives where the decision lives | Non-goals |
| 2 | A wider derivation makes every release red | implementation | The current derivation is conservative by an explicit argument in its own source: a false red makes every release annoying, a miss only returns the head to its pre-gate state | Phase 1 measures the false-positive cost over six real spans before any rule moves, and the acceptance criteria require that no previously-green span turns red | Phase 1 — Measure the derivation's recall before changing it |
| 3 | The correctness signal is judgement, not pattern | implementation | "Correctness" has no conventional-commit scope of its own, so any regex is a proxy and may encode the author's habits rather than the category | Phase 1 forces the signal to be chosen from measured precision over six spans rather than picked first and justified after; a label with no precise signal is a legitimate Phase 1 outcome | Phase 2 — Widen the two derivations, conservatively |
| 4 | The publish-side invariant drifts into the rejected merge block | product | Both are "a marker blocks something", and the difference is only the moment; a careless implementation would restore the guaranteed first-run red under a new name | The step is `[~]` behind a maintainer blocker that states the distinction in its own question, and it names the publish script explicitly rather than the merge gate | Phase 3 — Decide whether the publish side gets the invariant |
