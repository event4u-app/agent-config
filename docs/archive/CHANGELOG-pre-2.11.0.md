# Changelog Archive — pre-2.11.0

> Frozen snapshot of `event4u/agent-config` changelog entries from
> `2.10.0` and earlier (back to `2.7.0`), split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-15 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 2.11.x".
> Entries here are not amended — git tags `2.10.0` and prior remain the
> canonical source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md) and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [2.10.0](https://github.com/event4u-app/agent-config/compare/2.9.0...2.10.0) (2026-05-14)

### Features

* **ci:** lint-hook-concern-budget Tier-1 fail-closed gate ([8d60b8a](https://github.com/event4u-app/agent-config/commit/8d60b8ab464c4c5bdc6d072bb2a9b0123942e13b))
* **cli:** settings:check command + YAML subset contract ([638e740](https://github.com/event4u-app/agent-config/commit/638e74017ffea8d7c08073a949e86fde047db109))
* **hooks:** hooks:doctor + hooks:replay subcommands + fixture corpus ([3156e25](https://github.com/event4u-app/agent-config/commit/3156e25fd3253fc926a57b92e14b407a9ed54b58))
* **work-engine:** add decision-trace memory_visibility hook + scoring ([bf056ac](https://github.com/event4u-app/agent-config/commit/bf056ace877a696afa5fe758053ea1eb350e5dff))

### Bug Fixes

* **roadmap:** point productization P6 gate at archived proof-not-features path ([35a1009](https://github.com/event4u-app/agent-config/commit/35a1009cffdfde28c7b0384c890c31a7e62b70cf))

### Documentation

* **roadmap:** complete road-to-proof-not-features 16/16 + sync dashboard ([89af72d](https://github.com/event4u-app/agent-config/commit/89af72d5514b74c19d533b5a2e69ff7ddf16ecbc))
* **readme:** split README by audience + audience-order contract ([60a87c0](https://github.com/event4u-app/agent-config/commit/60a87c056555a80585d25555f3d5b87d54c7283a))

### Refactoring

* **check-council-references:** structural carve-outs for immutable inputs and decision provenance ([3ed7784](https://github.com/event4u-app/agent-config/commit/3ed77841c42c5e3ebf4191611bb7fa4a52ed2fa0))

### Chores

* **roadmap:** archive road-to-proof-not-features (16/16 done, Phase 1 deferred) ([9d05aed](https://github.com/event4u-app/agent-config/commit/9d05aed79a46023b1e95c5488a1e3d5e78748e67))

Tests: 3663 (+60 since 2.9.0)

## [2.9.0](https://github.com/event4u-app/agent-config/compare/2.8.0...2.9.0) (2026-05-13)

### Features

* tier-usage telemetry settings + report template ([22172f2](https://github.com/event4u-app/agent-config/commit/22172f2a59b530034633ff72226506006c5fd81b))
* mcp beta-readiness criteria with pending gate tests ([3653788](https://github.com/event4u-app/agent-config/commit/36537880e03546e9baf424b2fdd70aa69d41eb03))
* expand doctor diagnostic hub to 10 checks ([372c193](https://github.com/event4u-app/agent-config/commit/372c19362f8037c76f919a2d918780ae5ec9cb40))
* **roadmap:** add road-to-surface-discipline (council-reviewed) ([d9da987](https://github.com/event4u-app/agent-config/commit/d9da9870989ccdb7594cd693e9b18608b957ab79))
* **linter:** wing-4 cognition-boundary checks + spine slot vocab ([c4d9a4b](https://github.com/event4u-app/agent-config/commit/c4d9a4ba8e5c7184b9be0a58d4d8b220a60cab7c))

### Bug Fixes

* **skills:** clear missing_inspect_step + bare_noun warnings ([0c88c6e](https://github.com/event4u-app/agent-config/commit/0c88c6ee45873e47fd8c7d356ec82b28b63b12c5))
* **docs:** drop roadmap-file pointers from wing-4 ADRs and handoff ([ccd7624](https://github.com/event4u-app/agent-config/commit/ccd7624127094d0a01eda0901fa41c31319f7bc5))
* **template:** bump agent_config_version pin to 2.8.0 ([f21e916](https://github.com/event4u-app/agent-config/commit/f21e916c6bb793fa6efe7d264a1e069e11ab4c62))
* **skills:** spine slot citations + finance-partner polish ([9072783](https://github.com/event4u-app/agent-config/commit/90727831b223bd970d8425d158940bf3e3bc104f))

### Documentation

* archive surface-discipline roadmap + 2.8.0 changelog ([551e306](https://github.com/event4u-app/agent-config/commit/551e306e43fa82fffda9178bdaa690b19d8bec4e))
* 6-layer architecture refresh + thin-root sync ([91d25a8](https://github.com/event4u-app/agent-config/commit/91d25a80b37fb1c1782c2d5f00f23925ba6ec1b3))
* **roadmap:** complete road-to-money-strategy-ops phase 1 ([83cf9fe](https://github.com/event4u-app/agent-config/commit/83cf9fe99c034b71e146099eddc9ce5b3137f434))
* **contracts:** register wing-4 spine slots + marketplace entries ([75b829d](https://github.com/event4u-app/agent-config/commit/75b829d162bc18ab3dc2dda6614d15a087a4f32a))

### Refactoring

* trim tier-0 surface from 13 to 7 commands ([a9eafd1](https://github.com/event4u-app/agent-config/commit/a9eafd1c5226c10209e3dee2b972f38d9c0f3dd9))

### Chores

* **generated:** regenerate derived outputs for wing-4 additions ([54f3779](https://github.com/event4u-app/agent-config/commit/54f3779a6d2161ed06bfb327c3e416ec107b4016))

Tests: 3603 (+26 since 2.8.0)

## [2.8.0](https://github.com/event4u-app/agent-config/compare/2.7.0...2.8.0) (2026-05-13)

### Features

* **linter:** wing-scoped persona line budgets ([81c8cda](https://github.com/event4u-app/agent-config/commit/81c8cdaf08f243a61f848b2e53fad73305ec173d))
* **personas:** GTM roadmap I1-I4 — Wing-3 personas (CMO, RevOps, CS, Growth-PM) ([a05d49e](https://github.com/event4u-app/agent-config/commit/a05d49e1fd2076effd68dabce7a0789676b2bbf5))
* **skills:** GTM roadmap H8-H16 — RevOps, CS, Growth-PM clusters ([f79e7a1](https://github.com/event4u-app/agent-config/commit/f79e7a11f5447466c05c6be613a618b9c564a4b1))
* **gtm:** H3–H7 — complete CMO cluster skills (gtm-launch, editorial-calendar, content-funnel-design, voice-and-tone-design, fundraising-narrative) ([a905bea](https://github.com/event4u-app/agent-config/commit/a905bea811a02d973a682465525ca39d274d3342))
* **gtm:** H1+H2 — positioning + messaging-architecture senior skills ([00aeb27](https://github.com/event4u-app/agent-config/commit/00aeb279be9924c01dea998df7ee91442fd3ff88))
* **gtm:** G3 — Wing-3 handoff guideline + Block G closed ([15643da](https://github.com/event4u-app/agent-config/commit/15643da3e2e96a6b00a738e8f4b7ba10edd18187))
* **gtm:** G2 — Wing-3 cognition-boundary linter ([8445921](https://github.com/event4u-app/agent-config/commit/84459218a914dd5d39c524824e9e0a597c28daec))
* **gtm:** G1 — extend context-spine with Wing-3 slots ([853e653](https://github.com/event4u-app/agent-config/commit/853e6538fff24429ab0f4136f5eec5d4b992dda4))

### Bug Fixes

* **refs:** drop roadmap-file citations from GTM ADR + handoff guideline ([092a01d](https://github.com/event4u-app/agent-config/commit/092a01d7bcd6b51c85d12bfcf83dc973b35c0fcc))
* **contracts:** add stability frontmatter to command-surface-tiers.md ([3ab2ffd](https://github.com/event4u-app/agent-config/commit/3ab2ffde4345b4ca30cc4d64926f571bce5ce7dd))
* **lint:** teach context-spine linter the Wing-3 GTM slots ([5bf81d5](https://github.com/event4u-app/agent-config/commit/5bf81d51864b652301d890eafb0574641d05b71a))
* **refs:** replace dangling skill backticks with plain phrasing in GTM skills ([9f20b06](https://github.com/event4u-app/agent-config/commit/9f20b0612b58f8ef0273bfbe5f830793f4dca131))
* **template:** bump agent_config_version to 2.7.0 in agent-project-settings template ([ac65734](https://github.com/event4u-app/agent-config/commit/ac657343a81879c3aee4664728e15233863016a5))

### Refactoring

* **skill:** rename positioning → positioning-strategy ([be1a5c9](https://github.com/event4u-app/agent-config/commit/be1a5c9019ac18fabde14469784db42aa7588a14))

### Chores

* **index:** regenerate after positioning → positioning-strategy rename ([9f42d91](https://github.com/event4u-app/agent-config/commit/9f42d9148f196d30635ae8288e9bba0feda66067))
* **changelog:** split era 2.2.x → pre-2.7.0 ([7158c30](https://github.com/event4u-app/agent-config/commit/7158c30db391f3464fd74f3c7e193698b869b82d))
* **generated:** refresh agents/index.md and docs/catalog.md for GTM skills/personas ([649b86e](https://github.com/event4u-app/agent-config/commit/649b86e287ecef7d0d28ce23ed2b0cbf43f2adc6))
* **generated:** regenerate .claude/ tool output + marketplace + compression hashes for GTM skills/personas ([bb7d56c](https://github.com/event4u-app/agent-config/commit/bb7d56cd8e7cafb9037a4e6ec0078e56154f9d5c))
* **roadmap:** archive road-to-gtm-and-growth — G+H+I all shipped ([dc48cdd](https://github.com/event4u-app/agent-config/commit/dc48cdd29e236c745e98b5f5fb8b45fa716a4c07))

Tests: 3577 (+11 since 2.7.0)

## [2.7.0](https://github.com/event4u-app/agent-config/compare/2.6.1...2.7.0) (2026-05-13)

### Features

* **install:** make augment global-only per ADR-007 amendment ([ea9a82f](https://github.com/event4u-app/agent-config/commit/ea9a82f2305a2a178b058ee66c40859790620d63))
* **mcp:** define mcp_scope lite vs full boundary in cloud-scope contract ([15a268c](https://github.com/event4u-app/agent-config/commit/15a268c9f86fabe677b4d70db9fd4e3d1726ef8a))
* **commands:** tier the slash + CLI command surface (Phase 4 of road-to-distribution-maturity) ([cc0102f](https://github.com/event4u-app/agent-config/commit/cc0102fe9677c936f703fd6e08b75cc99f758071))
* **distribution:** roadmap phases 1+2 — MCP auth-surface sync + verified-offline install ([a85c1af](https://github.com/event4u-app/agent-config/commit/a85c1afdc457c5fa4d939afc2d91649c67926501))

### Bug Fixes

* **refs:** point evaluation-2-2-2-followups at archived roadmap location ([cde02e6](https://github.com/event4u-app/agent-config/commit/cde02e6fd3bfbb2d67e2a8e3976fe6794ea4de6c))

### Documentation

* **architecture:** split docs/architecture.md into four pipeline sub-pages + drift test ([4f13cf5](https://github.com/event4u-app/agent-config/commit/4f13cf504c0b2d9b92661234a597b5515a7c54e8))
* **roadmap:** add distribution-maturity roadmap with council verdicts folded in ([14145cf](https://github.com/event4u-app/agent-config/commit/14145cff75ef34065358a2e99ee8c220ab0e59a0))

### Chores

* **ci:** refresh compression hashes after cc0102fe tiering pass ([ca06729](https://github.com/event4u-app/agent-config/commit/ca06729d03bb8bd8d1536b7aecef1d1b134d8333))
* finalize roadmaps ([bb156ea](https://github.com/event4u-app/agent-config/commit/bb156ea4f52741d511c3e54cd87e3bcab2fbf107))
* **roadmap:** close road-to-distribution-maturity, archive ([d48e5d6](https://github.com/event4u-app/agent-config/commit/d48e5d64f9396f6b75b47bf336fd6ac129c8e254))
* **changelog:** split into eras, archive pre-2.2.0 entries ([e54c5cb](https://github.com/event4u-app/agent-config/commit/e54c5cbf0222de7f0f4c84a379118f4ea30b5a07))

Tests: 3566 (+36 since 2.6.1)
