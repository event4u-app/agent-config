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

- **Package self-orientation** (beta) — identity, four-wing cognition map, repo layout, tech stack, key-rules table, telemetry, command-suggester: [`docs/contracts/package-self-orientation.md`](docs/contracts/package-self-orientation.md).
- **Kernel + Router** (beta) — 9 always-loaded Iron-Law rules, tier-1 / tier-2 routing, cost profiles, per-rule char caps enforced by `task lint-rule-budget`: [`kernel-membership`](docs/contracts/kernel-membership.md) + [`rule-router`](docs/contracts/rule-router.md).
- **Content pipelines** — A [source projection](docs/architecture/source-projection.md), B [Augment projection](docs/architecture/augment-projection.md), C [multi-tool projection](docs/architecture/multi-tool-projection.md), D [Claude.ai bundle](docs/architecture/claude-bundle.md). Index: [`docs/architecture.md`](docs/architecture.md).
- **Editing this repo** — Iron-Law rules (portability, source-of-truth, skill-quality) + Thin-Root contract: [`augment-portability`](.agent-src/rules/augment-portability.md), [`augment-source-of-truth`](.agent-src/rules/augment-source-of-truth.md), [`skill-quality`](.agent-src/rules/skill-quality.md), [`agents-md-thin-root`](.agent-src/skills/agents-md-thin-root/SKILL.md).
- **Consumer story** — `npx` + `scripts/install.sh` + `.agent-settings.yml` opt-in flags, sandbox/offline install paths, verified-offline manifest: [`README.md`](README.md).
- **Personas** — 11 review-lens cast (6 core · 5 specialist), `personas:` vs `/mode` axes, citation map, override pattern: [`docs/personas.md`](docs/personas.md), schema [`docs/contracts/persona-schema.md`](docs/contracts/persona-schema.md) (beta).

## Emergency triage — read this when nothing else is reachable

1. **What is this repo?** — `event4u/agent-config`, a governed skill / rule / command suite for AI coding tools (no application runtime).
2. **What language?** — All `.md` content is English; agents mirror the user's language at runtime.
3. **Where do I edit?** — `.agent-src.uncompressed/` only. Never the generated trees.
4. **Lint / test / sync entry point?** — `task ci` (full pipeline). Subsets: `task sync`, `task generate-tools`, `task lint-skills`, `task test`.
5. **Where do the always-active rules live?** — `.agent-src/rules/` (kernel = 9 Iron-Law rules; tier-1 / tier-2 routed via `.agent-src/router.json`).


