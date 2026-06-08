---
adr: 062
status: accepted
date: 2026-06-08
decision: encrypt-at-rest-store-architecture
supersedes: —
superseded_by: —
phase: employee-product Phase 8 (road-to-employee-product-and-external-proof, Step 3)
type: structural
---

# ADR-062 — Encrypt-at-rest store architecture: AES-256-GCM + Python-authoritative store access

## Status

**Accepted** · 2026-06-08. Design converged via two-round AI-council debate
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode, 2026-06-08). Both
members independently converged in round 2. This ADR records the architecture;
the **implementation is a dedicated follow-up PR** (scope + must-haves below) —
it is deliberately **not** bundled into a reconciliation diff.

## Context

Phase 8 of the employee-product workstream adds at-rest encryption for the
three workspace stores under `~/.event4u/agent-config/workspace/`
(sessions `*.jsonl`, documents `*.md` + `*.history.jsonl`, analytics
`events.jsonl`). The crypto layer `workspace_crypto.py` is shipped behind the
`workspace.encrypt_at_rest` flag (default **OFF** — no field data is encrypted
yet). A prior council (2026-06-07) deferred the *store wiring* to its own PR
because the Node-side crypto/key approach was undecided.

Two problems had to be resolved before any wiring:

1. **Cipher drift.** `docs/contracts/at-rest-encryption.md` specifies
   **AES-256-GCM** (envelope `AC1\0` + version + 12-byte nonce + 16-byte tag +
   ciphertext) and lists `keytar` (Node) alongside `keyring` (Python). The
   shipped `workspace_crypto.py` actually uses **Fernet** (AES-128-CBC +
   HMAC-SHA256, magic `E4U-WSv1`). Fernet is not natively reproducible in
   Node's `node:crypto`; AES-256-GCM is.
2. **The Node GUI server reads/writes the stores directly** (`src/server/routes/workspace.ts`
   via `fs` — readdir/readFile/writeFile/appendFile, filtering by `.jsonl` /
   `.md`). If Python writes `.enc`, those direct reads break.

## Decision

### A — Cipher: align the code to the contract's **AES-256-GCM**

The code is wrong, not the contract. Re-cipher `workspace_crypto.py` from
Fernet to AES-256-GCM with the documented `AC1\0` + version-byte envelope,
keeping the public API (`encrypt_bytes` / `decrypt_bytes` / `encrypt_file` /
`decrypt_file`) and the plaintext-pass-through-on-read back-compat. Reject
unknown envelope versions explicitly. Safe to do because the flag is default-OFF
and **no Fernet-encrypted field data exists** to migrate. AES-256-GCM is native
in both `cryptography` (Python `AESGCM`) and `node:crypto`, so the same envelope
is byte-reproducible across runtimes.

### B — Store access: **Option 4, Python-authoritative end-to-end**

The Node GUI server stops reading/writing the encrypted store files directly.
All store access routes through the Python CLI modules (the canonical writers),
which own encryption. Rejected alternatives:

- **keytar in Node** — `keytar` is deprecated (Dec 2022, superseded by
  Electron `safeStorage`); cross-library keychain interop between Python
  `keyring` and `keytar` is unproven. Both council members rejected it.
- **Reimplement Fernet in Node** — moot once A picks AES-256-GCM, and still a
  new format-fiddly surface.
- **Dual native crypto** — duplicates the security-critical path in two
  runtimes; the council called line-count "narrowness" that leaves a dual-write
  footgun a false economy.

To avoid Python interpreter cold-start cost (the dissent's concern, sharp on
Windows ~200–500 ms), store reads use **batched** CLI calls (e.g.
`workspace_sessions.py list --decrypt` returns all decrypted records in one
subprocess), not one subprocess per file.

## Consequences

- The follow-up PR is a **real refactor of the GUI data path**, not a wiring
  one-liner. The council was explicit: *"ship the right architecture now, or
  don't ship encryption at all"* — Option 1 (shell-out as a temporary
  intermediate) was rejected as process theatre.
- The flag stays **default OFF** through this work; the `true` flip waits for
  external (recruit-session) validation per `agents/roles/EVIDENCE_BASIS.md`'s
  sibling reasoning.

### Must-haves before the implementation PR is greenlit (council checklist)

1. **`cryptography` exercised in CI.** Today the round-trip tests in
   `tests/test_workspace_crypto.py` **skip** when `cryptography` is absent —
   and it is absent in CI, so the cipher has never actually round-tripped under
   test. The implementation PR MUST add `cryptography` to the test job so the
   AES-256-GCM round-trip genuinely runs (otherwise the cipher ships unverified
   — a `verify-before-complete` violation on a security primitive).
2. **Migration with concurrency safety.** Detect plaintext → encrypt-in-place
   atomically (temp + fsync + rename + delete), roll back on any error; refuse
   to migrate while the GUI server is running (or make it non-destructive).
3. **Key rotation path.** Wrong-key today = permanent data loss; ship
   `workspace_crypto.py rekey` + a documented recovery/export flow.
4. **Kill-switch / rollback criteria.** `AGENT_CONFIG_NO_ENCRYPTION` already
   forces-disable reads; add an emergency bulk-decrypt and a documented
   error-rate auto-disable.
5. **Envelope version semantics.** Version byte defined; unknown versions
   rejected with a clear error, not a crash.
6. **Cross-runtime integration test.** Python encrypts → Node reads back the
   decrypted record through the Python-authoritative path (Option 4).

## Alternatives

See § Decision B rejected alternatives (keytar / Fernet-in-Node / dual native)
and the cipher A alternative (keep Fernet + reconcile the contract to document
it — rejected because it forecloses native Node interop and the contract's
AES-256-GCM was the deliberate original design).

## References

- Contract: [`docs/contracts/at-rest-encryption.md`](../contracts/at-rest-encryption.md).
- Crypto layer: `src/cli/python/workspace_crypto.py`.
- GUI store IO: `src/server/routes/workspace.ts`.
- Prior deferral: AI-council 2026-06-07 (recorded in the roadmap Phase 8 Step 3 deferral note).
- Roadmap: `agents/roadmaps/road-to-employee-product-and-external-proof.md` Phase 8.
