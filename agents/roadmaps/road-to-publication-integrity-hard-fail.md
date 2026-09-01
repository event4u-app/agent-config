---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-release-placeholder-guard
    relation: extends
    note: >
      The stub this file takes the executable half out of. That stub has sat in
      agents/roadmaps/stubs/ since 2026-08-21 with a validated design and no
      capability gap, held solely by estate authorization. This file carries the
      forward-only guard; the stub keeps the inherited record and the
      owner-reserved remediation question.
estate_offset_exempt: "Adds one active roadmap with no offsetting disposal, and none is available. The two roadmaps the ratchet counts as active at origin/main (governed-evidence-production, harness-promotion-bridge; council-topology-evidence-followups is status: draft and is excluded from the metric) both carry open steps, so archiving either would be the silent drop the 2026-08-24 estate verdict exists to prevent, and both council seats of that verdict explicitly refused to name an offset on the ground that no mechanical evidence identifies the least valuable active roadmap. The authorization here is not self-issued: the maintainer instructed this addition twice — once in the intake round's closing message, demanding that the release-placeholder defect be taken into a roadmap and fixed, and once in the invocation that produced this file, asking for ready roadmaps in a pull request. Recorded verbatim in the body under 'Why this is not the blocked stub'."
estate_growth_exempt: "Covers the growth half the offset half does not: active_roadmaps 2 -> 3 against an exact floor of 2 measured at origin/main by check_estate_count, plus one open blocker (30 -> 31). The growth is authorised by the same two maintainer instructions and by a falsifier the 2026-08-24 council named itself: 'evidence that the ratchet creates systematic deadlock — validated promotions blocked across more than two releases while user-facing defects ship'. Measured at b50b27281: the design was validated by a 2/2 council on 2026-08-23 and the defect has shipped in three releases since — 14.11.0 (2026-08-24, 4 marker lines), 14.12.0 (2026-08-25, 4), 14.13.0 (2026-08-31, 4). The condition the council set is met on its own terms."
---
# Road to publication integrity hard fail

> **Source:** `agents/tmp.old/inbox-2026-09-a/` — the round's review artefact,
> post-merge pass § 1–4, and the maintainer's closing instruction in the same
> file. Every number below is re-derived against the tree at `b50b27281`; none
> is carried from the artefact on trust.

## Goal

A release cannot publish a section whose curated head still carries the
generator's own draft marker, and the generator's authoring instruction to the
releaser never reaches a published surface. When this is finished, the release
path refuses — with a non-zero exit and a named section — instead of warning,
and the refusal is shown to have teeth by sabotage rather than asserted. A
marker-bearing *historical* section still publishes cleanly, so no editorial
backlog can hold a release hostage.

## Why this is not the blocked stub

The guard has been specified, council-approved and unbuilt since 2026-08-21.
The reason is worth stating precisely, because it is the finding rather than
the excuse:

`check_estate_count`'s metrics are active roadmaps, parked roadmaps, open
blockers, skill count, skill-description tokens and hook concerns. **Source
files are not among them.** So the estate ratchet never touched the guard's
implementation at any point — what it blocked for ten days and three releases
was the *roadmap file*, whose promotion costs +1 `active_roadmaps` against an
exact floor. The fix was never expensive; its plan was.

The maintainer's operative instruction, verbatim, as the authority for the two
frontmatter exemptions above:

> Das mit dem Release Placeholder wurde oft angemerkt, nie gefixt. Warum hat <!-- md-language-check: ignore -->
> analyze:inbox das nicht in die roadmap aufgenommen? […] Ich will, dass das <!-- md-language-check: ignore -->
> verbessert und behoben wird. <!-- md-language-check: ignore -->

The process half of that instruction — that this class of miss stop happening —
is `road-to-blocked-quickwin-visibility`, not this file. This file fixes the
defect.

## The measurement this roadmap is built on

Re-derived at `b50b27281`, per released CHANGELOG section:

| Released version | date | `_auto-derived, rewrite before merge:_` lines |
|---|---|---|
| 14.9.0 | — | 4 |
| 14.10.0 | 2026-08-23 | 2 |
| 14.11.0 | 2026-08-24 | 4 |
| 14.12.0 | 2026-08-25 | 4 |
| 14.13.0 | 2026-08-31 | 4 |

Eighteen lines across five consecutive released sections. Reproduce with
`grep -c 'rewrite before merge' CHANGELOG.md` (8, current era) plus the same
grep over `docs/archive/CHANGELOG-pre-14.12.0.md`.

A second, separate defect the prior analyses never named: the generator's own
authoring instruction ships with them.
`grep -rh 'Curated head: fill before merge' CHANGELOG.md docs/archive/*.md | wc -l`
reads **44** — two in the current era, forty-two across fifteen archive files.
That comment is addressed to the releaser and is published to every consumer.

