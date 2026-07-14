# Changelog Archive — pre-9.2.0

> Frozen snapshot of `event4u/agent-config` changelog entries
> released before `9.2.0`, split out of the main
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

## [9.1.0](https://github.com/event4u-app/agent-config/compare/9.0.0...9.1.0) (2026-07-14)

### Features

* **create-pr:** tier-driven body, grounded API examples, capability-gated screenshots ([306f7d5](https://github.com/event4u-app/agent-config/commit/306f7d59e6e7dee4a22e9c34aad4fbc89a75e3e2))
* **create-pr:** settings for description detail level, API examples, screenshots ([65275bb](https://github.com/event4u-app/agent-config/commit/65275bb1237fc4dfbbcefd86d27bc45ef4be257c))
* **ai-council:** prompt caching + right-sized output on the paid Anthropic path ([3ec7ff0](https://github.com/event4u-app/agent-config/commit/3ec7ff09d49283b096901e5d4716cc529fef1609))
* **skills:** add llm-provider-knowledge — verify LLM product facts against official docs ([ba34d94](https://github.com/event4u-app/agent-config/commit/ba34d94530d1b30066470a0316f247be84b5ac2d))
* **commands:** register discoverable /explain-run command ([13955a1](https://github.com/event4u-app/agent-config/commit/13955a1e7ab40a658ed0879e21266fe49a54c6a0))
* **doctor:** add rule-scope-drift check for the scoped-projection flip ([71353f8](https://github.com/event4u-app/agent-config/commit/71353f8c6bb66b404916f599c5e168bef1f85601))

### Bug Fixes

* **ai-council:** make prompt caching explicit opt-in (default off) ([bad8070](https://github.com/event4u-app/agent-config/commit/bad80707eda42aacbd3698575e1d22383dbea8b3))
* **refs:** treat external claude-api plugin as non-repo reference ([75a3431](https://github.com/event4u-app/agent-config/commit/75a34314ca802e8cda39df8ff6b375c52621ae63))
* **commands:** reference agent-docs-writing skill in /explain-run ([c104279](https://github.com/event4u-app/agent-config/commit/c104279abaaad1035758cc86140be847ed4f4a06))
* **ci:** honest gate status in skill-lint + self-review comments ([5098465](https://github.com/event4u-app/agent-config/commit/50984659e028c8c0029b1cd1deb8a69bf1c4e61b))
* **install:** rebuild install bundle with real node_modules paths ([f875244](https://github.com/event4u-app/agent-config/commit/f8752443b1b27bd9471dbf056a65097d898e15de))
* **install:** rebuild install bundle + reword source-repo comment ([48e9dc2](https://github.com/event4u-app/agent-config/commit/48e9dc2a6f694610322d533b0196346cf07a151d))
* **tests:** make wrapper-delegation install test hermetic ([8ef5ea2](https://github.com/event4u-app/agent-config/commit/8ef5ea2bdc60f90fde7979bee2dca3d15a2e118e))

### Documentation

* **create-pr:** document PR-description content settings ([812ae6b](https://github.com/event4u-app/agent-config/commit/812ae6ba84ba5508a71b3ab02c351cad4a3a2e55))
* subagent prompt-cache break-even + record the follow-up council verdict ([fdba56d](https://github.com/event4u-app/agent-config/commit/fdba56dbe06818c4bc50c5b3e94322e10b34bd0d))
* **roadmap:** API cost-optimization roadmap + dashboard ([3d1b313](https://github.com/event4u-app/agent-config/commit/3d1b3132b0d0d3a52c7eba555b1e3afd95d5750e))
* **agent-infra:** API cost-levers guideline + token-optimizer index wiring ([a97d0e7](https://github.com/event4u-app/agent-config/commit/a97d0e7eaa4c61eb4db59f8bdf469d112595b1b5))
* **roadmap:** archive completed road-to-llm-provider-knowledge-skill ([059aa10](https://github.com/event4u-app/agent-config/commit/059aa10b3405597986c12c0de3da6c767385bb97))
* **roadmap:** add + archive feedback-9.0-followups roadmap ([c8aa510](https://github.com/event4u-app/agent-config/commit/c8aa5104ac774f77f1354ac9c6c3816096b769fe))
* **changelog:** repair breaking-surface index + add sync lint ([e333d71](https://github.com/event4u-app/agent-config/commit/e333d7150254310fe569dcb6e0fad2c487568d32))

### Refactoring

* **install:** retire the consumer bridge marker (ADR-020 amendment) ([2737b04](https://github.com/event4u-app/agent-config/commit/2737b04441b7e807240c979e874d8e2bb3967b9b))

### Build

* **install:** rebuild bundle with repo-relative module paths ([f30adb5](https://github.com/event4u-app/agent-config/commit/f30adb5a109ac6aee9777bad722ef0146fc208fa))
* **install:** rebuild install bundle after create_pr settings addition ([a760b9f](https://github.com/event4u-app/agent-config/commit/a760b9f39a41a9621b21ad2fb92851c4a1ea66b2))

### Chores

* **roadmaps:** archive completed pr-description-tiers roadmap ([2c4615f](https://github.com/event4u-app/agent-config/commit/2c4615fe42129eb8bd33e87a368cbed8f5f1ded7))
* sync generated guideline count (98 -> 99) for api-cost-levers ([17ce22b](https://github.com/event4u-app/agent-config/commit/17ce22bdfc2d99341d7a3edeaaf80554f4d75f33))
* **evals:** ratchet behavioural-eval coverage floor to current ([84f42fa](https://github.com/event4u-app/agent-config/commit/84f42fab93d77ad8b0b28ce430b79ae222748719))

Tests: 7737 (+21 since 9.0.0)

## [9.0.0](https://github.com/event4u-app/agent-config/compare/8.13.0...9.0.0) (2026-07-13)

### BREAKING CHANGES

* **scoping:** flip consumer rule projection default to scoped (Phase-1 human gate, approved) ([565c91a](https://github.com/event4u-app/agent-config/commit/565c91aa25e4c970d5b37258f497366f33e7a7a9))

**Consumer rule projection is scoped by default** (`road-to-request-scoped-rule-load` Phase 1 human gate, 2026-07-13)

- **Who is affected:** fresh consumer installs — the settings template now
  ships `projection.rule_workspaces` filled with every consumer workspace, so
  the 16 exclusively-maintainer specification rules (plus the recorded
  `source-of-truth.md` compat exclusion) no longer arrive: 103 → 88 rules,
  −9,880 cl100k tokens (−13.1%) per install. All domain safety floors and
  domain rules keep shipping; kernel rules always ship.
- **Existing installs:** unchanged until you run `agent-config sync` /
  re-install (settings sync preserves your current value; fill the list to
  opt in). The first session after opting in rebuilds the KV-cache prefix
  once (1.25–2× write cost, one session only).
- **Quality evidence:** deterministic set-inclusion verification
  (`src/scripts/check_consumer_scope_flip.ts` →
  `internal/bench/reports/2026-07-13-consumer-scoped-default-flip.json`):
  only exclusively-maintainer rules drop; zero golden-set-exercised consumer
  rules affected (90/90 labelled tasks, coverage 86/86).
- **Rollback:** set `projection.rule_workspaces: []` (= legacy-all).

### Features

* **product:** pre-build demand gate folded into improve-before-implement — plate complete, archived ([d6b0fcb](https://github.com/event4u-app/agent-config/commit/d6b0fcb9d020f983a98f8cd0c744d758bb758f9a))
* **skills:** Known-pitfalls sections for docker, terraform, laravel ([4427224](https://github.com/event4u-app/agent-config/commit/442722417f319b7b704c2d0bdc711c38e870f796))
* **skill-writing,size-enforcement:** Known-pitfalls section standard + sprawl guard ([6276c9f](https://github.com/event4u-app/agent-config/commit/6276c9f24b3166c1ae4360151cf05f2cd29f9b31))
* **skill:** spreadsheet-authoring — recalc-verification loop + zero-formula-error contract ([fcaf93e](https://github.com/event4u-app/agent-config/commit/fcaf93e8beb36c944b356df04b1203941f8a3271))
* **skill:** pdf-tools — library-per-task PDF create/transform/fill routing ([11af714](https://github.com/event4u-app/agent-config/commit/11af7140fa999dea0f514ddb32f5a1d6d6e8934b))
* **skill:** docx-authoring — skeleton-create + unpack/edit/pack-with-validate toolkit ([218f711](https://github.com/event4u-app/agent-config/commit/218f7115359f10c630c239ec02302f6a2eb21a63))
* **humanizer:** severity-tiered AI-ism taxonomy, stance-preservation, voice-match ([00077d2](https://github.com/event4u-app/agent-config/commit/00077d2488246766317f86110a65e65cab7080b9))
* **skills:** docx-authoring + pdf-tools — completes the document read→write cycle ([c0688c1](https://github.com/event4u-app/agent-config/commit/c0688c11badc38bd060de89f0585b351ea2d265d))
* **skill:** launch-readiness epistemics block + fix-loop (contract-backed) ([591c386](https://github.com/event4u-app/agent-config/commit/591c386ae6be8d06b68997a41198166334e7249c))
* **prelaunch:** finding-ID contract, epistemics, regression gate + suppression ([0f4bff6](https://github.com/event4u-app/agent-config/commit/0f4bff64e12f5a73525ea2272df479672ce7f9aa))
* **workflow:** Phase 3 merge-conflicts plan-first — plate complete, archived ([3f51f4e](https://github.com/event4u-app/agent-config/commit/3f51f4ed1fa6ed4253788432db468c35678f1c81))
* **workflow:** Phase 2 — HANDOFF.md convention, resume rule, artifact validation ([5092d5e](https://github.com/event4u-app/agent-config/commit/5092d5ef44ea154817eda4640a526fa0909ed9a9))
* **workflow:** Phase 1 — TDD mode contracts with diff-checkable Forbidden blocks ([a6c4d70](https://github.com/event4u-app/agent-config/commit/a6c4d7048e24505db80dc04c6e03d8a63bfce3d1))
* **ci:** bridge-derivation, tools-matrix + host-loadability gates (Phase 4.3/4.4) ([9168bbd](https://github.com/event4u-app/agent-config/commit/9168bbdb455412261bf593dd89f5111085d24fe9))
* **schema:** optional effort: reasoning-effort pin (Phase 4.2) ([9248f36](https://github.com/event4u-app/agent-config/commit/9248f366d13e79d195bfcd50985fc48313e1b51f))
* **commands:** argument-hint frontmatter across the command surface (Phase 4.1) ([333a1b3](https://github.com/event4u-app/agent-config/commit/333a1b37bd15ff394c9c82ba4a7a961ce3aaf1c2))
* **authoring:** U1 description-optimizer loop (held-out split) — plate complete, archived ([a2d7f55](https://github.com/event4u-app/agent-config/commit/a2d7f552a6d28657714914d0a0efa81decb2b57e))
* **authoring:** U5 self-QA fresh-eyes pattern for output-producing skills ([6295bd7](https://github.com/event4u-app/agent-config/commit/6295bd744dc6dbd96face318956e3925a0b80ca6))
* **authoring:** U3 tool-grant uplift — scoped grants, disallowed_tools deny-list, numeric thresholds ([7089ac8](https://github.com/event4u-app/agent-config/commit/7089ac8d6ac5121f391650987b5b2c8fb227f6fb))
* **authoring:** U4 register note + U2 Agent-Skills spec alignment ([6ce3a13](https://github.com/event4u-app/agent-config/commit/6ce3a13b1243fdfb63a184c758a4764ab1dc67d8))
* **telemetry:** U5 agent-combo facet on the orchestration record ([1aacb46](https://github.com/event4u-app/agent-config/commit/1aacb46458c42f3857b5107d714ca25386133e97))
* **measurement:** U4 host-loadability smoke — generated trees must actually load ([0d0b014](https://github.com/event4u-app/agent-config/commit/0d0b0141f160f5722d4bba71ba8e017d0445a98a))
* **evals:** U2 golden-adversarial review pair + not_contains assertion kind ([b5f040a](https://github.com/event4u-app/agent-config/commit/b5f040a8fd90b6012106760c06a67981a2a437a9))
* **measurement:** U1 loaded-vs-fired utilization report + census-honesty note ([545c2ce](https://github.com/event4u-app/agent-config/commit/545c2ce3f1c0d3894bb9eebd5c87bb8e110ddb2b))
* **telemetry:** U1a loaded denominator — engagement schema, record CLI, aggregator, renderer ([a549788](https://github.com/event4u-app/agent-config/commit/a5497881cc67475a6cddfc3fb857f675fcb032be))
* **skill-quality:** add read-only-by-default script-convention lint ([401828d](https://github.com/event4u-app/agent-config/commit/401828df53069331007fe0e28edab8811fa46fa4))
* **skill-quality:** add eval schema v2 — tool-choice + trajectory_budget ([63a5cdf](https://github.com/event4u-app/agent-config/commit/63a5cdfd433374099ea70e8e10a5b8350ccebb52))
* **skill-quality:** add description-quality lint gate ([e7acc5e](https://github.com/event4u-app/agent-config/commit/e7acc5ec8744b1e00d2fe9ad89727731d3500147))
* **scoping:** deterministic held-quality verifier for the consumer scoped-projection flip ([9375e6e](https://github.com/event4u-app/agent-config/commit/9375e6e6f4788f644c031a62c36e956bd49c0ec7))
* **review:** tally-vs-reasoned boundary + fix-pr-comments dedup ([564efa8](https://github.com/event4u-app/agent-config/commit/564efa8300b07c345c9c618b8d5790f20fde9089))
* **review:** change-type routing, two-tier output, de-biasing in code-review ([ffad758](https://github.com/event4u-app/agent-config/commit/ffad75807e3ae6dae58087280d47865286d9d437))
* **team-gate:** managed Review-Gate circuit breaker — never an infinite Claude/Codex loop ([0356b30](https://github.com/event4u-app/agent-config/commit/0356b30f60a00b9fe7b13cdd7dde05ddda3684db))
* **team-fallback:** read-only multi-host review via team_dispatch + team-review envelope ([ba6ea00](https://github.com/event4u-app/agent-config/commit/ba6ea0062b34cad03dc296a887a7d8edba559d09))
* **security:** STRIDE table, CI-agent + insecure-defaults coverage, active-probe design note ([260fd2f](https://github.com/event4u-app/agent-config/commit/260fd2fe667e0c605cd042935327b316fa4a9641))
* **security:** add security-maturity-assessment skill ([657b68f](https://github.com/event4u-app/agent-config/commit/657b68f550bdeff356cfa3e1654a98f69835ec26))
* **security:** add false-positive gate to bug + security review skills ([4309cb3](https://github.com/event4u-app/agent-config/commit/4309cb35f93eb68deeed523369417ad90c13d86c))
* **evals:** calibrate finding_floor from the cross-host lower envelope — gate armed ([c19aecf](https://github.com/event4u-app/agent-config/commit/c19aecfb440e3d748935a494400319ff8bd0617a))
* **bench:** cross-model parity count-pass runner (council-transport re-scope) ([5cef323](https://github.com/event4u-app/agent-config/commit/5cef32329263f1169ed7875cf4cfad0ab982a10c))

### Bug Fixes

* **humanizer:** reword 'drift' → 'slippage' to clear wing3_vendor_independence false-positive ([66f9179](https://github.com/event4u-app/agent-config/commit/66f91797a0f3cff9c414cb0edfe64b89c916d1a8))
* **ai-council:** enforce config is user-global only, never project-local ([09b16bb](https://github.com/event4u-app/agent-config/commit/09b16bb559f548baf2760a255e1ab20b48a3ccdd))
* **merge:** resolve index-roadmap conflict — both quality-gates and workflow-contracts shipped ([c42dce4](https://github.com/event4u-app/agent-config/commit/c42dce428f0c35f01cf2e58046f62be28dc05504))
* **ci:** use .js import extensions in the new matrix-lint modules (typecheck) ([bf79fe0](https://github.com/event4u-app/agent-config/commit/bf79fe0fd32975b2b1e7d1639bf382874f9b0c18))
* **schema:** surgical skill-schema edits — restore original formatting ([01243ad](https://github.com/event4u-app/agent-config/commit/01243ad12cf5381a010f1e822b6f0e3bb8a32268))
* **rules:** P4 Batch B stub consistency — routes_to + fire-time fix-now boundary ([97bed1c](https://github.com/event4u-app/agent-config/commit/97bed1c1dedc0687a9349381949094f850da8e1f))
* **linear-digest:** drop stale strip_sections for context-hygiene after Batch B migration ([0e705c1](https://github.com/event4u-app/agent-config/commit/0e705c1316a5cfb2e76ca5e0cd958fa95757463c))
* **tests:** run bench_parity_count tests under vitest (CI runner), not node:test ([5076a68](https://github.com/event4u-app/agent-config/commit/5076a68353f789d35dc2f236090056aa1a958017))
* **ci:** team status description under the 200-char linter cap ([800d2f4](https://github.com/event4u-app/agent-config/commit/800d2f49fdbd980bf58333f3a80bebe0760768bb))
* **team-doctor:** expiry-aware auth signal + namespace-resistant plugin identity + gate WARN ([7698386](https://github.com/event4u-app/agent-config/commit/76983863d0a164e20ad2a588fb2e6b8517f00622))

### Documentation

* **roadmap:** mark skill-quality-gates Phases 1-3 done ([b0c2d43](https://github.com/event4u-app/agent-config/commit/b0c2d43b5a409c69a991191b478c8af28e58a463))
* **changelog:** breaking-change entry for the scoped consumer default (sync/re-install + one-time KV-prefix rebuild) ([2520859](https://github.com/event4u-app/agent-config/commit/2520859aa3e1842658392596e892b82b16f2b6eb))
* **roadmaps:** add and archive road-to-batch-b-stub-consistency ([60bf22c](https://github.com/event4u-app/agent-config/commit/60bf22cbbfffdf60e431c147bb5ec2367d2b1fa1))
* **team:** quota clarity, honest wording, pack move to meta, envelope contract ([6be986e](https://github.com/event4u-app/agent-config/commit/6be986e3ed500d3165a7adec3525203a0fd5b76e))
* **bench:** cross-model-parity-count claim + benchmark section ([5ff1a4c](https://github.com/event4u-app/agent-config/commit/5ff1a4c9f90344523e8977639296e18128674abc))

### Refactoring

* **rules:** P4 Batch B part 2 — domain-adoption-policy, minimal-safe-diff, context-hygiene thinned; backlink report + grandfather shrink ([c6eb79c](https://github.com/event4u-app/agent-config/commit/c6eb79cb7383a78e3b48bc46bef4ade01b7d9106))
* **rules:** P4 Batch B part 1 — active-remediation, artifact-drafting-protocol, framework-neutrality, design-fidelity thinned to stubs ([e382bec](https://github.com/event4u-app/agent-config/commit/e382bec6cc04470e19534c7521a8271c52e0f79e))

### Tests

* **workspace_inbox:** refresh skill-hint snapshot for docker Known-pitfalls section ([7003101](https://github.com/event4u-app/agent-config/commit/70031011264cc6bcafc8b68a33f8b6cfafa1c7e2))
* **review:** review-mechanics eval fixtures ([3a74f94](https://github.com/event4u-app/agent-config/commit/3a74f94e729fe6c5f0476be303e11b1d91a80027))

### Build

* **skill-quality:** wire the two new lints into ci-fast ([c9e85d8](https://github.com/event4u-app/agent-config/commit/c9e85d80f31266f901189f2ee3bdc337ce030551))

### Chores

* **roadmap:** tool-pitfalls plate complete — archived, index updated ([b93774c](https://github.com/event4u-app/agent-config/commit/b93774c8d130a2e0f6663b0aba24d88e679924a1))
* refresh condensation hashes ([8a0d974](https://github.com/event4u-app/agent-config/commit/8a0d97437f6257399da5f79cb218671154aa97b4))
* **roadmap:** document-skills plate complete — archived, index updated ([d96a11e](https://github.com/event4u-app/agent-config/commit/d96a11e5d69bf21c7d6d6d2148b231fb56449a7e))
* **docs:** skill counts 272 → 274, meta pack regen, condensation hashes ([4115d3a](https://github.com/event4u-app/agent-config/commit/4115d3a08041086251926303ee9e3d6c39437cd8))
* **generated:** regenerate proof.md + CAPABILITIES.yaml after +2 skills (272→274) ([51eac3e](https://github.com/event4u-app/agent-config/commit/51eac3eb885956ac4ded6f874d4a27645b1c6dc9))
* **roadmap:** prose-authenticity U1-U5 complete; U6 blocked on decision-revisit-gate ([ebff2d8](https://github.com/event4u-app/agent-config/commit/ebff2d815630ea92a69bd341a21f73aa39fc66ac))
* **roadmap:** prelaunch-diagnostics plate complete — archived, index updated ([6ca449d](https://github.com/event4u-app/agent-config/commit/6ca449de2e3b4c8c73ef36ca509a9956d57ac087))
* **roadmap:** skill-quality-gates plate complete — Phase 4 flipped, archived, index updated ([2d89dd3](https://github.com/event4u-app/agent-config/commit/2d89dd3e2c514f3add37176ee86e84e2b218fbb4))
* **sync:** regenerate meta domain README after condense-memory description update ([d6f8557](https://github.com/event4u-app/agent-config/commit/d6f85574627e124b6b9af8e2b2e3cc2b2731a122))
* **condense:** re-mark upstream-contribute after skill-writing dep-fold ([6e71ef9](https://github.com/event4u-app/agent-config/commit/6e71ef95daf695b23de2da3fd30c4f840ca1a2b7))
* **roadmap:** authoring-rigor U2+U4 closed ([b744092](https://github.com/event4u-app/agent-config/commit/b74409267a40e458805a701cc44678bf679041df))
* **sync:** dist twin of code-review evals after U2 golden pair ([10d67ba](https://github.com/event4u-app/agent-config/commit/10d67ba755ef75ecc2520e2ff242d00a9c8e10fa))
* **roadmap:** reliability-measurement plate complete — archived, index updated ([5662e80](https://github.com/event4u-app/agent-config/commit/5662e80753a620be34c95680e1d7e4cec56dd0d4))
* **roadmap:** reliability-measurement U1/U1a/U3 closed ([dc16eaa](https://github.com/event4u-app/agent-config/commit/dc16eaa6e1d19c105b36001f09979e8a08cb8466))
* **roadmap:** request-scoped-rule-load Phase-1 human gate closed - only trigger-gated Phase-4 park remains ([0f46997](https://github.com/event4u-app/agent-config/commit/0f46997c9829a6d9c3f265ed4d744c3588e7f7be))
* **counts:** guideline badge + table 91 -> 98 after Batch B guideline homes ([ecad776](https://github.com/event4u-app/agent-config/commit/ecad7764848d8a0309bae2a56c11b3aafd048efc))
* **roadmap:** complete + archive review-mechanics; refresh hashes ([9ede176](https://github.com/event4u-app/agent-config/commit/9ede1767c451446ec485198da25247821d56b032))
* **roadmap:** request-scoped-rule-load Phase 5 closed — Batch B done, Batch C skipped-by-tradeoff, backlink report current ([37e73f8](https://github.com/event4u-app/agent-config/commit/37e73f89cd30dc7127293de51cc583ed0118d7b1))
* **roadmap:** truth-sync the inherited golden-set blocker in request-scoped-rule-load ([2e13966](https://github.com/event4u-app/agent-config/commit/2e1396657d2e9570bb6eebbb02f51413f1b5fad2))
* **roadmap:** park road-to-token-saving in later/ — all open work operator-gated, judge blocker resolved negative ([51a56bd](https://github.com/event4u-app/agent-config/commit/51a56bdd0fe6b6203bde83792892a88f25a5c8c4))
* **proof:** regenerate docs/proof.md after claims-ledger update ([63421da](https://github.com/event4u-app/agent-config/commit/63421da76566e2ca38e1f72025c68e49646ec404))
* **bench:** codex-host lift replication HONEST NULL — discipline_profile default stays; measurement-unblock roadmap complete + archived ([5e11ce0](https://github.com/event4u-app/agent-config/commit/5e11ce09f7846f4875e032db1c6dc236f9a229cb))
* **pack:** register security-maturity-assessment in engineering-base manifest ([ee89252](https://github.com/event4u-app/agent-config/commit/ee89252794e4979a002de7e2dd682ee90c75d533))
* sync generated count surfaces + dependent command hashes ([44e064a](https://github.com/event4u-app/agent-config/commit/44e064abecd90d924432fcef958477964ed13fa7))
* **sync:** meta pack manifest + index + envelope dist projection ([5473ca0](https://github.com/event4u-app/agent-config/commit/5473ca0e9e6446bfff475db8668ff334b9f2295d))
* **roadmaps:** feedback-8.11-5 executed and archived; team-mode Phases 3+4 complete ([487cbe6](https://github.com/event4u-app/agent-config/commit/487cbe61a2fa52e20c21db66aa9b6a4650aac60b))
* **roadmap:** regenerate progress dashboard ([d085f71](https://github.com/event4u-app/agent-config/commit/d085f716c25c06fa2edf6561c0c66ba9204acdc9))
* **roadmap:** archive completed ecosystem-harvest bug-security-rigor ([25982c5](https://github.com/event4u-app/agent-config/commit/25982c55aefd3a8c2b8715f2ac05112e52849bb4))
* **roadmap:** measurement-unblock Phase 3 complete (build decision + parity pass + armed gate) ([9c0f051](https://github.com/event4u-app/agent-config/commit/9c0f051c91b6a712884fb1408e41c339fc42462f))

Tests: 7716 (+158 since 8.13.0)

## [8.13.0](https://github.com/event4u-app/agent-config/compare/8.12.0...8.13.0) (2026-07-12)

### Features

* **backlinks:** orphan-stub correctness check + fan-out info + gated hard-gate list ([fe88ff5](https://github.com/event4u-app/agent-config/commit/fe88ff5c42bd08338c0ab9c83f3e1fdf0f6f7d1c))
* **team-doctor:** 'team' health check + suppressible setup hint ([22a5c14](https://github.com/event4u-app/agent-config/commit/22a5c141ddaa47994f7d9c150dafa36b0fcb38a8))
* **team-commands:** /team family — thin fail-closed delegations under ai_team governance ([958c491](https://github.com/event4u-app/agent-config/commit/958c4910bf2276449a99ef2462e78caa718148a5))
* **team-config:** ai_team contract — default-off block, fail-closed loader, shared quota ([f45c988](https://github.com/event4u-app/agent-config/commit/f45c98860a63d2c8c572a9e121ecaf05d4c34aa9))
* **pr-create:** harden the freshness gate — regenerate-on-conflict + update freshness ([83104e0](https://github.com/event4u-app/agent-config/commit/83104e0a3a8666d8eb47044c9b9e028a1e60c913))

### Bug Fixes

* **rules:** restore the concrete verification-tool mapping in the improve-before-implement stub ([a54d89f](https://github.com/event4u-app/agent-config/commit/a54d89f852120e639f25aa059e33baf672255f66))

### Documentation

* **round4:** strict:false operating conditions + Batch B/C stub-necessity pre-questions ([7961ba4](https://github.com/event4u-app/agent-config/commit/7961ba4dda15d33fe4a8be6a92d4e71b7a4bedb6))
* **team:** getting-started section — depth complement to the council, no value claims ([6c64fc3](https://github.com/event4u-app/agent-config/commit/6c64fc3acade96c3d1eff3c610677be5a852f18e))
* **roadmap:** measurement-unblock Phase 2 — codex auth+smoke verified, paired run in flight ([489bdc1](https://github.com/event4u-app/agent-config/commit/489bdc168565c6b27eceeaca8384751e089378ef))

### Chores

* **counts:** hero badge + browse line 178 -> 183 after the 8.12.0 release merge ([ef396f5](https://github.com/event4u-app/agent-config/commit/ef396f55476ccfed53387a6fbe49201be8e312c0))
* **counts:** featured-skills command count 178 -> 183 (update_counts anchor) ([13cb8de](https://github.com/event4u-app/agent-config/commit/13cb8de13373e66c26a21689b2a86427ee9ac043))
* **roadmaps:** feedback-8.11-4 executed and archived; team-mode P1+P2 complete ([dd44aa6](https://github.com/event4u-app/agent-config/commit/dd44aa69fea35d95fadc00936c3ec23caaeb2c1b))

Tests: 7558 (+49 since 8.12.0)

## [8.12.0](https://github.com/event4u-app/agent-config/compare/8.11.0...8.12.0) (2026-07-12)

### Features

* **rules:** P4 migration Batch A — 9 rule bodies to their existing homes (−51.7% stub bytes) ([94dc19c](https://github.com/event4u-app/agent-config/commit/94dc19cac62ff21449afd5a373c1363ee3d6215c))
* **explain-run:** plain-language Summary section ([257d8fc](https://github.com/event4u-app/agent-config/commit/257d8fc4d2ef69e9696f9a143d653a1a0a771e2c))
* **complexity:** report v2 — proxy honesty, coupling metric, soft-ratchet baseline ([8328bae](https://github.com/event4u-app/agent-config/commit/8328bae0b791da4215fd704a90734123df0f6b13))
* **bench:** live retrieval benchmark executed — decisive PASS ([25d9f03](https://github.com/event4u-app/agent-config/commit/25d9f03756e33870fbc507bc1bc964c5b6c83403))
* **bench:** persona-placebo benchmark — executed, HONEST NULL (identity adds nothing) ([000c3e7](https://github.com/event4u-app/agent-config/commit/000c3e77081d7aa39e3d617f98ba67ef27121218))
* **reports:** complexity report, explain-run v0, rule-backlinks — all report-only with kill criteria ([e718f13](https://github.com/event4u-app/agent-config/commit/e718f1396562e0cb94fab344b75332a73a34ac35))
* **knowledge:** per-card sensitivity classes, promotion gate, revocation trail (ADR-121) ([a14b1ad](https://github.com/event4u-app/agent-config/commit/a14b1ad54b750d86ff288cd96ad9e76fe58fcdc5))
* **consumer-matrix:** live hook-lifecycle leg + dist import-graph completeness ([1f1d9e1](https://github.com/event4u-app/agent-config/commit/1f1d9e1f8f8186de51071f47ca20ed649fad01f3))
* **bench:** length-neutral judge rerun — executed, SECOND INCONCLUSIVE (gate closed-by-diagnosis) ([66ba0a3](https://github.com/event4u-app/agent-config/commit/66ba0a3e7a995fb8f7db1b795d33682328dc8596))
* **council:** restate pass — the last wiring item (pre-round-1, transport-safe) ([4df6069](https://github.com/event4u-app/agent-config/commit/4df6069e127a0467f5a86aea57ea4c90929746a1))
* **council:** stance-line repair call in consult (bounded, transport-gated) ([91fd10e](https://github.com/event4u-app/agent-config/commit/91fd10e25429d7d35f460ba8560c76565007b0c6))
* **council:** debate-gate repair dispatch in run_debate (bounded, policy-gated) ([e7f6380](https://github.com/event4u-app/agent-config/commit/e7f6380639835d61c72b4b89cb79d77a5c90cb9c))

### Bug Fixes

* **ci:** roadmap-ci-steps-mechanics joins the task-invocation skip class ([659d775](https://github.com/event4u-app/agent-config/commit/659d775099bd67168beac8a5742a4efbe773b690))
* **ci:** skill description under the 200-char linter cap + modernize a migrated legacy path ([893ce69](https://github.com/event4u-app/agent-config/commit/893ce6922df759ac2432b221e28951a292233a47))
* **proof:** move the honest-null entry into the build_proof generator ([5c1a12c](https://github.com/event4u-app/agent-config/commit/5c1a12c152d35fd320e40f0173b27f842fb39903))
* **ci:** regenerate proof.md post-merge + de-literalize example imports ([6ff330d](https://github.com/event4u-app/agent-config/commit/6ff330d5a84c4682fae63eb2331ec3f645473cb4))
* **claims:** thin-projection honesty + pre-register the council-vs-solo baseline ([6aee669](https://github.com/event4u-app/agent-config/commit/6aee669e311261121f582793e47698e029b0c8ae))
* **identity:** resolve the placeholder git identity and guard against recurrence ([b17a801](https://github.com/event4u-app/agent-config/commit/b17a801dd16ddda9c3bcfd6b269dc65aff5a5e41))
* **counts:** regenerate CAPABILITIES.yaml and close the structured-surface drift gap ([55aafb5](https://github.com/event4u-app/agent-config/commit/55aafb58b7f0e775b73a100d0b83f55b13defea0))

### Documentation

* **posture:** knowledge scaling reality + local_auto_run as deliberate design ([ad9f43b](https://github.com/event4u-app/agent-config/commit/ad9f43baaa52cea533f6e1fd91ca012d95d35e9e))
* **maintainers:** one-page system map + prepared branch protection ([efe63d0](https://github.com/event4u-app/agent-config/commit/efe63d006ff7ef97b1f4e201c29e53824ef3af95))
* **claims:** pre-register the utilization-window decision criteria ([4667adf](https://github.com/event4u-app/agent-config/commit/4667adf085af9d2e178932b0a3fc9e2d674d6d2c))
* **roadmap:** complete + archive road-to-opt-retrieval-and-memory ([cfc8657](https://github.com/event4u-app/agent-config/commit/cfc86578b7033945d227db80d98821aef33b8917))
* **roadmap:** complete + archive road-to-opt-council-deliberation ([8777a8e](https://github.com/event4u-app/agent-config/commit/8777a8ebf90c2fc32362cfcbe1e58f8bee8f56d7))
* **proof:** persona-identity-placebo-null — backed claim + honest-null story ([0d0de13](https://github.com/event4u-app/agent-config/commit/0d0de1387b6cd61a0165ec26a1db695172dcc2bd))
* **rules:** rule-body migration inventory + P4 batches into request-scoped-rule-load ([c5abc40](https://github.com/event4u-app/agent-config/commit/c5abc40e4edc09d92681afbeae5f837f63784e29))
* **bench:** record the closed-by-diagnosis disposition ([e02f7d7](https://github.com/event4u-app/agent-config/commit/e02f7d765d1aa2d61ae7bd1e879b27a1711fe595))
* **roadmap:** flip the restate step + the confirmed harness prerequisite ([6415b3e](https://github.com/event4u-app/agent-config/commit/6415b3e672a659e8453159ca7e421d2ce7fdb9da))
* **roadmap:** flip the stance-repair + chairman-ADR steps ([c1278a0](https://github.com/event4u-app/agent-config/commit/c1278a092027bb1659ba37d3281b9692a2c4066e))
* **adr:** ADR-120 — council chairman mode supersedes always-host synthesis ([9e593f4](https://github.com/event4u-app/agent-config/commit/9e593f42bcd5ff844332eb7eca4fbb545be7d8fd))
* **roadmap:** flip the debate-gate repair-dispatch step ([d4bba6b](https://github.com/event4u-app/agent-config/commit/d4bba6b31c1ceca01480f66ea80174a27887ab88))

### Chores

* **sync:** propagate the shortened skill description into the generated domain README ([ec2a931](https://github.com/event4u-app/agent-config/commit/ec2a931e76b148c0c653dad3353f6f11590edf33))
* **roadmaps:** feedback-8.11-2 disposition executed and archived ([0037d52](https://github.com/event4u-app/agent-config/commit/0037d521c62699d3757b5e975dafbec54beab1b4))
* **condense:** record knowledge-card template condensation hash ([7ce68cc](https://github.com/event4u-app/agent-config/commit/7ce68cc38d976a4e10666bdf006db4059d788305))
* **roadmaps:** feedback-8.11 disposition executed and archived ([960179f](https://github.com/event4u-app/agent-config/commit/960179fa08e343a8e1bb1856bce76e2025abe8d3))

Tests: 7509 (+130 since 8.11.0)
