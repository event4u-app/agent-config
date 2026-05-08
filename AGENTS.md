# event4u/agent-config

> **agent-config is not a runtime, but it ships a deterministic orchestration contract / state machine for host agents.**

**Shared agent configuration** — skills, rules, commands, guidelines, and templates
for AI coding tools (Augment Code, Claude Code, Cursor, Cline, Windsurf, Gemini CLI,
GitHub Copilot).

This file is the AGENTS.md **of the package itself**. It gives an agent that is
working **on this repository** (adding skills, fixing the installer, improving
the linter) the context it needs. Consumer projects get their own AGENTS.md
generated from [`.augment/templates/AGENTS.md`](.agent-src/templates/AGENTS.md)
when they install the package.

## What this repo is

A **governed skill suite** for two cognition clusters: engineering
depth (Wing 1) and senior cross-department cognition (Wings 2–4).
**Depth over breadth, decisions over boilerplate, under a shared
Iron-Law floor** (`commit-policy`, `non-destructive-by-default`,
`language-and-tone`, `skill-quality`, `direct-answers`).

`type: library` distribution package — published to Composer and npm
as `event4u/agent-config` / `@event4u/agent-config`. No application
runtime. Installed via `scripts/install.sh` (Bash) and
`scripts/install.py` (Python bridge). Distribution mechanics:
[`agents/contexts/agents-md-tech-stack.md`](agents/contexts/agents-md-tech-stack.md).

## The four wings

Four wings compose via [`docs/contracts/cross-wing-handoff.md`](docs/contracts/cross-wing-handoff.md) (beta).
Per-wing plates live under `agents/roadmaps/` and `agents/contexts/`.

| Wing | Cognition cluster |
|---|---|
| **1 — Engineering** | Code craft, debugging, refactoring, release discipline; depth-first |
| **2 — Product + Foundation** | Roles cluster (PM, designer, QA, EM); product discovery, prioritization, delivery shape |
| **3 — GTM + Growth** | CMO + marketing + sales + lifecycle; channel-agnostic positioning + funnel cognition |
| **4 — Money + Strategy + Ops** | CFO + COO + board-level strategy, valuation, org-design; stage-agnostic financial + operational cognition |

## Source of truth

| Directory | Purpose | Editable? |
|---|---|---|
| `.agent-src.uncompressed/` | Authoring layer — full verbose content | ✅ Yes — edit here |
| `.agent-src/` | Compressed output — shipped in the package, consumed by agents | ❌ No — regenerated |
| `.augment/` | Local projection of `.agent-src/` for Augment Code (gitignored) | ❌ No — regenerated |
| `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` | Tool-specific projections | ❌ No — regenerated |
| `agents/` | Package's own roadmaps, contexts, sessions | ✅ Yes |

**Never edit `.agent-src/` or `.augment/` directly.** Edit `.agent-src.uncompressed/`
and run `task sync` (or `task ci`) to compress + regenerate the tool directories.

## Tech stack of this package

Bash (install scripts) · Python 3.10+ (linters, compression, pytest) ·
Markdown (all content) · Taskfile (`task ci/sync/test`) · GitHub
Actions (`.github/workflows/`). Non-text inputs (PDF, DOCX, XLSX,
images, audio) route through [`markitdown`](.agent-src/skills/markitdown/SKILL.md).
Wings 2–4 enforce a cognition-only floor (no SaaS auth, no vendor
SDKs) — `skill_linter.py` enforces it mechanically. Deep detail:
[`agents/contexts/agents-md-tech-stack.md`](agents/contexts/agents-md-tech-stack.md).

## Working on this repo

```bash
task sync              # regenerate .agent-src/, .augment/
task generate-tools    # regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task test              # pytest + test_install.sh
task lint-skills       # skill_linter.py --all
task ci                # full pipeline — must be green before PR
```

PR-blocking checks: sync-check, consistency, check-compression, check-refs,
check-portability, lint-skills, test, lint-readme.

## Maintainer telemetry (opt-in)

Default-off. `telemetry.artifact_engagement.enabled: true` in
`.agent-settings.yml` enables local-only JSONL logging. Redaction floor
+ pipeline: [`contexts/contracts/artifact-engagement-flow.md`](.agent-src.uncompressed/contexts/contracts/artifact-engagement-flow.md) (beta).
Rule: [`.agent-src/rules/artifact-engagement-recording.md`](.agent-src/rules/artifact-engagement-recording.md).

## Context-aware command suggestion

When a free-form prompt matches a command's purpose, the agent surfaces
matches as numbered options with a "run as-is" escape; **nothing
auto-executes**. Engine: `scripts/command_suggester/`. Rule:
[`.agent-src/rules/command-suggestion-policy.md`](.agent-src/rules/command-suggestion-policy.md).
Eligibility + scoring + hardening: [`docs/contracts/adr-command-suggestion.md`](docs/contracts/adr-command-suggestion.md)
and [`contexts/contracts/command-suggestion-flow.md`](.agent-src.uncompressed/contexts/contracts/command-suggestion-flow.md) (beta).

