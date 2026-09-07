# Humanizer paired eval — v1

> Generated 2026-09-07T04-06-51Z · corpus `tests/fixtures/ai-tells` (20 before/after pairs, 17 length-controlled ±25%).

## Objective — AI-tell reduction (deterministic)

Every figure names the split it came from. `tune` is the half a rule may be
looked at while it is being written; `holdout` is scored and never read
during authoring, so a gain that appears only in `tune` is overfitting and
says so on its face. Split membership: `tests/fixtures/ai-tells/SPLITS.json`.

| Metric (mean) | tune before (n=12) | tune after | holdout before (n=8) | holdout after | both before (n=20) | both after |
|---|---|---|---|---|---|---|
| Hard hits | 1.08 | 0 | 0.63 | 0 | 0.9 | 0 |
| Cluster score /500w | 44.09 (n=12) | 0 (n=12) | 54.02 (n=8) | 0 (n=8) | 48.06 (n=20) | 0 (n=20) |
| Dash density /500w | 7.14 (n=12) | 0 (n=12) | 11.2 (n=8) | 0 (n=8) | 8.76 (n=20) | 0 (n=20) |

## Blind preference (length-controlled)

_Not re-run — this invocation is objective-only._ Carried forward from the judged run of **2026-07-11T12-02-29Z**: judge claude-sonnet-4-5 prefers the humanized text in **16/16** length-controlled pairs (randomized A/B order, deterministic seed). That figure was measured against the register and the length-controlled set as they stood on that date; the objective table above is newer. It is reproduced so a free re-run cannot silently unback the claim it supports, and it is NOT a measurement of the current register.

## Attribution — which families the preference tracked

No family disabled. Re-run with `--disable-family <rule-id>` to see what a family was carrying.

| Family | Pairs it was removed from | …and the judge preferred the humanized text |
|---|---|---|
| `tell-ai-vocabulary` | 17 | not judged |
| `tell-generic-conclusion` | 10 | not judged |
| `tell-negative-parallelism` | 10 | not judged |
| `tell-chat-artifact` | 8 | not judged |
| `tell-significance-inflation` | 8 | not judged |
| `tell-copula-avoidance` | 7 | not judged |
| `tell-false-range` | 7 | not judged |
| `tell-emoji-heading` | 6 | not judged |
| `tell-authority-trope` | 5 | not judged |
| `tell-rule-of-three` | 5 | not judged |
| `tell-signposting` | 5 | not judged |
| `tell-throat-clearing` | 5 | not judged |
| `tell-vague-attribution` | 5 | not judged |
| `tell-bold-header-list` | 4 | not judged |
| `tell-hedging-stack` | 4 | not judged |
| `tell-de-connector-stack` | 3 | not judged |
| `tell-de-negative-parallelism` | 3 | not judged |
| `tell-filler-phrase` | 3 | not judged |
| `tell-aphorism-formula` | 2 | not judged |
| `tell-de-filler` | 2 | not judged |
| `tell-de-significance` | 2 | not judged |
| `tell-emphasis-crutch` | 2 | not judged |
| `tell-knowledge-cutoff` | 2 | not judged |
| `tell-de-generic-conclusion` | 1 | not judged |
| `tell-double-hyphen-aside` | 1 | not judged |
| `tell-sycophancy` | 1 | not judged |
| `tell-title-case-heading` | 1 | not judged |

The right-hand column is a **co-occurrence, never an isolated effect**: the
pass removes several families from the same pair, so a high number does not
attribute the preference to that family. What the table does establish is the
negative — a family removed in no preferred pair did not carry the preference —
and that is what a binary verdict could not say at all.

## Scope note

This eval measures the package's own pattern counts and a blind prose-quality preference.
It never measures third-party "AI detector" outcomes — that claim class is banned
(unfalsifiable from our side; see roadmap non-goals).

## Open question — real-draft lift is unmeasured, and stays that way this round

The `before` fixtures were **deliberately tell-seeded**, so a perfect score
measures seeded-tell removal on a self-constructed corpus — NOT that real
ghostwriter drafts get better. Real-world lift is **unmeasured**.

Collecting it was declined for this round. Retaining real drafts, and
retaining metrics derived from real drafts, both create a new retention
practice beyond the fixture-only data-handling floor this package records,
and neither was authorized. That is a decision about this round: **future
authorization is neither granted nor refused**, and the owner-facing question
is unchanged. The claim ledger stays scoped to "on the fixture corpus"
accordingly, and widening it needs an authorization AND a measurement, not
either one alone.
