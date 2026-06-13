# Changelog Archive — pre-2.25.0

> Frozen snapshot of `event4u/agent-config` changelog entries from
> `2.20.0` through `2.24.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-19 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 2.25.x".
> Entries here are not amended — git tags `2.20.0` through `2.24.0`
> remain the canonical sources for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-2.20.0.md`](CHANGELOG-pre-2.20.0.md),
> [`CHANGELOG-pre-2.17.0.md`](CHANGELOG-pre-2.17.0.md),
> [`CHANGELOG-pre-2.16.0.md`](CHANGELOG-pre-2.16.0.md),
> [`CHANGELOG-pre-2.15.0.md`](CHANGELOG-pre-2.15.0.md),
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [2.24.0](https://github.com/event4u-app/agent-config/compare/2.23.0...2.24.0) (2026-05-17)

### Features

* **settings:** add quality.local_auto_run / wait_for_remote_ci ([a463bf1](https://github.com/event4u-app/agent-config/commit/a463bf1925a7fb192707a80c696740ba73c30ff9))
* **ai-video:** banana-arc reference project + shared prompt library ([f3afc6d](https://github.com/event4u-app/agent-config/commit/f3afc6dddff8d70cc17572d43a4839a157d62296))
* **ai-video:** /video:* command cluster (from-script, scene, storyboard, stitch) ([272f2ec](https://github.com/event4u-app/agent-config/commit/272f2ec82539e58a0b8d14c63bf0806618d88c88))
* **ai-video:** 3 specialist personas (hollywood-director, pixar-storyboard-artist, ai-video-technical-director) ([b16fb50](https://github.com/event4u-app/agent-config/commit/b16fb50c47336da6d0ad6d3864f9aaf489f91f68))
* **ai-video:** 5 specialist skills + scene-blueprint schema ([b77ecd9](https://github.com/event4u-app/agent-config/commit/b77ecd9df6d894826f172739d534db54969f9818))
* **ai-video:** adapter contract + 5 provider adapters + smoke test ([b86f1e5](https://github.com/event4u-app/agent-config/commit/b86f1e53661d6ff0e2a7154eee0136fe77ed6d24))

### Bug Fixes

* **schema:** trim ai-video-technical-director persona description to 148 chars ([b1afbb1](https://github.com/event4u-app/agent-config/commit/b1afbb1d8d94b62cb49e306d104ae33d84d06f09))

### Chores

* **ai-video:** wire pipeline into docs, ownership, schemas, marketplace ([18a98fa](https://github.com/event4u-app/agent-config/commit/18a98fa9098d9cc7a07782e9a6a07cf47e63d842))
* move council audit ([54074f1](https://github.com/event4u-app/agent-config/commit/54074f18db69682f656719b4de231ea8b1cbd152))

Tests: 4569 (+10 since 2.23.0)

## [2.23.0](https://github.com/event4u-app/agent-config/compare/2.21.0...2.23.0) (2026-05-17)

### Features

* integrate anti-AI-slop heuristics into design skills ([f157d02](https://github.com/event4u-app/agent-config/commit/f157d02e56aa4abe139eaf042ad060de4815f36b))
* add Honest Sparring Partner template and adversarial-review trigger ([122f0ad](https://github.com/event4u-app/agent-config/commit/122f0adfd3b6a334b1191e9fa58e6b3328c77365))
* **skills:** refine-prompt + prompt-optimizer honor prompt_optimization setting ([9f8f20e](https://github.com/event4u-app/agent-config/commit/9f8f20e11627342c1e656d978d7a82ea30925cf3))
* **settings:** add prompt_optimization block (off/mini/max, /raw bypass) ([c6d3715](https://github.com/event4u-app/agent-config/commit/c6d371510979d044e5724d5ed2d390be0af24562))

### Bug Fixes

* **refs:** suppress allowed council-ref links with ADR-decision-trace markers ([053bf9a](https://github.com/event4u-app/agent-config/commit/053bf9ae9c17a470f3838e989c597d66a24ac556))
* **template:** bump agent_config_version pin to 2.21.0 ([58cc67f](https://github.com/event4u-app/agent-config/commit/58cc67f9eb4c7a3ca9b1adddbfdbefbbfe80fa3b))

### Documentation

* **guidelines:** add prompt-templates.md (12-template catalogue) ([ec91b31](https://github.com/event4u-app/agent-config/commit/ec91b31d71d7169f2aef6184d5e5f8d01b237f9b))
* **roadmap:** close out step-16-telegraph-substance (38/38, kill-criterion deferred) ([7a60f1e](https://github.com/event4u-app/agent-config/commit/7a60f1eddd66dfdf54bc2664b45c97954eb2b7e3))

### Chores

* **index:** regenerate agents/index.md + docs/catalog.md for new guideline ([f7b47e8](https://github.com/event4u-app/agent-config/commit/f7b47e870042abb3a33d26edb0caf9d0529c7828))
* **changelog:** split era 2.17.x → pre-2.20.0 ([c842766](https://github.com/event4u-app/agent-config/commit/c8427660de6914505edf1a3d21c05ba2313ffbb7))

### Other

* 2.22.0 ([52aa59a](https://github.com/event4u-app/agent-config/commit/52aa59a40cf12146275c3e2a19f149703c585eae))

Tests: 4559 (+0 since 2.21.0)

## [2.22.0](https://github.com/event4u-app/agent-config/compare/2.21.0...2.22.0) (2026-05-17)

### Features

* integrate anti-AI-slop heuristics into design skills ([f157d02](https://github.com/event4u-app/agent-config/commit/f157d02e56aa4abe139eaf042ad060de4815f36b))
* add Honest Sparring Partner template and adversarial-review trigger ([122f0ad](https://github.com/event4u-app/agent-config/commit/122f0adfd3b6a334b1191e9fa58e6b3328c77365))
* **skills:** refine-prompt + prompt-optimizer honor prompt_optimization setting ([9f8f20e](https://github.com/event4u-app/agent-config/commit/9f8f20e11627342c1e656d978d7a82ea30925cf3))
* **settings:** add prompt_optimization block (off/mini/max, /raw bypass) ([c6d3715](https://github.com/event4u-app/agent-config/commit/c6d371510979d044e5724d5ed2d390be0af24562))

### Bug Fixes

* **refs:** suppress allowed council-ref links with ADR-decision-trace markers ([053bf9a](https://github.com/event4u-app/agent-config/commit/053bf9ae9c17a470f3838e989c597d66a24ac556))
* **template:** bump agent_config_version pin to 2.21.0 ([58cc67f](https://github.com/event4u-app/agent-config/commit/58cc67f9eb4c7a3ca9b1adddbfdbefbbfe80fa3b))

### Documentation

* **guidelines:** add prompt-templates.md (12-template catalogue) ([ec91b31](https://github.com/event4u-app/agent-config/commit/ec91b31d71d7169f2aef6184d5e5f8d01b237f9b))
* **roadmap:** close out step-16-telegraph-substance (38/38, kill-criterion deferred) ([7a60f1e](https://github.com/event4u-app/agent-config/commit/7a60f1eddd66dfdf54bc2664b45c97954eb2b7e3))

### Chores

* **index:** regenerate agents/index.md + docs/catalog.md for new guideline ([f7b47e8](https://github.com/event4u-app/agent-config/commit/f7b47e870042abb3a33d26edb0caf9d0529c7828))
* **changelog:** split era 2.17.x → pre-2.20.0 ([c842766](https://github.com/event4u-app/agent-config/commit/c8427660de6914505edf1a3d21c05ba2313ffbb7))

Tests: 4559 (+0 since 2.21.0)

## [2.21.0](https://github.com/event4u-app/agent-config/compare/2.20.1...2.21.0) (2026-05-17)

### Features

* **telemetry:** telegraph stats + per-conversation cost lens ([13300cc](https://github.com/event4u-app/agent-config/commit/13300cc2d709ec2cce58520621cf560fbd6414c3))
* **memory:** input-side condensation for always-loaded files ([abfd5b1](https://github.com/event4u-app/agent-config/commit/abfd5b120f2effd2abd68adea45c8b15f315dfec))
* **bench:** add telegraph v1 benchmark with terse-control arm ([1e37062](https://github.com/event4u-app/agent-config/commit/1e37062cada6f9be5bfa0dfe4083753ade87f2f2))
* **security:** add safe-paths denylist and telegraph carve-outs validators ([249114d](https://github.com/event4u-app/agent-config/commit/249114d900a9d6960aee7bbeda5c28f85be718ad))

### Bug Fixes

* **telegraph-speak:** bullet-format prose lines to satisfy structural-density lock ([5c8006d](https://github.com/event4u-app/agent-config/commit/5c8006d8bd70fea93671361160e6b7c4399302c6))
* **refs:** inline roadmap council citations + mark contract council-refs as ADR trace ([5a11951](https://github.com/event4u-app/agent-config/commit/5a11951ebff87ba95465c0a6b9b59fd9a4d4cee2))
* **contracts:** drop roadmap reference from condensation-default-kill-criterion ([f2b2124](https://github.com/event4u-app/agent-config/commit/f2b212495744dae1904b256aa11d47e230e7b534))
* **contracts:** add stability frontmatter to telegraph-telemetry + cost-summary-schema ([c7efa54](https://github.com/event4u-app/agent-config/commit/c7efa54cc3587f42f3a21ca18b783b5504c56e04))
* **portability:** apply task-invocation fix in dist/agent-src/ projection ([be87c2b](https://github.com/event4u-app/agent-config/commit/be87c2be1637570a61b7a8863216288f3828609c))
* **portability:** swap task invocations for script paths in condense-memory skill ([886f9f4](https://github.com/event4u-app/agent-config/commit/886f9f4a615fa2351b9261a62fd49173f8e87c2f))
* **roadmap:** clarify agent-status is a command not a skill in step-16 ([96df39d](https://github.com/event4u-app/agent-config/commit/96df39de7a7562df946c37fea8bc42927851071f))
* **template:** bump agent_config_version pin to 2.20.1 ([c275864](https://github.com/event4u-app/agent-config/commit/c2758641718077baaaaefea1191760d397f6b47e))

### Documentation

* **readme:** compact banner and badge row to stay under 750-line lint budget ([2f411a7](https://github.com/event4u-app/agent-config/commit/2f411a78993260d3bd1f5fb819779cad2b19ed07))
* **readme:** add hero banner and migrate count display to shields.io badges ([980fe1a](https://github.com/event4u-app/agent-config/commit/980fe1ac1c529e3c57c967db148f2b162240ff27))
* **telegraph:** v1 kill-criterion verdict + Suspended state ([ca1751e](https://github.com/event4u-app/agent-config/commit/ca1751e8957783fa4e40ddfb89172702619f12bc))

### Chores

* **ownership:** regenerate ownership matrix ([1331bce](https://github.com/event4u-app/agent-config/commit/1331bce63d223adb971a931babe5e163b5a8aa12))
* **index:** regenerate agents/index.md + docs/catalog.md for condense-memory ([6d16e7f](https://github.com/event4u-app/agent-config/commit/6d16e7fb3ca0a2fbe76a18337a94e98607262d06))
* **sync:** bump skill count 210 -> 211 (condense-memory) ([bb361ed](https://github.com/event4u-app/agent-config/commit/bb361edb4e5e65cbc4e7eb41382f88f1909e5583))
* **roadmaps:** close step-16 telegraph-substance + archive-phantom-scan ([9388f9b](https://github.com/event4u-app/agent-config/commit/9388f9be662da17b98eb4000f16ff8fcf376e626))

Tests: 4559 (+24 since 2.20.1)

## [2.20.1](https://github.com/event4u-app/agent-config/compare/2.20.0...2.20.1) (2026-05-16)

### Bug Fixes

* **lint:** treat zero active roadmaps as pass in lint-roadmap-complexity ([ff814e2](https://github.com/event4u-app/agent-config/commit/ff814e262a25b9269ae5d1b66495602b5d8f457b))
* **template:** bump agent_config_version pin to 2.20.0 ([ab3acfc](https://github.com/event4u-app/agent-config/commit/ab3acfc3eebd39e5fb7df919bd5b7a455e2f58ea))

### Chores

* **changelog:** split era 2.16.x → pre-2.17.0 ([67b668e](https://github.com/event4u-app/agent-config/commit/67b668ee2298cc56478a808a716e965482bf199d))
* **roadmaps:** close and archive all 8 open roadmaps (Total Dominance) ([c13359f](https://github.com/event4u-app/agent-config/commit/c13359f0b676f251a9b6c6b7ed11804fdeb84257))

Tests: 4535 (+0 since 2.20.0)

## [2.20.0](https://github.com/event4u-app/agent-config/compare/2.19.0...2.20.0) (2026-05-16)

### Features

* **product:** step-15 product refinement — profiles + packs + presets + explain CLI ([59e7d6f](https://github.com/event4u-app/agent-config/commit/59e7d6f3ddce025e558da08c1da1b4c8155e68eb))
* **parity:** step-11 external parity — smoke + ADR + cost + namespace + MCP ([521b4c6](https://github.com/event4u-app/agent-config/commit/521b4c62f5fe266f5c18dfcca2abf4e06d97c217))
* **telegraph:** step-10 default-kill criterion + parity roadmap ([dd7ec3c](https://github.com/event4u-app/agent-config/commit/dd7ec3cae4f8839b28b4d3ff9dbdbb316ec5d035))
* **bench:** step-4 measurement + benchmark infrastructure ([981d0cd](https://github.com/event4u-app/agent-config/commit/981d0cd1c48e2d23eede29bd86e833cd826ddfd9))
* **skills:** step-2 skill inventory rationalization ([3fa651d](https://github.com/event4u-app/agent-config/commit/3fa651d2496e4fc483cd7ed452bb39f41dd39365))

### Bug Fixes

* **adr-create:** restore Inspect keyword in step-1 heading ([46c40ad](https://github.com/event4u-app/agent-config/commit/46c40adf4741f1e13d8d275f9363f98047d4b733))
* **audit_mcp_tools:** drop roadmap link from generated inventory ([d35459e](https://github.com/event4u-app/agent-config/commit/d35459e94d9be473bbb567f7c348be5bff4b5e9d))
* **audit_mcp_tools:** emit stability frontmatter in generated inventory ([ba7af12](https://github.com/event4u-app/agent-config/commit/ba7af12cf26509f2ea0ddb867303f3b225fea866))
* **no-cheap-questions:** trim to clear concentration cap ([3516283](https://github.com/event4u-app/agent-config/commit/351628301aa168c31130b62ee306858944ecf9f2))
* **onboard:** move recommendation off inline (recommended) tag ([6a77a06](https://github.com/event4u-app/agent-config/commit/6a77a06c014d8820662906ca6ab0ee55ac847e05))
* **refs:** suppress legitimate council-response audit links ([d764329](https://github.com/event4u-app/agent-config/commit/d764329d8718124d150deafcce52bdd206ada740))
* **contracts:** drop roadmap-file links from stable artefacts ([96ea60f](https://github.com/event4u-app/agent-config/commit/96ea60f8f6e85c6ce04e8042d9d2535938f75d9f))
* **contracts:** bring beta-review markers into the 90-day window ([4be4a47](https://github.com/event4u-app/agent-config/commit/4be4a47cc30532fa20d1ea7c3311d7eaa154d7e6))
* **contracts:** add stability frontmatter to 6 new contracts ([8b27577](https://github.com/event4u-app/agent-config/commit/8b27577bc6b4b28c36ccfbea48b4e92e35372fbd))
* **portability:** replace task cost:* with direct script invocations ([0225f60](https://github.com/event4u-app/agent-config/commit/0225f60d0157edf4b4f74fe8fc1266295d5b90f2))
* **rules:** restore no-cheap-questions Iron Law block ([e95315f](https://github.com/event4u-app/agent-config/commit/e95315f96323d1ef32328b1c8a630b5aacafee84))

### Documentation

* **readme:** restore three-audience headings, tighten user-types blurb ([fdb03bf](https://github.com/event4u-app/agent-config/commit/fdb03bf314acb1a7a570400c1ba3cadb8098b943))
* **readme:** restore browse-all-commands canonical line ([d91f6e0](https://github.com/event4u-app/agent-config/commit/d91f6e0d99230792f570b02fab6a1b30a744187c))
* **readme:** extract profile detail + featured commands to /docs ([e8745f3](https://github.com/event4u-app/agent-config/commit/e8745f33f1da089aefd763cc659be4568177dd07))
* **roadmap:** regenerate dashboard + cross-roadmap link refresh ([f6b7085](https://github.com/event4u-app/agent-config/commit/f6b7085d3419f1a8b57daf9b949bd55312c17b9b))
* **roadmap:** step-5 schema rigor + test cleanup ([b043230](https://github.com/event4u-app/agent-config/commit/b043230291222f6d6287d73e0807ea772e227e98))

### Chores

* **changelog:** split era 2.15.x → pre-2.16.0 ([88b81ba](https://github.com/event4u-app/agent-config/commit/88b81bac54ae5f9558a1087c81d453c47d3039bb))
* **mcp:** regenerate MCP tool inventory ([bce3169](https://github.com/event4u-app/agent-config/commit/bce3169b353c2d240df610e4bf01c91c96d23e0d))
* **ownership:** regenerate ownership matrix after no-cheap-questions trim ([dbe58a9](https://github.com/event4u-app/agent-config/commit/dbe58a9dfafbca487f11b2501b1f1dabb1053a8d))
* **template:** bump agent_config_version pin to 2.19.0 ([cfc4c59](https://github.com/event4u-app/agent-config/commit/cfc4c59e288862eccf4e7b9d215adf30e527f5a0))
* **build:** wire step-2/4/11/15 tooling into Taskfile + gitignore ([0acc9e7](https://github.com/event4u-app/agent-config/commit/0acc9e77515e611eb685c58aeba91f3d5af9423f))

Tests: 4535 (+42 since 2.19.0)
