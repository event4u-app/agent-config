---
complexity: lightweight
status: ready
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

- [x] **1.1 Measure an extraction that leaves `release.ts` net smaller.** The
      first refused attempt died on `check_source_size_budget` — `release.ts` is
      over the 1,500-line ceiling, so *any* net growth is refused, including a
      four-line version. Produce the moved-symbol list for a
      `release_publication.ts` (or equivalent), with the re-export shape that
      keeps callers unaffected, and the before/after line counts.
      verify (discharged): `./scripts-run src/scripts/check_source_size_budget 2>&1 | tail -3` exits 0 against a tree carrying the proposed split, and the written plan states a negative net line delta for `release.ts`.

      **MEASURED AND LANDED 2026-08-23.** Plan:
      `agents/evidence/reports/release-publication-extraction-plan.md`. The split
      is **three** modules, and the shape was forced rather than chosen: a single
      cut does not compile — the publication unit needs `REMOTE`, `MAIN_BRANCH`,
      `CHANGELOG`, `GH_PR_BODY_LIMIT`, the two Python-parity error classes and
      `_cap_body` from `release.ts`, while `release.ts` needs `die`, `run`, `git`,
      `gh` and twenty more back. That is a cycle, and a cycle is worse than the
      large file the split is fixing, so `release_env.ts` carries the leaves both
      need.

      `release.ts` **2,818 -> 2,030** (net **-788**); `release_publication.ts` 727
      and `release_env.ts` 238, both under the 1,500 ceiling and therefore
      contributing zero excess — which is why the total falls by exactly what left.
      `check_source_size_budget` total excess **19,363 -> 18,575**; the gate
      reported the ratchet loose and the baseline is lowered in the same change.
      Every moved public name resolves through the trailing `export {...}` block
      that was already there, and the six names tests import directly are
      re-exported with `export ... from` rather than imported, because they are not
      used in `release.ts` and an unused import would be dropped — breaking the
      test path silently. **133 release tests green against the split,
      unmodified.**
- [x] **1.2 Enumerate the irreversible publication transitions, by hand.** The
      council recorded that the asked-for conjunction — ratchet-clean, fires
      only on real publication, no call-site enumeration — has **no** solution,
      because the state machine has no single dominating checkpoint. So the
      enumeration is deliberate work, not a failure to find an elegance. Name
      each transition, and name the `--resume` created-but-unpushed-tag path as
      its own case; step 8 reads the changelog only in its tag-creation branch.
      verify (discharged): the written list names every call site that reaches an irreversible transition, and `grep -n "resume" src/scripts/release.ts` confirms the resume branch the list claims exists.

      **EIGHT transitions enumerated with file:line** in the plan artefact: branch
      push (`release_publication.ts:424`, `:452`) · PR open (`release.ts:1361`) ·
      PR-body rewrite (`release_publication.ts:507`) · merge
      (`release_publication.ts:520`) · annotated-tag creation
      (`release.ts:1414`, the one site in the tag path that reads changelog
      content) · tag push (`release.ts:1415` fresh and `release.ts:1397` on
      resume, both via `release_publication.ts:641`) · GitHub Release
      (`release.ts:1445`) · follow-on workflow dispatch (`release.ts:1470`).

      **The resume case is named, and it is the one that matters.**
      `release.ts:1392-1397`: tag local but not remote, so the pipeline calls
      `_push_tag` and **nothing else** — the message was rendered on the earlier
      run and is never re-read. A check placed only at the tag-CREATION branch is
      bypassed entirely on resume. `grep -n resume src/scripts/release.ts` matches
      42 lines and this branch is among them. **Consequence for Phase 2:** the
      creation site and the push site need separate checks, not one.
