# Customization

## Override System

The project override system allows consumer projects to extend or replace shared skills,
rules, and commands **without modifying the package**.

```
agents/overrides/
├── skills/                  ← Override skill behavior
│   └── pest-testing/
│       └── SKILL.md         ← Replaces .augment/skills/pest-testing/SKILL.md
├── rules/                   ← Override rule behavior
│   └── php-coding.md        ← Replaces .augment/rules/php-coding.md
└── commands/                ← Override command behavior
    └── commit/
        └── SKILL.md
```

**Resolution order:** project override → shared package (`.augment/`).

Overrides are project-specific and should be committed to the consumer project.
Use the `/override-create` command to scaffold a new override.

---

## AGENTS.md

Every consumer project should have an `AGENTS.md` at the project root.
The installer copies a default version if none exists.

`AGENTS.md` provides project-specific context to the agent: tech stack, conventions,
module structure, test setup, and quality tooling.

It is loaded by Claude Code, Augment Code, and Gemini CLI.

---

## Agent Settings

The `.agent-settings.yml` file in the consumer project configures agent behavior.
It is written as YAML with section-level grouping; dotted keys below reference
those sections.

### User-global DX-comfort defaults (cross-project)

Six **DX-comfort** keys can be carried across every project that uses
`event4u/agent-config` by storing them once in a user-global file at:

```
~/.config/agent-config/agent-settings.yml
```

The path is XDG-style and matches the existing
`~/.config/agent-config/` directory used for `anthropic.key`,
`openai.key`, and `council-spend.jsonl`.

**Whitelist (locked, exact dotted paths)** — only these six keys are
mergeable from the user-global file; every other key is silently ignored:

```
name
ide
cost_profile
personal.bot_icon
personal.autonomy
caveman.speak_scope
```

**Merge order** (lowest → highest precedence; every layer optional):

```
1. Package defaults                                   (shipped by event4u/agent-config)
2. ~/.config/agent-config/agent-settings.yml          (user-global · whitelist-filtered)
3. <repo-root>/.agent-settings.yml                    (project-wide · all keys)
4. <intermediate-dir>/.agent-settings.yml             (subsystem-scoped · all keys · optional)
5. <CWD>/.agent-settings.yml                          (deepest · all keys · wins)
```

`<repo-root>` is the nearest ancestor of the CWD that contains a `.git`
directory **or** file (submodule support). The walk stops there — it
never drifts into a parent repo or `$HOME`. Callers that omit the
``cwd`` argument get the legacy two-layer behaviour (user-global +
single project file) — back-compat is hard.

Project-local values **always win** over user-global. The user-global
file is a fallback, never a lock. Non-whitelisted keys in the
user-global file are dropped without error — adding `personal.theme`
there has no effect.

**Whitelist asymmetry.** The six-key whitelist applies **only** to the
user-global layer. Non-root in-project layers (intermediate +
``<CWD>``) carry arbitrary keys — they live inside the project
boundary, are tracked in git, and reviewed in PRs like any other
config. Use a subdirectory `.agent-settings.yml` to scope a single
field (e.g. a `cost_profile` override for `services/heavy-ml/`) without
duplicating the root file.

The user-global file is created **only on explicit opt-in via
`/onboard`**. The loader at
[`scripts/_lib/agent_settings.py`](../scripts/_lib/agent_settings.py)
is **read-only** — no script can create or mutate it without an
explicit `/onboard` confirmation. Edit the file by hand for mid-life
changes; `/sync-agent-settings` stays project-scoped and never touches
user-global state.

### Agent config version pin

The top-level `agent_config_version` key pins the project to an exact
release of `@event4u/agent-config`. Under the npx-only distribution
model (see [`docs/architecture.md`](architecture.md) §
*"npx-only distribution + version-pin governance"*), there is no
local `node_modules/` or `vendor/` lockfile to anchor the runtime —
the pin is the substitute mechanism.

```yaml
agent_config_version: "2.0.3"   # exact semver, no ranges
```

Rules:

- **Exact semver only.** Ranges (`^2.0`, `~2.0.3`, `>=2.0`) are
  rejected — the pin must be reproducible across the team.
- **Empty string = unpinned.** The resolver picks the latest release
  on every invocation. Only safe for greenfield projects; production
  consumers should pin.
- **Owned by the project, not the developer.** Lives in
  `.agent-settings.yml` (committed), reviewed in PRs like any other
  config change. Never merged from `~/.config/agent-config/agent-settings.yml`.
- **Resolver enforcement.** `npx @event4u/agent-config <cmd>`
  compares the resolved CLI version against the pin; mismatch
  triggers a re-exec at the pinned version
  (`npx @event4u/agent-config@<pin> <cmd>`).

### Available settings

