## Acceptance Criteria

- [x] **AC-1** The Phase 1 probe log exists under `agents/evidence/` with a
      numeric error count, and `auto` ships nowhere while that count is
      non-zero and the session register is repository-scoped.
- [ ] **AC-2** Under `CI=1`, a non-TTY stdout, a source checkout and
      `AGENT_CONFIG_NO_UPDATE_CHECK=1`, an end-to-end run produces zero
      filesystem writes outside the state file, asserted by a tree diff.
- [x] **AC-3** A project carrying `agent_config_version` is byte-identical
      before and after an unattended run.
- [x] **AC-4** For each of offline, 403, 404, disk-full, SIGTERM and EACCES,
      the installed version after the run equals the version before, and a
      reason is printed.
- [x] **AC-5** A release published less than 72 h ago, or carrying
      `deprecated`, or with unmet `engines`, or with missing provenance, is
      never installed unattended.
- [ ] **AC-6** A settings file with no `update:` block produces byte-identical
      behaviour to the current release.
- [ ] **AC-7** The ring-0 exit record is committed before step 4.3 lands.
- [ ] **AC-8** No fetched release-note text reaches model context, asserted by
      a fixture with a hostile remote changelog.
- [x] **AC-9** `grep -c "'--to'" src/scripts/_cli/cmd_upgrade.ts` returns 0.
- [ ] **AC-10** `task ci` green.
