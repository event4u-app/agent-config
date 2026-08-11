---
adr: 224
status: proposed
date: 2026-08-11
decision: gate-scoped-solo-attendance-floor
supersedes: —
superseded_by: —
phase: road-to-inbox-harvest-2026-08-b-council-integrity-followup
type: structural
review_trigger: >-
  Revisit at the 2026-11-10 review date already carried by
  quorum-attendance-budget.json, or earlier on either observable event: (a) the
  post_run/command=run denominator reaches 40 passes, at which point the
  solo-conclusion rate has a confidence interval narrow enough to separate
  "above 5 %" from "under 5 %" and the pre-registered option (c) becomes
  decidable on evidence rather than excluded on a point estimate; or (b) the
  gate-class floor lands and its own fire-rate telemetry accumulates, which
  answers a different question than this record does — how often the floor
  actually holds a gate, versus how often a pass concluded on one voice.
  Nothing here expires on the calendar alone: option (c) stays available and
  becomes MORE defensible as n grows, because a rate that falls under 5 % on a
  larger sample is the null this decision could not yet publish.
---

# ADR-224 — A solo-attendance floor is scoped to gate-class passes, not bought with a third member

## Status

**Proposed** · 2026-08-11. Records which of three pre-registered outcomes was
chosen against real attendance data, and authorizes one branch that
[`quorum.ts`](../../src/scripts/ai_council/quorum.ts) currently forbids without
a record. **This record changes no runtime behaviour by itself** — it decides,
and names the implementation as separate work. Acceptance is the maintainer's
call.

## Context

At `n = 2` enabled council members, `resolveQuorumThreshold` returns
`ceil(2/2) = 1`, so a pass in which one member is absent still returns
`concluded` — on one voice. That is deliberate and recorded as such in
[`quorum.ts:13-19`](../../src/scripts/ai_council/quorum.ts): the stricter
`floor(n/2)+1` reading "turns any single absent member into a deadlocked
release gate", so 1-of-2 is "the deliberate choice, not an off-by-one".
**Tightening `ceil(n/2)` is out of scope here and stays out.**

Whether that legitimacy needed a floor was deferred three times — first as
`blocker: b-quorum-n2` in `road-to-feedback-9-29.md`, then as step 1.6 of
`road-to-inbox-harvest-2026-08-b-council-integrity.md`, both times on the same
unpaid precondition: the answer is a *rate over real passes*, and no event
existed to accumulate one. That parent's Phase 1 then shipped the
`quorum_result` event, which is why the precondition is met for the first time
and this is a decision rather than a fourth deferral.

### The rate, and the method that was fixed before the data existed

The definition is pre-registered in
[`quorum-attendance-budget.json`](../../src/config/quorum-attendance-budget.json)
— not re-derived here, which is the point of registering it. It is the share of
`post_run` **and** `command=run` passes carrying `solo: true`, split by
`dispatch` and `configured_total`, and decided "on the degraded case only; a
`--single` pass is the operator asking for one voice, not the council failing to
assemble". Two filters in that definition are load-bearing and were not obvious:
a rate over both phases double-counts, because one pass emits `pre_run` at
member construction and `post_run` after the providers answered; and a `pre_run`
line is not evidence a pass ran at all, since `command: estimate` is a
spend-free preview and the `--confirm` gate returns before any provider call.

Read from `agents/runtime/council/events.log` at **2026-08-11T09:30Z**:

| Quantity | Value |
|---|---|
| Denominator — `post_run` + `command=run` passes | **8** |
| Degraded solo conclusions (`dispatch=full`, `configured_total=2`) | **1** |
| `--single` dispatch solo conclusions | 0 |
| One-member-council solo conclusions (`configured_total=1`) | 0 |
| Roster shortfall (`total < configured_total`) | 0 |
| **Solo-conclusion rate (degraded case)** | **1 / 8 = 12.5 %** |