| Setting | Default | Description |
|---|---|---|
| `agent_config_version` | *(empty)* | Exact semver pin of the agent-config release (see above). Empty = unpinned. |
| `cost_profile` | `minimal` | Token budget (`minimal`, `balanced`, `full`, `custom`) |
| `personal.user_name` | *(empty)* | User's first name for personalized responses |
| `personal.minimal_output` | `true` | Suppress intermediate output |
| `personal.play_by_play` | `false` | Share intermediate findings during analysis |
| `personal.open_edited_files` | `false` | Open edited files in IDE |
| `personal.ide` | *(empty)* | IDE for file opening (`cursor`, `code`, `phpstorm`) |
| `pipelines.skill_improvement` | `true` | Post-task learning capture. Included in every profile except `custom`. |
| `chat_history.enabled` | `true` | Persistent JSONL log at `agents/.agent-chat-history` for crash recovery. |
| `chat_history.frequency` | per profile | Logging granularity: `per_turn`, `per_phase`, or `per_tool` (see matrix below). |
| `chat_history.max_size_kb` | per profile | Max file size before overflow handling (see matrix below). |
| `chat_history.on_overflow` | per profile | `rotate` drops oldest, `compress` marks for summarization (see matrix below). |
| `onboarding.onboarded` | `false` | Whether `/onboard` has run. The `onboarding-gate` rule prompts for `/onboard` while this is `false`. |
| `ai_council.enabled` | `false` | Master switch for the `/council` command. Even when enabled, every consultation asks before spending tokens. |
| `ai_council.members.<provider>.enabled` | `false` | Per-provider opt-in (`anthropic`, `openai`). Tokens live in `~/.config/agent-config/<provider>.key` (mode 0600), never in this file. |
| `ai_council.members.<provider>.model` | per provider | Which model the provider sends the query to (e.g. `claude-sonnet-4-5`, `gpt-4o`). |
| `ai_council.cost_budget.max_input_tokens` | `50000` | Hard cap on summed input tokens per `/council` invocation. |
| `ai_council.cost_budget.max_output_tokens` | `20000` | Hard cap on summed output tokens per `/council` invocation. |
| `ai_council.cost_budget.max_calls` | `10` | Maximum council members per invocation. |
| `ai_council.cost_budget.max_total_usd` | `0.0` | Per-invocation USD ceiling. `0` disables (token caps still apply). |
| `ai_council.cost_budget.daily_limit_usd` | `0.0` | Rolling 24h USD ceiling across all `/council` calls. `0` disables. Ledger lives at `~/.config/agent-config/council-spend.jsonl` (mode 0600). |
| `ai_council.session_retention_days` | `14` | Auto-prune for `agents/council-sessions/` audit folders. Older session directories are removed on the next `save()`. `0` disables (keep forever). |

> **Experimental.** AI Council is not yet validated by external users. API costs apply per consultation.

Council API tokens are installed via `./agent-config keys:install-anthropic`
and `./agent-config keys:install-openai` — they prompt on `/dev/tty`, write to
`~/.config/agent-config/<provider>.key` with mode `0600`, and never accept env
vars. The `/council` command refuses to run if the key file's permissions
drift.

### Cost profiles

`cost_profile` is the master switch for rule-tier loading. The kernel
(always-loaded Iron-Law floor, ≤ 26k chars across 9 rules) ships in every
profile. Tier-1 and tier-2 rules are gated by profile and resolved at
session start from `router.json` (compiled by `scripts/compile_router.py`).

| Profile | Rule tiers loaded | Token footprint | Best for |
|---|---|---|---|
| `minimal` | kernel only (no router, no auto-rules) | lowest | Cost-sensitive sessions; trivial Q&A; CI runs |
| `balanced` | kernel + tier-1 auto-rules (default) | medium | Day-to-day work — current behaviour superset |
| `full` | kernel + tier-1 + tier-2 (everything) | highest | Agent-config development; full rule fidelity |
| `custom` | profile ignored — every matrix value must be set explicitly | varies | Power users with bespoke rule sets |

The kernel-and-router architecture is documented in
[`docs/contracts/rule-router.md`](contracts/rule-router.md) and
[`docs/contracts/kernel-membership.md`](contracts/kernel-membership.md).
Tier flags live in each rule's frontmatter (`tier: kernel | tier-1 | tier-2`);
the router compiles them into `router.json` deterministically.

All profiles except `custom` ship with `pipelines.skill_improvement: true`,
so the agent captures learnings after meaningful tasks by default. Set it
to `false` in `.agent-settings.yml` to silence post-task analysis without
changing the profile.

The authoritative matrix of all matrix-controlled settings lives in
[`.agent-src.uncompressed/templates/agent-settings.md`](../.agent-src.uncompressed/templates/agent-settings.md).

