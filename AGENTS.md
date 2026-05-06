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

`event4u/agent-config` is a **governed skill suite** for two cognition
clusters: engineering depth (Wing 1) and senior cross-department
cognition (Wings 2–4: Product + Foundation, GTM + Growth, Money +
Strategy + Ops). The differentiator is **depth over breadth, decisions
over boilerplate, under a shared Iron-Law floor** (`commit-policy`,
`non-destructive-by-default`, `language-and-tone`, `skill-quality`,
`direct-answers`). The same agent that ships a refactor commit also
runs DCF sensitivity, OKR-tree decomposition, and launch-funnel
diagnosis — under the same governance.

Mechanically the package is:

- A distribution package, not an application of any framework.
- `type: library` in `composer.json`; no `app/` directory, no application
  runtime (no Laravel, Symfony, Next.js, or other framework app code).
- Published to Composer and npm as `event4u/agent-config` / `@event4u/agent-config`.
- Installed into consumer projects via `scripts/install.sh` (Bash) and
  `scripts/install.py` (Python bridge).

## The four wings

The skill suite is organized as four wings under one Iron-Law floor.
Each wing has its own roadmap, its own personas, and its own plate;
they compose via the cross-wing handoff contract
([`docs/contracts/cross-wing-handoff.md`](docs/contracts/cross-wing-handoff.md) (beta),
landing in `road-to-suite-closure.md` Phase 3).

| Wing | Cognition cluster |
|---|---|
| **1 — Engineering** | Code craft, debugging, refactoring, release discipline; depth-first |
| **2 — Product + Foundation** | Roles cluster (PM, designer, QA, EM); product discovery, prioritization, delivery shape |
| **3 — GTM + Growth** | CMO + marketing + sales + lifecycle; channel-agnostic positioning + funnel cognition |
| **4 — Money + Strategy + Ops** | CFO + COO + board-level strategy, valuation, org-design; stage-agnostic financial + operational cognition |

Per-wing plates (roadmaps, persona maps, decision logs) live under
`agents/roadmaps/` and `agents/contexts/`. Roadmaps are transient
working layers — agents that need a wing's plate look it up by wing
number rather than by file path (per `no-roadmap-references`).

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

- **Bash** — install scripts, compression driver
- **Python 3.10+** — linters (`scripts/skill_linter.py`, `scripts/check_portability.py`,
  `scripts/check_references.py`, `scripts/readme_linter.py`), compression tooling,
  test suite (pytest)
- **Markdown** — all content (skills, rules, commands, guidelines, templates)
- **Taskfile** — developer entrypoints (`task ci`, `task sync`, `task test`)
- **GitHub Actions** — CI workflow under `.github/workflows/`

No application code or framework runtime (no Laravel / Symfony / Next.js /
Express). The `composer.json` / `package.json` are thin distribution
manifests.

**Cognition-only floor for Wings 2–4.** Wings 2, 3, and 4 enforce a
no-SaaS-auth, no-vendor-SDK, no-stage-prescription floor: cognition
artifacts (markdown tables, scoring rubrics, walkthroughs) must work
in any host without external dependencies. The structural-malice
check in `skill_linter.py` enforces this boundary mechanically (no
credential exfiltration, no remote execution, no shell injection in
subprocess calls — see `.agent-src.uncompressed/rules/skill-quality.md`
§ Structural Malice Floor).

## Working on this repo

```bash
task sync                  # .agent-src.uncompressed/ → .agent-src/, then project → .augment/
task generate-tools        # Regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task test                  # pytest tests/ + tests/test_install.sh
task lint-skills           # python3 scripts/skill_linter.py --all
task build-cloud-bundles-all  # ZIP every eligible skill → dist/cloud/ (Claude.ai Web / Skills API)
task ci                    # Full pipeline — must be green before PR
```

All checks must pass before a PR: sync-check, consistency, check-compression,
check-refs, check-portability, lint-skills, test, lint-readme.

## Maintainer telemetry (opt-in)

The artefact-engagement telemetry pipeline (`./agent-config telemetry:record`
and `./agent-config telemetry:report`) is **default-off**. Maintainers who
want to measure which skills/rules/commands the agent actually applies set
`telemetry.artifact_engagement.enabled: true` in `.agent-settings.yml`. The
log is local-only JSONL (no upload, no cross-project share) and is bound
by the redaction floor described in
[`docs/contracts/artifact-engagement-flow.md`](docs/contracts/artifact-engagement-flow.md) (beta).
The recording rule lives at
[`.agent-src/rules/artifact-engagement-recording.md`](.agent-src/rules/artifact-engagement-recording.md).

## Context-aware command suggestion

When a user's free-form prompt matches a command's purpose, the agent
surfaces matches as a numbered-options block with an always-present
"run the prompt as-is" escape. **Nothing auto-executes** — the user
picks every time. Engine: `scripts/command_suggester/`. Rule:
[`.agent-src/rules/command-suggestion-policy.md`](.agent-src/rules/command-suggestion-policy.md).
Locked eligibility table, scoring contract, and hardening list:
[`docs/contracts/adr-command-suggestion.md`](docs/contracts/adr-command-suggestion.md)
and
[`docs/contracts/command-suggestion-flow.md`](docs/contracts/command-suggestion-flow.md) (beta).

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

## Repository layout

```
.agent-src.uncompressed/      ← edit here
  skills/       (134 skills)
  rules/        (56 rules)
  commands/     (94 commands)
  personas/     (7 personas)
  templates/    (AGENTS.md, copilot-instructions.md, skill.md, …)
  contexts/

docs/guidelines/            (47 guidelines — reference material, not packaged)
.agent-src/                 ← compressed output shipped in the package
.augment/                   ← local projection for Augment Code (gitignored)
scripts/                    ← install.sh, install.py, compress.py, linters
tests/                      ← pytest (324 tests) + test_install.sh
agents/                     ← this package's own roadmaps / sessions / contexts
.github/workflows/          ← CI
```

## Multi-agent tool support

`task generate-tools` builds:

| Tool | Output | Strategy |
|---|---|---|
| Augment Code | `.augment/` | Native (source) |
| Claude Code | `.claude/rules/`, `.claude/skills/` | Symlinks + Agent Skills standard |
| Cursor | `.cursor/rules/` | Symlinks |
| Cline | `.clinerules/` | Symlinks |
| Windsurf | `.windsurfrules` | Concatenated file |
| Gemini CLI | `GEMINI.md` | Symlink → AGENTS.md |
| Claude.ai Web / Skills API | `dist/cloud/<skill>.zip` | `task build-cloud-bundles-all` (T3-H gated) |

Skills follow the [Agent Skills open standard](https://agentskills.io). Commands
are converted to Claude Code Skills with `disable-model-invocation: true`.
Cloud bundles enforce description budgets and prepend a sandbox note for
T2/T3-S skills — see [`docs/architecture.md`](docs/architecture.md#cloud-bundle-pipeline).

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
