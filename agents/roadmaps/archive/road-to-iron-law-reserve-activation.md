---
complexity: lightweight
status: ready
parent_roadmap: road-to-a-standing-budget-with-headroom
execution:
  mode: phase-checkpoints
---
# Road to Iron Law reserve activation

> **Source:** the AI council of 2026-09-08 (anthropic/claude-sonnet-4-5 +
> openai/codex-default, 2 of 2 present, converged), recorded as
> [`ADR-265`](../../../docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md).
> This file is the receiver for step 1.3 of
> [`road-to-a-standing-budget-with-headroom`](road-to-a-standing-budget-with-headroom.md)
> (archived in the same change that closed it),
> which was deferred rather than closed.

> **`status: ready` since 2026-09-09, and closing in the same change.** It
> shipped `draft` on the reasoning that every step was a repository-administrator
> action an autonomous run could not perform, so flipping it to `ready` would put
> a permanently-blocked file on the dashboard. That reasoning was sound for the
> install branch and irrelevant to the other one: step 1.1 is a decision, the
> decision came back *against* the reserve, and the install branch it gated is
> therefore cancelled rather than blocked. A `draft` roadmap is excluded from
> `collect()` in `update_roadmap_progress.ts` and therefore from the archival
> sweep as well, so a finished draft archives never — the flip is what lets this
> file leave the active estate at all.

## Goal

The 128-token aggregate Iron Law reserve ADR-264 designed becomes safe to
activate, because the five controls ADR-265 named exist and are verifiable — or
the reserve is abandoned in favour of the strict-ceiling answer one council seat
argued for, and that abandonment is recorded rather than left implicit.

## Why it is not simply blocked on effort

The reserve was fully implemented once, on 2026-09-08, with all eight of
ADR-264's fixtures passing (six of them rejecting), and it was **deleted** rather
than shipped. The obstacle is not the mechanism; it is that the mechanism's
verifier lives inside the change it authorises:

> The checker, its imports, token census, workflow, and status context are all
> part of the trusted computing base. A PR author who can change any of them may
> bypass a perfectly protected approval record. — openai/codex-default

So no choice of *where the approval record lives* can close the gap, which is why
the parent roadmap's blocker (whose first item was exactly that choice) could not
be discharged by answering it.

## Phase 1 — Install the controls, or decide against the reserve

**Outcome 2026-09-09: the second branch.** An AI council convened under the
owner's written delegation for this drain run decided **against** the reserve,
2 of 2 seats present and converged, recorded as
[`ADR-269`](../../../docs/decisions/ADR-269-iron-law-reserve-abandoned-strict-ceiling-stands.md).
1.1 is therefore discharged and 1.2–1.6 are **cancelled**, not deferred: their
premise is the thing that was decided against, so there is no future run that
executes them and no receiver to carry them to. The phase heading already
carried this fork ("*or decide against the reserve*") and AC-1 already admitted
this branch, so nothing here is a re-scope.

- [x] **1.1 Decide whether the reserve should exist at all.** One seat argued it
      should not: *"Iron Laws with an authorized-growth reserve undermine what
      'Iron Law' means — if it needs budget flexibility, it's not iron"*, and
      named the evidence that would change its mind — a mandated addition that
      cannot fit and cannot displace anything, an explicitly temporary
      allowance, or proof that being more selective about Iron Law status is
      insufficient. The other seat did not argue this and treated the reserve as
      legitimate once the controls exist. The disagreement is unresolved and is
      owner-reserved: it lowers a recorded budget floor.
      verify: the answer is recorded in an ADR that cites ADR-265, and the
      surviving option names which of the three evidence conditions it rests on.
      **Done 2026-09-09.** `docs/decisions/ADR-269-iron-law-reserve-abandoned-strict-ceiling-stands.md`,
      `status: accepted`, `reopen_policy: owner`, evidence `E2`. It cites ADR-265
      in `evidence.basis`, in § Context and in § References, and it names
      condition **(c)** — no proof that being more selective about Iron Law
      status is insufficient — as what the abandonment rests on. Both seats
      reached (c) independently.
      **On the owner-reservation, which is not waved away.** The step called this
      owner-reserved because it "lowers a recorded budget floor". The verdict does
      the opposite: abandoning an unshipped reserve **preserves** the floor and
      declines the mechanism that would have relaxed it, which is the direction a
      delegated council may take. The owner-reserved half is stated explicitly in
      ADR-269 § The owner-reserved invariant and is untouched — *the
      standing-payload ceiling may not increase without the repository owner's
      explicit approval* — and the ladder's fourth rung escalates to the owner by
      construction. So the record does not decide the reserved question; it
      records that the reserved question is not reached.
      **Two rounds, and the first is disclosed rather than dropped.** The first
      run returned 1/2 present — the openai seat failed with `os_error: ENOBUFS`,
      a transport failure and not a refusal — and its surviving seat's peer
      "Reviewer A" resolved through `blind_review_map` to itself, so it was one
      reading and not convergence. It was re-run. The second run carries both
      seats and both verdicts.
      **The seats' one disagreement is recorded, not smoothed.** They split on
      the reopening test: anthropic wanted near-zero-cost controls to reopen the
      question, openai rejected that as availability-mistaken-for-need. The
      narrower reading is the operative `review_trigger`; the broader one is in
      ADR-269 § Recorded disagreement.

