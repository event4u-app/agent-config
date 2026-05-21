# event4u/agent-config

> Shared skill / rule / command suite for AI coding tools. No application runtime. AGENTS.md of the **package itself**.

## Source of truth

Edit `packages/<pack>/.agent-src.uncompressed/` only (per-pack source; ADR-017). Generated trees (`.agent-src/`, `.augment/`, `.claude/`, `.cursor/`, `.clinerules/`, `.windsurfrules`) regenerate from `task sync` + `task generate-tools`; never hand-edit.

## Working on this repo

```bash
task sync              # regenerate .agent-src/, .augment/
task generate-tools    # regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task ci                # full pipeline — green before PR
```

## Pointers

- **Package self-orientation** (beta) — identity, four-wing cognition map, repo layout, tech stack, key-rules table, telemetry, command-suggester: [`docs/contracts/package-self-orientation.md`](docs/contracts/package-self-orientation.md).
- **Kernel + Router** (beta) — 9 always-loaded Iron-Law rules, tier-1 / tier-2 routing, cost profiles, per-rule char caps enforced by `task lint-rule-budget`: [`kernel-membership`](docs/contracts/kernel-membership.md) + [`rule-router`](docs/contracts/rule-router.md).
- **Content pipelines** — A→D source / Augment / multi-tool / Claude.ai-bundle projections, indexed at [`docs/architecture.md`](docs/architecture.md); sub-pipelines under [`docs/architecture/`](docs/architecture/).
- **Editing this repo** — Iron-Law rules (edit-discipline, source-of-truth, skill-quality) + Thin-Root contract govern every change here: [`augment-source-of-truth`](.agent-src/rules/augment-source-of-truth.md) + [`agents-md-thin-root`](.agent-src/skills/agents-md-thin-root/SKILL.md).
- **Consumer story** — `npx` + `scripts/install.sh` opt-in flags, sandbox / offline install paths, verified-offline manifest: [`README.md`](README.md).
- **Personas** — 11 review-lens cast (6 core · 5 specialist), `personas:` vs `/mode` axes, override pattern: [`docs/personas.md`](docs/personas.md) (beta).
- **Discovery** (workspaces / packs / `dist/discovery/discovery-manifest.json`) — contract [`ADR-013`](docs/decisions/ADR-013-discovery-frontmatter-contract.md), how-to [`customization § Workspaces & packs`](docs/customization.md#workspaces--packs-discovery).

## Emergency triage — read this when nothing else is reachable

1. **What is this repo?** — `event4u/agent-config`, a governed skill / rule / command suite for AI coding tools (no application runtime).
2. **What language?** — All `.md` content is English; agents mirror the user's language at runtime.
3. **Where do I edit?** — `packages/<pack>/.agent-src.uncompressed/` only. Never the generated trees.
4. **Lint / test / sync entry point?** — `task ci` (full pipeline). Subsets: `task sync`, `task generate-tools`, `task lint-skills`, `task test`.
5. **Where do the always-active rules live?** — `.agent-src/rules/` (kernel = 9 Iron-Law rules; tier-1 / tier-2 routed via `.agent-src/router.json`).


