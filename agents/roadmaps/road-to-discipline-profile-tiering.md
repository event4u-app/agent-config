---
complexity: lightweight
---

# Road to discipline-profile tiering — the ~3x lift as the default shape, host-gated

> Implement the 2026-07-07 council verdict
> (`agents/settings/contexts/weak-host-lift-tiering-verdict.md`): a
> `discipline_profile` tier enum whose `essential` tier delivers the measured
> weak-host discipline lift at ~3.3x cost instead of the full ~11.7x load,
> auto-disabled on hosts with a measured NULL lift, multi-vendor by
> construction — every default flip evidence-gated.

## Goal

Ship `discipline_profile: auto | off | essential | full` so consumers get the
lift-carrying rule set (~3.3x, lift +0.458 measured) instead of the full load
(~11.7x, residual over essential not significant) by default on weak hosts, and
no lift layer at all on measured-ceiling hosts — without flipping any shipped
default before the evidence gates pass.

## Context (measured, do not relitigate)

- Cost-factor sweep (`docs/benchmark.md § Cost-factor sweep`, report
  `2026-07-07T05-35-14Z`, Haiku, n=24 pairs/arm): kernel+`downstream-changes`
  = 3.3x cost, lift +0.458 (p=0.0135); full package = 11.7x, residual over
  kernel-dc p=0.37 (n.s.); shipped `balanced` router profile = 2.9x, lift NULL
  (p=0.81 — lacks `downstream-changes`, tier_2).
- Strong host (`claude-sonnet-4-6`, full corpus, n=84) = HONEST NULL — the
  only measured entry for the disable-list today.
- Council verdict locks: tier enum named by function (`essential`, not
  size-names); `balanced` as cut today is dead; host gating = evidence-gated
  NULL-lift disable-list only (NO speculative strong/weak model taxonomy);
  `full` = experimental opt-in until its own gate passes; thin projector is a
  COMPETING mechanism for this layer (lift under thin projection unmeasured)
  — coordinate, don't compose.
- Existing surfaces: `dist/router.json` profiles (`minimal|balanced|full`),
  bench arms `rules-kernel-dc`/`rules-balanced` (opt-in in
  `src/scripts/bench_ab_v2_run.ts`), `.agent-settings.yml` template at
  `src/config/agent-settings.template.yml`, kernel-prefix stability gate
  (`check_kernel_prefix_stability.ts`).
- Supersedes/absorbs the `road-to-token-saving.md` Phase 10 backlog item
  "tier-conditional discipline-rule loading" (promoted here 2026-07-07).

## Prerequisites

- [x] Council verdict recorded (`weak-host-lift-tiering-verdict.md`).
- [x] Benchmark section + pinned report on the cost-factor sweep
      (`docs/benchmark.md`).

## Phase 1 — Tier mechanism, built inert (no default change)

- [x] Add `discipline_profile: auto | off | essential | full` to
      `src/config/agent-settings.template.yml`, documented with the measured
      cost/lift numbers per tier. Shipped default in this phase: the value
      that preserves today's behaviour (`full` / legacy-all) — the flip to
      `auto` is Phase 4, evidence-gated.
- [x] Add `src/config/host-capabilities.yml`: `lift_disabled_models` with the
      ONE measured entry (`claude-sonnet-4-6` — 2026-07-05 report, n=84, full
      corpus) + `unknown_default: lift_enabled`. Schema comment: entries
      require a measurement citation (date · report · N) or an explicit
      `extrapolated: true` maintainer flag; speculative vendor taxonomies are
      forbidden (council lock).
- [x] Define the `essential` tier in the router/profile layer: kernel +
      lift-carrying rules (`downstream-changes`; `scope-control` already
      kernel). Compile it into `dist/router.json` profiles alongside
      `minimal`/`full`. Verify with a `compile_router --check` run and a unit
      test asserting the essential rule set.
- [x] Design decision (small ADR): WHERE `auto` resolves.
      <!-- done 2026-07-07: ADR-110-discipline-profile-resolution-locus — runtime
      agent-in-the-loop resolution (resolve_discipline_profile in the work-engine
      settings lib); projection unchanged until thin un-defers (ADR-040 kept). --> Projection is
      static per project; the host model is a runtime fact. Candidates:
      (a) runtime resolution — a kernel-level instruction/rule that reads
      `host-capabilities.yml` against the session model id;
      (b) per-tool projection variants; (c) hook-based. Record the choice as
      an ADR (adr-create), including how non-Claude hosts expose their model
      id per tool.
- [x] Wire the chosen resolution: `auto` → `off` when the session model
      matches `lift_disabled_models`, else → `essential`. Unit tests: known
      NULL model → off; unknown model → essential; explicit setting overrides
      auto.

**Exit:** setting + capabilities file + essential profile exist and are
covered by tests; shipped behaviour unchanged (default still full surface).
**Rollback:** remove the key + yml; router profiles revert on recompile.

## Phase 2 — Retire the measured-dead `balanced` cut

- [ ] Inventory every consumer of the `balanced` profile name: rule bodies
      ("activates this routing under the `balanced` and `full` profiles"),
      `dist/router.json` profile map, docs/contracts (`rule-router.md`),
      linters. Targeted greps, list in an inline note.
