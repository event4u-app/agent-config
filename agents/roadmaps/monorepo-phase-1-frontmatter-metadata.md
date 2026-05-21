---
complexity: structural
status: ready
---

# Monorepo Phase 1 — Frontmatter Metadata on All Artefacts

> First of six roadmaps that move `agent-config` from a single
> developer-centric package toward a monorepo of Core + Capability Packs.
> This roadmap ships the **metadata layer** every later phase consumes:
> the discovery manifest (Phase 2), the TypeScript installer (Phase 3),
> the physical package move (Phase 4), the trust/safety gates (Phase 5),
> and the browser wizard (Phase 6) all read the frontmatter contract
> defined here. **No manual workspace/pack list is ever maintained** —
> the release pipeline derives everything from frontmatter alone.

## Goal

Every skill, rule, command, persona, guideline, and template under
`.agent-src.uncompressed/` carries a normalized frontmatter block that
declares its `id`, `type`, `workspaces`, `packs`, `requires`, `lifecycle`,
`owner`, `trust`, and `install` block. A linter rejects any artefact that
lacks the contract or violates it. The contract is the single source of
truth for everything downstream.

## Prerequisites

- [ ] Read [`implementation-sequence.md`](implementation-sequence.md) —
      this roadmap lands in Window 2 alongside the discovery work
- [ ] Read [`monorepo-phase-2-virtual-packs-discovery.md`](monorepo-phase-2-virtual-packs-discovery.md)
      — the consumer of this contract
- [ ] Read [`skipped/multi-package-architecture.md`](skipped/multi-package-architecture.md)
      — the strategic context for Core + Packs
- [ ] Read AI Council notes in `agents/tmp/refactor-package.txt`
      sections "Pflicht-Metadaten für Skills, Rules, Commands, Templates"
      and "Trust- und Safety-Metadaten"

## Acceptance criteria

- [ ] `docs/contracts/artefact-frontmatter-v2.schema.json` exists and
      validates every required field with explicit allowed values
- [ ] `scripts/lint_artefact_frontmatter.py` enforces the schema
      against every `.md` file under `.agent-src.uncompressed/skills/`,
      `.agent-src.uncompressed/rules/`, `.agent-src.uncompressed/commands/`,
      `.agent-src.uncompressed/personas/`, `.agent-src.uncompressed/guidelines/`,
      `.agent-src.uncompressed/templates/` and exits 0
- [ ] Every existing artefact has been augmented with the required
      keys without losing any pre-existing frontmatter content
- [ ] `task ci` is green; new linter is wired via `task lint-artefact-frontmatter`
- [ ] `task sync` regenerates `.agent-src/` and `.augment/` from the
      uncompressed sources and the frontmatter survives compression

## Non-goals

- **Not** moving files to `packages/` — that is Phase 4
- **Not** generating manifests — that is Phase 2
- **Not** building installers — that is Phase 3
- **Not** redefining what a "workspace" or "pack" *means* at runtime;
      this roadmap only declares them as values on every artefact

## The frontmatter contract

```yaml
---
id: skill.laravel                  # required, unique, kebab-case after type
type: skill                        # required: skill | rule | command | persona | guideline | template
name: laravel                      # required, matches directory name
description: >                     # required, agent-facing trigger line
  Writes Laravel code following framework conventions.

# Discovery axes — drive workspace/pack selection in the installer
workspaces:                        # required, ≥1 entry, array of strings
  - engineering
packs:                             # required, ≥1 entry, array of strings
  - laravel
requires:                          # optional, array of pack-ids
  - pack.php
  - pack.engineering-base

# Lifecycle — drives deprecation and review cycles
lifecycle: active                  # required: active | experimental | deprecated | archived
owner: engineering                 # required, team or persona id
review_cycle_days: 90              # required, integer

# Trust — drives the safety gates in Phase 5
trust:
  level: core                      # required: core | professional | experimental | advisory | restricted
  confidence: high                 # required: high | medium | low
  human_review_required: false     # required, boolean

# Install — drives the TS installer's add/remove/prune logic
install:
  default: true                    # required, boolean
  removable: true                  # required, boolean
  managed: true                    # required, boolean — false = user override, never touched
---
```


## Allowed value catalogues

The schema rejects free-text in the discovery axes. Catalogues live in
`docs/contracts/discovery-vocabulary.yml` and are loaded by every linter
and installer downstream.

### `workspaces` (role-based, user-visible in the installer)

```text
engineering        # devs, SREs, platform
finance            # CFO, controllers, FP&A
product            # PM, PO, discovery
strategy           # founders, exec, advisory
sales              # AE, RevOps, pipeline
operations         # SMB owners, ops leads
content            # marketing, voice, ghostwriting
media              # video, image, audio creation
support            # CS, success, churn
governance         # security, compliance, legal
```

### `packs` (technical/functional, dependency-graph nodes)

Initial set derived from the existing directory layout. Future packs
register themselves by declaring `packs: [my-new-pack]` in any artefact;
the discovery script in Phase 2 picks them up automatically.

