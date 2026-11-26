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
  Code objects to or removes files beside a transcript, or when the nudge is
  found to be ignored often enough that titles do not move.
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
   `user_prompt_submit` counts real prompts and, at milestones 3, 8, 20, 45, 100
   and every 100 after, injects one line asking whether the goal can now be named
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
- Agent Switch must read the sidecar and honour `custom-title` to show the
  result; that change lives in its own repository.

## Alternatives

- **A small-model call from the hook** — reliable cadence, but quota or spend and
  prompt text leaving the hook process. Rejected by the owner.
- **Deterministic from branch, PR and roadmap** — free, but technical and absent
  in sessions without a branch. Rejected by the owner.
- **Appending an `ai-title` line to the transcript** — rejected: the host's
  repeated cached title supersedes it within a turn.
