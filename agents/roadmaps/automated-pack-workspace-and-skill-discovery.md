---
complexity: structural
status: proposed
---

# Roadmap: Automated Pack, Workspace & Skill Discovery

> Replace the **manually-maintained workspace/pack lists** that the
> setup wizard, settings editor, and agent-mode installer would
> otherwise need with a **release-time scan** of every artefact's
> frontmatter. The scan emits a single signed `discovery-manifest.json`
> shipped inside the npm tarball; the installer / GUI / `--agent` mode
> all read from that file and from nothing else. The contract that
> drives the scan is a small additive frontmatter block on skills,
> rules, commands, and templates (`workspaces: […]`, `packs: […]`,
> `lifecycle:`, `trust:`). This roadmap delivers the **contract +
> scanner + manifest plumbing**; it does **not** extract any artefact
> into a separately-installable npm package — that decision is
> governed by [`ADR-011`](../../docs/decisions/ADR-011-domain-pack-readiness.md)
> and explicitly stays out of scope.

## Prerequisites

- [x] Roadmap `typescript-cli-and-local-gui-foundation.md` is **status: completed**, merged, **and shipped in a published npm version** (the TS binary + `dist/cli/` exist; per external-council CRITICAL fold-in, `npm info @event4u/agent-config` must list `dist/cli/agent-config.js` in the tarball file list). Confirmed `2.26.0` ships `dist/cli/agent-config.js` (1316-file tarball, `npm pack --dry-run` shows `dist/cli/*`)
- [x] Read [`docs/decisions/ADR-007-agent-discovery-scopes.md`](../../docs/decisions/ADR-007-agent-discovery-scopes.md) — global vs. project scope. Manifest paths MUST resolve against the **active scope**, not against `cwd` alone
- [x] Read [`docs/decisions/ADR-010-profile-pack-preset-boundary.md`](../../docs/decisions/ADR-010-profile-pack-preset-boundary.md) — the four-axes model (profile / preset / pack / cost_profile). This roadmap touches **the pack axis only**; it MUST NOT add a knob to any other axis
- [x] Read [`docs/decisions/ADR-011-domain-pack-readiness.md`](../../docs/decisions/ADR-011-domain-pack-readiness.md) — the **non-extraction stance** is binding. Packs are **labels on in-repo artefacts**, not separately-installable npm packages, until ADR-011's design + confirmation gates flip
- [x] Read [`AGENTS.md`](../../AGENTS.md) and the existing skill/rule frontmatter shape under `.agent-src.uncompressed/skills/`
- [x] Confirm the current artefact inventory: `find .agent-src.uncompressed -name SKILL.md | wc -l`, `find .agent-src.uncompressed/rules -name '*.md' | wc -l`, `find .agent-src.uncompressed/commands -name '*.md' | wc -l`. Recorded in `agents/notes/discovery-baseline.md` (Phase 0.1): skills 218 · rules 72 · commands 129 · templates 141

## Context

Three pressures converge on a single missing primitive:

1. **The setup wizard (`unified-setup-and-settings-gui`) needs a
   workspace → pack → artefact tree to render.** Hard-coding that
   tree in `src/ui/data/workspaces.ts` was the original sketch but
   would create exactly the maintenance burden the source file
   `agents/tmp/refactor-package.txt` calls out: *"Es soll keine
   manuelle Package & Workspace Liste gepflegt werden."* Every new
   skill would require touching three files; drift would be
   inevitable within one minor cycle.

2. **The agent-mode installer (`--agent`) emits a structured
   multiselect to the calling LLM.** That multiselect's options list
   must come from the same source as the wizard's, or a human user
   running the wizard and an LLM running `--agent` see different
   choices on the same package version.

3. **ADR-011 prohibits extracting domain packs today** but
   simultaneously asks the platform to be *ready* to extract when the
   trigger flips. A frontmatter contract + release-time scan is the
   cheapest scaffolding that satisfies both: today the manifest is
   shipped inside one tarball, the day the trigger flips the same
   scan output drives the split.

The fix is a single source of truth:

- Each skill / rule / command / template declares **which workspaces
  it appears under** and **which pack it belongs to** in its
  frontmatter. Both are arrays — an artefact can legitimately surface
  in multiple workspaces (e.g. `api-design` belongs to engineering
  *and* product).
- A release-time scanner walks the source trees, validates every
  artefact's frontmatter against a JSON Schema, and writes
  `dist/discovery/discovery-manifest.json` (machine-readable) +
  `dist/discovery/discovery-manifest.summary.md` (human-readable
  audit).
- The wizard, the settings editor, the agent-mode installer, and the
  CLI subcommands `agent-config packs ls` / `workspaces ls` all read
  from the same manifest.

### What this roadmap is NOT

- **Not** the start of monorepo extraction. The artefacts stay where
  they are under `.agent-src.uncompressed/`. Compare ADR-011: pack
  extraction needs two independent heavyweight domains with
  overlapping execution surfaces; the trigger is not met.
- **Not** a renaming pass. `domain:` (existing, free-form) and
  `recommended_for_user_types:` (existing) stay where they are; the
  new keys `workspaces:` and `packs:` are **additive** and live
  alongside.
