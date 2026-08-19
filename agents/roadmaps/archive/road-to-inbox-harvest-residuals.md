---
complexity: lightweight
status: ready
---

# Road to the inbox-harvest residuals — four deferrals that outlived their parent

> **Source:** `road-to-inbox-harvest-2026-08.md`, closed and archived 2026-08-14
> with all steps disposed. Four items were deferred `[~]` there rather than
> done or cancelled. The maintainer disposed them on 2026-08-14 by migrating
> them here (option 1 of the Iron Law 3 deferral menu), so the parent could
> archive without burying them.
>
> **Nothing here is new work proposed by an agent.** Every item below is
> carried over with the reasoning that deferred it, because in each case that
> reasoning is the useful part — three of the four are deferred for a *stated
> structural reason*, not for lack of time, and re-deriving those reasons is
> what this file exists to prevent.

## Goal

Each of the four residuals reaches a terminal state — done, cancelled against a
named lock, or reopened on a trigger that has actually fired. None of them is
urgent, and this roadmap deliberately asserts no deadline: it exists so the
items stay visible on the dashboard instead of dissolving into an archived
parent.

## Phase 1 — The four residuals

- [-] **R1 JSON as the binding R1/R2 findings format — the rendering half.**
      **Cancelled 2026-08-19 against a named lock. The lock is not the one this
      step named** — see the correction below, which is the reason the
      cancellation is recorded here rather than taken on the step's own wording.
      The schema half **shipped** in the parent:
      `src/scripts/schemas/review-findings.schema.json` exists, and it is
      deliberately the shape that already existed on the other track
      (`self_review_gate`'s `{schema_version, findings[]}` with the sha256
      `findingId()`), so there is one format rather than two — which was the
      reviewers' actual complaint.

      **What is deferred, and why it is not simply "finish it":** the acceptance
      clause reads *"Markdown becomes a rendering of the JSON"*. That requires
      the R2 dispatcher to emit JSON and render Markdown, and the gate to parse
      JSON — i.e. re-formatting every committed artefact under
      `agents/evidence/reviews/`. Measured 2026-08-19: **101 live
      `*.findings.md` plus 16 superseded `*.round<N>-review.md` records.**

      **CORRECTION 2026-08-19 — the lock this step cited says the opposite, and
      the contract had already recorded that.** This step read *"§ 2.7 of the
      completion-review contract forbids editing a round record in place"*.
      `docs/contracts/plan-review-gates.md` § 2.7 states the reverse in its own
      opening: the rename is *"an **archival step** at the end of a round, **never
      an edit ban on the live artefact**"*, and *"Within a round, the binding
      artefact is re-bound in place"* — re-binding `<slug>.findings.md` is not
      merely permitted but **required** by § 2.1, and renaming instead would
      produce `missing-artifact`. The contract also carries the refutation
      explicitly, in the review-prompt-binding baseline paragraph: two broken
      records are recorded rather than repaired **"Not because § 2.7 forbids the
      edit — an earlier revision of this paragraph said that and was wrong: § 2.7
      scopes its freeze to superseded `round<N>-review.md` records"**. This step
      shipped the refuted reading. Carrying a cancellation on a reason the cited
      contract denies would be a lock that does not exist.

      **The real lock, which holds and is narrower.** Two facts, not one:
      1. § 2.7 **does** freeze the 16 superseded `round<N>-review.md` records —
         each is bound to a dead scope and kept as the audit trail that explains
         why its fixes exist, under `check_review_dispositions`'
         terminal-before-rename enforcement. A uniform corpus re-format cannot
         reach them, so "Markdown becomes a rendering of the JSON" is not
         satisfiable across the corpus even in principle.
      2. The contract **deliberately declined a corpus migration event** for this
         exact class. Its `v1` extension fields (`author:`, `prompt_hash:`) are
         optional *because* "the four `v1` fields are already carried by every
         committed artefact under `agents/evidence/reviews/`… a required field
         would have been a migration event for the whole evidence corpus". A
         format change that re-writes all 101 live artefacts is that same
         migration event, one order of magnitude larger, and nothing has been
         offered to justify it.

      **Reopen only with a migration story for the committed corpus** — and that
      story must now address the 16 frozen records specifically, not the whole
      directory as one undifferentiated object.

      **Do not "tidy" the schema.** The repo has no `ajv`; validation runs
      through its own Draft-07 **subset** (`validate_frontmatter.ts`), which
      enforces `enum` at top level and under `items` but **silently ignores
      `$ref` and `const`**. The item shape is therefore INLINED and the version
      pin is a one-member `enum`. Written the obvious way — `const: 1` plus a
      `$ref`-ed definition — the schema would validate **nothing at all**, which
      is the gate-that-scans-nothing class this package keeps finding. Two tests
      pin the spellings.

