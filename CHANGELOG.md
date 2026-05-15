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

**Tier-0 trim (`road-to-surface-discipline` Phase 1)** — six CLI
commands moved from Tier-0 to Tier-1 in `./agent-config --help` to
collapse the daily-driver surface down to the seven commands a new
contributor actually needs in their first session. Commands stay
fully invokable by full name — only the default `--help` view
changed. Source of truth: `docs/contracts/command-surface-tiers.md`.

Pre/post diff of `./agent-config --help` Tier-0 block:

| Command | Pre | Post | Rationale |
|---|:-:|:-:|---|
| `init` | Tier-0 | Tier-0 | daily-driver entrypoint |
| `sync` | Tier-0 | Tier-0 | daily-driver entrypoint |
| `validate` | Tier-0 | Tier-0 | daily-driver entrypoint |
| `work` | Tier-0 | Tier-0 | daily-driver entrypoint |
| `implement-ticket` | Tier-0 | Tier-0 | daily-driver entrypoint |
| `help` | Tier-0 | Tier-0 | help meta-command |
| `--version` | Tier-0 | Tier-0 | help meta-command |
| `first-run` | Tier-0 | **Tier-1** | one-time setup; not in daily loop |
| `keys:install-anthropic` | Tier-0 | **Tier-1** | one-time credential setup |
| `keys:install-openai` | Tier-0 | **Tier-1** | one-time credential setup |
| `council:estimate` | Tier-0 | **Tier-1** | on-demand review tool |
| `council:run` | Tier-0 | **Tier-1** | on-demand review tool |
| `council:render` | Tier-0 | **Tier-1** | on-demand review tool |

Net surface delta: **0 new commands, 0 removed commands.** Only the
`--help` surfacing changed. Run `./agent-config --help --tier=1` for
the full power-user view (15 commands) or `--tier=all` for
maintenance / hooks / MCP / telemetry (26 additional commands).

**Diagnostic Hub (`road-to-surface-discipline` Phase 2)** — the
existing `./agent-config doctor` is repositioned as the single
entrypoint for health checks. New `CHECK_IDS` registry plus
`doctor --check <id>` filter; `--list-checks` enumerates every
runner; failing checks print the literal command line that
reproduces the failure. Surface delta: **0 new commands** — only
flags and registry plumbing.

**MCP beta gating (`road-to-surface-discipline` Phase 3)** — MCP
promotion criteria pinned in
[`docs/contracts/mcp-beta-criteria.md`](docs/contracts/mcp-beta-criteria.md)
with a four-gate contract (offline-readiness, scope, drift, runtime).
`doctor --check mcp-beta-readiness` enforces the gates; failing tests
under `tests/test_mcp_beta_gates.py` codify the promotion bar.
Cloud-scope behaviour cross-referenced from
[`docs/contracts/mcp-cloud-scope.md`](docs/contracts/mcp-cloud-scope.md).

**Architecture refresh (`road-to-surface-discipline` Phase 4)** —
[`docs/architecture.md`](docs/architecture.md) and
[`docs/mcp-server.md`](docs/mcp-server.md) re-anchor the 6-layer
system model (consumer → tools → installer → package → kernel →
runtime). `AGENTS.md` re-trimmed to honour the Thin-Root contract
(< 3,000 chars). No code churn — docs only.

**Tier-usage telemetry (`road-to-surface-discipline` Phase 5)** —
empirical retiering signal added behind a default-off opt-in. New
`telemetry.tier_usage` namespace in `.agent-settings.yml`; signal
contract pinned in
[`docs/contracts/command-clusters.md`](docs/contracts/command-clusters.md)
§ tier-usage (whitelist: `ts_bucket`, `command`, `tier`, `outcome`,
`user_hash`; hourly time buckets; 16-char salted user hash; no paths,
no argv). Retiering thresholds (≥ 20 invocations and ≥ 3 distinct
users over 30 days) live in the same contract. A new
`tier_usage_report.py` template script aggregates the local log into
a frequency table and refuses to render rows that violate the
privacy floor. The existing `doctor` gains a `tier-usage-readiness`
check (warn when disabled or empty; fail when every record is
poisoned; ok when ≥ 1 record passes the floor). Surface delta: **0
new commands, 0 new skills, 0 new personas** — telemetry rides on
the existing dispatcher and the existing `doctor` entrypoint.


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

# Era: 2.11.x — current

