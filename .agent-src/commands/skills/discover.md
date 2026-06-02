---
model_tier: medium
name: skills:discover
tier: 2
cluster: skills
sub: discover
description: Recommend skills for a role — ranked by four explained classes (most-useful-for-role, related-to-current-task, recently-adopted, popular-in-role). Local-only; every result carries a why.
skills: [file-editor]
suggestion:
  eligible: true
  trigger_description: "which skills should I use, recommend skills for my role, what fits this work, help me find a skill, /skills:discover sales"
  trigger_context: "user wants a short, explained skill shortlist instead of scanning the 220-skill catalog"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /skills discover

Surfaces a short, explained skill shortlist for a role. Reuses existing local
signals only — the skill catalog frontmatter, the role's `skills.yml`
shortlist, and (when present and not opted out) the local-analytics JSONL.
Implements the [`skill-discovery`](../../../docs/contracts/skill-discovery.md)
contract. Local-only, read-only, no network.

## Prerequisites

- Python 3.10 + PyYAML on the host (already a package dependency).
- A role id — passed as `[role]`, or the active role from
  `.agent-settings.yml` → `roles.active_role`.

## Steps

### 1. Resolve the role

The user invokes `/skills discover [role]`. The role is the first positional
argument. If omitted, the recommender falls back to `roles.active_role`. If
neither resolves, it prints the available roles and stops — do not guess.

### 2. Run the recommender

```bash
python3 scripts/skill_discovery.py --role <role>
```

Optional flags: `--format json` (machine-readable), `--limit N` (results per
class, default 5). The script is pure-local and writes nothing.

### 3. Present the table

Render the recommender's Markdown table to the user:
`skill · class · why · first command`. Each row's `why` names the *signal*
(role match, domain adjacency, recent adoption, role popularity) — never a
bare score. The four classes are:

- `most-useful-for-role` — the role's priority shortlist.
- `related-to-current-task` — same-domain peers not already shortlisted.
- `recently-adopted` — used recently in this workspace (analytics) or the
  shortlist tail when no usage signal exists yet.
- `popular-in-role` — launched most by this role locally (analytics) or the
  shortlist when no usage signal exists yet.

### 4. Offer the first command

Each row carries a `first command` — the natural way to start with that skill.
Suggest the user pick one and run it. Do **not** auto-invoke a skill.

## Rules

- **Local-only, read-only.** No network, no writes, no prompt/response bodies.
- **Every result has a non-empty `why`** — a contract invariant.
- **Analytics opt-out honoured.** `AGENT_CONFIG_NO_LOCAL_ANALYTICS` env or
  `analytics.local: off` → the analytics-backed classes fall back to the role
  shortlist with an honest `why`; the surface never fabricates a usage signal.
- **One role per invocation.** Do not chain.