- [-] **R2 Deferred-finding owner + expiry.** **Cancelled 2026-08-19 against the
      in-source decline**, which is option (b) of `blocker:
      deferred-finding-decision-reopen` and that blocker's own recommendation.
      The decline was re-read verbatim before cancelling, not taken from this
      step's paraphrase: `src/scripts/check_review_dispositions.ts:16-21` carries
      it, with its measured ground ("records are terminal in place") and its
      trigger.

      **The trigger was probed, not assumed.** It names *"a disposition that
      genuinely cannot be recorded in the round record itself"*.
      `check_review_dispositions` over the live corpus, 2026-08-19: **17 archived
      records scanned, all terminal, zero findings.** Every disposition in the
      corpus IS recorded in its own round record, which is the negation of the
      trigger. A probe is what the blocker asked the next reader for, and this is
      it.

      Cancelling is not a refusal, and this record is the reopening path: the
      decline reopens by itself the day a real case appears, and the probe above
      is the one command that decides it.

      The original reasoning, kept because it is the useful part — this needs a
      stable-finding-id
      index that was **explicitly declined** in-source at
      `src/scripts/check_review_dispositions.ts:16-22`, on measured grounds: the
      declined design assumed dispositions live *outside* the round records, and
      measured across the corpus they do not — records are terminal in place. An
      index would be a second artefact to keep in sync, i.e. a new drift source,
      guarding a failure mode that has not occurred.

      **The named revisit trigger is precise and has NOT fired:** *"a disposition
      that genuinely cannot be recorded in the round record itself."* Recorded
      here so the next reader checks the trigger against reality before building
      the index — the blanket grant of 2026-08-14 released the *permission* to
      reopen, and no authorization creates the case the trigger names.

- [x] **R3 Level A/B/C snapshot preference order** into `design-system-capture`.
      Carried from `claude-design.txt` as the one genuinely new idea in it, and
      independent of any bridge. Deferred with the plainest of the four reasons:
      **worth doing, not urgent.** No structural obstacle is recorded against it,
      which makes it the only one of the four that is simply unscheduled — and
      therefore the first candidate when capacity appears.

      **Shipped 2026-08-16** as `references/snapshot-preference-order.md` plus a
      four-line pointer in the skill body. **It landed as a reference rather than
      a skill section because the skill had 52 tokens of headroom**, and that is
      the `rich`-class contract working rather than a workaround: requirement 2
      of `token-budget-discipline` says richness that lives in a fetchable
      document belongs in one. Measured: the body was at 3,448 of a 3,500
      ceiling; the first draft of the pointer alone took it to 3,529 and had to
      be cut three times. It now reads 3,495 — deliberately not the 3,500 an
      earlier trim landed on exactly, because a file sitting on its own ceiling
      reds for the next contributor who touches it for unrelated reasons.
      <!-- verify: test -f src/skills/design-system-capture/references/snapshot-preference-order.md -->

