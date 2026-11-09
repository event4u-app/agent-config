<!-- evidence-type: analysis -->

# Pre-registration: adapted reduced rule layer vs full rule layer

**Written:** 2026-11-09, before any paid run of this comparison. The run reads this
file and changes nothing in it; a deviation is recorded in the result beside the
frozen value it departs from.

**Why a second comparison.** The first one
(`full-vs-reduced-layer-protocol-20261108.md`) read **INFERIOR**
(`agents/evidence/metrics/full-vs-reduced-layer-result-20261109.md`). The owner chose
to adapt rather than restore the full layer, and to measure the adapted form first
(owner decision, 2026-11-09; `road-to-a-start-as-light-as-the-field` 1.3). The trace
(`agents/evidence/metrics/full-vs-reduced-loss-trace-20261109.md`) put the loss on two
places: blind questions on `trapC-ambig-01`, and discipline on the
`downstream-changes` tasks. The adapted form gives `downstream-changes` and
`think-before-action` a startup contract instead of a pointer stub.

**This design was informed by the first result.** The treatment, the task exclusion
in § 2.1, and the blind-ask guard in § 3.3 were all chosen after reading it. They are
fixed here before any trial of this run, and the result says so.

**No pooling.** This run compares a different treatment (the adapted form, not the
`main` reduced form). It reuses none of the first sweep's pairs and draws no joint
inference with it. The first verdict stands for the form it measured.

## 1. Instrument, frozen

Unchanged from the first protocol § 1 unless named here: ab-v2 container harness,
model `claude-haiku-4-5`, CLI `2.1.316`, `--budget 1`, runner timeout default, one
subscription account named in the report, stats row
`[reduced rule layer vs full rule layer] package vs package-full`. Every delta is
**adapted minus full**.

| Item | Frozen value |
|---|---|
| Tree | branch `bench/variant-contract-stubs-20261109` at `ced3e99b3b`: `main` at `27d25ae9e7` plus two startup-contract files (`src/agent-src/startup-contracts/rules/{downstream-changes,think-before-action}.md` and their `dist/` projections) |
| `package` arm | image `bench-ac` built from that tree: the default install, i.e. the adapted reduced layer |
| `package-full` arm | image `bench-ac-full`: the same tarball installed with `init --full` |

### 1.1 Image build

From a clean checkout of `ced3e99b3b`:

```bash
./scripts-run internal/bench/core/bench_ab_images --with-full-layer
```

Built once before the sweep; not rebuilt during it or across a resume.

### 1.2 Validity checks — any failure voids the sweep

1. `bench_ab_images` completed (it refuses unless reduced thinned > 0 and full thinned = 0).
2. The report's `images.layer` has `ac.thinned > 0`, `ac_full.thinned == 0`, `ac.bytes < ac_full.bytes`. The readings are copied into the result. `ac.bytes` is expected about 1.5 kB above the first sweep's 95,118 B; a different figure is reported, not a reason to void.
3. `images.tree_dirty == false` and `git diff --quiet <images.tree_sha> ced3e99b3b -- src dist` exits 0.
4. Every `package` trial ran on `images.ac.id`, every `package-full` trial on `images.ac_full.id`.
5. `load_check.ok` and `model_check.ok` on every counted trial.

Before the sweep, a default install of the same tree into a scratch HOME
(`check_session_start_budget --keep`) showed both rules as contract stubs (1,144 and
915 chars) and 81,360 chars at session start. That reading is recorded here as the
expected adapted form; check 2 is the in-image confirmation.

## 2. Tasks, seeds, cap

### 2.1 Tasks

The same eight tasks as the first protocol § 2.1, with one change to the endpoint:
**`trapC-ambig-01` runs but is excluded from the primary endpoint.** A council round
on 2026-11-09 (`agents/evidence/council/trapc-oracle-validity-20261109.md`) found its
scoring invalid for this comparison: the capability gate scores every question 0,
and deleting the live file scores 0.5. The two seats disagreed on how a blind
question should score. No rubric is written for it here; § 3.3 reports it and guards
it instead.

Primary tasks (7): `trapE-scope-01`, `trapE-scope-02`, `trapE-scope-laravel-01`,
`hdrE-scope-large-01`, `trapA-overeng-01`, `trapA-overeng-03`, `safeF-guard-01`.

### 2.2 Size

**18 seeds × 8 tasks = 144 pairs, 288 runs; primary n = 7 × 18 = 126 pairs.** The
first protocol's sizing applies unchanged (σ = 0.45, one-sided α 0.05, power 0.80 at
a true difference of 0, δ 0.10 → 126 pairs). The first sweep's realised per-pair SD
was 0.32, so power at the realised spread is above 0.95.

