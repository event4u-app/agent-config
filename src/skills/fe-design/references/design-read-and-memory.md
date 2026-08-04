# fe-design — design read and memory

> Section-level entry point of the `fe-design` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

## Cross-task design memory — read DESIGN.md / PRODUCT.md first

Before applying any heuristics from this reference, check the project root
for `DESIGN.md` and/or `PRODUCT.md` (written by `design-system-capture`):

- `DESIGN.md` present → use its captured radius/shadow/motion/spacing as
  project constraints. The heuristics in this skill are **fallbacks for
  gaps**, not overrides for captured decisions.
- `PRODUCT.md` present → honor its interaction patterns (empty-state approach,
  mutation feedback policy, filter persistence) in any UI design that touches
  those surfaces.

Flag any new decision for future capture: *"This establishes a new pattern —
suggest adding to PRODUCT.md: [pattern description]."*

## Register — brand vs product

Before applying heuristics, determine the register (see
[`docs/guidelines/design-modes.md`](../../../docs/guidelines/design-modes.md)):
brand mode (impression-first) vs product mode (task-first). Form-heavy, table-heavy,
and dashboard surfaces are almost always product mode — favour the standard
patterns in this skill (Form Design, Table Design) over expressive variance.
Marketing/landing surfaces are brand mode — let the Aesthetic-direction section
commit to a deliberate, distinctive direction.

## Design Read — articulate intent before generating

When this reference is cited for a UI planning task, emit one line declaring
the design read before any heuristics are applied:

```
Reading this as: <page-kind> for <audience>, <vibe> language, leaning <design-system>.
```

**If context is incomplete:** state so and proceed exploratory — do NOT block.

**Anti-Default Discipline:** Before committing to any layout or component
pattern, cross-check your first impulse against
[`design-antipatterns.md`](../../../docs/guidelines/design-antipatterns.md) —
the L1/L2 "AI landing page" layout (centered hero + 3-column grid + CTA), the
V1 side-stripe card, the T7 default-font pick, and V2 decorative glassmorphism.
If a tell was the first impulse, choose a different approach or explicitly
justify why this brief calls for it. (The full pre-proposal scan is under
*Anti-slop discipline* below.)

**Carve-out — a supplied artifact is the spec, not a first impulse.** This
discipline governs what *you* reach for. When the user hands over a finished
artifact, the choices it makes are not your impulses and the justify-or-change
burden does not apply to them: build them as given. The carve-out is scoped to
decisions the artifact actually covers — anything it leaves open (a state it
never shows, a surface it never had) is your first impulse again and gets the
full scan. See
[`design-fidelity-mechanics`](../../../docs/guidelines/design-fidelity-mechanics.md)
§ Provided-artifact precedence.

## Aesthetic direction

Audit-pinned tokens and components always take precedence (see `existing-ui-audit`). When the audit pins an aesthetic, honor it without deviation. When the audit shows **no pinned aesthetic** — greenfield surface, marketing landing page, brand-new feature without design-system precedent — the design brief is allowed (and expected) to commit to a deliberate direction instead of defaulting to safe centered hero + 3-column features + CTA.

Typography pairings (73 curated heading/body combinations with Google
Fonts URLs + Tailwind config) and icon-system guidance (104 Phosphor
entries with import code) come grounded from
[`design-intelligence`](../design-intelligence/SKILL.md)
(`--domain typography`, `--domain icons`) — query before picking from
memory.

Pick one direction up front and let composition, typography, and color follow from it. Avoid the "neutral AI default": uniform grid, system fonts as the visible body face, purple-to-blue gradients on white, predictable spacing. A direction that fits the brand intent (editorial / brutalist / refined / playful / retro / maximal / minimal / etc.) and is consistent across the page beats hedging.

Surface the chosen direction in the design brief as a one-line statement (e.g. `aesthetic: editorial-magazine — asymmetric grid, serif display + sans body, generous gutters`). The apply step (`react-shadcn-ui` / `blade-ui` / `livewire` / `flux`) reads this line and matches typography, spacing, and motion to it; if no line is present, the apply step uses project defaults.
