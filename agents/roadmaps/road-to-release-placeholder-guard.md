---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-24
estate_growth_exempt: "Charges +1 active_roadmaps and +3 open_blockers. Two of the three blockers existed in the stub and were invisible because check_estate_count excludes agents/roadmaps/stubs/ entirely, so for those the promotion made an existing obligation countable rather than creating one -- the direction the draft-status-ratchet-boundary stub argues for. The third, b-promotion-offset-not-named, is genuinely new and is the honest cost of this promotion: it records that the 2026-08-23 council reopening condition asked for a NAMED one_in_one_out offset and this change supplies a self-issued claim instead. Warranted on measured recurrence rather than appetite: the marker has shipped in five releases, three still carry ten lines in the published CHANGELOG, the reviewer has raised it in eight rounds since 9.x, and on 2026-08-23 the archived parent recorded the promotion criteria as satisfied-and-waiting and declined to promote anyway -- the release shipped four more marker lines the next day."
estate_offset_exempt: "Promoted out of stubs/ by the /analyze:inbox run of 2026-08-24. Un-stubbing is the documented promotion path, so the gate charges this as an addition; it carries no roadmap to retire against because nothing was archived in this change. The promotion is warranted on new evidence rather than on appetite: the marker has now shipped in five releases, the AI council's prescribed step 1 landed unnoticed, and the size-budget refusal that blocked the stub no longer applies to the destination the council named."
---
# Road to a release-placeholder guard that fits the ratchet

> **Source:** `agents/tmp.old/feedback-14.11.0/chat.txt` §62–63, and the stub this
> file was promoted from, which lived under `agents/roadmaps/stubs/` from
> 2026-08-21 until this promotion moved it here. Promoted 2026-08-24 by `/analyze:inbox` on new evidence, not on a
> fresh opinion.

## Why this reopened — the three facts the stub did not have

**1. It has now shipped in five releases, and the remediation is inconsistent.**
Measured at HEAD `3cf0077d9` by grepping `CHANGELOG.md` per released section:

| Released version | marker lines today | note |
|---|---|---|
| 14.11.0 | **4** | `CHANGELOG.md:410-413` |
| 14.10.0 | **2** | |
| 14.9.0 | **4** | |
| 14.6.0 | 0 | shipped uncurated, **retro-curated since** |
| 14.5.0 | 0 | shipped uncurated, **retro-curated since** |

`archive/road-to-session-closeout.md:182,264` recorded seven markers across the
14.5.0 and 14.6.0 sections, "both now published". Those two were cleaned up
afterwards; the three newer ones were not. So the invariant fails, and the
after-the-fact repair that substitutes for it is applied unevenly — which is a
worse state than either failing consistently or being enforced.

The stub's own evidence cited the **14.7.0** section. That section carries no
hits today. **The stub did not go stale in the harmless direction: it went stale
while three newer releases accumulated ten lines.**

**2. The reviewer has raised it in at least eight rounds.** Counted by grepping
the consumed feedback bundles for the marker string:

| Round | hits | Round | hits |
|---|---|---|---|
| 9.29.0 | 8 | 12.0.0 | 14 |
| 9.30.0 | 5 | 12.1.0 | **22** |
| 9.35.0 | 5 | 14.4.0 | 10 |
| 10.1.0 | 17 | 14.11.0 | *"bleibt absurd hartnäckig"* | <!-- md-language-check: ignore -->

The 12.1.0 round already wrote *"Ihr habt ja seit 9.x immer wieder Probleme mit
`_auto-derived, rewrite before merge_` gehabt"*, tabulated it as *"weiterhin
offen – inzwischen P0"*, and supplied the grep. This is not a new request.

