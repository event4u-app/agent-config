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

## Install-ABI deprecation window

The on-disk **install layout** — the paths the installer writes, the JSON-pointer keys it claims in
shared host configs, the surgical-uninstall pointer schema, and the lockfile shapes — is a versioned
contract: [`docs/contracts/install-layout.md`](docs/contracts/install-layout.md), stamped as
`install_layout_version` into `~/.event4u/agent-config/installed.lock`. A change to that shape is **not**
an automatic Major. It follows a deprecation window instead:

1. **Side-by-side for one minor cycle.** A layout change bumps `install_layout_version` and ships the
   **old + new shape together** for at least one minor release. The installer keeps writing/reading the
   old shape during the window so an existing install never breaks mid-cycle.
2. **In-place migration.** When the installer detects an installed tree at `install_layout_version <
   current` (absent = pre-freeze v0), it migrates the on-disk shape in place — idempotently, preserving
   surgical-uninstall pointers — and surfaces what it changed.
3. **Drop only after the window.** The old shape is removed only after the migration has shipped for a
   full minor cycle. That removal is the breaking step and gets a `### Breaking` CHANGELOG entry; the
   intermediate side-by-side release does not.

The conformance test (`tests/test_install_layout_contract.py`) fails CI on any layout-shape change that
is **not** paired with an `install_layout_version` bump, so the window cannot be skipped silently.

This is why an install-layout change no longer needs to trip a Major on its own: the version stamp +
migration path turn it into a deprecation-gated minor change. The cadence note below predates that rule
and describes the historical reason majors were frequent.

## Breaking changes by major

