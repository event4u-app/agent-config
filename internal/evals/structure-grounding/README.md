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

## Metrics

Two halves of one go/no-go. Efficacy alone is not the decision — a discipline
that runs on *every* non-trivial task must also justify its per-task overhead.

**1. Efficacy — invented fields** = every field / column / status-or-enum value
a model-under-test references that is NOT in the fixture's ground-truth set.
Lower is better; the discipline should drive it toward zero.

**2. Cost (Evidence v2 Phase-0 addition).** Every arm records its resource
footprint so the marginal value can be weighed against the marginal cost:

| Field | Meaning |
|---|---|
| `input_tokens` / `output_tokens` | Tokens consumed by the model-under-test for the arm |
| `turns` | Tool-call round-trips (a read-fresh discipline costs extra turns) |
| `wall_ms` | Wall-clock latency of the arm |

The cost block is **mandatory** on every condition in every result JSON written
from Phase 0 onward (see schema below). A discipline that lowers invented fields
but triples token cost is not an automatic win — the result must state the
efficacy delta **and** the cost delta, and the decision cites both.

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

Each run returns `fields_referenced` **and** the cost block
(`input_tokens` / `output_tokens` / `turns` / `wall_ms`); the scorer diffs
`fields_referenced` against the fixture's ground-truth set to count invented
fields and records cost verbatim. Phase 3 adds a multi-run **variance
baseline** for discovery-off per surface, a **cross-feature duplication check**,
and minimal evidence counters.

### Fair control (Evidence v2 Phase-0 addition)

The original off/on framing (below) isolates the *core* claim but cannot measure
*marginal* lift — its `discovery-off` arm is prompt-crippled ("fast first pass,
do not explore"). From Phase 0 onward a run MAY add a third arm,
`careful-control`: a **normally careful** agent with **no** crippling prompt and
**no** source-discovery discipline — just "do a good job". This is the arm that
answers "does the discipline help an agent that was already going to be
careful?" — the question the crippled control cannot. Record all three arms with
the cost block; the honest delta is `careful-control` vs `discovery-on`, not the
crippled `discovery-off` vs `discovery-on`.

### Result schema (cost block mandatory)

```json
{
  "conditions": {
    "<arm>": {
      "fields_referenced": ["..."],
      "invented_fields": ["..."],
      "invented_count": 0,
      "verified_count": 0,
      "cost": { "input_tokens": 0, "output_tokens": 0, "turns": 0, "wall_ms": 0 }
    }
  }
}
```

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
