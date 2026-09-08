---
adr: 266
status: accepted
date: 2026-09-08
decision: explicit-pr-merge-invocation-is-the-this-turn-confirmation
supersedes: ADR-237 (§ 4 merge clause · /pr:merge only)
superseded_by: 268 (§ Not reopened · the roadmap-grant non-transfer bullet only)
type: structural
reopen_policy: owner
protected_dimensions: security_floor
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E0
  authority_basis: owner_intent
  discovery: incomplete
  basis:
    - src/domains/git/pr/merge/command.md
    - docs/decisions/ADR-237-end-to-end-execution-authority.md
    - docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md
    - docs/decisions/ADR-254-git-authorization-enforcement-removed.md
    - src/rules/non-destructive-by-default.md
review_trigger: >-
  A merge performed under this record reaches a PR the invocation did not name,
  or a head the manifest did not record — either is a breach of the scope this
  record grants and not a tuning question; or a mechanical authorization check
  is rebuilt, at which point § Consequences' "nothing mechanical checks it"
  clause is stale and the control moves back off the model.
---

# ADR-266 — An explicit `/pr:merge` invocation is the this-turn merge confirmation

## Status

Accepted 2026-09-08. **Owner ruling**, on the owner-reserved question
ADR-239 § Disposition left open. Not a council decision and not an agentic one:
the authority here is ownership of purpose, and the record says so in
`authority_basis` rather than dressing it as a measurement.

## Context

`road-to-drain-commands` shipped `/pr:merge` with its § 9 merge step **written
and inert**. The `merge-authority` blocker that gated it closed on 2026-08-22 as
*"not authorized in this roadmap"* — an autonomous drain had no owner
round-trip available, and an AI council correctly refused to record an owner's
*absence* as an owner's *decline*. ADR-239 § Disposition states the terms:

> Reopening requires owner approval **and** an accepted design whose
> authorization is target-bound, head-SHA-bound, tamper-resistant,
> agent-unwritable, and subject to the kill-switch set.

The result was a command named `merge` that could not merge. Every invocation
stopped at mergeable-and-open and handed the merge back to the owner, who then
had to give the word in a fresh turn — by which time `origin/main` had usually
moved and the prepared PRs were behind again. The owner's own framing, 2026-09-08:
buying a car in order to walk beside it.

ADR-237 § 4 is the clause that held it shut. Its list of things a `process-full`
invocation does not cover opens with "merging to a production trunk" and closes
with "no invocation extends it".

## Decision

**For `/pr:merge` only, an explicit invocation typed by the owner is the
this-turn confirmation that [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)
requires for a production-branch merge.** § 9 is active.

Three bounds, and they are the decision as much as the grant is:

1. **The authorization reaches exactly the PRs § 1's manifest snapshotted from
   that invocation** — a named number and a recorded head each. A PR that
   arrives later is new work and needs its own go-ahead (§ 7 already says so;
   this record does not soften it).
2. **`--no-merge` remains the explicit opt-out**, and remains the form
   [`/roadmap:process-full`](../../src/domains/product-basic/roadmap/process-full/command.md)
   calls for its delivery loop.
3. **Everything else in ADR-237 § 4 stands unchanged** — see § Not reopened.

## Why this satisfies the Hard Floor rather than lowering it

ADR-237 § 1 already argues this exact shape for `process-full`, in its own
words: a `process-full` invocation "is neither a previous turn nor a standing
directive: it is a single, explicit, this-turn delegation naming one concrete
deliverable, which is exactly the shape the Hard Floor asks for. The
confirmation is the invocation."

A `/pr:merge all` invocation is that same shape, applied to a merge. The Hard
Floor asks for an explicit user confirmation **on this turn**; a command the
owner typed this turn is one. What ADR-237 § 4 did was carve merging out of an
argument that otherwise covers it — a defensible caution while no target-binding
existed, and a contradiction once the command shipped with one.

The five terms ADR-239 set, checked against the shipped command text rather
than asserted:

