# Recruit — `<short-handle>`

> **step-13 Phase 1 intake template.** One file per recruit. Filename:
> `<YYYY-MM-DD>-<source>-<handle>.md` (e.g. `2026-05-20-indiehackers-jsmith.md`).
> The maintainer fills this in **before** the recruit's first session; the
> session-log section gets appended live during the walkthrough.

## Identity & source

- **Handle / display name:** `<as-they-want-to-be-credited>`
- **Source channel:** (indie-hackers | r/ContentWritingJobs | product-hunt | direct-dm | other)
- **First contact:** YYYY-MM-DD via `<thread-url-or-DM-context>`
- **Role / self-description:** `<one-line, in their words>`
- **User-type fit:** (consultant | creator | founder | finance | ops | gtm | other)
- **Tool host they already use:** (claude-desktop | claude-code | cursor | windsurf | copilot | chatgpt-web | none)

## Consent

- **Attribution:** (full-name-OK | first-name-OK | role-only | fully-anonymous)
- **Screenshot publication:** (yes | yes-with-redaction | no)
- **Verbatim quote publication:** (yes | yes-with-review | no)
- **Case-study publication if outcome lands:** (yes | maybe-revisit | no)
- **Consent record:** `<link-to-dm-or-email-thread-or-signed-form>`

> Consent gate per step-13 Phase 1 row 3 — a recruit without an explicit
> consent record cannot anchor `agents/evidence/eval-findings/`. Anonymised
> finding is acceptable; missing consent record is not.

## Pre-session readiness

- [ ] Recruit has Claude Desktop installed *(or equivalent MCP host)*
- [ ] Recruit has a real task ready to bring to the session
- [ ] Maintainer has [`docs/mcp-server.md`](../mcp-server.md) open in another tab
- [ ] Maintainer has stopwatch / screen-recording ready for the install-time
  measurement (Phase 1 row 2 — `< 10 minutes` gate)

## Session log

Append-only during the walkthrough. Timestamp every observation;
"silent" minutes are also a signal.

```
HH:MM  start — recruit shares screen, opens Claude Desktop
HH:MM  install step 1 (`task mcp:setup`): outcome / friction / quote
HH:MM  install step 2 (Claude Desktop config paste): outcome / friction / quote
HH:MM  first invocation attempt: prompt / which skill fired / verdict
...
HH:MM  end — total install time: __ min __ s
```

## Friction inventory

At least **two** real friction points (per step-12 Phase 7 L130 spirit).
Empty list = the session wasn't real.

1. <where they stalled, in their words> → <what we fixed / parked>
2. <...>

## Outcome verdict

- **MCP setup time:** `__ minutes __ seconds` (gate: `< 10 min`)
- **First useful invocation reached without terminal?:** (yes | no | partial)
- **Recruit would recommend to a peer?:** (yes | maybe | no | declined-to-answer)
- **Eligible to anchor `agents/evidence/eval-findings/`?:** (yes | no — reason)

## Cross-links

- **Eval-finding file (if logged):** `agents/evidence/eval-findings/YYYY-MM-DD-<slug>.md`
- **Case-study file (if subject opted in):** `docs/case-studies/YYYY-MM-DD-<type>-<slug>.md`
- **Roadmap rows closed by this session:**
  - step-13 P1 row 1 (recruit) — yes / no
  - step-13 P1 row 2 (`< 10 min` gate) — yes / no
  - step-13 P1 row 3 (consent record) — yes / no

## Maintainer follow-up

- [ ] Eval-finding committed
- [ ] Recruit thanked + sent the published finding link
- [ ] Skill-description deltas filed *(any friction that maps to a
  skill description widening or a missing trigger phrase)*
- [ ] Case-study slot offered *(if outcome was useful + consent allows)*
