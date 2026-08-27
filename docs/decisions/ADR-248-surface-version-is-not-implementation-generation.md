---
adr: 248
status: accepted
date: 2026-08-26
decision: surface-version-is-not-implementation-generation
supersedes: —
superseded_by: —
phase: road-to-evidence-gated-change · Phase 5.1
type: structural
reopen_policy: directional
provenance:
  kind: mixed
  decision_makers: [agentic-review]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - src/rules/improve-before-implement.md
    - src/rules/decision-revisit-gate.md
    - src/scripts/adr_cite_check.ts
    - src/skills/playbook-authoring/SKILL.md
review_trigger: >-
  Reopen when a measured case shows the evidence order below producing the wrong
  answer — a canonicality verdict that a live decision record supported and that
  the tree contradicted. Explicitly NOT a trigger: someone disliking that names
  and paths rank last. That ranking is the whole content of this record, and the
  discomfort it causes is the point.
---

# ADR-248 — A public surface version is not an implementation generation

## Status

Accepted.

## Context

The originating request was one sentence from a consumer maintainer: look for
existing code before writing new code, **including the case where a `v1`
controller carries the more modern implementation than a `v2` one.**

That case is not a curiosity. It is the normal outcome of two independent
lifecycles. A **public surface version** is a compatibility promise to callers,
and it changes when the contract changes. An **implementation generation** is
which internal architecture a file was written against, and it changes when the
codebase moves. Nothing couples them. A `v1` endpoint gets refactored onto the
current architecture because it is the one with traffic; a `v2` endpoint is
started, half-migrated and abandoned.

An agent asked "where does new code go" that reads the version number as the
generation puts new code in the wrong lane, and does it confidently, because the
number looks like exactly the signal it needs.

## Decision

**The two axes are independent, and neither implies the other.** A controller can
be publicly `v1` and carry the current internal architecture. `v2`, file
modification time and most-recent-commit are **weak evidence that never decides
alone.**

**The canonicality evidence order**, strongest first. Stop at the first rank that
answers; a lower rank never overrides a higher one.

1. **An applicable live decision record.** An ADR or equivalent that names this
   surface or this class of surface. "Live" is load-bearing and is
   machine-checkable — see § Rank 1 is mechanised.
2. **An executable architecture test.** A test that fails when code is placed in
   the wrong lane. It beats prose because it is the only rank that has been run.
3. **A shared abstraction in maintained code.** A base class, a middleware, a
   generated client that several current call sites already route through.
4. **Current tests and contracts.** What the suite actually asserts about this
   surface today.
5. **Several recent analogous implementations.** Plural and recent. One recent
   file is a sample, not a convention.
6. **Migration or deprecation documentation.** It states intent, which is
   weaker than a mechanism but stronger than history.
7. **Git history.** Informative about what happened, silent about what should
   happen next. A file untouched for a year may be finished rather than stale.
8. **Names and paths.** Last, and deliberately last. `v2/`, `new/`, `modern/`
   and `legacy/` are the signals most likely to be wrong precisely because they
   were cheapest to write.

**A verdict may be `new`, and a `new` verdict owes negative evidence** — the best
existing candidate, named, and why it does not fit. That obligation lives in
[`improve-before-implement`](../../src/rules/improve-before-implement.md); this
record supplies the ranking it reasons over.

## Rank 1 is mechanised, and this record does not restate staleness

"An applicable **live** decision record" is checkable rather than a judgement
call: `agent-config` → `adr_cite_check <ADR-NNN>` reports status, amendments,
successors and `review_trigger` state, and its `--all` mode does the same across
the corpus. A record that is `superseded`, `deprecated`, or amended past the
clause being cited is not rank 1.

Where the record is stale, the routing is
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md)'s, not this
ADR's. **Writing a second staleness rule here would create two rules for one
question**, and the existing one is the enforced surface.

## Consequences

- An agent answering "where does new code go" produces a **ranked** answer with
  the rank named, so a reviewer can see which evidence carried it.
- **Rank 8 will feel wrong to somebody**, regularly. That is the intended cost:
  a path name is the cheapest possible signal and is therefore the one most
  often left behind by a refactor.
- A confirmed canonical pattern for a scope is recorded as a **playbook** under
  the ADR-244 contract rather than in a new artefact class. No second
  conventions-map, and no single global exemplar per artefact type — a repository
  can legitimately have two right answers in two modules.
- **This record decides nothing about any specific surface.** It is an evidence
  order, not a verdict, and it cannot be cited to justify a placement on its own.

## Alternatives

**Rank git history higher.** Rejected: recency measures activity, not
correctness, and the most-recently-touched file is often the one being migrated
*away* from.

**Treat the highest version number as canonical.** Rejected — it is the exact
failure the originating request named, and it is a one-line heuristic that is
wrong whenever a `v1` surface is the one with traffic.

**Write a canonicality *gate*.** Refused as premature: the evidence order has not
been measured against a corpus of real placements, and a gate over an unmeasured
heuristic is the shape this repository keeps removing. A golden fixture that
fails without the distinction is the honest first instrument, and it is Phase 5.4
of the roadmap that produced this record.

## Evidence

| Claim | Basis |
|---|---|
| The `new`-owes-negative-evidence obligation lives in a rule, and this record only supplies the ranking it reasons over | `src/rules/improve-before-implement.md:66` — the named-verdict set and "`new` owes the closest candidate by name and path, and why it does not fit" |
| Rank 1's "live" is machine-checkable rather than a judgement call | `src/scripts/adr_cite_check.ts` reports status, amendments and successors per record (`:19` documents the successor axis) and carries a corpus mode; run this session, `--all` reported 137 of 161 accepted ADRs cited outside `docs/decisions/`, 74 records carrying a `review_trigger` (all indeterminate), 7 of 203 declaring a `reopen_policy` |
| Staleness routing already has ONE owner, so this record does not restate it | `src/rules/decision-revisit-gate.md:71-72` — evaluate before citing, and a `superseded` / `deprecated` status means the lock is not live |
| Ranking a repository's own mechanism above generic prose is an established shape here, not a new invention | `src/skills/playbook-authoring/SKILL.md:26-27` — a step is `configured` only when its generator was seen in the tree, `observed` otherwise; the same evidence-over-assertion discriminator, applied to procedure |

The grade is **E2 — repeated and comparative**. Every row is read off a named
file at a named line in this tree, and the one quantitative row is a live run of
the tool the record's own rank 1 depends on.

**What the evidence does NOT establish, so the grade is not read as more than it
is.** No measurement here shows the eight-rank ORDER is correct — the ranks below
rank 2 are reasoned, not benchmarked, and the record says so by making its own
`review_trigger` a measured wrong answer rather than a date. What is established
is narrower and is the load-bearing half: the two axes are independent, the
mechanised ranks exist and run, and nothing in the tree couples a surface version
to an implementation generation.

## References

- [`improve-before-implement`](../../src/rules/improve-before-implement.md) — the verdict set this order feeds.
- [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md) — where a stale rank-1 record routes.
- [`external-code-graph-interop`](../../src/rules/external-code-graph-interop.md) — query before grep when looking for the candidates.
- `src/skills/playbook-authoring/SKILL.md` — where a confirmed per-scope answer is persisted.
- **ADR-244** — the playbook artefact class. Cited by number: `docs/` is not projected into a consumer install.
