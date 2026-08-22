---
estate_offset_exempt: "Draft-era rationale, kept as history — this file is now status: ready, so the sentence below about shipping as a draft describes the past, and the charge it deferred is claimed in estate_growth_exempt above. Carried, not added. This file exists because the Iron-Law-3 closure gate refuses to archive a roadmap with unresolved [~] items, and the AI council (2026-08-22, 2/2) routed both to a carry rather than a drop. The offset is in the same change and is exact: road-to-per-turn-hook-economy moves to archive/ in this commit, so active_roadmaps walks 3 -> 2 and the baseline is walked with it. It ships status: draft, so its three blockers charge open_blockers on the day the maintainer flips it to ready -- which is the day an offset is a real decision rather than bookkeeping, since two of the three are owner-reserved by council verdict and the third is capability-gated on a live host session. Parking it in later/ was rejected: the estate register calls that burial, and one of the two carried outcomes closes a race that can make the turn-end gate ALLOW."
complexity: structural
status: ready
estate_growth_exempt: "FLIPPED TO READY on the owner's explicit instruction, 2026-08-22 — which is the day this file's estate_offset_exempt named as the day an offset becomes a real decision rather than bookkeeping. The three blockers that were dormant under status: draft now charge open_blockers, and the policy sanctions a new blocker through no allowance other than this claim. Growth is +3 open_blockers. Two of the three are owner-reserved by council verdict (2026-08-22, 2/2) and the third is capability-gated on a live host session, so all three are exactly the decisions the flip is meant to put in front of the owner. None was added, weakened, or resolved here; only their visibility to the ratchet changed. The +1 active_roadmaps the flip creates is covered by estate_offset_exempt below, whose archive offset landed with the original commit and is not re-claimed."
execution:
  mode: phase-checkpoints
---
# Road to arming the per-turn composite bar and a safe Stop async split

> **Source:** the two `[~]` items standing at the closure of
> [`road-to-per-turn-hook-economy`](archive/road-to-per-turn-hook-economy.md),
> carried here by the Iron-Law-3 deferred-resolution gate rather than archived
> with them. Disposition decided by AI council 2026-08-22, 2/2 quorum
> (anthropic/claude-sonnet-4-5 + openai/codex-default); record
> `agents/evidence/council/per-turn-hook-economy-deferred-carry.md`.

## Goal

Two independently gated tracks, sharing nothing but this file. Track A ends when
the per-turn composite carries a registered ceiling derived from real readings —
the maintainer choosing the number is the last step and is not ours. Track B ends
when the eight async-capable `stop` concerns run in the host's async form without
the three sync-required ones moving, or when the recorded dissent is chosen
instead. Either track may close, be cancelled, or stall without touching the
other; that independence is a requirement, not a convenience.

## Why one file and not two — the council split, recorded

Both seats agreed on carrying both items. They split on shape, and the split is
worth keeping because the losing argument is good.

`codex-default`: one roadmap, two independently gated tracks — *"the only stated
option that preserves both outcomes while remaining net-neutral"*, since 23
active roadmaps under a shrink-only ratchet with `one_in_one_out` makes two new
files growth unless a second roadmap is archived in the same change.

`claude-sonnet-4-5` argued for two files: the items are unrelated — latency
measurement infrastructure versus the hook execution model — and *"combining to
satisfy a ratchet while ignoring actual coupling cost is gaming the constraint,
not estate accounting."* It also recommended a **discovery phase** for Track B
(define P5, cost-estimate P1/P2/P5, measure the Phase-4 alternative, then decide)
over committing to sequencing, and flagged that option as *"arguably
owner-reserved because it's 'should we invest in this at all?'"*.

So the split ran on two axes, and they are resolved differently.

**Shape — one file, and the losing argument is not answered, it is deferred.**
Two files requires archiving a second roadmap in the same change, and there is no
independent case for archiving any particular one; inventing a reason to make
room would be the worse form of the gaming the dissenting seat named. The
objection is answered structurally instead — separate phases, acceptance criteria
and blockers, so cancelling Track B amends nothing in Track A — and the shape
question is surfaced to the owner rather than settled here, since a council split
escalates the transition it split on. **Revisit-if:** either track grows a step
that has to reference the other, or a second roadmap reaches archival on its own
merits, at which point splitting this file costs nothing.

