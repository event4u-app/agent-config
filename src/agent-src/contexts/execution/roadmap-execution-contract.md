# Roadmap Execution Contract

Loaded by [`roadmap-process-loop § 3`](roadmap-process-loop.md) when the run's
**derived** mode is `autonomous` or `phase-checkpoints`. The mode comes from the
§ 3a ladder — explicit invocation suffix, then frontmatter `execution.mode`,
then the invocation form — so an ABSENT frontmatter field no longer keeps this
context unloaded: under `process-full` it derives `autonomous`, and under
`/roadmap:next` or `process-phase` it derives `phase-checkpoints`. Only a
*derived* `interactive` (asked for explicitly, declared in frontmatter, or
`process-step`) leaves this context unloaded and falls back to the legacy
commit-step scan. Defines the run-start pre-scan,
the contract summary the user confirms ONCE, the grants that
confirmation activates, and the per-mode gate table.

## Principle — declaration vs. authorization

`execution.mode` in frontmatter is a **declaration of intent** written
at authoring time. It grants nothing. Authorization happens exactly
once per run: the user invokes `/roadmap:process-*` (a this-turn
action), the loop derives the contract below from the roadmap's
CURRENT content, and the user's single confirmation converts the
declared mode into this-turn grants **cached for this run only**
(same mechanism as the commit pre-scan it extends). Stale frontmatter
is harmless: no confirmation, no grants.

**`/roadmap:process-full` is the exception, per
[ADR-237](../../../docs/decisions/ADR-237-end-to-end-execution-authority.md):
the invocation IS the confirmation.** There is no separate acceptance round
and no contract screen to wait on — the user asked for the finished PR, and
the grants in § 3 activate on the invocation itself, whatever
`execution.mode` says or fails to say. **A missing `execution:` block does
not reduce the grant** under this wrapper; it only means the roadmap's author
declared nothing, which was never the authorization anyway. Waiting for an
acceptance the user already gave is the mid-run interruption
`process-full § Final-PR-only` forbids.

For `process-step` and `process-phase` the confirmation round stays: their
scope is narrow enough that a contract screen costs one line, and neither
carries ADR-237's end-to-end delegation.

## 1. Pre-scan — four detection classes

Scan every open step (text + inline notes) for:

1. **Commit-shaped steps** — `commit:` / `git commit` / `Commit phase`
   (the existing § 3 scan).
2. **Git-shape needs** — steps requiring a branch / push / PR
   (`branch`, `push`, `open a PR`, `create PR`, "in a worktree"), plus
   the run's own delivery needs when the roadmap's definition of done
   includes shipping (autonomous mode default, § 4).