- [x] **1.3 Decide the drill fixture question.** The second refused attempt
      broke four `release_drill.test.ts` sequencing scenarios because the drill
      returns the live `CHANGELOG.md`. Choose: controlled changelog fixtures for
      the drill, or a scoped exemption — the council rejected letting drills
      bypass policy universally.
      verify (discharged): the decision is written with its reason, and `npx vitest run tests/**/release_drill.test.ts 2>&1 | tail -3` is green against the chosen shape.

      **DECIDED: controlled changelog fixtures.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent, over a
      scoped exemption. `release_drill.ts:137-141` answered `git show
      <target>:CHANGELOG.md` with the **live** `CHANGELOG.md`, so every sequencing
      scenario depended on whatever the repository's changelog happened to contain
      — and that coupling is what broke the four scenarios in the second refused
      attempt: a guard reading real content refuses on real markers, so the drill
      failed for a reason with nothing to do with sequencing. The exemption was
      rejected because a prior council had already refused letting drills bypass
      policy universally: an exempt drill proves the sequencing and proves nothing
      about the policy, while a fixture holding policy-valid content exercises the
      same parsing path with content the test controls.

      **SHIPPED** as `WorldConfig.changelog`, defaulting to
      `defaultChangelogFixture(target)` — an `## [X.Y.Z]` heading (without which
      `extract_changelog_section` finds nothing), a renderable body, and a SECOND
      section below it so the extractor's boundary is exercised rather than
      assumed. No placeholder marker in the fixture, deliberately: one that tripped
      the guard the drill exists to sequence would reproduce the failure this
      removes. The live file stays reachable by passing it explicitly; nothing does
      today, and doing it *silently* is what the seam removes.

      **Sabotage-proven:** breaking the fixture's section heading takes exactly
      **4 of 8** drill scenarios RED — the same four the refused attempt broke — so
      the fixture is genuinely on the path rather than shadowed. Restored, 8/8
      green.

## Phase 2 — Implement the guard against the Phase 1 plan

**Exit criteria:** a marker cannot survive any enumerated transition.
**Rollback:** the extraction is a pure move with re-exports; reverting is one
commit and no caller changes.

- [-] **2.1 Place the check. NOT STARTED — the stub was not promoted.** Enforce
      the marker check immediately before each transition from 1.2. Scope the
      read to the section of the *current* transition, never repo-wide —
      otherwise historical content permanently blocks every later release until
      editorial work nobody scheduled is done.
      verify (not attempted): a test per enumerated transition asserts the guard refuses a section carrying `DERIVED_MARKER`; sabotage arm — neutralise the guard and watch each test fail, then restore.

      **PHASE 2 DELIBERATELY NOT STARTED, 2026-08-23** — `b-stub-promotion-authority`
      resolved against promotion. See that blocker for the reasoning, the recorded
      council split, and the reopening condition. The extraction half of this
      step's original title DID land, under 1.1, because that step's own verify
      required a tree carrying it; what is not started is **placing the check**.
      Phase 1's three artefacts are complete, so the stub's promotion criteria are
      satisfied and waiting rather than unmet.
- [x] **2.2 Leave the advisory release-PR check advisory.** `check_release_highlights.ts:203-206` keeps its exit code owned solely by the `_none_` check, and both council sessions declined to touch it. Highlights are auto-derived first and curated later, so a blocking check there is red by construction.
      verify (discharged): `grep -n "exit code owned solely" src/scripts/check_release_highlights.ts` still matches, and the file's exit-code behaviour is unchanged by this roadmap's diff.

      **HELD 2026-08-23**, and it is the one Phase 2 step that closes without
      promotion because it requires no implementation: it is an obligation NOT to
      change something. `check_release_highlights.ts` is untouched by this
      roadmap's diff — `git diff origin/main -- src/scripts/check_release_highlights.ts`
      is empty — so the `_none_` check still owns the exit code solely. Both
      council sessions declined to touch it: highlights are auto-derived first and
      curated later, so a blocking check there is red by construction.

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
- **Status:** resolved
- **Resolution (2026-08-23) — the second limb: Phase 1 discharged it, Phase 2 is
  deliberately not started.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default); the maintainer delegated
  owner-reserved blockers to the council for this autonomous drain run. **This one
  SPLIT 1-1 on the first pass and converged on a second**, and the split is
  recorded because the losing argument is good.

  *For promoting:* two shipped recurrences of the same defect establish concrete
  harm, enough to justify narrowly bounded ratchet growth once Phase 1's artefacts
  pass — and in an explicitly autonomous-authority context, prioritising policy
  adherence over defect remediation inverts the purpose of having autonomous
  authority at all.

  *For not promoting, which both seats reached on the tiebreak:* promoting a stub
  is an estate decision this roadmap itself routes to the maintainer, and the
  estate runs a shrink-only ratchet with `one_in_one_out` — so promotion is growth
  requiring an offset **this run did not identify**. The meta-question the first
  pass surfaced — *may an autonomous run override an explicitly deferred estate
  decision?* — is precedent-setting and is not a drain run's to settle. It is
  recorded here as an open finding for the maintainer rather than answered.

  **What Phase 1 leaves behind, which is the point of the second limb.** The three
  promotion criteria are satisfied and checkable: the extraction is measured and
  LANDED (-788 lines, so `release.ts` is no longer the reason a guard cannot fit),
  the transitions are enumerated with file:line **including the resume branch that
  bypasses a creation-site check**, and the drill's changelog coupling — the thing
  that broke the second attempt — is removed and sabotage-proven. A third attempt
  therefore starts from a tree where all three refusal causes are gone.

  *Reopening condition:* the maintainer promotes
  `stubs/road-to-release-placeholder-guard.md` and names a `one_in_one_out` offset,
  at which point Phase 2 is the implementation and its plan is already written.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-23 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A third refused implementation | implementation | Two attempts already died on gates the design did not anticipate. A third could die on a gate Phase 1 also failed to anticipate, burning the cycle again | Phase 1 produces the measurement BEFORE any code moves, and its verify runs the exact gate that refused attempt 1 | Phase 1 |
