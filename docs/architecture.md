# Architecture

## System overview

```
Rules         → Behavior enforcement (always active)         ← stable
Skills        → Execution logic (on-demand expertise)        ← stable
Runtime       → Execution system (dispatcher, hooks)         ← experimental
Tools         → External integrations (GitHub, Jira)         ← experimental
Observability → Signals & metrics                            ← experimental
Feedback      → Improvement loop                             ← experimental
Lifecycle     → Evolution & health                           ← experimental
```

**Stable** = shipped, documented, exercised by the default (`minimal`) profile.
**Experimental** = scaffold with tests and data model, but no real execution
wired up yet. These layers activate only under the `balanced` / `full`
profiles and they are explicit about being no-ops today.

## Content pipeline

```
.agent-src.uncompressed/          ← Source of truth (verbose, human-readable)
    ↓ /compress command
.agent-src/                     ← Compressed output (token-efficient, shipped in the package)
    ↓ project_to_augment() — copies rules, symlinks rest
.augment/                       ← Local projection for Augment Code (gitignored)
    ↓ install.sh (Cursor, Cline, Windsurf, Augment VSCode) / plugin system
.claude/ .cursor/ .clinerules/  ← Tool-specific symlinks/copies (auto-generated)
.windsurfrules  GEMINI.md
```

## What's inside

| Layer | Count | Purpose |
|---|---|---|
| **Skills** | 93 | On-demand expertise — Laravel, testing, Docker, API design, security, ... |
| **Rules** | 31 | Always-active constraints — coding standards, scope control, verification |
| **Commands** | 51 | Slash-command workflows — `/commit`, `/create-pr`, `/fix-ci`, `/compress`, ... |
| **Guidelines** | 34 | Coding guidelines by language — PHP patterns, Eloquent, Playwright, ... |
| **Templates** | 7 | Scaffolds for features, roadmaps, contexts, skills, overrides |
| **Contexts** | 5 | Shared knowledge about the system itself |

---

## Layers

### 1. Governance Layer

- **Rules** → always-active behavior constraints
- **Skills** → structured, executable procedures
- **Guidelines** → reference-only documentation
- **Commands** → workflow orchestration

Ensures: no guessing, analysis before action, real verification, consistent outputs.

### 2. Execution Layer (Runtime) — experimental

> **Status: scaffold.** Registry, dispatcher, pipeline, hooks and an error
> taxonomy exist and have tests, but no real execution happens yet. See
> `scripts/runtime_dispatcher.py` — its module docstring states
> *"No real execution happens — this is a scaffold for future phases."*

Skills can optionally define execution metadata:

```yaml
execution:
  type: manual | assisted | automated
  handler: <runtime handler>
  allowed_tools: []
  timeout: 30
  safety_mode: strict
```

Planned scope: skill execution registry, dispatcher, execution handlers,
safety controls.

### 3. Tool Integration — experimental

> **Status: scaffold + read-only GitHub calls.** With a `GITHUB_TOKEN` the
> GitHub adapter performs real read calls; without one it returns scaffold
> data. Write operations (`create_pr`, `comment`, etc.) are scaffold only.
> The Jira adapter is scaffold throughout.

Controlled integration via adapters:

- GitHub adapter (read-first: PRs, issues, files, commits)
- Jira adapter (read-first: tickets, search)
- Tool registry with safety rules for execution
- Structured responses with error classification

### 4. Observability — experimental

The system emits structured data (events, metrics, execution logs) persisted as:

- `metrics.json` — execution metrics
- `feedback.json` — outcome data
- `tool-audit.json` — tool adapter results
- Lifecycle reports and CI summaries

### 5. Feedback System — experimental

> **Status: data model + collector, no auto-consumption.** Feedback is
> persisted to local JSON but never injected into agent context
> automatically; see [`agents/docs/feedback-consumption.md`](../agents/docs/feedback-consumption.md).

The system captures outcomes (success, failure, partial, blocked, timeout) and generates:
improvement suggestions, failure pattern detection, skill health insights.

### 6. Lifecycle Management — experimental

> **Status: tracking + scoring, no enforcement.** Lifecycle state is
> recorded and reported but does not block or gate skill usage.

Each skill has a lifecycle (active → deprecated → superseded) with:
health scoring, migration suggestions, and lifecycle reports.

### 7. Cost Control

> **Key principle:** Data collection ≠ automatic usage.

Metrics, reports, and feedback are collected and persisted but **NOT automatically injected
into agent context**. All features are gated by settings with `cost_profile` support
(`minimal`, `balanced`, `full`, `custom`).

---

## Supported AI Tools

| Tool | Rules | Skills | Commands | Plugin | Method |
|---|---|---|---|---|---|
| **Augment CLI** | ✅ | ✅ | ✅ | ✅ | Native plugin (recommended) |
| **Augment VSCode/IntelliJ** | ✅ | ✅ | ✅ | — | install.sh (copies + symlinks) |
| **Claude Code** | ✅ | ✅ | ✅ | ✅ | Native plugin (recommended) |
| **Copilot CLI** | ✅ | ✅ | ✅ | ✅ | Native plugin (recommended) |
| **Cursor** | ✅ | — | — | — | install.sh (symlinks) |
| **Cline** | ✅ | — | — | — | install.sh (symlinks) |
| **Windsurf** | ✅ | — | — | — | install.sh (concatenated) |
| **Gemini CLI** | ✅ | — | — | — | install.sh (symlink → AGENTS.md) |

Skills use a `SKILL.md` format with YAML frontmatter, compatible with the
[Agent Skills](https://agentskills.io) community spec and with Claude Code's
Agent Skills specification.

---

← [Back to README](../README.md)
