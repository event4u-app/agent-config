---
adr: 269
status: accepted
date: 2026-09-09
decision: iron-law-reserve-abandoned-strict-ceiling-stands
supersedes: —
superseded_by: —
type: structural
reopen_policy: owner
protected_dimensions: governance
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E2
  basis:
    - docs/decisions/ADR-264-standing-payload-grace-ceiling-may-not-rise.md
    - docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md
    - src/config/preamble-payload-budget.json
    - src/scripts/_lib/standing_bound_ratchet.ts
    - tests/scripts/standing_bound_ratchet.test.ts
review_trigger: >-
  A concrete mandated Iron Law addition is blocked, AND a documented inventory
  proves that no existing standing prose can be shortened, consolidated,
  reclassified or displaced without violating an equal-or-higher-priority
  obligation. Technical availability of the five controls alone does not reopen
  it — that was the one point the two seats disagreed on and § Recorded
  disagreement states both readings.
---

# ADR-269 — The Iron Law reserve is abandoned; the strict ceiling stands

## Status

Accepted 2026-09-09. Decided by an AI council convened under a written owner
delegation covering an autonomous roadmap-drain run. **2 of 2 seats present
(anthropic/claude-sonnet-4-5, openai/codex-default), and they converged on the
same option** — worth naming, because the decision this record closes was left
unresolved by a 2026-09-08 split.

Subscription transport, `$0.0000` billed. Two rounds with peer review; the
first attempt returned 1/2 (the openai seat failed on transport with
`os_error: ENOBUFS`, not on refusal) and was re-run rather than reported as
convergence.

## Context

`ADR-264` designed a **128-token aggregate reserve**: a pool of standing-payload
budget an authorized pull request could consume to add mandated Iron Law prose,
on top of a shrink-only grace-ceiling ratchet.

`ADR-265` recorded that the reserve was **fully implemented once**, on
2026-09-08, with all eight of ADR-264's fixtures passing and six of them
rejecting — and then **deleted rather than shipped**, because the verifier lives
inside the change it authorises:

> "The checker, its imports, token census, workflow, and status context are all
> part of the trusted computing base. A PR author who can change any of them may
> bypass a perfectly protected approval record." — openai/codex-default,
> 2026-09-08

ADR-265 named five controls that would have to exist before activation — a
trusted verifier path, an unforgeable status identity, a protected approval
store with forge-attested approvers, merge-time serialisation, and only then a
fail-closed rebuild — and left the prior question open: **should the reserve
exist at all?** One seat of that council argued it should not; the other treated
it as legitimate once the controls exist. Nothing resolved it.

`agents/roadmaps/archive/road-to-iron-law-reserve-activation.md` was the receiver for
that open question. Its step 1.1 asked for exactly this record; its Risk 1 named
the failure this record forecloses — *"the controls get installed and the
reserve is rebuilt without re-asking 1.1; five administrator actions are a sunk
cost that argues for using them."*

## Decision

**The 128-token aggregate Iron Law reserve is abandoned.** The strict ceiling
with its shrink-only ratchet is the answer. The five controls are **not**
installed, and the installation work is removed from the active estate rather
than parked — the half-installed state is itself the risk.

The abandonment rests on **evidence condition (c)** of the three ADR-265 named:
*there is no proof that being more selective about Iron Law status is
insufficient.* Both seats reached (c) independently. Condition (a) — a mandated
addition that cannot fit and cannot displace anything — **has not occurred**, and
is the reopening trigger rather than a basis for building now. Condition (b), an
explicitly temporary allowance, was never proposed; both seats of the 2026-09-08
council had already refused one.

Three facts carried the verdict, and they are recorded because a later reader
will want the reasoning rather than the vote:

1. **The mechanism is indivisible.** ADR-265's fail-closed-on-any-missing-
   component clause means three of five controls does not buy 60 % of the
   protection — it buys a bypassable mechanism. The cost is all-or-nothing.
2. **A 28.4 %-over-budget estate is the opposite precondition for a reserve.**
   A reserve is for an estate under budget and near its limit. Granting
   authorized growth capacity to an estate already violating the constraint
   inverts the mechanism's purpose.
3. **The reserve needs forge-level trust anchors; the ceiling needs none.** The
   ratchet runs in CI and fails the build. No protected workflow, no immutable
   action ref, no administrator action, no coupling of repository governance to
   forge-specific features.

### What the repository does instead — the displacement ladder

When a mandated Iron Law addition does not fit, execute in order:

1. **Reclassify** — move current Iron Law content to a lower tier. Not
   everything marked Iron Law is genuinely non-negotiable.
2. **Shorten or consolidate** existing Iron Laws without reclassifying: merge
   related rules, tighten wording, move examples into guidelines.
3. **Displace** a lower-priority Iron Law entirely, recording which and why.
4. **Only if all three fail — a case-specific ceiling ADR**, which identifies
   the mandate, inventories the attempted displacement, quantifies the *minimum
   necessary* increase, is temporary with an expiry or reduction trigger where
   feasible, and **requires the repository owner's explicit approval.** It is a
   one-time lift for that addition, never the re-creation of a reusable pool.

Rung 4 is the safety valve that keeps the strict ceiling from becoming a
Procrustean bed: it preserves the forcing function while leaving a route for a
genuinely irreducible mandate.

