---
complexity: lightweight
status: ready
estate_growth_exempt: "open_blockers 41 -> 42, and the +1 is a constraint moved out of prose into the place a gate reads, not an obligation created. Before this change the obstacle existed as this file's body text inside a `status: draft` roadmap that the dashboard does not show and `check_estate_count` did not count -- the reserve cannot ship because no protected-approval store exists, which the deciding council seat made an ordering condition (`wording alone creates an exploitable trust gap`) rather than a preference. The change is what MADE it countable: flipping to `ready` was owed the moment Phase 1.1 was decided, because this file's own frontmatter tied its draft status to exactly that (`it ships status: draft precisely so it costs no active slot until a maintainer decides Phase 1.1`). Counting the move as new obligation prices the fix higher than the defect -- ADR-262's argument, applied to the same shape. No work was created and none was hidden: 1.1 closed, 1.2 cancelled, and the one step that remains carries the obstacle that was always there. `active_roadmaps` is unchanged, so this is the blocker metric alone."
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Offsets nothing, and the reason is the roadmap's own subject. It records a policy defect the PR-drain run of 2026-09-08 hit three times and had no authority to fix: the standing-payload grace ceiling sits on HEAD by construction while its own file says it may never rise. Offsetting would mean archiving or parking an unrelated roadmap to buy room for a finding — which is the laundering the estate ratchet exists to prevent, done in the ratchet's name. One other roadmap mentions the budget — `grep -rl preamble-payload agents/roadmaps/*.md` returns `road-to-delivery-for-every-host.md` besides this file — and it is not a fold-in candidate on two counts: its subject is the delivery-mode flip and the ceiling appears there only as a cost it pays, and it is itself unmerged and blocked on an owner decision, so folding into it would park this finding behind that one. (An earlier draft of this line claimed the grep returned nothing; it was run, it did not, and the claim is corrected rather than removed.) It ships `status: draft` precisely so it costs no active slot until a maintainer decides Phase 1.1, which is a decision step with no implementation attached."
---
# Road to a standing budget with headroom

