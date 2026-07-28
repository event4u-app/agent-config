---
adr: 130
status: accepted
date: 2026-07-27
decision: storage-subject-axis
supersedes: —
superseded_by: —
phase: road-to-reachable-code-memory · Phase 8
type: structural
review_trigger: >-
  The tripwire honest-null is contradicted — a first-person/personal-context
  record is actually found in a tracked memory artifact (run
  `lint_memory_tripwire --history` on suspicion) — because invariant 3 was
  dropped on the zero-fires evidence and a single real fire re-founds it.
  Also reopen when a team/multi-user storage model lands: the single-user
  premise behind "one user-global store" stops holding and the subject axis
  needs a per-principal cut.
---

# ADR-130 — The `subject` axis: user-global vs project-local storage partition

## Status

Accepted (2026-07-27). Successor note to the knowledge-store ADRs (ADR-119
global sharing default-on, ADR-121 sensitivity classes) — adds the
*ownership* partition those ADRs assumed but never pinned. Does not revert
either.

## Context

The memory/knowledge layer now has two physical roots: project-local
(`agents/memory/**`, `agents/knowledge/**` — tracked, visible to every
collaborator who clones the repo) and user-global
(`~/.event4u/agent-config/…` — one developer's machine-wide store). The
tracked, public `agents/memory/*.yml` files carry the personal-context leak
surface today: nothing so far prevented a record ABOUT the user (a
preference, an identity fact, a cross-repo observation) from being written
into a tracked project artifact where every future collaborator — and every
fork — reads it. The 2026-07-27 council convergence for
`road-to-reachable-code-memory` classified this as security-tier, do-now.

## Decision

**Partition rule:**

- **Project-local holds everything derived FROM the repo** — code
  observations, incident learnings, product rules, intake signals about
  this codebase.
- **User-global holds everything ABOUT repos** (and about the user) —
  cross-repo patterns, personal preferences, identity facts.
- Records carry a `subject` axis: `subject: project` (default) is
  promotable into tracked artifacts via the existing human promotion gate;
  **`subject: user` records live global-only and may NEVER be written into
  a tracked project artifact.**
- **Read-open / write-closed asymmetry:** a session may READ both stores
  freely; WRITES are partition-checked at the write edge.
- **Arbitration test** (for humans and agents deciding a record's subject):
  *"Is this appropriate for a colleague who checks out the repo?"* — yes →
  `project`; no → `user`.

**Enforcement (deterministic, no model call):**

1. **Store-boundary lint** — no homedir/global-root literal in
   memory/knowledge index code outside the sanctioned path module(s)
   (`lint_store_boundary`).
2. **Provenance gate at the write edge** — a record whose `origin` resolves
   into the user-global store is refused entry into tracked project
   artifacts (plain path reachability check on the origin field).
3. **Hand-authored tripwire** over tracked memory files (first-person /
   preference vocabulary, DE+EN) that HALTS, never rewrites — carrying its
   own pre-registered honest-null rule: zero fires across the full git
   history → invariant 3 is dropped as unfounded and only 1–2 (structural)
   ship.

## Consequences

- CI-enforced: no `subject: user` record reaches a tracked artifact; the
  boundary is a property of the write path, not reviewer vigilance.
- The user-global store keeps its ADR-119 sharing semantics and ADR-121
  sensitivity classes unchanged; this ADR only pins WHICH store a record
  may live in.
- Legacy records without a `subject` field are `project` by default —
  additive migration, no rewrite.

## Alternatives

- **Redaction-on-write (scrub personal content instead of refusing)** —
  rejected: silent rewriting of memory records destroys provenance; the
  tripwire halts and a human decides.
- **A single merged store with per-record ACLs** — rejected: two roots
  already exist; an ACL layer adds machinery without removing the
  leak surface.

## References

- ADR-119, ADR-121 (predecessors), ADR-094 (Layer-2 sunset), ADR-129
  (substrate landing).
- `agents/roadmaps/road-to-reachable-code-memory.md` Phase 8.
- Intake source: `agents/tmp.old/consumer-index.txt` (2026-07-26).
