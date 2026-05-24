# At-Rest Encryption Contract

> **Status** · v0 / design · 2026-05-24. Phase 8 of
> [`road-to-employee-product-and-external-proof.md`](../../agents/roadmaps/road-to-employee-product-and-external-proof.md).
> Single-user, single-machine encryption for the three workspace
> stores added in Phases 4 / 5 / 7. Does **not** touch the existing
> `agents/memory/` store — that gets a separate decision.

## Threat model

The stores written under `~/.event4u/agent-config/workspace/` will
hold actual customer data once recruit-session participants adopt
the workspace: offer drafts naming customer X, mail drafts with
contact email + phone, memos referencing internal pricing. Three
threats this contract addresses:

| Threat | Surface | Defence |
|---|---|---|
| **Lost / stolen laptop** | FDE may not be enabled or may be unlocked | Per-user key wrapped by OS keyring; cipher blob useless without the keyring entry. |
| **Shared workstation** | Another OS user reads `~/.event4u/...` | POSIX 0600 + keyring entry scoped to the user account. |
| **Accidental `git add ~/.event4u/...`** | User commits the store from a misconfigured shell | Encrypted blob is opaque; secrets do not leak as plaintext into the diff. Pre-commit hook detects the path; encryption is defence-in-depth. |

Explicit non-goals:

- **Not** protection against a compromised OS user account.
- **Not** protection against a malicious admin / root.
- **Not** protection against memory dumps while the workspace is
  running.
- **Not** a substitute for full-disk encryption — the contract
  explicitly recommends FDE in `docs/guides/at-rest-encryption.md`.

## Cipher choice

**AES-256-GCM** for the data blob. Single per-user master key,
32 random bytes, generated on first workspace launch.

The master key is stored in the OS keyring:

| OS | Library | Backend |
|---|---|---|
| macOS | `keyring` (Python) / `keytar` (Node) | Keychain |
| Linux | `keyring` / `keytar` | Secret Service / libsecret (gnome-keyring, KWallet) |
| Windows | `keyring` / `keytar` | Credential Manager |

Service name: `event4u-agent-config-workspace`. Account name:
`<os-user>`. The keyring entry is the **only** persistent copy of
the master key on the machine — never written to disk in plaintext,
never logged.

## Scope

Encrypts (Phase 8 v0):

| Path | Phase | Sensitivity |
|---|---|---|
| `workspace/sessions/**/*.jsonl` | 4 | host replies may contain customer data |
| `workspace/documents/**/*.md` | 5 | offer / mail / memo / brief bodies |
| `workspace/documents/**/*.history.jsonl` | 5 | edit metadata + SHAs |
| `workspace/inbox/**/*.md` | 4 | rendered prompts for Tier-3 hand-off may contain customer names |
| `workspace/analytics/events.jsonl` | 7 | event counters; lower sensitivity but uniform treatment |

Does **not** encrypt (v0):

- `agents/memory/` — under the maintainer's repo, separate decision.
- `.agent-settings.yml` — config, no customer data.
- `package.json` / lockfiles / source — public surface.

## Storage layout (encrypted)

Each plaintext file is replaced by a sibling cipher file:

```
workspace/documents/offer/kundeX-angebot-2026-05-24.md
  → workspace/documents/offer/kundeX-angebot-2026-05-24.md.enc
```

`.enc` envelope:

```
| 4 bytes  | magic: "AC1\0"
| 1 byte   | version: 0x01
| 12 bytes | GCM nonce
| 16 bytes | GCM auth tag
| N bytes  | ciphertext
```

Filename itself is **not** encrypted in v0 (filename leakage is an
accepted trade-off — slugs are kebab-case derived from titles and
may contain customer names; mitigation: title slug allowlist
documented in `workspace-documents.md`).

## Feature flag + migration

Single setting in `.agent-settings.yml`:

```yaml
workspace:
  encrypt_at_rest: true   # default from v1.0
```

Migration on first launch after upgrade:

1. Detect any plaintext files under the encrypted scope.
2. Show one-time modal: "Encrypt your local workspace store?"
   with options [Encrypt now] / [Keep plaintext (not recommended)].
3. On "Encrypt now": iterate, encrypt-in-place atomically (write
   `.enc.tmp`, fsync, rename, delete plaintext). Roll back on any
   error.
4. On "Keep plaintext": flip `encrypt_at_rest: false`. Next
   workspace launch re-asks unless the user sets
   `workspace.encrypt_at_rest_dismissed: true`.

## Recovery path

The master key lives in the OS keyring. Recovery scenarios:

- **Re-install OS / move to a new machine**: workspace prompts on
  first launch to either restore an exported key file (`.event4u-recovery.key`)
  or treat the encrypted store as inaccessible.
- **Lost master key, no export**: workspace surfaces a destructive
  banner: "encrypted store is unrecoverable; delete and start
  fresh?" — explicit user click required.
- **Key export**: `npx @event4u/agent-config workspace:export-key`
  prompts the user to pick a target file. The export is the raw
  32-byte key in a labelled wrapper; the user is responsible for
  storing it safely (password manager, hardware token, paper
  backup).

## Coverage (Phase 8 Step 4)

- Round-trip: encrypt → decrypt produces identical bytes for ≥ 5
  fixture documents.
- Wrong key → GCM auth failure → renderer surfaces a clear "wrong
  key" error, not a generic crash.
- Keyring-missing-entry path (mocked) → migration modal appears.
- Concurrent writers → second writer waits on the file lock, no
  truncation.
- Threat-model checklist verified against `threat-modeling` skill.

## Cross-references

- Phase 4 stores: [`daily-workspace`](daily-workspace.md).
- Phase 5 stores: [`workspace-documents`](workspace-documents.md).
- Phase 7 store: [`local-analytics`](local-analytics.md).
- Guide (deferred to Phase 8 Step 5): `docs/guides/at-rest-encryption.md`.
- Memory-store decision (deferred): out of scope for v0.
