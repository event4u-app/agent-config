# Evidence Discipline — Report format, provenance, enforcement reality

Canonical definitional spine for evidence-first structure discipline. Loaded by
[`source-discovery`](../../rules/source-discovery-gate.md) rule and skill. Skill
holds the *procedure*; this file holds the *definitions* every later phase, the
linter, and ADRs refer back to.

## The invariant

```
NO STRUCTURAL CLAIM WITHOUT EVIDENCE FROM A REAL SOURCE.
EVERY FIELD, ENDPOINT, COLUMN, AND VALUE TRACES TO file:line · SDL · migration · probe.
LOCAL BEFORE REMOTE. REAL SOURCE BEFORE GUESSING.
```

Product is a **discipline**, not a knowledge database. A card is only an optional
cache for *expensive* evidence — never a source of truth, never a build input.

## Evidence Report — discovery output

Gitignored session scratchpad (`agents/memory/knowledge/session/`, overwritten each
task), produced **before** the plan, soft-capped to ~10–20 decision-relevant facts.
Three buckets:

- **Verified** — confirmed **this session** against a real source, **or** durable
  committed-card content (negative facts + pointers, pointer-CI green). Nothing else qualifies.
- **Assumed (from card)** — positive structural claims from a committed card but
  **not** confirmed this session; explicitly a hypothesis. A card's positive structure
  is **never** "Verified", even with a green pointer (R4 P1).
- **Gaps** — missing evidence the decision needs (negative facts in the making).

Feeds the plan. Not a forensic log, not hard enforcement. Produce cheaply via
`evidence_report.py` so it never gets skipped.

## Provenance and freshness

- Every item carries `observed_at`, `source`, `version` where one exists. Card
  **positive-structure lines** carry **per-line** `observed_at` / `source_version` (R4 P5).
- **Within a session:** read is fresh until file's **mtime** changes.
- **Invalidate all session reads when `git rev-parse HEAD` changes** — new HEAD means
  tree may have moved.
- **Fail-fast mid git-op:** if rebase/merge/cherry-pick is in progress
  (`.git/MERGE_HEAD`, `.git/CHERRY_PICK_HEAD`, or `.git/rebase-merge`/`rebase-apply`
  present), do **not** read an intermediate tree — stop and surface it (R4 P6,
  hole-3). *(`.git/REBASE_HEAD` excluded — lingers as stale ref after completed
  rebase, not a live-op marker.)* `evidence_report.py git-state` is the
  deterministic check.
- **Across sessions:** always re-read. No file hashing, no content-hash theater.

## Two-file split

| File | Home | Tracked? | Holds |
|---|---|---|---|
| **Ephemeral session cache** | `agents/memory/knowledge/session/` | gitignored | Evidence Report + raw probe/introspection dumps + absence-search log |
| **Committed card** | `agents/knowledge/<source>.md` | tracked | thin distillation: `trust: durable` negative facts + pointers; positive structure as per-line last-verified hypothesis |

Committed card extends `context-document` mechanism (a specialized context type)
— **not** a second knowledge system.

## DB-not-in-codebase boundary (R4 P2)

- **In-codebase** = schema defined by repo migrations / models / ORM / app code —
  **including** schemaless stores the app controls (Mongoose, Prisma, Firestore
  rules). → always **local, read fresh, no card**.
- **DB-not-in-codebase** = no repo migrations/models/app-code define the schema
  **and** app does not control it (vendor SaaS, partner, legacy DB). → may be
  **card-worthy** (remote evidence).

## Negative facts (R4 P4)

A negative fact is a **current-state fact** — "searched X, did not find Y" — not a
card-worthiness *decision* (belongs in notes/ADR, never an anti-hallucination card).
Write a negative-fact card **only after search is exhausted across all relevant
sources**, logging `searched` *and* `not_searched`, attach a `revalidate_if` trigger.

## Card-worthiness threshold (R3 F-3, R4 P2/P7)

Card-worthy = **(external package / remote API / DB-not-in-codebase)** AND **(≥3
distinct methods/fields *intended* to be used OR source exposes >50 methods and ≥1
is used OR prior hallucination OR local types/README insufficient)**. Judged on
**intended** use at discovery. Cross-feature duplication check flags structure
discovered in >1 session without a card as "should-have-been-card-worthy".

