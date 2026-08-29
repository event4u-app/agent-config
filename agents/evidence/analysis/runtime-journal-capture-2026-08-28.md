<!-- evidence-type: analysis -->

# Runtime event journal — first capture measurement (Phase 1.4)

**Date:** 2026-08-28 · **Roadmap:** `road-to-runtime-event-journal`, step 1.4 ·
**Subject:** `src/scripts/_lib/runtime_journal.ts` +
`src/scripts/hooks/journal_record_hook.ts`

**Revision 2 — rewritten after AI council 2026-08-28** (anthropic + openai, 2/2
convergent). Revision 1 reported `undefined` and stopped there. Both seats
accepted `undefined` as the honest reading and rejected it as a discharge of
1.4: *"zero numerator does not establish 0 % when the population itself was not
observed."* The journal has since been bound into the hook dispatch path, so
there is now a population to observe — a **different** one from the population
1.4 asks about, and the whole point of this page is keeping those two apart.

## Verdict in one line

**1.4 is partially met and remains UNMET on the delivery axis, and that is the
finding.** A dispatch-path capture rate is now measurable and is published
(100.00 %, denominator 1,000 envelopes). A **host** capture rate is still not
measurable in this environment for two independent reasons — no
host-emitted-event denominator exists anywhere in this tree, and the concern
ships default-OFF so a default install records nothing. The step's checkbox is
`[~]`, not `[x]`.

## What changed since revision 1

Revision 1's own § "What would close 1.4 properly" listed, as item 1: *"bind the
journal to a `post_tool_use` or `stop` slot in `hook_manifest.yaml` and count
landed records against the host's own dispatch count over a real session."* It
then declined to do it, on the grounds that inventing a binding to make a number
appear *"would be the measurement corrupting its own signal"*.

The council overturned the second half and kept the first. Binding is inside
Phase 1's own goal — the phase is titled *"The journal, written by hooks that
terminate"* — so it is the step's work, not a way of dressing up its number. The
corrupting-the-signal risk is real and is answered by **reporting the two
populations separately**, which is what the tables below do.

| | Revision 1 | Revision 2 |
|---|---|---|
| Journal bound in a hook slot | no — `grep -c runtime_journal hook_manifest.yaml` was 0 | **yes** — `journal-record`, 8 cells |
| Writer capture (synthetic calls) | 100 % / 1,000 | unchanged, and still a floor |
| **Dispatch-path capture** | not measurable | **100.00 % / 1,000 envelopes** |
| **Host capture** | `undefined` | **still `undefined`** |
| 1.4 status | reported as an honest null | `[~]` — partial, unmet on delivery |

## The three populations, kept apart

The whole reason this page is long is that three numbers here look like the same
number and are not.

| # | Population | Denominator | Result | What it establishes |
|---|---|---|---|---|
| 1 | **Writer** — `recordEvent` calls made directly | 1,000 calls | 100.00 % | the module drops nothing handed to it. A floor. Says nothing about delivery |
| 2 | **Dispatch path** — dispatcher envelopes handed to the concern | 1,000 envelopes | **100.00 %** | the manifest entry, the registry entry, the enable gate, the envelope-to-record mapping and the write all work end to end |
| 3 | **Host** — events a real host EMITS | **unknown** | **`undefined`** | the number 1.4 actually asks for. Not obtainable here |

Reporting 2 as though it were 3 would be exactly the category error revision 1
warned against, so it is named at every point of use.

## Measurement 2 — dispatch-path capture

Denominator: **1,000 dispatcher envelopes** — 100 per vocabulary member, 10
members — handed to `journal_record_hook.recordedFor()` on an armed temp root.

| Field | Value |
|---|---|
| Envelopes dispatched | 1,000 |
| Records landed | **1,000** |
| Capture rate | **100.00 %** |
| Skipped for any reason | 0 |
| Vocabulary members at full capture | 10 of 10 |
| Store size | 339,968 bytes (about **340 bytes per record**) |
| `boundary_status: session_fallback` | **1,000 of 1,000** — see below |
| Default-OFF control (no settings file) | 10 of 10 events refused with reason `disabled` |

`recordedFor` returns a **named skip reason** rather than a boolean, precisely so
a zero cannot be blind: `disabled`, `sqlite-unavailable`, `event-not-recorded`,
`no-session-id`, `replay-mode`, `write-failed`, `not-an-envelope`. A future run
that reports 0 % will say which of the seven it was.

