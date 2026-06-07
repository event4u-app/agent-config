# Domain watch — brand→token pipeline (deferred)

> Watch note per ADR-061 §8 fork D (council 2026-06-07,
> anthropic/claude-sonnet-4-5 + openai/gpt-4o converged D2: defer).

## What was deferred

Upstream `brand` sub-skill scripts — `sync-brand-to-tokens.cjs`
(algorithmic 50–900 color-scale generation from `brand-guidelines.md`)
and `inject-brand-context.cjs` (prompt injection) — from
`nextlevelbuilder/ui-ux-pro-max-skill` pinned at
`b7e3af80f6e331f6fb456667b82b12cade7c9d35` (the SHA pin prevents doc rot
if upstream refactors; re-check the path on reopen).

## Why deferred

Zero known consumers author `brand-guidelines.md`; porting two scripts
for a hypothetical workflow is premature engineering and a maintenance
treadmill against upstream churn. `design-tokens` ships complete without
it (starter template + grounded values from `design-intelligence`).

## Re-open trigger

First consumer demand: a user asks to derive a token system from brand
guidelines (logo colors → 50–900 scales). Then port to Python inside
`src/skills/design-tokens/scripts/` (same ATTRIBUTION discipline) and
feed `tokens.json` primitives from the brand file.
