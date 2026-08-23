# Frontend power — pre-registration (fixed before any lane implementation)

Registered 2026-08-23 · owner: maintainer · `road-to-frontend-power` step 0.3.
Population: `tests/eval/frontend-corpus/`, digest
`bf5d0a852d8c1538621ac967c6e36125d81c534083cb680dcbc1a4ff0033b208`
(`CORPUS.sha256`, committed `34f7dc400`).

**Ordering, stated so it is checkable rather than asserted.** This record and
the corpus both commit before any lane-E / lane-A / lane-R implementation commit
on this branch. Two Phase-0 commits precede it — `34f7dc400` (the corpus) and
`5b54933f5` (step 0.5's register scope on T7/T8). Neither is a lane
implementation; 0.5 is a Phase-0 contradiction repair, and it is named here
rather than glossed because step 0.2's own verify line singles out
`design_slop_rules.ts` and that file is in `5b54933f5`.

## What is measured

Whether frontend obligations can be delivered by a mechanism instead of by the
model choosing to consult a skill — and whether the delivery changes behaviour.

The prior measurement this reopens is a **control arm with no intervention
arm**: 0.0 %, 0 of 275 UI-write turns across 16 sessions
(`agents/roadmaps/archive/road-to-frontend-skill-application.md:23`), taken
while both carriers were `enabled: false`. Nothing was tried and found wanting.

## Carrier grades — fixed here, and read off the manifest, never off host names

A number is meaningless without the grade it was taken at, so the grade
definition is pre-registered with the metrics rather than chosen when the
results arrive. Grades come from `src/scripts/hook_manifest.yaml` `platforms:`
rows plus `VERIFIED_PLATFORMS` in `src/scripts/hooks/host_semantics.ts`, per
[`hook-architecture-v1` § Which hosts carry pre_tool_use](../../docs/contracts/hook-architecture-v1.md).

| Grade | Meaning | Hosts | Evidence |
|---|---|---|---|
| **A — enforced** | a slot is bound AND the host honours a deny | `claude` | `hook_manifest.yaml:960` (`pre_tool_use`), `:961` (`post_tool_use`), `:958` (`stop`); the sole member of `VERIFIED_PLATFORMS` |
| **B — guided** | a slot is bound, the deny is not honoured | `augment` (`:952/:953/:951`), `cowork` (`:1014/:1015/:1012`), `cursor` (`:1038/:1036`), `cline` (`:1053/:1051`), `gemini` (`:1089/:1087`), `windsurf` (`stop` only, `:1069`) | bound and ignored (augment/cowork trampolines `exit 0`), or no pre-tool surface |
| **C — static** | no hook surface at all | `copilot` | `:1093-1094`, `fallback_only: true`; `agent-config hooks:status` prints "degraded: rule-only fallback — hooks are not auto-firing on this platform" |

```
NO METRIC IS EVER AGGREGATED ACROSS GRADES.
A GRADE-A DELIVERY RATE IS NOT THE SUITE'S DELIVERY RATE.
```

## Metrics

### Routing
| id | metric | how measured |
|---|---|--:|
| M-R1 | frontend recall | share of the 20 cases whose UI surface is detected by `_lib/ui_surface.ts` |
| M-R2 | backend false positives | non-UI files in the corpus flagged as UI surfaces (`full-stack-feature-with-ui/pages/api/reports/export.ts` is the pinned negative) |
| M-R3 | surface-mode accuracy | resolved `surface_mode` vs the case label |
| M-R4 | change-intent accuracy | resolved `change_intent` vs the case label |
| M-R5 | trivial-lane FP/FN | `ui-trivial` allow-list decisions against the five diff conditions |

### Execution
| id | metric | how measured |
|---|---|--:|
| M-E1 | delivery rate | share of UI writes where a finding reaches the model without a skill consultation — **per host, per grade** |
| M-E2 | consultation rate | share where a design skill was consulted |
| M-E3 | audit-before-write | share of non-trivial writes with a `ui-audit.json` newer than the target |
| M-E4 | authority-before-write | share with a resolved `ui_authority` object before the first write |
| M-E5 | review-after-write | share with a `design-review` verdict after the last write |
| M-E6 | render discharge | share where a render artefact existed, where the host could render at all |

### Fidelity
| id | metric | how measured |
|---|---|--:|
| M-F1 | source-mechanic coverage | mechanics in a supplied artifact marked `honoured` or `flagged`, over mechanics present |
| M-F2 | silent drops | mechanics present in the source and absent from the output with no `flagged` entry. **Target 0** |
| M-F3 | token violations | produced by the fidelity roadmap's Phase 3, cited here, not duplicated |
| M-F4 | accidental redesign under `preserve` | palette or type-family delta against the incumbent snapshot |
| M-F5 | wireframe over-fidelity | wireframe presentation reproduced as the visual design |

### Quality and cost
| id | metric | how measured |
|---|---|--:|
| M-Q1 | blind A/B | paired, margin committed before results are read |
| M-Q2 | human spot-check | a named human, sampled |
| M-C1 | standing context | `check_always_budget`, before and after |
| M-C2 | model calls | per task |
| M-C3 | hook p95 | against `src/config/hook-latency-budget.json` (`any_hook_event.p95_ci = 250 ms`) — reused, not re-invented |
| M-C4 | render cost | wall-clock and bytes per `ui:render` invocation |
| M-C5 | convergence rounds | owned by the fidelity roadmap's Phase 6; no loop surface is added here |

## M1 — the false-positive rate, and the population it may NOT be taken on

`M1` is the per-rule false-positive count on a **clean** corpus: UI the rule's
author did not write. The clean population is
`internal/bench/corpora/design-slop-clean/`.

```
M1 IS NEVER MEASURED ON tests/eval/frontend-corpus/.
THAT CORPUS WAS AUTHORED BY THE SAME RUN THAT WROTE THE T7/T8 REGISTER SCOPE,
SO AN FP RATE TAKEN ON IT MEASURES THE AUTHOR'S INTENT, NOT THE RULE.
NO DETECTOR ROW IS PROMOTED TO `backed` AGAINST IT.
```

This is Risk 6 of the parent roadmap ("one effort ships both the engine and the
corpus that scores it"). The roadmap's stated mitigation — hash the corpus
before the engine commit — controls *sequence*; it does not control
*authorship*, and authorship is the binding half. Hence the prohibition rather
than an ordering rule.

## Falsifiers — written before any result

| # | falsifier | consequence if it fires |
|---|---|---|
| F1 | delivery rises with no behaviour delta | tiering collapses to stop-only |
| F2 | M1 > 0 for a rule on its epoch | that rule stays judgment-only; it does not ship as `backed` |
| F3 | a resolver arm below any of ADR-212's T1-T4 | lane R does not ship; it closes with a published null |
| F4 | standing context rises | A5.2 (`/design` router command) is rejected |
| F5 | a P0 block fires on a clean corpus case | P0 narrows to the floors that did not fire, and the carrier does not go ON |
| F6 | M-F2 (silent drops) > 0 on either artifact case | the source-led path does not ship as `honoured`; mechanics are `flagged` only |

## A1.5's delta threshold — declared now, not after the first result

The intent-aware gate blocks a **visual-world** change under `change_intent:
preserve`. Threshold, fixed here:

- **Palette:** any colour token in the output that is not in the incumbent's
  resolved set, excluding pure `transparent`/`currentColor`/`inherit`. Count
  > 0 blocks.
- **Type family:** any `font-family` first-choice family absent from the
  incumbent's set. Count > 0 blocks.
- **Explicitly NOT in the threshold:** spacing, radius, line-height, weight,
  size, letter-spacing, shadow, and layout. `polish` and `refine` must be able
  to move all of those under `preserve`, which is the whole point of the verb.

Pinned by `near-miss/refine-preserves-world` (must block on a palette or family
delta) and `cases/explicit-redesign` (must not block at all).

## Power floor — below this, the measurement yields no claim

```
A NUMBER FROM FEWER THAN 12 SCORED CASES ON A GRADE, OR FROM A SINGLE HOST
PRESENTED AS A SUITE FIGURE, IS NOT A RESULT. IT IS AN ANECDOTE, AND IT IS
PUBLISHED AS ONE OR NOT AT ALL.
```

- **Per-grade minimum: 12 of the 20 cases.** The corpus has 20; a grade scored
  on fewer than 12 has a per-case resolution coarser than 8 points, which
  cannot separate any two of the arms F1 distinguishes.
- **Per-rule M1 minimum: the full clean corpus.** A partial clean-corpus pass
  is not an M1 of 0; it is an unmeasured rule.
- **Blind A/B minimum: the margin, committed first.** A comparison whose
  margin is chosen after the numbers are visible is not blind, whatever the
  sample size.
- **The floor is a floor, not a target.** It is stated as the point below which
  no claim may be made, and deliberately not as a sufficiency claim: 12 of 20
  authored cases can still be the wrong 12. It bounds the anecdote case, which
  is the failure this run can actually prevent.

## Amendment form (binding)

A threshold moves only by a dated amendment file beside this one carrying: the
original threshold, the measured number with its corpus digest, the new
threshold or waiver, the reason, and the seat record with each member's model id
and **exit status**.

```
A SEAT THAT RETURNED A NON-ZERO EXIT STATUS IS NEVER REPORTED AS CONVERGENCE.
A THRESHOLD NEVER MOVES IN THE SAME COMMIT AS THE CODE IT UNBLOCKS.
```
