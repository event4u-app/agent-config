# Architecture

## System overview

```
Rules → Behavior enforcement (always active)
Skills → Execution logic (on-demand expertise)
Runtime → Execution system (dispatcher, handlers, hooks)
Tools → External integrations (GitHub, Jira)
Observability → Signals & metrics
Feedback → Improvement loop
Lifecycle → Evolution & health
```

## Content pipeline

```
.augment.uncompressed/          ← Source of truth (verbose, human-readable)
    ↓ /compress command
.augment/                       ← Compressed output (token-efficient, agent-optimized)
    ↓ Plugin system (Augment CLI, Claude Code, Copilot CLI)
    ↓ install.sh (Cursor, Cline, Windsurf, Augment VSCode)
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

### 2. Execution Layer (Runtime)

Skills can optionally define execution metadata:

```yaml
execution:
  type: manual | assisted | automated
  handler: <runtime handler>
  allowed_tools: []
  timeout: 30
  safety_mode: strict
```

The runtime layer provides: skill execution registry, dispatcher, execution handlers, safety controls.

### 3. Tool Integration

Controlled integration via adapters:

- GitHub adapter (read-first: PRs, issues, files, commits)
- Jira adapter (read-first: tickets, search)
- Tool registry with safety rules for execution
- Structured responses with error classification

### 4. Observability

The system emits structured data (events, metrics, execution logs) persisted as:

- `metrics.json` — execution metrics
- `feedback.json` — outcome data
- `tool-audit.json` — tool adapter results
- Lifecycle reports and CI summaries

### 5. Feedback System

The system captures outcomes (success, failure, partial, blocked, timeout) and generates:
improvement suggestions, failure pattern detection, skill health insights.

### 6. Lifecycle Management

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

Skills follow the [Agent Skills open standard](https://agentskills.io).

---

← [Back to README](../README.md)
