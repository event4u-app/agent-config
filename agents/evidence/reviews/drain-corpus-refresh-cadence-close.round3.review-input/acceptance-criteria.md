## Acceptance Criteria

- [x] AC-1 — A recorded decision names the chosen shape (stagger, intended
      batch, or gate-severity change) and its reason. *(D1, 2026-09-27.)*
- [ ] AC-2 — The four `quarterly` corpus manifests carry four **distinct**
      `upstream.last_checked` dates (per D3 — not merely not-all-equal), each
      equal to the date its check actually ran, and
      `./scripts-run src/scripts/check_corpus_staleness` exits 0 against them.
      *(2026-10-01: one of four. `accessibility-auditor` reads `2026-10-01`,
      backed by a check that ran; `api-design`, `database` and `threat-modeling`
      still share `2026-09-18`. The gate exits 0, but the distinctness test
      fails — three of the four values are equal, not four distinct ones — and
      those same three stamps are not each the date of their own check.
      Deliberately NOT flipped: a green gate is not the test this criterion
      states.)*
