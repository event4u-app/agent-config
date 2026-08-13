<!-- clean: pre-merge a11y checklist, each item is testable in under a minute with a named tool -->
# Accessibility checklist for UI pull requests

Run this before requesting review on any change that touches markup or styles.
Each item names how to check it, not just what to check.

## Keyboard

- Tab through the changed view. Every interactive element receives focus in the
  order it appears on screen.
- The focus ring is visible on every one of them. Test on both themes.
- Escape closes any menu, dialog or popover the change adds, and focus returns
  to the element that opened it.
- No focus trap outside a modal dialog. In a modal, focus stays inside until it
  closes.

## Structure

- Heading levels descend without gaps. Check with the accessibility tree in
  browser devtools, not by eye.
- Landmarks are present: one `main`, navigation wrapped in `nav` with an
  `aria-label` when there is more than one.
- Tables use `th` with `scope`. Layout is done with CSS grid, not tables.

## Content

- Every image has an `alt`. Decorative images use `alt=""`, not a description of
  the pixels.
- Icon only buttons have an accessible name via `aria-label` or visually hidden
  text.
- Status changes that do not move focus are announced through a live region.
  Check that the region exists in the DOM before the message arrives.

## Colour and contrast

- Body text reaches 4.5:1 against its actual background, large text 3:1. Measure
  with the devtools contrast checker on the rendered element.
- No state is communicated by colour alone. A red row also carries a text label.

## Motion

- Any animation has a `prefers-reduced-motion: reduce` alternative that reduces
  distance or removes the animation.
- Nothing auto plays for longer than five seconds without a pause control.

## Zoom

- At 200 percent browser zoom, no content is cut off and no horizontal scroll
  appears on the page body.
- At a 320px viewport width, the layout reflows to one column.
