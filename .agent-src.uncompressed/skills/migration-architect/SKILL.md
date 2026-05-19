---
name: migration-architect
description: "Use when shaping a non-trivial migration — rollout phases, dual-write windows, cutover sequencing, deprecation cycles — hands off to the framework-specific migration skill for DDL once locked."
personas:
  - backend-architect
  - senior-engineer
source: package
domain: process
workspaces:
  - engineering
packs:
  - engineering-base
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# migration-architect

> Shape the **rollout strategy** for a migration before any DDL or
> code is written. Plans phases, dual-write windows, cutover
> sequencing, deprecation cycles, and cross-service coordination.
> Hands off to [`laravel-migration`](../laravel-migration/SKILL.md)
> (or the framework-native equivalent) for tactical DDL once the plan is locked.

## When to use

- A schema change spans more than one deploy.
- A change requires a dual-write or backfill window.
- The migration touches multiple services, queues, or consumers
  whose order of update matters.
- A column / table / API is being deprecated and the cycle needs
  shape (announce → soft-fail → hard-fail → remove).

Do NOT use when:

- The change is a single additive migration safe in one deploy →
  route to [`laravel-migration`](../laravel-migration/SKILL.md) (or framework-native equivalent).
- The decision is *whether* to migrate at all → route to
  [`decision-record`](../decision-record/SKILL.md) first.
- The concern is data correctness during the migration → route to
  [`data-flow-mapper`](../data-flow-mapper/SKILL.md) and feed
  findings back here.

## Procedure

### 1. Anchor on the goal

Write one sentence: *"State X must become state Y across systems Z
without breaking consumers W."* If you cannot, the migration is not
ripe — stop.

### 2. Identify the participating systems

List every service, queue, batch job, third-party consumer, and
client that reads or writes the affected schema. A system you
forget is a cutover surprise.

### 3. Pick a rollout shape

| Shape | When to pick |
|---|---|
| Expand → migrate → contract | Schema additive first, code switches reads, then drop old shape |
| Dual-write + backfill | Both shapes written for a window; backfill closes the gap |
| Strangler fig | New path runs alongside old; traffic ramps over time |
| Big-bang cutover | Rare; only when downtime is acceptable AND coordination cost is trivial |

State *why* the shape fits — not just which one was picked.

### 4. Sequence the phases

For each phase, list:

- **Trigger** — what condition starts it.
- **Actions** — DDL, code deploy, feature flag, traffic shift.
- **Reversibility** — can we abort here, and how?
- **Exit gate** — what proves we can move to the next phase
  (metric, sign-off, soak time).

A phase without an exit gate is a wish; reject.

### 5. Plan the deprecation cycle

For anything being removed:

- Announce window — comms cadence, who is told.
- Soft-fail window — log + warn, do not break.
- Hard-fail window — return errors.
- Removal — DDL drop, code delete.

Each window has a duration and a metric that justifies moving on.

## Output format

```
Migration Architect
Goal:     <one sentence>
Systems:  <list>
Shape:    expand-migrate-contract | dual-write | strangler | big-bang
Reason:   <why this shape>

Phases:
  1. <name>  Trigger: <cond>  Exit: <gate>  Reversible: yes | costly | no
       Actions: ...
  2. ...

Deprecation cycle (if any):
  Announce <duration>  →  soft-fail <duration>  →  hard-fail <duration>  →  remove

Next: /laravel-migration (or framework-native equivalent) for the DDL of phase 1
```

## Gotcha

- The riskiest phase is the one with no rollback. Surface it
  explicitly even if the user did not ask.
- Soak times in hours when interest is in days are a smell. Match
  the soak to the actual blast radius.

## Do NOT

- Do NOT write DDL — that is the framework-specific migration skill's job (`laravel-migration` for Laravel).
- Do NOT collapse phases to "ship it" because the user is impatient;
  surface the risk and let the user decide.
- Do NOT skip the deprecation cycle because nobody is using the old
  shape "for sure" — verify before skipping.
