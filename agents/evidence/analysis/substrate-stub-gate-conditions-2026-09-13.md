<!-- evidence-type: analysis -->
# The substrate stub's gate: what ADR-249 requires, and what the tree shows

**Measured 2026-09-13** on `drain/substrate-stub`, based on `origin/main`, discharging
Phase 1.1 of `road-to-the-substrate-stub-meeting-its-open-gate`.

`agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md` holds eight tracks behind
one sentence: *"Every track below is unbuildable until that roadmap's Phase 1 ADR exists,
because each one is a Class-B resident process under `ADR-124:111` as it currently stands."*

This artefact answers two separable questions the stub's sentence collapses into one:

1. **Does the named ADR exist?** A fact, decidable from the tree. Answered below in one row.
2. **Are the record's four governance conditions satisfied?** Per condition, what the
   condition requires and what the tree currently shows. The *ruling* — declaring a
   condition met for a given track — is reserved to the maintainer by
   `the-governance-conditions-are-a-supervision-read`, and this artefact does not make it.

Every row states `met`, `unmet`, or `unverifiable from tree evidence`, with a named file.
No row states a probability.

## 0 — The factual half: the named record exists

| Claim in the stub | State | Evidence |
|---|---|---|
| "that roadmap's Phase 1 ADR" does not exist | **false as of 2026-08-27** | `docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md` — `status: accepted`, `date: 2026-08-27`, frontmatter `phase: road-to-runtime-governance-flip · Phase 1` |
| the gating roadmap is still open | **false** | `agents/roadmaps/archive/road-to-runtime-governance-flip.md` — archived, `status: ready` |
| every track is Class B under `ADR-124:111` "as it currently stands" | **false** | ADR-249 `supersedes_scope` names `ADR-124:111` and `ADR-109:28` and nothing wider; the Class-B blanket prohibition is the provision it replaced |
| the record is a live, unqualified lock | **no — live, trigger indeterminate** | `./scripts-run src/scripts/adr_cite_check ADR-249` → `LIVE, TRIGGER INDETERMINATE`, `reopen_policy: owner (declared)`, 5 evidence refs, 0 unresolved |

**The gate as the stub words it has been open since the day the stub was written.** The stub
is dated 2026-08-27 in its own source header; ADR-249 is dated 2026-08-27. The condition was
satisfied on arrival, and nothing in the tree recorded it.

## 1 — The four governance conditions

Source of the conditions, read at this revision: ADR-249 § Governance conditions, restated
as a class table in `docs/contracts/resident-process-governance.md` § The four governance
conditions. A process satisfying all four is **P1 — permitted**; failing any one makes it
**P2 — prohibited**.

**The conditions are predicates on a process, not on a subject area.** That is the single
most load-bearing fact in this table, and it is why the right-hand column has two halves.
None of the stub's eight tracks has a process, so for the tracks every condition is
`unverifiable from tree evidence` — there is no subject to evaluate. What *is* decidable is
whether this tree can satisfy the conditions at all, and it is: one P1 process has already
shipped under this record, and it is the worked example each row cites.

