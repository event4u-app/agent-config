---
adr: 246
status: accepted
date: 2026-08-26
decision: code-graph-parsers-stay-devdependencies
supersedes: —
superseded_by: —
phase: road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh · Phase 3.3
type: structural
provenance:
  kind: mixed
  decision_makers: [agentic-review]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - package.json
    - src/scripts/check_dependency_floors.ts
    - docs/MIGRATION.md
    - agents/evidence/analysis/code-graph-ambiguous-classes-2026-08-26.md
review_trigger: >-
  Reopen on a CONSUMER case the graph answers and disciplined grep cannot —
  stated by a consumer, not inferred from the engine's capability. A second,
  independent trigger: a post-repair retrieval measurement that beats grep on
  graph-shaped questions, which is `road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh`
  step 3.1 and is blocked on benchmark inputs this repository does not hold.
  Explicitly NOT a reopen trigger: an improvement in EXTRACTION quality. This
  record was written in the same change that raised EXTRACTED edges from 89,452
  to 99,022, and that number moves nothing here — a graph with better edges is
  still a graph no consumer can load.
---

# ADR-246 — the code-graph parsers stay `devDependencies`, and the engine is maintainer-only

## Context

The native code-graph engine needs an ABI-locked parser pair —
`web-tree-sitter@0.24.7` and `tree-sitter-wasms@0.1.13`, roughly **51 MB
unpacked**. That pair sits in `devDependencies` (`package.json:112,117`), which
`npm install` does not install for a consumer.

**So no consumer can reach the engine, whatever any flag says.** Turning
`hooks.code_graph.enabled: true` in a consumer install is not sufficient and
never has been: the loader has nothing to load.

The demotion was made ahead of a deprecation schedule and recorded in **a script
comment** — `src/scripts/check_dependency_floors.ts:50-54`, which mentions it
only to explain why an exception list is now empty — and **in no decision
record**. No roadmap owned re-promoting it. That is the gap this record closes:
not the packaging choice, which is old, but the absence of anywhere it was
written down as a choice.

## Decision

**The parser pair stays in `devDependencies`. The native code-graph engine is a
maintainer-only surface.**

Consumer-facing code-graph capability is served by the **consumer-index
interop** path instead — `external-code-graph-interop` and the
`code-intelligence` skill query a SCIP or `graph.json` index that the consumer's
own toolchain already produces. That path needs no parser, no WASM, and no
51 MB.

The surfaces stay registered and disabled, per the 2026-08-15 withdrawal of the
removal commitment (`docs/MIGRATION.md`, the `code_graph` row). Registered and
disabled is a different state from removed, and this record does not change it.

## Consequences

- A consumer who wants the native engine installs the pinned pair themselves.
  `code_graph/loader.ts` carries the ABI pin as an install hint, and that is
  where a re-enabler reads it — this record does not duplicate the version, so
  the two cannot drift.
- `check_dependency_floors`'s `EXACT_PIN_EXCEPTIONS` stays empty and its comment
  stays accurate: the gate scans `dependencies` and the pair is not there.
- **~51 MB is not installed by every consumer for a path none of them can
  reach.** That is the whole benefit and it is already banked; this record only
  stops it being reversed by accident.
- The engine keeps working for maintainers, where the parser pair is present —
  including for the extraction work landed alongside this record.

## Alternatives

**Promote the pair back to `dependencies`.** Rejected. It re-imposes 51 MB on
every consumer to enable a path whose only retrieval measurement lost to grep
(recall 0.365 vs 0.797, `claim:code-graph-retrieval-null`) — and that
measurement, though it predates the 2026-08-22 extractor repair and is now
scoped accordingly in the ledger, is still the only retrieval evidence that
exists. Promoting on the strength of an unmeasured expectation is what the
review trigger above exists to prevent.

**Remove the engine entirely.** Rejected, and not by this record — the
2026-08-15 revision already withdrew the removal commitment with its reasoning:
the payload this deprecation existed for had already shipped, source removal
would free ~112 K against a 27 M tree, and it would cost a breaking change
across four consumer-visible surfaces. Restated here only so a reader of this
record does not conclude that maintainer-only implies scheduled-for-deletion.

**Ship the parsers as an optional dependency.** Not taken. `optionalDependencies`
installs by default and merely tolerates failure, so it would re-impose the
51 MB it is meant to avoid; a `peerDependencies` entry would warn every consumer
about a package they are correctly not installing. Neither expresses
"maintainer-only" better than the current shape.

## Evidence

| Claim | Basis |
|---|---|
| The parser pair is in `devDependencies`, not `dependencies` | `package.json:112,117` (`web-tree-sitter@0.24.7`, `tree-sitter-wasms@0.1.13`); read this session |
| `npm install` does not install it for a consumer | Definitional for `devDependencies`; the consequence is stated for this tree in `docs/MIGRATION.md`'s `code_graph` row — "no consumer installs it" |
| The demotion was recorded in a script comment and in no decision record | `src/scripts/check_dependency_floors.ts:50-54` mentions it only to explain why `EXACT_PIN_EXCEPTIONS` is empty; a grep of `docs/decisions/` for the package names returns nothing before this record |
| No roadmap owns re-promoting it | Grepped across `agents/roadmaps/*.md`, `later/` and `stubs/` this session — no file carries a re-promotion item |
| ~51 MB unpacked | `docs/MIGRATION.md`'s `code_graph` row, which records the figure at the time of the demotion; not re-measured here and stated as the recorded figure rather than a fresh one |
| Source removal would free ~112 K against a 27 M tree | Same row, maintainer measurement 2026-08-15; carried forward rather than re-derived |
| The only retrieval measurement lost to grep | `claim:code-graph-retrieval-null` — recall 0.365 vs 0.797. Its `measured_on:` field, added in this same change, records that it describes a build predating the 2026-08-22 extractor repair |
| Extraction quality improved in this same change | `agents/evidence/analysis/code-graph-ambiguous-classes-2026-08-26.md`: EXTRACTED 89,452 → 99,022, AMBIGUOUS unchanged. Named here so the review trigger can exclude it explicitly |
| The engine loads for a maintainer | `./agent-config code-graph build --root .` ran in this session — 2,953 files, 23,101 nodes, grammar ABI 14 |

The grade is **E2 — repeated and comparative**, and deliberately not higher. Every
row is either a live read of this tree or a maintainer figure carried forward with
its provenance named. What is NOT here, and what keeps it off E3: no consumer was
asked. The claim that the consumer-index interop path is sufficient in practice
has no consumer behind it — it is an argument from the path's existence, and the
§ honest-limit section below says so rather than letting the grade imply
otherwise.

## The honest limit of this record

It documents a packaging state and its reopen conditions. It does **not**
establish that the engine is worth re-enabling — that question is open and its
answer is a measurement nobody has taken. It also does not establish that the
consumer-index path is sufficient in practice; that path has consumers in
principle and none measured here.
