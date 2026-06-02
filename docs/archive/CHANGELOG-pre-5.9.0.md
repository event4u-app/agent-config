# Changelog Archive — pre-5.9.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `5.9.0`, split out of the main
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

## [5.9.0](https://github.com/event4u-app/agent-config/compare/5.8.0...5.9.0) (2026-06-02)

### Features

* **doctor:** runnable global-only report without a project lockfile ([4c4f20b](https://github.com/event4u-app/agent-config/commit/4c4f20b82eb472ff6b6d84ebac889832ce1329f0))
* **ci:** release-published drift gate (catch npm lagging main) ([7f4e125](https://github.com/event4u-app/agent-config/commit/7f4e125dd48d0233d33ce8cbb219731a0b501497))

### Bug Fixes

* **release:** anchor --resume to package.json, auto-delete merged branch ([f2db736](https://github.com/event4u-app/agent-config/commit/f2db736c7259845fe204af1ffd293e7f5341a58d))

### Chores

* **roadmap:** close + archive doctor-global-only-readiness ([3d3aaf7](https://github.com/event4u-app/agent-config/commit/3d3aaf739464b9e6613175f352b09a153bdbec90))

Tests: 5480 (+25 since 5.8.0)

## [5.8.0](https://github.com/event4u-app/agent-config/compare/5.7.0...5.8.0) (2026-06-02)

### Features

* **profile:** /profile command cluster + overlay contract ([1b7720a](https://github.com/event4u-app/agent-config/commit/1b7720a3ead769056cf7499f7d4951e77fc07823))
* **profile:** session-profile overlay engine + staleness hook ([cca6ac1](https://github.com/event4u-app/agent-config/commit/cca6ac112d1479e807621c9c846279d949aecc99))
* **scripts:** add warn-only coverage-diff forcing-function ([dc45926](https://github.com/event4u-app/agent-config/commit/dc4592639f052457099e7ad1857b20b867657ce9))
* **scripts:** add packages/core path resolver + gate path-integrity check ([c7eddab](https://github.com/event4u-app/agent-config/commit/c7eddabe74c9c34d18f1c545b60b1738cffa4b6c))
* **dev:** add install:use-dev / install:use-release global switch tasks ([e8a1e23](https://github.com/event4u-app/agent-config/commit/e8a1e23ec85ff0d7c358218130ae8ebe8e95c075))
* **install:** refuse project-scope self-install into the source repo ([2ad502b](https://github.com/event4u-app/agent-config/commit/2ad502be83236b2c2fa653a10670e518fb80ace7))
* **pack-fun:** wire EV-grid + P(win) helpers into prediction-pool-optimizer ([001eb1d](https://github.com/event4u-app/agent-config/commit/001eb1de4ba2ceb58a02382f449a59da9334b895))
* **pack-fun:** add score_ev + pool_winsim helpers for prediction-pool ([06d296b](https://github.com/event4u-app/agent-config/commit/06d296b4355048d82ca969fb5c369cd73dc8d44e))
* **settings:** install/sync write canonical agents/settings/ + migrate root (ADR-038) ([b4b589e](https://github.com/event4u-app/agent-config/commit/b4b589e77fde1c6d8c07ad2f32b1824bfbfea893))
* **settings:** canonical settings path → agents/settings/.agent-settings.yml (resolver + readers) ([dc8c96a](https://github.com/event4u-app/agent-config/commit/dc8c96a5f9ca5f56c6e68e8f8771bf62a580afd2))
* **pack-fun:** answer every pool question + multi-book consensus odds in prediction-pool-optimizer ([8f0e124](https://github.com/event4u-app/agent-config/commit/8f0e1241c1962ef3fe1b818bee4b2db735d099da))

### Bug Fixes

* **hooks:** resolve roadmap-progress regenerator from the package root for global-only consumers ([8539403](https://github.com/event4u-app/agent-config/commit/853940322166cf47d3e055487f6eb884950a3396))
* **templates:** bump agent_config_version pin to 5.7.0 ([e2a5ae2](https://github.com/event4u-app/agent-config/commit/e2a5ae277c4c3b24d9f1ed42172f8d24f2eae21c))
* **check-refs:** ref-ignore gitignored .agent-settings.yml in new roadmap ([73a7deb](https://github.com/event4u-app/agent-config/commit/73a7deb56ed9b2da570c5214816f1f4b639c4da1))
* **templates:** bump agent_config_version pin to 5.7.0 ([411060d](https://github.com/event4u-app/agent-config/commit/411060d15ab1d2720f13af5482a7dc535dfb4fac))
* **check-refs:** add content-class allowlist to end the reword treadmill ([f6a3b7f](https://github.com/event4u-app/agent-config/commit/f6a3b7f2904c53f6ceb84d6339a1bb7cf75ea8e5))

### Documentation

* **roadmap:** close road-to-self-update Phase 5; spawn doctor global-only follow-up ([307aa87](https://github.com/event4u-app/agent-config/commit/307aa87f75270124f298dba80369061c3367a42c))
* **profile:** document session profiles + sync command counts ([afa7db1](https://github.com/event4u-app/agent-config/commit/afa7db16b5e55c849eaabcc314051c55685881e7))
* **adr:** record session-profile overlay decisions (ADR-010 addendum + host audit) ([90838b9](https://github.com/event4u-app/agent-config/commit/90838b9e21f18d5e1f62c7c29550ea1fb7a8cd9f))
* **adr:** record ADR-039 — .claude/skills/ untracked ([ae00011](https://github.com/event4u-app/agent-config/commit/ae00011a9786632808c8f74f86d68062c12b7b49))
* **roadmap:** add follow-up for untracking .claude/skills/ ([14855f8](https://github.com/event4u-app/agent-config/commit/14855f8da5c2465cb3391f5659558fe3a22c006d))
* **roadmap:** complete + archive linter-debt-and-meta-subtraction ([3f1c742](https://github.com/event4u-app/agent-config/commit/3f1c74207f33025b0aaa2f48d421bec396610222))

### Tests

* **profile:** make surface tests independent of the gitignored manifest ([db35420](https://github.com/event4u-app/agent-config/commit/db35420df35d41e83c9d4b02b04f0af24a0fbd76))
* **profile:** contract tests for the session-profile overlay ([1def905](https://github.com/event4u-app/agent-config/commit/1def9056a1a7bd9a42ecfa7fd53fab6f18c20f87))
* backfill regression tests for check_skill_requires, settings enum, wizard zero-terminal ([f581f9d](https://github.com/event4u-app/agent-config/commit/f581f9d985b296b7643536e99a7530f46b2afa8e))
* **settings:** one-liner entrypoint smoke asserts canonical settings path ([21eaf06](https://github.com/event4u-app/agent-config/commit/21eaf062ad230ac09590db9f088f4316f384e4f0))
* **settings:** update install assertions to canonical agents/settings/ path ([ad2c432](https://github.com/event4u-app/agent-config/commit/ad2c4324ff7ea8eceb1056d96e0810aa4de86835))

### CI

* wire check-gate-paths and check-test-coverage-diff into the pipeline ([d971efb](https://github.com/event4u-app/agent-config/commit/d971efbe1416d4d12ad76724b9bb9504f2bed698))
* **skill-lint:** drop .claude/** from workflow trigger paths ([b640079](https://github.com/event4u-app/agent-config/commit/b6400794debdf34ca113f67bcb661042dadf7f3b))

### Chores

* **index:** regenerate index + catalog for the profile command cluster ([92ccc91](https://github.com/event4u-app/agent-config/commit/92ccc91157c2781014acba03fdd3ad24c8c05393))
* **model-tier:** route routine commands and skills to the medium tier ([b0cbd55](https://github.com/event4u-app/agent-config/commit/b0cbd5523652dbeeeb5f5d3fd4e2fbb0ed1c5ed7))
* **roadmap:** close + archive road-to-session-profile-activation ([d647404](https://github.com/event4u-app/agent-config/commit/d64740461bb61fbaf80eb5f5bcc800fc770e3df0))
* **roadmap:** close + archive road-to-test-and-gate-integrity ([16f7f8b](https://github.com/event4u-app/agent-config/commit/16f7f8b896d060519cc1624178d38b9691af4bee))
* **roadmap:** close + archive road-to-claude-skills-untrack ([4010ca7](https://github.com/event4u-app/agent-config/commit/4010ca788621f409395b37b5d48cb2146919d0a2))
* **claude:** move marketplace skill sources out of .claude/skills ([c0e2d89](https://github.com/event4u-app/agent-config/commit/c0e2d8972b41cc85b44757d7c3b4df8f2b3d3551))
* **claude:** untrack generated rules/personas/user-types projections ([d03424b](https://github.com/event4u-app/agent-config/commit/d03424b2e43cae9978c7d0fc9a938fe0f1b6e2a8))
* add a new roadmap for test-and-gate-integrity ([486e7dd](https://github.com/event4u-app/agent-config/commit/486e7ddf07d79ec2a295b726a546567381037356))
* **meta:** remove dead one-shot roadmap-audit scripts (KC3) ([e0b40a2](https://github.com/event4u-app/agent-config/commit/e0b40a20519e89166db3ab06e70f15e601441dd5))

Tests: 5455 (+80 since 5.7.0)

## [5.7.0](https://github.com/event4u-app/agent-config/compare/5.6.1...5.7.0) (2026-06-01)

### Features

* **settings:** enum-validate value-bearing settings keys in CI ([b6c56d0](https://github.com/event4u-app/agent-config/commit/b6c56d088b1b8cfa549374e864bb3dcc203972fb))
* **value:** honest eager-vs-thin cost ladder in the value dashboard ([9a806c4](https://github.com/event4u-app/agent-config/commit/9a806c466e171f8a83e743990bc9350192745da5))
* **fun:** add /tippspiel command + tippspiel-optimizer skill in new pack-fun ([4c8fc65](https://github.com/event4u-app/agent-config/commit/4c8fc65473556ce3635a6fdcad67096c0c15886f))
* **skills:** add skill-composition graph + co-availability gate (roadmap 3.4) ([6db3afa](https://github.com/event4u-app/agent-config/commit/6db3afa8738331c2e85fb1f75dceb9943b2a2599))

### Bug Fixes

* **install:** hand off global install to the browser wizard with zero terminal prompts ([0fc46e3](https://github.com/event4u-app/agent-config/commit/0fc46e3e29220bcebfe6c97316309502ee2b7ee4))
* **wizard:** disambiguate the rule-loading / budget / model step ([122244c](https://github.com/event4u-app/agent-config/commit/122244c859b0c9da61e60a58fa220fb6c8f699d1))
* **cost-report:** recommend the model tier before rule loading ([2545c27](https://github.com/event4u-app/agent-config/commit/2545c277e5cc930a1e493dbf78e3ef3fe11933aa))
* **condense:** quote frontmatter descriptions in cursor/windsurf rules ([c69c9bb](https://github.com/event4u-app/agent-config/commit/c69c9bbb56bce9c01284db90936fd7b432278ffb))
* **install:** always overwrite our own deployed files, drop foreign-file gate ([25b593d](https://github.com/event4u-app/agent-config/commit/25b593d96da87e61f29844db088b01a346d07d81))
* **ci:** mirror memory.cadence into the source loader + TS settings schema ([2a74eff](https://github.com/event4u-app/agent-config/commit/2a74eff244c76830745c9d1e319d6abd5fe1d80b))
* **memory:** give the visibility-line cadence its own memory.cadence key ([e792390](https://github.com/event4u-app/agent-config/commit/e792390f59b01190769cba1f369bb574c83847bd))
* **rules:** trim non-destructive description to the 190-char schema cap ([b2a489e](https://github.com/event4u-app/agent-config/commit/b2a489ecf9fcbadf5232417f2503fddbab657fdb))
* **rules:** make production-branch commits a Hard-Floor opt-in (kernel) ([31f49a9](https://github.com/event4u-app/agent-config/commit/31f49a9af7fc0fb495556e8570e0adbfcb031416))
* **discovery:** register 'fun' in discovery-manifest schema enum ([7b91f12](https://github.com/event4u-app/agent-config/commit/7b91f12fa4e1e805a121a0fd7c9adb2760f5f122))

### Documentation

* **install:** record ADR-036 + roadmap Phase 6 for the browser-wizard handoff ([f3cc886](https://github.com/event4u-app/agent-config/commit/f3cc886618526b1c705a2a25c1ee98eb4063a188))
* **roadmap:** close + archive cost_profile untangle (phases 0-7; 4 items cancelled-with-follow-up) ([296b0da](https://github.com/event4u-app/agent-config/commit/296b0da47fc0ceed399438e4c5cb5801df0ea1b7))
* record cost_profile untangle (ADR-036 + BREAKING_CHANGES + disambiguation) ([efa658a](https://github.com/event4u-app/agent-config/commit/efa658acaef31bb1d1a9ddb565b5093b03f7d62e))
* **roadmap:** add cost_profile untangle roadmap ([708033c](https://github.com/event4u-app/agent-config/commit/708033cb5649c1d9583ea42a397795cf198b3493))

### Refactoring

* **settings:** rename cost_profile to rule_loading_tier across the suite ([21a31cb](https://github.com/event4u-app/agent-config/commit/21a31cb9746996324e9a49d82ad87084fb605c87))
* **fun:** English command name + expanded triggers ([62c960e](https://github.com/event4u-app/agent-config/commit/62c960eac79cdbc2883ac4727fe05d651f9497b8))

### Chores

* update agent work ([7ed0cbb](https://github.com/event4u-app/agent-config/commit/7ed0cbbe45e33757f8fa59048d6f9212110da8c1))
* sync agent-project-settings example pin to package.json (5.6.1) ([194a040](https://github.com/event4u-app/agent-config/commit/194a040628b21c2f61b1096f956f350eed131ec6))
* regenerate index + catalog after rename ([1c6dc68](https://github.com/event4u-app/agent-config/commit/1c6dc68416570f47bf8578d60c508f0acd185993))
* regenerate derived trees after merging main ([1f0ad58](https://github.com/event4u-app/agent-config/commit/1f0ad582d9a757acafd470d1fdd32adc362a2a49))
* regenerate derived trees for the prediction-pool rename ([bb3225f](https://github.com/event4u-app/agent-config/commit/bb3225fa91e78bfa640d33d501175b586cbd7de7))
* regenerate derived trees for pack-fun ([4125ba5](https://github.com/event4u-app/agent-config/commit/4125ba583cadd25ec29c23999287fc42fcc3d991))
* update condensation hashes after requires_skills frontmatter ([baf60e5](https://github.com/event4u-app/agent-config/commit/baf60e58328051176a519628dd56f879a5c4dd86))
* **roadmap:** re-examine lean-buildout disposition — 3.4 built, rest confirmed ([d88b633](https://github.com/event4u-app/agent-config/commit/d88b6332181013dc1757c317453519cadee3f63a))
* **roadmap:** close + archive lean-buildout roadmap (council-resolved) ([303ca6b](https://github.com/event4u-app/agent-config/commit/303ca6b6346298601fb789d08d003e023ab26ac4))

Tests: 5375 (+0 since 5.6.1)

## [5.6.1](https://github.com/event4u-app/agent-config/compare/5.6.0...5.6.1) (2026-06-01)

### Bug Fixes

* **mcp:** send bearer auth in post-deploy smoke probe ([9d12489](https://github.com/event4u-app/agent-config/commit/9d124894b03e5e962e8014171f965ce9367de58d))
* correct gzip kwarg in pack_mcp_content (condenselevel -> compresslevel) ([6d27677](https://github.com/event4u-app/agent-config/commit/6d2767736d6d20327a5853875fd4e9cb172babcc))

Tests: 5375 (+0 since 5.6.0)

## [5.6.0](https://github.com/event4u-app/agent-config/compare/5.5.0...5.6.0) (2026-05-31)

### Features

* **ai-video:** add /image command cluster (analyse/create/verify) ([9d53c81](https://github.com/event4u-app/agent-config/commit/9d53c81e3aed3549c4135a641e306a32fa224a68))
* **ai-video:** add image-analyser + image-creator character-fidelity skills ([b76a4db](https://github.com/event4u-app/agent-config/commit/b76a4db19d537ad5443f2c920c4701a49d08e584))
* **ai-video:** extend from-song + song-to-script + adapters; add media-sync-ground-truth rule ([dab9f0f](https://github.com/event4u-app/agent-config/commit/dab9f0f41e0d4b93eef423541269d54408bf36f4))
* **kernel:** kernel-budget soak — trim commit-policy + scope-control, fences byte-identical (Phase 1) ([b0547f0](https://github.com/event4u-app/agent-config/commit/b0547f0207df6e057e2ff97283391ddad88fd2e3))
* **schema:** tighten description caps + warning window (Phase 2.1); record 3.2 as obviated ([c65d3ae](https://github.com/event4u-app/agent-config/commit/c65d3ae8b569eb3507b83c31967231e64a31a742))
* **projection:** thin rule-layer projection behind a flag — measured -35,845 GPT tok (Phase 3.1) ([d786363](https://github.com/event4u-app/agent-config/commit/d7863635ee342ab61210ed14b95eeb1fface9582))
* **value:** drop the € comparison from the value dashboard — tokens only ([33f6fc8](https://github.com/event4u-app/agent-config/commit/33f6fc81e934ca426e5a4c82c37f41624228a636))
* **bench:** drop the monetary cost comparison — report tokens only ([1a2d3ad](https://github.com/event4u-app/agent-config/commit/1a2d3ad6a177122f0249bb903b3d7d74d62676e1))
* **audit:** unified audit:tokens analyzer + budget CI gate (Phase 0B.2/0B.4/1.3/1.4) ([c27061f](https://github.com/event4u-app/agent-config/commit/c27061fd47be600d79a5b0a8484a4061f9cdadfd))
* **safety:** trigger-coverage MUST-LOAD floor + thin-projection kill-switch (Phase 2) ([b210e0b](https://github.com/event4u-app/agent-config/commit/b210e0b9f402e26c813d6fd45e85fdad42876c1d))
* **budget:** add real-tokenizer measurement alongside chars (Phase 0B.1) ([1602d7f](https://github.com/event4u-app/agent-config/commit/1602d7f2f41a3d6b1069ad675583262542c970cf))

### Bug Fixes

* **ai-video:** add workspaces + packs to media-sync-ground-truth rule ([cebe846](https://github.com/event4u-app/agent-config/commit/cebe8465d5cc1b07c8426b91ab52c0fb07e79f5b))
* sync command count to 145 in README badge + browse lines ([7a881e2](https://github.com/event4u-app/agent-config/commit/7a881e243fe73faad725050d684af682445c4eda))
* **kernel:** restore 2nd 'Iron Law' mention in commit-policy (obligation-baseline regression from #310) ([693c287](https://github.com/event4u-app/agent-config/commit/693c28791cbe124942835c3b309ca72921ee13f5))
* **tools:** repoint audit_auto_rules + audit_command_surface to packages/core (Phase 2.3) ([fae234c](https://github.com/event4u-app/agent-config/commit/fae234cfda21372adb493b259a47e8a9a00a0036))
* **schema:** rule description cap 160 -> 190 (smoke gate treats over-cap as FAIL) ([72f05e0](https://github.com/event4u-app/agent-config/commit/72f05e02cca4e196e514d8f4f573ac9890f52583))
* **kernel:** repoint iron_law_sha to packages/core layout (Iron-Law SHA gate was broken) ([aab5755](https://github.com/event4u-app/agent-config/commit/aab57558f7047fc21d0107dbab5aa3b49ebe4e2f))
* **schema:** add lean_projection.mode to the settings schema (template-parity gate) ([51ed03e](https://github.com/event4u-app/agent-config/commit/51ed03ec9e74d4573b7da43a6b45804535986690))
* **bench:** repoint bench_runner SKILLS_DIR to .agent-src for packages/core layout ([e183527](https://github.com/event4u-app/agent-config/commit/e183527c0efa4e3fe7dfb6a9df2c1e21534925a8))

### Performance

* **projection:** minimal thin entries — measured saving 35,845 -> 45,182 GPT tok (77%) ([b1aabe0](https://github.com/event4u-app/agent-config/commit/b1aabe05a9e68aa87a8396f3276530d480582dbe))

### Documentation

* **roadmap:** honest dispositions for remaining build-out items ([68e8bb5](https://github.com/event4u-app/agent-config/commit/68e8bb5ab3ec95c516707d9b8e0f2bfd6f7c5ec9))
* **roadmap:** land Phase 0+2 of road-to-lean-initial-context; spawn build-out follow-up ([8b0bec2](https://github.com/event4u-app/agent-config/commit/8b0bec2efab7128fa4c45d186e3feea4ebd632f8))

### Chores

* update reports ([eb52977](https://github.com/event4u-app/agent-config/commit/eb52977cf398f6691e55fc063ba9f1b4f63f03b9))
* regenerate index + catalog for image skills + /image cluster ([f71f024](https://github.com/event4u-app/agent-config/commit/f71f024dba491ff36c071d9fd25d372e39b0c9c2))
* regenerate derived (router, marketplace, manifests, counts, command-surface) ([2fcc321](https://github.com/event4u-app/agent-config/commit/2fcc3214451bec3114dee0d55d7f03c0f3392ca0))
* archive road-to-character-image-fidelity (complete) ([ef16067](https://github.com/event4u-app/agent-config/commit/ef16067c0636a0c8279922bbb160531efb477ddb))
* track linter-debt roadmap + command-surface report (unrelated to lean-context) ([a52a604](https://github.com/event4u-app/agent-config/commit/a52a6048a55805e5a25b9dc68fd1e98091ba0fec))
* **router:** regenerate stale dist/router.json from source ([af782fe](https://github.com/event4u-app/agent-config/commit/af782fe179d7ba573ec916e48ac0b9e3752cf6f5))

Tests: 5375 (+39 since 5.5.0)

## [5.5.0](https://github.com/event4u-app/agent-config/compare/5.4.1...5.5.0) (2026-05-31)

### Features

* /skill:preview — non-destructive skill dry-run ([03ce5fc](https://github.com/event4u-app/agent-config/commit/03ce5fc757f9b42226083627ad7380dd0d895ef7))
* cross-repo retrieval + linked-projects:list (ADR-032 Option A) ([894e2e8](https://github.com/event4u-app/agent-config/commit/894e2e88c2a7e6744eb45a90907c634953aec0ec))
* /skills:discover — local, explained skill recommender ([d887c56](https://github.com/event4u-app/agent-config/commit/d887c561514b019f2ae1a3eca068087f4ffee351))
* meta-layer concept-surface audit tool + zero-cut evidence ([b4a7f3e](https://github.com/event4u-app/agent-config/commit/b4a7f3e5e87ab0c5aa4a820784fba09d8306284a))
* **video:** add /video:from-song music-video command + register in cluster ([05752df](https://github.com/event4u-app/agent-config/commit/05752dfd0837759923bf02f3731fecfb81dec9e7))
* **ai-video:** add probe-audio.sh hybrid audio segmentation ([41b4f8d](https://github.com/event4u-app/agent-config/commit/41b4f8dd57d1352df49bdc31bc81ea8e7e04f550))

### Bug Fixes

* classify command-cluster files as commands, not skills ([0fd25da](https://github.com/event4u-app/agent-config/commit/0fd25dad8f75cfb7021512e2905b23b24fea88c1))
* **ai-video:** portability + regenerate stale derived for from-song ([9d728b8](https://github.com/event4u-app/agent-config/commit/9d728b88687a6c27dfa647dd233fb4412f7e8d5a))

### Documentation

* reword execution-type mentions to dodge check-refs false positive ([dc84ed0](https://github.com/event4u-app/agent-config/commit/dc84ed01d3aa6845a1e15674ed1ec3ff3bbfb9ce))
* add discoverable BREAKING_CHANGES.md + major-bump rationale ([385b8a2](https://github.com/event4u-app/agent-config/commit/385b8a225b764cfe09a7e31640184140de4e07d9))
* **roadmap:** avoid check-refs false-positive on pack name ([bd02ef0](https://github.com/event4u-app/agent-config/commit/bd02ef0b07d27653dbec4971b984d1d12b75ac5e))
* **roadmap:** /video:from-song implementation roadmap + dashboard ([e4899c2](https://github.com/event4u-app/agent-config/commit/e4899c2c4f57b77bc62aa9187d4aa768ea6885f6))

### Tests

* **ai-video:** cover probe-audio segmentation + from-song registration ([9a58807](https://github.com/event4u-app/agent-config/commit/9a588071de1601337e6e65dc9b940b0a36dcfd42))

### Chores

* archive road-to-leaner-core-and-discovery (all phases complete) ([6b6b191](https://github.com/event4u-app/agent-config/commit/6b6b191f3b9ff328b9b7f3d6aa6eaf718e471934))
* regenerate core pack manifest with skill/skill:preview commands ([9bd88c9](https://github.com/event4u-app/agent-config/commit/9bd88c9b7b18bdd16ef2c77066aa485d96fc2b2f))
* register skills/skill/knowledge clusters + regen outputs ([1156566](https://github.com/event4u-app/agent-config/commit/1156566ad82647c596e47483d57b3fcb71f9a275))
* bump command count 135 -> 136 in README badge + browse lines ([82c27c3](https://github.com/event4u-app/agent-config/commit/82c27c3383f53d29735784bae5fb86a151c19e39))
* **ai-video:** regenerate manifests, counts, condensation hashes ([fe4dc28](https://github.com/event4u-app/agent-config/commit/fe4dc280437f209b31190a5117848feb92290015))

Tests: 5336 (+65 since 5.4.1)

## [5.4.1](https://github.com/event4u-app/agent-config/compare/5.4.0...5.4.1) (2026-05-30)

### Documentation

* **roadmap:** add road-to-leaner-core-and-discovery ([abf7074](https://github.com/event4u-app/agent-config/commit/abf7074913247a13c6c79b5be8c2ef49aba44aa4))

### Tests

* **condense:** assert new PATH-fallback hook command shape ([3e72789](https://github.com/event4u-app/agent-config/commit/3e727898e4ca4f66a3a7d414e48067950f6845e3))

Tests: 5271 (+22 since 5.4.0)

## [5.4.0](https://github.com/event4u-app/agent-config/compare/5.3.0...5.4.0) (2026-05-30)

### Features

* **backfill:** migrate 354 tags to model_tier + rename coverage gate ([e9fc491](https://github.com/event4u-app/agent-config/commit/e9fc49137bc360a25cad675a18f655be9f6fab94))
* **schema:** replace recommended_model with vendor-neutral model_tier ([f6fc281](https://github.com/event4u-app/agent-config/commit/f6fc281c1e9adf6a51327433375d8e7d8d3e0a96))
* **rule:** make model-recommendation tier-aware, suggestion-only off-Claude ([31d70b9](https://github.com/event4u-app/agent-config/commit/31d70b9bfbdd283742d546e6484400b595ec0174))
* **generator:** map model_tier → native Claude model (single owned mapping) ([029c0d0](https://github.com/event4u-app/agent-config/commit/029c0d0f4c6cb2cb6b17f8c63652ef2cfe24a99e))
* **backfill:** tag every skill + command with recommended_model + coverage gate ([acf7553](https://github.com/event4u-app/agent-config/commit/acf7553c8c975584228cfa32fb7320e1c095e174))
* **rule:** rewrite model-recommendation to act on recommended_model ([46b7acd](https://github.com/event4u-app/agent-config/commit/46b7acd9e180979e454416acf939ca554075fd55))
* **generator:** project recommended_model to native Claude model: key ([4f6d213](https://github.com/event4u-app/agent-config/commit/4f6d213a263f360ad0c63b64bbbd9a53ea4a36ea))
* **schema:** add recommended_model frontmatter field for skills + commands ([2fa81a3](https://github.com/event4u-app/agent-config/commit/2fa81a38fb4fd0b52e23ca537374b4d0277da5d6))

### Documentation

* **roadmap:** close + archive model-capability-tiers roadmap with evidence ([c52ba67](https://github.com/event4u-app/agent-config/commit/c52ba676c406cb7127470a01f13a12db56d9a7c1))
* **adr:** ADR-035 — vendor-neutral model capability tiers (supersedes ADR-034) ([efe656b](https://github.com/event4u-app/agent-config/commit/efe656b3d7d83dac910fc3e890bdfa8d9fd0a53b))
* **roadmap:** close + archive per-skill-model-autoswitch roadmap with evidence ([5150b64](https://github.com/event4u-app/agent-config/commit/5150b640b205141557196e40d70f7c23a0b2530c))
* **adr:** ADR-034 — per-skill model recommendation transport (Option A) ([9c18179](https://github.com/event4u-app/agent-config/commit/9c181790f7257841b4bf7aac6bf40d3c0adb6357))

### Chores

* update readme ([47cba5b](https://github.com/event4u-app/agent-config/commit/47cba5b5d7222b1c1b925041c30b82c06b815a10))

Tests: 5249 (+13 since 5.3.0)
