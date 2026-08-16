# Snapshot preference order — what to capture a design system FROM

When a design system has to be captured out of a running project — for a
handoff, an external design pass, or a reference bundle — there is more than one
thing you could point at, and they are not equally good. This is the preference
order, highest fidelity per unit of effort first.

**Take the first level the project supports. Do not skip down the list for
convenience, and do not skip UP it for thoroughness** — Level C is additional
evidence, never a replacement for Level A.

## Level A — source-level (always available, the default)

The involved component sources, plus the token layer (DTCG / CSS custom
properties), plus the page composition that assembles them.

**Why this is the default and not the fallback**, which is the part that reads
backwards until you have seen the alternative: in a component project, a
rendered DOM dump is *worse* input than the sources it came from. Hydrated
markup is utility-class soup with the component boundaries erased — the very
structure a design system is made of is the structure rendering destroys. A
reader (human or tool) reworks clean sources far better than expanded markup.

Level A needs no dev server, no browser, and no network. It is available in a
bare checkout, which is why it is also the only level that always works.

## Level B — SSR fetch (no browser)

When the stack renders server-side and a dev server is running, an ordinary
HTTP fetch of the rendered page.

Use it to answer what Level A cannot: what the composition actually resolves to
for a given route — conditional branches taken, data-dependent states, the real
class strings after server-side composition. Zero browser dependency, so it
stays cheap.

Level B **supplements** Level A. Capturing B alone leaves you with the soup
problem above and no component boundaries.

## Level C — rendered snapshot (consumer tooling only)

If the project already carries a browser-automation tool, or a DevTools bridge
is available in the session, additionally capture a screenshot plus a
computed-style extract as visual ground truth.

**Capability-detect, never hard-depend.** Level C is available when the consumer
already has the tooling; it is never a reason to install a browser stack, add a
dependency, or fail a capture. A project without it captures at A (and B where
applicable) and says so.

Of the two artefacts, **the screenshot is the valuable part** — it is the only
one that records what a person actually sees. The DOM dump is supplementary and
carries the erasure problem Level A exists to avoid.

## Every snapshot records the source revision

Whatever level was captured, record the git SHA the capture was taken at.

This is the anchor that makes a return leg possible: without it, reworked output
cannot be diffed against what was sent, and a capture from an unknown state is
evidence about nothing in particular. It costs one line and it is the difference
between a snapshot and a screenshot.

## State the level in the output

A capture says which level it reached and why it stopped there — "Level A + B;
no browser tooling detected, so no visual ground truth". A consumer reading the
bundle can then tell *absent because unavailable* from *absent because
overlooked*, which is the same distinction the extraction floor draws for
not-extractable values.

## See also

- [`design-system-json.md`](design-system-json.md) — the import contract the
  captured artefact is emitted against.
- [`../SKILL.md`](../SKILL.md) § Design-system extraction floor — what a
  complete extraction carries once the source has been chosen.
