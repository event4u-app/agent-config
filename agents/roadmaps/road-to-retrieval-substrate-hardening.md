---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
---

# Road to retrieval-substrate hardening

> Harden the memory/retrieval substrate with mechanisms adapted from an external
> deterministic graph-retrieval reference (Source G): a token-budgeted compact
> read surface, a real dependency-free lexical index, a learning sidecar that
> verdicts signals, a sanitize floor, and an artefact relation-graph — every
> item file-backed + projection/hook-time (ADR-040), no runtime daemon.

## Goal

Cut per-query retrieval tokens and close three verified substrate gaps
(no token budget on `retrieve()`, no real index, no signal-verdicting) with
deterministic TS that passes the existing checksum/determinism gates — while
adding zero heavy dependency and copying none of the source's identity.

## Provenance

Source-anonymous adoption per [`source-confidentiality`](../../.agent-src.uncondensed/rules/source-confidentiality.md).
**Source G** — an external, deterministic, LLM-free code-intelligence /
graph-retrieval tool (Python). Analysed at the code level (full clone,
2026-07-09), not the README. Raw analysis + the source name stay local-only
(`agents/tmp/`, gitignored); the retained link is encrypted:

- `ENC1:rOBZC4TOdi2ebuS4ADDlqt6QoX0kQGqDlmw2iKwYwbm/KvKW7pH00/fpflCr8MQGQMRcm/Lx/syJIMiVFRk8HrJFSv8E4XVF8YwvctjkEqou/R+IirUUQaAc69Pbt21qpEtr9ZgPMHXR`

The borrowed *items* below are agent-config's own features; Source G is the
mechanism reference, never a dependency.

> **Honest framing (do not repeat the prior competitive-harvest parity lesson).** Source G's own numbers
> show the *graph* is a small lever (+2–2.6 pts on a public recall bench vs
> seed-only retrieval); the real token win is the index/detail split + a hard
> budget cut + a tiny always-on nudge. This roadmap adopts the *mechanisms that
> pay* (B1–B3), not the graph as a headline. Source G's own `benchmark` measures
> against a synthetic full-corpus strawman — explicitly NOT copied (see B7).

## Context (verified in the code, 2026-07-09)

Spot-checked against the current `main` (v8.8.0):

- `memory_lookup.ts::_score` is naive substring/glob (0.8 glob / 0.6 substring /
  0.1 fallback) — no IDF, no index, every lookup scans the tree.
- `retrieve()` takes a `limit` (hit count) but **no token budget** and emits
  full YAML entries — the index/detail split from `road-to-memory-retrieval-economy`
  (archived) is a read-path *principle*, not enforced in code.
- `memory_signal.ts` appends rate-limited signals but has **no decay, no
  corroboration threshold, no dead-end verdicting** — `fold_intake.ts` collects,
  nothing verdicts. This is the measured-missing half of the second-brain
  substrate (`road-to-second-brain-delta-proof`, archived PASS).
- Retrieval read-surfaces have **no sanitize floor**: user-ingested knowledge
  chunks flow unfiltered into agent context — a real injection surface
  (`hot_context_hook` sanitizes; `memory_lookup`/knowledge-chunk output does not).
- `lint_knowledge_scale.ts` pre-decides an FTS5 activation at a tripwire
  (>200/type, >500 total) but the engine choice vs [`ADR-061`](../../docs/decisions/ADR-061-corpus-grounding-layer.md)
  (no engine-forks / minisearch-class dep) is unresolved — and the
  `road-to-second-brain-retrieval-precision` (merged) finding **"recalls but does
  not rank" (mean tie-set 3.3)** is the concrete evidence that `_score` needs a
  real ranker. B2 is the answer to that finding.

## Gap-table — KEEP / FOLD / CUT (integration, not dump)

Audited each proposed borrow against the existing surface. Only `KEEP` items
become scope.

