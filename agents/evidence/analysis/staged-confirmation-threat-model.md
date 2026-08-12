# Threat model — the staged-confirmation store

```
Skill:   threat-modeling
Target:  the binding set of `StagedAction`, before any binding field is added.
         Produced by `road-to-feedback-9-35.md` Phase 2.1/2.2; analysis only,
         no control implemented in that roadmap.
```

Three of five external reviews of the 9.30→9.35 span independently observe that
staged confirmation stopped being a work-engine feature and became an
authorization system, and ask for the properties one implies. `security-sensitive-stop`
requires the threat pass **before** the first edit to such a surface, so this
document is the pass. The implementation lands against it, separately — half a
binding on an authorization boundary is worse than none.

## What the reviews got wrong, and it matters for scope

Four of five call for binding the token to a **payload/arguments hash** so that a
confirmation of `delete branch foo` cannot execute `delete branch bar`. **That
case is already closed, by construction:**

```
deriveToken(action, object, nonce) = sha256(action ∥ NUL ∥ object ∥ NUL ∥ nonce)[:16]
```

The token *is* the binding. A different `object` is a different token, and
`StagedAction.object` is a required field documented as "the exact object the
approval names … a stage with no object is a category confirmation, and the rule
forbids exactly that". So the loudest P0 in the source is a fix for a hole that
does not exist, and implementing it would add a second hash beside the one the
token already is.

What the reviews were reaching for is real, but it is a different axis: the record
binds **what**, and binds nothing about **who** or **where**.

## Actors

- A human operator approving an action in one session.
- A local agent session — one of several. Measured during this pass: the session
  register reported **three** live sessions against one worktree.
- Any local process with write access to the repo.
- No remote actor. The store is a directory on the developer's filesystem; there
  is no network entry point.

## Assets

- A human approval for an irreversible action (push, deploy, send, purchase) —
  the thing the store exists to make exactly-once.
- The `object` field, which by contract carries the concrete target: a path, a
  URL, a recipient, an amount.

## Entry points

| Entry | File |
|---|---|
| `stageAction` → `putPending` — a record appears in `pending/` | `staged_confirmation.ts`, `staged_confirmation_store.ts:116` |
| `claimConfirmation(root, token, now)` — the claim that authorizes execution | `staged_confirmation_store.ts:194` |
| `listPending(root, now)` — enumerates every pending record | `staged_confirmation_store.ts:148` |
| `gates --pending` / `hooks:status --pending` — the rendered surface over `listPending` | `roadmap_gates.ts` |
| The store as a filesystem path | `agents/runtime/staged-confirmations/{pending,resolved}` |

## Trust boundaries

- **Crossed:** session → store. Any session reads and claims any record; the
  store keeps no notion of which session owns one.
- **Crossed:** caller-supplied `token` → filesystem path. Guarded — `isSafeToken`
  (`/^[0-9a-f]{8,64}$/`) is applied at `readPending`, `readResolved`,
  `putPending`, `claimConfirmation`, `declineConfirmation`, and inside `isStage`,
  so traversal is closed at every verb.
- **Accepted, and named rather than papered over:** the local filesystem is
  trusted. A process that can write `resolved/<token>.json` can fabricate an
  approval, and no in-process control can prevent that for a file-backed store
  in a developer's own repo. This is a boundary statement, not a mitigation — and
  it is the reason none of the abuse cases below are 🔴.

## Abuse cases (prioritized)

🟡 **Cross-session approval harvest** — `claimConfirmation` · any local session · a stage is pending
  **Impact:** a human approval given in conversation A authorizes execution in
  conversation B. The operator approved "push to origin/main" for one task; a
  second, concurrent session consumes that approval for its own push. The
  approval is real, the action is not the one that was approved.
  **Why the token does not prevent it:** `listPending` publishes every pending
  token, and `gates --pending` renders them for the operator. An enumerable
  secret is not a secret — the token is an *identifier*, and the store currently
  treats it as the sole *capability*.
  **Current control:** none. `StagedAction` carries `source` (the surface that
  staged it) but no session or actor.
  **Missing control:** a `session_id` bound at stage time; `claimConfirmation`
  refuses a claim from a different session unless the record is explicitly marked
  transferable. `staged_confirmation_store.ts:194`.
  **Required test:** a stage created under session A, claimed with session B's
  id, returns a non-`execute` outcome AND leaves the file in `pending/` — a
  refused claim must not consume the stage a legitimate holder may still confirm.

