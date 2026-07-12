# Knowledge sensitivity — per-card boundary classes (design note)

> Locked design for the feedback-8.11 Phase 1 boundary layer
> (council-adjudicated 2026-07-12, claude-sonnet-4-5 + gpt-4o; ADR-121).
> The maintainer named cross-project context transfer a present danger; the
> council rejected a six-class enum as over-fit to a single-maintainer
> install. This is the middle path: a SMALL, machine-anchored axis on top of
> the existing ADR-119 gates.

## The three classes — each anchored to a machine check

| Class | Meaning | Machine anchor |
|---|---|---|
| `prohibited` | Contains redaction-class content (secret / email / project path / hostname / money / customer / SQL / long code / hidden unicode). Never leaves the repo. | The existing redaction scan (`knowledge_global_redaction.ts`); a redaction hit FORCES effective sensitivity `prohibited` regardless of the declared value; `prohibited` in the global store is a hard linter error (G6). |
| `project` | DEFAULT. Stays project-local. | Promotion refused by `gate_sensitivity_for_promotion()` unless a human reclassifies; unset/invalid values resolve to `project`, never up. |
| `shareable` | Eligible for the global store. | Must pass redaction AND carry full provenance (`source_repo`, `owner`, `review_after`, `promotion_reason` — linter G5); `sensitivity` present + valid on every global card (G4). |

Derivation rule: effective sensitivity = `prohibited` if the redaction scan
trips, else the declared value, else `project`. **Never auto-`shareable`** —
crossing the project boundary is always a human act with a recorded
`promotion_reason`.

## Provenance + revocation

- Shared cards carry `source_repo`, `owner`, `review_after`,
  `promotion_reason` in the provenance footer (audit facts, next to
  `first_seen` / `promoted_at` / `last_verified` / `tier` / `seen_in`).
- `forget` / `purge` write an append-only tombstone
  (`.revocations.jsonl`: `revoked_at`, `card_id`, `reason`) BEFORE deleting;
  `knowledge:global:list --revoked` renders the trail. No silent deletes.

## What was deliberately NOT built (revisit-if)

- **`team` / `organization` classes** — phantom for a single-maintainer
  install. Revisit-if: a real multi-tenant consumer (second org install with
  shared knowledge flows) exists; then widen the enum via
  decision-revisit-gate, not silently.
- **Read-time gates / semantic PII models / k-anonymity** — out of scope per
  ADR-119 §6 (write-time text gate on a single-install trust boundary).
- **Reverting ADR-119's default-ON** — the flip stays; its 60–90-day
  measurement window and pre-registered demotion trigger continue unchanged.
  This layer adds teeth, not a rollback.

## Relationship to `tier`

`tier` (`public|vendor|proprietary`) classifies ORIGIN (where knowledge came
from); `sensitivity` classifies BOUNDARY (how far it may travel). Both gates
run at promotion: tier gate first (proprietary = manual-only), then
redaction, then sensitivity.

## Scaling posture (feedback-8.11-2, 2026-07-12)

The reviewer's scale worries ("human promotion_reason protects but does not
scale") map to five mechanisms — three already exist:

| Ask | Status |
|---|---|
| "never globally promote this source" policy | EXISTS — `agents/knowledge/.share-blocklist` (first gate in the promotion order) |
| per-entry expiry | EXISTS — `review_after` (required on shared cards, linter G5) |
| bulk revocation | EXISTS — `knowledge:global:purge` tombstones every card before wiping |
| batch review | PARKED |
| ownership queues | PARKED |

Batch-review / ownership-queue tooling is deliberately NOT built: current
promotion volume is far below any bottleneck. Revisit-if: **>20 pending
promotion suggestions accumulate within one observation window** — then
design queue tooling against the real backlog shape, not a guessed one.
