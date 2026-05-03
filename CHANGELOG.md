# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.

## [Unreleased]

Three roadmaps land in this release.

**Universal Execution Engine (R1)** — the `/implement-ticket` runtime is
renamed and re-shaped into a universal dispatcher. **No user-visible
behavior change** — the `/implement-ticket` slash command and the
`./agent-config implement-ticket` CLI are byte-stable, gated by the
new Golden-Transcript replay harness.

**Prompt-Driven Execution (R2)** — a new `/work` command drives free-form
prompts through the same `work_engine` dispatcher with a
confidence-band gate at `refine`. R1 goldens remain byte-equal across
the R2 changes.

**Product UI Track (R3)** — three new directive sets (`ui`,
`ui-trivial`, `mixed`) turn UI work from "writes the code" into
"produces UI that feels designed". An existing-UI audit is enforced
as a hard gate before any `apply`; design briefs lock microcopy
verbatim; polish has a 2-round ceiling. Stack-aware dispatch routes
implementation to `blade-livewire-flux` / `react-shadcn` / `vue` /
`plain` skill bundles. Happy-path halt budget is 2 (audit pick +
design sign-off). R1 + R2 goldens stay byte-equal; 12 new GT-U
baselines pin the R3 contract.

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
  `ask-when-uncertain` Iron Law).
* **tests (R2):** four new Golden Transcripts (`GT-P1` high-band happy,
  `GT-P2` medium-band release, `GT-P3` low-band one-question halt,
  `GT-P4` UI-intent rejection — superseded by the R3 UI track but kept
  to pin pre-R3 behaviour) pinned alongside the R1 goldens.

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
* **ADR (R2):** [`docs/contracts/adr-prompt-driven-execution.md`](docs/contracts/adr-prompt-driven-execution.md)
  — naming decision (`/work` over `/do`), confidence-band gate,
  AC-projection fix, R3 deferral boundary, and golden contract.
* **flow:** `docs/contracts/implement-ticket-flow.md` gains a "Replay
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

### Features (R3 — Product UI Track)

* **directive sets:** `directives/ui/` (`audit → design → apply →
  review → polish → report`), `directives/ui_trivial/` (provably
  bounded edits, `MAX_FILES = 1` and `MAX_LINES_CHANGED = 5`), and
  `directives/mixed/` (`contract → ui → stitch`). Dispatched at the
  engine boundary on `state.directive_set`; the audit gate is enforced
  at the dispatcher AND at always-on rule level
  ([`ui-audit-gate`](.agent-src/rules/ui-audit-gate.md))
  so cloud surfaces and free-form edits cannot bypass it.
* **stack detection:** `scripts/work_engine/stack/detect.py` reads
  `composer.json` + `package.json` and labels the frontend as
  `blade-livewire-flux` / `react-shadcn` / `vue` / `plain`. Cached on
  `state.stack` against manifest `mtime`; recoverable on parse error
  (downgrades to `plain`). `apply` / `review` / `polish` route on the
  label.
* **audit gate:** `state.ui_audit` must carry `≥ 1 components_found`
  OR `greenfield = True` with a user-chosen `greenfield_decision` ∈
  `{scaffold, bare, external_reference}`. Empty dict, `None`, or
  populated-without-keys is rejected; the dispatcher emits
  `@agent-directive: existing-ui-audit` and refuses to advance.
* **design brief lock:** `apply` rejects components carrying
  `PLACEHOLDER_PATTERNS` (`<placeholder>`, `lorem`, `todo:`, `tbd`,
  `xxx`); both producer and consumer enforce.
* **polish ceiling:** hard `POLISH_CEILING = 2` rounds, validated at
  in-memory state, on-disk schema, AND dispatcher layers. After round
  2 the engine halts with ship-as-is / abort / hand-off.
* **token-violation extraction:** polish classifies
  `kind == "token_violation"` findings against
  `state.ui_audit.design_tokens`; matched values use the named token,
  unmatched values repeated > `TOKEN_REPEAT_THRESHOLD = 2` times
  trigger token extraction before the next round.
* **trivial-path reclassification:** `directives/ui_trivial/apply.py`
  flips `state.directive_set = "ui"` when the bounded preconditions
  fail, restarting the dispatcher at audit. Reclassification is loud
  and counted in the delivery report.
* **mixed orchestration:** sentinels `state.contract.contract_confirmed`
  (UI sub-flow refuses to start without it) and
  `state.stitch.verdict = "success"` (stitch's success condition;
  `blocked` / `partial` halts unless `integration_confirmed` flips).
* **skills:** new `existing-ui-audit`, `react-shadcn-ui`, plus
  stack-specific apply / review / polish bundles. `fe-design`
  repositioned as a framework-agnostic reference cited by
  `directives/ui/design.py`.
* **tests (R3):** twelve new Golden Transcripts (`GT-U1`..`GT-U4`,
  `GT-U9`..`GT-U12`) covering high-confidence happy path
  (1 halt budget), ambiguous (2 halts max), greenfield decisions,
  trivial-path apply, polish ceiling hit, and mixed orchestration.
  All R1 + R2 + R3 baselines auto-discovered by `tests/golden/test_replay.py`.

### Documentation (R3)

* **ADR (R3):** [`docs/contracts/adr-product-ui-track.md`](docs/contracts/adr-product-ui-track.md)
  — audit-as-hard-gate rationale, design-review loop, halt-budget
  reasoning, trivial-path-and-reclassification, stack-detection
  strategy, fe-design migration, tradeoffs, non-goals.
* **flow contract:** [`docs/contracts/ui-track-flow.md`](docs/contracts/ui-track-flow.md)
  — slot-by-slot wiring for `ui` / `ui-trivial` / `mixed`, the
  audit-path table (`STRONG_SIMILARITY = 0.7`, `TIE_GAP = 0.05`),
  design-brief lock + placeholder patterns, stack-dispatch tables,
  polish ceiling, trivial preconditions, mixed sentinels,
  idempotency table, declared ambiguities across all eight directives.
* **extension recipe:** [`docs/contracts/ui-stack-extension.md`](docs/contracts/ui-stack-extension.md)
  — how to add a new stack (Svelte, SolidJS, Astro, …): label
  conventions, detector heuristic, three required skills, dispatch
  wiring, version anchor, Golden fixture, end-to-end verification.
* **README + AGENTS.md template:** UI track flow table (`ui` /
  `ui-trivial` / `mixed`), audit-gate property, design-brief lock,
  polish ceiling, stack-dispatch summary; the pre-R3 "rejected,
  backend-only" wording is removed.
* **golden test capture:** [`tests/golden/CAPTURING.md`](tests/golden/CAPTURING.md)
  — central regeneration recipe, lock policy, when to relock; replaces
  17 per-baseline `reproduction-notes.md` files (the loadable artefacts
  — `transcript.json`, `state-snapshots/`, `halt-markers.json`,
  `exit-codes.json`, `delivery-report.md` — stay).

### Archived (R3)

* **roadmap:** `agents/roadmaps/intent-based-orchestration.md` moved to
  `agents/roadmaps/archive/`; superseded by R1 + R2 + R3.

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
* **flow:** `docs/contracts/artifact-engagement-flow.md` is the
  cross-cutting reference for what gets recorded, when, and under
  which constraints; includes the maintainer hand-audit recipe.
* **AGENTS.md + README.md:** short *Maintainer telemetry (opt-in)*
  pointer; consumers see nothing.
* **`/onboard`:** Step 9 emits a one-screen maintainer-only hint
  describing the feature; no question, no prompt.

**Context-Aware Command Suggestion** — deterministic, read-only layer
that surfaces eligible slash commands as numbered options when a
non-`/`-prefixed user prompt matches their `suggestion.trigger_*`
frontmatter. **Nothing auto-executes** — the user picks every time;
the as-is option is always present and always last.

### Features

* **engine:** `scripts/command_suggester/` Python package
  (`match` / `rank` / `cooldown` / `sanitize` / `render` / `loader`).
  Heuristic-only scoring (substring + Jaccard token overlap +
  structural-bonus boosts), per-conversation cooldown keyed on
  `(command, evidence)`, and a sanitiser that strips fenced + inline
  code blocks plus the suggester's own previous block shape before
  scoring.
* **rule:** `command-suggestion` (always-on) — emits one
  numbered-options block per turn under the `user-interaction` Iron
  Law. Subordinate to `scope-control`, `ask-when-uncertain`,
  `verify-before-complete`, and any active role-mode contract or
  engine halt; on conflict → silent.
* **frontmatter:** every command carries
  `suggestion.eligible` (default `true`) plus a flat
  `trigger_description` + `trigger_context` pair (linter-validated,
  ≥ 10 chars each). Locked eligibility table at
  [`agents/contexts/command-suggestion-eligibility.md`](agents/contexts/command-suggestion-eligibility.md).
* **settings:** `commands.suggestion` block in
  `.agent-settings.yml` — `enabled` (global), `blocklist`
  (per-command), `confidence_floor` (default `0.6`), `cooldown`
  (default `10m`), `max_options` (default `4`, plus the always-extra
  as-is option). Per-command overrides via frontmatter.
* **opt-out paths (3):** global (`enabled: false`), per-command
  (`blocklist`), per-conversation (`/command-suggestion-off` /
  `/command-suggestion-on` directives detected by `cooldown.py`).
* **anti-noise heuristics:** sub-floor suppression, lonely-match
  guard within `floor + 0.1`, vague-prompt guard (< 6 words +
  > 2 matches without structural bonus), continuation-phrase guard
  (`ok`, `weiter`, `continue`, …). Structural bonuses (ticket key,
  file path) override every suppressor.
* **tests:** 84 unit cases in `tests/test_command_suggester.py`
  (matcher, rank, cooldown, sanitiser, render, settings, directive)
  plus 9 GT-CS goldens in `tests/test_command_suggester_goldens.py`
  (single-match, tie-break, sub-floor, slash-bypass, as-is pick,
  cooldown, settings off, clarification-wins, adversarial echo).
* **no behavioural change to slash invocation:** explicit `/command`
  bypasses the suggester entirely; per-command halts intact.

### Documentation

* **ADR:** [`docs/contracts/adr-command-suggestion.md`](docs/contracts/adr-command-suggestion.md)
  — "suggest, never invoke" anchor, eligibility rubric, anti-noise
  heuristics, hardening list, three opt-out paths.
