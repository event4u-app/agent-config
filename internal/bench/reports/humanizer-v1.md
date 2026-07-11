# Humanizer paired eval — v1

> Generated 2026-07-11T12-02-29Z · corpus `tests/fixtures/ai-tells` (20 before/after pairs, 16 length-controlled ±25%).

## Objective — AI-tell reduction (deterministic)

| Metric (mean) | Before | After |
|---|---|---|
| Hard hits | 0.9 | 0 |
| Cluster score /500w | 53.97 | 0 |
| Dash density /500w | 9.22 | 0 |

## Blind preference (length-controlled)

Judge claude-sonnet-4-5: prefers the humanized text in **16/16** pairs (randomized A/B order, deterministic seed). An honest null here keeps the detector as a hygiene gate; the claim ledger only carries what this table shows.

## Scope note

This eval measures the package's own pattern counts and a blind prose-quality preference.
It never measures third-party "AI detector" outcomes — that claim class is banned
(unfalsifiable from our side; see roadmap non-goals).
