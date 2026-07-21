# Discipline-Axis Wrapper-Lift Benchmark (v2)

> **Curated composite of two pinned reports** — the weak-host result and the
> strong-host result side by side. It is deliberately NOT auto-generated from the
> single latest `ab-v2` report: a single-report render would bury one host's
> finding (a strong-host null would erase the weak-host lift, and vice versa).
> Regenerate the pinned sections with `task bench:ab:v2:diff` — each
> `<!-- pinned:<id> -->` region renders from ITS pinned report
> (`docs/benchmark.pinned.yml`); curated prose outside the markers is
> never touched (`-- --check` is the drift gate). Pinned sources:
> weak host = `internal/bench/reports/ab-v2/2026-06-15T03-52-35Z-ab-v2-paired.json`;
> strong host = `internal/bench/reports/ab-v2/2026-07-05T07-00-31Z-ab-v2-paired.json`;
> cost-factor sweep = `internal/bench/reports/ab-v2/2026-07-07T05-35-14Z-ab-v2-paired.json`.

## Honesty labels (read first)

<!-- pinned:honesty -->
> 1. **Wrapper-lift on a fixed host (`claude-haiku-4-5`), NOT model-vs-model.** Measures what the agent-config package does to ONE host model on a neutral fixture — not a capability ranking.
> 2. **Discipline axis, not capability.** The headline is the *discipline* delta (did it stay minimal / verify / ask / not destroy / update downstream), not whether the goal was achievable.
> 3. **PILOT — low statistical power (N=2 tasks × 12 seed(s)).** Directional only.
> 4. **Paired design**, errored runs excluded; McNemar (capability) + Wilcoxon signed-rank (discipline) + effect sizes.
> 5. **Not comparable to SWE-bench / GAIA / Fable scores** — a different question entirely.
<!-- /pinned:honesty -->

## Weak host (`claude-haiku-4-5`) — Gate verdict: **PASS**

<!-- pinned:weak-stats -->
- capability lift significant: `False`
- discipline lift significant: `True`
- status-bucket better (package vs vanilla): `False`

> **Measurable discipline lift (significant).** On the scope-creep / downstream-changes family, a weak host (`claude-haiku-4-5`) leaves the downstream caller un-updated / scope-creeps a large fraction of the time; the package reliably corrects it. The lift is significant on the discipline axis (Wilcoxon p<0.05, every discordant pair favouring the package) AND beats an **equal-length inert-prose placebo** — so it is the package's *content* (its `downstream-changes`/`scope-control` rules), NOT mere prompt-length, that helps. **Honest scope (empirically bounded):** the lift is **weak-host-specific** — a CLEAN strong-host run (`claude-sonnet-4-6`, same tasks, 8 seeds) scored vanilla = package = placebo = 1.00 (no headroom, package redundant). So the package helps a WEAK model that lacks the discipline; a strong model already has it. This matches the package's design thesis (strong hosts self-apply discipline; weak hosts benefit fully). Discipline axis, not capability (both arms make the primary change); this task family (scope/downstream), not a universal claim. It improves *solution discipline*, not model intelligence.

## package lift — `package` vs `vanilla` (n=24 pairs)

### Table 1 — capability axis (expected near-flat by design)

| metric | baseline | treatment | test |
|---|---|---|---|
| pass-rate | 100% | 100% | McNemar p=1.0, h=0.0 |

### Table 2 — discipline axis (the lift)

| metric | baseline | treatment | Δ | test |
|---|---|---|---|---|
| mean discipline | 0.333 | 1.000 | +0.667 | Wilcoxon p=0.0005, rb=1.0 (n≠0=16) |

### Table 3 — cost axis (mean tokens/run, non-errored)

| metric | baseline | treatment | Δ |
|---|---|---|---|
| mean tokens | 90,534 | 992,044 | +901,510 |

## attribution (content vs length) — `package` vs `placebo` (n=24 pairs)

### Table 1 — capability axis (expected near-flat by design)

| metric | baseline | treatment | test |
|---|---|---|---|
| pass-rate | 100% | 100% | McNemar p=1.0, h=0.0 |

### Table 2 — discipline axis (the lift)

| metric | baseline | treatment | Δ | test |
|---|---|---|---|---|
| mean discipline | 0.333 | 1.000 | +0.667 | Wilcoxon p=0.0005, rb=1.0 (n≠0=16) |

### Table 3 — cost axis (mean tokens/run, non-errored)

| metric | baseline | treatment | Δ |
|---|---|---|---|
| mean tokens | 97,528 | 992,044 | +894,516 |

## Status buckets (trajectory)

| arm | runs | error-rate | buckets |
|---|---|---|---|
| vanilla | 24 | 0% | completed:24 |
| package | 24 | 0% | completed:24 |
| placebo | 24 | 0% | completed:24 |

## Methodology

