---
complexity: structural
status: ready
execution:
  mode: autonomous
---

# Road to memory-retrieval economy — index first, fetch by ID, price every row

> Adapt the verified retrieval mechanics from `thedotmack/claude-mem` (two-phase
> index→detail fetch, per-row token price tags, tool-description-encoded
> discipline) into the file-backed `agents/memory/` surface — behind a replay
> measurement gate, with the current full-entry behaviour preserved until the
> default flip is falsified per host. No SQLite worker, no Chroma, no new
> backend.

> **Program sequencing:** this roadmap ranks BEHIND the thin-projection flip in
> the token program's critical path (`road-to-token-proof-and-story.md`
> § Program tracking). Thin projection is a proxy-measured −46k tok/request
> lever; this roadmap's total addressable surface is the retrieval path only
> (`memory_lookup`, `memory_get`, `memory_retrieve`, `chat_history_read`).
> Expected absolute win is smaller today and grows with memory volume. Do not
> let this displace the thin flip; it slots in after Phase 4 of the token
> roadmap or runs in parallel where phases are mechanical.

## Goal

Cut context-window tokens spent on memory retrieval at held-constant answer
quality, by never shipping a full entry body the model did not explicitly
request. Concretely: `memory_lookup` (and `memory_retrieve` for knowledge
chunks) gains an `index` detail mode returning `id / type / title / score /
~tokens` rows; a new `memory_get(ids)` batch tool fetches full bodies; the
"index first" discipline is encoded in the MCP tool descriptions themselves so
it survives hosts that drop rules. Every lever lands behind a falsification
gate on the Phase-0 replay set, measured with the real tokenizer
(`src/scripts/_lib/token_count.ts`, cl100k_base) — never chars/4.

## Context — source-repo findings (verified 2026-07-07, fresh clone)

Analysis of `thedotmack/claude-mem` v13.10.2 (Apache-2.0) against
`agent-config` v8.1.0:

