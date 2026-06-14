---
adr: 026
status: accepted
date: 2026-05-24
decision: explain-mode-translation
supersedes: —
superseded_by: —
phase: v3.x · employee-product-and-external-proof Phase 6
type: forward-looking
---

# ADR-026 — Explain-mode translation — plain as a renderer, not a new pipeline

## Status

**Accepted** · 2026-05-24. Phase 6 design. Depends on the existing
`explain-v1` envelope shape stabilized in `agent-memory` 3.0 and the
workspace surface from [`ADR-025`](ADR-025-workspace-chrome.md).

## Context

Feedback A names the technical explain-trace as a non-technical-employee
barrier. Today the right rail shows `trust_score: 0.74`,
`promotion_history: [...]`, `contradictions: 0` — vocabulary that
assumes the reader knows the memory model. For galabau, content-creator,
and consultant roles, this is opaque.

Two options surveyed:

| Option | Pitch | Cost |
|---|---|---|
| **(a) Second MCP surface** | Add `memory_explain_plain` returning a pre-translated envelope. | New endpoint, new schema, drift risk between two surfaces, requires MCP version bump. |
| **(b) Renderer over existing envelope** | Treat plain mode as a pure rendering function over the existing `explain-v1` envelope. Per-role glossary overrides labels. | Zero MCP change, zero data drift, zero schema bump. Renderer testable with fixtures. |

## Decision

Ship Phase 6 plain mode as **(b) — a pure renderer over the existing
`explain-v1` envelope**.

Concretely:

- `renderExplain(envelope, { mode, glossary?, locale? })` is a pure
  function in `packages/core/src/workspace/explain/`.
- Two modes: `technical` (current surface, verbatim) and `plain`
  (4 labelled paragraphs: where from, how confident, when reviewed,
  what's contested).
- 4-band confidence label (Very High / High / Medium / Low) with
  default thresholds per [`docs/contracts/explain-modes.md`](../contracts/explain-modes.md);
  thresholds overridable per role.
- 3-band freshness label (Fresh / Aging / Stale) from `decay.applied_factor`.
- Per-role `agents/roles/<role>/explain-glossary.yml` overrides
  default labels and band thresholds. Glossary YAMLs are the
  one carve-out from the `.md`-must-be-English rule for role-native
  rendered strings.
- `/why` quick command available to every role; resolves `mem://<id>`
  markers in the last reply and calls `memory_explain` per id, then
  renders in the active mode.

## Why (b)

- **Zero MCP drift.** One envelope, two views. No risk of plain
  text saying something the engineer view contradicts.
- **Testable.** Pure function over fixtures. Golden tests cover
  high-trust, low-trust, contradicted, recently-promoted, deprecated.
- **No version bump.** `agent-memory` MCP surface stays at the
  current contract; consumers running older clients still see the
  technical envelope unchanged.
- **Glossary carve-out is bounded.** Only the `explain-glossary.yml`
  per role holds runtime strings in role-native language; the
  contract `.md`, the ADR, the renderer code stay English.

## Why not (a)

- A second MCP endpoint duplicates the envelope shape and creates
  two surfaces that must stay in sync. Drift will land within one
  release.
- Schema bump on `agent-memory` cascades to every downstream package
  consuming the MCP; Phase 6 is not the right time to force that.

## Consequences

**Positive**

- Plain mode lands as a renderer change, no MCP version bump.
- Per-role glossary opens the door for the recruit-session
  participants (Phase 1) to localize the plain surface without a
  code change.
- Technical mode survives unchanged for engineering-lead role.

**Negative**

- Plain mode is downstream of envelope shape; an `explain-v2`
  envelope (next major) requires updating the renderer too. Cost
  is bounded — the renderer is one file.
- Glossary localization can drift from English defaults if a role
  ships a partial override. Mitigated by the renderer falling back
  to defaults for missing keys.

**Reversal cost** — low. Replacing (b) with (a) later if the
renderer surface grows beyond pure rendering (e.g. needs a different
data fetch) requires only adding the second MCP endpoint; existing
glossary YAMLs translate forward.

## Open questions (deferred)

- Localization of the technical view (today: English only). Out of
  scope for v0; deferred until ≥ 1 recruit-session participant
  asks for it.
- Audio / spoken-mode rendering of the plain envelope for the
  consultant-on-the-road role. Defer to a future ADR.

## Cross-references

- Contract: [`docs/contracts/explain-modes.md`](../contracts/explain-modes.md).
- Envelope: [`internal/schemas/retrieval-v1.schema.json`](../../internal/schemas/retrieval-v1.schema.json).
- Workspace: [`ADR-025`](ADR-025-workspace-chrome.md), [`docs/contracts/daily-workspace.md`](../contracts/daily-workspace.md).
- Roles: [`docs/contracts/role-experience.md`](../contracts/role-experience.md).