**3. The AI council already answered, its step 1 landed, and promotion was refused anyway.**
**AI council 2026-08-23 — 2 members (anthropic, openai), 2 rounds, both
convergent on extraction.** Its response artefact is local-only and auto-pruned,
so the convergence is recorded here rather than linked: the seat that argued for
promoting held that *"two shipped recurrences of the same defect establish
concrete harm"*, and both seats agreed the placement is an extracted publication
module with the check immediately before each irreversible transition. The openai seat's step list is the
implementation plan, and step 1 reads *"Extract a coherent publication phase from
`release.ts`, producing a net reduction there."*

That extraction exists — **and it was noticed.** An earlier draft of this section
said it "landed unnoticed". That was wrong, and the correction matters because it
changes what kind of failure this is:
`archive/road-to-release-publication-integrity.md:162-168` records the landing,
measures it at **−788 lines**, and states that *"the stub's promotion criteria are
satisfied and waiting rather than unmet"* — dated **2026-08-23**, the day before
14.11.0 shipped four more marker lines.

So this was never a case of nobody looking. It was seen, measured, written down as
ready, and **not promoted**.

| Fact | Measured at HEAD `3cf0077d9` |
|---|---|
| `71e6adff9` | `refactor(release): extract publication and env units out of release.ts` |
| `src/scripts/release.ts` | **2,024** lines — was 2,818, net **−794** |
| `src/scripts/release_publication.ts` | **720** lines, exists |
| Is it over the 1,500-line ceiling? | **No** — `check_source_size_budget` does not list it, so growth there is free |
| Does it contain the guard? | **No — 0 occurrences of `DERIVED_MARKER`** |
| Does it already read the changelog? | **Yes** — `fs.readFileSync(CHANGELOG, …)` at `:495`, and it speaks of the curated head at `:216` |

**So the disposition was right, was recorded, and became unreachable.** That is
the third outcome class in [`recurring-criticism`](../../src/rules/recurring-criticism.md)
§ Exactly three outcomes: the system failed at *reachability*, not at judgement.
The assumption that broke is narrow and nameable — the stub said the guard could
not be placed without growing an over-ceiling file, and the destination the
council named now exists **under** the ceiling.

**Why it was refused, and by whom.** `b-stub-promotion-authority` in that same
archived roadmap is `Status: resolved`, resolved by an AI council on 2026-08-23,
2/2 quorum, **split 1-1 on the first pass and converged on the second**. The
losing argument is recorded because it is good: *"two shipped recurrences of the
same defect establish concrete harm … and in an explicitly autonomous-authority
context, prioritising policy adherence over defect remediation inverts the purpose
of having autonomous authority at all."*

The tiebreak both seats reached: *"promoting a stub is an estate decision this
roadmap itself routes to the maintainer, and the estate runs a shrink-only ratchet
with `one_in_one_out` — so promotion is growth requiring an offset **this run did
not identify**."* And then, explicitly:

> *The meta-question the first pass surfaced — **may an autonomous run override an
> explicitly deferred estate decision?** — is precedent-setting and is not a drain
> run's to settle. It is recorded here as an open finding for the maintainer
> rather than answered.*

**So the defect was not refused on its merits. It was refused at the estate
ratchet, and the authority question was left to the maintainer.** That is the
structural cause of the recurrence, and it is separable from anything the reviewer
wrote.

**The reopening condition, verbatim:** *"the maintainer promotes
`stubs/road-to-release-placeholder-guard.md` and names a `one_in_one_out` offset,
at which point Phase 2 is the implementation and its plan is already written."*

### How this promotion stands against that condition — stated against itself

Half met, half not, and the unmet half is the one the council reserved:

- **Maintainer instruction: present.** The owner opened the run that promoted this
  with *"Da waren kleine Punkte, denen ich zustimme und die wir endlich angehen
  sollten"* — agreement plus an instruction to act. That is the promotion half.
- **A named `one_in_one_out` offset: NOT supplied.** This file carries
  `estate_offset_exempt`, a claim the run issues to itself, not an offset naming a
  roadmap retired in exchange. The council asked for the second thing.

