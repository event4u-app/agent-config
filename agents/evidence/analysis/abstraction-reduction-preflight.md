# Frontmatter-defaults pre-flight

> Phase 0 deliverable of [`agents/roadmaps/road-to-abstraction-reduction.md`](../../roadmaps/road-to-abstraction-reduction.md). Audits every explicit frontmatter access in the runtime + tooling layer, classifies each per-field migration safety, and decides per-field disposition for Phase 1+. No artefact moves until this file is reviewed.

## TL;DR

- **26 fields** identified in [`abstraction-budget-inventory.md`](abstraction-budget-inventory.md) § "Frontmatter boilerplate candidates" as ≥95% identical across 335 artefacts.
- **0 external YAML parsers.** All artefact frontmatter flows through the central `scripts/validate_frontmatter.py::parse_frontmatter` parser. No `.claude/`, `.cursor/`, `.windsurf/`, or npm-consumer reads the source frontmatter directly — projections own their own copy.
- **2 central loaders + 1 build-time consumer:** `validate_frontmatter.py` (schema gate), `scripts/build_discovery_manifest.py` (Phase-4 manifest), and a constellation of linter scripts (`lint_artefact_frontmatter.py`, `audit_auto_rules.py`, etc.). All hard-reads (no fallback) live in **build_discovery + lint_artefact_frontmatter** — that's the migration surface that needs parser-injected defaults.
- **Disposition:** **25 of 26 fields** safe to migrate (7 directly via `.get(default)` patterns, 18 once the loader injects schema defaults). **1 field** (`disable-model-invocation`) deferred to Phase 2 follow-up — its default must be injected at the `.claude/` projection layer, not at source, and that surface lives outside the Phase 0 → Phase 2 scope.

## Central loaders

| Path | Role | Reads which fields? |
|---|---|---|
| `scripts/validate_frontmatter.py` | Schema gate; parses YAML frontmatter for every artefact via `parse_frontmatter(text)` | All — but only validates, does not inject defaults today |
| `scripts/_lib/agent_settings.py` | Agent-settings cascade loader (`.agent-settings.yml`) | NOT artefact frontmatter — unrelated; documented for completeness |
| `scripts/build_discovery_manifest.py` | Phase-4 discovery-manifest builder; emits `dist/discovery/discovery-manifest.json` | All discovery-relevant: `lifecycle`, `trust.*`, `install.*`, `workspaces`, `packs` |

The remaining downstream consumers are linters / inventory scripts. None bypass the central parser; every site goes through `parse_frontmatter` or a wrapper.

## Access-site inventory

Source: grep across `scripts/`, `src/`, `packages/*/installer/`, `packages/*/deploy/`, `hooks/`, `bin/`, `dist/`, `internal/` for explicit reads on the 26 fields and their parent dicts. Test files included with `(test)` tag.

### Hard reads — no default fallback (require parser injection)

These will silently break if we remove the explicit field from source AND the schema/loader doesn't inject the default first.

| Field | File | Line | Read pattern |
|---|---|---:|---|
| `lifecycle` | `scripts/build_discovery_manifest.py` | 183 | `lc = fm["lifecycle"]` |
| `lifecycle` | `scripts/lint_artefact_frontmatter.py` | 121 | `lc = fm["lifecycle"]` |
| `trust` (parent) | `scripts/build_discovery_manifest.py` | 187 | `trust = fm["trust"]` |
| `trust` (parent) | `scripts/lint_artefact_frontmatter.py` | 125 | `trust = fm["trust"]` |
| `trust.level` | `scripts/build_discovery_manifest.py` | 190, 219 | `trust["level"]` (read + write) |
| `trust.confidence` | `scripts/build_discovery_manifest.py` | 192, 220 | `trust["confidence"]` (read + write) |
| `trust.human_review_required` | `scripts/build_discovery_manifest.py` | 194, 221 | `trust["human_review_required"]` (read + write) |
| `install` (parent) | `scripts/build_discovery_manifest.py` | 197 | `install = fm["install"]` |
| `install` (parent) | `scripts/lint_artefact_frontmatter.py` | 141 | `install = fm["install"]` |
| `install.default` | `scripts/build_discovery_manifest.py` | 200, 223 | `install["default"]` (read + write) |
| `install.removable` | `scripts/build_discovery_manifest.py` | 200, 223 | `install["removable"]` (read + write) |
| `workspaces` | `scripts/build_discovery_manifest.py` | 169 | `ws = fm["workspaces"]` |
| `workspaces` | `scripts/lint_artefact_frontmatter.py` | 105 | `ws = fm["workspaces"]` |
| `packs` | `scripts/build_discovery_manifest.py` | 176 | `pk = fm["packs"]` |
| `packs` | `scripts/lint_artefact_frontmatter.py` | 113 | `packs = fm["packs"]` |
| `packs` | `scripts/new_skill.py` | 87 | `fm["packs"]` (read + delete) |

