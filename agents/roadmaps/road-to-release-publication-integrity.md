---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
depends: []
drafted_against: 407915361
drafted_at: 2026-08-23
estate_offset_exempt: "An /analyze:inbox run consumes inbox notes and closes no roadmap, so this change carries no completed roadmap to retire against the addition. Two roadmaps are added from a twelve-file drop whose own producer proposed nine."
---

# Road to release publication integrity

> **Source:** `agents/tmp.old/release-4.10.0` — a 7,981-line corpus of twelve
> independent reviewer reports on release 14.10.0, plus eleven roadmap-shaped
> attachments. Analysed via `/analyze:inbox` at `407915361`, which is the exact
> commit every attachment declares as its own baseline. Placeholder integrity is
> the densest recurrence in that corpus: nine separate reviewer passages, one of
> which retracts its own earlier "erledigt" verdict. The design this roadmap
> executes is **not new** — it lives in
> [`stubs/road-to-release-placeholder-guard.md`](stubs/road-to-release-placeholder-guard.md),
> filed 2026-08-21 after two refused implementations and two council sessions.
> What is new is the measurement below, which the stub could not have carried.

## Goal

`DERIVED_MARKER` (`_auto-derived, rewrite before merge:_`, exported from
`src/scripts/_lib/release_highlights.ts:48`) can no longer reach a published
surface — the annotated tag message, the GitHub Release notes, or `CHANGELOG.md`
on main — because a check sits immediately before each independently resumable
irreversible transition, not because someone remembered to curate. Success is
readable from the next release: its changelog section contains zero markers
without anyone having edited it after the fact.

## Context — remediation was tried, and it did not hold

The stub records four unrewritten markers in the **published** 14.7.0 section
and calls the defect "recurring, and it has shipped". Both statements are still
true, and the tree now says something stronger, measured at `407915361`:

| Section | Markers | Committed |
|---|---|---|
| 14.7.0 | **0** — cleaned by hand since the stub was filed | — |
| 14.9.0 | **4** (`CHANGELOG.md:459-462`) | `36fea34ba`, 2026-08-23 |
| 14.10.0 | **2** (`CHANGELOG.md:410,412`) | `58dc43197`, 2026-08-23 |

Six live markers, all of them in sections created **after** the stub was filed
on 2026-08-21, in a file whose earlier offence had been remediated in the
meantime. That is the falsification the stub's thesis needed and could not
supply: hand-curation was applied, and the defect recurred twice within two
releases. Editorial diligence is not a control. Prevention at the transition is.

Reproduce: `grep -c "_auto-derived, rewrite before merge:_" CHANGELOG.md` → 6;
`awk` the section boundaries at `:405` (14.10.0) and `:454` (14.9.0).

## Phase 1 — Produce the three artefacts the stub's promotion criteria name

The stub is explicit that it is not active work and states what would make it
so. This phase produces exactly those three things and nothing else — it does
not implement the guard.

- [ ] **1.1 Measure an extraction that leaves `release.ts` net smaller.** The
      first refused attempt died on `check_source_size_budget` — `release.ts` is
      over the 1,500-line ceiling, so *any* net growth is refused, including a
      four-line version. Produce the moved-symbol list for a
      `release_publication.ts` (or equivalent), with the re-export shape that
      keeps callers unaffected, and the before/after line counts.
      verify: `./scripts-run src/scripts/check_source_size_budget 2>&1 | tail -3` exits 0 against a tree carrying the proposed split, and the written plan states a negative net line delta for `release.ts`.
- [ ] **1.2 Enumerate the irreversible publication transitions, by hand.** The
      council recorded that the asked-for conjunction — ratchet-clean, fires
      only on real publication, no call-site enumeration — has **no** solution,
      because the state machine has no single dominating checkpoint. So the
      enumeration is deliberate work, not a failure to find an elegance. Name
      each transition, and name the `--resume` created-but-unpushed-tag path as
      its own case; step 8 reads the changelog only in its tag-creation branch.
      verify: the written list names every call site that reaches an irreversible transition, and `grep -n "resume" src/scripts/release.ts` confirms the resume branch the list claims exists.
