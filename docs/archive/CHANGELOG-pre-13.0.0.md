# Changelog Archive — pre-13.0.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `13.0.0`, split out of the main
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

## [12.1.0](https://github.com/event4u-app/agent-config/compare/12.0.0...12.1.0) (2026-08-16)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 3b06e61, 5861eab, 78c3a31.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in ad1fdd5, 1dd2211.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in f5873b2, a05cd1c, f92bc37, 33c7c20, cdae71b, 5efb150 +8 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in 7e2ee70, 03732f5, 87b85c4, c94b9ee, 5ba91ea.
- **Known limitations:** _none_

### Features

* **telemetry:** make an unmapped band distinguishable from a silent host ([6ebce93](https://github.com/event4u-app/agent-config/commit/6ebce93068075f7ed7a087ede2ad439bb288791c))
* **tiers:** reopen ADR-035 and add the frontier band ([78c3a31](https://github.com/event4u-app/agent-config/commit/78c3a311efdc53425a396029bb2477c1cac26cca))
* **gates:** probe blockers for decidability, on a ratchet ([024ab06](https://github.com/event4u-app/agent-config/commit/024ab0664df6c15f39c54c16f5f79dde184d1ad6))
* **gates:** lead with the recommendation, and say when there is none ([d7d6dba](https://github.com/event4u-app/agent-config/commit/d7d6dbace4b3c874f89cc2b60363b068ea908eb8))
* **release:** refuse a major cut with an overdue scheduled deprecation ([b09374a](https://github.com/event4u-app/agent-config/commit/b09374afc6d83189abd79d11e28976caa059e438))
* **gates:** check scheduled deprecations by arithmetic, not by memory ([dfc8088](https://github.com/event4u-app/agent-config/commit/dfc8088698c25a26ad5729a291cfbe2c0e153055))
* **janitor:** collect session-scoped state, and print the zero ([eaba741](https://github.com/event4u-app/agent-config/commit/eaba741def2af781e8fd93a13c56616e09efd66e))
* **context:** read state-destroyed and state-captured together ([53c9d3b](https://github.com/event4u-app/agent-config/commit/53c9d3b739f8bf71c9a8833be63e529f94f03c08))
* **context:** meter tool results, and capture before compaction ([bc20d3e](https://github.com/event4u-app/agent-config/commit/bc20d3e6cce59e91d75204aedc106fdde95076a4))
* **evidence:** probe which review-binding hash segment actually moves ([4183ac0](https://github.com/event4u-app/agent-config/commit/4183ac017b64481c86035020f7dabaea5933566b))
* **release-head:** derive the correctness half, and recorded nulls beyond the marker ([5ba91ea](https://github.com/event4u-app/agent-config/commit/5ba91ea4f9c227fe0b82e95f8eebb452cc78bc16))
* **install:** ask an existing install about scoped projection, on measured evidence ([fc8046a](https://github.com/event4u-app/agent-config/commit/fc8046a3e79ac6c111cde763aaf90f0a2bb9c89d))
* **cli:** workspace:doctor — read-only identity and worktree pressure ([98c24cb](https://github.com/event4u-app/agent-config/commit/98c24cbed5cd42b75abf4a37d4ee08936305d698))
* **workspace:** one resolver for the five workspace-identity questions ([c8a5ec3](https://github.com/event4u-app/agent-config/commit/c8a5ec3c4ad58a4d1456f6c1b1fd6166606df5a4))
* **install:** warn when a deploy crosses a MEASURED host catalogue limit ([794698b](https://github.com/event4u-app/agent-config/commit/794698beb49c35d65ee1361c668f9de264e17eb3))
* **catalogue:** read codex truncation off the host instead of a self-report ([dc5bf40](https://github.com/event4u-app/agent-config/commit/dc5bf40647fd83525b43b675cce63180c2a255e2))
* **install:** warn when a host drops most of the catalogue it was handed ([358304c](https://github.com/event4u-app/agent-config/commit/358304c73bef17573e4bb7ff6915bf1dd14f99f2))
* **catalogue:** read codex truncation off the host event, per host ([7514d64](https://github.com/event4u-app/agent-config/commit/7514d649d566d1e40f8d5f8ae9604370ef575906))

### Bug Fixes

* **rules:** revert the scoping pass — the routing matrix refuted all four ([3b06e61](https://github.com/event4u-app/agent-config/commit/3b06e61f1adb960168ca5481d4c6227c1ccd9c43))
* **rules:** scope the four rules that can be, and record why fifteen cannot ([5861eab](https://github.com/event4u-app/agent-config/commit/5861eabd267b63c8547a498cc894f345c9b58bcb))
* **review:** re-derive the prompt_hash after the round-3 re-bind ([6fa3037](https://github.com/event4u-app/agent-config/commit/6fa30379de34427d340b50c8a4bdea1dd885ba71))
* close round 3's low findings, and correct their dispositions ([f5873b2](https://github.com/event4u-app/agent-config/commit/f5873b283cd6beb59528f346a552a60846f9ae9d))
* **gates:** stop reporting green over zero comparisons ([a05cd1c](https://github.com/event4u-app/agent-config/commit/a05cd1cd223c60de70c980d07ecbe8bb154217e5))
* **gates:** read a withdrawn commitment as a tracked state ([a73a563](https://github.com/event4u-app/agent-config/commit/a73a563b83e635eb467d20a1b20a9fdc8fcd09ad))
* **gates:** close review round 2 — 12 findings ([f92bc37](https://github.com/event4u-app/agent-config/commit/f92bc375fb948fe92f1fa50691d6eb0605236128))
* **rules:** stop scoping from silently deleting a rule's keyword reach ([33c7c20](https://github.com/event4u-app/agent-config/commit/33c7c201211d39ec68f3333773a6a9957ab94b20))
* **evidence:** correct the paths-coverage headline, and the finding under it ([21651b5](https://github.com/event4u-app/agent-config/commit/21651b508742dff1ea1c935533e5a00ef7181b00))
* **gates:** measure the cut against the target, and close the review's 11 findings ([cdae71b](https://github.com/event4u-app/agent-config/commit/cdae71b306da55b6dbb1aa6122c5f228eee98a6a))
* **roadmap-writing:** keep the blocker guidance inside the 400-line skill cap ([4e041c1](https://github.com/event4u-app/agent-config/commit/4e041c1db8ded58bc52a267c0c7be5288b4402a8))
* **review:** re-bind every manifest segment, not just the scope ([6f62fa3](https://github.com/event4u-app/agent-config/commit/6f62fa3165c0284047a243f646d8c05e9422ad01))
* **evidence:** address all nine R2 findings, and the ratio tightens ([5efb150](https://github.com/event4u-app/agent-config/commit/5efb15097a8567ce2666b06669dbcbdb45e90bfb))
* **release-head:** close the four code findings, one of them a true positive I had narrowed away ([c94b9ee](https://github.com/event4u-app/agent-config/commit/c94b9eebd386296f3f3dbfc65f598d71354b1196))
* **workspace:** repair the review's three high findings and six others ([6c3f220](https://github.com/event4u-app/agent-config/commit/6c3f220a17ae68cfe96ff0bd269a962b1a139b7b))
* **evidence:** anonymise a named third-party service in the harvest register ([9f895bd](https://github.com/event4u-app/agent-config/commit/9f895bde48c4d9907d0a1df971f4d41e7a1cd3e2))
* **review:** close the twelve completion-review findings ([2bf0c47](https://github.com/event4u-app/agent-config/commit/2bf0c479582fae419a6bc634f6380c3aaefa56b8))
* **ai-team:** stop pinning a model the codex transport refuses ([272dcd0](https://github.com/event4u-app/agent-config/commit/272dcd001bcf9f3dea3db1a9c26ff4ab0f3a35d0))
* **catalogue:** drop unused imports from the split library and fix the test helper ([81428a0](https://github.com/event4u-app/agent-config/commit/81428a07d7140869d9c01ac9e4f9d957f728deeb))
* **council:** the DEGRADED marker shipped on stdout and not on the artefact ([a4af80c](https://github.com/event4u-app/agent-config/commit/a4af80ccbdd21b0620a9536eae92d5ffacb4bd43))
* **council:** the openai seat was dead on every subscription account ([7ec3246](https://github.com/event4u-app/agent-config/commit/7ec32467645617c33eb5c010ae5bde580478be72))
* **council:** repair the openai seat, dead for three independent reasons ([d1f8f3b](https://github.com/event4u-app/agent-config/commit/d1f8f3b7e3b9c4d66113761f8d695251d735ea3a))

### Documentation

* **review:** re-bind round 3 to the final scope ([ddbecf1](https://github.com/event4u-app/agent-config/commit/ddbecf18679a8a6c3d296de7e89ebf685bba671a))
* **review:** re-bind round 2 to the fixed scope ([005ed2b](https://github.com/event4u-app/agent-config/commit/005ed2b9504908f739602bb46140e6d1d2b8506c))
* **roadmaps:** resolve the code-graph and trigger-eval blockers ([7e2ee70](https://github.com/event4u-app/agent-config/commit/7e2ee701dafd9836209ed125ccdba505d344a31d))
* **roadmap:** make the code-graph blocker decidable, and lower the ratchet ([9a1cc8a](https://github.com/event4u-app/agent-config/commit/9a1cc8a78a1a97158d833b44755c4ccb89a49e1d))
* **roadmaps:** make the three remaining blockers decidable ([2fb8a38](https://github.com/event4u-app/agent-config/commit/2fb8a38a6505579711f2ec782f5d7a3dfe589e53))
* **review:** re-bind the completion review to the fixed scope ([1a884c7](https://github.com/event4u-app/agent-config/commit/1a884c7dde2f2b531d7cce664c0f5c57b19988a7))
* **review:** R2 completion review for feat-scheduled-deprecation ([ee6db3a](https://github.com/event4u-app/agent-config/commit/ee6db3a716605f7c221289b726d36ecff327eca1))
* **roadmap:** close release-head-truth on the two maintainer decisions ([0c11537](https://github.com/event4u-app/agent-config/commit/0c1153797673097f2d89333741a37a56cd6bac30))
* **roadmaps:** a blocker must be decidable, not merely described ([fdbc469](https://github.com/event4u-app/agent-config/commit/fdbc469667954c6183289425ffc86e1350a26569))
* **migration:** give the two loose surfaces a tracked state ([ad1fdd5](https://github.com/event4u-app/agent-config/commit/ad1fdd561e84b171106574a79352d8be61c38aa3))
* **review:** re-bind after the main merge moved the base ([e11f113](https://github.com/event4u-app/agent-config/commit/e11f1137effad9149bdf12555d65cb8cefc7edbd))
* **review:** re-bind to the post-finding scope ([49b1b7c](https://github.com/event4u-app/agent-config/commit/49b1b7c95ce2ffca4a59294fe16ce1f8938d1c95))
* **evidence:** re-check the scoped-projection claim live after merging main ([67bd479](https://github.com/event4u-app/agent-config/commit/67bd4797ccf07881a7d6c1c5c95edd72ea7b472e))
* **evidence:** the window null, the paths census, and a dated payload route ([82daf5e](https://github.com/event4u-app/agent-config/commit/82daf5e5d8b3afaee29991251d50622c21e610fc))
* **roadmaps:** five roadmaps from the 2026-08-d inbox harvest ([3b8f6ee](https://github.com/event4u-app/agent-config/commit/3b8f6ee3a3ca60fac50c2c924c6ff601c88dc347))
* **review:** re-bind the R2 artefact to the fixed scope, all eleven dispositions terminal ([1ab43c8](https://github.com/event4u-app/agent-config/commit/1ab43c8ac1a1b09c1b6b040132ac5d8cc7afe035))
* **review:** re-bind the R2 artefact after the fix pass, all nine terminal ([6c03182](https://github.com/event4u-app/agent-config/commit/6c03182ac98223f12ad7c8f96712d43bfe68e9f3))
* **roadmap:** register the AC 3 decision as a blocker so the gates surface it ([acbe275](https://github.com/event4u-app/agent-config/commit/acbe275c5f0dbe1172d7b2a162fbcf0b526fdd03))
* **contracts:** say that falsifier 2 has fired, instead of re-affirming the lock over it ([03732f5](https://github.com/event4u-app/agent-config/commit/03732f5dafacc9326b9d2a5db8da7932144f4063))
* **evidence:** state the three scopes, fix the honest-null split, drop the line citations ([87b85c4](https://github.com/event4u-app/agent-config/commit/87b85c499e4e50468a4f609df85d8a4a94407853))
* **review:** R2 completion review of the drift probe - 9 findings ([9d9ece9](https://github.com/event4u-app/agent-config/commit/9d9ece9efd3093e129b8547e88063e6b30d6d7cf))
* **review:** record the R2 findings before fixing any of them ([9ee99ce](https://github.com/event4u-app/agent-config/commit/9ee99ce8e0d6cc6acde3d39ed2f8b11799359ab3))
* **evidence:** Phase 2 stops - code causes 79 percent of re-binds ([e3b035c](https://github.com/event4u-app/agent-config/commit/e3b035ce8b50918e857a88993c8710f9488cbb23))
* **roadmap:** close release-head-truth Phases 1 to 3, leave AC 3 open on its measurement ([6f5d0f4](https://github.com/event4u-app/agent-config/commit/6f5d0f4aaeb85732c28ac29a70a260b852e56baf))
* **contracts:** the derivation is the load-bearing half of the retro-curation lock ([ebc21d0](https://github.com/event4u-app/agent-config/commit/ebc21d08062fe4fa874153cd07fbca06c92a7377))
* **evidence:** measure the release-head derivation before widening it ([a389919](https://github.com/event4u-app/agent-config/commit/a3899191abcace5049de6c2209eb85eb7692db64))
* **review:** re-bind after the origin/main merge, with the measurement that justifies it ([04a92fc](https://github.com/event4u-app/agent-config/commit/04a92fca8218083123b650a941a12c3effc388c5))
* **review:** re-bind the completion review to the post-fix scope ([2c99f94](https://github.com/event4u-app/agent-config/commit/2c99f94213482459eb4c5590319df9a81a6d0eb5))
* **review:** R2 completion review — 13 findings, three high ([371e891](https://github.com/event4u-app/agent-config/commit/371e891274116dd249d6179848f1559d5f1e9d47))
* **roadmap:** archive road-to-skill-catalogue-budget ([1056718](https://github.com/event4u-app/agent-config/commit/1056718c1527d89d940e53dd32655a93d4ada62a))
* **roadmap:** close and archive workspace-identity, blocker resolved to report-only ([1141051](https://github.com/event4u-app/agent-config/commit/1141051719d9e43fa102394954100f4fdd7afbd9))
* **evidence:** the workspace-identity census, with its three refusals ([530db41](https://github.com/event4u-app/agent-config/commit/530db418f33cc79cfadcf24e0c67ad313199773f))
* **evidence:** re-bind the completion-review skip after the anonymisation fix ([591825d](https://github.com/event4u-app/agent-config/commit/591825da3615dde236836a0cfe761e7b5c30aa5e))
* **evidence:** declare the docs-only skip for the 2026-08-c harvest ([6b97fe3](https://github.com/event4u-app/agent-config/commit/6b97fe324427e254fcb372208e7cf5644a7b6496))
* **roadmaps:** four roadmaps from the 2026-08-c inbox harvest ([9fd881d](https://github.com/event4u-app/agent-config/commit/9fd881dfb41f183f40c2b644072f940ccd5eb6ce))
* **evidence:** record the 2026-08-c inbox triage and its not-adopted register ([5b0fb6f](https://github.com/event4u-app/agent-config/commit/5b0fb6f02cebee3f65fe5210573bab22bd837c98))
* **review:** finding 11 is accepted-risk, not an invented status ([1fcf44a](https://github.com/event4u-app/agent-config/commit/1fcf44a11cc96d61233f20b6f2b63fb85a4f5c9e))
* **review:** re-bind the findings artefact to the post-fix scope ([385265f](https://github.com/event4u-app/agent-config/commit/385265f1a5e0a4a4678d2e371993ef281ebd1fb7))
* **review:** record the completion-review findings before any fix ([20c83dd](https://github.com/event4u-app/agent-config/commit/20c83dd4388b855c44d54ca577f601b382018626))
* **roadmap:** re-review the risk register against what executing it found ([66b83ba](https://github.com/event4u-app/agent-config/commit/66b83ba40c27d94b8cb26a1337155b0d42d6caa6))
* **evidence:** two hosts in the corpus, and the double-count reading ruled out ([cfb9670](https://github.com/event4u-app/agent-config/commit/cfb967066a8f1d894a1b861774c694e35f012e84))
* **roadmap:** re-review the skill-catalogue-budget Risk Register ([1abb479](https://github.com/event4u-app/agent-config/commit/1abb479ed874b7e5791bb4f3529582cae00cc18e))
* **roadmap:** close skill-catalogue-budget Phases 1-3 with the measured findings ([2723dea](https://github.com/event4u-app/agent-config/commit/2723deadb01dec6e8fce1f69e5550c2941a5337b))

### Refactoring

* **scripts:** migrate seven identity call sites onto the shared resolver ([1dd2211](https://github.com/event4u-app/agent-config/commit/1dd221176a9eae251846d8874f884ba57fdc4bd6))

### Tests

* **rules:** cover the mixed-plus-placeholder rule instead of orphaning its fixture ([121d26f](https://github.com/event4u-app/agent-config/commit/121d26ff1dd0ba039a6a0fa4073ec7b10d94acfd))

### Chores

* **build:** rebuild the install bundle for the frontier tier enum ([7daaa62](https://github.com/event4u-app/agent-config/commit/7daaa62cbf84d338f3e8e29013c4497a777b5f7a))
* **roadmap:** regenerate the dashboard after the 2026-08-d harvest ([f0c79e2](https://github.com/event4u-app/agent-config/commit/f0c79e2f0e5f565b8a299584a683ecd2e65a16bf))
* **roadmaps:** regenerate the dashboard after merging origin/main ([a75f60f](https://github.com/event4u-app/agent-config/commit/a75f60f96f76ea4e0061ede2c91518668bc12c13))
* **reports:** refresh the adversarial secret-scanner stamp ([af2dcff](https://github.com/event4u-app/agent-config/commit/af2dcff6a1941d0e731039a1df767db0c65c06d0))
* **build:** rebuild the install bundle for the extracted catalogue library ([8bce204](https://github.com/event4u-app/agent-config/commit/8bce20467987e4345cabbdca4b504f2e386fae61))
* **reports:** regenerate generated reports the drift gate flagged ([6a8f7ff](https://github.com/event4u-app/agent-config/commit/6a8f7ffad009d2686dd8ec85b65397f11f85edeb))

Tests: 13992 (+148 since 12.0.0)

## [12.0.0](https://github.com/event4u-app/agent-config/compare/11.0.0...12.0.0) (2026-08-15)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in d0ef0ea, 0be9450, 3b4210f, 90ad47a.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in e4aec99.
- **Security and correctness:** _none_
- **Honest nulls:** _none_
- **Known limitations:** _none_

### BREAKING CHANGES

* **discovery:** stop emitting tier and bump the manifest to v3 ([3b4210f](https://github.com/event4u-app/agent-config/commit/3b4210f8b07419b4b5c9a14287946782a559065c))
* **commands:** drop the tier: alias from every command source ([90ad47a](https://github.com/event4u-app/agent-config/commit/90ad47ad5204c7c77116cb6a1a99dcbc5274d33c))

### Features

* **bench:** build the scale-history producer, the half the bench never had ([9d898a0](https://github.com/event4u-app/agent-config/commit/9d898a0104fcc9660806039b7f46a3ab3518f142))
* **settings:** carry the measured discipline profile as an opt-in preset, not a default flip ([e4aec99](https://github.com/event4u-app/agent-config/commit/e4aec999330c30f4f47258ab68268993c1dc9af7))
* **schema:** add harness_compat beside compatibility, additively ([d0ef0ea](https://github.com/event4u-app/agent-config/commit/d0ef0eaa81eb09a9cb3c3adcc766514eae61dae2))
* **ledger:** scope subagent ledger lines by session, and re-anchor a comment that rotted three times ([a4eb631](https://github.com/event4u-app/agent-config/commit/a4eb6318102bf949b41fae2ec6b0f723f86c2cdc))
* **manifest:** set the tier sunset, and record that the soak was waived not met ([ef5ca46](https://github.com/event4u-app/agent-config/commit/ef5ca469fe61b967c2cb2e2a7cd61949d241b7bd))
* **settings:** record the three class-B verdicts, and name what class B actually says ([c440e6a](https://github.com/event4u-app/agent-config/commit/c440e6a2775b9e0bb81dc2eeb2daa5d806f1e23c))
* **roadmaps:** close and archive two roadmaps on maintainer answers ([3cfed05](https://github.com/event4u-app/agent-config/commit/3cfed05eb9c3b82d31b2737ba33aa173860943bb))
* **skill-linter:** gate the write path of strict-mode skills ([fea9bc8](https://github.com/event4u-app/agent-config/commit/fea9bc8d1a8c4dd5a7ec897826e08509cc99284e))

### Bug Fixes

* **bench:** per-family model selection, fail-fast, and resume that retries failures ([2dbf26e](https://github.com/event4u-app/agent-config/commit/2dbf26e88ca496699cf261cb34930ea3e0a4a7fa))
* **bench:** stage lint input outside the workspace, and project wall-clock per family ([fde46ae](https://github.com/event4u-app/agent-config/commit/fde46ae1d21f3f9557e28632d337eae1fb2f7a6f))
* **roadmaps:** surface a user-owned blocker that was buried in HTML comments ([853490d](https://github.com/event4u-app/agent-config/commit/853490df3fe5876caea5eb31abf2c9878b40c4f6))
* **gates:** close the nine round-2 findings on check_branch_freshness ([81db7fb](https://github.com/event4u-app/agent-config/commit/81db7fb02e9f3f34b7f3ad395eb128b80a835957))
* **originality:** anchor the scaffold baseline to the base revision ([a75b796](https://github.com/event4u-app/agent-config/commit/a75b7962a82e687e211929ffda22b4b54cc9ad9c))
* **dispatch:** refuse a cli-delegate bundle older than its sources ([591369c](https://github.com/event4u-app/agent-config/commit/591369cf497537c693d19fb859212c084aa24767))
* **worktrees:** judge location against the main worktree, and teach the two missing conditions ([5cf7450](https://github.com/event4u-app/agent-config/commit/5cf7450da168fa67944ed83c411737f56bb8b2a1))
* **worktrees:** the inventory misclassifies from inside a worktree, totally ([52d7fe1](https://github.com/event4u-app/agent-config/commit/52d7fe1b8fa269efc8bde5b79e5b26423c7176ad))
* **roadmap:** call fifteen blocked steps blocked, and tick the one that shipped ([a06c529](https://github.com/event4u-app/agent-config/commit/a06c52965b5d4916691d29be028361ed04c1b094))
* **roadmap:** restore the ADR acceptance leg my own correction wrongly removed ([ac4e795](https://github.com/event4u-app/agent-config/commit/ac4e795d7b46730e35c2c72767551adf2aa496ee))
* **gates:** clear the two preflight blockers this branch hit ([f525ed3](https://github.com/event4u-app/agent-config/commit/f525ed3e324af95b626149b9c00545d669dbbb5b))
* **roadmap:** repair the ci-economy blocker that pointed at the wrong ADR ([7101666](https://github.com/event4u-app/agent-config/commit/71016663fb4b2fe34bd244840882c5a8d9087caa))
* **gates:** close all eleven R2 findings, including two false claims of mine ([d6c8067](https://github.com/event4u-app/agent-config/commit/d6c8067275915ee5f073879f202fa6ef8eaf9551))

### Documentation

* **roadmap:** add the Risk Register required by gate R1 ([eae55a5](https://github.com/event4u-app/agent-config/commit/eae55a5749f74cac14d0a674cc2970dfc0408723))
* **roadmap:** plan the skill-catalogue budget fix with Codex as second host ([81288a5](https://github.com/event4u-app/agent-config/commit/81288a5477e6a9c0976c4bde9a71632bb0078410))
* **roadmap:** close codex-family-auth, both bench families proven live ([89e8e1e](https://github.com/event4u-app/agent-config/commit/89e8e1ef3616f0d442df2229bfb40d3c7953c62f))
* **roadmap:** the scale-history runner landed, and a second family gap opened ([f21e8fa](https://github.com/event4u-app/agent-config/commit/f21e8fa04831394e484caf09f997047416ee015c))
* **review:** re-bind the skip to the final scope, and name what three re-binds cost ([9222716](https://github.com/event4u-app/agent-config/commit/922271617cfe28df69c08ac053549ddb8d81eab3))
* **evidence:** record the deferral disposition and the roadmap closure as an addendum ([cf073c7](https://github.com/event4u-app/agent-config/commit/cf073c7e24d16de44bf7e27f1575dbab3f7e8739))
* **review:** re-bind the completion-review skip after the roadmap closure ([f16bfa6](https://github.com/event4u-app/agent-config/commit/f16bfa68ac681e0acb1d81369897bb98a2b503c3))
* **review:** re-bind the completion-review skip to the post-report scope ([4094b92](https://github.com/event4u-app/agent-config/commit/4094b92f9cde39294678a0ef751e1e79de1df7bd))
* **evidence:** publish the continuation sweep report and file a truthful review skip ([7781cdd](https://github.com/event4u-app/agent-config/commit/7781cddafdb5c3314d5a3fe4765c414d0497ca41))
* **roadmaps:** record that P2.2 is done on the work and open only on Iron Law 3 ([fa5728a](https://github.com/event4u-app/agent-config/commit/fa5728aaa2c21f28a9568f296a3083f270f036c9))
* **roadmaps:** repair two premises that the tree has already overtaken ([a727302](https://github.com/event4u-app/agent-config/commit/a727302b00359ad564e5cf5f6f607adfe5a3c229))
* **roadmap:** correct the scale-history bench from spend-blocked to build-blocked ([19abd67](https://github.com/event4u-app/agent-config/commit/19abd67aa74c1bb85450f466cbbcf3e694e0da4e))
* **evidence:** record the continuation delta as an addendum, and regenerate the dashboard ([13dc4bb](https://github.com/event4u-app/agent-config/commit/13dc4bb8f0bdd3b066d1a393221dfd36aac37ca6))
* **roadmap:** record that the orchestration evidence gate was bypassed, not answered ([e9bc08d](https://github.com/event4u-app/agent-config/commit/e9bc08da66155b2ac6389f8b94b6143fea21d8eb))
* **evidence:** disclose the standing completion-review advisory, and why no skip was filed ([c31f5a5](https://github.com/event4u-app/agent-config/commit/c31f5a59acb527da3190a57fe659dffaddafc06f))
* **roadmap:** give maintainer-bus-factor the Risk Register its edit now requires ([f481b52](https://github.com/event4u-app/agent-config/commit/f481b52c5b7d75abfed3d9a649944e23e12a287e))
* **evidence:** record the roadmap completion sweep of 2026-08-14 ([9e9f827](https://github.com/event4u-app/agent-config/commit/9e9f827b43428a5122a9676eb657379e370fa34e))
* **review:** re-bind round 2 to the post-fix scope, all nine terminal ([e63511e](https://github.com/event4u-app/agent-config/commit/e63511efd6dc2d093acb2b22c23fcb054de033b6))
* **review:** archive round 1 and bind the round 2 findings — 9 open ([2ba9982](https://github.com/event4u-app/agent-config/commit/2ba998259326d8d5e4db87e8158b5ed408c4df21))
* **tier:** record the removal in ADR-231 and fix every doc it falsified ([2211d62](https://github.com/event4u-app/agent-config/commit/2211d62cc8528a1680f2bfe3483f771469cac281))
* **roadmap:** date the blocker premises that were asserted rather than measured ([26b8796](https://github.com/event4u-app/agent-config/commit/26b8796def8cf0cfb3d1d8ab8f0f5be94883331a))
* **review:** bind the R2 findings for pr-target-base-freshness — 11 open ([451df8f](https://github.com/event4u-app/agent-config/commit/451df8fb85d2474724621c127d0c6355d4fbbb30))

### Refactoring

* **roadmaps:** extract the settings deletion queue to a durable context, archive its roadmap ([e4c6aec](https://github.com/event4u-app/agent-config/commit/e4c6aecc4235ea7b28ede922a6c840f7a99774ac))
* **commands:** read visibility alone in the schema, linter and readers ([0be9450](https://github.com/event4u-app/agent-config/commit/0be9450cac743c1a9c63cebf9aa264720cc05a54))

### Chores

* **roadmaps:** close and archive inbox-harvest-2026-08, migrating its four deferrals ([71639ea](https://github.com/event4u-app/agent-config/commit/71639ea095f23e53d3da61f37d35ee2c7a2f8d86))
* **ci-economy:** accept ADR-223, and hand back the two repo-admin acts with their exact procedure ([df70b7c](https://github.com/event4u-app/agent-config/commit/df70b7cf05b997f8d471749a7ca17481999c6e05))
* **roadmap:** discharge the consolidation breaking-change permission for all tranches ([348d7f7](https://github.com/event4u-app/agent-config/commit/348d7f7a0d4dfeb6e7107bd3e6069d688df72890))
* **roadmaps:** resolve self-fix-halt-telemetry on an outside opinion, and record the three verdicts not yet implemented ([026dce4](https://github.com/event4u-app/agent-config/commit/026dce42f5e4e12bc4330e10351a7a213ec5d539))
* **roadmaps:** grant the two bench budgets, defer the second reviewer, dedupe a step ([b7fe2b5](https://github.com/event4u-app/agent-config/commit/b7fe2b539fed12066b662ffcb75a7a10e8d91d4a))
* **roadmaps:** archive the harvest-b family index on closure ([27253a1](https://github.com/event4u-app/agent-config/commit/27253a1046603278302ac31671f6fac8a4da9a85))
* **roadmaps:** close the harvest-b index and the dispatch-safety decisions ([b68d576](https://github.com/event4u-app/agent-config/commit/b68d576dac06c14fce14c3804c4551d370bc1710))
* **roadmap:** archive road-to-tier-removal at 100% ([61542dc](https://github.com/event4u-app/agent-config/commit/61542dc072fc275c5bde659f25b7a327aea8ad99))

Tests: 13844 (+26 since 11.0.0)
