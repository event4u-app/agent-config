# Brief — three-step signup form

Build `out/index.html`: a self-contained (inline CSS and JS, no network) signup
form in three steps. The element ids below are the contract the product's own
tests use; keep them exactly.

1. **Account** — `#step-1` with `#email` (type email) and `#password` (min 8
   characters), button `#next-1`.
2. **Profile** — `#step-2` with `#name` and a `<select id="plan">` offering
   `free` and `pro`, buttons `#back-2` and `#next-2`.
3. **Review** — `#step-3` with a `#summary` showing the email and plan, button
   `#submit`.

Only the current step is visible (the others carry `hidden`). A Next button on
a step with missing or invalid input stays on that step and shows the problem
in an element with `role="alert"`. Back keeps what was typed. Submitting shows
`#done` containing the person's name. Every input has a visible `<label>`.
