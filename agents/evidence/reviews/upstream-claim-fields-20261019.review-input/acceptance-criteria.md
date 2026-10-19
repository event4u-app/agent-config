## Acceptance Criteria

- [x] **AC-1** No document in the tree sends a contributor to a path, script or
      file that does not exist.
- [x] **AC-2** A release whose branch, identity, message or diff carries a
      consumer identifier is refused, with the finding named.
- [ ] **AC-3** The same mechanism from two projects produces one fingerprint.
- [x] **AC-4** Every upstream pull request is a draft with a noreply identity,
      and changing one byte after approval voids the approval.
- [x] **AC-5** A consumer install reaches the issue step of the ladder; the
      pull-request step is reached from a checkout of this package (D5), until
      the owner decides D7.
