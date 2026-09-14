---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  Receiver for the one survivor of inbox round `inbox-2026-09-w` batch 2 that no artefact in the
  tree owns: the repository models four roadmap step states and no fifth state for "valid to
  develop, must not publish". Verified 2026-09-11 — `grep -rliE 'release.hold|release_safety|
  release-safety' src/ docs/ .github/` returns zero hits, and `grep -ln 'templates/roadmaps.md|
  release.ts|release-gate-locality|release-validation' agents/roadmaps/*.md` returns empty, so
  no active roadmap owns the template or the release path. Also grows open_blockers by two,
  both of which close inside Phase 1 and Phase 0 respectively.
estate_offset_exempt: >-
  Nothing in the active estate can be offset against this. The active roadmaps are host-delivery,
  grant-persistence, decision-closure, adversarial-verification and settings-writer debt; none
  touches the release path, so archiving one to buy the slot would dispose of somebody else's
  open work to record a decision about this one. The nearest offset candidate,
  `agents/roadmaps/stubs/road-to-release-placeholder-guard.md`, has been held on this same
  estate wall for 21 days and is itself blocked — it cannot be the trade.
---
# Road to release holds that refuse

> **Source:** `agents/tmp.old/inbox-2026-09-w/roadmap-release-blocker/` — a deferred inbox batch
> (four plan revisions plus the originating transcript), analysed 2026-09-11. The governing
> constraint is one sentence the owner wrote once in that transcript: *mid-roadmap releases must
> stay possible, and a broken intermediate state must not ship by accident.* Claim verification
> at HEAD: 24 of 31 claims still true, 2 overtaken by work that shipped since, 3 never true at
> drafting, 2 unverifiable. The three corrected steps below are tagged
> `corrected-from-reproduction`.

## Goal

A roadmap declares, in a form one evaluator reads, exactly which of its intermediate tree states
must not be published — bound to the checkboxes that open and clear that state — and all four
release boundaries refuse to publish while such a state is open **or cannot be evaluated**. An
unfinished roadmap never blocks a release, and normal CI never reddens for a valid open window.

The two halves are equally load-bearing. Today the release path is roadmap-blind
(`src/scripts/release.ts` carries exactly one occurrence of the word `roadmap`, at `:322`,
inside a comment), and the template forbids a roadmap from saying anything about shipping
at all (rule 13). So the state exists in the tree — three of seven active roadmaps were
mid-flight when 15.0.0 shipped — and nothing can express it, let alone refuse on it.

> **Three figures in the paragraph above were corrected 2026-09-14, none of them load-bearing.**
> `release.ts` read 1,826 lines here and 1,814 in the proposal brief; it is **1,730** today and
> the count is incidental — it moves with unrelated work and is dropped rather than re-pinned.
> The `roadmap` occurrence is at `:322`, not `:320`. The mid-flight figure read *four* of seven;
> step 0.2 measured **three** on 2026-09-13 and this sentence was not updated with it. The
> load-bearing half — **exactly one** `roadmap` occurrence, in a comment, so the release path
> cannot see a roadmap at all — reproduces unchanged.

## Phase 0 — Measure first, and record the honest null up front

> **Closed 2026-09-13, all four steps.** Evidence:
> `agents/evidence/analysis/release-holds-phase-0-2026-09-13.md`. One correction to the
> frontmatter's `estate_growth_exempt` note, which says both blockers close inside Phases 1
> and 0: `zero-live-subjects` did NOT close here. Its evidentiary half is closed — the check
> ran and its result is recorded — but its `Resolved when` asks for an *accepted* plan, and
> acceptance is an owner act. See its `Evidence (2026-09-13)` field below.

- [x] **0.1 Count release-coupling prose across all four roadmap folders.** Write the count, the
      search terms and the per-file hits to `agents/evidence/analysis/`.
      verify: the file records that the **active** corpus holds zero release-coupling sentences
      at HEAD, and that the last known instance closed in
      `agents/roadmaps/archive/road-to-a-graph-that-is-shipped.md:960-961`, where its two coupling
      risks read MITIGATED (`:973`) and DISCHARGED (`:978`). Zero is the recorded finding, not a
      failure of the sweep. `corrected-from-reproduction` — the source step pointed at
      `:569-570` of an active file; the file is archived and the line numbers moved.
      LANDED 2026-09-13 at `7182f5d07` — `agents/evidence/analysis/release-holds-phase-0-2026-09-13.md`
      § 0.1. All four cited archive line numbers reproduce exactly. The active corpus returns two
      hits, both self-references inside this file, and zero substantive declarations.
