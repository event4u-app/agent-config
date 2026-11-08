<!-- evidence-type: analysis -->

# Owner directive 2026-11-08 — owner ratification of the 28 startup contracts

PR #2919 (`feat/session-start-contracts`, roadmap
`road-to-a-session-start-under-the-host-limit`) changes files on the
ratification gate's list. After 31 two-provider council rounds the review did
not converge: anthropic ratified or confirmed from round 18 on, openai refused
or withheld a stance in every round on a new set of points. The agent put the
decision to the owner in-session (ADR-268 § 4, ADR-281 § 4) with three options:
owner ratification, more council rounds, or leaving the PR open. The owner
answered (verbatim):

> 1

## What this binds

- The subject `2d4468836a50612a94b44477d3e94bef9565167ccf8c14bdfa296d820ede59fb`
  (69 gated files at commit `9423070cfdbcb811bbc3811cec49fc4aa41dbd01` of `feat/session-start-contracts`; see
  the ratification record) is ratified by the owner.
- The merge over a red `check_kernel_edit_ratified` is the owner's own act on
  the forge. An agent records it in a bypass record and never performs it.
- openai's last open points stay recorded as dissent, not as findings to act on
  before merge: attributing the contracts' cross-rule additions to their
  source rule, and keeping a high-consequence member whole (instead of its law
  stub) when a readable audit omits it.

## Rollback

`agent-config install --full` restores the full rule layer on a machine;
reverting #2919 restores the previous behaviour for everyone.
