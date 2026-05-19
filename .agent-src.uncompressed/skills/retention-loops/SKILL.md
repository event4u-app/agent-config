---
name: retention-loops
description: "Use when designing product-led retention — habit formation, trigger-action-reward, network vs single-user loops. Triggers on 'why don't users come back', 'design a habit loop'."
status: active
tier: senior
source: package
domain: product
context_spine: [product, customer-segment, funnel-stage]
workspaces:
  - product
packs:
  - product-basic
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: true
  removable: true
---

# retention-loops

## When to use

- D30 retention is flat or declining and the team cannot name a single product loop that pulls the user back — retention is treated as marketing's problem, not the product's.
- A new feature shipped but did not move retention — there is no closed loop between trigger, action, and reward, so the feature is a destination, not a habit.
- The product depends on a network effect that has not been instrumented as a loop — invites, content, or data are produced but the loop that pulls the next user back is unwritten.

Do NOT use to fix days 0–30 onboarding friction (route to
`onboarding-design`), classify churn causes (route to
`churn-prevention`), or design human-led account-expansion plays
(route to `expansion-playbook`).

## Cognition cluster

- **Mental model 14 — Meadows leverage points.** A retention loop
  is a feedback structure: the leverage sits in the loop's
  *gain* (how strong the reward is) and *delay* (how long until
  the reward lands), not in the surface UI. Pick the leverage
  point — gain or delay — over surface polish. See
  [`docs/contracts/mental-models.md`](../../../docs/contracts/mental-models.md) § 14.
- **Mental model 8 — Compounding.** A loop with even small gain
  per cycle compounds across cohorts; a one-time activation
  bump does not. Verify which loops compound before investing
  cycles into them. See `mental-models.md` § 8.
- **Mental model 18 — Pull vs. push.** A trigger the user pulls
  (intrinsic need surfaced by the product) compounds; a trigger
  the vendor pushes (marketing notification firing) decays the
  channel and trains the user to mute. See `mental-models.md` § 18.
- **Context-spine — product + customer-segment + funnel-stage.**
  Read the **product** slot for which capability can carry a loop
  (a loop is only as strong as the action it routes through), the
  **customer-segment** slot for which segments have the latent
  need the loop addresses, and the **funnel-stage** slot for where
  the loop sits relative to activation and paid. See
  [`context-spine`](../../../docs/contracts/context-spine.md).

## Procedure

### Step 0: Inspect — name the current loops, if any

Inspect the product. For each suspected loop, write the closed
form: *"\<trigger\> → \<action\> → \<reward\> → \<trigger again\>."*
If the loop cannot be written closed, it is not a loop; it is a
funnel ending. Inspect whether the reward arrives quickly enough
to reinforce the action — verify the delay against the segment's
attention cycle.

### Step 1: Classify each loop as single-user vs network

1. **Single-user loop** — trigger and reward both originate from
   the same user (a daily-summary email triggered by yesterday's
   activity).
2. **Network loop** — trigger or reward involves another user
   (a teammate's comment, a partner's reply, a customer's reaction).

Network loops compound harder but require minimum-viable-network
density; below density they look broken. Classify before investing.

### Step 2: Audit the gain and the delay per loop

For each loop:

1. **Gain per cycle** — what observable utility does the user
   receive (information, social affirmation, time saved, reduced
   error)? Gain measured as the user's revealed willingness to
   repeat the action.
2. **Delay** — time from trigger to reward. A delay longer than the
   segment's attention window kills the loop regardless of gain.
3. **Decay** — does the loop weaken when the user already has the
   reward? Most product loops decay; design the next loop before
   the first decays.

### Step 3: Pick the binding loop and isolate it

Of the loops named, pick the one whose gain × frequency × eligible
segment-size is largest. **Verify** the loop is intrinsic-pull, not
vendor-push: confirm the trigger originates from a user action or
state, not from a marketing schedule. A push-trigger labelled as a
loop will burn the channel.

### Step 4: Design the missing step, not the missing UI

If the binding loop is broken, the broken step is almost always:
*trigger missing*, *action too far from trigger*, *reward delayed*,
or *no path back to next trigger*. Design the missing **step**, not
a UI tweak. UI tweaks polish a loop that already closes; they do
not close an open one.

### Step 5: Hand back

Hand the loop inventory, the binding-loop selection with gain /
delay / decay, and the step-level redesign to the implementing
team and to
[`activation-design`](../activation-design/SKILL.md) — activation
is the loop's first cycle, and the activation event must complete
the first cycle of the binding loop. Retention work without a named
loop is rearranging notifications.

## Related Skills

**WHEN to use this**

- Designing or auditing product-led retention loops.
- Selecting the binding loop and redesigning its missing step.

**WHEN NOT to use this**

- Days 0–30 onboarding milestones — route to
  [`onboarding-design`](../onboarding-design/SKILL.md).
- Cause-classification of churn events — route to
  [`churn-prevention`](../churn-prevention/SKILL.md).
- Human-led expansion plays — route to
  [`expansion-playbook`](../expansion-playbook/SKILL.md).
- Activation-event selection (first cycle of the binding loop) —
  route to [`activation-design`](../activation-design/SKILL.md).

## When the agent should load this

- "Why don't users come back?"
- "Design a habit loop for feature X."
- "Is this loop single-user or network?"
- "Welcher Loop tr\u00e4gt eigentlich unsere Retention?"

## Output

1. **`loop-inventory.md`** — every named loop in closed form: trigger → action → reward → next trigger, with single-user vs network tag.
2. **`gain-delay-audit.md`** — per-loop gain · delay · decay · eligible-segment size · revealed repeat-rate.
3. **`binding-loop-redesign.md`** — selected loop, the broken step, and the redesign in step terms (not UI terms).

## Gotcha

- A loop whose reward arrives outside the segment's attention window will look broken even when gain is high; delay kills loops more often than gain does.
- A network loop below minimum-viable density behaves like an open funnel; instrumenting it and designing it before density is theatre.
- *"Notifications fire daily"* is not a loop; it is a push schedule. A loop needs a closed return path from reward to next trigger that the user — not the vendor — closes.

## Do NOT

- Do NOT invest in surface UI on a loop that does not close; the loop closes by adding a step, not polishing one.
- Do NOT instrument network loops as single-user loops; the metric will look broken until the network reaches density.
- Do NOT design more than one binding loop at a time; concurrent loop changes destroy the signal.

## Runnable example

Mid-market collaboration tool, D30 retention 41 %, two suspected loops named.

- Loop inventory — *(L1)* user receives daily summary → opens product → reviews changes → leaves a comment → teammate notified (network). *(L2)* user creates a doc → bookmark surfaces in nav → user reopens (single-user).
- Gain–delay audit — L1 gain medium, delay 24 h (within attention window), decay low (network refreshes); L2 gain low, delay 0, decay high (bookmark stale within a week).
- Binding loop — L1 selected (gain × frequency × segment-size dominates). Broken step: *"teammate notified"* fires but does not route teammate back to the originating doc — the loop opens.
- Redesign — add teammate-return path: notification deep-links into the doc at the commented passage; **verify** with cohort A/B at 4-week horizon. Predicted: D30 +6 pp ± 3 pp.
- Hand-off — loop inventory + redesign → eng team; activation event redefinition (one comment + one teammate notified) handed to `activation-design`.
