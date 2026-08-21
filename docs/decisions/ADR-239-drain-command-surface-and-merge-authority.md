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

## References

- [`ADR-237`](ADR-237-end-to-end-execution-authority.md) § 4 — the exclusion this record does not extend.
- [`command-clusters`](../contracts/command-clusters.md) — the flag-not-command rule, and the new `git-pr-merge` row.
- `agents/roadmaps/road-to-drain-commands.md` — the plan, and the `merge-authority` blocker.
- `src/scripts/hooks/block_unauthorized_git.ts` — `BLOCK_OPS`, `LEDGER_MAX_AGE_MS`.
- `src/scripts/git_authorization_hook.ts` — `classifyAuthorization`, the human-only write path.
