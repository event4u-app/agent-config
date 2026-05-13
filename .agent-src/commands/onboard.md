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

Centralized first-run flow. Bundles scattered "ask once" prompts (user_name,
IDE, rtk install, cost profile, learning loop) into one interactive setup.
Ends by setting `onboarding.onboarded: true` in `.agent-settings.yml`.

Triggered by [`onboarding-gate`](../rules/onboarding-gate.md) when
`onboarding.onboarded` is `false`, or by explicit re-run.

## When NOT to use

- Change cost profile only → [`/set-cost-profile`](set-cost-profile.md).
- Single-value edit → ask agent to change it, or edit `.agent-settings.yml`
  directly per [`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md).

## Preconditions

`.agent-settings.yml` exists. If missing, tell user to run `scripts/install`
(or `python3 scripts/install.py`) first and stop — command assumes file +
template defaults are in place.

## Steps

### 1. Greet and set expectations

One line: one-time setup, six questions, one at a time (iron law from
`user-interaction`).

### 2. Offer user-global cross-project defaults

Detect whether `~/.event4u/agent-config/agent-settings.yml` exists (or
legacy `~/.config/agent-config/agent-settings.yml`, read as fallback by
every loader). New path namespaces every package-owned user-global
artefact under one root — same place `anthropic.key`, `openai.key`,
`council-spend.jsonl` now live.

- **File exists** → skip step entirely. Re-onboarding never overwrites
  user-global file silently.
- **File missing AND first-time setup heuristic** — heuristic for "first
  machine setup": no other `.agent-settings.yml` in any sibling project on
  disk. Conservative shell probe:
  `find $(dirname "$PWD") -maxdepth 3 -name .agent-settings.yml 2>/dev/null | grep -v "^$PWD/" | head -1`
  → non-empty → developer done this before, **skip**.
  → empty → first-time setup, ask:

```
> A user-global config at ~/.event4u/agent-config/agent-settings.yml lets
> you carry your DX-comfort defaults (name, IDE, autonomy, cost profile,
> communication style) across every project that uses event4u/agent-config.
>
> Project-local .agent-settings.yml always wins. Only six keys are
> mergeable from the user-global file:
>   name · ide · cost_profile · personal.bot_icon · personal.autonomy · caveman.speak_scope
>
> 1. Yes — create it after this onboarding finishes
> 2. No — keep settings project-local only
```

If user picks `1`, **defer write** to tail step (see step 9). Capture choice
in working memory only; do **not** create file here. File gets written
**after** project-local values are confirmed, so initial values mirror
what developer just chose for this project.

If user picks `2`, set working-memory flag to skip step 9.

### 3. Capture `personal.user_name`

Skip if already set (non-empty). Otherwise:

```
> What first name should I use when talking to you?
>
> 1. Type your name
> 2. Skip — stay anonymous
```

Free-text → write to `personal.user_name`. `2` → leave empty.

### 4. Capture `personal.ide` (with auto-detect)

Skip if set. Otherwise auto-detect first:

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

If IDE set, also ask `personal.open_edited_files` (`true`/`false`).

### 5. Capture `personal.pr_comment_bot_icon`

Personal preference — each developer decides how own PR replies look. Skip
only if user already set non-default deliberately (agent can't tell, so
always ask on first run):

```
> When I reply to PR review comments on your behalf, should I prefix each
> reply with 🤖 so reviewers can tell it was a bot-authored reply?
>
> 1. Yes — prefix replies with 🤖 (transparent to reviewers)
> 2. No — plain replies, no prefix (default)
```

`1` → write `personal.pr_comment_bot_icon: true`. `2` → leave `false`.

### 6. Detect `personal.rtk_installed`

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
rtk post-install steps (telemetry off, init --global) per
[`rtk-output-filtering`](../skills/rtk-output-filtering/SKILL.md).
`3` → leave `rtk_installed: false`, move on. No "ask again tomorrow" —
`/onboard` is one-shot.


### 7. Confirm `cost_profile` and learning loop

Read current `cost_profile` and `pipelines.skill_improvement` values.
Present plainly (sensible defaults from template — `minimal` +
`skill_improvement: true`):

```
> Cost profile: {current} (minimal by default — includes the learning loop)
> Learning loop (skill_improvement): {current} (true by default)
>
> 1. Keep defaults — recommended
> 2. Change cost profile — opens /set-cost-profile
> 3. Disable learning loop — sets pipelines.skill_improvement=false
```

`2` → defer to `/set-cost-profile` and return here. `3` → flip toggle.

### 8. Mark onboarded

Write `onboarding.onboarded: true` to `.agent-settings.yml` using
section-aware merge rules from
[`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
(preserve comments, key order, touch only changed fields).

### 9. Write user-global file (only if opted in at step 2)

Skip unless step 2 captured explicit "yes". Re-confirm intent in one line —
never silent-write a file outside project tree:

```
> Writing ~/.event4u/agent-config/agent-settings.yml with the six
> mergeable keys mirrored from this project's choices:
>
>   name: {personal.user_name or ""}
>   ide: {personal.ide or ""}
>   cost_profile: {cost_profile}
>   personal.bot_icon: {personal.pr_comment_bot_icon}
>   personal.autonomy: {personal.autonomy or "ask"}
>   caveman.speak_scope: {caveman.speak_scope or "prose_only"}
>
> 1. Yes, write it
> 2. Cancel — keep settings project-local only
```

`1` → ensure `~/.event4u/agent-config/` exists (`mkdir -p`, mode `0700`;
migration shim in `scripts/install.py` moves any legacy
`~/.config/agent-config/` files into new namespace on first run),
then write file with mode `0600`. Schema is **flat-or-nested YAML keyed on
dotted paths** in whitelist documented in
[`scripts/_lib/agent_settings.py`](../../scripts/_lib/agent_settings.py).
Use same section-aware merge rules from
[`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
**only if file unexpectedly already exists** between step 2 and this step
(race condition); otherwise create from scratch with exact six keys above
and a one-line file header comment:

```yaml
# event4u/agent-config — user-global DX-comfort defaults
# Whitelist: name · ide · cost_profile · personal.bot_icon · personal.autonomy · caveman.speak_scope
# Project-local .agent-settings.yml always wins. See docs/customization.md.
```

`2` → no write, no error, no second ask. Move on.

### 10. Summary

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
  user-global: {"written" if step 9 wrote · "—" otherwise}

You can re-run this with /onboard anytime, or edit .agent-settings.yml
directly — the agent follows the merge rules in `layered-settings` when
you ask it to change a value.
```

### 11. Maintainer-only feature pointer

Print one-screen hint after summary — no question, no prompt, just pointer
for maintainers who want to opt into artefact-engagement telemetry layer.
Consumers can ignore; feature is **default-off** and stays off unless
explicitly enabled.

```
ℹ️  Maintainer telemetry (opt-in)

  telemetry.artifact_engagement is off by default. If you maintain skills,
  rules, or commands and want to see which ones the agent actually applies,
  set telemetry.artifact_engagement.enabled: true in .agent-settings.yml.

  The log is local-only JSONL — nothing uploaded, nothing shared across
  projects. Reports: ./agent-config telemetry:report
  Contract + privacy floor: .augment/contexts/contracts/artifact-engagement-flow.md
```

Skip this block in cloud surfaces (no settings file, no log path).

## Gotchas

- `.agent-settings.yml` is git-ignored. Command never commits.
- One question per turn. Iron law from `ask-when-uncertain` applies; do
  not stack questions 2–9 into single prompt.
- Re-running `/onboard` when `onboarded: true` is allowed — walk through
  all steps again and rewrite values user confirms.
- Never overwrite non-empty value without asking (applies to `user_name`,
  `ide`).
- **User-global file is opt-in, one-shot, never silent.** Step 2 captures
  intent, step 9 re-confirms before actual write. If
  `~/.event4u/agent-config/agent-settings.yml` (or legacy
  `~/.config/agent-config/agent-settings.yml`) already exists when
  `/onboard` starts, step 2 is skipped entirely — re-onboarding never
  silently rewrites developer's cross-project defaults. Use
  `/sync-agent-settings` (project-scoped only) or edit file manually for
  mid-life changes.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) this command is **fully inert** —
no `.agent-settings.yml` to write, no `onboarding.onboarded` key to flip,
no local IDE/rtk env to capture. First-run setup is local-agent concern;
cloud agent should proceed without invoking it.

## See also

- [`onboarding-gate`](../rules/onboarding-gate.md) — rule that triggers this command
- [`set-cost-profile`](set-cost-profile.md) — isolated profile change
- [`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md) — merge rules for mid-life edits
- [`agent-settings` template](../templates/agent-settings.md) — settings reference
- [`scripts/_lib/agent_settings.py`](../../scripts/_lib/agent_settings.py) — centralized loader + whitelist that consumes the user-global file
