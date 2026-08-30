---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
estate_growth_exempt: >
  Grows active_roadmaps 5 -> 6, and the offset that would have paid for it is
  not available: `road-to-agent-turnaround` cannot archive. It sits at 19/21
  with two `[~]` items, and update_roadmap_progress archives only at
  `deferred === 0` — by design, since Iron Law 3 exists to stop exactly the
  silent burial of planned-for-later work. So this is a genuine +1, claimed
  rather than disguised. What it buys: three items that provably could not
  close in the roadmap that found them — a re-measurement whose corpus does not
  exist yet, an owner-reserved security decision the agent is forbidden to take,
  and an installer change that would silently narrow three rules' activation
  from inside a measurement roadmap. Folding any of them into an existing
  roadmap would separate the work from the measurement that justifies it.
estate_offset_exempt: >
  Created in the same change that archives `road-to-agent-turnaround` at 19/21,
  as the CARRY disposition for its two deferred items — the council-decidable
  branch of the preservation test in roadmap-progress-sync, taken because both
  criteria stay alive in the active estate rather than being weakened or
  dropped. One in, one out. Measure the actual delta with check_estate_count
  after the commit — do not read the number from this sentence.
---
# Road to turnaround follow-ups

> **Source:** the two `[~]` items and one recorded-but-unrepaired defect from
> `agents/roadmaps/archive/road-to-agent-turnaround.md`, executed 2026-08-30.
> Every number below is from
> `agents/evidence/analysis/agent-turnaround-2026-08-30.md`; none is estimated
> here.

## Goal

The three things that roadmap could not finish inside itself are finished: the
batching obligation has a reading against it, the owner has answered whether the
30-minute authorization window is usable at the measured run lengths, and the
installer's global write path emits the one activation key Claude Code reads for
the rules the emitter already scopes.

## Why these three could not close in place

Each is blocked by a different thing, and none of them is effort:

| item | why it could not close then |
|---|---|
| batching re-measurement | the obligation landed minutes before; the ten post-change sessions do not exist yet |
| authorization shape | owner-reserved — a security floor the agent is forbidden to decide |
| `paths:` on the global layer | a consumer-facing installer change that silently narrows three rules' activation, from inside a measurement roadmap |

## Phase 1 — Read the batching obligation

- [ ] **1.1 Re-measure mean batch size after ten further sessions.** Run
      `./scripts-run src/scripts/probe_turnaround --limit 10 --against-baseline`
      and record the `mean_batch_size` delta against the 1.01 baseline in
      `src/config/turnaround-budget.json`, with its own corpus window beside it.
      **Pre-committed:** if the number has not moved, that is the RESULT and it
      is recorded as a null — never a reason to repeat the same reminder more
      loudly, which this repository has already measured not to work for the
      session-canary obligation.
      verify: a second baseline entry exists in the budget config with its own
      corpus window, and the delta is stated in the evidence file in whichever
      direction it went.

## Phase 2 — Put the authorization question to the owner

- [ ] **2.1 Surface the owner-reserved decision and record the answer.** The
      question, both options and the measured run lengths are already written —
      `archive/road-to-agent-turnaround.md` § blocker
      `authorization-shape-for-long-runs`. This step carries it to an answer and
      records it where the guard can cite it. **The agent proposes no value for
      `LEDGER_MAX_AGE_MS` and does not take the decision**; a recorded "leave it
      as is" closes the step exactly as a change would.
      verify: a commit or an ADR records the owner's decision, and
      `src/scripts/hooks/block_unauthorized_git.ts`'s docblock cites it.

## Phase 3 — Emit `paths:` on the write path that does not

- [ ] **3.1 Call the host-form rewrite from the installer's global write
      path.** `condense.ts` calls `_claude_paths_plan` when it writes the
      project tree; nothing under `src/install/` calls it at all, so
      `~/.claude/rules/` receives the source form and three rules the emitter
      WOULD scope — `ui-audit-gate`, `design-review-after-ui-write`,
      `roadmap-progress-sync` — arrive unconditional. The table and the
      mechanism are in `docs/contracts/rule-router.md` § Claude Code `paths:`.
      **Scope bound:** the 17 mixed rules stay unconditional; narrowing one is a
      per-rule decision about its keyword triggers, never a blanket emitter
      change.
      verify: after a fresh install,
      `grep -lE '^paths:' ~/.claude/rules/*.md | wc -l` is 3, and those three are
      the path-only rules named above.
- [ ] **3.2 Prove the three still fire, and that nothing else went quiet.**
      Narrowing activation fails silently by construction — a rule that should
      have loaded simply does not, with no error anywhere. Re-run
      `rule_activation_census --projection ~/.claude/rules` and assert the
      divergence it currently reports is gone, and that the unconditional count
      fell by exactly three.
      verify: the census reports no divergence between the source verdict and
      the projection, and the before/after unconditional counts are recorded.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 3 silently narrows a rule that must stay unconditional | implementation | `paths:` is the host's ONLY activation key, so a rule that gains one and also needed a keyword trigger goes quiet on exactly the prompts it was written for — with no error anywhere | 3.1 is scoped to the 4 rules the emitter ALREADY classifies path-only; the 17 mixed rules are explicitly out. 3.2 re-measures the census divergence rather than trusting the change | Phase 3 — Emit `paths:` on the write path that does not |
| 2 | Phase 1 reads a corpus that never accumulated ten post-change sessions | implementation | The window is mtime-ordered, so running it early measures sessions that predate the obligation and reports them as an after | 1.1 names the ten-session precondition; the budget config records each reading's corpus shape, so an under-populated window is visible in the entry itself | Phase 1 — Read the batching obligation |
| 3 | Phase 2 is read as licence to widen the window | product | The nearest reading of "answer the pressure" is to relax the bound — the action taken twice and forbidden by the guard's own prose | 2.1 states that the agent proposes no value and that a recorded "leave it as is" closes the step; `check_hook_bundle_content` now refuses the edit at `task preflight` | Phase 2 — Put the authorization question to the owner |
| 4 | Phase 1 records a null and the lever is re-pulled harder | product | A model-carried obligation that did not move invites raising the reminder's frequency, which was measured not to work for a sibling obligation in this tree | 1.1 pre-commits to the null being the result, in the same words the originating roadmap used | Phase 1 — Read the batching obligation |

## Acceptance Criteria

- [ ] AC-1 — `mean_batch_size` has a second reading against a named post-change
      corpus, and the delta is recorded whichever direction it went — including
      "did not move".
- [ ] AC-2 — The 30-minute authorization window carries a recorded owner
      decision that `block_unauthorized_git.ts` cites, or an explicit recorded
      refusal to change it. Silence does not satisfy this.
- [ ] AC-3 — A fresh install emits `paths:` for exactly the rules the emitter
      classifies path-only, and the activation census reports no divergence
      between its source verdict and the projection.
