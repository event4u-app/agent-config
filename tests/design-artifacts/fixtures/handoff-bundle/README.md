# Handoff-bundle fixture

The input of `daf-handoff-bundle` (see
[`../../eval-fixtures.md`](../../eval-fixtures.md)): a handover that arrives as
a **bundle** rather than as one self-contained page.

| Half | File | Role |
|---|---|---|
| Markup | [`../design.html`](../design.html) | the existing port fixture, unchanged |
| Tokens | [`design-system.json`](design-system.json) | the machine-readable authority for colour, type, space, radius |

Two deliberate choices:

- **`design.html` is not duplicated here.** The port fixtures state that there
  is one ground-truth artifact and no second fixture set; a bundle is that same
  artifact plus a sidecar, so copying the markup would create the divergence the
  fixture exists to catch.
- **The sidecar is named `design-system.json`**, not `tokens.json`, because that
  is the filename the shipped consumer names — the `design` gate's
  `design_provided_without_contract` ambiguity resolves with *"user supplies a
  design-system.json (honoured verbatim)"*
  (`work_engine/directives/ui/design.ts`). A fixture that invented its own
  filename would exercise nothing.

## What the split is for

A single-file handover lets an agent read values off the markup. A bundle names
an authority: with `design-system.json` present, `#c96442` is
`color.terracotta`, and a port that hardcodes the hex has lost the binding even
though the pixels match. The bundle also closes the first two entries of
`UNCARRIED_BY_THE_BRIEF` (exact spacing values, easing/timing) — the remaining
three stay uncarried and must still be stated before any regeneration.

## Extending it

Adding an asset half (`assets/`) is the obvious next shape and is deliberately
absent — `UNCARRIED_BY_THE_BRIEF` lists the asset manifest as closed only by the
coverage report `apply` demands, so a fixture asset half would have no consumer.
Add it with the consumer, not before.