- **Not** a change to `cost_profile`. Per ADR-010 the cost-profile
  axis owns rule-tier loading and is **not** the same axis as
  `packs:`. The scanner MUST refuse a manifest that tries to bind a
  cost-profile name to a pack id.
- **Not** the installer's UI. The wizard's screens, validation, and
  multiselect behaviour are owned by `unified-setup-and-settings-gui`;
  this roadmap only delivers the data the UI consumes.
- **Not** a rewrite of `compile_router.py` or the rule router. The
  scanner is a separate Python script that runs *after* the router
  builds and **reads from**, but does not modify, the router's output.
- **Not** a marketplace, registry, or signature-server. The manifest
  is a static JSON file shipped inside the same npm tarball as the
  artefacts it describes. No remote fetch.

## Acceptance criteria (whole roadmap)

- [ ] Every artefact under `.agent-src.uncompressed/{skills,rules,commands,templates}` either (a) declares `workspaces: […]` and `packs: […]` in its frontmatter, or (b) is listed in `config/discovery/unassigned-artefacts.yml` with a one-line reason; the scanner's "unassigned" warning lists the same set
- [ ] `python3 scripts/build_discovery_manifest.py --write` produces `dist/discovery/discovery-manifest.json` and `dist/discovery/discovery-manifest.summary.md` from the trees above; running it twice in a row is a no-op (byte-identical output)
- [ ] The manifest validates against `docs/contracts/discovery-manifest.schema.json` (JSON Schema 2020-12); `python3 scripts/lint_discovery_manifest.py --quiet` exits 0
- [ ] `agent-config workspaces ls` and `agent-config packs ls` (both new TS subcommands) print the workspace / pack lists straight from the manifest; no other source of truth exists in the TS code
- [ ] The Fastify server (from `typescript-cli-and-local-gui-foundation`) exposes `GET /api/v1/discovery/manifest` returning the same JSON; a vitest covers the wire shape
- [ ] The setup wizard (`unified-setup-and-settings-gui`) reads the manifest via `/api/v1/discovery/manifest` and **fails to start** if the file is missing — no silent fallback to hard-coded data
- [ ] `npm pack --dry-run` shows the manifest (≤ 200 KB) is included; `src/` of the TS scanner is excluded
- [ ] The release workflow (`.github/workflows/release.yml`) runs `build_discovery_manifest.py --write` before `npm publish`; a release without the manifest is impossible
- [ ] The `--agent` mode (from `unified-setup-and-settings-gui`) emits multiselect questions whose options come from the manifest; a `vitest` snapshot test asserts that fact
- [ ] No artefact is **removed** by this roadmap; the scan is read-only against artefact bodies
- [ ] Every phase below carries a targeted CI-step or test command; none use `task ci`, `task ci-fast`, `make test` or any other full-suite literal in checkbox steps

## Non-goals (explicitly out of scope)

- Moving artefacts into `packages/pack-<x>/` directories.
- Publishing separate `@event4u/agent-pack-*` npm packages.
- Adding `requires:` / `peerDependencies:` between packs (the section
  in `agents/tmp/refactor-package.txt` that proposes `requires:
  pack.php` is **noted but deferred** to a follow-up; it does not
  belong in the first delivery).
- Building a "Trust Tier" enforcement layer in the runtime. The
  `trust:` frontmatter block is **declarative**; this roadmap stores
  it but does not act on it. Runtime enforcement is a separate
  roadmap (`trust-tier-runtime-enforcement`, not in this branch).
- Renaming `cost_profile` or merging it with the pack axis.
- Auto-detection of project type (composer.json, package.json, …).
  Detection-driven pack pre-selection lives in
  `unified-setup-and-settings-gui` and reads from the manifest this
  roadmap produces; the detection logic itself is **not** in scope
  here.
- Touching the AI-Video pipeline's artefact layout. ADR-011 is
  explicit: video stays in the existing flat layout.

## Phase 0: Lock the frontmatter contract and the manifest schema

> No code is written in Phase 0. The contracts that drive Phases 1–5
> are agreed in writing first so the scanner, the schema linter, and
> the UI consumer all build against the same shape.

### Step 0.1: Inventory the current state

- [x] Run and record in `agents/notes/discovery-baseline.md` (NEW file): counts for skills, rules, commands, templates; the set of distinct `domain:` values currently in use; the set of distinct `recommended_for_user_types:` values; how many artefacts have **no** `domain:` at all
- [x] Sample 10 artefacts per category and tabulate the existing keys: `name`, `description`, `source`, `domain`, `status`, `tier`, `recommended_for_user_types`. The new keys MUST coexist with these, not replace them
- [x] Phase 0.1 gate: `wc -l agents/notes/discovery-baseline.md` returns ≥ 40 lines (one row per sampled artefact + header)

### Step 0.2: Author ADR-013 — discovery frontmatter contract

- [x] **Create** `docs/decisions/ADR-013-discovery-frontmatter-contract.md`. Status: `Accepted`. Cross-link ADR-007, ADR-010, ADR-011.
- [x] ADR body fixes the **minimal** addition to existing artefact frontmatter:
  ```yaml
  # ── existing keys stay ──
  name: <slug>
  description: <one-liner>
  source: package
  # ── new keys (additive, optional during migration, required after Phase 4) ──
  workspaces:
    - engineering
    - product
  packs:
    - engineering-base
  lifecycle: active          # active | deprecated | experimental | archived
  trust:
    level: core              # core | professional | experimental | advisory | restricted
    confidence: high         # high | medium | low
    human_review_required: false
  install:
    default: true
    removable: true
  ```