Reproduce: arm `hooks.runtime_journal.enabled: true` on a temp root, call
`recordedFor` for each member of `RECORDED_EVENTS`, compare `readAllEvents()`
against the call count. The same measurement runs as an assertion in
`tests/scripts/hooks/journal_record_hook.test.ts`.

### The 1,000-of-1,000 `session_fallback` is a finding, not noise

Every record landed under the **session fallback** boundary, marked, because the
dispatcher envelope carries **no `task_id`** on Claude — its documented shape
(`hooks/envelope.ts`) is `{schema_version, platform, event, native_event,
session_id, workspace_root, payload, settings}`. Cline's native payload carries
`taskId` and the concern reads it; nothing else observed does.

So the episode **spine** is landing, and the episode **boundary** is landing at
its documented fallback rather than at the council-adopted envelope correlation.
That is a real limit on what Phase 2's reconstruction can say about production
records today, it is MARKED on every record exactly as the boundary blocker's
resolution requires, and threading the outcome envelope's task id into the
dispatcher envelope is Phase 3's work. Inventing one at the hook would fabricate
the boundary provenance the spine exists to record.

## Binding coverage — 8 of 40 cells, and the shape of that number

| Measure | Value |
|---|---|
| (platform, event) cells in the manifest | 40 |
| Cells resolving `journal-record` | **8** |
| Platforms bound | **claude only** |

Bound: `claude/session_start`, `session_end`, `user_prompt_submit`,
`post_tool_use`, `stop`, `pre_compact`, `subagent_start`, `subagent_stop`.

Two deliberate omissions, stated because silence about a slot is not coverage:

- **`claude/pre_tool_use` is unbound on purpose.** That slot sits on the critical
  path of every tool call, and `post_tool_use` already records the same call once
  it has happened. This is a *binding* decision; the journal's own
  `RECORDED_EVENTS` / `NOT_RECORDED` partition is untouched, because that governs
  the vocabulary rather than the bindings. A test pins the omission so a later
  "bind everything" edit is a visible change.
- **The other seven platforms are unbound.** Claude is the one platform whose
  hook delivery this tree has verified end to end. Widening is cheap and should
  follow evidence from the first opted-in session, not precede it.

## What is STILL not measurable, precisely

### (a) There is no host-emitted-event denominator anywhere in this tree

Unchanged from revision 1, re-checked at this pin. Three candidates, none of
which supplies one:

| Candidate denominator | State | Checked by |
|---|---|---|
| A recorded host-event stream under `agents/runtime/state/` | one file, `council-probes.json`. No event corpus | `ls agents/runtime/state/` |
| A dispatch-level event log written by `dispatch_hook.ts` | none. The dispatcher routes events; it counts nothing durably | `grep -rln EVENT_VOCABULARY src/scripts/` — five files, none a recorder |
| The journal's own production capture | see (b) | `grep -c journal-record src/scripts/hook_manifest.yaml` |

The same absence is on record for a sibling roadmap:
`agents/evidence/drain-run-summary.md:392` disqualifies
`experience-loop-broadening` step 1.1 with "`agents/runtime/state/` holds no
telemetry corpus. **The input does not exist.**"

**So the honest figure for "fraction of host events reaching a record" is
`undefined` — numerator unobserved, denominator unknown — not a low percentage.**
Reporting `0 %` would be a false precision that reads as a measured regression.

### (b) The concern ships default-OFF, so a default install still records nothing