The one solo pass lost member `anthropic` with reason `unavailable`. The log is
append-only and other sessions write to it concurrently — it grew from 18 to 20
`quorum_result` lines during this measurement — so the timestamp above is part
of the reading, not decoration.

**What this number does and does not support, stated plainly.** 12.5 % is above
the 5 % figure pre-registered in option (c), so (c) does not fire on the point
estimate. But at n=8 a 95 % confidence interval around 1/8 runs roughly
0.3 %–53 %, so the data does not separate 12.5 % from "under 5 %" with
confidence, and one additional non-solo pass moves the estimate to 11.1 %. The
rate therefore establishes **urgency, not certainty**. The load-bearing
justification for deciding now is procedural: the ask has already survived two
deferrals on silence, the roadmap carrying it names "becoming the fourth
deferral" as its own top product risk, and the chosen option is reversible.
Recording that distinction is the honest alternative to letting a volatile point
estimate read as a mandate.

## Decision

**Option (b): a `min_present: 2` floor, scoped to gate-class passes only.**

At a gate-class pass, a conclusion reached on a single present member does not
carry the gate; it resolves `inconclusive`, which
[`quorum.ts:5-11`](../../src/scripts/ai_council/quorum.ts) already names as the
intended behaviour there — an inconclusive pass "HOLDS the gate for a human — it
is NEVER silently downgraded to advisory". Ordinary advisory passes keep the
1-of-2 behaviour `ceil(n/2)` deliberately chose, so this does not reopen that
divergence.

### This record authorizes the branch `quorum.ts` forbids

`isSoloConcluded` is documented as "advisory render and telemetry only: no gate
reads it, and nothing downstream may branch on it **without its own decision
record**". A gate-scoped floor is exactly such a branch. The two statements
cannot both stand unqualified, and the honest resolution is not to pretend the
floor is not a branch: **this ADR is that decision record**, and it authorizes
the branch for gate-class passes and for nothing else. The predicate's docstring
is updated in the same change to point here, so a reader of the code finds the
authorization instead of re-litigating the prohibition.

### What the implementation still has to answer — and why it is not in this record

Three things are genuinely undecided, and none of them is a plumbing detail:

1. **The gate-class concept does not exist.** Verified against the tree: the
   phrase "release gate" appears only in two source comments and one render
   string (`orchestrator.ts:2030`); `QuorumSetting` is `'majority' | number`
   with no `min_present` and no per-class variant. The pre-registered telemetry
   filter (`post_run` + `command=run`) is *not* a substitute — it measures which
   passes reached the providers, which correlates with gate usage but does not
   define it. So the floor requires defining what makes a pass gate-class, then
   instrumenting the call sites that should set it, with a safe default for
   every call site that is not instrumented.
2. **The floor introduces a third outcome, not a second.** "Met the threshold
   but held by the floor" is semantically distinct from "did not meet the
   threshold". Emitting `inconclusive` for both loses the ability to measure how
   often the floor fires, which is the only evidence that would later justify or
   retire it.
3. **Whether the floor is default-on or default-off** where a gate-class pass is
   identifiable at all.

Step 1.1 of the parent roadmap asks for an outcome "chosen against a rate that
was actually read, and the outcome recorded". It does not ask for the mechanism,
and building one that first invents a classification, audits every call site and
adds a telemetry state is roadmap-sized rather than step-sized. The
implementation is therefore carried by a separate roadmap — named here without a
path, because a roadmap is archived when it closes and a link from this record
would break on exactly the change that closes it — which exists so that a chosen
outcome does not become a fifth deferral by silence.

**All three are now answered; see the amendment below.**

## Amendment, 2026-08-11 — the measurement landed, the enforcement did not

The three open questions above are answered here rather than only in code, per
the implementation roadmap's own acceptance criterion. Two facts read off the
tree during implementation changed what "implementing this decision" means, and
neither was known when the Decision above was written:

