---
complexity: standard
parent_roadmap: archive/road-to-inbox-harvest-2026-08-b-council-integrity-followup.md
---

# Road to the gate-scoped solo-attendance floor

> Build the `min_present: 2` floor that ADR-224 chose — define what makes a pass
> gate-class, thread the floor through the quorum call sites with a safe default,
> and give the floor its own telemetry so a later review can retire it on
> evidence rather than on taste.

## Context

[`ADR-224`](../../../docs/decisions/ADR-224-gate-scoped-solo-attendance-floor.md)
decided the outcome; it deliberately did not build the mechanism. The decision
was made against a measured solo-conclusion rate of **1 of 8 post_run passes =
12.5 %** (read 2026-08-11T09:30Z, definition pre-registered in
[`quorum-attendance-budget.json`](../../../src/config/quorum-attendance-budget.json)),
with the AI council converging 2/2 on the gate-scoped floor over the two
rejected alternatives.

**What is already true in the tree, verified rather than assumed:**

- `resolveQuorumThreshold` returns `ceil(n / 2)`, so at `n = 2` a single present
  member is a legitimate `concluded`
  ([`quorum.ts:13-19`](../../../src/scripts/ai_council/quorum.ts)). **Tightening
  that formula is out of scope and stays out** — the divergence is a recorded
  decision, and reopening it is a separate argument with its own record.
- `isSoloConcluded` exists and is advisory-only. ADR-224 authorizes a branch on
  it **for gate-class passes and nothing else**; the docstring already points at
  that authorization.
- `QuorumSetting` is `'majority' | number` — no `min_present`, no per-class
  variant.
- **No gate-class notion exists anywhere in the council code.** "release gate"
  appears in two source comments and one render string
  (`orchestrator.ts:2030`). This is the load-bearing gap: the concept has to be
  defined before it can be threaded, and the pre-registered telemetry filter
  (`post_run` + `command=run`) is **not** a substitute — it records which passes
  reached the providers, which correlates with gate usage without defining it.

**Why the risk-bearing part is first.** Phase 1 is the definition, not the
plumbing, because every later phase is cheap once the concept is settled and
worthless if it is wrong.

## Challenge pass, 2026-08-11 — and what it changed

Run before execution, per the standing preference that a roadmap is challenged
rather than executed on its own say-so. AI council, 2 members (anthropic,
openai), $0.07, converged **2/2 on "do not build the enforcement now"**: the
1-of-2 conclusion is a recorded deliberate behaviour, the deciding rate is 1 of
8 with an interval spanning roughly 0.3 %–53 %, and the floor *adds* a way for a
pass to fail to conclude.

Two premises were then checked against the tree, and both corrections matter
more than the verdict:

1. **Nothing branches on `QuorumStatus` to hold anything.** The only reader of
   `'inconclusive'` outside `quorum.ts` is `_deserialise_quorum`, which
   validates a persisted string. So an enforcing floor would have changed zero
   behaviour on landing — and could hang an advisory pass the moment a consumer
   appeared. The enforcement half had **no consumer to enforce against**, which
   this roadmap's Context did not know.
2. **The council's "you are overriding the n=40 trigger" argument is refuted by
   ADR-224's own text.** Trigger (a) reopens alternative (c) at n=40; trigger
   (b) is "the gate-class floor lands and its own fire-rate telemetry
   accumulates" — which presumes the floor landing. A revisit condition, not a
   precondition. Not re-asked, because the resolution below satisfies both
   readings and a re-ask would relitigate a settled decision.

**Maintainer resolution: build the floor in SHADOW.** Evaluated on every pass,
recorded, holds nothing. Phase 2 below is rewritten accordingly; Phases 1 and 3
are unchanged in intent. Enforcement is explicitly NOT in this roadmap and needs
its own record, written when a gate-class consumer exists and the rate is worth
acting on.

## Prerequisites

- [x] Read `AGENTS.md` and ADR-224 in full — in particular its "what the
      implementation still has to answer" section, which is the source of the
      three phases below.
- [x] Confirm ADR-224 is still `status: proposed` or has been accepted. If it was
      rejected or superseded, this roadmap is void and moves to `skipped/` rather
      than being re-planned around. — **`status: proposed`, verified 2026-08-11.**

## Phase 1 — Define gate-class, before threading anything

