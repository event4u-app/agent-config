---
adr: 121
status: accepted
date: 2026-07-12
decision: knowledge-sensitivity-classes
supersedes: —
superseded_by: —
phase: feedback-8.11
type: structural
---

# ADR-121 — Per-card sensitivity classes for the knowledge boundary

## Status

Accepted (2026-07-12). Successor note to ADR-119 (global knowledge sharing
default ON) — adds boundary teeth; does NOT revert the flip.

## Context

The 8.11.0 external reviews and the maintainer both name cross-project
context transfer as the riskiest open surface of the ADR-119 flip: the only
per-entry axis was origin tier (`public|vendor|proprietary` — where knowledge
came from), the binary page flag `visibility: private`, and a write-time
regex redaction gate. There was NO sensitivity taxonomy (how far an entry may
travel), no per-card owner/expiry on shared cards, no promotion-reason
capture, and no revocation trail — deletion was silent.

A two-round council debate (anthropic/claude-sonnet-4-5 + openai/gpt-4o,
2026-07-12) split on scope: one member argued measure-first with a 2-level
enum at most (six classes over-fit a single-maintainer install — `team` /
`organization` are phantom categories today); the other argued the full
six-class taxonomy from the reviews. Resolution: a SMALL machine-anchored
axis now (the maintainer's danger is present, not speculative), the wider
enum behind a revisit-if.

## Decision

Three sensitivity classes, each anchored to a machine check
(`agents/settings/contexts/knowledge-sensitivity.md` carries the full table):

- `prohibited` — redaction-class content; a redaction hit FORCES this class
  (declared values cannot override it); hard linter error in the global
  store (check G6).
- `project` — the DEFAULT; promotion structurally refused unless a human
  reclassifies; unset/invalid resolves here, never upward.
- `shareable` — global-store eligible; requires passing redaction AND full
  provenance: `source_repo`, `owner`, `review_after`, `promotion_reason`
  (checks G4/G5); `promotion_reason` is mandatory human input — there is no
  auto-`shareable` path.

Plus an append-only revocation ledger (`.revocations.jsonl` tombstones
written by `forget`/`purge` BEFORE deletion; rendered via
`knowledge:global:list --revoked`).

ADR-119's default-ON, `allowed_tiers: [public]`, measurement window, and
demotion trigger are unchanged.

## Consequences

- Cross-project transfer now requires a recorded human decision per card
  (class + reason), machine-verified in CI (`check_knowledge_cards` G4–G6)
  and at promotion time (`gate_sensitivity_for_promotion`).
- Deletion is auditable; the demotion trigger of ADR-119 gains a per-entry
  trail to point at.
- Cost: one more frontmatter field + four footer fields on shared cards;
  no new subsystem, no read-time machinery.

## Alternatives considered

- Six-class enum `{local-only, project, team, organization, confidential,
  prohibited}` (the reviews' proposal) — rejected now: `team`/`organization`
  have no consumer today; widening is cheap later, narrowing is not.
  Revisit-if: a real multi-tenant org install exists.
- Revert ADR-119 to default-OFF — rejected: re-creates the ADR-103
  measure-then-decide deadlock; the danger is contained by classes + gates,
  not by turning the layer off.
- Semantic PII detection / k-anonymity — out of scope per ADR-119 §6
  (write-time text gate, single-install trust boundary).

## References

- `agents/settings/contexts/knowledge-sensitivity.md` — locked design table.
- ADR-119 — the flip this hardens.
- Implementation: `knowledge_global.ts` (SENSITIVITIES, footer fields),
  `knowledge_global_promote.ts` (`resolve_effective_sensitivity`,
  `gate_sensitivity_for_promotion`, tombstones), `knowledge_global_cli.ts`
  (promote/forget/purge/list flags), `check_knowledge_cards.ts` (G4–G6);
  118 tests across 6 files incl. 3 cross-project-contamination adversarial
  cases.
