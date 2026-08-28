---
adr: 249
status: accepted
date: 2026-08-27
decision: supervised-resident-process-permitted-under-governance
supersedes: ADR-124, ADR-109
supersedes_scope: >-
  ADR-124 § 4 Class-B row (`:111`, "Resident service / daemon … PROHIBITED in
  core") and ADR-109's no-runtime identity floor clause (`:28`, "no daemon").
  Nothing else in either record. ADR-124's Class-A adoption path (`:110`), its
  Class-C network/LLM build-path prohibition, and its § 6 state-store test remain
  authoritative; ADR-109's subagent contract is otherwise untouched.
superseded_by: —
phase: road-to-runtime-governance-flip · Phase 1
type: structural
reopen_policy: owner
provenance:
  kind: mixed
  decision_makers: [maintainer, agentic-review]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E2
  basis:
    - agents/evidence/analysis/runtime-reversal-owner-decision.md
    - agents/evidence/analysis/no-runtime-discovery-2026-08-27.md
    - docs/decisions/ADR-124-embedded-engine-doctrine.md
    - docs/decisions/ADR-109-subagent-v1-contract.md
    - docs/contracts/no-runtime-boundary.md
authority_basis: owner_intent
review_trigger: >-
  Reopen when a supervised resident process shipped under this record is
  measured to violate one of the four governance conditions below — it outlives
  its supervisor, it writes outside its declared scope, it cannot be stopped by
  the documented mechanism, or it runs on a revision that still publishes a
  runtime-absence claim. Explicitly NOT a trigger: a preference for the previous
  identity, or the absence of a shipped collector. This record permits a class of
  process under conditions; it does not require one to exist.
---

# ADR-249 — A supervised resident process is permitted in core, under governance

## Status

**Accepted** · 2026-08-27. **Maintainer-directed reversal** of the resident-process
prohibition, recorded verbatim with its scope in
[`agents/evidence/analysis/runtime-reversal-owner-decision.md`](../../agents/evidence/analysis/runtime-reversal-owner-decision.md).
Read in one line: Zero Runtime is no longer the goal, anything asserting it is to
be deprecated or removed, the README is to be adapted, and runtime and daemons
are a means of assuring quality.

The direction is an owner product decision and is not proposed here. What this
record adds is the **boundary the reversal lands inside** and the **scope of the
supersession**, because the source analysis named the wrong anchor and executing
it as written would have left the live prohibition standing.

`authority_basis: owner_intent` is recorded rather than `evidence`: no
measurement in this tree establishes that a resident process is the right shape.
The owner decided it, and that is what the field is for.

## Context

Three artefacts in the tree refuse a resident process if read literally. That
number is measured, not asserted —
[`no-runtime-discovery-2026-08-27.md`](../../agents/evidence/analysis/no-runtime-discovery-2026-08-27.md)
enumerates **129 files / 205 lines** matching
`zero.runtime|no.runtime|no daemon|runtime daemon` at base `830e31aa3`, reduces
to the **49** that belong to a class capable of refusing anything (rules,
contracts, schemas, gates, accepted ADRs), and classifies every one of them:

| Artefact | Line | What it refuses |
|---|---|---|
| `ADR-124-embedded-engine-doctrine.md` | `:111` | Class B "Resident service / daemon — anything with a lifecycle beyond one command … PROHIBITED in core" |
| `ADR-109-subagent-v1-contract.md` | `:28` | "the no-runtime identity floor (no daemon, no auto-write…)" — accepted, `superseded_by: —` |
| `docs/contracts/no-runtime-boundary.md` | Prohibited table | "Background processes / daemons — no spawned subprocesses that outlive the current agent turn" |

**The source analysis named `ADR-088` as the anchor. It is not.**
`ADR-088-no-external-runtime-federation.md:78` decides this suite does not bridge
to or drive *other tools'* runtimes. That is federation, not process ownership —
and ADR-088 already carries `superseded_by: ADR-124`. The two questions are
different and this record answers only the second.

## Decision

**1. A supervised resident process is permitted in core**, replacing ADR-124's
Class-B blanket prohibition, subject to the four conditions in § Governance
conditions. "Supervised" is load-bearing: an unsupervised background process is
not permitted by this record and never was requested.

**2. The supersession is scoped, and the scope is machine-readable.**
`supersedes_scope` in this record's frontmatter names ADR-124 `:111` and
ADR-109 `:28` and nothing wider. The field is not decorative: it is a documented
sibling field (`docs/contracts/adr-layout.md:59-60`), it is rendered back into
the index in parentheses by `regenerate_index.ts:205` → `supersessionCell`, and
`check_adr_frontmatter` now refuses a `supersedes_scope` with no refs and
refuses a scoped supersession that omits § Not reopened.

**3. What remains authoritative in ADR-124** — re-read at this record's base
commit, not assumed:

- **`:110` Class A** — "Deterministic, in-process, invoked-per-command, no
  resident process, no listening socket, no network in the build path". Still the
  adoption path for an embedded engine, and **unchanged**. A Class-A engine does
  not become Class B because Class B is now reachable.
- **Class C** — network/LLM-dependent build paths stay prohibited.
- **§ 6 state-store test** — "if deleting the artifact changes *what* the tool
  can answer rather than only *how fast*, it is a state store and prohibited".
  Untouched, and § Not reopened restates why.
- **The ADR-088/094 engine-rejection supersession** ADR-124 itself performed.

**4. What remains authoritative in ADR-109** — the subagent v1 contract in full.
Only the "no daemon" clause of its identity floor moves; the auto-write
prohibition in the same sentence does **not** (see § Not reopened).

## Governance conditions

A resident process permitted by this record must satisfy all four. These are the
conditions the `review_trigger` above is written against.

1. **Supervised** — it has a named supervisor, a documented start and stop path,
   and it does not outlive that supervisor.
2. **Scoped writes** — it declares what it writes before it runs, and writes
   nothing else. ADR-124 § 6's state-store test applies to whatever it writes.
3. **Stoppable** — a documented mechanism stops it, and stopping it degrades a
   capability rather than corrupting state.
4. **Claim-consistent** — it may not execute from a revision that still
   publishes a runtime-absence claim on a maintained public surface. This is the
   ordering invariant, and it is a condition on the *process*, not only on the
   documentation: the claim must be gone first, in the same revision or earlier.

Condition 4 is stated here rather than only in the roadmap because an AI council
(2026-08-27) found the documentation-ordering rule **necessary but not
sufficient**: removing a public claim does not prevent an older revision from
activating a process. The mechanism that enforces it belongs to
`road-to-supervised-telemetry-collector`; the obligation is recorded here so it
cannot be dropped by whichever roadmap builds first.

## The public-surface transition this record authorises

The reversal changes what the package *permits* today and what it *is* only once
a supervised process ships. Those are two statements and they land separately —
option (a) of the roadmap's `public-claim-transition-shape` blocker, confirmed by
an AI council on 2026-08-27 against the alternatives of holding the whole
transition until a runtime exists, or publishing a present-tense claim in the
meantime.

**In the window between this record and any measured runtime property**, a
maintained public surface may state the adopted policy, may state that runtime
work or validation is pending, and may state currently-backed runtime-neutral
capabilities. It may not:

- assert that no resident runtime, process or daemon exists;
- assert that one already exists, unless separately evidenced;
- assert any unverified runtime property — safety, boundedness, lifecycle
  management, reliability, isolation, or any guarantee;
- present a policy adjective such as "governed" grammatically as an established
  property of an implemented runtime.

Stated as a test a rewritten surface either passes or fails: **the text contains
no runtime-absence assertion and no present-tense runtime-property assertion, and
every remaining factual capability assertion resolves to a currently backed claim
in `docs/CLAIMS.md`. A policy may appear only where it is explicitly labelled as
policy, intent, or a pending transition.**

The council's reason for rejecting the alternatives is recorded because it is not
obvious: holding the transition leaves `docs/comparison.yaml:31` publishing a
claim the repository has already decided against, which is a different false
statement rather than fewer.

## Not reopened

The reversal is narrow. Each of the following is a **separate decision that
stands**, and this section exists because a repeal without it reads as a general
relaxation — which is the reading the safety floors cannot survive.

- **ADR-094 and the 2026-06-14 agent-memory / Layer-2 sunset are not reopened.**
  Runtime permitted is not agent-memory permitted. No vector DB, no writable
  per-user store, no background decay, no cross-session persistent state store.
  `ADR-100:137` records the relationship as "reconciled, not reversed"; that
  remains exactly true. The discovery artefact lists nine further lines across
  `ADR-098`, `ADR-099`, `ADR-100` and `ADR-138` that carry this prohibition, and
  **none of them is superseded by this record.**
- **ADR-123 and `docs/spawn-site-policy.md` are not reopened.** Spawn hardening is
  unchanged; every subprocess still routes through `hardenedSpawnEnv()`. A
  resident process is a harder case for spawn hygiene, not an exemption from it.
- **`lethal-trifecta-guard` is not carved out.** A resident process that reads
  private data, ingests untrusted content and can reach the network is the
  trifecta with a longer lifetime. The rule applies in full, and the egress leg
  still requires a human gate.
- **ADR-109's auto-write prohibition is not reopened.** Its identity floor reads
  "no daemon, no auto-write". Only the first clause moves.
- **ADR-124 Class C is not reopened.** A resident process may not become a route
  to a network- or model-dependent build path.

## Evidence

| Claim | Basis |
|---|---|
| Exactly three artefacts in the tree refuse a resident process if read literally | `agents/evidence/analysis/no-runtime-discovery-2026-08-27.md` — 129 files / 205 lines enumerated at base `830e31aa3`, reduced to the 49 in classes that can refuse anything, every one classified. Later corrected to **six** by a second reader; see the row below |
| The class-based half of that reduction was unsound, and the correction is recorded rather than the first number | `agents/evidence/analysis/no-runtime-surface-census.md` § Second-reader review — an AI council split, the rejection was upheld on evidence, and re-reading the 28 operationally-loaded files found three further blockers, including `src/skills/verify-repair-loop/SKILL.md:140` (item 5 of a "Before finalizing, confirm" checklist) |
| `ADR-088` is not the anchor the source analysis named | `docs/decisions/ADR-088-no-external-runtime-federation.md:78` decides federation — not driving another tool's runtime — and already carries `superseded_by: ADR-124` |
| The live prohibition is ADR-124's Class-B row, and a second floor sits in ADR-109 | `ADR-124:111` ("Resident service / daemon … PROHIBITED in core") and `ADR-109:28` ("the no-runtime identity floor (no daemon, …)"), the latter `status: accepted` with `superseded_by: —` at the time of writing |
| Scoped supersession is a mechanism this repository already has, not one this record invents | `docs/contracts/adr-layout.md:59-60` declares `supersedes_scope` / `superseded_scope`; `src/scripts/adr/regenerate_index.ts:205` renders the scope back into the index; ADR-124 itself carried `supersedes_scope: engine-adoption interpretation only` before this change |
| The owner decision is durably recorded rather than quoted from a disposable path | `agents/evidence/analysis/runtime-reversal-owner-decision.md` |
| The predecessor contract's literal scope was narrower than its citations assumed | `docs/contracts/no-runtime-boundary.md` header ("for the Mission-Mode layer"); `ADR-124:34` had already recorded that "the 'no runtime' identity rests on instruments whose literal scope is narrower"; `src/scripts/validate_reach_prescriptions.ts:13` cites it as the general Class-A boundary |

**The grade is E2 — repeated and comparative, and it is deliberately one band
below what the corpus census proposes.** `agents/evidence/analysis/adr-evidence-census-2026-08.md`
classifies this record **E3** on the strength of its `docs/CLAIMS.md` reference.
E2 is kept: every row above is read off a named file at a named line in this
tree, which is what E2 describes, and the CLAIMS entry this record touches is one
it **withdrew** rather than one that backs it. Declaring the lower band is the
conservative direction, and a grade is a measurement rather than a permission —
nothing in this record depends on which of the two it carries.

**What no evidence here establishes**, stated because `authority_basis:
owner_intent` is the load-bearing field: **that a resident process is the right
shape for this package.** No measurement in this tree says so. The owner decided
it. Every row above is evidence about *what the tree currently says* and *which
artefacts would refuse the decision* — never about whether the decision is
correct.

## Consequences

**Positive.** The tree stops asserting a property the owner has decided against.
The dependent roadmap `road-to-supervised-telemetry-collector` gains the Phase 1
record it declares a hard dependency on. A future analysis pass reading ADR-124
finds the Class-B row scoped rather than silently contradicted.

**Negative, and named.** The suite loses a differentiator it published as its
headline. `docs/comparison.yaml:31` argued *against* daemons as a competitive
position and that argument is now the package's own to answer. Fourteen accepted
records reason *from* the no-runtime premise — the discovery artefact lists them
under DERIVATIVE — and each states something that loses its premise here.
`ADR-137:45` is the sharpest: it declares telemetry *infeasible* in this package
because "there is no server", while the dependent roadmap exists to build one.
Two accepted records disagree until one is amended; that amendment is Phase 4.2's
and is not performed here.

**Unresolved.** No supervision mechanism, platform scope, privilege model,
uniqueness namespace, installation path, activation path, upgrade path, or
storage policy is decided by this record. Those are blockers on
`road-to-supervised-telemetry-collector`, deliberately, and the owner decision
explicitly does not decide them either.

## Alternatives

**Amend ADR-124 in place** rather than supersede a row of it. Rejected. ADR-124
is itself a reversal ADR whose Class-B row is the provision being reversed again;
amending in place would make one document assert two opposite positions across
its own history with no record of the transition, and a reader who cited the old
row would find nothing saying it moved. An AI council initially recommended this
option on the premise that scoped supersession "is a convention in this tree, not
a mechanism". **That premise was measured and found false** — `supersedes_scope`
is documented, rendered, and already carried by ADR-124 itself — and the council
reversed its own recommendation once the measurement was put to it.

**Supersede ADR-124 whole and re-state its Class-A row here.** Rejected: it
duplicates a load-bearing provision, and a second copy is what later drifts.

**Leave the prohibition and treat the collector as an exception.** Rejected: an
undocumented exception to an accepted floor is the failure the ADR corpus exists
to prevent.

## References

- `agents/evidence/analysis/runtime-reversal-owner-decision.md` — the owner decision, verbatim, with its scope.
- `agents/evidence/analysis/no-runtime-discovery-2026-08-27.md` — the 129-file census and the three-artefact active set.
- ADR-124 § 4 (`:110` Class A, `:111` Class B) · ADR-109 `:28` · ADR-088 `:78`.
- `docs/contracts/resident-process-governance.md` — the governance contract implementing this record: the P0-P4 process classes, the four conditions restated as a class table, and the suite-wide scope stated as a deliberate widening. `docs/contracts/no-runtime-boundary.md` is kept as a pointer stub, because fifty files referenced it.
- `docs/contracts/adr-layout.md:59-60, 105-117` — the `supersedes_scope` / `superseded_scope` convention this record uses.
