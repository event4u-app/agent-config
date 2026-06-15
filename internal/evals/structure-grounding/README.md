# Structure-grounding eval

Empirical backstop for the evidence-first structure-discovery discipline
(`source-discovery` rule + skill). The discipline's headline claim: reading the
**real source** before coding reduces *invented fields* — structural names a
model uses that do not exist in the real source.

## Why this exists

The discipline's self-log is **instrumentation, not enforcement** (a model can
write a false "verified"). The deterministic teeth are pointer-CI
(`check_knowledge_cards.py`) and **this eval**. Per the roadmap, a **null signal
stops the roadmap** — the discipline must earn its place empirically.

## Metric

**Invented fields** = every field / column / status-or-enum value a
model-under-test references that is NOT in the fixture's ground-truth set.
Lower is better; the discipline should drive it toward zero.

## Fixtures (ground truth)

- `fixtures/db/user_model.py` — DB surface. Authoritative field set + `status`
  enum. The task wording deliberately tempts three wrong names
  (`banned`→`suspended`, `username`→`full_name`, `signup_date`→`created_at`).
- `fixtures/api/` — API/GraphQL surface (Phase 3).
- `fixtures/vendor/` — vendor-package surface (Phase 3).

## Protocol

For each surface, a model-under-test runs the task in two conditions:

- **discovery-off** — prompt-only, fast pass, no source read (models the weak
  "build straight from the prompt" failure mode).
- **discovery-on** — the `source-discovery` discipline: read the real source,
  emit a three-bucket Evidence Report, code only against Verified names.

Each run returns `fields_referenced`; the scorer diffs against the fixture's
ground-truth set to count invented fields. Phase 3 adds a multi-run **variance
baseline** for discovery-off per surface, a **cross-feature duplication check**,
and minimal evidence counters.

## Results

- `results/smoke-2026-06-15.json` — Phase-1 smoke (DB surface): off invented
  3/3 structural names; on invented 0 and resolved all three traps. **Positive,
  not null** → roadmap proceeded.
- `results/full-*.json` — Phase-3 per-surface eval with variance baseline.

### Honesty notes

- The off/on prompt framing is a manipulation (off is told to skip
  investigation). It isolates the discipline's *core* claim — source-first vs
  prompt-only — not the marginal lift on an already-careful agent.
- `n` is small; these are signals, not benchmarks. Re-run on model upgrades.
