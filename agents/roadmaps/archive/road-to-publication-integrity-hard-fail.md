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

- [x] **1.1 Record the reversal before changing the behaviour.** The decision
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
- [x] **1.2 Make the existing detection blocking instead of advisory.**
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
- [x] **1.3 Scope every read to the section under release, never repo-wide.**
      Eighteen historical marker lines and forty-four historical instruction
      comments exist. A repo-wide read would block every future release until
      editorial work nobody has scheduled — which is how a correctness guard
      turns into a permanent red.
      verify: a test with a marker-bearing *historical* section and a clean
      *target* section exits 0.
- [x] **1.4 Show the guard's sensitivity by sabotage.** Neutralise the new
      branch, watch the negative case go red, restore it. A test never seen red
      has unknown sensitivity.
      verify: the red-then-green transcript is recorded in the pull request,
      naming the line neutralised.

## Phase 2 — stop shipping the authoring instruction

> **BOTH STEPS LEFT OPEN 2026-09-01 — the step's premise does not hold and the
> design fork is not this run's to settle. Not attempted rather than
> attempted-and-fudged.**
>
> **There is no `Unreleased` draft in the generator.** `render_release_head`
> (`src/scripts/release.ts:317`) has exactly one caller,
> `render_changelog_entry:549`, which always writes a versioned heading
> (`:514-521`). The string `Unreleased` appears nowhere in `release.ts`,
> `_lib/release_material.ts` or `_lib/changelog_eras.ts`; the `## [Unreleased]`
> at `CHANGELOG.md:17` is hand-maintained and predates this pipeline. So 2.1's
> verify half (a) — *"present in an `Unreleased` draft section and absent from a
> released one"* — has no subject in the tree.
>
> **2.2 cannot land first.** If the gate reds on the instruction comment while
> the generator still writes it into every section it cuts, every release PR is
> red on its first run — Risk 1 of this register, exactly. The order is forced,
> so the fork blocks both steps.
>
> **Two defensible designs, written up with the evidence for each** in
> [`publication-integrity-hard-fail-execution.md`](../evidence/analysis/publication-integrity-hard-fail-execution.md)
> § 3: (A) drop the comment from the changelog and put the reminder in the
> release PR body, which is never published; (B) add a `draft` parameter to
> `render_release_head`, which satisfies the verify clause word for word and
> creates a code path no production caller would ever take. A third option —
> stripping the comment from the merged changelog at tag time — is rejected
> there without needing a decision.
>
> **Consequence for Phase 3:** `publication_blockers`
> (`src/scripts/_lib/release_highlights.ts:328`) checks the marker only and
> deliberately not the comment, and says so in its own docstring. **AC-2 stays
> `[ ]`** with these steps.

### PHASE 2 — DISPOSITION 2026-09-01 (drain run 14): OPTION D, WITH OPTION A's DESIGN RECORDED

> **SUPERSEDED 2026-09-01 by drain run 15 — see § PHASE 2 — EXECUTED below.**
> Everything in this block stands as written and is the reason the execution
> was a read rather than a design exercise. Only its *disposition* changed, and
> it changed on the condition this block itself names: D was taken **because
> owner approval was unavailable**, and the owner then supplied a written
> standing instruction delegating that approval to the council.

> **2.1, 2.2 and AC-2 stay `[ ]`. Option A is the right architecture and is NOT
> applied here.** Everything the owner needs to approve A in one step is written
> out below, so approving it is a read rather than a design exercise.