`workspaces` + `packs` are **not** in the 26-field list (they vary per artefact). They are documented here because the same hard-read pattern in `build_discovery_manifest.py` covers both — any parser-injection patch for the discovery keys lifts both for free.

### Safe-default sites (already use fallback or guarded read)

17 sites use `.get(default)`, `?? default`, or guarded patterns. They will keep working whether the explicit field is present or absent in source — the call site supplies its own default. Listed in the appendix to keep this section compact.

### External YAML parses

**Zero.** No script under `scripts/`, `src/`, `packages/*/installer/`, or `dist/cli/` calls `yaml.load` / `yaml.safe_load` / `YAML.parse` on artefact files. Everything goes through `parse_frontmatter`.

### External (consumer-side) parsers

The projection targets — `.claude/skills/`, `.cursor/`, `.windsurf/`, `.augment/` — carry their own copies of the frontmatter. Whether external clients parse the fields is consumer-side and out of our process control.

- **Claude Code** — reads `name`, `description`, `disable-model-invocation`, `allowed-tools`. The other 25 fields are ignored by Claude Code's parser; their presence is package-internal.
- **Cursor** — reads `name`, `description`, `globs`, `alwaysApply`. The 26 candidate fields are ignored.
- **Windsurf** — reads `name`, `description`, glob/trigger config. The 26 candidate fields are ignored.
- **Augment** — consumes the `.augment/` projection. Schema is open; treats unknown fields as documentation.

**Conclusion:** of the 26 candidate fields, only `command.disable-model-invocation` is read by an external consumer (Claude Code). The other 25 are package-internal and safe to migrate at the source layer.

## Per-field migration disposition

Classes (from the roadmap):

- **(a) safe-to-default** — schema default declaration is enough; no loader injection required because no hard-read site exists.
- **(b) parser-injected default** — schema default + loader injects the default into the parsed dict so the hard-read sites keep working without code changes.
- **(c) keep explicit (or projection-time injection)** — external consumer depends on the field; source-side removal risks consumer regression.

### Skills (8 fields)

| # | Field | Default | Pop. | Hard reads? | Class | Notes |
|---|---|---|---:|---|:---:|---|
| 1 | `source` | `package` | 98% / 129 | none | (a) | 2% non-default: keep those explicit; defaults migration covers the 98% |
| 2 | `lifecycle` | `active` | 100% / 129 | discovery + lint | (b) | Loader injection required |
| 3 | `trust.level` | `core` | 100% / 129 | discovery (3×) | (b) | Loader must inject `trust = {}` then nested `.level` |
| 4 | `trust.confidence` | `high` | 100% / 129 | discovery (2×) | (b) | Same nested path |
| 5 | `trust.human_review_required` | `false` | 100% / 129 | discovery (2×) | (b) | Same nested path |
| 6 | `install.default` | `true` | 100% / 129 | discovery (2×) | (b) | Loader must inject `install = {}` then nested `.default` |
| 7 | `install.removable` | `false` | 100% / 129 | discovery (2×) | (b) | Same nested path |
| 8 | `execution.type` | `assisted` | 100% / 26 | none | (a) | Only 26 artefacts carry this; pure schema default |

### Rules (8 fields)

| # | Field | Default | Pop. | Hard reads? | Class | Notes |
|---|---|---|---:|---|:---:|---|
| 9 | `source` | `package` | 100% / 71 | none | (a) | Pure schema default |
| 10 | `lifecycle` | `active` | 100% / 71 | discovery + lint | (b) | Same loader patch as skills |
| 11 | `trust.level` | `core` | 100% / 71 | discovery (3×) | (b) | Same loader patch |
| 12 | `trust.confidence` | `high` | 100% / 71 | discovery (2×) | (b) | Same loader patch |
| 13 | `trust.human_review_required` | `false` | 100% / 71 | discovery (2×) | (b) | Same loader patch |
| 14 | `install.default` | `true` | 100% / 71 | discovery (2×) | (b) | Same loader patch |
| 15 | `install.removable` | `false` | 100% / 71 | discovery (2×) | (b) | Same loader patch |
| 16 | `validator_ignore[].type` | `"substring"` | 100% / 13 | safe `.get()` | (a) | List-element default; only 13 artefacts — schema-level default on the list-item shape |

