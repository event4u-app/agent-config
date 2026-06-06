# Changelog Archive — pre-3.1.0

> Frozen snapshot of `event4u/agent-config` changelog entries for
> `3.0.0`, split out of the main
> [`CHANGELOG.md`](../../CHANGELOG.md) on 2026-05-24 once the active
> era's body crossed the drift cap enforced by
> `tests/test_changelog_eras.py`.
>
> **Read-only.** New entries land in `CHANGELOG.md` § "Era: 3.1.x".
> Entries here are not amended — git tag `3.0.0` remains the canonical
> source for what shipped.
>
> Entry shape follows the conventions documented in
> [`docs/contracts/CHANGELOG-conventions.md`](../contracts/CHANGELOG-conventions.md).
> Earlier eras live in
> [`CHANGELOG-pre-3.0.0.md`](CHANGELOG-pre-3.0.0.md),
> [`CHANGELOG-pre-2.25.0.md`](CHANGELOG-pre-2.25.0.md),
> [`CHANGELOG-pre-2.20.0.md`](CHANGELOG-pre-2.20.0.md),
> [`CHANGELOG-pre-2.17.0.md`](CHANGELOG-pre-2.17.0.md),
> [`CHANGELOG-pre-2.16.0.md`](CHANGELOG-pre-2.16.0.md),
> [`CHANGELOG-pre-2.15.0.md`](CHANGELOG-pre-2.15.0.md),
> [`CHANGELOG-pre-2.11.0.md`](CHANGELOG-pre-2.11.0.md),
> [`CHANGELOG-pre-2.7.0.md`](CHANGELOG-pre-2.7.0.md), and
> [`CHANGELOG-pre-2.2.0.md`](CHANGELOG-pre-2.2.0.md).

## [3.0.0](https://github.com/event4u-app/agent-config/compare/2.26.0...3.0.0) (2026-05-21)

### BREAKING CHANGES