| Requirement | Where it is met |
|---|---|
| target-bound | the `(PR number, head SHA)` pairs § 1 snapshots from the invocation, re-read against `observed_head` before § 9; a changed number is branch substitution and is refused |
| head-SHA-bound | § 1 re-reads the live head before every merge and refuses when it is neither the snapshot head nor the head this run itself pushed |
| tamper-resistant | **partially — the limit is named in § What this record does not claim.** ADR-254 removed the writable ledger the original concern was about, and the authorization is now a turn in the conversation that no run can rewrite; the manifest itself is model-held, so what binds the target is the pre-merge re-read rather than storage |
| agent-unwritable | same reason, and stronger than the ledger was: there is no authorization store for an agent to write. The command introduces none (§ Rules) |
| kill-switch-subject | § 8's six switches, armed during preparation and not only before a merge |

The fourth row is why this is not the design ADR-239 declined. That record was
written while an agent-writable ledger was the authorization; ADR-254 deleted
it. The remaining authorization channel is the owner's own words.

## What this record does not claim

Three findings from an adversarial review of this record (owner-reported,
2026-09-08) are dispositioned here rather than in a side artifact, because each
of them qualifies a claim the table above makes. Their provenance is stated
plainly: the review was not run by the session that wrote this record, and its
prompt is not in this tree, so this section records the findings and their
dispositions and claims nothing about the review's own independence.

**1 — the control is model-carried; no mechanism enforces it.** Accepted as
known, and § Consequences already says it in those words. The mechanical half
is designed and deliberately not shipped here: forge auto-merge with branch
protection as the gate, and a typed-grant check (`check_typed_op_grant`) that
reads an object-bound grant instead of a prose sentence. Both belong to the
mission-scoped authority work, named without a path because an accepted ADR
outlives a roadmap ([`no-roadmap-references`](../../src/rules/no-roadmap-references.md)).

**2 — a CI-side agent can merge, and this record does not reach it.** Real, and
outside this record's scope in a way worth stating rather than implying. A
workflow holding a write-scoped token — `pull_request_target` being the usual
shape — merges through the API regardless of what any rule text says, and no
prose in this tree sits in that path. The control there is forge-side: required
reviews and branch protection on the base, which bind a token exactly as they
bind a person. This record governs the agent-in-a-session path only, and a
green CI is not evidence that the CI path is gated.

**3 — "immutable" and "tamper-resistant" were overclaims; the table above is
corrected.** The manifest lives in the run's own context, not in a file
anything can verify, so nothing makes it immutable and no check would notice if
it changed. What actually binds the target is the pre-merge re-read of the live
head against `observed_head` (§ 1) — a check that fires, rather than a property
that holds. The rows now say that, and § 1's heading no longer says "immutable"
either.

## Not reopened

Scoped supersession — ADR-237 keeps `status: accepted` and everything below is
still in force:

- **ADR-237 § 4 for every command other than `/pr:merge`.** The sentence "no
  invocation extends it" is unamended there.
- **The rest of § 4's list, for `/pr:merge` too:** deploying or releasing ·
  production data, secrets rotation, IAM, DNS · bulk deletion outside the
  roadmap's own scope · any irreversible external action (send, publish, post,
  purchase, submit) beyond the PR itself. Each keeps its own this-turn
  confirmation.
- **Closing a PR the owner did not open.** `/pr:merge` § 4 requires a
  per-object confirmation naming number, title and author, every time. This
  record does not touch it, and the asymmetry with merging is deliberate.
- **ADR-239's cancellation of `road-to-drain-commands` steps 4.4 and 4.7** —
  `--merge` on `/roadmap:process-full`. That is a different surface with a
  different shape: a roadmap drain's invocation names a roadmap, not a merge,
  so the "the confirmation is the invocation" argument does not transfer to it.
  Reopening it is a separate owner decision.

  **That is a statement about this record's reach, never a finding that the
  transfer is wrong** — and the distinction is load-bearing, because the broader
  question is live. Whether a roadmap-scoped or mission-scoped grant may carry
  merge authority, and whether a grant persists past the turn that gave it, is
  owner-reserved and is settled by its own record. A later record deciding it in
  the affirmative **supersedes this bullet** and does not have to argue against
  it. Citing this record as evidence *against* mission-scoped merge authority
  misreads a scope note as a verdict, and the answer is written here rather than
  left to a session's memory.

  > **That later record now exists — lineage, added 2026-09-08, this bullet only.** The
  > separate owner decision was taken the same day and is recorded as
  > [`ADR-268 § 12`](ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md),
  > which accepts `granted_by: roadmap:<slug>` as an object-bound grant source and resolves
  > ADR-239 § 3. It supersedes this bullet on exactly the terms the paragraph above sets out,
  > and it does not overturn this record's argument: the *invocation-is-the-confirmation*
  > reasoning still does not transfer to a roadmap invocation, and § 12's grant does not rest
  > on it — it reads a typed object the owner wrote into the roadmap rather than inferring
  > authority from an invocation. **Every other bullet in this section stands unchanged**,
  > including the per-object confirmation for closing a PR the owner did not open. A pointer,
  > not a rewrite.

