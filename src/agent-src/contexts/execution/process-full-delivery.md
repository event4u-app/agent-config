# /roadmap:process-full — Branches

Branch-only body of the [`/roadmap:process-full`](../../commands/roadmap/process-full.md)
command. Each section is loaded from the command's pointer line only when the
run takes that branch — `--all` and its lanes, gated residue, the six-layer
detail, `--merge`, `--worktree`, the halt detail, terminal outcomes and the PR
body, the final report shape, spend, and the dashboard rationale. The Iron Laws
stay in the command; this file carries the moved explanatory text verbatim.

### The six required layers, in order, each with the command that runs it

`road-to-adversarial-verification-and-long-runs` 3.1. Correctness is owned by the
forge and CI, not by an owner reading a diff — so the layers are named, ordered,
and each one carries the command that produces its verdict. A layer with no
command is a claim; a layer with one is a check.

| # | Layer | Command that runs it |
|---|---|---|
| 1 | A targeted local RED, then GREEN | the test runner filtered to the failing name — `npm run test:ts -- <file>`, never the suite |
| 2 | Quality scoped to the changed surface | the type-checker and linter over the diff — `npm run typecheck`, the linter on changed files |
| 3 | Per-phase fast CI | `roadmap.quality_cadence: per_phase` (Phase 0.2) at each phase boundary |
| 4 | The final full required CI | `npm exec --no -- agent-config ci:settle <PR> --timeout-min 28`, run as a BACKGROUND job — its LAST OUTPUT LINE is the verdict |
| 5 | Forge branch protection | `agent-config doctor --json` → `forge_protection` (Phase 3.2), read from the forge |
| 6 | Final-head verification | `ci_settle`'s verdict line names the head; it must be the head that was pushed last |

**Layer 1 before layer 2 before layer 3, and the order is the substance.** Each
layer is cheaper and narrower than the one after it, so running them out of order
spends the expensive verdict on a failure the cheap one would have named. A run
that reaches layer 4 with layer 1 unrun has not saved a step; it has moved the
same failure to where it costs a CI cycle.

That last line is not a courtesy. Size is the one property of a diff that
correlates with nothing a reviewer can check mechanically, and gating on it is
how *ask the owner* re-enters through a door marked prudence — which is the loop
ADR-268 § 0 is trying to end. Gate on the five conditions above, which are
falsifiable, and never on how big the change looks.

**A disabled required check cannot reach delivery-ready**, and that is the
condition to test rather than assert: a PR whose required context is skipped has
a green rollup and an unenforced gate, so a delivery-ready test that reads only
the rollup passes exactly when it should fail.

### `--merge` — merging, on the owner's word only (ADR-282)