*AI council 2026-09-01 (drain run 14), members `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
quorum **2/2 present** (needed 1) — concluded. Subscription transport,
`billable=0`, `$0.0000`.*

**This took two attempts, and the first one does not count.** The first round ran
**DEGRADED — 1/2 present**: one seat was unavailable and the tool itself printed
*"this is not convergence."* The retry reached 2/2. Recorded because a reader who
finds only the second round would otherwise assume it was clean on the first
pass. A degraded round is not a council round.

Council artefacts are gitignored and auto-pruned, so every line relied on is
inlined here per `no-roadmap-references`; no path under
`agents/runtime/council/` is cited.

#### 1. The false premise, and the measured publication boundary

**Step 2.1 rests on a lifecycle the generator does not have.** Re-verified at
this commit, after the prose insertions above moved the line numbers once
already:

- `render_release_head` (`src/scripts/release.ts:320`) has exactly **one**
  caller — `render_changelog_entry` (`:509`), at `:552`.
- `render_changelog_entry` always writes a **versioned** heading (`:517-524`):
  `## [X.Y.Z](…compare…) (date)`, or `## X.Y.Z (date)` when there is no previous
  tag. There is no draft branch.
- The string `Unreleased` appears **0 times** in `src/scripts/release.ts`,
  `src/scripts/_lib/release_material.ts` and
  `src/scripts/_lib/changelog_eras.ts`.
- The `## [Unreleased]` at `CHANGELOG.md:17` is hand-maintained and predates
  this pipeline — introduced by `032a244a3`.

So 2.1's verify half (a), *"present in an `Unreleased` draft section and absent
from a released one"*, has no subject in the tree.

**The publication boundary, measured rather than assumed.** The first (degraded)
round's seat asserted that `dist/CHANGELOG.md` is the npm-shipped artifact. The
blind chairman flagged it as an uncited claim, and the claim is **false**:

| Measurement | Result |
|---|---|
| `dist/CHANGELOG.md` exists | **no** — the path does not exist |
| `package.json` `files` entry | the bare `"CHANGELOG.md"`, i.e. the repository root |
| `npm pack --ignore-scripts` archive member | **`package/CHANGELOG.md`** |
| member vs root `CHANGELOG.md` | **byte-identical** (`sha256 a30d518d…`) |
| member size | 86.3 kB |
| `Curated head: fill before merge` occurrences **in the shipped member** | **2** |

`--ignore-scripts` is used because `prepack` runs a full build; the file list and
the archive member names are unaffected by it. The last row is the defect at the
publication boundary rather than inferred from it: the package on npm today
carries the generator's authoring instruction twice.

**This is the reason the acceptance test targets what it does.** A check written
against `dist/CHANGELOG.md` would pass while the comment ships.

#### 2. The rejected options, with the council's reasons

- **Option B — a `draft` parameter on `render_release_head`.** Rejected 2/2, as
  *"a fictitious draft mode"* and *"an unreachable production mode"*: no
  production caller would ever pass `true`, so it is a code path policing a
  population of zero, and it asserts a mode the pipeline does not have.
- **Option C — strip the comment from the merged changelog at tag time.**
  Rejected 2/2 as mutation at the most dangerous point in the release lifecycle.
  This run had already rejected C on the same ground before the council saw it;
  that the council reached it independently is worth recording, because it means
  the rejection does not rest on one party's judgement.

#### 3. The re-scope — AUTHORISED 2/2, and deliberately NOT applied

The council authorised re-scoping 2.1's verify clause, because the original tests
a lifecycle that does not exist. One seat attached the condition that matters:
the roadmap must record that **the original criterion was invalidated by measured
architecture** — the literal criterion is never silently marked complete. That
condition is discharged by § 1 above.

**It is not applied because the step it re-scopes cannot land until the owner
rules on authority (§ 4).** Re-scoping a clause for a step that stays `[ ]` would
change the contract without changing anything it governs.

The re-scoped clause, written out in full so approving it is a read:

> **2.1 (re-scoped, pending owner approval of Option A).** verify: a unit test on
> `render_release_head` asserts the authoring instruction is **absent** from its
> output; a unit test on `pr_body_from_section`
> (`src/scripts/_lib/release_material.ts:72`) asserts the instruction is
> **present** in the release-PR body it renders; and an acceptance test over
> `npm pack` asserts the prohibited instruction is absent from the extracted
> bytes of the archive member `package/CHANGELOG.md`. The original clause —
> *"present in an `Unreleased` draft section and absent from a released one"* —
> was invalidated by measured architecture (§ 1) and is superseded, not met.

