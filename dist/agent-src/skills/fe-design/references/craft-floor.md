# Craft floor — load this immediately before the write

Universal floors. They do not vary by surface mode, register, change intent or
stack. Taste and direction stay mode-scoped in
[`fe-design`](../SKILL.md); nothing on this page is a preference.

**Why this is a separate page rather than inline.** The skill body used to carry
these inline, on the argument that "loaded" should mean the content is in
context. That argument is kept and the delivery point moved: a floor read at
*skill-load* time can be many turns and a compaction away from the write it
governs, and `ADR-227` records that a path-scoped carrier is not re-injected
after `/compact`. This page is pulled **immediately before the write**, which is
the moment the floor has to be present. Same content, later delivery.

## The floors

1. **Reuse tokens, never raw values.** A hex, font or px literal where the audit
   found a token is off-brand by construction.
2. **All five states are designed.** `empty` is a helpful message, not a blank
   region. `loading` prefers a skeleton over a spinner — it shows structure, so
   it reads as faster. `error` says what to do next.
3. **Labels are always visible.** No placeholder-only inputs.
4. **Validate on blur and on submit**, never on every keystroke. The message
   goes below the field and is specific.
5. **Mobile-first, and 320 px actually works.** Default styles are the small
   viewport; complexity is added at larger breakpoints, never removed at smaller
   ones. `agent-config ui:render` captures 320 px so this is measurable rather
   than asserted.
6. **Accessibility minimums are non-negotiable.** 4.5:1 contrast for text (3:1
   large), every interactive element reachable by Tab, a visible focus ring,
   semantic elements over `div`, and an `aria-label` wherever there is no
   visible text.
7. **Every action gets feedback.** Users read silence as failure.
8. **Prefer undo over a confirmation dialog.** Confirmations get clicked
   through; an undo affordance actually protects the user.
9. **Tables:** numbers right-aligned, text left-aligned, a designed empty state,
   and a sticky header on anything long enough to scroll.
10. **No placeholder microcopy ships.** Lorem ipsum, `TODO` and
    `[Your text here]` are unfinished output, not drafts.
11. **A default font pick is declared or changed.** Inter, Roboto, DM Sans,
    Geist, Space Grotesk and Instrument Serif are the AI defaults. In the
    product register "one reliable family" is a complete reason — but state it.
    An undeclared pick is an undeclared choice (T7).
12. **Zero silent drops.** A mechanic present in a supplied source and absent
    from the output, with no `flagged` entry, is a silent drop.

## What is NOT on this page

Density, hierarchy, expressiveness, palette character, type personality,
motion register. Those are surface-mode and register decisions and they live in
`fe-design`. Putting them here would make a preference look like a floor, which
is the failure this split exists to prevent.
