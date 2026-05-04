---
type: "auto"
tier: "2a"
description: "When suggesting reviewers for a change — anchor the choice in paths and risk, never prestige or seniority; require primary + secondary role for medium/high risk"
source: package
---

# Reviewer Awareness

When a change is medium- or high-risk, the agent suggests reviewer **roles**
(not individuals) based on what the diff actually touches — not who is
loudest, most senior, or who "usually reviews this kind of thing".

## When this rule applies

- The agent is asked to suggest reviewers, draft a PR description, or
  consolidate a review plan.
- The change is classified medium or high risk by
  [`review-routing`](../skills/review-routing/SKILL.md), the
  `pr_risk_review.py` script, or explicit user judgment.
- For **low-risk** changes, reviewer suggestions are optional and may be
  omitted.

## Required behavior

1. **Anchor every suggestion in the diff.** Name the path or change that
   triggered the role — "backend because `app/Services/PaymentGateway.php`
   changed", not "backend because it's a code change".
2. **Two roles minimum for medium/high risk** — one **primary** (the
   domain most at risk) and one **secondary** (cross-cutting sanity:
   security, infra, domain owner).
3. **Explain the focus area** for each reviewer — what they should look
   at, not just that they should look. "security: confirm the new
   authorization boundary actually denies cross-tenant reads".
4. **Prefer ownership-mapped owners** when an ownership map exists
   (see [`review-routing-awareness`](review-routing-awareness.md)). Fall
   back to generic roles only when no mapping matches.
5. **Never name individual reviewers** in package-shipped artifacts.
   The consumer repo's CODEOWNERS or ownership map does the mapping
   role → person.

## Reviewer roles

The reference set — extend per project, but keep these as the common
vocabulary:

| Role | Typical focus |
|---|---|
| `backend` | business logic, validation, side effects, data integrity |
| `frontend` | UX, accessibility, client-side state, rendering |
| `security` | authz, secrets, trust boundaries, data exposure |
| `infra` / `ops` | rollout, migration safety, observability, retries |
| `database` | schema changes, indexes, query plans, rollback realism |
| `domain owner` | business invariants, policy intent, edge-case correctness |
| `qa` | test coverage, regression scenarios, flake risk |

## Anti-patterns — reject them

- "Reviewers: @alice, @bob" inside a shared package artifact — individuals
  live in the consumer's CODEOWNERS, not in package output.
- "Any senior engineer" — prestige is not a review strategy.
- "Whoever reviewed this last time" — selection by habit, not by
  current risk.
- One role for a 🔴 high-risk change — single-reviewer risk, especially
  when the change crosses an authorization or tenancy boundary.
- Suggesting reviewers without naming what they should look at — a
  rubber-stamp invitation.

## Format

When the agent proposes reviewers, use this block:

```
Suggested reviewers (role-based):
  • primary:   <role> — focus: <one line, anchored in diff>
  • secondary: <role> — focus: <one line, anchored in diff>
  (optional) additional: <role> — focus: …
```

## Rationale

The right reviewer reduces blind spots more than the loudest reviewer.
Blind-spot reduction comes from role diversity (different angles on the
same diff), not from seniority.

## See also

- [`review-routing-awareness`](review-routing-awareness.md) — how
  ownership maps and historical patterns feed reviewer selection.
- [`review-routing`](../skills/review-routing/SKILL.md) — the skill that
  produces the reviewer block.
- [`requesting-code-review`](../skills/requesting-code-review/SKILL.md) —
  PR preparation and self-review before asking for reviewers.
