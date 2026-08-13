<!-- clean: data table guidance with density, alignment, and pagination rules tied to concrete counts -->
# Data tables

## When a table is right

Use a table when the reader compares values across rows. If each record is read
on its own, a list of cards reads better and survives narrow viewports without
horizontal scroll.

## Column order

Identity first, then the column people sort by, then supporting detail, then row
actions. The identity column is a `th` with `scope="row"` so screen readers
announce it with every cell.

## Alignment

| Content | Alignment | Reason |
|---|---|---|
| Text | Left | Ragged right edge, stable left edge for scanning |
| Numbers | Right | Decimal points line up |
| Dates | Left | Read as text, not compared digit by digit |
| Status | Left | Sits next to the label it qualifies |

Numeric columns also set `font-variant-numeric: tabular-nums`, otherwise
proportional digits break the column even when the alignment is right.

## Density

Row height 44px with 8px vertical cell padding. Below 36px, pointer targets get
too small and the 24 by 24 CSS pixel target guidance fails. Offer a compact mode
at 36px only where a user opts in and rows carry a single line.

## Sorting

One sort column at a time. Reflect it with `aria-sort` on the header and make the
header a real `<button>`, so it is reachable by keyboard. Sorting does not move
focus and does not reset the scroll position.

## Pagination

Above 200 rows, paginate. Below that, render everything and let the browser
scroll. Infinite scroll breaks the footer and makes a specific row unreachable by
address, so it is not used in this product.

## Empty and error rows

Both render inside `tbody` as a single cell spanning all columns, so the table
keeps its header and the reader keeps the column vocabulary.

## Narrow viewports

Below 640px, the table scrolls horizontally inside a container with
`overflow-x: auto` and `tabindex="0"` so it can be scrolled by keyboard. Stacking
cells into blocks loses the comparison the table was chosen for.
