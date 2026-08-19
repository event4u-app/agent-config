# Changelog Archive — pre-14.5.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `14.5.0`, split out of the main
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

## [14.4.0](https://github.com/event4u-app/agent-config/compare/14.2.0...14.4.0) (2026-08-19)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in a58292c, a8473ec.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 5bc91bf.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 47246d7, c463f92, f939d0e, 4fae6e5, 6dddd0d, 71f09c2 +34 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in a822341, d64e216, d5d6f8f, bf45828, 97968d6, 8d50a6f +3 more.
- **Known limitations:** _none_

### Features

* **roadmap:** route a preserving deferred-item disposition to the council ([a8473ec](https://github.com/event4u-app/agent-config/commit/a8473ecda445e8315b20dca80f87191fdbebe1a5))
* **hooks:** bound and arbitrate what the dispatcher injects per turn ([70c1e12](https://github.com/event4u-app/agent-config/commit/70c1e128c60485f1889d82c6b04dadfacb596627))
* **supervise:** print the resume command, refuse the unattended spawn by name ([f136eb1](https://github.com/event4u-app/agent-config/commit/f136eb17272950c08273ea26613cc58441b4aad9))
* **hooks:** disclose org telemetry to the user it describes ([9bb3ec6](https://github.com/event4u-app/agent-config/commit/9bb3ec60f980579be08afd3870b6912d358de9f2))
* **settings:** add the org-pack provenance class, scoped and unwritable by the agent ([1bd83bd](https://github.com/event4u-app/agent-config/commit/1bd83bdffe8d3b2ed8e47558ab483dfb1482241d))
* **telemetry:** bound the local record log with a measured retention budget ([40ac1e6](https://github.com/event4u-app/agent-config/commit/40ac1e60b51459cb821b479fbb4aa5ca702e1eb3))
* **unattended:** the preconditions, the digest, and the pre-registered gate ([d4f91cd](https://github.com/event4u-app/agent-config/commit/d4f91cdfd5df1c718fc42ecf53ceac8b9f32f2d0))
* **runtime:** checkpoint a dying run, and supervise the one that never came back ([1e55267](https://github.com/event4u-app/agent-config/commit/1e55267b18a88d7d12a642974b87622b94e50d65))
* **council:** add the second-model rung and the decision-memo channel ([70ef2d0](https://github.com/event4u-app/agent-config/commit/70ef2d0d3ceda5c76f075454073caf05e4d0c527))
* **council:** make a mid-flight escalation visible in the log and the artefact ([696d1c7](https://github.com/event4u-app/agent-config/commit/696d1c7c5bfc15f4d746dfdf90ecba5f144e839b))
* **council:** model fallback.api_on_quota, surface the posture in status ([d18b8cc](https://github.com/event4u-app/agent-config/commit/d18b8ccf172361e71abfc77e3fed86064571662b))
* **hooks:** add the run-continuation stop concern, last in the chain ([428fbab](https://github.com/event4u-app/agent-config/commit/428fbabb2765601eb2b563753edced96c6660c49))
* **council:** wire the mid-flight cli to api fallback the contract already promised ([54cc116](https://github.com/event4u-app/agent-config/commit/54cc1168ce405579877c38d3814501223808cf53))
* **bench:** measure hook latency against a same-run control ([706316b](https://github.com/event4u-app/agent-config/commit/706316b0e0e1b324dafdae2b57ba048d7602f829))
* **hooks:** bind telemetry-usage on post_tool_use, Skill-filtered ([8d50a6f](https://github.com/event4u-app/agent-config/commit/8d50a6f69b0068450bc61a4a60a6e2b82e2407e0))
* **telemetry:** Class-A usage record, salted hashes, skill-name normalisation ([629d850](https://github.com/event4u-app/agent-config/commit/629d850af11c6fc798dbc56c7b4c644dc81e2ef9))
* **telemetry:** add the telemetry.remote namespace, default-off on four axes ([5bc91bf](https://github.com/event4u-app/agent-config/commit/5bc91bfc1065403b636ae26c59db2c90120f78f9))
* **gates:** add `gates --sheet` — one decision sheet with per-row provenance ([9e58315](https://github.com/event4u-app/agent-config/commit/9e5831536f14b178f13094e9f9842e15b3ab53c0))
* **gates:** ratchet the roadmap estate and make a new roadmap pay for itself ([6f808e6](https://github.com/event4u-app/agent-config/commit/6f808e6b85d8da6df49f0e11f62bc33b6bddbd00))
* **hooks:** register the per-turn composite as an observe-only budget row ([1d810b3](https://github.com/event4u-app/agent-config/commit/1d810b39053ed0795d1d66fa5f40ec98d192bc4e))
* **bench:** add a --bundle override so a two-version latency run is a flag ([231d8ea](https://github.com/event4u-app/agent-config/commit/231d8eaaf0a675828157b1d93385d1573adc5eb3))

### Bug Fixes

* **test:** read the roadmap slug from the tree instead of hardcoding it ([47246d7](https://github.com/event4u-app/agent-config/commit/47246d76dc4b04867fcbdc236c62d227a3a2699b))
* **hooks:** close all 15 R2 completion-review findings on the shaping layer ([c463f92](https://github.com/event4u-app/agent-config/commit/c463f92f4e10a366e3825d923bf30903e26a82f7))
* **ci:** three consequences of this branch, each fixed at its cause ([4fae6e5](https://github.com/event4u-app/agent-config/commit/4fae6e5b781fc75c2a9b54738613b68389d58ad7))
* **skill:** keep the 4b routing note dense enough for the size gate ([bd44198](https://github.com/event4u-app/agent-config/commit/bd441984f6a6212a7583df9901e9d838232f4ac9))
* **register:** the roadmap claim lives in the git common dir, not per worktree ([71f09c2](https://github.com/event4u-app/agent-config/commit/71f09c2e87f84fbb2c415f1ac3b8065300fed23e))
* **packaging:** move the host launch table into the shipped tree ([7986303](https://github.com/event4u-app/agent-config/commit/7986303f9dff20df8aa9649a0c79643049ed8e61))
* **roadmaps:** land the glyph corrections the archival commit left behind ([affc36c](https://github.com/event4u-app/agent-config/commit/affc36c4a5a17903542949605a019ca22eeb95cc))
* **review:** close all twelve round-2 findings, one of them a live bug ([fd17e52](https://github.com/event4u-app/agent-config/commit/fd17e52d5e6d058c037207a1c44d458240a38489))
* **review:** close all four round-1 findings, plus one the review did not reach ([a822341](https://github.com/event4u-app/agent-config/commit/a822341cff699b56e53f03d92bf8b84f1385d3cc))
* **report:** give each baseline axis its own N against the pre-registered floor ([d459f7b](https://github.com/event4u-app/agent-config/commit/d459f7bf60a6482cc1756365ca04df988c73dedd))
* **hooks:** decide manifest freshness by content, not mtime ([4578c57](https://github.com/event4u-app/agent-config/commit/4578c57b83b90f416aa3de2713003a8fdbf012d7))
* **hooks:** recompile the manifest so the new concern reaches the fast path ([d7b50e5](https://github.com/event4u-app/agent-config/commit/d7b50e5eef25321cb94120a0c8df35317b84f202))
* **ci:** charge the new roadmap against the estate ratchet ([97968d6](https://github.com/event4u-app/agent-config/commit/97968d6de2b3757bfc35a2ad0f5cfe7792cdffc4))
* **lint:** a type-only import and a test that shadowed its own tmpdir ([49ce2d5](https://github.com/event4u-app/agent-config/commit/49ce2d505c51f8cb50795aaa9744a043918be5c4))
* **review:** close all eight round-6 findings, two of them critical ([53b4ac3](https://github.com/event4u-app/agent-config/commit/53b4ac34f256149b1c4ae6e4fe6900a5cdff774d))
* **review:** close all three round-5 findings ([ebc4b33](https://github.com/event4u-app/agent-config/commit/ebc4b33850d907b5eab65fe4b9d7bedabd3efc37))
* **review:** close all seven round-4 findings ([6b60f30](https://github.com/event4u-app/agent-config/commit/6b60f30622fe663bc2ae249966835126a818a64c))
* **refs:** exempt the illustrative path inside R2 finding 4 ([7464623](https://github.com/event4u-app/agent-config/commit/7464623e78bbd4110831c676b4043c0de66f1cd3))
* **telemetry:** address all fourteen completion-review findings ([a0d06a7](https://github.com/event4u-app/agent-config/commit/a0d06a7a018d4d2a36b839d71e0137e15042e6c9))
* **review:** address all eight R2 round-1 findings ([c91a873](https://github.com/event4u-app/agent-config/commit/c91a873d7c101ed572b430f65a5f5bf4a9984e65))
* **refs:** mark two historical dispatch paths rather than rewrite them ([61267f7](https://github.com/event4u-app/agent-config/commit/61267f765df84270e125c6bc0d3d3bc83d8246de))
* **gates:** let resume_probe decide a repo path, and stop cutting a clause inside its backticks ([fc575b0](https://github.com/event4u-app/agent-config/commit/fc575b0681872cfbc4b83e2bfeb80d46474f5850))
* **review:** close all six round-3 findings ([76d1db5](https://github.com/event4u-app/agent-config/commit/76d1db5b33e33c0c5c17a6203c1c9aee511f01aa))
* **review:** close all ten round-2 findings ([561b486](https://github.com/event4u-app/agent-config/commit/561b486e0c1a4d8bfa2aba3e6b6dd82bf0803c64))
* **review:** close the remaining eleven findings ([8c90414](https://github.com/event4u-app/agent-config/commit/8c9041488ae67aa58d90fbd85fef39866bb2e921))
* **review:** close the critical and the three high findings ([53f44c2](https://github.com/event4u-app/agent-config/commit/53f44c2199677e5feb7370fb999e3a0b95b84348))
* **test:** stop the subview determinism assertion racing the clock ([7abbc92](https://github.com/event4u-app/agent-config/commit/7abbc9226afb679d7c471cae8142e76eb1931d0b))
* **hooks:** register run-continuation, and prove it runs through the live chain ([5cd6612](https://github.com/event4u-app/agent-config/commit/5cd66121481ba01619dcab73b483f1364c33e3fa))
* **review:** address all eleven round-2 findings ([833a854](https://github.com/event4u-app/agent-config/commit/833a85441ce3fceb87a66398d470396a7b040c34))
* **council:** make the fallback reachable, and sticky across an invocation ([a004944](https://github.com/event4u-app/agent-config/commit/a0049444dcb8b04d9b9550c3193ca91bf265dbbe))
* **ci:** make check_estate_count fail where its own test already failed ([1b020ca](https://github.com/event4u-app/agent-config/commit/1b020ca38ecb860101b7661786513646b9e6a87f))
* **ci:** re-derive the pre_tool_use latency cap, which sat inside its own distribution ([6145fca](https://github.com/event4u-app/agent-config/commit/6145fca82679836f1b9479b7feeedf0da4c6ac29))
* **ci:** make the pre_tool_use latency cap advisory, keep 250 blocking ([9704646](https://github.com/event4u-app/agent-config/commit/97046467d9a64031aec70b31dbcb7c0b6199bb8b))
* **ci:** walk the estate ratchet down to the estate this branch leaves behind ([5ae35ca](https://github.com/event4u-app/agent-config/commit/5ae35caaea12523660adc4b9f86b22b0ef478e43))
* **review:** address all eight completion-review findings ([4030849](https://github.com/event4u-app/agent-config/commit/403084968f98a7f15278f033b218204efd956990))
* **telemetry:** resolve the settings file and the log against the project root ([f13b8a5](https://github.com/event4u-app/agent-config/commit/f13b8a56cd1d1f1dcbc901c3a57b7226a4d9bb81))
* **telemetry:** repair the R2 findings — record the knob that actually decides ([a1b3177](https://github.com/event4u-app/agent-config/commit/a1b3177cda84f1d604e1d2587310532232f6d655))
* **hooks:** drop the BodyClass import the extraction orphaned ([c50e92b](https://github.com/event4u-app/agent-config/commit/c50e92b6d04b54b394e488b22d39c844c4e779cf))
* **config:** correct the estate baseline to the trunk value it never described ([6a5ad7f](https://github.com/event4u-app/agent-config/commit/6a5ad7fc800b3c08928f7a8464860c7d6676ab73))
* **hooks:** apply the R2 fix pass — 6 of 7 findings ([d80398a](https://github.com/event4u-app/agent-config/commit/d80398ab24f8ca9c0731623b8cb53a918c3e135b))
* **hooks:** make fd 0 non-blocking on purpose — the two stdin properties are coupled ([a0ec3b9](https://github.com/event4u-app/agent-config/commit/a0ec3b9d1f55be220d3eb76ed1555828eb7e4b35))
* **config:** give the estate-count budget the review_by every budget needs ([c1789aa](https://github.com/event4u-app/agent-config/commit/c1789aa28ce4d9c4eb2dba59a271989e40a75667))
* **hooks:** cap the first-byte wait — the stdin fix was hanging idle callers ([4ffee76](https://github.com/event4u-app/agent-config/commit/4ffee765d588b88fa50a221364840b06fdf10d19))
* **gates:** close all 11 R2 findings — the ratchet now reads its base ref ([9c7e0cf](https://github.com/event4u-app/agent-config/commit/9c7e0cfc66e8c61639973b8ccf76d3c093d377e0))
* **roadmaps:** draft the six missing recommendations, and repair a red ratchet ([fbed7cc](https://github.com/event4u-app/agent-config/commit/fbed7cc624b35af4652d7da86c49bb35f5d934ff))
* **review:** let the R2 reviewer see inline acceptance criteria ([b3b42ad](https://github.com/event4u-app/agent-config/commit/b3b42ada2acba3dcb5ccbc56b51db29a67cb969a))
* **hooks:** apply the R2 fix pass — 14 fixed, 1 split into a policy blocker ([ef0f2dc](https://github.com/event4u-app/agent-config/commit/ef0f2dc785ce289c24dafd60943db9e5a648559a))
* **test:** type the spawn env so the tests typecheck reaches it ([173aaa2](https://github.com/event4u-app/agent-config/commit/173aaa2185ce98a717a9e83fac0a68c4f4b22b2c))
* **hooks:** guards were blind above the pipe buffer; publish the Phase 1 null ([bcd73ed](https://github.com/event4u-app/agent-config/commit/bcd73ed2d74d62e7e7b58e1323dd982a130e1947))

### Performance

* **hooks:** precompile the manifest — 103 to 81 ms per dispatch ([bf45828](https://github.com/event4u-app/agent-config/commit/bf4582811240d6e70db4659c9f2237f69dea8213))
* **hooks:** measure only the bodies some concern actually loses ([6b7463b](https://github.com/event4u-app/agent-config/commit/6b7463b96d223dc771ba92cb718808ed82cadbff))
* **hooks:** payload opt-in — a concern gets the bodies it declares ([b4ef8e5](https://github.com/event4u-app/agent-config/commit/b4ef8e548c67659404d78dd9894892805265ffcb))
* **hooks:** take both per-write spawns off the hot path ([ae7e097](https://github.com/event4u-app/agent-config/commit/ae7e097c4a019ab120369525f813d4306d76dc43))

### Reverts

* back out the fix commit so it can re-land after the findings artefact ([f939d0e](https://github.com/event4u-app/agent-config/commit/f939d0e75aea713f80bdd1d19298f6287bf5d8c2))

### Documentation

* **review:** re-bind the R2 artefact after the size-ratchet extraction ([b037e14](https://github.com/event4u-app/agent-config/commit/b037e141c6fd3217221733a84b9dd8a9cfbee91e))
* **review:** record the R2 dispositions — all 15 findings fixed ([8e60686](https://github.com/event4u-app/agent-config/commit/8e60686c0055db9ca8246b5a71d575bddf859ca6))
* **review:** land the R2 findings artefact and its input package ([491d84c](https://github.com/event4u-app/agent-config/commit/491d84c9a9fa0f3591bcd5405606405d6790814b))
* **roadmap:** resolve the last deferred item via the council path and archive ([d15577a](https://github.com/event4u-app/agent-config/commit/d15577a73c353872cce2668901474fce191332d5))
* **review:** re-bind the R2 skip to the post-walk-down scope ([3a188cd](https://github.com/event4u-app/agent-config/commit/3a188cd6b096181ffddd3c19dc7c6e319cbbcc3b))
* **roadmap:** close standing-context-40k Phase 4, record why the rest did not run ([4aa1824](https://github.com/event4u-app/agent-config/commit/4aa18244c0458b2c838d47ec1d4463d2adc68ef8))
* **contracts:** record emission shaping in hook-architecture-v1 ([9adc32d](https://github.com/event4u-app/agent-config/commit/9adc32d3d6e7993c9182351f2efb8ca6bb3ff6b6))
* **review:** declare the R2 skip for the residuals closure ([5a3b757](https://github.com/event4u-app/agent-config/commit/5a3b757abce8671959533d7db6906c2b8076aa25))
* **proof:** regenerate the proof page after the claims-ledger edits ([27b31eb](https://github.com/event4u-app/agent-config/commit/27b31eb5c4c7e35ad69e031547a716e9fa8a3d07))
* **review:** declare the R2 skip — zero code paths in this completion ([d2cc27e](https://github.com/event4u-app/agent-config/commit/d2cc27e4ea42aa7adea96c63338dce5d190fa670))
* **review:** R2 round 2 — 12 findings, 2 high, recorded before the fixes ([39412a0](https://github.com/event4u-app/agent-config/commit/39412a027109058a532f0cbafa8ceea078f67a44))
* **review:** R2 completion review round 1 — 4 findings, recorded before the fixes ([ce2cd9f](https://github.com/event4u-app/agent-config/commit/ce2cd9fdbdc8372b3a969830789c095ff57381cb))
* **roadmap:** the contract run was re-run under a claim and the mechanism is inert ([4158e9e](https://github.com/event4u-app/agent-config/commit/4158e9e4278a987163eadb097ff626d371ad6f7c))
* **roadmap:** close Phase 4 — one refusal, one null, one measured axis ([5f1fe44](https://github.com/event4u-app/agent-config/commit/5f1fe44522af188f88e49f7dc236a7f6f721cc38))
* **claims:** one floor is unreachable, one gate takes its honest-null path ([d64e216](https://github.com/event4u-app/agent-config/commit/d64e2164f86afd24031bc2187d91511741aa6ddd))
* **review:** re-bind after the second main merge, and name the tool misclassification ([29c610a](https://github.com/event4u-app/agent-config/commit/29c610a5ac799e186cb0ed0075727c87f39c145b))
* **review:** re-bind the R2 round after the second main merge ([7eb2862](https://github.com/event4u-app/agent-config/commit/7eb2862a9742c0b7eaa436799b28f1951063c8fc))
* **review:** re-bind the manifest's roadmap_hash, the third of three ([031bf70](https://github.com/event4u-app/agent-config/commit/031bf7012d11568156873df43f9510ae09a593c4))
* **review:** re-bind after the main merge and record what moved since the review ([fb39fef](https://github.com/event4u-app/agent-config/commit/fb39fef8e8b3afb9422a702b2819f693ba80f87a))
* **review:** re-bind the R2 round after the main merge ([a961e73](https://github.com/event4u-app/agent-config/commit/a961e73390402b29c38f5999a532840cdd152f2e))
* **roadmap:** close slot-scoped concern loading on its own Phase 0 null ([d5d6f8f](https://github.com/event4u-app/agent-config/commit/d5d6f8fab0388995381326a7572446187ec7ef1e))
* **review:** record round 6 before its fixes ([a589e5d](https://github.com/event4u-app/agent-config/commit/a589e5d55f6f9d54eaa74c069db6509a0c9739c3))
* **review:** record round 5 before its fixes ([8905d43](https://github.com/event4u-app/agent-config/commit/8905d43b484a7502854a975eb23734d68a0df6b4))
* **review:** re-bind the findings to the final content scope ([ffb9dba](https://github.com/event4u-app/agent-config/commit/ffb9dbaccf87a2e85a697835236e63b2eb5d1b2a))
* **review:** re-bind the findings artefact to the post-fix scope ([217beef](https://github.com/event4u-app/agent-config/commit/217beef3798b471ccd10ac760b12b69e5efdb6bd))
* **review:** record the R2 completion-review findings for org-telemetry-retention ([cec7f9d](https://github.com/event4u-app/agent-config/commit/cec7f9d61f7ac9538123258fbb4869d257773ac1))
* **review:** re-bind the R2 round to the post-fix scope ([66e5da0](https://github.com/event4u-app/agent-config/commit/66e5da00d98de5fdd6edad60140f93fe17a6bc20))
* **roadmap:** close the four executable steps and record two broken verify paths ([dce6f6d](https://github.com/event4u-app/agent-config/commit/dce6f6dc831c516ab2d12e2f2c5e95ef83bcf894))
* **security:** state what telemetry ships, what it cannot ship, and how to read it ([ad6e75c](https://github.com/event4u-app/agent-config/commit/ad6e75cdb46ea0b533f648512fe98f4eb4153c78))
* **review:** record round 4 before its fixes ([807ceab](https://github.com/event4u-app/agent-config/commit/807ceabaa9bd7853263cbb227c59916fd2bef11b))
* **review:** land the R2 round for estate triage batch 1 — 8 findings, unfixed ([ffdaa92](https://github.com/event4u-app/agent-config/commit/ffdaa92a94ad8129e964de05fa0f346ee5ad55b0))
* **estate:** record triage batch 1 — ten verdicts, and what the sweep found ([f893f03](https://github.com/event4u-app/agent-config/commit/f893f035485f7f7603125e2a2c32781da7396715))
* **review:** record round 3 before its fixes ([a9870a3](https://github.com/event4u-app/agent-config/commit/a9870a331822901fa411e746b3bceae46fe8b603))
* **roadmap:** route the measured hook-latency regression to its owner ([42be18b](https://github.com/event4u-app/agent-config/commit/42be18b3c1f666e10795c740816c9d912c304ded))
* **review:** record round 2 before its fixes ([aabe209](https://github.com/event4u-app/agent-config/commit/aabe209d7a7ad57f9f42cb209c4f455009d87645))
* **review:** record the R2 completion review before its fixes ([1fef09b](https://github.com/event4u-app/agent-config/commit/1fef09b5149c3126c5ebe4edafec36e5bbeab1a9))
* **review:** re-bind round 2 to the post-fix scope ([02a6c80](https://github.com/event4u-app/agent-config/commit/02a6c80bbfd68a3e284dc8258c7c2267cd182645))
* **review:** land R2 round 2, findings unfixed — and archive round 1 ([2d8e32b](https://github.com/event4u-app/agent-config/commit/2d8e32be8bed0a7d5a0d54030b360d353eb69550))
* **bench:** record that the first CI reading under-corrects the control ([801f3b5](https://github.com/event4u-app/agent-config/commit/801f3b59c326027648fd194f86be0dbca95254f1))
* **roadmaps:** install the council-fallback and long-horizon roadmaps from the inbox ([5c87e6d](https://github.com/event4u-app/agent-config/commit/5c87e6df59ebd44beb0f7dcb6df2d3cb2161e68d))
* **claims:** the absolute caps are no longer both the CI gate ([5805877](https://github.com/event4u-app/agent-config/commit/5805877dc3b328167644dc41cfba61e769d1e5c1))
* **review:** re-bind after the estate-ratchet fix ([8b9e19b](https://github.com/event4u-app/agent-config/commit/8b9e19b09dc89152a4e8991c0c0bb643d9dc398c))
* **review:** re-bind the findings after merging release 14.3.0 and PR #1424 ([34e236a](https://github.com/event4u-app/agent-config/commit/34e236aa2ef6d710970615a743443481c690dece))
* **review:** re-bind the findings after the base merge ([1a151d6](https://github.com/event4u-app/agent-config/commit/1a151d6f8e29a872c64632ee1d519eaf978c74fe))
* **review:** re-bind the findings to the post-fix scope ([f777b91](https://github.com/event4u-app/agent-config/commit/f777b91baf28c994c4659058eba66bbf59129e75))
* **review:** land the R2 completion review, findings unfixed ([837de77](https://github.com/event4u-app/agent-config/commit/837de77c764cabfe3cf8c6d226bc52a2ecac8de5))
* **roadmap:** close stop-gate-honesty 2.1, resolve its blocker, archive the file ([ca1a1a9](https://github.com/event4u-app/agent-config/commit/ca1a1a957f1acbe5d1d34c6834e4e5d61ac3fc67))
* **hooks:** correct the gate header to four detectors and name its removal condition ([d41742f](https://github.com/event4u-app/agent-config/commit/d41742f7ad5d4896fadd20bc4b30dd97155082df))
* **contracts:** pre-register the turn-end detector demotion standard ([28370e6](https://github.com/event4u-app/agent-config/commit/28370e681b520221b43c8ecac11c0acfb6c5e813))
* **review:** re-bind the findings after the risk-register re-review ([76403ba](https://github.com/event4u-app/agent-config/commit/76403ba486a651468eedf737bc92e419ceb61fac))
* **roadmaps:** re-review the org-telemetry risk register after Phase 1 landed ([0fa5fb4](https://github.com/event4u-app/agent-config/commit/0fa5fb46fa1a7ce04b60f5001a09e3acc81b78dc))
* **review:** re-bind the org-telemetry findings after the base moved ([7cb5b8e](https://github.com/event4u-app/agent-config/commit/7cb5b8e1854229c28fe0d03731cc1b81c8a59744))
* **review:** close the org-telemetry Phase 1 findings, re-bound to the repair head ([3e434f5](https://github.com/event4u-app/agent-config/commit/3e434f5e5dc2c1335fbd40a76f9aea79fada5ccf))
* **review:** record the R2 findings for org-telemetry Phase 1 before any repair ([bffea8d](https://github.com/event4u-app/agent-config/commit/bffea8d26f48a54d59481ce7c0949699c035bafc))
* **review:** re-bind the findings after merging the PR base ([b320587](https://github.com/event4u-app/agent-config/commit/b320587ddf2273cff09d89d3100c4354e126f612))
* **review:** re-bind the findings after the orphan removal ([9364896](https://github.com/event4u-app/agent-config/commit/9364896c7f905024ba24e040ac1293717ed450da))
* **roadmaps:** close org-telemetry Phase 1 and record where its step text was wrong ([a9c7a15](https://github.com/event4u-app/agent-config/commit/a9c7a1532fdd213b5430740f025766df7be774e6))
* **review:** re-bind the findings after the source-size extraction ([c6910f5](https://github.com/event4u-app/agent-config/commit/c6910f5e339a9a986252adc62aac420a8361cf79))
* **review:** re-bind the skip declaration and correct the inherited-red section ([6f69dc7](https://github.com/event4u-app/agent-config/commit/6f69dc789fc9f6be1ac3e5fea00b258a49409b9e))
* **roadmap:** record that the estate-ratchet breach was closed on the base ([d818131](https://github.com/event4u-app/agent-config/commit/d8181316288d2400899865f14e3ec3f6a73b26c3))
* **review:** re-bind the findings after merging the base ([e572ed3](https://github.com/event4u-app/agent-config/commit/e572ed339adff51ef6bd80525fa81aa158ba8048))
* **review:** re-bind the skip declaration to the moved review scope ([29ad745](https://github.com/event4u-app/agent-config/commit/29ad745286c6a44ed3f15f171ecc45e8831ef6c8))
* **roadmap:** restore two mismarked deferrals and refute both tempting reasons ([2c2b6ca](https://github.com/event4u-app/agent-config/commit/2c2b6ca547ab619f33d07d8f612451297a435e76))
* **review:** declare the completion review skipped — no code surface ([fd7017e](https://github.com/event4u-app/agent-config/commit/fd7017ebfa1f0696d04f1f141c043a696d7a8fbc))
* **roadmap:** close ci-economy 3.4 and restore two mismarked deferrals ([604451f](https://github.com/event4u-app/agent-config/commit/604451ff5765f684495f5bad5a56ff2c71a60049))
* **review:** re-bind the findings after the CI fix pass ([1cf1b81](https://github.com/event4u-app/agent-config/commit/1cf1b8189391f5d66325c7eb11a07a66e0a0165f))
* **review:** re-bind the findings artefact after the fix pass ([31ba213](https://github.com/event4u-app/agent-config/commit/31ba213c0c2d4d748d661f7bfbb4ccec36bae930))
* **review:** disposition all 7 R2 findings with commit refs ([342a71a](https://github.com/event4u-app/agent-config/commit/342a71a8b08390869f6b3082c2f22b2a1f09c1ca))
* **roadmap:** defer 5.3 with its classification, and re-measure AC-2 after the fix pass ([8e7a1dd](https://github.com/event4u-app/agent-config/commit/8e7a1dd2410cc278b22f212ded86a868ff345dad))
* **review:** commit the R2 reviewer input package ([2f91955](https://github.com/event4u-app/agent-config/commit/2f91955f26b5f18626b6b218fb2a81a26ab4f75b))
* **review:** commit the R2 findings skeleton before the fix pass ([42490e3](https://github.com/event4u-app/agent-config/commit/42490e395fa094cbd656b674e60c47846c1341ab))
* **roadmap:** close Phase 2 and publish the AC-2 null ([b59572e](https://github.com/event4u-app/agent-config/commit/b59572e6e648ecee4777c7f88a3998180af398a9))
* **review:** declare the Phase 0 completion skip — zero code paths of five files ([37e3084](https://github.com/event4u-app/agent-config/commit/37e3084d384525ef75dfd8d412da99f0b14c28e4))
* **roadmaps:** close org-telemetry Phase 0 and record what it changed downstream ([c86fa4a](https://github.com/event4u-app/agent-config/commit/c86fa4aa72e5c7f1f6ab303e4ee70bf0356c028c))
* **evidence:** publish the three org-telemetry Phase 0 spike findings ([71a9f2f](https://github.com/event4u-app/agent-config/commit/71a9f2f53fc83d176a9d6eb41afe7251ee54a81b))
* **review:** re-bind the findings after merging the PR head ([9c8a5fc](https://github.com/event4u-app/agent-config/commit/9c8a5fc1251d2cbb1dd2eed7a173b338aaa90dc7))
* **review:** re-bind the findings after the non-blocking fd fix ([2788770](https://github.com/event4u-app/agent-config/commit/2788770284a64bc0c49fb86a3f7980fa7ae36479))
* **review:** re-bind after the CI fix ([8ca01d6](https://github.com/event4u-app/agent-config/commit/8ca01d6023cfde6f8942e00f99b414edb2de6967))
* **review:** mark the six committed reviews that were dispatched AC-blind ([295ced9](https://github.com/event4u-app/agent-config/commit/295ced9d90ec82a47b92e8ca0215cea1ca0b3982))
* **review:** re-bind after the trunk merge, and correct finding 11's ref ([348c9aa](https://github.com/event4u-app/agent-config/commit/348c9aad43afa7e80e40b71502c4f992894f9d29))
* **review:** re-bind the findings after the first-byte-cap fix ([485a302](https://github.com/event4u-app/agent-config/commit/485a3027c54e8db260d3042bff2723ecc20daef9))
* **review:** re-bind the R2 artefact and record the dispositions ([0ab50ca](https://github.com/event4u-app/agent-config/commit/0ab50ca2d8b2bb3b7c2d3d12512aa0ed497988a7))
* **review:** record the R2 findings for estate-drawdown 0.1 + 3.1 ([479c993](https://github.com/event4u-app/agent-config/commit/479c993267db052b61a32cc4f3db7dbd8a2b435b))
* **roadmap:** land the decision sheet and close estate-drawdown 0.1 + 3.1 ([1b9a034](https://github.com/event4u-app/agent-config/commit/1b9a034df50db3d57c24de2d57c402b5862888f9))
* **review:** re-bind the findings after the base merge moved the scope ([5198659](https://github.com/event4u-app/agent-config/commit/51986599cec38a73427dc5b4f124d7aed74978c2))
* **review:** bind the findings to the fix pass and re-derive the manifest ([12e2aff](https://github.com/event4u-app/agent-config/commit/12e2aff17981ee0a440c4b7785ef657904348595))
* **review:** land the R2 findings, all rows open, before any fix pass ([8ea8731](https://github.com/event4u-app/agent-config/commit/8ea8731a1c2d9850ebbd0bea97f34a1fe7f57911))
* **review:** commit the R2 findings skeleton before any fix pass ([e17a9fe](https://github.com/event4u-app/agent-config/commit/e17a9fe4e5a7be612f16c04d2a492009a891eb36))
* **hooks:** record the host's matcher/if semantics, and cancel 5.1 on them ([606fb93](https://github.com/event4u-app/agent-config/commit/606fb9391074d0bd1aa3fb8491fef55f1407a408))

### Refactoring

* **hooks:** move emission shaping out of the dispatcher to hold the size ratchet ([df02ed2](https://github.com/event4u-app/agent-config/commit/df02ed29f1c6f9b879ed0f0c35b50eb3813aa520))
* **council:** extract seven cohesive units to pay the source-size ratchet ([6a7c0f2](https://github.com/event4u-app/agent-config/commit/6a7c0f235ebe3b2e12e30d5a3626f5dd4b4f8aa3))
* **hooks:** move the payload shaping plan out of the dispatcher ([a9637d0](https://github.com/event4u-app/agent-config/commit/a9637d0015e4c40f98a3bf5e38ec601b6b09d8da))

### Tests

* **council:** gate the fallback chain end to end, and register the claim ([e8bc15e](https://github.com/event4u-app/agent-config/commit/e8bc15e201b821bd5513e18928798123d740486a))
* **hooks:** pin the payload opt-in from the concern side of stdin ([b319c6a](https://github.com/event4u-app/agent-config/commit/b319c6a07b91ee3511b91916795c72156c711909))
* **bench:** add a large-payload cell, and pre-register the Phase 1 A/B bars ([0d53c42](https://github.com/event4u-app/agent-config/commit/0d53c42ba490be92039a04b0f2f6c980ac2dcb30))

### CI

* **tests:** drop the falsified balanced-shards claim from the exclusion comment ([2cc2060](https://github.com/event4u-app/agent-config/commit/2cc2060be8e3085b0e47dc0c91a2112cd9680d3b))
* **economy:** re-measure the shard baseline over 50 runs and settle the fold-back ([b23afc0](https://github.com/event4u-app/agent-config/commit/b23afc03ab6db9cda0876dfd8a36c9b97ad36f1e))

### Chores

* **tokens,ceilings:** pay for the rule growth twice, itemised both times ([a58292c](https://github.com/event4u-app/agent-config/commit/a58292c44ef4628c185c70fd45a6a8077958ab9d))
* **estate:** walk the ratchet down to the estate this closure earned ([d2563e9](https://github.com/event4u-app/agent-config/commit/d2563e94e6f2138a75e6a7e77877c257ed0731d7))
* **roadmaps:** close the inbox-harvest residuals on two named locks ([28ed62e](https://github.com/event4u-app/agent-config/commit/28ed62e2477e5ec047e0130363845c70fd3015bb))
* **roadmaps:** regenerate the dashboard against current main ([f26af75](https://github.com/event4u-app/agent-config/commit/f26af7581e6e0aa96a36d745a628cccba0c65f2d))
* **roadmaps:** resolve both Iron-Law-3 holdouts on a converged council verdict ([e74b99d](https://github.com/event4u-app/agent-config/commit/e74b99d66d9d607e1e154c70f3065595d675e9c0))
* **sync:** regenerate the dist projection and land the R2 reviewer input ([23abc9e](https://github.com/event4u-app/agent-config/commit/23abc9e0a7f14c0b6c0123b4cf4c90498f97f4b1))
* **gates:** walk the blocker-decidability ratchet 22 → 20 ([5aa0c73](https://github.com/event4u-app/agent-config/commit/5aa0c736919c89bcdc53574d6634539052dd47e0))
* **roadmaps:** park six roadmaps whose open work is gated outside this tree ([fb73b0a](https://github.com/event4u-app/agent-config/commit/fb73b0a8428244e2e409619960e86ebaf689cfa0))
* **roadmaps:** regenerate the dashboard from the merged roadmap set ([d9165fe](https://github.com/event4u-app/agent-config/commit/d9165fe086012703aa1ff25b19239c7447de5345))
* **changelog:** split era 14.0.x → pre-14.3.0 ([0b1da5f](https://github.com/event4u-app/agent-config/commit/0b1da5fbde4346466bf3fd6d4aa8401e7523573c))
* **gates:** raise the estate open-blockers baseline 67 to 72, with the split measured ([7de21d6](https://github.com/event4u-app/agent-config/commit/7de21d6a788ce73f2df8c78c8728b00b90c8161f))
* **sync:** project the roadmap_gates --sheet renderer into dist/agent-src ([e184eb9](https://github.com/event4u-app/agent-config/commit/e184eb9e2aa56acdce4613564dad62e353529375))
* **roadmap:** regenerate the dashboard after the base merge ([f8469f3](https://github.com/event4u-app/agent-config/commit/f8469f390b4eac90945582cffdcfed85b1433ca9))
* **roadmap:** regenerate the dashboard after the fix pass ([297731a](https://github.com/event4u-app/agent-config/commit/297731a36e7813c9a931c417864445465b826af0))
* **roadmap:** regenerate the dashboard after the Phase 0/4/5 flips ([baa7517](https://github.com/event4u-app/agent-config/commit/baa7517b31bc9f1593fcb1ded68864ff64057bfd))

### Other

* 14.3.0 ([965b7d7](https://github.com/event4u-app/agent-config/commit/965b7d703091122a28ecda9b77a46696b2a6f7c6))

Tests: 15254

## [14.3.0](https://github.com/event4u-app/agent-config/compare/14.2.0...14.3.0) (2026-08-19)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in c50e92b, d80398a, a0ec3b9, 4ffee76, 9c7e0cf, b3b42ad +3 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in fbed7cc, 0d53c42, 231d8ea.
- **Known limitations:** _none_

### Features

* **gates:** add `gates --sheet` — one decision sheet with per-row provenance ([9e58315](https://github.com/event4u-app/agent-config/commit/9e5831536f14b178f13094e9f9842e15b3ab53c0))
* **gates:** ratchet the roadmap estate and make a new roadmap pay for itself ([6f808e6](https://github.com/event4u-app/agent-config/commit/6f808e6b85d8da6df49f0e11f62bc33b6bddbd00))
* **hooks:** register the per-turn composite as an observe-only budget row ([1d810b3](https://github.com/event4u-app/agent-config/commit/1d810b39053ed0795d1d66fa5f40ec98d192bc4e))
* **bench:** add a --bundle override so a two-version latency run is a flag ([231d8ea](https://github.com/event4u-app/agent-config/commit/231d8eaaf0a675828157b1d93385d1573adc5eb3))

### Bug Fixes

* **hooks:** drop the BodyClass import the extraction orphaned ([c50e92b](https://github.com/event4u-app/agent-config/commit/c50e92b6d04b54b394e488b22d39c844c4e779cf))
* **config:** correct the estate baseline to the trunk value it never described ([6a5ad7f](https://github.com/event4u-app/agent-config/commit/6a5ad7fc800b3c08928f7a8464860c7d6676ab73))
* **hooks:** apply the R2 fix pass — 6 of 7 findings ([d80398a](https://github.com/event4u-app/agent-config/commit/d80398ab24f8ca9c0731623b8cb53a918c3e135b))
* **hooks:** make fd 0 non-blocking on purpose — the two stdin properties are coupled ([a0ec3b9](https://github.com/event4u-app/agent-config/commit/a0ec3b9d1f55be220d3eb76ed1555828eb7e4b35))
* **config:** give the estate-count budget the review_by every budget needs ([c1789aa](https://github.com/event4u-app/agent-config/commit/c1789aa28ce4d9c4eb2dba59a271989e40a75667))
* **hooks:** cap the first-byte wait — the stdin fix was hanging idle callers ([4ffee76](https://github.com/event4u-app/agent-config/commit/4ffee765d588b88fa50a221364840b06fdf10d19))
* **gates:** close all 11 R2 findings — the ratchet now reads its base ref ([9c7e0cf](https://github.com/event4u-app/agent-config/commit/9c7e0cfc66e8c61639973b8ccf76d3c093d377e0))
* **roadmaps:** draft the six missing recommendations, and repair a red ratchet ([fbed7cc](https://github.com/event4u-app/agent-config/commit/fbed7cc624b35af4652d7da86c49bb35f5d934ff))
* **review:** let the R2 reviewer see inline acceptance criteria ([b3b42ad](https://github.com/event4u-app/agent-config/commit/b3b42ada2acba3dcb5ccbc56b51db29a67cb969a))
* **hooks:** apply the R2 fix pass — 14 fixed, 1 split into a policy blocker ([ef0f2dc](https://github.com/event4u-app/agent-config/commit/ef0f2dc785ce289c24dafd60943db9e5a648559a))
* **test:** type the spawn env so the tests typecheck reaches it ([173aaa2](https://github.com/event4u-app/agent-config/commit/173aaa2185ce98a717a9e83fac0a68c4f4b22b2c))
* **hooks:** guards were blind above the pipe buffer; publish the Phase 1 null ([bcd73ed](https://github.com/event4u-app/agent-config/commit/bcd73ed2d74d62e7e7b58e1323dd982a130e1947))

### Performance

* **hooks:** measure only the bodies some concern actually loses ([6b7463b](https://github.com/event4u-app/agent-config/commit/6b7463b96d223dc771ba92cb718808ed82cadbff))
* **hooks:** payload opt-in — a concern gets the bodies it declares ([b4ef8e5](https://github.com/event4u-app/agent-config/commit/b4ef8e548c67659404d78dd9894892805265ffcb))
* **hooks:** take both per-write spawns off the hot path ([ae7e097](https://github.com/event4u-app/agent-config/commit/ae7e097c4a019ab120369525f813d4306d76dc43))

### Documentation

* **review:** re-bind the findings after merging the PR base ([b320587](https://github.com/event4u-app/agent-config/commit/b320587ddf2273cff09d89d3100c4354e126f612))
* **review:** re-bind the findings after the orphan removal ([9364896](https://github.com/event4u-app/agent-config/commit/9364896c7f905024ba24e040ac1293717ed450da))
* **review:** re-bind the findings after the source-size extraction ([c6910f5](https://github.com/event4u-app/agent-config/commit/c6910f5e339a9a986252adc62aac420a8361cf79))
* **review:** re-bind the skip declaration and correct the inherited-red section ([6f69dc7](https://github.com/event4u-app/agent-config/commit/6f69dc789fc9f6be1ac3e5fea00b258a49409b9e))
* **roadmap:** record that the estate-ratchet breach was closed on the base ([d818131](https://github.com/event4u-app/agent-config/commit/d8181316288d2400899865f14e3ec3f6a73b26c3))
* **review:** re-bind the findings after merging the base ([e572ed3](https://github.com/event4u-app/agent-config/commit/e572ed339adff51ef6bd80525fa81aa158ba8048))
* **review:** re-bind the skip declaration to the moved review scope ([29ad745](https://github.com/event4u-app/agent-config/commit/29ad745286c6a44ed3f15f171ecc45e8831ef6c8))
* **roadmap:** restore two mismarked deferrals and refute both tempting reasons ([2c2b6ca](https://github.com/event4u-app/agent-config/commit/2c2b6ca547ab619f33d07d8f612451297a435e76))
* **review:** declare the completion review skipped — no code surface ([fd7017e](https://github.com/event4u-app/agent-config/commit/fd7017ebfa1f0696d04f1f141c043a696d7a8fbc))
* **roadmap:** close ci-economy 3.4 and restore two mismarked deferrals ([604451f](https://github.com/event4u-app/agent-config/commit/604451ff5765f684495f5bad5a56ff2c71a60049))
* **review:** re-bind the findings after the CI fix pass ([1cf1b81](https://github.com/event4u-app/agent-config/commit/1cf1b8189391f5d66325c7eb11a07a66e0a0165f))
* **review:** re-bind the findings artefact after the fix pass ([31ba213](https://github.com/event4u-app/agent-config/commit/31ba213c0c2d4d748d661f7bfbb4ccec36bae930))
* **review:** disposition all 7 R2 findings with commit refs ([342a71a](https://github.com/event4u-app/agent-config/commit/342a71a8b08390869f6b3082c2f22b2a1f09c1ca))
* **roadmap:** defer 5.3 with its classification, and re-measure AC-2 after the fix pass ([8e7a1dd](https://github.com/event4u-app/agent-config/commit/8e7a1dd2410cc278b22f212ded86a868ff345dad))
* **review:** commit the R2 reviewer input package ([2f91955](https://github.com/event4u-app/agent-config/commit/2f91955f26b5f18626b6b218fb2a81a26ab4f75b))
* **review:** commit the R2 findings skeleton before the fix pass ([42490e3](https://github.com/event4u-app/agent-config/commit/42490e395fa094cbd656b674e60c47846c1341ab))
* **roadmap:** close Phase 2 and publish the AC-2 null ([b59572e](https://github.com/event4u-app/agent-config/commit/b59572e6e648ecee4777c7f88a3998180af398a9))
* **review:** declare the Phase 0 completion skip — zero code paths of five files ([37e3084](https://github.com/event4u-app/agent-config/commit/37e3084d384525ef75dfd8d412da99f0b14c28e4))
* **roadmaps:** close org-telemetry Phase 0 and record what it changed downstream ([c86fa4a](https://github.com/event4u-app/agent-config/commit/c86fa4aa72e5c7f1f6ab303e4ee70bf0356c028c))
* **evidence:** publish the three org-telemetry Phase 0 spike findings ([71a9f2f](https://github.com/event4u-app/agent-config/commit/71a9f2f53fc83d176a9d6eb41afe7251ee54a81b))
* **review:** re-bind the findings after merging the PR head ([9c8a5fc](https://github.com/event4u-app/agent-config/commit/9c8a5fc1251d2cbb1dd2eed7a173b338aaa90dc7))
* **review:** re-bind the findings after the non-blocking fd fix ([2788770](https://github.com/event4u-app/agent-config/commit/2788770284a64bc0c49fb86a3f7980fa7ae36479))
* **review:** re-bind after the CI fix ([8ca01d6](https://github.com/event4u-app/agent-config/commit/8ca01d6023cfde6f8942e00f99b414edb2de6967))
* **review:** mark the six committed reviews that were dispatched AC-blind ([295ced9](https://github.com/event4u-app/agent-config/commit/295ced9d90ec82a47b92e8ca0215cea1ca0b3982))
* **review:** re-bind after the trunk merge, and correct finding 11's ref ([348c9aa](https://github.com/event4u-app/agent-config/commit/348c9aad43afa7e80e40b71502c4f992894f9d29))
* **review:** re-bind the findings after the first-byte-cap fix ([485a302](https://github.com/event4u-app/agent-config/commit/485a3027c54e8db260d3042bff2723ecc20daef9))
* **review:** re-bind the R2 artefact and record the dispositions ([0ab50ca](https://github.com/event4u-app/agent-config/commit/0ab50ca2d8b2bb3b7c2d3d12512aa0ed497988a7))
* **review:** record the R2 findings for estate-drawdown 0.1 + 3.1 ([479c993](https://github.com/event4u-app/agent-config/commit/479c993267db052b61a32cc4f3db7dbd8a2b435b))
* **roadmap:** land the decision sheet and close estate-drawdown 0.1 + 3.1 ([1b9a034](https://github.com/event4u-app/agent-config/commit/1b9a034df50db3d57c24de2d57c402b5862888f9))
* **review:** re-bind the findings after the base merge moved the scope ([5198659](https://github.com/event4u-app/agent-config/commit/51986599cec38a73427dc5b4f124d7aed74978c2))
* **review:** bind the findings to the fix pass and re-derive the manifest ([12e2aff](https://github.com/event4u-app/agent-config/commit/12e2aff17981ee0a440c4b7785ef657904348595))
* **review:** land the R2 findings, all rows open, before any fix pass ([8ea8731](https://github.com/event4u-app/agent-config/commit/8ea8731a1c2d9850ebbd0bea97f34a1fe7f57911))
* **review:** commit the R2 findings skeleton before any fix pass ([e17a9fe](https://github.com/event4u-app/agent-config/commit/e17a9fe4e5a7be612f16c04d2a492009a891eb36))
* **hooks:** record the host's matcher/if semantics, and cancel 5.1 on them ([606fb93](https://github.com/event4u-app/agent-config/commit/606fb9391074d0bd1aa3fb8491fef55f1407a408))

### Refactoring

* **hooks:** move the payload shaping plan out of the dispatcher ([a9637d0](https://github.com/event4u-app/agent-config/commit/a9637d0015e4c40f98a3bf5e38ec601b6b09d8da))

### Tests

* **hooks:** pin the payload opt-in from the concern side of stdin ([b319c6a](https://github.com/event4u-app/agent-config/commit/b319c6a07b91ee3511b91916795c72156c711909))
* **bench:** add a large-payload cell, and pre-register the Phase 1 A/B bars ([0d53c42](https://github.com/event4u-app/agent-config/commit/0d53c42ba490be92039a04b0f2f6c980ac2dcb30))

### CI

* **tests:** drop the falsified balanced-shards claim from the exclusion comment ([2cc2060](https://github.com/event4u-app/agent-config/commit/2cc2060be8e3085b0e47dc0c91a2112cd9680d3b))
* **economy:** re-measure the shard baseline over 50 runs and settle the fold-back ([b23afc0](https://github.com/event4u-app/agent-config/commit/b23afc03ab6db9cda0876dfd8a36c9b97ad36f1e))

### Chores

* **gates:** raise the estate open-blockers baseline 67 to 72, with the split measured ([7de21d6](https://github.com/event4u-app/agent-config/commit/7de21d6a788ce73f2df8c78c8728b00b90c8161f))
* **sync:** project the roadmap_gates --sheet renderer into dist/agent-src ([e184eb9](https://github.com/event4u-app/agent-config/commit/e184eb9e2aa56acdce4613564dad62e353529375))
* **roadmap:** regenerate the dashboard after the base merge ([f8469f3](https://github.com/event4u-app/agent-config/commit/f8469f390b4eac90945582cffdcfed85b1433ca9))
* **roadmap:** regenerate the dashboard after the fix pass ([297731a](https://github.com/event4u-app/agent-config/commit/297731a36e7813c9a931c417864445465b826af0))
* **roadmap:** regenerate the dashboard after the Phase 0/4/5 flips ([baa7517](https://github.com/event4u-app/agent-config/commit/baa7517b31bc9f1593fcb1ded68864ff64057bfd))

Tests: 14730 (+101 since 14.2.0)
