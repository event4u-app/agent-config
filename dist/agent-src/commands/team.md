---
model_tier: inherit
name: team
disable-model-invocation: true
argument-hint: "[review|adversarial|delegate|status] [args]"
pack: meta
intent: "Route a cross-model team-mode request (review, adversarial, delegate, status) to the official plugin under ai_team governance"
routes_to: [team-review, team-adversarial, team-delegate, team-status]
replaces: []
tier: 2
visibility: internal
description: Team orchestrator — governed cross-model access layer (a second strong model reviews the real diff; read-only multi-host fallback); routes to review, adversarial, delegate, status
cluster: team
type: orchestrator
suggestion:
  eligible: true
  trigger_description: "second model, GPT drüberschauen lassen, cross-model review, review gate, let another strong model check the diff, team review"
  trigger_context: "/team is available (codex CLI installed + authenticated, not halted) AND the user wants a second strong model to review the actual working-tree diff with repo access (depth) — not a neutral artefact opinion (that is /council)"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /team

Top-level orchestrator for the `/team` family — governed **team mode**: a
governed access layer with a read-only multi-host fallback, the depth
complement to the council. A second strong model reviews the **real diff
with repo access** and returns its findings. On Claude Code hosts every
sub-command is a **thin delegation** to the official
`openai/codex-plugin-cc` plugin (`/codex:*`) — this family adds governance
(default-off gate, delegate opt-in, quota visibility, fail-closed setup
checks), never a reimplementation. An iterated build → review → fix loop is
**gated future work** — it unlocks only with a positive verdict from the
pre-registered benchmark (§ No-claims note).

## What team mode is — and is not

- **Is:** a single strong reviewer running inside the working tree via the
  Codex CLI under the user's subscription. It reads git state itself and
  returns an opinionated review of the actual change.
- **Is not:** the council. The council is breadth under a neutrality
  contract — N members see the artefact text only, never the repo, never the
  host's framing. Team mode is the inverse on every axis (table below). The
  council's neutrality contract is untouched by team mode.

## Boundary — /council vs. /team

| Axis | `/council` | `/team` |
|---|---|---|
| Shape | Breadth — N members, one round by default | Depth — one strong reviewer on the real diff |
| Context | Artefact text only; never the repo, never host framing (neutrality contract) | Full repo access — the reviewer reads git state itself |
| Cost model | Billable API members by default; USD cost gate | Subscription-authed Codex CLI; daily call quota (`cli_call_budget.max_calls_per_day.openai`) |
| Model choice | Mid-tier default (cost decision) | Strongest available — `ai_team.model: 'auto'` defers to the CLI default |
| Write access | Never (text only; one opt-in PR comment under `pr`) | Read-only by default; `/team delegate` is the single write path, behind a second opt-in |

## Availability gate — check FIRST, before anything else

`/team` carries no on/off setting — `ai_team.enabled` was REMOVED
(road-to-always-on-orchestration Phase 1, Step 1.3). Availability is a FACT
resolved from the machine: the codex CLI must resolve on `$PATH`, AND some
auth for it must be detectable (subscription login, API key, key file, or
env key) — the same check `agent-config doctor --check team` runs. Missing
either → print the degrade line and **STOP**. Do not route, do not suggest
a sub-command, do not probe for the plugin:

> codex CLI not available — `/team` needs the codex CLI installed and
> authenticated. Install: `npm install -g @openai/codex`, then run
> `codex login`. Verify with `agent-config doctor --check team`.

Also check the one incident switch: `emergency.orchestration_halt: true`
in `.agent-settings.yml` halts `/team` along with the rest of the always-on
orchestration stack (subagents, council, team). Halted → print:

> `/team` is halted (`emergency.orchestration_halt: true`) — the always-on
> orchestration stack is paused for incident response. Resume: set
> `orchestration_halt: false` with a non-empty
> `orchestration_halt_justification` in `.agent-settings.yml`.