| Version | Date | What broke | Migration |
|---|---|---|---|
| **16.0.0** | 2026-09-12 | The standing-payload ratchet stores no ceiling: `grace_ceiling`, `grace_measured_at` and the raise-history key left `ci_delivery` in `src/config/preamble-payload-budget.json`, and `stored_ceiling` left the bound set, the ceiling formula, the `boundBy` union and the `Budget` type. The bound is now computed per run as `max(design_ceiling, min(base, watermark) + active grant)` ([`0b20000`](https://github.com/event4u-app/agent-config/commit/0b20000d48801fe4e0661660da610e1372642f7d)). | No consumer action — the keys are this repository's own CI config, not an installed surface. See [CHANGELOG 16.0.0](docs/archive/CHANGELOG-pre-16.1.0.md) and [MIGRATION § 16.0.0](docs/MIGRATION.md). |
| **15.0.0** | 2026-09-10 | `/chat-history` and `/chat-history import` are retired — both command files are gone, recorded as an authorized capability loss ([`8b5226a`](https://github.com/event4u-app/agent-config/commit/8b5226aff24d93f8a5fecfa7525b9419d58524af)). The runtime writer, the hook concern and the `.agent-chat-history` file are untouched. The release also lists a second BREAKING entry retiring the kernel-rule deny and the 24 h soak ([`288190b`](https://github.com/event4u-app/agent-config/commit/288190b1a5a09a964cf4cc29fa356791bbfb8069)) — **that did not ship**: [`03e4eb7d`](https://github.com/event4u-app/agent-config/commit/03e4eb7de6b8c637cf41bbe60acb489b3a6658af) reverted it inside the same release after a ratification review refused it. | Use `/agent-handoff` for session handoff; the chat-history record is still written and is read manually. Nothing to do for the second entry — there is no migration for a removal that never shipped. See [CHANGELOG 15.0.0](docs/archive/CHANGELOG-pre-16.0.0.md) and [MIGRATION § 15.0.0](docs/MIGRATION.md). |
| **14.0.0** | 2026-08-18 | Council quorum plumbing extracted out of `council_cli.ts` into `ai_council/quorum_wiring.ts`; `QuorumSetting`, `absentReasonFromCliFailure`, `appendQuorumEvent`, `QuorumAbsence` and `QuorumEventPhase` moved with it ([`f001382`](https://github.com/event4u-app/agent-config/commit/f0013821e005888f781e54a43a9bd3d260e74f76)). | No consumer action — every moved symbol is package-internal and none is reachable from an installed tree. Import from `ai_council/quorum_wiring.ts` if you vendored one. See [CHANGELOG 14.0.0](docs/archive/CHANGELOG-pre-14.3.0.md). |
| **13.0.0** | 2026-08-17 | The council's budget-routing decision layer and permit lifecycle are archived: `pickTier`, `acquireBudgetPermit`, `settlePermit`, `tripCooldown`, `reserveTtlMs`, `BudgetRoutingSwitch`, `TierBudgetState`, the reserve/lock machinery and the reserve-lifecycle config no longer exist, and `budget.mjs tier` lost its `reserved_usd` term ([`43d4e1b`](https://github.com/event4u-app/agent-config/commit/43d4e1b2a83c25611e8d90c3ed28b5de13f09e29)). `pickTier` required a `routing_switch` whose only source, `subagents.budget_routing`, had already been deleted by always-on orchestration. | No consumer action — zero production callers, and `session_tier` was non-null in 0 of 327 orchestration records ([`docs/contracts/budget-routing.md`](docs/contracts/budget-routing.md), the retirement record). `TIER_ORDER` and `readCooldowns` survive for `routing_doctor`, which reports the cool-down state as "unavailable, no producer" rather than reading an all-zero map as measured. See [CHANGELOG 13.0.0](docs/archive/CHANGELOG-pre-14.0.0.md). |
| **12.0.0** | 2026-08-15 | Two removals of a published field. `dist/discovery/discovery-manifest.json` is **v3** and its command artefacts carry no `tier` ([`3b4210f`](https://github.com/event4u-app/agent-config/commit/3b4210f8b07419b4b5c9a14287946782a559065c)); command frontmatter no longer carries the `tier:` alias for `visibility:` ([`90ad47a`](https://github.com/event4u-app/agent-config/commit/90ad47ad5204c7c77116cb6a1a99dcbc5274d33c)). | Read `visibility:` instead of `tier`. The mapping is frozen and lossless — `visible`→0, `advanced`→1, `internal`→2 — so a consumer needing the integer derives it. A manifest consumer pinned to v2 updates its version check; the v2 deprecations entry is retained with `removed_in: 3` so the pointer survives for the reader arriving after the key is gone. See [CHANGELOG 12.0.0](docs/archive/CHANGELOG-pre-14.0.0.md). |
| **11.0.0** | 2026-08-13 | Settings key `worktrees.mode` is deleted — worktree creation is instruction-only and was never the agent's decision to configure ([`9e4cc35`](https://github.com/event4u-app/agent-config/commit/9e4cc35513a69b9e107b639ff9dc78622d42b09e)). Removed from the template, the zod schema, the class contract, the generated reference, the settings-wizard basic paths and the personal-settings table. | Automatic: a leftover `worktrees.mode` is accepted and ignored with one deprecation line via `REMOVED_KEYS`, whose reason names what decides instead. Delete the key at your convenience. See [CHANGELOG 11.0.0](docs/archive/CHANGELOG-pre-12.0.0.md). |
| **10.0.0** | 2026-08-12 | Council transport is resolved per machine, not configured: `defaults.mode` and the per-member `mode:` key are no longer read, and `api_key_ref` stops being conditionally required ([`4eda4ff`](https://github.com/event4u-app/agent-config/commit/4eda4ff0f518cb30778dc139852576efd35bd57a)). Every installation that had ever run the setup wizard carried `mode: api` and kept paying per token with a subscription CLI on the same machine. | Automatic: a config carrying either key still loads — the key is ignored and reported in `CouncilConfig.ignored_transport_keys`, and `council status` names the keys so they can be deleted. Rejecting them would have turned every existing installation into a hard load failure, so the migration IS the ignore. `manual` stays reachable per invocation via `--mode-override`. See [CHANGELOG 10.0.0](docs/archive/CHANGELOG-pre-10.3.0.md). |
| **9.0.0** | 2026-07-13 | Consumer rule projection is scoped by default: `projection.rule_workspaces` now ships filled, so 16 maintainer-only specification rules are no longer projected (103 → 88 rules) ([`road-to-request-scoped-rule-load` Phase 1](CHANGELOG.md)). Kernel rules and all domain safety floors still ship. | Rollback: set `projection.rule_workspaces: []` (= legacy-all). Existing installs are unchanged until you run `agent-config sync` / re-install; the first session after opting in rebuilds the KV-cache prefix once. See [CHANGELOG 9.0.0](CHANGELOG.md). |
| **8.0.0** | 2026-07-07 | Router `balanced` discipline profile retired (measured dead); `essential` replaces it ([ADR-110](docs/decisions/ADR-110-discipline-profile-resolution-locus.md)). Any `.agent-settings.yml` pinning `discipline_profile: balanced` no longer resolves. | Switch `discipline_profile: balanced` to `essential`. See [CHANGELOG 8.0.0](docs/archive/CHANGELOG-pre-8.1.0.md). |
| **7.0.0** | 2026-06-21 | Ticket export removed: `build_ticket_export.py` (and its API-export path) is gone; ticket handoff moves to paste + MCP ([ADR-102](docs/decisions/ADR-102-ticket-handoff-paste-and-mcp.md)). Consumers that shelled out to that script have no drop-in replacement. | Use the paste / MCP ticket-handoff flow instead of the removed export script. See [CHANGELOG 7.0.0](docs/archive/CHANGELOG-7.0.0.md). |
| **6.0.0** | 2026-06-12 | Condensed output tree relocated: `.agent-src/` (repo root) → `dist/agent-src/` ([ADR-058](docs/decisions/ADR-058-condensed-output-relocation-to-dist.md)). Any consumer script or tool config that hard-codes `.agent-src/...` paths (plugin-marketplace clones, custom symlinks) breaks. | Replace `.agent-src/` with `dist/agent-src/` in any hard-coded path; regenerated projections (`task sync` / `task generate-tools` in this repo, `agent-config install` in consumers) pick up the new location automatically. |
| **6.0.0** | 2026-06-12 | Settings key `cost_profile` renamed to `rule_loading_tier` (rule-tier loading footprint). A second, colliding meaning the same key carried — the `🧠 Memory` visibility-line cadence (`lean`/`standard`/`verbose`) — moved to its own `memory.cadence` key (`auto`/`always`/`never`). | Automatic: existing `.agent-settings.yml` files migrate on the next `agent-config install` / `setup`; legacy `cost_profile` is read as a fallback during the grace period, so nothing breaks before migration. No manual action required. |
| **5.0.0** | 2026-05-29 | `migrate` command: legacy `migrate-state` + `migrate-to-global` subcommands removed, folded into one opinionated `migrate`. | Use `agent-config migrate` (no subcommand). See [CHANGELOG 5.0.0](CHANGELOG.md). |
| **4.0.0** | 2026-05-26 | Unified-setup **hard cut**: the standalone TypeScript installer workspace (`packages/core/installer/`) and the `/install-via-agent` command are retired; `agent-config install` / `setup` now boots a single Fastify process driving plan+apply through `src/install/`. The Python `scripts/install.py` is kept one release for the `curl \| bash` fallback only. | First `install` run detects a v3 tree and renders a backup screen — pick "Backup v3 and proceed" (copies to `~/.event4u/agent-config.v3.bak/`). Rollback = `mv ~/.event4u/agent-config.v3.bak ~/.event4u/agent-config`. See [CHANGELOG § Breaking — v4.0.0](CHANGELOG.md#breaking--v400-unified-setup-road-to-unified-setup). |
| **3.0.0** | 2026-05-21 | Wizard: legacy `/onboard` chat skill and its skill-bridge IPC removed — the browser wizard is the sole onboarding surface. | Run `agent-config setup` (browser wizard) instead of the chat-side `/onboard`. See [CHANGELOG 3.0.0](docs/archive/CHANGELOG-pre-3.1.0.md). |
| **2.0.0** | 2026-05-12 | Install: composer + npm `postinstall` hooks dropped — distribution is `npx`-only. | Install via `npx @event4u/agent-config` (no composer/postinstall step). See [CHANGELOG 2.0.0](docs/archive/CHANGELOG-pre-2.2.0.md). |
| **1.0.0** | 2026-04-14 | Initial public release — no prior consumer-facing break. | — |

> Entries reconstructed from `CHANGELOG.md` and the era archives under `docs/archive/`. Patch and minor
> releases never break consumers by policy; only the rows above did. For everything else, the
> [CHANGELOG](CHANGELOG.md) is the source of truth.
