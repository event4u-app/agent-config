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

### 6.0.0 at a glance — release overview

> A reader who never saw the PRs should understand 6.0.0 in under two
> minutes. Seven headlines here; migration steps in **Breaking changes**
> below; granular per-roadmap detail in the entries further down.

6.0.0 is the release that turns agent-config into a **workplace**, not just a
rule pack:

1. **Workspace.** A task-orchestration layer owns the host-session lifecycle,
   continuation, and drive health — the engine behind `/work` and
   `/implement-ticket`.
2. **Multi-turn continuation.** A long task survives across turns: the
   workspace resumes where it left off instead of restarting cold.
3. **Secure local stores.** Session state and sensitive local data live in an
   encrypted-at-rest store under `~/.event4u/agent-config/`, not loose files.
4. **MCP server.** agent-config exposes its skills and commands over MCP, so
   MCP-aware hosts can reach them directly.
5. **AI-video Creative Pack (optional).** The AI-video surface graduates from
   prototype to validated provider adapters, shipped as an **opt-in Creative
   Pack** — not core identity, not a new platform.
6. **Breaking — condensed output relocated.** The repo-root `.agent-src/` tree
   is removed; condensed output now lives at `dist/agent-src/` ([ADR-058]).
7. **Upgrade cleanup.** Upgrading reaps stale deployed files (renamed/removed
   skills and commands) so old installs don't rot; `agent-config --dry-run`
   previews exactly what gets removed before any deletion.

Pack-scoped projection (opt-in) and the TypeScript CLI + local-server
foundation also land — both non-breaking by default.

### Breaking changes (6.0.0)

**1. Condensed output moved: root `.agent-src/` → `dist/agent-src/`** ([ADR-058])

- **Who is affected:** consumers whose scripts or tool configs hard-code
  `.agent-src/…` paths (plugin-marketplace clones, custom symlinks, CI globs).
  Default installs are **not** affected — regenerated projections pick up the
  new location automatically.
- **What breaks:** the repo-root `.agent-src/` tree is removed, so any
  hard-coded `.agent-src/<x>` path no longer resolves.
- **How to migrate:** replace `.agent-src/` with `dist/agent-src/` in any
  path you hard-code.
- **Which command:** `agent-config install` (consumers) — or `task sync` +
  `task generate-tools` (this repo) — regenerates projections at the new
  location; the upgrade reaper removes the stale root tree. No manual path
  edits beyond your own hard-codes.
- **Rationale:** the root tree conflated source and build output; moving
  condensed output under `dist/` makes "generated, do not edit" unambiguous
  and keeps the repo root clean.

**2. Settings key renamed: `cost_profile` → `rule_loading_tier`**

- **Who is affected:** anyone with a hand-edited `cost_profile` in
  `.agent-settings.yml`.
- **What breaks:** nothing immediately — `cost_profile` is read as a fallback
  during the grace period. The colliding memory-cadence meaning moved to its
  own `memory.cadence` key (`auto`/`always`/`never`).
- **How to migrate:** automatic.
- **Which command:** `agent-config install` / `setup` migrates existing
  settings on the next run. No manual action required.
- **Rationale:** one key carried two unrelated meanings (rule-loading footprint
  vs. memory-line cadence); splitting them removes the collision.

[ADR-058]: docs/decisions/ADR-058-condensed-output-relocation-to-dist.md

### Feedback wanted — multi-agent MCP config (demand probe, `ADR-086`)

