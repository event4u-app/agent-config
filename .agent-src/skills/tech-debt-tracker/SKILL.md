---
recommended_model: inherit
name: tech-debt-tracker
description: "Use when surfacing tech debt as trackable items — interest-vs-principal framing, prioritisation by carrying cost, repayment plan — even if the user just says 'this codebase is a mess'."
personas:
  - senior-engineer
  - product-owner
  - critical-challenger
domain: process
recommended_for_user_types: [developer, founder]
workspaces:
  - engineering
packs:
  - engineering-base
---

# tech-debt-tracker

> Turn vague "this is messy" complaints into a **ranked debt ledger**
> with carrying-cost estimates and a repayment plan the team can
> execute. Frames debt as **principal** (the gap) plus **interest**
> (what we keep paying because the gap exists). Output is copy-paste
> ready; ticket / backlog write-back is user-gated.

## When to use

- The user lists code smells, dead code, or "we should refactor X"
  and wants them turned into trackable items.
- A retro surfaced multiple debt complaints; the team needs them
  ranked, not all addressed at once.
- A new initiative is about to add features on top of debt; the
  team wants the carrying cost surfaced before committing.
- German triggers: "Tech-Debt-Liste", "wo bremst es uns?",
  "Aufräumen-Plan".

Do NOT use when:

- The user wants a single bug fixed — route to `/bug-fix`.
- The complaint is about process, not code (slow CI, noisy alerts) —
  surface as ops debt, not code debt; consider escalating to PO.
- The "debt" is actually a missing feature — route to `po-discovery`.

## Procedure

### 1. Inspect inputs and collect candidate debt items

Read the input (retro notes, code-review threads, pasted complaints,
agent observations). Analyze each source for one candidate per
bullet, no editing yet.

### 2. Classify each item

| Class | Examples |
|---|---|
| Code debt | Smells, duplication, dead code, weak tests, missing types |
| Architecture debt | Coupling, layer violations, missing seams |
| Operations debt | Manual deploys, alert fatigue, runbook gaps |
| Knowledge debt | Stale docs, single-owner systems, missing onboarding |

Items spanning two classes split into two entries — never merge.

### 3. Estimate principal and interest

For each item:

- **Principal** — rough effort to repay (S / M / L; days, not hours).
- **Interest** — what we keep paying *every week / sprint / month*
  because the debt exists. Quantify or mark `unknown` (unknown
  interest is itself a finding — surface it).

Carrying cost = `interest × time-until-repaid`. High principal +
zero interest → leave it. Low principal + recurring interest →
top of the queue.

### 4. Rank by `interest ÷ principal`

Sort descending. The top ten are the candidates. Items below the
top ten get a single line each (so they are not lost) but no
deeper analysis — debt-list bloat is itself a debt.

### 5. Shape a repayment plan

For the top 3-5 items:

- **Repayment shape** — single PR · multi-PR series · campaign ·
  re-architecture.
- **Owner role** — engineering · ops · PO · platform team.
- **Trigger** — what makes us pay this *next* (e.g. "before adding
  feature X", "when test runtime > 10 min", "next quarterly").

Items without a trigger sit forever. A trigger that is "someday"
is no trigger — push back.

### 6. Issue a verdict

| Verdict | When to issue |
|---|---|
| `track` | Items added to the ledger; no immediate action |
| `pay-now` | One or more items have a trigger that already fired |
| `block` | New feature work blocked until top item is repaid (rare) |

### 7. Validate the ledger

Verify before emitting: every top item has a class, principal,
interest (or `unknown`), trigger, and owner; the ranking matches
`interest ÷ principal`; tail items have one line each. Ensure no
"someday" triggers and no agent-owned repayment owners slipped in.

## Output format

The ledger is a single block with these ordered fields:

1. `Inventory:` — count and classes touched
2. `Top items:` — numbered list ranked by `interest ÷ principal`,
   each with class, principal, interest, trigger, owner, shape
3. `Tail:` — one-line bullets for tracked-but-deferred items
4. `Verdict:` — exactly one of `track` / `pay-now` / `block`
5. `Next:` — handoff target (`/adr-create` or backlog write-back)

```
Tech-Debt Ledger
Inventory: <count> items, <classes touched>

Top items (interest ÷ principal):
  1. [arch] <item>             Principal: M  Interest: high (3 hrs/sprint)
        Trigger: <condition>  Owner: <role>  Shape: <PR / series / campaign>
  2. [code] <item>             Principal: S  Interest: med  ...
  ...

Tail (tracked, no immediate action):
  - <item>
  - <item>

Verdict: track | pay-now | block
Next:    /adr-create (if a tradeoff lock is needed) | backlog write-back
```

## Gotcha

- "Refactor X" is not a debt item — it is a wish. The item must
  name *the gap* and *what it costs*.
- Interest the team cannot measure is real but invisible. Mark
  `unknown` and ask a probe ("how often do you hit this?") rather
  than inventing a number.
- A debt list with no trigger is paperwork. Reject items the team
  has no plan to ever repay.

## Do NOT

- Do NOT enumerate every smell in the codebase — the top ten plus
  a tail is the contract.
- Do NOT propose repayment owners the agent itself owns; debt
  repayment belongs to a human role.
- Do NOT push items into Jira / Linear without explicit ask;
  output is copy-paste ready, write-back is gated.
- Do NOT silently inflate principal estimates to discourage repayment
  the team should do.
