# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.

## [Unreleased]

Two roadmaps land in this release.

**Universal Execution Engine (R1)** — the `/implement-ticket` runtime is
renamed and re-shaped into a universal dispatcher. **No user-visible
behavior change** — the `/implement-ticket` slash command and the
`./agent-config implement-ticket` CLI are byte-stable, gated by the
new Golden-Transcript replay harness.

**Prompt-Driven Execution (R2)** — a new `/work` command drives free-form
prompts through the same `work_engine` dispatcher with a
confidence-band gate at `refine`. UI-shaped prompts are rejected with an
explicit Roadmap-3 pointer; backend-only in this release. R1 goldens
remain byte-equal across the R2 changes.

### Features

* **engine:** universal `work_engine` Python module with explicit
  `version: 1` state schema, `directive_set` envelope (backend / ui-stub
  / mixed-stub), and `input.kind`-based dispatch ready for prompt-driven
  and UI directives in R2 / R3.
* **migration:** `work_engine.migration.v0_to_v1` auto-migrates
  `.implement-ticket-state.json` → `.work-state.json` on first run;
  v0 file preserved as `.implement-ticket-state.json.bak`. Idempotent
  and refuses to overwrite an existing v1 destination.
* **tests:** Golden-Transcript replay harness with 5 live-captured
  baseline transcripts (`tests/golden/baseline/GT-{1..5}/`),
  `CHECKSUMS.txt` SHA-256 manifest, four strict comparators
  (exit codes, state-snapshot structure, halt-marker shape, delivery
  report headings) with allow-listed free-text drift on `questions`
  and `report` bodies. Both pytest (`tests/golden/test_replay.py`) and
  CLI (`python3 -m tests.golden.harness`) entry points.
* **command:** `/work` — sibling entrypoint to `/implement-ticket` that
  drives free-form prompts through the same `work_engine` dispatcher
  with `input.kind="prompt"`. Backed by the `command-routing` and
  `refine-prompt` skills.
* **engine (R2):** prompt resolver (`work_engine.resolvers.prompt`)
  builds the prompt envelope; `directives/backend/refine.py::_run_prompt`
  reconstructs acceptance criteria, scores the prompt on five
  dimensions, and dispatches on the resulting band.
* **scoring:** deterministic, heuristic-only confidence scorer at
  `work_engine.scoring.confidence` — single source of truth for the
  rubric (`goal_clarity`, `scope_boundary`, `ac_evidence`, `stack_data`,
  `reversibility`) and band thresholds (`high ≥ 0.8`, `medium ≥ 0.5`,
  `low < 0.5`).
* **band-action gate:** silent proceed on `high`, assumptions-report
  halt on `medium`, one-question halt on `low` (per the
  `ask-when-uncertain` Iron Law). UI-shaped prompts rejected with an
  explicit Roadmap-3 pointer.
* **tests (R2):** four new Golden Transcripts (`GT-P1` high-band happy,
  `GT-P2` medium-band release, `GT-P3` low-band one-question halt,
  `GT-P4` UI-intent rejection) pinned alongside the R1 goldens —
  9 transcripts total in `task golden-replay`.

### Changed

* **engine (refactor):** internal Python module renamed
  `implement_ticket` → `work_engine`. Public CLI surface, slash command,
  user-facing prompts, halts, and delivery report are unchanged. State
  filename moves from `.implement-ticket-state.json` to `.work-state.json`
  with auto-migration.
* **engine (R2):** `refine` SUCCESS paths now mirror
  `data["reconstructed_ac"]` into `state.ticket["acceptance_criteria"]`
  as an independent list copy, so downstream gates (`analyze`, `plan`)
  read the same AC slot regardless of envelope kind.

### Deprecated

* **`implement_ticket` Python module** — re-export shim retained for
  backwards compatibility; emits `DeprecationWarning` on import.
  Internal Python consumers should migrate to `from work_engine import …`.
  Removal is a separate user-driven decision, not pinned to a release.

### CI

* **freeze-guard:** named `task golden-replay` step in `Taskfile.yml`
  and a dedicated `Golden Replay` step in `.github/workflows/tests.yml`,
  both invoked before the main pytest sweep so structural regressions
  surface first. Freeze-guard workflow rejects baseline edits outside
  `R1-P1`-tagged commits.
* **roadmap-progress-check** wired into `task ci` (1.13.0 carry-over).

### Documentation

* **ADR (R1):** [`agents/contexts/adr-work-engine-rename.md`](agents/contexts/adr-work-engine-rename.md)
  — rationale, scope of the rename, compatibility shim policy, state
  migration, golden-test contract, tradeoffs, non-goals.
* **ADR (R2):** [`agents/contexts/adr-prompt-driven-execution.md`](agents/contexts/adr-prompt-driven-execution.md)
  — naming decision (`/work` over `/do`), confidence-band gate,
  AC-projection fix, R3 deferral boundary, and golden contract.
* **flow:** `agents/contexts/implement-ticket-flow.md` gains a "Replay
  protocol — Strict-Verb comparison" section (R1) and a
  "Prompt envelopes and confidence bands (R2)" section pinning the
  band-action mapping to the scorer module.
* **README + AGENTS.md template:** document `/work` as the sibling
  entrypoint, the confidence-band rubric, and the
  `/work` vs. `/implement-ticket` selection rule.
* **rules:** `scope-control` forbids release / version / deprecation-date
  language in roadmaps, plans, and ADRs; introduces a `Decline = silence`
  policy preventing branch-switch and PR proposals from being re-asked
  on the same task.

**Artefact-Engagement Telemetry** — opt-in, default-off measurement layer
that records which skills, rules, commands, and guidelines the agent
consults and applies during a `/implement-ticket` or `/work` run.
Maintainer-targeted; consumers see no prompts.

### Features

* **telemetry:** `./agent-config telemetry:record` and
  `./agent-config telemetry:report` CLI scripts + `telemetry/` Python
  package (boundary, aggregator, renderer, schema). Default-off via
  `telemetry.artifact_engagement.enabled` in `.agent-settings.yml`.
* **schema:** `schema_version: 1` JSONL events with `task_id`,
  `boundary_kind`, `consulted` / `applied` (kind→ids), `ts`,
  `tokens_estimate`. Aggregator silently skips lines with unknown
  schema versions.
* **report:** quartile bucketing on applied/consulted ratio — Essential
  (top 20 %), Useful (mid 60 %), Retirement Candidates (bottom 20 %) —
  emitted as Markdown or JSON.
* **rule:** `artifact-engagement-recording` — fires per phase-step
  inside `/implement-ticket` and `/work`; no-op under the default-off
  gate so the recording path costs nothing when disabled.
* **privacy:** `check_id_redaction` validator enforces a redaction
  floor (no path separators, no file extensions, no control characters,
  no whitespace, non-empty) on **both** write and export. Tampered or
  legacy logs cannot leak through reports — renderer re-validates.
* **tests:** 36 redaction test cases plus end-to-end CLI coverage
  in `tests/telemetry/`.

### Documentation

* **ADR:** [`agents/contexts/adr-artifact-engagement.md`](agents/contexts/adr-artifact-engagement.md)
  — rationale, default-off doctrine, privacy contract, schema
  versioning, deprecation horizon.
* **flow:** `agents/contexts/artifact-engagement-flow.md` is the
  cross-cutting reference for what gets recorded, when, and under
  which constraints; includes the maintainer hand-audit recipe.
* **AGENTS.md + README.md:** short *Maintainer telemetry (opt-in)*
  pointer; consumers see nothing.
* **`/onboard`:** Step 9 emits a one-screen maintainer-only hint
  describing the feature; no question, no prompt.

## [1.13.0](https://github.com/event4u-app/agent-config/compare/1.12.0...1.13.0) (2026-04-27)

### Features

