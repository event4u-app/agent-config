<!-- clean: token reference with stated scales and the rule for adding a value, no palette showcase -->
# Design tokens

Tokens are defined once in `tokens/base.json` and generated into CSS custom
properties. Do not write a raw hex value or a raw pixel value in a component.

## Colour

Two families carry the interface. Slate is the neutral ramp, ocean is the single
accent. Semantic tokens for success, warning and danger sit outside those ramps
because they must survive a theme swap.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--fg` | `#16202b` | `#e4eaf0` | Body text |
| `--fg-dim` | `#4d5a67` | `#97a4b2` | Secondary text, still 4.5:1 on its surface |
| `--bg-base` | `#ffffff` | `#121820` | Page background |
| `--bg-raised` | `#f4f6f8` | `#1b232d` | Panels, table headers |
| `--accent` | `#1f5f9c` | `#5fa2e0` | Links, selected state, primary button |
| `--danger` | `#9d2020` | `#e0736f` | Destructive action, error text |

## Spacing

A 4px base with a doubling ramp: 4, 8, 12, 16, 24, 32, 48, 64. Component padding
uses 8 through 24. Section rhythm uses 32 through 64. Nothing uses a value off
the ramp.

## Radius

Three steps only. `--radius-control` 6px for inputs and buttons,
`--radius-panel` 10px for cards and dialogs, `9999px` for single line tags.
A fourth step is a change request, not a local decision.

## Type

Sizes are declared in rem against a 16px root: 0.8125, 0.875, 0.9375, 1, 1.125,
1.375, 1.75, 2.25. Body line height is 1.6, headings 1.25.

## Adding a token

1. Open an issue naming the component that needs it and why an existing token
   does not fit.
2. If two components need it, add it to `base.json`. If one does, keep it local
   to that component's stylesheet.
3. Run `npm run tokens:build` and commit the generated CSS with the JSON change.

Generated files are never hand edited. A diff that touches only the generated
CSS is rejected in review.
