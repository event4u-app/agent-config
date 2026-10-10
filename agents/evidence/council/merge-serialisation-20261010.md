<!-- evidence-type: analysis -->

# What re-binds a review, and what legitimately does not

**Date:** 2026-10-10 · **Members:** `anthropic/claude-sonnet-4-5`, `openai/codex-default`
**Mode:** design, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: convergent**

Executes step 6.1 of `road-to-authority-routing-mechanism`, which carries
defect 4 of the authority-routing record: *"review hashing without
serialisation still reviews a head that is no longer the merge candidate."*

## The mechanism, converged

**Instance and attempt are separated.** A review *instance* is stable per
branch; an *attempt* is immutable and carries the scope hash, the target sha at
review time, and the reviewer. Objections carry forward from instance to
attempt: resolved ones are marked, unresolved ones persist — which is what
Phase 2.5's identity exists for.

**The predicate is a target-entry fingerprint over the touched files.** At
review time the attempt records, per touched file, that file's blob hash **on
the target**. At merge time a CI-side check re-reads those same files on the
current target and compares:

- any fingerprint differs → **STALE**, a new attempt under the same instance;
- all match → **VALID**, even if the target advanced on other files.

That is exactly the separation the question asked for. The three-dot diff
already makes case 1 (`main` advances elsewhere) a non-event; the fingerprint
makes case 2 (`main` touches a file the branch also touches) detectable, which
the three-dot diff alone cannot do.

**Ordering is first-valid-wins.** After a branch lands: non-overlapping branches
stay valid and retry mechanically; branches whose touched set intersects the
landed one go stale and re-review. **No owner decision in the common path** —
which was the forbidden move, and both seats declined it.

**The check runs in CI, never the agent.** anthropic states the boundary:
the party gaining the merge is not the party attesting the review still binds.

openai adds three mechanisms anthropic did not name and anthropic did not
dispute: a **compare-and-swap** on a sole protected writer for the serialisation
itself; a **policy hash** in each attempt, so changing exclusions, diff flags,
merge strategy, reviewer authorization or validator code mechanically revokes
every affected outstanding attempt; and normative **fail-closed** criteria —
automatic landing stops when trusted storage or attestation is unavailable,
branch protection cannot be confirmed, recorded lease history disagrees with
target history, or candidate-controlled code can affect validator inputs.

## What the mechanism cannot prove — both seats, unprompted

openai states it sharpest, and it is recorded as the limit rather than a
caveat:

> This mechanism establishes atomic, **syntactic** continuity of an explicitly
> defined review projection. It does not prove semantic equivalence, and the
> architecture must not describe it as doing so.

Specifically out of reach: semantic conflicts between non-overlapping changes;
anything inside the configured **exclusions**; generated state; environment-
dependent merge behaviour; and an administrator bypass of branch protection.
anthropic's version: *"It proves: no file in the syntactic footprint changed on
target between review acceptance and merge."*

openai names what would retire its objection — a precisely defined normalized
review projection, a landing authority that constructs the identical projection
from the prospective result, exclusions treated as explicit limits on the claim,
and adversarial tests for renames, deletion/recreation, modes, symlinks,
submodules, policy changes, CAS races and branch-controlled validator
modification.

## Dissent, recorded

**anthropic:** the instance/attempt split adds complexity. If objection
retention is not actually needed, a flat attempt model suffices — it designs for
the split only because Phase 2.5 is a stated dependency. Separately: relying on
branch protection for serialisation assumes it cannot be bypassed, so the
mechanism must **fail closed when protection is disabled**.

## Prompt provenance

Committed beside this record as `merge-serialisation-20261010.question.md`. It
read the mechanism from the code rather than recalling it — the three-dot
`base...HEAD` scope, owned by `dispatch_r2_reviewer.ts` and imported by
`check_completion_review.ts` so the two cannot diverge — stated the three
consequences that follow from the three dots, stated what would make each
candidate answer **wrong**, and forbade by name the two easy moves: routing the
merge-time decision to the owner, and re-reviewing on every push. Both seats
declined both.
