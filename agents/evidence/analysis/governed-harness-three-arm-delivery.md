<!-- evidence-type: analysis -->

# Three-arm delivery experiment — `eager-all` vs `thin` vs `delivery`

`road-to-governed-harness-evolution` step 6.1, whose `verify:` is *"the three
arms are measured against one another before any new retrieval component is
written."* This artefact is that measurement. No retrieval component has been
written — 6.3 has not started, and this run is the precondition it is gated on.

**Measured 2026-08-31 on `drain/governed-harness-p4`. Zero model calls.**

## Reproduce

```
./scripts-run src/scripts/model_rule_injection --three-arm
./scripts-run src/scripts/model_rule_injection --three-arm --cap-bytes N   # sensitivity
npx vitest run tests/scripts/_lib/delivery_arm_experiment.test.ts           # 11/11
```

## What the three arms are, read off the tree rather than assumed

`src/scripts/_lib/lean_projection_mode.ts:19` declares
`LeanProjectionMode = 'eager-all' | 'thin' | 'delivery'`, with `eager-all` the
shipped default at `:21`. The arms have exactly two consumers, and each was
opened rather than recalled:

- `src/scripts/condense.ts:1124` calls `writesThinFiles(mode)` — so `thin` and
  `delivery` project pointer stubs where `eager-all` projects bodies.
- `src/scripts/hooks/rule_inject_hook.ts:230` calls `deliversBodies(mode)` — so
  only `delivery` binds the concern that injects matched bodies at prompt time.

The arms therefore differ on one observable: **for a given prompt, is the
labelled rule's body in the model's context?** That is decidable from the tree,
which is why this comparison needs no model call.

## Why this is not the price grid that already existed

`src/scripts/model_rule_injection.ts` already prices the same three shapes
(`:454-462`). A price grid reports what each shape **costs** and never what each
shape **delivers**, so it cannot answer 6.1 — which is the finding AC-7's audit
already recorded ("a cost model is not the three-arm experiment 6.1 names"). The
delivery half is what is new here. The cost figures below are read from
`standingCorpora`, the same function the price grid reads, so the two halves can
never disagree about what a shape costs to stand up.

## The measurement

Corpus `tests/eval/routing-matrix` — 94 labelled rules, 305 positives, 194
near-misses, 32 positives carrying `open_files`. Matcher
`_lib/router_match.ts` via `_lib/rule_injection.ts`, which is the single
implementation for every surface (6.2). Cap = the concern's own `CAP_BYTES`
(20,480 B, `hooks/rule_inject_hook.ts:92`).

| arm | delivery (positives) | false context (near-misses) | standing tok | injected tok/prompt |
|---|---|---|---|---|
| `eager-all` | **1.000** (305/305) | **1.000** (194/194) | 120,743 | 0 |
| `thin` | **0.000** (0/305) | 0.000 (0/194) | 18,223 | 0 |
| `delivery` | **0.990** (302/305) | 0.000 (0/194) | 18,223 | mean 2,026 · p90 4,144 |

Pairwise, because three independent rows are three measurements rather than one
comparison:

| pair | delivery delta | standing delta |
|---|---|---|
| `thin` vs `eager-all` | −305 positives | −102,520 tok |
| `delivery` vs `eager-all` | −3 positives | −102,520 tok |
| `delivery` vs `thin` | +302 positives | 0 tok |

**Cap-dropped under `delivery`: 1 of 305.**

## What the numbers say

1. **`eager-all` buys perfect delivery with zero context precision.** Every
   labelled body is in context — and so is every near-miss's body, 194 of 194.
   Its 120,743 standing tokens are the price of both.
2. **`delivery` recovers 302 of `eager-all`'s 305 at `thin`'s standing cost**,
   at a marginal 2,026 tokens per prompt, and delivers a near-miss body **zero**
   times. On this corpus it dominates `thin` on delivery at identical standing
   cost, and dominates `eager-all` on standing cost while losing 3 positives.
