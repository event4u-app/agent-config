---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
relates: []
# relates: manual sweep over agents/roadmaps/**/*.md on 2026-09-04 for
# `code_graph`, `extract.ts`, `EXTRACTED`, `code-graph` — the two code-graph
# stubs are both closed (benchmark-rerun CLOSED UNMET 2026-08-28,
# benchmark-v2-registration DISCHARGED 2026-08-29) and no open roadmap or stub
# owns the extractor.
estate_offset_exempt: "Cannot be offset. All ten active roadmaps are unstarted — six landed 2026-09-04 in PR #1839, three on 2026-09-03, and the tenth is a carrier a recorded verdict forbids closing — so there is nothing to archive that would not be archiving unfinished work. The subject is also disjoint from every one of them: none touches src/scripts/code_graph."
estate_growth_exempt: "Adds one active roadmap against a floor of 10. It repairs a shipped surface that emits a FALSE edge at EXTRACTED confidence — the label the code-intelligence skill tells agents to read as syntactic fact — reproduced on this repository's own source. The four defects are internal to two files and need no new provider, no dependency change and no benchmark. Parking it leaves an agent-facing instrument confidently wrong in four of eleven files of its own codebase."
---
# Road to the graph that lies confidently

> **Source:** `agents/tmp.old/inbox-2026-09-f/` — a proposal round on code
> intelligence, comparing this repository against two external references
> (anonymised as S1 and S2 per
> [`source-confidentiality`](../../src/rules/source-confidentiality.md)). The
> proposal's measurement was **re-run here** before this file was written; every
> number below is from that run, not from the proposal.

## Goal

The code graph stops emitting edges that are wrong at `EXTRACTED` confidence,
stops spending two-thirds of its edge budget on built-in method names, and can
answer a `references` question about a `const`, a `type` or an `interface` — the
three shapes its own v2 benchmark asked about and scored 0.333 recall on.

## Reproduced, on this repository's own source

Built with the shipped CLI over the roots the v2 benchmark used:

```
$ ./scripts-run src/scripts/code_graph/cli build --root src/scripts/code_graph
✅  code-graph built — 11 files · 97 nodes · 660 edges
    edges: EXTRACTED 403 · INFERRED 0 · AMBIGUOUS 257
```

| Observation | Measured | Where the cause is |
|---|---|---|
| node kinds present | `function` 86, `file` 11 — **nothing else** | `extract.ts:308-320` |
| edges to `symbol:` pseudo-nodes | **414 of 660 = 63 %** (`push` 20, `get` 17, `has` 14, `join` 14, `map` 12 …) | `extract.ts:452-470`, `build.ts:288-299` |
| file→file edges | **0** | `extract.ts:254-267` |
| node for `EXT_LANG` | **none**; only `build.ts → symbol:EXT_LANG` | consequence of the row above |

### The defect that matters most — a false edge at the highest confidence

```
build.ts  -imports->  query.ts#path   [EXTRACTED]
cli.ts    -imports->  query.ts#path   [EXTRACTED]
detect.ts -imports->  query.ts#path   [EXTRACTED]
loader.ts -imports->  query.ts#path   [EXTRACTED]
```

Each of those four files opens with `import * as path from 'node:path'`.
`build.ts:102,150,230-237` resolves an import name through a repo-wide
`byName.get(k(lang, name))` table — no scope, no import binding — and the
repository's own `path()` function in `query.ts` is the only `path` in that
table. So the node module becomes the local function, in **4 of 11 files**.

`EXTRACTED` is not a hedge. The skill defines it as *"syntactic fact"*
(`src/skills/code-intelligence/SKILL.md:53-56`) and instructs the reader to trust
it, reserving `AMBIGUOUS` for candidates. A wrong edge wearing that label is
worse than a missing one, and it is the precision loss the v2 benchmark recorded
as grep out-precising the graph on `callers` (0.611 vs 0.667 is the tie; the
mechanism is here).

### Why the other three matter

- **No `const` / `type` / `interface` / `enum` nodes.** `extract.ts:316-317`
  states the decision in its own words: *"A `const x = 3` is data, not a symbol
  this graph answers questions about"* — and the v2 corpus asks exactly that
  (`EXT_LANG`, `SettingsClass`, `SETTINGS_CLASSES`). That is the named mechanical
  cause of `references` recall **0.333** against grep's 1.000.
- **The module specifier is discarded.** `extract.ts:254-267` reads only the
  import clause's identifiers and pushes `baseName(nm)`; `from './types.js'` is
  never read. Nothing binds "the `X` in this file" to "the `X` declared in *that*
  file", which is why there are zero file→file edges and why impact-over-imports
  is structurally impossible rather than merely weak.
- **63 % of the edge budget is `.push()` and `.get()`.** `explain` spends its
  budget on `symbol:push`. The `AMBIGUOUS` share of 39 % reads as honesty about
  dynamic dispatch; measured, roughly two thirds of it is built-in method noise.