- [ ] Replace the shipped `balanced` profile with the function-named tiers
      (council: delete, don't rename — `essential` is not a re-badged
      balanced, it is a different cut). Migrate the rule-body boilerplate and
      contract text; regenerate router + condensation + per-tool projections
      via `task sync` + `task generate-tools`.
- [ ] Update `docs/contracts/rule-router.md` + `docs/CLAIMS.md` non-claim:
      "balanced profile removed after NULL-lift measurement (p=0.81, n=24,
      Haiku 4-5, 2026-07-07)."

**Exit:** no artifact references a `balanced` profile; router compiles with
`minimal | essential | full`; targeted lints green
(`lint-rule-tiers`, `check-router`, condensation hashes).
**Rollback:** git revert; profiles are compile-time only.

## Phase 3 — Evidence gate P1: essential on the full corpus (weak host)

Blocks any default flip. Operator/cost-gated (live API spend).

- [ ] Run the full trap corpus (all archetypes, ~29 tasks) × ≥3 seeds ×
      arms `vanilla,rules-kernel-dc` on `claude-haiku-4-5` (n≥84 pairs;
      estimated ~$40–60). Command shape:
      `npx tsx src/scripts/bench_ab_v2_run.ts --arms vanilla,rules-kernel-dc
      --seeds 3 --model claude-haiku-4-5 --budget 3.5`.
- [ ] Stats via `bench_ab_v2_stats.ts`; decision rule: significant discipline
      lift (p<0.05) beyond the scope/downstream family → PASS; no lift outside
      that family → `essential` stays honest-scoped to the measured family and
      the Phase-4 default flip is re-cut accordingly.
- [ ] Pin the report in `docs/benchmark.md` (extend the cost-factor-sweep
      section) and update the CLAIMS ledger entry for the essential tier.

**Exit:** pinned full-corpus report + updated claim; PASS/FAIL recorded.
**Rollback:** none — measurement only.

## Phase 4 — Evidence gate P2 + default flip

- [ ] Extend the bench harness to ≥1 non-Claude weak host (e.g.
      gpt-4o-mini / gemini-flash class): the runner currently drives the
      `claude` CLI only — add an adapter (alternate agent CLI or API loop)
      that honours the same paired design + deterministic scorer. Design
      first, then build; operator gate on vendor API keys + spend.
- [ ] Replicate the Phase-3 sweep on that host. Lift replicates → default
      `discipline_profile: auto`; fails → default `off` (explicit opt-in to
      `essential`), per the council rule.
- [ ] Flip the shipped default accordingly (kernel-prefix stability gate:
      re-anchor `--update-baseline` in the same PR if the always-loaded
      prefix changes); update `docs/benchmark.md`, `docs/CLAIMS.md`
      (`discipline-lift-weak-host` claim scope), README settings docs, and
      the proof page.

**Exit:** shipped default is evidence-backed (`auto` or `off`), documented on
the benchmark + claims pages with per-host results.
**Rollback:** revert the default to `full` (one settings-template line).

## Phase 5 — Full-tier disposition (open-source hypothesis, gated)

`full` stays EXPERIMENTAL opt-in, labeled "residual lift over essential not
established (p=0.37, n=24, Haiku 4-5)".

- [ ] Graduation gate (only if an open-source-host adapter from Phase 4
      exists and the maintainer wants the answer): full sweep on ≥2 weak
      hosts incl. one open-source model; requires significant residual over
      `essential` (p<0.05, Δ>0.1) on tasks where essential does not ceiling.
      Until run: `full` keeps the experimental label everywhere it is
      documented.
- [ ] If the gate FAILS or is not pursued within a cycle: council follow-up
      on whether `full` is dropped from the enum entirely (gpt-4o's round-2
      dissent position).

**Exit:** `full` is either graduated (evidence), still-labeled experimental,
or scheduled for removal — never an unlabeled recommendation.
**Rollback:** none — disposition only.

## Acceptance criteria

- `discipline_profile` enum + `host-capabilities.yml` shipped, tests green;
  no speculative model taxonomy anywhere.
- `balanced` profile gone from every artifact; router compiles
  `minimal | essential | full`.
- No shipped default flipped without its evidence gate (P1 for the tier, P2
  for `auto`); every measurement pinned in `docs/benchmark.md` + CLAIMS.
- Thin-projector coordination honoured: no thin projection of the essential
  tier without a re-sweep (competing mechanism, council lock).

## Blockers

### blocker: p1-full-corpus-sweep
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 (and thereby the Phase 4 default flip)
- **What to do:** authorize the live Haiku sweep (~$40–60, ~2–4h wall time),
  then run the Phase 3 command and stats.
- **Resolved when:** a pinned full-corpus `rules-kernel-dc` report exists
  under `internal/bench/reports/ab-v2/` and is cited in `docs/benchmark.md`.

### blocker: non-claude-host-adapter
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 4 (P2 replication), Phase 5
- **What to do:** decide the adapter shape (alternate agent CLI vs API loop)
  and provide vendor API keys/budget for the replication run.
- **Resolved when:** the harness completes a paired vanilla-vs-essential run
  on a non-Claude host with the deterministic scorer.
