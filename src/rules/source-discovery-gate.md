---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Before coding/DB/API/vendor-package work — prove each structural fact against a real source (file:line · SDL · migration · probe) before planning"
load_context:
  - contexts/execution/evidence-discipline.md
  - contexts/execution/project-intelligence.md
triggers:
  - intent: "before coding"
  - intent: "DB-driven work"
  - keyword: "schema"
  - keyword: "endpoint"
  - phrase: "new API"
  - phrase: "unknown API"
  - phrase: "new vendor package"
  - phrase: "which fields"
routes_to:
  - "skill:source-discovery"
workspaces:
  - engineering
packs:
  - engineering-base
---

# Source Discovery — evidence before structure

## The Iron Law

```
NO STRUCTURAL CLAIM WITHOUT EVIDENCE FROM A REAL SOURCE.
EVERY FIELD, ENDPOINT, COLUMN, VALUE TRACES TO file:line · SDL · migration · probe.
LOCAL BEFORE REMOTE. REAL SOURCE BEFORE GUESSING.
INVENTING A FIELD AND CODING AGAINST IT IS THE FAILURE THIS RULE EXISTS TO STOP.
```

Before you plan or code against any external/expensive structure — a DB schema,
an API/GraphQL shape, a DTO/Model/Entity, or a vendor package's surface — read
the **real source** and produce a short **Evidence Report** (Verified / Assumed
(from card) / Gaps) with a source per claim. The plan consumes the report, not
your memory of how the structure "probably" looks.

## What fires this

- A coding/modifying/debugging intent that touches a field, endpoint, column,
  or value you have **not** confirmed this session.
- A **new or unknown API / GraphQL** surface.
- A **new vendor package** (its methods/fields/config).
- **DB-driven work** (filters, sorts, joins, migrations).

## What does NOT fire (gate-skip, per `rdp-gate`)

- Trivial edits (rename, typo, formatting, config flip).
- Structure already confirmed **this session** with a live source.
- The user already supplied the verified structure.

## The discipline in one breath

1. **Discover the real source first** — local before remote (`source-discovery`
   skill carries the per-surface procedure).
2. **Verified vs Assumed (from card):** confirmed-this-session = Verified; a
   committed card's positive structure = **Assumed (from card)**, a hypothesis to
   confirm before use — never "Verified" on the card alone.
3. **Provenance on every item** (`observed_at` / `source` / `version`); session
   reads invalidate on `HEAD` change; **fail-fast** mid git-op.
4. **Cards are caches, never sources of truth or build inputs.** Their durable
   core is negative facts + pointers; positive structure is a last-verified
   hypothesis.
5. **Verify after acting** with the real tool (per `think-before-action` matrix);
   any Assumed/`trust: low` line used unconfirmed is a violation surfaced post-task.

## v1↔v2 isolation contract (self-building context never bypasses read-fresh)

```
CURATED PROJECT-INTELLIGENCE (Evidence v2) IS READ FOR HEURISTICS ONLY —
NEVER TO BYPASS A FRESH STRUCTURAL READ. A FIELD/ENDPOINT/COLUMN/VALUE IS STILL
CONFIRMED AGAINST A LIVE SOURCE THIS SESSION, REGARDLESS OF WHAT CURATED "KNOWS".
```

v2 context (Class A config digests, Class B observed conventions, Class C learned
lessons) informs *where to look* and *what to expect* — it is **never** a build
input and never a substitute for the Evidence Report. v2 capture is write-only
into gitignored intake; trust and commit are always human-gated. Full model:
[`project-intelligence`](../contexts/execution/project-intelligence.md).

## Honest enforcement

The Evidence Report / self-log is **instrumentation**, not enforcement — a model
that invents a field can write a false "verified". The teeth are **pointer-CI**
(deterministic) + the **anti-hallucination eval** (empirical). See
[`evidence-discipline`](../contexts/execution/evidence-discipline.md).

## See also

- [`source-discovery`](../skills/source-discovery/SKILL.md) — the procedure + Evidence Report.
- [`think-before-action`](think-before-action.md) — minimum read set + verification matrix.
- [`context-document`](../skills/context-document/SKILL.md) — the knowledge card's parent mechanism.
- [`security-sensitive-stop`](security-sensitive-stop.md) · [`untrusted-input-defense`](untrusted-input-defense.md) — probing + fetched-doc safety.
