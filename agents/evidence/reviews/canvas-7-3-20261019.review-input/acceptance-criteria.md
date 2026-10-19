## Acceptance Criteria

- [x] AC-1 — After `reconcile`, the repository holds every design value the user
      imported, and no ledger row is left without a disposition; the canvas is
      never written by this package.
- [x] AC-2 — All handover carriers accept one path set, including `*.dc.html` and
      `.design-sync/`.
- [x] AC-3 — `design`, `design-consent` and `design-revoke` are reserved, and no
      package entry shadows a host name in the pinned fixture.
- [x] AC-4 — Imports keep alias chains and report cycles as cycles.
- [x] AC-5 — `plan` on the fixture reports overwrite 2 and twin 1, an unreachable
      remote reports `unknown`, and a second run changes nothing.
- [x] AC-6 — Conflict rows are pre-filled from `resolveUiAuthority`'s posture; no
      other ranking of values exists in the change.
- [x] AC-7 — The command writes no component; it hands a brief to the UI owner and
      proposes no tier vocabulary.
- [x] AC-8 — A baseline older than the projection commit is `stale`, and a
      snapshot update warns.
- [x] AC-9 — A value outside a declared Consistency Lock is flagged, which makes the
      capture skill's claim true.