- [x] **0.2 Record the HEAD exposure row.** For each active roadmap, the count of `[x]` and `[ ]`
      steps; a file with both is mid-flight and is what this mechanism is for.
      verify: the row is in the same evidence file, with per-file counts, and states the HEAD row
      separately from the historical one. `corrected-from-reproduction` — the source asked for a
      30-tag historical sweep; state the HEAD row separately, since it is the only row a reader can
      act on.
      TWO CORRECTIONS, LANDED 2026-09-13, both measured rather than argued
      (`agents/evidence/analysis/release-holds-phase-0-2026-09-13.md` § 0.2, reproducible with
      `bash agents/evidence/analysis/release-holds-exposure-row.sh <ref>`):
      (a) the mid-flight count at tag `15.0.0` is **three** of seven, not four — this verify line
      and the `zero-live-subjects` blocker both said four; seven active is correct.
      (b) the sweep needs no `_lib/base_tree` materialisation at all. Reading the object directly at
      a ref is enough; `export-ignore` only affects archive export. One ref cost under a second, so
      a 30-tag sweep is cheap — it was never the expensive row, only the un-actionable one.
      HEAD row: 14 files (7 `ready`, 7 `draft`), **1 mid-flight** and **0 of the 7 `ready`**.
- [x] **0.3 Enumerate the four release entry points against their consumer.** `release.ts`
      pre-flight, `src/config/release-gate-locality.yml`, `release-validation.yml` / `ci-strict`,
      `release-guard.yml` on the pushed tag.
      verify: the table has four rows and each names the file and line its refusal would be
      wired into.
      LANDED 2026-09-13 — `agents/evidence/analysis/release-holds-phase-0-2026-09-13.md` § 0.3.
      Row 3 records that `ci-strict` needs no edit of its own: it delegates to `ci` at
      `Taskfile.yml:462`, the by-construction superset `check_ci_strict_superset` asserts.
- [x] **0.4 Pre-register the claim as unbacked, with its falsifier and denominator.**
      `release-hold-refuses-declared-state` in `docs/CLAIMS.md`: *after 30 tags past Phase 4, at
      least one refusal logged OR at least one gated draft re-sequenced to continuous at
      authoring time — else honest null.*
      verify: `./scripts-run src/scripts/check_claims` passes and the row carries the denominator.
      LANDED 2026-09-13 — ledger 100 entries (60 backed, 32 unbacked), green. The denominator is
      30 consecutive tags cut after Phase 4, counted from the first tag whose tree carries a wired
      refusal; tags rather than calendar time, because a refusal can only fire at a cut. BOTH arms
      of the numerator are named, and arm (b) is the load-bearing one: a roadmap re-sequenced to a
      continuous shape at authoring time counts, because a hold that was never needed is the
      mechanism working and counting only refusals would score that outcome as a failure. The
      honest null is recorded as the PREDICTED outcome, per the `zero-live-subjects` evidence
      below. `docs/proof.md` regenerated in the same change.

## Phase 1 — The contract, before any file carries a marker

> **Every open step in this file now carries the inline `blocked-by:` marker, and that is a fix
> rather than a formality.** `scanOpenSteps` in `src/scripts/hooks/run_continuation_hook.ts`
> reads blockedness from the marker and from nothing else — it never parses `## Blockers` — so
> a step declared blocked only in a phase note still counts as open work to the stop-slot
> concern. With 27 open boxes this was close to the largest such exposure in the estate, and
> what it produced was concrete: an autonomous run was handed **step 1.1 — an owner-gated
> contract approval — as its next executable step, on every stop fire.** Measured on this file
> before the markers: `{ open: 18, blocked: 0 }` with `next` pointing at 1.1; after:
> `{ open: 0, blocked: 18, next: null }`. The dashboard is unmoved by the edit, which is the
> point — the boxes stay `[ ]`, the counts stay 27 open and 4 done, and the roadmap stays
> unarchivable; only the concern's read of them changes.
>
> All 18 point at `rule-13-amendment`, including the four Phase 4 steps that
> `zero-live-subjects` also bears on. The marker takes one id and the structural block is the
> one that decides executability; `zero-live-subjects` governs Phase 4's *value*, not whether
> it can start, and it is not lost by being absent from the marker — it is a second, separate
> owner decision and stays declared in `## Blockers`.

- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **1.1 Split template rule 13.** The version/tag/date prohibition stays byte-identical. The
      new second half says roadmaps do not decide when or in which version work ships, and MUST
      declare any intentionally unreleasable intermediate state together with its machine-verified
      clearance.
      verify: `git diff` shows the prohibition sentences unchanged character for character, and
      `./scripts-run src/scripts/lint_roadmap_complexity` is green on every active roadmap.
      PREPARED 2026-09-13, NOT APPLIED — the split is a contract-layer change and its approval is
      the `rule-13-amendment` blocker, which is the owner's to clear. The complete change is
      `agents/evidence/analysis/release-holds-rule-13-split-proposal.md` with the patch beside it; the template is
      untouched. The verify condition is already provable against the prepared patch and is
      STRONGER than character-for-character: the patch carries ZERO deletion lines, so nothing
      anywhere in the file is removed or changed, and the prohibition block hashes to
      `5827d0e4…` identically at HEAD, at `9d3e40ab0` (where this roadmap landed) and after the
      patch applies. `lint_roadmap_complexity` was measured green at HEAD. Stays `[ ]` because
      the template does not carry the split, and an agent may not approve a contract rule.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **1.2 Add the release-holds template rule, now numbered 28** — marker grammar, entry
      shape, the state table, the channel vocabulary, per-folder lifecycle, and the authoring
      order `re-sequence → guard → hold` with a mandatory `Why not a guard:` field. It states as
      its own non-goal that roadmap *incompleteness* is never a release condition.
      verify: the template's numbered rules run 1–28 (`grep -cE '^[0-9]+\. \*\*'` reads 28, up
      from 27), no rule number appears twice, and rule 28 carries the non-goal sentence verbatim.
      PREPARED 2026-09-13, REBASED 2026-09-14, NOT APPLIED — same patch as 1.1 and the same
      single decision, because the release-holds rule without the rule 13 split mandates a marker
      rule 13 forbids by its own letter, which is what the blocker says. All three halves of this
      verify reproduce against the prepared patch: the grep reads 27 at HEAD and 28 with the
      patch applied, `sort | uniq -d` over the rule headings is empty, and the non-goal sentence
      is present as a literal substring. The rule as drafted carries all six required elements
      plus a closing sentence restating rule 13's version prohibition inside a hold entry, which
      answers this file's own risk rank 7. Blocked on the same approval as 1.1.
      THE NUMBER AND THE BASELINE BOTH MOVED, and the verify line above is the corrected one.
      This step was authored as *add rule 27*, with a verify pinning *27, up from 26*. On
      2026-09-13 — hours after the patch was cut — `088f98fc2` and `5ed431b04` added an
      unrelated rule 27 to the template (`## Decisions`). Two things broke rather than one: the
      patch stopped applying at all, because hunk 3's tail context moved with it, so the approval
      command in the blocker below would have errored in the owner's hands; and the new rule's
      number collided with a live one. The patch is re-cut and renumbered 27 → 28 with both
      cross-references moved, the semantic content unchanged and still purely additive. The
      duplicate-number clause is new in the verify because the *count* cannot see a collision:
      two rules both numbered 27 still total 28, so the original verify would have passed on
      exactly the defect that occurred.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **1.3 Rule 20 gains one sentence** distinguishing the two mechanisms: a blocker stops
      execution, a hold stops publication.
      verify: `./scripts-run src/scripts/lint_roadmap_blockers` stays green on every active
      roadmap — the pre-change baseline was measured green on 2026-09-11.
      PREPARED 2026-09-13, NOT APPLIED — same patch, same decision. The sentence as drafted reads
      *a blocker stops execution; a hold stops publication*, with the four lines that make the
      distinction operational. `lint_roadmap_blockers` re-measured green at HEAD on 2026-09-13
      (14 roadmaps, blocker-contract-clean), so the baseline this verify compares against still
      holds. Blocked on the same approval as 1.1.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **1.4 `new_roadmap.ts` emits the `## Release holds` block as a comment**, and the authoring
      self-check lands in `roadmap-writing/SKILL.md` and `/roadmap:create`, logging every
      `gated → re-sequenced` outcome so Phase 6 has a numerator.
      verify: `./scripts-run src/scripts/new_roadmap probe --stdout` shows the commented block,
      and `evals/triggers.json` gains one positive case whose expected output is a re-sequenced
      phase rather than a hold.
      NOT STARTED, and deliberately not prepared — this step is DOWNSTREAM of the 1.1 approval
      rather than beside it. The block it emits is written in rule 28's grammar, so emitting it
      before rule 28 exists would put a rule-13 violation into every newly created roadmap, which
      is the exact failure the `rule-13-amendment` blocker names. The authoring self-check has the
      same dependency. Open with a named reason, not deferred.

