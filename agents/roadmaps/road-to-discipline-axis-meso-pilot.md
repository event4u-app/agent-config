---
complexity: structural
status: ready
parent_roadmap: road-to-discipline-axis-benchmark
---

> Blocked until a maintainer allocates the ~17M-token pilot budget. Spawned from
> `road-to-discipline-axis-benchmark` (Phase 4 honest-null at micro scale).

# Roadmap: discipline-axis benchmark — complexity-stratified pilot (meso/multi)

The v2 discipline-axis apparatus is built and validated (corpus, dual-axis
deterministic scorer, 4-arm runner, paired McNemar/Wilcoxon stats, honest
two-table render). The **micro** pilot returned an honest **null**: bare
`claude-sonnet-4-6` is already disciplined on tiny fixtures (vanilla discipline
≈ 1.0), so there is no headroom for the package to lift.

Per the **2026-06-14 council** (claude-sonnet-4-5 + gpt-4o, 2 peer-reviewed
rounds), that is NOT a full falsification — the discipline axis must be tested at
**realistic complexity** before concluding. This roadmap is that test.

## Goal

Decide the v2 gate honestly: does the package's discipline lift become
**measurable** when the tasks are large/noisy enough that a capable host stops
being trivially careful — or does the discipline axis saturate across ALL
scales (true honest-null, keep the apparatus, claim no lift)?

## Gate (council-locked)

- **FALSIFY (honest null, keep apparatus, claim no lift):** vanilla discipline
  ≥ 0.85 on ≥ 70% of pairs at **all three** scales (micro AND meso AND multi).
- **PASS (scale to a headline N at the winning scale):** a complexity gradient
  appears (vanilla discipline DECREASES as scale rises) **AND** package > vanilla
  at ≥ 1 scale (McNemar p < 0.05 or Wilcoxon p < 0.05, n ≥ 6, effect size ≥ 0.5).
- Honor the N=3 validation-loop budget — do not iterate trap-hardening forever.

## Phase 1 — Meso + multi-file fixtures (2 archetypes)

- [ ] Pick the 2 archetypes most likely to retain headroom against a capable
      host (council steer: over-engineering-bait + premature-completion/scope are
      the strongest candidates; ambiguity also plausible).
- [ ] Author **meso** fixtures (~200-400 LOC, multiple modules, genuine lure
      density) and **multi-file** fixtures (cross-file dependency the naive path
      misses) for each, mirroring `SCHEMA-v2.md` with the same deterministic
      oracle vocabulary (no new judge).
- [ ] Validate each trap discriminates (naive edit → discipline drops; minimal
      → 1.0) with the existing `bench_ab_scoring_v2.py`, before any live spend.

## Phase 2 — Stratified pilot run

- [ ] Run **2 archetypes × 3 scales (micro/meso/multi) × 3 seeds × 4 arms**
      (~48-72 runs) at `--budget 3.5` (package arms must complete), sonnet-pinned,
      error-aware. ~17M-token envelope. Record host + config + seeds.
- [ ] Compute the per-scale paired stats (`bench_ab_v2_stats.py`) and apply the
      gate above. Surface the verdict for maintainer decision.

## Phase 3 — Resolve the gate

- [ ] **PASS →** scale to a headline N at the winning scale; render the final
      two-table report; formalize `docs/contracts/benchmark-*.md` + the v2 corpus
      linter (deferred from the parent Phase 6).
- [ ] **FALSIFY →** render the honest null across all scales; document that the
      package's discipline is not measurable on this host at this scale; keep the
      apparatus for a weaker-host re-test (parent council path 4) or future use.

## Optional — weaker-host re-test (council path 4)

- [ ] If micro/meso/multi all saturate on sonnet, re-run one scale against a
      deliberately weaker host (smaller/older model) where discipline headroom is
      larger — and state plainly that the claim then narrows to "lift on weaker
      hosts", not frontier models.

## Acceptance criteria

- A clean stratified read (no budget truncation) at micro/meso/multi.
- The gate is resolved with real numbers — PASS (scale + formalize) or honest
  null (no lift claimed), never a faked lift.
- All five honesty labels remain on every rendered table.
