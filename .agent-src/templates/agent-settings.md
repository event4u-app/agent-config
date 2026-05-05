# Agent Settings Template

User-specific agent settings stored in `.agent-settings.yml` (project root,
git-ignored). This file is **not committed** — each developer has their own
settings.

## File format

**YAML**, with a single top-level scalar (`cost_profile`) plus one level of
grouped sections (`personal`, `project`, `github`, `eloquent`, `pipelines`,
`subagents`). Comments with `#`.

Keep the format regular — 2-space indent, no tabs, no lists, one nesting
level only. The installer's YAML handler is a restricted stdlib parser, not
a full YAML engine. Ask the agent to normalize after manual edits — it
follows the merge rules in
[`layered-settings`](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules).

### Migration from the legacy `.agent-settings` (key=value)

If a project still has the old flat `.agent-settings` file, the next run of
`scripts/install` migrates it automatically:

1. Reads `.agent-settings` (key=value)
2. Maps each key into its new nested path (see Rename-Map below)
3. Writes `.agent-settings.yml` (YAML with sections)
4. Leaves a one-shot backup `.agent-settings.backup.key-value`
5. Deletes the old `.agent-settings`

The migration runs exactly once. On subsequent runs the YAML file already
exists and is the source of truth.

## Template

This block defines the personal and project-level settings that
`scripts/install.py` (via `config/agent-settings.template.yml`)
writes to `.agent-settings.yml` on first install. Subsequent edits are
made by the user directly or by the agent on request, following the
[section-aware merge rules](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules).