### Chat-history defaults per profile

`scripts/install.py` fills these placeholders from
[`config/profiles/*.ini`](../config/profiles) when it writes
`.agent-settings.yml`. Edit the values afterwards if you want different
behavior — the per-profile table is just the initial default.

| Setting | `minimal` | `balanced` | `full` |
|---|---|---|---|
| `chat_history.enabled` | `true` | `true` | `true` |
| `chat_history.frequency` | `per_turn` | `per_phase` | `per_tool` |
| `chat_history.max_size_kb` | `128` | `256` | `512` |
| `chat_history.on_overflow` | `rotate` | `rotate` | `compress` |

`custom` ignores these defaults — set every value explicitly.

### Verbosity

The `verbosity:` block and `caveman.speak_scope` control how much narration
the agent emits around routine actions. Defaults are tuned for token
frugality — flip values to `true` (or higher tier) to restore legacy verbose
output. Iron-Law gates (`commit-policy`, `scope-control` git-ops,
`non-destructive-by-default`) ALWAYS confirm regardless of these flags.

| Setting | Values | Default | Description |
|---|---|---|---|
| `verbosity.preview_artifacts` | `true`, `false` | `false` | Show generated commit messages, PR titles/bodies, and branch names before acting. `false` = use the generated content directly. |
| `verbosity.routine_confirmations` | `true`, `false` | `false` | Confirmation prompts for routine workflow steps when there is one obvious answer ("looks good — commit?"). Iron-Law gates always ask regardless. |
| `verbosity.offer_council_in_delivery` | `true`, `false` | `false` | Offer "run AI Council on this?" inside delivery commands (`/feature-plan`, `/review-changes`, `/roadmap-create`). The `/council` command itself is unaffected. |
| `verbosity.post_action_reports` | `off`, `minimal`, `full` | `minimal` | Multi-line status / summary blocks after a successful action. `off` = no report; `minimal` = one-line confirmation; `full` = bullet list. |
| `verbosity.intent_announcements` | `true`, `false` | `false` | Intent announcements ("Let me check…", "Now I will…", "Found it") in skill bodies. `false` = act and emit the result. |
| `verbosity.script_output` | `silent`, `minimal`, `verbose` | `minimal` | Stdout chatter from `scripts/*.py`, `scripts/*.sh`, and `.augment/scripts/`. `silent` = stderr only; `minimal` = one summary line per script; `verbose` = pre-Phase-10 per-step prints. Iron-Law surfaces (release confirms, install secrets prompts, error markers) ignore this key. |
| `verbosity.taskfile_command_echo` | `true`, `false` | `false` | Suppress the `task: [name] cmd...` echo Taskfile prints before each task body. `true` = echoes preserved (legacy behaviour); `false` = `silent: true` is set on every Phase-10 safe task. |
| `caveman.speak_scope` | `off`, `prose_only`, `aggressive` | `prose_only` | How widely caveman-speak grammar applies in chat. `off` = no caveman; `prose_only` = caveman in body prose, numbered options + Iron-Law-literal blocks stay full prose; `aggressive` = caveman everywhere except Iron-Law literals. |

The cross-rule index for these defaults lives in
[`.agent-src.uncompressed/contexts/contracts/frugality-charter.md`](../.agent-src.uncompressed/contexts/contracts/frugality-charter.md).
Writer skills (`skill-writing`, `rule-writing`, `command-writing`,
`guideline-writing`, `roadmap-writing`, `persona-writing`,
`agent-docs-writing`, `context-authoring`, `conventional-commits-writing`,
`readme-writing`, `readme-writing-package`, `adr-create`) cite the charter
under their `## Frugality Standards` section.

#### Behavior change vs. legacy — `/create-pr` silent draft default

When `verbosity.routine_confirmations: false` (the new default),
`/create-pr` creates the PR as a **draft silently** instead of asking
"draft or ready?". A one-line postscript surfaces the override:

```
→ #42 opened: https://github.com/org/repo/pull/42
→ created as draft — run `gh pr ready 42` to flip
```

Per-invocation overrides (no settings change required):

| You want | Argument |
|---|---|
| Ready-for-review immediately | `/create-pr:ready` or `/create-pr:final` |
| Explicit draft (no postscript change) | `/create-pr:draft` |
| Numbered prompt restored | set `verbosity.routine_confirmations: true` |

`/create-pr` still skips the AI council prompt unconditionally per the
existing carve-out — `verbosity.offer_council_in_delivery` does not
re-enable it. Use `/council diff:<base>..<head>` separately.

#### Script-output level — env-var overrides

`verbosity.script_output` is read by `scripts/_lib/script_output.py`.
For incident debugging when editing `.agent-settings.yml` is awkward,
two env vars override the file for the current process tree:

