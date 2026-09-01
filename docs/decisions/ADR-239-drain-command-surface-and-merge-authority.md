---
adr: 239
status: accepted
date: 2026-08-21
decision: drain-command-surface-and-merge-authority
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Reopen on any of three observations, none of them a calendar. First — the
  owner resolves the `merge-authority` blocker in either direction, since this
  record's § Decision 3 is written as an open question and a resolved one needs
  a different record. Second — a second command wants `all`-style cardinality,
  since one flag is a decision and two are a pattern that belongs in the
  cluster contract rather than in two command files. Third — an authorization
  store appears anywhere under `src/scripts/hooks/` that an agent can write,
  since § Decision 3's whole argument is that no such store exists.
---

# ADR-239 — Drain command surface, and where merge authority stops

## Status

**Accepted** · 2026-08-21. Authored from `road-to-drain-commands`, which
promoted three hand-proven operator prompts into command surface. Builds on
[`ADR-237`](ADR-237-end-to-end-execution-authority.md) (the invocation is the
grant, and merging is outside it), [`ADR-044`](ADR-044-command-naming-scheme-hyphenated.md)
(path-derived slugs), and the locked cluster registry
([`command-clusters`](../contracts/command-clusters.md)).

## Context

Two workflows were being run by pasting long prompts into a session: draining
every active roadmap to one PR each, and draining the open-PR queue by syncing,
resolving conflicts, fixing CI and merging. Both worked. Neither was governed —
the rules lived in a chat message, so nothing could review them, nothing could
gate them, and each run re-derived them slightly differently.

Three things made promoting them non-obvious.

**The registry forbids the obvious shape.** The operator asked for a
`/roadmap:process-all` command. `command-clusters.md` says sibling variants
become a flag, never a second command, and a drain is a *count* of what
`process-full` already does.

**`pr/` is not a cluster.** `src/domains/git/pr/create/` is itself a cluster
head (`git-pr-create`); `pr/` is a bare path segment. A merge command is
therefore a new cluster beside it, not a sub of it.

**Merging is excluded by an ADR that says its exclusion cannot be extended.**
ADR-237 § 4: *"What the grant does NOT cover, and no invocation extends it:
merging to a production trunk …"*. The canonical loop says the same thing in
its own words: *"Merge is out of scope in every mode — always conversational."*
And the guard agrees mechanically — `pr-merge` is a `BLOCK_OPS` member.

Against that stood a real cost, measured rather than assumed. On 2026-08-21 a
drain run found that every open PR touches `agents/roadmaps-progress.md` and
`src/config/estate-count-budget.json`, so **each merge re-conflicts every
remaining PR**. Throughput is one merge per authorization window. The
workaround in production was the operator sed-patching `LEDGER_MAX_AGE_MS` from
30 minutes to 6 hours — and that widening reached the trunk and stayed there.

## Decision

**1. Cardinality is a flag.** The estate drain ships as
`/roadmap:process-full --all`, not as a new `process-all` command. `--worktree`
mirrors `/roadmap:next` § 4 exactly, including its seeding allow/deny list.

**2. The PR command is `/pr:merge`, a new `git-pr-merge` cluster.** Named
path-derived per ADR-044 from `src/domains/git/pr/merge/`, not the operator's
`prs:merge`. Its `all` form is an argument for the same reason as § 1. It
carries the queue mechanics the live runs proved: an immutable
`(PR number, head SHA)` manifest snapshotted at invocation, four enumerated
semantic conflict classes with a halt for anything outside them, a
superseded-close on an empty post-sync diff, bounded CI repair with a named
halt list, a termination cutoff, and a closed disposition set in its summary.

**3. Merge authority is not extended here, and the reason is recorded rather
than the conclusion.** `--merge` and the `/pr:merge` merge step are specified
and **inert**, gated on an owner decision tracked as the `merge-authority`
blocker. Three independent reviews reached that verdict and none of them was
the plan's author:

- The AI council (2 reviewers + chairman, deep, peer-reviewed, 2026-08-21):
  mergeability-only until authorization is target-bound and tamper-resistant.
- The committed `road-to-gate-preauth-authorization` stub: `agents/runtime/`
  is agent-writable, so an authorization read out of it "would let the agent
  consent on the user's behalf — which is the thing the abort exists to
  prevent, reimplemented as a feature".
