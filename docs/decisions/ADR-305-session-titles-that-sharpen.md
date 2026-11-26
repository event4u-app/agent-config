---
adr: 305
status: accepted
date: 2026-11-26
decision: session-titles-that-sharpen
supersedes: —
superseded_by: —
phase: owner directive 2026-11-26
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: single
  decision_makers: [agent]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/owner-directives/2026-11-26-session-titles-that-sharpen.md
review_trigger: >-
  Reopened when a host starts refreshing its own generated title, when Claude
  Code objects to or removes files beside a transcript, or when the measurement
  in road-to-session-titles-beyond-claude shows either failure: titles do not
  move (under half of the nudged sessions carry a sidecar), or users correct
  them (a /rename lands after a refined title in more than one session in five).
  Either one is the rollback criterion: set the template default of
  sessions.auto_title to false and drop the concern binding.
---

# ADR-305 — Session titles sharpen as the session learns; a user's title is final

## Context

Claude Code writes an `ai-title` once, early, and repeats that value for the rest
of the session. Agent Switch and `sessions:catalog` show it, so a session keeps
the name of its first prompt. The owner asked for titles that improve as more is
known, frozen once the user renames the session, switchable by instruction, on by
default, and global.

## Decision

1. **The agent phrases the title** (owner's choice over a separate model call and
   a deterministic rule). The `session-title` concern on claude
   `user_prompt_submit` counts real prompts and, at milestones 3, 8, 20, 45, 100,
   200 and every 200 after, injects one line asking whether the goal can now be named
   more precisely. The agent publishes with `agent-config session:title`.
2. **A user title is final.** A `custom-title` line in the transcript (`/rename`)
   silences the nudge and makes `session:title` refuse. Readers resolve
   user title > refined title > host title.
3. **The refined title lives in a sidecar** `<session>.agent-title.json` beside
   the transcript. The transcript is never written: the host keeps re-appending
   its cached `ai-title`, which would bury an appended line. Beside the `.jsonl`,
   any reader that already resolved a transcript finds it without knowing this
   package's paths.
4. **`sessions.auto_title`** — class A, default `true`, and added to
   `MERGEABLE_KEYS` so the user-global value `settings:set` writes survives the
   merge. A project value still wins.

## Consequences

- Cost: one line of context at a handful of prompts per session, plus one CLI
  call when the agent decides the title should change. No spend outside the
  session.
- Model-carried: nothing verifies the agent acts on the nudge; a session whose
  agent ignores it keeps the host title, which is today's behaviour.
- Bounds, from the round-1 council review: the writer caps a title at 60
  characters (the length the nudge asks for), writes only beside an existing
  `<session-id>.jsonl`, and refuses once a user title exists; the concern checks the
  transcript's last 64 KiB on every prompt and, once it sees a user title, freezes
  the session for good: no further counting or nudges, even if that title were
  later removed, because a user who renamed once has said whose title it is; and drops
  state files untouched for 60 days. `sessions.auto_title: false` stops new
  nudges and writes and hides sidecars already written in `sessions:catalog` and
  Agent Switch, so switching off restores the host titles without a cleanup step.
  It is a global preference: `settings:set` writes it user-global, and a project
  value, where one is set, still wins for that checkout.
- Agent Switch must read the sidecar and honour `custom-title` to show the
  result; that change lives in its own repository.

## Evidence

The owner's request (basis 1). Before this change the eight most recent Claude
transcripts of this checkout each carried exactly one distinct `ai-title` value,
repeated between 6 and 452 times, and Agent Switch's `readSessionHeader` read
`ai-title` and `summary` only, so a `/rename` was not shown there either. The
council reviewed the gated manifest change in three rounds
(`agents/evidence/council/session-title-ratification-r{1,2,3}-20261126.question.md`);
round 3 split, recorded in `agents/evidence/ratifications/session-title-20261126.md`.

## Alternatives

- **A small-model call from the hook** — reliable cadence, but quota or spend and
  prompt text leaving the hook process. Rejected by the owner.
- **Deterministic from branch, PR and roadmap** — free, but technical and absent
  in sessions without a branch. Rejected by the owner.
- **Appending an `ai-title` line to the transcript** — rejected: the host's
  repeated cached title supersedes it within a turn.