3. **Artifact-authoring steps** — steps that create or materially
   rewrite a skill / rule / command / guideline (verbs `add`/`create`/
   `write`/`rewrite` + artifact nouns, or paths under
   `src/{skills,rules}/`, command/guideline trees). These feed the
   batched [`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md)
   research pass (§ 3 below).
4. **Open questions / ambiguity** — explicit `?` markers, "decide
   whether", options left unresolved, or steps matching the
   [`ask-when-uncertain`](../../rules/ask-when-uncertain.md)
   vague-trigger patterns. These become the rows of the
   [`contract-decision-sheet`](contract-decision-sheet.md), rendered inside the
   summary below — one numbered block, a default per row, and an
   accept-all-defaults path. Loading is part of this derivation, not of any
   command, so every consumer of the contract inherits the sheet. The locked
   classes (`high_impact`, `user_required`) never become rows: they escalate
   during the run, at the moment they fire.

## 2. Contract summary — shown once, confirmed once

```
Roadmap: <path> · mode: <autonomous | phase-checkpoints>

Git: branch <feat/<roadmap-slug>> · commits: chunked (N commit steps
     detected / delivery commits) · push: to feat/<roadmap-slug> ONLY
     · PR: open against <default branch> (description only — no merge)
Artifacts: <N> planned (skills/rules/commands/guidelines) —
     batched overlap check: <result — run NOW, against current state>
Open questions: <N> → decision sheet below (<M> rows); the rest via AI
     council (<members | "none configured — will halt on ambiguity">)
Quality: <cadence> · Dashboard: <cadence>
Late artifacts: <halt | auto-research> (default halt; cap 3 then halt)
Deferred items: <wait | spawn-follow-up-draft | cancel-with-memo> (default wait)

<decision sheet, per contract-decision-sheet — omitted entirely when M = 0>

Always active regardless of this contract (never lifted):
  • Hard Floor per-commit diff gate (bulk deletions / infra)
  • Push anywhere except feat/<roadmap-slug>; any merge
  • security-sensitive-stop on auth/billing/tenant/secret paths
  • N=3 validation budget · context-hygiene read-loop abort
  • Deferred-[~] archival gate

1. Accept — run under this contract
2. Adjust (name the change) · 3. Run interactive instead · 4. Abort
```

Accept = the ONE authorization of the run. Cache all grants; never
re-ask inside the run. Adjust → apply, re-show once. The contract is
re-derived on every invocation — it always reflects the roadmap's and
repo's current state.

### 2a. `late_artifacts` — what happens to an artifact the plan did not name

An artifact discovered **after** Accept was outside the batched overlap check,
so the research the contract summary reported does not cover it. Two policies,
and the field is on the screen because the choice changes what the run may do
without asking:

| Value | Behaviour |
|---|---|
| `halt` (**default**) | The run stops at the discovery with the scope-out-of-roadmap halt. The artifact is reported, not authored. |
| `auto-research` | The run re-runs Phase B (Research) and the overlap pass mid-run against the *current* artifact state — the identical procedure already accepted as non-interactive at contract time, only later. An **extend** verdict extends silently; a **create** verdict derives its understand-answers from the step text and the sheet answers; only a genuine overlap conflict halts. Capped at **three** late artifacts per run, then halt regardless. |

<!-- decision 2026-08-20: the shipped default is `halt`, not `auto-research`.
     AI council 2/2 (anthropic + openai) on the `autonomy-defaults-sheet` fork
     of road-to-user-out-of-the-loop, record
     agents/evidence/council/drain-blocker-dispositions-a.md. Reasoning: the
     roadmap's own Risk 7 is that auto-research drifts the run's scope, and its
     stated mitigation is the cap — but a cap of three is a bound on how far the
     drift goes, not a check on whether it should happen at all. `halt` is also
     the behaviour the tree already had, so shipping it as the default means
     this field is purely additive: nothing that worked before changes, and the
     aggressive path becomes a thing a run declares rather than a thing it
     inherits. Reversibility: flipping the default is one word in this table
     plus one word in the mechanics guideline, with no dependent mechanism to
     unwind, and the roadmap's own kill criterion (late-artifact revisit rate)
     only becomes measurable once some runs declare `auto-research` — which an
     opt-in still permits and a silent default would have made unattributable. -->

The cap is not negotiable by the field: a run that keeps discovering artifacts
has a planning problem, not an autonomy problem, and the third discovery is the
signal to say so.

### 2b. `deferred_policy` — the two autonomous exits for a `[~]` item

[`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md) Iron Law 3
forbids a silent archive with unresolved deferred items. That gate is
unchanged. What this field changes is which dispositions a run may reach
**without a synchronous prompt**, and there are exactly two, because the
preservation test in that rule already splits them the same way:

| Value | Behaviour |
|---|---|
| `wait` (**default**) | The synchronous halt stands. Every disposition stays conversational. |
| `spawn-follow-up-draft` | A roadmap closing with `[~]` items spawns the follow-up draft automatically, carrying each item **and** its blocker. The item stays alive in the active estate, which is what makes this council-decidable rather than owner-reserved. |
| `cancel-with-memo` | An item the run can show is no longer wanted is recorded `[-]` with a reasoning memo naming what changed. This is a **drop**, so it is owner-reserved by the preservation test: the run WRITES the memo and the recommendation, and the archive still waits for the user on that item. |

<!-- decision 2026-08-20: the policy offers BOTH exits — a follow-up draft and
     an explicit cancellation with a reasoning memo — not the follow-up draft
     alone. AI council 2/2 (anthropic + openai), same record as above.
     Reasoning: follow-up-draft-only means every deferred item must be carried,
     and a carried item nobody wants becomes the parking lot the roadmap's own
     Risk 5 describes for memos. Offering cancellation makes "this is no longer
     wanted" a statable outcome with a written reason instead of an indefinite
     deferral wearing a follow-up roadmap. Reversibility, and it is the load-
     bearing half: the cancellation exit does NOT lower the gate, because a
     drop stays owner-reserved — the run produces the memo, the user still
     decides. Removing the value later removes an option nobody was obliged to
     use; the default stays `wait` either way. -->


### 2c. `traceability` — requirement to acceptance to evidence, OPTIONAL

**Optional for every complexity, including `structural`.** Absent means *not
declared*, which is a different claim from "there is no requirement". Nothing
fails for omitting it, and no gate enforces it — the only consumer is a listing
inventory (`check_requirements_trace`) that exits 0 always. Requiredness is
deliberately **not** decided here (AI council 2/2, 2026-08-22): deciding it
before the listing phase has produced a count is deciding it on intuition.

A repeated **row**, not three flat fields:

```yaml
traceability:
  - requirement_id: pointer-reaches-the-worker
    acceptance_id: pointer-under-line-cap
    evidence_refs:
      - src/scripts/dispatch_r2_reviewer.ts
```

Three flat top-level fields would be **countable but not traceable**: with more
than one requirement and a shared pool of refs the relation is an ambiguous
many-to-many, so a gate could report a populated count while providing no
dependable trace. The row carries the relation.