- Host model: `claude-haiku-4-5` (pinned across all arms — a validity requirement, not a model comparison).
- Per-run budget cap: $3.5; placebo injected ~6628 chars of inert prose.
- Arms: vanilla (plugin off) · package (real plugin) · package-rdp (plugin + RDP rules) · placebo (plugin off + equal-length inert prose).
- Corpus: `internal/bench/corpora/ab-trackb-v2.yaml` (5 trap archetypes). Scoring: `bench_ab_scoring_v2.py` (deterministic, no LLM judge).
- Roadmap: `agents/roadmaps/road-to-discipline-axis-benchmark.md`.
<!-- /pinned:weak-stats -->

## Cost-factor sweep (`claude-haiku-4-5`) — lift per loaded-context cost

> **Question:** the full package buys its weak-host lift at ~12× vanilla tokens.
> How much of the lift survives in trimmed rule-only configurations at a
> fraction of that cost? Four arms, same paired design (2 tasks × 12 seeds,
> n=24 pairs/arm), same host, same deterministic scorer. The trimmed arms run
> plugin-OFF + ONLY the named rule bodies injected via system prompt
> (`rules_subset_text()` in `bench_ab_v2_run.ts`, tier membership from
> `dist/router.json`).

<!-- pinned:cost-factor-table -->
| arm | loaded content | injected chars | mean tokens/run | cost factor | mean discipline | lift vs vanilla |
|---|---|---|---|---|---|---|
| `vanilla` | none | 0 | 103,319 | 1.0× | 0.458 | — |
| `rules-balanced` | kernel + tier 1 (shipped `balanced` profile) | 98,825 | 303,186 | **2.9×** | 0.417 | −0.042 (p=0.8127, **NULL**) |
| `rules-kernel-dc` | kernel (9 rules) + `downstream-changes` | 30,698 | 344,483 | **3.3×** | 0.917 | **+0.458 (p=0.0135, significant)** |
| `package` | full plugin | 0 | 1,210,078 | **11.7×** | 1.000 | **+0.542 (p=0.0017, significant)** |

(generated from the pinned report — curated labels from `docs/benchmark.pinned.yml`)
<!-- /pinned:cost-factor-table -->

Residual of the full package over `rules-kernel-dc`: Δ=+0.083, Wilcoxon p=0.37
(only 2 discordant pairs) — **not significant**.

### `full` discipline-tier disposition (council 2026-07-10)

The `full` tier (~11.7×) stays **experimental, opt-in only, never surfaced as a
recommendation**. Council (claude-sonnet-4-5 + gpt-4o, 2-round debate,
2026-07-10) converged on **keep-and-relabel over drop**: round 1 favoured
dropping `full`, but the rebuttal round reversed it — `p=0.37` is *absence of
evidence*, not *evidence of absence* (an underpowered n=24 compounded by an
`essential` ceiling effect), and removing an enum value is an **irreversible
breaking change** for anyone pinning the tier string. An experimental opt-in
does not violate "measured, not asserted"; an unlabeled *recommendation* would.
**Revisit-if (drop only when):** a high-powered Claude sweep (n≥100,
ceiling-adjusted) shows `p>0.20 AND effect <5%` **and** an open-source-host
adapter sweep returns a null — i.e. `full` is shown *actively* useless, not
merely unproven. Until then the experimental label stands everywhere `full` is
documented.

Three findings:

