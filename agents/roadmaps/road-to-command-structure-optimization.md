---
complexity: structural
---

# Road to Command Structure Optimization

**Goal:** Collapse the remaining flat dash-separated commands into physically nested verb clusters (per ADR-003 flat-cluster shape + ADR-044 path-derived hyphen slugs), give every cluster head a deterministic bare-invocation behaviour (menu or single-sub default-route), and record justifications for every command kept flat — so the command surface reads as a small set of coherent verbs instead of ~27 loose `verb-noun` atoms.

## Context (verified 2026-07-08)

- Commands live at `src/domains/<pack>/<name>/command.md`; subs nest one level (`fix/ci/command.md`). The slug is **path-derived and hyphen-joined** (`_command_path_to_slug()` in `src/scripts/condense.ts`): `fix/ci` → `fix-ci`. Frontmatter `name:` is display-only (ADR-044).
- **Key asymmetry:** nesting `bug-fix` as `bug/fix` keeps the invoked slug `bug-fix` — invocation-neutral, no alias needed. Only reorder-moves change slugs (`quality-fix` → `fix/quality` = `fix-quality`) and need `replaces:` handling.
- Locked contract: `docs/contracts/command-clusters.md`. ADR-041 verb allowlist (`src/config/discovery/command-verbs.yml`) applies to **visible** (tier 0/1) commands' leading token / `sub:` head.
- Regeneration: `task sync` → `task generate-tools`; `task consistency` is the drift gate. Hand-maintained: contract table, `src/flows/surface-map.yaml`, `src/agent-src/commands/evals/*.json` (visible commands), `replaces:` frontmatter.
- Gaps found: `check_cluster_patterns.ts` validates head structure but does not cross-check `routes_to` against physical sub-files; `lint_no_new_atomic_commands.ts` points at the removed `.agent-src.uncondensed/commands` dir (inert).

## Council verdicts (inlined)

Council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds, 2026-07-08) on the 15-item disposition list:

| Item | Verdict | Reason |
|---|---|---|
| `optimize-prompt` → `optimize/prompt` | ADOPT (unanimous) | slug-neutral housekeeping; frontmatter already claims parent |
| `optimize-project` → `optimize/project` | ADOPT (split → maintainer directive) | slug-neutral; head menu disambiguates agent-layer vs project-wide vs prompt scopes |
| `quality-fix` → `fix/quality` | ADOPT (split → tie-break adopt) | fixes verb inversion; `fix` becomes the single corrective-action entry; low-frequency tier-2 slug change with `replaces:` |
| `e2e-plan`/`e2e-heal` → `tests/e2e-*` | ADOPT (split → tie-break adopt) | Playwright commands belong to the tests verb domain; composite sub-names per ADR-003 §2 |
| new `bug` cluster | ADOPT | R2 overturned the verb-policy objection: heads are dispatch menus, not verbs — ADR-041 governs command slugs; slug-neutral |
| new `project` cluster | ADOPT | scope-based heads are contract-legal (`agents`, `memory`, `brand` precedents); slug-neutral |
| new `ticket` cluster | **DEFER** (unanimous) | tier-0 `implement-ticket` slug change + cross-pack move = highest-risk item; revisit with usage telemetry |
| new `package` cluster | ADOPT | package-maintenance domain; slug-neutral; co-locate in one pack |
| new `cost` cluster | ADOPT (unanimous) | `cost/report` neutral + `set-cost-profile` → `cost/profile` justified (low-frequency admin) |
| new `sync` cluster | ADOPT (unanimous) | coherent maintenance surface; absorbs single-sub `sync-gitignore` cluster |
| new `review` cluster | ADAPT | nest slug-neutral `review/changes` + `review/routing`; **keep `prepare-for-review` flat** (slug change rejected for pre-commit muscle memory) |
| `analyze/reference-repo` | ADOPT (unanimous) | slug-neutral; move to analysis-workbench where the `analyze` head lives |
| new `security` cluster | **REJECT** (unanimous) | weak pairing; `threat-model` slug change unjustified; keep flat |
| demote `check-current-md` | **DEFER** | verify `md-language-check` skill coverage first |
| demote/move `update-form-request-messages` | **DEFER** | pack-boundary ADR concern, not a clustering concern |

Cross-cutting convergence: (a) cluster subs MUST co-locate with the head in one pack (slug derivation implies it); (b) never change tier-0 slugs; (c) bare invocation: multi-sub head → numbered menu, single-sub head → default-route, documented per-head default-flow exceptions (e.g. `chat-history` → import, `council` → default); (d) the new lint must cross-check menu/`routes_to` against physical sub-files. Top risks named: tier-0 slug changes fragment muscle memory; noun-cluster precedent needs an explicit "heads are menus, not verbs" ADR clause; cross-pack moves without clear ownership stall.

## Phases