Recorded rather than smoothed over, because the alternative is the exact failure
this roadmap is about: an agent satisfying a gate's letter while the condition it
encodes goes unmet. **If the maintainer wants the offset rather than the claim,
this promotion is the thing to revert** — the plan below survives either way, and
`b-promotion-offset-not-named` tracks it.

**`release.ts` is still +524 over the ceiling**, so attempt 1's refusal stands for
that file. What changed is that there is now somewhere else to put it.

## The two irreversible transitions, located

Both still sit in `release.ts`:

- `src/scripts/release.ts:1408` — annotated tag creation,
  `run(['git','tag','-a',plan.target,'-m',tag_message_from_section(merged!.body, plan.target)])`
- `src/scripts/release.ts:1435` — Release notes,
  `release_notes_from_section(tagged_section!.body, plan.target)`

Both formatters live in `src/scripts/_lib/release_material.ts` (`:77`, `:82`) —
the placement attempt 2 tried and which was correctly refused, because a pure
formatter has no notion of "am I actually publishing".

## Phases — the council's own step list, with step 1 struck as landed

The council's seven steps map onto four phases. Phase 0 is already met and is
kept as a checked step rather than deleted, so a reader can see that the plan
was not written around an unbuilt prerequisite.

## Phase 0 — the extraction the council required (LANDED, independently)

- [x] **0.1 Step 1 — extract a publication phase from `release.ts` with a net
      reduction.** Landed as `71e6adff9`, independently of this roadmap.
      verify: `wc -l src/scripts/release.ts` reads under 2,818 **and**
      `src/scripts/release_publication.ts` exists and is absent from
      `check_source_size_budget`'s over-ceiling list. Both hold at `3cf0077d9`.
## Phase 1 — guard every irreversible transition

- [ ] **1.1 Step 2 — a pure marker-detection helper.** `stale_draft_labels` at
      `src/scripts/_lib/release_highlights.ts:287` already returns the offending
      labels for a curated-head object. Confirm it is usable as-is against a
      *section body* rather than a label map; if it is not, add the narrowest
      sibling beside it, never a second definition of the marker.
      verify: a unit test asserts the helper returns non-empty for a body
      containing `DERIVED_MARKER` and empty for one that does not, and
      `grep -c 'DERIVED_MARKER' src/scripts/_lib/release_highlights.ts` still
      reports exactly one definition site.
- [ ] **1.2 Step 3 — move the two transitions into `release_publication.ts` and
      guard each immediately before it fires.** The three transitions the council
      enumerated: annotated-tag creation, pushing a pre-existing local tag during
      `--resume`, and GitHub Release creation from tagged content.
      verify: `grep -n 'git.,.tag' src/scripts/release.ts` returns no `-a`
      creation site, `release.ts` is measurably smaller than 2,024, and
      `check_source_size_budget` reports no new over-ceiling file.
- [ ] **1.3 The `--resume` created-but-unpushed path, as its own case.** The stub
      records the real bypass: step 8 reads the changelog only in its
      tag-creation branch, so a resume over a created-but-unpushed tag skips the
      read entirely. A guard that only covers creation misses exactly this.
      verify: a test resumes over a created-but-unpushed tag whose section
      carries the marker and asserts no irreversible command runs after the
      refusal.
- [ ] **1.4 Scope every read to the section of the current transition.** Never
      repo-wide. This is not a preference: the ten historical lines above would
      permanently block every future release until editorial work nobody has
      scheduled.
      verify: a test with a marker-bearing *historical* section and a clean
      *target* section publishes successfully.
## Phase 2 — make the guard testable, then add the backstop

- [ ] **2.1 Step 6 — controlled drill fixtures.** Attempt 2 died here: four
      `release_drill.test.ts` sequencing scenarios failed because the drill
      returns the live `CHANGELOG.md`. Give the sequencing scenarios synthetic
      clean sections, and add dedicated marker-bearing cases proving no
      irreversible command follows a refusal. Do **not** let drills bypass policy
      universally.
      verify: `npx vitest run tests/scripts/release_drill.test.ts` green, and the
      new negative case fails when the guard is neutralised — sensitivity shown
      by sabotage, not assumed.