Every sub-command repeats this check independently — the gate holds even when
a wrapper is invoked directly. A leftover `ai_team.enabled` key from an
older install is ignored (one deprecation-warning line on load) — it no
longer gates anything.

## Sub-commands

On Claude Code each sub-command **delegates** to the paired `/codex:*` command
rather than routing to an in-suite skill — the second column names that target.

| Sub-command | Routes to | Purpose |
|---|---|---|
| `/team review [--background]` | `/codex:review` | Cross-model review of the current working-tree / staged diff |
| `/team adversarial <focus>` | `/codex:adversarial-review` | Adversarial cross-model review on a named focus — the escalation rung above the single-model `adversarial-review` skill |
| `/team delegate <task>` | `/codex:rescue` | Hand a task to the second model as a native worker — the only write-access wrapper; gated behind `ai_team.allow_delegate` |
| `/team status` | `/codex:status` + quota block | Plugin job status plus the shared openai counter against both ceilings (team + council), naming any blocked path |

## Dispatch

1. Run the availability gate above. Unavailable or halted → the matching
   one-line block, stop.
2. Parse the user's argument: `/team <sub-command> [args]`.
3. Look up the sub-command in the table above; load the routed file and
   follow its `## Instructions` verbatim with the remaining args.
4. Unknown or missing sub-command → print the table and ask:

   > 1. review — cross-model review of the real diff (optionally `--background`)
   > 2. adversarial — adversarial cross-model review on a focus
   > 3. delegate — hand a task to the second model (write access; second opt-in)
   > 4. status — plugin jobs + today's call-quota ledger

## Fail-closed contract (all wrappers)

When the official plugin is absent on a Claude Code host, every wrapper
fails **closed** with the doctor remediation pointer — never a silent no-op,
never an inline reimplementation of the plugin:

> ❌ `/team` is available, but the official plugin is not installed on this
> Claude Code host. `/team <sub>` fails closed — it never reimplements the
> plugin inline and never silently no-ops.
>
> Run the guided check and follow its remediation block:
>
> ```bash
> agent-config doctor --check team
> ```

On non-Claude-Code hosts the wrappers fall back to a **read-only** transport
(repo-diff bundle via the council's `OpenAICliClient`) — no plugin job
control, no background jobs, no delegate write path; the capability delta
vs. the native plugin is stated in the output. When the codex CLI itself is
absent, the same fail-closed principle applies: state it plainly and stop.

## No-claims note

The review-lift value of cross-model team review is **unproven** until the
pre-registered three-arm benchmark (team review vs. single-model adversarial
self-review vs. `council:pr`) has run. Never assert "two strong models catch
each other's errors", a defect-finding lift, or any quantified quality claim
in output, docs, or suggestions. Team mode is offered as a workflow, not as a
measured improvement.

## Rules

- **Do NOT commit, push, or open a PR.** `/team` produces text; the plugin's
  review output is returned verbatim.
- **Do NOT chain sub-commands.** One `/team <sub>` per turn.
- **Write access exists only via `/team delegate`**, and only when
  `ai_team.allow_delegate: true` (default `false`). Every other wrapper is
  read-only.
- **Quota:** every team call counts into the existing
  `cli_call_budget.max_calls_per_day.openai` bucket — one subscription, one
  counter. No parallel counting system.
- If the user invokes `/team` with no argument, **show the menu** — do not
  guess which sub-command they meant.

## See also

- `/council` — breadth under a neutrality contract; the complement, not the
  competitor.
- `subagent-orchestration` skill — the in-session, same-weights variant (no
  network, no spend); team is cross-model with repo access. The three-way
  router split: council = independent breadth, team = collaborative depth,
  subagents = in-session same-weights.
- `adversarial-review` skill — the free single-model first rung below
  `/team adversarial`.
- `docs/contracts/ai-team-config.md` — the `ai_team` settings block
  (`model`, `allow_delegate`, `max_calls_per_day`) and the availability
  contract (codex CLI + auth, `emergency.orchestration_halt`).
