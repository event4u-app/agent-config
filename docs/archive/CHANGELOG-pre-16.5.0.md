# Changelog Archive — pre-16.5.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `16.5.0`, split out of the main
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

## [16.4.0](https://github.com/event4u-app/agent-config/compare/16.3.0...16.4.0) (2026-10-10)

### Release highlights

- **Behaviour changes:** retire 46 default-neutral derivable settings keys (#2274) (b35d432); A team's git convention can be declared: ticket-prefixed commits, branch shape, and rebase instead of merge (#2235) (0f9c32e); ADR-281 and the texts it corrects (partial, self-modification roadmap) (#2251) (82a131f); credit a gate with the obligations it refuses, not the whole rule (#2246) (93a192b); precedence rule, contradiction review, and a reachable MCP-use recorder (#2241) (a6e5942); repair signals that mean what they say (loop flag, cap comments, verify forms) (#2228) (7548bfc); +1 more.
- **Default changes + migration:** Correct AC-2 to 37: one of the 47 selected keys was not default-neutral (#2278) (e48f52c); doctor is offline by default; --online opts the forge read back in (#2277) (60c129b); retire 46 default-neutral derivable settings keys (#2274) (b35d432); Queue 47 default-neutral settings keys for retirement (#2272) (9582574); a default install is served each rule body once; report pending reinstall (#2238) (d7b0955).
- **Security and correctness:** Findings that get a disposition: medium security blocks a release, and every 16.3.0 row ends somewhere (#2266) (bf7ed4f); an ignored file is not a pass; a green row names the type checker that did not run (#2244) (3e00f5e); a default install is served each rule body once; report pending reinstall (#2238) (d7b0955); land the two review-round defects stranded when #2231 merged mid-lane (#2233) (4e19d06); repair signals that mean what they say (loop flag, cap comments, verify forms) (#2228) (7548bfc); round-3..7 review findings (follow-up to #2230) (#2232) (3e7baa1); +4 more.
- **Honest nulls:** round-3..7 review findings (follow-up to #2230) (#2232) (3e7baa1); refuse a triggerless routed rule; measure the real thinned total (#2226) (52b409e).
- **Known limitations:** Phase 2 waits on a cancelled instrument, not on a machine (#2282) (0f6209e); retire 46 default-neutral derivable settings keys (#2274) (src/scripts/install.ts declares a residual) (b35d432); release evidence that reproduces (#2250) (src/scripts/_lib/release_highlights.ts declares a residual) (35209c1); a default install is served each rule body once; report pending reinstall (#2238) (src/scripts/check_standing_rule_delivery.ts declares a residual) (d7b0955); land the two review-round defects stranded when #2231 merged mid-lane (#2233) (4e19d06); measure the thinned layer in one unit, and price what stands between it and the ceiling (#2231) (src/scripts/install.ts declares a residual) (96dff15).

> **Governance mix:** governance-only 38 vs consumer-only 1 (taxonomy 1.1.0; range 5550dec9cf92..79e335f1c1b9).

### Features

* **roadmaps:** 6.1's verdict lands, and two things it uncovered are held rather than worked around (#2294) ([79e335f](https://github.com/event4u-app/agent-config/commit/79e335f1c1b9c41d6ee75c6c38ef57eeeb63f010))
* **roadmaps:** Phase 7's population, measured — and the first sweep that was thrown away (#2293) ([7a7a55b](https://github.com/event4u-app/agent-config/commit/7a7a55b2d8947d2c2e26ff59862bc8e9fac3f573))
* **roadmaps:** the hold step 1.1 asked for is neither of the two shapes it offered (#2283) ([e90a478](https://github.com/event4u-app/agent-config/commit/e90a4788ec0d9afa07aaeeac00bf73b76ecc30f6))
* **gates:** bring later/*-carried.md into the blocker lint, and nothing else (#2280) ([11dc63f](https://github.com/event4u-app/agent-config/commit/11dc63fe8521a0f87fb5a72203453497aca04ccf))
* **settings:** retire 46 default-neutral derivable settings keys (#2274) ([b35d432](https://github.com/event4u-app/agent-config/commit/b35d432b11cc3328517c7963c570bb1a06b8dda7))
* cross-file blocker refs and declared snapshot exemption (authority-routing phases 4-5) (#2264) ([b01d71d](https://github.com/event4u-app/agent-config/commit/b01d71d94dd8e763d6c1d5f9fc6f7776beffde55))
* **merge:** auto-merge on the owner's word, with a council danger gate (ADR-282) (#2256) ([edd18fe](https://github.com/event4u-app/agent-config/commit/edd18fea6867255375dc3797121260e137322f26))
* **roadmaps:** a routed authority for dangerous-action decisions (#2254) ([4b54335](https://github.com/event4u-app/agent-config/commit/4b54335a6217e25ae9c6273b591ee0e2919683c5))
* **enforcement:** credit a gate with the obligations it refuses, not the whole rule (#2246) ([93a192b](https://github.com/event4u-app/agent-config/commit/93a192bbd36c051032e028a68fed7f8574908907))
* **probe:** blocking time by cause, the CI-and-subagent hypothesis refuted (#2248) ([179019f](https://github.com/event4u-app/agent-config/commit/179019fb3c310f9ad1226877b7f191ae30f9d394))
* **release:** release evidence that reproduces (#2250) ([35209c1](https://github.com/event4u-app/agent-config/commit/35209c1f5bd2c7cc2521693c58523402ad03618e))
* **gates:** a ratification fence that follows the dispatcher's imports (#2247) ([8fdb481](https://github.com/event4u-app/agent-config/commit/8fdb4816921e50fbcb78e70beb0c347bad11890f))
* **roadmaps:** parked blockers get counted, one owner question gets a blocker, two checks for ticks and citations (#2245) ([764fa4f](https://github.com/event4u-app/agent-config/commit/764fa4fa4c7d88d0214fea4409e234760889d545))
* **code-graph:** measure the graph feeder's cost on the stop slot (graph-that-feeds-the-gate 3.5) (#2239) ([8d91928](https://github.com/event4u-app/agent-config/commit/8d91928cbd6111293b8eca16fde1240651d853e7))
* **ci:** gates a pull request can hear (#2249) ([c4051c7](https://github.com/event4u-app/agent-config/commit/c4051c7ed34cd9209496205286af3c5a1ef2d89e))
* **doctor:** an offline flag, and the 16.3.0 findings' doc and test fixes (partial) (#2243) ([fc1bdec](https://github.com/event4u-app/agent-config/commit/fc1bdec4f4edcf9438d42388e252352617f257b6))
* **install:** count unresolved installed links per artefact kind (#2240) ([ef32868](https://github.com/event4u-app/agent-config/commit/ef328687cfff78efa57cc957d90344fae7b90979))
* **ranker:** opt-in unrounded tie-break, tie metrics, and the tuning reading (#2242) ([e92e9dc](https://github.com/event4u-app/agent-config/commit/e92e9dcdb23bb16d596252fdb7c21e51fe7ec64a))
* **neighbours:** precedence rule, contradiction review, and a reachable MCP-use recorder (#2241) ([a6e5942](https://github.com/event4u-app/agent-config/commit/a6e5942236858a85b01246c0b04345c6148075d7))
* **spend:** a spend bound applies only where one was set (#2234) ([e3c30fc](https://github.com/event4u-app/agent-config/commit/e3c30fc9d3af3121a03dbc420b4fbaa235993b46))
* **installed-layer:** measure the thinned layer in one unit, and price what stands between it and the ceiling (#2231) ([96dff15](https://github.com/event4u-app/agent-config/commit/96dff15dd9d5544641b54e5c729becbef6f57306))
* **reach:** close road-to-modules-that-something-calls — census, repairs, and the five reported counts (#2227) ([3dbb3f9](https://github.com/event4u-app/agent-config/commit/3dbb3f99da8c731a6ba6f34fef48ae90834fb1df))

### Bug Fixes

* **roadmaps:** dispose the two neighbours-carried steps (#2267) ([dc9f98a](https://github.com/event4u-app/agent-config/commit/dc9f98aa05c31fe20e52ec2a38f089771bbbea37))
* **roadmaps:** carry the archived AC-3 and close parked-blockers step 4.2 (#2262) ([6051d37](https://github.com/event4u-app/agent-config/commit/6051d3744ac67057d6fc9bc178af3d36060ff4c1))
* **release-findings:** close the ratification-fence roadmap's last step (#2261) ([6a1cb1a](https://github.com/event4u-app/agent-config/commit/6a1cb1a5cfbd9ca582152ea7f3022100d517abfa))
* **touched-file-quality:** an ignored file is not a pass; a green row names the type checker that did not run (#2244) ([3e00f5e](https://github.com/event4u-app/agent-config/commit/3e00f5e0fb424e6c925058a184ac6942eb8dee89))
* **rule-inject:** a default install is served each rule body once; report pending reinstall (#2238) ([d7b0955](https://github.com/event4u-app/agent-config/commit/d7b095551302e7dc215d6ac7b2a4191619eb0ed5))
* **installed-layer:** land the two review-round defects stranded when #2231 merged mid-lane (#2233) ([4e19d06](https://github.com/event4u-app/agent-config/commit/4e19d06651700573df2bf395536011c32381ffc1))
* **scripts:** repair signals that mean what they say (loop flag, cap comments, verify forms) (#2228) ([7548bfc](https://github.com/event4u-app/agent-config/commit/7548bfca437880a8a3a69b7ce608538ae757f303))
* **reach:** round-3..7 review findings (follow-up to #2230) (#2232) ([3e7baa1](https://github.com/event4u-app/agent-config/commit/3e7baa13cfe63febf1735be9b17b414d21aa8527))
* **reach:** three R2-review bugs in the module-reach report (follow-up to #2227) (#2230) ([31e3da5](https://github.com/event4u-app/agent-config/commit/31e3da5baf7aa7bc2a06b53335b18f1846912c3a))
* **rules:** refuse a triggerless routed rule; measure the real thinned total (#2226) ([52b409e](https://github.com/event4u-app/agent-config/commit/52b409e897e42ab00e7305a6f17e1e27a1a35072))
* **code-graph:** repair the gate feeder path shape, then publish what step 3.3 actually measures (#2216) ([1668731](https://github.com/event4u-app/agent-config/commit/166873158c1bcbe585a95654376ec021873a4107))
* **deps:** lift proxy-addr to 2.0.8 so the runtime audit gate can pass (#2219) ([26510a6](https://github.com/event4u-app/agent-config/commit/26510a6c2a0e5d2997d639d6e5f3e9e9bc9dc34f))
* **rules:** repair the docs/ link group, correct two stale blocker claims (#2213) ([c58d7ea](https://github.com/event4u-app/agent-config/commit/c58d7eae8d1aab76d37f9018a57c5047d4b957bc))
* **roadmaps:** register step 0.2 blockedness where the carrier reads it (#2212) ([6b79d06](https://github.com/event4u-app/agent-config/commit/6b79d06defecbb3d8bc16d44e41160e0d4e470a5))

### Documentation

* **roadmaps:** close three prerequisites that were performed but never ticked (#2291) ([c393d6b](https://github.com/event4u-app/agent-config/commit/c393d6b244ff3031d46345ebb24b3fd2ffc6611e))
* **roadmaps:** mark the three Phase-3 steps that share one gate, and refuse to mark two that do not (#2290) ([05329ba](https://github.com/event4u-app/agent-config/commit/05329ba488e7fcf98a93bf2a2df4d4162d013d54))
* **roadmaps:** measure all five open acceptance criteria instead of assuming them (#2289) ([70bd51a](https://github.com/event4u-app/agent-config/commit/70bd51a8a1221e56cb8a15648282cb31b0b4ce97))
* **roadmaps:** a sixth reading of three stable negatives, and one rejected substitution (#2287) ([ebefcdc](https://github.com/event4u-app/agent-config/commit/ebefcdc1f0d35d0a7ca5044d33605d4b3247b679))
* **roadmaps:** the gate refused a comment, which answers the phase block (#2285) ([6715878](https://github.com/event4u-app/agent-config/commit/6715878859af7cd20fcac76855c4c4158b57edf3))
* **roadmaps:** Phase 1 was done except for three notes nobody wrote (#2284) ([5280e89](https://github.com/event4u-app/agent-config/commit/5280e8912ab480799e433d37df2d402b5b10b791))
* **roadmaps:** Phase 2 waits on a cancelled instrument, not on a machine (#2282) ([0f6209e](https://github.com/event4u-app/agent-config/commit/0f6209e8eb436f0ffcc679a34663dc6675c1bf8b))
* **roadmaps:** close 3.2 by council re-scope, and name the accrual trap I hit (#2281) ([d6e75f4](https://github.com/event4u-app/agent-config/commit/d6e75f45fa086dca62f953966479569fd54b93b2))
* **adr:** amend ADR-281 so a council recommends passage, never grants it (#2257) ([f76e83e](https://github.com/event4u-app/agent-config/commit/f76e83e47cdb823e37c96f4bbd16e53bc5c24c04))
* **governance:** ADR-281 and the texts it corrects (partial, self-modification roadmap) (#2251) ([82a131f](https://github.com/event4u-app/agent-config/commit/82a131feb5f6309365c962d272e9362ec9820c53))
* **council:** ADR-281 and the authority-routing decision cannot both stand (#2255) ([61cd5b7](https://github.com/event4u-app/agent-config/commit/61cd5b7ad6a6851f99e97405a20c1e8a9ea61607))
* **council:** record the authority-routing decision — ratified, 2 of 2 seats (#2253) ([0009ecd](https://github.com/event4u-app/agent-config/commit/0009ecd7c1f0d8f9659dd0ab249414879015b20e))
* **roadmaps:** close road-to-leading-every-row on the owner's answers and ADR-280 (#2237) ([adaad0a](https://github.com/event4u-app/agent-config/commit/adaad0aa2afd216767bf31404f533beb9393c5c8))
* **roadmap:** record that the two kernel-held rule links are human-gated (#2236) ([8510ebc](https://github.com/event4u-app/agent-config/commit/8510ebc995d224b1d353eb5042887905b7b16533))
* **roadmaps:** park the opencode probe and restore the risk-register gate on main (#2229) ([c267eae](https://github.com/event4u-app/agent-config/commit/c267eaef62b49abb38730734509d1a39f1a3d788))
* **roadmaps:** land inbox-2026-10-e as ten ready roadmaps (#2225) ([0c86ad9](https://github.com/event4u-app/agent-config/commit/0c86ad98fb540e3be196cdead4dcf98a49b03492))
* **roadmaps:** record the owner's answers to eleven open blockers (#2222) ([a75bb32](https://github.com/event4u-app/agent-config/commit/a75bb32106f695d006aa67f9ffc8185afb54faad))
* **evidence:** publish the shadow readings the release window opened, and carry 2.3 (#2217) ([2bb3a1a](https://github.com/event4u-app/agent-config/commit/2bb3a1a03d50a58a374f4f6d7600147e930a523e))
* **roadmaps:** park menu-precision on a two-branch wake after a fourth null probe (#2215) ([f3cc5db](https://github.com/event4u-app/agent-config/commit/f3cc5db98ae15c744a990731f19b88a2508a60a3))
* **roadmaps:** settle four of seven blockers on road-to-leading-every-row (#2214) ([2bf1067](https://github.com/event4u-app/agent-config/commit/2bf10671424cb09adb179c50512577d7b6b79a52))

### Tests

* **harvest:** re-derive the census pin after two sanctioned provenance tokens (#2224) ([d3973a8](https://github.com/event4u-app/agent-config/commit/d3973a86a13e3e101e3a018ae0567bf2099fd71d))

### Chores

* **roadmaps:** park the rule-triggers roadmap on two human-gated events (#2276) ([9be2b6f](https://github.com/event4u-app/agent-config/commit/9be2b6fad97389eb29ad5f24f561d04e45dacf56))
* **roadmaps:** park the two owner-blocked drafts in later/ (#2271) ([717aba6](https://github.com/event4u-app/agent-config/commit/717aba62a59685eca54515221e6165bae743dc05))
* **roadmaps:** archive the settings-classes stagnation roadmap (#2270) ([dd80cbe](https://github.com/event4u-app/agent-config/commit/dd80cbe5ce2f5aa3bb3a833a1d21d1f12a898126))
* **gates:** reaffirm the derivable-settings baseline after a drain that found nothing (#2268) ([6d603d9](https://github.com/event4u-app/agent-config/commit/6d603d93ecff326e9fc5c49d97dcd3f878bfb4af))
* **roadmaps:** close and archive road-to-enforcement-per-obligation (#2263) ([ebd8adc](https://github.com/event4u-app/agent-config/commit/ebd8adc37fbcd9ca334f2930653460d26f86437c))
* **roadmaps:** close and archive road-to-signals-that-mean-what-they-say (#2260) ([bacc2a0](https://github.com/event4u-app/agent-config/commit/bacc2a0dcaee3cab3864b1bb3cd11cc8f6aad4cf))
* **roadmaps:** archive the neighbours lane and carry its two deferred steps (#2259) ([7dc88a6](https://github.com/event4u-app/agent-config/commit/7dc88a61aae1b75026c14640817f76d18f739fa2))
* **roadmaps:** park road-to-learning-you-can-see-carried, and publish the reading that moved it (#2221) ([fcd5b9e](https://github.com/event4u-app/agent-config/commit/fcd5b9e0b27307444c15140a6ac56a965654fe2c))
* **roadmaps:** park road-to-stacks-beyond-php behind owner blocker b5 (#2220) ([d47793a](https://github.com/event4u-app/agent-config/commit/d47793a787dd3c61c4287194be8138e6c624bf6f))
* **roadmaps:** settle producible-vs-elapsed for the user_prompt_submit timeout and park host-claims-carried (#2218) ([763bc12](https://github.com/event4u-app/agent-config/commit/763bc121c24615027a01811322b73590845a85ad))

### Other

* The modification review — its questions, how a seat closes, how the verdict follows (#2292) ([bbe5b73](https://github.com/event4u-app/agent-config/commit/bbe5b73be4f06faa528d494a271d2c8b21e28bb2))
* Occasion 3 of 4 — one row corrected, one correction declined (#2288) ([0fd09eb](https://github.com/event4u-app/agent-config/commit/0fd09ebe3bc1ceb54fe06ea593addf609b46c3be))
* One step needed no council, the other split and found why (#2286) ([55360bb](https://github.com/event4u-app/agent-config/commit/55360bb87e794f8b8e6fd03134c05e1791aa2a66))
* Four law headings went to a council; one landed and three were refused (#2279) ([40b74b9](https://github.com/event4u-app/agent-config/commit/40b74b948f40e4875e9c9b4a72080cad04132532))
* Correct AC-2 to 37: one of the 47 selected keys was not default-neutral (#2278) ([e48f52c](https://github.com/event4u-app/agent-config/commit/e48f52cadf551e411aafdfc65d955d23a6bf8e1f))
* doctor is offline by default; --online opts the forge read back in (#2277) ([60c129b](https://github.com/event4u-app/agent-config/commit/60c129bfa74224abb86254f79909a715535522c6))
* Park the graph-feeder roadmap on an accrual wait its own repository cannot end (#2275) ([737f0d6](https://github.com/event4u-app/agent-config/commit/737f0d6633d52e51e3eb90115b17bfdc865eb43d))
* Close the pack-boundary base-into-narrow mismatch with an advisory edge the gate reads (#2273) ([9ecd663](https://github.com/event4u-app/agent-config/commit/9ecd6639fd8f4b2f02a277a8fe3f565d5783e792))
* Queue 47 default-neutral settings keys for retirement (#2272) ([9582574](https://github.com/event4u-app/agent-config/commit/958257418b9098ef37be6fc3118c7d4bcbc69861))
* Resolve 15 roadmap blockers, and run the council before any owner question (#2269) ([6d68417](https://github.com/event4u-app/agent-config/commit/6d6841712de38c4dcd8f5ff4c03bd5acc5b09cd3))
* Findings that get a disposition: medium security blocks a release, and every 16.3.0 row ends somewhere (#2266) ([bf7ed4f](https://github.com/event4u-app/agent-config/commit/bf7ed4f7559d8bd8827551bee21bf9b768262549))
* Harden the git convention from #2235: correct in a packed install, safe sync and rebase, and measure-and-propose for undeclared projects (#2258) ([b83bcb1](https://github.com/event4u-app/agent-config/commit/b83bcb19a7d5d649fbb8687c00a5327a2704febe))
* A team's git convention can be declared: ticket-prefixed commits, branch shape, and rebase instead of merge (#2235) ([0f9c32e](https://github.com/event4u-app/agent-config/commit/0f9c32e260c0e213273da9a448044e4403eac5a2))
* Re-price the neighbours lane on the tree it will be decided on, and stop its census caches leaking home paths (#2223) ([7cd6563](https://github.com/event4u-app/agent-config/commit/7cd6563a8c038b8bebe21f9b4dc6acda06ea5bc6))

Tests: 27198 (+1310 since 16.3.0)

## [16.3.0](https://github.com/event4u-app/agent-config/compare/16.2.0...16.3.0) (2026-10-05)

### Release highlights

- **Behaviour changes:** Rule links that name a path the repository actually has, and the blocker that held them (#2185) (8031e09); Rule laws that can stand, and the class whose law stands with them (#2177) (9e2fe18); 100 % roadmaps archive — bare deferrals carried, owner blockers ask step by step (#2167) (074eee6); make the two pack-boundary gates green on the trunk and run the workflow-security audit in CI (#2155) (90a0ad5); A release record that says what it reviewed, and an index with every major (#2157) (8e30a53).
- **Default changes + migration:** _none_
- **Security and correctness:** 100 % roadmaps archive — bare deferrals carried, owner blockers ask step by step (#2167) (074eee6); make the two pack-boundary gates green on the trunk and run the workflow-security audit in CI (#2155) (90a0ad5).
- **Honest nulls:** _none_
- **Known limitations:** An installed layer measured against its limit, and the consent an installer must have before thinning (#2201) (src/scripts/install.ts declares a residual) (df7ea79); Two Phase-0 instruments closed against measurement, and the third blocked by a record rather than a ceiling (#2198) (src/scripts/check_standing_rule_delivery.ts declares a residual) (92027a2); A rule carrier that delivers what the install carries, in the host's form, in a string the host keeps (#2182) (src/scripts/install.ts declares a residual) (7fdfd0a); Rule triggers and installed links that hold (#2174) (src/scripts/install.ts declares a residual) (328a21b); A tree that keeps its neighbours (#2161) (src/scripts/install.ts declares a residual) (4399b5a); make the two pack-boundary gates green on the trunk and run the workflow-security audit in CI (#2155) (90a0ad5); +2 more.

> **Governance mix:** governance-only 23 vs consumer-only 1 (taxonomy 1.1.0).
>
> _Re-measured 2026-10-07:_ governance-only 83 vs consumer-only 3 (taxonomy 1.1.0) on `16.2.0..16.3.0` (`8d157f5e7..91aaf5e21`), via `./scripts-run src/scripts/measure_release_mix --from 16.2.0 --to 16.3.0`. The line above was measured to an unrecorded `HEAD` at write time.

### Features

* **commands:** /roadmap:resolve-blockers — council first, owner one question at a time (#2204) ([5ddfc05](https://github.com/event4u-app/agent-config/commit/5ddfc05819a501b1066b713571e9073d1ce435c9))
* **commands:** /roadmap:triage-parked — drain later/ and skipped/ (#2184) ([ab516fc](https://github.com/event4u-app/agent-config/commit/ab516fc19a420a7022eb7dc5f8b16f6d033fc6e8))
* **evidence:** classify the evidence tree by reference, and rule out a cold location (#2153) ([590cebc](https://github.com/event4u-app/agent-config/commit/590cebc729a7a45fbe98e2ee55b8f231ac0329c2))
* **hooks:** run the project's own quality tools over the files a turn edited (#2152) ([d4760bb](https://github.com/event4u-app/agent-config/commit/d4760bb4f47b7be902c9ec3b88c51d8aa818311e))
* **memory-learn:** open the learning dogfood window and give it a screen (#2151) ([162889e](https://github.com/event4u-app/agent-config/commit/162889e8b16359904766927a7fbd896f961ed9b9))
* **ui:** flip the carried-nothing shadow to a halt, closing road-to-a-ui-coverage-ledger-that-can-fail (#2149) ([cbd5d07](https://github.com/event4u-app/agent-config/commit/cbd5d07fe21af3a3de12e847b3b8da7f86f8bb81))

### Bug Fixes

* **archival:** 100 % roadmaps archive — bare deferrals carried, owner blockers ask step by step (#2167) ([074eee6](https://github.com/event4u-app/agent-config/commit/074eee6881d19b5f6d7ec8574a83c26dffd25353))
* **gates:** make the two pack-boundary gates green on the trunk and run the workflow-security audit in CI (#2155) ([90a0ad5](https://github.com/event4u-app/agent-config/commit/90a0ad522d49a853d30ffb6f1fec46e2b802ae35))
* **hooks:** make the bundle ceiling describe the trunk it defends (#2165) ([c399d09](https://github.com/event4u-app/agent-config/commit/c399d097eea2f30676b36604a2514ff0e22cd46d))

### Documentation

* **roadmaps:** drain road-to-leading-every-row — install above the fold, commit-mix baseline, seven owner questions put (#2148) ([8f32c31](https://github.com/event4u-app/agent-config/commit/8f32c316b489f6b8decfdacf57da72149e07dbd5))
* **roadmaps:** land four roadmaps from inbox round inbox-2026-10-c (#2150) ([07f83a1](https://github.com/event4u-app/agent-config/commit/07f83a1f681869b9cea467f2ad88e5642ef55af9))
* **roadmaps:** use the declared decision classes in the inbox-2026-10-a roadmaps ([ab5c92b](https://github.com/event4u-app/agent-config/commit/ab5c92b61936fdddfd5bb3e315d086b64bc1911e))
* **roadmaps:** state the measured blocker growth in the round's claim ([2a52860](https://github.com/event4u-app/agent-config/commit/2a528602ea27b6407e9e999b8818f41ad1e9f0cb))
* **evidence:** disposition for inbox round inbox-2026-10-a ([ea06fa1](https://github.com/event4u-app/agent-config/commit/ea06fa1fafe54db61b1313050c52d4c7497e799a))
* **roadmaps:** record arrivals and owner questions on six held objects ([60f9e60](https://github.com/event4u-app/agent-config/commit/60f9e60f6d2940c49677479641a599d23cbd380b))
* **roadmaps:** land eight roadmaps from inbox round inbox-2026-10-a ([2c34c3d](https://github.com/event4u-app/agent-config/commit/2c34c3d99b103bd704f917d1603e926f7dac3f0c))
* **evidence:** declare the evidence type on the inbox-2026-10-b disposition ([8adf9ef](https://github.com/event4u-app/agent-config/commit/8adf9eff9b7908334ed29cb7ed4fbe48f2e05cda))
* **evidence:** record the inbox-2026-10-b disposition ([a51740b](https://github.com/event4u-app/agent-config/commit/a51740b4b79d963af8ff2fd3551c26214430166e))
* **stubs:** count the inbox-2026-10-b arrivals on four held stubs ([6f2bc0b](https://github.com/event4u-app/agent-config/commit/6f2bc0b116a78747bc98e1addfda25672ea76ed7))
* **roadmaps:** land the leading-every-row programme and its lanes from inbox-2026-10-b ([6631412](https://github.com/event4u-app/agent-config/commit/6631412219157e4b26ee9f1eede6493ea38764c0))

### Chores

* **deps:** bump the site group in /site with 4 updates (#2170) ([7464482](https://github.com/event4u-app/agent-config/commit/7464482550df64e24f101988086f9c6fb1bd7945))
* **deps-dev:** bump the telemetry-worker group across 1 directory with 2 updates (#2163) ([11eb5d8](https://github.com/event4u-app/agent-config/commit/11eb5d813dc9057e9f475b7a827aa9730d688447))

### Other

* The intake rule was enforced and never written down, so git kept inviting the commit the gate refuses (#2206) ([975d03d](https://github.com/event4u-app/agent-config/commit/975d03d01cc549c297a7a8ea92134b08005eb333))
* Two roadmaps that read finished, and the three gates that keep each of them where it is (#2205) ([df377ca](https://github.com/event4u-app/agent-config/commit/df377ca64d0333105ffd80813caa94e11805c30b))
* An installed layer measured against its limit, and the consent an installer must have before thinning (#2201) ([df7ea79](https://github.com/event4u-app/agent-config/commit/df7ea7928c9d9fe5815978b689198b79fc8158d3))
* Archive the kernel-plumbing roadmap, which finished and stayed in the active set (#2203) ([901e8bc](https://github.com/event4u-app/agent-config/commit/901e8bc4e848283327f5c6811e4e221246a41210))
* A blocker citation pointing at a test fixture, and a step oracle that cannot reach its own exit (#2202) ([c04d74b](https://github.com/event4u-app/agent-config/commit/c04d74bea094071c72a1421fb013ee12e8200f2f))
* The first observed structured-ask row, and the subagent leg the absent one was read from (#2199) ([f73e77d](https://github.com/event4u-app/agent-config/commit/f73e77d0f93f55ab76658d86b38dde00222d1246))
* An acceptance criterion closed on measurement, a guard claim withdrawn, and the second obstacle under a blocked gate (#2200) ([e3e4774](https://github.com/event4u-app/agent-config/commit/e3e4774e2c6f6e2aa24d8720e6aff38c095d67f4))
* A calendar hold whose date had already passed, and the gate standing behind the stamp (#2196) ([6aa3c36](https://github.com/event4u-app/agent-config/commit/6aa3c36f9cbd596a65cb5b2faafa71cdd240b8f5))
* Two Phase-0 instruments closed against measurement, and the third blocked by a record rather than a ceiling (#2198) ([92027a2](https://github.com/event4u-app/agent-config/commit/92027a20c350f5b53625a1efbd3157aaf163b26b))
* Two locks under one owner question, a bundle figure stale by 41 kB, and the oracle a blocked step is waiting for (#2197) ([24d6d5b](https://github.com/event4u-app/agent-config/commit/24d6d5b0d93852ee106dd1a1a7eda9bca9b2c249))
* A blocker that held on its fourth reading, and the line it cited having moved (#2195) ([780c27e](https://github.com/event4u-app/agent-config/commit/780c27e1ed0f36edc6cd59883dce36230dfef9d4))
* A payload total that drifted under a pin that never pinned it (#2194) ([e6b7193](https://github.com/event4u-app/agent-config/commit/e6b71933a84bb15e432e86aced4c848897498716))
* A blocker that held on its sixth reading, and the four edits it is waiting on (#2193) ([fe0cff8](https://github.com/event4u-app/agent-config/commit/fe0cff8a558897a47caba9eb6d9dbe80e90e2d4b))
* A blocker stated in prose, re-stated as the command that decides it (#2192) ([18ac6b2](https://github.com/event4u-app/agent-config/commit/18ac6b21ec35c4132958dc382349acc6af9a3b53))
* A fifth reading of two blockers that held, and a second obstacle under the first (#2191) ([afad042](https://github.com/event4u-app/agent-config/commit/afad042bb39e24f3edf5dbbbfccabbda0f3ddb00))
* A guard that permitted the call precisely when it broke, in six places and a seventh shape (#2189) ([51ee084](https://github.com/event4u-app/agent-config/commit/51ee0844b564f8863b753606f1758c9c0ef6dbd3))
* An accrual figure that moved while the labelled corpus did not (#2190) ([30481f6](https://github.com/event4u-app/agent-config/commit/30481f6605ade9ff06bbc9ca300ab8614781321c))
* A third reading of a blocker that has not moved, and a census nine units behind the tree (#2187) ([50bec97](https://github.com/event4u-app/agent-config/commit/50bec97430107d9fe73a6561a4fb986150c57ea8))
* The fourth wake shape has no envelope tag, and the anchor is the whole guard (#2188) ([97a5a64](https://github.com/event4u-app/agent-config/commit/97a5a647412e376bf8ac12b9065706710c956831))
* Rule links that name a path the repository actually has, and the blocker that held them (#2185) ([8031e09](https://github.com/event4u-app/agent-config/commit/8031e09d6ff6ecc61be329f2af4a904bcc7be18f))
* The third wake shape: a subagent hand-back is a turn nobody typed, in two vocabularies that both missed it (#2186) ([0199fd0](https://github.com/event4u-app/agent-config/commit/0199fd0c0a448f3fdf262373cc30971213954168))
* Twenty-eight boxes re-run rather than read, and the policy behind seven settled-looking cells (#2183) ([d6a2da7](https://github.com/event4u-app/agent-config/commit/d6a2da7bca601dbe9432b35c6fd76fddd63c80db))
* A rule carrier that delivers what the install carries, in the host's form, in a string the host keeps (#2182) ([7fdfd0a](https://github.com/event4u-app/agent-config/commit/7fdfd0a4d59c616153ffaa283e265708b87b88ae))
* A rule carrier that works outside the repo: resolution, one mode answer, and the matrix that proves both (#2181) ([95dc7bf](https://github.com/event4u-app/agent-config/commit/95dc7bfb1ba8c5dcb43ce7cfe3f8d271093eacf9))
* The MCP recorder does not run, and what it would record was wrong in five ways (#2180) ([59824fd](https://github.com/event4u-app/agent-config/commit/59824fd95acfe5f6772f8da02e9f52a7896d593c))
* Neighbours counted by use, and the link criterion measured rather than assumed (#2179) ([cd26c2e](https://github.com/event4u-app/agent-config/commit/cd26c2e177976d85644fbe8fd9c5a973418bfcdc))
* Rule laws that can stand, and the class whose law stands with them (#2177) ([9e2fe18](https://github.com/event4u-app/agent-config/commit/9e2fe189e85d4b1feabb0bef55680e02097f0ac7))
* A route line that says where the skill came from (#2178) ([6bdc2b2](https://github.com/event4u-app/agent-config/commit/6bdc2b25ba6c6d06b94a2137ccfd336efc8f60b0))
* Stacks beyond PHP: the composition gate, the third binding site, and four resolver fixtures (#2173) ([a3c8393](https://github.com/event4u-app/agent-config/commit/a3c839340059ef68c8a37568685739bb9f8c7fe3))
* Say which tree the reach numbers came from, and publish the per-prompt pair (#2176) ([4871260](https://github.com/event4u-app/agent-config/commit/48712607ad706c502cb44938a288a39b64d3f784))
* Rule triggers and installed links that hold (#2174) ([328a21b](https://github.com/event4u-app/agent-config/commit/328a21bef2d8f6660227f4f9656d2043751ff7fc))
* The stop gate records who set stop_hook_active, and the fingerprint store cannot be bound where its council chose (#2175) ([379cd53](https://github.com/event4u-app/agent-config/commit/379cd535c6618d8d514b78654eef8c59461dc0a1))
* The advisories were already fixed; the record was not (#2171) ([30f7d21](https://github.com/event4u-app/agent-config/commit/30f7d21f65146fd348bc354b33093794ab500bcf))
* Dispositions the carried roadmaps were missing (#2172) ([11726a9](https://github.com/event4u-app/agent-config/commit/11726a985ca8de0e183c14d643519d7aa5d77d0c))
* archive the three roadmaps main still held at 100 % (#2168) ([21da719](https://github.com/event4u-app/agent-config/commit/21da71917d1ad685737b10196245c8d323bd21f4))
* Let dependency PRs reach their required check (#2169) ([540ee7a](https://github.com/event4u-app/agent-config/commit/540ee7a0bed2bf327c971f204ab90a346a768250))
* A tree that keeps its neighbours (#2161) ([4399b5a](https://github.com/event4u-app/agent-config/commit/4399b5a0d6395631d808f6bc5f75aaa7eed7e573))
* A graph that reaches the search, sees the edit, and feeds the gate in shadow (#2159) ([4958809](https://github.com/event4u-app/agent-config/commit/495880908332d55c9a4069f7266dc19c99c83824))
* A release record that says what it reviewed, and an index with every major (#2157) ([8e30a53](https://github.com/event4u-app/agent-config/commit/8e30a533124b1c85b011bb463a6bd63c3fc3c6e1))
* Three claims a roadmap makes about itself, made checkable (#2156) ([3a8498c](https://github.com/event4u-app/agent-config/commit/3a8498c2c00fcff37970e2eeabd4ebe7b43f8b9e))
* Blocking severities where a refusal can land (#2154) ([81d712f](https://github.com/event4u-app/agent-config/commit/81d712f2706ffe6fcdf98f2198a5607d7c6faf17))
* Give the three spawn-bound test suites their own timeout (#2166) ([aead73d](https://github.com/event4u-app/agent-config/commit/aead73d280f8c61de7cf604ef39c06274fb6baf4))
* A ranker that routes: the null, and the two premises it refuted (#2162) ([213d870](https://github.com/event4u-app/agent-config/commit/213d870558b7fbcdc033ac6f8f0ef4c1a43a5a80))
* One YAML reader in the hook bundle, a ceiling on it, and a census that renders (#2158) ([22b19e5](https://github.com/event4u-app/agent-config/commit/22b19e520c198b6f0aec2cbf8cb2851818c11fcc))
* Record a verification command that fails on claude (#2160) ([29b1832](https://github.com/event4u-app/agent-config/commit/29b183256155f9a3dea3d3351268b62b33628fde))
* Three surfaces that said more than they did (#2144) ([00612c1](https://github.com/event4u-app/agent-config/commit/00612c1f27edafcfa6340b41c56a0da281d6ebc2))

Tests: 25888 (+896 since 16.2.0)
