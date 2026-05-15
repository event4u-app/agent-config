---
stability: beta
keep-beta-until: 2026-08-13
---

# `.agent-user.md` schema (v1)

> **Status:** beta — locked for `1.18.0`. Re-evaluate fields after
> Phase 3 has been in active use for ≥1 week per the
> [step-3 re-validation gate](../../agents/roadmaps/archive/step-3-agent-user-persona.md).

`.agent-user.md` is a single, project-root, gitignored Markdown file
that captures who the user is and how they want the agent to address
them. It is **deliberately minimal in v1** — name, language, role,
style, and a single voice sample. Everything else is deferred until
usage signal exists.

The file is owned by the user. The agent never edits it without an
explicit `accept` step.

## Locked frontmatter (v1)

```yaml
---
version: 1
identity:
  name: "Mathias"          # required — full name or how the user wants to be addressed
  nickname: "Matze"        # optional — preferred shorthand (used by default in chat)
language: "de"             # required — BCP-47-ish primary language ("de", "en", "fr", ...)
role: "founder/engineer"   # required — short free-form role label
style:
  formality: "informal"    # informal | formal
  pace: "pragmatic"        # pragmatic | thorough | rapid
voice_sample: |            # required — one paste of the user's typical writing
  Mach das einfach. Wenn unklar, frag im Council.
last_updated: "2026-05-15" # YYYY-MM-DD — bumped on every accepted change
---
```

After the frontmatter, the body is a single freeform **`# Notes`**
section. Hard cap: **100 lines** total file size (including
frontmatter, body, and the Notes section). The 100-line cap is
enforced by `/agents user accept` and `/agents user update`.

## Field reference

| Field | Required | Purpose |
|---|---|---|
| `version` | yes | Schema version. v1 is the only valid value today. |
| `identity.name` | yes | Default address form. |
| `identity.nickname` | no | Preferred shorthand — agent uses this by default in chat replies when set. |
| `language` | yes | Primary language; the agent mirrors per [`language-and-tone`](../../.agent-src/rules/language-and-tone.md). |
| `role` | yes | Short free-form label — drives reviewer voice selection and persona pairing. |
| `style.formality` | yes | `informal` (Du / first-name) or `formal` (Sie / full name). |
| `style.pace` | yes | `pragmatic` (default), `thorough` (more verification), or `rapid` (shorter replies). |
| `voice_sample` | yes | One representative paste — anchors mirror-back and tone calibration. |
| `last_updated` | yes | ISO date, bumped on every accept. |

## Explicit exclusions

The agent NEVER writes any of the following to `.agent-user.md`, even
with the user's explicit consent — they violate the privacy floor:

- Credentials, API keys, passwords, tokens.
- Third-party names (children, partners, colleagues, clients).
- Third-party birthdays or dates.
- Financial figures (salary, revenue, net worth, runway numbers).
- Health, legal, or therapy status.
- Demographics (relationship status, family context, age, location) —
  **deferred to v2** pending usage data per the re-validation gate.
- LinkedIn URL or any other external-source identifier — **deferred**
  until a written host-agent-fetch contract and a "what counts as a
  public profile field" privacy floor exist.

## Loader contract

Host agents read `.agent-user.md` at session start, in this priority
order:

1. `.agent-user.md` at project root (this contract).
2. `personal.user_name` in `.agent-settings.yml` (legacy fallback).
3. Nothing — agent uses generic address forms.

The host agent surfaces the user's `identity.nickname` (or `name` if
unset) on first reply when the file is present.

## Determinism floor

The `agent-config` package itself contains **zero network code**.
External enrichment (e.g. LinkedIn profile fetch) was rejected by the
[external-sources council](../../agents/council-sessions/2026-05-14-agent-user-external-sources/prompt-v2-public-only.md)
on determinism / ToS / test-impossibility grounds, and the host-agent
delegation workaround was additionally rejected by the
[step-3 re-validation gate](../../agents/council-responses/step-3-revalidation-gate.json)
on contract-floor grounds. v1 is paste-only via `/agents user init`.

## Staleness

When `last_updated` is older than 90 days, any `/agents user *`
command surfaces a one-line warning (not a blocker):

```
⚠️  .agent-user.md was last updated YYYY-MM-DD (>90 days ago). Run /agents user review or /agents user update.
```

## Commands

| Command | Role |
|---|---|
| `/agents user init` | Creates the file from a short interview. Refuses overwrite without `--force`. |
| `/agents user show` | Read-only render. (Phase 2.) |
| `/agents user review` | List buffered observations. (Phase 3.) |
| `/agents user accept` | Apply selected observations; bumps `last_updated`. (Phase 3.) |
| `/agents user update` | Open in IDE for manual edit; validates on save. (Phase 3.) |

See [`command-clusters.md`](command-clusters.md) for the locked
cluster registration.

## Observation buffer

Agents MAY append observations about the user (preferred reply style,
detected language drift, repeated correction patterns) to a separate
JSONL buffer at the project root:

```
.agent-user.observations.jsonl
```

The buffer is **append-only**, gitignored, and never read by the
host-agent loader directly. It only feeds `/agents user review` →
`/agents user accept`.

Each line is a single JSON object:

```json
{"ts":"2026-05-15T10:23:00Z","field":"style.pace","suggest":"rapid","source":"chat","evidence":"user said 'mach kürzer' 3× this session"}
```

Allowed `field` values mirror the schema (`identity.nickname`,
`language`, `role`, `style.formality`, `style.pace`, `voice_sample`,
`notes`). Anything outside that set is dropped on read.

Privacy floor applies on write — never buffer credentials, third-party
PII, financial figures, or health/legal status. The same
[exclusions list](#explicit-exclusions) governs both `.agent-user.md`
and the buffer.

## Gitignore

`.agent-user.md` and `.agent-user.observations.jsonl` are added to the
package-managed `.gitignore` block
([`config/gitignore-block.txt`](../../config/gitignore-block.txt)) and
ignored by default. A `--shared` opt-in to commit `.agent-user.md` is
deferred — only the doc note lands in v1. The observation buffer is
**never** shared.

## Example

A complete, paste-ready fixture lives at
[`docs/examples/agent-user.example.md`](../examples/agent-user.example.md).
Copy it to the project root as `.agent-user.md` and edit, or run
`/agents user init` for the interactive flow.

## See also

- [`language-and-tone`](../../.agent-src/rules/language-and-tone.md) — language-mirroring rule the loader feeds.
- [`agents-md-thin-root`](../../.agent-src/skills/agents-md-thin-root/SKILL.md) — Thin-Root contract that this file complements (user-state vs project-state).
- Roadmap: [`agents/roadmaps/step-3-agent-user-persona.md`](../../agents/roadmaps/step-3-agent-user-persona.md).
