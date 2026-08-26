---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-26
estate_offset_exempt: "No archive move is available in this change. The addition is the smaller half of a reduction: a six-document, roughly 8,400-line proposal bundle produced one roadmap, and five of its six documents were recorded as superseded, stale or refuted rather than landed. Its predecessor, agents/roadmaps/archive/road-to-code-graph-extractor-defect.md, is already archived and cannot be retired again."
estate_growth_exempt: "Activation change (2026-08-26): this file flips status draft -> ready, so it now charges +1 on the count half, which read +0 for as long as it shipped draft. One-in-one-out is file-based and was already paid by the change that landed the file; the claim is re-stated here because it is diff-scoped and an earlier one cannot be banked. It also adds one blocker against a floor of 31, which carries no automatic allowance. Warranted on measurement: the verdict this package publishes about its own code graph was measured on 2026-07-28 against a build that no longer exists, the extractor defect it blamed was repaired on 2026-08-22 and the harness was never re-run, and a fresh build at HEAD shows 42.9 per cent of its edges carry AMBIGUOUS confidence with no recorded cause. No open roadmap carries a code-graph item; grepped across all twelve active files."
---
# Road to a code-graph verdict that measures the code that exists

> **Source:** `agents/tmp.old/atomic-mem/` (2026-08-26), six proposal documents
> written against `06e7585`, and its predecessor bundle
> `agents/tmp.old/atomic-claude-graph/` (2026-08-24), whose own proposals were
> declined in `road-to-contract-review-deadlines` § Dropped. Every figure below
> was re-derived at HEAD `3f4508a9b`; five of the bundle's central premises did
> not survive that pass and are recorded in § Prevented rather than planned.
> External comparators are referred to as Source A–E per
> [`source-confidentiality`](../../src/rules/source-confidentiality.md).

## Goal

The published verdict about this package's code graph describes the extractor
that ships today. Finished means: the two extraction gaps that are measurable at
HEAD are either closed or recorded as terminal with a number, the benchmark has
either been re-run on the current build or its inputs are named as a blocker
with an owner, the routing code and its governing contract agree, and no
document still claims a permanence that the record retracted.

## Context — the bundle is right about the shape and wrong about five specifics

**The one fact that carries the whole roadmap.** The honest null
(`internal/bench/reports/code-graph-vs-grep.md:16-24` — recall 0.365 vs grep
0.797, precision 0.413 vs 0.670, controls 0.111 vs 0.833, Δ −43.2 pp) was
measured on **2026-07-28**. The extractor defect it blames — TypeScript
arrow-function exports producing no symbol nodes — was **repaired on 2026-08-22**
by `f3c2ce814`, `extract.ts:309-371` and `:372-395`, produced by
`agents/roadmaps/archive/road-to-code-graph-extractor-defect.md`. `git log` over
the report returns exactly one commit, `297fe9db4`, the original run;
`docs/CLAIMS.md:427` still reads `last_verified: 2026-07-28`. **The verdict
measures a build that no longer exists**, and the archived roadmap's own goal
sentence required the re-run that never happened.

**Reproduced, not assumed.** That roadmap's own five-declaration fixture
(`:52-58`) was rebuilt outside the tracked tree: it produced 4 of 7 nodes when
the defect was recorded and produces **7 of 7** today. The dispatcher defect the
same report records at `:40-45` is also fixed (`_dispatch.bash:662-666`,
`cli.ts:81-105`) and was reproduced against a foreign tree.

**Two gaps are live, measurable, and larger than the record says.**

1. **42.9 per cent of edges are `AMBIGUOUS`.** A fresh build at HEAD reads
   3,027 files → 23,330 nodes, 157,702 edges, split `EXTRACTED 89,782 ·
   INFERRED 188 · AMBIGUOUS 67,732`. The null's precision loss (0.413 against
   grep's 0.670) has **no named cause anywhere in the record**; unresolved name
   collisions are one, and a worked instance is
   `derive_playbooks.ts#discoverTurboGenerators --calls--> LruCache::set`,
   resolving across three unrelated files.
2. **Statically resolvable identifier references produce no edge at all.**
   `extract.ts` emits `calls` edges only from `call_expression`
   (`:182,194,209,226,401,414,426`) and carries no identifier-reference case, so
   `const registry = { foo: handleFoo }` yields no edge to `handleFoo`.
   `ADR-124` frames this as *"a category limit, not a bug"*; that framing is
   correct for genuinely dynamic dispatch and wrong for this half, which needs
   no inference.

**A third defect is a disagreement between code and contract.**
`src/scripts/_lib/auto_dispatch.ts:132` and `:137` route the `definition` and
`references` lookup classes to `primitive: 'code-graph-query'` unconditionally.
`src/agent-src/contexts/execution/auto-dispatch-classification.md:227-228` says
the primitive is capped `rg`, with a code-graph query *"only as an opportunistic
accelerant"* gated on a setting, and `:235` calls its own clause *"inert
today"*. One of the two is wrong. Per
[`fix-what-you-see`](../../src/rules/fix-what-you-see.md), that is fixed or it
is a tracked follow-up; it is tracked here.

