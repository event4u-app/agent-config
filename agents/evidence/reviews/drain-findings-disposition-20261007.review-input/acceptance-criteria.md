## Acceptance Criteria

- [x] AC-1 — No row of the 16.3.0 ledger lacks a status.
      `jq '[.findings[] | select(.status==null)] | length'` -> 0.
- [ ] AC-2 — Each `still_open` row names a roadmap that exists.
      NOT met, stated rather than ticked over: 2 of 10 `still_open` rows
      (`bfe1d6e6d8ca` -> road-to-enforcement-per-obligation,
      `ee95ff4aca5f` -> road-to-blocking-time-by-cause) name an owning
      roadmap; the other 8 are genuine orphans — no roadmap owns that
      narrow residual today, and step 1.2's own instruction only asks for
      the name where a sibling roadmap owns the row. Inventing a roadmap
      per orphan finding is a separate, larger decision this task does not
      make.
- [x] AC-3 — The medium-security question has a recorded decision, and the
      gate's tests reflect it.
      Council 2026-10-07, 2/2 convergent on (a); `tests/scripts/check_finding_dispositions.test.ts`
      and `src/scripts/self_review_gate.test.ts` both updated and green.
- [x] AC-4 — A `doctor` invocation with the offline flag spawns no forge or
      remote read, shown by an injected-runner test.
      `tests/scripts/doctor_offline_flag.test.ts`, 8 passed (landed on
      `main` before this roadmap ran; re-verified here).
- [ ] AC-5 — The four forge findings carry a status consistent with the
      recorded default.
      NOT met — there is no recorded default yet (`doctor-network-default`
      stays open, owner-only). `eff3d4ed3fee` (16.3.0) is `fixed` on its own
      narrower terms (flag + doc gap, not the default question); the three
      16.2.0 siblings are untouched and out of this roadmap's scope.