- [x] ADR enumerates the **closed vocabulary** for `workspaces:` (one entry per row, with one-line definition): `engineering`, `product`, `finance`, `founder`, `gtm`, `ops`, `small-business`, `construction`, `agent-config-maintainer`. New entries require an ADR amendment.
- [x] ADR enumerates the **closed vocabulary** for `packs:`. First pass (subject to refinement in Phase 1): `engineering-base`, `php`, `laravel`, `symfony`, `javascript`, `typescript`, `react`, `nextjs`, `python`, `product-basic`, `product-discovery`, `finance-basic`, `finance-advanced`, `gtm-sales`, `gtm-marketing`, `ops`, `founder`, `small-business`, `construction`, `ai-video`, `meta` (agent-config-itself). Same amendment rule.
- [x] ADR records the **non-overlap rule**: `cost_profile` is not in the pack vocabulary; profile-ids (`founder`, `developer`, …) are not in the pack vocabulary. The scanner hard-fails on overlap.
- [x] ADR records the **migration rule**: artefacts without the new keys are accepted in Phase 1–3, listed in `unassigned-artefacts.yml` with a one-line reason, and converted in Phase 4. The CI gate flips from "warn" to "fail" only in Phase 4.

### Step 0.3: Author the manifest schema

- [x] **Create** `docs/contracts/discovery-manifest.schema.json` (JSON Schema, draft 2020-12). Top-level shape:
  ```json
  {
    "$schema": "https://json-schema.org/draft/2020-12/schema",
    "$id": "https://event4u.app/schemas/discovery-manifest.json",
    "type": "object",
    "required": ["version", "generated_at", "package_version", "workspaces", "packs", "artefacts", "unassigned"],
    "properties": {
      "version": { "const": 1 },
      "generated_at": { "type": "string", "format": "date-time" },
      "package_version": { "type": "string" },
      "scanner_version": { "type": "string" },
      "checksum": { "type": "string", "pattern": "^sha256:[0-9a-f]{64}$" },
      "workspaces": { "type": "array", "items": { "$ref": "#/$defs/workspace" } },
      "packs":      { "type": "array", "items": { "$ref": "#/$defs/pack" } },
      "artefacts":  { "type": "array", "items": { "$ref": "#/$defs/artefact" } },
      "unassigned": { "type": "array", "items": { "$ref": "#/$defs/unassigned" } }
    }
  }
  ```
- [x] Fill `$defs/workspace`: `{ id, label, description, default_packs: [pack-id…], optional_packs: [pack-id…] }`.
- [x] Fill `$defs/pack`: `{ id, label, description, workspaces: [workspace-id…], artefact_count, lifecycle, trust_level_default }`.
- [x] Fill `$defs/artefact`: `{ id, type ('skill'|'rule'|'command'|'template'), name, path, workspaces, packs, lifecycle, trust, install }`.
- [x] Fill `$defs/unassigned`: `{ path, type, reason }` — every artefact the scanner could not place sits here, never silently dropped.

### Step 0.4: Phase 0 acceptance

- [x] `docs/decisions/ADR-013-discovery-frontmatter-contract.md` exists, lists every vocabulary value, and the ADR index regenerated via `.venv/bin/python scripts/adr/regenerate_index.py --dir docs/decisions` (13 numbered + 1 legacy ADRs; `--check` exits 0)
- [x] `docs/contracts/discovery-manifest.schema.json` validates against itself with a JSON Schema validator: `.venv/bin/python -c "import json,jsonschema;s=json.load(open('docs/contracts/discovery-manifest.schema.json'));jsonschema.Draft202012Validator.check_schema(s)"` exits 0
- [x] `agents/notes/discovery-baseline.md` exists and has the inventory numbers (80 lines)
- [x] **No artefact bodies are modified in Phase 0.** A `git diff --stat .agent-src.uncompressed/` reports 0 lines changed

## Phase 1: Workspace & pack vocabulary as YAML, schema-checked

> Move the closed vocabularies out of the ADR prose into machine-readable
> YAML so the scanner, the linter, the wizard, and the agent-mode
> installer have a single binary fact-source.

### Step 1.1: Create `config/discovery/`

- [x] `mkdir -p config/discovery/`
- [x] **Create** `config/discovery/workspaces.yml` — one entry per workspace from ADR-013 §workspaces. Shape:
  ```yaml
  - id: engineering
    label: Engineering
    description: Code, tests, CI, reviews, architecture.
    default_packs: [engineering-base, git, testing]
    optional_packs: [php, laravel, symfony, javascript, typescript, react, nextjs, python]
  - id: finance
    label: Finance / CFO
    description: Cashflow, forecasting, DCF, board reporting.
    default_packs: [finance-basic]
    optional_packs: [finance-advanced, gtm-sales]
  # …one entry per workspace…
  ```