## What this roadmap is NOT

Stated because the proposal it came from is much larger and adopting it whole
would be the failure this repository has recorded before.

- **Not a new provider.** No SCIP, no LSP, no tsserver, no compiler. The
  proposal's own consolidation finding says it too: *"kein einziger der
  gemessenen NULL-Fälle braucht Compiler-Präzision"*.
- **Not a change to ADR-246**, and not a reopen of it. That record
  (`code-graph-parsers-stay-devdependencies`, accepted 2026-08-26) is
  `status: accepted`. It carries two reopen triggers and **names this exact
  work as not being one of them**: *"Explicitly NOT a reopen trigger: an
  improvement in EXTRACTION quality"* (`:28-31`, repeated `:237`). Its first
  trigger was evaluated against the v2 run on 2026-08-29 and **did not fire**
  (0/4 classes, `:212-217`); the live one is a consumer-named case, which this
  round does not have. The proposal's step 0.1 wants the record superseded so
  the parsers move to runtime dependencies — a ~51 MB consumer cost that
  ADR-246 `:85-91` already examined and rejected, and which the owner directive
  it cites says nothing about. **All four defects above are fixable without
  touching it**: the engine builds in this tree today.
- **Not a plan over an old measurement.** ADR-225 (accepted 2026-08-12) settled
  a structurally identical round — an external comparison, a seven-phase plan,
  four of seven claims falling on re-measurement — and locked it:
  *"Reopens on new retrieval evidence, never on a new plan over the same
  measurement"* (`:108-109`). None of the three proposal files cites it. This
  roadmap clears the lock the only way it can be cleared: the § Reproduced table
  above is **new evidence, taken here**, not a re-reading of the v2 report.
- **Not a port of external code.** The owner's words were *"wir könnten ihn sogar
  kopieren"* — a hypothetical framing a question, not a licence grant.
  [`code-provenance`](../../src/rules/code-provenance.md) applies unchanged: read,
  close the source, re-derive.
- **Not a default flip.** The engine stays where the v2 result left it. Whether
  these repairs change any benchmark class is Phase 4's question, and its honest
  answer may be no.

## Phase 0 — The skill contradicts itself, twice

Found while verifying the proposal, and belonging to none of it.
`src/skills/code-intelligence/SKILL.md` carries the retracted claim in its own
body and the retraction ninety lines below it:

| line | text |
|---|---|
| `:16-18` | *"a code-graph answers **far more precisely than a blind `grep`**"* |
| `:109-114` | *"`external-code-graph-interop` used to open by saying a committed index answers 'far more precisely than a fresh `grep`'. That was never measured, and when it was, it was false"* |

The correction was applied to the **rule** and not to the **skill** that carries
the same sentence. And the frontmatter compounds it: `description:` reads *"Route
codebase-structure questions … to a code-graph first, grep fallback"* against
`:116` **"No class is graph-first."** The description is the routing surface an
agent actually sees, so the contradicted half is the half that travels.

- [ ] **0.1 Apply the retraction where the claim still lives.** The body sentence
      at `:16-18` says what `:109-114` withdraws. Replace it with the reason that
      survived measurement — an index that exists is cheap to ask and structured
      — rather than deleting the paragraph.
      verify: `grep -c 'far more precisely' src/skills/code-intelligence/SKILL.md`
      is 1, and the remaining hit is inside the retraction paragraph that quotes
      it.
- [ ] **0.2 Make the description agree with the measurement.** `description:`
      promises graph-first routing that `:116` denies.
      verify: the description no longer promises an ordering the body refutes,
      and its length stays inside the skill-description budget the estate ratchet
      measures.

## Phase 1 — The false edge

- [ ] **1.1 Bind an import name to the module it came from.** Read the module
      specifier at `extract.ts:254-267` and carry it on the edge, so resolution
      can ask "which file did this name come from" instead of consulting a
      repo-wide table. A namespace import (`import * as path`) resolves to an
      external module and must not match a local symbol at all.
      verify: rebuild over `src/scripts/code_graph`; zero edges named
      `*.ts -imports-> query.ts#path`, and the four namespace imports resolve to
      an external target or to none.
- [ ] **1.2 A name that cannot be bound does not get `EXTRACTED`.**
      `build.ts:102,150,230-237` labels a global-table hit as a syntactic fact.
      Where the binding came from a repo-wide name lookup rather than from a
      resolved specifier, the edge is at most `INFERRED` — the class that exists
      for exactly this and currently carries **0** edges.
      verify: the rebuild reports a non-zero `INFERRED` count, and no edge whose
      target was resolved by name alone is labelled `EXTRACTED`.
- [ ] **1.3 Pin the false edge as a test.** A fixture with a namespace import of
      a node builtin whose base name collides with a local function.
      verify: the test fails when 1.1 is reverted. A test never seen red has
      unknown sensitivity.

