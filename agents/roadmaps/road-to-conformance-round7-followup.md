---
complexity: lightweight
status: draft
parent_roadmap: road-to-conformance-round7
---

# Road to conformance round 7 — Follow-up

**Goal.** Hold the one decision round 7 deliberately did not take, so it is not
lost when the parent archives, and so no agent takes it on its own authority.

## Context

`agents/roadmaps/archive/road-to-conformance-round7.md` closed all 31 of its
steps. Its Blockers section carried exactly one item, and that item blocked
**none** of them — it is a kernel-rule question the round measured but is not
allowed to answer.

This roadmap is `status: draft`: hidden from the dashboard, not executable, and
waiting on a human. It exists because archiving the parent with an unresolved
maintainer decision inside it would bury the decision — the same lost-information
failure `roadmap-progress-sync` Iron Law 3 exists to prevent, in the one shape its
mechanical check does not see (a Blockers entry is not a `[~]` step).

## The decision — does a remote-state deliverable authorize the push that realizes it?

Round 7 measured this class at ~9 findings across the corpus, and — the part that
makes it a genuine question rather than a defect — **in both directions**:

- `798ed833` inferred authorization and pushed: *"Du hast zweimal gesagt, die
  Konflikte sollen weg — auf einem PR heißt das den Push; ich lese das als
  Freigabe."* The second "yes" it counted was a spent one-shot from the previous
  push.
- `88d229d6` did the opposite, stopped at the push gate, and the user repeated the
  instruction verbatim: *"behebe die merge konflikte"* — already given one turn
  earlier. That session's own retro states the trap: *"„Konflikte beheben" bei
  einem offenen PR ist ohne Push nicht erreichbar."*
- `9502795e` read *"fixe die ci"* as authorization and said so afterwards;
  `7c398073` read the same shape as spent and held.

So four sessions, three readings, and the corpus contains a user turn confirming
that the conservative reading left the task incomplete. A task whose deliverable
IS remote state cannot be completed under a local-only reading, and the rule as
written does not say which way that cuts.

## Why an agent may not decide it

`commit-policy` is one of the **9 locked kernel rules**
(`docs/contracts/kernel-membership.md` § 4). A kernel edit is its own PR with
≥ 24 h spacing (`scope-control` § Kernel-rule edits), and the `block-kernel-rule-writes`
PreToolUse guard makes it agent-impossible by construction — not merely
discouraged.

## What would have to be true to close this

- [ ] A stated position on whether an instruction whose deliverable is remote
  state ("behebe die merge konflikte" on an open PR, "fixe die ci") authorizes
  the push that realizes it — in either direction, as a maintainer judgement.
- [ ] If YES: `commit-policy` § One-shot authorization names the remote-state case
  explicitly, in its own PR, citing round 7's four sessions.
- [ ] If NO: the same section says so explicitly, so the conservative reading
  stops looking like an omission — and the round-7 finding is cited as the reason
  the question was asked rather than left implied.

## Non-goals

- Deciding it here. The whole point of this file is that it is not decidable by
  the party writing it.
- Re-measuring the class. Four sessions with verbatim quotes are in the parent;
  a fifth would not change the shape.
