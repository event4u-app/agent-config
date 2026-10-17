## Acceptance Criteria

- [x] **AC-1** A script re-derives the consumer-path gate count from
      `hook_manifest.yaml` and the CLI surface, and the written figure is its
      output.
- [x] **AC-2** The consumer-claim subset of `docs/CLAIMS.md` is enumerated by
      claim id.
- [x] **AC-3** A fixture monorepo with a roadmap outside `agents/` yields
      exactly one advisory finding naming the target, and the tree is
      byte-identical afterwards.
- [x] **AC-4** The artifact-location detector has two callers and one
      implementation, asserted by a test that changes it once and sees both
      fail.
- [x] **AC-5** `docs/contracts/` carries a generated, drift-checked exit-code
      register for `init`, `sync`, `doctor` and `uninstall`.
- [ ] **AC-6** `docs/proof.md`'s exec share is written from a `build_proof`
      run in the same change, and no consumer-facing claim is `backed` on a
      pointer into this repository alone.
- [ ] **AC-7** `task ci` green.
