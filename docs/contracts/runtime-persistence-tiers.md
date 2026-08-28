# Runtime persistence tiers — T0 to T3

Four tiers for runtime state, **named over surfaces that already exist**. This
contract creates no store, no directory, and no package: every tier below points
at code that shipped before this file did, and the only thing that is new is the
vocabulary for talking about them.

That constraint is the point, not modesty. Runtime state in this suite has
accumulated one surface at a time — a hook's local variable, a per-session
register, a durable JSON record, a SQLite twin — each correct in isolation and
none of them related to the others by anything a reader could name. A tier is a
name for *how long a fact survives and who can see it*, and that question was
previously answered per-file.

## The Iron Law

```
A TIER IS NAMED OVER A SURFACE THAT EXISTS. THIS CONTRACT CREATES NONE.
T3 IS NOT WRITTEN BY ANY CODE IN THIS REPOSITORY, AND OPENING IT IS AN ADR,
NEVER A COMMIT. PROMOTION INTO T3 IS SUPERVISED AT EVERY STAGE — NO STEP
PROMOTES ON A THRESHOLD ALONE.
NO CLAIM REQUIRING TRANSITIVE CERTAINTY IS MADE ON A STALE OR ABSENT RECORD.
DEGRADATION IS REPORTED, NEVER SILENT.
```

## The four tiers

| Tier | Lifetime | Visibility | Existing surface |
|---|---|---|---|
| **T0** | one hook invocation | that process only | `src/scripts/hooks/dispatch_hook.ts` — per-invocation state inside a dispatch that starts, decides, and exits |
| **T1** | one session | every worktree of the repo | `src/scripts/_lib/session_register.ts` — `<git-common-dir>/agent-sessions/<session_id>.json`, one file per session, one writer each |
| **T2** | across sessions | **depends on the path — see below** | `src/scripts/_lib/test_red_state.ts` — `agents/runtime/state/test-results.json` (worktree-local); its SQLite form, `src/scripts/code_graph/sqlite_store.ts`; and `src/scripts/_lib/runtime_journal.ts` — `<git-common-dir>/agent-journal/journal.sqlite` (repo-wide) |
| **T3** | indefinite, aggregated | cross-repo | **not built, and prohibited as a STORE.** `docs/contracts/resident-process-governance.md` — its **P3** row (cross-session persistent state store) is "PROHIBITED, unchanged". A **supervised** resident process is now permitted (P1, `docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md`); the aggregated store it would own is not |

**T3's row names existing files and no storage path, deliberately.** The files
it names are the governance contract and the ADR that decide it. That is the
honest entry: a tier nothing writes into has no path to name, and inventing one
here would create exactly the surface this contract says it does not create.

### Corrected 2026-08-28 — this row cited a superseded lock

The row shipped saying T3 "does not exist", "defined by its prohibition in
ADR-124", "Class B is prohibited in core". **That was already false when it
shipped**, and the correction is recorded here rather than applied silently
because the wrong text is in the branch history.

[`ADR-249`](../decisions/ADR-249-supervised-resident-process-permitted-under-governance.md)
— **accepted 2026-08-27**, `supersedes: ADR-124, ADR-109` — supersedes exactly
ADR-124 § 4's Class-B row (`:111`, "Resident service / daemon … PROHIBITED in
core") and ADR-109's `no daemon` clause (`:28`), and **nothing wider**. A
supervised resident process is *permitted under governance*.

The correction is narrow in **both** directions, and the second half matters as
much as the first:

- **What was wrong.** Citing a blanket Class-B prohibition as the reason T3 is
  closed. That reason no longer exists.