- [x] **1.1 Decide what makes a council pass gate-class**, and record the answer
      in the ADR-224 line or an amendment note rather than only in code. The
      candidates are an explicit caller flag, a config key, or inference from the
      invocation context; they are not equivalent — an inferred class silently
      reclassifies passes when the context shape changes, an explicit flag is
      only as good as the call-site audit. Name which call sites should carry it.
      — **Declared by the caller, never inferred; `gate_class` on the
      `quorum_result` line, default `false`. Recorded in the ADR-224 amendment
      § 1, with the chosen option's own failure mode named. The two
      `evaluateQuorum` call sites are the population; neither declares `true`
      today, because nothing branches on quorum status to hold a gate.**
- [x] **1.2 Fix the default for an un-instrumented call site** and state the
      reasoning. A floor that defaults on turns every uninstrumented pass into a
      potential held gate; one that defaults off means the protection is present
      only where someone remembered it. Whichever is chosen, the *other* failure
      mode is the one to name explicitly in the code comment.
      — **Off. ADR-224 amendment § 2, including the council's opposing argument
      for default-on and why it holds for an enforcing floor but not a shadow
      one. The failure mode it buys is named there and in
      `events_log.ts::QuorumEventInput`.**
- [x] **1.3 Decide default-on vs default-off for gate-class passes themselves**
      where the class is identifiable — ADR-224 lists this as undecided.
      — **On, recorded as intent rather than behaviour: with no enforcement and
      no declaring caller it decides nothing today. ADR-224 amendment § 3.**

## Phase 2 — The floor in the quorum layer (SHADOW — rewritten by the challenge pass)

- [x] **2.1 Extend the config shape** so a `min_present` floor is expressible and
      validated at load time, following the clamping discipline
      `resolveQuorumThreshold` already applies (a misconfigured cap above
      `total` is structurally unwinnable; one below 1 resolves trivially).
      — **`quorum_min_present` in `config.ts`, a SIBLING key rather than a
      widened `QuorumSetting` (which is consumed by four call sites that would
      all have to change to express a value none of them read). Validated at
      load beside `_build_quorum`; the roster clamp lives per-pass in
      `wouldSoloFloorHold`, where the roster is actually known, so a floor
      above today's roster is not rejected for a council that gains a member
      tomorrow. The clamp ceiling is `max(total, configured_total)` — the
      completion review caught the first version clamping against `total`
      alone, which made the floor structurally unable to fire on a
      construction-degraded pass, i.e. on the exact case ADR-224 was decided
      on. Forwarded through `_synthesize_ai_council_block` — the
      validated-but-never-forwarded defect this exact block shipped once for
      `quorum` itself, now pinned by its own test.**
- [x] **2.2 Compute the floor as a counterfactual on every pass**, so an
      ordinary advisory pass keeps the deliberate 1-of-2 behaviour — which in
      shadow means *every* pass keeps it. A test pins both directions: a
      solo-concluded pass is recorded as one the floor would have held, and a
      full-attendance pass is not.
      — **`wouldSoloFloorHold` in `quorum.ts`; nothing branches on it.**
- [x] **2.3 Add the negative test that would catch a scope leak** — the floor
      firing on a pass it was never scoped to is the regression this phase most
      plausibly ships, and a happy-path test cannot see it.
      — **Stronger in shadow than the enforced version admitted: the claim is
      universal, so the test is too. Over every roster 0-5, every presence, every
      quorum setting and every floor value, consulting the floor leaves the
      verdict identical and mutates nothing. An enforced design could only ever
      have tested the call sites someone remembered.**

## Phase 3 — The floor's own telemetry

- [x] **3.1 Distinguish "held by the floor" from "threshold not met".** ADR-224
      records these as semantically different outcomes; emitting `inconclusive`
      for both loses the only measurement that could later justify or retire the
      floor. Decide whether that is a new field on the existing `quorum_result`
      line or a distinct action, and keep the privacy shape the budget file
      already guarantees — counts and closed vocabularies only, no field able to
      hold free-form content.
      — **A FIELD (`floor_would_hold`), not a new action. A new action is
      invisible to every consumer filtering `action === 'quorum_result'`, which
      would split the attendance population and silently move the denominator of
      all four registered metrics — this file's own Risk 4. The two outcomes are
      mutually exclusive by construction, so they read apart from one line
      alone. Both additions are booleans, so the privacy shape cannot widen.
      Schema v2 → v3; the deliberately-literal wire-version test broke on
      purpose and was updated.**
- [x] **3.2 Register the fire-rate as a metric** alongside the existing four in
      `quorum-attendance-budget.json`, with no threshold committed before data —
      the same discipline that made this roadmap's parent decidable at all.
      — **`shadow_floor_fire_rate`, no threshold, plus an explicit
      `nothing_is_enforced` clause and a new honest gap: `gate_class` is `false`
      on every line until a gate-class consumer exists, so the rate is over ALL
      post_run passes and the gate-class-scoped rate ADR-224 cares about is
      UNMEASURED rather than zero.**

