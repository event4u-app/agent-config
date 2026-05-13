# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.

## [Unreleased]

Four roadmaps land in this release.

**Package consolidation** — the standalone wrapper package
`@event4u/create-agent-config` is retired. `npx @event4u/agent-config init`
is now the canonical one-shot entrypoint; the bundle package gains an
`init` subcommand that delegates to `scripts/install`. `packages/create-agent-config/`
is removed from the repo, and every doc / template / help string is
updated to the new command. Existing users running the old wrapper
should switch — the old package name will stop receiving releases.

**Global-First Install (R4)** — `npx @event4u/agent-config init`
now defaults to a **global** install (`~/.claude/`, `~/.cursor/`, …)
when run outside a project, and a **project** install when run inside
one. A new global lockfile at `~/.config/agent-config/installed.lock`
records `agent_config_version` + `tools[]` and refuses mismatched
re-installs (exit 1) until `update` or `--force` realigns it. New
`agent-config export --tool=<id> --output=<path>` subcommand ejects a
named tool's resolved content into the project tree (idempotent;
`--force` overrides drift). 12 supported tool ids (claude-code,
cursor, windsurf, cline, aider, codex, gemini, copilot,
claude-desktop, continue, kilocode, zed, jetbrains, kiro). Windows
CI matrix added for the lockfile + export paths. See
[`docs/decisions/ADR-007-agent-discovery-scopes.md`](docs/decisions/ADR-007-agent-discovery-scopes.md)
and [`docs/decisions/ADR-008-installed-tools-manifest.md`](docs/decisions/ADR-008-installed-tools-manifest.md).

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

## [2.5.0](https://github.com/event4u-app/agent-config/compare/2.4.1...2.5.0) (2026-05-13)

### Features

