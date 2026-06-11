---
model_tier: medium
name: agents-user
pack: meta
tier: 2
cluster: agents
sub: user
description: User-persona file (.agent-user.md) — interview, render, and maintain who the user is and how they want to be addressed.
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "create user persona, render .agent-user.md, review observations, accept observations, edit user file"
  trigger_context: "user wants to bootstrap or maintain the .agent-user.md persona file (name, language, role, style, voice sample)"
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

**Why this is its own cluster:** `AGENTS.md` describes the *project*
to the agent. `.agent-user.md` describes the *user* to the agent.
Two distinct primitives — same `/agents` family for discoverability,
separate sub-commands for separation of concerns.

## Sub-sub-commands

| Sub-sub-command | Routes to | Purpose |
|---|---|---|
| `/agents user init` | `commands/agents/user/init.md` | Short interview → creates `.agent-user.md` |
| `/agents user show` | `commands/agents/user/show.md` | Read-only render of the persona |
| `/agents user review` | `commands/agents/user/review.md` | List buffered observations from `.agent-user.observations.jsonl` |
| `/agents user accept` | `commands/agents/user/accept.md` | Apply a buffered observation with confirmation |
| `/agents user update` | `commands/agents/user/update.md` | Open in IDE for manual edit; validate on save |

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
- **Edit `.agent-src.uncondensed/` only.** `dist/agent-src/` and
  `.augment/` regenerate from source.

## See also

- [`agent-user-schema`](../../../docs/contracts/agent-user-schema.md) — locked v1 frontmatter and field reference.
- [`/agents`](../AGENTS.md) — parent cluster.
- [`/agents init`](init.md) — project-side bootstrap (separate primitive).