#### 4. The authority split — both positions, unparaphrased

The seats agreed on the architecture and **split on who may authorise it**. In
this repository a split is an **escalation condition**, not a tie to be broken.

- **Council-decidable.** Option A strengthens a floor — it removes an instruction
  that should never have published — is reversible within the envelope, fixes a
  defect rather than changing a designed surface, and the release-PR body is
  internal release tooling rather than a public commitment.
- **Owner-reserved.** Option A changes what npm consumers receive in the root
  `CHANGELOG.md`, where release operators receive their instructions, and the
  semantics of PR-body/changelog equality — *"ownership questions, not just
  technical direction"*. And, explicitly: *"If that approval is unavailable,
  choose D temporarily rather than treating council review as ownership
  authority."*

That last sentence is the disposition. **D is taken.** Neither position is
recorded as having conceded; the escalation is the outcome.

**Both seats independently held that A is more coupled than the fork write-up
presented**, and that is a correction to this run's own analysis rather than a
council preference: the PR-body equality contract must be **specified first**,
and the writer change, the PR-body adaptation, the equality handling and the
tests form **one atomic merge unit**. So even on the permissive authority
reading, A was not shippable in this pass.

#### 5. The acceptance-test specification

A suite, not one fixture. This is the most reusable part of the ruling.

**Acceptance — over the real pack:**

1. `npm pack` succeeds and produces a **newly created** tarball. A stale tarball
   from an earlier run must not satisfy the test.
2. The tarball contains exactly the expected `package/CHANGELOG.md` member.
3. That member is non-empty and is the root changelog intended for publication.
4. The prohibited instruction is **absent from its extracted bytes** — extracted,
   not inferred from the file on disk.
5. **No `dist/CHANGELOG.md` fallback can satisfy the test.** The path does not
   exist today; a test that would pass if it did is testing the wrong artifact.
6. Restoring the writer's leaked instruction **makes this test fail**.
7. Pack failures, missing members, stale tarballs and extraction failures all
   **fail closed**.

**Unit:** `render_release_head` output (instruction absent);
`pr_body_from_section` output (instruction present).

**Integration:** full release-PR generation plus the equality check.

**Regression:** sabotage sensitivity — the suite fails when the writer's emission
is restored.

**One seat's warning, carried because it is the kind that is ignored.** A shape
match such as `/<!-- .* should(?: only)? be .* -->/` is **overbroad and
under-specified**: it can reject unrelated legitimate comments while missing the
prohibited instruction after harmless rewording or multiline formatting. The
invariant needs a **named sentinel**, not a shape match — the same discipline
`DERIVED_MARKER` already follows, defined once at
`src/scripts/_lib/release_highlights.ts:64` and imported by every consumer
including the drill fixture.

#### 6. Required sequencing — one atomic unit

1. Define the structured PR-only region and the equality semantics.
2. Change the writer.
3. Adapt the PR body.
4. Normalise equality.
5. Tests.

`check_release_surface_equality` must exclude only a **structured PR-only
region** — never relax equality across the whole body. Relaxing it wholesale
would remove the release-truth Phase 1 guarantee that the PR body and the
changelog say the same thing, which is a larger floor than the one Option A
strengthens.

#### 7. Phase 3's marker-only guard is downstream of this, and stays as built

`publication_blockers` (`src/scripts/_lib/release_highlights.ts:328`) checks the
draft marker and **not** the authoring comment. That is deliberate and it is not
an oversight to be repaired when A lands: while the generator still writes the
comment into every section it cuts, refusing on it would red every release on its
first run — Risk 1 of this register. When Option A is approved and the writer
stops emitting it, extending `publication_blockers` to the comment becomes safe
and belongs in A's atomic unit, step 5.

