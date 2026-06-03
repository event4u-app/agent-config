---
adr: 028
status: accepted
date: 2026-05-25
decision: root-layout
supersedes: —
superseded_by: ADR-045
phase: v3.x · root-layout-cleanup Phase 1
type: structural
review_date: 2027-05-25
---

# ADR-028 — Root layout — targeted prune now, multi-workspace deferred behind four audits

## Status

**Accepted** · 2026-05-25. Encodes the AI Council verdict from
[`root-cleanup-organizing-principle-2026-05-25.synthesis.md`](../../agents/runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md) <!-- council-ref-allowed: ADR decision trace -->
and opens
[`road-to-root-layout-cleanup.md`](../../agents/roadmaps/archive/road-to-root-layout-cleanup.md) (archived; complete).
Time-boxed: review on **2027-05-25** or earlier if any trigger below fires.

## Context

A request to move "everything not needed at root into `./src/`" failed
the reality check on three counts:

1. **`./src/` is occupied** — the TypeScript application (CLI · Server · UI · shared) per
   [`ADR-012`](ADR-012-typescript-cli-shell.md) / [`ADR-016`](ADR-016-installer-architecture.md).
   Moving general tooling into `./src/` collides with the app boundary.
2. **`router.json` is not at root** — lives under `./dist/`, governed by
   [`ADR-019`](ADR-019-router-json-dist-location.md). Out of scope.
3. **`setup.sh` is the curl entry point** — referenced by external installers
   (`bash <(curl …setup.sh)`). Discovery surface, immovable.

A council session (2 members, $0.13 actual) reframed the problem:

> "Root noise" is not a *discoverability* problem (GitHub paginates
> anyway, npm consumers never see it). It is a *maintainability*
> problem — "where do new internal tools belong?"

With that reframe, the cheap-and-safe move (Option 1 — targeted prune)
becomes obvious, and the deep restructure (multi-workspace) drops to a
conditional follow-up gated by evidence the package does not yet have.

### Consumer-contract surface check (Phase 1 scope)

Re-audit of `bench/`, `evals/`, `workers/`, `user-types/` against the
installer / projector / CI:

| Dir | `scripts/install.py` | `scripts/condense.py` projection | `.github/workflows/*` | Verdict |
|---|---|---|---|---|
| `bench/` | — | — | `bench-drift.yml` (path filter) | **movable** |
| `evals/` | — | — | — | **movable** |
| `workers/` | — | — | `deploy-mcp-worker.yml` (working-dir, 6+ refs) | **movable** (CI updates only) |
| `user-types/` | `USER_TYPES_DIR = "user-types"` (line 52) | `AUGMENT_SYMLINK_DIRS` includes `"user-types"` | — | **immovable — public contract** |

`user-types/` is dropped from Phase 1 — installer + projector reference
it as a stable root path. Surfaced during execution, not in the
council's original scope (the council recommended all four; the audit
narrowed it).

## Decision

**Two-phase strategy.** Phase 1 ships now; Phases 2–3 are conditional.

### Phase 1 — Targeted Prune (immediate, ≤ 1 day, no version bump)

Move into a new `./internal/` umbrella:

- `bench/` → `internal/bench/`
- `evals/` → `internal/evals/`
- `workers/` → `internal/workers/`

Update:

- `.github/workflows/bench-drift.yml` — path filter.
- `.github/workflows/deploy-mcp-worker.yml` — `working-directory` + `cache-dependency-path`.
- `taskfiles/engine.yml`, `taskfiles/mcp.yml` — `dir:` references.
- `AGENTS.md` — placement rule pointer.

Outcome: 3 fewer root entries; zero consumer risk; precedent for
"maintainer-internal → `./internal/`".

### Phase 2 — Pre-audits (gates Phase 3, no time-box)

Four audits must complete and pass before Phase 3 opens:

1. **Consumer-contract audit** — GitHub code search +
   `node_modules/@event4u/agent-config/` path probing for
   `scripts/`, `templates/`, `config/`, `schemas/` references.
