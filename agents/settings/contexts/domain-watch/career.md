# Domain watch — Career / CV tooling

> Watch-only note per `domain-adoption-policy`. Opened 2026-11-03 by round
> `inbox-2026-11-u` (topic T3). **Not** a commitment to build — a record of the
> option, the decision, and the demand threshold.

## The deferred ask

A supplied plan proposed a career-intelligence domain pack: CV parsing, a
career-fact store, claim grounding against a job posting, four public
`career:*` commands and assisted application sending.

## Why it is deferred

None of the three gates is citeable:

1. **Demand signal** — no consumer request; the round's own user turn asked
   what agent-config can *learn* from CV tooling, not for CV tooling.
2. **Named maintenance owner** — none.
3. **CI-tooling decision** — none; parsing needs PDF/DOCX libraries.

The four public commands also conflict with ADR-041 (controlled command verbs),
and application sending is an irreversible external action.

## What was adopted instead

The generic half: a rewrite that keeps its facts
(`agents/roadmaps/road-to-rewrites-that-keep-their-facts.md`). CVs serve only
as a **synthetic** stress corpus for the fact witness — never real candidate
data.

## Reopen when

A consumer asks for CV or application tooling in writing, and a maintainer
volunteers with a cadence.