## Prevented — five premises that did not survive re-derivation

Recorded rather than silently dropped, because the bundle's own sequencing rests
on three of them.

| The bundle's premise | What HEAD says |
|---|---|
| Flip `code_graph.enabled` to switch the engine on | The key is **`hooks.code_graph.enabled`** (`agent-settings.template.yml:1220` → `:1344-1345`) and its only reader is `src/scripts/hooks/code_graph_nudge_hook.ts`, a PreToolUse **nudge**. `./agent-config code-graph detect` runs to completion with the flag `false`. The engine is unconditional; what is off is a reminder. |
| Overturn `ADR-124`'s permanence | `ADR-124:235-247` **already retracted it**: *"a category limit is a fact about today's extractor, not about all possible ones."* Its reopen condition is a TS extractor emitting arrow-function symbol nodes at PHP-comparable density — which the repair met. Invoke the ADR; do not reverse it. |
| Overturn the harvest freeze | `ADR-211` § Amendment A: *"All three are satisfied as of 2026-08-05, so the freeze is lifted in full."* The lock is gone. |
| A union-merge driver for the graph file solves `road-to-merge-surface-zero` | That roadmap's conflicting population (`later/road-to-merge-surface-zero.md:127-137`, `:191-195`) contains no graph file, and the native cache is gitignored at `.gitignore:190`. `ADR-241` rejects `merge=union` for this class and names a `.gitattributes` union entry on a gate-read path as **a bypass, not a reopen**. Cut. |
| A persistent store is new foundation work | `src/scripts/code_graph/sqlite_store.ts` ships a derived SQLite twin under `ADR-129`; `_lib/lexical_index.ts` ships dependency-free BM25 and trigram ranking; `claim:lexical-ranking-lift` and `claim:second-brain-recall-lift` are both `backed`. |

## Non-goals — stated so the next bundle does not re-propose them

- **A resident service, watcher, or daemon.** `ADR-124:109-110` prohibits Class B
  in core and the Class-A termination clause forbids in-memory state spanning CLI
  invocations; `claim:no-runtime-daemon` (`docs/CLAIMS.md:104-108`) is `backed`;
  `docs/contracts/no-runtime-boundary.md:39` says the same. Reversing that set is
  owner-reserved and is registered as a decision in
  `road-to-inbox-harvest-2026-08-f-owner-decision-queue.md` step 2.2, not planned
  here.
- **An AC-owned incremental index.** `later/road-to-ac-deep-capabilities.md:112-115`
  states it is not built in that workstream and may only be proposed for gaps a
  benchmark proves adapters cannot serve.
- **A second provider contract.** That roadmap's Workstream A owns the contract
  and the adapter ladder, and `:279` records that it was deliberately re-anchored
  onto `src/skills/code-intelligence/SKILL.md` and
  [`external-code-graph-interop`](../../src/rules/external-code-graph-interop.md)
  *"because a parallel contract would duplicate a shipped surface."*
- **Making graph consumption mandatory in workflows.**
  `agents/roadmaps/skipped/road-to-code-graph-orchestration.md` is a prior attempt
  at exactly that, already skipped. Read its skip reason before re-proposing.

## Phase 1 — close the two measurable extraction gaps

- [ ] **1.1 Give `AMBIGUOUS` edges a recorded cause and a number.**
      Classify the 67,732 unresolved edges at HEAD by why they did not resolve —
      same basename across files, method name without a receiver type, import
      alias — and publish the breakdown as an evidence file. This is a
      measurement step, not a fix: it decides whether 1.2 is worth doing.
      verify: an evidence file under `agents/evidence/analysis/` carries the
      class breakdown, and the command that produced it, and the totals sum to
      the build's own `AMBIGUOUS` count.

- [ ] **1.2 Resolve the class that 1.1 shows is largest, or record why not.**
      Scope is one class, not all of them, and the null route is a legitimate
      finish: if the largest class needs type information the extractor does not
      have, say so and stop.
      verify: a rebuild reports a lower `AMBIGUOUS` count with `EXTRACTED`
      unchanged or higher, and the worked false positive
      `discoverTurboGenerators --calls--> LruCache::set` no longer resolves
      across three files — or the step closes with the recorded reason.

- [ ] **1.3 Emit edges for statically resolvable identifier references.**
      `const registry = { foo: handleFoo }` currently produces none. Add the
      identifier-reference case to the extractor for the shape that needs no
      inference, and leave genuinely dynamic dispatch alone.
      verify: a fixture outside the tracked tree containing a static registry
      literal produces an edge from the registry to the referenced symbol, and
      the repository build's `EXTRACTED` count rises with no rise in
      `AMBIGUOUS`.

## Phase 2 — make the routing and the contract agree

- [ ] **2.1 Decide which of the two is right, and change the other.**
      Either `auto_dispatch.ts:132,137` should be conditional on the setting the
      contract names, or `auto-dispatch-classification.md:227-235` should stop
      describing a gate that the code does not apply and stop calling its own
      clause inert. Do not change both to a third thing.
      verify: the routing behaviour and the contract text state the same rule,
      and a test pins whichever one is now normative.

## Phase 3 — re-measure, or name the blocker