- **Nothing in the tree branches on `QuorumStatus` to hold anything.** The only
  reader of `'inconclusive'` outside `quorum.ts` is
  `council_cli.ts::_deserialise_quorum`, which validates a persisted string. An
  enforcing floor would therefore have changed **zero** behaviour on the day it
  landed — there is no gate for it to hold — while being able to hang an
  advisory pass as soon as a consumer appeared. The enforcement half had no
  consumer to enforce against.
- **A challenge pass converged 2/2 against building the enforcement now** (AI
  council, 2026-08-11, members anthropic and openai): the deciding rate is 1 of
  8 with an interval spanning roughly 0.3 %–53 %, the 1-of-2 conclusion is a
  recorded deliberate behaviour, and the floor *adds* a way for a pass to fail
  to conclude. One member argued the stronger form — that building at n=8
  overrides this record's own n=40 trigger and is therefore a governance
  violation. **That reading is refuted by this record's text**: trigger (a)
  reopens alternative (c) at n=40, and trigger (b) is "the gate-class floor
  lands and its own fire-rate telemetry accumulates", which *presumes* the floor
  landing. The trigger is a revisit condition, not a precondition. It is
  recorded here rather than re-argued with the council, because the maintainer's
  chosen resolution below satisfies both readings and a re-ask would have
  relitigated a settled decision.

**Resolution, maintainer-chosen: the floor is built in shadow.** It is evaluated
on every pass and recorded; it holds nothing. That is compatible with this
record (it is what trigger (b) asks to accumulate), with the challenge verdict
(nothing is enforced on a 1-of-8 estimate), and with the tree (there is nothing
to enforce against). Enforcement stays a separate decision, to be made when a
gate-class consumer exists **and** the rate is worth acting on.

### 1. What makes a pass gate-class — declared, never inferred

Gate-class is a **property the caller declares**, recorded as `gate_class` on
the `quorum_result` line, defaulting to `false`.

Inference from the invocation context was rejected: it silently reclassifies
passes whenever the context shape changes, and that is the one failure a rate
computed over the field could never detect. A config key was rejected because it
moves the classification to an operator who does not know which call sites gate
anything.

**The failure mode of the choice made, stated rather than only the rejected
ones:** a declared flag is exactly as good as the call-site audit that places
it, so a caller that gates a release and forgets to declare itself is invisible
to the floor. The mitigation available today is that the population is small —
there are two `evaluateQuorum` call sites in the tree — and that `command` and
`phase` remain on every line, so the inferred reading can still be computed and
compared against the declared one when they are expected to disagree.

**No call site declares `true` today**, and that is not an omission: with no
consumer branching on quorum status, there is no gate-class caller to mark. The
field is written regardless, so the split is readable the moment one appears
rather than leaving every earlier line ambiguous.

### 2. The un-instrumented default — off, and why that is safe *here*

An un-declared call site is **not** gate-class.

In an enforcing design this is the harder call, and one council member argued
the opposite (default ON, since an unmarked gate-class pass that solo-concludes
risks a defect escape, while an unmarked advisory pass only delays a developer).
That argument is sound **for an enforcing floor** and does not transfer to a
shadow one: nothing is held at either setting, so the cost of defaulting off is
a missing measurement rather than a missed protection, and the cost of
defaulting on would be a fire-rate inflated by passes nobody ever intended to
gate — an artefact that would corrupt the very series ADR trigger (b) exists to
accumulate.

**The failure mode:** if enforcement is ever switched on while this default
stands, an undeclared gate-class caller silently loses the floor. Enforcement
must therefore not be a flag flip — it needs its own record, which re-decides
this default against the consumers that exist by then.

### 3. Default-on/off for declared gate-class passes — moot today, on when it lands

For a pass that declares itself gate-class, the floor is intended **on**: a
caller that declares the class is asking for the floor, and a declared-but-off
state is a setting whose only effect is to make the declaration a lie.

This is recorded as intent, not as behaviour: with no enforcement and no
declaring caller, it decides nothing today. It is written down so the
enforcement decision starts from a stated position rather than re-opening a
question this record already considered.

## Consequences

