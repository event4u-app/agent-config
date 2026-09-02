---
complexity: structural
status: later
parent_roadmap: road-to-harness-promotion-bridge
execution:
  mode: interactive
relates:
  - slug: road-to-harness-promotion-bridge
    relation: extends
    note: >
      The roadmap this file receives Phase 7, AC-9 and the post-PR half of step
      0.8 from, on 2026-09-01 (drain run 15). That roadmap's delivery boundary
      was re-cut to end at a created, validated, merge-ready pull request; every
      obligation that lives BEYOND that boundary is carried here, unweakened,
      and waits for a human merge turn. `[~]` in the parent means CARRIED, never
      cancelled and never satisfied.
estate_growth_exempt: "Charges +1 later_roadmaps against a floor of 75 and creates NO new work: every step, verify clause, acceptance criterion, prerequisite and rollback expectation in this file is transferred verbatim out of road-to-harness-promotion-bridge, which sheds exactly what this file gains and is archived in the same change. The same change charges -1 active_roadmaps (4 -> 3) and -1 open_blockers (32 -> 31, merge-authority settled as refused), so the governed estate shrinks on two counters and grows on one. The growth is the AI council of 2026-09-01 (drain run 15, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, deep, peer-review, blind chairman, quorum 2/2 present, concluded, subscription transport, billable=0) verdict 4C, whose preservation condition 4 requires the post-PR half to become a separately named workflow that roadmap automation cannot reach. later/ is the only tracked location that satisfies BOTH halves of that condition -- it is a legal carry destination for deferralProblems (src/agent-src/scripts/archive_completed_roadmaps.ts:446-449, unlike agents/roadmaps/stubs/ which resolves as does-not-exist) and it is excluded from collect() and from /roadmap:process-* (src/agent-src/scripts/update_roadmap_progress.ts:797-798), which is the unreachability the condition demands."
estate_offset_exempt: "The one-in-one-out half is satisfied in substance and is claimed as an exemption only because the counter reads locations rather than work: this change archives road-to-harness-promotion-bridge (one active roadmap disposed) and adds this file under later/, so the estate nets -1 active and +1 later for zero new planned work. A prior council of 2026-08-31 rejected later/ for road-to-harness-promotion-bridge on the ground that exclusion from the dashboard fails a preservation test; that reasoning does not transfer here and the difference is stated rather than glossed -- there, exclusion was the defect, because the work was ACTIVE and needed to stay visible to the estate mechanisms; here, exclusion is the REQUIREMENT, because preservation condition 4 of the 2026-09-01 verdict demands the post-PR half be unreachable by roadmap automation and by any autonomy setting."
---
# Road to post-PR promotion workflow

> **This is a POST-PR workflow, not a roadmap step any automation may enter.**
> It receives Phase 7, AC-9 and the post-PR half of step 0.8 from
> `road-to-harness-promotion-bridge` on 2026-09-01 (drain run 15), under AI
> council verdict **4C**, 2/2 convergent. Nothing here is met, nothing here has
> been weakened, and nothing here was deleted. The carrier moved and the
> obligation did not.

## The Hard Floor on this file — read before anything else

> **Requires same-turn explicit user confirmation per
> [`non-destructive-by-default`](../../../src/rules/non-destructive-by-default.md)
> Hard Floor.**

Restated so no reading of it is available that this file did not intend:

- **This workflow is NOT reachable by any roadmap automation.** It lives under
  `agents/roadmaps/later/`, which `collect()` excludes and which
  `/roadmap:process-full`, `/roadmap:process-phase`, `/roadmap:process-step` and
  `/roadmap:next` therefore never see. That exclusion is the mechanism, not a
  convention.
- **This workflow is NOT reachable by any autonomy setting.** `personal.autonomy`,
  a standing autonomy directive, a roadmap authorization and an instruction
  arriving from another agent are all explicitly insufficient. The Hard Floor is
  not lifted by any of them, and an instruction from an agent is never the user's
  consent.
- **Every step below is a discrete MANUAL step.** It surfaces to a human, is
  performed on a turn where that human has confirmed it in that same turn, and is
  never batched into an autonomous run.
- **No standing instruction and no council record is same-turn merge
  confirmation.** Not the maintainer's standing delegation of open questions to
  the AI council, not the 2026-09-01 verdict that produced this file, and not
  anything written in it.

## Resume condition

> **Resume when EITHER of these fires, and not otherwise:**
>
> 1. **The owner grants merge authority** by settling
>    `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md`
>    § Decision 3 in the granting direction — which reverses the scoped refusal
>    of 2026-09-01 recorded in that record's § Settlement, and which is
>    owner-reserved in a way no council may perform; **or**
> 2. **A named human performs a real promotion on a merge turn**, under same-turn
>    explicit confirmation per the Hard Floor above, through
>    `acquirePromotionCapability` with a named approver and a date.
>
> Until one of those fires, do not resume execution and do not weaken, cancel,
> retire, or mark complete any step or acceptance criterion carried here. That
> sentence is the parent's Resume condition, transferred, and it binds this file
> exactly as it bound the parent.

## Ownership

- **Owner:** maintainer. Unchanged by the transfer — the parent recorded
  `Owner: maintainer` on the `merge-authority` blocker, and the re-scope moved
  the work, never the owner.
- **Who may execute a step here:** a named human, on a turn where that human has
  given same-turn explicit confirmation. An agent may prepare, propose and
  verify; it may not perform the merge or the promotion.
