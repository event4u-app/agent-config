## Acceptance criteria

- [x] Per-host projected **skill** counts are recorded for both projection
      modes, and no default was flipped to get them.
      `--projection-modes` reports 218 scoped / 289 legacy-all per host root;
      the two live arms are rows carrying `projection_mode`. Nothing read or
      wrote a setting.
- [x] A ranker-backed concern is bound, budgeted, and carries an adoption metric
      with no pre-committed threshold.
      `skill-route`, 512-byte row (measured 323), `skill_route_pointer_rate`
      registered with `"threshold": "none committed before data"`.
- [x] The skill schema declares `triggers`, a validator reads it, and the first
      seeded tranche is measured against the 302-prompt corpus.
      Schema mutation-verified; `trigger_coverage --scope skill` reads it via
      the shared matcher; tranche of 4 skills → 3 activations over 496 prompt
      lines.
- [x] The unintended-activation census is at or below 433 after seeding.
      **Unchanged, and structurally unreachable from this scope** — skills are
      not compiled into the router (verified: zero skill references in
      `compile_router.ts`; `dist/router.json` byte-identical after the seed;
      rule scope still 26/26). Recorded as the correction it is rather than
      claimed as a passed gate.
- [x] No survivor count is computed anywhere, and no host limit is extrapolated
      from another host.
      No subtraction across the two denominators appears in the new code, the
      evidence page, or the rule; every host is reported on its own row.
