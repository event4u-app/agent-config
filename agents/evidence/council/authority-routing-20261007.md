<!-- evidence-type: analysis -->

# Who decides what, and how the deciding is enforced

**Date:** 2026-10-07 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, 2 rounds, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: `ratified`**

| Seat | Stance |
|---|---|
| `openai/codex-default` | `ratified · high · DEALBREAKER: yes` |
| `anthropic/claude-sonnet-4-5` | `confirmed-non-expanding · med · DEALBREAKER: no` |

Per the ratification contract's rule — no concluding refusal, two distinct
providers, at least one `ratified` — the verdict is **`ratified`**: the
reservation below is adopted as a deliberate expansion of what is reserved,
not as a restatement of something already enforced.

The seats split on exactly that point and the split is worth keeping. anthropic
read the reservation as recording what ADR-268 § 4 already intends. openai
rejected that reading: *"The repository does not enforce it today, so it should
not be described as merely documenting an existing guarantee."* The stronger
reading governs, because calling an unenforced rule "already guaranteed" is the
error the whole mechanism exists to prevent.

## The owner's frame, which this council was asked to operationalise

- Take as much work off the agent's user as possible.
- Destructive or dangerous: the user decides.
- Everything else: the agent decides.
- In doubt: a council decides first; the user is reached only on genuine doubt,
  or on a refusal.

## What was decided

### 1. A passing verdict is reserved; a refusal is not

Both seats, independently: writing `ratified` **or** `confirmed-non-expanding`
into a ratification record requires human authority. `confirmed-non-expanding`
is not the lesser case — an agent choosing it for its own proposal is
self-classifying as non-threatening, which defeats the check exactly.

A **refusal** may be agent- and council-recorded, because it grants no
authority and fails closed. anthropic states the asymmetry: *"bad refusal
surfaces for override; bad approval may be irreversible."* Four constraints on
it, from openai: it stops only the current review instance; it stays visible in
later attempts; it never erases an existing valid approval; and it is not an
indefinite veto unless the user adopts it as final.

**Consequence for the schema:** `refused` today cannot express *correctable
objection* versus *non-convergence* versus *request for user authority*. That
distinction has to exist before the policy can be enforced reliably.

### 2. Reserve the authorisation, not the keystroke

openai's correction, which anthropic's layering does not contradict: requiring
a human to hand-edit Markdown *"adds friction without establishing identity."*
An agent may prepare the record and automation may materialise it, **provided
the gate requires a separate authenticated attestation bound to its exact
content** — repository identity, review-instance id, subject digest and base
revision, verdict, policy version, approver identity, timestamp, prior-refusal
references.

What each candidate actually buys, stated honestly:

| Layer | Guarantees | Does not guarantee |
|---|---|---|
| Written policy, model-carried | conforming agents were told | loading, compliance, identity, CI detection |
| Commit author/committer check | mutable git metadata matches a list | human action, informed approval, rebase/squash/impersonation resistance |
| Signed attestation / platform approval | an allowlisted credential approved this subject under this policy | careful review, credential custody |

Both seats reject the authorship check as the control. openai: *"An agent able
to run Git can generally set those values."* A `~/.gitconfig` comparison is
weaker still — local mutable state.

### 3. The reservation does not contradict the goal

*"Minimise user work governs non-dangerous actions; control over future agent
authority is dangerous because it can alter all later classifications."*

Decide the friction question from measurement, not preference: cycle
frequency, human active versus waiting time, expanding versus non-expanding
classifications, repeat approvals caused by digest churn, share approved
without reading the evidence, defects found after approval, accidental routes
through `confirmed-non-expanding`. Both seats reject arbitrary volume
thresholds. **If approvals become habitual rubber stamps the mechanism has
failed even when its latency is low** — so the first response to friction is to
stabilise digests, batch related changes and precompute the evidence packet,
never to delegate the authority to the party gaining it.

### 4. The dangerous-action test, applicable without asking

An action is dangerous if **any** predicate holds:

1. Non-trivial loss, disclosure, expenditure, external communication, reputational effect, or loss of access.
2. Affects production, shared infrastructure, third parties, legal obligations, or anything outside the authorised workspace.
3. Grants, delegates, persists or widens present or future agent authority.
4. Weakens, bypasses, reclassifies or disables a control meant to constrain agents.
5. Recovery needs a person, a privileged credential, an external administrator, payment, or unavailable prior state.
6. Target, authorisation or maximum blast radius cannot be established before execution.

Otherwise the agent decides, provided the action is scoped, observable,
reversible and recoverable with authority already granted.

**The rule that makes it usable:** uncertainty about whether a predicate
applies goes to the council for classification. *A council may resolve doubt
but cannot waive danger* — a council finding that a predicate applies routes
authorisation to the user.

### 5. When a council substitutes for the user, and when it cannot

Sufficient only when **all** hold: the question is technical or evidentiary
rather than one of consent, preference, risk appetite or authority; every
candidate stays inside existing authorisation; the result is reversible and
trips no dangerous predicate; the evidence is adequate and bound to the
reviewed subject; the seats are independent of proposer and implementer;
provider diversity is present; dissent and prior refusals stay visible; and it
converges under a rule fixed in advance.

