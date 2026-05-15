# Agent Config — Universal AI Agent OS

> **A deterministic orchestration contract for AI agents — audited skills, governance rules, replayable state — usable by developers, founders, and creators alike.**

Give your AI agents an audit-disciplined execution layer: **210 skills**, **79 governance rules**, **124 commands**, and a replayable state machine that turns any host agent (Claude Code, Augment, Cursor, Copilot, Windsurf) into a reliable team member.

| 👩‍💻 Developers | 🚀 Founders & Operators | ✍️ Creators & Consultants |
|---|---|---|
| Implement tickets, fix CI, write tests, run PR reviews — `/implement-ticket`, `/work`, `/commit`, `/fix ci`, `/create-pr` — with stack-aware skills for Laravel · Symfony · Next.js · React · Node. | Pitch decks, runway math, OKR trees, GTM launches, pricing reviews — `runway-cognition`, `unit-economics-modeling`, `fundraising-narrative`, `gtm-launch`, `okr-tree-modeling`. | Editorial calendars, brand voice, ghostwriting, content funnels, discovery interviews — `voice-and-tone-design`, `editorial-calendar`, `ghostwriter`, `content-funnel-design`, `discovery-interview`. |

<p align="center">
  <strong>210 Skills</strong> · <strong>79 Rules</strong> · <strong>124 Commands</strong> · <strong>72 Guidelines</strong> · <strong>22 Personas</strong> · <strong>5 Advisors</strong> · <strong>8 AI Tools</strong>
</p>

---

## Use it in your project