> **Source:** the PR-drain run of 2026-09-08
> (`agents/evidence/pr-drain-run-summary.md`, that run's section). The finding
> is not an opinion about the budget — it is the third occurrence of one
> collision, and the first two were closed by work that the third cannot repeat.

## Goal

`src/config/preamble-payload-budget.json` stops being a control whose only two
exits are a forbidden action or the deletion of an obligation. Concretely: a PR
that adds a justified standing-rule Iron Law can go green without raising a
ceiling the file says may never rise, and without a maintainer having to decide
it case by case — or, if that is the intended cost, the file says so in those
words and the "may never move UP" sentence goes, because it is currently
contradicted by its own history twice over.

## The finding, as measured

The grace ceiling is, by `ci_delivery.why_a_grace_ceiling`, *"set AT the
measurement so growth beyond today reds immediately while today's tree
passes"*. That makes it sit exactly on HEAD — 138,490 is `main`'s own
measurement — so **any** standing growth in **any** PR reds. The same block
says *"It may never move UP."*

`grace_ceiling_history` records it moving up twice regardless: 138,212 → 138,273
on 2026-09-02 and 138,273 → 138,490 on 2026-09-08, each with a detailed
justification. So the practised resolution is the one the file forbids.

Three occurrences of the identical collision:

| When | PR | Growth | How it was closed |
|---|---|---|---|
| 2026-08-29 | #1707 | +770 tok in `source-confidentiality` | migrated prose to a new guideline; reached −350 |
| 2026-09-08 | #1920 | +298 tok in `external-code-graph-interop` | migrated prose to a skill body; reached −4 |
| 2026-09-08 | #1921 | +786 tok in `notes-first-reasoning` | migrated to −608 of it; **117 tok remain and cannot migrate** |

The third is the one that matters. What remains in #1921 is two fenced Iron Law
blocks — the rule is +478 chars over `main` and the blocks are ~480 — and
`preservation-guard` forbids condensing a fenced Iron Law further. Migration was
the escape hatch for the first two cases and it does not exist for an Iron Law.

## Phase 1 — Decide what the budget is for

- [x] **1.1 Put the contradiction to the owner as one question.** The file's
      `owner` is `maintainer` and the question is not an engineering one: either
      the ceiling may rise on a recorded justification (in which case the "may
      never move UP" sentence is wrong and goes), or it may not (in which case
      the file must say that a standing-rule Iron Law addition is not available
      without a compensating reduction elsewhere, which is a real product
      constraint and belongs stated).
      verify: the decision is recorded in the file's `ci_delivery` block or in
      an ADR the block cites, and the sentence that survives matches the
      practice recorded in `grace_ceiling_history`.

      **Done 2026-09-08 — the answer is "it may NOT rise".** Recorded as
      [`ADR-264`](../../docs/decisions/ADR-264-standing-payload-grace-ceiling-may-not-rise.md),
      cited from the `ci_delivery` block via the new `decision_record` key
      (`src/config/preamble-payload-budget.json`). Both halves of the verify hold: the
      ADR is cited by the block, and the surviving sentence is *"the grace ceiling is
      set at the measured `HEAD` value and may not move upward"*.

      **The second half of the verify needs its own sentence, because it does not read
      the way the step assumed.** The step asks that the surviving sentence "matches the
      practice recorded in `grace_ceiling_history`". It does not, and that is the
      decision rather than a failure of it: the council found the practice wrong, not
      the sentence. The two raises stand as violations caused by the contradictory
      wording, explicitly not as precedent. A step written on the assumption that
      practice wins is answered honestly by recording that it lost.

      **The council split 2 of 2 and was resolved on evidence, not preference.** One
      seat delivered Option B with a full mechanism. The other rejected A and B alike
      and proposed a third reading — the ceiling is a *baseline*, not a cap, so the
      raises are re-measurements — and attached a falsifier naming three conditions,
      *any* of which would mean it had misread the context. Condition 2 (checkable
      Iron Law criteria exist) holds: `src/scripts/check_condensation.ts:196` carries
      `IRON_LAW_HEADING = /^(#{2,6})\s+(The\s+)?Iron Laws?\b/`, enforced over every
      projection. Condition 3 also fails for that reading: `git log -S'may never move
      UP'` returns one commit, `4ef90d350` of **2026-08-24**, which predates both raises
      — so the sentence came first and the raises broke it.
      What survives the falsifier is the dissent's deeper point, and ADR-264 keeps it:
      a heading regex is syntactic and cannot tell whether prose deserves Iron Law
      status, which is why the designed reserve verifies protected approval metadata
      rather than inferring importance from fence syntax.

- [-] **1.2 If the answer is that it may rise: give the raise a shape.** <!-- CANCELLED 2026-09-08: its own conditional did not fire; see ADR-264 -->
      **Not applicable, and cancelled rather than left open.** The step is written as a
      conditional — *"if the answer is that it may rise"* — and 1.1's answer is that it
      may not. There is no raise to give a shape to.
      `[-]` and not `[ ]`: leaving it open would make the roadmap unarchivable on a
      branch of a decision tree that was never taken, which is the failure mode the
      prohibition-glyph convention (`roadmap-writing` § 6, council 2026-09-08) was
      settled to avoid in the neighbouring case. `[-]` is owner-reserved and is used
      here on the delegated council's recorded decision, named in the annotation.
      Worth keeping rather than deleting: both seats independently rejected the shape
      this step would have produced. A structured raise record improves auditability
      and still lets the guarded value grow whenever an author supplies acceptable
      prose — *"structure is not consent, it is packaging"*. That is the reasoning that
      cancelled the step, and it is the reasoning a future proposal to reinstate it
      has to answer. Today
      a raise is an ad-hoc edit justified in prose. Name what a raise must
      carry — the measured delta, the migration attempt and its result, and why
      the residual is irreducible — so the next one is a filled-in form rather
      than an argument.
      verify: the two recorded raises satisfy the shape retroactively, or the
      shape is wrong.

- [~] **1.3 If the answer is that it may not: give the ceiling headroom.**
      <!-- deferred-resolution: carried-to=road-to-iron-law-reserve-activation -->
      A ceiling pinned to HEAD reds on the first token and teaches readers to
      route around it. Whatever the mechanism — a stated band, a per-PR
      allowance, a scheduled re-measure — the property to buy is that a PR
      adding one justified Iron Law is not automatically red.
      verify: a fixture PR adding ~120 standing tokens passes
      `check_preamble_payload_budget` without any config edit in its own diff.
      <!-- blocked-by: iron-law-reserve-needs-protected-approval | asked: no — owner-delegated drain run, council decided the design and blocked the shipping -->

      **DEFERRED 2026-09-08, and the reason is a refusal rather than an omission.** An
      AI council (anthropic/claude-sonnet-4-5 + openai/codex-default, 2 of 2 present,
      **converged**) was asked item 1 of the blocker — where an approval record may live
      such that a PR author cannot create it — and rejected the axis. Recorded as
      [`ADR-265`](../../docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md);
      carried to [`road-to-iron-law-reserve-activation`](road-to-iron-law-reserve-activation.md).

      **The finding: no choice of store closes the gap, because the verifier is inside the
      change it authorises.** openai — *"The checker, its imports, token census, workflow,
      and status context are all part of the trusted computing base. A PR author who can
      change any of them may bypass a perfectly protected approval record."* So the
      blocker's own claim that *"everything after it is mechanical"* is refuted, and the
      three candidate stores it named could not have produced an answer: each protects the
      record and none protects the reader.

      **Three further defects, each independently sufficient.** The proposed trust root is
      false under the live ruleset — `required_approving_review_count: 0`, so a two-PR
      sequence *"separates time, not authority"*. Concurrent consumption is unresolved: two
      PRs read the same base, see the same capacity, and both pass, and the staleness
      survives the first merge. And `ci_delivery.honest_limit` is an *advisory* precedent,
      so citing it to authorise a mechanism claiming independent authorization is incoherent
      (anthropic).

      **This step's verify cannot be met honestly, which is why it is `[~]` and not `[x]`.**
      It asks for a fixture PR adding ~120 standing tokens to pass without a config edit —
      and satisfying that means activating the mechanism the council refused. Advisory-only
      was offered by one seat and refused by the other as an answer to this step: *"an
      advisory message followed by a successful status is not a gate and does not resolve
      the blocker"*. Reporting it as done either way would have been the laundering the
      `[~]` glyph exists to prevent.

      **What shipped instead** — `src/scripts/_lib/standing_bound_ratchet.ts`: the grace
      ceiling is compared against the value at the base ref and a rise refuses the run,
      whether it arrives by editing the config or by passing a larger `--ceiling`. That is
      not headroom and does not close this step. It is the enforcement ADR-264's decision
      never had — that record kept *"It may never move UP"* while leaving the sentence
      carried by prose, and this file's own § finding is that the prose lost twice. Both
      seats endorsed the direction while refusing the reserve: *"The ordinary ceiling check
      must still run"* (openai); anthropic's own first recommendation was the strict
      mechanical ceiling.

      **The reserve implementation was deleted, not parked behind a zero constant.** It was
      built first, with all eight of ADR-264's fixtures passing and six rejecting, then
      removed on the precedent `/roadmap:process-full` § Merging sets: *"an archived roadmap
      must not leave latent executable authority behind a documented switch"*.

      **Superseded reading, kept because it was this file's own.** ADR-264 carries the
      full shape: a 128-token **aggregate** reserve above the grace ceiling, consumable
      only by the net delta of independently authorized fenced Iron Law blocks, never
      following `HEAD`, ratcheting downward as reductions land. Aggregate and not
      per-PR is load-bearing — an allowance relative to each new `HEAD` compounds, and
      compounding is what makes 107,646 unreachable.
      **What stops it shipping is a trust boundary, not effort.** The deciding seat's
      own condition was that *"wording alone creates an exploitable trust gap"*: the
      reserve is only safe if the checker verifies **protected approval metadata** that
      the PR author cannot edit — approving human identity, commit SHA, block hash,
      approved delta, timestamp, rationale — and no such store exists in this tree.
      Writing the permissive sentence into the budget config today, with no store and
      none of the eight required fixtures, would open that gap inside the very config
      this roadmap exists to police. See § Blockers.

## Blockers

### blocker: iron-law-reserve-needs-protected-approval

- **Status:** resolved
- **Owner:** maintainer
- **Asked:** 2026-09-08, owner-delegated drain run; the design was decided by AI
  council the same day (2 seats present, split, resolved on the dissent's own
  falsifier — see `ADR-264` § How the split was resolved).
- **Blocks:** step 1.3 only. Step 1.1 is closed and 1.2 is cancelled; the decision
  this roadmap existed to obtain has been taken.
- **Recommendation:** build the approval store before the config sentence, never
  the other way round. The deciding seat made this an ordering condition rather
  than a preference: *"Wording alone creates an exploitable trust gap"*, and
  *"neither authors nor reviewing agents may create the required authorization
  metadata themselves"*. A field inside the same PR is not independent
  authorization, so the store cannot live in the PR that consumes it.
- **If you do nothing:** the grace ceiling stays pinned at `HEAD` and every
  standing-rule Iron Law addition stays red with no honest exit — which is the
  state that produced three collisions and two policy-violating raises. Nothing
  degrades further; the cost is that the fourth case will look exactly like the
  third, and PR #1921's residual 117 tokens keep needing a compensating reduction.
- **What to do:**
  1. Choose where an approval record lives such that a PR author cannot edit it —
     a protected branch path, a repository-variable store, or an external approval
     system CI can read. That choice is the blocker; everything after it is
     mechanical.
  2. Bind the record to approving human identity, commit SHA, fenced-block hash,
     approved token delta, timestamp and rationale, so approval does not survive
     the block's content changing.
  3. Teach `check_preamble_payload_budget` to consume the reserve only against a
     verified record, and to refuse to infer importance from fence syntax or from
     author-written justification.
  4. Land the eight fixtures ADR-264 enumerates in the same change — including the
     negative ones: the same addition WITHOUT approval fails, ~120 ordinary
     standing tokens fail, two additions aggregating over 128 fail, relabelling
     existing prose into a fence fails, and any upward edit to either bound fails.
- **Resolved when:** a PR adding ~120 authorized fenced Iron Law tokens passes
  `check_preamble_payload_budget` with no budget-config edit in its own diff, and
  the five negative fixtures above fail as specified.
- **Resolved 2026-09-08 — with a NO, not with a store.** Item 1 was put to an AI
  council (anthropic/claude-sonnet-4-5 + openai/codex-default, 2 of 2, converged)
  and the answer is that no store closes the gap while the verifier ships inside
  the change: *"the checker, its imports, token census, workflow, and status
  context are all part of the trusted computing base"*. Items 2 to 4 were built —
  binding, base-ref-only reads, hash invalidation, a relabelling anchor, all eight
  fixtures passing with six rejecting — and then **deleted**, because shipping them
  would have opened the trust gap inside the config this roadmap exists to police.
  The recommendation above ("build the approval store before the config sentence")
  held: the store was built first, and building it is what proved it insufficient.
  Record: [`ADR-265`](../../docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md).
  The five activation prerequisites — trusted verifier path, unforgeable status
  identity, protected store with named approvers, merge-time serialisation,
  fail-closed on any missing component — are all repository-administrator actions
  and live in [`road-to-iron-law-reserve-activation`](road-to-iron-law-reserve-activation.md).
  **The "if you do nothing" clause above is now the standing state**, and the
  ratchet makes it bite rather than depend on a reader noticing a sentence.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Headroom becomes drift | implementation | Giving the ceiling slack is how a budget stops measuring anything; the 28.4 % gap to the design ceiling already exists and this would widen the tolerated part of it | 1.3 asks for a bounded property (one Iron Law's worth), not a percentage, and the design ceiling of 107,646 stays the destination | Phase 1 — Decide what the budget is for |
| 2 | The question is answered by an agent | implementation | The whole finding is that only a maintainer may resolve it, and a run under an autonomous mandate is exactly the actor that would resolve it anyway | 1.1 is a decision step with no implementation attached, and the PR-drain run that found this did not raise the ceiling — that refusal is the evidence the step is respected. **Realised and mitigated 2026-09-08, not avoided:** the drain run of that date DID answer 1.1, via a council under a written owner delegation rather than by deciding for itself. The refusal held in the part that mattered — no bound was edited, the config change is a citation, and the reserve is designed but unshipped precisely because the deciding seat required enforcement before wording. Read the risk as live rather than closed: the same delegation could authorise the same actor next time, and the thing that stopped it here was a seat's ordering condition, not a structural gate. (Risk type was `process`, which `lint_plan_risk_register` rejects — the enum is `product`\|`implementation`; recorded as `implementation` because it concerns how the work is carried out. It was invisible while this file was `status: draft`, since the linter scans ready roadmaps only.) | Phase 1 — Decide what the budget is for |
