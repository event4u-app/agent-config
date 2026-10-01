# Changelog Archive — pre-16.2.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `16.2.0`, split out of the main
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

## [16.1.0](https://github.com/event4u-app/agent-config/compare/16.0.0...16.1.0) (2026-09-28)

### Release highlights

- **Behaviour changes:** design-fidelity becomes provable, and the auto-rule bucket gets a ratchet (#2058) (107a210); split the ladder context and pay both size ratchets back (27daf4e); restore the concrete verification tools in autonomous-execution (e12e3c2); clear the six reds this branch created, and pay the payload cost honestly (bbdbcad); a delivery block, Class C at every key (018f729); tests are evaluators, and two gates that see the cheap half (64fcc3d); +8 more.
- **Default changes + migration:** regenerate the install bundle for the per_phase schema default (a5759da); move both MIGRATION.md refusals out of release.ts (ad5f26b); register the migration-section gate outside the ratification self-watch (d0ff02a); refuse a major cut whose BREAKING section has no migration entry (2bb5176); give 15.0.0 and 16.0.0 the sections their BREAKING entries earn (d720135); separate the template default from the parser fallback, in ten places (295e753).
- **Security and correctness:** stop the reach:doctor witness watching shared mutable state (f83ce46); repoint the codex writer citation after the second line shift (4ad8939); surface preserved files instead of swallowing every conflict channel (2d96040); stop the rule rewrite from dropping a preserved file's frontmatter (78e77b1); stage the file the installer would have written, and record it (eecbaa0); repoint the codex writer citation after the line shift (157482d); +29 more.
- **Honest nulls:** record a third exposure reading and the first near-miss (fabcaa5); record the independence level per group, closing AC-2 (af398a1); record the post-merge exposure reading as a dated addendum (dfa5bcb); prepare the rule-13 split as one verified, unapplied decision (2615000); pre-register release-hold-refuses-declared-state as unbacked (f599a4b).
- **Known limitations:** surface preserved files instead of swallowing every conflict channel (src/ui/pages/WizardPage.tsx declares a residual) (2d96040); stage the file the installer would have written, and record it (src/scripts/install.ts declares a residual) (eecbaa0); keep recorded digests across runs, so preservation survives (src/scripts/install.ts declares a residual) (539b08c); move the preservation state machine out of install.ts (src/scripts/install.ts declares a residual) (dfb10aa); preserve a user-modified managed file instead of overwriting it (src/scripts/install.ts declares a residual) (86fb653); write the transaction log from the headless apply path (#2057) (src/scripts/install.ts declares a residual) (5ca2d5b); +10 more.

> **Governance mix:** governance-only 89 vs consumer-only 21 (taxonomy 1.1.0).

### Features

* **corpus:** re-derive threat-modeling and database corpora ([6991eea](https://github.com/event4u-app/agent-config/commit/6991eeab900adb08f89b13b36960b4c20aba1016))
* **install:** preserve a user-modified managed file instead of overwriting it ([86fb653](https://github.com/event4u-app/agent-config/commit/86fb653f2304d743fc668546c2e4a5d5c1a6201f))
* **install:** write the transaction log from the headless apply path (#2057) ([5ca2d5b](https://github.com/event4u-app/agent-config/commit/5ca2d5b1ac0cc28deb4a2104458f6547c75dc1b4))
* design-fidelity becomes provable, and the auto-rule bucket gets a ratchet (#2058) ([107a210](https://github.com/event4u-app/agent-config/commit/107a21051f659aea4b9f362ecc7bd2d03903376d))
* **roadmap-template:** split rule 13, add release-holds rule 28 (#2055) ([47bb077](https://github.com/event4u-app/agent-config/commit/47bb0771991ee696d880857f2e2d7fd8209fa174))
* **lib:** a per-test independence record, so a level can be checked ([ca0dbca](https://github.com/event4u-app/agent-config/commit/ca0dbcae86ef1fbb3c67a9add1fb1f1d2080d3aa))
* **continuity:** the mission record, council transport, and the authority path ([85b9a55](https://github.com/event4u-app/agent-config/commit/85b9a55c1396a4fe9f2b5fb95310b426956dddd7))
* **guardrails:** what rides along, the typed-op watch, and the council's veto ([53fd5dc](https://github.com/event4u-app/agent-config/commit/53fd5dc755e243e3f07c5272614f680ea802c993))
* **sync:** a cascade base, and an unenumerated conflict routes instead of halting ([7d69218](https://github.com/event4u-app/agent-config/commit/7d692181d39654d222ab3a706da01e47f429ac10))
* **forge:** the six required layers, and doctor reads forge protection ([43bcf72](https://github.com/event4u-app/agent-config/commit/43bcf725ba7211ae8b68dc1d3d2076b8405c8ac1))
* **docs:** a per-host destructive column, measured rather than asserted ([0e100f1](https://github.com/event4u-app/agent-config/commit/0e100f17c560b2afd43fb72b7789f6290e063f7b))
* **roadmap:** prepare the rule-13 split as one verified, unapplied decision ([2615000](https://github.com/event4u-app/agent-config/commit/26150006d28a9b491c02f6ef8e8ef83c7bf5898f))
* **loops:** give the run-terminal vocabulary its three consumers ([fb3aa4e](https://github.com/event4u-app/agent-config/commit/fb3aa4ed7911907777f3ededc67ad9a6f19bf0a7))
* **claims:** pre-register release-hold-refuses-declared-state as unbacked ([f599a4b](https://github.com/event4u-app/agent-config/commit/f599a4b264a824d797b2b2e99915bb99b3bff82c))
* **roadmap:** land release-holds Phase 0.1-0.3 with three measured corrections ([104f08c](https://github.com/event4u-app/agent-config/commit/104f08c120847c6bb0c0b1132fe70ab128dd2712))
* **gates:** add a _lib-export-reach axis to check_gate_reachability ([496482a](https://github.com/event4u-app/agent-config/commit/496482a3c4279f56e6a8449e7fb71f004a7e52ea))
* **config:** declare the five loop surfaces and their instruments ([dc6d96d](https://github.com/event4u-app/agent-config/commit/dc6d96d26889b34d5791b2881d391279cd849b77))
* **install:** three-state ownership in the conflict matrix ([71a4580](https://github.com/event4u-app/agent-config/commit/71a4580070b49489951c25b7ed463b2a106dbfac))
* **settings:** a delivery block, Class C at every key ([018f729](https://github.com/event4u-app/agent-config/commit/018f7294360b662bad3a978937a10b69f37b93b3))
* **install:** read the recorded per-file digest the manifest already carries ([8624ca5](https://github.com/event4u-app/agent-config/commit/8624ca5bcfd110577a976dfb3dec3e4f71f4308a))
* **conformance:** the txlog check can go non-green, and its remedy is true ([a2bc8ef](https://github.com/event4u-app/agent-config/commit/a2bc8ef76b1ddf2444841b1230743db8d370d912))
* **gates:** tests are evaluators, and two gates that see the cheap half ([64fcc3d](https://github.com/event4u-app/agent-config/commit/64fcc3da23caf0492fce20a70336e91ad05d747b))
* **execution:** route mid-run residue by the same ownership table ([8585311](https://github.com/event4u-app/agent-config/commit/85853118c16ae11efc14d66490ef47dcc3753da5))
* **scope:** enumerate scope growth by ownership, not by size ([0bd6db4](https://github.com/event4u-app/agent-config/commit/0bd6db4b3dfe47a8073c3acb7690b1b27b533681))
* **hooks:** add the turn-end obligation reader, in shadow ([70b3559](https://github.com/event4u-app/agent-config/commit/70b3559bd06204732c3d1c27dde3cb4dc7713399))
* **census:** four axes, and the two targets that are actually measurable ([89a3838](https://github.com/event4u-app/agent-config/commit/89a3838f4dd40cacc394809a95518ea419e5c3b7))
* **run-continuation:** a run cannot end with red CI while its checkboxes read complete ([6baf897](https://github.com/event4u-app/agent-config/commit/6baf89735d2b98f86b4f231476f9ddf7f04e1f5c))
* **rules:** the fix-loop bound triggers a strategy change, never a question ([06a9f0b](https://github.com/event4u-app/agent-config/commit/06a9f0b896e713960e274f74ec378f9b833aba5e))
* **ask:** use the host's native primitive, and ask residue instead of filing it ([e236e88](https://github.com/event4u-app/agent-config/commit/e236e88e8dd3fc0abeeb409fac7ce4903711f260))
* **hooks:** mount the conformance verdict in shadow, block path untouched ([09be9ca](https://github.com/event4u-app/agent-config/commit/09be9ca0f9f88bc46756ac11afadc6ef06e441a3))
* **hooks:** record each host's ask shape as a manifest row ([4c52daf](https://github.com/event4u-app/agent-config/commit/4c52daf8d5470ba49f999d6e84cb3fac598f635c))
* **blockers:** a judgement call is closed, never parked ([5ed431b](https://github.com/event4u-app/agent-config/commit/5ed431b046c8bf82f89e974755257d8ed7a0b5d6))
* **hooks:** give the delivered-obligation record a ledger and two doctor lines ([ee388dc](https://github.com/event4u-app/agent-config/commit/ee388dc764106cfbe146f97ac30b220cf62f99e1))
* **skills:** contract the five behavioural stories and the breakpoint rows ([74ae80b](https://github.com/event4u-app/agent-config/commit/74ae80bd4e21e9abef36529ae2a07350943a6f56))
* **council:** the owner-facing options block becomes conditional on ownership ([915f2d3](https://github.com/event4u-app/agent-config/commit/915f2d3d5e9bea2f9634f1c65c2913dd394f8051))
* **scripts:** add ui_conformance_probe, structure gated before style ([8ed491c](https://github.com/event4u-app/agent-config/commit/8ed491c11ceba058b69a77ac220da0d3b8583a87))
* **rules:** test-first, a 40-line rule that activates the TDD skill ([d278dd9](https://github.com/event4u-app/agent-config/commit/d278dd98cb21393e0b64e081c2903820f17f93fa))
* **roadmap:** make `## Decisions` the plan's closure record ([088f98f](https://github.com/event4u-app/agent-config/commit/088f98fc2a7cc375b4eeefaf67eb902b55488ca0))
* **census:** count an explicit bypass as its own axis ([a145778](https://github.com/event4u-app/agent-config/commit/a14577800332efb614012c1a74b21f985eef6248))
* **rules:** close the declared enforcement-class vocabulary beside obligation_frequency ([513ecef](https://github.com/event4u-app/agent-config/commit/513ecefc6dfb6b2ce15d532bffa47a483065a312))
* **planning:** declare roadmap producers, and make closure their last step ([94112d8](https://github.com/event4u-app/agent-config/commit/94112d886793ba268e91efa660210a53737e9aac))
* **settings:** quality runs under a mission, per-phase cadence, an execution block ([83700d3](https://github.com/event4u-app/agent-config/commit/83700d38e16c0655019b80e9060cbae8c9477fef))
* **challenge-me:** add the closure sub-command and its detector ([0257cd3](https://github.com/event4u-app/agent-config/commit/0257cd39b51e47b2c5e0acecc225139d0fbd0c67))
* **release:** refuse a major cut whose BREAKING section has no migration entry ([2bb5176](https://github.com/event4u-app/agent-config/commit/2bb5176dcbd2ff98b4932e887af9749d8fb9d755))
* **release:** derive Known limitations, the fifth label nothing derived ([ebc4286](https://github.com/event4u-app/agent-config/commit/ebc4286bef16cd05f4f48bcb517ff9a223db06ee))
* **roadmap-create:** the council is a step, not a billable offer ([96f7aa8](https://github.com/event4u-app/agent-config/commit/96f7aa891186938b7b24f1a605c100849f8d3652))
* **council:** route decisions by ownership, not by impact ([58e4366](https://github.com/event4u-app/agent-config/commit/58e4366b8eb73e97756d9bc09394faae354171d0))
* **gates:** register the hook-manifest triple in check_generator_sync ([16cf6fa](https://github.com/event4u-app/agent-config/commit/16cf6fafc9fde371fdcb74b17610c4f991bac30b))
* **hooks:** let compile_hook_manifest write outside the tree ([bacde7d](https://github.com/event4u-app/agent-config/commit/bacde7d2ef1d6ccafca507156a842a4e92d3cf77))
* **gates:** deliver the memory before the action, and refuse a generated artefact its source outran ([9c7d1ef](https://github.com/event4u-app/agent-config/commit/9c7d1ef543a326e80dba0b42bfddc20905c90d4a))
* **payload:** split the payload metric into three, and correct a stale figure this roadmap carried ([3f439c3](https://github.com/event4u-app/agent-config/commit/3f439c3ca4b9959efb7cb6fed01dd85bd1fac445))
* **docs:** generate the enforcement matrix per slot, and title it for what it proves ([128b227](https://github.com/event4u-app/agent-config/commit/128b227889d6cb4b5ecb4d86aa6099c5bcd63c9c))
* **gates:** measure the enforcement table against its configuration, and get one mismatch ([dfc1f93](https://github.com/event4u-app/agent-config/commit/dfc1f93d9f8ce186097b537eb886ada96c4b5812))

### Bug Fixes

* **roadmap:** give D1 the mandated Decisions-table columns ([922085a](https://github.com/event4u-app/agent-config/commit/922085aafe00c049e1f1b6c3323bdca962bd7fd5))
* **evidence:** use the six-column findings-table shape ([8452a91](https://github.com/event4u-app/agent-config/commit/8452a91dfef6abe97895617a9cf9a283f682c37f))
* **evidence:** declare the review artefact's evidence type ([b54ae08](https://github.com/event4u-app/agent-config/commit/b54ae086a2814a3ce92c1d00133929ff5c9378fe))
* **tests:** stop the reach:doctor witness watching shared mutable state ([f83ce46](https://github.com/event4u-app/agent-config/commit/f83ce4600dba85f1ea139608ba056b91846f586f))
* **roadmap:** correct AC-2's prose, which put AC-5 in the refused set ([b992b5c](https://github.com/event4u-app/agent-config/commit/b992b5cd46db0b01d68d1fc295c5e70b57fc4467))
* **report:** repoint the codex writer citation after the second line shift ([4ad8939](https://github.com/event4u-app/agent-config/commit/4ad8939fd8df76305bced49a1be859f663a0bfb6))
* **wizard:** surface preserved files instead of swallowing every conflict channel ([2d96040](https://github.com/event4u-app/agent-config/commit/2d96040a9e7b1721570f0b100cb099500be89b6c))
* **install:** stop the rule rewrite from dropping a preserved file's frontmatter ([78e77b1](https://github.com/event4u-app/agent-config/commit/78e77b12a4d668c633ba7382af9cfbe8349f6010))
* **install:** stage the file the installer would have written, and record it ([eecbaa0](https://github.com/event4u-app/agent-config/commit/eecbaa07d530b2ef338b1739ba196cec13199eed))
* **report:** repoint the codex writer citation after the line shift ([157482d](https://github.com/event4u-app/agent-config/commit/157482d802f2a848fbb431ffd5bfc003b6cf0e84))
* **install:** prove sidecar ownership from the manifest, not from byte equality ([df8c516](https://github.com/event4u-app/agent-config/commit/df8c516c1bcb6ae41f609c70653bdf65a0ff3737))
* **install:** keep recorded digests across runs, so preservation survives ([539b08c](https://github.com/event4u-app/agent-config/commit/539b08cc2094e0e91caf4e13e1a80aadb88e6480))
* **install:** spell out the macOS realpath symlink instead of quoting it ([e740520](https://github.com/event4u-app/agent-config/commit/e740520fe6b37023b9938addccc887cd95dc235e))
* **gate:** base R1 staleness on the commit that introduced the review (#2065) ([61bbdb1](https://github.com/event4u-app/agent-config/commit/61bbdb10f2103a147cb90adc73e7bb3096d7c12c))
* **roadmap:** reword three ruleset-type mentions the reference gate reads as rule refs ([c204e85](https://github.com/event4u-app/agent-config/commit/c204e85c31a3cab803aa7127efb436055324b932))
* **roadmap:** mark the seven blocked steps so scanOpenSteps reads them ([438c2e5](https://github.com/event4u-app/agent-config/commit/438c2e55e239237bb9f0a3c63155c16b51b35461))
* **roadmap:** declare release-holds blockedness where the scanner reads it ([aed1e94](https://github.com/event4u-app/agent-config/commit/aed1e94f65a97a1eb47e9b0621e24e768e8621a3))
* **roadmap:** rebase the rule-13 split onto its moved base ([4a91ca8](https://github.com/event4u-app/agent-config/commit/4a91ca84ad1d6ed22e4f03baa249621f7e41b822))
* **roadmaps:** mark the 13 owner-gated steps blocked so the stop slot reads them ([112e52f](https://github.com/event4u-app/agent-config/commit/112e52fb139adc68fec77f320804b6330662cd19))
* **authority:** check that the record and the ledger name the same grant ([f5f8721](https://github.com/event4u-app/agent-config/commit/f5f872120fc5b4f5323c2e758aa4ffcc2a2dc6ba))
* **authority:** make the exact object, the verb and the turn checkable ([91b7864](https://github.com/event4u-app/agent-config/commit/91b786421ad3443b548e1862489be79a7f16892a))
* **roadmaps:** stop two note headings parsing as phases ([74d937b](https://github.com/event4u-app/agent-config/commit/74d937b39054e976183352a93b6a8a6d3f1bee00))
* **install:** correct a txlog docstring naming a removed module ([6dec7fc](https://github.com/event4u-app/agent-config/commit/6dec7fce14ffc1fba3d570f06cb0f30b97e4ed45))
* **roadmap:** decision-closure's banner claimed 0 of 22 while 17 boxes were checked ([4f6e09a](https://github.com/event4u-app/agent-config/commit/4f6e09a6acfa86ca4926c75f189eb633ed3b67dc))
* **portability:** drop the project-local task name from the verification table ([0cc441c](https://github.com/event4u-app/agent-config/commit/0cc441ca3674b59a468dc1a8bc4511a9805b4bbc))
* **tests:** anchor the memory_lookup staleness fixture to the real clock ([c9fdae7](https://github.com/event4u-app/agent-config/commit/c9fdae7152975e5c39b5301d140793b8cdeb8ce3))
* **merge:** resolve three badly-committed count-badge conflicts ([8cf38c6](https://github.com/event4u-app/agent-config/commit/8cf38c6230ac2aa610f88557af6aa22e949adaa9))
* **docs:** put the migrated German quote on one DE/EN anchor line ([5ee7e7d](https://github.com/event4u-app/agent-config/commit/5ee7e7d5ab5a17d84c33afc6cf14c01d1ebca7c6))
* **merge:** re-derive four contested counts on the merged tree ([a671cd7](https://github.com/event4u-app/agent-config/commit/a671cd77e182fc0f8fe628521f39719da34a2bba))
* **review:** eight findings from an independent review of this branch ([2f5c68b](https://github.com/event4u-app/agent-config/commit/2f5c68bdd518ebdcd2469cf642eea7d96c2e14ff))
* **context:** give the new context a referrer inside the context layer ([82a7dea](https://github.com/event4u-app/agent-config/commit/82a7dea8a9d9a748fb5a69e7c36282767d14ba53))
* **ci:** re-pin the secret-allow line, give the gates a base ref, and narrow the weakening detector ([484077c](https://github.com/event4u-app/agent-config/commit/484077ce125bda06e7b0931992f8c5259498e6b0))
* **conformance:** the log has no writer at all — correct the premise, not just the wording ([d04ed00](https://github.com/event4u-app/agent-config/commit/d04ed00f25b7a2d0f6efa806ace66f269fe81a74))
* **budget:** keep the scope-growth pointer off the always-rule closure ([585eaaa](https://github.com/event4u-app/agent-config/commit/585eaaa375fd42f5e4b43dbdf1a09ccb16cdb970))
* **budgets:** split the ladder context and pay both size ratchets back ([27daf4e](https://github.com/event4u-app/agent-config/commit/27daf4ec61e8d7d237756f5a8c82042692184c91))
* **install:** this branch published a claim its own tree contradicts ([0c4cff3](https://github.com/event4u-app/agent-config/commit/0c4cff3e04ed9d739ccd4d7d3615bab50dd1315e))
* **docs:** house dialect on the one line this diff authored ([929d151](https://github.com/event4u-app/agent-config/commit/929d151c9a09524880e9b1d39d68c87ea061bccd))
* **ci:** pay the settings rename off the source ratchet, and repair one link ([9413b9e](https://github.com/event4u-app/agent-config/commit/9413b9e1cf02be3355203130d76de26cb6dd864d))
* **ci:** rebuild dist/install, and clear two ratchets the new prose tripped ([529c28e](https://github.com/event4u-app/agent-config/commit/529c28e35f3f4ee0baeee98b6dba0167edf33a14))
* **ci:** clear the fourteen red checks this branch introduced ([d5a8efe](https://github.com/event4u-app/agent-config/commit/d5a8efebd2642ad52d5609fa154a6c92017260cc))
* **verify-repair-loop:** require reading the failure before revising ([2718b07](https://github.com/event4u-app/agent-config/commit/2718b071692e840132fa9f66e41fefeab438df03))
* **rules:** restore the concrete verification tools in autonomous-execution ([e12e3c2](https://github.com/event4u-app/agent-config/commit/e12e3c2d47c14a092a0b99abc6f79b7ee5e225eb))
* **ci:** move the two test gates to tests.yml — consistency.yml is ratification-gated ([7dc3e92](https://github.com/event4u-app/agent-config/commit/7dc3e922fceb54ebd82b013941ccae09f3d69c17))
* **hooks:** replace three raw NUL separators and record the concern admission ([39db453](https://github.com/event4u-app/agent-config/commit/39db4536880688ae7a300fb8dea4f1da08b87625))
* **templates:** drop the roadmap path from a stable artifact ([e1ed862](https://github.com/event4u-app/agent-config/commit/e1ed862c5211221cff2bfa7749cbbe613d6a367a))
* **telemetry:** remove three trigger-comparison flags nothing can compute ([8b0deb7](https://github.com/event4u-app/agent-config/commit/8b0deb77bfefaccb0a814bb348979c94dfa422b2))
* **ci:** clear the six reds this branch created, and pay the payload cost honestly ([bbdbcad](https://github.com/event4u-app/agent-config/commit/bbdbcade2400a5a3e5db8b98d62176db04b54610))
* **conformance:** keep the `unknown` symbol out of the over-ceiling doctor file ([160927e](https://github.com/event4u-app/agent-config/commit/160927e547b4d8da73529fda27d8308687cb2f1e))
* **skills:** correct the Storybook docs tool names, re-derived from an installation ([fea24ec](https://github.com/event4u-app/agent-config/commit/fea24ecbe0f44a6615d00e3c0b962dfc05326ab3))
* **docs:** canonical house dialect, and no bare src/ path in a shipped skill ([03e3ec9](https://github.com/event4u-app/agent-config/commit/03e3ec9057f5c1c769d10d187d4de52873585f76))
* **config:** dispose of the ui-conformance state leaf in the continuity surface ([d924ed6](https://github.com/event4u-app/agent-config/commit/d924ed64b9003d0e02886362ee13bbe3aa55571f))
* **budget:** keep the ownership axis and the ask contract off the ratchets ([de8bee8](https://github.com/event4u-app/agent-config/commit/de8bee8ee8095575badb49346901729e4cb0cfe2))
* **schema:** allow `produces_roadmap` on a command, and resync the index ([39b8ca1](https://github.com/event4u-app/agent-config/commit/39b8ca1da1c4b4ca3500acb71251faa5fac93e40))
* **rules:** routes_to back to block form — the linter parses no flow sequence ([0b80768](https://github.com/event4u-app/agent-config/commit/0b8076804d0316556da944d9165490417c7aa1d6))
* **secrets:** re-pin the gate-coverage canary allow-entry to 655 ([38dfab6](https://github.com/event4u-app/agent-config/commit/38dfab664eb389bcc0a3fbdd2954b4c441cd3e53))
* **rules:** scope test-first to workspaces and packs ([c580266](https://github.com/event4u-app/agent-config/commit/c580266d58d115dbce5648b8470c4442d9b3d940))
* **changelog:** the 16.0.0 and 15.0.0 heads claimed no known limitations ([da107a3](https://github.com/event4u-app/agent-config/commit/da107a339607bbea52d60852192b24a35511d83b))
* **ci:** claim the offset half of the estate ratchet, not only the growth half ([8e73efa](https://github.com/event4u-app/agent-config/commit/8e73efa3d00703524cd87a65bafc6e435fbea976))
* **ci:** admit the recall concern and claim its estate growth where it happened ([36f30b6](https://github.com/event4u-app/agent-config/commit/36f30b612e20772c637bceaee1cc3456e667bba9))
* **ci:** compile the hook manifest the YAML comment edit outran ([9703a69](https://github.com/event4u-app/agent-config/commit/9703a69341c20298666530d84d556c4650a98530))
* **ci:** rebuild the committed install bundle for the schema text this branch changed ([1a238ad](https://github.com/event4u-app/agent-config/commit/1a238ad674e11947b7e02c829950cfad6ff5dbab))
* **release:** read the remote before pushing, never from the rejection ([84d069e](https://github.com/event4u-app/agent-config/commit/84d069ef83c23ca2c834e9e1234c0adf89e323a2))

### Reverts

* **install:** drop the txlog docstring fix, record it in the roadmap ([252dbf9](https://github.com/event4u-app/agent-config/commit/252dbf9d4641a4a62ee908f9ba01724857da97ae))

### Documentation

* **roadmap:** record that trigger-eval freshness has no writer ([aa2e30e](https://github.com/event4u-app/agent-config/commit/aa2e30e7717e6b4a5e8c20a5fcedbcbe16d4ae5b))
* **roadmap:** record the corpus cadence decision the council reached ([289241d](https://github.com/event4u-app/agent-config/commit/289241deb1f28ab456d187bd5aa56172fae7cd1b))
* **evidence:** record the independent verdict on the witness test rewrite ([de40070](https://github.com/event4u-app/agent-config/commit/de40070dd9d7e22ff102b8e59580c3ec1388df26))
* **contributing:** adopt a Flake-diagnosis commit-trailer convention ([aa51c49](https://github.com/event4u-app/agent-config/commit/aa51c495bc3c9a75004d5076f7e1dcad9de2032e))
* **review:** declare the completion-review skip for the docs-only reading ([980cf47](https://github.com/event4u-app/agent-config/commit/980cf47772ad3f80d9a45c0466f92f8fc8c09983))
* **roadmap:** close Phase 1 of the corpus refresh ([ae7ef00](https://github.com/event4u-app/agent-config/commit/ae7ef00f41a4b6be216007f415761d4ea57953f2))
* **roadmap:** re-verify the bounded approval-floor waiver's one open item ([e5bf070](https://github.com/event4u-app/agent-config/commit/e5bf0709c2471987892b17e85036c54da263f2e3))
* **roadmap:** record the 2026-09-27 shadow-bar reading against ledger step 6.1 ([be9093e](https://github.com/event4u-app/agent-config/commit/be9093e6e52bb64baba661140379634a5d91fb89))
* **roadmap:** close out the declared component contract on the refusal ruling ([1b8d185](https://github.com/event4u-app/agent-config/commit/1b8d1852ba78e97e92a7c05ab1894b03a07da85b))
* **roadmap:** re-review the risk register after the refusal ruling ([19cb97b](https://github.com/event4u-app/agent-config/commit/19cb97b5b8705e3590879bf229fb155b60e8dccd))
* **roadmap:** resolve taxonomy-reversal-is-a-second-arrival as a refusal ([de0b4d0](https://github.com/event4u-app/agent-config/commit/de0b4d03154838157a5d6d66f6512c2044a93ad9))
* **roadmap:** record the second arrival on the archived granularity roadmap ([06ec030](https://github.com/event4u-app/agent-config/commit/06ec0300a86e0f535595665e1979418c10fea0da))
* **install:** correct every surface that published the unconditional-overwrite claim ([5c596ba](https://github.com/event4u-app/agent-config/commit/5c596babb3b5e588a0f9de3c58a94dd31033f512))
* **roadmap:** execute the screenshot blocker condition and escalate the ruling (#2060) ([46eaa0b](https://github.com/event4u-app/agent-config/commit/46eaa0b1d375526450d9edfb7c95d168ca217e18))
* **roadmap:** decide which-track-promotes-is-owner-reserved -- promote none (#2056) ([00a4dc8](https://github.com/event4u-app/agent-config/commit/00a4dc84c0c6ec770f096ec7ac60de17b00c7e32))
* **review:** declare the completion-review skip for a prose-only diff ([b63cdf3](https://github.com/event4u-app/agent-config/commit/b63cdf3431b57b982f3bdea149f9e15a89a78b22))
* **roadmap:** re-verify both blockers and three stale step reasons ([a84c73b](https://github.com/event4u-app/agent-config/commit/a84c73be1fe44579714e4d1de131614c69faf553))
* **work-engine:** correct how the engine reaches a consumer, and record the measured blast radius ([772735f](https://github.com/event4u-app/agent-config/commit/772735f55b65128311c28d86c3844d776cb76aa4))
* **evidence:** record a third exposure reading and the first near-miss ([fabcaa5](https://github.com/event4u-app/agent-config/commit/fabcaa5f5861265f5a6a5fc64941546bd9bfcaa8))
* **roadmap:** re-review the risk register and record the reachability risk ([9af15b7](https://github.com/event4u-app/agent-config/commit/9af15b780cfc5da74be0c6e8407e4a1aa14960a1))
* **roadmap:** mark the two owner-blocked screenshot steps blocked-by ([763f089](https://github.com/event4u-app/agent-config/commit/763f08942cf96edb37935b8beabcee0b86f1eefc))
* **evidence:** record the threat pass over the two authority modules ([0dc6835](https://github.com/event4u-app/agent-config/commit/0dc6835e65cc6dc5a51480af63e6489da6bb0f8b))
* **roadmap:** record the measured shadow-bar reading against step 6.1 ([5661596](https://github.com/event4u-app/agent-config/commit/56615963e937a917f65ab09788af937b5f3c18fa))
* **roadmaps:** mark the substrate stub's owner-reserved steps blocked-by ([1671e0f](https://github.com/event4u-app/agent-config/commit/1671e0f6c837d70d744cb3265e40643dbad6dace))
* **roadmap:** say why the last three criteria are impossible, not unstarted ([2d232dc](https://github.com/event4u-app/agent-config/commit/2d232dcb8e1e403655d199392c9e4b5e9f5f3361))
* **roadmap:** carry the four authority findings the AC-2 pass produced ([a1f11bc](https://github.com/event4u-app/agent-config/commit/a1f11bcc642dbfbfd31bda26b2d92a8478228b17))
* **roadmaps:** record the capability screen and mark the blocked steps ([8485b73](https://github.com/event4u-app/agent-config/commit/8485b737c841f776acf65c59214034a9ea6481a0))
* **roadmap:** correct the NEVER_WAIVABLE count, record the gated third site ([dc4a61b](https://github.com/event4u-app/agent-config/commit/dc4a61b6deaec601fecb44b703de4edb78e3eb45))
* **roadmap:** correct stale present-tense records in the waiver roadmap ([5dc973e](https://github.com/event4u-app/agent-config/commit/5dc973ea2b0872d69b019931597a43475848c62d))
* **roadmap:** re-verify decision-closure's five open boxes on the current tree ([732b1b5](https://github.com/event4u-app/agent-config/commit/732b1b579b651f1d597a5b56b33ec71465aa8dee))
* **evidence:** record the post-merge exposure reading as a dated addendum ([dfa5bcb](https://github.com/event4u-app/agent-config/commit/dfa5bcbc85b80e23310687a2fd50e79dbc7b8878))
* **review:** disposition all 12 round-2 findings against d04ed00f2 ([c77a257](https://github.com/event4u-app/agent-config/commit/c77a257a905694da410856b5da3d960dfa358182))
* **review:** bind each fixed finding to the commit that fixed it ([d7a2e78](https://github.com/event4u-app/agent-config/commit/d7a2e78667c95e7fb60128b91cfa56488f1bc849))
* **review:** completion review of drain/conformance-check — 11 findings, all open ([23d8cca](https://github.com/event4u-app/agent-config/commit/23d8cca415ff537f881df143a4a63c9115c6602b))
* **roadmap:** re-review the risk register against what landed ([7f79a07](https://github.com/event4u-app/agent-config/commit/7f79a07dec92c820c47980d0e408f281c505be33))
* **roadmap:** close the seven acceptance criteria with their evidence ([e2de90e](https://github.com/event4u-app/agent-config/commit/e2de90e569068eadde7ce334b1bbcada314086ba))
* **roadmap:** record why 1.4, 1.7 and 4.2 were not attempted ([6a3478d](https://github.com/event4u-app/agent-config/commit/6a3478d72207bf8a5f14651000c3565563f92312))
* **roadmaps:** re-review the substrate-stub risk register ([ce60f08](https://github.com/event4u-app/agent-config/commit/ce60f0871d0aa959bf3e965ffd47962390ae0903))
* **roadmap:** document the optional delivery frontmatter block ([741d9dd](https://github.com/event4u-app/agent-config/commit/741d9dd65e212991dedbc99393390ba4bcb4f5d2))
* **roadmaps:** record phases 1 to 4 landed, phase 5 owner-reserved ([0579873](https://github.com/event4u-app/agent-config/commit/05798739fc702abb4ae6366640c0f2f2642b8d0e))
* **roadmap:** re-review the risk register after Phase 1 ([8ee2a29](https://github.com/event4u-app/agent-config/commit/8ee2a29c475c08a78db54ea7202c98130740f2dd))
* **roadmaps:** re-cut the substrate stub against its now-open gate ([715b3ae](https://github.com/event4u-app/agent-config/commit/715b3ae39310300e81815c18c5fe3eaafccc2350))
* **evidence:** enumerate ADR-249 governance conditions against the tree ([d0a9e06](https://github.com/event4u-app/agent-config/commit/d0a9e06d2233690e0860960c1f6892ea76e472e0))
* **roadmap:** keep the auto-merge namespace ratchet, and say why ([6c5e2c9](https://github.com/event4u-app/agent-config/commit/6c5e2c976a65d76c1dcefb107c2d51b8f552d080))
* **settings:** name what no execution mode lifts, instead of "a safety floor" ([047fdaf](https://github.com/event4u-app/agent-config/commit/047fdaf21432345d8c31b839afcb50de5e9c3e77))
* **roadmap:** advance the two owner-reserved blockers with evidence, not a decision ([36c89fd](https://github.com/event4u-app/agent-config/commit/36c89fd570adf80983fe0991f0f73e5a03ad852c))
* **roadmap:** re-measure both open blockers instead of reading them forward ([5952d4c](https://github.com/event4u-app/agent-config/commit/5952d4c83f4ec9c979aa1c55342af8cfcb174c38))
* **roadmap:** mark AC-1 to AC-4 proven, and say why AC-5 and AC-6 are not ([40215fb](https://github.com/event4u-app/agent-config/commit/40215fbd2a556fdfb3bd3ffc170d57d74ce8f346))
* **roadmap:** mark the eight acceptance criteria the landed work satisfies ([ffe25e1](https://github.com/event4u-app/agent-config/commit/ffe25e17d6c34328d71b11e867d7e6837399ea38))
* **claims:** register the conformance catch against its pre-registered bar ([1fee1ef](https://github.com/event4u-app/agent-config/commit/1fee1ef3c18ac70e1333d8058976e3b5cce48c5b))
* **evidence:** declare the completion-review skip for this closure ([af45769](https://github.com/event4u-app/agent-config/commit/af457691a23cc0e9d013626005c9eb8bd89973ff))
* date the superseded platform measurements across the tree ([fda54cf](https://github.com/event4u-app/agent-config/commit/fda54cf92158f71a4c1147355b817ae87aa7db47))
* **anchor:** correct the record against re-measured forge state ([b4beff0](https://github.com/event4u-app/agent-config/commit/b4beff02644f91b8beb81fc08eaebd355d8ea17c))
* **anchor:** close Phase 1 against what shipped, with sensitivity proven ([e3eb5bb](https://github.com/event4u-app/agent-config/commit/e3eb5bbf97b4065f74b72e81ad4b334fb5f4314d))
* **anchor:** answer both open design questions and write the lockout recovery ([1722a3e](https://github.com/event4u-app/agent-config/commit/1722a3e368f8dbb3e1c8869e8e00edcefa1017db))
* **evidence:** re-read the enforcement census and correct a stale ADR pointer ([aed37c1](https://github.com/event4u-app/agent-config/commit/aed37c1764d17c8ea83d5423a24359d9007c2806))
* **evidence:** what the Known-limitations derivation returns over both spans ([740d622](https://github.com/event4u-app/agent-config/commit/740d622c6120a86c7f8852d354b23648a2f3f7e0))
* **gates:** recount the gate-coverage denominator on this tree ([04916f1](https://github.com/event4u-app/agent-config/commit/04916f181ea42b39363b6a82e876d812ecb067ed))
* **memory:** correct the hook-manifest regeneration recipe ([21ba777](https://github.com/event4u-app/agent-config/commit/21ba7772c6ff739ebcfaa609e762eb6d5ea7150a))
* **contracts:** name computed_style, interaction, viewport_matrix, media_emulation ([e69e40c](https://github.com/event4u-app/agent-config/commit/e69e40c3eceac549c48eed8434ecb4f1e5641017))
* **migration:** give 15.0.0 and 16.0.0 the sections their BREAKING entries earn ([d720135](https://github.com/event4u-app/agent-config/commit/d7201354dd080eef09a45b035dd927876e2e91ab))
* **changelog:** say which line won on the 15.0.0 kernel-deny entry ([163f447](https://github.com/event4u-app/agent-config/commit/163f447891ee6b5455c79d126c97d35579d52452))
* **review:** declare the completion-review skip — the diff carries no code path ([e6a206e](https://github.com/event4u-app/agent-config/commit/e6a206ebb4d5019d25c7a7e17b2a17c6952fa64f))
* **pr-merge:** pin the straggler batch to preparation and close the disposition set ([c63818b](https://github.com/event4u-app/agent-config/commit/c63818bfc4f18dc3ed39363192afcdcf69b7a9ca))
* **roadmap:** two release-truth defects the round found, both verified at source ([f1d927f](https://github.com/event4u-app/agent-config/commit/f1d927fd614e68fbe08dc2d9dd6eebcb8a2aaa92))
* **evidence:** one inbox round read three times, and the two counts it moved ([8abff9f](https://github.com/event4u-app/agent-config/commit/8abff9fc31820d87ca598aa79d198b0bc571eda1))
* **evidence:** enumerate and disposition the 18 mixed-trigger rules, and defer both rebinds ([4e5c5dd](https://github.com/event4u-app/agent-config/commit/4e5c5ddc9e7da7dde2e9dc90d2034962e87543d6))
* **projection:** separate the template default from the parser fallback, in ten places ([295e753](https://github.com/event4u-app/agent-config/commit/295e753aa809d125f63a1d8330b9e36af52ac605))
* **governance:** ratify the workflow registration, and close the fail-open flag it exposed ([7abad60](https://github.com/event4u-app/agent-config/commit/7abad60aab09a533755d6d3f012e395d7127cfa7))

### Refactoring

* **install:** move the preservation state machine out of install.ts ([dfb10aa](https://github.com/event4u-app/agent-config/commit/dfb10aaf6cfccaa6848a6fec7ccc69f296382d3b))
* **release:** drop the RunResult import the extraction orphaned ([88a46d2](https://github.com/event4u-app/agent-config/commit/88a46d24ae05c0db171c0c9853f3fada16d5a62b))
* **release:** move both MIGRATION.md refusals out of release.ts ([ad5f26b](https://github.com/event4u-app/agent-config/commit/ad5f26b71da2168d41c0f208dba5bf011f88c4cc))
* **release:** pay the size ratchet this branch moved, by pairing the refs ([63bf8ac](https://github.com/event4u-app/agent-config/commit/63bf8ac9ac692f35f5c4bbbc84155cf75e26ea59))

### Tests

* **e2e:** record the independence level per group, closing AC-2 ([af398a1](https://github.com/event4u-app/agent-config/commit/af398a182efbef5d154c7b870714158a618631bc))
* **e2e:** a four-phase long-run fixture over the composition, closing AC-7 ([37a6ff8](https://github.com/event4u-app/agent-config/commit/37a6ff8c624ff6e5bead783f37720a571cb4b231))
* **e2e:** land T1, T6, T9 and T10, closing AC-1 and AC-3 ([9de29d0](https://github.com/event4u-app/agent-config/commit/9de29d0a50c7aa3db5ac6c5181f2f792d26e7cc2))
* **server:** carry the delivery block in the settings fixture ([bbb3aa5](https://github.com/event4u-app/agent-config/commit/bbb3aa5e04eaf1d043379e33469216735a5b260b))
* **ui-audit:** pin the five-level taxonomy out of the emitted vocabulary ([2d3b8e2](https://github.com/event4u-app/agent-config/commit/2d3b8e214fc29a74df46a25b68b76c5a3215ecaf))
* **design:** add the ui-conformance sensitivity fixture, before the probe ([d81c72a](https://github.com/event4u-app/agent-config/commit/d81c72aa680aa660dfbd2b381b05aa2212255072))

### Build

* **install:** regenerate the install bundle for the per_phase schema default ([a5759da](https://github.com/event4u-app/agent-config/commit/a5759da2475a47133724fb0c880463ebcbb7d784))
* **install:** resync the install bundle with the delivery schema ([5ace984](https://github.com/event4u-app/agent-config/commit/5ace98478647fbc7044882bd1bb8d4ba9ce9e96c))
* **install:** regenerate the install bundle for the new settings keys ([4a1de39](https://github.com/event4u-app/agent-config/commit/4a1de39625b4c47fe6e6eb0ef13683cf78c8450b))

### CI

* **canary:** skip the live job when ANTHROPIC_API_KEY is absent instead of running it ([40f9376](https://github.com/event4u-app/agent-config/commit/40f937677e1398fdb070292f1d81e25a5e2b6f9c))
* register the migration-section gate outside the ratification self-watch ([d0ff02a](https://github.com/event4u-app/agent-config/commit/d0ff02a41aa8f56f0172c7270bde5b5e9bff239a))

### Chores

* **roadmap:** claim the estate offset exemption with its reason ([34f11cf](https://github.com/event4u-app/agent-config/commit/34f11cf745c72817eb8b87785e8a0d4995a71790))
* **roadmaps:** archive the conformance-check roadmap at 17/17 ([86255ab](https://github.com/event4u-app/agent-config/commit/86255abdf5885e5c49bd6d4721c108f86927b62b))
* **roadmaps:** archive the 2026 Q3 corpus refresh ([07975f9](https://github.com/event4u-app/agent-config/commit/07975f9c2a0ed8ff3e8c3eaf9c53f7beac92c9b6))
* **roadmaps:** archive the witness-without-shared-state roadmap ([b9d2660](https://github.com/event4u-app/agent-config/commit/b9d26605d5f4abf355322c0978c796d7a04d0e4e))
* **roadmaps:** archive the declared component contract ([8cf9680](https://github.com/event4u-app/agent-config/commit/8cf9680de4bbeedea891888d2271fff47010a0d8))
* **dist:** rebuild the CLI output and install bundle ([e04ca0c](https://github.com/event4u-app/agent-config/commit/e04ca0c7c5c1f2306ca0e1b55e1d56bcb28955d1))
* **gate:** lower the source-size ratchet to the measured total ([d19d2e7](https://github.com/event4u-app/agent-config/commit/d19d2e7f78c1ff1b45c97fff08b014b595d110af))
* **roadmap:** archive road-to-authority-object-exactness ([5c702a2](https://github.com/event4u-app/agent-config/commit/5c702a2b8206e75038cc50f5fa3dc55916ee9b71))
* **roadmap:** close the four criteria and promote the roadmap to ready ([e7c8625](https://github.com/event4u-app/agent-config/commit/e7c8625ee653c3378d074e514384ba510742207b))
* **roadmap:** declare the estate growth and decline the offset, on the record ([5918806](https://github.com/event4u-app/agent-config/commit/5918806e8b9f728070847abc62efd5a75b6f3632))
* **roadmaps:** archive the four roadmaps that reached every box ([d585e91](https://github.com/event4u-app/agent-config/commit/d585e919514eed984fcb9b8c7d95e9809d1fb43f))
* **roadmaps:** promote three finished drafts to ready so the sweep can see them ([85297c0](https://github.com/event4u-app/agent-config/commit/85297c0e2fe8b80018c4238ecc90712d96f6b11d))
* **proof:** regenerate the claims proof on the merged tree ([20a6c98](https://github.com/event4u-app/agent-config/commit/20a6c980e367d3df853eab2e4f990e05d8d17337))
* **index:** regenerate for the merged command surface ([a56cf71](https://github.com/event4u-app/agent-config/commit/a56cf71af64eef180912e4af79ae8c0ab5e969ba))
* **evidence:** re-pin the completion-review scope after the addendum commit ([ef111fd](https://github.com/event4u-app/agent-config/commit/ef111fdf4e9223c19c64fdaf5e0aed27a1b998fe))
* **census:** re-emit the host payload census at the current pin ([98a9c87](https://github.com/event4u-app/agent-config/commit/98a9c87c8eed724659312fded3d61b5bdd5137c1))
* **evidence:** declare the completion-review skip for this diff ([a2a1106](https://github.com/event4u-app/agent-config/commit/a2a11069e2119a438dcf83fe541fb94a905e740c))
* **budgets:** carry the source-size gain the extraction produced ([6eb5d4f](https://github.com/event4u-app/agent-config/commit/6eb5d4fb66ad7cc7c882b4df86268d266ee23fca))
* **build:** rebuild the install bundle after the settings-key rename ([953adca](https://github.com/event4u-app/agent-config/commit/953adcad205d661ed8cae4f34dd023f015d8bc65))
* **sync:** regenerate projections and derived pages ([6501427](https://github.com/event4u-app/agent-config/commit/65014277caf0f76b0b51fcc99e63b4c0eb543e9a))
* **tests:** drop the dead subprocess scaffolding in the doctor test ([0c37af1](https://github.com/event4u-app/agent-config/commit/0c37af1667730981425d7386c18428578bff6805))
* **index:** regenerate the artefact index for test-first ([6f2aa02](https://github.com/event4u-app/agent-config/commit/6f2aa02cfdcbef24c36e6070947373986b9891d4))
* **evidence:** regenerate the ADR evidence census ([5b9d161](https://github.com/event4u-app/agent-config/commit/5b9d1613bb0c502c306174d2731aa5ef8ead8320))
* **ci:** re-run the macOS shard that failed on a process-spawn error ([e59c004](https://github.com/event4u-app/agent-config/commit/e59c00479b73643138e6b8d2f8fdd4212f70a29a))
* **roadmap:** archive the delivery-flip roadmap and regenerate the archive index ([c8a0dbf](https://github.com/event4u-app/agent-config/commit/c8a0dbf32105b5968cc0de471731ae216bf30a39))
* **roadmap:** archive the enforcement-table roadmap and regenerate the archive index ([f483632](https://github.com/event4u-app/agent-config/commit/f483632c088508959b30dea5fd000d9677b8c208))
* **roadmap:** close the enforcement-table roadmap with its five acceptance criteria ([ec9f22a](https://github.com/event4u-app/agent-config/commit/ec9f22a3766d404524362ba5d2fe97b4b3888fe6))

### Other

* Refute the shadow-window installation-lag cause and re-measure the pre-registered bar (#2059) ([5644590](https://github.com/event4u-app/agent-config/commit/5644590ddf0b6a92c82bd3555946363cb5f3693d))
* Execute the detector blocker's condition, and make the taxonomy rejection citable (#2062) ([d5e109a](https://github.com/event4u-app/agent-config/commit/d5e109a4983c6df0562bacf05d1a9fc4885c3ee1))
* Release holds that refuse: the contract, the evaluator, and the authoring self-check (#2061) ([3f34210](https://github.com/event4u-app/agent-config/commit/3f342103168e56d0168655c12141829f5e1d6ca0))

Tests: 23972 (+883 since 16.0.0)
