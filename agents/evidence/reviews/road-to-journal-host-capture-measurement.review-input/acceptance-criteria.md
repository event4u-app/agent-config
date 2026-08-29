## Acceptance Criteria

- [x] AC-1 — A per-(platform, event) obtainability table exists in the evidence
      page with no blank cell, so "we did not look" and "the host does not
      publish it" are distinguishable.
      MET: all 80 cells in `journal-host-capture-2026-08-29.md` § AC-1 (6 `counted`, 34 `emits-but-uncounted`, 40 `not-bound`), plus the derivation record in `host-denominator-obtainability-2026-08-29.md`. The `stop` row was re-opened on new evidence during 2.1 — a host-authored `hookInfos` record naming `--event stop` — and still resolves to `emits-but-uncounted` because that artefact is written selectively and under-counts; the three refused candidates read 305 / 95 / 7 on one session and are recorded in code as `STOP_CANDIDATES`.
- [x] AC-2 — A denominator exists and its record type is asserted against a
      committed key set, with a free-form write failing to type-check — the same
      privacy property the journal's own record carries.
      MET: `HostDenominator` in `src/scripts/_lib/host_denominator.ts`. `DENOMINATOR_RECORD_KEYS` is bound to the type in both directions; `_RecordCarriesNoFreeFormField` applies the journal's own exported `NoFreeForm` guard — imported, not re-implemented, so the two halves of the ratio cannot drift. **Observed, not argued:** admitting `payload` to the record reds `npm run typecheck` with `host_denominator.ts(220,5): error TS2344: Type 'false' does not satisfy the constraint 'true'` and reds 10 of 20 tests; a second, independent probe binding `journal-record` to `claude` `pre_tool_use` reds exactly 1 of 20 — the manifest-binding assertion — with the other 19 green, so each probe is targeted rather than a blanket break. Both reverted from explicit backups and re-verified: 20/20 green, typecheck clean, eslint clean.
- [x] AC-3 — The published rate carries numerator, denominator, population and
      install configuration in one caption; a reader can tell which population
      it is over without reading any other file.
      MET: the first block-quote of the evidence page carries all four in one caption, and the second does the same for the opted-in population. Both are labelled, and the page states in its own words that neither is "the" capture rate.
- [x] AC-4 — The dispatch-path figure is not reported as the host figure
      anywhere in the evidence page, and the page says why the two are not
      comparable.
      MET: § AC-4 of the evidence page. The 100.00 % / 1,000-envelope figure appears only inside that section, named as a floor on the writer, with the reason the two are incomparable stated as a difference of kind — the dispatch denominator is authored by the test, this one by the host — rather than of size. The same section records that a replay was considered as a closure option and refused for the same reason.
- [x] AC-5 — Both blockers above carry a recorded choice, or this roadmap closes
      on the `host-denominator-obtainability` option (c) finding with the survey
      as its evidence.
      MET on the first branch: `host-denominator-obtainability` → **(b)**, resolved by a measurement that falsified the prediction attached to the competing option; `measurement-population-default-off` → **(c)**, unanimous 2/2. Both `Status: resolved` with the option named and both `Resolved when` clauses met.
