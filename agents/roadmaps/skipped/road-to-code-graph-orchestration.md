---
status: skipped
complexity: medium
---

> **SKIPPED — superseded same-day (2026-07-23), never executed.** The
> maintainer reversed the "orchestrator only" premise before any step ran:
> per the embedded-engine doctrine (ADR-124, maintainer-directed), this
> suite may now natively OWN deterministic in-process engines. The successor
> `road-to-native-code-intelligence.md` carries forward every still-valid
> piece of this draft (spikes S0a/S0b, detection + interop adapter, soft
> nudge, staleness governance, injection-sanitization, honest-benchmark
> protocol) as its interop tier. Kept for traceability of the pre-registered
> thresholds the successor cites.

# Road to code-graph orchestration — make the interop rule executable, enforce query-first, benchmark honestly

> Source-level comparative sweep 2026-07-23. External reference verified at its
> upstream HEAD `2fa6cd3` (0.9.25); this repo verified at `cbc167a` (9.7.0).
> Per `source-confidentiality`, the external reference is cited as **Source G**
> below; real link retained encrypted by the maintainer
> (`ENC1:<maintainer-holds-key — insert on landing>`).
>
> **Scope correction baked in from the start:** the earlier borrow cycle
> (`road-to-opt-retrieval-and-memory`, archived) already landed Source G's
> *protocol* borrows — `EXTRACTED/INFERRED/AMBIGUOUS` edge confidence
> (`discovery_graph.ts`), BM25 + trigram lexical core (`_lib/lexical_index.ts`),
> token-budgeted retrieve envelope (`memory_lookup.ts`). This roadmap does NOT
> re-schedule any of that. It also does NOT fork Source G's engine (tree-sitter
> extraction, clustering, HTML viz) — the Layer-2 sunset and the "orchestrator,
> not a competitor" stance in `src/rules/external-code-graph-interop.md` both
> hold. What is open is everything that makes that stance *real*.

## Goal

Turn `external-code-graph-interop` from prose into a working capability:
deterministic index **detection**, a thin **query adapter** to whatever
code-graph the consumer repo ships, **staleness governance**, an opt-in
**query-first PreToolUse nudge**, a minimal **owned fallback import-map** for
the two stacks this suite actually targets — each phase default-off until the
pre-registered benchmark says it earns its place, with a published honest-null
if it does not.

## Non-goals (pinned, so the next sweep does not re-propose them)

- NO tree-sitter / AST engine in this repo. Source G ships 29 extractor
  modules across ~40 languages under Apache-2.0/MIT; it is a peer tool, wrapped
  the way `repomix-packer` wraps its upstream — optional dependency, never
  silently installed.
- NO vector store, NO embedding service, NO always-on daemon (Layer-2 sunset).
- NO LLM in any index build path. Deterministic or absent.
- NO new always-on rule weight for consumers: everything here rides existing
  trigger surfaces or is opt-in.

## Prerequisites — verified at `cbc167a` (binary-safe `grep -a`)

- PRESENT: `src/rules/external-code-graph-interop.md` (tier 2a, auto,
  triggers on "who calls" / "call graph" / `graph.json` / "scip") — prose only,
  no executable backing.
- PRESENT: PreToolUse dispatch path — `hooks/hooks.json` →
  `dispatch:hook --event pre_tool_use` → `src/scripts/hooks/dispatch_hook.ts`.
  No registered pre-tool handler does query-first redirection today.
- PRESENT: `src/scripts/discovery_graph.ts` — Edge schema with
  `EXTRACTED/INFERRED/AMBIGUOUS`, atomic versioned cache, content-addressed to
  manifest checksum. This schema is REUSED, not duplicated, by every artifact
  below.
- PRESENT: bench infrastructure (`internal/bench/`, golden corpora, judge/κ
  harness pattern from the honest-null 9.5.0 exhibit).
- ABSENT: any reader for Source G's `graph.json` output shape or SCIP; any code
  corpus in `lexical_index` scope; any staleness check tying an index to git
  HEAD; any code-token-reduction measurement.

## Provenance (anonymized)

- **Source G** (code-graph reference): pipeline
  `detect→extract→build→cluster→analyze→report→export`; query engine = BFS/DFS
  over `graph.json` with `--budget` token cap; `affected <node>` =
  relation-filtered BFS; PreToolUse soft-nudge with a strict mode that blocks
  the first raw source read per session then reverts; post-commit/post-checkout
  git hooks with the interpreter path pinned at install time; self-benchmark =
  naive corpus tokens vs avg query-subgraph tokens. License: Apache-2.0 + MIT.
  Its own published memory benchmarks (LOCOMO recall@10 0.497, LongMemEval-S
  76%) are about the *conversational-memory* suite, NOT the code suite — do not
  cite them as evidence for code-token savings; its code suite runs on a ~1M-LOC
  repo, which is not this suite's median consumer.