1. **~95% of the lift survives at ~3× cost.** The kernel + `downstream-changes`
   configuration keeps a significant discipline lift (0.917 vs the full
   package's 1.000; the residual is not significant at this N) at ~28% of the
   full package's tokens. The 12× full load is not required for this trap
   family's lift.
2. **Content selection beats size — the shipped `balanced` profile is a null.**
   `rules-balanced` injects 3× more chars than `rules-kernel-dc` and costs
   almost the same per run, but delivers ZERO lift: it lacks
   `downstream-changes` (a tier-2 rule), and `scope-control` alone does not
   correct the downstream trap. This is the placebo result again, sharpened:
   not only is length inert, even 33 real rules are inert on a trap their
   lift-carrying rule doesn't cover. Any low-cost weak-host profile must be
   cut by lift-carrying content, not by tier size.
3. **Cost is behaviour, not just context.** `rules-kernel-dc` injects a third
   of `rules-balanced`'s chars but costs slightly MORE — the discipline
   behaviour itself (verification turns, downstream edits) spends tokens. The
   token factor cannot be dialed by context size alone.

**Honest scope:** weak host only; the 2-task scope/downstream family (the family
with the proven lift), N=24 pairs/arm — the full package covers 4 more trap
archetypes the trimmed arms were NOT tested on here. Rules-only injection, not a
full plugin projection (no skills/commands/hooks in the trimmed arms). Before
shipping any trimmed default, sweep the full corpus (done below).

- Report: `internal/bench/reports/ab-v2/2026-07-07T05-35-14Z-ab-v2-paired.json`.
- Arms: `rules-kernel-dc` / `rules-balanced` in `src/scripts/bench_ab_v2_run.ts` (opt-in, not in the default arm list).

### Full-corpus P1 gate (`claude-haiku-4-5`, all 30 tasks) — family-scoped PASS

> **The essential lift is real, replicates, and is family-scoped.** Full corpus
> (all 5 trap archetypes + agentic-debug + the Laravel downstream trap),
> `vanilla` vs `rules-kernel-dc` × 3 seeds = 180 runs (n=90 pairs, 0 errored),
> run from a frozen checkout so mid-run edits could not contaminate the
> per-run rule reads. Corpus-wide the discipline delta is +0.056 (0.872 →
> 0.928, Wilcoxon p=0.084, rb=0.53) — NOT significant, because vanilla Haiku
> is already at/near the discipline ceiling on every family except the
> scope/downstream one. Inside that family the pilot lift replicates exactly:
> trapE (now 5 tasks incl. Laravel + meso variants) 0.533 → 1.000, Δ=+0.467,
> ALL 7 discordant pairs favouring the essential cut (sign test p≈0.016); all
> other families flat at ceiling (largest counter-noise: trapA −0.083 on 2
> discordant pairs). **Corpus-wide cost factor: 1.71x** (132,036 → 225,956
> mean tokens/run) — cheaper than the family-only 3.3x, because the
> discipline behaviour only spends turns where the trap exists.

| axis | vanilla | rules-kernel-dc | Δ | test |
|---|---|---|---|---|
| capability (pass-rate) | 92% | 92% | 0 | McNemar p=1.0, h=0.0 |
| discipline, full corpus (0–1) | 0.872 | 0.928 | +0.056 | Wilcoxon p=0.084, rb=0.53 (n≠0=14) |
| discipline, scope/downstream family (n=15) | 0.533 | 1.000 | +0.467 | 7/7 discordant favour essential (sign p≈0.016) |
| mean tokens/run | 132,036 | 225,956 | +93,920 (~1.7x) | — |

**Verdict for the tiering roadmap's P1 gate:** family-scoped PASS. The
`essential` tier's claim stays honest-scoped to the scope/downstream family —
the lift does not extend to families where the host is already at ceiling, and
it costs ~1.7x on a realistic mixed corpus. The Phase-4 default flip remains
additionally gated on the P2 non-Claude replication.

- Report: `internal/bench/reports/ab-v2/2026-07-07T07-04-39Z-ab-v2-paired.json`.

### P2 gate — non-Claude weak host (`gpt-5-mini` via codex) — **REPLICATION FAILED**

> **The essential lift does NOT replicate on the first non-Claude weak host as
> shipped.** Full corpus, `vanilla` vs `rules-kernel-dc` × 3 seeds on
> `gpt-5-mini` driven by the codex CLI (n=90 pairs, 0 errored, frozen
> checkout). Corpus-wide discipline Δ=+0.024 (p=0.70). Critically, this is NOT
> a ceiling null: on the scope/downstream family the host has headroom
> (vanilla 0.533→ 0.733) yet the rules do not fill it — trapE 0.733 → 0.667
> (Δ=−0.067, 1 discordant pair). Capability trends negative (89% → 82%,
> McNemar p=0.07) — **not significant, so no harm is claimed**; it is a
> cautionary trend, not a validated effect. Cost factor 1.18x.
>
> **Honest scope / confound:** the codex CLI has no system-prompt injection
> surface, so the rules were prepended to the user prompt in a marked block —
> a weaker instruction surface than the claude arms' system prompt. The
> measurement cannot distinguish "discipline rules do not transplant to
> GPT-class hosts" from "user-surface injection is too weak". It DOES
> establish the decision-relevant fact: **as shipped, on this host, there is
> no measured lift.** A system-surface experiment (API-loop harness) is a
> non-gating backlog follow-up.

| axis | vanilla | rules-kernel-dc | Δ | test |
|---|---|---|---|---|
| capability (pass-rate) | 89% | 82% | −7pp | McNemar p=0.07 (n.s.) |
| discipline, full corpus (0–1) | 0.819 | 0.843 | +0.024 | Wilcoxon p=0.70, rb=0.09 (n≠0=23) |
| discipline, scope/downstream family (n=15) | 0.733 | 0.667 | −0.067 | 1 discordant pair (negative) |
| mean tokens/run | 302,655 | 358,326 | +55,671 (~1.18x) | — |

**P2-verdict disposition** (council claude-sonnet-4-5 + gpt-4o, 2026-07-07,
2-round debate — recorded in
`agents/settings/contexts/weak-host-lift-tiering-verdict.md`):
`gpt-5-mini` joins the measured NULL-lift disable-list; `unknown_defaults`
becomes vendor-granular (`anthropic: lift_enabled` — the one family with a
measured lift — `default: lift_disabled`); the `balanced` installer preset
fills `discipline_profile: auto`, so the lift enables only where measured.
The three-host evidence ledger: Claude weak = family-scoped lift · Claude
strong = ceiling null · GPT weak = failed replication (confounded surface).

- Report: `internal/bench/reports/ab-v2/2026-07-07T10-33-53Z-ab-v2-paired.json`.

## Two-host matrix (flow-learnings Phase 3, `claude-haiku-4-5`) — Gate verdict: **HONEST-NULL**

First live run of the `bench_matrix` two-host composite (`internal/bench/matrix.yaml`):
2 task families × 2 hosts × arms `vanilla` vs `rules-kernel-dc`, 2 seeds,
n=14 paired runs per host. Result — **zero discipline lift on either host**,
every pair a tie:

| Host / family | n | discipline (van → rkdc) | capability |
|---|---|---:|---|
| `claude` / over-engineering-bait | 8 | 1.000 → 1.000 | 1.000 |
| `claude` / regression-landmine | 6 | 1.000 → 1.000 | 1.000 |
| `codex` / over-engineering-bait | 8 | 1.000 → 1.000 | **0.000** |
| `codex` / regression-landmine | 6 | 0.667 → 0.667 | **0.000** |

Two honest reads, neither a lift:

1. **`claude` ceilings** on both capability and discipline (1.000 everywhere) —
   no headroom, the injected rules are redundant here. This is the same
   strong-/ceiling-host null the corpus shows elsewhere; these two families are
   not the ones `downstream-changes` carries a lift on (that is the
   scope/downstream family), so a null here **confirms** the lift is
   family-specific, it does not contradict it.
2. **`codex` capability_pass = 0.000 on every task, both arms** — the codex host
   did not complete these fixtures capably at all, so its discipline column is
   **not a meaningful lift signal** (a confounded surface, echoing the P2
   `gpt-5-mini` replication failure above — a non-Claude host + these fixtures).
   Reported here as a caveat, not a measurement; a bare table without this note
   would overclaim.

Net: the matrix pipeline works end-to-end and the composite is reproducible, but
this cell set carries **no** cross-host discipline lift — `claude` has no
headroom and `codex` is capability-confounded. Not published as a lift claim.

- Reports (operator-local, untracked): four `internal/bench/reports/ab-v2/2026-07-10T19-2*Z-ab-v2-paired.json` cells (claude×2 families, codex×2 families).

## Strong host (`sonnet`, full 30-task corpus) — Gate verdict: **HONEST-NULL**

- capability lift significant: `False`
- discipline lift significant: `False`
- status-bucket better (package vs vanilla): `False`

> **Honest null on a strong host, across the full corpus.** A re-run of the SAME
> package on `sonnet` over the entire discipline corpus — all 5 trap archetypes +
> agentic-debug + a Laravel/PHP downstream trap (`trapE-scope-laravel-01`) — with
> `vanilla` vs `package` × 3 seeds (180 runs, n=84 paired). The discipline axis
> does not move (Δ=+0.000, Wilcoxon p=1.0) and capability is flat-to-slightly-lower,
> because a capable host is *already* at the discipline ceiling on these
> deterministic traps — exactly what the weak-host section predicts. The package
> is a redundant no-op here, **at ~5× the tokens.** This is not a failure: it is
> the empirical bound on the weak-host claim, and it holds in PHP as in TS. **No
> strong-host lift is claimed.**

### Table — `package` vs `vanilla` (n=84 pairs, host `sonnet`)

<!-- pinned:strong-table -->
| axis | vanilla | package | Δ | test |
|---|---|---|---|---|
| capability (pass-rate) | 94% | 89% | −5pp | McNemar p=0.125, h=-0.174 |
| discipline (0–1) | 0.929 | 0.929 | +0.000 | Wilcoxon p=1.0, rb=0.0 (n≠0=5) |
| mean tokens/run | 185,584 | 929,716 | +744,132 (~5×) | — |

(host `sonnet`, n=84 pairs — generated from the pinned report)
<!-- /pinned:strong-table -->

- Report: `internal/bench/reports/ab-v2/2026-07-05T07-00-31Z-ab-v2-paired.json` (A6 of `road-to-final-state-and-market-readiness.md`).
- Methodology: identical to the weak-host section (pinned host, deterministic scorer, paired design); the only change is the host model and the full-corpus scope.

## Recursive self-verification (ADR-106) — HONEST-NULL

> **Verdict: recursion is redundant with the always-on rules. `verification.recursive`
> stays `off`. No model got "closer to Fable" — exactly what ADR-106's gate was built to
> disconfirm.** The one retraining-free Sakana-Fugu mechanism (a depth-bounded
> `attempt → critic verdict → re-attempt` loop) was built, shipped behind a gate, and
> measured — and adds nothing over the rules.

Measured the `package-recursive` arm (D₂ = rules + recursion, deterministic scorer-as-critic,
`max_depth=1`) against `package` (D₁ = rules only) on a weak host (`claude-haiku-4-5`),
`capH-debug` archetype × 6 seeds (n=54 paired):

| axis | D₁ (rules) | D₂ (rules + recursion) | Δ (D₂ − D₁) | test |
|---|---|---|---|---|
| capability (pass-rate) | 87% | 87% | 0 | McNemar p=1.0, h=0.0 |
| discipline (0–1) | 0.852 | 0.861 | +0.009 | Wilcoxon p=0.79, rb=0.33, n≠0=3 |

**ADR-106 gate: FALSIFIED** — neither a capability lift (p=1.0) nor a *significant* novel
discipline lift (p=0.79; only 3 discordant pairs, below the ≥6 the gate requires).

**Why, despite a passing human pre-test.** Recursion fired on only **8/29** corpus tasks
(~28%) and produced a differentiated output on **4/29** — with the rules active, the host's
*first* attempt already passes the critic 72% of the time, so recursion is a no-op. A blind
human pre-test on the 4 differentiated pairs preferred the recursion output **4/4**, but those
cases are too rare and the aggregate marginal lift too small (n≠0=3) to register as
significant. The pre-test looked positive on N=4; the paired benchmark falsified it — which is
exactly why ADR-106 required the benchmark, not just the pre-test.

**Honesty scope.** Weak host, `capH-debug` family, deterministic scorer-as-critic, `max_depth=1`.
A model-based critic (Phase 4) was not pursued — gated on this result passing, which it did not.
Cost axis: each recursion run is up to 2× the host calls of a single pass, for a null lift.

- Roadmap: `agents/roadmaps/archive/road-to-recursive-verification.md` (closed honest-null).
- Gate logic: `recursiveGateVerdict` / `resolveRecursiveDefault` (`orchestration_gate.ts`); on a
  falsified gate `resolveRecursiveDefault` resolves `off` — no shipped-default flip.

**Follow-up disposition — TERMINAL** (AI council, anthropic/claude-sonnet-4-5 +
openai/gpt-4o, 2026-06-24, deep tier). Both members converged: do **not** pursue a
model-critic / cross-vendor variant. The 72% first-pass rate shows recursion solves the
wrong problem — cost scales with *all* tasks, benefit only on the ~28% tail (best-case
~4–6% lift, would need n≥200 to detect); a model-critic would mostly fire more often and
produce more null-lift re-attempts at higher cost. The real lever is **refining the rules
on the 28% failure tail** (applies to 100% of tasks at zero marginal cost), not recursion.
Recursion-as-a-class is closed; the model-critic's contextual-quality angle, if ever
wanted, is a *different* (quality-review) product, not a recursion follow-up.

## Second-brain recall delta (`claude-haiku-4-5`) — PASS (bounded)

> **Verdict: a real, placebo-controlled cross-session recall lift — honestly
> scoped to the context-value upper bound, not retrieval precision.** With the
> right prior fact surfaced, the model answers a multi-session recall task it
> otherwise cannot; the lift beats BOTH no-memory and equal-byte noise.

Three arms on a fixed host (`claude-haiku-4-5`), deterministic recall corpus
(9 tasks) × 3 seeds = 81 calls, scored with no model-in-the-loop grading
(`second_brain_score`). Paired sign test over the 9 tasks:

| arm | pass | vs memory-on (paired sign test) |
|---|---|---|
| memory-on (substrate surfaces the prior fact) | **27/27** | — |
| memory-off (no memory) | 10/27 | on wins 6, ties 3, loses 0 — p = 0.031 |
| placebo (equal-byte inert context) | 9/27 | on wins 6, ties 3, loses 0 — p = 0.031 |

memory-on beats BOTH off and placebo at p < 0.05 → **PASS**. The lift
concentrates on the 6 retrieval-accuracy/contradiction tasks where the fact is
available ONLY from memory (on 3/3, baseline 0/3); it **ties** on the 3 tasks
whose k+1 prompt already self-contains the signal (an in-prompt correction or a
named contradiction) — memory-on never loses.

**Honesty scope.** This is the **context-value upper bound**: the corpus is
one-fact-per-task, so memory-on injects the exact fact (perfect retrieval). It
proves the *value of the right surfaced fact*, isolated from mere extra context
by the placebo — NOT the substrate's retrieval *precision* under a large store,
which is the follow-up corpus. Cost: 6.3k in / 8.7k out tokens for the full run.

- Report: `internal/bench/reports/second-brain-delta.json`; claim
  `second-brain-recall-lift` (`docs/CLAIMS.md`); scope + the declined Obsidian
  export in `docs/second-brain-scope.md`.
- Roadmap: `agents/roadmaps/archive/road-to-second-brain-delta-proof.md` (closed PASS).
- Harness: `src/scripts/second_brain_run.ts` (`--dry-run` free / `--run` spend).

## Second-brain retrieval precision (`claude-haiku-4-5`) — PASS, ranking-limit named

> **Verdict: the lift survives REAL retrieval under confuser load — the
> substrate recalls the right decision and the model disambiguates it — but the
> keyword scorer recalls without ranking, which is the FTS5 signal at scale.**

The follow-up to the recall-delta above removes its perfect-retrieval
assumption. Against a populated decision store (5 needed + 19 distractors, with
distractors that deliberately share query keywords with the needed decision),
the run uses the REAL `memory_lookup` retrieval (not injection). Same host, 9
tasks × 3 seeds = 81 calls.

| metric | result |
|---|---|
| precision@5 (needed decision in top-5) | **9/9 (100%)** |
| mean tie-set size (entries sharing the top score) | **3.3** — recalls, does not rank; ties break by store order |
| retrieval-on (top-5 injected, confusers included) | **27/27** |
| retrieval-off (no memory) | 5/27 — paired sign test vs on: 8 wins / 1 tie, p = 0.008 |
| placebo (equal-count fixed unrelated entries) | 5/27 — vs on: 8 wins / 1 tie, p = 0.008 |

**Reading it honestly.** Recall@5 is 100% *at this scale*: with ≤ k
keyword-matching entries per query, the needed decision fits in the top-k and
the model reliably picks it out of the co-injected confusers (retrieval-on
27/27). The scorer gives 0.8 to any keyword match and breaks ties by store
order, so it **recalls but does not rank** (mean tie-set 3.3) — once more than
k entries share a keyword, recall into the top-k degrades. That degradation is
the discrimination gap the SQLite-FTS5 activation path (ADR-116) exists to
close; this run is its motivating evidence, not a contradiction of it.

- Report: `internal/bench/reports/second-brain-retrieval.json`; claim
  `second-brain-retrieval-precision` (`docs/CLAIMS.md`); scope in
  `docs/second-brain-scope.md`.
- Store + corpus: `internal/bench/second-brain/retrieval-store/`.
- Harness: `src/scripts/second_brain_retrieval.ts` (`--dry-run` computes the
  free deterministic precision@k / tie-set; `--run` adds the model arms).

## Thin-vs-eager quality judge (token-saving Phase 0) — INCONCLUSIVE (judge-limited)

> **Verdict: the live judge run was executed, and it does NOT trustworthily
> resolve whether the thin rule-projection holds output quality — the signal is
> non-significant, judge-inconsistent, and length-confounded. Recorded as an
> honest null; the quality-regression gate stays inert (by design — its report
> path is gitignored) pending a stronger, length-neutral judge.**

The thin-vs-eager runner (`src/scripts/bench_quality_run.ts`) generates each
labelled golden task's answer under the THIN rule context (kernel bodies +
non-kernel pointers, ~15k tok) and the EAGER context (all rule bodies, ~87k
tok), then judges the pair in both orders (`evaluatePair` → reject-on-flip).
Live run 2026-07-09, host + judge `claude-haiku-4-5`, 30 labelled tasks
(evidence: `internal/bench/reports/quality-run-2026-07-09-haiku-inconclusive.json`):

