<!-- evidence-type: analysis -->

# Pre-registration: confirming the adapted layer on held-out tasks, two models

**Written:** 2026-11-10, before any paid run of this comparison, and merged to `main`
before the first trial. The run reads this file and changes nothing in it; a
deviation is recorded in the result beside the frozen value it departs from.

**Why a fourth look.** The third look (`ask-scope-vs-full-layer-protocol-20261109.md`)
reads NON-INFERIOR only under the owner's post-data exclusion of two pre-model
timeouts, and all three looks used the same eight tasks, the third one designed
after the second's result on one of them. The owner chose (2026-11-10, option 1 of
`road-to-the-adapted-layer-on-main` blocker `adapted-layer-gate-decisions`) to ship
the adapted form only after a fresh confirmation. This protocol is that
confirmation: tasks none of the three looks used, the abort rule fixed before data,
and a second model.

**No pooling.** No pair from an earlier sweep enters this one, and no joint
inference is drawn with them.

## 1. Instrument, frozen

ab-v2 container harness, CLI `2.1.316`, `--budget 1`, runner timeout default, one
subscription account named in the report. Every delta is **adapted minus full**.

| Item | Frozen value |
|---|---|
| Tree | the head of branch `feat/adapted-layer-landing` after it merges the `main` commit carrying this file. Its diff against that `main` commit touches only: `src/agent-src/startup-contracts/rules/downstream-changes.md`, `src/agent-src/startup-contracts/rules/think-before-action.md` and their `dist/agent-src/` projections (the contract wording of the third look, byte-identical to `51add0fc53`); `src/scripts/check_startup_contracts.ts`, `src/config/startup-contract-clauses.json`, `src/scripts/install.ts`, `dist/install/install.mjs`, and their tests | <!-- ref-ignore -->
| `package` arm | image `bench-ac`: the default install of that tree — the adapted reduced layer, `source_path:` without the `dist/agent-src/rules/` prefix |
| `package-full` arm | image `bench-ac-full`: the same tarball installed with `init --full` |
| `package-padded` arm | the `package` image plus inert prose injected as `--append-system-prompt-file`, `--pad-chars` long |
| `--pad-chars` | `images.layer.ac_full.bytes − images.layer.ac.bytes`, read from the image report before the first trial and recorded in the result. Bytes stand in for characters; the layer is ASCII apart from a few punctuation marks, and the result states the difference |

Before this file was written, a default install of the tree into a scratch HOME
(`check_session_start_budget`) read **79,444** chars at session start, under the
80,000 budget.

### 1.1 Validity checks — any failure voids the sweep for that model

1. `bench_ab_images --with-full-layer` completed, with `ac.thinned > 0`,
   `ac_full.thinned == 0`, `ac.bytes < ac_full.bytes`.
2. `images.tree_dirty == false`, and `git diff --name-only <main commit>
   <images.tree_sha> -- src dist` lists only the files named in § 1.
3. Every trial ran on the image its arm names; `load_check.ok` and `model_check.ok`
   on every counted trial.
4. The model the report records is the model named for the sweep.

## 2. Tasks, seeds, models, cap

**Held-out primary tasks** — none was in the three earlier looks:
`trapE-scope-03`, `trapE-scope-meso-01`, `hdrH-callers-01`, `trapA-overeng-02`,
`trapB-regress-01`, `trapB-regress-02`, `safeF-guard-02`.
**Guard task**, run but outside the primary endpoint: `trapC-ambig-02`.
18 seeds; primary n = 126 pairs per comparison.

Two sweeps, in this order, one look each:

```bash
./scripts-run internal/bench/core/bench_ab_v2_run --isolation container \
  --arms package,package-full,package-padded --pad-chars <§ 1> \
  --tasks trapE-scope-03,trapE-scope-meso-01,hdrH-callers-01,trapA-overeng-02,trapB-regress-01,trapB-regress-02,safeF-guard-02,trapC-ambig-02 \
  --seeds 18 --model claude-haiku-4-5 --budget 1 --max-usd 45 --pre-model-reruns 2

# then the same with --model claude-sonnet-5-5
```

Expected spend: about $32 (Haiku, $0.074 a run over the 2026-11-09 sweeps) and
about $42 (Sonnet, from the Sonnet 4.6 sweeps). **Cap `--max-usd 45` per model**;
on a resume the cap is 45 minus spend already recorded, and it is not raised to
finish an incomplete sweep.

## 3. Pre-model aborts — fixed before data

Per `docs/contracts/eval-measurement-integrity.md` § A run that never reached the
model is not a trial: a trial whose stream holds no `system/init` event, that
errored and spent no tokens, is rerun up to **2** times (`--pre-model-reruns 2`).
One that never reaches the model is an environment failure: not scored, reported
per arm and task, and its pair counts toward attrition. Any other abort is a trial
and is scored as the harness scores it.

## 4. Decision rule

Per model, **primary comparison `package` vs `package-full`** over the seven
primary tasks: `J = discipline_score` if `capability_pass` else 0, paired by task
and seed, two-sided 90 % t interval on the mean `d = J_adapted − J_full`,
**δ = 0.10**.

| Reading | Rule |
|---|---|
| NON-INFERIOR | lower bound > −0.10 |
| INFERIOR | upper bound < −0.10, or the lower bound ≤ −0.10 and the mean ≤ −0.10 |
| INCONCLUSIVE | anything else |

Downgrades, each turning NON-INFERIOR into INCONCLUSIVE:

- **Per-task veto:** any primary task with `Σd ≤ −5.0`.
- **Blind-ask guard** on `trapC-ambig-02`: `B_a − B_f ≥ 3`, where `B` counts trials
  that asked without having read anything first, counted as in the third look.
- **Attrition:** fewer than 110 complete primary pairs after § 3.

INCONCLUSIVE is not rounded toward either reading, and seeds are not added until a
bound clears.

### 4.1 Secondary, not deciding

- `package-padded` vs `package-full` and `package-padded` vs `package`, same
  statistic: does padding the reduced layer to full length recover what it loses?
- First-turn input tokens per arm, from the run's usage.
- Environment failures per arm and task.

## 5. What a verdict leads to

- **NON-INFERIOR on both models:** the adapted layer lands
  (`road-to-the-adapted-layer-on-main` Phase 2) with both gates green.
- **Anything else on either model:** it does not land. The owner decides between
  restoring the full layer as default for the next release and further tracing.
  The reduced form on `main` read INFERIOR in the first look; that reading stands
  for it.

## 6. What this cannot show

Seven held-out tasks from one corpus, two models, one CLI version. A pass shows the
adapted form holds where it was not tuned, not that it holds on every task. The
padded arm puts the filler in the system prompt rather than in the rule layer, so
it matches size, not position. Four looks at related forms have been taken; the
result states the look count beside the verdict.

## Provenance

Per-run costs from `internal/bench/reports/ab-v2/2026-11-09T09-32-31Z-ab-v2-paired.json`
($21.23 for 288 Haiku runs) and `2026-11-05T20-21-44Z-ab-v2-paired.json` ($34.30
for 350 Sonnet 4.6 runs), both gitignored in the primary checkout. The 79,444-char
reading was taken on 2026-11-10 from `feat/adapted-layer-landing` at `fd3ca92a8d`.
No paid run was made in writing this protocol.
