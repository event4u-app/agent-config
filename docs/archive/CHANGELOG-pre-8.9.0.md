# Changelog Archive — pre-8.9.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `8.9.0`, split out of the main
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

## [8.8.0](https://github.com/event4u-app/agent-config/compare/8.7.0...8.8.0) (2026-07-09)

### Features

* **rules:** security & quality hardening governance layer ([2574ce8](https://github.com/event4u-app/agent-config/commit/2574ce8f243763e06e62ad82e58413d182964a50))
* **orchestration:** token-savings report over orchestration telemetry ([60b90a2](https://github.com/event4u-app/agent-config/commit/60b90a253efe26810a349a930d8fd6fdf02a3d37))
* **subagents:** default subagents.auto to `on` on subagent-capable hosts ([bc3eea5](https://github.com/event4u-app/agent-config/commit/bc3eea554e06cbcc9013145143fce93a1a1adb53))
* **bus-factor:** CODEOWNERS + self-imposed-gate CONTRIBUTING section ([ec9b93e](https://github.com/event4u-app/agent-config/commit/ec9b93ebe94f33aecf6ddb00b72dbfb60b2e0c37))
* **second-brain:** deterministic multi-session recall corpus + scorer ([5f09fff](https://github.com/event4u-app/agent-config/commit/5f09ffff2d4090ed6761f37d55a8bb0a73b99333))
* **domain-soundness:** domain-truth fixture schema + validation-status ratchet ([bd67c4d](https://github.com/event4u-app/agent-config/commit/bd67c4dec9de9691eea2b1367807a4e190db5db8))
* **evals:** staleness lint + wire the coverage ratchet into CI ([886bf25](https://github.com/event4u-app/agent-config/commit/886bf25fedcaface708ee3f8be17135d8be2e742))
* **evals:** behavioural-eval schema + per-tier coverage metric + ratchet floor ([2e303f6](https://github.com/event4u-app/agent-config/commit/2e303f66d076355434ff720b6d81ac3f3021b22e))
* **memory:** opt-in session-start index + FTS5/AST backlog ledger ([bb15b21](https://github.com/event4u-app/agent-config/commit/bb15b21fb334d7c44896b7ef4c340c0396f0c6c4))
* **memory:** catalog discipline, history timeline anchor, chunk index flags ([3cce078](https://github.com/event4u-app/agent-config/commit/3cce0789f48966fe31e8fad1ad63ae2477c53259))
* **memory:** index/detail split + memory_get batch fetch (Phase 1) ([36547c8](https://github.com/event4u-app/agent-config/commit/36547c88452c99eb02d7c2db61ce9556701db80d))
* **memory:** Phase 0 replay substrate for the retrieval-economy gate ([6d05daf](https://github.com/event4u-app/agent-config/commit/6d05dafa35ae38b4c4d97cd17a155c1e4bbc801e))

### Bug Fixes

* **rules:** apply council-adjudicated review fixes ([d6d818a](https://github.com/event4u-app/agent-config/commit/d6d818a8bfb79c6862488eb367f4f3e92f7d7aa6))
* **rules:** satisfy skill-lint, schema, and proof-check gates ([ea551cc](https://github.com/event4u-app/agent-config/commit/ea551cc5c9efb21ab6453948f97848557d98ae1f))
* **orchestration:** guard undefined argv in savings-report parseArgs ([cf2539e](https://github.com/event4u-app/agent-config/commit/cf2539e73ac7e7edbaee206bcd09e03032986618))
* **mcp:** cast validated depth args to number for tsc ([cc5a8a4](https://github.com/event4u-app/agent-config/commit/cc5a8a4ac80ac245ec2b30fa4223d1888788e475))

### Documentation

* **orchestration:** document the savings report + the no-percentage limit ([d29a5d1](https://github.com/event4u-app/agent-config/commit/d29a5d10411c3507d6fb035ac44959ee2a738435))
* **adoption:** link the deployed docs site + surface the 30-second wedge ([eb74680](https://github.com/event4u-app/agent-config/commit/eb74680bec665c422e226ac8c5e8458c8279539e))
* **adr:** ADR-117 flip subagents.auto default to on; amend ADR-105, supersede verdict ([0b5879c](https://github.com/event4u-app/agent-config/commit/0b5879c3f25014c54779e959e16282ac66d4ae4d))
* **bus-factor:** bind the honest bus-factor to CLAIMS ([6bbbda4](https://github.com/event4u-app/agent-config/commit/6bbbda4d841f084c27c5a8f34bd10171429bc684))
* **bus-factor:** inheritable release runbook + succession doc ([7d05577](https://github.com/event4u-app/agent-config/commit/7d05577f32c154332fb8bdf90833e8e7acf7f704))
* **second-brain:** honest scope vs human-PKM + unproven-lift CLAIMS gate ([b9dc934](https://github.com/event4u-app/agent-config/commit/b9dc9347661237c24cdadd5ca454ed07acbf9409))
* **domain-soundness:** label the domains unvalidated + gate the provenance claim ([7221662](https://github.com/event4u-app/agent-config/commit/72216625a559818196441349501af3b65c4be3ce))
* **evals:** publish the honest coverage baseline + label the long tail ([299a7fe](https://github.com/event4u-app/agent-config/commit/299a7fe74360a8df5b7d46c026be65b501685ff0))
* **memory:** Phase 1b honest null — default flip falsified at current scale ([938aab2](https://github.com/event4u-app/agent-config/commit/938aab2f5d6dcf43fd82738025fe309d5cb7ad91))

### CI

* **second-brain:** wire the recall-scorer dry-run into ci + ci-strict ([7da6d01](https://github.com/event4u-app/agent-config/commit/7da6d010f40793e31a9b3f891a5e08aa2afe184c))
* **domain-soundness:** wire the validation-status ratchet into ci + ci-strict ([7ae10c2](https://github.com/event4u-app/agent-config/commit/7ae10c2cd4d36e65db3a52c8c68b824200c3f9c6))

### Chores

* **generated:** regenerate counts, router, and pack manifest ([f141060](https://github.com/event4u-app/agent-config/commit/f141060e9da2f4f0a97a257d2786dd42fdf2ee0f))
* **roadmap:** adoption Phase-0 site-link quick-win landed; rest positioning/human-gated ([de27276](https://github.com/event4u-app/agent-config/commit/de27276b06b3969a8ea8a22ed5327385aa3ff582))
* **roadmap:** bus-factor inheritability slice landed; gate + admin deferred ([8bf79f5](https://github.com/event4u-app/agent-config/commit/8bf79f5dd3e9dcd940acce7c56eaad978d2525f7))
* **roadmap:** second-brain-delta-proof P1 rig + P3 gate landed; P2 run deferred ([e01ec9e](https://github.com/event4u-app/agent-config/commit/e01ec9e9691fa5d19390fa3b187bafbef3e34618))
* **roadmap:** domain-soundness P1/P3-gate/P4-labeling landed; P2 open on domain competence ([9a786d4](https://github.com/event4u-app/agent-config/commit/9a786d4cb2b0dc469c3b2967e8bc360e9877ec79))
* **roadmap:** skill-eval-coverage P1/P3/P4 landed; P2 open on human gate ([a4c526d](https://github.com/event4u-app/agent-config/commit/a4c526d43a459bb86d78dcf2d07e3dc2d44b6828))

Tests: 7027 (+78 since 8.7.0)

## [8.7.0](https://github.com/event4u-app/agent-config/compare/8.6.0...8.7.0) (2026-07-08)

### Features

* **settings:** validate + surface projection.rule_workspaces/rule_packs ([a27bbf5](https://github.com/event4u-app/agent-config/commit/a27bbf53c7fca206176ed6ddd38b1ec5ee11e357))
* **install:** consumer Cursor/Windsurf get host-native rule surfaces ([8b68ff5](https://github.com/event4u-app/agent-config/commit/8b68ff58e9c240e41acce1f25faa51bc47f3564b))
* **install:** consumer rule scoping reaches both install pipelines ([88248e4](https://github.com/event4u-app/agent-config/commit/88248e4d39bd056db133021acc0cc2b0782e78cc))
* **ci:** trigger-eval presence ratchet with shrink-only grandfather allowlist ([d8f0c0d](https://github.com/event4u-app/agent-config/commit/d8f0c0dd04b3388205becf2cce30c6e0ea09197b))

### Bug Fixes

* **ci:** install repo-root deps in the MCP deploy workflow ([9183c4e](https://github.com/event4u-app/agent-config/commit/9183c4e358e76b344058eb01d7f945f246a44828))

### Documentation

* add frontier quality roadmaps ([bfa9315](https://github.com/event4u-app/agent-config/commit/bfa93157848bf13020a6cb3dcd06381c013fb035))
* **skills:** skill-writing names the CI-enforced trigger-eval presence gate ([464722e](https://github.com/event4u-app/agent-config/commit/464722efe83243e3ae480411d59850dac92ca1ac))

### Chores

* **roadmaps:** regenerate progress dashboard ([a8f4178](https://github.com/event4u-app/agent-config/commit/a8f4178a84ef8c66408afe3d5af195ce19ccf5d0))
* **gitignore:** ignore Codex CLI interop output (.agents/, .codex/) ([8756d52](https://github.com/event4u-app/agent-config/commit/8756d5226e8760c72d6205e98b9822620d303418))
* **dist:** rebuild install bundle after settings-schema extension ([44818d4](https://github.com/event4u-app/agent-config/commit/44818d4c8ad69ec545e99820e3292f0346bb2f20))
* **roadmap:** close Phase 1b with pinned consumer-install evidence ([3a2455f](https://github.com/event4u-app/agent-config/commit/3a2455f236279390eb5a8cfe986e6b911493391c))
* **condense:** refresh stale hash for commands/upstream-contribute ([c668370](https://github.com/event4u-app/agent-config/commit/c668370663bf7272932c33b5a7874dca4b08a9db))
* **roadmaps:** composition-ratchet roadmap executed + archived; adoption roadmap sequenced next ([1bde2ea](https://github.com/event4u-app/agent-config/commit/1bde2ea00478bd1e46c4e9596c8c0cd5962b9ee1))

Tests: 6949 (+6 since 8.6.0)

## [8.6.0](https://github.com/event4u-app/agent-config/compare/8.5.0...8.6.0) (2026-07-08)

### Features

* **cost-routing:** tier-downshift layer — telemetry fields, category defaults, tripwires, slice inference, verify-fail escalation ([e9839f5](https://github.com/event4u-app/agent-config/commit/e9839f5a034c3a0882e8956a2a3f580b3978056a))

### Bug Fixes

* **ci:** install task in the release workflow ([19072d9](https://github.com/event4u-app/agent-config/commit/19072d9bcbb6d30cd943804f287dd79c9c709167))

### Documentation

* **roadmaps:** add four frontier-prompt-harvest roadmaps ([e232e34](https://github.com/event4u-app/agent-config/commit/e232e342401bd6edafda79cd64ce8ed4ff6ddd93))
* **proof:** regenerate proof.md with the backed downshift-cost-reduction claim ([6f28604](https://github.com/event4u-app/agent-config/commit/6f286048b609442be81ac60a8c64df544a369df0))
* **roadmaps:** unify tripwire engine wording on the ADR-116 path ([f4ee375](https://github.com/event4u-app/agent-config/commit/f4ee37540ea6f9724014c63be05617e4abcdaa1b))
* **adr:** pin the memory scale-tripwire activation path (ADR-116) ([7efe88a](https://github.com/event4u-app/agent-config/commit/7efe88a7cda064e659a830a2d6a70e506ab21408))
* **claims:** back downshift-cost-reduction with the routing-downshift bench run ([38f3194](https://github.com/event4u-app/agent-config/commit/38f31942b16474fcc5977f0560da435ce84a81dd))

### Chores

* **condense:** recondense cost-routing context/command edits into dist ([33fe1a3](https://github.com/event4u-app/agent-config/commit/33fe1a353a3eef52d024079016b32b9fe02b0531))
* **contexts:** durable verdict note for cost-aware model routing ([cbff1bd](https://github.com/event4u-app/agent-config/commit/cbff1bdc7f2b0b87843283443de534c48f5ddd54))

Tests: 6943 (+7 since 8.5.0)

## [8.5.0](https://github.com/event4u-app/agent-config/compare/8.4.1...8.5.0) (2026-07-08)

### Features

* **counts:** single-source every public artefact count + drift gate ([34204ed](https://github.com/event4u-app/agent-config/commit/34204ed9b1048704cf3ebb917e2abc7f952ee62a))
* **doctor:** settings-review-pending check ([f2e5198](https://github.com/event4u-app/agent-config/commit/f2e51984cc32a44792660e1ef0ad5c66ed2b859f))
* **ui:** upgrade settings-review page + pending banner ([6272721](https://github.com/event4u-app/agent-config/commit/6272721f34f0a1f01d6ef3bccd08f468448ea8f0))
* **server:** pending settings-changes routes + API contract ([bddd2c5](https://github.com/event4u-app/agent-config/commit/bddd2c5a01c8ff04a69a786de8e3f076e9788217))
* **install:** snapshot the settings surface + write the upgrade delta ([21b2ddd](https://github.com/event4u-app/agent-config/commit/21b2ddd2e05eecc9996d43ab0a380c7ec45ec105))
* **settings:** shared settings-surface flatten/delta/classify engine ([c73adb8](https://github.com/event4u-app/agent-config/commit/c73adb859eb25562e382c735fea696d10f6657c3))
* **lint:** validate routes_to + bare-invocation story; repoint atomic-command linter ([8f5a5eb](https://github.com/event4u-app/agent-config/commit/8f5a5eb56b71c2451e510948dbbdc5d1d5d2737f))
* **server:** prefill local/dry-run tests from the real user-global config ([08c3a01](https://github.com/event4u-app/agent-config/commit/08c3a01a9c022709953cf4fb68e5e1a45792687e))
* **ui:** prune nav to real surfaces; gate Project and Workspace tabs ([4b437b9](https://github.com/event4u-app/agent-config/commit/4b437b95afbaee3765c87d93defc1065d779dcfe))
* **wizard:** remember roles and pack selection across runs ([befb5aa](https://github.com/event4u-app/agent-config/commit/befb5aaf14ea7b5b76db2600e9554375f5204340))
* **settings:** standalone hub with simple/advanced tiers, search, modified badges ([6138089](https://github.com/event4u-app/agent-config/commit/613808968a63dd5ceeda26245e2d055fdd0fd86c))
* **ui:** dark-first visual system v2 with theme toggle ([6204194](https://github.com/event4u-app/agent-config/commit/6204194b4c8777260fd68bc4087500af2be44b4a))
* **wizard:** consolidate flow, add start screen, review summary, finish checklist ([d58d4a4](https://github.com/event4u-app/agent-config/commit/d58d4a4f0a063bc051573d7df95bd35344432b66))
* **wizard:** prefill installed packs and flag removals ([8cad9d3](https://github.com/event4u-app/agent-config/commit/8cad9d367ce27c4393486349ed2d1428dd2834b9))
* **cli:** add config command and init --project routing ([7a4f26a](https://github.com/event4u-app/agent-config/commit/7a4f26ad6deada4567a8fc7f04df0bc3d460760b))

### Bug Fixes

* **release:** guard the Tests: footer counter against vitest recursion ([6538636](https://github.com/event4u-app/agent-config/commit/653863666e7376280046a9570a2f9c65e6ee2f12))
* **converge:** surface the live-session remedy after a plugin-cache reap ([0c84dbc](https://github.com/event4u-app/agent-config/commit/0c84dbc9923916a00f4fd4738c2089997614fe82))
* **ci:** replaces arrays, legacy-path literal, cookbook test fixture ([a300ba0](https://github.com/event4u-app/agent-config/commit/a300ba03a4a17424ac5b24bf7713e7311c47a051))
* **pack:** ship src/shared + src/server/schemas with the tarball ([39f6b66](https://github.com/event4u-app/agent-config/commit/39f6b668f14f26d8dc9e768bb8b400aa35e36039))
* **cli:** list config in the Bash help output ([72f168e](https://github.com/event4u-app/agent-config/commit/72f168ec370671a0116ed7ff1ce76e4488b52390))
* **install:** work around Claude Code flat user-command discovery regression ([af00db9](https://github.com/event4u-app/agent-config/commit/af00db98e7bf26a47a525f59a272647f5342a7e4))
* **cli:** list every dispatched command in help output ([3e366d6](https://github.com/event4u-app/agent-config/commit/3e366d63dcced166ecfe54a184baf38def2c504c))
* **wizard:** review chip overflow + dry-run apply hard floor; add browser E2E ([d5b0977](https://github.com/event4u-app/agent-config/commit/d5b09775cf1276d22624236cf49818f6d77afb04))

### Documentation

* update cross-references to nested command paths ([6ca8b56](https://github.com/event4u-app/agent-config/commit/6ca8b564f44c3631d5b4d29272679e4e65eb8c95))
* **contracts:** register Phase-4 command clusters + bare-invocation rule (ADR-114) ([9e9f3c2](https://github.com/event4u-app/agent-config/commit/9e9f3c2fc437bce9066b0f4e3259c358ee80ada4))
* document config command, init --project, wizard flow and settings hub ([d4a5df1](https://github.com/event4u-app/agent-config/commit/d4a5df1c050831f29d655775a2ad8a38b037f4bb))

### Refactoring

* **scripts:** retire py2ts parity rationale from all src/scripts comments ([4ec6f07](https://github.com/event4u-app/agent-config/commit/4ec6f07c5e36240c572426ff8e17ae857efc2ba4))
* **commands:** nest 19 flat commands into Phase-4 clusters ([fa918c2](https://github.com/event4u-app/agent-config/commit/fa918c23d99f1b1100210be6757906bbcc68153f))

### Tests

* **budget:** align fixtures with the re-anchored mcp_schemas cap ([fa3c93f](https://github.com/event4u-app/agent-config/commit/fa3c93f637e751dc31bd6cc2b3b71a740fca33f1))

### Chores

* **counts:** re-sync prose counts after the main merge (172 commands) ([1042fad](https://github.com/event4u-app/agent-config/commit/1042fad691a0c2c3aa01079ef21654e816565863))
* **hygiene:** fix stale references, triage claims debt, revive Tests: footer ([2379d4b](https://github.com/event4u-app/agent-config/commit/2379d4bf1821c0cbcb11d1ca919677a65bce86bf))
* **roadmaps:** land the inbox-consolidation roadmap set (council 2026-07-08) ([f25b3bb](https://github.com/event4u-app/agent-config/commit/f25b3bb4a6fa68444e79e0cca80b2c3813bd3484))
* regenerate dist, projections, catalogs, and pack manifests ([fa45778](https://github.com/event4u-app/agent-config/commit/fa45778ada09381701222a12be064932bb572c7d))
* **bench:** re-anchor kernel-prefix snapshot after main's commit-policy edit ([98ee05a](https://github.com/event4u-app/agent-config/commit/98ee05a18736d016361d7dab88373b819ff1922e))
* **bench:** refresh token baseline after run_tests exec pilot ([140697e](https://github.com/event4u-app/agent-config/commit/140697e177672805319fe2425c7e641d266c0843))
* **budget:** re-anchor mcp_schemas.gpt cap after run_tests exec pilot ([0b49bd4](https://github.com/event4u-app/agent-config/commit/0b49bd4bd389ead796a59eb61c29b5fcc584d520))
* **kernel:** ADR-114 — commit-policy Iron-Law override ([edabc87](https://github.com/event4u-app/agent-config/commit/edabc8753c218ed1661ccd664a7ce513b7f0b34b))
* **matrix:** regenerate file-ownership matrix (new files from branch + main merge) ([8a88564](https://github.com/event4u-app/agent-config/commit/8a88564c7f01d2bfe5e35287e55ad0b1fca655f8))
* **roadmap:** allow-pragma for historical council output path ([67076a4](https://github.com/event4u-app/agent-config/commit/67076a46c3228752bea11a050fb193e695e5b04c))
* **docs:** add required stability frontmatter to surface-matrix contract ([e16a998](https://github.com/event4u-app/agent-config/commit/e16a998b499a8cdcdfc1a5f2f20d66c5031fe5b5))
* **tiers:** register mcp_exec cluster (lab) in surface-tiers.yml ([55c3eda](https://github.com/event4u-app/agent-config/commit/55c3eda9c3fd148bae3b620c7214cfaa69ec9eb3))
* **lint:** re-bump leakage allowlist lines after main's content sweep ([c2843ae](https://github.com/event4u-app/agent-config/commit/c2843ae9943305915ddf57ddad971f4e5aaf7799))
* **index:** regenerate agents/index.md + docs/catalog.md after main merge ([2b85d9c](https://github.com/event4u-app/agent-config/commit/2b85d9c9aeb53b84f1be5473c835dd54ba73bb16))
* **build:** regenerate install bundle (flat-command wrappers + packs lockfile) ([9952ae1](https://github.com/event4u-app/agent-config/commit/9952ae1512a1b4a0c76151b26fdf5a12632e1344))
* **roadmap:** add + archive road-to-setup-experience (all phases shipped) ([54f01e5](https://github.com/event4u-app/agent-config/commit/54f01e5ad8ae37e277103973f93abd38c46e476e))

Tests: 6936

## [8.4.1](https://github.com/event4u-app/agent-config/compare/8.4.0...8.4.1) (2026-07-08)

### Bug Fixes

* **package:** ship src/install + agent-src script trees; gate imports at prepack ([77d53bc](https://github.com/event4u-app/agent-config/commit/77d53bcb2e14da1cff308cd0a8dd5d11d8783d5b))

## [8.4.0](https://github.com/event4u-app/agent-config/compare/8.3.0...8.4.0) (2026-07-08)

### Features

* **hooks:** surface-probe SessionStart concern — runtime self-detection ([934f8ae](https://github.com/event4u-app/agent-config/commit/934f8aef6563c53f77937f8d942b5dfd2310cd6b))
* **converge:** consented duplicate-surface cleanup command ([9b35d00](https://github.com/event4u-app/agent-config/commit/9b35d00dd88b747503cb728502b8b5f288fb325a))
* **surface-matrix:** machine-checked per-tool canonical-surface inventory ([cf8e932](https://github.com/event4u-app/agent-config/commit/cf8e932a4ca42d1d83d87b585098e39157467955))
* **plugin:** strip Claude Code plugin to bootstrap shim ([4d1900b](https://github.com/event4u-app/agent-config/commit/4d1900b25bddcf8b0d67858ad7126c279c7522f5))

### Bug Fixes

* **hooks:** surface-probe honors replay mode; fix spy typing in test ([e3900c9](https://github.com/event4u-app/agent-config/commit/e3900c99814cdc371ae5b99ddc9ead09fb2f31cc))

### Documentation

* **context:** unbreak path literal in augment parity note (check-refs) ([d15e4b0](https://github.com/event4u-app/agent-config/commit/d15e4b08a4a5e76cfead11a02d76e4db680186c4))
* **roadmap:** archive install-path-convergence; spawn delist-checkpoint follow-up ([228b727](https://github.com/event4u-app/agent-config/commit/228b72758b938d3c4fdeaee3bbb42a278aa83e27))
* **context:** record Augment surface-parity evidence gate outcome ([9144fc1](https://github.com/event4u-app/agent-config/commit/9144fc18b0eaab9e513180a3cf7dba06984b58ca))

## [8.3.0](https://github.com/event4u-app/agent-config/compare/8.2.0...8.3.0) (2026-07-08)

### Features

* **ci:** add release.yml — merge a `release`-labeled PR to cut a release ([742aa91](https://github.com/event4u-app/agent-config/commit/742aa91c8dc3686a1618291dd425efbc1a69ac13))
* **release:** add --ci mode to release.ts for the label-triggered CI path ([2fc9db6](https://github.com/event4u-app/agent-config/commit/2fc9db6b98fa998a03e68c0e2ce676c40d63c6e8))
* **mcp:** ship the run_tests shell-exec pilot under a compiled safety envelope ([598a8a4](https://github.com/event4u-app/agent-config/commit/598a8a49f05f5e9ebd4c0c531a5424f079eb16b6))
* **guardrails:** hook-matrix single source, golden smoke, doctor-last upgrade step (Phase 4) ([d3ddd37](https://github.com/event4u-app/agent-config/commit/d3ddd37aa9f72dd65cebd54985e121d05a8bc0e6))
* **mcp:** implement the 8 council-approved Phase 4 tools (17 implemented total) ([71f4074](https://github.com/event4u-app/agent-config/commit/71f4074b1b065dd455b361959322ae18c11e0d6d))
* **doctor+docs:** plugin retirement — duplicate-surface/hook-wiring checks, migration flow, docs sweep (Phase 3) ([3f6234d](https://github.com/event4u-app/agent-config/commit/3f6234d82730d0210d72c5712ca49a84fb160c0e))
* **upgrade:** register managed hooks on global deploy; decouple upgrade steps (Phase 2) ([9c06cdb](https://github.com/event4u-app/agent-config/commit/9c06cdba7622691ed8c6b175fbc0f32b975db311))
* **install:** managed Claude hook registration in settings.json (Phase 1) ([f1a7644](https://github.com/event4u-app/agent-config/commit/f1a7644b89a4da1e67b95cf8dc15eda778f4dc67))

### Bug Fixes

* **scripts:** make upstream-remote wiring idempotent in mcp_registry_submit ([b1c5ee1](https://github.com/event4u-app/agent-config/commit/b1c5ee18105cc2845e66b3595743dfe673292f8c))
* **roadmap:** correct mcp-cloud-endpoints doc path in Phase 6 step text ([65ab1d6](https://github.com/event4u-app/agent-config/commit/65ab1d6611edd63242b3f334c4233087975d45b0))
* **ci:** static yaml import + createRequire banner; no unchecked step indexing ([98c71c0](https://github.com/event4u-app/agent-config/commit/98c71c0f88c5e696dd0b5d00ed0e6a38c48717a1))
* **mcp:** use process.stdout.write instead of console.log in glama drift lint ([80b53fe](https://github.com/event4u-app/agent-config/commit/80b53fea3f52f486395ebb9a7ede4ea583014b55))
* **mcp:** fix stale glama build docs and dead pycache artifacts ([ea1cece](https://github.com/event4u-app/agent-config/commit/ea1cece30c097846f3475ac51211a2854223cae8))
* **install:** accept --no-ui in the bash orchestrator (unblocks upgrade) ([a519b34](https://github.com/event4u-app/agent-config/commit/a519b34f9618c5c165d0bcc5c6ea04d7ce141361))
* **release:** era-split gate measures the post-release state the drift test sees ([572e6ce](https://github.com/event4u-app/agent-config/commit/572e6ce83b74d37112213cb790c3a07a1d4e0968))

### Documentation

* **release:** document the dual release path; fix stale release.py refs ([9ae0aee](https://github.com/event4u-app/agent-config/commit/9ae0aeed403376581d656b2682c6009694e9d1b1))
* **adr:** ADR-113 — CI-native release, label trigger, bot-PR-approval finding ([7af715c](https://github.com/event4u-app/agent-config/commit/7af715cc0753fbb77facf904101c317f271863e1))
* **mcp:** Phase 6 — ADR-112 stdio-lite verdict, cloud-scope note, fresh counts ([c6fe3ed](https://github.com/event4u-app/agent-config/commit/c6fe3ed07689b82ea349beb377bd4cf97ceddaca))
* **context:** Phase 0 hook+agent parity findings — settings.json parity CONFIRMED ([b22bc38](https://github.com/event4u-app/agent-config/commit/b22bc38412d76315d4406f41fbd746a70952cdbb))
* **roadmap:** add road-to-claude-code-single-surface (council 2026-07-07, Option B projection-primary) ([cb283c3](https://github.com/event4u-app/agent-config/commit/cb283c3c0dbc52f66337a30a8edb94e084caeda6))
* **mcp:** resolve A0 amendment signoff, run council, record write/exec cut ([323def8](https://github.com/event4u-app/agent-config/commit/323def8c0692c26408791623374d28eee512686a))
* **readme:** add troubleshooting section for install/upgrade failure modes ([ba33679](https://github.com/event4u-app/agent-config/commit/ba336790f6c8f8eac662e72ae2a408338b03b971))

### Chores

* **roadmap:** archive road-to-ci-native-release; spawn first-run follow-up ([1544c3c](https://github.com/event4u-app/agent-config/commit/1544c3c3773f1eded3e3037e4abf04f66d9e5900))
* **mcp:** record registry submission, fix submit-script PR head, park roadmap to later/ ([1f8f49f](https://github.com/event4u-app/agent-config/commit/1f8f49f97d0e443141d53736beea59ea45e780e7))

## [8.2.0](https://github.com/event4u-app/agent-config/compare/8.1.0...8.2.0) (2026-07-07)

### Features

* **hooks:** session-start self-heal for the installed pre-commit gate ([5c5fc68](https://github.com/event4u-app/agent-config/commit/5c5fc68e7d79717746618cad61ee9acd29669515))
* **upgrade:** re-stamp our installed pre-commit hook; doctor: mcp-beta gates skip in consumers ([c736ae9](https://github.com/event4u-app/agent-config/commit/c736ae9dfd3837bc96c999f2eccb2bce096d629b))
* **dispatch:** add roadmap:archive — /create-pr § 1c instructed a command that did not exist ([0ec1af2](https://github.com/event4u-app/agent-config/commit/0ec1af20ed184e25513a0f79f804d2b62eab7b5c))
* **doctor:** claude-plugin staleness check ([82fc8ef](https://github.com/event4u-app/agent-config/commit/82fc8ef4868d1789ac7d0423b04a3f71a1966e20))
* **upgrade:** refresh optional Claude Code plugin and skip wizard ([f2c6cc5](https://github.com/event4u-app/agent-config/commit/f2c6cc5a9a11ff95011894aeb4197b0f46721704))
* **quality:** local_auto_run defaults to false — quality tools run on demand only ([1cecb58](https://github.com/event4u-app/agent-config/commit/1cecb583ed7bdca8d0b5edd49f731dad9b9cb250))
* **upgrade:** sync existing settings files against the new template after upgrade ([4b36117](https://github.com/event4u-app/agent-config/commit/4b361177c033f0dcac76f2a303f31ef70a22f1a3))
* **settings:** balanced preset fills discipline_profile=auto (lift only where measured) ([1d3d304](https://github.com/event4u-app/agent-config/commit/1d3d3042d7430505b30ab4a3f78106a136ba8449))
* **settings:** P2 verdict — vendor-granular unknown_defaults; gpt-5-mini measured null ([16544d5](https://github.com/event4u-app/agent-config/commit/16544d524f227eff35d679094ec91f7b8a09ca6f))

### Bug Fixes

* **ci:** regenerate install bundle; trim work/implement-ticket descriptions under the 200-char cap ([1ca779b](https://github.com/event4u-app/agent-config/commit/1ca779b2521820da0cea0f114ec30b2473ad56f2))
* **content:** stale Python-era instructions swept off the agent surfaces ([4f7f4a8](https://github.com/event4u-app/agent-config/commit/4f7f4a86c30dc3bdad79e65184cf526a38203434))
* **scripts:** realpath-aware CLI entry guards — symlinked invocations silently no-op'd ([0fa2f03](https://github.com/event4u-app/agent-config/commit/0fa2f03e7c7faabd2faad3e39b44160a22b5dd76))
* **hooks:** prefer the package's own tsx over npx in twin-spawn resolution ([b1f8b7e](https://github.com/event4u-app/agent-config/commit/b1f8b7e9bbc71470c16881a195a329039175f640))
* **pack:** ship tests/fixtures/hooks — hooks:replay named payloads 404'd on installs ([a6db852](https://github.com/event4u-app/agent-config/commit/a6db852dc2873b30cd5613a56436f5269377f7bd))
* **roadmap:** fall back to the git toplevel when cwd has no agents/roadmaps ([a04505a](https://github.com/event4u-app/agent-config/commit/a04505a7e0b6a7b0e77cd940e1447eb9b6f12a44))
* **council:** anchor the prices file to the project root, not the installed package ([4ab8cc2](https://github.com/event4u-app/agent-config/commit/4ab8cc2d4bff5a06554b9fc8e260f49e6606a936))
* **templates:** consumer hooks + CI workflows off python3 — gates were silently dead since py2ts ([6c36d8d](https://github.com/event4u-app/agent-config/commit/6c36d8d83c40fc4065b1308985ad8fd6d0d1d021))
* **dispatch:** ship tsx as runtime dependency — consumer hooks and TS commands broke via npx fallback ([0119de6](https://github.com/event4u-app/agent-config/commit/0119de6cabafa10fa85b51d92ab6fcafe313745a))
* **install:** launch setup wizard detached and show version on completion ([f043ad7](https://github.com/event4u-app/agent-config/commit/f043ad752067d6770c3f7d36bb829995c46ff7e7))

### Documentation

* **claude-code:** correct plugin install commands, frame plugin as optional ([1b89b2d](https://github.com/event4u-app/agent-config/commit/1b89b2d261ccc42d3205a705aa2239ded6b0bf79))
* **quality:** gate quality-pipeline runs behind local_auto_run across skills, rules, and commands ([ce9fefd](https://github.com/event4u-app/agent-config/commit/ce9fefd10a47cd9144e6bf0de29a22a4a974ce62))
* **benchmark:** pin the failed P2 replication; three-host evidence ledger ([a77c476](https://github.com/event4u-app/agent-config/commit/a77c4765f221005f59165a67e215ac6bdc03c9d8))

### Chores

* **packs:** regenerate meta pack README after description trim ([96beffb](https://github.com/event4u-app/agent-config/commit/96beffb350d29503b8ab12a6de177c6c8137f332))
* **condense:** propagate the Python-reference sweep into the condensed projections ([b63bc0a](https://github.com/event4u-app/agent-config/commit/b63bc0a31fe2ad42ba37db701d6b4a935a555783))
* **deps:** regenerate lockfile — tsx now a runtime dependency ([68a383d](https://github.com/event4u-app/agent-config/commit/68a383da386095e6fd740b230ac4042e08a8a152))
* **condense:** mark 15 hash-stale command projections as done ([585939d](https://github.com/event4u-app/agent-config/commit/585939d956f5d999e97ab788bd509d642767d512))
* **changelog:** perform the era split the 8.1.0 release missed ([96b43ba](https://github.com/event4u-app/agent-config/commit/96b43baa81488084740d6c4ae479ee0d0d5e563a))
* **sync:** mirror the P2 resolver changes into the dist work-engine lib ([920158b](https://github.com/event4u-app/agent-config/commit/920158b6d619a43fdb3ba63a374a84e6da011440))

### Other

* **install:** named ChildProcess type import (eslint consistent-type-imports) ([34ec4fc](https://github.com/event4u-app/agent-config/commit/34ec4fc6206e0018b4dc559a19375017d6a8a669))

## [8.1.0](https://github.com/event4u-app/agent-config/compare/8.0.0...8.1.0) (2026-07-07)

### Features

* **commit-policy:** one-shot authorization is not a standing license ([259bb1b](https://github.com/event4u-app/agent-config/commit/259bb1b249063e055774c3159be8c584a2db54d3))

### Chores

* **changelog:** split era 7.0.x → pre-8.0.0 ([7aea9be](https://github.com/event4u-app/agent-config/commit/7aea9be499768f7fd76949d607a6503b3324f8c0))
