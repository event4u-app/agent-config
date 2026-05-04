# Architecture

> **agent-config is not a runtime, but it ships a deterministic orchestration contract / state machine for host agents.**

## System overview

```
Rules               → Behavior enforcement (always active)              ← stable
Skills              → Execution logic (on-demand expertise)             ← stable
Runtime Dispatcher  → Single-skill shell execution (pilot skills)       ← stable (mechanism)
Work Engine         → Multi-step orchestration for /work + /implement   ← beta
Tool Adapters       → External integrations (GitHub, Jira)              ← experimental
```

Stability tiers follow [`docs/contracts/STABILITY.md`](contracts/STABILITY.md):

- **stable** = shipped, documented, exercised by the default (`minimal`) profile or by CI on every PR; SemVer-major for breaks.
- **beta** = shipped and load-bearing for one or more flows, but the surface is expected to evolve; minor-version breaks allowed under a `### Breaking` CHANGELOG note.
- **experimental** = scaffold or pilot status; breaks allowed in any release.

> The previous "observability, feedback, lifecycle" layers were removed in
> 1.5 — they were scaffolds without production consumers.

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
    ↓ scripts/build_cloud_bundle.py    (Phase 1 — cloud distribution)
dist/cloud/<skill>.zip          ← Anthropic Skills bundles (Claude.ai Web / Skills API)
```

### Cloud-bundle pipeline

`task build-cloud-bundles-all` produces one ZIP per skill at
`dist/cloud/<skill>.zip`, ready for upload to Claude.ai Web (Settings →
Customize → Skills) or the Anthropic Skills API. Per-skill behavior
follows the cloud-tier classification from `scripts/audit_cloud_compatibility.py`:

| Tier  | Bundle action                                                     |
|-------|-------------------------------------------------------------------|
| T1    | Bundle as-is — pure guidance, sandbox-safe                        |
| T2    | Bundle with prepended sandbox note + package-internal path-swap   |
| T3-S  | Same as T2; optional script calls degrade gracefully on cloud     |
| T3-H  | **Skipped** — Phase 2 cloud-aware variant required before bundling |

Cloud-side caps enforced by the builder: `description` ≤ 200 chars
(Claude.ai Web) with a 1024-char hard cap (Anthropic spec). The sandbox
note explains to the agent that `.agent-src/`, `agents/`, and `task …`
references are descriptive — the host has no filesystem access.

CI gate: `task ci-cloud-bundle` runs the builder in `--check` mode and
fails on any source-side violation, without producing artifacts.

## What's inside

| Layer | Count | Purpose |
|---|---|---|
| **Skills** | 129 | On-demand expertise — stack analysis (Laravel · Symfony · Zend / Laminas · Next.js · React · Node), testing, Docker, API design, security, observability, … |
| **Rules** | 58 | Always-active constraints — coding standards, scope control, verification, language-and-tone, agent-authority |
| **Commands** | 95 | Slash-command workflows — `/commit`, `/create-pr`, `/fix ci`, `/optimize skills`, `/feature plan`, `/work`, `/implement-ticket`, `/compress`, … |
| **Guidelines** | 51 | Reference material cited by skills — PHP patterns, Eloquent, Playwright, agent-infra, … |
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

### 2. Runtime Dispatcher — stable mechanism, pilot coverage

> **Scope:** single-skill execution. Resolves a `SKILL.md` with
> `execution.command` argv, enforces safety constraints, hands off to
> the matching handler. **Not** a multi-step orchestrator — that is
> the Work Engine (next section).

> **Status:**
> - **Stable mechanism:** the dispatcher itself
>   (`scripts/runtime_dispatcher.py`), the shell handler
>   (`scripts/runtime_handler.py`), and the `ExecutionResult` shape.
>   `subprocess.run` is invoked with `shell=False` (argv only); the
>   environment is scrubbed to an explicit allowlist.
> - **Pilot coverage:** two skills ship as live pilots —
>   `lint-skills` and `check-refs` — both run on every PR and appear
>   in the GitHub Step Summary via `scripts/ci_summary.py`.
> - **Scaffold:** `php` and `node` handlers — the frontmatter accepts
>   them and the registry validates them, but no handler
>   implementation exists yet.

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

A typed `ExecutionResult` (exit code, stdout, stderr, duration,
artifacts) is returned and can be persisted as JSON via
`--output FILE`.

Planned scope: `php` / `node` handlers, tool-registry wiring for
`allowed_tools`, streaming output.

### 3. Work Engine — beta, multi-step orchestration

> **Scope:** multi-step phase dispatch for `/work` and
> `/implement-ticket`. Drives the
> `refine → score → plan → implement → test → verify → report` loop,
> persists state in `.work-state.json`, and routes UI-shaped work
> through the product UI track. Lives at
> [`templates/scripts/work_engine/`](../.agent-src.uncompressed/templates/scripts/work_engine/);
> shipped to consumer projects via `scripts/install.py`.

> **Status: beta.** The contract (directive sets, halt budgets,
> envelope shape) has shipped one full SemVer-minor cycle, but the
> surface is still expected to evolve. Breaks are allowed in
> minor-version releases under a `### Breaking` CHANGELOG note. See
> [`docs/contracts/STABILITY.md`](contracts/STABILITY.md).

Key responsibilities:

- **Directive routing** — `ui` / `ui-trivial` / `mixed` directive
  sets, locked into the contract at
  [`adr-product-ui-track.md`](contracts/adr-product-ui-track.md) (beta).
- **Halt protocol** — every phase emits a structured halt; the
  agent re-enters with the user's answer, never improvises.
- **State machine** — `.work-state.json` is the single source of
  truth across resumes; the engine refuses to switch envelope
  mid-flight. Legacy `.implement-ticket-state.json` files are
  detected on load and routed through
  [`docs/MIGRATION.md`](MIGRATION.md).
- **Hooks** — chat-history, telemetry, and platform hooks fire
  through the engine's hook layer.

The Work Engine **uses** the Runtime Dispatcher when a phase needs
to execute a single skill (e.g. lint, refs check), but the two are
independent components with separate stability tiers.

### 4. Tool Adapters — experimental

> **Status: scaffold + read-only GitHub calls.** With a `GITHUB_TOKEN` the
> GitHub adapter performs real read calls; without one it returns scaffold
> data. Write operations (`create_pr`, `comment`, etc.) are scaffold only.
> The Jira adapter is scaffold throughout.

Controlled integration via adapters:

- GitHub adapter (read-first: PRs, issues, files, commits)
- Jira adapter (read-first: tickets, search)
- Tool registry with safety rules for execution
- Structured responses with error classification

### 5. Cost Control

> **Key principle:** Opt-in by default.

The Runtime Dispatcher and Tool Adapters activate only under the
`balanced` or `full` profile. The Work Engine activates whenever
`/work` or `/implement-ticket` is invoked and is independent of the
cost profile. The default `minimal` profile ships rules, skills, and
commands and nothing else. All settings and their profile defaults
are documented in
[`.agent-src.uncompressed/templates/agent-settings.md`](../.agent-src.uncompressed/templates/agent-settings.md).

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
| **Claude.ai Web / Skills API** | — | ✅ | — | — | `task build-cloud-bundles-all` → `dist/cloud/<skill>.zip` |

Skills use a `SKILL.md` format with YAML frontmatter, compatible with the
[Agent Skills](https://agentskills.io) community spec and with Claude Code's
Agent Skills specification. Cloud bundles produced by
`scripts/build_cloud_bundle.py` follow the same format with cloud-side
adjustments (description budget, sandbox note, package-internal path-swap).

---

← [Back to README](../README.md)