You run the package from a consumer repo — bootstrap via `npx`, let the
agent pick up your stack, and ship work end-to-end. New install? Start
with the [Quickstart](#quickstart) to write `.agent-settings.yml`,
`.augment/`, `.claude/`, …. Already installed? [Supported Tools](#supported-tools)
shows which AIs the package wires up, and [Featured Commands](#featured-commands)
lists the end-to-end workflows (`/implement-ticket`, `/work`, `/commit`,
`/create-pr`). For a deeper tour, see the
[2-minute demo: `/implement-ticket`](#2-minute-demo-implement-ticket).

## Prove it

The package is audit-disciplined by construction — every memory consult,
decision key, and hook concern lands in `agents/state/` so you can
replay it. [Core Principles](#core-principles) names the four invariants.
[What this package is — and what it isn't](#what-this-package-is--and-what-it-isnt)
draws the scope boundary. [Documentation](#documentation) lists the
contracts the package ships against, including
[`memory-visibility-v1`](docs/contracts/memory-visibility-v1.md) (beta) and
[`decision-trace-v1`](docs/contracts/decision-trace-v1.md) (beta).

## Contribute

Working on the package itself rather than with it?
[Development](#development) covers the `task ci` pipeline,
[Requirements](#requirements) the toolchain, and
[Maintainer telemetry](#maintainer-telemetry-opt-in-default-off) the
opt-in measurement loop. The source-of-truth tree is
`.agent-src.uncompressed/`; never hand-edit the generated `.augment/`
or `.agent-src/`.

## Quickstart

**Three steps. Five minutes. Decision-traced first task.**

```bash
# 1. Install (writes .agent-settings.yml, .augment/, .claude/, …)
npx @event4u/agent-config init

# 2. First-run setup (sets your name, IDE, cost profile)
#    Open your AI agent (Claude Code, Cursor, …) and type:
/onboard

# 3. First real task — agent refines, plans, logs a decision_result
/work "your first real task"
```

A `decision_result` entry lands in `agents/state/` confirming the
work-engine phases ran end-to-end. Stack-aware skills auto-load.

> Pick specific AIs, switch to global scope, deploy MCP on Cloudflare,
> or wire optional memory — see [**Detailed installation**](#detailed-installation)
> below. Contributors rebuilding the package — jump to
> [**Development**](#development).
>
> **Non-developer? No terminal?** Skip `npx` entirely — host
> agent-config as a [Cloudflare MCP endpoint](#self-hosted-mcp-on-cloudflare--zero-local-install)
> and connect from Claude Desktop. The [role-based getting started](docs/getting-started-by-role.md)
> guide names the three skills each role reaches for first (Creator,
> Founder, Consultant, GTM, Finance/Ops, Developer).

### Detailed installation

Two minutes from `npx` to a better-behaved agent — no install, no
vendored package, no postinstall hook.

**v2.1+ — global-first by default.** Running `init` outside a project
defaults to a user-scope install (`~/.claude/`, `~/.cursor/`, …) and
records itself in `~/.config/agent-config/installed.lock`. Running it
inside a project (a `package.json` / `composer.json` / `pyproject.toml`
manifest is present) defaults to a project-scope install. Override with
`--scope=global` or `--scope=project`. See
[`docs/installation.md`](docs/installation.md) for the full matrix.

### For teams (recommended)

Run once in the project root — `npx` resolves the runtime against the
npm registry on every invocation, and the version pin in
`.agent-settings.yml` keeps it reproducible:

```bash
# Bootstrap (writes .agent-settings.yml, .augment/, .claude/, …):
npx @event4u/agent-config init

# Any subsequent command:
npx @event4u/agent-config <command>
```

The init writes:

- `.agent-settings.yml` (including the `agent_config_version` pin)
- `.vscode/settings.json`, `.augment/settings.json`
- per-tool glue: `.claude/`, `.cursor/`, `.clinerules/`,
  `.windsurfrules`, `GEMINI.md`, `.github/copilot-instructions.md`

Want to keep the runtime global and commit only the per-project
shell (`.agent-settings.yml`, `agents/`, `./agent-config` wrapper —
no `.augment/` / `.claude/` / `.cursor/` in the repo)?

```bash
npm install -g @event4u/agent-config && agent-config init --minimal
```

See [`docs/installation.md § Global CLI + per-project settings`](docs/installation.md#global-cli--per-project-settings-minimal-flow)
for the decision table and migration notes.

→ Migrating from a pre-vX.0 install? See
[`docs/migration/v1-to-v2.md`](docs/migration/v1-to-v2.md). The one-shot
`npx @event4u/agent-config migrate` removes the legacy
`composer.json` entry / `node_modules/@event4u/agent-config`,
deletes the retired `~/.claude/{rules,skills}/event4u/` namespace if
present, and writes the new `.agent-settings.yml` shape.

**To run:** Node ≥ 18 and Python 3 (stdlib only — default on macOS
12.3+ / major Linux distros). Python missing → orchestrator warns and
continues payload-only. Task is needed only for *contributors*
rebuilding compressed content — see [CONTRIBUTING.md](CONTRIBUTING.md).

**Verify hook coverage** after installing — every supported platform
(Augment, Claude Code, Cowork, Cursor, Cline, Windsurf, Gemini CLI,
Copilot fallback) is wired through one universal dispatcher per
[`hook-architecture-v1`](docs/contracts/hook-architecture-v1.md) (beta). Run
`./agent-config hooks:status` for the matrix (`--strict` for CI,
`--format json` for tooling). The installer also dry-fires the
dispatcher per bridge as a post-install smoke test (skip: `--no-smoke`).

### Pick specific AIs

Default `init` wires every supported AI. To install just one, pass
`--tools=<name>`:

```bash
npx @event4u/agent-config init --tools=claude-code      # Claude Code
npx @event4u/agent-config init --tools=cursor           # Cursor
npx @event4u/agent-config init --tools=windsurf         # Windsurf
npx @event4u/agent-config init --tools=cline            # Cline
npx @event4u/agent-config init --tools=gemini-cli       # Gemini CLI
npx @event4u/agent-config init --tools=copilot          # GitHub Copilot
npx @event4u/agent-config init --tools=augment --global # Augment Code (global-only)
npx @event4u/agent-config init --tools=roocode          # Roo Code
npx @event4u/agent-config init --tools=aider            # Aider
npx @event4u/agent-config init --tools=codex            # Codex CLI
npx @event4u/agent-config init --tools=claude-desktop   # Claude Desktop
npx @event4u/agent-config init --tools=continue         # Continue
```

Multiple AIs in one shot: `--tools=claude-code,cursor,augment`.

#### Global install (user-scope, available across projects)

Add `--global` to write to the user-scope paths from
[`ADR-007`](docs/decisions/ADR-007-agent-discovery-scopes.md) (`~/.claude/`,
`~/.cursor/`, …) instead of the current project:

```bash
npx @event4u/agent-config init --global                       # all tools, user-scope
npx @event4u/agent-config init --tools=claude-code --global   # → ~/.claude/
npx @event4u/agent-config init --tools=cursor --global        # → ~/.cursor/
```

Per-AI scope support varies — Claude Desktop and Augment Code, for
example, are global-only (Claude Desktop has no project-local
discovery on macOS; Augment ships from a single user-scope tree
(`~/.augment/`) — see [`ADR-007 § Amendment 2026-05-13 — global-only`](docs/decisions/ADR-007-agent-discovery-scopes.md#amendment-2026-05-13--augment-global-only)),
while Roo Code and Continue.dev are project-local. The Supported
Tools table below documents per-AI scope. Incompatible combinations
(e.g. `--tools=roocode --global`, `--tools=claude-desktop` without
`--global`, or `--tools=augment` without `--global`) are rejected
with a directive error; `--tools=all` silently filters to the scope's
compatible subset.

### For individual use (optional)

Skills-only, global across projects — installs into the agent itself,
no per-repo `init`:

```bash
<auggie|claude|copilot> plugin install agent-config@event4u-agent-config
```

→ [All install options & project bridge setup](docs/installation.md)

**Open your agent and try these 3 prompts:**

1. `"Refactor this function"` → watch: agent analyzes first
2. `"Add caching to this"` → watch: agent asks instead of guessing
3. `"Implement this feature"` → watch: agent respects your codebase

→ [Full getting started guide](docs/getting-started.md) ·
[More examples & expected behavior](docs/showcase.md)

### Self-hosted MCP on Cloudflare — zero local install

Skills, commands, rules, and guidelines can be served as an MCP endpoint
from your own Cloudflare Worker — no clone, no `task mcp:setup`, no
Python venv on the consumer machine, just an HTTP URL any MCP client
(Claude Desktop, Claude Code, Cursor, Zed, Continue, hosted agents)
talks to.

The Worker source lives in `workers/mcp/`; deploying it to your own
Cloudflare account takes ~5 minutes:

```bash
task mcp:cloud:login         # one-time, opens browser
task mcp:cloud:setup         # check → r2-create → r2-verify → whoami
task mcp:cloud:secret-put    # opt in to bearer-auth mode (recommended for private deploys)
# Then deploy via CI — see operator guide below.
```

The Worker ships **two MVP-1 auth modes** the operator picks at deploy
time (per `docs/contracts/mcp-cloud-scope.md` § `Auth surface`):

- **`public`** — default. No per-request auth. Edge cache plus
  Cloudflare account-level DDoS shielding are the ingress controls.
  Use only for OSS, read-only deploys where the URL is shared widely.
- **`bearer-auth`** — operator opt-in. Set the `MCP-Token` Wrangler
  secret with `task mcp:cloud:secret-put`. Every `POST /` then
  requires `Authorization: Bearer <MCP-Token>`. `GET /` liveness
  stays open. Use this for private deploys.

HMAC and Cloudflare Access modes are declared but **deferred** in the
contract (`hmac-deferred`, `cf-access-deferred`) — wake-up triggers
listed there. The README intentionally names no mode the contract
has not declared (bidirectional drift test enforces this).

After deploy your Worker lives at
`https://agent-config-mcp.<your-account>.workers.dev` (or a custom
domain you wire in Step 7 of the operator guide). Verify:

```bash
curl https://agent-config-mcp.<your-account>.workers.dev
# → { "ok": true, "name": "agent-config-mcp", "release_key": "v…", … }
```

Per-client setup snippets (Claude Desktop, Claude Code, Cursor, Zed,
Continue) — [`docs/setup/mcp-client-config.md`](docs/setup/mcp-client-config.md).
URL shapes (latest vs. pinned `/v<X.Y.Z>`) — [`docs/setup/mcp-cloud-endpoints.md`](docs/setup/mcp-cloud-endpoints.md).
Full operator walkthrough (account, R2, GitHub secrets, deploy) —
[`docs/setup/mcp-cloud-setup.md`](docs/setup/mcp-cloud-setup.md).
Experimental — A0-cloud contract lives at `docs/contracts/mcp-cloud-scope.md` (internal reference only per `STABILITY.md`).

#### Lock your Worker behind a Bearer token (`bearer-auth` mode)

In `bearer-auth` mode the Worker requires `Authorization: Bearer
<MCP-Token>` on every `POST /` and returns HTTP 401 + RFC 6750
`WWW-Authenticate` on mismatch. The `GET /` liveness probe stays open
so health checks keep working without the token. Switch modes by
setting (or clearing) the `MCP-Token` secret:

```bash
task mcp:cloud:secret-put          # wraps `npx wrangler secret put MCP-Token --name agent-config-mcp`
# wrangler prompts for the value interactively — never passed via argv.
```

Once the secret is set, every client config block needs the token in
its headers — see [`docs/setup/mcp-client-config.md`](docs/setup/mcp-client-config.md) § Bearer auth for the
per-client snippets (Claude Desktop, Claude Code, Cursor, Zed,
Continue). Mode contract is normative: `docs/contracts/mcp-cloud-scope.md`
§ `Auth surface` § `bearer-auth`.

> **Scope — Lite, not Full.** The Worker serves the **MCP Lite
> scope** (`mcp_scope: lite` per `docs/contracts/mcp-cloud-scope.md`):
> the read-only governance surface (skills · commands · rules ·
> guidelines · contexts) as MCP prompts and resources, plus a small
> set of read-only tools (`memory_lookup`, `chat_history_read`,
> `list_*`, `read_resource_body`). It does **not** execute any of the
> ~112 Python scripts that ship with the package (linters, audits,
> `task ci`, work-engine hooks, …) — those require the **MCP Full
> scope** (`mcp_scope: full` — local install per [Quickstart](#quickstart)).
> The Lite vs Full boundary is normative in
> `docs/contracts/mcp-cloud-scope.md` (internal reference only per
> `STABILITY.md`).

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

→ [Memory contract & retrieval API](docs/contracts/agent-memory-contract.md) (beta) · [Built-in MCP server](docs/mcp-server.md) (experimental — local stdio access from Claude Desktop / Cursor / Zed / Continue, install with `task mcp:setup`; promotion to beta gated on `docs/contracts/mcp-beta-criteria.md`)

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

`cost_profile` is the master switch for **rule-tier loading**. The kernel
(always-loaded Iron-Law floor, ≤ 26k chars across 9 rules) ships in every
profile; tier-1 and tier-2 rules are gated by profile and resolved at
session start from `router.json`.

| Profile | Rule tiers loaded | Token footprint | Best for |
|---|---|---|---|
| **`minimal`** | kernel only (no router, no auto-rules) | lowest | Cost-sensitive sessions; trivial Q&A; CI runs |
| **`balanced`** (default) | kernel + tier-1 auto-rules | medium | Day-to-day work — current behaviour superset |
| **`full`** | kernel + tier-1 + tier-2 (everything) | highest | Agent-config development; full rule fidelity |

Architecture: [`docs/contracts/rule-router.md`](docs/contracts/rule-router.md) (beta) ·
kernel set: [`docs/contracts/kernel-membership.md`](docs/contracts/kernel-membership.md) (beta) ·
[Configure profiles →](docs/customization.md)

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
| Symfony | Workflow skill (`symfony-workflow`) + project-analysis + shared PHP coder/quality skills |
| Zend / Laminas | Project-analysis skills + shared PHP coder/quality skills |
| Next.js · App Router | Workflow skill (`nextjs-patterns`) + project-analysis + UI directive set (`react-shadcn`) |
| React · Node / Express | Project-analysis skills + UI directive set (`react-shadcn`) |
| Vue · plain HTML | UI directive set (`vue` / `plain`) — analysis skills as they ship |
| Cross-stack | API design · testing · security · database · Docker · Git · CI · review · threat modeling · observability |

**Deepest reference stack today: Laravel** — Pest, PHPStan, Rector, Eloquent, Livewire/Flux, Horizon, Pulse, Reverb, Pennant. **Workflow-grade second tier: Symfony** (`symfony-workflow` — DI, Doctrine, Messenger, voters, Twig) and **Next.js App Router** (`nextjs-patterns` — RSC boundaries, Server Actions, caching, route handlers). Other stacks ship in the order they are battle-tested, not second-class. Adopting on a thin stack? Open an issue so we can prioritize the right skills for extraction.

---

## Featured Domain: Laravel Development

Laravel is the package's deepest reference stack — Pest, PHPStan, Rector, Eloquent, Livewire/Flux, Horizon, Pulse, Reverb, Pennant — with end-to-end workflows for tickets, CI, and PR review. New here and shipping Laravel? Start at [`docs/getting-started-laravel.md`](docs/getting-started-laravel.md) — it wires up `.agent-settings.yml`, picks the right quality tools, and walks through a full `/implement-ticket` loop. For other stacks (Symfony, Next.js, React, Node) or non-dev surfaces (founder / creator / consultant), see [`docs/getting-started-by-role.md`](docs/getting-started-by-role.md).

---

## Data governance & domain safety

12 domain-safety rules (`.agent-src.uncompressed/rules/domain-safety-*.md`) act as a per-domain output floor — PII redaction for support / finance / recruiting / marketing, advice disclaimers for legal / financial / medical / consulting drafts, retention guidance for finance / support, and ops floors for logging / export. Full surface → rule(s) → floor matrix: [`docs/safety.md`](docs/safety.md).

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

→ [Browse all 124 active commands](.agent-src/commands/)

---

## Supported Tools

### Project-installed (`npx`)

Every developer gets the same behavior. No per-user setup needed —
`npx @event4u/agent-config init` writes the per-tool glue listed below.

| Tool | Rules | Skills | Commands | How it works |
|---|---|---|---|---|
| **Claude Code** | ✅ | ✅ | ✅ | Reads `.claude/` (skills + commands as skills) |
| **Cursor** | ✅ | — | ☑️ | Reads `.cursor/rules/` + commands via AGENTS.md |
| **Cline** | ✅ | — | ☑️ | Reads `.clinerules/` + commands via AGENTS.md |
| **Windsurf** | ✅ | — | ☑️ | Reads `.windsurfrules` + commands via AGENTS.md |
| **Gemini CLI** | ✅ | — | ☑️ | Reads `GEMINI.md` (includes commands reference) |
| **GitHub Copilot** | ✅ | — | ☑️ | Reads `.github/copilot-instructions.md` (includes commands) |
| **Roo Code** | ✅ | — | ☑️ | Auto-discovers `.roo/rules/*.md` + AGENTS.md |
| **Codex CLI** | ✅ | — | ☑️ | Auto-discovers `AGENTS.md` at project root |
| **Continue.dev** | ✅ | — | ☑️ | Auto-discovers `.continue/rules/*.md` + AGENTS.md |
| **Aider** | 📌 | — | — | Marker + manual `read:` in `.aider.conf.yml` |
| **Augment VSCode/IntelliJ** | 📌 | — | — | Global-only — install with `--global` (see [ADR-007 Amendment 2026-05-13](docs/decisions/ADR-007-agent-discovery-scopes.md#amendment-2026-05-13--augment-global-only)); project writes `.augment/settings.json` marker only |
| **Claude Desktop** | 📌 | — | — | Global-only — install with `--global` (see ADR-007) |

✅ = native support &nbsp; — = not available &nbsp; ☑️ = text reference only
(commands listed in `AGENTS.md`, tool cannot invoke them as native
slash-commands) &nbsp; 📌 = informational marker only (no auto-discovery
or manual wiring required)

> **What this means in practice:** Claude Code gets the full project-scoped
> package (rules + 210 skills + 124 native commands); Augment Code gets the
> same content but only from a single global install at `~/.augment/`.
> Cursor, Cline, Windsurf, Gemini CLI, GitHub Copilot, Roo Code, Codex CLI,
> and Continue.dev only get the **rules** natively; skills and commands are
> available as documentation the agent can read, not as first-class features.
> Aider, Augment, and Claude Desktop ship marker-only bridges in projects —
> Aider needs a one-line `read:` entry in `.aider.conf.yml`; Augment and
> Claude Desktop are global-scope and pair with `--global`.

> **Team reproducibility (ADR-008):** every tool you `init` is also recorded in
> `agents/installed-tools.lock` — committed, machine-managed. New team members
> run `npx @event4u/agent-config sync` after cloning and every bridge in the
> table above is replayed locally. CI can gate drift with `agent-config validate`.
> Schema, workflow, and drift catalog:
> [`docs/guidelines/agent-infra/installed-tools-manifest.md`](docs/guidelines/agent-infra/installed-tools-manifest.md).

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

## User persona (`.agent-user.md`)

A project-root `.agent-user.md` file captures who the user is — name,
primary language, role, work style, and a single voice sample — so the
agent can address them correctly from the first turn. The file is
gitignored by default, paste-only, and contains zero PII beyond what the
user explicitly volunteers. Schema is locked v1 in
[`docs/contracts/agent-user-schema.md`](docs/contracts/agent-user-schema.md).

Create it interactively with `/agents user init`. Inspect with
`/agents user show`. Updates happen only through the explicit
`review` / `accept` / `update` flow — never silent auto-writes. The
legacy `personal.user_name` key in `.agent-settings.yml` stays as a
fallback when `.agent-user.md` is absent.

## Ghostwriter (`agents/ghostwriter/<slug>.md`)

Third voice primitive — captures **public-facing writing voice of
documented public figures** (authors, executives, academics,
journalists, public speakers, deceased historical figures).
`/ghostwriter:fetch <url-or-name>` runs an attestation gate, delegates
to the host agent's `web-fetch` / `web-search` (zero network code in
the package), and writes `agents/ghostwriter/<slug>.md` — **gitignored
by default**, never shipped in the OSS package. `/ghostwriter:write
--as=<slug>` drafts in that voice and appends the **mandatory
non-removable disclosure footer** (`*Written in the style of <name>,
not by them.*`); `/post-as:ghostwriter` is a thin alias. Private
individuals are rejected; paywalled / leaked / DM content banned at
the schema level. `:list`, `:show`, `:delete` round out the cluster.
Schema: [`docs/contracts/ghostwriter-schema.md`](docs/contracts/ghostwriter-schema.md).

| Primitive | Voice | Disclosure footer |
|---|---|---|
| `personas/*.md` | review-lens (internal critique) | n/a |
| `.agent-user.md` | maintainer's own voice (`/post-as:me`) | none — you are the author |
| `agents/ghostwriter/<slug>.md` | external public-figure (`/post-as:ghostwriter`) | mandatory, non-removable |

## Core Principles

- **Analyze before implementing** — no guessing, no blind edits
- **Verify with real execution** — no "should work"
- **Challenge to improve** — agents are thought partners, not yes-machines
- **Strict by design** — quality over flexibility
- **Zero overhead by default** — nothing runs until you ask for it
- **Terse-by-default chat output** — verbosity flags off, intent narration off,
  caveman-speak prose-only — flip back via [`docs/customization.md` § Verbosity](docs/customization.md#verbosity)

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

Local-only artefact-engagement log (`telemetry.artifact_engagement.enabled: true` in `.agent-settings.yml`) records which skills / rules / commands / guidelines the agent consults during `/implement-ticket` / `/work`. JSONL under the project root, nothing uploaded, nothing shared. Reports via `./agent-config telemetry:report`. Contract + privacy floor: [`contexts/contracts/artifact-engagement-flow.md`](.agent-src.uncompressed/contexts/contracts/artifact-engagement-flow.md) (beta).

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
[`command-suggestion-flow`](.agent-src.uncompressed/contexts/contracts/command-suggestion-flow.md) (beta).

---

## Development

Working on the package itself? Edit in `.agent-src.uncompressed/`,
then regenerate compressed and projected trees:

```bash
task sync             # regenerate .agent-src/ and .augment/
task generate-tools   # regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task ci               # full pipeline — green before PR
task test             # unit + integration tests
```

→ Full commands and project structure: [**docs/development.md**](docs/development.md)

## Requirements

- **Bash** — `scripts/install` orchestrates payload sync (`install.sh`) and bridges (`install.py`).
- **Python 3.10+** — bridge stage only; missing → orchestrator skips bridges.
- **Composer or npm** — to pull the package.
- **Platform:** macOS 12.3+, Linux, WSL2. Git Bash needs Developer Mode for symlinks; native PowerShell / cmd unsupported. Contributors rebuilding `.augment/` also need [Task](https://taskfile.dev/).

## License

[MIT](LICENSE).
