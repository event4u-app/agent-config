## Acceptance Criteria

- [x] AC-1 — `lint_code_comments --self-test` exists, exits 0, and its rejecting
      cases go red when the German predicate is neutralised.
- [x] AC-2 — the gate is no longer counted among `gate-coverage.yml`'s
      registered non-adopters. Measured 2026-09-02:
      `list_self_test_non_adopters()` returns 24 names and `lint_code_comments`
      is not among them. Honest reading of that number — it was not among them
      before this change either, because the population is rows that are
      `enforced` AND carry `min_scanned >= 1`, and this row's floor is 0 by
      design. The gate now adopts on the marker the ratchet reads rather than
      passing on a population exclusion, so the criterion holds for the reason
      it names.
- [~] AC-3 — `language-and-tone` either names an enforcer that can read a source
      file, or states that its code clause is model-carried. The current
      middle state — an entry naming a validator that rejects every source
      path — does not survive this roadmap.
      <!-- deferred-resolution: carried-to=road-to-language-and-tone-enforcer-claim -->
