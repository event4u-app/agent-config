---
adr: 114
status: accepted
date: 2026-07-08
decision: command-cluster-consolidation-phase-4
supersedes: —
superseded_by: —
phase: road-to-command-structure-optimization · Phase 0
---

# ADR-114 — Command-cluster consolidation Phase 4 (flat dash commands → nested clusters)

- **Deciders:** maintainer + AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2-round debate, 2026-07-08)

## Context

After the Phase 1–3 cluster collapses, ~27 flat dash-separated commands
remained (`bug-fix`, `project-analyze`, `optimize-project`, `quality-fix`, …).
ADR-044 derives the invoked slug from the physical path by hyphen-joining
(`fix/ci` → `fix-ci`), which creates a cost asymmetry the earlier phases did
not exploit: **nesting `bug-fix` as `bug/fix` keeps the invoked slug
`bug-fix`** — invocation-neutral — while only reorder-moves
(`quality-fix` → `fix/quality` = `fix-quality`) change the typed name.

## Decision

1. **Nest the remaining coherent families** (council-adopted set):
   - Extended clusters: `optimize` (+`project`, `prompt`), `fix` (+`quality`),
     `tests` (+`e2e-plan`, `e2e-heal`), `analyze` (+`reference-repo`).
   - New clusters: `bug` (fix · investigate), `project` (analyze · health),
     `review` (changes · routing), `package` (test · reset),
     `cost` (report · profile), `sync` (agent-settings · gitignore ·
     gitignore-fix — absorbs the single-sub `sync-gitignore` cluster).
   - Slug reorders carry `replaces:` aliases: `fix-quality`,
     `tests-e2e-plan`, `tests-e2e-heal`, `cost-profile`.
2. **Cluster heads are dispatch menus, not verbs.** ADR-041's controlled-verb
   allowlist governs the leading token of visible *command slugs* (and the
   `sub:` head for nested commands). A cluster head named after a noun/scope
   (`bug`, `project`, `cost`) is a navigation surface — the same shape as the
   pre-existing `agents`, `memory`, `brand`, `video` heads — and does not add
   a verb to the allowlist. (Council round 2 explicitly overturned the
   verb-policy objection on this ground.)
3. **Co-location rule.** All subs of a cluster live in the same pack directory
   as the head — slug derivation implies it. Cross-pack members move packs
   (`optimize-project` eng → meta, `review-routing` meta → eng,
   `package-test` eng → meta, `sync-gitignore` eng → meta,
   `analyze-reference-repo` eng → analysis-workbench).
4. **Bare invocation is deterministic.** Multi-sub head → numbered menu;
   single-sub head → default-route; documented default-flow exceptions live in
   the head's `## Dispatch`. Enforced structurally by
   `scripts/check_cluster_patterns.ts`, which now also resolves every
   `routes_to:` entry to a real command.
5. **Tier-0 slugs never change.** Deferred/rejected per council:
   - `ticket` cluster (implement/estimate/refine/jira) — tier-0
     `implement-ticket` rename + cross-pack move; revisit with usage
     telemetry.
   - `security` cluster — weak cohesion; `security-audit-config` and
     `threat-model` stay flat.
   - `prepare-for-review` → `review/prepare` — pre-commit muscle memory.
   - Demotions (`check-current-md`, `update-form-request-messages`) — need a
     skill-coverage / pack-boundary audit first.

## Consequences

- 19 commands nested; 15 keep their invoked slug, 4 gain `replaces:` aliases.
- `review-changes` becomes internal; the advanced surface is the `review`
  head (eval key moves `review-changes.json` → `review.json`).
- `lint_no_new_atomic_commands.ts` is repointed from the removed
  `.agent-src.uncondensed/commands` dir to `src/domains` so the atomic-surface
  gate has teeth again; the new clusters are registered in the locked table.
- Consumers invoking old reordered slugs are migrated via `replaces:` +
  the `migrate` flow; slug-neutral nests need no migration.

## Alternatives considered

- **Colon-namespaced subcommands** — rejected long ago (ADR-044): Claude Code
  cannot resolve them.
- **`ticket` cluster now** — rejected by both council members (highest-risk
  item: tier-0 rename + pack move with unclear ownership).
- **Keeping `/optimize` agent-layer-only** — council split; maintainer
  directive adopted the widened scope; the head menu + scope-check rule
  disambiguates the three scopes.

## References

- `docs/contracts/command-clusters.md` — locked table (Phase 4 rows) + the
  new "Bare invocation" section.
- `agents/roadmaps/road-to-command-structure-optimization.md` — inventory,
  council verdicts, phases.
- ADR-003 (flat clusters), ADR-041 (controlled verbs), ADR-044 (path-derived
  hyphen slugs).