```yaml
# Agent Settings
# This file is git-ignored. Each developer has their own settings.
# Run scripts/install to create this file, then /onboard for first-run setup.

# --- Cost profile ---
#
# Controls which agent surfaces are active. See `docs/customization.md` for
# the authoritative description.
#
# minimal  = rules, skills, and commands only (zero extra surface, default)
# balanced = + runtime dispatcher for skills that declare a shell command
# full     = + tool adapters (GitHub / Jira, read-only, opt-in)
# custom   = ignore profile — every matrix value must be set explicitly
cost_profile: minimal

# --- Personal preferences ---
personal:
  # IDE to use for opening files (code, phpstorm, cursor)
  ide: ""

  # Automatically open edited files in the IDE (true, false)
  open_edited_files: false

  # User's first name — used to address the user personally
  # Captured by /onboard on first run.
  user_name: ""

  # rtk (Rust Token Killer) installed for output filtering (true, false)
  # Detected and set by /onboard on first run.
  rtk_installed: false

  # Minimal output mode (true, false)
  # true  = short bullet points during work, concise summary at the end
  # false = verbose explanations and reasoning
  minimal_output: true

  # Play-by-play mode (true, false)
  # true  = briefly share intermediate findings as you go
  # false = silently investigate, only report the conclusion
  play_by_play: false

  # Prefix PR comment replies with a bot icon 🤖 (true, false)
  # Personal preference — each developer decides for themselves.
  pr_comment_bot_icon: false

  # Autonomous execution — suppress trivial workflow questions (on, off, auto)
  # on   = act on the obvious next step; never ask "Step 2 or 3?", "should I commit?", etc.
  # off  = ask trivial workflow questions (legacy behavior)
  # auto = behaves like 'off' until the user says "arbeite selbstständig" / "work autonomously"
  #        in the conversation, then switches to 'on' for the rest of the chat.
  # Blocking decisions (security, scope expansion, push/merge/branch/PR) are NEVER suppressed.
  # See rules/autonomous-execution.md for the full definition.
  autonomy: auto

# --- Project / team preferences ---
project:
  # Path to the PR template file (relative to project root)
  pr_template: .github/pull_request_template.md

  # Target repository for universal improvement PRs (e.g. org/agent-config)
  upstream_repo: ""

  # Branch prefix for improvement PRs
  improvement_pr_branch_prefix: "improve/agent-"

# --- GitHub integration ---
github:
  # API method for replying to PR review comments
  # replies_endpoint      = POST /pulls/comments/{id}/replies (preferred)
  # create_review_comment = POST /pulls/{number}/reviews (fallback)
  # auto                  = detect on first use and update this setting
  pr_reply_method: create_review_comment

# --- Eloquent (Laravel) ---
eloquent:
  # Model property access style
  # getters_setters  = strict typed getters/setters, getAttribute() only inside model
  # get_attribute    = use getAttribute()/setAttribute() everywhere
  # magic_properties = use $model->column_name (Laravel default)
  access_style: getters_setters

# --- Chat history (crash recovery) ---
#
# Persistent JSONL log at agents/.agent-chat-history (project root, git-ignored).
# Keeps a durable record of the conversation so a crashed or switched
# agent session can be resumed. See scripts/chat_history.py for the API.
#
# Defaults below are placeholders — scripts/install.py substitutes them
# per cost_profile (see config/profiles/*.ini).
chat_history:
  # Log chat events to disk (true, false)
  enabled: true

  # Logging granularity: per_turn | per_phase | per_tool
  frequency: per_phase

  # Max file size in KB before overflow handling kicks in
  max_size_kb: 256

  # Overflow behavior: rotate (drop oldest) | compress (summarize)
  on_overflow: rotate

# --- Work-engine hooks ---
#
# Lifecycle hook surface of the `work_engine` Python engine
# (scripts/work_engine/). Hooks observe, validate, or persist around the
# six CLI events (before_load, after_load, before_dispatch,
# after_dispatch, before_save, after_save) and the dispatcher events
# (before_step, after_step, on_halt). See agents/contexts/
# work-engine-hooks.md for the full lifecycle and registration contract.
#
# Default-off by construction: when the `hooks:` block is absent the
# registry stays empty and golden-replay flows are byte-stable. Enable
# the master switch to opt in; per-hook flags then control individual
# registration.
hooks:
  # Master switch — when false (default) the registry stays empty
  # regardless of the per-hook fields below.
  enabled: false

  # TraceHook — emits per-event trace lines on stderr. Useful for
  # debugging engine flow; off by default because it is noisy.
  trace: false

  # HaltSurfaceAuditHook — defense-in-depth check that every halt
  # surfaced by the dispatcher carries the expected shape. Cheap.
  halt_surface_audit: true

  # StateShapeValidationHook — re-runs the state schema validator on
  # AFTER_LOAD and BEFORE_SAVE. Cheap, catches drift between the
  # in-memory state and the persisted JSON.
  state_shape_validation: true

  # DirectiveSetGuardHook — verifies the directive-set resolved by the
  # dispatcher matches the input envelope's intent. Cheap, catches
  # routing drift.
  directive_set_guard: true

  # Chat-history hooks — populate agents/.agent-chat-history structurally from
  # the engine. Gated by BOTH this block AND the global
  # chat_history.enabled above; either off → no chat-history hook
  # registers. Keep both on for the HOOK path; flip either off to fall
  # back to the cooperative CHECKPOINT path.
  chat_history:
    enabled: true
    # Override path to the chat-history CLI (defaults to
    # scripts/chat_history.py). Only set this when the script lives
    # outside the standard location.
    # script: scripts/chat_history.py

# --- Optional pipelines ---
pipelines:
  # Skill improvement pipeline (true, false)
  # true  = after meaningful tasks, propose learning capture and improvements (default)
  # false = silent, no post-task analysis
  # Included by every cost_profile except `custom`.
  skill_improvement: true

# --- Roadmap execution ---
#
# Controls when /roadmap execute runs the project's quality pipeline.
# Step checkboxes and the dashboard are ALWAYS updated in the same
# response — that cadence is governed by `roadmap-progress-sync` and
# is non-negotiable. This setting only governs *quality tool runs*.
roadmap:
  # When to run quality tools during /roadmap execute.
  #   end_of_roadmap = once, before archiving (default — fastest, fewest tokens)
  #   per_phase      = once after every completed phase
  #   per_step       = after every completed step (legacy; highest token cost)
  # Iron Law `verify-before-complete` still applies — fresh output is
  # mandatory before any "roadmap complete" claim, regardless of cadence.
  quality_cadence: end_of_roadmap

# --- Subagent orchestration ---
subagents:
  # Model for implementer subagents (empty = same tier as the session model)
  implementer_model: ""

  # Model for judge subagents
  # (empty = one tier above implementer: opus if sonnet, sonnet if haiku)
  judge_model: ""

  # Maximum number of parallel subagent invocations (integer, default 3)
  # Set to 1 to serialize. Hard cap enforced by runtime.
  max_parallel: 3

# --- Role modes (see guidelines/agent-infra/role-contracts.md) ---
roles:
  # Role the agent defaults to at the start of a session.
  # Allowed: "" (no default), developer, reviewer, tester, po, incident, planner
  default_role: ""

  # Role currently active. Set by /mode <name>; cleared by /mode none.
  # The rule `role-mode-adherence` (auto-triggered when non-empty)
  # requires every closing output to match the mode's contract.
  active_role: ""

# --- Personas (developer-local override of team default lens) ---
#
# Personas are reusable review lenses (see .augment/personas/README.md).
# The team default cast lives in `.agent-project-settings.yml` under
# `personas.default`. This block lets a developer narrow or widen the
# local cast without touching the team file. Ignored if the project
# locks `personas.default` via `locked_keys`.
personas:
  # Override the effective default cast for THIS developer. Empty =
  # inherit team default. Provide a full list (not a diff) to replace
  # the team cast entirely for local runs.
  override: []

  # Drop specific persona ids from the default cast without replacing
  # the whole list. Ignored personas stay invokable explicitly via
  # `--personas=<id>`. Mirrors `.augmentignore` semantics.
  ignore: []

# --- Onboarding ---
#
# Tracks whether the initial setup flow (/onboard) has been completed
# for this developer on this project. When false, the onboarding-gate
# rule prompts the user to run /onboard before starting normal work.
# Missing entirely = legacy project (treated as onboarded).
onboarding:
  # Has the developer completed /onboard? (true, false)
  # Set to true automatically by /onboard at the end. Flip to false
  # if you want to re-run the flow.
  onboarded: false

# --- Command suggestion (numbered-options shortcut finder) ---
#
# When the user's free-form prompt matches an eligible slash command,
# the agent surfaces a numbered-options block with the recommendation
# plus an always-present "run as-is" option. The suggestion layer
# never auto-executes — the user picks. See `rules/command-suggestion-policy.md`.
commands:
  suggestion:
    # Master switch (true, false). `false` = the layer is silent;
    # explicit `/commands` still work as today.
    enabled: true
    # Minimum match score (0.0–1.0) before a suggestion surfaces.
    confidence_floor: 0.6
    # Cooldown in seconds between re-suggestions of the same
    # (command, evidence) pair. Default 600 = 10m.
    cooldown_seconds: 600
    # Max number of command suggestions before the as-is option.
    # The as-is option is always extra (total rendered = max_options + 1).
    max_options: 4
    # Commands to never suggest. Still work when typed explicitly.
    blocklist: []

# --- Telemetry (artefact engagement, default-off) ---
#
# Records — at task / phase-step boundaries — which artefacts (skills,
# rules, commands, guidelines, personas) the agent consulted and
# applied. Local only, append-only JSONL, never reaches a consumer
# repo (gitignored). Maintainer-targeted feature; consumers leave it
# off. See `docs/contracts/artifact-engagement-flow.md` (once Phase 3
# of road-to-artifact-engagement-telemetry lands).
telemetry:
  artifact_engagement:
    # Master switch. `false` (default) produces zero file IO and zero
    # token cost. Flip to `true` only as a maintainer; the very first
    # `record` call prints a one-line stderr warning to make accidental
    # enables visible.
    enabled: false
    # `task` = one event per /implement-ticket or /work run.
    # `phase-step` = one event per refine|memory|analyze|plan|implement|test|verify|report step.
    # `tool-call` = one event per tool invocation; expensive, opt-in only.
    granularity: task
    # Which categories the agent records. Both default to `true`;
    # flip individually if a maintainer wants applied-only or
    # consulted-only data.
    record:
      consulted: true
      applied: true
    output:
      # Append-only JSONL log. Path is relative to the project root.
      # Always gitignored (see config/gitignore-block.txt).
      path: .agent-engagement.jsonl
```

