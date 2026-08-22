---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---
# Road to the quota-reset watcher

> **Source:** `agents/tmp.old/agent-cost-gate-2.txt` — maintainer session,
> 2026-08-22, harvested via `/analyze:inbox`. The draft was written against
> `ed311d703`, which `572e147cc` (PR #1533) has since overtaken: its Phases 1
> and 2 shipped there, and its Phases 0, 3 and 4 are already parked in
> `later/road-to-billing-cliff-detection.md`. What survived verification is the
> draft's Phase 5 — the reset watcher — plus one new probe surface, S-6.
>
> The draft contains the roadmap twice. The second copy is a revision, not a
> duplicate: it adds S-6 and a three-rung probe hierarchy. The revision is what
> was analysed.

## Goal

A run that stopped because its plan quota ran out is visibly distinguishable
from a run that crashed, and the operator is told when it can be resumed
instead of having to work that out. When this is finished `run:supervise`
reports a `quota-parked` disposition fed by a marker the council's own `'ask'`
gate writes — no host signal required — and the two evidence findings this
analysis produced are recorded where the next reader will find them rather than
re-derived. Whether a parked run may be relaunched **unattended** is not
decided here: that is a published refusal whose reopen condition has just been
met, and this roadmap surfaces that fact to the council instead of acting on it.

## Context

The draft proposes a detached watcher that sleeps until the quota resets and
then relaunches the run with its subagents. Three facts from the current tree
reshape that proposal, and none of them were visible from the draft's base
commit.

**Most of the watcher already exists.** `src/scripts/run_supervise.ts` (623
lines) is an out-of-process watcher for runs whose session died: it has the
relaunch ledger keyed by roadmap-across-sessions, the `MAX_RELAUNCHES_PER_RUN
= 3` ceiling the draft proposes as new, the `AGENT_CONFIG_ORCHESTRATION_HALT`
emergency stop, report-by-default, and `headless_invocation.planResume` to
build the resume command per host. The draft's Phase 5 is largely a second copy
of it under a different trigger.

**Two of the three things the draft adds are published refusals.** Unattended
spawn (`--relaunch`) and looping (`--interval`) both exit naming a decision:
road-to-long-horizon-execution 4.0, AI council 2026-08-19, split verdict,
intersection shipped print-only. The multi-agent variant — the draft's "der
Agent setzt mit seinen subagents fort" — left scope **permanently** under 4.3,
whose closure states that reconsideration needs a new roadmap with fresh
pre-registration, never a re-reading of that blocker.

**The spawn refusal's reopen condition has fired.** It is falsifiable and not a
date: "the first time `agents/runtime/state/checkpoints/` holds a checkpoint
from a real dying run", measured absent on 2026-08-19. That directory now holds
two checkpoints, both from `road-to-standing-context-40k`, with real head SHAs
and `written_at` stamps of 2026-08-19T14:45Z and 20:44Z. This roadmap records
that; it does not act on it.

## What is NOT in scope

- Reopening the unattended-spawn refusal. Phase 3 routes it; the transition
  itself is the council's, and the evidence Phase 1 records is its input.
- Any multi-agent resume. Out of scope permanently under 4.3, and re-reading
  that blocker is exactly what its closure forbids.
- A reset-time parser. The draft is right that it needs a CI fixture holding a
  verified string and a `verified against claude-code vX.Y` note; the string
  cannot be obtained without a live account at a quota boundary, so writing the
  parser now would mean pinning a fixture nobody has seen.
- Probe-interval polling. With no spawn to trigger, a probe loop spends tokens
  to learn something nothing can act on.

## Blockers

### blocker: unattended-spawn-reopen-venue

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap any more
- **Class:** 3
- **What to do:** pick exactly one — (a) the reopen goes to the AI council,
  which closed it, with the Phase 1 evidence as its input and the
  `unattended-demotion-gate` claim as the measurement that governs the lane, or
  (b) the maintainer rules on it directly because an agent that relaunches
  itself is an autonomy expansion they want to hold.
- **Recommendation:** (a). The proposed transition is reversible and internal —
  a default-off flag on an existing report-only tool — which is the
  discriminator `decision-revisit-gate`'s owner-reserved table uses, and the
  council is the venue that closed it. (b) stays correct if the maintainer
  reads self-relaunch as a floor rather than a mechanism; that reading is
  theirs to make, not this roadmap's.
- **If you do nothing:** the reopen condition stays fired and unrecorded in any
  venue, which is the state the refusal's own wording warns about — an empty
  directory licensed "do not build the spawn yet" and never "the need does not
  exist", and a full one licenses neither answer by itself.
- **Resolved when:** a council record or a maintainer ruling names a verdict on
  reopening 4.0's spawn refusal, and this roadmap's Phase 3 cites it.
- **Outcome:** (a) was taken and answered. AI council 2026-08-22, 2/2, cost
  $0.0369: the refusal **reopens** — a stated condition that changes nothing
  when it fires was never a condition, and the refusal's own word was "not
  yet". Recorded in
  [`spawn-reopen-condition.md`](../evidence/billing-cliff/spawn-reopen-condition.md).
  Note the outcome state is in this prose line and NOT in `Status:`, where
  `resolved` is the only token every roadmap gate reads as closed.
- **Decided by:** the council, which then declined to be the venue for what
  follows — and that half overturned this blocker's own recommendation. Both
  seats accepted that the transition is procedurally reversible and internal,
  and both rejected the conclusion on the same ground: a self-relaunching agent
  changes the **autonomy floor**, not just the mechanism, so building it is
  **owner-reserved**. They named the counter-argument against themselves (the
  bounds make it look like an ordinary internal flag) and declined it. The pair
  is coherent rather than contradictory: the trigger that fired was the
  council's to read, the floor it touches is not the council's to move. What is
  now in front of the maintainer is whether to build the spawn at all; nothing
  in the tree is blocked on the answer.

## Phase 1 — Record the two findings before they have to be re-derived

- [x] **1.1 Record that the spawn refusal's reopen condition has fired.**
      Write `agents/evidence/billing-cliff/spawn-reopen-condition.md` naming the
      two checkpoint files, their run ids, roadmap, head SHAs and `written_at`
      stamps, the refusal's exact wording, and the date it was measured absent.
      The condition is the only falsifiable trigger the refusal carries, and
      `agents/runtime/` is gitignored and auto-pruned — the evidence for it is
      on one machine and disappears on its own. A trigger nobody recorded firing
      is a trigger that did not fire.
      verify: the file exists, names both run ids verbatim, and quotes the
      reopen sentence from `agents/roadmaps/archive/road-to-long-horizon-execution.md`
      rather than paraphrasing it.

- [x] **1.2 Record S-6 as a headless null, and collapse the probe hierarchy.**
      `corrected-from-reproduction` — the draft adds a sixth probe surface, a
      Claude Code usage command, and pre-registers "expect positive
      interactively, expect null headless". The headless half is decidable
      offline and was reproduced: `claude --help` at v2.1.239 lists thirteen
      subcommands (`agents`, `auth`, `auto-mode`, `doctor`, `gateway`, `import`,
      `install`, `mcp`, `plugin`, `project`, `setup-token`, `ultrareview`,
      `update`) and no `usage` among them, and no usage/quota/limit/rate flag.
      So the draft's three-rung probe hierarchy is two rungs at this version.
      Add S-6 to `later/road-to-billing-cliff-detection.md` with the null
      already recorded and the version it was measured at, so the spike does not
      re-probe a surface that is answered.
      verify: `claude --help` output contains no `usage` subcommand, the parked
      roadmap's probe table carries S-6 with its null and the version pin, and
      the interactive half stays open rather than being closed by the headless
      answer.

## Phase 2 — `quota-parked`: tell a waiting run apart from a dead one

- [x] **2.1 Add a `quota-parked` disposition to `run_supervise`.** The
      `Disposition` union (`src/scripts/run_supervise.ts:78`) has six members
      and every one of them describes a session that stopped by accident or
      finished. A run held back by an exhausted quota is neither, and today it
      classifies as `relaunchable` with the reason "the session is gone" — which
      is true and useless, because it hides the one fact that decides what to do
      next. `corrected-from-reproduction`: the draft puts this cause on
      `interruption_report.ts`, which has no cause enum to extend; the union
      that exists is here.
      verify: a test asserts a candidate carrying the parked marker classifies
      `quota-parked` with a reason naming the quota, and that a candidate
      without it is unchanged in disposition and reason.

- [x] **2.2 Write the marker from the council's own `'ask'` gate.** When
      `printBillingGate` renders a Human Gate line
      (`src/scripts/_lib/billing_grant_cli.ts:107`), the round has established
      that plan quota is exhausted for those seats — a fact this repository
      owns, with no host signal in it. `corrected-from-reproduction`: the draft
      spawns its watcher from the spike-gated stop-slot concern, so on a null
      spike nothing ever triggers; the shipped `'ask'` gate is a trigger that
      needs no spike at all. Write
      `agents/runtime/state/quota-parked/<run-id>.json` with the run id, the
      parked providers and an ISO stamp — the same PII-free shape as the billing
      grant, no field able to hold free-form content.
      verify: a test drives a parked round and asserts the marker file appears
      with those three fields and nothing else; a second asserts an unparked
      round writes no file.

- [x] **2.3 Surface the marker in the report and the digest.** `render`
      (`:362`) and `digest` (`:396`) both walk candidates; a `quota-parked` one
      says so, names the providers, and — because there is no reset-time parser
      and will not be one until the spike lands — says plainly that the reset
      time is unknown rather than guessing an interval.
      verify: a test asserts both surfaces name the disposition and the
      providers, and that neither prints a reset time or an interval.

- [x] **2.4 Re-read the grant at resume, never cache it.** The draft's own
      wording, and it is already satisfiable: `hasBillingGrant` reads from disk
      on every call, so a `--print-relaunch` plan for a quota-parked run must
      not embed a billing decision taken when the run parked. State it as a
      test rather than as a comment, because the failure it prevents — a plan
      printed hours ago carrying a stale yes — is silent.
      verify: a test issues a grant after a plan is built and asserts the plan
      carries no grant value, only the run id the grant is keyed by.

## Phase 3 — Route the spawn reopening, do not take it

- [x] **3.1 Put the reopen to the venue the blocker names.** Carry the Phase 1
      evidence, the `unattended-demotion-gate` claim in `docs/CLAIMS.md` as the
      measurement that would govern the lane, and the 4.3 boundary that keeps
      the multi-agent variant out. The question is whether 4.0's spawn refusal
      reopens now that its condition has fired — not whether a watcher should
      be built, which is what the draft asks and what the refusal already
      answered once.
      verify: a council record or a maintainer ruling exists and this step
      cites it; a verdict either way closes the blocker, and no verdict leaves
      it open rather than defaulting to either answer.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The recorded reopen condition is read as authorisation | product | Phase 1.1 records that a lock's trigger fired. A later reader can take "the condition is met" for "the refusal is lifted", which is precisely the over-reading the refusal's own last sentence guards against in the other direction. | The evidence file states the condition and its status only, and Phase 3 routes the decision to a venue instead of resolving it; the blocker's `If you do nothing` says a fired condition licenses neither answer by itself. | Context |
| 2 | `quota-parked` becomes a silent no-op nobody sees fire | implementation | The marker is written by a code path that only runs when a council round parks a seat under `api_on_quota: 'ask'`, and that value is not the default. The disposition could ship, pass its tests, and never appear in a real report. | Step 2.2's verify covers both directions, and step 2.3 renders the disposition in the digest so a real occurrence is visible without anyone querying for it. The honest limit is stated here rather than discovered later: a repository with no seat on `'ask'` will never see this fire. | Phase 2 — `quota-parked`: tell a waiting run apart from a dead one |
| 3 | The sleep-and-relaunch half is read as merely unbuilt | product | Two thirds of what the draft proposes are refusals with records, not gaps. A reader skimming this roadmap for "what is missing" would reimplement them. | § What is NOT in scope names both refusals with their record, and Phase 3 exists so the reopening has a route rather than being reattempted as new work. | What is NOT in scope |
| 4 | A reset-time parser lands against a string nobody verified | implementation | The plumbing that would feed it exists — a parked seat retains its raw error — so the parser looks one commit away, and a plausible-looking regex would pass review while pinning a fixture invented rather than observed. | § What is NOT in scope refuses the parser explicitly and states the condition that would admit it: a verified string plus the version it was verified against, which needs the live boundary the parked detection roadmap owns. | What is NOT in scope |

## Acceptance Criteria

- [x] AC-1 — The spawn refusal's fired reopen condition is recorded in a tracked
      file naming both checkpoints, so the finding survives the auto-pruning of
      the gitignored directory it was read from.
- [x] AC-2 — S-6's headless half is recorded as a null against a named
      `claude` version in the parked detection roadmap, and its interactive
      half is still open.
- [x] AC-3 — `run:supervise` reports a run held back by exhausted plan quota as
      `quota-parked` rather than as a dead session, driven by a marker this
      repository writes without any host signal.
- [x] AC-4 — No unattended spawn, no probe loop and no reset-time parser ships
      in this change, and each absence names the record or the missing evidence
      behind it rather than reading as unfinished work.