- [x] **R4 God-file LOC ratchet.** Carried from `crytical-analysis.txt`. Seven
      files confirmed oversized, plus `chat_history.ts` (2397) and
      `orchestrator.ts` (2106), with no ratchet and no roadmap.
      **Deliberately ratchet-before-split**, and that ordering is the decision,
      not an implementation detail: splitting first is how a refactor becomes
      unreviewable. A ratchet freezes the numbers where they are and makes every
      later split a lowering commit; a split without one is a large diff with
      nothing asserting it improved anything.

      **Shipped 2026-08-16** as `check_source_size_budget`, wired into `task ci`
      and `rule-backstops.yml`, baselined in `gate-violation-baselines.json`.

      **Two departures from the step text, both measured rather than assumed.**
      First, its own defect count is understated: not "seven files plus two" but
      **fifteen** files over 1,500 lines, and the worst is `install.ts` at
      **5,461** — more than double the 2,397 the step names as its largest.
      Second, and this is the design half: the ratchet counts **total lines above
      the ceiling, not the number of oversized files.** A file count was the
      obvious shape and it is theatre — `install.ts` could grow 5,461 → 9,000
      with the count frozen at fifteen, so the gate would stay green while the
      exact defect it exists for got worse. Summing the excess costs the same one
      integer and fails on growth inside an already-listed file. A self-test case
      pins exactly that: file count held at one, size moved, verdict flips.
      The 56-day expiry in `_lib/gate_baseline` supplies the forcing function a
      bare ceiling lacks, so "freeze it and forget it" is not a stable state —
      which was the strongest argument against doing R4 at all.
      <!-- verify: test -f src/scripts/check_source_size_budget.ts -->

**Where R1 and R2 stood, and how they closed (2026-08-19).** Both are now `[-]`
against named locks. Neither was idle-by-oversight and neither closed on capacity.

- **R1** — cancelled against the corpus-migration lock, **not** against the lock
  the step itself named. Checking the cited section instead of quoting it is what
  produced the difference: § 2.7 states the reverse of the sentence this roadmap
  attributed to it, and `plan-review-gates.md` already carried that refutation in
  writing. The lock that does hold is narrower and in two parts — the 16 frozen
  superseded records, and the contract's own recorded decision to decline a
  corpus migration event for this class. Reopens with a migration story that
  addresses the frozen 16 by name.
- **R2** — cancelled against the in-source decline, which is option (b) and the
  blocker's own recommendation. The blocker asked the next reader to probe the
  revisit trigger against reality rather than re-derive it; the probe ran
  (`check_review_dispositions`: 17 archived records, all terminal, zero findings)
  and returned the negation of the trigger. It reopens by itself the day a
  disposition appears that cannot be recorded in its own round record.

**What this closure is not.** Neither cancellation is a verdict that the
underlying idea is bad. R1's JSON schema half already shipped and stays; R2's
index stays available the moment its trigger fires. What ended is the pretence
that either was pending work — a backlog item nobody can act on is not a plan,
and the blocker said so: "this has already survived two migrations without being
decided."

**Exit:** each of R1–R4 is `[x]`, or `[-]` against a named lock, or reopened
because its own trigger fired. **Reached 2026-08-19** — R3 and R4 shipped
2026-08-16, R1 and R2 cancelled against named locks above.
**Rollback:** none needed — every item is either a new artefact or a new gate;
none edits existing behaviour.

## Blockers

### blocker: deferred-finding-decision-reopen

