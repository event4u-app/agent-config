# Changelog Archive — pre-14.18.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `14.18.0`, split out of the main
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

## [14.17.0](https://github.com/event4u-app/agent-config/compare/14.16.0...14.17.0) (2026-09-05)

### Release highlights

- **Behaviour changes:** the corpus is held — the wave that proved it, preserved (removes src/skills/ai-council/evals/triggers.json, src/skills/dependency-upgrade/evals/triggers.json, src/skills/judge-bug-hunter/evals/triggers.json, src/skills/judge-code-quality/evals/triggers.json, src/skills/judge-security-auditor/evals/triggers.json, src/skills/judge-test-coverage/evals/triggers.json, src/skills/quality-tools/evals/triggers.json, src/skills/recursive-verification/evals/triggers.json, src/skills/requesting-code-review/evals/triggers.json, src/skills/review-routing/evals/triggers.json, src/skills/rtk-output-filtering/evals/triggers.json, src/skills/sql-writing/evals/triggers.json, src/skills/subagent-orchestration/evals/triggers.json, src/skills/using-git-worktrees/evals/triggers.json) (a502114); hold commit-conventions at its stub ceiling (1ebf5ac); measured house commit convention outranks the shipped default (7651c88).
- **Default changes + migration:** measured house commit convention outranks the shipped default (7651c88).
- **Security and correctness:** anchor_coverage_gaps honours the dated-measurement marker (3df2156); re-derive the two description-dependent pins (fc1d6f4); no check may report passed on input it cannot see (3ad7d26).
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 31 vs consumer-only 13 (taxonomy 1.0.0).
> Next cycle ships the rows four shipped-skill lists are missing — the render
> state matrix, the plan criteria the two planning skills judge against, and what
> a transactional email needs to survive a mail client — tracked in
> `agents/roadmaps/road-to-checklist-rows.md`.

### Features

