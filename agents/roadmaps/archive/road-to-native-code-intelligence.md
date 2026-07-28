---
status: completed
complexity: heavy
---

# Road to native code intelligence — own the engine, sweep the rejected inventory, keep the gates

> **CLOSED 2026-07-28 — engine built, measured, and retired on its own
> evidence.** Phases 0–4 landed (ADR-124 doctrine, the reclassification
> sweep, and the native engine: extract/build/query/detect/affected/update +
> the `code-intelligence` skill + the PreToolUse nudge — all merged and
> working). **Phase 5 is CANCELLED on a failed precondition**, and Phase 6
> closed out. The outcome is an honest null, not a shipped capability: the
> graph measured recall **0.365 vs disciplined grep 0.797** (Δ −43.2 pp) on a
> separate pre-registered 2-arm run, so `code_graph.enabled: false` is
> permanent with a deprecation date. See Phase 5 for why that is recorded as
> *cancelled* rather than *superseded* — the distinction is the whole
> protocol-integrity point, and it was the council's one substantive
> amendment.
>
> **What this roadmap is now useful for:** it is the durable record that a
> Class-A native engine was actually tried, at full build cost, and did not
> pay off. Read the Phase-1 table row and Phase 5 before proposing the next
> one. The lesson the null bought: **measure against the cheap baseline
> before building the engine, not after.**
>
> **Superseded resume condition (for the record):** this file previously said
> "resume when `benchmark-spend-authorization` is granted AND a consumer-scale
> corpus is available". That spend was never granted and is no longer owed —
> the decision it would have funded was reached by a cheaper run that
> falsified the benchmark's own precondition.
>
> Council 2026-07-28 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
> $0.10). Round 1: both members independently recommended closing Phase 5 and
> executing Phase 6. Round 2 (blind rebuttal round) tightened the framing —
> `CANCELLED (precondition failed)`, never `SUPERSEDED`, because a
> pre-registration exists to prevent substituting a cheaper measurement even
> when the substitute reaches the correct conclusion; research registries
> record *terminated, with reason*, not *superseded by a different design*.
> The dissenting demand (show that recall bears on the correctness
> precondition) is answered by the decision rule's own text: every branch is
> gated on "at non-inferior correctness", and recall is a direct correctness
> measurement. Recorded revisit condition: a consumer case the graph answers
> and grep cannot reopens the engine (`docs/MIGRATION.md` § Scheduled
> deprecations).

> **Supersedes** `skipped/road-to-code-graph-orchestration.md` (2026-07-23,
> same-day draft) after the maintainer's directive: the "orchestrator only"
> framing is reversed. Depends on **ADR-124 (embedded-engine doctrine,
> `docs/decisions/ADR-124-embedded-engine-doctrine.md`, proposed)** — Phase 0
> carries its landing. This repo verified at `cbc167a` (9.7.0); external
> reference **Source G** verified at its `2fa6cd3` (Apache-2.0/MIT).
>
> What carries over unchanged from the superseded draft: the pre-registered
> falsification thresholds (S0a/S0b), detection + adapter for consumer-shipped
> indexes, the PreToolUse soft nudge, staleness governance, the
> injection-sanitization risk rows, and the honest-benchmark protocol. What
> changes: those pieces become the *interop tier* of a capability this suite
> now also **builds natively**.
>
> **Feasibility + audit corrections baked in (2026-07-23, three-role review):**
> (1) the package ships 13 runtime npm deps — no "first dependency" or
> zero-dep claim anywhere; (2) engine code must never be imported by
> `src/scripts/install.ts` (the esbuild install bundle cannot inline
> Emscripten WASM loading) — CI-guarded; (3) perf ceiling kept at ≤60 s cold
> but expectation set at ~10–20 s; (4) the confidence taxonomy is honest about
> dynamic dispatch: AMBIGUOUS-with-candidates is the *expected default* for
> dynamic method calls and facades; (5) WASM distribution = dependency on
> exact-pinned `tree-sitter-wasms` + `web-tree-sitter`, no vendoring, ABI
> smoke test in CI; (6) `discovery_graph.ts` conventions reused verbatim;
> (7) determinism via byte/node caps + canonical serialization, never parse
> timeouts.

## Goal

