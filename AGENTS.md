# event4u/agent-config

> Shared skill / rule / command suite for AI coding tools. No application runtime. AGENTS.md of the **package itself**.

## Source of truth

Edit `.agent-src.uncompressed/` only. Generated trees (`.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`) regenerate from `task sync` + `task generate-tools`; never hand-edit.

## Working on this repo

```bash
task sync              # regenerate .agent-src/, .augment/
task generate-tools    # regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task ci                # full pipeline — green before PR
```

## Pointers

- **Package self-orientation** — identity, four-wing cognition map, repo layout, tech stack, key-rules table, telemetry, command-suggester: [`docs/contracts/package-self-orientation.md`](docs/contracts/package-self-orientation.md).
- **Kernel + Router** — 9 always-loaded Iron-Law rules, tier-1 / tier-2 routing, cost profiles, per-rule char caps enforced by `task lint-rule-budget`: [`kernel-membership`](docs/contracts/kernel-membership.md) + [`rule-router`](docs/contracts/rule-router.md).
- **Multi-tool projection** — Augment, Claude Code, Cursor, Cline, Windsurf, Gemini CLI, Claude.ai bundle pipeline that ships from `.agent-src/` to consumer surfaces: [`docs/architecture.md`](docs/architecture.md#cloud-bundle-pipeline).
- **Editing this repo** — Iron-Law rules (portability, source-of-truth, skill-quality) and the Thin-Root contract (caps · pointer-ratio · triage block) governing AGENTS.md: [`augment-portability`](.agent-src/rules/augment-portability.md), [`augment-source-of-truth`](.agent-src/rules/augment-source-of-truth.md), [`skill-quality`](.agent-src/rules/skill-quality.md), [`agents-md-thin-root`](.agent-src/skills/agents-md-thin-root/SKILL.md).
- **Consumer story + architecture deep-dive** — what the package does for installers and how it ships: [`README.md`](README.md), [`docs/architecture.md`](docs/architecture.md).

## Emergency triage — read this when nothing else is reachable

1. **What is this repo?** — `event4u/agent-config`, a governed skill / rule / command suite for AI coding tools (no application runtime).
2. **What language?** — All `.md` content is English; agents mirror the user's language at runtime.
3. **Where do I edit?** — `.agent-src.uncompressed/` only. Never `.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`.
4. **Lint / test / sync entry point?** — `task ci` (full pipeline). Subsets: `task sync`, `task generate-tools`, `task lint-skills`, `task test`.
5. **Where do the always-active rules live?** — `.agent-src/rules/` (kernel = 9 Iron-Law rules; tier-1 / tier-2 routed via `.agent-src/router.json`).


