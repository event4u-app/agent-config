---
complexity: structural
status: ready
---

# Road to recursive self-verification — the one retraining-free Fugu mechanism, measured capability-axis-first

> **CLOSED — HONEST-NULL (2026-06-24).** Built + shipped behind a gate + measured.
> The ADR-106 gate was FALSIFIED on `claude-haiku-4-5` (`capH-debug` × 6 seeds, n=54):
> `D₂ − D₁` capability 87%→87% (p=1.0), discipline +0.009 (p=0.79). Recursion is
> **redundant with the always-on rules** — `verification.recursive` stays `off`. A blind
> human pre-test preferred recursion 4/4, but on too few/too-rare cases to register as a
> significant aggregate lift — exactly why ADR-106 required the benchmark. No model got
> "closer to Fable." Full record: `docs/benchmark.md` § Recursive self-verification.

> Sakana **Fugu** (2026-06-22) hits frontier numbers by **training** an
> orchestrator (Conductor = 7B RL model, arXiv:2512.04388; Trinity = ~0.6B
> *evolved* coordinator + 10K head, arXiv:2512.04695) over a **swappable pool**
> of frontier LLMs — including recursive calls to itself. None of the *learned*
> machinery is portable to a configuration package (no reward, no training loop,
> no GPU budget — and a hand-written tier map is exactly what the Conductor paper
> positions itself against). **Exactly one** Fugu mechanism is retraining-free and
> therefore portable: the **recursive self-call** — read your own prior output,
> decide whether it fell short, spin a corrective re-attempt, with depth as a
> test-time compute knob. This roadmap builds that as a depth-bounded skill on
> the primitives we already ship, and decides its value *honestly* on the
> existing A/B harness — **capability-axis first**, host-explicit, honest-null
> allowed.

## Goal

Answer, with evidence before building: **does a depth-bounded self-correction
loop move the *capability* axis** (the thing the package's discipline rules
provably do *not* move), and if so on which host — or is the honest result a
null, in which case nothing new ships. Ship the mechanism only if a capability
delta clears a council-locked gate at tolerable cost; otherwise keep it `off`
with a recorded null.

## Context

### What the user actually asked, and why the premise is already half-answered

The driving question was *"bring Sonnet (and others) closer to Fable 5 / Fugu."*
Translated, that is a **capability lift**. The package's **own** benchmark
already answers a large part of it (`docs/benchmark.md`, verbatim):

- **Capability axis is null:** pass-rate `100% → 100%`, **McNemar p=1.0, h=0.0**.
- **Discipline axis lifts — but weak-host-only:** `claude-haiku-4-5` mean
  discipline `0.333 → 1.000`, **Wilcoxon p=0.0005**, beats an equal-length
  inert-prose placebo (so it's the *content*, not prompt length).
- **Strong host has no headroom:** `claude-sonnet-4-6`, same tasks, 8 seeds →
  vanilla = package = placebo = `1.00`.
- The package's own honesty label: *"It improves **solution discipline**, not
  model intelligence"* and *"Not comparable to … **Fable scores** — a different
  question entirely."*
- Cost: ~**11×** tokens (`90,534 → 992,044` per run).

So the discipline-axis question is **settled** (weak-host-only) and a rule cannot
make Sonnet smarter. The **open, sharper** question recursion targets: does a
self-correction loop move the **capability axis**, and at what cost.

### Council synthesis (manual 2-member round, 2026-06-23)

Two independent external analyses (`agents/tmp/fable-fugo.txt`) were processed
through the `ai-council` convener-skeptic lens (convergence ≠ correctness; every
finding verdicted against repo evidence):

- **Converged:** Fugu is orchestration, not a better model; the package already
  has the *structural* primitives (`ai-council` pool, `subagent-orchestration`
  7 modes + Iron Law *judge ≠ implementer*, `model_tier`); do **not** rebuild
  Fugu; the portable lever is test-time orchestration, not the learned core.
- **Diverged & resolved:** Reviewer A's feature-rich path (`agent-pool.yml`,
  router-**learning** loop, "closer to Fable") was **rejected** — duplicates
  existing config, is falsified on the capability axis, and "learning without
  training" is the exact spin the package cuts. Reviewer B's **recursive
  self-verification, capability-axis-first, honest-null** path was **accepted**
  as the high-EV spine and is this roadmap.

### What we reuse (do NOT rebuild)

- `src/skills/subagent-orchestration/SKILL.md` — recursive verification is a
  **depth-bounded specialisation** of `do-and-judge` / two-stage, not a new
  engine. The Iron Law (no judge on the same model + context as the implementer)
  carries over.