### Commands (8 fields)

| # | Field | Default | Pop. | Hard reads? | Class | Notes |
|---|---|---|---:|---|:---:|---|
| 17 | `disable-model-invocation` | `true` | 100% / 135 | linter only | **(c)** | **External consumer (Claude Code).** Source removal requires the `.claude/skills/` projection to inject `disable-model-invocation: true`. That's outside the Phase 2 source-migration scope; defer to a follow-up plate inside Phase 2 OR a separate roadmap once Phase 2 lands. |
| 18 | `lifecycle` | `active` | 100% / 135 | discovery + lint | (b) | Same loader patch |
| 19 | `trust.level` | `core` | 100% / 135 | discovery (3×) | (b) | Same loader patch |
| 20 | `trust.confidence` | `high` | 100% / 135 | discovery (2×) | (b) | Same loader patch |
| 21 | `trust.human_review_required` | `false` | 100% / 135 | discovery (2×) | (b) | Same loader patch |
| 22 | `install.default` | `true` | 100% / 135 | discovery (2×) | (b) | Same loader patch |
| 23 | `install.removable` | `false` | 100% / 135 | discovery (2×) | (b) | Same loader patch |
| 24 | `type` | `orchestrator` | 100% / 21 | safe `.get()` | (a) | Only 21 artefacts carry it; pure schema default |

### Personas (2 fields)

| # | Field | Default | Pop. | Hard reads? | Class | Notes |
|---|---|---|---:|---|:---:|---|
| 25 | `version` | `"1.0"` | 97% / 30 | none | (a) | 3% non-default: keep those explicit |
| 26 | `source` | `package` | 100% / 30 | none | (a) | Pure schema default |

### Class totals

- **(a) safe-to-default — pure schema work:** 7 fields (skill.source, skill.execution.type, rule.source, rule.validator_ignore[].type, command.type, persona.version, persona.source).
- **(b) parser-injected default — loader patch required:** 18 fields (the 6 shared `lifecycle + trust.* + install.*` across skills + rules + commands).
- **(c) keep explicit / projection-time injection:** 1 field (`command.disable-model-invocation`).

## Migration disposition for Phase 1 + Phase 2

### What Phase 1 must add

1. **Schema `default` declarations** for all 25 migratable fields under `scripts/schemas/`. Phase 1 Step 2 of the roadmap covers this — no scope expansion needed.
2. **Loader injection** in `scripts/validate_frontmatter.py::parse_frontmatter` (or a wrapper used by the build_discovery + lint scripts). The injection must:
   - Set `fm.setdefault("lifecycle", "active")` and equivalents for the leaf 7 single-key fields.
   - Set `fm.setdefault("trust", {})` first, then `fm["trust"].setdefault("level", "core")` and the two siblings — handle nested dicts before flat fields.
   - Same for `install`.
   - For `execution.type` (skill) and `type` (command): set `fm.setdefault("execution", {})` / `fm.setdefault("type", "orchestrator")` per artefact class.
3. **Unit tests** per field per class (skill / rule / command / persona): present-and-explicit, present-and-default, absent — all three must read back the dominant value at the loader's output.

### What Phase 2 must migrate

- **25 fields** — for every artefact in `packages/core/.agent-src.uncondensed/{skills,rules,commands,personas}/`, drop the field if its value equals the schema default.
- **NOT migrated in Phase 2:** `command.disable-model-invocation`. Defer to a follow-up note in Phase 3 or a sibling roadmap once the `.claude/` projection layer can inject the field at project-time.

### What Phase 3 must lint

- For each of the 25 migrated fields, fail when an artefact re-introduces a field whose value equals the schema default.
- The lint must **NOT** fail on `command.disable-model-invocation` — that field intentionally stays explicit at source until the projection-injection plate lands.

### Estimated line-count delta (Phase 2 dry-run forecast)

Rough math from the population × field-count × 1-line-per-field heuristic, minus the nested-dict savings (nested `trust:` / `install:` blocks each remove 4 lines when the whole sub-tree defaults):

- Skills: 7 simple-default lines × 129 ≈ **903 lines** plus collapsing `trust:` (3-line block) + `install:` (3-line block) when fully defaulted: another ≈ 258 lines.
- Rules: 7 simple-default lines × 71 ≈ **497 lines** plus nested-block collapse: ≈ 142 lines.
- Commands: 7 simple-default lines × 135 ≈ **945 lines** plus nested-block collapse: ≈ 270 lines. (Excludes `disable-model-invocation` deferred to follow-up.)
- Personas: 2 simple-default lines × 30 ≈ **60 lines** (97% pop. on version — closer to 58).