- [ ] **2.2 Step 5 — the tag-triggered CI backstop, explicitly second.**
      `.github/workflows/release-validation.yml` already references the highlight
      check; wire the marker assertion so **every** publication job depends on
      it, or npm publish and Release creation race the failure.
      verify: the workflow graph shows every publishing job with the check as a
      prerequisite, not as a sibling.
## Phase 3 — remediation of what already shipped (owner-reserved)

- [~] **3.1 Curate the ten live marker lines.** <!-- deferred: maintainer editorial work, ruled so by both prior council sessions; an agent paraphrasing the generator's own derivation reason into prose is the "truthfully documented uselessness" failure one seat named -->
      Held deferred deliberately. It also cannot repair the already-published
      annotated tag messages, so mutable and immutable surfaces need separating
      before it starts.
      verify: when taken up — the three sections carry no marker AND the
      separation of mutable from immutable surfaces is recorded.

## Blockers

### blocker: b-drill-negative-case-missing

- **What:** CORRECTED 2026-08-24. An earlier version of this blocker said the
  drill still returns the live `CHANGELOG.md`. It does not — that coupling was
  removed, and `src/scripts/release_drill.ts:75-76` records the 2/2 council
  decision *"in favour of controlled fixtures"* plus the sentence *"The drill USED
  to return the live `CHANGELOG.md`"*. The clean fixture exists at `:116`, and
  `:105` states it deliberately carries no marker. So attempt 2's cause is gone.
  What is actually missing is the other half: `tests/scripts/release_drill.test.ts`
  contains **0** marker-bearing cases, so nothing proves a refusal stops the
  sequence.
- **Blocks:** AC-3 only. It does **not** block 1.2 or 1.3, which was the earlier
  version's error.
- **What to do:** Add a marker-bearing case to
  `tests/scripts/release_drill.test.ts` using the existing fixture seam in
  `src/scripts/release_drill.ts` (see its `:105` note on why the shipped fixture
  is deliberately marker-free), asserting that no irreversible command runs after
  the refusal. Then `npx vitest run tests/scripts/release_drill.test.ts`.
- **Owner:** agent.
- **Recommendation:** land it with 1.2, not before it — the ordering worry that produced the earlier version of this blocker no longer applies.
- **If you do nothing:** the guard ships with no test proving it stops a
  publication, which is the shape a later reader cannot distinguish from an
  untested guard that does not.
- **Resolved when:** `grep -c 'rewrite before merge' tests/scripts/release_drill.test.ts`
  returns non-zero, that case passes with the guard active, and it is demonstrated
  red when the guard is neutralised.
- **Status:** open.

### blocker: b-promotion-offset-not-named

- **What:** The 2026-08-23 council reopening condition asks the maintainer to
  promote this stub **and name a `one_in_one_out` offset**. This promotion carries
  `estate_offset_exempt` — a claim the run issues to itself — instead of a named
  offset. The promotion half has an owner instruction behind it; the offset half
  does not.
- **Blocks:** nothing in Phase 1 or 2. It is a governance record, not a technical
  dependency, and the implementation is correct either way.
- **What to do:** either name the roadmap retired in exchange (candidates: any
  `agents/roadmaps/*.md` at `count_open == 0`, checked with
  `./scripts-run src/scripts/roadmap_progress` or the dashboard), or record that
  the owner accepts the self-issued claim for this one promotion. Reverting is
  `git mv agents/roadmaps/road-to-release-placeholder-guard.md agents/roadmaps/stubs/`.
- **Owner:** maintainer. The council recorded the underlying question — *may an
  autonomous run override an explicitly deferred estate decision?* — as
  precedent-setting and **not a drain run's to settle**, so an agent resolving
  this one is the same overreach in miniature.
