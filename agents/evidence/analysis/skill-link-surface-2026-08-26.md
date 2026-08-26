<!-- evidence-type: analysis -->

# The cross-skill link surface — re-measured 2026-08-26

> `road-to-inbox-harvest-2026-08-f-skill-selection-evidence` Phase 2.1. The
> roadmap recorded 976 against a previously-published 943, and asked for the
> current count, the delta and the command, so the next reader compares rather
> than re-derives.

## The number

**976** cross-skill body links across **299** delivered skills.

```
grep -rohE '\]\(\.\./[a-z0-9-]+/SKILL\.md' src/skills/*/SKILL.md | wc -l
# 976
```

Delta against the 943 the earlier pass published: **+33**. That is growth in the
corpus rather than a correction — no link was found to have been miscounted.

## The two links a tighter pattern misses

This is the measurement note the step asks for, and it is the reason the gate
built alongside this file does not close its pattern on a paren:

```
grep -rohE '\]\(\.\./[a-z0-9-]+/SKILL\.md\)' src/skills/*/SKILL.md | wc -l
# 974   ← two fewer
```

The difference is two links carrying an **anchor** — `SKILL.md#some-heading`. A
trailing `\)` in the pattern excludes them.

Two out of 976 is 0.2 %, and it would be easy to write off. It should not be: an
anchored link is the shape most likely to rot, because a heading can be renamed
without touching any path, and a link checker blind to exactly that shape reports
clean while missing the failure it is least able to catch by other means. So
`lint_skill_link_reach` matches without the closing paren and the anchored case
is one of its self-test's rejecting cases.

## What the new gate adds over `check_references`

`check_references` already walks `dist/agent-src` and reports a broken path. What
it cannot answer is the question a consumer has: **does this link resolve in the
tree I was given?**

A link is not broken because its target is missing from the repository — it is
broken because the target is missing from the SUBSET that shipped, and those are
different failures with different fixes. `lint_skill_link_reach`'s corpus is
therefore `dist/agent-src/skills`, what the installer deploys, and not
`src/skills`, whose contents a consumer never sees.

**Measured on this tree: 976 links, 299 delivered skills, zero unresolved.** A
clean result, and stated as one rather than as a discovery — the gate's value is
that the next projection change cannot break it silently.

## Scope, stated because it is narrower than it could be

**Per-pack delivery is NOT checked here.** A pack ships a subset of the 299, and
a link that resolves across the whole delivered tree can still dangle inside one
pack. That half belongs to a parked owner per the roadmap's own step, and a check
that quietly widened to it would answer a question nobody asked in this run.

The floor in `gate-coverage.yml` is 200 rather than 299 for a related reason: a
scoped projection can legitimately deliver fewer skills, so the floor guards
against a broken projection rather than against a smaller one.