Land ADR-124, re-evaluate every engine rejected under the old interpretation,
and build the first native Class-A engine: a deterministic, embedded
code-graph (extract → build → query/path/explain/affected) over consumer
codebases — WASM-parsed, LLM-free, default-off, benchmark-gated to default-on,
with the interop tier still preferring a consumer-shipped index when one
exists and is fresh.

## Sequencing plan (the queue — order is binding)

1. **This roadmap, Phase 0** — ADR-124 ratification + contract reconciliation.
2. **This roadmap, Phase 1** — the reclassification table lands (the
   engine-reclassification-2026-07 decision doc, first Phase-1 checkbox
   below); it is the single intake path for every further engine.
3. **This roadmap, Phases 2–4** — native engine v1 (extract/build/query/wire).
4. **This roadmap, Phase 5** — benchmark verdict published. **Hard gate:**
   nothing below starts before this verdict exists (ADR-124 sequencing rule).
5. **Queue behind the verdict** (parked as `later/` roadmaps, each naming its
   unblock trigger):
   - `later/road-to-deferred-rule-retriever.md` — command-invoked Class-A
     variant of the rejected MCP retrieval *server*.
   - `later/road-to-policy-evaluation-core.md` — deterministic
     policy-evaluation core (Class-A slice of the rejected resident
     enforcement plane).
   - Any additional Class-A re-opening exits the Phase-1 table only with a
     named demand signal + its own roadmap; nothing starts on "two models
     suggested it".

## Non-goals (redrawn per ADR-124, not removed)

- NO Class-B artifacts: no watcher daemon, no index *server*, no resident
  process, no web console. Incremental refresh is command-invoked
  (session-start- or hook-triggered), never resident.
- NO Class-C build path: graph construction is deterministic; zero
  LLM/network. Embeddings stay behind ADR-061's measured-recall-failure
  doorway.
- NO clustering/viz parity chase with Source G in v1 (community detection,
  HTML force-graph, media ingestion): capability floor first — each garnish
  item needs its own demand signal.
- NO native-compiled (node-gyp) parser bindings — WASM only (ADR-124 § 1).
- Falsifiability gates stay (ADR-124 § 3): default-off, pre-registered
  thresholds, honest-null publication, spend authorization for judged runs.

## Prerequisites — verified at `cbc167a`

- PreToolUse dispatch live (`hooks/hooks.json` → `dispatch_hook.ts`);
  registration pattern = `src/scripts/hook_manifest.yaml` `concerns:` entry +
  per-platform `pre_tool_use:` list; nudge-precedent handlers:
  `rtk_wrap_hook.ts`, `design_slop_hook.ts` (both `fail_closed: false`).
- Edge schema + versioned atomic cache pattern in `discovery_graph.ts`
  (REUSED — same `EXTRACTED/INFERRED/AMBIGUOUS` enum, exit codes 0/1/2/3,
  checksum-addressed cache, atomic writes; the native engine emits the same
  `graph.json` shape, so interop adapter, query layer and future consumers
  are one code path).
- BM25/trigram core (`_lib/lexical_index.ts`) for the lexical side of hybrid
  node-matching.
- Bench + κ-judge infrastructure (`internal/bench/<name>/` convention:
  `README.md` + baseline/treatment settings pair + `corpus/` + committed
  `*-results.md`); Claims Ledger gate in CI. NOTE: there is no
  `internal/spikes/` — spike artifacts follow the same `internal/bench/`
  convention.
- ADR-123 spawn hardening (`_lib/spawn_env.ts::hardenedSpawnEnv()`) — every
  subprocess the engine spawns routes through it (`docs/spawn-site-policy.md`).
- Settings key precedent for the nudge: the `hooks.*` family
  (`hooks.rtk_wrap.enabled`, `hooks.design_slop.enabled` — default-OFF) in
  `src/config/agent-settings.template.yml`.

## Phase 0 — ADR-124 landing + contract reconciliation

- [x] Land ADR-124 (council ratification round 2026-07-23 on *wording*,
  1 round, sonnet-4-5 + gpt-4o; three convergent patches folded in; status
  flipped `proposed`→`accepted`, round recorded in References; ADR INDEX
  regenerated).
