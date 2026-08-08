---
type: "auto"
tier: "2a"
description: "Council availability is decided by the CLI resolver, never by the project tree — .agent-settings.yml is not the council config"
triggers:
  - keyword: "council"
  - keyword: "ai council"
  - keyword: "ai-council"
  - keyword: "council:estimate"
  - keyword: "council:run"
  - keyword: "second opinion"
  - phrase: "cross-check with another model"
self_contained: true
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
enforced_by:
  - "none"
# obligation: line 32
obligation_frequency: "per-task"
---

# Council Availability Is CLI-Decided

The council config is a **per-developer, user-global** facility (ADR-104,
superseding ADR-093). It is configured once and works in every project,
worktree, and CWD — including consumer repos that carry none of this package's
internals. Nothing in the project tree switches it on or off.

## The Iron Law

```
COUNCIL AVAILABILITY IS DECIDED BY THE CLI RESOLVER — NEVER BY THE PROJECT TREE.
RUN THE FREE `council:estimate` PROBE AND READ ITS OUTPUT BEFORE CLAIMING
THE COUNCIL IS UNAVAILABLE.
NEVER INFER "NOT CONFIGURED" FROM A MISSING `.agent-settings.yml`, A MISSING
`scripts/ai_council`, OR A MISSING PROJECT-LOCAL COUNCIL FILE — NONE OF THEM
CARRY COUNCIL ENABLEMENT.
NEVER COPY THE USER-GLOBAL CONFIG INTO THE PROJECT TREE TO "MAKE IT WORK".
NEVER PRESENT A SUBAGENT FAN-OUT AS A COUNCIL.
```

## The probe — free, works in any directory

```bash
agent-config council:status     # no API call, no spend
```

It prints `CONFIGURED` or `NOT CONFIGURED`, the resolved config path, which
layer resolved it, and the enabled member count. Inside this package's own
checkout the repo-local entry is `./scripts-run src/scripts/council_cli status`.
`council:estimate <file> --input-mode prompt` answers the same question as a
side effect of a cost preview, but `status` is the purpose-built verb — prefer
it.

## What does NOT decide availability

| Observed | What it actually means |
|---|---|
| No `.agent-settings.yml` in the project | Nothing — it never carried council enablement; the legacy block was removed in ADR-093. |
| No `scripts/ai_council/` directory | Nothing — that is package-internal and absent from every consumer repo. |
| No council file in the project | Nothing — the resolver ignores `project_root` entirely and reads no project-local copy. |
| No API keys visible in the project | Nothing — keys live under `~/.event4u/agent-config/<provider>.key`. |

The one real location is `~/.event4u/agent-config/settings/.ai-council.yml`. The
only escape is `$AI_COUNCIL_CONFIG`, an explicit absolute path — still not a
project search.

## Why this rule exists

The council is the one feature whose switch is **not** in `.agent-settings.yml`,
though roughly twenty other rules train the reflex of reading that file to learn
whether a feature is on. The exception was documented only in
[`ai-council`](../skills/ai-council/SKILL.md) — a skill that is almost never
self-selected, so its body never reaches context.

Four separate consumer sessions therefore inspected the project tree, announced
"council not configured (no `.agent-settings.yml`)", and substituted a subagent
fan-out — while the council was configured with two billable members the whole
time. A fifth copied the user-global config into the repo to "make it work".
This rule moves the fact out of a skill body and onto the always-loaded surface.

## If the probe really reports unavailable

State the resolver's own message, and stop. A subagent fan-out with adversarial
lenses is a legitimate substitute **only when named as such** — never as "the
council". Same honesty boundary as
[`evaluator-independence`](evaluator-independence.md).

## When NOT to fire

- The council already ran this session and its availability is settled.
- The user is asking about council *content* (findings, synthesis), not
  availability.

## Enforcement — stated honestly

`enforced_by: none`. No gate reads a chat claim, so the obligation above is
model-carried. What **is** deterministic is the tree:
`check_council_config_location.ts` fails the build when a council surface —
this rule included — ties the config to `.agent-settings.yml`, which never
carried it, or to a project-tree path; and its §4 fails when no always-loaded
rule carries the user-global fact at all.

## See also

- [`ai-council`](../skills/ai-council/SKILL.md) — the full invocation procedure.
- [`direct-answers`](direct-answers.md) Iron Law 2 — a live-state fact is never
  asserted from inspection when an authoritative resolver exists.
- [`fast-path-marker-visibility`](fast-path-marker-visibility.md) — sibling
  council rule; provenance markers are surfaced verbatim.
