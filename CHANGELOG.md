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
> current era grows past 250 lines.

## [Unreleased]

### Breaking — v4.0.0 unified setup (`road-to-unified-setup`)

`v4.0.0` is a **hard-cut** release. The legacy Python installer at
`scripts/install.py` and the standalone TypeScript installer workspace
at `packages/core/installer/{src,tests}` are no longer the canonical
install path; the wizard now boots a single Fastify process at
`agent-config install` / `agent-config setup` and drives the whole
plan + apply through the TypeScript engine under `src/install/`.

**Migrating from v3.x**

1. The first `agent-config install` run detects an existing v3 tree at
   `~/.event4u/agent-config/` and renders a **backup screen** before
   any write. Pick **"Backup v3 and proceed"** — the wizard copies the
   v3 layout to `~/.event4u/agent-config.v3.bak/` atomically and runs
   the v4 install against a clean slate.
2. No auto-migration runs. Rolling back is a single rename:
   `mv ~/.event4u/agent-config.v3.bak ~/.event4u/agent-config`.
3. Re-running `npx @event4u/agent-config install` against an active v3
   layout (without backup) is refused — silent overwrite is gone.

**Removed / retired**

- `packages/core/installer/{src,tests,package.json,tsconfig.json,
  vitest.config.ts}` (the standalone `@event4u/installer` workspace)
  and its workspaces declaration in the root `package.json`.
- `/install-via-agent` command — its JSON agent-mode protocol shipped
  with the removed installer.
- `task installer-typecheck` / `task installer-test` gates in
  `taskfiles/ci-fast.yml`.

**Kept for one release**

- `scripts/install.py` remains so the `curl | bash setup.sh` CURL
  fallback + `smoke-public-install.yml` CI matrix keep working. It is
  **not** invoked from the modern npx flow. Full removal is scheduled
  for v5.

**New features (Phase B / C / E)**

- Hard-stop **continue-screen** after Step 3 (modules) when entering
  via `agent-config install`; `setup` lands directly at Step 4
  (identity) via `?mode=setup`. (B5)
- `WIZARD_READY <url>` line on stdout once Fastify is bound; the new
  `scripts/bootstrap.sh` watches for it so a Node bootstrap does not
  poll the port. (B4 + C1)
