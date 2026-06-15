---
adr: 098
status: accepted
date: 2026-06-15
decision: evidence-first-structure-discovery
supersedes: —
superseded_by: ADR-100 (Decision-10 only)
phase: structure-grounding
type: structural
---

# ADR-098 — Evidence-first structure discovery

## Status

Accepted (2026-06-15). Council-gated, four rounds (claude-sonnet-4-5 + gpt-4o,
design mode). Implements `agents/roadmaps/archive/road-to-structure-grounding.md` v1.

## Context

Agents hallucinate structure — they invent fields, endpoints, columns, and enum
values and then plan or code against them, running in the wrong direction. The
ask was for a discipline that makes the agent inspect the **real** structures it
is about to work with (DB schema, API/GraphQL shape, DTO/Model/Entity, vendor
package docs) **before** planning, plus a maintained lean knowledge layer kept
both globally (per-user) and in the consumer repo with a usage registry and
auto-promotion ("used in 2+ projects → global").

The global/registry/auto-promotion layer is **runtime-shaped** and re-opens the
2026-06-14 Layer-2 sunset (no daemon, no vector DB, no writable per-user store).
The durable, defensible core is the **evidence discipline** itself, not a
knowledge database.

A measured smoke eval confirmed the premise is not a null signal: on a DB fixture
whose task wording tempted three wrong names, discovery-off invented 3/3
structural names; discovery-on invented 0. The full per-surface eval (DB / API /
vendor) reproduced this — discovery-off averaged 1.67–2.33 invented names per
run; discovery-on drove it to 0 on every surface.

## Decision

1. **The evidence-first invariant.** No structural claim without evidence from a
   real source — every field/endpoint/column/value traces to `file:line` · SDL ·
   migration · probe. Local before remote, real source before guessing.

2. **The Evidence Report** (gitignored session scratchpad, soft-capped ~10–20
   decision-relevant facts) in three buckets — **Verified** (confirmed this
   session, or durable card negative-facts/pointers), **Assumed (from card)**,
   **Gaps** — produced before the plan. A committed card's **positive structure
   is filed under "Assumed (from card)", never "Verified"**, even with a green
   pointer (R4 P1), and is re-confirmed against the live source before use.

3. **Card trust-tiering.** A knowledge card is an *optional cache of expensive
   (remote) evidence* — never a source of truth, never a build input. Its
   `trust: durable` core is **negative facts + pointers**; positive structure is
   a per-line, last-verified **hypothesis** carrying `observed_at`/`source_version`.

4. **Cards are remote-only; local is always fresh; no persistent index.**
   In-codebase structure is resolved **fresh** (`rg`/glob) and read fresh each
   task — no persistent resolution index (deferred until a measured `rg`-latency
   problem appears). Session reads invalidate on `HEAD` change and **fail-fast**
   mid git-op (rebase/merge/cherry-pick).

5. **The DB-not-in-codebase boundary.** A schema defined by repo migrations /
   models / ORM / app code — **including** schemaless stores the app controls
   (Mongoose / Prisma / Firestore rules) — is in-codebase → local, read fresh,
   no card. Only a DB whose schema is not in the repo **and** not app-controlled
   (vendor SaaS / partner / legacy) is card-worthy.

6. **Honest enforcement reality.** The Evidence Report / `card_claims` self-log
   is **instrumentation, not enforcement** — a model that invents a field can
   write a false "verified". The teeth are **pointer-CI** (`check_knowledge_cards.py`:
   size ≤ 150, mandatory authoritative pointer, trust tagging, multi-evidence
   git-ancestry consistency, `--strict` content-compare) + the **per-surface
   anti-hallucination eval** with a variance baseline.

7. **`anti-hallucination` kept over `invariant`** as the card frontmatter `type`
   (R3 F-2) — a card is a current-state observation, not an inviolable law.

8. **A negative fact is a current-state fact**, not a card-worthiness decision —
   written only after an *exhausted* search logging `searched`/`not_searched`,
   with a `revalidate_if` trigger (R4 P4).