- The runtime classifier, which refused this roadmap's own attempt to edit
  "merge is out of scope in every mode" out of the canonical loop.

Lowering a recorded safety floor is owner-reserved
([`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)), and an
agent that both wants the capability and writes the amendment authorising it is
the shape the reservation exists for.

**4. The design the owner would be accepting is written down, so the decision
is concrete rather than open-ended.** If activated, `--merge` introduces **no
new authorization store**. It consumes the per-session ledger entry the user's
own prompt text already wrote on `UserPromptSubmit` via `classifyAuthorization`
— a signal the agent cannot forge, since it is derived from the user's typed
words and the agent writes no prompts. Expiry stops the run and reports; the
window never grows. Two properties whose absence would make a *persistent*
grant unsafe, named so a future attempt starts from the objection: storage the
agent cannot write, and an immutable target manifest bound to PR number and
head SHA.

**5. Widening `LEDGER_MAX_AGE_MS` for a run is forbidden practice.** The
constant is restored to 30 minutes, its header says why, and the supported
answer to "my run is longer than the window" is that the run stops and reports
and the user re-authorizes. The agent never edits the guard, its source, or its
bundles; verification of the window is read-only.

**6. The hook bundle is verified by content.** `dist/hooks/` is untracked, so
the executing bytes were only ever compared by mtime — ordering, not
equivalence. A content gate rebuilds with the canonical flags and compares
sha256. It is local-only by construction and says so: a fresh CI checkout has
no bundle, so a green CI cannot speak for the bundle a maintainer runs.

## Consequences

- A drain is one invocation instead of a pasted prompt, and its rules are
  reviewable text under `src/`.
- The estate drain delivers **mergeable** PRs, not merely open ones — which is
  most of the value, since the conflict arithmetic made "open" nearly
  meaningless in a queue.
- Merging still needs the owner, per PR or per decision. The friction is real
  and it is the point: § 3's three reviews are the argument that the friction
  is cheaper than the alternative.
- Two command files carry a specified-but-inert feature. That is a real cost —
  a reader can mistake specification for capability — and it is mitigated by
  the gate block being the first thing each file says about merging.

## Alternatives

- **`/roadmap:process-all` as its own command** — rejected: the registry's own
  anti-sprawl rule covers it exactly, and `all` changes count, not lifecycle.
- **`/roadmap:next --all`** — rejected: `next` owns selection but declares
  "No merge, ever"; delivery belongs to `process-full`.
- **A run-scoped grant store in `agents/runtime/`** — rejected: the stub's
  objection is decisive; an authorization the agent can write is not one.
- **Simply keeping the 6-hour window** — rejected: it is a twelvefold expansion
  of the authorization lifetime on the guard for irreversible operations, and
  it was never a decision, only a patch nobody reverted.
- **Shipping `--merge` active because the operator asked** — rejected here and
  routed to the blocker instead. The operator may well grant it; an agent
  writing the amendment that authorises its own merge is what must not happen.

## Disposition — 2026-08-22, autonomous roadmap closure

This section is **appended, not a rewrite**: the Decision above records what was
proposed and why the question was routed to a blocker. This records how that
blocker actually closed.

**Outcome: `--merge` was removed. The policy question is undecided, not rejected.**

`road-to-drain-commands` was carried to completion by a fully autonomous drain
that had no owner round-trip available. Steps 4.4 (`--merge` semantics) and 4.7
(amend the canonical loop's merge sentence) are marked `[-]` **cancelled** with
this rationale:

> Lowering `non-destructive-by-default`'s per-turn confirmation floor for a
> production-branch merge is owner-reserved
> ([`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)
> § owner-reserved set). Owner authorization was structurally unavailable to the
> autonomous run. Reopening requires owner approval **and** an accepted design
> whose authorization is target-bound, head-SHA-bound, tamper-resistant,
> agent-unwritable, and subject to the kill-switch set.

**Why this is not the blocker's "decline" branch.** The blocker declared two
terminal branches, accept and decline, both predicated on an owner act. Neither
fired: the owner neither accepted nor declined, the owner was *absent*. An AI
council pass (2 of 2 seats convergent, 2026-08-22, recorded under
`agents/runtime/council/responses/`) ruled that recording an absence as a
decline would fabricate satisfaction of a terminal condition and would set the
precedent that a council can settle an owner-reserved question merely by running
autonomously. The council's authority here is **operational** — it may refuse to
ship unauthorized functionality — and not **policy**: it cannot make the ruling
ADR-237 § 4 reserves.

