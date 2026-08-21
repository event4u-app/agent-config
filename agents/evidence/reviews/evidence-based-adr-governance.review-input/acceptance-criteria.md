## Acceptance Criteria

- [ ] AC-1 — `provenance`, `evidence` (with `discovery`) and `authority_basis`
      are defined in `adr-layout.md`, emitted by `adr-create`, validated by
      `check_adr_frontmatter`, and read through **one** shared frontmatter
      reader used by all three former parsers.
- [ ] AC-2 — The sweep artifact holds one disposition per record present at the
      sweep's head, each with basis refs and a `Blocking cost` that is either
      sourced observations or explicitly `unknown`; it answers the
      would-we-accept-it-today question per row; every record WITHOUT a tranche
      row is named with the reason and its disposition; and it writes **zero**
      ADR frontmatter.

      Phrased against the sweep's head rather than a fixed total, because a
      bare count is falsified by the trunk moving: PR #1509 merged ADR-238
      after the tranches ran, and the earlier wording ("one row per record
      (184)") then claimed coverage of a record the sweep never read. The two
      uncovered records are named in the artifact with their reasons — that is
      the check, not the number.
- [ ] AC-3 — Grading integrity is evidenced, not asserted: an externally
      adjudicated anchor sample exists, ≥10 % blinded overlap was graded
      twice, and the disagreement count is published rather than smoothed.
- [ ] AC-4 — Every blocker-lane row has a landed outcome or a named owner
      gate: rows 3, 4, 8, 9, 10, 11, 12, 13 disposed with the venue derived
      from the transition (never from the historical decision-maker); row 5's
      mechanical remediation landed with its (c)/(d) circularity recorded;
      row 7 on calendar watch; rows 1, 2, 6 `[~]` on 0B. ADR-001's fired
      trigger has a dated follow-up.
- [ ] AC-5 — A newly added accepted ADR cannot pass CI without an Evidence
      section, a substantive `review_trigger`, and no unscoped permanence
      language; an existing record may carry `review_trigger: unclassified`;
      `terminal`/`none`/empty are rejected everywhere; a reversible
      calibration change does not route to `adr-create`.
- [ ] AC-6 — `adr:effective` ships and ADR-020 proves a superseded clause
      cannot be read as current; `adr-layout.md:198-200`'s stale ADR-035
      assertion is corrected; `adr_cite_check` runs in CI and prints
      `authority_effect: disabled-shadow-mode` on an accepted agentic E0/E1
      record.
- [ ] AC-7 — No authority consequence ships in this roadmap: no fixture, rule
      path, or tool output lets a grade alone authorize an agent action, and
      ADR-239 is `proposed`, not `accepted`. Phase 7 is `[~]` and unstarted.
- [ ] AC-8 — Shadow-mode metrics are pre-registered in CLAIMS.md with
      measurement basis and minimum sample sizes — including
      `adr-grade-accuracy-vs-gold`, `adr-evidence-discovery-recall` and
      `adr-beneficiary-grade-bias` — before Phase 5.2 merges.
- [ ] AC-9 — Sequencing held: no ADR frontmatter backfill and no ADR-239
      acceptance occurred; no 0B-gated row executed; no Safety, Privacy,
      Legal or External-commitment floor was weakened.