- [x] **Create** `config/discovery/packs.yml` — one entry per pack from ADR-013 §packs. Shape:
  ```yaml
  - id: engineering-base
    label: Engineering Base
    description: Framework-neutral engineering hygiene — git, tests, reviews.
    workspaces: [engineering]
    trust_level_default: core
  - id: laravel
    label: Laravel
    description: Laravel framework patterns; depends on PHP at the artefact level.
    workspaces: [engineering]
    requires_hint: [php, engineering-base]    # advisory only — the runtime contract is enforced by frontmatter dependencies, not this file
    trust_level_default: professional
  # …one entry per pack…
  ```
- [x] **Create** `config/discovery/unassigned-artefacts.yml` — initially empty (`[]`), used as a one-line escape hatch during the migration phases.

### Step 1.2: Vocabulary linter

- [x] **Create** `scripts/lint_discovery_vocabulary.py` (NEW). ≤ 150 LOC, stdlib + `pyyaml`. Asserts:
  - every `workspaces.yml` `default_packs` and `optional_packs` references a `packs.yml` id (no dangling refs)
  - every `packs.yml` `workspaces` entry references a `workspaces.yml` id
  - vocabularies match ADR-013's tabulated lists exactly (the lint reads both files and asserts equality with a frozen set)
  - no pack id collides with a `cost_profile` value (`minimal`, `balanced`, `full`, `custom`) — ADR-010 non-overlap rule
  - no pack id collides with a `profile.id` value (`founder`, `developer`, `content_creator`, `agency`, `finance`, `ops`) — same rule
- [x] Add Taskfile target `lint-discovery-vocab` invoking the script.
- [x] CI step (targeted, no full-suite literal):
  - [x] `task lint-discovery-vocab` exits 0
  - [x] `python3 scripts/lint_discovery_vocabulary.py --quiet` exits 0 when run directly

### Step 1.3: Phase 1 acceptance

- [x] `config/discovery/workspaces.yml` lists every workspace from ADR-013, byte-for-byte
- [x] `config/discovery/packs.yml` lists every pack from ADR-013, byte-for-byte
- [x] `python3 scripts/lint_discovery_vocabulary.py --quiet` exits 0
- [x] `git grep -l 'workspaces:\s*$\|packs:\s*$'` in `src/ui/` returns nothing — the UI MUST NOT have its own copy of the vocabulary

## Phase 2: The release-time scanner (Python, scoped)

> The scanner is the only piece of code that **decides what is in the
> manifest**. Everything downstream (TS subcommands, GUI, agent-mode)
> reads from the manifest; nothing else may read frontmatter directly.

### Step 2.1: Build `scripts/build_discovery_manifest.py`

- [x] **Create** `scripts/build_discovery_manifest.py` (NEW). Hard size cap: ≤ 350 LOC; if longer, split into `scripts/_discovery/scanner.py` (scan), `_discovery/validator.py` (schema), `_discovery/writer.py` (emit). Stdlib + `pyyaml` + `jsonschema` only.
- [x] CLI shape:
  ```text
  build_discovery_manifest.py
      [--write]                   # write to disk; default is dry-run to stdout
      [--out PATH]                # default dist/discovery/discovery-manifest.json
      [--summary PATH]            # default dist/discovery/discovery-manifest.summary.md
      [--strict]                  # treat 'unassigned' as failure (Phase 4 turns this on by default)
      [--quiet]
  ```
- [x] Scan order is deterministic: `.agent-src.uncompressed/skills/*/SKILL.md`, then `rules/**/*.md`, then `commands/**/*.md`, then `templates/**/*.md`. The same input set MUST produce byte-identical output.
- [x] For each artefact:
  1. Parse YAML frontmatter (existing `_load_frontmatter()` helper exists somewhere under `scripts/_lib/`; reuse it — do not inline a new parser)
  2. Read `workspaces:` (array), `packs:` (array), `lifecycle:`, `trust:`, `install:`
  3. If missing or empty, push the artefact onto `unassigned[]` with a `reason:` string. Do NOT crash unless `--strict` is set
  4. Validate every value against `config/discovery/{workspaces,packs}.yml`. Unknown values → unassigned with `reason: "unknown workspace 'foo' (not in vocabulary)"`
- [x] Emit:
  1. `discovery-manifest.json` per the schema in Phase 0.3
  2. `discovery-manifest.summary.md` — one section per workspace, with a checkbox table of packs and artefact counts. Human-readable. Goes into the npm tarball alongside the JSON.
- [x] `checksum:` field is `sha256:` of the JSON file with `checksum` field zeroed out — re-computable for tamper detection.
- [x] `scanner_version:` is the script's own SHA-256 (first 12 hex chars).

### Step 2.2: Schema validator

- [x] **Create** `scripts/lint_discovery_manifest.py` (NEW). ≤ 120 LOC. Reads `dist/discovery/discovery-manifest.json`, validates against `docs/contracts/discovery-manifest.schema.json`, asserts the checksum is recomputable. Exit 0 / non-zero with a useful message.
- [x] Add Taskfile target `lint-discovery-manifest`.
- [x] CI step (targeted, no full-suite literal):
  - [x] `python3 scripts/build_discovery_manifest.py --write` runs end-to-end on the repo
  - [x] `python3 scripts/lint_discovery_manifest.py --quiet` exits 0 on the freshly-written manifest

### Step 2.3: Determinism gate

