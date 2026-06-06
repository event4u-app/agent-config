---
stability: beta
keep-beta-until: 2026-08-12
---

# Package Self-Orientation

> **Beta.** Outboard target for the package-root `AGENTS.md` Thin-Root
> refactor (Phase 6.4 of `road-to-augment-limit-fit`). Holds the
> deep-detail prose that used to live inline.

## What this repo is

A **governed skill suite** for two cognition clusters — engineering
depth (Wing 1) and senior cross-department cognition (Wings 2–4).
**Depth over breadth, decisions over boilerplate, under a shared
Iron-Law floor** (`commit-policy`, `non-destructive-by-default`,
`language-and-tone`, `skill-quality`, `direct-answers`).

`type: library` distribution package — published to Composer and npm
as `event4u/agent-config` / `@event4u/agent-config`. No application
runtime. Installed via `scripts/install.sh` (Bash) and
`scripts/install.py` (Python bridge).

## The four wings

Four wings compose via [`cross-wing-handoff.md`](cross-wing-handoff.md)
(beta). Per-wing plates live under `agents/roadmaps/` and `agents/settings/contexts/`.

| Wing | Cognition cluster |
|---|---|
| **1 — Engineering** | Code craft, debugging, refactoring, release discipline; depth-first |
| **2 — Product + Foundation** | Roles cluster (PM, designer, QA, EM); product discovery, prioritization, delivery shape |
| **3 — GTM + Growth** | CMO + marketing + sales + lifecycle; channel-agnostic positioning + funnel cognition |
| **4 — Money + Strategy + Ops** | CFO + COO + board-level strategy, valuation, org-design; stage-agnostic financial + operational cognition |

## Tech stack

Bash (install scripts) · Python 3.10+ (linters, condensation, pytest) ·
Markdown (all content) · Taskfile (`task ci/sync/test`) · GitHub
Actions (`.github/workflows/`). Non-text inputs (PDF, DOCX, XLSX,
images, audio) route through the
[`markitdown`](../../dist/agent-src/skills/markitdown/SKILL.md) skill.
Wings 2–4 enforce a cognition-only floor (no SaaS auth, no vendor
SDKs) — `skill_linter.py` enforces it mechanically. Distribution
mechanics deep-dive: [`agents-md-tech-stack.md`](agents-md-tech-stack.md) (beta).

## Source of truth

| Directory | Purpose | Editable? |
|---|---|---|
| `.agent-src.uncondensed/` | Authoring layer — full verbose content | ✅ Yes — edit here |
| `dist/agent-src/` | Condensed output — shipped in the package, consumed by agents | ❌ No — regenerated |
| `.augment/` | Local projection of `dist/agent-src/` for Augment Code (gitignored) | ❌ No — regenerated |
| `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules` | Tool-specific projections | ❌ No — regenerated |
| `agents/` | Package's own roadmaps, contexts, sessions | ✅ Yes |

**Never edit `dist/agent-src/` or `.augment/` directly.** Edit
`.agent-src.uncondensed/` and run `task sync` (or `task ci`) to
condense + regenerate the tool directories.

## Repository layout

```
.agent-src.uncondensed/      ← edit here
  skills/       (150 skills)
  rules/        (58 rules)
  commands/     (103 commands)
  personas/     (7 personas)
  templates/    (AGENTS.md, copilot-instructions.md, skill.md, …)
  contexts/

docs/guidelines/            (47 guidelines — reference material, not packaged)
docs/contracts/             (kernel-membership, rule-router, rule-classification, …)
docs/decisions/             (ADRs — kernel overrides, scope decisions)
dist/agent-src/                 ← condensed output shipped in the package
dist/agent-src/router.json      ← compiled router manifest (consumed at runtime)
.augment/                   ← local projection for Augment Code (gitignored)
scripts/                    ← install.sh, install.py, condense.py, linters
tests/                      ← pytest (324 tests) + test_install.sh
agents/                     ← this package's own roadmaps / sessions / contexts
.github/workflows/          ← CI
```

## Key rules for agents editing this repo

| Rule | File |
|---|---|
| `dist/agent-src/` must stay project-agnostic — no project names, domains, stacks | [`augment-portability`](../../dist/agent-src/rules/augment-portability.md) |
| Root AGENTS.md + copilot-instructions.md must stay project-agnostic too | [`augment-portability`](../../dist/agent-src/rules/augment-portability.md) |
| Edit `.agent-src.uncondensed/`, never `dist/agent-src/` or `.augment/` | [`augment-source-of-truth`](../../dist/agent-src/rules/augment-source-of-truth.md) |
| Skills must declare frontmatter, be self-contained, pass the linter | [`skill-quality`](../../dist/agent-src/rules/skill-quality.md) |
| Size budgets for skills, rules, commands | [`size-enforcement`](../../dist/agent-src/rules/size-enforcement.md) |
| Keep `dist/agent-src/` / `agents/` cross-refs in sync on add/rename/delete | [`docs-sync`](../../dist/agent-src/rules/docs-sync.md) |
| Creating a new skill/rule/command/guideline runs Understand → Research → Draft | [`artifact-drafting-protocol`](../../dist/agent-src/rules/artifact-drafting-protocol.md) |

## Maintainer telemetry (opt-in)

Default-off. `telemetry.artifact_engagement.enabled: true` in
`.agent-settings.yml` enables local-only JSONL logging. Redaction
floor + pipeline:
[`artifact-engagement-flow.md`](../../.agent-src.uncondensed/contexts/contracts/artifact-engagement-flow.md)
(beta). Rule:
[`artifact-engagement-recording`](../../dist/agent-src/rules/artifact-engagement-recording.md).

## Context-aware command suggestion

When a free-form prompt matches a command's purpose, the agent
surfaces matches as numbered options with a "run as-is" escape;
**nothing auto-executes**. Engine: `scripts/command_suggester/`.
Rule: [`command-suggestion-policy`](../../dist/agent-src/rules/command-suggestion-policy.md).
Eligibility + scoring + hardening:
[`adr-command-suggestion.md`](adr-command-suggestion.md) and
[`command-suggestion-flow.md`](../../.agent-src.uncondensed/contexts/contracts/command-suggestion-flow.md)
(beta).

## Multi-agent tool support

`task generate-tools` projects `dist/agent-src/` into Augment Code, Claude
Code (Agent Skills standard), Cursor, Cline, Windsurf, Gemini CLI,
and Claude.ai cloud bundles. Skills follow
[agentskills.io](https://agentskills.io); commands are converted to
Claude Code Skills with `disable-model-invocation: true`. Per-tool
layout + cloud-bundle pipeline:
[`docs/architecture.md`](../architecture.md#cloud-bundle-pipeline).

## Contributing

1. Edit inside `.agent-src.uncondensed/` or `scripts/` or `tests/` —
   never in `dist/agent-src/`, `.augment/`, `.claude/`, `.cursor/`, etc.
2. Run `task ci` locally. It must exit 0.
3. Commit in logical chunks with Conventional Commits.
4. Open a PR against `main`.

User-facing story: [`README.md`](../../README.md). Architecture
deep-dive: [`docs/architecture.md`](../architecture.md).