- [x] **2.1 The generator must not leave its own instruction comment in a
      released section.** `render_release_head` wrote
      `<!-- Curated head: fill before merge, keep it under 10 lines… -->` into
      the section it creates, and nothing removed it at release time. **Done
      2026-09-01 (drain run 15), Option A:** the writer emits no comment, and
      the reminder moved into the release-PR body's delimited PR-only region —
      a surface that is never published.
      verify **(re-scoped; the original clause was invalidated by measured
      architecture and is superseded, NOT met — see § PHASE 2 — EXECUTED)**: a
      unit test on `render_release_head` asserts the authoring instruction is
      **absent** from its output; a unit test on `pr_body_from_section`
      (`src/scripts/_lib/release_material.ts`) asserts the instruction is
      **present** in the release-PR body it renders; and an acceptance test over
      `npm pack` asserts the prohibited instruction is absent from the extracted
      bytes of the archive member `package/CHANGELOG.md`. All three live in
      `tests/scripts/release_material.test.ts` and pass; the acceptance test was
      observed RED against the real package before the changelog was curated.
      `grep -c 'Curated head: fill before merge' CHANGELOG.md` now reads 0.
- [x] **2.2 The gate reds on a shipped instruction comment in the target
      section.** This is a different mechanism from 1.2 — a leaked instruction,
      not an unpolished claim — so it needs its own fixture rather than riding
      on the marker check. **Done 2026-09-01 (drain run 15):** the check lives
      in `check_release_highlights.main` on the ONE section
      `extract_changelog_section` cut for `--version`, and detects the named
      sentinel rather than a comment shape. `publication_blockers` carries the
      same check for the two irreversible transitions, which is safe only now
      that the writer has stopped emitting — Risk 1 of this register, and the
      reason the order was forced.
      verify: a negative fixture whose target section contains the literal
      comment exits 1, and a fixture whose *historical* section contains it
      exits 0. Both in `tests/scripts/check_release_highlights.test.ts`
      § 1.3; neutralising the check turned the first red and restoring it
      turned it green.


### PHASE 2 — EXECUTED 2026-09-01 (drain run 15): OPTION A, UNDER A DELEGATED APPROVAL