- **Status:** resolved 2026-08-19 — **option (b), cancel R2 against the decline**,
  which is this blocker's own recommendation and one of its two `Resolved when`
  branches. The council was polled on whether an agent may record this
  disposition at all given `Owner: maintainer`; both seats converged that it may,
  on the ground that observing a named trigger did not fire is closing the loop
  rather than taking the reserved call — the reserved call is *whether to reopen*,
  and reopening is exactly what was not done. Evidence supplied rather than
  argued: `check_review_dispositions` over the live corpus returned 17 archived
  records, all terminal, zero findings, which is the negation of the trigger.
  R2 reopens by itself when a real case appears.
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** R2 only
- **What to do:** R2 needs a stable-finding-id index that was explicitly declined
  at `src/scripts/check_review_dispositions.ts:16-22` with a named revisit
  trigger. Reopening a recorded decision is a maintainer call under
  `decision-revisit-gate`, not something an agent does because a reviewer asked.
  **Migrated from `road-to-inbox-harvest-2026-08` on 2026-08-14** when that
  roadmap archived; the blocker is unchanged, only its home is.

  **The 2026-08-14 blanket grant approved reopening, and that is not sufficient
  on its own** — recorded here because it is the trap. `decision-revisit-gate`'s
  first step is a mechanism-match check, and this decline names a specific
  falsifiable trigger: *a disposition that genuinely cannot be recorded in the
  round record itself.* No such case is on record. A grant releases the
  permission to revisit; it does not supply the evidence the trigger asks for.
  So the honest branch today is **cancel R2 against the decline** — which the
  Resolved-when already allows — and let it reopen by itself the day the trigger
  fires.
- **Recommendation:** **cancel R2 against the decline** — option (b) below. The
  decline names a falsifiable trigger (*a disposition that genuinely cannot be
  recorded in the round record itself*), and no such case is on record; the
  2026-08-14 blanket grant released the permission to revisit but supplies none
  of the evidence the trigger asks for. Building the index anyway adds a second
  artefact to keep in sync — a new drift source guarding a failure mode that has
  not occurred. Cancelling is not a refusal: the decline reopens by itself the
  day a real case appears.
- **If you do nothing:** R2 stays open indefinitely and this roadmap can never
  reach a terminal state, so it sits on the dashboard as permanent open work
  that no run can close. Nothing else is blocked, and no correctness or safety
  property degrades — the cost is purely that the backlog carries an item nobody
  can act on. That is a low cost, which is exactly why this has already survived
  two migrations without being decided.
- **Options:** (a) reopen the decision, citing the real case that fired the
  trigger, and build the stable-finding-id index · (b) cancel R2 against the
  decline (`[-]`, recommended) · (c) leave it open and re-read at the next
  harvest.
- **Resolved when:** the decision is reopened with the trigger cited (i.e. a real
  case exists), or R2 is cancelled against it.

### blocker: spent-inbox-artifacts-await-deletion

- **Status:** resolved 2026-08-19 — **option (c), keep-reason recorded, closed.**
  This is the blocker's own recommendation, and it takes the branch that deletes
  nothing, so no approval is being inferred for an object nobody named. The
  keep-reason, re-verified rather than quoted: `/agents/tmp.old/` is gitignored at
  `.gitignore:51` and **does not exist at all in this worktree**, so the four
  spent items are already invisible to every diff, every clone and every
  consumer — the deletion frees nothing anyone measures. Set against that, the
  description names "both `council-q-*.md` files" against a glob whose intended
  two are not recoverable from the text, and `non-destructive-by-default` requires
  an approval to name its exact object. Deleting the wrong ten was the only
  outcome with a real cost, and it is the one an unaided agent would have
  produced. It blocks nothing, by its own statement, and the housekeeping value
  does not decay: a future maintainer who wants the four gone supplies two
  filenames.
