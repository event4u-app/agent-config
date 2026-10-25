---
reason: recorded non-convergence of the modification review of the reviewer itself (4.1, 4.2); owner asked in-session (OQ-7, answered 1 on 2026-10-25) and merged PR #2678 under the same ruleset bypass that landed #2657
subject: b7552a2e1755e63297d27e81fe56d637bb407246d9ac433dfaa59e168fccb243
time: 2026-10-25T11:47:49+01:00
commit: c9a30eb31b00571415eecb126916f0449ae5a0d7
ruleset_version_before: 51122772
ruleset_version_after: 54668684
restore_by: 2026-11-01T11:47:49+01:00
restored_at: pending
council_review: pending
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2678, self-modification 4.1 and 4.2

The owner-permission-route of ADR-281 § 5, under the same bypass window as
`2026-10-25-self-modification-2657.md`: ruleset `17749383` still carries the
`RepositoryRole 5` pull-request bypass added at version `54668684`, unchanged
since. The required check "Sync + Generate Tools Consistency" was red on
`check_kernel_edit_ratified` alone; every other check was green on `3b16450ecb`.

- **Who acted:** the repository owner, with `gh pr merge 2678 --merge --admin`.
  No agent changed the ruleset.
- **Subject:** `ratification_subject --files <diff of c9a30eb31b^1..c9a30eb31b> --rev c9a30eb31b --base-ref c9a30eb31b^1`.
- **Still open:** restoring the ruleset (owner) and the after-the-fact council
  review citing this subject, committed after `restored_at`.
