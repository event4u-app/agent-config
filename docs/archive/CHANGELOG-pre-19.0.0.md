# Changelog Archive — pre-19.0.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `19.0.0`, split out of the main
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

## [18.2.0](https://github.com/event4u-app/agent-config/compare/18.1.0...18.2.0) (2026-10-25)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** bind every dispatch default to a policy row (8937ea0); pass the writer's merge default where exactOptionalPropertyTypes forbids undefined (a3563c2).
- **Security and correctness:** GIT_SAFE_ARGS stays private to gitProbe; pin the new description total (f2a963d); hold the per-spawn payload at zero net growth (2cd5fce); step receipts for the security-answer roadmap (34659ab); styled area-limit dropdown, 2D/3D switch in the view-tab look (c1a29fc); regenerate the catalog for the edited security skill descriptions (049ee89); regenerate the owned digest for the parked security roadmap (17215ae); +22 more.
- **Honest nulls:** _none_
- **Known limitations:** keep release.ts under its size ratchet and read dates via as-of (tests/scripts/release.test.ts declares a residual) (dda3752); close the review's gaps in the measurement binding (tests/scripts/release.test.ts declares a residual) (b09c783); print the dispatch rows a release moved and the overdue ones (tests/scripts/release.test.ts declares a residual) (d4529f4).

> **Governance mix:** governance-only 31 vs consumer-only 4 (mixed 33, maintenance 15; taxonomy 1.1.0; range 1e698dab1a99..e494248c3ced).

### Measured in this release

- dispatch-policy table introduced with 9 row(s)

### Features

