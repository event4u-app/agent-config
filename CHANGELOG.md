# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).
Entry-shape contract: [`docs/contracts/CHANGELOG-conventions.md`](docs/contracts/CHANGELOG-conventions.md).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.
>
> History is split into **eras**. The current era keeps full entries
> inline; prior eras collapse into a single pointer to an archive file
> under [`docs/archive/`](docs/archive/). A drift test
> (`tests/test_changelog_eras.py`) forces an era split before the
> current era grows past 250 lines.

## [Unreleased]

### Added

- **Doc-follows-code discipline** — deterministic, framework-agnostic mechanism
  so documentation is updated when code changes.
  - `downstream-changes` rule gains a first-class **Doc-Impact** obligation:
    a change to a public surface (route, exported signature, CLI flag, config/
    settings key, env var, DB schema, event payload) is incomplete until the
    doc that describes it is updated in the same change; escape hatch for
    refactor-only / no-surface changes.
  - `agent-docs-writing` skill: the advisory doc-sync table becomes an
    actionable, cross-stack Doc-Impact procedure with a falsifiable-claim
    fire/no-fire test.
  - `check_source_pointer_freshness` CI gate — fails when an authoring file
    names the retired `.agent-src.uncondensed/` tree as source of truth.
  - Opt-in consumer CI template `github-workflows/doc-impact.yml` (warn-first,
    `[docs:not-needed]` / `refactor:` escape hatch, `STRICT` toggle).

### Fixed

- Source-of-truth pointer drift: `src/agent-src/README.md` and the
  `agents-md-thin-root` skill named the retired `.agent-src.uncondensed/`
  tree; corrected to `src/`.

> The former "6.0.0 at a glance" overview was drained on 2026-07-21 to
> [`docs/archive/CHANGELOG-6.0.0-overview.md`](docs/archive/CHANGELOG-6.0.0-overview.md).

# Era: pre-4.5.0 — archived

