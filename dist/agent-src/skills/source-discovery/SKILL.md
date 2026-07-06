---
model_tier: medium
name: source-discovery
description: "Use BEFORE planning/coding against a DB schema, API/GraphQL shape, DTO/Model/Entity, or vendor package — read the real source, emit an Evidence Report, stop inventing fields."
domain: engineering
workspaces:
  - engineering
packs:
  - engineering-base
---

# source-discovery

The procedure behind the [`source-discovery`](../../rules/source-discovery-gate.md)
rule. Hand-off target from [`think-before-action`](../../rules/think-before-action.md)
when a task touches **external or expensive** structure. Definitions
(Evidence Report buckets, provenance, trust tiers, the DB-not-in-codebase
boundary, the card-worthiness threshold) live in
[`evidence-discipline`](../../agent-src/contexts/execution/evidence-discipline.md) —
read it once; this file is the executable procedure.

## When to use

Before you plan or code against a structure you have **not** confirmed this
session: a DB schema, an API/GraphQL shape, a DTO/Model/Entity, a vendor
package's surface, or any field/endpoint/column/value.

Do NOT use for: trivial edits (rename/typo/format), structure already verified
this session, or when the user supplied the verified structure (gate-skip per
`rdp-gate`).

## The shape of a run

```
discover the real source  →  Evidence Report (Verified / Assumed / Gaps)  →  plan  →  act  →  verify with the real tool
```

Scaffold the report cheaply so it never gets skipped:

```bash
python3 src/scripts/evidence_report.py git-state            # fail-fast: abort if a rebase/merge/cherry-pick is in progress
python3 src/scripts/evidence_report.py init --task "<task>" # writes the gitignored session report
python3 src/scripts/evidence_report.py add --bucket verified --claim "users.email is unique" --source "db/schema/users.sql:23"
```

**Provenance on every item** (`observed_at` / `source` / `version`). Within a
session a read is fresh until the file's mtime changes; **invalidate all session
reads when `git rev-parse HEAD` changes**; across sessions always re-read.

## Step 0 — Resolve local structure fresh (NO persistent index)

Resolve name → path **fresh** each lookup with `rg` / glob, then read the file
fresh. There is **no** persistent bootstrap index (a measured `rg`-latency
problem on a large monorepo is the only thing that would justify one — deferred).

```bash
rg -n "class User\b|model User|CREATE TABLE .*users" --type-add 'src:*.{php,ts,js,py,go,rb,sql}' -t src
```

## Procedure — discover and analyze each surface before planning

1. **Identify** which surface(s) the task touches (DB / API / vendor / DTO).
2. **Discover** the real source via the matching sub-procedure below — local
   before remote, analyzing the actual definition, never memory.
3. **Record** each fact into the Evidence Report with provenance, then build the
   plan from the report.

### A. DB schema — in-codebase = LOCAL, read fresh, no card

**In-codebase** (schema defined by repo migrations / models / ORM / app code,
**including** schemaless stores the app controls — Mongoose / Prisma / Firestore
rules) → always local & fresh. Dump tables, columns, types, primary/foreign/
unique keys, indexes, relations, and derived filter/sort/group-ability into the
session cache with provenance — framework-neutral (MySQL / Postgres / SQLite;
ORM-agnostic). The **migration is intended truth, the live DB is actual**;
divergence is a drift signal worth surfacing. Only **negative facts** graduate to
a committed card (see [`database`](../database/SKILL.md) for the dump procedure).

### B. API / GraphQL — probe + confirm

Resolve an OpenAPI/Swagger spec or GraphQL introspection from config/task first.
Else run a **read-only, idempotent `GET` probe**, reduced with `jq` — never a full
dump, never a write/stateful call, never prod without permission, secrets-aware
per [`security-sensitive-stop`](../../rules/security-sensitive-stop.md). A probed
positive shape is `trust: low` ("Assumed (from card)" if card-sourced) and must
be confirmed against the live surface before use.

### C. Vendor / external-DB docs — card-worthy

Card-worthy = **(external package / remote API / DB-not-in-codebase)** AND **(≥3
distinct methods/fields *intended* to be used, OR the source exposes >50 methods
and ≥1 is used, OR a prior hallucination on it, OR local types/README are
insufficient)** — judged on *intended* use at discovery (still built **before**
coding). For a card-worthy dependency named in the task: **local-first**
(`node_modules` / `vendor` README + type defs; the **installed version is ground
truth**), then the net (registry → repo host → homepage). **Pin the remote ref to
the installed version — never blind `main`.** Reuse
[`external-reference-deep-dive`](../../rules/external-reference-deep-dive.md) +
[`markitdown`](../markitdown/SKILL.md); honor `source-confidentiality`,
`untrusted-input-defense`, `lethal-trifecta-guard`. Persist via the
`knowledge-card` template under `agents/knowledge/<source>.md`.

