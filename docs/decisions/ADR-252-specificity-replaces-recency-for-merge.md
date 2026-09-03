---
adr: 252
status: accepted
date: 2026-09-03
decision: specificity-replaces-recency-for-merge
supersedes: ADR-251
superseded_by: —
phase: —
type: structural
reopen_policy: owner
protected_dimensions: security_floor
provenance:
  kind: mixed
  decision_makers: [maintainer, agentic-review]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - src/scripts/git_authorization_hook.ts
    - src/scripts/hooks/block_unauthorized_git.ts
    - src/scripts/hooks/merge_impact.ts
    - tests/scripts/git_auth_grants.test.ts
    - tests/scripts/git_auth_destructive_coverage.test.ts
    - docs/decisions/ADR-251-authorization-window-shape-not-width.md
    - docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md
authority_basis: owner_intent
review_trigger: >-
  Reopen when a grant is observed authorizing a merge the user did not name —
  a target reaching `MergeGrant.targets` from anywhere but a human-typed
  sentence, or a cardinality word minting an enumerated set. Reopen also when
  a grant survives an operation it should not have: a merge replayed against a
  target already in `consumed`, or a grant read across a session boundary.
  Reopen when the impact scan is observed downgrading a refusal rather than
  annotating it. Explicitly NOT a trigger: a run being long, or a user finding
  the remaining confirmations annoying — both are the pressure this record
  already weighed and deliberately did not dissolve.
---

# ADR-252 — Specificity replaces recency, for merge and for nothing else

## Status

**Accepted** · 2026-09-03. Supersedes [ADR-251](ADR-251-authorization-window-shape-not-width.md),
whose decision was that the 30-minute authorization window's width does not move.
The width still does not move. What changes is that **width stops being the only
control**: an authorization that names its objects no longer needs one.

`LEDGER_MAX_AGE_MS` is **unchanged at 30 minutes** and still governs every
operation that has not frozen its targets. Hand-widening it remains forbidden
practice, and the guard's docblock still says so.

## Context

ADR-251 kept the window and changed the behaviour at expiry to pause-and-ask. Its
`review_trigger` named two reopening conditions. Both are now met.

**The first: the pause-and-renew shape was routed around again.** On 2026-09-03
an operator opened a session on the premise that the constant had already been
widened to six hours, source changed and bundle rebuilt, with instructions not to
be contacted again until a final summary. Read-only verification found the source
and the built bundle both unchanged at 30 minutes. The routing-around was
attempted, not achieved — but ADR-251's trigger asks for the attempt, and this is
the third occurrence of the same pressure after the hand-patches of 2026-08-21
and 2026-08-30.

**The second: the ledger gained a binding to a PR number.** ADR-251 named this
explicitly — *"Reopen also when the ledger gains a binding to a PR number or a
HEAD sha: a clock-scoped window and an operation-scoped authorization answer
different questions."* This record is that binding.

**A third defect, measured here and not anticipated by ADR-251.** The ledger did
not merely expire; it was **replaced on every human turn**. A neutral follow-up —
`weiter`, `fixe die ci` — erased a merge authorization the user had given two
turns earlier. Both council seats identified this independently as the primary
defect, ahead of the clock. It means the effective authorization lifetime was
never 30 minutes; it was "until you say anything else", which no record
described and no user could have predicted.

## The owner's principle

Stated by the owner, who is resolving the `merge-authority` blocker that
[ADR-239 § 3](ADR-239-drain-command-surface-and-merge-authority.md) reserved to
him:

> Do not block what the user directly demanded. Do block irreversible behaviour
> that arises only from the agent's interpretation, where the user could have
> meant something else or was not aware of the consequence — there, ask again
> first.

With his own worked examples: *"clean up the PRs"* must not be read as *delete
them*; *"clean up the PRs and delete them"* is an instruction; *"get all the PRs
through"* should ask before merging; *"merge all PRs"* should merge.

## What the council said

Convened 2026-09-03, members `anthropic` (claude-sonnet-4-5) and `openai`
(codex-default), depth `deep`, `--invocation user_explicit`. Quorum 2/2 present
before and after the run. The artefact is local-only and gitignored, so it is
cited by date and membership rather than by path.

