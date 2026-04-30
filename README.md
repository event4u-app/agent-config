# Agent Config — Governed Agent System

Teach your AI agents Laravel, PHP, testing, Git workflows, and **120+ more skills** — with quality guardrails built in.

> Your agent learns to write Laravel code, run tests, create PRs, fix CI — and follows your team's coding standards while doing it.

<p align="center">
  <strong>125 Skills</strong> · <strong>49 Rules</strong> · <strong>75 Commands</strong> · <strong>46 Guidelines</strong> · <strong>8 AI Tools</strong>
</p>

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

→ [Memory contract & retrieval API](agents/contexts/agent-memory-contract.md)

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
  [Flow contract](agents/contexts/implement-ticket-flow.md)

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
to `/implement-ticket`. UI-shaped prompts are rejected with an
explicit pointer to Roadmap 3 — the prompt-driven flow is
backend-only in this release.

→ [Command reference](.agent-src/commands/work.md) ·
  [`refine-prompt` skill](.agent-src/skills/refine-prompt/SKILL.md) ·
  [ADR](agents/contexts/adr-prompt-driven-execution.md)

**Pick which one:** ticket id or pasted ticket payload → `/implement-ticket`.
Free-form goal, no ticket → `/work`. The two share `.work-state.json`
and refuse to switch envelopes mid-flight.

---

## What your agent is asked to do

The package ships rules and skills that guide the agent toward these
behaviors. The agent still decides in the moment, so the table is a
description of intent — not a guarantee of output.

| Default behavior | With agent-config (the agent is instructed to) |
|---|---|
| Guess and edit blindly | Analyze code before changing it — no blind edits |
| Drift from project conventions | Follow the project's PHP/Laravel coding standards |
| Skip or invent tests | Write Pest tests following the project's conventions |
| Write generic commit messages | Use Conventional Commits with scope and Jira links |
| Skip quality checks | Run PHPStan, Rector, ECS and fix reported errors |
| Open PRs without context | Produce structured PR descriptions from Jira tickets |
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

| Mode | What's active | Token overhead |
|---|---|---|
| **Minimal** (default) | Rules, Skills, Commands | Zero |
| **Balanced** | + Runtime dispatcher for skills that declare a shell command | Low |
| **Full** | + Tool adapters (GitHub / Jira read-only, opt-in) | Moderate |

Nothing runs automatically without your control. [Configure modes →](docs/customization.md)

> **Experimental modules:** the runtime (dispatcher + shell handler) runs
> two pilot skills in CI (`lint-skills`, `check-refs`). The tool registry
> ships two read-only adapters (GitHub, Jira) behind the `full` profile.
> Other handlers (`php`, `node`) are still scaffold. The `minimal`
> profile — which most users should pick — is unaffected.

---

## Who this is for

The content is **built for PHP / Laravel teams** and is where the package
is most useful out of the box. Skills, rules, and quality-tool integration
assume a Laravel-style repository (Pest, PHPStan, Rector, ECS, Artisan,
Composer workflows). You can install it on any project, but:

| Stack | Fit |
|---|---|
| **Laravel / modern PHP** | ✅ Primary audience — most skills apply directly |
| **Other PHP frameworks** (Symfony, Zend/Laminas) | ☑️ Deep-analysis skills apply; framework-specific ones do not |
| **JavaScript / TypeScript / Next.js / Node** | ☑️ General skills + governance apply; PHP-specific skills are noise |
| **Other stacks** | ⚠️ Cherry-pick rules/commands; expect to disable a lot |

A language-agnostic core is on the roadmap but not yet extracted. If you
adopt the package outside the primary audience, please open an issue so we
can prioritize the right skills for extraction.

---

## Featured Skills

