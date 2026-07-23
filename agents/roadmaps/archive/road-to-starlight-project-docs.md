---
complexity: structural
status: active
---

# Roadmap: Starlight project documentation

> Extend the existing agent-config Starlight site (`site/`) into a
> comprehensive-yet-concise **project documentation portal**, restyled to the
> **data-helpers look** (rapide theme, orange accents, banner, mermaid where
> feasible), adding **Setup**, **Configuration**, **CLI Commands**,
> **Agent Commands**, and **Architecture** sections — without breaking the
> existing proof/claims/benchmark/catalog pages, the no-drift sync, the
> internal-link-check gate, or the GitHub-Pages deploy.

## Goal

A new contributor or user can, in a few minutes on the docs site, understand
what agent-config is, how to install and configure it, which terminal CLI
commands and agent slash-commands exist, and how the architecture fits
together — with the same visual identity as
`event4u-app.github.io/data-helpers`. Overview-first: each section gives a
good orientation and links to the exhaustive canonical docs for depth. Not a
500-page dump.

## Decision (locked by the user, 2026-07-22)

Extend & re-theme the **existing** `site/` (Option A), NOT a new parallel
`starlight/`. New docs are **site-native authored pages** under
`site/src/content/docs/**` (authored source, not a generated projection — they
coexist with the synced proof pages, which `sync-docs.mjs` leaves untouched).

## Design decisions (council reviews these before execution)

- **D1 — Content model.** New pages are authored directly in
  `site/src/content/docs/**` (like data-helpers). The 4 proof pages stay
  synced from `docs/*.md` via `site/sync-docs.mjs`. Rationale: setup / config /
  CLI / agent-command overviews are site-native narrative with no other
  canonical home; authoring them in the content collection keeps them inside
  the `deploy-site.yml` `site/**` path filter and honours source-of-truth
  (authored site source ≠ generated projection).
