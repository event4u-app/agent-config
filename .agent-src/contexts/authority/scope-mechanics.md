# Scope Mechanics

Loaded by [`scope-control`](../../rules/scope-control.md). Holds the
detail behind the Hard Floor restatement, the brief-before-asking
flow for separate-branch proposals, and the failure modes / bypass
rules around fenced steps.

**Size budget:** ≤ 4,000 chars. Tracked under Phase 6 of
`road-to-pr-34-followups`.

## Production, infrastructure, bulk-destructive — Hard Floor

A subset of the git-ops Iron Laws is **never** autonomous and never
auto-permitted by a standing autonomy directive. Canonical rule:
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md).
Restated here so `scope-control` remains the single read for git/scope
concerns:

- **Production-branch merges** — `main`, `master`, `prod`,
  `production`, `release/*`, or any branch the project marks as
  deployment trunk. Always ask, even when the roadmap step says
  "merge".
- **Deploys / releases** — `terraform apply` / `kubectl apply` on
  prod, deploy scripts, release commands, tag pushes that trigger
  CI deployment. Always ask.
- **Production data / infrastructure** — prod DB writes or
  migrations, prod config edits, secrets rotation, IAM / role /
  policy changes, DNS edits, anything in a `prod`-scoped path or
  pipeline. Always ask.
- **Bulk-destructive ops** — wildcard or directory deletion
  (`rm -rf <dir>`, `git rm -r`), `DROP TABLE`, `TRUNCATE`,
  `git reset --hard` past unpushed work, mass class / module /
  migration deletion, "delete everything matching X". Always ask.

A roadmap step or earlier turn does **not** count as authorization
for these. Authorization is "the user said so on this turn".

## Brief-before-asking — separate branch / PR / worktree

If a task seems to need a separate branch or PR (spike, hotfix,
experiment, worktree), STOP and **brief the user before asking**. The
brief MUST cover, in this order:

1. **Why** — what problem a separate branch solves that the current
   branch cannot; why staying on the current branch would be worse.
2. **What** — exactly what you plan to do on the new branch: files
   touched, prototypes built, experiments run, expected duration.
3. **How it continues** — the return path: merge back, cherry-pick,
   throwaway delete, PR target, how the current branch's state is
   protected while you work on the other one.

Then present numbered options (`user-interaction`) with "stay on the
current branch" as the default. The user decides. Do not branch
first and explain later.

## Decline = silence — context

The right moment to ask is **before** the work starts (writing the
roadmap, opening the ticket), not mid-execution. During roadmap
execution the branch question is settled; do not resurface it step
by step.

A proposal that "might be sensible" is not enough reason to ask.
Default: stay on the current branch, no release language. Only ask
when there's a concrete, evidence-based reason (e.g. risky migration
benefits from a spike branch). If in doubt, do not ask.

## Fenced step — failure modes

- Numbered-options block whose Option 1 is *"start with Phase 1 / E1.1
  / step X"*. The fence makes execution off-limits; offering it as the
  default choice violates the fence.
- Re-asking *"may I begin now?"* after delivering the plan. The user
  said no execution; that decision is binding for the rest of the
  task.
- Treating delivery as a hand-off **to execution** (*"roadmap is
  ready, kicking off E1.1"*) instead of a hand-off **to review**
  (*"roadmap is ready, over to you"*).
- Inferring *"plan accepted"* from a thumbs-up or short
  acknowledgement. Acceptance of the plan is not authorization to
  start; the user gives the green light explicitly when ready.

## Fenced step — bypass

A clear *"go ahead"*, *"start now"*, *"mach weiter"*, or an explicit
*"approved, implement E1.1"* on a later turn lifts the fence. Until
then: silence on execution.