- **Recovery-pre-step** — `GET /api/v1/install/recovery` surfaces an
  abort marker (Resume / Rollback / Ignore) when the previous run
  closed mid-apply. (B4 + Council Finding #24)
- **v3 backup screen** — `GET /api/v1/install/legacy-v3` +
  `POST /api/v1/install/backup-v3` drive the migration. (E2 +
  Council Finding #21)
- **Batch-conflict resolution** at ≥ 5 conflicts (B3 + Council
  Finding #19).

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
  (`.agent-src.uncondensed/rules/fast-path-marker-visibility.md`,
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

# Era: pre-4.5.0 — archived

> All entries before `4.5.0` live in
> [`docs/archive/CHANGELOG-pre-4.5.0.md`](docs/archive/CHANGELOG-pre-4.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 4.5.x — current

> Started at `4.5.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 4.6.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [5.3.0](https://github.com/event4u-app/agent-config/compare/5.2.0...5.3.0) (2026-05-30)

### Features

* **ci:** lint frontmatter fields equal to their schema default ([3f56ed7](https://github.com/event4u-app/agent-config/commit/3f56ed74fae3fe20346130c790db2929093ae095))
* **frontmatter:** add idempotent migrate_frontmatter_defaults script ([8c2d56d](https://github.com/event4u-app/agent-config/commit/8c2d56ddb17585540fef83589f5e3207e6583d4a))
* **frontmatter:** inject schema defaults in discovery, checksum + condense consumers ([a69e51e](https://github.com/event4u-app/agent-config/commit/a69e51ef7b58d0f5e0eda2a600ce090ab203bef2))
* **frontmatter:** declare schema defaults + inject them in the loader ([6de22ce](https://github.com/event4u-app/agent-config/commit/6de22ce9d89dc648b42b312e0694c621207ccad3))

### Bug Fixes

* **smoke:** inject schema defaults in skills smoke validation ([fc6524b](https://github.com/event4u-app/agent-config/commit/fc6524bc51f595de5a9173309fad17f321a7c892))
* **lint:** re-anchor framework-leakage allowlist after frontmatter line shift ([13f5e5e](https://github.com/event4u-app/agent-config/commit/13f5e5ea7f933d5cb66550c4e90cd714c7683b87))
* **frontmatter:** inject schema defaults in skill_linter; update frontmatter tests ([fff4b12](https://github.com/event4u-app/agent-config/commit/fff4b121fa318b0985a51287095b200b3d008642))

### Documentation

* **roadmap:** close + archive abstraction-reduction roadmap with evidence ([fcb8a33](https://github.com/event4u-app/agent-config/commit/fcb8a3322dcb2dc5f89c85c4132bab9286b2164a))
* **roadmaps:** land Phase 0 preflight for frontmatter-defaults reduction ([70bd300](https://github.com/event4u-app/agent-config/commit/70bd300ef70f55344a22685545a21e2dc795d98b))

### Refactoring

* **frontmatter:** omit fields equal to their schema default across all artefacts ([bd8bc57](https://github.com/event4u-app/agent-config/commit/bd8bc57e104cc82a713f523f5f510e033688771f))

### Chores

* **frontmatter:** drop defaulted fields from the condensed .agent-src tree ([58e2c2a](https://github.com/event4u-app/agent-config/commit/58e2c2a6fc7cf7011e6c9b00801c9f8ff1412684))
* **roadmaps:** archive road-to-distribution-identity — CI green on PR #290 ([2ffeb62](https://github.com/event4u-app/agent-config/commit/2ffeb6239697228541334c7e234554f77c6935aa))
* **roadmaps:** flip Phase 0 checkboxes + regen dashboard ([070e33e](https://github.com/event4u-app/agent-config/commit/070e33e4fd704ec0257f4c5cf6a72052c97796d3))

Tests: 5236 (+50 since 5.2.0)

## [5.2.0](https://github.com/event4u-app/agent-config/compare/5.1.0...5.2.0) (2026-05-29)

### Features

* **ci:** reject sloppy commit subjects before they leak into the changelog ([26a94e9](https://github.com/event4u-app/agent-config/commit/26a94e9e0f07e862a135cfc96b742a999e7131ec))

### Documentation

* **adr:** land ADR-033 distribution-identity npm-primary ([63d38cf](https://github.com/event4u-app/agent-config/commit/63d38cf75df6506218cfc6bc17f0b5ba0c90fe9d))

### Chores

* **roadmaps:** flip distribution-identity Phase 1-3 + regen dashboard ([0885b9d](https://github.com/event4u-app/agent-config/commit/0885b9d4dda67a2439fc5292367249fa99766a02))

Tests: 5186 (+26 since 5.1.0)

## [5.1.0](https://github.com/event4u-app/agent-config/compare/5.0.0...5.1.0) (2026-05-29)

### Features

* **roadmap-progress:** surface pending Iron Law 3 deferrals in dashboard ([2f21a41](https://github.com/event4u-app/agent-config/commit/2f21a41c0ae09e003ddad4cf9184f3d1d359e87b))
* **roadmaps:** document follow-up-roadmap shape + spawn procedure ([ea2b02f](https://github.com/event4u-app/agent-config/commit/ea2b02f34d895e0cdbb1a37d45897990a3282d0b))
* **roadmaps:** add Iron Law 3 — block silent archive of [~] deferred items ([3b3d4ed](https://github.com/event4u-app/agent-config/commit/3b3d4edce67e1c04419bd2daf9a2d4b6d0e68dbe))
* **rules:** add linked-projects-onboarding-gate (Option A, passive awareness) ([54cf6fc](https://github.com/event4u-app/agent-config/commit/54cf6fc16580f2d1084e96ae3d41b0b12fdb6c6e))
* **settings:** add gitignored .agent-settings.local.yml cascade layer ([ca4185d](https://github.com/event4u-app/agent-config/commit/ca4185d8cc4d462b92d00f1520da4dcb1bde3fcf))
* **linked-projects:** add IDE-attached sibling detector ([a0b4a99](https://github.com/event4u-app/agent-config/commit/a0b4a9968962343c7e768469008a6fa3144a736b))

### Bug Fixes

* **refs:** reference local file as basename, not project-rooted path ([dc626c4](https://github.com/event4u-app/agent-config/commit/dc626c49fe68d958ee425d67adce7d71d21c7098))
* **settings:** re-mirror agent_settings.py to work_engine template copy ([6c1b7b1](https://github.com/event4u-app/agent-config/commit/6c1b7b1285ef3c15332f23c14a4e282c13dd6554))
* **rules:** root-relative doc reference in linked-projects rule ([2a85cd2](https://github.com/event4u-app/agent-config/commit/2a85cd26b38ad92342ccc0171754bff145305fcb))

### Documentation

* **roadmap:** archive road-to-linked-projects-scope (all phases complete) ([e12b755](https://github.com/event4u-app/agent-config/commit/e12b755c938c210b234347d8f7f6905710a6eacf))
* **roadmap:** road-to-linked-projects-scope (GO, Option A) + dashboard ([1d8d822](https://github.com/event4u-app/agent-config/commit/1d8d822dd29f962492b92ac570f28f6df13d1eb8))
* **adr:** ADR-032 linked-projects scope GO (Option A) + cross-repo guide ([c49d53c](https://github.com/event4u-app/agent-config/commit/c49d53ce07ff5222b60f5d82a71226c459f7006f))

### Refactoring

* **settings:** relocate local override to agents/settings/.agent-settings.local.yml ([4f887ae](https://github.com/event4u-app/agent-config/commit/4f887ae863b588f66efbfdc585e52123a3e23400))

### Chores

* **index:** regenerate index + catalog for linked-projects rule ([66346cd](https://github.com/event4u-app/agent-config/commit/66346cd1f51795a2e42298b6b57452f39742ab79))

Tests: 5160 (+23 since 5.0.0)

## [5.0.0](https://github.com/event4u-app/agent-config/compare/4.9.0...5.0.0) (2026-05-29)

### BREAKING CHANGES

* **migrate:** remove legacy migrate-state + migrate-to-global subcommands ([3c2976c](https://github.com/event4u-app/agent-config/commit/3c2976c23d264dd67f9388d46db0748268c0ffcc))

### Features

* **migrate:** unify cleanup actions into one opinionated command ([014867e](https://github.com/event4u-app/agent-config/commit/014867e36af4e24167944dc9518c10d1349d7a51))
* **validate:** adopt severity-tiered errors + projection-roundtrip test (ADR-031) ([eafefa4](https://github.com/event4u-app/agent-config/commit/eafefa44bcc08c2c050edc360be361cf42e170bd))
* **lint:** block re-introduction of the marketplace-install gap ([ebe29a6](https://github.com/event4u-app/agent-config/commit/ebe29a6b52de8fad31f0b1d0bad00fce57adf1ec))
* **install:** add hooks:install --claude/--lifecycle/--regen flags ([a5b6798](https://github.com/event4u-app/agent-config/commit/a5b6798f96e9dadec93447383892907fdfeed625))
* **hooks:** add first-run gate banner for unscaffolded consumers ([33baa0e](https://github.com/event4u-app/agent-config/commit/33baa0ed701acb3be7efdbfd73483a8e81e76982))
* **hooks:** add dispatch-issues.jsonl observability layer ([7642b7a](https://github.com/event4u-app/agent-config/commit/7642b7af8147f4caa68817a12e0a875cab921840))
* **bench:** add replay-opaque trigger bucket + linter rule-id robustness ([0f6c727](https://github.com/event4u-app/agent-config/commit/0f6c727ccfa201d874383cbb7be8ab232d3b20bc))
* **bench-corpus:** ship 5 router-coverage extension corpora ([dccedb3](https://github.com/event4u-app/agent-config/commit/dccedb33697e0f924388b87b3ad8b66d027f9f97))
* **telemetry:** manifest auto-discovery + intended-vs-observed + unintended_activations ([3d46bdc](https://github.com/event4u-app/agent-config/commit/3d46bdc31d46fd830b2138957b91670a8c3d527c))
* **bench-corpus:** add intended_triggers + open_files + command fields ([6c97e51](https://github.com/event4u-app/agent-config/commit/6c97e51fba8e59fda8e56c3fc7fe6f9ac8774b60))
* **value:** router-trigger telemetry + Panel B attribution ([c867411](https://github.com/event4u-app/agent-config/commit/c8674116591f0d0b4f8221f9f7d5fcebe28da077))
* **taskfiles:** wire `task value*` targets + cadence row ([8b26a43](https://github.com/event4u-app/agent-config/commit/8b26a43af4dff4050084691fe8b2a6f036ce96ce))
* **scripts:** lint docs/value.md for structural invariants ([370b0b0](https://github.com/event4u-app/agent-config/commit/370b0b00a44d086b7fe8f0a21b0a5d2d92fca98a))
* **scripts:** render docs/value.md from value-v1 — the dashboard ([08c626a](https://github.com/event4u-app/agent-config/commit/08c626a07975b36958ef37222263f50cbd5dc196))
* **bench:** capture first live A/B Track B with-vs-without run ([7de6445](https://github.com/event4u-app/agent-config/commit/7de64452a0368377ae1f72b87dd7e50a6a72e49e))
* **scripts:** measure rtk's actual CLI-output token savings ([b51821e](https://github.com/event4u-app/agent-config/commit/b51821e31e7fb1be301a33f8c56bcebab2b49c51))
* **scripts:** add value_ladder + value_report libs and unit tests ([5d1b8ba](https://github.com/event4u-app/agent-config/commit/5d1b8bad3058bbad66acc408c4b83df419d55a4a))

### Bug Fixes

* **deps:** relax runtime dependency floors so npx resolves under prefer-offline ([0f04673](https://github.com/event4u-app/agent-config/commit/0f0467353a40b4bf75ba3424b0e177d10ab802eb))
* **hooks:** respect AGENT_CONFIG_REPLAY + fix dispatcher case-regex match ([b86c681](https://github.com/event4u-app/agent-config/commit/b86c68194e61dd6612d3b03ebdf799bc721fb53e))
* **bench-corpus:** correct intended_triggers, mark intent-only rules replay-opaque ([669cdbf](https://github.com/event4u-app/agent-config/commit/669cdbffa37664654bc24da61457f1867fafcd1c))
* **value:** load rung now measures the real kernel, not the canon ([6721090](https://github.com/event4u-app/agent-config/commit/6721090ad2d79199f28532a7f42cfcb9a08931dc))
* **scripts:** reframe docs/benchmark.md Track A headline ([2766e22](https://github.com/event4u-app/agent-config/commit/2766e22f1a74a82d15a011e20ddb3758c36055cc))

### Documentation

* **roadmaps:** archive road-to-one-migrate-command (all phases done) ([626e7c1](https://github.com/event4u-app/agent-config/commit/626e7c1c1bfd21174a2df4d41f5dcaa76df776d9))
* **migrate:** redirect cross-references to the unified contract ([557e64d](https://github.com/event4u-app/agent-config/commit/557e64de58dc0a0555f3a3b9fce1f0c6d0a8b13a))
* **contracts:** lock unified migrate command behavior matrix ([5828cbc](https://github.com/event4u-app/agent-config/commit/5828cbc90195ed0af9771b8d0b1bd7e153d004b7))
* **roadmaps:** add road-to-per-skill-model-autoswitch + regen dashboard ([3cdeeea](https://github.com/event4u-app/agent-config/commit/3cdeeea448a9d3492addf0e1171f4fe7e4aafeb0))
* **roadmaps:** record step-completion notes on hooks-actually-fire archive ([7150557](https://github.com/event4u-app/agent-config/commit/715055778358d32233b5222496f03258b983626d))
* **evidence:** reproduce + document marketplace-install hook gap ([cc5a557](https://github.com/event4u-app/agent-config/commit/cc5a5574e1bda89bfe8c2260ee163ee952d36019))
* **roadmaps:** add road-to-hooks-actually-fire-in-consumers + council fixes ([1255842](https://github.com/event4u-app/agent-config/commit/1255842c7c28659d13532f27190b965857df38f7))
* **roadmaps:** Phase 7 honesty-floor correction on corpus-expansion roadmap ([1def2eb](https://github.com/event4u-app/agent-config/commit/1def2eb34debb4dadb9d50025b8963954905e3c7))
* **roadmaps:** mark Phase 6 checkboxes on archived corpus-expansion roadmap ([a5c0c11](https://github.com/event4u-app/agent-config/commit/a5c0c11e58616180e5485e78b76832b5db7f8610))
* **roadmaps:** close road-to-corpus-expansion-evidence-based-cuts ([88c1644](https://github.com/event4u-app/agent-config/commit/88c1644dac99eeefad5031550d657c881cd87fe7))
* **value:** pass-2 close-out — structural categorisation, 0 cuts ([389df66](https://github.com/event4u-app/agent-config/commit/389df66f13794ddd98884e55726da1eb2285d54a))
* **roadmaps:** fold Round-3 council fixes into corpus-expansion plan ([25f6039](https://github.com/event4u-app/agent-config/commit/25f603967ac6193dedee1d761a9d0939dd94ced2))
* **roadmaps:** plan corpus expansion + evidence-based tier-1 cuts ([f570b97](https://github.com/event4u-app/agent-config/commit/f570b973ba3caa26b329393724c0a364ae6a762b))
* **roadmaps:** mark Phase 6 checkboxes on archived netto-cuts roadmap ([802da06](https://github.com/event4u-app/agent-config/commit/802da0685d42f7f3909c1df0ed29f349bd91e84f))
* **roadmaps:** close road-to-value-dashboard-netto-cuts dashboard ([d1e5f25](https://github.com/event4u-app/agent-config/commit/d1e5f2527eb8cc5aed522d479b2a197bdc557604))
* **value:** re-render dashboard with corrected NETTO + close-out summary ([b4ea133](https://github.com/event4u-app/agent-config/commit/b4ea1334e587bae6872aff15bab296d24c1a35b4))
* **roadmaps:** add road-to-value-dashboard-netto-cuts ([3ed3ea7](https://github.com/event4u-app/agent-config/commit/3ed3ea77419e6d5320df05a09a30587f2a9d0437))
* **roadmaps:** close road-to-readable-value-dashboard ([28afac2](https://github.com/event4u-app/agent-config/commit/28afac2ab67e3ca86637baa0dde2b140b1fbb9e6))
* **contracts:** add value-dashboard-spec + value-report-schema ([46abebd](https://github.com/event4u-app/agent-config/commit/46abebdea378a782f56b3f9fefc0212f7163f321))

### Refactoring

* **kernel:** extract language-and-tone mechanics to guideline (−82 tok/req) ([f1cfeab](https://github.com/event4u-app/agent-config/commit/f1cfeabec63e02b03bfe5ce0a3e16a1e5445c46b))

### Tests

* **lint-agents-layout:** align consumer-warning assertion with unified migrate ([496af6c](https://github.com/event4u-app/agent-config/commit/496af6c8a66cf6c6accf3f1c13376340d44e1ca8))

### Chores

* **roadmaps:** regen dashboard after archiving hooks-actually-fire roadmap ([45a3ea7](https://github.com/event4u-app/agent-config/commit/45a3ea715ae4956f256aeaf20e11c36878711b0b))
* **value:** refresh dashboard + telemetry snapshots after kernel cut ([e7653a1](https://github.com/event4u-app/agent-config/commit/e7653a1be4bacb7fb75e2bf9310d63bd3d5a5349))
* **bench:** ship pass-2 audit artefacts under router-telemetry/ ([89b3900](https://github.com/event4u-app/agent-config/commit/89b3900f070a13cd02193733527b6ed943922d06))
* **router:** minify dist/router.json by default + audit context loading ([d011333](https://github.com/event4u-app/agent-config/commit/d011333f1126ce636961906a3d070fd306458880))

Tests: 5137 (+59 since 4.9.0)

## [4.9.0](https://github.com/event4u-app/agent-config/compare/4.8.0...4.9.0) (2026-05-28)

### Features

* **scripts:** inventory abstraction-budget classes via grep-backed audit ([bf4de06](https://github.com/event4u-app/agent-config/commit/bf4de06d12908281e7a657cab8783c3cdae39a2e))

### Documentation

* **roadmaps:** close discovery, charter scoped reduction follow-up ([f749c77](https://github.com/event4u-app/agent-config/commit/f749c778ae02f6718c9d499213c8781392e95b3e))
* **evidence:** abstraction-budget Phase-1 inventory + frontmatter audit ([178c0b6](https://github.com/event4u-app/agent-config/commit/178c0b605085801282c7f61c2b01d6d8dc83396e))

Tests: 5078 (+0 since 4.8.0)

## [4.8.0](https://github.com/event4u-app/agent-config/compare/4.7.2...4.8.0) (2026-05-28)

### Features

* **install:** close Claude Code global distribution gap ([aa15db9](https://github.com/event4u-app/agent-config/commit/aa15db9651c4fd21f8bd30ef88e3aeeb1eb31e22))

### Bug Fixes

* **maintainer:** align .claude/settings.json plugin id ([b59e080](https://github.com/event4u-app/agent-config/commit/b59e0804e874e9c7c95cfc821a31746e4241f61c))

### Documentation

* **adr:** record claude-code command-projection strategy (ADR-030) ([706dedb](https://github.com/event4u-app/agent-config/commit/706dedb54f5792a2cf5b7c2401054b30490edeec))

### Tests

* **install:** regression coverage for global distribution heal ([bfdbc90](https://github.com/event4u-app/agent-config/commit/bfdbc9053d9032ffd10248835ba03f276631c7b3))

### Chores

* gitignore install-time artefacts in maintainer repo ([d75aeac](https://github.com/event4u-app/agent-config/commit/d75aeac4ed8858d2cddc7e3534eeff6bfb1ab036))

Tests: 5078 (+14 since 4.7.2)

## [4.7.2](https://github.com/event4u-app/agent-config/compare/4.7.1...4.7.2) (2026-05-28)

### Bug Fixes

* **wizard:** first-run setup writes a schema-valid settings file ([e3ca97f](https://github.com/event4u-app/agent-config/commit/e3ca97f1dc9701eddc6fea274d4d38c2cfd831ae))

### CI

* **workflows:** authenticate arduino/setup-task to dodge API rate limit ([090bcfa](https://github.com/event4u-app/agent-config/commit/090bcfa57d35eb19783e1fcfd40934e7b3266d91))

Tests: 5064 (+0 since 4.7.1)

## [4.7.1](https://github.com/event4u-app/agent-config/compare/4.7.0...4.7.1) (2026-05-28)

### Bug Fixes

* **wizard:** make role optional so setup can save without a role pick ([dd0bc16](https://github.com/event4u-app/agent-config/commit/dd0bc168268fa9f9fe2b95ae5ef7cec76d66bdbe))

Tests: 5064 (+0 since 4.7.0)

## [4.7.0](https://github.com/event4u-app/agent-config/compare/4.6.0...4.7.0) (2026-05-28)

### Features

* **wizard:** drop the AI Council step from setup ([868853d](https://github.com/event4u-app/agent-config/commit/868853de2a7b973a0d9953422e914e6eef80bdfd))

### Bug Fixes

* **wizard:** make voice_sample optional so setup can save ([cfeeb93](https://github.com/event4u-app/agent-config/commit/cfeeb932344f3c0586d6baacbd30186deac377b9))

Tests: 5064 (+0 since 4.6.0)

## [4.6.0](https://github.com/event4u-app/agent-config/compare/4.5.0...4.6.0) (2026-05-28)

### Features

* **wizard:** global-only settings + dedicated Projekt surface ([dc229a9](https://github.com/event4u-app/agent-config/commit/dc229a9a61f0a14527b5c85f0cb7db03fbbc72f8))
* **install:** deliver Claude hooks via plugin scope ([f76a7d1](https://github.com/event4u-app/agent-config/commit/f76a7d16e09369dacc466fb838463e5f04616480))

### Documentation

* **roadmap:** archive road-to-wizard-sse-hardening (complete) ([e565624](https://github.com/event4u-app/agent-config/commit/e5656240cca738acc5ba2aa3804d9d067820d071))
* **roadmap:** mark wizard-sse-hardening Phase 1+2 done, sync dashboard ([6df030b](https://github.com/event4u-app/agent-config/commit/6df030b87cb6980c0118168af4e0140551b4678f))

### Tests

* **wizard:** cover SSE apply endpoint failure paths ([9ffa068](https://github.com/event4u-app/agent-config/commit/9ffa068a898038f2e880f1a28ceb979cb5bb56cf))

### Chores

* **changelog:** split era 4.1.x → pre-4.5.0 ([44f40d6](https://github.com/event4u-app/agent-config/commit/44f40d6b166ed259b274fd91f63b01369f986346))
* **changelog:** split era 4.1.x → pre-4.5.0 ([69df8cf](https://github.com/event4u-app/agent-config/commit/69df8cf306763dff55c5639ac018e57c7596b461))

Tests: 5064

# Era: pre-4.0.0 — archived

> All entries from `3.2.0` and `3.3.0` live in
> [`docs/archive/CHANGELOG-pre-4.0.0.md`](docs/archive/CHANGELOG-pre-4.0.0.md).
> The archive is read-only; git tags `3.2.0` and `3.3.0` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-3.2.0 — archived

> All entries from `3.1.0` and `3.1.1` live in
> [`docs/archive/CHANGELOG-pre-3.2.0.md`](docs/archive/CHANGELOG-pre-3.2.0.md).
> The archive is read-only; git tags `3.1.0` and `3.1.1` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-3.1.0 — archived

> All entries from `3.0.0` live in
> [`docs/archive/CHANGELOG-pre-3.1.0.md`](docs/archive/CHANGELOG-pre-3.1.0.md).
> The archive is read-only; git tag `3.0.0` remains the canonical
> source for what shipped. Splitting it out of the main file keeps
> the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

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
