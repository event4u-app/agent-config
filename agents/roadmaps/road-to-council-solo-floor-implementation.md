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

[`ADR-224`](../../docs/decisions/ADR-224-gate-scoped-solo-attendance-floor.md)
decided the outcome; it deliberately did not build the mechanism. The decision
was made against a measured solo-conclusion rate of **1 of 8 post_run passes =
12.5 %** (read 2026-08-11T09:30Z, definition pre-registered in
[`quorum-attendance-budget.json`](../../src/config/quorum-attendance-budget.json)),
with the AI council converging 2/2 on the gate-scoped floor over the two
rejected alternatives.

**What is already true in the tree, verified rather than assumed:**

- `resolveQuorumThreshold` returns `ceil(n / 2)`, so at `n = 2` a single present
  member is a legitimate `concluded`
  ([`quorum.ts:13-19`](../../src/scripts/ai_council/quorum.ts)). **Tightening
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

## Prerequisites

- [x] Read `AGENTS.md` and ADR-224 in full — in particular its "what the
      implementation still has to answer" section, which is the source of the
      three phases below.
- [x] Confirm ADR-224 is still `status: proposed` or has been accepted. If it was
      rejected or superseded, this roadmap is void and moves to `skipped/` rather
      than being re-planned around.

## Phase 1 — Define gate-class, before threading anything

- [x] **1.1 Decide what makes a council pass gate-class**, and record the answer
      in the ADR-224 line or an amendment note rather than only in code. The
      candidates are an explicit caller flag, a config key, or inference from the
      invocation context; they are not equivalent — an inferred class silently
      reclassifies passes when the context shape changes, an explicit flag is
      only as good as the call-site audit. Name which call sites should carry it.
- [x] **1.2 Fix the default for an un-instrumented call site** and state the
      reasoning. A floor that defaults on turns every uninstrumented pass into a
      potential held gate; one that defaults off means the protection is present
      only where someone remembered it. Whichever is chosen, the *other* failure
      mode is the one to name explicitly in the code comment.
- [x] **1.3 Decide default-on vs default-off for gate-class passes themselves**
      where the class is identifiable — ADR-224 lists this as undecided.

## Phase 2 — The floor in the quorum layer

- [x] **2.1 Extend the config shape** so a `min_present` floor is expressible and
      validated at load time in `_build_quorum`, following the clamping
      discipline `resolveQuorumThreshold` already applies (a misconfigured cap
      above `total` is structurally unwinnable; one below 1 resolves trivially).
- [x] **2.2 Apply the floor at the gate-class call sites only**, so an ordinary
      advisory pass keeps the deliberate 1-of-2 behaviour. A test must pin both
      directions: a gate-class solo pass holds, and a non-gate solo pass still
      concludes.
- [x] **2.3 Add the negative test that would catch a scope leak** — the floor
      firing on a pass that is not gate-class is the regression this phase most
      plausibly ships, and a happy-path test cannot see it.

## Phase 3 — The floor's own telemetry

- [x] **3.1 Distinguish "held by the floor" from "threshold not met".** ADR-224
      records these as semantically different outcomes; emitting `inconclusive`
      for both loses the only measurement that could later justify or retire the
      floor. Decide whether that is a new field on the existing `quorum_result`
      line or a distinct action, and keep the privacy shape the budget file
      already guarantees — counts and closed vocabularies only, no field able to
      hold free-form content.
- [x] **3.2 Register the fire-rate as a metric** alongside the existing four in
      `quorum-attendance-budget.json`, with no threshold committed before data —
      the same discipline that made this roadmap's parent decidable at all.

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

- [x] A gate-class pass with one present member resolves `inconclusive` and holds
      for a human; a non-gate pass with one present member still concludes. Both
      are pinned by tests.
- [x] The gate-class definition, the un-instrumented default, and the
      default-on/off choice are each recorded with their reasoning — not only
      implemented.
- [x] "Held by the floor" is distinguishable from "threshold not met" by reading
      the event log alone, and the fire-rate is registered as a metric with no
      threshold committed before data.
- [x] `ceil(n/2)` is unchanged, and `isSoloConcluded` is branched on only for
      gate-class passes — the exact scope ADR-224 authorized.
- [ ] All quality gates pass — see `quality-tools`.

## Execution notes 2026-08-11 — where the work departed from its own text

Recorded rather than smoothed over, because three of these are decisions a
future reader would otherwise re-derive from scratch.