- `verification-mechanics.md`, `verify-budget.md`, `rdp-gate.md` — the verdict
  surface + cost gate exist; recursion plugs the verdict back into a re-attempt
  and counts each loop against `verify-budget`.
- `src/scripts/_lib/orchestration_gate.ts` (`gateVerdict`,
  `resolveShippedDefault`) + `taskfiles/bench-ab.yml` + `docs/benchmark.md` — the
  gate plumbing and the paired McNemar/Wilcoxon A/B harness already exist (from
  [`road-to-auto-subagent-orchestration-followup.md`](road-to-auto-subagent-orchestration-followup.md)).
  The gate below reuses them verbatim.
- `src/skills/ai-council/SKILL.md` — only Phase 4 (cross-vendor critic) touches it.

### Explicit non-goals (the things we refuse to build or claim)

- **No claim that recursion "brings Sonnet closer to Fable 5."** The gate is
  structured to *disconfirm* it. Fugu's cross-frontier wins are model-of-models
  effects; Fable/Mythos are export-controlled and not in any pool we can call.
- **No `agent-pool.yml`** — `.ai-council.yml` members + `model_tier` (ADR-035)
  already are the pool. A thin pool config is reconsidered only if a harness ships.
- **No "router learning loop."** Reweighting without a training/reward loop is
  spin. A data-derived heuristic table is allowed only *after* the bench produces
  the data, and is named a heuristic, never "learned."
- **No generic Fugu harness / swappable-pool engine** (the Reviewer-A over-build).
  Narrow to recursion + reuse of existing primitives.

> Blocked until the user authorises the live `bench:ab:live` run (API spend).
> The cheap weak-host go/no-go probe (Phase 3a, ~2–3M tokens) is the only
> cost-bearing step that runs first and gates the rest.

## Prerequisites

- [x] Read `AGENTS.md`, `src/skills/subagent-orchestration/SKILL.md`, and the v2
      honesty labels in `docs/benchmark.md`.
- [x] Confirm `verify-budget` + `rdp-gate` + `subagents.*` settings are present
      (shipped via the auto-orchestration parent / ADR-105).

## Phase 0 — Council-lock the gate before any live spend

- [x] Run an `ai-council` round (deep tier) on the **gate definition only** — not
      the feature. The question: is *capability-axis-first with discipline-only →
      STOP* the right gate, or does a weak-host discipline lift that existing rules
      do **not** already deliver also justify shipping? Lock the answer so the live
      run does not relitigate the verdict.
      <!-- done: live council run --depth deep (3 rounds), $0.0762 actual -->
- [x] Record the convergence inline (members + date, no session-file link per
      `no-roadmap-references`) and capture the locked gate as an ADR under
      `docs/decisions/`.
      <!-- done: ADR-106-recursive-verification-benchmark-gate.md -->

> **Council convergence (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-06-23,
> deep tier, $0.0762).** Both members converged that **capability-only is the
> wrong gate** — it *assumes* recursion's discipline lift is redundant with the
> existing rules without measuring it. Locked gate (full reasoning + the host's
> rejection of one member's misread in
> [`ADR-106`](../../docs/decisions/ADR-106-recursive-verification-benchmark-gate.md)):
> **capability-axis lift OR a *measured* novel discipline lift (`D₂ − D₁`,
> recursion over rules-only) that clears a concrete cost ceiling and a human-
> preference bar**, decided per **(host, family)** cell. A cheap ~$15 human-
> preference pre-test gates the expensive arm.

## Phase 1 — Mechanism design (no API spend)

- [x] Author `src/skills/recursive-verification/SKILL.md` as a depth-bounded
      specialisation of `subagent-orchestration`'s `do-and-judge` mode (NOT a new
      engine). Loop: `attempt₀ → critic verdict → {accept | re-attempt₁ with the
      verdict as context} → … → depthₙ`. Each level reads only the prior attempt +
      the verdict — Fugu's "read your own output, decide whether to revise."
      <!-- done: src/skills/recursive-verification/SKILL.md authored; skill_linter PASS -->
- [x] `model_tier: inherit`. Where the loop crosses models the **Iron Law** holds
      (cross-model recursion is Phase 4). A same-model self-critique is allowed at
      depth 1 only when explicitly flagged as a *discipline* (not capability) pass —
      document the shared-blind-spot limit, do not hide it.
      <!-- done: Iron Law + same-model depth-1 discipline-pass caveat in skill body -->
- [x] Deterministic stop conditions: (a) critic returns `accept`; (b) `max_depth`
      reached; (c) `verify-budget` exhausted; (d) two consecutive attempts score
      identical (no-progress floor). Depth is the tunable compute knob.
      <!-- done: "Deterministic stop conditions" section in skill body -->