This is a **new** limit introduced by this change and it is not hidden. The
sibling append-a-JSONL instruments (`orchestration-record`,
`tool-result-bytes`, `subagent-ledger`) ship ON with no setting because they
append to a gitignored directory that already exists. The journal **creates a
storage surface** — a SQLite database and a directory under `<git-common-dir>` —
in every repository it runs in. That is engine-shaped, and ADR-124 section 3's
falsifiability-first floor ("every native engine ships default-off, activates via
tripwire or explicit setting") is explicitly **not** superseded by ADR-249.

The consequence, stated plainly: production capture moves from **zero by
construction** to **zero until opted in**. That is a change in kind — the path
exists, is bound, and is exercisable by one settings line — and it is not a
production capture rate.

### (c) No host session runs against this branch

The binding takes effect on an install. Nothing in this environment runs a host
session against this worktree's manifest, so even armed, the number here would
be an artefact of a test harness rather than a session.

## What would close 1.4 properly, revised

Item 1 of revision 1's list is now **done**. What remains, in ascending cost:

1. **One real opted-in session.** Set `hooks.runtime_journal.enabled: true`,
   run a normal Claude Code session, and compare landed records against the
   host's own event count. This produces a real numerator and needs a human to
   run a session — it is not reachable from an autonomous run.
2. **Instrument `dispatch_hook.ts` with an emitted-event counter** so a
   denominator exists at all, independent of the journal. Nothing in the tree
   counts events today, which is why every capture claim in this estate has
   borrowed the 0.27 % figure rather than re-derived it. This is the change that
   would make the *comparison* to that baseline legitimate.
3. **Cross-machine capture** — out of reach for the same reason
   `later/road-to-episode-finalizer-and-outcome-attribution-v2` is parked: every
   measurable event here is machine-local. Not claimed, not attempted.

## Test sensitivity, recorded

Neutralisation observations. Every probe restored byte-identical afterwards
(`diff -q` clean).

### AC-3, `runtime_journal_concurrency.test.ts` — RE-RUN after the schema bump

The schema moved to v2 (`namespace` became `repository_id` plus `worktree_id`),
which changes the insert statement and the table shape, so the earlier
observation no longer covered the shipped code. Re-run at v2:

| Variant | Neutralisation | Observed |
|---|---|---|
| 1b | `PRAGMA busy_timeout = 5000` changed to `0`, WAL retained | **RED** — `main-checkout writer failed: database is locked`, raised at insert time; the lost-write path specifically |

Restored, green again (2 tests). The earlier revision also recorded variant 1a
(`busy_timeout` to `0` **and** WAL to `DELETE`), red inside `createSchema`;
variant 1b is the sharper of the two because it proves the test catches **lost
records**, not merely a failed open.

### AC-1, `runtime_journal.test.ts` vocabulary coverage

Neutralisation: an eleventh member, `tool_denied`, added to `EVENT_VOCABULARY`
in `src/scripts/hooks/dispatch_hook.ts`. Observed: **4 tests red**, naming the
uncovered member — `expected [ 'tool_denied' ] to deeply equal []` and
`expected 11 to be 10`. (Recorded in revision 1; the partition is unchanged by
this revision.)

### The corrected T3 row, `runtime_persistence_tiers.test.ts`

Neutralisation: the T3 row restored to its shipped text ("does not exist …
Class B is prohibited in core"). Observed: **3 tests red** — the
names-its-governing-contract pin, the does-NOT-justify-itself-on-the-superseded-
prohibition pin, and the does-not-OVERcorrect pin. Restored, 16 green.

## Two defects the concurrency test found in its own subject

Both were real durability bugs in the first implementation, found because the
test contends over one real database rather than two convenient ones. They are
the evidence behind the council's decision-1 acceptance of the shared path.

1. **PRAGMA ordering.** `journal_mode = WAL` ran before `busy_timeout` was set,
   so a second process opening the same fresh database died inside the PRAGMA.
2. **A transient lock was treated as corruption — the serious one.** The
   schema-version probe's `catch` set `drift = true` on any failure, and `drift`
   calls `discard()`, which deletes the database and its WAL sidecars. Under
   contention the losing process's probe threw `SQLITE_BUSY` and **deleted a
   healthy database containing another process's 120 committed records**, while
   both processes exited 0. `isBusyError()` now separates the two, and only a
   genuinely unreadable file is rebuilt. The separation is restated at the top of
   the module (section "Transient errors never reach the corruption path")
   because it is the cheapest defect in the file to reintroduce.

A third, milder finding: `PRAGMA journal_mode = WAL` does **not** invoke
SQLite's busy handler, so `busy_timeout` alone cannot protect the WAL
transition. `ensureWal()` carries an explicit bounded retry; every opener after
the first reads `wal` and takes no lock at all.

## Scope — what this document does not claim

- It does not claim the journal captures any host event today. It is bound, and
  it is default-OFF, and no host session has run against it.
- It does not claim 100 % dispatch-path capture predicts host capture. The
  0.27 % baseline is a *delivery* number; both numbers here are *writer* and
  *dispatch-path* numbers. Comparing them would be a category error dressed as a
  comparison, and 1.4's comparison to that baseline is therefore **not made**.
- It does not re-derive the 0.27 % baseline. That figure is cited from
  `docs/CLAIMS.md` via the drain-run summary, not measured here.
- It does not claim the boundary rule is working in production. Every observed
  record landed `session_fallback`, and the reason is a missing host field.
