---
adr: 063
status: accepted
date: 2026-06-08
decision: append-jsonl-encryption-deferred
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof, Step 3)
type: structural
---

# ADR-063 — Append-JSONL store encryption deferred (nonce-management gate)

## Status

**Accepted** · 2026-06-08. AI-council (claude-sonnet-4-5 + gpt-4o, design mode,
2026-06-08). Records why encrypt-at-rest Part B ships **documents-only** and
what must be solved before the append-heavy JSONL stores are encrypted.

## Context

ADR-062 chose AES-256-GCM + Option-4 Python-authoritative store access. The
three workspace stores have different write shapes:

- **documents** — whole-file `<slug>.md`. Whole-file `.md.enc` is a natural
  fit; encrypted in Part B.
- **sessions** — `sessions/<day>/<id>.jsonl`, **append-heavy** (one record per
  host turn).
- **analytics** — `analytics/events.jsonl`, **append-heavy** on a hot UI path.
- **document revision logs** — `<slug>.history.jsonl`, append-once-per-save.

AES-256-GCM encrypts a whole blob — you cannot append a line to an encrypted
blob. Two strategies were weighed:

- **Whole-file read-decrypt-append-encrypt-rewrite** per append: O(file) per
  event under a lock — unacceptable for the analytics hot path.
- **Per-record encryption** (one envelope per line, append stays append):
  attractive, but the council flagged it as **cryptographically unsafe as
  sketched** — AES-GCM security collapses on (key, nonce) reuse, and the
  design had no nonce-derivation scheme, no crash/concurrency reuse proof, no
  nonce-exhaustion handling.

## Decision

**Defer encryption of all append-JSONL stores** — `sessions/*.jsonl`,
`analytics/events.jsonl`, and document `*.history.jsonl` — to a dedicated
follow-up. Part B encrypts document `.md` bodies only (the highest-sensitivity
content: offer / mail / memo / brief bodies). The append-JSONL set stays
plaintext until a per-record encryption protocol is designed and ADR'd.

## Consequences

- Document bodies are encrypted end-to-end (write + Python-authoritative read);
  edit metadata in `.history.jsonl` and session/analytics records remain
  plaintext for now. The at-rest-encryption contract scope table is updated to
  mark this split explicitly so no one assumes the JSONL stores are protected.
- The flag stays default-OFF; nothing about today's behaviour changes.

### Must-solve before append-JSONL encryption (the follow-up ADR's gate)

1. **Nonce-derivation scheme** that provably never reuses (key, nonce):
   deterministic from (key, file-id, monotonic-record-index) or a
   crash-persistent counter — not bare random per line.
2. **Concurrent-append serialization** (file lock + atomic record-index
   allocation) so two writers cannot mint the same nonce.
3. **Crash safety** — partial/truncated final record detected and skipped, not
   fatal; counter state survives process restart.
4. **Nonce-exhaustion / rotation** before the GCM 2^32-per-key limit.
5. **Hot-path cost** — analytics `emit()` must stay non-blocking; per-record
   encryption must not reintroduce whole-file rewrite.

## Alternatives

Whole-file-rewrite-per-append (rejected: O(file) on the hot path) and
ship-all-three-now with random per-line nonces (rejected: nonce-reuse
vulnerability). See ADR-062 for the cipher + Option-4 architecture this builds
on.

## References

- ADR-062 — encrypt-at-rest store architecture (cipher + Option 4).
- Contract: [`docs/contracts/at-rest-encryption.md`](../contracts/at-rest-encryption.md).
- Stores: `src/cli/python/workspace_sessions.py`, `workspace_analytics.py`, `workspace_documents.py`.