---

## Phase 0 — Falsification spikes (no product code, ≤1 day)

The whole roadmap dies here if the effect is null on OUR consumer shape.
Two spike scripts under `internal/spikes/code-graph/`, throwaway allowed:

- [ ] **S0a — token delta, mid-size repo.** Pick two real consumer-shaped
  repos (one Laravel PHP ~50–150k LOC, one TS ~30–100k LOC). Build Source G's
  graph out-of-band (peer CLI, no repo dependency). For a fixed set of 10
  structure questions per repo ("who calls X", "trace A→B", "what imports Y"),
  record (i) tokens of the scoped `query`/`path` output vs (ii) tokens of a
  disciplined grep/read transcript answering the same question (the honest
  baseline: `rg` with context flags + targeted reads, NOT full-file cats).
  **Pre-registered threshold: median ≥2.0× reduction at equal answer
  correctness** (self-graded against a written gold answer, both arms blind).
- [ ] **S0b — staleness cost.** On the TS repo, apply a 20-commit-old graph to
  5 of the questions. Count answers that are wrong-or-misleading due to drift.
  **Threshold: if ≥2/5 mislead, staleness governance (Phase 3) is promoted to
  a BLOCKER for any default-on setting; if 0/5, Phase 3 ships opt-in only.**

**Honest-null path:** if S0a lands <2.0× median, publish the spike table under
`docs/benchmarks.md` as a null exhibit ("code-graph query does not beat
disciplined grep at our consumer scale"), archive this roadmap with Phases 1–2
demoted to "interop courtesy only" (detection + freshness warning, no nudge),
and stop. No spin, no "directionally positive".

## Phase 1 — Make detection and querying executable

- [ ] `src/scripts/code_graph_detect.ts` — deterministic detector: walks repo
  root + conventional dirs for (a) Source G's `graph.json`-shaped artifacts
  (validate shape: `nodes[]` with `id`, `links|edges[]` with
  `source/target/relation`), (b) `index.scip` / `*.scip`. Emits a JSON verdict
  `{present, kind, path, node_count, built_at?, head_at_build?}`. Exit codes
  0/1/2 per house convention. Pure stdlib.
- [ ] `src/scripts/code_graph_query.ts` — thin adapter, two modes:
  - **peer mode:** if the peer CLI is on PATH, shell out (`query`, `path`,
    `explain`, `affected`) with `--budget` pass-through — the exact
    `repomix-packer` pattern: pinned upstream note, optional dependency,
    never installed silently, output passed through `sanitize_retrieved`-class
    stripping before it re-enters context.
  - **direct mode (fallback):** peer CLI absent but `graph.json` present →
    read-only BFS over the JSON in-process (≤200 LoC, undirected traversal with
    per-edge direction preserved for rendering — Source G's own documented
    pattern), honoring a token budget. NO write path, NO build path.
- [ ] Rewrite `external-code-graph-interop.md` step 1–2 to name these two
  scripts as the concrete pointer (rule stops hand-waving "the repo's own
  docs"), keep grep-fallback wording and the "say so" honesty clause verbatim.
- [ ] Tests: fixture `graph.json` (10 nodes) + malformed variants; SCIP
  detection is presence-only in this phase (adapter prints "SCIP detected —
  peer tooling required", exit 1) — an owned SCIP reader is NOT scheduled
  until a consumer actually ships one (YAGNI gate, revisit on first report).

**Acceptance:** on the two spike repos, `code_graph_detect` + `code_graph_query
"who calls <known symbol>"` return correct scoped output in both modes;
`lint_no_llm_in_build`-class check confirms zero network/LLM calls.

## Phase 2 — Query-first PreToolUse nudge (default-OFF)

- [ ] New hook handler `src/scripts/hooks/code_graph_nudge_hook.ts` registered
  in the existing `pre_tool_use` dispatch: fires only when ALL hold —
  (a) detector verdict cached this session says `present`, (b) freshness check
  passes (Phase 3 stamp or `--force-stale-ok`), (c) the intercepted tool is a
  search/read over source paths (Grep/Glob, or Read of a code-extension file),
  (d) it has not fired this session. Behavior: **soft nudge only** — inject a
  one-line reminder pointing at `code_graph_query`; never block. Source G's
  strict/block mode is explicitly NOT ported: a governance suite that blocks
  reads on a possibly-stale third-party index violates our own
  minimal-safe-diff posture. Config key `code_graph.nudge: off|soft` in
  consumer settings, default `off`.
- [ ] Once-per-session latch stored in runtime state (same mechanism as
  existing session-scoped latches), so the nudge cannot spam.
- [ ] Consumer-matrix row + `enforcement-by-host.md` update: hook platforms get
  the nudge; instruction-file platforms get one added sentence in the projected
  interop rule (zero new rule files — surface-consolidation holds).

**Acceptance:** transcript test — session with fresh graph + first Grep gets
exactly one nudge; second Grep gets none; stale graph gets none + a staleness
line instead. Token cost of the nudge itself ≤40 tokens (measured, in the PR).

## Phase 3 — Staleness governance (promoted per S0b)

- [ ] Freshness stamp: `code_graph_detect` records `head_at_build` when the
  index artifact carries it, else falls back to artifact mtime vs
  `git log -1 --format=%ct`. Verdict adds
  `{stale: bool, commits_behind?: n}` (commits-behind only when the artifact
  embeds a SHA — no guessing).
- [ ] `affected`-bridge: `code_graph_query affected --since <ref>` maps
  `git diff --name-only` files to graph nodes and BFS-expands impact —
  Source G's `affected` semantics, but seeded from git, wired as an optional
  pre-step in the existing verify-repair-loop skill (cited, not duplicated).
- [ ] Refresh guidance, not refresh machinery: the interop rule tells the
  agent to surface "index is N commits behind — rebuild with the repo's own
  tooling before trusting relationship answers". We do NOT install git hooks
  into consumer repos (that is the peer tool's job; ours is to notice).

**Acceptance:** on the TS spike repo, a 20-commit-stale index yields
`stale: true` and the nudge suppression from Phase 2; `affected --since HEAD~3`
lists a superset of the symbols actually touched (verified against the diff by
hand for 3 sampled commits).

## Phase 4 — Owned fallback import-map (STRICT scope, default-OFF)

Only if Phase 0 passed AND a consumer repo without any shipped index asks for
structure answers (adoption-gap reality check: with zero confirmed external
users, this phase may reasonably wait — it is ordered last among build work on
purpose).

- [ ] `src/scripts/import_map_build.ts` — deterministic, regex/lexer-grade
  (NOT AST) extraction of file→import/use edges for exactly two stacks:
  PHP (`use`, `require`, class refs in `new`/static calls at EXTRACTED
  confidence only) and TS/JS (`import`/`export from`/`require`). Emits the
  SAME `graph.json` shape Phase 1 consumes, `EXTRACTED`-only edges, honest
  `AMBIGUOUS` for unresolved names, no `calls` edges (that is AST territory —
  the peer tool's job). Cache content-addressed + atomic write, reusing the
  `discovery_graph.ts` cache pattern.
- [ ] Explicitly labeled in output header: "import-map (files/modules), not a
  call graph — for call-level questions install the peer tool".
- [ ] Bench: rerun the S0a question subset answerable by imports alone;
  **threshold ≥1.5× median reduction** or the builder ships as
  maintainer-workspace-only and the consumer projection excludes it.

## Phase 5 — Honest benchmark + claims

- [ ] Formal run of the S0a protocol as a pinned bench under `internal/bench/`
  (golden questions committed, both arms scripted, grader rubric written
  BEFORE the run, second-judge κ on a sample per the 9.5.0 house pattern).
  **Spend gate:** the judged run is billable — surfaced to the maintainer,
  never auto-fired (standing `benchmark-spend-authorization` blocker applies).
- [ ] Claims Ledger entries: every README/docs sentence about code-graph
  capability must cite the bench row. The ONLY claim permitted before the run:
  "detects and queries a consumer-shipped code-graph index; measured savings
  pending." Anything stronger fails the ledger gate in CI.
- [ ] Null path: publish whatever the numbers are, including a loss.

## Phase 6 — Close-out

- [ ] Regenerate `CAPABILITIES.yaml`; add the capability under the meta pack
  only if Phase 1 landed.
- [ ] `docs/comparison.yaml` row updated with the honest verdict vs Source G
  (orchestrates / does-not-build, with bench link).
- [ ] Archive this roadmap with the standard verified-checkbox sweep at the
  landing SHA; move any demoted phases to `later/` with the blocking
  threshold named inline.

## Standing blockers

- `benchmark-spend-authorization` — Phase 5 judged run.
- Adoption gap — Phase 4 is deliberately sequenced behind real consumer
  demand; a fallback builder for zero users is inventory, not value.

## Risk register

- **Stale-index harm** exceeds token savings → covered by S0b promotion rule.
- **Prompt-injection via graph content** (node labels / notes are
  attacker-writable in a hostile repo) → Phase 1 routes all peer output
  through the retrieved-content sanitizer before context re-entry; direct-mode
  reader caps label length and strips control chars (mirrors Source G's own
  `sanitize_label`, independently reimplemented).
- **Scope creep toward an engine** → Non-goals section is the tripwire; any PR
  adding a parser dependency fails review by citation of this file.