**Both seats rejected the proposal as the owner first framed it, and converged on
a narrower one.** The disagreement was precise rather than temperamental: the
owner's principle conflates **lexical** specificity with **object** specificity.
"The user typed the verb" does not establish *what the verb will act on*. Seat 2
put it in one line — *"replacing time with identity is an improvement; replacing
time with a retained regex match is not."*

Convergent findings, all adopted here:

| Finding | Where it lands |
|---|---|
| The ledger-replacement behaviour is the primary defect, ahead of the clock | § Decision 1 |
| Binding must precede any relaxation of expiry | § Decision 2; the binding and the exemption ship together |
| "All" is valid only as a grant-time enumerated snapshot, never a live wildcard | § Decision 3 |
| `npm publish` keeps just-in-time confirmation, always | § Decision 4 |
| Regex is a conservative recognizer for closed forms, not a judge of intent | § Decision 5 |
| ADR-251 must be superseded, not silently overridden | this record |
| The owner may resolve ADR-239 § 3 for merge only | § Authority analysis |
| `non-destructive-by-default` needs a formal amendment, not a "clarification" | § What this record does NOT do |

## Decision

**1. Grants accumulate; `authorized` does not.** A human turn still replaces the
turn-scoped `authorized` list exactly as `commit-policy` requires — a bare
operation name stays one-shot. Standing grants carry forward across turns and are
dropped only by an explicit revocation, by being fully spent, or by the session
ending.

**2. A grant is target-bound, single-use per target, and carries no clock.**
`MergeGrant` freezes the PR numbers the user's own sentence named. Each is spent
when the guard actually lets that merge through — not when the grant was minted,
so a grant the run never reached stays whole, and a merged PR can never be
replayed against a force-pushed head. No age check is applied, because the
objects cannot drift into different objects.

The grants are read on a path that never consults `detected_at`. Folding them
into `_readLedgerFile` would have let the 30-minute clock kill them silently: the
change would have shipped green and done nothing after half an hour.

**3. A cardinality word with no numbers mints nothing.** "merge alle PRs" freezes
no target and therefore buys no clock exemption; it falls back to the
clock-bound path unchanged. The prompt-submit hook cannot enumerate open pull
requests, and minting over an unenumerated universe would hand out a capability
covering pull requests that do not exist yet. **This is the half of the owner's
principle this record does not deliver**, and it is named rather than blurred:
his "merge all PRs" case still expires in 30 minutes. The supported workflow is
that he names the numbers once — "merge #1499 #1488 #1480" — after which a
multi-hour drain runs with no further turns.

**4. Only `pr-merge` can hold a grant.** `publish`, `tag`, `release` and
`pr-merge-auto` keep the clock in full. A version number does not identify the
bytes that will be published, so no prompt can freeze that effect; auto-merge
hands execution to a future state nobody is watching. Both seats were explicit
that publish is categorically different, and seat 2's strongest concrete failure
mode is a TOCTOU substitution on exactly that path.

**5. Coverage was extended before the relaxation was, and the two shipped
together.** Twenty-five borderline-destructive operations were probed against
`commandOp` on 2026-09-02; seventeen classified as **nothing**. Ten are now
`BLOCK_OPS` and seven `WARN_OPS`. Relaxing the clock on a guard that could not
see `gh api -X DELETE …/protection` would have been a refinement of the wrong
set.

**6. Every blockable operation has a sentence that authorizes it.** A blocked
operation with no authorizing phrase is a dead end: the guard refuses, the user
says "do it anyway", the classifier records nothing, and the refusal repeats
forever. `tests/scripts/git_auth_destructive_coverage.test.ts` asserts this over
`BLOCK_OPS` itself, so the invariant cannot fall behind the tier.

**7. Stage-2 impact analysis annotates a refusal and never downgrades one.**
Three-valued — `additive`, `destructive`, `undecidable` — with every unreadable
patch resolving to `undecidable`. The markers are decidable proxies, matched on
added lines only. An `additive` verdict still refuses, because a purely additive
diff can still fire a deploy against a base that moved.

## Authority analysis

`decision-revisit-gate`'s reserved table sends a transition that **lowers a
recorded security floor** to the owner. Two of the three changes here do not
lower one, and one does.

- **Extending coverage (§ 5) strengthens the floor.** Council-decidable, and
  taken with the council's agreement.
- **Fixing the ledger-replacement defect (§ 1) restores the lifetime the record
  described.** Both seats classified it as a defect, not a floor.
