# Evidence Discipline — Report format, provenance, enforcement reality

Canonical definitional spine for the evidence-first structure discipline. Loaded
by the [`source-discovery`](../../rules/source-discovery-gate.md) rule and the
[`source-discovery`](../../skills/source-discovery/SKILL.md) skill. The skill
holds the *procedure* (how to discover each surface); this file holds the
*definitions* every later phase, the linter, and the ADR refer back to.

## The invariant

```
NO STRUCTURAL CLAIM WITHOUT EVIDENCE FROM A REAL SOURCE.
EVERY FIELD, ENDPOINT, COLUMN, AND VALUE TRACES TO file:line · SDL · migration · probe.
LOCAL BEFORE REMOTE. REAL SOURCE BEFORE GUESSING.
```

The product is a **discipline**, not a knowledge database. A card is only an
optional cache for *expensive* evidence — never a source of truth, never a
build input.

## Evidence Report — the discovery output

A gitignored session scratchpad (`agents/memory/knowledge/session/`, overwritten
each task), produced **before** the plan, soft-capped to ~10–20 decision-relevant
facts (a smell-test, not a hard gate). Three buckets:

- **Verified** — confirmed **this session** against a real source, **or** durable
  committed-card content (negative facts + pointers, pointer-CI green). Nothing
  else qualifies.
- **Assumed (from card)** — positive structural claims taken from a committed
  card but **not** confirmed this session; explicitly a hypothesis. A card's
  positive structure is **never** "Verified", even with a green pointer (R4 P1).
- **Gaps** — missing evidence the decision needs (negative facts in the making).

It feeds the plan. It is **not** a forensic log and is **not** hard enforcement.
Produce it cheaply via `evidence_report.py` (template automation) so it never
gets skipped.

## Provenance and freshness

- Every evidence item carries `observed_at`, `source`, and `version` where one
  exists. Card **positive-structure lines** carry **per-line** `observed_at` /
  `source_version` (R4 P5).
- **Within a session:** a read is fresh until the file's **mtime** changes.
- **Invalidate all session reads when `git rev-parse HEAD` changes** — a new HEAD
  means the tree may have moved under you.
- **Fail-fast mid git-op:** if a rebase/merge/cherry-pick is in progress
  (`.git/MERGE_HEAD`, `.git/CHERRY_PICK_HEAD`, or a `.git/rebase-merge`/
  `rebase-apply` directory present), do **not** read an intermediate tree — stop
  and surface it (R4 P6, hole-3). *(`.git/REBASE_HEAD` is excluded — it lingers as
  a stale ref after a completed rebase and is not a live-op marker.)* The
  `evidence_report.py git-state` subcommand is the deterministic check.
- **Across sessions:** always re-read. No file hashing, no content-hash theater.

## Two-file split

| File | Home | Tracked? | Holds |
|---|---|---|---|
| **Ephemeral session cache** | `agents/memory/knowledge/session/` | gitignored | Evidence Report + raw probe/introspection dumps + the absence-search log |
| **Committed card** | `agents/knowledge/<source>.md` | tracked | thin distillation: `trust: durable` negative facts + pointers; positive structure as per-line last-verified hypothesis |

The committed card extends the `context-document` mechanism (a specialized
context type) — it is **not** a second knowledge system.

## DB-not-in-codebase boundary (R4 P2)

- **In-codebase** = the schema is defined by repo migrations / models / ORM /
  app code — **including** schemaless stores whose shape the app controls
  (Mongoose, Prisma, Firestore rules). → always **local, read fresh, no card**.
- **DB-not-in-codebase** = no repo migrations/models/app-code define the schema
  **and** the app does not control it (vendor SaaS, partner, legacy DB). → may be
  **card-worthy** (remote evidence).

## Negative facts (R4 P4)

A negative fact is a **current-state fact** — "searched X, did not find Y" — not a
card-worthiness *decision* (that belongs in notes/ADR, never an anti-hallucination
card). Write a negative-fact card **only after the search is exhausted across all
relevant sources** for that claim, logging `searched` *and* `not_searched`, and
attach a `revalidate_if` trigger (e.g. "an OpenAPI spec / contracts dir is added").

## Card-worthiness threshold (R3 F-3, R4 P2/P7)

Card-worthy = **(external package / remote API / DB-not-in-codebase)** AND **(≥3
distinct methods/fields *intended* to be used OR the source exposes >50 methods
and ≥1 is used OR a prior hallucination on it OR local types/README are
insufficient)**. Judged on **intended** use at discovery — a card may be upgraded
later if usage grows, so it is still built *before* coding. A cross-feature
duplication check flags structure discovered in >1 session without a card as
"should-have-been-card-worthy".

## L0–L4 — descriptive, not prescriptive

L0–L4 are human shorthand for how deep a discovery went; they are documentation
only. The **same** evidence rules apply at every tier — no enforced state
machine, no per-tier evidence relaxation.

## Honest enforcement reality

```
THE SELF-LOG IS INSTRUMENTATION, NOT ENFORCEMENT.
A MODEL THAT INVENTS A FIELD CAN ALSO WRITE A FALSE "VERIFIED".
THE TEETH ARE POINTER-CI (DETERMINISTIC) + THE ANTI-HALLUCINATION EVAL (EMPIRICAL).
```

- **Instrumentation (soft):** the Evidence Report and any `card_claims` self-log.
  Useful signal; never oversold as a guarantee.
- **Teeth (hard):** pointer-resolution CI (path exists / URL 200, strict-mode
  content-compare) + the multi-evidence git-ancestry consistency check +
  the per-surface anti-hallucination eval with a variance baseline.

## Global layer (v2 — cross-project card sharing, ADR-100)

Expensive (remote) card promotable from project-local `agents/knowledge/` to a
per-user **file-first** store `~/.event4u/agent-config/knowledge/` (no daemon /
DB / vector / decay — Layer-2 sunset core preserved). **Storage, not governed**:
unversioned, a cache, never source of truth — provenance footer = audit trail.
Gated by user-global `knowledge.global_sharing` (default ON, safe tiers;
`enabled: false` no-ops the layer, v1 unaffected).

- **Distillation, not a copy.** `trust: durable` core = negative facts +
  pointers; positive structure = per-line **hypothesis**, never a build input.
- **Leads-only consumption.** Global card → Evidence Report under **"Assumed
  (from card · GLOBAL, unverified)"** — positive structure re-confirmed vs live
  source *this session* before use (version skew / schema drift). Never
  "Verified" on the global card alone. Negative facts + pointers = usable leads.
- **Origin-tier scoping = privacy floor.** `public` (registry/GitHub/docs)
  auto-shareable; `vendor` (Stripe/AWS) shareable **post-redaction**;
  `proprietary` (in-house DB/API, client schemas) **manual-only, default-off
  regardless of `enabled`** — no client-A schema into client-B.
- **Redaction on write.** Promotion runs `low-impact-corpus-privacy-floor` +
  `source-confidentiality` and **halts** on any hit — never silent-shares, never
  auto-rewrites.
- **Promotion hybrid.** `public`/`vendor` card seen in ≥`auto_promote_threshold`
  distinct repos → one-tap **suggestion**; never silent.

## See also

- [`source-discovery`](../../rules/source-discovery-gate.md) — the obligation surface.
- [`source-discovery`](../../skills/source-discovery/SKILL.md) — the procedure.
- [`think-before-action`](../../rules/think-before-action.md) — minimum read set + verification matrix.
- [`context-document`](../../skills/context-document/SKILL.md) — the card's parent mechanism.
