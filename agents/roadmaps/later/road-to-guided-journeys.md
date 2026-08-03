---
complexity: structural
status: later
---

# Road to guided journeys & router family — dock the journey pattern onto the existing Flow layer (Source C)

> **Parked per
> [`ADR-211`](../../../docs/decisions/ADR-211-harvest-freeze-resume-conditions.md)
> (harvest freeze; council disposition 2026-08-03):** additive capability
> system with no recorded internal failure; the external reviews'
> "foundation-first" mandate binds. The analysis below is kept in full
> because its self-census overturned its own v1 and is durable evidence
> about this repo's routing surfaces. Re-audited 2026-08-03: all four
> adoptions STAY (the census documents capability gaps, not failures; no
> recorded misroute incident exists).
>
> **Resume when:** the ADR-211 exit fires (external adopter OR the internal
> arm, which itself requires the renewal set to be complete). On resume,
> Phase 0 (docking council) runs first — nothing here is pre-decided.
>
> **Source identity:** an external skills-content reference ("Source C") — 62
> content skills, 12 "metaskill" guided journeys, zero verification
> machinery. Pre-analysis verdict, binding on resume: adopt NO content from
> the reference (book-derived material under a permissive license with
> affiliate links — provenance red flag); adopt only structural patterns,
> independently authored. The raw analysis with the source name and pinned
> commit is maintainer-local and gitignored, per source-confidentiality.

## The census finding worth keeping (source-verified 2026-08-02)

This repo has **no missing mechanism class** — it has three journey-adjacent
mechanisms that don't compose, and one router pattern proven at n=1:

| Surface | Incumbent | Gap |
|---|---|---|
| Skill→skill choice (analysis) | `analysis-skill-router` — chooser-not-worker, decision table | none; the proven template |
| Skill→skill choice (design) | — (16 `*design*` skills, no chooser) | largest unrouted confusion surface |
| Skill→skill choice (judge / brand / testing / memory) | — (7 / 6 / ~7 / 4 skills) | smaller; description-routing may suffice |
| Command sequence (user work) | Flow layer (ADR-055): `entry_points` / `default_path` / `skills`, schema-linted, full surface-map coverage | **no conductor** — nothing walks the path, asks decisions, survives session boundaries |
| Single-task drive | `/work` + work_engine (`.work-state.json` resume, typed `input.kind`) | task-scoped only |
| Long-horizon journey | Missions (n=1, catalog-driven) | no user decision points, no human tracker |

The v1→v2 correction is itself a finding: a new `journey: true` skill class
would have been backdoor debt against the existing layered model — the Flow
layer already reserves the slot ("a multi-command user-work journey",
`src/flows/README.md` verbatim; ADR-055's recorded Step-9 seam).

## Plan preserved for resume (re-run the census against the then-current tree)

- **A1 — journeys as guided mode of Flows:** optional `guided:` section per
  `default_path` step (Purpose / Brief-fallback / Invoke /
  Decide-with-the-user / Artifact / Done-when), GATE phases
  (deferrable-never-skippable), status vocabulary with mandatory reasons
  (`deferred: reason`, `skipped: reason` — "a decision made silently is a
  defect"); conductor via `input.kind="journey"` in the work_engine envelope;
  dual tracker (engine state + human `docs/<JOURNEY>-PLAN.md` in the user
  project); Brief fallback required for every step whose skill can be outside
  the active pack set; `/work` recognizes journey intents — no new top-level
  command.
- **A2 — artifact registry + lints that can fail:** canonical skeletons for
  shared user artifacts; create-if-missing / extend-otherwise /
  preserve-others'-sections; Lint A (quoted heading exists verbatim in the
  registry), Lint B (guided-section boilerplate hash-identical after
  normalization), both via `assertScanned`.
- **A3 — sibling routing in descriptions + mutual-consistency gate:**
  negative-routing sentences ("For X, use `<slug>`") for the design → judge →
  testing → brand clusters; Lint C (routed-to slug exists, pack-reachable, no
  A→B→A cycle).
- **A4 — router family pilot `design-skill-router`:** same chooser-not-worker
  contract as `analysis-skill-router`; Lint D (targets resolve + body size
  cap — a fat router is a worker); other cluster routers parked behind
  misroute evidence.
- **Phases:** 0 docking ADR/council (Flows vs Mission generalization vs the
  v1 subclass fallback) → 1 contracts before content (all four lints show red
  on seeded violations in CI) → 2 router pilot (≥90% routing eval, existing
  analysis-router suite stays green) → 3 ONE guided flow chaining only
  shipped skills, default-off → 4 paired dogfood evidence gate
  (pre-registered: resume-without-re-intake 2/2, zero edits outside the
  pinned safety-net map, 100% decision points recorded, maintainer blind
  preference ≥3/4; degradation trigger: >40% token overhead without the
  blind-preference win = FAIL regardless) → 5 close-out; honest-null on any
  fail parks the guided mode, keeps A2/A3/A4 (they stand on their own
  surfaces).

## Honest limitations (recorded at analysis time)

The census proves mechanism existence, not composability; n=12 at the
reference proves specifiability, not value; router evals measure routing
accuracy, not downstream outcome quality; Lint B's normalizer needs its own
known-divergent fixture.
