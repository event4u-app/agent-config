<!-- evidence-type: analysis -->

# ADR-281 against the authority-routing decision — they cannot both stand

**Date:** 2026-10-07 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, 2 rounds, blind chairman · **Cost:** $0.00 · **Quorum:** 2/2 concluded

| Seat | Stance |
|---|---|
| `openai/codex-default` | `refused · high · DEALBREAKER: yes` |
| `anthropic/claude-sonnet-4-5` | `ratified · high · DEALBREAKER: yes` |

**Verdict: `refused`.** Any concluding refusal gives `refused`. The two records
cannot stand together as written; one must be amended before it operates.

Both seats carry a dealbreaker and both reach the same disposition. They differ
on severity, and openai names the difference: anthropic's `ratified` *"understates
the problem — the rubric says `refused` when one record must not stand as written,
and B cannot stand as operative authority without material amendment."*

An earlier attempt reached only one seat (`ENOBUFS`, a transport failure, no
evaluation). The probe entry was dropped so the seat re-qualified live and the
run was repeated with the identical prompt. That is the first evaluation
completed, not a second one on the same work.

## What was compared

**Record A** — `agents/evidence/council/authority-routing-20261007.md`, merged
as `0009ecd7c`. A ratified council decision taken under the owner's stated
frame.

**Record B** — `docs/decisions/ADR-281-council-confirmed-self-modification.md`,
open in PR #2251, declaring `supersedes: ADR-268, ADR-118` and already marked
`status: accepted`.

They were written the same day by two sessions that did not read each other.

## 1. The conflict, quoted

Record A: *"A passing verdict — `ratified` AND `confirmed-non-expanding` —
requires human authority."*

Record B `supersedes_scope`: *"for a proposal scoped to the package, the
approval is the council's record and the user is its last rung."* And § 2:
*"the lowest rung that can pass is the AI council."*

> Under A, council agreement cannot supply the authorization represented by a
> passing verdict. Under B, it ordinarily does. These cannot both govern the
> same ordinary package self-modification.

**The conflict is about authorization to pass the gate, not about landing.**
Record B § 6 says of the council: *"It does not publish or land it."* That line
does not dissolve the conflict — it addresses a different question.

**What is NOT a conflict:** B's reviewer reservation. It could consistently add
a seventh owner-reserved category to A's six danger predicates. The problem is
that B *simultaneously* replaces A's general human-authorization rule.

## 2. The amendment that would reconcile them

> Every gated or learning-originated package self-modification requires a
> digest-bound council review; a council refusal fails closed, while any
> favourable council verdict is **advisory until authenticated owner
> authorization is bound to the same digest**. Changes to the reviewer or its
> trust chain are always owner-reserved. Neither an agent nor a council may
> waive that reservation.

This keeps B's mandatory-review floor and its reviewer reservation, and keeps
A's distinction between **review** and **authorization**. It requires amending
two of B's statements: *"the approval is the council's record"* and that the
council is the lowest rung that *"can pass"*. **"Can recommend passage" would be
accurate.**

## 3. Record A governs until that amendment lands — on Record B's own ground

Record B's Status section says: *"The authorising event is the owner's review
and merge of the change that carries it."*

**That event has not occurred.** B is in an open pull request. Its
`status: accepted`, `provenance.kind: human` and `human_directed: true` fields
are assertions inside repository content; they cannot substitute for the merge
event B itself declares constitutive. Marking itself accepted is circular.

`supersedes: ADR-268, ADR-118` also does not reach Record A: A is a later,
separate authority record that merely *reasons from* ADR-268. B was written
without it and never resolves the collision.

## 4. The already-ratified branch

The branch changing `modification_review_verdict.ts` and
`check_kernel_edit_ratified.ts` was council-ratified on its sixth attempt.

> Its sixth-round verdict **remains valid evidence of the review actually
> performed. It should not be rewritten or retrospectively declared invalid.**
> But it is not sufficient authority to pass the branch.

Three independent grounds: Record A already requires human authority for a
passing verdict; Record B, read as proposed policy, classifies these exact
reviewer modules as owner-reserved; and *"the four earlier defects demonstrate
the value of repeated review, not the acquisition of authorization power."*

The branch needs authenticated owner authorization bound to its present digest.
If its content changes, the technical review repeats for the new digest.

**The general temporal rule, which this case is only an instance of:**

> Evaluate whether a review was valid under the review policy effective when it
> occurred; evaluate permission for an unperformed privileged action under the
> authority policy effective when that action is attempted.

A completed action or an explicitly durable grant may justify grandfathering.
An unexercised favourable review does not freeze the authority bar.

## 5. Record B has no valid exemption for itself

B changes the authority ladder, the owner-reserved set and the bypass
mechanism. That is governance self-modification, so **its new policy cannot be
the sole source of authority for its own adoption** — the pre-existing rule
governs the transition, which here is Record A's human-authorization
requirement.

B may additionally need council review of its own if the ADR path falls inside
what `check_kernel_edit_ratified` watches; its own commissioned-work exception
still requires *"a council record where it touches the gated surface."* The text
neither establishes that nor claims an adoption-time exemption. If B intends to
grandfather its own enactment it must say so and name the prior authority that
permits it.

## 6. What the comparison exposes in each — neither author could have seen this alone

**In Record A:** it requires human authority but supplies no implemented,
independently authenticated, digest-bound attestation channel — a control named
but not completed. Its location as a council evidence record also leaves its
normative rank unclear.

**In Record B**, and openai calls these the more consequential set:

- It conflates independent **review** with independent **authorization**.
- Its `accepted` status precedes its own stated authorizing event.
- It does not account for Record A, so its supersession scope is incomplete.
- Its owner bypass admits *"nothing in the tree distinguishes the owner's act from any other administrator's."*
- *"Restored afterwards"* has no atomic restoration mechanism, deadline, monitor or failure response.
- No kill switch for a bypass left enabled, for lost provider independence, for subject/digest disagreement, or for an unexpected reviewer-surface change.
- **Its sequencing is inverted:** § 5 relies on an attributable owner bypass before the design has a trustworthy attribution mechanism.
- **A circular trust boundary:** the reviewer reservation depends on correctly identifying the reviewer surface, and the reviewer itself computes the subject and enforces the classification.
- A reviewer-code change can alter what an existing digest *means*; digest binding is insufficient unless the reviewer version and policy version are bound into the attestation too.
- § 1's *"never by a refusal to make it"* should narrow to *"legitimate to propose"*, or it conflicts with § 3's fail-closed `refused`.

## The standing objection both seats share

Provider diversity is not authorization independence.

> B adds diverse reviewers but leaves the proposal, verdict record, subject
> computation, gate, and authorization assertions within a writable automation
> boundary. A council can improve scrutiny without becoming a distinct
> authorization principal.

What would change that: authenticated owner approval bound to the exact subject
digest and verified **outside the agent-writable tree**, or an enforced platform
boundary proving the council and record writer cannot modify, or cause
modification of, the proposal, gate, reviewer, policy or approval channel.

## Owner-owned, and the reason it is

Which of the two records operates, and whether ADR-281 is amended along § 2's
line or withdrawn, is governance self-amendment over the authority ladder. No
council verdict settles it — this one says so itself.
