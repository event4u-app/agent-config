---
complexity: lightweight
status: draft
parent_roadmap: road-to-a-standing-budget-with-headroom
execution:
  mode: phase-checkpoints
---
# Road to Iron Law reserve activation

> **Source:** the AI council of 2026-09-08 (anthropic/claude-sonnet-4-5 +
> openai/codex-default, 2 of 2 present, converged), recorded as
> [`ADR-265`](../../docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md).
> This file is the receiver for step 1.3 of
> [`road-to-a-standing-budget-with-headroom`](road-to-a-standing-budget-with-headroom.md),
> which was deferred rather than closed.

> **`status: draft` deliberately.** It costs no active roadmap slot until a
> maintainer decides to install the prerequisites below, and every step in it is
> a repository-administrator action an autonomous run cannot perform. Flipping it
> to `ready` before that decision would put a permanently-blocked file on the
> dashboard.

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

- [ ] **1.1 Decide whether the reserve should exist at all.** One seat argued it
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

- [ ] **1.2 Install a trusted verifier path.** The check must run from code the
      consuming revision cannot supply — a protected reusable workflow or an
      immutable action reference — with the pull-request tree passed in as data.
      verify: the workflow step that evaluates the reserve resolves to a ref
      outside the PR head, demonstrated by a PR that edits
      `src/scripts/check_preamble_payload_budget.ts` and does not change the
      status the trusted path publishes.

- [ ] **1.3 Make the status identity unforgeable by the PR.** Protect the
      workflow entry point as well as the check, so a pull request can neither
      remove the invocation nor publish a misleadingly equivalent status.
      verify: `gh api repos/:owner/:repo/rulesets` lists the check as required,
      and a PR deleting the workflow file fails rather than passing vacuously.

- [ ] **1.4 Establish a protected approval store with named approvers.** An
      allowlisted team or immutable identity set, attested by the forge rather
      than by a username inside a JSON record, enforced so that no actor who can
      author or push the consuming change can land a record.
      verify: `gh api repos/:owner/:repo/rulesets` shows the store's path
      requiring review from that set, and the falsifiable claim ADR-265 asks for
      is stated in the ADR from 1.1 — *no actor able to author or push the
      consuming change can create a valid approval, alter the trusted verifier,
      or produce the required success status without approval from that set*.

- [ ] **1.5 Add merge-time serialisation.** A merge queue or an atomic
      allocator, so two concurrent consumers cannot spend the same capacity.
      Base-ref reads give each pull request a consistent snapshot, not a serial
      allocation: two can each observe the same 128 tokens and both pass, and
      the staleness survives the first merge.
      verify: two pull requests each consuming the whole reserve are opened
      against the same base; at most one reaches a green required status after
      the other merges.

- [ ] **1.6 Rebuild the reserve against the installed controls, fail-closed.**
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

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The controls get installed and the reserve is rebuilt without re-asking 1.1 | product | Five administrator actions are a sunk cost that argues for using them; the seat that said the reserve should not exist at all would then never be answered, and a 28.4 % over-budget estate would gain sanctioned growth | 1.1 is ordered first and its verify requires an ADR, so the question cannot be discharged by momentum; the parent's own Risk 2 records the same shape (the question answered by the actor who benefits) | Phase 1 — Install the controls, or decide against the reserve |
| 2 | Partial installation reads as progress | implementation | Any four of the five controls leaves the mechanism bypassable, and a roadmap at 80 % looks nearly done | 1.6 is gated on 1.2–1.5 completing and ADR-265 states fail-closed-on-any-missing-component as a decision, not a preference | Phase 1 — Install the controls, or decide against the reserve |

## Acceptance Criteria

- [ ] AC-1 — Either the reserve is live and a pull request adding ~120
      authorized fenced Iron Law tokens passes `check_preamble_payload_budget`
      with no budget-config edit in its own diff and no writable link in the
      authorisation chain, or an ADR records that the reserve is abandoned and
      why. A third state — controls half-installed, reserve neither live nor
      abandoned — does not satisfy this.
- [ ] AC-2 — The shrink-only grace-ceiling ratchet shipped by the parent is
      still in force and still refuses an upward edit, whichever branch AC-1
      takes. `npx vitest run tests/scripts/standing_bound_ratchet.test.ts` is
      the check.
