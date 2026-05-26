# Changelog Archive — pre-3.0.0

> Frozen snapshot of `event4u/agent-config` changelog entries from
> `2.25.0` through `2.26.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-21 once the active
> era's body crossed the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 3.0.x".
> Entries here are not amended — git tags `2.25.0` and `2.26.0`
> remain the canonical sources for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-2.25.0.md`](CHANGELOG-pre-2.25.0.md),
> [`CHANGELOG-pre-2.20.0.md`](CHANGELOG-pre-2.20.0.md),
> [`CHANGELOG-pre-2.17.0.md`](CHANGELOG-pre-2.17.0.md),
> [`CHANGELOG-pre-2.16.0.md`](CHANGELOG-pre-2.16.0.md),
> [`CHANGELOG-pre-2.15.0.md`](CHANGELOG-pre-2.15.0.md),
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## 2.26.0 (2026-05-19)

### Features

* **linter:** refine procedural_rule + has_inspect_step heuristics ([7cb040b](https://github.com/event4u-app/agent-config/commit/7cb040b76bd8ddb2333f7b6302f36f3e700c3257))
* **kernel:** admit user-interrupt-priority as 10th kernel rule ([7a782c8](https://github.com/event4u-app/agent-config/commit/7a782c8af803cf0ce29f9a81834d39201cd0214c))
* **skills:** rule-refactor — Budget-Discipline-Gate workflow ([c246a8c](https://github.com/event4u-app/agent-config/commit/c246a8cf8edab8cbef410c301e387fea39ed074c))
* **rules:** user-interrupt priority + validation-loop budget ([fbac3f9](https://github.com/event4u-app/agent-config/commit/fbac3f9949846670737f529c2b85fd70c7566cf2))
* **rules:** framework-neutrality linter + Tier-2 rule ([f0bf7b5](https://github.com/event4u-app/agent-config/commit/f0bf7b5fb37543f97dfbe13253fecc3cf122d3da))

### Bug Fixes

* **agents:** repair augment-portability → augment-edit-discipline pointer ([eb09867](https://github.com/event4u-app/agent-config/commit/eb09867155f3406593d676dabcdf73797d15e3d7))
* **ci:** repair stale digest ref, time-bomb retention test, marketplace manifest ([779725d](https://github.com/event4u-app/agent-config/commit/779725d32588af1497b4618603203761b8ebdf0a))
* **lint:** allowlist 'markitdown' as bare-noun skill name ([18fe51d](https://github.com/event4u-app/agent-config/commit/18fe51d8252eb4d0f1f7640485ad7671300c352d))
* **commands:** declare skills: frontmatter for 16 commands ([9f766ac](https://github.com/event4u-app/agent-config/commit/9f766ac52e921b599600e33913c2a51ac50fa494))
* **refs:** retarget pii rule, archived roadmap, drop validation-budget mention ([7c784b0](https://github.com/event4u-app/agent-config/commit/7c784b0414a8022629843d375fcfc56027a2b694))
* **router:** repair 19 broken pointers, add 5 consolidated entries ([a2bfdd6](https://github.com/event4u-app/agent-config/commit/a2bfdd65084f5bbf0fbcb6b98ad063a0b6de9f75))
* **lint:** rule-refactor SKILL.md — trim description, rename step 1 ([d44d956](https://github.com/event4u-app/agent-config/commit/d44d956a9ab9c3698faa7ea02dffd92360330882))

### Documentation

* **changelog:** split era pre-2.25.0 into archive ([0a1c60d](https://github.com/event4u-app/agent-config/commit/0a1c60d2b872053a97340d7c0770182462439ddd))
* **roadmap:** archive rule-governance-and-budget-discipline ([d0f26a5](https://github.com/event4u-app/agent-config/commit/d0f26a50b359786bcfcee9a0b43a9d5b9370a619))
* **counts:** bump skills 216 \xe2\x86\x92 217 after framework-neutrality skill split ([154ae86](https://github.com/event4u-app/agent-config/commit/154ae8697b9c3a01e2430280419b6dfb0d5486ed))

### Refactoring

* framework-neutrality audit — remove framework-specific phrasing from generic rules and skills ([eb8357b](https://github.com/event4u-app/agent-config/commit/eb8357bd24d56324685bff8a74231ab8becec91d))
* **rules:** tighten user-interrupt-priority prose ([69d70b3](https://github.com/event4u-app/agent-config/commit/69d70b3d05d31ea064a1c941fbfc6882617899f5))
* **rules:** merge 2 domain-safety-retention-* into one ([2c3f3af](https://github.com/event4u-app/agent-config/commit/2c3f3af407167c6353c45b31f032cb29c60b1eb3))
* **rules:** merge 6 PII rules into one domain-safety-pii ([64f263a](https://github.com/event4u-app/agent-config/commit/64f263a20b48e99ffdde4069d5cf5603dea7b893))
* **rules:** merge 4 domain-safety-disclaimer-* into one ([b0dc78f](https://github.com/event4u-app/agent-config/commit/b0dc78fda2e6912d9e2d942010af2b88c274a07f))
* **rules:** drop redundant routing stubs ([906d99a](https://github.com/event4u-app/agent-config/commit/906d99abe4da865235f20acdb5cbc8055337b289))
* **rules:** consolidate git rewrite rules into git-history-discipline ([3633e0d](https://github.com/event4u-app/agent-config/commit/3633e0d9cf833ce3f0eb2d4270a2b0b961625f95))
* **rules:** consolidate augment routing stubs into augment-edit-discipline ([f0d1b3c](https://github.com/event4u-app/agent-config/commit/f0d1b3c089f425e4c295a38f537600fbe4c65b9a))
* **skills,commands:** Phase 5 — relocate 4 misclassified carve-outs ([4422af0](https://github.com/event4u-app/agent-config/commit/4422af03742b026700cd269b6a2110ee4afa55a3))
* **skills,commands:** Phase 4 — multi-stack examples (14 generic artefacts) ([b9b4c6d](https://github.com/event4u-app/agent-config/commit/b9b4c6d610799c14553ca0104efbcd99008604c7))
* **commands:** make generic commands multi-stack (Phase 3) ([ba1d196](https://github.com/event4u-app/agent-config/commit/ba1d196806968d16c25ec2f70abc9628cad8cf15))
* **skills:** Phase 2 - eliminate Tier-2 command & logic leakage ([448d7d6](https://github.com/event4u-app/agent-config/commit/448d7d669fe5f0bc26c8b325c1370559827eb119))
* **skills,rules:** Phase 1 - eliminate Tier-1 mandate leakage ([97fbec1](https://github.com/event4u-app/agent-config/commit/97fbec105309db279f64da0354c7fe2cced95190))

### Chores

* finalize chances ([ae94d29](https://github.com/event4u-app/agent-config/commit/ae94d29b86d21d912c5c6f6371960606c82d6a68))
* sync .claude/ rules and skills projections ([ce84265](https://github.com/event4u-app/agent-config/commit/ce84265e916b1f6da68663a803f993f95a6bb2c6))
* regenerate condensed mirror and hashes after framework-neutrality refactor ([534277a](https://github.com/event4u-app/agent-config/commit/534277a930b8c45b78d02c325600fdcc6d73c42e))
* **smoke:** lift schema warns baseline 93 → 95 ([901625e](https://github.com/event4u-app/agent-config/commit/901625e9f9826b1c704381c3066d7f1bed17efdd))
* **condense:** refresh hash for rule-refactor SKILL.md ([866b9af](https://github.com/event4u-app/agent-config/commit/866b9af4cc9d4607150aee27ce310cf56ae7210c))
* **counts:** sync README + docs after rule consolidation ([1959123](https://github.com/event4u-app/agent-config/commit/19591234f38dad54f06451dc1f732838ebbf4bc7))
* **condense:** update cross-refs and refresh projected layer ([43191ae](https://github.com/event4u-app/agent-config/commit/43191ae8928b8eeff099b22ab7d6c53b60f09f07))
* **index:** regenerate after phase-6 description trims ([12f6a2d](https://github.com/event4u-app/agent-config/commit/12f6a2d68d8ab33b8945988018aeeec930e8eddc))
* **phase-6:** polish — trim descriptions, drop scope blocks, add rtk analyze step ([3b3f66c](https://github.com/event4u-app/agent-config/commit/3b3f66ced56252a1dda7279a9ec8b8c9f2e4c6c4))
* **phase-6:** framework schema prop + linter inventory exemption ([91b7b0e](https://github.com/event4u-app/agent-config/commit/91b7b0e341d60a49d60af45728d69db627bac051))
* **carve-outs:** tag 6 Laravel-coupled artefacts with framework: laravel ([c486de2](https://github.com/event4u-app/agent-config/commit/c486de2dea785646a74c9a8cf642a04ba7c1a30e))
* **lint:** widen cross-stack heuristic + frontmatter exemption ([05d13f2](https://github.com/event4u-app/agent-config/commit/05d13f295edd8ee8a0cbe794230ae25dffa30edd))

### Other

* Revert "chore(smoke): lift schema warns baseline 93 → 95" ([772553b](https://github.com/event4u-app/agent-config/commit/772553b93567921b8d8d989a432e5901332ffd0c))
* Merge pull request #183 from event4u-app/chore/new-roadmaps ([032a244](https://github.com/event4u-app/agent-config/commit/032a244a3d66e510d023ed6a6341ebb0fd805120))

Tests: 4645

## [2.25.0](https://github.com/event4u-app/agent-config/compare/2.24.0...2.25.0) (2026-05-18)

### Features

* **rules:** add post-push-rewrite-discipline tier-2a guard ([1af51e1](https://github.com/event4u-app/agent-config/commit/1af51e1809de3522bd344453cc7e6206032f5d4a))
* enforce roadmap CI-steps policy as Hard Gate ([a2ec868](https://github.com/event4u-app/agent-config/commit/a2ec868e81a9d9a4644d04704ff964b67754b2b2))
* **provider-lifecycle:** tier adapters and enforce safety gates ([e9771e6](https://github.com/event4u-app/agent-config/commit/e9771e672e07804ff80b4f182c7b095acec6995d))
* **policy:** add media governance policy layer ([4adc2ac](https://github.com/event4u-app/agent-config/commit/4adc2ac19fa31a6b0393ba4f662d91e85e6c63d0))

### Bug Fixes

* **ci:** extend portability skip-list with roadmap-ci-steps-policy files ([c68893d](https://github.com/event4u-app/agent-config/commit/c68893dfcb6189a951deb0ebab9802683e705d7a))
* **ci:** repair archived-roadmap refs + bump smoke warn baseline ([11e181b](https://github.com/event4u-app/agent-config/commit/11e181b78a8303fc54cc4aa79138753b1c0c4148))

### Performance

* **roadmap:** batchable dashboard regen + parallel step reads in autonomous runs ([c1aa3a5](https://github.com/event4u-app/agent-config/commit/c1aa3a51cf1d99e71151f1d7116ab970d36cd85b))
* **create-pr:** mandate single github-api call and parallel context fetch ([cbade08](https://github.com/event4u-app/agent-config/commit/cbade08df40b0d501791eeb6847e6452b2971d1d))

### Documentation

* **skills:** expand git-workflow with safe-squash and divergent-state recovery ([745859f](https://github.com/event4u-app/agent-config/commit/745859f100c1ffd6d607de81f701dacefb1feff0))
* **roadmap:** add framework-neutrality-audit roadmap + scan evidence ([6daf8b8](https://github.com/event4u-app/agent-config/commit/6daf8b8a0a16880f02a7afb1fb07cf7526be3c28))
* **adr:** record ADR-011 domain-pack readiness (Phase 6) ([830cefa](https://github.com/event4u-app/agent-config/commit/830cefafdbec8474d1f6f71421457d1761f746ab))
* **roadmap:** file Phase 5 advisory issues #178-#180 and sync dashboard ([3859d08](https://github.com/event4u-app/agent-config/commit/3859d085ebf7cf9bc091ae55d3e8ad1e15893dcb))
* **roadmap:** add universal-platform-refinement roadmap ([0912bb5](https://github.com/event4u-app/agent-config/commit/0912bb505dac59ac5d4cc5e25b42b2f1d6efa694))

### Tests

* **ai-video:** add blueprint, prompt-optimizer, adapter-contract suites (Phase 4) ([7762df7](https://github.com/event4u-app/agent-config/commit/7762df720412049f6d3b12bd328cd7c9a78b215b))

### Chores

* add claude rules ([744328d](https://github.com/event4u-app/agent-config/commit/744328d57b4ba3c502ab3b41ded10e25ba3db8cf))
* condense 4 .md files into .agent-src/ ([96ef2f9](https://github.com/event4u-app/agent-config/commit/96ef2f94504661f71b86a3fb16762069c39caaa7))
* regenerate compiled trees for new rule (82 to 83) ([8b8af6a](https://github.com/event4u-app/agent-config/commit/8b8af6a4a918e927dbaafaeadc4402e3a7220981))

### Other

* Clarify skills, rules, and commands description ([b586a0c](https://github.com/event4u-app/agent-config/commit/b586a0c6895da701a2719aeb4758f14cbe3fc2db))

Tests: 4664 (+95 since 2.24.0)