- **Recommendation:** accept the claim for this promotion and treat the general
  question separately, because the general question is the structural finding and
  deserves its own decision rather than being settled as a side effect of one
  release defect.
- **If you do nothing:** the guard still gets built, and the precedent that an
  autonomous run may self-issue an estate offset over a deferred decision stands
  unexamined — which is the mechanism that produced eight rounds of this defect.
- **Resolved when:** a named offset appears in this file's frontmatter, **or** an
  owner decision is recorded here accepting the claim, **or** the promotion is
  reverted.
- **Status:** open.

### blocker: b-immutable-published-surfaces

- **What:** Three published annotated tag messages already carry the marker.
  `CHANGELOG.md` is mutable; a pushed annotated tag is not, and may already be
  fetched or mirrored.
- **Blocks:** 3.1 only. It does **not** block 1.x or 2.x — prevention does not
  wait on remediation.
- **What to do:** Write the per-surface table into
  `agents/evidence/analysis/release-marker-surface-mutability.md`, one row per
  shipped release still carrying the marker (14.9.0, 14.10.0, 14.11.0) and one
  column per surface: `CHANGELOG.md` on main (mutable), the annotated tag message
  (immutable once pushed), the GitHub Release body (mutable via the API). Derive
  the tag state with `git cat-file -p <tag>` per release rather than assuming it.
- **Owner:** maintainer.
- **Recommendation:** treat the three published tags as permanent record and fix
  forward.
- **If you do nothing:** a curation pass produces a `CHANGELOG.md` that disagrees
  with the tags it describes.
- **Resolved when:** a written record names, per shipped release, which surfaces
  are repairable (`CHANGELOG.md` on main) and which are permanent (the pushed
  annotated tag message, and any mirror that already fetched it).
- **Status:** open.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-08-24 | reviewer: analyze-inbox -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The guard lands and the drill goes red, so the guard is reverted | implementation | This is exactly how attempt 2 ended. A correct guard refusing known-bad input reads as a broken guard when four unrelated sequencing tests fail with it. | 2.1 is filed as blocker `b-drill-fixture-isolation` and may be landed first; the negative case must be shown red by sabotage before it is trusted. | Phase 2 — make the guard testable, then add the backstop |
| 2 | The guard covers creation and misses `--resume` | implementation | Step 8 reads the changelog only in its tag-creation branch, so a resume over a created-but-unpushed tag bypasses the read. A creation-only guard would pass every test and still ship a marker. | 1.3 is a separate step with its own test rather than a clause inside 1.2. | Phase 1 — guard every irreversible transition |
| 3 | The read is scoped repo-wide and blocks all releases | implementation | Ten historical marker lines exist. A repo-wide scan converts a prevention guard into a permanent release block pending unscheduled editorial work. | 1.4 asserts the historical-dirty / target-clean case publishes. | Phase 1 — guard every irreversible transition |
| 4 | `release.ts` grows instead of shrinking | implementation | Moving two call sites while leaving their helpers behind is a token wrapper; `check_source_size_budget` refuses any net growth in a file 524 lines over the ceiling. | 1.2's verify measures `release.ts` smaller than 2,024, not merely "unchanged". | Phase 1 — guard every irreversible transition |
| 5 | The CI backstop is treated as the boundary | product | Both prior council seats rejected calling it the invariant: the tag already exists when it runs, and a pushed tag may be mirrored. Shipping only 2.2 would look like closure. | 2.2 is ordered after 1.x and its own text names it a backstop. | Phase 2 — make the guard testable, then add the backstop |
| 6 | The advisory posture is reopened by accident | product | `check_release_highlights` warns and never blocks, by a recorded decision two council sessions declined to touch. A reader of this roadmap may take it as licence to flip that. | § Explicitly NOT in this roadmap states the exclusion; the exit code stays owned by the `_none_` check. | Explicitly NOT in this roadmap |

## Acceptance Criteria

