<!-- evidence-type: analysis -->

# Owner directive — the pull-request bypass for repository admins stays

| Field | Value |
|---|---|
| Ordered by | the repository owner, in chat |
| Date | 2026-10-25 |
| Scope | ruleset `17749383` "main protection", bypass actor `RepositoryRole 5`, `bypass_mode: pull_request` |
| Grants by itself | that the actor stays; it lowers no test, CI gate or Hard-Floor obligation |

Owner, verbatim: "ich will den bypass behalten" ("I want to keep the bypass"),
after being shown that the actor was added for #2657 and #2678 and would
otherwise have to be removed by 2026-11-01.

<!-- standing-bypass: ruleset_version=54668684 -->

## What it means

- The actor added at ruleset version `54668684` is standing configuration,
  not a temporary change. The bypass records of #2657 and #2678 close their
  restore half on this file (`restored_at: superseded-by-owner-ruling <this path>`).
- **Every bypass still leaves a record** under `agents/evidence/bypass-records/`,
  and **every record still owes its after-the-fact council review**, due seven days
  after its `restore_by`.
- The bypass is the owner's own act: an agent never runs `gh pr merge --admin`
  and never changes the ruleset (`docs/contracts/ratification-artifact.md`).

## What it does not change

`check_platform_anchor` treats only `bypass_mode: always` as an unconditional
bypass. That dimension is in `NEVER_WAIVABLE`, and this actor does not touch it.
Measured on 2026-10-25 against the live ruleset: `PASS_WITH_ACCEPTED_RISK`.

## Undo

Remove the actor in the ruleset. Bypasses after that are restored per record again.