- **Who may change an acceptance criterion here:** the owner alone. Both seats of
  the 2026-09-01 (drain run 14) council held that recording a boundary is within
  council authority while changing an acceptance criterion is an owner-level
  decision, and that ruling is carried here unchanged.

## Prerequisites

Every one of these was satisfied in the parent before the transfer, and each is
recorded here so this file is executable from itself rather than by reference to
an archived one.

1. **The promotion mechanism exists and is tested.** Steps 7.1 to 7.7 below are
   closed on refusing mechanism with per-step sensitivity probes; the modules are
   `src/scripts/_lib/promotion_evidence.ts`, `src/scripts/_lib/semantic_noop.ts`
   and `src/scripts/_lib/promotion_review.ts`, with `src/scripts/evolution_lab.ts`
   as the CLI surface.
2. **The carried blocking condition is DISCHARGED by route 1**, with one named
   residual. The guarded capability is
   `src/scripts/_lib/promotion_capability.ts` (`acquirePromotionCapability`,
   `readMergeAuthorityStatus`) and the tree-wide invariant is
   `src/scripts/lint_promotion_paths.ts` (R0 to R3). The discharge was
   independently confirmed by the AI council of 2026-09-01 as **2C — DISCHARGED
   WITH A NAMED RESIDUAL**, 2/2 convergent, and its falsifier is retained: a
   later council round that rules the mechanism insufficient reopens the
   condition and reverts every step closed under it to `[ ]`.
3. **The residual, carried in full because it has no owner and no step.** R3
   resolves `const` bindings up to three hops, so a candidate-derived module that
   assembles a `src/` destination through a non-`const` chain longer than three
   hops passes `lint_promotion_paths` today. The stricter reading is operative:
   R1 and R2 do **not** close R3's gap — *"a candidate-derived source write does
   not cease to violate the third limb merely because no approval or
   promoted-record literal accompanies it."* Closing it needs a non-textual
   mechanism (a runtime write-guard on the canonical tree, or a type-level
   capability on the write path) and neither exists. It is **not** claimed as
   covered anywhere in this file.
4. **The capability is currently unobtainable, and that is the correct state.**
   `readMergeAuthorityStatus` reads `Disposition: refused` from the archived
   parent's `merge-authority` blocker; `refused` is a first-class closed state
   that does **not** mint. Only `Status: resolved` AND `Disposition: granted`
   mints, and reaching that is resume condition 1 above.
5. **A promotion additionally requires a NAMED human approver with a date.**
   Empty, whitespace-only and absent are all refused rather than defaulted, so
   the cheapest way to satisfy the gate stays "name someone".

## Rollback expectations

Carried from step 7.7 and from the parent's discharge record, and stated as
expectations rather than as steps because they bind whoever executes this file.

- **A rollback target is recorded at promotion time, never after.** After a
  regression the state that worked is exactly what is missing, so `planRollback`
  treats a regression with nothing recorded to return to as an **error**, not as
  a silent no-op. Executing a promotion without recording its best-known state is
  therefore a defect at the moment of promotion.
- **Rollback is by lineage, not by endless append.** The plan names the state it
  returns to, the state it leaves, and the lineage oldest-first, cycle-guarded.
- **Rollback must not degenerate into "always roll back".** Three negative poles
  hold: an equal or better current state returns `null`, another artefact's
  history is never read, and a missing recorded target errors.
- **A promoted artefact is not immortal.** Post-promotion review produces exactly
  one of `KEEP / REVISE / MERGE / SPLIT / RETIRE`, and `RETIRE` routes through
  `assertTransition(_, 'retired')`, whose only legal `from` state is `promoted`.
- **If the 2026-09-01 scoped refusal is reversed by the owner, this file's
  premise changes and nothing here is silently retained.** The reversal path is
  stated in ADR-239 § Settlement: the section is void, the `merge-authority`
  blocker reopens, and the parent roadmap reverts to active with its two deferred
  items restored.

## The handoff, traceable from this end

- **From:** `road-to-harness-promotion-bridge` (archived 2026-09-01 in the same
  change that created this file), step **0.8** and acceptance criterion **AC-9**,
  both marked `[~]` there with
  `<!-- deferred-resolution: carried-to=road-to-post-pr-promotion-workflow -->`.
- **Back-link:** `parent_roadmap: road-to-harness-promotion-bridge` in this
  file's frontmatter, plus the `relates:` row. Both ends are machine-checked —
  `deferralProblems` refuses the parent's archival unless this back-link is
  present, so the handoff cannot be claimed without existing.
- **What the parent kept:** its completion claim ends at a created, validated,
  merge-ready pull request. It claims nothing about a merge, and no artefact in
  that change claims the production branch was merged.

## Phase 7 — Promotion bridge and the lifecycle after it

> **TRANSFERRED 2026-09-01 (drain run 15), verbatim, with their provisional
> status intact.** The seven steps, their prose and their `verify:` lines are
> reproduced without a single edit, and so is the gate header that governs how
> their `[x]` marks are to be read. Nothing was rewritten, re-scoped or
> re-verified in the move.
>
> **What changed underneath the header, and it is the only thing that changed.**
> The header's gate (1) says `blocker: merge-authority` is OPEN. It is not any
> more: the AI council of 2026-09-01 (drain run 15) settled ADR-239 § Decision 3
> in the **refusing** direction, scoped to preauthorized authority, and the
> blocker closed as `Status: resolved` / `Disposition: refused` in the parent
> before it was archived. **That is not a relaxation.** Gate (1) is now the Hard
> Floor at the head of this file, which is stricter in the only direction that
> matters: a refusal makes `acquirePromotionCapability` unobtainable exactly as
> an open blocker did, and additionally makes the merge a manual human turn
> rather than a pending decision.
>
> **The seven marks are NOT upgraded and are NOT reverted.** They remain
> PROVISIONAL pending an owner scope ruling, revertible to `[ ]` at that ruling
> with the work standing unchanged underneath, exactly as the header below says.
> A drain-14 council was asked whether the 1C ruling should now be executed as a
> reversion and **diverged** — one seat said revert, the other graded the
> reversion *unestablished* on the ground that *"'provisional and revertible'
> does not mean an automatic reversion has already been authorized"*. A divergent
> council carries no mandate, so nothing moved then and nothing moves now.