- [x] Settings key `verification.recursive: {off | ask | on}` +
      `verification.max_depth` (default `1` = inert single critic pass until the
      gate authorises more). Ships `off`.
      <!-- done: verification: block added to src/agent-src/templates/agent-settings.md -->

## Phase 2 — Integrate, don't reinvent (no API spend)

- [x] Route each re-attempt's cost through `verify-budget.md` as one budgeted unit.
      Surface depth + spend in one line under `auto: on`; ask once under `auto: ask`
      (reuse `auto-orchestration-activation.md`).
      <!-- done: contract authored in recursive-verification skill (stop conditions cite verify-budget; Procedure surfaces depth+spend) -->
- [x] Extend the deterministic `bench:ab` scorer to emit, per ADR-106, the **three
      baselines** (`D₀` bare = `vanilla` / `D₁` rules-only = `package` / `D₂`
      rules+recursion = a new `package-recursive` arm) + the novel discipline lift.
      The 3a benchmark ran on this arm → honest-null. The `--max-depth {0,1,2}` sweep
      flag is now moot (recursion adds nothing at depth 1; deeper would not help).
      <!-- substantially LANDED + tested (no spend): (1) recursiveNovelLift() (D₂−D₁ over package) + (2) the rendered COMPARISONS wiring in analyse() (arm-guarded → existing runs byte-identical, golden parity safe; py twin deleted → parity tests inert) in bench_ab_v2_stats.ts; (3) the package-recursive ARM EXECUTION — run_one_recursive() in bench_ab_v2_run.ts: depth-bounded attempt→critic→re-attempt loop, deterministic scorer-as-critic, injectable attemptFn seam, default arms UNCHANGED (opt-in via --arms package-recursive). 10 unit tests across both files PASS (vitest, no regression: 6 existing runner golden tests still green), tsc clean. REMAINING (live session): a --max-depth CLI flag for the {0,1,2} depth sweep (touches the parity-locked arg parser → wire where the behavioral tests are re-validated) + the harness human-preference hook (protocol fixture exists). The critic is the deterministic v2 scorer; a model/cross-vendor critic is Phase 4. -->
- [x] Wire the recursive `gateVerdict` (ADR-106 two-branch) analogous to the
      subagent default-flip (`resolveShippedDefault`): a passing gate is a one-line
      shipped-default edit, an honest-null is a no-op.
      <!-- done: recursiveGateVerdict + resolveRecursiveDefault in src/scripts/_lib/orchestration_gate.ts; 9 new tests PASS (vitest 15/15); tsc clean -->

## Phase 3 — Benchmark (host-explicit, capability axis first)

Mirrors the locked gate shape from
[`archive/road-to-discipline-axis-meso-pilot.md`](archive/road-to-discipline-axis-meso-pilot.md):
cheap weak-host probe first, strong-host slice second, cross-vendor last.

### Phase 3a-pre — human-preference pre-test (cheapest, runs FIRST, ~$15)

- [x] Per ADR-106: show ~10 `(attempt₀, attempt_final)` pairs from a recursion
      run to ≥3 humans and ask "which would you pay for?". **Preference < 60 %** →
      the discipline lift is economically irrelevant; the capability-only branch
      stands and the expensive discipline arm (the `D₁` baseline + 3b discipline
      read) is **skipped**. ≥ 60 % → run the full three-baseline probe below.
      <!-- DONE 2026-06-24: live pair-gen on claude-haiku-4-5, full 29-task corpus. Recursion FIRED on only 8/29 (~28%); 4 produced a differentiated output (trapD-destruct-01, capH-debug-01/05/08 — all capability/destructive tasks). Human-preference judging on the 4 blind A/B pairs → recursion output preferred 4/4 = 100% > 60% → GATE PASS, proceed to three-baseline benchmark. CAVEAT: N=4 pairs is thin; fire-rate low (rules already pass the first attempt on 72%). Artefacts (local, uncommitted): internal/bench/recursive-verification/{pairs.json,judging-form.md,judging-key.json}. -->

### Phase 3a — weak-host go/no-go probe (three baselines, gated on 3a-pre)

- [x] On `claude-haiku-4-5`: `capH-debug` archetype × 3 arms (vanilla/package/
      package-recursive) × 6 seeds × paired (n=54). Measured `D₁` (package = rules)
      vs `D₂` (package-recursive) → the **novel discipline lift `D₂ − D₁`**.
      <!-- DONE 2026-06-24 live (report 2026-06-24T04-45-01Z): D₂−D₁ capability 87%→87% McNemar p=1.0; discipline 0.852→0.861 Δ=+0.009 Wilcoxon p=0.79 n≠0=3. -->
