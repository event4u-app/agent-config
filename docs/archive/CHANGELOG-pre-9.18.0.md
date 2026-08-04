# Changelog Archive — pre-9.18.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `9.18.0`, split out of the main
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

## [9.17.0](https://github.com/event4u-app/agent-config/compare/9.16.0...9.17.0) (2026-08-04)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** `/optimize:deep` is now bounded — plan-only with a schema-backed limits block, a 5-loop ceiling, a pre-registered target metric, and hard exclusions for kernel rules and stable contracts (980b4f1).
- **Default changes + migration:** `/optimize:deep` defaults to plan-only; push/PR/loop execution now requires an explicit `--mode=execute`. No data or config migration.
- **Security and correctness:** symlink traversal is confined in the catalog/count walkers (514189a); `ip-address` and `fast-uri` bumped past high npm-audit advisories (be9fb0f, 22887ba).
- **Honest nulls:** no new nulls in this span — the highlight-plausibility gate itself ships here, and the false-`_none_` 9.13.0/9.14.0 heads were backfilled retroactively (491f98b).
- **Known limitations:** _none_

### Features

* **agent-handoff:** CLI-backed resume flow as the primary command surface ([0ca1ee9](https://github.com/event4u-app/agent-config/commit/0ca1ee9136263e03eff3a62aed83b4cc70aed36f))
* **cli:** agent-config handoff — picker, launch adapters, print mode ([d88eea9](https://github.com/event4u-app/agent-config/commit/d88eea976c2752f67c6d342011904a664d9e4329))
* **handoff:** session enumeration + deterministic handoff generator ([55d2459](https://github.com/event4u-app/agent-config/commit/55d24597150c1155379d22e37593d1c78fca3826))
* **hooks:** one-shot handoff-context session_start concern ([9fa684d](https://github.com/event4u-app/agent-config/commit/9fa684d62800b21871b09582fb2c6f109ea03166))
* **commands:** bound /optimize:deep — plan-only default, enforced limits ([980b4f1](https://github.com/event4u-app/agent-config/commit/980b4f18319db38b0a2c4d9bd2ab0783c17de672))
* **release:** finding-disposition ledger with stable ids ([4428e57](https://github.com/event4u-app/agent-config/commit/4428e5788f5cc8ef6c98da1e05fd6879374f3fb8))
* **release:** highlight plausibility gate + backfill the 9.13.0/9.14.0 heads ([491f98b](https://github.com/event4u-app/agent-config/commit/491f98b32767f5c84e0d46f5d2938fa298fb0f4b))
* **release:** derive all four release surfaces from the changelog at head ([d947247](https://github.com/event4u-app/agent-config/commit/d9472472de75755583fd6220975e602804f46096))
* **release:** drill — run the real step machinery against a simulated git/gh world ([a937e59](https://github.com/event4u-app/agent-config/commit/a937e5908edcf3953fc73a6a552de1a51fdc98cd))

### Bug Fixes

* **agent-handoff:** trim suggestion.trigger_context under the 240-char schema cap ([708f963](https://github.com/event4u-app/agent-config/commit/708f963e3bf674f9ec1449673608fbf413897641))
* **deps:** bump ip-address past the SSRF advisory trio (npm audit high) ([be9fb0f](https://github.com/event4u-app/agent-config/commit/be9fb0f1f58c39570deb38ab317d159c657fc14b))
* **deps:** bump fast-uri past GHSA-7p8r-x3mc-p8w7 (npm audit high) ([22887ba](https://github.com/event4u-app/agent-config/commit/22887badc0e18f7e3fb7301e9aa02465e02e90e5))
* **ci:** gate the findings-artifact upload on the file, not hashFiles ([7779d55](https://github.com/event4u-app/agent-config/commit/7779d55efb79b98f7ee6dabd84ed1659db6b4ec6))
* **security:** confine symlink traversal in the catalog/count walkers ([514189a](https://github.com/event4u-app/agent-config/commit/514189a18f44d55cd45cb6a2b5a7236365e4d0a3))

### Documentation

* **roadmap:** close and archive road-to-package-renewal (central) ([01b7ff6](https://github.com/event4u-app/agent-config/commit/01b7ff66b7886dfed9362682fc1262b15145adaa))
* **handoff:** regenerate index catalogs ([a12e89e](https://github.com/event4u-app/agent-config/commit/a12e89e4f56c2bac0877f6f87c79a7ebb7168210))
* **handoff:** sync generated catalogs, contracts, and archive the roadmap ([3505bb5](https://github.com/event4u-app/agent-config/commit/3505bb522fc69d2fdc9c5c3f4abc4ab35c3727ca))
* **roadmap:** close and archive road-to-release-truth ([e8c1200](https://github.com/event4u-app/agent-config/commit/e8c120005250cfa116194b2aad54e237a8e09d8e))

### Tests

* **release:** script the release-truth surface interactions in the drill ([6ce8025](https://github.com/event4u-app/agent-config/commit/6ce8025597c0502f25b4cd350f69d20424568d1c))

### CI

* **release:** wire surface-equality, highlight-plausibility, finding-dispositions ([86866ed](https://github.com/event4u-app/agent-config/commit/86866edc918f4fbe3f2b2a1f6047584e2bc78b44))

### Chores

* ignore worktrees ([1c97785](https://github.com/event4u-app/agent-config/commit/1c9778549a4ea2dcb5c9a63b1e1252e5584876ce))
* **budgets:** cli_help_command_count 81 -> 82 for the handoff subcommand ([b27e14d](https://github.com/event4u-app/agent-config/commit/b27e14d2a71ec4e682fbae34eec4b710d0165022))

Tests: 10692 (+104 since 9.16.0)

## [9.16.0](https://github.com/event4u-app/agent-config/compare/9.15.0...9.16.0) (2026-08-03)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **gates:** fail the PR that moves the CLI registry without the evaluator budget ([84740f3](https://github.com/event4u-app/agent-config/commit/84740f3aba1cd7e9fd3e2fa6eb304a1ad106e149))

### Chores

* **deps:** bump the github-actions group across 1 directory with 5 updates ([5e272d8](https://github.com/event4u-app/agent-config/commit/5e272d89e6e9b5bcc1fff053e9448da294998221))

Tests: 10588 (+8 since 9.15.0)

## [9.15.0](https://github.com/event4u-app/agent-config/compare/9.14.0...9.15.0) (2026-08-03)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **routing:** budget-aware cheap-request delegation (budget_routing) ([c3e98dd](https://github.com/event4u-app/agent-config/commit/c3e98dda535413e6d5e40cc463f88628c8b2ff27))
* **eval:** rules mode for the live trigger eval + weekly canary leg ([69fda7d](https://github.com/event4u-app/agent-config/commit/69fda7ddadbb60581f33ec3403609a34edaeed8b))
* **routing:** word-boundary-anchored keyword matching ([1975323](https://github.com/event4u-app/agent-config/commit/197532342bbac44adfc1e5e486f8e485a95e1d6a))
* **routing:** per-rule routing matrices for all 97 rules + derived coverage corpus ([f5ea58f](https://github.com/event4u-app/agent-config/commit/f5ea58f458865ad5ba60713e918acab301a76ffb))
* **routing:** routing:doctor + composed session_start chain tests ([bc9d3a2](https://github.com/event4u-app/agent-config/commit/bc9d3a249649a4fd063d316fdc42f2f5404246e7))
* **hooks:** daily throttle for session_start probes ([db1cdef](https://github.com/event4u-app/agent-config/commit/db1cdef2b45b7944dd056648768acb4194675d31))
* **cli:** dispatch:hook fast path in the bin launcher ([048757d](https://github.com/event4u-app/agent-config/commit/048757dc0fc2c21cc1ea862c4690cc5cbeb03d3b))
* **hooks:** claude hook command invokes the dispatcher bundle directly ([a8b2bdd](https://github.com/event4u-app/agent-config/commit/a8b2bddd916d6e129c4db255094a369a6b7b6972))
* **bench:** measure the real hook invocation path and gate CI on it ([832480a](https://github.com/event4u-app/agent-config/commit/832480ac961f3c1c0815219d95653c398ff7059d))
* **router:** reconcile the routes_to contract via an explicit self-contained class (ADR-210) ([4f24152](https://github.com/event4u-app/agent-config/commit/4f2415250e8b3f5a9e235c0f99ef2707a0df99ec))
* **adr:** retrofit event-based review_trigger on 11 time-bound ADRs ([6dd0375](https://github.com/event4u-app/agent-config/commit/6dd03758a73a7a0682f8b4543fe45954a5cb6f56))
* **adr:** projection-era corrections via ADR-209 — ADR-030 carve-out retired, ADR-089 superseded ([73b3fd8](https://github.com/event4u-app/agent-config/commit/73b3fd804a666e1bed5b58ca67b35b0669c49daf))
* **adr:** decide the ADR-201 open question — dist/agent-src is kept forever ([693fc3d](https://github.com/event4u-app/agent-config/commit/693fc3d172e0e9a6286d161c59035e848715dfd5))
* **adr:** drain the perma-proposed sweep — five accepts, one supersede ([3ab49ff](https://github.com/event4u-app/agent-config/commit/3ab49ff992a4bafd4bbe9b7bc2a625c45427f439))
* **adr:** supersede ADR-085 with ADR-207 — stdio-lite restated on Node-only grounds ([3874e58](https://github.com/event4u-app/agent-config/commit/3874e58267f684a8a479130ae1db20f1ab5e5ad5))
* **adr:** batch-disposition the drive-loop era via ADR-206 ([0052f65](https://github.com/event4u-app/agent-config/commit/0052f657238794fce1144bfbf9a8f2864b569f01))
* **hooks:** add the block-config-weakening PreToolUse guard ([d158f2d](https://github.com/event4u-app/agent-config/commit/d158f2dcfd69f4a71d97dd5bd30e9774aa95162e))
* **router:** ratchet short keyword triggers, and stop the contract lying about activation ([9f9e273](https://github.com/event4u-app/agent-config/commit/9f9e273d5d3d8736542723be5ca4df1b32627229))
* **projection:** project the colon command form and drop the twinned wrappers ([002697c](https://github.com/event4u-app/agent-config/commit/002697c891a9fde2a7e05a9f6b895bc189eeb80e))
* **projection:** derive the rule pack axis from the active-pack set ([37900a9](https://github.com/event4u-app/agent-config/commit/37900a92badba9dec34cd6e84918581154365b26))
* **gates:** put the repaired scan roots under the coverage census ([df1e736](https://github.com/event4u-app/agent-config/commit/df1e736b9d775d7870a1a2d1d7fc467c47ded858))
* **release:** name failing checks + mid-release-fix guidance at the failure point ([a3ce993](https://github.com/event4u-app/agent-config/commit/a3ce9939fa02a3510882ac5e85a40e070e1c313a))
* **ci:** commit the measurement set and warn on main, fail on release ([6eebc02](https://github.com/event4u-app/agent-config/commit/6eebc021cd8ac43a32625fa939898054e94f238b))
* **gates:** extend default-entry coverage and add the mutation canary ([fc05f30](https://github.com/event4u-app/agent-config/commit/fc05f30f080b799d781e401fa500ede4d8bb340e))
* **gates:** generate the scan-scope census over the full gate population ([301116f](https://github.com/event4u-app/agent-config/commit/301116f6f53d08d82806914bd1bf719f22ad6412))
* **gates:** add a violation ratchet for repaired scan roots ([190d53d](https://github.com/event4u-app/agent-config/commit/190d53deca65c3c01c9fff619aaf0e0e136e92c6))

### Bug Fixes

* **cli:** register routing:doctor in the CLI registry ([f02db54](https://github.com/event4u-app/agent-config/commit/f02db54c2cae449e730742f7396af5ac812bf0e8))
* **ci:** waive pre-existing SC2016 in bench-drift comment renderer ([bb4c605](https://github.com/event4u-app/agent-config/commit/bb4c6058177ccbdcdd3157a26c9818f1bcd3cc94))
* **deps-dev:** keep web-tree-sitter on the 0.24.7 ABI pin ([3e76cb2](https://github.com/event4u-app/agent-config/commit/3e76cb2515d6b4c183b7305b49dd7084b1cd59b4))
* **deps:** settle the preact floor and adopt the group bumps into the baseline ([b9c9c14](https://github.com/event4u-app/agent-config/commit/b9c9c14d6c43b51ee857a422ec35a4c559cd3a2e))
* **sweep:** keep the kernel rule language-and-tone out of the dead-tree sweep ([80c323a](https://github.com/event4u-app/agent-config/commit/80c323ac27c024f85426ee63a03c51a2e02ac964))
* **tests:** use src/rules fixture paths in the self-contained carve-out tests ([c541100](https://github.com/event4u-app/agent-config/commit/c541100cb8e9ed836dc3cd7ba54414a0c6783d65))
* **adr-index:** stop the index header naming the retired Python generator ([a26756e](https://github.com/event4u-app/agent-config/commit/a26756e9f9da1cdb79ab29deaed6dd3238def969))
* **hooks:** resolve the session-canary name user-globally, not per project ([9c3b779](https://github.com/event4u-app/agent-config/commit/9c3b7791fad2fa2d987b279a0951e662ff3c3ab1))
* **hooks:** rebuild stale tsc output after pull / branch-switch ([d2122e9](https://github.com/event4u-app/agent-config/commit/d2122e936033262a9dbe429dd21a2a6e7e23efe6))
* **roadmap-management:** tighten the awaiting-evidence section to clear the overlap gate ([5b6f141](https://github.com/event4u-app/agent-config/commit/5b6f141a8be8da01f7f231608de3a7d374b88e03))
* **worktree:** name the dependency tree by ecosystem peers, not one stack ([eafeced](https://github.com/event4u-app/agent-config/commit/eafecedebbd207c97c37f2f380e718c37512b34b))
* **clusters:** enumerate the filesystem in check_cluster_patterns ([a1cb83e](https://github.com/event4u-app/agent-config/commit/a1cb83e86648774cbbce7bc089640438a99626b5))
* **registries:** register the new command generator and its output root ([2e57080](https://github.com/event4u-app/agent-config/commit/2e570802e170ff7ccd97476902b4dcdff8aac570))
* **mcp:** price tool schemas per transport and stop shipping stub schemas ([040c8be](https://github.com/event4u-app/agent-config/commit/040c8bee1d3a7a02ec1bde7409c98e2f38881d4a))
* **deps:** bump the npm-production group with 4 updates ([2795154](https://github.com/event4u-app/agent-config/commit/27951548d89bb575b8d08bffc2269a55f6e9f414))
* **gates:** stop a check_ script from mutating a tracked report on every run ([d478b7a](https://github.com/event4u-app/agent-config/commit/d478b7a0f45373e9dd7f49b6427f93e101c77bea))
* **condense:** wire thin-mode instead of throwing on it ([092e535](https://github.com/event4u-app/agent-config/commit/092e5354440dbc114e059a008139168e29e8eb42))
* **docs:** drop the roadmap path from the branch-protection contract ([6927770](https://github.com/event4u-app/agent-config/commit/69277700fd91cf538cfb243700efcd748054dec7))
* **gates:** repair five gates that were scanning a deleted root ([e89c1b7](https://github.com/event4u-app/agent-config/commit/e89c1b733a61bd6cd722c86488ee7f727e1e64f1))
* **ci:** make ci-strict a superset of ci by construction ([10908cf](https://github.com/event4u-app/agent-config/commit/10908cf31919e615bb727a86b892cdfbcc38ca58))
* **ci:** reconcile the required-check matrix with what is actually enforced ([9b6b016](https://github.com/event4u-app/agent-config/commit/9b6b016343a63d80db8d549b194b93200ad55798))
* **ci:** satisfy actionlint on the newly-linted workflow and explain the plumbing failure ([f1e3518](https://github.com/event4u-app/agent-config/commit/f1e351811ac6ff53c80692ea94eee56fa30e4434))
* **gates:** repair the last dead scan root and pin the exit contract on a fixture ([683d493](https://github.com/event4u-app/agent-config/commit/683d493ec5bed63b1ac023064ed7b4da2016f066))
* **gates:** close four first-match-wins collisions over the repo's own conventions ([7dcc6f0](https://github.com/event4u-app/agent-config/commit/7dcc6f0f1cfc3e3cd8ba3b57f549b910cee931b4))
* **release:** ratchet existing legacy roots and stop the lockfile drift ([3bba94e](https://github.com/event4u-app/agent-config/commit/3bba94e2e479f93d8a8bf27e191b8a6accccaace))
* **ci:** run the release-gated checks on the PR that causes them ([7d25422](https://github.com/event4u-app/agent-config/commit/7d2542289748c8a768258389718e1870dbe67df9))
* **gates:** repair thirteen dead scan roots so the gates read real artefacts ([47bb0f0](https://github.com/event4u-app/agent-config/commit/47bb0f099c248d9ab1669c589158bb8908b275db))

### Documentation

* **roadmap:** road-to-tested-routing complete — 37/37, archived ([9a0fed9](https://github.com/event4u-app/agent-config/commit/9a0fed9c8809d68706ea0b16a0ba920414fcd087))
* **adr:** ADR-212 — declarative routing with a quantified resolver reopen ([9c6fbff](https://github.com/event4u-app/agent-config/commit/9c6fbfff23f11a0df6d24b3a55a931350f0f7097))
* **roadmap:** road-to-tested-routing — council-locked plan, phases 1/2/6 progress ([5a04b3a](https://github.com/event4u-app/agent-config/commit/5a04b3aa013d43f9e0105169bf20e5bcce366363))
* **roadmap:** close and archive road-to-hook-latency-repair ([3c0af7e](https://github.com/event4u-app/agent-config/commit/3c0af7e384badd218a4712caf93a1279dc972022))
* **claims:** hook-dispatch-latency claim pinned to the real path ([fc31783](https://github.com/event4u-app/agent-config/commit/fc31783d672e1599041ed3bfa789ba4cbb94c765))
* **adr:** renumber the harvest-freeze record 206 -> 210 (numbers 206-209 landed on main via #1123) ([bce530d](https://github.com/event4u-app/agent-config/commit/bce530dd5685932bdbf319369eea1f050f1feeac))
* **roadmap:** pull Codex into agent-handoff v2 scope ([eb15183](https://github.com/event4u-app/agent-config/commit/eb15183e249fec1ed51e07b52785d3f8614e56fd))
* **roadmap:** re-audit the parked feedback-sweep items against ADR-206 ([6216751](https://github.com/event4u-app/agent-config/commit/6216751849726b6738c04c31c5af8c8759494e8f))
* **adr:** canonicalize the harvest freeze as ADR-206 with amended resume conditions ([7ebbe0e](https://github.com/event4u-app/agent-config/commit/7ebbe0e414321b2c4d57b3e0c5b5b7480db4cae0))
* **roadmap:** plan the agent-handoff v2 resume-style overhaul ([62895b1](https://github.com/event4u-app/agent-config/commit/62895b1bccd9fa65f24e3a78f40e91602b47070c))
* **roadmap:** reword tier-value tokens so check_references stops reading them as rule names ([5bc8124](https://github.com/event4u-app/agent-config/commit/5bc81249c94dd39a0271311206d85546d64bd318))
* **roadmap:** land the three feedback-sweep repair roadmaps + dashboard ([beb0560](https://github.com/event4u-app/agent-config/commit/beb0560e9b49760f696dbd127ccec6c259f57228))
* **roadmap:** park the four freeze-gated feedback-sweep proposals in later/ ([e669f0f](https://github.com/event4u-app/agent-config/commit/e669f0f01424d921fa798ad69ad7c20763d040b2))
* **roadmap:** close road-to-renewal-leverage with its findings ([bcc85d0](https://github.com/event4u-app/agent-config/commit/bcc85d0c593b46d83e9455139937b73061ca64b4))
* **roadmap-management:** name the awaiting-evidence signal ([e008f19](https://github.com/event4u-app/agent-config/commit/e008f191ddc2eeaa18931259e11c852ec6e101c6))
* **worktree:** encode the seeding allow/deny list in the creation flow ([6743690](https://github.com/event4u-app/agent-config/commit/6743690f226242a2fed6d4a45195202342fd2878))
* **roadmap:** pre-register the resolver spike, park it, and archive Foundation ([0e49f83](https://github.com/event4u-app/agent-config/commit/0e49f83d013a242c94baf320b13249ac3f496942))
* **roadmap:** record Phase 2 with both figures, and the two honest misses ([8de0e6c](https://github.com/event4u-app/agent-config/commit/8de0e6c088b9f6d7fde94815dc2fe235c211815a))
* **roadmap:** record the umbrella-runner spike result — import-safety GO, timing LOSS ([0551a7c](https://github.com/event4u-app/agent-config/commit/0551a7cce2b312cf3d018967aa8e606f0f2ecda2))
* **roadmap:** decline CI build-artifact sharing on measurement, record the Phase 2 token baseline ([fa244c1](https://github.com/event4u-app/agent-config/commit/fa244c1a8878696ab2398ca6279ad9544b1269b1))
* **roadmap:** close Foundation P1 required-checks, ci-strict, dependabot and baseline steps ([cbc1217](https://github.com/event4u-app/agent-config/commit/cbc12170722ad3a5d5e091f290d263fff9adad96))
* **roadmap:** close the phases of road-to-gates-that-can-fail ([a6af14f](https://github.com/event4u-app/agent-config/commit/a6af14ff088e5836bc20f769e67a820e267defc6))

### Tests

* **orchestration:** dispatch-decision matrices + council-path routing invariants ([8d48180](https://github.com/event4u-app/agent-config/commit/8d48180064458dd5a75559465a20ea5424f1264c))
* **portability:** build fixtures under the live scan root ([e02dd0b](https://github.com/event4u-app/agent-config/commit/e02dd0bfaf0f2b8aaaaccec9d1a82409fa2bdb98))
* **gates:** exercise the two happy-path-only gates through their real entry point ([365da5b](https://github.com/event4u-app/agent-config/commit/365da5b9fcc887864d344b94301836ce5cef928e))

### Build

* **install:** refresh the committed installer output for the rule-packs change ([8bcccc7](https://github.com/event4u-app/agent-config/commit/8bcccc7ef575420f9074307cee33721d80c6df7a))

### Chores

* **deps-dev:** bump @types/node from 20.19.41 to 26.1.2 ([fd0d6f6](https://github.com/event4u-app/agent-config/commit/fd0d6f6493f78b31454ebd202008f3fbd46a3da9))
* **deps-dev:** bump @inquirer/prompts from 7.10.1 to 8.5.2 ([7dfea4b](https://github.com/event4u-app/agent-config/commit/7dfea4bbc26e8b04d2c73bc9cbe4d813dc64c724))
* **deps-dev:** bump typescript in /deploy/telemetry-worker ([fdbff3f](https://github.com/event4u-app/agent-config/commit/fdbff3f293b3eaa6a6b1d8d5c7ba8e0769a2daab))
* **deps:** bump marocchino/sticky-pull-request-comment from 2 to 3 ([7d4d9cb](https://github.com/event4u-app/agent-config/commit/7d4d9cb81bd95faf851cf16bb06c87d2df871d9b))
* **deps-dev:** bump tsx from 4.22.3 to 4.23.1 in deploy/telemetry-worker ([ea561ea](https://github.com/event4u-app/agent-config/commit/ea561ea964fda776c02df3a280aaa1d9c188eac6))
* **deps-dev:** bump the npm-development group across 1 directory with 7 updates ([fe05c7f](https://github.com/event4u-app/agent-config/commit/fe05c7fe02b2d9dca60887fe23b92b1d5fe3024e))
* **deps:** bump actions/upload-artifact from 4 to 7 ([a2a2423](https://github.com/event4u-app/agent-config/commit/a2a2423776510471a17ebf0631fad2cba9cd50d1))
* **roadmap:** close and archive road-to-renewal-adr-hygiene ([ab432b0](https://github.com/event4u-app/agent-config/commit/ab432b0247b21a21b6961de20ca1ef1584c96367))
* **adr:** regenerate the index for the hygiene batch ([61dc94f](https://github.com/event4u-app/agent-config/commit/61dc94f98f48ef508986050728d04c47125c6718))
* **docs:** sweep non-gate .agent-src.uncondensed references to the src/ truth ([9d987a0](https://github.com/event4u-app/agent-config/commit/9d987a086363b933505d6290fc111f9763f8810d))
* **roadmap:** default dashboard_regen_cadence to every_5_steps ([d40f676](https://github.com/event4u-app/agent-config/commit/d40f676326f034affe8a0c15e4835bc4a6143fe2))
* **deps:** bump the site group in /site with 3 updates ([ddb92d4](https://github.com/event4u-app/agent-config/commit/ddb92d4399ee35137b8c0a557345f6104b069915))
* **deps:** bump actions/configure-pages from 5 to 6 ([c2fe6bc](https://github.com/event4u-app/agent-config/commit/c2fe6bc26f123bfd0eaf8a88d5ba2c9cb70cf6bc))
* **deps:** bump actions/upload-pages-artifact from 3 to 5 ([6998b77](https://github.com/event4u-app/agent-config/commit/6998b77bbddfd85f8346c751f0a8679f13129dcc))
* **deps:** schedule dependency updates via dependabot ([d9e4a8d](https://github.com/event4u-app/agent-config/commit/d9e4a8de95ef246311b85a85fd5189892ce21161))
* **reports:** refresh the derived reports the consistency gate regenerates ([ee73e3f](https://github.com/event4u-app/agent-config/commit/ee73e3feab59cf2df2a1f6b1bc35ff6e1e032359))

Tests: 10580 (+524 since 9.14.0)
