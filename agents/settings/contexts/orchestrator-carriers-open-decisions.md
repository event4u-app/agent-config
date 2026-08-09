# Orchestrator discipline carriers — the three decisions the roadmap left open

> **Why this file exists.** The `orchestrator-discipline-carriers` roadmap
> closed with all of its steps done and all THREE of its blockers still open.
> Archiving it removed the only tracked surface that enumerated them: the
> roadmap moved into `archive/`, and the dashboard's open-blocker count fell
> by three in the same change. Shipped rule text still defers to one of them
> by name, so the deferral would have pointed at nothing. This note carries
> the three decisions forward; per `no-roadmap-references`, stable artifacts
> cite THIS file, never the archived roadmap.
>
> Recorded 2026-08-09, surfaced by the R2 completion review of the closeout
> branch (finding 3) rather than noticed during the archival itself — the
> archival sweep checks open steps and deferred items, not open blockers.

All three are **maintainer-owned**. None is an agent decision, and none of
them is inert: each one gates work that other shipped text already assumes
will happen.

## 1. `f4-full-blocking-decision` — the one with live inbound references

**Blocks:** any blocking end-review gate. **Cited by:**
`src/scripts/hooks/end_review_nudge_hook.ts` (file header) and the archived
roadmap's Phase 5 exit note.

Two questions, one owner, because the second cannot be answered without the
first:

- **The threshold.** After the `review_skipped` telemetry has accumulated a
  usable distribution, decide the block threshold — the working hypothesis is
  high-risk diff lines, differentiated from doc/test-only churn — and whether
  the block lands in the `end-review-nudge` concern or in the existing
  `team-review-gate` managed tier.
- **Two biases the calibration MUST account for** (council 2026-08-09, landed
  in #1224 after this note's first draft). Both push the measured
  distribution DOWNWARD, so calibrating naively on it sets the block
  threshold too low:
  - the once-per-session dedupe undercounts multi-phase sessions — only the
    first threshold crossing is ever recorded, so a long session that
    mutates repeatedly contributes one event, not many. Compensate with a
    conservative, higher threshold rather than by removing the dedupe.
  - `mutation_measure: capped_approximation` lines are floor values, not
    measurements — past the untracked-file cap the hook reports a number
    guaranteed to clear the threshold instead of counting. Calibrate on
    `exact` lines only.
- **The delivery question underneath it.** Claude Code documents
  `additionalContext` for `UserPromptSubmit` / `SessionStart` / `PostToolUse`,
  but **not** for `Stop`. So the advisory line's model-facing delivery on the
  stop slot is unverified, and the documented model-reaching mechanism on Stop
  is `decision: "block"` plus a reason — which is exactly the blocking tier
  this decision gates. Until it is made, the model-facing carrier for the
  end-review obligation is the AGENTS.md line plus the telemetry, and no
  artifact may claim more than that.

**Resolved when:** the threshold decision is recorded with the telemetry cited.

## 2. `user-instruction-compliance`

**Blocks:** nothing shipped — a separate bug class, recorded so it is not
rediscovered from scratch.

One measured session received an explicit "use subagents and AI council"
instruction and produced two dispatches in minute five and zero council runs.
Diagnose whether that is a planning-execution gap (the agent acknowledges,
then forgets) or a directive-priority gap (efficiency instinct outranks the
user's voice) by tracing the instruction through that transcript, then decide
the mechanism — a commitment-check hook versus directive escalation.

**Resolved when:** the diagnosis is recorded and a mechanism decision made.

## 3. `cross-session-dedup`

**Blocks:** nothing shipped — a different mechanism class.

Two concurrent sessions fixed the same bug in separate PRs, with four merge
conflicts as the result. The session-register hook already announces live
sessions; it does not check file or topic overlap. Decide whether a
files-touched registry with an overlap warning is worth its cost.

**Resolved when:** the decision is recorded — build, defer, or drop.

## See also

- [`delegation-policy`](../../../src/rules/delegation-policy.md) — the rule
  whose carrier inventory these decisions bound.
- [`orchestration-default-flip-verdict`](orchestration-default-flip-verdict.md)
  — the sibling decision record for the `subagents.auto` default.
