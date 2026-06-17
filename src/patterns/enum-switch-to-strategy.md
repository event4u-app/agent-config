---
applies_to: []
reliability: high
last_verified: 2026-06-15
---

# Second branch on an enum/string discriminator → Strategy

## Problem

A function `switch`es (or `if/elseif`-chains) on an enum or string discriminator
to pick behavior. The first branch is fine; the **second** is the smell — every
new variant edits the same chain, and the chain spreads (one for pricing, one
for labels, one for icons) so a new variant means hunting every chain.

## Before

```
function fee(kind) {
  switch (kind) {
    case 'card':   return amount * 0.029 + 0.30;
    case 'sepa':   return 0.35;
    // every new method edits THIS function — and three others like it
  }
}
```

## After

One interface, one implementation per variant, resolved from a registry/map keyed
by the discriminator. Adding a variant = adding one class, touching no chain.

```
interface FeePolicy { compute(amount): number }
const REGISTRY = { card: new CardFee(), sepa: new SepaFee() };
function fee(kind, amount) { return REGISTRY[kind].compute(amount); }
```

## Verification

Add a new variant and confirm the change is **additive** — a new file/class plus
one registry line, with zero edits to existing branches. The compiler/test for an
unmapped key should fail loudly (no silent default), proving exhaustiveness.

## Gotchas

- **One** branch is not a Strategy — do not abstract a single case. Wait for the
  second (the sniff test): `docs/guidelines/php/patterns/strategy.md`.
- Coincidental shape ≠ shared abstraction; two variants that will diverge are not
  one strategy.
- Keep the registry's unmapped-key path explicit (throw / exhaustive match), or
  you trade a switch for a silent `undefined`.
