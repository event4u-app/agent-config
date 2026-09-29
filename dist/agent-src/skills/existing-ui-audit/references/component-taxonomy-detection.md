# existing-ui-audit — component-taxonomy detection

> Section-level entry point of the `existing-ui-audit` skill (progressive
> disclosure). Load this file when § 1b of SKILL.md routes here — it carries
> the detection rules and the boundary the step must not cross.

## What the detector answers

The question is *"has this project already chosen a way to organize its
components by granularity, and if so what does it call the tiers?"* — never
*"which taxonomy should this project use?"*. The recorded value is the
project's **own** tier directory names, in the project's own order, joined
with `/`, or `none`. Nothing canonical is ever written: a project with three
tiers records three, and a project whose tiers are called
`primitives / patterns / features` records exactly that.

## Three properties, each pinned by a test

- **Declared outranks inferred.** A `## Component taxonomy` section in the
  project's `DESIGN.md` (or `docs/DESIGN.md`) listing backticked directory
  names as list items wins, provided at least two of those directories exist
  under the component root. The name may be bolded — `- **\`atoms\`** — ...`
  is read exactly like `` - `atoms` — ... ``. Grounding the declaration against
  the tree keeps a stale doc from declaring a taxonomy the tree does not have,
  and a backticked name in prose rather than in a list item is a mention, not a
  declaration. This is how a project whose tiers appear in no vocabulary the
  detector knows still gets conformance. The first doc that *qualifies* wins:
  one with no section, or one naming fewer than two tiers that exist on disk,
  falls through to the next.

- **A folder that merely sounds like a tier is a collision, not a convention.**
  `components/{checkout,billing,molecules}` records `none`, and so does the
  ordinary kind split `components/{layout,pages,forms}` — `layout`, `page`,
  `block`, `element`, `part` and `cell` are all everyday folder names as well
  as granularity words. Inference needs at least two tier-shaped buckets **and**
  more than two thirds of the weighed ones; support folders (`hooks`, `utils`,
  `types`, `lib`, `styles`, …) are left out of the denominator, so three
  ordinary siblings cannot hide a taxonomy that is really there. Each floor has
  its own fixture, because at one hit in three buckets either floor alone would
  still refuse and neither would be tested.

- **`none` is a real answer, not a failure.** A flat tree, an unreadable tree,
  a missing component folder, a permission error: all record `none`, and every
  downstream step then behaves exactly as it did before this detection
  existed. Detection never throws — degrading to `none` is the safe direction,
  because `none` is precisely the value that leaves the project's own
  structures untouched.

## The boundary

Never write a taxonomy the project does not evidence, and never "tidy" an
existing layout into one. Holding to the project's own structures is the
standing rule; this step exists to *find* that structure, not to supply one.
The single place a taxonomy is ever *offered* is the greenfield halt in § 7,
and a decline there is terminal.