- [ ] **3.1 Re-run the benchmark on the current build.**
      This is the archived extractor-defect roadmap's unfinished half. It is
      gated on `b-bench-inputs-absent` below; if that blocker resolves, this
      step runs unedited — no threshold is renegotiated after the repair.
      verify: `internal/bench/reports/code-graph-vs-grep.{md,json}` carries a
      second run with its own date, and the delta against the 2026-07-28 figures
      is stated whichever direction it goes.

- [ ] **3.2 Correct every document that still asserts a permanence the record retracted.**
      Eight surfaces: `docs/CLAIMS.md:423` and `:426-427`; `docs/proof.md:54`
      (generated — regenerate with `build_proof` in the **same** change or the
      drift guard reds); `docs/MIGRATION.md:20`, whose removal commitment was
      withdrawn on 2026-08-15; `agent-settings.template.yml:1330-1335`;
      `auto-dispatch-classification.md:227-228` and `:235`; `ADR-124:229`;
      `src/scripts/surface-tiers.yml:38`; and the three places that describe the
      nudge flag as an engine switch — `docs/settings-reference.md:143`,
      `src/server/schemas/settings.ts:524-528`,
      `docs/contracts/settings-classes.md:560`.
      verify: `grep -rn 'permanent'` over those paths returns only sentences that
      also state a reopen condition, and `./scripts-run src/scripts/check_claims`
      is green.

- [ ] **3.3 Record who owns the consumer-reachability decision.**
      The ABI-locked parser pair sits in `devDependencies`
      (`package.json:112,117`), which npm does not install for consumers, so no
      consumer can reach the engine whatever any flag says. The demotion is
      recorded in a script comment
      (`src/scripts/check_dependency_floors.ts:50-54`) and in no decision record,
      and no roadmap owns re-promoting it. Write the decision down — including
      the answer "it stays a devDependency, and the engine is maintainer-only" if
      that is the answer.
      verify: a decision record or an ADR states the packaging choice, its ~51 MB
      cost, and the condition under which it is revisited.

## Blockers

### b-bench-inputs-absent — the harness cannot run here

- **Status:** open
- **Owner:** maintainer
- **Blocks:** 3.1
- **What to do:** pick exactly one — (a) supply the three SHA-256-pinned question
  files under `agents/tmp/bench-local/` and local clones of the three benchmark
  repositories, and run the harness unedited; or (b) re-pre-register a smaller
  benchmark against corpora this repository already contains, accepting that its
  numbers are not comparable to the 2026-07-28 run and saying so in
  `docs/CLAIMS.md`; or (c) mark `claim:code-graph-retrieval-null` as measuring a
  superseded build, leave the figures untouched, and make no new claim.
- **Resolved when:** one of the three is recorded, and if it is (c),
  `docs/CLAIMS.md:423` says which commit the figures describe.
- **Recommendation:** (a) — it is the only option that answers the question the
  repair raised, and the inputs are pinned rather than lost. (c) is the honest
  fallback and is strictly better than leaving a stale verdict unqualified.
- **If you do nothing:** the package keeps publishing a `backed` claim whose
  measurement predates the fix it blames, which is the exact defect
  `road-to-published-number-truth` exists to stop, on a surface that roadmap's
  population does not reach.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 1 lands and the verdict still cannot be re-measured | implementation | 1.1–1.3 improve the extractor while `b-bench-inputs-absent` stays open, so the package ends with a better graph and the same stale published number — the exact state this roadmap was written to end. | 3.2 is independent of the blocker and corrects the wording regardless; option (c) of the blocker is a complete, honest finish that needs no inputs. | Phase 3 — re-measure, or name the blocker |
| 2 | The re-run comes back worse and the thresholds get renegotiated | product | A second null is a legitimate outcome, and the temptation after a repair is to adjust what counts as a pass. | 3.1 states the run is unedited and the delta is reported in whichever direction it goes; the pre-registration is already committed and is not reopened by this roadmap. | Phase 3 — re-measure, or name the blocker |
| 3 | Phase 1 is read as authorisation for the fabric the bundle proposed | implementation | An extractor improvement is mistaken for a mandate to build the service, the index and the mandatory workflow consumption the bundle asked for. | § Non-goals names all four with the instrument that forbids each, and the owner-reserved ones are registered as decisions in the sibling roadmap rather than assumed. | Phase 1 — close the two measurable extraction gaps |

## Acceptance Criteria

- [ ] AC-1 — the `AMBIGUOUS` edge population carries a published cause
      breakdown, and the largest class is either resolved or recorded as
      terminal with its reason.
- [ ] AC-2 — a statically resolvable identifier reference produces an edge, and
      the repository build shows it without a rise in `AMBIGUOUS`.
- [ ] AC-3 — `auto_dispatch.ts` and `auto-dispatch-classification.md` state the
      same rule, and a test pins the normative one.
- [ ] AC-4 — no shipped document asserts that the code-graph setting is
      permanent without also stating its reopen condition, and `check_claims` is
      green.
- [ ] AC-5 — `claim:code-graph-retrieval-null` either carries a second
      measurement or states which commit its figures describe.