- [x] Reciprocal supersession banners: add `superseded_by: ADR-124
  (engine-adoption interpretation only)` notes to ADR-088 and ADR-094 (house
  precedent: ADR-098's partial-supersession frontmatter), so the partial
  supersession is machine-visible from both directions; regen INDEX.
- [x] Contract reconciliation per ADR-124 § 6, same change-set:
  `no-runtime-boundary.md` build-artifact carve-out ·
  `docs/comparison.yaml` row 1 rewording ·
  `external-code-graph-interop.md` ceiling amendment ("orchestrator first,
  owner where it wins" — grep-fallback wording and the "say so" honesty
  clause stay verbatim).
- [-] **Falsification spikes** — SKIPPED here (no peer CLI installed + no
  consumer-scale repos available locally). Per the phase note below, these are
  optional evidence, not a build gate under ADR-124; the S0a protocol runs as
  Phase 5's three-arm bench once tooling + spend are authorized. **Falsification spikes (optional evidence, not a build gate under
  ADR-124):** S0a (token delta: scoped graph-query output vs disciplined
  `rg`+targeted-read transcripts, 10 structure questions × 2 consumer-shaped
  repos, pre-registered threshold median ≥2.0× at equal correctness) and S0b
  (staleness cost: 20-commit-old graph on 5 questions; ≥2/5 misleading →
  staleness governance is a BLOCKER for any default-on). BLOCKED locally
  today: requires the peer CLI (not installed) or waits for the native engine
  — in which case the same protocol runs as Phase 5's three-arm bench. The
  thresholds gate **default-on and sequencing priority**, no longer
  existence; a null result demotes the remaining build phases behind
  adoption-gap work (recorded here) — it does not archive them.

## Phase 1 — Rejected-engine re-evaluation sweep (ADR-124 § 4)

- [x] `docs/decisions/engine-reclassification-2026-07.md` — one committed
  table, every engine-shaped REJECT 2026-06-01 → 2026-07-22, columns:
  source cycle · engine · old verdict (quote) · ADR-124 class · new
  disposition · gate. Population inventoried 2026-07-23 (44 entries across
  active/archive/later/skipped/stubs); anonymization per house style. The
  headline dispositions to carry:
  - **Code-graph engine (Source G class) → A → RE-OPENED, this roadmap.**
    **CLASS-A ADOPTION TRIED AND MEASURED → HONEST NULL (2026-07-28).** The
    pre-registered `<1.2×` branch's mandated record: the engine was built
    (Phases 2–4, merged and working), measured against disciplined grep on
    real consumer-shaped repos, and lost decisively on correctness (recall
    0.365 vs 0.797, Δ −43.2 pp; `docs/CLAIMS.md`
    `code-graph-retrieval-null`). Disposition: `code_graph.enabled: false`
    permanently, deprecation at the next major per `docs/deprecations.md`.
    This row is the durable answer to "was Class-A adoption actually tried?"
    — yes, once, at full build cost, and it did not pay off. Read it before
    proposing the next Class-A engine.
  - Lexical/BM25 in-process core → A → already shipped
    (`_lib/lexical_index.ts`); no action. Embedded FTS5 (`node:sqlite`) → A →
    stays pre-decided behind its ADR-116 tripwire; note honestly that the
    ADR-116 engine was never built and the amendment re-resolved it.
  - MCP deferred-rule retrieval **server** → B (resident server — the
    defining trait is residency, per ADR-124 § 1's own enumeration "MCP
    *servers* run as … backends"; Class C is about network/LLM in the *build
    path*, and an MCP server can run stdio without any network) → re-affirmed
    REJECT in core; a *command-invoked* deferred-rule retriever (no server)
    is Class A → queued (`later/road-to-deferred-rule-retriever`), unblock =
    flow-learnings' three re-open conditions converting to a demand signal +
    the Phase-5 verdict.
  - SQLite memory **service** / vector clocks / distributed memory → B →
    re-affirmed (the Class-A slice is already covered).
  - Browser daemon + compiled runtime (operator harvest) → B → re-affirmed,
    plugin routing stands.
  - Resident enforcement/control plane (Source A/E family) → split: resident
    plane B (re-affirmed); its *deterministic policy-evaluation core* → A →
    queued (`later/road-to-policy-evaluation-core`), demand-gated, NOT
    scheduled here (sequencing rule).
  - Swarm/topology actor runtime, work-stealing, load balancing (Source F —
    the orchestration-runtime reference) → B → re-affirmed (ADR-088 gloss
    corrected in the table: the binding text is the 2026-07-07 council
    REJECT, not ADR-088 itself).
  - Web console / live monitoring UI / Electron control plane → B →
    re-affirmed.
  - Vector/embedding index build → C (model-dependent build path) →
    re-affirmed; ADR-061's measured-recall-failure doorway remains the sole
    entry.
  - Skill-graph / workflow-graph engine → A but STAY KILLED (duplicates the
    in-process `work_engine/` directive graph — redundancy, not identity).
  - Projection-target registry, per-skill capability registry, task-classifier
    class → A → re-affirmed CLOSED on demand/redundancy grounds; class cited
    so the reason is no longer misattributed to the runtime identity.
