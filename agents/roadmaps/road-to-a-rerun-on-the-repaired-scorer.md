---
complexity: lightweight
review_by: 2026-12-15
tree_pin: 9ed90dbe85
estate_growth_exempt: "Owner-invoked /roadmap:process-full on 2026-11-04 promotes this stub and closes and archives it in the same PR, so the active estate is back at its origin/main floor once it lands."
---

# Road to a rerun on the repaired scorer

> Created by round `inbox-2026-11-bn` (2026-11-04); promoted from `stubs/`
> the same day.
> **Source:** `agents/tmp.old/inbox-2026-11-bn/` — owner chat: rerun the
> benchmarks on the current tree, then write the next improvement roadmaps
> from what the rerun shows.
> **Owner cap (OQ-64, answered 2026-11-04):** $100 total for the paid sweeps,
> enforced per sweep with `--max-usd`. The earlier $150 S4 grant and $250
> bench grant do not carry over; the powered comparison is not covered.

## Why

Every published ab-v2 headline (`docs/benchmark.md` weak host, strong host,
cost-factor sweep) was scored before the 2026-10-28 oracle repair and is not
re-scored. The pinned reports keep scores only, no per-run diff, so the only
way to a post-repair number is a new paid run.

## Spend plan — $100, two sweeps

| Sweep | Host | Tasks × arms × seeds | Cap |
|---|---|---|---|
| Weak host + cost factor + profiles | `claude-haiku-4-5` | 2 × 7 × 12 = 168 | $25 |
| Strong host | `claude-sonnet-4-6` | 30 × 2 × 3 = 180 | $75 |

The weak-host (2026-06-15) and cost-factor (2026-07-07) studies ran the same
two tasks, host and seeds, so one sweep carries both studies' arms. The
`package` arm is the operator's installed plugin, as in the originals. If
the weak sweep's measured per-run cost projects the strong sweep past its cap,
the strong sweep runs at fewer seeds rather than past the cap, and the report
says so.

## Phase 1 — Harness ready, no spend

- [x] **1.1 A sweep cap that prices the served model.** The cap priced <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/price_freshness.ts -->
      `claude-haiku-4-5` with the 2026-05-14 `haiku` family row at a quarter
      of its rate (input $0.25 vs $1, cache read $0.03 vs $0.10), so a "$100"
      cap admitted roughly $330 of real spend. `bench_ab_v2_run` now prices
      through `sweepRates` (`_lib/price_freshness.ts`), which refuses a stale or
      unvouched row; `internal/bench/pricing.yaml` carries rows for
      `claude-haiku-4-5` and `claude-sonnet-4-6`, read 2026-11-04 from the
      published pricing page.
      verify: `npx vitest run tests/scripts/bench_ab_v2_run.test.ts -t "stale family row"` -> /passed/ (red on the old runner, shown before the fix landed).
- [x] **1.2 Profile arms.** On Claude nothing reads `discipline_profile` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/bench_ab_arms.ts -->
      at runtime: `resolve_discipline_profile` has no caller outside its own
      definition, and the installer uses the profile only to render the
      settings file. An installed-profile arm would therefore equal `package`.
      `profile-minimal` / `profile-essential` / `profile-full` instead inject
      the rule set each profile names in `dist/router.json` `profiles`
      (`profile_rules_text`, `_lib/bench_ab_arms.ts`). `profile-essential` is
      byte-identical to `rules-kernel-dc` and is not run twice.
      verify: `npx vitest run tests/scripts/bench_ab_profile_arms.test.ts` -> /passed/
- [x] **1.3 Selftest across the sweep's arms.** No network, no spend; every
      arm carries its expected injection (`profile-full` ≈ 119k tokens).
      verify: `./scripts-run src/scripts/bench_ab_v2_run --mode selftest --arms vanilla,package,placebo,rules-kernel-dc,rules-balanced,profile-minimal,profile-full --seeds 1 --tasks trapE-scope-01 --model claude-haiku-4-5 --max-usd 25 --no-checkpoint` -> /SELFTEST/

## Phase 2 — The paid sweeps

- [ ] **2.1 Weak host, cost factor and profiles.** `--arms
      vanilla,package,placebo,rules-kernel-dc,rules-balanced,profile-minimal,profile-full
      --tasks trapE-scope-01,trapE-scope-02 --seeds 12 --model claude-haiku-4-5
      --budget 3.5 --max-usd 25`. Record the sweep spend and the mean cost per
      arm-run.
- [ ] **2.2 Strong host.** All 30 corpus tasks, `--arms vanilla,package
      --seeds 3 --model claude-sonnet-4-6 --budget 5 --max-usd 75`, seeds
      lowered only if 2.1's per-run cost projects past the cap.

## Phase 3 — Report and residue

- [ ] **3.1 Post-repair sections in `docs/benchmark.md`.** New sections beside
      the pre-repair ones, never replacing them; each names its run id, scorer
      epoch, host, seeds and spend. `docs/CLAIMS.md` rows backed by the old
      numbers gain the post-repair figure or are narrowed to it.
- [ ] **3.2 Residue roadmaps.** One `road-to-<observed-failure>` per failure
      cluster with task ids and a reproducing artifact (the preserved
      `final_files`); nothing from a score delta alone. Already known before
      the sweeps: the discipline profile is inert on Claude while the settings
      text promises a smaller rule set.

## Risk Register

<!-- risk-review: v1 | reviewed: 2026-11-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Spend overruns the cap | product | A sweep at the original seed counts costs more than the owner granted | `--max-usd` per sweep on a fresh per-model price row (1.1); the two caps sum to $100 | Phase 2 |
| 2 | The rerun reads as a correction of the old numbers | product | A new number beside an old one invites subtraction | Old and new never share a run id; pre-repair rows stay with their label | Phase 3 |
| 3 | A residue cluster becomes a roadmap without a case | implementation | Step 3.2 could turn a score delta into a plan | Each cluster needs task ids and a reproducing artifact; a delta alone writes no file | Phase 3 |
| 4 | Profile arms read as installed-profile results | product | An injected rule set is not what a consumer's install loads | The arms are named and documented as the rule set a profile names; the inert setting is its own finding | Phase 1 |

## Non-goals

The comparison against vanilla, a short instruction file and neighbour
packages with adequate power belongs to `road-to-assurance-benchmark`; this
roadmap re-measures what is already published.