## Phase 2 — The evaluator, and the glob nobody has paid for yet

> **Not started — blocked by `rule-13-amendment`.** Every step here parses or
> evaluates a marker the template does not yet permit a roadmap to carry, so there is no
> grammar to write a parser against. 2.3's glob measurement is the one step that could in
> principle run early; it is left with the phase because a p95 budget measured for a
> declaration format that may change during review would have to be re-taken.

- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **2.1 Write `src/scripts/_lib/release_holds.ts`** — parse and evaluate. Reuse
      `check_roadmap_trackable`'s checkbox and fence parser and `lint_roadmap_blockers`' marker
      grammar. No third parser.
      verify: neither helper is copied — `grep -n 'from .*roadmap_trackable\|from .*roadmap_blockers'`
      in the new lib resolves, and the two existing gates stay green.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **2.2 Write `src/scripts/check_release_holds.ts`** with `--lint`, `--status`,
      `--require-safe [--channel latest|all]` and `--selftest`.
      verify: `--selftest` covers every state-table row **including the not-evaluable row**, where
      a fixture the evaluator cannot read yields a refusal and never a pass.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **2.3 Measure the wider glob before wiring it.** `corrected-from-reproduction` — the source
      claimed `check_roadmap_trackable` already scans every folder and that the precedent exists.
      It does not: `check_roadmap_trackable.ts:71` sets
      `EXCLUDE_DIRS = new Set(['archive','skipped','stubs','later'])` and the unfiltered walk at
      `:274` exists only for `assertScanned`'s dead-scope count. Scanning 85 `later/` files and
      710 archived ones for content is new work on the release hot path.
      verify: the measured p95 runtime over the real corpus is recorded in the Phase 0 evidence
      file and sits under the budget derived there; no index is built in v1.

## Phase 3 — Lifecycle integrity

> **Not started — blocked by `rule-13-amendment`.** The archival, skip and
> `later/` paths would have to refuse on a window that cannot exist yet.

- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **3.1 The archival and skip paths refuse to move a file with an open window**, and a
      `later/` move requires the window named in `entry_condition.what`.
      verify: a fixture move to `archive/` or `skipped/` with an open window is refused naming
      the hold id; a move to `later/` succeeds, `--status` still lists it, and a release is still
      refused.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **3.2 Record deletion as a residual, not a mitigation.** Deleting a file removes its window
      and no gate sees it; template rule 12 already forbids the delete.
      verify: the residual is a Risk Register row in this file, and no acceptance criterion claims
      it is solved.

## Phase 4 — Wire all four boundaries to one refusal

> **Not started — blocked by `rule-13-amendment` for the phase itself, and by
> `zero-live-subjects` for its migration value.** The two are different blocks and only the
> first is structural. The four wiring points are already enumerated with file and line in
> the Phase 0 evidence file, § 0.3, so this phase starts from a table rather than a search.
> Step 4.2's figure is stale and the correction is recorded rather than applied: the registry
> carries 9 jobs at HEAD, not 8; the "4 carrying local commands" half reproduces exactly.

- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **4.1 `release.ts` pre-flight before step 1.** The refusal names the roadmap, the hold, its
      opener, its closer and the closer's `verify:` command, plus the three ways out: finish the
      clearer, cut `-next.N`, or use a release line per `docs/contracts/release-trunk-sync.md`.
      verify: a fixture tree with an open `latest` hold refuses at the pre-flight with all five
      fields in the message.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **4.2 One row in `src/config/release-gate-locality.yml`** (`verify: true`, `network: false`),
      plus the `release-validation.yml` job, `ci-strict`, and `release-guard.yml` on the
      checked-out tag.
      verify: `./scripts-run src/scripts/release_verify --list` shows the new row — the registry
      was reproduced live on 2026-09-11 with 8 jobs, 4 carrying local commands — and
      `./scripts-run src/scripts/check_ci_strict_superset` stays green.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **4.3 An evaluator error, timeout, or unreadable file refuses the cut.** There is no path
      on which "could not evaluate" reads as safe.
      verify: `release_drill` gains three scenarios — open `latest`, open `all`, evaluator error —
      and the error scenario exits non-zero.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **4.4 No override, and no silent channel redirect.** A plain `X.Y.Z` cut is never
      auto-converted to `-next.N`; the hint is offered and the decision stays the operator's.
      verify: `grep -rn 'force\|override\|accept-risk' src/scripts/check_release_holds.ts` returns
      no flag, label or trailer that bypasses a refusal, and `Channel: all` is the parsed default.

## Phase 5 — Adversarial proof, each case with a known-red arm

> **Not started — blocked by `rule-13-amendment`.** There is no guard to
> neutralise and no refusal message to assert against.

- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **5.1 Write the sabotage set**, one assertion per case, no case shared: delete a clear
      marker after opening · flip a clear `[x]` back to `[~]` · `[x] → [-]` with and without a
      `Closed by:` field · duplicate hold id · move to `later/`, `archive/`, `skipped/` · a marker
      that is not on a checkbox · a clear with no `verify:` · a fenced documentation example · a
      hand-made release PR · a hand-pushed tag · the evaluator killed mid-run.
      verify: the test file lists all eleven cases and each asserts its own exact refusal message.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **5.2 Prove sensitivity — neutralise the guard, watch each case fail, restore it.** A test
      never seen red has unknown sensitivity.
      verify: the commit message or the test file records the red reading per case, taken with the
      guard neutralised.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **5.3 Prove it does not over-fire.** A valid unfinished `continuous` roadmap and an
      unopened window both pass.
      verify: both negative cases are in the same test file and are green.

## Phase 6 — Evaluate the claim after 30 tags, and accept the null if it comes

> **Not started — blocked by `rule-13-amendment`, and by its own denominator.**
> The claim is pre-registered (0.4) and its 30-tag window cannot begin until Phase 4 lands a
> wired refusal. The null branch is already recorded as the predicted outcome, so this phase
> reads a result rather than deciding what the result would mean.

- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **6.1 Read the refusal log, the re-sequence log and a re-taken Phase 0 prose count**, then
      flip `release-hold-refuses-declared-state` to `backed` or `honest-null`.
      verify: the claim row carries both numbers and the tag range it was measured over.
- [ ] <!-- blocked-by: rule-13-amendment | asked: no — non-interactive process-full run, which reports once at the end and cannot put a question --> **6.2 On an honest null, keep the primitive and strike only the free parts** — the boundary
      screen line and the runbook bullet — and record the disposition on rule 28 with the tag
      range. Deleting the primitive is not the null disposition: the owner's constraint is that a
      broken state must not ship, and a mechanism whose value stayed latent is not one that failed.
      verify: the disposition sentence is in the template beside rule 28, naming the tag range.

## Blockers

### blocker: rule-13-amendment
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** Phases 2 through 6. Template rule 13 is contract layer, and until it is split a
  hold marker in any roadmap is a rule-13 violation by the letter of the rule.
