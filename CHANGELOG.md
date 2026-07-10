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

### Added — `agents/` directory contract + gitignore hygiene (`road-to-agents-dir-and-gitignore-hygiene`)

- **`docs/contracts/agents-layout.md`** — authoritative contract for every top-level entry in `agents/` (purpose, git policy, retention, consumer-scope); includes the User Inbox Workflow (`agents/tmp/` → `agents/tmp.old/`).
- **`src/config/agents-paths.yml`** — machine-readable classification manifest for all agent-managed paths; feeds the new CI freshness gate.
- **`agents/tmp/` + `agents/tmp.old/` now covered in consumer `gitignore-block.txt`** — both dirs were previously unignored for consumers.
- **New CI gates** (all wired into `task ci`):
  - `check-gitignore-freshness` — verifies every manifest entry is in the consumer block.
  - `check-generator-output-coverage` — every `generate_*` output root in `condense.ts` must be classified.
  - `check-tracked-but-ignored` — fails if any git-tracked file is now covered by an ignore pattern (makes the bench-run class of drift impossible to reintroduce).
  - `check-generated-artefact-headers` — validates freshness markers on regenerable analysis artefacts.
- **`lint_agents_layout.ts` extended** — in source-repo mode, unknown **directories** at the `agents/` root are now CI errors (previously only flat files were checked); `CONSUMER_EXPECTED_ENTRIES` extended with the full consumer-scope allowlist.
- **Janitor** (`task janitor` / `task janitor-apply`) — TTL sweep for `agents/tmp.old/` (30 days) and `agents/runtime/tmp/` (7 days); reports user inbox state and `.harvest-local/` size; never auto-sweeps the user inbox.
- **`/sync-gitignore:fix` extended** (Steps 5–6) — now also reports ignored-but-tracked files with the exact `git rm --cached` commands, and runs the manifest coverage check.
- **`/roadmap:create`** — moves consumed `agents/tmp/` files to `agents/tmp.old/` in the same reply (inbox workflow).
- **`agent-docs-writing` skill** — documents the user inbox contract; redirected `prediction-pool` agent scratch from `agents/tmp/` to `agents/runtime/tmp/`.

#### Migration

If you have a consumer project:

1. Run `agent-config sync-gitignore --cleanup-legacy` to add `/agents/tmp/` and `/agents/tmp.old/` to your `.gitignore`.
2. Run `git ls-files -ci --exclude-standard` — if any files appear, run the printed `git rm --cached` commands and commit.

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

# Era: pre-8.0.0 — archived

