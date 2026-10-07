## Acceptance Criteria

- [x] AC-1 — No row of the 16.3.0 ledger lacks a status.
- [x] AC-2 — Each `still_open` row names a roadmap that exists.
- [x] AC-3 — The medium-security question has a recorded decision, and the
      gate's tests reflect it.
- [x] AC-4 — A `doctor` invocation with the offline flag spawns no forge or
      remote read, shown by an injected-runner test.
- [ ] <!-- blocked-by: doctor-network-default | asked: no — a background process-full drain lane has no owner channel; the question is carried in the blocker entry and the PR body --> AC-5 — The four forge findings carry a status consistent with the
      recorded default.