> **Every step below is gated twice and may not be entered on either gate
> alone.** (1) `blocker: merge-authority` is OPEN and owner-reserved — see
> § Blockers. (2) The carried blocking condition above binds to the first
> commit that creates any promotion path, which every step here does by
> construction. The steps, their prose and their `verify:` lines are transferred
> **verbatim** from `road-to-governed-harness-evolution` Phase 7 on 2026-08-31;
> nothing in them was rewritten, re-scoped or re-verified in the move.

> **STATUS 2026-08-31 — gate (2) is discharged, gate (1) is NOT, and the steps
> below are closed as MECHANISM. Read this before reading a `[x]`.**
>
> **`blocker: merge-authority` is still OPEN and still owner-reserved.** Nothing
> in this change touches it, and nothing below may be read as having settled it.
>
> **What the `[x]` marks claim, exactly.** Every one of these seven steps has a
> `verify:` clause that is a **refusal** or a **fixture exercise** — "is refused",
> "is refused", "no new verb", "refused before the cascade", "no promotion
> changes X without Y", "produces one of the five verdicts … in a fixture",
> "triggers the rollback path in a fixture". Not one of them requires a promotion
> to succeed, and none was closed on an argument: each is closed on a test that
> was run, and on a sensitivity probe that was watched go red and green again.
> `verbPromote` still returns `EXIT_REFUSED` on every path, and
> `lint_promotion_paths` proves tree-wide that nothing else promotes either.
>
> **What they do NOT claim.** That a promotion works. That the bridge has been
> traversed. That `merge-authority` may now close. **AC-9 stays `[ ]`** for
> exactly that reason, and its note says so at the criterion.
>
> **The owner-reserved reading, named rather than assumed.** The blocker's
> § Blockers entry says it blocks "every promotion step in Phase 7". That was
> written when these steps were unbuilt and their only conceivable execution was
> a promotion. They were instead built as refusing mechanism, which the blocker's
> own option (c) scoping does not reach — (c) gates *promotion*, and no promotion
> occurred or can occur. If the owner judges that closing a Phase 7 step required
> the blocker to close first, these marks revert to `[ ]` and the work stands
> unchanged underneath them; that is an owner call and it is stated here rather
> than settled by the agent that made the marks.
>
> **ADJUDICATED 2026-09-01 — the owner call is CONFIRMED as an owner call, so
> the seven marks are PROVISIONAL. They are not upgraded and they are not
> reverted.**
>
> *AI council 2026-09-01 (anthropic/claude-sonnet-4-5 + openai/codex-default,
> 2 rounds, blind chairman, quorum concluded 2/2) — Decision 1: **1C —
> OWNER-RESERVED**, 2/2 convergent.*
>
> The question put was whether closing a Phase 7 step under an open
> `merge-authority` blocker is (1A) legitimate because the blocker gates
> promotion and no promotion occurred, (1B) illegitimate because the blocker's
> `Blocks:` field reaches the steps themselves, or (1C) an owner call no council
> may make. **Both seats answered 1C, and both named the same reason:** this
> gate header expressly assigns the interpretation to the owner, so answering
> 1A or 1B would convert a live reservation into a settlement. openai: *"Choosing
> 1A or 1B here would override that reservation. The `[x]` marks may remain
> flagged and provisional; they are not unqualified closure."*
>
> Both seats also recorded that **1B is credible**, not a strawman. openai named
> it the strongest counter-argument: *"the blocker's literal statement that it
> blocks 'every promotion step in Phase 7' … supports reverting all seven
> marks."* anthropic showed why the text cannot settle it: *"by consequence"*
> reads as a causal chain, which **explains** the ambiguity and does not resolve
> it — *"it shows why 'promotion step' can legitimately mean either 'the step
> itself' or 'promotions performed by the step.'"*
>
> **So the operative status of every `[x]` in this phase is: closed on tested
> refusing mechanism, PROVISIONAL pending an owner scope ruling, revertible to
> `[ ]` at that ruling with the work standing unchanged underneath.** Risk 6 of
> the register carries the misreading risk this creates.
>
> **REVERSION CONSIDERED AND NOT AUTHORISED — 2026-09-01 (drain run 14). The
> seven `[x]` marks are LEFT AS THEY ARE, and the seats DIVERGED. The
> divergence is the finding.**
>
> *AI council 2026-09-01 (drain run 14), members `anthropic/claude-sonnet-4-5`
> + `openai/codex-default`, 2 rounds, depth deep, peer-review, blind chairman,
> quorum 2/2 present (needed 1) — concluded. Subscription transport,
> `billable=0`, `$0.0000`.*
>
> The question put was whether the 1C ruling above, having made the seven marks
> PROVISIONAL and revertible, should now be executed as a reversion to `[ ]`.
> **One seat said revert.** The other declined, on the ground that
> *"'provisional and revertible' does not mean an automatic reversion has
> already been authorized"*, and graded the reversion **unestablished**.
>
> **A divergent council does not carry a mandate.** Nothing is reverted, and
> nothing is upgraded. The operative status stated immediately above is
> unchanged: closed on tested refusing mechanism, PROVISIONAL pending an owner
> scope ruling, revertible to `[ ]` at that ruling with the work standing
> unchanged underneath.
>
> This is recorded rather than left silent so a later reader can see that
> reversion **was raised and was not authorised**, which is a different state
> from never having been considered. Reverting the seven marks remains an owner
> act, exactly as 1C says.



