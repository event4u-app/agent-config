---
adr: 095
status: accepted
date: 2026-06-14
decision: workspace-boundary-contract
supersedes: —
superseded_by: —
phase: v6.0.0 · final-readiness · Phase 4
type: structural
---

# ADR-095 — Workspace boundary contract + import-edge drift check

## Status

**Accepted** · 2026-06-14. Lands Phase 4 of
[`road-to-6.0.0-final-readiness`](../../agents/roadmaps/archive/road-to-6.0.0-final-readiness.md).
Routed through the AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
design mode, 2026-06-14; converged 2-round on "import-boundary linter as MVP
with explicit semantic-drift disclaimer + escape-hatch").

## Context

The PR #489 / 6.0.0 review flagged that **"workspace" risks becoming the new
"meta"** — a catch-all that absorbs every nearby concern until it owns
everything and means nothing. The workspace is real and load-bearing (13
`src/cli/python/workspace_*.py` modules behind `/work` and the host-drive
loop), so the risk is concrete: a future change quietly teaches a workspace
module to design skills, decide profile semantics, or pick video providers,
and the boundary erodes one import at a time.

The prior council finding (#3 on the parent roadmap) accepted a boundary
contract **with modification**: this repo has no dependency-cruiser /
TS-import-boundary tooling, so any drift mechanism must *fit the real surface*
or *explicitly justify doc-governance-only*.

## Decision

1. **Author a boundary contract** at
   [`docs/contracts/workspace-boundary.md`](../contracts/workspace-boundary.md)
   enumerating what the workspace **owns** and **does not own**.
2. **Drift mechanism = an import-edge linter** (`scripts/lint_workspace_boundary.py`),
   AST-static, over `src/cli/python/workspace_*.py`. It fails if a workspace
   module imports an owner-module of a *not-owned* domain. It is wired into CI.
3. **Explicit scope disclaimer.** The linter enforces **import edges only**.
   Semantic drift — a workspace module encoding profile semantics or analytics
   *product strategy* without importing anything forbidden — is **not**
   catchable by an import check and stays **doc-governance**, enforced in
   review against the contract. The contract states this limit plainly so the
   green check is never mistaken for "the boundary is fully enforced" (the
   council's named false-confidence risk).
4. **Escape hatch.** A `# boundary-exception: <reason>` pragma on the import
   line lets a justified, reviewed exception through; the contract records that
   such pragmas are reviewed like any boundary change.

### Owns / does-not-own (locked by the parent roadmap's council)

| Workspace **owns** | Workspace **does NOT own** |
|---|---|
| task orchestration | skill design |
| host-session lifecycle | profile semantics |
| continuation (multi-turn) | video-provider logic |
| drive health | MCP-registry policy |
| | analytics **product strategy** |

## Consequences

- The boundary becomes a CI gate, not a wish-list. Day-one state: **zero
  violations** (survey below), so the check locks the current-correct boundary
  rather than papering over drift.
- The import check is cheap and precise here because workspace modules live in
  `src/cli/python/` and the not-owned owner-modules live in `src/scripts/` —
  separate namespaces, no false-positive surface (workspace modules import only
  stdlib, third-party `keyring`/`cryptography`/`yaml`, and intra-workspace
  `workspace_*`).
- Semantic drift remains a review responsibility; the contract names it so
  reviewers know the linter is a supplement, not a substitute.

## Survey — existing violations

AST import survey of all 13 `workspace_*.py` modules (2026-06-14):

- The only cross-module import is `workspace_inbox → workspace_skills`
  (intra-workspace; allowed).
- **Zero** imports of any skill-design / profile / pack / video / MCP /
  condense / router / persona owner-module.
- `workspace_skills.py` *resolves* skill bodies for host hand-off (consumes,
  does not design) → within bounds.
- `workspace_analytics.py` records task completion/abandonment telemetry
  (drive-health domain, not analytics product strategy) → within bounds.

**Result: zero boundary violations recorded.**

## Alternatives

- **Doc-governance-only (no check).** Rejected as the sole mechanism: the
  surface is concrete Python with clean namespaces, so the cheapest lock (an
  import check) earns its keep against the most common drift vector. Kept as
  the mechanism for *semantic* drift, which an import check cannot see.
- **dependency-cruiser / TS import-boundary tooling.** N/A — the workspace
  surface is Python, not TS; importing JS tooling for it is wrong-stack.

## References

- [`docs/contracts/workspace-boundary.md`](../contracts/workspace-boundary.md) — the contract.
- [`scripts/lint_workspace_boundary.py`](../../src/scripts/lint_workspace_boundary.py) — the drift check.
- [`ADR-050`](ADR-050-workspace-vs-package-root-boundary.md) — the workspace-vs-package-root trust boundary this refines at the module level.
- [`docs/contracts/daily-workspace.md`](../contracts/daily-workspace.md) — cross-links this contract.