| metric | value | reading |
|---|---|---|
| decisive pairs | 16 / 30 | thin 5 · eager 11 |
| thin win-rate | 31% | below the 0.48 floor — but see the three confounds |
| Wilcoxon p | **0.196** | **not significant** — no reliable thin≠eager difference |
| judge inconsistency | **33%** (10/30 flip on order swap) | the haiku judge is unreliable here |
| length-confound | **69%** of decisive wins went to the LONGER answer | eager (87k ctx) answers longer → verbosity bias, exactly what the harness flags |

**Why it is not a regression verdict.** The win-rate alone would trip the gate,
but the three diagnostics disqualify it as evidence: the difference is not
significant (p=0.20), a third of pairs are position-unstable, and two-thirds of
decisive wins track answer *length*, not quality. A "thin regresses" claim off
this run would be over-claiming a confounded, non-significant signal — the
opposite of the honest-null discipline.

**Re-open (fresh-spend follow-up).** A trustworthy verdict needs (a) a stronger
judge (sonnet-class) to cut the 33% inconsistency, and (b) a length-neutralised
comparison (truncate/normalise answer length, or score against the anchors
directly) to remove the 69% verbosity confound. Until then the thin lever is
NOT adopted as default and the gate stays inert. The golden set also still
covers only 14/89 rules (operator hand-labelling), a separate gap.

