<!-- clean: motion rules tied to purpose, duration ranges, and the reduced-motion contract -->
# Motion

Motion in this product explains a change of state. If a reader cannot say what
the movement told them, the movement is decoration and does not ship.

## Durations

| Change | Duration | Easing |
|---|---|---|
| Hover and focus feedback | 100 to 150ms | `ease-out` |
| Menu or popover open | 150 to 200ms | `ease-out` |
| Dialog open | 200 to 250ms | `ease-out` |
| Anything leaving the screen | 100 to 150ms | `ease-in` |

Entrances are slower than exits. A reader waits for something arriving and does
not wait for something going away.

## What may be animated

`opacity` and `transform` only. Both are handled by the compositor and do not
force layout. Animating `height`, `width`, `top` or `padding` recalculates layout
each frame and stutters on mid range hardware.

For a height change that genuinely needs to animate, use a grid row template
between `0fr` and `1fr`, which browsers now interpolate, or measure and animate
`transform: scaleY()` on a wrapper.

## Properties are enumerated

```css
.menu__item {
  transition:
    background-color 120ms ease-out,
    color 120ms ease-out;
}
```

List the properties. A blanket shorthand animates layout properties you did not
intend to touch and makes every future style change a potential jank source.

## Reduced motion

Every animation carries an alternative:

```css
@media (prefers-reduced-motion: reduce) {
  .menu {
    animation: none;
  }
}
```

Prefer removing distance over removing feedback. A fade with no travel still
tells the reader that something appeared, and it does not trigger vestibular
symptoms the way a slide does.

## Loading

Below 300ms show nothing. A spinner that appears and vanishes reads as a glitch.
Between 300ms and 2s show a spinner. Beyond 2s show progress with a count, so
the reader can tell the difference between slow and stuck.
