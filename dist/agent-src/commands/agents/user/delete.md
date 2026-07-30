---
model_tier: medium
name: agents-user-delete
pack: meta
tier: 2
visibility: internal
cluster: agents
sub: user
skills: [agents]
description: Delete one buffered global observation, purge every observation attributed to a project, or revoke a field from the global profile.md — each writes an append-only tombstone before deleting.
argument-hint: "[observation <id> | project <path> | profile-field <field>]"
suggestion:
  eligible: false
  rationale: "Mutates the global observation buffer or profile.md — only run from /agents user review, /agents user show --audit, or explicit user invocation."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user delete

Delete something the learning channel wrote to the **global** layer —
road-to-global-user-memory Phase 4, the delete counterpart of
[`/agents user accept`](accept.md). Every deletion writes an
append-only tombstone to the revocation ledger BEFORE the underlying
file is rewritten without it — see
[`agent-user-schema § Delete, revoke, and audit`](../../../../../docs/contracts/agent-user-schema.md#delete-revoke-and-audit-road-to-global-user-memory-phase-4).

Three targets, one per invocation:

| Target | Removes | Backing function |
|---|---|---|
| `observation <id>` | ONE buffered line from `observations.jsonl` | [`deleteGlobalObservation`](../../../../../src/scripts/_lib/user_global_observations.ts) |
| `project <path>` | EVERY observation attributed (`context.project_path`) to that project | [`purgeProjectContext`](../../../../../src/scripts/_lib/user_global_observations.ts) |
| `profile-field <field>` | A field's value from the global `profile.md` | [`revokeGlobalProfileField`](../../../../../src/scripts/_lib/agent_user_profile.ts) |

Use when:

- [`/agents user show --audit`](show.md) or
  [`/agents user review`](review.md) surfaced something the user wants
  gone.
- A project was deleted and its buffered facts should not linger
  forever (`project <path>`).
- A promoted or accepted profile field turned out to be wrong
  (`profile-field <field>`).

Never runs autonomously — always asks before writing, exactly like
`accept`.

## Steps

### 1. Resolve the target

| Invocation | Target |
|---|---|
| `/agents user delete observation <id>` | The buffered observation whose `observationId` equals `<id>` (shown by `/agents user show --audit` or `/agents user review`) |
| `/agents user delete project <path>` | Every observation whose `context.project_path` equals `<path>` |
| `/agents user delete profile-field <field>` | `<field>` in the global `profile.md` (must match the schema enum) |
| No argument | Print the target-kind table above and ask which; then ask for the id/path/field |

Invalid `<field>` → print the schema enum and stop. No observation
matches `<id>` → print "No buffered observation with that id." and
stop (no tombstone is written for a no-op — see the backing functions'
`deleted: false` / `purgedCount: 0` contract).

### 2. Confirm

```
Delete this from the global user-memory layer?

  target : {observation <id> | project <path> | profile-field <field>}
  current: {for profile-field — the current value; for observation/project — the suggest text(s) that will be removed}

> 1. Delete — write a tombstone, then remove
> 2. Cancel — leave everything untouched
```

For `project <path>`, list every matched observation's `suggest` text
before asking, so the user confirms the actual scope, not just a count.

One question per turn. Wait for the user's number.

### 3. Ask for a reason

```
Why is this being deleted? (one line, becomes the tombstone's `reason`)
> {free-text reason}
```

An empty answer is not accepted — re-ask once, then default to `"no
reason given"` if the user still declines (mirrors
[`user_global_revocations.appendTombstone`](../../../../../src/scripts/_lib/user_global_revocations.ts)'s
own fallback, so a user who truly has nothing to say is never blocked).

### 4. Write

On `1. Delete`, call the matching function with today's date and the
step-3 reason:

- `observation <id>` →
  [`deleteGlobalObservation(id, reason, { today })`](../../../../../src/scripts/_lib/user_global_observations.ts).
- `project <path>` →
  [`purgeProjectContext(path, reason, { today })`](../../../../../src/scripts/_lib/user_global_observations.ts).
- `profile-field <field>` →
  [`revokeGlobalProfileField(field, reason, { today })`](../../../../../src/scripts/_lib/agent_user_profile.ts).

Each function writes its tombstone(s) BEFORE the buffer/profile
rewrite — never call `fs`/the file directly from this command; always
go through the function so the tombstone-before-delete order holds.

On `2. Cancel`: stop without any write, without any tombstone.

### 5. Confirm

```
✅  Deleted ({target}). Tombstone recorded: {entity_id}, {revoked_at}.
```

For `project <path>`, report the count: `✅  Purged {n} observation(s) from {path}. {n} tombstone(s) recorded.`

Do NOT commit. Do NOT auto-chain to a second deletion.

## Rules

- One target per invocation. Run the command again for the next
  deletion.
- Never delete without explicit confirmation in step 2 and a reason
  from step 3.
- Never write to a file directly — every deletion goes through
  `deleteGlobalObservation`, `purgeProjectContext`, or
  `revokeGlobalProfileField` so the tombstone always precedes the
  delete.
- Never touch project-local `.agent-user.md` or its buffer from this
  command — this leaf covers the global layer only. A project-local
  fact is deleted by editing `.agent-user.md` directly (it never left
  the project) or via [`/agents user review`](review.md)'s existing
  "clear a buffer" option.
- Mirror the user's language for prompts per
  [`language-and-tone`](../../../../dist/agent-src/rules/language-and-tone.md).

## See also

- Schema: [`agent-user-schema § Delete, revoke, and audit`](../../../../../docs/contracts/agent-user-schema.md#delete-revoke-and-audit-road-to-global-user-memory-phase-4) — the write→delete mapping and the ADR-121 reuse this command exposes.
- Audit source: [`/agents user show --audit`](show.md) — the read surface that surfaces what there is to delete.
- Parent: [`/agents user`](../user.md).
- Sibling: [`/agents user review`](review.md), [`/agents user accept`](accept.md) — the write side this command undoes.
