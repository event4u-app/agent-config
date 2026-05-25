# Changelog Archive — pre-3.2.0

> Frozen snapshot of `event4u/agent-config` changelog entries for
> `3.1.0` and `3.1.1`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-25 once the active
> era's body crossed the drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 3.2.x".
> Entries here are not amended — git tags `3.1.0` and `3.1.1` remain
> the canonical source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-3.1.0.md`](CHANGELOG-pre-3.1.0.md),
> [`CHANGELOG-pre-3.0.0.md`](CHANGELOG-pre-3.0.0.md),
> [`CHANGELOG-pre-2.25.0.md`](CHANGELOG-pre-2.25.0.md),
> [`CHANGELOG-pre-2.20.0.md`](CHANGELOG-pre-2.20.0.md),
> [`CHANGELOG-pre-2.17.0.md`](CHANGELOG-pre-2.17.0.md),
> [`CHANGELOG-pre-2.16.0.md`](CHANGELOG-pre-2.16.0.md),
> [`CHANGELOG-pre-2.15.0.md`](CHANGELOG-pre-2.15.0.md),
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [3.1.1](https://github.com/event4u-app/agent-config/compare/3.1.0...3.1.1) (2026-05-24)

### Bug Fixes

* **deploy:** docker-compose smoke boots wizard URL in 12s ([0d34f95](https://github.com/event4u-app/agent-config/commit/0d34f9548bb219ee330fefcf0f8657dbc0930923))

### Documentation

* **roadmaps:** close last open ACs and archive completed roadmaps ([93035c5](https://github.com/event4u-app/agent-config/commit/93035c53d805327351d90b20b6b0662de6efead3))

Tests: 4839 (+0 since 3.1.0)

## [3.1.0](https://github.com/event4u-app/agent-config/compare/3.0.0...3.1.0) (2026-05-24)

### Features

* **gui:** wire telemetry opt-in into wizard apply ([9da4790](https://github.com/event4u-app/agent-config/commit/9da479012c25b7882ff877a433e417500d0a974f))
* **telemetry-worker:** add Cloudflare Worker source ([f42eba6](https://github.com/event4u-app/agent-config/commit/f42eba665c56149eb92a0e16e0c08a50680b1f76))
* **telemetry:** add client SDK with four-gate inertia ([2d58a56](https://github.com/event4u-app/agent-config/commit/2d58a56b43c7287bfb3bf445b55d3302cd1569ab))
* **gui:** add --host binding and /api/v1/health for deployment ([abc3a1a](https://github.com/event4u-app/agent-config/commit/abc3a1ade37e09a20afc8b8544e4cffaf09a4645))
* **deploy:** add Dockerfile and docker-compose manifests ([9ac9fee](https://github.com/event4u-app/agent-config/commit/9ac9fee734176274a0dd2064e324fcbebebd939e))
* **distribution:** sync package.json keywords with topics + handoff template ([49382ec](https://github.com/event4u-app/agent-config/commit/49382ec243e2dcc36c7c7e3bad3cbad9463d900e))
* **rules:** harden no-cheap-questions with Iron Laws 5 + 6 ([8c5b73e](https://github.com/event4u-app/agent-config/commit/8c5b73eebba4365619d20add68f5e983f7424cd2))
* **installer-gui:** Explain tab + vertical timeline + help expanders ([e8c6968](https://github.com/event4u-app/agent-config/commit/e8c6968fad6a559d462c992590e1805d274adc37))
* **installer-gui:** add GET /api/v1/explain/last endpoint ([bba2f8e](https://github.com/event4u-app/agent-config/commit/bba2f8e37f43c6c2bdc9efc94db5519b06e84c0a))
* **installer-gui:** wrap explain-last CLI behind safe-spawn runner ([1ff60ea](https://github.com/event4u-app/agent-config/commit/1ff60ea200a630cf595492fb156d61457422220e))
* **installer-gui:** three-tab navigation, tasks + council surfaces ([6718f94](https://github.com/event4u-app/agent-config/commit/6718f946d7f5a5c1029830949106865826925a2f))
* **installer-gui:** add task + council api endpoints ([f2d71a0](https://github.com/event4u-app/agent-config/commit/f2d71a0029006733886da8ff7f3f8d616558ebff))
* **installer-gui:** inline task-exec layer with closed allowlist ([a189ffa](https://github.com/event4u-app/agent-config/commit/a189ffa7e5e1f3939264d50ab889d340e2efa971))
* **schema:** add gui_runnable property for taskfile commands ([5b20187](https://github.com/event4u-app/agent-config/commit/5b20187c271f0523590c18c43d2b7ca98362a59d))
* **installer-gui:** wire dryRun through the postApply handler ([2ac9f63](https://github.com/event4u-app/agent-config/commit/2ac9f63c0c4903c72034e16ed0db7436fac180f8))
* **wizard-apply:** bridge WizardApplyPayload to scripts/install.py ([db776d9](https://github.com/event4u-app/agent-config/commit/db776d980c15d736a0aa8f28a2fc7b8f85e7c7c2))
* **wizard-ui:** wire extendedSteps signal through the step engine ([e4ced30](https://github.com/event4u-app/agent-config/commit/e4ced30c07bb7bacab32d4eda507d0347b111204))
* **doctor:** add wizard-state health check + --repair ([df04a4a](https://github.com/event4u-app/agent-config/commit/df04a4a965a17cd95825c21ad35e7d75946c7532))
* **cli:** agent-config migrate-to-global subcommand (Phase 5) ([1155e28](https://github.com/event4u-app/agent-config/commit/1155e281d6e3c909212bd4cc968017c72d115034))
* **install:** consumer surface + bridge marker (Phase 4) ([5dd42f5](https://github.com/event4u-app/agent-config/commit/5dd42f5d2a2ce92f9b1210145d64a4f44be1bccb))
* **installer:** TypeScript CLI mirrors consumer-global-only gate ([c0ed91d](https://github.com/event4u-app/agent-config/commit/c0ed91df577083253c533d5791d705d31a3ac204))
* **install:** bash orchestrator consumer-global-only gate ([77542f7](https://github.com/event4u-app/agent-config/commit/77542f7025c5035403689e21da34855b838ce87d))
* **install:** flip SCOPE_SUPPORT to global-only + dev-mode matrix bypass ([f3ed87c](https://github.com/event4u-app/agent-config/commit/f3ed87c8c8b17e656d7795d34d7c4ef5893f1603))
* **wizard:** scope-to-project opt-in checkbox + project-scope route ([e5c5abf](https://github.com/event4u-app/agent-config/commit/e5c5abffd24650c5ecc7c4d1a055923946e46ed9))
* **cli:** settings:migrate subcommand + settings-api docs sweep ([0384963](https://github.com/event4u-app/agent-config/commit/0384963539155fea4f9c80e63113e8c1cde387bd))
* **settings:** TypeScript three-layer reader + Phase 2.2 closeout ([a03cd10](https://github.com/event4u-app/agent-config/commit/a03cd107b1250678d346c4dce6e7490952b3e0e1))
* **wizard:** extended-mode 9-step flow with ai-tools + packs ([3ede109](https://github.com/event4u-app/agent-config/commit/3ede10902421cabf9f17668892d476a92612223d))
* **install:** three-layer settings reader + consumer-global-only gate ([7a026e4](https://github.com/event4u-app/agent-config/commit/7a026e48aab01bdf6cd8fc6f7ba9dcb825735c2e))
* **security:** lint_global_paths.py — Phase 5.0 perms entry-gate ([8ed0734](https://github.com/event4u-app/agent-config/commit/8ed0734dd1da74f98c3a91b9fb77ecc76e2cec34))
* **contracts:** consumer-bridge spec for agents/.event4u-bridge.yml ([c717279](https://github.com/event4u-app/agent-config/commit/c717279560eedb2e238b8578775e13932a66213e))
* **wizard:** lock /api/apply payload schema with schema_version discriminator ([dda4b98](https://github.com/event4u-app/agent-config/commit/dda4b981e31621a9c6d56707895310e1a8e58c83))
* **dev:** add dev:install:gui task pair for unified-wizard rollout ([7f030b8](https://github.com/event4u-app/agent-config/commit/7f030b86e4579ce375658421eb01680422959cb5))
* **packs:** FIRST_WIN.md + onboarding metadata for five featured packs ([cfdcc3a](https://github.com/event4u-app/agent-config/commit/cfdcc3af31653913623696f9330556e9a6dec164))
* add Read-Loop Detection (15/25 rule) and Debug micro-loop ([bed14c9](https://github.com/event4u-app/agent-config/commit/bed14c958841d7a8b3dfb3b56bb90df89f6b2429))
* migrate user identity to agents/settings/.agent-user.yml ([df45a07](https://github.com/event4u-app/agent-config/commit/df45a07afebde25ffd1696a90cb8dddd9b789115))
* **wizard:** close-window banner and suppress Finish on no-changes ([43c080c](https://github.com/event4u-app/agent-config/commit/43c080c53848117de0842005c8ffb5449cba2695))
* **wizard:** drop personal.user_name + identity.nickname; seed identity.name via legacy hint ([f38bab5](https://github.com/event4u-app/agent-config/commit/f38bab57330c2033d2a65f62ac416f354941031f))
* **wizard:** auto-migrate legacy .agent-settings.yml + .agent-user.md on finish ([03210de](https://github.com/event4u-app/agent-config/commit/03210def8259944dbc82d0de07a381bbad67073d))
* **server:** mint dry-run tokens with persist:false ([79d99e3](https://github.com/event4u-app/agent-config/commit/79d99e3b55ce5320b0db847485e9b2b1a2e9cdc7))
* **install.py:** auto-launch wizard + --dry-run + --no-ui ([3258309](https://github.com/event4u-app/agent-config/commit/3258309e2c821fa72ea42ee50e439b79b474ee43))
* **installer/gui:** add 'gui' subcommand + atomic PID lock ([53cf215](https://github.com/event4u-app/agent-config/commit/53cf215b1f11765c36d0e075e4ae3653da5436a2))
* **installer/gui:** boot-time rollback prompt + recovery API (P6.4) ([45e2a59](https://github.com/event4u-app/agent-config/commit/45e2a59d521959d96c91877448b920c03f0853b8))
* **installer/gui:** open-lockfile endpoint + retry button (P6.3) ([81d1708](https://github.com/event4u-app/agent-config/commit/81d1708460fd2b3fa5222b94cfb826ea91c6fae0))
* **installer/gui:** --gui-idle flag + headless DISPLAY fallback ([2ff5e90](https://github.com/event4u-app/agent-config/commit/2ff5e900b6e579fa8b983192ba861347ce03a1bf))
* **installer/gui:** inlined SPA + integration tests (P6.4/P6.5) ([5607381](https://github.com/event4u-app/agent-config/commit/5607381e65b41c015923f7d9a1f4f8769ec843ac))
* **installer/gui:** API handlers + transaction log (P6.2/P6.3) ([aa713f5](https://github.com/event4u-app/agent-config/commit/aa713f55560db5c4f79f20cbed48c37e3074bc56))
* **installer/gui:** server skeleton + CLI flag (P6.1) ([eb3dd50](https://github.com/event4u-app/agent-config/commit/eb3dd504a0c15d0c7786f7289b5fe8fc30f04358))
* **ci:** per-pack skill-lint matrix (Phase 4.4 closure) ([887442b](https://github.com/event4u-app/agent-config/commit/887442b74f584897a40843165c86c9bea0cbe024))
* **lint:** add lint-trust-coherence + wire into ci-fast ([4a8eef7](https://github.com/event4u-app/agent-config/commit/4a8eef78990bdc163eed0d29b1179bf44e08ec1a))
* **discovery:** emit per-pack trust_summary + human_review counts ([2e09814](https://github.com/event4u-app/agent-config/commit/2e09814061d404f51f7674b46f501e6e5a950594))
* **compress:** inject HUMAN_REVIEW banner on advisory artefacts ([c3d4c7f](https://github.com/event4u-app/agent-config/commit/c3d4c7f008350e2adb8e7d327cacc1c26e0b667e))
* **installer:** trust summary, advisory confirm, lockfile escalation ([e73c1cb](https://github.com/event4u-app/agent-config/commit/e73c1cbf07d971fae3009b11a2aa41ca045ffc79))
* **safety-floors:** add domain safety-floor rules per pack ([5da81ee](https://github.com/event4u-app/agent-config/commit/5da81ee6f9d1f7bf2ee3043efa33ed7d2f098637))
* **monorepo:** pack manifests, boundary lint, and scaffolders ([8cd24b1](https://github.com/event4u-app/agent-config/commit/8cd24b11658ac86481037f721958d3cf1f00adff))
* **migration:** add Phase 4 planner, snapshot, and verify scripts ([ed8e007](https://github.com/event4u-app/agent-config/commit/ed8e0074917aeee52283217cc413bf078bc520ff))
* **install:** deprecate direct `bash install.sh` in favor of TS installer ([baae960](https://github.com/event4u-app/agent-config/commit/baae960c89fabd2eeb8cf17f35fd022561c917d3))
* **installer:** add TypeScript installer package (ADR-016) ([0470aad](https://github.com/event4u-app/agent-config/commit/0470aad80608965ab75f10a5dd6658cfa87d745c))
* **discovery:** wire validate + checksum-stability + stats into CI ([33de62d](https://github.com/event4u-app/agent-config/commit/33de62d2a455d15290f2ec0cf18f59dec65cfd4b))
* **discovery:** emit checksum + requires + stats, orphan-report, sub-views ([2b18b0f](https://github.com/event4u-app/agent-config/commit/2b18b0f36e2d202c73e95636a4e59b2d9f745f8b))
* **discovery:** lock manifest contract v2 — checksum + requires + stats (ADR-015) ([3e2611f](https://github.com/event4u-app/agent-config/commit/3e2611f9e8e02b9c9e8bc313a5e772663b3ea980))
* **hooks:** combined pre-commit + standalone frontmatter hook ([09ba992](https://github.com/event4u-app/agent-config/commit/09ba992d1a41e71ced107812a53cbcaece1cc276))

### Bug Fixes

* **roadmap:** drop hard refs to gitignored agents/tmp/ council files ([5647bc6](https://github.com/event4u-app/agent-config/commit/5647bc67c437cad844ef574ff89fefa9a0596ecf))
* **check-refs:** treat deferred [~] checkboxes as forward-looking like [ ] ([890081d](https://github.com/event4u-app/agent-config/commit/890081d8dcd4742d95a05f3630a9a0ff42764959))
* **readme:** restore audience routing block + MCP/dev anchors for CI ([2f76c4f](https://github.com/event4u-app/agent-config/commit/2f76c4f932f84718c033aa4483b624537c5a2927))
* **roadmap:** allowlist council-sessions ref in API endpoint description ([743f5ca](https://github.com/event4u-app/agent-config/commit/743f5ca6b3a9acc33eb9cfff1b352833634cd842))
* **readme:** drop link to experimental contract mcp-cloud-scope per check-public-links ([181d8c4](https://github.com/event4u-app/agent-config/commit/181d8c4d649ca9b213482d1fabac92e05be7bb4f))
* **context:** swap task-specific commands for portable wording in cheap-question-mechanics ([8079f24](https://github.com/event4u-app/agent-config/commit/8079f2471e3ad2d04baaddaad0d5426efce5da91))
* **test:** normalise wall-clock in orphan-report determinism check ([ca3021c](https://github.com/event4u-app/agent-config/commit/ca3021ce76556fab84886110fe5562ea36529a0c))
* **lint:** hoist WizardStep import to satisfy consistent-type-imports ([3442ae2](https://github.com/event4u-app/agent-config/commit/3442ae217ea3dd9e55499a6b9d3983168b1f9843))
* **ci:** one-liner smoke opts into AGENT_CONFIG_DEV_MODE ([0c536f2](https://github.com/event4u-app/agent-config/commit/0c536f2cd906e7e3163fb187d2a2a178a1d3fca4))
* **ci:** orchestrator tests opt into AGENT_CONFIG_DEV_MODE ([c3fe72b](https://github.com/event4u-app/agent-config/commit/c3fe72b39849117b09450d022921db6913cc6281))
* **cli:** register migrate-to-global subcommand in TS registry ([3368aab](https://github.com/event4u-app/agent-config/commit/3368aab8c6bb1a84166501b7710dccf7bc2f420f))
* **parity:** re-mirror agent_settings.py to work_engine template ([d474b5b](https://github.com/event4u-app/agent-config/commit/d474b5bd1c11ab001a48a9dedee0e172c443e8f7))
* **contracts:** consumer-bridge declares stability: beta ([80d9fac](https://github.com/event4u-app/agent-config/commit/80d9faccd2138eb341ef76c32406ab8baa471939))
* **ci:** smoke-quickstart sets AGENT_CONFIG_DEV_MODE=1 for installer subprocess ([bafcbbb](https://github.com/event4u-app/agent-config/commit/bafcbbb78af9e62cb6681e4c11e09b50fc873dd4))
* **readme:** trim back under 750-line budget ([011845b](https://github.com/event4u-app/agent-config/commit/011845be327523ee40fe4547134c24fbea3b5329))
* **ci:** drop fragile git fetch in kernel-rule bundle check ([2e1f445](https://github.com/event4u-app/agent-config/commit/2e1f445fa2c04d5fd41c003ba8da5310380fd260))
* **installer/gui:** pre-register SIGINT/SIGTERM before WIZARD_READY ([8d55976](https://github.com/event4u-app/agent-config/commit/8d559766afe2f9bb23bdf3fe701fb9ad72aa94a6))
* **readme:** restore hero badge line for CI gate ([cfbb219](https://github.com/event4u-app/agent-config/commit/cfbb219b913e51cf62836da93a62f863c2234572))
* **readme:** restore Commands badge for check-command-count gate ([2895639](https://github.com/event4u-app/agent-config/commit/2895639059bd979b4f14f6a152ab5ad541ee17e7))
* **roadmap:** drop tmp/-paths from ai-os-product-ui prose lines ([b4dfe3b](https://github.com/event4u-app/agent-config/commit/b4dfe3ba15f22e3e7dd69ff88cdd3aea1aed0b5d))
* **roadmap:** move council-ref-allowed pragma to same line as r1 link ([41ada11](https://github.com/event4u-app/agent-config/commit/41ada11336500bbe4ed8f995fb1dafc72bec5fec))
* **docs:** drop transient roadmap link from trust-and-safety contract ([168eb1f](https://github.com/event4u-app/agent-config/commit/168eb1fb982a153ed950e322716de4b784b9b5d3))
* **rules:** use barewords for cross-pack links in safety-floor rules ([8fbab61](https://github.com/event4u-app/agent-config/commit/8fbab61eb0d334956b27ba9fd017fa169a56524c))
* stabelize flacky test ([a3818db](https://github.com/event4u-app/agent-config/commit/a3818db0977034de6f6b56952756522d772c9138))
* **wizard:** restore completed prop on StepNav ([47973e0](https://github.com/event4u-app/agent-config/commit/47973e033d6661c4b431cfe0f6d74eb2be8b98cc))
* **server:** create settings/ dir before atomic write ([041feb6](https://github.com/event4u-app/agent-config/commit/041feb614982bfaa123277d5f9e341405d3abbf6))
* **install:** respect DRY_RUN for mkdir paths ([adf670a](https://github.com/event4u-app/agent-config/commit/adf670a778426eb4fd1046d736652c9c1386b015))
* **wizard:** suppress empty role chip in UserMdForm ([5fe6449](https://github.com/event4u-app/agent-config/commit/5fe6449b9ba96feed06503e2185cb010838d2f70))
* **lint:** skip router_routes_to_missing for trust.level: core rules ([e2286c9](https://github.com/event4u-app/agent-config/commit/e2286c9d5841bc62c9510f82525efab8bd45f4b8))
* **ci:** extend discovery-manifest schema with Phase 5 pack fields ([42eaa9a](https://github.com/event4u-app/agent-config/commit/42eaa9af2f4100afad8bfd6a598f3c3f611328d2))
* **ci:** trim AGENTS.md back under Thin-Root 3000-char hard cap ([a365c15](https://github.com/event4u-app/agent-config/commit/a365c152f6bfbcbd7c4833f3ca68e16f97308ece))
* **ci:** resync engineering-safety-floor compressed mirror ([f5c4c76](https://github.com/event4u-app/agent-config/commit/f5c4c7669036a1e134c20543f0601473924c61ea))
* **ci:** register install-via-agent skill in marketplace.json ([c5702ca](https://github.com/event4u-app/agent-config/commit/c5702ca80e913567a2b538dfd5c02248b678dd8d))
* **ci:** correct install-via-agent schema and broken roadmap refs ([badd132](https://github.com/event4u-app/agent-config/commit/badd1327bc509eb36e8eaf68187eabe53b5c2658))
* **discovery:** mark single-member pack skills as experimental ([2cdf578](https://github.com/event4u-app/agent-config/commit/2cdf578f2fc05b01dbef674c97178f616b1c46ee))
* **ci:** accept nested paths in overlay cascade checker ([373a1fc](https://github.com/event4u-app/agent-config/commit/373a1fca308d631438b838da71dbfc18bcc228ee))

### Performance

* **ci:** consolidate tests.yml node jobs ([5f11044](https://github.com/event4u-app/agent-config/commit/5f11044a93fa618aa6728f8240f61f8224a8794e))
* **ci:** apply dependency caching and concurrency groups ([64fb469](https://github.com/event4u-app/agent-config/commit/64fb4692b58caab696250e95bc8c1cda89c5a16d))

### Documentation

* **telemetry:** add privacy + schema docs ([069fb73](https://github.com/event4u-app/agent-config/commit/069fb73ae6288cd6a44e3b6c150d146a66a6669b))
* **drift:** inventory architectural drift + park conditions for F-2/F-3 ([5c29006](https://github.com/event4u-app/agent-config/commit/5c2900638c54b1e709e655d7a8711fe3b6951276))
* **discovery:** drop phantom marketing-site consumer reference (drift F-5) ([aa90306](https://github.com/event4u-app/agent-config/commit/aa90306cee16ee469dde608329ebdd41e662116d))
* **adr-017:** remove unmaintained split-distribution addendum (drift F-1) ([a375664](https://github.com/event4u-app/agent-config/commit/a375664d2804b5ad2d8f8f75229d89e05c909da6))
* **deploy:** add ADR-021 and deployment guides ([4936927](https://github.com/event4u-app/agent-config/commit/49369276c622aceaebc435957ec6f58767538860))
* **roadmap:** mark Phase 1 done, Phase 2 partial, Phases 3-5 deferred ([6497aa0](https://github.com/event4u-app/agent-config/commit/6497aa0654c1238524e515dc7ec4ebabe7bf82e0))
* **readme:** modernize via readme-writing skill, fix path drift, orange branding ([8f7f164](https://github.com/event4u-app/agent-config/commit/8f7f1647be9e0cdaf00065ff32781c6ead2a8a62))
* **skills:** harden readme-writing toolchain with re-analysis gate + link validation ([33e2160](https://github.com/event4u-app/agent-config/commit/33e216019c04ac987c13857154cfadeaa427c7ec))
* **roadmap:** mark road-to-ai-os-product-ui phase 2 + phase 5 complete ([3cae434](https://github.com/event4u-app/agent-config/commit/3cae43470c4213c8c4cddf0b6a17cc89f5e9a7ee))
* **roadmap:** mark road-to-ai-os-product-ui phases 1/4/5 shipped, 2/3 blocked ([de7855d](https://github.com/event4u-app/agent-config/commit/de7855dcf4f719c6507d4f8c4e8b542aac8fa628))
* **gui-wizard:** document the unified 9-step flow + recovery path ([61c86f8](https://github.com/event4u-app/agent-config/commit/61c86f8cb07f6ca53b53805adbaf28fa7b3eff66))
* **global-only:** ADR-020 accepted + global-only consumer scope (Phase 6) ([9403143](https://github.com/event4u-app/agent-config/commit/9403143dba5cf3393d67f0304d0a62e4078264a9))
* **decisions:** ADR-020 + maintainer dev-mode guide ([e78a992](https://github.com/event4u-app/agent-config/commit/e78a992ef730bf2b7a585fd6a25fc88d20d3b310))
* **roles:** role-based walkthroughs with wizard quickstart + first-win pointers ([9a4b7aa](https://github.com/event4u-app/agent-config/commit/9a4b7aa61515c3bdb2beae59c21a96df1c428ba4))
* **readme:** radical rewrite — GUI wizard quickstart + featured-skills tiering ([77fb42e](https://github.com/event4u-app/agent-config/commit/77fb42e7afc230bbb7270e2eac38379c8d2e0831))
* **roadmaps:** add four strategic roadmaps for the Internal AI OS pivot ([dfa0882](https://github.com/event4u-app/agent-config/commit/dfa088274258c95b0acd5c85ee315925595abbf7))
* **roadmap:** add road-to-global-only-install plan ([6891965](https://github.com/event4u-app/agent-config/commit/6891965102c6204a29c84260220c536af1f0ae01))
* **wizard,installation:** document auto-launch + --no-ui + --dry-run ([79cc9ba](https://github.com/event4u-app/agent-config/commit/79cc9baad92c6ee72fa00ec59d035b5cd5d8b522))
* **gui:** contract + README quick-start + roadmap progress (P6.6/P6.7) ([fa7c230](https://github.com/event4u-app/agent-config/commit/fa7c230e7beab6c9fbe52b9be3b63d227d777302))
* **adr-017:** add optional split-distribution addendum + close Phase 4 ([d06af2c](https://github.com/event4u-app/agent-config/commit/d06af2c5748bad3c41e8df8e5b412302a34547e0))
* **trust-safety:** add ADR-018 + trust-and-safety contract ([6d32a86](https://github.com/event4u-app/agent-config/commit/6d32a866755388da0432d4bf09818ff97aab4f42))
* **agents:** trim AGENTS.md to stay under 95% Augment budget ([3df2b1e](https://github.com/event4u-app/agent-config/commit/3df2b1ee33954057cdbd0a4c4e5e765adc204d95))
* **roadmap:** mark phase 4.3 / 4.4 / 4.5 complete ([c75d5e7](https://github.com/event4u-app/agent-config/commit/c75d5e76f3b5c1411833ece9b90d91f729d8f2f5))
* **monorepo:** update AGENTS.md + onboarding skill for packages layout ([2028ff6](https://github.com/event4u-app/agent-config/commit/2028ff6baf9bd23d623642a2667402b207babc6f))
* **roadmap:** mark Phase 4.1 + 4.2 done (planning + tooling) ([fcced8e](https://github.com/event4u-app/agent-config/commit/fcced8e726774e6b4f56c0ff56359cdb719c3ca7))
* **adr:** add ADR-017 monorepo physical package layout ([60a8637](https://github.com/event4u-app/agent-config/commit/60a8637205300562b12683aa16f9b0814ae86632))
* finalize Phase 6 distribution — README deprecation notice + archive roadmap ([a87f891](https://github.com/event4u-app/agent-config/commit/a87f891eb41afaaeb6df5b76045a00ea2a33529a))
* **adr:** ADR-016 + agent-mode protocol for TypeScript installer ([324ac99](https://github.com/event4u-app/agent-config/commit/324ac99bfc91062dd96b5ed759a67fd2c7b0b71f))
* **agents:** revert AGENTS.md addition to stay within augment budget ([d6c6174](https://github.com/event4u-app/agent-config/commit/d6c617452bc7bf32e6a2fc9f0831a2ed37a418b9))
* **contracts:** declare beta stability for frontmatter-contract ([e0928ff](https://github.com/event4u-app/agent-config/commit/e0928ffaf32c0bef3db62c2dd6825846235cb06e))
* **discovery:** frontmatter contract + ADR-013 update ([f428420](https://github.com/event4u-app/agent-config/commit/f428420906dbc9ff28b88c8658f1428eecfa4a8a))
* **roadmaps:** scaffold six-phase monorepo migration ([293c8af](https://github.com/event4u-app/agent-config/commit/293c8af610c4e9cce6892cee3715fbd49fb4fb1a))

### Refactoring

* **rules:** offload no-cheap-questions prose to cheap-question-mechanics context ([b51a9ae](https://github.com/event4u-app/agent-config/commit/b51a9aec63faa0232b8e5934a421e7a0abb06b8b))
* **router:** move router.json from repo root to dist/router.json ([5567b3c](https://github.com/event4u-app/agent-config/commit/5567b3ce39655b0831d7cb0088e6cf7ba599846b))
* **scripts:** finalize multi-root path resolution across helpers ([5173fb7](https://github.com/event4u-app/agent-config/commit/5173fb7730ef73d76d5c1fc7b9f3c1915b6dbe8d))
* **scripts:** make command-tier linter monorepo-aware ([3eb15b6](https://github.com/event4u-app/agent-config/commit/3eb15b6982413a9898853733d1d1910116b91c28))
* **scripts:** make rule-tier linter monorepo-aware ([dc9b9b3](https://github.com/event4u-app/agent-config/commit/dc9b9b3ad881a62624f83bec5a1b56b2e8420e3e))
* **scripts:** make bench-corpus linter monorepo-aware ([01814a2](https://github.com/event4u-app/agent-config/commit/01814a26d41965865e76cf5f617e6790ff4f0059))
* **scripts:** make archived-skills linter monorepo-aware ([ade1b8e](https://github.com/event4u-app/agent-config/commit/ade1b8ecf3f96582ece3da33cc7ce98c8ad0a53a))
* **scripts:** make frontmatter validator multi-root aware ([f6d09e9](https://github.com/event4u-app/agent-config/commit/f6d09e9a2b76edba5ff5a9efc0ec78e309a476fe))
* **scripts:** make reply-consistency scanner multi-root aware ([c1b0342](https://github.com/event4u-app/agent-config/commit/c1b03424629862aab2318799686630f3db379d2a))
* **scripts:** make ownership-matrix generator multi-root aware ([e431b48](https://github.com/event4u-app/agent-config/commit/e431b484d4bbc2391e039d57ade8372bbf08939f))
* **scripts:** make council-references checker multi-root aware ([7d7a21e](https://github.com/event4u-app/agent-config/commit/7d7a21e7234191ce194509e60f7504c47ba147fa))
* **scripts:** make rule-interactions linter multi-root aware ([9e0a2c5](https://github.com/event4u-app/agent-config/commit/9e0a2c53aada39fc296bd367de5112f08368f41a))
* **scripts:** make cluster-pattern checker multi-root aware ([b2edad6](https://github.com/event4u-app/agent-config/commit/b2edad627c7298a6375bf8f7697c7970c2f7f3a6))
* **scripts:** make framework-leakage linter multi-root aware ([3a6f6c8](https://github.com/event4u-app/agent-config/commit/3a6f6c88b2b0337851691c88b4c24e5cda35a1ad))
* **scripts:** make smoke-quickstart multi-root aware ([5105965](https://github.com/event4u-app/agent-config/commit/5105965fbb3f31d8812cbe2b6ffb9a01b31549fc))
* **scripts:** make decision-engine validator multi-root aware ([38d1265](https://github.com/event4u-app/agent-config/commit/38d1265e0d2f89f9132d5bfdc0420a27a4b238b0))
* **scripts:** make token-optimizer freshness gate multi-root aware ([88e9ae5](https://github.com/event4u-app/agent-config/commit/88e9ae5cb5e73063387e2714f33a259121bb463d))
* **scripts:** make template-pin-drift gate multi-root aware ([ec6090a](https://github.com/event4u-app/agent-config/commit/ec6090a5625bb9ab2d7318635e0fa1269895dd63))
* **scripts:** make generate_index.py multi-root aware ([ef0e690](https://github.com/event4u-app/agent-config/commit/ef0e690d8c906102ea08b584fea74a53c985f67d))
* **scripts:** make router/linter/budget/smokes multi-root aware ([53ec5bf](https://github.com/event4u-app/agent-config/commit/53ec5bf7312e695cae83e298141b9ce06518d72e))
* **scripts:** make command-count gate multi-root aware ([bee1f28](https://github.com/event4u-app/agent-config/commit/bee1f284a22b5e6872d9bb4736c611f639f25eaa))
* **scripts:** map unassigned overrides + stale-hash check to physical paths ([27d881f](https://github.com/event4u-app/agent-config/commit/27d881ffc814295c607376e322c339733c8e7b7b))
* **scripts:** multi-root awareness for compress + counts + discovery ([9ebaf5f](https://github.com/event4u-app/agent-config/commit/9ebaf5f6ed2597537f47143500d32bce3bb063a8))

### Tests

* **installer-gui:** cover GET /api/v1/explain/last endpoint ([0da4423](https://github.com/event4u-app/agent-config/commit/0da442337288d376c382c01f24cc89924490b314))
* **installer-gui:** cover task + council api endpoints ([8a0837c](https://github.com/event4u-app/agent-config/commit/8a0837c23d977f49023d6de4fed1e9b9e650fd5a))
* **e2e:** Playwright spec for the unified 9-step wizard dry-run ([6911be8](https://github.com/event4u-app/agent-config/commit/6911be8f6330a498cfc1bd2b68bb1e33353c96e5))
* align suites with settings/ subdir and identity JSON wire format ([e69c827](https://github.com/event4u-app/agent-config/commit/e69c82747c2b9046697f07372eaed25b590d7336))
* **wizard:** cover first-run 404 path + add verify-before-complete override ([d03b506](https://github.com/event4u-app/agent-config/commit/d03b506cb085d424f0c9d815f64398aee0203fc7))
* make test suite monorepo/multi-root aware ([c864dcd](https://github.com/event4u-app/agent-config/commit/c864dcd443483e37fb68e89cbb10e149ae6fa4d6))
* **discovery:** cover artefact frontmatter linter and round-trip ([4ac95d7](https://github.com/event4u-app/agent-config/commit/4ac95d7b633f47261537d76d733c0fb56095ae31))

### CI

* **smoke:** force UTF-8 stdout on Windows legs ([f321211](https://github.com/event4u-app/agent-config/commit/f32121146d682d18dda0b7684a19c8f50ab40973))
* add cross-platform public install smoke matrix ([9041643](https://github.com/event4u-app/agent-config/commit/904164307e6fcd758c01679f3d4eba8e70a4c95b))
* **migration:** add Phase 4 dry-run workflow + Taskfile bindings ([b6374e6](https://github.com/event4u-app/agent-config/commit/b6374e67eedc9d062856ee6d1c3bf25a367e3b6f))
* **installer:** wire TypeScript installer into CI pipeline (ADR-016 § 1) ([b139752](https://github.com/event4u-app/agent-config/commit/b139752e7cdc6e672411e38dc315c46f66313f79))
* **publish-npm:** install jsonschema for discovery manifest lint ([419521e](https://github.com/event4u-app/agent-config/commit/419521e5a1f284af12f2a1458c6dccd6bcf8de83))

### Chores

* **roadmap:** archive completed roadmaps, regenerate dashboard ([eb77305](https://github.com/event4u-app/agent-config/commit/eb77305ab38222cfcee1239ea722967e09d2d77e))
* **roadmap:** mark Phase 5 (architectural drift audit) complete ([386ee69](https://github.com/event4u-app/agent-config/commit/386ee69c38260686000aeba166a704eeadd71743))
* **roadmap:** mark Phase 1 shipped, defer Phases 2-5 ([de84377](https://github.com/event4u-app/agent-config/commit/de84377f1e0b6ba1f07a0b69140483ab9a8dc8f6))
* update readme ([0249f87](https://github.com/event4u-app/agent-config/commit/0249f87f74150bc3e4010368537e4b22d872bf06))
* **ownership:** regenerate file-ownership-matrix for context split ([f0b50bb](https://github.com/event4u-app/agent-config/commit/f0b50bb4505361ca6ab953aee6e7ab77136dd77c))
* **ci:** drop obsolete README prose checks from command-count gate ([8b3e4c9](https://github.com/event4u-app/agent-config/commit/8b3e4c925659fd0074db296c6b1ad53555b313ae))
* **roadmap:** archive road-to-global-only-install at 100% ([e3b3555](https://github.com/event4u-app/agent-config/commit/e3b355526371b44b82dec515a099643fc9617947))
* **roadmap:** flip 1.6 / 1.7 / 1.10; defer 1.5 / 1.8 / 1.9; regen dashboard ([6c3c1b4](https://github.com/event4u-app/agent-config/commit/6c3c1b4cf39c7705d7dca47d30b6d2999ef25106))
* **roadmap:** mark Phases 4–6 complete on road-to-global-only-install ([0d6cc0e](https://github.com/event4u-app/agent-config/commit/0d6cc0e94d8a74f6473991cbdb505a049658d35a))
* **roadmap:** mark Phase 2.3 + 3.1 + 3.3-3.5 done (12/24) ([3ca72d3](https://github.com/event4u-app/agent-config/commit/3ca72d3957ad2f23614122b4a42d86ef3fdfcc07))
* **roadmap:** mark Phase 1.1-1.4 + 2.1 + 2.2 (Python) + 3.2 done ([4b7850b](https://github.com/event4u-app/agent-config/commit/4b7850b57d95e27dcdee1b9034906bda6b837336))
* **roadmap:** mark road-to-global-only-install foundation done (6/24) ([3a9f3bb](https://github.com/event4u-app/agent-config/commit/3a9f3bbecca0a118fd345f5fc9c93005474ea03f))
* **roadmap:** archive road-to-role-first-onboarding (100% complete) ([9c2bd71](https://github.com/event4u-app/agent-config/commit/9c2bd715f615a295142b00e9dcc16d83e7ae047e))
* **ci:** add README, featured-skills, and pack first-win linters ([76473c9](https://github.com/event4u-app/agent-config/commit/76473c9fbc3ceb5301948ba183a157cf24a5302e))
* regenerate ownership matrix ([685d0aa](https://github.com/event4u-app/agent-config/commit/685d0aa96b6a20f848a59342cb65cf5ed42bdd52))
* finalize ([6f1929c](https://github.com/event4u-app/agent-config/commit/6f1929ccd35de2e7903785144fca90739a6c6361))
* **index:** regenerate agents/index.md and docs/catalog.md ([d637396](https://github.com/event4u-app/agent-config/commit/d637396ab47ebf8f3c70c298f841f68811852c1c))
* fix tests ([6a29ad9](https://github.com/event4u-app/agent-config/commit/6a29ad98827792947c24fe0e6a6b9a26246d6180))
* fix roadmap ([2e3255f](https://github.com/event4u-app/agent-config/commit/2e3255f726e2b3bd1bea0e40cab45926448301d8))
* ignore agents/state/ wizard runtime snapshot ([d39cf4f](https://github.com/event4u-app/agent-config/commit/d39cf4f316483176af1321c670e8aa0d9d334b53))
* move .ai-video.xml.example to agents/templates/ ([33661b9](https://github.com/event4u-app/agent-config/commit/33661b9e49559fd0f842de8ff636e5c1b0ff8933))
* **roadmap:** archive wizard-install-py-wiring (shipped 2026-05-22) ([04935dd](https://github.com/event4u-app/agent-config/commit/04935dd2b5833fb53afbe922015cac779feed8bb))
* **roadmap:** archive implementation-sequence.md (phases 1-6 complete) ([46ad4b1](https://github.com/event4u-app/agent-config/commit/46ad4b18a4fc7a855bb87aff6a71c03d266be6af))
* **roadmap:** sync Phase 6 checkboxes + regen dashboard (30/35 done) ([69bc787](https://github.com/event4u-app/agent-config/commit/69bc787d516f7b45fc247c3b29f80f283946301e))
* **roadmap:** mark monorepo-phase-5 complete ([41a68e9](https://github.com/event4u-app/agent-config/commit/41a68e9bb88ad052257bf53048c678e4dc88ec02))
* **sync:** regenerate .agent-src/ orchestration.py template ([84d21c4](https://github.com/event4u-app/agent-config/commit/84d21c49d15036db5639557a38c649289d3bb6a6))
* **contracts:** regenerate mcp-tool-inventory.md line refs ([6726203](https://github.com/event4u-app/agent-config/commit/67262039c82003c7a03f5ba6b3d9d1eafa070d7b))
* **migration:** physical move of ~700 artefacts to packages/ layout ([9f62fd2](https://github.com/event4u-app/agent-config/commit/9f62fd2e9ca8fd3b0126a35a7a040ce366bfd710))
* **claude:** commit projected install-via-agent skill ([84676d4](https://github.com/event4u-app/agent-config/commit/84676d4726e342a6087a11b2665eb252bafd222c))
* **counts:** bump command count to 129 (install-via-agent landed) ([6593f1c](https://github.com/event4u-app/agent-config/commit/6593f1c6c23ad926a00e782fa4f0d0e0691adbc8))
* **roadmap:** mark monorepo-phase-3 steps done and refresh dashboard ([c3d9054](https://github.com/event4u-app/agent-config/commit/c3d9054efd9d3d95bbd3621e24e4e88a7310ea81))
* **sync:** project install-via-agent command and refresh counts ([b80cff4](https://github.com/event4u-app/agent-config/commit/b80cff4f7067f78c2735efd0e274b2dd6af678ca))
* **deps:** add @inquirer/prompts for installer TUI ([2dad093](https://github.com/event4u-app/agent-config/commit/2dad0934693f95a9bdaad381805e56e8621eefc8))
* **roadmap:** archive monorepo-phase-2 and regenerate dashboard ([649200e](https://github.com/event4u-app/agent-config/commit/649200ea60b03f52043da141b6a52388711b3a34))
* **discovery:** fix beta-review window to 90-day max (2026-08-19) ([b1c6d77](https://github.com/event4u-app/agent-config/commit/b1c6d77f84907e16900a88647998167ed182e238))
* **templates:** bump agent_config_version pin to 3.0.0 ([f96a2dd](https://github.com/event4u-app/agent-config/commit/f96a2dd56bacea17d933f8e9052d49fa0322fadb))
* **roadmaps:** archive Phase 1, silence Phase 3 forward refs ([a732b9c](https://github.com/event4u-app/agent-config/commit/a732b9c427fa6c0d0691cc00071d58854639f9d5))

Tests: 4839 (+142 since 3.0.0)