**Track B's shape — the discovery half is adopted, as a step rather than a
phase.** One of that recommendation's two stated reasons does not survive: P5 is
defined (see below), and the seat read it as undefined because the question this
file was decided from said *"(5) not quoted here"*. The other reason is real and
both seats agree on it — no cost-versus-saving comparison exists — so B1.0 below
produces exactly that comparison before B2 is committed to, and
`b-async-split-cancellation` is where it is answered. That is the substance of
the discovery recommendation without a second file and without pre-empting an
owner decision.

## Track A — the composite bar

### What is actually missing, and it is not time

`b-per-turn-composite-bar` is **resolved**: council 2026-08-20, 2/2, no dissent,
option (b) — observe-only for one release, then derive an absolute ceiling plus a
pathology net from the observed distribution. The source draft's `p50 <= 1.5 s`
was refused because no run in this tree produced it.

`src/config/hook-latency-budget.json` carries the state: `per_turn_composite`
holds `observe_only: true`, `observe_only_since_version: "14.6.0"`, a four-step
`arming_procedure` and an `arming_precondition` of *"At least 10 CI gate readings
of the composite, from at least 2 distinct runner sessions"*. Its own
`_arming_precondition_honesty` field records that the floor is a stated minimum,
not a derived one.

The package is at 14.8.0, so two releases have passed — **and that is irrelevant.**
Both seats made the same correction to the framing this file was built from, and
`claude-sonnet-4-5` put it plainest: *"'two releases since 14.6.0' doesn't satisfy
the arming precondition. The precondition is >= 10 readings from >= 2 sessions,
not >= 2 releases. Time passing doesn't satisfy a data-collection requirement."*

Because step 1 of the arming procedure — *"Collect the printed composite from
every CI gate run"* — has no implementation. `bench_hook_latency.ts` prints the
composite on every run; a search for `per_turn_composite` / `perTurnComposite`
across `src/` and `agents/` returns the config, that script, the parent roadmap
and evidence prose, and **no store of any kind**. So the precondition cannot be
*evaluated*, let alone met: nobody can say whether ten readings exist, because
none are recorded. `codex-default`: *"printed measurements are not durable
evidence."*

This is why the item is not "almost done, waiting for data to accumulate". The
collection mechanism is missing entirely.

## Phase A1 — make the precondition evaluable

- [ ] **A1.1 Persist every CI composite reading with its runner identity.**
      `bench_hook_latency.ts` prints the composite and discards it. Append one
      record per gate run — composite value, the four slot readings it sums,
      `tool_calls`, runner OS, run id, session discriminator, commit — to a
      durable append-only store. The session discriminator is load-bearing and
      is the reason a bare counter will not do: the precondition asks for two
      distinct runner sessions, and the instability it exists to exclude was
      measured on ONE machine (the transport cell read 44-157 % at n=12 and
      69-74 % at n=50).
      verify: two consecutive gate runs leave two records whose runner identities
      are distinguishable, and a third run on a different OS leaves a third that
      the predicate in A1.2 counts as a second session.
- [ ] **A1.2 A predicate that answers the arming question, and refuses to guess.**
      One command that reads the store and reports whether `>= 10 readings from
      >= 2 sessions` holds, printing the counts it used. It returns "not yet"
      with the shortfall named, never a bare boolean, and it must refuse rather
      than extrapolate when `perTurnComposite` returned null for a run — that
      function already returns null instead of a number when a slot is missing,
      because a composite over a subset reads low and low is the direction that
      makes a ceiling look met.
      verify: run it against a hand-built store of 9 readings from 3 sessions and
      against 12 from 1 session; both report not-armable, each naming which
      clause failed.
- [ ] **A1.3 Publish the distribution, do not choose from it.**
      When A1.2 reports armable, render the distribution — p50, p95, spread, per
      runner — into a form the maintainer can read in one screen, alongside the
      pathology-net proposal kept separate from the cap per step 3 of the
      recorded arming procedure.
      verify: the rendered artefact exists and states its own n and session count;
      no `p50_ci` value is written by this step.

## Phase A2 — arming, and the part that is not ours

- [ ] **A2.1 Set `p50_ci` and flip `observe_only` to false — MAINTAINER ACT.**
      Blocked on `b-composite-ceiling-value`. Both council seats placed this with
      the owner independently. `codex-default`: *"Owner-reserved: selecting the
      ceiling; cancelling the bar; weakening the precondition; or permanently
      accepting observe-only operation."* The config says the mechanics are
      trivial — *"Setting p50_ci to a number and observe_only to false is the
      whole of step 4.2 — no code change is needed to arm it"* — which is exactly
      why the number is the whole decision.
      verify: `hook-latency-budget.json` carries a numeric `p50_ci` for
      `per_turn_composite`, `observe_only: false`, and a recorded basis naming
      the n and the session count it came from.