- Runner: `src/scripts/bench_quality_run.ts` (`--dry-run` free / live is
  API-gated); gate: `src/scripts/check_quality_regression.ts` (inert until a
  `quality-run.json` — gitignored — exists locally).
- Roadmap: `agents/roadmaps/later/road-to-token-saving.md` Phase 0.

## Length-neutral judge RERUN (2026-07-12) — SECOND INCONCLUSIVE, gate CLOSED-BY-DIAGNOSIS

**Verdict: `inconclusive-low-kappa` — and per the pre-registered design
(`docs/design/length-neutral-judge-rerun.md`) a second inconclusive means
RECORD WHY AND STOP: no third run without a design change. The thin lever
stays NOT adopted; further paired-judge spend on this question is closed.**

The rerun fixed all three recorded failure modes *by construction* — ±15%
output-token pair matching with a reported dropped-bucket, two arm-blind
judges from different provider families (claude-opus-4-8 + gpt-4o, both
orders, reject-on-flip) with a κ ≥ 0.60 admissibility floor, a Spearman-ρ
length diagnostic (|ρ| ≥ 0.3 withholds), and a pre-registered n = 90 (the
full council-labelled corpus). Runner: `src/scripts/bench_quality_rerun.ts`;
artifact: `internal/bench/reports/quality-rerun-length-neutral.json`;
actual cost $34.80 (cap $250).