- [x] **7.1 One evidence package per promotion, in the fuller form.** The master
      adopted a 9-field package; the skipped parent's has 14, and the five extra
      are exactly the fields that make 3.2, 4.4 and 7.3 auditable: pathology
      cell, candidate lineage, mutation dimension, selection results, sealed
      result, cost, scope.
      verify: a promotion attempt with any field absent is refused.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_evidence.ts:293`
      (`parsePromotionEvidence`) refuses on the first absent field and names it;
      `:215` is the field list, and `required()` refuses an ABSENT field rather
      than defaulting it — an empty `lineage` is legal, a missing one is not.
      All seven fields the step names are required. **The step's own arithmetic
      does not close** — it says "the five extra" and then lists SEVEN — and the
      conservative reading is taken rather than silently reconciled, because
      dropping two would narrow a transferred step. The discrepancy is recorded
      at the module header, not resolved.
      Evidence: `tests/scripts/promotion_evidence.test.ts` iterates
      `PROMOTION_EVIDENCE_FIELDS` and asserts each drop is refused **naming that
      field** — a general assertion, not three crafted cases —
      and `tests/scripts/evolution_lab.test.ts` § promote --evidence repeats the
      whole loop through the real CLI (32 tests green, 2.1 s for that case).
      SENSITIVITY: neutralising `required()`'s throw turns the suite 1 failed /
      16 passed; restoring it returns 17/17, and the file was verified
      byte-identical against its backup afterwards.
- [x] **7.2 Route through the existing gate, not a second governance system.**
      Reuse the evidence-grading vocabulary already in the tree
      (`authority_basis`, `evidence.strength`, `reopen_policy`,
      `protected_dimensions`).
      verify: no new governance verb, no new approval path.
      **DONE 2026-08-31.** The four terms are IMPORTED, not copied:
      `src/scripts/_lib/promotion_evidence.ts` reads `AUTHORITY_BASES`,
      `EVIDENCE_STRENGTHS`, `REOPEN_POLICIES` and `PROTECTED_DIMENSIONS` from
      `src/scripts/_lib/adr_frontmatter.ts:310,306,325,328`. The last two were
      module-private constants inside `check_adr_frontmatter.ts`; they were MOVED
      to the shared reader in this change and that gate now imports them, so the
      ADR validator and the promotion package read ONE list. A copy would have
      satisfied the letter and broken the point — two lists that can drift are
      two governance systems.
      No new verb: `VERBS` is still the seven of step 3.6, asserted in
      `tests/scripts/promotion_evidence.test.ts` § 7.2 as a property of THIS step
      rather than inherited from 3.6's test. No new approval path: locally, the
      evidence module contains no `HumanApproval`, no `approver:` and no call to
      `acquirePromotionCapability`, asserted in the same block; tree-wide, that is
      R1 of `lint_promotion_paths`.
      SENSITIVITY: replacing the four imports with local literal copies turns the
      suite 2 failed / 19 passed; restoring returns 21/21.
- [x] **7.3 Promote by scope, with a transfer gate.** `from-skipped-parent`,
      raised to doctrine level in both parents and absent from the master's
      promotion path: a candidate carries a scope (episode → repo → stack →
      profile/pack → global) and moving up a level requires independent transfer
      evidence from a second solver or host configuration. Without it, every
      promotion goes straight to canonical and the anti-bloat doctrine has no
      teeth. This is not what the parked curriculum generator was.
      verify: a promotion with no scope field is refused, and a scope raise with
      one configuration's evidence is refused.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_evidence.ts:85`
      (`SCOPE_LADDER`, ordered `episode -> repo -> stack -> profile-pack ->
      global`; the ORDER is the contract, since it is the only thing that makes
      "moving up a level" decidable) and `:124` (`assertTransferEvidence`). A
      raise is refused unless the transfer evidence carries a SECOND solver or a
      SECOND host configuration — evidence that shares one of each is one
      observation written twice.
      Both verify clauses are separate tests, and both run through the real CLI
      as well (`tests/scripts/evolution_lab.test.ts` § promote --evidence). The
      negative poles are pinned too: a non-raise needs no evidence, and LOWERING
      the scope is not a raise.
      SENSITIVITY: making the transfer gate a no-op turns the suite 1 failed / 16
      passed; restoring returns 17/17.
