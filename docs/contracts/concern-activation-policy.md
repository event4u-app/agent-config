---
stability: beta
keep-beta-until: 2026-11-13
---

# Concern activation policy

**Purpose.** Decide when a hook concern may *block*, and on what evidence. Three
roadmaps cited "the concern activation policy (program X3)" as the artefact
governing that decision; a repository-wide search for the phrase returned four
hits and every one was roadmap prose or a review input. This file is that
artefact. It exists because a plan deferring a decision to a document nobody
wrote has not deferred the decision — it has hidden it.

**Scope.** Concerns bound through `src/scripts/hook_manifest.yaml`. It governs
the *activation posture* — shadow, advisory, blocking — and the evidence each
step needs. It does **not** govern what a concern measures or how it is
implemented.

## The three postures

| Posture | Emits to the model | Blocks | What it buys |
|---|---|---|---|
| **shadow** | nothing | never | measurement, at the cost of hook latency only |
| **advisory** | one line of context | never | a reminder — see the null below |
| **blocking** | a refusal + reason | yes | enforcement |

## The ladder, and why it does not start at advisory

```
A NEW CONCERN THAT WOULD BLOCK STARTS IN SHADOW, NEVER IN ADVISORY.
ADVISORY IS A DESTINATION, NOT A WAITING ROOM.
A THRESHOLD IS DERIVED FROM SHADOW DATA — NEVER PICKED AND THEN MEASURED.
NOTHING FLIPS TO BLOCKING WITHOUT ALL FOUR FLIP CONDITIONS BELOW.
EVERY BLOCKING CONCERN CARRIES A REVERSE TRIGGER FROM THE DAY IT SHIPS.
```

The obvious ladder is shadow → advisory → blocking, and this policy skips the
middle rung on purpose. Two measurements in this repository point the same way:

- **`session-canary`** — a per-turn context injection, verified to fire, left
  its compliance miss rate unmoved (24 of 29 task starts still dropped the
  obligation). The rule's own text concludes: "a reminder in context is not a
  mechanism for this obligation; at higher frequency it is the same request,
  more often."
- **conformance round 5** — both blocking carriers reached zero violations,
  neither advisory carrier did.

So an advisory rung buys close to nothing while still paying the per-call
latency of a bound concern. Shadow pays the same latency and buys the
distribution the threshold has to come from. Advisory remains legitimate as a
*final* posture where the goal is genuinely to inform rather than to enforce —
it is just not a step on the way to blocking.

## Deriving a threshold

A threshold is computed from shadow data, not chosen and then validated:

- Emit `would_fire` at **several candidate thresholds simultaneously** during
  the shadow window. One candidate produces a yes/no; a spread produces a curve,
  and the curve is what makes a choice defensible.
- Take the value at **the observed legitimate distribution's 99th percentile,
  plus one**. A threshold inside the legitimate distribution is a
  false-positive generator by construction.
- State the sample the number came from, in the same artefact.

## Flip: shadow → blocking

ALL FOUR must hold. Any one missing keeps the concern in shadow.

1. **The failure is real and observed.** The shadow log contains events the
   threshold would have caught — not a proxy, the failure itself.
2. **The false-positive rate is within tolerance.** Default tolerance: **≤ 1 %**
   of legitimate operations denied. Measured over the shadow window, not
   estimated.
3. **The economics favour it.** Cost avoided (tokens, wall-clock, wasted runs)
   exceeds friction imposed (denied legitimate operations × cost of each). This
   is deliberately economic rather than count-based: "three incidents" is a
   number with no unit, and three cheap incidents do not justify what three
   expensive ones do.
4. **The measurement window is met.** Default floor: **≥ 100 dispatches or
   observations, or ≥ 2 weeks, whichever comes first**, and the window must
   include at least one run of the shape the concern targets. Without a stated
   floor, "wait for the baseline" becomes "wait indefinitely" — which is the
   failure this clause exists to prevent.

## Reverse trigger — mandatory from day one

A blocking concern ships with its own removal condition, or it does not ship:

- **False positives over tolerance** in any 2-week window → raise the threshold
  or return the concern to shadow. Never leave it blocking while known-wrong.
- **No fires in 8 weeks** → evaluate removal. A gate that never fires is not
  proof of safety; it is unmeasured cost, and this repository already carries
  gates whose population turned out to be empty.
- **Review cadence: quarterly**, or on the first reverse-trigger hit, whichever
  is sooner.

## Where a threshold lives

| Location | Cost | Use when |
|---|---|---|
| Hard-coded constant | invisible to the consumer; a change needs a release | shadow candidates only |
| Committed policy artefact + code default | reviewable, carries the derivation and the WHY, changes are visible in a diff | the shipped default, once derived |
| Settings key | per-project override without a release; adds a settings surface and a class decision | after a default exists and a project needs to differ |

Sequence: shadow constants → committed default with its derivation → settings
override once a real project needs one. Shipping a settings key before a default
exists asks the consumer to pick a number this repository has not yet derived.

## Honest enforcement — `enforced_by: none`

No gate reads this file. Whether a concern shipped shadow-first, whether a
threshold was derived or guessed, and whether the four flip conditions were met
are all authoring decisions visible only in review. Saying so is the point: this
policy replaces a cited-but-absent document, and replacing it with a document
that overstates its own force would repeat the defect at one remove.

What *is* mechanical, and adjacent: `lint_hook_manifest` validates the manifest
shape, and the P0.2 severity ceiling in `dispatch_hook` prevents a concern
declared `advisory` from producing a host-level block — a concern cannot exceed
its declared posture by accident, only by declaring a different one.

## See also

- [`hook-architecture-v1.md`](hook-architecture-v1.md) — the dispatcher contract this policy sits on top of.
- `src/rules/session-canary.md` — the measured advisory null this ladder is built around.
- `src/scripts/hooks/spawn_guard_shadow_hook.ts` — the first concern shipped
  under this policy, and the worked example of the shadow rung. Roadmaps cite
  this file rather than the reverse: a roadmap is archived when its work
  completes, so a contract linking to one acquires a dead reference by design
  (`no-roadmap-references`).
