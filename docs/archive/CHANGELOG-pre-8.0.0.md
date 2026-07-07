# Changelog Archive — pre-8.0.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `8.0.0`, split out of the main
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

## [7.5.0](https://github.com/event4u-app/agent-config/compare/7.4.0...7.5.0) (2026-06-29)

### Features

* **design-system-capture:** design-system.json import contract ([23fc06f](https://github.com/event4u-app/agent-config/commit/23fc06f44b77ab938929bcf47f92cf008c4dec26))
* **design-intelligence:** named design-canon grounding index ([1e0805e](https://github.com/event4u-app/agent-config/commit/1e0805eec2df4a46ec897d1593538811fc54cf8c))
* **react-shadcn-ui:** opt-in shadcn registry + MCP awareness ([26d1475](https://github.com/event4u-app/agent-config/commit/26d147516b20f7e5a26fa83fb39bce0f236dd57c))
* **design-intelligence:** taste dials, consistency locks + 4 detector rules ([42883dd](https://github.com/event4u-app/agent-config/commit/42883dd69575bbdb4e0a8fd7ffa915df15a58587))
* **design-review:** deterministic anti-slop detector + optional pre-edit hook ([5c77948](https://github.com/event4u-app/agent-config/commit/5c77948368d6a79e7848938c3ab8fe1f11ba9c25))
* **judges:** add judge-synthesis cross-judge aggregator; drop rubric:score (council) ([a0c3d12](https://github.com/event4u-app/agent-config/commit/a0c3d126a3b600bb32065543bddd13096d2b35a1))
* **token-saving:** mechanical slices — trim 15 at-cap skill descriptions + confirm/disposition steps ([06cb77d](https://github.com/event4u-app/agent-config/commit/06cb77dca0759c885b01b8d440482e49401daaa2))
* **security:** injection-defense pressure-corpus — confusables linter + defensive judge ([80abc16](https://github.com/event4u-app/agent-config/commit/80abc16ea78f4e4cbab52712a63831901e7b6851))
* **quality:** add judge-artifact-completeness skill with four rubric schemas ([ef0276a](https://github.com/event4u-app/agent-config/commit/ef0276ac0d8a72b60f4a1d85450bf0f42bfb5aa9))

### Bug Fixes

* **condense:** refresh stale commands/brand/tokens.md hash (pre-existing drift; sync-check-hashes) ([328a9a4](https://github.com/event4u-app/agent-config/commit/328a9a4b6af84280d8ea93b88a459aad22943ebe))
* **design-slop:** use .js import specifiers (tsc TS5097, Bundler resolution) ([8498f23](https://github.com/event4u-app/agent-config/commit/8498f2391b33d4d3171d6030984cef0d88eb382c))
* **design-slop-hook:** drop unused SLOP_RULES import (eslint no-unused-vars) ([6ef7465](https://github.com/event4u-app/agent-config/commit/6ef74652682b925138e8c585b9cffe7423baa457))
* **test:** satisfy noUncheckedIndexedAccess in judge_calibration guard ([1519880](https://github.com/event4u-app/agent-config/commit/15198806c5c4db33d21e337cd43bd7da8cd305ae))
* **judge-artifact-completeness:** shorten description to ≤200 chars (skill linter cap) ([053d07f](https://github.com/event4u-app/agent-config/commit/053d07f2024e4c5bc8d6b6fc031e0f1a47013112))
* **image-editing:** migrate triggers.json to queries[] format ([2ba21e0](https://github.com/event4u-app/agent-config/commit/2ba21e0ce492de29d6c1079863412095a85c5c2e))
* update agent_config_version pin in template to 7.4.0 ([9dc5b20](https://github.com/event4u-app/agent-config/commit/9dc5b2043c587a5e0288a93e3785d15e942bee67))
* **legal:** correct LEGAL_NOTICE.md relative path in legal-safety-floor rule ([2a03cef](https://github.com/event4u-app/agent-config/commit/2a03cef0af21ab4102d0a04962775cb6983b97a7))

### Documentation

* **roadmaps:** archive completed road-to-design-system-extraction-contract ([9698804](https://github.com/event4u-app/agent-config/commit/96988047bf92cb83d78618b941dbead5baecb595))
* bump guideline count 86→87 for design-canon.md (task sync) ([92cf710](https://github.com/event4u-app/agent-config/commit/92cf7109b231164a540eb2c38d4486c59a0ed597))
* **roadmaps:** archive completed road-to-design-canon-grounding ([0a5c010](https://github.com/event4u-app/agent-config/commit/0a5c010d972ecd239bfb586191263157f169aecc))
* **roadmaps:** archive completed road-to-shadcn-registry-awareness ([215e535](https://github.com/event4u-app/agent-config/commit/215e535f37e144caf63222b16f55ebdd68cb34ad))
* **roadmaps:** archive completed road-to-taste-dials-and-locks ([848dd4b](https://github.com/event4u-app/agent-config/commit/848dd4bbc66edce0c58491152a171c907dd0907d))
* **roadmaps:** design/taste harvest roadmaps + anti-slop-detector archive ([a7be86f](https://github.com/event4u-app/agent-config/commit/a7be86f578607173db41a4df1c8e684934d11907))

### Tests

* **judges:** deterministic calibration guard for the two evaluative judges ([41031c9](https://github.com/event4u-app/agent-config/commit/41031c9fe827e3e197f18879339e9b7d0f9d0768))
* **work_engine:** convert hooks_* parity rigs to python-free; drop _hooks_pyloader ([013b104](https://github.com/event4u-app/agent-config/commit/013b104c79fa65a4bb7f0d3cd7df15536fd63c98))
* **work_engine:** convert 4 directives parity rigs to python-free intent tests ([ad33470](https://github.com/event4u-app/agent-config/commit/ad334706c41ee164722f1c2ef46286bffc69dac6))

### Chores

* include pre-existing uncommitted files (bench report + frontmatter test) ([871b342](https://github.com/event4u-app/agent-config/commit/871b3424172626ac3c48bee1489637ffb049f767))
* re-anchor stale condensation hashes for 3 command files ([f6e24c6](https://github.com/event4u-app/agent-config/commit/f6e24c6f569ab9b058fa75806e18f759cffbea31))
* sync meta README with shortened judge-injection-defense description ([cb1de3d](https://github.com/event4u-app/agent-config/commit/cb1de3ddd2b127cea830d01f84c0d45ea5869494))
* sync src/domains/meta/README.md with updated skill description ([39be4e0](https://github.com/event4u-app/agent-config/commit/39be4e0daf6171bd7309d0e3c430e827c8278af6))
* regenerate agents/index.md and docs/catalog.md for new skill ([249518f](https://github.com/event4u-app/agent-config/commit/249518f3d5f3ac24567a9d81988f344aaa1d004f))

## [7.4.0](https://github.com/event4u-app/agent-config/compare/7.3.0...7.4.0) (2026-06-26)

### Features

* **bench:** thin-vs-eager quality-run producer (Phase 0 EXIT judge runner) ([0442fab](https://github.com/event4u-app/agent-config/commit/0442fab2004f09a5b2476a33c3393a157647082b))
* **ci:** activate the always-loaded budget gate with provisional token caps (Phase 8) ([1bd765c](https://github.com/event4u-app/agent-config/commit/1bd765c91d12707eed6bd277d35de36c96298005))
* **ci:** kernel-prefix byte-stability guard (token-saving Phase 5) ([90e2814](https://github.com/event4u-app/agent-config/commit/90e2814a10da9423be4851e50d1796b910ffd1fa))
* **hooks:** deterministic RTK-wrap PreToolUse nudge (default-off, warn-only) ([82db01d](https://github.com/event4u-app/agent-config/commit/82db01d60d52295c16e4ee14eb96efbb13442807))
* **rtk:** close the cli-output-handling trigger gap ([cc12c02](https://github.com/event4u-app/agent-config/commit/cc12c02cf115fc85bcd1989ab2d75252eb220684))
* **fix-pr-comments:** commit+push before replying, then resolve threads ([23ae60b](https://github.com/event4u-app/agent-config/commit/23ae60be884ecafbebadacffaf9c5c0dd552d0ec))
* **bench:** Phase 0 measurement rig — regression gates, golden set, latency + host probes ([5feb233](https://github.com/event4u-app/agent-config/commit/5feb2330abf557f65c8a929222dd12dc8e5d2537))
* **bench:** wire real tiktoken (cl100k_base) into the token-measurement path ([d92e5d2](https://github.com/event4u-app/agent-config/commit/d92e5d2f842e99d9e71800f6098ecf0c400088c7))
* **cli:** add read-only analyze-session post-session report ([8e3df94](https://github.com/event4u-app/agent-config/commit/8e3df9475b4dc54aae79f4c7518d10da1514bb24))

### Bug Fixes

* **hooks:** add hooks.rtk_wrap.enabled to the settings Zod schema ([4a34967](https://github.com/event4u-app/agent-config/commit/4a34967f7f72748b89199ec344cde897500903e1))
* **cli:** drop unused print helper in analyze-session ([e4c5cde](https://github.com/event4u-app/agent-config/commit/e4c5cdeb0510031a1a7f86ca5d468a525fc185b8))

### Documentation

* **roadmap:** token-saving Phase 10 — triage the backlog candidates ([036b3e6](https://github.com/event4u-app/agent-config/commit/036b3e6a121673be75a49671d865e7e7aaaa9f29))
* **roadmap:** token-saving Phase 8 — budget gate activated (elbow calibration deferred) ([8a9b3e3](https://github.com/event4u-app/agent-config/commit/8a9b3e3f9184e2e8efe0ff43d0420806b298f549))
* **roadmap:** token-saving Phase 5 — cache-aware ordering CI invariant ([00d7181](https://github.com/event4u-app/agent-config/commit/00d7181899cebda62b4efcee3450130756483fe3))
* **roadmap:** token-saving Phase 3 — RTK wrap hook landed ([b4d358f](https://github.com/event4u-app/agent-config/commit/b4d358f2eb7b8998e04f72b33c9f127db6a6358a))
* **roadmap:** token-saving Phase 1 premise correction + Phase 2 trigger gap done ([25b42f2](https://github.com/event4u-app/agent-config/commit/25b42f21a5c640f2665dec70e3190dcff4cfc584))
* **roadmap:** token-saving Phase 0 — rig landed (tokenizer/judge/latency/CI-gates) ([70ce1e5](https://github.com/event4u-app/agent-config/commit/70ce1e5e13db72046d350a51d0cde2af8c067b3c))
* **roadmap:** de-duplicate token-saving — human-measurement phases live only in later/ ([7394f21](https://github.com/event4u-app/agent-config/commit/7394f217b64c76e5f74a6195659c1aec17e69e24))
* **orchestration:** keep subagents.auto=ask (honest-null); re-gate flip on telemetry ([e5eed45](https://github.com/event4u-app/agent-config/commit/e5eed45ad5f3206871aa5eafab37cb9c101b2aa7))
* **roadmap:** archive completed session-analytics ([461d86f](https://github.com/event4u-app/agent-config/commit/461d86f7aad1be2216ccd81cdf65b8ef6f7fe6a9))
* **roadmap:** archive completed governance-moat; park cross-model eval in later/ ([b43893f](https://github.com/event4u-app/agent-config/commit/b43893fc6b060ddca285b6964087bff3fe0a02f0))
* **governance:** document the compile-time governance moat ([fcd455d](https://github.com/event4u-app/agent-config/commit/fcd455d22b076011cd0e3b3d669687f8a7bb196a))

## [7.3.0](https://github.com/event4u-app/agent-config/compare/7.2.0...7.3.0) (2026-06-25)

### Features

* **bench:** opt-in hardened arms for governance-enforcement eval ([af9a0e0](https://github.com/event4u-app/agent-config/commit/af9a0e07a2c2312f6b53782a8fcb44b2bde35635))
* **evals:** cross-model canary workflow + robust smoke (T-005) ([d062095](https://github.com/event4u-app/agent-config/commit/d06209535731d27446768442c081fcac151b3f20))
* **evals:** cross-model trigger smoke — SDK-free fetch routers + runner (Phase 0 T-004 keystone) ([1a8df9c](https://github.com/event4u-app/agent-config/commit/1a8df9cc83f2a9ace2e4a45eb9d66be6b51be5ae))
* **evals:** finding_floor assertion kind — deterministic count gate (Phase 1) ([7f0e9e6](https://github.com/event4u-app/agent-config/commit/7f0e9e617a741b1f778d9cacdde145ef4a300994))
* **evals:** graded negative-control discrimination primitive (Phase 0 T-003) ([5407121](https://github.com/event4u-app/agent-config/commit/54071210ecbfc8b6807fa37d726ea27654d22158))

### Bug Fixes

* **skills:** declare top-level skill field in bug-analyzer/code-review evals ([7c7f2e3](https://github.com/event4u-app/agent-config/commit/7c7f2e3adf181f2a1e936cb028538b3471e8f15e))
* **skill-linter:** accept finding_floor eval assertion kind ([bb629f9](https://github.com/event4u-app/agent-config/commit/bb629f98c41c09912a6d67d31ceef25a49becb56))
* **evals:** GeminiRouter JSON output contract — closes the format divergence (Phase 0b) ([f739b32](https://github.com/event4u-app/agent-config/commit/f739b320a1dcb54350d44a67009e634a421034ed))
* **evals:** drop legacy-path literal from a comment (ADR-051 guard) ([48328f0](https://github.com/event4u-app/agent-config/commit/48328f0bd0f9c36cd8d0f11c2bbc206c49faefc6))
* **harvest:** drop illustrative ellipsis path that tripped check_references ([94e6098](https://github.com/event4u-app/agent-config/commit/94e6098bf7d4a6e5127729db103a04b61dfc8f39))

### Documentation

* **roadmap:** enforcement honest-null; archive positioning roadmap ([226bf33](https://github.com/event4u-app/agent-config/commit/226bf3394b905a7dbd45fd74c55ab3a001ddaf2f))
* **readme:** lead with capability; add host-enforcement matrix ([531327d](https://github.com/event4u-app/agent-config/commit/531327d465ed0cc2803b1ee1900d5b551dacbdc0))
* **harvest:** wider-coverage baseline (10 skills) + agent-ide-plugin security-lessons note ([4a2aaaa](https://github.com/event4u-app/agent-config/commit/4a2aaaaac0b6fbd1467b254207690f5adaacf7d8))
* **harvest:** Phase 0b resolved — record the 3-variant format-fix evidence + flip checkbox ([a64dcab](https://github.com/event4u-app/agent-config/commit/a64dcab235efb41170cb28fd4603ae2f3fd1de25))
* **harvest:** cross-model baseline + outcome read (T-006); credential blocker resolved ([b4e8453](https://github.com/event4u-app/agent-config/commit/b4e84534064fe91f4609e2e06fbd04e957f2e2fa))
* **harvest:** Phase 0 evidence — capability matrix, fixture-portability audit, vendor-credential gate decision ([cb64570](https://github.com/event4u-app/agent-config/commit/cb64570b414c3a4d2e3ec34dda70137f513bbfa5))

### Tests

* **evals:** starter behavioral evals.json fixtures (Phase 1, T-001 0-fixtures gap) ([dd6861b](https://github.com/event4u-app/agent-config/commit/dd6861bff4d66d7458468f0a9b2490ac088157c7))

### Chores

* **roadmap:** archive operator-runtime-harvest (core complete) + park residuals in later/ ([69ef1ac](https://github.com/event4u-app/agent-config/commit/69ef1ac91af47c3c462f4453f74eeb94fece310b))
* **roadmap:** defer Phase 2 (won't-build-speculatively) — undershoot guard + catalog target ([9f37fa8](https://github.com/event4u-app/agent-config/commit/9f37fa8fcf29f1822a5739d916b5510047a9f23d))
* **roadmap:** close T-005 + Phase G (honest-null) + plugin note; mark human/parallel residuals ([a0d7f80](https://github.com/event4u-app/agent-config/commit/a0d7f806ac5ed048b19b9c20e41ba392328f3393))
* **roadmap:** Phase 0 — T-004 + T-006 done (live smoke ran); T-005 re-scoped (cost), Phase 0b actionable ([036e66f](https://github.com/event4u-app/agent-config/commit/036e66f98d3cc805e0128a86ab01ee15fd771bb1))
* **dist:** sync eval-fixture projection for the new behavioral evals.json ([01cc089](https://github.com/event4u-app/agent-config/commit/01cc08994ebf11d7cf894822b73a4374b7ef0ee9))
* **roadmap:** Phase 1 — finding_floor mechanism + fixtures done; calibration deferred on P0 ([3a5bc28](https://github.com/event4u-app/agent-config/commit/3a5bc28083206118352b1dd641d76326ac58114d))
* **roadmap:** Phase 0 — mark T-000..T-003 done, T-004..T-006 deferred on credentials ([4f302ee](https://github.com/event4u-app/agent-config/commit/4f302ee9270b02488d1dce6d285520984d01ab40))

## [7.2.0](https://github.com/event4u-app/agent-config/compare/7.1.0...7.2.0) (2026-06-24)

### Features

* **design-craft:** wire existing design/frontend skills into the anti-slop layer ([4ac512c](https://github.com/event4u-app/agent-config/commit/4ac512c294c47c54c04e71a12d2a85e6a8600d93))
* **design-craft:** add anti-slop enforcement + design memory + token governance ([4c07b60](https://github.com/event4u-app/agent-config/commit/4c07b60195db52a938f41445a347a0bec3331bc2))
* **product-clarity:** process wins (release-story, trunk-drift, explainability) ([f91b898](https://github.com/event4u-app/agent-config/commit/f91b898d7ae833bd4eb7b1577e7ae5f78ee96be4))
* **governance:** capability lifecycle view + complete capability-governance ([f299791](https://github.com/event4u-app/agent-config/commit/f2997914a3f9e25fc0a26b4a202e3f521a0471b7))
* **governance:** subagent boundary contract ([8ed4181](https://github.com/event4u-app/agent-config/commit/8ed4181afbff73cb99b764ac695354c0bb1f073f))
* **governance:** skill-growth gate in the authoring flow ([a9a3b80](https://github.com/event4u-app/agent-config/commit/a9a3b80ab7dfbcfee0cb8f0c51d5744aabb03bd7))
* **governance:** capability-boundary matrix + risk_class invariant ([7b683b8](https://github.com/event4u-app/agent-config/commit/7b683b864188f40424c4a9399a6a931081e14291))
* **legal-review-prep:** attorney-framing-review promotion tripwire ([551fe8b](https://github.com/event4u-app/agent-config/commit/551fe8b4b7e817c5f81adddfe8d85220f3ef30a7))
* **legal-review-prep:** high-risk pack metadata ([554282e](https://github.com/event4u-app/agent-config/commit/554282e4b12575dc884c078f45b560facea60be1))
* **legal-review-prep:** council / deep-research gate on legal work-product ([7b44c89](https://github.com/event4u-app/agent-config/commit/7b44c8961d94ae9a5b99329a80ff725db2d0c6d5))
* **legal-review-prep:** install consent gate (checkbox + flag + floor refusal) ([af2ee1d](https://github.com/event4u-app/agent-config/commit/af2ee1dbc18446f77f0d13e79b11551634f15d2c))
* **legal-review-prep:** hard individual-case STOP in the floor + lint ([71860da](https://github.com/event4u-app/agent-config/commit/71860da9699d8537a81942ff4d59aeca6fbd2a96))

### Bug Fixes

* **lint:** trim telegraph-speak amendment to clear long_rule warning ([95d54c6](https://github.com/event4u-app/agent-config/commit/95d54c6852c2344f3402f5f9730185a400fc4941))
* **lint:** add model_tier to design-system-capture skill ([57c3a6d](https://github.com/event4u-app/agent-config/commit/57c3a6defd57a771a9f86805b9634f3b73a6afee))
* **framework-neutrality:** drop npm-install literal in design-intelligence ([aeadec5](https://github.com/event4u-app/agent-config/commit/aeadec54038c0d43aed75ea30f30574a2d6b7d65))
* **ci:** Zod settings parity + router minification for tokens.rich_skills ([88930da](https://github.com/event4u-app/agent-config/commit/88930da1786731a9cc1317b841646477f77ad1d1))
* **ci:** strict-TS null-safety in design-craft linters ([3cac522](https://github.com/event4u-app/agent-config/commit/3cac522ed8234190a6d361735bc323616b11393b))
* **ci:** broken refs + unused var in design-craft additions ([2e0c2a7](https://github.com/event4u-app/agent-config/commit/2e0c2a785596c67fb4114ead09caea57aeb6e0ab))
* **portability:** drop task-invocation from shipped /create-pr command ([e03f97a](https://github.com/event4u-app/agent-config/commit/e03f97a14ea38439ba41427448f7d77c868959c4))

### Documentation

* **roadmaps:** add legal-review-prep + capability-governance + product-clarity roadmaps ([e3ad120](https://github.com/event4u-app/agent-config/commit/e3ad120893dd20cea79c7875558137f42d2797da))

### Refactoring

* **legal:** rename legal pack to legal-review-prep ([fb34133](https://github.com/event4u-app/agent-config/commit/fb3413305718d321b435514e5f0ab0f4122e37b7))

### Chores

* **sync:** condense design-craft skills/rules + sync dist/agent-src/ ([3a3e6e1](https://github.com/event4u-app/agent-config/commit/3a3e6e1f668128e386ca7d19ffe031a09a391fcd))

## [7.1.0](https://github.com/event4u-app/agent-config/compare/7.0.2...7.1.0) (2026-06-24)

### Features

* **legal:** RDG individual-case guardrail + LEGAL_NOTICE + no-definitive-language lint ([23e76df](https://github.com/event4u-app/agent-config/commit/23e76df34c612ed9bcdace069040defda80c1226))
* **legal:** lock open-source-forever stance + harden liability disclaimer (ADR-108); close 0.6 + 3.3 ([8d828a6](https://github.com/event4u-app/agent-config/commit/8d828a64de5d23fa1c298a78b3d67c6e70ffe4b7))
* **legal:** lock open-source-forever stance + harden liability disclaimer (ADR-108); close 0.6 + 3.3 ([f45e4e9](https://github.com/event4u-app/agent-config/commit/f45e4e99f7cccd77efb2d62fe06cb4436bc2df9e))
* **legal:** enforcement linter, privilege markers, eval harness, docs (Phases 1/1.5/3/5) ([cb06648](https://github.com/event4u-app/agent-config/commit/cb06648009dc12daab440a273eeb780d06f6e2fa))
* **legal:** add governed EU/DE legal pack — floor, 5 skills, vocab (ADR-107) ([b0d531f](https://github.com/event4u-app/agent-config/commit/b0d531f2701b600c93cb1ba52f3dce50e21a6d6d))
* **bench:** pair-capture seam for recursion arm (human-preference pretest) ([7211c04](https://github.com/event4u-app/agent-config/commit/7211c043bb712cea6c0a2e0de56ea5af79b70cce))
* **bench:** recursion gate logic + novel-lift scorer + package-recursive arm ([e33ff7d](https://github.com/event4u-app/agent-config/commit/e33ff7d52572ea35bcb8f5b190336e83e737ab1d))
* **recursive-verification:** add depth-bounded self-verification skill + gate ([4a0c519](https://github.com/event4u-app/agent-config/commit/4a0c519628a5244cc2859cdf484661c92be25783))
* **subagents:** A1 rule body + A2 bundle resolver + A3 response envelope ([4a9fc9b](https://github.com/event4u-app/agent-config/commit/4a9fc9b3c44c256426b0c33f4448010e890adf13))
* **subagents:** A1 — dedicated delegation-policy auto-trigger rule ([e60cb50](https://github.com/event4u-app/agent-config/commit/e60cb50fcfb55ccabdeab88b680ec707f8a4d122))
* **subagents:** automatic, settings-gated subagent orchestration ([dba922c](https://github.com/event4u-app/agent-config/commit/dba922c1da2177ad8103f06fd4dce49cff95977d))
* **py2ts:** purge dead python-parity test blocks + add permanent no-python-in-src guard ([e163468](https://github.com/event4u-app/agent-config/commit/e163468af8d2b70a7e4645db0dda719c3f761cb3))
* **roadmaps:** robust completion→archival independent of PR flow, tracking, and vendored scripts ([a879334](https://github.com/event4u-app/agent-config/commit/a87933447797c848e0e09e5d9d0ade6d280ae794))
* **rules:** add design-fidelity rule for provided-design adherence ([88bc654](https://github.com/event4u-app/agent-config/commit/88bc6541721a7d964d670fe80ac06385c4776762))
* add /fix:comments command to audit and trim branch code comments ([b3127b8](https://github.com/event4u-app/agent-config/commit/b3127b86733357d8fe2a32e4b3e5fe1c15447e41))

### Bug Fixes

* **legal:** add 'legal' to discovery-manifest schema workspace + pack enums ([f7cc834](https://github.com/event4u-app/agent-config/commit/f7cc83415d6c7ffa7600512fba059c2513c3d4df))
* **ai-council:** raise curl timeout to 300s + --max-time so long Anthropic generations don't ETIMEDOUT ([42048b9](https://github.com/event4u-app/agent-config/commit/42048b91a5361a9041deee172609a974d926d1da))
* **roadmap:** commit legal-pack + dashboard + archived-roadmap link fixes ([1a6910a](https://github.com/event4u-app/agent-config/commit/1a6910a39beea7e5bfc0ff21167be1463d7bfd96))
* **test:** satisfy noUncheckedIndexedAccess in recursion tests ([29d6d89](https://github.com/event4u-app/agent-config/commit/29d6d8920192b3ade000abf9e5c102871a3ba336))
* **py2ts:** inbox snapshot — strip macOS /private prefix so Linux CI matches ([f19436e](https://github.com/event4u-app/agent-config/commit/f19436e4a6e1cdc6dba452330e293b4414f82125))
* **py2ts:** typecheck — assert tuple element in workspace_secrets SCAN/OBJ_CASES ([aedf6ee](https://github.com/event4u-app/agent-config/commit/aedf6eeb98eb4e171544decf4bfc9511ad7868e2))
* **ci:** allowlist brand/iconography/premortem bare-noun skill names ([1522311](https://github.com/event4u-app/agent-config/commit/152231156b8379ded27652c28c089806a4f33d1c))
* **ci:** register new subagents.* keys in the settings schema ([2c817a6](https://github.com/event4u-app/agent-config/commit/2c817a631c6b2062d8e5e843c31513d932d27d6f))
* **ci:** resolve pre-existing trunk gate drift ([8515b97](https://github.com/event4u-app/agent-config/commit/8515b9793608c077f058ac42621bf6e03160e163))
* **schema:** default the design block so settings without it still validate ([86ee94e](https://github.com/event4u-app/agent-config/commit/86ee94e313f198fd109db7dfdd6bb93a7b6dc8c6))
* **schema:** register design.fidelity_mode in settings parity schemas ([af56652](https://github.com/event4u-app/agent-config/commit/af5665258c9b5c02bc016d2e12bfa76befbe5d5d))
* **council:** resolve config global-only — never search the project tree ([fcd81ff](https://github.com/event4u-app/agent-config/commit/fcd81ffe92e652db88c79ba29c05b2dc0e358850))

### Documentation

* **recursive-verification:** record council follow-up disposition — TERMINAL ([7d132be](https://github.com/event4u-app/agent-config/commit/7d132bec2b55c00359d1d906b7701de0317f28bf))
* **recursive-verification:** record honest-null in benchmark.md + ADR-106 ref ([87da20f](https://github.com/event4u-app/agent-config/commit/87da20ff8217e771427153eabaf7edaec4e97669))
* add subagent-orchestration onboarding map + sync roadmap dashboard ([01b798f](https://github.com/event4u-app/agent-config/commit/01b798f42b500b3c801292f65da90137304f9243))
* **roadmap:** add operator-runtime-harvest roadmap ([a2a92b1](https://github.com/event4u-app/agent-config/commit/a2a92b145f630e55b440b7b4214359618bf70ac9))
* **roadmap:** record measured remaining spawn-tail count (108) + next groups ([4426293](https://github.com/event4u-app/agent-config/commit/4426293da06dfc60ff914ab9a4bc9756675b96aa))
* **roadmap:** archive completed auto-subagent-orchestration v2 + regenerate derived ([e8af760](https://github.com/event4u-app/agent-config/commit/e8af760c792b4b7f2a7c3d61a551d84e43904df6))
* **roadmap:** mark work_engine cluster de-pythonized (21 files) ([0b36d5c](https://github.com/event4u-app/agent-config/commit/0b36d5c4999052f33cbc423296ecc9238a2b122c))
* **roadmap:** mark workspace_* cluster converted (12 files, +346 tests) ([154db54](https://github.com/event4u-app/agent-config/commit/154db548375a787f9c19ed38a464db8edfd4b9cb))
* **roadmap:** capture the py2ts conversion-tail determinism trap (per-file, not a codemod) ([439817c](https://github.com/event4u-app/agent-config/commit/439817c272216f81ed2e286990f27488f3321e64))
* **roadmap:** auto-subagent-orchestration roadmap + follow-up ([5cdbc84](https://github.com/event4u-app/agent-config/commit/5cdbc8438b0e097c99f16ee438494ae66e234c77))
* **roadmap:** refine py2ts tail triage (36 delete-candidates / 108 convert) ([985e3e3](https://github.com/event4u-app/agent-config/commit/985e3e35bdfb48309c2dc7259e0180a39fe71cd8))
* **roadmap:** record py2ts parity-block purge + categorize the remaining tail ([1ac823c](https://github.com/event4u-app/agent-config/commit/1ac823ce1e927a473e6c2c973cbe2e33dfb96ffb))
* **roadmaps:** split token-saving human-measurement track off the autonomous parent ([ac188ef](https://github.com/event4u-app/agent-config/commit/ac188ef4e7044f75baf87e393f7084dae383abe3))
* **roadmaps:** reconcile road-to-typescript-only-scripts against merged reality ([9adf45b](https://github.com/event4u-app/agent-config/commit/9adf45b3294f38f70100feaec44867074b512a2b))
* **rdp:** restore frontier-polish closure dispositions in the archived file ([e712620](https://github.com/event4u-app/agent-config/commit/e712620f74a83f5faa50bb8885b6a1d17117adcf))
* **rdp:** close + archive road-to-rdp-frontier-polish (L7 no-promotion, Phase 3 cancelled) ([8945d5a](https://github.com/event4u-app/agent-config/commit/8945d5ad35b15c4b177ae368f389fb0445f0c856))

### Tests

* **legal:** replace Gate-2 owner requirement with a test-enforced disclaimer guarantee ([60112ac](https://github.com/event4u-app/agent-config/commit/60112ac9af01cc9f85491a0b6ccaa6bd17b4caa8))
* **legal:** add trigger-eval sets for the 5 legal skills (5 should + 5 should-not, DE+EN) ([f451af2](https://github.com/event4u-app/agent-config/commit/f451af2a4d6ee1cfd357f69fe120a905ae26e525))
* **py2ts:** de-pythonize 21 work_engine test files (purge parity blocks / convert pure rigs) ([2221cc8](https://github.com/event4u-app/agent-config/commit/2221cc8c268bb4d7e8f7eba59d58990f31c82dfb))
* **py2ts:** convert the workspace_* CLI parity cluster to python-free intent tests ([6697dea](https://github.com/event4u-app/agent-config/commit/6697dea75a24f363f2053c4700d8438ec2725742))
* **py2ts:** convert workspace_hosts parity rig to python-free intent test ([6f79864](https://github.com/event4u-app/agent-config/commit/6f798649ae2f27ca1381622025102b678f283f6d))
* **py2ts:** purge obsolete python3-vs-tsx parity blocks from 94 mixed test files ([5e07191](https://github.com/event4u-app/agent-config/commit/5e07191639e01f74f47699e62798ce6b298cbc1f))
* **py2ts:** convert the 4 all-parity CLI rigs to python-free intent tests ([aff202c](https://github.com/event4u-app/agent-config/commit/aff202c5eb81d2a87e9147e812a2fd53635dcae2))
* **ci-time-ratio:** drop leaked root artifact, write relative --out under ignored test-results/ ([5152942](https://github.com/event4u-app/agent-config/commit/5152942c67711f3dfdb4b35b60c696fd633a6aaf))

### Chores

* **legal:** regenerate agents/index.md + docs/catalog.md for legal pack artefacts ([484d5da](https://github.com/event4u-app/agent-config/commit/484d5da21ff67dd7013919b99a03fd0de3c66c72))
* **roadmap:** archive completed recursive-verification + add legal-pack + sync dashboard ([887fbe7](https://github.com/event4u-app/agent-config/commit/887fbe7b83be52e21d751965f3dad2152d80f1ce))
* **roadmaps:** archive py2ts teardown evidence + superseded predecessor ([d11f6cd](https://github.com/event4u-app/agent-config/commit/d11f6cd1646c43e6bd8f210b0ac703a7059236e5))
* **condense:** re-mark stale command hashes (pre-existing drift) ([836d2c9](https://github.com/event4u-app/agent-config/commit/836d2c9ae1987d630fdce431b0ae5fed9aeb9aca))
* register fix-comments skill in marketplace.json ([214c5d1](https://github.com/event4u-app/agent-config/commit/214c5d147b53b65c9eef56ea0e72a2d1a9224633))
* **roadmaps:** regenerate dashboard (frontier-polish Phase 1 = done) ([9172c18](https://github.com/event4u-app/agent-config/commit/9172c18f5c6b6ad82ca6457ddbad10069a895d31))

### Other

* Revert "feat(legal): lock open-source-forever stance + harden liability disclaimer (ADR-108); close 0.6 + 3.3" ([1f10272](https://github.com/event4u-app/agent-config/commit/1f1027229c841cda6110b64c59747b3607b092f6))

## [7.0.2](https://github.com/event4u-app/agent-config/compare/7.0.1...7.0.2) (2026-06-22)

### Bug Fixes

* **roadmaps:** regen entry-guard fires under symlinked invocation ([244e4e4](https://github.com/event4u-app/agent-config/commit/244e4e45a42a6b3d4793ac192e0f912d71954ba4))
* **rdp-eval:** harden index access for strict typecheck (noUncheckedIndexedAccess) ([041b21e](https://github.com/event4u-app/agent-config/commit/041b21e4877361b1499328216242fa6ec595ff99))
* **rdp-eval:** satisfy eslint on the new runners ([3c418e1](https://github.com/event4u-app/agent-config/commit/3c418e16faf340b8367148f6788835e400241e4e))

### Documentation

* **rdp-eval:** keep-scoped L6 verdict — scope orchestrator to multi-step work ([61173ca](https://github.com/event4u-app/agent-config/commit/61173ca899442b81159e4f3efe586251dcea4459))

### Tests

* **rdp-eval:** capture larger-N L6 + gate-classification data ([f92aad3](https://github.com/event4u-app/agent-config/commit/f92aad32620af27c5cf4d000859adeeb9894a819))
* **rdp-eval:** port quality+L6 eval runners to TypeScript (fetch-based) ([9c4ec60](https://github.com/event4u-app/agent-config/commit/9c4ec604ca6fbb82d796cf2d65626d381a854142))

### CI

* **consistency:** trigger on src/** and dist/agent-src/** paths ([6a5e5e7](https://github.com/event4u-app/agent-config/commit/6a5e5e76cea3d5f879f9fcda6e510cc73039826e))

## [7.0.1](https://github.com/event4u-app/agent-config/compare/7.0.0...7.0.1) (2026-06-22)

### Bug Fixes

* **release:** measure accumulated era body in the split gate ([3837048](https://github.com/event4u-app/agent-config/commit/3837048138e5e5d8cfa024ab80df4882d8ecc736))
* **changelog:** exempt newest release from era drift cap; split 7.0.0 into its own era ([0dfa3a2](https://github.com/event4u-app/agent-config/commit/0dfa3a23fe44f8eb4e664d78173d294c7c4848c3))
* **install:** resolve package version by upward walk so global install stops refusing ([977bdc3](https://github.com/event4u-app/agent-config/commit/977bdc359fe8954592f81649b23ea4a00f157b74))

## [7.0.0](https://github.com/event4u-app/agent-config/compare/6.1.0...7.0.0) (2026-06-21)

> Large catch-up release. The full per-commit entry (BREAKING CHANGES,
> Features, Fixes, …) is archived in
> [`docs/archive/CHANGELOG-7.0.0.md`](docs/archive/CHANGELOG-7.0.0.md) to keep
> the active `7.0.x` era under the 250-line drift cap. Git tag `7.0.0`
> remains the canonical record of what shipped.

### Highlights

* **py2ts:** Python → TypeScript re-platform completed — all `src/` `.py`
  twins removed (Hard Floor); CLI, release, roadmap, and golden-transcript
  tooling ported to TS + vitest.
* **install:** versioned install-layout ABI; core-vs-lab surface tiers with a
  boundary guard; layout migration + core-only deploy wired into the installer.
* **brand / eval / ai-image:** `/brand:` command cluster shipped; eval
  freshness lints made blocking; image-adapter cost + freshness caveats added.
* **BREAKING:** `build_ticket_export.py` removed — no API export (ADR-102).
