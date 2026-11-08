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
  the ratification record) is ratified by the owner, and so is the subject
  after merging `main` into the branch,
  `c4be0a922aceb30c4ec8abf94153c1b403d781974f1ad274dbc9b84aaf722261` at commit
  `af66abb72cc15b833ea0fb3dc6f1265295349631`. The two differ only by `main`'s own `raise_log` entry for
  `src/scripts/quota_notice_hook.ts` in `src/config/hook-bundle-budget.json`,
  merged as a sibling of this branch's entry; no rule, contract or ceiling of
  this change moved.
  The same holds for the subject after the next merge of `main`,
  `64cb0bc514617a524b479bf91bb7c60e143638ac9d167ace598c046dc34d9a64` at commit `9cad173d37b5da27e7c088d17da3a869d87b4727`: it adds `main`'s two
  `raise_log` entries for `src/scripts/_lib/reference_duty.ts`, merged the same way.
- The merge over a red `check_kernel_edit_ratified` is the owner's own act on
  the forge. An agent records it in a bypass record and never performs it.
- openai's last open points stay recorded as dissent, not as findings to act on
  before merge: attributing the contracts' cross-rule additions to their
  source rule, and keeping a high-consequence member whole (instead of its law
  stub) when a readable audit omits it.

## Rollback

`agent-config install --full` restores the full rule layer on a machine;
reverting #2919 restores the previous behaviour for everyone.
