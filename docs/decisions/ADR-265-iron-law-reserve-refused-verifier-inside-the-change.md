---
adr: 265
status: accepted
date: 2026-09-08
decision: iron-law-reserve-not-activated-verifier-is-inside-the-change
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
    - src/config/preamble-payload-budget.json
    - src/scripts/check_preamble_payload_budget.ts
    - src/scripts/_lib/standing_bound_ratchet.ts
    - docs/decisions/ADR-264-standing-payload-grace-ceiling-may-not-rise.md
review_trigger: >-
  All five activation prerequisites in § What activation requires are installed
  by a repository administrator, at which point the reserve becomes decidable
  again and this record is reopened rather than assumed; or the milestone-1 date
  arrives and the design ceiling of 107,646 retires the grace ceiling, taking
  both this record and the reserve question with it; or a third raise of the
  grace ceiling occurs, which would mean the ratchet this record DOES ship was
  removed and the reasoning here is moot.
---

# ADR-265 — The Iron Law reserve is not activated: the verifier is inside the change it authorises

## Status

Accepted 2026-09-08. Decided by an AI council under a written owner delegation
covering an autonomous drain run. **2 of 2 seats present, and they converged** —
which is worth naming, because ADR-264 was a split resolved on a falsifier and
this is not.

## Context

ADR-264 designed a 128-token aggregate reserve above the standing-payload grace
ceiling, consumable only by the net delta of *independently authorized* fenced
Iron Law blocks, and deliberately did not ship it. Its stated blocker was that
the approval metadata must live somewhere a pull-request author cannot write:
*"a field inside the same PR is not independent authorization."*

`road-to-a-standing-budget-with-headroom` step 1.3 carried that forward as a
blocker whose first item was the real decision — *where does an approval record
live such that a PR author cannot edit it* — with the other three items declared
mechanical.

**The council rejected the framing, not just the candidates.** Its finding is
that record placement is the wrong axis, and that the same tree offered three
candidate stores was already sufficient to see why.

## Decision

**Option 6. No reserve is consumable under this repository's current controls.**
The reserve stays designed and unshipped; step 1.3 ships the enforcement of
ADR-264's actual decision instead, and the reserve question moves to a named
successor with its prerequisites written down.

Both seats, in their own words:

> reject the reserve mechanism entirely … If required, ship advisory-only with
> honest disclosure that the trust root is code review, not cryptographic proof.
> — anthropic/claude-sonnet-4-5

> reject activation and ship Option 6 for now. The design has not established
> that either the approval authority or the verifier is outside the PR author's
> control. — openai/codex-default

## Why — the finding that killed every store

**The verifier is part of the change under review.** Protecting the approval
record protects one link of a chain whose other links the author holds:

> The checker, its imports, token census, workflow, and status context are all
> part of the trusted computing base. A PR author who can change any of them may
> bypass a perfectly protected approval record. — openai

