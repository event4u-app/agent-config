---
complexity: structural
status: ready
parent_roadmap: road-to-discipline-axis-benchmark
---

> Blocked until a maintainer allocates the pilot budget. The weak-host go/no-go
> (Phase 2a) is cheap (~2-3M tokens) and gates the larger strong-host
> stratification (Phase 2b) — do not spend the large envelope before 2a reads.
> Spawned from `road-to-discipline-axis-benchmark` (Phase 4 honest-null at micro
> scale).

# Roadmap: discipline-axis benchmark — complexity-stratified pilot (meso/multi + weak host)

The v2 discipline-axis apparatus is built and validated (corpus, dual-axis
deterministic scorer, 4-arm runner, paired McNemar/Wilcoxon stats, honest
two-table render). The **micro** pilot returned an honest **null**: bare
`claude-sonnet-4-6` is already disciplined on tiny fixtures (vanilla discipline
≈ 1.0), so there is no headroom for the package to lift.

Per the original **2026-06-14 council** (claude-sonnet-4-5 + gpt-4o, 2 rounds),
the micro-null is NOT a full falsification — the discipline axis must be tested
at **realistic complexity** before concluding. A second **2026-06-14 council**
(claude-sonnet-4-5 + gpt-4o, 2 peer-reviewed rounds) reviewed the weak-host-first
revision below: both members converged to **adopt** the weak-host probe, cost
table, and discordant-pair power fix, and surfaced one correction now folded in —
the micro-null is a *floor* test, not a *ceiling* test, so the strong-host meso
arm must still run (it tests a distinct branch), not be killed outright.

> **Why this revision (2026-06-14):** headroom has **two** levers — task
> complexity AND host weakness. The package's own value proposition
> (`frontier-reasoning-operating-profile.md`, line 132) locates the lift in **host
> weakness**: a strong-reasoning host applies the discipline "light / off" because
> "over-scaffolding degrades + wastes tokens" ([pf], the gating foundation); a
> standard/weak host applies it fully. The micro pilot fixed the host at
> **strong** (`sonnet-4-6`) and varied only complexity — i.e. it searched for
> headroom on the lever the theory does NOT emphasize, on the host where the
> theory predicts the *least* effect. Its null is therefore consistent with our
> own design, not decisive evidence about the claim. This revision makes **host a
> first-class factor** and tests the weak host first, because that is the actual
> claim and the cheaper decisive cut.
>
> **The floor-vs-ceiling correction (2026-06-14 council):** the micro-null does
> NOT falsify "complexity opens headroom on a strong host". `L132` describes a
> *dynamic* gate — a strong host self-applies discipline light/off on trivial
> tasks (the micro case, tested) but FULL when complexity crosses a threshold (the
> meso/multi case, NOT tested). So the strong-host meso slice is a distinct branch
> that must still run before any full-falsification, not an optional afterthought.

## Goal

Decide the v2 gate honestly. Two questions, host-explicit:

1. **Primary (the claim):** on a deliberately **weak host**, does discipline
   headroom appear (vanilla discipline drops below the saturation floor), and if
   so does the package — and RDP specifically — lift it?
2. **Secondary (the dynamic-gate threshold):** on the **strong host**
   (`sonnet-4-6`), does *complexity* cross the threshold where even a capable host
   benefits from the discipline, or does discipline saturate across all scales?

Either a lift appears in some (host × scale) cell, or discipline saturates
everywhere and we keep the apparatus and **claim no lift** — on either host.

## Gate (council-locked, host-explicit)

- **FALSIFY (honest null, keep apparatus, claim no lift):** vanilla discipline
  ≥ 0.85 on ≥ 70% of pairs at **all three** scales **on BOTH the strong and the
  weak host** — AND the strong-host meso slice (Phase 2b) confirms no
  threshold-crossing branch. Saturation on the strong host *alone* is NOT
  falsification; saturation on a weak host while skipping the strong-host meso
  slice is NOT falsification either (the floor-vs-ceiling correction).
- **PASS (scale to a headline N at the winning cell):** a headroom cell exists
  (vanilla discipline < the floor) **AND** package > vanilla there — McNemar or
  Wilcoxon p < 0.05 with **≥ 6 discordant pairs** (n≠0 ≥ 6, not merely total
  n ≥ 6) and effect size ≥ 0.5. If the only headroom cell is on the weak host,
  the claim **narrows explicitly to "lift on weaker hosts"** — never frontier.
- **Cost is part of the verdict (L10):** report the per-arm token/$ delta
  alongside any lift. A discipline gain that costs more tokens than it returns in
  value is not a PASS for the default-on decision; it is at most a per-component
  opt-in.
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

## Phase 1b — Pick and pin the weak host

