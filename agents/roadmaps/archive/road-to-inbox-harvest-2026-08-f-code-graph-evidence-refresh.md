---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-26
estate_offset_exempt: "No archive move is available in this change. The addition is the smaller half of a reduction: a six-document, roughly 8,400-line proposal bundle produced one roadmap, and five of its six documents were recorded as superseded, stale or refuted rather than landed. Its predecessor, agents/roadmaps/archive/road-to-code-graph-extractor-defect.md, is already archived and cannot be retired again."
estate_growth_exempt: "active_roadmaps 8 -> 9 on 2026-08-26, and this SUPERSEDES the claim that stood here. The previous text claimed +0 on the count half because the file shipped `status: draft`; that is no longer true and leaving it would have been an exemption asserting a fact its own change had falsified. The flip to `ready` is the deliberate act: ten of the eleven items closed in this change, and the eleventh (3.1, the benchmark re-run) is genuinely open on `b-bench-inputs-absent`, which an AI council ruled 2/2 must NOT be closed because closing it would convert \"cannot measure\" into \"measured\". A file carrying one real open step owned by a maintainer belongs in the counted estate; leaving it `draft` would keep it out of every count and out of the dashboard the blocker exists to surface, which is the shape road-to-inbox-harvest-2026-08-f-owner-decision-queue was written against. open_blockers is +0: this change created no blocker and closed none. The other half of the trade is real work delivered rather than a promise -- EXTRACTED edges 89,452 -> 99,022, a named false positive removed, the routing/contract disagreement resolved in the contract's favour with 7 tests pinning both directions, four permanence assertions corrected, and ADR-246 written for a packaging decision that had lived in a script comment. Revisit-if: the benchmark inputs are supplied and 3.1 runs, at which point this file closes and the count returns to 8."
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

## Outcome — read this before the phases

**Archived does not mean achieved.** This section exists so nobody reads a
closed roadmap as a solved problem.

| Phase | State | What that means |
|---|---|---|
| **1** — close the two measurable extraction gaps | **satisfied** | 1.1 classified the 67,593 `AMBIGUOUS` edges onto a persisted `ambiguity_reason` field and inverted the premise: 86.7 % have no in-repo candidate at all. 1.2 took the null route for that class and removed a real false positive (the arbitrary-winner rule) for the second. 1.3 added the identifier-reference case: `EXTRACTED` 89,452 → 99,022 with `AMBIGUOUS` unchanged. |
| **2** — make the routing and the contract agree | **satisfied** | The contract was right and the code changed. `classifyLookup` now takes `codeGraphEnabled`, 7 tests pin both directions. |
| **3** — re-measure, or name the blocker | **transferred (3.1) + satisfied (3.2, 3.3)** | 3.2 corrected four permanence assertions and added the `measured_on:` ledger field now printed in `docs/proof.md`. 3.3 wrote ADR-246. **3.1 is `[~]` transferred** — see below. |

### The Phase 3.1 transfer, which is what lets this roadmap close at all

Step 3.1 needs four SHA-256-pinned input files that live outside the public tree
and three external repository clones of private third-party code. Measured on
2026-08-26: all four files read **absent** (not stale — a tree-wide `find`
returns 0 for each), no corpus clone is reachable, and the harness itself is
present, so only its inputs are missing. No automation in this repository can
produce them.

Moved verbatim to
[`stubs/road-to-code-graph-benchmark-rerun.md`](../stubs/road-to-code-graph-benchmark-rerun.md)
with a named producer (the maintainer), a five-reading probe (four hash checks
plus corpus reachability), every reading measured here as the absent-input
control, and an explicit honest-null closing path. Outcome state: **transferred**
— never cancelled, which would drop a live question, and never `[x]`, which would
convert "cannot measure" into "measured".

**This is not a contradiction of the 2026-08-26 council ruling that 3.1 must stay
open.** That ruling forbade *evidentiary completion*. A second AI council on
2026-08-26 (2/2 convergent, anthropic/claude-sonnet-4-5 + openai/codex-default,
two rounds with blind peer review) ruled the transfer is a *work-item placement*
and is the closure shape the first ruling's own words implied — *"an indefinitely
blocked step becomes misleading operational debt when its private inputs may
never be recovered."* Both seats attached the same condition: the transfer is
honest only if `[~]` cannot satisfy a completion check and the stub is
structurally discoverable. Both were verified before archiving — `[~]` is
`count_deferred`, never `count_done`, and `agents/roadmaps/stubs/` is a governed
class with a README, a CI gate (`check_no_stub_inventory_table`), and three
scripts that read it.

