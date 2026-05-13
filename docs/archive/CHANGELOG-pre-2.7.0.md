# Changelog Archive — pre-2.7.0

> Frozen snapshot of all `event4u/agent-config` changelog entries from
> `2.6.1` and earlier (back to `2.2.0`), split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-13 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 2.7.x".
> Entries here are not amended — git tags `2.6.1` and prior remain the
> canonical source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Entries from `2.1.0` and earlier live in
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [2.6.1](https://github.com/event4u-app/agent-config/compare/2.6.0...2.6.1) (2026-05-13)

### Chores

* **gitignore:** add /agents/state/ to consumer template ([80449c4](https://github.com/event4u-app/agent-config/commit/80449c4fa13ca847f8af925d4b7e472658c60aef))

Tests: 3530 (+0 since 2.6.0)

## [2.6.0](https://github.com/event4u-app/agent-config/compare/2.4.1...2.6.0) (2026-05-13)

### Features

* **claude-desktop:** bundle commands as desktop skills ([50cd319](https://github.com/event4u-app/agent-config/commit/50cd31988ac571ecdf883c5d2c6d62c209820ebc))

### Other

* 2.5.0 ([1da0e10](https://github.com/event4u-app/agent-config/commit/1da0e1014b9cf24cf41d820795f96f2668ce738c))

Tests: 3530 (+9 since 2.4.1)

## [2.5.0](https://github.com/event4u-app/agent-config/compare/2.4.1...2.5.0) (2026-05-13)

### Features

* **claude-desktop:** bundle commands as desktop skills ([50cd319](https://github.com/event4u-app/agent-config/commit/50cd31988ac571ecdf883c5d2c6d62c209820ebc))

Tests: 3530 (+9 since 2.4.1)

## [2.4.1](https://github.com/event4u-app/agent-config/compare/2.4.0...2.4.1) (2026-05-13)

### Bug Fixes

* **install:** write lockfile to canonical event4u namespace ([ca57607](https://github.com/event4u-app/agent-config/commit/ca5760785f150903bcad74e278b59e534f83634d))
* **install:** source global deploy from .agent-src/ subdirectories ([f151caf](https://github.com/event4u-app/agent-config/commit/f151caf854d9ce8519bc244d441a7c8bf73e7fde))

Tests: 3521 (+0 since 2.4.0)

## [2.4.0](https://github.com/event4u-app/agent-config/compare/2.3.0...2.4.0) (2026-05-13)

### Features

* **install:** Claude Desktop ZIP bundle deployment ([9f2a00c](https://github.com/event4u-app/agent-config/commit/9f2a00cfd752232abdcf16c6e3440c46f5c9d596))
* **install:** event4u namespace and auto-migration shim ([a58570e](https://github.com/event4u-app/agent-config/commit/a58570ecff885a7d50350c4281e675d7ff34f912))

### Bug Fixes

* **agent_settings:** align source with template via relative import ([a85b6c8](https://github.com/event4u-app/agent-config/commit/a85b6c82284310876d075a924918052fc7dbabdb))
* **work_engine:** vendor user_global_paths into template for self-contained import ([f111c4e](https://github.com/event4u-app/agent-config/commit/f111c4e60de6cd60fbe81635029f9f34437a5ead))
* **migrate:** atomic per-entry write with partial-debris purge ([5bd5aad](https://github.com/event4u-app/agent-config/commit/5bd5aadf0085657ec98eee049dda440d05b06801))

### Documentation

* **roadmap:** mark Steps 5-6 done (commit + PR opened) ([8492b7f](https://github.com/event4u-app/agent-config/commit/8492b7fd3cfd76075a64d5de770db2c5013e02dd))
* **adr:** ADR-009 rollback section + AI Council convergence ([cc78adc](https://github.com/event4u-app/agent-config/commit/cc78adc0a9d0fbc51b2a65f35d8e0f13c1456a2f))
* **contracts:** mark installed-tools-lockfile as beta ([90991da](https://github.com/event4u-app/agent-config/commit/90991da2f840ebae978fc4df9996c01324816404))
* **adr:** ADR-009 event4u namespace + Claude Desktop ZIP bundles ([c707bd3](https://github.com/event4u-app/agent-config/commit/c707bd31211f94ace858738b7aee8d3898f0da88))
* **roadmap:** add road-to-event4u-namespace-and-claude-desktop ([d92706b](https://github.com/event4u-app/agent-config/commit/d92706bd53621ff3a225db6eb9ee490f17f613d2))

### Chores

* **onboard:** rephrase 'event4u-owned' as 'package-owned' ([4bdd43b](https://github.com/event4u-app/agent-config/commit/4bdd43b7a6637a36cfa377045b6cd0f3f51b0fd1))
* **template:** bump agent_config_version pin to 2.3.0 ([1180bf2](https://github.com/event4u-app/agent-config/commit/1180bf263f2f33fb5b41b13439c92cfbdc3a70d8))
* **index:** regenerate index + catalog for accurate counts ([655a5eb](https://github.com/event4u-app/agent-config/commit/655a5eb81ce6744548a6f50451f66576a7c2b5ac))
* **sync:** regenerate derived outputs for event4u namespace ([c277a94](https://github.com/event4u-app/agent-config/commit/c277a94f881ad4702ed2e97cebf6c5a7c8471a35))

Tests: 3521 (+31 since 2.3.0)

## [2.3.0](https://github.com/event4u-app/agent-config/compare/2.2.2...2.3.0) (2026-05-13)

### Features

* **prune:** add --resume-uninstall for focused crash recovery ([1c98454](https://github.com/event4u-app/agent-config/commit/1c9845404f1e629f802494c732f7438aa4335c8e))
* **dev:** add dev:install-global and dev:link tasks for local development ([db4bdc9](https://github.com/event4u-app/agent-config/commit/db4bdc9794752791bb93235cc9cc3179df9b88df))
* **install:** manifest schema v2 + doctor + conflict detection + inline tag ([50c0892](https://github.com/event4u-app/agent-config/commit/50c0892bf01eb904e48dd786ef03c519f82be485))
* **cli:** add prune command for orphaned bridge markers ([d16abff](https://github.com/event4u-app/agent-config/commit/d16abff8ac9fd55ccd501d319785f463eb7cbeee))
* **cli:** add uninstall/versions subcommands and --offline mode ([12a8e75](https://github.com/event4u-app/agent-config/commit/12a8e75945f1d26c1412d17331788c8e51601cea))
* **install:** add workflow-mode activation hints to IDE bridges ([5e09e17](https://github.com/event4u-app/agent-config/commit/5e09e17f0de62b4113bd68839d6ce55a1527d4b1))
* **rules:** add external-reference-deep-dive hardening rule ([0d2c80c](https://github.com/event4u-app/agent-config/commit/0d2c80c0f418b80a67d08c4577cfe67ab6abe3db))
* **install:** expand global content deployment to 23 AI tools ([3ef13a7](https://github.com/event4u-app/agent-config/commit/3ef13a7c2ae16b95da9e5a49ec3a19c5cb211357))

### Bug Fixes

* **install:** normalise manifest paths + surface doctor remediation hint ([b4662b6](https://github.com/event4u-app/agent-config/commit/b4662b609db6b1b4660652facc0efb10b36a5d51))
* **test:** patch USERPROFILE in isolated_lock fixture for Windows ([ac1c924](https://github.com/event4u-app/agent-config/commit/ac1c924e08822e09471c0cf0077ad69be531d7b5))

### Documentation

* **readme:** remove stale vX.0 breaking-change notice ([d6aef9a](https://github.com/event4u-app/agent-config/commit/d6aef9acce3e5409f0ffc641ecf026af1f9bb863))
* **roadmap:** sharpen Phase 6 deferred trigger — name the collision ([d0a6dd2](https://github.com/event4u-app/agent-config/commit/d0a6dd28294c011d4135b4047e4e5252008fcf05))
* **roadmap:** close + archive multi-package coexistence ([3ef464f](https://github.com/event4u-app/agent-config/commit/3ef464fd6123ead7ca755542a1459e6a9e8e270b))
* **roadmap:** plan + close phases 1-5 of multi-package coexistence ([34967a5](https://github.com/event4u-app/agent-config/commit/34967a5e6525d4d742155ee3bd3fe0bb80d852bf))
* **install:** add installed-tools-lockfile wire contract ([c352db3](https://github.com/event4u-app/agent-config/commit/c352db383f6bf6dc328159289fa4d96abb2594c4))
* **setup:** add per-IDE activation guides for 14 tools ([6379a49](https://github.com/event4u-app/agent-config/commit/6379a49fed6ac3256c23ac8e04c69fa0d4f85aa2))

### Tests

* **e2e:** cover shared JSON merges, sole-owner cleanup, conflict chain ([0ff50ae](https://github.com/event4u-app/agent-config/commit/0ff50ae617d878138376e535fc8b5c22a7677356))
* **install:** e2e multi-package coexistence scenario ([081318e](https://github.com/event4u-app/agent-config/commit/081318ea8e3c872548839d100117cbd9b4a1343a))
* **cli:** cover prune — orphans, dry-run, json, hard-floor ([0261ea2](https://github.com/event4u-app/agent-config/commit/0261ea2e1687e6904bdcb3083cb0d700b6ef82e5))

### CI

* **tests:** bump per-shard parallelism explicitly to beat macOS nproc=3 ([83a3b4d](https://github.com/event4u-app/agent-config/commit/83a3b4d3bf6eefe10963d84525469aeb8e3b8abe))
* **tests:** bump install-tests shards 3→4 to keep macOS under 2min ([dd4d5bc](https://github.com/event4u-app/agent-config/commit/dd4d5bc385282d344809a057d015a968811d4a3b))
* **tests:** shard install-tests matrix to hit 1-2min/job target ([6a56416](https://github.com/event4u-app/agent-config/commit/6a564161f0a74601fe077d34c76f2f5a27657893))
* **tests:** parallelize install-tests + fix Windows UTF-8 encoding ([e346a26](https://github.com/event4u-app/agent-config/commit/e346a26e91be633a63e8c7d46fb09a3a6cdf800e))
* **tests:** bootstrap .augment/ projection before pytest ([e40371e](https://github.com/event4u-app/agent-config/commit/e40371ea7b0c345ee59eba8ba5e47328bf6aebe9))

### Chores

* finalize changes ([7cbbe68](https://github.com/event4u-app/agent-config/commit/7cbbe6881e040d67fd0598df73b82b3fbd1278c0))
* regenerate router.json after kernel/tier rebuild ([ff5f10e](https://github.com/event4u-app/agent-config/commit/ff5f10e0589f46782ec6381a84377f22b90d7edc))
* **marketplace:** refresh marketplace.json manifest ([eb9b934](https://github.com/event4u-app/agent-config/commit/eb9b934f5b4573ec1fcde19f91f6a20637b8dbeb))

Tests: 3490 (+140 since 2.2.2)

## [2.2.2](https://github.com/event4u-app/agent-config/compare/2.2.1...2.2.2) (2026-05-12)

### Bug Fixes

* allow --global installs from agent-config source repo ([1be1b44](https://github.com/event4u-app/agent-config/commit/1be1b4429e8fa3ff3fb2981a1368138aa34186ac))

Tests: 3350 (+0 since 2.2.1)

## [2.2.1](https://github.com/event4u-app/agent-config/compare/2.2.0...2.2.1) (2026-05-12)

### Documentation

* changelog + ADR-007 note for package consolidation ([1d0d6fb](https://github.com/event4u-app/agent-config/commit/1d0d6fb8882431ee11a6b034f6157ae9f8ccea4d))
* update install commands to npx @event4u/agent-config init ([b9956c6](https://github.com/event4u-app/agent-config/commit/b9956c6ff827433bff7dc9aa1f40ba3454ef5154))

### Chores

* consolidate npm package into @event4u/agent-config init ([d3188ce](https://github.com/event4u-app/agent-config/commit/d3188ced3edac5b670b68e22f51295ef831471d6))

Tests: 3350 (+0 since 2.2.0)

## [2.2.0](https://github.com/event4u-app/agent-config/compare/2.1.0...2.2.0) (2026-05-12)

### Features

* **npx:** expand --tools validator to 13 supported AI ids ([7af69a7](https://github.com/event4u-app/agent-config/commit/7af69a766f575c30d8f29ea04052647b6a1b8a19))
* **cli:** add sync and validate subcommands for installed-tools manifest ([62a5c66](https://github.com/event4u-app/agent-config/commit/62a5c66a131bcf8866be2a8c0e76ba6e054017af))
* **cli:** add export subcommand and update version-drift handling ([6110f3b](https://github.com/event4u-app/agent-config/commit/6110f3b0ee454ca215c569d8f42ca38ffce577e8))
* **install:** global-first install with lockfile + installed-tools manifest engine ([6200d42](https://github.com/event4u-app/agent-config/commit/6200d42225d5712a10d5458dc608da3f5cd0164c))

### Bug Fixes

* **rules:** trim no-cheap-questions to satisfy 12% concentration cap ([4abf946](https://github.com/event4u-app/agent-config/commit/4abf94628838c027da13d190e5e7b27738070db2))

### Documentation

* **rules:** add no-cheap-questions Iron Law 3 against paternalistic state options ([b98687b](https://github.com/event4u-app/agent-config/commit/b98687bd397d39eae6811e54eb743a095fa33b8b))
* README + installation + manifest guideline for global-first install ([cdc52ff](https://github.com/event4u-app/agent-config/commit/cdc52ffc5abb9cff6fda9133dd0b8dc524794d18))
* **contracts:** add tier-3 contrib plugin contract ([2dbf9cd](https://github.com/event4u-app/agent-config/commit/2dbf9cd2ec772dc2248de2b8f17248e97a67a60b))
* **adr:** add ADR-007 global-first install + ADR-008 installed-tools manifest ([e214de2](https://github.com/event4u-app/agent-config/commit/e214de27bd8d19858fdc16cecc4ebfeaaebce136))

### CI

* **windows:** add lockfile + export tests on Windows runner ([e5802a5](https://github.com/event4u-app/agent-config/commit/e5802a56f45bcfd5eb845c7af816bb12a0b4492b))

### Chores

* **taskfile:** add test-install-local for offline one-liner smoke test ([594ac69](https://github.com/event4u-app/agent-config/commit/594ac69c8682f106dee9ebc9ce3e55bb0083e254))
* **roadmap:** archive road-to-global-first-install (24/24 complete) ([71d8cf2](https://github.com/event4u-app/agent-config/commit/71d8cf2966976c286ffecc1646cb7990255cccd1))

Tests: 3350 (+97 since 2.1.0)

