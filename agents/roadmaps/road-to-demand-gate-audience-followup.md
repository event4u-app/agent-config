---
complexity: lightweight
status: draft
parent_roadmap: road-to-demand-gate-audience
---

# Road to Demand-Gate Audience — Follow-up

**Goal.** Hold the two decisions the parent roadmap deliberately did not take,
so neither is lost and neither is taken by an agent on its own authority.

## Context

`agents/roadmaps/road-to-demand-gate-audience.md` fixed the demand gate's
single-addressee defect: § 8-pre gained an `L-self` build level, and
`project.audience` was added as a class-C settings key defaulting to `public`
(today's behaviour, unchanged for every existing install).

Two items from the source note were removed from that scope on purpose. Both are
listed there under **Non-goals**; both are copied here verbatim so the plan
survives.

This roadmap is `status: draft` — it is hidden from the dashboard and is not
executable until a human decides the two questions below.

## Item 1 — Flip the shipped default from `public` to `internal`

The source note argues (translated): default `internal`, not `public` — most
repositories running this package are not products with a market, so today's de
facto default is `public`, which is the least likely assumption of the four.

That is a real argument, and the flip is a **consumer-facing default change**:
it alters agent behaviour in every existing install, including those whose
maintainers never read the change. The parent roadmap therefore shipped the
conservative value and left the flip here.

What would have to be true before flipping:

- [ ] A stated position on whether an unconfigured repo running this package is more likely internal than public — evidence, or an explicit maintainer judgement recorded as such.
- [ ] A migration note for existing installs: what changes for a repo that never sets the key.
- [ ] The counter-test from the parent's Phase 4 re-pointed, so "the market path survives" is asserted against `audience: public` explicitly rather than against the default.

## Item 2 — Move § 8-pre into the product workspace (the note's Stufe 3)

The note proposes lifting the demand gate out of the engineering guideline and
into the `product` workspace, so that `agents.rule_workspaces` actually controls
the behaviour instead of only appearing to.

**The note's stated route is falsified.** It suggests folding § 8-pre into
`validate-feature-fit`, on the premise that the skill is product-scoped. It is
not: `src/skills/validate-feature-fit/SKILL.md` carries `workspaces:
[engineering]`. Moving the section there would gate nothing.

What would have to be decided:

- [ ] Whether `validate-feature-fit` should itself move to `workspaces: [product]`, or whether § 8-pre gets its own product-scoped guideline.
- [ ] Whether `improve-before-implement` may route **conditionally** — the rule is engineering-scoped, and a conditional route to a product-scoped target is a new routing shape, not a relocation.
- [ ] Whether this is worth doing at all now that `project.audience` addresses the reported damage directly. The note itself ranks it last — its own wording is "stage 3 only when the workspace mechanism is being touched anyway".

## Prerequisites

- `agents/roadmaps/road-to-demand-gate-audience.md` is complete (or archived).
- A human decision on Item 1 and/or Item 2. Until then this roadmap stays `draft`.
