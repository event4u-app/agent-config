# Changelog Archive — pre-8.12.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `8.12.0`, split out of the main
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

## [8.11.0](https://github.com/event4u-app/agent-config/compare/8.10.0...8.11.0) (2026-07-12)

### Features

* **council:** chairman billable dispatch + estimate row + render injection ([9a62bf1](https://github.com/event4u-app/agent-config/commit/9a62bf1044a872949e46ffcb4581df4966d04887))
* **council:** wire the stance tally end-to-end (final-round contract + Vote Tally render) ([ba84f55](https://github.com/event4u-app/agent-config/commit/ba84f55585a858f3d7053e950369a89b50e6f81c))
* **council:** encode the contested-design council decisions (auto-select + repair policy) ([5f10a51](https://github.com/event4u-app/agent-config/commit/5f10a51904605ddd68840e3fa70983686e16fcdb))
* **council:** chairman/debate_gates/restate config blocks + contract doc ([0f09a95](https://github.com/event4u-app/agent-config/commit/0f09a9525c010040facb84c3af57ce59eabfe968))
* **council:** Phase 3 anti-conformity directive (wired) + debate-gate detectors ([b07b722](https://github.com/event4u-app/agent-config/commit/b07b7229caf61c793203dcd7ebe707f5d7b45ac1))
* **council:** Phase 2 chairman selection (default-off, host fallback) ([caa518f](https://github.com/event4u-app/agent-config/commit/caa518fe27357200fa26fa66d5a55426986deb5f))
* **memory:** five protocol borrows with existing checkers as hooks (retrieval Phase 3) ([9405ad1](https://github.com/event4u-app/agent-config/commit/9405ad169785cc0a8da20b5c390436b47c38425e))
* **lexical:** term-coverage squaring in BM25 score (retrieval Phase 1) ([2beff15](https://github.com/event4u-app/agent-config/commit/2beff157a6b983d0b414f8521c552ac49be606a2))
* **council:** Phase 1 — option-level stance-tally foundation (default-off) ([6852c40](https://github.com/event4u-app/agent-config/commit/6852c4080f5ca40514150a0e52491ac751b330e1))
* **council:** Phase 0 — claims hygiene + verdict falsifiability ([c65885e](https://github.com/event4u-app/agent-config/commit/c65885e4bf3220fd32dabec53b706e682d8dfb67))
* **worktree:** optional env-bootstrap stand-up convention (harness P1) ([b80e197](https://github.com/event4u-app/agent-config/commit/b80e1972ffe349feb98535b3e22c4dd8e919c454))
* **bench:** spend-gate + claim re-scoping to the fixture corpus (Phases 3-4) ([52e0beb](https://github.com/event4u-app/agent-config/commit/52e0beb1486b6dbcd320324be5c9547c18f761b1))
* **doctor:** humanizer-runtime check + step-4b fallback proof (Phase 2) ([f615ec6](https://github.com/event4u-app/agent-config/commit/f615ec6bea86138fec39f06cab46c8427974bb7f))
* **humanizer:** untrusted-input handling on the ingestion path (Phase 1) ([902f9a4](https://github.com/event4u-app/agent-config/commit/902f9a4d83f67422dd7f47f0f14ed236bf99874b))
* **design-fidelity:** no-unrequested-filler line + live-app-judge candidate ([ca57cc5](https://github.com/event4u-app/agent-config/commit/ca57cc53ee817fecef06277da38df26e1f6fc6ff))
* **design-review:** canonical 6-state checklist + serial-audit decision ([a80de67](https://github.com/event4u-app/agent-config/commit/a80de67f84b7905b56a8bde5815b392ccfcda550))
* **design:** consolidate slop-trope canon into one cited catalog ([dfe7f42](https://github.com/event4u-app/agent-config/commit/dfe7f42e9b9c026710a24ea4d0077ef05da01863))
* **orchestration:** form gate, dispatch_mode telemetry, live-app judge mode, read-only knowledge attach ([8bf5990](https://github.com/event4u-app/agent-config/commit/8bf5990cfac3c445dd7e4cc6035f7f92953f3c73))
* **subagents:** fleet hardening — prompt-defense preamble, claim witness sweep, originality shingles, hook-resilience shim ([ea40a54](https://github.com/event4u-app/agent-config/commit/ea40a54e62653843d82a288349ef7b7dc04d62a6))
* **bench:** humanizer paired eval — corpus to 20 pairs, claim backed ([28dda19](https://github.com/event4u-app/agent-config/commit/28dda1942964841604d8ef148938c36dc209f4b0))
* **commands:** /humanize — on-demand AI-tell removal cluster ([eb545e5](https://github.com/event4u-app/agent-config/commit/eb545e58367e8b0c8c0f8d6446409b4e207604f0))
* **contracts:** write-engine step 4b — humanize audit ([29a1b9a](https://github.com/event4u-app/agent-config/commit/29a1b9a7f9114929f3db10a7cc006969be16d35c))
* **skills:** humanizer skill — two-phase, deliverable-scoped ([489a143](https://github.com/event4u-app/agent-config/commit/489a14325c09aa3faf58d9d75ff9375146d43d61))
* **scripts:** deterministic AI-tell detector with fixture corpus ([ae48a99](https://github.com/event4u-app/agent-config/commit/ae48a99d9dd8d0a6943f063901bd893b383cde38))
* **flow-learnings:** real org fleet run green → close the roadmap ([71953fe](https://github.com/event4u-app/agent-config/commit/71953fe807152bab6b1492b3d5a977615438ae1a))
* **knowledge:** flip global sharing default ON per ADR-119 (council-validated) ([be3f603](https://github.com/event4u-app/agent-config/commit/be3f6032640e40715e3a7c1ec145fe2508707501))
* **token-saving:** Phase-0 quality gate measured — thin projection FAILS (does not ship) ([b362fa6](https://github.com/event4u-app/agent-config/commit/b362fa65369dab7209d6b9a8db98e705a8ac41a8))
* **roadmaps:** add road-to-opt-* cluster from whole-package optimization sweep ([9688082](https://github.com/event4u-app/agent-config/commit/9688082a606a60879dc92aa29f5f575d23bc5a07))
* **golden-set:** complete the consumer-scope corpus (council-labelled) + close golden-set-coverage ([fc6c120](https://github.com/event4u-app/agent-config/commit/fc6c120bb777182140f7ffc8fe905560179e9bff))
* **domain-soundness:** ratify the validated count + close the roadmap ([c93f8bf](https://github.com/event4u-app/agent-config/commit/c93f8bf8e3dda437732024b65983aa68a09e76d4))
* **orchestration:** deterministic parallelizable-classifier corpus recall (+regression test) ([7d78284](https://github.com/event4u-app/agent-config/commit/7d78284c25dd94068a45250dd66b21b331ce53f0))
* **subagent-value:** verify orchestration telemetry pipeline end-to-end (Phase 1 Step 1) ([a0158e5](https://github.com/event4u-app/agent-config/commit/a0158e5f55a86e65db1fc72508fd270e72f4f2d9))
* **orchestration-scope:** pre-register the falsifiable dispatch claim (Phase 1) ([1449f6c](https://github.com/event4u-app/agent-config/commit/1449f6c5bcb8d5efca87779a676fd9f10baf5f7b))
* **evals:** weekly live trigger-eval pass-rate rotation in cross-model canary (ADR-118 §4) ([209c3fd](https://github.com/event4u-app/agent-config/commit/209c3fdf99fccd1cf2a8fa18d6c0b72cb2115bd9))
* **flow-learnings:** record the live two-host matrix run (HONEST-NULL) + resolve the blocker ([4ad8c51](https://github.com/event4u-app/agent-config/commit/4ad8c51334fde4d54f09f4cfb39155e681aad4ed))
* **release-ops:** leg manifest, bus-factor NEUTRAL state, growth ratchet, Primary-Goal ([0e70da1](https://github.com/event4u-app/agent-config/commit/0e70da15419b2a6d81f9f8aca9295448ea33ff91))
* **worktree:** deterministic cleanup gates + 8-row edge-case matrix ([884c230](https://github.com/event4u-app/agent-config/commit/884c230f870be07b81a5866c85b4077e000b1b2e))
* **evals:** priority-tier eval floor + two golden E2E evals ([7711ffe](https://github.com/event4u-app/agent-config/commit/7711ffe098ad3edce826a0e72f359619faadeb16))
* **invariants:** documented change process for protected kernel strings ([dfb0e61](https://github.com/event4u-app/agent-config/commit/dfb0e6107d9f88246dcccd7716ffa2e98e9450be))
* **rules:** code-comment-discipline — why-only comments, no signature-mirroring docblocks ([055a565](https://github.com/event4u-app/agent-config/commit/055a565a622536a318c8c0de3c3b2869ebfb198c))
* **discipline-profile:** dispose of the full tier via council; park roadmap in later/ ([c03b21a](https://github.com/event4u-app/agent-config/commit/c03b21a85086fcb403d3e52b8147b5a56c4cea3f))

### Bug Fixes

* **hashes:** recondense the 7 commands whose assembled output my skill edits changed ([baa2afd](https://github.com/event4u-app/agent-config/commit/baa2afdd7b5641d6808fd65ba9342f0fba4300be))
* **proof:** regenerate docs/proof.md after CLAIMS skill-count edit ([7e82690](https://github.com/event4u-app/agent-config/commit/7e826902a8fd47617a992e01be43b3947f2c3618))
* **ai-council:** extract anthropic/gemini CLI default model constants ([850f465](https://github.com/event4u-app/agent-config/commit/850f4652b9caada116399bcc97ad67baaa5fec13))
* **ai-council:** pin codex CLI default model as a named constant ([606f9ef](https://github.com/event4u-app/agent-config/commit/606f9ef45b44fe47c73f78105806bdba6df4ea00))
* **index:** regenerate index.md + catalog.md after humanizer/humanize landed ([993ef76](https://github.com/event4u-app/agent-config/commit/993ef7626729b9989d8febf782578cd18f75e93d))
* **roadmaps:** break `x` skill ref pattern for the not-yet-built evaluate-llm-feature ([245f02b](https://github.com/event4u-app/agent-config/commit/245f02b26c3c03474f42bad8b07b6cce2ccc7c68))
* **contexts:** correct decision-revisit-gate link in the telegraph-tension note ([2711db0](https://github.com/event4u-app/agent-config/commit/2711db0acd2131f8df562fe31dacaeebc9c3802a))
* **ci:** classify /humanize in surface-map flow coverage ([aef3224](https://github.com/event4u-app/agent-config/commit/aef322460a0e0b45b604c5accf55a218790c9d49))
* **discovery:** skip _-prefixed subagent partials in strict manifest build ([dd943d6](https://github.com/event4u-app/agent-config/commit/dd943d64a73df659bd985e0e807181397ab416e6))
* **ci:** humanize command visibility internal (tier-2 contract) ([b715105](https://github.com/event4u-app/agent-config/commit/b71510564fcf6f8e3754f84356a9786cd84e164a))
* **ci:** eslint no-console + unused import; humanize visibility enum ([735eb03](https://github.com/event4u-app/agent-config/commit/735eb034c3e626d2d53bad440c881e4660d2a1f3))
* **legal:** reflow forbidden-language examples onto marker-carrying lines ([d3496b9](https://github.com/event4u-app/agent-config/commit/d3496b91805d16ae07def730669182eeeb15ba25))
* **neutrality:** framework-leakage allowlist 104 -> 14 via linter upgrades + 25 neutralizations + 2 carve-outs ([0f04776](https://github.com/event4u-app/agent-config/commit/0f047762a28067f0422601e417bbb87af88b892c))
* **install:** rebuild bundle with local node_modules (path-comment drift) ([ce3d845](https://github.com/event4u-app/agent-config/commit/ce3d8456e58d9e09da7c73282b538dc46fe91040))
* **self-review-gate:** never fail CI on missing key / no credit — wrap the live path ([8005839](https://github.com/event4u-app/agent-config/commit/8005839fc1c7447fa91d80cf30b2ed29f66b0a0a))
* **roadmaps:** close the two transcript-audit gaps ([e3bc430](https://github.com/event4u-app/agent-config/commit/e3bc430aba27fe88b70db0a016a4e19bac9b2e92))
* **roadmaps:** review nits — benchmark scope precision, SHA-rule semantics, resolve verified borrow ([b0ed571](https://github.com/event4u-app/agent-config/commit/b0ed5712e1ef92b7e4084d657dba5ebb2236ba3d))
* **roadmaps:** review corrections — SHA-pinned verification, drop landed scope, fix numbers ([14025ce](https://github.com/event4u-app/agent-config/commit/14025cef2c6aee1a058f7ad3048f580cd9ce667f))
* **install:** ship the missing dist/install/rule_scope.js (stop-hook crash) ([4222081](https://github.com/event4u-app/agent-config/commit/422208190e9bc4a56cc82baa795127224e8c1b65))
* **rules:** wire code-comment-discipline into router, counts, and settings schema ([ffa88e5](https://github.com/event4u-app/agent-config/commit/ffa88e546335b1832a82cc7cb9067845b09bb441))
* **proof:** compute the coverage paragraph live from computeCoverage() ([dfa77e9](https://github.com/event4u-app/agent-config/commit/dfa77e9c6e180d21be0b86afa555f53c8f79619d))
* **install:** rebuild install bundle with worktree-local module paths ([5933bf1](https://github.com/event4u-app/agent-config/commit/5933bf1a9b9b46baf5b38f860bdee020c8b4a2dc))

### Documentation

* **roadmap:** flip the chairman-dispatch + estimate-row steps ([a2faf9d](https://github.com/event4u-app/agent-config/commit/a2faf9dc576a14c984ffc23daf9c083166254a0c))
* **roadmap:** flip the stance-tally wiring steps (Phase 1 integration live) ([3117878](https://github.com/event4u-app/agent-config/commit/31178781106a3fc0a31c3710ee42e9b7037b50ad))
* **roadmap:** fix broken ref — name upstream plugin files without local-path form ([7dec6df](https://github.com/event4u-app/agent-config/commit/7dec6dfdabefd4abe9edcf4244215a3827dcb2de))
* **roadmap:** resolve contested-design-council-pass with council notes ([1fd6dff](https://github.com/event4u-app/agent-config/commit/1fd6dff6f1f4f3a2080ae3c1531515bee231f34d))
* **roadmap:** add team-mode roadmap (govern the official cross-model pair) ([a185db0](https://github.com/event4u-app/agent-config/commit/a185db0de5440923cc4045cb49f25fd29dbe832d))
* **ai-council:** document council vs team-mode boundary ([af7ffeb](https://github.com/event4u-app/agent-config/commit/af7ffeb9bf32a06dea1ee5439fc9f8d9cfca363e))
* **readme:** drop artefact counts from prose — badges carry the numbers ([4ea0f47](https://github.com/event4u-app/agent-config/commit/4ea0f47c5be35554d8c40b214492bfe7ccff93f8))
* **design:** measurement-unblock design prep + un-park (runs gated) ([72f618a](https://github.com/event4u-app/agent-config/commit/72f618acbadd61a56fa65b0939bf3c87d57f3269))
* **roadmaps:** reconcile parallel-exploration depth into the harvest cluster ([aa50574](https://github.com/event4u-app/agent-config/commit/aa505749a625b0be321982313e435cfbfe27b0c3))
* **roadmaps:** second-sweep harvest — review, workflow, quality-gates + coverage ([d2258ed](https://github.com/event4u-app/agent-config/commit/d2258ed5dc61c796091eaa8751ba92f500f4804a))
* **roadmaps:** add ecosystem-harvest roadmap set from external skill survey ([d5bed31](https://github.com/event4u-app/agent-config/commit/d5bed315a458ee9e8ba98af4a4ec62308e069d88))
* **roadmaps:** close + archive humanizer-hardening (21/21) ([1ad6813](https://github.com/event4u-app/agent-config/commit/1ad681324ac25109c8590ca7b0b45090ff91ef55))
* **roadmaps:** humanizer-hardening follow-up from parent review ([f69621e](https://github.com/event4u-app/agent-config/commit/f69621e6ebbb665da15420ed3c8567f8c1c004f5))
* **roadmaps:** humanized-writing adoption roadmap (council-decided) ([464a66c](https://github.com/event4u-app/agent-config/commit/464a66c0ae48abc82a951ea8201580f6eab27474))
* **roadmap:** road-to-loop-engineering executed and archived ([ccad788](https://github.com/event4u-app/agent-config/commit/ccad788bb78b84346abf811119eecf923cb21501))
* **adr:** ADR-118 loop-engineering boundaries — one closure, four rejections, zero new loop surfaces ([c27ba0c](https://github.com/event4u-app/agent-config/commit/c27ba0cee1295f7a88e231e1a458c35efba13c70))
* **telemetry:** operationalize first_pass_success / escalated — zero schema change ([dfc8a64](https://github.com/event4u-app/agent-config/commit/dfc8a646a62b1cc03876d53f687d2673dff44d25))

### Refactoring

* **rules:** thin-stub the five heaviest auto-rules (-5,652 eager tokens) ([6ef4102](https://github.com/event4u-app/agent-config/commit/6ef4102d6448cf5a37f3e1555b33299ebd75c907))

### Tests

* **humanizer:** lock scan-what-you-ingest invariant + spend-gate no-network ([117a703](https://github.com/event4u-app/agent-config/commit/117a7039b6ad6496d787ac44d9d61f02f7b35351))
* **subagents:** exclude _-prefixed partials from wedge coverage ([f117d38](https://github.com/event4u-app/agent-config/commit/f117d3893c2ae83219d202c4139933a71b539bcb))

### Chores

* **condense:** refresh folded condensation hashes for 11 dependents ([701d588](https://github.com/event4u-app/agent-config/commit/701d588962f1ee807689820318e9a6fe82988892))
* **skills:** clear three chronic skill-lint warnings ([c6c62af](https://github.com/event4u-app/agent-config/commit/c6c62af0162a723fbc083cbe3e1979b1ff2fa3a6))
* **roadmap:** council-deliberation Phase 2-3 continuation (default-off, dispatch gated) ([197ce1b](https://github.com/event4u-app/agent-config/commit/197ce1b368b5ab11b0b55d1a38cddf5d70561ac7))
* ignore fleet ([6b7a381](https://github.com/event4u-app/agent-config/commit/6b7a3816136541f6f31e59f25d465b74154f86dd))
* **roadmap:** un-park retrieval-and-memory (Phases 1/3/4 + Phase-2 κ) + hashes ([979de16](https://github.com/event4u-app/agent-config/commit/979de160ef90c062d994ba0398adfa9eff345da6))
* **roadmap:** un-park council-deliberation (Phase 0 done, Phase 1 foundation) + hashes ([a56bee6](https://github.com/event4u-app/agent-config/commit/a56bee6e4b507c6271f69bde2ca2842e6483309b))
* **roadmap:** resolve harness-discipline P5 (route to council) + archive ([83952cf](https://github.com/event4u-app/agent-config/commit/83952cfdffeb69f9d995a4fc373c4e8c4bad5073))
* **roadmap:** un-park harness-discipline (Phases 1-4 done, P5 open) + hashes ([16127fa](https://github.com/event4u-app/agent-config/commit/16127fa1883786c676dda3b7934c32aceb608f96))
* **roadmap:** archive road-to-opt-design-polish + refresh condensation hashes ([c57932d](https://github.com/event4u-app/agent-config/commit/c57932dc266ea67ffff0b38fa1e95df8a96699b1))
* regenerate wedge doc + meta catalog after prompt-defense/orchestration edits ([28b87fd](https://github.com/event4u-app/agent-config/commit/28b87fdda66e0447dcc52be4e4737381d4a4490b))
* refresh condensation hashes for subagent-orchestration dependents ([6c1f61d](https://github.com/event4u-app/agent-config/commit/6c1f61d5639d904a512aac87f00f272f8acef715))
* **proof:** regenerate docs/proof.md after CLAIMS.md humanizer entry ([9c6099e](https://github.com/event4u-app/agent-config/commit/9c6099e4627e3d46ec0af7c3025051af168552fd))
* **roadmaps:** archive completed humanized-writing roadmap ([6892409](https://github.com/event4u-app/agent-config/commit/6892409d27e9346f3bcaf90b29b7ca46fc31748c))
* **hygiene:** reports retention convention, reference justification, orphan sweep, roadmap closure ([eb2b98e](https://github.com/event4u-app/agent-config/commit/eb2b98e0b1ccfd965efa073f640e8ec125946b1b))
* **roadmaps:** AI-council re-scope of the token/measurement cluster after the thin-null ([74120fd](https://github.com/event4u-app/agent-config/commit/74120fd15ed549f18494d2cddd529200f0653aa6))
* **adr:** decision-flips hygiene — ADR-092 addendum, corpus repairs, stale-prose fixes ([e405190](https://github.com/event4u-app/agent-config/commit/e405190dc0620bb7f859c442033d31a082ac6204))
* **token-saving:** reality-sync 2 verified-met acceptance criteria (Phase 5 + Phase 10) ([faea1de](https://github.com/event4u-app/agent-config/commit/faea1ded3e7bdc81697a562ad7bcbe0d194160c9))
* **roadmaps:** execute road-to-opt-portfolio-consolidation (process-full) ([c54ea39](https://github.com/event4u-app/agent-config/commit/c54ea39984dc436e14be0a743e60f7d82b435687))
* **request-scoped:** record the held-quality gate as evidence-RED (thin failed), no further spend ([7642c13](https://github.com/event4u-app/agent-config/commit/7642c131ba3c70b20ae0c24447f911f4dc8b8149))
* **roadmaps:** park the road-to-opt-* cluster in later/ (maintainer decision) ([9a027fe](https://github.com/event4u-app/agent-config/commit/9a027fe8cdd7d68dfc3636ccac652771adc9b463))
* modify domain soundness ([b51eb29](https://github.com/event4u-app/agent-config/commit/b51eb29dbaa4d3ad2c7af13c32df8cfa0347c276))
* **gitignore:** re-ignore dist/install/*_cli.js tsc byproducts ([e5913ef](https://github.com/event4u-app/agent-config/commit/e5913ef0404ee99c9c337b404882616f25edb763))
* **packs:** regenerate engineering-base manifest for code-comment-discipline ([3973c47](https://github.com/event4u-app/agent-config/commit/3973c47651a60a617363786a13b899b752a01f1c))
* **proof:** regenerate proof.md for the new unbacked claim (build-proof-check) ([7cbe82f](https://github.com/event4u-app/agent-config/commit/7cbe82fa828335e78b33cbb7b7c94c7472434440))
* **roadmap:** fable-feedback-5 — executed and archived in its own PR ([e106f40](https://github.com/event4u-app/agent-config/commit/e106f40dfe0174f1678f7b8f5a13a2d3859b6d53))
* **flow-learnings:** commit the bench matrix run-config + concretize the live-run blocker ([318739c](https://github.com/event4u-app/agent-config/commit/318739c0ef10a79efe899052780340a646797567))

Tests: 7379 (+167 since 8.10.0)

## [8.10.0](https://github.com/event4u-app/agent-config/compare/8.9.0...8.10.0) (2026-07-10)

### Features

* **bus-factor:** dogfooded self-review gate (advisory, inert without secret) ([f5afbca](https://github.com/event4u-app/agent-config/commit/f5afbca154e5a62fff7c3f3a3409334457a05e84))
* **domain-soundness:** author 4 rubric-target domain-truth fixtures (candidates) ([b391a0c](https://github.com/event4u-app/agent-config/commit/b391a0cf13051946ea9b024b68353e6c9a31c124))
* **evals:** skill-eval-coverage — default-surface set (29 evals) + close + archive ([119328e](https://github.com/event4u-app/agent-config/commit/119328e62410573561c09e6a4076adeece167b3f))
* **evals:** skill-eval-coverage — behavioural evals for the rich + router sets ([84f066e](https://github.com/event4u-app/agent-config/commit/84f066eb9131310dc0ce3526162565dd3f3cc7ac))
* **quality:** frontier-quality-operating-system Phases 3–8 — close + archive ([e75d52d](https://github.com/event4u-app/agent-config/commit/e75d52d29787f8dcfcdc7a321df6221e3cb252ec))
* **testing:** wire mandatory case discovery into TDD, /tests create, stack skills ([d2e9ec5](https://github.com/event4u-app/agent-config/commit/d2e9ec565419fa4166ff04e6b43039226fab8bde))
* **skill:** add test-case-discovery — enumerate-before-write coverage funnel ([6dc2e76](https://github.com/event4u-app/agent-config/commit/6dc2e76dadc7188c8e64e49e04f7c1fd21d64288))
* **quality:** frontier-quality-operating-system Phases 1+2 — mechanism matrix + eval-harness spine ([92ad083](https://github.com/event4u-app/agent-config/commit/92ad083a6ce7cd33bfdbc36f04b500b0f0594f56))
* **work:** consumer-flow intake wiring + retrieval quality metrics ([1ca3b7d](https://github.com/event4u-app/agent-config/commit/1ca3b7d9535b5d49f5d61011a92366ca762cf763))
* **worktree:** governed worktree layer — skill + /worktree:* thin cluster ([e662249](https://github.com/event4u-app/agent-config/commit/e6622494f5f5d8f00337bf93a3ac750defcc69e1))
* **telemetry:** delegation quality pair — first_pass_success + escalated ([ded001f](https://github.com/event4u-app/agent-config/commit/ded001f22e4d4eb70a0f4318f47d2aa4323ede58))
* **sizing:** release-sizing contract + CHANGELOG Rollback: gate ([e591098](https://github.com/event4u-app/agent-config/commit/e591098665eb10561e55b064a1f99e29f3c649e4))
* **invariants:** kernel semantic-invariant gate (guards lost-merge-content class) ([59c58d5](https://github.com/event4u-app/agent-config/commit/59c58d5995a4127ebae82ea2fd48109ac508928f))
* **surface:** surface-specific-agent-contracts Phases 2+3 — close + archive ([4899010](https://github.com/event4u-app/agent-config/commit/489901079c538a04f39d293f747fac9040e981f7))
* **release-gate:** pack-based consumer matrix, release-adjacent dry-runs, red-workflow tripwire ([3742c9a](https://github.com/event4u-app/agent-config/commit/3742c9a8f290156f9696f51f51cf981f49ba97be))
* **surface:** surface-specific-agent-contracts Phases 0/1/4/5/6/7 — backbone + fixtures ([9bff235](https://github.com/event4u-app/agent-config/commit/9bff2351b2e28703033084be0bf3541458731ea7))
* **design:** design-artifact-fidelity Phases 5–7 + close + archive ([d92355a](https://github.com/event4u-app/agent-config/commit/d92355ac333d429803270219f1b8d1a4d24f6a85))
* **design:** design-artifact-fidelity Phase 4 — variation & canvas planning ([b1ae817](https://github.com/event4u-app/agent-config/commit/b1ae817d3a76c9cc859f206a28278b29c9795778))
* **design:** design-artifact-fidelity Phase 3 — surgical edit preservation ([065fd17](https://github.com/event4u-app/agent-config/commit/065fd1712f6256a662f0073f828491f8b0bc3433))
* **design:** design-artifact-fidelity Phase 2 — resource-first context gate ([4a40217](https://github.com/event4u-app/agent-config/commit/4a40217e6f86b3d6a5b8f3e25cceeaeea10b550a))
* **design:** design-artifact-fidelity Phase 1 — lifecycle contract ([1256d47](https://github.com/event4u-app/agent-config/commit/1256d47e94f5a3c874b726e6b24045aca6f74513))

### Bug Fixes

* **ci:** heal post-merge reds — portability literal, ranking regression, proof drift ([319a2f8](https://github.com/event4u-app/agent-config/commit/319a2f82e67fd2c498a113a627df9ae77871b327))
* **skill:** playwright-testing — add run-verification note (clears skill_linter warnings) ([68db2b6](https://github.com/event4u-app/agent-config/commit/68db2b629a2689926fc6befdcdd944ea006e4652))

### Chores

* regenerate docs/proof.md — skill-count claim 269 → 270 ([0ec4c58](https://github.com/event4u-app/agent-config/commit/0ec4c5831941aa95b55613bb2c1ffe61c8724ab3))
* **roadmap:** close + archive command-structure-optimization (deferred items → later/ follow-up) ([fa9a1b7](https://github.com/event4u-app/agent-config/commit/fa9a1b71e4623f4138123299b3fbbf5179d7eb68))
* regenerate counts, pack manifests, condensation hashes ([1ba1a86](https://github.com/event4u-app/agent-config/commit/1ba1a863de5e52e139ca1283ef36f252672f7ba5))
* fix command-count badges to 177 (counts-update missed hero badge + browse line) ([4d6551d](https://github.com/event4u-app/agent-config/commit/4d6551d14c80e936135125cdb98476b6fb575913))
* sync counts, manifests, projections, dashboards; archive completed roadmap ([5178af3](https://github.com/event4u-app/agent-config/commit/5178af3bd66dffb1071607e03b0551a2c5e74d01))

Tests: 7212 (+24 since 8.9.0)

## [8.9.0](https://github.com/event4u-app/agent-config/compare/8.8.0...8.9.0) (2026-07-10)

### Features

* **rules:** simplicity-first bans, own-orphan cleanup, goal-driven execution ([3e4de80](https://github.com/event4u-app/agent-config/commit/3e4de80f9d1f7ece41162503fbcd6309620bf331))
* **design:** design-artifact-fidelity Phase 0 — verification capability + eval baseline ([da9ff3a](https://github.com/event4u-app/agent-config/commit/da9ff3a41381e6ce0e749a74fd499de28b3ee7ea))
* **kernel:** re-land direct-answers no-duration + never-cite-the-rule (#844 content lost from main) ([2c46e7f](https://github.com/event4u-app/agent-config/commit/2c46e7f3b194ad2179b92307939d588cdb3971f3))
* **lint:** fail skills that claim a Claude Code built-in name ([4c0cd39](https://github.com/event4u-app/agent-config/commit/4c0cd39b9a0bf604e436bbc80327b0bddf26b9e3))
* **install:** withhold Claude Code built-in names from /name projections ([6dcba71](https://github.com/event4u-app/agent-config/commit/6dcba71bc2e5660a00c3dd7106ece65754c71633))
* **kernel:** re-land action-authority sharpening (#840 content lost from main) ([13f244c](https://github.com/event4u-app/agent-config/commit/13f244c9bcb5d92641e5c87e3964c5d4212c8b46))
* **domain-soundness:** deterministic domain-truth fixtures + scorer + candidate run ([dfb27a2](https://github.com/event4u-app/agent-config/commit/dfb27a2e8f1871f436bac19446d76c569f33e3c6))
* **execution:** amend-trap, tool-tier ladder, disconfirmation search, anti-over-engineering, authoring guidelines (P2-P6) ([2e7d4d2](https://github.com/event4u-app/agent-config/commit/2e7d4d2a6210672289a50441295f84e21f4f442a))
* **design:** same-ramp contrast, componentization threshold, async-verifier, handoff template (P3/P4/P5) ([be49527](https://github.com/event4u-app/agent-config/commit/be49527050f235d9396c14f2fe077c3c38209798))
* **design:** diagram-type routing + geometric pre-checks + embedded register (P1/P2/P4) ([32947b8](https://github.com/event4u-app/agent-config/commit/32947b8a63abc464edeec399929b3f5605b19ddb))
* **handoff:** verbatim-first lossless template in agent-handoff (P4) ([76a5455](https://github.com/event4u-app/agent-config/commit/76a54557fb5c366b31b72e67d726a105de9e7a74))
* **memory:** save-successes + reference-shape + verify-then-repair + derivability (P2/P3) ([d4c6e81](https://github.com/event4u-app/agent-config/commit/d4c6e810df365c8990ef9cf75f0289f970eb4a9a))
* **orchestration:** worker-prompt contract in subagent-orchestration (P1) ([ba65867](https://github.com/event4u-app/agent-config/commit/ba65867f28273b97c16e7799a7c68d00bc16fccd))
* **memory:** hostile-input write-guards at persist-time (P3) ([e08287b](https://github.com/event4u-app/agent-config/commit/e08287b663a56b4f6e85d0295f6229ca59cb77da))
* **security:** found-instructions quarantine + injection-signal taxonomy (P1/P2) ([446909a](https://github.com/event4u-app/agent-config/commit/446909a007c2f7dbffee14adf32fc6cdcef9504e))
* **lint:** cover human-gate phase headings and exit criteria; sharpen step patterns ([68c8738](https://github.com/event4u-app/agent-config/commit/68c8738d1ee10d5b433de02eaaaf3bf3f836b826))
* **lint:** warn on human-gate checkbox steps in roadmap complexity lint ([64c5f6c](https://github.com/event4u-app/agent-config/commit/64c5f6cbbe5be69eaf4d84c523b6b6935a351ed9))
* **knowledge:** document slicer (B8) + external code-graph interop rule (B9) ([c09bcb9](https://github.com/event4u-app/agent-config/commit/c09bcb994577f2ed87a19b7e11b617708bf60561))
* **memory:** seed the curated corpus from the maintainer memory index ([2422f51](https://github.com/event4u-app/agent-config/commit/2422f51e4f07d5ab2b55ab5c9bf74b5950513957))
* **bench:** self-measuring benchmark command + Cohen's Kappa judge (B7) ([58b9687](https://github.com/event4u-app/agent-config/commit/58b96878931ef976dce92dc333a966021d3b8e08))
* **discovery:** stat-index primitive + lazy graph rebuild skip (B5a) ([04c34c6](https://github.com/event4u-app/agent-config/commit/04c34c65bc0b08331a9d8d2a1a9fae7ee20102c6))
* **discovery:** artefact relation-graph + `affected`/`explain` verbs (B4) ([d9ffe0b](https://github.com/event4u-app/agent-config/commit/d9ffe0bff5f8326f4e077c9b27b7f604180d8242))
* **memory:** merge learning-sidecar verdicts into retrieve() output (B3) ([46ddf98](https://github.com/event4u-app/agent-config/commit/46ddf98e915db50e6c4b75ef5dcf5ebc13b7c721))
* **memory:** learning-sidecar aggregator — decay + corroboration + dead-ends (B3) ([11fc4a2](https://github.com/event4u-app/agent-config/commit/11fc4a28bf5e724eb09bf5eb07e66076ebfbc689))
* **memory:** activate the lexical index in retrieve() above the tripwire (B2) ([6d6dbe8](https://github.com/event4u-app/agent-config/commit/6d6dbe8ae8153868c33fe6f867b953ceae375158))
* **memory:** measure lexical ranking lift — the B2 ship-gate (proven) ([9f4feb9](https://github.com/event4u-app/agent-config/commit/9f4feb923a30f0462362ef1ae25cd3d482225247))
* **memory:** add hand-rolled BM25 + trigram lexical index (B2) ([971c86e](https://github.com/event4u-app/agent-config/commit/971c86e982a7afc2ab28424195a7783f7ce1f1e9))
* **lint:** add versioned-cache gate (B5b) ([5bfe14a](https://github.com/event4u-app/agent-config/commit/5bfe14a78e07b9eac130ee3b8e835080752d1424))
* **memory:** add token_budget compact read surface to retrieve_v1 ([44b8c4c](https://github.com/event4u-app/agent-config/commit/44b8c4c8d6c4e014c5a1d91219fce57dfe60bfde))
* **security:** sanitize floor on retrieval read-surfaces (B6) ([07802d6](https://github.com/event4u-app/agent-config/commit/07802d69a8ab501435b965a5a6aa9bf86d2004f7))
* **orchestration:** modeled cost-% for the downshift rate win ([6a4ec50](https://github.com/event4u-app/agent-config/commit/6a4ec50350cf980fe17ba888957c37c615cc68ce))
* **hooks:** pre-push changed-TypeScript static pass (typecheck + lint) ([640b789](https://github.com/event4u-app/agent-config/commit/640b789c76a2ac1637fa50fe3917557b7789f2a5))
* **orchestration:** recorder that emits validated telemetry per dispatch ([12aa7b1](https://github.com/event4u-app/agent-config/commit/12aa7b131c7852734df85f920f079f5f1e01357b))
* **second-brain:** retrieval-precision harness + store + pinned report ([350e9b7](https://github.com/event4u-app/agent-config/commit/350e9b7a3534cd3030272113a06818b3e384a278))
* **security:** harden agentic-security rules + skills (Fable5 follow-ups) ([e6fdb23](https://github.com/event4u-app/agent-config/commit/e6fdb23bd919789374a3001a7c6d89170426907a))
* **second-brain:** paired-run harness + pinned PASS report (Phase 2) ([85c9898](https://github.com/event4u-app/agent-config/commit/85c9898bcef8dfb2439096e38531b5d904233eb8))

### Bug Fixes

* **roadmap:** accept dotted sub-phase ids in PHASE_RE ([aaa54c3](https://github.com/event4u-app/agent-config/commit/aaa54c3ab7060b3e300bac99788325848400f954))
* **skills:** mcp and code-review opt out of slash registration ([67d261a](https://github.com/event4u-app/agent-config/commit/67d261af0c06147ca3e771b3b6d57ceec34ede63))
* **roadmap:** live-verify PR merge state before any in-flight/merged claim ([54ae7b0](https://github.com/event4u-app/agent-config/commit/54ae7b063a0bd641a931db423264ed0b8a4452f7))
* **cli:** rename graph verb explain→graph-explain (collides with decision-chain explain); register verbs; recompile router ([8489858](https://github.com/event4u-app/agent-config/commit/84898580de0df92ec9f2f748d26c9a455c8c2468))
* **rules:** assign new rules to the `meta` pack, not `core` (strict discovery) ([2a4d118](https://github.com/event4u-app/agent-config/commit/2a4d118fbacaf167d5a005803ef90e9524a7c7b5))
* **roadmap:** harden /roadmap:process-full as law + add question-not-instruction rule ([b1eee65](https://github.com/event4u-app/agent-config/commit/b1eee65f0ff386b6461b72a39cae577b6582559f))
* **memory:** align check_memory KNOWN_TYPES with the five write-side types ([1905648](https://github.com/event4u-app/agent-config/commit/1905648dabdfb0680ea1cf610bf43e8f07abda32))
* **memory:** concrete summary type for measure_lexical_ranking (typecheck) ([475e7be](https://github.com/event4u-app/agent-config/commit/475e7be9af36b6fd7beff717502687f7a84a3e58))
* **memory:** drop unused import + regenerate proof.md (CI) ([e415eb6](https://github.com/event4u-app/agent-config/commit/e415eb6184b697f1bb667872d6f1b8d08dea1ce6))
* **second-brain:** restore proof § 3 heading + noUncheckedIndexedAccess guards ([b684a6c](https://github.com/event4u-app/agent-config/commit/b684a6cd1774dfd47d720d5be4cbe32ca854e213))
* **verify:** require a changed-files static pass before pushing source ([ba3a9b5](https://github.com/event4u-app/agent-config/commit/ba3a9b5f467c5e4621637297366a4e58f84059b2))
* **security:** post-review nits — through-line pack + FE-render greps + lint desc ([712a338](https://github.com/event4u-app/agent-config/commit/712a3389463453d01df19c421a310ed991a1fc9f))
* **ci:** pin publish-npm to npm 11 for Node 20 compat ([4c0ed33](https://github.com/event4u-app/agent-config/commit/4c0ed33af0229b53e423a863d9e6946a49d08868))

### Documentation

* **contracts:** document the reserved host-name floor ([7ef51e9](https://github.com/event4u-app/agent-config/commit/7ef51e99d913f1d0e3ce48dd8caefc8804612ea5))
* **roadmap:** flip execution-discipline non-kernel phases; counts + dashboard + hashes ([9da5da5](https://github.com/event4u-app/agent-config/commit/9da5da576c08f0eae3d7577079cd4f913a7f69ca))
* **design:** reference-over-vendor pointer + close design-mechanism harvest (P6) ([e41f45c](https://github.com/event4u-app/agent-config/commit/e41f45cdc1297a6fa4293836b5a7a5cbf43a1c00))
* **roadmap:** record drift-audit disposition (P5); flip + archive orchestration-memory harvest ([a6caca8](https://github.com/event4u-app/agent-config/commit/a6caca8cd5857be9a188ec5c704835e11921c16e))
* **roadmap:** blocker sweep per template rule 22 — resolve 7 non-gates, unblock ci-native Phase 1 ([fabbbc3](https://github.com/event4u-app/agent-config/commit/fabbbc320dd65be51dc552ff12bde628ee7402a6))
* **roadmap:** flip injection-authority Phases 1-3,5; sync hashes + dashboard ([0ca2310](https://github.com/event4u-app/agent-config/commit/0ca2310b0007c15f66ed4f95e5e1260b9b6b83be))
* **contracts:** draft injected-block authenticity model (P5, proposal only) ([0738dad](https://github.com/event4u-app/agent-config/commit/0738dad234ef545c40d0294fdc47b2b116f2c7aa))
* **roadmap:** separate external blockers from human gates; risk-based autonomous recommendation ([dc049e1](https://github.com/event4u-app/agent-config/commit/dc049e1fe68612367c576db9fae693abf04b1cc5))
* **roadmap:** autonomy-first authoring — human gates are the exception ([c007ac7](https://github.com/event4u-app/agent-config/commit/c007ac7db79184805d2815ff21da0c4ba7858402))
* **memory:** name the separator-recall limit in the retrieval scope + ADR-116 ([0c8a6f8](https://github.com/event4u-app/agent-config/commit/0c8a6f8a065347e8a6a4df8b08b319ce23a6f5b5))
* sync counts (+2 rules), CLAIMS/proof, archive completed roadmap ([101c801](https://github.com/event4u-app/agent-config/commit/101c8015532f258671af28934048bb4049e16ed4))
* **roadmap:** mark B3 display-merge done — Phase 3 complete ([3fa451a](https://github.com/event4u-app/agent-config/commit/3fa451aff07a9d1309e594614cef5cd1868b6e15))
* **roadmap:** mark B3 aggregator done (Phase 3 checkbox 1) ([43ba766](https://github.com/event4u-app/agent-config/commit/43ba76606659310d529cbb73b1ad1e1539f6e2fb))
* **roadmap:** mark B2 activation done — Phase 2 complete ([89f6ae4](https://github.com/event4u-app/agent-config/commit/89f6ae448123e8a633e4e9f990ca0bae442f045c))
* **memory:** record ADR-061 <-> FTS5 resolution for retrieval ranking (B2) ([0e54680](https://github.com/event4u-app/agent-config/commit/0e546807489e9e8c0c68e8db45fe661a8e3b1790))
* **roadmap:** resolve retrieval-substrate design council pass; promote to ready ([9194898](https://github.com/event4u-app/agent-config/commit/9194898cfa0b80f2c1bd5f4b3783eaec7337c037))
* **roadmap:** draft retrieval-substrate hardening (source-anonymous borrow) ([708ac89](https://github.com/event4u-app/agent-config/commit/708ac89d930301fbf9880e59908552d2e8b1d175))
* **orchestration:** document dispatch_tokens + session_tier telemetry fields ([f59562a](https://github.com/event4u-app/agent-config/commit/f59562a598c610a42a16fd1ced4dfa769eab2f15))
* **token-saving:** run the live thin-vs-eager judge — honest INCONCLUSIVE ([3ad161b](https://github.com/event4u-app/agent-config/commit/3ad161b104c1a037b22774738e9545f4b65cc0ca))
* **claims:** repoint hidden-instruction claim to the release gate ([a41815d](https://github.com/event4u-app/agent-config/commit/a41815db830ba90e5daaa512f6b55b6ee8be4f81))
* **orchestration:** wire the recorder into the emit procedure + delegation-policy ([69042ad](https://github.com/event4u-app/agent-config/commit/69042ad1568bd9e16a520e63c91744cd385567a1))
* **proof:** regenerate proof page for the new hidden-instruction claim ([45f5a7a](https://github.com/event4u-app/agent-config/commit/45f5a7a106c4c5c5b3b003ed3c3fd8e6be4f8425))
* **claims:** bind the hidden-instruction CI scan to the claims ledger ([55fe74e](https://github.com/event4u-app/agent-config/commit/55fe74ed2122959d465b9fcc4f2fc6daffd30445))
* **second-brain:** publish the retrieval-precision result across the surfaces ([3ee930a](https://github.com/event4u-app/agent-config/commit/3ee930a4bc61e3f1c01c7a02b204099f96042e2a))
* **frontier-quality:** Phase 0 metrics + provenance + contract + pilot proposal ([0e738fb](https://github.com/event4u-app/agent-config/commit/0e738fb32a4645f499055940e386295b265fdc8d))
* **second-brain:** publish the measured recall lift + decline the export ([8fbaeaf](https://github.com/event4u-app/agent-config/commit/8fbaeaf0fa8a361d9b469dad4d8046d677b4c9a7))

### Refactoring

* **skill:** extract topology hints from subagent-orchestration to context ([4918ef2](https://github.com/event4u-app/agent-config/commit/4918ef2372d7cb2c6e24a71ba9e3307946426899))

### Tests

* **memory:** land the Phase 0-pre substrate-validation foundations ([474df9a](https://github.com/event4u-app/agent-config/commit/474df9af95f8edd2ba10d6ba7ff88465a534d12d))

### CI

* **security:** fail-closed agent-security gate on the publish path ([f8934f7](https://github.com/event4u-app/agent-config/commit/f8934f739a4f27a11e3c0bd8df7c9943ddba519f))
* **second-brain:** wire the retrieval-precision dry-run into ci + ci-strict ([da4ec36](https://github.com/event4u-app/agent-config/commit/da4ec36e7c84765203864cb9f8e99e62aaf85e53))
* **security:** wire lint-agent-security into CI and scan dist/agent-src ([453095f](https://github.com/event4u-app/agent-config/commit/453095f28bcf9aaa9c9419872dc732571d9971e3))
* **consistency:** trigger required check on any workflow change ([e629624](https://github.com/event4u-app/agent-config/commit/e629624644e33fa1926c763f8b1a05c730c0fcdc))

### Chores

* **roadmap:** add + close road-to-simplicity-and-goal-discipline ([026bf11](https://github.com/event4u-app/agent-config/commit/026bf1159e9af14cee1f76ccfa240d7f7b7076f4))
* **roadmap:** close + archive execution-discipline-harvest (kernel content landed) ([49134d4](https://github.com/event4u-app/agent-config/commit/49134d4cb4178a7baa1cad8dbd38265b9c0d457f))
* **roadmap:** close + archive injection-and-authority-harvest (kernel content landed) ([810df58](https://github.com/event4u-app/agent-config/commit/810df58e7b7525b781f3cf5f93a1b651a85927fc))
* **install:** regenerate install bundle ([f167954](https://github.com/event4u-app/agent-config/commit/f1679547063d9cf6c9354c1d25d026f740445169))
* **condense:** refresh stale hash for commands/optimize/project.md ([fa9c0ec](https://github.com/event4u-app/agent-config/commit/fa9c0ecb57653a6157a1eacdc8eba2fd77a357c5))
* **condense:** project phases-4-7 rule/command/context edits into dist/agent-src ([7d727db](https://github.com/event4u-app/agent-config/commit/7d727db49522669d2aba3ac8e87cdbf5c9410898))
* **tasks:** unify task test to include the vitest suite ([e0ca766](https://github.com/event4u-app/agent-config/commit/e0ca766bc7a15ebf17347ac246257d57c04bf63f))
* **roadmap:** retrieval-substrate-hardening Phase 0 B6 done ([671f8d5](https://github.com/event4u-app/agent-config/commit/671f8d519a885bd93302d9962b3fc5c78469715a))
* **roadmap:** record the inconclusive live judge run on token-saving Phase 0 ([2356ec8](https://github.com/event4u-app/agent-config/commit/2356ec88527366fe6122fdaeb71e0ff1284f364c))
* **sync:** regenerate pack manifests after through-line pack move ([adde3de](https://github.com/event4u-app/agent-config/commit/adde3de8e94a7f03a6ebdc31e7837c0696b47209))
* **roadmap:** frontier-quality Phase 0 authored (proposal, checkpoint pending) ([0912362](https://github.com/event4u-app/agent-config/commit/0912362aedf6a90ae122ad1ea4f167e741c40dae))
* **roadmap:** close + archive second-brain-delta-proof (PASS) ([ec0909d](https://github.com/event4u-app/agent-config/commit/ec0909d78264d33e7ba71e6387ae553bd3494354))

Tests: 7188 (+161 since 8.8.0)
