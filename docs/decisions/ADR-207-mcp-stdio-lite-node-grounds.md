---
adr: 207
status: accepted
date: 2026-08-03
decision: mcp-stdio-lite-node-grounds
supersedes: ADR-085
superseded_by: —
phase: road-to-renewal-adr-hygiene
type: structural
review_trigger: >-
  Reopen on a named end-user ask for MCP tool execution without a repo
  checkout (the ADR-112 trigger — a Claude Desktop user who wants a tool but
  will not clone), OR when the stdio-lite server's content surface stops
  being derivable from dist/ governance artifacts alone, which would break
  the read-only-projection premise this restatement keeps
---

# ADR-207 — MCP stdio-lite distribution: read-only via the npm bin, restated on Node-only grounds

## Status

**Accepted** · 2026-08-03. Supersedes [ADR-085](ADR-085-mcp-stdio-end-user-distribution-shape.md)
per `road-to-renewal-adr-hygiene` Phase 1 with AI-council convergence
(claude-sonnet-4-5 + gpt-4o, design mode, 2026-08-03 — unanimous for full
supersession over amendment: ADR-085's reasoning frame is void, not merely
stale, and an `accepted` record with a false Consequences section misleads
every future reader).

## Context

ADR-085 (2026-06-10) decided the end-user MCP distribution shape as
A2×B1: a read-only "stdio-lite" server launched from the existing npm bin,
serving `dist/` governance content as prompts/resources. The conclusion
still stands and is live. The reasoning does not:

- Its entire frame was a **Python-vs-Node language-channel matrix** ("the
  channel must match the implementation language; no mixed handoff"). The
  kernel has been 100% TypeScript since ADR-200 — there are no longer two
  languages to match.
- Its **pre-approved Phase-2 flip path (A1×B2 — full Python kernel via
  pipx/uvx)** is unbuildable: no Python distribution exists for pipx/uvx
  to install.
- Its flip **trigger already fired and was resolved differently**:
  ADR-112 (2026-07-07) resolved the named consumer ask by routing tool
  users to the kernel server, keeping stdio-lite read-only.
- Its § Consequences claim "**zero local script execution**" is factually
  overtaken — 18 implemented tools including a shell-exec pilot shipped on
  `src/scripts/mcp_server/` (per ADR-112 § Context).
- Its Phase-2 prerequisites name Python-only tooling (`pip-audit`,
  `safety`); the applicable equivalent is `npm audit`, already gated per
  ADR-012.

## Decision

1. **The distribution shape stands: read-only stdio-lite via the npm
   bin.** The end-user MCP entry point remains the pure-Node stdio server
   launched from the package's existing npm bin, serving `dist/`
   governance content as prompts/resources plus read-only tools. No new
   distribution channel (pipx/uvx, bundled venv, separate binary) is
   added.
2. **The grounds are Node-native, not language-matching:** (a) the npm bin
   already exists and is the package's single distribution identity
   (ADR-033); (b) a second channel would double the release, supply-chain,
   and support surface for zero named demand; (c) read-only scope keeps
   the lethal-trifecta egress leg closed for unauthenticated end users.
3. **Execution asks route to the kernel server** per ADR-112 — that record
   owns the read-only boundary and its revisit trigger; this ADR does not
   duplicate it.
4. **ADR-085 flips to `status: superseded`.** Its historical council
   record remains readable; its matrix reasoning, Phase-2 flip path, and
   Consequences section are no longer citable authority.

## Consequences

- Positive: the corpus stops teaching a Python-vs-Node analysis that can
  no longer be reconciled with the tree; the unbuildable pipx flip path is
  withdrawn; the false "zero local script execution" claim stops being an
  accepted-record assertion.
- Negative / accepted: one more record in the 085→112→207 chain; readers
  tracing the stdio-lite lineage now cross three documents. The chain is
  linear and each hop is one link.

## Alternatives considered

- **Amend ADR-085 in place** (the roadmap step's original phrasing) —
  rejected by council: amendment preserves a conclusion whose entire
  justification collapsed ("Grandfather Paradox maintenance pattern");
  ADR-093/049/098-style partial supersede fits parameter changes within a
  valid frame, not a voided frame.
- **Point ADR-085 at ADR-112 alone** — rejected: ADR-112 resolved the flip
  trigger but never restated the distribution-shape decision; the corpus
  would have no accepted record carrying the A2×B1 shape.

## References

- [ADR-085](ADR-085-mcp-stdio-end-user-distribution-shape.md) — superseded.
- [ADR-112](ADR-112-stdio-lite-stays-read-only.md) — the read-only boundary + revisit trigger owner.
- [ADR-200](ADR-200-python-to-typescript-migration.md) — the migration that voided the frame.
- [ADR-033](ADR-033-distribution-identity-npm-primary.md) — npm as the single distribution identity.
- `taskfiles/mcp.yml`, `docs/contracts/adr-mcp-runtime.md` — live surfaces whose stale Python
  descriptions were corrected alongside this record.