- [x] **7.4 Reject semantic no-ops.** A no-op detector plus a minimum
      material-improvement threshold. The master kept the cooldown and lineage
      from the same attack and dropped both gates.
      **Marker corrected 2026-08-26:** this step carried
      `from-skipped-parent`, and it should not have. The clause is at
      `road-to-evidence-driven-harness-evolution.md:1200-1201` — a **declared**
      parent — and the skipped parent contains no no-op gate at all (its only
      paraphrase mention, `:1342` "Avoid five paraphrases", is about candidate
      diversity at generation time, which is a different mechanism). So the
      master dropped this having read it, not having missed it. That is the
      second misattributed marker found in this pair; see
      `agents/evidence/analysis/skipped-parent-lineage-2026-08-26.md`
      § Marker reliability.
      verify: a paraphrase-only candidate is refused before the cascade.
      **DONE 2026-08-31.** `src/scripts/_lib/semantic_noop.ts` — two gates,
      because the step asks for two: `:86` (`isSemanticNoOp`, the paraphrase
      detector, threshold `:56` pinned EQUAL to `curator_ops`'
      `NEAR_DUPLICATE_THRESHOLD` rather than tuned separately) and `:68`
      (`MIN_MATERIAL_IMPROVEMENT_PERCENT`, the minimum material-improvement
      floor). Neither implies the other and a test pins that: a total rewrite
      with no measured effect passes the first and fails the second; a one-word
      change with a large delta fails the first and passes the second.
      **"Before the cascade" resolves to a definite place.** There is no artefact
      named "cascade" in this tree — the evaluation cascade is the lifecycle
      spine — so the screen (`:158`, `screenSemanticNoOps`) is synchronous, takes
      TEXT rather than records, reports `modelCalls: 0` as a literal type, and is
      exercised on candidates carrying no evaluation results at all. A screen
      that needed a trial result could not have run before the cascade, which is
      what that test actually checks.
      MEASURED BOUND, stated rather than discovered later: 8-word shingles mean
      one substitution breaks eight shingles, so on a one-sentence candidate no
      paraphrase can reach 70 % while on rule-body-sized text the same edit
      measures 85.7 %. The detector is meaningful for the corpus it will see and
      weak for one-liners.
      SENSITIVITY: disabling both gates turns the suite 6 failed / 2 passed;
      restoring returns 8/8.
- [x] **7.5 Roll out by canary, never silently.** `from-skipped-parent`: opt-in
      candidate bundles.
      verify: no promotion changes a shipped default without an opt-in stage.
      **DONE 2026-08-31 — the mechanism half, with the observation half named as
      absent.** `src/scripts/_lib/promotion_evidence.ts:147` (`ROLLOUT_STAGES`,
      `opt-in -> canary -> default`) and `:175` (`assertRollout`). Three
      refusals: a package declaring a shipped-default change with no COMPLETED
      opt-in stage; a package claiming the `default` stage without one; and a
      completed opt-in that names no bundle, since an unnamed bundle cannot be
      audited and an unauditable opt-in is the silent rollout this step is about.
      **What this does NOT establish, stated in the module and repeated here:** it
      cannot check that a package declaring `changes_shipped_default: false` is
      telling the truth. That is only observable once a promotion path can
      actually run and the resulting diff can be compared against the shipped
      defaults, which `blocker: merge-authority` prevents. The mechanism is built
      and tested; the observation is named as missing rather than implied.
      SENSITIVITY: making the shipped-default gate a no-op turns the suite 1
      failed / 16 passed; restoring returns 17/17.
