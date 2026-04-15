---
name: adversarial-review
description: "ONLY when user explicitly requests: adversarial review, devil's advocate analysis, or critical challenge of a plan. NOT for regular code review."
source: package
---

# Adversarial Review

## When to use

Use this skill when:
- You've completed a plan, design, or proposed fix and are about to present it.
- The change is non-trivial (affects multiple files, changes behavior, touches critical paths).
- You're about to recommend an architecture or design decision.

Do NOT use when:
- The task is trivial (renaming, formatting, simple config change).
- The user explicitly asked for a quick/rough draft.
- You're exploring options, not committing to one yet.

## Procedure: Adversarial review

### Step 1: Attack (Grumpy Senior Engineer)

Assume your plan/fix is flawed. Ask yourself:

- What's the weakest assumption?
- Where will this break under load, at scale, or with edge cases?
- What did I ignore or hand-wave?
- Is this over-engineered for the actual problem?
- Would a simpler approach work just as well?
- What will the next developer curse me for?

### Step 2: Defend (Balanced Engineer)

Counter the criticism fairly:

- Which criticisms are valid and must be addressed now?
- Which are theoretical and can be deferred?
- What's the pragmatic middle ground?

### Step 3: Revise

- Fix the valid issues in your plan/fix.
- Move deferred concerns to "Open Questions" or "Known Limitations".
- Present the improved version to the user.

**Do this internally** — the user sees the improved result, not the raw debate.
Only surface trade-offs or concerns that need the user's input.

## Context-specific attack questions

### Feature plans / Architecture

- Is this the simplest solution that works?
- What happens when requirements change (and they will)?
- Are there hidden dependencies or coupling?
- Does this respect existing patterns or introduce a new one unnecessarily?
- What's the migration/rollback story?

### Bug fixes

- Is this the root cause or just a symptom?
- Will this fix break something else?
- Does the fix handle the edge case that caused the bug?
- Is there a regression test that proves the fix works?
- Are there other places with the same bug pattern?

### Code changes / Refactoring

- Would I understand this code in 6 months without context?
- Did I check all callers and downstream effects?
- Are the tests actually testing the right behavior?
- Did I introduce a new pattern where an existing one would work?

### Database migrations

- Can this destroy or corrupt data?
- Is rollback possible?
- What happens to running queries during migration?
- Did I check the table size (large table ALTER can lock)?

### API design

- Is this a breaking change?
- Is it consistent with existing endpoints?
- Are error responses clear and actionable?
- Did I consider pagination, filtering, versioning?

### Security-sensitive changes

- Where is the attack surface I'm not seeing?
- Am I trusting user input anywhere?
- Are there authorization gaps?
- Would this pass a security review?

## Integration with other skills

- **feature-planning** — adversarial review after Understanding Lock, before presenting the plan.
- **bug-analyzer** — review the proposed fix before implementing.
- **code-review** — self-review before creating a PR.
- **migration-creator** — review migration for data safety.
- **api-design** — review API design for consistency and breaking changes.
- **security** — review security-sensitive changes for attack surface.

## Auto-trigger keywords

- adversarial review
- self-review
- challenge plan
- review my approach
- sanity check

## Gotcha

- Don't use this on trivial changes — it adds overhead without value on simple renames or config tweaks.
- The model tends to invent risks that don't exist. Ground every concern in actual code, not hypotheticals.
- Don't challenge the user's explicit requirements — challenge the implementation, not the goal.

## Do NOT

- Do NOT present the raw adversarial debate to the user — only the improved result.
- Do NOT use this as an excuse to delay work — the review should take seconds, not minutes.
- Do NOT apply this to trivial changes — it adds overhead without value.
- Do NOT let the "grumpy engineer" kill good ideas — the balanced engineer must counter.
- Do NOT skip Step 3 (Revise) — attacking without improving is just complaining.
