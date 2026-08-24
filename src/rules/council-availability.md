---
type: "auto"
tier: "2a"
description: "Council availability is decided by the CLI resolver, never by the project tree — .agent-settings.yml is not the council config"
triggers:
  - keyword: "council"
  - keyword: "ai council"
  - keyword: "ai-council"
  - keyword: "council:status"
  - keyword: "second opinion"
  - phrase: "cross-check with another model"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
enforced_by:
  - "instruction-only: no gate reads a chat claim about availability; check_council_config_location covers the tree side only"
# obligation: line 27
obligation_frequency: "per-task"
---

# Council Availability Is CLI-Decided

The council config is user-global (ADR-104): configured once per developer, live
in every project, worktree and CWD — including consumer repos carrying none of
this package's internals. Nothing in the project tree switches it on or off.

## The Iron Law

```
COUNCIL AVAILABILITY IS DECIDED BY THE CLI RESOLVER — NEVER BY THE PROJECT TREE.
RUN THE FREE `council:status` PROBE BEFORE CLAIMING THE COUNCIL IS UNAVAILABLE.
NEVER INFER "NOT CONFIGURED" FROM A MISSING `.agent-settings.yml`, A MISSING
`scripts/ai_council`, OR A MISSING PROJECT-LOCAL COUNCIL FILE — NONE OF THEM
CARRY COUNCIL ENABLEMENT.
NEVER COPY THE USER-GLOBAL CONFIG INTO THE PROJECT TREE TO "MAKE IT WORK".
NEVER PRESENT A SUBAGENT FAN-OUT AS A COUNCIL.
```

## The probe

```bash
agent-config council:status     # no API call, no spend, any directory
```

Prints `CONFIGURED` / `NOT CONFIGURED`, the resolved path, the layer that
resolved it, and the member count. In this package's own checkout:
`./scripts-run src/scripts/council_cli status`.

## What says nothing about availability

A missing `.agent-settings.yml` (it never carried enablement — the block was
removed in ADR-093), a missing `scripts/ai_council/` (package-internal, absent
from every consumer), a missing project-local council file (the resolver ignores
`project_root` entirely), and invisible API keys (they live under
`~/.event4u/agent-config/`). The one real location is
`~/.event4u/agent-config/settings/.ai-council.yml`; the only escape is
`$AI_COUNCIL_CONFIG`, an explicit absolute path — still not a project search.

## Why this rule exists

The council switch is **not** in `.agent-settings.yml`, though roughly twenty
rules train the reflex of reading that file to learn whether a feature is on.
The exception lived only in [`ai-council`](../skills/ai-council/SKILL.md),
a skill body that reaches context only on activation, so five consumer sessions
inspected the tree, announced "council not configured", and substituted a
subagent fan-out while two members were configured the whole time. One copied
the user-global config into the repo to "make it work".

## If the probe really says unavailable

State the resolver's own message and stop. A subagent fan-out is a legitimate
substitute **only when named as such** — never as "the council". Same honesty
boundary as [`evaluator-independence`](evaluator-independence.md).

## When NOT to fire

Availability is already settled this session, or the question is about council
*content* (findings, synthesis) rather than availability.

## Enforcement

`instruction-only` — no gate reads a chat claim. Deterministic instead:
`check_council_config_location` fails the build when a council surface ties the
config to `.agent-settings.yml`, which never carried it, or to a project-tree
path, and its §4 fails when no always-loaded rule carries this fact at all.

## See also

- [`ai-council`](../skills/ai-council/SKILL.md) — the full invocation procedure.
- [`direct-answers`](direct-answers.md) Iron Law 2 — a live-state fact is never
  asserted from inspection when an authoritative resolver exists.
- [`self-repair-loop`](self-repair-loop.md) — catches the claim when it is made
  anyway.
