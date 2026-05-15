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

**Discovery polish — `--root` override, doctor diagnostics, install-mode marker (`step-8-discovery-polish`)** —
follow-up to step-7 driven by AI Council review of PR #157. Adds an
explicit escape hatch for monorepos, surfaces the resolution decision
path, and replaces install-mode heuristics with an authoritative
marker file. New surfaces:

- **Global `--root <dir>` flag** — parsed by the bash dispatcher
  before any subcommand and wins over every other channel (subcommand
  `--project`, `AGENT_CONFIG_PROJECT_ROOT` env-pin, anchor walk).
  Implemented as `AGENT_CONFIG_ROOT_OVERRIDE=1` +
  `AGENT_CONFIG_PROJECT_ROOT` plus a new `ORIGIN_ROOT_FLAG` so doctor
  can attribute the resolution. Wrapper-coupling warning emitted on
  stderr when `--root` overrides a wrapper-pinned env-pin.
- **Fail-loud root validation** — `--root`, `--project`, and
  `AGENT_CONFIG_PROJECT_ROOT` all reject non-existent paths and
  non-directories via `ProjectRootError` mapped to exit code `2`. No
  silent CWD fallback when the operator explicitly named a path.
- **`agent-config doctor --trace-root`** — read-only diagnostic that
  prints every ancestor probed during root discovery, the winning
  anchor, and the originating channel. `--json` for machine-readable
  output. Short-circuits the drift report.
- **`agent-config doctor --context`** — prints effective project
  root, origin, install mode + source, settings-layer chain, wrapper
  state, and env-pin/override flags. `--json` available.
- **Install-mode marker file** — `agents/.agent-state/install-mode.txt`
  written by `install.py` with `minimal\n` or `full\n`. Doctor uses
  the marker authoritatively for new installs; back-compat heuristic
  (`AGENTS.md` + copilot bridges) only fires when the marker is absent.
- **Minimal-install upgrade hint** — `install.py` emits a stderr
  hint after a `--minimal` install describing how to upgrade to a
  full install when the user is ready.
- **Test coverage** — `tests/test_root_override.py` (precedence,
  fail-loud for each channel, end-to-end CLI exit-2 check),
  `tests/test_doctor_trace.py` (text + JSON shape for both flags,
  marker-vs-heuristic install-mode detection, origin propagation).
  Twenty new tests, full suite green.

