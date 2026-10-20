<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-agent-throughput-recovery
    relation: extends
    note: "That roadmap owns the turn-end-gate misfire classes (4.1 language, 4.3 short -n) and the cheap-question class (5.2). Phase 1 here fixes ONE language misfire mechanism it had not isolated — host-wrapped agent messages — and leaves its 4.1 command-body class and 4.3 open."
---
# Road to blockers routed before they are filed

> **Source:** [REDACTED:src-conf]
> answered by `agents/evidence/analysis/blocker-causes-2026-10-20.md` — 56
> sessions and 148 roadmap blocker entries — and a two-seat council pass the
> same day (anthropic + openai, 2/2, $0.00, subscription transport).

## Goal

A blocker addressed to a human is written only after the council has read it
against the owner-reserved table and escalated it, and the record says so; a
subagent or cross-session message never sets the reply-language pin; and the
blockers whose own `Resolved when` the tree already satisfies are closed. Each
of the three is checkable by a command, below.

## Phase 1 — An agent message is not the owner's turn

- [x] **1.1 Recognise the host's agent-message wrapper as synthetic.** The host
      delivers a subagent hand-back or a cross-session message to
      `user_prompt_submit` as `Another Claude session sent a message:` followed
      by `<agent-message …>` or `<cross-session-message …>`. `isSyntheticPrompt`
      anchors `<agent-message` at character zero, so the real payload passed as
      the owner's words and re-pinned the reply language to English
      (reproduced: session `5a3f6210`, pin written 149 ms after such a message,
      2,188 chars, 68 English markers). The fix accepts that fixed host prefix
      only when the wrapper tag follows it, so a human quoting the sentence is
      still read as a human.
      verify: `npx vitest run tests/scripts/language_mirror_hook.test.ts` -> 0,
      with the new cases seen red before the fix.

## Phase 2 — Route before filing

- [x] **2.1 The authoring contract routes a human-owned blocker through the
      council first.** Template rule 20 offered only `user | maintainer |
      external` as `Owner:` values although the linter already treats
      `council` and `implementer` as non-human owners. Rule 20 now lists them,
      and a blocker whose `Owner:` is the user, the maintainer or the owner
      carries `- **Routed:**` — the council's `ESCALATE` with the reserved row
      it crosses, or `pending` with the reason the council could not be reached
      (fail-open: an unreachable council never turns a council question into an
      owner question). A `DECIDE` is not a blocker; it is a `## Decisions` row.
      verify: `grep -n 'Routed:' src/agent-src/templates/roadmaps.md` -> a hit
      inside rule 20; `roadmap-writing` points at it.
- [x] **2.2 A ratchet keeps new human-owned blockers from skipping the route.**
      `lint_roadmap_blockers:routing` counts open human-owned blockers with no
      `Routed:` field against a baseline registered at today's count, so the
      existing backlog is grandfathered and every new one must carry the field.
      verify: `npx vitest run tests/scripts/lint_roadmap_blockers.test.ts` -> 0,
      with the ratchet case seen red; `./scripts-run src/scripts/lint_roadmap_blockers` -> 0.

## Phase 3 — Close what the tree already settled

- [x] **3.1 Execute the `Resolved when` of the blockers measured as satisfied.**
      `capacity-slot` (`later/road-to-skill-ecosystem-capability-queue.md`) and
      `verification-slot` (`later/road-to-skill-ecosystem-security-and-conformance.md`)
      both resolve when fewer than two `road-to-skill-ecosystem-*` roadmaps sit
      outside `archive/` and `later/`; there are none. `first-corpora-named`
      is NOT closed: its condition is satisfied only by the letter (the file was
      parked, not decided), which is the gaming this phase must not do.
      verify: `ls agents/roadmaps/road-to-skill-ecosystem-*.md` -> no match, and
      both entries read `Status: resolved` with the measurement recorded.

## Decisions

| # | Decision | Alternatives | Reason | Revisit if |
|---|---|---|---|---|
| D1 | Ship the authoring-time route, the agent-message pin fix and the two settled closures in one PR; run the full backlog drain separately | bundle the 82-blocker drain here | both council seats: historical churn would bury the implementation review | the drain finds the 7-of-15 council-decidable sample does not hold |
| D2 | Leave council-executed cancellation (`[-]` on a council "cancel") and end-state merge authorisation out of scope | change `roadmap-progress-sync` / `commit-policy` here | openai seat: both are governance self-amendment (owner-reserved); `commit-policy` is a kernel rule no agent may write; the anthropic seat dissented on end-state authorisation only | the owner rules on either |
| D3 | Do not schedule `/roadmap:resolve-blockers` yet | nightly or per-merge run | no measured arrival rate to set a cadence from (openai seat) | stop-reason telemetry gives a rate |
| D4 | `Routed: pending` is a valid value | require a council verdict before the blocker may exist | an unreachable council must not become an owner question (both seats) | `pending` entries outlive a reachable council by a week |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-20 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The prefix match swallows a real owner turn | implementation | An owner who pastes a hand-back to ask about it would lose the pin update for that turn | Match the fixed host sentence only at character zero AND only when the wrapper tag follows; a test pins the human-quoting direction | Phase 1 — An agent message is not the owner's turn |
| 2 | `Routed:` becomes a box ticked without a council run | implementation | The field is prose, so a gate can see its presence and value shape, never that the run happened | The value names the verdict word and the reserved row; `pending` names a reason; the ratchet stops growth, review catches fabrication | Phase 2 — Route before filing |

## Acceptance Criteria

- [x] AC-1 — A host-wrapped agent message leaves the language pin unchanged,
      proven by a test that is red without the fix.
- [x] AC-2 — No new open human-owned blocker can land without `Routed:`; the
      existing ones are counted, not exempted silently.
- [x] AC-3 — The two blockers whose condition the tree satisfies read
      `resolved`, and `first-corpora-named` stays open with the reason.