```text
# engineering-base
php, laravel, symfony, nextjs, react, react-native, node-express
quality-tools, testing, security, performance, database
docker, terraform, aws, github-ci, traefik
git-workflow, code-review

# finance
finance-core, dcf, scenario-modeling, runway, unit-economics

# product
product-discovery, rice, okr, prd

# strategy / sales / ops
positioning, gtm, pipeline, churn, comp-banding

# media / content
video-direction, image-design, voice-and-tone, ghostwriting

# governance
privacy, threat-modeling, secrets, authz, incident
```

## Phase 1 — Lock the schema

- [ ] Draft `docs/contracts/artefact-frontmatter-v2.schema.json`
      (JSON Schema Draft 2020-12); required keys, enum constraints,
      array minItems, pattern for `id`
- [ ] Draft `docs/contracts/discovery-vocabulary.yml` with the
      workspace and pack catalogues above
- [ ] Add ADR `docs/decisions/ADR-014-frontmatter-v2-contract.md`
      capturing the rationale, the supersession chain from any prior
      ad-hoc frontmatter, and the auto-discovery invariant
      (no manual lists ever)
- [ ] Document the contract in `docs/contracts/frontmatter-contract.md`
      with a worked example per artefact type
- [ ] `task lint-skills` continues to pass with the new ADR in place

## Phase 2 — Build the linter

- [ ] Create `scripts/lint_artefact_frontmatter.py` (stdlib + PyYAML,
      ≤ 300 LOC, `--quiet` flag, exit 0/1)
- [ ] Linter loads the JSON Schema and the vocabulary YAML, walks
      every artefact root, and validates each frontmatter block
- [ ] Linter rejects: missing keys, unknown enum values, unknown
      pack/workspace names not in the vocabulary, duplicate `id`s
- [ ] Add `task lint-artefact-frontmatter` to `Taskfile.yml`
- [ ] Wire into `task ci` after the existing `task lint-skills` step <!-- carve-out: new-gate-verification -->
- [ ] Add unit tests under `tests/scripts/test_lint_artefact_frontmatter.py`
      covering: valid case, missing key, bad enum, unknown pack,
      duplicate id, malformed YAML

## Phase 3 — Backfill skills

- [ ] Inventory all `SKILL.md` files; write a one-shot script
      `scripts/backfill_frontmatter.py` that infers initial values
      from path and existing description; produces a diff for review
- [ ] Run backfill, review per-file diffs; commit in batches grouped
      by pack (laravel, finance, video, …) so reviewers can scan
      coherent slices
- [ ] Manually audit `trust.level` and `human_review_required` for
      every finance, legal, and advisory skill — these drive Phase 5
- [ ] `task lint-artefact-frontmatter` is green for `skills/`

## Phase 4 — Backfill rules, commands, personas, guidelines, templates

- [ ] Run backfill against `rules/`, `commands/`, `personas/`,
      `guidelines/`, `templates/`
- [ ] Rules: most are `workspaces: [all]` and `packs: [core]`;
      the kernel set must declare `install.managed: true` and
      `install.removable: false`
- [ ] Commands: route via `workspaces` (a `/dcf` command lives in
      `finance`, not `engineering`)
- [ ] Personas: `workspaces` matches the lens; `packs` empty unless
      the persona ships with bundled skills
- [ ] `task lint-artefact-frontmatter` is green repo-wide

## Phase 5 — Compression survives, sync wired

- [ ] Update the caveman compressor (`.augment/skills/compress-memory/`
      consumers under `scripts/`) so frontmatter is preserved
      verbatim through `task sync`
- [ ] Add `scripts/test_frontmatter_roundtrip.py` that round-trips
      every artefact through compression and asserts frontmatter
      equality
- [ ] `task sync` regenerates `.agent-src/` and `.augment/`; both
      trees pass `task lint-artefact-frontmatter`
- [ ] `task generate-tools` regenerates `.claude/`, `.cursor/`,
      `.clinerules/`, `.windsurfrules`; the frontmatter survives
      into every downstream tool tree

## Phase 6 — Lockdown

- [ ] Add a pre-commit hook (`scripts/hooks/pre-commit-frontmatter.sh`)
      that runs the linter on staged `.md` files only
- [ ] Document the hook installation in
      `docs/contracts/frontmatter-contract.md`
- [ ] Add `frontmatter` section to `AGENTS.md` pointers under
      "Editing this repo"
- [ ] `task ci` enforces the linter; CI fails on any drift <!-- carve-out: new-gate-verification -->

## Quality gates

```bash
task lint-artefact-frontmatter      # new — must be green
task lint-skills                    # existing — must remain green
task sync && task generate-tools    # full regeneration round-trip
# remote CI runs the full pipeline; local full runs are skipped
```

## Downstream consumers (informational, not implemented here)

- Phase 2 (`monorepo-phase-2-virtual-packs-discovery.md`) reads every
  artefact's frontmatter to produce `dist/discovery-manifest.json`
- Phase 3 (`monorepo-phase-3-typescript-installer.md`) reads the
  manifest to drive workspace/pack selection and lockfile writes
- Phase 5 (`monorepo-phase-5-trust-safety-layer.md`) reads `trust.*`
  to gate execution and surface human-review prompts
- Phase 6 (`monorepo-phase-6-browser-wizard-gui.md`) reads the
  manifest to render the workspace/pack picker