Never a substitute when the action expands authority, weakens a control,
reaches production or third parties, commits money, creates legal or privacy
consequences, needs user-owned preferences, or cannot be recovered without the
user. And **not when every seat shares the compromised trust boundary** — when
repository-controlled instructions are themselves the disputed artifact,
provider diversity does not establish independence.

The council advises in those cases. It does not authorise on the user's behalf.

### 6. Not every refusal reaches the user

The agent remediates and re-submits when the refusal names a concrete in-scope
defect, asks for obtainable evidence, or proposes a safer reversible path. Each
attempt needs a new review-instance revision that **retains the prior
objections and shows their dispositions**.

Escalate when compliance would require a dangerous action or expanded
authority; when only user-owned intent can resolve it; when the evidence or
authority is the user's; when safe alternatives cost material scope, money,
schedule or compatibility; when the same substantive objection survives one
evidenced remediation; when the council is non-convergent after a bounded
number of materially changed attempts; or when a reviewer claims a permanent
veto rather than a correctable defect.

**The line against shopping:** repeatedly soliciting fresh councils without
retaining and resolving prior objections is review shopping. This mechanism's
own five-attempt history was legitimate *only because* the fifth addressed all
four earlier refusals and the evidence shows that lineage.

## The dealbreaker, recorded as given

openai would not greenlight the mechanism as it stands: *"the ratification
record remains inside the same write boundary as the governed change. The
host's `[Self-Modification]` classifier is neither a portable control nor part
of the repository's declared trust model."*

It names what would change its mind: an authenticated approval bound to
repository, subject digest, base policy version and verdict; protected against
use by the proposer or implementer; exercised across squash, rebase,
revocation, replay and gate-modification tests.

anthropic adds the circularity both seats reached independently: **the
enforcement code must not be ratifiable through the same process it enforces.**
Either it sits in a protected subset needing higher approval, or it is
externally verified, or it is honestly labelled policy rather than mechanism.

## Three authorities currently collapsed into one field

openai's structural finding: `verdict` conflates the **technical review
outcome**, the **authority classification**, and the **authorisation to
proceed**. Separating them is a precondition for the rest, not a refinement of
it.

## Disposition of the six defects this run surfaced

| # | Defect | Decider | Why that follows from the frame |
|---|---|---|---|
| 1 | `lint_roadmap_blockers` reports vacuous clean | **agent** | Recognising already-valid syntax is reversible maintenance, no predicate trips. Sequenced after 2. |
| 2 | A cross-file blocker id has no legal state | **council** | Choosing dependency semantics is architectural; several reversible options inside existing authority. |
| 3 | A load-bearing comment nobody names | **agent** to document and regression-test · **council** for the contract | Replacing an accidental positional bypass 115 files rely on changes a gate contract. |
| 4 | `check_completion_review` cannot express a same-day re-review | **council** | Needs review-instance identity, supersession and hash-bound correction semantics — a design choice, not a bug fix. |
| 5 | Merges landed ahead of their completion review | **user** | Whether trunk changes may land without completed authorisation is a governance rule; predicate 4 trips. Council may design the hold; the user approves the rule and any bypass. |
| 6 | Live-tree measurement pins red the trunk | **council** | Whether these are invariants, snapshots, tolerances or observations changes what the gate attests. The agent may refresh clearly observational data; it may not silently weaken a required invariant. |

## Required sequencing, and why it is not a preference

1. Hold authority-expanding constitutional merges, or require an external bootstrap approval.
2. Define the dangerous-action predicates, the review-instance model and the passing-authorisation format.
3. Establish the approver registry and a protected verifier.
4. **Decide cross-file blocker semantics before broadening blocker detection** — fixing defect 1 first turns hidden markers into illegal ones.
5. Decide artifact-classification semantics before removing the comments.
6. **Implement stable review instances and merge serialisation before relying on completion review** — review hashing without serialisation still reviews a head that is no longer the merge candidate.
7. Classify live-tree checks as invariant or observational before restoring them as required gates.
8. Shadow-run the verifier, then activate it through external bootstrap authorisation.

## Break-glass, and what must stop rather than fail open

A user-controlled authenticated path scoped to one subject and base revision,
with expiry, reason and immutable audit evidence. Activation **stops** if an
approval can be replayed against different content or policy; if the proposer
or implementer can exercise the approval credential; if the registry or
verifier can be weakened without equivalent authorisation; if squash or rebase
destroys provenance; if identity verification is unavailable beyond a declared
duration; or if false rejections prevent all constitutional maintenance.

During such a failure ordinary work continues and constitutional merges stay
held. Rollback means reverting to a previously approved verifier version — it
must never mean letting an agent select the older permissive path.

## Open, and owned by the user

Credential custody · revocation · approval expiry · supported merge strategies ·
break-glass authority · the bound on review attempts · whether a refusal is
provisional or final. These are policy gaps, not implementation details.