*AI council 2026-09-01 (drain run 15), members `anthropic/claude-sonnet-4-5` +
`openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
quorum **2/2 present** (needed 1) — concluded. Subscription transport,
`billable=0`, `$0.0000`. Council artefacts are gitignored and auto-pruned, so
every line relied on is inlined here per `no-roadmap-references`.*

**Verdict 1A — the delegation reaches it, convergent 2/2.**

The condition was in the drain-14 record all along, and it was a conditional,
not a refusal: *"If that approval is unavailable, choose D temporarily rather
than treating council review as ownership authority."* The owner's standing
instruction for this run states that *"the council's recorded decision
substitutes for user sign-off"*. Approval is no longer unavailable, so the
branch the earlier council attached D to is no longer the live branch. Both
seats reached 1A independently; one added the discriminator that decides it:
*"Option A neither lowers a safety floor nor expands agent authority; it
removes inappropriate publication content."*

**What was NOT re-argued.** The architecture was already 2/2 in drain run 14
and is not reopened here: Option B (a `draft` parameter creating a production
mode no caller takes) and Option C (stripping the comment at tag time) stay
rejected on their original grounds. This run changed the *authority* answer
only.

**The authorisation conditions, and where each is discharged:**

| Condition | Discharged at |
|---|---|
| the prohibited instruction is a **named exported sentinel**, never a shape match | `CURATED_HEAD_INSTRUCTION` in `src/scripts/_lib/release_material.ts`, imported by both gates |
| the PR-only region is **explicitly delimited** | `PR_ONLY_START` / `PR_ONLY_END`, same module |
| `strip_pr_wrapper` excludes **exactly** that region | `strip_pr_only_regions`, delimiter-bounded; an unterminated region is left standing so it surfaces as divergence |
| equality is **not relaxed generally** | test *"equality is NOT relaxed: a difference outside the region still reds"* in `tests/scripts/release_material.test.ts` |
| writer, PR body, comparison and tests ship as **one atomic unit** | this branch, one PR |
| the acceptance test runs over **extracted bytes** of a **freshly created** tarball, with no `dist/CHANGELOG.md` fallback | *"acceptance over npm pack"* in the same test file |
| **sabotage sensitivity observed**, not asserted | recorded below |

**Sensitivity, observed in both directions on this branch.** Neutralising the
instruction check in `check_release_highlights.ts` and in `publication_blockers`
turned 3 specs red; restoring them turned them green. Re-adding the writer's
emission turned 2 further specs red. The acceptance test was **written before
the changelog was curated and observed RED against the real package** — the
extracted member carried the instruction twice at that moment — and went green
only after the two comment lines were deleted. A guard never seen red has
unknown sensitivity; these were seen red first.

**2.1's verify clause is superseded, not met.** The original clause tested a
lifecycle the generator does not have — drain run 14 measured that `Unreleased`
appears 0 times in `release.ts`, `_lib/release_material.ts` and
`_lib/changelog_eras.ts`, and that `render_release_head` has exactly one caller
which always writes a versioned heading. The re-scoped clause the drain-14
council authorised verbatim is the one recorded on the step below. The literal
original criterion is **not** silently marked complete, which was the condition
one seat attached to authorising the re-scope.

**One relocation, named because it is the only line in this diff not obviously
about the defect.** `RELEASE_HEAD_CAP_LINES` and the `_none_` default moved
from `release.ts` into `_lib/release_material.ts`, which has **zero imports**
by design — the equality gate, the drill fixtures and the unit tests all reach
it, so a dependency there is a dependency in all three. `release.ts` re-exports
`RELEASE_HEAD_CAP_LINES` under its original name, so no referencing site
changed.

**One downstream test changed its assertion, and it asserted the defect.**
`tests/scripts/release.test.ts` § *"fits the operator-facing cap"* required
`head.some(l => l.startsWith('<!--'))` to be **true** — i.e. it pinned that the
writer emits the instruction. It now requires `false`. The cap half of that
test is untouched.

## Phase 3 — extend to the two irreversible transitions

- [x] **3.1 Guard the annotated tag and the GitHub Release body immediately
      before each fires.** Both transitions sit in `release.ts` — tag creation
      at `:1408`, Release notes at `:1435` — and both formatters live in
      `src/scripts/_lib/release_material.ts:77,82`. The guard goes at the call
      site, not in the formatter: a pure formatter has no notion of whether it
      is actually publishing, which is why an earlier attempt at that placement
      was refused.
      verify: a test asserts that no irreversible command runs after a refusal,
      and `grep -n "git.,.tag" src/scripts/release.ts` shows no `-a` creation
      site outside the guarded path.
- [x] **3.2 Cover the `--resume` created-but-unpushed tag path as its own
      case.** The recorded bypass: the changelog is read only in the
      tag-creation branch, so a resume over a tag that was created but not
      pushed skips the read entirely. A guard that only covers creation misses
      exactly this.
      verify: a test resumes over a created-but-unpushed tag whose section
      carries the marker and asserts the refusal lands before any push.

## Blockers

### blocker: b-retro-curation-scope

- **Status:** resolved 2026-09-01 (drain run 15) — **option (c) recorded and
  executed** under the owner's standing delegation, by AI council verdict 2c,
  convergent 2/2 (`anthropic/claude-sonnet-4-5` + `openai/codex-default`,
  2 rounds, deep, peer-review, blind chairman, quorum 2/2 present, needed 1;
  subscription transport, `billable=0`, `$0.0000`).

  **The mutable/immutable split, which `Resolved when` requires as a separate
  record:**

  | Surface | Class | Disposition |
  |---|---|---|
  | the 2 authoring-instruction comments in `CHANGELOG.md` (14.12.0, 14.13.0) | mutable | **deleted** — machine-written, never release content; `grep -c` now reads 0 |
  | the 8 `_auto-derived, rewrite before merge:_` head lines in `CHANGELOG.md` | mutable | **preserved as published**, with a dated note above `## [Unreleased]` stating they were generator-derived and are deliberately not paraphrased |
  | the 42 occurrences in `docs/archive/CHANGELOG-pre-*.md` | mutable | **untouched** — archives are historical record, which is what option (c) says |
  | annotated tag messages for 14.9.0–14.13.0 | **immutable** | unrepairable; recorded as such |
  | published GitHub Release bodies for 14.9.0–14.13.0 | **immutable** | unrepairable; recorded as such |

  **Why the eight marker lines were NOT rewritten, although (c) permits
  curating the current era.** The council authorised bounded editorial
  execution and bounded it in the same breath: *"Do not paraphrase the
  generator's derivation explanation merely to eliminate a marker"*, and *"if
  release evidence cannot support useful prose, preserve that individual item
  as unresolved rather than inventing copy."* The blind chairman narrowed
  further — mechanical deletion where the evidence is unambiguous, editorial
  judgement escalated. Deleting a machine-written instruction comment is
  unambiguous; rewriting eight derived claims about five past releases is the
  *"truthfully documented uselessness"* two prior councils reserved. So the
  mechanical half was executed and the editorial half was recorded as a
  deliberate preservation, which is what the note in `CHANGELOG.md` says in the
  published surface itself rather than only here.
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

