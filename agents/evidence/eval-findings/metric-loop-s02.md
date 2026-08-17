# Spike s02 — wrapping existing verifiers in a JSON-on-stdout contract

**Date:** 2026-08-17
**Roadmap:** [road-to-metric-loop-and-review-integrity.md](../../roadmaps/road-to-metric-loop-and-review-integrity.md) Phase 0
**Tree:** `6a679cc19` (branch base `origin/main`)
**Kill criterion (pre-registered):** two or more of the three verifiers need invasive changes.

## Question

Can three existing verifiers be wrapped in a `{pass, score, metric}` JSON-on-stdout
contract **without modifying the verifiers themselves**?

## Method

A scratch wrapper (`spike_s02_wrap.ts`, scratchpad-only, not shipped) invoked each
verifier through `./scripts-run`, read its exit code as `pass`, and derived a
higher-is-better `score` by negating the violation count parsed from the verifier's
own summary output. No verifier source file was touched.

## Result

| Verifier | pass source | metric source | score | Invasive change needed |
|---|---|---|---:|---|
| `validate_frontmatter` | exit code | `== Frontmatter schema: 437 artefacts, 0 failing, 0 with warnings ==` | 0 | **no** |
| `lint_output_slop` | exit code | `clean — no placeholder-prose patterns found` sentinel | 0 | **no** |
| `check_references` | exit code | `scanned: 1289` + `No broken references found.` | 0 | **no** |

`invasive_count: 0` · **kill not triggered** (threshold was ≥ 2).

## The finding the spike existed to produce

**`check_references` writes its metric to stderr, not stdout.** Measured directly:

```
./scripts-run src/scripts/check_references 2>/dev/null | grep -c "scanned:"   -> 0
./scripts-run src/scripts/check_references 2>&1 1>/dev/null | grep -c "scanned:" -> 1
```

The first wrapper draft captured stdout only and returned `metric: null` for that
verifier while reporting `pass: true` — a silently degraded reading, not an error.
This is the one shape a *JSON-on-stdout* contract cannot express by construction:
a verifier whose numbers land on the other stream.

Consequences for Phase 1, both of which belong in the error-semantics document
rather than in the schema:

1. **The contract reads merged streams, or it names stdout-only as a producer
   obligation.** Silently reading one stream and reporting `pass: true` with a null
   metric is worse than failing, because a null metric is indistinguishable from a
   verifier that legitimately has no metric.
2. **A null metric with `pass: true` must be a distinguishable state**, not folded
   into `score: 0`. Three of the caller behaviours in the error table (revert,
   continue, fail the experiment) depend on telling "no metric exists" from
   "the metric could not be read".

## Verdict

**PASS.** Zero of three verifiers need invasive changes; the contract is
transplantable onto the existing verifier surface as-is. The stream finding
narrows Phase 1's error semantics rather than blocking it.