- [x] Read against the locked two-branch gate → **third branch: capability flat AND
      `D₂ − D₁` not significant (recursion adds nothing over the rules) → STOP,
      HONEST-NULL, keep `off`.** This is the outcome. Recorded in `docs/benchmark.md`.
      <!-- GATE FALSIFIED: cap_sig=False, dis_sig=False. Recursion is redundant with the always-on rules — exactly ADR-106's hypothesis. -->

### Phase 3b — strong-host slice (gated on 3a passing)

- [-] On `claude-sonnet-4-6`: strong-host slice. <!-- cancelled: gated on 3a passing; 3a falsified on the weak host (where recursion COULD help). A strong host with no discipline headroom certainly shows no D₂−D₁ lift — running it would only confirm the null at higher cost. -->
- [-] Read the strong-host result against the prior. <!-- cancelled with the step above. -->

### Gate (council-locked in Phase 0 — see ADR-106)

A **(host, family)** cell ships `on`/`ask` **iff**:

```
capability_lift significant   (McNemar on pass-rate, or scorer Wilcoxon p < 0.05,
                               ≥6 discordant pairs (n≠0 ≥ 6), effect ≥ 0.5)
OR
( novel_discipline_lift = D₂ − D₁ > ε_disc    (recursion over rules-only, MEASURED)
  AND cost_per_task ≤ ceiling                  (concrete token-multiplier / $)
  AND human_preference_rate > 0.6 )            (the Phase 3a-pre test)
ELSE off.
```

- **Capability-only is *not* the gate** (ADR-106): it assumed, without measuring,
  that recursion's discipline lift is redundant with the rules. The `D₁`
  (rules-only) baseline makes redundancy a measured fact.
- **Per-(host, family) cell** set independently — a weak host may ship `on` while
  a strong host (no headroom) ships `off`; no global flip without its own cell.
- **Honest-null is first-class** — capability flat AND (human-preference < 60 %
  OR `D₂ − D₁ ≤ ε` OR cost over ceiling) → ship nothing, record the null in
  `docs/benchmark.md`, like the Phase-4 micro honest-null that spawned the meso pilot.

## Phase 4 — cross-vendor recursive pool (most expensive, gated last)

- [-] Cross-vendor critic inside the recursion. <!-- cancelled: gated on Phase 3 passing, which it did not. A model/cross-vendor critic might fire more often than the deterministic scorer-as-critic — the one un-explored lever — but pursuing it is a new design (more spend) and out of scope for this honest-null closure. Captured for a future roadmap if revisited. -->
- [-] Iron Law / net-value gate for the cross-vendor critic. <!-- cancelled with the step above. -->

## Deferred (auditable-orchestration differentiator — reconsider after Phase 3)

- [-] `orchestration-plan.json` + replayable `orchestration-trace.jsonl`. <!-- cancelled: this was "reconsider after Phase 3"; Phase 3 closed honest-null (no recursion harness ships), so the trace has nothing to wrap. A genuinely good idea — re-open in its own roadmap if any orchestration harness is ever built. -->
- [-] Measured task→tier classifier (Reviewer B's low-EV #3). <!-- cancelled: explicitly low-EV, gated on data this null does not produce. Re-open if a future orchestration effort generates labelled dispatch decisions. -->

## Acceptance Criteria

- [x] A council ADR records the locked gate definition (Phase 0). <!-- ADR-106 -->
- [x] `src/skills/recursive-verification/SKILL.md` exists — depth-bounded,
      budget-gated, Iron-Law-compatible, default `off`. <!-- merged #648 -->
- [x] The `bench:ab` scorer emits the recursion novel-lift (`D₂ − D₁`). <!-- recursiveNovelLift + analyse() wiring, #648/#649 -->
- [x] A reproducible benchmark report exists in `docs/benchmark.md` (arms, host,
      capability + discipline + cost axes, verdict). <!-- "Recursive self-verification (ADR-106) — HONEST-NULL" section -->
- [x] The shipped `verification.recursive` default reflects the gate verdict —
      `off` (gate FALSIFIED), honest-null recorded. <!-- resolveRecursiveDefault returns off on fail; no flip -->
- [x] Docs state plainly that this transfers a test-time compute pattern, not model
      intelligence, and that no Fable/Mythos comparison is implied. <!-- benchmark.md verdict line -->
- [x] No locked decision (measure-first, no-runtime, no-training, token budget) is
      relitigated or violated.
- [x] All quality gates pass — touched surfaces verified (vitest, `npm run typecheck`,
      skill-lint, marketplace, discovery, condense-sync); full `task ci` is the PR gate.
