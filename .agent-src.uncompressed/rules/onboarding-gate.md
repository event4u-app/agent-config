---
type: "always"
description: "First-run gate — when onboarding.onboarded is false in .agent-settings.yml, prompt the user to run /onboard before anything else"
alwaysApply: true
source: package
---

# Onboarding Gate

Forces a one-time `/onboard` run for each developer on each project. This
replaces the previously scattered "ask once" patterns across `user_name`,
`personal.ide`, `personal.rtk_installed`, and cost profile confirmation.

## When to activate

Read `onboarding.onboarded` from `.agent-settings.yml` **once per
conversation**, on the very first agent turn.

- Key missing entirely → **legacy project**. Treat as onboarded, do
  nothing. Do not write the key.
- `true` → do nothing. Rule is inert for the rest of the conversation.
- `false` → gate is active for this conversation (see below).

Cache the result for the whole conversation. Do not re-read on every turn.

## Gate behavior when `onboarded: false`

On the **first** turn of the conversation, before executing the user's
request, emit this prompt and stop:

```
> 👋 First-run setup hasn't been completed for this project.
>
> Run /onboard once (≈2 minutes) to capture:
> • your name, IDE, and rtk status
> • cost profile + learning loop confirmation
>
> 1. Run /onboard now
> 2. Skip — mark as onboarded and continue with the request
> 3. Snooze — continue just this turn; ask again next conversation
```

- `1` → invoke `/onboard`. Resume the user's original request afterwards.
- `2` → set `onboarding.onboarded: true` in `.agent-settings.yml` (touch
  only that field; preserve comments and order). Then execute the
  original request.
- `3` → proceed with the original request. Do not ask again in this
  conversation. Do not write the file.

Free-text replies (`"mach weiter"`, `"just do it"`) count as `3`.

## Exceptions — do NOT block

Skip the gate when the user's request already is an onboarding or
settings operation, so we don't prompt users mid-setup:

- `/onboard`, `/config-agent-settings`, `/set-cost-profile`, `/mode`
- The user explicitly asks about `.agent-settings.yml` or onboarding
- Incident / break-glass signals (`hotfix`, `break-glass`, `"prod is
  down"`). The gate waits for normal operations to resume.

## Non-blocking for legacy projects

If `.agent-settings.yml` exists but has no `onboarding` section at all,
treat as onboarded. Only `onboarded: false` (explicit) triggers the
gate. This protects projects that were set up before this rule shipped.

## What this rule does NOT do

- Write `onboarded: true` automatically. Only `/onboard` (step 6) and
  the user's explicit `2` choice do that.
- Re-prompt across turns in the same conversation. One prompt per
  conversation, max.
- Replace `/config-agent-settings`. That command handles mid-life
  settings drift; this rule is a one-time gate.
- Run on every agent turn. First turn only.

## Interactions

- `ask-when-uncertain` — the gate uses its numbered-options iron law;
  one question per turn.
- `language-and-tone` — prompt is translated to the user's language at
  runtime; `.md` source stays English.
- `scope-control` — option `2` writes exactly one key; no side effects.
- `role-mode-adherence` — gate runs BEFORE the mode marker is emitted.

## See also

- [`/onboard`](../commands/onboard.md) — the command this gate invokes
- [`/config-agent-settings`](../commands/config-agent-settings.md) — mid-life sync
- [`agent-settings` template](../templates/agent-settings.md) — `onboarding.onboarded` reference
- [`rule-type-governance`](rule-type-governance.md) — why this is `always`
