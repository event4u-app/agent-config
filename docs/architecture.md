# Architecture

> **agent-config is not a runtime, but it ships a deterministic orchestration contract / state machine for host agents.**

## System overview

Six layers, ordered from "how the package reaches a consumer" down to "what a consumer's agent actually executes". Each layer names its canonical contract under [`docs/contracts/`](contracts/) — the overview is a router, not a re-statement.

```
Distribution         → npx-only runtime · install.sh · lockfile pin        ← stable
Governance           → Kernel rules · tier-1/2 routing · command clusters  ← stable
Router-Kernel        → router.json · always-loaded Iron Laws · char caps   ← stable
Projection           → Source · augment / multi-tool / cloud bundles       ← stable
Execution Contracts  → Skills · commands · work-engine · roadmap engine    ← stable / beta
MCP Lite/Full        → Hosted read-only (Lite) · local stdio (Full)        ← experimental
```

| Layer | Canonical contract | Tier |
|---|---|---|
| **Distribution** | [`installed-tools-lockfile.md`](contracts/installed-tools-lockfile.md) + the "Distribution model" subsection below | (beta) |
| **Governance** | [`command-clusters.md`](contracts/command-clusters.md) + [`command-surface-tiers.md`](contracts/command-surface-tiers.md) | (beta) |
| **Router-Kernel** | [`kernel-membership.md`](contracts/kernel-membership.md) + [`rule-router.md`](contracts/rule-router.md) | (beta) |
| **Projection** | [`architecture/source-projection.md`](architecture/source-projection.md), [`augment-projection.md`](architecture/augment-projection.md), [`multi-tool-projection.md`](architecture/multi-tool-projection.md), [`claude-bundle.md`](architecture/claude-bundle.md) | stable |
| **Execution Contracts** | [`implement-ticket-flow.md`](contracts/implement-ticket-flow.md), [`orchestration-dsl-v1.md`](contracts/orchestration-dsl-v1.md), [`adr-product-ui-track.md`](contracts/adr-product-ui-track.md) | stable (adr-product-ui-track) / (beta) (implement-ticket-flow · orchestration-dsl-v1) |
| **MCP Lite/Full** | `docs/contracts/mcp-phase-1-scope.md`, `docs/contracts/mcp-cloud-scope.md`, `docs/contracts/mcp-beta-criteria.md` | experimental — promotion to beta gated on `mcp-beta-criteria.md` (six artefact gates, monitored by `agent-config doctor --check mcp-beta-readiness`) |

Stability tiers follow [`docs/contracts/STABILITY.md`](contracts/STABILITY.md):

- **stable** = shipped, documented, exercised by the default (`minimal`) profile or by CI on every PR; SemVer-major for breaks.
- **beta** = shipped and load-bearing for one or more flows, but the surface is expected to evolve; minor-version breaks allowed under a `### Breaking` CHANGELOG note.
- **experimental** = scaffold or pilot status; breaks allowed in any release.

### What changed since 2.2.2

Four load-bearing additions reshaped the top of the model between 2.2.2 and the current release. They are listed here so the diagram above reads as the *current* package, not a historical accumulation:

1. **Router-Kernel** — the always-loaded Iron Laws collapsed into a 9-rule kernel with explicit per-rule character budgets enforced by `task lint-rule-budget`; everything else routes via tier-1/2 (`.agent-src/router.json`). Contract: [`kernel-membership.md`](contracts/kernel-membership.md) + [`rule-router.md`](contracts/rule-router.md) — both (beta).
2. **MCP Lite/Full** — replaces the old "Tool Adapters" layer at the top level. Lite is the hosted read-only surface (Claude.ai, Cloud agents); Full is the local stdio server consumers self-host. Promotion to beta is gated on six falsifiable artefacts in `docs/contracts/mcp-beta-criteria.md`; the old GitHub / Jira adapters remain as an internal detail of the Execution Contracts layer (see Tool Adapters subsection below).
3. **npx distribution** — Composer and `npm install` paths retired in favour of `npx @event4u/agent-config`, with the lockfile-equivalent role played by `agent_config_version` in `.agent-settings.yml`. Full rationale in the "Distribution model" subsection below.
4. **Command tiering** — `/`-commands now declare a `tier:` (0 / 1 / 2 / 3) that maps to invocation frequency and surface budget; tier-0 is the trimmed Tier-0 set surfaced in `agent-config --help` after the 2.7.x surface-discipline pass. Contract: [`command-surface-tiers.md`](contracts/command-surface-tiers.md) + [`command-clusters.md`](contracts/command-clusters.md) — both (beta).

