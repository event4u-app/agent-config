# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).
Entry-shape contract: [`docs/contracts/CHANGELOG-conventions.md`](docs/contracts/CHANGELOG-conventions.md).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.
>
> History is split into **eras**. The current era keeps full entries
> inline; prior eras collapse into a single pointer to an archive file
> under [`docs/archive/`](docs/archive/). A drift test
> (`tests/test_changelog_eras.py`) forces an era split before the
> current era grows past 200 lines.

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

# Era: 2.2.x — current

> Started at `2.2.0` (2026-05-12). Full entries live inline below.
> The drift test caps this era at 200 lines of entry body; growth past
> that forces a new era split (`# Era: 2.6.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [2.6.1](https://github.com/event4u-app/agent-config/compare/2.6.0...2.6.1) (2026-05-13)

### Chores

* **gitignore:** add /agents/state/ to consumer template ([80449c4](https://github.com/event4u-app/agent-config/commit/80449c4fa13ca847f8af925d4b7e472658c60aef))

Tests: 3530 (+0 since 2.6.0)

## [2.6.0](https://github.com/event4u-app/agent-config/compare/2.4.1...2.6.0) (2026-05-13)

### Features

* **claude-desktop:** bundle commands as desktop skills ([50cd319](https://github.com/event4u-app/agent-config/commit/50cd31988ac571ecdf883c5d2c6d62c209820ebc))

### Other

* 2.5.0 ([1da0e10](https://github.com/event4u-app/agent-config/commit/1da0e1014b9cf24cf41d820795f96f2668ce738c))

Tests: 3530 (+9 since 2.4.1)

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

# Era: pre-2.2.0 — archived

> All entries from `2.1.0` and earlier live in
> [`docs/archive/CHANGELOG-pre-2.2.0.md`](docs/archive/CHANGELOG-pre-2.2.0.md).
> The archive is read-only; git tags `2.1.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