Council artefacts:
`agents/council-sessions/step-8-discovery-polish-decision.md` — 2
rounds + peer-review, $0.12. Decision cut `template-gen` (A4) and
`anchor-freeze AC` (A6), kept `--trace-root` and `--context` as two
distinct flags (host override of Claude's consolidation proposal),
and added the install-mode marker file as the hybrid resolution to
Q5 (marker for new installs, filesystem heuristic for back-compat).

**Agent-folder discovery + `--minimal` init (`step-7-agent-folder-discovery-and-minimal-init`)** —
project-root discovery widens beyond `.git` so non-git checkouts,
monorepo sub-trees, and `agent-config`-only worktrees resolve
correctly, and a new minimal-init payload lets teams keep the
runtime global while committing only the per-project shell. New
surfaces:

- **Boundary anchors (D1+D3)** — `.git` plus `agents/` containing
  **any** of `roadmaps/`, `.ai-council.yml`, `roadmaps-progress.md`.
  Bare `agents/` is **not** an anchor (false-positive guard). When
  no boundary anchor exists in any ancestor, the **outermost**
  `.agent-settings.yml` becomes the root so the layered-settings
  cascade survives. Same-level tiebreaker:
  `.agent-settings.yml` > `agents/` > `.git` (diagnostic anchor
  name only — resolved path is identical).
- **`resolve_project_root(arg)` helper** (`scripts/_lib/agent_settings.py`)
  — single entry point used by every `cmd_*.py`. Precedence:
  explicit `--project`/`--target` → `AGENT_CONFIG_PROJECT_ROOT` env
  → anchor walk → CWD fallback. Returns `(root, origin)` so doctor
  can surface which step resolved.
- **`AGENT_CONFIG_PROJECT_ROOT` env pin** — the `./agent-config`
  wrapper exports its own directory before forwarding to the master
  CLI, so subcommands invoked from a subdirectory (or after
  `os.chdir`) stay pinned to the right root without re-walking.
- **`agent-config init --minimal`** — writes exactly three files:
  `.agent-settings.yml`, `agents/.gitkeep`, and the `./agent-config`
  wrapper. No `.augment/` / `.claude/` / `.cursor/` / `AGENTS.md`.
  Refuses to run when an ancestor already carries an anchor
  (nested-install guard); override with explicit `--target`.
  Does **not** pin `agent_config_version` (D4) — consumer follows
  the global CLI.
- **`AGENT_CONFIG_LEGACY_ANCHOR=1` kill-switch (D5)** — reverts
  discovery to the pre-step-7 `.git`-only walk for one minor-version
  soak. Scheduled for removal after the soak window unless
  telemetry surfaces a missing case.
- **Performance budget (D6)** — anchor walk is `O(depth)` with at
  most three `Path.exists()` calls per level. Test asserts
  `< 5 ms` at depth 20 (`tests/test_anchor_perf.py`).
- **Test coverage** — `tests/test_project_root_anchors.py`
  (precedence, mixed-anchor edge case, bare `agents/` rejection),
  `tests/test_kill_switch.py`, `tests/test_minimal_init.py`
  (payload shape + nested-install refusal), `tests/test_subdir_invocation.py`
  (env-var precedence, wrapper-pin surviving `chdir`),
  `tests/test_anchor_perf.py`.

Council artefacts: `agents/council-sessions/step-7-d3-cascade-conflict-{question,decision}.md`
— D3 strict closest-leaf-wins was relaxed to boundary-vs-layer
split after the analysis lens flagged four pre-existing cascade
tests as the contract, not edge cases.

**PR #150 follow-up hardening (`step-9-pr150-feedback-hardening`)** —
twelve-phase response to the Claude+GPT review findings on PR #150 plus
three user-requested settings-shape changes (CLI-default, preferred-single
member, low-impact dispatch) under one roadmap. New surfaces:

- **`defaults.member_mode: cli | api`** (default `cli`) — flips the
  global transport default to CLI-first onboarding (subscription auth,
  no API key). Per-member explicit `mode:` keeps overriding.
- **`routing.solo_member_fallback_chain: [provider, ...]`** — ordered
  preference list for single-member dispatch. Disabled members are
  skipped; duplicates rejected at config-load time; all-invalid
  escalates to full council (never fails the decision). 15-minute
  auth cache, 3-second timeout per probe.
- **`low_impact.dispatch: full | single`** (default `full`) — opt-in
  cost-efficient routing for low-impact decisions through
  `routing.solo_member_fallback_chain`. **Iron Law:** `high_impact`
  and `user_required` dispatch are NOT configurable — config validator
  rejects both top-level and `decision_resolution.classes.*` forms,
  including YAML `<<:` anchor smuggling attempts. Sentinel in
  `tests/test_iron_law_config.py`.
- **Shadow-mode safety net** — when `low_impact.dispatch: single` is
  active, sample (default `0.1`) decisions go to both solo + full
  council. Disagreements append to `agents/council-shadow-log.jsonl`
  (privacy-redactor enforced). `agent-config council shadow-report`
  computes the 7-day rolling SLO (`OK <5%` / `WARN 5–8%` / `BREACH
  >8%`); pre-flight cost disclosure surfaces the verdict. No auto-
  revert — humans decide.
- **Confidence gate — auto-escalation on uncertain solo runs**
  (`scripts/ai_council/confidence_gate.py`) — every solo response is
  scored before the verdict is returned. Four escalation reasons in
  priority order: `refusal` (empty / refusal markers), `split`
  (two-verdict / option-A-vs-B / Variante 1/2), `short_response`
  (< 20 chars), `low_confidence` (explicit `Confidence: 0.X` marker
  or hedge-word density below floor). Zero extra LLM calls —
  heuristics run in-process. Escalations append `escalated: true` +
  `escalation_reason` to `agents/council-shadow-log.jsonl`; the SLO
  banner appends the rolling auto-escalation rate so quiet uncertainty
  cannot hide behind a flat disagreement rate.
- **`low_impact.solo_confidence_floor: float`** (default `0.7`,
  range `[0.0, 1.0]`) — threshold for the confidence gate.
  **Iron Law:** `solo_confidence_floor` is also rejected on
  top-level `high_impact:` and `user_required:` — those classes
  never run solo, so a solo-specific knob there is incoherent.
- **`AGENT_CONFIG_FORCE_FULL_COUNCIL=1`** — per-invocation kill-switch
  that forces full council regardless of `low_impact.dispatch`.
- **Airgap detection** (`scripts/ai_council/airgap.py`) — installer
  first-run probes DNS for `api.anthropic.com`, `api.openai.com`,
  `generativelanguage.googleapis.com` with 1s timeout per host. All
  fail → banner `airgapped environment detected — defaulting to
  mode: api` and `defaults.member_mode: api` recommendation.
- **Fast-path marker visibility Iron-Law rule**
  (`.agent-src.uncompressed/rules/fast-path-marker-visibility.md`,
  kernel-tier, always-active) — host agents MUST surface
  `Resolved via low-impact council fast-path: …` markers verbatim;
  swallowing them is a rule violation.
- **`/memory learn-low-impact --preview`** (default) / `--apply` —
  preview shows promoted entries, refused entries with redaction
  reasons, source-project-stripped diff, and the upstream PR body
  draft before anything is written.
- **Corpus parser hardening** — typed `CorpusParseError(reason=...)`
  replaces silent skip; seven failure-mode fixtures in
  `tests/fixtures/corpus-robust/` (missing anchor · renamed heading ·
  bullet-without-quotes · duplicate entry · anti-example wrongly
  under Validated · malformed ISO timestamp · redactor-bypass).
  Contract in `docs/contracts/low-impact-corpus-format.md`.
- **Fuzzy corpus matching (opt-in)** —
  `low_impact.fuzzy_match.{enabled,threshold}` (defaults `false`,
  `0.92`) using `difflib.SequenceMatcher`. High-impact trigger veto
  + anti-example veto preserve the Iron Law.
- **CLI-binary UX** — pre-flight cost disclosure now prints
  `member X skipped: binary not found, install via <hint>` per
  skipped CLI member; hints sourced from
  `scripts/ai_council/cli_hints.py`.
- **Doctor CLI checks** — `agent-config doctor --check council-cli`
  reports per CLI member: binary present · auth probe · parse
  fixture · quota remaining · billable flag.
- **Iron-Law bypass linter** — `audit_cloud_compatibility.py
  --iron-law` scans `scripts/` for raw YAML loads of `ai-council.yml`
  that skip the config validator; baseline is 0 findings; suppress
  legitimate cases with `# iron-law-ok: <reason>` on the load line.

Surface delta: **4 new config knobs** (`defaults.member_mode`,
`routing.solo_member_fallback_chain`, `low_impact.dispatch`,
`low_impact.solo_confidence_floor`),
**1 new env-var kill-switch** (`AGENT_CONFIG_FORCE_FULL_COUNCIL`),
**1 new CLI subcommand** (`council shadow-report`), **1 new CLI flag**
(`council run --single`), **1 new always-active rule**
(`fast-path-marker-visibility`), **2 new local-only files**
(`agents/council-shadow-log.jsonl`, gitignored;
`scripts/ai_council/airgap.py`). Backward-compat: defaults map the
existing behaviour (`dispatch=full`, empty chain, `member_mode=cli`
in fresh installs; existing configs read unchanged). No migration
script — defaults are silent-safe.

**Low-impact corpus YAML lockfile (`step-10-corpus-yaml-lockfile`)** —
follow-up to the PR #150 review (Punkt 4): the Markdown parser used to
be the runtime source-of-truth for the low-impact decisions corpus,
making every human edit-variation (curly quotes, bullet style,
whitespace, heading rename) a potential parser bomb on the hot path.
Switched the runtime to a generated YAML lockfile while keeping
Markdown as the human-editable source. New surfaces:

- **`scripts/ai_council/compile_corpus.py`** — build tool that runs
  `parse_corpus_strict()` over `agents/low-impact-decisions.md` and
  emits `agents/low-impact-decisions.lock.yaml` (schema-v1, sorted
  keys, deterministic). `--check` mode exits `1` on drift, `2` on
  parse error.
- **`agents/low-impact-decisions.lock.yaml`** — generated, **committed**
  lockfile. Schema `{schema_version: 1, provenance: {source_path,
  source_sha256, last_upstreamed}, validated, probation, anti_examples}`.
  Diffed in PR reviews alongside the Markdown source.
- **`low_impact_corpus.load_corpus_lock()`** — new primitive that
  loads the YAML lockfile and re-materialises a `CorpusParseResult`.
  Schema-version mismatch raises `CorpusParseError` with reason
  `schema_version_mismatch`.
- **Lenient loaders prefer YAML** — `load_validated_phrases` and
  `load_anti_example_phrases` (consumed by `necessity.py` and
  `low_impact.py` on the hot path) check for the sibling `.lock.yaml`
  first. Missing / malformed lockfile → silent fallback to lenient
  Markdown parsing, so a fresh clone before `task sync` still works.
- **CI gate** — `task compile-corpus` runs as part of `task sync` and
  `task consistency` (before `git diff --quiet`). A stale lockfile
  fails CI the same way `.agent-src/` drift does.
- **Preview tool unchanged** — `learn_low_impact_preview.py` keeps
  reading the Markdown directly via `parse_corpus_strict`; it runs
  *before* `task sync` rebuilds the lockfile, so it must read whatever
  the user just edited.

The Markdown parser stays in the repo as a build-time dependency, not
a runtime dependency — a parser regression breaks `task consistency`,
never the live council. Privacy floor (`low-impact-corpus-privacy-floor`)
unchanged: the redactor scans entry text, not file format.

**Council quota & necessity transparency (`step-8-quota-necessity-transparency`)** —
the council's two pre-flight gates (`cli_call_budget` and
`necessity_classifier`) become observable and aligned with the
"Council always active when enabled" mental model. New surfaces:

- `council run` / `council debate` print a one-line
  `council:quota · <provider> used/limit · …` summary before the
  first member fires. Only providers with a configured per-day cap
  appear; uncapped providers are omitted (no false metering).
- `cli_call_budget.warn_at` (float, default `0.8`) — once
  `used / max_calls_per_day >= warn_at`, the summary line is
  prefixed `⚠️` and a `council:quota · WARN` line names the
  providers near the wall.
- New `agent-config council quota` subcommand dumps today's
  `~/.event4u/agent-config/cli-calls.json` state plus the configured
  caps. `--reset <provider> --confirm` clears today's counter for one
  provider for manual rollover.
- **Necessity tier split (D2):** `necessity_classifier.user_explicit_mode`
  (default `warn-only`) separates the agent and user_explicit tiers.
  User-typed `/council` calls proceed by default with an annotated
  stdout line; agent-initiated dispatches keep `educate` behaviour.
  New `warn-only` mode joins the existing `off | educate | block`
  enum — annotates the verdict but never skips.
- **Persistent events log (D3):** every necessity-gate decision
  (`proceed` / `skip_necessity`) and every quota block
  (`block_quota`) appends one JSON line to `agents/council-events.log`
  (gitignored; never committed). Schema v1 with `schema_version`,
  `ts_utc`, `lens`, `invocation`, `action`, `verdict`,
  `provider_caps`, `original_ask_hash`. `original_ask` is hashed
  `sha256[:12]` before write — the raw prompt is never persisted
  (privacy floor per `agents/low-impact-decisions.md`).