* **flow:** [`docs/contracts/command-suggestion-flow.md`](docs/contracts/command-suggestion-flow.md)
  — scoring breakdown, evidence semantics, subordination order, and
  hardening tests.
* **README + AGENTS.md:** short *Context-aware command suggestion*
  section pointing to the ADR and the flow doc.

**Install-path pruning (relabel only)** — `docs/installation.md`
reorders install paths by recommendation prominence. Composer + npm
remain the default; manual / submodule / VS Code Git URL are tagged
`advanced`; Claude.ai Web Skills UI is tagged `experimental`; Linear
AI workspace guidance is tagged `staged`. **No installer or shipped
artefact is removed in 1.15.0** — every path on the page still works
and is still tested. The labels describe how prominent the path is in
our recommendation order, not its support status.

### Documentation

* **`docs/installation.md`:** new label table at the top
  (`(no label)` / `advanced` / `experimental` / `staged`) plus a
  preamble that calls out the no-removal contract explicitly. Section
  headers carry their label inline for skim-readers.
* **rationale:** see R9 in
  [`agents/roadmaps/archive/road-to-post-pr29-optimize.md`](agents/roadmaps/archive/road-to-post-pr29-optimize.md)
  — relabelling addresses the "four install paths at zero external
  users" tension without removing any path that an existing user
  might rely on.

## [1.16.0](https://github.com/event4u-app/agent-config/compare/1.15.0...1.16.0) (2026-05-03)

### Features

