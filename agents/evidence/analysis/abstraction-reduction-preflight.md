# Abstraction-reduction pre-flight — frontmatter-default safety audit

> Phase 0 deliverable of `road-to-abstraction-reduction.md`. Classifies every
> explicit frontmatter access site, surveys published surfaces, and records the
> per-field migration disposition. No field migrates to a schema default until
> it is classified here.
>
> **Council convergence** (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
> 2026-05-29, 2 rounds, analysis lens): inject-then-checksum (migration
> invisible to installed base), value-equals-default predicate with type-safe
> comparison, defensive `condense.py` `trust.level → core` default, and a
> documented schema-evolution caveat. Architecture diverges from the council's
> "inject inside `parse_frontmatter`" lean — see § Decision A rationale.

## Step 1 — Explicit frontmatter access sites

`parse_frontmatter` (in `scripts/validate_frontmatter.py`) is imported by 33
tools. The migration only **drops a field whose value equals the schema
default**, so a consumer is at risk only when it reads a migrated field by
**required subscript** (`fm["x"]`, no fallback) and treats absence as an error.

Required-subscript / required-presence access to migrated fields:

| Site | Fields read (required) | Mechanism |
|---|---|---|
| `scripts/build_discovery_manifest.py` `_classify` (L183/187/197) | `lifecycle`, `trust`, `install` | subscript; missing → artefact dropped as "unassigned" |
| `scripts/build_discovery_manifest.py` `_artefact_checksum` (L92) | whole frontmatter dict | sha256 over FM JSON → installer drift checksum (ADR-015) |
| `scripts/check_artefact_checksums.py` `_frontmatter` | whole frontmatter dict | recomputes the same checksum to verify the committed manifest |
| `scripts/lint_artefact_frontmatter.py` (L121/125/141) | `lifecycle`, `trust`, `install` | subscript; CI linter |
| `scripts/condense.py` `_parse_trust_and_owner` (L571) | `trust.level`, `trust.human_review_required` | reads raw FM **text lines** (not the parsed dict) to inject the HUMAN REVIEW banner |

Safe `.get(...)`-with-fallback access (no migration risk): `plan_physical_move.py`
(`fm.get("trust") or {}`), `lint_trust_coherence.py` (`art.get("trust", {})` —
reads the manifest, not raw FM), `check_condensed_paths.py`
(`fm.get("validator_ignore") or []`), `check_proposal.py`
(`fm.get("type")` guarded), and the remaining ~28 importers.

## Step 2 — Per-site classification

- **(a) safe — reads with a default fallback:** all `.get()`-with-fallback
  consumers above. No change required.
- **(b) needs a parser-injected default:** `build_discovery_manifest.py` and
  `check_artefact_checksums.py` require `lifecycle`/`trust`/`install` present;
  after migration they inject schema defaults before their required-checks /
  checksum. `condense.py` is a **(b) variant** — it parses FM text lines, so
  dict-level injection does not reach it; it gets a local defensive default
  instead (Decision D). `lint_artefact_frontmatter.py` is the same required-key
  shape **but is currently a no-op**: it scans the hardcoded legacy root
  `.agent-src.uncondensed/`, which no longer exists after the monorepo move
  (`packages/*/.agent-src.uncondensed/`), so it lints 0 artefacts today. No
  injection is wired into it (would be dead code); fixing its root resolution is
  a separate concern, out of this roadmap's scope.
- **(c) parses YAML outside the central loader (external-consumer risk):** none
  found. Every Python consumer routes through `parse_frontmatter`. The published
  tool projections (`.claude/`, `.cursor/`, `.windsurfrules`) are **generated
  output**, not independent parsers — see Step 3.

## Step 3 — Published-surface survey

- The generated `.claude/skills/*/SKILL.md`, `.cursor/`, and `.windsurfrules`
  carry the full `trust`/`install`/`lifecycle`/`source` frontmatter today (pass
  through from source via condense + generate-tools). The **only** external
  consumer is Claude Code (and peers), which read `name` + `description` from
  skill frontmatter and **ignore** the `trust`/`install`/`lifecycle`/`source`
  metadata. Dropping those fields from the generated projections is therefore
  invisible to external tools.
- No npm-package bin or MCP listing parses the trust/install/lifecycle fields;
  the MCP registry manifest is built from `pack.yaml` / `package.json`, not
  artefact frontmatter.
- **Conclusion:** no external consumer depends on the explicit presence of any
  of the 26 fields. The risk surface is entirely the three internal (b)
  consumers + the condense banner.

## Step 4 — Per-field migration disposition

Default-injection is applied **before** the schema `required` check, so the
schemas keep their existing `required` lists unchanged (a field absent on disk
is present-by-default at read time). 23 of the 26 candidate fields are
safe-to-default; 3 are kept explicit because **absence is semantically
meaningful** or the structure is array-nested and low-value.

### Safe to default — migrate (drop when value == default, type-safe)