- **Kill-switch (D5):** `AGENT_CONFIG_NO_EVENTS_LOG=1` disables
  every events-log write in-process. Mirrors the
  `AGENT_CONFIG_LEGACY_ANCHOR=1` pattern from step-7.

Surface delta: **1 new subcommand** (`council quota`), **2 new
config knobs** (`cli_call_budget.warn_at`,
`necessity_classifier.user_explicit_mode`), **1 new local-only file**
(`agents/council-events.log`, gitignored). Backward-compat:
existing `.agent-settings.yml` and `agents/.ai-council.yml` work
unchanged; new knobs are optional. Docs:
[`docs/contracts/ai-council-config.md`](docs/contracts/ai-council-config.md)
+ [`docs/installation.md`](docs/installation.md) § AI Council local
state.

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

# Era: 2.15.x — current

> Started at `2.15.0` (2026-05-15). Full entries live inline below.
> The drift test caps this era at 200 lines of entry body; growth past
> that forces a new era split (`# Era: 2.16.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [2.17.0](https://github.com/event4u-app/agent-config/compare/2.16.0...2.17.0) (2026-05-15)

### Features

* **user-types:** seed install-time axis directory with 7 user-type YAMLs ([d3264a5](https://github.com/event4u-app/agent-config/commit/d3264a5fd2e76e671b415c4a40279427d738c21c))
* **eval:** measure skill-count reduction per user-type (step-12 P3) ([db74b3f](https://github.com/event4u-app/agent-config/commit/db74b3ff2f79499a29eb06ec12b64b054435e7d5))
* **eval:** wire task bench + non-dev baseline 93.75% (step-12 P1) ([b3a0cde](https://github.com/event4u-app/agent-config/commit/b3a0cde598b592de7150bc118190083f181a7279))
* **install:** add --interactive flag for user-type / stack / verbosity capture ([779c368](https://github.com/event4u-app/agent-config/commit/779c3680b22ec3afdd427dfcd32ed4816d541773))
* **schema:** add recommended_for_user_types to skill schema + tag 32 skills ([afb90af](https://github.com/event4u-app/agent-config/commit/afb90af34118036902fb9d2054b1b8c743e650aa))
* **rules:** add 12 domain-safety rules (PII, disclaimers, retention) ([dc9d7f7](https://github.com/event4u-app/agent-config/commit/dc9d7f70644d1b41df7af43f0acfeb8105472345))
* **eval:** add non-dev evaluation corpus for step-12 phase 1 ([9d4881e](https://github.com/event4u-app/agent-config/commit/9d4881e9c366c701f44fcfc9ac3c689665ec91ad))
* **ghostwriter:** enforce alias validation in lint_ghostwriter_source ([3862a08](https://github.com/event4u-app/agent-config/commit/3862a08194037433a721f58795bbc1a60a86b5d8))
* **ghostwriter:** resolve --as=<value> against aliases in write command ([5ae4933](https://github.com/event4u-app/agent-config/commit/5ae493334bd41956a839fd88f0036d6098fb0884))
* **ghostwriter:** add aliases schema + consumer settings toggle ([0d551c9](https://github.com/event4u-app/agent-config/commit/0d551c9818e40fec9fdc3320f1c5d615902f0e7f))
* **ghostwriter:** /ghostwriter:list, :show, :delete maintenance commands ([0cdc009](https://github.com/event4u-app/agent-config/commit/0cdc009c60082d323efe6e495ab84bb4ad6cb48f))
* **ghostwriter:** /post-as cluster (me · ghostwriter) + sync artifacts ([f6aca57](https://github.com/event4u-app/agent-config/commit/f6aca57a178d22cc865a1a0f81065fbae11b3dd1))
* **ghostwriter:** /ghostwriter:write command + disclosure footer ([2f7349e](https://github.com/event4u-app/agent-config/commit/2f7349ec7b40580ab2b9a3b5d19059cd3f750503))
* **ghostwriter:** /ghostwriter cluster dispatcher + /ghostwriter:fetch ([c4d9c09](https://github.com/event4u-app/agent-config/commit/c4d9c09609ddc3de063126ba8c5549069cc49595))
* **ghostwriter:** consumer-side README + gitignore-by-default block ([4ffcb01](https://github.com/event4u-app/agent-config/commit/4ffcb017149cba4ee3207bcfb537e42626831276))
* **ghostwriter:** add package-side fictional fixture + README ([c3daeea](https://github.com/event4u-app/agent-config/commit/c3daeea34dfbcf460930d115053ae439055c87d6))

### Bug Fixes

* **rules:** trim 8 domain-safety descriptions to ≤150 chars ([1f095c1](https://github.com/event4u-app/agent-config/commit/1f095c1c140d2f071a1b6143283b946e94c0d209))
* **contracts:** scrub roadmap refs from router-blending + universal-skills ([36dc8a4](https://github.com/event4u-app/agent-config/commit/36dc8a44012b4cad431c2d46223a738bf476f0a8))
* **contracts:** keep-beta-until within 90-day window (2026-08-13) ([c6f1082](https://github.com/event4u-app/agent-config/commit/c6f108246b48fafad9fd564d1e4d4a493642bc91))
* **schema:** allow applies_to_user_types in rule frontmatter ([80f73f6](https://github.com/event4u-app/agent-config/commit/80f73f639dcb0c8d347b4ccda88ad52ed091747e))

### Documentation

* **roadmaps:** step-12 closure run #2 — author step-9/13/14, flip in-scope, defer external ([6191506](https://github.com/event4u-app/agent-config/commit/6191506a7d70472d164385b4a7b3ab514bd5deb1))
* **roadmaps:** step-12 autonomous closure (Phases 0/1/3/5/7 closed) ([32f3177](https://github.com/event4u-app/agent-config/commit/32f317725f2a5000be0caf64d21d40103ec0be86))
* **announcements:** draft non-dev launch posts + case-study tpl (step-12 P7) ([d624ad6](https://github.com/event4u-app/agent-config/commit/d624ad65392d1994fc65dd1b6b7d33ba18fc80f1))
* **roadmaps:** close step-12 P6 L113 (GitHub repo metadata applied) ([b7099ee](https://github.com/event4u-app/agent-config/commit/b7099ee493d483e3aec07c6d33e767dbf99edc4d))
* **roadmaps:** step-12 final-push annotations + closure report ([0c0e575](https://github.com/event4u-app/agent-config/commit/0c0e5752300a25dfdf1cf09569df2dc37eaf5f6e))
* **contracts:** add init-telemetry v1 wire contract (step-12 P7 L127) ([dc9ea0a](https://github.com/event4u-app/agent-config/commit/dc9ea0a44b801a821ab3a6309c64fadf990eec3a))
* **roadmaps:** step-12 closure report — terminal in-branch state ([70cc0f8](https://github.com/event4u-app/agent-config/commit/70cc0f8adc6485a61c4f1c75ff8bf926f22f1aad))
* **readme:** drop duplicate Laravel-featured-domain section (5 lines) ([a7c332b](https://github.com/event4u-app/agent-config/commit/a7c332bdf61ccb2de358c65f14cb62caf24008bd))
* **contracts:** add stability frontmatter to router-blending + universal-skills ([3273392](https://github.com/event4u-app/agent-config/commit/3273392a9d87d82dd8baad8fc8a61914ffa2bed6))
* **readme:** reframe identity as Universal AI Agent OS ([4b2a328](https://github.com/event4u-app/agent-config/commit/4b2a3282a08ce4c568722597741931c47d21a6b8))
* **readme:** trim README under 750-line floor, extract docs/safety.md ([2b74b1b](https://github.com/event4u-app/agent-config/commit/2b74b1bffed90ea5495fb96de6d9cce2db9415fb))
* **readme:** add data governance & domain safety section ([8aa2b8e](https://github.com/event4u-app/agent-config/commit/8aa2b8edef5a29a3bcbef810c23083c4cfb4e237))
* add role-based + laravel getting-started + CI link check ([ea65555](https://github.com/event4u-app/agent-config/commit/ea655557c785631df83766dd1d63458bf83c876f))
* **ghostwriter:** cross-links, command counts, beta dates, roadmap-ref cleanup ([b8d0fb8](https://github.com/event4u-app/agent-config/commit/b8d0fb8ec230aa5992aedc00d78b0aa56e8ce430))
* **contracts:** write-engine v1 + register /post-as cluster ([94d0cd8](https://github.com/event4u-app/agent-config/commit/94d0cd89d046251ffed6a8c42f415a5c47451503))
* **roadmaps:** mark step-4 Phase 2 complete + regenerate progress ([7ec448d](https://github.com/event4u-app/agent-config/commit/7ec448dc872072ad93921dc0b9b166e5bf122237))
* **contracts:** register /ghostwriter cluster (fetch · write · list · show · delete) ([01b4525](https://github.com/event4u-app/agent-config/commit/01b4525e3272dfb089bdac215f52a6175b9ab47e))
* **roadmaps:** mark step-4 Phase 1 complete + regenerate progress ([5a574e2](https://github.com/event4u-app/agent-config/commit/5a574e27337fc598935281cda331cca0ecc34324))
* **contracts:** lock ghostwriter v1 schema with verification + attestation fields ([421fc2e](https://github.com/event4u-app/agent-config/commit/421fc2e5fee09834590ca2594bf06875e38acfb3))

### Build

* **ghostwriter:** wire lint + copy-as-is sync for package fixtures ([c5a3c79](https://github.com/event4u-app/agent-config/commit/c5a3c791bf51ceb23fde186d3b2f60675107c923))

### Chores

* **scripts:** draft update-github-metadata.sh (step-12 P6 L113) ([2a2c5c2](https://github.com/event4u-app/agent-config/commit/2a2c5c20cadb4ba653a5660797b28add7dfc43a6))
* **index:** regen index + catalog after description trimming ([f4915e4](https://github.com/event4u-app/agent-config/commit/f4915e47172a7b4482a5440f17d543072c90c303))
* **compression:** propagate trimmed descriptions to .agent-src + hashes ([0a9352d](https://github.com/event4u-app/agent-config/commit/0a9352d7d20856301746a5839d25e2d52398920b))
* **ownership:** regen file-ownership matrix ([bc13dd2](https://github.com/event4u-app/agent-config/commit/bc13dd2fe67d5c571f05964b84702cb6d7b193c2))
* **index:** regen agents/index.md + docs/catalog.md ([20fefb0](https://github.com/event4u-app/agent-config/commit/20fefb043a25034a715cb7e76ec6174831357061))
* **roadmaps:** step-12 phases 3 / 5 / 6 done + regen dashboard ([f07a0b1](https://github.com/event4u-app/agent-config/commit/f07a0b15cbe784eb17b9b75d06cae91e726b08f8))
* **generated:** add 12 domain-safety rule symlinks to .claude/rules ([b95364a](https://github.com/event4u-app/agent-config/commit/b95364ae8e52a582ecb8c2598402782e06bfa83d))
* **roadmap:** close step-12 Phase 4 — domain safety rules shipped ([b02290f](https://github.com/event4u-app/agent-config/commit/b02290f50b034ede8f725b9558d1060578024855))
* **roadmaps:** add step-12 universal-os-reframe + regen dashboard ([89e06ca](https://github.com/event4u-app/agent-config/commit/89e06caf5ae21d21fa7f2705720e53888eb53c69))
* **ghostwriter:** close out step-4 — archive roadmap, regen index + ownership matrix, bump template version ([70521c4](https://github.com/event4u-app/agent-config/commit/70521c41bc9305f5d39a7f8f7775388b724c56a6))

Tests: 4459 (+54 since 2.16.0)

## [2.16.0](https://github.com/event4u-app/agent-config/compare/2.15.0...2.16.0) (2026-05-15)

### Features

* **install:** install-mode marker + minimal-init upgrade hint (Step 8 P3) ([e028468](https://github.com/event4u-app/agent-config/commit/e028468ed2b58428b99bea5a2e6c2a25e12fc113))
* **cli:** doctor --trace-root + --context diagnostic surface (Step 8 P2) ([387a626](https://github.com/event4u-app/agent-config/commit/387a626b7795fc40e6e2442c1dde272dfc98f9d7))
* **cli:** --root override flag + fail-loud root validation (Step 8 P1) ([0c8356e](https://github.com/event4u-app/agent-config/commit/0c8356e9034ca474827de89db5386a04c61f560c))
* **wrapper:** export AGENT_CONFIG_PROJECT_ROOT pin so subdir invocations skip the walk ([e866cef](https://github.com/event4u-app/agent-config/commit/e866cef14d40269786fb0a88b69d9aafcfab1c88))
* **agent-settings:** add resolve_project_root helper for Phase 3 subdir hardening ([95bac18](https://github.com/event4u-app/agent-config/commit/95bac187132d35d476716cd38d8c619bccaca6e5))
* **install:** add --minimal / --settings-only init mode ([4c02743](https://github.com/event4u-app/agent-config/commit/4c02743cd7df6d89f7b7fa6188d654ca1eec983c))
* **agent_settings:** extend find_project_root with agents/ + .agent-settings.yml anchors ([60dcd11](https://github.com/event4u-app/agent-config/commit/60dcd11c498f25f92bb01482943bfb95d4efef37))

### Documentation

* **changelog:** Step 8 discovery polish entry under Unreleased ([eecaf6a](https://github.com/event4u-app/agent-config/commit/eecaf6a9a2248a877d71dbd33e7db096f94dab3b))
* **installation:** root override + monorepo semantics + diagnostics (Step 8) ([de3081f](https://github.com/event4u-app/agent-config/commit/de3081fe828cb43c628d922c50d25177d43f267e))
* **roadmap:** archive step-7 (all phases complete) + sync dashboard ([8f2953e](https://github.com/event4u-app/agent-config/commit/8f2953ee5c867ada29c9f32cf45bd2380504bc12))
* **step-7:** add minimal-init flow, anchor migration guide, changelog entry ([9ace019](https://github.com/event4u-app/agent-config/commit/9ace01945967e67e98e8855a940801db09de8d17))
* **roadmap:** mark Step 7 Phase 3 complete (subdir invocation hardening) ([518f9dc](https://github.com/event4u-app/agent-config/commit/518f9dcaf6d71a34cf1700bceb1487f1e8e33175))
* **roadmap:** mark Step 7 Phase 2 + test items complete ([1bb9b71](https://github.com/event4u-app/agent-config/commit/1bb9b712d866dd509124f7d8502f52957e972b20))
* **roadmap:** mark Step 7 Phase 1 complete; refresh progress dashboard ([2ba8d5b](https://github.com/event4u-app/agent-config/commit/2ba8d5be1b94bbab87da4270d833697c895cc9c6))

### Refactoring

* **cli:** route all cmd_*.py entry points through resolve_project_root ([aa7a01a](https://github.com/event4u-app/agent-config/commit/aa7a01a7f27205919193d54339298c0dbd30c43e))

### Tests

* **cli:** coverage for --root override + doctor trace/context (Step 8) ([9b943aa](https://github.com/event4u-app/agent-config/commit/9b943aa9f002750499738fd36f8a203525fb84da))
* **subdir:** cover resolve_project_root precedence + wrapper-pinned root ([0693714](https://github.com/event4u-app/agent-config/commit/06937145ac8f4e1160ec9279d3832e4f5397bb1e))
* **install:** cover --minimal payload + nested-install guard ([5623521](https://github.com/event4u-app/agent-config/commit/56235218624792b487a92f444ff8ee114a5651a3))
* **agent_settings:** cover anchor extension, kill-switch, perf budget ([37a080c](https://github.com/event4u-app/agent-config/commit/37a080c07ee9238fda45bbda1829764a4232f062))

### Chores

* **template:** bump agent_config_version pin to 2.15.0 ([093367d](https://github.com/event4u-app/agent-config/commit/093367d3e417a11a28295f2efa574e8c3fef6524))
* **sync:** propagate Step 8 agent_settings.py to .agent-src/ projection ([7ce92e5](https://github.com/event4u-app/agent-config/commit/7ce92e514a8edbd970a4118b91d2f651bf730070))
* **roadmap:** archive Step 8 discovery polish ([1c21982](https://github.com/event4u-app/agent-config/commit/1c219825dc413cfe45aefc3b12c08d2720583880))
* **changelog:** split era 2.11.x → pre-2.15.0 ([c79363c](https://github.com/event4u-app/agent-config/commit/c79363c05d775ecfa95ab6fff5b3bbe706f797c9))

Tests: 4405 (+53 since 2.15.0)

## [2.15.0](https://github.com/event4u-app/agent-config/compare/2.14.0...2.15.0) (2026-05-15)

### Features

* **agent-user:** add /agents user command cluster (init, show, review, accept, update) ([15d53d8](https://github.com/event4u-app/agent-config/commit/15d53d8d9a2365b044831cd42127e247a70d7e20))
* **agent-user:** add v1 schema contract for .agent-user.md persona file ([64f4eab](https://github.com/event4u-app/agent-config/commit/64f4eab62ccf6a2606fbca0c56d398372c05a7a0))

### Bug Fixes

* **agent-user:** inline council-reference summary per no-roadmap-references ([ee4d3ce](https://github.com/event4u-app/agent-config/commit/ee4d3cedf9f4429450d21ca5badc2ae5c2ecaaed))
* **agent-user:** drop roadmap references per no-roadmap-references rule ([c8ade8d](https://github.com/event4u-app/agent-config/commit/c8ade8d7c5b495e0e4295aa0cb801e59076ee0b0))
* **agent-user:** adjust keep-beta-until to fit 90-day window ([801b365](https://github.com/event4u-app/agent-config/commit/801b365117a2d1efb4505e504bdd730e4cbbc217))

### Documentation

* **persona:** README section + agent-settings legacy-fallback note ([4da7629](https://github.com/event4u-app/agent-config/commit/4da7629f1f0b5a35a64d0a861040ad8639a66ebe))
* **roadmap:** mark step-3-agent-user-persona phases as in-progress ([f29d3bc](https://github.com/event4u-app/agent-config/commit/f29d3bce2380c0ea9c67e6094540b88d920ed9ff))

### Chores

* **roadmap:** close out + archive step-3-agent-user-persona ([09c0229](https://github.com/event4u-app/agent-config/commit/09c0229efd67af9cad7b2ca8202f4caa351d028d))
* **ownership:** regenerate file-ownership-matrix for /agents user ([128890d](https://github.com/event4u-app/agent-config/commit/128890d880584704b4842a398555dd979ae54462))
* **docs:** bump command count from 109 to 115 ([f8c61b1](https://github.com/event4u-app/agent-config/commit/f8c61b1d0ec48034e0d66e8d32534056ca4aa1f0))
* **template:** bump agent_config_version pin to 2.14.0 ([fcb885f](https://github.com/event4u-app/agent-config/commit/fcb885fd19bdbca46ef91ec4d5e723cc6c186c6d))
* **index:** regenerate agents/index.md + docs/catalog.md for /agents user ([56b281d](https://github.com/event4u-app/agent-config/commit/56b281d69960d3e57adbd24b9ec6fd24fc1a5aff))
* **agent-user:** regenerate compressed sources + claude tool stubs ([f79b6d1](https://github.com/event4u-app/agent-config/commit/f79b6d1cfcf1caccde4a723ad779c65d9ed87198))

Tests: 4352 (+12 since 2.14.0)

# Era: pre-2.15.0 — archived

> All entries from `2.14.0` through `2.11.0` live in
> [`docs/archive/CHANGELOG-pre-2.15.0.md`](docs/archive/CHANGELOG-pre-2.15.0.md).
> The archive is read-only; git tags `2.14.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

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