## Track B — the Stop async split

### The classification is done; the step it revealed is larger

Eleven concerns bind `stop` on claude. Three are sync-required — `turn-end-gate`
(the gate itself, `EXIT_BLOCK`), `end-review-nudge` (`EXIT_WARN` plus `reason`
and `additional_context`), and `session-eol`, which was the correction that
mattered: the draft's premise was that `end-review-nudge` is the only concern
whose stdout must reach the model, and backgrounding `session-eol` would have
silently dropped the one advisory whose purpose is preventing total context loss.
The other eight are async-capable: `chat-history`, `hot-context`,
`verify-before-complete`, `team-review-gate`, `self-repair`, `session-register`,
`interruption-ledger`, `roadmap-progress`.

`b-stop-async-split-prerequisites` is **resolved** as sequencing, not cancelling
— *"sequencing preserves the outcome; cancelling discards it"* — with an anthropic
dissent for cancelling recorded as a conditional fallback. Both seats this round
confirmed the dissent does not change the disposition. `codex-default`: *"It
defines an owner-reserved fallback if later evidence shows that prerequisite cost
exceeds the expected wall-clock benefit. No such comparison is supplied here."*
`claude-sonnet-4-5`, which authored that dissent's position, still concluded
*"one dissent doesn't overturn a 2/2 convergent council"* while asking that its
weight not be understated — hence `b-async-split-cancellation` below, which
exists so choosing the fallback has a place to be decided rather than needing
this file rewritten.

P3 landed. P4 was verified closed on the trunk. **P1, P2 and P5 remain open**, and
P5 is the one the parent roadmap's own summary under-describes: it is not a
discovery gap. It is defined at the blocker — the step's `verify:`, an artefact
diff proving every async concern still writes its artefact, *"is a claim about
what the HOST does with `async: true` and is not observable from this
repository"*. That makes the final gate capability-gated on a live session with
the split config installed, with the host owner as producer — the same class as
the transferred stubs, and the reason no amount of in-repo work closes Track B
alone.

Correction worth recording, since it shaped a council answer: the question this
file was decided from wrote *"(5) not quoted here"*, and both seats read that as
P5 being undefined — `claude-sonnet-4-5` called it *"a RED FLAG for item 2
routing"* and asked whether sequencing is even actionable. It is defined; the
omission was the question's, not the roadmap's. The routing verdict survives the
correction, but a reader should not inherit the wrong reason.

## Phase B1 — cost the split, then land the two in-repo prerequisites

- [ ] **B1.0 Produce the comparison neither seat could find.**
      Both council seats independently noted that no cost-versus-benefit figure
      exists for this split: the dissent argues five prerequisites and three
      safety surfaces against a wall-clock saving nobody has measured, and
      `codex-default` scored the cancellation case as *"an owner-reserved
      fallback if later evidence shows that prerequisite cost exceeds the
      expected wall-clock benefit. No such comparison is supplied here."*
      Measure the turn-end wall clock the eight async-capable concerns actually
      cost today, from the slot readings the bench already takes, and state the
      remaining prerequisite cost as a diff estimate against B1.1-B1.3. Neither
      number decides anything; together they make
      `b-async-split-cancellation` answerable instead of rhetorical.
      verify: a dated artefact carrying both figures and the method for each, and
      the cancellation blocker's `What to do` cites it.
- [ ] **B1.1 P1 — a parity contract that permits two entries on one native event.**
      `build_claude_hook_matrix` returns one command string per native event and
      `claude_hook_matrix_parity.test.ts` asserts exactly one group with exactly
      one command per event; the dispatcher's own `tools:`-filter header cites
      that contract as a reason NOT to split groups. A sync/async split needs two
      entries on `Stop`, which is a deliberate change to the type that carries
      the hook matrix into every claude consumer's settings — so the contract
      change ships with its own decision record, never as a test edit.
      verify: the parity test asserts the NEW invariant explicitly, and a
      generated consumer settings file carries two `Stop` groups whose union is
      the eleven concerns.
