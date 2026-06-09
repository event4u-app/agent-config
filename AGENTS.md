# event4u/agent-config

> Shared skill / rule / command suite for AI coding tools. No app runtime. AGENTS.md of the **package itself**.

## Source of truth

Edit `src/` only (`src/skills`, `src/rules`, `src/agent-src/`). Generated trees regenerate from `task sync` + `task generate-tools`; never hand-edit.

## Working on this repo

```bash
task sync              # regenerate dist/agent-src/, .augment/
task generate-tools    # regenerate .claude/, .cursor/, .clinerules/, .windsurfrules
task ci                # full pipeline — green before PR
# maintainer: AGENT_CONFIG_DEV_MODE=1 opens --scope=project (docs/maintainers/dev-mode.md)
```

## Pointers

- **Self-orientation** — identity / map / stack: [`package-self-orientation`](docs/contracts/package-self-orientation.md).
- **Kernel + Router** — 9 Iron-Law rules + tier-1/2 routing: [`kernel-membership`](docs/contracts/kernel-membership.md) + [`rule-router`](docs/contracts/rule-router.md).
- **Trust & Safety** — trust-level enum, HRR banner, safety floors: [`trust-and-safety`](docs/contracts/trust-and-safety.md) + [`ADR-018`](docs/decisions/ADR-018-trust-and-safety-layer.md).
- **Content pipelines** — A→D source / Augment / multi-tool / Claude.ai-bundle: [`docs/architecture.md`](docs/architecture.md).
- **Editing this repo** — Iron-Law rules + Thin-Root contract: [`source-of-truth`](src/rules/source-of-truth.md) + [`agents-md-thin-root`](src/skills/agents-md-thin-root/SKILL.md).
- **Consumer story** — `npx` + `scripts/install.sh`, sandbox / offline paths: [`README.md`](README.md).
- **Personas** — 11 review lenses (6 + 5): [`docs/personas.md`](docs/personas.md).
- **Discovery** — workspaces / packs manifest: [`ADR-013`](docs/decisions/ADR-013-discovery-frontmatter-contract.md) + [`customization`](docs/customization.md#workspaces--packs-discovery).
- **Root layout** — `src/` = source; root keeps workspace tooling per [`ADR-050`](docs/decisions/ADR-050-workspace-vs-package-root-boundary.md); toggle: `agents/.agent-tools.yml`.

## Emergency triage — read this when nothing else is reachable

1. **What is this repo?** — `event4u/agent-config`, a governed skill / rule / command suite for AI coding tools (no app runtime).
2. **What language?** — All `.md` is English; agents mirror the user's language at runtime.
3. **Where do I edit?** — `src/` only. Never the generated trees.
4. **Lint / test / sync entry point?** — `task ci` (full pipeline). Subsets: `task sync`, `task generate-tools`, `task lint-skills`, `task test`.
5. **Where do the always-active rules live?** — `dist/agent-src/rules/` (kernel = 9 Iron-Law rules; tier-1 / 2 via `dist/router.json`).
6. **CI checks?** — `task ci:required-checks` previews per [`branch-protection-policy.md`](docs/contracts/branch-protection-policy.md); merge floor [`ci-green-floor.md`](docs/contracts/ci-green-floor.md); release [`release-pr-gating.md`](docs/contracts/release-pr-gating.md).
