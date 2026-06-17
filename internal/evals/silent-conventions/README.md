# Silent-conventions eval — the discriminating gate for Evidence v2 accumulation

The **valid** re-design the 2026-06-16 council demanded for
`agents/roadmaps/archive/road-to-evidence-v2-accumulation-layer.md` Phase 1 (now
closed — shipped base only). It replaces
the **invalid** dogfood eval (`internal/evals/observed-conventions/`, whose
ground truth was `skill_linter.py` → both arms saturated at 0 errors → the
"lift" was just pre-caching linter output).

## The discriminating principle

A convention is a valid measuring ground for the accumulation layer **only if a
careful agent does not reliably comply without the accumulated context.** That
rules out every convention with a deterministic backstop. A task is admitted
only if it passes the **discrimination pre-check** below; the dogfood eval
shipped without one, which is why it saturated.

### Discrimination pre-check (all four required to admit a task)

1. **No linter / CI gate.** No script in `src/scripts/` (lint_*, check_*) fails
   on a violation. Grep the convention's keyword across the lint/check scripts;
   a hit disqualifies the task.
2. **Not in an always-loaded rule.** The convention is absent from
   `dist/agent-src/rules/` (the kernel + tier-1/2 always-on set). If a loaded
   rule states it, the v1 arm already carries it → no v1↔v2 gap.
3. **Not in an auto-loaded skill for the task surface.** The skill whose
   `description` would fire for this task (e.g. `roadmap-writing` for a roadmap
   task) must not state the convention. If it does, v1 ≈ v2.
4. **Evidence of violation.** A real instance in this repo where a careful
   author (or a prior agent run) violated it. No evidence → the convention may
   be obvious; demote to `needs-evidence` in `corpus.yaml`, do not run it.

A convention that fails any check is **not discriminating** and is excluded —
recording *why* (in `corpus.yaml`) is the audit trail the dogfood eval lacked.

### Consequence requirement

The violation must have a **real, silent consequence** (something downstream
breaks or is wrong, with no error at author time). "Silent" is the point: if the
violation surfaced an error, tooling — not accumulated knowledge — would catch
it. This is what makes the convention *worth accumulating*.

## The three arms (per the Gate)

| Arm | What the agent has | Question it answers |
|---|---|---|
| `no-context` | bare host, package OFF | does a bare model know the repo's silent conventions? (expected: no) |
| `v1` | package ON (rules + skills + `source-discovery`), **no** accumulated context | does the package's general discipline + discover-the-source reliably reach compliance? |
| `v2-accumulated` | package ON **+** the accumulated convention card for this task | does carrying the observed/committed convention add lift over v1? |

The decision is **v2 vs v1**, not v2 vs no-context. `no-context` is the floor;
the accumulation layer must beat **v1**, the arm that already has the package and
can read the repo. A v2≈v1 result kills the layer (the package's existing
discover-the-source discipline already suffices).

## Metrics (efficacy + cost — both mandatory, per Evidence v2 Phase 0)

**Efficacy — silent-convention violations** = per task, did the output comply
with the consequence-bearing detail? Binary per task; aggregate = violation
rate per arm. Lower is better.

**Cost** — mandatory `cost` block on every arm of every result (same schema as
`structure-grounding`): `input_tokens`, `output_tokens`, `turns`, `wall_ms`. A
layer that lowers violations but triples cost is not an automatic win; the
decision cites the efficacy delta **and** the cost delta.

> Reliability across seeds: report **pass^k** (all k runs comply) per arm, not
> just mean violation rate — a convention the agent complies with 3/8 times is
> not "carried". Reuse the `pass^k` definition from `bench_ab_v2_stats.py`.

## The gate (Phase 1 decision)

- **PASS → build the layer (Phase 2/3):** `v2-accumulated` shows a *significant*
  violation-rate reduction vs `v1` across ≥ 10 tasks at acceptable cost, AND the
  reduction is not explained by `v1` already saturating (if `v1` violation rate
  ≈ 0, there is no headroom → not a PASS, the task pool was non-discriminating).
- **KILL → ship v2 base only:** `v2 ≈ v1`, or `v1` already saturates. Mark the
  roadmap closed "shipped base only", archive. This is an acceptable outcome
  (the rollback target in `evidence-discipline`).

## Corpus

`corpus.yaml` — the ≥ 10 admitted tasks plus the excluded candidates with their
pre-check failure reason. Each admitted task points to a fixture card under
`fixtures/` (the `v2-accumulated` context the layer would carry) and states the
ground-truth compliant output.

## Status

- [x] Design + discrimination pre-check + arms + metrics + gate (this file).
- [x] Flagship fixture: `fixtures/roadmap-phase-heading.md` (real 2026-06-16
      violation evidence — see its pre-check block; #3 is a *soft* pass and the
      card explains exactly which bit is the discriminating, un-encoded part).
- [ ] Fill the corpus to ≥ 10 admitted tasks (each pre-checked).
- [ ] **BILLABLE — operator OK required:** run the 3-arm eval, record
      efficacy + cost, apply the gate.
