## Acceptance Criteria

- [x] AC-1 `./scripts-run src/scripts/check_pack_size` exits 0 on a clean
      `origin/main` checkout with no local edits.
      MET 2026-09-10 on BOTH routes, which is more than this line asks and is
      stated because the distinction cost this roadmap a round: a clean checkout
      with no build takes the UNBUILT route and reads **10.506 against the reset
      `max` 11.5**; the same tree after a full build takes the BUILT route and
      reads **12.454 against the derived ceiling 13.699**. All four content
      classes read 0 and the binary axis is 3 observed / 3 allowed — that last
      one was 28/3 before this change, because 25 gitignored `__pycache__/*.pyc`
      files were being packed through `files[]`.
- [x] AC-2 `src/config/pack-size-budget.json` records the tree its figures were
      measured in, per the convention every `baseline_note_*` in that file
      already follows.
      MET 2026-09-10. `built_surface_measurement_2026_09_10` carries, per
      figure: the exact command, whether the tree was built, the entry count,
      and the machine class. It also states plainly that every number is a
      workstation reading and that no CI reading exists or can, because
      `check_pack_size` has no `.github` invocation — only
      `taskfiles/ci-fast.yml:846`.
- [x] AC-3 Whichever of (a) / (b) / (c) was taken is recorded in that file with
      its measurement, its method, and the alternatives that were examined and
      rejected — the shape its existing notes use.
      MET 2026-09-10. Option (a), in `baseline_note_2026_09_10` and
      `built_surface_measurement_2026_09_10`, with the full record in `ADR-273`:
      the `× 1.095` derivation, the historical clean reconstruction at
      `ab398ed05` that proved the old comparator carried 0.4058 MB of pollution,
      the packed-bytes attribution table that refuted the council's own
      compression premise, the differential packed-consumer test that proved
      `src/scripts` load-bearing, and each of (b), (c) and the two rejected
      procedural proposals with the reason it was rejected.
