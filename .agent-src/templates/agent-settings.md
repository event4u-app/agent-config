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
a full YAML engine. Run `/config-agent-settings` to normalize after manual
edits.

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
`/config-agent-settings` (and `bin/install.php` via
`config/agent-settings.template.yml`) writes to `.agent-settings.yml`.

```yaml
# Agent Settings
# This file is git-ignored. Each developer has their own settings.
# Run /config-agent-settings to create or update this file.

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

# --- Project / team preferences ---
project:
  # Prefix PR comment replies with a bot icon 🤖 (true, false)
  pr_comment_bot_icon: false

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

# --- Optional pipelines ---
pipelines:
  # Skill improvement pipeline (true, false)
  # true  = after meaningful tasks, propose learning capture and improvements (default)
  # false = silent, no post-task analysis
  # Included by every cost_profile except `custom`.
  skill_improvement: true

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
```

## Settings Reference

Personal and project-level settings (written by `/config-agent-settings` and
`bin/install.php`). **Key paths use dot-notation** to denote nesting:
`personal.user_name` lives under `personal:` in YAML.

| Key path | Values | Default | Description |
|---|---|---|---|
| `cost_profile` | `minimal`, `balanced`, `full`, `custom` | `minimal` | Selects which agent surfaces are active. See [Cost profiles](#cost-profiles). |
| `personal.ide` | `code`, `phpstorm`, `cursor` | _(empty)_ | CLI command to open files in the IDE |
| `personal.open_edited_files` | `true`, `false` | `false` | Auto-open edited files in the IDE after edits |
| `personal.user_name` | first name | _(empty)_ | User's first name, used to address the user personally. Captured by `/onboard`. |
| `personal.rtk_installed` | `true`, `false` | `false` | Whether rtk (Rust Token Killer) is installed. Detected and set by `/onboard`. |
| `personal.minimal_output` | `true`, `false` | `true` | When `true`: short bullet points during work, concise summary at end. When `false`: verbose explanations. |
| `personal.play_by_play` | `true`, `false` | `false` | When `true`: share intermediate findings during investigation. When `false`: work silently, report only the conclusion. |
| `project.pr_comment_bot_icon` | `true`, `false` | `false` | Prefix PR comment replies with 🤖 to indicate bot-authored replies |
| `project.pr_template` | file path | `.github/pull_request_template.md` | Path to PR template file. Read this instead of searching for it. |
| `project.upstream_repo` | `org/repo` | _(empty)_ | Target repository for universal improvement PRs (e.g., `org/agent-config`). |
| `project.improvement_pr_branch_prefix` | string | `improve/agent-` | Branch prefix for agent improvement PRs. |
| `github.pr_reply_method` | `replies_endpoint`, `create_review_comment`, `auto` | `create_review_comment` | GitHub API method for replying to PR review comments. `auto` detects on first use. |
| `eloquent.access_style` | `getters_setters`, `get_attribute`, `magic_properties` | `getters_setters` | How to access Eloquent model attributes. See `eloquent` skill for details. |
| `pipelines.skill_improvement` | `true`, `false` | `true` | When `true`: propose learning capture after meaningful tasks. When `false`: silent. Included in every profile except `custom`. |
| `subagents.implementer_model` | model alias or empty | _(empty)_ | Model for implementer subagents. Empty = same tier as session model. See [subagent-configuration](../contexts/subagent-configuration.md). |
| `subagents.judge_model` | model alias or empty | _(empty)_ | Model for judge subagents. Empty = one tier above implementer (opus if sonnet, sonnet if haiku). |
| `subagents.max_parallel` | integer | `3` | Maximum parallel subagent invocations. `1` serializes. |
| `roles.default_role` | `""`, `developer`, `reviewer`, `tester`, `po`, `incident`, `planner` | _(empty)_ | Role the agent defaults to at the start of a session. See [`role-contracts`](../guidelines/agent-infra/role-contracts.md). |
| `roles.active_role` | same as `default_role` | _(empty)_ | Role currently active; set by `/mode <name>`, cleared by `/mode none`. Enables the `role-mode-adherence` rule. |
| `personas.override` | list of persona ids | `[]` | Developer-local override of the team default lens cast. Empty = inherit `personas.default` from `.agent-project-settings.yml`. See [`layered-settings`](../guidelines/agent-infra/layered-settings.md). |
| `personas.ignore` | list of persona ids | `[]` | Persona ids dropped from the default cast locally. Ignored personas stay invokable via `--personas=<id>`. |
| `onboarding.onboarded` | `true`, `false` | `false` | Whether `/onboard` has run on this project. The `onboarding-gate` rule prompts for `/onboard` when this is `false`. Missing entirely = legacy project, treated as onboarded. |

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
| `pr_comment_bot_icon` | `project.pr_comment_bot_icon` |
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

When new settings are added to this template:

1. The `/config-agent-settings` command detects missing keys (dot-paths) in
   the user's `.agent-settings.yml`.
2. Missing keys are added with their **default value** from this template,
   inside the correct section.
3. Existing keys keep their **current value** — never overwritten.
4. The **order** of keys follows this template — existing values are
   reordered to match.
5. Comments from the template are preserved in the output.

## Adding new settings

When adding a new setting:

1. Add the key with its default value to the template block above, inside
   the right section (or create a new section if it is a new domain).
2. Add a row to the Settings Reference table using the full dot-path.
3. Update the relevant skill or command that reads this setting.
4. The next time `/config-agent-settings` runs, it will add the new key
   automatically.
