# Changelog Archive — pre-2.15.0

> Frozen snapshot of `event4u/agent-config` changelog entries from
> `2.14.0` and earlier (back to `2.11.0`), split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-15 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 2.15.x".
> Entries here are not amended — git tags `2.14.0` and prior remain the
> canonical source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [2.14.0](https://github.com/event4u-app/agent-config/compare/2.13.0...2.14.0) (2026-05-15)

### Features

* **ai-council:** switch low-impact corpus runtime to YAML lockfile ([c8a4b9c](https://github.com/event4u-app/agent-config/commit/c8a4b9c318f3b0c04b6fcd974790ba2bc2623554))
* **ai-council:** add corpus YAML compiler and lockfile ([50ffcb8](https://github.com/event4u-app/agent-config/commit/50ffcb809d633aeb760ea0865a90208be431de43))
* **council:** wire confidence gate into solo dispatch + shadow log ([fcd19d7](https://github.com/event4u-app/agent-config/commit/fcd19d7bd6e12b2c198ec2f3771da5c8c562cd17))
* **council:** add confidence_gate heuristics module ([acee171](https://github.com/event4u-app/agent-config/commit/acee17182770a7aa31574669b1f74b269ae34c27))
* **council:** add solo_confidence_floor config knob + Iron Law lock ([2afef0b](https://github.com/event4u-app/agent-config/commit/2afef0b8d853298be6b73da57bb53415acac798d))
* **audit:** --iron-law flag scans for validator bypasses (step-9 phase 11) ([2e0ef55](https://github.com/event4u-app/agent-config/commit/2e0ef55d625b60ef073b74e9a91a40478e6ff1e3))
* **ai-council:** airgap detection + installer first-run hook (step-9 phase 11) ([d528d88](https://github.com/event4u-app/agent-config/commit/d528d8832fba6893f52bad587365019016f060aa))
* **ai-council:** shadow-mode logger + shadow-report CLI (step-9 phase 10) ([052ed1f](https://github.com/event4u-app/agent-config/commit/052ed1f0355fb35277f80d1193cf912d3943753a))
* **ai-council:** solo-member dispatch via routing fallback chain ([4cf5738](https://github.com/event4u-app/agent-config/commit/4cf5738c209e5fc6ce3c7681112d4f3b4bb89ce9))
* **ai-council:** config schema for solo dispatch + Iron Law (step-9 phase 8) ([779f302](https://github.com/event4u-app/agent-config/commit/779f3025f3f78b1b275ce1ffb9364ae970d18424))
* **low-impact:** preview builder for learn-low-impact (step-9 phase 7) ([234647c](https://github.com/event4u-app/agent-config/commit/234647c81336aa30aac648774e0d2fa0416e8dcf))
* **low_impact:** emit normative fast-path markers per Iron-Law rule ([95b528b](https://github.com/event4u-app/agent-config/commit/95b528ba7dc1ec445c52cbe1844846612afd3d79))
* **rules:** add fast-path-marker-visibility Iron-Law rule ([82d97c2](https://github.com/event4u-app/agent-config/commit/82d97c206a5b439d535f1cac7777be82ff51269d))
* **council:** opt-in fuzzy corpus matching with safety vetoes (step-9 P5) ([903b9f1](https://github.com/event4u-app/agent-config/commit/903b9f1f244ee72f6e01ebdc4e8f3be51c76ef23))
* **council:** harden low-impact corpus parser with typed errors (step-9 P4) ([6e56737](https://github.com/event4u-app/agent-config/commit/6e567375ef8c379ec1696d5f35c41804276f6bbf))
* **doctor:** add council-cli health check (step-9 P3) ([fcb36f5](https://github.com/event4u-app/agent-config/commit/fcb36f584df423613d353c2119a13e842b52117d))
* **council:** surface CLI install hints when binary missing (step-9 phase 2) ([2507eea](https://github.com/event4u-app/agent-config/commit/2507eea06d8739bfffe1a036b284f6459ee329e4))
* **council:** persistent events log with privacy floor (step-8 phase 3) ([e2b30de](https://github.com/event4u-app/agent-config/commit/e2b30de6811b8affedf87c938f32d27d527222d0))
* **council:** necessity tier split with warn-only default (step-8 phase 2) ([3837299](https://github.com/event4u-app/agent-config/commit/3837299194ae20e09ab076e55f824d596815f1d7))
* **council:** add CLI quota observability (step-8 phase 1) ([c17d29b](https://github.com/event4u-app/agent-config/commit/c17d29b1ef4113f032ab492a6862aca624c45f48))
* **council:** enforce canonical output paths at runtime ([9fa50c4](https://github.com/event4u-app/agent-config/commit/9fa50c4d6ea759dd38ff32dbb114163037979b75))
* **ai-council:** Phase 12 — low-impact decisions corpus ([d82509b](https://github.com/event4u-app/agent-config/commit/d82509bcc91dc4de519a080e44f5aa296de34d5e))
* **ai-council:** Phase 11 — replay engine + Lightweight-QA fast-path ([8fa5da8](https://github.com/event4u-app/agent-config/commit/8fa5da8b5de982b93c4608c38d95f64ad60c048b))
* **ai-council:** Phase 10 — impact-based decision routing + cost disclosure ([5dbe837](https://github.com/event4u-app/agent-config/commit/5dbe83743e782351f5eea54a86071b4414208976))
* **ai-council:** Phase 8-9 — necessity classifier with corpus consultation ([5adfe71](https://github.com/event4u-app/agent-config/commit/5adfe7190f0c379a07c1e51ebe634a7f439ec79b))
* **ai-council:** Phase 5 — session-trail + negative-test backfill ([dd64874](https://github.com/event4u-app/agent-config/commit/dd648744a5cd3fc3b516851704d943d9625602de))
* **ai-council:** wire XAI + Perplexity community CLI transports ([4df827c](https://github.com/event4u-app/agent-config/commit/4df827c80c9b6bf51ff41e4e56844c9263dab281))
* **ai-council:** phase 3 — Codex + Gemini CLI clients wired ([16dd7fe](https://github.com/event4u-app/agent-config/commit/16dd7fe987b685c290d2be2f7594f514979db1fd))
* **ai-council:** phase 2 — wire AnthropicCliClient end-to-end ([e965ab1](https://github.com/event4u-app/agent-config/commit/e965ab1cf67d5f18b64bafd7370d4ee7d70124af))
* **ai-council:** phase 1 — CliClient + AnthropicCliClient + daily quota ([df0d88c](https://github.com/event4u-app/agent-config/commit/df0d88c686c02f1e45707787ae196ac7e8371ef6))
* **ai-council:** phase 0 — extend schema for CLI transport ([cb45344](https://github.com/event4u-app/agent-config/commit/cb45344e6e686af430677a61c2026e972f1bfe45))
* **readme:** add Personas and Advisors to hero badge ([f11b85e](https://github.com/event4u-app/agent-config/commit/f11b85ea82fd0f0a04b68d18444d4a8c73d86de1))

### Bug Fixes

* **council:** allowlist audit-* dirs in layout linter ([09d6900](https://github.com/event4u-app/agent-config/commit/09d69003204c2a86a2cc9f1193b8c33145d856b4))
* **rules:** align validator_ignore reason between source and projection ([89b7fac](https://github.com/event4u-app/agent-config/commit/89b7facf48d2a4fe39558028bdf15ff40d98c59a))
* **rules:** allowlist .agent-src.uncompressed/ back-pointer in fast-path-marker ([e74383b](https://github.com/event4u-app/agent-config/commit/e74383b62253ab990e938d1dfdc631d20db94181))
* **ask-when-uncertain:** trim AI Council prose to clear 12% concentration cap ([59abb4a](https://github.com/event4u-app/agent-config/commit/59abb4a3f827b4f8ecb24b63568b057462ae7649))
* **ai-council:** mark skill cloud-safe with degrade tier ([3c568e6](https://github.com/event4u-app/agent-config/commit/3c568e6eed6c50f8fee2c1685d25dc7aef9d82ec))
* **low-impact-floor:** drop forbidden authoring-tree path from rule ([8962291](https://github.com/event4u-app/agent-config/commit/89622914c375d01629ed3795d37fd7adf7a07c60))
* **ai-council:** restore Phase 11 sections in compressed SKILL.md ([52e4f14](https://github.com/event4u-app/agent-config/commit/52e4f14177acd90fd63b4c1c283b3dbda41a6437))

### Documentation

* add (beta) markers next to beta-stability contract links ([0eb55dc](https://github.com/event4u-app/agent-config/commit/0eb55dc1303eb06b52b7f1a88cb2a137a6cde8f9))
* **reports:** command-surface inventory + AI Council synthesis ([38c3cc3](https://github.com/event4u-app/agent-config/commit/38c3cc39176cefb1c92431c0485659fa442002cf))
* **council:** document confidence-gate auto-escalation ([4202dac](https://github.com/event4u-app/agent-config/commit/4202dace49401598bb8b7e3033768c99333d1659))
* **roadmap:** mark step-9 complete and archive ([1c0ca06](https://github.com/event4u-app/agent-config/commit/1c0ca06495f718cda5d1f7065b2d7b07dd4e63f8))
* **contracts:** declare stability=beta for low-impact-corpus-format ([2114086](https://github.com/event4u-app/agent-config/commit/21140864621b8c1eb9bdb38a0d6b5146e562915a))
* CHANGELOG + roadmap step-9 phases 10-12 complete ([9f1a220](https://github.com/event4u-app/agent-config/commit/9f1a220f7b44bb96788898f2662782e0d6b4ec99))
* **roadmap:** mark step-9 Phase 9 complete + regen dashboard ([ae29fbf](https://github.com/event4u-app/agent-config/commit/ae29fbfe32eaf77d847bc00fcee76210e5f17848))
* **ai-council:** document solo dispatch + Iron Law contract (step-9 phase 8) ([ed12ca9](https://github.com/event4u-app/agent-config/commit/ed12ca9dabc585b0962f82d740a682206caeb2df))
* **low-impact:** switch /memory learn-low-impact default to --preview (step-9 phase 7) ([493ef5d](https://github.com/event4u-app/agent-config/commit/493ef5d91024761ee2b7a845b992257b76e71671))
* **roadmap:** mark step-9 phases 0/1/5 complete + regen dashboard ([5f55bad](https://github.com/event4u-app/agent-config/commit/5f55bad0495532431b2451130a2397c144374b58))
* **roadmap:** mark step-9 phase 4 complete (corpus parser hardening) ([5b35aaa](https://github.com/event4u-app/agent-config/commit/5b35aaa3ab27dd348ef161c4a78321f886775b6a))
* **roadmap:** mark step-9 phase 2 complete (CLI install hints) ([11ae2ee](https://github.com/event4u-app/agent-config/commit/11ae2ee97753abf6f1e2a18583b5efd84924f208))
* **council:** document low-impact council opt-in (step-9 phase 1) ([c0fd395](https://github.com/event4u-app/agent-config/commit/c0fd395423693f525fe628a744e6b324a87cf589))
* **roadmap:** mark step-8 complete and archive ([e7d328d](https://github.com/event4u-app/agent-config/commit/e7d328d7f85acb1df5ce01c559e2809640ee2096))
* **council:** document quota/necessity transparency surface (step-8 phase 4) ([ba72154](https://github.com/event4u-app/agent-config/commit/ba72154f02bcb791e2864f8ee7818a946710d630))
* **roadmap:** add step-9 pr-150 feedback hardening + regen progress dashboard ([bf89e80](https://github.com/event4u-app/agent-config/commit/bf89e80e3e238a449daab1399942b6866de920a6))
* **roadmap:** add step-8 quota necessity transparency ([8aa2385](https://github.com/event4u-app/agent-config/commit/8aa23857583a7e434e9bca1372ef18436f9933e5))
* **roadmap:** add step-7 agent-folder discovery + minimal init ([a13c963](https://github.com/event4u-app/agent-config/commit/a13c96335bc8244eeeee9bb3dfb1e30aa292e179))
* **roadmap:** add step-2 feedback follow-up roadmap ([b9f34d3](https://github.com/event4u-app/agent-config/commit/b9f34d39d94d28d6e2d9eba2748995d579b36373))
* **roadmap:** expand step-1 with safety net, impact routing, and low-impact corpus ([3925a74](https://github.com/event4u-app/agent-config/commit/3925a74b5cdba6d9c6b92fbaf1c0cf6e05fb1cd3))

### Refactoring

* **commands:** nest learn-low-impact under memory cluster ([473dc97](https://github.com/event4u-app/agent-config/commit/473dc9776cd3dfb55f66e06977c1abaf02afcc01))

### Tests

* **install:** sandbox HOME for --global guard test ([189baef](https://github.com/event4u-app/agent-config/commit/189baefe91d72392753ca144ae290a23e253a266))
* **ai-council:** Iron-Law sentinel for locked dispatch (step-9 phase 11) ([c5b617a](https://github.com/event4u-app/agent-config/commit/c5b617aeae79431ba4071a436f12a7ca35dd144b))
* **council:** cover step-8 quota + necessity-tier surface (phase 5) ([be4eba3](https://github.com/event4u-app/agent-config/commit/be4eba3dba54c5f6926924e80dd56ff312a4124a))

### Build

* **ai-council:** wire compile-corpus into consistency + sync ([5a35b90](https://github.com/event4u-app/agent-config/commit/5a35b9037ee161f24224b71b2431e1c6bdbe6f86))

### Chores

* **roadmap:** close out + archive step-2-feedback-followup ([fc347d2](https://github.com/event4u-app/agent-config/commit/fc347d28d93b1237300bbc3b31b1877a147857ca))
* **roadmap:** mark step-2-feedback-followup phases 1-3 complete ([6f8c456](https://github.com/event4u-app/agent-config/commit/6f8c4567993067b039ca9aebf680aaf76bd5e69c))
* **scripts:** add command-surface audit tool ([e118870](https://github.com/event4u-app/agent-config/commit/e11887001cf0e5bd68ee46164bb8d27a7f9a7a32))
* **roadmaps:** archive step-10 (corpus YAML lockfile complete) ([1d5ecfa](https://github.com/event4u-app/agent-config/commit/1d5ecfa07f63103456d4647a121a83e662a2d686))
* **index:** regenerate after auto-rule description trims ([fb39853](https://github.com/event4u-app/agent-config/commit/fb398539a22b82c530ec9cc39adb4343475edf6b))
* **rules:** trim auto-rule descriptions to fit 150-char Augment cap ([7755665](https://github.com/event4u-app/agent-config/commit/77556655e9db859a3c8bb3ca90931724bb144b9f))
* **ownership:** regenerate ownership matrix ([3661223](https://github.com/event4u-app/agent-config/commit/3661223dea90d842239a947c8d605ac22257cfc1))
* **lint:** suppress pre-existing council references with allowed pragma ([3770fb7](https://github.com/event4u-app/agent-config/commit/3770fb76f661a7042fd014ce18537babf6d6a127))
* **roadmaps:** tag step-7 and step-9 as structural ([99e8801](https://github.com/event4u-app/agent-config/commit/99e88019d2f8352e3c61932433a159c3e9b1136c))
* **index:** regenerate agents/index.md + docs/catalog.md ([e3adea4](https://github.com/event4u-app/agent-config/commit/e3adea43c1a8a4bf184f4476ef0a158e48a4c7ce))
* **lint:** clear pre-existing check-no-roadmap-refs violations (step-9 phase 0) ([41284d4](https://github.com/event4u-app/agent-config/commit/41284d4f990d3beb0efbe31dc8b9782a57a528b5))
* **changelog:** split off pre-2.11.0 era into archive ([913da95](https://github.com/event4u-app/agent-config/commit/913da950c07ab8221e8fc7b96b28fde3ae6aa83f))
* **roadmap:** archive step-1-ai-council-cli-transport (100% complete) ([2a9eaa5](https://github.com/event4u-app/agent-config/commit/2a9eaa558178349819609cf73f33300dcc3b846f))
* **index:** regenerate after learn-low-impact cluster move ([6d38afb](https://github.com/event4u-app/agent-config/commit/6d38afbca4ff8b2f75ea6d3669f9a15a1a49b2f4))
* **counts:** bump documented command count 108 to 109 ([6ada77d](https://github.com/event4u-app/agent-config/commit/6ada77d42b367909c68381f5c1bd9480960dd85f))
* **index:** regenerate after low-impact-corpus + learn-low-impact ([e256dd0](https://github.com/event4u-app/agent-config/commit/e256dd0d56492fbe390ab60b7902a99d1b509d50))
* **roadmap:** mark Phase 8-12 complete + regenerate dashboards ([8f14a9c](https://github.com/event4u-app/agent-config/commit/8f14a9c8e5ba16348c45f8ac9cfbeb1f053b26bd))
* **contracts:** pull keep-beta-until back inside 90-day window ([8b4c8c9](https://github.com/event4u-app/agent-config/commit/8b4c8c9de4fab092e8bc4c7580b2b435de85e973))
* **docs:** clear pre-existing check-public-links failures ([822c40e](https://github.com/event4u-app/agent-config/commit/822c40e9f90d81ffdcdb1a3fa590dc0d0e89c9f5))
* **roadmap:** stub agents/low-impact-decisions.md for Phase 12 forward-ref ([3af26f6](https://github.com/event4u-app/agent-config/commit/3af26f67f3ad86afc5a964a75ac3173526772b95))
* **templates:** bump agent_config_version to 2.13.0 ([1e5ddcd](https://github.com/event4u-app/agent-config/commit/1e5ddcd6d6aeed485253e8476c002262a3e95962))
* **roadmap:** regenerate roadmaps progress dashboard ([3a33c7e](https://github.com/event4u-app/agent-config/commit/3a33c7eda801c25aacb13ec2e58680f9f856cc91))

Tests: 4340 (+472 since 2.13.0)

## [2.13.0](https://github.com/event4u-app/agent-config/compare/2.12.0...2.13.0) (2026-05-14)

### Features

* **council:** Phase 7 — debate orchestration + CLI wiring ([647a3f0](https://github.com/event4u-app/agent-config/commit/647a3f07698792f41beb7413600d54b2321f4a96))
* **council:** Phase 7 — /council debate sub-command files ([abbd436](https://github.com/event4u-app/agent-config/commit/abbd43666b7e2c704ab3c46f2901f01eae446139))
* **council:** Phase 6 — thinking-style advisor personas ([21c8b88](https://github.com/event4u-app/agent-config/commit/21c8b88310a2a65d7ea9082da085d023f813d114))
* **council:** Phase 5 — Karpathy peer-review opt-in flag ([bce381a](https://github.com/event4u-app/agent-config/commit/bce381ae9c412abf501473fa4154f91d9c0befbf))
* **council:** analysis lens + lens-adaptive synthesis + consensus scoring ([6d7136a](https://github.com/event4u-app/agent-config/commit/6d7136ad6be31b7627a332600a7623f2cd929e76))
* **council:** add config loader, overlay, and 3 new provider clients ([0cb5591](https://github.com/event4u-app/agent-config/commit/0cb55914457a62b6f57744d8c8dac16bf777921d))
* **council:** introduce agents/.ai-council.yml as single source of truth ([043c2d2](https://github.com/event4u-app/agent-config/commit/043c2d23445f2ef7ad8aee880dc83d97c347635f))
* **governance:** Phase 5 — roadmap trajectory metric + architectural-consensus ADR ([926a632](https://github.com/event4u-app/agent-config/commit/926a63237c3dbe1fcfd7df05c9230809382d8790))
* **projection:** Phase 4 + 1.4 — multi-tool projection fidelity contract + ci-strict gate ([e18e4ad](https://github.com/event4u-app/agent-config/commit/e18e4ad73595e17889009b0123ebd000254c165b))
* **routing:** Phase 3 — tighten skill descriptions + 4 tier-3 routing rules for failing clusters ([2a11c70](https://github.com/event4u-app/agent-config/commit/2a11c70b274741e7d98fd814ac39c1d05a1a38c9))
* **governance:** Phase 1 — credibility (CONTRIBUTING preface, source-projection rename, archive 7 migration scripts) ([2e5cfe0](https://github.com/event4u-app/agent-config/commit/2e5cfe02e1b5f4218d1283108796b0ce43fd9165))

### Bug Fixes

* **docs:** drop transient council-sessions citation from multi-tool-projection ([55dbbb1](https://github.com/event4u-app/agent-config/commit/55dbbb1e599aae2d913dc56a05c9dab0014e2739))
* **linter:** treat ../docs/contracts/ links as out-of-scope like guidelines ([a2249b0](https://github.com/event4u-app/agent-config/commit/a2249b02b70233e2b13ccf3efeda4188686b6181))
* **routing:** strip transient roadmap citation from tier-3 routing rules ([2cf745c](https://github.com/event4u-app/agent-config/commit/2cf745cad9beb40c4e6e9eb7f97abbc58a94d9de))

### Documentation

* **roadmap:** rename "rule" to "invariant" for deep_min_rounds reference ([758ea46](https://github.com/event4u-app/agent-config/commit/758ea46568c23ef5518ff61d80700f7559bc54a1))
* **ai-council:** sync compressed SKILL.md with Phase 6 advisors section ([6d57034](https://github.com/event4u-app/agent-config/commit/6d57034c7b342abdd5d38ff300fa67c51deb3471))
* **council:** document master/wrapper contract for the council cluster ([7346f34](https://github.com/event4u-app/agent-config/commit/7346f34376b48c02ced3ae939dfff6ea215025ba))

### Tests

* **ai-council:** Phase 8 — negative-test backfill for config loader ([cc3a08c](https://github.com/event4u-app/agent-config/commit/cc3a08c360c94685f9a1efaaa57f84001f78788c))

### Chores

* **roadmaps:** archive step-2-ai-council-consolidation — all phases + ACs done ([c7f0c9c](https://github.com/event4u-app/agent-config/commit/c7f0c9ca7ac300023c5da0b939e0c63554dbcfed))
* **docs:** bump getting-started command count 106 -> 108 after council debate sub-command ([5e256d7](https://github.com/event4u-app/agent-config/commit/5e256d79d3eea3046900e8afa5be64526b4fc61d))
* **roadmaps:** retag complexity from "medium" to lint-valid values ([4c5457e](https://github.com/event4u-app/agent-config/commit/4c5457e271f8dcdc03943bac7adff84455388615))
* regenerate index + catalog for council-debate skill ([3c365a3](https://github.com/event4u-app/agent-config/commit/3c365a375da22f16f97829677c875500e40d436a))
* **roadmap:** mark Phases 6-7 of step-2-ai-council-consolidation complete ([7e8e557](https://github.com/event4u-app/agent-config/commit/7e8e557505bbf88b486605980a7f5ee2f97bcbb4))
* **roadmap:** mark Phases 1-4 of step-2-ai-council-consolidation complete ([101a5cf](https://github.com/event4u-app/agent-config/commit/101a5cf70d4fc694f85a270b2bebfb8fe545833a))
* **roadmap:** mark Phase 0 of step-2-ai-council-consolidation complete ([4fa2734](https://github.com/event4u-app/agent-config/commit/4fa27346c8faad54de582757ce5cfe7216041bda))
* **template:** bump agent_config_version pin to 2.12.0 ([e5c41fd](https://github.com/event4u-app/agent-config/commit/e5c41fd433105359d6e36b03b0de62415be212f0))
* regenerate agents/index.md + docs/catalog.md after rule additions ([b7fa4b6](https://github.com/event4u-app/agent-config/commit/b7fa4b6e25cbc55d8b3197f815c00530bd1eee79))
* **roadmap:** archive completed step-1-v2-feedback-followup (20/20 done) ([88a07ea](https://github.com/event4u-app/agent-config/commit/88a07ea9a983f0b63710e5461c8fddee36b2d378))

Tests: 3868 (+150 since 2.12.0)

## [2.12.0](https://github.com/event4u-app/agent-config/compare/2.11.0...2.12.0) (2026-05-14)

### Features

* **linter:** evals.json schema validator + meta_skill exemption ([9568510](https://github.com/event4u-app/agent-config/commit/95685109540c7f2dc2643ec24ba9d996467e0645))
* **skill-writing:** § 7 quantitative eval loop + run_skill_evals.py ([9eda402](https://github.com/event4u-app/agent-config/commit/9eda402dc43b8e14682787fb1cbbc9872eb16fcc))
* **skills:** add doc-coauthoring from Anthropic ([161b904](https://github.com/event4u-app/agent-config/commit/161b9044743753f2e54bcae45c36a29daaa8058d))
* **skills:** add canvas-design from Anthropic ([95c247c](https://github.com/event4u-app/agent-config/commit/95c247c08d3c6710c53bfcd7ba7a00f270e0d8d4))
* **check-refs:** add file/line opt-out markers ([f381bcb](https://github.com/event4u-app/agent-config/commit/f381bcb5a08818e042af35836dd2c4d8965aa98e))
* make ai-council max_output_tokens configurable ([5976b46](https://github.com/event4u-app/agent-config/commit/5976b4623b94277f6ba49b0e82bb36ab7d5adb50))

### Bug Fixes

* **marketplace:** register canvas-design + doc-coauthoring ([9fbfe6a](https://github.com/event4u-app/agent-config/commit/9fbfe6af83589bf45b27b72c1b818be9772ae60c))

### Documentation

* **audit:** mark forward-refs in north-star bundle as opt-out ([a1d7c21](https://github.com/event4u-app/agent-config/commit/a1d7c21df3d05c27bacf81344893c4e43ae72a06))
* **roadmap:** expand step-99 with Total Dominance mandate ([c46cffd](https://github.com/event4u-app/agent-config/commit/c46cffd54214a61230be27ddaae3367053be39a5))
* **roadmap:** add step-99 north-star restructure (meta · out-of-band) ([8dd18f9](https://github.com/event4u-app/agent-config/commit/8dd18f963742d14dd9d006237ddd93881b198a60))
* **audit:** correct step-3 filename reference ([ee6bd7f](https://github.com/event4u-app/agent-config/commit/ee6bd7ffc6c6cd363b6207b6ff32aa72f2bc317e))
* **audit:** add 2026-05-14 north-star audit + council synthesis ([589c2fb](https://github.com/event4u-app/agent-config/commit/589c2fbd3e35b57529ab0f934665d71d611012d4))
* add roadmaps for council, persona, ghostwriter, user-types axis ([471fae3](https://github.com/event4u-app/agent-config/commit/471fae3a46182d930fea21adb4037a41ec99dcb3))
* add v2 feedback follow-up roadmap ([23d17cb](https://github.com/event4u-app/agent-config/commit/23d17cb24b33e794f7c1e31e76055cc5c8f1ab6c))

### Chores

* prefix roadmaps with step-N execution sequence ([de87232](https://github.com/event4u-app/agent-config/commit/de87232213404ad104e07c5ca831d64f4a607f8e))

Tests: 3718 (+0 since 2.11.0)

## [2.11.0](https://github.com/event4u-app/agent-config/compare/2.10.0...2.11.0) (2026-05-14)

### Features

* **stability:** add beta-review marker protocol and CI gate (P5.4) ([9b6cdfe](https://github.com/event4u-app/agent-config/commit/9b6cdfe9f9167e3e80551dfa2a88f80fff85646a))
* **lint:** add 'type: orchestrator' frontmatter tag for cluster routers (P5.3) ([e6385bb](https://github.com/event4u-app/agent-config/commit/e6385bbaf022dc3763f55c2dd54fe85046c59fd4))
* **skills:** add nextjs-patterns and symfony-workflow workflow skills (P4) ([038522b](https://github.com/event4u-app/agent-config/commit/038522b7ad2bd2ba1d8d8c4f9a61692694b7ebc8))
* **onboard:** add Quickstart pointer step and surface balanced default (P3.3) ([5879b4c](https://github.com/event4u-app/agent-config/commit/5879b4cc66fc9f49fa42c99e72794e4c60f43739))
* **install:** default cost_profile to balanced (P3.2) ([75caac2](https://github.com/event4u-app/agent-config/commit/75caac20fa2986222b5bd45a7cb63f07f9c4179f))
* **work-engine:** wire decision_gate hook into runner ([c41a89d](https://github.com/event4u-app/agent-config/commit/c41a89d38c7eb4892358b5c931abbe9a5889038c))
* **work-engine:** add decision_engine schema and gate evaluator ([fd1e8e2](https://github.com/event4u-app/agent-config/commit/fd1e8e2bb2e45e2288727ccd4a3bda4f809c6151))
* **release:** release-trunk-sync contract and CI gate (P1.2, P1.3) ([a3e0d12](https://github.com/event4u-app/agent-config/commit/a3e0d12c156c367c995e84c7c0bb5d6a21ff6325))

### Bug Fixes

* **readme:** rename 'For contributors' to 'Development' for linter ([7957274](https://github.com/event4u-app/agent-config/commit/7957274c65895d80fa4801f95df876979362ee86))

### Documentation

* **roadmap:** close + archive road-to-productization (Level-6) ([7ee50e8](https://github.com/event4u-app/agent-config/commit/7ee50e8b16f1ce7d4461f1466d9a6e46f4138101))
* **roadmap:** mark P3.1-P3.3 + P3.1a done in road-to-productization ([b0ff24f](https://github.com/event4u-app/agent-config/commit/b0ff24f23cb38d4ac556106c9ed060f104f83c8c))
* **readme:** add 3-step Quickstart and move contributor detail below the fold (P3.1) ([b98152e](https://github.com/event4u-app/agent-config/commit/b98152eb86607d6b34f63ea9ad4c152951de58a6))
* **roadmap:** mark P2.1-P2.3 done in road-to-productization ([189c780](https://github.com/event4u-app/agent-config/commit/189c780faef19cfbd9bceb3ad51ec42cb8cb05b7))

### CI

* **install:** add structural Quickstart smoke test (P3.1a) ([228445b](https://github.com/event4u-app/agent-config/commit/228445b97eefb20118bbea2872640c54225a1355))
* **work-engine:** validate decision_engine block in agent-settings ([1a1f428](https://github.com/event4u-app/agent-config/commit/1a1f428bec4832f8ffb222a8b450719ba6409605))

### Chores

* **generate-tools:** expose nextjs-patterns + symfony-workflow skills ([3422ac7](https://github.com/event4u-app/agent-config/commit/3422ac7e3f273497a0cbb176b2580a0cf1256522))
* **sync:** align orchestrator frontmatter + hash registry ([0e9ba2d](https://github.com/event4u-app/agent-config/commit/0e9ba2d50463ca99baf86651ea67ed82ca63d7f6))
* **gitignore:** ignore python coverage artifacts ([e1a3289](https://github.com/event4u-app/agent-config/commit/e1a328921f08fad03325adc256b63a544582efb7))

Tests: 3718 (+55 since 2.10.0)