> All entries before `8.0.0` live in
> [`docs/archive/CHANGELOG-pre-8.0.0.md`](docs/archive/CHANGELOG-pre-8.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-8.1.0 — archived

> All entries before `8.1.0` live in
> [`docs/archive/CHANGELOG-pre-8.1.0.md`](docs/archive/CHANGELOG-pre-8.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-8.9.0 — archived

> All entries before `8.9.0` live in
> [`docs/archive/CHANGELOG-pre-8.9.0.md`](docs/archive/CHANGELOG-pre-8.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 8.9.x — current

> Started at `8.9.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 8.10.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [8.10.0](https://github.com/event4u-app/agent-config/compare/8.9.0...8.10.0) (2026-07-10)

### Features

* **bus-factor:** dogfooded self-review gate (advisory, inert without secret) ([f5afbca](https://github.com/event4u-app/agent-config/commit/f5afbca154e5a62fff7c3f3a3409334457a05e84))
* **domain-soundness:** author 4 rubric-target domain-truth fixtures (candidates) ([b391a0c](https://github.com/event4u-app/agent-config/commit/b391a0cf13051946ea9b024b68353e6c9a31c124))
* **evals:** skill-eval-coverage — default-surface set (29 evals) + close + archive ([119328e](https://github.com/event4u-app/agent-config/commit/119328e62410573561c09e6a4076adeece167b3f))
* **evals:** skill-eval-coverage — behavioural evals for the rich + router sets ([84f066e](https://github.com/event4u-app/agent-config/commit/84f066eb9131310dc0ce3526162565dd3f3cc7ac))
* **quality:** frontier-quality-operating-system Phases 3–8 — close + archive ([e75d52d](https://github.com/event4u-app/agent-config/commit/e75d52d29787f8dcfcdc7a321df6221e3cb252ec))
* **testing:** wire mandatory case discovery into TDD, /tests create, stack skills ([d2e9ec5](https://github.com/event4u-app/agent-config/commit/d2e9ec565419fa4166ff04e6b43039226fab8bde))
* **skill:** add test-case-discovery — enumerate-before-write coverage funnel ([6dc2e76](https://github.com/event4u-app/agent-config/commit/6dc2e76dadc7188c8e64e49e04f7c1fd21d64288))
* **quality:** frontier-quality-operating-system Phases 1+2 — mechanism matrix + eval-harness spine ([92ad083](https://github.com/event4u-app/agent-config/commit/92ad083a6ce7cd33bfdbc36f04b500b0f0594f56))
* **work:** consumer-flow intake wiring + retrieval quality metrics ([1ca3b7d](https://github.com/event4u-app/agent-config/commit/1ca3b7d9535b5d49f5d61011a92366ca762cf763))
* **worktree:** governed worktree layer — skill + /worktree:* thin cluster ([e662249](https://github.com/event4u-app/agent-config/commit/e6622494f5f5d8f00337bf93a3ac750defcc69e1))
* **telemetry:** delegation quality pair — first_pass_success + escalated ([ded001f](https://github.com/event4u-app/agent-config/commit/ded001f22e4d4eb70a0f4318f47d2aa4323ede58))
* **sizing:** release-sizing contract + CHANGELOG Rollback: gate ([e591098](https://github.com/event4u-app/agent-config/commit/e591098665eb10561e55b064a1f99e29f3c649e4))
* **invariants:** kernel semantic-invariant gate (guards lost-merge-content class) ([59c58d5](https://github.com/event4u-app/agent-config/commit/59c58d5995a4127ebae82ea2fd48109ac508928f))
* **surface:** surface-specific-agent-contracts Phases 2+3 — close + archive ([4899010](https://github.com/event4u-app/agent-config/commit/489901079c538a04f39d293f747fac9040e981f7))
* **release-gate:** pack-based consumer matrix, release-adjacent dry-runs, red-workflow tripwire ([3742c9a](https://github.com/event4u-app/agent-config/commit/3742c9a8f290156f9696f51f51cf981f49ba97be))
* **surface:** surface-specific-agent-contracts Phases 0/1/4/5/6/7 — backbone + fixtures ([9bff235](https://github.com/event4u-app/agent-config/commit/9bff2351b2e28703033084be0bf3541458731ea7))
* **design:** design-artifact-fidelity Phases 5–7 + close + archive ([d92355a](https://github.com/event4u-app/agent-config/commit/d92355ac333d429803270219f1b8d1a4d24f6a85))
* **design:** design-artifact-fidelity Phase 4 — variation & canvas planning ([b1ae817](https://github.com/event4u-app/agent-config/commit/b1ae817d3a76c9cc859f206a28278b29c9795778))
* **design:** design-artifact-fidelity Phase 3 — surgical edit preservation ([065fd17](https://github.com/event4u-app/agent-config/commit/065fd1712f6256a662f0073f828491f8b0bc3433))
* **design:** design-artifact-fidelity Phase 2 — resource-first context gate ([4a40217](https://github.com/event4u-app/agent-config/commit/4a40217e6f86b3d6a5b8f3e25cceeaeea10b550a))
* **design:** design-artifact-fidelity Phase 1 — lifecycle contract ([1256d47](https://github.com/event4u-app/agent-config/commit/1256d47e94f5a3c874b726e6b24045aca6f74513))

### Bug Fixes

* **ci:** heal post-merge reds — portability literal, ranking regression, proof drift ([319a2f8](https://github.com/event4u-app/agent-config/commit/319a2f82e67fd2c498a113a627df9ae77871b327))
* **skill:** playwright-testing — add run-verification note (clears skill_linter warnings) ([68db2b6](https://github.com/event4u-app/agent-config/commit/68db2b629a2689926fc6befdcdd944ea006e4652))

### Chores

* regenerate docs/proof.md — skill-count claim 269 → 270 ([0ec4c58](https://github.com/event4u-app/agent-config/commit/0ec4c5831941aa95b55613bb2c1ffe61c8724ab3))
* **roadmap:** close + archive command-structure-optimization (deferred items → later/ follow-up) ([fa9a1b7](https://github.com/event4u-app/agent-config/commit/fa9a1b71e4623f4138123299b3fbbf5179d7eb68))
* regenerate counts, pack manifests, condensation hashes ([1ba1a86](https://github.com/event4u-app/agent-config/commit/1ba1a863de5e52e139ca1283ef36f252672f7ba5))
* fix command-count badges to 177 (counts-update missed hero badge + browse line) ([4d6551d](https://github.com/event4u-app/agent-config/commit/4d6551d14c80e936135125cdb98476b6fb575913))
* sync counts, manifests, projections, dashboards; archive completed roadmap ([5178af3](https://github.com/event4u-app/agent-config/commit/5178af3bd66dffb1071607e03b0551a2c5e74d01))

Tests: 7212 (+24 since 8.9.0)

## [8.9.0](https://github.com/event4u-app/agent-config/compare/8.8.0...8.9.0) (2026-07-10)

### Features

* **rules:** simplicity-first bans, own-orphan cleanup, goal-driven execution ([3e4de80](https://github.com/event4u-app/agent-config/commit/3e4de80f9d1f7ece41162503fbcd6309620bf331))
* **design:** design-artifact-fidelity Phase 0 — verification capability + eval baseline ([da9ff3a](https://github.com/event4u-app/agent-config/commit/da9ff3a41381e6ce0e749a74fd499de28b3ee7ea))
* **kernel:** re-land direct-answers no-duration + never-cite-the-rule (#844 content lost from main) ([2c46e7f](https://github.com/event4u-app/agent-config/commit/2c46e7f3b194ad2179b92307939d588cdb3971f3))
* **lint:** fail skills that claim a Claude Code built-in name ([4c0cd39](https://github.com/event4u-app/agent-config/commit/4c0cd39b9a0bf604e436bbc80327b0bddf26b9e3))
* **install:** withhold Claude Code built-in names from /name projections ([6dcba71](https://github.com/event4u-app/agent-config/commit/6dcba71bc2e5660a00c3dd7106ece65754c71633))
* **kernel:** re-land action-authority sharpening (#840 content lost from main) ([13f244c](https://github.com/event4u-app/agent-config/commit/13f244c9bcb5d92641e5c87e3964c5d4212c8b46))
* **domain-soundness:** deterministic domain-truth fixtures + scorer + candidate run ([dfb27a2](https://github.com/event4u-app/agent-config/commit/dfb27a2e8f1871f436bac19446d76c569f33e3c6))
* **execution:** amend-trap, tool-tier ladder, disconfirmation search, anti-over-engineering, authoring guidelines (P2-P6) ([2e7d4d2](https://github.com/event4u-app/agent-config/commit/2e7d4d2a6210672289a50441295f84e21f4f442a))
* **design:** same-ramp contrast, componentization threshold, async-verifier, handoff template (P3/P4/P5) ([be49527](https://github.com/event4u-app/agent-config/commit/be49527050f235d9396c14f2fe077c3c38209798))
* **design:** diagram-type routing + geometric pre-checks + embedded register (P1/P2/P4) ([32947b8](https://github.com/event4u-app/agent-config/commit/32947b8a63abc464edeec399929b3f5605b19ddb))
* **handoff:** verbatim-first lossless template in agent-handoff (P4) ([76a5455](https://github.com/event4u-app/agent-config/commit/76a54557fb5c366b31b72e67d726a105de9e7a74))
* **memory:** save-successes + reference-shape + verify-then-repair + derivability (P2/P3) ([d4c6e81](https://github.com/event4u-app/agent-config/commit/d4c6e810df365c8990ef9cf75f0289f970eb4a9a))
* **orchestration:** worker-prompt contract in subagent-orchestration (P1) ([ba65867](https://github.com/event4u-app/agent-config/commit/ba65867f28273b97c16e7799a7c68d00bc16fccd))
* **memory:** hostile-input write-guards at persist-time (P3) ([e08287b](https://github.com/event4u-app/agent-config/commit/e08287b663a56b4f6e85d0295f6229ca59cb77da))
* **security:** found-instructions quarantine + injection-signal taxonomy (P1/P2) ([446909a](https://github.com/event4u-app/agent-config/commit/446909a007c2f7dbffee14adf32fc6cdcef9504e))
* **lint:** cover human-gate phase headings and exit criteria; sharpen step patterns ([68c8738](https://github.com/event4u-app/agent-config/commit/68c8738d1ee10d5b433de02eaaaf3bf3f836b826))
* **lint:** warn on human-gate checkbox steps in roadmap complexity lint ([64c5f6c](https://github.com/event4u-app/agent-config/commit/64c5f6cbbe5be69eaf4d84c523b6b6935a351ed9))
* **knowledge:** document slicer (B8) + external code-graph interop rule (B9) ([c09bcb9](https://github.com/event4u-app/agent-config/commit/c09bcb994577f2ed87a19b7e11b617708bf60561))
* **memory:** seed the curated corpus from the maintainer memory index ([2422f51](https://github.com/event4u-app/agent-config/commit/2422f51e4f07d5ab2b55ab5c9bf74b5950513957))
* **bench:** self-measuring benchmark command + Cohen's Kappa judge (B7) ([58b9687](https://github.com/event4u-app/agent-config/commit/58b96878931ef976dce92dc333a966021d3b8e08))
* **discovery:** stat-index primitive + lazy graph rebuild skip (B5a) ([04c34c6](https://github.com/event4u-app/agent-config/commit/04c34c65bc0b08331a9d8d2a1a9fae7ee20102c6))
* **discovery:** artefact relation-graph + `affected`/`explain` verbs (B4) ([d9ffe0b](https://github.com/event4u-app/agent-config/commit/d9ffe0bff5f8326f4e077c9b27b7f604180d8242))
* **memory:** merge learning-sidecar verdicts into retrieve() output (B3) ([46ddf98](https://github.com/event4u-app/agent-config/commit/46ddf98e915db50e6c4b75ef5dcf5ebc13b7c721))
* **memory:** learning-sidecar aggregator — decay + corroboration + dead-ends (B3) ([11fc4a2](https://github.com/event4u-app/agent-config/commit/11fc4a28bf5e724eb09bf5eb07e66076ebfbc689))
* **memory:** activate the lexical index in retrieve() above the tripwire (B2) ([6d6dbe8](https://github.com/event4u-app/agent-config/commit/6d6dbe8ae8153868c33fe6f867b953ceae375158))
* **memory:** measure lexical ranking lift — the B2 ship-gate (proven) ([9f4feb9](https://github.com/event4u-app/agent-config/commit/9f4feb923a30f0462362ef1ae25cd3d482225247))
* **memory:** add hand-rolled BM25 + trigram lexical index (B2) ([971c86e](https://github.com/event4u-app/agent-config/commit/971c86e982a7afc2ab28424195a7783f7ce1f1e9))
* **lint:** add versioned-cache gate (B5b) ([5bfe14a](https://github.com/event4u-app/agent-config/commit/5bfe14a78e07b9eac130ee3b8e835080752d1424))
* **memory:** add token_budget compact read surface to retrieve_v1 ([44b8c4c](https://github.com/event4u-app/agent-config/commit/44b8c4c8d6c4e014c5a1d91219fce57dfe60bfde))
* **security:** sanitize floor on retrieval read-surfaces (B6) ([07802d6](https://github.com/event4u-app/agent-config/commit/07802d69a8ab501435b965a5a6aa9bf86d2004f7))
* **orchestration:** modeled cost-% for the downshift rate win ([6a4ec50](https://github.com/event4u-app/agent-config/commit/6a4ec50350cf980fe17ba888957c37c615cc68ce))
* **hooks:** pre-push changed-TypeScript static pass (typecheck + lint) ([640b789](https://github.com/event4u-app/agent-config/commit/640b789c76a2ac1637fa50fe3917557b7789f2a5))
* **orchestration:** recorder that emits validated telemetry per dispatch ([12aa7b1](https://github.com/event4u-app/agent-config/commit/12aa7b131c7852734df85f920f079f5f1e01357b))
* **second-brain:** retrieval-precision harness + store + pinned report ([350e9b7](https://github.com/event4u-app/agent-config/commit/350e9b7a3534cd3030272113a06818b3e384a278))
* **security:** harden agentic-security rules + skills (Fable5 follow-ups) ([e6fdb23](https://github.com/event4u-app/agent-config/commit/e6fdb23bd919789374a3001a7c6d89170426907a))
* **second-brain:** paired-run harness + pinned PASS report (Phase 2) ([85c9898](https://github.com/event4u-app/agent-config/commit/85c9898bcef8dfb2439096e38531b5d904233eb8))

### Bug Fixes

* **roadmap:** accept dotted sub-phase ids in PHASE_RE ([aaa54c3](https://github.com/event4u-app/agent-config/commit/aaa54c3ab7060b3e300bac99788325848400f954))
* **skills:** mcp and code-review opt out of slash registration ([67d261a](https://github.com/event4u-app/agent-config/commit/67d261af0c06147ca3e771b3b6d57ceec34ede63))
* **roadmap:** live-verify PR merge state before any in-flight/merged claim ([54ae7b0](https://github.com/event4u-app/agent-config/commit/54ae7b063a0bd641a931db423264ed0b8a4452f7))
* **cli:** rename graph verb explain→graph-explain (collides with decision-chain explain); register verbs; recompile router ([8489858](https://github.com/event4u-app/agent-config/commit/84898580de0df92ec9f2f748d26c9a455c8c2468))
* **rules:** assign new rules to the `meta` pack, not `core` (strict discovery) ([2a4d118](https://github.com/event4u-app/agent-config/commit/2a4d118fbacaf167d5a005803ef90e9524a7c7b5))
* **roadmap:** harden /roadmap:process-full as law + add question-not-instruction rule ([b1eee65](https://github.com/event4u-app/agent-config/commit/b1eee65f0ff386b6461b72a39cae577b6582559f))
* **memory:** align check_memory KNOWN_TYPES with the five write-side types ([1905648](https://github.com/event4u-app/agent-config/commit/1905648dabdfb0680ea1cf610bf43e8f07abda32))
* **memory:** concrete summary type for measure_lexical_ranking (typecheck) ([475e7be](https://github.com/event4u-app/agent-config/commit/475e7be9af36b6fd7beff717502687f7a84a3e58))
* **memory:** drop unused import + regenerate proof.md (CI) ([e415eb6](https://github.com/event4u-app/agent-config/commit/e415eb6184b697f1bb667872d6f1b8d08dea1ce6))
* **second-brain:** restore proof § 3 heading + noUncheckedIndexedAccess guards ([b684a6c](https://github.com/event4u-app/agent-config/commit/b684a6cd1774dfd47d720d5be4cbe32ca854e213))
* **verify:** require a changed-files static pass before pushing source ([ba3a9b5](https://github.com/event4u-app/agent-config/commit/ba3a9b5f467c5e4621637297366a4e58f84059b2))
* **security:** post-review nits — through-line pack + FE-render greps + lint desc ([712a338](https://github.com/event4u-app/agent-config/commit/712a3389463453d01df19c421a310ed991a1fc9f))
* **ci:** pin publish-npm to npm 11 for Node 20 compat ([4c0ed33](https://github.com/event4u-app/agent-config/commit/4c0ed33af0229b53e423a863d9e6946a49d08868))

### Documentation

* **contracts:** document the reserved host-name floor ([7ef51e9](https://github.com/event4u-app/agent-config/commit/7ef51e99d913f1d0e3ce48dd8caefc8804612ea5))
* **roadmap:** flip execution-discipline non-kernel phases; counts + dashboard + hashes ([9da5da5](https://github.com/event4u-app/agent-config/commit/9da5da576c08f0eae3d7577079cd4f913a7f69ca))
* **design:** reference-over-vendor pointer + close design-mechanism harvest (P6) ([e41f45c](https://github.com/event4u-app/agent-config/commit/e41f45cdc1297a6fa4293836b5a7a5cbf43a1c00))
* **roadmap:** record drift-audit disposition (P5); flip + archive orchestration-memory harvest ([a6caca8](https://github.com/event4u-app/agent-config/commit/a6caca8cd5857be9a188ec5c704835e11921c16e))
* **roadmap:** blocker sweep per template rule 22 — resolve 7 non-gates, unblock ci-native Phase 1 ([fabbbc3](https://github.com/event4u-app/agent-config/commit/fabbbc320dd65be51dc552ff12bde628ee7402a6))
* **roadmap:** flip injection-authority Phases 1-3,5; sync hashes + dashboard ([0ca2310](https://github.com/event4u-app/agent-config/commit/0ca2310b0007c15f66ed4f95e5e1260b9b6b83be))
* **contracts:** draft injected-block authenticity model (P5, proposal only) ([0738dad](https://github.com/event4u-app/agent-config/commit/0738dad234ef545c40d0294fdc47b2b116f2c7aa))
* **roadmap:** separate external blockers from human gates; risk-based autonomous recommendation ([dc049e1](https://github.com/event4u-app/agent-config/commit/dc049e1fe68612367c576db9fae693abf04b1cc5))
* **roadmap:** autonomy-first authoring — human gates are the exception ([c007ac7](https://github.com/event4u-app/agent-config/commit/c007ac7db79184805d2815ff21da0c4ba7858402))
* **memory:** name the separator-recall limit in the retrieval scope + ADR-116 ([0c8a6f8](https://github.com/event4u-app/agent-config/commit/0c8a6f8a065347e8a6a4df8b08b319ce23a6f5b5))
* sync counts (+2 rules), CLAIMS/proof, archive completed roadmap ([101c801](https://github.com/event4u-app/agent-config/commit/101c8015532f258671af28934048bb4049e16ed4))
* **roadmap:** mark B3 display-merge done — Phase 3 complete ([3fa451a](https://github.com/event4u-app/agent-config/commit/3fa451aff07a9d1309e594614cef5cd1868b6e15))
* **roadmap:** mark B3 aggregator done (Phase 3 checkbox 1) ([43ba766](https://github.com/event4u-app/agent-config/commit/43ba76606659310d529cbb73b1ad1e1539f6e2fb))
* **roadmap:** mark B2 activation done — Phase 2 complete ([89f6ae4](https://github.com/event4u-app/agent-config/commit/89f6ae448123e8a633e4e9f990ca0bae442f045c))
* **memory:** record ADR-061 <-> FTS5 resolution for retrieval ranking (B2) ([0e54680](https://github.com/event4u-app/agent-config/commit/0e546807489e9e8c0c68e8db45fe661a8e3b1790))
* **roadmap:** resolve retrieval-substrate design council pass; promote to ready ([9194898](https://github.com/event4u-app/agent-config/commit/9194898cfa0b80f2c1bd5f4b3783eaec7337c037))
* **roadmap:** draft retrieval-substrate hardening (source-anonymous borrow) ([708ac89](https://github.com/event4u-app/agent-config/commit/708ac89d930301fbf9880e59908552d2e8b1d175))
* **orchestration:** document dispatch_tokens + session_tier telemetry fields ([f59562a](https://github.com/event4u-app/agent-config/commit/f59562a598c610a42a16fd1ced4dfa769eab2f15))
* **token-saving:** run the live thin-vs-eager judge — honest INCONCLUSIVE ([3ad161b](https://github.com/event4u-app/agent-config/commit/3ad161b104c1a037b22774738e9545f4b65cc0ca))
* **claims:** repoint hidden-instruction claim to the release gate ([a41815d](https://github.com/event4u-app/agent-config/commit/a41815db830ba90e5daaa512f6b55b6ee8be4f81))
* **orchestration:** wire the recorder into the emit procedure + delegation-policy ([69042ad](https://github.com/event4u-app/agent-config/commit/69042ad1568bd9e16a520e63c91744cd385567a1))
* **proof:** regenerate proof page for the new hidden-instruction claim ([45f5a7a](https://github.com/event4u-app/agent-config/commit/45f5a7a106c4c5c5b3b003ed3c3fd8e6be4f8425))
* **claims:** bind the hidden-instruction CI scan to the claims ledger ([55fe74e](https://github.com/event4u-app/agent-config/commit/55fe74ed2122959d465b9fcc4f2fc6daffd30445))
* **second-brain:** publish the retrieval-precision result across the surfaces ([3ee930a](https://github.com/event4u-app/agent-config/commit/3ee930a4bc61e3f1c01c7a02b204099f96042e2a))
* **frontier-quality:** Phase 0 metrics + provenance + contract + pilot proposal ([0e738fb](https://github.com/event4u-app/agent-config/commit/0e738fb32a4645f499055940e386295b265fdc8d))
* **second-brain:** publish the measured recall lift + decline the export ([8fbaeaf](https://github.com/event4u-app/agent-config/commit/8fbaeaf0fa8a361d9b469dad4d8046d677b4c9a7))

### Refactoring

* **skill:** extract topology hints from subagent-orchestration to context ([4918ef2](https://github.com/event4u-app/agent-config/commit/4918ef2372d7cb2c6e24a71ba9e3307946426899))

### Tests

* **memory:** land the Phase 0-pre substrate-validation foundations ([474df9a](https://github.com/event4u-app/agent-config/commit/474df9af95f8edd2ba10d6ba7ff88465a534d12d))

### CI

* **security:** fail-closed agent-security gate on the publish path ([f8934f7](https://github.com/event4u-app/agent-config/commit/f8934f739a4f27a11e3c0bd8df7c9943ddba519f))
* **second-brain:** wire the retrieval-precision dry-run into ci + ci-strict ([da4ec36](https://github.com/event4u-app/agent-config/commit/da4ec36e7c84765203864cb9f8e99e62aaf85e53))
* **security:** wire lint-agent-security into CI and scan dist/agent-src ([453095f](https://github.com/event4u-app/agent-config/commit/453095f28bcf9aaa9c9419872dc732571d9971e3))
* **consistency:** trigger required check on any workflow change ([e629624](https://github.com/event4u-app/agent-config/commit/e629624644e33fa1926c763f8b1a05c730c0fcdc))

### Chores

* **roadmap:** add + close road-to-simplicity-and-goal-discipline ([026bf11](https://github.com/event4u-app/agent-config/commit/026bf1159e9af14cee1f76ccfa240d7f7b7076f4))
* **roadmap:** close + archive execution-discipline-harvest (kernel content landed) ([49134d4](https://github.com/event4u-app/agent-config/commit/49134d4cb4178a7baa1cad8dbd38265b9c0d457f))
* **roadmap:** close + archive injection-and-authority-harvest (kernel content landed) ([810df58](https://github.com/event4u-app/agent-config/commit/810df58e7b7525b781f3cf5f93a1b651a85927fc))
* **install:** regenerate install bundle ([f167954](https://github.com/event4u-app/agent-config/commit/f1679547063d9cf6c9354c1d25d026f740445169))
* **condense:** refresh stale hash for commands/optimize/project.md ([fa9c0ec](https://github.com/event4u-app/agent-config/commit/fa9c0ecb57653a6157a1eacdc8eba2fd77a357c5))
* **condense:** project phases-4-7 rule/command/context edits into dist/agent-src ([7d727db](https://github.com/event4u-app/agent-config/commit/7d727db49522669d2aba3ac8e87cdbf5c9410898))
* **tasks:** unify task test to include the vitest suite ([e0ca766](https://github.com/event4u-app/agent-config/commit/e0ca766bc7a15ebf17347ac246257d57c04bf63f))
* **roadmap:** retrieval-substrate-hardening Phase 0 B6 done ([671f8d5](https://github.com/event4u-app/agent-config/commit/671f8d519a885bd93302d9962b3fc5c78469715a))
* **roadmap:** record the inconclusive live judge run on token-saving Phase 0 ([2356ec8](https://github.com/event4u-app/agent-config/commit/2356ec88527366fe6122fdaeb71e0ff1284f364c))
* **sync:** regenerate pack manifests after through-line pack move ([adde3de](https://github.com/event4u-app/agent-config/commit/adde3de8e94a7f03a6ebdc31e7837c0696b47209))
* **roadmap:** frontier-quality Phase 0 authored (proposal, checkpoint pending) ([0912362](https://github.com/event4u-app/agent-config/commit/0912362aedf6a90ae122ad1ea4f167e741c40dae))
* **roadmap:** close + archive second-brain-delta-proof (PASS) ([ec0909d](https://github.com/event4u-app/agent-config/commit/ec0909d78264d33e7ba71e6387ae553bd3494354))

Tests: 7188 (+161 since 8.8.0)

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