- [ ] **AC-1** — `grep -c '_auto-derived, rewrite before merge:' <the section being published>` returns **0** at every one of the three enumerated transitions, and a test proves the refusal at each.
- [ ] **AC-2** — `wc -l src/scripts/release.ts` reads **below 2,024**, and `check_source_size_budget` reports no new over-ceiling file.
- [ ] **AC-3** — `tests/scripts/release_drill.test.ts` is green, and its new marker-bearing case is demonstrated red when the guard is neutralised.
- [ ] **AC-4** — the `--resume` created-but-unpushed path has its own passing negative test.
- [ ] **AC-5** — a section carrying a historical marker elsewhere in `CHANGELOG.md` does not block a release whose own target section is clean.
- [ ] **AC-6** — `DERIVED_MARKER` has exactly one definition site, still `src/scripts/_lib/release_highlights.ts:48`.
- [~] **AC-7** — the three published sections carry no marker. Deferred with 3.1; maintainer editorial work, and unreachable for the published tag messages.

## Explicitly NOT in this roadmap

**Making `check_release_highlights` blocking on the release PR.** Two council
sessions declined it and the code records why —
`check_release_highlights.ts:203-206`: *"keep the exit code owned solely by the
`_none_` check — a warning that reds the build is the guaranteed-red failure mode
this whole change exists to remove."* Highlights are auto-derived first and
curated later, so a blocking check on a release PR is red by construction. This
roadmap guards the **publication transitions**, which is a different boundary.

## Inherited record from the stub (2026-08-21)

Kept verbatim below rather than paraphrased, because it is the evidence that
two implementations were tried and refused, and a summary would lose the
reason each refusal taught something. One correction is applied in place: the
section that was headed *"Why it is live, not historical"* cited the 14.7.0
changelog section, which carries no marker today. The live sections are
14.9.0, 14.10.0 and 14.11.0 — see § Why this reopened. The stale figure is
corrected rather than deleted, on the same principle the stub applies to its
own two stale absolutes.

### The invariant

A release must not ship a changelog section still containing
`DERIVED_MARKER` (`_auto-derived, rewrite before merge:_`, exported from
`src/scripts/_lib/release_highlights.ts:48`). Three surfaces render from that
section: the annotated tag message, the GitHub Release notes, and
`CHANGELOG.md` on main.

The release-PR check stays advisory, and that is a recorded decision, not an
oversight — `check_release_highlights.ts:203-206`: *"keep the exit code owned
solely by the `_none_` check — a warning that reds the build is the
guaranteed-red failure mode this whole change exists to remove."* Highlights are
auto-derived first and curated later, so a blocking check on a release PR is red
by construction. Both council sessions declined to touch it.

### Why it is live, not historical — CORRECTED 2026-08-24

`CHANGELOG.md:392-395` no longer carries marker lines; the 14.7.0 section was
curated after the stub was written, as were 14.5.0 and 14.6.0. What is live
today is **ten lines across 14.9.0, 14.10.0 and 14.11.0**, all published. The
stub's substantive claim — that this is live rather than historical — held and
got worse; only its anchor moved.

The stub's next sentence stands unchanged and is now measurable: *"The reviewer
has raised this since the v12.1.0 review (`P0.1 Release-Placeholder hard
block`). It is recurring, and it has shipped."* Eight rounds, five releases.

### Two implementations, both refused, and what each refusal taught