> The previous "observability, feedback, lifecycle" layers were removed in
> 1.5 — they were scaffolds without production consumers. The "Tool
> Adapters" top-level layer was demoted in 2.7 — see point 2 above.

## Content pipelines

The end-to-end flow from source authoring to distributed surfaces
is four discrete pipelines, each owned by one sub-page. Each page
documents input → transform → output, invariants, failure modes,
and cites the script, Taskfile target, and test file that prove
the pipeline.

```
.agent-src.uncompressed/   ──Pipeline A──▶  .agent-src/
                                              │
                                              ├──Pipeline B──▶  .augment/
                                              │
                                              ├──Pipeline C──▶  .claude/ · .cursor/ · .clinerules/
                                              │                  .windsurfrules · GEMINI.md
                                              │
                                              └──Pipeline D──▶  dist/cloud/<skill>.zip
```

| Pipeline | Page | Output |
|---|---|---|
| **A.** Source projection | [`architecture/source-projection.md`](architecture/source-projection.md) | `.agent-src/` |
| **B.** Augment projection | [`architecture/augment-projection.md`](architecture/augment-projection.md) | `.augment/` |
| **C.** Multi-tool projection | [`architecture/multi-tool-projection.md`](architecture/multi-tool-projection.md) | `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`, `GEMINI.md` |
| **D.** Claude.ai bundle | [`architecture/claude-bundle.md`](architecture/claude-bundle.md) | `dist/cloud/<skill>.zip` |

The drift check
[`tests/test_architecture_docs_pipelines.py`](../tests/test_architecture_docs_pipelines.py)
fails if any of the four sub-pages exists without its cited script /
Taskfile target — or vice versa.

Cross-references inside `.agent-src/rules/*.md` are written
**relative to `.agent-src/rules/`** (e.g. `../contexts/execution/foo.md`,
`../docs/guidelines/agent-infra/foo.md`). Source files under
`.agent-src.uncompressed/rules/` use **logical names** without a
directory prefix (e.g. `contexts/execution/foo.md`); the
compress-time path rewriter in `scripts/compress.py` translates
them to the relative form when writing into `.agent-src/`. Hardcoding
`.agent-src.uncompressed/` in source frontmatter or body links is
forbidden and caught by `scripts/check_compressed_paths.py`.

### Distribution model — npx-only + version-pin governance

Starting with the road-to-portable-runtime cutover, the package ships
exclusively as a **runtime resolved by `npx @event4u/agent-config`**.
There is no Composer dependency, no `npm install` step, no `--global`
symlink scheme. Consumers run:

```bash
npx @event4u/agent-config init      # bootstrap a project
npx @event4u/agent-config <cmd>     # any subsequent command
```

**Why local installs are gone.** Vendoring the package into every
consumer's `vendor/` or `node_modules/` created three problems: stale
runtimes diverging from the published version, build-system coupling
(Composer post-install hooks, npm postinstall scripts), and a parallel
"global install" scheme that copied curated skills into `~/.claude/`,
`~/.cursor/`, `~/.codeium/windsurf/` under an `event4u/` namespace.
Maintenance cost was high, the abstractions leaked across surfaces, and
debugging "which version is loaded" was non-trivial. `npx` resolves the
runtime per invocation against a single npm registry source, which
collapses all three failure modes.

**How the pin replaces lockfile determinism.** A consumer-managed
`composer.lock` / `package-lock.json` previously froze the runtime
version per repo. Under npx-only, the equivalent role is played by the
`agent_config_version` field in the consumer's `.agent-settings.yml`
(see `config/agent-settings.template.yml`). The dispatcher reads the
pin on every invocation and re-execs `npx @event4u/agent-config@<pin>`
if the resolved version diverges (P3.2 pin-resolver). The pin lives in
the consumer's repo, is reviewed in PRs, and survives `npx`'s own
cache eviction.

**Q1 council rejection + override + pin as substitute.** During Q1
planning, the architecture council rejected the npx-only proposal on
the grounds that `npx` resolution introduces a "09:00 vs 09:15
release skew" window where two developers running the same command
minutes apart could see different runtimes. The user overrode the
rejection on the condition that an explicit version pin replaces
lockfile determinism — the council's concern is real, but the pin
collapses the skew window to whatever the project's PR cadence is.
Pin drift across developers becomes a reviewable config change in
`.agent-settings.yml` rather than an invisible registry-resolution
race. ADR-pending entry will record the trade-off in full once P3 is
green.

### Cloud-bundle pipeline

See [`architecture/claude-bundle.md`](architecture/claude-bundle.md)
for the full Pipeline D documentation — tier classification, sandbox
note, package-internal path-swap, description budget, and the
`task ci-cloud-bundle` dry-run gate.