**2.1 departed from its own text, and the step's premise is what fell.** It asked
for `min_present` to be "expressible and validated at load time in
`_build_quorum`" — i.e. in the council config. The *intent* (an expressible,
validated floor) shipped; the *location* did not. Config is the wrong carrier on
a fact ADR-224 itself established: the council config is user-global (ADR-104),
so a configurable floor would be present or absent per operator machine with no
signal when absent — which is precisely the objection that rejected ADR-224's own
alternative (a). A configurable magnitude is also strictly worse than none: an
operator setting `min_present: 1` disables the floor silently, since 1 is
satisfied by every pass that met its threshold. So the floor is a frozen constant
(`GATE_CLASS_ATTENDANCE_FLOOR`) validated in `quorum.ts` with the clamping
discipline `resolveQuorumThreshold` already uses, and `QuorumSetting` is
untouched. `_build_quorum` needed no change and got none.

**The floor's clamp is deliberately asymmetric to the threshold's, and that looks
like a bug until you read why.** `resolveQuorumThreshold` clamps a threshold into
`[1, total]` so a misconfiguration cannot make a pass structurally unwinnable. The
floor clamps only its lower bound: a floor *above* `total` being unwinnable is the
floor working — a council smaller than a gate requires must hold that gate, not
pass it because the requirement was lowered to fit the roster. Pinned by a test,
with the asymmetry named in both.

**Criterion 4 is satisfied more narrowly than it asks.** It requires
`isSoloConcluded` to be "branched on only for gate-class passes". The floor
branches on it **not at all** — `AttendanceFloor` compares `present` against a
minimum directly, which subsumes the solo case. So ADR-224's permission to branch
on that predicate is still unspent and the predicate stays advisory-only. A future
solo branch still needs its own record; nothing was widened for it.

**The event schema moved 2 → 3, and a test broke on purpose.**
`tests/.../events_log.test.ts` pins the on-wire version as a literal precisely so
a bump cannot pass silently. It was updated as part of this change, which is the
mechanism working, not a ratchet being loosened: every v2 field kept its name,
type and position, and the addition is one field (`held_by_floor`). The warning
that field carries is real — a v2 reader bucketing on `verdict` alone now
under-reports, because a floor-held pass is `inconclusive` while being a
different outcome from a threshold never met.

**No gate threshold was loosened anywhere in this change.**
`quorum-attendance-budget.json` gained a metric that commits **no** threshold (for
the same n=8 reason `solo_conclusion_rate` commits none) plus two honest gaps; no
existing threshold was weakened. Stated explicitly because the edit trips a
config-weakening guard on the filename alone.

### The council's finding, adopted — this ships a capability, not yet a protection

An AI council (2 members, $0.0548) was asked to decide 1.1–1.3 and converged 2/2
on something the roadmap text did not anticipate: **a default-off floor with zero
consumers is ceremonial compliance.** The finding is adopted rather than
summarised away, and its decisive premise was verified in-tree before adoption
rather than taken on trust: `legal_review_prep.require_council` — the nearest
thing to a gate consumer — appears **only** in the settings template, its zod
schema, one rule file and one skill file. **No code reads it.** It is a
model-carried obligation, so there is nothing to instrument today.

What was **declined**, with reasons, so neither is re-proposed as new:

- Deriving a `gate_risk` heuristic inside `evaluateQuorum` from `command === 'run'`.
  That *is* the inference option the same review called the worst available
  choice, and it would break `quorum.ts`'s documented purity (no context, no
  config parsing) — the module's own header is the contract it violates.
- A CI alarm over the solo/floor rates. `agents/runtime/council/events.log` is
  gitignored and **worktree-local** — two sessions on this repository read 3 and
  18 `quorum_result` lines at the same moment on 2026-08-11 — so a workflow would
  assert over whatever the runner happens to have, which on a fresh checkout is
  nothing. A durable shared sink is a prerequisite, not a detail.
- Wiring `require_council` now. It means threading quorum enforcement into skill
  execution: an architectural change with its own safety surface, wider than this
  roadmap and outside its scope.

**So the inertness is recorded as a falsifiable gap rather than hidden.**
`quorum-attendance-budget.json` states that a zero `floor_fire_rate` means "zero
callers", never "zero fires", and names the trigger that changes it: **the first
caller that passes `GATE_CLASS_ATTENDANCE_FLOOR`.** That is a condition, not a
date, and it is the honest successor to this roadmap — a roadmap for wiring the
first consumer, not another deferral of the floor.
