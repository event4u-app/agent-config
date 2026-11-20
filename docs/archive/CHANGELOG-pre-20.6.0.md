# Changelog Archive — pre-20.6.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `20.6.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) by `scripts/release.py`
> once the active era's body crossed the drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md`. Entries
> here are not rewritten — git tags remain the canonical source
> for what shipped. The one amendment an archive permits is a
> **correction that adds**: where a published entry says something
> the shipped tree contradicts, the correction is appended beside
> it and names the commit that decided the matter. Nothing is
> deleted, so both the original claim and its correction stay
> readable.
>
> Entry shape follows
> [`../contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).

## [20.5.0](https://github.com/event4u-app/agent-config/compare/20.4.0...20.5.0) (2026-11-19)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** clear the mirror gates for arena/panel and subscription-first (cdca2a3); read rules under CLAUDE_CONFIG_DIR as the user layer (af9804d); time the small cssBlocks sample as a batch so the growth ratio is not noise (9e4cfad); hold the trial timeout with SIGKILL and remove the container (2aed630); repoint the codex writer citation to install.ts:1366 (ca1d186); release the held ledger before its entry is mutated (7cb97a6); +1 more.
- **Honest nulls:** _none_
- **Known limitations:** build each deployed file once and leave identical targets alone (src/scripts/install.ts declares a residual) (492dc03).

> **Governance mix:** governance-only 14 vs consumer-only 4 (mixed 7, maintenance 5; taxonomy 1.1.0; range d8bc98191978..99d4f7d65708).

### Features

* **bracket:** paid appeal jury in shadow mode, /arena and /panel commands ([099bff4](https://github.com/event4u-app/agent-config/commit/099bff42040040b846a44050e4e0be45a7edd546))
* **council:** subscription seats first, API only on stored consent ([2648668](https://github.com/event4u-app/agent-config/commit/26486683a40442e672c6daaa632202e9adecce48))

### Bug Fixes

* **claims:** re-verify council-fallback-loses-zero-seats after the opt-in rewording ([6d3e5f7](https://github.com/event4u-app/agent-config/commit/6d3e5f7b8c24bfd5ba24bb3a8574659e49bdd0b4))
* **roadmap:** shadow receipts for steps 2.3 and 2.5 ([0969247](https://github.com/event4u-app/agent-config/commit/096924713def8db5500ffc980cb36ade9e8faf30))
* **ci:** clear the mirror gates for arena/panel and subscription-first ([cdca2a3](https://github.com/event4u-app/agent-config/commit/cdca2a34e5fd130e2521242f83186df92da58def))
* **arrival:** read rules under CLAUDE_CONFIG_DIR as the user layer ([af9804d](https://github.com/event4u-app/agent-config/commit/af9804d9982862723d87d8dbb878e64a3e13fdf0))
* **test:** time the small cssBlocks sample as a batch so the growth ratio is not noise ([9e4cfad](https://github.com/event4u-app/agent-config/commit/9e4cfad6ff52d1a17ec0d8df3b9a238844a1a33a))
* **bench:** hold the trial timeout with SIGKILL and remove the container ([2aed630](https://github.com/event4u-app/agent-config/commit/2aed630d90145e448ad492e7132f8df6393d1378))
* **report:** repoint the codex writer citation to install.ts:1366 ([ca1d186](https://github.com/event4u-app/agent-config/commit/ca1d18643bf2d06d42635a430adb1a1ab9533669))
* **install:** release the held ledger before its entry is mutated ([7cb97a6](https://github.com/event4u-app/agent-config/commit/7cb97a676c638b45c615a9ec3d899bf241ac84e5))
* **install:** keep a build-machine path shape out of the deployCopy bundle ([68ef995](https://github.com/event4u-app/agent-config/commit/68ef995a47ac3f8542a86a006e95ed4c4af50a91))

### Performance

* **update:** skip the npx cache warm when the global install is at the pin ([4f0f179](https://github.com/event4u-app/agent-config/commit/4f0f179dd141600df700c2f60e99c4d81f572124))
* **install:** stop re-reading and re-writing the ledger per tool ([137e7e4](https://github.com/event4u-app/agent-config/commit/137e7e4b49a93bf717e84cf1baf88a99d4c68d69))
* **install:** build each deployed file once and leave identical targets alone ([492dc03](https://github.com/event4u-app/agent-config/commit/492dc033fb201bf1d1888cc9f88c8699b03e926f))

### Documentation

* **roadmap:** put the step 1.6 receipt on its checkbox line ([f9f1a50](https://github.com/event4u-app/agent-config/commit/f9f1a50a9cdbc6c5c0d91c9626a23d20dc351113))
* **roadmap:** shorten step 1.6 and add its receipt ([56f3d4e](https://github.com/event4u-app/agent-config/commit/56f3d4e714ff69a76827254753a8115b33859823))
* **roadmap:** close step 1.6 and track host-mode process trees as 1.7 ([15c8658](https://github.com/event4u-app/agent-config/commit/15c8658cb7a4bae1422c14e080745c83ffe50a60))
* **agent-switch-link:** receipts for closed steps 8.1 and 8.2 ([cede9c9](https://github.com/event4u-app/agent-config/commit/cede9c9c51236802784dda2d51d4a000a9105f45))
* **agent-switch-link:** close 8.1 and 8.2, the lock shipped in 20.3.0 ([9859555](https://github.com/event4u-app/agent-config/commit/98595559bcb4d1f2a35327f890dcc0eb498b6ca8))
* **proof:** regenerate the proof page for the new backed claim ([9340ea6](https://github.com/event4u-app/agent-config/commit/9340ea62fce15ea4850f9f8e5028b71846daddfd))
* **roadmap:** re-review the measurement risk register for step 1.6 ([dda069a](https://github.com/event4u-app/agent-config/commit/dda069a7ca7d943620f3ac2cff5d549564bdc0f9))
* **roadmap:** close step 1.5 on its BETTER reading and track the runner timeout ([0c93462](https://github.com/event4u-app/agent-config/commit/0c934622a38a05479723195340d651e8ece7e248))
* **reports:** re-derive the backed-claims denominator to 65 ([cc350e3](https://github.com/event4u-app/agent-config/commit/cc350e3867a619a98f2a56f5271d1108349e347b))
* **claims:** add the scoped package-beats-no-rules claim ([acd748d](https://github.com/event4u-app/agent-config/commit/acd748d2a80183ac3219925b0b67a2296ac2707b))
* **bench:** record the five-arm confirmation, BETTER on its own 504 pairs ([9e74dcd](https://github.com/event4u-app/agent-config/commit/9e74dcdbe7f090f1c978bea11db04af13555b24b))
* **roadmap:** re-review the measurement risk register for step 1.5 ([8d30c57](https://github.com/event4u-app/agent-config/commit/8d30c5758071b453fb5e8bb09a07103405dce9bb))
* **bench:** pre-register the five-arm confirmation, vanilla against package ([131c996](https://github.com/event4u-app/agent-config/commit/131c996c8f50d04f8cf6f8a59a341c3f681fec59))
* **evidence:** record the owner's budget for the five-arm confirmation ([b27ac4b](https://github.com/event4u-app/agent-config/commit/b27ac4b68b0e8a7fa71bd0c0367955a2e5ee3e3f))

### Tests

* **install:** assert the permission carry-over on every platform ([d14f72b](https://github.com/event4u-app/agent-config/commit/d14f72b62ab85331e0f6212ca882471b88681515))

### Chores

* **evidence:** after-the-fact council review of the #2768 bypass ([fca5243](https://github.com/event4u-app/agent-config/commit/fca52434b7d3638c6028c44b1635cc8287a0698d))

Tests: 40242 (-23 since 20.4.0)

## [20.4.0](https://github.com/event4u-app/agent-config/compare/20.3.0...20.4.0) (2026-11-12)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** the version memo drops failed probes and expires; git's list ignores GIT_LITERAL_PATHSPECS (3e3c479); progress and recorded tools through the env; a failed deploy is never "ready" (5d058d0); leave the pinned wrapper as it is; track the tool-id gap as a stub (398a483); the bash wrapper accepts every tool id install.ts deploys (d281ee0).
- **Honest nulls:** _none_
- **Known limitations:** the version memo drops failed probes and expires; git's list ignores GIT_LITERAL_PATHSPECS (src/scripts/_lib/environment_detector.ts declares a residual) (3e3c479); progress and recorded tools through the env; a failed deploy is never "ready" (src/scripts/install.ts declares a residual) (5d058d0); a progress bar and a short summary for init and global (src/scripts/install.ts declares a residual) (42b9d60); remember host --version answers until the binary changes (src/scripts/_lib/environment_detector.ts declares a residual) (91242a5).

> **Governance mix:** governance-only 1 vs consumer-only 1 (mixed 4, maintenance 7; taxonomy 1.1.0; range bdf47e1bd424..76a27116069b).

### Features

* **upgrade:** progress bar, recorded tools only, doctor reduced to what needs the user ([f848e9d](https://github.com/event4u-app/agent-config/commit/f848e9dfbd249f99cc35b55f26c9cd3c911090df))
* **install:** a progress bar and a short summary for init and global ([42b9d60](https://github.com/event4u-app/agent-config/commit/42b9d60c27ed98979dc69d38682cda11dd77d31f))
* **upgrade:** pass the upgrade on to every agent-switch account ([1e39cd8](https://github.com/event4u-app/agent-config/commit/1e39cd81b0e53a122f9a2be190a8eae5729244ed))

### Bug Fixes

* **doctor:** the version memo drops failed probes and expires; git's list ignores GIT_LITERAL_PATHSPECS ([3e3c479](https://github.com/event4u-app/agent-config/commit/3e3c4796a620033c72e0621fff03e234b078ded5))
* **install:** progress and recorded tools through the env; a failed deploy is never "ready" ([5d058d0](https://github.com/event4u-app/agent-config/commit/5d058d0c7e7d4c3f07d81ba3b86d327ab85fc1d5))
* **install:** the bash wrapper accepts every tool id install.ts deploys ([d281ee0](https://github.com/event4u-app/agent-config/commit/d281ee0c29c17c2d848b0f96e00002a6985ed24a))

### Performance

* **doctor:** remember host --version answers until the binary changes ([91242a5](https://github.com/event4u-app/agent-config/commit/91242a5266c344b6bc05b3407635fe9066aa55a1))
* **doctor:** read the markdown git lists for artifact-location, nothing outside a work tree ([0182736](https://github.com/event4u-app/agent-config/commit/01827368d08ddac587073690f9af1f4eba46c6b3))

### Reverts

* **install:** leave the pinned wrapper as it is; track the tool-id gap as a stub ([398a483](https://github.com/event4u-app/agent-config/commit/398a48317da00d02c1ab0a4172aeaab96e78c928))

### Documentation

* **agent-switch:** profiles now receive AC's user scope, rules included ([5a11058](https://github.com/event4u-app/agent-config/commit/5a11058e04ac7ea19e26391a3cd5980042601667))

### Tests

* **install:** bench keeps its logs, sorts versions numerically, waits for its registry ([bd3161d](https://github.com/event4u-app/agent-config/commit/bd3161dec34fc88141aed056f6367453e89c4965))
* **install:** time and check a fresh install and an upgrade in a clean container ([b37f480](https://github.com/event4u-app/agent-config/commit/b37f480bf8e4ee5d490ca7fbb7cfd05202752c86))

### Chores

* **roadmap:** regenerate the owned digest for the tool-id stub ([b5e48dc](https://github.com/event4u-app/agent-config/commit/b5e48dc1d4c2f46045dbf416bf4ac8cdd4acb34d))

Tests: 40265 (+30 since 20.3.0)

## [20.3.0](https://github.com/event4u-app/agent-config/compare/20.2.0...20.3.0) (2026-11-11)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** quiet output by default, --verbose / --debug for the full run (8069430).
- **Security and correctness:** drop the inferred drain; never remove a 20.2.0 lock file, fail closed instead (95cec4a); take no record lock until the hooks of the earlier install have exited (7685f54); never break a live holder's ticket, and hold the older lock path as a directory (455aaa7); do not score inline terminal-pane regions (105248d); repoint the codex writer citation to install.ts:1365 (26e0207); take the record lock rewrite out of the link chunk change (e5e2626); +11 more.
- **Honest nulls:** _none_
- **Known limitations:** mark each install run in the tx log (src/scripts/install.ts declares a residual) (ce43b02); skip tx-log writes the log already records (src/scripts/install.ts declares a residual) (f71c518); quiet output by default, --verbose / --debug for the full run (src/scripts/install.ts declares a residual) (8069430); batch transaction-log appends (src/scripts/install.ts declares a residual) (236ad29).

> **Governance mix:** governance-only 30 vs consumer-only 4 (mixed 22, maintenance 17; taxonomy 1.1.0; range 57d03dc9d8f8..3f6f2b9f0868).

### Features

* **switch-relay:** lock the record by per-holder tickets that never evict a live writer ([b557f86](https://github.com/event4u-app/agent-config/commit/b557f8657ffb178dc46258105d63b69cf43853e7))
* **hook-budget:** a removed group or a dropped member needs a raise_log entry ([d4421a2](https://github.com/event4u-app/agent-config/commit/d4421a2b0d193a6ae1c79d018910855288e7a0c8))
* **upgrade:** quiet output by default, --verbose / --debug for the full run ([8069430](https://github.com/event4u-app/agent-config/commit/806943098457f885e54978dc4eec34206f85f305))
* **hook-budget:** chunk-group ceilings over chunks one caller loads together ([1e52ebe](https://github.com/event4u-app/agent-config/commit/1e52ebef4449a425a3a4e5e449a8b63806ebb8c2))

### Bug Fixes

* **hooks:** apply round-2 wording refinements to the copilot row comment ([eabc59c](https://github.com/event4u-app/agent-config/commit/eabc59c6d37fce9d2833d5510dedfa7167d96918))
* **switch-relay:** drop the inferred drain; never remove a 20.2.0 lock file, fail closed instead ([95cec4a](https://github.com/event4u-app/agent-config/commit/95cec4a9716004d7d41f1e2954d58add83c122fe))
* **switch-relay:** take no record lock until the hooks of the earlier install have exited ([7685f54](https://github.com/event4u-app/agent-config/commit/7685f54261605f349a0fb869d99cd349564872b9))
* **switch-relay:** never break a live holder's ticket, and hold the older lock path as a directory ([455aaa7](https://github.com/event4u-app/agent-config/commit/455aaa7ccade41022274e54c0904f2d1a3ea0f4c))
* **host-docs:** scope the copilot config.json note to the CLI ([38d12e5](https://github.com/event4u-app/agent-config/commit/38d12e5a702d38ab512d161e2d54d0fa12a43c17))
* **language-mirror:** do not score inline terminal-pane regions ([105248d](https://github.com/event4u-app/agent-config/commit/105248d2e824cc9d2835abd5a0c9dec0b2312688))
* **report:** repoint the codex writer citation to install.ts:1365 ([26e0207](https://github.com/event4u-app/agent-config/commit/26e0207c6bb6f972f06566e0d52179a3350694d4))
* **host-docs:** re-establish the drifted copilot hooks row ([e5a3161](https://github.com/event4u-app/agent-config/commit/e5a31617b0ed1793d8d444a2d6d3bf46994cc6e9))
* **install:** mark each install run in the tx log ([ce43b02](https://github.com/event4u-app/agent-config/commit/ce43b021c387bc7f06334c98c81f867ae32e7580))
* **cli:** run settings:sync from its delegate bundle ([ffb38dc](https://github.com/event4u-app/agent-config/commit/ffb38dca04b47d8c414a8d06da2eae19e46d669a))
* **hook-budget:** refuse unknown flags in check_hook_bundle_composition ([0f9b76d](https://github.com/event4u-app/agent-config/commit/0f9b76deae92a1270dae97df4b9f8a02c9295911))
* **switch-relay:** give the older lock file back when it cannot be dated ahead ([3ed8f74](https://github.com/event4u-app/agent-config/commit/3ed8f74bc0381feef41e543597691259a0853063))
* **hooks:** bound the opted-in link at 63,500 B and call the version check what it is ([2f70392](https://github.com/event4u-app/agent-config/commit/2f703925ce923de962a3a87e161f751589a72195))
* **switch-relay:** date the older lock file ahead so that version cannot age it out ([0d9f090](https://github.com/event4u-app/agent-config/commit/0d9f090cd80a9634674cdd3e6e027414489c8d93))
* **hooks:** bind the link chunk to its callers' build ([362505f](https://github.com/event4u-app/agent-config/commit/362505fbf2d7449b098575c104f27cd7b9adc7e2))
* **switch-relay:** keep the older lock file in the protocol across an install ([a65f6d5](https://github.com/event4u-app/agent-config/commit/a65f6d5dfd4a67969780e58d7cb975fe00c61c11))
* **hooks:** correct the link chunk readings and state the opted-in cost ([2ffb6b6](https://github.com/event4u-app/agent-config/commit/2ffb6b6911f0a6d48de11e578b6f2f1f4c692e83))
* **switch-relay:** lock by per-holder tickets so a break never removes a successor ([a24cd73](https://github.com/event4u-app/agent-config/commit/a24cd73827881f0b963abb5c365afd308ffe4c61))
* **switch-relay:** never evict a live lock holder ([6d1cfd6](https://github.com/event4u-app/agent-config/commit/6d1cfd62f34f52a1969a626664723a9ffcfbef04))
* **release:** run the CI mirror on the release head before pushing it ([d80ee78](https://github.com/event4u-app/agent-config/commit/d80ee78ca870c6b125faebca3ffa53bc96214086))

### Performance

* **install:** skip tx-log writes the log already records ([f71c518](https://github.com/event4u-app/agent-config/commit/f71c518d31bf6fddd150ae228b0d0764c4df4057))
* **hooks:** keep the dispatch bundle under main's raised ceiling ([621e661](https://github.com/event4u-app/agent-config/commit/621e6616d643d85353c42c5dce11264bf89aa825))
* **install:** batch transaction-log appends ([236ad29](https://github.com/event4u-app/agent-config/commit/236ad29092d6fa9417e8e08dcce20403b14d7048))
* **hooks:** load the agent-switch link as its own lazy chunk ([8475063](https://github.com/event4u-app/agent-config/commit/84750636c1694c1359a7851487c9d03e0709bc5e))

### Reverts

* **switch-relay:** take the record lock rewrite out of the link chunk change ([e5e2626](https://github.com/event4u-app/agent-config/commit/e5e2626dfb546f11d9673f24dfabc8e1cdf44d01))

### Documentation

* **evidence:** record council round 3 on the copilot row, confirmed-non-expanding ([d464e66](https://github.com/event4u-app/agent-config/commit/d464e664cc3b0187a933bccbb90225fa9d27ab29))
* **maintainers:** regenerate the doc-path inventory for the interleave test's contract cite ([b63c2a5](https://github.com/event4u-app/agent-config/commit/b63c2a5a06b0777c86940632347a534e8359ec94))
* **council:** the three review questions on the record lock ([04764bc](https://github.com/event4u-app/agent-config/commit/04764bc152a99a7c0de5bb736c1f35d00310c4a7))
* **agent-switch-link:** exclusion across versions only after the cutover, one ordered procedure ([999ac21](https://github.com/event4u-app/agent-config/commit/999ac21ee963ec98deb3b1da31779477f9c6890c))
* **evidence:** record the owner's ruling on the #2951 refused seat ([2efa203](https://github.com/event4u-app/agent-config/commit/2efa2034f926894263cd9277ef98448c65529c4f))
* **evidence:** ratification record for the #2950 bundle-ceiling raise ([e48a69c](https://github.com/event4u-app/agent-config/commit/e48a69c8557b69f19a0ff4d0563026ec88541d0f))
* **agent-switch-link:** fail-closed lock across versions, cutover behind the opt-in, counted rollback trigger ([119136f](https://github.com/event4u-app/agent-config/commit/119136f48263998b930ffad4063a87cf1b83e462))
* **evidence:** the #2950 bundle-ceiling ratification prompt, verbatim ([cc406a1](https://github.com/event4u-app/agent-config/commit/cc406a18620c514f336d6db7fc23a386ada297bc))
* **agent-switch-link:** the drain before the record lock, and its limits ([8d2dd9a](https://github.com/event4u-app/agent-config/commit/8d2dd9aa505283113ab7075468c0c2b78f7c47b4))
* **evidence:** state gain, risk and rollback in the #2951 record ([996431c](https://github.com/event4u-app/agent-config/commit/996431cf40c076f273b08672cba42ded9f568027))
* **evidence:** record the #2951 copilot-row ratification review ([e36190f](https://github.com/event4u-app/agent-config/commit/e36190f4e20c9f21be78a000b8fff76b34738aaf))
* **agent-switch-link:** the lock without expiry, its directory, and the rollback procedure ([c2a9e9a](https://github.com/event4u-app/agent-config/commit/c2a9e9a15ba13cf4bfe4bd886822b3951a731886))
* **agent-switch-link:** keep reopened step 8.1 under the 150-word cap ([a1c70a5](https://github.com/event4u-app/agent-config/commit/a1c70a5afe8d2fd0e5f9172eaa9f936c2cfbe817))
* **ratification:** record council round 6 on the link chunk, ratified ([07eb672](https://github.com/event4u-app/agent-config/commit/07eb672c50384a3ccd03f232f755bb9829b15ad3))
* **evidence:** fit the round 6 question under the council's 50 KB bundle ceiling ([5afd90f](https://github.com/event4u-app/agent-config/commit/5afd90fe623360354a6cd9f25f59191d9f5ad1d5))
* **evidence:** the council round 6 question for the link chunk, without the lock ([37c9cd7](https://github.com/event4u-app/agent-config/commit/37c9cd7fd2fa1b3b9888d018a95dfa2163cadc7e))
* **hook-budget:** lower switch_link to 30,300 and the link group to 60,100 ([7ad014e](https://github.com/event4u-app/agent-config/commit/7ad014ed6847d620b5c4b66d5dc54a28a2c5600a))
* **roadmap:** close Phase 1 of the five-arm measurement on its INCONCLUSIVE reading ([40706f7](https://github.com/event4u-app/agent-config/commit/40706f7ad0b0cc7ba2f7383ae73ba5205a00de72))
* **bench:** record the five-arm pilot selection and the Stage B reading ([fbef69b](https://github.com/event4u-app/agent-config/commit/fbef69bf19bcee824f76a16d13880cfd13941c08))
* **roadmap:** fit the three activated roadmaps' Decisions tables to the class contract ([bfeb353](https://github.com/event4u-app/agent-config/commit/bfeb353ba65d7b23fa38dd4b2bd092fd8ef5b6af))
* **roadmap:** set the activated roadmaps ready, each with its own estate claim ([298116c](https://github.com/event4u-app/agent-config/commit/298116c2a3440300ab1a1fad23bc641d8ed2907b))
* **roadmap:** give the funded five-arm comparison its own active roadmap ([5ef0b0d](https://github.com/event4u-app/agent-config/commit/5ef0b0d8f90b1b10653cea441dee76599c75548b))
* **ratification:** state gain, risk and rollback for the link chunk ([e15d704](https://github.com/event4u-app/agent-config/commit/e15d704a78f43eb6db9d70bcfc5c40b28d461f81))
* **ratification:** record council round 5 on the link chunk, refused ([b5eb91d](https://github.com/event4u-app/agent-config/commit/b5eb91d3f839e0531ccc24fedec2cb6a9c77384d))
* **evidence:** the council round 5 question for the link chunk ([913daec](https://github.com/event4u-app/agent-config/commit/913daecc832e9f3ffac56dfebf38637a465e8733))
* **hook-budget:** lower quota_notice to 29,900 and the link group to 62,100 ([3346576](https://github.com/event4u-app/agent-config/commit/3346576fa835fc38dbf585fd28680d6243ed4c45))
* **bench:** pre-register the five-arm comparison on Sonnet 5.5 ([8384cb5](https://github.com/event4u-app/agent-config/commit/8384cb53c7c206fe06f1f5dea5cc12a1436374d1))
* **evidence:** record the owner's budget for the five-arm comparison ([8773341](https://github.com/event4u-app/agent-config/commit/8773341e0e0eb3d67780c726c27b1932bf47b4d2))
* **agent-switch-link:** current readings and the council round 4 question ([0bd8725](https://github.com/event4u-app/agent-config/commit/0bd872595514119c74a44e4ea90a917b0ed5f936))
* **roadmap:** re-review two risk registers; give the citation fix an expectation ([9522007](https://github.com/event4u-app/agent-config/commit/952200770e749306fc7f828b2b54fef85b70efd7))
* **roadmap:** carry the pass-3 gaps — stale evidence clauses, owner decisions in PR bodies, the direction constraint ([4ac9283](https://github.com/event4u-app/agent-config/commit/4ac9283147ba89574b204e1cd12c90726775a897))
* **roadmap:** record the closure pass on the two parked roadmaps ([a3650e4](https://github.com/event4u-app/agent-config/commit/a3650e4b5b15a72a82f61efe47b8480fdac6a8a9))
* **roadmap:** land the round's findings on the parked and stub owners ([8574611](https://github.com/event4u-app/agent-config/commit/85746116fd66385d5f1e475d960f10279ad88a00))
* **roadmap:** land the round's findings on the active roadmaps that own them ([a199be6](https://github.com/event4u-app/agent-config/commit/a199be6d3bc1fab23b9a71828865bb3ea856b891))
* **roadmap:** park two roadmaps for the review residues no roadmap owned ([4a5a258](https://github.com/event4u-app/agent-config/commit/4a5a258ac2c3c4f3b705089bc7d8d64ff7c42a00))
* **agent-switch-link:** lock rules, the link chunk, phase 8 progress ([94a5372](https://github.com/event4u-app/agent-config/commit/94a537262910dc43a785b0308718f74d482406f6))

### Refactoring

* **hooks:** load the link chunk without the lazy-concern table ([f1de65a](https://github.com/event4u-app/agent-config/commit/f1de65ac00783e663955eac601b41a1266e9ed95))

### Tests

* **switch-relay:** pause two holders at each other's steps, and pin 20.2.0's residual eviction ([864c147](https://github.com/event4u-app/agent-config/commit/864c14793b9204452b5f7594a52d0d7d84a250f4))
* **language-mirror:** German text around an inline region, and both region kinds together ([80b8055](https://github.com/event4u-app/agent-config/commit/80b80554794106ec8f2510295da87ed27689c97f))
* **release:** pin the pre-push order; drop a box-rule comment ([93c5ce3](https://github.com/event4u-app/agent-config/commit/93c5ce36b286cc8b9e109d5ba9a79a3e063cd6a9))

### CI

* **publish:** wait up to 30 minutes for npm to serve a release ([ba1b7c0](https://github.com/event4u-app/agent-config/commit/ba1b7c0228c931d76542303b338a1d740fa6ad1f))

### Chores

* **hooks:** raise the bundle ceiling by 200 B for the terminal-pane strip ([0b0726e](https://github.com/event4u-app/agent-config/commit/0b0726e1940a644a176daab3da9e2f3017965aff))
* **roadmap:** regenerate the owned digest after the activation ([b3cc278](https://github.com/event4u-app/agent-config/commit/b3cc2784a984a683acaf02a3fbd087d5432384c1))
* **roadmap:** regenerate the owned digest for the two parked roadmaps ([cc43cb3](https://github.com/event4u-app/agent-config/commit/cc43cb31f09974bfed73f2e741ab7668f0c9f5fd))

Tests: 40235 (+69 since 20.2.0)
