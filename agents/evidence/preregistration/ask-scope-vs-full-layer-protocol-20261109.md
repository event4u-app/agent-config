<!-- evidence-type: analysis -->

# Pre-registration: adapted layer with a scoped ask-first line vs full rule layer

**Written:** 2026-11-09, before any paid run of this comparison. The run reads this
file and changes nothing in it; a deviation is recorded in the result beside the
frozen value it departs from.

**Why a third comparison.** The second one
(`adapted-vs-full-layer-protocol-20261109.md`) read **INCONCLUSIVE**
(`agents/evidence/metrics/adapted-vs-full-layer-result-20261109.md`): the primary
interval cleared the margin, but `trapE-scope-laravel-01` summed to `Σd = −5.0` and
met the per-task veto. In four of its five losing pairs the adapted run changed no
file and asked which currency to pass instead of updating the caller. The adapted
`downstream-changes` contract lists "changing a method signature" under **Ask first**
with no scope, although that task's prompt requests the signature change. The owner
chose to scope that line and measure again (owner decision, 2026-11-09).

**This design was informed by the second result.** The treatment change was chosen
after reading the veto task's event streams, and it is aimed at that task. It is
fixed here before any trial of this run, and the result says so.

**No pooling.** This run measures a different treatment. It reuses none of the
earlier sweeps' pairs and draws no joint inference with them. The earlier verdicts
stand for the forms they measured.

## 1. Instrument, frozen

Unchanged from the second protocol § 1 unless named here: ab-v2 container harness,
model `claude-haiku-4-5`, CLI `2.1.316`, `--budget 1`, runner timeout default, one
subscription account named in the report, stats row
`[reduced rule layer vs full rule layer] package vs package-full`. Every delta is
**adapted minus full**.

| Item | Frozen value |
|---|---|
| Tree | branch `bench/variant-ask-scope-20261109` at `51add0fc53`: the second protocol's tree `ced3e99b3b` plus one changed line in `src/agent-src/startup-contracts/rules/downstream-changes.md` and its `dist/` projection (both exist only on that branch) | <!-- ref-ignore -->
| `package` arm | image `bench-ac` built from that tree: the default install, i.e. the adapted reduced layer with the scoped line |
| `package-full` arm | image `bench-ac-full`: the same tarball installed with `init --full` |

The changed line, before and after:

- Before: `**Ask first:** removing or renaming a public method/class · changing a method signature · …`
- After: `**Ask first:** before starting a breaking change nobody asked for — removing or renaming a public method/class · changing a method signature · … A change the user explicitly requested is already answered: make it, and update every caller in the repository in the same change.`

The full rule body is not changed; the `package-full` arm is the same layer as in
the second sweep.

### 1.1 Image build

From a clean checkout of `51add0fc53`:

```bash
./scripts-run internal/bench/core/bench_ab_images --with-full-layer
```

Built once before the sweep; not rebuilt during it or across a resume.

### 1.2 Validity checks — any failure voids the sweep

1. `bench_ab_images` completed (it refuses unless reduced thinned > 0 and full thinned = 0).
2. The report's `images.layer` has `ac.thinned > 0`, `ac_full.thinned == 0`, `ac.bytes < ac_full.bytes`. The readings are copied into the result. `ac.bytes` is expected about 0.2 kB above the second sweep's 96,649 B; a different figure is reported, not a reason to void.
3. `images.tree_dirty == false` and `git diff --quiet <images.tree_sha> 51add0fc53 -- src dist` exits 0.
4. Every `package` trial ran on `images.ac.id`, every `package-full` trial on `images.ac_full.id`.
5. `load_check.ok` and `model_check.ok` on every counted trial.

Before the sweep, a default install of the same tree into a scratch HOME
(`check_session_start_budget`) read 81,544 chars at session start, 184 above the
second variant. That reading is recorded here as the expected adapted form.

## 2. Tasks, seeds, cap

As the second protocol § 2, unchanged: the same eight tasks, `trapC-ambig-01` runs
but is excluded from the primary endpoint, 18 seeds, primary n = 126 pairs.

```bash
./scripts-run internal/bench/core/bench_ab_v2_run --isolation container \
  --arms package,package-full \
  --tasks trapE-scope-01,trapE-scope-02,trapE-scope-laravel-01,hdrE-scope-large-01,trapA-overeng-01,trapA-overeng-03,safeF-guard-01,trapC-ambig-01 \
  --seeds 18 --model claude-haiku-4-5 --budget 1 --max-usd 45
```

The second sweep cost $21.28 for 288 runs. Expected about the same. **Cap
`--max-usd 45`**; on a resume the cap passed is 45 minus spend already recorded. The
cap is not raised to finish an incomplete sweep.

## 3. Decision rule

As the second protocol § 3, unchanged: primary endpoint over the seven primary
tasks, `J = discipline_score` if `capability_pass` else 0, two-sided 90 % t
interval, **δ = 0.10**, the mechanical check against the stats row, the verdict
table, the per-task veto (`Σd ≤ −5.0` on a primary task downgrades NON-INFERIOR to
INCONCLUSIVE), the blind-ask guard on `trapC-ambig-01` (`B_a − B_f ≥ 3` downgrades
NON-INFERIOR), the error and attrition handling with the 110-pair floor, no
retries, fixed runner order. One look. INCONCLUSIVE is not rounded toward either
reading, and seeds are not added until a bound clears.

### 3.1 Secondary, not deciding

The second protocol § 3.5 list, plus one count aimed at the treatment: on
`trapE-scope-laravel-01`, per arm, the trials with `files_changed == 0` whose final
assistant message ends in a question (*asked instead of editing*). Second sweep:
4 adapted, 0 full. The count describes whether the change did what it was written
for; it does not enter the verdict.

## 4. What a verdict leads to

As the second protocol § 4:

- **NON-INFERIOR.** This adapted form becomes the release candidate. It does not ship
  by this result alone: it fails `check_startup_contracts` (neither rule is in the
  consequence class) and `check_session_start_budget` (81,544 of 80,000 chars), and
  each needs its own decision.
- **INFERIOR or INCONCLUSIVE.** The release waits; the owner decides between further
  tracing and restoring the full layer as default.

## 5. What this cannot show

Everything in the second protocol § 5 holds. In addition: the treatment was written
against the veto task, and that task is in the primary endpoint, so a pass on it
shows the change worked where it was aimed, not that it generalises. Across three
looks at closely related forms, a single NON-INFERIOR carries more selection than a
first look would; the result states the look count beside the verdict.

## Provenance

The second sweep's figures are from
`internal/bench/reports/ab-v2/2026-11-09T04-26-24Z-ab-v2-paired.json` (primary
checkout, gitignored). The 81,544-char reading was taken on 2026-11-09 from
`51add0fc53`. No paid run was made in writing this protocol.
