---
name: fx-alpha-anchor
packs: [fx-alpha]
---

# Twin: undeclared cross-pack link

Seeds exactly one violation. The overlay drops the `fx-alpha -> fx-beta`
requires edge from `packs.yml` (see the twin's `packs.yml`), so the link below
now crosses a boundary the source pack does not declare — dead the moment a
consumer installs `fx-alpha` without `fx-beta`.

- still legal, same pack: [helper](../fx-alpha-helper/SKILL.md)
- still legal, always installed: [shared](../fx-core-shared/SKILL.md)
- **the seeded violation**: [tool](../fx-beta-tool/SKILL.md)