* **wizard:** remove legacy /onboard chat skill and skill-bridge IPC ([04acd29](https://github.com/event4u-app/agent-config/commit/04acd290a0e50cb675b987b57ecfe2086dd2be04))

### Features

* **scripts:** add lint_agents_layout enforcing agents/ flat-file whitelist ([77070e4](https://github.com/event4u-app/agent-config/commit/77070e4a53873ad3a5e1425e119f5762e455efc0))
* **storage:** default wizard writes to user-scope with legacy-read fallback ([974c4d9](https://github.com/event4u-app/agent-config/commit/974c4d9ca53fcbd7f36ac4f7e06f5125733f72cf))
* **wizard:** move step nav from header chips to summary jump-list ([648824f](https://github.com/event4u-app/agent-config/commit/648824f57483945de78167aa5662ded65c8845e4))
* **wizard:** dry-run mode, error handling, expanded schema help text ([8ea254b](https://github.com/event4u-app/agent-config/commit/8ea254baa2f8fab0bebdd6cbd494a7ebd1b014df))
* **wizard:** add dry-run mode to setup, settings, and ui:serve ([d369553](https://github.com/event4u-app/agent-config/commit/d369553aa48486d8fe6a6ca4137df0004f9dfae8))
* **ui:** 7-step wizard + Settings page + .agent-user.md panel ([135b35c](https://github.com/event4u-app/agent-config/commit/135b35ca11d6203f0111aaf2b9d89da58c9aa735))
* **ui:** form primitives + schema-driven form renderer ([4dfde4e](https://github.com/event4u-app/agent-config/commit/4dfde4e5c6730b80350dd5b08ee665f26383044a))
* **ui:** scaffold Preact SPA shell (entry + router + API client) ([cc1e395](https://github.com/event4u-app/agent-config/commit/cc1e395e9d48018b07cde68656f50c6b55a2f64e))
* **cli:** add 'agent-config settings' subcommand ([e799119](https://github.com/event4u-app/agent-config/commit/e799119041114323c05ddf24a5033567295e81c7))
* **server:** inline settings JSON-Schema + 7-step wizard count ([a46948c](https://github.com/event4u-app/agent-config/commit/a46948c0db2f833bd87859a308ef3df9fa4c2183))
* **server:** GUI skill-bridge discovery files ([01b3889](https://github.com/event4u-app/agent-config/commit/01b388902585c18657ff46940f40363abe312180))
* **cli:** add onboard:finish subcommand for chat-skill convergence ([ccac4f9](https://github.com/event4u-app/agent-config/commit/ccac4f900ae3906dcfc70d11f00b5d377bf576de))
* **setup-wizard:** wire settings API into app + 2PC boot replay ([bf2b1c9](https://github.com/event4u-app/agent-config/commit/bf2b1c9028ac5f3698a7605d94b46727ea4f4c70))
* **setup-wizard:** add settings API routes (settings, userMd, wizard, schema) ([f1256b1](https://github.com/event4u-app/agent-config/commit/f1256b11d47bc5a9d2e8b50291c8b076c1f8836e))
* **setup-wizard:** add atomic IO primitives for 2PC wizard commit ([1b5dbda](https://github.com/event4u-app/agent-config/commit/1b5dbdad51cda3fcfa625f1053ec2da1286493f4))
* **gui:** phase 0 — contracts (ADR-014, schemas, design tokens, API doc) ([96462e6](https://github.com/event4u-app/agent-config/commit/96462e6c25b104c94a2a036af29f9ab8122f982d))
* **visibility:** R5 Phase 4 — docs, decay policy, roadmap archival ([4de0c22](https://github.com/event4u-app/agent-config/commit/4de0c224f58f125df803c15848a259bec5a159dc))
* **visibility:** R5 Phase 3 — positioning consistency lint ([68daa4f](https://github.com/event4u-app/agent-config/commit/68daa4f6d0ec09939c424bfadfaf3382941e7c8f))
* **visibility:** R5 Phase 2 — MCP registry manifest + lifecycle tracking ([e0b8f8b](https://github.com/event4u-app/agent-config/commit/e0b8f8b8ac7d78a603405429b179e9a0fd985735))
* **visibility:** topics-as-code + about manifest + split sync/drift workflows ([d61c648](https://github.com/event4u-app/agent-config/commit/d61c648377b705b04b57a38246c52259e1f22d2a))
* **explain-last:** wire halt + provider why-slots into trace and renderer ([92d5bfc](https://github.com/event4u-app/agent-config/commit/92d5bfc67f83b1dcd7242e3d85502915e195b29b))
* **work-engine:** persist HookHalt events into state.halts for explainability ([68fe11e](https://github.com/event4u-app/agent-config/commit/68fe11e204c7b0fb94d1201eb867f0a41a443a90))
* **explain:** wire 'last' subcommand into cmd_explain dispatcher ([f871d67](https://github.com/event4u-app/agent-config/commit/f871d67bcc3bc2104d3ae7b67643684ba912f3d1))
* **explain:** add explain_last trace builder package ([af32423](https://github.com/event4u-app/agent-config/commit/af32423c7a4d1df382fcf98df018ad0d4859ff97))
* **settings:** add explain.enable_last knob ([1c518d8](https://github.com/event4u-app/agent-config/commit/1c518d8948421eae86d3f02961b6bb6a186a712c))
* **explain:** lock ExplainTrace v1 schema and lint surface (Phase 1) ([6f81f65](https://github.com/event4u-app/agent-config/commit/6f81f65c901a8b9ba6582b4218bb6a0c6cbf9c09))
* **discovery:** add artefact frontmatter linter (Phase 6.1) ([ce49720](https://github.com/event4u-app/agent-config/commit/ce49720f0b0405c13e07ba2fff6cfc86cfc2f379))
* **discovery:** wire release pipeline to ship manifest (Phase 5) ([61aea0a](https://github.com/event4u-app/agent-config/commit/61aea0a97991395b75a4b392e8fa789030dbdb73))
* **discovery:** auto-strict scanner under CI (Phase 4.4) ([1b2b0b3](https://github.com/event4u-app/agent-config/commit/1b2b0b3472bda036be03cdfb3b649d2c19594b43))
* **discovery:** annotate meta pack + quarantine scaffold templates ([941a5c4](https://github.com/event4u-app/agent-config/commit/941a5c4190cd507750fcb4ba090b735a684b33a4))
* **discovery:** annotate vertical packs (product, gtm, finance, ops, founder, ai-video) ([5d96d37](https://github.com/event4u-app/agent-config/commit/5d96d37681772283ee8b4e236b6f6f21b742bcfc))
* **discovery:** annotate language/framework packs ([9af770f](https://github.com/event4u-app/agent-config/commit/9af770ffc708fa402c513896c414bf5566fafeab))
* **discovery/engineering-base:** annotate engineering-base pack ([a6f498f](https://github.com/event4u-app/agent-config/commit/a6f498fc389642acc3d9a1a4dea60ce8d96397ff))
* **discovery/php:** annotate php pack (pilot) ([2f94b33](https://github.com/event4u-app/agent-config/commit/2f94b331ae317d9996d05bd1a87bacbd47f6eb6b))
* **discovery:** Phase 4 annotation helper ([2d5b816](https://github.com/event4u-app/agent-config/commit/2d5b81610d1eea7e36f492d35efdd01a0fee26cb))
* **discovery:** R3 Phase 3 — TS CLI subcommands + Fastify discovery route ([5d58a6d](https://github.com/event4u-app/agent-config/commit/5d58a6d5852b2d7058159df7241fb144251bde47))
* **discovery:** R3 Phase 2 — release-time scanner + manifest tooling ([784d072](https://github.com/event4u-app/agent-config/commit/784d0720cbea94304d4b8f75edf64152b221686f))
* **discovery:** R3 Phase 1 — workspace & pack vocabulary as YAML ([ca08f1e](https://github.com/event4u-app/agent-config/commit/ca08f1ea9de0f3b8d52cb5b9746fb9ee56d749f8))
* **discovery:** R3 Phase 0 — frontmatter contract and manifest schema ([633973e](https://github.com/event4u-app/agent-config/commit/633973e810f7cbf4758afe4151c20f8b01cab959))
* **ui:** Vite UI scaffold (placeholder) ([169edbd](https://github.com/event4u-app/agent-config/commit/169edbd53de0b7be1d6454df7d3c7e3e3cbbf0c6))
* **server:** embed Fastify server with security guards ([8c2f9ff](https://github.com/event4u-app/agent-config/commit/8c2f9ffde3126681a63a8f1cd04397fda2e536f8))
* **cli:** TypeScript entry binary as thin forwarder ([df6c92c](https://github.com/event4u-app/agent-config/commit/df6c92c3b3aa3b63fb6edf54670f8a5d166e57f9))

### Bug Fixes

* **ci:** sync condensed outputs (fetch description, failure-modes heading, agent-settings code block) ([6bb9b36](https://github.com/event4u-app/agent-config/commit/6bb9b363a46310ffe32d1859ed356eaf0cbd6b18))
* **ci:** propagate path refactor into dist/agent-src/, trim ghostwriter description ([2747288](https://github.com/event4u-app/agent-config/commit/2747288b62ee4135d5f5459d2864f3a8fe0ce97a))
* **ui:** surface field errors on wizard step nav and toggle/radio inputs ([3abd156](https://github.com/event4u-app/agent-config/commit/3abd1560691397a4bfbf85f1279b6f9146513418))
* **roadmaps:** update wizard-install-py-wiring parent link to archive path ([a40ae6e](https://github.com/event4u-app/agent-config/commit/a40ae6e2da01e2b96120af3fe87f2a787dc9b076))
* **ui:** close diff modal and focus first errored field on save failure ([dd5bc72](https://github.com/event4u-app/agent-config/commit/dd5bc7236e26757dc4f809f49ee8f600710baebf))
* **server:** wrap userMd through commitMulti helper for parity ([752199c](https://github.com/event4u-app/agent-config/commit/752199cf3907fca27b8198989b9edbc5ce56c28a))
* **server:** satisfy noUncheckedIndexedAccess in yamlIO.replaceScalar ([53e9759](https://github.com/event4u-app/agent-config/commit/53e97597e87b41744e939ae9dd4c6ff5d804ca86))
* **server:** hoist inline import() types to top-level import type ([515ddda](https://github.com/event4u-app/agent-config/commit/515dddadf391410b76c93d5829e27a2948b011e5))
* **readme:** keep line count under lint floor + drop archived-roadmap link ([2b5e63c](https://github.com/event4u-app/agent-config/commit/2b5e63c3f29d74a20c344455d015d89cec326abd))
* **sync:** drop stale .pytest_cache hash entry ([31dcaa4](https://github.com/event4u-app/agent-config/commit/31dcaa4cf614566db36f566a2388dc3f1a4dba0f))
* **discovery:** allow ADR-013 discovery frontmatter in JSON schemas ([4100ef4](https://github.com/event4u-app/agent-config/commit/4100ef45796144e3e3bbf8c1a9cfd704ac9749cb))
* **discovery:** absorb +189 frontmatter into concentration allowlist ([d0e160d](https://github.com/event4u-app/agent-config/commit/d0e160db9b575b95c73c9423a089f2018bb76f92))
* **discovery:** shift framework-leakage allowlist by +12 after frontmatter inject ([6deacba](https://github.com/event4u-app/agent-config/commit/6deacba9523f7519a17b65e79f9e5b5f88f96371))
* **discovery:** mirror generated_at normalisation in manifest linter ([5a30bf6](https://github.com/event4u-app/agent-config/commit/5a30bf65b87d86655bddcc2598b13d8ad5d61c32))
* **discovery:** exclude generated_at from manifest checksum ([84dd81a](https://github.com/event4u-app/agent-config/commit/84dd81ab6eeb886ed2cb449eaf975466f16a5cd5))
* **discovery:** allow documented_unassigned in manifest schema ([357a817](https://github.com/event4u-app/agent-config/commit/357a817d30486d5dc420ac326c625d0ec1277e00))
* **discovery:** defer strict mode to --strict flag only (Phase 4.4 gate) ([45c1d67](https://github.com/event4u-app/agent-config/commit/45c1d679d26c8eae2c2f666400973cd170813660))
* **golden:** silence deprecation banner in capture runner ([a98ed4e](https://github.com/event4u-app/agent-config/commit/a98ed4eaebb32cab229e5bce038000abdbf13f50))
* **ci:** build dist before test:ts + restore symlink-safe shim ([ebd64a6](https://github.com/event4u-app/agent-config/commit/ebd64a6dd77ba2c474982ff88d1e9ee429cfd9b1))

### Documentation

* **wizard:** pivot onboarding-gate and consumer docs to agent-config setup ([be83c1b](https://github.com/event4u-app/agent-config/commit/be83c1b4a6aa16400a3c5f5ce80571bcbff26dbd))
* **readme:** tighten quickstart wizard line to stay at 750-line cap ([9ebe01f](https://github.com/event4u-app/agent-config/commit/9ebe01f4b46f3a32c59a546243c1cf7023f7026b))
* **setup-gui:** wizard guide + customization + contracts ([dcd1ecb](https://github.com/event4u-app/agent-config/commit/dcd1ecb68b7fa84060108ddb273b593983809b6b))
* **contracts,customization:** document /onboard ↔ wizard convergence ([0a7c707](https://github.com/event4u-app/agent-config/commit/0a7c7074aff338c18517deeec006a051ddafc59a))
* **skill:** rewrite /onboard to use agent-config onboard:finish ([2a0053d](https://github.com/event4u-app/agent-config/commit/2a0053dd71d4feb7d44bee70833f40607f9b143c))
* **contracts:** add onboard-skill-wizard bridge IPC contract ([08b5e22](https://github.com/event4u-app/agent-config/commit/08b5e22928760f3677408989373ba14c0ccff125))
* **roadmap:** carve out /onboard convergence as follow-up (council HARD-BLOCKER) ([16445fe](https://github.com/event4u-app/agent-config/commit/16445fe005e7f1545aa98c5318c770d99ac62e9a))
* **readme:** condense explainability blurb to stay under 750-line lint floor ([f5e1882](https://github.com/event4u-app/agent-config/commit/f5e1882c304acabb2993d98ec0aad0b69fddd2b4))
* **explain:** document 'explain last' in customization.md and README ([dc5fe30](https://github.com/event4u-app/agent-config/commit/dc5fe304bca51ade2d94a04c09bcd816399b991a))
* **discovery:** point references at archived R3 roadmap + virtual-pack note + sha256 sidecar ([1437b82](https://github.com/event4u-app/agent-config/commit/1437b8289fbf8578ccda283eb8ce810012232676))
* **discovery:** add Phase 4 annotation audit trail + fix archive ref ([9f034a8](https://github.com/event4u-app/agent-config/commit/9f034a8edd2d8009a931e30c600474e9b4d88935))
* **roadmap:** mark R3 Phases 4-6 + council resolution complete ([1b0bb2d](https://github.com/event4u-app/agent-config/commit/1b0bb2d3c718c97f328496d65163081796f4ba65))
* **discovery:** cross-link ADR-013 from AGENTS.md and customization (Phase 6.2) ([acd82af](https://github.com/event4u-app/agent-config/commit/acd82af601547bb4dfe48ec8ca59c01142e4a20a))
* **adr:** add ADR-012 — TypeScript CLI shell ([29e6bc4](https://github.com/event4u-app/agent-config/commit/29e6bc45c06bcbc41c48d3e984128b6716b795c2))

### Refactoring

* relocate durable records (runtime→evidence, low-impact→decisions) ([6d72262](https://github.com/event4u-app/agent-config/commit/6d722620d1d289ccd18fa05010f134f9cf088595))
* consolidate agents/ into privilege-first taxonomy ([d2ce674](https://github.com/event4u-app/agent-config/commit/d2ce6748872fcda71a58517202882b4d49b7f82f))
* **agents:** relocate council to runtime/, audit bundles to audits/, ai-council config to settings/ ([8cee3b3](https://github.com/event4u-app/agent-config/commit/8cee3b3a4b8c43d1036047324d2c3e9ad1615fce))
* relocate user-md schema to shared and drop gray-matter ([cd9dba7](https://github.com/event4u-app/agent-config/commit/cd9dba7511637a8ca858d416e6b20609c3097b10))

### Tests

* **command-suggester:** drop onboard-specific assertion ([61c925b](https://github.com/event4u-app/agent-config/commit/61c925b30399b7903847a53b7b04e2a008b5bf7c))
* Phase 5 evidence — server routes, atomic writes, wizard state, UI pages ([b968d06](https://github.com/event4u-app/agent-config/commit/b968d06892a0ba8039811e33004fed20c6c27cea))
* **ui:** wizard flow + resume acceptance gates ([e63b54d](https://github.com/event4u-app/agent-config/commit/e63b54d908c7b0a4d5abc96c97f46619f8993f37))
* **server:** parity gate — onboard:finish ↔ wizard byte-identical ([4d4c7e4](https://github.com/event4u-app/agent-config/commit/4d4c7e48aa19bbda1814dc2058bc8e25d7be90bc))
* **golden:** regenerate GT baselines after adding state.halts field ([0363256](https://github.com/event4u-app/agent-config/commit/036325610bd97ac911ea94fbc5be578efc4b6ed5))
* **explain:** add 43-test coverage suite + fixtures ([765392c](https://github.com/event4u-app/agent-config/commit/765392c7a70d954caf6db7a4afd2a0c49ec5be7e))
* **ts:** cover CLI forwarder, server, and UI build ([a4bc38b](https://github.com/event4u-app/agent-config/commit/a4bc38b3fde0bc77565caaf21fa681884c445f2f))

### CI

* **tests:** install jsonschema for explain-trace contract validation ([3448273](https://github.com/event4u-app/agent-config/commit/3448273d16115cbb4b57f73fef34a3a64cd0ee8f))
* **ts:** wire TypeScript gates + ship local-server-api contract ([68bcf86](https://github.com/event4u-app/agent-config/commit/68bcf86ffec4b47c935f2db27fe0909002c1fb84))

### Chores

* untrack agents/runtime/ as volatile local-only ([2b87436](https://github.com/event4u-app/agent-config/commit/2b87436e7916fb145a5db16ed9e71e7e9d1f4046))
* capture 2026-05-18 AI council responses for taxonomy convergence ([821def9](https://github.com/event4u-app/agent-config/commit/821def9e687d29db3e41b49c89bd3bed81274223))
* **roadmap:** land onboarding-wizard-takeover and regenerated indexes ([5d26671](https://github.com/event4u-app/agent-config/commit/5d26671223c3d8244bac4f3d00aabc04a20b2667))
* **rules:** trim auto-rule descriptions to fit 95% augment budget ([7a3fa4a](https://github.com/event4u-app/agent-config/commit/7a3fa4a00343603c3ab4155458f2c74d4c7ce770))
* **roadmap:** close unified-setup-and-settings-gui + archive + sibling frontmatter ([6bfc11e](https://github.com/event4u-app/agent-config/commit/6bfc11e045d7b40cd27268f9ea517a05c5111d15))
* **roadmap:** close phases 1-4 of unified-setup-and-settings-gui + carve out install.py wiring ([a460ef4](https://github.com/event4u-app/agent-config/commit/a460ef434f1b7ca78e7109e90e7a785fdc2abe8e))
* **build:** wire Preact + Signals + happy-dom for GUI ([483630b](https://github.com/event4u-app/agent-config/commit/483630b693b86dc1591b59ace22ee881c1a8df83))
* **roadmap:** archive completed convergence roadmap ([9b5f9fe](https://github.com/event4u-app/agent-config/commit/9b5f9fe7ee86f5c6415c77589cba716ee0d73ca3))
* **policy:** add project-local TypeScript-first engineering policy ([9b4f0b8](https://github.com/event4u-app/agent-config/commit/9b4f0b85734d4ec6e73cd1cf361fd880bd7614f9))
* **rules:** add pre-PR freshness gate to prevent stale-base conflicts ([c913a7f](https://github.com/event4u-app/agent-config/commit/c913a7fa3ab78bbb090c4203e3d291063a90be57))
* **sync:** regenerate condensed mirrors + hashes for trimmed descriptions ([fe8c7c2](https://github.com/event4u-app/agent-config/commit/fe8c7c23e9127a5031ece5b0f85e68dcbde59c2a))
* **rules:** trim 4 over-budget rule descriptions to ≤150 chars ([326f7d1](https://github.com/event4u-app/agent-config/commit/326f7d1f68d1fd2e438d1e6d5caf7c0b2ddc09dc))
* **ownership:** regenerate file-ownership matrix ([aaabe42](https://github.com/event4u-app/agent-config/commit/aaabe4220edebea9f52185bf9322893cb5540f6c))
* **lint:** allowlist 2 pre-existing multi-stack enumerations ([e192281](https://github.com/event4u-app/agent-config/commit/e1922817e251aeb2b9fd0e47735b93ca08fb26ad))
* **roadmap:** mark phase 0 done on onboard-skill-wizard-convergence ([9c642f3](https://github.com/event4u-app/agent-config/commit/9c642f37e0fcc9e25f0f39ddc61ba6dc216a95a2))
* **roadmap:** close and archive explainability-v2-explain-last ([5016b20](https://github.com/event4u-app/agent-config/commit/5016b202dbf2015461f13ea8786ad0ccb2538a2d))
* **roadmap:** mark Phase 3 of explainability-v2-explain-last complete ([b7bbed7](https://github.com/event4u-app/agent-config/commit/b7bbed775a279ca7179a9433cd0c33b1395ac102))
* **roadmap:** close and archive R3 — automated-pack-workspace-and-skill-discovery ([f67f0ec](https://github.com/event4u-app/agent-config/commit/f67f0ecff81ce35b99a396b55a2b99d80d11db9d))
* **templates:** bump agent_config_version pin to 2.26.0 ([ad0f30f](https://github.com/event4u-app/agent-config/commit/ad0f30f9f219636a3a711ee86bafd2b3456eacf8))
* **index:** regenerate after Phase 4 annotation lands ([25ec177](https://github.com/event4u-app/agent-config/commit/25ec1773bf0518931e7c39abf292af4a0e074e79))
* **roadmap:** flip R3 Phases 0–3 + regenerate progress dashboard ([03d0b26](https://github.com/event4u-app/agent-config/commit/03d0b266dc4ff85bbb400373f43227c54ed4d694))
* **roadmap:** persist progress-sync rule across autonomous runs ([db06aae](https://github.com/event4u-app/agent-config/commit/db06aae4f8e60b2a92925057902cce241c723a2b))
* **roadmaps:** archive typescript-cli-and-local-gui-foundation (delivered in PR #187) ([d87e5ff](https://github.com/event4u-app/agent-config/commit/d87e5ffb42099ca9664538a7c057f7b434548501))
* **deps:** scaffold TypeScript toolchain for CLI shell ([453dcdd](https://github.com/event4u-app/agent-config/commit/453dcddb638a175b6cdcdb99ba31e476dcae2968))
* **roadmaps:** archive framework-neutrality-audit (shipped in 2.26.0) ([4935c26](https://github.com/event4u-app/agent-config/commit/4935c2640c80557ec949ac3c841a3bb5d2b335e6))

Tests: 4697 (+52 since 2.26.0)