* **audit:** the security ledger says partial instead of implying complete ([11b1f04](https://github.com/event4u-app/agent-config/commit/11b1f04a156ad58397161d0a696976adebc8e7f9))
* **threat-modeling:** uploads that stay data — processor, fetch-execution and race rows ([cd7599c](https://github.com/event4u-app/agent-config/commit/cd7599c7c533cb15c361f66a0a31f3ea093fd152))
* **security-audit:** a casual security question reaches the audit and gets a scoped answer ([7cd7d28](https://github.com/event4u-app/agent-config/commit/7cd7d28672bd3f3f4068a7ad2423d4bc2e6beb7d))
* **release:** print the dispatch rows a release moved and the overdue ones ([d4529f4](https://github.com/event4u-app/agent-config/commit/d4529f40200a54c9fcc577647b13bc3070f4a27e))
* **claims:** date open measurements and report the overdue ones ([1581cc5](https://github.com/event4u-app/agent-config/commit/1581cc56cbbd8e4fd6563390dbd7cda2e41c4500))
* **config:** bind every dispatch default to a policy row ([8937ea0](https://github.com/event4u-app/agent-config/commit/8937ea08c4213f940235ea12554959584fd6cbb8))
* **code-graph:** `code-graph open` shows the drawn map without redrawing it ([f9bcaee](https://github.com/event4u-app/agent-config/commit/f9bcaee436502a37303cb4c4806c377660c2b23f))
* **code-graph:** side panels pin on a wide window and fly out below it ([ad2ff1f](https://github.com/event4u-app/agent-config/commit/ad2ff1fea310d3932d45890b3c9e93520b8826c3))
* **code-graph:** use the AC icon from the info banner as the map's brand mark ([dad0976](https://github.com/event4u-app/agent-config/commit/dad0976d1d3f51af187f327e1faa3801bfefc935))
* **user-memory:** render the ADR-138 promotion gate in the audit ([8284a1a](https://github.com/event4u-app/agent-config/commit/8284a1a59ff2e6bbdcae5d344c7fe20dd34cf06b))
* **ratification:** gate the review's deciding modules and the record writer (4.1) ([3705817](https://github.com/event4u-app/agent-config/commit/3705817347d3637bdfee31d4a2cd16c4e7192d0e))
* **ratification:** gate the high-consequence rule class, failing closed, at both commits ([b8e35d4](https://github.com/event4u-app/agent-config/commit/b8e35d406f6331325735a04571a103f09dfb5c1c))

### Bug Fixes

* **code-graph:** GIT_SAFE_ARGS stays private to gitProbe; pin the new description total ([f2a963d](https://github.com/event4u-app/agent-config/commit/f2a963d1dfa9bd4b6f79805fd8ce3e92a6fd48f4))
* **security-audit:** hold the per-spawn payload at zero net growth ([2cd5fce](https://github.com/event4u-app/agent-config/commit/2cd5fcebf151a6d5b0031584b9975e6eb001fa19))
* **map:** styled area-limit dropdown, 2D/3D switch in the view-tab look ([c1a29fc](https://github.com/event4u-app/agent-config/commit/c1a29fc3d7d7e2dbc3fc25f3c55b855d0ef909d0))
* **map:** leave no stale strip under the graph after the stage resizes ([08d7433](https://github.com/event4u-app/agent-config/commit/08d7433dc4319ce18436ae06d89bb54c433a8f1f))
* **code-graph:** git probes ignore the target checkout's exec config ([34b8255](https://github.com/event4u-app/agent-config/commit/34b8255eb1a936904e7f36f57cf3d76528895935))
* **map:** label views without data, area-limit select, traced AC logo ([1c89c5f](https://github.com/event4u-app/agent-config/commit/1c89c5f9bec0c59d48086e48c43ba2d5322a9819))
* **claims:** run the dispatch-policy binding on the shipped path ([ee7203a](https://github.com/event4u-app/agent-config/commit/ee7203a330ea756b8c7b897dced8ebb5a4fbe339))
* **release:** keep release.ts under its size ratchet and read dates via as-of ([dda3752](https://github.com/event4u-app/agent-config/commit/dda3752d68ff3c66d1c7a6a6fb95f26594e61482))
* **code-graph:** keep the scope roles in map_answers to break an import cycle ([98e8ae2](https://github.com/event4u-app/agent-config/commit/98e8ae28a6eaf6fa68ce17a1849bc92310d0d859))
* **policy:** close the review's gaps in the measurement binding ([b09c783](https://github.com/event4u-app/agent-config/commit/b09c7835621faabd0afc9ec15e625e291d9b7194))
* **code-graph:** the viewer shows what the reader chose, and says what it cannot show ([8d78a5b](https://github.com/event4u-app/agent-config/commit/8d78a5b6d43e30b85c2f6846648786b427b4c29a))
* **code-graph:** cycles and the guess share measure code; one bucket per folder ([996a583](https://github.com/event4u-app/agent-config/commit/996a58388efc7530a4f46dacd1ba88a311ca777b))
* **code-graph:** draw the AC mark as inline vectors instead of shipping a PNG ([5f97fd5](https://github.com/event4u-app/agent-config/commit/5f97fd51eee3aa7368cd89401e6e25995634e55b))
* **code-graph:** one graph in 2D and 3D, mark on click, full height, a way back ([070e604](https://github.com/event4u-app/agent-config/commit/070e604c6ea009f03fbcf7a434c105a544aca7ff))
* **memory:** apply the review findings on the recall gate and the audit ([0534375](https://github.com/event4u-app/agent-config/commit/05343753873601d7de9f6319caeb20cfcb5a064a))
* **hooks:** fire the maintainer recall rows only inside this package ([e3088e4](https://github.com/event4u-app/agent-config/commit/e3088e4e408a85b44409a69b14e32409ec33393a))
* **budget:** raise the testing-anti-patterns ceiling for the reviewed Law 8 text, with its reason ([2db0362](https://github.com/event4u-app/agent-config/commit/2db0362531c89600a0a92ae2926caf4774673c5f))
* **ratification:** the schema that states the class criterion joins the watch list ([5c4f14f](https://github.com/event4u-app/agent-config/commit/5c4f14f53f16bfa695a95feeb2ff3a7703a15a21))
* **ratification:** the class is read only for a diff it can decide; a broken base is repairable through the gate ([1e0d5ee](https://github.com/event4u-app/agent-config/commit/1e0d5eedbd0c24b8d9c24dda92fb5d4f7e1126fb))
* **ratification:** a member's clause must be one of the criterion's three; entry point and inventory pinned ([667975d](https://github.com/event4u-app/agent-config/commit/667975d61ef67daa4edb1dd719b1ab7520adcc8f))
* **merge-risk:** owner routing reads the base-and-head class union, not the checkout ([8a2e4be](https://github.com/event4u-app/agent-config/commit/8a2e4be534a556e2532c6b6e612f2afcae10e8c8))
* **ratification:** reach the record writer through a dev task; keep the held steps at their recorded size ([a98d985](https://github.com/event4u-app/agent-config/commit/a98d9850002eec42122a3c7194288993ef64f152))
* **ratification:** pass the writer's merge default where exactOptionalPropertyTypes forbids undefined ([a3563c2](https://github.com/event4u-app/agent-config/commit/a3563c20384ee28d43b15a7f1883184354d4208f))

### Documentation

* **readme:** fit the code-map section into the word budget ([80f788e](https://github.com/event4u-app/agent-config/commit/80f788e02ab7d1d8a698122dc02f70a1adf91833))
* **roadmaps:** step receipts for the security-answer roadmap ([34659ab](https://github.com/event4u-app/agent-config/commit/34659abca31ae53af2415df94743feae83b16952))
* **roadmap:** close self-modification on the owner's OQ-12 answer and archive it ([7344fe6](https://github.com/event4u-app/agent-config/commit/7344fe68b5a971d73c2e1925cc23ad9e10114066))
* **readme:** recapture code-map screenshots with the new controls ([1a104ab](https://github.com/event4u-app/agent-config/commit/1a104ab145327ff70f3b3862da77cbe36530fc76))
* **roadmaps:** arrival verify clauses carry an expectation or read as prose ([5595530](https://github.com/event4u-app/agent-config/commit/5595530e811cdfad68eb6369e268677dc14beca9))
* **roadmaps:** step 1.1 and AC-1 name the gitProbe boundary that shipped ([aaf8ab0](https://github.com/event4u-app/agent-config/commit/aaf8ab084f3baaeae9b6068363afe5f3f3f620bb))
* **council:** ratification question for the code-graph git safe args ([d14ae0f](https://github.com/event4u-app/agent-config/commit/d14ae0fa1f17796918dad08516ae68971199fdfe))
* **roadmaps:** name the description-token growth the estate claim covers ([379f0c0](https://github.com/event4u-app/agent-config/commit/379f0c03afa1223a3413e75ba607c9c5262fdbf0))
* **roadmaps:** inbox-2026-10-as — one roadmap done, the rest carried to its owners ([d153f20](https://github.com/event4u-app/agent-config/commit/d153f2032113a7bc8cc6bf537f09bcbea4adfebf))
* **readme:** show the code map — blast radius plus four collapsed views ([4fabe1e](https://github.com/event4u-app/agent-config/commit/4fabe1e21230646d2cb1b2e8172f9442bdb3dfd0))
* **evidence:** bypass record for #2678; AC-2 and AC-3 re-measured on main ([746a0bb](https://github.com/event4u-app/agent-config/commit/746a0bb72909ee3666ffa025424f58e3b070b6a0))
* **roadmaps:** step 2.3 carries the range receipt ([8e58da9](https://github.com/event4u-app/agent-config/commit/8e58da9aa4885c126bf8bb0b580e2da280eaa1c4))
* **roadmaps:** receipts on the ticked steps, expectations on the verify commands ([4b652d5](https://github.com/event4u-app/agent-config/commit/4b652d5300c92d081d5e88f5497587babc62af31))
* **roadmaps:** claim the later/ growth of the learner roadmap ([df236d7](https://github.com/event4u-app/agent-config/commit/df236d79fa099ec566b4c0b4b4aa0deeff2876f7))
* **roadmaps:** a policy the measurements write, and a learner they gate ([3e287c5](https://github.com/event4u-app/agent-config/commit/3e287c5e2aa283fc9d8db058ce665b5e9ee6d6d0))
* **roadmaps:** end two verify clauses at their expectation ([ad4a80f](https://github.com/event4u-app/agent-config/commit/ad4a80fbec785c48e49045ca79702891e8c98db0))
* **roadmaps:** shadow receipts and parseable expectations ([24f4485](https://github.com/event4u-app/agent-config/commit/24f44853d3bce1e3b1be35f945af44d490a89695))
* **roadmaps:** archive road-to-a-memory-that-names-its-moment ([8c971fe](https://github.com/event4u-app/agent-config/commit/8c971fe0111b2fd7373e277136473e0f163a3f38))
* **adr-138:** replace the restart with a no-adoption limb ([863f26f](https://github.com/event4u-app/agent-config/commit/863f26f7972eef8cf2e1e6a32cd130cb0f5a43c6))
* **evidence:** name the session_end slot time in the dogfood closing condition ([982c5d8](https://github.com/event4u-app/agent-config/commit/982c5d8b4792a20cb0c022166ff50d01ea31b042))
* make four memory truth surfaces say what the tree does ([046f50b](https://github.com/event4u-app/agent-config/commit/046f50bc8fbf7fa2bd65609f66362d6b3f501a15))
* **adr-138:** restart the promotion gate at consumer reachability ([28f4639](https://github.com/event4u-app/agent-config/commit/28f46398ed427a50bfed45748d806d597fa3762b))
* **roadmaps:** discharge every draft point in the parked memory roadmap ([84f3121](https://github.com/event4u-app/agent-config/commit/84f312100ab46b9625b277adca53d709f9679de9))
* **roadmaps:** name the rejected alternatives in the offset claim ([639b5f7](https://github.com/event4u-app/agent-config/commit/639b5f7d68204375d7e01938fd9ef40d639f1307))
* **roadmaps:** land round inbox-2026-10-aq as one active and one parked roadmap ([35e6613](https://github.com/event4u-app/agent-config/commit/35e6613e7f8f430b4abaf92657c0d17f884d55a6))
* **roadmap:** receipts for 4.1/4.2; queue AC-5 as OQ-11 in its section ([18d3455](https://github.com/event4u-app/agent-config/commit/18d345561cb492597e40211cc5c97776818089f6))
* **evidence:** record the owner's ruleset bypass that landed #2657 ([db2df27](https://github.com/event4u-app/agent-config/commit/db2df27af6da70e41f9d561f57709ba7756a7969))
* **roadmap:** add the step receipts the active depth table now requires ([95fb370](https://github.com/event4u-app/agent-config/commit/95fb3702bcf3fc4d430a24b34d0604007843856c))
* **roadmaps:** close 4.1 and 4.2 of self-modification; queue AC-5 as OQ-8 ([4432eb2](https://github.com/event4u-app/agent-config/commit/4432eb29a1125f8167112cffb54824c227b74eb1))
* **roadmaps:** close 3.4, 5.2 and 6.2 of self-modification on the owner's D11 answer to OQ-7 ([81dbc26](https://github.com/event4u-app/agent-config/commit/81dbc26320c75c421b6c26520b95c039d66007a0))
* **ratification:** keep the refused 3.4, 5.2 and 6.2 records as they stand on main ([efd8c43](https://github.com/event4u-app/agent-config/commit/efd8c4392653e4ec7ee75fee337e5586a53247f7))

### Refactoring

* **code-graph:** one gitProbe() boundary instead of eleven spread call sites ([921a835](https://github.com/event4u-app/agent-config/commit/921a83501f2f16d07b3ff100b4a4e40ec762753d))

### Tests

* **policy:** type the fixture row under exactOptionalPropertyTypes ([ea4ae46](https://github.com/event4u-app/agent-config/commit/ea4ae4609b5f38c0154ffe851b5813ededc1ba7c))
* **code-graph:** the hand-built model fixture carries cycleSizes ([c5d83ab](https://github.com/event4u-app/agent-config/commit/c5d83ab545bf8e6ea1302b5bb82f9e0a2665b444))
* **code-graph:** run the map viewer's browser suite in the Chromium job ([a6acda8](https://github.com/event4u-app/agent-config/commit/a6acda836080f68f1fa9e44ae668d99c4278189d))
* **ratification:** every fixture states its class list; the recovery and rollout facts are stated ([968adad](https://github.com/event4u-app/agent-config/commit/968adadff2e48787130fcc61c94b0a0edef5625b))

### Chores

* **roadmaps:** regenerate the owned digest after archiving self-modification ([f3236d4](https://github.com/event4u-app/agent-config/commit/f3236d47bd89bda9243a5ac49c591ad8d623bdea))
* **index:** regenerate the catalog for the edited security skill descriptions ([049ee89](https://github.com/event4u-app/agent-config/commit/049ee894caa28f91e6562ffa2f49b45a4716e940))
* **roadmaps:** regenerate the owned digest for the parked security roadmap ([17215ae](https://github.com/event4u-app/agent-config/commit/17215ae398a259a2d23116689666841b42b1ff26))
* **roadmaps:** archive road-to-a-policy-the-measurements-write ([f1306da](https://github.com/event4u-app/agent-config/commit/f1306dad6dd5e53010981a03615b79dc2a43da11))
* **index:** regenerate the catalog for the memory:add description ([4f33bd8](https://github.com/event4u-app/agent-config/commit/4f33bd8fbe56a6c2256c330f7077874005794f5e))
* **roadmaps:** regenerate the owned digest for the new and archived roadmaps ([7d88781](https://github.com/event4u-app/agent-config/commit/7d88781f2f4f3edd1b73bf34a5e84144628d20df))
* **dist:** regenerate projections for the memory truth-surface edits ([fe30956](https://github.com/event4u-app/agent-config/commit/fe30956cee54a188b80b60f955ae2e46d1e57453))
* **reports:** regenerate skill-overlap after #2657 changed testing-anti-patterns ([43a43a2](https://github.com/event4u-app/agent-config/commit/43a43a293c69fa221702fdbbe1fbc87d7c40633e))

### Other

* Revert "revert(skills): take Law 8 off the branch on a refused three-round review; the proposal and record stay" ([a96a415](https://github.com/event4u-app/agent-config/commit/a96a4152bdb0608f0816ef0f33d1a9868fc41ad4))
* Revert "revert(ratification): take the step 3.4 writer off the branch on a refused review, keep the record" ([96befec](https://github.com/event4u-app/agent-config/commit/96befec58ebdcf8258500cd0abbb54652401090b))
* Revert "revert(ratification): take step 5.2 off the branch on a refused seven-round review, keep the record" ([8e60b5e](https://github.com/event4u-app/agent-config/commit/8e60b5e39df9090088eb67292fbe40ce8f2cd769))

Tests: 33535 (+156 since 18.1.0)

## [18.1.0](https://github.com/event4u-app/agent-config/compare/18.0.0...18.1.0) (2026-10-25)

### Release highlights

- **Behaviour changes:** schema version, pack boundary, injection phrase and ownership matrix (0f3dff8); an evidence bundle for a post or video, built without a model (961d125); a finding is confirmed by a red test a second agent wrote (fe210ff).
- **Default changes + migration:** _none_
- **Security and correctness:** step receipts, the parked roadmap's growth claim, and a shorter map-status description (783606f); set layerBreaches only when layer rules exist (5219f9b); the health grade no longer counts entry files dead or a package's churn as zero (c64e8ee); drop a candidate frame an older ffmpeg cannot seek to (1befbd7); keep pr/merge under its core budget and the receipt test's assertion count (dd24c50); shorten the independence warn texts to fit the bundle after merging main (99f23a4); +5 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 20 vs consumer-only 8 (mixed 18, maintenance 5; taxonomy 1.1.0; range 7b87b3a699d0..f202ba4c64db).

### Features

* **code-graph:** MAP.md and graph_map_status carry health, findings and blast ([205fa11](https://github.com/event4u-app/agent-config/commit/205fa11043225ac9d5985c6ccbd51472ebb552fc))
* **code-graph:** rebuild the map viewer as the Workbench design ([26384a4](https://github.com/event4u-app/agent-config/commit/26384a45b6a75045e227686d501f256882e3846e))
* **code-graph:** the map answers size, history, blast, knowledge and health ([7b6b90f](https://github.com/event4u-app/agent-config/commit/7b6b90f0f68597ac4b32ace8500b4b8cd2f3c5b8))
* **analysis:** validate media anchors where the analysis reads them ([6d3e677](https://github.com/event4u-app/agent-config/commit/6d3e6774763c645881a8a4b176034373e74cfcc5))
* **depth:** flip the R0/R1 depth table active on the owner's OQ-1 answer ([8c41a96](https://github.com/event4u-app/agent-config/commit/8c41a96369dc14b359c2e4411ecb5dca9c429cde))
* **analyze:** /analyze:post, the media entry of the foreign-source door ([e05dc34](https://github.com/event4u-app/agent-config/commit/e05dc348ece9217560506259bf5f66b3d9af9119))
* **media:** an evidence bundle for a post or video, built without a model ([961d125](https://github.com/event4u-app/agent-config/commit/961d125532320ad4cd3eaea440823cac6391ea32))
* **security:** a finding is confirmed by a red test a second agent wrote ([fe210ff](https://github.com/event4u-app/agent-config/commit/fe210ff88dff1d252f8858f0e6fab1cd94105174))
* **hooks:** a dispatch-role marker the independence hook reads instead of prose ([c58e4c8](https://github.com/event4u-app/agent-config/commit/c58e4c82104fd4b695af58eff20d8ba1f03e1dfe))
* **routing:** measure the skill-route hook's own gate ([dc24025](https://github.com/event4u-app/agent-config/commit/dc2402515e87c4544a5de3131fdf66cba263a42c))

### Bug Fixes

* **ci:** step receipts, the parked roadmap's growth claim, and a shorter map-status description ([783606f](https://github.com/event4u-app/agent-config/commit/783606fa8adee5878bfc49a8cb118064bc0807bd))
* **code-graph:** set layerBreaches only when layer rules exist ([5219f9b](https://github.com/event4u-app/agent-config/commit/5219f9b4277b749317be9834a55007d89e053110))
* **code-graph:** the health grade no longer counts entry files dead or a package's churn as zero ([c64e8ee](https://github.com/event4u-app/agent-config/commit/c64e8eea2dcba32c5ae4648905956c1d079f313d))
* **media:** drop a candidate frame an older ffmpeg cannot seek to ([1befbd7](https://github.com/event4u-app/agent-config/commit/1befbd7dc1f2ce86f3d1515dfacd9c210bd3192a))
* **depth:** keep pr/merge under its core budget and the receipt test's assertion count ([dd24c50](https://github.com/event4u-app/agent-config/commit/dd24c50e0b52e0dddbfaa9737dad8370ac0e0fbd))
* **ci:** schema version, pack boundary, injection phrase and ownership matrix ([0f3dff8](https://github.com/event4u-app/agent-config/commit/0f3dff834daf99119e929ec57849444fd0748b05))
* **hooks:** shorten the independence warn texts to fit the bundle after merging main ([99f23a4](https://github.com/event4u-app/agent-config/commit/99f23a447c429bbd4f941f99b94154fca4413112))
* **media:** bound the frame work and keep untrusted media off the network ([bc284dc](https://github.com/event4u-app/agent-config/commit/bc284dc643416f7464fefceb0c094c7493e326da))
* **security:** review findings on the matrix, the ledger and the role marker ([6969b18](https://github.com/event4u-app/agent-config/commit/6969b18cc324bfb60140c60e088bf12ac99eb792))
* **analyze:** fit the dispatcher description and hints under their caps; regenerate indexes ([2aac4ec](https://github.com/event4u-app/agent-config/commit/2aac4ec2840d5e3f428f3366f03d7768616c4eef))
* **templates:** pin the PR risk review workflow to major 18 ([ffa3281](https://github.com/event4u-app/agent-config/commit/ffa3281f47635a7118b88594afc09935d96ea197))
* **templates:** pin the risk-review workflow to the 18 major ([0adc7c0](https://github.com/event4u-app/agent-config/commit/0adc7c02ae8493afef840fa2710db944dc66103e))
* readme mcp toplist link ([c2f5e11](https://github.com/event4u-app/agent-config/commit/c2f5e111a40a30420b57fc72111936c48311434c))
* **trigger-eval:** fall back into src/skills, not the retired tree ([15e7275](https://github.com/event4u-app/agent-config/commit/15e7275cdf61eefa4d894a7d2cfa3f827400e4bd))

### Documentation

* **roadmap:** name the knowledge atlas references by class, not by source ([4be703d](https://github.com/event4u-app/agent-config/commit/4be703d3bc47bc459ff6bbaa026478b78dfcc6fb))
* **roadmap:** close and archive road-to-a-map-that-answers ([0547067](https://github.com/event4u-app/agent-config/commit/054706792202bac1cf378b592dae75164d0ac46e))
* **roadmap:** plan the map that answers and park the knowledge atlas ([8aa7b3f](https://github.com/event4u-app/agent-config/commit/8aa7b3f7a56c97ef88a2e30de75a6fa3e5d43453))
* **roadmaps:** name the production entry that reaches isMediaAnchor ([38eb223](https://github.com/event4u-app/agent-config/commit/38eb2235b27a2b139c4a1d38c8df9cc225a9d92a))
* **roadmaps:** a receipt on every step the two inbox-2026-10-ao roadmaps tick ([9ff0a86](https://github.com/event4u-app/agent-config/commit/9ff0a86a335e29876ff51689bbc6451c11191111))
* **roadmaps:** a receipt on every step the two roadmaps ticked ([aa55f91](https://github.com/event4u-app/agent-config/commit/aa55f91d0eee799fece20f615b4fcb8b6440aed7))
* **roadmaps:** no punctuation glued to a verify expectation ([01a58ff](https://github.com/event4u-app/agent-config/commit/01a58ffd0ad9d2098f4791f51784d20931579957))
* **roadmaps:** give every verify command its expected result; regenerate command flows ([6fcc553](https://github.com/event4u-app/agent-config/commit/6fcc553c55fdda25dc5e0c8edd1c1ac6fbe28daf))
* **roadmap:** record OQ-1/4/5/6 answers on step-that-costs ([30befc0](https://github.com/event4u-app/agent-config/commit/30befc0596e33d430d45fcc801352d3476a17ec7))
* regenerate the owned-roadmap digest and the ADR evidence census ([39bb139](https://github.com/event4u-app/agent-config/commit/39bb1395183a338f55d1157313a990104e8acee4))
* regenerate counts and the proof page for the new command ([45434dd](https://github.com/event4u-app/agent-config/commit/45434dd6f2c7153ba9abdeb8874577bb2c03bd6f))
* **roadmaps:** state the verify expectations and the measurement CLI's reach exemption ([73c2684](https://github.com/event4u-app/agent-config/commit/73c26846e9f63bceaacea5aefa1c1d4dfc142666))
* **roadmaps:** two roadmaps and three stubs from inbox round inbox-2026-10-ao ([9c9397c](https://github.com/event4u-app/agent-config/commit/9c9397c4efef0bb42c3e222d992a0c531c4d0f28))
* **roadmaps:** archive the measured-pointer-gate roadmap ([7e23cd5](https://github.com/event4u-app/agent-config/commit/7e23cd5cb8e69e0679f17ec26eb45420a3edf2c0))
* **roadmaps:** inbox round 2026-10-an — one roadmap closed, arrivals and owner questions filed ([93b936d](https://github.com/event4u-app/agent-config/commit/93b936d0359bc2b9dd011b60cf745d1a1a0ff0c4))
* **evidence:** record the hook-gate reading beside the ungated baseline ([656e9bb](https://github.com/event4u-app/agent-config/commit/656e9bb0e8124d314696b1b1d905303bbc6b5c09))
* **profiles:** name the real user-type writer and reader, and the two profile trees ([69deff1](https://github.com/event4u-app/agent-config/commit/69deff1c56107573be5bbe6d7910a67d5e5d2236))
* **roadmaps:** move the 4.1 and 4.2 screen notes out of the held steps ([602a98f](https://github.com/event4u-app/agent-config/commit/602a98fd59a4eba6fa82a8cc364bea54546acbca))
* **roadmaps:** move dated 2.1 and 4.3 notes out under the lightweight cap ([7ae1853](https://github.com/event4u-app/agent-config/commit/7ae1853e03d36eb8fea851dfd403ad1f29034a20))
* **roadmaps:** re-review the self-modification risk register ([638b775](https://github.com/event4u-app/agent-config/commit/638b77581646578d557f5e9b2d20556b9343748b))
* **roadmaps:** record why self-modification 4.1 and 4.2 wait for PR #2657 ([3462c28](https://github.com/event4u-app/agent-config/commit/3462c28a049109f6794f20b2d88d5fe6e2f3db92))
* **roadmaps:** record step 4.3's ring-0 wait as a structured blocker ([1bd6c04](https://github.com/event4u-app/agent-config/commit/1bd6c04d03e78b59323acf673e6e1e7c0bf9aaef))

### Refactoring

* **gates:** one test-path predicate for the generic detectors ([51fdf01](https://github.com/event4u-app/agent-config/commit/51fdf018af354a24998bda530dd69361f4992096))

### Tests

* name the reason on every platform- and ffmpeg-gated skip ([4d70c70](https://github.com/event4u-app/agent-config/commit/4d70c7000834b7b013628884f78bc671699604eb))

### Build

* **dist:** regenerate the seed-profile README ([8b2e2d1](https://github.com/event4u-app/agent-config/commit/8b2e2d1ee669bb7e2aad1a39b00c85a009ec29b0))

### CI

* trigger checks on the bot-opened nightly record ([97ba2e9](https://github.com/event4u-app/agent-config/commit/97ba2e98c0154dd908caf3308e687c0455e264d5))

### Chores

* **evaluator:** refresh the nightly measurement record ([282f1bb](https://github.com/event4u-app/agent-config/commit/282f1bba00392520b44b3d81af83d8c9207c18d7))
* **config:** drop step 2.1 from the step-size baseline ([c34ed9e](https://github.com/event4u-app/agent-config/commit/c34ed9e696ae6056abab4389611d984950ba4356))

Tests: 33379 (+143 since 18.0.0)