9. **Ships as a core extension, not a pack.** The discipline extends existing
   primitives — `think-before-action` (one-line pointer), `context-document`
   (the card is a specialized context type), `agents/settings/contexts/`,
   `size-enforcement` — rather than forking a parallel system. The
   `think-before-action` edit is to a tier-2b `auto` rule (not a kernel
   `type: always` rule), so the kernel slow-rollout guarantee does not apply;
   the edit is a minimal additive pointer.

10. **The global/registry layer is gated v2.** Phase 4 only **instruments**
    (a v1-safe usage counter keyed by card + repo-slug, never paths/contents) and
    **measures** cross-project reuse over weeks, then **decides** against
    kill-criteria: near-zero reuse → kill global + registry + promotion (the
    discipline + project cards stood on their own); real reuse → a gated
    follow-up roadmap (pointer-CI green incl. strict-mode, global cards
    leads/negative-facts only, **manual** promotion — no auto "≥2", a
    `forget`/inspect command, store under the install `global` scope). Killing
    the global layer never kills the cards.

    **RESOLVED 2026-06-15 — v2 KILLED.** The operator exercised the kill option
    directly rather than wait out the measurement window: the global / registry
    / promotion layer will **not** be built, and the v1-safe usage counter
    (`knowledge_card_usage.py`) is **retired/removed** (its only purpose was to
    feed the now-abandoned promotion gate). No follow-up roadmap is spawned. The
    durable value stood in the v1 discipline + committed project cards, exactly
    as the kill path anticipated. The roadmap is closed/archived.

    **REVERSED 2026-06-15 → see [ADR-100](ADR-100-global-knowledge-card-sharing.md).**
    The operator reversed this kill the same day: the global cross-project layer
    **is** built — but **file-first** (lazy-read plain files, no daemon / DB /
    vector / decay), which preserves the Layer-2 sunset's *core* (no runtime)
    rather than re-opening it. Promotion stays **hybrid** (suggest ≥2 + manual
    confirm, never silent), global cards are **leads / negative-facts only**, and
    **origin-tier scoping** keeps proprietary structure manual-only. **This
    Decision-10 is superseded by ADR-100; the rest of ADR-098 stands.**

## Consequences

- A new tier-2b `auto` rule (`source-discovery-gate`) + skill (`source-discovery`)
  fire before coding/DB/API/vendor work, with a gate-skip for trivial work.
- A new committed-card home (`agents/knowledge/`) + gitignored session cache
  (`agents/memory/knowledge/session/`); a `knowledge-card` template; two new
  scripts (`evidence_report.py`, `check_knowledge_cards.py`). A third v1-safe
  usage counter shipped initially but was **retired with the 2026-06-15 v2 kill**.
- A new CI gate (`check-knowledge-cards`) enforces card referential integrity.
- v1 is complete; the gated v2 (global layer / registry / promotion) was
  **killed 2026-06-15** (Decision 10) and the roadmap archived.

## Alternatives

- **Build the global layer + registry + auto-promotion now** — rejected as
  runtime-shaped (re-opens the Layer-2 sunset); gated behind measured reuse.
- **A persistent local resolution index** — rejected for v1 (resolve fresh);
  deferred until `rg`-latency is measured to hurt on large monorepos.
- **Treat the self-log as hard enforcement** — rejected; honest framing only,
  with deterministic teeth in pointer-CI + the eval.
- **`type: invariant` cards** — rejected for `anti-hallucination` (current-state,
  not law).
- **A standalone knowledge-database pack** — rejected for a core extension of
  existing primitives.

## References

- `agents/roadmaps/archive/road-to-structure-grounding.md` — the roadmap (R1–R4 council
  convergence inlined in its header).
- `src/rules/source-discovery-gate.md`, `src/skills/source-discovery/SKILL.md`,
  `src/agent-src/contexts/execution/evidence-discipline.md`.
- `src/scripts/check_knowledge_cards.py`, `evidence_report.py` (the v2 usage
  counter was retired with the 2026-06-15 kill).
- `internal/evals/structure-grounding/` — smoke + per-surface eval fixtures and
  results.
- ADR-035 (model-tier ≠ host band), the 2026-06-14 Layer-2 sunset decision.
