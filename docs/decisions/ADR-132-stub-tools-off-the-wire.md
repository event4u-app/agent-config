---
adr: 132
status: accepted
date: 2026-07-27
decision: stub-tools-off-the-wire
supersedes: —
superseded_by: —
phase: road-to-credible-install · Phase 3
type: structural
review_trigger: >-
  A consumer files a concrete request for a catalog-documented on-demand
  tool — implement it as a real tool then (that was the pillar's promise).
  Also reopen if the evaluator scoring model demonstrably stops weighting
  the minimum tool score (the mechanism this decision responds to), or if
  a compliant mainstream MCP client is shown to route calls to tools
  absent from tools/list (contradicting the uncallability premise).
---

# ADR-132 — Stub tools leave the stdio wire; the catalog keeps the on-demand backlog

## Status

Accepted (2026-07-27). Amends the stub-by-default pillar (2026-07-07
tool-cut verdict, ADR-111/112 family) for the **stdio tool surface** via the
pillar's own recorded revisit trigger — not a silent eradication.

## Context

The pillar shipped 12 `not_implemented` discovery stubs alongside 19
implemented tools on `tools/list`. Its revisit trigger — evidence that the
stub surface carries a real external cost — fired on 2026-07-27: the
evaluator's own published score page confirms the reviewer's claim
verbatim (recorded in
`agents/settings/contexts/mcp-scoring-model-verification.md`): overall
score = 70% tool-definition quality + 30% coherence, and the server-level
definition-quality score = **60% mean + 40% MINIMUM** — the worst-scored
tool dominates nearly half the component, and stubs are structurally the
minimum candidates. The `audit_initial_context` gate independently flagged
31 tools > 25 soft cap (every schema always-loaded for connected clients).

An AI-council revisit round ran the same day (2 members, 2 rounds).
Convergence: the "hide from tools/list but keep callable" middle option is
**semantically incoherent** — compliant MCP clients treat `tools/list` as
the invocation gate, so an unlisted tool is uncallable regardless of any
envelope; and catalog-only discovery is illusory transparency ("if it isn't
on the list, it doesn't exist" is the correct client conclusion). One
member argued eradication outright (phantom tools violate the zero-tax
premise); the other's own rebuttal dismantled the discovery-value case for
keeping them listed.

## Decision

1. The stdio server registers **implemented tools only**
   (`REGISTRY = ALLOWLIST`, 19/19/0 on the boot line). No phantom callable
   surface; a stub name is an ordinary unknown tool on the wire.
2. The **generated catalog keeps all entries** — stub entries stay as the
   documented implemented-on-demand backlog, each marked
   `[stub — implemented on demand]` (generator-derived, CI drift-gated).
   The catalog is a documentation surface, not a wire surface.
3. The `not_implemented` envelope machinery stays (contract doc + Cloud
   Worker parity + tests via an explicit stub registry); it is simply no
   longer reachable on the stdio wire.
4. The Cloud Worker surface is unchanged in this decision (F2-deferred
   scope); its disposition follows the client-compat spike results.

## Consequences

- Honesty improves: `tools/list` shows exactly what works. The
  minimum-score drag and the >25-tool context cost both disappear
  (19 tools, all annotated with `readOnlyHint`).
- Discovery of on-demand capabilities moves to the catalog/docs — the
  council explicitly rated that value as speculative; the review_trigger
  above is the honest re-entry path.
- Latent-demand telemetry (`outcome: latent_demand` on unknown-tool calls)
  keeps measuring whether anyone actually asks for the cut names.

## Alternatives

- **Keep stubs listed (status quo):** verified score cost + context cost
  for a discovery benefit no one has evidenced. Rejected.
- **Hide from tools/list but keep callable:** incoherent per MCP client
  semantics (unlisted = uncallable); dead-envelope theater. Rejected by
  both council members in round 2.
