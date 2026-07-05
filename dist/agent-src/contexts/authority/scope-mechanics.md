# Scope Mechanics

Loaded by [`scope-control`](../../rules/scope-control.md). Holds the
detail behind the Hard Floor restatement, the brief-before-asking
flow for separate-branch proposals, and the failure modes / bypass
rules around fenced steps.

**Size budget:** soft cap ≤ 8,000 chars (context layer, on-demand
loaded). The mechanics file absorbs growth so `scope-control` stays
under the 4,000-char kernel ceiling.

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

Earlier permission for a different operation does **not** carry over —
permission is per-operation, this-turn. Standing autonomy directives
narrow other rules but never grant permission for items in this Hard
Floor subset.

## Roadmap shape — no release language

Forbidden in roadmaps / plans / tickets / any planning artifact:
version numbers (`v2.0`, `1.4.x`), target releases (`Q4 release`,
`Sprint 23`), deprecation dates tied to release calendars,
release-tied milestones (`launch milestone`, `GA`), and git tags
(`tag v1.2.0`).

Roadmaps plan **work**. Releases / tags / version pins are a
**separate decision** the user pins explicitly on the artifact that
owns release shape — changelog, release PR, tag annotation — not
buried inside a planning document. Authoring verbs (`create / draft /
write the roadmap`) authorize the planning artifact, not version
pinning inside it. If the user names a version in a planning
request, ask whether the artifact tracks the work or the release;
default to work.

## Roadmap execution contract — run-scoped standing permission

An **accepted run-start execution contract**
([`roadmap-execution-contract`](../execution/roadmap-execution-contract.md),
derived by `roadmap-process-loop § 3` when the roadmap declares
`execution.mode: autonomous | phase-checkpoints`) IS "explicit
permission … in a standing instruction not yet revoked" for
`scope-control § git-ops` — **for that run, and for exactly four
operations**:

1. Create the run's feature branch (`feat/<roadmap-slug>`, or reuse
   the current worktree branch).
2. Chunked commits on that branch (Hard-Floor per-commit diff gate
   stays; split per `commit-policy`).
3. Push to **that branch only** — any other ref stays Hard Floor.
4. Open ONE PR (description-only flow) — never merge / close /
   retarget.

Boundaries that survive every contract: the frontmatter field alone
grants **nothing** (declaration of intent — no accepted contract, no
grants); grants expire when the run ends or halts; prod-trunk
operations, deploys, bulk deletions, infra commits, and merges are
outside contract scope always; kernel-rule edits keep their own-PR +
24h-soak guarantee.

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

## Branch-base inventory — ALWAYS before starting work

Before the first commit on related work, scan: `git branch --show-current` (is this branch shaped for the task?), `gh pr list --state open --limit 10` (overlapping open PR?), `git branch --sort=-committerdate | head -10` (in-flight branch to extend?).

A plausible base beyond the current branch exists → STOP and ask with numbered options:

1. Branch off the **current branch** — stacked PR.
2. Branch off **`main`** — independent PR.
3. **Continue on the current branch** — extend the in-flight PR.
4. **Cancel**.

User decides. Default: **3** when the current branch's name and scope match the task; otherwise **2**. Never improvise the base.

**Failure mode — diverging stacked PRs.** Skipping the inventory and committing to the wrong base creates two PRs that should have been one stack: merge conflicts when the parent lands, rebase / force-push churn, duplicate review effort. The 30-second inventory cost up front beats hours of rebase reconciliation later.

**Failure mode — opening a PR on a stale long-lived branch.** A pre-existing feature branch (e.g. `feat/X` last touched days ago) is still "the current branch" but its base — `main` — has moved on. Auto-generated artifacts (`agents/roadmaps-progress.md`, ownership matrices, condensed mirrors, hash files) are the canonical collision surface: any merged PR on `main` touched them, and the stale branch's copy is now a content conflict by construction. Opening a PR without fetching `main` first surfaces conflicts only after `gh pr create` has already published the broken PR.

**Pre-PR freshness check — MANDATORY** (mirrored in [`/create-pr` Step 1b](../../commands/create-pr.md)). Before `gh pr create`:

1. `git fetch origin {target-base} --quiet`.
2. `git rev-list --count HEAD..origin/{target-base}` — commits behind base.
3. Count > 0 AND another open PR targets the same base → STOP and ask: stack on top / wait for parent to land / merge-main-into-branch / proceed-anyway-and-accept-conflicts / cancel.
4. Count > 0 AND no overlap → ask: merge-main / rebase / proceed-anyway / cancel.

User decides. Never silently `gh pr create` on a branch that is behind its base.

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


## Authoring vs. implementation — verb discipline

Restated detail for [`scope-control § Authoring vs.
implementation`](../../rules/scope-control.md). The Iron Law is in
the kernel; this is the worked-out catalogue.

**Authoring verbs** (artifact-only, never execution): `create`,
`draft`, `write`, `author`, `prepare`, `outline`, `entwirf`,
`erstelle`, `schreibe`, `vorbereite`. Deliverable: a roadmap file,
plan, ADR, ticket, design doc, or brief. Stop after it lands; let
the user pick the next move.

**Execution verbs** (then the executing rules apply): `implement`,
`build`, `ship`, `setze um`, `baue`, `arbeite ab`, `arbeite die
roadmap ab`.

**Worked examples**

- *"Create the roadmap for X"* / *"Erstelle die Roadmap für X"* →
  write the roadmap file, stop, hand back. Do **not** start
  implementing the steps it contains; do **not** create a feature
  branch for the work the roadmap describes.
- *"Draft an ADR for the auth refactor"* → ADR lands; auth refactor
  is a separate decision.
- *"Write the migration plan, then start with phase 1"* → mixed
  verbs. Default to authoring-only, ask which scope wins.

**Task-scoped autonomy carry-over**

A previous turn's standing autonomy for a *different task* does NOT
carry over. Concretely: *"arbeite eigenständig"* given for
"Roadmap A" is consumed when Roadmap A's deliverable lands. A new
named task (Roadmap B, ticket Y, "next slice") needs fresh
authorization. See [`autonomous-execution § task-scope`](../../rules/autonomous-execution.md#task-scope--autonomy-is-bound-to-the-named-task).
