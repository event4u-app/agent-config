# Film motion — the carrier for time-based film

This file is the **sole carrier** of motion values for a code-rendered film: a
page that computes every frame from a timestamp, is captured headless and is
encoded. Interactive UI motion is governed by the `fe-design` skill's
`references/design-patterns.md` § Motion, and neither carrier borrows the other's numbers. Both are bound by
`src/scripts/lint_motion_authority_drift.ts`: this file's overshoot bound is
parsed from the line below and every row of `../data/recipes.csv` is checked
against it.

## Values

- **Spring overshoot bound: 5 %.** A closed-form spring may overshoot its target
  by at most this much and must settle without a second visible swing. *Why:* a
  small overshoot reads as mass; a larger one, or an elastic or bounce curve,
  draws the eye to the curve instead of the subject. Elastic and bounce easing
  are banned in film exactly as in UI — only the bounded spring is admitted.
- **Shot length.** A shot holds at least one beat and rarely more than four
  bars; without a grid, 1.5–4 s per shot for a 15–30 s film. *Why:* shorter
  reads as noise, longer as a dead hold.
- **Hold rule.** A still frame lasts only as long as its text takes to read:
  **3 words per second**, never less than 0.8 s for a label or 1.2 s for a
  sentence. Anything longer than that with no change is dead time, and the film
  profile reports it.
- **Transitions are continuity.** A transition moves or morphs an element that
  persists across the cut. A crossfade between unrelated frames is the most
  common film tell after glows; use it only for a deliberate time jump.
- **Motion has a source and a destination.** Nothing enters from nowhere and
  nothing drifts without a reason in the story.
- **One accent colour, held across scenes.** A second accent needs a reason the
  viewer can name.
- **Successive text has separate in and out timing.** The outgoing line leaves
  before the incoming line arrives; overlapping text is a defect.
- **Flash floor.** No more than three flashes in any one-second window, a flash
  being a pair of opposing changes of at least 10 % relative luminance where the
  darker state is below 0.8; saturated red counts separately and with the same
  limit. This is a safety floor, not a style: no brief, flag or recipe lowers it,
  and the film profile fails a film that crosses it.

## Build — the seek contract

The page is a pure function of time. Full contract:
[`docs/contracts/film-page.md`](../../../../docs/contracts/film-page.md).

- Expose `window.__seek(t)` (seconds; synchronous or returning a promise) that
  sets **all** visible state for time `t`, or `window.render(t)` with the same
  meaning.
- Expose `window.__videoMeta = { width, height, duration, fps }`.
- No state from the wall clock (`Date.now`, `performance.now`), no
  `requestAnimationFrame` loop driving state, no CSS animation or transition
  running live; randomness only from a seeded generator.
- Fonts and images are local files; the film profile runs with the network off.

## Renderers

Plain HTML plus the seek contract is the default: it needs nothing beyond the
headless browser and ffmpeg the film profile already uses. Other renderers are
detected and routed, never bundled; `../data/renderers.csv` carries each one's
licence and setup cost. One React-based renderer requires a paid company licence
above three employees — the licence column is read before it is suggested.