### D. DTO / Model / Entity — local, read fresh

Resolve and read the actual class fresh (Step 0). In-codebase → local, no card.

### E. Global cards — leads only (v2, ADR-100)

When `knowledge.global_sharing.enabled` (user-global, **default off until cross-project reuse measured** — ADR-103), a matching
card may exist in the per-user file-first store
(`~/.event4u/agent-config/knowledge/`), promoted from another project. **Lead,
never a build input**:

- Load **negative facts + pointers** as leads (`trust: durable`).
- Load **positive structure** under **"Assumed (from card · GLOBAL,
  unverified)"** — record via `evidence_report.py add --bucket assumed --origin
  global …` and **re-confirm vs the live source this session** before use
  (version skew / schema drift). Never "Verified" on the global card alone.
- `public`/`vendor` seen in ≥ `auto_promote_threshold` distinct repos → one-tap
  promotion **suggestion** (never silent); `proprietary` is manual-only. Record
  sightings via `_lib/knowledge_global_promote.py record-seen`.

## Missing structure → fixed extension workflow

When the field/endpoint/table you need is **not** there:

1. **Search** the relevant sources.
2. **Not found** — record the **absence-search log** with `searched` *and*
   `not_searched` (via `evidence_report.py add --bucket gaps --searched … --not-searched …`).
3. **Negative-fact card** — only **after the search is exhausted across all
   relevant sources** for that claim: write `type: anti-hallucination`,
   `polarity: negative`, with `actionable` + `next_step` + a `revalidate_if`
   trigger ("an OpenAPI spec / contracts dir is added"). A negative fact is a
   **current-state fact** ("searched X, didn't find X") — not a card-worthiness
   *decision* (that belongs in notes/ADR).
4. **Extension plan** — a codebase-fitting plan (migration + model/cast/factory/
   seeder, or the stack equivalent). **Plan only, never silent execution**
   ([`scope-control`](../../rules/scope-control.md)).

## Verify after acting (Phase-3 wiring)

After acting on discovered structure, verify with the **real tool** per the
[`think-before-action`](../../rules/think-before-action.md) matrix — `curl` /
Playwright / debugger / test runner / DB query. Any **Assumed (from card)** or
`trust: low` line used without this-session confirmation is a violation surfaced
post-task. A stale card (installed-version mismatch OR `last_verified` older than
N days) is **lead-only**: negative facts + pointers stay usable, positive
structure must be re-confirmed. Green is not a correctness proof — high-risk /
irreversible steps verify regardless.

## Output

The Evidence Report (gitignored session cache), three buckets, soft-capped to
~10–20 decision-relevant facts, produced **before** the plan; plus, where the
threshold is met, a thin committed card.

## Evidence v2 — self-building context (heuristics only, never a bypass)

Curated project-intelligence (Class A config digests, Class B observed conventions,
Class C learned lessons) may be loaded to inform *where to look* and *what convention
to expect* — but read **for heuristics only** and **never** bypasses a fresh structural
read. A field/endpoint/column/value is still confirmed against a live source this
session. v2 capture is **write-only into gitignored intake** (agent may *suggest* a
signal, never silently commit); trust and commit are always human-gated. Full model +
the three classes + memory tiers:
[`project-intelligence`](../../agent-src/contexts/execution/project-intelligence.md).

## Knowledge capture (`api_shape_learned` / `convention_detected` events)

A confirmed API/GraphQL shape (§B) or an observed coding convention with
≥ 2 supporting locations is worth persisting for the team, distinct
from the per-session Evidence Report above. Append to the knowledge
intake — never write a tracked page mid-task:

```bash
./scripts-run src/scripts/emit_knowledge_event --type api_shape_learned \
    --endpoint "<path>" --method "<verb>" --request-schema '<json>' --response-schema '<json>'

./scripts-run src/scripts/emit_knowledge_event --type convention_detected \
    --pattern "<pattern>" --evidence "file:line" --sample-size <N> --scope project
```

`/team-knowledge consolidate` turns accumulated events into
`agents/knowledge/concepts/` pages as a reviewed batch — see
[`knowledge-pages`](../../templates/contexts/knowledge-pages.md).

## Gotchas

- A card's positive structure is **never** "Verified" on the card alone — it is
  "Assumed (from card)" until confirmed this session (R4 P1).
- L0–L4 depth labels are documentation only — the same evidence rules apply at
  every tier; no per-tier relaxation.
- The self-log is instrumentation; the deterministic teeth are pointer-CI + the
  eval. Do not treat a written "verified" as proof.

## Do NOT

- Do NOT plan or code against an unconfirmed field/endpoint/column.
- Do NOT treat a card as a source of truth or a build input.
- Do NOT execute a schema/API extension silently — plan, then hand back.
- Do NOT read an intermediate tree mid git-op — fail-fast.