The owner settled the half of
ADR-239 (agent-config repository: `docs/decisions/ADR-239-drain-command-surface-and-merge-authority.md`)
§ Disposition that ADR-266 left open:
ADR-282 (agent-config repository: `docs/decisions/ADR-282-auto-merge-authority-with-a-council-danger-gate.md`).
An explicit auto-merge instruction is the this-turn confirmation
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md)
requires for the production-branch merge of a **routine** PR. Delivery runs
`/pr:merge <N> --merge`, whose § 9a danger gate (`classify_merge_risk`) decides:
`routine` → squash-merge bound to the observed head; `needs-council` → a neutral
council review, merge only when both seats say *not dangerous, owner review
unnecessary*, otherwise hand the PR back with the seats' reasons; `needs-owner`
(the gated surface, the reviewer's trust chain, or an owner-reserved ADR) →
no council, hand it back
with its triggers. § 9a runs the base revision's classifier, never the head's.

ADR-268 § 3's object-bound `prod_merge` grant stays a separate, unchanged path.
A standing autonomy directive or momentum is **neither**. Deploy, release and
every other Hard-Floor action keep their own confirmation.

**Mergeability is per-PR against a recorded base, never a queue property.**
When every PR in the estate touches the same generated files — in this
repository `agents/roadmaps-progress.md` and the archive index — making PR *n*
mergeable against base
SHA `M` says nothing about its state once PR *n−1* advances the base to `M1`.
Report "mergeable against base `<SHA>`", never "the queue is mergeable".

## Terminal outcomes — `complete`, or a genuine external impossibility

**Rewritten by ADR-237 (agent-config repository: `docs/decisions/ADR-237-end-to-end-execution-authority.md`),
which supersedes ADR-235.** The prior version measured twelve nearly-complete
roadmaps and found that **zero** could reach `count_open == 0` in one PR, because
every remaining step needed "a human action". That census was sound; the reading
of it was not. It counted actions a human *conventionally* performs without
asking, per action, whether a human was **necessary**. Most of that list — flip a
branch setting, push, open a PR, re-run CI, update a merge base, fix a failing
test, authorise spend inside a budget — is machine-executable by the agent, and
is therefore remediation work rather than a blocker.

### `complete` requires DELIVERY, not only checkboxes

`road-to-adversarial-verification-and-long-runs` 8.1. The delivery machine is
`working → local-green → pushed → pr-open → ci-pending → (red → the recovery
ladder → pushed | green) → target-sync-check → (moved → sync → tests → pushed |
current) → delivery-ready → (grant → merged | no grant → open-green)`.

`run_continuation_hook` read the position the run RECORDED — it did not probe
the forge, because a `gh` call on the stop path is the cost the premise rung
already declined — and any position that was not an ending kept the run engaged
at zero open steps. **That concern was withdrawn on its own pre-registered kill
date (`road-to-what-was-built-and-never-ran` Phase 4), so nothing re-engages a
run automatically any more.** Its termination ladder, `_lib/continuation_ladder.ts`,
was removed on 2026-10-14 by owner decision; what it encoded survives here as
the shape a successor inherits, not as a mechanism in the tree. Two bounds held a
delivery hold, and one was deliberately lifted: the iteration and wall-clock caps
still ended it, while the **stall** rung was skipped, because during delivery the
open-step count it measures cannot move and a metric that cannot move is not a
stall signal.

Said in a fence because the surrounding prose reads as a description of live
behavior and an independent review of the change that introduced it read it
exactly that way. The run that owes a delivery ending checks it itself before it
reports `complete`; nothing in the tree reads a recorded position any more.

**`open-green` is a success, not a shortfall.** A run with no merge grant is not
supposed to merge; what it owes is an open PR whose CI is green **on the head CI
actually observed**, and a report that says so.

### The PR body is one page for the owner's review

8.2. The end-of-run PR body carries these six, each as its own named section:

1. **Delivery target reached** — `merged` or `open-green`, and the head SHA CI observed.
2. **Decisions taken, and by whom** — agent, council, team or owner, per decision.
3. **Open owner-owned residue** — what is left that only the owner can settle, or *none*.
4. **Scope delta** — what the run added to or dropped from the roadmap's stated scope.
5. **Spend** — actual against the authorised ceiling.
6. **Fix-loop epochs** — how many strategies were opened, and what ended each.

Six sections because each answers a different question the owner would otherwise
have to ask, and a run that omits one has moved that question back into the
conversation this roadmap exists to end.

| Outcome | When | Success? | terminal state |
|---|---|---|---|
| `complete` | `count_open == 0`, the PR is open, and delivery reached an ending | yes — archival check runs | `success` |
| `blocked` | every remaining open step is **externally impossible** for the agent | **no** — partial progress, labelled as such | `blocked`, or `approval-required` where the work is finished and waiting on a human |
| a halt | one of the five conditions fired | **no** — the halt is reported | `exhausted` when a declared budget ran out; `stagnated` when the same failure signature repeated with budget left |

**The closing report names the terminal state by word**, from
[`terminal-states`](terminal-states.md).
The reason is the failure that vocabulary exists to stop: a run that stopped at
its iteration cap and one that finished both leave the roadmap looking the same,
because the checkbox glyphs cannot express `exhausted`, `stagnated` or
`approval-required` — they collapse into `[ ]` and `[~]`. Three of the six states
are therefore invisible in the dashboard and visible only in the report, which is
why the report has to say the word.

`exhausted` and `stagnated` are **never** reported as `complete`, whatever
partial progress exists, and they are kept apart on purpose: `exhausted` says the
budget may have been too small and raising it is a legitimate response;
`stagnated` says more of the same will not help and raising it is the wrong one.

`blocked-preflight` no longer exists. A run always starts.

**What counts as externally impossible** — the whole list:

- a required credential does not exist and the agent cannot create it;
- a purchase beyond the delegated budget (see § Spend below);
- physical access to hardware;
- another person or organisation must act;
- a wait that is factually mandatory and cannot be simulated or verified.

**What does NOT** — every one of these is work:

an unprotected branch · a branch to create · a PR to open · a repository or
branch setting the agent can change · a workflow to start · CI to re-run · a
merge base to update · conflicts · failing tests · local configuration · a paid
call under the ceiling · "this could be risky" · "a maintainer should do this".

**It is a terminal outcome, not a halt, and the separation still matters.** The
Iron Law above and its forbidden list keep their full authority over mid-run
stopping: an agent that may not stop for "this phase is large" may equally not
stop for "this step looks human-gated" — and under ADR-237 that phrase is no
longer even a candidate, because the test is capability, not convention.

## Final-PR-only — the UX invariant

A missing setting, a CI re-run, a protection flag, a rebase, a council call: do
them, and say so in the PR body if it matters. The only mid-run interruptions
that remain legitimate are a spend-ceiling crossing and an EXCLUDED-list action
(production trunk, deploy, prod data/infra, an irreversible external action
beyond the PR). One carve-out from "do them": a rebase of a branch that is
already pushed rewrites published history, and still needs the user's answer
this turn per `git-history-discipline` § When rewrite is allowed — the
invocation does not give it, and neither does `git.update_strategy: rebase`,
which picks the operation and never authorises it. Without that answer the
branch is left behind and the PR body says so.

Report shape:

```
PR #<n>
<url>

Roadmap fully implemented. CI <passed>/<total>.
```

or, in the genuine exception:

```
Unable to produce the final PR.
Hard external blocker: <specific reason>
Attempted: <what was tried>
```

## Spend — whatever ceiling was configured, and none when none was

**Who carries this, stated plainly: the model, not a gate.** Nothing on a
roadmap run reads a cumulative spend figure and compares it with anything —
ADR-237 said so of its own ceiling ("Nothing mechanical checks any of this")
and that has not changed. The optional `cost.enforcement: hard-stop` preflight
is a separate, deliberately-invoked control and is not called from a run. So
this block is an obligation the model carries, and a reader should not take it
for an enforced limit.

What used to sit here was a flat per-run USD constant that nobody configured.
ADR-279 replaced it with the windows a person actually set, which is the only
kind of ceiling this package now applies; that record names the old figure, and
this file deliberately does not, so no reader mistakes a historical number for
a live threshold. Set `cost.budgets.daily` / `weekly` / `monthly` to get one.

The transport is not a governance boundary: a council invocation is the same
authorised action whether it runs through the `council` CLI or a direct API call.
There is deliberately **no allowlist** of blessed services — the general rule
(machine-executable · in scope · under the ceiling) already contains every case,
and an allowlist would rot.

## Real-time dashboard

`/roadmap:process-full` is the worst offender for batching because it
runs continuously across many steps. Flipping all 13 boxes in the
single archive commit defeats the dashboard's purpose — the user
loses progress visibility for the entire run. Per Iron Law 2 of
[`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md): the
flip + regen pair is atomic with the step's work, executed inside
[`roadmap-process-loop § 5`](roadmap-process-loop.md#5-step-loop)
step 5.