🟡 **Approval survives a roadmap-claim transfer** — `claimConfirmation` · the session that inherits a work claim · the staging session died with a stage pending
  **Impact:** session A claims roadmap R, stages a confirmed action, and dies.
  Session B takes R's claim. A's pending stage is still valid and still
  claimable, so an approval scoped to A's work executes under B's ownership.
  Nothing in the tree decides what should happen — this is the sequence one
  review names and no code answers.
  **Current control:** none. Expiry (`expires_at`, TTL) bounds the window but does
  not scope it to the work; a stage confirmed one minute after the transfer is
  inside its TTL.
  **Missing control:** bind work scope + session generation; on claim transfer,
  revoke pending stages of the previous holder unless explicitly transferable.
  The revocation belongs next to the claim transfer, not inside the store.
  **Required test:** stage under A, transfer R's claim to B, then claim A's token
  → revoked/refused, and `pending/` no longer offers it as awaiting approval.

🟡 **Unspecified nonce provenance** — `deriveToken` · a caller of `stageAction` · none
  **Impact:** two directions from one gap. The contract does not state that
  `nonce` must be unpredictable, so (a) a predictable nonce makes a future
  token computable before the stage exists, and (b) a *constant* nonce makes two
  stages of the same `(action, object)` collide on one filename, where the second
  `putPending` silently overwrites the first pending approval.
  **Current control:** `putPending` rejects a malformed token shape, but an
  attacker-chosen well-formed token is accepted; nonce quality is entirely the
  caller's.
  **Missing control:** state the CSPRNG requirement in the `deriveToken` contract,
  or generate the nonce inside `stageAction` so a caller cannot get it wrong.
  `staged_confirmation.ts`.
  **Required test:** two `stageAction` calls with identical `action` and `object`
  yield different tokens, and both records survive in `pending/`.

🟢 **No record of who approved** — `claimConfirmation` · n/a · an approval happened
  **Impact:** repudiation. `resolved/` records `state` and `resolved_at`, so the
  store proves *that* an approval was consumed and never *by whom*.
  **Current control:** none.
  **Missing control:** an `approved_by` field written at claim time; it is also
  the field the cross-session control above needs, so the two land together.
  **Required test:** a confirmed record carries the approving identity.

🟢 **Pending records disclose their object** — `listPending` · any local reader · a stage is pending
  **Impact:** `object` is required to be the concrete target, so a pending
  "send to <recipient>" or "purchase <amount>" publishes that value to every
  local reader of `gates --pending`. Inherent to a visible pending queue, and the
  visibility is the point; recorded so it is a decision rather than an oversight.
  **Current control:** the store sits inside the repo's gitignored runtime dir.
  **Missing control:** none proposed. Do not add redaction here — an operator who
  cannot see what they are approving cannot approve it.
  **Required test:** n/a (accepted).

## STRIDE sweep

| Category | This change | Verdict |
|---|---|---|
| **S**poofing | A claim carries no proof of who claims it | Hit — the cross-session case |
| **T**ampering | `resolved/` is a writable file; a fabricated confirmed record is indistinguishable from a real one | Accepted boundary (local filesystem), stated above |
| **R**epudiation | No `approved_by` | Hit — 🟢 |
| **I**nformation disclosure | `object` is published by the pending queue, by design | Hit — 🟢, accepted |
| **D**enial of service | `listPending` reads every file in `pending/`; `pruneExpired` bounds growth | n/a — bounded already |
| **E**levation of privilege | An approval for one session's action executes another's | Hit — the cross-session case |

## Implementation plan (for the change that follows, not for this document)

1. `session_id` + `approved_by` on `StagedAction`, and a `transferable` flag —
   `staged_confirmation.ts`. One field set, two abuse cases; adding them
   separately would ship the boundary half-bound.
2. Session check in `claimConfirmation`, refusing without consuming —
   `staged_confirmation_store.ts:194`.
3. Nonce generated inside `stageAction`, contract updated — `staged_confirmation.ts`.
4. Revocation on roadmap-claim transfer, at the claim-transfer site rather than
   in the store.
5. Do **not** add a payload hash. The token already is one; see above.

## Missing tests

1. Claim from a foreign session → refused **and** not consumed —
   `tests/.../staged_confirmation_store.test.ts`.
2. Claim after a roadmap-claim transfer → revoked — same file.
3. Same `(action, object)` twice → two distinct tokens, both pending — same file.
4. A confirmed record carries the approving identity — same file.

## Scope note

`decision_gate.ts` injects the confirmation seam default-off, and binding is
already deferred behind `confirmation-degraded-host-semantics`. Nothing above
argues for flipping that switch; the controls are what the seam needs *before*
it is flipped, not a reason to flip it.