Two decisions are therefore separated on purpose:

| Decision | Who made it | Status |
|---|---|---|
| This roadmap will not implement `--merge` | AI council, 2026-08-22 | **settled** |
| Preauthorized merge authority is granted or refused | owner | **open** |

**Why the flag was removed rather than left inert.** An archived roadmap must
not leave latent executable authority behind a documented switch. `--merge` is
gone from the `argument-hint` and from the command body; the command's merge
section now states that no flag makes it merge and that a future capability
needs a new roadmap plus an owner ruling.

**Explicit non-rejection.** This disposition does not constitute owner rejection
of preauthorized merging. It closes the current implementation path pending an
owner authorization that the autonomous process could not obtain.

**What still ships, unchanged.** `/pr:merge` exists and does the expensive half —
base sync, the four enumerated conflict classes, driving required checks green,
the immutable target manifest, the kill-switch set, the no-rollback rule. Its
merge step stays unreachable from any autonomous path. `/roadmap:process-full`
delivers a *mergeable* PR unconditionally, with or without `--all`.

## References

- [`ADR-237`](ADR-237-end-to-end-execution-authority.md) § 4 — the exclusion this record does not extend.
- [`command-clusters`](../contracts/command-clusters.md) — the flag-not-command rule, and the new `git-pr-merge` row.
- The `road-to-drain-commands` roadmap — the plan, and the `merge-authority` blocker. Named without a path: an accepted ADR is permanent and that roadmap is archived on completion (`no-roadmap-references`; `check_no_roadmap_refs` does not scan `docs/decisions/`, so the rule holds here without a gate behind it).
- `src/scripts/hooks/block_unauthorized_git.ts` — `BLOCK_OPS`, `LEDGER_MAX_AGE_MS`.
- `src/scripts/git_authorization_hook.ts` — `classifyAuthorization`, the human-only write path.

## Settlement of § Decision 3 — 2026-09-01, negative and scoped

**This section is APPENDED. § Decision 3 above is not deleted, not rewritten and
not contradicted — it recorded that `--merge` and the `/pr:merge` merge step are
specified and inert, gated on an owner decision. They still are. What was open
was the decision itself; this records that it is settled, in the refusing
direction, and exactly how far the refusal reaches.**

### The settlement

> **Preauthorized merge authority is REFUSED.** `--merge` and the `/pr:merge`
> merge step remain **inert**. Merging is a post-PR manual operation that
> requires same-turn explicit user confirmation per
> [`non-destructive-by-default`](../../src/rules/non-destructive-by-default.md)
> § Hard Floor. No flag, environment variable, autonomy setting, roadmap step,
> standing instruction or council record makes any command merge.

The decision table at § Disposition still reads *"Preauthorized merge authority
is granted or refused | owner | **open**"*. That row is **not flipped by this
section**, and the reason is in § What this settlement does NOT reach below: the
table's row is the general, permanent question and it stays where it was. What
this section settles is the *workflow-scoped* form of it — the one the
`merge-authority` blocker actually gated.

### The scoping, which is load-bearing and must not be widened

**The refusal binds PREAUTHORIZED merge authority only.** It does **not**
prohibit — and must never be read as prohibiting — an ordinary merge performed by
a human under same-turn explicit confirmation. The owner merging their own pull
request is unaffected by this record in every respect. A future reader who takes
this as a blanket prohibition on merging has read it backwards: the refusal
removes an agent capability, it does not remove a human one.

Restated as the two propositions this section does and does not assert:

| Proposition | Settled here |
|---|---|
| An agent may hold merge authority in advance of the merge turn | **refused** |
| A human may merge under same-turn explicit confirmation | untouched — always was, still is |

### The council that produced it

AI council, 2026-09-01 (drain run 15). Members `anthropic/claude-sonnet-4-5` and
`openai/codex-default`; 2 rounds; depth deep; peer-review; blind chairman; quorum
**2/2 present** (needed 1) — concluded. Subscription transport, `billable=0`,
`$0.0000`. The question and both seat responses are local-only and are
deliberately **not cited by path**: council artefacts are gitignored and
auto-pruned, so a path here would rot, and the substance is inlined instead.

