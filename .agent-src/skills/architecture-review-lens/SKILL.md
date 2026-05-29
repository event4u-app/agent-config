---
name: architecture-review-lens
description: "Use when a diff may break system boundaries, dependency direction, or cross-service contracts — fifth judge dispatched by /review-changes alongside the four standard judges."
personas:
  - backend-architect
  - senior-engineer
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# architecture-review-lens

> Fifth judge in the `/review-changes` family. Reviews a diff for
> **architectural fit**, not correctness, security, tests, or style.
> Catches what the other four miss: layer violations, wrong
> dependency direction, leaking abstractions, and broken cross-service
> contracts. Sibling of [`judge-bug-hunter`](../judge-bug-hunter/SKILL.md)
> et al. — never overlaps.

## When to use

- `/review-changes` dispatches its "architecture" slice to this skill.
- A reviewer asks "does this belong here?", "should this be in
  the domain layer?", or "is this leaking storage details?".
- A diff adds a cross-service call, event, or contract.

Do NOT use when:

- The diff is documentation-only or a formatting-only change.
- The concern is correctness — route to
  [`judge-bug-hunter`](../judge-bug-hunter/SKILL.md).
- The concern is security — route to
  [`judge-security-auditor`](../judge-security-auditor/SKILL.md).
- The concern is naming or DRY — route to
  [`judge-code-quality`](../judge-code-quality/SKILL.md).
- The concern is *whether to make* the architectural change — route
  to [`decision-record`](../decision-record/SKILL.md) first.

## Procedure

### 1. Anchor on the system shape

Read the codebase's stated architecture (ADRs, AGENTS.md, module
docs). If no shape is documented, infer it from folder structure
and surface the gap. You are judging the diff against **the stated
shape**, not a fantasy ideal.

### 2. Inspect each changed file for fit

For every changed file, answer:

| Question | Smell when "no" |
|---|---|
| Does this file live in the right layer? | Layer violation |
| Are imports flowing in the allowed direction? | Inverted dependency |
| Does this leak a storage / framework detail? | Leaky abstraction |
| Is the public API of the module still the same? | Contract drift |
| Does a cross-service call respect its contract? | Contract break |

Each smell is a finding with a file:line citation.

### 3. Check the seams

Pay special attention to:

- New public methods on existing classes.
- New imports that cross module boundaries.
- New events, queue messages, or HTTP calls.
- Removed deprecation warnings or feature flags.

Cross-module / cross-service additions are the highest-leverage
findings — surface them even at low individual severity.

### 4. Issue a verdict per the judge contract

| Verdict | When |
|---|---|
| `apply` | No architectural concerns; diff fits the stated shape |
| `revise` | Findings exist; diff lands after the listed fixes |
| `reject` | Architectural shape itself must be reconsidered (rare) |

`reject` requires citing which ADR or stated shape would need to
change — never reject for taste.

### 5. Validate the verdict

Verify before emitting: every finding has a `file:line` citation and
a smell label from the taxonomy; the verdict matches the worst
finding (`revise` if any finding exists, `apply` only when none);
`reject` cites the ADR or stated shape that would need to change.
Ensure no finding restates a concern owned by another judge.

## Output format

The verdict block carries these ordered fields:

1. `Judge:` — fixed value `architecture-review-lens`
2. `Model:` and `Target:` — model id from `.agent-settings.yml` and diff range
3. `Verdict:` — exactly one of `apply` / `revise` / `reject`
4. `Issues:` — numbered list, each with `file:line`, smell label, suggested fix

```
Judge:  architecture-review-lens
Model:  <model id from .agent-settings.yml>
Target: <branch / diff range>

Verdict: apply | revise | reject

Issues:
1. 🔴 <finding>           file:line
   Smell: layer-violation | inverted-dep | leak | contract-drift | contract-break
   Suggested fix: <one sentence>
2. 🟡 ...
3. 🟢 ...
```

## Gotcha

- The stated shape may be wrong. If the diff has a sound reason to
  break it, do NOT raise a finding — recommend an ADR via
  `decision-record` and approve the diff.
- "Could be split into more files" is style, not architecture; route
  to `judge-code-quality`.
- A finding with no file:line citation is a vibe; reject your own
  finding before issuing it.

## Do NOT

- Do NOT review correctness, security, tests, or style — those are
  other judges.
- Do NOT issue `reject` without naming the ADR or stated shape that
  would need to change.
- Do NOT raise findings against the *current* architecture if the
  diff did not introduce them; this is a diff-judge, not a
  codebase-audit.
- Do NOT merge findings with another judge's output — the user needs
  to see which lens raised each one.
