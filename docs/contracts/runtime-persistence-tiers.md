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
| **T2** | across sessions | one worktree | `src/scripts/_lib/test_red_state.ts` — `agents/runtime/state/test-results.json`; and its SQLite form, `src/scripts/code_graph/sqlite_store.ts` |
| **T3** | indefinite, aggregated | cross-repo | **does not exist.** Defined by its prohibition in `docs/decisions/ADR-124-embedded-engine-doctrine.md` — the aggregated store a resident process would own, and Class B is prohibited in core |

**T3's row names an existing file and no storage path, deliberately.** The file
it names is the ADR that forbids it. That is the honest entry: a tier nothing
writes into has no path to name, and inventing one here would create exactly the
surface this contract says it does not create.

### T1 and T2 differ in a way that is easy to get backwards

T2 is **worktree-local**, not repo-wide. `session_register.ts` records the
measurement (2026-08-07): concerns run with `CWD = envelope.workspace_root`, so
in a worktree `agents/runtime/state/` is that worktree's own — the main
checkout's state directory was populated while a fresh worktree's did not exist
at all. Two sessions in two worktrees share nothing there.

That is why the per-session register is at the **common git directory** rather
than under `agents/runtime/`, and it is why "T2 is more durable than T1" is true
about *lifetime* and false about *reach*. A fact that must be seen from another
worktree belongs in T1 even though T1 expires sooner.

## Promotion into T3 — supervised at every stage

Five stages. **No step promotes on a threshold alone**, and no step is automatic:

1. **observe** — the fact is recorded at its natural tier. Nothing is promoted.
2. **candidate** — a human nominates it, with the question it would answer.
3. **evidence** — a measurement showing the lower tier is insufficient *for that
   question*. ADR-124 § 5 prices this as a **measured Class-A failure**, and
   that phrase is load-bearing: an assertion that per-invocation writes are
   inadequate is not evidence, it is the hypothesis.
4. **review** — an ADR carrying the demand signal, that measurement, and an
   ADR-123 security review.
5. **promote** — only after 4, and only by the ADR.

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

- **It does not open T3.** That is ADR-124 § 5, and it needs an ADR carrying a
  named consumer demand signal, a measured Class-A failure, and a security
  review.
- **It does not create a store, a directory, or a package.** Every surface named
  above already existed.
- **It does not reopen agent memory.** ADR-094 stays closed.
- **It does not make any tier mandatory.** A hook that needs nothing beyond its
  own invocation stays at T0; naming the tiers does not oblige anyone to climb
  them.

## See also

- `docs/decisions/ADR-124-embedded-engine-doctrine.md` — the Class A / Class B
  boundary and the § 5 extension price.
- `docs/decisions/ADR-094-agent-memory-layer-removal.md` — closed, and stays so.
- `src/scripts/_lib/session_register.ts` — T1, and the measurement behind the
  T1/T2 reach distinction.
- `src/scripts/_lib/test_red_state.ts` — T2's working precedent: durable
  hook-written state with no process resident anywhere.