* add no-cheap-questions always-rule with pre-send self-check ([2916210](https://github.com/event4u-app/agent-config/commit/2916210887f5ba9fc103d80585f0a8a0e2809686))
* **lint:** load_context frontmatter convention + linter (Phase 2) ([f7c9c51](https://github.com/event4u-app/agent-config/commit/f7c9c5186e4264baee2a4cc299990ed9f87ded54))
* **council:** B1–B4 host integration hooks ([f5ec711](https://github.com/event4u-app/agent-config/commit/f5ec71174f21f1f096fb4d8cff94feac2410835f))
* **council:** specialised modes — /council-pr, /council-design, /council-optimize ([00ec7df](https://github.com/event4u-app/agent-config/commit/00ec7df94397addd4a09365b8e48f54441a3a496))
* **council:** session persistence (D2) + daily budget guard (D3) ([b2395e9](https://github.com/event4u-app/agent-config/commit/b2395e9d325fb339fb45ada7f4e4297ee8e0811b))
* **council:** multi-round debate (D1) + smart diff context (D4) ([3a06d8f](https://github.com/event4u-app/agent-config/commit/3a06d8f7b95ddb2db7b4d6d965f6b66abcda78a5))
* **telemetry:** outcome-aware engagement events (P2 #9) ([bb8a7c3](https://github.com/event4u-app/agent-config/commit/bb8a7c39b9ecb36219eeb4d639706026f0e7db7b))
* **rules:** expand rule-interaction matrix to 13 pairs across 9 rules ([0ce5891](https://github.com/event4u-app/agent-config/commit/0ce589148ea1a4b56a7fd782bc3492682850024e))
* **ci:** add check-roadmap-trackable linter ([980e242](https://github.com/event4u-app/agent-config/commit/980e242189129271fb603222589eeb59864d3de6))
* **check-portability:** F1.5 add identity-framing detector (Layer 5) ([9245f3b](https://github.com/event4u-app/agent-config/commit/9245f3b29cb3719df40c321b0e5c3f7ed50f19dc))
* **ai-council:** Phase 2b — Manual mode + non-billable orchestrator path ([4cbe5ef](https://github.com/event4u-app/agent-config/commit/4cbe5ef6ff6959c42ebcb40df96f9e6a853d1d03))
* **ai-council:** Phase 2a — neutral project-context handoff ([25b64dc](https://github.com/event4u-app/agent-config/commit/25b64dc55e0eeba66141d128a8963042735b05dd))
* **ai-council:** pricing layer + per-member estimate gate + sequential overrun callback ([c6e0203](https://github.com/event4u-app/agent-config/commit/c6e0203acc8e50315e83ee56b156b95b00578fdc))
* **installer:** add keys:install-* CLI commands and gitignore .agent-prices.md ([c4c29a6](https://github.com/event4u-app/agent-config/commit/c4c29a64bf9335cfb2ae764b7c49a4a3f1ff5ba6))
* **ai-council:** add /council command + ai-council skill ([68e28e6](https://github.com/event4u-app/agent-config/commit/68e28e6992cd18b8808245b42e348d57f827359c))
* **ai-council:** implement core orchestrator, bundler, clients, prompts ([d16ef04](https://github.com/event4u-app/agent-config/commit/d16ef04d2d734f527127e3ef884d6a975347d0bd))
* **roadmap:** plan AI Council — external second-opinion workflow ([f973c38](https://github.com/event4u-app/agent-config/commit/f973c386fafa603bfc3d5935d8c1379d576e6236))
* **governance:** F7 — universal identity reframe + archive completed roadmap ([8a259f0](https://github.com/event4u-app/agent-config/commit/8a259f0b41cbba8c70961f6e83f1c8dd08e02094))
* **governance:** F6 — description-budget cap + augmentignore advisory ([5ac837d](https://github.com/event4u-app/agent-config/commit/5ac837d28971e4c8d679f5f3a1f25a0a4b6e50f7))
* **governance:** F5 — index generator for internal + public catalogs ([bae4e19](https://github.com/event4u-app/agent-config/commit/bae4e198356a7994644f3c19c8da552d5d61560b))
* **commands:** F2 — collapse fix/optimize/feature clusters into orchestrators ([5db2d1a](https://github.com/event4u-app/agent-config/commit/5db2d1a55533805c77195e35c800a89acdfe0bf3))
* **rules:** F1.2-F1.5 — close always-rule budget breach (37,879/49,000) ([b9eb922](https://github.com/event4u-app/agent-config/commit/b9eb92232b6ec72209e60ee7d43f167489124690))
* **rules:** add agent-authority Priority-Index router (F1.1) ([410653f](https://github.com/event4u-app/agent-config/commit/410653f1887bce755f314a97c542100e9dc4696e))

### Bug Fixes

* **rules:** trim no-cheap-questions to satisfy top-5 always-rule cap ([41e575b](https://github.com/event4u-app/agent-config/commit/41e575b8439f7f654f0c65284626dbe2c06b9e39))
* **schema:** allow load_context in rule frontmatter ([342496e](https://github.com/event4u-app/agent-config/commit/342496e12adb7299bf6a20b5d7949aa657b0e6d4))
* **scripts:** exempt README hero/blurb from update_counts ([6c6822a](https://github.com/event4u-app/agent-config/commit/6c6822aa055698c5d008d6487ab1a65ab5d65fd3))
* **catalog:** point public catalog at shipped surface, add regression gate ([58ec2e9](https://github.com/event4u-app/agent-config/commit/58ec2e98b19aebe28ab2b718f2199adc2b6c6e82))
* **rules:** trim language-and-tone.md to satisfy always-rule budget cap ([d20c99a](https://github.com/event4u-app/agent-config/commit/d20c99a36fba5e6c76f21f0be8f3435d699e8d2c))
* **roadmap-progress:** support digit+letter phase ids (Phase 2a) ([968f7c6](https://github.com/event4u-app/agent-config/commit/968f7c64d39dfea043980cd5bc81af3970202966))
* **rules:** add 'fenced step' clause to scope-control ([be337d8](https://github.com/event4u-app/agent-config/commit/be337d856b503fc4e15d9d4dfcad5b34f05b2597))

### Documentation

* **roadmap:** close + archive road-to-pr-34-followups ([4bb8d36](https://github.com/event4u-app/agent-config/commit/4bb8d3635eb4a8a386f8111ad2dd0a31ca4578fd))
* **contracts:** Phase 7.2 — publish always-rule budget contract ([ff65861](https://github.com/event4u-app/agent-config/commit/ff65861db977688d9c0fb266c256aab710ba1d6e))
* **roadmap:** close Phase 6 of road-to-pr-34-followups; mark 7.3 done ([0380083](https://github.com/event4u-app/agent-config/commit/0380083304a6ff22f0989acb3ff06259c58fe8b5))
* **contracts:** Phase 6.1 — subdirectory conventions for contexts/ ([befdd92](https://github.com/event4u-app/agent-config/commit/befdd92d6cec1b6104316c0270d9dc124f9a2dce))
* **roadmap:** close Phase 5 of road-to-pr-34-followups ([298b61f](https://github.com/event4u-app/agent-config/commit/298b61fac68efea9020d2a3e56327179116a29d1))
* **roadmap:** insert Phase 5 CI drift hygiene; renumber 5/6 → 6/7 ([0e708a5](https://github.com/event4u-app/agent-config/commit/0e708a57b40688fe3aeb29ece85873abc6cbc270))
* **roadmap:** narrow Phase 4.2 to existing engine vocabulary ([1905918](https://github.com/event4u-app/agent-config/commit/1905918cdfd1743680edc4ed1e22e9422424ed3c))
* **roadmap:** reframe Phase 4 — engine halt tests, not LLM eval ([3eb2017](https://github.com/event4u-app/agent-config/commit/3eb2017a062c7c082d651a03ffe8521e804ae940))
* **load-context:** close Phase 3 — first consumer documented + verified ([9b09833](https://github.com/event4u-app/agent-config/commit/9b098335e691ecf9c2808ceeabc318314379b367))
* **reports:** verify autonomous-execution obligation surface (Phase 2.5) ([2e66d8c](https://github.com/event4u-app/agent-config/commit/2e66d8c416c6589203ce61969ebaa3ef347dd299))
* **contexts:** extract autonomy EXAMPLES (Phase 2.3) ([4d56143](https://github.com/event4u-app/agent-config/commit/4d561437617c1cd74b1664bfab2154381f2352ae))
* **contexts:** extract autonomy LOGIC + MECHANICS (Phase 2.2) ([1875f9a](https://github.com/event4u-app/agent-config/commit/1875f9a0ea5ac9fa2ef1f3074d98622d0ad2787e))
* **roadmap:** pin Phase 2 to existing load_context: roots ([e2773f0](https://github.com/event4u-app/agent-config/commit/e2773f0635816d55f696d25be0aeb6107412949e))
* **roadmap:** inventory autonomous-execution.md (Phase 2.1) ([2bead66](https://github.com/event4u-app/agent-config/commit/2bead66ae89c6f3f54e324e4c4ba7354a939032d))
* **readme:** honest command count + governance-aligned hero wording ([1053d56](https://github.com/event4u-app/agent-config/commit/1053d56b3e52fd945a9c09555634abb74bfb2e81))
* **roadmaps:** add road-to-pr-34-followups (round-6 review + round-7 hardening) ([7375759](https://github.com/event4u-app/agent-config/commit/737575907570dc22f83e6e0325ec3a6a85aaf2d7))
* **roadmaps:** mark road-to-rebalancing complete + archive ([4c83f8e](https://github.com/event4u-app/agent-config/commit/4c83f8e752f83616209b79ae4fade551e932ef96))
* **contracts:** add rule-priority-hierarchy.md (Phase 5) ([949c7a9](https://github.com/event4u-app/agent-config/commit/949c7a95689b273302dee3f3d1b9f8694425a213))
* **rules:** point language-and-tone at the relocated examples doc ([45cc06c](https://github.com/event4u-app/agent-config/commit/45cc06c828d4535a013274952c3a3b627552d528))
* **guidelines:** relocate language-and-tone-examples into agent-infra/ (Phase 3) ([579e162](https://github.com/event4u-app/agent-config/commit/579e162e960e4dd024888efcbab9ac98c5eb3601))
* **roadmaps:** archive road-to-ai-council, mark council-modes Phase 2a/2b done ([9caba6d](https://github.com/event4u-app/agent-config/commit/9caba6d26a574591bafdc0e7c0a7f5434adbd717))
* add end-to-end walkthroughs + complete road-to-1-15-followups (P1 #7) ([fa29fc4](https://github.com/event4u-app/agent-config/commit/fa29fc4279c020579e9cfdb6b79ded37268bc012))
* **roadmaps:** mark P2 #9 shipped + regen dashboard ([821bcb1](https://github.com/event4u-app/agent-config/commit/821bcb16bd29cf2e06b260e341d6931d2a99677f))
* **roadmap:** mark P0 #2/#3 + P1 #5/#6 verified shipped ([caccf12](https://github.com/event4u-app/agent-config/commit/caccf129e27ac81994bf549741704989b22e53fc))
* **roadmaps:** canonicalize headings + tag drafts to satisfy linter ([a5e64b8](https://github.com/event4u-app/agent-config/commit/a5e64b8c8c051f79d3a3a1384f91136999a99150))
* **rules:** harden roadmap-progress-sync with trackability Iron Law ([ef426cd](https://github.com/event4u-app/agent-config/commit/ef426cdfc7463f4ac44e0e323c7904b82f71a745))
* **readme:** P0 #4 fix Token overhead wording in cost-profiles table ([1bcdb26](https://github.com/event4u-app/agent-config/commit/1bcdb26644875c5aee297957b0845bbab7240bc3))
* **agents,copilot:** F1.4 generalize Laravel framing in AGENTS + copilot ([c282ae3](https://github.com/event4u-app/agent-config/commit/c282ae3a2ae93658de69dc92082399df552cb317))
* **readme:** F1.3 reframe § Who this is for — Laravel as value, not headline ([2fa8022](https://github.com/event4u-app/agent-config/commit/2fa802269b2b936d621344dda0a995bd81bf9737))
* **readme:** F1.2 neutralize opener stack-naming (Laravel ≠ headline) ([d26bf68](https://github.com/event4u-app/agent-config/commit/d26bf68a94ab0471a7270dea95b5cb35190ca581))
* **roadmap:** F1.1 audit — Laravel-coloured identity language inventory ([2a42fad](https://github.com/event4u-app/agent-config/commit/2a42fad8b3f659d0c9c704942a3581cb7401057a))
* **roadmap:** rewrite rebalancing roadmap around layered architecture ([5786d9c](https://github.com/event4u-app/agent-config/commit/5786d9c3f7ba8a668f4cf72478d72dfa463aef29))
* **roadmap:** capture rebalancing roadmap from PR #34 review feedback ([55977d4](https://github.com/event4u-app/agent-config/commit/55977d4f60f4d665d26ea0f362fa2c581e7ebde5))
* **ai-council:** Phase 2a/2b skill + command + roadmap updates ([c6b284f](https://github.com/event4u-app/agent-config/commit/c6b284fe8fd361636b2c52c75e03d679981bd231))
* **roadmap:** capture 1.15.0 review followups -- identity rewrite as P0 #1 ([2abd676](https://github.com/event4u-app/agent-config/commit/2abd676aba025f5bc8efcd2ac2b5e27124f25a13))
* **roadmap:** plan AI Council Phase 2 -- context-handoff, manual + playwright modes ([b578d6d](https://github.com/event4u-app/agent-config/commit/b578d6da916f98eed2baa57a00089b8815033f9f))
* **ai-council:** document settings, install flow, and skill xref ([3b8a528](https://github.com/event4u-app/agent-config/commit/3b8a52875842fe4c939b2ae1049d347c0b7d443d))
* **roadmap:** F3.1 close-out — 5 of 6 renames done, row 4 N/A ([713ff59](https://github.com/event4u-app/agent-config/commit/713ff5900fa1ba6e494286f8fa7403c6e26e3966))

### Refactoring

* **rules:** Phase 7.4 — slim non-destructive-by-default under 6k cap ([62d39ea](https://github.com/event4u-app/agent-config/commit/62d39ea296c0afe5822514d7c0c707ee91be7ce1))
* **rules:** Phase 6.2 — migrate 3 rules to load_context ([0b93832](https://github.com/event4u-app/agent-config/commit/0b9383244ff90a0e0fbaa2b387c55f3d65672096))
* **rules:** slim autonomous-execution + wire load_context: (Phase 2.4) ([94edd24](https://github.com/event4u-app/agent-config/commit/94edd24dd52e9d7ada2ecea4c90f23607686eda2))
* **commands:** F2 — convert 15 atomic commands to deprecation shims ([84283cb](https://github.com/event4u-app/agent-config/commit/84283cbb98192f6f25e567c902aec246eb55e49a))
* **governance:** F4 — update scripts, docs, and counts for relocated guidelines ([8234649](https://github.com/event4u-app/agent-config/commit/82346494df9efbca1392e55a858a993bec8b05c5))
* **governance:** F4 — relocate guidelines to docs/guidelines/ ([6a82c0c](https://github.com/event4u-app/agent-config/commit/6a82c0c8e51fffb9ad0278a8f69fa03dcc2ab808))
* **skills:** F3 — rename verify-before-complete (skill) → verify-completion-evidence ([1bada56](https://github.com/event4u-app/agent-config/commit/1bada563724a6a74c6e26dac988bde5c73d4246d))
* **rules:** F3 — rename command-suggestion → command-suggestion-policy ([2338aef](https://github.com/event4u-app/agent-config/commit/2338aeff2f81fc28beae1ae79e1e5584237bf7d2))
* **rules:** F3 — rename slash-commands → slash-command-routing-policy ([347caf8](https://github.com/event4u-app/agent-config/commit/347caf87cd2dbaeb90761f42865276789a0d89b7))
* **rules:** F3.2 — rename ui-audit-before-build → ui-audit-gate ([dcab51a](https://github.com/event4u-app/agent-config/commit/dcab51ae1535d10b56ff0afaa3164cd595a1b0d3))

### Tests

* **golden:** lock governance anti-pattern baselines ([360f259](https://github.com/event4u-app/agent-config/commit/360f259b72e6d3ab69b4afc344aacf17beabf980))
* **golden:** add governance anti-pattern recipes ([960c0ec](https://github.com/event4u-app/agent-config/commit/960c0ecf1c106c09a81930a53da10a88e4420f4e))
* **ai-council:** contract tests for install_{openai,anthropic}_key.sh ([0e193bc](https://github.com/event4u-app/agent-config/commit/0e193bc588394dc41ae4f51cd65021c3c7c13521))
* **naming:** F3.2 — guard policy-verb vs tool-noun naming split ([efbe2db](https://github.com/event4u-app/agent-config/commit/efbe2dbf04a25fc873e78f5522996ed57bfcc176))

### CI

* **budget:** Phase 7.4 — enforce per-rule 6k cap and top-3 ≤ 50% in CI + tests ([9e8b079](https://github.com/event4u-app/agent-config/commit/9e8b079fc8f11b274ff542d91469dd50381e5ae4))
* **budget:** Phase 7.1 — always-rule budget gate (warn 80% / fail 90%) ([b3af9ad](https://github.com/event4u-app/agent-config/commit/b3af9ad04334d678bf0d49a60c13808ba17a4450))
* **tests:** allow manual workflow_dispatch trigger on tests.yml ([e230e2b](https://github.com/event4u-app/agent-config/commit/e230e2bcb9e973a4450170cd4f09aba96116cb05))

### Chores

* finish council modes ([c1496e4](https://github.com/event4u-app/agent-config/commit/c1496e4a240be4210c7624b41cb389065bdf3aee))
* update gitignore ([184c27f](https://github.com/event4u-app/agent-config/commit/184c27f6a8d9e7549432b9190f6c929ec1be63af))
* **index:** regenerate index/catalog for no-cheap-questions ([7c45498](https://github.com/event4u-app/agent-config/commit/7c454983735680ebe1b9efb72ad0e4533997e9b6))
* **tools:** regenerate .windsurfrules and rule symlinks ([8621e23](https://github.com/event4u-app/agent-config/commit/8621e23578c5200ce58888d1be3dc14a5705eb0e))
* **check-refs:** skip agents/council-sessions/ ([53ff5a6](https://github.com/event4u-app/agent-config/commit/53ff5a6ba28508bcee257d90302073d17c822e49))
* **index:** regen agents/index.md + docs/catalog.md for council-* commands ([c9d01e5](https://github.com/event4u-app/agent-config/commit/c9d01e5cb819042a4eecf47aec02ac9a8c96325b))
* **rules:** mark roadmap-progress-sync cloud_safe degrade and trim under 200-line cap ([c740054](https://github.com/event4u-app/agent-config/commit/c74005487a3898ae416b704ad2fbeea4c4c8daf4))
* **roadmap:** archive open-questions-3.md (all 13 closed) ([18ba9ba](https://github.com/event4u-app/agent-config/commit/18ba9ba789a9974e51258c2242c1bbb2dfbc5a52))
* **roadmap:** regenerate progress dashboard after Q43 closure ([f027c55](https://github.com/event4u-app/agent-config/commit/f027c550c6a7fe66eb189440ce22a46990977c45))
* **tools:** regenerate .windsurfrules after language-and-tone trim ([d9a6cf4](https://github.com/event4u-app/agent-config/commit/d9a6cf4921ca29787b4aaa46341eacd86493a8e8))
* **ai-council:** recompress council.md (Q43) + refresh stale hash ([005ba1b](https://github.com/event4u-app/agent-config/commit/005ba1bcebcdf945df4023d720fe924471448d3d))
* **ai-council:** post-install enable hint + close Phase-1 decisions ([595d475](https://github.com/event4u-app/agent-config/commit/595d475911f1621c84d846a2e10452611b7558f1))
* **readme:** trim 'Who this is for' below 500-line linter budget ([e06237d](https://github.com/event4u-app/agent-config/commit/e06237dec5ae61f26cf9456c7584e500f4a36f0f))
* **roadmap:** regenerate roadmaps-progress dashboard after F6 ([024916b](https://github.com/event4u-app/agent-config/commit/024916b2fe47deb4d77bc561ca9c8f82833c2da6))

## [1.15.0](https://github.com/event4u-app/agent-config/compare/1.14.0...1.15.0) (2026-05-02)

### Features

* **governance:** rule-interaction matrix + linter (P2.2) ([cd68591](https://github.com/event4u-app/agent-config/commit/cd6859174d289737b829fe49a4c7f92bd318a290))
* **rules:** split chat-history into ownership/cadence/visibility (P2.1) ([7b5348d](https://github.com/event4u-app/agent-config/commit/7b5348d2656c12000fca667c2e577c026839aa11))
* **governance:** command-collapse contract + atomic-command linter (P0.8) ([5f1ebb7](https://github.com/event4u-app/agent-config/commit/5f1ebb72484da28679f7a49fffc5cbb4bd7a07f6))
* **work_engine:** default state file → .work-state.json + collision-safe backup ([b0f487a](https://github.com/event4u-app/agent-config/commit/b0f487a3f261797320b3726211206f813f2c2c1a))
* **docs:** public contracts to docs/contracts/ + STABILITY policy + link checker ([7c6ac17](https://github.com/event4u-app/agent-config/commit/7c6ac17609d19505625cb4fa9a76798a403997ad))
* support capture-only roadmaps in dashboard generator ([c0df2dc](https://github.com/event4u-app/agent-config/commit/c0df2dc3c680a6cfa6c87f2e64868360695fa3ec))

### Bug Fixes

* **rules:** restore Iron Law heading + code blocks in compressed roadmap-progress-sync ([96c633b](https://github.com/event4u-app/agent-config/commit/96c633b583fc17ea560fe1ddf7b915ab5a3be3f3))
* **ci:** clear check-refs regressions in roadmap files ([56b40f3](https://github.com/event4u-app/agent-config/commit/56b40f397e632337f5f69a507b13aa2b475453c3))

### Performance

* **ci:** smoke GT subset + duration line + nightly full replay (P2.4) ([7b0608d](https://github.com/event4u-app/agent-config/commit/7b0608d3f51bac534f835424860049483ae6004a))

### Documentation

* **ui-track:** 1-page mental model + archive Phase 2 roadmap — P2.10/P2.11 ([d87673d](https://github.com/event4u-app/agent-config/commit/d87673d75ec8cd0136336a1954b356a953b79e4e))
* **install:** relabel install paths (advanced/experimental/staged) — P2.5 ([66e5389](https://github.com/event4u-app/agent-config/commit/66e53894f3dd12ff0762a56f677e302d1ca726c1))
* add visible (beta) markers to public-surface contract links ([282b74f](https://github.com/event4u-app/agent-config/commit/282b74fccab2c0ba585271013c5fe61b396aaa09))
* positioning headline + work_engine vs runtime_dispatcher separation ([ccf833f](https://github.com/event4u-app/agent-config/commit/ccf833f07b34ff2c6c5cf64e8328fb67b7629c4d))
* **roadmaps:** reviewer feedback + directional → out-of-horizon ([6af0320](https://github.com/event4u-app/agent-config/commit/6af03205537d761a0cbe6c205662c34854deea6a))
* **rules:** position-agnostic recommendation in user-interaction ([ee57ae0](https://github.com/event4u-app/agent-config/commit/ee57ae0d233b3332f30dfd3d3f67b3954ce153ef))
* **roadmaps:** retire stale open-questions and placeholder sections ([c1ec177](https://github.com/event4u-app/agent-config/commit/c1ec17782521bb5688260d1873423fbf4d4adc99))
* **roadmaps:** synthesize decisions from multi-AI review ([4d9dcc1](https://github.com/event4u-app/agent-config/commit/4d9dcc19929fe7d3fa2657509a4b8a2e9a1ee7e2))
* add capture-only synthesis roadmaps ([d2bdb76](https://github.com/event4u-app/agent-config/commit/d2bdb76ec562d8a00313f49b388083fdad8f1b42))

### Refactoring

* **work_engine:** modularise cli.py into 7 focused modules (P2.3) ([ad92366](https://github.com/event4u-app/agent-config/commit/ad9236681c1537beec3d407bead9b7386c57c73d))
* **roadmaps:** binary status model — ready (implicit) / draft (hidden) ([2d3d713](https://github.com/event4u-app/agent-config/commit/2d3d713a52ac039c08317817331ba6aaa81fcb12))

### Tests

* **work_engine:** cover default state file + UI-prompt routing + medium-band halt (P0.7) ([e97c499](https://github.com/event4u-app/agent-config/commit/e97c499fa7daaf0478423efbdb34d648b6e400c8))

### Chores

* **generated:** sync compressed projections for chat-history split (P2.1) ([f53a44f](https://github.com/event4u-app/agent-config/commit/f53a44f31fd7d93c28122b945f8059bd112dc854))
* **generated:** regenerate .windsurfrules after rule edits ([0090392](https://github.com/event4u-app/agent-config/commit/00903924eaf1955ad2049dc03c3c57d9f4ff016e))
* **roadmaps:** mark Phase 1 progress in road-to-post-pr29-optimize + dashboard ([a2160af](https://github.com/event4u-app/agent-config/commit/a2160afd6e7280bd3d4a71641fb4dba8234edf21))
* **scripts:** whitelist scripts/mcp_server/ in portability check ([259745e](https://github.com/event4u-app/agent-config/commit/259745e9f52ea0a60e3e92a553a5938b15adc0ca))

### Other

* **readme:** drop redundant 'no runtime deps' bullet — clear 500-line limit ([53b5df4](https://github.com/event4u-app/agent-config/commit/53b5df481122ccbd70ce358a3192643c7fff73b0))
* **readme:** trim Stability tiers + command-suggestion blocks to clear 500-line limit ([5bb50ba](https://github.com/event4u-app/agent-config/commit/5bb50ba43d8734f5deb02c0b34c9c6e26475c52b))
* **rules:** trim roadmap-progress-sync to 199 lines (clear CI hard limit) ([12c3a2e](https://github.com/event4u-app/agent-config/commit/12c3a2e1357dfca7ec0bd2f6b507e606ec2de596))

## [1.14.0](https://github.com/event4u-app/agent-config/compare/1.13.0...1.14.0) (2026-05-01)

### Features

* scaffold a11y findings + preview envelope in UI stack skills ([6e72357](https://github.com/event4u-app/agent-config/commit/6e7235708e74dfa629378dc0c09dd3a366c41fb5))
* **ui-track:** R4 phase 3 — preview envelope render contract ([13906c0](https://github.com/event4u-app/agent-config/commit/13906c0d622de5f1e556be8273a4acdd240acb0a))
* **r4:** polish termination contract — a11y precedence + one-shot extension ([98cf2d7](https://github.com/event4u-app/agent-config/commit/98cf2d7f43550d391ef3ee03233d2eaa18b8be30))
* **review:** R4 Phase 1 — a11y gate on ui.review ([ba93534](https://github.com/event4u-app/agent-config/commit/ba93534d3e09f44cac6f06805600a2084465e0b4))
* **state:** R4 Phase 0 — a11y / preview envelopes on ui_review, ui_audit, ui_polish ([29fe67c](https://github.com/event4u-app/agent-config/commit/29fe67ccef98320e21899816eb2f7ee0910e9e89))
* **golden:** pin GT-U3..U4, U9..U12 UI track baselines ([52a33c2](https://github.com/event4u-app/agent-config/commit/52a33c23bb0e01752204ab68aa8309d05b68cbd5))
* **ci:** add Iron Law prominence linter ([2e1cae5](https://github.com/event4u-app/agent-config/commit/2e1cae534cf7e1dc164258fb09dea0859c47fa8d))
* **chat-history:** native augment hooks via user-level settings ([de9a1b0](https://github.com/event4u-app/agent-config/commit/de9a1b08d279c6ed251a2b762e1fc069c7a9e840))
* **chat-history:** platform bridges + git-hook fallback ([a1e6574](https://github.com/event4u-app/agent-config/commit/a1e65748148c676b37586bedcbc7c9c4ec520640))
* **golden:** add GT-U2 ui-improve diff scenario ([ff0b5f8](https://github.com/event4u-app/agent-config/commit/ff0b5f8189c4fb8e257799d5569e69bd09289f79))
* **work-engine:** add hooks lifecycle + thread diff/file inputs ([53fb358](https://github.com/event4u-app/agent-config/commit/53fb35806b9dea3b7b39431cd7bdb5ac270d7ae1))
* **work-engine:** add hooks primitives package ([33a4ea8](https://github.com/event4u-app/agent-config/commit/33a4ea8e3aa16a2e4c1e0b191773964fa94708c3))
* **skills:** reposition UI skills as directive-dispatched executors and reference (R3 Phase 5) ([2b7870d](https://github.com/event4u-app/agent-config/commit/2b7870df80adfc6fe86d1c7cd1c0ef9b36b79c35))
* **work_engine:** implement mixed directive set (Phase 4) ([f81ac1d](https://github.com/event4u-app/agent-config/commit/f81ac1d0633eee65f2046e2ffe843262a9fa8039))
* **work-engine:** add state.contract and state.stitch envelopes ([40c8060](https://github.com/event4u-app/agent-config/commit/40c8060135193a360b0c35be9c38ad7c211c69fc))
* **work_engine:** add shadcn version-mismatch halt + per-stack audit fixtures ([1d73217](https://github.com/event4u-app/agent-config/commit/1d732179153eb8bc32d8f2b84f399e9553580300))
* add react-shadcn-ui skill ([91e8de2](https://github.com/event4u-app/agent-config/commit/91e8de249f5ed8f4fd2df1e97b09b294e1b2b648))
* add ui/review + ui/polish directives with token-violation refactor ([9d25234](https://github.com/event4u-app/agent-config/commit/9d25234f907061ad6d841bdf9ca9fd5ea8ae5476))
* add ui/design + ui/apply directives ([1c5bb28](https://github.com/event4u-app/agent-config/commit/1c5bb28ea0d9e3f60dfcd659563b92cd86f52427))
* extend work-engine state schema for UI directives ([aa961ad](https://github.com/event4u-app/agent-config/commit/aa961ad10838e69edb6f36e1dedac37f3d94d292))
* **roadmap-sync:** mandate per-step checkbox flips during autonomous runs ([f1019b0](https://github.com/event4u-app/agent-config/commit/f1019b042789104c439cfe925fd8238a55f94541))
* **chat-history:** conditional Iron Law for HOOK vs CHECKPOINT path ([ccf42c7](https://github.com/event4u-app/agent-config/commit/ccf42c77b6882e390c877ab2227258ea73eb6b22))
* **chat-history:** add /chat-history-checkpoint command for CHECKPOINT path ([71c38bf](https://github.com/event4u-app/agent-config/commit/71c38bf9387100a2b25dd4a60c657ff56526ff94))
* **chat-history:** wire HOOK strategy for Claude Code and Augment CLI ([d280777](https://github.com/event4u-app/agent-config/commit/d2807770c5d8937e7cc4ba8a65c91de4503ccff0))
* **chat-history:** add hook-append wrapper for platform hooks ([f936e57](https://github.com/event4u-app/agent-config/commit/f936e573bcc613ea7d7fc6bcd90113c5514821a2))
* **roadmap-sync:** harden rule with Iron Law, pre-send self-check, failure modes ([208728f](https://github.com/event4u-app/agent-config/commit/208728f3e92a6343adca74f8ab8853e9558091b6))
* **compress:** allow caveman style, enforce structural Iron Law preservation ([7bcbcae](https://github.com/event4u-app/agent-config/commit/7bcbcae1cd4e9341abbf90e67e20baee0f2902c4))
* **skills:** add md-language-check skill and /check-current-md command ([0aaed82](https://github.com/event4u-app/agent-config/commit/0aaed829908bcb1e891d691db248a06667e9ee53))
* **work-engine:** implement ui-trivial directive set ([59bb66d](https://github.com/event4u-app/agent-config/commit/59bb66de360c38b186e1462664795ccbddd7ce1e))
* **rules:** extract Hard Floor into non-destructive-by-default ([dfc80a6](https://github.com/event4u-app/agent-config/commit/dfc80a6ec848d0a5fe7a8997d1e29dab3cf73fb0))
* **work-engine:** wire ui-trivial directive set with reclassification (R3 P2 S6) ([10d5cb0](https://github.com/event4u-app/agent-config/commit/10d5cb0e76679e3549b502d26f83ca8667a314e9))
* **directives/ui:** high-confidence vs ambiguous audit branching (R3 Phase 2 Step 4) ([8a5645b](https://github.com/event4u-app/agent-config/commit/8a5645be20b6c9d86f87b7facf84afad7f5901bb))
* **skills/existing-ui-audit:** hard audit gate for R3 Phase 2 ([7189ef5](https://github.com/event4u-app/agent-config/commit/7189ef558feeabe9556fb68b46550ef1920d2f9a))
* **directives/ui:** routing-target stub for R3 Phase 1 ([4e83a21](https://github.com/event4u-app/agent-config/commit/4e83a2112ecb8019b927e1a858f31cda43e2929d))
* **work-engine:** stack detection + intent routing (R3 Phase 1) ([11cc83d](https://github.com/event4u-app/agent-config/commit/11cc83d77a70e387fa0ac0cf2ef8fee9af15e19c))
* **command-suggester:** engine + rule + settings (Phases 3-6) ([e035618](https://github.com/event4u-app/agent-config/commit/e035618ead1ee96561898048e9ee86378054209b))
* **commands:** inject suggestion frontmatter into all 75 commands ([470c2f6](https://github.com/event4u-app/agent-config/commit/470c2f61a422518deb999105c1078abfcbf4ee2d))
* **linter:** validate command suggestion frontmatter block ([e137b70](https://github.com/event4u-app/agent-config/commit/e137b703a40f2a9527fea2e6e68313d073696f11))
* **commands:** add command-suggestion eligibility audit ([55ccbd6](https://github.com/event4u-app/agent-config/commit/55ccbd6add58de25a7dcc2b7e1518adb0d52e788))
* **telemetry:** redaction validator and export gate (Phase 5) ([1e2f9f0](https://github.com/event4u-app/agent-config/commit/1e2f9f0e3879ebc5d08449d7146df0d185c6dea1))
* **telemetry:** wire telemetry:report CLI ([e68bd05](https://github.com/event4u-app/agent-config/commit/e68bd0574f81584fad5b845355e9a7048b082365))
* **telemetry:** aggregator + report renderer for engagement log ([598f9e1](https://github.com/event4u-app/agent-config/commit/598f9e1d3786be0b4b3ebfbc4edaff60a65d06fc))
* **telemetry:** add artifact-engagement-recording rule + wire commands ([81ad51f](https://github.com/event4u-app/agent-config/commit/81ad51f88e590ef61339c8b7f463496d92316f60))
* **telemetry:** recording engine + telemetry:record / telemetry:status CLI ([7327d53](https://github.com/event4u-app/agent-config/commit/7327d5373040a25ab38298660e435b7d86559ea9))
* **telemetry:** add engagement event schema (Phase 1 step 1+4) ([e8ae569](https://github.com/event4u-app/agent-config/commit/e8ae5692fb2d24fe50f3cabe91af2917b00699b9))
* **road-to-universal-distribution:** tick 4 mechanically-verifiable acceptance items ([3725039](https://github.com/event4u-app/agent-config/commit/372503936ae4c3621bad0505a868a749837e41c3))
* **road-to-universal-distribution:** close Phase 6 Steps 1+5, defer 2+3+4 ([12cd983](https://github.com/event4u-app/agent-config/commit/12cd9839ec6011eebaa18bb476afd133538ccd84))
* **ci:** cloud-release workflow — attach cloud bundles + Linear digest to GitHub Releases ([6299ca7](https://github.com/event4u-app/agent-config/commit/6299ca736f3b5967d98c56c53fe80693a3f15a57))
* **rules:** harden language-and-tone — chat messages are the only language signal ([51144da](https://github.com/event4u-app/agent-config/commit/51144da3c39eb704038ac7e390b8e7e97fc2ecde))
* **cloud:** Phase 4 Step 2 — narrow rewrite for cloud-portable prose ([45a2ed1](https://github.com/event4u-app/agent-config/commit/45a2ed16952075e8af10874392bb041b384583b8))
* **audit:** Phase 4 Step 1 — cloud-action classifier extension ([485acca](https://github.com/event4u-app/agent-config/commit/485acca8cfdbbd4c1839c2c3d9e21cf52925ee37))
* **linear:** Phase 3 — Linear AI rules digest builder + three-layer split ([3dcbf0a](https://github.com/event4u-app/agent-config/commit/3dcbf0af3c2dca70ef70f18af70a3568516f0147))
* **rules:** add commit-policy as canonical no-commit-no-ask rule ([fd208ea](https://github.com/event4u-app/agent-config/commit/fd208ea1c0f95aaa58d930c99ff0e51dd27600ed))
* **rules:** add autonomous-execution rule with intent-based opt-in ([fbff529](https://github.com/event4u-app/agent-config/commit/fbff5299b32606b7f13f06c856a4d4556c908fcb))
* **commands:** add /commit-in-chunks for autonomous commit splitting ([b53fa7b](https://github.com/event4u-app/agent-config/commit/b53fa7b277a107af8acc6076baf8c985f0fbb901))
* **cloud:** mark T3-H artifacts cloud-safe (4 noop + 4 degrade) ([0eb7eb3](https://github.com/event4u-app/agent-config/commit/0eb7eb3cdbf590e3ef87f372c3fd09d85aa5cfd5))
* **cloud:** cloud-safe marker detection + variant rendering ([67bf28b](https://github.com/event4u-app/agent-config/commit/67bf28b8f85384333f5d26807ad92e6d0b456288))
* **cloud:** cloud-bundle builder with T3-H gating + tests ([f749edc](https://github.com/event4u-app/agent-config/commit/f749edc8c0f16cded153eb24580c4b262a6065ae))
* **chat-history:** add heartbeat visibility modes (on/off/hybrid) ([70e9925](https://github.com/event4u-app/agent-config/commit/70e99259e1c1888dfabc19c6b0c261301b2d386e))
* **rules:** add direct-answers iron laws ([f66b89c](https://github.com/event4u-app/agent-config/commit/f66b89cd3143121b5b16f58b6a3705844f99ce0f))
* **chat-history:** add heartbeat marker for in-band reply observability ([2236bc2](https://github.com/event4u-app/agent-config/commit/2236bc218b3b64106c82726a1604e17234b2d2d3))
* **chat-history:** enforce ownership with turn-check gate and append refusal ([2be705c](https://github.com/event4u-app/agent-config/commit/2be705cb92c18e786f6d130d04e1edcb1785767e))
* **commands:** add /work entrypoint and refine-prompt skill (R2-P1, R2-P3) ([a09d748](https://github.com/event4u-app/agent-config/commit/a09d7487d48fe3bd0bfb1d3ae2c188db97103bac))
* **work_engine:** prompt envelope, confidence scoring, refine dispatch (R2-P2..P4) ([53e6aae](https://github.com/event4u-app/agent-config/commit/53e6aaee756a7de94167b04b46e394d55c15e8f8))
* **engine:** R1 Phase 7 — close out Universal Execution Engine roadmap ([d461da0](https://github.com/event4u-app/agent-config/commit/d461da06c681ab9bf3ca005627b33a854b1ab017))
* **rules:** forbid release language in roadmaps + decline-silence policy ([ddae361](https://github.com/event4u-app/agent-config/commit/ddae361669610917f340f9e1f257d07ead2fab99))
* **ci:** add named Golden Replay check (R1-P6-S3) ([60e873c](https://github.com/event4u-app/agent-config/commit/60e873c8865f4cedcd0dc6abccb8b819aca5500d))
* **test:** add Golden Transcript replay harness (R1-P6-S1) ([5f219e9](https://github.com/event4u-app/agent-config/commit/5f219e9209451171ebfc8a08639c71864384de92))
* **cli:** add migrate-state subcommand to agent-config dispatcher (R1 P5 S1) ([2ab5fc8](https://github.com/event4u-app/agent-config/commit/2ab5fc89a6fae5bc835efc73e5bfcc96a2ba975a))
* **engine:** add per-set kind gate to dispatcher (R1 P4 S5) ([b80a8d0](https://github.com/event4u-app/agent-config/commit/b80a8d0706fa389578372036fc0b8a847ead9b2c))
* **engine:** add select_directive_set + load_directive_set (R1 P4 S2) ([ffd0ac8](https://github.com/event4u-app/agent-config/commit/ffd0ac82a41661d1a618e1feb36a0be279be19e6))
* **engine:** add ui/ui-trivial/mixed directive-set stubs (R1 P4 S4) ([73ae862](https://github.com/event4u-app/agent-config/commit/73ae8622710ef02512ca1e734946d811d2425766))
* **roadmaps:** plan artifact engagement telemetry (R6) ([5d2953b](https://github.com/event4u-app/agent-config/commit/5d2953ba7174567310e1f2e84e88b56b1ab7724f))
* **cli:** expand agent-config dispatcher with memory/proposal/refine-ticket subcommands ([0d826ac](https://github.com/event4u-app/agent-config/commit/0d826ac466109f9f53c1640b49c5e2243827be0f))
* **roadmaps:** plan universal execution engine + 4 supporting tracks ([7c777dc](https://github.com/event4u-app/agent-config/commit/7c777dc62e637da31763b99940297e0e2b18e4a7))

### Bug Fixes

* **engine:** round-trip contract/stitch/stack between WorkState and DeliveryState ([c8086ca](https://github.com/event4u-app/agent-config/commit/c8086ca2d9c73f5f6d87a85f58224303f2d3b628))
* **docs:** clarify stitch + mixed.ui dispatch as @agent-directive emits ([893e5eb](https://github.com/event4u-app/agent-config/commit/893e5ebdddb39b971b9d973dd1b628b2f27503d1))
* **work-engine:** heartbeat survives state sync; turn-check surfaces drift ([303d04e](https://github.com/event4u-app/agent-config/commit/303d04ebbb896fd82ba0cd5910089fa6079b9f1f))
* **roadmap-sync:** replace hardcoded `task ci` with project-agnostic phrasing ([272b7b5](https://github.com/event4u-app/agent-config/commit/272b7b554f78a72cdeb4cf278bbdf065a895efa7))
* **chat-history:** correct suggestion frontmatter to schema-compliant fields ([cf4849d](https://github.com/event4u-app/agent-config/commit/cf4849d4a9e5954d3ff7e10aa4712d7921b0f7c1))
* **compress:** align compressed code blocks with uncompressed source ([4a495c9](https://github.com/event4u-app/agent-config/commit/4a495c91da13cd9ea858d06b3eabaef31897b5d8))
* **sync:** handle 3-level nested settings (commands.suggestion.*) and list values ([e8904cd](https://github.com/event4u-app/agent-config/commit/e8904cd35f309cc65807418429f9298af9743390))
* **roadmap-progress:** Steps = total checkboxes, reorder Open before Done ([ec2c2e6](https://github.com/event4u-app/agent-config/commit/ec2c2e6bce8868fec605181fa35a32fa14a04640))
* **marketplace:** sync manifest with disk + add reverse-drift linter ([98d5cb3](https://github.com/event4u-app/agent-config/commit/98d5cb3b46e3761e75258141b776d06749fba6f2))
* **rules:** harden recommendation-consistency — single source + script gate ([ed953db](https://github.com/event4u-app/agent-config/commit/ed953dbe9c795abfe5a8543667ab1a630d9b2b50))
* **golden:** sandbox-relative ticket paths in transcript cmd ([0265be9](https://github.com/event4u-app/agent-config/commit/0265be9df02bafecfefc0eb7816b55a10cf2e911))
* **golden:** scrub pytest duration in capture summaries ([a5de45d](https://github.com/event4u-app/agent-config/commit/a5de45d0c0bd5cf850acc0cf2d2d6635e80d398e))
* **rule:** harden chat-history with iron-law + per_phase cadence ([f1b3e01](https://github.com/event4u-app/agent-config/commit/f1b3e01b4d530496fc82eaca5b1120153ccb3505))

### Documentation

* **readme:** reflow R4 paragraph to satisfy 500-line linter ([712a5e2](https://github.com/event4u-app/agent-config/commit/712a5e234f80d7d95c9240fccca6d8fd1b44fb3e))
* **readme:** note R4 a11y precedence in UI track ([9c53182](https://github.com/event4u-app/agent-config/commit/9c5318204cd34faa9a931280a76e18b6b1a3fd25))
* amend UI-track contracts with R4 a11y gate and preview envelope ([cf1ad44](https://github.com/event4u-app/agent-config/commit/cf1ad44ef476166cde97c6ccdf58d3b0928bbf55))
* **r4:** mark Phase 2 complete; dashboard 51/78 (was 47%) ([8ff7e7f](https://github.com/event4u-app/agent-config/commit/8ff7e7fe001ef0b83d4e32a876f3cd2563083c32))
* **r4:** mark Phase 1 (review-step a11y gate) complete ([3a0d773](https://github.com/event4u-app/agent-config/commit/3a0d773962336f7836c4932c3cca16e18b7e6f59))
* **r4:** mark Phase 0 (state-shape extension) complete ([b243fc2](https://github.com/event4u-app/agent-config/commit/b243fc2fb078238d9480f4026b93090124224f23))
* **r4:** expand visual-review-loop roadmap from stub to 6 phases + 6 ACs ([97dc65f](https://github.com/event4u-app/agent-config/commit/97dc65f06b037d70fe1bb69727bed832b6ca5c5e))
* **roadmap:** mark R3.1 follow-up goldens (GT-U5..U8) complete ([eff403a](https://github.com/event4u-app/agent-config/commit/eff403a37720871b052bef85472562e636766dc0))
* **r3.1:** expand follow-up roadmap from stub to 6 phases + 6 ACs ([8b4de92](https://github.com/event4u-app/agent-config/commit/8b4de92c267b9f9426abd4ee5ea4c5e264a58683))
* **r3:** finalize Product UI track docs ([ecea059](https://github.com/event4u-app/agent-config/commit/ecea059c1d4f7778d48d2d00abacc68ded86c826))
* **rules:** document distribution manifests and hook registries in docs-sync ([88f8535](https://github.com/event4u-app/agent-config/commit/88f853534c4edf9432232cbdc4d117c306d7ca05))
* **roadmaps:** add work-engine hooks roadmap, mark P1 complete ([f6a867d](https://github.com/event4u-app/agent-config/commit/f6a867d3a95912a1c4c03c139870587bfe95393b))
* **roadmap:** close R3 Phase 6 Step 1 + GT-U1 progress ([b80140e](https://github.com/event4u-app/agent-config/commit/b80140ee9f9b6796779dd251ad1a51213480039b))
* **roadmap:** close R3 Phase 5 — UI skills repositioned ([97dafbc](https://github.com/event4u-app/agent-config/commit/97dafbc22b7142e210d7e742196546ac701ef455))
* **roadmap:** close R3 Phase 4 — mixed orchestration shipped ([040fb43](https://github.com/event4u-app/agent-config/commit/040fb4314a26e57b408baaa6dbc9f9b297ef70ce))
* **roadmaps:** close Phase 2 Step 5 of product-UI track ([f4df4f3](https://github.com/event4u-app/agent-config/commit/f4df4f301fa0de9cf6d39910b2e3e9cb1e55737a))
* mark product UI track phase 3 complete ([8d982af](https://github.com/event4u-app/agent-config/commit/8d982af0bc40f1e4ce1da7f0837ae8c05a13ad19))
* **roadmaps:** close and archive road-to-stable-chat-history ([41affe3](https://github.com/event4u-app/agent-config/commit/41affe3014d2ccc472bab9e464f380acbf8763f0))
* **roadmaps:** annotate Phase 5 dogfood steps with synthetic-CLI evidence ([6ce5374](https://github.com/event4u-app/agent-config/commit/6ce5374852658c68b4bcdca330a62ec22ae03462))
* **roadmaps:** regenerate progress dashboard for chat-history Phases 2-4 ([2d60d42](https://github.com/event4u-app/agent-config/commit/2d60d42c4367f672ffb8409e627c7b183004fe04))
* **chat-history:** mark Phases 2/3/4 done; refresh count snapshots ([8602aef](https://github.com/event4u-app/agent-config/commit/8602aef13c15a1fde1e2b4dcc5849d6e96e66c6e))
* **chat-history:** document platform hooks and complete Phase 1 ([1ad00f4](https://github.com/event4u-app/agent-config/commit/1ad00f4158ac2bc18ef77d06e8e2e91cb1392e20))
* **roadmap:** add road-to-stable-chat-history ([e8b19c3](https://github.com/event4u-app/agent-config/commit/e8b19c3488ba26a7645dc76ed88969f76290d8bd))
* **command-suggestion:** README + AGENTS + CHANGELOG (Phase 7 Steps 5,7) ([5e411e3](https://github.com/event4u-app/agent-config/commit/5e411e3c2b7ea11fe9bb3bf4a191944babd801bb))
* **command-suggester:** GT-CS goldens, ADR, flow doc (Phase 7 Steps 1,3,6) ([ed3b476](https://github.com/event4u-app/agent-config/commit/ed3b476802f109ab58ba6ccfd6fd805085d2af46))
* **command-writing:** document suggestion frontmatter requirements ([c798a48](https://github.com/event4u-app/agent-config/commit/c798a48a87cce5f5658a87da3cd5f01a707de815))
* **telemetry:** Phase 7 — onboarding hint, AGENTS/README pointer, ADR, changelog ([cc69615](https://github.com/event4u-app/agent-config/commit/cc69615b09331dddd4aad891528cc39dd1bb2549))
* **roadmap:** mark Phase 6 dogfooding done — Steps 1-3 closed, Step 4 deferred ([d278e58](https://github.com/event4u-app/agent-config/commit/d278e5836ffff34126b0d323a3b4d1e9799453ec))
* **telemetry:** privacy contract and Phase 5 progress ([a2a9d3e](https://github.com/event4u-app/agent-config/commit/a2a9d3e03d1ac01498218bd65ef19363ac43da4a))
* **telemetry:** add artifact-engagement-flow context doc ([e98569e](https://github.com/event4u-app/agent-config/commit/e98569efdfe72650dc11f6e0ae583a4e55f53164))
* **roadmap:** mark Phase 2 of artifact-engagement-telemetry done ([87da655](https://github.com/event4u-app/agent-config/commit/87da6552db02ece055161ccf97a62c66f7498858))
* **roadmap:** close Phase 1 of artifact-engagement-telemetry ([6275e5c](https://github.com/event4u-app/agent-config/commit/6275e5cfb3f9a61498bcdbd0b71ee9a160798208))
* **cloud-trigger-fixtures:** add Phase 6 v0 fixture set + methodology ([cafaaa0](https://github.com/event4u-app/agent-config/commit/cafaaa0962ab6e5099d90e57886a52bce0473ec5))
* **roadmap:** mark Phase 5 Step 4 as deferred after mechanical verification ([f14fa34](https://github.com/event4u-app/agent-config/commit/f14fa34017407029c5462b8b65c513a9f55aaab1))
* **showcase:** add behavioral examples with file anchors ([dade31a](https://github.com/event4u-app/agent-config/commit/dade31a3de647bd743fdc95c803d18e97b8586f9))
* **roadmap:** mark Phase 5 Step 3 done — cloud-release workflow ([c94bde2](https://github.com/event4u-app/agent-config/commit/c94bde2164a2152871e16556abdb6ea7fd82cacd))
* **roadmap:** mark Phase 5 Step 2 done — install paths documented ([401c005](https://github.com/event4u-app/agent-config/commit/401c005a8726c9482db705cb4ab7bc6252708f01))
* **install:** document four install paths — local, plugin, cloud, Linear ([6df2995](https://github.com/event4u-app/agent-config/commit/6df29950151f3fb316ea1faf3caf781287d5660b))
* **roadmap:** close Phase 5 Step 1 + Open Question #4 ([2a2b4d6](https://github.com/event4u-app/agent-config/commit/2a2b4d671152d84b8fc5a2428aabfc3ff8fba854))
* **roadmap:** mark Phase 4 done — Cloud-Aware Documentation Pass ([2e8c7f6](https://github.com/event4u-app/agent-config/commit/2e8c7f629df2ed1471e703aa741cdfe9824f9d10))
* **roadmap:** mark Phase 2 done + Phase 3 Step 1 done ([9ed6819](https://github.com/event4u-app/agent-config/commit/9ed681972dbdd36e4457196ff969203b28cb8e94))
* **cloud:** document cloud-bundle pipeline + smoke protocol ([d6c1fcb](https://github.com/event4u-app/agent-config/commit/d6c1fcba68a5e4e695b6009427e66756240dd74d))
* **roadmap:** road-to-universal-distribution + cloud-compat audit tool ([db80039](https://github.com/event4u-app/agent-config/commit/db800394da5f0bda6fde297fd59d124abeb2af2f))
* **rules:** promote chat-history Iron Law to three gates with heartbeat ([c638da7](https://github.com/event4u-app/agent-config/commit/c638da7ef55a7685455161124e88ca569e99501b))
* **rules:** rewrite chat-history rule to mandate turn-check first ([a8f69aa](https://github.com/event4u-app/agent-config/commit/a8f69aa13dc8bdcfacb35898a6e0f7f2915176d5))
* **roadmap:** archive R2 prompt-driven execution + regenerate dashboard ([32b9022](https://github.com/event4u-app/agent-config/commit/32b90228e6b139683c1bf6f7f296f7d579463a07))
* **work_engine:** R2 README, AGENTS, ADR, changelog, flow doc (R2-P6) ([a94b44f](https://github.com/event4u-app/agent-config/commit/a94b44f16c3080a5e1e15fa2dd6eba87404103aa))
* **roadmap:** mark P7-S1 complete (task ci end-to-end green) ([0e29381](https://github.com/event4u-app/agent-config/commit/0e29381ec661a3936e7245f884bf10fd64e0c0f3))
* **flow:** document Replay protocol — Strict-Verb contract (R1-P6-S5) ([05056c5](https://github.com/event4u-app/agent-config/commit/05056c5c6bb032b048952ffaa024e832d41250a1))
* **roadmap:** mark P6-S4 complete (CHECKSUMS audit) ([d47e87b](https://github.com/event4u-app/agent-config/commit/d47e87bab805c60310d6739f61b0cb97e527376f))
* **roadmap:** mark P6-S3 complete; regen dashboard ([228c1d7](https://github.com/event4u-app/agent-config/commit/228c1d71e7f7e60c4769d6cbba0fa1da520b7f4a))
* **roadmap:** mark P6-S1 + P6-S2 complete; regen dashboard ([69a58bd](https://github.com/event4u-app/agent-config/commit/69a58bde28b187762b6d7fe8abc28266cfcec068))
* **roadmap:** mark R1 P5 S3 done — Phase 5 complete ([649cd2a](https://github.com/event4u-app/agent-config/commit/649cd2a5b3b159313688d28028893b21e0f25e2c))
* **command-routing:** document /implement-ticket dispatching to work_engine (R1 P5 S3) ([5d2b2df](https://github.com/event4u-app/agent-config/commit/5d2b2df705ee56f06b59f2a13bfa6dce8344326e))
* **roadmap:** mark R1 P5 S1+S2 done ([9db66bc](https://github.com/event4u-app/agent-config/commit/9db66bc642fc7169e86aa7b98c71d2b0a99e44aa))
* **php-patterns:** polymorphism guardrails for discriminator-switch antipattern ([255013a](https://github.com/event4u-app/agent-config/commit/255013a391560e2b1278ac7317d11a3ad7238da9))
* **learnings:** harden non-duplication gate with mandatory search protocol ([f345809](https://github.com/event4u-app/agent-config/commit/f3458099abb506741fda50a1d9dc3c910836a609))
* **roadmap:** mark R1 Phase 4 (dispatcher generalization) complete ([756fa7b](https://github.com/event4u-app/agent-config/commit/756fa7b89de01a4f6211d45e725717834cf02e74))
* **roadmaps:** mark R1 Phase 3 complete (rename + shim + tests) ([7e44967](https://github.com/event4u-app/agent-config/commit/7e44967029906bf8cb4446d79c8ad942be076fd8))
* remove internal agents/ links from shipped artifacts + roadmap tweaks ([aadebd7](https://github.com/event4u-app/agent-config/commit/aadebd7f53d6afda1fc6ce40f74b0a2215f14410))

### Refactoring

* **rules:** hoist Iron Laws to top and harden chat-history ([a69bc32](https://github.com/event4u-app/agent-config/commit/a69bc32ec4529ebe6558105bab1c52414d423436))
* **work_engine:** rename UI _phase3_stub to _passthrough ([b67aa7c](https://github.com/event4u-app/agent-config/commit/b67aa7c1a155daa5e1cdb10b3c73669fd32b0c39))
* **chat-history:** slim rule under 200-line limit; extract handshake details ([6949799](https://github.com/event4u-app/agent-config/commit/69497995deb440fe2d8a3387eddbb2e7e7cf095c))
* **implement-ticket:** switch wrapper to .work-state.json + work_engine path (R1 P5 S1+S2) ([2f074d4](https://github.com/event4u-app/agent-config/commit/2f074d4f1bc4576b4d6e8571f37b755bc8373af1))
* **work_engine:** wrap CLI boundary in WorkState v1 (R1 P4 S1) ([5b2b5c3](https://github.com/event4u-app/agent-config/commit/5b2b5c301b7d3368bf0c00ae785e43fbb2a9a31b))
* **engine:** repackage steps/ → directives/backend/ (R1 P4 S3) ([fb3abca](https://github.com/event4u-app/agent-config/commit/fb3abca243be446aee784caccc64b3d5653dd51c))
* **engine:** switch internal callers to work_engine (R1 P3 S3) ([c3d1bff](https://github.com/event4u-app/agent-config/commit/c3d1bff90bf663a89f430a1550db1affd34a424c))
* **engine:** rename implement_ticket → work_engine (R1 P3 S1+S2) ([3fdb78b](https://github.com/event4u-app/agent-config/commit/3fdb78bd558fa9625e7fb8f301adb4fe9d7a07ae))
* **artifacts:** route shipped artifacts through ./agent-config CLI ([c8158b2](https://github.com/event4u-app/agent-config/commit/c8158b2ac42e17fb302fc658a277abb2129f9a60))

### Tests

* **golden:** pin GT-U13/U14/U15 — a11y polish, a11y ceiling, preview-fail ([05f9eb2](https://github.com/event4u-app/agent-config/commit/05f9eb21aa236a1088f85ab12c93a845355bfc13))
* **golden:** extend capture/harness for a11y findings and preview envelope ([6c385c4](https://github.com/event4u-app/agent-config/commit/6c385c4f71265a6c962fb067a54f0a558b3c08a0))
* **golden:** pin GT-U5 mixed flow and GT-U6A/B stack dispatch ([16550b8](https://github.com/event4u-app/agent-config/commit/16550b829cdf5f26532e7d4a51974ad13fbbcfcd))
* **golden:** drop per-baseline reproduction-notes ([9b3e63b](https://github.com/event4u-app/agent-config/commit/9b3e63beea198fe20cfcedb3560dfa026e5201aa))
* **golden:** add GT-U1 ui-build happy path + refresh GT-P1..P4 baselines ([15e36e9](https://github.com/event4u-app/agent-config/commit/15e36e94a5fec8623fc9e8f12b438d6e34edb341))
* **work-engine:** add full-flow integration tests for mixed directive set ([eccfe66](https://github.com/event4u-app/agent-config/commit/eccfe6686abd747c29b1e293254db99a913cf331))
* **work_engine:** defense-in-depth dispatcher and rule-content gates for ui audit ([8b9ea7b](https://github.com/event4u-app/agent-config/commit/8b9ea7b0ab018aa9879d72c9699e07731562f61f))
* **chat-history:** automated crash-recovery coverage for hook path ([b86e0a9](https://github.com/event4u-app/agent-config/commit/b86e0a9985c4e3e51181a08cbe07f1175156abb2))
* **telemetry:** redaction validator coverage (Phase 5) ([dc3e2de](https://github.com/event4u-app/agent-config/commit/dc3e2de49a3f7a49a653b05106393e43f29bbe10))
* **telemetry:** aggregator + renderer + telemetry:report CLI ([788907a](https://github.com/event4u-app/agent-config/commit/788907ac183ed4c258df850d7502d0a189b22902))
* **telemetry:** cost-floor invariants for disabled state ([c0da561](https://github.com/event4u-app/agent-config/commit/c0da56193891294a60dea1db22a3b39c072a690b))
* **telemetry:** boundary, settings, CLI coverage (25 cases) ([781ef0d](https://github.com/event4u-app/agent-config/commit/781ef0d4720aed21e30faf3e24073d8e9a46fe04))
* **cloud:** regression test asserting T3-H tier stays 0 in shipped sources ([3f0eaac](https://github.com/event4u-app/agent-config/commit/3f0eaacfa5b1a17da7fa1b9d6a26df1ff2bfd4d6))
* **golden:** capture GT-P1..GT-P4 prompt-driven baselines (R2-P5) ([c3343df](https://github.com/event4u-app/agent-config/commit/c3343dfce7edb4dbd23d6ae80f185ed92367ec61))
* **engine:** migrate test suite to tests/work_engine/ (R1 P3 S4) ([eb73ae0](https://github.com/event4u-app/agent-config/commit/eb73ae0532bdfe4a8aa92f842d10243adf91cbdd))

### CI

* **consistency:** gate cloud-bundle, linear-digest, marketplace on PRs ([9d855af](https://github.com/event4u-app/agent-config/commit/9d855af5d47592e9e7f0c429f1a7445c736eaa26))

### Chores

* close roadmaps ([bcfaa0f](https://github.com/event4u-app/agent-config/commit/bcfaa0f5d30a8d15d390a15654aaa80cdaccb102))
* archive road-to-visual-review-loop (R4 complete) ([706bff8](https://github.com/event4u-app/agent-config/commit/706bff8e331cbd29f1456928a1b09536170a5a4b))
* **roadmap:** sync dashboard after R4 expansion (47%, 2 open) ([a36736f](https://github.com/event4u-app/agent-config/commit/a36736f8f67185d99b2bab9009de8bb186893165))
* **roadmap:** archive R3.1 — Product UI Track Follow-up Goldens (100%) ([f740abf](https://github.com/event4u-app/agent-config/commit/f740abf33c811e060ecd1df7b8beb6bbd392c232))
* **roadmap:** sync dashboard after R3.1 progress (89%) ([fcd18b0](https://github.com/event4u-app/agent-config/commit/fcd18b07d03c5407334e4d43fed39d1e0e4ce31a))
* **roadmap:** mark Universal Distribution AC #2 (quality gates) done ([6c44878](https://github.com/event4u-app/agent-config/commit/6c44878f7e1631234b40027be1d0c4cf8b3fed2d))
* **roadmap:** complete and archive Product UI track (R3) ([baffc43](https://github.com/event4u-app/agent-config/commit/baffc4375b9bbcf9f6c2ea2d9b7001a895d68437))
* **roadmap:** mark Phase 7 complete + refresh dashboard ([d03595b](https://github.com/event4u-app/agent-config/commit/d03595b3a41d6bfb39f483f7137c810a94bcf964))
* **roadmaps:** close Phase 6 of road-to-product-ui-track ([8f61910](https://github.com/event4u-app/agent-config/commit/8f61910ed91adc6a2af318b13672abcb947d424e))
* **sync:** wire pre-commit marketplace lint into installer ([a163d64](https://github.com/event4u-app/agent-config/commit/a163d64443fe6574ade62be5d074c254b884c155))
* **marketplace:** list react-shadcn-ui skill ([24788ec](https://github.com/event4u-app/agent-config/commit/24788ec6e02bfad824fe44272649229ccf2cb9de))
* **roadmaps:** close work-engine-hooks roadmap + regenerate dashboard ([e841ba4](https://github.com/event4u-app/agent-config/commit/e841ba435fa27f35ae843fadf72a69b24ae6b478))
* **compress:** regenerate compressed siblings + sync tool projections ([a62ba2b](https://github.com/event4u-app/agent-config/commit/a62ba2b61307b424077e08bd7125aa480d6807bc))
* **docs:** bump skill count to 128 after react-shadcn-ui addition ([305fb28](https://github.com/event4u-app/agent-config/commit/305fb28e7abb7942210cae8599da64cfe0aee53b))
* **compress:** catchup compressed siblings for work_engine UI + mixed directives ([746f5cc](https://github.com/event4u-app/agent-config/commit/746f5ccb667e067ad312e2a8ccc2025dc66c2c98))
* **marketplace:** register chat-history-checkpoint and three drifted skills ([505a84b](https://github.com/event4u-app/agent-config/commit/505a84b2f722b92b752eefb1cf8766c6fad27089))
* **tools:** regenerate multi-agent tool projections ([18ddf84](https://github.com/event4u-app/agent-config/commit/18ddf84edd1e6b19341aa169bb12db40df43d7c1))
* **rules:** harden language-and-tone Iron Law against momentum slip ([6d613c2](https://github.com/event4u-app/agent-config/commit/6d613c22ba74b34576909698f4ac732ccf882f7f))
* **roadmap:** mark R3 Phase 1 done in road-to-product-ui-track ([c5dbaec](https://github.com/event4u-app/agent-config/commit/c5dbaec4b7413287f6d87e0c17e1b38050433d9c))
* **goldens:** recapture baselines for R3 Phase 1 schema bump ([62d9331](https://github.com/event4u-app/agent-config/commit/62d9331ba33b88e0e8e8be305d46d9fbe3dc2e9b))
* **roadmap:** archive context-aware-command-suggestion roadmap ([6c3dff1](https://github.com/event4u-app/agent-config/commit/6c3dff17cc570fafb865596b24c6845ea0a3d0a4))
* **generate-tools:** regenerate .windsurfrules after compression alignment ([8b03959](https://github.com/event4u-app/agent-config/commit/8b03959a2668a15d7ba37610c498967663a9b73b))
* **roadmap:** regen tool projections + close command-suggestion roadmap ([9a58190](https://github.com/event4u-app/agent-config/commit/9a58190bf77db481f7103c91ad6e9dec4020d261))
* **roadmap:** mark Phase 1+2 of context-aware command suggestion done ([e2adbff](https://github.com/event4u-app/agent-config/commit/e2adbffa54ed26cdb66456885a7915257b338b59))
* **roadmap:** archive artefact-engagement-telemetry roadmap ([57d3db9](https://github.com/event4u-app/agent-config/commit/57d3db991a5108cdc5f6b8048afcdc366ce00b07))
* **roadmap:** mark Phase 4 done in artifact-engagement-telemetry ([347ccb6](https://github.com/event4u-app/agent-config/commit/347ccb6993328631306fa9562c58d3f5a4dab02f))
* **roadmap:** mark Phase 3 done in artifact-engagement-telemetry ([1cdd52a](https://github.com/event4u-app/agent-config/commit/1cdd52a16e4f21d87b4f635619836ae7668425f5))
* **settings:** wire telemetry.artifact_engagement namespace (Phase 1 step 2+3) ([13aa723](https://github.com/event4u-app/agent-config/commit/13aa7238a5b534354dbe343f81ed00276c502fd9))
* **sync:** regenerate counts, hashes, and tool projections ([7016ab5](https://github.com/event4u-app/agent-config/commit/7016ab5085b8680e82efbe8df2ec4f94c80f0ea5))
* **mcp:** add agent-memory MCP server config ([dc9fd65](https://github.com/event4u-app/agent-config/commit/dc9fd659501f9b89577bc2ceba6f7d42ec63b6d2))
* **taskfile:** wire sync-agent-settings into task sync ([76fd544](https://github.com/event4u-app/agent-config/commit/76fd544d7e80217a0fd359fb9c0c97a27b3a4e71))
* **rules:** make cli-output-handling task-invocation portable ([08b40a8](https://github.com/event4u-app/agent-config/commit/08b40a883287c82d586ac5300521e2014a3dbd8f))
* **rules:** add consistency iron law for numbered-option recommendations ([1bc6a65](https://github.com/event4u-app/agent-config/commit/1bc6a6535073d49a31b669fb22ac506ff101a6e6))
* **rules:** make rtk the default for verbose CLI output ([6d506c7](https://github.com/event4u-app/agent-config/commit/6d506c7037820bb50d4c794100ccd47bd9e119a0))
* **docs:** bump rule count 46 → 47 after direct-answers add ([0e35f1f](https://github.com/event4u-app/agent-config/commit/0e35f1f2c57dd01fe77353a1da53c6019834db62))
* **rules:** harden chat-history with no-fake-marker clause ([7d57be8](https://github.com/event4u-app/agent-config/commit/7d57be81278b66cc23d5d6093ff6e06c6aa3948f))
* **sync:** regenerate chat-history projections after heartbeat update ([583f284](https://github.com/event4u-app/agent-config/commit/583f28466ed19d8a8220441d0e4b11421b6d016c))
* **sync:** regenerate chat-history projections ([6e0357e](https://github.com/event4u-app/agent-config/commit/6e0357e73c9b0ae5cfe217fcd80507c004fbf58d))
* **gitignore:** catch dot-prefixed staging variants under tests/golden/ ([6d37549](https://github.com/event4u-app/agent-config/commit/6d37549f47aa90f06bad96901988ac4db1af6973))
* **tools:** regenerate .windsurfrules after rule edits ([a5a0bfe](https://github.com/event4u-app/agent-config/commit/a5a0bfe1cffbc461692db85e96b4bc292ecdeb21))
* add mcp for ai ([0dd133a](https://github.com/event4u-app/agent-config/commit/0dd133a92b239764d451b5764e0408a9d84c74dc))

### Other

* R1-P2: state schema v1 + v0 to v1 migration ([e7b1469](https://github.com/event4u-app/agent-config/commit/e7b1469443d9bd2496ab9f61f76c508698ac7516))
* R1-P2-FIX: scope outer pytest away from golden sandbox ([f2414d8](https://github.com/event4u-app/agent-config/commit/f2414d8e0a5d6a85d96f6a886dbb2a8ef13705fb))
* R1-P1-LOCK: freeze implement-ticket behavioural baseline ([21a7a96](https://github.com/event4u-app/agent-config/commit/21a7a96e705642a6ea59682d28791e28650446e3))
* R1-P1: capture sandbox + Golden Transcripts for implement-ticket ([f0073c7](https://github.com/event4u-app/agent-config/commit/f0073c7fcfc6cc6a6080eb69cc4c33e922265fd5))

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