- **D2 — Theme.** Add `starlight-theme-rapide` (peer `@astrojs/starlight >=0.34`
  → compatible with the site's 0.41), a `custom.css` with the data-helpers
  orange accent tokens (`--sl-color-accent: #c74624` light / `#ff7a50` dark),
  the banner in the hero, favicon/logo, GitHub social link, and `editLink`.
- **D3 — Mermaid (RISK).** `astro-mermaid@1.x` peers `astro ^4||^5`; the site is
  **Astro 7**. Execution must check for an Astro-7-compatible version/approach;
  if none exists cleanly, **defer mermaid** (non-blocking — agent-config docs do
  not strictly need diagrams). Do NOT downgrade the site's Astro just for
  mermaid.
- **D4 — IA (overview-first, capped depth).** Sidebar sections: Start ·
  Getting Started · Configuration · CLI Commands · Agent Commands ·
  Architecture · Reference (existing Proof/Benchmark/Claims/Catalog). Each new
  section is a small set of concise pages that link out to canonical docs for
  exhaustive detail.
- **D5 — Link gate.** Every internal link must resolve in the built site;
  `./scripts-run src/scripts/check_site_links` is the gate (Astro build alone is
  not a link gate).
- **D6 — Node.** Build under Node ≥22.12 (Astro 7 requirement; deploy workflow
  pins Node 22).

## Content grounding (source of truth for the pages — verified 2026-07-22)

> Distilled from a four-agent analysis of the repo. Cite these; do not invent.
> Accuracy flags below are load-bearing — several prose docs in the repo are
> stale and must NOT be copied verbatim.

### Counts (from README badges — the drift-gated source)
Skills **278** · Rules **105** · Commands **190** · Guidelines **101** ·
Personas **29** · Advisors **5**. (`docs/architecture.md` agrees; adds
Templates 7, Contexts 5. `package-self-orientation.md` count figures are STALE.)

### Accuracy flags (MUST honour)
- **Node ≥ 20.11.0** (`package.json` engines) — NOT "Node 18" (stale README
  prose). The Starlight *site build* separately needs Node ≥22.12.
- **Installer is TypeScript**: `src/scripts/install` → `src/scripts/install.ts`
  → bundled `dist/install/install.mjs`. Treat any "`install.py`" prose as
  legacy. Do not document a Python installer.
- **v2.5+ `init` writes GLOBAL only** (`~/.event4u/agent-config/`, `~/.claude/`,
  …); the project tree gets `agents/overrides/` only. `--project` is
  maintainer-only behind `AGENT_CONFIG_DEV_MODE=1` (ADR-020 amendment).
- **Three distinct "profile" concepts — never conflate**: (a) `profile.id` =
  six experiences (`developer`(default)·`founder`·`content_creator`·`agency`·
  `finance`·`ops`); (b) cost profiles = install `--profile=minimal|balanced|full`
  → legacy `rule_loading_tier`; (c) `discipline_profile` = successor runtime knob
  (`off|essential|full|auto`, ADR-110; `balanced` retired 2026-07-07 → maps to
  `essential`). Plus (d) ephemeral session profiles via `/profile activate`.
- **`cost:*` is Taskfile-only**, not an `agent-config` binary subcommand.
- **AI-council config is user-global-only** (`~/.event4u/agent-config/settings/.ai-council.yml`,
  ADR-104) — do NOT document `ai_council.*` as an `.agent-settings.yml` group
  without checking ADR-104; `docs/customization.md` has drift here.

### Getting-Started facts
- Install paths (all run the same installer): `npx -y @event4u/agent-config init`
  (canonical; auto-launches browser wizard on a TTY) · curl one-liner
  (`curl -sSL …/main/setup.sh | bash`) · npm dependency then `agent-config …`.
- npx flags: `--profile=`, `--tools=`, `--dry-run`, `--no-ui`, `--gui`. Headless
  when `CI` set / not a TTY / `--no-ui` / explicit `--tools=`.
- Setup wizard: `agent-config setup` boots a Fastify server on `127.0.0.1`
  (`/#/wizard`); loopback-bound, CSRF-gated. First question = experience →
  `profile.id`.
- Supported hosts (rules ✅ / skills only Claude Code / commands text-ref on
  most): Claude Code (full: `.claude/`), Cursor (`.cursor/rules/`), Cline
  (`.clinerules/`), Windsurf (`.windsurfrules`), Gemini CLI (`GEMINI.md`),
  Copilot (`.github/copilot-instructions.md`), Roo Code (`.roo/rules/`), Codex
  CLI (`AGENTS.md`), Continue.dev (`.continue/rules/`), Aider/Augment/Claude
  Desktop (marker/global). `--tools=` id list in README:183. Zed via MCP +
  `~/.agents/skills` (not a first-class projection target).
- Onboarding gate: first turn with `onboarding.onboarded: false` → agent tells
  dev to run `agent-config setup` first; wizard flips it true on Finish; inert
  when `.agent-settings.yml` absent.
- Surgical uninstall claim (JSON-pointer + SHA-256, removes only its own keys);
  no single uninstall command yet — manual removal documented.
- Requirements: Node ≥20.11.0; Python 3.10+ (bridge stage only); curl/wget;
  macOS 12.3+/Linux/WSL2; git. Sources: `README.md` §Use-it/§Quickstart/
  §Supported-tools/§Requirements; `setup.sh`; `src/scripts/install*`;
  `docs/customization.md`; `src/rules/onboarding-gate.md`.

### Configuration facts
- File: `.agent-settings.yml`. Template/source-of-truth:
  `src/config/agent-settings.template.yml` (richly commented). Schema:
  `src/scripts/schemas/agent-settings.schema.json` (draft-07, permissive
  `additionalProperties:true`, enum-guards the collision-prone value keys only).
- Layered merge (low→high): package defaults → `~/.event4u/agent-config/…`
  (user-global, whitelist-filtered to 6 DX keys) → repo-root → intermediate →
  CWD (deepest wins). Project-local always beats user-global.
- Key groups to document (compact reference table): `profile`, `projection`
  (ADR-040 `legacy-all` default), `discipline_profile`, `rule_loading_tier`
  (legacy), `tokens.rich_skills` (`on`), `cost` (budgets/enforcement
  `advisory`), `model.auto_switch` (`suggest`), `personal.*` (`autonomy: auto`,
  `pr_progress_comments: false`, `minimal_output: true`, `user_type`),
  `quality.local_auto_run` (`false`), `design.fidelity_mode` (`strict`),
  `consistency.cross_source` (`on`), `code_style.docblocks` (`minimal`),
  `subagents` (`enabled:true`, `auto:on`), `worktrees.mode`, `chat_history`,
  `reasoning` (RDP), `roadmap`, `memory.cadence` (`always`), `commands`
  (`auto_detect`, suggestion, `create_pr`), `onboarding.onboarded`,
  `legal_review_prep`. Validation/sync: `/sync-agent-settings`,
  `task lint-config-schema`, `agent-config validate` (CI drift gate).
- Packs: a pack is a frontmatter tag (not a dir); vocab in
  `src/config/discovery/{workspaces.yml (9), packs.yml (21)}`; manifest built by
  `scripts/build_discovery_manifest`. Sources: `docs/customization.md`,
  `docs/contracts/profile-system.md`, `docs/contracts/capability-packs.md`.

### CLI-command facts (terminal `agent-config` binary + Taskfile)
- Entrypoints: consumers `npx @event4u/agent-config <cmd>` / global
  `agent-config <cmd>` (`package.json` bin → `dist/cli/agent-config.js`);
  maintainers `./agent-config <cmd>` (root shim → `dist/cli/agent-config.js`,
  fallback `src/scripts/_dispatch.bash`). Registry:
  `src/cli/registry.ts`; native vs delegate split in `src/cli/main.ts` +
  `_dispatch.bash`.
- Document by cluster (overview + a curated reference table, NOT all ~70):
  Install/lifecycle (`init`, `setup`, `install`, `sync`, `update`, `upgrade`,
  `uninstall`, `use`, …); Diagnostics (`doctor`, `conformance`, `explain`,
  `benchmark`); Settings (`config`, `settings`, `settings:check|sync|migrate`);
  Discovery (`workspaces`, `packs`, `commands`, `affected`, `graph-explain`);
  Roadmap (`roadmap:progress`, `roadmap:progress-check`, `roadmap:archive`);
  MCP (`mcp:render|check|setup|run`, `mcp-server`); Memory
  (`memory:lookup|signal|check`, …); Telemetry (`telemetry:record|status|report`);
  Council (`council:estimate|run|render`, `keys:install-*`); `work` /
  `implement-ticket`.
- Taskfile tasks (`task <name>`, flattened namespace): headline entrypoints
  `task ci`, `task ci-strict`, `task sync`, `task generate-tools`,
  `task lint-skills`, `task test`, `task release`, `task roadmap-progress`,
  plus large lint/check/generate batteries in `taskfiles/*.yml`. Document the
  headline tasks + point to `Taskfile.yml`/`taskfiles/` for the full battery.
  NOTE: `cost:*` are Taskfile tasks (engine.yml), not CLI subcommands.

### Agent slash-command facts
- ~190 commands. Source `src/agent-src/commands/`; shipped projection
  `dist/agent-src/commands/` (59 top-level + 131 subcommands). Canonical index:
  `docs/catalog.md` §"Commands (190)". Namespacing `cluster:name`
  (`/council:default` → `council/default.md`). Each cluster has a top-level
  orchestrator (`type: orchestrator`, `routes_to`).
- Document cluster overview table (agents 9, roadmap 6, council 6, optimize 6,
  memory 6, analyze 6, fix 8, brand 5, feature 5, ghostwriter 5, video 5, team 4,
  tests 4, worktree 4, knowledge 4, judge 3, tdd 3, image 3, profile 3, sync 3,
  … + ~22 standalones like `work`, `implement-ticket`, `agent-handoff`, `mode`,
  `orchestrate`, `condense`) + a key-commands highlight table
  (`/pr:create`, `/commit`, `/work`, `/implement-ticket`,
  `/roadmap:process-full|phase|step`, `/roadmap:create`,
  `/council:default|debate|design|pr`, `/review:changes`, `/fix:ci`,
  `/fix:pr-comments`, `/research:deep`, `/project:analyze`, `/worktree:create`)
  + pointer to the full catalog. Do NOT list all 190.

### Architecture facts
- agent-config = a **content + governance layer** compiled into 7+ host formats,
  **zero runtime daemon**. Deliberately NOT: no daemon, no state DB, no
  self-rewriting memory, no auto-build pipeline. Authoring-time (in scope) vs
  runtime (out of scope).
- Four artifact types + personas: Skills (intent-matched capabilities), Rules
  (always-active constraints), Commands (slash orchestrators), Guidelines
  (reference conventions), Personas (review lenses).
- Kernel + Router: 9 Iron-Law kernel rules always load; non-kernel rules declare
  `triggers` + `routes_to`; `compile_router.ts` → `dist/router.json`
  (kernel/tier_1/tier_2/profiles); host reads router.json once, evaluates kernel
  every turn, walks tiers by profile.
- Source of truth & projections: `src/` canonical; `dist/agent-src/` + per-tool
  dirs are generated projections; `task sync` / `task generate-tools` /
  `/condense` regenerate; NEVER edit projections.
- Trust & Safety: `trust.level` enum (core·professional·advisory·restricted·
  experimental), HRR banner, per-pack `*-safety-floor` rules.
- Sources: `CLAUDE.md`, `README.md`, `docs/architecture.md`,
  `docs/contracts/{kernel-membership,rule-router,trust-and-safety,
  package-self-orientation}.md`, `docs/maintainers/system-map.md`. Keep the
  section concise; link out for depth.

## Council review (2026-07-23) — folded findings

Deep 2-round council (anthropic `claude-sonnet-4-5` + openai `gpt-4o`, $0.08).
Folded:

- **F1 — Profile term-collision is a landmine.** Use qualified terms
  consistently: *experience profile* (`profile.id`), *cost profile* / *discipline
  profile*, *session profile*. `configuration/profiles.md` is the AUTHORITATIVE
  disambiguation; `getting-started/profiles-and-packs.md` gives the quick "pick
  your experience" view and links to it. Never write bare "profile".
- **F2 — Lead with the concrete artifact.** Every page opens with the real
  command / file / table (e.g. the actual `npx … init` line, the settings-group
  table, `task ci`), THEN links out for depth. Overview-first IA stays (user's
  ask), but pages are substantive, not link-farms.
- **F3 — Section clarifiers.** The CLI Commands and Agent Commands sections each
  open with one line stating the distinction: CLI = terminal `agent-config` /
  `task` commands a human runs; Agent Commands = in-agent `/slash` commands the
  AI invokes in-chat (NOT run via the Taskfile). (Council suggested merging;
  rejected — they are genuinely distinct surfaces and the user asked for both.)
- **F4 — Host-compatibility matrix.** `getting-started/installation.md` carries
  the host-tool support matrix; note that only the optional AI-council / team
  features need provider API keys (the core suite is provider-agnostic, no keys).
- **F5 — Mermaid on Astro 7.** Attempt `astro-mermaid` with `--legacy-peer-deps`
  for the Architecture diagrams; if the build breaks, prose-supplement and defer
  (non-blocking). Do NOT downgrade the site's Astro (locked constraint).

Already-satisfied (no action): synced proof pages carry a `GENERATED … edit the
source` banner + `editUrl:false`; `sync-docs.mjs` already runs as the Astro
`prebuild` hook; `deploy-site.yml` already triggers on the 4 `docs/*.md` paths.
Theme swap is CSS-only — heading slugs (rehype-slug) are unchanged, so proof-page
anchors survive (verified by the link check).

## Acceptance criteria

- [ ] `cd site && npm ci && npm run build` succeeds under Node ≥22.12.
- [ ] `./scripts-run src/scripts/check_site_links` passes (no dangling internal
      links) against the built `site/dist`.
- [ ] The site renders the data-helpers visual identity (rapide theme, orange
      accent, banner in hero, favicon, GitHub social link).
- [ ] New sidebar sections present: Getting Started, Configuration, CLI Commands,
      Agent Commands, Architecture — plus the existing Reference (Proof /
      Benchmark / Claims / Catalog) preserved and still synced.
- [ ] Every content page is accurate against the grounding above (no stale
      `install.py`, no "Node 18", profiles not conflated).
- [ ] README banner present and positioned agent-config-style (centered) — verify
      only; add a docs-site link if missing.
- [ ] PR opened for the work.

## Phase 1 — Theme & chrome (data-helpers look)

- [x] Add deps to `site/package.json`: `starlight-theme-rapide`, `sharp`; add
      mermaid deps only if D3 resolves Astro-7-compatible, else skip.
      (rapide 0.5.2 resolved clean vs Starlight 0.41.3; lockfile updated.)
- [x] `site/astro.config.mjs`: register the rapide plugin, `customCss`,
      `favicon`, GitHub `social`, `editLink` (baseUrl to the repo `/site/`), and
      the expanded sidebar (sections per D4; keep Reference group).
- [x] Add `site/src/styles/custom.css` with the orange accent tokens + table/
      code-block polish (adapted from data-helpers `custom.css`).
- [x] Copy `.github/assets/banner.png` → `site/public/banner.png`; favicon
      (`site/public/favicon.svg`) already present.
- [x] D3: resolve mermaid — `astro-mermaid@2.1.0` peers `astro >=4` (clean Astro-7
      support, no legacy flags). Wired before Starlight; 2 diagrams added
      (generation chain, rule-loading flow).
- [x] Verify: `npm run build` builds green (25 pages).

## Phase 2 — Landing page

- [x] Update `site/src/content/docs/index.mdx` hero: banner image, agent-config
      tagline, actions (`Get Started` → getting-started, `Verify it yourself` →
      proof, `View on GitHub`). Kept the "Why this is different" cards; added an
      "Explore the docs" card grid. Splash template retained.

## Phase 3 — Getting Started section

- [x] `getting-started/introduction.md` — what agent-config is (1-screen),
      what it is/ isn't, honest-provenance note, counts.
- [x] `getting-started/installation.md` — the three install paths, flags,
      headless behaviour, **host-tool support matrix** (F4; note only the
      optional council/team features need provider keys), global-vs-project
      scope (v2.5+).
- [x] `getting-started/requirements.md` — Node ≥20.11.0 (+ site build ≥22.12),
      Python 3.10+ (bridge only), platforms.
- [x] `getting-started/quick-start.md` — the 30-second `production-validator`
      wedge + first real task; setup wizard; onboarding gate.
- [x] `getting-started/profiles-and-packs.md` — the six *experience profiles*,
      quick pick; brief note that cost/discipline profiles differ, LINK to
      `configuration/profiles.md` for the full disambiguation (F1).

## Phase 4 — Configuration section

- [x] `configuration/overview.md` — `.agent-settings.yml`, layered merge,
      write surfaces (GUI vs hand-edit), validation/sync commands.
- [x] `configuration/settings-reference.md` — compact grouped reference table of
      the key setting groups + defaults (from grounding).
- [x] `configuration/profiles.md` — **authoritative disambiguation** (F1) of the
      three+one profile concepts (experience / cost / discipline / session),
      each with its own table; qualified terms only, never bare "profile".
- [x] `configuration/packs.md` — packs & workspaces model, discovery frontmatter,
      how packs scope the surface.

## Phase 5 — CLI Commands section

- [x] `cli/overview.md` — open with the F3 clarifier (terminal CLI vs in-agent
      slash-commands); the `agent-config` binary (consumer vs maintainer
      entrypoints) + the Taskfile (`task <name>`), native-vs-delegate note.
- [x] `cli/agent-config-reference.md` — curated command reference grouped by
      cluster (install/lifecycle, diagnostics, settings, discovery, roadmap, mcp,
      memory, telemetry, council, work). Link to `registry.ts` for the full list.
- [x] `cli/taskfile-reference.md` — headline tasks (`ci`, `sync`,
      `generate-tools`, `lint-skills`, `test`, `release`, `roadmap-progress`) +
      pointer to `Taskfile.yml`/`taskfiles/` for the full battery.

## Phase 6 — Agent Commands section

- [x] `agent-commands/overview.md` — open with the F3 clarifier (in-agent
      `/slash` commands, NOT terminal/Taskfile); the slash-command model,
      `cluster:name` namespacing, orchestrator pattern.
- [x] `agent-commands/clusters.md` — the cluster overview table (counts +
      one-liners).
- [x] `agent-commands/key-commands.md` — the key-commands highlight table +
      pointer to the full catalog (`docs/catalog.md` / catalog page).

## Phase 7 — Architecture / Concepts section

- [x] `architecture/overview.md` — content+governance layer, zero-runtime,
      what-it-isn't, the four artifact types + personas (with counts).
- [x] `architecture/kernel-and-router.md` — 9 Iron-Law kernel, triggers/routes,
      `dist/router.json`, tier loading by profile.
- [x] `architecture/source-of-truth.md` — `src/` canonical, projections, the
      regeneration chain, never-edit-projections.
- [x] `architecture/trust-and-safety.md` — trust enum, HRR banner, safety floors
      (concise; link to the contract).

## Phase 8 — Wire-up, README/banner, verify

- [x] Final sidebar in `site/astro.config.mjs` reflects all new pages; slugs
      resolve (build succeeded); Reference group intact.
- [x] README: banner already present + centered (agent-config style) and the
      Documentation section already links the site — no edit needed (verify-only).
- [x] Verify: `npm run build` green under Node ≥22 (25 pages).
- [x] Verify: `./scripts-run src/scripts/check_site_links` passes (25 pages, no
      dangling internal links).

## Phase 9 — PR

- [x] Open the PR for the Starlight documentation work, targeting `main`
      (PR #995).

## Out of scope

- Rewriting the exhaustive canonical docs (`docs/architecture.md`,
  `docs/customization.md`, contracts) — the site links to them for depth.
- Changing the proof/claims/benchmark/catalog content or the `sync-docs.mjs`
  no-drift model.
- A second Astro/Pages deployment; downgrading the site's Astro version.
- Editing generated projections (`dist/`, per-tool dirs).
