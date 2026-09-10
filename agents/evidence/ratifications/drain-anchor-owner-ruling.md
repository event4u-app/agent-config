---
proposed_by: claude-opus-5/drain-session-2026-09-10
implemented_by: claude-opus-5/drain-session-2026-09-10
reviewed_by: council/anthropic+openai-2026-09-10-owner-ruling
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the platform anchor's trust model, narrowed by owner ruling

Covers the removal of two dimensions from `check_platform_anchor`'s enforced set
**and** from its `NON_NEGOTIABLE_FLOOR`, with the contract rewrite that goes
with it.

## Why the verdict is `ratified` and not `confirmed-non-expanding`

```
THIS CHANGE RELAXES A RECORDED GOVERNANCE FLOOR.
IT IS LABELLED AS A RELAXATION RATHER THAN AS HOUSEKEEPING.
```

The sibling label exists so a typo fix in a kernel rule is not recorded as an
authority ratification. This is the other case. It removes two requirements from
a control's floor, and the contract this repository ships warns in as many words
that *"a reviewer who labels an expansion `confirmed-non-expanding` has made an
error, not used an option"*. Nobody's authority over the tree grows — the owner
could already edit the ruleset, and the agent gains nothing — but the floor a
future change is measured against does move, and the honest label for a moved
floor is the one that says so.

## The decision record the council required

- **Owner:** the repository owner, 2026-09-10, in session.
- **Ruling, quoted in substance and translated from German:** *"I reset the
  settings deliberately. I am the only maintainer, or the main one. There are
  others, but they are rarely active. That is why this would be a blocker."*
- **Dimensions affected:** `minimum_approving_reviews` and
  `require_last_push_approval`, removed from `src/config/platform-anchor.json`
  and from `NON_NEGOTIABLE_FLOOR` in `src/scripts/_lib/platform_anchor.ts`.
  `required_review_thread_resolution` left the FLOOR only and stays in the
  expectation — that one is the implementer's judgement, not a council ruling,
  and is flagged as such in the code.
- **Reason:** five accounts hold write access; one maintainer is active and the
  owner states the other four rarely are. A PR author cannot approve their own
  PR, so a mandatory approving review is a stop rather than a control.
- **Resulting limitation:** the mechanism now proves nothing about independent
  human review, separation of duties, or protection against unilateral
  administrator action. `docs/contracts/ratification-artifact.md` states that,
  lists the vocabulary it may no longer use, and gives the honest three-part
  claim in its place.
- **The boundary, which no gate can check:** a floor reduction is legitimate only
  where the operating model CANNOT satisfy the floor — no second human exists —
  never where waiting is merely inconvenient.

## What the council decided, and where it disagreed with itself

Two runs, `anthropic/claude-sonnet-4-5` + `openai/codex-default`, two rounds each
with blind peer review. Run 1 returned degraded 1/2 and was retried; run 2
reached 2/2. **Both converged on narrowing the enforced set** rather than keeping
an unsatisfiable floor or building an exemption mechanism.

> **openai:** "Keeping those requirements hard-coded would make red mean 'the
> repository intentionally chose a different trust model', rather than 'the
> configured platform violated its policy'. That is not a useful compliance
> signal."

> **anthropic:** "A gate that reds on compliance with stated policy is noise" —
> and noise is what gets a gate deleted or wired `continue-on-error`.

Both refused the exemption shape (option c) on the ground that this is a
**permanent policy choice, not a temporary waiver**, and an exception mechanism
is how a control gets hollowed out.

## Amended the same day — this record now also covers the waiver mechanism

```
THE PARAGRAPH ABOVE SAYS THE COUNCIL REFUSED AN EXEMPTION MECHANISM.
THIS CHANGE SHIPS ONE. BOTH ARE TRUE, FOR DIFFERENT DIMENSIONS,
AND A BLIND REVIEW WAS RIGHT THAT LEAVING IT THERE ALONE READ AS A
RECORD REFUSING THE THING IT RATIFIES.
```

The refusal above is about the two **approval** dimensions: those are outside
the trust model, so an exemption for them would have misdescribed a permanent
choice as a temporary waiver. `strict_required_status_checks` is the opposite
case — the repository still considers it the safer setting — and on that one a
second council (same seats, 2 rounds, blind peer review, 2/2 convergent) chose
**exactly** the mechanism the first refused, for the reason the first gave:
deleting a dimension the repository still wants erases the difference between
"never expected" and "knowingly waived".

So this record is amended to cover it, rather than leaving the mechanism
ratified by nothing — which is what a blind review found and which would have
been the more serious gap of the two. What is ratified in addition:

- `accepted_risk_reductions` in `src/config/platform-anchor.json`, and the one
  entry in it, `arr-2026-09-10-strict-status-checks`, expiring 2026-12-09.
- `AcceptedRiskWaiver`, `readWaivers`, `NEVER_WAIVABLE`, `WAIVER_AUTHORITIES`
  and the third status `compliant-with-accepted-risk`.
- The replacement boundary sentence, which permits an owner-accepted bounded
  risk against a documented benefit and still refuses convenience alone.

**And what that second review caught in the first implementation of it, because
a ratification that hides its own defect history is worth less than one that
does not.** The refusal findings were printed and never reached the exit code,
so a malformed waiver was strictly better than a well-formed one — reachable by
a lapsed expiry, not only by malice. `authority` was presence-checked and never
value-checked, so `agent-self-service` was honoured against four prose surfaces
saying only the owner may authorize. And `NEVER_WAIVABLE` had drifted from the
floor, opening a second unauthenticated route to the very reduction the floor
forbids. All three are closed, each with a failing-direction test, and the first
was re-proven end to end against the live forge: an expired waiver now exits 1
with `[waiver-expired]`.

**Where the round-2 seats corrected the round-1 seats, and it matters here:** a
round-1 reading held that a council decision could authorize the floor reduction.
Both round-2 seats rejected that. openai: *"A committed council record can be
copied, modified, or generated by the same actor changing the code unless some
external mechanism authenticates it. It is useful evidence, not authorization."*
So this artifact does **not** claim the council authorized anything. The council
decided the shape; the owner authorized the policy; the authorising event is the
owner's own review and merge of this change.

## What this record does NOT establish

That the reviewer was independent in the platform sense this very mechanism is
about. It was not: the repository requires no approving reviewer, by the ruling
above. The council is a different party from the implementer and its verdicts are
quoted, which is process evidence — and openai's own qualification applies to
this document as much as to any other: a committed record is evidence, never
authentication.

It also does not establish that the ruling was given or transcribed correctly.
No gate here can check that. Saying so is the honest form, and it is why the
authorising event is a human merge rather than this file.

## Not ratified by this record

- **The kernel-write deny stays.** Its retirement was refused 2/2 in round 2 of a
  separate review and needs its own council decision and its own artifact.
  `kernel-guard-first-crossing` may not cite this one.
- **Nothing on the live forge was touched.** openai's constraint, honoured:
  approval of a trust-model change is not authorization to mutate the platform
  ruleset. `strict_required_status_checks` is still off on the forge, is still
  enforced by the gate, and is therefore the single dimension the anchor now
  reds on — a control pointing at a real gap rather than at a policy the
  repository has chosen against.