| 2 | The guard fires on historical content | implementation | A repo-wide read would make the six live markers block every future release until editorial work nobody scheduled is done — turning a prevention control into a hostage | 2.1 scopes the read to the current transition's section; the council named this constraint explicitly | Phase 2 |
| 3 | The enumeration misses a transition | implementation | No single dominating checkpoint exists, so coverage is only as good as the list, and a missed path publishes silently | 1.2 names the `--resume` path as its own case because it is the one attempt 1 found; each enumerated transition gets its own test with a sabotage arm | Phase 2 |
| 4 | Phase 1 lands and nothing follows | product | The stub already sat for two days while the defect shipped twice. Producing promotion criteria that nobody acts on repeats that at one level of indirection | The blocker forces an explicit disposition rather than silence; a roadmap ending at Phase 1 with a recorded decision is a legitimate outcome, an unread one is not | Phase 1 |

## Acceptance Criteria

- [-] AC-1 — A published release section produced after this roadmap contains
      zero `DERIVED_MARKER` occurrences without post-hoc editing, and the
      mechanism that prevented it is a check at a transition rather than a
      person.
      **CANCELLED 2026-08-23 with Phase 2.** No check ships, so nothing prevents
      it and marking this met would be the silent green. Named honestly rather
      than left ambiguous: **the defect is still live.** A release published after
      this change can still carry a `DERIVED_MARKER`, exactly as the two shipped
      recurrences did. What changed is that all three reasons the previous attempts
      were refused are gone — see `b-stub-promotion-authority` and the plan
      artefact. *Reopening condition:* the stub is promoted.
- [x] AC-2 — `release.ts` is net smaller than at `407915361`, measured by
      `check_source_size_budget`, or Phase 2 is recorded as not started.
      **Met on BOTH limbs 2026-08-23.** `release.ts` is 2,818 -> 2,030 lines (net
      -788) and `check_source_size_budget`'s total excess is 19,363 -> 18,575 with
      the baseline lowered in the same change; and Phase 2 is separately recorded
      as not started. The first limb is the load-bearing one: `release.ts` being
      over the ceiling is what refused the first attempt, and it is no longer the
      obstacle.
- [-] AC-3 — Every enumerated irreversible transition carries a test that has
      been observed failing with the guard neutralised.
      **CANCELLED 2026-08-23 with Phase 2** — there is no guard to neutralise. The
      enumeration the tests would be written against exists and is complete (1.2,
      eight transitions with file:line), including the finding that the creation
      site and the push site need SEPARATE checks because the resume branch
      bypasses a creation-site check. *Reopening condition:* the stub is
      promoted.
- [x] AC-4 — The six live 14.9.0 / 14.10.0 marker lines are untouched by this
      roadmap's diff, and the reason is stated.
      **Held 2026-08-23.** No CHANGELOG.md line is in this roadmap's diff at all.
      The reason is the one both council seats gave in both sessions: curating
      those six lines is maintainer editorial work, an agent paraphrasing the
      generator's own derivation reason into prose to satisfy a gate is the
      "truthfully documented uselessness" failure one seat named, and it cannot
      repair an already-published annotated tag message in any case.
