## Acceptance Criteria

- [ ] AC-1 — `account-surface-finds-planted` exists in `docs/CLAIMS.md`,
      registered in a commit without detector code, and after Phase 3 carries
      one measured recall and false-positive figure per class.
- [ ] AC-2 — The detector flags no decoy and no safe twin in the frozen set,
      and every class it reports as `violated` met its pre-registered bar.
- [ ] AC-3 — No finding is ever printed as a pass from the absence of a
      pattern; a run states the files scanned and the classes it could not
      decide.
- [ ] AC-4 — No remediation class the detector emits can apply a hash
      migration, a threshold, a cookie mode or an MFA rollout without the
      note-and-ask step of `active-remediation`.