## What's inside

| Layer | Count | Purpose |
|---|---|---|
| **Skills** | 210 | On-demand expertise — stack analysis (Laravel · Symfony · Zend / Laminas · Next.js · React · Node), testing, Docker, API design, security, observability, … |
| **Rules** | 67 | Always-active constraints — coding standards, scope control, verification, language-and-tone, agent-authority |
| **Commands** | 117 | Slash-command workflows — `/commit`, `/create-pr`, `/fix ci`, `/optimize skills`, `/feature plan`, `/work`, `/implement-ticket`, `/compress`, … |
| **Guidelines** | 72 | Reference material cited by skills — PHP patterns, Eloquent, Playwright, agent-infra, … |
| **Templates** | 7 | Scaffolds for features, roadmaps, contexts, skills, overrides |
| **Contexts** | 5 | Shared knowledge about the system itself |

---

## Execution-layer detail

> The six layers in the System overview are the top-level model. This section provides depth on the **Governance**, **Router-Kernel**, and **Execution Contracts** layers — the three a host agent interacts with on every turn. Distribution and Projection live in their own sub-pages ([`architecture/`](architecture/) and the "Distribution model" subsection above); MCP Lite/Full lives in [`docs/mcp-server.md`](mcp-server.md).

### 1. Governance Layer

- **Rules** → always-active behavior constraints
- **Skills** → structured, executable procedures
- **Guidelines** → reference-only documentation
- **Commands** → workflow orchestration

Ensures: no guessing, analysis before action, real verification, consistent outputs. Canonical contracts (all (beta)): [`kernel-membership.md`](contracts/kernel-membership.md), [`rule-router.md`](contracts/rule-router.md), [`command-clusters.md`](contracts/command-clusters.md), [`command-surface-tiers.md`](contracts/command-surface-tiers.md).

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

### 4. Tool Adapters — experimental (internal detail; superseded at the top level by MCP)

> **Position in the new model.** Tool Adapters no longer occupy a top-level layer — that slot is now **MCP Lite/Full**. The adapter classes still ship as the internal mechanism the Work Engine uses for inline GitHub/Jira reads, but external integration is meant to land via MCP going forward. See `docs/contracts/mcp-phase-1-scope.md`, `docs/contracts/mcp-cloud-scope.md`, and `docs/contracts/mcp-beta-criteria.md` for the surface that replaces this layer at the top level.

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

## Path resolution and Copilot integration

Cross-references inside `.augment/rules/`, `.augment/skills/`, and the
mirrored `.claude/`, `.cursor/`, `.clinerules/` trees use **relative
paths from the delivered location**. They resolve through the symlinks
created by `scripts/install.sh`, not via raw git checkout. This means
GitHub Copilot's static checker — which walks the git tree — will see
broken paths where there are none. **The gap is intentional, not a bug.**

The package ships **one** Copilot instruction artefact:

| File | Read by | Purpose |
|---|---|---|
| `.github/copilot-instructions.md` | Copilot Chat + PR review | Repo-wide coding standards plus the path-resolution suppression floor (Known False Positives) |

Per [GitHub's documented convention](https://docs.github.com/en/copilot/reference/custom-instructions-support),
Copilot Code Review reads `.github/copilot-instructions.md`
repository-wide and `.github/instructions/**/*.instructions.md` for
path-specific rules — there is no separate "review-only" instruction
file. The first 4000 characters are the budget; keep
high-priority rules (Scope Control, Known False Positives) up top.

Installed (copy-if-missing) by `scripts/install.sh` from
`.agent-src.uncompressed/templates/`. Consumers can edit it freely;
the installer never overwrites.

The mechanical floor is `scripts/check_compressed_paths.py`, wired into
`task ci` as `check-compressed-paths`. It validates `.agent-src/rules/*.md`:

- `load_context:` entries must resolve to existing files.
- Forbidden substrings (`.agent-src.uncompressed/`, `../../docs/`,
  `../../agents/`) must not survive compression — unless declared
  per-rule via the `validator_ignore:` frontmatter primitive (audited).
- Body links to `../docs/guidelines/...` are intentionally **not**
  checked (they are package-internal reference material, silenced by
  the Copilot suppression floor above).

### Verifying path fixes in a consumer

If a regression is suspected, replay the smoke test against the
package's own `.augment/` projection:

```bash
task sync                              # regenerate .agent-src/ → .augment/
python3 scripts/smoke_path_resolution.py
```

The script walks `.augment/rules/*.md` and resolves every
`load_context:` entry to a file under `.augment/`. A non-zero exit
means a consumer would also see the same broken reference.

---

← [Back to README](../README.md)
