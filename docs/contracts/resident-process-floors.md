# Resident-process floors — observation-only, the daemon checklist, and the fail-closed ladder

> Owner: maintainer · Status: active · Landed by `road-to-runtime-context-floors`
> Phase 2 · Machine-readable half: `src/scripts/_lib/delivery_criticality.ts`,
> `src/scripts/schemas/delivery-manifest.schema.json`

## Why this exists before the process it bounds

ADR-249 reversed ADR-124's Class-B prohibition and permits a **supervised**
resident process. `road-to-supervised-telemetry-collector` is the first one.
Neither record carries a runtime floor: nothing said what a resident module may
influence, what its design note must answer, or what happens to an obligation
whose delivery carrier is not running.

A floor written after the process it bounds is a description of that process,
not a floor. This document is written first, deliberately, and the collector
roadmap cites it as a precondition rather than restating it.

## 1. The observation-only contract

> **A resident or long-lived module in this suite reads static, versioned
> configuration on the dispatch path and nothing else. It may not consult its own
> accumulated state, a learned model, or a live counter to decide what the
> dispatch path does.**

Anything it concludes lands as an **artefact** — a report, a candidate, a
finding — consumed at a release or restart boundary, never inside the dispatch it
observed.

The boundary in one falsifiable sentence, which is the form a reviewer can check
a design against:

> **If the module were killed, every dispatch would resolve identically.**

That is the whole test. A module whose absence changes a routing decision, a
threshold, an injected payload, or an exit code is not observing — it is
deciding, and it is outside this contract whatever its author calls it.

### What the contract forbids, concretely

| Forbidden | Why |
|---|---|
| Reading its own counters to pick a threshold | the threshold becomes a function of history nobody reviewed |
| A learned or fitted model on the dispatch path | the decision is unreproducible from the tree |
| Feeding an observation back into the same dispatch | the observer changes what it measures |
| Holding in-memory state that changes a later dispatch's outcome | ADR-124 § 4's termination clause, restated for the permitted case |

### What it permits

Reading versioned config; recording what happened; writing an artefact a human
or a later release consumes; refusing to run. **Refusing is always permitted** —
a module that cannot serve must degrade the dispatch to the no-module path, and
degrading is not influence.

## 2. The daemon anti-pattern checklist

Five questions. **Every resident-process design note answers all five, or names
which are open and why.** An unanswered question is not a warning — the note is
unreviewable, and a reviewer should decline it rather than approve around it.

1. **What is the failure mode when it is not running?** Not "it restarts" — what
   the *system* does in the window where it is absent.
2. **What does it do to a dispatch it cannot serve?** The answer must be a
   degradation, never a block, or the observation-only contract above is
   already broken.
3. **What is its state on an unclean stop?** `SIGKILL`, a full disk, a laptop
   lid. Whether the state is recoverable, and by what.
4. **Who supervises it, and with what privileges?** A named supervisor, and the
   smallest privilege it needs. "The user starts it" is an answer; "it starts
   itself" needs one.
5. **What is the uniqueness namespace when two checkouts of the same repository
   run at once?** Worktrees make this the common case here, not the exotic one.

## 3. The fail-closed delivery ladder

An obligation moved out of the always-loaded prefix onto a runtime carrier is
cheaper and can be *missing*. This ladder states what happens when the carrier
is unavailable, and it is deliberately three-valued rather than a boolean.

| Class | May migrate off standing context? | Carrier unavailable ⇒ |
|---|---|---|
| `critical-A` | **No.** Stays standing, always. | not applicable — it was never migrated |
| `critical-B` | Yes | **delivered eagerly**, never silently dropped |
| `standard` | Yes | may fail open |

`critical-A` is for an obligation whose *absence* is unrecoverable — a safety
floor, a Hard-Floor gate, a refusal condition. `critical-B` is for one whose
absence is recoverable but costly: it may travel on a carrier, and when the
carrier is not there it arrives the expensive way rather than not at all.

**The default is `critical-B`, not `standard`.** An obligation whose class
nobody declared is one nobody classified, and the cheap reading of an
unclassified obligation must not be "droppable". This is the same fail-closed
choice the prefix-stable gate makes for an undecidable write, and for the same
reason: ambiguity must not become an accidental exemption.

Machine-readable: `src/scripts/schemas/delivery-manifest.schema.json` requires
`criticality` on every entry; `src/scripts/_lib/delivery_criticality.ts`
implements the resolver and is the single place the ladder is encoded.

## What these floors do NOT claim

- **They do not authorise a resident process.** ADR-249 does that, under its own
  four conditions. This document bounds one once authorised.
- **They are not enforced against a process that does not exist.** The checklist
  is checked by a reviewer reading a design note; the ladder is checked by the
  schema and the resolver. Neither can observe a running process, and no gate
  here claims to.
- **They do not cover the authoring-time prefix guarantee** —
  [`prefix-stable-surfaces.md`](prefix-stable-surfaces.md) is the sibling floor
  for that, and the two are deliberately separate documents because one is
  checkable by a gate and the other is checkable by a reviewer.