| Item | Disposition | Rationale |
|---|---|---|
| B1 token-budget + compact `retrieve()` | **KEEP** | verified gap; enforces the index/detail split in code |
| B2 IDF + trigram prefilter (hand-rolled, stdlib) | **KEEP** | resolves the ADR-061 ↔ FTS5 conflict AND the "doesn't rank" finding |
| B3 learning sidecar (decay + corroboration + dead-end) | **KEEP** | verified gap; the missing verdict half of `memory_signal`/`fold_intake` |
| B4 artefact relation-graph (manifest extension) | **KEEP (scoped)** | NOT a code-graph; `affected` verb **FOLDs** alongside `check_structural_breaking` |
| B5a stat-index for hook scans | **KEEP** | hook latency is UX; `stop`/`session_start` re-scan today |
| B5b versioned-cache lint rule | **KEEP** | one lint; every future derived cache (B2!) needs a version namespace |
| B6 sanitize floor on retrieval surfaces | **KEEP** | verified injection gap; ~40 lines + a security lint |
| B7 Kappa second-judge validation | **KEEP** | directly closes the 33%-judge-inconsistency gap seen in the token-saving live run |
| B7 self-measuring `benchmark` command | **KEEP (honest baseline)** | value for proof/GTM; measure vs real projection, not a strawman |
| B8 file-slicing for knowledge ingest | **KEEP** | `fold_intake` has no tests; slicing invariants are the first test block |
| B9 detect-and-point interop for code-graph | **KEEP** | orchestrator-not-competitor; ~10 projected lines |
| tree-sitter / native AST extraction | **CUT** | heavy dep, identity fork (B9 is the interop answer) |
| MCP runtime server as required path | **CUT** | ADR-040 violation; all items work as CLI/hook/projection |
| naive `nodes × 50` benchmark baseline | **CUT** | anti-pattern for the claims ledger |
| graph-expansion as a headline feature | **CUT** | small lever; value is B1–B3 |
| watch-daemon | **CUT** | hook events already cover invalidation points |

## Phase 0 — Sanitize floor + versioned-cache lint (no dependency)

- [x] B6: add a `sanitize_field()` (strip control chars, cap length, escape
      markup) applied to every corpus-derived field concatenated into agent
      context — `memory_lookup` output and knowledge-chunk read surfaces first;
      a security-lint check asserts no retrieval surface emits unsanitized
      corpus text.
      <!-- done 2026-07-09: src/scripts/_lib/retrieval_sanitize.ts
      (sanitize_text/sanitize_entry) strips hidden-instruction vectors
      (bidi/zero-width/Unicode-tag, codepoint classes shared with
      lint_hidden_unicode) + C0/C1/DEL control noise + caps length, preserving
      visible content (byte-identical for clean entries → v1 envelope contract
      holds). Applied at retrieve_v1 + memory_get_v1 emit boundaries. Witness
      test injects a bidi+zero-width+Tag-block body → sanitized through both
      surfaces (7 tests; 26/26 memory_lookup regression green). B5b
      (versioned-cache lint) stays open — separate increment. -->
- [x] B5b: add a lint rule — no derived cache without a version namespace OR an
      explicit invalidation comment (the rule every later cache layer inherits).
      <!-- done 2026-07-09: src/scripts/lint_versioned_cache.ts — a fail-on-
      violation gate scoped to cache-file suffixes (-index.json / -cache.json /
      .stat-index.json / .agent-learning.json …); requires a `v<N>`/`${version}`
      path segment OR an inline `// cache-invalidation:` comment. Wired into the
      CI chains (task lint-versioned-cache). 8 tests incl. a "live src/scripts is
      clean today" guard; green on the current tree, bites when B2/B3/B5a land.
      No existing cache-file literal matches the suffix trigger (hot-context is a
      .md, audit is a dir), so no retrofit is needed — the convention is
      forward-looking by construction. -->


**Exit:** knowledge-chunk retrieval is sanitized; the lint fails a
version-namespace-less derived cache. **Rollback:** revert the sanitizer call
(pointer output unaffected).