## Phase 1 — flip the advisory to blocking, scoped to the target section

- [ ] **1.1 Record the reversal before changing the behaviour.** The decision
      being reversed is stated in two places —
      `src/scripts/check_release_highlights.ts:21` ("An unrewritten derived line
      warns; it never blocks") and
      `src/scripts/_lib/release_highlights.ts:40-47` ("nothing here is
      wrong-if-shipped — only unpolished-if-unedited"). Its premise is not
      wrong: the line's evidence *is* true. What is falsified is the conclusion
      drawn from it, by five consecutive releases and a maintainer instruction.
      Annotate both sites in place, dated, naming the authority — or land an ADR
      and point at it.
      verify: `grep -n 'never blocks' src/scripts/check_release_highlights.ts`
      returns either nothing or a line that now states the opposite, and the
      annotation names both the date and the instructing authority.
- [ ] **1.2 Make the existing detection blocking instead of advisory.**
      `stale_draft_labels` at `src/scripts/_lib/release_highlights.ts:288`
      already returns exactly the offending labels, and the gate already calls
      it at `check_release_highlights.ts:205-212` and discards the result into a
      warning. The change is the exit code, not the detection — no new helper,
      no second definition of the marker.
      verify: `npx vitest run tests/scripts/check_release_highlights.test.ts`
      green, with a new case asserting exit 1 for a curated head containing
      `DERIVED_MARKER`; the two existing advisory fixtures at lines 326 and 365
      are *updated* to the new expectation rather than deleted, so the change of
      contract is visible in the diff.
- [ ] **1.3 Scope every read to the section under release, never repo-wide.**
      Eighteen historical marker lines and forty-four historical instruction
      comments exist. A repo-wide read would block every future release until
      editorial work nobody has scheduled — which is how a correctness guard
      turns into a permanent red.
      verify: a test with a marker-bearing *historical* section and a clean
      *target* section exits 0.
- [ ] **1.4 Show the guard's sensitivity by sabotage.** Neutralise the new
      branch, watch the negative case go red, restore it. A test never seen red
      has unknown sensitivity.
      verify: the red-then-green transcript is recorded in the pull request,
      naming the line neutralised.

## Phase 2 — stop shipping the authoring instruction

- [ ] **2.1 The generator must not leave its own instruction comment in a
      released section.** `src/scripts/release.ts:323` writes
      `<!-- Curated head: fill before merge, keep it under 10 lines… -->` into
      the section it creates, and nothing removes it at release time. It is
      correct in the `Unreleased` draft and wrong the moment the section is cut.
      verify: a unit test on the writer asserts the comment is present in an
      `Unreleased` draft section and absent from a released one; and
      `grep -c 'Curated head: fill before merge' CHANGELOG.md` reads 0 for every
      section cut after this change.
- [ ] **2.2 The gate reds on a shipped instruction comment in the target
      section.** This is a different mechanism from 1.2 — a leaked instruction,
      not an unpolished claim — so it needs its own fixture rather than riding
      on the marker check.
      verify: a negative fixture whose target section contains the literal
      comment exits 1, and a fixture whose *historical* section contains it
      exits 0.

## Phase 3 — extend to the two irreversible transitions

- [ ] **3.1 Guard the annotated tag and the GitHub Release body immediately
      before each fires.** Both transitions sit in `release.ts` — tag creation
      at `:1408`, Release notes at `:1435` — and both formatters live in
      `src/scripts/_lib/release_material.ts:77,82`. The guard goes at the call
      site, not in the formatter: a pure formatter has no notion of whether it
      is actually publishing, which is why an earlier attempt at that placement
      was refused.
      verify: a test asserts that no irreversible command runs after a refusal,
      and `grep -n "git.,.tag" src/scripts/release.ts` shows no `-a` creation
      site outside the guarded path.
- [ ] **3.2 Cover the `--resume` created-but-unpushed tag path as its own
      case.** The recorded bypass: the changelog is read only in the
      tag-creation branch, so a resume over a tag that was created but not
      pushed skips the read entirely. A guard that only covers creation misses
      exactly this.
      verify: a test resumes over a created-but-unpushed tag whose section
      carries the marker and asserts the refusal lands before any push.

## Blockers

### blocker: b-retro-curation-scope

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing in Phases 1–3. They are forward-only by construction, per
  § 1.3, which scopes every read to the section under release. This blocker gates
  only the editorial pass over what has already shipped, and AC-6 records that
  the pass is either done or standing here.
- **What to do:** pick one of three, all reproducible from the tree.
  (a) Curate the mutable half: edit the eighteen marker lines and the two
  current-era instruction comments in `CHANGELOG.md` plus the forty-two in
  `docs/archive/CHANGELOG-pre-*.md`, and record the immutable half as
  unrepairable. (b) Leave every published section standing and add one dated
  note above the 14.9.0 heading stating that the heads were machine-derived and
  are preserved as published. (c) Curate the current era only and leave
  `docs/archive/` untouched, on the ground that archives are historical record.
  Reproduce the scope with
  `grep -c 'rewrite before merge' CHANGELOG.md` and
  `grep -rh 'Curated head: fill before merge' CHANGELOG.md docs/archive/*.md | wc -l`.
- **Recommendation:** (c) — curate the current era, leave `docs/archive/`
  standing. It repairs the two sections a consumer of the shipped package
  actually reads, costs one editorial pass over eight lines and two comments,
  and does not commit the maintainer to forty-two archive edits whose only
  reader is this repository. (b) is the cheapest and leaves the defect visible
  in the surface that prompted five rounds of feedback; (a) is correct and is
  the one nobody has scheduled in ten days, which is evidence about its cost
  rather than about its merit.
- **If you do nothing:** Phases 1–3 still land and no further release ships the
  defect, so the forward fix is unaffected. What persists is the published
  record: eighteen machine-derived head lines and forty-four authoring
  instructions stay readable on npm, and the next review round has the same
  grep available that produced this roadmap. The cost is reputational and
  recurring, not functional.
- **Resolved when:** one of (a), (b) or (c) is recorded with a date, and the
  record separates the mutable surfaces (CHANGELOG sections) from the immutable
  ones (annotated tag messages and published GitHub Release bodies for 14.9.0
  through 14.13.0, which cannot be repaired at all). Two prior council sessions
  ruled the editorial prose itself owner-reserved: an agent paraphrasing the
  generator's own derivation reason produces truthfully documented uselessness,
  so no option here may be executed by an agent without this record.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The flip reds the next release PR on its first run | implementation | Exactly the failure the advisory decision was introduced to remove: 9.17.0 and 9.18.0 were both red on their first run because the generator wrote a value the gate rejected. | The generator now pre-fills each substantiated label with its deriving reason and citing SHAs, so the releaser edits prose rather than inventing a claim; and § 1.3 scopes the read to the target section, so no historical line can red a release. | Phase 1 — flip the advisory to blocking, scoped to the target section |
| 2 | A hard fail on the release path leaves a genuine emergency release unshippable | product | A correctness guard with no escape hatch on the only path to publishing is a single point of failure for hotfixes. | Either name one documented escape in the same change — an explicit flag whose reason is printed into the PR body, never a silent env var — or state in § Explicitly NOT that none exists and why. Decide it in Phase 1, not after the first emergency. | Phase 1 — flip the advisory to blocking, scoped to the target section |
| 3 | Phase 3's move of the irreversible transitions repeats what killed two earlier attempts | implementation | The prior attempts died on drill fixtures that return the live CHANGELOG, and on placing the guard in a pure formatter. | Phases 1 and 2 land first and are independently sufficient for the defect the maintainer named; Phase 3 is a separate checkpoint and can be descoped without losing the fix. Drill scenarios get synthetic clean sections rather than a universal policy bypass. | Phase 3 — extend to the two irreversible transitions |

## Acceptance Criteria

- [ ] AC-1 — the release gate exits non-zero when the section under release
      carries `_auto-derived, rewrite before merge:_`, and the negative case has
      been shown red with the guard neutralised and green with it restored.
- [ ] AC-2 — a CHANGELOG section cut after this change carries no
      `<!-- Curated head: fill before merge` comment, pinned by a writer test.
- [ ] AC-3 — a marker-bearing historical section does not block a release whose
      own section is clean, pinned by a test.
- [ ] AC-4 — the reversal of the advisory decision is recorded at both sites
      that state it, dated, with the instructing authority named.
- [ ] AC-5 — the escape-hatch question from risk 2 is answered in the tree:
      either one documented flag exists whose use is printed, or the absence is
      stated with its reason.
- [ ] AC-6 — retro-curation of the eighteen published marker lines and
      forty-four published instruction comments is either done or standing as
      `blocker: b-retro-curation-scope` with the mutable/immutable split
      recorded. It is not silently dropped.

## Explicitly NOT in this roadmap

- **Judging the quality of a filled head.** Unchanged: a filled field is never
  assessed for prose quality. The gate blocks an unfilled one, not a weak one.
- **The `_none_` contradiction check.** Already built, already blocking, and
  keeping full teeth. Nothing here weakens it.
- **The editorial pass over published sections.** Owner-reserved, see the
  blocker.
- **Any new source file.** Every change lands in
  `check_release_highlights.ts`, `_lib/release_highlights.ts`, `release.ts`,
  `_lib/release_material.ts` and their existing test files. Stated as a
  constraint rather than an observation: a design that needs a new file is the
  design that sat unbuilt for ten days.
