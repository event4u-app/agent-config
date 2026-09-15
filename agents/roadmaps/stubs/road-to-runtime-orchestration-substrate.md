---
complexity: structural
review_by: 2026-12-27
reviewed_at: 2026-09-13
blocker_class: product
blocker_opened: 2026-08-27
---

# Road to a runtime orchestration substrate — stub

> **Arrivals:** 11 (at least) - latest `inbox-2026-09-aa` (2026-09-12), a round of
> fourteen independent external reviews of which two reach this subject: one names a
> shared runtime-state substrate as P0.2 over five named state owners (review baseline,
> refusal state, continuity, session index, code-graph), the other reads this stub
> directly and recommends option 3 - promote a named track - rather than a new roadmap.
> Neither supplies a measurement any track is gated on, so the posed question below is
> unchanged. Counted as
> distinct prior round directories under the consumed-inbox tree, which is gitignored -
> so the count is machine-local and the ordering is the finding, not the exact figure.
> Read `(at least)` strictly: a broad keyword sweep returns a larger set that includes
> incidental mentions, so this is the subject-matched floor.

> **The posed owner question — 11 arrivals, no recommended answer.** None of the eight
> tracks below has been adopted. **Re-cut 2026-09-13:** the common gate this block used
> to cite — "Phase 1's ADR, which does not exist" — closed on 2026-08-27 when ADR-249
> was accepted, so option 2 below is answered and is struck rather than deleted. What
> remains gating each track is now named per row. Exactly one of:
>
> 1. Keep the stub as it is — tracks findable, per-track gates named; the first track
>    whose gate opens and carries a measurement becomes a roadmap then.
> 2. ~~Route the gate rather than wait on it: put the Class-B resident-process question
>    to a decision now, since every track depends on that one answer.~~ **Answered
>    2026-08-27 by ADR-249.** Kept struck so a reader of an older citation finds where
>    it went; it is no longer one of the choices.
> 3. Promote one named track on its own terms and leave the rest stubbed, accepting
>    that its own per-track gate is still shut.
> 4. Close the stub and record the tracks as not adopted, which is the reading
>    § What this stub does NOT claim leaves open in both directions.
>
> The count sets the venue, not the verdict: eleven arrivals say the source set keeps
> returning, not that any track should be built.

> **Source:** `agents/tmp.old/inbox-2026-08-h/` — landed by `/analyze:inbox` on
> 2026-08-27. Drafted against `f2ed85e`, which **is** `origin/main` at
> authoring time, so nothing here is stale-by-window.

> **Gate: OPEN since 2026-08-27. Checked 2026-09-13 against
> `docs/decisions/ADR-249-supervised-resident-process-permitted-under-governance.md`.**
>
> This stub was written on 2026-08-27 saying every track below is unbuildable until
> `road-to-runtime-governance-flip.md` Phase 1's ADR exists. **That ADR was accepted on
> 2026-08-27** — the same day — and the roadmap that produced it is in
> `agents/roadmaps/archive/`. ADR-249 scopes its supersession to `ADR-124:111` and
> `ADR-109:28`, which is exactly the Class-B blanket prohibition the original sentence
> rested on. A supervised resident process is now **permitted in core**, and one has
> shipped under the record.
>
> **What is still shut, and it is not the same gate.** ADR-249 permits a P1 process only
> when all four of its governance conditions hold *for that process*. None of the eight
> tracks below has a process, so none of them can satisfy or fail those conditions today:
> the common gate is retired and replaced by a **per-track** condition, named in each row.
> Declaring a governance condition met for a resident process is a supervision judgement
> reserved to the owner — see § Blockers.
>
> The condition-by-condition read, with a state per condition and a file per state, is
> `agents/evidence/analysis/substrate-stub-gate-conditions-2026-09-13.md`.
>
> **Class:** decision-gated successor of `road-to-runtime-governance-flip.md`. This is a
> stub rather than seven roadmaps on purpose — see § Why one stub.

## What the source set wanted, and what it costs

The source produced a 21-phase consolidated master
(`road-to-runtime-native-evidence-operating-system-final.md`, 1,952 lines)
plus four generations of predecessor. Its own Loop 2 named the problem: the
combined phase count across the three tracks exceeds thirty for a solo
maintainer. The two increments with a measurement behind them were split out
as `road-to-runtime-governance-flip.md` and
`road-to-executable-specification-layer.md`. What remains is listed here so
it is findable, not planned.

**Provenance warning, and it is load-bearing — discharged 2026-09-13.** The table used to
carry a "Source section" column of § numbers pointing into `agents/tmp.old/`, a **disposable**
inbox archive: gitignored, absent from every clone, and deletable by the operator at any
moment. That column was a pointer that dereferenced into nothing for anyone but its author,
and it has been **removed** rather than carried as a decorative historical note. Each row
below now states its own subject and its own gate in full, which is what the original note
said the rows were written to do. Whoever wants the source master re-obtains it; nothing in
this table depends on that happening.

**Disposition vocabulary.** Exactly one per row: **promoted** (a roadmap exists), **gated**
(with the specific condition named, checkable without re-reading this file), or **killed**
(with a reason). No row is prose. Re-cut 2026-09-13 against the open gate — the previous
common gate, "governance-flip Phase 1's ADR", is retired for all eight because that ADR
landed on 2026-08-27.