## L0–L4 — descriptive, not prescriptive

L0–L4 are human shorthand for discovery depth; documentation only. **Same** evidence
rules apply at every tier — no enforced state machine, no per-tier relaxation.

## Honest enforcement reality

```
THE SELF-LOG IS INSTRUMENTATION, NOT ENFORCEMENT.
A MODEL THAT INVENTS A FIELD CAN ALSO WRITE A FALSE "VERIFIED".
THE TEETH ARE POINTER-CI (DETERMINISTIC) + THE ANTI-HALLUCINATION EVAL (EMPIRICAL).
```

- **Instrumentation (soft):** Evidence Report and any `card_claims` self-log. Useful
  signal; never oversold as a guarantee.
- **Teeth (hard):** pointer-resolution CI (path exists / URL 200, strict-mode
  content-compare) + multi-evidence git-ancestry consistency check +
  per-surface anti-hallucination eval with variance baseline.

## Global layer (v2 — cross-project card sharing, ADR-100)

An *expensive* (remote) card may be promoted from project-local `agents/knowledge/`
to per-user **file-first** global store at `~/.event4u/agent-config/knowledge/`
(no daemon / DB / vector index / decay — 2026-06-14 Layer-2 sunset's core preserved).
**Storage, not governed** like a committed card: unversioned, a cache, never a source
of truth. Gated by `knowledge.global_sharing` setting (**default OFF until
cross-project reuse is measured across ≥ 2 real projects** — ADR-103 amends ADR-100
Phase 0; `enabled: false` fully no-ops the layer — v1 unaffected; operator opts in
explicitly; default flips back only on positive reuse signal).

- **Global card is a distillation, not a copy.** `trust: durable` core is
  **negative facts + pointers**; positive structure is explicit per-line
  **hypothesis** — never copied as build input.
- **Leads-only consumption.** Global card enters Evidence Report as **"Assumed (from
  card · GLOBAL, unverified)"** — positive structure must be re-confirmed against
  live source *this session*. Negative facts + pointers are usable as leads.
  Global-sourced positive structure is **never** "Verified".
- **Origin-tier scoping is the privacy floor.** `public` auto-shareable; `vendor`
  shareable **post-redaction**; `proprietary` **manual-only, default-off regardless
  of `enabled`** — no client-A schema leaks into client-B.
- **Redaction on write.** Promotion runs the `low-impact-corpus-privacy-floor` +
  `source-confidentiality` pattern set and **halts** on any hit — never
  silent-shares, never auto-rewrites.
- **Promotion is hybrid.** Card seen in ≥`auto_promote_threshold` distinct repos
  triggers a one-tap **suggestion**; never a silent write.

## Evidence v2 rollback target (Phase 0)

Evidence v2 (self-building project context — Class A config-pointers, Class B
observed conventions, Class C learned lessons) is an **additive** layer. Rollback
target is fixed and measurable:

```
v2 ROLLBACK = DISABLE ALL CURATED ACCUMULATED CONTEXT EXCEPT CLASS-A CONFIG-POINTERS.
THE MEASURABLE BASELINE TO REVERT TO IS v1 DISCIPLINE WITH NO ACCUMULATED CONTEXT.
```

Class A (config-derived pointers) is deterministic, drift-proof, no accumulation
risk → survives rollback. Class B/C are accumulation layers; if v2 eval shows
accumulated context raises error rate or cost is disproportionate, those layers are
disabled and agent runs v1 alone — acceptable outcome. "Self-improving" is a
hypothesis, not a law; rollback target makes the hypothesis falsifiable.

## See also

- [`project-intelligence`](project-intelligence.md) — Evidence v2: self-building context (A/B/C classes, memory tiers, the v1↔v2 isolation contract).
- [`source-discovery`](../../rules/source-discovery-gate.md) — the obligation surface.
- [`source-discovery`](../../skills/source-discovery/SKILL.md) — the procedure.
- [`think-before-action`](../../rules/think-before-action.md) — minimum read set + verification matrix.
- [`context-document`](../../skills/context-document/SKILL.md) — the card's parent mechanism.
