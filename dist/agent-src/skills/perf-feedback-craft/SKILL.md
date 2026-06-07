---
model_tier: inherit
name: perf-feedback-craft
description: "Use when shaping feedback — situation-behavior-impact, growth-vs-corrective split, cadence design, ladder-of-inference checks. Triggers on 'how do I give this feedback', 'perf review shape'."
status: active
tier: senior
domain: process
context_spine: [org-stage, customer-segment, product]
workspaces:
  - ops
packs:
  - ops-people
trust:
  level: professional
install:
  removable: true
---

# perf-feedback-craft

## When to use

- A specific feedback conversation is upcoming (1:1, 30 / 60 / 90 check, mid-cycle review, end-of-cycle review, corrective conversation) and the question is *what shape this conversation should take*.
- A team-wide feedback cadence is being designed or audited and the question is *which signals get surfaced, when, and through what channel*.
- A growth conversation is being confused with a corrective conversation (or vice versa) and someone needs to separate them before the next exchange.

Do NOT use as a comp-decision surface (route to Q2 `comp-banding`; feedback informs comp, doesn't substitute for it), as a hiring-loop / calibration-design skill (route to S2 `hiring-loop-design`), or for performance-review-software configuration.

## Cognition cluster

- **Mental model 1 — First principles.** Strip feedback to: *what observation, about what behavior, with what impact, requesting what change?* Most feedback fails because it skips the observation (jumps to interpretation) or skips the impact (assumes it's obvious). See [`mental-models.md`](../../../docs/contracts/mental-models.md) § 1.
- **Mental model — Ladder of inference.** Behavior observed → data selected → meaning inferred → assumptions made → conclusions drawn → beliefs adopted → action taken. Most feedback exchanges fail because giver and receiver are on different rungs. Naming the rung you're on (and inviting the other party to do the same) is the single highest-leverage feedback skill.
- **Mental model 28 — Inversion.** *"What would make this feedback land as an attack instead of a gift?"* — usually: public delivery, surprise (no prior signal), interpretation-as-fact, no specific request, no listening turn. Inversion surfaces the four canonical mis-deliveries.
- **Mental model 21 — Second-order thinking.** Feedback ripples. Praise in public, correction in private — the inverse damages both giver and receiver. A single mishandled feedback exchange damages trust for 6+ months; a single well-handled one banks trust that compounds.
- **Context-spine slots.** Read **org-stage** for what feedback infrastructure exists (10-person: ad-hoc; 50-person: cadence emerging; 150+: documented system). Read **customer-segment** and **product** for what behavior matters (B2B-enterprise sales = stakeholder management; consumer = velocity; deep-domain = quality bar).

## Cross-wing handoff

- Composed by Q3 `onboarding-program` at 30 / 60 / 90 milestone checkpoints (first feedback exchanges are highest-impact).
- Hands off to Q2 `comp-banding` for compensation decisions — feedback shapes the evidence base for promotion / raise / market-correction lever choice.
- Hands off to S1 `one-on-one-cadence` for the channel and frequency in engineering teams (S1 specializes Q4 for the eng context).
- Composed by T3 `people-strategist` and cited by T4 `engineering-manager`.

## Procedure

### Step 0: Diagnose the conversation type before designing the words

Before shaping any feedback exchange, name which of three types it is:

1. **Growth feedback** — about expanding capability, scope, judgment. Audience: people performing at or above expectation, with capacity for the next level. Goal: name where the next rung lives.
2. **Corrective feedback** — about closing a gap between current and expected behavior. Audience: people below expectation on a named behavior. Goal: clarity on the gap + path to close + timeline.
3. **Acknowledgement / reinforcement** — about naming what worked. Often confused with growth, but distinct: this banks trust and reinforces behavior; it doesn't ask for change.

Mixing types in one exchange is the canonical mistake. A corrective conversation that opens with growth language confuses everyone; growth feedback dressed as correction harms trust. Pick one.

### Step 1: Build the SBI (situation-behavior-impact) frame

For the exchange in scope, write three sentences:

1. **Situation** — when, where, what context. Concrete enough that the receiver can place themselves back in it. *"In the planning meeting yesterday"* not *"in meetings generally"*.
2. **Behavior** — what was observed, in their actions / words. Stays on the observation rung of the ladder; does not infer intent. *"You interrupted three times before each engineer finished their estimate"* not *"You don't respect the team"*.
3. **Impact** — what consequence it had, observed or felt. Tells the *why this matters* without lecturing. *"The estimates skewed low because two engineers stopped pushing back"* not *"You're going to lose your team"*.

The SBI test: read it aloud. If the behavior sentence contains an adjective about the person, rewrite it. Adjectives belong nowhere in feedback.

### Step 2: Inspect the rung — verify ladder-of-inference position before delivery

Before delivering, inspect where you are on the ladder of inference:

1. Are you on the **observation** rung (data) or the **conclusion** rung (interpretation)?
2. If you're on a higher rung, can you climb back down to the data? If you can't, the feedback is unsupported and must not be delivered yet.
3. Have you asked yourself *"what other interpretation of this behavior is plausible?"* If only one interpretation comes to mind, you haven't climbed down far enough.

This inspection step is the single most-skipped step in feedback delivery. Delivering interpretation-as-fact is the canonical trust-damaging move.

### Step 3: Design the delivery channel and timing

For a specific exchange, name:

1. **Channel** — 1:1 private (default for corrective and most growth); team-public (reserved for acknowledgement that doesn't single out underperformance contrast); written-async (rare, only for high-density observations the receiver needs time with).
2. **Timing** — within 48 hours of the behavior for tactical feedback; within the milestone for thematic feedback; never at end-of-cycle for first-surface (the surprise principle).
3. **Sequence in the meeting** — do not lead with feedback; check-in first, named topic second, listening turn after delivery (the receiver gets time to respond before next-step is set).

Surprise is the largest avoidable failure mode. A piece of corrective feedback that the receiver is hearing for the first time at end-of-cycle is malpractice.

### Step 4: Listening turn and request shape

After delivery, build in two things:

1. **Listening turn** — explicit pause. *"What's your read on this?"* Not rhetorical. Wait. The receiver may have a fact you don't (was on PTO, was covering for someone, miscommunication upstream). Their read changes whether the feedback even stands.
2. **Specific request** — what would change look like. Concrete, observable, time-boxed. *"In the next three planning meetings, hold your estimate until each engineer has spoken first"* not *"be more respectful"*.

Requests without observable shape are wishes, not feedback.

### Step 5: Validate the feedback shape before delivery

Before opening the conversation, verify three things:

1. **SBI integrity** — confirm Step 1's behavior sentence contains zero adjectives about the person and stays on the observation rung; if not, return to Step 1.
2. **Inference check** — assert Step 2's rung-climb produced at least one alternative interpretation; single-interpretation feedback fails the check and must be re-thought.
3. **Channel + request fit** — verify the channel matches the type from Step 0 (corrective ≠ public) and the request from Step 4 is observable and time-boxed.

All three must pass. If any fails, return to the failing step. This is the canonical pre-delivery inspect step.

### Step 6: Emit the feedback exchange or cadence design

For a single conversation, the artifact is the SBI script + listening prompts + request + follow-up checkpoint. For a team-wide cadence design, the artifact is the feedback channel map (1:1 weekly, 30/60/90 named, mid-cycle thematic, end-of-cycle synthesis) with explicit no-surprise guarantees.

## Related Skills

**WHEN to use this**

- Specific upcoming feedback conversation (growth, corrective, acknowledgement).
- Team-wide feedback cadence design / audit.
- A growth-vs-corrective confusion needing separation.
- Mid-cycle re-anchoring conversations.

**WHEN NOT to use this**

- Compensation decisions — route to [`comp-banding`](../comp-banding/SKILL.md) (Q2); feedback informs, doesn't decide.
- Hiring / calibration loops — route to [`hiring-loop-design`](../hiring-loop-design/SKILL.md) (S2).
- Engineering-team 1:1 cadence specialization — route to [`one-on-one-cadence`](../one-on-one-cadence/SKILL.md) (S1); S1 specializes Q4 for engineering teams.
- Org structure conversations — route to [`org-design`](../org-design/SKILL.md) (Q1).

## When the agent should load this

- "How do I give this feedback?"
- "Perf review shape."
- "Growth vs corrective — which is this?"
- "Design our feedback cadence."
- "Wie gebe ich dieses Feedback?"

## Output

1. **`conversation-type.md`** — diagnosed growth / corrective / acknowledgement classification with evidence.
2. **`sbi-script.md`** — situation + behavior + impact sentences passing the observation-rung + zero-adjective bar.
3. **`ladder-check.md`** — current rung named, alternative interpretation surfaced, climb-down verified.
4. **`delivery-plan.md`** — channel + timing + meeting sequence + listening prompts + observable time-boxed request.
5. **`cadence-map.md`** *(team-wide variant)* — feedback channels × frequency × no-surprise guarantee × milestone alignment.

## Gotcha

- Adjectives in behavior sentences ("disrespectful", "unfocused", "strong") are the #1 feedback failure mode. Force action / words.
- End-of-cycle surprise = malpractice. If the receiver is hearing it for the first time at review, the feedback system is broken, not the receiver.
- Growth and corrective in the same conversation confuse signal. Separate.
- A feedback exchange without a listening turn is a verdict, not feedback.
- Praise in private is fine; correction in public is damage. Default to private; flip only with explicit reason.

## Do NOT

- Do NOT deliver feedback that hasn't passed the rung-climb check; interpretation-as-fact is the canonical trust-damaging move.
- Do NOT mix conversation types in one exchange; the cost compounds.
- Do NOT skip the request-shape step; feedback without an observable request is a wish.

## Runnable example

EM needs to address a senior eng who has been dismissive in planning meetings; previously raised informally, no improvement.

- Step 0 — Type: corrective (gap between observed and expected behavior, not growth-to-next-level). Acknowledgement of strengths happens separately in a different conversation, not bundled.
- Step 1 — SBI: *Situation:* "In the last three planning meetings"; *Behavior:* "you interrupted junior engineers an average of 2x per meeting before they finished their estimate, and dismissed two estimates as 'not realistic' without follow-up question"; *Impact:* "two of those engineers reported in 1:1 they no longer push back on your scoping, and the team's estimates have skewed 15% lower since".
- Step 2 — Ladder check: behavior is on the data rung (counted interruptions); alternative interpretation surfaced — could be the senior eng is anxious about ship date and not aware of the pattern; climb-down verified.
- Step 3 — Channel: 1:1 private. Timing: within 48h of next planning meeting, not end-of-cycle. Sequence: check-in → named topic → SBI → listening turn → request → follow-up commitment.
- Step 4 — Listening prompt: "What's your read on what's been happening in planning?" Request: "For the next three planning meetings, hold your estimate input until each engineer has spoken first; we'll review the pattern in our 1:1 in three weeks."
- Step 5 — Validate: SBI is adjective-free; alternative interpretation surfaced; channel + request appropriate. Pass.
- Step 6 — Emit feedback script + 3-week follow-up checkpoint scheduled.