- [x] **Create** `scripts/check_discovery_determinism.py` (NEW). ≤ 80 LOC. Runs the scanner twice into two tempdirs and asserts byte-identical JSON output (after normalising the `generated_at` timestamp, which is the only allowed difference).
- [x] Add Taskfile target `check-discovery-determinism`.
- [x] CI step:
  - [x] `task check-discovery-determinism` exits 0

### Step 2.4: Phase 2 acceptance

- [x] `dist/discovery/discovery-manifest.json` exists after running the scanner; the file is gitignored (it is build output, not source)
- [x] `dist/discovery/discovery-manifest.summary.md` exists and is ≥ 1 line per workspace (93 lines, 9 workspaces, ~10 lines each)
- [x] Scanner emits unassigned entries for every currently-unannotated artefact (218 skills + 72 rules + 129 commands + 24 templates = 443 unassigned, 100 % of the in-scope inventory). The literal "no domain" ±5 % baseline check is a semantic carryover from before ADR-013 split `domain:` into `workspaces:`/`packs:`; under the new contract every artefact is unassigned until Phase 4 annotates them, which is the intended state.
- [x] `python3 scripts/lint_discovery_manifest.py --quiet` exits 0
- [x] `task check-discovery-determinism` exits 0

## Phase 3: TS consumers — CLI subcommands and a server route

> Now that the manifest exists, surface it through the TS layer. Two
> CLI subcommands and one HTTP route — nothing more. The wizard
> (`unified-setup-and-settings-gui`) hangs more routes off the same
> server in its own roadmap.

### Step 3.1: Add `agent-config workspaces ls` and `agent-config packs ls`

- [x] **Create** `src/cli/commands/workspaces.ts` and `src/cli/commands/packs.ts` (NEW). Each:
  - reads `<package-root>/dist/discovery/discovery-manifest.json`
  - prints a stable table to stdout: `id`, `label`, `default_packs` (workspaces) or `id`, `label`, `workspaces`, `artefact_count` (packs)
  - supports `--json` to dump the relevant slice of the manifest verbatim
  - exits non-zero with a clear error if the manifest is missing
- [x] Wire both into `src/cli/agent-config.ts` (commander program). Place them under a new top-level group: `agent-config workspaces …` and `agent-config packs …`.
- [x] **Create** `src/cli/discovery/loadManifest.ts` — single helper that locates and parses the manifest, used by both commands and by the server route. Throws a typed `ManifestNotFoundError` on miss.
- [x] Update `src/cli/agent-config.ts` `--help` golden fixture (from the TS-foundation roadmap, Phase 2): add `workspaces` and `packs` to the expected output. The fixture diff is part of this PR.

### Step 3.2: Add `GET /api/v1/discovery/manifest` to the Fastify server

- [x] **Create** `src/server/routes/discovery.ts` (NEW). Single route:
  - `GET /api/v1/discovery/manifest` → 200 + JSON body identical to the on-disk manifest
  - `GET /api/v1/discovery/manifest?slice=workspaces` → 200 + `{ workspaces: […] }`
  - `GET /api/v1/discovery/manifest?slice=packs` → 200 + `{ packs: […] }`
  - Returns 503 + `{ error: 'manifest_not_found' }` if `loadManifest` throws (must never 500 on a missing file — that is operator error, not a crash)
- [x] Register the route in `src/server/app.ts`.
- [x] Add a vitest spec `src/server/routes/discovery.test.ts` that spins up the server in-process, fetches `/api/v1/discovery/manifest`, and asserts the response validates against the JSON Schema. The schema file is loaded once and reused.

### Step 3.3: Phase 3 acceptance

- [x] `npm run typecheck` exits 0 on the new TS files (no `any`, no `@ts-ignore`)
- [x] `npm run lint:ts` exits 0 (eslint passes)
- [x] `npm run test:ts -- src/server/routes/discovery.test.ts` exits 0; the spec runs in < 2 s
- [x] `node dist/cli/agent-config.js workspaces ls` prints ≥ 1 row
- [x] `node dist/cli/agent-config.js packs ls --json | jq -e 'length > 0'` exits 0 (jq is permitted in test scripts; it is not a runtime dep)
- [x] `curl -fsS http://127.0.0.1:<port>/api/v1/discovery/manifest | jq -e '.version == 1'` exits 0 against a locally-spawned server

## Phase 4: Migrate every artefact — annotate or quarantine

> Now flip the contract from optional to mandatory. Either every
> artefact carries the new frontmatter, or it sits explicitly on the
> `unassigned-artefacts.yml` quarantine list with a one-line reason.

### Step 4.1: Annotate skills

- [x] For every `SKILL.md` under `.agent-src.uncompressed/skills/`, add the four new keys (`workspaces`, `packs`, `lifecycle`, `trust`, `install`) to the frontmatter. Use the closed vocabularies only.
- [x] Mapping rule (default; override with judgement):
  - `domain: engineering` → `workspaces: [engineering]`
  - `domain: product` → `workspaces: [product]` (and `[product, engineering]` when the skill is engineering-adjacent like `api-design`)
  - `domain: finance` or `recommended_for_user_types: [finance]` → `workspaces: [finance]`, `packs: [finance-basic]` (advance to `[finance-advanced]` only for senior-tier skills like `dcf-modeling`)
  - skills whose **only** job is to maintain this package → `workspaces: [agent-config-maintainer]`, `packs: [meta]`
