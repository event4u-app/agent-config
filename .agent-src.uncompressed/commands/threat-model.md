---
name: threat-model
skills: [threat-modeling, authz-review, security-sensitive-stop]
description: Run a pre-implementation threat model on a proposed change — enumerates abuse cases, trust boundaries, and authorization gaps before the first line of code is written
disable-model-invocation: true
---

# threat-model

## Instructions

Produce a structured threat model for the proposed change **before any code
is written**. Dispatches to [`threat-modeling`](../skills/threat-modeling/SKILL.md)
for abuse-case and trust-boundary analysis, and to
[`authz-review`](../skills/authz-review/SKILL.md) whenever the change touches
authorization, tenancy, or identity.

### 1. Gather the context

Collect, from the user or from the current branch:

- **Change description** — what is being added or modified, in plain language
- **Entry points** — routes, commands, queue handlers, webhooks that receive
  the input
- **Data touched** — tables, columns, storage, external APIs that are read
  or written
- **Actor** — who invokes this (authenticated user, tenant-scoped user, admin,
  anonymous, service account, cron)

If any of the four is missing, **ask the user** — do not guess. A threat model
built on assumed context is worse than no threat model.

### 2. Decide which skills to dispatch

| Change touches | Skills to run |
|---|---|
| Any new or modified surface (default) | [`threat-modeling`](../skills/threat-modeling/SKILL.md) |
| Permission checks, tenancy, ownership, role logic | + [`authz-review`](../skills/authz-review/SKILL.md) |
| Secrets, tokens, credentials, signing keys | + [`security-audit`](../skills/security-audit/SKILL.md) |

`threat-modeling` is always mandatory. `authz-review` is mandatory when the
change crosses an authorization boundary — when in doubt, run it.

### 3. Dispatch mode

- **Sequential** (default) — `threat-modeling` first, then `authz-review` if
  applicable. The authz findings often reference abuse cases from step 1.
- **Parallel** — allowed only if `subagent_max_parallel` ≥ 2 in
  `.agent-settings` and both skills are available as subagents. Merge their
  reports in step 4.

Each skill produces its own structured output (abuse-case table, trust
boundary list, authorization matrix). Do not rewrite those blocks — pass
them through verbatim.

### 4. Consolidate

Produce one combined report with these sections, in order:

1. **Change summary** — the four context items from step 1, restated as the
   agent understood them
2. **Abuse cases** — from `threat-modeling`, severity-sorted (🔴 → 🟡 → 🟢)
3. **Trust boundaries** — entry points and what is trusted vs. untrusted at
   each one
4. **Authorization findings** — from `authz-review` if it ran, else a single
   line: `authz-review skipped — change does not cross an authorization boundary`
5. **Required controls** — the minimum set of validations, authorization
   checks, logging, and negative tests that must exist before the change ships
6. **Open questions** — anything the skills flagged as uncertain and the user
   must answer before implementation starts

### 5. Decide next step

After the report, ask:

```
> 1. Looks right — proceed to implementation against this threat model
> 2. Something is wrong or missing — I'll revise the context and re-run
> 3. Stop here — threat model is the deliverable, no implementation yet
```

- On **1**: hand off to the implementation flow (e.g., `feature-plan`,
  `bug-fix`, or direct edit) with the required-controls list pinned
- On **2**: re-gather context and re-dispatch
- On **3**: save the report as the deliverable, stop

## Use this command when

- Starting a feature that touches authentication, authorization, tenancy,
  secrets, external input, or sensitive data
- The [`security-sensitive-stop`](../rules/security-sensitive-stop.md) rule
  fired and the user asks for the structured analysis
- A PR reviewer asks for a threat model as a prerequisite
- Before a change to a trust boundary (API endpoint, webhook, queue consumer,
  middleware, policy)

## Do NOT

- NEVER skip `threat-modeling` — it is the entrypoint, not optional
- NEVER produce a threat model on guessed context — ask for the four items
  in step 1 if any is missing
- NEVER merge `threat-modeling` and `authz-review` outputs into a single
  block — each skill owns its format
- NEVER write production code in the same turn as this command — the
  deliverable is the report; implementation is a separate step
- NEVER mark the change "safe" if any 🔴 abuse case has no control

## See also

- [`threat-modeling`](../skills/threat-modeling/SKILL.md) — abuse cases, trust boundaries
- [`authz-review`](../skills/authz-review/SKILL.md) — end-to-end authorization analysis
- [`data-flow-mapper`](../skills/data-flow-mapper/SKILL.md) — trace specific data through the change
- [`blast-radius-analyzer`](../skills/blast-radius-analyzer/SKILL.md) — enumerate affected call sites
- [`security-sensitive-stop`](../rules/security-sensitive-stop.md) — the trigger rule
- [`minimal-safe-diff`](../rules/minimal-safe-diff.md) — keep the implementation scoped
