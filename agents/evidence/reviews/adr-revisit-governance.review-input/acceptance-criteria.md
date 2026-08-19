## Acceptance Criteria

- [x] `decision-revisit-gate` fires on the word "ADR" and routes to a skill a
      pack-legal install actually receives.
- [x] `adr_cite_check` resolves status, trigger state, amendments, and
      successors for any ADR in the primary corpus, with `indeterminate` as a
      first-class result, and its tests pass.
- [x] `docs/contracts/adr-layout.md` carries the reopen-authority
      discriminator, the owner-reserved set, and the reopen-record schema.
- [x] A missing `reopen_policy` resolves to `unclassified`; no ADR is failed by
      a validator for lacking the new fields.
- [x] ADR-035 and ADR-232 link in both directions; the index renders
      `Superseded by` and `Amended by`.
- [x] `docs/decisions/adr-reopen-sweep-2026-08.md` gives all 11 named lock ADRs
      plus ADR-001 a disposition and a route.
- [x] `npx tsx src/scripts/check_adr_frontmatter.ts` and
      `npx tsx src/scripts/check_references.ts` both exit 0.
