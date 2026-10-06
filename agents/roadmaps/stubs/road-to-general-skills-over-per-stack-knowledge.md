---
complexity: bounded
review_by: 2026-12-31
---
# Stub: general skills over per-stack knowledge

> **Stub — not active work.** Opened 2026-10-06 by `/roadmap:resolve-blockers`
> from an owner direction and a council verdict on programme blocker b5 of
> `road-to-leading-every-row` (recorded as D3 of
> [`later/road-to-stacks-beyond-php.md`](../later/road-to-stacks-beyond-php.md)). The owner
> asked that, if general orchestrating skills are the better shape for new stacks,
> the existing catalogue be checked for the same consolidation, to cut catalogue
> size and per-install characters.

## Why

A default Claude Code install loads ~338,000 characters of rules and skill
descriptions, about 2.25× the host's limit, and the host truncates the skill
catalogue it shows the model. About 30 of the 299 skills are named after one
framework or language. Every per-stack skill is knowledge this package has to
keep current, a gap for every stack it does not cover, and characters every
install pays.

The council of 2026-10-06 (round 1 both seats, round 2 one seat, DEGRADED)
recommended the audit with three destinations per skill:

1. **Consolidate** into a general skill where the content is derivable from the
   project's own config and tooling (the `standards-from-config` /
   `monorepo-workspace` pattern).
2. **Extract to a guideline** where the content teaches idioms rather than doing
   something.
3. **Keep** only where the skill executes mechanics a general path cannot derive.

## Promotion condition

Promote when the general testing / conventions skill of `road-to-stacks-beyond-php`
Phase 2 has been piloted and its pass rate per stack is measured — the same
evidence tells whether consolidation holds for the existing PHP skills.

## First steps when promoted

- [ ] Measure which of the ~30 framework-named skills are actually routed to
      (skill-route and telemetry records), before judging any of them.
- [ ] Classify each into consolidate / guideline / keep, with the evidence per row.
- [ ] Pilot three consolidations and measure task quality before and after.
