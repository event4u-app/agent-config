---
reason: recorded non-convergence of the modification review (anthropic ratified, openai refused, every round); owner asked in-session (OQ-7, answered 1 on 2026-10-25) and merged PR #2657 under a ruleset bypass
subject: 7f5b65ce7c34ec876e00889c2edc4acc0aac63b2fb26fdc89323c73b81d10d83
time: 2026-10-25T11:47:49+01:00
commit: e54dea5bb8936e3490f989f93fa7261455257a83
ruleset_version_before: 51122772
ruleset_version_after: 54668684
restore_by: 2026-11-01T11:47:49+01:00
restored_at: superseded-by-owner-ruling agents/evidence/owner-directives/2026-10-25-standing-pull-request-bypass.md
council_review: pending
---
<!-- evidence-type: bypass-record -->

# Bypass — PR #2657, self-modification 3.4, 5.2 and 6.2

The owner-permission-route of ADR-281 § 5 (`docs/contracts/ratification-artifact.md`).
The required check "Sync + Generate Tools Consistency" stayed red on one gate only,
`check_kernel_edit_ratified`: the diff changes the ratification mechanism and the
modification review never converged. Every other check was green on `6c62d2e844`.

- **Control changed:** ruleset `17749383` "main protection" gained the bypass actor
  `RepositoryRole 5` (repository admin), mode `pull_request`, at version `54668684`.
  Before it had no bypass actor (`51122772`).
- **Who acted:** the repository owner, on the forge, with `gh pr merge 2657 --merge --admin`.
  No agent changed the ruleset.
- **Subject:** computed with `ratification_subject --files <diff of e54dea5bb8^1..e54dea5bb8> --rev e54dea5bb8 --base-ref e54dea5bb8^1`;
  gated file covered: `src/scripts/check_kernel_edit_ratified.ts`.
- **Still open:** restoring the ruleset (owner) and the after-the-fact council review,
  which must cite the subject digest and be committed after `restored_at`.