## Phase 2 — The nodes the questions ask about

- [ ] **2.1 Emit nodes for `const`, `type`, `interface` and `enum`.** The
      comment at `extract.ts:316-317` is a decision, and the v2 benchmark
      falsified it: the corpus's `references` questions name a const and a type.
      Replace the comment with what is now known, rather than deleting it —
      a reversed decision whose reason disappears gets re-taken.
      verify: `EXT_LANG` and `SettingsClass` each have a node after a rebuild
      over their roots, and the old comment's text is replaced by the correction.
- [ ] **2.2 Report the node-count change as a finding either way.** More nodes is
      not the goal; answering the question is. If the count rises and the
      `references` questions still return nothing, that is the result.
      verify: the before/after node and edge counts are recorded with the
      commit, and the three v2 `references` probes are re-run and their output
      quoted whichever way it lands.

## Phase 3 — The noise

- [ ] **3.1 Stop minting a pseudo-node per built-in method call.** 414 of 660
      edges point at `symbol:push` and its siblings. Either suppress the class or
      route it to one named external node per module, but do not leave two thirds
      of the graph pointing at method names.
      verify: the pseudo-node share after a rebuild is reported; a fixture asserts
      that a `.push()` call no longer produces a distinct `symbol:` target.
- [ ] **3.2 Say what the `AMBIGUOUS` share means afterwards.** It is 39 % today
      and reads as honesty about dynamic dispatch. After 3.1 the number will move
      and the skill's own text about confidence classes must match what the
      engine now emits.
      verify: `src/skills/code-intelligence/SKILL.md` states the post-change
      shares, and no sentence in it describes a distribution the engine no longer
      produces.

## Phase 4 — Re-measure, and publish the null if it is one

- [ ] **4.1 Re-run the v2 corpus unedited.** Same 19 questions, same roots, same
      pre-registered bars. No threshold is renegotiated after the repair — that
      is the discipline the closed `road-to-code-graph-benchmark-rerun` stub
      recorded verbatim before it closed unmet.
      verify: a second report exists beside
      `internal/bench/reports/code-graph-vs-grep-inrepo-v2-2026-08-29.md` with its
      own date, and the delta per class is stated in both directions.
- [ ] **4.2 Leave the default alone.** Whatever 4.1 returns, this roadmap does not
      move a shipped default; the skill's recorded *"no class is graph-first"* and
      the engine's default-off posture (ADR-124 § Falsifiability-first) stand
      until a separate decision moves them.
      verify: `git diff` over the phase touches no default, and the skill's
      no-class-is-graph-first sentence is unchanged unless 4.1 refutes it — in
      which case the change cites 4.1.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-04 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The repair is scored by node count instead of by answers | product | More nodes and fewer pseudo-edges are easy to produce and easy to mistake for progress; the v1 benchmark already published a false root cause once, and the engine has been over-read before | 2.2 requires the three `references` probes to be re-run and quoted whichever way they land, and 4.1 re-runs the whole corpus against bars fixed before the repair | Phase 4 — Re-measure |
| 2 | Downgrading name-resolved edges to `INFERRED` hides them instead of fixing them | implementation | 1.2 is a labelling change, and a wrong edge at `INFERRED` is still a wrong edge — the honest fix is 1.1, and 1.2 is the floor under it | 1.1 lands first and its verify names the four false edges specifically; 1.2's verify requires a non-zero `INFERRED` count, which is only reachable if real bindings survive | Phase 1 — The false edge |
| 3 | The phase grows into the provider ladder the proposal wanted | product | The proposal ships ten workstreams and a provider fabric; four extractor fixes sit inside it and are easy to widen back out once the file is open | § What this roadmap is NOT names the four exclusions with the record behind each, and Phase 4.2 forbids the default move that would justify the widening | Phase 2 — The nodes the questions ask about |

## Acceptance Criteria

- [ ] AC-0 — `src/skills/code-intelligence/SKILL.md` asserts no claim its own
      measurement section withdraws, and its description does not promise an
      ordering its body denies.
- [ ] AC-1 — No edge in a rebuild of `src/scripts/code_graph` binds a namespace
      import of a node builtin to a local symbol, and a test fails if that
      binding returns.
- [ ] AC-2 — No edge resolved by repo-wide name lookup alone carries
      `EXTRACTED`; the `INFERRED` class is non-empty.
- [ ] AC-3 — `EXT_LANG` and `SettingsClass` resolve to nodes, and the three v2
      `references` probes are re-run with their output recorded.
- [ ] AC-4 — The `symbol:` pseudo-node share is reported after the change, and
      the skill's confidence-class prose matches what the engine emits.
- [ ] AC-5 — The v2 corpus is re-run unedited against its original bars, the
      per-class delta is published in both directions, and no shipped default
      moved.
