---
model_tier: medium
name: analyze
disable-model-invocation: true
pack: analysis-workbench
intent: "Analysis dispatcher — classify input by keywords, propose a weighted framework path, let the user pick"
routes_to: [analyze-postmortem, analyze-premortem, analyze-decision, analyze-near-miss, analyze-incident]
replaces: []
tier: 1
visibility: visible
description: Analysis orchestrator — confidence-weighted suggester that routes to postmortem, premortem, decision-review, near-miss, or incident frameworks.
cluster: analyze
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "analyze this, run a post-mortem, pre-mortem, decision review, near-miss, or incident analysis"
  trigger_context: "user wants to apply a structured analysis framework to a past event, future risk, or past decision"
workspaces:
  - engineering
packs:
  - analysis-workbench
---

# /analyze

Top-level orchestrator for the `/analyze` family. A
**confidence-weighted suggester** — classifies the user's input by
keywords, proposes a numbered-options menu ranked by fit, and routes
to the chosen sub-command. Never auto-selects silently.

## Sub-commands

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/analyze:postmortem` | `analyze/postmortem/command.md` | Blame-free post-mortem after a resolved incident |
| `/analyze:premortem` | `analyze/premortem/command.md` | Forward-looking imagined-failure before committing to a plan |
| `/analyze:decision` | `analyze/decision/command.md` | Audit a past architectural decision (did it hold?) |
| `/analyze:near-miss` | `analyze/near-miss/command.md` | Post-mortem for a near-miss (same flow, lighter severity framing) |
| `/analyze:incident` | `analyze/incident/command.md` | Full incident flow: commander → RCA → post-mortem → memory candidate |

## Dispatch

### 1. Parse the argument

`/analyze[:<sub>] [args]` or `/analyze <sub> [args]`.

- **Explicit sub-command present** → load that sub-command's body and
  follow its `## Instructions` verbatim with the remaining args.
- **No sub-command** → proceed to Step 2.

### 2. Confidence-weighted classification

Read the user's free-text input. Score each framework by keyword
match:

| Keyword signals | Suggests |
|---|---|
| "post-mortem", "outage", "incident resolved", "was ist schiefgelaufen" | `postmortem` |
| "near-miss", "almost failed", "beinahe-Vorfall", "close call" | `near-miss` |
| "pre-mortem", "what could go wrong", "imagine failure", "vor dem Start" | `premortem` |
| "decision review", "ADR", "did this hold up", "rückblick Architektur" | `decision` |
| "production is down", "active incident", "Vorfall", "Prod ist down" | `incident` |

Assign a confidence level (high / medium / low) per framework based on
signal count. A framework with zero signals gets `low`.

### 3. Surface the weighted menu — NEVER auto-select

Present numbered options in descending confidence order. At least two
options must appear. Always include the `describe in your own words`
escape:

> Which analysis framework fits?
>
> 1. [high] Post-mortem (`/analyze:postmortem`) — blame-free write-up after a resolved incident
> 2. [medium] Near-miss (`/analyze:near-miss`) — same flow, lighter severity framing
> 3. [low] Pre-mortem (`/analyze:premortem`) — imagined-failure analysis before committing
> 4. [low] Decision review (`/analyze:decision`) — did a past architectural decision hold up?
> 5. [low] Incident (`/analyze:incident`) — full live-incident coordination + RCA + post-mortem
> 6. Describe in your own words — I'll re-classify

**Empfehlung:** 1

The user picks a number. Load the routed sub-command and follow its
`## Instructions` verbatim with the remaining args.

### 4. If the user picks "Describe in your own words"

Ask one question (per `ask-when-uncertain`):

> What happened or what are you trying to analyse?

Re-run Step 2 with the answer. Present the menu again. Do not loop
more than twice — on the third attempt, show all five options unranked
and let the user pick.

### 5. Unknown sub-command

If the argument names a sub-command not in the table, show the table
and ask which one was intended. One question, no guessing.

## Rules

- **Never auto-select a framework** — always show the weighted menu
  and wait for the user's pick (council-locked design, Phase 4).
- **Explicit routing only in v1** — do not infer the framework from
  open files, branch names, or context not supplied by the user in
  this turn.
- **Do NOT commit, push, or open a PR** unless a sub-command
  explicitly authorizes it.
- **Do NOT chain sub-commands.** One `/analyze <sub>` per turn.
- **Memory loop applies** — every sub-command that produces an
  analysis output MUST draft a memory candidate via
  `/memory propose` per
  [`docs/contracts/analysis-memory-loop.md`](../../docs/contracts/analysis-memory-loop.md).

## See also

- [`docs/contracts/analysis-memory-loop.md`](../../docs/contracts/analysis-memory-loop.md) — produce → propose → promote → retrieve contract
- [`blameless-post-mortem`](../../../skills/blameless-post-mortem/SKILL.md) — post-mortem + near-miss skill
- [`root-cause-frameworks`](../../../skills/root-cause-frameworks/SKILL.md) — RCA engine
- [`premortem`](../../../skills/premortem/SKILL.md) — forward-looking imagined-failure skill
- [`decision-review`](../../../skills/decision-review/SKILL.md) — past-decision audit skill
- [`incident-commander`](../../../skills/incident-commander/SKILL.md) — live-incident coordination skill