**Why the gate is now closed rather than pending — the diagnostics carry the
answer:**

| Diagnostic | Value | Reading |
|---|---|---|
| Pair survival | **25/90** (65 dropped by the ±15% band) | Eager answers are *systematically* longer — the length difference is structural to the arms, not noise a judge can be told to ignore |
| Cross-family judge agreement | **κ = 0.46** (< 0.60 floor) | Even top-tier judges from different vendors disagree on which answer is better — the rubric-visible quality difference is smaller than judge noise |
| Length leakage within the band | **ρ = 0.45** (flagged ≥ 0.3) | Even among length-matched pairs, wins still track length |
| Agreed decisive pairs | **7** (thin 3 / eager 4, p = 1.0) | Nothing separable remains once length and judge noise are controlled |

**The honest conclusion:** the thin-vs-eager output-quality question is not
resolvable by LLM-paired judging on this corpus — the measurable signal is
dominated by structural length effects and judge disagreement, in BOTH the
naive (2026-07-09/11) and the length-neutral (2026-07-12) designs. This is a
*diagnosis*, not a "pending": the thin projection stays DISABLED on the
existing precedent, the quality-regression gate stays inert, and any future
attempt must use a categorically different method (e.g. deterministic
anchor-scoring against `must_include`/`must_not`, not pairwise LLM judging).