- **What to do:** approve the split in Phase 1.1 — the prohibition half stays byte-identical and
  the new half is additive. Read `src/agent-src/templates/roadmaps.md:62-66`, which is the exact
  text that must survive unchanged.
- **Recommendation:** approve. The prohibition the rule exists for (versions, tags, dates in
  roadmaps) is untouched; what is added is the obligation to declare a state the tree already has
  and currently cannot name.
- **If you do nothing:** Phase 1 stops at 1.1 and no later phase can start, because every one of
  them writes or reads a marker the template forbids.
- **Resolved when:** `bash agents/evidence/analysis/release-holds-rule-13-split-verify.sh` is
  run against the applied template and the release-holds rule (numbered **28**) is present, with
  rule 13's prohibition block still hashing to
  `5827d0e4b5a1c88e7d646e7157fed36564890a5aaa5f2e33c0007ad77b9ed407` — the value it carries at
  HEAD, at `9d3e40ab0` where this roadmap landed, and after the patch applies.
  REWORDED 2026-09-14, because the previous wording had gone stale into a FALSE POSITIVE.
  It read *carries rule 27*, and the template gained an unrelated rule 27 on 2026-09-13
  (`## Decisions`). Read literally, this blocker's resolution condition is now satisfied at
  HEAD **without the split**, by a rule about something else entirely. A condition that reads
  true when nothing was done is worse than a vague one, because it closes silently and nobody
  re-reads it. It now names the rule by its content as well as its number, and points at the
  verifier rather than at a count a collision can satisfy.
- **Evidence (2026-09-13):** the change is PREPARED AND VERIFIED, and not applied. It is one
  patch covering steps 1.1, 1.2 and 1.3, because this blocker's own `Resolved when` spans two of
  them — the release-holds rule present AND rule 13 byte-identical is one condition, so it is
  one decision.
  - The change: `agents/evidence/analysis/release-holds-rule-13-split.patch`, applying cleanly to
    the template at HEAD. Read it, or read the brief at
    `agents/evidence/analysis/release-holds-rule-13-split-proposal.md`.
  - Check it: `bash agents/evidence/analysis/release-holds-rule-13-split-verify.sh` — exit 0,
    seven checks, nothing written to the working tree.
  - The byte-identity guarantee is STRONGER than the one this blocker asks for. The patch carries
    **zero deletion lines**, so nothing anywhere in the file is removed or changed. The
    prohibition block hashes to `5827d0e4b5a1c88e7d646e7157fed36564890a5aaa5f2e33c0007ad77b9ed407`
    at HEAD `7182f5d07`, at `9d3e40ab0` where this roadmap landed, and on a scratch copy with the
    patch applied — the same value at all three, which removes the ambiguity in "at the commit
    this roadmap landed".
  - The checks were observed RED before being trusted: against a tampered copy rewriting one
    prohibition word, the additive check and the after-hash both fail and the script exits 1. The
    apply check stays green, which is the finding — a tampered patch is still a valid patch.
  - `src/agent-src/templates/roadmaps.md` IS UNCHANGED on this branch. Applying the patch is the
    approval, and an agent may not approve a contract-layer rule on its own authority. That half
    is untouched and stays with the owner.
  - To approve: `git apply agents/evidence/analysis/release-holds-rule-13-split.patch`, then
    `./scripts-run src/scripts/lint_roadmap_complexity` and
    `./scripts-run src/scripts/lint_roadmap_blockers` (both re-measured green at HEAD on
    2026-09-14, 10 roadmaps each), then `task sync` and `task generate-tools`, then flip
    1.1/1.2/1.3 and this blocker to `resolved`.
- **Amendment (2026-09-14): the patch was rebased, and until it was, this approval command did
  not work.** `088f98fc2` and `5ed431b04` added an unrelated rule 27 to the template on
  2026-09-13, hours after the patch was cut against `7182f5d07`. `git apply --check` had been
  failing since: hunk 3's tail context moved, so an owner following the line above would have hit
  an error rather than a decision. The patch is re-cut onto the current base, the release-holds
  rule renumbered 27 → 28, and its two cross-references moved with it. What did NOT change: the
  semantic content, the zero-deletion-lines property, and the prohibition hash, which is still
  `5827d0e4…` at HEAD and after applying. The verifier gained a duplicate-number check and was
  observed red against a copy that reintroduces the collision — where the rule-count check
  passes, which is exactly why the new check exists. **The template remains untouched on this
  branch and the decision is unchanged: applying the patch is the approval, and it is still
  yours.**

