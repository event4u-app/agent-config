# Frontier-Quality Eval Harness & Flip-Gates

Phase 2 of `road-to-frontier-quality-operating-system`. Defines the eval corpus
shape, baseline discipline, synthetic-failure requirement, and the per-mechanism
flip-gates — **before** any behaviour is made default-on. The corpus itself is
authored/run in the follow-up implementation roadmaps (per the Phase-0 execution
contract); this asset is the governed spec they build against. Row ids are the
`FQ-*` from [`mechanism-matrix.md`](mechanism-matrix.md).

## Corpus shape — positive + negative per mechanism

Every mechanism that needs a gate (the 9 non-`covered` FQ rows) gets both arms:

| Mechanism | Positive (should fire) | Negative (must NOT fire) |
|---|---|---|
| FQ-01 currentness | "is X still CEO", "latest model version", "does this law still apply" | stable math/CS fact, a definition, a pinned-lockfile version |
| FQ-02 tool priority | "our Q3 numbers" → internal first; external claim → official first | a general-knowledge question needing no lookup |
| FQ-04 memory application | domain-matched "we decided" cue → apply | unrelated-task recall → do NOT apply (non-application precision) |
| FQ-06 prior-conversation retrieval | possessive/"we decided" → search chat store first | a fresh question with no prior-context cue |
| FQ-07 artifact routing | "write the report/save/download", named format → file | brief list, short code, conversational summary → inline |
| FQ-09 visual routing | "diagram/chart", spatial/system structure → visual | text-only technical support, ordinary prose |
| FQ-11 domain overlays | finance figure in a sheet → source comment; legal → jurisdiction/freshness | ordinary prose → NOT over-cited |
| FQ-12 claim self-check | post-retrieval answer → each claim stable/cited/uncertain | stable-knowledge answer → no forced citation |

The `covered` FQ rows already carry fixtures: `surface-contracts` (`ssac-*`),
`design-artifact` (`daf-*`), the trigger-eval sets (`check-trigger-evals`), and
the golden set (`check_token_quality_golden`).

## Baseline discipline

Adoption must show **improvement over a recorded baseline**, not only new green
checks. Before a mechanism's gate flips, snapshot the *existing* behaviour on
its negative + cross-pressure cases so a regression is visible. Baselines pin to
`internal/bench/reports/` on a fixed host (the existing rig).

## Synthetic failure cases (one per proposed rule)

Each proposed rule ships a case that FAILS on the bad behaviour, so the gate can
go red before default-on: answering without lookup (FQ-01), web-before-internal
(FQ-02), applying irrelevant memory (FQ-04), file-when-inline-is-correct (FQ-07),
simulating an unavailable tool (FQ-08), over-quoting (FQ-10/FQ-11), claiming
verification without evidence (FQ-18). A rule with no red-on-bad case cannot flip.

## Flip-gates (per mechanism)

```
advisory  → documentation only; the rule/contract exists, nothing triggers by default.
routed    → the skill/rule MAY trigger, with caveats; no default behaviour change.
default-on→ REQUIRES all three, on a fixed host, recorded:
            (1) trigger-recall green on the positive arm,
            (2) negative-example precision green (no false fire),
            (3) NO material regression on existing coding/roadmap quality tasks
                (paired vs the recorded baseline).
```

A mechanism is never promoted past its capability: a gate that needs a host
primitive (`design-artifact-verification` / `host-capabilities.yml`) stays
advisory on hosts that lack it (§ conflict tie-breaker 5). The maintainer-visible
report (Phase 7) lists which mechanisms remain advisory and why.

## What this asset does NOT do

It does not author the corpus or run the flips — those are follow-up
**implementation** roadmaps, gated by these definitions. This asset is the
contract they satisfy, so "add a rule" can never precede "can fail on its bad
behaviour".