### Phase 0 — Contract + ADR

- [x] Extend `docs/contracts/command-clusters.md` locked table with the adopted clusters/subs (incl. `Replaces` entries for slug changes) + codify the bare-invocation rule and the co-location rule.
- [x] Author ADR: new cluster heads (`bug`, `project`, `package`, `cost`, `sync`, `review`), "heads are dispatch menus, ADR-041 governs sub verbs" clarification, bare-invocation rule, deferred items with reasons.
- [x] Add any needed verbs to `src/config/discovery/command-verbs.yml` (only if a new visible command's leading token requires it). <!-- none needed: new heads are internal-tier except `review`, whose verb is already allowlisted; lint_command_verbs green -->

### Phase 1 — Slug-neutral nestings

- [x] `optimize-prompt` → `src/domains/meta/optimize/prompt/command.md`; update `optimize` head menu + `routes_to` + scope note.
- [x] `optimize-project` → `src/domains/meta/optimize/project/command.md` (pack move engineering-base → meta).
- [x] New `bug` head + nest `bug/fix`, `bug/investigate` (engineering-base).
- [x] New `project` head + nest `project/analyze`, `project/health` (engineering-base).
- [x] New `sync` head (meta) + nest `sync/agent-settings`; move `sync-gitignore` (+ its `fix` sub) under it.
- [x] New `review` head (engineering-base) + nest `review/changes`; move `review-routing` meta → engineering-base as `review/routing`.
- [x] New `package` head (meta) + nest `package/reset`; move `package-test` engineering-base → meta as `package/test`.
- [x] New `cost` head (meta) + nest `cost/report`.
- [x] Move `analyze-reference-repo` → `src/domains/analysis-workbench/analyze/reference-repo/command.md`; update `analyze` head menu.

### Phase 2 — Slug-changing reorders (`replaces:`)

- [x] `quality-fix` → `fix/quality` with `replaces: [quality-fix]`; update `fix` head menu.
- [x] `e2e-plan` → `tests/e2e-plan`, `e2e-heal` → `tests/e2e-heal` with `replaces:`; update `tests` head menu.
- [x] `set-cost-profile` → `cost/profile` with `replaces: [set-cost-profile]`.

### Phase 3 — Bare-invocation standardization + lint

- [x] Every new head: `## Sub-commands` table + `## Dispatch` (numbered menu fallback) + `## Rules` per `check_cluster_patterns.ts` reference shape.
- [x] Audit existing heads for the menu/default-route rule; fix gaps. <!-- audit 2026-07-08: all 23 table-registered heads carry a bare-invocation story; no gaps -->
- [x] Extend `check_cluster_patterns.ts`: head's `routes_to` entries and `## Sub-commands` table rows must resolve to physical sub-dirs; multi-sub heads must carry a bare-invocation menu fallback in `## Dispatch`.
- [x] Repoint the inert `lint_no_new_atomic_commands.ts` at `src/domains` (or record its retirement) so the atomic-surface gate has teeth again.

### Phase 4 — Regen + downstream surfaces

- [x] Verify eval-JSON keys for renamed slugs (all renamed commands are tier-2 internal → no eval required; `review-changes` stays slug-neutral).
- [x] Update `src/flows/surface-map.yaml` references for moved/renamed commands.
- [x] Grep-sweep old slugs (`quality-fix`, `e2e-plan`, `e2e-heal`, `set-cost-profile`) across `src/`, `docs/`; update cross-references.
- [x] `task sync` && `task generate-tools`; commit regenerated `dist/` + projections.

### Phase 5 — Deferred follow-ups (recorded, not executed here)

- [~] `ticket` cluster (implement/estimate/refine/jira) — deferred per council; revisit with usage telemetry. <!-- deferred: tier-0 slug change + cross-pack move rejected by both council members -->
- [-] `security` cluster — rejected; keep `security-audit-config` + `threat-model` flat. <!-- cancelled: unanimous council REJECT, recorded in ADR-114 -->
- [~] Demote `check-current-md` / `update-form-request-messages` — needs skill-coverage + pack-boundary audit. <!-- deferred: verify md-language-check coverage; laravel pack boundary ADR -->
- [ ] Resolve the two deferred items above with the maintainer (spawn follow-up roadmap vs drop) — decision deliberately left open until the restructuring PR is reviewed.
- [-] `prepare-for-review` → `review/prepare` — rejected slug change; keep flat. <!-- cancelled: council-rejected for pre-commit muscle memory, recorded in ADR-114 -->

## Acceptance criteria

- Every adopted item physically nested; deferred items recorded with reasons (this file + ADR).
- Every cluster head has deterministic bare-invocation behaviour, enforced by the extended `check_cluster_patterns.ts` in `task ci`.
- Old slugs keep resolving via `replaces:`; `task consistency` clean; remote CI green (the gate).