- [x] Each re-affirmation cites its class; each re-opening names its gate.
  Cross-check the table against the planned no-runtime config-surface guard
  (parked in the contract-integrity later-roadmap) — the required denylist
  exception is recorded in the table's "Config-surface guard obligation"
  section (ADR-124 § 6 obligation).
- [x] Council sees the doctrine in the ratification round — the round sealed
  ADR-124 (incl. its § 4 sweep mandate) that this table mechanically executes;
  the 44-row table is committed in the same change-set for the on-record sweep.

## Phase 2 — Native engine v1: extract + build (Class A)

- [x] Dependencies: `web-tree-sitter@0.24.7` + `tree-sitter-wasms@0.1.13`,
  exact-pinned. **ABI note (grounded 2026-07-23): the current 0.26.x +
  0.1.13 pair FAILS `Language.load` (tree-sitter #5171 ABI drift); 0.24.7 is
  the version whose ABI-14 range matches the 0.20/0.22-cli-built grammars.**
  install.ts import-guard test added; CREDITS.md runtime-dependency rows
  added (web-tree-sitter MIT, tree-sitter-wasms Unlicense). Cache is the
  gitignored build artifact `agents/runtime/state/code-graph-v1.json`.
  &nbsp;
- [x] **ABI smoke test** in CI (`tests/scripts/code_graph.test.ts` → "ABI
  smoke" block): loads each launch grammar, asserts `language.version === 14`
  (the pinned ABI), and parses a fixture per language. A dependency bump that
  breaks the ABI turns this test red at PR time.
- [x] `src/scripts/code_graph/` module family shipped — `types.ts`,
  `loader.ts` (cached parser, ABI assertion, tree-delete-not-parser-delete
  per the feasibility audit), `extract.ts` (per-language walk + honest
  taxonomy), `build.ts` (language-scoped symbol resolution, path confinement,
  byte cap, deterministic serialization), `validate.ts`, `cli.ts` (build /
  validate; query tier is Phase 3). Verified: byte-identical repeat build;
  language-scoped resolution (no PHP↔TS bleed); self-build over the repo's own
  `src/` = 826 files / 12,285 nodes / 68,169 edges, confidence split
  EXTRACTED 37.5k / INFERRED 170 / AMBIGUOUS 30.5k (the honest dynamic-dispatch
  majority the audit predicted).
- [x] Perf budget: self-build (826 files, mixed PHP/TS/JS) completed cold in
  **~2.3 s** — an order of magnitude under the ≤60 s ceiling and inside the
  ~10–20 s expectation. Full ~100 k-LOC consumer-repo timing rides Phase 5
  (needs a consumer-scale repo not available locally).

**Acceptance (partially met — fixture + self-build; full external-repo
acceptance rides Phase 5):** the honest confidence taxonomy is verified on a
hand-labeled PHP+TS fixture (the code_graph test's taxonomy block — `$this->`
resolved = INFERRED, facade/dynamic = AMBIGUOUS-with-candidates, `new`/import =
EXTRACTED); no-network is a structural test (no engine source imports a net
module); repeat-build byte-equality is green; ABI smoke is green. The
30-edge-per-repo hand-verify over two **consumer-scale** repos is deferred to
Phase 5, which requires those repos + spend authorization anyway.

## Phase 3 — Query tier: one engine, two sources

- [x] `query.ts` — `query|path|explain|affected` shipped (BFS/DFS, `--budget`
  token cap, hybrid seed-matching: exact id → exact label → BM25 via
  `_lib/lexical_index.ts`). Source-agnostic (native cache or `--graph <path>`);
  every answer prints a `source:` attribution line. Verified live on the
  repo's own graph: `query LexicalIndex` → members; `affected sanitizeLabel`
  → correct reverse-BFS callers.
- [x] `detect.ts` — shipped: consumer `graph.json` shape-validation (native +
  foreign shape), `*.scip` presence-only ("peer tooling required", no owned
  reader), native cache; freshness via embedded `head_at_build` SHA
  (`commits_behind`) else mtime-vs-`git log -1 %ct`; `pickSource` precedence
  (fresh consumer > native > stale consumer) unit-tested. git calls route
  through `hardenedSpawnEnv()` (ADR-123).
- [x] `affected --since <ref>` — git-diff-seeded impact BFS shipped (diff
  `ref..HEAD` → changed files → their nodes → reverse-BFS); cited as an
  optional pre-step in the `verify-repair-loop` skill's See-also (cited, not
  duplicated).
- [x] All retrieved **string fields** — node labels, targets, candidates —
  pass `sanitize.ts` before context re-entry: codepoint-level stripping of
  C0/C1 controls, zero-width, bidi-override/isolate, BOM (hidden-instruction
  vectors) + length cap; independently reimplemented; unit-tested.

**Acceptance:** the 10-question structure set answered from the native graph
with correct scoped output; source-attribution line present in every answer;
`--budget 1500` never exceeded (measured); fixture `graph.json` (10 nodes) +
malformed variants covered by tests.

## Phase 4 — Behavior wiring: make agents actually use it

- [x] `code-intelligence` skill shipped (`src/skills/code-intelligence/`,
  engineering workspace, packs: meta) — routes structure questions to
  `code_graph detect|query|affected|path` first, grep fallback with the
  honesty clause; source-attribution + confidence-preservation Output reqs;
  lint-skills green. `external-code-graph-interop` See-also routes here.
- [x] PreToolUse **soft nudge** shipped — default-off (`hooks.code_graph.enabled`),
  handler `src/scripts/hooks/code_graph_nudge_hook.ts` registered in
  `hook_manifest.yaml` (pre_tool_use, `fail_closed: false`), once-per-session
  latch, warn-only (never blocks — Source G's strict block-first-read
  un-ported), branches present→query / stale→rebuild / absent→build-offer.
  Tested (enabled-gate, tool eligibility, branch selection).
- [-] Freshness loop — **partially done; the deferred remainder is now
  CANCELLED (2026-07-28), not silently archived.** The shipped half stands
  (the nudge's stale branch). The two deferred pieces — a dedicated
  session-start freshness hook and an installer-offered post-commit git hook —
  are cancelled because the capability they would keep fresh is permanently
  `enabled: false` and scheduled for deprecation (Phase 5 above): adding
  session_start concern budget (already 9>8) and installer scope to maintain
  freshness for a deprecating default-off index is spend against a retired
  path. Re-opens only with the engine itself (the `docs/deprecations.md`
  reversal condition: a consumer case the graph answers and grep cannot).
  Original text, for the record:
  Staleness IS surfaced:
  the nudge's stale branch tells the agent "index N commits behind — rebuild".
  A *dedicated session-start* freshness hook is deferred (the session_start
  concern budget already warns at 9>8; adding one worsens it for marginal gain
  over the read-path nudge), and the *installer-offered opt-in post-commit git
  hook* is deferred as installer-scope work — both recorded here, neither
  blocking the capability.
- [x] Incremental `--update`: re-extract only files whose content hash
  changed (per-file extract sidecar), reuse the rest, rebuild the full graph
  — **byte-identical to a cold build** (buildGraph is pure over extracts;
  update is a speed win, never a semantic one). Also fixed a symlink-path
  confinement bug (macOS `/tmp`→`/private/tmp`, symlinked checkouts). Tested.
- [x] Interop routing + host degradation: `external-code-graph-interop`
  See-also routes to `code-intelligence`; `docs/enforcement-by-host.md` gains
  the graceful-degradation sentence (hook hosts → nudge; instruction-file hosts
  → rule + skill). No new rule files (surface consolidation holds). The release
  `consumer-matrix` needs no row — the hook rides hook_manifest→install→`hooks:doctor`.

**Acceptance:** transcript tests — fresh graph + first Grep → exactly one
nudge; second Grep → none; stale graph → no nudge + one staleness line;
no-index → build-offer branch; all hosts' rows updated.

## Phase 5 — Honest benchmark → default decision

> **CANCELLED (2026-07-28) — correctness precondition failed. The
> pre-registered three-arm token-reduction benchmark was NOT run.**
>
> **Precondition falsified by:** the 2-arm deterministic retrieval benchmark
> in `road-to-feedback-9.8.0-followups` Phase 2 (archived) — 18 hand-verified
> code-structure questions across 3 real consumer-shaped repos, ground truth
> hash-bound before the run, zero model calls. Native graph mean recall
> **0.365 vs grep 0.797** on graph-shaped questions (**Δ −43.2 pp** against a
> pre-declared +10 pp win threshold); 0.111 vs 0.833 on negative controls.
> Measured root cause: TS arrow-function exports produce no symbol nodes
> (170 TS vs 13,428 PHP symbol nodes on same-shaped repos) and string-keyed
> dynamic consumers have no static edge.
>
> **Why cancelled, not "superseded"** (council-mandated distinction, see
> § Council notes — Phase-5 disposition): every branch of the decision rule
> below is gated on *"at non-inferior correctness"*. That gate provably
> fails by 43.2 pp, so the token-reduction measurement became **impossible to
> perform as specified** — not "answered by a cheaper substitute". A
> pre-registration exists to prevent measurement substitution even when the
> substitute reaches the correct conclusion; recording this as SUPERSEDED
> would license optimizing away any expensive pre-registered protocol
> whenever a cheaper run lands on the same decision. Research registries
> record *terminated, with reason* — never *superseded by a different
> design*. This protocol stays in the file as what WOULD have been measured
> had the precondition held.
>
> **The decision the phase existed to make is already made and bound** — and
> it is identical to what the `<1.2×` branch below mandates (honest-null
> exhibit, engine stays maintainer-workspace-only): `docs/CLAIMS.md`
> `claim: code-graph-retrieval-null` (`status: backed`, `last_verified:
> 2026-07-28`) + `src/config/agent-settings.template.yml`
> `code_graph.enabled: false` ("is permanent"; deprecation at the next major,
> removal the major after, unless a consumer case the graph answers and grep
> cannot appears first — tracked in `docs/deprecations.md`, not here).

- [-] Pinned bench under `internal/bench/code-graph/` (house convention:
  `README.md`, settings pair, `corpus/`, committed results): the S0a protocol
  formalized — golden questions committed, **three arms** (native graph /
  disciplined grep / consumer-shipped index where available), grader rubric
  written before the run, second-judge κ sample per the 9.5.0 house pattern.
  **Spend gate:** the judged run is billable — surfaced to the maintainer,
  never auto-fired (`benchmark-spend-authorization`).
- [-] **Confound controls (council patch, 2026-07-23) — pre-registered with
  the question set, hash published before any arm runs:**
  - Question-set selection bias: questions sampled from real issue shapes on
    consumer-style repos, balanced mix pinned in the rubric (~40 %
    control-flow / ~30 % data-flow / ~20 % structural / ~10 % text-search) —
    never hand-picked graph-favoring queries.
  - ≥30 % of questions target dynamic-dispatch patterns; an
    AMBIGUOUS-with-candidates answer scores half-credit (true target among
    candidates), so the graph arm cannot bank on unrealistically resolvable
    code.
  - ≥20 % of questions are grep-optimal on purpose — the bench must surface
    regressions on trivial lookups, not only wins on structural ones.
  - Cold-build amortization: token/time accounting runs per simulated
    session (≥5 queries/session), not per isolated query, so the build cost
    is honestly amortized rather than hidden or over-weighted.
- [-] Decision rule, pre-registered: median ≥2.0× token reduction at
  non-inferior correctness → `code-intelligence` skill projects
  **default-on** for engineering workspaces (nudge stays opt-in); 1.2–2.0× →
  ships default-off with the numbers in the README; <1.2× → honest-null
  exhibit, engine stays maintainer-workspace-only, and the Phase-1 table
  gains a row recording that Class-A adoption was tried and measured.
- [x] Claims Ledger: pre-run ceiling claim only ("native deterministic code
  graph; savings pending"); post-run claims bind to the bench row. CI gate.
  <!-- done 2026-07-28: the ledger obligation was MET on the substituting
  path, not skipped — `docs/CLAIMS.md` carries `code-graph-retrieval-null`
  (kind: quant, status: backed, evidence pointer
  internal/bench/reports/code-graph-vs-grep.md#Verdict), and `check-claims`
  gates it like every other backed row. No ceiling claim survives anywhere:
  the null IS the published claim. -->

**Phase-5 exit (recorded, 2026-07-28):** cancelled on a failed precondition;
the default-decision it existed to produce is bound in the claims ledger and
shipped in the settings template. Per the pre-registered `<1.2×` branch, the
Phase-1 inventory table gains the Class-A-adoption-measured row below.

## Phase 6 — Close-out

- [x] Regenerate `CAPABILITIES.yaml` (`generate_capabilities_index.ts`);
  `docs/comparison.yaml` verdict vs Source G updated to "builds natively
  (launch-set languages) + interops"; positioning language per ADR-124
  Consequences.
  <!-- done 2026-07-28: `generate_capabilities_index.ts` re-run → byte-identical
  (30 areas, `code-intelligence` already listed), so the index needed no change
  and that is now VERIFIED rather than assumed. The comparison row is the part
  that was genuinely missing — `docs/comparison.yaml` had NO code-graph row at
  all. Added one, but NOT with the wording this step pre-specified: "builds
  natively + interops" became false the moment the retrieval null landed. The
  shipped row states the honest version — built natively, measured against
  disciplined grep, lost on recall (0.365 vs 0.797), permanently default-off
  with a deprecation date — with `our_evidence` resolving to
  internal/bench/reports/code-graph-vs-grep.md#Verdict. `check_comparison.ts`
  green (9 rows, 9 checkable, all pointers resolve). Deviating from this step's
  own wording IS the point: the row must match measured reality, not the plan. -->

- [x] **Deprecation tracking (council sub-Q5, 2026-07-28) — added because
  archiving a roadmap must not bury a live removal commitment.** The null
  binds `code_graph.enabled: false` "permanently, deprecation at the next
  major, removal the major after". That promise lived only in a settings
  comment and in this roadmap — which is about to be archived, i.e. exactly
  how a commitment becomes folklore. Now tracked in a LIVING doc:
  `docs/MIGRATION.md` § Scheduled deprecations (a forward-looking table, the
  inverse of that file's already-shipped sections), plus a `release:major`
  pre-flight checkpoint in `docs/release-runbook.md` § 1 that sends the
  releaser there. No new file, no new CI gate, no new surface — a section in
  an existing living doc and one runbook line (surface-consolidation holds).
- [x] Anonymization debt: fix the two clear-text external-source mentions in
  `agents/roadmaps/archive/road-to-opt-retrieval-and-memory.md` (lines
  18/159 — confirmed live denylist violations of
  `external_sources_denylist.json`, documented as known debt in the
  ecosystem-harvest-index archive) so the `check-no-external-sources` gate
  runs clean without the standing exception.
  <!-- done 2026-07-28: both mentions rewritten to a neutral descriptor ("the
  maintainer's borrow catalogue", "the borrow-catalogue inbox file") — the
  token named a gitignored inbox file, so nothing load-bearing is lost. The
  `skip_paths` entry for this file was then REMOVED from
  external_sources_denylist.json (the whole point of the step: retire the
  exception, don't hold it) and `skip_reason.archived_roadmaps_newly_tracked`
  records why, plus the general preference — retire an exception whenever the
  token is neither license-required attribution nor load-bearing for the
  record. VERIFIED: `check_no_external_sources.ts` green WITHOUT the
  exception. Only src/ holds this file in the tracked tree (the .claude/
  worktree copies are separate checkouts), so no projection regen. -->

- [x] **ADR-124 sequencing rule — verdict published, consequence recorded.**
  The standing rule ("no second native engine starts before Phase 5 publishes
  its verdict") is now satisfied: the verdict exists and is an honest null.
  Council 2026-07-28 split the two halves deliberately — the null DOES count
  as the verdict for sequencing, but does NOT unblock the queue, because its
  root cause is a category limit of static indexes over dynamic code (no
  symbol nodes for TS arrow-function exports; no static edge for string-keyed
  dynamic consumers), and the queued engines are also retrieval problems over
  the same dynamic code. Both queued roadmaps'
  park headers now carry the fired-but-invalidating gate + the
  measure-before-build lesson (`later/road-to-policy-evaluation-core.md`,
  `later/road-to-deferred-rule-retriever.md`) — a false "waiting on a verdict
  that already landed" gate would have been the folklore failure. The council
  recommended archiving both outright; that is recorded there as the
  maintainer's disposition call, NOT executed here (archiving buries planned
  work, and it is outside this roadmap's scope).
- [x] Archive this roadmap with the standard verified-checkbox sweep at the
  landing SHA; the superseded draft stays in `skipped/` with its pointer
  here.
  <!-- done 2026-07-28: moved later/ → archive/ in the close-out commit; the
  skipped/road-to-code-graph-orchestration.md pointer still resolves here.
  Every checkbox in this file was swept: Phases 0-4 verified [x] as landed,
  Phase 5 [-] cancelled on a failed precondition (NOT silently archived —
  roadmap-progress-sync Iron Law 3), the Phase-4 [~] freshness remainder
  resolved to [-] cancelled with its reason, Phase 6 closed. No [ ] and no
  [~] remain. -->

## Standing blockers

- `adr-124-ratification` — Phases 2+ do not merge before the ADR lands
  (Phase-0/1 artifacts may be drafted; they ride the same PR as the ADR).
  **RESOLVED** — ADR-124 landed; Phases 2–4 merged under it.
- `benchmark-spend-authorization` — Phase-5 judged run.
  **RESOLVED WITHOUT SPEND (2026-07-28)** — never granted, and no longer
  needed: Phase 5 is cancelled on a failed precondition, so the billable
  judged run is not owed. The gate is closed by the phase's cancellation, not
  by an authorization. Recorded this way so nobody reads a closed roadmap as
  evidence that the spend was approved.
- **Sequencing rule (ADR-124):** no second native engine (policy-evaluation
  core, deferred-rule retriever, …) starts before Phase 5 publishes its
  verdict. The Phase-1 table is the queue, not a starting gun.
  **SATISFIED (2026-07-28)** — verdict published as an honest null; see the
  Phase-6 sequencing item. The queue is no longer blocked by this rule, and
  the null argues against restarting it as designed.

## Risk register

- **Scope dilution on a solo-maintained package with zero confirmed external
  users** — the loudest risk, named per house honesty: this roadmap adds a
  compiler-adjacent subsystem while the launch announcement is still
  unposted. Mitigations: the sequencing rule, the launch-set language cap,
  and one deliberate inversion — the Phase-5 bench doubles as launch-story
  material ("deterministic code graph, measured N× token reduction, $0 LLM
  build cost"), so capability and adoption push converge instead of
  competing. Recorded for honesty: the 2026-07-23 council round 1 proposed
  blocking Phase 2 on an external adoption signal; round 2 saw both members
  rebut it (capability-before-adoption causality — users do not file issues
  asking for engines they don't know are possible). The adopted middle path
  is exactly the inversion above plus the default-off gates; if the launch
  post ships and produces zero engagement across a full quarter, that IS an
  adoption datum and re-prioritizes the remaining phases behind adoption
  work.
- **ABI drift** between `web-tree-sitter` and grammar `.wasm` — exact pins +
  the Phase-2 CI smoke test; bump PRs re-run the edge-sample acceptance.
- **Call-edge precision on dynamic languages** — the honest taxonomy (most
  Laravel method calls AMBIGUOUS-with-candidates) is a *feature*, not a bug
  to hide: per-class counts published; a hand-labeled precision fixture (a
  small Laravel app) ships with the engine.
- **Stale-graph harm** — S0b promotion rule carries over; staleness always
  disclosed in query output.
- **Hostile-repo injection via parsed content** — sanitizer on every string
  field + byte caps + path confinement (Phase 2/3); fuzz fixture with
  adversarial identifiers in the test set.
- **Determinism self-sabotage** — byte caps not timeouts; canonical
  serialization; golden-checksum CI test.