- Runner: `src/scripts/bench_quality_rerun.ts` (design-pinned constants:
  band ±15%, κ floor 0.60, ρ flag 0.3, effect floor 10pp; `--max-usd` guard).
- Roadmap: `agents/roadmaps/archive/road-to-opt-measurement-unblock.md` Phase 1.

## Cross-model parity count (2026-07-12) — PASS, `finding_floor` armed

The most-deferred portfolio item (cross-model parity eval, deferred across 4+
roadmaps) landed in its re-scoped form: council-transport execution instead of
an in-host subagent harness (`docs/design/cross-model-parity-eval.md`). Each
orchestration-corpus task is rendered self-contained (fixture files inlined)
and dispatched identically to two vendors; the output contract forces a
numbered findings list (or `NO FINDINGS`), counted with the **same**
`_count_findings` the `finding_floor` eval gate uses.

| Task | sonnet median | gpt-4o median | Calibrated floor |
|---|---|---|---|
| orch-01 multi-file analysis | 11 | 5 | 5 |
| orch-02 ordered refactor | 5 | 3 | 3 |
| orch-03 competitive impl | 3 | 0 | 1 (clamp) |
| pv-01 hollow detection | 2 | 2 | 2 |
| pv-02 negative control | 0 | 0 | — (control, excluded) |

Signal, honestly stated:

- **Real cross-vendor gap** — sonnet surfaces ~2× gpt-4o's findings on the
  multi-file analysis task. A floor calibrated on sonnet alone would
  systematically fail gpt-4o; the cross-host lower envelope
  (`max(1, min over hosts of median)`) is the correct floor shape.
- **Planted defect is vendor-stable** — both vendors cite the hollow
  `charge.ts` (2 findings each, zero variance across repeats).
- **Negative control perfect** — 0 findings from both vendors on clean code
  across all repeats; the counting contract does not reward spurious findings.

Cost: $0.16 actual (30 calls; ceiling $8 authorized). `finding_floor` is now an
**enforcing** gate (comment flipped in `run_skill_evals.ts`); calibration data
in `internal/bench/reports/parity-count.json`.

- Runner: `src/scripts/bench_parity_count.ts` (pre-registered: 3 repeats,
  2 vendors, envelope floor rule, controls excluded, `--max-usd` abort).
- Roadmap: `agents/roadmaps/archive/road-to-opt-measurement-unblock.md` Phase 3.

## Non-Claude lift replication, second vendor host (2026-07-12) — HONEST NULL

The `discipline_profile: auto` flip gate required a replicated lift on a
non-Claude host. Executed per the parked design (paired vanilla vs
`rules-kernel-dc` = the essential cut, 30 tasks × 3 seeds) on the codex CLI
host with `gpt-5.5` (ChatGPT account).

- **Capability:** 92% → 89% (McNemar p = 1.0) — no effect.
- **Discipline:** 1.000 → 0.892 (Δ = −0.108, Wilcoxon p = 0.0225 on 7
  non-zero pairs) — no lift; directionally **negative** on this host.
- **Verdict:** NO replicated lift. `discipline_profile` keeps its
  vendor-granular default (`unknown_defaults`, no `auto` flip) — consistent
  with the 2026-07-10 two-host precedent (claude strong-host ceilings) and
  the earlier gpt-5-mini replication failure on the same injection surface.

Limitations, published: the ChatGPT-account usage limit rejected 100 of 180
runs mid-corpus (plus 2 timeouts), leaving n = 37 valid pairs — the
truncation is **balanced across arms** (50/52), so it weakens power but does
not bias the comparison. An earlier same-day fire misfired entirely (model
pin omitted → all runs API-rejected, $0) and is excluded as a harness error,
not evidence. Raw report is local-only by design
(`internal/bench/reports/ab-v2/` is gitignored); this section + the roadmap
notes are the durable record. Re-open path: a full uncapped 180-run
replication on a per-token-billed key.

- Runner: `src/scripts/bench_ab_v2_run.ts --host codex` (checkpoint-resumable).
- Roadmap: `agents/roadmaps/archive/road-to-opt-measurement-unblock.md` Phase 2.

## adversarial-verification-council finding coverage — HONEST NULL (resolved 2026-07-21)

