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

**TypeScript CLI shell + local server foundation (`typescript-cli-and-local-gui-foundation`)** —
Phase-5 cutover of the `agent-config` binary from a 955-line Bash
dispatcher to a compiled TypeScript entry point. The shell handles
native commands (`versions`, `doctor-shell`, `ui:serve`) and forwards
every other subcommand to the legacy logic, now living at
`scripts/_dispatch.bash`. New surfaces:

- **TS bin entry** — `package.json#bin` flipped to
  `dist/cli/agent-config.js`. `npm run build:cli` compiles and
  `chmod +x`-es the entry; `scripts/prepack-check.mjs` runs on
  `npm pack` / `npm publish` and asserts the compiled file exists,
  is executable, and carries the Node shebang.
- **Bash shim** — the old path `scripts/agent-config` is now a
  ~30-line deprecation shim that forwards to the TS binary. The real
  dispatch logic moved to `scripts/_dispatch.bash` to prevent the
  forward-and-back loop. Doctor probes both paths.
- **Embedded Fastify server** — `agent-config ui:serve` boots a
  local server bound to `127.0.0.1`, on the first free port in
  `41000–41999`. Wire shape locked in
  [`docs/contracts/local-server-api.md`](docs/contracts/local-server-api.md)
  (beta): per-process bearer token, Host-header guard, Origin
  allow-list, `GET /api/v1/ping` liveness probe.
- **CI gates** — `task lint-ts`, `task typecheck-ts`, `task test-ts`,
  `task build-ts` wired into `task ci` and `task ci-strict`. New
  GitHub Actions job `TypeScript Tests` runs the same harness across
  `ubuntu-latest` and `macos-latest` on Node 20, including the
  `prepack-check.mjs` gate.
- **Test coverage** — 47 Vitest tests across
  `tests/cli/{paths,registry,cli-e2e}.test.ts`,
  `tests/server/{app,port,token}.test.ts`, and
  `tests/ui/build.test.ts`. CLI-e2e exercises the shim → dispatcher
  → TS round trip; server tests cover the auth gate and 421/403/401
  failure modes.

Decision record: [`docs/decisions/ADR-012-typescript-cli-shell.md`](docs/decisions/ADR-012-typescript-cli-shell.md).

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

# Era: 3.0.x — current

> Started at `3.0.0` (2026-05-21). Full entries live inline below.
> The drift test caps this era at 200 lines of entry body; growth past
> that forces a new era split (`# Era: 3.1.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

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

* **ci:** sync compressed outputs (fetch description, failure-modes heading, agent-settings code block) ([6bb9b36](https://github.com/event4u-app/agent-config/commit/6bb9b363a46310ffe32d1859ed356eaf0cbd6b18))
* **ci:** propagate path refactor into .agent-src/, trim ghostwriter description ([2747288](https://github.com/event4u-app/agent-config/commit/2747288b62ee4135d5f5459d2864f3a8fe0ce97a))
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
* **sync:** regenerate compressed mirrors + hashes for trimmed descriptions ([fe8c7c2](https://github.com/event4u-app/agent-config/commit/fe8c7c23e9127a5031ece5b0f85e68dcbde59c2a))
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

# Era: pre-3.0.0 — archived

> All entries from `2.26.0` and `2.25.0` live in
> [`docs/archive/CHANGELOG-pre-3.0.0.md`](docs/archive/CHANGELOG-pre-3.0.0.md).
> The archive is read-only; git tags `2.26.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.25.0 — archived

> All entries from `2.24.0` through `2.20.0` live in
> [`docs/archive/CHANGELOG-pre-2.25.0.md`](docs/archive/CHANGELOG-pre-2.25.0.md).
> The archive is read-only; git tags `2.24.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.20.0 — archived

> All entries from `2.19.0` through `2.17.0` live in
> [`docs/archive/CHANGELOG-pre-2.20.0.md`](docs/archive/CHANGELOG-pre-2.20.0.md).
> The archive is read-only; git tags `2.19.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.17.0 — archived

> All `2.16.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.17.0.md`](docs/archive/CHANGELOG-pre-2.17.0.md).
> The archive is read-only; git tag `2.16.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-2.16.0 — archived

> All `2.15.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.16.0.md`](docs/archive/CHANGELOG-pre-2.16.0.md).
> The archive is read-only; git tag `2.15.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/test_changelog_eras.py`.

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