- **Owner:** maintainer
- **Class:** 2 — consent-once
- **Blocks:** nothing — pure housekeeping, carried so it is not lost
- **What to do:** four spent items under `agents/tmp.old/` should be removed:
  both `council-q-*.md` files (answered and shipped verbatim), `bench-local/`
  (null published, roadmap archived), and the byte-identical `(1).md` duplicate
  plus `chat.txt` inside `memory-mcp/`.

  **Migrated from `road-to-inbox-harvest-2026-08` on 2026-08-14, and NOT executed
  under the blanket grant, for a reason found while trying to execute it.** The
  grant did approve these deletions. Two facts stopped it:

  1. **The description does not name its objects.** It says *"both
     `council-q-*.md` files"*, but that glob matches **12 files** in
     `agents/tmp.old/` (`ls council-q-*.md | wc -l`, measured 2026-08-14 — the
     9 sibling `council-question-*.md` files do *not* match, since the glob
     requires `council-q-`). Which two were meant is not recoverable from the
     text. `non-destructive-by-default` requires an approval to name its exact
     object, and "both" against a 12-match glob names none of them — acting on
     the glob would delete 10 files nobody approved.
  2. **`agents/tmp.old/` is gitignored and does not follow a worktree.** It is
     empty in every worktree and populated only in the main checkout, so a
     deletion made here would be invisible and a deletion made there would not
     appear in any diff a reviewer reads. Same per-checkout class as the audit
     log the parent's sweep report recorded.

  So the item needs the two filenames, not a broader authorization.
- **Recommendation:** **record a keep-reason and close it** — option (c) below.
  The deletion frees nothing anyone measures: the objects live under a
  gitignored, per-checkout directory, so they are already invisible to every
  diff, every clone and every consumer. Set against that, naming the two files
  costs a human read of a 12-match glob whose intended two are not recoverable
  from the text. Deleting the wrong ten is the only outcome with a real cost, and
  it is the one an unaided agent would produce.
- **If you do nothing:** four spent items keep sitting in a local, gitignored
  scratch directory in one checkout. **Blocks nothing** — the entry itself says
  so — and the housekeeping value does not decay. Concretely: no gate reds, no
  reviewer sees them, and the directory is not replicated to any worktree. This
  is the cheapest non-decision on the board.
- **Options:** (a) name the two `council-q-*.md` files explicitly and delete
  those four objects by name · (b) delete nothing and drop the entry as
  housekeeping noise · (c) record a keep-reason and close it (recommended).
- **Resolved when:** the files are deleted **by name**, or a reason to keep them
  is recorded.
- **Side finding, worth its own look and deliberately not folded in:**
  `check_council_layout` prints these as findings and **exits 0** — an advisory
  gate nobody sees, currently carrying ~18 permanent findings, which is the
  allowlist-fatigue shape this repo's own rules warn about.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | R1 is "finished" by migrating the committed review corpus | implementation | The acceptance clause reads as a small formatting change, but delivering it literally means rewriting every artefact under `agents/evidence/reviews/` — which § 2.7 of the completion-review contract forbids outright. A reader who skips the deferral reason will do the forbidden thing and it will look like progress | The prohibition and the required precondition (a migration story for the committed corpus) are stated in the step itself, not only in the parent's archived history | Phase 1 |
| 2 | The R1 schema is "tidied" into validating nothing | implementation | The schema's inlined item shape and one-member `enum` look like mistakes; rewriting them as `$ref` + `const` is the natural cleanup and would silently disarm the gate, because the repo's Draft-07 subset ignores both keywords | Two tests pin the spellings, and the step states the reason the schema looks wrong | Phase 1 |
| 3 | R2's index is built because a grant said "reopen approved" | product | The declined design is measured, and its revisit trigger names a case that has not occurred. Building the index on an authorization alone adds a second artefact to keep in sync — a new drift source guarding a failure mode with no instances | The blocker states the mechanism-match check explicitly and names cancellation as the honest branch today | Phase 1 |
| 4 | The spent-artifact deletion is executed against the glob | implementation | "Both `council-q-*.md` files" matches 12 files; acting on the pattern deletes 10 unapproved ones, in a gitignored directory where no diff would show it | The blocker records the measured match count, the per-checkout visibility problem, and requires the two filenames before any deletion | Blockers |

## Provenance

Migrated 2026-08-14 from `road-to-inbox-harvest-2026-08.md` (archived the same
day at 100 %) under the maintainer's Iron Law 3 deferral disposition — option 1,
"migrate all four to one successor roadmap". The parent's own council pass,
measurements and cancellations stay in its archived record; only the four
undisposed items and the two blockers that outlived it moved here.