2. **Symlink-mobility test** — verify Cursor / Claude / Windsurf
   honor symlinked projections (`.cursor/` → `./projections/.cursor/`).
3. **Hash-sequencing audit** — confirm `.condensation-hashes.json`
   uses paths that survive `.agent-src/` relocation (or document the
   regeneration migration).
4. **CI-path audit** — every hardcoded path in
   `.github/workflows/*.yml` and `taskfiles/*.yml`.

Each audit produces a verdict file under
`agents/evidence/audits/2026-XX-root-layout-phaseN/`.

### Phase 3 — Conditional multi-workspace (deferred, gated)

Only if **all four audits pass**: restructure to npm-workspaces with
`tooling/` (Python maintainer scripts), `runtime/` (TS app), and
optionally `projections/` (host-agent configs). If any audit fails,
Phase 3 closes as "not feasible" and a successor ADR documents the
blocker.

## Consequences

- New top-level `./internal/` directory becomes the home for
  maintainer-only tooling. `AGENTS.md` documents this with one line.
- `.gitignore` and `eslint`/`pyproject` ignore rules updated as
  needed.
- The four Phase 2 audits are pre-requirements, not work. They are
  *not* sprint tasks — they run on demand when someone wants to
  re-open multi-workspace.
- Review on **2027-05-25** or earlier if any trigger fires:
  1. A new maintainer-only dir is added at root (signal: `./internal/`
     convention is breaking down).
  2. Phase 2 audits all return clean (signal: Phase 3 is ready).
  3. A consumer reports breakage from a Phase 1 path change (signal:
     audit missed a contract).
  4. Council session re-opens the question with new evidence.

## Alternatives considered

| Option | Why rejected |
|---|---|
| Move everything into `./src/` (original request) | `./src/` is the TS app per ADR-012/016. Collision. |
| Option 2 — `./tooling/` umbrella with `templates/` / `config/` / `schemas/` | Council: cost underestimated (duplicate-then-deprecate + 2-month window + major bump); installer paths in those dirs are unaudited. |
| Option 3 — full category-coded migration | Council hard-reject: projection mobility unproven; condensation-hash sequencing risk; unshippable without symlink test. |
| Option 4 — `MAP.md` documentation | Council: adds 51st entry; documentation-as-apology; AGENTS.md already serves this role. |
| Skip Phase 1, jump to multi-workspace prototype | Loses the cheap visible win; Phase 2 audits unfunded; risks scope creep into Phase 3. |

## References

- [`agents/runtime/council/questions/root-cleanup-organizing-principle-2026-05-25.md`](../../agents/runtime/council/questions/root-cleanup-organizing-principle-2026-05-25.md) — council brief. <!-- council-ref-allowed: ADR decision trace -->
- [`agents/runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md`](../../agents/runtime/council/sessions/root-cleanup-organizing-principle-2026-05-25.synthesis.md) — full synthesis. <!-- council-ref-allowed: ADR decision trace -->
- [`agents/roadmaps/archive/road-to-root-layout-cleanup.md`](../../agents/roadmaps/archive/road-to-root-layout-cleanup.md) — execution roadmap (archived; Phase 1 ✅, Phase 2 ✅, Phase 3 closed).
- [`agents/evidence/audits/2026-05-root-layout-phase2/`](../../agents/evidence/audits/2026-05-root-layout-phase2/) — Phase 2 audit verdict bundle.
- [`ADR-029`](ADR-029-multi-workspace-deferred.md) — Phase 3 close-out (multi-workspace deferred indefinitely).
- [`ADR-012`](ADR-012-typescript-cli-shell.md), [`ADR-016`](ADR-016-installer-architecture.md) — `./src/` is the TS app.
- [`ADR-019`](ADR-019-router-json-dist-location.md) — `router.json` lives in `./dist/`.
- `scripts/install.py:52` (`USER_TYPES_DIR`), `scripts/condense.py:1106` (`AUGMENT_SYMLINK_DIRS`) — evidence pinning `user-types/` to root.
