---
adr: 064
status: accepted
date: 2026-06-08
decision: append-jsonl-per-record-encryption
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof, Step 3)
type: structural
---

# ADR-064 — Append-JSONL per-record encryption protocol

## Status

**Accepted** · 2026-06-08. Resolves the nonce-management gate ADR-063 set.
Design converged via AI-council (claude-sonnet-4-5 + gpt-4o, design mode,
2026-06-08) — a cautious round that raised six refinements (nonce-count
awareness, single-writer enforcement, per-store corruption policy, envelope
versioning, OS preconditions, scope sequencing); the protocol below folds them
in. First store shipped under this protocol: **analytics**.

## Context

ADR-063 deferred encrypting the append-heavy JSONL stores because AES-GCM
cannot append to a blob and the per-record scheme needed a nonce-management
design. This ADR fixes the protocol.

## Decision

### Protocol — per-record self-contained envelope

Each JSONL record is encrypted independently into its own `AC1\0` AES-256-GCM
envelope (the Part-A cipher, with its version byte), base64-encoded as **one
line**. Append = `encrypt_line(json)` → a single atomic `O_APPEND` write. No
whole-file rewrite, no shared counter. Helpers live in `workspace_crypto`
(`encrypt_line` / `decrypt_line`); `decrypt_line` passes a plaintext JSON line
(`{`/`[`-prefixed) through unchanged, so a file with mixed plaintext+encrypted
records (flag flipped mid-life) reads correctly.

- **Nonce (N1):** a fresh **random 96-bit nonce per record**. NIST SP 800-38D
  permits random-construction nonces up to 2^32 invocations per key; a session
  or analytics file is many orders below that, and `rekey` resets the per-key
  count. Random nonces carry **no crash-fragile counter state** — the prior
  round's "catastrophic reuse" concern was about counters resetting on crash,
  which this scheme does not use.
- **Concurrency (N2):** correctness rests on **single-writer-per-file**, not
  locks. Each record line is independent (own nonce, own envelope), so one
  atomic append per line suffices. The single-writer guarantee is
  **architectural**: the Python store module is the sole writer. For sessions
  (Node reads+writes today) this means routing through the Python CLI
  (ADR-062 Option 4) so there is still exactly one writer — the protocol is
  single-writer-based, **not** Python-only-based, so it extends to sessions
  unchanged.
- **Corruption (N3) — per store:** *analytics* is best-effort telemetry →
  skip-and-continue on a torn/undecryptable line. *Document history* (when it
  lands) is state-critical → fail-closed. The reader policy is the store's
  call, not the protocol's.
- **Versioning (N4):** the envelope version byte (Part A) lets a future
  scheme coexist; unknown versions already reject.

### Operations parity

Each encrypted append-JSONL store ships `migrate` (plaintext → per-record
`.enc` lines, idempotent), `decrypt-all` (kill-switch → plaintext, works
flag-off), and `rekey` (rotate key + re-encrypt every record). `prune` (and any
age/query reader) is decrypt-aware but keeps the original encrypted line at
rest.

### Rollout order

1. **analytics** — Python-only, single-writer already true. **Shipped.**
2. **document `.history.jsonl`** — Python-only, inside `workspace_documents.py`;
   its whole-file `.md` migrate/rekey/decrypt-all gained a parallel per-line
   history pass. **Shipped.**
3. **sessions** — Node reads+writes; needs the Option-4 Node-session refactor
   (listSessions / readSessionLog / launch / append routed through the Python
   CLI). Largest, its own PR. **Remaining.**

## Consequences

- Analytics records are encrypted at rest when the flag is on; the flag stays
  **default-OFF**, so nothing changes for today's users.
- `emit()` stays non-blocking and never raises: a crypto error DROPS the event
  (consistent with the existing scrub-fail-drop), never persists it
  unencrypted.
- The shared `encrypt_line`/`decrypt_line` protocol is now the contract the
  history + session follow-ups reuse verbatim.

## Alternatives

Counter-based nonces (rejected: crash-fragile state, concurrent-index
allocation) and whole-file read-modify-rewrite per append (rejected by ADR-063:
O(file) on the analytics hot path). See ADR-062 (cipher + Option 4) and ADR-063
(the deferral gate this resolves).

## References

- ADR-062 — cipher + Python-authoritative architecture.
- ADR-063 — the deferral + nonce gate this resolves.
- `src/cli/python/workspace_crypto.py` (`encrypt_line`/`decrypt_line`),
  `workspace_analytics.py` (emit/read/prune/migrate/decrypt-all/rekey).
- Contract: [`docs/contracts/at-rest-encryption.md`](../contracts/at-rest-encryption.md).
