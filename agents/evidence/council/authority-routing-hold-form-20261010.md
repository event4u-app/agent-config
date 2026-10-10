<!-- evidence-type: analysis -->

# The hold that step 1.1 asked for is not a sentence

**Date:** 2026-10-10 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: `(c)` — convergent, with one residual split on scope**

Executes step 1.1 of `road-to-authority-routing-mechanism`: what mechanical
form must satisfy item 1 of the authority-routing record's required
sequencing — *"Hold authority-expanding constitutional merges, or require an
external bootstrap approval."*

| Seat | Pick | Scope of the external anchor | Confidence |
|---|---|---|---|
| `anthropic/claude-sonnet-4-5` | `(c)` | Phase 3 only; Phase 2 is already condition-4 routed | high (0.85) |
| `openai/codex-default` | `(c)` | Phase 2 **and** Phase 3 | high (0.91) |

## What both seats rejected, and why

**(a), a doc-only sentence, is not a hold.** openai: *"A doc-only sentence is
not a hold: it neither changes routing nor prevents bypass."* anthropic reaches
it from the other side — a sentence saying the changes land through the
existing ladder *"either misdescribes (if the ladder doesn't clearly apply) or
adds a sentence that holds nothing (if the ladder does apply but we're just
restating it)."*

**(b), a CI check scoped to the touched files, is ceremony.** Both seats: a
check that lives in the candidate branch is inside the write boundary the
record's own dealbreaker names, and the contract already says so in its own
words — *"THE GATE ADDS A REFUSAL. IT DOES NOT ADD AN ANCHOR. IT RUNS BECAUSE A
WORKFLOW STEP IN THE CANDIDATE BRANCH INVOKES IT."* openai: *"the candidate can
alter the purported control."*

## The fact the pick turned on, and it was not established

The question asked whether the contract's existing condition 4 — *"the change
is to the reviewer itself — the modules that compute the record's `subject`,
write the record, ask the questions and derive the verdict, and this
contract"* — already routes Phases 2–3 to the owner.

**Phase 2: yes, both seats.** 2.3 changes how the record is written and how the
verdict is represented; 2.4 changes verdict derivation; both amend the contract.

**Phase 3: not established, both seats.** The enumeration names computing a
subject, writing a record, asking questions and deriving a verdict. A verifier
**checks an attestation** — a different function — and an approver registry
*declares authorised principals*, which is further still. anthropic adds the
dating argument: condition 4 *"was written before the verifier existed"*, and
*"the contract binds what it says, not what it might have said if it
anticipated Phase 3."*

Both then treat the ambiguity itself as the finding. openai: *"A constitutional
boundary should not depend on whether 'the reviewer itself' is interpreted
broadly after a disputed change has already landed."* anthropic: *"When in
doubt on self-governance, fail toward more external control, not less"* — if
the bootstrap turns out to be redundant it is harmless; if condition 4 does not
reach the verifier and (a) was relied on, *"we've documented our way past a
circularity gap."*

## The residual split, recorded rather than resolved

openai extends the external anchor to Phase 2: *"Phase 2 changes the semantic
fields that Phase 3 will later verify; allowing those semantics to bootstrap
under the old boundary leaves Phase 3 cryptographically binding an internally
authorised constitutional change."*

anthropic leaves Phase 2 on condition 4, holding that owner routing is already a
mechanical hold there.

**The stronger reading is taken** — openai's — on the precedent the parent
record set for exactly this shape: calling an unenforced rule already
guaranteed is the error the mechanism exists to prevent. Condition 4 routes a
decision to a person; it does not prevent a merge. anthropic's position is
recorded as the dissent and costs nothing if openai is right.

## What the pick guarantees, and what it does not

**Guarantees** that neither Phase 2 nor Phase 3 can bootstrap or weaken its own
authority through approval machinery stored in the candidate branch.

**Does not guarantee** sound approvals, a trustworthy external administrator,
or recoverability if the external control is misconfigured or unavailable —
both seats stated this unprompted.

## Two conditions on sequencing, from openai, not in the step's text

1. *"Phase 3 must not begin until the external approval path is both active and
   tested against an attempted bypass. Merely designing or documenting it does
   not unblock implementation."*
2. Break-glass needs explicit criteria — *"who may suspend a broken verifier,
   how emergency changes are authorised outside that verifier, and how
   protection is restored. A normal revert through the governed process is not
   a credible rollback if the verifier itself is what failed."*

Condition 2 is substantially answered by D3 already (owner alone, as his own
forge bypass, recording reason, subject digest, time and commit, with a
mandatory after-the-fact council review). Condition 1 is new and binds Phase 3.

## What this does NOT decide

Who configures the external control. The council named the shape — a forge-side
approval administered by a separately authorised principal, outside the
candidate branch. D7 already chose that mechanism for the approver registry: a
GitHub required-reviewer account or team declared through
`src/config/platform-anchor.json`, *"so no credential sits where an agent could
reach it; the forge holds and authenticates the identity."*

The act of turning it on is not the agent's, and that is the point rather than
a limitation: a protection an agent can add is one an agent can remove, and
both seats required that the protection configuration itself stay subject to
the higher approval. Registered as blocker
`external-bootstrap-boundary-for-phases-2-3`.

## Prompt provenance

The question is committed beside this record as
`authority-routing-hold-form-20261010.question.md`. It named all three options,
stated what would make each one **wrong**, and forbade by name the two easy
moves — reaching for "the owner decides" because the subject is governance, and
reaching for (b) because it sounds stronger. Both seats answered the
wrongness conditions rather than the options.
