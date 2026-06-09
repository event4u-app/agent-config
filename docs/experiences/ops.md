# 🛡 The `ops` experience

> Set `profile.id: ops` (wizard, or `agent-config use --profile=ops`).
> **Preset default: `strict`.**

## Who it's for

RevOps, support, SRE-adjacent — threat-model a change before it ships, command
the incident when it breaks, build the dashboard that catches it next time.

## First three tasks

1. **Threat-model first** — `/threat-model` enumerates abuse cases and trust boundaries before the first line of code.
2. **Command the incident** — `incident-commander` frames severity and the post-mortem.
3. **Build the signal** — `dashboard-design` chooses the right RED / USE / Golden-Signal panel.

## First commands

`/work` · `/threat-model` · `/review-changes` · `/fix`

## Packs that activate

`engineering-base` + `founder-strategy` (+ `meta`, always on).

## Flows that apply

[Implementation](../flows.md), **review** (threat-model is the front door), and
**delivery** apply; discovery is lighter. The `strict` preset keeps the
security/quality gates tight.

## What is NOT loaded

No `ai-video`, no `gtm-marketing`, no `finance-*`. Engineering + reliability
surface, not a studio or CFO one.

## Example

> *"We're adding a public webhook endpoint."* → `/threat-model` enumerates abuse
> cases + trust boundaries first (per `security-sensitive-stop`); `/review-changes`
> dispatches the security judge; `logging-monitoring` keeps PII out of the stream.

## See also

[Profile (deep)](../profiles.md#profile-ops) ·
[Role guide](../getting-started-by-role.md#finance--ops-cfo-controller-ops-lead-founder-finance) ·
[Flows](../flows.md) ·
key skills: `incident-commander` · `dashboard-design` · `logging-monitoring` · `threat-modeling` · `launch-readiness`.