> **Status 2026-09-01 (drain run 15).** All six are met. AC-2 was the last
> open one and is met by Option A; the earlier line below said it stayed `[ ]`
> blocked by the Phase 2 fork, and that fork was resolved by a delegated
> approval rather than by the fork moving. AC-6 changed from met-by-STANDING to
> met-by-execution when `b-retro-curation-scope` was resolved as option (c).
>
> - **AC-5 is answered NONE, with its reason**, recorded in the tree at
>   `docs/contracts/CHANGELOG-conventions.md` § No escape hatch. The
>   discriminating fact: the gate runs only on the release PR
>   (`.github/workflows/release-validation.yml:266`, release-PR-gated), so the
>   remedy is a one-line edit in a file the releaser already has open, and no
>   state exists in which a bypass flag is cheaper than the fix it bypasses.
>   Reopening trigger recorded with it.
> - **AC-6 was met by its STANDING branch on 2026-09-01 and is now met by
>   EXECUTION.** The line below is kept as written because it records the state
>   the drain-14 run left: the blocker was open, nothing had curated a published
>   section, and the editorial prose was owner-reserved by two prior council
>   rulings. Drain run 15 resolved the blocker as option (c) under a delegated
>   approval, deleted the two instruction comments from the published changelog,
>   and recorded the mutable/immutable split in the blocker entry.
>   *(superseded)* `blocker: b-retro-curation-scope` is untouched and open, and
>   its `Resolved when` already separates the mutable surfaces (CHANGELOG
>   sections) from the immutable ones (annotated tag messages, published Release
>   bodies for 14.9.0-14.13.0). Nothing here curated a published section; the
>   editorial prose is owner-reserved by two prior council rulings.
> - **AC-1's sabotage** and the two runs that came back GREEN before the fixture
>   was repaired are in
>   [`publication-integrity-hard-fail-execution.md`](../evidence/analysis/publication-integrity-hard-fail-execution.md)
>   § 2.


- [x] AC-1 — the release gate exits non-zero when the section under release
      carries `_auto-derived, rewrite before merge:_`, and the negative case has
      been shown red with the guard neutralised and green with it restored.
- [x] AC-2 — a CHANGELOG section cut after this change carries no
      `<!-- Curated head: fill before merge` comment, pinned by a writer test.
      Met 2026-09-01 (drain run 15) by Option A: the writer test, the PR-body
      test and the `npm pack` acceptance test all pass, and the two comments
      already published in the current era were deleted under blocker
      `b-retro-curation-scope` option (c).
- [x] AC-3 — a marker-bearing historical section does not block a release whose
      own section is clean, pinned by a test.
- [x] AC-4 — the reversal of the advisory decision is recorded at both sites
      that state it, dated, with the instructing authority named.
- [x] AC-5 — the escape-hatch question from risk 2 is answered in the tree:
      either one documented flag exists whose use is printed, or the absence is
      stated with its reason.
- [x] AC-6 — retro-curation of the eighteen published marker lines and
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