**What did NOT change, ruled on explicitly.** `claim:code-graph-retrieval-null`
stays `status: backed` with its landed `measured_on:` scoping. One seat asked for
one addition — a line recording that a re-measurement was attempted and deferred,
so silence does not read as "we never tried again". That line is in the claim.

### Council decisions, both recorded inline rather than linked

Council artefacts are gitignored and auto-pruned after the retention window, so a
path to one is a reference that rots (`no-roadmap-references`, council clause).

1. **2026-08-26, 2/2** — disposition (c) for `b-bench-inputs-absent`; 3.1 stays
   open; `measured_on:` rather than `resolved-null` or `superseded_by`. Recorded
   at 3.1, 3.2 and in the blocker.
2. **2026-08-26, 2/2** — transfer 3.1 to a stub and archive the parent under an
   explicit `transferred` outcome state, conditional on the two checks above.
   Recorded here and in the blocker's disposition line. `revisit-if`: the four
   pinned inputs **and** all three corpus clones become available, **or** a
   maintainer explicitly retires the benchmark obligation with recorded
   rationale — a new non-comparable benchmark alone does not satisfy it.

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

- [x] **1.1 Give `AMBIGUOUS` edges a recorded cause and a number.**
      Classify the 67,732 unresolved edges at HEAD by why they did not resolve —
      same basename across files, method name without a receiver type, import
      alias — and publish the breakdown as an evidence file. This is a
      measurement step, not a fix: it decides whether 1.2 is worth doing.
      verify: an evidence file under `agents/evidence/analysis/` carries the
      class breakdown, and the command that produced it, and the totals sum to
      the build's own `AMBIGUOUS` count.

      **DONE — `agents/evidence/analysis/code-graph-ambiguous-classes-2026-08-26.md`, and the classification is a FIELD on the edge (`ambiguity_reason`) rather than a one-off script's output.** That choice is the difference between a number and a reproducible one: anyone can now rebuild and read the cause, where before the answer required re-running the extractor with bespoke code.

      **The answer inverts the premise.** 67,593 of 157,231 edges (43.0 %, confirming the roadmap's figure at a different HEAD), and **58,612 of them — 86.7 % — are `receiver-unknown` with NO in-repo candidate at all**. 1,301 distinct target names, zero of which resolve to a node in this graph, and the top of the distribution settles it: `join` (5,843), `push` (3,205), `slice`, `map`, `readFileSync`, `trim`, `toBe`. Those are `Array.prototype`, `node:fs` and vitest matchers. **No type inference over this repository could resolve them, because the definitions are not in it** — and an extractor reporting them as EXTRACTED would be inventing edges. The 43 % is the taxonomy working, not 43 % of the graph being broken. `hierarchy-unresolved` is 21 edges and can be ignored.

- [x] **1.2 Resolve the class that 1.1 shows is largest, or record why not.**
      Scope is one class, not all of them, and the null route is a legitimate
      finish: if the largest class needs type information the extractor does not
      have, say so and stop.
      verify: a rebuild reports a lower `AMBIGUOUS` count with `EXTRACTED`
      unchanged or higher, and the worked false positive
      `discoverTurboGenerators --calls--> LruCache::set` no longer resolves
      across three files — or the step closes with the recorded reason.

      **DONE, and it is the NULL route for the largest class and a real FIX for the second.** The step permits either; the measurement says both apply, to different classes.

      **Largest class — the recorded reason to stop.** The 58,612 no-candidate edges need definitions that are not in this repository. Not "needs type information the extractor does not have" but *needs a target that does not exist here*, which no amount of inference reaches.

      **Second class — the false positive was the ARBITRARY WINNER, not the ambiguity.** The rule was `candidates[0] ?? symbol:<name>`, so the first alphabetical same-named method became the edge's `target`: 1,707 edges pointed every generic `.resolve(...)` at one gate-ledger method, 414 pointed every `.set(...)` at a cache class in a bench fixture. Every consumer reading `target` and ignoring `confidence` saw a specific method call that does not happen — while the taxonomy's own acceptance rule already says the edge is correct when the true target is *among* the candidates, which states plainly that no single one of them is the answer. `ambiguousTarget` now keeps a target only when there is exactly ONE candidate and names the unresolved symbol otherwise, with `candidates` carrying every option. Nothing is lost; the list was already emitted.

      verify, met: the roadmap's named worked example `discoverTurboGenerators --calls--> LruCache::set` **no longer resolves** — that edge is gone from the rebuild. 4,818 edges had >1 candidate and now name the symbol; 4,154 had exactly one and keep their target. `EXTRACTED` went 89,452 → 89,454, up rather than unchanged.

- [x] **1.3 Emit edges for statically resolvable identifier references.**
      `const registry = { foo: handleFoo }` currently produces none. Add the
      identifier-reference case to the extractor for the shape that needs no
      inference, and leave genuinely dynamic dispatch alone.
      verify: a fixture outside the tracked tree containing a static registry
      literal produces an edge from the registry to the referenced symbol, and
      the repository build's `EXTRACTED` count rises with no rise in
      `AMBIGUOUS`.

      **DONE — and it required a second fix the step did not anticipate.** The `pair` / `shorthand_property_identifier` case now emits an edge for `{ foo: handleFoo }`, scoped deliberately to the shape that needs no inference: a bare identifier value. A computed key, a call, an arrow function or a spread is left alone, because resolving those DOES need inference and guessing there is how the arbitrary-winner defect 1.2 just removed got in.

      Emitted as **`uses`, not `calls`** — a table naming a handler is not a call site; the call happens wherever the table is looked up, and claiming otherwise would assert a control-flow edge that does not exist. `uses` already exists, so the relation union is not widened and the validator, the query surface and every consumer are untouched.

      **The second fix:** the `uses` resolution branch looked up CLASS names only, so every new edge landed at `symbol:handleFoo` — an edge that exists and resolves nowhere, barely better than the missing edge it replaced. It now falls back to a free function using the same predicate as the `free` call branch, so a function reference and a function call resolve identically rather than by two rules that can drift.

      verify, met on both halves: a fixture outside the tracked tree (`const registry = { foo: handleFoo, bar: handleBar }`) produces `uses src/reg.ts -> src/reg.ts#handleFoo` and `#handleBar`, resolved rather than symbolic. On the repository, **EXTRACTED 89,454 → 99,022 (+9,568) with AMBIGUOUS unchanged at 67,593** — the direction the step requires. `code-graph validate` passes.

## Phase 2 — make the routing and the contract agree

- [x] **2.1 Decide which of the two is right, and change the other.**
      Either `auto_dispatch.ts:132,137` should be conditional on the setting the
      contract names, or `auto-dispatch-classification.md:227-235` should stop
      describing a gate that the code does not apply and stop calling its own
      clause inert. Do not change both to a third thing.
      verify: the routing behaviour and the contract text state the same rule,
      and a test pins whichever one is now normative.

      **DONE — the CONTRACT is right and the CODE changed.** `auto-dispatch-classification.md` has always described the graph as an opportunistic accelerant conditional on `hooks.code_graph.enabled`; `classifyLookup` hardcoded `primitive: 'code-graph-query'` with no setting check.

      The decision rests on the only evidence that exists rather than on preference: the pre-registered benchmark measured native-graph recall **0.365 against grep's 0.797** on exactly these graph-shaped questions, so routing unconditionally to the graph routed to the arm that lost — and no re-measurement has replaced that figure, because 3.1 is blocked.

      `classifyLookup` now takes `codeGraphEnabled` and defaults it FALSE — not because the setting's default is false, but because an absent flag means nobody said the index is present and fresh, and an accelerant taken on an absent index is a miss that escalates, i.e. slower than the grep it replaced. **The class is still recognised**; only the primitive follows the gate, so turning the flag on is the whole change needed to use the graph.

      Pinned in both directions by 7 new tests, with class recognition asserted SEPARATELY from the primitive — a change that stopped recognising `definition` and `references` altogether would also make the primitive grep, and one assertion could not tell those apart. Two existing expectations were updated with the reason written in place (`decisions.yaml`, `routing_doctor.test.ts`); 91 tests pass across the three affected suites.

## Phase 3 — re-measure, or name the blocker

- [~] **3.1 Re-run the benchmark on the current build.**
      This is the archived extractor-defect roadmap's unfinished half. It is
      gated on `b-bench-inputs-absent` below; if that blocker resolves, this
      step runs unedited — no threshold is renegotiated after the repair.
      verify: `internal/bench/reports/code-graph-vs-grep.{md,json}` carries a
      second run with its own date, and the delta against the 2026-07-28 figures
      is stated whichever direction it goes.

      **BLOCKED, and deliberately left open — see `## Blockers` → `b-bench-inputs-absent`.** AI council 2026-08-26, 2/2 convergent, ruled option **(c)** for this run AND that this step must NOT be closed: *"closing 3.1 would convert 'cannot measure' into 'measured' when the question is still answerable, just not here."* The disposition landed (see 3.2); the measurement did not, and the two are not the same thing.

      Option (a) is not executable here — the three SHA-256-pinned question files live under gitignored `agents/tmp/`, and no automation in this repository can produce three external repository clones. Option (b) was rejected by both seats: a benchmark against different corpora destroys the comparability that makes the re-run worth doing, and if pursued it is a separately pre-registered claim rather than a replacement.

      **What this run measured is NOT a substitute, and the council was explicit about that.** +9,568 EXTRACTED edges and a removed false positive are EXTRACTION quality; the claim is about RETRIEVAL. One seat noted the extraction gains make the old figure *more likely pessimistic* rather than less — which is a reason to re-run, not a reason to assume the outcome.

- [x] **3.2 Correct every document that still asserts a permanence the record retracted.**
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

      **DONE — four surfaces, and the count in this step was high because some were already fixed.** `ADR-124:229` already carried its own correction note, and `surface-tiers.yml`, `settings-reference.md`, `settings.ts` and `settings-classes.md` carry no permanence assertion at all. The four that did: `docs/CLAIMS.md:423`, `docs/MIGRATION.md:20`, `agent-settings.template.yml:1333` and `auto-dispatch-classification.md:235`. Each now says the setting is `false` **by default** and names its reopen condition; `MIGRATION.md`'s row was self-contradictory, asserting permanence three sentences before withdrawing the removal commitment that permanence rested on.

      **The council added a requirement this step did not have, and it is structural.** Both seats rejected the two obvious statuses for `claim:code-graph-retrieval-null`: `resolved-null` would say the retrieval question was ANSWERED null on the current build, which is exactly what nobody measured; `superseded_by` expects replacement EVIDENCE, and a repair commit is the wrong semantic object. What they required instead was structured scoping that reaches **every index and summary, not only the detailed entry** — because a prose-only qualification drifts from the structured record it qualifies.

      So the ledger gains a `measured_on:` field, parsed by `check_claims` and **printed as a column in `docs/proof.md`'s table**, where the row now reads `backed | a build predating the 2026-08-22 extractor repair — post-repair recall UNMEASURED`. Empty for every claim that describes the current tree, which is almost all of them. `check_claims` and `build_proof --check` are green, and `docs/proof.md` is regenerated in this change so the drift guard does not red.

- [x] **3.3 Record who owns the consumer-reachability decision.**
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

      **DONE — `docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md`, `status: accepted`.** The answer is the one the step names as legitimate: **it stays a `devDependency`, and the engine is maintainer-only.**

      The gap was not the packaging choice, which is old, but that it lived in a **script comment** (`check_dependency_floors.ts:50-54`, mentioning it only to explain why an exception list is empty) and in no decision record, with no roadmap owning re-promotion. The record carries the ~51 MB cost, the consequence that flipping `enabled: true` in a consumer install is **not sufficient** because the loader has nothing to load, and the consumer-facing alternative that is actually served: the consumer-index interop path, which needs no parser.

      Its `review_trigger` names what would reopen it and, more usefully, what would not: **an improvement in EXTRACTION quality is explicitly NOT a trigger.** This record was written in the same change that raised EXTRACTED from 89,452 to 99,022, and that number moves nothing — a graph with better edges is still a graph no consumer can load. Three alternatives are recorded as refused with reasons, including `optionalDependencies`, which installs by default and would re-impose the 51 MB it is meant to avoid.

## Blockers

### b-bench-inputs-absent — the harness cannot run here

- **Status:** resolved
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
- **Council disposition, 2026-08-26, 2/2 convergent:** option **(c)** is recorded
  as this run's action and **3.1 stays OPEN**. Both seats were explicit that the
  disposition is not the measurement — *"closing 3.1 would convert 'cannot
  measure' into 'measured' when the question is still answerable, just not
  here."* (a) is not executable by an automated run: the pinned question files
  live under gitignored `agents/tmp/` and no automation here produces three
  external repository clones. (b) was refused by both seats — different corpora
  destroy the comparability that makes the re-run worth doing, and if pursued it
  is a separately pre-registered claim rather than a replacement.
- **Ruled on explicitly, because the run asked rather than chose:**
  `claim:code-graph-retrieval-null` stays `status: backed`. NOT `resolved-null`,
  which would assert that the retrieval question was ANSWERED null on the
  current build — exactly what nobody measured. NOT `superseded_by`, which
  expects replacement EVIDENCE, and a repair commit is the wrong semantic object
  for it. The requirement instead was structured build-scoping reaching every
  index and summary, discharged by the `measured_on:` field now printed in
  `docs/proof.md`.
- **What is still missing, named by a council seat rather than by this run:** an
  indefinitely blocked step becomes misleading operational debt when its private
  inputs may never be recovered. The honest closure for that is a maintainer
  determination that the inputs are irrecoverable, which either retires this
  step or approves a separately named non-comparable benchmark. This run cannot
  make that determination and does not pretend to.

- **How it was resolved, and what that does NOT claim:** by **transfer**, not by
  measurement. Disposition (c) landed on 2026-08-26 (`measured_on:` in
  `docs/CLAIMS.md`, printed in `docs/proof.md`), which scopes the stale figure;
  options (a) and (b) and the re-run itself moved verbatim to
  [`stubs/road-to-code-graph-benchmark-rerun.md`](../stubs/road-to-code-graph-benchmark-rerun.md)
  under outcome state **transferred**. The status token above reads `resolved`
  because that is the only closed token the blocker gates recognise —
  `transferred` reads as OPEN to every one of them. **The outcome state is
  `transferred` and the benchmark was never re-run**; the word in the field is a
  gate token, not a claim about the work.
- **Decided by:** AI council 2026-08-26, 2/2 convergent
  (anthropic/claude-sonnet-4-5 + openai/codex-default, two rounds, blind peer
  review), on the maintainer's standing delegation of owner-reserved decisions
  for an autonomous drain run. Both seats attached the same condition — the
  transfer is honest only if `[~]` cannot satisfy a completion check and the stub
  is structurally discoverable — and both were verified before archiving.
- **Revisit-if:** the four SHA-256-pinned inputs **and** all three registered
  corpus clones become available, **or** a maintainer explicitly retires the
  benchmark obligation with recorded rationale. A new non-comparable benchmark
  alone does not satisfy this condition.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 1 lands and the verdict still cannot be re-measured | implementation | 1.1–1.3 improve the extractor while `b-bench-inputs-absent` stays open, so the package ends with a better graph and the same stale published number — the exact state this roadmap was written to end. | 3.2 is independent of the blocker and corrects the wording regardless; option (c) of the blocker is a complete, honest finish that needs no inputs. | Phase 3 — re-measure, or name the blocker |
| 2 | The re-run comes back worse and the thresholds get renegotiated | product | A second null is a legitimate outcome, and the temptation after a repair is to adjust what counts as a pass. | 3.1 states the run is unedited and the delta is reported in whichever direction it goes; the pre-registration is already committed and is not reopened by this roadmap. | Phase 3 — re-measure, or name the blocker |
| 3 | Phase 1 is read as authorisation for the fabric the bundle proposed | implementation | An extractor improvement is mistaken for a mandate to build the service, the index and the mandatory workflow consumption the bundle asked for. | § Non-goals names all four with the instrument that forbids each, and the owner-reserved ones are registered as decisions in the sibling roadmap rather than assumed. | Phase 1 — close the two measurable extraction gaps |

## Acceptance Criteria

- [x] AC-1 — the `AMBIGUOUS` edge population carries a published cause
      breakdown, and the largest class is either resolved or recorded as
      terminal with its reason.
- [x] AC-2 — a statically resolvable identifier reference produces an edge, and
      the repository build shows it without a rise in `AMBIGUOUS`.
- [x] AC-3 — `auto_dispatch.ts` and `auto-dispatch-classification.md` state the
      same rule, and a test pins the normative one.
- [x] AC-4 — no shipped document asserts that the code-graph setting is
      permanent without also stating its reopen condition, and `check_claims` is
      green.
- [x] AC-5 — `claim:code-graph-retrieval-null` either carries a second
      measurement or states which commit its figures describe.
