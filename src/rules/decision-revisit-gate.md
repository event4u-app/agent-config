---
type: "auto"
source: "package"
tier: "2b"
description: "A beneficial change blocked by a past lock (honest-null, don't-relitigate memory, budget canon, ADR) must be surfaced with a council re-evaluation offer, never silently dropped"
alwaysApply: false
council_depth: deep
triggers:
  - intent: "blocked by prior decision"
  - intent: "revisit past verdict"
  - keyword: "don't relitigate"
  - keyword: "honest null"
  - keyword: "already decided"
  - keyword: "locked decision"
  - keyword: "budget blocks"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# Decision Revisit Gate

## The Iron Law

```
A LOCK IS A DECISION UNDER PAST CONDITIONS, NOT A PERMANENT LAW.
BENEFIT BLOCKED BY A LOCK → SURFACE + OFFER RE-EVALUATION.
NEVER SILENT COMPLIANCE. NEVER SILENT DROP OF A GOOD CHANGE.
```

An agent that finds a genuinely beneficial change blocked by a recorded
past decision — an honest-null eval verdict, a "don't relitigate"
memory or context note, a token-frugality/budget canon line, or an ADR —
does not quietly comply and drop the change. It surfaces the conflict
and offers the user a path to re-evaluate the lock. Progress means
adaptation: locks encode what was true when they were written, not a
ceiling on what the package may ever become.

## What counts as a "lock"

- An eval verdict recorded as an honest null (a mechanism was tested,
  showed no lift, and the disposition says "don't rebuild without new
  evidence").
- A memory entry or `agents/settings/contexts/` note tagged "don't
  relitigate" / "settled" / a locked council convergence.
- A budget or frugality-canon line (`token-budget-discipline`,
  `telegraph-speak`, thin-projector trimming) that rejects a change on
  cost grounds alone.
- An ADR whose decision is being cited as a blocker for the current change.

## What to do when it fires

1. **Mechanism-match check — do this FIRST.** A verdict settles the
   *mechanism it tested*, not every future proposal that resembles it.
   Before applying the lock, verify the blocked change is actually the
   same mechanism — not merely a similar-sounding one. A null on
   hardened blocking enforcement does not automatically cover
   discretionary contextual nudges; a null on one architecture does not
   cover a materially different one. If the mechanism differs, the lock
   does not apply — proceed, noting the distinction.
2. **If the mechanism genuinely matches**, do not silently comply.
   Surface, in one short block:
   - What change is blocked.
   - Which lock blocks it (cite the memory/context/ADR).
   - Under what conditions the lock was recorded (date, evidence, or
     "maintainer decision" if settled-by-decision rather than
     settled-by-evidence).
   - What has changed since (new evidence, new model generation, new
     tooling, repeated encounters) that makes revisiting worth the cost.
3. **Offer numbered options** (per [`user-interaction`](user-interaction.md)),
   always including: re-evaluate the lock in the AI council. Other
   options: keep the lock as-is, or proceed without the blocked change.
4. **On re-evaluation:** route to [`decision-review`](../skills/decision-review/SKILL.md)
   for the backward-audit procedure and to [`ai-council`](../skills/ai-council/SKILL.md)
   for the debate mechanics. This rule owns the obligation to surface;
   those skills own the procedure.
5. **Record the outcome** with scope + `revisit-if` per
   [`ai-council`](../skills/ai-council/SKILL.md)'s convergence-summary
   contract — every re-evaluated lock gets a fresh, correctly-scoped
   disposition, not a re-statement of the old one.

## When NOT to fire

- The blocked change has no real benefit — this rule is not a lever to
  reopen every settled question; [`no-cheap-questions`](no-cheap-questions.md)
  still governs whether the resulting numbered-options block is a real
  question or noise. A revisit-offer with a genuine trade-off is never
  a "cheap question" under that rule — but a revisit-offer with no
  actual case for change is.
- The mechanism-match check (step 1) shows the lock is the same
  mechanism and no new evidence exists — apply the lock, no surfacing
  needed; this is the lock working as intended.
- The user already declined a revisit on this exact lock this
  conversation — per [`scope-control § Decline = silence`](scope-control.md),
  do not re-ask.

## Failure modes

- Treating a "don't relitigate" memory as permanently closed instead of
  as settled-under-conditions-X.
- Applying a null verdict to a superficially similar but architecturally
  different mechanism without running the mechanism-match check.
- Letting the token-frugality canon auto-reject a net-positive change
  without surfacing the trade-off — see [`token-budget-discipline`](token-budget-discipline.md)'s
  value-over-budget clause.
- Silently dropping a good idea because "we already decided this" —
  the canonical failure this rule exists to stop.

## See also

- [`decision-review`](../skills/decision-review/SKILL.md) — the backward-audit
  procedure this rule routes to when a lock is genuinely re-evaluated.
- [`ai-council`](../skills/ai-council/SKILL.md) — the re-evaluation mechanism;
  owns the convergence-summary scope + `revisit-if` contract.
- [`decision-record`](../skills/decision-record/SKILL.md) — forward-flow decision
  locking; the escalation litmus there names the reopening condition up front.
- [`token-budget-discipline`](token-budget-discipline.md) — the frugality-canon
  value-over-budget escalation this rule's budget-lock case defers to.
- [`no-cheap-questions`](no-cheap-questions.md) — the question-quality floor a
  revisit-offer must still clear.
- [`ask-when-uncertain`](ask-when-uncertain.md) — the numbered-options shape
  used to present the revisit offer.