- **Exempting a target-bound grant from the clock (§ 2) lowers a floor**, and is
  owner-reserved. It was taken by the owner, in writing, after being shown
  ADR-251's existence, date, council backing and measured pressure, and after
  reaffirming across three turns. `authority_basis: owner_intent` records that
  honestly: this rests on the owner's decision, not on a measurement showing the
  window was wrong.

**What no evidence establishes**, stated because ADR-251 stated its own version
of the same gap: **that this shape is safer than the 30-minute window.** It is
narrower in the dimension that was measured to fail — a grant cannot cover a PR
the user never named — and unmeasured in the dimension neither record can reach,
because the window has never been recorded catching an unintended merge. It has
now been recorded being routed around three times.

## What this record does NOT do

- **It does not amend `non-destructive-by-default`.** That rule's Hard Floor
  requires confirmation "on this turn" and explicitly excludes a previous turn,
  which a standing grant contradicts in plain text. Both seats said this needs a
  formal amendment and that calling it a clarification would conceal a material
  change. It is a kernel rule: `block-kernel-rule-writes` denies agent writes to
  it, and `scope-control § Kernel-rule edits` requires its own PR with a 24-hour
  soak. **Until that lands, the rule text and the mechanism disagree, and the
  rule text is the one a reader should trust for every operation other than a
  target-bound merge.**
- **It does not bind a HEAD sha.** ADR-251's residual asked for PR number *and*
  head sha. Only the number is bound. Single-use consumption covers the replay
  case a sha would have caught; it does not cover a force-push landing new
  content on an unmerged target. Seat 1 named this as a distinct attack and
  proposed an `updated_at` check, which needs a network read the ledger writer
  does not have.
- **It does not implement effect manifests** for release, publish or tag, atomic
  remote preconditions, cross-repo scoping, or an auto-merge state machine. All
  four were named by the council; none is needed for the merge case, and shipping
  a half-form of any of them would replace a weak control with an untested one.

## Consequences

**Positive.** An operator who names the pull requests gets a multi-hour drain with
one human turn instead of one per thirty minutes, and the forbidden action —
widening the constant — stops being the only way to get there. Seventeen
destructive operations that classified as nothing now classify. A refused merge
carries what the diff would do, so the confirmation can be spoken rather than
researched.

**Negative, and named.** The authorization surface grew: seventeen new phrase
patterns, each of which can over-match. The negation defect that this work found
in 15 of 15 new phrases is fixed centrally, but the same class can recur in the
next phrase anyone adds. A grant is unforgeable by the agent and still only as
good as the classifier that minted it.

**Unresolved.** The kernel-rule amendment above. The sha binding. And the
cardinality case, which is the owner's own stated example and does not work.

## Alternatives

**Widen `LEDGER_MAX_AGE_MS` to six hours.** Rejected, and it is what the operator
believed had already happened. A single consent silently covers six unattended
hours, over any pull request, including ones opened during those hours. The grant
shape buys the same run length while covering only what was named.

**Remove `pr-merge` from `BLOCK_OPS`.** Rejected. It removes the gate rather than
scoping it, and it would take auto-merge with it.

**Leave ADR-251 standing and rely on pause-and-renew.** Rejected on the evidence
that produced this record: the shape has now been routed around three times, and
a supported path that is reliably bypassed is not a control.

**Ship the coverage extension without the grant exemption.** Rejected as strictly
worse for the user than doing nothing: ten new blocking operations with the
override path still expiring every thirty minutes is more friction and no more
safety.

## References

- [ADR-251](ADR-251-authorization-window-shape-not-width.md) — superseded; its measurements, its residual and its two reopening conditions are the input to this record.
- [ADR-239](ADR-239-drain-command-surface-and-merge-authority.md) § 3 — the owner-reserved `merge-authority` blocker, resolved here for merge only.
- [ADR-237](ADR-237-end-to-end-execution-authority.md) § 1 — unchanged. A `process-full` invocation still does not authorize a production-trunk merge; only an explicit, target-naming sentence does.
- `src/scripts/git_authorization_hook.ts` — `MergeGrant`, `foldGrants`, `extractMergeTargets`, `isRevocation`, `negatedBefore`.
- `src/scripts/hooks/block_unauthorized_git.ts` — `grantCovers`, `mergeTargetOf`, the extended `BLOCK_OPS` / `WARN_OPS`.
- `src/scripts/hooks/merge_impact.ts` — the stage-2 scan.