## Consequences

- `/pr:merge <N>`, `/pr:merge` and `/pr:merge all` merge what they prepared.
  The command's name and its behaviour agree for the first time.
- **Nothing mechanical checks the authorization.** ADR-254 removed the gate
  after it was measured refusing authorizations the owner had in fact given, so
  the control is this record plus the command's § 1 manifest and § 8 switches —
  model-carried, and stated as such rather than implied to be enforced. The
  recording hook (`src/scripts/git_authorization_hook.ts`) still writes the
  per-session ledger; it is an audit trail, never a permission.
- A breach of the three bounds in § Decision is a reportable defect, not a
  judgement call — it is this record's `review_trigger`.
- The blocker's own text is honoured rather than routed around: it named owner
  approval as one of two conditions, and the design condition was already met
  by the shipped command.

## Alternatives

1. **Keep § 9 inert and keep asking for the merge word each turn.** Rejected by
   the owner. It is also self-defeating in practice: the ask arrives after the
   CI cycle, by which time the base has moved and the prepared heads are behind
   — the sequencing trap the memory note
   `merge-authorization-is-turn-bound-and-a-conflict-cycle-spends-it` records
   from PR #1512.
2. **Rebuild a mechanical authorization gate first, then activate.** Rejected.
   ADR-254 removed the previous one *because* it produced false negatives on
   real authorizations, and rebuilding it reintroduces that failure while adding
   nothing the § 1 manifest does not already give (target- and head-binding).
   If a future gate is built, this record's `review_trigger` fires.
3. **Ship activation behind an opt-in `--merge` flag.** Rejected. It puts the
   default back at prepare-only on a command called `merge`, which is the
   complaint one flag deeper, and ADR-239 already removed that flag so that "an
   archived roadmap leaves no latent executable authority behind a documented
   switch". `--no-merge` as the opt-*out* keeps that property: the quiet path is
   the one that does less.

## Evidence

Graded `E0` with `authority_basis: owner_intent`, and the two halves of this
record rest on different things — which is the reason to write the section
rather than let the grade stand alone.

**The decision rests on ownership of purpose, and on nothing empirical.** No
measurement says a merge command should merge; the owner does, and
[`adr-layout`](../contracts/adr-layout.md) § `authority_basis` is explicit that
a human product decision records `E0` rather than faking a grade. `discovery:
incomplete` is the honest value: no evidence search was run, because none would
settle the question.

**The design-requirement claims are checkable, and were checked rather than
asserted.** § Why this satisfies the Hard Floor maps each of ADR-239's five
terms onto a numbered section of
[`/pr:merge`](../../src/domains/git/pr/merge/command.md) — § 1 for target- and
head-binding, § 8 for the kill-switch set, § Rules for the no-new-store
property — and the agent-unwritable term onto the deletion recorded in
[`ADR-254`](ADR-254-git-authorization-enforcement-removed.md), verified in the
tree: no `block_unauthorized_git.ts` remains under `src/scripts/hooks/`, while
`src/scripts/git_authorization_hook.ts` still writes the audit ledger. Any
reader can re-run those five reads.

**What is deliberately not claimed.** That the activation is safe *because*
something enforces it. Nothing does, and § Consequences says so in those words.
The control is this record plus the command's own manifest and switches, which
is a model-carried control — the same honesty boundary
[`security-sensitive-stop`](../../src/rules/security-sensitive-stop.md) states
for its own obligation.

## References

- [`ADR-237`](ADR-237-end-to-end-execution-authority.md) § 1, § 4 — the grant this amends, and the argument it reuses.
- [`ADR-239`](ADR-239-drain-command-surface-and-merge-authority.md) § Disposition — the terms for reopening.
- [`ADR-254`](ADR-254-git-authorization-enforcement-removed.md) — why no mechanical check remains.
- [`/pr:merge`](../../src/domains/git/pr/merge/command.md) — the command activated here.
- [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md) — the Hard Floor this satisfies.
