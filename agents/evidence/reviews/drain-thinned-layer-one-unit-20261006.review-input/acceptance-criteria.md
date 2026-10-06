## Acceptance Criteria

- [x] AC-1 — One command on a fixture install prints unconditional,
      path-scoped and package-owned characters for the thinned layer.
      Closed by steps 1.1 and 1.2, verified 2026-10-06 on a real opted-in
      install: `installed_layer_report --home <fixture>` prints
      `107058 chars (93357 unconditional + 13701 path-scoped), 105
      package-owned / 0 foreign` on one line, with ownership resolved from
      the global deploy inventory.
- [x] AC-2 — No file under `src/` other than `thin_rules.ts` contains the
      marker text, or any substring of it used as a detector, as a literal.
      Verified 2026-10-06 with a positive control first (`grep -rFl` over
      `src/` finds `thin_rules.ts`, so the search works): the full marker and
      every detector-shaped substring of it return that file and nothing else.
      The two gates that held their own copy import the constant since 2.1.
- [x] AC-3 — The opted-in fixture stands at least 4,000 unconditional
      characters lower than at `df377ca64`, every stub is still recognised by
      all three detectors, and every stub still states that its body is to be
      loaded on a match.
      Measured 2026-10-06: 97,496 -> 93,357 unconditional on one tree and one
      root, a drop of **4,139**. Normalised to the pin's 45-character prefix
      the before-reading is 89,130 — the pin's own figure — so the after is
      84,991, 4,139 under it. Detectors: `thin_marker_single_spelling` and
      `thin_marker_unique_in_corpus` run every emitted stub past all three in
      both directions; the marker still contains `Load`, `body` and `match`,
      asserted as its own case.
- [x] AC-4 — The page states, for the recorded ceiling, the measured reading,
      each remaining move with its owner and price, and both sums.
      Closed by 3.1 and 3.2, plus a third sum added after the 4.1 council
      found the first two excluded the largest row they claimed to include.
- [ ] AC-5 — Each of the four rules has a council record about its law
      heading, every member that left `no_stub` did so in the change that
      record is about, and the page states the reading after those changes in
      the unit the council named. <!-- blocked-by: law-heading-authoring-not-named-in-this-contract | asked: no — a background drain lane has no owner channel; the decision is recorded for the next owner-facing turn -->