- [ ] **B1.2 P2 — remove the race that can make the turn-end gate ALLOW.**
      `turn_end_gate_hook` reads `agents/state/verify-before-complete.json` for
      its completion-claim detector, and `verify-before-complete` is
      async-capable — so under a split the producer runs in a parallel process
      while the gate reads it. The order-sensitive case is the session-boundary
      reset (`state["ci_last"] = null`), which can flip the gate from "CI
      observed unsettled" to "no CI observed, therefore allow".
      `codex-default`: *"The race that could falsely allow completion is a
      correctness constraint, not merely an optimization concern."*
      verify: a test that interleaves the reset and the gate read and asserts the
      gate never reaches allow — proven by sabotage, i.e. seen RED against the
      current ordering before the fix.
- [ ] **B1.3 Audit P3's and P4's closure instead of inheriting it.**
      `codex-default` scored the claim that P3 and P4 are closed as inferred, not
      confirmed: *"Concrete files and mechanisms are named, but landed changes
      and verification results are absent."* P3 covered `dispatch-issues.jsonl`
      locking, moving the `rule-trips.json` read inside the lock, and capping
      `summary.json`'s per-invocation list; P4 was attributed to `bcbb0380b`.
      Re-verify all four against the merged tree before B1.1 lands, because the
      split is what makes those collisions reachable, and one of them is
      corruption-capable rather than merely lossy.
      verify: per file, the current source shows the lock or the discriminator,
      with a test that fails when it is removed.

## Phase B2 — the split, behind a live-host check

- [ ] **B2.1 Land the dispatcher-side subset filter and the manifest field.**
      Testable in this repository; the emission half is not. It does not ship
      alone — landing the filter without the emission is a function with no
      caller, the antipattern this roadmap's own sibling rejected — so it lands
      with B2.2 or not at all.
      verify: the filter selects exactly the eight async-capable concerns from
      the manifest, and rejects a manifest that marks a `severity: blocking`
      concern async.
- [ ] **B2.2 P5 — the live-host artefact diff. HOST-OWNER ACT.**
      Blocked on `b-async-split-live-verification`. A live session with the split
      config installed, comparing artefacts against a synchronous run: every
      async concern still writes its disk artefact. Not observable from here.
      verify: a dated record naming the host version, the eight artefacts found,
      and any that were missing.

## Blockers

### blocker: b-composite-ceiling-value
- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** Phase A2 step A2.1 only. Phase A1 proceeds without it and produces
  the distribution the decision needs.
- **What to do:** name the `p50_ci` ceiling for `(pre + post) x 10 + ups + stop`
  once A1.3 publishes the distribution, and decide the pathology net separately
  from the cap. Options: (a) adopt an absolute cap read off the measured p50 with
  the recorded headroom convention; (b) adopt a cap plus a separate pathology
  threshold, which is the posture the latency file already takes elsewhere
  because shared CI runners flap; (c) extend observe-only for another window,
  naming why the distribution was insufficient; (d) decline the bar permanently,
  which leaves the per-turn cost structurally unmeasured and is the defect the
  parent roadmap set out to fix.
- **Recommendation:** **(b)**, once A1.2 reports armable. It matches the file's
  existing posture, and separating the net from the cap is what stops one runner
  spike from reading as a regression.
- **If you do nothing:** the composite stays observe-only indefinitely. The
  number is printed on every run and constrains nothing, so Phases 1-3 and 5 of
  the parent roadmap keep shipping against no registered target — which is the
  state the parent's own blocker called the defect.
- **Resolved when:** one option is recorded here, and for (a) or (b) the row in
  `hook-latency-budget.json` carries the number with the n and session count it
  was derived from.

### blocker: b-async-split-cancellation
- **Status:** open
- **Owner:** user
- **Class:** 2 — consent-once
- **Blocks:** nothing. It exists so the recorded dissent has a place to be
  chosen without rewriting this file, and it does NOT gate Track B — sequencing
  is the standing decision and B1 proceeds under it.
- **What to do:** read the two figures B1.0 produces, then record one option.
  (a) **Sequencing stands** — proceed to B2 behind
  `b-async-split-live-verification`; the standing council decision, and the
  default if nothing is recorded. (b) **Cancel the split, keep the
  prerequisites** — B1.1-B1.3 have value without it (B1.2 closes a race that can
  make the turn-end gate allow), so this cancels B2 only and closes Track B at
  B1. (c) **Cancel Track B entirely**, including the prerequisites, accepting
  the B1.2 race as a known open defect — the strongest reading of the dissent and
  the only option that leaves a correctness issue standing, so it needs that said
  out loud. The dissent, verbatim: *"Async split requires five prerequisites,
  three with corruption/safety concerns. Phase 4 measurement exists as
  alternative lever. 5.1 cancellation precedent."*