| # | Condition (ADR-249 § Governance conditions) | State for the shipped P1 process | State for any of the eight tracks | Evidence |
|---|---|---|---|---|
| 1 | **Supervised** — a named supervisor, a documented start and stop path, does not outlive that supervisor | **met** | **unverifiable from tree evidence** — no track has a process to supervise | `docs/contracts/collector-operations.md` § Which platforms are supervised names the supervisor per platform (macOS: per-user `launchd`; Linux with a user session bus: `systemd --user`) and marks the other two rows `static fallback` rather than claiming them |
| 2 | **Scoped writes** — declares what it writes **before** it runs, writes nothing else; the P3 state-store test applies | **met in code, and the form of the declaration is the reserved question** | **unverifiable from tree evidence** | `src/scripts/_lib/collector_store.ts:187` `resolveCollectorStore()` — "Resolve every path the store uses. Pure: creates nothing." Six paths, one root under `~/.event4u/agent-config/`. The write surface is enumerated in one place ahead of any write; whether a code-level enumeration is the "declaration" ADR-249 means is a supervision reading, not a measurement |
| 3 | **Stoppable** — a documented mechanism stops it, and stopping degrades a capability rather than corrupting state | **met** | **unverifiable from tree evidence** | `docs/contracts/collector-operations.md` § Stop it now — `collector_daemon stop` latches a `STOP` marker *first* so a supervisor cannot restart it, then `SIGTERM`, then `SIGKILL` after a grace period. Exercised: `./scripts-run src/scripts/run_lifecycle_suite` → `7 run, 0 skipped, suite_exit=0, processes_exercised=true` |
| 4 | **Claim-consistent** — may not execute from a revision that still publishes a runtime-absence claim on a maintained public surface | **documentation half met; the process half is unmet as a mechanism** | **unmet as a mechanism, for every track equally** | Documentation half: `./scripts-run src/scripts/check_supervision_claim_atomicity` → `scanned=8 planned=8 skipped=0`, green; `docs/CLAIMS.md:209` `claim:no-runtime-daemon` carries `status: withdrawn` since 2026-08-27. Process half: `docs/contracts/resident-process-governance.md` states in its own text that "the same-revision activation guard belongs to whichever change first ships a P1 process, and **does not exist yet**" |

### Condition 4 is the one that is not track-specific

Rows 1 to 3 are questions about a process nobody has built for any of the eight tracks. Row 4
is different: its documentation half is a property of the **revision**, already true and
already gated, and its process half is a missing mechanism that would be missing for any
track equally. A per-track ruling on condition 4 therefore has nothing per-track to rule on —
it is one answer for all eight, and it is the same answer the shipped collector got.

ADR-249 states why the documentation half is not sufficient on its own: an AI council on
2026-08-27 found the ordering rule "necessary but not sufficient", because removing a public
claim does not stop an **older** revision from activating a process.

## 2 — What this artefact does not do

It does not rule. `the-governance-conditions-are-a-supervision-read` reserves "declaring a
governance-shaped condition met for a resident process" to the maintainer, and permits
exactly what is above: enumerating what the conditions say and what the tree shows.

Two readings are available to whoever rules, and they differ in outcome:

- **Read the gate as the stub words it** — "the Phase 1 ADR exists". It does, since
  2026-08-27. The gate is open and the eight tracks lose their common blocker.
- **Read the gate as what the ADR permits** — "a P1 process is permitted once all four
  conditions hold *for that process*". Then no track's gate can be open yet, because no
  track has a process; the gate becomes per-track and opens when a track proposes one.

These are not in conflict, and both are recorded rather than one being chosen: the first is
about the **record's existence**, the second about the **record's application**. The stub's
sentence asserts the first, and the first is false.

## 3 — Phase 1.3's branch, evaluated

Phase 1.3 of the driving roadmap says an *unmet* verdict closes the roadmap cleanly: the stub
would have been right and the finding would be that nobody could tell.

**That branch was evaluated and not taken.** The verdict on the stub's own stated condition
is `open` — § 0's first row is a decidable fact and it is false. The stub was not right; it
was written against a condition that had already been satisfied, and three subsequent rounds
re-derived the architecture rather than reading it.

Recording the branch rather than deleting the step: the alternative outcome was real when the
step was authored, and a reader who checks only the checkbox should be able to see which way
it resolved and on what.

## Reproduction

```
./scripts-run src/scripts/adr_cite_check ADR-249
./scripts-run src/scripts/check_supervision_claim_atomicity
./scripts-run src/scripts/run_lifecycle_suite
sed -n '118,128p' docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md
sed -n '88,100p'  docs/contracts/resident-process-governance.md
sed -n '124,138p' docs/contracts/collector-operations.md
```