- [ ] **1.3 Decide the drill fixture question.** The second refused attempt
      broke four `release_drill.test.ts` sequencing scenarios because the drill
      returns the live `CHANGELOG.md`. Choose: controlled changelog fixtures for
      the drill, or a scoped exemption — the council rejected letting drills
      bypass policy universally.
      verify: the decision is written with its reason, and `npx vitest run tests/**/release_drill.test.ts 2>&1 | tail -3` is green against the chosen shape.

## Phase 2 — Implement the guard against the Phase 1 plan

**Exit criteria:** a marker cannot survive any enumerated transition.
**Rollback:** the extraction is a pure move with re-exports; reverting is one
commit and no caller changes.

- [ ] **2.1 Extract the publication orchestration and place the check.** Enforce
      the marker check immediately before each transition from 1.2. Scope the
      read to the section of the *current* transition, never repo-wide —
      otherwise historical content permanently blocks every later release until
      editorial work nobody scheduled is done.
      verify: a test per enumerated transition asserts the guard refuses a section carrying `DERIVED_MARKER`; sabotage arm — neutralise the guard and watch each test fail, then restore.
- [ ] **2.2 Leave the advisory release-PR check advisory.** `check_release_highlights.ts:203-206` keeps its exit code owned solely by the `_none_` check, and both council sessions declined to touch it. Highlights are auto-derived first and curated later, so a blocking check there is red by construction.
      verify: `grep -n "exit code owned solely" src/scripts/check_release_highlights.ts` still matches, and the file's exit-code behaviour is unchanged by this roadmap's diff.

## Explicitly NOT in this roadmap

**Curating the six live 14.9.0 / 14.10.0 highlight lines.** Both council seats,
both sessions: maintainer editorial work. An agent paraphrasing the generator's
own derivation reason into prose to satisfy a gate is the "truthfully documented
uselessness" failure one seat named, and it cannot repair an already-published
annotated tag message in any case.

## Blockers

### b-stub-promotion-authority
- **Blocks:** Phase 2
- **Class:** 2
- **What to do:** promoting a stub to active work is an estate decision. Either
  the maintainer promotes `stubs/road-to-release-placeholder-guard.md` on the
  strength of the Phase 1 artefacts, or Phase 2 stays closed and this roadmap
  ends at Phase 1 with the promotion criteria satisfied and waiting.
- **Resolved when:** the stub is promoted, or this roadmap records that Phase 1
  discharged it and Phase 2 is deliberately not started.
- **Status:** open

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A third refused implementation | implementation | Two attempts already died on gates the design did not anticipate. A third could die on a gate Phase 1 also failed to anticipate, burning the cycle again | Phase 1 produces the measurement BEFORE any code moves, and its verify runs the exact gate that refused attempt 1 | Phase 1 |
| 2 | The guard fires on historical content | implementation | A repo-wide read would make the six live markers block every future release until editorial work nobody scheduled is done — turning a prevention control into a hostage | 2.1 scopes the read to the current transition's section; the council named this constraint explicitly | Phase 2 |
| 3 | The enumeration misses a transition | implementation | No single dominating checkpoint exists, so coverage is only as good as the list, and a missed path publishes silently | 1.2 names the `--resume` path as its own case because it is the one attempt 1 found; each enumerated transition gets its own test with a sabotage arm | Phase 2 |
| 4 | Phase 1 lands and nothing follows | product | The stub already sat for two days while the defect shipped twice. Producing promotion criteria that nobody acts on repeats that at one level of indirection | The blocker forces an explicit disposition rather than silence; a roadmap ending at Phase 1 with a recorded decision is a legitimate outcome, an unread one is not | Phase 1 |

## Acceptance Criteria

- [ ] AC-1 — A published release section produced after this roadmap contains
      zero `DERIVED_MARKER` occurrences without post-hoc editing, and the
      mechanism that prevented it is a check at a transition rather than a
      person.
- [ ] AC-2 — `release.ts` is net smaller than at `407915361`, measured by
      `check_source_size_budget`, or Phase 2 is recorded as not started.
- [ ] AC-3 — Every enumerated irreversible transition carries a test that has
      been observed failing with the guard neutralised.
- [ ] AC-4 — The six live 14.9.0 / 14.10.0 marker lines are untouched by this
      roadmap's diff, and the reason is stated.