We are deciding whether to build a cross-agent MCP discovery / install helper.
One question — answer in [Discussions](https://github.com/event4u-app/agent-config/discussions):

> **Do you run more than one AI coding agent in the same project, and is keeping
> MCP-server config in sync across them painful?**
> (a) very painful · (b) somewhat · (c) single-agent, not applicable · (d) I already
> self-script it.

This gates the read-only MCP discovery helper (`agent-config mcp:search`) and the
deferred auto-install question (`ADR-086`).

### Added — pack-scoped projection (opt-in, `road-to-6.0.0-b`)

The projector can now write only the **active profile + packs'** artefacts into
the host-tool trees instead of all 150 commands / 223 skills (ADR-040 —
projection-time filtering, not a runtime resolver).

- **Non-breaking by default.** A new `projection.mode` setting defaults to
  `legacy-all` — `npm update` to 6.0.0 changes nothing. Scoped projection is
  **opt-in** and never inferred from `profile.id`.
- **Opt in** with `agent-config use --profile=<id>` (sets `projection.mode:
  scoped`), then `agent-config refresh` to re-project. Selected packs are the
  profile's base `packs` unioned with the `runtime.active_packs` session
  overlay, expanded over the `requires` graph. `agent-config use
  --profile=legacy-all` restores the full surface.
- **Profiles are self-sufficient** — every `skills_hint` skill resolves from
  the profile's base packs (the new `profile.packs` field). Resolved in the AI
  council, 2026-06-03.
- **Atomic.** A failed scoped projection restores the full (legacy-all) tree.
  The committed plugin marketplace (`.claude-plugin/`) and the Augment tree
  (`.augment/`) always project the full set in 6.0.0.

**Staged rollout (this release ships 6.0.0 only):**

1. **6.0.0** — default `legacy-all` (opt-in profiles). *This release.*
2. **6.1.0** — default flips to profile/scoped mode with a `--legacy` escape.
3. **7.0.0** — removes `legacy-all` **only if** telemetry shows <10% usage.

The default flip and removal are explicitly **out of scope** for 6.0.0 and
gated on the telemetry from 6.0.0-C. Deferred to 6.0.0-C: a
`skills_discoverable` field, reactive just-in-time pack activation, and the
per-pack budget lint.

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

# Era: pre-5.4.0 — archived

> All entries before `5.4.0` live in
> [`docs/archive/CHANGELOG-pre-5.4.0.md`](docs/archive/CHANGELOG-pre-5.4.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-5.9.0 — archived

> All entries before `5.9.0` live in
> [`docs/archive/CHANGELOG-pre-5.9.0.md`](docs/archive/CHANGELOG-pre-5.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-6.0.0 — archived

> All entries before `6.0.0` live in
> [`docs/archive/CHANGELOG-pre-6.0.0.md`](docs/archive/CHANGELOG-pre-6.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-7.0.0 — archived

> All entries before `7.0.0` live in
> [`docs/archive/CHANGELOG-pre-7.0.0.md`](docs/archive/CHANGELOG-pre-7.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 7.0.x — current

> Started at `7.0.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 7.1.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [7.0.0](https://github.com/event4u-app/agent-config/compare/6.1.0...7.0.0) (2026-06-21)

### BREAKING CHANGES

* **tickets:** remove build_ticket_export.py (no API export, ADR-102) ([a2886ec](https://github.com/event4u-app/agent-config/commit/a2886ec782ff76c3c147b93ecc12091cd42766b5))

### Features

* **py2ts:** golden-transcript re-platform Phase 6 — delete Python originals (Hard Floor) ([bc80b1e](https://github.com/event4u-app/agent-config/commit/bc80b1e8ba20907e632786fef5cf8383700807c1))
* **py2ts:** golden-transcript re-platform Phase 5 — capture.ts + replay test + re-captured baselines ([d0f4d7e](https://github.com/event4u-app/agent-config/commit/d0f4d7e9c5e1293f7d3c52ff432df39f022e9425))
* **py2ts:** golden-transcript re-platform Phase 4 COMPLETE — governance gt_g1-4 ([e4e420e](https://github.com/event4u-app/agent-config/commit/e4e420e0be8d5a498d0e61b0a279453e107a915a))
* **py2ts:** golden-transcript re-platform Phase 4 — UI recipes gt_u11-15 ([0fb0458](https://github.com/event4u-app/agent-config/commit/0fb04581bc6881c2ec456ac83d2ffa1255b6843c))
* **py2ts:** golden-transcript re-platform Phase 4 — UI recipes gt_u6-10 ([03f2ada](https://github.com/event4u-app/agent-config/commit/03f2ada707e22083b3663951adecf9d5fd9ad078))
* **py2ts:** golden-transcript re-platform Phase 4 — UI recipes gt_u1-5 ([ad52d02](https://github.com/event4u-app/agent-config/commit/ad52d020156468fee4aeccce56008b67a34b8793))
* **py2ts:** golden-transcript re-platform Phase 4 — prompt recipes (gt_p1-4) ([17d4fb0](https://github.com/event4u-app/agent-config/commit/17d4fb07bc5782dbc908f11673a71a7cd90c7c3a))
* **py2ts:** golden-transcript re-platform Phase 4 — R1 recipes (gt2-gt5) ([4cff9e8](https://github.com/event4u-app/agent-config/commit/4cff9e88b2c2c459ed04b3a44f807788cdc2d15c))
* **py2ts:** golden-transcript re-platform — GT-1 vertical slice (full chain) ([80a7528](https://github.com/event4u-app/agent-config/commit/80a75283527496e0ccefcac239a666d61e8f0f54))
* **py2ts:** golden-transcript re-platform Phase 3 — harness.ts comparators ([1ac5475](https://github.com/event4u-app/agent-config/commit/1ac5475072ae1142c28e850486439a092a7290f4))
* **py2ts:** golden-transcript re-platform Phase 2b — runner.ts ([6a3fd9e](https://github.com/event4u-app/agent-config/commit/6a3fd9effb83dd79ce7a2d3ea2b0691b01eab486))
* **py2ts:** golden-transcript re-platform Phase 2a — _helpers.ts ([9fd4843](https://github.com/event4u-app/agent-config/commit/9fd4843b12fbcd8aa57e867a572a5f38ba6db931))
* **py2ts:** golden-transcript re-platform Phase 1 — toy repo → TS+vitest ([16b7e27](https://github.com/event4u-app/agent-config/commit/16b7e274a3daa1dea72e8a8d992063e51407a585))
* **py2ts:** pre-bundled node installer bridge for raw-source consumers ([c2facad](https://github.com/event4u-app/agent-config/commit/c2facadee20e8c05e65e2bd189c7e89916f78691))
* **py2ts:** Phase 11 final — workspace CLI (14) + release + roadmap tooling (5) ([e6be9e3](https://github.com/event4u-app/agent-config/commit/e6be9e3b05504463df5daa5033b38f515560ba9c))
* **py2ts:** Phase 11 — port the _cli command surface (33 twins) + fix ESM require bugs ([f406701](https://github.com/event4u-app/agent-config/commit/f406701c8630c5bc3620f49a67d7bd65ba483a70))
* **py2ts:** sync #7 — re-port 17 stale + 18 new twins (main +164) ([580695d](https://github.com/event4u-app/agent-config/commit/580695de77cf32b5f2b13e21a232a8154117e87b))
* **install:** wire layout migration + core-only deploy into the installer ([46f1266](https://github.com/event4u-app/agent-config/commit/46f1266e3aecb328c68c932bdce9be008ea6f546))
* **install:** tag core vs lab surface tiers + add the boundary guard ([da2054e](https://github.com/event4u-app/agent-config/commit/da2054e93ce54f6068471243e3c8add84fce737c))
* **install:** freeze the install-layout ABI as a versioned contract ([d5d4aa9](https://github.com/event4u-app/agent-config/commit/d5d4aa925b63512f1ed07f41a9f74004011e00e7))
* **brand:** ship the /brand: command cluster (pack-brand → command-bearing) ([5aa251b](https://github.com/event4u-app/agent-config/commit/5aa251b178ad0dafbd662369acd2373268d13449))
* **eval:** backfill design-intelligence last_eval + make lint-eval-freshness blocking ([c9b1843](https://github.com/event4u-app/agent-config/commit/c9b1843f9cf3d4198a4e95e78d460ca490137342))
* **ai-image:** A.4 quality gates — cost notes + freshness caveat on image adapters ([a604acb](https://github.com/event4u-app/agent-config/commit/a604acb245451276beed487be36383ed401cf7d1))
* **eval:** Phase D — eval:record TS command, domain floors, freshness lint, refresh runbook ([5f69437](https://github.com/event4u-app/agent-config/commit/5f69437ccf58e27b42dd721f3f23c1a6a6c5079c))
* **brand:** Phase B — pack-brand corpus, workflow/token skills, personas, rules ([0f08db7](https://github.com/event4u-app/agent-config/commit/0f08db7e2944e351139729e3b1d26c006e6f117a))
* **rdp-eval:** trigger-layer wiring + first live run + quality-layer corpus ([0a5eb4f](https://github.com/event4u-app/agent-config/commit/0a5eb4fa9b7e645288094bc443f4a900bc8bb8b2))
* **evidence-v2:** silent-conventions eval; KILL accumulation layer (shipped base only) ([4bb1a6c](https://github.com/event4u-app/agent-config/commit/4bb1a6c5cb9280e99a9a224da9ae0f115473821e))
* **ai-image:** A.3 generation skills — image-generation/editing, logo + brand-asset ([dc19430](https://github.com/event4u-app/agent-config/commit/dc19430b8ea064a6febe19b90ba332d3cf3b88dd))
* **frontend-design:** Phase C — typography-system + iconography skills, icon-consistency rule ([0dc72cb](https://github.com/event4u-app/agent-config/commit/0dc72cb9e6c18c62b0e6e2a053bec14157793d36))
* **ai-image:** pack-ai-image capability pack — provider-routing + prompt skills + likeness rule ([984a0cc](https://github.com/event4u-app/agent-config/commit/984a0cc6262ca52fbc1d579e706cc7456820eb07))
* **discovery:** manifest v2 — machine-readable `tier` deprecation signal ([df1629d](https://github.com/event4u-app/agent-config/commit/df1629dac231ed400695ca69f9e397d13355087d))
* **ai-image:** scaffold-tier image provider adapters on the shared substrate ([ee527b4](https://github.com/event4u-app/agent-config/commit/ee527b4c116cdcd97c0fbad6cacc2148c70ed404))
* **work-engine:** mixed-routing bias + brand-seed + render cross-link (Phase 4) ([3db0d6d](https://github.com/event4u-app/agent-config/commit/3db0d6d169aa91d9e6c8f22b09dc9c17855edf36))
* **work-engine:** scaffold directive step (greenfield-scaffold Phase 3) ([f832faf](https://github.com/event4u-app/agent-config/commit/f832fafb9cafff7900f461644ce2ab96af262828))
* **roadmap:** add the later/ disposition + enforcement ([51a3329](https://github.com/event4u-app/agent-config/commit/51a332971ccf198e960e9821a5e62cf7e5ad9e09))
* **work-engine:** app-spec grounding gate (greenfield-scaffold Phase 2) ([6a7bd45](https://github.com/event4u-app/agent-config/commit/6a7bd45d067dee3d38c55f8b7d18a8cab5b01e7d))
* **audit:** price MCP tool schemas in the context-load-budget audit ([6c7030c](https://github.com/event4u-app/agent-config/commit/6c7030c60de8c2fc43219f5aded5d5c114b056df))
* **work-engine:** render-verified review gate (greenfield-scaffold Phase 1) ([0395cc7](https://github.com/event4u-app/agent-config/commit/0395cc73a5e9c644c6686bec5d8891dc7494890b))
* **reasoning:** surface RDP settings + ship user-facing contract ([54d26c8](https://github.com/event4u-app/agent-config/commit/54d26c832f7de02114c45d091872378c7a747bfc))
* **evidence-v2:** self-building project-intelligence layer (Class A/B/C) ([e299ccf](https://github.com/event4u-app/agent-config/commit/e299ccfac146a9d9d7aff7498421af4680f07479))
* **evidence-v2:** ADR-103 — global knowledge default-off until measured ([1b929b9](https://github.com/event4u-app/agent-config/commit/1b929b919aa764e8c4b0b83147e6bf42c1755495))
* **ci:** structural breaking-change detector + trigger-eval regression lock ([2292f5b](https://github.com/event4u-app/agent-config/commit/2292f5b110c19fb086c54a01da0a82ac779bd797))
* **roadmap:** registry-aware dashboard — count ticket bundles (Phase 6) ([b49a11f](https://github.com/event4u-app/agent-config/commit/b49a11f7a5d013a11829e18ba925be7ccf708bbd))
* **tickets:** reword emit-tickets/materialize/template to paste/MCP ([bdffdbb](https://github.com/event4u-app/agent-config/commit/bdffdbb6aabb19bb2341314d5045196dc2a5ae8d))
* **tickets:** ticket handoff is paste/MCP, not API export (ADR-102) ([babd519](https://github.com/event4u-app/agent-config/commit/babd51972f8b5e63716ad9cb8d5a5546384ee1b0))
* **capabilities:** add CAPABILITIES.yaml coverage index + capabilities:index CLI ([18df210](https://github.com/event4u-app/agent-config/commit/18df2104ee4da024b888be84106a3e045cfc3c31))
* **tickets:** implement-ticket reads local ticket bundles (Phase 4) ([f698f4a](https://github.com/event4u-app/agent-config/commit/f698f4a863d6ff5438110454daba7bada60bc77b))
* **tickets:** dogfood ticket bundle + Phase-1a pilot evidence ([5700e5e](https://github.com/event4u-app/agent-config/commit/5700e5ed7ad8c4cf1e22bf7a37dabd468c66ea00))
* **tickets:** buildability lint + Linear export generator ([b681434](https://github.com/event4u-app/agent-config/commit/b6814343dd72053507a18b6b315bcf2d9ecef605))
* **tickets:** emit-tickets skill + /roadmap:materialize command ([3c5cc0e](https://github.com/event4u-app/agent-config/commit/3c5cc0e5c00c4e08aa8a42d4b135076f5d8f99c8))
* **tickets:** ticket-bundle format contract, schemas, ADR-101, template ([2e438d7](https://github.com/event4u-app/agent-config/commit/2e438d7fe8dd7eb9b5c55fe1244ed2fed3c2e4c9))
* **knowledge:** global command surface, --global linter, leads-only Evidence Report (ADR-100) ([fa01305](https://github.com/event4u-app/agent-config/commit/fa013056f6442ee19a986b42702f51a19f130f99))
* **knowledge:** file-first global store lib — path, tier, redaction, promotion (ADR-100) ([2a5a87a](https://github.com/event4u-app/agent-config/commit/2a5a87aef4420b43fa4e7612caea585ca718d5c0))
* **knowledge:** user-global global_sharing setting + whitelist (ADR-100) ([5d8fe23](https://github.com/event4u-app/agent-config/commit/5d8fe231e81d3ee73499bb5b8dc0d6b0801e220c))
* **skills:** harvest enhancements 3b/4a/5 + remove agent-memory (Phases 3b/4a/5/6) ([303ec16](https://github.com/event4u-app/agent-config/commit/303ec163139e578dfd45e0c91036b2adf809e4c4))
* **analysis:** project-analysis freshness loop (harvest Phase 2) ([e0164e4](https://github.com/event4u-app/agent-config/commit/e0164e497a0ef15105dc9408643f693d03154db1))
* **patterns:** file-first pattern library (harvest Phase 1) ([b702d62](https://github.com/event4u-app/agent-config/commit/b702d6204489929a2f1885776d12a33d80a04b56))
* **py2ts:** install.ts + 6 new tooling twins (Phase 11 foundation + sync #6) ([55f0ad7](https://github.com/event4u-app/agent-config/commit/55f0ad70a371dc2da10b7a61f3e6a1f51903675c))
* **verify-loop:** verify-repair-loop skill — test-verdict-gated iterate-to-green ([a506dd1](https://github.com/event4u-app/agent-config/commit/a506dd1046cd38c9e00bafcadc1acc48d0975530))
* **scripts:** evidence-report + knowledge-card tooling and CI gate ([9ab3ffd](https://github.com/event4u-app/agent-config/commit/9ab3ffd69944cf3784c561e995bc4e3c925695f4))
* **rules:** add evidence-first source-discovery discipline ([c65e605](https://github.com/event4u-app/agent-config/commit/c65e605853d32057a32b06c1f7aa3acf1d68855a))
* **mission:** /mission:upgrade infrastructure + minimal catalog (mission-mode P2A) ([45f07d5](https://github.com/event4u-app/agent-config/commit/45f07d5a5182d574cf4e18aee4f89eabd25c9241))
* **mission:** no-runtime boundary + manifest schema + privilege ADR (mission-mode P0) ([f5e5050](https://github.com/event4u-app/agent-config/commit/f5e505066b31a7b3925bdc7bcd6b7474fdfcd25a))
* **hooks:** block-no-verify PreToolUse guard (security-hardening P3) ([69b28ee](https://github.com/event4u-app/agent-config/commit/69b28eee9a9bacfa6ee0e5aaf93a87a2a38ce84e))
* **ci:** warn-only workflow-security linter (security-hardening P2) ([f95de44](https://github.com/event4u-app/agent-config/commit/f95de44206307e10beb245161b6344d51072fa1b))
* **analysis-workbench:** Phase 5 — FIRST_WIN + cookbook + discovery wiring ([329d941](https://github.com/event4u-app/agent-config/commit/329d9410a56a94f56268248ff88d4afbd866e841))
* **commands:** Phase 4 — /analyze suggester cluster ([1074b3c](https://github.com/event4u-app/agent-config/commit/1074b3cacb67e512e1720302a4a95f6bc531875e))
* **skills:** Phase 3 — premortem + decision-review ([39c2663](https://github.com/event4u-app/agent-config/commit/39c266352ce949529fe557313162839cf8da49e9))
* **skills:** Phase 2 — blameless-post-mortem + root-cause-frameworks ([a7b44ad](https://github.com/event4u-app/agent-config/commit/a7b44adf96e1b15212a3e97c9aa5b76612b70520))
* **memory:** Phase 1 — staleness, supersession & dedup in the memory loop ([f4449c9](https://github.com/event4u-app/agent-config/commit/f4449c99c10cc31d39ebcdbd35d11a3a4902d893))
* **roadmap-writing:** conditional source-derived & adoption authoring mode ([fcd789b](https://github.com/event4u-app/agent-config/commit/fcd789bba18dd347c042bcd4550676b689603821))
* **py2ts:** sync #4 — re-port lint_flows + 5 new tooling twins ([0d1033e](https://github.com/event4u-app/agent-config/commit/0d1033e084e00fc4988ca9bb943f9e70490cbe74))
* **py2ts:** bench-v2 cluster twins (new on main) ([41c9c0b](https://github.com/event4u-app/agent-config/commit/41c9c0b3b921142f3d00d3828d8b18db1a527dbd))
* **ci:** detect merge/stash conflict markers and unmerged paths ([9c79840](https://github.com/event4u-app/agent-config/commit/9c79840a212e00bae6b4ed57fab1e0550f33302a))
* **docs:** generated + validated named cookbook (competitive-borrow P1.4) ([f1fac7d](https://github.com/event4u-app/agent-config/commit/f1fac7d0d5414126b34c626c8be9ea29b2a9bccb))
* **docs:** generated cross-host capability matrix (competitive-borrow P1.3) ([6559b81](https://github.com/event4u-app/agent-config/commit/6559b81815d792402a5cfb614462e006c299446b))
* **ci:** add warn-only skill-originality gate (competitive-borrow P1.1) ([a76bd22](https://github.com/event4u-app/agent-config/commit/a76bd22260ef90ce22f8200ef1578434435ebcc8))
* **bench:** strong-host confirmation — lift is weak-host-specific (sonnet at ceiling) ([da1da23](https://github.com/event4u-app/agent-config/commit/da1da237895aa3c0914c1e2014cedf7688d27027))
* **bench:** SIGNIFICANT discipline lift — package beats vanilla AND placebo (p=0.0005) ([2174ced](https://github.com/event4u-app/agent-config/commit/2174ced0a7559270e55b01679529cb88d7345dd1))
* **bench:** v4 agentic corpus — 3 sealed multi-module long-horizon debug tasks ([6052108](https://github.com/event4u-app/agent-config/commit/605210889790d16cb5568f2a1252b9b1ae0572ff))
* **py2ts:** work_engine TOP layer — dispatcher/emitters/input_builders/cli + directive wiring ([78c1912](https://github.com/event4u-app/agent-config/commit/78c191278748bfb0581a921e92c31ac512e218bb))
* **bench:** v3 capability-headroom corpus — 9 hard novel debug tasks + solve_test oracle ([a17f8d0](https://github.com/event4u-app/agent-config/commit/a17f8d0937d147967b3208cccc678689a28b8f00))
* **bench:** resolve meso-pilot gate — honest null (Phase 2-3) ([5207c59](https://github.com/event4u-app/agent-config/commit/5207c599459273dbffba5bfcbc68347b96942cca))
* **bench:** meso fixtures + weak-host pin (meso-pilot Phase 1/1b) ([2853b33](https://github.com/event4u-app/agent-config/commit/2853b33ffe6d579db9cd2e6b685c5df5aed0e0be))
* **py2ts:** work_engine L2 — directives/ (22) + hooks/ (18) ([e5cc15b](https://github.com/event4u-app/agent-config/commit/e5cc15ba8580c8efb092260de0bebe93667a6032))
* **py2ts:** work_engine L1 — state_io + scoring/ + resolvers/ + intent/ + stack/ ([a203776](https://github.com/event4u-app/agent-config/commit/a2037763626553269900b0efa3c023abb77c9580))
* **py2ts:** skill-scripts — tailwind/shadcn/design-tokens generators to TS (3) ([86b8a58](https://github.com/event4u-app/agent-config/commit/86b8a586432156d7ec36ea20e1ec3d7d016041a1))
* **py2ts:** skill-scripts — corpus-grounding cluster to TS (4) ([5ef2252](https://github.com/event4u-app/agent-config/commit/5ef2252de14ac6247ea1f1733b6ba9972c6bcd31))
* **py2ts:** phase 9 — work_engine cli_args/delivery_state/errors/orchestration/persona_policy ([e88831f](https://github.com/event4u-app/agent-config/commit/e88831f3a75e57f079e8566758b7fc6029293420))
* **py2ts:** phase 9 — work_engine/state to TS (engine state model) ([d94238d](https://github.com/event4u-app/agent-config/commit/d94238d327efd873c346e9d52d96cf0b6818c5b1))
* **py2ts:** phase 9 — work_engine/_lib twins (copied from dev) + tsconfig include ([bb156d3](https://github.com/event4u-app/agent-config/commit/bb156d3256fea4ae841cf6c597361b6e750f6ff4))
* **py2ts:** phase 9 — consumer-template pr_risk_review + pr_review_routing to TS ([c22fb25](https://github.com/event4u-app/agent-config/commit/c22fb257d16780932022fb99b6e7c9c23d1ce596))
* **py2ts:** phase 9 — consumer-template telemetry cluster to TS (entry + subpackage) ([121900f](https://github.com/event4u-app/agent-config/commit/121900ff971e56a95b1651c72ef5b3cec95ffd7f))
* **py2ts:** phase 9 — consumer-template memory + tier-usage scripts to TS (8) ([319c171](https://github.com/event4u-app/agent-config/commit/319c1711b81f6452ec9871818df5a088c6bf4ac6))
* **py2ts:** phase 10 — council_cli to TS (the council entrypoint; ai_council complete) ([f7add81](https://github.com/event4u-app/agent-config/commit/f7add81ac86e27105ea7387e45e63c804ac1e0fd))
* **py2ts:** phase 10 — ai_council/low_impact (fast-path) ([971f9c4](https://github.com/event4u-app/agent-config/commit/971f9c464a66213838a793e866003e590b5f996f))
* **py2ts:** phase 10 — ai_council/session + council_prune ([8230801](https://github.com/event4u-app/agent-config/commit/8230801598d09c912fa8cf32ee26d92dd9046688))
* **py2ts:** phase 10 — ai_council compile_corpus/learn_preview/shadow_dispatch ([a18752e](https://github.com/event4u-app/agent-config/commit/a18752e0e378f94a64cda0002de95cbd49903c0f))
* **py2ts:** phase 10 — ai_council necessity + replay ([ce93df1](https://github.com/event4u-app/agent-config/commit/ce93df1f6da669e6634dea38986fb1a1a581010f))
* **py2ts:** phase 10 — ai_council/orchestrator to TS (council core) ([89a0e2b](https://github.com/event4u-app/agent-config/commit/89a0e2b4f382c17009b1d0cc8277894a811b62a9))
* **py2ts:** phase 10 — ai_council low_impact_corpus/redact/intake/bundler ([55b0b0f](https://github.com/event4u-app/agent-config/commit/55b0b0f3b4bb8fccc0b5b11e29cc6bebcc68a3f9))
* **py2ts:** phase 10 — ai_council prompts/consensus/advisors/solo_dispatch ([0e7a294](https://github.com/event4u-app/agent-config/commit/0e7a294bfcdbc5ecc915cb2c16d14116020c2d08))
* **py2ts:** phase 10 — ai_council/clients to TS (provider/client layer) ([0194bdf](https://github.com/event4u-app/agent-config/commit/0194bdf3250feae68a168d87044d0c8e5d57fba0))
* **py2ts:** phase 10 — ai_council budget_guard/airgap/cli_hints/probation_gate ([1c9bb1d](https://github.com/event4u-app/agent-config/commit/1c9bb1d89334eb570518a794a4813694bf05a5e0))
* **py2ts:** phase 10 — ai_council events_log/project_context/modes/confidence_gate ([92c50e4](https://github.com/event4u-app/agent-config/commit/92c50e400c23f93f008d0eb2116d17082e4037bb))
* **py2ts:** phase 10 — ai_council/config to TS (the config linchpin) ([779a4e6](https://github.com/event4u-app/agent-config/commit/779a4e6348eb6aa077511668e2306b89154c1473))
* **py2ts:** phase 8 — poisson_sim + pool_winsim to TS (PyRandom-backed) ([725b321](https://github.com/event4u-app/agent-config/commit/725b32197ffd833e39748d2652fee91171b21a82))
* **py2ts:** phase 8 — _lib/py_random (faithful CPython MT19937) ([0e5ff3b](https://github.com/event4u-app/agent-config/commit/0e5ff3b6c70a34b2239fa5940e6b32092bebf4f7))
* **py2ts:** phase 8 — security_audit_config to TS (imports child _scans) ([5c948bd](https://github.com/event4u-app/agent-config/commit/5c948bdaa8d37979a2643c2652bab991bad66966))
* **py2ts:** phase 8 — mcp-config-security + skill-frontmatter-safety linters ([6ef7d6a](https://github.com/event4u-app/agent-config/commit/6ef7d6ae08ccc43bc5906af218cb1ba315b911d5))
* **py2ts:** phase 8 — lint_agent_security + injection_scan_hook to TS ([a7c2d8a](https://github.com/event4u-app/agent-config/commit/a7c2d8a461d02690c23b0846908cbe34dc80f533))
* **py2ts:** phase 8 — security_lint lib + hidden-unicode/instruction-smuggling linters ([cd00e5e](https://github.com/event4u-app/agent-config/commit/cd00e5e6690f6d5f7d449042653423e1f28e06c1))
* **py2ts:** phase 8 — chat_history to TS + dedup mcp_server/tools.ts ([e68e539](https://github.com/event4u-app/agent-config/commit/e68e539eac62dfc890d7164b3b1885f0cd438de2))
* **py2ts:** phase 8 — runtime_dispatcher to TS ([f934fde](https://github.com/event4u-app/agent-config/commit/f934fde28f056531a788f567906f5c49f1e144ce))
* **py2ts:** phase 8 — adr/regenerate_index + prediction-pool/score_ev to TS ([e9e2025](https://github.com/event4u-app/agent-config/commit/e9e2025b2e4b4274200ba9cee02de9440323f046))
* **py2ts:** phase 8 — tools/ adapter cluster to TS (4 twins) ([9282744](https://github.com/event4u-app/agent-config/commit/928274489df4547d78b96c56d4f66c48418719c8))
* **py2ts:** phase 8 — mcp_* top-level twins to TS (5 scripts) ([fbc1c90](https://github.com/event4u-app/agent-config/commit/fbc1c90dd40a018081b09ae0340b06ea49d42572))
* **py2ts:** phase 8 mcp_server leaf layer to TS (tools/server/__main__) ([2f76a31](https://github.com/event4u-app/agent-config/commit/2f76a3101b376991bb1c2ee8de3dd40b2c62201c))
* **py2ts:** phase 8 mcp_server foundation layer to TS (6 modules) ([dbb895c](https://github.com/event4u-app/agent-config/commit/dbb895cdab28a49bee109b7ad7489fe8dca05a79))
* **py2ts:** complete main-sync — visibility mirror + port 2 new main scripts ([da90779](https://github.com/event4u-app/agent-config/commit/da90779a2fff61e947a5759052e8c786f888ed35))
* **py2ts:** phase 8 wave 8h — runtime/smoke/discovery top-level to TS (6 modules) ([567eb4e](https://github.com/event4u-app/agent-config/commit/567eb4e26cc748d05ff92016cb26561b74bb151d))
* **py2ts:** phase 8 wave 8h — config package to TS (6 modules) ([0d6d11b](https://github.com/event4u-app/agent-config/commit/0d6d11b8f6f61292c41edc9ad4684113462c1995))
* **py2ts:** phase 8 wave 8h — skill_tools package to TS (6 modules) ([5e6467a](https://github.com/event4u-app/agent-config/commit/5e6467ab6e3493317fde39fa2f434193a4bc984e))
* **py2ts:** phase 8 wave 8g — rule-matrix/modules/required-checks/cross-repo to TS (5 modules) ([58bdf78](https://github.com/event4u-app/agent-config/commit/58bdf78306e43bb63e3543b6496cf5c30f8578d8))
* **py2ts:** phase 8 wave 8g — capture/mine/audit/discovery/prices to TS (6 modules + 2 deps) ([400657b](https://github.com/event4u-app/agent-config/commit/400657b768bdf0de73a522c75cc6cd0cb1eb829a))
* **py2ts:** phase 8 wave 8g — refine-ticket/pack/mcp-render/redact to TS (4 modules) ([0eb2937](https://github.com/event4u-app/agent-config/commit/0eb293789e4cf9c29e30db3eaa3ff130843c5bc1))
* **py2ts:** phase 8 wave 8f — command_suggester package to TS (9 modules) ([9760927](https://github.com/event4u-app/agent-config/commit/97609271bea66849efa442badfb5bbaf21714a1d))
* **py2ts:** phase 8 wave 8e — skill-evals/model-tier/profile/tool/cost to TS (5 modules) ([42fccac](https://github.com/event4u-app/agent-config/commit/42fccac1de1428f77d10828793bb2a567705adc5))
* **py2ts:** phase 8 wave 8e — migrate/skill-preview/telegraph/cost to TS (5 modules + helper) ([5888df8](https://github.com/event4u-app/agent-config/commit/5888df81fab5f69aa8344eb43d1a38e515270630))
* **py2ts:** phase 8 wave 8e — skill-discovery/ci/iron-law/linked-projects to TS (5 modules) ([f132dc8](https://github.com/event4u-app/agent-config/commit/f132dc8dbc550318bef82c9dd671afc00f2c8171))
* **py2ts:** phase 8 wave 8d — bench run/ab-run/tracka/drift to TS (4 modules + helper) ([a608293](https://github.com/event4u-app/agent-config/commit/a6082938c19491d553f37b54a07a00b0cfb37fb9))
* **py2ts:** phase 8 wave 8d — bench rtk/diff/clone/integrity to TS (4 modules + helper) ([cfe5ebe](https://github.com/event4u-app/agent-config/commit/cfe5ebeb2cbf60c469e92052994a4af397b7d2ef))
* **py2ts:** phase 8 wave 8d — bench runners + per-tool + baseline to TS (5 modules) ([a414354](https://github.com/event4u-app/agent-config/commit/a414354e1ffd90b0988237637ce9a5a56054ad2d))
* **py2ts:** phase 8 wave 8c — measure/score/inventory to TS (6 modules) ([5237949](https://github.com/event4u-app/agent-config/commit/52379492a02a720953aed385187d43b9a752ec08))
* **py2ts:** phase 8 wave 8c — probe/measure/inventory to TS (5 modules) ([d69f6f6](https://github.com/event4u-app/agent-config/commit/d69f6f6c30631f89ca4de61eeccc9404b6c332c2))
* **py2ts:** phase 8 wave 8c — audit/inventory analysis to TS (4 modules) ([8e1bc2c](https://github.com/event4u-app/agent-config/commit/8e1bc2c00c70aded7f38d9b41e052bd037f49a6c))
* **py2ts:** phase 8 wave 8b — physical-move + build writers to TS (7 modules) ([7b253c8](https://github.com/event4u-app/agent-config/commit/7b253c88656ea9785b4845ff1e2e4de732cacf11))
* **py2ts:** phase 8 wave 8b — render/ci/audit reporters to TS (6 modules) ([f013def](https://github.com/event4u-app/agent-config/commit/f013defd133602c96a58c3e921c651ffc4b1de70))
* **py2ts:** phase 8 wave 8b — skill-tooling + readme readers to TS (6 modules) ([ed27a0b](https://github.com/event4u-app/agent-config/commit/ed27a0bb770ee5aa47cf42824e3eac41dad3b30d))
* **py2ts:** phase 8 wave 8a — generate/measure/audit/adoption reporting (17 modules) (#486) ([111d4dc](https://github.com/event4u-app/agent-config/commit/111d4dc2fdd3781e022effc28e5ccdf270719dc7))
* **py2ts:** phase 7 — dev-side memory + telemetry (8 modules) (#484) ([426096d](https://github.com/event4u-app/agent-config/commit/426096df3301b1546c68062db807ceb8534516ce))
* **py2ts:** phase 6 — hooks cluster (16 modules + dispatcher wiring) (#483) ([0c24f2c](https://github.com/event4u-app/agent-config/commit/0c24f2ca34fbeeaa11e26d48cd67e3677f8588a9))
* **py2ts:** phase 5 — condense/sync content pipeline (9 modules) (#482) ([6de56ce](https://github.com/event4u-app/agent-config/commit/6de56ce2c24cb284f44e57d34897e99e8221f7c4))
* **py2ts:** phase 4 wave 4c — port remaining 41 check_*/validate_* (linter cluster complete) (#481) ([cdb6e3b](https://github.com/event4u-app/agent-config/commit/cdb6e3b6b5828dda4c5d4a7e733b98b024ab4ff3))
* **py2ts:** phase 4 wave 4b — port all 58 lint_* linters (#480) ([66d5f25](https://github.com/event4u-app/agent-config/commit/66d5f25b61ce1c06864a9b94fa05276af7090d7f))
* **py2ts:** port linter wave 4a — 11 CI-critical gates to TypeScript ([1d70cf7](https://github.com/event4u-app/agent-config/commit/1d70cf73eb73e463e095393030ffbf04fe969961))
* **py2ts:** port _lib wave 2 — remaining 18 modules to TypeScript ([814d36c](https://github.com/event4u-app/agent-config/commit/814d36cefbe91a8e715ef10f3152d860df5a93b6))
* **py2ts:** port _lib wave 1 — 12 leaf modules to TypeScript ([316235a](https://github.com/event4u-app/agent-config/commit/316235a0e3bc4d726c5ab901b10f86f60f89939a))
* **parity:** golden-replay, coverage-diff and divergence-aware parity harness ([23f4c3e](https://github.com/event4u-app/agent-config/commit/23f4c3ec78b114f973d22dc2ee8e54ac5a59f3c7))
* **scripts:** migration dispatch wrapper run.ts ([06dd357](https://github.com/event4u-app/agent-config/commit/06dd357233657145d6146bc073785cf19e887ca1))

### Bug Fixes

* **release:** stop task release auto-aborting at the [y/N] confirm ([548803a](https://github.com/event4u-app/agent-config/commit/548803ac89108d68438aebb420b2bdaedd6a85ab))
* **roadmaps:** ref-ignore the quoted historical .py path in archival-robustness roadmap ([1e206e9](https://github.com/event4u-app/agent-config/commit/1e206e9036a3d9947ffc17f2943d3585cdc0fff1))
* **rules:** harden no-invented-facts — git/PR live-state must be verified, never claimed from memory ([23b3f3c](https://github.com/event4u-app/agent-config/commit/23b3f3c71e0533928c8e7d150a7d98b7b191f3ea))
* **ai-council:** wire synchronous curl transport for the enabled council members ([b770a67](https://github.com/event4u-app/agent-config/commit/b770a67c6ed5562aa4a969aaa9bca3346e03e8a7))
* **py2ts:** realpath-resolve argv[1] in install CLI entry guard ([e9074ec](https://github.com/event4u-app/agent-config/commit/e9074ece8130023034b95a61a0b3cb1ff38cabda))
* **py2ts:** spawn the v0→v1 migrator via tsx instead of a static import ([8f41615](https://github.com/event4u-app/agent-config/commit/8f41615819e75cbd14b6f718ec4f777139d61e73))
* **py2ts:** green the 4 CI-only Node-Tests vitest failures ([3e8ce08](https://github.com/event4u-app/agent-config/commit/3e8ce08e645e67fc2263e08ab84d6ff9e42ab317))
* **py2ts:** rewire install orchestrator bridges stage python→tsx ([6d4be48](https://github.com/event4u-app/agent-config/commit/6d4be48995db79dfff150db540f3996d5606955f))
* **py2ts:** refresh stale condensation hashes for commands/{fix,roadmap}/* ([d3653fa](https://github.com/event4u-app/agent-config/commit/d3653fa6d598b4ba805ac5fdb987ba40cd98ea77))
* **py2ts:** config_packs golden-parity stays live python↔tsx — env-brittle manifest, not snapshot-freezable ([e7ef035](https://github.com/event4u-app/agent-config/commit/e7ef035aa64a83a5d7bca7b3aa14eee0546f3caf))
* **py2ts:** portable module-kind snapshot key — basename PYTHONPATH not checkout-relative ([3785235](https://github.com/event4u-app/agent-config/commit/378523508a12d5b0b5fa59a7ee6223e2e74b224f))
* **py2ts:** knowledge_ingest test — normalize host-variable mime (CI .md→text/markdown) ([df65115](https://github.com/event4u-app/agent-config/commit/df651155b3b06fecdf03ebd814cea77d9df38d38))
* **cli:** make eval:record reachable via the native dispatch allowlist ([d45e6f2](https://github.com/event4u-app/agent-config/commit/d45e6f234ca9832bfeb54e6e2641fbafd697a1f3))
* **evals:** repair live trigger-eval runner after the src/ move ([dbc0e10](https://github.com/event4u-app/agent-config/commit/dbc0e10d7fef2dbade789705da158f70d82e66be))
* **council:** point config-location guidance at .ai-council.yml, not .agent-settings.yml ([b74b712](https://github.com/event4u-app/agent-config/commit/b74b71297345c197e62257a64d634a0745236185))
* **skills:** keep a minimal ordered loop in analysis-autonomous-mode (skill-lint) ([6915c70](https://github.com/event4u-app/agent-config/commit/6915c70991e9bda3645b6a4272437eb3153c8bce))
* **ai-image:** add ai-image to the discovery-manifest pack-id enum ([7a5eddc](https://github.com/event4u-app/agent-config/commit/7a5eddcedf9d4d89664abe57ad062e15cbabd20b))
* **golden:** seed render evidence in GT-U6A/U6B apply-dispatch goldens ([dd8b642](https://github.com/event4u-app/agent-config/commit/dd8b642ca96eb8fa1ecc276dc7f3fc170caa4f88))
* **docs:** render command refs colon-canonical everywhere (F5) ([3ee7169](https://github.com/event4u-app/agent-config/commit/3ee716964e0abdadc008073ffe47e6cb2333358f))
* **ci:** anchor structural-break annotation + override to trailer lines ([6ac3080](https://github.com/event4u-app/agent-config/commit/6ac30806efe56d8a70d980af9ad1c64836044cd8))
* **tickets:** recondense materialize.md hash (sync-check-hashes) ([9209a95](https://github.com/event4u-app/agent-config/commit/9209a957dc1f649989b4843deafbf3cc54007250))
* **plugin:** register roadmap-materialize command-skill in marketplace ([edda365](https://github.com/event4u-app/agent-config/commit/edda3655293b23ea63e8a601334d27e3ec7c1d13))
* **discovery:** quarantine tickets.md template (frontmatter-less scaffold) ([0dc7e96](https://github.com/event4u-app/agent-config/commit/0dc7e9681ca305d1e3ef0e669cebaa0bef400c88))
* **knowledge:** mirror global_sharing into the GUI settings Zod schema (parity gate) ([b748467](https://github.com/event4u-app/agent-config/commit/b7484675c55f94d907944818844e2350c30888ee))
* **git:** harden against acting/asking on stale remote git state ([c9a479f](https://github.com/event4u-app/agent-config/commit/c9a479fdcbf5ac4f35d1938ecece375cf13136c5))
* **py2ts:** #569 CI — AGENTS.md cap, regen catalog/manifests, pin jsonschema ([e25ea5a](https://github.com/event4u-app/agent-config/commit/e25ea5a082f86953848c77aa63e74f4e1a15a18b))
* **ci:** regenerate engineering-base pack manifest (stale) ([c1ab22c](https://github.com/event4u-app/agent-config/commit/c1ab22c1c5fad1d3a5cd6f046b2a200cb39373df))
* **ci:** recondense commands/threat-model.md (stale hash) ([0e56b74](https://github.com/event4u-app/agent-config/commit/0e56b7425486c1752a0318a30cc5c7de6e9d05c1))
* **ci:** AGENTS.md under cap + ignore docs/ link in security-sensitive-stop ([70df2f4](https://github.com/event4u-app/agent-config/commit/70df2f4bc0c881fcc6f8accf0eab4fb6e88c7d6f))
* **mission:** add required workspaces key to /mission:upgrade frontmatter ([1146c07](https://github.com/event4u-app/agent-config/commit/1146c07328b7cdda16150203b07f8ae562a1735e))
* **condense:** recondense 6 stale-hash files (unblock main after #561) ([3d058eb](https://github.com/event4u-app/agent-config/commit/3d058eb7de20990a40275670b0a46dce32fc1051))
* **py2ts:** sync #5 — re-port 2 memory twins + renumber migration ADR 096→200 ([d92b3c5](https://github.com/event4u-app/agent-config/commit/d92b3c51544bbf9865f949f9d61b5a6af3c51129))
* **analysis-workbench:** orchestrator visibility advanced + regen pack README ([28f4fad](https://github.com/event4u-app/agent-config/commit/28f4fad877bf85091bcc59cb73dac5f43dceaa6c))
* **analysis-workbench:** command-as-skill projections + marketplace + incident desc ([29852b9](https://github.com/event4u-app/agent-config/commit/29852b93cda1fc1e21631db89dcab01b40a4fdd1))
* **flows:** exclude cookbook.yaml from the flow-schema linter ([216ce79](https://github.com/event4u-app/agent-config/commit/216ce795e83e5b916ed6e0edeeebbf8d62b1b0f2))
* **bench:** run clones OUTSIDE the repo — vanilla was contaminated by project scope ([9940471](https://github.com/event4u-app/agent-config/commit/9940471b11003fe4460688b7e52c89bc2d986860))
* **py2ts:** adapt 20 twins to synced main + renumber migration ADR 094→096 ([f7334e9](https://github.com/event4u-app/agent-config/commit/f7334e9476e73f01ffe34ec2909d25d60b7e692e))
* **bench:** exclude plugin runtime artifacts from the discipline diff ([a46ace9](https://github.com/event4u-app/agent-config/commit/a46ace910b20c5dae67ac43d652111ee0ed3347c))
* **py2ts:** post-sync — regen router.json + allow .agent-settings.yml in bench integrity ([45e992c](https://github.com/event4u-app/agent-config/commit/45e992c959d71d6c4fc8cda53aab35ad9f47562c))
* **py2ts:** re-port 3 bench twins to match main's with-rdp arm ([7ff58c6](https://github.com/event4u-app/agent-config/commit/7ff58c6e2a5852932230390663f3bda8b9465b9b))
* **py2ts:** pack_mcp_content gzip parity = header+FNAME + decompressed content ([1404e66](https://github.com/event4u-app/agent-config/commit/1404e6695d495c2d736048e7aa538fb5b5767b69))
* **py2ts:** node-22 CI fixes for the mcp_* twins ([4853031](https://github.com/event4u-app/agent-config/commit/485303139b40b1647b8ec5aaa95c33333a6cd3a0))
* **refs:** mark intentional .harvest-local provenance ref as ref-ignore ([7ebf424](https://github.com/event4u-app/agent-config/commit/7ebf42400c79b5e2fbf26d98de8b814f51e76bad))
* **py2ts:** resolve two main-merge-surfaced parity-gate failures (AI-council) ([fb83a05](https://github.com/event4u-app/agent-config/commit/fb83a05f0e14fa2e0ac522a7e94f30dca4b49404))
* **py2ts:** keep check_no_external_sources self-clean under its own guard ([28a5f00](https://github.com/event4u-app/agent-config/commit/28a5f00ca960aabe819c6e46f590a60e512fadaf))
* **py2ts:** mirror main's source-confidentiality scrub into .ts twins ([46e13c9](https://github.com/event4u-app/agent-config/commit/46e13c944813245d7ff46f9c98cbeba80013b790))
* **py2ts:** recompute condensation hashes for the merged source state ([08a581b](https://github.com/event4u-app/agent-config/commit/08a581b542a2ed461a13eaca831bef1ef48189a0))
* **py2ts:** mirror main's ADR-092 visibility + reaping changes into ported twins ([f8ba8a3](https://github.com/event4u-app/agent-config/commit/f8ba8a33b1d3805037cfaa5c3408b77762a2a8b4))
* **py2ts:** drop legacy-path literal from migrate_frontmatter_defaults.ts comment ([fc9f8ff](https://github.com/event4u-app/agent-config/commit/fc9f8ff5b69d364c00132b23aace28c908a1e238))
* **py2ts:** mirror update_counts.py TARGETS change into the TS twin ([a84a369](https://github.com/event4u-app/agent-config/commit/a84a36926d857562f7f9140610a6ca6cee91b1b6))
* **py2ts:** inventory_abstraction_budget golden parity — skip dominant_value on non-majority rows ([aad4d88](https://github.com/event4u-app/agent-config/commit/aad4d8808ff8952e8e0b8c3612ea0ff7e3af8f8a))
* **py2ts:** commit the _global_state_lock test helper (wave 8c) ([772a89a](https://github.com/event4u-app/agent-config/commit/772a89aa890bafef51dfc96706a98bb16089a474))
* **py2ts:** port project_thin_rules to TS; audit_initial_context imports it ([2fe6cd8](https://github.com/event4u-app/agent-config/commit/2fe6cd89e1f4ca5f7f939796dfe987dfdb2caac6))
* **adr:** renumber migration ADR 088 -> 089 (parallel-merge collision) ([bea6119](https://github.com/event4u-app/agent-config/commit/bea61196d141ebd0e45939fa453001c67fd923b2))
* **ci:** faithful-twin guard matches the bare legacy dir name ([cac1701](https://github.com/event4u-app/agent-config/commit/cac17015ea9d635fb4325b7de2015830c1760c04))
* **ci:** node setup for TS-resolved linters + drop brittle --help parity ([5d9b238](https://github.com/event4u-app/agent-config/commit/5d9b238e3f9364a523bb72f4fa4cec8b2f8a26dd))
* **ci:** exempt faithful TS twins from the ADR-051 legacy-path guard ([b894215](https://github.com/event4u-app/agent-config/commit/b8942150e56324ea40a5da5295a2b263a3e5df9f))
* **py2ts:** manifest test asserts invariants, not the day-one snapshot ([f44b5ee](https://github.com/event4u-app/agent-config/commit/f44b5ee41ccb3e5b3b67f53a6c8c3f6de5068643))
* **ci:** legacy-path guard checks the PR's net diff, not per-commit patches ([a9a0e72](https://github.com/event4u-app/agent-config/commit/a9a0e72eb763bc399d31d0d8c92f07f3d567fbe0))
* **py2ts:** migrate legacy .agent-src.uncondensed args on swept lines ([d6eec9a](https://github.com/event4u-app/agent-config/commit/d6eec9a3b6ff0d72ae944dd9c4fdcc7f694db066))

### Documentation

* **roadmaps:** add token-saving + archival-robustness roadmaps; regen dashboard ([6a2948d](https://github.com/event4u-app/agent-config/commit/6a2948d10a78dfc7117a55fd0dbed8919b426310))
* **py2ts:** refine teardown-completion roadmap from AI-council deep review ([be0508f](https://github.com/event4u-app/agent-config/commit/be0508f120629dfcf0b0702c8338dfea3d3179c0))
* **py2ts:** new roadmap — teardown completion (all remaining open work) ([fb57c02](https://github.com/event4u-app/agent-config/commit/fb57c0268c0867571c6a784b1cb655cf35a0643e))
* **py2ts:** plan golden-transcript TS re-platform (teardown Phase-5 fork) ([1f79339](https://github.com/event4u-app/agent-config/commit/1f793392517a0c16babc867d82dc46eb649b8455))
* **py2ts:** record R7 resolution + harness-conversion completion + remaining-21 triage ([435bc34](https://github.com/event4u-app/agent-config/commit/435bc346c07302c185307f4e128d08dd21a7d73c))
* **py2ts:** agent handoff for Phase 4.5 bulk-execution session ([0570ca2](https://github.com/event4u-app/agent-config/commit/0570ca2f37b527d192add6f610ebd082ea2e0b1a))
* **py2ts:** Phase 4.5 pre-capture classification — 423 rigs sized ([7bca87c](https://github.com/event4u-app/agent-config/commit/7bca87c1a4902865be0a29685b4cf5e0c469fca2))
* **py2ts:** R6 test-teardown strategy resolved (council) — hybrid A(snapshot)+C(intent) ([f8b21aa](https://github.com/event4u-app/agent-config/commit/f8b21aad0200bed3a7a153cba47677365d940ab9))
* **py2ts:** CRITICAL R6 — 88% of .ts tests are .py-dependent parity rigs + golden-harness verdict (B) ([bd37833](https://github.com/event4u-app/agent-config/commit/bd37833692c4e07f9a8ff43f80b33933d5448f80))
* **py2ts:** Phase-5 coverage-equivalence audit — 125 modules, ~25 real gaps ([858371e](https://github.com/event4u-app/agent-config/commit/858371ec592ed8ab2f56778b6461cc194dc95c4a))
* **py2ts:** Phase 12 teardown roadmap — plan of record ([bb09fca](https://github.com/event4u-app/agent-config/commit/bb09fca48da842c6e93b2ef1fe16b3bfec2578d8))
* **rdp-eval:** close roadmap (L12 keep / L7 tier-2 / L6 deferred) + spawn frontier-polish follow-up ([155bf53](https://github.com/event4u-app/agent-config/commit/155bf5305fb6387012dd3240756b663a86de420b))
* **rdp-eval:** score quality layer + record L12-keep / L6-unsettled verdict ([f7ef714](https://github.com/event4u-app/agent-config/commit/f7ef71460f5d298dadb3a6fab8b41a87fd4a63d6))
* **roadmap:** mark all install-contract-stability steps complete ([b03d907](https://github.com/event4u-app/agent-config/commit/b03d907b79914c69ef3648cf9ab7cc88740dcc45))
* **adr:** ADR-061 §8/§9 supersession amendment ([69b797c](https://github.com/event4u-app/agent-config/commit/69b797c8a86079ac61cdadf5a82e79fcd8a48a78))
* **roadmap:** add install-contract-stability roadmap (feedback-v2 D2) ([5ff74d7](https://github.com/event4u-app/agent-config/commit/5ff74d70dcd7161748fd78d528a476cc87498cd0))
* **provider-lifecycle:** trigger on scripts/ai-image/adapters/ ([2d0bf77](https://github.com/event4u-app/agent-config/commit/2d0bf77e7052642556c2d6ab82fa18cea881c06d))
* **media:** repoint adapter-substrate references after the media/ extraction ([b4d4446](https://github.com/event4u-app/agent-config/commit/b4d4446aabaf2587ce159482c3531f8b7c46a16c))
* **roadmap:** document the later/ disposition across the lifecycle surfaces ([65570ea](https://github.com/event4u-app/agent-config/commit/65570ea19f6857dfb813df0aa1e6e4e5cd9fcef5))
* **roadmap:** Evidence v2 — archive completed base, spawn accumulation follow-up ([09b43be](https://github.com/event4u-app/agent-config/commit/09b43be987d1d9df7c64e36cabd48a8211a64600))
* **roadmap:** add road-to-contract-integrity (Phase 0+1 done) ([65b7e5c](https://github.com/event4u-app/agent-config/commit/65b7e5c660dd7f2f026d8c4262c0e8ea5a6fd8d7))
* canonicalize command naming + sharpen README headline (F5) ([1e6951a](https://github.com/event4u-app/agent-config/commit/1e6951a5454442bb1eff6d5b9684611a56572bcb))
* provisional skill-family census (road-to-contract-integrity F2) ([8aa500e](https://github.com/event4u-app/agent-config/commit/8aa500e68212387ae2856637d61d6d0c7cdc4ea5))
* **roadmap:** complete + archive road-to-ticket-bundles ([83a4de1](https://github.com/event4u-app/agent-config/commit/83a4de1854950286c09016ba8ab5756849921cfa))
* **roadmap:** cancel API-export phase; bundle reflects paste/MCP ([ece6681](https://github.com/event4u-app/agent-config/commit/ece668124f46249ab528158cf6065a85c3e9b742))
* **capability-discoverability:** clarify harvest is automated-but-gated + add scope line ([00afd75](https://github.com/event4u-app/agent-config/commit/00afd753deb3f85d66eaa5afaf3cf9cd1acae234))
* **roadmap:** mark Phase 4 + lint-wiring + kill-switch + generator-mapping done ([48253bb](https://github.com/event4u-app/agent-config/commit/48253bb05c4ac1795d016ac06273354b3aa14c6e))
* **tickets:** document per-ticket + per-bundle kill-switch/rollback (Phase 6) ([b0d44e6](https://github.com/event4u-app/agent-config/commit/b0d44e6227c03e602642d533b782f140ba288668))
* **roadmap:** road-to-ticket-bundles plan + progress dashboard ([796c8e2](https://github.com/event4u-app/agent-config/commit/796c8e2f4ad5cb84e65a1fbcb6864c5ebdeb0fe8))
* **adr:** ADR-100 global knowledge-card sharing; ADR-098 Decision-10 superseded ([d40fd77](https://github.com/event4u-app/agent-config/commit/d40fd7734c0f76b9a7704c2eb07294fdc1780544))
* **knowledge:** evidence-discipline global layer, source-discovery §E, card tier, README (ADR-100) ([b6ba3d5](https://github.com/event4u-app/agent-config/commit/b6ba3d5dde62cb041c9b751a07eeaa80a7f9a6fc))
* **roadmap:** add road-to-structure-grounding-v2 (global card sharing) ([c73dae0](https://github.com/event4u-app/agent-config/commit/c73dae03d9e1d4eb2bb92912b41794c39e974d96))
* **verify-loop:** Phase 1 gate — runtime-free PoC + architecture decision ([34153b3](https://github.com/event4u-app/agent-config/commit/34153b3f855c7741e8ad59c58314ddda712db89c))
* **adr:** ADR-097 evidence-first structure discovery ([ebd7e3e](https://github.com/event4u-app/agent-config/commit/ebd7e3ee3bedd50cbdbed53c2a80e6c68a9907cb))
* **mission:** Phase 1 gate + complete/archive mission-mode + spawn catalogue follow-up ([380af60](https://github.com/event4u-app/agent-config/commit/380af60eae450a659935a4551bd519c7fa3b232d))
* **roadmaps:** add evidence-first structure discovery roadmap ([88550d6](https://github.com/event4u-app/agent-config/commit/88550d6f2f6d95ac3cc1461f621ac22004b84258))
* **security:** threat model + disclosure policy (security-hardening P1) ([8d3cae1](https://github.com/event4u-app/agent-config/commit/8d3cae154ab77e0be8b14713677e6f3668269f94))
* **roadmaps:** stamp merge-gate with PR #558 ([24c56d0](https://github.com/event4u-app/agent-config/commit/24c56d0d7d7b0a4a7beffcd326d35de5991a8a2d))
* **roadmaps:** close analysis-workbench acceptance criteria ([ae05b49](https://github.com/event4u-app/agent-config/commit/ae05b49775965f1b3490b359ddbc9c002e9b8abb))
* **analysis-workbench:** Phase 0 — memory-loop contract + ADR-096 ([72eeaae](https://github.com/event4u-app/agent-config/commit/72eeaaea19392623bcbd37d86d219976d0fae48b))
* **roadmaps:** analysis-workbench RCA/post-mortem roadmap (council-locked) ([79785f5](https://github.com/event4u-app/agent-config/commit/79785f5b46674f2585fd3e955d952de27d655374))
* **roadmaps:** add competitive-harvest orchestration roadmap ([39f0646](https://github.com/event4u-app/agent-config/commit/39f0646766bc37e78a8c3216f0d61f1feb8d26c7))
* **roadmaps:** ECC competitive-harvest roadmap set (source-anonymized) ([bc8a602](https://github.com/event4u-app/agent-config/commit/bc8a602465de6a05441e9bff8363160337d5603e))
* **roadmap:** close competitive-borrow Phase 1 + record execution council ([38f88ed](https://github.com/event4u-app/agent-config/commit/38f88edc3b7ed30e0bdd18cf82c49d1b5a45444b))
* **readme:** surface three differentiators + role-tagline catalog (competitive-borrow P1.0) ([588966d](https://github.com/event4u-app/agent-config/commit/588966d77c5e8721da5fa215ca09037617f18925))
* **bench:** roadmap — scale clean discipline-lift to significance ([8b2e77a](https://github.com/event4u-app/agent-config/commit/8b2e77a88e236c0da51c908a0310fbe3f14bf206))
* **bench:** v4 agentic result — robust null; apparent weak-host flip was noise ([c313c97](https://github.com/event4u-app/agent-config/commit/c313c979fe5e3c3d5b6d8d1b6423a180e7d989db))
* **bench:** v4 agentic-headroom roadmap — council SPLIT, cheap go/no-go decides ([5735f46](https://github.com/event4u-app/agent-config/commit/5735f46649ffce9b0d3ccaf21a16bbaf3abe4455))
* **bench:** v3 baseline 89% — escalate (capable models near-ceiling on deterministic tasks) ([39cbf55](https://github.com/event4u-app/agent-config/commit/39cbf559d70e1f2cf46d9da547517300b16516a4))
* **roadmap:** flip phase 4 steps 3+4 (skill_linter + heavy gates); refresh dashboards ([e82d9e8](https://github.com/event4u-app/agent-config/commit/e82d9e872d7ff6435bf0c8e037bb8411565bf5ef))
* **roadmap:** flip phase 2 steps done; refresh migration dashboard ([1d0972d](https://github.com/event4u-app/agent-config/commit/1d0972dfc40e62691c4a375eca2102cd02ddb08c))
* **roadmap:** mandate the phase-entry main sync ritual ([cf77dee](https://github.com/event4u-app/agent-config/commit/cf77dee17495cb978e09e52bcace1425d85d9b6d))
* **roadmap:** flip phase 1 steps 5 + 10, refresh dashboards ([1eea20e](https://github.com/event4u-app/agent-config/commit/1eea20ec6aa9cbc8291f410625827040b93ea09a))
* **py2ts:** sweep maintainer-executed script references to the dispatcher ([23e0898](https://github.com/event4u-app/agent-config/commit/23e0898f935a1553d634d879bb7aea7e5d6c0438))
* **roadmap:** flip phase 1 infrastructure steps to done ([fec0da7](https://github.com/event4u-app/agent-config/commit/fec0da72831da7842b8bcd7a3e43c68b1bb759e6))
* **migration:** consumption-model + node-floor verdicts, migration dashboard ([f3c32ff](https://github.com/event4u-app/agent-config/commit/f3c32ff4a08c3960eed11b329bec41149d3922c2))
* **adr:** record python-to-typescript migration architecture (ADR-088) ([0670cfd](https://github.com/event4u-app/agent-config/commit/0670cfdec6d625f13b0f24dd72394782543fc2d3))
* **roadmap:** add TypeScript-only scripts migration roadmap ([cd9b73f](https://github.com/event4u-app/agent-config/commit/cd9b73f7f304b31eb1a7cce38f0a5fd1d00583f4))

### Refactoring

* **py2ts:** remove Python source + test suite, complete TS MCP serving ([09b5544](https://github.com/event4u-app/agent-config/commit/09b554419dccc6dd7d7a9f7e38d075c0d3f9d106))
* **skills:** constraint-light remediation of rote step-lists (RDP Phase 3.1 sample) ([7cb9fc2](https://github.com/event4u-app/agent-config/commit/7cb9fc2fa447ec82e8568643c6bf32165e2bc42e))
* **media:** extract shared adapter substrate to scripts/media/lib/ ([d2fe0bd](https://github.com/event4u-app/agent-config/commit/d2fe0bd5dd88ab6e4192c982d40485c6dfd9927e))

### Tests

* **release:** lock the confirm-gate — extract testable confirmGate + CI guard ([f17cda9](https://github.com/event4u-app/agent-config/commit/f17cda9e3e66cf5acec21679153e9e51a29d071c))
* **py2ts:** convert generate_pack_manifests rig → python-free _py_safe_dump intent suite ([a0ede22](https://github.com/event4u-app/agent-config/commit/a0ede22a323533bdb134b13c46bda2fa2173e4a2))
* **py2ts:** stop tsx cache leaking into the install target (macOS dry-run) ([75884bc](https://github.com/event4u-app/agent-config/commit/75884bc33f39d56edcad102523cf803feb09454a))
* **py2ts:** enforce python-free test env so obsolete live-parity self-skips ([c0425e3](https://github.com/event4u-app/agent-config/commit/c0425e3bd44cac884b91d26136e570068400b2d1))
* **py2ts:** gap coverage batch 2 — work_engine + install_snapshot (10 modules) ([363d866](https://github.com/event4u-app/agent-config/commit/363d866c8c1c545c88e6d4821260cda2c2f6f091))
* **py2ts:** gap coverage batch 1 — ai_council/hooks/contracts/cli/install (13 modules) ([6e58455](https://github.com/event4u-app/agent-config/commit/6e584556b4c24fe4b297d3f2327acbfe799338ae))
* **py2ts:** convert 19 golden-parity rigs to the snapshot oracle ([256aeea](https://github.com/event4u-app/agent-config/commit/256aeead682484138e872fa80ad6716a3b0c5925))
* **py2ts:** oracle v3 — file side-effect capture + scratch-path key stabilisation ([91c671d](https://github.com/event4u-app/agent-config/commit/91c671d5330a68db498b2530ee5074a893a176b4))
* **py2ts:** Phase 4.5 harness conversion checkpoint — 10/19 green, blocked on R7 ([7fead34](https://github.com/event4u-app/agent-config/commit/7fead3453a5d3c7669051560b1a33586bbe2e286))
* **py2ts:** Phase 4.5 oracle v2 — script/inline/module invocation descriptor (validated) ([b4ddba2](https://github.com/event4u-app/agent-config/commit/b4ddba2b244af63549976912825994201665c5ab))
* **py2ts:** Phase 4.5 prototype — parity snapshot-oracle (validated, regression-proof) ([a605d73](https://github.com/event4u-app/agent-config/commit/a605d73c7331f7459744f2bcef099db067e8b4e9))
* **rdp-eval:** capture + score L6 orchestrator-isolation run ([8498072](https://github.com/event4u-app/agent-config/commit/8498072e0a020f9ff5e2cc8b71b761891a755821))
* **rdp-eval:** add L6 orchestrator-isolation mode to eval runner ([af6608a](https://github.com/event4u-app/agent-config/commit/af6608a0259207de68326e0e33239e259cb6a2ac))
* **rdp-eval:** capture baseline+treatment golden transcripts (12 slots) ([d2bab19](https://github.com/event4u-app/agent-config/commit/d2bab191d409f75b73d46d6931be7e024549870a))
* **rdp-eval:** add quality-layer eval runner + 12-prompt corpus ([2012dd4](https://github.com/event4u-app/agent-config/commit/2012dd4d841ae6d8cb7644224e0775129116518f))
* **install:** conformance, migration, surface-tier, and boundary-guard tests ([18d0f67](https://github.com/event4u-app/agent-config/commit/18d0f672eeec13d2a4a543dbce852e3681a0b342))
* **evidence-v2:** cost arm + fair-control + Class-A/B eval fixtures ([ba17dc6](https://github.com/event4u-app/agent-config/commit/ba17dc6bab30b5f32b8667d4a1bdaacc12d13d01))
* **evals:** structure-grounding anti-hallucination eval ([ca6f4d0](https://github.com/event4u-app/agent-config/commit/ca6f4d0b4de91d4e4e4bd3bdc5aaf557241a9118))
* **py2ts:** shadcn no-components — assert exit + usage token, not print_help prose ([9ed280a](https://github.com/event4u-app/agent-config/commit/9ed280a89253355cd57eb14f45ed588d897a9c91))
* **py2ts:** airgap --help — assert exit 0 + usage line, not byte-identical prose ([cb72d44](https://github.com/event4u-app/agent-config/commit/cb72d443061a3c4268a328d501c5a551fc2741d9))
* **py2ts:** golden-parity suites for the mcp_* top-level twins ([6550b23](https://github.com/event4u-app/agent-config/commit/6550b239501d165bddd3f6dfc2b0380e163046e9))
* **spikes:** yaml round-trip spike — ruamel risk is moot ([5c51ba3](https://github.com/event4u-app/agent-config/commit/5c51ba310934ff46ff6b8fe19f61e5feecf5e08d))

### Build

* **ci:** wire conflict-marker guard into ci, consistency, and pre-push ([dabaac1](https://github.com/event4u-app/agent-config/commit/dabaac1d0f15bdfbf2fb06cf6f7fa19bf93e8e1e))
* **ci:** wire competitive-borrow P1 generators + originality gate into CI ([42889ed](https://github.com/event4u-app/agent-config/commit/42889ed840676aed8c74432d61b6b282fd19e9b4))
* **py2ts:** switch executable call sites to the migration dispatcher ([782e3cb](https://github.com/event4u-app/agent-config/commit/782e3cba1143e0be20abdc1fa95c7049c2bda7ae))

### CI

* **py2ts:** npm ci in install-test jobs so the TS installer resolves tsx ([9a43deb](https://github.com/event4u-app/agent-config/commit/9a43deb16ba8a59243a67a2b2d77aa0c258f719b))
* **py2ts:** Phase 2 — rewire consistency.yml conflict-marker check to dispatcher ([2fc835f](https://github.com/event4u-app/agent-config/commit/2fc835fe3c440134a0ba5dacde9daed7f7eca5d0))
* **tickets:** wire task lint-tickets into the lint cadence (Phase 3) ([e4c578e](https://github.com/event4u-app/agent-config/commit/e4c578e4c3623f5f470245f33230157759a82238))
* **py2ts:** give tests.yml python-tests node + npm ci for scripts-run tsx targets ([bd0a0e2](https://github.com/event4u-app/agent-config/commit/bd0a0e22b45966575fdc7e2b3a6c404415de8245))
* **py2ts:** bump migration gate to node 22 for node:sqlite telemetry parity ([3356299](https://github.com/event4u-app/agent-config/commit/3356299551f7eff8d60d0ff234ad6cefab59cb32))
* **migration:** make sharded suite shard-safe (prepare step + self-provisioning fixture) ([d12e0b7](https://github.com/event4u-app/agent-config/commit/d12e0b79d1c2c18336971da0f52f9ad0afe7ce53))
* **migration:** shard migration test suite across 4 runners ([e239cfe](https://github.com/event4u-app/agent-config/commit/e239cfe0c0678c5ea12fcd048cc174f2708935a6))
* **py2ts:** add Node setup to bench-drift workflow ([8fd3020](https://github.com/event4u-app/agent-config/commit/8fd3020538898202a94e21ce152dcde848348e3a))
* **py2ts:** add Node setup to cloud-release + migration-dry-run workflows ([d971bf6](https://github.com/event4u-app/agent-config/commit/d971bf6889520b43f79fcabe91552555371c41c4))
* **py2ts:** retry npm ci to absorb transient registry ECONNRESET ([3dcf74d](https://github.com/event4u-app/agent-config/commit/3dcf74d79465160d4eb5e1ec0e6a49eb5cc2ca04))
* **py2ts:** migration phase-gate workflow + phase manifest ([1c2d432](https://github.com/event4u-app/agent-config/commit/1c2d4324e6a2d239a63921347d7430965a10bd15))
* **py2ts:** base-guard, main-sync and drift workflows for the python2ts branch ([194aa73](https://github.com/event4u-app/agent-config/commit/194aa73a35e68dbf2574362e5f58a15b3fc0e78a))

### Chores

* **py2ts:** R6/R7 cleanup Phase A — strip obsolete raw live-parity blocks (170 files) ([bcf904d](https://github.com/event4u-app/agent-config/commit/bcf904ddeb33a9f720dd3e5e9688922e25b71977))
* **py2ts:** reconcile teardown roadmap Phase 6 to verified reality ([2e8f824](https://github.com/event4u-app/agent-config/commit/2e8f82481cf2e881af2098911128449c58258685))
* **py2ts:** teardown prep — prune orphan snapshots + runtime_handler node fixture + completion plan ([a696a4e](https://github.com/event4u-app/agent-config/commit/a696a4e59070b86f0a5b15cde4fcb06c412b17c2))
* **py2ts:** regenerate dist + projections + hashes after workspace/release port ([a05ac98](https://github.com/event4u-app/agent-config/commit/a05ac989c7a07785a7bd62b335b8d5cdd6f72f9a))
* **py2ts:** regenerate dist + hashes after Phase 11 _cli port ([6d4489f](https://github.com/event4u-app/agent-config/commit/6d4489fbd81b44398435200feae17a0073bc92cc))
* **py2ts:** regenerate dist + projections + catalog + hashes after sync #7 ([7c8ee87](https://github.com/event4u-app/agent-config/commit/7c8ee87f834dfa00aa24580f3ba1b64a664e756b))
* **py2ts:** merge main #7 — resolve conflicts, regen derived, drop deleted knowledge_card_usage twin ([83cc62d](https://github.com/event4u-app/agent-config/commit/83cc62de6315e0c5a25b4069a46e90021c3179b3))
* **roadmaps:** park road-to-mission-catalogue in later/ (blocked-on-external-trigger) ([ae66c70](https://github.com/event4u-app/agent-config/commit/ae66c70d4d27e8e3887db902859aadae931ad870))
* regenerate index + catalog ([2a7570f](https://github.com/event4u-app/agent-config/commit/2a7570f11f5729ec070e6425133676b985e80e0e))
* regenerate router.json ([5b6e896](https://github.com/event4u-app/agent-config/commit/5b6e896df069b53a003832a621366a757c4e1c04))
* **brand:** project /brand: command-as-skills + marketplace entries ([ed4f366](https://github.com/event4u-app/agent-config/commit/ed4f366d91550cd5ab8cf6bf5253df26cc77db1c))
* **roadmap:** close out + archive road-to-image-brand-followups ([8cd77ac](https://github.com/event4u-app/agent-config/commit/8cd77ac5845a30e253034ddc4382708118f114e2))
* **roadmap:** record /imagegen: namespace decision (council) for followups Phase 3 ([1496ef3](https://github.com/event4u-app/agent-config/commit/1496ef3398b28c3c0c3afb185d9b5af20ef3ee81))
* **roadmap:** mark image-brand-followups Phase 2 done (eval backfill + gate) ([5ef0289](https://github.com/event4u-app/agent-config/commit/5ef028904eec7f969203748a50461a77bb9295f0))
* **roadmap:** close out image-brand-typography → archive + spawn follow-up ([50d92a6](https://github.com/event4u-app/agent-config/commit/50d92a64335ad09c8e66b31b6baa38b5749e5081))
* **sync:** condense reasoning-orchestrator + decision-record descriptions; project triggers.json ([596a42f](https://github.com/event4u-app/agent-config/commit/596a42f1dbb257a975b062720487f0e303093bfe))
* **roadmap:** rdp-eval — council-backed execution disposition + maintainer handoff ([34d0d34](https://github.com/event4u-app/agent-config/commit/34d0d342e56594850d2dd71ad6fbef73b84f9e16))
* **ci:** add check_council_config_location guard ([fe06514](https://github.com/event4u-app/agent-config/commit/fe06514665721f30bee503566065aaaabc55f755))
* **roadmap:** rdp-eval Phase 3.2 done + Phase 3.1 sample/plan; defer kernel + eval work ([08e8943](https://github.com/event4u-app/agent-config/commit/08e894369368ff0de76fafcaf4c573f9de408f3c))
* **roadmap:** mark image-brand-typography A.2 pack + A.3 first skills done ([2d79454](https://github.com/event4u-app/agent-config/commit/2d794541d9ecfd8d3da041344dec5c3d71b5f5f5))
* **roadmap:** sync progress dashboard and archive completed bench roadmap ([7ab2890](https://github.com/event4u-app/agent-config/commit/7ab28902eb6d3236550cf22bd33784ae40f75c97))
* **roadmap:** tier-removal Phase 1 done — park in later/ pending soak ([bef9d6f](https://github.com/event4u-app/agent-config/commit/bef9d6f54023b2c70c0834d43b29ada1312afba3))
* **roadmap:** mark image-brand-typography A.2 scaffold adapters done ([2cacb3b](https://github.com/event4u-app/agent-config/commit/2cacb3b05d41ad97be0571f12f352adec2a57384))
* **roadmap:** close + archive harvest-orchestration ledger ([e4bfd0a](https://github.com/event4u-app/agent-config/commit/e4bfd0a3775fcf86ff7bd42170e7376b83a114a9))
* **roadmap:** mark image-brand-typography A.1 (substrate extraction) done ([c93e50d](https://github.com/event4u-app/agent-config/commit/c93e50d2a3354085da03a12279644d72d385fbef))
* **roadmap:** archive completed road-to-greenfield-scaffold (PR-gate) ([02a844c](https://github.com/event4u-app/agent-config/commit/02a844c17ebd6201761ea37802ff52d510ae59bd))
* **roadmap:** park road-to-contract-integrity in later/ ([26a3026](https://github.com/event4u-app/agent-config/commit/26a3026e73125c8f557724bcf2cec82ce8a4c090))
* **roadmap:** complete and archive road-to-mcp-token-accounting ([5bbcda0](https://github.com/event4u-app/agent-config/commit/5bbcda0d4653caaa1326a4ea584a3123e158ac73))
* **roadmap:** complete and archive road-to-rdp-discoverability ([3047c6b](https://github.com/event4u-app/agent-config/commit/3047c6b110a97b18ddcd5eb049119b7a1ee45230))
* **deps:** drop the optional agent-memory peer dependency ([c9e2232](https://github.com/event4u-app/agent-config/commit/c9e2232ebbcfbe3aecde391543d986b8d98353ef))
* **roadmap:** close + archive road-to-capability-discoverability ([da0f05c](https://github.com/event4u-app/agent-config/commit/da0f05cbd38d642dcc476e4ed66f9d30fc24b2c0))
* **counts:** bump advertised command count to 155 (materialize) ([f24b1a0](https://github.com/event4u-app/agent-config/commit/f24b1a0401901df2b43bb1ca14c1ce80a6d4f7cf))
* **roadmaps:** archive completed road-to-structure-grounding-v2 ([ec738ed](https://github.com/event4u-app/agent-config/commit/ec738ed20b598a81338563820f207050c2ccb71d))
* **roadmap:** complete + archive harvest-small-enhancements; defer 3a/4b ([3325572](https://github.com/event4u-app/agent-config/commit/3325572cd013a5b0968450c852ef503fe7a94ce0))
* close structure-grounding — kill v2, retire instrument, archive ([fbb3b4f](https://github.com/event4u-app/agent-config/commit/fbb3b4f3f2a44550b194b2c0ae0317f6b56d9c43))
* **roadmap:** complete + archive road-to-autonomous-verify-loop; spawn follow-up ([4edddae](https://github.com/event4u-app/agent-config/commit/4edddae67aae63c7d0545489cef6b0b32f0635ca))
* **py2ts:** regenerate derived artifacts after main sync #6 ([be54af5](https://github.com/event4u-app/agent-config/commit/be54af537a1df48e586df7be6297c8e211880864))
* regenerate derived outputs for source-discovery ([c18d02a](https://github.com/event4u-app/agent-config/commit/c18d02a8d93f3dbeb52a0dd163bc9293a5124666))
* **roadmap:** complete + archive road-to-security-hardening ([7577af4](https://github.com/event4u-app/agent-config/commit/7577af482f5a26fcb6e1db976a4323699214896a))
* **roadmaps:** archive completed analysis-workbench + capability-headroom ([4f4bb55](https://github.com/event4u-app/agent-config/commit/4f4bb5503e9800a93cb351d2ef9376677e911241))
* **py2ts:** regenerate dist + projections + hashes after sync #5 + ADR renumber ([864c237](https://github.com/event4u-app/agent-config/commit/864c2372c96672e0b1c61a5b186c6536bc53a2d7))
* **py2ts:** regenerate derived artifacts after main sync #5 ([c6db68b](https://github.com/event4u-app/agent-config/commit/c6db68ba0a5c77040b4fec2c15fc6fd2dcefbe3b))
* **generated:** sync command-count messaging to 153 (badge + browse line) ([cc1bb38](https://github.com/event4u-app/agent-config/commit/cc1bb387e40fe046755c640137aba888bc4b7a54))
* **generated:** regenerate index + catalogs for analysis-workbench ([13ba87c](https://github.com/event4u-app/agent-config/commit/13ba87cd74bdd21a64170b70c346f58f2705ede2))
* **generated:** sync counts + condensation hashes for analysis-workbench ([6608e44](https://github.com/event4u-app/agent-config/commit/6608e441571e5a8f87b6e940493f8eb0cbaeac08))
* **py2ts:** regenerate derived artifacts after main sync #4 ([604a46e](https://github.com/event4u-app/agent-config/commit/604a46e166fcdfb30611601ce580960b7e83f782))
* **roadmap:** close + archive road-to-competitive-borrow ([26263a7](https://github.com/event4u-app/agent-config/commit/26263a7f73a51ec62065aa7e91b9ba790c0240b6))
* **py2ts:** regenerate derived artifacts after main sync #3 ([6c1a723](https://github.com/event4u-app/agent-config/commit/6c1a7230a8c04ecd1fd174000dade30749d9a304))
* **py2ts:** regenerate dist mirror + tool projections + hashes after sync/twin-adapt ([8a6aefe](https://github.com/event4u-app/agent-config/commit/8a6aefe7ea237e65b4119ea5fbc2d9c89503b2db))
* **py2ts:** regenerate router/dashboard/hashes after main sync ([cc22ea4](https://github.com/event4u-app/agent-config/commit/cc22ea4c368503b80d5f653564bfed5c1ee2a328))
* **py2ts:** regen dist mirror + hashes for skill-script twins ([69706c0](https://github.com/event4u-app/agent-config/commit/69706c0d4b96e6db8776b2fdd4f62fb0b2bb0a78))
* **py2ts:** regen dist mirror + hashes for work_engine foundation twins ([dbb984f](https://github.com/event4u-app/agent-config/commit/dbb984f47a343f8c6d0637f3988c27c1f1c040a8))
* **py2ts:** regen dist/agent-src/templates/scripts mirror for the new .ts twins ([7e90002](https://github.com/event4u-app/agent-config/commit/7e90002d2bad58aa0a1ca84552f1d02c1fa87e36))
* **py2ts:** regenerate skills-catalog + llms.txt on merged skill set ([9bb7958](https://github.com/event4u-app/agent-config/commit/9bb795828278f08f643a1062d68365a3394a181a))
* **py2ts:** regen migration dashboard after mcp_server ([02844f0](https://github.com/event4u-app/agent-config/commit/02844f0dc4e81983ee47cffeb7550e7efca0222b))
* **py2ts:** recompute condensation hashes for merged source (lag-8 sync) ([ab7d0a7](https://github.com/event4u-app/agent-config/commit/ab7d0a7296ef8becbeaea6022f3d8713cfa21255))
* **py2ts:** regen migration dashboard after wave 8h ([332e9b8](https://github.com/event4u-app/agent-config/commit/332e9b86bb54bd4339ef317d803cda4ec4117560))
* **py2ts:** regen migration dashboard after wave 8g ([3d13126](https://github.com/event4u-app/agent-config/commit/3d1312696fe56a4b83b40ad8338dfa8f282165c2))
* **py2ts:** regen migration dashboard after wave 8f ([b79b9ad](https://github.com/event4u-app/agent-config/commit/b79b9adc8d527117360bb94360d0c5738b978f06))
* **py2ts:** regen migration dashboard after wave 8e ([e7f5014](https://github.com/event4u-app/agent-config/commit/e7f501429e8691295ebb66f85e3f38d29b5fb726))
* **py2ts:** regen migration dashboard after wave 8d ([e674751](https://github.com/event4u-app/agent-config/commit/e6747510d9f5773506e31cf5b17bd035056bef07))
* **py2ts:** regen migration dashboard after wave 8c ([fe83b60](https://github.com/event4u-app/agent-config/commit/fe83b60043c3f9097d3421f4e19b57c393ef6dac))
* **py2ts:** regen migration dashboard (project_thin_rules added) ([5ab0c49](https://github.com/event4u-app/agent-config/commit/5ab0c49e0eaab913a2038be1800348211091cbb3))
* **py2ts:** regen migration dashboard after wave 8b ([a3af3db](https://github.com/event4u-app/agent-config/commit/a3af3dbb01bc1fff93b270d4c0f3472052b603fc))
* **py2ts:** open phase 2 (shared libs) — manifest in-progress, roadmap step 2 done ([34a2f8b](https://github.com/event4u-app/agent-config/commit/34a2f8b722a27d39779a02a90116f49fee0de8f7))
* **condense:** recondense swept references into dist projections ([f3e0c52](https://github.com/event4u-app/agent-config/commit/f3e0c523585aa7ba99db2d68e805c088c9771018))

### Other

* **py2ts:** clear eslint errors in migrated TS (0 errors) ([9183ae3](https://github.com/event4u-app/agent-config/commit/9183ae396997b3e73c210cbe36e079c64c6c079f))

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
