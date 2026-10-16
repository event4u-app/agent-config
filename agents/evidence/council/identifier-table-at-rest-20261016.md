<!-- evidence-type: analysis -->

# No detected value is persisted between events — (b), with a revised security contract

**Date:** 2026-10-16 · **Members:** `anthropic`, `openai`
**Mode:** prompt, 2 rounds, peer review, blind chairman · **Cost:** $0.00 (subscription transport)
**Quorum:** 2/2 concluded · **Verdict: `(b)` — convergent, with four required revisions**

Closes the `identifier-table-at-rest` blocker on
`road-to-placeholders-on-the-wire` and fixes what step 2.1 builds. The question:
where may a detected identifier's value rest between the moment a tool result is
replaced and the moment a token travels back out — in a `0600` per-session file
(a), or nowhere at all (b)?

A memory-resident map was excluded before the round: the dispatcher is one
process per event (`docs/contracts/runtime-component-classes.md:39`), so
nothing holds a map across two events without writing it down.

| Seat | Pick | Decisive reason |
|---|---|---|
| `anthropic` | `(b)` | the session file is the artefact an attacker wants most; permissions are not the control |
| `openai` | `(b)` | compartmentalisation — one table converts many dispersed disclosures into one durable one |

## What both seats held

**A `0600` mode decides which OS principals may read a file. It is not a
defence.** It does not bound same-user compromise, privileged software, backup
capture, crash residue or a cleanup that did not run. Option (a) converts many
dispersed disclosures into one durable disclosure.

**An unavailable, changed, ambiguous or mismatching origin fails closed.** A
replacement value is never guessed and never silently adopted.

## The four revisions the verdict is conditional on

**1. The invariant is "never persisted", not "lives nowhere".** The honest
statement is *detected values are never persisted by this subsystem between
events*. A value still exists transiently while an origin is re-read and while
an outbound restoration is assembled. Writing the stronger claim would be
false.

**2. An origin path is not sufficient.** Restoration binds to an authenticated
origin descriptor: connector or tool, tenant or account, a stable object
identity, the exact field location, the session, the token type and the
intended operation. Per source type, concretely:

| Source | Stable identity |
|---|---|
| file | `(device, inode, path)`, or a content digest where the path may be replaced |
| API response | `(endpoint, method, request fingerprint, response timestamp)` |
| database result | `(connection, query fingerprint, row identifier)` |

**3. Restoration has named, documented outcomes, each failing closed.**
`ORIGIN_CHANGED` (fingerprint mismatch) · `ORIGIN_UNAVAILABLE` (no longer
reachable) · `ORIGIN_AMBIGUOUS` (several matches) · `DESTINATION_MISMATCH`
(token bound elsewhere) · `SESSION_EXPIRED` (replay). Each carries a
user-facing message and one recovery path: explicit confirmation with the value
shown.

**4. Same-destination restoration verifies the fingerprint too.** The
round-one reading treated a same-destination restore as transparent. If the
origin changed between detection and re-use, a transparent restore replays a
stale value. Even same-destination fails closed on `ORIGIN_CHANGED`.

## Where the seats disagreed, and it matters

**A keyed fingerprint does not close the guessing attack.** An HMAC prevents
useful precomputation, but the proposed table stores the per-session key
*beside* the fingerprint. An attacker holding that table can run an offline
dictionary attack against low-entropy values — account ids, ticket keys,
internal hostnames. openai is explicit that this is unresolved by the keying
alone.

**What (b) actually buys is narrower than "protection against compromise".**
openai: it is **data minimisation and blast-radius reduction**. Malware running
as the same user that can read the table can often read the accessible origin
objects too. Claiming more than that would be the overstatement this record
exists to prevent.

**Friction is not self-justifying.** anthropic's round-one reading that
confirmation prompts are appropriate security behaviour was narrowed by openai:
friction helps only while confirmations stay rare, contextual and resistant to
habituation. Repeated prompts become approval theatre, and approval theatre is
a weaker state than no prompt at all.

## Revisit-if

- The capability becomes operationally unusable — measured by adoption falling
  away or by persistent reports, **not** by an arbitrary prompt-rate threshold.
  The 5 % figure floated in round one is unsupported and is not adopted.
- Origins in practice turn out to be commonly ephemeral, mutable, paginated or
  permission-sensitive, so restoration either fails often or produces enough
  prompts to habituate. That failure mode would erase (b)'s advantage.
- Offline guessing against the fingerprint table is demonstrated against
  realistic low-entropy identifiers.
