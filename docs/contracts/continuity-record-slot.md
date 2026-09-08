---
stability: beta
keep-beta-until: 2026-12-07
---

# Continuity-record slot — capacity policy and state machine

> The continuity record is a **one-slot queue per session**: one producer, one
> authoritative file, one validating-and-destructive consumer. This contract
> names who owns a conflict over that slot, and what every state of it means.
>
> Implemented by `src/scripts/_lib/continuity_slot.ts`; the paths and the
> staleness bound come from `src/scripts/_lib/recycle_envelope_paths.ts`, which
> stays the single place the producer and the consumer agree on them. Checked by
> `tests/scripts/_lib_continuity_slot.test.ts`.

Written for `road-to-continuity-writer-activation` step 1.1, and written
**before** any automatic writer exists, which is the whole point of the
ordering. With a manual producer — a human running `agent-config
session:recycle` once before `/clear` — contention over the slot was
theoretical. Automatic production makes it routine, and a policy decided after
the writer ships is a policy decided by whatever the writer happened to do.

## The policy

```
SUPERSEDE OWN · REFUSE FOREIGN · QUARANTINE UNUSABLE · NEVER GO BACKWARDS.
```

| Resident of the slot | What a publish does | Resulting state |
|---|---|---|
| nothing | write | `published` |
| this session's own record, older or equal `written_at` | **supersede** it | `published` |
| this session's own record, *newer* `written_at` | **refuse**, write nothing | `published` (unchanged) |
| another session's usable record | **refuse**, touch nothing | `conflicting` |
| unparseable, schema-invalid, or expired record | **quarantine** it, then write | `published` |

"This session's own" is decided by the resident's `session_id` field, never by
recency and never by the filename. The filename is already session-keyed
(`recycle_envelope_rel`), so a foreign resident is only reachable through the
legacy shared path that keying falls back to when no session id resolves — but
that path is reachable, so the case is handled rather than assumed away.

## The states

| State | Observable as |
|---|---|
| `absent` | no file at the authoritative path, and no consumed or quarantined sibling |
| `published` | a file that parses, validates, is inside the staleness bound, and is not foreign |
| `consuming` | **nothing on disk** — see below |
| `consumed` | the consumed sibling exists; the authoritative path does not |
| `quarantined` | either a resident that cannot be used, or a free slot with a quarantined sibling |
| `conflicting` | a usable resident whose `session_id` names a different session |

### `consuming` is a transition, not a state

There is no on-disk `consuming`, and that is the answer to the interruption
question rather than a gap in the model.

- **Publication** is `writeFileSync` to `<target>.tmp.<pid>` followed by one
  `fs.renameSync` onto the authoritative name
  (`state_io.ts` → `_publish_text_locked`).
- **Consumption** is one `fs.renameSync` from the authoritative name onto the
  consumed name (`handoff_context_hook.ts:199`), with an `unlinkSync` fallback
  so the record can never survive its own consumption.

Both transitions are a single rename inside one directory. An interruption
therefore lands strictly before or strictly after it, and the authoritative name
holds either the previous complete record or the new complete record — never a
partial one. A reader never has to tolerate a half-written record, so it never
has to distinguish `consuming` from `published`.

What an interruption before the rename *does* leave is an orphaned
`<target>.tmp.<pid>` file. It is not the authoritative name, so no reader
resolves it (`listContinuityRecords` filters on the `recycle-envelope` prefix
and a `.json` suffix; a `.tmp.<pid>` suffix fails it), and the state janitor
prunes it. That is a litter problem, not a correctness one.

## Why the two alternatives are rejected

The roadmap step offered three policies. Both rejected ones are rejected on
evidence in this tree, not on preference.

**Create-if-absent (safe-skip).** This is the policy the roadmap's own Risk 2
describes as a silent data loss — "the successor resumes from something
plausible and older". Rejected. Within one session the resident and the incoming
record share a key, a workspace and a predecessor: the incoming one is the same
lineage at a later moment. Keeping the older buys no safety and loses everything
the session did in between.

The asymmetry matters and is the reason the policy is discriminated by identity
rather than by recency. Superseding *your own* earlier record destroys nothing
anybody else could want. Superseding *another session's* record destroys the
only copy of state that session cannot regenerate, and that session has no way
to find out. So the same slot gets replace in one case and refuse in the other.

**A bounded multi-record queue.** Rejected because the reader forbids the
resolution such a queue would need. Choosing one of several records requires
recency, and `recycle_envelope_paths.ts` carries a recorded decision against
exactly that: a pointer file naming the newest "would restore the shared write
target one layer up and re-create the same race with an extra indirection …
Resolution is by register identity, workspace and branch — never by recency."
`resolveContinuityRecord` implements it — several candidates and no session id
**start clean** rather than pick. A queue would either contradict that lock or
be unreadable, and the lock is the older decision.

## Why quarantine rather than delete

An unusable resident is moved to `recycle_quarantine_rel(session_id)`, never
unlinked. The reader already discards a malformed, invalid or expired record
loudly, so nothing is lost by taking it out of the authoritative name — but the
evidence of *why* a resume did not happen is the only artefact anyone debugging
a missed resume has, and deleting it deletes that.

Quarantine is deliberately **not** the consumed name. `.consumed.json` is a
claim that a successor read the record, and `predecessorTracePresent` reads
exactly that file to corroborate a lineage. Writing a never-consumed record
there would manufacture a predecessor trace, which is the one thing that check
exists to refuse.

## Why the locked write, not `atomic_write_json`

`publishContinuityRecord` writes through `update_json_under_lock`, not through
the `atomic_write_json` that `session:recycle` still uses. The difference is the
policy: the locked form is a read-modify-write, so the resident is inspected and
the decision taken **inside** the exclusion that stops a peer publishing between
the inspection and the write. `atomic_write_json` has no such window and cannot
express a refusal — it is last-writer-wins on a whole file, which is exactly the
undecided behaviour this contract replaces.

`update_json_under_lock` fails closed: a held lock returns `failed` and the
publish reports a refusal rather than working around the exclusion.

## What this contract does NOT cover

- **Who writes the record.** The producer is `session:recycle` today and an
  automatic writer under `continuity.auto_record` from step 1.2. This contract
  governs the slot, not the field computation.
- **What the record contains.** That is the `continuity_record` variant of the
  capsule schema (`subagent_capsule.ts`), and its validator is called from here
  rather than re-implemented.
- **Cross-workspace records.** The consumer's workspace-realpath identity check
  owns that, unchanged.
- **Pruning.** The state janitor owns the lifetime of consumed and quarantined
  siblings.

## See also

- `src/scripts/_lib/recycle_envelope_paths.ts` — paths, staleness bound, reader
  resolution, and the no-`latest`-index decision this contract defers to.
- `src/scripts/_lib/subagent_capsule.ts` — the schema and its validator.
- `src/scripts/handoff_context_hook.ts` — the consumer, and the consume-by-rename.
- `docs/contracts/continuity-rollback.md` — which switch undoes what, and what a
  switch cannot undo.
