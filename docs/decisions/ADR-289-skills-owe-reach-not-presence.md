---
adr: 289
status: accepted
date: 2026-10-18
decision: skills-owe-reach-not-presence
supersedes: —
superseded_by: —
phase: road-to-skills-that-arrive-when-called · blocker which-completeness-skills-owe
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: council
  decision_makers: [council]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/council/completeness-skills-owe-20261018.md
    - agents/evidence/council/completeness-skills-owe-20261018.question.md
    - agents/evidence/council/owner-blocker-routing-20261016.md
    - agents/evidence/council/skills-arrive-reach-shape-20261018.md
    - agents/roadmaps/archive/road-to-skills-that-arrive-when-called.md
    - agents/evidence/council/second-host-unlisted-reachability-20261020.md
    - agents/evidence/analysis/second-host-finder-probe-20261020.md
review_trigger: >-
  Reopened if a supported host cannot supply any deterministic retrieval path
  for a packaged skill and the package cannot install it there either — then
  "reach" is unmeetable on that host and the promise must name it unsupported
  or fall back to presence. Also reopened if a host stops truncating its skill
  listing, which removes the measured reason (a) was ruled out.
---

# ADR-289 — Skills owe reach, not presence

## Status

Accepted 2026-10-18. Decided by the AI council (2/2, `anthropic` + `openai`,
both (b)), under the owner's delegation of 2026-10-18 ("versuche die offenen
entscheidungen im ai council zu lösen"). Resolves the blocker <!-- md-language-check: ignore -->
`which-completeness-skills-owe` of `road-to-skills-that-arrive-when-called`.

## Context

ADR-267 § Decision 5 states completeness for rules: every rule file is written
for every host. Nothing stated it for skills; `README.md:59` said only that an
install "writes the active pack only". A default install writes 229 of 300
authored skills, the 71 others are unreachable without the package's MCP
server, and 28 `skills:` declarations of surviving commands name 13 pruned
skills. Hosts with native skills truncate what they list: the first host
stripped every description and dropped hundreds of entries on a default
install, and Codex CLI omits skills over its budget.

## Decision

1. **Reach.** The contract text, as the council worded it: *On supported
   hosts, every packaged skill is either installed locally or retrievable by
   its canonical name in one deterministic operation. Retrieval returns the
   skill from the installed package version and fails explicitly if that exact
   skill cannot be supplied.* Local presence is decided per host and is not the
   completeness guarantee.
2. **Declared dependencies are kept.** The default projection keeps every
   skill a surviving artefact declares in `skills:` or `requires_skills:`
   (step 6.3); dependency closure is an installer invariant. Declaring
   commands are not pruned to hold the count.
3. **Not met today, and not claimed.** The contract is published as met only
   once the operational definition exists — supported hosts, what "one
   deterministic operation" is, version selection, offline and failure
   behaviour, preserved semantics — and `doctor`'s reach report counts zero
   `unreachable`. Until then `README.md:59` cites this record without stating
   the contract as achieved.
4. `projection.mode` is not removed before the reach mechanism and its tests
   exist.

## Amendment — 2026-10-20 · what "one deterministic operation" is on a host that does not list a skill

Decided by the AI council (2/2, `anthropic` + `openai`, remedy (a) of the
blocker `second-host-unlisted-reachability`). Codex CLI lists skills within a
fixed budget, so the package keeps a resident set listed and the rest installed
but unlisted — and a model does not reach for a skill it cannot see (probe row
`unlisted-skill-not-in-model-list`). On such a host the one deterministic
operation is **one model-visible invocation of a package-written listed entry,
followed by a read of the target's SKILL.md at a path that entry names**: an
exact name is looked up in the entry's own index, never in a ranker, and a name
the index does not hold fails explicitly. The entry is not an authored skill;
the installer writes it, counts it inside the host's listing budget, and
removes it on uninstall. This defines the operation for that host; it does not
by itself publish point 3 as met.

## Consequences

- Step 4.6 of the skills roadmap is unblocked as a decision: the first host's
  presence is optional under reach, still gated by Phase 5 reading no harm.
- Step 4.7 of `road-to-a-setup-that-decides-itself` has its answer, bounded by
  point 4.
- D1 of the skills roadmap is a defect under this reading.
- The default install grows by about 13 skills when 6.3 lands; `docs/CLAIMS.md`
  regenerates the count.

## Alternatives considered

- **(a) presence** — every skill on every host. Ruled out by the measured host
  truncation: universal presence is a promise the package cannot keep.
- **(c) today's pack-scoped install as the promise** — makes commands with
  absent declared skills the specification.

## Evidence

The council record and its prompt (`agents/evidence/council/completeness-skills-owe-20261018{,.question}.md`);
the 2026-10-16 routing round, which escalated before the delegation and
recommended (b) 2/2; the 2026-10-18 6.3 round, which reproduced the 28 edges.

## References

- ADR-267 § Decision 5 — rules completeness, amended to point here for skills.
- `README.md` — the "Pack-scoped install" bullet cites this record.