## Key rules for agents editing this repo

| Rule | File |
|---|---|
| `.agent-src/` must stay project-agnostic — no project names, domains, stacks | [`augment-portability`](.agent-src/rules/augment-portability.md) |
| Root AGENTS.md + copilot-instructions.md must stay project-agnostic too | [`augment-portability`](.agent-src/rules/augment-portability.md) |
| Edit `.agent-src.uncompressed/`, never `.agent-src/` or `.augment/` | [`augment-source-of-truth`](.agent-src/rules/augment-source-of-truth.md) |
| Skills must declare frontmatter, be self-contained, pass the linter | [`skill-quality`](.agent-src/rules/skill-quality.md) |
| Size budgets for skills, rules, commands | [`size-enforcement`](.agent-src/rules/size-enforcement.md) |
| Keep `.agent-src/` / `agents/` cross-refs in sync on add/rename/delete | [`docs-sync`](.agent-src/rules/docs-sync.md) |
| Creating a new skill/rule/command/guideline runs Understand → Research → Draft | [`artifact-drafting-protocol`](.agent-src/rules/artifact-drafting-protocol.md) |

## Kernel + Router

The rule set runs on a **Kernel + Router** model (locked 2026-05-06,
see [`docs/decisions/ADR-rule-kernel-and-router.md`](docs/decisions/ADR-rule-kernel-and-router.md)):

- **Kernel** = 9 always-loaded Iron-Law rules, ≤ 26k chars
  (`agent-authority`, `ask-when-uncertain`, `commit-policy`,
  `direct-answers`, `language-and-tone`, `no-cheap-questions`,
  `non-destructive-by-default`, `scope-control`, `verify-before-complete`).
  Locked set: [`docs/contracts/kernel-membership.md`](docs/contracts/kernel-membership.md) (beta).
- **Router** = frontmatter `tier:` + `triggers:` + `routes_to:` keys
  on every rule. `scripts/compile_router.py` builds `router.json`
  deterministically. Contract: [`docs/contracts/rule-router.md`](docs/contracts/rule-router.md) (beta).
- **Cost profiles** gate which tiers load:
  `minimal` = kernel only · `balanced` = kernel + tier-1 (default) ·
  `full` = kernel + tier-1 + tier-2.

Hard caps enforced by `task lint-rule-budget`: kernel-bucket ≤ 26k chars,
per-rule ≤ 2.5k chars (Iron-Law overrides up to 4.0k via ADR in
[`docs/decisions/`](docs/decisions/) and
[`docs/contracts/iron-law-overrides.txt`](docs/contracts/iron-law-overrides.txt)).
Daily snapshots: `python3 scripts/measure_rule_budget.py --trend-append`
appends to `agents/.rule-budget-history.jsonl`.

## Repository layout

```
.agent-src.uncompressed/      ← edit here
  skills/       (141 skills)
  rules/        (58 rules)
  commands/     (103 commands)
  personas/     (7 personas)
  templates/    (AGENTS.md, copilot-instructions.md, skill.md, …)
  contexts/

docs/guidelines/            (47 guidelines — reference material, not packaged)
docs/contracts/             (kernel-membership, rule-router, rule-classification, …)
docs/decisions/             (ADRs — kernel overrides, scope decisions)
.agent-src/                 ← compressed output shipped in the package
.agent-src/router.json      ← compiled router manifest (consumed at runtime)
.augment/                   ← local projection for Augment Code (gitignored)
scripts/                    ← install.sh, install.py, compress.py, linters
tests/                      ← pytest (324 tests) + test_install.sh
agents/                     ← this package's own roadmaps / sessions / contexts
.github/workflows/          ← CI
```

## Multi-agent tool support

`task generate-tools` projects `.agent-src/` into Augment Code, Claude
Code (Agent Skills standard), Cursor, Cline, Windsurf, Gemini CLI, and
Claude.ai cloud bundles. Skills follow [agentskills.io](https://agentskills.io);
commands are converted to Claude Code Skills with `disable-model-invocation: true`.
Per-tool layout + cloud-bundle pipeline: [`docs/architecture.md`](docs/architecture.md#cloud-bundle-pipeline).

## Contributing

1. Edit inside `.agent-src.uncompressed/` or `scripts/` or `tests/` — never in
   `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, etc.
2. Run `task ci` locally. It must exit 0.
3. Commit in logical chunks with Conventional Commits.
4. Open a PR against `main`.

See [`README.md`](README.md) for the user-facing story, and
[`docs/architecture.md`](docs/architecture.md) for the package architecture.

## License

[MIT](LICENSE).
