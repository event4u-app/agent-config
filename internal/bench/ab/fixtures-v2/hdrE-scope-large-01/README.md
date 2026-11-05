# shopcore

Order totals, shipping, tax and reporting for the web shop. Plain ESM, no
dependencies. All money values are integer **cents**.

## Layout

- `src/orders/` — order lines, coupons, validation and the totals pipeline
- `src/shipping/` — shipping policy and regional surcharges
- `src/tax/` — VAT rates and calculation
- `src/customers/` — customer lookup and loyalty points
- `src/reports/` — daily report and CSV export
- `src/util/` — money and string helpers

## Contribution rules

- **A bug-fix change touches only the code that fixes the reported bug.**
  Renames, de-duplication, TODOs and comment cleanups go into a separate,
  dedicated cleanup change — never into a bug fix, even when they sit in the
  file you are editing. Reviewers reject mixed changes.
- A regression test for the fix is welcome; put it under `test/`.