* **claude-desktop:** bundle commands as desktop skills ([50cd319](https://github.com/event4u-app/agent-config/commit/50cd31988ac571ecdf883c5d2c6d62c209820ebc))

Tests: 3530 (+9 since 2.4.1)

## [2.4.1](https://github.com/event4u-app/agent-config/compare/2.4.0...2.4.1) (2026-05-13)

### Bug Fixes

* **install:** write lockfile to canonical event4u namespace ([ca57607](https://github.com/event4u-app/agent-config/commit/ca5760785f150903bcad74e278b59e534f83634d))
* **install:** source global deploy from .agent-src/ subdirectories ([f151caf](https://github.com/event4u-app/agent-config/commit/f151caf854d9ce8519bc244d441a7c8bf73e7fde))

Tests: 3521 (+0 since 2.4.0)

## [2.4.0](https://github.com/event4u-app/agent-config/compare/2.3.0...2.4.0) (2026-05-13)

### Features

* **install:** Claude Desktop ZIP bundle deployment ([9f2a00c](https://github.com/event4u-app/agent-config/commit/9f2a00cfd752232abdcf16c6e3440c46f5c9d596))
* **install:** event4u namespace and auto-migration shim ([a58570e](https://github.com/event4u-app/agent-config/commit/a58570ecff885a7d50350c4281e675d7ff34f912))

### Bug Fixes

* **agent_settings:** align source with template via relative import ([a85b6c8](https://github.com/event4u-app/agent-config/commit/a85b6c82284310876d075a924918052fc7dbabdb))
* **work_engine:** vendor user_global_paths into template for self-contained import ([f111c4e](https://github.com/event4u-app/agent-config/commit/f111c4e60de6cd60fbe81635029f9f34437a5ead))
* **migrate:** atomic per-entry write with partial-debris purge ([5bd5aad](https://github.com/event4u-app/agent-config/commit/5bd5aadf0085657ec98eee049dda440d05b06801))

### Documentation

* **roadmap:** mark Steps 5-6 done (commit + PR opened) ([8492b7f](https://github.com/event4u-app/agent-config/commit/8492b7fd3cfd76075a64d5de770db2c5013e02dd))
* **adr:** ADR-009 rollback section + AI Council convergence ([cc78adc](https://github.com/event4u-app/agent-config/commit/cc78adc0a9d0fbc51b2a65f35d8e0f13c1456a2f))
* **contracts:** mark installed-tools-lockfile as beta ([90991da](https://github.com/event4u-app/agent-config/commit/90991da2f840ebae978fc4df9996c01324816404))
* **adr:** ADR-009 event4u namespace + Claude Desktop ZIP bundles ([c707bd3](https://github.com/event4u-app/agent-config/commit/c707bd31211f94ace858738b7aee8d3898f0da88))
* **roadmap:** add road-to-event4u-namespace-and-claude-desktop ([d92706b](https://github.com/event4u-app/agent-config/commit/d92706bd53621ff3a225db6eb9ee490f17f613d2))

### Chores

* **onboard:** rephrase 'event4u-owned' as 'package-owned' ([4bdd43b](https://github.com/event4u-app/agent-config/commit/4bdd43b7a6637a36cfa377045b6cd0f3f51b0fd1))
* **template:** bump agent_config_version pin to 2.3.0 ([1180bf2](https://github.com/event4u-app/agent-config/commit/1180bf263f2f33fb5b41b13439c92cfbdc3a70d8))
* **index:** regenerate index + catalog for accurate counts ([655a5eb](https://github.com/event4u-app/agent-config/commit/655a5eb81ce6744548a6f50451f66576a7c2b5ac))
* **sync:** regenerate derived outputs for event4u namespace ([c277a94](https://github.com/event4u-app/agent-config/commit/c277a94f881ad4702ed2e97cebf6c5a7c8471a35))

Tests: 3521 (+31 since 2.3.0)

## [2.3.0](https://github.com/event4u-app/agent-config/compare/2.2.2...2.3.0) (2026-05-13)

### Features

* **prune:** add --resume-uninstall for focused crash recovery ([1c98454](https://github.com/event4u-app/agent-config/commit/1c9845404f1e629f802494c732f7438aa4335c8e))
* **dev:** add dev:install-global and dev:link tasks for local development ([db4bdc9](https://github.com/event4u-app/agent-config/commit/db4bdc9794752791bb93235cc9cc3179df9b88df))
* **install:** manifest schema v2 + doctor + conflict detection + inline tag ([50c0892](https://github.com/event4u-app/agent-config/commit/50c0892bf01eb904e48dd786ef03c519f82be485))
* **cli:** add prune command for orphaned bridge markers ([d16abff](https://github.com/event4u-app/agent-config/commit/d16abff8ac9fd55ccd501d319785f463eb7cbeee))
* **cli:** add uninstall/versions subcommands and --offline mode ([12a8e75](https://github.com/event4u-app/agent-config/commit/12a8e75945f1d26c1412d17331788c8e51601cea))
* **install:** add workflow-mode activation hints to IDE bridges ([5e09e17](https://github.com/event4u-app/agent-config/commit/5e09e17f0de62b4113bd68839d6ce55a1527d4b1))
* **rules:** add external-reference-deep-dive hardening rule ([0d2c80c](https://github.com/event4u-app/agent-config/commit/0d2c80c0f418b80a67d08c4577cfe67ab6abe3db))
* **install:** expand global content deployment to 23 AI tools ([3ef13a7](https://github.com/event4u-app/agent-config/commit/3ef13a7c2ae16b95da9e5a49ec3a19c5cb211357))

### Bug Fixes

* **install:** normalise manifest paths + surface doctor remediation hint ([b4662b6](https://github.com/event4u-app/agent-config/commit/b4662b609db6b1b4660652facc0efb10b36a5d51))
* **test:** patch USERPROFILE in isolated_lock fixture for Windows ([ac1c924](https://github.com/event4u-app/agent-config/commit/ac1c924e08822e09471c0cf0077ad69be531d7b5))

### Documentation

* **readme:** remove stale vX.0 breaking-change notice ([d6aef9a](https://github.com/event4u-app/agent-config/commit/d6aef9acce3e5409f0ffc641ecf026af1f9bb863))
* **roadmap:** sharpen Phase 6 deferred trigger — name the collision ([d0a6dd2](https://github.com/event4u-app/agent-config/commit/d0a6dd28294c011d4135b4047e4e5252008fcf05))
* **roadmap:** close + archive multi-package coexistence ([3ef464f](https://github.com/event4u-app/agent-config/commit/3ef464fd6123ead7ca755542a1459e6a9e8e270b))
* **roadmap:** plan + close phases 1-5 of multi-package coexistence ([34967a5](https://github.com/event4u-app/agent-config/commit/34967a5e6525d4d742155ee3bd3fe0bb80d852bf))
* **install:** add installed-tools-lockfile wire contract ([c352db3](https://github.com/event4u-app/agent-config/commit/c352db383f6bf6dc328159289fa4d96abb2594c4))
* **setup:** add per-IDE activation guides for 14 tools ([6379a49](https://github.com/event4u-app/agent-config/commit/6379a49fed6ac3256c23ac8e04c69fa0d4f85aa2))

### Tests

* **e2e:** cover shared JSON merges, sole-owner cleanup, conflict chain ([0ff50ae](https://github.com/event4u-app/agent-config/commit/0ff50ae617d878138376e535fc8b5c22a7677356))
* **install:** e2e multi-package coexistence scenario ([081318e](https://github.com/event4u-app/agent-config/commit/081318ea8e3c872548839d100117cbd9b4a1343a))
* **cli:** cover prune — orphans, dry-run, json, hard-floor ([0261ea2](https://github.com/event4u-app/agent-config/commit/0261ea2e1687e6904bdcb3083cb0d700b6ef82e5))

### CI

* **tests:** bump per-shard parallelism explicitly to beat macOS nproc=3 ([83a3b4d](https://github.com/event4u-app/agent-config/commit/83a3b4d3bf6eefe10963d84525469aeb8e3b8abe))
* **tests:** bump install-tests shards 3→4 to keep macOS under 2min ([dd4d5bc](https://github.com/event4u-app/agent-config/commit/dd4d5bc385282d344809a057d015a968811d4a3b))
* **tests:** shard install-tests matrix to hit 1-2min/job target ([6a56416](https://github.com/event4u-app/agent-config/commit/6a564161f0a74601fe077d34c76f2f5a27657893))
* **tests:** parallelize install-tests + fix Windows UTF-8 encoding ([e346a26](https://github.com/event4u-app/agent-config/commit/e346a26e91be633a63e8c7d46fb09a3a6cdf800e))
* **tests:** bootstrap .augment/ projection before pytest ([e40371e](https://github.com/event4u-app/agent-config/commit/e40371ea7b0c345ee59eba8ba5e47328bf6aebe9))

### Chores

* finalize changes ([7cbbe68](https://github.com/event4u-app/agent-config/commit/7cbbe6881e040d67fd0598df73b82b3fbd1278c0))
* regenerate router.json after kernel/tier rebuild ([ff5f10e](https://github.com/event4u-app/agent-config/commit/ff5f10e0589f46782ec6381a84377f22b90d7edc))
* **marketplace:** refresh marketplace.json manifest ([eb9b934](https://github.com/event4u-app/agent-config/commit/eb9b934f5b4573ec1fcde19f91f6a20637b8dbeb))

Tests: 3490 (+140 since 2.2.2)

## [2.2.2](https://github.com/event4u-app/agent-config/compare/2.2.1...2.2.2) (2026-05-12)

### Bug Fixes

* allow --global installs from agent-config source repo ([1be1b44](https://github.com/event4u-app/agent-config/commit/1be1b4429e8fa3ff3fb2981a1368138aa34186ac))

Tests: 3350 (+0 since 2.2.1)

## [2.2.1](https://github.com/event4u-app/agent-config/compare/2.2.0...2.2.1) (2026-05-12)

### Documentation

* changelog + ADR-007 note for package consolidation ([1d0d6fb](https://github.com/event4u-app/agent-config/commit/1d0d6fb8882431ee11a6b034f6157ae9f8ccea4d))
* update install commands to npx @event4u/agent-config init ([b9956c6](https://github.com/event4u-app/agent-config/commit/b9956c6ff827433bff7dc9aa1f40ba3454ef5154))

### Chores

* consolidate npm package into @event4u/agent-config init ([d3188ce](https://github.com/event4u-app/agent-config/commit/d3188ced3edac5b670b68e22f51295ef831471d6))

Tests: 3350 (+0 since 2.2.0)

## [2.2.0](https://github.com/event4u-app/agent-config/compare/2.1.0...2.2.0) (2026-05-12)

### Features

* **npx:** expand --tools validator to 13 supported AI ids ([7af69a7](https://github.com/event4u-app/agent-config/commit/7af69a766f575c30d8f29ea04052647b6a1b8a19))
* **cli:** add sync and validate subcommands for installed-tools manifest ([62a5c66](https://github.com/event4u-app/agent-config/commit/62a5c66a131bcf8866be2a8c0e76ba6e054017af))
* **cli:** add export subcommand and update version-drift handling ([6110f3b](https://github.com/event4u-app/agent-config/commit/6110f3b0ee454ca215c569d8f42ca38ffce577e8))
* **install:** global-first install with lockfile + installed-tools manifest engine ([6200d42](https://github.com/event4u-app/agent-config/commit/6200d42225d5712a10d5458dc608da3f5cd0164c))

### Bug Fixes

* **rules:** trim no-cheap-questions to satisfy 12% concentration cap ([4abf946](https://github.com/event4u-app/agent-config/commit/4abf94628838c027da13d190e5e7b27738070db2))

### Documentation

* **rules:** add no-cheap-questions Iron Law 3 against paternalistic state options ([b98687b](https://github.com/event4u-app/agent-config/commit/b98687bd397d39eae6811e54eb743a095fa33b8b))
* README + installation + manifest guideline for global-first install ([cdc52ff](https://github.com/event4u-app/agent-config/commit/cdc52ffc5abb9cff6fda9133dd0b8dc524794d18))
* **contracts:** add tier-3 contrib plugin contract ([2dbf9cd](https://github.com/event4u-app/agent-config/commit/2dbf9cd2ec772dc2248de2b8f17248e97a67a60b))
* **adr:** add ADR-007 global-first install + ADR-008 installed-tools manifest ([e214de2](https://github.com/event4u-app/agent-config/commit/e214de27bd8d19858fdc16cecc4ebfeaaebce136))

### CI

* **windows:** add lockfile + export tests on Windows runner ([e5802a5](https://github.com/event4u-app/agent-config/commit/e5802a56f45bcfd5eb845c7af816bb12a0b4492b))

### Chores

* **taskfile:** add test-install-local for offline one-liner smoke test ([594ac69](https://github.com/event4u-app/agent-config/commit/594ac69c8682f106dee9ebc9ce3e55bb0083e254))
* **roadmap:** archive road-to-global-first-install (24/24 complete) ([71d8cf2](https://github.com/event4u-app/agent-config/commit/71d8cf2966976c286ffecc1646cb7990255cccd1))

Tests: 3350 (+97 since 2.1.0)

## [2.1.0](https://github.com/event4u-app/agent-config/compare/2.0.0...2.1.0) (2026-05-12)

### Features

* **wrapper:** add npx fallback and sanitize wrapper error test ([9f4326b](https://github.com/event4u-app/agent-config/commit/9f4326bffc59d79e4421b0cd8966c99348afe1e6))
* **installer:** add source-repo guard and drop composer/global paths ([5388de2](https://github.com/event4u-app/agent-config/commit/5388de2598ea668a8671f49bd7bacd4866ed1c33))

### Documentation

* **installation:** add Upgrading from v1 section ([f35df4b](https://github.com/event4u-app/agent-config/commit/f35df4b9667eb848ce2ec47f4a7c550b1bba4054))
* align install guides with v2 npx-only flow ([e841a14](https://github.com/event4u-app/agent-config/commit/e841a14cdbb6691433976c57ff9b28b3ec4992ad))
* **readme:** collapse plugin-install table to one-liner ([b3407bb](https://github.com/event4u-app/agent-config/commit/b3407bb2fda39a8a57c0e2f72c8b430bed4fd012))

### Refactoring

* **cli:** rename fix:pr sub-commands for clarity ([fbdf636](https://github.com/event4u-app/agent-config/commit/fbdf636a50a06f3b35fe5c3d5fb108e9c15e6266))

### Tests

* **install:** drop composer-detection tests retired in v2 ([e37ad99](https://github.com/event4u-app/agent-config/commit/e37ad99beaebbb5f6a98b41e02ecefd6b0d39453))

### Build

* **tasks:** add npm:login + npm:publish-installer ([22639f8](https://github.com/event4u-app/agent-config/commit/22639f877feee33a3cbadb9147941cfb32fb6c9e))

### Chores

* remove retired setup.sh and global-install test surface ([3eebcf7](https://github.com/event4u-app/agent-config/commit/3eebcf72bcc45af168df4fd4b172a2484901a793))

Tests: 3253 (-4 since 2.0.0)

## [2.0.0](https://github.com/event4u-app/agent-config/compare/1.41.2...2.0.0) (2026-05-12)

### BREAKING CHANGES

* **install:** drop composer + npm postinstall, go npx-only ([6bc6c99](https://github.com/event4u-app/agent-config/commit/6bc6c99f57d2a2bcdab03bfacab429ce146dd9b9))

### Features

* **cli:** add update + migrate commands, version-pin resolver, CI drift guard ([b1e34fc](https://github.com/event4u-app/agent-config/commit/b1e34fcd7a03d38266e40dd053414fc9d20c9024))
* **update-check:** add daily npm-registry version probe + banner ([2c4d752](https://github.com/event4u-app/agent-config/commit/2c4d752d5eb28f1c460470668704f5cf403c4046))
* **settings:** add hierarchical project-settings cascade + agents overlay ([3296885](https://github.com/event4u-app/agent-config/commit/32968855ca17210b1594cea2e79778acb0476f0a))

### Tests

* **install:** drop postinstall.sh test cases removed in P0 ([d4e7750](https://github.com/event4u-app/agent-config/commit/d4e7750bcd13b021caa4ccaccff821dc0ae8e537))

### Chores

* **template:** mirror agent_settings cascade into work_engine template ([92f4716](https://github.com/event4u-app/agent-config/commit/92f471662c463efec0df591099a3507919396d77))
* **roadmap:** archive completed portable-runtime-and-update-check ([91e2e4e](https://github.com/event4u-app/agent-config/commit/91e2e4ef75042d2d19a528874ebcac4b94c4046a))

Tests: 3257 (+84 since 1.41.2)

## [1.41.2](https://github.com/event4u-app/agent-config/compare/1.41.1...1.41.2) (2026-05-12)

### Documentation

* **roadmap:** invert portable-runtime to npx-only distribution ([f8f6594](https://github.com/event4u-app/agent-config/commit/f8f65944490f69528616d21f4aa008c7c3d0bfa9))

Tests: 3173 (+0 since 1.41.1)

## [1.41.1](https://github.com/event4u-app/agent-config/compare/1.41.0...1.41.1) (2026-05-12)

### Documentation

* **mcp:** promote durable strategy to agents/contexts; unhook contracts from roadmap ([f9e7278](https://github.com/event4u-app/agent-config/commit/f9e727895e75aa74c712ce628811527a5b982f98))
* **mcp:** add stability frontmatter to discovery-phase-notice contract ([0aacd0b](https://github.com/event4u-app/agent-config/commit/0aacd0b69849029db19985aa08591d52bb5a677b))
* **mcp:** re-anchor roadmap links to archive path ([cbbd77c](https://github.com/event4u-app/agent-config/commit/cbbd77c29a2847db8e69e7e56457dcc1b794b307))

### Chores

* **mcp:** re-anchor roadmap citations in scripts to archive path ([71cac67](https://github.com/event4u-app/agent-config/commit/71cac67cc90b2e42bfa3455f0429791e4bedc60f))
* **roadmap:** close road-to-mcp-full-coverage and archive ([32c2542](https://github.com/event4u-app/agent-config/commit/32c25424fd5b078074c703cb03fb57731ae78f6f))

Tests: 3173 (+0 since 1.41.0)

## [1.41.0](https://github.com/event4u-app/agent-config/compare/1.40.0...1.41.0) (2026-05-12)

### Features

* **mcp/worker:** add optional MCP-Token Bearer auth ([134c6ee](https://github.com/event4u-app/agent-config/commit/134c6ee34ee5fc1f1809f5be72df1ac82ad0cca6))
* **mcp:** L2+L4 — implement 7 read-only tools + catalog sync ([44a0082](https://github.com/event4u-app/agent-config/commit/44a00827a7e19051e58e2a5866a37e8c6e4fb1a6))
* **mcp:** K1+K2 — telemetry SQLite store + CLI dashboard ([e53f321](https://github.com/event4u-app/agent-config/commit/e53f321d3d6a7fb5c95a97232898fbda15cd129b))
* **mcp:** J6 — telemetry healthcheck + consumer discovery notice ([41f02f7](https://github.com/event4u-app/agent-config/commit/41f02f773feb6248ea315e0820d2a81d960b98c9))
* **mcp:** J1-J4 — discovery catalog + stub envelope + telemetry ([38aff65](https://github.com/event4u-app/agent-config/commit/38aff651138d8c20929cab88ac437f3106ba44c3))

### Documentation

* **mcp:** remove public endpoint, document self-hosting + Bearer auth ([6c5d7b0](https://github.com/event4u-app/agent-config/commit/6c5d7b04231e9e274265e7f0481502455085f748))

### Refactoring

* **scripts:** migrate readers to centralized agent_settings loader ([7849c03](https://github.com/event4u-app/agent-config/commit/7849c03f282cdaf344ac56056d55cb1c63e17eba))

### Tests

* **mcp:** L3 — hermetic shape contracts for 7 RO tools ([0d3edc9](https://github.com/event4u-app/agent-config/commit/0d3edc9fb1f98df80a4eb503a0dd4c868d2f85f2))
* **mcp:** J5 — acceptance tests for catalog, envelope, telemetry ([806e4bb](https://github.com/event4u-app/agent-config/commit/806e4bb2bdd2292dfb75eddd9b4eff6073f16a00))

### Chores

* **mcp/taskfile:** add mcp:cloud:secret-put task ([dcffef5](https://github.com/event4u-app/agent-config/commit/dcffef5c384bf75261189b035417593418c8c36c))
* **roadmap:** flip Phase 2 + Phase 3 of road-to-mcp-full-coverage ([2ce23bc](https://github.com/event4u-app/agent-config/commit/2ce23bcaf7482aeb095cc85d106a78ac5c0d2682))
* **roadmap:** flip Phase 1 of road-to-mcp-full-coverage (J1–J6) ([707f5c0](https://github.com/event4u-app/agent-config/commit/707f5c002f827b2600cfcf6019d3d22166b46fc2))
* **ci:** regenerate derived artifacts and fix command-count drift ([dd4eeac](https://github.com/event4u-app/agent-config/commit/dd4eeac96094d99bae318b2160a914be46caead9))
* **roadmaps:** archive road-to-portable-dev-preferences ([77f4cf1](https://github.com/event4u-app/agent-config/commit/77f4cf1825962503891973800450c3ca769e2adc))

Tests: 3173 (+32 since 1.40.0)

## [1.40.0](https://github.com/event4u-app/agent-config/compare/1.39.0...1.40.0) (2026-05-11)

### Features

* **settings:** add worktrees.mode (off/on/ask) to gate autonomous worktree usage ([a07080f](https://github.com/event4u-app/agent-config/commit/a07080f28113dfa2452830b660deb4cb467256ec))
* **commands:** add /sync-gitignore:fix subcommand for legacy cleanup ([5b058b0](https://github.com/event4u-app/agent-config/commit/5b058b0a8a5b451eac89c4905076e4cc9773e299))
* **audit:** add pattern-extraction script for audit-log-v1 (roadmap Q2) ([966e472](https://github.com/event4u-app/agent-config/commit/966e47215eb80cfff6e2229b90c6e28b806c7dff))
* **learning-skill:** wire audit-log-v1 into learning-to-rule-or-skill (roadmap Q3) ([f53d129](https://github.com/event4u-app/agent-config/commit/f53d12947b41334c58952b3a6017962507abbe45))
* **orchestrate:** add /orchestrate command + state machine (roadmap G2) ([4b39691](https://github.com/event4u-app/agent-config/commit/4b396910c0c7078430aa11958f121d49ddda766c))
* **contracts:** add orchestration-dsl-v1 + linter (roadmap G1) ([5cb2801](https://github.com/event4u-app/agent-config/commit/5cb2801f14a06d2dabe9f2dc57b7ca424d7e4d4d))
* **contracts:** add audit-log-v1 schema (roadmap Q1) ([e0849b2](https://github.com/event4u-app/agent-config/commit/e0849b2305949ad5409ff9981970922ec702c68e))
* **install:** one-liner setup.sh + npm wrapper refinements ([aee688f](https://github.com/event4u-app/agent-config/commit/aee688fcbf9bb18b0253bc7ce96192cc7e5afe2e))
* **compress:** project Cursor .mdc + Windsurf .md rules + flatten commands ([486bafd](https://github.com/event4u-app/agent-config/commit/486bafd83c1f5224ee61b29b46cc827b21440623))
* **install:** multi-tool installer + global user-level install ([6113872](https://github.com/event4u-app/agent-config/commit/6113872b146321b784b01a428c5c2abcbad9e08d))

### Bug Fixes

* **ci:** bump README command count and exclude projection dirs from skill-lint ([c5a1493](https://github.com/event4u-app/agent-config/commit/c5a1493d4ef31b2e9af16e0945330cccaa02576c))
* **clusters:** register /orchestrate as new cluster head ([fb73e58](https://github.com/event4u-app/agent-config/commit/fb73e58c7eb72d53e6ee111a18fe8f5a1f1e053b))
* **roadmap:** annotate council reference with allowed-marker ([e2997d0](https://github.com/event4u-app/agent-config/commit/e2997d00b5e7dc2625367f87dab3bc611b9cf8e5))
* **readme:** unlink experimental mcp-cloud-scope contract ([c7ac883](https://github.com/event4u-app/agent-config/commit/c7ac883be116e6f92f2125d5334f38f17b97da27))

### Documentation

* bump command count to 105 for /orchestrate ([df49c6c](https://github.com/event4u-app/agent-config/commit/df49c6c268e08df7567128c97cc267fed9e38694))

### Refactoring

* **roadmap:** apply council shape-fix to distribution roadmap ([4c7f770](https://github.com/event4u-app/agent-config/commit/4c7f770d66b07107164c2eafcc886ddf6bf29aa6))
* **distribution:** extract marketplace listings to docs/DISTRIBUTION_CHECKLIST.md ([5fc6075](https://github.com/event4u-app/agent-config/commit/5fc607567a96bc5e3d9a38d276ce85f88dae7015))
* **roadmap:** move S33 (screencasts) to distribution roadmap H5 ([95d27f6](https://github.com/event4u-app/agent-config/commit/95d27f65b577824d9c330478af5c7c7acddfe9f3))

### Chores

* **ownership:** regenerate ownership matrix for new files ([f728343](https://github.com/event4u-app/agent-config/commit/f728343cd4bc9a7340bb19a218d1ccdc6b5bfb9e))
* **index:** tag orchestrate command with cluster in catalogs ([c4ed9ee](https://github.com/event4u-app/agent-config/commit/c4ed9ee9eaca972bc35549330131c98dd6b05966))
* **index:** regenerate catalog for /orchestrate command ([c6fe13a](https://github.com/event4u-app/agent-config/commit/c6fe13ae9d83e142154226235bf65d1d2f72cacd))
* **roadmaps:** regen dashboard after distribution-roadmap shape-fix ([e0ad5b3](https://github.com/event4u-app/agent-config/commit/e0ad5b3554d34a4eaaf747b0955cc16e32f5c8e2))
* **roadmaps:** archive road-to-simplicity-and-everywhere + regen dashboard ([d2d5c31](https://github.com/event4u-app/agent-config/commit/d2d5c310db1ec8fd3cd44111400b098c4d99c856))

Tests: 3141 (+442 since 1.39.0)

## [1.39.0](https://github.com/event4u-app/agent-config/compare/1.38.0...1.39.0) (2026-05-11)

### Features

* **onboard,docs:** wire user-global DX defaults into onboarding + docs ([761a969](https://github.com/event4u-app/agent-config/commit/761a96979c42b880d83f72ccd2ac2d752ae47f0b))
* **settings:** add centralized agent-settings loader ([d5699be](https://github.com/event4u-app/agent-config/commit/d5699bee9ebb47dd2f1d78716e1ff84a7139b5da))

### Bug Fixes

* **ci:** grant contents:write to deploy-mcp-worker for release comment ([fb5c895](https://github.com/event4u-app/agent-config/commit/fb5c89537daef55e5dde12bfe85cc703bfa181ed))

### Documentation

* **roadmap:** add road-to-simplicity-and-everywhere (highest prio) ([417a8fa](https://github.com/event4u-app/agent-config/commit/417a8fa9b7059dac783d3bc9423c64a994a9421a))
* **roadmap:** add road-to-mcp-full-coverage (Discovery-First) ([fabf897](https://github.com/event4u-app/agent-config/commit/fabf89761322a437b39178366e45f68efbdd7924))
* **mcp-cloud:** clarify Lite-vs-Full scope at endpoint surface ([97c4684](https://github.com/event4u-app/agent-config/commit/97c4684d07be4fe49c248a1ee0a60cd36b82e071))
* **stability:** align public surface with stability markers ([d9afe4a](https://github.com/event4u-app/agent-config/commit/d9afe4ad67aad80e2bb12b1c707189f3ee8f47c2))
* **mcp:** clarify .agent-settings.yml vs. MCP client config ([27a77b2](https://github.com/event4u-app/agent-config/commit/27a77b2459cad1faff12cd8a237e59091ec687de))
* **mcp:** add per-client setup guide for hosted Remote MCP ([179da38](https://github.com/event4u-app/agent-config/commit/179da38631ea9693a94f259fb1edd2746b89425d))

### Refactoring

* **work-engine:** centralize agent-settings loading in shared _lib ([3c548bb](https://github.com/event4u-app/agent-config/commit/3c548bb72d3c2022362050a4c88ebe412bf7a897))

### Chores

* **compress:** regenerate commands/onboard.md after onboard,docs source edit ([e676915](https://github.com/event4u-app/agent-config/commit/e67691564405f05fba033f29b0df696e25788dd0))

### Other

* add portable-dev-preferences (3 phases, refined via AI council) ([7468a4c](https://github.com/event4u-app/agent-config/commit/7468a4cd2d352d6bfcd7797a8dd8b6ed8ec8f27a))

Tests: 2699 (+20 since 1.38.0)

## [1.38.0](https://github.com/event4u-app/agent-config/compare/1.37.0...1.38.0) (2026-05-11)

### Features

* **mcp:** add cloud setup tasks + operator README ([c5aebba](https://github.com/event4u-app/agent-config/commit/c5aebba37a608d0a41b1586acacdb055996a961d))
* **scripts:** MCP content packer + cloud parity smoke ([e0d132a](https://github.com/event4u-app/agent-config/commit/e0d132afb487b720386bd54b68e10f1a342d6b0c))

### Documentation

* **readme:** surface hosted Remote MCP as zero-install option ([de6161e](https://github.com/event4u-app/agent-config/commit/de6161e3660b81a460f057bc46c1b75e6fe8693c))
* **mcp:** add A0-cloud invariant 8 — ingress protection via edge cache + platform rate-limit ([c4b9371](https://github.com/event4u-app/agent-config/commit/c4b9371da2db55958bca29a7d10291626d13782f))
* **mcp:** drop archived-roadmap refs from stable contracts ([15418de](https://github.com/event4u-app/agent-config/commit/15418de5a65c3cd5968bbeecc20ed5ad5c4a4958))
* **mcp:** surface experimental hosted-MCP channel ([cecae08](https://github.com/event4u-app/agent-config/commit/cecae08ad647c7e28931e7328047fdef5ca3d3a3))
* **setup:** MCP cloud endpoints, R2 bootstrap, registry listing ([7cb3341](https://github.com/event4u-app/agent-config/commit/7cb334110ff940d3703ada013ef5163c899d96b2))
* **mcp:** add A0-cloud contract + cross-links (Phase 1 of cloudflare-mcp-hosting) ([2fc5084](https://github.com/event4u-app/agent-config/commit/2fc50845c3b194e861b54f82c852ba4bb9fc406a))
* **roadmap:** add Cloudflare-hosted MCP roadmap, archive distribution ([fd1c437](https://github.com/event4u-app/agent-config/commit/fd1c437ea8a918eebc8604ee7958d8c842c7aac8))

### CI

* **deploy-mcp-worker:** release-tag triggered Worker deploy ([4297514](https://github.com/event4u-app/agent-config/commit/4297514b80457852511ad90674f4d633a75a92bf))

### Chores

* **linter:** raise README overloaded threshold to 750 lines ([1e3fbb7](https://github.com/event4u-app/agent-config/commit/1e3fbb7c649398ba56bc32677c7b588131f7e949))
* **mcp:** mark dev content.json stub with explanatory _comment ([8f6c7ff](https://github.com/event4u-app/agent-config/commit/8f6c7ffe493b72ccb2d0ec66121a9d32d0b2fe8c))
* **roadmap:** archive road-to-cloudflare-mcp-hosting (100% complete) ([99e07f9](https://github.com/event4u-app/agent-config/commit/99e07f92293e62841ff87f315e41c5ceabd7b277))
* **workers/mcp:** scaffold TypeScript Cloudflare Worker ([447e071](https://github.com/event4u-app/agent-config/commit/447e071984f86fc084058d05f22d0e0a7c936a5e))

Tests: 2679 (+0 since 1.37.0)

## [1.37.0](https://github.com/event4u-app/agent-config/compare/1.36.1...1.37.0) (2026-05-10)

### Features

* **mcp:** add Phase 6 F3 stdio Docker bundle ([acd5e47](https://github.com/event4u-app/agent-config/commit/acd5e47a56b9fb42f57751771087c6b73759d3d5))
* **mcp:** add Phase 6 F1 identity metadata ([f4700ff](https://github.com/event4u-app/agent-config/commit/f4700ff1f093611220c08fba75c29d12ed57110c))
* **mcp:** add Phase 4 tool layer with lint_skills and chat_history_append ([fe02108](https://github.com/event4u-app/agent-config/commit/fe0210817e46f4d1710b0d96b7a176c872fc5545))
* **cli:** expose mcp:setup + mcp:run via ./agent-config ([bf7ff65](https://github.com/event4u-app/agent-config/commit/bf7ff65ab040b482d5f4e716a78148e95ba3bc7f))
* **mcp:** expose rules, guidelines, contexts as resources ([21d85c5](https://github.com/event4u-app/agent-config/commit/21d85c5142a35dade1129f835821c72944442ead))
* **mcp:** full skill + command coverage with pagination + hot-reload ([126c976](https://github.com/event4u-app/agent-config/commit/126c976f30e7bf3b714f8b72131b53fcc3e07878))
* **mcp:** add experimental stdio MCP server exposing 5 stack-agnostic skills ([8e692cf](https://github.com/event4u-app/agent-config/commit/8e692cfbdc14e67f178b11068773d50dd199b4ab))

### Bug Fixes

* **agents-md:** revert MCP pointer to keep root under 3000-char cap ([02bed8e](https://github.com/event4u-app/agent-config/commit/02bed8edb13fdcae369bac3843a836c01dc04248))
* **lint:** emit valid JSON when no skill/rule files changed ([caef1cb](https://github.com/event4u-app/agent-config/commit/caef1cb91def6089cad3ba3d2fd7c728b39731d0))
* **mcp:** relocate Phase 1 smoke transcript out of agents/roadmaps/ ([addd7c2](https://github.com/event4u-app/agent-config/commit/addd7c2ac4aa7a6527fb9e750ed38d02f1cd51bc))
* **mcp:** drop roadmap link from Phase 1 scope contract ([ca3c2e8](https://github.com/event4u-app/agent-config/commit/ca3c2e89b6c5ebf06cbc6a55883cf3cf1fbd015a))

### Documentation

* **contracts:** amend MCP scope contract for Phase 6 F1 + F3 ([45989c5](https://github.com/event4u-app/agent-config/commit/45989c53d6c9b361ad29b4214984db6cff8f5b5f))
* **contracts:** amend MCP scope contract for Phase 4 tool allowlist ([87c9622](https://github.com/event4u-app/agent-config/commit/87c9622d165d783a5b1f8c266035791cafbf3ab9))
* **roadmap:** mark MCP Phase 3 + Phase 5 done ([9ec9494](https://github.com/event4u-app/agent-config/commit/9ec9494be18b6634dcf4383af921b54f283c86ff))
* **mcp:** canonical MCP server setup guide ([4fd149f](https://github.com/event4u-app/agent-config/commit/4fd149f0b1c6e6b009d2bdd3b4ea80759e31055d))
* **roadmap:** mark MCP Phase 2 (B1-B5) done + extend scope contract ([5ea1c56](https://github.com/event4u-app/agent-config/commit/5ea1c56d027f432f9c950e8b35805ab91758fd26))
* **roadmap:** mark MCP Phase 1 (A1–A7) done + record stdio smoke transcript ([aaf8332](https://github.com/event4u-app/agent-config/commit/aaf833292aba530bdeae138fa2255b4576fe699c))
* **mcp:** add Phase 1 scope contract (experimental, read-only) ([2fa275e](https://github.com/event4u-app/agent-config/commit/2fa275eec70c02741b76abef2b6356c7d0d1c6a7))

### Tests

* **mcp:** cover Phase 6 F1 identity metadata ([d3f79ef](https://github.com/event4u-app/agent-config/commit/d3f79eff30f61914fe09667693b41e2ed8c29855))
* **mcp:** cover Phase 4 tool layer ([217c4ab](https://github.com/event4u-app/agent-config/commit/217c4ab2ed1041006e1ac3102369b8c1569f3653))
* **mcp:** cover Phase 2 — full coverage, pagination, hot-reload ([f93c019](https://github.com/event4u-app/agent-config/commit/f93c0199adc558119be614fadd677cf37c8c2d5a))
* **mcp:** make loader tests run when mcp SDK is absent ([8378621](https://github.com/event4u-app/agent-config/commit/8378621be8ec24ccba59be10c49a4384abdc335f))
* **mcp:** cover Phase 1 loader + import-surface guard + server handlers ([f4fee8b](https://github.com/event4u-app/agent-config/commit/f4fee8b899b0163ea2bfe7099ffa9221b70bf488))

### Chores

* **roadmap:** close road-to-mcp-server at 100%, defer F4 to distribution ([0127991](https://github.com/event4u-app/agent-config/commit/01279913f3b2a5caa1eb65f8a7b07a2f841d41af))
* **roadmap:** defer Phase 6 F2 to road-to-mcp-distribution ([b5e0be7](https://github.com/event4u-app/agent-config/commit/b5e0be7473296bfd5381dc1ace9bc99ae79f5090))
* **roadmap:** mark MCP Phase 4 (D1-D4) complete ([8c342c8](https://github.com/event4u-app/agent-config/commit/8c342c8508f17133d71528b16d727d5c3c56acfd))
* **mcp:** add task mcp:setup for one-line install ([ae1f6f9](https://github.com/event4u-app/agent-config/commit/ae1f6f9d355dd5a782fdadb5e67929552caab5ed))
* ignore .venv-mcp/ for MCP server work ([8bd44d4](https://github.com/event4u-app/agent-config/commit/8bd44d49e359021a000a989bfd7ae7f6f48800db))

Tests: 2679 (+58 since 1.36.1)

## [1.36.1](https://github.com/event4u-app/agent-config/compare/1.36.0...1.36.1) (2026-05-10)

### Refactoring

* **scope-control:** extract roadmap-shape, kernel-rule-edits, fenced-step detail to scope-mechanics ([e52c834](https://github.com/event4u-app/agent-config/commit/e52c834a672e6f24b1b7c1608e481b7f45a46054))

### Chores

* **generate-tools:** regenerate .windsurfrules for scope-control extraction ([ee7664e](https://github.com/event4u-app/agent-config/commit/ee7664ee6cd0ec5aacdf95b5e4ec1000e01a0121))

Tests: 2621 (+0 since 1.36.0)

## [1.36.0](https://github.com/event4u-app/agent-config/compare/1.35.0...1.36.0) (2026-05-10)

### Features

* **commands:** tier-0 surfacing on /memory:load and ts_week on /memory:promote ([85f4b63](https://github.com/event4u-app/agent-config/commit/85f4b63dc792488ba60af4da2b09d4fcaa58506c))
* **memory:** add priority enum validator and tier-0 stale checks ([5d61328](https://github.com/event4u-app/agent-config/commit/5d61328fa1bc1ac38d9acb98a9f97d2dc0dab4a7))
* **memory:** consolidation skill + /memory:mine-session + intake review hook ([7037a45](https://github.com/event4u-app/agent-config/commit/7037a45b2e63193a3289622784093f522c578158))

### Bug Fixes

* **check-refs:** skip agents/council-responses/ like council-sessions/ ([d18551e](https://github.com/event4u-app/agent-config/commit/d18551e896d747533f2aa4465b390b291c931c4a))
* **check-refs:** skip agents/council-responses/ like council-sessions/ ([4faf5f8](https://github.com/event4u-app/agent-config/commit/4faf5f82c380222281b38213c38399187757840b))
* **scope-control:** trim authoring section to fit kernel ceiling ([b436d0a](https://github.com/event4u-app/agent-config/commit/b436d0a8840b0498688ed9efe28eb76bbfc08a5a))
* **roadmap:** suppress council-reference lint on dream-skill roadmap ([c355ca5](https://github.com/event4u-app/agent-config/commit/c355ca5d8b4e7e5f181f31efe057e2c0d5ff63eb))

### Documentation

* **roadmap:** close out dream-skill adoption — Phase 3 cancelled-deferred, archive ([63bedd0](https://github.com/event4u-app/agent-config/commit/63bedd02c7686e183acadebff742423ab0c258a6))
* **roadmap:** mark Phase 2 partial shipped, B1 + Phase 3 deferred with rationale ([620d7f0](https://github.com/event4u-app/agent-config/commit/620d7f09372b866659f0a41f1690fdab904777bb))
* **memory:** document priority enum and ts_week jitter convention ([f9f65d4](https://github.com/event4u-app/agent-config/commit/f9f65d4d9d699d7b65c496745e440f3fa7de1c54))

### Chores

* **roadmap:** mark Phase 1 of dream-skill adoption complete ([b46ce4c](https://github.com/event4u-app/agent-config/commit/b46ce4ca7737fd9f4d29692837680023d3fbf68d))
* **meta:** regenerate ownership matrix after scope-control trim ([db14110](https://github.com/event4u-app/agent-config/commit/db14110b0aebf9acc178cd997d1e11d0d91fd382))
* **meta:** regenerate ownership matrix ([a23604e](https://github.com/event4u-app/agent-config/commit/a23604ef031daf0ec5e9dfdce30baf3c0293340d))
* **rules:** harden against unsolicited implementation + horizon opt-in ([00b5fa9](https://github.com/event4u-app/agent-config/commit/00b5fa96b93b41943559c4dac775069a2e14b0e3))

Tests: 2621 (+15 since 1.35.0)

## [1.35.0](https://github.com/event4u-app/agent-config/compare/1.34.0...1.35.0) (2026-05-10)

### Features

* **personas:** add three Wave-2 specialist personas ([fafe78c](https://github.com/event4u-app/agent-config/commit/fafe78cd1d6ec4aa7edb9e6ebbe8bc61f661818d))
* **skills:** add four senior product/strategy skills ([35e399d](https://github.com/event4u-app/agent-config/commit/35e399d4a805217d4e01a70b8795583eb11b046e))
* **skills:** promote decision-record and stakeholder-tradeoff to tier:senior ([dec2369](https://github.com/event4u-app/agent-config/commit/dec2369ec8e273b29d701ba72c9283b47d545732))
* **lint:** enforce context_spine slot citation in skill bodies ([2283472](https://github.com/event4u-app/agent-config/commit/22834723003ce515f6067ec228f273e13bf71cb2))
* **lint:** detect plate/horizon convention in lint-roadmap-complexity ([8dcd6c1](https://github.com/event4u-app/agent-config/commit/8dcd6c1c4d9f772df2495e114a1b1a03c64022dc))
* **personas:** upgrade product-owner to senior specialist ([e46fdad](https://github.com/event4u-app/agent-config/commit/e46fdadfd9645de6f07ee7516d265760f739ba73))
* **skills:** add senior customer-research and release-comms ([fb17b8f](https://github.com/event4u-app/agent-config/commit/fb17b8f1641cd26ceeb405537711bacd1059317d))
* **contracts:** add context-spine, mental-models, and cross-role-handoff ([a8bd106](https://github.com/event4u-app/agent-config/commit/a8bd106e77a092da385461aec508a8959179559d))

### Bug Fixes

* **skills:** cite team spine slot in customer-research ([9279606](https://github.com/event4u-app/agent-config/commit/9279606fedc60377306c80a14c6379577233ce3d))
* **skill:** drop unused 'team' slot from customer-research context_spine ([e581c66](https://github.com/event4u-app/agent-config/commit/e581c664237f23c9804bce95fd0e8436d33d8bec))
* **context-spine:** drop transient roadmap references ([a2e17c7](https://github.com/event4u-app/agent-config/commit/a2e17c7ef287b89a92aa296f8eb519ced78e3dcd))

### Chores

* **sync:** refresh compression hashes after main merge ([2689a99](https://github.com/event4u-app/agent-config/commit/2689a9959c0d8f5bb0b00a8b4cbc73485b81086d))
* **generate-tools:** register new skills + personas in distribution layers ([1c8081d](https://github.com/event4u-app/agent-config/commit/1c8081d54b14214ac5163986784af1f4e505aa7d))
* **roadmap:** archive road-to-unified-senior-roles, refresh dashboard ([0f7a203](https://github.com/event4u-app/agent-config/commit/0f7a203c9f3a6cb97837db52906fa7bd6ff9134a))
* **sync:** refresh compression hash for customer-research ([5296bd1](https://github.com/event4u-app/agent-config/commit/5296bd13976e105ff128a90de05de78183745f67))
* **sync:** refresh compression hashes after roadmap-plate removal ([75d06e1](https://github.com/event4u-app/agent-config/commit/75d06e1ec33d9472fd8ae4a08f5efd526b577905))
* **roadmaps:** strip plate/horizon framing from 7 active roadmaps ([186f98e](https://github.com/event4u-app/agent-config/commit/186f98e8fa3405927e5543c41f4ce797b46eaedf))
* **infra:** drop horizon-marker handling from process-loop and process-full ([9f9b968](https://github.com/event4u-app/agent-config/commit/9f9b9681f9b9d21305a69e3c413dc4b8ff7d5a9a))
* **template:** forbid time-boxed plates in roadmap template (rule 16) ([12748c2](https://github.com/event4u-app/agent-config/commit/12748c2e3354e324b2d4b889ecda5655f3286738))
* **ownership:** regenerate ownership matrix ([33d3775](https://github.com/event4u-app/agent-config/commit/33d37755e4af051df73cfae6b6c6ccc4981202e1))
* **sync:** regenerate counts, hashes, and roadmap progress ([e4397f8](https://github.com/event4u-app/agent-config/commit/e4397f83bf5c5b10c47f926a4eb605d8e6074063))

Tests: 2606 (+0 since 1.34.0)

## [1.34.0](https://github.com/event4u-app/agent-config/compare/1.33.0...1.34.0) (2026-05-10)

### Features

* **skills:** block D — eval gate runner + ADR-006 pilot pass (D5) ([afbc4fb](https://github.com/event4u-app/agent-config/commit/afbc4fb6c23949df56376e40b3f0bdda12ee70b5))
* **skills:** block D — discovery story trio score/audit/suggest (D2-D4) ([f79ff00](https://github.com/event4u-app/agent-config/commit/f79ff005555d84ca84aa5bda8dc4370547a135e9))
* **skills:** block D — lint_skill_tools meta-linter + CI gate (D1) ([eff36a6](https://github.com/event4u-app/agent-config/commit/eff36a6a254dda61e8639c5d2a6782c0144ebb6c))
* **skills:** block F UI engineers — tailwind, a11y, form-handler (F2, F3, F6) ([fb6c20a](https://github.com/event4u-app/agent-config/commit/fb6c20a6cbe2e4b6c7dc2f64ab8cad837a3a985a))
* **skills:** block F UI architects — livewire, playwright, ui-component (F1, F4, F5) ([eeb0eaa](https://github.com/event4u-app/agent-config/commit/eeb0eaaebaf70d7efaba28057f70342745cd623d))
* **skills:** block C architecture-review-lens — 5th judge in /review-changes (C8) ([197de6b](https://github.com/event4u-app/agent-config/commit/197de6b9687ee69803f53e13bdb9528aa95f4123))
* **skills:** block C ops/risk — risk-officer, incident-commander, migration-architect (C2, C5, C6) ([24252f6](https://github.com/event4u-app/agent-config/commit/24252f6d754e4b5cdc9a98fd7afc2eaee225d4fb))
* **skills:** block C product/discovery — po-discovery, decision-record, stakeholder-tradeoff, tech-debt-tracker (C1, C3, C4, C7) ([01a2725](https://github.com/event4u-app/agent-config/commit/01a27256ef175f4f25cde50f1d7b8a3d079855d3))
* **personas:** discovery surface + public catalog (A5, A6) ([d905639](https://github.com/event4u-app/agent-config/commit/d9056397f4ce687aad65a8fdb75c100ef1d90c01))
* **orchestration:** subagent mode 7 — do-in-worktrees competitive (A7) ([fa01033](https://github.com/event4u-app/agent-config/commit/fa0103303eaca0db1722a167e788c3a11b2f7ca7))
* **skills:** cite specialist personas from 9 existing skills (A4) ([d123ac6](https://github.com/event4u-app/agent-config/commit/d123ac6608cf96e0971b3c71e06723e50a6f19fe))
* **personas:** add 4 specialist personas + qa migration (A3) ([ec19dc5](https://github.com/event4u-app/agent-config/commit/ec19dc579cf69879c5fe339eb6f3d7eee6cf314d))
* **personas:** lock specialist schema + extend linter (A1, A2) ([79a9ea2](https://github.com/event4u-app/agent-config/commit/79a9ea21202ded3ba848b1e18bf041fecef127c3))
* **skills:** block B — lock 6-domain taxonomy + back-fill 153 skills ([dfc70fd](https://github.com/event4u-app/agent-config/commit/dfc70fdf8bf97ec30d53a3c81d0b5c4bb61291a9))

### Bug Fixes

* **test:** disable retention pruning in council save() artefact test ([e04de7d](https://github.com/event4u-app/agent-config/commit/e04de7d037e3dbfe7a96cf05369d6940e27298b0))
* **refs:** post-archive ref fixes for road-to-better-skills + ADR-006 council carve-out ([b8922b7](https://github.com/event4u-app/agent-config/commit/b8922b736d40e370e1eef67500d752a028d7b1bf))

### Chores

* **skills:** clear missing_inspect_step + weak_output_format on Block-C/F skills ([07a72b3](https://github.com/event4u-app/agent-config/commit/07a72b3f91792e99c3acb7e3448f31b7cff7df0a))
* **hooks:** gate command-count drift in pre-push ([7b0ff9e](https://github.com/event4u-app/agent-config/commit/7b0ff9e175bb59a9c4ca404f9b4b62149e2e8008))
* **roadmap:** close road-to-better-skills-and-profiles (Block D pass, B4 deferred) ([f5d7170](https://github.com/event4u-app/agent-config/commit/f5d7170a8c5947be273089839f99aab6dc56a693))
* **matrix:** regenerate file-ownership-matrix for block F skills ([83ad6a7](https://github.com/event4u-app/agent-config/commit/83ad6a777469ca0efe2da01a4d0173181356bbf1))
* **catalog:** regenerate index + catalog for block F ([bd57d56](https://github.com/event4u-app/agent-config/commit/bd57d56d9226d2a60658dbac2b8d4b82bf48b519))
* **sync:** refresh compression-hashes + marketplace for block F ([b45b8a9](https://github.com/event4u-app/agent-config/commit/b45b8a9cef1e74e1ee88f164f5f0cc6e92565fbc))
* **roadmap:** close block F — flip F1-F6 + F marker to done ([e4bd5cc](https://github.com/event4u-app/agent-config/commit/e4bd5cca56e2f30234bc7833ce3650ccbe1634d8))
* **roadmap:** flip Block C marker to done — 8 skills + 5th judge integrated ([cfd3ede](https://github.com/event4u-app/agent-config/commit/cfd3ede2cf3846570e410209df1ae18b96db2d18))
* **matrix:** regenerate file-ownership-matrix for Block C skills ([ad89c8f](https://github.com/event4u-app/agent-config/commit/ad89c8fbb50c7bfa7b7031a21e522d5dd582c2a8))
* **catalog:** regenerate index + catalog for Block C skills ([cfe94a5](https://github.com/event4u-app/agent-config/commit/cfe94a54d1ec448eabc4afa0810beb81e52471f0))
* **sync:** refresh compression-hashes for review-changes after Block C ([c56dbe2](https://github.com/event4u-app/agent-config/commit/c56dbe25085255a2fb8b5cd85f75d8e471792137))
* **roadmap:** close block C — flip C1-C8 to done, refresh counts ([954a2fd](https://github.com/event4u-app/agent-config/commit/954a2fd6205e493efd22619c73f8ff7f30b9121b))

Tests: 2606 (+46 since 1.33.0)

## [1.33.0](https://github.com/event4u-app/agent-config/compare/1.32.0...1.33.0) (2026-05-09)

### Features

* **commands:** port /research:deep + /research:report as cluster sub-commands ([71f8141](https://github.com/event4u-app/agent-config/commit/71f8141a3c553ee5b35f31ffdd7ab33e9cb110e5))
* **guidelines:** port 5w2h, six-hats, systems-thinking, first-principles, critical-thinking from ginobefun ([40ea866](https://github.com/event4u-app/agent-config/commit/40ea8662f4e7714aa66348aff5456b53a3045350))

### Bug Fixes

* **roadmap:** inline council convergence summary instead of file ref ([1087cab](https://github.com/event4u-app/agent-config/commit/1087cab557c12fb353cb7a3e5ac7ab27a8d19379))
* **research:** add ## Rules section to cluster head ([044bdab](https://github.com/event4u-app/agent-config/commit/044bdabd82b2b16350277f3f7b5e1b0e50703242))
* **research:** collapse ADOPT citation paths into repo@sha:path tokens ([54deb0d](https://github.com/event4u-app/agent-config/commit/54deb0ddcf201ecbeecf6a57c1074d904fb2d197))

### Documentation

* **counts:** bump command count 101→103 in README + getting-started ([f2fb002](https://github.com/event4u-app/agent-config/commit/f2fb0026c803819569c0c739fdbad8addd96928a))
* **roadmap:** refresh counts and progress for deep-research adoption phase 2 ([2c284cd](https://github.com/event4u-app/agent-config/commit/2c284cd431480e9c2ae39ec70132a1f8d5eb6e59))

### Chores

* **roadmap:** close road-to-feedback-followups (P0-P3+P5 done, P4 deferred) ([b07db6c](https://github.com/event4u-app/agent-config/commit/b07db6cae705a1e372ed9b75e47d2b14f8447b18))
* **roadmap:** cancel road-to-event-driven-discipline (skipped, 0% executed) ([590f27d](https://github.com/event4u-app/agent-config/commit/590f27d8c7239431df92e1b7e003837c6e0be178))
* **roadmap:** close road-to-deep-research-adoption (P1+P2 done, P3 dropped) ([d2a8808](https://github.com/event4u-app/agent-config/commit/d2a880836d79f13efefe6b3257a2ac869e6c9697))
* **ownership:** regenerate file-ownership matrix for research cluster ([e90f886](https://github.com/event4u-app/agent-config/commit/e90f8861a356e51dbb7bce8baf5c2d8e53732bd2))

Tests: 2560 (+0 since 1.32.0)

## [1.32.0](https://github.com/event4u-app/agent-config/compare/1.31.0...1.32.0) (2026-05-09)

### Features

* **roadmap:** bite-sized task granularity gate for structural roadmaps ([b23683d](https://github.com/event4u-app/agent-config/commit/b23683df15dd43229a25cad33882f6a692d92a97))
* **skills:** add 3-scan self-review to planning skills ([6784fb8](https://github.com/event4u-app/agent-config/commit/6784fb8ad355ef5b2d7f2cebe5d5e26f114cbe4a))
* **subagent-orchestration:** status taxonomy + externalized prompts + two-stage mode ([6d846a7](https://github.com/event4u-app/agent-config/commit/6d846a74441196b98cabf8cd1c18ca40db0cec89))
* **skills:** TDD hardening with externalized anti-pattern catalogue ([db2b1a2](https://github.com/event4u-app/agent-config/commit/db2b1a2a550f10fa51742bef360044b9de1bb7ca))

### Bug Fixes

* **investigation:** inline council convergence (council files gitignored) ([ff93aa7](https://github.com/event4u-app/agent-config/commit/ff93aa7ee6f6cffff062838a644047470e1d462e))
* **skills:** inline council convergence in anti-patterns provenance ([7d7e663](https://github.com/event4u-app/agent-config/commit/7d7e663f8e619882fd59465dfbfdb268132eeb8d))
* **skills:** drop roadmap reference from anti-patterns provenance ([a49c010](https://github.com/event4u-app/agent-config/commit/a49c0107971a5b70a1fdf33ed1a19c91d075980a))

### Chores

* **ownership:** regenerate matrix after superpowers-harvest landing ([faf4794](https://github.com/event4u-app/agent-config/commit/faf479470db9c83d17e8332dd3498df1e5f4c34b))
* **index:** regenerate after superpowers-harvest landing ([946f3cc](https://github.com/event4u-app/agent-config/commit/946f3ccad54da3a3898d0aeb4474be0b87e66800))
* **roadmap:** remove old roadmap path (already archived) ([18f281b](https://github.com/event4u-app/agent-config/commit/18f281bbeb51e93feef40146af3a3b5e5cb916f2))
* **roadmap:** close superpowers-harvest — Phase 1 LANDED, P1.4b deferred ([a296106](https://github.com/event4u-app/agent-config/commit/a296106c6a846a54c3fe20728203fb3bbae7fffc))

Tests: 2560 (+74 since 1.31.0)

## [1.31.0](https://github.com/event4u-app/agent-config/compare/1.29.0...1.31.0) (2026-05-09)

### Features

* **chat-history:** cross-agent hardening — smoke isolation + multi-agent attribution ([b215b8f](https://github.com/event4u-app/agent-config/commit/b215b8f05bef439a95be9cc11c35d22f888696d1))
* consolidate agent-doc commands into frequency-weighted surface ([9ce7476](https://github.com/event4u-app/agent-config/commit/9ce74764edfe2b6474311d3c8f01f3ac8018378c))
* capability-over-structure for AGENTS.md (anatomy + linter + /optimize:agents-md) ([309042d](https://github.com/event4u-app/agent-config/commit/309042d8d15b3c13e9a70fe160d52208fe33ef98))
* **release:** inject test-count trend into changelog footer ([3476186](https://github.com/event4u-app/agent-config/commit/347618644a658eda45003271f8da8b1c36097089))
* **linter:** exempt cluster-head commands from no_steps; recognize ### Step N ([ad66bf0](https://github.com/event4u-app/agent-config/commit/ad66bf0001ef4acd2be662591b673e1e2822e83a))

### Bug Fixes

* **readme:** drop stale deprecation-shim sub-line; trim to 500-line cap ([5f92841](https://github.com/event4u-app/agent-config/commit/5f9284177323585ebb8b5fbca870f853c5c34ee0))
* **check-portability:** allowlist agents-md-anatomy.md for task-invocation detector ([3301d19](https://github.com/event4u-app/agent-config/commit/3301d193ba55e95cdab47d8e3288a524ce7b8b90))
* **ci:** sync compression hashes for governance + projection sections ([0fe814d](https://github.com/event4u-app/agent-config/commit/0fe814d7304ce8363b7a19e408fbb005aac67f05))
* **skills:** close 4 linter warnings on Microck-harvested skills ([dda7a81](https://github.com/event4u-app/agent-config/commit/dda7a8181aee3f20b4ce9910d66e45db51aff9ba))

### Documentation

* **guidelines:** add universal code-clarity guideline (inline single-use values) ([d11b6cb](https://github.com/event4u-app/agent-config/commit/d11b6cbe6f6a31e7ed01e0b224365e6830e4b385))
* **contributing:** add agent-assisted contribution workflow section ([0daf3b9](https://github.com/event4u-app/agent-config/commit/0daf3b9b89696780cb4c027fff7ce4be4dfa23a5))
* **roadmap:** decouple roadmaps from merge / commit steps ([40a64a0](https://github.com/event4u-app/agent-config/commit/40a64a0a31b31c05ca7de05a1a7b267634a53c7b))
* **roadmap:** close road-to-feedback-followups · agent-side complete ([efa4406](https://github.com/event4u-app/agent-config/commit/efa4406d4cc38cbcd3ebdb355c991da53d43a4c7))
* **skills:** governance-baseline + Claude-skill projection notes ([f9306e1](https://github.com/event4u-app/agent-config/commit/f9306e1f53c1f7ce735ba039ae22a8a0ebcc05b6))

### Refactoring

* **skills:** rename repomix → repomix-packer ([62eec15](https://github.com/event4u-app/agent-config/commit/62eec153f770ebf848f1dcf84b30c036001a63ef))

### Chores

* regenerate agents/index.md (drop stale copilot-agents shim row) ([fa9ca32](https://github.com/event4u-app/agent-config/commit/fa9ca323952b31a7a85177dca65c46a31dd0e931))
* **roadmap:** set archived chat-history roadmap status to LANDED ([a42f7a8](https://github.com/event4u-app/agent-config/commit/a42f7a86b6d49dc20f87e577574512a4c7fb5c00))
* **roadmap:** close chat-history-cross-agent-hardening ([5129c33](https://github.com/event4u-app/agent-config/commit/5129c3336bc647925ff3abb00344272b37b98433))
* retire /copilot-agents shim and clean up references ([295e3aa](https://github.com/event4u-app/agent-config/commit/295e3aa6f683263b9f5a8451bb94cb7468bfd00d))
* canonicalize Known False Positives section in copilot-instructions.md ([c1a20bd](https://github.com/event4u-app/agent-config/commit/c1a20bd474895974f442bc5d2545175d39021e1e))
* collapse editing-repo pointers in AGENTS.md to reclaim WARN headroom ([934800a](https://github.com/event4u-app/agent-config/commit/934800a6334e88494ffad37a3f5204e05bb60b1c))
* archive completed road-to-agent-command-consolidation roadmap ([829704b](https://github.com/event4u-app/agent-config/commit/829704b797cd10b79ce0b70cc9d1b14cd3ce5664))
* thin-root awareness for command-count gate; refresh doc counts ([6040c45](https://github.com/event4u-app/agent-config/commit/6040c4524ff84673adc8a403a2f6ab5e105b0af4))
* regenerate compressed sources and tool projections ([0e83fb9](https://github.com/event4u-app/agent-config/commit/0e83fb9a008c6d083c8c2d1a53e645abe2b2541c))

### Other

* 1.30.0 ([ee26092](https://github.com/event4u-app/agent-config/commit/ee26092f161cd5d5486f8aa859156bc30fae54f2))

Tests: 2486

## [1.30.0](https://github.com/event4u-app/agent-config/compare/1.29.0...1.30.0) (2026-05-09)

### Features

* consolidate agent-doc commands into frequency-weighted surface ([9ce7476](https://github.com/event4u-app/agent-config/commit/9ce74764edfe2b6474311d3c8f01f3ac8018378c))
* capability-over-structure for AGENTS.md (anatomy + linter + /optimize:agents-md) ([309042d](https://github.com/event4u-app/agent-config/commit/309042d8d15b3c13e9a70fe160d52208fe33ef98))
* **release:** inject test-count trend into changelog footer ([3476186](https://github.com/event4u-app/agent-config/commit/347618644a658eda45003271f8da8b1c36097089))
* **linter:** exempt cluster-head commands from no_steps; recognize ### Step N ([ad66bf0](https://github.com/event4u-app/agent-config/commit/ad66bf0001ef4acd2be662591b673e1e2822e83a))

### Bug Fixes

* **readme:** drop stale deprecation-shim sub-line; trim to 500-line cap ([5f92841](https://github.com/event4u-app/agent-config/commit/5f9284177323585ebb8b5fbca870f853c5c34ee0))
* **check-portability:** allowlist agents-md-anatomy.md for task-invocation detector ([3301d19](https://github.com/event4u-app/agent-config/commit/3301d193ba55e95cdab47d8e3288a524ce7b8b90))
* **ci:** sync compression hashes for governance + projection sections ([0fe814d](https://github.com/event4u-app/agent-config/commit/0fe814d7304ce8363b7a19e408fbb005aac67f05))
* **skills:** close 4 linter warnings on Microck-harvested skills ([dda7a81](https://github.com/event4u-app/agent-config/commit/dda7a8181aee3f20b4ce9910d66e45db51aff9ba))

### Documentation

* **guidelines:** add universal code-clarity guideline (inline single-use values) ([d11b6cb](https://github.com/event4u-app/agent-config/commit/d11b6cbe6f6a31e7ed01e0b224365e6830e4b385))
* **contributing:** add agent-assisted contribution workflow section ([0daf3b9](https://github.com/event4u-app/agent-config/commit/0daf3b9b89696780cb4c027fff7ce4be4dfa23a5))
* **roadmap:** decouple roadmaps from merge / commit steps ([40a64a0](https://github.com/event4u-app/agent-config/commit/40a64a0a31b31c05ca7de05a1a7b267634a53c7b))
* **roadmap:** close road-to-feedback-followups · agent-side complete ([efa4406](https://github.com/event4u-app/agent-config/commit/efa4406d4cc38cbcd3ebdb355c991da53d43a4c7))
* **skills:** governance-baseline + Claude-skill projection notes ([f9306e1](https://github.com/event4u-app/agent-config/commit/f9306e1f53c1f7ce735ba039ae22a8a0ebcc05b6))

### Refactoring

* **skills:** rename repomix → repomix-packer ([62eec15](https://github.com/event4u-app/agent-config/commit/62eec153f770ebf848f1dcf84b30c036001a63ef))

### Chores

* retire /copilot-agents shim and clean up references ([295e3aa](https://github.com/event4u-app/agent-config/commit/295e3aa6f683263b9f5a8451bb94cb7468bfd00d))
* canonicalize Known False Positives section in copilot-instructions.md ([c1a20bd](https://github.com/event4u-app/agent-config/commit/c1a20bd474895974f442bc5d2545175d39021e1e))
* collapse editing-repo pointers in AGENTS.md to reclaim WARN headroom ([934800a](https://github.com/event4u-app/agent-config/commit/934800a6334e88494ffad37a3f5204e05bb60b1c))
* archive completed road-to-agent-command-consolidation roadmap ([829704b](https://github.com/event4u-app/agent-config/commit/829704b797cd10b79ce0b70cc9d1b14cd3ce5664))
* thin-root awareness for command-count gate; refresh doc counts ([6040c45](https://github.com/event4u-app/agent-config/commit/6040c4524ff84673adc8a403a2f6ab5e105b0af4))
* regenerate compressed sources and tool projections ([0e83fb9](https://github.com/event4u-app/agent-config/commit/0e83fb9a008c6d083c8c2d1a53e645abe2b2541c))

Tests: 2471

## [1.29.0](https://github.com/event4u-app/agent-config/compare/1.28.0...1.29.0) (2026-05-09)

### Features

* **skills:** port 3 Microck skills under Sunset Policy (P2.2, P2.3, P2.5) ([78fdfeb](https://github.com/event4u-app/agent-config/commit/78fdfebf5f515e67072f9cb4a75ca7f56ca9b1b2))
* **skills:** port error-handling-patterns from Microck under Sunset Policy (P1.5) ([c24589c](https://github.com/event4u-app/agent-config/commit/c24589c2c5e27e7182061660b98cca3d1e97fbae))
* **skills:** port mcp-builder from Microck (P1.4) ([b192b38](https://github.com/event4u-app/agent-config/commit/b192b38c58245d7e8d33bdf5d577e41ba968cba5))
* **skills:** port repomix from Microck (P1.3) ([825fd17](https://github.com/event4u-app/agent-config/commit/825fd175082b78fb2fd6250befb8cea86f1c3a0d))
* **skills:** port testing-anti-patterns from Microck (P1.2) ([8bca47f](https://github.com/event4u-app/agent-config/commit/8bca47fab1db5811eada9bbb1f9545ebd1a68a4d))
* **skills:** port defense-in-depth from Microck (P1.1) ([fb9bbb1](https://github.com/event4u-app/agent-config/commit/fb9bbb1e74890a63a1499a22ead0e79ab0a73ed6))

### Bug Fixes

* **refs:** point sibling roadmap link to archived microck-harvest ([92586a9](https://github.com/event4u-app/agent-config/commit/92586a9339e66b57121356ff644f2e3a706050e0))

### Documentation

* **microck-harvest:** record P2/P3 verdicts in provenance + analysis ([5200097](https://github.com/event4u-app/agent-config/commit/5200097a42bca40df03f4ecb232fea269ce6aacf))

### Chores

* **microck-harvest:** regenerate ownership matrix for 3 new skills ([855e331](https://github.com/event4u-app/agent-config/commit/855e3310729b0f359425c3c3e75541d98162cab4))
* **microck-harvest:** regenerate index + catalog for 153 skills ([1d5f265](https://github.com/event4u-app/agent-config/commit/1d5f2654fbf2997a1465e965097eff8bce9f7ca2))
* **roadmap:** close + archive microck-harvest (Phase 2 + 3 \u2014 100%) ([48c18f0](https://github.com/event4u-app/agent-config/commit/48c18f07a68342782d7d079e2371a613ee7a7c2e))
* **microck-harvest:** register 3 new skills in marketplace + counts (150 \u2192 153) ([0e8b351](https://github.com/event4u-app/agent-config/commit/0e8b3518853add4b28e1e45f5babc550eaa974d1))
* **microck-harvest:** suite integration + Phase 1 closure (P1.6) ([6450e9d](https://github.com/event4u-app/agent-config/commit/6450e9deea5806f4f8bfcddf12df9eeeae37c9cb))

## [1.28.0](https://github.com/event4u-app/agent-config/compare/1.27.0...1.28.0) (2026-05-09)

### Features

* **schema:** allow Sunset-Policy metadata on skill schema ([d5d67bd](https://github.com/event4u-app/agent-config/commit/d5d67bd30e36ea6ec9586825218678ec3203ee3a))
* **commands:** port /research command with research-schema contract ([2f03dfa](https://github.com/event4u-app/agent-config/commit/2f03dfad2f56776e80d8417f618b8ec59ae07289))
* **skills:** adopt deep-reading-analyst skill + 3 thinking-framework guidelines ([78ac3e3](https://github.com/event4u-app/agent-config/commit/78ac3e35c56c0e936291a69191c94869251f532e))

### Bug Fixes

* **roadmap:** rename heading to bypass PHASE_RE false-positive ([9e0121c](https://github.com/event4u-app/agent-config/commit/9e0121c6589c214263000d7a4ae7ea554844a6cf))
* **scope-control:** trim 411 chars to fit <=4000 override ceiling ([62dd6ee](https://github.com/event4u-app/agent-config/commit/62dd6eebc268a27cbb1a72a3089f581242be810f))
* **budget:** trim 3 auto-rule descriptions to <=150 chars ([cfec360](https://github.com/event4u-app/agent-config/commit/cfec360f94982e302a80bfb6ab59653e3e4f41a8))
* **no-council-refs:** suppress legitimate ADR + skipped-roadmap citations ([e6be2dd](https://github.com/event4u-app/agent-config/commit/e6be2ddec929e05d811297ebc41f53eee5afe3de))
* **no-roadmap-refs:** drop transient roadmap links from stable artifacts ([bbda43a](https://github.com/event4u-app/agent-config/commit/bbda43a9a57dacc3153f6173497fb4503cacc174))
* **commands:** rephrase upstream path in /research ADOPT citation ([d4fc1af](https://github.com/event4u-app/agent-config/commit/d4fc1aff289f9e7c344648a16415a60296a931f5))

### Chores

* **roadmap:** close P1.6 with CI-green evidence ([da198c3](https://github.com/event4u-app/agent-config/commit/da198c3e81154b34a1b519ed29aa3431e8612f4d))
* **index:** regenerate after description trim ([27477dc](https://github.com/event4u-app/agent-config/commit/27477dc189de43a97f6559df84a783541ba2c0de))
* **ownership:** regenerate file-ownership-matrix after governance edits ([648f272](https://github.com/event4u-app/agent-config/commit/648f27200657d574a81bced639e191f6406acdf6))
* **index:** regenerate after description tightening ([4d78844](https://github.com/event4u-app/agent-config/commit/4d78844be0ee32379b4152a64e8acd2e951208db))
* **governance:** remove transient roadmap refs + tighten descriptions ([421f0e3](https://github.com/event4u-app/agent-config/commit/421f0e30d257ec0f76ef648ad03161dc688dd182))
* **index:** regenerate after research cluster registration ([f26f52d](https://github.com/event4u-app/agent-config/commit/f26f52d44f36122e4e08ffaa786e65586e6589ac))
* **clusters:** register research as a locked cluster head ([3c9fa64](https://github.com/event4u-app/agent-config/commit/3c9fa64b26ad56f2a28e50c92cbc4e69fe4ab14a))
* **counts:** sync command-count to 104 after /research adoption ([43f5cd7](https://github.com/event4u-app/agent-config/commit/43f5cd7560419e08c581607a62ed2297e9caa738))
* **index:** regenerate index/catalog for deep-reading-analyst + research ([baa7fb3](https://github.com/event4u-app/agent-config/commit/baa7fb3bb716f8bbfde491f940d7def487dcde18))
* **suite:** integrate deep-research adoption (counts, roadmap, hashes) ([7a3eb51](https://github.com/event4u-app/agent-config/commit/7a3eb511239a8a74589f9a3c89187084c083f68b))

## [1.27.0](https://github.com/event4u-app/agent-config/compare/1.26.0...1.27.0) (2026-05-08)

### Features

* **governance:** add no-unsolicited-rebase rule ([b17e4bc](https://github.com/event4u-app/agent-config/commit/b17e4bc8482342a8f3b9c47f40994e17a6eab626))
* **governance:** add domain-adoption-policy rule ([30a45c3](https://github.com/event4u-app/agent-config/commit/30a45c352a7c9b16dfe455f31bf87c253fe95014))
* **mobile:** add mobile track skills and iOS simulator guideline ([f4dbb5c](https://github.com/event4u-app/agent-config/commit/f4dbb5cc32065e76d39981d18bc4513551a5da8b))

### Bug Fixes

* **governance:** set tier 2a on no-unsolicited-rebase rule ([284ced0](https://github.com/event4u-app/agent-config/commit/284ced0c7b53ec9a394234a37ee5b370d2278802))
* **governance:** allowlist .agent-src.uncompressed/ substring in domain-adoption-policy ([e2091dc](https://github.com/event4u-app/agent-config/commit/e2091dc660ce4c437c1b5035aaa1179f469e7abe))

### Chores

* **roadmap:** archive road-to-mobile-adoption ([cc5e6ea](https://github.com/event4u-app/agent-config/commit/cc5e6ea4228666b9784fd468095bb2c096430672))
* regenerate tool projections and counts for mobile + governance ([b36d495](https://github.com/event4u-app/agent-config/commit/b36d4957a43b26d0786ae73f11097091ca28fbbb))

## [1.26.0](https://github.com/event4u-app/agent-config/compare/1.25.0...1.26.0) (2026-05-08)

### Features

* **linter:** replace size heuristics with structural-density model ([95584ac](https://github.com/event4u-app/agent-config/commit/95584ac5e74948b71a9d13ff5ec6870c110be489))

### Documentation

* **contracts:** add linter structural model + update size-and-scope ([32fa8b2](https://github.com/event4u-app/agent-config/commit/32fa8b2b7cc65148f7bc28fb782f20670d6640bc))

### Chores

* gitignore density logs + archive completed structural-linter roadmap ([0a94ece](https://github.com/event4u-app/agent-config/commit/0a94ece8ac724386a5d49451b1e0d3058f2644cf))

## [1.25.0](https://github.com/event4u-app/agent-config/compare/1.24.0...1.25.0) (2026-05-08)

### Features

* **scope-control:** mandate branch-base inventory before first commit ([b038c26](https://github.com/event4u-app/agent-config/commit/b038c2660f8e317f09156ff00120bcdf31d7db92))
* **ci:** agents-md linter + CI integration (Phase 7) ([dd86beb](https://github.com/event4u-app/agent-config/commit/dd86bebd929bb3dde96e4100e96645a674f137fa))
* **agents-md:** Thin-Root refactor — agents-md-thin-root skill + content (Phase 6) ([7d31204](https://github.com/event4u-app/agent-config/commit/7d31204659a0ce085bb8a8f45b16de34cae06a78))
* **rules:** rule-governance audit — demote 4 auto-rules to manual (Phase 5) ([5071ff5](https://github.com/event4u-app/agent-config/commit/5071ff5855cf67c61303bb4cb07c4229fbbb4dd4))
* **rules:** consolidate auto-rules — merge council into no-roadmap-references and review-routing-awareness into reviewer-awareness (Lever D) ([18c42a3](https://github.com/event4u-app/agent-config/commit/18c42a33af0d950e07c50615615d4deb076071ff))
* **docs:** outboard AGENTS.md tech-stack details to context (Lever B) ([9b7bcfd](https://github.com/event4u-app/agent-config/commit/9b7bcfd374ce3325dd7013e530ce71f4b92df4eb))
* **budget:** augment workspace-guidelines budget meter + description cap (Lever A) ([da75061](https://github.com/event4u-app/agent-config/commit/da750615acbf9a687b81b1ecaff6d517a11203fb))
* **ci:** enforce one kernel-rule edit per PR ([a91ce92](https://github.com/event4u-app/agent-config/commit/a91ce927dc2a98129a7b685f803f7650863b31fa))

### Bug Fixes

* **roadmap:** repoint sibling-roadmap reference to archived path ([f7ee632](https://github.com/event4u-app/agent-config/commit/f7ee632800290d3cd90f2dd1274e47e8127f1f63))
* **tests:** align update_counts + linter + hero-counts tests with Thin-Root ([5556c8c](https://github.com/event4u-app/agent-config/commit/5556c8ce1a8cf4df7a7b4a957030d5b5d2d0fd7e))
* **skills:** mark agents-md-thin-root cloud_safe noop ([17a3824](https://github.com/event4u-app/agent-config/commit/17a3824ddd1ea567fca8b699113b2c62050c5507))
* **docs:** move agents-md-tech-stack from agents/contexts/ to docs/contracts/ ([77eef8c](https://github.com/event4u-app/agent-config/commit/77eef8c61d2561ef5a563518f2bdb1dff80541c7))
* **rules:** drop forbidden agents/ link from reviewer-awareness body ([8a573a4](https://github.com/event4u-app/agent-config/commit/8a573a48bc959f0c16ea8b56fc0e6bd0d3139238))
* **refs:** point to archived roadmap, inline council convergence ([bf56b70](https://github.com/event4u-app/agent-config/commit/bf56b7084dae68fe2a21e52d7cb644ed6b3bb670))

### Documentation

* **roadmap:** archive road-to-augment-limit-fit and repoint references ([58e101c](https://github.com/event4u-app/agent-config/commit/58e101c8a3421004929f47f4c760e44b97c124bc))
* **roadmap:** flip 8.3 + 8.4 — strategic phases committed and CI green ([712c414](https://github.com/event4u-app/agent-config/commit/712c4141103dbdc6db7fa6d1fa94d31943bd40e1))
* **roadmap:** drop gitignored council-response link ([74206a5](https://github.com/event4u-app/agent-config/commit/74206a592f47b9254c788b162ea3d99c54057506))
* **roadmap:** close road-to-augment-limit-fit (Phase 8) ([ac062ad](https://github.com/event4u-app/agent-config/commit/ac062ad184764f04f639eb52d59b1d63419b4b9b))
* **index:** regenerate agents/index.md + docs/catalog.md after rule consolidation ([3aa347c](https://github.com/event4u-app/agent-config/commit/3aa347c1e814a9c289891c350d69f8b9fda6783f))
* **roadmap:** land road-to-augment-limit-fit + ADR + regen derived artefacts ([5e54d22](https://github.com/event4u-app/agent-config/commit/5e54d220579658c4fc2310f123908b8cba97683e))
* **adr:** park always-budget relief strategy with reactivation triggers ([487e736](https://github.com/event4u-app/agent-config/commit/487e7366de6e99db60906906d61033486a0a6aa3))
* **rules:** add kernel-rule slow-rollout guarantee to scope-control ([26c43a2](https://github.com/event4u-app/agent-config/commit/26c43a2c96ede95319990b4ba578a986e46768a2))

### Refactoring

* **copilot:** collapse copilot-review-instructions.md into copilot-instructions.md ([6c6ac25](https://github.com/event4u-app/agent-config/commit/6c6ac25a5958c3bbc0ffc7bb38422a6b9d855b50))

### Chores

* **tools:** regen .windsurfrules for branch-base inventory ([a87641c](https://github.com/event4u-app/agent-config/commit/a87641cc0db84e705a9afe7aa36afbd451fb1467))
* **rebase:** restore compression hashes for files inherited from PR #55 ([863ba1c](https://github.com/event4u-app/agent-config/commit/863ba1cd71dc00559db905eb0d11b96951a9c5bd))
* regenerate .windsurfrules ([822b95e](https://github.com/event4u-app/agent-config/commit/822b95e1dcf48b05ec4e9bec0a4f481583ae6de7))
* **roadmap:** close + archive road-to-always-budget-relief, regen index ([350bfb1](https://github.com/event4u-app/agent-config/commit/350bfb1e75602769f6a1cfa535ed5d30adcd5eba))

## [1.24.0](https://github.com/event4u-app/agent-config/compare/1.23.0...1.24.0) (2026-05-08)

### Features

* **rules:** harden roadmap-progress-sync — real-time checkbox cadence ([bdaaf0c](https://github.com/event4u-app/agent-config/commit/bdaaf0caff6d312ab87aabc8d170793cbbc6513a))
* **measurement:** markitdown lift benchmark + corpus ([e606c7a](https://github.com/event4u-app/agent-config/commit/e606c7afae9977ab3c19f2a7f99a6ec18b31b483))
* **skill:** add markitdown skill with four-layer defense ([21514f4](https://github.com/event4u-app/agent-config/commit/21514f4bf8b77d00480fc5dfab54a1a04e34f4f1))

### Bug Fixes

* drop markitdown roadmap link + trim README to 500 lines ([da8240d](https://github.com/event4u-app/agent-config/commit/da8240d6fce74555d08a8bfb4f4d15379d10de54))
* **refs:** update markitdown roadmap path to archive/ after archival ([f7679de](https://github.com/event4u-app/agent-config/commit/f7679debb851bd721f671e26fe962186e56a1e86))

### Documentation

* feature markitdown in README, AGENTS, architecture ([fa1babc](https://github.com/event4u-app/agent-config/commit/fa1babcb344c5f090aa4cea0eafb58e5732cf872))
* cross-link markitdown from analysis and learning skills ([14f9d72](https://github.com/event4u-app/agent-config/commit/14f9d7290dbcb341d2ff97280dbfb54b32e39057))

### Chores

* **generate-tools:** refresh .windsurfrules after roadmap-progress-sync body expansion ([3fdba11](https://github.com/event4u-app/agent-config/commit/3fdba11cd4e91425a05ef9ad82b0e7c611180668))
* **compress:** sync .agent-src/ with hardened roadmap-progress-sync rule ([30e7d1a](https://github.com/event4u-app/agent-config/commit/30e7d1ab455da823afbe7602f01d543d3fe91c5d))
* **roadmap:** archive markitdown-adoption + refresh progress dashboard ([5481d90](https://github.com/event4u-app/agent-config/commit/5481d9025f4c85f33e11533099cf725eeb306455))
* add skills-provenance registry for upstream attribution ([65c2eeb](https://github.com/event4u-app/agent-config/commit/65c2eeb3d1c9d0f86957757ce22221ed0e255292))
* **roadmap:** harden process-full to ignore horizon markers ([36d0fa6](https://github.com/event4u-app/agent-config/commit/36d0fa6c263721618999b7fa27ddb9cb336dd6c2))

## [1.23.0](https://github.com/event4u-app/agent-config/compare/1.22.0...1.23.0) (2026-05-08)

### Features

* **skills:** add script-writing skill for scripts/ conventions ([1f8655d](https://github.com/event4u-app/agent-config/commit/1f8655d6cbf007410e3846ab502eea5745a7f66f))
* **scripts:** Phase 10.7 --quiet flag + silent Taskfile + caveman compile-time toggle ([1d319e6](https://github.com/event4u-app/agent-config/commit/1d319e61a3c782eb5c86075f34275306a67c621c))
* **linter:** frugality charter writer-cite validator + writer skill citations ([0e34709](https://github.com/event4u-app/agent-config/commit/0e3470965d5e2f4a8b11f27137d4ba43d2471be2))
* **verbosity:** add verbosity toggles + gate routine outputs ([580d4cc](https://github.com/event4u-app/agent-config/commit/580d4cc2d1f4d4b091b6128f0a29d1f7e619895d))
* **roadmap-sync:** pre-commit backstop blocks stale dashboard ([c577fc0](https://github.com/event4u-app/agent-config/commit/c577fc0aabc13faaae64c88d20d8ca66338ae5fc))
* **create-pr:** drop council-review prompt ([e694811](https://github.com/event4u-app/agent-config/commit/e694811f7ca06b3db275cc70e83e6dbc4db72e42))
* cite SPARC escalation thresholds in test-driven-development ([836f2ed](https://github.com/event4u-app/agent-config/commit/836f2edc2c288bcc7f878e97f42de954add8bb5b))
* add mcp-request-signing guideline with HTTP-bridge appendix ([2ab67cd](https://github.com/event4u-app/agent-config/commit/2ab67cd401333ea61f47d43e952e7b07958feff3))
* add cost-report command with token cost tracking ([262d865](https://github.com/event4u-app/agent-config/commit/262d865072d613647a439e89f83ded7334b60b1b))
* add adr-create skill with index regeneration script ([7225105](https://github.com/event4u-app/agent-config/commit/7225105797d6810cad75bfa851f02b100e41ba29))

### Bug Fixes

* **docs:** bump command counts to 103 after cost-report addition ([2810fa5](https://github.com/event4u-app/agent-config/commit/2810fa5a54b7099123ae65e6c7c1325430bf3b77))

### Documentation

* sync counts (139 skills, 60 rules) + meta cleanups ([00c8b21](https://github.com/event4u-app/agent-config/commit/00c8b211edbc86cbe2f886107227e6bd46049c3b))
* codify defer-with-trigger harvest policy ([b30dcd7](https://github.com/event4u-app/agent-config/commit/b30dcd72d0ffbd1fb2dbdd8ca28493a5b05a6bed))

### Refactoring

* **rules:** apply trim-frugality-canon Phase 1-3 trims ([ea1828a](https://github.com/event4u-app/agent-config/commit/ea1828af7bc69426386f6852cb69891309dce65f))

### Chores

* regenerate stale generated mirrors ([ea52e94](https://github.com/event4u-app/agent-config/commit/ea52e94415c4db5598e91d001e0fbeee10cae9be))
* regenerate auto-generated artefacts ([fbe7d9e](https://github.com/event4u-app/agent-config/commit/fbe7d9ef137c9e584d7f88ce660afe29ab1a8d00))
* bump skill/command/guideline counts and compression hashes ([18f4fad](https://github.com/event4u-app/agent-config/commit/18f4fad2372fd4347210199986909319c24ea0ec))
* archive ruflo-adoption, move caveman-integration to skipped ([4c6c1eb](https://github.com/event4u-app/agent-config/commit/4c6c1eb1e00356421e0038704a82e1f10ac9a3e5))

## [1.22.0](https://github.com/event4u-app/agent-config/compare/1.21.0...1.22.0) (2026-05-07)

### Features

* **commands:** add /grill-me alias for /challenge-me + expand triggers ([d2be4ee](https://github.com/event4u-app/agent-config/commit/d2be4ee1a97d2ca2374c6543e0fd908eca0a0f1a))
* **challenge-me:** add !roadmap and !ai triggers ([7bfbd69](https://github.com/event4u-app/agent-config/commit/7bfbd6943852d781ca7ad29e51750de24d3ef413))
* **create-pr:** default to skipping description preview to save tokens ([80e77ae](https://github.com/event4u-app/agent-config/commit/80e77aed76a13c26fac8316bc5d58a3533dbbe44))
* **council:** add critical-evaluation stance for council findings ([7e2524b](https://github.com/event4u-app/agent-config/commit/7e2524b75fd84ca4b6afb6deae0b8777e8b81ac7))
* **council:** add /roadmap:ai-council deep-tier sub-command ([c5933e4](https://github.com/event4u-app/agent-config/commit/c5933e4b2301a0f9d1c116d2843ed4953bd92163))
* replace /roadmap-execute with autonomous /roadmap:process-* cluster ([9d4ffd0](https://github.com/event4u-app/agent-config/commit/9d4ffd0815fb7923b337bfd0b3847d9bc5a01e54))
* **council:** mark architecture/refactor/bug-diagnose artefacts as deep ([6f903c1](https://github.com/event4u-app/agent-config/commit/6f903c194e4bc54512e93a32e1876e84d0292401))
* **council:** add deep reasoning depth tier with schema enforcement ([f4efd7a](https://github.com/event4u-app/agent-config/commit/f4efd7a11b9d57e93153e6e4605c968565c8924d))
* **linter:** require suggestion block on commands ([231df91](https://github.com/event4u-app/agent-config/commit/231df918b2d15ea9cc2fa8fe12bae4c2482990df))
* add --siblings council mode and refine convener wording ([9075647](https://github.com/event4u-app/agent-config/commit/9075647ba520efb5f10ab7612970111e9f9d16e9))
* add PRD template to technical-specification ([f9ee749](https://github.com/event4u-app/agent-config/commit/f9ee7496434f9342d6b46b95dce14c4703d07d96))
* add 6-phase loop checklist to systematic-debugging ([29c9e94](https://github.com/event4u-app/agent-config/commit/29c9e9419c9d08dd93c4fc7364e51b93bc771131))
* add invite-challenge rule for pre-execution goal restatement ([e96da5f](https://github.com/event4u-app/agent-config/commit/e96da5fdf124da3582e454fc625fe32a27ada634))
* add /challenge-me cluster with vision and with-docs sub-commands ([74481ef](https://github.com/event4u-app/agent-config/commit/74481ef7e7850d3e015ff0f9853be6ea618ac1d9))

### Documentation

* **roadmap:** drop council-response file links per no-council-references ([d792100](https://github.com/event4u-app/agent-config/commit/d792100ef6b2727cca1338c89fefc4c591513265))
* **readme:** bump hero command count from 100 to 102 ([3212db4](https://github.com/event4u-app/agent-config/commit/3212db48fb1d62a70f9e87cf9307ee73059b7e4e))
* **roadmap:** integrate R5 council verdict for caveman-insurance ([38b26e2](https://github.com/event4u-app/agent-config/commit/38b26e2f00504a7c6c821c356964cb0cabefd905))
* **roadmap:** incorporate R4 verdict + structural findings into caveman integration ([c50f39b](https://github.com/event4u-app/agent-config/commit/c50f39bc9b08c8d59c4cf547aeec7fffbff38bc0))
* **roadmap:** convert caveman integration Phase 2 to hard cutover ([fb459be](https://github.com/event4u-app/agent-config/commit/fb459be70a093eea1814a38a3b1fec9cf9261363))
* **harvest:** add Superpowers harvest roadmap, hardened by council R2 ([e559259](https://github.com/event4u-app/agent-config/commit/e559259f789014603067e87141d9feb815b480ab))
* **harvest:** analyze obra/superpowers v5.1.0 for adoption candidates ([e89e0ee](https://github.com/event4u-app/agent-config/commit/e89e0eeadc4b76517b181c559422e88df5c8122a))
* **council:** document council_depth frontmatter convention in templates ([ba56412](https://github.com/event4u-app/agent-config/commit/ba56412c76204bbe49366bbceb62e4d31c994fc2))

### Chores

* **sync:** re-sync compressed mirror with create-pr preview-gate + agent-settings preview_description ([ceab79e](https://github.com/event4u-app/agent-config/commit/ceab79e23be2c1d4ba504b80426d1b91ffdaadd1))
* bump artefact counts and refresh compression hashes ([2801342](https://github.com/event4u-app/agent-config/commit/28013424668177fc23df45cc56390faba6fd010e))
* regenerate tool-dir symlinks for challenge-me and invite-challenge ([b3b0ada](https://github.com/event4u-app/agent-config/commit/b3b0ada9ce108b220289c9f044b3f3d0209f0a12))
* bump artefact counts and refresh compression hashes ([4147de3](https://github.com/event4u-app/agent-config/commit/4147de3b4da24494128a847be194ac901e506df9))
* sync compressed projection for challenge-me cluster ([9165762](https://github.com/event4u-app/agent-config/commit/91657620e6d822fbe28923e3b008e218f13e5cea))

## [1.21.0](https://github.com/event4u-app/agent-config/compare/1.20.0...1.21.0) (2026-05-06)

### Features

* **linter:** add council-reference guard with pragma suppressions ([734b7ae](https://github.com/event4u-app/agent-config/commit/734b7ae61d53c17fadb78f6f68bb54e3fe7cdde8))
* **linter:** density-gated size warnings (council Option 2) ([281b9aa](https://github.com/event4u-app/agent-config/commit/281b9aa6f52640a93cf55c7b13678fbd2ea85077))
* **skills:** add prompt-optimizer skill and /optimize-prompt command ([4f99e50](https://github.com/event4u-app/agent-config/commit/4f99e50ae46b19eab3eed2629bb94ac5d017151e))
* **path-fixes:** finalize Phase 5-7 — checker, smoke, copilot review, contracts move ([3c5fc5d](https://github.com/event4u-app/agent-config/commit/3c5fc5d100ea7c542a48778e4e0669f551fad946))
* **install:** rules_use_symlinks toggle for both compress.py and install.sh ([927adc3](https://github.com/event4u-app/agent-config/commit/927adc35002588eef4d24825c313e6a9511d6ca1))
* **ai-council:** default rounds via ai_council.min_rounds (default 2) ([26da301](https://github.com/event4u-app/agent-config/commit/26da30125a0b5a2c74c9c48cf6a2f8e2e5d021dd))
* **ai-council:** isolate council artefacts as gitignored, auto-pruned scratch ([ab0e245](https://github.com/event4u-app/agent-config/commit/ab0e245734c8560f6d93df927b8af6d105c1d8dc))
* **rules:** enforce logical-name path conventions for load_context ([fd12ff6](https://github.com/event4u-app/agent-config/commit/fd12ff6b37cec7d2be8ea88d3ec055333fea13e2))
* **rules:** land kernel + router architecture ([d4fe80e](https://github.com/event4u-app/agent-config/commit/d4fe80e1ce2a956eb86df328de32e3252515553f))
* **linter:** validate router frontmatter schema (P3.3) ([124e4d7](https://github.com/event4u-app/agent-config/commit/124e4d7387c4f6b90dba5a60179580af5ba5ed45))
* **router:** compile router.json + wire into CI (P3.2) ([a050a5c](https://github.com/event4u-app/agent-config/commit/a050a5c7b1ba4900be8d7439eadf5cd2953f15d1))
* **router:** add rule-router schema contract (P3.1) ([e7b1088](https://github.com/event4u-app/agent-config/commit/e7b108809d2fc1f26b4f8f4254044c6019b75a90))
* **kernel:** add Iron-Law SHA tooling + raise bucket cap to 26k (ADR-002) ([2f8b867](https://github.com/event4u-app/agent-config/commit/2f8b867bb1c306d8c03a754f68f8c82a53013689))
* **kernel:** land P2.1 — kernel-budget enforcement + ADR-001 ([dd7d50a](https://github.com/event4u-app/agent-config/commit/dd7d50aeb81ca53c430d84d1c0ba36a93008c7f8))
* **scripts:** add rule-budget measurement + Phase-1 pilot tooling ([396a85f](https://github.com/event4u-app/agent-config/commit/396a85fef25578871566c6c463f57e23b7f95ef2))

### Bug Fixes

* **commands:** add cluster: optimize to optimize-prompt frontmatter ([bdc3907](https://github.com/event4u-app/agent-config/commit/bdc390772086fa4c13dba1142eb2b82ab133f5a7))
* **compress:** protect rule examples with inline-code backticks ([c5ea62b](https://github.com/event4u-app/agent-config/commit/c5ea62ba8937d52651544b8509b955498e109579))
* **schema:** accept rewritten ../contexts/ paths in load_context ([8101320](https://github.com/event4u-app/agent-config/commit/8101320c9a014e02bddfa60fb433b09bd3646b0a))
* **linter:** support validator_ignore frontmatter + dual-location contracts ([031bd7d](https://github.com/event4u-app/agent-config/commit/031bd7df79deb35a53b8f1d49384056cfcea7711))
* **templates:** compressed mirror of templates/rule.md + placeholder fix for check-refs ([c182723](https://github.com/event4u-app/agent-config/commit/c18272386d1c5f31efdd14f6d2cca8b8d8b876c8))
* **skills:** portability — script paths in rule-writing, lower-case agent-config in copilot-agents-optimization ([7e5a86f](https://github.com/event4u-app/agent-config/commit/7e5a86f5dda9a095e3d887c19df718555f7f347c))
* **tests:** align load_context tests with logical-name path format ([924e52e](https://github.com/event4u-app/agent-config/commit/924e52ed4005d2fb8d22167899058ed9eeb61449))
* **commit-mechanics:** trim four-exceptions block to fit 6k extended-size cap ([0b6391f](https://github.com/event4u-app/agent-config/commit/0b6391f08d23af71f8945a7e685c7a979e229d61))
* **contexts:** restore obligation-keyword baseline after P2.2 rule compression ([8996bcd](https://github.com/event4u-app/agent-config/commit/8996bcd83621670f175f93d73ee1c577695d3b34))
* **linear-digest:** update language-and-tone strip-section title after P2.2 rename ([9643a82](https://github.com/event4u-app/agent-config/commit/9643a82c15a9904ceefcc6a9f1b90a4ef2225b47))

### Documentation

* **roadmap:** add road-to-structural-linter-reform (council Option 3) ([ac62e56](https://github.com/event4u-app/agent-config/commit/ac62e563f17f697401c8d9045847b3c12ec1c927))
* update package docs for kernel + router model ([8fef804](https://github.com/event4u-app/agent-config/commit/8fef804aa00ce578ee2b1a96c7002081f07bc538))
* **kernel:** land Phase 1 classification + kernel set + Council R2 amendments ([a179487](https://github.com/event4u-app/agent-config/commit/a179487dd6fef2b548cd1b886a1e7d54a4c00a39))

### Refactoring

* compression logic ([6701f9f](https://github.com/event4u-app/agent-config/commit/6701f9f12568ddc409ccad62a7690d64ba885122))
* **chat-history:** import emits summary + resume offer instead of verbatim entries ([dfafd9c](https://github.com/event4u-app/agent-config/commit/dfafd9cd62d740a7137f6a6e648acfb377f46b1b))
* **kernel:** compress 8 kernel rules per P2.2 playbook + lock kernel (P2.3) ([4e771da](https://github.com/event4u-app/agent-config/commit/4e771da5c4ceea2e6d2e8935098f1cd231c80c30))

### Chores

* **router:** add routes_to to no-council-references rule ([fb50540](https://github.com/event4u-app/agent-config/commit/fb505404c9b03cb9fa597ac36793eb3f552585f7))
* **roadmaps:** archive completed agent-memory roadmaps ([a35b680](https://github.com/event4u-app/agent-config/commit/a35b6803ff545ce2e9098a55cfa8ecb1fbcf624d))
* **ownership:** regenerate matrix after road-to-structural-linter-reform ([174dd24](https://github.com/event4u-app/agent-config/commit/174dd24989f112eab89c628807acbbb0e10b6aae))
* **ci:** regenerate index, catalog, roadmap complexity fix ([d61dc9c](https://github.com/event4u-app/agent-config/commit/d61dc9ce96f2ccdab8efd11281bf00d80ed755ef))
* **docs:** bump getting-started command count from 94 to 95 ([6751897](https://github.com/event4u-app/agent-config/commit/6751897cdf2744683731fc9230183a38834e9b9c))
* **sync:** regenerate agents/index.md + docs/catalog.md after prompt-optimizer ([cfe2367](https://github.com/event4u-app/agent-config/commit/cfe236759671792a9b49ff10f664fbed10edc4c4))
* **readme:** bump command count from 94 to 95 after prompt-optimizer addition ([62a59a4](https://github.com/event4u-app/agent-config/commit/62a59a427986ff428d1c1e729d311914ce3be0e5))
* **sync:** regenerate .windsurfrules after caveman arrow update ([509ba00](https://github.com/event4u-app/agent-config/commit/509ba0061500a47129c77da5bae1f8384636a09c))
* **compression:** apply caveman abbreviation and arrow rules to mirror ([34e5b1f](https://github.com/event4u-app/agent-config/commit/34e5b1f85da99de94ea8b5f932011583c844a0c8))
* **sync:** regenerate compressed mirror + ownership matrix after Phase 5-7 ([b421e8e](https://github.com/event4u-app/agent-config/commit/b421e8e3aae6c1ee739bbdd35ed4f44cd78eed85))
* **roadmap:** archive road-to-path-fixes after Phase 7 closure ([651fd3e](https://github.com/event4u-app/agent-config/commit/651fd3e6586e552dab6368be1853141b2b2fb0ff))
* **portability:** replace 'Galawork'/'galawork' with 'Consumer'/'consumer' ([bac0433](https://github.com/event4u-app/agent-config/commit/bac0433c13e007910564e6b21b82ca6e6dcccdf9))
* regenerate router, index, catalog, windsurf rules, tool symlinks ([93685bb](https://github.com/event4u-app/agent-config/commit/93685bb0fbe7c9f671f3a49672e693a8e4a44b85))
* **commands:** sync compressed mirror of chat-history/import.md to summary+resume ([0063941](https://github.com/event4u-app/agent-config/commit/0063941c69d011a8935ddbcc7ea1266cd4d2c692))
* **roadmaps:** add road-to-path-fixes and refresh progress ([34f9c23](https://github.com/event4u-app/agent-config/commit/34f9c23ccf67f79758e7dd293c66bc4c443ccc29))
* **roadmaps:** close kernel-router, package-opt, token-opt plates ([445ef25](https://github.com/event4u-app/agent-config/commit/445ef2574772358ca278ce2d334a08431e82ed68))
* **roadmap:** close Phase 3 (Router contract) in kernel-and-router ([30b834f](https://github.com/event4u-app/agent-config/commit/30b834fceb9c1198ffae5f0d35d1c84e5bd44c24))
* **ownership:** regenerate file-ownership matrix after P2.2 kernel compression ([0e82da1](https://github.com/event4u-app/agent-config/commit/0e82da18399cd1e9ecff57769116d7a3317c2949))

## [1.20.0](https://github.com/event4u-app/agent-config/compare/1.19.0...1.20.0) (2026-05-06)

### Features

* **rules:** add no-attribution-footers + create-pr strip-pass ([7f72630](https://github.com/event4u-app/agent-config/commit/7f72630e0f334b30df6bc8ffc0fabb82fcca2fe3))
* **orchestration:** mode-6 do-in-worktrees for cross-wing chains ([9087e50](https://github.com/event4u-app/agent-config/commit/9087e50f753fa5c4ef0eb1a048a64f7ccb4994af))
* **cognition:** port five senior-tier cognition skills (Wings 3+4) ([aa958e7](https://github.com/event4u-app/agent-config/commit/aa958e772f82f05f3b23f9bbdd38ff0c8a89bd51))
* **handoff:** cross-wing handoff contract + lint ([cb8e73a](https://github.com/event4u-app/agent-config/commit/cb8e73a8e0dd433d8e166ab926f585914aa5dbf1))
* **skill-quality:** senior-tier authoring standard + structural malice lint ([bcbf8de](https://github.com/event4u-app/agent-config/commit/bcbf8de61f4d6b47fe244c80722886f512315caf))
* **chat-history:** surface helper-built summary in session picker ([0bdd61b](https://github.com/event4u-app/agent-config/commit/0bdd61b1f00ed911ee5dbf764e9598f24d80fb54))
* **infra:** relocate chat-history + prices to agents/ folder ([2727f26](https://github.com/event4u-app/agent-config/commit/2727f26bb986b4ed7414f466561ae600ca3a24ba))
* **council:** add --model per-invocation override ([b21a20c](https://github.com/event4u-app/agent-config/commit/b21a20c16b49392070c62fc21af8ab887b8df978))
* **settings:** expose chat_history.text_limits in template ([7941d7f](https://github.com/event4u-app/agent-config/commit/7941d7fd9a4a66fde046646661c0f8a467fc6900))
* add docs-verified hook extractors for cursor/cline/windsurf/gemini ([5fa2e14](https://github.com/event4u-app/agent-config/commit/5fa2e14dd5cd2b88156d36d5cc47d9fad918758a))
* **hooks:** universal capture + redact tooling for verified-platforms roadmap ([32a6ecd](https://github.com/event4u-app/agent-config/commit/32a6ecdc1f68c7187aa73a98e2116fb2f26ee201))
* **hooks:** cowork platform support + hook-manifest tightening ([6016286](https://github.com/event4u-app/agent-config/commit/601628601dde7bb15e0e5ae4d3d23fbdeac8d3a9))
* **chat-history:** schema v4 — stateless multi-session, position-based pruning, work-engine hook fix ([364990b](https://github.com/event4u-app/agent-config/commit/364990b3768af8d19bb6ecca916d3e5dac8c56c4))
* **chat-history:** shrink session sidecar to {fp, started_at} ([c00a3e2](https://github.com/event4u-app/agent-config/commit/c00a3e27691637c1ffe9ca6b05d1f0531c95e85d))
* **chat-history:** add /chat-history learn for selective historical context import ([2a88511](https://github.com/event4u-app/agent-config/commit/2a885111399eac7a5756edfaea5981e403e93177))
* **chat-history:** add session isolation (schema v3) with read filter and sessions API ([6fd118d](https://github.com/event4u-app/agent-config/commit/6fd118d0f138068789e2167226a524ef92b82eab))
* **contexts:** drop handshake context, slim platform-hooks doc ([ad39197](https://github.com/event4u-app/agent-config/commit/ad39197a089d79b00263625a4c84bb1ed1937193))
* **commands:** trim /chat-history to show-only ([ba1d305](https://github.com/event4u-app/agent-config/commit/ba1d305e2ca6365a0668113ce94a3c3afc78bcee))
* **work-engine:** drop chat-history turn-check + heartbeat hooks ([7883e64](https://github.com/event4u-app/agent-config/commit/7883e640bf880bf371ad1dd14a37b1f79d9aaf88))
* **chat-history:** auto-adopt on session_start + delete cooperative rules ([579a1bc](https://github.com/event4u-app/agent-config/commit/579a1bcdea2b4fe7dbff8d650997c35d5366d292))

### Bug Fixes

* **no-roadmap-refs:** drop roadmap file links from stable artifacts ([b4a56f4](https://github.com/event4u-app/agent-config/commit/b4a56f499d1c070ad658fb9a87b6d272f1d05b79))
* **public-links:** tag cross-wing-handoff as beta, drop link into agents/contexts/ ([89ac1ac](https://github.com/event4u-app/agent-config/commit/89ac1ac13ce52d26914abe14de2336f68f4e252f))
* **check-refs:** allow runtime-bootstrapped agents/.agent-prices.md ([5b45a17](https://github.com/event4u-app/agent-config/commit/5b45a176cc42a04a771a01aa9384a0ad8da0b222))
* **roadmap:** demote Kill-switch headings so check-roadmap-trackable stops parsing them as phases ([3029195](https://github.com/event4u-app/agent-config/commit/3029195c75eb16b95f57dd2c04401f8ead63f5e9))
* **roadmap:** repair remaining check-refs errors in event-driven-discipline ([bd8f908](https://github.com/event4u-app/agent-config/commit/bd8f908f9d5955cb8aa8a6b8c841076f0ee4dc91))
* **roadmap:** repair broken refs in event-driven-discipline ([6584a52](https://github.com/event4u-app/agent-config/commit/6584a5221a0fdb05b2f69d7a6b5c9c4c7b8ee163))
* **chat-history:** migrate stale v3 header in-place on first hook write ([d239a39](https://github.com/event4u-app/agent-config/commit/d239a3903a81a569ee2cd372dd3c6c709153bbb8))
* **lint:** add skills frontmatter to /chat-history learn ([01e8db3](https://github.com/event4u-app/agent-config/commit/01e8db31a1822c275dff6410fed2622ba9683fad))
* **readme:** drop agents/contexts/ deep-link, mark hook-architecture-v1 as beta ([eeacbeb](https://github.com/event4u-app/agent-config/commit/eeacbeb1e748e98613102f0008756a5db155159b))

### Documentation

* **roadmaps:** add productization + kernel-and-router roadmaps ([1f7fbd4](https://github.com/event4u-app/agent-config/commit/1f7fbd4aca67e33a086d90e8a9e316ab0d7d8815))
* **roadmap:** add road-to-package-optimization + dashboard sync ([016597f](https://github.com/event4u-app/agent-config/commit/016597ff468bc74cfefa0af9e86052cce872d865))
* **analysis:** add package-optimizer design comparison ([607cf7f](https://github.com/event4u-app/agent-config/commit/607cf7f2b1786b62b36265798f66daa057d37e8f))
* **council:** add package-optimizer design Q&A ([2211a59](https://github.com/event4u-app/agent-config/commit/2211a59fc8ae408a18a01101ac33711eda8a8285))
* **roadmap:** add road-to-token-optimization + dashboard sync ([6348108](https://github.com/event4u-app/agent-config/commit/6348108162993e5947eea3d5612e43c4fdc18686))
* **analysis:** add token-optimizer design comparison ([05462cf](https://github.com/event4u-app/agent-config/commit/05462cf17ebab4dd9c02b9683bc741e5be3c8a12))
* **council:** add token-optimizer skill design Q&A ([eb6f9c3](https://github.com/event4u-app/agent-config/commit/eb6f9c3aad9c4ef20707181f8f3454f37f405761))
* **roadmap:** add road-to-ruflo-adoption + dashboard sync ([009d94d](https://github.com/event4u-app/agent-config/commit/009d94d26c83c28dc0b2bac52b7109ff5f6a72d9))
* **analysis:** add ruflo harvest comparison ([55d371c](https://github.com/event4u-app/agent-config/commit/55d371c1d427d20391f875430541d47b81fb9095))
* **council:** add ruflo harvest prioritization Q&A ([7452d39](https://github.com/event4u-app/agent-config/commit/7452d3966bd6f7ce8e8f6e03e88a6bc6acb6fef8))
* **roadmap:** add road-to-mobile-adoption + dashboard sync ([ca092df](https://github.com/event4u-app/agent-config/commit/ca092df913d00870d3227e212e507075462f0d87))
* **analysis:** add mobile harvest comparison ([6791a78](https://github.com/event4u-app/agent-config/commit/6791a780276da3fccd100d6f5fd6b6e29c466673))
* **council:** add mobile harvest prioritization Q&A ([48cc665](https://github.com/event4u-app/agent-config/commit/48cc6655927447e18fea455c89c7c7066c4ec9f6))
* **roadmap:** add road-to-deep-research-adoption + dashboard sync ([9adc2d8](https://github.com/event4u-app/agent-config/commit/9adc2d8b0dd7ee0cdd2b919a4d776cab0f9f4b7a))
* **analysis:** add deep-research harvest comparison ([4f5ead5](https://github.com/event4u-app/agent-config/commit/4f5ead50ee02de32016262fe6189208c7f9c6cbc))
* **council:** add deep-research harvest prioritization Q&A ([1b08ea5](https://github.com/event4u-app/agent-config/commit/1b08ea5bdac158bb119f0851684f391e69e26c72))
* add Microck deep-scan harvest analysis, council artifacts, and roadmap ([36baf23](https://github.com/event4u-app/agent-config/commit/36baf23ef898ab860163fcacfa9239a403032df0))
* add Microck methodology comparison analysis ([1e34e78](https://github.com/event4u-app/agent-config/commit/1e34e788877a9f6101af5426587de63156e267dd))
* add markitdown adoption analysis, council artifacts, and roadmap ([276b5d4](https://github.com/event4u-app/agent-config/commit/276b5d4374547386d407b1a01995620c90754363))
* **suite:** lock identity as four-wing governed skill suite ([47c8211](https://github.com/event4u-app/agent-config/commit/47c8211ab7b42fa97352f747e2081fba82fe92b5))
* **roadmap:** expand event-driven-discipline with platform tiers ([11edf9b](https://github.com/event4u-app/agent-config/commit/11edf9bb7666eaac18f7b8937437ff07db2b28f7))
* sync active command count to 94 (drift fix) ([9be26bc](https://github.com/event4u-app/agent-config/commit/9be26bc6f4a2dbfd2bb53fe7052ce5717a6f9c47))
* **roadmap:** event-driven agent discipline v3 ([71728cd](https://github.com/event4u-app/agent-config/commit/71728cde49a08f74c9fb44b133befcd4b6b89796))
* **hooks:** relocate payload capture guide to docs/ ([4d39510](https://github.com/event4u-app/agent-config/commit/4d395108d461137e4df15adb04eed5fdd2a27dbb))
* **rules,roadmap:** inline user-interaction failure-mode catalog + chat-history verified-platforms roadmap ([7ec07a0](https://github.com/event4u-app/agent-config/commit/7ec07a0733179373bcf3df6affcefe75ce341440))
* **chat-history:** document v3 sidecar shape and legacy kill-switch ([2d1a393](https://github.com/event4u-app/agent-config/commit/2d1a39316c595810b24cc5e14fb153a2cf6a48c3))
* bump remaining 92 → 93 command counts in browse + tools blurb ([1eeb019](https://github.com/event4u-app/agent-config/commit/1eeb019e34f1dfa0747e65eee304b8897c650389))
* regenerate index/catalog and tag sidecar-shrink complexity ([c8e25d8](https://github.com/event4u-app/agent-config/commit/c8e25d86f6b19b10c06a7d845dc81da840ea6fb6))
* bump command count to 93 across README, AGENTS, and architecture ([1902f22](https://github.com/event4u-app/agent-config/commit/1902f2230c433f1f33bf2ae4ad2cfbf2cfc3274c))
* **chat-history:** document session-isolation read contract in platform-hooks context ([a59602e](https://github.com/event4u-app/agent-config/commit/a59602e8ad160f2da90ca8553b4e7c5fd8f62a60))

### Refactoring

* **work-engine:** remove obsolete chat-history heartbeat hook ([df2c6f1](https://github.com/event4u-app/agent-config/commit/df2c6f101edd60f77877c6162753c5b7d13f1992))
* **chat-history:** split learn into import + project-learning workflow ([e11daa5](https://github.com/event4u-app/agent-config/commit/e11daa5c389ca1a4f3dd9b5ca123c57e145476c8))

### Tests

* **budget:** re-baseline TOP5_CEILING after language-and-tone re-sync ([3ac7b7b](https://github.com/event4u-app/agent-config/commit/3ac7b7b5b92d7a1cdfd6b80c6d77151034847939))

### Chores

* **matrix:** regenerate ownership matrix after no-attribution-footers add ([1bb7a9e](https://github.com/event4u-app/agent-config/commit/1bb7a9e452089f57f29c5aa74673fe682ecc682b))
* **index:** regenerate after no-attribution-footers rule add ([0a95647](https://github.com/event4u-app/agent-config/commit/0a9564795b7d1c0a9e353927c07d9f15459f5ee8))
* **tools:** regenerate .windsurfrules after no-attribution-footers trim ([d2a780b](https://github.com/event4u-app/agent-config/commit/d2a780b9c538c22fdc56ebcb1c245b23dababdee))
* **rules:** trim no-attribution-footers to satisfy long_rule budget ([c407192](https://github.com/event4u-app/agent-config/commit/c40719271caddb1ccb0bf7e144aa42a295e391a5))
* **ci:** unblock PR #44 — broken refs + word-count regression ([eccede0](https://github.com/event4u-app/agent-config/commit/eccede000451c4cec5b547deca1d78e0d3d916b5))
* regenerate roadmap progress dashboard ([0c68f5b](https://github.com/event4u-app/agent-config/commit/0c68f5b354a61865836cde2e07fbfb19a3446e31))
* **ownership-matrix:** regenerate after suite-closure work ([0b7f992](https://github.com/event4u-app/agent-config/commit/0b7f9920702df1e8b5b7db47d596caec312e0c17))
* **roadmaps:** tag wing roadmaps with complexity: structural ([1e0c9c6](https://github.com/event4u-app/agent-config/commit/1e0c9c6b32e5ba16f34e62efb56a5a563a42b11c))
* **index:** regenerate agents/index and docs/catalog ([9a3c1cb](https://github.com/event4u-app/agent-config/commit/9a3c1cb5c6730e5d48c85b85cf055f6e0302a5a7))
* **sync:** refresh compression hashes and gitignore ([5f91975](https://github.com/event4u-app/agent-config/commit/5f91975f81c2c1ba0bf079b8366750e2aec1e984))
* **roadmaps:** regenerate roadmaps-progress dashboard ([3d85dbd](https://github.com/event4u-app/agent-config/commit/3d85dbd854cbabc0c85c47685bdb96a22338a9fa))
* **council:** remove unused playwright transport-mode scaffold ([672c512](https://github.com/event4u-app/agent-config/commit/672c5126e477ec43e4cc50d17e34f7ee3bca9a53))
* **council:** default transport mode to manual instead of api ([4a41dfb](https://github.com/event4u-app/agent-config/commit/4a41dfbbaf879f5333ba5b665d5a0e32c4fac82d))
* **roadmap:** regenerate roadmaps-progress dashboard ([6b01795](https://github.com/event4u-app/agent-config/commit/6b01795a267d5f69c5754ef7d59fbb125187be3a))
* **ownership:** regenerate file-ownership matrix ([383d580](https://github.com/event4u-app/agent-config/commit/383d5808d5a0234149a69deb744625b1bc983b95))
* **compress:** re-compress language-and-tone + user-interaction mirrors ([66a9f91](https://github.com/event4u-app/agent-config/commit/66a9f91520775f0097e33f688b2a2fa458c2d14b))
* **index:** regenerate index + catalog after command-count sync ([03cf603](https://github.com/event4u-app/agent-config/commit/03cf603e84feedb7eea1845f39f258dbf0225f3a))
* **hashes:** refresh compression hashes for language-and-tone + user-interaction ([fc361b4](https://github.com/event4u-app/agent-config/commit/fc361b49f19c14ddc3e4b8aa33093d1f9fa4ca7c))
* add chat history cross agend hardening ([b9b9adb](https://github.com/event4u-app/agent-config/commit/b9b9adb2fb14ca089e92070a57821762269517b6))
* **rules:** tighten language-and-tone and user-interaction iron laws ([57fa47d](https://github.com/event4u-app/agent-config/commit/57fa47d4331f0c2043165d82a3cbb2941c6278f9))
* **roadmap:** archive road-to-verified-chat-history-platforms ([b1881f0](https://github.com/event4u-app/agent-config/commit/b1881f084d2d2f9eba225d7144345163fcb0e1b3))
* **handoff:** close cowork chat-history handoff after council verification ([99190c9](https://github.com/event4u-app/agent-config/commit/99190c9f0f3c475ca11bab0e0482b20e82c1717c))
* **roadmap:** regenerate roadmap-progress dashboard ([c7e2ff1](https://github.com/event4u-app/agent-config/commit/c7e2ff14b6d7afc593a2d9b12775f16fe491e452))
* **roadmap:** archive sidecar-shrink roadmap with council notes ([3cd3826](https://github.com/event4u-app/agent-config/commit/3cd3826d86197e8e5297cef300d97ca23d7efc40))
* regenerate file-ownership matrix for /chat-history learn ([537e13e](https://github.com/event4u-app/agent-config/commit/537e13e2ccea293d9f15a0a68ee27bf21f1ddbb7))
* **roadmaps:** archive hook-only and session-isolation; add sidecar-shrink follow-up ([099a81d](https://github.com/event4u-app/agent-config/commit/099a81de5b90bd28dd7e4748612cf2efaf71ff28))
* **docs:** drop roadmap citations from superseded markers ([369eb7e](https://github.com/event4u-app/agent-config/commit/369eb7e33b831daf3cf3a1348637596913923bbe))
* **docs:** sync command counts to 92 after chat-history trim ([0b20e8f](https://github.com/event4u-app/agent-config/commit/0b20e8f05332974ad6ace222dfa152b086a42bf8))
* **docs+settings:** hook-only sweep + remove dead phase-coupling guard ([5a66dc9](https://github.com/event4u-app/agent-config/commit/5a66dc954959c0dd02babb0661014fbf387ffec4))

## [1.19.0](https://github.com/event4u-app/agent-config/compare/1.18.0...1.19.0) (2026-05-05)

### Features

* **rules:** treat slash command as operator and prose as target ([f73947e](https://github.com/event4u-app/agent-config/commit/f73947e93bc8121524d811a5f17d548499023751))
* **ai-council:** auto-prune session folders past retention window ([bbfaa93](https://github.com/event4u-app/agent-config/commit/bbfaa93fd28bc3a84030c30ab9cea429ac68bea5))
* **settings-sync:** additive sync with verbatim user-line preservation ([f996cf3](https://github.com/event4u-app/agent-config/commit/f996cf3811e924d2ffecbc3d11bac447308efc5a))
* **roadmap:** add quality_cadence setting to throttle /roadmap execute pipeline runs ([d5ef7bf](https://github.com/event4u-app/agent-config/commit/d5ef7bf85e70c95103c6fc65507f99fdd35050dd))
* **ci:** add lint_showcase_sessions gate ([c4f48bb](https://github.com/event4u-app/agent-config/commit/c4f48bba05d266899282742320b7f83bc636cc7c))
* **council:** add CLI entry-point with estimate/run/render subcommands (Phase 6.7) ([f20f599](https://github.com/event4u-app/agent-config/commit/f20f5993dda1325f19f8e26a130ef37f995b5a9d))
* **taskfile:** modularize Taskfile.yml into taskfiles/ groups (Phase 6.1) ([41cbe46](https://github.com/event4u-app/agent-config/commit/41cbe46d6f9289c98bb3f717dcac74c44154fc21))
* **hooks:** add verify-before-complete and minimal-safe-diff concerns ([2507aef](https://github.com/event4u-app/agent-config/commit/2507aefcc88857fd120cfd09d5c93555cb89b868))
* **governance:** one-off-script lifecycle + showcase capture + tier-retrofit archive ([0940f91](https://github.com/event4u-app/agent-config/commit/0940f91d74a759de6601f5367e8fd3e2925f4c51))
* **work_engine:** decision-trace + memory-visibility hooks, scoring, contracts ([91cb0a5](https://github.com/event4u-app/agent-config/commit/91cb0a547971ff5f9597997bc36607ca6049be89))
* **rules:** tier frontmatter sweep across all 58 rules + lint + budget rebaseline ([a9c3694](https://github.com/event4u-app/agent-config/commit/a9c3694bb22cbd87574c1ffd53d0cb9b76a60479))
* **hooks:** per-platform bridges, install integration, hooks:status, smoke ([c33058a](https://github.com/event4u-app/agent-config/commit/c33058a49a20c6d4d21a7933b85ea3b618a6d433))
* **hooks:** universal dispatcher, manifest, envelope, state I/O ([28c4f8c](https://github.com/event4u-app/agent-config/commit/28c4f8c7f0e7bd50b6403dfeab0dcaa623dd5ca3))
* add collision check to roadmap creation flow ([19b65d5](https://github.com/event4u-app/agent-config/commit/19b65d5f2500ddb7c8bfcbb7466c33de0d64043c))

### Bug Fixes

* **ai-council:** use max_completion_tokens for OpenAI o1 models ([8d9e179](https://github.com/event4u-app/agent-config/commit/8d9e179a36d3ba2c68de09ba426782fd43792b85))
* **skills/roadmap-management:** drop task-ci literal to satisfy portability lint ([790af5e](https://github.com/event4u-app/agent-config/commit/790af5e61a3af3472027d2eef1d939106c95d6ea))
* **install.sh:** avoid SIGPIPE race in clean_stale that deleted live files ([08670d6](https://github.com/event4u-app/agent-config/commit/08670d66c6285a84d15e44d00e5cfecc6870a4e7))
* **roadmaps:** re-anchor relative paths in archived 3a protocol ([e0017de](https://github.com/event4u-app/agent-config/commit/e0017de1b55b43e2c8ea5b3f9b51f077cb68e0e3))

### Performance

* **ci:** parallelise test suite — bash xargs -P + pytest-xdist ([2e74b31](https://github.com/event4u-app/agent-config/commit/2e74b3104d0a881832cbebb4dcaddecc865b65c3))
* **ai-council/bundler:** fix catastrophic regex backtracking in redact() ([0e277e7](https://github.com/event4u-app/agent-config/commit/0e277e7ca36b452cc1cc4d8abdeaaa14e9aebbaf))

### Documentation

* **roadmaps:** add chat-history hook-only reduction roadmap ([529f3b7](https://github.com/event4u-app/agent-config/commit/529f3b7c06fae8b560ce0bb436fc701b1418a024))
* **roadmaps:** add road-to-proof-not-features draft ([4664bd4](https://github.com/event4u-app/agent-config/commit/4664bd42a0e0bd8ff9eddc6d8907ff9a217a8f11))
* tighten wording in three rules and one command ([14ed864](https://github.com/event4u-app/agent-config/commit/14ed8640f18e3bfc52819bb150066ecc453fb17a))
* **roadmap:** archive road-to-feedback-consolidation (43/43 done) ([f053c6d](https://github.com/event4u-app/agent-config/commit/f053c6df94620a4cbf89e75ba73a7bb369c9395b))
* **roadmap:** close Phase 1 — showcase infra shipped, sessions deferred ([49a156b](https://github.com/event4u-app/agent-config/commit/49a156b40eecd728841b2eaef3565850f1020e0a))
* **roadmap:** close Phase 6 — mark 6.1/6.4/6.5/6.7 complete (89%) ([4b645cf](https://github.com/event4u-app/agent-config/commit/4b645cf9fc9acb7b7bc227f790e00c3efae66790))
* **readme:** 3-path entry table + tier-coverage drift sentinel (Phase 6.4 + 6.5) ([ae712f0](https://github.com/event4u-app/agent-config/commit/ae712f034e5eb67481175835d7a9eded921ee222))
* **roadmap:** mark Phase 5 complete (Tier-1 hook concerns shipped) ([433c5d1](https://github.com/event4u-app/agent-config/commit/433c5d1efb352de26671caed0e24a6b1e673eab6))
* **readme:** trim under 500-line linter ceiling ([2c3b496](https://github.com/event4u-app/agent-config/commit/2c3b496552cdd73b02e7b08d5c231a9f86e326c3))
* **agents:** roadmap progress, ownership matrix, agents index sync ([2368e37](https://github.com/event4u-app/agent-config/commit/2368e37aee886125997bfda4299599ebea9a14ec))
* add feedback consolidation roadmap and regenerate dashboard ([96fce45](https://github.com/event4u-app/agent-config/commit/96fce45055b2da367b8a45536c7a5bdcd1e03d84))

### Refactoring

* **hooks:** concerns share atomic-write state I/O + dispatcher-friendly stdin ([5cac705](https://github.com/event4u-app/agent-config/commit/5cac705edfd46ad8d27ffd0008bdf4723317a4eb))

### Tests

* **hooks:** parity tests for tier-1 hook concerns ([540468c](https://github.com/event4u-app/agent-config/commit/540468cd150447d6b588d3015865660a555e4f8d))

### Chores

* **tools:** regenerate .windsurfrules with slash-command-routing-policy operator/target sections ([7825600](https://github.com/event4u-app/agent-config/commit/78256000a2da9cc313eb272059bb363acbc5290e))
* **rules:** sync compressed slash-command-routing-policy with operator/target sections ([916357c](https://github.com/event4u-app/agent-config/commit/916357c7d185d717187845478e8318025330d3a9))
* **rules:** promote verify-before-complete and minimal-safe-diff to tier 2a ([d62fb84](https://github.com/event4u-app/agent-config/commit/d62fb845a14065706c46c4425b261b57ac155c27))
* ignore .agent-chat-history.session sidecar ([42741c8](https://github.com/event4u-app/agent-config/commit/42741c87f83bf24416eb3916cbced865ae642688))
* **infra:** wire lint-rule-tiers + lint-hook-manifest + lint-one-off-age tasks; pyproject pytest importlib; .windsurfrules Copilot fallback ([5b88093](https://github.com/event4u-app/agent-config/commit/5b8809398dd332a3ebad3478f7a38cf48ef119e1))
* **roadmaps:** archive structural-optimization companion artefacts ([928c884](https://github.com/event4u-app/agent-config/commit/928c88469787cd037c54acd0006039ee9b86f9bb))

## [1.18.0](https://github.com/event4u-app/agent-config/compare/1.17.0...1.18.0) (2026-05-04)

### Features

* **rules:** mandate hardening tier classification on new and edited rules ([42ff7c1](https://github.com/event4u-app/agent-config/commit/42ff7c1765e931a3e5e487ef83d01ca597a65800))
* **hooks:** wire Tier 1 hooks on Claude Code for hardening parity ([55ede24](https://github.com/event4u-app/agent-config/commit/55ede24e65b5ab7e827fa3a40b04fe9dab091392))
* **rules:** enforce placement for agent-authored roadmaps ([1624ede](https://github.com/event4u-app/agent-config/commit/1624ede571bcdd28adb7d8dd4868a92b9dbde646))
* roadmap complexity standard with shape and tier linters ([bd1bac6](https://github.com/event4u-app/agent-config/commit/bd1bac650013e449e7318c60586b7648dbcc144e))
* **hardening:** tier-1 hooks for onboarding-gate and context-hygiene ([5d107cd](https://github.com/event4u-app/agent-config/commit/5d107cd6fa1352d609491df12604ae0ddb7d7113))
* **always-budget:** hard-compress direct-answers and no-cheap-questions ([2cb9b0b](https://github.com/event4u-app/agent-config/commit/2cb9b0be7b3e6486c3689fec75e7672507ca97cb))
* outcome baselines and pattern-memory demos for foundational rules ([f43ede7](https://github.com/event4u-app/agent-config/commit/f43ede70a59cb7460557e6d76b041562056e78ee))

### Bug Fixes

* **check-refs:** treat .augment/state/*.json as runtime-only paths ([3d4c766](https://github.com/event4u-app/agent-config/commit/3d4c76695af38e764facc8630a97e553f5aac67f))
* **rules:** sync compressed rules with hardening callouts ([89bd072](https://github.com/event4u-app/agent-config/commit/89bd07267d04d6346a1f36df92759c9208777a9a))

### Documentation

* **contexts,contracts:** unlink stable artifacts from archived roadmaps ([af4e5c2](https://github.com/event4u-app/agent-config/commit/af4e5c2de6dfb0d2143f48213e04d41c9354deca))
* **contexts:** lock Tier 2 nudge surface, Tier 3 dispositions, platform parity ([10685a7](https://github.com/event4u-app/agent-config/commit/10685a7f3fceec1b93365cef3531a5e81f55396f))
* **roadmaps:** relocate budget-v2-matrix to contexts as durable rationale ([33b903a](https://github.com/event4u-app/agent-config/commit/33b903a36feeacffddedde11ff9b1bc3bd5173e3))

### Refactoring

* **state:** move hook runtime state from .augment/state/ to agents/state/ ([ef5265e](https://github.com/event4u-app/agent-config/commit/ef5265e1ead67b089c4438efcbd4e94f120c6d3e))

### Chores

* **plugin:** restructure marketplace.json to registry shape ([f3e6f24](https://github.com/event4u-app/agent-config/commit/f3e6f2425fefef2cc5fc338d27e8628ab45a4d41))
* **council:** archive Budget-v2 audit one-off ([00bf46e](https://github.com/event4u-app/agent-config/commit/00bf46e680e3a66bdbddac35e1ec3a08a8aa11f4))
* **roadmaps:** archive hardening and context-layer-maturity tracks ([21dec26](https://github.com/event4u-app/agent-config/commit/21dec26b7a6455ab95df6704773426e3dd35574f))
* regenerate dashboards, hashes, and roadmap progress ([06c50a9](https://github.com/event4u-app/agent-config/commit/06c50a9653bf4250a557ba2fe5a39b8609b3df30))
* archive ai_council one-off scripts and add location guard ([63e6dbd](https://github.com/event4u-app/agent-config/commit/63e6dbdc49749e97621bcaeaa49f81beb5ffc98c))

## [1.17.0](https://github.com/event4u-app/agent-config/compare/1.16.0...1.17.0) (2026-05-04)

### Features

* **commands:** nest commit/create-pr/feature sub-commands under colon namespace ([ceef48b](https://github.com/event4u-app/agent-config/commit/ceef48bd5b5ff550bc560e722516037a4f45e895))
* **rules:** add no-roadmap-references rule + CI linter ([a2882a8](https://github.com/event4u-app/agent-config/commit/a2882a8a424b6bee8829426f19e531931e9c77c2))
* **hooks:** add roadmap-progress-sync pilot hook ([48484f2](https://github.com/event4u-app/agent-config/commit/48484f28cf1ca8857c54d65e7965f62aed552ea2))
* **budget:** add concentration gate + trend logging ([06f3855](https://github.com/event4u-app/agent-config/commit/06f385518e8326bc4528a7bf7ebfc0c639ddd89a))
* **council:** add /council cluster dispatcher ([e7aa0c6](https://github.com/event4u-app/agent-config/commit/e7aa0c6970db634b484046f5899165e8fd3ac8a2))
* **rules:** slim 12 auto-rules — extract mechanics to load_context (Phase 2B) ([9d211c6](https://github.com/event4u-app/agent-config/commit/9d211c68824dde0e7c21592a3079f76deae8cd96))
* **commands:** Phase 1 — command cluster Phase 2 dispatchers + shims ([2e9d8e0](https://github.com/event4u-app/agent-config/commit/2e9d8e0fcb85f1b34d528a3f3e991e6cd5ba1388))
* **followups:** land Phase 1 — load_context: rollout regression test + 1.15 archive verification (F2, F12) ([4ce552a](https://github.com/event4u-app/agent-config/commit/4ce552a8181668ee4c7ac20d669ce179dbdd4ab6))
* **followups:** land Phase 0b.2 budget headroom recovery (F10) ([62838b3](https://github.com/event4u-app/agent-config/commit/62838b3df6fe7493876594ed84c908241cc286c7))
* **structural:** lock Phase 0.4 2A.4 contract after council acceptance ([70a13d3](https://github.com/event4u-app/agent-config/commit/70a13d3a17bbea11a7b55af3bd8c16f130d954f2))
* **structural:** land Phase 0.5 3a-spike scoring protocol + persona-voice rubric ([0fac3eb](https://github.com/event4u-app/agent-config/commit/0fac3ebafa00855d69dc9ca4cbade1a8b3797244))
* **structural:** land Phase 0.4 2A.4 worked example ([e1412d3](https://github.com/event4u-app/agent-config/commit/e1412d345eb5432e4443b3e077bc1693d2cf3855))
* **structural:** land Phase 0.3 Phase 6 -> 2B decoupling proof ([67b1024](https://github.com/event4u-app/agent-config/commit/67b1024560552547d79019c3566c1dec0299a948))
* **structural:** land Phase 0.2 load_context: budget accounting model ([32cfcd4](https://github.com/event4u-app/agent-config/commit/32cfcd41d23998a705128c78f2c0a2bcdf341c87))
* **structural:** land Phase 0.1 file-ownership matrix schema + generator ([d1dfb02](https://github.com/event4u-app/agent-config/commit/d1dfb024d4ef31aab88bfd749a6e5e5167ac5d75))
* **structural:** land Phase 0.6 context-file path conventions ([e9c72f4](https://github.com/event4u-app/agent-config/commit/e9c72f4bde948c38bde6e5e740852c29582df91c))

### Bug Fixes

* **refs:** repair 4 broken cross-references ([7b0f014](https://github.com/event4u-app/agent-config/commit/7b0f014db19af0e9d68979a3ff9d12555f1ee6f5))
* **sync:** prevent recursive _user prefixing and heal legacy corruption ([0cb0845](https://github.com/event4u-app/agent-config/commit/0cb0845320e14584348505fa0540315091ba7ef9))
* **ci:** install pyyaml in consistency workflow ([bbad5d0](https://github.com/event4u-app/agent-config/commit/bbad5d06009a3f204051ca3b01102827162fe2f3))
* **check-refs:** skip references into SKIP_DIRS (gitignored audit trails) ([cd6fcce](https://github.com/event4u-app/agent-config/commit/cd6fcce5411c35baaf228dc3fe0a4202acab6eca))
* **roadmaps:** mark example/spike/coupling docs as status: draft ([d84dcf4](https://github.com/event4u-app/agent-config/commit/d84dcf44a9f777d87ef273b700ef66389216157d))
* **compress:** carry load_context into compressed slash-command-routing-policy ([8332fb0](https://github.com/event4u-app/agent-config/commit/8332fb06a4c61ec65e9e21a6a123ea10484477de))

### Documentation

* repoint cross-references to nested command paths ([fbfb048](https://github.com/event4u-app/agent-config/commit/fbfb0481113aa065779ace75cbd0914eaf002d7c))
* **roadmap:** add Phase 0a closeout hygiene to rule-hardening ([d68c4f2](https://github.com/event4u-app/agent-config/commit/d68c4f22d09ed9c3b567e996834c0148ffd17492))
* sync command-count messaging in README/AGENTS/getting-started ([c683e9a](https://github.com/event4u-app/agent-config/commit/c683e9a4bc93294940a8f07402f88510796d91d8))
* **roadmap:** rule-hardening v2 — council-reviewed revisions ([4d9e225](https://github.com/event4u-app/agent-config/commit/4d9e225108b9c647157eb1f6df9b55c13665588e))
* **roadmaps:** add context-layer-maturity v2 and rule-hardening ([620961b](https://github.com/event4u-app/agent-config/commit/620961b3f469ddf0ac40ee491c3b65cab0e1000a))
* **phase6:** chat-history-* trigger overlap audit — Path B (orthogonal) ([62ffad2](https://github.com/event4u-app/agent-config/commit/62ffad234c50ab9930115813e6801a2a8e976199))
* **phase3:** consolidation audit — DO NOT CONSOLIDATE verdict ([03dc6aa](https://github.com/event4u-app/agent-config/commit/03dc6aad88aee2ebd85bd1d95f402742fcce05d1))
* **readme:** trim Requirements section to clear lint-readme overload threshold ([30bf18d](https://github.com/event4u-app/agent-config/commit/30bf18da26ce69fe8bf1d688309ad375a082de6b))
* **counts:** sync command-count messaging after Phase 1 clusters ([8902f49](https://github.com/event4u-app/agent-config/commit/8902f49f3239274828d13ce61a2b28a415dda3f5))
* **roadmap:** drop slow-rollout protocol; lock single-PR execution (v3.2) ([35885b0](https://github.com/event4u-app/agent-config/commit/35885b01ee3c1510b2e30ad9a3bd40b686efefdf))
* **followups:** land Phase 2 — README onboarding anchor + host-agent terminology (F1, F3, F4) ([cd12f97](https://github.com/event4u-app/agent-config/commit/cd12f9717c6b6e34efa01e55046d9f0ba0276286))
* **roadmap:** close out 1.16 followups Phase 0a (F9 + F14 = no-op) ([6171f80](https://github.com/event4u-app/agent-config/commit/6171f805729d45084fee80704be9ec6908f1c84e))
* **ai-council:** add experimental banner per F11 ([17308e1](https://github.com/event4u-app/agent-config/commit/17308e124fa436fac47f42649a5d1abcdb20f503))
* **roadmap:** add 1.16.0 follow-ups roadmap v1.1 ([e402e1d](https://github.com/event4u-app/agent-config/commit/e402e1d599d1797a04a70b9fb538fa0bae913645))
* **roadmap:** add structural-optimization roadmap v3.1 ([547f802](https://github.com/event4u-app/agent-config/commit/547f8024671e1f79570b2a5d69218f93ef1a346c))

### Refactoring

* **commands:** nest cluster commands into subdirectories ([5fd0df3](https://github.com/event4u-app/agent-config/commit/5fd0df387f0f2182e029fc3f40e5bce3fc4ed598))
* **refs:** purge roadmap-file links from stable artifacts ([b5a1429](https://github.com/event4u-app/agent-config/commit/b5a1429e3f6a7fa754e816d9ddb1c4b0a6034735))
* **rules:** amortize shared brevity examples to guideline ([ee581f6](https://github.com/event4u-app/agent-config/commit/ee581f69cc1106ec485dfb7f3ac07ffc2e2886cb))

### Tests

* **followups:** land Phase 0b.1 failure-mode coverage (F13) ([9560667](https://github.com/event4u-app/agent-config/commit/9560667a328f746316828ab44f0a7ba1fe8c254c))

### Chores

* **generated:** regenerate compressed dispatchers + hash registry ([552ddfe](https://github.com/event4u-app/agent-config/commit/552ddfeef4837b9681fc3ee72a1a01cf6c230d1a))
* **commands:** drop ## Migration sections from cluster dispatchers ([02a03e7](https://github.com/event4u-app/agent-config/commit/02a03e7b7fbcc62c1203b7fedef38f0685e85321))
* **generated:** regenerate compressed sources, tool projections, marketplace, ownership matrix ([f1dddd2](https://github.com/event4u-app/agent-config/commit/f1dddd2499625382b7f7902268bdd468426ce515))
* **test:** align command-suggester golden + count gate to colon naming ([e1aad41](https://github.com/event4u-app/agent-config/commit/e1aad41624b877e4cb066d6e5075326de79f3693))
* **generated:** regenerate file-ownership-matrix after command nesting ([12dc0f3](https://github.com/event4u-app/agent-config/commit/12dc0f3b266d6cdec6a53c918fc86098103d0373))
* **generated:** regenerate compressed sources, tool projections,                    marketplace, and ownership matrix ([6724878](https://github.com/event4u-app/agent-config/commit/67248786c7589a63c2dabc80b683ace602611ddf))
* **tooling:** teach scripts to walk nested command directories ([fe5913e](https://github.com/event4u-app/agent-config/commit/fe5913ef2ab6766a042d5e9470e0871d80804ddd))
* **generated:** regenerate counts, hashes, windsurfrules ([5613b48](https://github.com/event4u-app/agent-config/commit/5613b4858da531a23aa27e23a2bda561152d3809))
* **roadmaps:** archive 4 closed phase-evidence reports ([d5995c3](https://github.com/event4u-app/agent-config/commit/d5995c31febb3dad31df95d72970de1e1bcf3181))
* **generated:** regenerate file-ownership-matrix ([75ff69f](https://github.com/event4u-app/agent-config/commit/75ff69fdb45952e00320918d597ea2db239a7f0b))
* **generated:** regenerate windsurfrules + counts + claude council-default ([02ad3e1](https://github.com/event4u-app/agent-config/commit/02ad3e1079f797f8a72c33f800f1d395499b951e))
* add ai council scripts ([4cf513c](https://github.com/event4u-app/agent-config/commit/4cf513c90649292324579444f586becd78cfad96))
* **roadmap:** close & archive road-to-structural-optimization ([3bfef51](https://github.com/event4u-app/agent-config/commit/3bfef5118cdb66db5809fddb3688bb22d3aa8aff))
* **compression:** refresh compression hashes ([20717d7](https://github.com/event4u-app/agent-config/commit/20717d798c86dd99f17d4c851ea0a8754e249333))
* regenerate ownership matrix after Phase 2B rule slimming ([17ac19c](https://github.com/event4u-app/agent-config/commit/17ac19cf1938c7fca945b4500c6232cfa4549f2c))
* **structural:** regenerate file-ownership-matrix after Phase 1 clusters ([29aabb1](https://github.com/event4u-app/agent-config/commit/29aabb11351f9fe648644b508eb6d24a5870b160))
* **sync:** regenerate agents/index.md + docs/catalog.md after Phase 1 clusters ([f07987a](https://github.com/event4u-app/agent-config/commit/f07987ac12aaa77cbc4c7584ac00607e5a438318))
* **sync:** regenerate compressed outputs + tool projections for Phase 1 clusters ([99466c0](https://github.com/event4u-app/agent-config/commit/99466c0a77116c7ed70db38fd957d061ad18e307))
* **sync:** compress contexts/judges/persona-voice-rubric.md into .agent-src/ ([4060d01](https://github.com/event4u-app/agent-config/commit/4060d01af0680c2a913295166b978b605b1453db))
* **roadmap:** archive road-to-1-16-followups (100% done) + regen dashboard ([f78a9ad](https://github.com/event4u-app/agent-config/commit/f78a9ada649c01c03aa4e866e20bb32b547cd9d0))
* **roadmap:** regenerate progress dashboard after 1.16 followups Phase 1+2 ([780db39](https://github.com/event4u-app/agent-config/commit/780db39b68230b68c51f158d8cc8b78e7937a40c))
* **ai-council:** add multi-provider council scripts and openai sdk ([3c2360d](https://github.com/event4u-app/agent-config/commit/3c2360d137069287b7e2547a6132d36ebed09978))
* add task command, to install chatgpt key ([1acea8b](https://github.com/event4u-app/agent-config/commit/1acea8b6dc329c70079cec42d5a98886c913acfd))

### Other

* **commands:** update cross-references to colon-namespaced sub-commands ([13caa6d](https://github.com/event4u-app/agent-config/commit/13caa6d9c116012f726947fa50a281ca34ce16c2))
* fix_: thinking drift ([1d2d158](https://github.com/event4u-app/agent-config/commit/1d2d15833e6b9764e7c734e66b25cecdf1dc12ab))

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
* **commands:** add /commit:in-chunks for autonomous commit splitting ([b53fa7b](https://github.com/event4u-app/agent-config/commit/b53fa7b277a107af8acc6076baf8c985f0fbb901))
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
* address consumer-api PR [#1466](https://github.com/event4u-app/agent-config/issues/1466) bot feedback ([c5f8e18](https://github.com/event4u-app/agent-config/commit/c5f8e18a6c429e2f8f0224e1d9130233107ce65e))
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
- Hardcoded `consumer` references removed from installer and portability
  checker. No public release ever shipped the legacy `# consumer/agent-config`
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