* **delivery-mode:** a held change set and an owner decision packet, nothing flipped ([14330b8](https://github.com/event4u-app/agent-config/commit/14330b86810483e5d8f471826c9dbd0666977abb))
* **triggers:** a 14-file corpus wave, selected by a declared rule ([1ce64c8](https://github.com/event4u-app/agent-config/commit/1ce64c8b9dd2a411361c2f9e575a732bf57812b8))
* **commands:** /fix commit-messages — retro-fit past subjects to one convention ([47ff61d](https://github.com/event4u-app/agent-config/commit/47ff61ddfc4ef38ffbcde9e2638a624fcde6ee22))
* **rules:** measured house commit convention outranks the shipped default ([7651c88](https://github.com/event4u-app/agent-config/commit/7651c884debeaa80daf6cbb51608a54fa1391f89))
* **production-validator:** bind check_web_launch_readiness, its first non-test consumer ([56acac8](https://github.com/event4u-app/agent-config/commit/56acac87d0537fefea0e71d04bd78c3dcebef802))
* **release:** refuse a release that owes a governance-mix response ([f76b334](https://github.com/event4u-app/agent-config/commit/f76b3341a3f69af6b9546f20c0385e89f3afb3e6))
* **release:** measure the governance-vs-product mix of a release ([ef91095](https://github.com/event4u-app/agent-config/commit/ef910954544a7a6e66af00476b9a73c63236c137))
* **threat-modeling:** add an infrastructure surface class and its threat rows ([279061c](https://github.com/event4u-app/agent-config/commit/279061c2f01582f3699359d24218a934c4558832))
* **analyze-inbox:** give every extracted point a disposition it cannot escape ([176e7db](https://github.com/event4u-app/agent-config/commit/176e7db8971ba8f65f833621cf4f12508097c076))

### Bug Fixes

* **contracts:** review the sixteen beta deadlines that lapsed on 2026-09-04 ([183cd68](https://github.com/event4u-app/agent-config/commit/183cd6804365e2541571da7c2184338850550db3))
* **evidence:** re-derive the 5.1 routing-signal record after the body rewrite ([77ca9f9](https://github.com/event4u-app/agent-config/commit/77ca9f9766e103aefd7cacd6ab82c73e93ae1cc3))
* **roadmaps:** risk-register ranks must ascend ([8867c7e](https://github.com/event4u-app/agent-config/commit/8867c7e1d0915adea31669387afc5f02d8ad7618))
* **proof:** regenerate docs/proof.md after the corpus revert ([59a19ed](https://github.com/event4u-app/agent-config/commit/59a19ed0847ba63f32549329c368c3f24b12e19a))
* repair the defects a neutral review found in both procedures ([ef33f92](https://github.com/event4u-app/agent-config/commit/ef33f921266ff9627931bc2fee6e2180c247145a))
* **gate:** anchor_coverage_gaps honours the dated-measurement marker ([3df2156](https://github.com/event4u-app/agent-config/commit/3df21567ab47659180e506e896143ade471570ec))
* **tests:** re-derive the two description-dependent pins ([fc1d6f4](https://github.com/event4u-app/agent-config/commit/fc1d6f40eadcf609634371741d06e0a4f0c6ac22))
* **rules:** hold commit-conventions at its stub ceiling ([1ebf5ac](https://github.com/event4u-app/agent-config/commit/1ebf5ac16778499b13ff44716bc6ce4a7c6104d5))
* **skills:** name manifest peers so the tier-1 probe stays framework-neutral ([152af29](https://github.com/event4u-app/agent-config/commit/152af29b7977394de4424e1976275e9a9dd755e1))
* **web-launch-readiness:** no check may report passed on input it cannot see ([3ad7d26](https://github.com/event4u-app/agent-config/commit/3ad7d268bdcc090efc2834018cfda629548fb82f))
* **skills:** drop the duplicated grounding invocation from both IaC sections ([42cfa5b](https://github.com/event4u-app/agent-config/commit/42cfa5b3d9ce4d8b32f9e04c807b5b1b7930c674))
* **terraform:** correct the encryption backstop grep flags ([8c43c49](https://github.com/event4u-app/agent-config/commit/8c43c4925c5fa9e83efaf43080a92742ddd9a973))
* **analyze-inbox:** write the new prose in the canonical house dialect ([a7a1275](https://github.com/event4u-app/agent-config/commit/a7a1275fcd793320f14c3de6592710046c2001fe))

### Reverts

* **triggers:** the corpus is held — the wave that proved it, preserved ([a502114](https://github.com/event4u-app/agent-config/commit/a502114a9fa0e87ab883c8a5ca00dbe8681f7860))

### Documentation

* **evidence:** record the council round, the split, and the two required repairs ([3d5033d](https://github.com/event4u-app/agent-config/commit/3d5033db93c4c5abb999dc36302b00024af85d2e))
* **evidence:** record the run-20 drain, its two open roadmaps and its carrier ([2be3bb3](https://github.com/event4u-app/agent-config/commit/2be3bb3fcadc1b03777c0de308e6ccfb36a6ec82))
* **roadmaps:** close road-to-the-tenth-arrival with its per-step evidence ([2df5556](https://github.com/event4u-app/agent-config/commit/2df5556570df82548500b4ea372f9ad14f56a02b))
* **claims:** publish the skill-activation census as its own ledger row ([5fad7e3](https://github.com/event4u-app/agent-config/commit/5fad7e3ed29a3d2a5e46863f5752e6f105480fc6))
* **disposition:** the lock cited over the ninth arrival gates a different question ([f1324ce](https://github.com/event4u-app/agent-config/commit/f1324ce3ed0c9c7d3142e54319c0fc334f9fb128))
* **roadmaps:** AC-6 stays open, awaiting owner disposition ([287f5ec](https://github.com/event4u-app/agent-config/commit/287f5ec54c4f55ec314ca0f5018a01e706cf620e))
* **roadmaps:** record the outcome of road-to-the-check-that-cannot-see ([d238f3d](https://github.com/event4u-app/agent-config/commit/d238f3d13c761de1cb397f4cc14c5a6ef87de136))
* **roadmaps:** stop citing a superseded contract as the live-app reason ([c2a1d8f](https://github.com/event4u-app/agent-config/commit/c2a1d8f27db651ab6567588faae6f888c3522ace))
* **evidence:** describe the council response tree without naming its path ([ee0af99](https://github.com/event4u-app/agent-config/commit/ee0af993ffd5ec22911f294dc06af33638322169))
* **roadmaps:** close road-to-meta-ratio-measured ([6aaabdf](https://github.com/event4u-app/agent-config/commit/6aaabdf42c1fe3ee29432b431ba65518c6d87273))
* **evidence:** publish the first two release-mix readings as levels ([eadf59a](https://github.com/event4u-app/agent-config/commit/eadf59ae141fdc3a09d4d0ce5a60fa4ed6d765d7))
* **decisions:** decline the same-PR user-artefact gate (ADR-253) ([b23bb45](https://github.com/event4u-app/agent-config/commit/b23bb45e5ee1973b16c7cd100b954c831be74159))
* **roadmaps:** close road-to-decided-but-not-done at 12 of 12 ([43ecfa1](https://github.com/event4u-app/agent-config/commit/43ecfa1e0a849463fe90619f0018508a193af81d))
* **roadmaps:** name the receiver the carried-to promise pointed at ([29c4ad2](https://github.com/event4u-app/agent-config/commit/29c4ad20cee638a7d663d8e268367dd5cd1c5961))
* **evidence:** record whether secret scanning reaches a consumer IaC diff ([afd17bc](https://github.com/event4u-app/agent-config/commit/afd17bc446eb21e523767a11905fdf8a72420a9d))
* **skills:** give terraform and aws-infrastructure the permissiveness canon ([e33e233](https://github.com/event4u-app/agent-config/commit/e33e233dba49468f87c1f75f16d0a95b6b32e9d6))
* **roadmaps:** two roadmaps from the 2026-09-f and -g proposal rounds ([a978b66](https://github.com/event4u-app/agent-config/commit/a978b661cdba3709a64324fdcbefd18eb3ab25cb))
* **evidence:** verify and disposition the inbox-2026-09-f and -g rounds ([26dac19](https://github.com/event4u-app/agent-config/commit/26dac198f966a41adbb3e4a3d4d055786cb77afc))
* **roadmaps:** the gate reported this analysis diff as ten findings ([9caefb6](https://github.com/event4u-app/agent-config/commit/9caefb62c36b1c187200d66e62d61046feef143a))
* **roadmaps:** satisfy the relates, language and evidence-type gates ([8f53476](https://github.com/event4u-app/agent-config/commit/8f534765c7611cbebc1a3172afa5b8703da2a5a2))
* **roadmaps:** claim the one-in-one-out half of the estate ratchet ([89901b6](https://github.com/event4u-app/agent-config/commit/89901b6d0939aaafd349563bd188dd58fbfb3c03))
* **evidence:** verify and disposition the inbox-2026-09-e round ([f3e3579](https://github.com/event4u-app/agent-config/commit/f3e3579f91e6caebe899307671bc6f20e59655d3))
* **evidence:** declare the completion-review skip for the inbox-2026-09-d diff ([c28d094](https://github.com/event4u-app/agent-config/commit/c28d09446840231f75966286462ee60897054a7b))
* **roadmaps:** three roadmaps from the inbox-2026-09-d round ([f83b75f](https://github.com/event4u-app/agent-config/commit/f83b75f35fa0b942ffcdce3f35f95c77fa7ef7b6))
* **evidence:** record the inbox-2026-09-d verification and disposition ([77ab8e5](https://github.com/event4u-app/agent-config/commit/77ab8e5636a48b0f4382c7be2f964e1569dfacdc))

### Refactoring

* remove attest_artifact, enforcing the 2026-08-25 ruling ([e58e11f](https://github.com/event4u-app/agent-config/commit/e58e11f9bb3dcf482086d51e99eb21e14adffd1e))
* **explain-last:** drop the .agent-memory sidecar read path ([aaf049d](https://github.com/event4u-app/agent-config/commit/aaf049dbb8cb319f7af195c63ccd814f24b52697))

### Tests

* **distribution:** cover the canonical-channel invariant, which had no test ([d978081](https://github.com/event4u-app/agent-config/commit/d9780819b6e8303d163ce63093753f028d1d8d00))

### Chores

* **roadmaps:** archive road-to-the-tenth-arrival ([249ab53](https://github.com/event4u-app/agent-config/commit/249ab535ec20805aef4dca2ebcbe204013e6ceef))
* **wedge:** re-sync the production-validator wedge doc after the gate binding ([7f95d05](https://github.com/event4u-app/agent-config/commit/7f95d056d6a356cbc99b8c097c04dedd9217f2fc))
* **web-launch-readiness:** stop retyping the check count ([9ec7544](https://github.com/event4u-app/agent-config/commit/9ec754461d941b441ca9536d4a781c4a1180dcc4))
* **roadmaps:** archive road-to-meta-ratio-measured ([ffd65ff](https://github.com/event4u-app/agent-config/commit/ffd65ff92ff176c6798d0211c6655ccd9b76d032))
* **adr:** regenerate the evidence census for ADR-253 ([5b29d74](https://github.com/event4u-app/agent-config/commit/5b29d74b04bd1c47b920cbd0601451937ba1be2a))
* **roadmaps:** archive road-to-decided-but-not-done ([11b0222](https://github.com/event4u-app/agent-config/commit/11b0222b3a81da07d0a0786b2771883654d8b9c7))
* **roadmaps:** archive road-to-infra-threat-floor ([81007b4](https://github.com/event4u-app/agent-config/commit/81007b45af35528c8834a5e6a46603db8f21a3ca))

### Other

* **dialect:** write the new prose in the canonical house dialect ([e051ed8](https://github.com/event4u-app/agent-config/commit/e051ed8fcc20a387012d4ec16f645199fe4b1a86))

Tests: 21007 (+33 since 14.16.0)