## What this roadmap deliberately does NOT build

Enforcement. No pass is held, delayed or failed at any configuration, and
`isSoloConcluded` is still branched on by nothing. This is a narrower scope than
ADR-224 authorized, recorded here so it is a stated boundary rather than an
unfinished phase.

**The condition for revisiting is falsifiable and does not depend on anyone
remembering:** a consumer appears that branches on `QuorumStatus` to hold
something — at which point that consumer is the first gate-class caller, it sets
`gate_class: true`, and `shadow_floor_fire_rate` filtered on that flag is the
evidence the enforcement decision was always supposed to rest on. Until then
there is nothing to enforce against, and an enforcement switch would be a hold
nobody reads. ADR-224's own trigger (a) — the n=40 denominator — remains open in
parallel and is unaffected by this work.

## Blockers

None. The three open questions in Phase 1 are *steps*, not blockers: each is a
judgement this roadmap is meant to make, none waits on an external human action,
a date, or spend. Recording that explicitly matters — the parent's blocker was
mis-parsed into a `user`-owned `legacy` blocker once already, which counted a
gate that needed only time as a roadmap that "needs you".

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-11 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The gate-class definition leaks and the floor fires on advisory passes | implementation | The concept does not exist yet, so its first definition sets the blast radius; an inferred class in particular reclassifies passes whenever the invocation context changes, and the symptom (an advisory pass held for a human) reads as a hang rather than as a gate | Phase 1 settles the definition before any threading, 2.2 pins both directions, and 2.3 is a dedicated negative test for the leak rather than a happy-path assertion | Phase 1 |
| 2 | The floor is built on a rate too thin to justify it | product | The deciding rate was 1 of 8 passes; ADR-224 records the 95 % interval as roughly 0.3 %–53 %, so this work is authorized by urgency plus reversibility, not by a settled effect size | ADR-224's review trigger reopens the null at n=40, Phase 3 makes the floor's own fire-rate measurable so retiring it is an evidence decision, and the floor stays scoped to gate-class passes so the reversal surface is small | Phase 3 |
| 3 | Implementing a floor is read as licence to tighten `ceil(n/2)` | implementation | A `min_present: 2` floor at n=2 and a `floor(n/2)+1` threshold produce the same outcome for the gate case, which makes the formula change look like a simplification of this work rather than the separate decision it is | The exclusion is restated in this file's Context with the citation, and ADR-224 names it as out of scope in its own Alternatives, so a future reader meets the boundary twice before touching `quorum.ts:13-19` | Context |
| 4 | The new telemetry outcome breaks readers of the existing event shape | implementation | `quorum_result` is schema-versioned and already consumed by the four registered metrics; adding an outcome that a reader treats as `inconclusive` would silently inflate that bucket | 3.1 chooses field-vs-action deliberately rather than by convenience, `schema_version` exists for exactly this, and 3.2 registers the new metric so the split is documented where the other four are | Phase 3 |

## Acceptance Criteria

- [-] ~~A gate-class pass with one present member resolves `inconclusive` and
      holds for a human; a non-gate pass with one present member still
      concludes. Both are pinned by tests.~~ **Not applicable — this criterion
      describes the enforcement the challenge pass and the tree both rejected.
      Ticking it would have required building a hold that no consumer reads.
      Replaced by the criterion below rather than reinterpreted, so the
      difference stays visible.**
- [x] A solo-concluded pass is recorded as one the floor would have held; a
      full-attendance pass is not; and consulting the floor changes the verdict
      of NO pass, for any roster, presence, quorum setting or floor value. All
      three are pinned by tests.
- [x] The gate-class definition, the un-instrumented default, and the
      default-on/off choice are each recorded with their reasoning — not only
      implemented. — **ADR-224 amendment §§ 1-3, each naming the failure mode of
      the option chosen rather than only of the ones rejected.**
- [x] "Held by the floor" is distinguishable from "threshold not met" by reading
      the event log alone, and the fire-rate is registered as a metric with no
      threshold committed before data.
- [x] `ceil(n/2)` is unchanged, and `isSoloConcluded` is branched on by nothing —
      a scope NARROWER than ADR-224 authorized, which is the direction the
      challenge pass pushed and the only one that needs no further permission.
- [x] All quality gates pass — see `quality-tools`.
