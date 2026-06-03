---
model_tier: medium
name: skills
pack: meta
tier: 2
description: Skill discovery orchestrator — routes to discover. Local, explained skill recommendations over the catalog + role shortlists + optional local analytics.
cluster: skills
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "which skills should I use, recommend skills for my role, what skills fit this work, I can't find the right skill, /skills:discover"
  trigger_context: "user is lost in the 220-skill catalog and wants a short, explained shortlist for their role"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /skills

Top-level orchestrator for the `/skills` family — the **skill discovery**
cluster. Turns existing local signals (the skill catalog, the active role's
shortlist, and optional local analytics) into a short, *explained*
recommendation list. Local-only, no network, honours the analytics opt-out.

Anchors: [`skill-discovery`](../../docs/contracts/skill-discovery.md) contract —
input signals, the four recommendation classes, and the non-negotiable
`why`-per-result requirement.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/skills discover` | `commands/skills/discover.md` | Rank skills for a role by four explained classes (most-useful / related / recently-adopted / popular) |

Sub-command names match the locked contract in
[`docs/contracts/command-clusters.md`](../../docs/contracts/command-clusters.md).

## Dispatch

1. Parse the user's argument: `/skills <sub-command> [args]`.
2. Look up the sub-command in the table above.
3. Load the body of the routed file and follow its `## Steps` section
   verbatim with the remaining args.
4. If the sub-command is unknown or missing, route to `discover` (the only
   sub-command today) and print its menu.

## Rules

- **Local-only.** The recommender reads local files only — the catalog, the
  role `skills.yml`, and (if present and not opted out) the local-analytics
  JSONL. No network, no writes.
- **Every recommendation carries a `why`.** Never surface an unexplained
  score — this is a contract invariant.
- **Honours the analytics opt-out** (`AGENT_CONFIG_NO_LOCAL_ANALYTICS` env or
  `analytics.local: off`); degrades to catalog + role shortlist gracefully.
- **Do NOT chain sub-commands.** One `/skills <sub>` per turn.
