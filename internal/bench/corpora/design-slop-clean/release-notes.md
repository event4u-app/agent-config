<!-- clean: dated release notes stating behaviour changes and their user-visible effect -->
# Release notes

## 3.4.0, 8 March 2026

### Changed

- Table headers are now `<button>` elements when the column is sortable. Styling
  is unchanged, but the header is reachable by keyboard and announces its sort
  direction. If you overrode `.ledger__head-cell` with a `span` selector, update
  it to target `.ledger__sort`.
- The toast timer pauses on hover and on focus. Error toasts no longer dismiss
  themselves at all and must be closed by the reader.

### Fixed

- The account menu stayed open after navigating with the browser back button.
  It now closes when the route changes.
- `Dropzone` rejected files whose type the browser reports as an empty string,
  which happens for CSV files on some Windows configurations. The extension is
  now checked as a fallback.
- Focus outlines were clipped on the first and last table rows because the row
  had `overflow: hidden`. The outline is drawn with `outline-offset: -2px`.

### Removed

- `Card` no longer accepts `elevated`. Use `surface="raised"`. The prop has
  warned since 3.1 and is gone now.

## 3.3.2, 24 February 2026

### Fixed

- Number columns used proportional digits in Safari 17, so amounts did not line
  up. `font-variant-numeric: tabular-nums` is applied on the cell rather than
  the table.
- The skip link was focusable but invisible against a dark header.

## 3.3.1, 17 February 2026

### Fixed

- `PlanSelector` did not forward its `name` prop, so two selectors on one page
  shared a radio group and unset each other.

## Upgrade notes

3.4.0 is a minor release with one markup change, listed above. Applications that
do not style table headers by tag name need no code change.
