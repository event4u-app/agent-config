---
class: C
type: learned-lesson
trust: low
# Class-C learned lesson (Evidence v2). The LOWEST-trust context type: an
# inference about why something went wrong. Evidence (symptom) is falsifiable
# fact; diagnosis (hypothesis) is a decaying theory, NEVER a durable lesson
# until repeatedly confirmed. Subject-based, project-local by default (never
# person-based in a committed team repo). See project-intelligence.md § Class C.
scope: "project-local"          # project-local | global (global only via the measure-then-decide gate)
subject: "<the module / surface / integration — NOT a person>"
symptom: "<real error text / failing test name / reverted commit SHA — falsifiable>"
hypothesis: "<the causal theory — LOW TRUST, a decaying hypothesis>"
confidence: 0.0
observed_at: "YYYY-MM-DD"
last_confirmed: "YYYY-MM-DD"
decay:
  no_confirmation_for_days: 90    # past this with no `confirmed` event → demote to hypothesis
  counter_evidence_ratio_gt: 0.3  # ≥30% of events are counter_evidence → demote to hypothesis
revalidate_if: "<condition that would invalidate — e.g. the endpoint gains a schema>"
---

<!--
  Template shipped by event4u/agent-config (Evidence v2, Class C).
  Copy to agents/memory/curated/lessons/<slug>.md ONLY via the human promotion
  gate — a Class-C lesson is NEVER auto-committed and NEVER auto-trusted.
  Frontmatter MUST stay at line 1. Delete this HTML comment after filling in.

  RULE: the symptom is fact (cite it); the hypothesis is a theory (mark it).
  The lesson is read for HEURISTICS ONLY and never bypasses a fresh structural
  read (the v1↔v2 isolation contract). Delete this card / let it decay rather
  than let a wrong cause-theory harden into superstition.
-->

# Learned lesson — <subject>

## Symptom (fact — falsifiable, cite it)

<!-- The real, observable failure. Error text / failing test / reverted commit.
     Timestamped. This is the durable, falsifiable half. -->

- **What went wrong:** `<verbatim error / test name / revert SHA>`
- **Where:** `<file:line / surface / task>`
- **Observed at:** YYYY-MM-DD

## Hypothesis (theory — LOW TRUST, decaying)

<!-- The agent's causal theory for WHY. Never treated as durable. Demoted by the
     anti-calcification check on either decay trigger above. -->

- **Diagnosis:** `<why it likely happened — a hypothesis, not a fact>`
- **Confidence:** `<0.0-1.0>`

## Test-tracking history (makes anti-calcification enforceable)

<!-- Log an event ONLY when a situation the lesson claims to govern recurs.
     `confirmed` = the claim held · `not_applicable` = situation changed, lesson
     no longer governs · `counter_evidence` = the claim failed. Absence of
     recurrence is NOT confirmation. -->

| date | event | context |
|---|---|---|
| YYYY-MM-DD | confirmed \| not_applicable \| counter_evidence | `<task / where>` |

## Pointers

- **Evidence:** `<link to the failing test / error log / revert commit>`
- **Revalidate if:** `<condition>`

## See also

- [`project-intelligence`](dist/agent-src/contexts/execution/project-intelligence.md) — Class C safety spec, evidence/diagnosis split, decay rules, privacy floor.
- [`evidence-discipline`](dist/agent-src/contexts/execution/evidence-discipline.md) — v1 spine, trust tiers, the rollback target.
