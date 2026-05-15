---
name: launch-readiness
description: "Use before merging a release-shaped PR — pre-merge checklist, rollout plan, rollback criteria, ops handoff. Triggers on 'ready to ship', 'launch checklist', 'rollout plan for X'."
status: active
tier: senior
source: package
domain: process
context_spine: [team, product]
recommended_for_user_types: [ops, developer, founder]


---

# launch-readiness

## When to use

- A change is about to merge that crosses a release boundary (new feature on `main`, version bump, public-facing comms attached).
- An ops handoff is implied — the on-call rotation, support team, or downstream consumers need to know.
- A rollback criterion has not been written down yet.

Do NOT use for routine internal merges
([`finishing-a-development-branch`](../finishing-a-development-branch/SKILL.md))
or for the comms text itself ([`release-comms`](../release-comms/SKILL.md)).
This skill produces the **decision** to ship and the rollback contract.

## Cognition cluster

- **Mental model 10 — Reversible vs irreversible.** Map every step
  of the rollout to a reversibility class; the rollback criteria
  must name the irreversible steps and the abort threshold for each.
  See [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 10.
- **Mental model 29 — Pre-mortems.** Imagine the rollout failed in
  six hours; what failed first? The pre-mortem becomes the rollback
  criteria, not a separate document. See `mental-models.md` § 29.
- **Mental model 4 — Second-order thinking.** Enumerate what
  becomes harder *after* the launch (rollback cost, contributor
  ergonomics, doc churn). See `mental-models.md` § 4.
- **Team + product context-spine slots.** Read **team** for the
  on-call rotation and ops handoff path; read **product** for the
  segment / cohort exposure of the rollout. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### 1. Identify the launch shape

One sentence: *"This change ships **X** to **segment Y** behind
**rollout mechanism Z**."* If you cannot, the change is not
release-shaped; route to `finishing-a-development-branch`.

### 2. Inspect the pre-merge checklist

Walk the diff with the following gates:

- Tests green on the integration suite (cite the run).
- Quality gates green (PHPStan / linters / type-checks).
- Migrations are reversible OR the irreversibility is explicit.
- Feature flag / kill switch named, default off unless intended.
- Doc / changelog / release notes present (hand off to
  [`release-comms`](../release-comms/SKILL.md) for the prose).
- Rollback path tested at least mentally; named in step 4.

Cells without evidence block the launch — surface, do not
hand-wave.

### 3. Plan the rollout

- **Mechanism** — flag, canary cohort, blue-green, immediate.
- **Order** — internal → trusted segment → general; cite the
  segment per stage from the **product** spine slot.
- **Telemetry** — the metric that **proves** rollout health.
- **Owner** — named role per stage (not name); from the **team**
  spine slot.

### 4. Write rollback criteria

For each stage:

- **Trip wire** — the metric value that fires rollback.
- **Decision window** — how long the trip wire must hold.
- **Abort path** — what the on-call does (revert PR, flip flag,
  drain queue), pre-rehearsed.
- **Irreversible steps** — explicit list; if any irreversible step
  is in scope, the launch needs a written sign-off, not implicit.

Pre-mortem rule: every trip wire must answer *"what would have
caused this in six hours?"* If you cannot, the trip wire is wrong.

### 5. Ops handoff

- Who is paged on which alert (from **team** spine slot).
- Where the rollback runbook lives (link).
- Date / time of the handoff conversation; sign-off from the
  receiving role.

### 6. Hand back

Hand the artefact below to whoever requested the launch decision;
route comms to [`release-comms`](../release-comms/SKILL.md) and
post-launch metrics tracking to the team's monitoring stack.

## Related Skills

**WHEN to use this**

- A release-shaped PR is about to merge.
- Rollback criteria need to land in writing before the merge button
  is pressed.
- Ops handoff is implied and not yet executed.

**WHEN NOT to use this**

- The change is internal and routine — route to
  [`finishing-a-development-branch`](../finishing-a-development-branch/SKILL.md).
- The output is the public comms — route to
  [`release-comms`](../release-comms/SKILL.md).
- The rollout decision involves stakeholder conflict — route to
  [`stakeholder-tradeoff`](../stakeholder-tradeoff/SKILL.md) first.
- The decision is reversible-and-cheap — write a one-line note,
  skip the full artefact.

## When the agent should load this

- "Sind wir launch-ready?"
- "Bau mir die Rollback-Kriterien für Phase X."
- "Ops-Handoff für die Release morgen."
- "Was bricht, wenn wir den Flag flippen?"
- "Pre-merge-Checklist für PR #N."

## Output

1. **Launch shape** — one-sentence statement of the change.
2. **Pre-merge checklist** — gate · status · evidence (citation).
3. **Rollout plan** — stages × mechanism · order · telemetry · owner.
4. **Rollback contract** — per stage: trip wire · decision window ·
   abort path · irreversible steps.
5. **Ops handoff** — pager mapping · runbook link · sign-off.
6. **Outstanding** — anything blocking the launch; explicit, not
   collapsed.

## Gotcha

- A checklist with all green and no citations is theatre; every
  green needs an artefact.
- A trip wire without a decision window is unactionable — *"if
  errors spike"* is not a trigger; *"5xx > 2% for 10 min"* is.
- Irreversible steps without written sign-off are the most common
  post-mortem ancestor — surface, do not skip.

## Do NOT

- Do NOT write the comms text here — that is `release-comms`.
- Do NOT lock the rollback contract verbally — it lives in the
  output block, citable.
- Do NOT let any stage own itself — every stage names a role from
  the **team** spine slot.
- Do NOT hand the artefact to a receiver who has not signed off on
  ops handoff.