> All entries before `4.5.0` live in
> [`docs/archive/CHANGELOG-pre-4.5.0.md`](docs/archive/CHANGELOG-pre-4.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-5.4.0 — archived

> All entries before `5.4.0` live in
> [`docs/archive/CHANGELOG-pre-5.4.0.md`](docs/archive/CHANGELOG-pre-5.4.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-5.9.0 — archived

> All entries before `5.9.0` live in
> [`docs/archive/CHANGELOG-pre-5.9.0.md`](docs/archive/CHANGELOG-pre-5.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-6.0.0 — archived

> All entries before `6.0.0` live in
> [`docs/archive/CHANGELOG-pre-6.0.0.md`](docs/archive/CHANGELOG-pre-6.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-7.0.0 — archived

> All entries before `7.0.0` live in
> [`docs/archive/CHANGELOG-pre-7.0.0.md`](docs/archive/CHANGELOG-pre-7.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-8.0.0 — archived

> All entries before `8.0.0` live in
> [`docs/archive/CHANGELOG-pre-8.0.0.md`](docs/archive/CHANGELOG-pre-8.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-8.1.0 — archived

> All entries before `8.1.0` live in
> [`docs/archive/CHANGELOG-pre-8.1.0.md`](docs/archive/CHANGELOG-pre-8.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-8.9.0 — archived

> All entries before `8.9.0` live in
> [`docs/archive/CHANGELOG-pre-8.9.0.md`](docs/archive/CHANGELOG-pre-8.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-8.12.0 — archived

> All entries before `8.12.0` live in
> [`docs/archive/CHANGELOG-pre-8.12.0.md`](docs/archive/CHANGELOG-pre-8.12.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.2.0 — archived

> All entries before `9.2.0` live in
> [`docs/archive/CHANGELOG-pre-9.2.0.md`](docs/archive/CHANGELOG-pre-9.2.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 9.2.x — current

> Started at `9.2.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.3.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.7.0](https://github.com/event4u-app/agent-config/compare/9.6.0...9.7.0) (2026-07-21)

### Features

* **templates:** opt-in consumer doc-impact CI workflow ([c02c878](https://github.com/event4u-app/agent-config/commit/c02c87810d0ee60f8544f17c9d7cefdafc59c826))
* **scripts:** add check_source_pointer_freshness CI gate + test ([f5895f7](https://github.com/event4u-app/agent-config/commit/f5895f784da4cc4c0d5b93fd55629589ec2f56c4))
* **rules,skills:** docs-follow-code — Doc-Impact discipline + fix source-of-truth pointer drift ([9f8f666](https://github.com/event4u-app/agent-config/commit/9f8f6665d9ea3b1baa48a3aa2b30a516b9878912))
* **bench:** adversarial-council residual-detection corpus + harness ([784202e](https://github.com/event4u-app/agent-config/commit/784202e5a33d94c0fe507cfb526e9dd2487dc89a))

### Bug Fixes

* **ci:** exempt check_source_pointer_freshness from the legacy-path guard ([5254683](https://github.com/event4u-app/agent-config/commit/5254683f492bb52e8fe3262f08b91a240867e3be))
* **bench:** typecheck + lint the adversarial-council runner ([14e81cd](https://github.com/event4u-app/agent-config/commit/14e81cd9f2034a66b448b70440f77916ed054d5d))
* **security:** close GIT_CONFIG_* config-injection RCE residual in hardenedSpawnEnv ([48941a6](https://github.com/event4u-app/agent-config/commit/48941a6d3be2bd125758f7899690e5bf36bb2843))

### Documentation

* **roadmap:** archive completed road-to-doc-follows-code ([2695aad](https://github.com/event4u-app/agent-config/commit/2695aade3be5e4a87acd19af8032c655e3bd10fe))
* **changelog:** record the docs-follow-code discipline under [Unreleased] ([54703a5](https://github.com/event4u-app/agent-config/commit/54703a5e930e01a2a124e22ded5ef5fc3aadfbd8))
* **roadmap:** archive completed adversarial-council-benchmark roadmap ([ae30ddb](https://github.com/event4u-app/agent-config/commit/ae30ddb4156365d17ac97c8ff1af7c5902c76337))
* **bench:** resolve adversarial-council-finding-coverage — HONEST NULL ([9bd5fe4](https://github.com/event4u-app/agent-config/commit/9bd5fe489fb9a324da9a096fc4170e820d7b2888))
* **roadmap:** archive completed changelog-unreleased-drain roadmap ([361f72f](https://github.com/event4u-app/agent-config/commit/361f72fe681e04b0ab717314c2fdb24e13939048))
* **changelog:** drain the stale 6.0.0 fossil out of [Unreleased] ([ca99ced](https://github.com/event4u-app/agent-config/commit/ca99ced83eee2b23ea18b33f9852cfe718ebbb2f))
* **roadmap:** archive completed spawn-env-completion roadmap ([c4fd083](https://github.com/event4u-app/agent-config/commit/c4fd0839c83f2c580bb08ce2581bcceb8d62d095))
* **security:** spawn-site policy inventory + ADR-123 follow-up (lint rejected) ([bec13d1](https://github.com/event4u-app/agent-config/commit/bec13d1c7acb0a17e2d8a561ca279a6cebb97446))
* drop serial comma in README + package.json prose ([dec73af](https://github.com/event4u-app/agent-config/commit/dec73affaca0a000c5fab656017be15c67e0f884))

### Tests

* **changelog:** guard [Unreleased] against at-a-glance fossil reopening ([75993e4](https://github.com/event4u-app/agent-config/commit/75993e4426bb2b103ae89706d59a70195513d624))

### Chores

* **condense:** re-mark 19 commands after dependency-hash cascade ([07ddac7](https://github.com/event4u-app/agent-config/commit/07ddac7a80661693852ae68ce31d530020d95305))
* **ci:** guard README against serial-comma drift ([a7caa83](https://github.com/event4u-app/agent-config/commit/a7caa83e0771244e16845505028f812f59d26624))

Tests: 7854 (+16 since 9.6.0)

## [9.6.0](https://github.com/event4u-app/agent-config/compare/9.5.0...9.6.0) (2026-07-20)

### Features

* **commands:** collapse the proactive suggestion surface to cluster-head journeys ([09d9cb3](https://github.com/event4u-app/agent-config/commit/09d9cb3abd78c5181cacf114eb05eb6ed6b54bcd))

### Bug Fixes

* **hooks:** route consumer-runtime spawn sites through hardenedSpawnEnv ([835af7f](https://github.com/event4u-app/agent-config/commit/835af7fb09818a03fc8efa6058f5bf3a148519d0))
* **ai-council:** scrub subprocess env to close spawn-inheritance RCE ([634486b](https://github.com/event4u-app/agent-config/commit/634486b6d72b739a9add0ef6555c66875d3d2f63))
* **consolidation:** add rationale to de-eligibled subs; head absorbs the sub's intent ([bc2b479](https://github.com/event4u-app/agent-config/commit/bc2b4799c07c8e0c4bdd651dca3218aeac90e6a5))

### Documentation

* **roadmap:** archive completed runtime-security-hardening roadmap ([dae91c4](https://github.com/event4u-app/agent-config/commit/dae91c4d9faa8b12d38c1527b892069a735b5c85))
* **security:** record runtime-security scope decision (ADR-123) ([efb2272](https://github.com/event4u-app/agent-config/commit/efb22723c2b42b390bad0eda0ace106c32d60b3b))
* **roadmap:** road-to-surface-consolidation — Phase 1 done, Phase 2 folded ([c84e182](https://github.com/event4u-app/agent-config/commit/c84e18212658d038cfda0bfe50176bdc01bac6a4))
* **consolidation:** fold the complexity-budget checklist + record restraint decisions ([6f864c9](https://github.com/event4u-app/agent-config/commit/6f864c9452d857f8f019bd27890214b6bff431a9))

Tests: 7838 (+5 since 9.5.0)

## [9.5.0](https://github.com/event4u-app/agent-config/compare/9.4.0...9.5.0) (2026-07-20)

### Features

* **bench:** defect-finding runner + results (team-mode Phase 5 Steps 2-4) ([aca13fd](https://github.com/event4u-app/agent-config/commit/aca13fd0c212a1af31c0715bf56db1972d819d0b))
* **bench:** pre-registered defect-finding corpus (team-mode Phase 5 Step 1) ([e7b5300](https://github.com/event4u-app/agent-config/commit/e7b5300d39fa6f2e9ac4fb0d42934cb08d8a9382))

### Documentation

* **roadmap:** close team-mode Phase 5 on the honest-null verdict ([2ff25dd](https://github.com/event4u-app/agent-config/commit/2ff25dd2837872f2ff36139839abc9211d7e7305))
* **proof:** record the team-mode defect-finding honest null (Phase 5 Step 4-5) ([908284a](https://github.com/event4u-app/agent-config/commit/908284a9dc20d067aaaf1305b3c352f260c88e82))

Tests: 7833 (+0 since 9.4.0)

## [9.4.0](https://github.com/event4u-app/agent-config/compare/9.3.0...9.4.0) (2026-07-20)

### Features

* **self-review:** large-diff / claim-affecting ai-council escalation (detect + recommend) ([1308e22](https://github.com/event4u-app/agent-config/commit/1308e220179600424d4ac590ae9295b522f3f22c))
* **council:** cross-round prompt-cache read unlock ([5faf32b](https://github.com/event4u-app/agent-config/commit/5faf32bc3b0522e7e0af3b28a108ce808133a56e))
* **council:** auto model-tiering gated on the A1<->A3 cache coupling ([1a693bf](https://github.com/event4u-app/agent-config/commit/1a693bffe79addde715becc9a366c5185e9545b9))
* **council:** stance repair fires only on genuinely unparseable STANCE ([40196bd](https://github.com/event4u-app/agent-config/commit/40196bdac2489dc50ac1213976e776d94f3f89c7))
* **adoption:** wedge promise, opt-in first-run instrument, honest positioning surface ([c93e314](https://github.com/event4u-app/agent-config/commit/c93e314b102ba437afcbef994306a5f0c42d2476))
* **routing:** reciprocal cluster routing for the weighted-matrix mode ([6be7bc5](https://github.com/event4u-app/agent-config/commit/6be7bc5b7d042bdfc000c5a51270a7c9da5a2f28))
* **skill:** weighted-matrix mode in decision-record ([7eaf4db](https://github.com/event4u-app/agent-config/commit/7eaf4db125eebe19cb0d57ac32f15f917530b206))
* **command:** /contribution-precheck — contributor self-service gate subset ([5e7de9b](https://github.com/event4u-app/agent-config/commit/5e7de9b6b828653bb0e49e1711f42ee56c18e4cd))
* **catalog:** provenance source column + CREDITS.md ([10cca8a](https://github.com/event4u-app/agent-config/commit/10cca8af8a244aa30d0ee036126e24c506c82e48))
* **ci:** wire lint_originality --changed as the originality-gate PR job ([00c3754](https://github.com/event4u-app/agent-config/commit/00c3754df8d9a95c30a84c294bfb3ab9cfbbe509))
* **skills:** add learning-tutor skill — six structured tutoring modes ([8ed343d](https://github.com/event4u-app/agent-config/commit/8ed343d282ad669489866cda84a6a214f1943ca6))
* **skill:** evaluate-llm-feature — black-box LLM-feature evaluator ([b94249f](https://github.com/event4u-app/agent-config/commit/b94249fb067c39d8fa5c8f4fa6cfe2b1290e336b))
* **flows:** optional team annotation + resolver ([7b14ed5](https://github.com/event4u-app/agent-config/commit/7b14ed5cbba5bec6b4e5500fb68c6770ad7d5f87))
* **mcp:** lazy catalog router — index, scoring, stub tools ([d17b9e0](https://github.com/event4u-app/agent-config/commit/d17b9e05fc5742f922177febab086c4723796029))
* **originality:** anti-reskin shingle-overlap gate ([dae4760](https://github.com/event4u-app/agent-config/commit/dae4760c7b041844bde10fa3e2eb6ae5f34a9fa6))

### Bug Fixes

* **skill:** keep subagent-orchestration under the 400-line size gate ([c419da9](https://github.com/event4u-app/agent-config/commit/c419da949db135c6c1723d85e78906669ee881a2))
* **portability:** drop task-ci literals from the shipped precheck command ([a0d83d3](https://github.com/event4u-app/agent-config/commit/a0d83d33984847143749131fe0e01509c72edbbb))
* **ci:** CAPABILITIES 277 count + defang injection-probe examples ([c1d4036](https://github.com/event4u-app/agent-config/commit/c1d4036dd615fa2bcbd670e66583f8eac15fbb6a))
* **originality:** close the adversarial DF batch-masking hole ([dd84403](https://github.com/event4u-app/agent-config/commit/dd8440363a7ecda67934cca27cb0df4b69ba34e6))
* **mcp:** version the catalog-index cache filename ([93d980a](https://github.com/event4u-app/agent-config/commit/93d980aff254ceb9d31bf290f36a249377e81eea))

### Documentation

* **team:** CHANGELOG entry + close-out (Phase 6 + prereqs); upstream re-verified ([a6405c5](https://github.com/event4u-app/agent-config/commit/a6405c5ade5e4e1a22c7cb60eaf0d31f7f212b9e))
* **team:** three-way router disambiguation cross-links (council / team / subagents) ([f82ed16](https://github.com/event4u-app/agent-config/commit/f82ed168f81c48ef98b0e561f44bc13c8691ce77))
* **self-review:** document the escalation path; flip Phase 1 step (part c) ([9f26716](https://github.com/event4u-app/agent-config/commit/9f267166b1305f9833f89ae8119638105ecd42c1))
* **roadmap:** archive road-to-api-cost-optimization — A3 executed, fully closed ([94e2044](https://github.com/event4u-app/agent-config/commit/94e20444f215491d6f5350b09910d37a928a090e))
* **cost:** B2 index-branch pointers (deferred follow-up closed) ([7d68245](https://github.com/event4u-app/agent-config/commit/7d68245ebc013b5fa05f0790473e910e45227a5e))
* **roadmap:** adoption roadmap — second autonomous slice landed ([0febec6](https://github.com/event4u-app/agent-config/commit/0febec66d629dc2cca6410bfaa07c841711e1966))
* **announcements:** draft the honest-launch story (drafted, not posted) ([8e1b757](https://github.com/event4u-app/agent-config/commit/8e1b757f53f367c1fdc7d7150eed4ff8edc1e426))
* **roadmap:** archive road-to-weighted-decision-matrix — fully executed ([4586dcd](https://github.com/event4u-app/agent-config/commit/4586dcd5432c618ffd007af2f0977a24249945aa))
* **roadmap:** originality-gate + contributor-funnel roadmap, executed and parked ([4d0e73b](https://github.com/event4u-app/agent-config/commit/4d0e73b67298cd78b509778514ab170fcc75e930))
* **probe:** anti-reskin-gate demand probe + extraction floor ([b849580](https://github.com/event4u-app/agent-config/commit/b8495802f93a966bcf5808e01b15b93e4017fd9a))
* **roadmap:** complete + archive the ecosystem-harvest index hub ([e1752d1](https://github.com/event4u-app/agent-config/commit/e1752d176fbf948aff364fb1271532164bb2b755))
* regenerate proof page for the new skill count (277) ([2476284](https://github.com/event4u-app/agent-config/commit/247628404098690ba2f68fa1bef6fdba1753ee13))
* **roadmap:** complete + archive ecosystem-harvest domain-watch ([d07e81e](https://github.com/event4u-app/agent-config/commit/d07e81e017a90e92863d9bcffd1818b232fefaeb))
* **domain-watch:** watch-notes for the two gated verticals ([26bb9dd](https://github.com/event4u-app/agent-config/commit/26bb9dd77c7c6adb1bebc9677f5096d8e66ef999))
* **roadmap:** correct the flip-gate checkbox and tighten the flow-team criterion ([89a2d26](https://github.com/event4u-app/agent-config/commit/89a2d26721090cc7545a19ef73877689a445420f))
* **roadmap:** persona-library harvest — executed and archived ([1c6940a](https://github.com/event4u-app/agent-config/commit/1c6940a2693c94ad366ddc31f791d13870da6d07))
* correct outdated Antigravity host claims ([fca90e2](https://github.com/event4u-app/agent-config/commit/fca90e2c3413465e0a4bfbfd65d1da01ea15bef7))

### Chores

* **meta:** sync pack README with shortened precheck description ([601fdc1](https://github.com/event4u-app/agent-config/commit/601fdc111553d8d4c55796d43c3203d938b5c179))
* **ci:** wire lint-originality and validate-flow-teams into the pipeline ([48bc88a](https://github.com/event4u-app/agent-config/commit/48bc88a2ce24bfffd1f98e4194163986b3adf245))

Tests: 7833 (+63 since 9.3.0)

## [9.3.0](https://github.com/event4u-app/agent-config/compare/9.2.0...9.3.0) (2026-07-16)

### Features

* **ergonomics:** harvest ergonomics plate — tdd cluster, fix:route, persona-improvement, hand-off examples ([e8be16f](https://github.com/event4u-app/agent-config/commit/e8be16f2a0194a6b6cb3b2ed4a9899db31067d1d))
* **review:** wire reuse + OOP-shape lens into the review/orchestration surfaces ([067175a](https://github.com/event4u-app/agent-config/commit/067175a04c1d49c356bf8e42c4cb0f23b3d91473))
* **hooks:** PostToolUse PR-URL reminder — reply-shape backstop for direct-answers ([1bf82a1](https://github.com/event4u-app/agent-config/commit/1bf82a1f23fd2fac7ae86fe1fae3cc6b3e0da657))

### Bug Fixes

* **counts:** regenerate command-flows.md (+5 commands) + map explain-run orphan into surface-map ([a6254e4](https://github.com/event4u-app/agent-config/commit/a6254e434e966eaca9e697093980dfc3cc04a8d8))
* **hooks:** pre-push gate mirrors the full CI consistency check locally ([ebd706f](https://github.com/event4u-app/agent-config/commit/ebd706fb1e978189954ca838bc41bd3f536ee560))

### Documentation

* refresh guideline counts (100 -> 101) after the new dev-standard guideline ([02ac1a5](https://github.com/event4u-app/agent-config/commit/02ac1a53214b5cd22eecee873e2b81286c01a6b2))
* **standards:** apply council findings — paradigm-appropriate + minimal-diff precedence ([474b1c6](https://github.com/event4u-app/agent-config/commit/474b1c68b8a28dd1f5302b135fbe69876696ea6f))
* **standards:** component-oriented + OOP-first development standard ([5bd62bd](https://github.com/event4u-app/agent-config/commit/5bd62bdf14208f65ae166b954a5c7b4e49211ffa))
* **roadmaps:** council-review + apply findings to feedback-9.2.0 followups ([dc187d4](https://github.com/event4u-app/agent-config/commit/dc187d4b83debda1c4f8c551acfc6400149da520))
* **roadmaps:** draft feedback-9.2.0 follow-ups roadmap ([69d363d](https://github.com/event4u-app/agent-config/commit/69d363df10f5e9dd6605ba6af370ac1d477a5a92))
* **roadmaps:** spawn adversarial-council benchmark follow-up; mark deferred arm moved ([36a69d9](https://github.com/event4u-app/agent-config/commit/36a69d9f00b4a236535ea01bf8dd36a4d82f1293))

### Refactoring

* **subagent-orchestration:** relocate worker-prompt contract to spawn-contract context ([de38ce1](https://github.com/event4u-app/agent-config/commit/de38ce12ff167eafe7a0631f1088ed244e2b85bf))

### Chores

* **harvest:** close second-sweep coverage plate — all folds verified, proposals parked, archived ([7af8a75](https://github.com/event4u-app/agent-config/commit/7af8a75305289bd1f2d36498bea362b789b0f610))
* **roadmaps:** archive completed adversarial-verification-council roadmap ([fc34874](https://github.com/event4u-app/agent-config/commit/fc34874a608644d89ab12aa0147d5f6237a4f9ca))

Tests: 7770 (+6 since 9.2.0)

## [9.2.0](https://github.com/event4u-app/agent-config/compare/9.1.0...9.2.0) (2026-07-14)

### Features

* **rules:** cross-source-consistency — detect discrepancies, ask before guessing ([63b8049](https://github.com/event4u-app/agent-config/commit/63b804981e70045f138af4bd4a5546b62b135d24))
* **settings:** add consistency.cross_source toggle (default on) ([2f41bbb](https://github.com/event4u-app/agent-config/commit/2f41bbbf52737f12401eb7ccfed104d3b4a9b4a6))
* **settings:** opt-in subagents.adversarial_council + verify-budget escalation ([fa68dbc](https://github.com/event4u-app/agent-config/commit/fa68dbc514a6cc2def90f7f4b8b031e5c872747f))
* **subagent:** Mode 9 adversarial-verification-council + skeptic prompt ([26501a1](https://github.com/event4u-app/agent-config/commit/26501a18a1ab53d3eb54a06230086e0c4508bfee))
* **subagent:** adversarial-findings schema + deterministic reconciliation core ([12c64f2](https://github.com/event4u-app/agent-config/commit/12c64f26bcc92d4472935badc41b64fe563f98b2))

### Bug Fixes

* **proof:** regenerate docs/proof.md after the pre-registered claim ([a24fb54](https://github.com/event4u-app/agent-config/commit/a24fb54574379aaf90061beee2df4d21e3d55a9a))

### Documentation

* **adr:** ADR-122 + pre-registered finding-coverage claim + eval design ([0123cd2](https://github.com/event4u-app/agent-config/commit/0123cd298d0587fd1eb98f82c7e40f41e912ee05))

### Chores

* regenerate derived artefacts for the new rule ([5268766](https://github.com/event4u-app/agent-config/commit/5268766dd6aca34efbac77660ecf3fa9d1553814))

Tests: 7764 (+27 since 9.1.0)

# Era: pre-4.0.0 — archived

> All entries from `3.2.0` and `3.3.0` live in
> [`docs/archive/CHANGELOG-pre-4.0.0.md`](docs/archive/CHANGELOG-pre-4.0.0.md).
> The archive is read-only; git tags `3.2.0` and `3.3.0` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-3.2.0 — archived

> All entries from `3.1.0` and `3.1.1` live in
> [`docs/archive/CHANGELOG-pre-3.2.0.md`](docs/archive/CHANGELOG-pre-3.2.0.md).
> The archive is read-only; git tags `3.1.0` and `3.1.1` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-3.1.0 — archived

> All entries from `3.0.0` live in
> [`docs/archive/CHANGELOG-pre-3.1.0.md`](docs/archive/CHANGELOG-pre-3.1.0.md).
> The archive is read-only; git tag `3.0.0` remains the canonical
> source for what shipped. Splitting it out of the main file keeps
> the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-3.0.0 — archived

> All entries from `2.26.0` and `2.25.0` live in
> [`docs/archive/CHANGELOG-pre-3.0.0.md`](docs/archive/CHANGELOG-pre-3.0.0.md).
> The archive is read-only; git tags `2.26.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.25.0 — archived

> All entries from `2.24.0` through `2.20.0` live in
> [`docs/archive/CHANGELOG-pre-2.25.0.md`](docs/archive/CHANGELOG-pre-2.25.0.md).
> The archive is read-only; git tags `2.24.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.20.0 — archived

> All entries from `2.19.0` through `2.17.0` live in
> [`docs/archive/CHANGELOG-pre-2.20.0.md`](docs/archive/CHANGELOG-pre-2.20.0.md).
> The archive is read-only; git tags `2.19.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.17.0 — archived

> All `2.16.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.17.0.md`](docs/archive/CHANGELOG-pre-2.17.0.md).
> The archive is read-only; git tag `2.16.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.16.0 — archived

> All `2.15.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.16.0.md`](docs/archive/CHANGELOG-pre-2.16.0.md).
> The archive is read-only; git tag `2.15.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.15.0 — archived

> All entries from `2.14.0` through `2.11.0` live in
> [`docs/archive/CHANGELOG-pre-2.15.0.md`](docs/archive/CHANGELOG-pre-2.15.0.md).
> The archive is read-only; git tags `2.14.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.11.0 — archived

> All entries from `2.10.0` through `2.7.0` live in
> [`docs/archive/CHANGELOG-pre-2.11.0.md`](docs/archive/CHANGELOG-pre-2.11.0.md).
> The archive is read-only; git tags `2.10.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.


# Era: pre-2.7.0 — archived

> All entries from `2.6.1` through `2.2.0` live in
> [`docs/archive/CHANGELOG-pre-2.7.0.md`](docs/archive/CHANGELOG-pre-2.7.0.md).
> The archive is read-only; git tags `2.6.1` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.2.0 — archived

> All entries from `2.1.0` and earlier live in
> [`docs/archive/CHANGELOG-pre-2.2.0.md`](docs/archive/CHANGELOG-pre-2.2.0.md).
> The archive is read-only; git tags `2.1.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