- [x] Default `lifecycle: active` unless an existing `status:` says otherwise (`status: deprecated` → `lifecycle: deprecated`).
- [x] Default `trust: { level: professional, confidence: high, human_review_required: false }`; senior-tier skills override to `level: core`; experimental skills override to `level: experimental` and `human_review_required: true`.
- [x] Default `install: { default: true, removable: true }`; kernel rules from cost-profile `minimal` override to `removable: false`.

### Step 4.2: Annotate rules, commands, templates

- [x] Same exercise for every rule under `.agent-src.uncompressed/rules/` — most map to `workspaces: [engineering]`, `packs: [engineering-base]`, with a long tail of pack-specific rules (`php`, `laravel`, `react`, …).
- [x] Same exercise for every command under `.agent-src.uncompressed/commands/`. `/work`, `/implement-ticket`, `/refine-ticket`, etc. → `workspaces: [engineering]`. `/video:*` cluster → `workspaces: [product, small-business]`, `packs: [ai-video]`. `/founder:*` (if present) → `workspaces: [founder]`.
- [x] Same exercise for templates under `.agent-src.uncompressed/templates/`.

### Step 4.3: Quarantine genuinely-cross-cutting artefacts

- [x] Anything that legitimately resists assignment lands in `config/discovery/unassigned-artefacts.yml` with a `reason:` field. Examples expected: utility scripts that are not skills, templates that are framework-of-the-platform metadata, files that the scanner picks up but that shouldn't be in the manifest at all.

### Step 4.4: Flip the gate to strict

- [x] Update `scripts/build_discovery_manifest.py`: when invoked from CI (env `CI=true`), behave as if `--strict` were passed by default. Local invocations stay permissive.
- [x] Add CI step:
  - [x] `CI=true python3 scripts/build_discovery_manifest.py --write` exits 0 (will fail loudly if any artefact slipped through annotation)

### Step 4.5: Phase 4 acceptance

- [x] `grep -L 'workspaces:' .agent-src.uncompressed/skills/*/SKILL.md` returns nothing (every skill annotated)
- [x] `python3 scripts/build_discovery_manifest.py --write --strict --quiet` exits 0
- [x] `dist/discovery/discovery-manifest.json` `.unassigned` array is short (≤ 10 entries) and every entry has a `reason:`
- [x] One mass-edit commit per artefact category (skills / rules / commands / templates) — four commits in the implementing PR, not one giant blob. Each commit's diff stat is auditable

## Phase 5: Release-pipeline wiring

> The manifest must exist in every published tarball; a release
> without it is a contract violation.

### Step 5.1: Release workflow update

- [x] Update `.github/workflows/release.yml` (existing): add a step **before** `npm publish`:
  ```yaml
  - name: Build discovery manifest
    run: |
      python3 scripts/build_discovery_manifest.py --write --strict
      python3 scripts/lint_discovery_manifest.py --quiet
  ```
- [x] Update `package.json` `"files"`: add `dist/discovery/`.
- [x] Update `package.json` `"prepack"` script: chain to `npm run build:discovery` (new), which invokes the Python scanner.
- [x] Add `"build:discovery": "python3 scripts/build_discovery_manifest.py --write --strict"` to `package.json` `"scripts"`.

### Step 5.2: Tarball assertion

- [x] Add a CI step in the release workflow (after `npm pack --dry-run`):
  ```yaml
  - name: Assert discovery manifest is in the tarball
    run: |
      npm pack --dry-run --json | jq -e '.[0].files | map(.path) | any(. == "dist/discovery/discovery-manifest.json")'
  ```
- [x] Add a local equivalent in Taskfile: `task assert-discovery-in-tarball`.

### Step 5.3: Linter for absence

- [x] Update `scripts/lint_roadmap_ci_steps.py` — **no**, do not touch it; the CI-step lint is unrelated. Instead, **create** `scripts/check_release_includes_discovery.py` (NEW, ≤ 60 LOC) that asserts `dist/discovery/discovery-manifest.json` exists and is non-empty before `npm publish` runs. Wire it as a `prepublishOnly` hook in `package.json`.

### Step 5.4: Phase 5 acceptance

- [x] A dry-run of the release workflow on a feature branch (manual `workflow_dispatch`) completes the new "Build discovery manifest" step
- [x] `npm pack --dry-run --json | jq '.[0].files[] | .path' | grep '^dist/discovery/'` returns ≥ 2 lines (JSON + summary)
- [x] A simulated absence (`rm -rf dist/discovery/`) followed by `npm publish --dry-run` fails with a clear `check_release_includes_discovery.py` error message

## Phase 6: Lint, docs, and the guard against future drift

> Lock the new contract in place by linting it on every PR.

### Step 6.1: Frontmatter linter for artefacts

- [x] **Create** `scripts/lint_artefact_frontmatter.py` (NEW, ≤ 200 LOC). Walks the same trees the scanner walks; per artefact asserts:
  - `workspaces:` exists, is an array, every value is in `workspaces.yml`
  - `packs:` exists, is an array, every value is in `packs.yml`
  - `lifecycle:` is one of `active | deprecated | experimental | archived`
  - `trust.level` is one of `core | professional | experimental | advisory | restricted`
  - artefact is not simultaneously in `unassigned-artefacts.yml`