- [-] **1.2 Install a trusted verifier path.** The check must run from code the
      consuming revision cannot supply — a protected reusable workflow or an
      immutable action reference — with the pull-request tree passed in as data.
      verify: the workflow step that evaluates the reserve resolves to a ref
      outside the PR head, demonstrated by a PR that edits
      `src/scripts/check_preamble_payload_budget.ts` and does not change the
      status the trusted path publishes.
      **Cancelled 2026-09-09 by ADR-269.** This control exists only to make the
      reserve safe to activate, and the reserve is abandoned. Not deferred: a
      `[~]` needs a receiver carrying the criterion forward, and there is no
      criterion left to carry — the council's second execution item was
      explicitly *"remove all reserve-control installation work from the
      roadmap"*, because a half-installed state is the sunk-cost pressure Risk 1
      names. Installing it anyway would be the failure this roadmap's own risk
      register predicted.

- [-] **1.3 Make the status identity unforgeable by the PR.** Protect the
      workflow entry point as well as the check, so a pull request can neither
      remove the invocation nor publish a misleadingly equivalent status.
      verify: `gh api repos/:owner/:repo/rulesets` lists the check as required,
      and a PR deleting the workflow file fails rather than passing vacuously.
      **Cancelled 2026-09-09 by ADR-269** — same reason as 1.2. There is no
      reserve status to make unforgeable.

- [-] **1.4 Establish a protected approval store with named approvers.** An
      allowlisted team or immutable identity set, attested by the forge rather
      than by a username inside a JSON record, enforced so that no actor who can
      author or push the consuming change can land a record.
      verify: `gh api repos/:owner/:repo/rulesets` shows the store's path
      requiring review from that set, and the falsifiable claim ADR-265 asks for
      is stated in the ADR from 1.1.
      **Cancelled 2026-09-09 by ADR-269** — same reason as 1.2. There are no
      reserve approvals to store. The falsifiable claim this step's verify wanted
      stated is moot in the abandonment branch: no actor can create a valid
      approval because no approval mechanism exists, which is a stronger property
      than the one the control was going to establish.

- [-] **1.5 Add merge-time serialisation.** A merge queue or an atomic
      allocator, so two concurrent consumers cannot spend the same capacity.
      Base-ref reads give each pull request a consistent snapshot, not a serial
      allocation: two can each observe the same 128 tokens and both pass, and
      the staleness survives the first merge.
      verify: two pull requests each consuming the whole reserve are opened
      against the same base; at most one reaches a green required status after
      the other merges.
      **Cancelled 2026-09-09 by ADR-269** — same reason as 1.2. With no reserve
      there is no shared capacity two pull requests can double-spend; the
      shrink-only ratchet has no allocation to serialise.

- [-] **1.6 Rebuild the reserve against the installed controls, fail-closed.**
      Only after 1.2–1.5. The design is recorded in ADR-264 § The reserve and in
      ADR-265 § What the run had already built, including the bindings both
      seats settled: canonical block-content hash mandatory, structural-context
      and delta bound, and an exact head SHA required only where authorisation is
      issued against that head — never as a universal requirement for a
      pre-landed record, because a rebase changes the SHA without changing the
      approved substance.
      verify: ADR-264's eight fixtures pass, six rejecting, and additionally the
      1.5 concurrency fixture; an absent, malformed, stale, revoked or
      unreachable approval grants zero reserve while the plain ceiling still runs.
      **Cancelled 2026-09-09 by ADR-269.** The design stays recorded in ADR-264
      and ADR-265 for any future proposal to argue from — cancelling the step
      does not delete the design, and ADR-269 § Consequences requires a future
      proposal to clear both the three evidence conditions and ADR-265's security
      objections with new evidence on each.

