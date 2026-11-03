---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: source tags in the always-loaded safety floors

> **Stub — not active work.** Carried 2026-11-03 from step 1.4 (and the second
> URL of step 2.1) of the archived `road-to-floors-that-cite-or-route`.
> **Resume when:** the standing-payload ratchet has room for ~110 tokens in the
> project-scope rules (a lowered base after a rule shrink, or an owner-approved
> payload grant recorded before the change that spends it).

## What was built and taken back

Round `inbox-2026-11-n` added one line to `domain-safety-disclaimer.md` and
`finance-safety-floor.md`: a normative value (period, article, threshold, rate)
carries `[verified — source, date]` or `[model knowledge — verify]`. It also
gave `broken-access-control.md` a second `source_urls` entry and a longer
retention sentence. Together they grew the per-spawn payload by ~142 tokens,
and `check_preamble_payload_budget` forbids net growth with no grant available
for that change.

## How it was decided

AI council, 2026-11-03, two seats, blind: one seat chose to revert the
additions (no liability from runtime-translated legal disclaimers), the other
to drop the German disclaimer translations instead (~450 tokens). A split is an
escalation condition; the orchestrator took the conservative, reversible branch
— revert the additions, keep the removal of the unsourced per-country figures,
keep one OWASP `source_urls` entry because `check_rule_evidence_declaration`
requires one. Revisit-if: the payload has room, or the owner prefers dropping
the German translations.

## What closes it

The two tag lines back in the sibling floors, the second OWASP URL, and the
tag vocabulary named in the retention rule's Track 1 — with
`check_preamble_payload_budget` green on the same change.