### blocker: zero-live-subjects
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** the migration value of Phase 4, not Phase 4 itself. The one migration candidate the
  source named is archived and both its coupling risks are discharged, and the active corpus
  carries zero release-coupling prose at HEAD.
- **What to do:** decide whether the mechanism ships against a latent need. Run
  `grep -rniE 'same release|release condition|ship together|must land in the same' agents/roadmaps/*.md`
  — it returns two self-matches from this file and no substantive declaration (the wording below
  said "nothing today"; it was true when written and the grep now matches the sentences this
  roadmap itself added). Then read the exposure row from Phase 0.2: **three** of seven active
  roadmaps were mid-flight when 15.0.0 shipped — this entry said four, and the measured figure is
  three — which is the population this would have protected.
- **Recommendation:** ship it, and say so in the Phase 0.4 falsifier rather than discovering it at
  Phase 6. A constraint the owner stated once is not weakened by the absence of a current
  violation, but a claim that pretends there was one is.
- **If you do nothing:** Phase 4 lands a mechanism with no exercised path, and Phase 6 reads as a
  surprise instead of as the outcome the claim already predicted.
- **Resolved when:** either a live subject is named with a `file:line` in the Phase 0 evidence
  file, or that file records the honest-null branch as the accepted plan.
- **Evidence (2026-09-13):** the CHECK THIS ENTRY NAMES HAS BEEN RUN, at `7182f5d07`, and its
  result is recorded in `agents/evidence/analysis/release-holds-phase-0-2026-09-13.md`. What it
  returned, and what that does and does not settle:
  - **The grep returns no live subject.** Two hits in the active corpus, both self-references
    inside this file — the rule 27 non-goal sentence at `:85` and this blocker's own quoted
    command. Zero substantive release-coupling declarations in `agents/roadmaps/`, and zero in
    `later/`, `skipped/` and `stubs/`. A wider eleven-term set was run as a sensitivity check and
    does not change the zero.
  - **The archived migration candidate is closed, verified line by line.**
    `agents/roadmaps/archive/road-to-a-graph-that-is-shipped.md:960` and `:961` carry the two
    coupling risks; they read MITIGATED at `:973` and DISCHARGED at `:978`. All four line numbers
    reproduce exactly at HEAD.
  - **The exposure population is smaller than this entry claimed: three of seven, not four.**
    Measured at tag `15.0.0` (`c86131ad7`) with
    `bash agents/evidence/analysis/release-holds-exposure-row.sh 15.0.0`. The three are
    `road-to-delivery-for-every-host.md` (28 done / 2 open), `road-to-delivery-on-hook-hosts.md`
    (11 / 5) and `road-to-typed-grants-that-persist.md` (2 / 29). At HEAD the figure is **1 of
    14**, and **0 of the 7 `status: ready`** — every ready roadmap is at 0% done.
  - **None of those three declared a coupling either**, so even the historical population is one
    of *exposure*, never of *violations*. That is the sharpest honest statement the evidence
    supports and it is weaker than a live subject.
  - **The honest-null branch is recorded as the evidenced and recommended plan**, in the Phase 0
    file and in the `release-hold-refuses-declared-state` claim pre-registered at 0.4, where the
    null is named as the PREDICTED outcome rather than a Phase 6 surprise.
  **Second reading, 2026-09-14, after eight sibling PRs merged.** Recorded as an addendum to
  the Phase 0 file rather than as an edit to its pinned figures. The declaration count is
  UNCHANGED at zero, so no live subject appeared. The EXPOSURE row moved sharply: 6 of 14 active
  roadmaps mid-flight, and 4 of the 7 `ready` ones, against 1 and 0 the day before. That makes
  the latent need larger and more routine than one snapshot suggested — but exposure is the
  population a mechanism could protect, not an instance of it being needed, and this decision
  turns on the latter. The jump must not be read as the live subject it is not.
  **Status stays open, and the reason is precise.** The `Resolved when` says "the accepted plan",
  and acceptance is the owner's act. The evidentiary half of this decision is now closed — there
  is nothing left to look up. What remains is a cost judgement: whether to spend Phases 2 through
  5 building a mechanism with no exercised path. No measurement answers that, and none was
  claimed to.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-11 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Zero live subjects at HEAD | product | The proposal's own migration target is archived and the active corpus is clean, so the mechanism may ship having never been exercised against a real case | Phase 0.1 records the zero as the finding rather than hiding it; Phase 0.4 pre-registers the falsifier with a denominator; Phase 6.2 keeps only the free parts on a null | Phase 0 — Measure first, and record the honest null up front |
