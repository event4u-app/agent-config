# Changelog Archive — pre-9.27.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `9.27.0`, split out of the main
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

## [9.26.0](https://github.com/event4u-app/agent-config/compare/9.25.0...9.26.0) (2026-08-07)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 17c3716, 27e6649, f352c7a, 8fdcc7b, 581dfa0, a396442 +1 more.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 3bae006.
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in cefcd37.
- **Known limitations:** _none_

### Features

* **memory:** gate the session-end learning hook on the recorded consent ([79a6aa8](https://github.com/event4u-app/agent-config/commit/79a6aa892f2d772254ef91c0b19cb93007da2d70))
* **settings:** resolve the nickname prefill through the documented chain ([e98a7cb](https://github.com/event4u-app/agent-config/commit/e98a7cba5cc76ccd62ab7b84be4b2a2b749d96e5))
* **bench:** price the cost axis per token bucket in the v2 report ([b234b3e](https://github.com/event4u-app/agent-config/commit/b234b3e7076d401f9201610545528097e84490f2))
* **bench:** preserve per-trial workspaces and add a real no-network selftest ([12df43b](https://github.com/event4u-app/agent-config/commit/12df43bc6e1ac2be87e62128accc00d1296db991))
* **bench:** add the package-ladder and bare-principle arms ([c3f1c31](https://github.com/event4u-app/agent-config/commit/c3f1c316c270aa166ed3164165a02c083345319c))
* **gates:** assert every authored skill REACHES the Claude tree, not just that it parses ([c42b1ad](https://github.com/event4u-app/agent-config/commit/c42b1adb2afb237d45182a59af705ef64eb4fe66))
* **settings:** make the provenance stamp decide something, and condense the rule ([27e6649](https://github.com/event4u-app/agent-config/commit/27e664999a8894e1b146a556fa114daee3511676))
* **settings:** normalise the just-in-time settings ask and compute its budget ([f352c7a](https://github.com/event4u-app/agent-config/commit/f352c7aea72beab330f1abd625041f7bcb46df3a))
* **language-mirror:** fall back to the system locale on a terse first prompt ([784ee64](https://github.com/event4u-app/agent-config/commit/784ee64307086a28e9657b0a0ae5ae2fac94309a))
* **gates:** fail the pre-push chain when the running hook bundle predates its sources ([a829a7c](https://github.com/event4u-app/agent-config/commit/a829a7cb50fac0fe02fc4af80c7083a890312913))
* **review:** one findings schema both tracks validate against ([581dfa0](https://github.com/event4u-app/agent-config/commit/581dfa079ee333edcba920b464a19c11542db4c8))
* **review:** make prompt provenance and author-vs-reviewer checkable ([cefcd37](https://github.com/event4u-app/agent-config/commit/cefcd37ae8a4b0ee5e42ee0514e9b09399f98870))
* **gate:** enforce the corpus refresh cadence and open the CSVs nobody opened ([c946769](https://github.com/event4u-app/agent-config/commit/c9467697823b5a0b82d8f3e4b4d34c8bd8fe813f))
* **rules:** close the write side of the UI loop ([a396442](https://github.com/event4u-app/agent-config/commit/a396442da455b6e02afddacc87c462f80b198499))
* **hooks:** per-concern tools: filter, applied by the dispatcher ([28a8f96](https://github.com/event4u-app/agent-config/commit/28a8f96ee413083e3f451f1bf49b5588483ae9aa))
* **gate:** ratchet gate_self_test adoption as a shrink-only non-adopter count ([99e3656](https://github.com/event4u-app/agent-config/commit/99e36560c208904510bc0525122ad2549d697bea))
* **agents:** create agents/proposals — the directory seven artefacts pointed at ([64717a9](https://github.com/event4u-app/agent-config/commit/64717a96680cc70d3de7c4dd9a853d92952fbb53))
* **design:** route a capability URL and a design-system dir to design-fidelity ([85b1562](https://github.com/event4u-app/agent-config/commit/85b1562c193f9eaf6ed63f8692f79e0b9d2eda3f))
* **commands:** add /roadmap:next — screen, select, then ship a roadmap ([459211c](https://github.com/event4u-app/agent-config/commit/459211cadcc7682f26c8b081ac6c87c2a4712e46))

### Bug Fixes

* **release:** stop masking every push failure as a moved remote ref ([47faa19](https://github.com/event4u-app/agent-config/commit/47faa19e080bbe27c3cd8dfeb0bee67a10acfbf8))
* **settings:** retract an overclaim and take the fork off the request path ([2139b17](https://github.com/event4u-app/agent-config/commit/2139b174c8e4afad3f7294bfc196ad0e79801cec))
* **settings:** close the R2 review findings on the prefill and the pins ([fe35e63](https://github.com/event4u-app/agent-config/commit/fe35e63702661f34e55345c5c4fa7e2cd6b34fa4))
* **tests:** narrow the ARMS lookup for noUncheckedIndexedAccess ([3b3e1b1](https://github.com/event4u-app/agent-config/commit/3b3e1b14ee8bb588004410d901835d35649b2544))
* **roadmaps:** make solution-minimalism report its own spend gate ([3d9ceef](https://github.com/event4u-app/agent-config/commit/3d9ceef6153ed6df35292bf74d9a48b1e83dd982))
* **cli:** both routing commands were dead through the shipped binary ([c2b38e2](https://github.com/event4u-app/agent-config/commit/c2b38e2263e9b27401ea38bb2782b0d7532c4527))
* **gates:** emit the freshness verdict via stdout, not console.log ([fa06eea](https://github.com/event4u-app/agent-config/commit/fa06eea18620e671f3c09ac877cb094c6022c0aa))
* **hooks:** design-slop read the tool fields where the dispatcher does not put them ([3ca190f](https://github.com/event4u-app/agent-config/commit/3ca190f0b2364c785f791dc106086209d86f1983))
* **ci:** close the five surfaces this change reds, one of them a real gate gap ([c7c25ff](https://github.com/event4u-app/agent-config/commit/c7c25ffc1eac8f8b73776c5655f35af42f9eb9f7))
* **conformance:** round 2 — the shipped gates did not fire, and four reasons were wrong ([8fdcc7b](https://github.com/event4u-app/agent-config/commit/8fdcc7b9d2de7c3239af7e809e86933e41cf44e2))
* **gate:** close the word-form count hole in lint_abstraction_thresholds ([d5c294c](https://github.com/event4u-app/agent-config/commit/d5c294c4cf547696bf452a385ea0935b191283cd))
* **video:** refuse --crossfade instead of silently delivering a hard cut ([6eea400](https://github.com/event4u-app/agent-config/commit/6eea4000146d1de2c8de703e046aa8072e9e4d96))
* **ci:** close the two count-and-fixture surfaces a new sub-command reds ([f8d9566](https://github.com/event4u-app/agent-config/commit/f8d9566ca568c45c18cb2ec62d72492eaecf7570))

### Reverts

* **gates:** drop the skill-completeness check — its premise is false and it blocks the release ([5473a92](https://github.com/event4u-app/agent-config/commit/5473a925e13989fc6ba382145ab20c485dae2995))

### Documentation

* **roadmap:** reopen step 4.2 — the prefill shipped, the ask did not ([5fb6c05](https://github.com/event4u-app/agent-config/commit/5fb6c053a587440749af0b6d29b37c00fc1c03d1))
* **roadmap:** close Phases 4 and 5 from evidence, re-encode the blocked steps ([2c70288](https://github.com/event4u-app/agent-config/commit/2c70288e372254be0cd0a23acfdd76f3b1318cb1))
* **bench:** add the ab-v2 reproduce path and the Phase-3 pre-registration ([bb0ad48](https://github.com/event4u-app/agent-config/commit/bb0ad480deddf4ee3739d80d795a6c8546de9ffc))
* cancel P1.2 on measurement, close the P2.1 null-scope check ([81fce51](https://github.com/event4u-app/agent-config/commit/81fce5189b88b9d64051cbf9d58e4322a783ca57))
* **roadmap:** close P1.3 and P5.3 with their measured departures ([1c101db](https://github.com/event4u-app/agent-config/commit/1c101db9a045cc0b298927ef3d8d2622e8ec6625))
* **roadmap:** close the four verified-fix steps of the inbox harvest ([b0cd2f4](https://github.com/event4u-app/agent-config/commit/b0cd2f4773b0f9a97135ecc5ff2432e0ae2513ab))

### Refactoring

* **settings:** point the four bespoke ask sites at the shared protocol ([17c3716](https://github.com/event4u-app/agent-config/commit/17c371647eddc5945dbbcc03e1cb2e698c63cf55))

### Tests

* **settings:** pin the ask-shaped settings migration ([3bae006](https://github.com/event4u-app/agent-config/commit/3bae00676daa7ae0e8c195fd2b6e00a2a25c60bb))

### Chores

* **ci:** retrigger pull_request event delivery ([a20088f](https://github.com/event4u-app/agent-config/commit/a20088f328d533827fac1de60273a3f206aceef1))
* **roadmaps:** record the cost endpoint against the Endpoints step ([a3585ad](https://github.com/event4u-app/agent-config/commit/a3585ad7152b64fbe250ea294d242ab5a86a693b))
* **roadmaps:** close the thresholds step, record the reproducibility residue ([39a93d3](https://github.com/event4u-app/agent-config/commit/39a93d33a3e69b132f643fe97380e2a7804d1acb))
* **reports:** refresh the originality report round 2 left stale ([a65f929](https://github.com/event4u-app/agent-config/commit/a65f92939bae5b170a3cf58464579ccf774c5a9e))
* regenerate router.json after the trunk merge ([0af3e84](https://github.com/event4u-app/agent-config/commit/0af3e8425106ccc395be79f66faacc3f8b45a5b1))
* regenerate router.json and the routed-rule count for the new rule ([f262b83](https://github.com/event4u-app/agent-config/commit/f262b83fdba6b71905b03333fd93f657ae0905a3))
* regenerate the tool trees and indices for the new rule ([2788940](https://github.com/event4u-app/agent-config/commit/2788940cc55326e125c2000ad3cf0e90fe2b5c51))
* **router:** regenerate router.json for the two new design-fidelity triggers ([20aee52](https://github.com/event4u-app/agent-config/commit/20aee52cb1d440d77ec4b9e712164addfd0a83de))

### Other

* **settings:** record the R2 findings, and announce the Iron Law 3 recurrence ([63e2f09](https://github.com/event4u-app/agent-config/commit/63e2f094c57c77ec18ecf4cf449e7682597be29f))

Tests: 11643 (+200 since 9.25.0)

## [9.25.0](https://github.com/event4u-app/agent-config/compare/9.24.0...9.25.0) (2026-08-06)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 5d653e2, 00018c4, 20bb411, cb0917d, 7641291.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in bd45f62, 11a699c.
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 5d653e2, 20bb411.
- **Known limitations:** _none_

### Features

* **commands:** add /analyze:conformance, and clear the six red CI checks ([5d653e2](https://github.com/event4u-app/agent-config/commit/5d653e2ecfa1b697c7c44a94087d0248debea3d9))
* **cli:** add conformance:behavior — replay transcripts through the shipped gates ([7c7a9dc](https://github.com/event4u-app/agent-config/commit/7c7a9dc10d83245b7507cbcef348e52901968c45))
* **hooks:** gate the language pin, git authorization and evaluator independence ([582a9f3](https://github.com/event4u-app/agent-config/commit/582a9f37b97d3cb1f6474963fea576349f6b0b5d))
* **authoring:** a decision-impact class, and four conventions Phase 2 owed ([7641291](https://github.com/event4u-app/agent-config/commit/7641291866dac3c24deaf4cea1827a6c24d63edb))
* **ledger:** record what the rule-body migration kept, folded, and lost ([11a699c](https://github.com/event4u-app/agent-config/commit/11a699cda54c2eca55899af25435aee80a6b7f75))
* **skill-writing:** two conventions that travel with the artifact ([9120d0f](https://github.com/event4u-app/agent-config/commit/9120d0ffd1d8ea7140f9cc393e34c595dba29085))
* **interactions:** close the register over the set it claims to cover ([654837b](https://github.com/event4u-app/agent-config/commit/654837b1b8c3e33a43539d256bcd18592ade6621))
* **descriptions:** reject a description that argues against its siblings ([9889529](https://github.com/event4u-app/agent-config/commit/9889529bcb34e604fd2bedde3ab2abf98e3f6a40))
* **gates:** lint authored examples, and cap the on-demand depth layer ([c2c2d91](https://github.com/event4u-app/agent-config/commit/c2c2d917cede10eab64144ac9302857f6edd80b5))

### Bug Fixes

* **rules:** clear a lint regression and register the new rule in the router ([00018c4](https://github.com/event4u-app/agent-config/commit/00018c4315269467b856713ec056f2c61982ca33))
* **roadmap:** drop the duplicate un-archived copy ([532200a](https://github.com/event4u-app/agent-config/commit/532200ac94966a83df0a97e0c48e02e240d72c3f))
* **hooks:** stop counting vacuous verification as evidence ([7696e54](https://github.com/event4u-app/agent-config/commit/7696e5453b770d200e2925204cba4e08f323ca7b))
* **ci:** bump the gate-script population and regenerate the artefact index ([21a16f1](https://github.com/event4u-app/agent-config/commit/21a16f15a04c1c6b515832ddf56a951fce6b16d1))
* **schema:** insert decision_impact surgically instead of reserialising the file ([cb0917d](https://github.com/event4u-app/agent-config/commit/cb0917daca7080b2e5446473b6e420b854554d5e))

### Documentation

* **analyze-conformance:** adopt the checked-out-branch default from its sibling ([bd45f62](https://github.com/event4u-app/agent-config/commit/bd45f62e52edb86fd4e22cc8828a819a60788ae7))
* **analyze-inbox:** run in the checked-out branch; worktree only on request ([aaf29b4](https://github.com/event4u-app/agent-config/commit/aaf29b466e4df37236e32fd588077c83f51f5483))
* **roadmap:** record the conformance audit and close its roadmap ([1616c23](https://github.com/event4u-app/agent-config/commit/1616c236d4e47b0bc77af6521a2db23419760f75))
* **rules:** add evaluator-independence, and downgrade two enforcement claims ([20bb411](https://github.com/event4u-app/agent-config/commit/20bb4116d7d0a2dec198d4e08ade4371ff802b8a))
* **roadmap:** close and archive the authoring-discipline roadmap ([977ebd9](https://github.com/event4u-app/agent-config/commit/977ebd9a3771eaeb42b631cd9660bf4b16d0d1ae))
* **roadmap:** record the second execution pass and its three measured departures ([ec1acfb](https://github.com/event4u-app/agent-config/commit/ec1acfbfc5718a2197bdc9ca5cdcc091ba3a410c))
* **roadmap:** close Phase 4 steps 1-3 and 5, with what changed from the plan ([87d4bd2](https://github.com/event4u-app/agent-config/commit/87d4bd24e5f2b7f1e7429ba016e7d473aec00fa7))

### Chores

* **docs:** regenerate the artefact index for /analyze:conformance ([d1f8f25](https://github.com/event4u-app/agent-config/commit/d1f8f25105b8df849160b2b62e78a84f555d8222))
* **docs:** regenerate the artefact index for the new rule ([910555a](https://github.com/event4u-app/agent-config/commit/910555a46f5345352e8dd6a950a370ac53019fa1))
* **sync:** regenerate the projections for the two authoring skills ([44f037e](https://github.com/event4u-app/agent-config/commit/44f037efc1d92d07f6efed30ecb4cb612b2bb55a))

Tests: 11443 (+134 since 9.24.0)

## [9.24.0](https://github.com/event4u-app/agent-config/compare/9.23.0...9.24.0) (2026-08-06)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in cb126e8, f908f19.
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 7a1ca1b.
- **Known limitations:** _none_

### Features

* **commands:** add /analyze:inbox — verify a dropped artifact before planning on it ([fa7b278](https://github.com/event4u-app/agent-config/commit/fa7b278507d61606232ba47da0393915a178ea1f))
* **scripts:** make the absoluta census reproducible, and correct its own number ([de96a36](https://github.com/event4u-app/agent-config/commit/de96a36d89e7b08c49744d01361ce05a269d4225))

### Bug Fixes

* **index:** regenerate the artefact index and catalog after the description edit ([c1f306b](https://github.com/event4u-app/agent-config/commit/c1f306b01cdbaabe9a349a3fbdcea127254bd0ae))
* **preflight:** run the skill linter CI runs, so its failures never reach CI ([755e050](https://github.com/event4u-app/agent-config/commit/755e0508ad21dafad3c61b5ce507a572c2f5088e))
* **command:** bring the analyze-inbox description under the 200-char cap ([f72573b](https://github.com/event4u-app/agent-config/commit/f72573b7f8ce2fa83eea2671bc6142253f020182))
* **docs:** repair the broken install-profile example; keep dead ends in handoffs ([7a1ca1b](https://github.com/event4u-app/agent-config/commit/7a1ca1b5f4c88e1288235b272416fe55d521d8ac))
* **adr:** give ADR-218 the required frontmatter and a review_trigger ([854d3ef](https://github.com/event4u-app/agent-config/commit/854d3efdd83ab678189c7d6ccf3fd7850efdcaad))

### Documentation

* **create-pr:** resolve the duplicate 4d heading and its ambiguous refs ([315d6fe](https://github.com/event4u-app/agent-config/commit/315d6fe64eea7e39cd2b14a9ac57a2d2ac585654))
* **roadmap:** harvest 16 inbox artifacts — mostly into cancellations ([de84205](https://github.com/event4u-app/agent-config/commit/de842055f439b9f3ea0d2d979059e1d6a8dae18c))
* **rules:** act on council round 3 — falsifiable trigger, honest bound, ADR-218 ([cb126e8](https://github.com/event4u-app/agent-config/commit/cb126e88c3dd4d58bed92fe168bd090ee83d6a99))
* **rules:** mark the declared-protocol cap provisional, propagate the census correction ([f908f19](https://github.com/event4u-app/agent-config/commit/f908f19c3463a0d19607637cfffa4393899177f8))

Tests: 11309 (+10 since 9.23.0)

## [9.23.0](https://github.com/event4u-app/agent-config/compare/9.22.0...9.23.0) (2026-08-06)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 3d1ed67, e5e4c48, a7ecd7b, ff146a0, 927ff8a, 420e833 +1 more.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 9da7146, c1d9093.
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in c4a4920, 9242d41, 927ff8a.
- **Known limitations:** _none_

### Features

* **review:** severity is carried, confidence is its own field, density stays advisory ([9242d41](https://github.com/event4u-app/agent-config/commit/9242d416e77518f6d1b593184ae0123f3b0ecb34))
* **rules:** land the conflict audit, close its findings, archive the roadmap ([a7ecd7b](https://github.com/event4u-app/agent-config/commit/a7ecd7b73b99166baaee3838c4e8a5f7668bf580))
* **authoring:** require the primary bias, and lead rich artifacts with their obligation ([ff146a0](https://github.com/event4u-app/agent-config/commit/ff146a0f11f89c4f093d80aaf705915eb918c7bb))
* **rules:** a removal disposition, and the classification that stops "another rule" ([484596e](https://github.com/event4u-app/agent-config/commit/484596e1dc41e003c70678ec301ef4f801939736))
* **rules:** mandated lines at the decision point, and the two rules they need ([927ff8a](https://github.com/event4u-app/agent-config/commit/927ff8a83eb17a8d41f234dbfabe3d9caedcf066))
* **budget:** measure the rich-class band, lower it to what the corpus uses, gate it ([420e833](https://github.com/event4u-app/agent-config/commit/420e83368298029b4e01a412897ec1f0cec4286e))
* **settings:** add settings:set and fence the GUI write route ([3ffb705](https://github.com/event4u-app/agent-config/commit/3ffb7057d3ab4e963f3b09d49fbb8de57c6956ae))
* **settings:** fence every settings key behind an A/B/C class ([b09e84e](https://github.com/event4u-app/agent-config/commit/b09e84e9ce540ac6e4215538bef731c87ad7c91b))
* **gates:** self-test mode, estate-level result handling, and one equality-without-validity fix ([f7a022a](https://github.com/event4u-app/agent-config/commit/f7a022a7d039e03c5240eca94f7f9306ef5ed456))
* **gates:** make shrink-only mechanical against the base ref ([3e7eb9d](https://github.com/event4u-app/agent-config/commit/3e7eb9d9d35fe79d0655c51ef86ffabbe1f0a1b8))
* **gates:** ratchet ledger adoption, and stop rendering unmeasured categories ([678ba92](https://github.com/event4u-app/agent-config/commit/678ba92b862d6041c1e2af8d91a85252d53d687b))
* **gates:** adopt the ledger in three gates whose scan roots have failed before ([c04b9a5](https://github.com/event4u-app/agent-config/commit/c04b9a5785d4d5a02da317b44cdebc02bc83e3b4))
* **gates:** add a per-target completeness ledger ([fea6d7b](https://github.com/event4u-app/agent-config/commit/fea6d7b5181ba7815931cf83833946f1c405979f))
* **gate:** enforce the roadmap concurrency cap mechanically ([8add433](https://github.com/event4u-app/agent-config/commit/8add433b93d68191ffd44dab5c8f4f68102f1c17))

### Bug Fixes

* **authoring:** revert the two kernel-rule routing edges, state the gap instead ([3d1ed67](https://github.com/event4u-app/agent-config/commit/3d1ed67c3fd6ac8277f32d4c4d6bac1b274427e8))
* **authoring:** close all fourteen R2 findings ([e5e4c48](https://github.com/event4u-app/agent-config/commit/e5e4c48d6b993854fc41b681ea4c585e6b265f40))
* **review:** six real pre-filter instances — the keyword grep had missed all of them ([c4a4920](https://github.com/event4u-app/agent-config/commit/c4a49204dfefae74e518f284ee11f04fff511e63))
* **rules:** declare the 3 authority collisions, decline the gate ([943ad06](https://github.com/event4u-app/agent-config/commit/943ad067d68b3dfa31d15865d2c936cad2281767))
* **rules:** declare the two kernel-vs-kernel conflicts and fix the halt list ([c4ab544](https://github.com/event4u-app/agent-config/commit/c4ab5449b0c50c691e47793d247b980feec1b21b))
* **rules:** make ui-audit-gate satisfiable, invert the read cap, exempt file sets ([b47752d](https://github.com/event4u-app/agent-config/commit/b47752de370607ed1d691fdbc22ff10af3dd806d))
* **projection:** stop injecting ADR-004 manual rules into per-tool trees ([5d40a6c](https://github.com/event4u-app/agent-config/commit/5d40a6c184883844dff2a23154959accfef1022e))
* **cli:** route and document settings:set in the dispatcher ([0d2c6c5](https://github.com/event4u-app/agent-config/commit/0d2c6c58cbc9769e34e2c0c5d289c6de7c690501))
* **pack:** ship yamlIO with the writer, re-baseline the packed-size budget ([87b6fc1](https://github.com/event4u-app/agent-config/commit/87b6fc1328d90d140ffbbf31afc9ebb5452e00e2))
* **settings:** close all ten R2 findings ([84e4596](https://github.com/event4u-app/agent-config/commit/84e4596c7d42afbe3d26ee2e2b2e36836b754c97))
* **settings:** satisfy exactOptionalPropertyTypes in the settings:set argv parser ([a03d21b](https://github.com/event4u-app/agent-config/commit/a03d21b5960c0e13b910c01d86cb5c4f99a4ad77))
* **hooks:** forward the concern's own reason on a block; fix stale exit assertion ([b64cd4b](https://github.com/event4u-app/agent-config/commit/b64cd4bf2a4569c3fd3ea5fae85d9095bbf0d33f))
* **hooks:** translate verdicts to per-host native semantics ([f39698c](https://github.com/event4u-app/agent-config/commit/f39698cd8e626756c8add6a045e4e66b9b00751d))

### Documentation

* **roadmap:** record what landed and what the remaining phases actually cost ([15df545](https://github.com/event4u-app/agent-config/commit/15df545937dcf88e910240b7af45b2dfc6d464e9))
* **roadmap:** close both blockers and Phase 1, record the migration inventory ([9da7146](https://github.com/event4u-app/agent-config/commit/9da7146dbaea153bb4e2eae31069066663378dcb))
* **roadmap:** close P0.3-P1.6, record the two round-2 reversals ([cc67d73](https://github.com/event4u-app/agent-config/commit/cc67d73b287f0ce91f4c0690df824b670c4c604e))
* **roadmap:** file the absent-is-not-default blocker, close Phase 2 ([c1d9093](https://github.com/event4u-app/agent-config/commit/c1d90934b05168cba6ac3667d92d7a20602735b2))
* **roadmap:** record what the prerequisite re-read caught, close Phase 1 ([ba9b0f0](https://github.com/event4u-app/agent-config/commit/ba9b0f0f0e148857a8574faa2e512b64c099d2e4))
* **roadmap:** record the remote-CI verdict on the gate-integrity roadmap ([4e52e53](https://github.com/event4u-app/agent-config/commit/4e52e530e1c5adeab421af6f351d4d0f86bbcc55))
* regenerate the artefact index and catalog for the two new guidelines ([619d283](https://github.com/event4u-app/agent-config/commit/619d28377bc6180948336e98ad4eec58efd41659))
* bump the guideline count for the two new gate guidelines ([e5b3331](https://github.com/event4u-app/agent-config/commit/e5b333174587acf3218811e7f049b401a2436e1d))
* **roadmap:** close 33 of 35 gate-integrity steps, file the kernel blocker ([818b637](https://github.com/event4u-app/agent-config/commit/818b6379ab91a4f739cb1fe7a11d499582f3039b))
* **gates:** the authoring path, the false-green catalogue, and the CI delta ([554b9a9](https://github.com/event4u-app/agent-config/commit/554b9a992fb77e532344aadd298234cd63804278))
* **roadmap:** add Risk Register to road-to-rule-coherence ([4641101](https://github.com/event4u-app/agent-config/commit/4641101a9f234fd32beacecce01426b4f77a8d73))
* **roadmap:** add road-to-rule-coherence with measured scope cuts ([55a3957](https://github.com/event4u-app/agent-config/commit/55a395783dbbcfdba6346be9312fd04dec285f5c))
* **roadmap:** unblock everything the adoption gate was holding ([8878a88](https://github.com/event4u-app/agent-config/commit/8878a88b02422d5b93d820968a53c161a795ca64))
* **adr:** strike external adoption as a gate, re-anchor restraint to capacity ([e98221e](https://github.com/event4u-app/agent-config/commit/e98221e7de7b7bddf0655823ebcc5994bb9c4da6))
* **roadmap:** open two verification roadmaps, park the rest by arm ([d415dad](https://github.com/event4u-app/agent-config/commit/d415dada95c2ad7a89327831462870cc1fed8fd8))
* **adr:** lift the harvest freeze for verification infrastructure only ([11df060](https://github.com/event4u-app/agent-config/commit/11df0606810508f4fcfec404dc67cd975a92ef91))
* **sweep:** record the 40-source skill-ecosystem deep-dive ([45c55a2](https://github.com/event4u-app/agent-config/commit/45c55a222b61430ed39a572a4ff083cd383b81c7))

### CI

* register the three new gates, and close the CI-local parity delta ([2c709c3](https://github.com/event4u-app/agent-config/commit/2c709c3f1069a29c7a5f8a1cd1829b1377a40c34))

### Chores

* **sync:** regenerate the projection and tool trees ([f0ebea5](https://github.com/event4u-app/agent-config/commit/f0ebea51b823bd50e979ccf6ba66660bec3eef83))
* **roadmap:** regenerate dashboard after merging main ([4e3810a](https://github.com/event4u-app/agent-config/commit/4e3810a4ce364df32f22eead045a4526cf98be40))

### Other

* **authoring:** mark all fourteen findings fixed, drop the regenerable input ([f3d6e2a](https://github.com/event4u-app/agent-config/commit/f3d6e2a03eeca77adaac9b62f12d277d7d47b3a0))
* **authoring:** R2 completion review — 14 findings, all open ([703b8eb](https://github.com/event4u-app/agent-config/commit/703b8ebc5a5c55facfdc6cf468642eb0f03b2a71))
* **settings:** mark all ten findings fixed, drop the regenerable input ([0a96cca](https://github.com/event4u-app/agent-config/commit/0a96cca52a0116a4330ad51dbfe96b6269721d1b))
* **settings:** R2 completion review — 10 findings, all open ([36139ac](https://github.com/event4u-app/agent-config/commit/36139ac2f4d83b296222fd8f89db4c75d73c4f20))

Tests: 11299 (+208 since 9.22.0)
