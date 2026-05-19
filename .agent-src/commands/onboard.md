---
name: onboard
tier: 0
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
  [`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md).

## Preconditions

`.agent-settings.yml` exists. If missing, tell the user to run
`scripts/install` (or `python3 scripts/install.py`) first and stop — this
command assumes the file and its template-derived defaults are in place.

## Steps

### 1. Greet and set expectations

Keep it short. One line explaining this is the one-time setup, up to
nine questions, one at a time, following the iron law (`user-interaction`).

### 2. Offer user-global cross-project defaults

Detect whether `~/.event4u/agent-config/agent-settings.yml` already
exists (or the legacy `~/.config/agent-config/agent-settings.yml`,
which is read as a fallback by every loader). The new path namespaces
every package-owned user-global artefact under one root — same place
where `anthropic.key`, `openai.key`, and `council-spend.jsonl` now
live.

- **File exists** → skip this step entirely. Re-onboarding never
  overwrites a user-global file silently.
- **File missing AND first-time setup heuristic** — heuristic for
  "first machine setup": no other `.agent-settings.yml` in any
  sibling project on disk. Conservative shell probe:
  `find $(dirname "$PWD") -maxdepth 3 -name .agent-settings.yml 2>/dev/null | grep -v "^$PWD/" | head -1`
  → non-empty means the developer has done this before, **skip**.
  → empty means first-time setup, ask:

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

If the user picks `1`, **defer the write** to a tail step
(see step 9 below). Capture the choice in working memory only; do
**not** create the file here. The file gets written **after** the
project-local values are confirmed, so its initial values mirror
what the developer just chose for this project.

If the user picks `2`, set a working-memory flag to skip step 9.

### 3. Capture `personal.user_name`

Skip if already set (non-empty). Otherwise:

```
> What first name should I use when talking to you?
>
> 1. Type your name
> 2. Skip — stay anonymous
```

Free-text answer → write to `personal.user_name`. `2` → leave empty.

### 4. Capture `personal.ide` (with auto-detect)

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

### 5. Capture `personal.pr_comment_bot_icon`

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
rtk post-install steps (telemetry off, init --global) per the
[`rtk-output-filtering`](../skills/rtk-output-filtering/SKILL.md) skill.
`3` → leave `rtk_installed: false` and move on. No "ask again tomorrow"
logic — `/onboard` is one-shot.

### 7. Confirm `cost_profile` and learning loop

Read current `cost_profile` and `pipelines.skill_improvement` values.
Present them plainly (they already have sensible defaults from the
template — `balanced` + `skill_improvement: true`; rationale lives in
[`docs/contracts/cost-profile-defaults.md`](../docs/contracts/cost-profile-defaults.md)):

```
> Cost profile: {current} (balanced by default — kernel + tier-1 auto-rules)
> Learning loop (skill_improvement): {current} (true by default)
>
> 1. Keep defaults — recommended
> 2. Change cost profile — opens /set-cost-profile
> 3. Disable learning loop — sets pipelines.skill_improvement=false
```

`2` → defer to `/set-cost-profile` and return here. `3` → flip the toggle.

### 7a. Capture `user_type` and `profile.id` (role selection)

Skip if `profile.id` is already set in `.agent-settings.yml` — re-running
`/onboard` never silently overwrites a previously chosen role. If unset,
ask:

```
> Which audience fits you best? This picks the audience profile that
> shapes which skills, rules, and MCP servers the agent surfaces.
>
> 1. Software — coder, engineer, technical lead         → developer
> 2. Content — writer, creator, editorial               → content_creator
> 3. Founder — solo founder, early-stage CEO            → founder
> 4. Consulting — agency, freelance, client work        → agency
> 5. Marketing — campaigns, growth, brand               → content_creator
> 6. Finance — bookkeeping, controlling, CFO            → finance
> 7. Handwerk — operations, trades, admin               → ops
> 8. Self-configure — leave profile.id empty, I'll edit .agent-settings.yml manually
```

Map answer → write **both** keys to `.agent-settings.yml` (one block,
section-aware merge):

- `personal.user_type`: the label as `"software" | "content" | "founder"
  | "consulting" | "marketing" | "finance" | "handwerk" | "self_configure"`
  (stable audit field; never auto-mutated).
- `profile.id`: the profile-loader id from the right column. Choice `8`
  → leave `profile.id` unset (loader falls back to its default chain
  documented in [`docs/contracts/profile-system.md`](../docs/contracts/profile-system.md)).

Six profile YAMLs ship today (`developer` · `content_creator` · `founder`
· `agency` · `finance` · `ops`) — Marketing collapses into
`content_creator` per the closest-audience mapping. Verify the chosen
id exists at
[`.agent-src.uncompressed/profiles/<id>.yml`](../../.agent-src.uncompressed/profiles/)
before writing; missing file → fall back to `self_configure` and surface
the path so the user can author it later.

### 7b. Stack confirmation

Skip if `stack.detected` is already non-empty (re-runnable). Otherwise
run the offline shell probe and present the result for confirmation —
no network call, file-existence only:

```bash
stacks=()
if [ -f composer.json ]; then
  if grep -q '"laravel/framework"' composer.json 2>/dev/null; then
    stacks+=("php-laravel")
  elif grep -q '"symfony/framework-bundle"' composer.json 2>/dev/null; then
    stacks+=("php-symfony")
  else
    stacks+=("php")
  fi
fi
[ -f package.json ] && stacks+=("node")
[ -f Cargo.toml ] && stacks+=("rust")
[ -f go.mod ] && stacks+=("go")
[ -f pyproject.toml ] || [ -f requirements.txt ] && stacks+=("python")
[ -f Gemfile ] && stacks+=("ruby")
```

Then:

- **One stack found** → confirm:
  `> Detected {stack}. 1. Yes, use it  2. Override (pick from list)  3. Skip — I'll set stack.detected later`
- **Multiple stacks found** → list them:
  `> Detected {a, b}. 1. Use all  2. Pick primary  3. Skip`
- **None found** → ask:
  ```
  > No stack manifest found in this project root. Pick the primary stack
  > so profile-aware presets can resolve (this is advisory; the agent
  > re-detects on each session):
  >
  > 1. php          2. node         3. rust
  > 4. go           5. python       6. ruby
  > 7. Skip — leave stack.detected empty
  ```

Write the result to `.agent-settings.yml`:

```yaml
stack:
  detected: ["php"]              # or ["php","node"], or [] for skip
  source: "wizard"               # audit field: wizard | probe | manual
```

### 7c. Risk-appetite (`preset.id`)

Skip if `preset.id` is already set. Otherwise ask:

```
> Risk appetite for autonomy, cost caps, and council usage:
>
> 1. fast      — minimal floors, higher daily caps, council auto-consult on
> 2. balanced  — default — moderate caps, council on-demand
> 3. strict    — tight caps, council disabled, high-confidence required
>
> Recommendation: 2 (balanced).
>
> See docs/contracts/config-presets.md for the per-knob comparison.
```

Map answer → write `preset.id: "fast" | "balanced" | "strict"` to
`.agent-settings.yml`. Default fallback (no answer / cloud surface) is
`balanced`, mirroring the loader default at
[`scripts/config/presets.py`](../../scripts/config/presets.py).

### 8. Mark onboarded

Write `onboarding.onboarded: true` to `.agent-settings.yml` using the
section-aware merge rules from
[`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
(preserve comments, key order, touch only the changed fields).

At this point the file holds the full wizard output:

```yaml
profile:
  id: "developer"          # step 7a (omitted if user picked Self-configure)
preset:
  id: "balanced"           # step 7c
personal:
  user_type: "software"    # step 7a — stable audit field
  user_name: "..."
  ide: "..."
  # ...other personal.* from earlier steps
stack:
  detected: ["php"]        # step 7b
  source: "wizard"
onboarding:
  onboarded: true          # this step
```

Verify the chain resolves before flipping `onboarded: true`:

```bash
./agent-config explain config --json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['profile']['id'], d['preset']['id'])"
```

Non-zero exit → surface the error, keep `onboarded: false`, ask the user
to re-run `/onboard`. Zero exit → write `onboarded: true`.

### 9. Write user-global file (only if opted in at step 2)

Skip this step unless step 2 captured an explicit "yes" from the user.
Re-confirm intent in one line — never silent-write a file outside the
project tree:

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
the migration shim in `scripts/install.py` moves any legacy
`~/.config/agent-config/` files into the new namespace on first run),
then write the file with mode `0600`. The schema is **flat-or-nested
YAML keyed on the dotted paths** in the whitelist documented in
[`scripts/_lib/agent_settings.py`](../../scripts/_lib/agent_settings.py).
Use the same section-aware merge rules from
[`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
**only if the file unexpectedly already exists** between step 2 and
this step (race condition); otherwise create from scratch with the
exact six keys above and a one-line file header comment:

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

  profile.id: {value or — (Self-configure)}
  preset.id: {value or balanced}
  personal.user_type: {value}
  stack.detected: {comma-list or —}
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

### 11. Quickstart pointer — next command after onboarding

Print the next-action block so the developer does **not** have to re-find
the README to start work. One screen, no question, no prompt:

```
🚀  Next step — your first real task

  Try one of these from the same chat:

    /work "your first real task"
        Free-form prompt — agent refines, plans, implements, tests,
        verifies, reports. A decision_result entry lands in agents/state/
        confirming the work-engine ran end-to-end.

    /implement-ticket PROJ-123
        Ticket-driven flow — pulls Jira/Linear context, runs the same
        refine → memory → analyze → plan → implement → test → verify
        → report sequence, halts on ambiguity.

  Both honour the decision_engine gates in .agent-settings.yml
  (see docs/contracts/decision-engine-gates.md for the schema).
```

Skip this block in cloud surfaces (the cloud agent's invocation surface
is already the chat window).

### 12. Maintainer-only feature pointer

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
  Contract + privacy floor: .augment/contexts/contracts/artifact-engagement-flow.md
```

Skip this block in cloud surfaces (no settings file, no log path).

## Gotchas

- `.agent-settings.yml` is git-ignored. This command never commits.
- One question per turn. The iron law from `ask-when-uncertain` applies;
  do not stack questions 2–9 into a single prompt.
- Re-running `/onboard` when `onboarded: true` is allowed — walk through
  all steps again and rewrite the values the user confirms.
- Never overwrite a non-empty value without asking (applies to `user_name`,
  `ide`, `profile.id`, `preset.id`, `personal.user_type`, and
  `stack.detected`).
- **Offline-only.** Steps 7a / 7b / 7c never call out to the network.
  Stack probe = file existence; profile / preset resolution = local YAML
  reads only.
- **User-global file is opt-in, one-shot, never silent.** Step 2 captures
  intent, step 9 re-confirms before the actual write. If
  `~/.event4u/agent-config/agent-settings.yml` (or the legacy
  `~/.config/agent-config/agent-settings.yml`) already exists when
  `/onboard` starts, step 2 is skipped entirely — re-onboarding never
  silently rewrites a developer's cross-project defaults. Use
  `/sync-agent-settings` (project-scoped only) or edit the file
  manually for mid-life changes.

## Cloud Behavior

On cloud surfaces (Claude.ai Web, Skills API) this command is **fully inert** —
there is no `.agent-settings.yml` to write, no `onboarding.onboarded` key to
flip, and no local IDE/rtk environment to capture. First-run setup is a
local-agent concern; the cloud agent should proceed without invoking it.

## See also

- [`onboarding-gate`](../rules/onboarding-gate.md) — rule that triggers this command
- [`set-cost-profile`](set-cost-profile.md) — isolated profile change
- [`layered-settings`](../docs/guidelines/agent-infra/layered-settings.md) — merge rules for mid-life edits
- [`agent-settings` template](../templates/agent-settings.md) — settings reference
- [`scripts/_lib/agent_settings.py`](../../scripts/_lib/agent_settings.py) — centralized loader + whitelist that consumes the user-global file
