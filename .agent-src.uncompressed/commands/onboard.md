---
name: onboard
description: First-run setup for a developer on this project — captures name, IDE, bot-icon preference, rtk, cost_profile, and learning opt-out, then sets onboarding.onboarded=true
skills: [file-editor]
disable-model-invocation: true
suggestion:
  eligible: false
  rationale: "Gated by the onboarding-gate rule already; never inferred from prose."
---

<!-- cloud_safe: noop -->

# /onboard

Centralized first-run flow. Bundles what used to be scattered "ask once"
prompts (user_name, IDE, rtk install, cost profile, learning loop) into a
single interactive setup. Ends by setting `onboarding.onboarded: true` in
`.agent-settings.yml`.

Triggered by the [`onboarding-gate`](../rules/onboarding-gate.md) rule when
`onboarding.onboarded` is `false` or by the user explicitly re-running it.

## When NOT to use

- Change cost profile only → [`/set-cost-profile`](set-cost-profile.md).
- Single-value edit → ask the agent to change it, or edit
  `.agent-settings.yml` directly. The agent follows the merge rules in
  [`layered-settings`](../guidelines/agent-infra/layered-settings.md).

## Preconditions

`.agent-settings.yml` exists. If missing, tell the user to run
`scripts/install` (or `python3 scripts/install.py`) first and stop — this
command assumes the file and its template-derived defaults are in place.

## Steps

### 1. Greet and set expectations

Keep it short. One line explaining this is the one-time setup, six
questions, one at a time, following the iron law (`user-interaction`).

### 2. Capture `personal.user_name`

Skip if already set (non-empty). Otherwise:

```
> What first name should I use when talking to you?
>
> 1. Type your name
> 2. Skip — stay anonymous
```

Free-text answer → write to `personal.user_name`. `2` → leave empty.

### 3. Capture `personal.ide` (with auto-detect)

Skip if already set. Otherwise auto-detect first:

```bash
ps aux | grep -iE '(Visual Studio Code|Code Helper|phpstorm|cursor)' | grep -v grep
```

- Detected → confirm: `> Detected {ide}. 1. Yes, use it  2. Pick another  3. Skip`.
- Not detected → ask:

```
> Which IDE do you use for this project?
>
> 1. VS Code (code)
> 2. PhpStorm (phpstorm)
> 3. Cursor (cursor)
> 4. Skip — I'll configure it later
```

If IDE is set, also ask about `personal.open_edited_files` (`true`/`false`).

### 4. Capture `personal.pr_comment_bot_icon`

Personal preference — each developer decides how their own PR replies
should look. Skip only if the user has already set a non-default value
deliberately (agent can't tell, so always ask on first run):

```
> When I reply to PR review comments on your behalf, should I prefix each
> reply with 🤖 so reviewers can tell it was a bot-authored reply?
>
> 1. Yes — prefix replies with 🤖 (transparent to reviewers)
> 2. No — plain replies, no prefix (default)
```

`1` → write `personal.pr_comment_bot_icon: true`. `2` → leave `false`.

### 5. Detect `personal.rtk_installed`

Silent `which rtk`.

- **Found** → write `personal.rtk_installed: true`. No question.
- **Not found** → ask:

```
> rtk (Rust Token Killer) is not installed. It cuts verbose CLI output by
> 60–90% and saves tokens on long test/log/git runs.
>
> 1. Install via Homebrew — brew install rtk
> 2. Install via Cargo — cargo install rtk
> 3. Skip for now — continue without it
```

`1` or `2` → run install, on success set `rtk_installed: true` and apply
rtk post-install steps (telemetry off, init --global) per the
[`rtk-output-filtering`](../skills/rtk-output-filtering/SKILL.md) skill.
`3` → leave `rtk_installed: false` and move on. No "ask again tomorrow"
logic — `/onboard` is one-shot.

### 6. Confirm `cost_profile` and learning loop

Read current `cost_profile` and `pipelines.skill_improvement` values.
Present them plainly (they already have sensible defaults from the
template — `minimal` + `skill_improvement: true`):

```
> Cost profile: {current} (minimal by default — includes the learning loop)
> Learning loop (skill_improvement): {current} (true by default)
>
> 1. Keep defaults — recommended
> 2. Change cost profile — opens /set-cost-profile
> 3. Disable learning loop — sets pipelines.skill_improvement=false
```

`2` → defer to `/set-cost-profile` and return here. `3` → flip the toggle.

### 7. Mark onboarded

Write `onboarding.onboarded: true` to `.agent-settings.yml` using the
section-aware merge rules from
[`layered-settings`](../guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
(preserve comments, key order, touch only the changed fields).

### 8. Summary

Echo what was captured, in one block:

```
✅  Onboarding complete.

  personal.user_name: {value or —}
  personal.ide: {value or —}
  personal.open_edited_files: {value}
  personal.pr_comment_bot_icon: {value}
  personal.rtk_installed: {value}
  cost_profile: {value}
  pipelines.skill_improvement: {value}
  onboarding.onboarded: true

You can re-run this with /onboard anytime, or edit .agent-settings.yml
directly — the agent follows the merge rules in `layered-settings` when
you ask it to change a value.
```

### 9. Maintainer-only feature pointer

Print a one-screen hint after the summary — no question, no prompt, just a
pointer for maintainers who want to opt into the artefact-engagement
telemetry layer. Consumers can ignore it; the feature is **default-off**
and stays off unless explicitly enabled.

```
ℹ️  Maintainer telemetry (opt-in)

  telemetry.artifact_engagement is off by default. If you maintain skills,
  rules, or commands and want to see which ones the agent actually applies,
  set telemetry.artifact_engagement.enabled: true in .agent-settings.yml.

  The log is local-only JSONL — nothing uploaded, nothing shared across
  projects. Reports: ./agent-config telemetry:report
  Contract + privacy floor: docs/contracts/artifact-engagement-flow.md
```

Skip this block in cloud surfaces (no settings file, no log path).

## Gotchas

- `.agent-settings.yml` is git-ignored. This command never commits.
- One question per turn. The iron law from `ask-when-uncertain` applies;
  do not stack questions 2–6 into a single prompt.
- Re-running `/onboard` when `onboarded: true` is allowed — walk through
  all steps again and rewrite the values the user confirms.
- Never overwrite a non-empty value without asking (applies to `user_name`
  and `ide`).

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) this command is **fully inert** —
there is no `.agent-settings.yml` to write, no `onboarding.onboarded` key to
flip, and no local IDE/rtk environment to capture. First-run setup is a
local-agent concern; the cloud agent should proceed without invoking it.

## See also

- [`onboarding-gate`](../rules/onboarding-gate.md) — rule that triggers this command
- [`set-cost-profile`](set-cost-profile.md) — isolated profile change
- [`layered-settings`](../guidelines/agent-infra/layered-settings.md) — merge rules for mid-life edits
- [`agent-settings` template](../templates/agent-settings.md) — settings reference