**What replaces the reserve**, so this file does not close on a bare negative:
ADR-269 § What the repository does instead records a four-rung displacement
ladder — reclassify, shorten or consolidate, displace, and only then a
case-specific ceiling ADR that quantifies the minimum increase and requires the
repository owner's explicit approval. The fourth rung is the safety valve that
keeps a strict ceiling from becoming a Procrustean bed.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The controls get installed and the reserve is rebuilt without re-asking 1.1 | product | Five administrator actions are a sunk cost that argues for using them; the seat that said the reserve should not exist at all would then never be answered, and a 28.4 % over-budget estate would gain sanctioned growth | 1.1 is ordered first and its verify requires an ADR, so the question cannot be discharged by momentum; the parent's own Risk 2 records the same shape (the question answered by the actor who benefits) | Phase 1 — Install the controls, or decide against the reserve |
| 2 | Partial installation reads as progress | implementation | Any four of the five controls leaves the mechanism bypassable, and a roadmap at 80 % looks nearly done | 1.6 is gated on 1.2–1.5 completing and ADR-265 states fail-closed-on-any-missing-component as a decision, not a preference | Phase 1 — Install the controls, or decide against the reserve |

## Acceptance Criteria

- [x] AC-1 — Either the reserve is live and a pull request adding ~120
      authorized fenced Iron Law tokens passes `check_preamble_payload_budget`
      with no budget-config edit in its own diff and no writable link in the
      authorisation chain, or an ADR records that the reserve is abandoned and
      why. A third state — controls half-installed, reserve neither live nor
      abandoned — does not satisfy this.
      **Met 2026-09-09 on the second limb.**
      `docs/decisions/ADR-269-iron-law-reserve-abandoned-strict-ceiling-stands.md`
      records the abandonment and the why: evidence condition (c) unmet, the
      mechanism indivisible under ADR-265's fail-closed clause, an
      already-over-budget estate being the opposite precondition for a reserve,
      and the reserve needing forge-level trust anchors the ceiling needs none of.
      **The forbidden third state is affirmatively not reached, and that is
      checkable rather than asserted:** zero of the five controls exist —
      `gh api repos/:owner/:repo/rulesets` was never called to create one, no
      protected reusable workflow or immutable action ref was added, no approval
      store path exists, and no merge queue was configured. The abandonment is
      recorded, so the state is *abandoned*, not *half-installed*.

- [x] AC-2 — The shrink-only grace-ceiling ratchet shipped by the parent is
      still in force and still refuses an upward edit, whichever branch AC-1
      takes. `npx vitest run tests/scripts/standing_bound_ratchet.test.ts` is
      the check.
      **Met 2026-09-09. Verify output: `Test Files 1 passed (1) · Tests 7 passed
      (7)`**, including the three that matter for "still refuses": *REFUSES a
      grace_ceiling raised in the config against the base ref*, *REFUSES a bigger
      ceiling smuggled through `--ceiling` with no config edit*, and *REFUSES
      payload growth past an unchanged ceiling*. Also green: the lowered-bound
      case (shrink-only, not frozen) and the no-base-ref SKIPPED path.
      Nothing in this change touches `src/config/preamble-payload-budget.json`,
      `src/scripts/_lib/standing_bound_ratchet.ts` or the gate — so "still in
      force" is not merely tested but untouched, which is the stronger statement
      the criterion was reaching for.

## Closure

Closed 2026-09-09 at 8/8 — 3 done, 5 cancelled, 0 open, 0 deferred. The
cancellations are the recorded outcome of step 1.1 rather than a scope cut: the
phase this file is built around is a fork, and the decision took the second
branch. The `[-]` glyph is used in its pinned sense — *scope dropped, will not
happen at all* — and its owner-reservation is discharged by the owner's written
delegation of this drain run to the AI council, whose verdict is recorded in
ADR-269 with both seats' reasoning and their one disagreement.

Nothing is carried forward. There is deliberately no follow-up stub: a stub
naming the five controls would be the half-installed pressure Risk 1 warned
about, wearing a different filename. A future reserve proposal starts from
ADR-269 § Consequences, which sets the bar at both the three evidence conditions
and ADR-265's security objections, with new evidence on each.
