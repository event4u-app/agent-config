---
adr: 229
status: accepted
date: 2026-08-13
decision: worktrees-are-instruction-only
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Revisit when a consumer reports the opposite failure — that they repeatedly
  ASK for a worktree and the friction of saying so each time is the cost, rather
  than unprompted spawning. That would mean the standing-permission value had a
  real constituency after all and the deletion over-corrected. Observable from a
  consumer report; not a date. Do NOT revisit on the strength of a session that
  merely wanted a worktree once — the instruction path already serves that in
  one sentence with no confirmation loop.
---

# ADR-229 — Worktree creation is instruction-only; `worktrees.mode` is deleted

## Status

**Accepted** · 2026-08-13. Maintainer decision. Replaces an earlier draft of
this number that decided the opposite (standing authorization, `ask → on`); that
draft was never merged, and § Alternatives records why it was withdrawn.

## Context

`worktrees.mode` offered three values over one question — may the agent create a
git worktree on its own?

- `ask` (shipped default) — a permission question on every creation.
- `on` — standing permission; the agent spawns worktrees when it judges the
  shape fits.
- `off` — no autonomous creation. The skill refuses **unless the user asked in
  the chat**, and the template said so in as many words: *"Explicit user request
  in the chat overrides for that single task — the setting suppresses
  unprompted usage, not the tool itself."*

The maintainer's requirement, stated directly: the agent must never create a
worktree it was not asked for, and asking about it is itself the friction. That
is `off`, verbatim, and it was the one value the package did not ship.

Two failure directions were live at once, which is what made the three-value
shape a bad fit rather than merely a wrong default:

- `ask` spends a round trip per spawn on a decision the user has already made in
  general.
- `on` lets the agent start parallel work unprompted. That is not free: two
  sessions on one repository carry coordination cost, and the duplicate-work
  failure it enables has been **measured twice** on this repository (PR
  #1277/#1280 and #1280/#1281 — one roadmap phase built under two branch names,
  one PR discarded).

A setting whose only wanted value is one of three, where the other two are the
two failure modes, is not a configuration surface. It is a decision that was
handed to the wrong party.

## Decision

**1. `worktrees.mode` is deleted.** Not re-defaulted — removed. Instruction-only
is hardcoded in `using-git-worktrees` § 0 and in `subagent-orchestration` mode 6:
a worktree is created when, and only when, the user asks for one in the chat.
Unprompted, mode 6 is not selectable and the chain falls back to mode 3
(`do-in-steps`).

A leftover key from an older install is accepted and ignored with one
deprecation line per run, via the existing `REMOVED_KEYS` map. Its reason string
names what decides instead — *"the user asking for a worktree in the chat"* —
per that map's own contract that a reason must never just say "removed".

**2. The skill does not ASK either.** With no setting, the remaining failure
would be a confirmation loop: the agent proposing a worktree and waiting. It
does not. No explicit request means the in-place path, silently — no offer, no
mention. Proposing one unprompted puts a decision in front of the user that they
did not raise, and the answer is nearly always no.

**3. The Iron-Law gates are untouched.** Ignore-safety check and clean baseline
still run on every explicitly-requested worktree. Instruction-only removes the
*choice*, never the *checks*.

## The session register, same change

The register was the other half of the same complaint, and it needed a different
fix because the diagnosis was different: **the hook never blocked anything.** It
ends in `return 0` and always has. The withheld work was a model
over-generalisation of a context block, not a gate — so the repair is the block's
text and its emission condition, not its authority.

- **Collision-gated emission.** `foreign_sessions_block` returned a paragraph
  whenever *any* foreign live session existed. It now returns `null` unless a
  roadmap or branch collision actually fires. Mere co-existence is not news, and
  a session handed that paragraph mentions it unprompted.
- **An explicit never-gates-git clause**, because that is where the misreading
  happened: *"Explicit user instructions (commit, push, create a PR) are ALWAYS
  executed. This register never gates a git operation."* Bounded in the same
  breath so it cannot be read as overriding the roadmap STOP: *"Any STOP below is
  about WHICH WORK TO START, never about shipping work that is already done."*
- **The branch question is scoped to the session**, not the turn — asked once
  before the first write, and the answer holds.

**Deliberately unchanged:** the `sessions:claim` write-refusal, the DUPLICATE
WORK stop on an identical roadmap slug, and the TTL/heartbeat mechanics. That
guard fires on the roadmap slug — the axis where the measured loss occurred — and
it is the one part of this system that has paid for itself.

**One suspicion investigated and dropped.** `classify_collisions` compares branch
names without comparing worktree paths, so several sessions in the *same* checkout
count as colliding. That looked like the false-positive source and it is not: two
sessions sharing one working directory collide harder than two worktrees — they
share the filesystem — so the warning is correct and "spawn a separate worktree"
is the right advice. No change made. The observed noise came from idle same-checkout
peers still inside the 4 h TTL, which is TTL tuning and explicitly out of scope.

## Consequences

- The agent will not spawn a worktree unless asked. `/worktree:create` and
  "do this in a worktree" both still work, in one sentence, with no confirmation
  loop.
- Two parallel sessions with no collision now see **nothing** in context — less
  context, and no narration hook.
- With `worktrees.mode` gone, no shipped default routes a question through
  `settings-ask-protocol` at all; that whole class-C ask path is now opt-in. The
  protocol is unchanged, its shipped surface is simply empty.
- Two tests that referenced the key were **vacuously passing** after the deletion
  (`undefined === undefined`) and were re-pointed at live keys rather than left
  green-and-meaningless. A third was inverted into a deletion assertion that also
  checks `REMOVED_KEYS`, so "the rule stopped mentioning it" cannot pass while the
  key is still live in the template.

## Alternatives considered

- **Standing authorization (`ask → on`), the withdrawn draft.** Its premise was
  that a worktree is local and reversible, so unprompted creation is cheap.
  Reversibility is true and beside the point: the cost is coordination and
  duplicate work between sessions, which `git worktree remove` does not undo.
  Withdrawn.
- **Keep the setting, ship `off`.** Rejected: it leaves `on` reachable, i.e. it
  keeps a supported path to the failure this record exists to close, and asks
  every consumer to make a decision that has one right answer.
- **Silence the register block entirely.** Rejected: the roadmap-collision branch
  is the half with measured value. Collision-gating keeps it and drops only the
  noise.

## References

- `src/skills/using-git-worktrees/SKILL.md` § 0 — the instruction-only pre-flight.
- `src/skills/subagent-orchestration/SKILL.md` § 3 — mode 6 eligibility.
- `src/scripts/_lib/agent_settings.ts` § `REMOVED_KEYS` — the deprecation entry.
- `src/scripts/session_register_hook.ts` § `foreign_sessions_block` — emission + text.
- `docs/guides/parallel-sessions.md` — the consumer-facing statement of both.
