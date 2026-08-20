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

<!-- verified 2026-08-20: all three claims in this section hold against the tree.
`commit-policy` is row 3 of the 9-rule locked set at `docs/contracts/kernel-membership.md:143`
(§ 4) and again at :164 (§ 4.1); the guard is registered
`severity: blocking`, `fail_closed: true` at `src/scripts/hook_manifest.yaml:160-165`;
the ≥ 24 h spacing is `src/rules/scope-control.md:52-54`. And the gap is real:
`grep -rniE 'remote.state|deliverable' src/rules/commit-policy.md` returns 0 hits,
so no position exists in either direction today. -->

## What would have to be true to close this

- [-] A stated position on whether an instruction whose deliverable is remote
  state ("behebe die merge konflikte" on an open PR, "fixe die ci") authorizes
  the push that realizes it — in either direction, as a maintainer judgement.
  <!-- 2026-08-20: not doable here — missing a maintainer position; the
  transition is owner-reserved, so no agent may supply one. See the decision
  below. -->
- [-] If YES: `commit-policy` § One-shot authorization names the remote-state case
  explicitly, in its own PR, citing round 7's four sessions.
  <!-- 2026-08-20: not doable here — missing the position above, and the edit
  is agent-impossible by construction (see § Why an agent may not decide it). -->
- [-] If NO: the same section says so explicitly, so the conservative reading
  stops looking like an omission — and the round-7 finding is cited as the reason
  the question was asked rather than left implied.
  <!-- 2026-08-20: not doable here — same two reasons as the YES branch; the
  direction does not change who may write the file. -->

<!-- decision 2026-08-20: routing only, not substance. A YES lowers a recorded
Hard Floor (`non-destructive-by-default` § trigger table, row "Push to remote"),
which `decision-revisit-gate` § Who decides reserves to the owner — so the
council may not take it either. Conservative reversible option taken: state no
position, and promote the held item from the parent's prose into an open
`## Blockers` entry below, because the archival sweep refuses a roadmap with an
open blocker (`src/agent-src/scripts/archive_completed_roadmaps.ts` § open_blockers)
while three `[-]` boxes alone would leave `count_open == 0` and nothing objecting.
That closes the exact hole § Context names, without deciding anything.
`status:` stays `draft` for the same reason: the roadmap's only work is the
maintainer's, so it is not complete and must not read as executable. -->

## Blockers

### blocker: commit-policy-remote-state-deliverable
- **Status:** open
- **Owner:** maintainer
- **Blocks:** all three criteria above, and nothing else. The roadmap exists to
  hold it; it gates no other work in the estate.
- **Class:** 3 — human-only. The kernel-write guard makes it agent-impossible by
  construction, so no class-0/1 run can exist for it.
- **What to do:** pick one. (a) YES — an instruction whose deliverable IS remote
  state authorizes the push that realizes it; add the case to
  `src/rules/commit-policy.md` § One-shot authorization, whose current closing
  sentence covers only the code-shaped instruction ("A task instruction asking
  only for **code** … authorizes the code change **only**") and is silent on this
  one. (b) NO — the same section says so explicitly, so the conservative reading
  stops reading as an omission. Either way it is its own PR with ≥ 24 h spacing
  (`src/rules/scope-control.md` § Kernel-rule edits) and cites round 7's four
  sessions (`agents/roadmaps/archive/road-to-conformance-round7.md` § Blockers).
- **Recommendation:** (b) NO, stated explicitly. It is the reversible half —
  writing down the floor that already holds strengthens it, which
  `decision-revisit-gate` § Who decides leaves council-decidable, whereas (a)
  lowers a Hard Floor and is owner-reserved for good. If (b) turns out to be
  wrong, the corpus will produce a fifth session and (a) is still open; if (a)
  is taken first and wrong, the pushes it authorized already happened.
- **If you do nothing:** the floor keeps holding as written and agents keep
  splitting three ways on it — measured ~9 findings, four sessions, three
  readings. Nothing degrades and nothing gets better; one of those sessions
  already cost the user a verbatim repeat of an instruction they had given a
  turn earlier.
- **Resolved when:** `src/rules/commit-policy.md` § One-shot authorization states
  the remote-state case explicitly, in either direction, and the change cites the
  round-7 finding.

## Non-goals

- Deciding it here. The whole point of this file is that it is not decidable by
  the party writing it.
- Re-measuring the class. Four sessions with verbatim quotes are in the parent;
  a fifth would not change the shape.
