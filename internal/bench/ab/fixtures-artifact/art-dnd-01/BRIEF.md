# Brief — reorderable priority list

Build `out/index.html`: a self-contained page (inline CSS and JS, no network, no
libraries) where a person puts four tasks in priority order. The ids and
attributes below are the contract the product's own tests use; keep them exactly.

## Content

- A list `#tasks` with four items, in this order: `Alpha`, `Beta`, `Gamma`,
  `Delta`. Each item is an `li` with class `task` and `data-id` `a`, `b`, `c`,
  `d`, and shows its name.
- A panel `#detail` beside the list that names the item at the top of the list
  ("Top priority: Alpha") and updates whenever the order changes.
- A switch `#compact` that turns compact mode on and off. It is a custom
  control, not a checkbox: `role="switch"`, `aria-checked`, an accessible name,
  operable by click and by the Space key. Compact mode reduces the item padding.
- A polite live region `#announce` that tells a screen-reader user what happened
  after every move ("Gamma moved to position 1 of 4").

## Reordering — three ways, same result

Dropping an item onto another item puts it **before** that item.

1. **Mouse:** press on an item, drag it onto another item, release.
2. **Touch:** the same gesture with a finger on a phone or tablet.
3. **Keyboard:** every item is focusable. Space picks the focused item up,
   Arrow Up / Arrow Down move it one position, Space drops it, and Escape cancels
   and puts it back where it was. The moved item keeps focus.

## Layout

- From 900 px wide, `#detail` sits to the right of `#tasks`.
- Below 600 px, `#detail` sits below `#tasks`, and nothing scrolls sideways.