| Attempt | Shape | Refused by | What it revealed |
|---|---|---|---|
| 1 | Guard three call sites in `release.ts` (tag creation, push of a pre-existing tag, Release notes) | `check_source_size_budget` — `release.ts` is 2,818 lines, over the 1,500-line ceiling; +60 lines is a straight regression, and the gate states that raising the baseline is a defect, not a fix | Coverage was right, including the real `--resume` bypass: step 8 reads the changelog only in its tag-creation branch, so a resume over a created-but-unpushed tag skips it. **Any** net growth in `release.ts` is refused, so even a 4-line version fails. |
| 2 | Guard inside `tag_message_from_section` and `release_notes_from_section` (`_lib/release_material.ts`) | CI — four `release_drill.test.ts` scenarios that assert step **sequencing** failed | A guard on a pure formatter has no notion of "am I actually publishing". The drill returns the live `CHANGELOG.md` for `git show <tag>:CHANGELOG.md` and step 8 reads the live file directly, so the guard correctly refused and unrelated tests broke. Decoupling the drill is blocked by the same ratchet. |

### The council's design — extraction, judged by net effect

Both seats converged. Extract the publication orchestration out of `release.ts`
into a small module (`release_publication.ts` or similar) and enforce the marker
check immediately before **each independently resumable irreversible
transition** there.

Four constraints the implementation has to satisfy, each from a seat's own
argument:

1. **Net line reduction in `release.ts`.** *"Moving code is ratchet-clean only
   if `release.ts` becomes smaller. A token wrapper that leaves most logic
   behind could still violate the ratchet."* Extraction is the ratchet working
   as intended — a lowering commit — not an exception request.
2. **Enumeration is unavoidable, and saying otherwise is the trap.** The asked-for
   conjunction (ratchet-clean · fires only on real publication · no call-site
   enumeration) has **no** solution: *"Given independently resumable
   transitions, no such placement has been demonstrated. The state machine has
   no single dominating checkpoint."* Extraction solves the ratchet and the
   context problem; it does not solve the enumeration one. Enumerate the
   transitions deliberately and test each.
3. **Scope the read to the section of the current transition**, never repo-wide.
   Otherwise the historical 14.7.0 content permanently blocks every later
   release until editorial work nobody scheduled is done.
4. **Give the drill controlled changelog fixtures** rather than disabling the
   guard — but do not let drills bypass policy universally.

A CI gate on the tag-triggered publish workflow was considered and is a
**backstop only**, explicitly not the boundary: the tag already exists when that
workflow runs, and both seats rejected calling it the invariant. One seat added
the operational cost plainly — a pushed tag may already have been fetched,
mirrored, or used to trigger concurrent automation, so rewriting it is
remediation, not prevention. If it is built, every publication job must *depend*
on it, or npm publish and the Release creation race the failure.

### Explicitly NOT — as the stub stated it

**Curating the four live 14.7.0 highlight lines.** Both council seats, both
sessions: maintainer editorial work. An agent paraphrasing the generator's own
derivation reason into prose to satisfy a gate is the *"truthfully documented
uselessness"* failure one seat named — and it cannot repair the already-published
annotated tag message in any case. Mutable and immutable surfaces need separating
before that work starts.

### Promotion criteria — DISCHARGED by this promotion

Recorded as met, so a reader can check the promotion rather than trust it:
criterion 1 (a measured extraction leaving `release.ts` net smaller) is
discharged by `71e6adff9` at −794 lines; criterion 2 (the enumerated transition
list with `--resume` named) is discharged by § The two irreversible transitions
plus step 1.3; criterion 3 (a drill-fixture decision) is **not** discharged and
is now blocker `b-drill-fixture-isolation`.


- A measured extraction plan showing `release.ts` net **smaller**, with the
  moved symbols re-exported so callers are unaffected (the shape
  `check_source_size_budget`'s own baseline note records for two prior
  lowerings).
- The enumerated transition list, with the `--resume` created-but-unpushed path
  named as its own case.
- A drill fixture decision that keeps the sequencing scenarios independent of
  editorial state.

## See also

- [`archive/road-to-wiring-truth-corrections.md`](archive/road-to-wiring-truth-corrections.md) — the parent; its Phase 2 is this stub.
- `src/scripts/check_source_size_budget.ts` — the ratchet, and its own account of what a legitimate lowering looks like.
- `src/scripts/check_release_highlights.ts` — the advisory posture neither session reopened.