- [ ] Select a deliberately weaker host where discipline headroom is larger.
      Default: `claude-haiku-4-5` — keeps provider/tokenizer constant vs the
      `sonnet-4-6` strong arm, so the only varied factor is capability (clean
      mechanism isolation). Document the single-vendor limitation explicitly: this
      tests the RDP *mechanism*, not cross-vendor generalization (that is Phase 2d,
      and only if the mechanism reads positive).
- [ ] Record the host-pin and rationale next to the seeds, same as the strong
      arm. Host is now a logged factor in every report row.

## Phase 2a — Weak-host go/no-go probe (cheap, runs FIRST)

> The decisive, cheap cut: does the actual claim have any signal at all?

- [ ] Run **2 archetypes × {micro, meso} × 3 seeds × 4 arms** on the **weak
      host** at `--budget 3.5`, error-aware (~2-3M tokens). Skip multi-file here —
      this is a probe, not the headline.
- [ ] Read the per-cell paired stats. Decision:
      - **Headroom + package lift on the weak host** → proceed to Phase 2b to map
        the gradient and locate the winning cell, then Phase 2d + Phase 3 PASS.
      - **Headroom but NO package lift** (vanilla drops, package doesn't recover
        it) → strong signal the discipline transplant does not work even where
        there is room; render the null and stop before the large strong-host
        spend. The strong-host arm will not rescue this branch.
      - **No headroom even on the weak host** (vanilla still ≈ saturated) → do NOT
        declare full-falsification yet. Run the Phase 2b strong-host **meso
        slice** (the threshold-crossing branch) before concluding — the micro-null
        was a floor test, not a ceiling test.

## Phase 2b — Strong-host stratification (threshold-crossing branch)

- [ ] Run the strong-host **meso** slice on `sonnet-4-6` (2 archetypes × 3 seeds
      × 4 arms, a few M tokens), error-aware. This tests the secondary question —
      does complexity cross the dynamic-gate threshold on a strong host — and is
      owed **regardless** of the weak-host result that is not an outright "no
      lift" (per the floor-vs-ceiling correction).
- [ ] **Only** if 2a OR the meso slice shows headroom worth mapping: extend to
      the full **micro/meso/multi × 3 seeds × 4 arms** envelope (~48-72 runs,
      ~17M tokens) to map the gradient and cross-host comparison. Record host +
      config + seeds.
- [ ] Compute the per-scale paired stats (`bench_ab_v2_stats.py`) and apply the
      gate.

## Phase 2c — Cost axis in the render (third table)

- [ ] Extend `bench_ab_v2_stats.py --markdown` to emit **Table 3 — cost axis**
      per comparison: input/output tokens and $ per arm, and Δ vs baseline.
- [ ] **Validate the cost-attribution assumption** before trusting it: the
      `placebo` arm isolates prose *length*, so package-vs-placebo is the wrapper
      *content* tax — but confirm the placebo's token profile actually matches the
      package's prose volume per cell (council caveat: do not assume a uniform
      wrapper tax across contexts; spot-check ≥1 cell).
- [ ] Re-render `docs/benchmark.md` so every comparison shows capability +
      discipline + **cost**. The maintainer tier-gate decision reads the cost
      delta, not discipline alone.

## Phase 2d — Cross-provider generalization (gated, lightweight)

- [ ] **Only if Phase 2a shows weak-host lift:** run a lightweight cross-provider
      validation (e.g. `gpt-4o-mini` or a small Gemini model, ~500k tokens, the
      winning cell only) to test whether the lift is an RDP-mechanism effect or a
      Claude-family artifact. A positive single-vendor result that does not
      replicate cross-provider narrows the claim to "Claude weak hosts".
- [ ] Log the cross-provider tokenizer/cost variance separately — it confounds the
      Phase 2c cost delta and must not be merged into the same-vendor numbers.

## Phase 3 — Resolve the gate

- [ ] **PASS →** scale to a headline N at the winning (host × scale) cell, sized
      by **discordant-pair count** not total N; render the three-table report;
      formalize `docs/contracts/benchmark-*.md` + the v2 corpus linter (deferred
      from the parent Phase 6). State the host scope of the claim plainly.
- [ ] **FALSIFY →** render the honest null across all scales **and both hosts**
      (including the strong-host meso slice); document that the package's
      discipline is not measurable at this scale on either host; keep the
      apparatus for future use.

## Acceptance criteria

- A clean stratified read (no budget truncation) with **host as a logged
  factor** — weak-host probe (2a) completed before any large strong-host spend.
- Every comparison renders **three** tables: capability, discipline, and cost
  (token/$ delta vs baseline), with the cost-attribution assumption spot-checked.
- The gate is resolved with real numbers and **explicit host scope** — PASS
  (scale + formalize, claim scoped to the winning host) or honest null (no lift
  claimed, on either host, strong-host meso slice included), never a faked lift.
- Significance claims rest on **≥ 6 discordant pairs**, not total N; any
  underpowered cell is labeled directional, not null.
- All five honesty labels remain on every rendered table.