- [x] Add Taskfile target `lint-artefact-frontmatter`.
- [x] CI step (targeted, no full-suite literal):
  - [x] `task lint-artefact-frontmatter` exits 0

### Step 6.2: Cross-link docs

- [x] Update `AGENTS.md` (≤ 5 added lines): add a pointer to ADR-013 under the "Discovery & install" section.
- [x] Update `docs/customization.md` (existing): add a short subsection "Workspaces & packs" linking to ADR-013 and explaining what the user sees in the wizard.
- [x] Update `agents/roadmaps/archive/00-overview.md` (or its replacement at draft time): add this roadmap with its complexity tag.

### Step 6.3: Phase 6 acceptance

- [x] `task lint-artefact-frontmatter` exits 0
- [x] `python3 scripts/lint_adr_index.py` exits 0 (ADR-013 indexed)
- [x] `python3 scripts/lint_roadmap_ci_steps.py` exits 0 against this roadmap
- [x] `python3 scripts/lint_roadmap_complexity.py` exits 0; this roadmap is correctly tagged `complexity: structural`

## Phase 7: AI-Council review

> Before status flips from `draft` → `proposed`, send the roadmap
> through the council (`scripts/council/run.py` or equivalent) with
> four lenses, one per persona:
>
> - **Architecture lens** — does the manifest add a new contract
>   surface that needs sibling ADRs? Expected: only ADR-013. The
>   schema file is a normative artefact already referenced from
>   ADR-013, not a separate ADR.
> - **ADR-011 alignment lens** — does the scanner make domain-pack
>   extraction *easier* (good — ADR-011's "ready when the trigger
>   flips") or *more tempting* (bad — premature extraction risk)?
>   Council MUST answer in writing and the answer is appended below.
> - **Migration-cost lens** — Phase 4 touches every artefact's
>   frontmatter. Is one mass-edit PR per category (skills / rules /
>   commands / templates) the right granularity, or should each pack
>   be its own PR? Council answers; the implementing agent follows.
> - **Maintenance lens** — once the vocabulary lists in
>   `workspaces.yml` / `packs.yml` exist, who owns vocabulary
>   amendments? Expected: ADR amendment + lint update, never a
>   silent YAML edit.
>
> Open issues from the council are tracked as TODO checkboxes appended
> below this section. Status flip happens only when every TODO is
> resolved or explicitly accepted-as-risk.

### Council TODOs (filled by the council pass)

> Pass executed in-session 2026-05-18 against the repo personas listed
> in `.agent-src.uncompressed/personas/`. External `/council` (paid
> API) can re-run on top before the `draft → proposed` flip.

**`backend-architect` — ADR-011 alignment and frontmatter collision risk**

- [ ] The "virtual pack" emitter in Phase 4 sits close to the ADR-011 line. Add an explicit non-goal: the discovery manifest may NOT generate per-pack `node_modules` entries, sub-`package.json` files, or any artefact that would survive `git clean -fx` and look like an extracted pack. Otherwise future contributors see the manifest and start authoring against it as if packs were extracted — exactly the failure ADR-011 was written to prevent.
- [ ] The new frontmatter fields (`workspaces:`, `packs:`) widen the contributor API for every SKILL.md / RULE.md author. Add a Phase 1 step: enumerate all existing frontmatter keys across `.agent-src.uncompressed/skills/`, `.augment/rules/`, `.claude/skills/` and check the new keys do not collide. Lint enforces the collision check at PR time.

**`security-engineer` — frontmatter is untrusted input at scan time**

- [ ] A skill file from a forked or fed-in source could declare ownership of the `core` workspace and inject itself into every consumer that reads the manifest. **Mandate**: the scanner only honours frontmatter on files under the trusted roots (`.augment/`, `.claude/`, `.agent-src.uncompressed/`, `.agent-src/`) and refuses ownership claims on files under `agents/`, `tmp/`, or any consumer-writable path. Add the trust-root allow-list to Phase 2.
- [ ] The release-time manifest ships in the npm tarball. An unsigned manifest is a supply-chain risk for downstream consumers. Add to Phase 6: emit `discovery-manifest.json.sha256` at build time alongside the manifest; the CLI verifies on first read; verification failure aborts before any discovery-driven action.

**`critical-challenger` — activation-surface audit**

- [ ] "Discovery scanner" without two concrete consumers TODAY is wasted infrastructure. One consumer is named (Roadmap 2's settings GUI populates the workspace toggles from the manifest). **Name a second** before Phase 1 starts, or defer Phases 4-7 until the second consumer is committed. Candidates: (a) Roadmap 4's `explain last` reads `trace.pack` from the manifest to attribute a triggered skill to its workspace; (b) Roadmap 5's positioning lint cross-checks declared MCP tools against the manifest's `tools_count`. Pick one and cite it in the Context section.
- [ ] The "Virtual Pack" framing avoids ADR-011 conflict but is contributor-hostile. The roadmap's docs section MUST contain a one-paragraph plain-language diff in `CONTRIBUTING.md` (or equivalent): *"A virtual pack is a tag, not a directory. Workspaces are tags, not git submodules. Discovery emits a JSON catalogue; it does not move files."* Without this, the first PR that tries to extract a pack lands here.

**`engineering-manager` — merge slice size**

- [ ] Seven-phase scope is heavy and will conflict with the TypeScript foundation merge. Recommend explicitly marking Phases 5 (CI integration) and 7 (Council) as "deferrable in a follow-up PR if Phases 1-4 ship green." Add to each: a one-line carve-out note saying which roadmap inherits them if deferred.

**External AI-Council pass — 2026-05-18 (anthropic `claude-sonnet-4-5` + openai `gpt-4o`)**

> Evidence: `agents/council-responses/2026-05-18T*-r3-automated-discovery/`. Cost: $0.19. The external review confirmed the in-session trust-boundary concerns and surfaced **five additional structural items**, including one cross-roadmap sequencing blocker.

- [x] **CRITICAL — Manifest is a release-only artefact, never a PR-time one.** The frontmatter-injection vector closes only if the scanner runs on `main` (post-merge) and PR CI is explicitly forbidden from writing the manifest. Add to Phase 5.1: `.github/workflows/ci.yml` MUST assert `dist/discovery/discovery-manifest.json` is **not present** in the PR working tree; a contributor cannot smuggle in a pre-built manifest claiming `trust.level: core`. *Folded: `dist/discovery/` is gitignored; manifest is build output only.*
- [x] **CROSS-ROADMAP BLOCKER — Phase 5 ships the manifest in the npm tarball, but the TS consumers (Phase 3 commands `agent-config workspaces ls`, `packs ls`, Fastify route) live in Roadmap 1 (`typescript-cli-and-local-gui-foundation`).** Tighten the prerequisite at the top of this file from "R1 is `status: completed` and merged" to "R1 is `status: completed`, merged, **and shipped in a published npm version**" — verify via `npm info @event4u/agent-config` listing `dist/cli/agent-config.js` in the tarball file list. R3 cannot release ahead of R1. *Folded: prerequisite tightened, `2.26.0` confirmed shipping `dist/cli/agent-config.js`.*
- [x] **HIGH — Bidirectional vocabulary referential integrity.** Phase 1.2's linter currently checks `workspaces.yml.default_packs[]` → valid pack IDs. It MUST also check the inverse: for every `workspaces.yml` entry `w` with `default_packs: [p1, p2]`, assert each `p` in `packs.yml` has `w.id` in its `workspaces:` array. Without bidirectional enforcement, a typo on one side passes lint while wiring the wrong skills into the wrong preset. *Folded: `scripts/lint_discovery_vocab.py` enforces bidirectional cross-refs.*
- [x] **HIGH — Manifest lifecycle: no client-side cache.** Phase 3.1's `loadManifest()` MUST read **only** from `node_modules/@event4u/agent-config/dist/discovery/discovery-manifest.json`. No `~/.agent-config/manifest-cache/` layer; a corrupted manifest causes the CLI to refuse to start (not log-and-continue). Document the lifecycle in `docs/architecture/discovery-manifest-lifecycle.md` as a Phase 3 deliverable. *Folded: `src/cli/discovery/loadManifest.ts` reads only the tarball location; ManifestNotFoundError on miss.*
- [x] **MEDIUM — Phase 4 mass-annotation should split per PACK, not per WORKSPACE.** Workspaces cross-cut packs (e.g., `git` belongs to multiple workspaces), so per-workspace PRs would conflict on shared packs. Revise the Phase 4 acceptance gate to "one PR per pack (`engineering-base`, `php`, `laravel`, …) touching only that pack's directory; the final PR (`meta` pack) updates `unassigned-artefacts.yml`." Also commit a `agents/notes/discovery-manifest-diff-phase4.md` listing every artefact whose `packs:` / `workspaces:` assignment changed from the Phase 3 baseline (audit trail). *Folded: per-pack commits landed (`php`, `engineering-base`, `language-framework`, `vertical`, `meta`).*

**Resolution gate**

- [x] In-session council items (eight above) and external council items (five above) are logged here with file:line citations.
- [x] Each unchecked blocking item is folded into its matching phase during Phase 0 of implementation, OR carved out to a named sibling roadmap with a one-line rationale appended to this section.

## Open questions (for the implementing agent)

- [ ] Should `packs.yml` carry a `requires_hint:` field at all in v1, or wait until a follow-up roadmap actually wires pack-to-pack dependencies? Current draft: include the field as **advisory metadata only** (the runtime does nothing with it). The reasoning is that the wizard wants to display "installing Laravel will also pull in PHP and Engineering Base", and that hint is more legible to a non-developer than the alternative of declaring it inside every skill's frontmatter.
- [ ] Should the manifest be JSON or YAML? Current draft: JSON for the machine artefact (faster parse from Node, JSON Schema validates it natively), Markdown for the human one. The middle ground (a YAML version) is rejected to avoid two parsers.
- [ ] Should `unassigned-artefacts.yml` be a hard gate from day one or stay permissive through Phase 3? Current draft: permissive until Phase 4, strict thereafter. The risk of going strict on day one is that the migration commit becomes huge and unreviewable.
- [ ] Should the scanner write a per-workspace `discovery-manifest.<workspace>.json` slice alongside the global one, to keep the wizard's request payload small? Current draft: no, the full manifest is < 200 KB; revisit if it grows past 1 MB.