## Settings Reference

Personal and project-level settings (initial file written by
`scripts/install.py`, edits follow the merge rules in
[`layered-settings`](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)).
**Key paths use dot-notation** to denote nesting: `personal.user_name`
lives under `personal:` in YAML.

| Key path | Values | Default | Description |
|---|---|---|---|
| `cost_profile` | `minimal`, `balanced`, `full`, `custom` | `minimal` | Selects which agent surfaces are active. See [Cost profiles](#cost-profiles). |
| `personal.ide` | `code`, `phpstorm`, `cursor` | _(empty)_ | CLI command to open files in the IDE |
| `personal.open_edited_files` | `true`, `false` | `false` | Auto-open edited files in the IDE after edits |
| `personal.user_name` | first name | _(empty)_ | User's first name, used to address the user personally. Captured by `/onboard`. |
| `personal.rtk_installed` | `true`, `false` | `false` | Whether rtk (Rust Token Killer) is installed. Detected and set by `/onboard`. |
| `personal.minimal_output` | `true`, `false` | `true` | When `true`: short bullet points during work, concise summary at end. When `false`: verbose explanations. |
| `personal.play_by_play` | `true`, `false` | `false` | When `true`: share intermediate findings during investigation. When `false`: work silently, report only the conclusion. |
| `personal.pr_comment_bot_icon` | `true`, `false` | `false` | Prefix PR comment replies with 🤖 to indicate bot-authored replies. Personal preference — each developer decides. |
| `personal.autonomy` | `on`, `off`, `auto` | `auto` | Suppress trivial workflow questions and act on the obvious next step. `auto` defaults to `off` but flips to `on` after a prose opt-in like "arbeite selbstständig". `on` suppresses trivial questions unconditionally. Blocking decisions (security, scope expansion, push/merge/branch/PR/tag) are never suppressed. See `rules/autonomous-execution.md`. |
| `project.pr_template` | file path | `.github/pull_request_template.md` | Path to PR template file. Read this instead of searching for it. |
| `project.upstream_repo` | `org/repo` | _(empty)_ | Target repository for universal improvement PRs (e.g., `org/agent-config`). |
| `project.improvement_pr_branch_prefix` | string | `improve/agent-` | Branch prefix for agent improvement PRs. |
| `github.pr_reply_method` | `replies_endpoint`, `create_review_comment`, `auto` | `create_review_comment` | GitHub API method for replying to PR review comments. `auto` detects on first use. |
| `eloquent.access_style` | `getters_setters`, `get_attribute`, `magic_properties` | `getters_setters` | How to access Eloquent model attributes. See `eloquent` skill for details. |
| `chat_history.enabled` | `true`, `false` | `true` | Persist chat events to `agents/.agent-chat-history` (JSONL) for crash recovery. |
| `chat_history.frequency` | `per_turn`, `per_phase`, `per_tool` | per profile | Logging granularity. Defaults: `minimal`→`per_turn`, `balanced`→`per_phase`, `full`→`per_tool`. |
| `chat_history.max_size_kb` | integer | per profile | Max file size before overflow handling. Defaults: `minimal`→`128`, `balanced`→`256`, `full`→`512`. |
| `chat_history.on_overflow` | `rotate`, `compress` | per profile | On overflow: `rotate` drops oldest entries; `compress` marks the file for summarization on the next turn. Defaults: `minimal`/`balanced`→`rotate`, `full`→`compress`. |
| `chat_history.text_limits.{user,agent,tool,phase}` | integer (chars) | `user=0`, `agent=5000`, `tool=200`, `phase=200` | Per-entry-type text-length cap. `0` = verbatim, no slice. `N > 0` = collapse whitespace, slice to N chars, append `" … [+K chars]"` so the log self-reports truncation. Defaults match `DEFAULT_TEXT_LIMITS` in `scripts/chat_history.py`. |
| `hooks.enabled` | `true`, `false` | `false` | Master switch for the work-engine hook layer. When `false` (default) the registry stays empty and golden replay is byte-stable. See [`agents/contexts/work-engine-hooks.md`](../../../agents/contexts/work-engine-hooks.md). |
| `hooks.trace` | `true`, `false` | `false` | Emit per-event trace lines on stderr. Useful for debugging; off by default because it is noisy. |
| `hooks.halt_surface_audit` | `true`, `false` | `true` | Defense-in-depth check that every halt surfaced by the dispatcher carries the expected shape. Cheap. |
| `hooks.state_shape_validation` | `true`, `false` | `true` | Re-run the state schema validator on `AFTER_LOAD` and `BEFORE_SAVE`. Cheap, catches drift. |
| `hooks.directive_set_guard` | `true`, `false` | `true` | Verify the dispatcher-resolved directive set matches the input envelope intent. Cheap, catches routing drift. |
| `hooks.chat_history.enabled` | `true`, `false` | `true` | Register chat-history hooks (`append` on `after_step`, `halt_append` on `on_halt`). Gated by **both** this flag AND `chat_history.enabled`; either off → no chat-history hook registers. Schema v4: every entry self-identifies via 16-char session fingerprint, no ownership/sidecar layer. |
| `hooks.chat_history.script` | path | `scripts/chat_history.py` | Override path to the chat-history CLI. Set only when the script lives outside the standard location. |
| `pipelines.skill_improvement` | `true`, `false` | `true` | When `true`: propose learning capture after meaningful tasks. When `false`: silent. Included in every profile except `custom`. |
| `roadmap.quality_cadence` | `end_of_roadmap`, `per_phase`, `per_step` | `end_of_roadmap` | When `/roadmap execute` runs the project's quality pipeline. Default skips per-step / per-phase runs and gates only the final archival. `per_phase` runs once after every phase; `per_step` is the legacy verbose mode. Step checkboxes and the dashboard are always updated regardless. `verify-before-complete` still requires fresh output before any "roadmap complete" claim. |
| `subagents.implementer_model` | model alias or empty | _(empty)_ | Model for implementer subagents. Empty = same tier as session model. See [subagent-configuration](../contexts/subagent-configuration.md). |
| `subagents.judge_model` | model alias or empty | _(empty)_ | Model for judge subagents. Empty = one tier above implementer (opus if sonnet, sonnet if haiku). |
| `subagents.max_parallel` | integer | `3` | Maximum parallel subagent invocations. `1` serializes. |
| `roles.default_role` | `""`, `developer`, `reviewer`, `tester`, `po`, `incident`, `planner` | _(empty)_ | Role the agent defaults to at the start of a session. See [`role-contracts`](../../docs/guidelines/agent-infra/role-contracts.md). |
| `roles.active_role` | same as `default_role` | _(empty)_ | Role currently active; set by `/mode <name>`, cleared by `/mode none`. Enables the `role-mode-adherence` rule. |
| `personas.override` | list of persona ids | `[]` | Developer-local override of the team default lens cast. Empty = inherit `personas.default` from `.agent-project-settings.yml`. See [`layered-settings`](../../docs/guidelines/agent-infra/layered-settings.md). |
| `personas.ignore` | list of persona ids | `[]` | Persona ids dropped from the default cast locally. Ignored personas stay invokable via `--personas=<id>`. |
| `onboarding.onboarded` | `true`, `false` | `false` | Whether `/onboard` has run on this project. The `onboarding-gate` rule prompts for `/onboard` when this is `false`. Missing entirely = legacy project, treated as onboarded. |
| `commands.suggestion.enabled` | `true`, `false` | `true` | Master switch for the command-suggestion layer. `false` = the layer is silent; explicit `/commands` still work. See `rules/command-suggestion-policy.md`. |
| `commands.suggestion.confidence_floor` | `0.0`–`1.0` | `0.6` | Minimum match score before a suggestion surfaces. Per-command frontmatter (`suggestion.confidence_floor`) overrides this global floor. |
| `commands.suggestion.cooldown_seconds` | integer | `600` | Cooldown between re-suggestions of the same `(command, evidence)` pair. `600` = 10m. |
| `commands.suggestion.max_options` | integer | `4` | Max number of command suggestions before the always-present "run as-is" option (total rendered = `max_options + 1`). |
| `commands.suggestion.blocklist` | list of command names | `[]` | Commands that never appear as a suggestion. They still work when typed explicitly. |
| `telemetry.artifact_engagement.enabled` | `true`, `false` | `false` | Master switch for the artefact engagement log. Default-off; zero file IO and zero token cost when `false`. Maintainer-targeted; consumers leave it off. |
| `telemetry.artifact_engagement.granularity` | `task`, `phase-step`, `tool-call` | `task` | Boundary at which events are recorded. `tool-call` is expensive — opt-in only. |
| `telemetry.artifact_engagement.record.consulted` | `true`, `false` | `true` | When `true`: record artefacts loaded into context. |
| `telemetry.artifact_engagement.record.applied` | `true`, `false` | `true` | When `true`: record artefacts cited or driving a decision. |
| `telemetry.artifact_engagement.output.path` | path | `.agent-engagement.jsonl` | Append-only JSONL log path, relative to the project root. Always gitignored. |

### Rename-Map (migration)

Applied automatically when `scripts/install` finds a legacy `.agent-settings`
(key=value) and writes the new `.agent-settings.yml`:

| Legacy flat key | New YAML path |
|---|---|
| `cost_profile` | `cost_profile` |
| `ide` | `personal.ide` |
| `open_edited_files` | `personal.open_edited_files` |
| `user_name` | `personal.user_name` |
| `rtk_installed` | `personal.rtk_installed` |
| `minimal_output` | `personal.minimal_output` |
| `play_by_play` | `personal.play_by_play` |
| `pr_comment_bot_icon` | `personal.pr_comment_bot_icon` |
| `pr_template` | `project.pr_template` |
| `upstream_repo` | `project.upstream_repo` |
| `improvement_pr_branch_prefix` | `project.improvement_pr_branch_prefix` |
| `github_pr_reply_method` | `github.pr_reply_method` |
| `eloquent_access_style` | `eloquent.access_style` |
| `skill_improvement_pipeline` | `pipelines.skill_improvement` |
| `subagent_implementer_model` | `subagents.implementer_model` |
| `subagent_judge_model` | `subagents.judge_model` |
| `subagent_max_parallel` | `subagents.max_parallel` |

Unknown keys in the legacy file are preserved under a `_legacy:` section
so nothing is silently dropped; the migration log points them out.

## Cost profiles

The `cost_profile` setting selects which agent surfaces are active. See
`docs/customization.md` for the authoritative description.

| Profile | Description |
|---|---|
| `minimal` | Rules, skills, and commands only. **Includes the learning loop.** Default. |
| `balanced` | `minimal` + Runtime dispatcher for skills that declare a shell command. |
| `full` | `balanced` + Tool adapters (GitHub / Jira, read-only, opt-in). |
| `custom` | Ignore profile — every matrix value must be set explicitly. |

**Learning loop:** `pipelines.skill_improvement` is `true` by default and is
included in every profile except `custom`. It triggers post-task learning
capture via the `skill-improvement-trigger` rule. Flip to `false` in the
settings file if you want a silent agent without touching the profile.

Other per-feature toggles may be added in future releases; when they land,
they ship with a live consumer in code and get documented here, not before.

## Sync rules

When new settings are added to this template, the
[section-aware merge rules](../../docs/guidelines/agent-infra/layered-settings.md#section-aware-merge-rules)
govern the update:

1. Missing keys are added with their **default value** from this template,
   inside the correct section.
2. Existing keys keep their **current value** — never overwritten.
3. The **order** of keys follows this template — existing values are
   reordered to match.
4. Comments from the template are preserved in the output.

Re-run `scripts/install` to pull in template drift, or ask the agent to
update a specific key — it walks the same rules.

## Adding new settings

When adding a new setting:

1. Add the key with its default value to the template block above, inside
   the right section (or create a new section if it is a new domain).
2. Add a row to the Settings Reference table using the full dot-path.
3. Update the relevant skill or command that reads this setting.
4. Re-run `scripts/install` (or ask the agent to sync) to pull the new
   key into the user's file.
