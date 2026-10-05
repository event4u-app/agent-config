# Changelog Archive — pre-16.3.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `16.3.0`, split out of the main
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

## [16.2.0](https://github.com/event4u-app/agent-config/compare/16.1.0...16.2.0) (2026-10-01)

### Release highlights

- **Behaviour changes:** keep ui-audit-gate inside the measured per-spawn payload ceiling (bc499bf); record taxonomy detection and the fourth greenfield option (91d0c55); register the gates, and stop the reader guessing (8714a7a); declare inputs once, structurally (3cfaa6f); disprove a deletion claim against the tree before it blocks a release (c7f813f).
- **Default changes + migration:** correct the blocker gate's own scope claims, and pin the widened default (5857ef1).
- **Security and correctness:** enable auto-merge, fix the deploy-row checker, and withdraw an AC-5 close that did not hold (#2114) (52f2da9); re-derive the codex writer pin after install.ts shrank (3c2041a); an absent section must parse, and now a test says so (51c2bab); pay the read-surface declaration nothing (bfce3ac); a deterministic traversal test, and a claim I got wrong (b883d80); a canonical ASCII boundary, and the exploit that is not there (6281500); +31 more.
- **Honest nulls:** The plumbing roadmap's last measurable gap, measured (#2135) (db000c5); a bytes row that exists, and a gate that refuses one without it (0863114); re-bind the skip to the post-fix scope, and record what the read returned (246d7ea).
- **Known limitations:** ci_settle refuses an argument it does not honour, and the doc that taught a wrong one (#2130) (tests/scripts/memory_learn_hook.test.ts declares a residual) (dbbf470); A zero in the enforcement table becomes a fact with a date on it (#2141) (tests/install/global_install_hooks_smoke.test.ts declares a residual) (ab2c75d); The review of the stop gate, acted on (#2128) (tests/scripts/release.test.ts declares a residual) (5689c2d); an opt-in write of two size caps, and neither traffic variable (src/scripts/install.ts declares a residual) (74e21e2).

> **Governance mix:** governance-only 70 vs consumer-only 22 (taxonomy 1.1.0).

### Features

* **host-env:** an opt-in write of two size caps, and neither traffic variable ([74e21e2](https://github.com/event4u-app/agent-config/commit/74e21e2d4b81714e2721a31b9aea93455b85211d))
* **retrieval-sanitize:** generate the read-surface list, close the two named gaps ([96c9b2a](https://github.com/event4u-app/agent-config/commit/96c9b2abcd4b9ed6f57db568f0c771f9ef36e9f6))
* **retrieval-sanitize:** salvaged work from an interrupted run, unverified ([a175faf](https://github.com/event4u-app/agent-config/commit/a175fafedbcb4ea6a27924a77845d85d45bf16f6))
* **settings-fence:** refuse a Class C key, leave every other key writable ([7d285e5](https://github.com/event4u-app/agent-config/commit/7d285e59840867b1faede405561407297d6ab551))
* **exit-codes:** one table, and the gate that keeps it the only one ([7f4cbbb](https://github.com/event4u-app/agent-config/commit/7f4cbbbe177f990bb80f492bc4f3370011259d3f))
* **work-engine:** wire the taxonomy into the audit, the schema and apply ([7f87162](https://github.com/event4u-app/agent-config/commit/7f8716240d557dc78a3d2ac25a783ac8ed4ca9ee))
* **work-engine:** detect the component taxonomy a project already chose ([0772aaa](https://github.com/event4u-app/agent-config/commit/0772aaaa1c87ee633a943dc652613461926040a4))
* **plumbing-guard:** salvaged work from an interrupted run, unverified ([b8a7037](https://github.com/event4u-app/agent-config/commit/b8a7037e37ed29f52fc169fbbf7821d7db281791))
* **gates:** keep the kill-switch table equal to the tree it counts ([948f8f2](https://github.com/event4u-app/agent-config/commit/948f8f25bc342bb59d0f0715ac3da2caeed67def))
* **host-format-gate:** generate the format cell instead of maintaining it ([86093ec](https://github.com/event4u-app/agent-config/commit/86093ec7dc499a6c77112fa82466e4a3f3c00e70))
* **hooks:** a new test file clears detector F only with a red it passed ([04bb5ea](https://github.com/event4u-app/agent-config/commit/04bb5ea4a3982688e16afaf00713eb365d0d12da))
* **hooks:** detector C reads the run record, and keeps a replay mode ([dcb07e0](https://github.com/event4u-app/agent-config/commit/dcb07e09b95379d1fedfeeb9783a3f7a3e4618c7))
* **hooks:** record the verification runs a turn actually made ([99255cd](https://github.com/event4u-app/agent-config/commit/99255cd9fd2dcb328d40b2528167a2a8682b9c67))
* **hooks:** classify a verification RUN, not the command text ([d638959](https://github.com/event4u-app/agent-config/commit/d638959550a7ab6bf65acf9939fbb8b5f3b708d9))
* **metrics:** a bytes row that exists, and a gate that refuses one without it ([0863114](https://github.com/event4u-app/agent-config/commit/08631143754a53b6a4ad25296e573a4451fdbde6))
* **report:** print menu bytes per install profile, and show them equal ([8ecb71c](https://github.com/event4u-app/agent-config/commit/8ecb71c3d66b7e67055355296786def48c0e8e87))
* **gates:** fail a diff that changes a skill carrying no trigger corpus ([7539f7f](https://github.com/event4u-app/agent-config/commit/7539f7f4577d8ad2dcb6136c73572472307ae658))
* **eval:** score the ranker with an interval, and refuse a verdict under n=100 ([f6a0608](https://github.com/event4u-app/agent-config/commit/f6a0608d198ca5255fd01aac7942d49f05b87c5d))
* **eval:** give every routing-matrix case an expected-skills label ([06f8cb3](https://github.com/event4u-app/agent-config/commit/06f8cb3f543fd937728461758a89d0daa4dfc4c9))
* **roadmap-template:** a verify clause may say what the command must produce ([8f60a26](https://github.com/event4u-app/agent-config/commit/8f60a269d1358f9b1981b66bd3d4a5c9fc9ac12f))
* **roadmaps:** publish the runnable and falsifiable share, and refute a zero ([7e0fd6b](https://github.com/event4u-app/agent-config/commit/7e0fd6ba6c9b3dab62c3f3dbf3ff5a846515b0a4))
* **closure-scan:** list the verify clauses whose oracle cannot say no ([86d2c07](https://github.com/event4u-app/agent-config/commit/86d2c07771c7c2a8000a63f46cd2de27b9d57c1c))
* **run-continuation:** carry the expectation into the continuation message ([67fdd5b](https://github.com/event4u-app/agent-config/commit/67fdd5b0f1dfa743444930f591cb2a231a3bfe00))
* **verify:** one parser for the verify clause, with an expectation half ([8b5a878](https://github.com/event4u-app/agent-config/commit/8b5a87881c1dea06b8c092d48dbac2991d3c5760))
* **hooks:** carry the host lowering table further toward every host ([d28ce58](https://github.com/event4u-app/agent-config/commit/d28ce587ab6b3e3010aada63c59985d22d63c0dd))
* **obligations:** name the writer on every obligation row ([46d3ebf](https://github.com/event4u-app/agent-config/commit/46d3ebf806f52cddec4e65913860b055ec869417))
* **denylist:** give every external-source subject a registry entry ([bb1107d](https://github.com/event4u-app/agent-config/commit/bb1107d5a4b033021bf6c9d22f30c977b277150c))
* **probe:** report a false green as a refusal, and archive the roadmap ([0eadd50](https://github.com/event4u-app/agent-config/commit/0eadd503f9f735162acc951d636987738f1d92f4))
* **design-pass:** report stale, and stop reporting a count against inputs that moved ([4032b24](https://github.com/event4u-app/agent-config/commit/4032b24aea47144cf07fc51680a0b1d227660c71))
* **probe:** record the inputs beside the timestamp, on every artefact ([c86ebad](https://github.com/event4u-app/agent-config/commit/c86ebad009fe41485f6e28ce8b4fa23ef9a5dbac))
* **ui:** report a port that handed all its work back, in shadow ([55b4378](https://github.com/event4u-app/agent-config/commit/55b4378732b7601afbe37356c9e35dba7aac7c11))
* **probe:** give the conformance artefact a vocabulary for what it read ([e07a896](https://github.com/event4u-app/agent-config/commit/e07a8967164e7d2c8409c91ec67b56dca12d52b0))
* **reporter:** count the artifacts that carry one obligation ([cabc485](https://github.com/event4u-app/agent-config/commit/cabc48540c446dbc4138e00117aec49545d155d2))
* **doctor:** report the host traffic environment, and never omit a row ([454e072](https://github.com/event4u-app/agent-config/commit/454e07223d5ba539bc341b802506eca282bd9122))
* declare inputs on one command and one skill ([124dc5b](https://github.com/event4u-app/agent-config/commit/124dc5becdbab71993c7993eac6072265cd9d9fe))
* **mcp:** derive the argument-hint and the wire arguments from the declaration ([15f1f66](https://github.com/event4u-app/agent-config/commit/15f1f665c082fa6fb74a11c91ac11e7e995afcdf))
* **scripts:** fail an in-body reference no declaration backs ([c2a2d07](https://github.com/event4u-app/agent-config/commit/c2a2d07f3bb9d794aa9110aa2768ab48f84ba492))
* **schemas:** declare inputs once, structurally ([3cfaa6f](https://github.com/event4u-app/agent-config/commit/3cfaa6f2183bd6f567a4ff0ebc2ead864ac1df82))
* **scripts:** ratchet foreign placeholder syntaxes shrink-only ([d9c99ad](https://github.com/event4u-app/agent-config/commit/d9c99ad9a3a8d1f7d0d825109a59daaa17d45ba7))
* **scripts:** census the invocation surface, with the unit defined first ([833e2f6](https://github.com/event4u-app/agent-config/commit/833e2f6f44cef9e7ebbd277ef4b5e7dee8744edd))
* **scripts:** count which concerns sit on slots that cannot deny ([76811e9](https://github.com/event4u-app/agent-config/commit/76811e9653014adfea2f0f157733a2117f0af248))
* **scripts:** add the body-portable eligibility predicate ([e0eb189](https://github.com/event4u-app/agent-config/commit/e0eb1892b91087afa673861b4b3df172d411e55d))
* **scripts:** census which skill semantics the MCP-lite carrier drops ([88cff00](https://github.com/event4u-app/agent-config/commit/88cff0053daeb92c645673781094b0ca20b6517d))
* **gates:** lint_roadmap_blockers scans agents/roadmaps/stubs/ ([a1e47cd](https://github.com/event4u-app/agent-config/commit/a1e47cd288ca00d18dbeb4e30d0b2f37b58ce886))
* **design-review:** demote the screenshot to an appearance-only floor ([d7427f7](https://github.com/event4u-app/agent-config/commit/d7427f7bd16d8da0dca699cc5d03291059b0659d))

### Bug Fixes

* **release:** count tests by running files, not by static parse (#2145) ([396fbbc](https://github.com/event4u-app/agent-config/commit/396fbbc27f37147a2dad7757a69147b7e0d9a761))
* **roadmap:** make the menu-precision path-scoping blocker machine-readable (#2119) ([016530f](https://github.com/event4u-app/agent-config/commit/016530fd099d74f48b4fb3346226fb48608597fa))
* **adversarial-verification:** enable auto-merge, fix the deploy-row checker, and withdraw an AC-5 close that did not hold (#2114) ([52f2da9](https://github.com/event4u-app/agent-config/commit/52f2da946181ab0ab5437055ec55759f6e04fd92))
* **roadmap:** make the obligation-writer corpus blocker machine-readable (#2117) ([9de3e0c](https://github.com/event4u-app/agent-config/commit/9de3e0cd3cf8a4ae08c9b809038f225e3750adef))
* **citations:** re-derive the codex writer pin after install.ts shrank ([3c2041a](https://github.com/event4u-app/agent-config/commit/3c2041a152d77ad6799f0053eb8be509ec8824d4))
* **host-env:** an absent section must parse, and now a test says so ([51c2bab](https://github.com/event4u-app/agent-config/commit/51c2bab3fda07042a643cd10ec26c04bd381349c))
* **size-budget:** pay the read-surface declaration nothing ([bfce3ac](https://github.com/event4u-app/agent-config/commit/bfce3ac363c6e6013aad9829d7289ab388940c6e))
* **read-surface:** a deterministic traversal test, and a claim I got wrong ([b883d80](https://github.com/event4u-app/agent-config/commit/b883d80cc0074381bbd5b91a52aebaeefa6b480f))
* **update-prices:** a canonical ASCII boundary, and the exploit that is not there ([6281500](https://github.com/event4u-app/agent-config/commit/62815002af383bdb3655fb4d62956f69ef0397d9))
* **read-surface:** four findings from the second review round ([1bd1f97](https://github.com/event4u-app/agent-config/commit/1bd1f9718d3d667c727a30197162005900a70d2e))
* **rules:** keep ui-audit-gate inside the measured per-spawn payload ceiling ([bc499bf](https://github.com/event4u-app/agent-config/commit/bc499bf6c9e773800373a918966fed42530703ea))
* **ci:** four gates this branch reds, each for a real reason ([6b9f886](https://github.com/event4u-app/agent-config/commit/6b9f886f6a269fed302b9e5b2bdee16c5cbf973b))
* **work-engine:** close seven defects an independent review found ([3e83a51](https://github.com/event4u-app/agent-config/commit/3e83a513aeb8b15fd93f5dedcd8682471955a4cf))
* **hooks:** use the shared session-stability predicate main brought in ([d229d1a](https://github.com/event4u-app/agent-config/commit/d229d1afde93903e42fad03f5bf95b5a5216af6e))
* **plumbing-guards:** three defects an independent review found before merge ([afcd180](https://github.com/event4u-app/agent-config/commit/afcd180c0614f950d7ae58b361d0c3512aee891d))
* **skills:** keep existing-ui-audit under its size budget and at dialect baseline ([876b045](https://github.com/event4u-app/agent-config/commit/876b04557a4da5932a2bc927c2d68d1fa256da71))
* **work-engine:** make the taxonomy floors and the AC-2 guard testable alone ([0e30e4a](https://github.com/event4u-app/agent-config/commit/0e30e4ac9f9a7691d24d44a942a85c5e77272442))
* **gates:** host the kill-switch step where its trigger paths already are ([2ffcd47](https://github.com/event4u-app/agent-config/commit/2ffcd4771ef14987a0f826a75c58c219aac9fdfa))
* **hooks:** keep the settle concern's main() argv-shaped ([0a0a4d7](https://github.com/event4u-app/agent-config/commit/0a0a4d7ca49cd6b03c337024610b58dbff9d6147))
* **hooks:** join the ledger on ONE root resolver, and make the reproduction reproduce ([27deeb0](https://github.com/event4u-app/agent-config/commit/27deeb0a365a011e269c91eec02bf6a31ca39274))
* **hooks:** narrow detector F to a new test file, and label the evidence honestly ([285c51e](https://github.com/event4u-app/agent-config/commit/285c51ec3f2b0b2c97dffd25c159b86e87524f75))
* **hooks:** read the exit code the host actually reports, not the one it does not ([7282593](https://github.com/event4u-app/agent-config/commit/7282593773a823f1021d18aad4c77f729601ffc3))
* **hooks:** join the obligation reader to the key the writer used ([5c94152](https://github.com/event4u-app/agent-config/commit/5c94152581b44b6ec68f26201c45ca8cad6107f3))
* **roadmap:** report against the acceptance criteria, do not rewrite them ([2bf7673](https://github.com/event4u-app/agent-config/commit/2bf7673fd2ff2c81603c953fe258ff102d6819ad))
* **verify:** bound a clause to its own paragraph, not to the whole step ([55cf57c](https://github.com/event4u-app/agent-config/commit/55cf57ce2ee42b3ecfbfb11708353fee2028467b))
* act on an independent review of this branch ([b5d2d8f](https://github.com/event4u-app/agent-config/commit/b5d2d8f4ecda62d9dbf34da5285b7620dd6eb839))
* **verify:** keep the over-cap hook at its size, and stop F5 reading as a roadmap ([846d765](https://github.com/event4u-app/agent-config/commit/846d76502b7f870174c11ff3b5a62d4cefc57507))
* **injection-budget:** meter only the hosts whose emission reaches them ([cde876e](https://github.com/event4u-app/agent-config/commit/cde876e7f7c2d34346a9e83fe7fd4750158a1dbc))
* **host-lowering:** two defects the answered_at fixtures surfaced, and the tests that hold them ([5eadd50](https://github.com/event4u-app/agent-config/commit/5eadd507c1412c61904cab18b3970452b7229511))
* **canonical-terms:** write the two new prose lines in house dialect ([21894c1](https://github.com/event4u-app/agent-config/commit/21894c16fa0a9e8b0753f9f21fc5b86db17ff13b))
* **probe:** record inputs on the stopped path too ([952e616](https://github.com/event4u-app/agent-config/commit/952e6167dd21d7e0a38b93fa19703124704d7299))
* **contexts:** keep the pointer, drop the argument for the pointer ([3d84ba0](https://github.com/event4u-app/agent-config/commit/3d84ba04d5daa2cf6a2ccc41fbcf2333bcebca10))
* **ui:** match a declared item by id, and report the shadow outcome ([2b6a0f5](https://github.com/event4u-app/agent-config/commit/2b6a0f551278446aa839f1e0f6e79791ab0c8108))
* **docs:** write the traffic doc in the house dialect ([10a9de9](https://github.com/event4u-app/agent-config/commit/10a9de902b2cc4e6761e2b156cde53476ac4deef))
* **tests:** narrow the comparison union before reading its reason ([cc270c9](https://github.com/event4u-app/agent-config/commit/cc270c9e83517a4ca2c9ed96c0f1e87fca7b2986))
* **ui:** account for a declared item by id, not by substring ([99933fa](https://github.com/event4u-app/agent-config/commit/99933fac372e2f2d37b18c83baf8d6c3a0555872))
* **review:** stop a removal claim inside a modified file from disproving itself ([54c01ad](https://github.com/event4u-app/agent-config/commit/54c01ad156761c7a62c90029f40e453dab55d52d))
* **config:** give the placeholder budget an owner and a review date ([cc28417](https://github.com/event4u-app/agent-config/commit/cc2841777e28b340f34d0385cd0d69dc56e3f42c))
* **gates:** refuse an empty corpus, and record the ratification ([a9e7da2](https://github.com/event4u-app/agent-config/commit/a9e7da2150097f74d03f10467bd54c73ec9deef9))
* register the gates, and stop the reader guessing ([8714a7a](https://github.com/event4u-app/agent-config/commit/8714a7a2724c15264bea3144e942dfa83785f4ab))
* **scripts:** stop the audit failing open on a host with no slot rows ([074ae19](https://github.com/event4u-app/agent-config/commit/074ae19883ca19facc8588280ab74421095162a6))
* **scripts:** bind the carrier constants to the carrier, and share one classifier ([828d384](https://github.com/event4u-app/agent-config/commit/828d384102755fade06a2632228242aedc9a5018))
* **roadmaps:** close the three lint_decision_classes violations ([9b9f61b](https://github.com/event4u-app/agent-config/commit/9b9f61b7f77e814e3ee76fbb8bb384b02b5d900c))
* **claims,roadmap:** six corrections from an independent read of this branch ([5169ced](https://github.com/event4u-app/agent-config/commit/5169cedaaafc9992ce2afb5cc27bd071d4f1a86f))
* **claims:** correct the two ledger sentences that denied a shipped collector ([1ec20a6](https://github.com/event4u-app/agent-config/commit/1ec20a65887628c5b23312a0c35a3458209f82bd))
* **review:** re-derive the manifest hashes after the roadmap's final edits ([319d35e](https://github.com/event4u-app/agent-config/commit/319d35edafe3f9ffc058d5def02b96c780a650e9))
* **ci:** write the house dialect and refresh the routing-signal verdict ([91503fc](https://github.com/event4u-app/agent-config/commit/91503fc2b5ad28f5720d443fcfbfff3fe1242c77))
* **gates:** correct the blocker gate's own scope claims, and pin the widened default ([5857ef1](https://github.com/event4u-app/agent-config/commit/5857ef107468f03561ea7e45ddafd2a613642acd))
* **design-review:** drop the archived-roadmap path from the appearance floor ([26a2dbd](https://github.com/event4u-app/agent-config/commit/26a2dbd7b5a7ae39d7cc8d0b992782490a43853d))
* **claims:** re-measure the artifact counts the claim had gone stale against ([1528325](https://github.com/event4u-app/agent-config/commit/15283253b24a875f6fe466b29e8ec8b40b6fdb91))
* **review:** disprove a deletion claim against the tree before it blocks a release ([c7f813f](https://github.com/event4u-app/agent-config/commit/c7f813ffc39acc712ecb309f4c5f1df702e31ea1))

### Performance

* **enforcement-coverage:** worklist the reachability fixed point (#2112) ([7090e82](https://github.com/event4u-app/agent-config/commit/7090e822e74fdb10295be2d652b572ccb0a28d5d))
* **hooks:** compile the lowering table — 9 ms off every dispatch (#2110) ([4d60b86](https://github.com/event4u-app/agent-config/commit/4d60b866732808e3252336c26f198134d6ed0c34))

### Reverts

* **structural-hiding:** hold the transform, land the inventory gate ([55dae10](https://github.com/event4u-app/agent-config/commit/55dae10e9aa9339b8f6180c0bfe7565fcaa02f65))

### Documentation

* **roadmap:** mark the bounded-approval-floor-waiver's owner-reserved step, and date M18 (#2116) ([0a462f2](https://github.com/event4u-app/agent-config/commit/0a462f29b37ccc5595b94f23808d3d2b421f3bd5))
* **roadmap:** the 2026-09-30 window reading, and the reset three readings missed (#2115) ([e6b8ac3](https://github.com/event4u-app/agent-config/commit/e6b8ac3a6630015de2f84c0799fd15bc5687b9ad))
* **roadmap:** correct the release-holds measurement-window record against the live tree (#2113) ([7c065c3](https://github.com/event4u-app/agent-config/commit/7c065c30464be92720a3ff41f45269b13c0db8d8))
* **ratification:** record the five-round review that ratified this branch ([41f29b9](https://github.com/event4u-app/agent-config/commit/41f29b991676c747050747b976dcffce618358fa))
* **evidence:** record the holdout-corpus growth and move the two counts ([ce90f34](https://github.com/event4u-app/agent-config/commit/ce90f34008e56ae47875ecad1e72d9ecb1819ac9))
* **admissions:** record why block-plumbing-writes was admitted ([2203c9e](https://github.com/event4u-app/agent-config/commit/2203c9ed2c62b4cffee1edc405d5b6a28269c559))
* **budget:** record that the pre_tool_use revisit-if fired, and what this branch cost ([724329f](https://github.com/event4u-app/agent-config/commit/724329fd410daada84347f7ec843434e8aa84fff))
* **roadmaps:** record the review round and withdraw two false claims ([3947043](https://github.com/event4u-app/agent-config/commit/3947043b4cbbc789d7d0a39f3a4c140c993bb495))
* **roadmap:** re-review the risk register against what actually landed ([5b89946](https://github.com/event4u-app/agent-config/commit/5b89946d5c44ad0d69121f6211d95e98d5276dfa))
* **ratification:** record the ratified verdict and the three fixed blockers ([c6ad1bb](https://github.com/event4u-app/agent-config/commit/c6ad1bb23e4e6a5defc0450cf070bdaa67f443d7))
* **roadmap:** close Phases 1, 2 and 4 with evidence; record the Phase 3 blocker ([8e6db5c](https://github.com/event4u-app/agent-config/commit/8e6db5cd36fa32ff881cc00636821bfe962e8fdc))
* **roadmaps:** close the component-taxonomy roadmap and archive it ([6ae9804](https://github.com/event4u-app/agent-config/commit/6ae9804e9b42b4063c0d39f6033a0b12b4b695ec))
* **ui-track:** record taxonomy detection and the fourth greenfield option ([91d0c55](https://github.com/event4u-app/agent-config/commit/91d0c55d7ec7f38840cc7062f74122589b53d7cc))
* **roadmaps:** record the review round, and what it changed about the closed steps ([57bc4b1](https://github.com/event4u-app/agent-config/commit/57bc4b1312e0fb76239c10ca5848a849d6852cb8))
* **evidence:** record the independent review of this branch ([c8e775b](https://github.com/event4u-app/agent-config/commit/c8e775b3d13d9bb2c9a4d5382ab88c262b977faf))
* **ratification:** record the three-round review, and leave Phase 2 open ([0758dca](https://github.com/event4u-app/agent-config/commit/0758dcaf962b324f59c5628ba3e6fc12f85a7d99))
* **enforcement-by-host:** state what the tree does, and what it does not record ([80f7cf0](https://github.com/event4u-app/agent-config/commit/80f7cf06853ba7a782813f4cc3488f774449da96))
* **roadmaps:** close six steps of road-to-a-stop-that-holds, and name what stays open ([862227a](https://github.com/event4u-app/agent-config/commit/862227aa9c2becf1087cafeedce5d0fefbbfc69c))
* **claims:** reset the obligation-settle bar window at the join fix ([ab59f86](https://github.com/event4u-app/agent-config/commit/ab59f866f5d337f30c9de8385f073790c7335c57))
* **hooks:** inventory every AGENT_CONFIG kill switch the hook layer reads ([b9e9d9e](https://github.com/event4u-app/agent-config/commit/b9e9d9e34f205f17b30ad0b26fc632e9c201798c))
* **closure-scan:** say that the unfalsifiable count is a lower bound ([e6fd3ee](https://github.com/event4u-app/agent-config/commit/e6fd3ee3e92fe24295dbad37613ec01723488b26))
* **verify:** correct four refuted figures, and unship a dated number ([7f165fb](https://github.com/event4u-app/agent-config/commit/7f165fb1ee30a786eed89878f5a972f1ebcb0c28))
* **evidence:** say which sha the reading was taken against, and that it held ([b9e3cbd](https://github.com/event4u-app/agent-config/commit/b9e3cbd993bf3ce65bc9a5ddd78cb310a72a4053))
* **evidence:** record the measured routing precision and cite it in the register ([5feeba5](https://github.com/event4u-app/agent-config/commit/5feeba5f9d0da66d1193acccae07b647051f3ec2))
* **roadmaps:** close the probe-inputs roadmap, and retract the claim it got wrong ([106e80f](https://github.com/event4u-app/agent-config/commit/106e80f2c73f8fe7b7d68da65870af5f1ce8ca8c))
* **onboarding:** point the consumer tour at the traffic mapping, close phases 1-3 ([a2a7a43](https://github.com/event4u-app/agent-config/commit/a2a7a4388ddc37c4a6d5c350c053f923bc860add))
* **setup:** map the host traffic variables against the shipped binary ([3428a55](https://github.com/event4u-app/agent-config/commit/3428a55924c426142b92a561d056d63913cc64e4))
* **roadmaps:** close the fact-plane roadmap with its evidence and two findings ([0b10990](https://github.com/event4u-app/agent-config/commit/0b10990d21ccba680055c5a1d5f64a713bb8b6b1))
* **roadmaps:** close road-to-an-invocation-contract-that-reaches-the-wire ([3c8fbd1](https://github.com/event4u-app/agent-config/commit/3c8fbd1fbd3d6fd88d17b44edd2473f977f3984b))
* **roadmaps:** close road-to-a-content-scanner-on-a-slot-that-can-refuse ([43c717e](https://github.com/event4u-app/agent-config/commit/43c717e5a803cc2a327bd07133a83652dd21150a))
* **enforcement:** say which concern sits on which slot, and why ([43c2c5b](https://github.com/event4u-app/agent-config/commit/43c2c5b526f152f6fbeb67c57ac8fdb2b27aa6e1))
* **roadmaps:** byte-equality is necessary and not sufficient ([2bfb6cb](https://github.com/event4u-app/agent-config/commit/2bfb6cb2a839e18844bb01b829794571e379d47a))
* **review:** declare the completion review skipped — this diff has no code surface ([549c3cc](https://github.com/event4u-app/agent-config/commit/549c3cc8e801d9315abd11e236791df69957691d))
* **roadmaps:** state the measured growth figure in both claims ([2bb25fe](https://github.com/event4u-app/agent-config/commit/2bb25fe5138510e048383dbcb0a3c57495fde687))
* **roadmaps:** make the two growth claims legible in the gate output ([01bb781](https://github.com/event4u-app/agent-config/commit/01bb781bdda772ae3f48dc051d66dcee794c3036))
* **evidence:** record the inbox-2026-09-ab disposition ([6697f68](https://github.com/event4u-app/agent-config/commit/6697f68c6dc8a039fce80a788a866c1f800e9c01))
* **roadmaps:** record arrival counts on 18 held objects ([3d2a99c](https://github.com/event4u-app/agent-config/commit/3d2a99c6ffe8fbb94004f226f6fb0f5a5e2c8aba))
* **roadmaps:** land 22 roadmaps from inbox round inbox-2026-09-ab ([e0db0cc](https://github.com/event4u-app/agent-config/commit/e0db0cca23e56e18c9e122254fdfeab06a84b39f))
* **review:** re-bind the skip to the post-fix scope, and record what the read returned ([246d7ea](https://github.com/event4u-app/agent-config/commit/246d7eab5bfdc2cb5bd298d0b705472f0ceb024d))
* **roadmap:** record the per-track governance ruling as pending, and close its blocker ([464b1ab](https://github.com/event4u-app/agent-config/commit/464b1ab8f7f82eb54a4471a22252be7a14dd4314))
* **review:** declare the completion-review skip for this closure ([755d616](https://github.com/event4u-app/agent-config/commit/755d616d9b7c9f207d21c865524da97c5ee9041f))
* **roadmap:** record the owner ruling on the probe lane ([4bdc42d](https://github.com/event4u-app/agent-config/commit/4bdc42d78c38a575f4704f9a9cd153466411c32e))
* **review:** re-point the findings artifact at the current review scope ([9b62299](https://github.com/event4u-app/agent-config/commit/9b6229945474441d0a724ff1d20a37111e118674))
* **roadmap:** move the post-review AC-4 corrections out of the AC section ([74150a8](https://github.com/event4u-app/agent-config/commit/74150a8434f55dd3669c680e1d5d568575c6fbfc))
* **roadmap:** second risk-register pass, after the independent review moved AC-4 ([81cc461](https://github.com/event4u-app/agent-config/commit/81cc46111b1a456b6ad900c4a1418b0de4a543da))
* **review:** record the §2.5 ordering deviation on the review artifact ([3749d12](https://github.com/event4u-app/agent-config/commit/3749d12c868eb42e44204cd4363f0074c5d9e5b5))
* **review:** land the independent completion review for the blocker-gate widening ([eb4c47f](https://github.com/event4u-app/agent-config/commit/eb4c47f5bb508ea4492cb336836599f2a6f7de7c))
* **evidence:** re-scope the skip declaration and record the two CI catches ([4160717](https://github.com/event4u-app/agent-config/commit/41607171e9e40242944f667b7c58b7a3816361b8))
* **roadmap:** record the archival deadlock AC-4's closure creates ([b4f1751](https://github.com/event4u-app/agent-config/commit/b4f175167550e2944de4e91b3cc4001f880054cb))
* **stubs:** tell stub authors the blocker gate now reads this directory ([c7d5deb](https://github.com/event4u-app/agent-config/commit/c7d5debdc0d2263b0a8dc868213fe5edde54a416))
* **roadmap:** re-review the substrate-stub risk register after AC-4 ([254bf55](https://github.com/event4u-app/agent-config/commit/254bf5596f00438b1cdbd2aeca1f0c533f6ac458))
* **evidence:** declare the completion-review skip for Phase 4 ([f1b1545](https://github.com/event4u-app/agent-config/commit/f1b15458f5d2e7c8b11ab81c8c8dedb7260c1746))
* **roadmap:** close AC-4 of the substrate-stub roadmap on the owner ruling ([4b5a23d](https://github.com/event4u-app/agent-config/commit/4b5a23dd74b37e3b4ad6d36b55a14c96beb12b67))
* **roadmap:** re-review the risk register after Phase 4 landed ([144f209](https://github.com/event4u-app/agent-config/commit/144f209a98214b2568fbe1c51062c043a91b362b))
* **roadmap:** record the owner ruling and close Phase 4 ([6f71003](https://github.com/event4u-app/agent-config/commit/6f71003642732c94eb518115415d2410e8d36f12))

### Refactoring

* **hooks:** move the record reader to its producer, and the verdict prose to its vocabulary ([063197a](https://github.com/event4u-app/agent-config/commit/063197ae40b62d4a3c4d893186787206b2bd1145))
* **contexts:** one carrier for the commit obligation, not three ([1a87d86](https://github.com/event4u-app/agent-config/commit/1a87d86502b922c74601295138374db8838fdc19))
* **design-review:** fit the appearance floor under the 400-line skill cap ([6daa154](https://github.com/event4u-app/agent-config/commit/6daa154b59a699b369bd83e2fb3be03b8eb55105))

### Tests

* **read-surface:** type the fixture index accesses and the transport request ([e6983ed](https://github.com/event4u-app/agent-config/commit/e6983edf355433ad87cbc34bdba49ec1aca35131))
* **routing:** hold the trigger corpus to the case-class discipline, and re-seed ([76cfda9](https://github.com/event4u-app/agent-config/commit/76cfda96b6c3ad464871e08badabf705f9066d93))
* **routing:** add the trigger corpus for ui-component-architect ([2c567c3](https://github.com/event4u-app/agent-config/commit/2c567c30307c85ee67747296eefa7d496d14605f))
* **work-engine:** make three weak assertions discriminate, and cover the new refusals ([48c8a88](https://github.com/event4u-app/agent-config/commit/48c8a885a855a38b79ca3b16c8ae823af398f3e9))
* **golden:** re-capture GT-U9 and GT-U10 for the fourth greenfield option ([a993773](https://github.com/event4u-app/agent-config/commit/a9937736cf6de275a30cc02294e9f53308e37088))
* **work-engine:** cover detection, placement and the greenfield offer ([e89d304](https://github.com/event4u-app/agent-config/commit/e89d30414b66472dc1bbf55591762e286883183f))
* **transcript:** state the not-measured byte column on the token fixtures ([071d7dd](https://github.com/event4u-app/agent-config/commit/071d7dd3bbf7d254ae7174b18b3e69dbe972e648))
* **fixtures:** capture the two inputs the conformance probe had never seen ([b7c3f57](https://github.com/event4u-app/agent-config/commit/b7c3f579026c0f75487ee3f6e920722f912659b2))
* **ui:** plant three port losses and pre-register what today catches ([7b35b4c](https://github.com/event4u-app/agent-config/commit/7b35b4c5c42bde3997a936574735f2066b975f6e))

### Chores

* **deps:** vitest 2 → 5, vite 5 → 8 (#2111) ([1f44215](https://github.com/event4u-app/agent-config/commit/1f442155ae679b38de1ea179ee85a133ce30a1d1))
* **deps:** clear the production-dependency advisories the packed job flagged ([0f68f1a](https://github.com/event4u-app/agent-config/commit/0f68f1a45fcb06a7063f42aa8b843e0a93cbc62b))
* **roadmaps:** archive two completed roadmaps, carry their three deferrals ([b29a75c](https://github.com/event4u-app/agent-config/commit/b29a75c6b51ca28b118a830f10c3cfd422380032))
* **evidence:** re-emit the standing-payload census and the host cost table ([f8cea12](https://github.com/event4u-app/agent-config/commit/f8cea1246934fb3ddb8d729df637a49387336ee2))
* **estate:** claim the one-concern growth where it happened ([028fc20](https://github.com/event4u-app/agent-config/commit/028fc202a7ba0a7d635883a30635a4e450487d25))
* **roadmaps:** re-review the risk register on the five closed steps ([a4a5dee](https://github.com/event4u-app/agent-config/commit/a4a5dee30427779e2a0c7ed0f056cc7dfc76309a))
* **roadmaps:** close five steps of road-to-a-menu-whose-precision-is-measured ([5ba60b9](https://github.com/event4u-app/agent-config/commit/5ba60b9d9c3d82229b6cac400ad6c18cf0f95ed7))
* **roadmaps:** close six steps, and correct the roadmap own refuted figures ([2958ecc](https://github.com/event4u-app/agent-config/commit/2958ecc79e77387961f9cd86cc78958cd04b7dcf))
* **dist:** rebuild the install bundle after the lowering-reader change ([a765c56](https://github.com/event4u-app/agent-config/commit/a765c569a511ab69e96278da230bcc9b84aebf82))
* **roadmaps:** archive road-to-a-denylist-that-sees-every-subject ([ea6363f](https://github.com/event4u-app/agent-config/commit/ea6363f76b26cdbeb5da69d561c5f8bddd40c753))
* **dist:** regenerate the ui apply directive after the merge ([d310aa6](https://github.com/event4u-app/agent-config/commit/d310aa61b082854f293f898befb94aab755eaf88))
* **ratchet:** follow the source-size gain down to 17,748 ([e52a668](https://github.com/event4u-app/agent-config/commit/e52a668bda84201dbc20376056d2a9a22ddf3fc4))
* **roadmaps:** archive road-to-probe-evidence-that-knows-its-inputs ([2c1e9e3](https://github.com/event4u-app/agent-config/commit/2c1e9e3fa6173359a3f6add4e880d47539d98a8b))
* **roadmaps:** archive road-to-a-fact-plane-the-reviewer-cannot-invent ([e3dc42f](https://github.com/event4u-app/agent-config/commit/e3dc42fb9a21349146cbebf29cb6958123a59562))
* **roadmaps:** archive road-to-an-invocation-contract-that-reaches-the-wire ([98da5a7](https://github.com/event4u-app/agent-config/commit/98da5a7ae5c95f6413fd0826734134116321ecc2))
* **hooks:** recompile the manifest after the concern header edit ([319e43e](https://github.com/event4u-app/agent-config/commit/319e43eeba5b69fbb239d6fc0f694c3318dcdcc9))
* **roadmaps:** archive road-to-a-content-scanner-on-a-slot-that-can-refuse ([f426526](https://github.com/event4u-app/agent-config/commit/f426526328ed48be0ad865f5df889fff639c7739))
* **roadmaps:** archive road-to-semantic-parity-before-off-menu ([35e37a6](https://github.com/event4u-app/agent-config/commit/35e37a64d0236eb423f2a2c1c5869741c545b754))
* **roadmap:** archive the substrate-stub roadmap now its last blocker is closed ([4865319](https://github.com/event4u-app/agent-config/commit/4865319602eea85a5052f62721c6f13023013cf0))
* **roadmaps:** archive the behaviour-evidence-over-pixels roadmap ([88449ba](https://github.com/event4u-app/agent-config/commit/88449bac119738e75c2a3c2dfb4c94b000dd2ceb))
* **gates:** reaffirm the lint_handoffs baseline, measured rather than waved through ([6d757a7](https://github.com/event4u-app/agent-config/commit/6d757a79356cd26545a9283b94ca24820ac474e5))

### Other

* One corpus re-check that actually ran, and a repo-wide red due 2026-11-22 (#2137) ([d9ae1da](https://github.com/event4u-app/agent-config/commit/d9ae1da3f411d2905cbdca41a5f58b54bbbb4ed6))
* Close AC-5 on the command it names, and hand AC-4 and AC-6 to their owners (#2143) ([4e803d6](https://github.com/event4u-app/agent-config/commit/4e803d6204906ce5357808ad2ec146e285249a0b))
* The plumbing roadmap's last measurable gap, measured (#2135) ([db000c5](https://github.com/event4u-app/agent-config/commit/db000c50cd6dde87cd4e35b477a236aadcf9e797))
* ci_settle refuses an argument it does not honour, and the doc that taught a wrong one (#2130) ([dbbf470](https://github.com/event4u-app/agent-config/commit/dbbf470b8acd15a523a8b2db85cda66e72bd5115))
* A zero in the enforcement table becomes a fact with a date on it (#2141) ([ab2c75d](https://github.com/event4u-app/agent-config/commit/ab2c75dcbb31bb02bf16f4159c60ed8740fba58f))
* The typed-grants roadmap, dispositioned: stop the ladder handing out the autonomy self-grant (#2140) ([5ade6a5](https://github.com/event4u-app/agent-config/commit/5ade6a5b88b3a55fcc697c45f585b149cd0c177c))
* Decision closure: route its own ownership blocker to the council it specifies (#2139) ([405c5d8](https://github.com/event4u-app/agent-config/commit/405c5d82accf36c8f808c5fcfa8176db717cc4c2))
* Re-probe the menu-precision E3 blocker and correct five stale figures (#2138) ([ad79f85](https://github.com/event4u-app/agent-config/commit/ad79f858af0ae102faef2f23f561283869e6b848))
* Park the release-holds roadmap in later/, with a wake test a gate can read (#2136) ([d6e2e14](https://github.com/event4u-app/agent-config/commit/d6e2e1458529bc8c95622461c0542618598926b4))
* Close what is agent-closable on trigger-eval freshness, and defer the owner-owned choice (#2134) ([5a4b897](https://github.com/event4u-app/agent-config/commit/5a4b8972102ab820bd451c7fd60ed6be189b4fec))
* The obligation-row roadmap's last step, routed to its owner (#2133) ([fb915c0](https://github.com/event4u-app/agent-config/commit/fb915c08b73fd76574ad1ee15df9ba3ca15f4c57))
* Close the ledger roadmap by carrying its one unreachable step to its live owner (#2132) ([1fd8f00](https://github.com/event4u-app/agent-config/commit/1fd8f006d6c0c7dd77666637f265ab3d690652dd))
* Re-probe the shadow-release gate and re-verify the UI coverage ledger live (#2131) ([cdb16f7](https://github.com/event4u-app/agent-config/commit/cdb16f7f25d781a7f135d15d9b8a30d9af327639))
* A reader for the shadow corpus, and the review that reopened a checkbox (#2142) ([e51a1df](https://github.com/event4u-app/agent-config/commit/e51a1dfda1585971872accc38e1ad43064a56eb3))
* One verification classifier, anchored on the segment head (#2129) ([9f2b9fb](https://github.com/event4u-app/agent-config/commit/9f2b9fb4a78f2270eaa040513050e7a2d657879e))
* The review of the stop gate, acted on (#2128) ([5689c2d](https://github.com/event4u-app/agent-config/commit/5689c2d1266560c187cb4df5bac73327d4dd71ed))
* The stop gate measures the turns it lets through (#2127) ([ce923cc](https://github.com/event4u-app/agent-config/commit/ce923cce720bc84885ef24270a2e7dc9b197f09e))
* Rotation coverage survives suite growth, and the freshness bill is priced (#2126) ([7178cdd](https://github.com/event4u-app/agent-config/commit/7178cdd1c3ca500bfb0507493329e4e461fff062))
* Close the corpus stamp-edit ambiguity and structure the cadence hold (#2125) ([aae6467](https://github.com/event4u-app/agent-config/commit/aae6467510dfcb4bb7ce09bc0110b3fe57415439))
* Phase 2 of road-to-host-claims closes: slot-failure rows from a pinnable source, and its blocker becomes machine-readable (#2124) ([14ff4a3](https://github.com/event4u-app/agent-config/commit/14ff4a3ca89bbd871305aac8294ea4753c245e88))
* The dispatcher measures what it runs, per concern (#2121) ([a129277](https://github.com/event4u-app/agent-config/commit/a129277d510ba43baf627b9d649852bf21c03a58))
* Close the UI coverage ledger's measurement half, and make 3.2's release gate machine-readable (#2122) ([99db452](https://github.com/event4u-app/agent-config/commit/99db452b9868d9af47381074d3abf8b5c64afc71))
* The structural-hiding detector returns parser-backed, and Phase 3 closes (#2123) ([9b128df](https://github.com/event4u-app/agent-config/commit/9b128df1d1dd5362234c8185fb378bc82a1be627))
* Mark decision-closure's blocked steps machine-readable, and re-verify its five open boxes (#2120) ([ebd31d9](https://github.com/event4u-app/agent-config/commit/ebd31d9482f7b299dee7ba0281f4eaf5cc1cbd33))
* The lockout recovery procedure is rehearsed, and bounded-approval-floor-waiver closes (#2118) ([4429b1d](https://github.com/event4u-app/agent-config/commit/4429b1d3df9d7495d14f1ef61e356f5c5d0125d5))
* **canonical-terms:** write the three new prose lines in house dialect ([c0a8c43](https://github.com/event4u-app/agent-config/commit/c0a8c437912f70cf807b4116e120aeea3fcd54b7))

Tests: 24992 (+1020 since 16.1.0)