### The owner-reserved invariant, stated so the boundary is unambiguous

> **The standing-payload ceiling may not increase without the repository
> owner's explicit approval.**

A delegated council may abandon an unshipped reserve, because doing so
**preserves** that invariant. It may not itself approve a ceiling increase, and
this record does not. Rung 4 above therefore escalates by construction.

### Why the arbitrary size is its own argument

The **128** figure has no demonstrated relationship to a likely mandate's size
or urgency. Even with perfect controls an arbitrary aggregate pool can be too
small for one real mandate while encouraging several marginal additions. A
case-specific exception allocates the demonstrated minimum and keeps
accountability at the addition.

## What this does not reopen

- **ADR-264's shrink-only grace-ceiling ratchet stands, unchanged and in
  force.** Only the reserve half of that record's design is abandoned; the
  ratchet is the half that shipped, and `tests/scripts/standing_bound_ratchet.test.ts`
  is the check that it still refuses an upward edit. Nothing here is a
  supersession: ADR-264's live mechanism is untouched, and no `supersedes_scope`
  is claimed.
- **ADR-265's finding is not disputed but relied on.** That record refused
  *activation* on a trust-boundary argument; this one answers the prior question
  it left open. The five controls remain correctly described there for any future
  proposal to argue against.
- **No ceiling, stub ceiling or `rule-inject` row moves here**, and no rule prose
  is cut. Both are foreclosed by the receiving roadmap's kill register and
  neither is needed for this decision.

## Recorded disagreement — the one point the seats did not share

The seats converged on the verdict and split on the **reopening test**.

- anthropic/claude-sonnet-4-5 proposed a second reopening trigger: the five
  controls becoming available at near-zero incremental cost, for example as
  native forge features that eliminate the trusted-computing-base expansion.
- openai/codex-default rejected exactly that: *"Near-zero-cost controls would
  remove implementation cost but would not establish a need for a reserve.
  Technical availability alone should not reopen the substantive decision."*

**The narrower reading is operative**, and it is in `review_trigger` above:
availability is not need, and a trigger that fires on a forge feature release
would reopen a settled question with no new evidence about the problem. The
broader reading is recorded rather than dropped, because a future reader
weighing rung 4 should know a seat argued for it.

The same seats also disagreed on whether direction alone decides council
authority. openai's formulation is the one recorded above — abandonment is
council-decidable because it preserves an already-shipped invariant and declines
an unshipped mechanism, not because tightening is inherently council-owned.

One refinement both seats effectively accepted: condition (a) as originally
worded — *"cannot displace anything"* — requires proving a negative over the
whole estate and is close to unfalsifiable. The `review_trigger` therefore scopes
it to a **documented inventory**, which is a bar a real case can clear.

## Consequences

- `agents/roadmaps/archive/road-to-iron-law-reserve-activation.md` closes. Step 1.1 is
  discharged by this record; steps 1.2–1.6 are cancelled, because their premise
  — that the reserve should exist — is the thing decided against. Its AC-1
  admits exactly this branch: *"or an ADR records that the reserve is abandoned
  and why."*
- No repository-administrator action is required by this decision, now or later.
  That is the point: the alternative required five.
- The standing payload stays governed by one number and one direction. A future
  mandated addition meets the ladder above, not a pool.
- A future reserve proposal must clear both bars, not one: the three evidence
  conditions **and** ADR-265's security objections, with new evidence on each.
  Installed controls alone do not carry it — that is the sunk-cost checkpoint
  this record exists to place.

## Evidence

**E2 — two independent model seats over a written option set, with the
mechanism's own prior implementation and its measurements as the substrate.**
Not E3: no new measurement was taken for this decision, and none was needed —
the load-bearing figures were already measured and recorded by the two ADRs this
record rests on.

| Claim | Basis |
|---|---|
| The reserve was built and deleted, eight fixtures passing, six rejecting | `docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md` |
| The verifier sits inside the change it authorises; five controls would be needed | same record, § What activation requires |
| The reserve was designed at 128 tokens aggregate, on top of a shrink-only ratchet | `docs/decisions/ADR-264-standing-payload-grace-ceiling-may-not-rise.md` |
| The ratchet shipped and refuses an upward edit | `tests/scripts/standing_bound_ratchet.test.ts`, `src/scripts/_lib/standing_bound_ratchet.ts` |
| The governed estate is over budget — `baseline_tokens` 102,520 against a measured total in the 138,200–138,490 band | `src/config/preamble-payload-budget.json` |
| Both seats converged on Option A, resting on condition (c) | the 2026-09-09 council, 2/2 present, recorded in § Status and quoted in § Recorded disagreement |

**What the evidence does not establish**, stated rather than implied: that
displacement will in fact always succeed. Nobody has run the exhaustive audit,
which is precisely why the verdict rests on (c) — the absence of proof that
selectivity is insufficient — and not on a claim that selectivity is always
sufficient. Rung 4 exists for the case where it is not.

## References

- `docs/decisions/ADR-264-standing-payload-grace-ceiling-may-not-rise.md`
- `docs/decisions/ADR-265-iron-law-reserve-refused-verifier-inside-the-change.md`
- `agents/roadmaps/archive/road-to-iron-law-reserve-activation.md`
- `src/config/preamble-payload-budget.json`
- `tests/scripts/standing_bound_ratchet.test.ts`
