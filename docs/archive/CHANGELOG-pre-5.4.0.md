# Changelog Archive — pre-5.4.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `5.4.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) by `scripts/release.py`
> once the active era's body crossed the drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md`. Entries
> here are not amended — git tags remain the canonical source
> for what shipped.
>
> Entry shape follows
> [`../contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).

## [5.3.0](https://github.com/event4u-app/agent-config/compare/5.2.0...5.3.0) (2026-05-30)

### Features

* **ci:** lint frontmatter fields equal to their schema default ([3f56ed7](https://github.com/event4u-app/agent-config/commit/3f56ed74fae3fe20346130c790db2929093ae095))
* **frontmatter:** add idempotent migrate_frontmatter_defaults script ([8c2d56d](https://github.com/event4u-app/agent-config/commit/8c2d56ddb17585540fef83589f5e3207e6583d4a))
* **frontmatter:** inject schema defaults in discovery, checksum + condense consumers ([a69e51e](https://github.com/event4u-app/agent-config/commit/a69e51ef7b58d0f5e0eda2a600ce090ab203bef2))
* **frontmatter:** declare schema defaults + inject them in the loader ([6de22ce](https://github.com/event4u-app/agent-config/commit/6de22ce9d89dc648b42b312e0694c621207ccad3))

### Bug Fixes

* **smoke:** inject schema defaults in skills smoke validation ([fc6524b](https://github.com/event4u-app/agent-config/commit/fc6524bc51f595de5a9173309fad17f321a7c892))
* **lint:** re-anchor framework-leakage allowlist after frontmatter line shift ([13f5e5e](https://github.com/event4u-app/agent-config/commit/13f5e5ea7f933d5cb66550c4e90cd714c7683b87))
* **frontmatter:** inject schema defaults in skill_linter; update frontmatter tests ([fff4b12](https://github.com/event4u-app/agent-config/commit/fff4b121fa318b0985a51287095b200b3d008642))

### Documentation

* **roadmap:** close + archive abstraction-reduction roadmap with evidence ([fcb8a33](https://github.com/event4u-app/agent-config/commit/fcb8a3322dcb2dc5f89c85c4132bab9286b2164a))
* **roadmaps:** land Phase 0 preflight for frontmatter-defaults reduction ([70bd300](https://github.com/event4u-app/agent-config/commit/70bd300ef70f55344a22685545a21e2dc795d98b))

### Refactoring

* **frontmatter:** omit fields equal to their schema default across all artefacts ([bd8bc57](https://github.com/event4u-app/agent-config/commit/bd8bc57e104cc82a713f523f5f510e033688771f))

### Chores

* **frontmatter:** drop defaulted fields from the condensed .agent-src tree ([58e2c2a](https://github.com/event4u-app/agent-config/commit/58e2c2a6fc7cf7011e6c9b00801c9f8ff1412684))
* **roadmaps:** archive road-to-distribution-identity — CI green on PR #290 ([2ffeb62](https://github.com/event4u-app/agent-config/commit/2ffeb6239697228541334c7e234554f77c6935aa))
* **roadmaps:** flip Phase 0 checkboxes + regen dashboard ([070e33e](https://github.com/event4u-app/agent-config/commit/070e33e4fd704ec0257f4c5cf6a72052c97796d3))

Tests: 5236 (+50 since 5.2.0)

## [5.2.0](https://github.com/event4u-app/agent-config/compare/5.1.0...5.2.0) (2026-05-29)

### Features

* **ci:** reject sloppy commit subjects before they leak into the changelog ([26a94e9](https://github.com/event4u-app/agent-config/commit/26a94e9e0f07e862a135cfc96b742a999e7131ec))

### Documentation

* **adr:** land ADR-033 distribution-identity npm-primary ([63d38cf](https://github.com/event4u-app/agent-config/commit/63d38cf75df6506218cfc6bc17f0b5ba0c90fe9d))

### Chores

* **roadmaps:** flip distribution-identity Phase 1-3 + regen dashboard ([0885b9d](https://github.com/event4u-app/agent-config/commit/0885b9d4dda67a2439fc5292367249fa99766a02))

Tests: 5186 (+26 since 5.1.0)

## [5.1.0](https://github.com/event4u-app/agent-config/compare/5.0.0...5.1.0) (2026-05-29)

### Features

* **roadmap-progress:** surface pending Iron Law 3 deferrals in dashboard ([2f21a41](https://github.com/event4u-app/agent-config/commit/2f21a41c0ae09e003ddad4cf9184f3d1d359e87b))
* **roadmaps:** document follow-up-roadmap shape + spawn procedure ([ea2b02f](https://github.com/event4u-app/agent-config/commit/ea2b02f34d895e0cdbb1a37d45897990a3282d0b))
* **roadmaps:** add Iron Law 3 — block silent archive of [~] deferred items ([3b3d4ed](https://github.com/event4u-app/agent-config/commit/3b3d4edce67e1c04419bd2daf9a2d4b6d0e68dbe))
* **rules:** add linked-projects-onboarding-gate (Option A, passive awareness) ([54cf6fc](https://github.com/event4u-app/agent-config/commit/54cf6fc16580f2d1084e96ae3d41b0b12fdb6c6e))
* **settings:** add gitignored .agent-settings.local.yml cascade layer ([ca4185d](https://github.com/event4u-app/agent-config/commit/ca4185d8cc4d462b92d00f1520da4dcb1bde3fcf))
* **linked-projects:** add IDE-attached sibling detector ([a0b4a99](https://github.com/event4u-app/agent-config/commit/a0b4a9968962343c7e768469008a6fa3144a736b))

### Bug Fixes

* **refs:** reference local file as basename, not project-rooted path ([dc626c4](https://github.com/event4u-app/agent-config/commit/dc626c49fe68d958ee425d67adce7d71d21c7098))
* **settings:** re-mirror agent_settings.py to work_engine template copy ([6c1b7b1](https://github.com/event4u-app/agent-config/commit/6c1b7b1285ef3c15332f23c14a4e282c13dd6554))
* **rules:** root-relative doc reference in linked-projects rule ([2a85cd2](https://github.com/event4u-app/agent-config/commit/2a85cd26b38ad92342ccc0171754bff145305fcb))

### Documentation

* **roadmap:** archive road-to-linked-projects-scope (all phases complete) ([e12b755](https://github.com/event4u-app/agent-config/commit/e12b755c938c210b234347d8f7f6905710a6eacf))
* **roadmap:** road-to-linked-projects-scope (GO, Option A) + dashboard ([1d8d822](https://github.com/event4u-app/agent-config/commit/1d8d822dd29f962492b92ac570f28f6df13d1eb8))
* **adr:** ADR-032 linked-projects scope GO (Option A) + cross-repo guide ([c49d53c](https://github.com/event4u-app/agent-config/commit/c49d53ce07ff5222b60f5d82a71226c459f7006f))

### Refactoring

* **settings:** relocate local override to agents/settings/.agent-settings.local.yml ([4f887ae](https://github.com/event4u-app/agent-config/commit/4f887ae863b588f66efbfdc585e52123a3e23400))

### Chores

* **index:** regenerate index + catalog for linked-projects rule ([66346cd](https://github.com/event4u-app/agent-config/commit/66346cd1f51795a2e42298b6b57452f39742ab79))

Tests: 5160 (+23 since 5.0.0)

## [5.0.0](https://github.com/event4u-app/agent-config/compare/4.9.0...5.0.0) (2026-05-29)

### BREAKING CHANGES

* **migrate:** remove legacy migrate-state + migrate-to-global subcommands ([3c2976c](https://github.com/event4u-app/agent-config/commit/3c2976c23d264dd67f9388d46db0748268c0ffcc))

### Features

* **migrate:** unify cleanup actions into one opinionated command ([014867e](https://github.com/event4u-app/agent-config/commit/014867e36af4e24167944dc9518c10d1349d7a51))
* **validate:** adopt severity-tiered errors + projection-roundtrip test (ADR-031) ([eafefa4](https://github.com/event4u-app/agent-config/commit/eafefa44bcc08c2c050edc360be361cf42e170bd))
* **lint:** block re-introduction of the marketplace-install gap ([ebe29a6](https://github.com/event4u-app/agent-config/commit/ebe29a6b52de8fad31f0b1d0bad00fce57adf1ec))
* **install:** add hooks:install --claude/--lifecycle/--regen flags ([a5b6798](https://github.com/event4u-app/agent-config/commit/a5b6798f96e9dadec93447383892907fdfeed625))
* **hooks:** add first-run gate banner for unscaffolded consumers ([33baa0e](https://github.com/event4u-app/agent-config/commit/33baa0ed701acb3be7efdbfd73483a8e81e76982))
* **hooks:** add dispatch-issues.jsonl observability layer ([7642b7a](https://github.com/event4u-app/agent-config/commit/7642b7af8147f4caa68817a12e0a875cab921840))
* **bench:** add replay-opaque trigger bucket + linter rule-id robustness ([0f6c727](https://github.com/event4u-app/agent-config/commit/0f6c727ccfa201d874383cbb7be8ab232d3b20bc))
* **bench-corpus:** ship 5 router-coverage extension corpora ([dccedb3](https://github.com/event4u-app/agent-config/commit/dccedb33697e0f924388b87b3ad8b66d027f9f97))
* **telemetry:** manifest auto-discovery + intended-vs-observed + unintended_activations ([3d46bdc](https://github.com/event4u-app/agent-config/commit/3d46bdc31d46fd830b2138957b91670a8c3d527c))
* **bench-corpus:** add intended_triggers + open_files + command fields ([6c97e51](https://github.com/event4u-app/agent-config/commit/6c97e51fba8e59fda8e56c3fc7fe6f9ac8774b60))
* **value:** router-trigger telemetry + Panel B attribution ([c867411](https://github.com/event4u-app/agent-config/commit/c8674116591f0d0b4f8221f9f7d5fcebe28da077))
* **taskfiles:** wire `task value*` targets + cadence row ([8b26a43](https://github.com/event4u-app/agent-config/commit/8b26a43af4dff4050084691fe8b2a6f036ce96ce))
* **scripts:** lint docs/value.md for structural invariants ([370b0b0](https://github.com/event4u-app/agent-config/commit/370b0b00a44d086b7fe8f0a21b0a5d2d92fca98a))
* **scripts:** render docs/value.md from value-v1 — the dashboard ([08c626a](https://github.com/event4u-app/agent-config/commit/08c626a07975b36958ef37222263f50cbd5dc196))
* **bench:** capture first live A/B Track B with-vs-without run ([7de6445](https://github.com/event4u-app/agent-config/commit/7de64452a0368377ae1f72b87dd7e50a6a72e49e))
* **scripts:** measure rtk's actual CLI-output token savings ([b51821e](https://github.com/event4u-app/agent-config/commit/b51821e31e7fb1be301a33f8c56bcebab2b49c51))
* **scripts:** add value_ladder + value_report libs and unit tests ([5d1b8ba](https://github.com/event4u-app/agent-config/commit/5d1b8bad3058bbad66acc408c4b83df419d55a4a))

### Bug Fixes

* **deps:** relax runtime dependency floors so npx resolves under prefer-offline ([0f04673](https://github.com/event4u-app/agent-config/commit/0f0467353a40b4bf75ba3424b0e177d10ab802eb))
* **hooks:** respect AGENT_CONFIG_REPLAY + fix dispatcher case-regex match ([b86c681](https://github.com/event4u-app/agent-config/commit/b86c68194e61dd6612d3b03ebdf799bc721fb53e))
* **bench-corpus:** correct intended_triggers, mark intent-only rules replay-opaque ([669cdbf](https://github.com/event4u-app/agent-config/commit/669cdbffa37664654bc24da61457f1867fafcd1c))
* **value:** load rung now measures the real kernel, not the canon ([6721090](https://github.com/event4u-app/agent-config/commit/6721090ad2d79199f28532a7f42cfcb9a08931dc))
* **scripts:** reframe docs/benchmark.md Track A headline ([2766e22](https://github.com/event4u-app/agent-config/commit/2766e22f1a74a82d15a011e20ddb3758c36055cc))

### Documentation

* **roadmaps:** archive road-to-one-migrate-command (all phases done) ([626e7c1](https://github.com/event4u-app/agent-config/commit/626e7c1c1bfd21174a2df4d41f5dcaa76df776d9))
* **migrate:** redirect cross-references to the unified contract ([557e64d](https://github.com/event4u-app/agent-config/commit/557e64de58dc0a0555f3a3b9fce1f0c6d0a8b13a))
* **contracts:** lock unified migrate command behavior matrix ([5828cbc](https://github.com/event4u-app/agent-config/commit/5828cbc90195ed0af9771b8d0b1bd7e153d004b7))
* **roadmaps:** add road-to-per-skill-model-autoswitch + regen dashboard ([3cdeeea](https://github.com/event4u-app/agent-config/commit/3cdeeea448a9d3492addf0e1171f4fe7e4aafeb0))
* **roadmaps:** record step-completion notes on hooks-actually-fire archive ([7150557](https://github.com/event4u-app/agent-config/commit/715055778358d32233b5222496f03258b983626d))
* **evidence:** reproduce + document marketplace-install hook gap ([cc5a557](https://github.com/event4u-app/agent-config/commit/cc5a5574e1bda89bfe8c2260ee163ee952d36019))
* **roadmaps:** add road-to-hooks-actually-fire-in-consumers + council fixes ([1255842](https://github.com/event4u-app/agent-config/commit/1255842c7c28659d13532f27190b965857df38f7))
* **roadmaps:** Phase 7 honesty-floor correction on corpus-expansion roadmap ([1def2eb](https://github.com/event4u-app/agent-config/commit/1def2eb34debb4dadb9d50025b8963954905e3c7))
* **roadmaps:** mark Phase 6 checkboxes on archived corpus-expansion roadmap ([a5c0c11](https://github.com/event4u-app/agent-config/commit/a5c0c11e58616180e5485e78b76832b5db7f8610))
* **roadmaps:** close road-to-corpus-expansion-evidence-based-cuts ([88c1644](https://github.com/event4u-app/agent-config/commit/88c1644dac99eeefad5031550d657c881cd87fe7))
* **value:** pass-2 close-out — structural categorisation, 0 cuts ([389df66](https://github.com/event4u-app/agent-config/commit/389df66f13794ddd98884e55726da1eb2285d54a))
* **roadmaps:** fold Round-3 council fixes into corpus-expansion plan ([25f6039](https://github.com/event4u-app/agent-config/commit/25f603967ac6193dedee1d761a9d0939dd94ced2))
* **roadmaps:** plan corpus expansion + evidence-based tier-1 cuts ([f570b97](https://github.com/event4u-app/agent-config/commit/f570b973ba3caa26b329393724c0a364ae6a762b))
* **roadmaps:** mark Phase 6 checkboxes on archived netto-cuts roadmap ([802da06](https://github.com/event4u-app/agent-config/commit/802da0685d42f7f3909c1df0ed29f349bd91e84f))
* **roadmaps:** close road-to-value-dashboard-netto-cuts dashboard ([d1e5f25](https://github.com/event4u-app/agent-config/commit/d1e5f2527eb8cc5aed522d479b2a197bdc557604))
* **value:** re-render dashboard with corrected NETTO + close-out summary ([b4ea133](https://github.com/event4u-app/agent-config/commit/b4ea1334e587bae6872aff15bab296d24c1a35b4))
* **roadmaps:** add road-to-value-dashboard-netto-cuts ([3ed3ea7](https://github.com/event4u-app/agent-config/commit/3ed3ea77419e6d5320df05a09a30587f2a9d0437))
* **roadmaps:** close road-to-readable-value-dashboard ([28afac2](https://github.com/event4u-app/agent-config/commit/28afac2ab67e3ca86637baa0dde2b140b1fbb9e6))
* **contracts:** add value-dashboard-spec + value-report-schema ([46abebd](https://github.com/event4u-app/agent-config/commit/46abebdea378a782f56b3f9fefc0212f7163f321))

### Refactoring

* **kernel:** extract language-and-tone mechanics to guideline (−82 tok/req) ([f1cfeab](https://github.com/event4u-app/agent-config/commit/f1cfeabec63e02b03bfe5ce0a3e16a1e5445c46b))

### Tests

* **lint-agents-layout:** align consumer-warning assertion with unified migrate ([496af6c](https://github.com/event4u-app/agent-config/commit/496af6c8a66cf6c6accf3f1c13376340d44e1ca8))

### Chores

* **roadmaps:** regen dashboard after archiving hooks-actually-fire roadmap ([45a3ea7](https://github.com/event4u-app/agent-config/commit/45a3ea715ae4956f256aeaf20e11c36878711b0b))
* **value:** refresh dashboard + telemetry snapshots after kernel cut ([e7653a1](https://github.com/event4u-app/agent-config/commit/e7653a1be4bacb7fb75e2bf9310d63bd3d5a5349))
* **bench:** ship pass-2 audit artefacts under router-telemetry/ ([89b3900](https://github.com/event4u-app/agent-config/commit/89b3900f070a13cd02193733527b6ed943922d06))
* **router:** minify dist/router.json by default + audit context loading ([d011333](https://github.com/event4u-app/agent-config/commit/d011333f1126ce636961906a3d070fd306458880))

Tests: 5137 (+59 since 4.9.0)

## [4.9.0](https://github.com/event4u-app/agent-config/compare/4.8.0...4.9.0) (2026-05-28)

### Features

* **scripts:** inventory abstraction-budget classes via grep-backed audit ([bf4de06](https://github.com/event4u-app/agent-config/commit/bf4de06d12908281e7a657cab8783c3cdae39a2e))

### Documentation

* **roadmaps:** close discovery, charter scoped reduction follow-up ([f749c77](https://github.com/event4u-app/agent-config/commit/f749c778ae02f6718c9d499213c8781392e95b3e))
* **evidence:** abstraction-budget Phase-1 inventory + frontmatter audit ([178c0b6](https://github.com/event4u-app/agent-config/commit/178c0b605085801282c7f61c2b01d6d8dc83396e))

Tests: 5078 (+0 since 4.8.0)

## [4.8.0](https://github.com/event4u-app/agent-config/compare/4.7.2...4.8.0) (2026-05-28)

### Features

* **install:** close Claude Code global distribution gap ([aa15db9](https://github.com/event4u-app/agent-config/commit/aa15db9651c4fd21f8bd30ef88e3aeeb1eb31e22))

### Bug Fixes

* **maintainer:** align .claude/settings.json plugin id ([b59e080](https://github.com/event4u-app/agent-config/commit/b59e0804e874e9c7c95cfc821a31746e4241f61c))

### Documentation

* **adr:** record claude-code command-projection strategy (ADR-030) ([706dedb](https://github.com/event4u-app/agent-config/commit/706dedb54f5792a2cf5b7c2401054b30490edeec))

### Tests

* **install:** regression coverage for global distribution heal ([bfdbc90](https://github.com/event4u-app/agent-config/commit/bfdbc9053d9032ffd10248835ba03f276631c7b3))

### Chores

* gitignore install-time artefacts in maintainer repo ([d75aeac](https://github.com/event4u-app/agent-config/commit/d75aeac4ed8858d2cddc7e3534eeff6bfb1ab036))

Tests: 5078 (+14 since 4.7.2)

## [4.7.2](https://github.com/event4u-app/agent-config/compare/4.7.1...4.7.2) (2026-05-28)

### Bug Fixes

* **wizard:** first-run setup writes a schema-valid settings file ([e3ca97f](https://github.com/event4u-app/agent-config/commit/e3ca97f1dc9701eddc6fea274d4d38c2cfd831ae))

### CI

* **workflows:** authenticate arduino/setup-task to dodge API rate limit ([090bcfa](https://github.com/event4u-app/agent-config/commit/090bcfa57d35eb19783e1fcfd40934e7b3266d91))

Tests: 5064 (+0 since 4.7.1)

## [4.7.1](https://github.com/event4u-app/agent-config/compare/4.7.0...4.7.1) (2026-05-28)

### Bug Fixes

* **wizard:** make role optional so setup can save without a role pick ([dd0bc16](https://github.com/event4u-app/agent-config/commit/dd0bc168268fa9f9fe2b95ae5ef7cec76d66bdbe))

Tests: 5064 (+0 since 4.7.0)

## [4.7.0](https://github.com/event4u-app/agent-config/compare/4.6.0...4.7.0) (2026-05-28)

### Features

* **wizard:** drop the AI Council step from setup ([868853d](https://github.com/event4u-app/agent-config/commit/868853de2a7b973a0d9953422e914e6eef80bdfd))

### Bug Fixes

* **wizard:** make voice_sample optional so setup can save ([cfeeb93](https://github.com/event4u-app/agent-config/commit/cfeeb932344f3c0586d6baacbd30186deac377b9))

Tests: 5064 (+0 since 4.6.0)

## [4.6.0](https://github.com/event4u-app/agent-config/compare/4.5.0...4.6.0) (2026-05-28)

### Features

* **wizard:** global-only settings + dedicated Projekt surface ([dc229a9](https://github.com/event4u-app/agent-config/commit/dc229a9a61f0a14527b5c85f0cb7db03fbbc72f8))
* **install:** deliver Claude hooks via plugin scope ([f76a7d1](https://github.com/event4u-app/agent-config/commit/f76a7d16e09369dacc466fb838463e5f04616480))

### Documentation

* **roadmap:** archive road-to-wizard-sse-hardening (complete) ([e565624](https://github.com/event4u-app/agent-config/commit/e5656240cca738acc5ba2aa3804d9d067820d071))
* **roadmap:** mark wizard-sse-hardening Phase 1+2 done, sync dashboard ([6df030b](https://github.com/event4u-app/agent-config/commit/6df030b87cb6980c0118168af4e0140551b4678f))

### Tests

* **wizard:** cover SSE apply endpoint failure paths ([9ffa068](https://github.com/event4u-app/agent-config/commit/9ffa068a898038f2e880f1a28ceb979cb5bb56cf))

### Chores

* **changelog:** split era 4.1.x → pre-4.5.0 ([44f40d6](https://github.com/event4u-app/agent-config/commit/44f40d6b166ed259b274fd91f63b01369f986346))
* **changelog:** split era 4.1.x → pre-4.5.0 ([69df8cf](https://github.com/event4u-app/agent-config/commit/69df8cf306763dff55c5639ac018e57c7596b461))

Tests: 5064
