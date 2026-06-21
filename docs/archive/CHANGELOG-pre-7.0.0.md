# Changelog Archive — pre-7.0.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `7.0.0`, split out of the main
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

## [6.1.0](https://github.com/event4u-app/agent-config/compare/6.0.0...6.1.0) (2026-06-14)

### Features

* **rules:** Iron Law — never drop inherited/shared-branch commits without asking ([e03dc18](https://github.com/event4u-app/agent-config/commit/e03dc18300a2ef032d508062be032267a1f1f844))
* **workspace:** plain-language host-decision explainability + employee-mode gate (6.0.0 P5) ([f485476](https://github.com/event4u-app/agent-config/commit/f485476050d3d7660aa3aaeacc54438e5eee44a9))
* **governance:** workspace boundary contract + import-edge drift linter (6.0.0 P4) ([943eb29](https://github.com/event4u-app/agent-config/commit/943eb29747eb3dca0988317e2a526cd38d12f06c))
* **install:** preview-only dry-run for the upgrade-cleanup reaper (6.0.0 P2) ([4caa802](https://github.com/event4u-app/agent-config/commit/4caa802b1fd1bbf1beda71e5ad553000e7b7f2bf))
* **create-pr:** run the PR-gate archival sweep before opening the PR ([bdd645b](https://github.com/event4u-app/agent-config/commit/bdd645b3bcc7443c00df653d8f53982417d0ca3e))
* **roadmaps:** deterministic PR-gate archival sweep ([10643ca](https://github.com/event4u-app/agent-config/commit/10643ca9f5ff56ff02f376531e5c8c07998aa08d))
* **memory:** remove agent-memory Layer 2; file-first memory only ([c8903c6](https://github.com/event4u-app/agent-config/commit/c8903c6f3a5502434b29c1b55535a9ebc3c55ac4))
* **bench:** v2 pilot run + honest-null report; spawn stratified follow-up (Phase 4-6) ([5b7f7bd](https://github.com/event4u-app/agent-config/commit/5b7f7bd1112462f83ca42ef6509f4871cdba7ebe))
* **bench:** v2 dual-axis scorer + runner + paired stats (Phase 2-3) ([ae25ee2](https://github.com/event4u-app/agent-config/commit/ae25ee2c7a8b0fe6325a0c886911a8c48c7546d5))
* **bench:** v2 discipline-axis corpus + fixtures (Phase 0-1) ([1371dd0](https://github.com/event4u-app/agent-config/commit/1371dd05096c38c7f28f0c4a55b1daf2bb230500))
* **bench:** wrapper-lift A/B benchmark — model-pin, budget-cap, error-aware ([a09238a](https://github.com/event4u-app/agent-config/commit/a09238ad0455baaf6f68016a195ad54725acd3a3))
* **reasoning:** add model-agnostic Reasoning Discipline Protocol (RDP) ([b4b5bec](https://github.com/event4u-app/agent-config/commit/b4b5bec18f58630add4e7802c9e32b46b88f3084))
* **security:** Phase 3 consumer audit + runtime injection hook + review skill ([23efe50](https://github.com/event4u-app/agent-config/commit/23efe5001104c1fd7056f7b2216fc4583f7f29f3))
* **security:** Phase 2 injection-aware authoring rules ([eb41da9](https://github.com/event4u-app/agent-config/commit/eb41da9c7a1e3140d1efad760bd06e0bd53cb513))
* **security:** Phase 1 self-audit corpus linters + containment convention ([f678aba](https://github.com/event4u-app/agent-config/commit/f678abab7b521f389e16abb837594b3d23a38d5f))
* **ai-council:** resolve config user-global-first ([9177b52](https://github.com/event4u-app/agent-config/commit/9177b52a99842b3adffc21b325b39610ef520c6d))
* **ci:** guard against re-introducing external-source references ([88d35d9](https://github.com/event4u-app/agent-config/commit/88d35d913f5afec7db33f5817229b366cac7256f))
* **doctor:** add read-only stale-orphans health check ([48e6118](https://github.com/event4u-app/agent-config/commit/48e6118eab2e39fbfa1884a9f6defb1c8719a2ba))
* **packs:** split meta into capability-scoped packs ([b363839](https://github.com/event4u-app/agent-config/commit/b3638393a6c67ecaac41ae19df89b2ed0b03154b))
* **commands:** add first-class visibility frontmatter field ([db4d88d](https://github.com/event4u-app/agent-config/commit/db4d88dcf41629f27973624d6476f935be32e2c9))

### Bug Fixes

* **refs:** mark the RDP-contract acceptance criterion as a forward-ref ([c7cee96](https://github.com/event4u-app/agent-config/commit/c7cee966495a5c96932c9f2b71ab72aae517623f))
* **memory:** mine-session description ≤200 chars + command-count floor ([f368e06](https://github.com/event4u-app/agent-config/commit/f368e0667980e3f3a03233e8152fd23daaa8bc5d))
* **bench:** lint-bench-ab validates the v2 docs/benchmark.md sections ([41d552b](https://github.com/event4u-app/agent-config/commit/41d552bd3a162577be3a898fca9123cce87b38b9))
* **server:** mirror reasoning.* in settings schema (template parity + diff) ([5f77256](https://github.com/event4u-app/agent-config/commit/5f77256da1ecbfa03f3aa1261f23ec940991c2bc))
* **reasoning:** skill-lint senior sections + valid rule tier (2b) ([7f3e278](https://github.com/event4u-app/agent-config/commit/7f3e2789ab483b6938a39aac303f1fbe2f35792e))
* **security:** refresh threat-model command effective-hash ([5505b57](https://github.com/event4u-app/agent-config/commit/5505b57fa6e4e4bf02e2891f49a30e6dc9128da1))
* **security:** tighten security-sensitive-stop — clear long_rule lint regression ([d528126](https://github.com/event4u-app/agent-config/commit/d528126120bf51335267bdde66793343ec376c87))
* **security:** list agent-security-review + security-audit-config in marketplace.json ([f432a62](https://github.com/event4u-app/agent-config/commit/f432a62d42fab5fc6707b166e869ca8cc2d5d866))
* **security:** CI — portability reword + settings-schema parity for injection_scan ([fa78a58](https://github.com/event4u-app/agent-config/commit/fa78a589101fd41984d85496666f2fd618e49a1f))
* **cli:** preflight dependency guard with an actionable message ([ce58c76](https://github.com/event4u-app/agent-config/commit/ce58c7683541a3bc22852186a9764be127f87e4b))
* **repo:** untrack stray node_modules symlink, ignore symlink form ([67cc9e6](https://github.com/event4u-app/agent-config/commit/67cc9e61deb241aa23e9affaa5adc1fd92d99f14))
* **refs:** exempt gitignored agents/.harvest-local in check_references ([0d0b170](https://github.com/event4u-app/agent-config/commit/0d0b1702c27c06e96d486211f639148f7ed0628e))
* **refs:** mark gitignored harvest-local ref in security-pillar roadmap ([3abf215](https://github.com/event4u-app/agent-config/commit/3abf215692cf49ac190248c0007668b5a7b1e1f0))
* **ci:** guard against empty (0-byte) roadmap files ([5115865](https://github.com/event4u-app/agent-config/commit/511586591171735437bba8cdb106094628a3d611))
* **roadmaps:** restore competitive-borrow v6 work, drop empty reaping stub ([9fceeb7](https://github.com/event4u-app/agent-config/commit/9fceeb7fc9585965f44e25543a9699d0ff8ee519))
* **ai-council:** align user-global config path with the setup wizard ([54de5a8](https://github.com/event4u-app/agent-config/commit/54de5a853c271311d79b2b436dd3fa58fa25eb69))
* **rule:** drop non-portable task-invocations from source-confidentiality backstop ([57e6f7f](https://github.com/event4u-app/agent-config/commit/57e6f7fe5199cc5192ead2a1468ad7d04dd5d5bc))
* **install:** always-run tag sweep so reaping catches pre-inventory orphans ([91e5418](https://github.com/event4u-app/agent-config/commit/91e541852c30899cb84dd2070f705dfe7947d350))
* **discovery:** register visibility + new capability packs in schema/vocab ([1fcc72b](https://github.com/event4u-app/agent-config/commit/1fcc72b08fbd13f85c01d3df7fbc98790395ac91))

### Documentation

* **domain-watch:** capture deferred heavyweight tracks in one watch-note (6.0.0 P6) ([e212e1f](https://github.com/event4u-app/agent-config/commit/e212e1fcebed5d61c63d0719deb485787aca6fde))
* **changelog:** add 6.0.0 release overview + breaking-changes section (6.0.0 P3) ([fdb4b63](https://github.com/event4u-app/agent-config/commit/fdb4b63cd495489341215430ae12a9866cb8503b))
* fix stale source-of-truth paths and drop above-fold jargon (6.0.0 P1) ([9ee9870](https://github.com/event4u-app/agent-config/commit/9ee98708e1fdcf612848b393aace48b33a548e99))
* **roadmaps:** add capability-discoverability follow-up from fable-feedback-3 ([a658c2f](https://github.com/event4u-app/agent-config/commit/a658c2f9c338182d1db2db503ab8ce6aa9c1f42f))
* **model-recommendation:** add orchestrator→subagent model-routing guidance ([669f83d](https://github.com/event4u-app/agent-config/commit/669f83de5b2e6de590d87f7a093eb098bcf8a086))
* **roadmaps:** add RDP discoverability roadmap ([c65e1b2](https://github.com/event4u-app/agent-config/commit/c65e1b2648af8bfd2a39a6c6dc74124cfc67101b))
* **roadmaps:** revise discipline-axis pilot for weak-host-first methodology ([9ccb816](https://github.com/event4u-app/agent-config/commit/9ccb816b1fe449cb537567696487c09a4ea2ee8e))
* **rules:** replace Merge-gated with PR-gate in roadmap-progress-sync ([c140687](https://github.com/event4u-app/agent-config/commit/c1406876e880babd70a178bb958af89f31c49eec))
* **roadmaps:** memory-layer-cleanup removal + consolidation plans ([254758f](https://github.com/event4u-app/agent-config/commit/254758f1a24d7898b5828a3396d20b7498370d08))
* **roadmap:** check-refs:skip discipline-axis bench (external repo citations) ([13c5fdb](https://github.com/event4u-app/agent-config/commit/13c5fdb04016c40488140f59688e9db88eee0d9d))
* **roadmaps:** agent-memory removal + memory-pipeline consolidation plans ([6fbf6a6](https://github.com/event4u-app/agent-config/commit/6fbf6a6d33571839f8c85b276a8728ff62c606c7))
* **roadmaps:** 3-condition value bench (v1) + discipline-axis bench (v2) ([f5a89c6](https://github.com/event4u-app/agent-config/commit/f5a89c69e60c345dbb655f3b0dab294d2b56669a))
* **roadmaps:** RDP eval+promotion follow-up; archive frontier-reasoning parent ([417223b](https://github.com/event4u-app/agent-config/commit/417223bce4a4d04404512cfa804ad872dd11324c))
* **roadmap:** security pillar — supply-chain integrity + injection-aware authoring ([c15ef6a](https://github.com/event4u-app/agent-config/commit/c15ef6adc17226513660b324b7960dc80125bbf3))
* **roadmap:** fill in road-to-6.0.0-final-readiness ([46ba5a0](https://github.com/event4u-app/agent-config/commit/46ba5a002fb300afbce43e56b92a945bd0957dec))
* **roadmap:** add image/brand/typography + greenfield-scaffold roadmaps ([f615452](https://github.com/event4u-app/agent-config/commit/f6154528a7b1ba34fb5543c91ac2c905999d2e8c))
* **ai-council:** repoint config references to the user-global path ([1307f80](https://github.com/event4u-app/agent-config/commit/1307f804b2c1cc4a2b9a3d2ad1b829f2a7108619))
* **ai-council:** document user-global config location (ADR-093) ([c501e55](https://github.com/event4u-app/agent-config/commit/c501e557fdb94d7214555a3b53042a275b2dc923))
* **roadmap:** competitive-borrow plan (source-anonymous) ([9e3c692](https://github.com/event4u-app/agent-config/commit/9e3c692745170ad62b0f67d40afa8aad751e34dd))
* **roadmap:** close metadata-leanness, spawn tier-removal follow-up ([93d5361](https://github.com/event4u-app/agent-config/commit/93d5361d05d5ddef944d4931c6260e69464d8270))
* **adr:** ADR-092 defer command tier-alias removal (forcing-function) ([71d2630](https://github.com/event4u-app/agent-config/commit/71d26300d14c9b894dfef19ed6a6b3c996f5895f))
* **roadmap:** metadata & command-surface leanness plan + evidence ([b31d106](https://github.com/event4u-app/agent-config/commit/b31d1061f5816eb3a8aadd4bd154e76ee00d089a))
* **roadmap:** archive completed reaping-orphans fix plan ([c1ed447](https://github.com/event4u-app/agent-config/commit/c1ed4478f14c634c5fde5dbed224f72ae2c6eedb))
* record evidence-gated decisions, archive residuals roadmap ([3657e12](https://github.com/event4u-app/agent-config/commit/3657e12fbcacb4740b4d1d84309d7dea28cd3c58))

### Refactoring

* **ai-council:** relocate config out of the repo to user-global ([17fb14a](https://github.com/event4u-app/agent-config/commit/17fb14a03736cb14f2f56861f194e5bfc00e80b9))
* **commands:** fold fix:pr-bot/developer-comments into fix:pr-comments ([4c1c1c8](https://github.com/event4u-app/agent-config/commit/4c1c1c8795d422e1ba8d5ae77409f43f3b8fb2e5))

### Tests

* lower command-surface floor to 148 after fix:pr-* fold ([2b5e9ef](https://github.com/event4u-app/agent-config/commit/2b5e9ef7f6a8160aac6d2d26bb2876d7d8ed1427))
* **install:** lock the reaping-gap class against regression ([d7ca6d0](https://github.com/event4u-app/agent-config/commit/d7ca6d0f967672d02d0b367fcfa408f6d675a220))

### CI

* **skill-lint:** also enforce rule tiers + guard the CI wiring ([6cde280](https://github.com/event4u-app/agent-config/commit/6cde2809c5ace248807236dee9634a590955795d))
* **skill-lint:** run lint-command-tiers on every PR ([2e123c6](https://github.com/event4u-app/agent-config/commit/2e123c696a6bf2047cbc4473a9555c51b8f33da8))

### Chores

* **roadmaps:** complete + archive road-to-6.0.0-final-readiness (6.0.0) ([652294a](https://github.com/event4u-app/agent-config/commit/652294ad01ad48a2875ebd75953b82d06c350e56))
* **roadmaps:** archive completed memory-layer-cleanup roadmaps ([9380482](https://github.com/event4u-app/agent-config/commit/9380482cf512c73f0783ff7a2270793d5dca8b95))
* **memory:** regenerate pack manifest for shortened mine-session description ([14cec0e](https://github.com/event4u-app/agent-config/commit/14cec0ed0c6de254639e3727d7ad1f3a3147902e))
* **memory:** regenerate projections, catalogs, and dashboard ([78cc1a1](https://github.com/event4u-app/agent-config/commit/78cc1a1180f6eced4c60e0c408da1103d0621ab0))
* **roadmaps:** regenerate progress dashboard ([d0d2757](https://github.com/event4u-app/agent-config/commit/d0d2757e93026fab6f995732a130f126371e7978))
* **security:** archive road-to-security-pillar (Phases 1-3 shipped) ([ad5f552](https://github.com/event4u-app/agent-config/commit/ad5f55204bae429b960db40976c3dc40ea759f97))
* **security:** bump command-count messaging 148→149 (new /security-audit-config) ([5f5b79a](https://github.com/event4u-app/agent-config/commit/5f5b79a1d741b1565cfbc0aaf8c74aa43165fd0b))
* **security:** regenerate dist, router, counts, pack manifests ([84ff0fc](https://github.com/event4u-app/agent-config/commit/84ff0fcd1216fbbd05a3a340148f681b95c2d4a8))
* add uncomitted roadmaps ([699c2c5](https://github.com/event4u-app/agent-config/commit/699c2c5e8a70453a46b9c70e68ba621f96a5f64c))
* **condense:** reconcile stale condensation hashes ([d9ac27e](https://github.com/event4u-app/agent-config/commit/d9ac27e232cc60dba941f75632dde9a5bbd2c4db))
* add uncomitted roadmaps ([28ff06c](https://github.com/event4u-app/agent-config/commit/28ff06ce3741db46a5d39e1bc0a2a698d3a94c1f))
* **rules:** track anonymized harvest roadmaps; harden source-confidentiality ([bc77fb9](https://github.com/event4u-app/agent-config/commit/bc77fb93476c8045cd227f94ad09b0f1f3cebbdd))
* sync stale condensation for work / agents-init / agents-optimize ([0f816ca](https://github.com/event4u-app/agent-config/commit/0f816cae017824af718cd750457bfc1476252927))
* sync command-count messaging to 148 after fix:pr-* removal ([94097ce](https://github.com/event4u-app/agent-config/commit/94097ce0bee1739d2f54688705b1aaf78a73cee4))
* sync stale condensation hashes for unchanged command files ([a32da9a](https://github.com/event4u-app/agent-config/commit/a32da9a5c4199d1148549f63bf7c0012496cd2b6))
* remove external-source references from the tracked tree ([3248611](https://github.com/event4u-app/agent-config/commit/3248611a8ae2e7d0574ba8e121f85077faae9f69))
* **commands:** backfill visibility + re-tag pack across command sources ([d08f5b6](https://github.com/event4u-app/agent-config/commit/d08f5b6550735db22f4f855f155d2fd91a8dc047))
* **changelog:** split era 5.9.x → pre-6.0.0 ([c442750](https://github.com/event4u-app/agent-config/commit/c44275053c07352402e162d6accbe67f6d380010))

Tests: 6068