Pre-registered claim `adversarial-council-finding-coverage` (docs/CLAIMS.md,
ADR-122): on the RESIDUAL defect pool — defects that survive a single strong
cross-model judge — a cross-vendor skeptic panel (subagent-orchestration Mode 9,
`adversarial-verification-council`) finds materially more residual defects than
that judge, at a false-positive rate no worse than baseline on a
controversial-but-correct control.

- **Design (two-stage residual protocol, corpus-validity bar, dual threshold,
  controversial-clean FP control):** [`docs/design/adversarial-council-eval.md`](design/adversarial-council-eval.md).
- **Gate (locked at pre-registration):** relative residual-recall lift >= +25%
  **AND** absolute >= +8 pp, **AND** panel FP not worse than baseline within
  noise — encoded + tested in
  [`src/scripts/_lib/adversarial_council_gate.ts`](../src/scripts/_lib/adversarial_council_gate.ts).
- **Status: HONEST NULL (resolved 2026-07-21).** A curated judge-survivable
  corpus was built (`internal/bench/adversarial-council/`: 12 planted-defect
  fixtures across 4 subtlety classes + 3 controversial-but-correct clean
  controls; subtlety distribution published; passed an independent validity
  audit after one fixture was repaired). The registered cross-vendor run
  (anthropic `claude-sonnet-4-5` + openai `gpt-4o`, spend-authorized) resolved
  the claim NEGATIVE:

  | quantity | value |
  |---|--:|
  | judge-passed residual pool | 5–7 defects (missed by both neutral passes) |
  | single-skeptic residual recall | 0.60 |
  | 2-vendor panel residual recall | 0.60 (**zero lift**) |
  | single-skeptic FP on clean controls | 1.00 |
  | panel FP on clean controls | 1.00 |

  The second vendor's residual catches were a **strict subset** of the first's,
  so the panel added no marginal coverage; both recall thresholds (+25% rel,
  +8 pp abs) missed → **honest-null**. Under the adversarial-skeptic posture
  both the single skeptic and the panel false-flagged **all three**
  controversial-but-correct controls (100% FP) — the posture over-flags correct
  code. Stable across two runs. Per the locked gate, the Mode 9 surface stays
  **default-off permanently** (like recursive-verification). Reproducible
  artifact: `internal/bench/adversarial-council/runs/`.
- **Transport lesson.** The first run attempted via `council_cli run` was
  REJECTED as a measurement artifact: that transport runs multi-round
  peer-review with cross-member visibility and returns prose ("Round 2 …
  Reviewer A"), which both violates the independent-skeptic requirement and
  defeats JSON scoring. The valid run uses direct, independent per-vendor
  client calls (`bench_adversarial_council.ts`) with a strict-JSON system
  prompt and a deterministic, pre-validated scorer
  (`adversarial_bench_score.ts` + its synthetic red/green test).


## Defect-finding: team vs self-review vs council (2026-07-20) — HONEST NULL (ceiling-limited) {#honest-null-defect}

Pre-registered 12-fixture corpus (`internal/bench/corpora/defect-finding.yaml`:
10 seeded-defect diffs across logic / off-by-one / race / missing-empty-state /
security-smell, + 2 controls), three arms, deterministic file-level recall
against ground truth (blind rubric judge deferred — the primary metric is
deterministic). Codex reviewer pinned `gpt-5.5`. Total billable $0.083 (arm b
codex = ChatGPT subscription, $0).

| arm | recall | correctness | design | false-positives |
|---|--:|--:|--:|--:|
| self-review (single model) | 1.00 | 1.00 | 1.00 | 1 |
| team (cross-model, codex) | 1.00 | 1.00 | 1.00 | 0 |
| council (neutral breadth)  | 1.00 | 1.00 | 1.00 | 0 |

**Verdict: HONEST NULL.** H1 (cross-model team > single-model self-review on
correctness recall, Δ ≥ +0.20) is **not met** — Δ = 0: all three arms recalled
every planted defect. H2 (council ≈ team on design, within 0.10) is met (Δ = 0).
H3 (≤ 1 false positive/arm) is met.

**Corpus-validity caveat (the honest bound):** recall 1.00 across every arm is a
**ceiling effect** — these seeded defects are catchable by any strong model, so
the corpus cannot discriminate the arms on recall. This is the same limitation
the adversarial-verification-council section names: a corpus of obvious,
model-differentiating defects measures parity, not the judge-survivable
subtleties where a cross-model lens might actually differ. The one non-null
signal is precision, not recall: single-model self-review produced 1 false
positive on the controversial-but-correct control (`df-ctl-01`, a
behaviour-preserving `clamp` refactor) where team and council produced 0 — a
hint of a multi-arm precision edge, within the pre-registered H3 bound, too
small to claim.

**Disposition (Phase 5 Step 5): evidence-closed as NULL.** No cross-model
defect-finding *quality/lift* claim binds; team mode stays documented as
**workflow value only**. Re-open conditions: (a) a curated
judge-survivable-subtlety corpus that breaks the recall ceiling, or (b) a new
model generation. The worker-via-bundle delegate (roadmap Phase 3 Step 4) stays
deferred — it re-opened only on a measured review lift, which did not occur.
