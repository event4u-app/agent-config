# Changelog Archive — pre-2.17.0

> Frozen snapshot of `event4u/agent-config` changelog entries from
> `2.16.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-16 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 2.17.x".
> Entries here are not amended — git tag `2.16.0` remains the
> canonical source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-2.16.0.md`](CHANGELOG-pre-2.16.0.md),
> [`CHANGELOG-pre-2.15.0.md`](CHANGELOG-pre-2.15.0.md),
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).


## [2.16.0](https://github.com/event4u-app/agent-config/compare/2.15.0...2.16.0) (2026-05-15)

### Features

* **install:** install-mode marker + minimal-init upgrade hint (Step 8 P3) ([e028468](https://github.com/event4u-app/agent-config/commit/e028468ed2b58428b99bea5a2e6c2a25e12fc113))
* **cli:** doctor --trace-root + --context diagnostic surface (Step 8 P2) ([387a626](https://github.com/event4u-app/agent-config/commit/387a626b7795fc40e6e2442c1dde272dfc98f9d7))
* **cli:** --root override flag + fail-loud root validation (Step 8 P1) ([0c8356e](https://github.com/event4u-app/agent-config/commit/0c8356e9034ca474827de89db5386a04c61f560c))
* **wrapper:** export AGENT_CONFIG_PROJECT_ROOT pin so subdir invocations skip the walk ([e866cef](https://github.com/event4u-app/agent-config/commit/e866cef14d40269786fb0a88b69d9aafcfab1c88))
* **agent-settings:** add resolve_project_root helper for Phase 3 subdir hardening ([95bac18](https://github.com/event4u-app/agent-config/commit/95bac187132d35d476716cd38d8c619bccaca6e5))
* **install:** add --minimal / --settings-only init mode ([4c02743](https://github.com/event4u-app/agent-config/commit/4c02743cd7df6d89f7b7fa6188d654ca1eec983c))
* **agent_settings:** extend find_project_root with agents/ + .agent-settings.yml anchors ([60dcd11](https://github.com/event4u-app/agent-config/commit/60dcd11c498f25f92bb01482943bfb95d4efef37))

### Documentation

* **changelog:** Step 8 discovery polish entry under Unreleased ([eecaf6a](https://github.com/event4u-app/agent-config/commit/eecaf6a9a2248a877d71dbd33e7db096f94dab3b))
* **installation:** root override + monorepo semantics + diagnostics (Step 8) ([de3081f](https://github.com/event4u-app/agent-config/commit/de3081fe828cb43c628d922c50d25177d43f267e))
* **roadmap:** archive step-7 (all phases complete) + sync dashboard ([8f2953e](https://github.com/event4u-app/agent-config/commit/8f2953ee5c867ada29c9f32cf45bd2380504bc12))
* **step-7:** add minimal-init flow, anchor migration guide, changelog entry ([9ace019](https://github.com/event4u-app/agent-config/commit/9ace01945967e67e98e8855a940801db09de8d17))
* **roadmap:** mark Step 7 Phase 3 complete (subdir invocation hardening) ([518f9dc](https://github.com/event4u-app/agent-config/commit/518f9dcaf6d71a34cf1700bceb1487f1e8e33175))
* **roadmap:** mark Step 7 Phase 2 + test items complete ([1bb9b71](https://github.com/event4u-app/agent-config/commit/1bb9b712d866dd509124f7d8502f52957e972b20))
* **roadmap:** mark Step 7 Phase 1 complete; refresh progress dashboard ([2ba8d5b](https://github.com/event4u-app/agent-config/commit/2ba8d5be1b94bbab87da4270d833697c895cc9c6))

### Refactoring

* **cli:** route all cmd_*.py entry points through resolve_project_root ([aa7a01a](https://github.com/event4u-app/agent-config/commit/aa7a01a7f27205919193d54339298c0dbd30c43e))

### Tests

* **cli:** coverage for --root override + doctor trace/context (Step 8) ([9b943aa](https://github.com/event4u-app/agent-config/commit/9b943aa9f002750499738fd36f8a203525fb84da))
* **subdir:** cover resolve_project_root precedence + wrapper-pinned root ([0693714](https://github.com/event4u-app/agent-config/commit/06937145ac8f4e1160ec9279d3832e4f5397bb1e))
* **install:** cover --minimal payload + nested-install guard ([5623521](https://github.com/event4u-app/agent-config/commit/56235218624792b487a92f444ff8ee114a5651a3))
* **agent_settings:** cover anchor extension, kill-switch, perf budget ([37a080c](https://github.com/event4u-app/agent-config/commit/37a080c07ee9238fda45bbda1829764a4232f062))

### Chores

* **template:** bump agent_config_version pin to 2.15.0 ([093367d](https://github.com/event4u-app/agent-config/commit/093367d3e417a11a28295f2efa574e8c3fef6524))
* **sync:** propagate Step 8 agent_settings.py to dist/agent-src/ projection ([7ce92e5](https://github.com/event4u-app/agent-config/commit/7ce92e514a8edbd970a4118b91d2f651bf730070))
* **roadmap:** archive Step 8 discovery polish ([1c21982](https://github.com/event4u-app/agent-config/commit/1c219825dc413cfe45aefc3b12c08d2720583880))
* **changelog:** split era 2.11.x → pre-2.15.0 ([c79363c](https://github.com/event4u-app/agent-config/commit/c79363c05d775ecfa95ab6fff5b3bbe706f797c9))

Tests: 4405 (+53 since 2.15.0)
