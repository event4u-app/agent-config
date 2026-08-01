# Design Fidelity — Mechanics

> Surgical-edit discipline, asset & imagery floor, and the failure-mode catalog for the `design-fidelity` rule

_Origin: migrated from `src/rules/design-fidelity.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, the `design.fidelity_mode` strictness table, and the fire/not-fire scope stay in the rule; this file carries the illustrative depth._

## Surgical visual edits

A request to change one visual thing — a colour, a label, a single element — is
a **targeted edit**, not a redesign licence. Apply the same
`minimal-safe-diff` discipline to design work that backend edits have
always owed.

- **Change only the semantic target.** Preserve the surrounding layout,
  spacing, typography, dimensions, content, animation, and interaction states.
  Do not rewrite the component, reflow the section, or "modernise" neighbours
  while you are in there. (fixtures: `daf-edit-preservation`, `daf-unwanted-variations`.)
- **A broader redesign needs an explicit trigger.** Only phrases like *"new
  direction"*, *"from scratch"*, *"make it feel premium"*, *"rework the flow"*,
  or *"give me variations / options"* license a from-scratch rework. Absent such
  a phrase, a "fix / change / update the X" request is surgical — when unsure
  which, ask (`ask-when-uncertain`). (fixture: `daf-redesign-trigger`.)
- **Preserve stable anchors.** Where the host exposes DOM/comment metadata, keep
  comment anchors and screen labels intact so the edit stays locatable. Where
  the host has no such surface, preserve stable semantic anchors already present
  in source comments / `data-*` attributes — never strip them, and do not invent
  new ones.

## Asset & imagery discipline

Visual artifacts carry **real assets or honest placeholders — never fabricated
brand evidence**. The design-surface instance of the no-invented-facts floor.

- **Copy owned assets through the project's accepted path.** Reference or copy
  project-owned assets (logos, icons, fonts, images) via the target project's
  asset directory/pipeline — never hotlink a design-system's internal URL, never
  bulk-copy a huge source folder. (fixtures: `daf-missing-asset`, `daf-external-asset-url`.)
- **Third-party asset delivery is self-hosted by default — this section owns that
  decision.** An asset whose delivery path crosses a third party (a webfont from
  a font CDN, an icon set from a CDN, a hosted stylesheet) transmits the
  **visitor's IP address** to that third party on every page view. Deliver it
  through the target project's own route instead — the framework's font/asset
  primitive, a bundled package, or a locally-served file. A third-party hotlink
  is emitted **only** on an explicit consumer opt-in, and the opt-in is stated
  with what it transmits — never chosen silently because it is the shorter line.
  A discovery URL is not a delivery URL: keeping a font's browse/share link as
  *where to find it* is fine. Ownership: this bullet is the single owner of the
  third-party delivery decision ([`ADR-205`](../decisions/ADR-205-webfont-delivery-ownership.md));
  emitters (`typography-system`, UI-apply directives, brand-asset paths) are
  consumers and point here rather than restating it. (fixture:
  `daf-webfont-delivery`.)
- **Real imagery where inspection matters.** On visual pages/decks, use actual
  product / place / object / state imagery where the image IS the proof (a
  product screenshot, a real dashboard state). Decorative atmosphere is not proof
  — never pass a stock-like or invented image off as the real product. An
  invented product screenshot is fabricated evidence. (fixture: `daf-invented-screenshot`.)
- **Icons follow the iconography floor** — no emoji-as-icon in serious UI, no
  hand-rolled icon when a set exists; see the `iconography` skill § Iconography floor.
- **Ask before adding material — no unrequested filler.** Never generate copy,
  placeholder sections, or decorative blocks the user did not ask for to "complete"
  a design. Brief silent on a region → surface the gap (`ask-when-uncertain`)
  or leave an honest placeholder; never invent filler to fill space.

## Provided-artifact precedence

```
PROVIDED ARTIFACT  >  ANTI-SLOP  >  HOUSE TASTE.
THE EXEMPTION COVERS ONLY DECISIONS THE ARTIFACT ACTUALLY COVERS.
IT NEVER COVERS GENERATIVE WORK IN THE SAME RUN.
```

The anti-slop catalog exists to stop an agent's *first impulse* from becoming
the design. A handed-over artifact is not a first impulse — it is a decision
the user already made. Applied to a port, the catalog inverts: it argues the
agent out of the spec it was told to reproduce.

Concretely, a faithful port of a cream/terracotta artifact trips
`slop-c5-cream-palette`, and the artifact's own copy trips
`slop-cp1-em-dash`. Both findings are **correct about the pattern and wrong
about the action**. On a port they are cited as *"matches provided spec"* and
nothing acts on them.

**Scope — three things this does NOT license:**

1. **Decisions the artifact does not cover.** A port usually needs states the
   source never showed (loading, error, empty). Those are generative, and the
   full anti-slop scan applies to them. "The artifact was cream" does not
   exempt an invented empty state from L1 or V1.
2. **Silence.** An artifact-covered finding stays in the review output with its
   rule id, marked informational. Suppressing it outright would hide from the
   user that their spec carries a known tell — which they may want to know
   before shipping it.
3. **Registered brand tokens.** A supplied artifact outranks house taste, not
   the consumer's own brand (`brand-source-of-truth`). Artifact-vs-brand
   conflicts are surfaced, never merged.

**The mechanical half.** A review finding carries `artifact_covered: true`, and
the polish gate drops those from the round-driving set *before* the ceiling
check, so a port cannot burn its two rounds on findings it was never allowed to
act on (`directives/ui/polish.ts`, `partition_artifact_covered`). Marking rather
than deleting is deliberate: the finding stays visible, only its authority to
force a round is removed. The burden sits with whoever sets the flag — an
unmarked finding is treated as actionable, so the default failure direction is
"we asked" rather than "we silently kept it".

Regression witness: `daf-slop-vs-provided`.

## Failure modes

- Swapping the prototype's font / typeface because another "reads better".
- Replacing a specified control (slider, stepper, chip) with a different control.
- Dropping or adding an element the prototype shows ("+", a send→stop toggle, a warning chip).
- Restructuring layout or moving sections "because the flow is better".
- Treating an internal "honesty gate" or "stub" concern as licence to redesign the UI.
- Re-running a redesign after the user already said "match the prototype".

## How to surface a deviation — do NOT execute it

Name what the spec shows, what you would change, and why — as a numbered option
per `user-interaction`. The user picks. Honesty about **behaviour** (a control
not yet wired) never licenses changing the **design**: a faithful visual plus a
labelled "not wired yet" note beats an invented redesign.

## Fixtures

Behavioral baseline: the `daf-*` fixtures named above (edit preservation,
unwanted variations, redesign trigger, missing asset, external asset URL,
invented screenshot).

## See also

- `design-fidelity` (rule) — Iron Law + `design.fidelity_mode` strictness table.
- `brand-source-of-truth` / `brand-consistency` — same precedence shape, for registered brand tokens.
- [`design-modes.md`](design-modes.md) — brand vs product register discriminator.
