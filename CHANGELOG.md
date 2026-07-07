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

# Era: 7.0.x — current

> Started at `7.0.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 7.1.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [8.0.0](https://github.com/event4u-app/agent-config/compare/7.5.0...8.0.0) (2026-07-07)

### BREAKING CHANGES

* **router:** retire the measured-dead balanced profile; essential replaces it ([c2d8010](https://github.com/event4u-app/agent-config/commit/c2d80101535b06f3c14f5b4d66ea419a4a29b0ec))

### Features

* **bench:** checkpoint/resume for the ab-v2 sweep runner ([369244e](https://github.com/event4u-app/agent-config/commit/369244eecc01301c6cc05a6f0dec1172c69df088))
* **bench:** matrix expansion + per-pinned-section composite render (Phase 3) ([53bd6e5](https://github.com/event4u-app/agent-config/commit/53bd6e58b48fca7399ae583d9d75aa584c0d7a0c))
* **delegation:** failure-type stop + ordered-slice dependency gate (Phase 2) ([3e38ddd](https://github.com/event4u-app/agent-config/commit/3e38ddd0063149fa9b19cd6c9f6a5e5b23b77b37))
* **commands:** add standalone /optimize-project command ([9f84f64](https://github.com/event4u-app/agent-config/commit/9f84f64d5d8527ad1ae7a56f260f3ef58084ae8e))
* **fleet:** config-driven multi-repo rollout (init --fleet, Phase 1) ([389e778](https://github.com/event4u-app/agent-config/commit/389e77836b56c26d57bcb3d07c4733552b2c937d))
* **conformance:** consumer conformance contract + init pre-flight (Phase 0) ([f5b4136](https://github.com/event4u-app/agent-config/commit/f5b4136cd3fdb5a81a4619052437d4c18e612fda))
* **program:** orchestration table live, activation contract, rollback SOP, field-corpus exporter, intent-semantics lock ([e5ef583](https://github.com/event4u-app/agent-config/commit/e5ef583fbbefeb93db23f4b127ac3d2c2d2e5c10))
* **golden-set:** scope-aware coverage + prompt↔trigger falsifiability + 51 consumer stubs ([fdf3da3](https://github.com/event4u-app/agent-config/commit/fdf3da399f366bef3327b53bd0ecaf2ddfb75b72))
* **packs:** pack hygiene — frontend + media rules land in their packs; rule_packs scoping axis ([bdae03f](https://github.com/event4u-app/agent-config/commit/bdae03fa60ec9ea50851718eb9c0dd4619cc9b6a))
* **projection:** host-native activation — populate Cursor/Windsurf globs from path-shaped triggers ([d9f2ec0](https://github.com/event4u-app/agent-config/commit/d9f2ec01059c3d62d5c4f0421db0f5df3ea4039a))
* **projection:** consumer-scoped rule projection (opt-in) + scoped thin-pointer catalog ([adc01ee](https://github.com/event4u-app/agent-config/commit/adc01ee3835f7747f55482d96ca048208e191105))
* **router:** schema v2 — workspaces/packs on every non-kernel entry + intent-only backstops ([7465a3a](https://github.com/event4u-app/agent-config/commit/7465a3afd5cede59a08eab087077f46c5776d9af))
* **bench:** harden the flip gate — dry-run mock and inconclusive are never unlocks ([0f26a2b](https://github.com/event4u-app/agent-config/commit/0f26a2b7c2916a6785f0cbae19cfeea7f1d6f946))
* **bench:** --host codex adapter for the P2 non-Claude replication ([2422f0f](https://github.com/event4u-app/agent-config/commit/2422f0fb25a06339d5189d863632772b599d5c9e))
* **settings:** discipline_profile knob, host-capabilities disable-list, essential router profile (ADR-110) ([6bc5fab](https://github.com/event4u-app/agent-config/commit/6bc5fabc1abd8b24c4ead74dfadc0cee63970a90))
* **bench:** add rules-kernel-dc and rules-balanced cost-factor sweep arms ([9277340](https://github.com/event4u-app/agent-config/commit/9277340a7387b16e0fbd1782ae8ddac086c45211))
* **scripts:** idempotent fold rollup for the intake stream ([280580b](https://github.com/event4u-app/agent-config/commit/280580bc609b145845c703e4e217ebde55b4225d))
* **memory:** contradiction surfacing in memory promote (durable types) ([b2aec22](https://github.com/event4u-app/agent-config/commit/b2aec22e021f8a5043f27dc3e06fc82967ec415b))
* **hooks:** hot-context working-memory cache with compact survival ([c8aac8d](https://github.com/event4u-app/agent-config/commit/c8aac8dac6681497f546b8171c13a431b57c1337))
* **scripts:** add memory/knowledge scale tripwires (lint_knowledge_scale) ([7dbbc10](https://github.com/event4u-app/agent-config/commit/7dbbc105a5c7cbb6458a479da68ae7f3f62f79a2))
* **rules:** direct-answers closes work replies with summary + PR link last ([740e289](https://github.com/event4u-app/agent-config/commit/740e289dc9c0c87cd3bb49d1bdfce2f7b3ac3033))
* **prompt-patterns:** execute road-to-prompt-pattern-adoption Phases 2–5; archive ([0abbcfe](https://github.com/event4u-app/agent-config/commit/0abbcfed1ac7df06234691bb22d09453e356a487))
* **roadmaps:** add lint_roadmap_blockers guardrail; wire into CI; document resolve cadence ([01573fa](https://github.com/event4u-app/agent-config/commit/01573fa0d7f00637f944f6773ad9bdce3f6669c2))
* **budget:** move the workspace-guidelines cap into src/config/budgets.yml ([ea2a9e4](https://github.com/event4u-app/agent-config/commit/ea2a9e47edd191f6b7b0c8916005bef417230486))
* **roadmaps:** parse and render blockers in the progress dashboard ([da1d87d](https://github.com/event4u-app/agent-config/commit/da1d87d587f1ebb969bc039e3f16eb9d8158a749))
* **roadmaps:** add structured Blockers contract to the roadmap template ([6cb9ecb](https://github.com/event4u-app/agent-config/commit/6cb9ecbe41f706a6e9b0e4009d79a9c086f16b87))
* **eval:** reminder-injection pilot A/B ran — ceiling on both hosts, pre-committed teardown executed ([0742a06](https://github.com/event4u-app/agent-config/commit/0742a06cf330d0e5c085fea2f2ee763b5315f7bc))
* **kernel:** demote user-interrupt-priority to auto tier ([8e5b410](https://github.com/event4u-app/agent-config/commit/8e5b410f89a8d5614cf366a9672cdb4beaf0b9cc))
* **skills:** memory-application etiquette in memory-consolidation ([65c874d](https://github.com/event4u-app/agent-config/commit/65c874dc8054056fbea3ac3967a7f425f26376c0))
* **rules:** add content-quoting-floor — cap verbatim quoting from external sources ([f0bd6f9](https://github.com/event4u-app/agent-config/commit/f0bd6f9027c3c0f303a6e639e78a1fea90004558))
* **rules:** value-over-budget escalation in the frugality canon ([3315df3](https://github.com/event4u-app/agent-config/commit/3315df3e20ddab7f313b4f6a4abd3280c1562212))
* **skills:** wire scope + revisit-if into ai-council, decision-record, decision-review, memory-consolidation ([678777e](https://github.com/event4u-app/agent-config/commit/678777e75402e94dd2f62ef2222bf2b41e965eb8))
* **rules:** add decision-revisit-gate — surface conflicts with past locks instead of silently dropping beneficial changes ([b6fa311](https://github.com/event4u-app/agent-config/commit/b6fa3113fdf632d3b34bfa59d1557ae6208b527b))
* **skills:** add design-variations, wireframe, and html-deck exploration skills ([ef98934](https://github.com/event4u-app/agent-config/commit/ef98934d59421fc70a42e987943dfd3a92f0ab44))
* **design:** add CP5 emoji-decoration slop rule and Q13 outward-artifact hygiene floor ([9bc1b6d](https://github.com/event4u-app/agent-config/commit/9bc1b6de0b7395cb16845c686df3cb029003e278))
* **evidence:** generators write freshness markers; regenerate baselines ([49a22f0](https://github.com/event4u-app/agent-config/commit/49a22f03f452cba1396b1428b6189d56e04ce435))
* **inbox:** user-inbox workflow — consumed inbox notes move to the processed archive ([ed16d5e](https://github.com/event4u-app/agent-config/commit/ed16d5e56dcce58d88561437cc49f680e1b37318))
* **janitor:** TTL sweep for the processed-inbox archive and runtime caches (dry-run by default) ([e3bb6f5](https://github.com/event4u-app/agent-config/commit/e3bb6f54b02c2404e7be06f3500a49c7393bb5e7))
* **lint:** directory enforcement + four drift gates for agents/ and gitignore hygiene ([86089d4](https://github.com/event4u-app/agent-config/commit/86089d42cddb36c4bb3e6ccc099b815caef89260))
* **contracts:** agents/ directory-layout contract + ignore-classification manifest ([83a4afd](https://github.com/event4u-app/agent-config/commit/83a4afd8262a73e573cf90b51b5d9f932165545c))
* **test:** archive road-to-fast-test-layer — all steps complete ([7119114](https://github.com/event4u-app/agent-config/commit/7119114c04db17851b66721df70c4a0e315a3107))
* **test:** Phase 4 in-process — chat_history, cli_python, knowledge_global cluster ([1c77ac5](https://github.com/event4u-app/agent-config/commit/1c77ac5ef199dfdced95b8e021728dcac9b4ddba))
* **test:** Phase 3 in-process migrations — measure/audit/lint/probe cluster ([a174318](https://github.com/event4u-app/agent-config/commit/a174318131c34677653a2d54d073ae0d5df192df))
* **test:** in-process harness + migrate cmd_* cluster ([5b80d87](https://github.com/event4u-app/agent-config/commit/5b80d8741e2d9a814dde81096acd4df7795af5a1))
* **knowledge:** Phase 6 — bootstrap + emit-event CLI ([5f2f522](https://github.com/event4u-app/agent-config/commit/5f2f5222ed35cc9c13d38740ef9bf585094b8241))
* **knowledge:** Phase 5 — living-context capture + error-driven repair ([bb252f0](https://github.com/event4u-app/agent-config/commit/bb252f052dbab466160be244034810ba8024183e))
* **knowledge:** Phase 4 — self-learning wiring: promotion + pointer degradation ([d975e18](https://github.com/event4u-app/agent-config/commit/d975e18f22d3af5d302cca1650d86d633eb2c8c9))
* **knowledge:** Phase 3 — team-sharing gate ([f5ae8f8](https://github.com/event4u-app/agent-config/commit/f5ae8f8122771022c743c3f9318fbd9e80222c2c))
* **knowledge:** Phase 2 — capture hygiene: dedup, recurrence, triage, warn-lint ([8f73dd3](https://github.com/event4u-app/agent-config/commit/8f73dd3d28adeb7ad6e38791b18faee7a84b99be))
* **knowledge:** Phase 1 — typed knowledge dirs, INDEX generator, retrieval protocol ([a3c825f](https://github.com/event4u-app/agent-config/commit/a3c825fb27de0713646c4cb83be094c8e0af464f))
* **rules:** contract carve-outs in drafting protocol and git-ops mechanics ([0fcfc47](https://github.com/event4u-app/agent-config/commit/0fcfc4783092095ca07a5b1f9bdfb2d387f30fb8))
* **roadmap:** run-start execution contract for autonomous runs ([d158df3](https://github.com/event4u-app/agent-config/commit/d158df30a85fcd478e074269f9bd1177f6ac59db))
* **roadmap:** declare per-roadmap execution.mode at authoring time ([f9a5696](https://github.com/event4u-app/agent-config/commit/f9a5696dd20a5dd37f358249fe2b0ea37fe2a69f))
* **recruit:** B9 install-friction study instruments (protocol + report template) ([78e4889](https://github.com/event4u-app/agent-config/commit/78e488995b5f5b3071e1a885bad4f11b9ef7188e))
* **site:** deploy the Starlight site to GitHub Pages (B4) ([9762e0e](https://github.com/event4u-app/agent-config/commit/9762e0e68a2d3196350f3d18d9af8f3ed046ef2a))
* **site:** surface the artefact catalog on the Starlight site (B4) ([d794758](https://github.com/event4u-app/agent-config/commit/d794758e8c21fa76f6d13dac70cce103c0a313c2))
* **proof:** embed the demo GIF on the proof page + carry it to the site (B8) ([e448803](https://github.com/event4u-app/agent-config/commit/e4488031ded5de4fa79fdff05165f108a2662e30))
* **demo:** recorded proof-page demo — deterministic trust commands (B8) ([af76a1c](https://github.com/event4u-app/agent-config/commit/af76a1c990801f0e281e37ee8f527991de57ec7e))
* **media-deps:** on-demand detect-and-instruct gate for asciinema + agg (B8 prereq) ([f35153e](https://github.com/event4u-app/agent-config/commit/f35153e9b1e70d5cc8c5a5917cfbb0137d653fe3))
* **site:** CI link-checker for the built Starlight site (B4) ([4cf1c38](https://github.com/event4u-app/agent-config/commit/4cf1c382e362376d9a5f794581609b0f3302e664))
* **subagent:** cross-host degradation to passive-reference contexts (A1) ([72ff872](https://github.com/event4u-app/agent-config/commit/72ff87206f25f17dc8851ca85c0c22738781e6dd))
* **proof:** B7 comparison-honesty table with falsifiability lock ([b928d32](https://github.com/event4u-app/agent-config/commit/b928d328d7f9dce122e5e90d29906c89d0074f56))
* **skills:** B6 per-skill honest-null gaps + proof Known Limits ([89829b7](https://github.com/event4u-app/agent-config/commit/89829b79bff2b8f667c54766fc766261214cec8e))
* **site:** minimal Starlight docs+proof site (isolated workspace) ([e75c448](https://github.com/event4u-app/agent-config/commit/e75c448d251d94fcb4c128ed49f493ffe7f85184))
* **learning-loop:** A4 ablation-mining + A5 near-miss clustering ([5c5e02d](https://github.com/event4u-app/agent-config/commit/5c5e02d6ba561c2aecce5fc1340fa200ff5f6fa1))
* **subagent:** A3 eval harness — production-validator Gate-A corpus (reuses #699 bench) ([07e6fbf](https://github.com/event4u-app/agent-config/commit/07e6fbf97a9476b2585c117a91805c10a7a0b9ec))
* **subagent:** add verdict_changed_outcome telemetry field (A3) ([247d80d](https://github.com/event4u-app/agent-config/commit/247d80d5cad6c406ef4198309b172d9b17e97a4a))
* **subagent:** A2 install-completeness gate — wedge-only distribution ([e2c952c](https://github.com/event4u-app/agent-config/commit/e2c952cad52cf5956078427921e782e20f231ed6))
* **subagent:** native-CC projection to .claude/agents/ (A1) ([3e3a92d](https://github.com/event4u-app/agent-config/commit/3e3a92d2851f08cab9a6ee065d7c148d48168499))
* **subagent:** 5th discovery category via Option B (A1, ADR-109 Amendment 1) ([a8a9788](https://github.com/event4u-app/agent-config/commit/a8a97883d524abd971bf7c8b8d7c6b4451b51f17))
* **subagent:** add the subagent-v1 determinism lint (A1) ([039392f](https://github.com/event4u-app/agent-config/commit/039392f10e187eba85f7adc8a8cef28e67271030))
* **subagent:** ratify the subagent-v1 contract (A1 keystone) ([5a1147a](https://github.com/event4u-app/agent-config/commit/5a1147a3868a3e757ab00516826dfac2ceb8961a))
* **proof:** generated, self-verifying proof page (roadmap B4, proof-page half) ([d30ab58](https://github.com/event4u-app/agent-config/commit/d30ab58e942ed09f70df21939f05d7f4349e36a1))
* **wedge:** production-validator as a 30-second single-install subagent ([05ffd5b](https://github.com/event4u-app/agent-config/commit/05ffd5b1b79eef21adaab53e7bc9c98df5056dff))
* **personas:** add performance-engineer, data-integrity, production-validator ([d867e9e](https://github.com/event4u-app/agent-config/commit/d867e9ee7babfa64a82a4f8c24863f56c4ef0d77))
* **claims:** Claims-Ledger gate — no public claim without resolvable evidence ([6a0f076](https://github.com/event4u-app/agent-config/commit/6a0f076d8fb2c1843975ae5d3c072463cc93942e))
* **orchestration:** capture realized-cost telemetry ([6abd2ce](https://github.com/event4u-app/agent-config/commit/6abd2ceeb3f4960b60a8acaa55a8287a0913abfb))
* **auto-dispatch:** tighten classifier + adopt parallelizable frontmatter ([62c6fc0](https://github.com/event4u-app/agent-config/commit/62c6fc02f146acaacafa5488e691b1720bf1eff5))
* **legal:** add reference-resolution gate to legal-safety-floor lint ([7a4eb70](https://github.com/event4u-app/agent-config/commit/7a4eb70deb42c2405ca8cc668cfe30941a81096f))

### Bug Fixes

* **commands:** shorten optimize-project trigger_context to schema max (240) ([09c9a9f](https://github.com/event4u-app/agent-config/commit/09c9a9f32f3d988bdf3cb593ae138bb033500f2a))
* **tests:** schema v2 in router shape test; flow-style workspaces in fm_workspaces fallback ([0d39ac0](https://github.com/event4u-app/agent-config/commit/0d39ac05fd04db45e28461a4d1ef87fa90e46d24))
* **rules:** drop YAML comments inside triggers blocks (lenient frontmatter parser) ([fc46065](https://github.com/event4u-app/agent-config/commit/fc46065929be98d06fef7c6c854bdaab728b8772))
* **ci:** make discipline_profile a real template key; host-independent codex tests; regen proof page ([ab003ee](https://github.com/event4u-app/agent-config/commit/ab003eed71b20be36c04691353959c1aa607d4b1))
* **scripts:** strict-TS index guards + replay-mode guard in hot-context hook ([2cda3da](https://github.com/event4u-app/agent-config/commit/2cda3da40f38cf358221e44f88bb1e1d3fa9efcd))
* **rules:** keep direct-answers under concentration cap; extract reply-close to a mechanics context ([cd5359d](https://github.com/event4u-app/agent-config/commit/cd5359d0df26bd2d7b014b6c7fa5cad7886f9e71))
* **tests:** gate smoke_path_resolution on the generated .augment projection ([5bc9dbb](https://github.com/event4u-app/agent-config/commit/5bc9dbb5d41b20b4a73f263aca2830e7c74e38eb))
* **roadmaps:** stop truncating multi-line blocker field values; retrofit real blockers ([3eb0a59](https://github.com/event4u-app/agent-config/commit/3eb0a5992a0515785e254511f2a9e40896a5f22c))
* **templates:** drop legacy .agent-src.uncondensed path from the command-template lint step (ADR-051 guard) ([6484d4b](https://github.com/event4u-app/agent-config/commit/6484d4b9364e6ecb69e460cf4feb65d6980b4ac0))
* **condense:** re-mark dependency-stale command hashes; harden /create-pr with verified-status gate ([7b02229](https://github.com/event4u-app/agent-config/commit/7b02229d0980cf4be1a26c1c1ae9ff474a56ee6c))
* **ci:** align projection-fidelity fixture with omit-defaults policy; regen command-flows ([878ad15](https://github.com/event4u-app/agent-config/commit/878ad15ad7e965472f941ab4eef3e58ce195cb06))
* **config:** close six config-drift gates ([28903f0](https://github.com/event4u-app/agent-config/commit/28903f08504fbecd0dbabd5bfcca7ac89f03c2bc))
* **skills:** migrate runtime execution commands off python3 ([bd92c2f](https://github.com/event4u-app/agent-config/commit/bd92c2fecc9c1c5a58f2899d58240df942b1cea7))
* **tests:** sandbox HOME in both install-test harnesses ([2dc7bbf](https://github.com/event4u-app/agent-config/commit/2dc7bbfc4e10221fed105b784439b6c44315746b))
* **scripts:** repair four py2ts/restructure-stale linters and their pinned tests ([d3259ff](https://github.com/event4u-app/agent-config/commit/d3259ffe152ffbfccff1eab6f1803df8e28552bf))
* **docs:** fold agents-layout pointer into the root-layout bullet (thin-root 3000-char cap) ([9f1a313](https://github.com/event4u-app/agent-config/commit/9f1a3136b71e9461425a0393aac22b97e933fb26))
* **ci:** strict-index typecheck in new gate scripts, regenerate overlap baseline, refresh dependency hashes ([5dc4a3b](https://github.com/event4u-app/agent-config/commit/5dc4a3b2818497d652f86578c9050b01cee147e2))
* **gitignore:** ignore generated .claude/agents/, fix stale minimal-template negation, untrack ignored bench outputs ([9d76ef6](https://github.com/event4u-app/agent-config/commit/9d76ef6edb44c250101373c2630234161e659b4e))
* **test:** accept string|undefined env values in RunOpts ([7e26b27](https://github.com/event4u-app/agent-config/commit/7e26b27d8829d1620959a835308086fe3842175c))
* **test:** accept readonly string[] in runInProc argv param ([46f2835](https://github.com/event4u-app/agent-config/commit/46f283529da95876bc41a3bbaf54076f032df9f5))
* **knowledge:** satisfy the repo's strict typecheck + lint on the new scripts ([6937f43](https://github.com/event4u-app/agent-config/commit/6937f435d4949afc8e96a2e485999c047e2b744c))
* **ci:** unblock PR gates — discovery registration + stale condensation hashes ([860f31e](https://github.com/event4u-app/agent-config/commit/860f31e3d60eea4e37ee51ae814413eab4f25629))
* **measure:** drop literal dead-path reference from doc comment ([995c5e6](https://github.com/event4u-app/agent-config/commit/995c5e64e131d76035ac30aa8ea99fb2c27dda07))
* **roadmap:** restore checkbox flips lost in the archival rename ([dc855e8](https://github.com/event4u-app/agent-config/commit/dc855e846b45ac4b77151a8bf3f98c2ad58048a3))
* **scripts:** repoint measure_patterns + measure_skill_reduction to src/skills ([5f05ef6](https://github.com/event4u-app/agent-config/commit/5f05ef618ec719653eba495e6d2a2e88a556cb15))
* **test:** drop env-dependent no-branch case from print_required_checks snapshot ([c0491af](https://github.com/event4u-app/agent-config/commit/c0491af455c6ba12ee3cd932c5e8884b68281b0b))
* **hooks:** drop legacy-path mention from roadmap-hook not-found message (ADR-051) ([459fbac](https://github.com/event4u-app/agent-config/commit/459fbacccdc471f5d5e7c05aa4127e555b752f02))
* **proof-demo-ci:** install the task binary before running the demo commands ([5ba15ae](https://github.com/event4u-app/agent-config/commit/5ba15ae7d411d530c713422c5f1bf985bc8b4a2a))
* **hooks:** roadmap-progress hook regenerates the edited file's own repo + fixes the standalone fallback ([3adee0e](https://github.com/event4u-app/agent-config/commit/3adee0e63f74d6e52db58d2d77111750ebc366ba))
* **site-ci:** build the site on Node 22 (Astro 7 requires >=22.12) ([5a11d5b](https://github.com/event4u-app/agent-config/commit/5a11d5b919d71063d273717bcc078288320ab213))
* **site:** add missing favicon.svg (caught by the new link checker) ([6a7a09f](https://github.com/event4u-app/agent-config/commit/6a7a09f0610ed2c6a55df2950466f83bd5a3c8ec))
* **capability-matrix:** register generate_subagent_host_contexts ([819f244](https://github.com/event4u-app/agent-config/commit/819f244a75e2fe37c5e7a21a3449bd79bedbba2e))
* **learning-loop:** drop unused fileURLToPath import in A5 (eslint) ([3b0ab0d](https://github.com/event4u-app/agent-config/commit/3b0ab0df330dd9edf069b7d08416226d610c8e60))
* **council:** AnthropicClient joins all text blocks (extended-thinking models) ([bdd795b](https://github.com/event4u-app/agent-config/commit/bdd795bf70f7c94155d6777adaeaeb328204549b))
* **subagent:** register generate_claude_subagents in the capability matrix ([c2010b7](https://github.com/event4u-app/agent-config/commit/c2010b78d97869889058007c5e0d2cd50901ef62))
* **tests:** make memory tests clock-robust (drift time-bomb) ([6fabfcb](https://github.com/event4u-app/agent-config/commit/6fabfcbc11bf9b2da7a9bb66cf53f6c8c150c4b3))
* **claims:** satisfy tsc exactOptionalPropertyTypes in check_claims ([391004b](https://github.com/event4u-app/agent-config/commit/391004ba8fbb0229812872944e7aeb3164e81854))
* **persona-governance:** reword comment to avoid literal legacy path token ([c255c31](https://github.com/event4u-app/agent-config/commit/c255c31d3ccfd66bbf6a40f26f1d0eebf5993fdf))
* **persona-governance:** scan src/ not the dead legacy tree ([1ecb1db](https://github.com/event4u-app/agent-config/commit/1ecb1db4b5a95c4483de066960d9c0e967dcc8eb))
* **schema:** minimal parallelizable add, revert reserialize churn ([d7c679f](https://github.com/event4u-app/agent-config/commit/d7c679f1bb5fb0c31701443fbb90c93c1a010758))
* **subagent-orchestration:** resolve broken command refs + fold cost levers ([8169faf](https://github.com/event4u-app/agent-config/commit/8169faf8608a12f4041b76dc455ab86762b6fdad))
* **release:** correct and automate project-template version-pin gate ([0a414b7](https://github.com/event4u-app/agent-config/commit/0a414b7e8bcd0b41a8388012f00f7e0b318efcb2))

### Performance

* **ci:** isolate workspace cluster into its own job; exclude both heavies from shards ([a575b4d](https://github.com/event4u-app/agent-config/commit/a575b4deee006392e085dd472469d482e763046a))
* **ci:** split whole-tree gates into a dedicated static-checks job ([8bfddad](https://github.com/event4u-app/agent-config/commit/8bfddad95119e68fb1c5f9dfca81f291a2e3c8d5))
* **ci:** isolate golden suite into its own job; 4-shard the rest ([f56363a](https://github.com/event4u-app/agent-config/commit/f56363ae7803ccb10538e17453a6b55579a3b956))
* **ci:** shard Node Tests vitest across 4 parallel runners per OS ([18cf2f3](https://github.com/event4u-app/agent-config/commit/18cf2f3ac14d277a8bc6035883d7e1ab6ca585a7))
* **test:** shard golden replay + in-process replay_hook ([2841a42](https://github.com/event4u-app/agent-config/commit/2841a4205d5d82a5475eadb278c1210c189f275e))

### Documentation

* **roadmaps:** flip 11 freshly-verified acceptance criteria; record field-corpus export progress ([9a89315](https://github.com/event4u-app/agent-config/commit/9a893157931039dcb31ea56119a8045d140f5c32))
* **roadmaps:** link discipline-profile-tiering into the program tracking table ([30c3135](https://github.com/event4u-app/agent-config/commit/30c3135cb8efadb261987d0b214813ed0307eb5c))
* **roadmaps:** complete structured-blocker fields (rule 20) ([c98fbd7](https://github.com/event4u-app/agent-config/commit/c98fbd7b4beda67ff72796a66c19aa721bbd96f0))
* **roadmap:** add road-to-flow-learnings (council-cut harvest plan) ([b5621df](https://github.com/event4u-app/agent-config/commit/b5621df1e986685952db85fc25cb3085ecca68bd))
* **contexts:** consumer-scoping misclassification audit record + router v2 retag propagation ([998bab7](https://github.com/event4u-app/agent-config/commit/998bab7762a31bffbf478407210c359cbcf9eccd))
* **benchmark:** full-corpus P1 gate — essential lift replicates, family-scoped, 1.71x ([e893277](https://github.com/event4u-app/agent-config/commit/e89327760c9807bd3776ec9e99e68fba3cbae28a))
* **roadmaps:** token-program roadmaps + council integration verdict ([28c4f38](https://github.com/event4u-app/agent-config/commit/28c4f38c628ebfbeba1425123e08f5fa25214e20))
* **roadmaps:** council verdict + roadmap for discipline-profile tiering ([ca4be8a](https://github.com/event4u-app/agent-config/commit/ca4be8a09597215687c8a8c7783d877b83dcbe0b))
* **benchmark:** pin the cost-factor sweep — ~95% of the weak-host lift at ~3.3x ([45a3fbf](https://github.com/event4u-app/agent-config/commit/45a3fbf14c6590f48ea89959776fa1a34790b831))
* **knowledge:** honest second-brain framing + index section counts ([facbc60](https://github.com/event4u-app/agent-config/commit/facbc600d204fb41cdf0bb8c8ef82e28c1af58dc))
* **migration:** final quality report — py2ts migration closed at parity-or-better; archive the roadmap ([b90ecc7](https://github.com/event4u-app/agent-config/commit/b90ecc704fd18d3591cdd55283043118bfb4bebe))
* **roadmaps:** complete and archive road-to-py2ts-teardown-completion ([0574da7](https://github.com/event4u-app/agent-config/commit/0574da7274db348a5414b20f28271e0fbda41ddd))
* four micro-sharpenings from the frontier-host pattern review ([382a83c](https://github.com/event4u-app/agent-config/commit/382a83c4d7a3b86078be15315b0a0052b602df81))
* **guidelines:** volatile-fact freshness table generalizing the git-live-state clause ([9026941](https://github.com/event4u-app/agent-config/commit/902694151d38b83100a0424a4ec90d43d2334e25))
* **roadmaps:** flip Phase 12 Steps 1-4 + teardown-completion audit/workflow items to done ([8fbb80a](https://github.com/event4u-app/agent-config/commit/8fbb80a54d3032e2c7aeb4c058ae703ad3b08817))
* **py2ts:** sweep every python3 invocation to scripts-run / node across skills, rules, commands, and docs ([65fa12b](https://github.com/event4u-app/agent-config/commit/65fa12bc6601ff035dc22ef3dd74369a69fc4940))
* **contracts:** declare stability frontmatter on ten contracts ([390f772](https://github.com/event4u-app/agent-config/commit/390f7726b580b2f7a4383ae7fd2cc23071411844))
* **contexts:** sweep existing locks with scope + revisit-if ([c89e65e](https://github.com/event4u-app/agent-config/commit/c89e65eb91d23be35475d5ca637e4f0362b2e4af))
* **design:** fold corpus nuggets and cross-refs into the design cluster ([e90cee5](https://github.com/event4u-app/agent-config/commit/e90cee53c55ab7e3803771e8c6d0aec4b7e0abff))
* agents-layout pointer, consumer inbox docs, changelog + roadmap ([cad13f9](https://github.com/event4u-app/agent-config/commit/cad13f993143203f41c45119080306c8a6782975))
* **evidence:** final timing note on the fast-test-layer work ([1c1cbea](https://github.com/event4u-app/agent-config/commit/1c1cbea708ed6affe73097374f9e02e3e56dc31b))
* **roadmap:** road-to-fast-test-layer ready for execution ([146c655](https://github.com/event4u-app/agent-config/commit/146c6554be57130819a5045cd77169cf55c82a8b))
* **roadmap:** draft road-to-fast-test-layer (in-process CLI rigs) ([7aac95c](https://github.com/event4u-app/agent-config/commit/7aac95c8f15dec4317b5c613de706f44d06a7f9e))
* **knowledge:** close road-to-knowledge-system — all 6 phases + acceptance criteria verified ([20cb1f8](https://github.com/event4u-app/agent-config/commit/20cb1f8cf538c282d6c38001eed31f37efe4bf4d))
* autonomous roadmap execution guide + settings precedence note ([2325f04](https://github.com/event4u-app/agent-config/commit/2325f04c5b763b309d3ec5c5f3f45ed0e2cb5880))
* **evidence:** D1 audit of the py2ts test-layer purge ([ecf21eb](https://github.com/event4u-app/agent-config/commit/ecf21eb2b72918c34da092f086fe8f1339ce6851))
* **roadmap:** close E1–E3 by decision, complete + archive the roadmap ([df6ea56](https://github.com/event4u-app/agent-config/commit/df6ea566691140ac779a05c48f886878a083de88))
* **roadmap:** close B9 + D1–D4 by maintainer decision (not evidence-verified) ([1a5f56e](https://github.com/event4u-app/agent-config/commit/1a5f56ef6d0651abbdb7e0bc4dee199fdcf2c847))
* **roadmap:** record B9 instruments built (study still needs external devs) ([ec45c96](https://github.com/event4u-app/agent-config/commit/ec45c969430bc114c1ffb66f27bbc6cae9b48077))
* **roadmap:** mark B4 done (Pages deploy wired), regenerate dashboard ([53c3164](https://github.com/event4u-app/agent-config/commit/53c3164e68007064417aa87071b5a866c23a9d51))
* **roadmap:** record B4 catalog page surfaced on the site ([4361ba5](https://github.com/event4u-app/agent-config/commit/4361ba581fef6ff766a6a5ba1c8294dba7b6c0a9))
* **roadmap:** mark B8 done (deterministic demo; wedge live-demo deferred) ([50b84d2](https://github.com/event4u-app/agent-config/commit/50b84d283f9ea9e08e2dd5c70a30a70e8ef5bf86))
* **roadmap:** record B8 media-tooling prereq gate landed ([1a9663d](https://github.com/event4u-app/agent-config/commit/1a9663dd814deb1d27ce27b0ce9c9b9388d073eb))
* **roadmap:** record B4 part-4 (site CI link-checker) done ([07b0c23](https://github.com/event4u-app/agent-config/commit/07b0c23bc87a943dcadb1ca552f35c9519027421))
* **roadmap:** mark A3 done (honest null), regenerate progress dashboard ([d4ab307](https://github.com/event4u-app/agent-config/commit/d4ab307669228ccd81f8cbb0d81aead2116a84da))
* **bench:** record A3 production-validator Gate-A eval — honest null ([45f01f0](https://github.com/event4u-app/agent-config/commit/45f01f0e1488b6038bdc10ae8570a8065589d079))
* **roadmap:** mark A1 keystone done, regenerate progress dashboard ([dff535b](https://github.com/event4u-app/agent-config/commit/dff535bd7e3c275d58ab84d0d992226a2dfc2b0e))
* **roadmap:** mark B7 done, regenerate progress dashboard ([98e7573](https://github.com/event4u-app/agent-config/commit/98e75730d0120abf9c0646ea935680d3c7e8b854))
* **roadmap:** B6 done (per-skill honest-null gaps) + regen dashboard ([6acf89a](https://github.com/event4u-app/agent-config/commit/6acf89a7fae284faf4309eecad6ad522b346cb9f))
* **roadmap:** B4 Starlight site stood up; ignore site build artifacts ([ed8a4a3](https://github.com/event4u-app/agent-config/commit/ed8a4a3b806c90e181419e95f9bf4da74642e64e))
* **roadmap:** A4 + A5 done (learning-loop mining) + regen dashboard ([de87b0b](https://github.com/event4u-app/agent-config/commit/de87b0b336af1e6e04326f25fae332c2534a00f8))
* **roadmap:** A3 partial — eval harness delivered, billable run operator-gated + regen ([5473add](https://github.com/event4u-app/agent-config/commit/5473add3f000c1b1f598b91963132d3b0f54241d))
* **roadmap:** A2 done (wedge-only distribution gate) + regen dashboard (97/162) ([f075762](https://github.com/event4u-app/agent-config/commit/f07576249a1b0df3e758a6dd6d9b07fc57a9a2ce))
* **roadmap:** capture tier-conditional discipline-rule loading lever (Phase 10) ([510762f](https://github.com/event4u-app/agent-config/commit/510762fa3e0700b2f9c4eb665f85eb44f7108286))
* **roadmap:** fold 2026-07-04 gap-hunt additions; A6/A7/A6-followup done ([2c11630](https://github.com/event4u-app/agent-config/commit/2c116301a06acbe61fcd5b0c430eeb2c8a409b5b))
* **bench:** record A6 strong-host honest-null; benchmark.md carries both hosts ([77ea911](https://github.com/event4u-app/agent-config/commit/77ea91191133a27a2e37074625ac5667938437eb))
* **roadmap:** A1 5th-discovery-category landed (Option B) + regen dashboard ([548fb69](https://github.com/event4u-app/agent-config/commit/548fb69d25d65a937f712f3e91eaadad5c7c17ea))
* **roadmap:** B1/B2 done, A1 partial (contract ratified) + regen (92/154) ([398002d](https://github.com/event4u-app/agent-config/commit/398002d7dd6b8ae4b061a24886c26e940bf9dfec))
* **roadmap:** flip B1/B2 done (artifacts merged #701/#702) + regen dashboard ([0ffd69d](https://github.com/event4u-app/agent-config/commit/0ffd69dbc734062bafe3e3f0feeaa45d1150a808))
* **roadmap:** flip B0/C2/B5 done + regen dashboard (90/154) ([9bd8d87](https://github.com/event4u-app/agent-config/commit/9bd8d87ad38ae7b481ea1e6b99962aff22b3d4f8))
* **positioning:** adopt Option 1 H1 + honest-provenance note (B0, B5) ([8a2dbaa](https://github.com/event4u-app/agent-config/commit/8a2dbaa506200509c4b47b04963ff1b2153e3aaa))
* **roadmap:** flip B5/C1 done, annotate C2 partial + regen dashboard ([c8540df](https://github.com/event4u-app/agent-config/commit/c8540df69a8ff1367c7ca7d0fc11c8d2e934d54f))
* **readme:** wedge-first quickstart + proof-page link (B6) ([c7217f3](https://github.com/event4u-app/agent-config/commit/c7217f3a15c68cb5f3991957bc3ed141b89bbc3c))
* **distribution:** add awesome-list + launch-story drafts (B5) ([c192ca0](https://github.com/event4u-app/agent-config/commit/c192ca00286934fd608503aa3c9095f583fc1c1c))
* **roadmaps:** master roadmap — final state + market readiness ([67348fa](https://github.com/event4u-app/agent-config/commit/67348fa7a8585ba0e1decfd071443e5a0a14a3ed))
* **roadmaps:** subagent value realization — delivered + archived ([dac3bbe](https://github.com/event4u-app/agent-config/commit/dac3bbeb19ae4c73acbeb2821c2014c9e719bee5))
* **roadmaps:** release-gate-hardening roadmap (delivered, archived) ([aec2a32](https://github.com/event4u-app/agent-config/commit/aec2a324aaa20ef3d5b465e87b14ae36847378e6))
* **roadmap:** re-scope py2ts teardown to post-merge cleanup + embed 2026-06-29 council finish strategy ([11f100d](https://github.com/event4u-app/agent-config/commit/11f100da20598b120170b47e999b9f905f7d5bf8))

### Refactoring

* **kernel:** nudge direct-answers under the 12% concentration cap ([bb214d8](https://github.com/event4u-app/agent-config/commit/bb214d84306db02ccb44f7a8151e75d12bbfaad0))
* **kernel:** telegraph-trim the 9 contract rules back under the 26k bucket ([112b688](https://github.com/event4u-app/agent-config/commit/112b688634660d46f55dab7fe9098e56ceea35ee))

### Tests

* **py2ts:** disable the python-free-env shim; guard the 2 live-python harness sites; add gated council live smoke ([7c93653](https://github.com/event4u-app/agent-config/commit/7c93653262de622e74bb4f198510fdc99996babb))
* **py2ts:** convert all 36 remaining python-parity rigs to tsx-only intent tests; strip python from shared helpers ([db06760](https://github.com/event4u-app/agent-config/commit/db06760e7e3365967e5c5511f11f29c584de650e))
* **gitignore:** fixture-repo suite for the sync-gitignore fix detection passes; archive completed roadmap ([9b99dee](https://github.com/event4u-app/agent-config/commit/9b99deed875f76faf2503d44ef1f55587d40078e))
* **scripts:** collapse determinism double-runs to single tsx spawn ([b0032b3](https://github.com/event4u-app/agent-config/commit/b0032b3607bf05d003ca6575c53a95a258a8d077))
* **scripts:** fix inventory_meta_layers to a determinism contract ([67a7484](https://github.com/event4u-app/agent-config/commit/67a7484ea62d2299d3ed5ee48c2133b9f4ef4b47))
* **scripts:** drop stale '(python3 vs tsx)' labels from converted rig titles ([4ac5e1d](https://github.com/event4u-app/agent-config/commit/4ac5e1d9366bfaf99e9361ca3cab21a8444f31cf))
* **scripts:** depythonize chat_history + skills_design_tokens_tokens ([6e6e683](https://github.com/event4u-app/agent-config/commit/6e6e6835ac3ada6defe198e8c5bece75c17c86c6))
* **scripts:** depythonize cli_python/workspace_drive + knowledge_ingest ([8059b5b](https://github.com/event4u-app/agent-config/commit/8059b5bec5cb76fd4b5aa10aa36bc54608ad357e))
* **scripts:** depythonize mcp_parity_smoke ([fd47395](https://github.com/event4u-app/agent-config/commit/fd473958a583fdb03637a1c6d7c25d3004d49b1e))
* **scripts:** depythonize _lib_bench_ab_scoring_v2 ([2a023b8](https://github.com/event4u-app/agent-config/commit/2a023b83d43ca61cdcea0abd01b41a39cbcc63c5))
* **scripts:** depythonize bench_ab_run / bench_ab_tracka_run / bench_ab_v2_stats ([1ff9bbe](https://github.com/event4u-app/agent-config/commit/1ff9bbe5e4fb209954b41e0e596906bda04d838f))
* **scripts:** depythonize py_random / score_skill_selection / pack_mcp_content / audit_likelihood ([9ff01ce](https://github.com/event4u-app/agent-config/commit/9ff01ce9dfca2f02c7512fee25a2834f075e72c8))
* **scripts:** depythonize check_condensation / apply_modules_config / cross_repo_retrieve / validate_discovery_manifest ([2b43eea](https://github.com/event4u-app/agent-config/commit/2b43eeadca084c151fd4e293b47f33d46e376440))
* **scripts:** depythonize lint_showcase_sessions + migrate_frontmatter_defaults ([9b2dfea](https://github.com/event4u-app/agent-config/commit/9b2dfea4510ef090350343524314771eb74071c0))
* **scripts:** depythonize check_no_conflict_markers / lint_skill_originality / check_no_external_sources ([f6cb383](https://github.com/event4u-app/agent-config/commit/f6cb383e2005a6e1983570f5c87e2e60b5354022))
* **scripts:** depythonize lint_agent_security + probe_projection_fidelity ([dc0a4c8](https://github.com/event4u-app/agent-config/commit/dc0a4c88c8b75195ac940c269a6c96aacdd5b495))
* **scripts:** depythonize injection_scan_hook + check_council_config_location ([98a890a](https://github.com/event4u-app/agent-config/commit/98a890a4ab41ab2e597ad131488ed0f498e03874))
* **scripts:** depythonize check_{structural_breaking,trigger_evals,surface_tiers} ([8dff373](https://github.com/event4u-app/agent-config/commit/8dff3737cfd2dda7b4dfddc49940de2a87236374))
* **scripts:** depythonize audit_overlap / lint_empty_roadmaps / inventory_meta_layers ([3200567](https://github.com/event4u-app/agent-config/commit/320056786271db32acfa8f8d9922e60ace06a68a))
* **scripts:** depythonize knowledge_global parity rigs ([c70da3e](https://github.com/event4u-app/agent-config/commit/c70da3ec4e9b1207bccb999bc36c84aa31a0f174))
* **scripts:** depythonize condense/skill_linter/validate_frontmatter/lint_marketplace ([5444a2a](https://github.com/event4u-app/agent-config/commit/5444a2a1ea725e38a7a8bfcee076b86e38404288))
* **cli:** depythonize cmd_* parity rigs ([155ba63](https://github.com/event4u-app/agent-config/commit/155ba63fe63a34cdb393dbcc7538d07dff7a1c4b))
* **scripts:** depythonize linter/manifest parity rigs ([50fb8ff](https://github.com/event4u-app/agent-config/commit/50fb8ff585d46fe2e8d743837df3fc260b06a630))
* **py2ts:** convert measure_{density,projection_bytes,markitdown_lift} to structural contracts ([035e9b2](https://github.com/event4u-app/agent-config/commit/035e9b21b5ad670496324451fe9796d8dc4d5606))
* **py2ts:** convert the shipped skills UI-script parity rigs to tsx-only contracts ([a4c74e9](https://github.com/event4u-app/agent-config/commit/a4c74e987e6cbc4259930e9ccae189e8c3a57291))
* **py2ts:** convert validator/generator parity rigs to drift-free contract tests ([044ac3c](https://github.com/event4u-app/agent-config/commit/044ac3ca4db203c86f04b0fd67c4b745edd9a9fc))
* **py2ts:** convert linked_projects_list + drop hooks_status python probe ([2b13c87](https://github.com/event4u-app/agent-config/commit/2b13c8733e1916ba38cd96c6d2a4305c1aa61ce6))
* **py2ts:** convert the corpus-generator parity rigs to drift-free contract tests ([b25fe77](https://github.com/event4u-app/agent-config/commit/b25fe77291f99c78fc0052f4f829af702be8c361))
* **py2ts:** convert the prediction-pool parity trio to python-free contract tests ([4dde560](https://github.com/event4u-app/agent-config/commit/4dde56075c35d21f59bbb4fba66bee37160b772f))
* **py2ts:** convert the explain_last parity trio to python-free contract tests ([86a0032](https://github.com/event4u-app/agent-config/commit/86a00323873dfd0eaa02e110b0b59f67b899eb4a))
* **py2ts:** de-pythonize 4 mixed parity test files ([7b8c377](https://github.com/event4u-app/agent-config/commit/7b8c377f4766b7a9788d9dac31c50728d306e4c8))
* **bench:** add Laravel/PHP discipline trap to the v2 corpus (A7) ([3d77393](https://github.com/event4u-app/agent-config/commit/3d773936e5946b9b9b1ad8f7aaa5cc2f6c1bb8cd))
* **subagent:** type frontmatter helper as Record<string, YamlValue> ([1d2cbbd](https://github.com/event4u-app/agent-config/commit/1d2cbbdcd6bb21bca86b9824138570a98a880ebd))
* **bench:** delegable-task orchestration corpus + telemetry arms ([88e2460](https://github.com/event4u-app/agent-config/commit/88e246074ac731ddf9d3f2563e77fb01b52554df))
* **py2ts:** convert the templates_* parity cluster to python-free intent tests ([8d11625](https://github.com/event4u-app/agent-config/commit/8d116255c256ed1a79017f2c01fd3dd424ca6d56))

### CI

* **py2ts:** remove the 3 migration-scaffolding workflows ([d6e83c4](https://github.com/event4u-app/agent-config/commit/d6e83c43f691e0455ce8f3ef13ceed083ede3d8c))

### Chores

* **build:** compiled dist/install/preflight.js (tracked build twin) ([8e313d6](https://github.com/event4u-app/agent-config/commit/8e313d62eb9c2b152fd14235a302b3b4ed429164))
* **regen:** counts, index, catalog, capabilities, command-flows for /optimize-project ([1a6239f](https://github.com/event4u-app/agent-config/commit/1a6239ffb78f7fafafb12aa4b88b3d8791eab3c1))
* **bench:** re-anchor kernel-prefix snapshot — frontmatter-only kernel metadata change ([eb2c4e7](https://github.com/event4u-app/agent-config/commit/eb2c4e7194129d5fee8eab7f41e6aaec65985b5f))
* **lint:** re-bump leakage allowlist lines after frontmatter flow-styling ([b2beecf](https://github.com/event4u-app/agent-config/commit/b2beecf99596a84f2161e99c6d545dc33b17546b))
* **bench:** refresh token baseline (stale since Phase-0 rig) ([0849e6d](https://github.com/event4u-app/agent-config/commit/0849e6dab25540b97b0bf6b6beabe332502149a3))
* **rules:** flow-style packs on no-cheap-questions — stay under the budget allowlist ceiling ([5d7fbda](https://github.com/event4u-app/agent-config/commit/5d7fbda104f1ea95ae9de00c2882b4bdee6b1d02))
* **condense:** refresh hashes after origin/main merge (double-edited rule files) ([6274ced](https://github.com/event4u-app/agent-config/commit/6274cedd1ad91ec74a37458b5b2441d6cc33c821))
* **rules:** compact kernel workspace tags to flow style (budget concentration) ([3cae963](https://github.com/event4u-app/agent-config/commit/3cae963e83076360710b4aa34d261ea6eb8d3507))
* **lint:** bump framework-leakage allowlist line numbers shifted by rule frontmatter edits ([bbef7fc](https://github.com/event4u-app/agent-config/commit/bbef7fc387462c11eaae065845236a9e549debd0))
* **packs:** regenerate pack manifests + READMEs after rule pack moves ([713bfcf](https://github.com/event4u-app/agent-config/commit/713bfcf2bb64c98668568e98086c249babc9ddb8))
* **condense:** refresh effective hashes for commands referencing edited rules ([558454b](https://github.com/event4u-app/agent-config/commit/558454bfe520eb70ec47246f28e18d3ca505e9e7))
* **rules:** misclassification audit D — media governance reaches media-generating consumers ([6a44d80](https://github.com/event4u-app/agent-config/commit/6a44d8055e14c674a21440bcdf37849cfe22c4a1))
* **rules:** misclassification audit C — engineering-surface rules reach dev consumers ([0a28e81](https://github.com/event4u-app/agent-config/commit/0a28e8163f65986396a9fc4529f1fa60beba9677))
* **rules:** misclassification audit B — universal behavior rules ship to every consumer workspace ([dd9a56b](https://github.com/event4u-app/agent-config/commit/dd9a56b3a6a7de7ef7c04e16e4553ae5b508d88b))
* **rules:** misclassification audit A — kernel rules get full consumer workspace tags ([84fd5db](https://github.com/event4u-app/agent-config/commit/84fd5dbc880761708b1068bfd97ed153a4aede3b))
* **condense:** re-anchor stale review-routing condensation hash ([4ca6616](https://github.com/event4u-app/agent-config/commit/4ca66168a67e81bef56cf4c0610467d54707b55d))
* **contracts:** regenerate file-ownership matrix ([b9f2412](https://github.com/event4u-app/agent-config/commit/b9f2412ee19a2fb488818350756b2a4bc9ab95c7))
* **roadmap:** second-brain roadmap executed + council verdict recorded ([a137cac](https://github.com/event4u-app/agent-config/commit/a137cacba58907c4501b32f5e1f9dd8e2dde0bb2))
* **roadmaps:** execute road-to-blocker-visibility; annotate active roadmaps with blockers ([b6046a9](https://github.com/event4u-app/agent-config/commit/b6046a97e706f17aee3b22fa04e1e7baa5899691))
* **roadmaps:** resolve kernel-augment-budget blocker after PR #750 ([c3e3f84](https://github.com/event4u-app/agent-config/commit/c3e3f8432ba53004925c64fa502f5bd7666474cc))
* **smoke:** update kernel-smoke baseline to the 9-rule kernel ([f12f428](https://github.com/event4u-app/agent-config/commit/f12f428aea1c47daf4cab812b20777dcf028d71b))
* regenerate file-ownership matrix for lint_roadmap_blockers.ts ([05fd1be](https://github.com/event4u-app/agent-config/commit/05fd1be583dcb448ab34ab9db5b0412358268209))
* **ownership:** regenerate ownership matrix post-merge ([4ba41ee](https://github.com/event4u-app/agent-config/commit/4ba41ee8410bff6854e9c18e3cdaed88513a0ec7))
* **rules:** strip defaulted source field from the two new main rules ([7d8556b](https://github.com/event4u-app/agent-config/commit/7d8556b6a3633f1743eb1978f598f2102596c170))
* **index:** regenerate index/catalog after main merge ([9a9dfb5](https://github.com/event4u-app/agent-config/commit/9a9dfb57f200edb86010c3b79c0e0969074ffd8c))
* **hashes:** re-sync condensation hashes after the main merge ([5f4800e](https://github.com/event4u-app/agent-config/commit/5f4800e0dd95471a0fa69fb973c8f770f898958c))
* regenerate doc counts + meta pack manifest for the new content-quoting-floor rule ([6d264a6](https://github.com/event4u-app/agent-config/commit/6d264a681880bd956b2b629427960fd4901d2004))
* regenerate doc counts + meta pack manifest for the new decision-revisit-gate rule ([5ae060c](https://github.com/event4u-app/agent-config/commit/5ae060cdfab293c0c5334a379837fbed64c97e5d))
* **bench:** untrack projection-cost reports — regenerated every CI run ([7798fb2](https://github.com/event4u-app/agent-config/commit/7798fb220acc39eb205e366a04e7f90343806b30))
* **kernel:** re-anchor prefix baseline after concentration nudge ([9bdefdb](https://github.com/event4u-app/agent-config/commit/9bdefdb92f092323f3bc73f0fc39151501976fb8))
* **ownership:** regenerate ownership matrix ([3093575](https://github.com/event4u-app/agent-config/commit/3093575f779f8ebb0f17b67dbaa951b6426d36d4))
* **index:** regenerate index and catalog from trimmed descriptions ([f565173](https://github.com/event4u-app/agent-config/commit/f56517393ffa5bf5ff70882fbd551a5446a09991))
* **packs:** regenerate pack READMEs from the trimmed rule descriptions ([f7d3341](https://github.com/event4u-app/agent-config/commit/f7d334143409e54517cbbc59044aaf5db350bf46))
* **rules:** trim the longest auto-rule descriptions for the stub budget ([dd29458](https://github.com/event4u-app/agent-config/commit/dd29458a75fdf16fb6b3d94acec4422ea856c5e3))
* sync dist mirror for research:deep/report and recompute condensation hashes ([432cca5](https://github.com/event4u-app/agent-config/commit/432cca5ed32de13396c3329e444608286263df8a))
* recompute stale pre-existing condensation hashes (content unchanged) ([46b44e4](https://github.com/event4u-app/agent-config/commit/46b44e455d5680c437250976afbe2015cf6252d2))
* recompute stale pre-existing condensation hashes (content unchanged) ([65a9f56](https://github.com/event4u-app/agent-config/commit/65a9f56bfba33c7c0c9fc1245f39eacba83e3cec))
* **py2ts:** retire last Python test files and port glama smoke to TypeScript ([b9f5ab1](https://github.com/event4u-app/agent-config/commit/b9f5ab13c2498d3d894df5f2cff7cc54f6cb8a1d))
* **lint:** allowlist eight cross-stack/carve-out framework-leakage hits ([e953de1](https://github.com/event4u-app/agent-config/commit/e953de146f96cb4ba23f5eab932dcf2df9d6b270))
* **hygiene:** close the remaining local-only CI gates ([dc79203](https://github.com/event4u-app/agent-config/commit/dc792035ff9cc99e95542ae288f71e161de64bb7))
* **roadmaps:** archive completed road-to-decision-revisit-discipline ([5379aab](https://github.com/event4u-app/agent-config/commit/5379aabd53dfc6f5d8f5118a72afb0c95444b25e))
* **capabilities:** regenerate CAPABILITIES.yaml for the three new skills ([0d8e81e](https://github.com/event4u-app/agent-config/commit/0d8e81e5ca0fa2199fc31775eb3681abeec489b5))
* **index:** regenerate agents index and catalog for the three new skills ([8a9ae64](https://github.com/event4u-app/agent-config/commit/8a9ae648d0e27bae86f0379213168b5fdf2de64c))
* **roadmaps:** archive completed road-to-design-exploration-skills ([d42b75d](https://github.com/event4u-app/agent-config/commit/d42b75d5874d8e65c6053001355b9f5568436911))
* **roadmaps:** dashboard reflects tracked roadmaps only ([581e209](https://github.com/event4u-app/agent-config/commit/581e209f324d79368c6479e6c6d9ef1ede80b48a))
* **docs:** fix command-count messaging drift (162 → 165) ([b2b15e9](https://github.com/event4u-app/agent-config/commit/b2b15e96fe1c84115fc07b82eab93646fe6ea900))
* **roadmap:** complete and archive road-to-autonomous-roadmap-execution ([75d56ea](https://github.com/event4u-app/agent-config/commit/75d56eaf97921659b989a2033f96c7acb0bc834f))
* **condense:** refresh stale hashes for commands/fix/{portability,refs}.md ([d22e7ba](https://github.com/event4u-app/agent-config/commit/d22e7badeae12ad52d1b712d200c62fda4bc1a5d))
* re-trigger CI (pull_request workflows did not fire) ([895f208](https://github.com/event4u-app/agent-config/commit/895f208f39e6a8211cea98f14985f7960a091333))
* **condense:** refresh stale command hashes (pre-existing trunk drift) ([546e788](https://github.com/event4u-app/agent-config/commit/546e788a11fb1b0922d15c8ba7ed7fea369e3c3f))

## [7.5.0](https://github.com/event4u-app/agent-config/compare/7.4.0...7.5.0) (2026-06-29)

### Features

* **design-system-capture:** design-system.json import contract ([23fc06f](https://github.com/event4u-app/agent-config/commit/23fc06f44b77ab938929bcf47f92cf008c4dec26))
* **design-intelligence:** named design-canon grounding index ([1e0805e](https://github.com/event4u-app/agent-config/commit/1e0805eec2df4a46ec897d1593538811fc54cf8c))
* **react-shadcn-ui:** opt-in shadcn registry + MCP awareness ([26d1475](https://github.com/event4u-app/agent-config/commit/26d147516b20f7e5a26fa83fb39bce0f236dd57c))
* **design-intelligence:** taste dials, consistency locks + 4 detector rules ([42883dd](https://github.com/event4u-app/agent-config/commit/42883dd69575bbdb4e0a8fd7ffa915df15a58587))
* **design-review:** deterministic anti-slop detector + optional pre-edit hook ([5c77948](https://github.com/event4u-app/agent-config/commit/5c77948368d6a79e7848938c3ab8fe1f11ba9c25))
* **judges:** add judge-synthesis cross-judge aggregator; drop rubric:score (council) ([a0c3d12](https://github.com/event4u-app/agent-config/commit/a0c3d126a3b600bb32065543bddd13096d2b35a1))
* **token-saving:** mechanical slices — trim 15 at-cap skill descriptions + confirm/disposition steps ([06cb77d](https://github.com/event4u-app/agent-config/commit/06cb77dca0759c885b01b8d440482e49401daaa2))
* **security:** injection-defense pressure-corpus — confusables linter + defensive judge ([80abc16](https://github.com/event4u-app/agent-config/commit/80abc16ea78f4e4cbab52712a63831901e7b6851))
* **quality:** add judge-artifact-completeness skill with four rubric schemas ([ef0276a](https://github.com/event4u-app/agent-config/commit/ef0276ac0d8a72b60f4a1d85450bf0f42bfb5aa9))

### Bug Fixes

* **condense:** refresh stale commands/brand/tokens.md hash (pre-existing drift; sync-check-hashes) ([328a9a4](https://github.com/event4u-app/agent-config/commit/328a9a4b6af84280d8ea93b88a459aad22943ebe))
* **design-slop:** use .js import specifiers (tsc TS5097, Bundler resolution) ([8498f23](https://github.com/event4u-app/agent-config/commit/8498f2391b33d4d3171d6030984cef0d88eb382c))
* **design-slop-hook:** drop unused SLOP_RULES import (eslint no-unused-vars) ([6ef7465](https://github.com/event4u-app/agent-config/commit/6ef74652682b925138e8c585b9cffe7423baa457))
* **test:** satisfy noUncheckedIndexedAccess in judge_calibration guard ([1519880](https://github.com/event4u-app/agent-config/commit/15198806c5c4db33d21e337cd43bd7da8cd305ae))
* **judge-artifact-completeness:** shorten description to ≤200 chars (skill linter cap) ([053d07f](https://github.com/event4u-app/agent-config/commit/053d07f2024e4c5bc8d6b6fc031e0f1a47013112))
* **image-editing:** migrate triggers.json to queries[] format ([2ba21e0](https://github.com/event4u-app/agent-config/commit/2ba21e0ce492de29d6c1079863412095a85c5c2e))
* update agent_config_version pin in template to 7.4.0 ([9dc5b20](https://github.com/event4u-app/agent-config/commit/9dc5b2043c587a5e0288a93e3785d15e942bee67))
* **legal:** correct LEGAL_NOTICE.md relative path in legal-safety-floor rule ([2a03cef](https://github.com/event4u-app/agent-config/commit/2a03cef0af21ab4102d0a04962775cb6983b97a7))

### Documentation

* **roadmaps:** archive completed road-to-design-system-extraction-contract ([9698804](https://github.com/event4u-app/agent-config/commit/96988047bf92cb83d78618b941dbead5baecb595))
* bump guideline count 86→87 for design-canon.md (task sync) ([92cf710](https://github.com/event4u-app/agent-config/commit/92cf7109b231164a540eb2c38d4486c59a0ed597))
* **roadmaps:** archive completed road-to-design-canon-grounding ([0a5c010](https://github.com/event4u-app/agent-config/commit/0a5c010d972ecd239bfb586191263157f169aecc))
* **roadmaps:** archive completed road-to-shadcn-registry-awareness ([215e535](https://github.com/event4u-app/agent-config/commit/215e535f37e144caf63222b16f55ebdd68cb34ad))
* **roadmaps:** archive completed road-to-taste-dials-and-locks ([848dd4b](https://github.com/event4u-app/agent-config/commit/848dd4bbc66edce0c58491152a171c907dd0907d))
* **roadmaps:** design/taste harvest roadmaps + anti-slop-detector archive ([a7be86f](https://github.com/event4u-app/agent-config/commit/a7be86f578607173db41a4df1c8e684934d11907))

### Tests

* **judges:** deterministic calibration guard for the two evaluative judges ([41031c9](https://github.com/event4u-app/agent-config/commit/41031c9fe827e3e197f18879339e9b7d0f9d0768))
* **work_engine:** convert hooks_* parity rigs to python-free; drop _hooks_pyloader ([013b104](https://github.com/event4u-app/agent-config/commit/013b104c79fa65a4bb7f0d3cd7df15536fd63c98))
* **work_engine:** convert 4 directives parity rigs to python-free intent tests ([ad33470](https://github.com/event4u-app/agent-config/commit/ad334706c41ee164722f1c2ef46286bffc69dac6))

### Chores

* include pre-existing uncommitted files (bench report + frontmatter test) ([871b342](https://github.com/event4u-app/agent-config/commit/871b3424172626ac3c48bee1489637ffb049f767))
* re-anchor stale condensation hashes for 3 command files ([f6e24c6](https://github.com/event4u-app/agent-config/commit/f6e24c6f569ab9b058fa75806e18f759cffbea31))
* sync meta README with shortened judge-injection-defense description ([cb1de3d](https://github.com/event4u-app/agent-config/commit/cb1de3ddd2b127cea830d01f84c0d45ea5869494))
* sync src/domains/meta/README.md with updated skill description ([39be4e0](https://github.com/event4u-app/agent-config/commit/39be4e0daf6171bd7309d0e3c430e827c8278af6))
* regenerate agents/index.md and docs/catalog.md for new skill ([249518f](https://github.com/event4u-app/agent-config/commit/249518f3d5f3ac24567a9d81988f344aaa1d004f))

## [7.4.0](https://github.com/event4u-app/agent-config/compare/7.3.0...7.4.0) (2026-06-26)

### Features

* **bench:** thin-vs-eager quality-run producer (Phase 0 EXIT judge runner) ([0442fab](https://github.com/event4u-app/agent-config/commit/0442fab2004f09a5b2476a33c3393a157647082b))
* **ci:** activate the always-loaded budget gate with provisional token caps (Phase 8) ([1bd765c](https://github.com/event4u-app/agent-config/commit/1bd765c91d12707eed6bd277d35de36c96298005))
* **ci:** kernel-prefix byte-stability guard (token-saving Phase 5) ([90e2814](https://github.com/event4u-app/agent-config/commit/90e2814a10da9423be4851e50d1796b910ffd1fa))
* **hooks:** deterministic RTK-wrap PreToolUse nudge (default-off, warn-only) ([82db01d](https://github.com/event4u-app/agent-config/commit/82db01d60d52295c16e4ee14eb96efbb13442807))
* **rtk:** close the cli-output-handling trigger gap ([cc12c02](https://github.com/event4u-app/agent-config/commit/cc12c02cf115fc85bcd1989ab2d75252eb220684))
* **fix-pr-comments:** commit+push before replying, then resolve threads ([23ae60b](https://github.com/event4u-app/agent-config/commit/23ae60be884ecafbebadacffaf9c5c0dd552d0ec))
* **bench:** Phase 0 measurement rig — regression gates, golden set, latency + host probes ([5feb233](https://github.com/event4u-app/agent-config/commit/5feb2330abf557f65c8a929222dd12dc8e5d2537))
* **bench:** wire real tiktoken (cl100k_base) into the token-measurement path ([d92e5d2](https://github.com/event4u-app/agent-config/commit/d92e5d2f842e99d9e71800f6098ecf0c400088c7))
* **cli:** add read-only analyze-session post-session report ([8e3df94](https://github.com/event4u-app/agent-config/commit/8e3df9475b4dc54aae79f4c7518d10da1514bb24))

### Bug Fixes

* **hooks:** add hooks.rtk_wrap.enabled to the settings Zod schema ([4a34967](https://github.com/event4u-app/agent-config/commit/4a34967f7f72748b89199ec344cde897500903e1))
* **cli:** drop unused print helper in analyze-session ([e4c5cde](https://github.com/event4u-app/agent-config/commit/e4c5cdeb0510031a1a7f86ca5d468a525fc185b8))

### Documentation

* **roadmap:** token-saving Phase 10 — triage the backlog candidates ([036b3e6](https://github.com/event4u-app/agent-config/commit/036b3e6a121673be75a49671d865e7e7aaaa9f29))
* **roadmap:** token-saving Phase 8 — budget gate activated (elbow calibration deferred) ([8a9b3e3](https://github.com/event4u-app/agent-config/commit/8a9b3e3f9184e2e8efe0ff43d0420806b298f549))
* **roadmap:** token-saving Phase 5 — cache-aware ordering CI invariant ([00d7181](https://github.com/event4u-app/agent-config/commit/00d7181899cebda62b4efcee3450130756483fe3))
* **roadmap:** token-saving Phase 3 — RTK wrap hook landed ([b4d358f](https://github.com/event4u-app/agent-config/commit/b4d358f2eb7b8998e04f72b33c9f127db6a6358a))
* **roadmap:** token-saving Phase 1 premise correction + Phase 2 trigger gap done ([25b42f2](https://github.com/event4u-app/agent-config/commit/25b42f21a5c640f2665dec70e3190dcff4cfc584))
* **roadmap:** token-saving Phase 0 — rig landed (tokenizer/judge/latency/CI-gates) ([70ce1e5](https://github.com/event4u-app/agent-config/commit/70ce1e5e13db72046d350a51d0cde2af8c067b3c))
* **roadmap:** de-duplicate token-saving — human-measurement phases live only in later/ ([7394f21](https://github.com/event4u-app/agent-config/commit/7394f217b64c76e5f74a6195659c1aec17e69e24))
* **orchestration:** keep subagents.auto=ask (honest-null); re-gate flip on telemetry ([e5eed45](https://github.com/event4u-app/agent-config/commit/e5eed45ad5f3206871aa5eafab37cb9c101b2aa7))
* **roadmap:** archive completed session-analytics ([461d86f](https://github.com/event4u-app/agent-config/commit/461d86f7aad1be2216ccd81cdf65b8ef6f7fe6a9))
* **roadmap:** archive completed governance-moat; park cross-model eval in later/ ([b43893f](https://github.com/event4u-app/agent-config/commit/b43893fc6b060ddca285b6964087bff3fe0a02f0))
* **governance:** document the compile-time governance moat ([fcd455d](https://github.com/event4u-app/agent-config/commit/fcd455d22b076011cd0e3b3d669687f8a7bb196a))

## [7.3.0](https://github.com/event4u-app/agent-config/compare/7.2.0...7.3.0) (2026-06-25)

### Features

* **bench:** opt-in hardened arms for governance-enforcement eval ([af9a0e0](https://github.com/event4u-app/agent-config/commit/af9a0e07a2c2312f6b53782a8fcb44b2bde35635))
* **evals:** cross-model canary workflow + robust smoke (T-005) ([d062095](https://github.com/event4u-app/agent-config/commit/d06209535731d27446768442c081fcac151b3f20))
* **evals:** cross-model trigger smoke — SDK-free fetch routers + runner (Phase 0 T-004 keystone) ([1a8df9c](https://github.com/event4u-app/agent-config/commit/1a8df9cc83f2a9ace2e4a45eb9d66be6b51be5ae))
* **evals:** finding_floor assertion kind — deterministic count gate (Phase 1) ([7f0e9e6](https://github.com/event4u-app/agent-config/commit/7f0e9e617a741b1f778d9cacdde145ef4a300994))
* **evals:** graded negative-control discrimination primitive (Phase 0 T-003) ([5407121](https://github.com/event4u-app/agent-config/commit/54071210ecbfc8b6807fa37d726ea27654d22158))

### Bug Fixes

* **skills:** declare top-level skill field in bug-analyzer/code-review evals ([7c7f2e3](https://github.com/event4u-app/agent-config/commit/7c7f2e3adf181f2a1e936cb028538b3471e8f15e))
* **skill-linter:** accept finding_floor eval assertion kind ([bb629f9](https://github.com/event4u-app/agent-config/commit/bb629f98c41c09912a6d67d31ceef25a49becb56))
* **evals:** GeminiRouter JSON output contract — closes the format divergence (Phase 0b) ([f739b32](https://github.com/event4u-app/agent-config/commit/f739b320a1dcb54350d44a67009e634a421034ed))
* **evals:** drop legacy-path literal from a comment (ADR-051 guard) ([48328f0](https://github.com/event4u-app/agent-config/commit/48328f0bd0f9c36cd8d0f11c2bbc206c49faefc6))
* **harvest:** drop illustrative ellipsis path that tripped check_references ([94e6098](https://github.com/event4u-app/agent-config/commit/94e6098bf7d4a6e5127729db103a04b61dfc8f39))

### Documentation

* **roadmap:** enforcement honest-null; archive positioning roadmap ([226bf33](https://github.com/event4u-app/agent-config/commit/226bf3394b905a7dbd45fd74c55ab3a001ddaf2f))
* **readme:** lead with capability; add host-enforcement matrix ([531327d](https://github.com/event4u-app/agent-config/commit/531327d465ed0cc2803b1ee1900d5b551dacbdc0))
* **harvest:** wider-coverage baseline (10 skills) + agent-ide-plugin security-lessons note ([4a2aaaa](https://github.com/event4u-app/agent-config/commit/4a2aaaaac0b6fbd1467b254207690f5adaacf7d8))
* **harvest:** Phase 0b resolved — record the 3-variant format-fix evidence + flip checkbox ([a64dcab](https://github.com/event4u-app/agent-config/commit/a64dcab235efb41170cb28fd4603ae2f3fd1de25))
* **harvest:** cross-model baseline + outcome read (T-006); credential blocker resolved ([b4e8453](https://github.com/event4u-app/agent-config/commit/b4e84534064fe91f4609e2e06fbd04e957f2e2fa))
* **harvest:** Phase 0 evidence — capability matrix, fixture-portability audit, vendor-credential gate decision ([cb64570](https://github.com/event4u-app/agent-config/commit/cb64570b414c3a4d2e3ec34dda70137f513bbfa5))

### Tests

* **evals:** starter behavioral evals.json fixtures (Phase 1, T-001 0-fixtures gap) ([dd6861b](https://github.com/event4u-app/agent-config/commit/dd6861bff4d66d7458468f0a9b2490ac088157c7))

### Chores

* **roadmap:** archive operator-runtime-harvest (core complete) + park residuals in later/ ([69ef1ac](https://github.com/event4u-app/agent-config/commit/69ef1ac91af47c3c462f4453f74eeb94fece310b))
* **roadmap:** defer Phase 2 (won't-build-speculatively) — undershoot guard + catalog target ([9f37fa8](https://github.com/event4u-app/agent-config/commit/9f37fa8fcf29f1822a5739d916b5510047a9f23d))
* **roadmap:** close T-005 + Phase G (honest-null) + plugin note; mark human/parallel residuals ([a0d7f80](https://github.com/event4u-app/agent-config/commit/a0d7f806ac5ed048b19b9c20e41ba392328f3393))
* **roadmap:** Phase 0 — T-004 + T-006 done (live smoke ran); T-005 re-scoped (cost), Phase 0b actionable ([036e66f](https://github.com/event4u-app/agent-config/commit/036e66f98d3cc805e0128a86ab01ee15fd771bb1))
* **dist:** sync eval-fixture projection for the new behavioral evals.json ([01cc089](https://github.com/event4u-app/agent-config/commit/01cc08994ebf11d7cf894822b73a4374b7ef0ee9))
* **roadmap:** Phase 1 — finding_floor mechanism + fixtures done; calibration deferred on P0 ([3a5bc28](https://github.com/event4u-app/agent-config/commit/3a5bc28083206118352b1dd641d76326ac58114d))
* **roadmap:** Phase 0 — mark T-000..T-003 done, T-004..T-006 deferred on credentials ([4f302ee](https://github.com/event4u-app/agent-config/commit/4f302ee9270b02488d1dce6d285520984d01ab40))

## [7.2.0](https://github.com/event4u-app/agent-config/compare/7.1.0...7.2.0) (2026-06-24)

### Features

* **design-craft:** wire existing design/frontend skills into the anti-slop layer ([4ac512c](https://github.com/event4u-app/agent-config/commit/4ac512c294c47c54c04e71a12d2a85e6a8600d93))
* **design-craft:** add anti-slop enforcement + design memory + token governance ([4c07b60](https://github.com/event4u-app/agent-config/commit/4c07b60195db52a938f41445a347a0bec3331bc2))
* **product-clarity:** process wins (release-story, trunk-drift, explainability) ([f91b898](https://github.com/event4u-app/agent-config/commit/f91b898d7ae833bd4eb7b1577e7ae5f78ee96be4))
* **governance:** capability lifecycle view + complete capability-governance ([f299791](https://github.com/event4u-app/agent-config/commit/f2997914a3f9e25fc0a26b4a202e3f521a0471b7))
* **governance:** subagent boundary contract ([8ed4181](https://github.com/event4u-app/agent-config/commit/8ed4181afbff73cb99b764ac695354c0bb1f073f))
* **governance:** skill-growth gate in the authoring flow ([a9a3b80](https://github.com/event4u-app/agent-config/commit/a9a3b80ab7dfbcfee0cb8f0c51d5744aabb03bd7))
* **governance:** capability-boundary matrix + risk_class invariant ([7b683b8](https://github.com/event4u-app/agent-config/commit/7b683b864188f40424c4a9399a6a931081e14291))
* **legal-review-prep:** attorney-framing-review promotion tripwire ([551fe8b](https://github.com/event4u-app/agent-config/commit/551fe8b4b7e817c5f81adddfe8d85220f3ef30a7))
* **legal-review-prep:** high-risk pack metadata ([554282e](https://github.com/event4u-app/agent-config/commit/554282e4b12575dc884c078f45b560facea60be1))
* **legal-review-prep:** council / deep-research gate on legal work-product ([7b44c89](https://github.com/event4u-app/agent-config/commit/7b44c8961d94ae9a5b99329a80ff725db2d0c6d5))
* **legal-review-prep:** install consent gate (checkbox + flag + floor refusal) ([af2ee1d](https://github.com/event4u-app/agent-config/commit/af2ee1dbc18446f77f0d13e79b11551634f15d2c))
* **legal-review-prep:** hard individual-case STOP in the floor + lint ([71860da](https://github.com/event4u-app/agent-config/commit/71860da9699d8537a81942ff4d59aeca6fbd2a96))

### Bug Fixes

* **lint:** trim telegraph-speak amendment to clear long_rule warning ([95d54c6](https://github.com/event4u-app/agent-config/commit/95d54c6852c2344f3402f5f9730185a400fc4941))
* **lint:** add model_tier to design-system-capture skill ([57c3a6d](https://github.com/event4u-app/agent-config/commit/57c3a6defd57a771a9f86805b9634f3b73a6afee))
* **framework-neutrality:** drop npm-install literal in design-intelligence ([aeadec5](https://github.com/event4u-app/agent-config/commit/aeadec54038c0d43aed75ea30f30574a2d6b7d65))
* **ci:** Zod settings parity + router minification for tokens.rich_skills ([88930da](https://github.com/event4u-app/agent-config/commit/88930da1786731a9cc1317b841646477f77ad1d1))
* **ci:** strict-TS null-safety in design-craft linters ([3cac522](https://github.com/event4u-app/agent-config/commit/3cac522ed8234190a6d361735bc323616b11393b))
* **ci:** broken refs + unused var in design-craft additions ([2e0c2a7](https://github.com/event4u-app/agent-config/commit/2e0c2a785596c67fb4114ead09caea57aeb6e0ab))
* **portability:** drop task-invocation from shipped /create-pr command ([e03f97a](https://github.com/event4u-app/agent-config/commit/e03f97a14ea38439ba41427448f7d77c868959c4))

### Documentation

* **roadmaps:** add legal-review-prep + capability-governance + product-clarity roadmaps ([e3ad120](https://github.com/event4u-app/agent-config/commit/e3ad120893dd20cea79c7875558137f42d2797da))

### Refactoring

* **legal:** rename legal pack to legal-review-prep ([fb34133](https://github.com/event4u-app/agent-config/commit/fb3413305718d321b435514e5f0ab0f4122e37b7))

### Chores

* **sync:** condense design-craft skills/rules + sync dist/agent-src/ ([3a3e6e1](https://github.com/event4u-app/agent-config/commit/3a3e6e1f668128e386ca7d19ffe031a09a391fcd))

## [7.1.0](https://github.com/event4u-app/agent-config/compare/7.0.2...7.1.0) (2026-06-24)

### Features

* **legal:** RDG individual-case guardrail + LEGAL_NOTICE + no-definitive-language lint ([23e76df](https://github.com/event4u-app/agent-config/commit/23e76df34c612ed9bcdace069040defda80c1226))
* **legal:** lock open-source-forever stance + harden liability disclaimer (ADR-108); close 0.6 + 3.3 ([8d828a6](https://github.com/event4u-app/agent-config/commit/8d828a64de5d23fa1c298a78b3d67c6e70ffe4b7))
* **legal:** lock open-source-forever stance + harden liability disclaimer (ADR-108); close 0.6 + 3.3 ([f45e4e9](https://github.com/event4u-app/agent-config/commit/f45e4e99f7cccd77efb2d62fe06cb4436bc2df9e))
* **legal:** enforcement linter, privilege markers, eval harness, docs (Phases 1/1.5/3/5) ([cb06648](https://github.com/event4u-app/agent-config/commit/cb06648009dc12daab440a273eeb780d06f6e2fa))
* **legal:** add governed EU/DE legal pack — floor, 5 skills, vocab (ADR-107) ([b0d531f](https://github.com/event4u-app/agent-config/commit/b0d531f2701b600c93cb1ba52f3dce50e21a6d6d))
* **bench:** pair-capture seam for recursion arm (human-preference pretest) ([7211c04](https://github.com/event4u-app/agent-config/commit/7211c043bb712cea6c0a2e0de56ea5af79b70cce))
* **bench:** recursion gate logic + novel-lift scorer + package-recursive arm ([e33ff7d](https://github.com/event4u-app/agent-config/commit/e33ff7d52572ea35bcb8f5b190336e83e737ab1d))
* **recursive-verification:** add depth-bounded self-verification skill + gate ([4a0c519](https://github.com/event4u-app/agent-config/commit/4a0c519628a5244cc2859cdf484661c92be25783))
* **subagents:** A1 rule body + A2 bundle resolver + A3 response envelope ([4a9fc9b](https://github.com/event4u-app/agent-config/commit/4a9fc9b3c44c256426b0c33f4448010e890adf13))
* **subagents:** A1 — dedicated delegation-policy auto-trigger rule ([e60cb50](https://github.com/event4u-app/agent-config/commit/e60cb50fcfb55ccabdeab88b680ec707f8a4d122))
* **subagents:** automatic, settings-gated subagent orchestration ([dba922c](https://github.com/event4u-app/agent-config/commit/dba922c1da2177ad8103f06fd4dce49cff95977d))
* **py2ts:** purge dead python-parity test blocks + add permanent no-python-in-src guard ([e163468](https://github.com/event4u-app/agent-config/commit/e163468af8d2b70a7e4645db0dda719c3f761cb3))
* **roadmaps:** robust completion→archival independent of PR flow, tracking, and vendored scripts ([a879334](https://github.com/event4u-app/agent-config/commit/a87933447797c848e0e09e5d9d0ade6d280ae794))
* **rules:** add design-fidelity rule for provided-design adherence ([88bc654](https://github.com/event4u-app/agent-config/commit/88bc6541721a7d964d670fe80ac06385c4776762))
* add /fix:comments command to audit and trim branch code comments ([b3127b8](https://github.com/event4u-app/agent-config/commit/b3127b86733357d8fe2a32e4b3e5fe1c15447e41))

### Bug Fixes

* **legal:** add 'legal' to discovery-manifest schema workspace + pack enums ([f7cc834](https://github.com/event4u-app/agent-config/commit/f7cc83415d6c7ffa7600512fba059c2513c3d4df))
* **ai-council:** raise curl timeout to 300s + --max-time so long Anthropic generations don't ETIMEDOUT ([42048b9](https://github.com/event4u-app/agent-config/commit/42048b91a5361a9041deee172609a974d926d1da))
* **roadmap:** commit legal-pack + dashboard + archived-roadmap link fixes ([1a6910a](https://github.com/event4u-app/agent-config/commit/1a6910a39beea7e5bfc0ff21167be1463d7bfd96))
* **test:** satisfy noUncheckedIndexedAccess in recursion tests ([29d6d89](https://github.com/event4u-app/agent-config/commit/29d6d8920192b3ade000abf9e5c102871a3ba336))
* **py2ts:** inbox snapshot — strip macOS /private prefix so Linux CI matches ([f19436e](https://github.com/event4u-app/agent-config/commit/f19436e4a6e1cdc6dba452330e293b4414f82125))
* **py2ts:** typecheck — assert tuple element in workspace_secrets SCAN/OBJ_CASES ([aedf6ee](https://github.com/event4u-app/agent-config/commit/aedf6eeb98eb4e171544decf4bfc9511ad7868e2))
* **ci:** allowlist brand/iconography/premortem bare-noun skill names ([1522311](https://github.com/event4u-app/agent-config/commit/152231156b8379ded27652c28c089806a4f33d1c))
* **ci:** register new subagents.* keys in the settings schema ([2c817a6](https://github.com/event4u-app/agent-config/commit/2c817a631c6b2062d8e5e843c31513d932d27d6f))
* **ci:** resolve pre-existing trunk gate drift ([8515b97](https://github.com/event4u-app/agent-config/commit/8515b9793608c077f058ac42621bf6e03160e163))
* **schema:** default the design block so settings without it still validate ([86ee94e](https://github.com/event4u-app/agent-config/commit/86ee94e313f198fd109db7dfdd6bb93a7b6dc8c6))
* **schema:** register design.fidelity_mode in settings parity schemas ([af56652](https://github.com/event4u-app/agent-config/commit/af5665258c9b5c02bc016d2e12bfa76befbe5d5d))
* **council:** resolve config global-only — never search the project tree ([fcd81ff](https://github.com/event4u-app/agent-config/commit/fcd81ffe92e652db88c79ba29c05b2dc0e358850))

### Documentation

* **recursive-verification:** record council follow-up disposition — TERMINAL ([7d132be](https://github.com/event4u-app/agent-config/commit/7d132bec2b55c00359d1d906b7701de0317f28bf))
* **recursive-verification:** record honest-null in benchmark.md + ADR-106 ref ([87da20f](https://github.com/event4u-app/agent-config/commit/87da20ff8217e771427153eabaf7edaec4e97669))
* add subagent-orchestration onboarding map + sync roadmap dashboard ([01b798f](https://github.com/event4u-app/agent-config/commit/01b798f42b500b3c801292f65da90137304f9243))
* **roadmap:** add operator-runtime-harvest roadmap ([a2a92b1](https://github.com/event4u-app/agent-config/commit/a2a92b145f630e55b440b7b4214359618bf70ac9))
* **roadmap:** record measured remaining spawn-tail count (108) + next groups ([4426293](https://github.com/event4u-app/agent-config/commit/4426293da06dfc60ff914ab9a4bc9756675b96aa))
* **roadmap:** archive completed auto-subagent-orchestration v2 + regenerate derived ([e8af760](https://github.com/event4u-app/agent-config/commit/e8af760c792b4b7f2a7c3d61a551d84e43904df6))
* **roadmap:** mark work_engine cluster de-pythonized (21 files) ([0b36d5c](https://github.com/event4u-app/agent-config/commit/0b36d5c4999052f33cbc423296ecc9238a2b122c))
* **roadmap:** mark workspace_* cluster converted (12 files, +346 tests) ([154db54](https://github.com/event4u-app/agent-config/commit/154db548375a787f9c19ed38a464db8edfd4b9cb))
* **roadmap:** capture the py2ts conversion-tail determinism trap (per-file, not a codemod) ([439817c](https://github.com/event4u-app/agent-config/commit/439817c272216f81ed2e286990f27488f3321e64))
* **roadmap:** auto-subagent-orchestration roadmap + follow-up ([5cdbc84](https://github.com/event4u-app/agent-config/commit/5cdbc8438b0e097c99f16ee438494ae66e234c77))
* **roadmap:** refine py2ts tail triage (36 delete-candidates / 108 convert) ([985e3e3](https://github.com/event4u-app/agent-config/commit/985e3e35bdfb48309c2dc7259e0180a39fe71cd8))
* **roadmap:** record py2ts parity-block purge + categorize the remaining tail ([1ac823c](https://github.com/event4u-app/agent-config/commit/1ac823ce1e927a473e6c2c973cbe2e33dfb96ffb))
* **roadmaps:** split token-saving human-measurement track off the autonomous parent ([ac188ef](https://github.com/event4u-app/agent-config/commit/ac188ef4e7044f75baf87e393f7084dae383abe3))
* **roadmaps:** reconcile road-to-typescript-only-scripts against merged reality ([9adf45b](https://github.com/event4u-app/agent-config/commit/9adf45b3294f38f70100feaec44867074b512a2b))
* **rdp:** restore frontier-polish closure dispositions in the archived file ([e712620](https://github.com/event4u-app/agent-config/commit/e712620f74a83f5faa50bb8885b6a1d17117adcf))
* **rdp:** close + archive road-to-rdp-frontier-polish (L7 no-promotion, Phase 3 cancelled) ([8945d5a](https://github.com/event4u-app/agent-config/commit/8945d5ad35b15c4b177ae368f389fb0445f0c856))

### Tests

* **legal:** replace Gate-2 owner requirement with a test-enforced disclaimer guarantee ([60112ac](https://github.com/event4u-app/agent-config/commit/60112ac9af01cc9f85491a0b6ccaa6bd17b4caa8))
* **legal:** add trigger-eval sets for the 5 legal skills (5 should + 5 should-not, DE+EN) ([f451af2](https://github.com/event4u-app/agent-config/commit/f451af2a4d6ee1cfd357f69fe120a905ae26e525))
* **py2ts:** de-pythonize 21 work_engine test files (purge parity blocks / convert pure rigs) ([2221cc8](https://github.com/event4u-app/agent-config/commit/2221cc8c268bb4d7e8f7eba59d58990f31c82dfb))
* **py2ts:** convert the workspace_* CLI parity cluster to python-free intent tests ([6697dea](https://github.com/event4u-app/agent-config/commit/6697dea75a24f363f2053c4700d8438ec2725742))
* **py2ts:** convert workspace_hosts parity rig to python-free intent test ([6f79864](https://github.com/event4u-app/agent-config/commit/6f798649ae2f27ca1381622025102b678f283f6d))
* **py2ts:** purge obsolete python3-vs-tsx parity blocks from 94 mixed test files ([5e07191](https://github.com/event4u-app/agent-config/commit/5e07191639e01f74f47699e62798ce6b298cbc1f))
* **py2ts:** convert the 4 all-parity CLI rigs to python-free intent tests ([aff202c](https://github.com/event4u-app/agent-config/commit/aff202c5eb81d2a87e9147e812a2fd53635dcae2))
* **ci-time-ratio:** drop leaked root artifact, write relative --out under ignored test-results/ ([5152942](https://github.com/event4u-app/agent-config/commit/5152942c67711f3dfdb4b35b60c696fd633a6aaf))

### Chores

* **legal:** regenerate agents/index.md + docs/catalog.md for legal pack artefacts ([484d5da](https://github.com/event4u-app/agent-config/commit/484d5da21ff67dd7013919b99a03fd0de3c66c72))
* **roadmap:** archive completed recursive-verification + add legal-pack + sync dashboard ([887fbe7](https://github.com/event4u-app/agent-config/commit/887fbe7b83be52e21d751965f3dad2152d80f1ce))
* **roadmaps:** archive py2ts teardown evidence + superseded predecessor ([d11f6cd](https://github.com/event4u-app/agent-config/commit/d11f6cd1646c43e6bd8f210b0ac703a7059236e5))
* **condense:** re-mark stale command hashes (pre-existing drift) ([836d2c9](https://github.com/event4u-app/agent-config/commit/836d2c9ae1987d630fdce431b0ae5fed9aeb9aca))
* register fix-comments skill in marketplace.json ([214c5d1](https://github.com/event4u-app/agent-config/commit/214c5d147b53b65c9eef56ea0e72a2d1a9224633))
* **roadmaps:** regenerate dashboard (frontier-polish Phase 1 = done) ([9172c18](https://github.com/event4u-app/agent-config/commit/9172c18f5c6b6ad82ca6457ddbad10069a895d31))

### Other

* Revert "feat(legal): lock open-source-forever stance + harden liability disclaimer (ADR-108); close 0.6 + 3.3" ([1f10272](https://github.com/event4u-app/agent-config/commit/1f1027229c841cda6110b64c59747b3607b092f6))

## [7.0.2](https://github.com/event4u-app/agent-config/compare/7.0.1...7.0.2) (2026-06-22)

### Bug Fixes

* **roadmaps:** regen entry-guard fires under symlinked invocation ([244e4e4](https://github.com/event4u-app/agent-config/commit/244e4e45a42a6b3d4793ac192e0f912d71954ba4))
* **rdp-eval:** harden index access for strict typecheck (noUncheckedIndexedAccess) ([041b21e](https://github.com/event4u-app/agent-config/commit/041b21e4877361b1499328216242fa6ec595ff99))
* **rdp-eval:** satisfy eslint on the new runners ([3c418e1](https://github.com/event4u-app/agent-config/commit/3c418e16faf340b8367148f6788835e400241e4e))

### Documentation

* **rdp-eval:** keep-scoped L6 verdict — scope orchestrator to multi-step work ([61173ca](https://github.com/event4u-app/agent-config/commit/61173ca899442b81159e4f3efe586251dcea4459))

### Tests

* **rdp-eval:** capture larger-N L6 + gate-classification data ([f92aad3](https://github.com/event4u-app/agent-config/commit/f92aad32620af27c5cf4d000859adeeb9894a819))
* **rdp-eval:** port quality+L6 eval runners to TypeScript (fetch-based) ([9c4ec60](https://github.com/event4u-app/agent-config/commit/9c4ec604ca6fbb82d796cf2d65626d381a854142))

### CI

* **consistency:** trigger on src/** and dist/agent-src/** paths ([6a5e5e7](https://github.com/event4u-app/agent-config/commit/6a5e5e76cea3d5f879f9fcda6e510cc73039826e))

## [7.0.1](https://github.com/event4u-app/agent-config/compare/7.0.0...7.0.1) (2026-06-22)

### Bug Fixes

* **release:** measure accumulated era body in the split gate ([3837048](https://github.com/event4u-app/agent-config/commit/3837048138e5e5d8cfa024ab80df4882d8ecc736))
* **changelog:** exempt newest release from era drift cap; split 7.0.0 into its own era ([0dfa3a2](https://github.com/event4u-app/agent-config/commit/0dfa3a23fe44f8eb4e664d78173d294c7c4848c3))
* **install:** resolve package version by upward walk so global install stops refusing ([977bdc3](https://github.com/event4u-app/agent-config/commit/977bdc359fe8954592f81649b23ea4a00f157b74))

## [7.0.0](https://github.com/event4u-app/agent-config/compare/6.1.0...7.0.0) (2026-06-21)

> Large catch-up release. The full per-commit entry (BREAKING CHANGES,
> Features, Fixes, …) is archived in
> [`docs/archive/CHANGELOG-7.0.0.md`](docs/archive/CHANGELOG-7.0.0.md) to keep
> the active `7.0.x` era under the 250-line drift cap. Git tag `7.0.0`
> remains the canonical record of what shipped.

### Highlights

* **py2ts:** Python → TypeScript re-platform completed — all `src/` `.py`
  twins removed (Hard Floor); CLI, release, roadmap, and golden-transcript
  tooling ported to TS + vitest.
* **install:** versioned install-layout ABI; core-vs-lab surface tiers with a
  boundary guard; layout migration + core-only deploy wired into the installer.
* **brand / eval / ai-image:** `/brand:` command cluster shipped; eval
  freshness lints made blocking; image-adapter cost + freshness caveats added.
* **BREAKING:** `build_ticket_export.py` removed — no API export (ADR-102).

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