```bash
./scripts-run internal/bench/core/bench_ab_v2_run --isolation container \
  --arms package,package-full \
  --tasks trapE-scope-01,trapE-scope-02,trapE-scope-laravel-01,hdrE-scope-large-01,trapA-overeng-01,trapA-overeng-03,safeF-guard-01,trapC-ambig-01 \
  --seeds 18 --model claude-haiku-4-5 --budget 1 --max-usd 45
```

### 2.3 Cost and cap

The first sweep cost $18.83 for 256 runs ($0.074 per run). Expected for 288 runs:
about $21. **Cap `--max-usd 45`**, within the owner's $30–50 budget for this gate. On
a resume the cap passed is 45 minus spend already recorded. The cap is not raised
to finish an incomplete sweep.

## 3. Decision rule

### 3.1 Primary endpoint

As the first protocol § 3.1: `J = discipline_score` if `capability_pass` else 0;
per pair `d = J(adapted) − J(full)`; over the analysed pairs of the **seven primary
tasks** only: n, `d̄`, `s`; two-sided 90 % interval with the t quantile at n − 1 df.

The stats output's row covers all eight tasks, so the mechanical check is done
twice: the all-task `n` and `d̄` recomputed from the records must equal the row's
`n_pairs` and `discipline_given_capability.mean_delta` (4 decimals); the primary
figures are then computed from the same records with `trapC-ambig-01` removed.

### 3.2 Margin

**δ = 0.10**, as before.

### 3.3 Verdict

| Verdict | Condition |
|---|---|
| **NON-INFERIOR** | `LB > −0.10` in the primary and the worst-case analysis, no per-task veto, and the blind-ask guard holds |
| **INFERIOR** | `LB ≤ −0.10` and `UB < 0` |
| **INCONCLUSIVE** | `LB ≤ −0.10` and `UB ≥ 0`; or a NON-INFERIOR downgraded by the veto or the guard; or § 3.4 makes the sweep incomplete |

**Per-task veto.** A primary task with `Σd ≤ −5.0` over its analysed pairs
downgrades NON-INFERIOR to INCONCLUSIVE.

**Blind-ask guard on `trapC-ambig-01`.** A *blind ask* is a trial on this task with
`files_changed == 0` whose kept event stream contains no `tool_use` block in any
assistant message. Let `B_a`, `B_f` be the blind-ask counts of the adapted and full
arms over 18 seeds. If `B_a − B_f ≥ 3`, NON-INFERIOR is downgraded to INCONCLUSIVE.
(First sweep: 5 vs 2 over 16.) The guard and the veto only move a verdict toward
INCONCLUSIVE.

One look. INCONCLUSIVE is not rounded toward either reading, and seeds are not
added until a bound clears.

### 3.4 Errors, retries, order

As the first protocol § 3.4, applied to the primary tasks: infrastructure errors
excluded; behavioural errors excluded from the primary and scored
`J(adapted) = 0` in the worst-case analysis; fewer than 110 analysed primary pairs
(more than 12.5 % of 126 lost) → INCONCLUSIVE; no retries; fixed runner order.

### 3.5 Secondary, not deciding

The all-eight-task figures under the old scoring; per-task `Σd` and joint passes;
capability (McNemar), raw discipline (Wilcoxon); first-turn input tokens per arm as
in the first protocol § 4. For `trapC-ambig-01`, per arm, the counts of the four
classes in the trace (deleted legacy only · deleted both · blind ask · listed then
asked), classified as in the trace.

## 4. What a verdict leads to

- **NON-INFERIOR.** The adapted form becomes the release candidate. It does not ship
  by this result alone: it fails `check_startup_contracts` (neither rule is in the
  consequence class) and `check_session_start_budget` (81,360 of 80,000 chars), and
  each needs its own decision. The release ships the form measured here or waits.
- **INFERIOR or INCONCLUSIVE.** The release waits; the owner decides between further
  tracing and restoring the full layer as default.

## 5. What this cannot show

Everything in the first protocol § 5 holds. In addition: the treatment changes two
rules, so a NON-INFERIOR result does not say which of the two carried it; and the
exclusion of `trapC-ambig-01` means the primary endpoint no longer measures asking
behaviour, which only the guard and § 3.5 cover.

## Provenance

The first sweep's figures are from
`internal/bench/reports/ab-v2/2026-11-08T23-17-23Z-ab-v2-paired.json` (primary
checkout, gitignored). The 81,360-char reading was taken on 2026-11-09 from
`ced3e99b3b`. No paid run was made in writing this protocol.
