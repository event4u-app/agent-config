# Cache-injection anatomy — the Phase-1 spike note (road-to-token-economy-cache)

> Published 2026-08-10 (roadmap step 1.3). Method: `cache_realization_report`
> re-run on the post-9.29 tree (host CC 2.1.226, 14-day ledger window,
> message.id+requestId dedupe) + the deterministic per-slot injection bench
> (`bench_hook_injection`, committed fixtures). Every later phase of the
> roadmap cites these numbers or does not ship.

## 1. Aggregate cache behaviour (step 1.1 — re-measured baseline)

| bucket | calls | read share | weighted input units |
|---|---|---|---|
| main session | 29,828 | **98.8%** | 1.88B |
| subagent legs | 18,146 | **97.3%** | 0.69B |

Subagent cold start: 558 legs, median **237,350** written-or-uncached tokens,
first-call read share 3.3%, cold-start share of subagent write volume 63.9%.
Claims: C-1 confirmed (63.9% ≥ 50%), C-2 confirmed (41.1% ≥ 25%),
C-5 falsified again (87.4%). Baseline for `prefix_stability`
(step 2.4): the read shares above.

## 2. Per-slot injection attribution (step 1.2)

Deterministic bench over every concern bound on `claude`, committed fixture
envelope per slot (48 concern-slot pairs; conditional-silence concerns emit
nothing under a generic fixture — the live distribution is the census mode's
job, blocker `repeat-injection-census`):

| slot | concern | bytes/fire |
|---|---|---|
| session_start | session-canary | 922 |
| session_start | council-availability | 680 |
| user_prompt_submit | session-canary | 922 |
| stop | end-review-nudge | 218 |
| **slot sums** | session_start 1,602 · user_prompt_submit 922 · stop 218 | |

**Placement.** Hook injections ride the MESSAGE SUFFIX, not the cached
prefix: `user_prompt_submit` additional_context lands inside the user
message, `session_start` context lands once at conversation start, and the
measured turn-over-turn read share (98.8%) is only possible if turn N+1
re-READS the accumulated context rather than re-writing it. There is no
evidence of any slot invalidating the prefix wholesale.

## 3. The arithmetic (step 1.3)

At the measured ~237k-token context size, a CACHE-MISS turn re-writes the
context at 1.25×/2× write weight (≈297k–475k cost units) where a HIT turn
re-reads it at 0.1× (≈23.7k units) — a **12–20× per-turn difference**. The
measured miss rate is ~1.2% (main). The injections' own cost is bounded by
the registered budget (`src/config/hook-token-budget.json`): worst measured
slot sum 1,602 B ≈ ~400 tokens, i.e. ~0.2% of one turn's read cost.

## 4. Honest-null consequence (step 1.4 — INVOKED)

The pre-registered null condition holds: injections demonstrably land
post-prefix AND the hit ratio is already high (≥97.3% everywhere). Per the
roadmap's own clause, **Phase 2 downgrades to the hygiene lint (2.2)**;
the ordering doctrine (2.1) documents the host-fixed constraint instead of
fighting it. Published here per 1.4; `docs/benchmark.md` carries the
one-line pointer.

## 5. Build-determinism — already guaranteed (step 2.3 verdict)

The always-loaded layer's build determinism needs no new gate: the `.md`
projection is byte-exact by contract (`check_condensation` asserts
`dist == rewrite(src)`, ADR-201 — a pure function of the tree), the router
is order-deterministic under `compile_router --check`, and the kernel prefix
carries its own drift guard (`check_kernel_prefix_stability`). The remaining
volatile-marker surface (machine-local paths, run-id shapes inside the
always-loaded layer) is `check_static_layer_stability` (2.2).

## Registered metric — `prefix_stability` (step 2.4)

- **Definition:** cache-read share per bucket from `cache_realization_report`
  (sampled re-runs, not per-turn overhead).
- **Baseline (2026-08-10):** main 98.8% · subagent 97.3%.
- **Target:** sustained ≥ 95% on both buckets.
- **Owner:** maintainer · **Review by:** 2026-11-10.
- **Re-verification:** `./scripts-run src/scripts/cache_realization_report`.
- A sustained drop below target is the signal that something started
  invalidating the prefix — the investigation reopens Phase 2's full scope
  by evidence, never by feel.