- A gate-class council pass will hold for a human rather than conclude on one
  voice, once the implementation lands. Nothing changes before that.
- `isSoloConcluded` stops being purely advisory **for gate-class passes**. Its
  advisory-only status elsewhere is unchanged, and any further branch needs its
  own record — this one is scoped deliberately narrowly.
- `quorum-attendance-budget.json` no longer says "none committed" for
  `solo_conclusion_rate`; it records the chosen outcome and this ADR, so the
  metric and its decision cannot drift apart.
- The 2026-11-10 review inherits a sharper question than it had: not "what is
  the rate" but "did the floor fire, and does a larger n still exclude the
  null".
- Cost: none. No third provider is added, so no additional per-pass latency and
  no metered call.

## Alternatives

### (a) Add a third CLI member (`gemini`) — rejected

With `n = 3`, `ceil(3/2) = 2` makes a 1-of-3 pass `inconclusive`, so the
solo-conclusion case disappears through the *existing* formula with no new
config key and no new vocabulary. It is also spend-free on this host, which was
verified rather than assumed: the binary exists at `/opt/homebrew/bin/gemini`
and `PROVIDER_CLI_META` records `gemini: ['gemini', false]`, where `false` means
a vendor-official CLI running under the user's own subscription
([`environment_detector.ts:127-141`](../../src/scripts/_lib/environment_detector.ts)).

It loses on two verified facts, the first decisive:

- **It degrades silently exactly where it is supposed to protect.** On a host
  without the binary the third member fails to construct, `total` falls back to
  2, `threshold` returns to 1, and the solo conclusion is possible again — with
  no signal that the floor is gone. A protection whose absence is invisible is
  worse than a narrower one that is present everywhere.
- **It is largely not deliverable as a change to this repository.** The roster
  lives in the user-global `~/.event4u/agent-config/settings/.ai-council.yml`
  (ADR-104); the repo carries only
  `agents/templates/.ai-council.yml.example`. So (a) is an instruction to each
  operator, and its effect varies per machine.

It also changes every pass rather than gate-class ones — latency, and the
character of convergence, since a 2/2 agreement becomes 2/3 or 3/3.

### (c) Publish a null and cancel the floor — rejected on the point estimate, kept alive by the review trigger

The pre-registered condition is "under 5 %"; the read rate is 12.5 %, so the
condition is not met and honouring the pre-registration means (c) does not fire.
Re-reading the threshold against the confidence interval's *lower bound* after
seeing the data would be exactly the post-hoc rationalisation the
pre-registration exists to prevent — which is why the sample-size objection is
recorded above as a limit on certainty and in the `review_trigger` as a
condition to revisit, rather than used to flip the outcome now.

### Tightening `ceil(n/2)` to `floor(n/2)+1` — out of scope, unchanged

Named here only so that choosing a floor is not later read as licence to reopen
it. `quorum.ts:13-19` records the divergence as a decision; reopening it is a
separate argument and needs its own record.

## References

- [`src/scripts/ai_council/quorum.ts`](../../src/scripts/ai_council/quorum.ts) — `ceil(n/2)`, the inconclusive-holds-the-gate contract, and the `isSoloConcluded` prohibition this record authorizes a narrow exception to.
- [`src/config/quorum-attendance-budget.json`](../../src/config/quorum-attendance-budget.json) — the pre-registered rate definition, its phase/command filters, and the honest-gap list.
- [`agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-council-integrity.md`](../../agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b-council-integrity.md) — parent; shipped the `quorum_result` event and deferred 1.6 behind `blocker: quorum-solo-floor`.
- AI council, 2026-08-11, 2 members (anthropic, openai), 2 rounds, $0.0629 — converged 2/2 on (b). Its two substantive corrections are adopted above rather than summarised away: that the 12.5 % supports urgency and not certainty, and that a gate-scoped floor *is* a branch on solo status and so needs this record to exist.
- ADR-104 — council config is user-global, which is what makes option (a) an operator instruction rather than a repository change.