- **The transferable mechanism is the two-phase fetch, not the stack.**
  claude-mem's `search` returns a compact table (`| #ID | time | icon | title |
  ~tokens |`, `SearchManager.ts:236`); full bodies only via
  `get_observations(ids)` batch. SessionStart injects 50 compact rows and
  **zero** full bodies by default (`CLAUDE_MEM_CONTEXT_FULL_COUNT: '0'`,
  `SettingsDefaultsManager.ts:118`).
- **The per-row `~tokens` price tag is behaviour-shaping.** The model sees
  fetch cost BEFORE fetching. Cheap to adapt; we already own a real tokenizer.
- **Discipline lives in the tool catalog.** A pseudo-tool named `__IMPORTANT`
  (`mcp-server.ts:439`) carries the 3-layer workflow as its description —
  host-natively in context whenever the MCP server is connected. This
  sidesteps the exact `alwaysApply: false` host-compliance gap our own token
  roadmap documents.
- **The "up to 90% savings" claim is baseline-relative marketing.**
  `TokenCalculator.ts` computes `savings = discovery_tokens − read_tokens`:
  reading the observation vs REDOING the original work. It is memory-vs-no-
  memory, not a design comparison; it uses a chars/4 estimate
  (`CHARS_PER_TOKEN_ESTIMATE`); and the LLM cost of GENERATING observations
  (dedicated provider pipeline, `src/server/generation/providers/`) is absent
  from the ledger. Do not adopt the number as a target; adopt the mechanism
  and measure our own delta.
- **Our gap (verified):** `memory_lookup` always returns full entries (`Hit`
  carries `entry: this.entry`, `memory_lookup.ts`); scoring is naive
  substring/fnmatch at fixed 0.6/0.8 (`_score()`, line 448); no per-row token
  estimate; `chat_history_read` filters by `last`/`session`/`entry_type` but
  has no timeline anchor; `memory_retrieve` ships full 2 KB knowledge chunks.
- **What we deliberately do NOT adopt:** the HTTP worker layer, Chroma, the
  Postgres server runtime, and the write-time LLM observation generator. Our
  `memory_status` contract is `backend: file`, curation is human-gated by
  design (admission gate, `/memory promote`), and current volumes do not
  justify an always-on service. FTS5 gets a pre-decided activation path
  behind the existing `lint_knowledge_scale` tripwire (Phase 6), not a build.

## Decisions (baked in — do not re-litigate)

- **D1 — Envelope compatibility over purity.** The v1 retrieval envelope
  (`status` + per-type `slices`) is a published contract. `detail: index|full`
  ships as an additive parameter with **default `full`** (current behaviour).
  The default flip to `index` is a separate, falsification-gated step — the
  thin-projection pattern, replayed.
- **D2 — Real tokenizer only.** Every measurement in this roadmap uses
  `token_count.ts` (cl100k_base, with the recorded-proxy-delta option). A
  chars/4 number is not evidence anywhere in this file.
- **D3 — No new backend, no service.** File-backed scan + rank stays. FTS5 is
  a written-down activation path, triggered by scale, not built speculatively.
- **D4 — Discipline is encoded twice:** in the tool descriptions (host-native,
  survives rule-dropping hosts) AND in the `memory` pack rules (for hosts
  without MCP). Descriptions are the primary carrier.
- **D5 — Naive scoring stays until the tripwire.** Substring/fnmatch is
  adequate at current curated volumes; replacing it before scale is
  complexity without evidence.

## Automation & human gates

- **Fully autonomous:** Phases 0, 1, 2, 3, 4, 5 (mechanism + measurement;
  everything ships default-off or behaviour-preserving, verified by unit tests
  + the Phase-0 replay rig in CI).
- **Human gates (two, and only two):**
  1. **Phase 1b default flip** (`detail` default `full` → `index`): changes
     the envelope's effective payload for every consumer → explicit sign-off
     once the falsification script is green, mirroring the thin-projection
     rollout gate.
  2. **Phase 6 tripwire wiring** when `lint_knowledge_scale` fires: choosing
     the FTS5 activation moment is an operator call.
- **Phase 7 is documentation-only** (AST-folding candidate ledger entry) —
  unblocked, parallel, zero dependencies.

## Phase 0 — Retrieval replay substrate (prerequisite to every cut)

No lever ships on an unmeasured claim. Build the evidence rig for the
retrieval path specifically; reuse the token-program harness where it exists.

- [x] Build a **replay set of ≥20 real memory queries** harvested from recent
      maintainer sessions (mix: `memory_lookup` by type, anchored by key/path,
      `chat_history_read` resumes, knowledge-chunk retrievals). Store as
      fixtures under `tests/fixtures/memory-replay/` with the expected
      "needed entries" hand-labelled (which entries the task actually used —
      not LLM-labelled).
      <!-- done 2026-07-08, ADAPTED per in-run council (claude-sonnet-4-5 +
      gpt-4o, 2 rounds, Option-A verdict "the ONLY defensible basis"): NO
      harvestable real queries exist — MCP telemetry records tool names only
      (PII-excluded, 7 stub calls) and session transcripts carry
      memory:lookup only as documentation text; the project memory store
      itself was ~empty (2 files). Corpus therefore CORPUS-DERIVED: 24
      queries over a 27-entry fixture tree seeded from real repo content at
      realistic sizes (tests/fixtures/memory-replay/), needed-labels
      deterministic BY CONSTRUCTION (never LLM-labelled — the guard's
      intent). Every claim from this rig is scoped to "corpus-derived
      replay queries" (provenance header in queries.yml). Needed-recall
      validated at 100% on the naive scorer. -->
- [x] Capture the **baseline**: for each replay query, real-tokenizer count of
      the current full-entry envelope payload. Emit
      `internal/bench/reports/memory-retrieval-baseline.json` (per-query +
      aggregate; record proxy delta per D2).
      <!-- done 2026-07-08: src/scripts/memory_replay.ts --baseline pinned
      internal/bench/reports/memory-retrieval-baseline.json — 24 queries,
      full-envelope 7,092 tok (cl100k_base), needed-recall 100%. Honest
      note: the corpus is small, matching the roadmap's own expectation
      that absolute wins grow with volume. -->
- [x] Define the **paired comparison harness**: same queries under
      `detail: index` + selective `memory_get` of the hand-labelled needed
      IDs; tokens-in-context new vs old; answer-quality check reuses the
      length-controlled paired judge (`check_quality_regression.ts`) — do not
      hand-roll a second judge.
      <!-- done 2026-07-08: --paired mode in memory_replay.ts (index+
      memory_get(needed) vs full; per-query + aggregate saving; missed-
      needed tracking); the judge arm delegates to check_quality_regression
      (exists, verified) and is reported OUT-OF-BAND in the falsification
      block — never a hand-rolled second judge. -->
- [x] Wire a CI snapshot: retrieval-baseline regression check (fail if the
      index-mode payload for the replay set exceeds recorded baseline >5%),
      inert until the baseline file exists.
      <!-- done 2026-07-08: task check-memory-replay wired into both CI
      groups; inert-without-baseline verified, active-within-+5% verified
      (baseline is tracked). Pre-P1 it guards the FULL payload; post-P1 the
      index payload. -->

**Exit:** a reproducible before/after of full vs index+fetch on the replay
set, real-tokenizer counts, with a quality verdict path defined.
**Rollback:** none — measurement only, additive.

## Phase 1 — Index/detail split: `memory_lookup(detail=)` + `memory_get(ids)`

The core adaptation. Mechanism first, behaviour-preserving.

- [x] Add `detail: 'index' | 'full'` to the `memory_lookup` input schema
      (`src/scripts/mcp_server/tools.ts`), **default `full`** (D1). CLI twin
      (`memory_lookup.ts`) gains `--detail`; envelope docs updated.
      <!-- done 2026-07-08: additive options param on retrieve_v1 (default
      full, byte-identical — snapshot-tested); CLI --detail; MCP schema +
      catalog (consumer_tool_catalog.json, surgical edit) + inventory doc
      regenerated (audit_mcp_tools --write, 19 implemented tools). -->
- [x] Implement the index row: `id / type / title-or-key / score / ~tokens`
      where `~tokens` is `token_count.ts` over the serialized full entry
      (computed at read time; no stored denormalization — file backend stays
      dumb).
      <!-- done 2026-07-08: _entry_title (title>key>path>first-body-line>id)
      + _entry_tokens_estimate (lazy createRequire of token_count — the hot
      MCP import path never pays the tiktoken load; proxy fallback is a UI
      hint only, measurements go through the D2-compliant rig). -->
- [x] Add `memory_get` MCP tool: `ids` (required array), batch fetch of full
      entries across types, same v1 envelope, read-only. Reject unknown IDs
      with a per-ID `status` rather than a hard error (batch semantics match
      claude-mem's `get_observations`).
      <!-- done 2026-07-08: memory_get_v1(ids) scans the SAME iterators with
      the SAME id derivation as retrieve (lookup and fetch can never
      disagree — property-tested); envelope {contract_version, status
      ok|partial|error, entries (full bodies, no confidence — explicit
      fetch has no relevance score), ids per-id status}; MCP tool
      memory_get wired + allowlist test updated 18→19. -->
- [x] Entry IDs: content-addressed entries already have stable hashes; for
      `entries:`-list layouts, derive a deterministic ID
      (`<type>:<file>:<index>` or the entry's `id` field when present) and
      document the precedence. IDs must be stable across a re-run on an
      unchanged tree (test).
      <!-- done 2026-07-08: _entry_id — own id field wins; fallback
      <type>:<file-basename>:<ordinal> derived at ITERATION time (before
      any stale filtering) so ordinals stay consistent across every
      consumer of the iterator; stability test green. -->
- [x] Unit tests: index row shape, token estimate presence, batch fetch,
      unknown-ID handling, default-`full` unchanged-envelope snapshot
      (byte-stable vs current output — the compatibility proof).
      <!-- done 2026-07-08: tests/scripts/memory_lookup_detail.test.ts —
      10 tests incl. the byte-identity snapshot, index<full/2 size check,
      unknown-id batch semantics, knowledge-chunk ids, id stability;
      full memory/MCP sweep 108/108. -->

**Exit:** both modes callable; default behaviour byte-identical; replay rig
can exercise index+fetch end-to-end.
**Rollback:** remove the parameter + tool; default path untouched throughout.

## Phase 1b — Default flip (HUMAN GATE)

- [x] Run the Phase-0 paired comparison; produce
      `internal/bench/reports/memory-retrieval-run.json` (token delta +
      quality verdict).
      <!-- done 2026-07-08: internal/bench/reports/memory-retrieval-run.json
      — full 7,092 vs index+fetch 6,948 tok (cl100k_base). -->
- [x] Falsification checklist (script, not vibes): (a) index mode saves ≥30%
      tokens on the replay set aggregate, (b) quality judge win-rate ≥48% for
      index+fetch vs full, (c) no replay query where the model failed to fetch
      a hand-labelled needed entry. Any red → default stays `full`, findings
      documented as honest-null.
      <!-- done 2026-07-08: (a) RED — aggregate saving 2.0%, 20/24 queries
      NEGATIVE; (c) GREEN — zero missed needed-fetches; (b) not run (moot
      once (a) is red — no judge spend on a falsified flip). STRUCTURAL
      finding, not a rig bug: full envelopes ship only score>0 matches, so
      precision queries already pay near-minimum; index+fetch adds a second
      envelope round-trip. Savings concentrate exactly where payloads are
      large/multi-entry (knowledge chunks +54%/+36%, multi-type +31%) —
      quantifying the roadmap's own volume caveat. Verdict block in the
      pinned report. -->
- [-] On green + sign-off: flip default to `index`, bump envelope docs,
      BREAKING_CHANGES entry.
      <!-- cancelled 2026-07-08: falsified by (a) at current corpus scale —
      the pre-committed red path. Default STAYS full; the mechanism ships
      opt-in. Re-open trigger: lint_knowledge_scale tripwire fires or
      broad-recall usage appears; then re-run memory_replay --paired. -->

**Exit:** default flipped with evidence, or an honest-null report.
**Rollback:** one-line default revert; both modes remain supported.

## Phase 2 — Discipline in the tool catalog (the `__IMPORTANT` pattern)

- [x] Rewrite `memory_lookup` / `memory_get` / `memory_retrieve` descriptions
      to carry the workflow inline: "call with detail=index first; fetch full
      bodies via memory_get ONLY for IDs you will use; batch multiple IDs".
      Keep under the host description budget; lint via existing description
      checks.
      <!-- done 2026-07-08 (with P1): tools.ts + consumer_tool_catalog.json
      descriptions carry the index-first workflow inline. Note:
      memory_retrieve does not exist on 8.7.0 — knowledge chunks are served
      through memory_lookup (KNOWLEDGE_TYPE) + memory_get; the discipline
      text covers that unified path. -->
- [x] Evaluate (do not blindly copy) a catalog-level workflow carrier: either
      a `memory_workflow` MCP **prompt/resource** (we already ship
      `prompts.ts`/`resources.ts` — more idiomatic than a fake tool) or a
      pseudo-tool. Decide by which surface the supported hosts actually
      render; record the per-host finding.
      <!-- done 2026-07-08 — DECISION: descriptions stay the ONLY carrier;
      no pseudo-tool, no extra prompt. Per-host finding: tool descriptions
      are ambient on every MCP host (tools/list ships them); Claude Code
      renders MCP prompts as user-invocable slash commands (not ambient)
      and does not auto-inject resources — so a prompt adds no ambient
      carrier and a pseudo-tool costs catalog tokens on EVERY session.
      Decisive: the Phase-1b HONEST NULL shows index-first is NOT
      universally better at current scale — an ambient aggressive workflow
      instruction would be wrong guidance today. The descriptions are
      nuance-aware instead. Revisit together with the flip re-open
      trigger. -->
- [x] Mirror the discipline into the `memory` pack rule text for MCP-less
      hosts (D4).
      <!-- done 2026-07-08: docs/guidelines/agent-infra/memory-access.md
      (the canonical memory-access surface rules/skills cite) carries the
      index-first workflow with the honest-null nuance (broad queries yes,
      precision lookups no) + the CLI --detail flags. -->

**Exit:** the index-first instruction is host-natively present whenever the
MCP server is connected; per-host rendering verified.
**Rollback:** description text revert.

## Phase 3 — `chat_history_read` timeline anchor

- [x] Add `around: <entry-ref>` + `depth_before`/`depth_after` (defaults 3/3)
      to `chat_history_read`; JSONL is chronological, so this is slicing, not
      indexing. Entry ref = session id + line offset or the entry's existing
      id field.
      <!-- done 2026-07-08: ref = 0-based ordinal in the FULL chronological
      list (header excluded, pre-filter — stable for the append-only log;
      rotation invalidates, documented). read_entries_with_refs +
      slice_around in chat_history.ts (read_entries delegates —
      behaviour-preserving, 41/41 existing tests green); MCP schema gains
      around/depth_before/depth_after (defaults 3/3). -->
- [x] Index-mode rows for history too: timestamp + `t` tag + first ~100 chars
      + `~tokens`, full entries on explicit request (same `detail` parameter,
      same default-preserving rollout).
      <!-- done 2026-07-08: history_index_row (ref, t, s, ts-ish field when
      present, 100-char preview, real-tokenizer estimate via the shared
      lazy helper); detail param on chat_history_read, default full
      byte-preserving. History entries are LARGE (unlike precision memory
      hits), so this is where index mode actually pays. -->

**Exit:** anchored context recovery without loading a whole session.
**Rollback:** parameter removal.

## Phase 4 — Knowledge-chunk index mode (`memory_retrieve`)

- [x] Index rows for knowledge chunks: `ingest-id/chunk-n`, first line,
      pinned flag, `~tokens` (2 KB chunks ≈ ~500 tok each — exactly the size
      class where price tags change fetch behaviour).
      <!-- done 2026-07-08 (adapted): chunks flow through the unified
      memory_lookup index path since P1; this step added the `pinned` flag
      to knowledge index rows (id is already ingest-id:chunk-n, title falls
      back to the first body line, ~tokens shared). -->
- [x] `memory_get` accepts chunk refs; redaction guarantees unchanged (index
      rows are derived from already-redacted chunk files, never the source).
      <!-- done 2026-07-08: memory_get_v1 resolves chunk ids (tested:
      install-contract:chunk-000); index rows read the chunk FILES (the
      post-redaction artifacts), never the ingest source. -->
- [x] Add the replay set's knowledge queries to the Phase-0 rig; measure.
      <!-- done 2026-07-08: q-22..q-24 in the replay set — the ONLY
      consistently positive economy cases (+54.4%/+35.5%/−12.3%), exactly
      the large-payload class the roadmap predicted. -->

**Exit:** chunk retrieval follows the same two-phase economy, measured.
**Rollback:** as Phase 1.

## Phase 5 — Compact session-start memory index (opt-in)

claude-mem injects a 50-row compact index at SessionStart. Our `memory-load`
is deliberately opt-in-full ("never auto-triggered") — that stance holds.

- [x] Add an opt-in consumer setting (`memory.session_index: off|on`, default
      **off**) that, when on, emits a compact index of curated entries
      (titles + IDs + `~tokens`, hard cap ~30 rows / measured token ceiling)
      at session start via the existing hook surface.
      <!-- done 2026-07-08: src/scripts/session_memory_index.ts (rows via
      retrieve_v1 detail:index over CURATED_TYPES, cap 30, spotlighted
      <memory-index> DATA block, bodies never injected) wired into
      hot_context_hook.ts session_start (lazy createRequire — the
      default-off path pays nothing); setting documented in
      agent-settings.template.yml; YAML-1.1 `on`→true handled. 6 tests. -->
- [x] Measure on the replay set: does the index improve memory HIT RATE
      (model fetches a relevant entry it otherwise missed) enough to justify
      its fixed cost? Ship-criterion: hit-rate gain at ≤N tok fixed cost, N
      set from the Phase-0 baseline. Miss → stays off, honest-null.
      <!-- measured 2026-07-08 (deterministic arm): fixed cost = 486 tok for
      23 rows on the replay fixture corpus (real tokenizer; ~6.9% of the
      7,092-tok Phase-0 full baseline; session_index_cost() +
      regression-capped <1500 tok in tests). The HIT-RATE arm needs a live
      paired model run (same class as the P1b judge arm — out-of-band);
      it has NOT been run → per ship-criterion the default STAYS OFF.
      Outcome: mechanism shipped opt-in, default off, honest. Re-open
      together with the P1b flip trigger. -->

**Exit:** evidence-backed default (off unless proven), setting documented.
**Rollback:** setting removal; default was off throughout.

## Phase 6 — FTS5 pre-decided activation path (write, don't build)

> Engine conflict resolved 2026-07-08 (tie-break council claude-sonnet-4-5 +
> gpt-4o, converged): the pre-decided engine is SQLite FTS5 via Node's
> built-in `node:sqlite` (in-repo precedent: `mcp_telemetry_store.ts` —
> lazy import + runtime guard for Node < 22.5, zero npm deps), NOT
> `better-sqlite3`, NOT a minisearch dependency, NOT a per-domain fork of
> `corpus-grounding/bm25_search.ts` (ADR-061 engine-fork ban; memory lookup
> is a Reference operation, never a grounding corpus). The
> `second-brain-delta-verdict.md` Q4 "minisearch-class" wording is
> superseded — see ADR-116.

- [x] Extend the `lint_knowledge_scale` tripwire doc: when intake/curated
      volume crosses the threshold, the named path is SQLite FTS5 over the
      memory files (claude-mem's trigger-maintained shadow-table pattern,
      `SessionSearch.ts:78ff`, is the reference), replacing `_score()`'s
      substring pass — NOT a worker, NOT Chroma (D3, D5). Engine pinned to
      `node:sqlite` per the note above; index persisted gitignored under
      `agents/runtime/state/`; re-index is batch/lazy (post-session or
      first-lookup), never inline per write during active sessions.
- [x] Write the measurement-at-activation clause into the pre-decided path
      (do NOT pre-build the harness — the honest lift at today's corpus is
      zero by construction): when the tripwire fires, reuse the Phase-0
      replay set to compare the grep/substring baseline vs the FTS5
      candidate on the then-current corpus BEFORE building; ship only on
      measured retrieval lift, else record the honest-null and keep grep.
      Clause recorded here, in ADR-116, and in the verdict Q4 amendment;
      its execution belongs to fire time, not to this roadmap.
- [x] Record the decision + reference in `docs/decisions/` so activation is a
      wiring task, not a design debate.
      (`docs/decisions/ADR-116-memory-tripwire-activation-path.md`)
- [x] Migrate any remaining "pre-decided BM25 CLI" / "minisearch" wording in
      stable artifacts to the unified FTS5 path — swept `src/ docs/ agents/
      dist/` for both terms 2026-07-08: verdict Q4 + tripwire table and
      `road-to-flow-learnings.md` non-goals amended; zero stragglers remain.

**Exit:** the scale escape hatch is pre-decided, single-engine, and
referenced; firing the tripwire needs measurement, not debate.
**Rollback:** n/a — documentation.

## Phase 7 — Candidate ledger: AST-folded code reading (documentation only)

- [x] Add claude-mem's `smart_search`/`smart_unfold` (tree-sitter folding with
      per-symbol token counts, unfold on demand) to the token-program backlog
      as a CANDIDATE with a kill criterion: build only if a measured replay of
      real code-reading tasks shows ≥X% token cut vs the host's native
      read/grep at equal task success — and only if no host-native folding
      surface covers it first. Note the overlap risk with host tooling
      explicitly.
      <!-- done 2026-07-08: recorded in road-to-token-saving.md Phase 10
      (backlog umbrella) — X pinned to 30%, kill criterion = host-native
      folding/navigation surface lands first (overlap risk named HIGH);
      zero build, per the phase's documentation-only scope. -->

**Exit:** candidate recorded with falsifiable ship/kill criteria; zero build.

## Non-goals

- Write-time LLM observation generation (claude-mem's provider pipeline) —
  our curation is human-gated by design; auto-generation would bypass the
  admission gate and add unmetered LLM cost.
- Any always-on worker/service, Chroma, Postgres runtime.
- Adopting the "90%" framing in our own docs — our claims cite the Phase-0
  replay numbers or nothing.
