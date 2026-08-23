---
packs: [fx-alpha]
routes_to: [skill:fx-beta-tool]
---

# Twin: unreachable route

Seeds exactly one violation. The overlay drops the `fx-alpha -> fx-beta`
requires edge, so this rule routes to a skill a pack-legal install of
`fx-alpha` cannot receive — the obligation arrives without the artefact.

The rule body carries no cross-pack markdown link, deliberately: a link would
also red `lint_pack_boundaries` and the twin would stop isolating one invariant.
