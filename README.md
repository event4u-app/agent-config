# Agent Config — Governed Agent System

> **agent-config is not a runtime, but it ships a deterministic orchestration contract / state machine for host agents.**

Give your AI agents an audit-disciplined orchestration contract — testing, Git, CI, code review, and **120+ stack-aware skills** — with quality guardrails built in.

> Your agent picks up the project's stack, runs tests, prepares PRs, fixes CI — and follows your team's coding standards while doing it. Stack-aware skill sets ship for PHP (Laravel · Symfony · Zend/Laminas), JavaScript (Next.js · React · Node), and cross-stack concerns (API · testing · security · observability).

<p align="center">
  <strong>129 Skills</strong> · <strong>58 Rules</strong> · <strong>93 Commands</strong> · <strong>48 Guidelines</strong> · <strong>8 AI Tools</strong>
</p>

---

## Start here

New to agent-config? 60 seconds, three links:

1. **[Install](#quickstart)** — `composer require` or `npm install`, then run the installer.
2. **[First command](#2-minute-demo-implement-ticket)** — `/implement-ticket` or `/work` walkthrough.
3. **[Where the rules live](#documentation)** — `.augment/`, `.claude/`, `.cursor/`, and friends.

---

## Quickstart

Two minutes from `composer require` to a better-behaved agent.

### For teams (recommended)

Install once in the project — available to everyone who works on it:

```bash
# PHP
composer require --dev event4u/agent-config

# JavaScript/TypeScript
npm install --save-dev @event4u/agent-config
```

After installing the package, run the installer to sync the payload and
create `.agent-settings.yml`, `.vscode/settings.json`, `.augment/settings.json`,
and the tool-specific glue:

```bash
# PHP / Composer projects — explicit step (Composer does not auto-run it):
php vendor/bin/install.php
# or directly (any environment):
bash vendor/event4u/agent-config/scripts/install

# npm projects run the installer automatically via postinstall.
# To re-run or override the default profile:
bash node_modules/@event4u/agent-config/scripts/install --profile=balanced
```

**To install the package:** no Task, no Make, no build tools required.
`scripts/install` orchestrates two stages: a bash payload sync and a
Python bridge generator. **Python 3** (stdlib only, pre-installed on
macOS 12.3+ and all major Linux distros) is required for the bridge
stage; without it the orchestrator warns, runs the payload sync, and
continues. The package makes rules, skills, and commands available
project-locally for all supported AI tools. Task is required for
*contributors* who want to rebuild the compressed content locally — see
[CONTRIBUTING.md](CONTRIBUTING.md).

### For individual use (optional)

Install directly in your agent for global, cross-project use:

| Tool | Install |
|---|---|
| **Augment CLI** | `auggie plugin install agent-config@event4u-agent-config` |
| **Claude Code** | `claude plugin install agent-config@event4u-agent-config` |
| **Copilot CLI** | `copilot plugin install agent-config@event4u-agent-config` |

→ [All install options & project bridge setup](docs/installation.md)

**Open your agent and try these 3 prompts:**

1. `"Refactor this function"` → watch: agent analyzes first
2. `"Add caching to this"` → watch: agent asks instead of guessing
3. `"Implement this feature"` → watch: agent respects your codebase

→ [Full getting started guide](docs/getting-started.md) ·
[More examples & expected behavior](docs/showcase.md)

### Optional: persistent agent memory

`agent-config` integrates with [`@event4u/agent-memory`](https://www.npmjs.com/package/@event4u/agent-memory)
— an MCP-based memory backend that gives agents persistent learnings
across sessions. It is **strictly optional**:

- Not a required dependency (declared as `suggest` in Composer and as an
  optional peer in npm). `agent-config` itself never imports it.
- Without it, agent skills fall back to **file-based memory** under
  `agents/memory/` and continue to work normally.
- Recommended for teams that want learnings to survive across machines,
  branches, and chat sessions.

Install in the same project (dev-only):

```bash
npm install --save-dev @event4u/agent-memory
```

→ [Memory contract & retrieval API](docs/contracts/agent-memory-contract.md) (beta)

---

## 2-minute demo: `/implement-ticket`

The flagship command. Drives a ticket end-to-end through a fixed
linear flow — and **blocks on ambiguity instead of guessing**.

```
/implement-ticket PROJ-123
```

The agent runs this sequence:

```
refine → memory → analyze → plan → implement → test → verify → report
```

- **Refines** the ticket if acceptance criteria are vague.
- **Queries memory** for past decisions, invariants, incidents.
- **Plans** the change; you confirm before any file is touched.
- **Implements** under `minimal-safe-diff` + `scope-control` — no
  drive-by edits.
- **Runs tests** (targeted first, full suite on success).
- **Reviews** the diff through four judges (bugs, security,
  tests, code quality).
- **Reports** a copyable markdown block with changes, verdicts,
  and follow-ups — then stops. `/commit` and `/create-pr` are
  suggestions, never run automatically.

If any step hits ambiguity, the flow halts with numbered options
so you decide — never a silent guess. Persona comes from
`.agent-settings.yml` (`roles.active_role`): `senior-engineer`
(default), `qa` (widens to the full test suite), or `advisory`
(plan-only, skips implementation).

→ [Command reference](.agent-src/commands/implement-ticket.md) ·
  [Flow contract](docs/contracts/implement-ticket-flow.md) (beta)

### Sibling entrypoint: `/work` (free-form prompt)

Same engine, different envelope. Use `/work` when you have a goal
but no ticket yet:

```
/work add a CSV export endpoint to the audit-log controller
```

The first pass scores the prompt on five dimensions
(`goal_clarity`, `scope_boundary`, `ac_evidence`, `stack_data`,
`reversibility`) and routes on the resulting band:

| Band | Score | Engine action |
|---|---|---|
| **high** | `≥ 0.8` | Silent proceed — reconstructed AC + assumptions land in the delivery report |
| **medium** | `0.5–0.79` | Halts with assumptions report; you confirm or edit before plan |
| **low** | `< 0.5` | Halts with **one** clarifying question on the weakest dimension |

After the band gate releases, the rest of the flow is identical
to `/implement-ticket`. UI-shaped prompts are routed through the
**product UI track** — see below.

→ [Command reference](.agent-src/commands/work.md) ·
  [`refine-prompt` skill](.agent-src/skills/refine-prompt/SKILL.md) ·
  [ADR](docs/contracts/adr-prompt-driven-execution.md)

**Pick which one:** ticket id or pasted ticket payload → `/implement-ticket`.
Free-form goal, no ticket → `/work`. The two share `.work-state.json`
and refuse to switch envelopes mid-flight.

### Product UI track

UI-shaped work (build a screen, improve a component, fix microcopy)
switches the engine to one of three directive sets:

| `directive_set` | When | Flow |
|---|---|---|
| `ui` | Non-trivial UI surface | `audit → design → apply → review → polish → report` |
| `ui-trivial` | Bounded edit (≤ 1 file, ≤ 5 changed lines) | `apply → test → report` |
| `mixed` | Backend + UI | `contract → ui → stitch` |

Four load-bearing properties: (1) **existing-UI audit is a hard gate** —
no `apply` without audit, enforced at dispatcher AND
[`ui-audit-gate`](.agent-src/rules/ui-audit-gate.md) rule;
(2) **design brief is locked microcopy** — placeholders (`<placeholder>`,
`Lorem`, `TODO:`) rejected at both ends; (3) **polish has a 2-round
ceiling**, then halts ship-as-is / abort / hand-off; (4) **a11y precedence**
— unresolved axe-core / pa11y violations must be fixed or explicitly
accepted before ship, regardless of round counter (one-shot extension
allowed). The engine never renders UI itself: rendering happens
out-of-process, the engine consumes a `preview_envelope` (status /
screenshots / findings) via a defined contract. Stack detection routes
(`composer.json` + `package.json`) to `blade-livewire-flux` /
`react-shadcn` / `vue` / `plain`; trivial path reclassifies loudly when
preconditions fail. Halt budget on the happy path is 2.

→ [Mental model](docs/ui-track-mental-model.md) (1 page — when each set, where it stops, what the agent must never do) ·
  [Flow contract](docs/contracts/ui-track-flow.md) (beta) ·
  [ADR](docs/contracts/adr-product-ui-track.md) ·
  [Stack-extension recipe](docs/contracts/ui-stack-extension.md) (beta)

---

## What your agent is asked to do

The package ships rules and skills that guide the agent toward these
behaviors. The agent still decides in the moment, so the table is a
description of intent — not a guarantee of output.

| Default behavior | With agent-config (the agent is instructed to) |
|---|---|
| Guess and edit blindly | Analyze code before changing it — no blind edits |
| Drift from project conventions | Follow the project's coding standards (detected from the stack) |
| Skip or invent tests | Write tests in the project's framework (Pest, PHPUnit, Vitest, Jest, …) |
| Write generic commit messages | Use Conventional Commits with scope and ticket links |
| Skip quality checks | Run the project's quality pipeline (PHPStan/Rector/ECS, ESLint/Prettier/tsc, …) and fix reported errors |
| Open PRs without context | Produce structured PR descriptions from Jira / Linear / GitHub tickets |
| Claim "done" without proof | Verify with real execution before claiming "done" |

---

## What this package is — and what it isn't

`agent-config` is a **content layer** — skills, rules, commands, and
guidelines — distributed via Composer and npm and projected into every
supported AI tool's native config format. It follows the
[Agent Skills open standard](https://agentskills.io).

It is **not** an agent runtime. The agent loop, the LLM dispatcher, and
tool orchestration stay with the host tool (Claude Code, Augment Code,
Cursor, Cline, Windsurf, Gemini CLI, GitHub Copilot). Think of this
package as a playbook and style guide for those tools — not a
replacement for them.

| In scope | Out of scope |
|---|---|
| Skills, rules, commands, guidelines | Agent loop / LLM dispatcher |
| Multi-tool projection + compression pipeline | Execution engine inside the package |
| Memory helpers (`memory-add`, `memory-promote`, query scripts) | Cross-tool observability dashboard |
| Linters, CI, frontmatter validation | Runtime GUI / web dashboard |
| Skill orchestration via markdown citations + deterministic helpers | Opinionated skill-resolver algorithm |

Frameworks like LangChain or CrewAI are **runtimes**; this package
sits one layer above them — it tells whichever agent you already use
how to behave, not how to execute.

Example of what *is* in scope: every artefact's frontmatter validates
against a JSON-Schema under [`scripts/schemas/`](scripts/schemas/)
([contract](agents/docs/frontmatter-contract.md)), enforced by
`task validate-schema` in CI. Runtime validation inside a live agent
session is explicitly not.

---

## You don't need everything

Start with **Rules + Skills**. Everything else is optional.

| Mode | What's active | Runtime process overhead |
|---|---|---|
| **Minimal** (default) | Rules, Skills, Commands | None |
| **Balanced** | + Runtime Dispatcher for skills that declare a shell command | Low |
| **Full** | + Tool Adapters (GitHub / Jira read-only, opt-in) | Moderate |

Nothing runs automatically without your control. [Configure modes →](docs/customization.md)

> **Stability tiers** — [`STABILITY.md`](docs/contracts/STABILITY.md) for
> the full matrix. Runtime Dispatcher: **stable** (`php` / `node` handlers
> scaffold). Work Engine: **beta (beta)** — orchestrator behind `/work`
> + `/implement-ticket`. Tool Adapters: **experimental**, read-only,
> behind `full`. `minimal` profile unaffected.

---

## Who this is for

`agent-config` ships a **stack-agnostic governance core** (orchestration contract, role modes, command clusters, quality gates, audit-discipline) plus **parallel stack-specific skill sets** at varying depth:

| Stack | Coverage |
|---|---|
| Laravel · modern PHP | Skills, rules, project-analysis, quality-tool wiring (Pest · PHPStan · Rector · ECS) |
| Symfony · Zend / Laminas | Project-analysis skills + shared PHP coder/quality skills |
| Next.js · React · Node / Express | Project-analysis skills + UI directive set (`react-shadcn`) |
| Vue · plain HTML | UI directive set (`vue` / `plain`) — analysis skills as they ship |
| Cross-stack | API design · testing · security · database · Docker · Git · CI · review · threat modeling · observability |

**Deepest reference stack today: Laravel.** Skill density covers Pest, PHPStan, Rector, Eloquent, Livewire/Flux, Horizon, Pulse, Reverb, Pennant — the stack the package was first proven on. Other stacks ship in the order they are battle-tested, not second-class. Adopting on a thin stack? Open an issue so we can prioritize the right skills for extraction.

---

## Featured Skills

| Skill | What your agent learns |
|---|---|
| [`laravel`](.agent-src/skills/laravel/SKILL.md) | Write Laravel code following framework conventions and project architecture |
| [`pest-testing`](.agent-src/skills/pest-testing/SKILL.md) | Write Pest tests with clear intent, good coverage, and project conventions |
| [`eloquent`](.agent-src/skills/eloquent/SKILL.md) | Eloquent models, relationships, scopes, eager loading, type safety |
| [`create-pr`](.agent-src/commands/create-pr.md) | Create GitHub PRs with structured descriptions from Jira tickets |
| [`commit`](.agent-src/commands/commit.md) | Stage and commit changes following Conventional Commits |
| [`/fix ci`](.agent-src/commands/fix.md) | Fetch CI errors from GitHub Actions and fix them |
| [`/fix pr-comments`](.agent-src/commands/fix.md) | Fix and reply to all open review comments on a PR |
| [`quality-fix`](.agent-src/commands/quality-fix.md) | Run PHPStan/Rector/ECS and fix all errors |
| [`bug-analyzer`](.agent-src/skills/bug-analyzer/SKILL.md) | Root cause analysis from Sentry errors or Jira tickets |
| [`improve-before-implement`](.agent-src/rules/improve-before-implement.md) | Challenge weak requirements before coding |
| [`docker`](.agent-src/skills/docker/SKILL.md) | Dockerfile, docker-compose, container management |
| [`security`](.agent-src/skills/security/SKILL.md) | Auth, policies, CSRF, rate limiting, secure coding |
| [`api-design`](.agent-src/skills/api-design/SKILL.md) | REST conventions, versioning, deprecation |
| [`database`](.agent-src/skills/database/SKILL.md) | MariaDB optimization, indexing, query performance |

→ [Public catalog](docs/catalog.md) (all rules, skills, commands, guidelines) · [Skills only](docs/skills-catalog.md) · [llms.txt](llms.txt)

---

## Featured Commands

| Command | What it does |
|---|---|
| [`/commit`](.agent-src/commands/commit.md) | Stage and commit with Conventional Commits |
| [`/create-pr`](.agent-src/commands/create-pr.md) | Create PR with Jira-linked description |
| [`/fix ci`](.agent-src/commands/fix.md) | Fetch and fix GitHub Actions failures |
| [`/fix pr-comments`](.agent-src/commands/fix.md) | Fix and reply to review comments |
| [`/optimize skills`](.agent-src/commands/optimize.md) | Audit skills, find duplicates, run linter |
| [`/feature plan`](.agent-src/commands/feature.md) | Interactively plan a feature |
| [`/quality-fix`](.agent-src/commands/quality-fix.md) | Run and fix all quality checks |
| [`/review-changes`](.agent-src/commands/review-changes.md) | Self-review before creating a PR |
| [`/jira-ticket`](.agent-src/commands/jira-ticket.md) | Read ticket from branch, implement feature |
| [`/compress`](.agent-src/commands/compress.md) | Compress skills for token efficiency |

→ [Browse all 93 active commands](.agent-src/commands/) &nbsp;<sub>(95 files total — 2 are deprecation shims that redirect to clustered commands)</sub>

---

## Supported Tools

### Project-installed (Composer / npm)

Every developer gets the same behavior. No per-user setup needed.

| Tool | Rules | Skills | Commands | How it works |
|---|---|---|---|---|
| **Augment VSCode/IntelliJ** | ✅ | ✅ | ✅ | Reads `.augment/` from project |
| **Claude Code** | ✅ | ✅ | ✅ | Reads `.claude/` (skills + commands as skills) |
| **Cursor** | ✅ | — | ☑️ | Reads `.cursor/rules/` + commands via AGENTS.md |
| **Cline** | ✅ | — | ☑️ | Reads `.clinerules/` + commands via AGENTS.md |
| **Windsurf** | ✅ | — | ☑️ | Reads `.windsurfrules` + commands via AGENTS.md |
| **Gemini CLI** | ✅ | — | ☑️ | Reads `GEMINI.md` (includes commands reference) |
| **GitHub Copilot** | ✅ | — | ☑️ | Reads `.github/copilot-instructions.md` (includes commands) |

✅ = native support &nbsp; — = not available &nbsp; ☑️ = text reference only
(commands are listed in `AGENTS.md`, but the tool cannot invoke them as
native slash-commands)

> **What this means in practice:** Augment Code and Claude Code get the full
> package (rules + 129 skills + 93 native commands). Cursor, Cline, Windsurf,
> Gemini CLI, and GitHub Copilot only get the **rules** natively; skills and
> commands are available to them as documentation the agent can read, not as
> first-class features.

### Plugin-installed (optional, for global use)

Works across all your projects. Auto-updates via marketplace.

| Tool | Rules | Skills | Commands | Install |
|---|---|---|---|---|
| **Augment CLI** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#augment-cli) |
| **Claude Code** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#claude-code) |
| **Copilot CLI** | ✅ | ✅ | ✅ | [Install →](docs/installation.md#copilot-cli) |

Skills use a `SKILL.md` format with YAML frontmatter that is compatible with
the [Agent Skills](https://agentskills.io) community spec and with Claude
Code's Agent Skills specification.

### Cloud / Hosted-agent surfaces (paste-in or upload)

For platforms where the package's scripts cannot run, the package
builds artefacts you upload or paste into the platform's own surface.

| Surface | Output | How to install |
|---|---|---|
| **Linear AI** (Codegen, Charlie, …) | `dist/linear/{workspace,team,personal}.md` | [Install →](docs/installation.md#linear-ai-codegen-charlie-) |
| **Claude.ai Web Skills** | `dist/cloud/<skill>.zip` | [Install →](docs/installation.md#claudeai-web-skills-ui) |

The Linear digest is split into three layers — workspace (universal
coding posture), team (framework-specific), personal (empty stub). See
[`docs/contracts/linear-ai-three-layers.md`](docs/contracts/linear-ai-three-layers.md) (beta)
for the rationale and
[`docs/contracts/linear-ai-rules-inclusion.md`](docs/contracts/linear-ai-rules-inclusion.md) (beta)
for the per-rule routing.

---

## Core Principles

- **Analyze before implementing** — no guessing, no blind edits
- **Verify with real execution** — no "should work"
- **Challenge to improve** — agents are thought partners, not yes-machines
- **Strict by design** — quality over flexibility
- **Zero overhead by default** — nothing runs until you ask for it

---

## Documentation

| Document | Content |
|---|---|
| [**Getting Started**](docs/getting-started.md) | First run, 3-test experience, profiles, next steps |
| [**Installation**](docs/installation.md) | Plugin setup, Composer/npm, Git submodule, orchestrator details |
| [**Architecture**](docs/architecture.md) | System layers, content pipeline, tool support matrix |
| [**Development**](docs/development.md) | Prerequisites, editing workflow, all `task` commands, project structure |
| [**Customization**](docs/customization.md) | Overrides, AGENTS.md, agent settings, cost profiles |
| [**Quality & CI**](docs/quality.md) | Linting, CI pipeline, compression system |
| [**Migration**](docs/MIGRATION.md) | Per-version upgrade steps (e.g. `implement_ticket → work_engine` in 1.15.0) |

Uninstalling: see
[docs/installation.md#uninstalling](docs/installation.md#uninstalling) —
there is no dedicated uninstall command; removal is a documented manual
step (package manager + `rm -rf` of generated dirs).

### Maintainer telemetry (opt-in, default-off)

A local-only artefact-engagement log can be enabled by maintainers to see
which skills, rules, commands, and guidelines the agent actually consults
and applies during a `/implement-ticket` or `/work` run. The log is a
JSONL file under the project root; nothing is uploaded, nothing is shared
across projects. Default is off; consumers see no prompts.

```yaml
# .agent-settings.yml — opt in only when you want measurement
telemetry:
  artifact_engagement:
    enabled: true
```

Reports: `./agent-config telemetry:report`. Full contract,
privacy/redaction floor, and quartile semantics:
[`docs/contracts/artifact-engagement-flow.md`](docs/contracts/artifact-engagement-flow.md) (beta).

### Context-aware command suggestion

When a user prompt matches a command's purpose ("setze ticket ABC-123 um"
→ `/implement-ticket`), the agent surfaces matches as a numbered-options
block with an always-present "run the prompt as-is" escape. **Nothing
auto-executes** — the user picks every time. Three opt-out paths:

```yaml
# .agent-settings.yml
commands:
  suggestion:
    enabled: true            # global on/off
    blocklist: []            # specific commands never suggested
    confidence_floor: 0.6    # tunable per command in frontmatter
```

Per-conversation: `/command-suggestion-off` disables the layer until
re-enabled or the chat ends. Full scoring contract and hardening:
[`adr-command-suggestion`](docs/contracts/adr-command-suggestion.md),
[`command-suggestion-flow`](docs/contracts/command-suggestion-flow.md) (beta).

---

## Development

Edit in `.agent-src.uncompressed/`, compress, verify:

```bash
task sync          # Sync non-.md files
task ci            # Run all CI checks
task test          # Run all tests
task lint-skills   # Lint skills, rules, commands
```

→ Full commands and project structure: [**docs/development.md**](docs/development.md)

## Requirements

**To install the package into a consumer project:**

- **Bash** — primary installer is `scripts/install`, orchestrating
  `scripts/install.sh` (payload sync) and `scripts/install.py` (bridges).
  Available on macOS, Linux, and WSL.
- **Python 3.10+** — required for the bridge stage only. Pre-installed
  on macOS 12.3+ and all major Linux distros. If missing, the
  orchestrator skips bridges and completes the payload sync.
- **Composer or npm** — to pull the package itself.

**Platform support:** macOS 12.3+, Linux (modern distros), and Windows
(WSL2) are fully supported. Git Bash works but symlinks require
Developer Mode; native PowerShell / cmd is not supported. Contributors
rebuilding `.augment/` locally also need [Task](https://taskfile.dev/).

## License

[MIT](LICENSE).