> Started at `2.11.0` (2026-05-14). Full entries live inline below.
> The drift test caps this era at 200 lines of entry body; growth past
> that forces a new era split (`# Era: 2.12.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [2.13.0](https://github.com/event4u-app/agent-config/compare/2.12.0...2.13.0) (2026-05-14)

### Features

* **council:** Phase 7 — debate orchestration + CLI wiring ([647a3f0](https://github.com/event4u-app/agent-config/commit/647a3f07698792f41beb7413600d54b2321f4a96))
* **council:** Phase 7 — /council debate sub-command files ([abbd436](https://github.com/event4u-app/agent-config/commit/abbd43666b7e2c704ab3c46f2901f01eae446139))
* **council:** Phase 6 — thinking-style advisor personas ([21c8b88](https://github.com/event4u-app/agent-config/commit/21c8b88310a2a65d7ea9082da085d023f813d114))
* **council:** Phase 5 — Karpathy peer-review opt-in flag ([bce381a](https://github.com/event4u-app/agent-config/commit/bce381ae9c412abf501473fa4154f91d9c0befbf))
* **council:** analysis lens + lens-adaptive synthesis + consensus scoring ([6d7136a](https://github.com/event4u-app/agent-config/commit/6d7136ad6be31b7627a332600a7623f2cd929e76))
* **council:** add config loader, overlay, and 3 new provider clients ([0cb5591](https://github.com/event4u-app/agent-config/commit/0cb55914457a62b6f57744d8c8dac16bf777921d))
* **council:** introduce agents/.ai-council.yml as single source of truth ([043c2d2](https://github.com/event4u-app/agent-config/commit/043c2d23445f2ef7ad8aee880dc83d97c347635f))
* **governance:** Phase 5 — roadmap trajectory metric + architectural-consensus ADR ([926a632](https://github.com/event4u-app/agent-config/commit/926a63237c3dbe1fcfd7df05c9230809382d8790))
* **projection:** Phase 4 + 1.4 — multi-tool projection fidelity contract + ci-strict gate ([e18e4ad](https://github.com/event4u-app/agent-config/commit/e18e4ad73595e17889009b0123ebd000254c165b))
* **routing:** Phase 3 — tighten skill descriptions + 4 tier-3 routing rules for failing clusters ([2a11c70](https://github.com/event4u-app/agent-config/commit/2a11c70b274741e7d98fd814ac39c1d05a1a38c9))
* **governance:** Phase 1 — credibility (CONTRIBUTING preface, source-projection rename, archive 7 migration scripts) ([2e5cfe0](https://github.com/event4u-app/agent-config/commit/2e5cfe02e1b5f4218d1283108796b0ce43fd9165))

### Bug Fixes

* **docs:** drop transient council-sessions citation from multi-tool-projection ([55dbbb1](https://github.com/event4u-app/agent-config/commit/55dbbb1e599aae2d913dc56a05c9dab0014e2739))
* **linter:** treat ../docs/contracts/ links as out-of-scope like guidelines ([a2249b0](https://github.com/event4u-app/agent-config/commit/a2249b02b70233e2b13ccf3efeda4188686b6181))
* **routing:** strip transient roadmap citation from tier-3 routing rules ([2cf745c](https://github.com/event4u-app/agent-config/commit/2cf745cad9beb40c4e6e9eb7f97abbc58a94d9de))

### Documentation

* **roadmap:** rename "rule" to "invariant" for deep_min_rounds reference ([758ea46](https://github.com/event4u-app/agent-config/commit/758ea46568c23ef5518ff61d80700f7559bc54a1))
* **ai-council:** sync compressed SKILL.md with Phase 6 advisors section ([6d57034](https://github.com/event4u-app/agent-config/commit/6d57034c7b342abdd5d38ff300fa67c51deb3471))
* **council:** document master/wrapper contract for the council cluster ([7346f34](https://github.com/event4u-app/agent-config/commit/7346f34376b48c02ced3ae939dfff6ea215025ba))

### Tests

* **ai-council:** Phase 8 — negative-test backfill for config loader ([cc3a08c](https://github.com/event4u-app/agent-config/commit/cc3a08c360c94685f9a1efaaa57f84001f78788c))

### Chores

* **roadmaps:** archive step-2-ai-council-consolidation — all phases + ACs done ([c7f0c9c](https://github.com/event4u-app/agent-config/commit/c7f0c9ca7ac300023c5da0b939e0c63554dbcfed))
* **docs:** bump getting-started command count 106 -> 108 after council debate sub-command ([5e256d7](https://github.com/event4u-app/agent-config/commit/5e256d79d3eea3046900e8afa5be64526b4fc61d))
* **roadmaps:** retag complexity from "medium" to lint-valid values ([4c5457e](https://github.com/event4u-app/agent-config/commit/4c5457e271f8dcdc03943bac7adff84455388615))
* regenerate index + catalog for council-debate skill ([3c365a3](https://github.com/event4u-app/agent-config/commit/3c365a375da22f16f97829677c875500e40d436a))
* **roadmap:** mark Phases 6-7 of step-2-ai-council-consolidation complete ([7e8e557](https://github.com/event4u-app/agent-config/commit/7e8e557505bbf88b486605980a7f5ee2f97bcbb4))
* **roadmap:** mark Phases 1-4 of step-2-ai-council-consolidation complete ([101a5cf](https://github.com/event4u-app/agent-config/commit/101a5cf70d4fc694f85a270b2bebfb8fe545833a))
* **roadmap:** mark Phase 0 of step-2-ai-council-consolidation complete ([4fa2734](https://github.com/event4u-app/agent-config/commit/4fa27346c8faad54de582757ce5cfe7216041bda))
* **template:** bump agent_config_version pin to 2.12.0 ([e5c41fd](https://github.com/event4u-app/agent-config/commit/e5c41fd433105359d6e36b03b0de62415be212f0))
* regenerate agents/index.md + docs/catalog.md after rule additions ([b7fa4b6](https://github.com/event4u-app/agent-config/commit/b7fa4b6e25cbc55d8b3197f815c00530bd1eee79))
* **roadmap:** archive completed step-1-v2-feedback-followup (20/20 done) ([88a07ea](https://github.com/event4u-app/agent-config/commit/88a07ea9a983f0b63710e5461c8fddee36b2d378))

Tests: 3868 (+150 since 2.12.0)

## [2.12.0](https://github.com/event4u-app/agent-config/compare/2.11.0...2.12.0) (2026-05-14)

### Features

* **linter:** evals.json schema validator + meta_skill exemption ([9568510](https://github.com/event4u-app/agent-config/commit/95685109540c7f2dc2643ec24ba9d996467e0645))
* **skill-writing:** § 7 quantitative eval loop + run_skill_evals.py ([9eda402](https://github.com/event4u-app/agent-config/commit/9eda402dc43b8e14682787fb1cbbc9872eb16fcc))
* **skills:** add doc-coauthoring from Anthropic ([161b904](https://github.com/event4u-app/agent-config/commit/161b9044743753f2e54bcae45c36a29daaa8058d))
* **skills:** add canvas-design from Anthropic ([95c247c](https://github.com/event4u-app/agent-config/commit/95c247c08d3c6710c53bfcd7ba7a00f270e0d8d4))
* **check-refs:** add file/line opt-out markers ([f381bcb](https://github.com/event4u-app/agent-config/commit/f381bcb5a08818e042af35836dd2c4d8965aa98e))
* make ai-council max_output_tokens configurable ([5976b46](https://github.com/event4u-app/agent-config/commit/5976b4623b94277f6ba49b0e82bb36ab7d5adb50))

### Bug Fixes

* **marketplace:** register canvas-design + doc-coauthoring ([9fbfe6a](https://github.com/event4u-app/agent-config/commit/9fbfe6af83589bf45b27b72c1b818be9772ae60c))

### Documentation

* **audit:** mark forward-refs in north-star bundle as opt-out ([a1d7c21](https://github.com/event4u-app/agent-config/commit/a1d7c21df3d05c27bacf81344893c4e43ae72a06))
* **roadmap:** expand step-99 with Total Dominance mandate ([c46cffd](https://github.com/event4u-app/agent-config/commit/c46cffd54214a61230be27ddaae3367053be39a5))
* **roadmap:** add step-99 north-star restructure (meta · out-of-band) ([8dd18f9](https://github.com/event4u-app/agent-config/commit/8dd18f963742d14dd9d006237ddd93881b198a60))
* **audit:** correct step-3 filename reference ([ee6bd7f](https://github.com/event4u-app/agent-config/commit/ee6bd7ffc6c6cd363b6207b6ff32aa72f2bc317e))
* **audit:** add 2026-05-14 north-star audit + council synthesis ([589c2fb](https://github.com/event4u-app/agent-config/commit/589c2fbd3e35b57529ab0f934665d71d611012d4))
* add roadmaps for council, persona, ghostwriter, user-types axis ([471fae3](https://github.com/event4u-app/agent-config/commit/471fae3a46182d930fea21adb4037a41ec99dcb3))
* add v2 feedback follow-up roadmap ([23d17cb](https://github.com/event4u-app/agent-config/commit/23d17cb24b33e794f7c1e31e76055cc5c8f1ab6c))

### Chores

* prefix roadmaps with step-N execution sequence ([de87232](https://github.com/event4u-app/agent-config/commit/de87232213404ad104e07c5ca831d64f4a607f8e))

Tests: 3718 (+0 since 2.11.0)

## [2.11.0](https://github.com/event4u-app/agent-config/compare/2.10.0...2.11.0) (2026-05-14)

### Features

* **stability:** add beta-review marker protocol and CI gate (P5.4) ([9b6cdfe](https://github.com/event4u-app/agent-config/commit/9b6cdfe9f9167e3e80551dfa2a88f80fff85646a))
* **lint:** add 'type: orchestrator' frontmatter tag for cluster routers (P5.3) ([e6385bb](https://github.com/event4u-app/agent-config/commit/e6385bbaf022dc3763f55c2dd54fe85046c59fd4))
* **skills:** add nextjs-patterns and symfony-workflow workflow skills (P4) ([038522b](https://github.com/event4u-app/agent-config/commit/038522b7ad2bd2ba1d8d8c4f9a61692694b7ebc8))
* **onboard:** add Quickstart pointer step and surface balanced default (P3.3) ([5879b4c](https://github.com/event4u-app/agent-config/commit/5879b4cc66fc9f49fa42c99e72794e4c60f43739))
* **install:** default cost_profile to balanced (P3.2) ([75caac2](https://github.com/event4u-app/agent-config/commit/75caac20fa2986222b5bd45a7cb63f07f9c4179f))
* **work-engine:** wire decision_gate hook into runner ([c41a89d](https://github.com/event4u-app/agent-config/commit/c41a89d38c7eb4892358b5c931abbe9a5889038c))
* **work-engine:** add decision_engine schema and gate evaluator ([fd1e8e2](https://github.com/event4u-app/agent-config/commit/fd1e8e2bb2e45e2288727ccd4a3bda4f809c6151))
* **release:** release-trunk-sync contract and CI gate (P1.2, P1.3) ([a3e0d12](https://github.com/event4u-app/agent-config/commit/a3e0d12c156c367c995e84c7c0bb5d6a21ff6325))

### Bug Fixes

* **readme:** rename 'For contributors' to 'Development' for linter ([7957274](https://github.com/event4u-app/agent-config/commit/7957274c65895d80fa4801f95df876979362ee86))

### Documentation

* **roadmap:** close + archive road-to-productization (Level-6) ([7ee50e8](https://github.com/event4u-app/agent-config/commit/7ee50e8b16f1ce7d4461f1466d9a6e46f4138101))
* **roadmap:** mark P3.1-P3.3 + P3.1a done in road-to-productization ([b0ff24f](https://github.com/event4u-app/agent-config/commit/b0ff24f23cb38d4ac556106c9ed060f104f83c8c))
* **readme:** add 3-step Quickstart and move contributor detail below the fold (P3.1) ([b98152e](https://github.com/event4u-app/agent-config/commit/b98152eb86607d6b34f63ea9ad4c152951de58a6))
* **roadmap:** mark P2.1-P2.3 done in road-to-productization ([189c780](https://github.com/event4u-app/agent-config/commit/189c780faef19cfbd9bceb3ad51ec42cb8cb05b7))

### CI

* **install:** add structural Quickstart smoke test (P3.1a) ([228445b](https://github.com/event4u-app/agent-config/commit/228445b97eefb20118bbea2872640c54225a1355))
* **work-engine:** validate decision_engine block in agent-settings ([1a1f428](https://github.com/event4u-app/agent-config/commit/1a1f428bec4832f8ffb222a8b450719ba6409605))

### Chores

* **generate-tools:** expose nextjs-patterns + symfony-workflow skills ([3422ac7](https://github.com/event4u-app/agent-config/commit/3422ac7e3f273497a0cbb176b2580a0cf1256522))
* **sync:** align orchestrator frontmatter + hash registry ([0e9ba2d](https://github.com/event4u-app/agent-config/commit/0e9ba2d50463ca99baf86651ea67ed82ca63d7f6))
* **gitignore:** ignore python coverage artifacts ([e1a3289](https://github.com/event4u-app/agent-config/commit/e1a328921f08fad03325adc256b63a544582efb7))

Tests: 3718 (+55 since 2.10.0)

# Era: pre-2.11.0 — archived

> All entries from `2.10.0` through `2.7.0` live in
> [`docs/archive/CHANGELOG-pre-2.11.0.md`](docs/archive/CHANGELOG-pre-2.11.0.md).
> The archive is read-only; git tags `2.10.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.


# Era: pre-2.7.0 — archived

> All entries from `2.6.1` through `2.2.0` live in
> [`docs/archive/CHANGELOG-pre-2.7.0.md`](docs/archive/CHANGELOG-pre-2.7.0.md).
> The archive is read-only; git tags `2.6.1` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.2.0 — archived

> All entries from `2.1.0` and earlier live in
> [`docs/archive/CHANGELOG-pre-2.2.0.md`](docs/archive/CHANGELOG-pre-2.2.0.md).
> The archive is read-only; git tags `2.1.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.
