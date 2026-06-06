# Changelog Archive — pre-4.5.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `4.5.0`, split out of the main
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

## [4.5.0](https://github.com/event4u-app/agent-config/compare/4.3.0...4.5.0) (2026-05-27)

### Features

* **wizard:** move name + language to a welcome step (Step 1) with smart pre-fill ([98fc74d](https://github.com/event4u-app/agent-config/commit/98fc74d3da2337c811d59e22bbcde75daa1ae623))
* **wizard:** badge packs with their workspace areas on the packs step ([0c16a81](https://github.com/event4u-app/agent-config/commit/0c16a81c9479f66e5b66a666eef39d7555fca6e2))
* **wizard:** show example roles per area instead of the raw workspace id ([b60e08d](https://github.com/event4u-app/agent-config/commit/b60e08d56dffe5151b25cec7ddb0394d47123e5a))
* **wizard-ui:** show the role id under each workspace on the roles step ([5556afa](https://github.com/event4u-app/agent-config/commit/5556afa7b410d9963eef4abcd1e1f4cb72bcd6cf))
* **wizard-ui:** show the role id under each workspace on the roles step ([8dd4611](https://github.com/event4u-app/agent-config/commit/8dd46113f856b1c8bb0c7bf12d8594ee1b898b97))
* optimize autonomy-mechanics ([615c368](https://github.com/event4u-app/agent-config/commit/615c368a6f07394468247b9a2b281114c29f290f))
* **wizard:** add roles step (Step 2) + drop the formality setting ([7331651](https://github.com/event4u-app/agent-config/commit/7331651e2d7915b13a9a639414884cffea277a19))
* **wizard-ui:** smarter Step-1/2 pre-selection, sticky frameworks, empty-selection gate ([8de1e0e](https://github.com/event4u-app/agent-config/commit/8de1e0e6f50408d82b4d3f3ee3b35296aefb472f))
* **wizard:** surface prior tool selection from the install lockfile ([cdacbe0](https://github.com/event4u-app/agent-config/commit/cdacbe0292b60a447966ee976e18382da274756f))
* **init:** kill a stale wizard server before launching a fresh one ([dd57b7f](https://github.com/event4u-app/agent-config/commit/dd57b7f5ec121dc3abc2815fdcfcf26dc10c930a))
* **wizard:** auto-shut the server down after 30 min of inactivity ([5f9514f](https://github.com/event4u-app/agent-config/commit/5f9514fb869df901fb184b7ff7b8c4f0e14ddf91))
* **wizard:** shut the local server down when the browser window closes ([77d3c4f](https://github.com/event4u-app/agent-config/commit/77d3c4fcdd3e35f43daeb1a39e27e9e48653ef98))
* **wizard-ui:** first-run detection, pack tiles, styled inputs, handoff, rtk + AI-council steps ([f1755ed](https://github.com/event4u-app/agent-config/commit/f1755ed23687c6b6013480c1e743eabf0a53807a))
* **packs:** advisory `cluster:` field for wizard language→framework grouping ([b2a2ed9](https://github.com/event4u-app/agent-config/commit/b2a2ed979666b9f20686c30a3529b5ee9c8004fb))
* **wizard-server:** fresh-start state + tool/rtk/council detect & config endpoints ([c32d87c](https://github.com/event4u-app/agent-config/commit/c32d87c020006e3759f5a3aec362450650bb6de1))

### Bug Fixes

* **ci:** regenerate pack-ai-video for the description change + fix userMd test resets ([cd4509d](https://github.com/event4u-app/agent-config/commit/cd4509d6a5601b5d6ca8d4bd4adef53a3e9468bb))
* **condense-memory:** preserve URLs, link targets, and paths in prose ([aac6de1](https://github.com/event4u-app/agent-config/commit/aac6de1710a06f29be43c732aeb1c0e707bdfc69))
* **wizard:** pre-select the user's prior tool selection, not every deployed tool ([afe38a3](https://github.com/event4u-app/agent-config/commit/afe38a3458818ab532f01266b7e17708bfb1702b))
* **packs:** allow `cluster` in the discovery-manifest schema ([9014e95](https://github.com/event4u-app/agent-config/commit/9014e95983bff5e3b7acd96bd249ffced11a109c))
* **template:** bump agent-project-settings pin to 4.3.0 ([c2648ce](https://github.com/event4u-app/agent-config/commit/c2648cef51a8b587e1e3c7be536c3b46fbdd7410))

### Documentation

* **adr-013:** record the advisory example_roles key on workspaces ([ebcc661](https://github.com/event4u-app/agent-config/commit/ebcc66164bc6ce0201695bf293515f309d8efcf4))
* **wizard:** roles step + remove formality from schema docs and user commands ([06f890e](https://github.com/event4u-app/agent-config/commit/06f890e2e259016417b0a808f4e8c92e53c0ebea))
* **gui-wizard:** document Step-1/2 pre-selection, sticky frameworks, empty-selection gate ([ca273de](https://github.com/event4u-app/agent-config/commit/ca273de6e3e8b182fa98ddaff985cf4acb31eb91))
* **gui-wizard:** document 30-min idle shutdown + init kill-stale-server ([dfcdc40](https://github.com/event4u-app/agent-config/commit/dfcdc4054b85edab426abcb0bb4f2672d373c554))
* **gui-wizard:** document the browser-close shutdown beacon + idle backstop ([4eccc51](https://github.com/event4u-app/agent-config/commit/4eccc5117a802c1a0d57b7a98d7eea7a36d0078a))
* **roadmap:** complete + archive road-to-wizard-ux-improvements ([e02d514](https://github.com/event4u-app/agent-config/commit/e02d5145c9343126a2aa049811fc8094de8fa542))
* **gui-wizard:** step layout 8/11 + ai-council step + new wizard endpoints ([fdbcd9c](https://github.com/event4u-app/agent-config/commit/fdbcd9c494ec2785375ed1d3f1e130e3a4cb99ba))

### Tests

* **wizard:** roles step coverage + formality removal + step-count shifts ([5f8ec3e](https://github.com/event4u-app/agent-config/commit/5f8ec3ee4a1f135ee00e60ca612a2b4f09dbd7ba))
* **wizard:** cover detection, packs cluster, handoff, rtk, AI-council + step-count shifts ([5b6b758](https://github.com/event4u-app/agent-config/commit/5b6b7581e784bf5b219d30981f614e3778ccaaad))

### Chores

* **changelog:** split era 3.2.x → pre-4.0.0 ([10a6dd4](https://github.com/event4u-app/agent-config/commit/10a6dd415e5e8f3a60714898ad9157484b6a29e2))
* refresh condensation hashes for the autonomy/cheap-question contexts ([843f065](https://github.com/event4u-app/agent-config/commit/843f0658e1ac965c1dc44aebce26cec29744a0a7))
* add new roadmaps ([76ec1e3](https://github.com/event4u-app/agent-config/commit/76ec1e392b656c2177b7b9e1f75d5c6a1d1976e4))
* **docs:** repoint council-question links + ignore agents/tmp.old/ ([984512e](https://github.com/event4u-app/agent-config/commit/984512e623f25e9d336647d5190d3cfc2969d9b5))

### Other

* **wizard:** shrink the workspace badges on the packs step ([9af0d1e](https://github.com/event4u-app/agent-config/commit/9af0d1ea68302e3d3ef22b4a62955dfe2c54074b))
* Revert "feat(wizard-ui): show the role id under each workspace on the roles step" ([a22120c](https://github.com/event4u-app/agent-config/commit/a22120c3625c2535b85c05b9c7dcbfc2f3849d1f))
* 4.4.0 ([e2d7c13](https://github.com/event4u-app/agent-config/commit/e2d7c139a910f0539cece0ce0645259fc8d778fd))

Tests: 5059 (+7 since 4.3.0)

## [4.4.0](https://github.com/event4u-app/agent-config/compare/4.3.0...4.4.0) (2026-05-27)

### Features

* optimize autonomy-mechanics ([615c368](https://github.com/event4u-app/agent-config/commit/615c368a6f07394468247b9a2b281114c29f290f))
* **wizard:** add roles step (Step 2) + drop the formality setting ([7331651](https://github.com/event4u-app/agent-config/commit/7331651e2d7915b13a9a639414884cffea277a19))
* **wizard-ui:** smarter Step-1/2 pre-selection, sticky frameworks, empty-selection gate ([8de1e0e](https://github.com/event4u-app/agent-config/commit/8de1e0e6f50408d82b4d3f3ee3b35296aefb472f))
* **wizard:** surface prior tool selection from the install lockfile ([cdacbe0](https://github.com/event4u-app/agent-config/commit/cdacbe0292b60a447966ee976e18382da274756f))
* **init:** kill a stale wizard server before launching a fresh one ([dd57b7f](https://github.com/event4u-app/agent-config/commit/dd57b7f5ec121dc3abc2815fdcfcf26dc10c930a))
* **wizard:** auto-shut the server down after 30 min of inactivity ([5f9514f](https://github.com/event4u-app/agent-config/commit/5f9514fb869df901fb184b7ff7b8c4f0e14ddf91))
* **wizard:** shut the local server down when the browser window closes ([77d3c4f](https://github.com/event4u-app/agent-config/commit/77d3c4fcdd3e35f43daeb1a39e27e9e48653ef98))
* **wizard-ui:** first-run detection, pack tiles, styled inputs, handoff, rtk + AI-council steps ([f1755ed](https://github.com/event4u-app/agent-config/commit/f1755ed23687c6b6013480c1e743eabf0a53807a))
* **packs:** advisory `cluster:` field for wizard language→framework grouping ([b2a2ed9](https://github.com/event4u-app/agent-config/commit/b2a2ed979666b9f20686c30a3529b5ee9c8004fb))
* **wizard-server:** fresh-start state + tool/rtk/council detect & config endpoints ([c32d87c](https://github.com/event4u-app/agent-config/commit/c32d87c020006e3759f5a3aec362450650bb6de1))

### Bug Fixes

* **wizard:** pre-select the user's prior tool selection, not every deployed tool ([afe38a3](https://github.com/event4u-app/agent-config/commit/afe38a3458818ab532f01266b7e17708bfb1702b))
* **packs:** allow `cluster` in the discovery-manifest schema ([9014e95](https://github.com/event4u-app/agent-config/commit/9014e95983bff5e3b7acd96bd249ffced11a109c))
* **template:** bump agent-project-settings pin to 4.3.0 ([c2648ce](https://github.com/event4u-app/agent-config/commit/c2648cef51a8b587e1e3c7be536c3b46fbdd7410))

### Documentation

* **wizard:** roles step + remove formality from schema docs and user commands ([06f890e](https://github.com/event4u-app/agent-config/commit/06f890e2e259016417b0a808f4e8c92e53c0ebea))
* **gui-wizard:** document Step-1/2 pre-selection, sticky frameworks, empty-selection gate ([ca273de](https://github.com/event4u-app/agent-config/commit/ca273de6e3e8b182fa98ddaff985cf4acb31eb91))
* **gui-wizard:** document 30-min idle shutdown + init kill-stale-server ([dfcdc40](https://github.com/event4u-app/agent-config/commit/dfcdc4054b85edab426abcb0bb4f2672d373c554))
* **gui-wizard:** document the browser-close shutdown beacon + idle backstop ([4eccc51](https://github.com/event4u-app/agent-config/commit/4eccc5117a802c1a0d57b7a98d7eea7a36d0078a))
* **roadmap:** complete + archive road-to-wizard-ux-improvements ([e02d514](https://github.com/event4u-app/agent-config/commit/e02d5145c9343126a2aa049811fc8094de8fa542))
* **gui-wizard:** step layout 8/11 + ai-council step + new wizard endpoints ([fdbcd9c](https://github.com/event4u-app/agent-config/commit/fdbcd9c494ec2785375ed1d3f1e130e3a4cb99ba))

### Tests

* **wizard:** roles step coverage + formality removal + step-count shifts ([5f8ec3e](https://github.com/event4u-app/agent-config/commit/5f8ec3ee4a1f135ee00e60ca612a2b4f09dbd7ba))
* **wizard:** cover detection, packs cluster, handoff, rtk, AI-council + step-count shifts ([5b6b758](https://github.com/event4u-app/agent-config/commit/5b6b7581e784bf5b219d30981f614e3778ccaaad))

### Chores

* refresh condensation hashes for the autonomy/cheap-question contexts ([843f065](https://github.com/event4u-app/agent-config/commit/843f0658e1ac965c1dc44aebce26cec29744a0a7))
* add new roadmaps ([76ec1e3](https://github.com/event4u-app/agent-config/commit/76ec1e392b656c2177b7b9e1f75d5c6a1d1976e4))
* **docs:** repoint council-question links + ignore agents/tmp.old/ ([984512e](https://github.com/event4u-app/agent-config/commit/984512e623f25e9d336647d5190d3cfc2969d9b5))

Tests: 5055 (+3 since 4.3.0)

## [4.3.0](https://github.com/event4u-app/agent-config/compare/4.2.0...4.3.0) (2026-05-27)

### Features

* **init:** open the browser wizard directly when the GUI is usable ([aef9c0f](https://github.com/event4u-app/agent-config/commit/aef9c0ff10a06ab1e057bb93dbb8ec908398673e))

### Documentation

* **gui-wizard:** init opens the GUI in the TS CLI, not via install.py ([7a2a29d](https://github.com/event4u-app/agent-config/commit/7a2a29d5878f6177aea0d710bed11e89d4c35c36))

### Tests

* **init:** cover GUI-vs-CLI routing for the install front-end ([2f593a6](https://github.com/event4u-app/agent-config/commit/2f593a6bc52996ebc189aeeb595ca4d513a332e5))

Tests: 5052 (+0 since 4.2.0)

## [4.2.0](https://github.com/event4u-app/agent-config/compare/4.1.0...4.2.0) (2026-05-27)

### Features

* **wizard:** GUI apply streams the real install.py bridge (SSE) ([7d8963d](https://github.com/event4u-app/agent-config/commit/7d8963d7108671a359153c1360cca79b77a1ca5b))
* **install:** wire --apply-payload real-apply + NDJSON; fix GUI-launch drift ([7f1159a](https://github.com/event4u-app/agent-config/commit/7f1159a77b0de6cdafae7e913aae4e3795c2abf0))

### Bug Fixes

* **install:** validate /plan output via InstallPlanWireSchema ([4548ffe](https://github.com/event4u-app/agent-config/commit/4548ffe2275e79b7d901a5a11183f0ff7023b9bd))
* **lint:** allowlist cross-stack noise-segment doc in module-detect-on-the-fly ([49ee5c3](https://github.com/event4u-app/agent-config/commit/49ee5c36cdea06e7b7614b8b84ab5d7560e0d0ec))
* **template:** bump agent-project-settings.example pin to 4.1.0 ([7b918be](https://github.com/event4u-app/agent-config/commit/7b918be7f187c7cb2f597622fcd7a9bf3209fbe2))
* **settings:** add roadmap.skip_pre_run_gate to the settings schema ([2221757](https://github.com/event4u-app/agent-config/commit/2221757d7860c23b6ddd264371ff5e8f56293e67))

### Documentation

* **roadmap:** refresh dashboard after archiving single-install roadmap ([38a6c89](https://github.com/event4u-app/agent-config/commit/38a6c89971429c42823a3a60eff6f595a1010f43))
* **roadmap:** complete + archive road-to-single-install-source-of-truth ([ff06721](https://github.com/event4u-app/agent-config/commit/ff06721390eb09e55d4474b1e9dfd37be8b91cd8))
* **roadmap:** track + complete road-to-single-install-source-of-truth ([2ee7162](https://github.com/event4u-app/agent-config/commit/2ee7162b4a4040eac72096b7cda3fb3f76966561))
* align gui-wizard contract + README init story with the real GUI ([a2864a1](https://github.com/event4u-app/agent-config/commit/a2864a1c337d2e14f6e206e12d002d9793eb360d))

### Refactoring

* **install:** retire the parallel TypeScript apply mirror ([f4a5702](https://github.com/event4u-app/agent-config/commit/f4a5702d7919e95d7c641fe9e2788cfecef48e2c))

### Tests

* **install:** parity, headless, and WIZARD_READY handshake coverage ([ef048c9](https://github.com/event4u-app/agent-config/commit/ef048c935c33f8b63f57d4c70af5af137759c831))

### Chores

* commit leftovers ([c4e3ef1](https://github.com/event4u-app/agent-config/commit/c4e3ef1b727918ff8baf9cf3e8d014148d5182b3))

Tests: 5052 (+9 since 4.1.0)

## [4.1.0](https://github.com/event4u-app/agent-config/compare/3.3.0...4.1.0) (2026-05-27)

### Features

* **roadmap:** restore skip_pre_run_gate (default true) to suppress the process-* confirmation ([746b472](https://github.com/event4u-app/agent-config/commit/746b472cc7ebb626114042ba18c91aa93ff36383))
* **adoption-signal:** signal-floor contract + snapshot collector + report rollup ([0a8ad93](https://github.com/event4u-app/agent-config/commit/0a8ad9361f15e25d8ff981d25b666d2b03cbd3a2))
* **mcp-registry:** submission helper + tracking sheet + adoption dashboard ([817d1a5](https://github.com/event4u-app/agent-config/commit/817d1a521e826766646da862900ff54be9f0d0e4))
* **recruit-sessions:** runbook + preflight script + tests ([9c6f50b](https://github.com/event4u-app/agent-config/commit/9c6f50b9a9c55a4c69e7b7ace66bde970ccc6238))
* **ci:** ci-green-floor contract + ci_status.py phantom filter ([d5eb355](https://github.com/event4u-app/agent-config/commit/d5eb35593685b82cd554829c75fe6cdc375cf378))
* **bench-ab:** phase 5 — report renderer + task entries + linter + contract ([c47960f](https://github.com/event4u-app/agent-config/commit/c47960feab0cd8a69f6c5e494eefd2a5346b71b3))
* **bench-ab:** phase 4 — track B task corpus + runner + scoring ([9f389da](https://github.com/event4u-app/agent-config/commit/9f389da0cc6ba74436e5842e54215eece23588d2))
* **bench-ab:** phase 3 — track A behavioural eval A/B ([56473ae](https://github.com/event4u-app/agent-config/commit/56473ae952b897623b1ff67b838a25cc16bef558))
* **bench-ab:** phase 2 — runner extension + baseline cache ([cb20841](https://github.com/event4u-app/agent-config/commit/cb20841a50de1d61afce2c1c7adb20600e0f8cb3))
* **bench-ab:** phase 1 — variant target + clone scaffolding ([296cb68](https://github.com/event4u-app/agent-config/commit/296cb683121e6ad6970527e20b18c09b3b837008))
* **roadmap:** add package-impact benchmark plan ([13ad7b0](https://github.com/event4u-app/agent-config/commit/13ad7b0eea415e42617fdacc3970c5a88fcde217))
* **roadmap:** add skip_pre_run_gate to suppress process-* confirmation ([87f12fa](https://github.com/event4u-app/agent-config/commit/87f12faf748674994e7d9d0f1ea48689103f5664))
* **ci:** lint_role_experiences.py + plain-language surface contract ([9845a1b](https://github.com/event4u-app/agent-config/commit/9845a1bbfd3f1ed66dec5b5c2f9bdf4b788296ff))
* **roles:** add sales/support/leadership + prompts for galabau/content-creator/consultant ([1846c1c](https://github.com/event4u-app/agent-config/commit/1846c1cfbbd37def8f87181292d329b8e901d4aa))
* **workspace:** ship WorkspacePage UI + a11y audit + Playwright suite ([bd469cc](https://github.com/event4u-app/agent-config/commit/bd469cc6d6d9371af96b6bbf2bc58405e0fcfc03))
* **workspace:** add /api/v1/workspace/* server routes ([d6ef98e](https://github.com/event4u-app/agent-config/commit/d6ef98e91d5df42bcb5c999efa3e980e6a0f9e9f))
* **rules:** forbid decorative emojis in git surfaces ([265c3f6](https://github.com/event4u-app/agent-config/commit/265c3f6c78244eb6a56e0c1ba0613f2c0d5f5c29))
* **ci:** skip heavy matrices on release PRs + add release-validation workflow ([26f26b9](https://github.com/event4u-app/agent-config/commit/26f26b97acd85b09fc26b2922e7885643403afe8))
* **rules:** gate unsolicited PR progress comments behind personal.pr_progress_comments ([4183131](https://github.com/event4u-app/agent-config/commit/41831315f12974ba1e326953c7abb98a0f14e7c8))
* **install:** bash bootstrap for the v4 unified setup wizard ([5519441](https://github.com/event4u-app/agent-config/commit/551944156c5c330a1b703e12ffba9bb3612ccdae))
* **install:** wizard conflict UI + recovery + continue + backup screens ([462cfbf](https://github.com/event4u-app/agent-config/commit/462cfbfa77583e50ea4aae167a4c2318ee7f0cb2))
* **install:** wizard state → plan (Phase B2) ([5e73633](https://github.com/event4u-app/agent-config/commit/5e736331710c13d4af8f6ec0283e0b32fe6693f1))
* **install:** unified setup wizard dispatch + install API with SSE progress ([4f932e1](https://github.com/event4u-app/agent-config/commit/4f932e1707645facbf1967cca086a182f6416b19))
* **install:** port AI-tool bridge generators (A6) ([62234bf](https://github.com/event4u-app/agent-config/commit/62234bf89ca2469bd1e854ea3dba3ddc0bb3a7b0))
* **install:** conflict resolution strategies (A5) ([b0f39f8](https://github.com/event4u-app/agent-config/commit/b0f39f827051cd05a838c6a07942678080574d01))
* **install:** atomic write + transaction log + apply pipeline (A4) ([885fc99](https://github.com/event4u-app/agent-config/commit/885fc9949655bec37d73659e954eb76bee3664b4))
* **install:** plan generator with conflict diffing (A3) ([81f3298](https://github.com/event4u-app/agent-config/commit/81f3298c04b8ccd6de5d277bafdf0bc1d7b88110))
* **install:** port project + AI-tool detection (A2) ([0f5c977](https://github.com/event4u-app/agent-config/commit/0f5c97720e188d6e4410f84638979d18289f4aa5))
* **install:** scaffold TS install-engine workspace (A1) ([3a2e41c](https://github.com/event4u-app/agent-config/commit/3a2e41c29f6516db35a75d26167ac460e1aad7e1))
* **ui:** unify shell with 6-tab navigation (Setup, Tasks, Council, Memory, Explain, Workspace) ([5ad6f22](https://github.com/event4u-app/agent-config/commit/5ad6f22abfd4cf29b6f5d4c7e8cfddfd5b126ad7))
* **cli:** wire extended-steps flag through setup command ([4192d8d](https://github.com/event4u-app/agent-config/commit/4192d8d89fbb985559bda6549c526f796c1c9c81))
* **wizard:** expand to 10-step extended flow with ai-tools, packs, modules ([55f88da](https://github.com/event4u-app/agent-config/commit/55f88daf48fa66ff51f892c6ef439f8b1dc0b8be))
* **wizard:** scope-guard + probe + harness-expectations endpoints ([3ced286](https://github.com/event4u-app/agent-config/commit/3ced2864425f9f2eb0906ff5ecd163320d12a174))
* **install:** canonical-channel discipline + scope guard + skill probe ([bbd434c](https://github.com/event4u-app/agent-config/commit/bbd434c4655e96c0c44919ea01ba11b8dd6e4e80))
* **modules:** on-the-fly module detection skill + acknowledge flag ([10d0044](https://github.com/event4u-app/agent-config/commit/10d00441f8a2fe23b1eb98fa0f87cd3bad859b61))
* **wizard:** add modules step to onboarding GUI ([92cc851](https://github.com/event4u-app/agent-config/commit/92cc851f4e57e83e64906202925cfc74f24293a7))
* **skills:** per-module agents/ folder discovery (Phase D) ([c174f73](https://github.com/event4u-app/agent-config/commit/c174f73978f08929cb84f734416c6d4f35d903c7))
* **skills:** generalize module-management + neutrality linter (Phase C) ([c653f39](https://github.com/event4u-app/agent-config/commit/c653f396624835732aa083df7d76ca16876e92d7))
* **install:** detect modules during install + /agents init (Phase B) ([c0e9b6a](https://github.com/event4u-app/agent-config/commit/c0e9b6aa5da93a752271b45383d335930024e82f))
* **modules:** add modules config block + loader (Phase A) ([2bd0bd2](https://github.com/event4u-app/agent-config/commit/2bd0bd20acacc06b6c342ced4e08017145e715a8))

### Bug Fixes

* **ci:** allow agents/.agent-tools.yml at agents/ root ([eadb5fa](https://github.com/event4u-app/agent-config/commit/eadb5fa290c3edbae8763ea1a2fa605fa549f35b))
* **ci:** trim AGENTS.md back under Thin-Root 3000-char hard cap ([1a2530b](https://github.com/event4u-app/agent-config/commit/1a2530b9670fb9088ed1a42d91c007c54975f142))
* **ci:** minimal retirement stub at packages/core/installer/ for the legacy Node-Tests job ([ae37148](https://github.com/event4u-app/agent-config/commit/ae371487c1c8c44ba0aa837ea42ca3bbd9b5cd3b))
* **skill-lint:** mirror agent-handoff trigger_context fix into compressed copy ([b17c4ef](https://github.com/event4u-app/agent-config/commit/b17c4ef8cfde53ddeb7ba764622020203a61b10b))
* **projection:** drop stale .claude/skills/install-via-agent/SKILL.md symlink ([21a6588](https://github.com/event4u-app/agent-config/commit/21a6588b9d9bf71cc322bffabf299585b3493fab))
* **ci:** bump always-rule top-3 concentration ceiling 10_900 → 11_300 ([8a7f301](https://github.com/event4u-app/agent-config/commit/8a7f301935d3bd28306bbdd098071b522eaf6f1b))
* **portability:** rephrase `task sync` → "sync pipeline" in cheap-question-mechanics ([5341087](https://github.com/event4u-app/agent-config/commit/534108756e13a8ddec4bb27d6a3e9ebd7a677aec))
* **ci:** clear v4 install-cutover blockers on PR #244 ([a031da4](https://github.com/event4u-app/agent-config/commit/a031da428c1427ea8080d56cc11c2e3db7efa356))
* **authority:** block execution offers after roadmap/vision artifact save ([d30d441](https://github.com/event4u-app/agent-config/commit/d30d441e27c0820df82102e7afa4a12e4cb45cac))
* **installer:** accept monorepo packs/<pack>/dist/agent-src.uncompressed/ prefix ([ac0b716](https://github.com/event4u-app/agent-config/commit/ac0b71651512b39c1f207204b1e3b02d33440031))
* **ci:** AGENTS.md size cap + scope_guard bash 5 set -e compatibility ([6018308](https://github.com/event4u-app/agent-config/commit/6018308ec622e29eaab42c35d43b462569a192db))
* **tests:** mirror agent_settings.py into work_engine template copy ([a755bb7](https://github.com/event4u-app/agent-config/commit/a755bb7cc2a0cc8b3f4dcbf2c24ba37ef8738472))
* **adr:** allow council refs in ADR decision-trace blocks ([f069596](https://github.com/event4u-app/agent-config/commit/f069596537c8ebd4ad6f2d828357d29e3a835739))
* **contracts:** align stability frontmatter for v0/design contracts ([f8020e9](https://github.com/event4u-app/agent-config/commit/f8020e94acee9639410a60038357c9db21b9fd2d))
* **tests:** mirror agent_settings.py into work_engine template copy ([029e9c4](https://github.com/event4u-app/agent-config/commit/029e9c4d967974aa7acf25b3331f9bf4e80dcc4d))
* **lint-agents-md:** trim consumer-template Thin-Root bullet ([dc4e8e6](https://github.com/event4u-app/agent-config/commit/dc4e8e6253ba081799e9f4c84c151bb442af75b3))
* **skill-lint:** trim module-management description + add analysis gate ([046ef48](https://github.com/event4u-app/agent-config/commit/046ef48ed7f318875fc6cf84157fe75c432f9608))
* **ci:** skip agents/tmp + allowlist module-aware Laravel-shape examples ([c351758](https://github.com/event4u-app/agent-config/commit/c351758daedc76b2234b7fab8643403b11173e64))
* **check-refs:** mark forward-ref to recruit-sessions/01-galabau-owner with ref-ignore ([dea821a](https://github.com/event4u-app/agent-config/commit/dea821af02dbd335884f95f89b868c55e6338cce))

### Performance

* **ci:** extract windows-lockfile + python-version sweep to path-filtered workflows ([e2d17f0](https://github.com/event4u-app/agent-config/commit/e2d17f071149884505d10e246421d13b67efed58))

### Documentation

* **posture:** record 2026-05 feedback citation against the cancellation wall ([f96b9c7](https://github.com/event4u-app/agent-config/commit/f96b9c7973c8be8d33252ad0330c8bd3126b4341))
* **ci:** wire `task ci:required-checks` + cross-links + archive roadmap ([069833c](https://github.com/event4u-app/agent-config/commit/069833c00cf13e3af34bd0328daecce61ef0ab11))
* **ci:** release-PR gating contract + shape detector + tests ([380e059](https://github.com/event4u-app/agent-config/commit/380e0591dcb661cb3da2e84089bcc1b6fb5cf397))
* **internal:** document new umbrella occupants in AGENTS.md and internal/README.md ([0b1a384](https://github.com/event4u-app/agent-config/commit/0b1a384db1545576208c50accebba92977ded335))
* **roadmap:** mark Phase B3-E3 done + archive road-to-unified-setup ([64162ab](https://github.com/event4u-app/agent-config/commit/64162abda143286d058b432018f0058fc71cca98))
* **roadmap:** mark Phase B0+B1 done on road-to-unified-setup ([098b809](https://github.com/event4u-app/agent-config/commit/098b8096d09449e2b358333691cc50f20ded5a58))
* **roadmap:** mark Phase A (A1-A6) done on road-to-unified-setup ([49a983b](https://github.com/event4u-app/agent-config/commit/49a983bcfc0a2974f41e53dbabed209730eac682))
* **roadmap:** add road-to-unified-setup v4.0.0 plan ([9601a81](https://github.com/event4u-app/agent-config/commit/9601a81fa88c248e9e7a4941ab25a462853953f1))
* distribution-channels + install-scopes + harness-expectations ([1351f51](https://github.com/event4u-app/agent-config/commit/1351f5102aabec85e09d7bc1433aeb265ac706f4))
* **roadmap:** close Phase E - Step 4 Won't do, archive roadmap ([842ef8e](https://github.com/event4u-app/agent-config/commit/842ef8eec2599a1e38b633a88db99afccaaf0f8b))
* **roadmap:** close Phase E for road-to-configurable-modules ([6cd2b56](https://github.com/event4u-app/agent-config/commit/6cd2b56e302b81ec601544bd90a5f51295d98c43))
* **roadmap:** mark configurable-modules Phases A-D complete + regen dashboard ([c4f1682](https://github.com/event4u-app/agent-config/commit/c4f16829f13d4bb4c727be4cd1f77bf90407e015))
* **roadmap:** land 5 new roadmaps + regen progress dashboard ([94c5192](https://github.com/event4u-app/agent-config/commit/94c5192090aa54df2958120224d33869b707bceb))

### Refactoring

* **naming:** rename compress→condense and caveman→telegraph across the suite ([6a72697](https://github.com/event4u-app/agent-config/commit/6a7269713c11dd10ae2b975d921207de2e0e08de))
* relocate .compression-hashes.json + .agent-tools.yml and rewrite path consumers ([6e545c8](https://github.com/event4u-app/agent-config/commit/6e545c8563aff3e0dc9c3c9b80148d4bc83c4337))
* **internal:** move docker/ + schemas/ to internal/ umbrella ([5cf589b](https://github.com/event4u-app/agent-config/commit/5cf589bbefdaedf29e01a8b906f59176d690ed0e))

### Tests

* regression coverage for distribution-channels track ([5ddc493](https://github.com/event4u-app/agent-config/commit/5ddc493fac8b05ec297f4b0f1714fb294f402ef7))

### Chores

* **roadmap:** wire ci:status + adoption:* tasks; close out adoption-proof-and-ci-green ([7421b6d](https://github.com/event4u-app/agent-config/commit/7421b6d52fa10e4e327d142717e0ee5f31f86747))
* add new hooks ([75708a5](https://github.com/event4u-app/agent-config/commit/75708a5bbde1380cb1ec54f6bc8aca086073f7a6))
* **roadmap:** close out frictionless-employee-workspace + regen dashboard ([5f1d376](https://github.com/event4u-app/agent-config/commit/5f1d376e741704a7602fefd283b469326ff749f0))
* **roadmaps:** archive road-to-deep-root-restructure (15/15 closed) ([1088332](https://github.com/event4u-app/agent-config/commit/10883323745485cab9ed7aaa3af12789a169549f))
* regenerate packages/core/{README.md,pack.yaml} after the new rule ([1847ae0](https://github.com/event4u-app/agent-config/commit/1847ae0e81cf764ec8dbe7e4dab49bac4d5f8433))
* update gitignor ([cc9a247](https://github.com/event4u-app/agent-config/commit/cc9a247beef83644de525d4f5574bc544b78cbaa))
* **docs:** drop command count from 136 → 135 after install-via-agent removal ([fecba73](https://github.com/event4u-app/agent-config/commit/fecba73b0f5b9c0c4a723a860cad0b0aff0f4a1f))
* **release:** bump to v4.0.0 + CHANGELOG hard-cut entry ([fa538ae](https://github.com/event4u-app/agent-config/commit/fa538ae6a347398925c06b89ebaa1a1809fd7a39))
* **install:** remove legacy TS installer workspace + reference cleanup ([3aa1e93](https://github.com/event4u-app/agent-config/commit/3aa1e93f58f98d6d0feeb1e066674a21eeaf2f40))
* **commands:** harden agent-handoff trigger detection and fenced-output contract ([1be7c7c](https://github.com/event4u-app/agent-config/commit/1be7c7ca813036129449e5020ab9dd78f02d4910))
* **gitignore:** close nested node_modules hole, drop stale tracked entries ([0ad9963](https://github.com/event4u-app/agent-config/commit/0ad9963f705811a2cbbecc2ac591a1f4d2b82d9d))
* **rules:** harden commit-chunking and cheap-question floors ([d824408](https://github.com/event4u-app/agent-config/commit/d824408c021095455eacb5e6d7f8169eafb76808))
* **workspaces:** scope npm workspaces to installer only ([c227f53](https://github.com/event4u-app/agent-config/commit/c227f5350c533a5094f3f5954c4aec67fdf42581))
* **roadmap:** audits + recruit findings placeholder for distribution-channels ([e739618](https://github.com/event4u-app/agent-config/commit/e739618f239f2fa58b26e256c0873e401b0f5f53))
* **generated:** regenerate sync outputs + counts for module-detect-on-the-fly ([ea624f3](https://github.com/event4u-app/agent-config/commit/ea624f348a90c88d214ccf7f9bdfdbd362dfa5ee))
* **generated:** regenerate ownership matrix, catalog, agent index ([796f674](https://github.com/event4u-app/agent-config/commit/796f674a2d29ee4f26438a53fd1e967966111848))
* **template:** bump agent_config_version to 3.3.0 ([76dcbc8](https://github.com/event4u-app/agent-config/commit/76dcbc8549b771bc930fbd15f9e5e819bee0f736))

### Other

* Revert "feat(roadmap): add skip_pre_run_gate to suppress process-* confirmation" ([e918d51](https://github.com/event4u-app/agent-config/commit/e918d516140cc0d6d8f432f8207626c81334ad86))

Tests: 5043 (+105 since 3.3.0)