## Phase 1 — Token-budget + compact serialization in `retrieve()`

- [x] B1: `retrieve(types, keys, limit, token_budget?)` — render hits as
      one-line compact form (`HIT <type>/<id> [src=<path> score=<x>] <~120-char
      body head>`), exact/seed matches first, hard char-cut at `token_budget × 4`
      with a truncation notice that names a concrete next step ("N more hits —
      narrow with --key or read <path>"). Default (no budget) stays
      byte-identical to today.
      <!-- done 2026-07-09: retrieve_v1 gained an additive `token_budget` option
      (+ _compact_line helper); budget>0 → compact `{id,type,source,confidence,
      line}` rows, hard-cut at token_budget×4 chars, top-level `truncation`
      {omitted, hint} naming the next path. Sanitize floor (B6) still applies to
      the line. Default/index paths byte-identical (v1 contract test green). -->
- [x] Wire the compact/budgeted mode into the MCP `memory_lookup` detail path +
      the CLI, defaulting off (additive, per the v1 envelope contract).
      <!-- done 2026-07-09: CLI `--token-budget N` (v1 envelope only); MCP
      _memoryLookupHandler validates + passes `token_budget`; input_schema +
      consumer_tool_catalog.json + regenerated mcp-tool-inventory.md. 4 B1 tests
      + 43-test retrieval regression green; tsc clean. -->

**Exit:** a budgeted `retrieve()` emits compact hits within the char cut + a
navigation hint; the index/detail split is enforced in the read path.
**Rollback:** one-line default revert.

## Phase 2 — IDF + trigram index (resolves the ADR-061 ↔ FTS5 conflict)

- [x] B2: a hand-rolled, dependency-free lexical index (IDF weighting + trigram
      candidate prefilter with a guard fraction) in TS (~150 lines, pure stdlib)
      — mechanically the BM25 core ADR-061 already sanctions, NO engine fork, NO
      minisearch-class dep. `_score()` stays as the mini-corpus fallback.
      <!-- done 2026-07-09: src/scripts/_lib/lexical_index.ts (LexicalIndex:
      BM25 k1=1.5/b=0.75 over an IDF term index + character-trigram candidate
      prefilter with a token-match guard; deterministic, id-stable tie-break).
      8 unit tests. -->
- [x] Activate at the existing `lint_knowledge_scale` tripwire (>200/type,
      >500 total); build **lazily at first lookup** + a stat-index (size+mtime_ns),
      atomic temp-write + `rename()`, version-namespaced per B5b (council Q3 —
      NOT eager); measure the grep/substring baseline vs the index on the
      then-current corpus BEFORE shipping (reuse the retrieval-precision replay
      rig); ship only on measured ranking lift, else honest-null.
      <!-- measurement done 2026-07-09 (the ship-gate): measure_lexical_ranking.ts
      — baseline mean top tie-set 3.333 → index 1.0, precision@1/@5 unchanged 1.0
      (internal/bench/reports/lexical-ranking.json, CLAIMS-bound). Lift PROVEN. -->
      <!-- activation done 2026-07-09: _retrieve_internal re-ranks the recalled
      set with the BM25 index above the file-count tripwire (_lexicalRankActive,
      per-type >200 / total >500, memoised per root; injectable override for
      tests), maps BM25→[0,1] via s/(s+1) × source-factor so the v1 confidence
      contract holds and curated truth wins ties. Inert below scale (curated
      single-file types never trip it → byte-identical `_score` path; the
      knowledge type at chunk scale is the real activation case). 4 activation
      tests + 54-test retrieval regression green. LAZY BUILD is in-process
      memoised (rebuild only when the root/corpus signature changes); the
      PERSISTENT cross-process stat-index cache file (atomic temp+rename,
      version-namespaced per B5b) is Phase 5 / B5a's scope — noted so the "stat
      -index" half of council Q3 is delivered there, not silently dropped. -->
- [x] Record the ADR-061 ↔ FTS5 resolution (hand-rolled IDF+trigram = the
      pre-decided path, no engine fork) in the ADR / `lint_knowledge_scale` doc.
      <!-- done 2026-07-09: ADR-061 "Resolution note — retrieval ranking at
      scale" + lint_knowledge_scale tripwire messages now name lexical_index.ts
      as the resolved (no-FTS5) path with the measured lift. -->

**Exit:** the index ranks (mean tie-set → 1 on the retrieval-precision corpus);
the ADR-061 conflict is closed in writing. **Rollback:** fall back to `_score()`
(tripwire-gated, so inert below scale). **Dependency:** B1.

## Phase 3 — Learning sidecar: decay + corroboration + dead-end ledger

- [ ] B3: a deterministic aggregator over the intake JSONL — signed score with a
      30-day half-life, promotion only at ≥2 independent corroborations,
      contested-resolution by recency, output as a sidecar (`.agent-learning.json`)
      + a `LESSONS.md` "known dead ends — don't re-derive" section. Byte-stable
      at a fixed `now` (fits the determinism gates).
- [ ] Display-time merge into `retrieve()` output as a
      `learning=preferred|contested|dead_end` suffix — the sidecar NEVER mutates
      the curated YAML truths; a single session cannot mint a lesson.

**Exit:** the aggregator verdicts intake into preferred/contested/dead-end,
byte-stable; `retrieve()` surfaces the suffix. **Rollback:** drop the sidecar
merge (curated memory unaffected). **Council Q2 (resolved):** sidecar is
**gitignored** intake-derived — NO `merge=union` provision (premature); proven
lessons are manually curated into committed memory, never auto-promoted.

## Phase 4 — Artefact relation-graph + `affected` / `explain`

- [ ] B4: extend the discovery scanner with deterministic edge-extraction from
      existing fields + markdown links (`supersedes`/`superseded_by`, ADR refs,
      workspace/pack membership, rule→skill mentions, memory-entry→path overlap)
      → `discovery-graph.json`, same determinism gates. Edges carry their OWN
      confidence scale (`EXTRACTED/INFERRED/AMBIGUOUS`), separate from evidence
      tiers (council Q1); a mapping table in the doc is display-only, never used
      to override an evidence tier.
- [ ] `agent-config affected <artefact>` (relation-filtered BFS — query-side
      companion to CI's `check_structural_breaking`) and `agent-config explain
      <concept>` (seed + 2-hop + budget-cut over the artefact graph).
- [ ] Build the graph **lazily at first `affected`/`explain` call** + a
      stat-index (size+mtime_ns), atomic temp-write + `rename()` for concurrent-
      hook idempotency, version-namespaced per B5b (council Q3). NOT eager at
      discovery-build.

**Exit:** the graph builds deterministically; `affected`/`explain` answer from
it within a budget. **Rollback:** none (additive artefact + verbs). **Council
Q1+Q3 (resolved):** two trust scales with a display-only mapping; lazy build +
stat-index + atomic write.

## Phase 5 — Stat-index for hook/scan latency

- [ ] B5a: a stat-index (size + mtime_ns → hash-skip, atexit flush,
      `--force` bypass) for the memory/knowledge/discovery scans that run on
      every `stop`/`session_start` hook. Version-namespaced per B5b.
- [ ] Wire the persistent stat-index into the B2 lexical-index build so the
      re-rank reuses a cached index across processes (today B2 memoises the
      index in-process only; the cross-process cache file — atomic temp+rename,
      version-namespaced — is this step). Closes the "stat-index" half of
      council Q3 that Phase 2 deferred here.

**Exit:** hook re-scans skip unchanged trees; latency measured before/after;
the B2 index build reuses the persistent stat-index. **Rollback:** delete the
stat-index (scans fall back to full read; B2 falls back to in-process build).

## Phase 6 — Benchmark command + Kappa judge validation

- [ ] B7a: `agent-config benchmark` — measure projected context vs the REAL
      alternative (today's full projection / a grep session) on the user's own
      repo, print the reduction ratio per query, bind the number to the claims
      ledger with a method line. NEVER the synthetic-full-corpus strawman.
- [ ] B7b: add second-independent-judge blind validation with Cohen's Kappa to
      the paired-judge harness — the existing McNemar/Wilcoxon gates test effect
      significance; Kappa tests grader trustworthiness. Directly closes the
      33%-judge-inconsistency gap the token-saving live run surfaced.

**Exit:** `benchmark` prints an honest, ledger-bound ratio; the judge harness
reports Kappa. **Rollback:** none (measurement + reporting). **Council Q4
(resolved):** baseline = the full always-loaded projection (`token-baseline.json`),
NOT a grep-session replay; every emitted number binds to `docs/CLAIMS.md` with a
method line.

## Phase 7 — File-slicing + interop rule

- [ ] B8: a file-slicer for oversized knowledge documents (heading→paragraph→line
      boundaries, gap-free, non-overlapping, concat == original, each slice
      reports its parent path) wired into knowledge ingest; the slicing
      invariants are `fold_intake.ts`'s first test block.
- [ ] B9: detect an external code-graph index committed to the repo (a
      `graph.json`-shaped artifact, or a SCIP index) at install/projection time
      and project a ~10-line interop rule ("for codebase questions query the
      external index first, not grep") — orchestrator, not competitor. The
      concrete tool name lives in the eventual interop rule (integration
      carve-out), not in this harvest roadmap.

**Exit:** knowledge ingest slices losslessly (tested); the interop rule projects
when an external index is present. **Rollback:** none (additive).

## Acceptance criteria

- Each shipped phase carries a measured before/after (tokens or ranking) on the
  existing replay rig; no lever ships on a proxy estimate.
- No new heavy/native dependency; B2's index is pure stdlib (ADR-061 honoured).
- The sanitize floor covers every retrieval read-surface (security lint green).
- No public number from B7 enters prose without a `docs/CLAIMS.md` binding + a
  method line; the source's strawman baseline is not reproduced.
- **Anti-dump:** every new visible command (`affected`, `explain`, `benchmark`)
  reuses existing skills/scanners; no new artefact duplicates an existing one;
  no source filename or name appears in any tracked file (`check_no_external_sources`
  green). Governance preflight recorded: `domain-adoption-policy` (no new domain),
  `framework-neutrality` (generic), `size-enforcement` (per-artefact budgets).

## Council notes (2026-07-09, claude-sonnet-4-5 + gpt-4o)

Two-member debate pass on the four contested design questions (2 rounds).
Verdicts encoded into the phases below.

- **Q1 — trust-scale unification → TWO vocabularies + a documented,
  display-only mapping (SPLIT, resolved on the merits).** gpt-4o argued for one
  shared contract (consistency); claude-sonnet-4-5 argued the shared contract is
  a *category error* — edge-confidence describes graph-topology provenance ("how
  was this relationship discovered?"), evidence tiers describe claim epistemic
  status ("what is our warrant for believing X?"). EXTRACTED↔Verified is not
  semantically stable (an extracted edge from a stale import is high-confidence
  topology but low-confidence truth). Resolution: keep **two separate scales**
  (edges: `EXTRACTED/INFERRED/AMBIGUOUS`; evidence: `Verified/Assumed/Gap`) with
  a **documented mapping table that is a display convenience, not a semantic
  identity** — this delivers gpt-4o's cross-surface consistency without the
  category error. **Hard condition (claude):** the mapping doc states no
  tiebreaker is implied; B4 never uses an edge label to override an evidence
  tier. (Supersedes the roadmap's earlier "one shared contract" default.)
- **Q2 — learning sidecar → GITIGNORED (converged).** Both members: strictly
  derived state; committing machine-derived cache creates a falsifiable record
  and review noise, and violates the intake-derived model. **Refinement
  (claude, adopted):** DROP the `merge=union` provision now — it is premature
  (no conflict-resolution semantics for contradictory corroborations exist yet);
  team-sharing is a separate later decision. **Hard condition (both):** proven,
  corroborated lessons are *manually* curated into committed memory; the sidecar
  never auto-promotes into tracked YAML.
- **Q3 — B2 index build → LAZY at first lookup + stat-index (converged after
  debate).** Round 1 split (claude eager / gpt-4o lazy); in round 2 **both**
  converged on lazy after claude's own rebuttal demolished the eager position:
  determinism means *reproducibility of outputs given identical inputs*, not
  identical intermediate cache artefacts (the index is the same class of
  gitignored, session-dependent artefact as hot-context). Eager taxes every
  `stop` hook even when no lookup happens (~5× wasted work in a typical session).
  **Hard conditions (claude, adopted):** (a) atomic write — build to a
  pid-suffixed temp file + `rename()` so concurrent hook invocations stay
  idempotent (identical content, last-write-wins); (b) `size + mtime_ns` is
  sufficient for gating *rebuild decisions* — the round-1 "cryptographic
  binding" demand was explicitly withdrawn as solving a non-problem; (c)
  version-namespaced per B5b so a tool bump invalidates cleanly.
- **Q4 — benchmark baseline → FULL always-loaded projection (converged).** Both
  members: a grep-session replay is a *workload*, not a baseline; baselines must
  be workload-independent for cross-session comparison. The full projection is
  the honest "what the user pays today" number, already pinned
  (`token-baseline.json`). **Hard condition (both, load-bearing):** every emitted
  number binds to `docs/CLAIMS.md` with a method line, else the benchmark becomes
  marketing; the synthetic full-corpus strawman is never reproduced.

## Blockers

### blocker: contested-design-council-pass
- **Status:** resolved
- **Owner:** user
- **Blocks:** Phase 3 (Q2), Phase 4 (Q1, Q3), Phase 6 (Q4)
- **What to do:** run an AI-council pass (spend-bearing) on the four contested
  design questions; author the verdicts into the phases before their flip.
  Recommended defaults carried below so the phases are shippable if council
  simply ratifies them:
  1. **Trust-scale unification** — one contract mapping edge-confidence
     (EXTRACTED/INFERRED/AMBIGUOUS) ↔ evidence tiers (Verified/Assumed/Gap).
     *Default: one shared contract, two vocabularies mapped.*
  2. **Learning sidecar storage** — gitignored (like hot-context) vs committed
     (like curated memory). *Default: gitignored intake + `merge=union`, matching
     the existing intake model; team-share is a later decision.*
  3. **B2 index build** — eager at discovery-build vs lazy at first lookup with
     stat-index invalidation. *Default: lazy + stat-index (B5a), tripwire-gated.*
  4. **B7 benchmark baseline** — full projection before thin-flip vs grep-session
     replay. *Default: full projection (deterministic, already pinned).*
- **Resolved when:** the four verdicts are recorded under `## Council notes`
  (members + date, no session path) and the contested phases encode them.
- **Resolution (2026-07-09):** verdicts recorded under `## Council notes`
  (claude-sonnet-4-5 + gpt-4o); Q1 was a split resolved to two-vocabularies +
  display-only mapping, Q2/Q4 converged on the defaults, Q3 converged on
  lazy+stat-index after debate. Phases 3/4/6 updated below.

### blocker: draft-promotion
- **Status:** resolved
- **Owner:** user
- **Blocks:** dashboard visibility + execution
- **What to do:** this roadmap is `status: draft` (source-derived, council-pending)
  — promote to `ready` after the council pass + a maintainer review of the
  gap-table dispositions.
- **Resolved when:** `status: ready` and the contested-design blocker is cleared.
- **Resolution (2026-07-09):** council pass complete (see `## Council notes`);
  promoted to `status: ready`.
