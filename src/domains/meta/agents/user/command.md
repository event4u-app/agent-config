---
model_tier: medium
name: agents-user
pack: meta
visibility: internal
cluster: agents
sub: user
description: User-persona file (.agent-user.md) — interview, render, and maintain who the user is and how they want to be addressed.
argument-hint: "[init|show|review|accept|update] [args]"
type: orchestrator
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /agents user

Sub-dispatcher for the user-persona file
[`/.agent-user.md`](../../../docs/contracts/agent-user-schema.md) — a
single, project-root, gitignored Markdown file that captures who the
user is and how they want the agent to address them.

Since ADR-138, a weaker global layer
(`~/.event4u/agent-config/user/profile.md`) sits beneath the
project-local file — see
[`agent-user-schema.md § Global profile layer`](../../../docs/contracts/agent-user-schema.md#global-profile-layer-adr-138)
for the merge rule. `init` and `update` operate on the **project-local**
file only; `review` and `accept` cover BOTH layers' observation buffers
(road-to-global-user-memory Phase 2/3); `show` renders the merged,
effective profile by default, or the global layer's raw holdings with
`--audit`; `delete` removes something the global learning channel wrote
— an observation, a project's worth of observations, or a promoted
profile field — with a tombstone in every case (Phase 4).

**Why this is its own cluster:** `AGENTS.md` describes the *project*
to the agent. `.agent-user.md` describes the *user* to the agent.
Two distinct primitives — same `/agents` family for discoverability,
separate sub-commands for separation of concerns.

## Sub-sub-commands

| Sub-sub-command | Routes to | Purpose |
|---|---|---|
| `/agents user init` | `commands/agents/user/init.md` | Short interview → creates `.agent-user.md` |
| `/agents user show` | `commands/agents/user/show.md` | Read-only render of the persona; `--audit` renders the global layer's raw holdings |
| `/agents user review` | `commands/agents/user/review.md` | List buffered observations from both the project-local and the global buffer |
| `/agents user accept` | `commands/agents/user/accept.md` | Apply a buffered observation (either layer) with confirmation |
| `/agents user update` | `commands/agents/user/update.md` | Open in IDE for manual edit; validate on save |
| `/agents user delete` | `commands/agents/user/delete.md` | Delete an observation, purge a project's observations, or revoke a profile field — with a tombstone |

Schema contract:
[`docs/contracts/agent-user-schema.md`](../../../docs/contracts/agent-user-schema.md).

## Dispatch

1. Parse the user's argument: `/agents user <sub-sub-command> [args]`.
2. Look up the sub-sub-command in the table above.
3. Load the routed file and follow its `## Steps` section verbatim
   with the remaining args.
4. Unknown or missing sub-sub-command → print the table above and
   ask which one. **One sub-sub-command per turn**; do not chain.

## Rules

- **Do NOT commit, push, or open a PR** unless the sub-sub-command
  explicitly authorizes it.
- **Do NOT write third-party PII** — names, dates, financial figures,
  health/legal status. See the
  [exclusions list](../../../docs/contracts/agent-user-schema.md#explicit-exclusions).
- **Do NOT introduce network code** in this package. External
  enrichment is rejected for v1 — see the
  [determinism floor](../../../docs/contracts/agent-user-schema.md#determinism-floor).
- **Edit `src/` only.** `dist/agent-src/` and
  `.augment/` regenerate from source.

## See also

- [`agent-user-schema`](../../../docs/contracts/agent-user-schema.md) — locked v1 frontmatter and field reference.
- [`/agents`](../AGENTS.md) — parent cluster.
- [`/agents init`](init.md) — project-side bootstrap (separate primitive).