* **postinstall:** hint about optional @event4u/agent-memory backend ([395cff1](https://github.com/event4u-app/agent-config/commit/395cff164770da4a18d4287effd9ce06b2cee8b9))
* **npm:** declare @event4u/agent-memory as optional peer dependency ([cef7715](https://github.com/event4u-app/agent-config/commit/cef77159d2d7cd0ba29c78c9c2115f1d08f0e649))
* **composer:** suggest @event4u/agent-memory as optional memory backend ([6585c32](https://github.com/event4u-app/agent-config/commit/6585c324fcc65ad08f1d50f0e54a7f56b2018d03))
* **scripts:** fail check mode on unarchived complete roadmaps ([f017979](https://github.com/event4u-app/agent-config/commit/f0179792a9b15588182815a17e4ac7366dad1db0))
* **scripts:** add hooks:install and pre-commit roadmap-progress hook ([cab9048](https://github.com/event4u-app/agent-config/commit/cab90482ad2bf70fa08f9494236eb19b72e5d58b))
* **templates:** ship roadmap-progress-check GitHub Actions workflow ([a16c560](https://github.com/event4u-app/agent-config/commit/a16c560d57f3cefd0b99aeaadd0946c3a8865866))
* **memory:** real backend health envelope ([145bd13](https://github.com/event4u-app/agent-config/commit/145bd13ec6027d48a90cdacc3622ef9cca7d8c05))
* **memory:** package-backed operational provider (Drift #2) ([284be4c](https://github.com/event4u-app/agent-config/commit/284be4c4addca37490b727a2aec9d45c1fa9b274))
* **rules:** require recommendations on every numbered-option question ([ed9f5c9](https://github.com/event4u-app/agent-config/commit/ed9f5c9271c486a920fed3fbbea10fc16e75f685))
* **memory:** wire agent-memory MCP server + recognize 'memory' binary ([e24168b](https://github.com/event4u-app/agent-config/commit/e24168b12bd8f5711ec02f6511c3afa952e595a8))

### Documentation

* **readme:** document @event4u/agent-memory as optional companion ([350930f](https://github.com/event4u-app/agent-config/commit/350930fcee3134275bbed26a6783d54837eba568))
* **agent-memory:** align contract with reality — CLI surface + drift status ([6cdf19e](https://github.com/event4u-app/agent-config/commit/6cdf19ee256b52aa7602419fde730477d2a904de))

### CI

* wire roadmap-progress-check into task ci ([2022396](https://github.com/event4u-app/agent-config/commit/20223964f2c391598efca5b9e76fd5ca1365f05e))

## [1.12.0](https://github.com/event4u-app/agent-config/compare/1.10.0...1.12.0) (2026-04-25)

### Features

* **release:** add automated release pipeline ([1bf2e0f](https://github.com/event4u-app/agent-config/commit/1bf2e0fa6862aee7a85da84e4f96586e7ab49a4a))
* **settings:** add sync_agent_settings.py + /sync-agent-settings command ([40443c8](https://github.com/event4u-app/agent-config/commit/40443c87cb397a8ea34c1f51557603937a0d116a))
* **gitignore:** add /sync-gitignore command + regenerated tool projections ([d04aae6](https://github.com/event4u-app/agent-config/commit/d04aae6c6ac64d56756242c562269629907d5776))
* **gitignore:** add sync_gitignore.py + single-source-of-truth template ([9d32a32](https://github.com/event4u-app/agent-config/commit/9d32a32f70341d4d8ad78acaa84f8d01b99d182f))
* **chat-history:** /chat-history-resume routes on 4-state ownership ([fb917d4](https://github.com/event4u-app/agent-config/commit/fb917d4abb6c9a9f8e8b289c82ada43b46943d86))
* **chat-history:** rewrite rule for 4-state flow (match/returning/foreign/missing) ([cde8017](https://github.com/event4u-app/agent-config/commit/cde8017ab550d95a63e813c8dc1b797e267e568a))
* **chat-history:** schema v2 with 4-state ownership model ([35825b4](https://github.com/event4u-app/agent-config/commit/35825b41afd8f0c58304f3ce7f08f52ebfe8b5aa))
* **chat-history:** gitignore, docs, and /agent-handoff cross-ref ([1198be4](https://github.com/event4u-app/agent-config/commit/1198be4492e77e2ace2cb903488e21ae55cf546a))
* **chat-history:** add /chat-history, /chat-history-resume, /chat-history-clear commands ([a5e9135](https://github.com/event4u-app/agent-config/commit/a5e9135b86d932880ed933b35cd02ebe742dbc88))
* **chat-history:** add always-active chat-history rule ([0ae95a6](https://github.com/event4u-app/agent-config/commit/0ae95a6edfd2b61badb58ee70679150575bc52ef))
* **chat-history:** per-profile chat_history settings + installer placeholders ([fca9316](https://github.com/event4u-app/agent-config/commit/fca931667b421e1156994414d2a6d7e4f87b3472))
* **chat-history:** add chat_history.py helper with JSONL log + overflow handling ([f0cc419](https://github.com/event4u-app/agent-config/commit/f0cc419a02df932af1920b33c4be143ac6636e73))
* **onboarding:** centralized first-run flow with /onboard and onboarding-gate ([c35c763](https://github.com/event4u-app/agent-config/commit/c35c76352b63e3f3f079d1fb7be5a24af8ca8b6b))
* **settings:** enable skill_improvement by default in every profile ([2ecc310](https://github.com/event4u-app/agent-config/commit/2ecc3104730b6a929d87e7ed7c6a34c8aabef027))
* **commands:** add /set-cost-profile to change cost_profile interactively ([b38d8b5](https://github.com/event4u-app/agent-config/commit/b38d8b591df56045fe7a8116f968a568ef4877d8))
* **publish:** add workflow_dispatch to publish-npm ([cae25f8](https://github.com/event4u-app/agent-config/commit/cae25f8ed71443237a2e98fe298959a0218720d0))

### Bug Fixes

* **release:** force-prune tags during preflight fetch ([e79230f](https://github.com/event4u-app/agent-config/commit/e79230f8aa58a3ac1370e23a996acd61ed528e15))
* **release:** surface stderr when captured commands fail ([b34de56](https://github.com/event4u-app/agent-config/commit/b34de56aa021dabc710e098bf8ffba0d0a842641))
* **release:** probe gh auth via api user, not auth status ([daecc3e](https://github.com/event4u-app/agent-config/commit/daecc3e0e1924625e7c383f12e7435c8dbcb6eaf))
* **install:** preserve bare identifiers in _yaml_scalar ([43accda](https://github.com/event4u-app/agent-config/commit/43accda2c8ef624de6b0cb509aba8201c6c2382b))
* **roadmap-progress:** support roman and letter phase IDs ([fabd903](https://github.com/event4u-app/agent-config/commit/fabd9039391b979d5f56da8745f792b8e460ee6b))
* **cli:** resolve symlinks in agent-config so PACKAGE_ROOT works when invoked via PATH/global install ([2d2c592](https://github.com/event4u-app/agent-config/commit/2d2c59292ee4abe630c2541a0056c06596eb1abd))
* **rules:** wire no-blind-implementation into think/improve/ask ([fa0c908](https://github.com/event4u-app/agent-config/commit/fa0c908ea832a58f00b70991cd2899b512c86952))
* **rules:** repair handoff-ordering ref in ask-when-uncertain ([aeb4c33](https://github.com/event4u-app/agent-config/commit/aeb4c3377aeba9cb114837ea68dc320f9cd31a16))
* **npm:** add repository, bugs, and homepage fields to package.json ([d794eab](https://github.com/event4u-app/agent-config/commit/d794eab3918118a513de1fcc78204d15d8b7aae9))
* **release:** drop component prefix from tags and split npm publish workflow ([281c225](https://github.com/event4u-app/agent-config/commit/281c225ef5d9b266e487f434606111622569cd9f))

### Documentation

* **release:** rewrite release process for the new pipeline ([8f1a60f](https://github.com/event4u-app/agent-config/commit/8f1a60fbb8f2eb6abea5ee960c7715acbffaa38c))

### Refactoring

* **ask-when-uncertain:** remove only-exception, make one-question-per-turn absolute ([ec152e6](https://github.com/event4u-app/agent-config/commit/ec152e62e7206e655a81fe3592e3f11fe0f94dad))
* **install:** delegate .gitignore handling to sync_gitignore.py ([448ae90](https://github.com/event4u-app/agent-config/commit/448ae90c098b4841543020641d4bd626c376f5c0))
* **settings:** remove /config-agent-settings, move pr_comment_bot_icon to personal ([5e61522](https://github.com/event4u-app/agent-config/commit/5e615228899cccf1a33e88c51c2230b692dd994b))

### Chores

* **ci:** point release workflows at task release ([cc809ba](https://github.com/event4u-app/agent-config/commit/cc809baf94a4359a968900162d07788ce2d1650a))
* remove release-please ([5ed3816](https://github.com/event4u-app/agent-config/commit/5ed381672697d94f8b84706dd70fcccae85b9f5d))
* **chat-history:** regenerate projections + docs for 4-state flow ([688aa2d](https://github.com/event4u-app/agent-config/commit/688aa2df7f8b07f829793a5df9c2b75f9da3cc8e))
* **chat-history:** regenerate multi-agent tool projections ([c8cf487](https://github.com/event4u-app/agent-config/commit/c8cf4876f6a61fc68040ce2a861141f6810b933e))
* release main (#23) ([2d69625](https://github.com/event4u-app/agent-config/commit/2d6962536d250a8d6edd08d3e6cd92be0f2fb145))

## [1.11.0](https://github.com/event4u-app/agent-config/compare/1.10.0...1.11.0) (2026-04-23)


### Features

* **publish:** add workflow_dispatch to publish-npm ([cae25f8](https://github.com/event4u-app/agent-config/commit/cae25f8ed71443237a2e98fe298959a0218720d0))


### Bug Fixes

* **npm:** add repository, bugs, and homepage fields to package.json ([d794eab](https://github.com/event4u-app/agent-config/commit/d794eab3918118a513de1fcc78204d15d8b7aae9))
* **release:** drop component prefix from tags and split npm publish workflow ([281c225](https://github.com/event4u-app/agent-config/commit/281c225ef5d9b266e487f434606111622569cd9f))

## [1.10.0](https://github.com/event4u-app/agent-config/compare/agent-config-1.9.1...agent-config-1.10.0) (2026-04-23)


### Features

* **.github:** add issue templates ([7f3410f](https://github.com/event4u-app/agent-config/commit/7f3410f218aca19e50ddac8879aee02de8f938a4))
* add /package-test and /package-reset commands ([b283ca0](https://github.com/event4u-app/agent-config/commit/b283ca0a191983fa614c72d0ab37a62a877dae7a))
* add agent interaction quality guideline + extend 2 rules ([446c2d2](https://github.com/event4u-app/agent-config/commit/446c2d2fc5c7e4da84edf40b31a14c63e865c9bc))
* add compression hash check to CI pipeline ([f32f1af](https://github.com/event4u-app/agent-config/commit/f32f1af678ca630f65e719b33eb2199ec9bd7597))
* add compression quality checker ([ecea391](https://github.com/event4u-app/agent-config/commit/ecea391f5b35fe344e48fdb1092389531ca1e90f))
* add consistency CI workflow and Taskfile targets ([e833f1b](https://github.com/event4u-app/agent-config/commit/e833f1b5c6798483b0224c7be6611bff8edabf77))
* add cross-reference checker script and Taskfile targets ([5f44a64](https://github.com/event4u-app/agent-config/commit/5f44a644c4185ee3476beeca6aada040771c1eee))
* add developer-like-execution skill and think-before-action rule ([5296ecb](https://github.com/event4u-app/agent-config/commit/5296ecbef496cf8c250714540596593fd3642a1d))
* add dual-write workflow for improving shared rules from projects ([75fffc5](https://github.com/event4u-app/agent-config/commit/75fffc54c4ac53dca2a8e1239170e0a07d783a75))
* add first-run experience script and getting-started guide ([5d92823](https://github.com/event4u-app/agent-config/commit/5d92823a8b6bf61dae953245fe59fd1bfb08da48))
* add interaction quality checks to linter + new guideline ([ddda9c2](https://github.com/event4u-app/agent-config/commit/ddda9c21b833a814ed6e25428f649e962e188923))
* add learning capture loop — rule + 2 skills ([8608919](https://github.com/event4u-app/agent-config/commit/8608919ba1c88b72b363a9e51838c2844758e529))
* add package portability checker and integrate both checks into CI ([7ed843a](https://github.com/event4u-app/agent-config/commit/7ed843a9790748d21bd7884d6453b4fa7f62df2b))
* add PHP installer and versioned profile presets ([68de85d](https://github.com/event4u-app/agent-config/commit/68de85d4f30dc2548986e5e860b804641b113308))
* add setup.sh for automatic post-install/update hook registration ([705fdec](https://github.com/event4u-app/agent-config/commit/705fdec192e684713a54c81d6ba8918ee223caba))
* add size-and-scope guideline, size-enforcement and rule-type-governance rules ([06a9a0e](https://github.com/event4u-app/agent-config/commit/06a9a0e329b2c39bf00d7fd80686ffc9bcd95208))
* add skill linter MVP script with tests and Taskfile commands ([b089307](https://github.com/event4u-app/agent-config/commit/b08930780ab574dc5bfd877a3355d5b5d8bb3aaa))
* add skill-lint CI workflow and ci Taskfile target ([9ae6069](https://github.com/event4u-app/agent-config/commit/9ae606966d5fb474d92655a5fbda4341c367548b))
* add skill-linter skill for structural validation ([beef538](https://github.com/event4u-app/agent-config/commit/beef53885129f8d6ef2f7068c0abaa6229d6c8b8))
* add stale hash detection and cleanup ([abe53b4](https://github.com/event4u-app/agent-config/commit/abe53b42a9264aa6c27986339678a203359fd465))
* add tool-first/script-last and targeted operations to token-efficiency rule ([95572fb](https://github.com/event4u-app/agent-config/commit/95572fbd5e2c67ed048883ab83bc7bfbb2ace877))
* adopt MIT license across metadata and docs ([ef37d19](https://github.com/event4u-app/agent-config/commit/ef37d19b93c0e0b5155fe4103c38ed5521b983d4))
* **agent-memory:** retrieval v1 schema + conformance tests ([8a3d4fb](https://github.com/event4u-app/agent-config/commit/8a3d4fb288ecc4e4efb9bf63acea136e4f20d96e))
* **audit:** add skill-description audit tool + 2026-04-21 baseline ([3abd7f7](https://github.com/event4u-app/agent-config/commit/3abd7f7e6ca2aba047c84741bf1b46dd9d129363))
* **ci:** rewrite ci_summary as dispatcher consumer ([bbce646](https://github.com/event4u-app/agent-config/commit/bbce646a78fca084a414195810feb6269ae7be30))
* **ci:** wire pr_review_routing.py into pr-risk-review workflow ([d19d5da](https://github.com/event4u-app/agent-config/commit/d19d5da2abb400d83e5d9ba512cb1f26c280e58a))
* **claude-plugin:** Phase 1 of anthropic alignment — Claude Code Plugin Marketplace ([ec79750](https://github.com/event4u-app/agent-config/commit/ec797502ba7e647cc4dd186b96ac9686c1112c2d))
* **command:** /review-changes dispatches to four judge sub-skills ([d27149b](https://github.com/event4u-app/agent-config/commit/d27149bec4dd1a4ee43f2c8dad36389ab4e3096b))
* **commands:** add /analyze-reference-repo ([08c4b1e](https://github.com/event4u-app/agent-config/commit/08c4b1e51f6db0466f248101bb637fa99bede676))
* **commands:** add /copilot-agents-init for consumer scaffolding ([fa5289c](https://github.com/event4u-app/agent-config/commit/fa5289c67bf53536d1bbaaabc9e91d847081341d))
* **commands:** add /do-and-judge, /do-in-steps, /judge ([0ebb02d](https://github.com/event4u-app/agent-config/commit/0ebb02d10ea154e4993cb248c48e953c0dfffa16))
* **commands:** add /fix-references + /fix-portability, expand portability patterns ([f9578b3](https://github.com/event4u-app/agent-config/commit/f9578b3332d68b87653255c0e5e1443fcf71edaa))
* **commands:** add /rule-compliance-audit command ([779d9d8](https://github.com/event4u-app/agent-config/commit/779d9d8af8003e7c1c12fbbc4b3020e0b826dcea))
* **commands:** add /upstream-contribute command ([6bb7349](https://github.com/event4u-app/agent-config/commit/6bb73493b1b3b90a00a2a831aae07feb0271cbac))
* **commands:** cross-link refine-ticket + estimate-ticket from feature-plan ([e8c6bce](https://github.com/event4u-app/agent-config/commit/e8c6bcebd0a7823e9bba3767a0506f250ddebca4))
* **commands:** feature-explore hints at /refine-ticket for ticket-shaped input ([932d763](https://github.com/event4u-app/agent-config/commit/932d76323e4f4eb0bfb73f1e8a89b8f48738f272))
* **commands:** route work commands + skills into agent-memory ([fe0502b](https://github.com/event4u-app/agent-config/commit/fe0502b4fb04f2c0cee20b423b5759ea968a6e8b))
* complete post-pr2-hardening roadmap (all 8 phases) ([14af4f6](https://github.com/event4u-app/agent-config/commit/14af4f6523760bdc8aa14764c2d20c05af685f08))
* **config:** add subagent_* keys to .agent-settings template ([a24ef26](https://github.com/event4u-app/agent-config/commit/a24ef266b6e9c83312436351e1aea0cfb0b8c8c2))
* **copilot-agents-optimize:** scan for legacy identifiers and stack drift ([ab6aa6c](https://github.com/event4u-app/agent-config/commit/ab6aa6c634fa0a46e75f8f8b596c085898e249b7))
* **counts:** track roadmap baselines in update_counts (Q12) ([991eaf7](https://github.com/event4u-app/agent-config/commit/991eaf72ef3e60b69e9a4ba80f4ae61b1bdaf6ec))
* **defensive-agent:** Wave 1 foundation + judge 8/8 calibration ([eb1f814](https://github.com/event4u-app/agent-config/commit/eb1f814e90f6dcc3bd8434ef891465fc6a393679))
* **defensive:** Wave 3 knowledge-layer templates + context-authoring ([419977a](https://github.com/event4u-app/agent-config/commit/419977a207a0a87100b8af8b74fe241016a72dc0))
* **drafting-protocol:** wire Phase 4 eval integration ([dc2523e](https://github.com/event4u-app/agent-config/commit/dc2523ed3717b9235da10f7a49303e28fd81e1a0))
* enforce analysis-before-change across skills, rules, and code ([dff7ad9](https://github.com/event4u-app/agent-config/commit/dff7ad9894de8ec79e73d4240fa0a91d9452e6ec))
* **evals:** add trigger-eval runner + pilot test vectors ([0bb60fe](https://github.com/event4u-app/agent-config/commit/0bb60fe29b0e7a5c44d6586cf294230c0ed76dc6))
* **evals:** bootstrap .venv for live runner with pinned anthropic SDK ([963adbf](https://github.com/event4u-app/agent-config/commit/963adbf24a1d4869158e3ef2169e319fe9c92302))
* **evals:** harden trigger-eval runner for live API use ([d1f8035](https://github.com/event4u-app/agent-config/commit/d1f80356e9b8a0c47c116254b7e4afeea079f74f))
* expand linter with command size, guideline size, and rule-type checks ([120fe5a](https://github.com/event4u-app/agent-config/commit/120fe5aa581c15851dfc8deeed9184145ff81caf))
* **feedback:** add feedback collector with outcome classification and suggestions ([da32d98](https://github.com/event4u-app/agent-config/commit/da32d987c81c765e74fc78e917a09f8085cfe9d6))
* **governance:** add update_counts.py + wire into ci/sync ([ae2b6ed](https://github.com/event4u-app/agent-config/commit/ae2b6ed46d2e666902105609137960b057e58a1c))
* **governance:** CI summary + feedback governance with actionable proposals ([76b1811](https://github.com/event4u-app/agent-config/commit/76b1811e00cc03bc2d02be48abd579b7612ae5b0))
* **implement-ticket:** /implement-ticket command + entry-flow references ([d265c1d](https://github.com/event4u-app/agent-config/commit/d265c1d79277038b7435a780acb0f2731b00b73f))
* **implement-ticket:** CLI orchestrator — python3 -m implement_ticket ([77981ec](https://github.com/event4u-app/agent-config/commit/77981eca019d97b1e1423bf766b5f6aa7ee8d6ef))
* **implement-ticket:** close Phase 3/4 — ambiguity declarations + roadmap AC ([238c604](https://github.com/event4u-app/agent-config/commit/238c604ce7ba74b88fe8571fc2403f9de11f2bb9))
* **implement-ticket:** Option A — agent directives + dispatcher resume ([f6cee1f](https://github.com/event4u-app/agent-config/commit/f6cee1ff1d8d4f7edd5e7ba60d42bcd92336fc64))
* **implement-ticket:** persona policies — senior-engineer, qa, advisory ([ff1a073](https://github.com/event4u-app/agent-config/commit/ff1a073ab96f54bdf680e26c41a12e76bfcc645c))
* **implement-ticket:** Phase 1 — DeliveryState + linear dispatcher ([cfe8d52](https://github.com/event4u-app/agent-config/commit/cfe8d5272317648c50e3216ae76d895c29b695dc))
* **implement-ticket:** Phase 2 — analyze + plan gates + report renderer ([25ba7da](https://github.com/event4u-app/agent-config/commit/25ba7da1694b6b723029af9583179c0108659293))
* **implement-ticket:** Phase 2 complete — implement + test + verify ([9c59225](https://github.com/event4u-app/agent-config/commit/9c59225d011ded1ce42a1631277af2486897f288))
* **implement-ticket:** Phase 2/8 — refine + memory step handlers ([1c71ca1](https://github.com/event4u-app/agent-config/commit/1c71ca1e68e83b613112c7b46468ac41f16047d8))
* **install:** add scripts/install orchestrator as primary entry point ([1c880fc](https://github.com/event4u-app/agent-config/commit/1c880fcdeaeb512942c3abbd6c7fdbf89b089d40))
* **installer:** replace silent '|| true' postinstall with a loud wrapper ([f32bedc](https://github.com/event4u-app/agent-config/commit/f32bedc68e9ba9860593cba1cd80010e26f080fd))
* **installer:** show 3 aha-moment prompts in install output ([443e621](https://github.com/event4u-app/agent-config/commit/443e621bee1140db98395dd19a3970c13927ae83))
* **judgment:** improve-before-implement rule + validate-feature-fit skill ([1ebd22c](https://github.com/event4u-app/agent-config/commit/1ebd22c7ce687ec80e0fa9b98090d48120274e14))
* **lifecycle:** add skill lifecycle management with health scoring ([098c06c](https://github.com/event4u-app/agent-config/commit/098c06cee7585cd96e7d6e4332d5eb0d838f0e91))
* **linter:** add execution quality checks for developer workflow enforcement ([e9b73bc](https://github.com/event4u-app/agent-config/commit/e9b73bc783c024b795ec666b61ac3e0a82dd4df1))
* **linter:** add quality report details, compression checks, and pointer-only tests ([836288a](https://github.com/event4u-app/agent-config/commit/836288ac46dace2f9197449127faed99a0151b3c))
* **linter:** add README quality linter with CI integration ([3a32739](https://github.com/event4u-app/agent-config/commit/3a32739b2eae710fc4e184c567e2418549ccc2b9))
* **linter:** add regression detection between branches ([8163409](https://github.com/event4u-app/agent-config/commit/81634092a103908aeffb65ee51ec675717199462))
* **linter:** Phase 2 — expand synonyms + fix 8 failing skills → 0 FAIL ([b691904](https://github.com/event4u-app/agent-config/commit/b691904b80c5dc9cb7612d56628a38941f2909ac))
* **linter:** Phase 2c — section-based detection complements keywords ([8c52d2a](https://github.com/event4u-app/agent-config/commit/8c52d2a99c3dab886fd72c9e5d21b6a65eecc4b9))
* **linter:** Phase 3 — type boundary enforcement ([44605e6](https://github.com/event4u-app/agent-config/commit/44605e6b55d507d907cd28713a7236ba6b5428cc))
* **linter:** Phase 4 — verification maturity mapping ([619d1e6](https://github.com/event4u-app/agent-config/commit/619d1e6c89ac413ef1c035a92d42239b774b7ef6))
* **linter:** Phase 5 — governance and packaging consistency ([f6db739](https://github.com/event4u-app/agent-config/commit/f6db739ca68e540b47d1665e12ba70f9bb2b7626))
* **mcp:** add mcp.json renderer with ${env:VAR} substitution ([1d4b868](https://github.com/event4u-app/agent-config/commit/1d4b86850dc086f62d775847ab49a11a093bf6f0))
* **memory:** add engineering memory data format and schema check ([a582013](https://github.com/event4u-app/agent-config/commit/a582013b7611657f10dcd1cf28040431b802a3d4))
* **memory:** add layered settings guideline + per-project YAML template ([d66b3d3](https://github.com/event4u-app/agent-config/commit/d66b3d3fd7f4b3fa6d1574d25b85fcc48d0bbec3))
* **memory:** add memory access layer (status/lookup/signal/report) ([8e47d2b](https://github.com/event4u-app/agent-config/commit/8e47d2bc2165e2a89c46c1bd70505bf737f1c368))
* **memory:** enforce repo-vs-operational conflict rule + shadow report ([340f1e1](https://github.com/event4u-app/agent-config/commit/340f1e1b2925ad21f18e07cb9697df5dc1b30bc0))
* **memory:** memory hygiene workflow + proposal check template ([3dbff69](https://github.com/event4u-app/agent-config/commit/3dbff69d41c434a5ca4c76ba4068199e6bcac358))
* **memory:** memory-facing commands (add/full/promote/propose) ([b7e025e](https://github.com/event4u-app/agent-config/commit/b7e025ed480dc6d199a16292028d3a4fc8c3bdd4))
* **memory:** merge-safe JSONL signals and hash-addressed YAML ([198bc6d](https://github.com/event4u-app/agent-config/commit/198bc6dc71bf9b699861bf464b93d0e12159d9b6))
* **memory:** wire self-consumption into 3 rules + 3 skills ([fe52eed](https://github.com/event4u-app/agent-config/commit/fe52eed555b53ca60e4f64022b5d3770f6a745c8))
* **observability:** add structured events, metrics, and logger ([abee69b](https://github.com/event4u-app/agent-config/commit/abee69b03466e30f847b0ec01197b1e3a754b3cd))
* **observability:** persistence layer, event schema, CLI reports ([7ed7731](https://github.com/event4u-app/agent-config/commit/7ed7731cb61affd6998422025501cb1df8c30738))
* **personas:** add Core-6 + QA cast with template and README ([cce5984](https://github.com/event4u-app/agent-config/commit/cce598409efd2f87e40d233e7ccd3832d7eda9b0))
* **personas:** adversarial-review cites critical-challenger ([6903ac7](https://github.com/event4u-app/agent-config/commit/6903ac754983718de23df2352d6f255983e18eb7))
* **personas:** complete phase 1 — refs validation + tool projections ([4ea58c3](https://github.com/event4u-app/agent-config/commit/4ea58c381704f8d9e89e3e04f7e591d32c14d808))
* **personas:** complete phase 4 — skills cite personas, role-contracts links ([2b8031e](https://github.com/event4u-app/agent-config/commit/2b8031e16d92dd5bfea9f6e4eb5940247fa07fb2))
* **personas:** phase 5 — layered-settings integration ([f322b1e](https://github.com/event4u-app/agent-config/commit/f322b1eff56ca290aa03a406230ebd3d686cf678))
* **pipeline:** implement skill improvement pipeline — all 5 phases ([42e50e7](https://github.com/event4u-app/agent-config/commit/42e50e77e9db4ced1d2468266359b587eaecca37))
* **plugins:** add marketplace manifests for Augment CLI, Claude Code, and Copilot CLI ([73cbecb](https://github.com/event4u-app/agent-config/commit/73cbecb5d0f5e7da51d388b52d6e3e455feebf72))
* **portability:** extend checker to root files + identifier blocklist ([4586299](https://github.com/event4u-app/agent-config/commit/4586299599e6cb124c7d3aa68599101df4a28eb2))
* **product-maturity:** auto-detect runtime + vague-request triggers + design docs ([4e40253](https://github.com/event4u-app/agent-config/commit/4e402532e259b4dcd98df671f1ef31cbc3888041))
* **quality:** complete road-to-10 roadmap — 9.0/10 quality score ([023e404](https://github.com/event4u-app/agent-config/commit/023e404c6b5d6a94b6b92b9d2eaff4c0c590d1ea))
* **roadmap-management:** finalized-state roadmaps auto-move — fertig ist fertig ([3578eac](https://github.com/event4u-app/agent-config/commit/3578eac4029b2c601daeea79a73e459b03536b52))
* **roadmap:** add completion & archiving workflow to roadmap-manager ([e4054b3](https://github.com/event4u-app/agent-config/commit/e4054b320dee8174c66209098bab54a7e3207bfa))
* **roadmaps:** generated progress dashboard + task wiring ([6e4c095](https://github.com/event4u-app/agent-config/commit/6e4c0956d14f55d284d8d4959613e99bef0a8ea9))
* **roles:** role modes — /mode command, adherence rule, router ([1a8e4e3](https://github.com/event4u-app/agent-config/commit/1a8e4e32b1d61796e83e709405f380ad62d909cf))
* **rules+skills:** strengthen developer workflow with MCP tools and verification ([1445ec6](https://github.com/event4u-app/agent-config/commit/1445ec6c0c2e7b50aa5f9a8bf6f5914ea85bac66))
* **rules:** add artifact-drafting-protocol ([132307e](https://github.com/event4u-app/agent-config/commit/132307ecc90154691719a21b0230349159dd6a1b))
* **rules:** add missing-tool-handling rule ([739cb24](https://github.com/event4u-app/agent-config/commit/739cb2498d7ae5f584ebaa2de3c2f5e463f9bce5))
* **rules:** add package-ci-checks rule and optimize CI task order ([5315480](https://github.com/event4u-app/agent-config/commit/531548087e99173234d8e6bbd4b6b55f3014dd83))
* **rules:** add preservation-guard rule for merges and compression ([100e577](https://github.com/event4u-app/agent-config/commit/100e577826cb491538931add5f91ee16f2f19102))
* **rules:** add reviewer-awareness and review-routing-awareness ([66f5c58](https://github.com/event4u-app/agent-config/commit/66f5c585bb7ae343216ea757fd2172b494304c8c))
* **rules:** add roadmap-progress-sync — dashboard must stay real-time ([cc16e41](https://github.com/event4u-app/agent-config/commit/cc16e41f4818b97a70ae1a1e007f2b37690ea794))
* **rules:** enforce archive-on-completion in roadmap-progress-sync ([bc250bc](https://github.com/event4u-app/agent-config/commit/bc250bcda7204aada74a31071566eb3256a67dda))
* **rules:** fold break-glass mode into minimal-safe-diff and verify-before-complete ([194dabe](https://github.com/event4u-app/agent-config/commit/194dabe0fb6b1dbb3469e7fe27b280ae43604bb7))
* **rules:** harden scope-control with branch and PR gates ([b95a5c6](https://github.com/event4u-app/agent-config/commit/b95a5c696ab6570d6151bdc3b6c4a38ce234b7e8))
* **runtime:** add --output flag to dispatcher run ([94c22e5](https://github.com/event4u-app/agent-config/commit/94c22e558367d32267f4ad2798b719d5a41bccce))
* **runtime:** add command field to execution frontmatter ([a9ae385](https://github.com/event4u-app/agent-config/commit/a9ae385c45ccf632dcc2c78c96a17869fd264276))
* **runtime:** add execution model with registry, dispatcher, hooks, and error handling ([54300d9](https://github.com/event4u-app/agent-config/commit/54300d981af33f6a11f43d53e711c0415d851a7d))
* **runtime:** add ShellHandler and dispatcher run subcommand ([ac1f11f](https://github.com/event4u-app/agent-config/commit/ac1f11f8049e85cfad6b968211d8085bf30e45fd))
* **runtime:** E2E execution pipeline + session context ([1058ed4](https://github.com/event4u-app/agent-config/commit/1058ed4a92c9b3b61b6baf03bab9657d342a3ae7))
* **runtime:** execution classification standard + tag 18 assisted skills ([d6f2133](https://github.com/event4u-app/agent-config/commit/d6f213365f8164922b1e7d42ee324adda29c7a58))
* **schema:** add task validate-schema + wire into CI + docs ([866c44e](https://github.com/event4u-app/agent-config/commit/866c44ec65e0c1fc80f1783756187bec78131fde))
* **schema:** author JSON-Schemas for skill/rule/command/persona ([14dca70](https://github.com/event4u-app/agent-config/commit/14dca70a85ca45e0eaeeb2dcae762ece6311c012))
* **schema:** integrate frontmatter schema validator into linter ([62e9618](https://github.com/event4u-app/agent-config/commit/62e96181aded35bdcb4b642d341fc600c671f54c))
* **schema:** inventory frontmatter keys per artefact type ([0864c71](https://github.com/event4u-app/agent-config/commit/0864c7140cee17f0bc6338dd8af195a4e36832d8))
* **scripts:** wire personas as a first-class artifact type ([b6c0cdf](https://github.com/event4u-app/agent-config/commit/b6c0cdf0c7734185c3da5d0909a46bdbea112f4e))
* **self-improvement:** curated proposal pipeline + drift monitor ([66a118c](https://github.com/event4u-app/agent-config/commit/66a118cb00bd87e36f6fa98014523f7d5fc40e5e))
* separate package docs from consumer templates ([aba5261](https://github.com/event4u-app/agent-config/commit/aba5261c2091e0ff294c7f77bfe0df7dc4f4eff2))
* **settings:** add cost_profile setting — cheap, balanced, full, custom ([643639f](https://github.com/event4u-app/agent-config/commit/643639f4111c2e7c33fce850ccd4a6fe2099453c))
* **settings:** add granular token/output control settings + update roadmaps ([ff00273](https://github.com/event4u-app/agent-config/commit/ff002737ced30198c98825f93fdea0ce90e36767))
* **settings:** add runtime_enabled, observability_reports, feedback_collection toggles ([d49de28](https://github.com/event4u-app/agent-config/commit/d49de283da3650e2753b928aaffc428dc5c8f8a5))
* **settings:** drop opinionated ide=phpstorm default ([f18d433](https://github.com/event4u-app/agent-config/commit/f18d43306956b82a1843468184067e36ca6dfb9c))
* **settings:** migrate .agent-settings to nested YAML format ([6165f87](https://github.com/event4u-app/agent-config/commit/6165f871a0191f628a9b47069726afa4bd61d181))
* setup.sh auto-detects JSON tool (php → node → jq → python3) ([f8b55c3](https://github.com/event4u-app/agent-config/commit/f8b55c3f8f8eb07214ccc663b8bd99f2b8def4b7))
* sharpen pointer-only skill detection in linter ([6d96c47](https://github.com/event4u-app/agent-config/commit/6d96c477e6ca10c0cedb98ee9f53649ad7708209))
* **skills:** add description-assist + wire from 4 writing skills ([34bc62e](https://github.com/event4u-app/agent-config/commit/34bc62e3ecbd52437a9f994031e72323cb7b6086))
* **skills:** add developer-discipline cluster — TDD, systematic-debugging, verify-before-complete ([e9c5099](https://github.com/event4u-app/agent-config/commit/e9c50998c2901cea313081b4d7ea950bfcc8bb1d))
* **skills:** add estimate-ticket skill + command (Phase 4) ([365fdf4](https://github.com/event4u-app/agent-config/commit/365fdf4135c2112af5ee994cea0e42b6fa93809b))
* **skills:** add feedback category tags to improvement pipeline ([203e411](https://github.com/event4u-app/agent-config/commit/203e411b772d001188f3341ce867b625d3304fbb))
* **skills:** add four specialized judge sub-skills ([7f50845](https://github.com/event4u-app/agent-config/commit/7f5084519de245b4ea1bb1074851066544d032a1))
* **skills:** add lint-skills and check-refs runtime pilots ([3cdb421](https://github.com/event4u-app/agent-config/commit/3cdb421a84e66d764c24b48366415403e3f6dca5))
* **skills:** add readme-reviewer skill ([a433cb1](https://github.com/event4u-app/agent-config/commit/a433cb1e9954fa464a3665f5bdd7e30959bc166f))
* **skills:** add readme-writing skill ([c4df476](https://github.com/event4u-app/agent-config/commit/c4df47664487ef2f2b55887682ee037fb3b05d6b))
* **skills:** add readme-writing-package, clarify skill boundaries ([72cdb9b](https://github.com/event4u-app/agent-config/commit/72cdb9b7efe3fe59e8b64a55cef9ed766e47c1c7))
* **skills:** add refine-ticket skill + command (Phase 1) ([307dae8](https://github.com/event4u-app/agent-config/commit/307dae8705052ee2b1326478b910e4fd01168489))
* **skills:** add review-discipline cluster — receiving, requesting, finishing ([396174f](https://github.com/event4u-app/agent-config/commit/396174f841fec0edccaa2c160a0b1cc1e61bb065))
* **skills:** add review-routing skill with /review-routing command ([c0822a1](https://github.com/event4u-app/agent-config/commit/c0822a1e5f158eef02918785001b47f71ed12594))
* **skills:** add rule-writing, command-writing, guideline-writing ([5166f14](https://github.com/event4u-app/agent-config/commit/5166f1463530e8f24d21f376f8a11df140392bc4))
* **skills:** add subagent-orchestration skill + configuration context ([a0ae427](https://github.com/event4u-app/agent-config/commit/a0ae42708a454bc6e83b32d0e7d29f228dd6b262))
* **skills:** add upstream-contribute skill ([ab5e1b1](https://github.com/event4u-app/agent-config/commit/ab5e1b1c6391cc40a025b68814b809f48bbb5eb0))
* **skills:** add using-git-worktrees — Phase 6.1 ([8765c37](https://github.com/event4u-app/agent-config/commit/8765c37915f817be665e20343fdaeaa783761bb0))
* **skills:** adopt 'pushy description' triggering pattern ([6dccc92](https://github.com/event4u-app/agent-config/commit/6dccc92238f8eb0392435e2e33985e9b6f3786fa))
* **skills:** pushy descriptions batch 3a (laravel-mail, websocket, project-analysis-hypothesis-driven) ([ee5b7c6](https://github.com/event4u-app/agent-config/commit/ee5b7c62d1a154d7f3f1cabd95a4fd4c276082f5))
* **skills:** pushy descriptions batch 3b (grafana, sql-writing, laravel-pulse) ([adf415c](https://github.com/event4u-app/agent-config/commit/adf415c2f1e28af1e14b285d9ca0e79a59598a9f))
* **skills:** pushy descriptions batch 3c (openapi, github-ci, devcontainer) ([4c75cc6](https://github.com/event4u-app/agent-config/commit/4c75cc6e11c097a270181f0bbcc2fcf6c2d90125))
* **skills:** pushy descriptions batch 3d (terraform, terragrunt, php-debugging) ([9c8ea11](https://github.com/event4u-app/agent-config/commit/9c8ea1123cab7443ab1ee5ce297e61fab34d7a42))
* **skills:** pushy descriptions batch 3e (laravel-pennant, laravel-validation, laravel-horizon) ([32d9b3d](https://github.com/event4u-app/agent-config/commit/32d9b3d8493cdc2cd00e75916b24e5a33d09006a))
* **skills:** refine-ticket orchestration wiring (Phase 2) ([3c324c3](https://github.com/event4u-app/agent-config/commit/3c324c3e288d204ecb0100ad5318805c0bebd9ec))
* **skills:** refine-ticket repo-aware mode (Phase 3) ([046a032](https://github.com/event4u-app/agent-config/commit/046a0328ae9554c70c08803c460f51e61b7d1082))
* **skills:** sharpen pushy descriptions on 6 pilot skills ([7d48a9b](https://github.com/event4u-app/agent-config/commit/7d48a9b6f9f0d07b0c2cfcdda13723504b84d2ed))
* **subagent:** wire /commit into /do-and-judge ([81e5707](https://github.com/event4u-app/agent-config/commit/81e570745472bd372435e2b9b35231fec6c6e4a4))
* **tasks:** add setup-evals and install-anthropic-key tasks ([bddd625](https://github.com/event4u-app/agent-config/commit/bddd6254e21652834af94ecb3e2d92bf229f9568))
* **templates:** PR risk review workflow + confidence gating ([bc602f6](https://github.com/event4u-app/agent-config/commit/bc602f63fc8f8cb925b117190670c5027324ffe1))
* **tools:** activate read-only GitHub + Jira adapters with real API calls ([64c1c57](https://github.com/event4u-app/agent-config/commit/64c1c572a8c90bb3768b3b82fc44c3ed1ade6671))
* **tools:** add tool registry, adapters, and permission validation ([bdafea6](https://github.com/event4u-app/agent-config/commit/bdafea66a2fd71901f4701a140b01802b7b1d609))
* **trigger-evals:** output-schema check + refine-ticket updates ([955d09d](https://github.com/event4u-app/agent-config/commit/955d09deb7752b6870901468847bca5760d58995))
* **upstream:** mandatory consent gate + proactive contribution proposals ([bb3392f](https://github.com/event4u-app/agent-config/commit/bb3392f6682fa4315ec745079cf892680f80fdb8))
* wire first-run into Taskfile and README ([37e91f3](https://github.com/event4u-app/agent-config/commit/37e91f358dc8a66fe5eb14c6f0c23831a64a4dae))


### Bug Fixes

* add iron rule for skill independence ([b060730](https://github.com/event4u-app/agent-config/commit/b060730e98b15b6bc498ad68a111035fab72907f))
* address Copilot PR review feedback ([11b4d20](https://github.com/event4u-app/agent-config/commit/11b4d2060084d1739bfc9e6550fc78c4a4a0bcb7))
* address galawork-api PR [#1466](https://github.com/event4u-app/agent-config/issues/1466) bot feedback ([c5f8e18](https://github.com/event4u-app/agent-config/commit/c5f8e18a6c429e2f8f0224e1d9130233107ce65e))
* **check-refs:** resolve .augment/X as alias for .agent-src/X ([ff3b094](https://github.com/event4u-app/agent-config/commit/ff3b09479a7fa266606467d862f8de9277ef1fc4))
* **check-refs:** skip forward refs in unchecked TODO items ([1458a18](https://github.com/event4u-app/agent-config/commit/1458a181eb5bbe3189777b87bd9ad210b8cc00c5))
* **check-refs:** validate paths inside memory YAML + exempt consumer dirs ([ec4e8aa](https://github.com/event4u-app/agent-config/commit/ec4e8aae2a0f8e7c489442441b8cfa7f9242be2f))
* **ci:** add PR comment permissions, fix lint failure, sync compression hashes ([dee8c47](https://github.com/event4u-app/agent-config/commit/dee8c47d080176d49c94d63d33be7ada025b0a64))
* **ci:** auto-discover ownership-map under .github/ and agents/ ([c9239d2](https://github.com/event4u-app/agent-config/commit/c9239d2795ccb75ca5fb49dc2f81054fd4cb64ab))
* **ci:** collapsible PR comment sections, sticky comment update ([4b9b8c9](https://github.com/event4u-app/agent-config/commit/4b9b8c9ef4e28971073a8dcb436250ac2f81a421))
* **ci:** fix all CI pipeline failures ([bed212f](https://github.com/event4u-app/agent-config/commit/bed212f9d9802dd318e4f297e53e54ecb1fa00c8))
* **ci:** fix trailing newlines in 36 commands, relax strict lint on main ([1972efa](https://github.com/event4u-app/agent-config/commit/1972efa7c22a87959aa8bac3c226210bf34c9cf8))
* **ci:** install pytest before running linter tests ([5e35f3d](https://github.com/event4u-app/agent-config/commit/5e35f3de991be1430bbd5d55692704ba57bf45a2))
* **ci:** install pyyaml + migrate orchestrator tests to YAML settings ([77d0a95](https://github.com/event4u-app/agent-config/commit/77d0a95335dcf2e39636c6edbcab5752baf9833e))
* **ci:** resolve 10 broken cross-references in roadmaps ([a564c43](https://github.com/event4u-app/agent-config/commit/a564c4353bf92b892c6b0f67434b0178e3ba67b0))
* **commands:** add mandatory quality gate to compress command ([e66ef75](https://github.com/event4u-app/agent-config/commit/e66ef75209415099cc79bbddd9fecb4963e6b9a0))
* **compression:** restore code block text in augment-source-of-truth rule ([f1be351](https://github.com/event4u-app/agent-config/commit/f1be35142dde5ae43245ed013a7035a7b16027f6))
* **compression:** restore lost code blocks in 5 compressed files ([06e14fb](https://github.com/event4u-app/agent-config/commit/06e14fb05a33f3dc29de6ee4c84f949c879656d3))
* correct plugin install commands per Nicolai's feedback ([22279cc](https://github.com/event4u-app/agent-config/commit/22279cc371d616b9e993bb57c84e01bd426a2484))
* **docs:** avoid false-positive skill/path refs in design docs ([2cd66a3](https://github.com/event4u-app/agent-config/commit/2cd66a3283e2d8ad13eaead140dda4a752bc86c6))
* enforce /compress command as only way to write .augment/ files ([fad94a6](https://github.com/event4u-app/agent-config/commit/fad94a6475135c5a8f0945d950369f60e596a4f1))
* **evals:** read confirmation input from /dev/tty, not stdin ([eba6dde](https://github.com/event4u-app/agent-config/commit/eba6ddeff68f3c2c67285e7d94f7b4a54ae4b51b))
* **evals:** reclassify eloquent 'UserService' Pest query as A-class ([5ffcdad](https://github.com/event4u-app/agent-config/commit/5ffcdaddd16c2c119fb6321cc5d0857d2d98a7a5))
* handle realpath without --relative-to support (BusyBox/Alpine) ([5a79bf0](https://github.com/event4u-app/agent-config/commit/5a79bf06c629c00174f0752b8e1a851678ad352e))
* improve auto-rule trigger descriptions for better matching ([1900ef3](https://github.com/event4u-app/agent-config/commit/1900ef37da5d32ff051649cffc6b452701c1ad30))
* **linter:** use frontmatter-based execution parsing for assisted-skill validation check ([e2e38da](https://github.com/event4u-app/agent-config/commit/e2e38da8410be190a66d85db7144f66458ddb858))
* linting bug ([180951d](https://github.com/event4u-app/agent-config/commit/180951de62f6372897f83d33a41a65a538d7ac28))
* **lint:** resolve 2 skill-lint regressions ([7c1bba2](https://github.com/event4u-app/agent-config/commit/7c1bba2767184d8de2040bb7f13e1cec4f8115aa))
* npm install ([#1](https://github.com/event4u-app/agent-config/issues/1)) ([3fc1c1f](https://github.com/event4u-app/agent-config/commit/3fc1c1fc9c8abbb883aeda0f95ff5ae74080bc2e))
* **readme:** sync hero counts to actual source + auto-update regex ([39bb363](https://github.com/event4u-app/agent-config/commit/39bb363352f468405a9717cf589f7c56fc50d718))
* **refs:** avoid false-positive cross-reference matches ([3d5fb6d](https://github.com/event4u-app/agent-config/commit/3d5fb6d03fcd37bf991344ca26eda3704b3a9787))
* remove project-specific repo reference from override-system ([5018e85](https://github.com/event4u-app/agent-config/commit/5018e857899d792ff753240b67b5eb5be181b3d5))
* remove unnecessary bash -c wrapper for phpunit in docker-commands ([b1ff4a6](https://github.com/event4u-app/agent-config/commit/b1ff4a6a9b0231dec9f7548c2f20d6b2ed90d334))
* resolve all broken cross-references and reduce false positives ([f5eab18](https://github.com/event4u-app/agent-config/commit/f5eab180dd96f53d6df4240734cd29f163b11044))
* **rules:** add missing guardrails from GPT review ([d03dae9](https://github.com/event4u-app/agent-config/commit/d03dae93eadd66a5f00bd7d478b55ac8bb811bb2))
* **rules:** docs-sync must update local .agent-settings when template changes ([a0c582b](https://github.com/event4u-app/agent-config/commit/a0c582bd2c5444548810bd2573562b720b56b428))
* **rules:** open files are context, not intent ([4d1d8b2](https://github.com/event4u-app/agent-config/commit/4d1d8b202d972c6bacd58639af634ee3642642d1))
* **rules:** resolve procedural_rule linter warning on runtime-safety ([37ff087](https://github.com/event4u-app/agent-config/commit/37ff0870efc9141835f47acc491d0ddc09743973))
* **rules:** trim ask-when-uncertain + artifact-drafting-protocol ([17db7ee](https://github.com/event4u-app/agent-config/commit/17db7ee8f8f5db77eb103e5cff01cbd439bc6c2f))
* **scripts:** exempt consumer routing data from reference checker ([a029e89](https://github.com/event4u-app/agent-config/commit/a029e8948d83f8ab672b39fb13bd027cfafd5982))
* **skills:** add inspect step + clarification guard to writing skills ([e16ee1f](https://github.com/event4u-app/agent-config/commit/e16ee1fd5836aa7ec14d1ebb458392bf7ab96a81))
* **skills:** D-class description fixes from Phase 2 PoC live evals ([f28880c](https://github.com/event4u-app/agent-config/commit/f28880c7245c61cbe2b6a003d2a020b96d44d13b))
* **skills:** eloquent exclusions + php-coder test vector reclassification ([4618c05](https://github.com/event4u-app/agent-config/commit/4618c05e05a1da4919529f973152b71c9cfd3b4f))
* **skills:** resolve 3 lint warnings in review-routing skill ([d1c7c81](https://github.com/event4u-app/agent-config/commit/d1c7c81b2cd168551db7d3c9eecb54b6b199739c))
* **skills:** sharpen analysis/review descriptions (batch 2a) ([f81493e](https://github.com/event4u-app/agent-config/commit/f81493ee1172b4aad8f2b5c7338765d4963fdba1))
* **skills:** sharpen api + aws descriptions (batch 2b) ([b00d19d](https://github.com/event4u-app/agent-config/commit/b00d19d326ee5771aa7ea2fbfb0d6ba1886041d7))
* **skills:** sharpen blade/command/composer descriptions (batch 2c) ([c61dca7](https://github.com/event4u-app/agent-config/commit/c61dca7eda0763353a7ad3ad3de2c87e9d1aaaa5))
* **skills:** shorten 6 pilot descriptions under 200-char lint limit ([7ed3adb](https://github.com/event4u-app/agent-config/commit/7ed3adb9c1fcced9abf99d6b5f69465dc469f2e3))
* sync diverged compressed files and update hashes ([3f51916](https://github.com/event4u-app/agent-config/commit/3f51916dcfdac3264163ff0575ff3742fbf0ce43))
* sync package.json version to 1.3.3 and rename gitignore marker ([193a9e4](https://github.com/event4u-app/agent-config/commit/193a9e479adec742cb7ecda5b44a9564709aedf9))
* sync tool directories and fix broken cross-references ([deeb9d3](https://github.com/event4u-app/agent-config/commit/deeb9d3c8316b29bff3a1bab33f8defb26a79d35))
* **templates:** add missing settings to agent-settings template ([c75f461](https://github.com/event4u-app/agent-config/commit/c75f4619ba79d663a487561cedcbc34bee79a1ad))
* **tests:** add description to valid rule fixture ([efc30a6](https://github.com/event4u-app/agent-config/commit/efc30a60350b72b748fe256af7efc9dbb5fd9952))
* **tests:** tolerate empty recent_branches on CI detached HEAD ([e0a842c](https://github.com/event4u-app/agent-config/commit/e0a842c670336ef95e846aa66e6f0f6cd17115f6))
* **tests:** update test_install.sh to use correct skill name php-coder ([88356ad](https://github.com/event4u-app/agent-config/commit/88356adf930bf5c7985f65202b27e4c1e8033e77))
* **tests:** update test_install.sh to use correct skill name php-coder ([6c3ec8f](https://github.com/event4u-app/agent-config/commit/6c3ec8f84dcfa9ed015139cffcba72b7e1b4d195))
* **tools:** prevent commands from overwriting same-name skill symlinks ([a86faa7](https://github.com/event4u-app/agent-config/commit/a86faa7a923787110972f6afaf8c40df0b22e5ce))
* **tools:** regenerate .windsurfrules after rule changes ([2779f31](https://github.com/event4u-app/agent-config/commit/2779f3113ea1fcf6f0829a4c41b5147fd570a54e))
* use --changed for PR lint, --all only on main ([84d1226](https://github.com/event4u-app/agent-config/commit/84d12263b19bc110a11d0690ffcdd95dce013491))

## [Unreleased]

### Added
- `scripts/install` — a bash orchestrator that is now the **primary
  installer entry point**. It chains the two real stages in order:
  `scripts/install.sh` (payload sync) and `scripts/install.py` (bridge
  files). The orchestrator exposes `--profile`, `--force`, `--dry-run`,
  `--verbose`, `--quiet`, `--skip-sync`, and `--skip-bridges` and forwards
  them correctly to each stage. Bridges are skipped gracefully when
  Python 3 is unavailable; the payload sync still runs.
- `tests/test_install_orchestrator.sh` — integration tests for the new
  orchestrator, the Composer wrapper, and the npm postinstall hook.
  Wired into `task test`, `task test-install`, and GitHub Actions.

### Changed
- `scripts/install.sh` no longer invokes the Python bridge installer
  internally. It now handles payload sync exclusively. Direct callers
  that relied on the side effect must run `scripts/install` or invoke
  `scripts/install.py` themselves.
- `scripts/postinstall.sh` (npm hook) routes through `scripts/install`
  instead of `scripts/install.sh`. Exit-0-with-loud-error contract is
  preserved.
- `docs/installation.md` and `README.md` document the two-stage
  pipeline and use `scripts/install` as the canonical invocation.

### Fixed
- `bin/install.php` now delegates to `scripts/install`. Previous
  versions shelled into `scripts/install.py` only, which meant Composer
  users never got the payload sync — no `.augment/` tree, no tool
  directories, no `.windsurfrules`. This latent bug is fixed with the
  new routing.

### Removed
- **Observability, feedback, and lifecycle scaffolding.** Road-to-9
  Phase 4 resolved the "fake depth" layers. Every module that had no
  production consumer was removed; the dispatcher + shell handler
  (Phase 1) stays as the only real runtime path. Deleted scripts:
  `runtime_pipeline`, `runtime_session`, `runtime_execute`,
  `runtime_errors`, `runtime_metrics`, `runtime_events`,
  `runtime_logger`, `runtime_hooks`, `feedback_collector`,
  `feedback_governance`, `skill_lifecycle`, `report_generator`,
  `persistence`, `event_schema` (≈ 2 000 LoC) plus their tests and
  Taskfile targets (`runtime-execute`, `lifecycle-report`,
  `lifecycle-health`, `report`, `report-stdout`). The `lifecycle`
  frontmatter field on individual skills is kept — it is still a lint
  signal.
- Stale design docs describing the removed layers:
  `docs/observability.md`, `agents/docs/observability-scoping.md`,
  `agents/docs/feedback-consumption.md`,
  `agents/docs/runtime-visibility.md`.

### Added (CI)
- `scripts/runtime_dispatcher.py run` learned `--output FILE`,
  persisting the `ExecutionResult` as JSON. `scripts/ci_summary.py` was
  rewritten to consume those files and render a GitHub Step Summary
  (Markdown table + failure details with stderr tail). `tests.yml`
  wires the two together, so failing pilot skills now show up in the
  PR UI even when the job itself fails.

## [1.4.0] — 2026-04-18

### Added
- **`.agent-src/` replaces `.augment/` as the canonical compressed directory
  shipped in the package.** The new name is tool-agnostic. The installer on
  the consumer side still writes into `.augment/`, unchanged.
- `.augment/` is now a **local projection** of `.agent-src/` for Augment Code
  (gitignored in this repo, rebuilt by `task sync`). Rules are copied (Augment
  Code cannot load symlinked rules); everything else is symlinked to save
  space.
- `scripts/install.sh` and `scripts/install.py` now read from vendor's
  `.agent-src/` with automatic fallback to `.augment/` for pre-2.0 packages.
- `task project-augment` — rebuild the `.augment/` projection from `.agent-src/`.
- MIT License file in the repository root (previously `license: proprietary` in
  `composer.json` with no `LICENSE` file).
- Root-level package docs (`AGENTS.md`, `.github/copilot-instructions.md`) are
  now the package's own meta docs; consumer scaffolding comes from
  `.augment/templates/` via the installer or `/copilot-agents-init`.
- `scripts/install.py` is the canonical installer; `scripts/install.sh` and
  `bin/install.php` remain as thin compatibility wrappers.
- Portability checker (`scripts/check_portability.py`) now covers root-level
  files and supports an optional `AGENT_CONFIG_BLOCKLIST` env var for
  downstream forks that need to enforce legacy-identifier bans.
- `/copilot-agents-init` command to scaffold `AGENTS.md` +
  `.github/copilot-instructions.md` from scratch in consumer projects.
- `/copilot-agents-optimize` now scans for legacy identifiers from prior
  repo names, stack drift, and dead commands before deduplicating.

### Changed
- `composer.json` and `package.json` now declare `license: MIT` (previously
  `proprietary` / `UNLICENSED`).
- Experimental layers (runtime, tool adapters, observability) are now clearly
  labeled in `README.md` and the architecture docs.
- **Distribution slim-down.** Added `.gitattributes export-ignore` entries
  and an explicit `files` whitelist in `package.json`. Composer archives
  drop from 1221 to 433 files (4.45 MB → 1.79 MB); the npm tarball contains
  313 files (483 kB packed). Dev-only directories (`tests/`, `agents/`,
  `.agent-src.uncompressed/`, tool mirrors) no longer ship to consumers.
- **Architecture docs restructured.** Layer 4–6 (observability, feedback,
  lifecycle) moved out of `docs/architecture.md` into a dedicated opt-in
  `docs/observability.md`. The main architecture page now focuses on the
  stable Rules/Skills/Runtime layers.
- **`ide` default neutralized** in `config/agent-settings.template.ini`:
  was `ide=phpstorm`, now empty. Consumers fill it in if they want
  auto-open behavior; empty means the file-editor skill stays inert.

### CI
- Test matrix expanded: Python 3.10 / 3.11 / 3.12 / 3.13 on `ubuntu-latest`
  plus Python 3.12 on `macos-latest`. `install.sh` integration tests run on
  both OS. Matrix enforces the "Python 3.10+, stdlib only" guarantee from
  `CONTRIBUTING.md`. Documented under `docs/development.md#ci-test-matrix`.

### Community
- **Maintainer team documented.** `CONTRIBUTING.md` now lists the
  event4u team (@matze4u lead, @h3xa2, @php-jesus, @phpjob) instead of
  claiming "single author". Bus-factor is now 2 (Owner + Maintain role).
- **GitHub Discussions** referenced from `CONTRIBUTING.md` as the channel
  for scope questions; Issues remain for bugs and feature requests.

### Removed
- Hardcoded `galawork` references removed from installer and portability
  checker. No public release ever shipped the legacy `# galawork/agent-config`
  gitignore marker, so the in-place migration path was also removed.

## [1.3.3] — 2026-04-17

### Changed
- Plugin name renamed from `governed-agent-system` to `agent-config`.

### Fixed
- Plugin install commands corrected in README.

## [1.3.2] — 2026-04-17

### Fixed
- Resolved 10 broken cross-references in roadmap documents.

## [1.3.1] — 2026-04-17

### Added
- PHP installer (`bin/install.php`) and versioned profile presets.
- First-run experience script and `docs/getting-started.md`.
- Marketplace manifests for Augment CLI, Claude Code, and Copilot CLI.
- Quickstart-first README structure.
- Standalone documentation pages under `docs/`:
  `installation.md`, `architecture.md`, `development.md`, `customization.md`,
  `quality.md`.

### Changed
- Tool matrix in README differentiates native vs. reference-based command
  support (`☑️` for the latter).
- Installation default shifted to project-installed; plugin install is
  optional for global use.

## [1.3.0] — 2026-04-17

### Added
- Experimental layers: runtime execution pipeline, tool adapters (GitHub,
  Jira), observability (persistence, event schema, CLI reports), feedback
  collector, and skill lifecycle management.
- `cost_profile` setting (`minimal`, `balanced`, `full`, `custom`) as the
  primary knob for token/output control.
- Governance: `upstream-contribute` skill + command,
  `improve-before-implement` rule, `validate-feature-fit` skill.

### Changed
- README rewritten to describe the governed agent system.

## [1.2.2] — 2026-04-17

### Fixed
- `test_install.sh` updated for the `php-coder` skill name.

## [1.2.1] — 2026-04-17

### Added
- `package-ci-checks` rule + optimized CI task order.

### Fixed
- `test_install.sh` skill name fix (initial attempt).

## [1.2.0] — 2026-04-17

### Added
- Linter: execution quality checks, verification maturity mapping, type
  boundary enforcement, section-based detection, governance/packaging
  consistency checks.
- `upstream-contribute` skill + command.

### Fixed
- CI pipeline failures across multiple checks.
- Commands no longer overwrite same-name skill symlinks.
- Missing settings added to the `.agent-settings` template.

## [1.1.1] — 2026-04-16

### Fixed
- Trailing newlines in 36 command files.
- Linter bug causing false positives.

## [1.1.0] — 2026-04-16

### Added
- `readme-reviewer`, `readme-writing`, and `readme-writing-package` skills.
- README quality linter integrated into CI.
- Skill improvement pipeline (all 5 phases).
- Compression quality checker, cross-reference checker, portability checker.
- `size-and-scope` guideline, `size-enforcement` and `rule-type-governance`
  rules.
- `preservation-guard` rule for merges and compression.
- Phase 3 observability work + feedback category tags.
- `developer-like-execution` skill and `think-before-action` rule.

### Changed
- Major README rewrite: governed AI development layer positioning.
- Portability checker auto-detects project identifiers.

## [1.0.4] — 2026-04-15

### Fixed
- npm install (#1).
- Address PR bot feedback.
- Drop unnecessary `bash -c` wrapper for phpunit in `docker-commands`.

## [1.0.3] — 2026-04-14

### Fixed
- Address Copilot PR review feedback.

## [1.0.2] — 2026-04-14

### Fixed
- Handle `realpath` without `--relative-to` support (BusyBox/Alpine).

## [1.0.1] — 2026-04-14

### Added
- `setup.sh` for automatic post-install/update hook registration.
- `setup.sh` auto-detects JSON tool (`php → node → jq → python3`).

### Changed
- Install as dev dependency (documented).

## [1.0.0] — 2026-04-14

Initial public release.

### Added
- `.augment/` governance content: rules, skills, commands, guidelines,
  templates.
- `scripts/install.sh` with symlink strategy, stale symlink cleanup, and
  per-tool directory layout.
- `/package-test` and `/package-reset` commands.
- Initial README with installation instructions for all supported package
  managers.

[Unreleased]: https://github.com/event4u-app/agent-config/compare/1.3.3...HEAD
[1.3.3]: https://github.com/event4u-app/agent-config/compare/1.3.2...1.3.3
[1.3.2]: https://github.com/event4u-app/agent-config/compare/1.3.1...1.3.2
[1.3.1]: https://github.com/event4u-app/agent-config/compare/1.3.0...1.3.1
[1.3.0]: https://github.com/event4u-app/agent-config/compare/1.2.2...1.3.0
[1.2.2]: https://github.com/event4u-app/agent-config/compare/1.2.1...1.2.2
[1.2.1]: https://github.com/event4u-app/agent-config/compare/1.2.0...1.2.1
[1.2.0]: https://github.com/event4u-app/agent-config/compare/1.1.1...1.2.0
[1.1.1]: https://github.com/event4u-app/agent-config/compare/1.1.0...1.1.1
[1.1.0]: https://github.com/event4u-app/agent-config/compare/1.0.4...1.1.0
[1.0.4]: https://github.com/event4u-app/agent-config/compare/1.0.3...1.0.4
[1.0.3]: https://github.com/event4u-app/agent-config/compare/1.0.2...1.0.3
[1.0.2]: https://github.com/event4u-app/agent-config/compare/1.0.1...1.0.2
[1.0.1]: https://github.com/event4u-app/agent-config/compare/1.0.0...1.0.1
[1.0.0]: https://github.com/event4u-app/agent-config/releases/tag/1.0.0