**Total estimated reduction: ≈ 3,070 simple-field lines + ≈ 670 nested-block-collapse lines ≈ 3,740 lines.** Lower than the roadmap's ≈ 8,400-line headline because:
- The headline counts every dominant-value occurrence, including the YAML sub-tree headers (`trust:`, `install:`) which only collapse when the WHOLE sub-tree defaults.
- `disable-model-invocation` (135 lines) is deferred.
- Some artefacts may already omit fields the inventory counted as "present" — Phase 2 dry-run will measure the true delta.

The roadmap's headline of "≈ 8,400 lines" remains directionally correct; the realistic Phase 2 target is **3,500–4,500 lines** with the `disable-model-invocation` follow-up worth another ≈ 135 lines.

## Risks surfaced

1. **The schema validator must run AFTER the loader injects defaults**, not before. Otherwise a migrated artefact (which omits a field) fails validation against a schema that requires the field. Phase 1 must verify order-of-operations explicitly.
2. **The `condense.py` round-trip** must survive the migration. Source files in `.agent-src.uncondensed/` lose a frontmatter line; the condensed twin in `.agent-src/` must lose it consistently. The condensation hashes (`internal/.condensation-hashes.json`) will all need to refresh in one batch — Phase 2 Step 5 covers this but the batch size (≈ 365 files) is non-trivial and review-heavy.
3. **`build_discovery_manifest.py` writes `trust.level` etc. back into the manifest.** Even if source drops the field, the manifest still carries the value. Consumers of the manifest (Cloud bundles, MCP catalogue) keep seeing the canonical defaults. No downstream contract changes.
4. **`disable-model-invocation` deferral is real.** Cleanly migrating it requires touching the `.claude/skills/` projection script (likely `scripts/generate_tools.py` or sibling) to inject the field at projection time. Phase 0 explicitly does NOT cover that surface; Phase 2 stops at source-side migration; the follow-up plate or sibling roadmap handles it.

## Appendix — safe-default sites (already use fallback)

17 sites already use `.get(default)` patterns and need no migration adjustment. Listed here for traceability so the Phase 2 dry-run reviewer can confirm coverage.

| Field | File | Line | Pattern |
|---|---|---:|---|
| `source` | `scripts/_archive/_p4_migrate.py` | 128 | `existing_fm.get("source", "package")` |
| `trust.level` | `scripts/plan_physical_move.py` | 87 | `trust.get("level") == "core"` |
| `trust.level` | `scripts/lint_artefact_frontmatter.py` | 129 | `trust.get("level")` |
| `trust.confidence` | `scripts/lint_artefact_frontmatter.py` | 133 | `trust.get("confidence")` |
| `trust.human_review_required` | `scripts/lint_trust_coherence.py` | 99 | `trust.get("human_review_required")` |
| `trust.human_review_required` | `scripts/lint_artefact_frontmatter.py` | 138 | `trust.get("human_review_required")` |
| `install.default` | `scripts/lint_artefact_frontmatter.py` | 145 | `install.get("default")` |
| `install.removable` | `scripts/plan_physical_move.py` | 88 | `install.get("removable") is False` |
| `install.removable` | `scripts/lint_artefact_frontmatter.py` | 147 | `install.get("removable")` |
| `trust` (parent) | `scripts/plan_physical_move.py` | 84 | `fm.get("trust") or {}` |
| `install` (parent) | `scripts/plan_physical_move.py` | 85 | `fm.get("install") or {}` |
| `packs` | `scripts/plan_physical_move.py` | 101 | `fm.get("packs")` |
| `packs` | `scripts/move_artefact.py` | 78 | `fm.get("packs")` |
| `type` | `scripts/audit_auto_rules.py` | 73 | `fm.get("type") != "auto"` |
| `type` | `scripts/measure_augment_budget.py` | 99 | `fm.get("type", "")` |
| `type` | `scripts/generate_index.py` | 110 | `fm.get("type", "?")` |
| `type` | `scripts/check_proposal.py` | 91 | `fm["type"]` (guarded by prior `if`) |
| `type` | `scripts/generate_ownership_matrix.py` | 141 | `fm.get("type")` |
| `type` | `scripts/lint_load_context.py` | 98 | `fm.get("type")` |
| `validator_ignore` | `scripts/check_condensed_paths.py` | 105 | `fm.get("validator_ignore") or []` |
| `disable-model-invocation` | `scripts/check_cluster_patterns.py` | 119 | `fm.get("disable-model-invocation") != "true"` |