| Track | Disposition | The gate that is actually shut, named |
|---|---|---|
| **One authoritative control store** — SQLite/WAL holding runs, tasks, leases and events across invocations | **gated** | **ADR-124 § 6 state-store test**, which ADR-249 § Not reopened leaves standing: if deleting the artifact changes *what* the tool can answer rather than only *how fast*, it is a P3 cross-session state store and prohibited. Runs, tasks and leases are answers that would not survive deletion. Opens if and only if a design passes that test on its own terms, or a separate record reopens P3 |
| **Supervisor + reconciler over worker processes** | **gated** | **A second resident process exists to supervise.** The supervision pattern itself is no longer the question — `docs/contracts/collector-operations.md` names a supervisor per platform and `./scripts-run src/scripts/run_lifecycle_suite` exercises start/stop against real processes. One P1 process needs no reconciler. Opens when a second one ships |
| **Workspace lease manager** — arbitrating concurrent claims on a worktree | **gated** | **The existing worktree tooling is measured insufficient.** `src/skills/worktree-lifecycle` and the roadmap-claim mechanism already arbitrate claims; a lease manager would use or duplicate them. Opens on a recorded contention failure that the current tooling did not prevent — not on a preference for the shape |
| **Handoff as a durable task transition** — a handoff that survives process death | **gated** | **The control store above.** Inherits that row's P3 gate in full and cannot open before it. Independently constrained: the source's own kill register (K14) forbids a *second* authoritative handoff model, so this may only ever replace `/agent-handoff`, never sit beside it |
| **Risk-routed concern DAG** — routing review concerns by measured risk rather than fixed order | **gated** | **A risk signal exists to route on.** The specification layer's routing decision landed (`agents/roadmaps/archive/road-to-executable-specification-layer.md` Phase 1, discharged) and it routes on whether a change owes a behaviour contract — not on risk. No measured per-change risk score exists in this tree. Opens when one does |
| **Resident code intelligence** — symbol/reference/dependency graph kept warm across commands | **gated** | **A measurement that residency beats the shipped per-command engine.** The engine exists and is ADR-124 Class A; the delta is residency alone, and ADR-249 now permits it under four conditions. Opens on a measured latency or capability delta plus a per-track ruling on those conditions — this is the track whose gate ADR-249 moved furthest |
| **Confidence ladder C0–C5 and independence classes** | **gated** | **A precondition whose owner is gone.** It needs the assurance registry to carry evidence-backed states instead of `unknown`; that was specification-layer Phase 3.3, which is `[-]` **cancelled** in the archived roadmap. No active roadmap owns the registry's states. Opens only if something re-adopts that work — the narrowest gate of the eight, and the strongest candidate for a *killed* ruling |
| **Evidence graph, replay, multi-repo pilot** | **gated** | **Something worth replaying exists.** Last by construction: it consumes the artefacts the earlier seven tracks would produce, and none of them has produced any. Opens after at least one other row is promoted and has shipped |

**None promoted, 2026-09-15.** All eight rows above read `gated` on their own named,
individually-measured condition — no row's gate was open at the time of this reading, so
there was nothing to choose between. Recorded per
`road-to-the-substrate-stub-meeting-its-open-gate.md` step 5.1, whose blocker
(`which-track-promotes-is-owner-reserved`) the owner resolved as "promote none this round".
The table itself, not this line, is what would change first if that verdict were to move.

## Why one stub

Seven roadmaps for eight gated tracks is seven files against an estate whose
one-in-one-out lint is unconditional, and none of them can start. The source's
own kill register (K3: "one daemon per feature") argues the same point from the
architecture side. A stub keeps the tracks findable and their gates named; the
first one to have its gate opened *and* a measurement behind it becomes a
roadmap then.

## Adopted from the source without needing a phase

Three items are prose, cost nothing, and are worth carrying into whichever
roadmap next touches their surface — recorded here so they are not lost with
the stub:

- **Independence is a class, not a label.** A different agent name is not an
  independent review. The gradation the source proposes (same-context,
  fresh-context, cross-model, black-box, human) is a refinement of this repo's
  existing evaluator-independence rule, not a replacement for it.
- **Negative ownership in role definitions.** Stating what a role does *not*
  own is cheaper than stating what it does, and catches the overlap case.
- **FAIL is not ERROR.** A gate that could not run is not a gate that ran and
  said no. This distinction is load-bearing wherever gate results are
  aggregated.

## What this stub does NOT claim

That any of the above should be built. The source set is a proposal, its
authority for the runtime *decision* is the owner transcript, and its authority
for everything else is its own reasoning — which this repository has not
verified beyond the two increments that were split out. Nothing here is
adopted.

## Blockers

### blocker: per-track-governance-ruling-unmade
- **Status:** open
- **Owner:** maintainer
- **Class:** 3 — human-only
- **Blocks:** promotion of any track in the table above. It does **not** block reading the
  stub, counting its arrivals, or the per-track gates being named — all of which are done.
- **What to do:** for a track you are considering, rule whether ADR-249's four governance
  conditions are met for the process that track would create. The reading is already done:
  `agents/evidence/analysis/substrate-stub-gate-conditions-2026-09-13.md` carries a state and
  a file per condition, and `./scripts-run src/scripts/adr_cite_check ADR-249` reports the
  record's effective state. Then pick one of the four options in the posed-question block
  above, or rule a single row **killed** — the Confidence-ladder row is the one whose gate is
  shut by a cancelled precondition rather than by an open question. Before promoting anything,
  `./scripts-run src/scripts/check_estate_count` shows the floor a new roadmap is measured
  against.
- **Recommendation:** rule nothing yet and keep the stub. The expensive half was the reading,
  it is now done and cited, and every row states a condition a later reader can check in one
  command. Promotion is a separate decision that is cheaper once a row's named gate actually
  opens — and today none has.
- **If you do nothing:** the stub stays readable, parseable and counted, and the next arrival
  of this subject meets eight named per-track conditions instead of one sentence that had
  already stopped being true. That is strictly better than the state this blocker was written
  in and loses nothing.
- **Resolved when:** one track carries a **promoted** or **killed** disposition in the table
  above with its ruling recorded, or the stub records that the whole set stays gated and why.