Both grammars are reused, never invented — the claim-ledger kebab slug
(`docs/CLAIMS.md` § Entry schema) for the two ids, and the envelope ref-token
rule (`_lib/subagent_response.ts`) for `evidence_refs`: ref tokens, never
bodies.

Identity semantics, revision semantics, the three senses of "gate" and the
`[AC:<id>]` convention — including the verified fact that nothing parses
`verify:` lines structurally today — are in
[`guideline:agent-infra/traceability-field-mechanics`](../../../../docs/guidelines/agent-infra/traceability-field-mechanics.md).
They are not optional reading: a slug grammar does not imply a namespace, and
`evidence_refs` are syntactically safe tokens rather than verified evidence.

## 3. Grants activated by acceptance

| Grant | Boundary |
|---|---|
| Create feature branch `feat/<roadmap-slug>` (or reuse the current worktree branch) | Never a prod trunk; one branch per run |
| Chunked commits on that branch | Per-commit Hard-Floor diff gate stays ([`commit-mechanics`](../authority/commit-mechanics.md)); agent picks the split per [`commit-policy`](../../rules/commit-policy.md) |
| Push to that branch **only** | Push to any other ref = Hard Floor, ask |
| Open ONE PR (description-only flow) | Never merge, never close/retarget; merge is always conversational |
| Batched artifact drafting | The drafting-protocol **Research/overlap pass runs NOW at contract time against current artifact state**; results cached; Understand/Draft phases run non-interactively during the run. Artifacts NOT in the batch still trigger the interactive protocol |
| Council auto-enable | In-run open questions route to the AI council silently; `high_impact` / `user_required` classifications STILL escalate to the user per [`ask-when-uncertain`](../../rules/ask-when-uncertain.md). **No council configured** → the contract summary says so and in-run true ambiguity halts (never silent guessing) |

**`process-full` only — added by ADR-237**, because a delegation that ends at
the PR has to be able to reach one:

| Grant | Boundary |
|---|---|
| Update the PR after opening it — title, body, further pushes to the same branch | Still never merge, close or retarget |
| Reversible repository / branch settings the agent can change (branch protection included) | Only settings this run needs to reach a reviewable PR, and only reversible ones; a setting the agent changes it also restores if the run's need ends |
| Start, re-run and fix CI; update the merge base; resolve conflicts | Standard git and CI operations on the run's own branch |
| Install project-local dependencies | Inside the repo; never a global or system package manager without its own confirmation |
| Any tool, CLI, API, model, council or external service the work needs | Cumulative **USD 25** per run of variable spend; over that, the owner is asked BEFORE crossing. Uncertainty is not a reason to ask. Marginal cost of an existing subscription is $0. Splitting spend across services, subagents or rounds to keep each item under the ceiling is a violation |

These grants satisfy [`scope-control`](../../rules/scope-control.md)'s
"standing instruction" clause for the run — see
[`scope-mechanics § Roadmap execution contract`](../authority/scope-mechanics.md).

## 4. Definition of done, per mode

| Mode | End state | Halts during run |
|---|---|---|
| `autonomous` | All steps `[x]` · quality green per cadence · work committed in chunks on `feat/<roadmap-slug>` · pushed · PR open · archival sweep run. **Merge out of scope, always.** | Safety floors only (+ quality-red, + step reveals out-of-roadmap work) |
| `phase-checkpoints` | Same end state | Safety floors + a compact status + "continue?" prompt at each phase boundary |
| `interactive` (derived, never from an absent field) | Legacy: work lands, no git delivery without per-op permission | All gates as authored by their owning rules |

If the roadmap contains **no** delivery need and no commit steps, the
git grants are omitted from the contract (nothing to authorize —
[`commit-policy`](../../rules/commit-policy.md) default: never commit).

## 5. What acceptance can NEVER cover

**ADR-237 widens § 3 and leaves this section untouched — deliberately.** An
end-to-end delegation is tolerable precisely because a PR is reviewable before
it merges, so the boundary that keeps merging out is the one that makes the rest
safe. Nothing below is reachable by any invocation.

- Any [`non-destructive-by-default`](../../rules/non-destructive-by-default.md)
  trigger beyond the two named grants (own-branch push, PR-open):
  prod-trunk anything, deploys, bulk deletions, infra commits.
- Merging, closing, or retargeting a PR.
- Lifting [`security-sensitive-stop`](../../rules/security-sensitive-stop.md),
  the N=3 budget, context-hygiene aborts, or the deferred-`[~]` gate.
- Work outside the roadmap's scope (halt: scope-out-of-roadmap).
- Kernel-rule edits' own-PR + 24h-soak guarantee
  ([`kernel-rule-edits`](../authority/kernel-rule-edits.md)).