So the axis the blocker named ("a protected branch path, a repository-variable
store, or an external approval system") could not have produced an answer: every
candidate on it protects the record and none protects the reader. **The blocker's
own claim that "everything after it is mechanical" is refuted** — reserve
ownership, canonicalisation, approval lifecycle, concurrency and merge-time
accounting all remained architectural.

Four further findings, each independently sufficient to withhold activation:

1. **The proposed trust root is false under the live configuration.** The single
   branch ruleset (`gh api repos/:owner/:repo/rulesets`, read 2026-09-08) covers
   `~DEFAULT_BRANCH` and carries `required_approving_review_count: 0`,
   `require_code_owner_review: false`. A two-PR sequence therefore *"separates
   time, not authority"* (openai). The base-ref read stops the consuming change
   from writing its own approval and buys nothing beyond that.
2. **Concurrent consumption is unresolved.** Two pull requests each read the same
   base ref, each see the same remaining capacity, and both pass. Worse, the
   staleness survives merge: PR #2 merges and consumes the record, PR #3 has
   already passed its required checks against the pre-consumption base. An
   enforced reserve needs merge-time accounting against the updated trunk, not
   check-time accounting against a base.
3. **Authorization and allocation are different records.** *"An approval answers:
   may this exact change consume at most N tokens? A ledger entry answers: this
   capacity was actually committed and is no longer available"* (openai). The
   design had one record doing both jobs.
4. **`ci_delivery.honest_limit` is the wrong precedent for an enforced
   mechanism.** It records that a failing check is not a blocked merge — an
   *advisory* posture. Citing it to authorise a mechanism claiming *independent
   authorization* is incoherent: anthropic — *"Using the precedent to justify
   Option 1 while claiming Option 1 is enforced contradicts the precedent."*

## What the run had already built, and why it was deleted rather than parked

The drain run implemented the reserve before the council answered: an approval
store at `agents/approvals/iron-law-reserve.jsonl` read only via
`git show <baseRef>:`, per-record binding of approving identity, commit SHA,
block hash, approved delta, timestamp and rationale, a hash-invalidation rule so
an approval does not survive its block's content changing, a
`new_since_commit` anchor refusing prose relabelled into a fence, and the eight
fixtures ADR-264 enumerated — all eight passing, six of them rejecting.

**It was removed, not left inert behind a zero constant.** The precedent is this
repository's own: `/roadmap:process-full` § Merging removed a `--merge` flag
rather than shipping it disabled, on the ground that *"an archived roadmap must
not leave latent executable authority behind a documented switch"*. A reserve
mechanism whose only barrier is a constant is the same shape. The design is
recorded here and in ADR-264; recovering it is a rebuild against a decided
architecture, which is cheaper than an audit of dormant authority.

**Advisory-only was considered and refused, and the refusal is the sharper
half.** anthropic offered it as a fallback; openai rejected it as an answer to
this step: *"an advisory message followed by a successful status is not a gate
and does not resolve the blocker"*, and *"calling the record 'documentation' does
not make author-created metadata independently authorized."* An advisory reserve
would have let step 1.3 read as closed while nothing changed.

## What ships instead

`src/scripts/_lib/standing_bound_ratchet.ts`: the grace ceiling is compared
against the value at the base ref and a rise refuses the run — whether it arrives
by editing `src/config/preamble-payload-budget.json` or by passing a larger
`--ceiling` to the gate.

This is not a substitute for the reserve and does not give the ceiling headroom.
It is the enforcement ADR-264's decision never had: that record resolved the
file's self-contradiction in favour of *"It may never move UP"* while leaving the
sentence carried by prose alone, and the file's own `grace_ceiling_history` is the
evidence that prose was not enough — 138,212 → 138,273 on 2026-09-02 and
138,273 → 138,490 on 2026-09-08, each with a justification and no objection from
any gate.

**Both seats endorsed the direction even while refusing the reserve**: *"The
ordinary ceiling check must still run"* (openai), and anthropic's own first
recommendation was *"strict mechanical ceiling … when a fenced Iron Law addition
exceeds it: condense existing standing rules first."*

**Its posture is deliberately the opposite of the reserve's.** The reserve had to
fail closed — an unreadable store would otherwise have *granted* budget on an
infrastructure failure. The ratchet reports SKIPPED and does not refuse when no
base ref resolves, because there an unreadable base would *refuse a change* on an
infrastructure failure, and a gate that reds on every shallow clone is a gate
someone switches off.

**The verifier-inside-the-change critique applies to it too, and is not fatal.**
It is fatal to a mechanism that GRANTS and survivable in one that only REFUSES:
disabling the ratchet requires visibly deleting it in the diff, which is the same
review every other gate in this tree already rests on. What it replaces had no
failure mode because it did nothing.

## What activation requires — the prerequisites, from the seats

All five, from openai's § Activation prerequisites and anthropic's Option C.
Each is a repository-administrator action and none is available to an autonomous
run:

1. **A trusted verifier path** — the check runs from code the consuming revision
   cannot supply (a protected reusable workflow or an immutable action
   reference), with the PR tree passed in as data.
2. **A required status whose identity the PR cannot influence** — protecting the
   workflow entry point as well as the check, so a PR can neither remove the
   invocation nor publish a misleadingly equivalent status.
3. **A protected approval store with named approvers** — an allowlisted team or
   immutable identity set, attested by the forge rather than by a username inside
   the JSON, and enforced such that no actor who can author or push the consuming
   change can land a record.
4. **Merge-time serialisation** — a merge queue or an atomic allocator, so two
   concurrent consumers cannot spend the same capacity.
5. **Fail-closed on any missing component**, with the plain ceiling still
   enforced.

Carried in `agents/roadmaps/road-to-iron-law-reserve-activation.md`
(`status: draft`, so it costs no active slot until a maintainer takes it up).

## Consequences

- Step 1.3 of `road-to-a-standing-budget-with-headroom` is **deferred, not
  closed**: its verify — *"a fixture PR adding ~120 standing tokens passes
  `check_preamble_payload_budget` without any config edit in its own diff"* —
  cannot be satisfied honestly, because satisfying it means activating the
  mechanism this record refuses. It carries `[~]` with a `carried-to=` receiver.
- The roadmap's Goal reads *"either … or, if that is the intended cost, the file
  says so in those words"*. ADR-264 took the second branch and this record
  finishes it: the cost is now enforced rather than merely stated.
- **The state that produced three collisions and two policy-violating raises
  persists.** A fourth standing-rule Iron Law addition still has no exit but a
  compensating reduction, and PR #1921's residual 117 tokens still need one. The
  ratchet makes that constraint bite instead of relying on a reader noticing a
  sentence; it does not remove it, and no reading of this record should suggest
  it does.
- **Nothing in this change raises or lowers any bound.** `grace_ceiling` stays
  138,490 and `design_ceiling` stays 107,646.

## Alternatives considered

- **Option 1 — an in-tree record honoured only from the base ref.** Refused: the
  trust root is false under the live ruleset and the verifier is unprotected. Not
  refused *in principle* — openai: an in-tree append-only ledger *"can become a
  legitimate authorization store"* once the five prerequisites hold.
- **Option 2 — a repository variable.** Refused as a store an autonomous run
  cannot write and no local run can exercise, so the acceptance condition could
  not be demonstrated at all.
- **Option 3 — a signed record.** Refused as ceremony against the wrong threat:
  *"Signatures don't help if the verifier checking them is PR-controlled"*
  (anthropic). No approver key exists.
- **Option 4 — a GitHub review as the approval.** The only candidate with an
  existing identity-level separation, since a forge forbids self-approval — but
  it still establishes neither that the reviewer is in an authorised set nor that
  the verifier is trustworthy. Kept as the live candidate for activation.
- **Option 5 — composite.** Refused as complexity ahead of a named threat.
- **Advisory-only.** Refused; see § What ships instead.

## Evidence

Verifiable in the tree at `3be6fd63c`, except the two live-state readings, which
name the command and the date they were read.

| Claim | Where |
|---|---|
| The council reached 2 of 2 and converged on Option 6 | `agents/evidence/analysis/council-2026-09-08-iron-law-reserve-store.md` — both seat verdicts verbatim, `quorum` 2 of 2 `concluded`, no seat error, `absent_members` empty |
| The single branch ruleset covers only the default branch and requires zero approving reviews | `gh api repos/:owner/:repo/rulesets` and `.../rulesets/17749383`, read 2026-09-08 — one ruleset, `ref_name.include: ["~DEFAULT_BRANCH"]`, `required_approving_review_count: 0`, `require_code_owner_review: false` |
| CODEOWNERS exists and gates nothing today | `.github/CODEOWNERS` (1,935 bytes) against `require_code_owner_review: false` in the ruleset above; the file's own header already names branch-protection enablement as the missing repo-admin half |
| The ceiling sentence and the two raises that broke it | `src/config/preamble-payload-budget.json:86` and `.ci_delivery.grace_ceiling_history` — 138,212 → 138,273 (2026-09-02), 138,273 → 138,490 (2026-09-08) |
| No bound moves in this change | `:81` `grace_ceiling: 138490` and `:80` `design_ceiling: 107646`, both untouched; `git diff origin/main -- src/config/preamble-payload-budget.json` is empty |
| The ratchet refuses a raise, and the tests would not notice if it stopped | `tests/scripts/standing_bound_ratchet.test.ts` — 7 cases, 3 refusing. Sensitivity measured, not assumed: replacing `if (opts.headGraceCeiling > baseGrace)` with `if (false)` turns exactly the two bound-refusal cases red, and restoring it returns 7 of 7 |
| The advisory precedent this record declines to stretch | `src/config/preamble-payload-budget.json` → `ci_delivery.honest_limit` |
| Iron Law status is only syntactically checkable | `src/scripts/check_condensation.ts:196` — `IRON_LAW_HEADING`, as ADR-264 § How the split was resolved already established |

**What no evidence here covers.** That the reserve implementation was correct — it
passed its own eight fixtures and was deleted, so nothing in the tree can be
re-run to confirm it; the fixtures are recoverable only from this record and
ADR-264. And whether the five prerequisites are sufficient: they are two seats'
list, and installing them is where that gets tested.

## What this record does not establish

That the reserve is a bad idea in principle — anthropic argued exactly that
(*"if it needs budget flexibility, it's not iron"*) and openai did not, so the
question is undecided rather than settled, and its § What would change my mind is
recorded in the successor roadmap rather than resolved here. That the five
prerequisites are sufficient — they are the two seats' list, not a verified
design, and installing them is where that gets tested. And that the ratchet makes
the ceiling correct: 138,490 is 28.4 % above the design ceiling and this change
does not move it one token closer.
