# Gesture mechanics

How a surface that the user drags, flicks or pulls should move. Read it when
you build a sheet, a drawer, a swipeable card, a slider, a reorderable list or
anything else whose position follows a pointer. Durations, easing and the
bounce rule stay where they live — `design-patterns.md` § Motion; this file
covers what a gesture adds on top.

## Respond at contact, not at release

- **Feedback on pointer-down.** The pressed state, the lift, the grab cursor
  appear when the pointer goes down. Waiting for `click` or `pointerup` adds
  the whole press duration to the perceived latency.
- **Every millisecond in the input path is a regression.** No debounce, no
  `setTimeout`, no layout read in the `pointermove` handler; write `transform`
  only, and batch through one `requestAnimationFrame`.

## Follow the hand 1:1

- **Keep the grab offset.** Record where inside the element the pointer went
  down and keep that point under the pointer; snapping the element's origin to
  the pointer makes it jump on the first frame.
- **Capture the pointer.** `element.setPointerCapture(event.pointerId)` on
  pointer-down, so a fast drag that leaves the element keeps delivering moves.
  Release it on `pointerup` and `pointercancel`.
- **Hysteresis before deciding the axis.** Let the pointer travel about 10 px
  before committing to "this is a horizontal drag" versus a scroll; deciding on
  the first pixel steals scrolls from the page.

## Hand the motion back to physics

- **Carry the release velocity.** Measure velocity over the last ~50–100 ms of
  moves and start the settle animation with it. An animation that starts at
  rest after a fast flick reads as the surface catching on something.
- **Project momentum to choose the destination.** The resting point is where
  the surface would coast to, not where the pointer let go — an exponential
  decay of the release velocity, then snap to the nearest legitimate stop
  (open, closed, the next card).
- **Start every animation from the current on-screen value.** Read the live
  transform, never the last target, so an interrupted animation retargets
  without a jump. A CSS transition retargets but drops velocity; for a
  gesture-driven settle use a spring or WAAPI.
- **Overshoot only under momentum.** A settle that carries real release
  velocity may overshoot slightly — this is the `momentum-carried` class in
  `design-patterns.md` § Motion. Everything else settles critically damped.

## Edges and symmetry

- **Rubber-band past a limit.** Beyond the first or last stop, move the
  surface by a diminishing fraction of the pointer travel (for example
  `limit + overflow * 0.55 / (1 + overflow / dimension)`) instead of stopping
  dead or following 1:1.
- **Enter and exit along the same path.** A sheet that rises from the bottom
  leaves through the bottom; a menu grows from and returns to its trigger.
  Set `transform-origin` at the trigger.

## Accessibility

- **Every gesture has a non-gesture equivalent** — a button, a keyboard
  shortcut, arrow keys — because a pointer gesture is not available to every
  user.
- Under `prefers-reduced-motion: reduce`, drop the momentum and overshoot and
  move straight to the destination; keep the 1:1 tracking, which is direct
  manipulation rather than decoration.
