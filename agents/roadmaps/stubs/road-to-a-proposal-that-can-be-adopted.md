---
complexity: structural
review_by: 2026-12-06
probe: none
---

# Stub: eleven prepared proposals arrived and none was adoptable as written

> **Stub — not active work.** Recorded from round `inbox-2026-09-r`
> (2026-09-06), which delivered eleven consolidated `master` proposals, each
> already in this repository's roadmap format — frontmatter, declared parent
> set, tree pin, `estate_growth_exempt`, `relates:`, kill register, per-step
> `verify:` lines. Every one was verified claim-by-claim against `6af83a64b`.
> **Zero were adoptable unchanged.** The full per-proposal disposition is in
> `agents/evidence/analysis/inbox-2026-09-r-verification.md`.

> **Arrivals:** 1 — `inbox-2026-09-r` (2026-09-06). First observation of this
> shape at this scale; the counter exists so a second batch is recognisable as
> a second rather than as eleven new things.

## The measured finding

The proposals form a reference graph that exists only inside `agents/tmp/`.
Across the eleven `master` and `final` files, **48** distinct `road-to-*` slugs
are referenced and **35 of them exist nowhere in `agents/roadmaps/`** — not
active, not `later/`, not `stubs/`, not `archive/`. Most of the 35 are the
proposals' own names or their siblings'. Each session folded its substance into
receivers it assumed the others would land, and none did.

Reproduce:

```
grep -rhoE "road-to-[a-z0-9-]{6,}" agents/tmp.old/inbox-2026-09-r/*/road-to-*master*.md \
  | sort -u | while read s; do find agents/roadmaps -name "$s.md" | grep -q . || echo "$s"; done
```

Two further shapes, each seen in more than one proposal:

- **A completeness claim its own folder falsifies.** Two masters assert their
  parent set is complete and that no later synthesis exists; in both cases a
  sibling in the same folder claims the same parents. One additionally cites a
  register for its no-loss claim that does not appear in the file at all.
- **Plaintext source names in frontmatter.** Seven of the eleven name external
  projects in their first forty lines, one of them on
  `src/scripts/external_sources_denylist.json`. Adopting that file unchanged is
  a CI failure, not a style question — and the anonymised `S1`–`S13` convention
  the same files use elsewhere shows the authors knew the rule.

## The open question, which is the owner's

What makes a prepared proposal adoptable here at all? Three shapes, none
agent-decidable:

1. **Adopt after correction, per proposal** — what this round did for the four
   defect clusters that survived, at roughly one verification pass per proposal.
2. **Require a receiver before authoring** — a proposal may only name a fold
   target that already exists in the estate, which is checkable and would have
   caught 35 of 48 references before delivery.
3. **Treat them as analyses, not roadmaps** — the proposals become evidence
   artefacts and only this repository authors roadmaps from them.

## What this stub is NOT

Not a proposal to build an intake gate — that would be a mechanism decided
before the question it serves. Not a judgement on the proposals' quality: their
factual base was unusually strong, with most re-derived figures exact to the
line. It records that a high-quality proposal and an adoptable one turned out to
be different things, and asks which the next batch should be.
