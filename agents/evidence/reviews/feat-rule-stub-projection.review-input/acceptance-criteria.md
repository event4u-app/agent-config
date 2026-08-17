## Acceptance Criteria

- [x] Every rule carrying a migration pointer has an exact-BPE measurement and a
      floor/residue split in a committed table. — 44 rows, regenerable.
- [x] A pointer naming a missing target fails CI; the gate's green line reports
      how many rules it read. — self-test case 2; green line reports 117.
- [x] A migrated rule padded past its per-rule ceiling fails CI; a raise without
      a real reason sentence fails CI. — self-test cases 3 and 4.
- [x] The aggregate census baseline is unchanged by Phases 1–2, and any change in
      Phase 3's wake is re-baselined in the same commit with its reason. —
      `src/config/rule-activation-census.json` is untouched by this branch; no
      rule body changed, so there was nothing to re-baseline.
- [x] `road-to-standing-context-40k` step 2.1 carries the prioritisation table;
      no step in this roadmap moves prose out of a rule body. — no `src/rules/`
      content edit is in this diff.
- [x] The closed disposition record has the same row count and the same
      dispositions it had at adoption. — 76 rows, read-only; verifiable as an
      empty diff on `agents/decisions/rule-activation-dispositions.yml`.
