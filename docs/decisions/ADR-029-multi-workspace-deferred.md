---
adr: 029
status: accepted
date: 2026-05-25
decision: multi-workspace-deferred
supersedes: —
superseded_by: —
phase: v3.x · root-layout-cleanup Phase 3 close-out
type: structural
review_date: 2027-05-25
---

# ADR-029 — Multi-workspace restructure deferred; Phase 3 closed pending L0 symlink-mobility evidence

## Status

**Accepted** · 2026-05-25. Successor to
[`ADR-028`](ADR-028-root-layout.md) Phase 3. Closes the multi-workspace
restructure (Option 5 from the original council session) as **not
feasible today**, with a re-open path documented below. Time-boxed:
review on **2027-05-25** or earlier if any re-open trigger fires.

## Context

[`ADR-028`](ADR-028-root-layout.md) defined a three-phase strategy:

1. **Phase 1** — move `bench/`, `evals/`, `workers/` to `internal/`. **Shipped.**
2. **Phase 2** — run four pre-audits that gate Phase 3.
3. **Phase 3** — conditional multi-workspace restructure
   (`tooling/` · `runtime/` · `projections/`), only if all four
   Phase 2 audits return clean.

Phase 2 ran in the same PR as Phase 1 (under maintainer mandate).
Verdict bundle:
[`agents/evidence/audits/2026-05-root-layout-phase2/`](../../agents/evidence/audits/2026-05-root-layout-phase2/).

| # | Audit | Verdict |
|---|---|---|
| 1 | Consumer-contract | ✅ Pass — published surface enumerated |
| 2 | Symlink-mobility | ⚠️ Partial — subdirectory symlinks proven, top-level untested |
| 3 | Hash-sequencing | ✅ Pass — source-relative keys, idempotent regeneration |
| 4 | CI-path inventory | ✅ Pass — ~27 edit points enumerated |

Audit 2 is the blocker. The multi-workspace option requires
**L0 symlinks** (tool root directory itself becomes a symlink, e.g.
`.cursor/ → projections/.cursor/`). The package today only proves
**L1 symlinks** (subdirectory level, e.g. `.augment/skills/ →
../.agent-src/skills/`). L0 has never been tested against current
Cursor, Claude Code, or Windsurf builds — and one of those three
(Augment Code) is already known to refuse symlinked rule files at L1,
which is the precedent that motivates the audit in the first place.

Without L0 evidence, executing Phase 3 would either ship a broken
projection for at least one host agent or force a fallback to
per-directory copies that defeat the "single source of truth" win the
multi-workspace shape is meant to deliver.

## Decision

**Defer Phase 3 indefinitely.** Close the Phase 3 roadmap step as "not
feasible today". Keep the audit bundle as the canonical evidence base
so that a future maintainer can re-open the question without redoing
the work.

The four root-layout claims survive Phase 1 unchanged:

- `bench/`, `evals/`, `workers/` are gone from root (under `internal/`).
- `user-types/` stays at root (immovable per Audit 1 + ADR-028).
- Top-level tool roots (`.augment/`, `.cursor/`, `.claude/`, `.clinerules/`)
  stay as real directories with L1 symlinks pointing at `.agent-src/`.
- The "maintainer-internal → `./internal/`" precedent is the new
  placement rule for new internal dirs (already in `AGENTS.md`).

## Re-open conditions

Phase 3 becomes eligible when **all** of these hold:

1. A maintainer (or community contributor) runs the L0 symlink test
   documented in
   [`02-symlink-mobility.md`](../../agents/evidence/audits/2026-05-root-layout-phase2/02-symlink-mobility.md)
   against current Cursor + Claude Code + Windsurf, captures the
   result, and amends Audit 2 to ✅ or ❌.
2. If Audit 2 lands ✅: the ~27 CI-path edit points from Audit 4 are
   accepted as in-scope for the migration window; no new hardcoded
   paths added in the interim invalidate the inventory.
3. A council session synthesizes the updated verdict bundle and
   produces a fresh recommendation (multi-workspace vs. stay-as-is).
4. The maintainer accepts the deprecation cycle cost (installer
   version bump + dual-write window for the projection contract).

## Consequences

- The root layout stabilizes at the Phase 1 shape for ≥ 1 year (the
  `2027-05-25` review date).
- New maintainer-internal directories go under `internal/`. New
  tooling that needs to ship to consumers goes under `scripts/`,
  `config/`, or a new top-level entry that earns its own ADR.
- The `projections/` umbrella idea is **not dead** — it is gated on
  fresh L0 evidence, not on a new design decision.
- The four audit files are reusable: Audit 1 (consumer surface),
  Audit 3 (hash portability), and Audit 4 (CI path inventory) remain
  valid until a structural change invalidates them; only Audit 2
  needs runtime re-verification.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Execute Phase 3 anyway with L0 untested | Ships projection breakage to one of three host agents in the worst case; the win (single source of truth) collapses if any agent forces a fallback to copies. |
| Run the L0 test in CI | The L0 test requires the host agent's runtime (Cursor / Claude Code IDE plugins); CI cannot exercise it. |
| Defer **all** of Phase 3 to a separate roadmap | Phase 2 already produced the audit bundle; closing Phase 3 with an ADR captures the verdict without leaving a stale roadmap open. |
| Re-shape Phase 3 as L1-only | The council's recommendation specifically called out the `projections/` umbrella, which requires L0. Re-shaping to L1-only is a different decision the council did not weigh; would need a fresh council session. |

## References

- [`ADR-028`](ADR-028-root-layout.md) — parent decision.
- [`agents/evidence/audits/2026-05-root-layout-phase2/`](../../agents/evidence/audits/2026-05-root-layout-phase2/) —
  full audit bundle (4 verdict files + README).
- [`agents/roadmaps/archive/road-to-root-layout-cleanup.md`](../../agents/roadmaps/archive/road-to-root-layout-cleanup.md) —
  execution roadmap, archived (Phase 1 ✅, Phase 2 ✅, Phase 3 closed via this ADR).
- [`agents/runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md`](../../agents/runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md) —
  original council synthesis that proposed the multi-workspace shape.