- **What is still right, on a different anchor.** T3 is a **store** tier, not a
  process tier, and the store is still prohibited — by the **P3** row of
  [`resident-process-governance`](resident-process-governance.md) ("any store
  persisting beyond the git working tree … PROHIBITED, unchanged") and by
  ADR-249 § Not reopened, which states in its own words that the 2026-06-14
  agent-memory / Layer-2 sunset is not reopened and that `ADR-100:137` records
  it as "reconciled, not reversed". **P1 does not weaken P3**: a supervised
  process may write only what it declared, and declaring a vector index does not
  make it one.
- **What is unaffected.** `supersedes_scope` is explicit that ADR-124's Class-A
  adoption path (`:110`), its Class-C network/LLM build-path prohibition, and
  its § 6 state-store test all remain authoritative — and § 6 is precisely the
  test T2's members pass and a T3 store would fail: *if deleting the artifact
  changes what the tool can answer rather than only how fast, it is a state
  store*. ADR-109's subagent contract is otherwise untouched.

So the tier did not move. Its citation did.

### T2's REACH is a property of the path, not of the tier

**Amended 2026-08-28.** This section used to say "T2 is worktree-local" flatly.
That is true of one member and false of another, and stating it as a tier
property made the contract disagree with a T2 surface that shipped under it.

A tier fixes **lifetime** and **visibility is decided by where the file lives**:

| T2 member | Path | Reach |
|---|---|---|
| `test_red_state.ts` | `agents/runtime/state/test-results.json` | **worktree-local** |
| `code_graph/sqlite_store.ts` | under the same runtime dir | **worktree-local** |
| `runtime_journal.ts` | `<git-common-dir>/agent-journal/journal.sqlite` | **repo-wide** |

The worktree-local half is measured, not assumed: `session_register.ts` records
(2026-08-07) that concerns run with `CWD = envelope.workspace_root`, so in a
linked worktree `agents/runtime/state/` is that worktree's own — the main
checkout's state directory was populated while a fresh worktree's did not exist
at all. Two sessions in two worktrees share nothing there.

**The journal is deliberately the other way round, and the reason is
falsifiability rather than taste.** Its acceptance criterion is "two concurrent
writers **from two worktrees of one repository** both land". At a worktree-local
path the two writers land in two different files, so the criterion is true by
construction and its test can never go red — an unfalsifiable AC. Put at the
common git dir the two writers contend for one database, and that contention
immediately found three real durability bugs, one of which deleted a healthy
database holding another process's committed records. An AI council (2026-08-28,
2/2) accepted the path on those grounds and directed that this contract and the
roadmap's step 1.1 be amended to state it, so the built path and the specified
path agree.

So "T2 is more durable than T1" is true about *lifetime* and says nothing about
*reach*. A fact that must be seen from another worktree belongs either in T1 or
in a T2 member that lives at the common git dir — and which one a T2 member is
must be read off its path, never off its tier.

### Deletion — what happens to a T2 store when its tree goes away

Stated because a storage contract silent about deletion has a hole, and because
part of the honest answer is "nothing".

| Event | Worktree-local T2 | The journal (repo-wide T2) |
|---|---|---|
| A **linked worktree** is deleted or pruned | its store goes with the directory | **nothing happens.** Records stay in the shared store carrying a `worktree_id` that no longer resolves. They are not orphaned in any way a reader trips over — `repository_id` still identifies the repository and episodes still join — and they expire on the ordinary 30-day TTL anchored at episode close |
| The **main repository** is deleted | goes with the tree | goes with the tree: the store lives inside `.git/`, so `rm -rf <repo>` removes `journal.sqlite` and its WAL sidecars in the same operation |
| Neither exists (no git repository) | n/a | the documented fallback path is under the root and disappears with it |

**There is no worktree-liveness reaper, deliberately.** `session_register.ts`
reaps session records because a stale session record makes a *live-session
claim* that has gone false. A journal event claims only that an event occurred,
and a checkout being removed afterwards does not make the run un-happen. TTL is
the whole cleanup story, and nothing outside the repository is ever written.

## Promotion into T3 — supervised at every stage

Five stages. **No step promotes on a threshold alone**, and no step is automatic:

1. **observe** — the fact is recorded at its natural tier. Nothing is promoted.
2. **candidate** — a human nominates it, with the question it would answer.
3. **evidence** — a measurement showing the lower tier is insufficient *for that
   question*. ADR-124 § 5 prices this as a **measured Class-A failure**, and
   that phrase is load-bearing: an assertion that per-invocation writes are
   inadequate is not evidence, it is the hypothesis.
4. **review** — an ADR carrying the demand signal, that measurement, and an
   ADR-123 security review, **plus a decision that reopens P3**.
5. **promote** — only after 4, and only by the ADR.

**Stage 4 was re-priced 2026-08-28, and the change is an addition rather than a
relaxation.** The old text sourced the whole price from ADR-124 § 5 alone.
Re-read at ADR-249's base: § 5 is **not** in ADR-249's `supersedes_scope`, so it
stands as written — but the escalation it prices (*opening Class B*) has already
been performed for the supervised case, so it no longer decides T3 on its own.
Two things now apply on top:

- **A T3 store still needs P3 reopened**, and ADR-249 explicitly declines to do
  it: § Not reopened states that the agent-memory / Layer-2 sunset stands and
  lists nine further lines across ADR-098, ADR-099, ADR-100 and ADR-138 carrying
  the same prohibition, **none** of them superseded. This is the binding gate,
  and it is a higher bar than the one this contract used to name.
- **If a resident process owns the store**, it must additionally satisfy
  ADR-249's four governance conditions — supervised, scoped writes, stoppable,
  claim-consistent — and P2 (an unsupervised background process) stays
  prohibited. ADR-124 § 6's state-store test applies to whatever it declares.

Nothing about the five stages themselves changed: **no step promotes on a
threshold alone**, and no step is automatic.

**ADR-094 stays closed and is untouched by this contract.** The agent-memory
layer was removed and remains removed. A durable, episode-keyed event record is
not a memory layer: it records what the runtime *did*, it is never read back as
context for a decision, and no promotion stage above admits one. If a future
proposal blurs that line, it reopens ADR-094 on ADR-094's terms and not on this
file's.

**No code in this repository writes into a T3 path**, because there is no T3
path. That is checkable from any diff claiming to implement this contract.

## Health and degradation

The tiers reuse the three-state freshness verdict this suite already ships
(`src/scripts/code_graph/detect.ts` — `ABSENT | STALE | FRESH`) rather than
inventing a parallel vocabulary.

| State | Meaning | What a consumer may conclude |
|---|---|---|
| `FRESH` | the record exists and is current | the answer it gives, scoped to what it records |
| `STALE` | exists, behind the tree | a **degraded** verdict that names the staleness |
| `ABSENT` | no usable record | `unavailable` — never an empty success |

```
AN ABSENT RECORD AND A RECORD CONTAINING NO MATCH ARE NOT THE SAME ANSWER.
A CONSUMER THAT CANNOT TELL THEM APART IS REPORTING A CONFIDENT EMPTY RESULT,
WHICH IS THE ONE FAILURE THIS SECTION EXISTS TO PREVENT.
```

This is the binding line the runtime-event-journal roadmap states as its single
constraint on *use*: **no claim requiring transitive certainty is made on a
stale or absent record.** "Nothing calls this function" is such a claim; "the
journal has no record of a call" is not the same statement, and only the second
is supportable from a record whose freshness is unknown.

## What this contract does NOT do

- **It does not open T3.** Opening it needs an ADR that reopens the **P3**
  prohibition in [`resident-process-governance`](resident-process-governance.md)
  — which ADR-249 § Not reopened explicitly declines to do — carrying a named
  consumer demand signal, a measured Class-A failure, and an ADR-123 security
  review, and satisfying ADR-249's four governance conditions if a resident
  process owns the store. (This bullet said "that is ADR-124 § 5" until
  2026-08-28; see § Corrected 2026-08-28 above.)
- **It does not create a store, a directory, or a package.** Every surface named
  above already existed.
- **It does not reopen agent memory.** ADR-094 stays closed.
- **It does not make any tier mandatory.** A hook that needs nothing beyond its
  own invocation stays at T0; naming the tiers does not oblige anyone to climb
  them.

## See also

- `docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md`
  — the scoped supersession that made a supervised resident process permitted,
  and the four governance conditions it is permitted under.
- `docs/contracts/resident-process-governance.md` — the P0-P4 process classes
  implementing ADR-249; **P3** is the row that keeps T3 closed.
- `docs/decisions/ADR-124-embedded-engine-doctrine.md` — the Class A / Class C
  boundary, the § 5 extension price, and the § 6 state-store test. Its Class-B
  row is superseded by ADR-249; the rest stands.
- `docs/decisions/ADR-094-agent-memory-layer-removal.md` — closed, and stays so.
- `src/scripts/_lib/session_register.ts` — T1, and the measurement behind the
  T1/T2 reach distinction.
- `src/scripts/_lib/test_red_state.ts` — T2's working precedent: durable
  hook-written state with no process resident anywhere.
- `src/scripts/_lib/runtime_journal.ts` — the repo-wide T2 member, and the
  reason T2's reach is stated per path rather than per tier.
