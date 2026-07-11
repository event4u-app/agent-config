---
adr: 114
status: accepted
date: 2026-07-08
decision: commit-policy-iron-law-override
supersedes: —
superseded_by: —
phase: kernel-budget overrides (extends ADR-002)
type: structural
---

# ADR-114 — commit-policy Iron-Law Override (per-rule cap 2.5k → ceiling 4.0k)

- **Status:** Accepted (2026-07-08)
- **Supersedes:** none — extends the override set locked by
  [ADR-002](ADR-002-kernel-bucket-overrides.md) under
  `docs/contracts/kernel-membership.md` § 5.1.
- **Related:** ADR-002 (kernel-bucket cap raise + the original 6 overrides).

## Context

Commit 259bb1b24 (*feat(commit-policy): one-shot authorization is not a
standing license*, merged to main 2026-07-07) added a second Iron-Law fence
to `commit-policy`:

```
A ONE-OFF AUTHORIZATION IS SPENT ON EXACTLY THAT OPERATION, ONCE.
IT NEVER BECOMES A STANDING LICENSE FOR LATER COMMITS OR PUSHES.
EACH FURTHER COMMIT / PUSH NEEDS ITS OWN FRESH, EXPLICIT GO-AHEAD.
```

plus the prose enumerating which phrasings spend the authorization and the
canonical failure it prevents. That grew the rule from 2 354 chars (the
post-ADR-002 trimmed size) to **3 194 chars** — over the 2 500 per-rule hard
cap, without an entry in `docs/contracts/iron-law-overrides.txt`, so
`lint-rule-budget` hard-fails on every branch that carries main.

Kernel-bucket state at decision time: **25 393 / 26 000 chars** (9 rules) —
the bucket cap from ADR-002 still holds with ~600 chars headroom; only the
per-rule cap is exceeded.

## Decision

1. Add `commit-policy` (3 194 chars) to
   `docs/contracts/iron-law-overrides.txt` with this ADR as justification.
   It sits between 2.5k and the 4.0k override ceiling.
2. The kernel bucket cap (26 000) and the override ceiling (4 000) stay
   unchanged.

## Rationale

`commit-policy` now carries **three non-externalisable structural
elements** — the same test ADR-002 applied to the original 6 overrides:

- The primary Iron-Law fence (`NEVER COMMIT. NEVER ASK ABOUT COMMITTING.`)
  plus the closed 4-exception enumeration — the rule's contract.
- The new one-shot-authorization fence plus the phrasing enumeration
  ("commit this", "push it", "open the PR" are spent on exactly that
  operation). Externalising the enumeration would force a context load on
  every commit-adjacent turn — i.e. always — defeating the kernel-vs-auto
  split.
- The split-into-chunks fence (`COMMIT AUTHORIZED → SPLIT INTO LOGICAL
  CHUNKS BY DEFAULT`) with its never-ask clauses.

ADR-002 noted commit-policy was trimmable *because* it carried no
enumeration; 259bb1b24 changed exactly that premise by adding one whose
misreading (a one-off "commit this" read as standing license) is the
canonical failure the fence exists to stop.

## Consequences

- **Pro:** `lint-rule-budget` is green again on every branch tracking main;
  the Iron-Law fences stay byte-preserved in one rule.
- **Con:** 7 of 9 kernel rules now carry overrides; the 2.5k hard cap
  disciplines only new/small rules. The 26k bucket (98%+ utilisation
  headroom per ADR-002) remains the effective backstop.
- Future commit-policy growth past 4 000 chars is not covered — that would
  require condensation or an externalisation decision, not another ADR.

## Rollback

Trim the one-shot-authorization prose into
`contexts/authority/commit-mechanics.md` (keeping only the fence in the
rule) and remove the allowlist entry — reversible; this ADR does not lock
that out.
