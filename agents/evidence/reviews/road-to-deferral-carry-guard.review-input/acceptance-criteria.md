## Acceptance Criteria

- [x] AC-1 — deleting `agents/roadmaps/road-to-council-topology-evidence-followups.md`
      makes a gate RED. Proven by the deletion, the red, and the restore — not by
      reading the code.
- [x] AC-2 — removing the `parent_roadmap:` back-link from that file, or
      renaming it, makes the same gate red.
- [x] AC-3 — the carrier does not appear on `agents/roadmaps-progress.md` and is
      not offered by `/roadmap:process-*`, while `check_roadmap_trackable` stays
      green with it present.
- [x] AC-4 — deleting a `status: carrier` roadmap scores zero estate credit,
      asserted in `check_estate_count`'s own case table.
- [x] AC-5 — the transition vocabulary that stays out of scope is recorded in a
      stub, and unsupported transitions fail closed today rather than being
      inferred.