| Env var | Value | Effect |
|---|---|---|
| `AGENT_SCRIPT_VERBOSITY` | `silent`, `minimal`, `verbose` | Authoritative — wins over the settings file |
| `SCRIPT_OUTPUT_VERBOSE` | `1` | Alias — equivalent to `AGENT_SCRIPT_VERBOSITY=verbose` |

Once the helper resolves the level, it exports the resolved value back
into `AGENT_SCRIPT_VERBOSITY` so child processes inherit the same level
without re-reading the settings file. Per-call `--quiet` flags on a
child script still win at the call site (per-call override > inherited
level).

Iron-Law surfaces — production-deploy confirmation prompts in
`scripts/release.py`, secret-installer prompts in `install_*_key.sh`,
and any output via `error()` — bypass the helper and stay loud at every
level.

---

## Project documentation

Consumer projects can maintain their own agent documentation:

```
agents/
├── docs/                    ← Feature docs, architecture decisions
├── contexts/                ← Shared knowledge documents
├── features/                ← Feature plans
├── roadmaps/                ← Active roadmaps
└── overrides/               ← Skill/rule/command overrides
```

Module-level documentation goes into `app/Modules/*/agents/`.

### `agents/` overlay cascade

A subset of `agents/` subdirs participates in the same deepest-wins
cascade as `.agent-settings.yml` (see *"User-global DX-comfort
defaults"* above). The cascade is **per-file** by basename — the
deepest existing `agents/<kind>/<name>.md` wins; the rest are silently
shadowed.

| Subdir | Cascade? | User-global allowed? | Why |
|---|---|---|---|
| `agents/overrides/` | ✅ Yes — deepest wins by basename. | ✅ Yes — weakest layer. | Personal developer overrides. |
| `agents/contexts/` | ✅ Yes — deepest wins by basename. | ❌ No — project-shaped. | Shared knowledge; would leak across projects. |
| `agents/decisions/` | ✅ Yes — deepest wins by basename. | ❌ No — project-shaped ADRs. | Decisions are repo-bound. |
| `agents/roadmaps/` | ❌ No — project-rooted only. | ❌ No. | Active delivery plans. |
| `agents/state/`, `agents/memory/`, `agents/work_engine/`, `agents/.agent-prices.md`, `agents/council-*/` | ❌ No — stateful / session-scoped. | ❌ No. | Per-session state, not shareable. |

**User-global asymmetry.** `~/.config/agent-config/agents/overrides/`
is the only user-global overlay path consulted by the loader. Files
under `~/.config/agent-config/agents/contexts/` or
`.../agents/decisions/` are silently skipped — these kinds are
project-shaped and must not leak across projects.

The resolver lives at
[`scripts/_lib/agents_overlay.py`](../scripts/_lib/agents_overlay.py)
and is enforced by `scripts/check_overlay_cascade_subdirs.py` — drift
between the code constants (`CASCADE_ELIGIBLE_KINDS`,
`USER_GLOBAL_OVERLAY_KINDS`) and the table above breaks the build.

---

## Update check

`npx @event4u/agent-config <cmd>` checks the npm registry once per
24 h for a newer release of the package and, when one is available,
writes a two-line banner to **stderr** *after* the subcommand has
finished. There is no prompt — the user updates when they want with
`npx @event4u/agent-config update` (Phase 3).

```
ℹ️  agent-config 1.42.0 available (you have 1.38.0).
    Update: npx @event4u/agent-config update
```

State is persisted at `~/.config/agent-config/update-check.json`
(mode `0600`) — sibling of `anthropic.key`, `council-spend.jsonl`.
The fetch is hard-capped at 1 s and silent on any error.

### Suppression matrix

The banner is silently skipped when **any** of the following match:

| Condition | Reason |
|---|---|
| `CI=1` / `CI=true` / `GITHUB_ACTIONS=true` | CI noise, breaks log scrapers. |
| `stdout` is not a TTY | Piped / redirected output must stay clean. |
| `AGENT_CONFIG_NO_UPDATE_CHECK=1` | Per-invocation escape hatch. |
| `update_check.enabled: false` in `.agent-settings.yml` | Project / user opt-out. |
| Registry call exceeds 1 s | Network must never delay `npx`. |
| Registry call raises any exception | Best-effort — failure is silent. |

`update_check.enabled` is a **project-scoped** key — it is *not* on
the user-global whitelist (see [§ Agent Settings](#agent-settings)).
Each project decides; the user-global file cannot flip it on or off
for unrelated projects.

The decision logic lives at
[`scripts/_lib/update_check.py`](../scripts/_lib/update_check.py); the
dispatcher integration lives in [`scripts/agent-config`](../scripts/agent-config)
(`run_update_check_banner`).

---

← [Back to README](../README.md)
