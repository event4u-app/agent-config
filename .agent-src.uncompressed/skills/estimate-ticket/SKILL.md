---
name: "estimate-ticket"
description: "Estimate a Jira/Linear ticket — 'estimate PROJ-123', 'wie groß ist das?', 'should we split this?' — size + risk + split + uncertainty, sibling of /refine-ticket, close-prompt."
personas:
  - developer
  - senior-engineer
  - product-owner
  - stakeholder
  - critical-challenger
  - ai-agent
source: package
execution:
  type: assisted
  handler: internal
  allowed_tools: []
---

# Estimate Ticket

> Sibling of `/refine-ticket`. Takes the same input, returns **size**,
> **risk**, **split recommendation**, and **uncertainty** — nothing
> else. Separate from refinement so each stays sharp. Output is
> copyable; write-back is user-gated.

## When to use

- Sprint planning: "how big is PROJ-123?"
- Scope sanity: "should we split this?"
- Confidence check: "do we actually understand this ticket?"
- German: "wie groß ist das Ticket?", "sollen wir das splitten?",
  "ist das ein Spike-Kandidat?"

## When NOT to use (near-misses)

| Phrasing | Route to |
|---|---|
| "refine the ticket" / "tighten AC" | `/refine-ticket` (sibling) |
| "plan this feature" | `/feature-plan` (downstream) |
| "is this a duplicate?" | `validate-feature-fit` (sub-skill) |
| "threat-model this" | `threat-modeling` (sub-skill) |
| "investigate this bug" | `/bug-investigate` |

`/estimate-ticket` does **not** rewrite the ticket. If the ticket is
too vague to estimate, output says so and routes to `/refine-ticket`.

## Inputs

Same four paths as `/refine-ticket` (delegates to `jira-ticket` loader):
ticket key, branch-name detection, pasted text, URL.

## Procedure

### 1. Load ticket

Delegate to `jira-ticket` §1-3 (key / URL / branch → Jira API fetch,
summary + description + AC + comments). For pasted text: parse markdown.

### 2. Inspect estimability

Before producing numbers, check:

- Is the outcome observable (AC bullets concrete)?
- Is the scope one behavior, or bundled?
- Are external dependencies (APIs, teams, migrations) named?
- Is there a rollback plan implied?

If the ticket scores low on estimability (vague AC, no out-of-scope,
no mention of dependencies), set `uncertainty = Underspecified` and
emit a single-line redirect to `/refine-ticket` at the top of the output.

### 3. Apply sizing heuristics

Score across four axes; each axis contributes to the final size:

| Axis | Signals |
|---|---|
| **Surface area** | # of files / modules / layers touched |
| **Unknowns** | # of "figure out", "investigate", "tbd" phrases |
| **Coordination** | external teams, cross-service calls, migrations |
| **Testing cost** | integration tests needed, manual verification steps |

Map the combined score to `S` / `M` / `L` / `XL`:

- **S** — single file / single layer / fully understood / unit tests suffice
- **M** — 2-4 files / one service boundary / one unknown / some integration tests
- **L** — multiple modules / cross-layer / 2+ unknowns / migrations or data changes
- **XL** — multi-service / 3+ unknowns / coordination with another team — always recommend split

### 4. Apply personas

Same Core-6 as refine-ticket. Each voice produces one sentence focused
on **their sizing concern**, not general feedback:

- **Developer** — "implementation size feels X because Y"
- **Senior Engineer** — "blast radius is X; hidden cost is Z"
- **Product Owner** — "value is X; can we deliver value incrementally?"
- **Stakeholder** — "timeline fit: X; drop-dead date risk: Y"
- **Critical Challenger** — "this estimate is wrong because Z"
- **AI Agent** — "automatable parts: X; manual parts: Y"

`--personas=+qa` adds QA: "test surface is X; regression risk is Y".

### 5. Synthesize + close-prompt

Produce the four-section output (template below). After rendering,
emit the close-prompt.

## Output template

````markdown
## Estimate

- **Size:** S / M / L / XL
- **Risk:** Low / Medium / High
- **Split:** No / Yes → <split points>
- **Uncertainty:** High-confidence / Needs-spike / Underspecified

## Sizing rationale

<2-4 bullets citing the four axes — surface area, unknowns,
coordination, testing cost — each with evidence from the ticket>

## Split points (only if Split: Yes)

1. <first slice — deliverable on its own>
2. <second slice — deliverable on its own>
3. …

## Persona voices (sizing-focused)

- **Developer** — <one sentence>
- **Senior Engineer** — <one sentence>
- **Product Owner** — <one sentence>
- **Stakeholder** — <one sentence>
- **Critical Challenger** — <one sentence>
- **AI Agent** — <one sentence>
- **[qa]** — *(only when `--personas=+qa`)* <one sentence>
````

Wrap the **Estimate** section in a copyable markdown block so it can
be pasted into Jira / sprint tooling verbatim.

## Close-prompt (mandatory final step)

```
> Next action for this estimate:
>
> 1. Comment on Jira — I'll post the estimate as a comment
> 2. Set story points — I'll set the Story Points field (if your size maps: S=2, M=3, L=5, XL=8)
> 3. Nothing — I'll handle it myself / take it to planning
```

Options 1 and 2 require `jira-ticket` write permissions; degrade to
copy-paste instructions if missing.

## Output format

1. **Estimate** block with four fields (size, risk, split, uncertainty), wrapped in a copyable markdown block.
2. **Sizing rationale** — 2-4 bullets, each citing one of the four axes with evidence from the ticket.
3. **Split points** section — only when `Split: Yes`; numbered list of independently-deliverable slices.
4. **Persona voices** — one sentence per persona from the active set, **sizing-focused** (not general feedback).
5. **Close-prompt** — exactly three numbered options (comment / set points / nothing); no fourth option in v1.

## Gotcha

- Estimators default to optimism. Every size must cite evidence for at least one of the four axes — not "feels like M".
- `Underspecified` is not a safe default. Use it only when estimability actually fails; otherwise pick a size and state the risk.
- `Split: Yes` without concrete split points is useless. Name the slices or drop the recommendation.
- Persona voices drift into general feedback. Each sentence must be about **sizing** — developer talks implementation size, stakeholder talks timeline fit, etc.
- Story-point mapping (`S=2 / M=3 / L=5 / XL=8`) is the default; projects may override — do NOT hardcode their scale into this skill.

## Do NOT

- Do NOT rewrite the ticket — that's `/refine-ticket`. If the ticket needs rewriting, emit the redirect line and stop.
- Do NOT write to Jira in v1 — copy-paste + close-prompt, same contract as `/refine-ticket`.
- Do NOT chain into `/feature-plan` automatically — separate invocations by design.
- Do NOT produce sizes without rationale — the bullets are mandatory, not optional.
- Do NOT invent split points that share state with each other — every slice must be independently deliverable.

## See also

- [`refine-ticket`](../refine-ticket/SKILL.md) — sibling; refine first if the ticket is vague
- [`jira-ticket`](../../commands/jira-ticket.md) — ticket loader
- [`feature-plan`](../../commands/feature-plan.md) — downstream planning
- [`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md) — drafting protocol