3. **The three losses are named, not summarised.** Two are matcher misses —
   `roadmap-progress-sync` on *"Continue with the next open step of the plan."*
   and `user-interrupt-priority` on *"Process the whole roadmap without pausing
   between phases."* — consistent with the 0.993 open-files-honoured recall the
   existing model reports (303 matched). The third is the cap —
   `think-before-action` on the German-language prompt below, where 5 rules
   matched, 3 fitted in 15,888 B, and the labelled one was dropped:

   ```
   Vor dem Refactor bitte erst die Datenfluesse analysieren.
   ```

   (The corpus prompt is quoted with its umlaut transliterated; the literal is
   in `tests/eval/routing-matrix/think-before-action.yaml`.)

## The honest reading of `thin`'s 0.000

`thin` scores 0/305 because **no rule the corpus labels is kernel or
triggerless** — those are the only ids whose full bodies stand under the thin
shapes (mirroring `standingCorpora`). This is asserted in the test rather than
argued here. So 0.000 is a property of *this corpus against this arm*, not a
claim that `thin` puts nothing in context: the nine kernel bodies still stand.
What it does establish is the one thing 6.1 needs — for every rule the corpus
holds an opinion about, `thin` alone delivers nothing, so the delivery concern
is not an optimisation of `thin` but the thing that makes `thin` usable at all.

## Sensitivity — the numbers were made to move

A measurement never seen move has unknown sensitivity. Two independent handles
were perturbed.

**Handle 1 — the byte cap** (CLI, reproduced above):

| cap (B) | `delivery` | cap-dropped | `eager-all` | `thin` |
|---|---|---|---|---|
| 1 | 0.770 (235/305) | 68 | 1.000 | 0.000 |
| 2,000 | 0.774 (236/305) | 67 | 1.000 | 0.000 |
| 20,480 (shipped) | 0.990 (302/305) | 1 | 1.000 | 0.000 |
| 200,000 | 0.993 (303/305) | 0 | 1.000 | 0.000 |

The `delivery` figure is monotone in the cap and reaches exactly the matcher's
0.993 ceiling when the cap stops binding. The other two arms **do not move**,
which is the other half of the proof: they inject nothing, so a cap that changed
them would mean the arms were not separated. `delivery` does not fall to 0 at
cap 1 because `selectForInjection` always admits the first ranked body — the
documented "one oversized body cannot starve the rest" behaviour.

**Handle 2 — the router.** Stripping every trigger from `design-fidelity`
in an in-memory router moves its positives out of the injected set and into the
thin standing set (a triggerless rule stays eager under the thin shapes), so
`thin` rises from 0 to that rule's positive count while `eager-all` does not
move at all. Asserted in
`tests/scripts/_lib/delivery_arm_experiment.test.ts`.

## What this does NOT measure — and why no amount of spend closes it

It measures **which bodies reach context and what they cost**. It does not
measure whether a session that *receives* a body behaves like a session that
*had it standing*. That is not an expense declined for budget reasons: the
instrument is closed by **ADR-202**
(`docs/decisions/ADR-202-anchor-scoring-as-thin-quality-instrument.md`), whose
status reads *"CLOSED — instrument not achievable with available evaluators"* at
an inter-evaluator kappa of 0.472 against a registered floor of 0.800, with no
third attempt licensed. So the behavioural half has no admissible instrument at
any price, and this run does not reopen it. Nothing above is evidence about
quality.

## No second matcher

The experiment imports `matchTierRules` and `selectForInjection` from
`_lib/rule_injection.ts` and nothing else that could answer "which rules fire on
this prompt?". `tests/scripts/router_match_parity.test.ts` (5/5) and
`tests/scripts/single_matcher_preserved.test.ts` (8/8) are green on this branch
— the standing half of 6.2, re-confirmed rather than re-closed.