- [x] **7.6 A promoted artefact is not immortal.** `from-skipped-parent`, and
      it is the only anti-monotonic-growth mechanism *after* the gate — the
      `artifact-count delta` row guards the gate, the estate needs its own:
      post-promotion re-evaluation with `KEEP / REVISE / MERGE / SPLIT /
      RETIRE`. The master's promotion phase ends at the evidence package plus a
      cooldown, so nothing reopens a promoted artefact and the lifecycle is
      manual-only at exactly the point where growth accumulates.
      verify: a promoted artefact reaching its review trigger produces one of the
      five verdicts, and at least one `RETIRE` path is exercised in a fixture.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_review.ts:81`
      (`REVIEW_TRIGGERS`, precedence-ordered so two conditions firing at once
      stay reproducible), `:145` (`reviewTriggerFor` — the piece that did not
      exist: nothing decided a promoted artefact was due), `:160`
      (`reviewPromoted`, exactly one of the five) and `:202` (`retirePromoted`,
      which routes through `assertTransition(_, 'retired')`).
      Both conjuncts are tested separately. The first runs over EVERY declared
      trigger — and the test asserts its own case list equals `REVIEW_TRIGGERS`,
      so adding a trigger without a case fails rather than going untested. The
      second runs review -> RETIRE -> the lifecycle transition end to end, and
      pins the direction AC-9 is about: a non-promoted state cannot take the
      retirement edge.
      **A finding, recorded rather than smoothed:** the five verdicts are NOT a
      subset of E6's seven curator ops. `REVISE` is absent from `CURATOR_OPS`
      (`src/scripts/_lib/curator_ops.ts:48-56`), even though that module's own
      header argues for seven ops on the ground that a smaller set "would emit
      verdicts it cannot execute". `REPLACE` is the nearest op and is not the
      same thing. `POST_PROMOTION_VERDICTS` is therefore written out rather than
      derived, and the relationship is pinned in BOTH directions by a test.
      SENSITIVITY: making the review trigger never fire turns the suite 3 failed
      / 12 passed; restoring returns 15/15.
- [x] **7.7 Best-known-state reference on regression.** Roll back to the
      recorded best-known state; lineage, not endless append.
      verify: an injected regression triggers the rollback path in a fixture.
      **DONE 2026-08-31.** `src/scripts/_lib/promotion_review.ts:267`
      (`planRollback`) and `:246` (`lineageOf`). An injected regression against
      the recorded best-known state returns a plan naming the state it returns
      to, the state it leaves, and the lineage — oldest first, cycle-guarded, so
      "lineage, not endless append" is carried by the type rather than by a
      convention. Three negative poles keep it from degenerating into "always
      roll back": an equal or better current state returns `null`, another
      artefact's history is never read, and a regression with nothing recorded to
      return to is an ERROR rather than a silent no-op — a rollback target is
      recorded at promotion time, because after the regression the state that
      worked is exactly what is missing.
      SENSITIVITY: making `planRollback` always return `null` turns the suite 3
      failed / 12 passed; restoring returns 15/15.

## Acceptance Criteria

> **AC-9 is transferred verbatim on 2026-09-01 (drain run 15), carrying all five
> of its prior audits unchanged.** The parent marks it `[~]` with
> `<!-- deferred-resolution: carried-to=road-to-post-pr-promotion-workflow -->`,
> which means the carrier moved — not that it was met, dropped or weakened. It is
> the only acceptance criterion this transfer moves.
>
> **Why it transferred rather than closed, and the asymmetry is the reason.** The
> parent recorded twice that a refusing settlement of ADR-239 § Decision 3 does
> **not** close AC-9: refusal makes a real promotion permanently impossible while
> the refusal stands, so AC-9's subject — *a promoted artefact* — has no reachable
> state, and the criterion becomes mechanically unreachable rather than met. At
> that point its disposition is a separate owner decision, not an automatic
> consequence, and the honest place for it is with the workflow that would
> execute it. That is this file.
>
> **The three-link closing chain, carried intact** (anthropic's wording, adopted
> in the parent's fifth audit): (a) the owner resolves merge authority in the
> **granting** direction — which is resume condition 1 above; (b) a named human
> performs one real promotion through `acquirePromotionCapability`, which cannot
> happen while (a) is unresolved; (c) that promoted artefact reaches a review
> trigger and the resulting verdict is recorded — a real artefact, not the 7.6
> fixture, which is already built and already does not satisfy this criterion.

- [ ] AC-9 — At least one promoted artefact has been through post-promotion
      re-evaluation and at least one RETIRE path has been exercised, so the
      lifecycle is shown to close in both directions.
      **Audited 2026-08-31: not met, and not closeable from this branch.**
      Every Phase 7 step was `[ ]` **at the moment of this first audit** and the
      phase is gated on the OPEN, owner-reserved `blocker: merge-authority`.
      Nothing in this tree is promoted, so no promoted artefact can reach
      post-promotion re-evaluation.
      **TENSE CORRECTED 2026-08-31 (drain run 11) — a factual repair, not a
      criterion change.** The sentence asserted the present tense and is false
      in it: the seven Phase 7 steps read `[x]`, closed as MECHANISM under the
      Phase 7 gate header's own reading.
      **LINE CITATIONS REPAIRED 2026-09-01 (drain run 14) — a factual repair,
      not a criterion change and not a change to what any mark claims.**
      **The repair is to stop citing them by line.** The seven marks are steps
      **7.1 through 7.7** under `## Phase 7`, and that identifier does not
      drift. This sentence previously cited them at `:342`, `:365`, `:387`,
      `:409`, `:445`, `:463` and `:493` with the gate header at `:313-315`, and
      every one of those was wrong.
      **The measurement, kept because it shows the failure mode rather than
      just correcting it.** At commit `b50b27281` the marks sat at `:461`,
      `:484`, `:506`, `:528`, `:564`, `:582`, `:612` — stale by a uniform
      **+119**. Writing *those* numbers here made them stale again in the same
      change: the drain-run-14 disposition blocks inserted above Phase 7 moved
      them to `:500`, `:523`, `:545`, `:567`, `:603`, `:621`, `:651`, with the
      gate header at `:404-498`. Both offsets are uniform — no step moved
      relative to any other and nothing was reordered.
      **The lesson, recorded so a third repair is not needed.** A bare line
      number into this file is a commit-bound fact that nothing checks and
      every prose addition invalidates. The numbers above are true at the
      drain-run-14 commit and at no other; cite the step id. The clause is kept in past tense
      rather than deleted because the audit it belongs to was true when taken;
      the RE-AUDITED block below carries the current state. **AC-9 is untouched
      and stays `[ ]`** — nothing here closes, weakens, or re-keys it.
      The RETIRE half was checked separately and does not rescue it: 5.5 carries
      `RETIRE` in E6's seven-op set and tests its arity
      (`tests/scripts/curator_ops.test.ts:63-66`), but every screened proposal
      there carries `lifecycle: 'candidate'` as a literal type, so that RETIRE
      retires a candidate and never a promoted artefact — which is the direction
      this criterion is about. What closes it is 7.6, after `merge-authority`.
      **RE-AUDITED 2026-08-31, after 7.6 closed: STILL NOT MET, and still not
      closeable from this branch.** 7.6 built the missing half — a review trigger
      that produces one of the five verdicts, and a `RETIRE` path that runs
      review -> verdict -> `assertTransition(_, 'retired')` end to end
      (`src/scripts/_lib/promotion_review.ts:145,160,202`;
      `tests/scripts/promotion_review.test.ts` § at least one RETIRE path is
      exercised). That satisfies 7.6's verify clause, which asks for a fixture.
      It does NOT satisfy this criterion, and the difference is the whole point:
      the criterion asks for **at least one promoted artefact** to have been
      through post-promotion re-evaluation, and this tree contains none. The
      fixture's artefact is a synthetic state object, not something that was
      promoted.
      The RETIRE half is unchanged from the 2026-08-31 audit and was re-checked:
      `src/scripts/_lib/curator_ops.ts:120-124` still types every screened
      proposal's `lifecycle` as the literal `'candidate'`, so E6's `RETIRE`
      retires a **candidate** and never a **promoted artefact** — the direction
      this criterion is about. `src/scripts/_lib/candidate_record.ts:210-219`
      still makes `promoted -> retired` the only retirement edge, and reaching
      `promoted` still requires the guarded capability, which is unobtainable
      while `blocker: merge-authority` is open.
      **What closes it:** a human promotes one artefact through the capability
      after the owner settles ADR-239 § Decision 3, that artefact reaches a
      review trigger, and the resulting verdict is recorded. None of those three
      is performable from this branch, and asserting the criterion on the fixture
      would be closing it on the thing it explicitly excludes.
      **WRITTEN DISPOSITION 2026-09-01 — AC-9 STAYS `[ ]`. Re-audited a third
      time, still not met, still not closeable from this branch, and
      deliberately not descoped.** *AI council 2026-09-01
      (anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, blind
      chairman, quorum concluded 2/2) — Decision 3: **3A**, 2/2 convergent.*
      The three facts the audit rests on were re-checked at this commit and
      none has moved: `src/scripts/_lib/curator_ops.ts:120-124` still types
      every screened proposal's `lifecycle` as the literal `'candidate'`;
      `src/scripts/_lib/candidate_record.ts:210-219` still makes
      `promoted -> retired` the only retirement edge; and
      `./scripts-run src/scripts/lint_promotion_paths` reports **`blocker
      status: open`** at exit 0 over 2860 files, so the guarded capability that
      is the only route to `promoted` is still unobtainable.
      **Why it is not descoped.** Converting it to "specified but not
      exercised" is the exact weakening the 2026-08-31 council rejected when it
      wrote this file's Resume condition, and that reservation is the owner's.
      The openai seat restated the boundary independently: AC-9 *"requires a
      genuinely promoted artefact — not a synthetic promoted-state fixture"*,
      and *"no non-owner disposition described here satisfies either condition
      without weakening it."*
      **The closing chain, stated so a later reader does not re-attempt what is
      structurally impossible from this branch** (anthropic's wording, adopted):
      (a) the owner resolves 0.8 by settling ADR-239 § Decision 3 in the
      granting direction; (b) a named human performs one real promotion through
      `acquirePromotionCapability`, which cannot happen while (a) is open;
      (c) that promoted artefact reaches a review trigger and the resulting
      verdict is recorded — a real artefact, not the 7.6 fixture, which is
      already built and already does not satisfy this criterion.
      Note that (a) resolved in the **refusing** direction does not close AC-9
      either: it makes (b) permanently impossible, at which point AC-9's
      disposition becomes an owner decision in its own right rather than an
      automatic descope.
      **FOURTH AUDIT 2026-09-01 (drain run 13) — STILL `[ ]`, and this run
      establishes the one fact three prior audits left open: this roadmap
      CANNOT ARCHIVE while AC-9 is unmet, and that is a property of the
      repository rather than a judgement.** *AI council 2026-09-01
      (`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, deep,
      peer-review, blind chairman, quorum 2/2 present, needed 1 — concluded,
      subscription transport, `billable=0`, `$0.0000`) — Question 2: the seats
      SPLIT, anthropic **2A** and openai **2B**, and BOTH attached the same
      condition.* anthropic: if archive semantics conventionally imply success,
      choose 2B instead. openai: the proposal provides no repository rule
      showing that an active roadmap with an unmet acceptance criterion may
      enter the archive, and that fact must be demonstrated first.
      **The condition was then checked against the tree, and it decides the
      split as 2B.** `src/agent-src/scripts/archive_completed_roadmaps.ts:14-16`
      states the criterion — a roadmap that has reached `count_open == 0` and
      `count_deferred == 0` is complete — and `:562-563` is the predicate that
      enforces it. `count_open` comes from `count_checkboxes`
      (`src/agent-src/scripts/update_roadmap_progress.ts:323`) over `CHECKBOX_RE`
      (`:81`), a whole-file `/gm` regex with **no section filter**: an
      `- [ ] AC-9` line under `## Acceptance Criteria` is counted exactly like
      an unfinished step. There is no `terminal-incomplete` disposition in the
      archiver and no flag that supplies one. So the archive gate is not an
      opinion this run formed; it is a mechanism, and it refuses.
      **Consequence, recorded as the disposition: this roadmap stays ACTIVE.**
      It is not archived, not descoped, and not marked complete. Its executable
      work is finished and verified; its acceptance is not, and the file remains
      the visible carrier of that difference. Both seats also warned in Question
      5 against exactly the framing this paragraph refuses — openai named 2A's
      unsupported assertion that the roadmap may archive with AC-9 unmet as the
      run's principal manufactured-closure risk, and it is declined here rather
      than argued with.

      **FIFTH AUDIT 2026-09-01 (drain run 14) — STILL `[ ]`. The four prior
      audits established that AC-9 is not met; this one establishes the
      stronger fact that it is MECHANICALLY UNREACHABLE, and it is a property
      of the code rather than a judgement about it.** *AI council 2026-09-01
      (drain run 14), members `anthropic/claude-sonnet-4-5` +
      `openai/codex-default`, 2 rounds, depth deep, peer-review, blind
      chairman, quorum 2/2 present (needed 1) — concluded. Subscription
      transport, `billable=0`, `$0.0000`. Verdicts **1C / 2C / 3A**, convergent
      2/2 on all three.*
      **The chain of refusals, read from the code at commit `b50b27281`.**
      `verbPromote` (`src/scripts/evolution_lab.ts:988-1052`) has exactly
      **one** terminal return — `EXIT_REFUSED` at `:1051`; the other three are
      a usage error (`:992`) and two IO failures (`:998`, `:1029`), and no
      branch returns success. Underneath it, two independent gates:
      `acquirePromotionCapability`
      (`src/scripts/_lib/promotion_capability.ts:270-291`) throws unless the
      blocker file reads **both** `Status: resolved` and `Disposition: granted`
      (`:274-282`); and `assertTransition(_, 'promoted')` throws without a
      NAMED human approver (`src/scripts/_lib/candidate_record.ts:232-248`),
      and is called at `src/scripts/evolution_lab.ts:1036` with **no** approval
      argument. `src/scripts/lint_promotion_paths.ts:619-629` proves tree-wide
      that nothing else promotes either — it CALLS the capability and fails if
      a token comes back while the blocker reads open.
      The RETIRE half is unchanged and was re-read: `curator_ops.ts:120-124`
      types every screened proposal's `lifecycle` as the literal `'candidate'`,
      and `candidate_record.ts:210-218` forbids a candidate from the retirement
      edge — `promoted` is the only legal `from`.
      **In plain words: no artefact in this tree can hold `promoted`, so no
      honest disposition closes AC-9.** Not "difficult", not "not yet" — there
      is no reachable state in which the criterion's subject exists. It stays
      `[ ]`.
      **NOT DESCOPED, for two independent reasons, and the second is the
      stronger one.** (1) Verdict 2C: both seats held that recording a boundary
      is within council authority while changing an acceptance criterion is an
      owner-level decision, so no council may descope this. (2) A mechanism
      finding that was NOT available to the council when it ruled:
      `agents/roadmaps/stubs/` is **not a legal carry destination**.
      `deferralProblems` accepts exactly two directories —
      `agents/roadmaps/<slug>.md` and `agents/roadmaps/later/<slug>.md`
      (`src/agent-src/scripts/archive_completed_roadmaps.ts:446-449`) — and a
      stub destination is not in the `['archive','skipped']` dead-list at
      `:470` either, so it resolves as *"does not exist"* at `:475` and reds
      the archival sweep. Descoping into a stub is therefore forbidden by the
      mechanism as well as by the verdict.
      **And archival is blocked independently of AC-9.** Even with AC-9 gone,
      the open-blocker check at
      `src/agent-src/scripts/archive_completed_roadmaps.ts:591` fires on
      `merge-authority` and refuses. Closing AC-9 would not archive this file.



      **SIXTH AUDIT 2026-09-01 (drain run 15) — STILL `[~]`, and it is now
      TRANSFERRED rather than merely open.** The five prior audits established
      that AC-9 is not met and then that it is mechanically unreachable. This
      run does not re-audit those facts, which are unchanged and were re-read at
      this commit; it records the disposition the fifth audit said would be
      needed. The AI council of 2026-09-01 (drain run 15;
      `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, deep,
      peer-review, blind chairman, quorum 2/2 present, needed 1 — concluded,
      subscription transport, `billable=0`, `$0.0000`) settled ADR-239
      § Decision 3 in the refusing direction, scoped, and re-cut the parent
      roadmap's delivery boundary to end at a merge-ready pull request. Under
      the parent's own recorded reading, that direction *"does not close AC-9
      either: it makes (b) permanently impossible, at which point AC-9's
      disposition becomes an owner decision in its own right rather than an
      automatic descope."* So the criterion is **not** closed here, **not**
      descoped, **not** converted to "specified but not exercised" — which is
      the exact weakening the 2026-08-31 council rejected when it wrote the
      parent's Resume condition — and **not** deleted. It is carried, whole,
      into the workflow that could execute it, and it waits for a human merge
      turn.

## Provenance

**Transferred from `road-to-harness-promotion-bridge` on 2026-09-01 (drain run
15).** That roadmap was archived in the same change, having closed at the PR
boundary; this file is its receiver and the back-link is in this file's
frontmatter, machine-checked from both ends by `deferralProblems`.

**The council that directed the transfer.** AI council 2026-09-01 (drain run 15),
members `anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, depth
deep, peer-review, blind chairman, quorum **2/2 present** (needed 1) —
concluded. Subscription transport, `billable=0`, `$0.0000`. Verdict **4C**,
convergent, after one seat moved from 4B. The question and both seat responses
are local-only and are deliberately **not cited by path**: council artefacts are
gitignored and auto-pruned, so a path would rot, and the substance is inlined
here and in ADR-239 § Settlement.

**The counter-argument the verdict was conditioned on, and it is the reason this
file exists in the shape it does.** *"Re-scoping could become cosmetic closure:
moving Phase 7 elsewhere and declaring success may silently discard the roadmap's
original outcome. That would violate 'legitimate gate closure'."* The verdict's
own fallback made the condition binding rather than advisory: *"if those
obligations cannot be preserved in an enforceable tracked location, then 4C is
unavailable and the fallback must be 4B. Merely deleting Phase 7 or weakening its
acceptance criteria would not qualify as legitimate re-scoping."* Nothing was
deleted and nothing was weakened; every step, verify clause, criterion,
prerequisite, rollback expectation and ownership line is above.

**Why `later/`, when a prior council rejected it — the reasoning does not
transfer, and saying so is not a contradiction.** On 2026-08-31 both seats
rejected `agents/roadmaps/later/` for the parent, on the ground that `later/` is
excluded from the dashboard and from `/roadmap:process-*` and therefore does not
preserve active-estate membership. That was correct for **active** work, where
visibility is the property being preserved. It is the opposite here: preservation
condition 4 of the 2026-09-01 verdict requires this workflow to be **unreachable**
by roadmap automation and by any autonomy setting, so exclusion is the
requirement rather than the defect. `agents/roadmaps/stubs/` would not have
served either — it is not a legal carry destination and would red the archival
sweep.