- **Recommendation:** decide nothing until B1.0 lands. Both seats agreed no
  comparison exists yet — cancelling on the dissent's reasoning alone would
  discard the outcome without the evidence the dissent itself asks for, and
  sequencing on it alone commits to five prerequisites against an unmeasured
  saving. B1.0 exists to produce both figures; read it, then answer this.
- **If you do nothing:** Track B proceeds under sequencing, which is the
  standing council decision. Nothing is lost by leaving this open.
- **Resolved when:** either "sequencing stands" or "cancelled, with the cost
  comparison" is recorded here.

### blocker: b-async-split-live-verification
- **Status:** open
- **Owner:** user
- **Class:** 3 — capability-gated
- **Blocks:** Phase B2 step B2.2, and therefore B2.1, which may not ship alone.
- **What to do:** run one session on a host carrying the split config and record
  the artefact diff. Not delegable to CI: it is a claim about what the host does
  with `async: true`.
- **Recommendation:** run it only after B1.1-B1.3 are green, so a missing
  artefact is attributable to the emission and not to the collisions B1.3 audits.
- **If you do nothing:** Track B stops after B1 with the prerequisites landed and
  the split unshipped — a legitimate resting state, and strictly better than
  today, since B1.2 closes a race that can make a refusal surface allow.
- **Resolved when:** a dated live-session record exists, or the capability is
  recorded as unavailable with the reason.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A1.1 collects readings nobody ever looks at | product | The store fills, A1.2 reports armable, and the ceiling is never named — the same stall the parent hit, one layer down | A1.3 renders the distribution as an artefact, and `b-composite-ceiling-value` names the owner and the options rather than waiting for someone to notice | Phase A2 — arming, and the part that is not ours |
| 2 | B1.1 lands the parity change and the split never ships | implementation | The contract change reaches every claude consumer's settings while the benefit stays behind a host act that may never happen | B2.1 may not ship without B2.2, and B1.2's race fix is valuable independently — so a stop after B1 is a resting state, not a half-migration | Phase B2 — the split, behind a live-host check |
| 3 | A ceiling derived from too few readings flaps and gets ignored | implementation | A bar set from single-digit readings carries the n=12 instability measured on a sibling metric, and a flapping gate teaches readers to ignore gates | A1.2 refuses below 10 readings from 2 sessions and names the shortfall; A1.3 states its own n | Phase A1 — make the precondition evaluable |
| 4 | The two tracks grow a dependency and the one-file shape becomes the coupling the dissenting seat predicted | implementation | A step in one track starts referencing the other, at which point the estate argument for one file has been spent | Separate phases, acceptance criteria and blockers; the stated revisit-if is a step that has to reference the other track | Why one file and not two |

## Acceptance Criteria

- [ ] AC-A1 — the arming precondition is **evaluable**: a command reads a durable
      store of composite readings and reports the counts against `>= 10 readings
      / >= 2 sessions`, naming the shortfall when it is not met. Evaluable, not
      met — meeting it takes CI runs this roadmap does not control.
- [ ] AC-A2 — `per_turn_composite` in `hook-latency-budget.json` carries either a
      numeric `p50_ci` with `observe_only: false` and a recorded derivation basis,
      or a recorded owner decision at `b-composite-ceiling-value` choosing
      otherwise. Either satisfies this; an unanswered blocker does not.
- [ ] AC-B0 — the cost comparison exists: a dated artefact stating the
      turn-end wall clock the eight async-capable concerns cost today and the
      estimated prerequisite cost of B1.1-B1.3, each with its method. It does not
      have to favour either path.
- [ ] AC-B1 — the parity contract permits two entries on `Stop`, and the
      turn-end-gate race is closed by a test that was seen RED against the
      current ordering. P3's and P4's closure is re-verified against the merged
      tree rather than inherited.
- [ ] AC-B2 — either the eight async-capable concerns run async with a dated
      live-host artefact diff, or `b-async-split-live-verification` records the
      capability as unavailable and Track B rests after B1 with that stated.
- [ ] AC-0 — neither track's closure required amending the other. Falsified by
      any step in one track referencing a step in the other.