| Class | Field | Default | Coverage |
|---|---|---|---|
| skill | `source` | `package` | 217/222 (`project` minority kept) |
| skill | `lifecycle` | `active` | 100% |
| skill | `trust.level` | `core` | 100% |
| skill | `trust.confidence` | `high` | 100% |
| skill | `trust.human_review_required` | `false` | 100% |
| skill | `install.default` | `true` | 100% |
| skill | `install.removable` | `false` | 100% |
| rule | `source` | `package` | 100% |
| rule | `lifecycle` | `active` | 100% |
| rule | `trust.level` | `core` | 100% (2 advisory artefacts kept) |
| rule | `trust.confidence` | `high` | 100% |
| rule | `trust.human_review_required` | `false` | 100% (2 `true` kept) |
| rule | `install.default` | `true` | 100% |
| rule | `install.removable` | `false` | 100% |
| command | `disable-model-invocation` | `true` | 100% |
| command | `lifecycle` | `active` | 100% |
| command | `trust.level` | `core` | 100% |
| command | `trust.confidence` | `high` | 100% |
| command | `trust.human_review_required` | `false` | 100% |
| command | `install.default` | `true` | 100% |
| command | `install.removable` | `false` | 100% |
| persona | `version` | `"1.0"` | 23/24 (`"2.0"` minority kept) |
| persona | `source` | `package` | 100% |

### Kept explicit — do NOT default

| Class | Field | Why |
|---|---|---|
| skill | `execution.type` (`assisted`) | The `execution` block is optional; its absence means "instructional / manual", not "assisted". Defaulting `execution.type` only matters when the block is present, and the schema already requires `type` inside it. No omission opportunity. |
| command | `type` (`orchestrator`) | Only 21/135 commands carry `type`; absence means "ordinary command". A default of `orchestrator` would mislabel the 114 non-orchestrators. Absence is the dominant, correct state. |
| rule | `validator_ignore[].type` (`substring`) | Array-of-objects nested default; 13 uses; the migration + injector would need array-item default handling for marginal savings. Out of scope per `minimal-safe-diff`. |

### `human_review_required` edge case (council HIGH action — verified)

`grep -rl "human_review_required: true" packages/*/.agent-src.uncondensed/`
returns exactly two files: `pack-finance-basic/.../rules/finance-safety-floor.md`
and `pack-founder-strategy/.../rules/strategy-safety-floor.md`. Both use
`trust.level: advisory` (non-default), so the migration keeps their `trust.level`
explicit and the condense banner renders correctly. The defensive `condense.py`
default (Decision D) covers any **future** `core`-trust HRR artefact.

## Decisions (council-informed)

- **Decision A — architecture (divergence, documented).** Add
  `apply_schema_defaults(data, artefact_type)` to `validate_frontmatter.py` and
  call it explicitly in the four (b) consumers + the validator. The council
  leaned toward injecting inside `parse_frontmatter` with a `raw=True` escape.
  With full consumer visibility this is rejected: injecting everywhere would
  feed defaults to the boilerplate-counting tools (`inventory_abstraction_budget.py`,
  the Phase 3 linter, the migration script) which **must** see raw on-disk
  frontmatter. Both designs carry a forgotten-flag risk; Option-1's failure mode
  (a new required-subscript consumer that forgets to inject) **fails loud in CI**
  (the discovery-manifest + frontmatter linters run on every PR), whereas
  Option-2's failure mode (a boilerplate tool that forgets `raw=True`)
  **fails silent** (under-reports boilerplate). Loud-fail wins.
- **Decision B — inject-then-checksum.** Defaults are injected into the dict
  before `_artefact_checksum`, so a migrated artefact keeps the **same** checksum
  it had pre-migration; the committed `dist/discovery/discovery-manifest.json`
  stays valid and `check_artefact_checksums.py` passes without regeneration.
  Empirically gated in Phase 2 Step 4/5. The council's dual-checksum
  (`checksum_disk` + `checksum_runtime`) alternative is rejected: +12KB and a
  second hashing path for a git-correlation use case no consumer has.
- **Decision C — value-equals-default, type-safe.** The migration compares the
  **parsed** value to the default with type awareness (`"1.0"` string ≠ `1.0`
  float). It never touches the minority (`source: project`, `version: "2.0"`),
  so the <100% fields are as safe as the 100% ones.
- **Decision D — defensive condense default.** `condense.py`
  `_parse_trust_and_owner` treats an absent `trust.level` as `core` so the HUMAN
  REVIEW banner keeps rendering if a future artefact sets
  `human_review_required: true` while omitting the (default) `trust.level`.

## Schema-evolution caveat (council's strongest blind spot)

A schema `default` is now a **contract**. Changing a default value later (e.g.
flipping `lifecycle: active → deprecated`) would silently re-default every
artefact that omits the field. Mitigation: the Phase 3 contributing-doc note
states that **changing a frontmatter default is a breaking change** that
requires re-running `scripts/migrate_frontmatter_defaults.py`. No versioning
system is built — that would spawn the new-contract/new-process trap the
discovery roadmap explicitly warned against.

## Exit criteria — met

The per-field classification exists (Step 4), every explicit access site is
listed and classified (Steps 1–2), and the published-surface survey confirms no
external consumer depends on explicit presence (Step 3).
