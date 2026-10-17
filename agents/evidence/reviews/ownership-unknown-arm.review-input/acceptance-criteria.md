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
- [ ] **AC-8** `grep -c installed-tools src/config/gitignore-block.txt` ≥ 1,
      and `grep -c sidecar docs/contracts/install-layout.md` ≥ 1.
      Second half satisfied by 3.2. The first half is **owner-reserved and
      arguably wrong as written**: it asks for a gitignore entry that
      `docs/contracts/agents-layout.md` and `README.md` jointly forbid, so
      meeting it would reverse a recorded contract. 3.3 states the narrower
      gap that remains. This criterion closes by being re-cut or by an owner
      decision, not by an edit.
- [ ] **AC-9** `task ci` green. Discharged by the PR's CI, not by a local
      run; `check_pack_size` and `check_gate_completeness` are red on
      `main@8c90aad26` independently of this branch.
