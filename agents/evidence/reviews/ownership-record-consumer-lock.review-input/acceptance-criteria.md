## Acceptance Criteria

- [x] **AC-1** All three Phase 1 tests were observed **red** before Phase 2,
      and the observation is recorded in the PR.
- [x] **AC-2** An edit to a globally deployed file survives a re-install run
      from a directory with no project settings.
- [x] **AC-3** An edit survives an install run from a second project under the
      same HOME.
- [x] **AC-4** A file the package retires while the user has edited it is not
      deleted silently.
- [x] **AC-5** A genuinely unrecorded pre-existing file is still written, as
      its own asserted case.
- [x] **AC-6** Installer `rc=3` and `doctor --ci` non-zero on the same tree,
      asserted by one test.
- [x] **AC-7** A schema-1 inventory still loads, and the sibling roadmap's
      containment test is green in the same run.
- [x] **AC-8** A global install run from a consumer project with settings
      writes no `$HOME`-rooted path into that project's
      `agents/installed-tools.lock` while `sync` still replays its global
      entries (3.3, re-cut 2026-10-18 to option (b′)), and
      `grep -c sidecar docs/contracts/install-layout.md` ≥ 1 (satisfied by 3.2).
- [x] **AC-9** `task ci` green. Discharged by the PR's CI, not by a local
      run; `check_pack_size` and `check_gate_completeness` are red on
      `main@8c90aad26` independently of this branch. Flipped in the PR that
      closes 3.3, whose merge is gated on its CI being green.
