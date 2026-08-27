---
complexity: structural
review_by: 2026-12-27
---

# Road to a runtime orchestration substrate — stub

> **Source:** `agents/tmp.old/uncle-bob-swarm/` — landed by `/analyze:inbox` on
> 2026-08-27. Drafted against `f2ed85e`, which **is** `origin/main` at
> authoring time, so nothing here is stale-by-window.

> **Class:** decision-gated successor of
> `road-to-runtime-governance-flip.md`. Every track below is unbuildable
> until that roadmap's Phase 1 ADR exists, because each one is a Class-B
> resident process under `ADR-124:111` as it currently stands. This is a
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

| Track | Gate that must open first | Source section |
|---|---|---|
| One authoritative control store (SQLite/WAL for runs, tasks, leases, events) | governance-flip Phase 1; then a second question — whether a transactional store is a "state store" under the successor contract's own class table | § 3.2 |
| Supervisor + reconciler over worker processes | governance-flip Phase 5.2 must first establish what "supervised" is proven to mean | § 3.1, § 3.4 |
| Workspace lease manager | needs the store above; this repo already has worktree tooling that a lease manager would either use or duplicate | § 5 |
| Handoff as a durable task transition | needs the store; explicitly **not** a second authoritative handoff model (source kill K14) | § 6 |
| Risk-routed concern DAG | needs the specification layer's routing decision to exist first, or the DAG has nothing to route on | § 7 |
| Resident code intelligence (symbol/reference/dependency graph kept warm) | this repo already has a code-graph engine under ADR-124 Class A; the delta is residency, which is exactly the Class-B question | § 10 |
| Confidence ladder C0–C5 and independence classes | needs the assurance registry to carry evidence-backed states rather than `unknown`, i.e. specification-layer Phase 3.3 | § 13, § 14 |
| Evidence graph, replay, multi-repo pilot | last, and only if the earlier tracks produced something worth replaying | § 12, § 17, Phase 20 |

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
