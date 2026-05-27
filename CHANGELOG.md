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

# Era: 4.5.x — current

> Started at `4.5.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 4.6.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

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

# Era: pre-4.5.0 — archived

> All entries before `4.5.0` live in
> [`docs/archive/CHANGELOG-pre-4.5.0.md`](docs/archive/CHANGELOG-pre-4.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

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
