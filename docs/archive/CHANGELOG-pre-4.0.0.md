# Changelog Archive — pre-4.0.0

> Frozen snapshot of `event4u/agent-config` changelog entries for
> `3.2.0` and `3.3.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-27 once the active
> era's body crossed the drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 4.1.x".
> Entries here are not amended — git tags `3.2.0` and `3.3.0` remain
> the canonical source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).

## [3.3.0](https://github.com/event4u-app/agent-config/compare/3.2.0...3.3.0) (2026-05-25)

### Features

* **scripts:** point bench / eval / mcp tooling at internal/ (ADR-028 phase 1) ([c20b515](https://github.com/event4u-app/agent-config/commit/c20b515dfc80d03244e54af7b50e07d562647799))

### Bug Fixes

* **ci:** repoint bench/ -> internal/bench/ in projected agent-status + condense-memory ([682040b](https://github.com/event4u-app/agent-config/commit/682040b230248bd054767ab10bd1e90ed3a1d0b7))

### Documentation

* **roadmap:** archive road-to-root-layout-cleanup at 100% complete ([948f1a8](https://github.com/event4u-app/agent-config/commit/948f1a8cd9ec63fa831d5abab25aeb3657a0a7d4))
* **adr:** land Phase 2 audit evidence + ADR-029 multi-workspace deferral ([c4dabf1](https://github.com/event4u-app/agent-config/commit/c4dabf1f718fee0d4709d727d1e3eb781f8db62f))
* **adr:** land ADR-028 + root-layout-cleanup roadmap ([7b0fd28](https://github.com/event4u-app/agent-config/commit/7b0fd281288a87f9c218d9fa9d73f01a48a56626))
* repoint bench / mcp-worker paths to internal/ (ADR-028 phase 1) ([85278dd](https://github.com/event4u-app/agent-config/commit/85278dd831d44a187dcfe7684e895bac0ca97ae4))

### Chores

* **root:** move bench/ and workers/ under internal/ (ADR-028 phase 1) ([2a1dd1e](https://github.com/event4u-app/agent-config/commit/2a1dd1e363f9aabb59b6eebf35f64a47609abebb))
* **roadmap:** close changelog-era-auto-split (Phase 4 → ADR-027) ([b10b326](https://github.com/event4u-app/agent-config/commit/b10b32623b42739f0eba12a52173b810169929b6))

Tests: 4938 (+9 since 3.2.0)

## [3.2.0](https://github.com/event4u-app/agent-config/compare/3.1.1...3.2.0) (2026-05-25)

### Features

* **workspace:** GUI bridge + Workspace tab for Phases 4-8 backends ([6911b56](https://github.com/event4u-app/agent-config/commit/6911b56d1e474dace4a250d077ed93f628b029be))
* **workspace:** backend Python modules for Phases 5/6/7/8 ([c890fde](https://github.com/event4u-app/agent-config/commit/c890fde556b24e6b69409a4f0f647cace3779320))
* **memory:** wire knowledge namespace into hybrid retrieval ([a65ae2c](https://github.com/event4u-app/agent-config/commit/a65ae2c117ac10aff78ac711316b441d2ee2f42c))
* **knowledge:** implement local knowledge ingestion module ([d842ba3](https://github.com/event4u-app/agent-config/commit/d842ba350f325293f0faafe4698b8bbbe77033f8))
* **knowledge:** add /knowledge command cluster source files ([9023c17](https://github.com/event4u-app/agent-config/commit/9023c17049ea42769537919df5ca10db1cc785e7))
* **roadmap:** land road-to-employee-product-and-external-proof + consumer docs ([b2901ad](https://github.com/event4u-app/agent-config/commit/b2901ad516a6bb209b7fadae884563025a090e4d))
* **roles:** scaffold consultant, content-creator, galabau experiences ([55384df](https://github.com/event4u-app/agent-config/commit/55384df486cba24288f38275435d151c5c7b8762))

### Bug Fixes

* **knowledge:** use agent-config-maintainer workspace per discovery vocabulary ([75f78ab](https://github.com/event4u-app/agent-config/commit/75f78ab2999ed5fbc261aecf9fadd692588a2498))
* **check-refs:** mark forward-refs to recruit-sessions with ref-ignore ([147909b](https://github.com/event4u-app/agent-config/commit/147909b4428492ad8332959635573a1ab419d865))

### Documentation

* **roadmap:** mark Phases 4-8 backend complete + regen progress dashboard ([38b82f9](https://github.com/event4u-app/agent-config/commit/38b82f9928d57c9c7cfabd0b75f3c1284b6e2dcb))
* **roadmap:** mark Phase 2 done + sync command counts ([4089810](https://github.com/event4u-app/agent-config/commit/4089810f2123a0838e318fb442e975f6f60faf00))
* **knowledge:** add user guide and update contract for impl reality ([9fbea43](https://github.com/event4u-app/agent-config/commit/9fbea43033471e2daf2ef91342212a3480e24f93))
* **deploy:** add team-deployment-posture + small-team-recipe + stubs ([0892317](https://github.com/event4u-app/agent-config/commit/08923177dbd62346456a4992b8ab06e0442fb0cf))
* **contracts:** add 8 contracts for Daily Workspace + role experience ([34f882c](https://github.com/event4u-app/agent-config/commit/34f882c815fa2366956f2f454534bd9f18f79e04))
* **adr:** add ADR-022..026 for Daily Workspace architecture ([034eb99](https://github.com/event4u-app/agent-config/commit/034eb99569fcf388099b059ae5e8fb0537d902e3))

### CI

* **visibility:** drop push-trigger ghost-runs from drift workflows ([1704683](https://github.com/event4u-app/agent-config/commit/1704683ff0f08985e750b7cb6c8555812f349914))

### Chores

* **gitignore:** ignore pnpm-lock.yaml (repo uses npm) ([088fae6](https://github.com/event4u-app/agent-config/commit/088fae6ef8377200185826c31ea8adc0b97573f4))
* **counts:** sync command count to 136 (analytics cluster added) ([1d56496](https://github.com/event4u-app/agent-config/commit/1d564962bd57aedc6d4ff2ae6b757e45e8a63e2c))
* **release:** bump agent_config_version in templates to match package.json 3.1.1 ([4864332](https://github.com/event4u-app/agent-config/commit/4864332804fe9979a4f94cb053cdd13c7473ac40))
* **sync:** regenerate index + catalog for analytics commands ([77cb4fa](https://github.com/event4u-app/agent-config/commit/77cb4fa41d8b2773e7f5ece27f385d7b42862f5f))
* **sync:** regenerate condensed analytics commands + Claude skill stubs ([41728c4](https://github.com/event4u-app/agent-config/commit/41728c4400c8cabaa8966d2708fbb4f3cef64adb))
* **knowledge:** regenerate projections + manifests for /knowledge cluster ([f4c5a26](https://github.com/event4u-app/agent-config/commit/f4c5a26bffef0a25918bdde42131354c9dd5295d))
* **discovery:** add agent-skills and cinematic-ai-video to topics ([5c01d5e](https://github.com/event4u-app/agent-config/commit/5c01d5e152bda559aefd48fd8220f2a3cbd90249))

Tests: 4929 (+90 since 3.1.1)