| 2 | Holds become the default answer | product | A hold is easier to write than a re-sequenced phase, so trunk ends up held most of the time and the mechanism inverts into the blocker it replaced | Rule 28 mandates `re-sequence → guard → hold` with a `Why not a guard:` field; the Phase 1.4 re-sequence log is Phase 6's numerator | Phase 1 — The contract, before any file carries a marker |
| 3 | The marker lies in the safe direction | implementation | A marker is only as honest as the checkbox flip, and the `verify:` flip-guard is prose in the process loop, not a deterministic gate | Both opener and closer carry `verify:`; the Phase 5 sabotage set targets exactly the dishonest flip; the guard's instruction-only status is stated rather than implied to be enforcement | Phase 5 — Adversarial proof, each case with a known-red arm |
| 4 | The wider glob costs more than assumed | implementation | No gate scans `later/` or `archive/` for content today, so 85 plus 710 files enter the release hot path with no precedent to inherit a budget from | Phase 2.3 measures p95 over the real corpus before anything is wired; active corpus first and `later/` as backstop only; no index in v1 | Phase 2 — The evaluator, and the glob nobody has paid for yet |
| 5 | A file with an open window is deleted | implementation | Deletion removes the window and bypasses the lifecycle guard entirely | Template rule 12 already forbids the delete; recorded as a residual in Phase 3.2 and not claimed as solved | Phase 3 — Lifecycle integrity |
| 6 | A refusal lands mid-emergency | implementation | A live hold discovered at cut time costs a day if the clearing step is heavy | Boundary screen at phase entry; `release:verify` before the push; the release-line path is named inside the refusal text itself | Phase 4 — Wire all four boundaries to one refusal |
| 7 | The rule 13 amendment reads as a licence | product | "Target release" creeps back into roadmaps once the rule is touched at all | The prohibition stays byte-identical; rule 28 forbids versions and dates inside hold entries; the existing version regexes are unchanged and were measured green | Phase 1 — The contract, before any file carries a marker |

## Acceptance Criteria

- [ ] AC-1 — A roadmap can name an unreleasable intermediate state, and that state is bound to
      the checkbox that opens it and the checkbox that clears it. Today no vocabulary for this
      exists anywhere in `src/`, `docs/` or `.github/`.
- [ ] AC-2 — All four release boundaries refuse to publish while such a state is open, with one
      script and one message naming roadmap, hold, opener, closer and the closer's `verify:`.
- [ ] AC-3 — An evaluator error, timeout or unreadable file refuses the cut. No path exists on
      which "could not evaluate" is treated as safe.
- [ ] AC-4 — An unfinished roadmap with no declared window never blocks a release, and normal CI
      on a tree carrying a valid open window is green.
- [ ] AC-5 — A malformed or ambiguous hold declaration reddens normal CI, so a broken declaration
      cannot fail open.
- [ ] AC-6 — Moving a roadmap to `later/`, `archive/` or `skipped/` cannot make an open window
      disappear from `--status` or from the release refusal.
- [ ] AC-7 — No override flag, label or commit trailer bypasses a refusal, and a plain `X.Y.Z`
      cut is never silently converted to a prerelease channel.
- [ ] AC-8 — Every sabotage case has been observed red with the guard neutralised and green with
      it restored, and both non-over-firing cases pass.
- [ ] AC-9 — `release-hold-refuses-declared-state` carries a verdict measured over a named tag
      range, and an honest null is recorded as a disposition rather than as a deletion.