| Skill | What your agent learns |
|---|---|
| [`laravel`](.agent-src/skills/laravel/SKILL.md) | Write Laravel code following framework conventions and project architecture |
| [`pest-testing`](.agent-src/skills/pest-testing/SKILL.md) | Write Pest tests with clear intent, good coverage, and project conventions |
| [`eloquent`](.agent-src/skills/eloquent/SKILL.md) | Eloquent models, relationships, scopes, eager loading, type safety |
| [`create-pr`](.agent-src/commands/create-pr.md) | Create GitHub PRs with structured descriptions from Jira tickets |
| [`commit`](.agent-src/commands/commit.md) | Stage and commit changes following Conventional Commits |
| [`fix-ci`](.agent-src/commands/fix-ci.md) | Fetch CI errors from GitHub Actions and fix them |
| [`fix-pr-comments`](.agent-src/commands/fix-pr-comments.md) | Fix and reply to all open review comments on a PR |
| [`quality-fix`](.agent-src/commands/quality-fix.md) | Run PHPStan/Rector/ECS and fix all errors |
| [`bug-analyzer`](.agent-src/skills/bug-analyzer/SKILL.md) | Root cause analysis from Sentry errors or Jira tickets |
| [`improve-before-implement`](.agent-src/rules/improve-before-implement.md) | Challenge weak requirements before coding |
| [`docker`](.agent-src/skills/docker/SKILL.md) | Dockerfile, docker-compose, container management |
| [`security`](.agent-src/skills/security/SKILL.md) | Auth, policies, CSRF, rate limiting, secure coding |
| [`api-design`](.agent-src/skills/api-design/SKILL.md) | REST conventions, versioning, deprecation |
| [`database`](.agent-src/skills/database/SKILL.md) | MariaDB optimization, indexing, query performance |

→ [Browse all skills](docs/skills-catalog.md) · [llms.txt](llms.txt)

---

## Featured Commands

| Command | What it does |
|---|---|
| [`/commit`](.agent-src/commands/commit.md) | Stage and commit with Conventional Commits |
| [`/create-pr`](.agent-src/commands/create-pr.md) | Create PR with Jira-linked description |
| [`/fix-ci`](.agent-src/commands/fix-ci.md) | Fetch and fix GitHub Actions failures |
| [`/fix-pr-comments`](.agent-src/commands/fix-pr-comments.md) | Fix and reply to review comments |
| [`/quality-fix`](.agent-src/commands/quality-fix.md) | Run and fix all quality checks |
| [`/review-changes`](.agent-src/commands/review-changes.md) | Self-review before creating a PR |
| [`/jira-ticket`](.agent-src/commands/jira-ticket.md) | Read ticket from branch, implement feature |
| [`/compress`](.agent-src/commands/compress.md) | Compress skills for token efficiency |

→ [Browse all 75 commands](.agent-src/commands/)

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
> package (rules + 125 skills + 75 native commands). Cursor, Cline, Windsurf,
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
[`agents/contexts/linear-ai-three-layers.md`](agents/contexts/linear-ai-three-layers.md)
for the rationale and
[`agents/contexts/linear-ai-rules-inclusion.md`](agents/contexts/linear-ai-rules-inclusion.md)
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

Uninstalling: see
[docs/installation.md#uninstalling](docs/installation.md#uninstalling) —
there is no dedicated uninstall command; removal is a documented manual
step (package manager + `rm -rf` of generated dirs).

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

**Platform support:**

| Platform | Status |
|---|---|
| macOS 12.3+ | ✅ Supported |
| Linux (modern distros) | ✅ Supported |
| Windows (WSL2) | ✅ Supported |
| Windows (Git Bash) | ⚠️ Works; symlinks need Developer Mode |
| Windows (native PowerShell/cmd) | ❌ Not supported |

**For contributors only** (rebuilding `.augment/` locally):

- [Task](https://taskfile.dev/) — runs the CI pipeline (`task ci`).
- No runtime dependencies — the package ships static markdown files.

## License

[MIT](LICENSE) — you can use, fork, and redistribute this freely.
