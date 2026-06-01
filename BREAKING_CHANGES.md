# Breaking Changes

Reverse-chronological list of consumer-facing breaking changes, one per major (`X.0.0`).
This file is a discoverable index, not the policy. The canonical sources are:

- Versioning policy → [`CONTRIBUTING.md` § Versioning](CONTRIBUTING.md#versioning-policy)
- Breaking-change classification → [`docs/contracts/CHANGELOG-conventions.md`](docs/contracts/CHANGELOG-conventions.md)
- Full per-release notes → [`CHANGELOG.md`](CHANGELOG.md) (+ era archives under [`docs/archive/`](docs/archive/))

## Why majors are frequent

`agent-config` is a single-maintainer package under active development, and its **install layout and
settings keys are part of its public contract**. Under the existing semver policy, an installer-path or
settings-key change legitimately trips a Major even when the day-to-day skill/rule surface is stable — so
the cadence reflects an actively-evolving install/runtime surface, not instability in the content you use.
Each major below names what actually broke; majors with no consumer-facing break say so plainly.

## Breaking changes by major

| Version | Date | What broke | Migration |
|---|---|---|---|
| **Next major** *(unreleased)* | — | Settings key `cost_profile` renamed to `rule_loading_tier` (rule-tier loading footprint). A second, colliding meaning the same key carried — the `🧠 Memory` visibility-line cadence (`lean`/`standard`/`verbose`) — moved to its own `memory.cadence` key (`auto`/`always`/`never`). | Automatic: existing `.agent-settings.yml` files migrate on the next `agent-config install` / `setup`; legacy `cost_profile` is read as a fallback during the grace period, so nothing breaks before migration. No manual action required. |
| **5.0.0** | 2026-05-29 | `migrate` command: legacy `migrate-state` + `migrate-to-global` subcommands removed, folded into one opinionated `migrate`. | Use `agent-config migrate` (no subcommand). See [CHANGELOG 5.0.0](CHANGELOG.md). |
| **4.0.0** | 2026-05-26 | Unified-setup **hard cut**: the standalone TypeScript installer workspace (`packages/core/installer/`) and the `/install-via-agent` command are retired; `agent-config install` / `setup` now boots a single Fastify process driving plan+apply through `src/install/`. The Python `scripts/install.py` is kept one release for the `curl \| bash` fallback only. | First `install` run detects a v3 tree and renders a backup screen — pick "Backup v3 and proceed" (copies to `~/.event4u/agent-config.v3.bak/`). Rollback = `mv ~/.event4u/agent-config.v3.bak ~/.event4u/agent-config`. See [CHANGELOG § Breaking — v4.0.0](CHANGELOG.md#breaking--v400-unified-setup-road-to-unified-setup). |
| **3.0.0** | 2026-05-21 | Wizard: legacy `/onboard` chat skill and its skill-bridge IPC removed — the browser wizard is the sole onboarding surface. | Run `agent-config setup` (browser wizard) instead of the chat-side `/onboard`. See [CHANGELOG 3.0.0](docs/archive/CHANGELOG-pre-3.1.0.md). |
| **2.0.0** | 2026-05-12 | Install: composer + npm `postinstall` hooks dropped — distribution is `npx`-only. | Install via `npx @event4u/agent-config` (no composer/postinstall step). See [CHANGELOG 2.0.0](docs/archive/CHANGELOG-pre-2.2.0.md). |
| **1.0.0** | 2026-04-14 | Initial public release — no prior consumer-facing break. | — |

> Entries reconstructed from `CHANGELOG.md` and the era archives under `docs/archive/`. Patch and minor
> releases never break consumers by policy; only the rows above did. For everything else, the
> [CHANGELOG](CHANGELOG.md) is the source of truth.
