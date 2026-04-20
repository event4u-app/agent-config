# Architecture

## System overview

```
Rules         → Behavior enforcement (always active)         ← stable
Skills        → Execution logic (on-demand expertise)        ← stable
Runtime       → Shell handler (real) · others (scaffold)     ← partial
Tools         → External integrations (GitHub, Jira)         ← experimental
Opt-in layers → Observability, feedback, lifecycle           ← experimental
```

**Stable** = shipped, documented, exercised by the default (`minimal`) profile.
**Experimental** = scaffold with tests and data model, but no real execution
wired up yet. These layers activate only under the `balanced` / `full`
profiles and they are explicit about being no-ops today.

The opt-in layers (observability, feedback, lifecycle) are described in a
separate document so the core architecture stays short. See
[`docs/observability.md`](observability.md). If you have not opted in, you can
safely ignore them.

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

### 2. Execution Layer (Runtime) — partially real, partially scaffold

> **Status:**
> - **Real:** shell-handler path — skills that declare an `execution.command`
>   argv are dispatched and executed by `scripts/runtime_handler.py`. A typed
>   `ExecutionResult` (exit code, stdout, stderr, duration, artifacts) is
>   returned. Pilots: `lint-skills`, `check-refs`.
> - **Scaffold:** `php` and `node` handlers, pipeline, hooks, error taxonomy,
>   tool registry — data model and tests exist, no real wiring yet.

Skills opt into runtime by declaring execution metadata:

```yaml
execution:
  type: manual | assisted | automated
  handler: shell | php | node | internal | none
  command:                       # required for shell/php/node runtime paths
    - python3
    - scripts/skill_linter.py
    - "--all"
  timeout_seconds: 120
  allowed_tools: []
  safety_mode: strict            # required for type=automated
```

Invoke a runtime-capable skill end-to-end:

```bash
python3 scripts/runtime_dispatcher.py run --skill lint-skills
```

The dispatcher resolves the skill, enforces safety constraints, then hands
off to the matching handler. Environment is scrubbed to an explicit
allowlist; `subprocess.run` is invoked with `shell=False` (argv only).

Planned scope (still to come): `php` / `node` handlers, tool-registry wiring
for `allowed_tools`, streaming output, richer artifact capture.

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

### 4. Observability, feedback & lifecycle — experimental, opt-in

The system has three further layers for measuring agent behavior, capturing
outcomes, and tracking skill lifecycle. All three are **off by default**
(`cost_profile: minimal`), none inject data back into agent context
automatically, and most consumers of this package never need to enable them.

→ Details, data model, and current scaffold status:
[`docs/observability.md`](observability.md).

### 5. Cost Control

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