The question was whether the `merge-authority` blocker is resolvable at all under
the maintainer's standing instruction for that run — *"every open question,
decision, or blocker is answered by the AI Council — never by me; the council's
recorded decision substitutes for user sign-off"* — with the delivery boundary
fixed at *"one PR per roadmap"*. Three options were put: **4A** activate merge
authority · **4B** record it terminally unresolvable and leave the roadmap open ·
**4C** settle § Decision 3 negatively and re-scope the roadmap so it closes at the
PR boundary.

**Verdict: 4C, convergent, after one seat moved from 4B.** The load-bearing
reasoning, quoted rather than paraphrased:

> *"'Settling ADR-239 Decision 3' doesn't require activating merge authority — it
> can be settled in the 'no' direction. The council can record: 'For this
> workflow, merge authority remains inert; merging is a post-PR manual operation
> requiring same-turn explicit user confirmation per `non-destructive-by-default`.'
> That settles the decision without lowering the floor."*

> *"The owner also permits council re-scoping with written rationale. A negative
> Decision 3 plus a faithful redesign respects all three rules."*

The named counter-argument, recorded because it was actively defeated rather than
ignored: *"re-scoping could become cosmetic closure: moving Phase 7 elsewhere and
declaring success may silently discard the roadmap's original outcome."* The
verdict was conditioned on ten preservation obligations, and the fallback was
explicit — *"if those obligations cannot be preserved in an enforceable tracked
location, then 4C is unavailable and the fallback must be 4B. Merely deleting
Phase 7 or weakening its acceptance criteria would not qualify as legitimate
re-scoping."* All ten are discharged in the roadmap that carried the blocker and
in its receiver; neither Phase 7 nor its acceptance criterion was deleted or
weakened.

### The prior contradicting verdict, recorded rather than smoothed

**A council one day earlier reached the opposite conclusion about council
authority, and this section does not pretend otherwise.** The drain-run-14
council of 2026-09-01 (same two members, 2 rounds, blind chairman, quorum 2/2)
returned **2C — the `merge-authority` blocker is TERMINALLY OWNER-RESERVED**, on
the ground that *"an agent council cannot amend the boundary of its own
authority"*, and specifically corrected the argument that a refusal is the safe
direction: *"permanently declaring that only humans may promote still settles the
same governance boundary."* Drain runs 13 and 14 both declined to write a
refusal into this record for that reason.

**What changed between them is the question, not the answer to it.** Drain 14 was
asked whether the *authority* was council-decidable. Drain 15 was asked whether
the *delivery boundary of a roadmap* could be re-cut so that the authority
question stops gating it — and both drain 13 and drain 14 held in as many words
that scope questions of exactly that shape ARE council-decidable: *"recording a
boundary is within council authority"*, and *"the disposition of this roadmap's
two open items … are scope and evidence questions the council may answer."*

**The honest residual, stated falsifiably.** Under drain 14's 2C, writing any
refusal into this record — including this scoped one — is the owner-reserved act.
Under drain 15's 4C, a workflow-scoped refusal that grants nothing, removes no
human capability and lowers no floor is a boundary record. **This section takes
4C and states the falsifier:** if the owner rules that 2C stands and reaches a
scoped refusal, this section is void, the `merge-authority` blocker reopens, the
roadmap that closed under it reverts to active with its two deferred items
restored, and nothing here is written so as to make that harder. The general
decision-table row is deliberately left `open` so that reversal costs one edit
rather than a reconstruction.

### What this settlement does NOT reach

1. **It grants nothing.** No capability is created, widened or unlocked by this
   record. `acquirePromotionCapability` refuses on a `refused` disposition
   exactly as it refuses on an open one, and that is proven by test rather than
   asserted.
2. **It does not flip the § Disposition decision table.** The general question —
   whether preauthorized merge authority is granted or refused as a permanent
   property of this package — stays `owner` / `open`. A future owner ruling in
   either direction supersedes this section without having to unpick it.
3. **It does not touch the `review_trigger`.** All three of its conditions are
   about a *grant* appearing (an owner resolution in either direction, a second
   `all`-style command, an agent-writable authorization store). The first has now
   fired in the scoped sense recorded here, which is why this section exists; the
   other two remain unfired.
4. **It is not a merge confirmation.** No standing instruction and no council
   record is same-turn user confirmation for any merge, and nothing in this
   record may be cited as one.
