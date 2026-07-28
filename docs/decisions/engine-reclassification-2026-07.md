# Engine re-classification sweep (ADR-124 § 4)

> Committed 2026-07-23 as the mandatory re-evaluation sweep required by
> ADR-124 § 4. Population inventoried across every roadmap disposition
> (active, archive, later, skipped, stubs): **44 engine-shaped REJECT
> records** recorded 2026-06-01 → 2026-07-22. Each is re-classified under the
> ADR-124 class boundary — **A** (embedded, deterministic, in-process,
> command-invoked → adoptable), **B** (resident service/daemon → prohibited
> in core), **C** (network/LLM in the *build path* → prohibited by default).
>
> **Discipline this table enforces:** no silent re-openings, no silent
> re-affirmations. A Class-A re-opening becomes a *candidate* only — adoption
> stays demand- and benchmark-gated, and it enters build work solely through
> the ADR-124 sequencing rule (one native engine at a time). Class-B/C
> verdicts are re-affirmed with the class cited, so a later cycle cannot
> misattribute the reason to the runtime identity when it was really scope,
> demand, or redundancy.
>
> External references are cited by anonymized descriptor per
> `source-confidentiality`; no roadmap-file paths are linked per
> `no-roadmap-references` (this is a stable artifact).

## How to read a row

`class` is the ADR-124 verdict. `disposition`:

- **RE-OPENED (candidate)** — Class A; the old reason does not survive ADR-124;
  now gated by the named gate, not by existence.
- **RE-AFFIRMED** — the reject stands; the class is why (B = residency, C =
  network/LLM build path).
- **STAY-KILLED / CLOSED** — Class A by mechanism but re-affirmed on
  redundancy or demand grounds, not identity.

## Headline engine rejects

| # | source cycle (anon.) | engine / capability | old verdict (quote) | class | disposition | gate |
|---|---|---|---|---|---|---|
| 1 | code-graph reference (Source G) | tree-sitter / AST extraction engine | "NO tree-sitter / AST engine in this repo" | **A** | **RE-OPENED** | this roadmap; falsification + Phase-5 bench for default-on |
| 2 | code-graph orchestration (skipped v1) | vector store / embedding service / always-on daemon in index path | "NO vector store, NO embedding service, NO always-on daemon" | split | vector-store **A** if embedded-deterministic; embedding-svc **C**; daemon **B** | per-item; vector-store not scheduled (no demand) |
| 3 | flow-learnings | MCP deferred-rule retrieval **server** | "council REJECT (2026-07-07)" | **B** | **RE-AFFIRMED** (resident server; residency is the trait — an MCP server can run stdio without network) | a *command-invoked* retriever is Class A → `later/road-to-deferred-rule-retriever`, unblock = 3 re-open conditions + Phase-5 verdict |
| 4 | flow-learnings | SQLite memory **service** / vector clocks / distributed memory | "SQLite memory *service* … sunset stands" | **B** | **RE-AFFIRMED** | embedded FTS5 (`node:sqlite`) is the Class-A slice, already pre-decided (ADR-116) |
| 5 | flow-learnings | web console / live monitoring UI | "no runtime to monitor" | **B** | **RE-AFFIRMED** | — |
| 6 | flow-learnings | runtime orchestration (work-stealing, load balancing) | cites ADR-088 | **B** | **RE-AFFIRMED** | ADR-088 literal text binds (federation); the work-stealing gloss is this council line, not ADR-088 |
| 7 | operator-runtime harvest (Source A/E) | browser **daemon** + L1–L6 security | "REJECT (core) → route to plugin … compiled runtime betrays no-runtime identity" | **B** | **RE-AFFIRMED**, plugin routing stands | reopen = the three domain-adoption hypotheses |
| 8 | operator-runtime harvest | `careful`/`freeze`/`guard` runtime enforcement | "REJECT (core) → route to plugin \| no-runtime scope trap" | **B** | **RE-AFFIRMED** (adopted as discipline only) | plugin repo |
| 9 | operator-runtime harvest | skill-graph / workflow-graph engine | "STAY KILLED … `work_engine/` already runs a directive graph" | **A** | **STAY-KILLED** (redundant with in-process `work_engine/`, not identity) | evidence of a real gap `work_engine` cannot serve |
| 10 | operator-runtime harvest | `model-overlays/` per-model behavioral patch | "GATE (default-off) … falsified at current scale (honest-null); duplicates RDP" | **A** | GATED (not forbidden) | reopen if a keystone probe exposes RDP failure on a real host |
| 11 | positioning-and-enforcement (Source A) | compiled **control plane** / runtime hooks | "no daemon … compiled control plane … runtime MCP hooks = Tier-2 opt-in/experimental" | **B** | **RE-AFFIRMED** (positioning asset) | flip if >60% of active users are on hook-capable hosts |
| 12 | subagent-value-realization (Source A subagent harvest) | in-process "swarm" Map / topology **engine** + consensus voting | "CUT → an in-process actor runtime is identity-rejected (no-runtime)" | **B** | **RE-AFFIRMED** by the ADR-109 identity floor (terminates-in-command is not enough) | the routing `_lib` deterministic fns are already Class A and shipped — only the runtime shell was rejected |
| 13 | orchestration-scope-decision (active) | swarm front (100+ agents, background daemon, memory DB) | "the swarm category ships … background daemon, memory DB" | **B** | **RE-AFFIRMED** | its own honest-exit decision; competitor shape stays out |
| 14 | persona-library harvest | host-plugin runtime router | "REJECT \| ADR-109 no-runtime floor + ADR-088 … reopen only via superseding ADR" | **B** | **RE-AFFIRMED** | needs its own superseding ADR (ADR-124 does not open it — runtime router on a host is Class B) |
| 15 | persona-library harvest | BYO MCP-memory 4-tool contract | "REJECT \| heavyweight memory removed (ADR-094)" | **C** | **RE-AFFIRMED** | ADR-094 binds |
| 16 | persona-library harvest | declarative projection-target registry + semantic adapters | "REJECT (council, unanimous) \| surface-matrix already stronger; zero demand" | **A** | **CLOSED** (redundancy + demand, not identity) | per-host defer on a real logged request |
| 17 | persona-library harvest | `catalog_delegate` auto-activation tool | "REJECT \| write-adjacent auto-activation; violates default-off + ADR-109" | **A** (logic) | **CLOSED** on auto-activation policy | not engine identity |
| 18 | universal-os reframe | UI control plane (Electron / web UI) | "Reject \| explicitly 'not a runtime'; host agents provide UI" | **B** | **RE-AFFIRMED** | — |
| 19 | universal-os reframe | memory governance per domain | "Reject \| stateless YAML/MD; memory is host responsibility" | **B** | **RE-AFFIRMED** | — |
| 20 | universal-os reframe | marketplace / pack-ecosystem infra | "Reject \| zero third-party packs exist … vapor work" | **B** | **RE-AFFIRMED** | when third-party packs exist |
| 21 | small-enhancements harvest | continuous-learning auto-write store; cron/dispatch; control-pane SQLite runtime; knowledge-graph MCP | "All other harvest REJECTS … stand" | **B**/**C** | **RE-AFFIRMED** | file-first `patterns/` was the only reversal |
| 22 | agent-memory removal | Layer-2 memory (PostgreSQL + pgvector + MCP + decay + trust) | "architecturally unsound for a 'no app runtime' suite" | **C** | **RE-AFFIRMED** (canonical Layer-2 sunset origin) | — |
| 23 | memory-retrieval economy | always-on worker/service, Chroma, Postgres; write-time LLM observation | Non-goals: "any always-on worker/service, Chroma, Postgres runtime"; "write-time LLM … unmetered cost" | **B**/**C** | **RE-AFFIRMED** | embedded FTS5 is the Class-A slice, measurement-gated (ADR-116) |
| 24 | opt-retrieval-and-memory (Source G protocol) | code-graph **engine** (vectors / embedded DB / background service) | "No vectors, no embedded DB, no background service — the Layer-2 sunset" | **B**/**C** for the rejected shapes | **RE-AFFIRMED** for services; the *protocol borrows* (edge confidence, BM25, budget envelope) were Class A and already shipped | the native deterministic engine (this roadmap) is the Class-A re-opening |
| 25 | knowledge-system | vector/semantic search, transcript-RAG; runtime policy engine | "Layer-2 sunset stands … no search infra"; "runtime policy engine … CUT" | **B**/**C** | **RE-AFFIRMED** (Jaccard similarity check adopted instead — Class A) | — |
| 26 | evidence-v2 project-intelligence | DB / vector store / daemon / runtime self-modifying store | "not add a DB, vector store, daemon, or runtime" | **B**/**C** | **RE-AFFIRMED** (suggestion-gated instead) | — |
| 27 | analysis-workbench | state-machine runtime / investigation daemon | "would violate the no-runtime boundary … human-gated re-invocation, not a daemon" | **B** | **RE-AFFIRMED** | achieved via human-gated re-invocation |
| 28 | second-brain | Obsidian vault; NLI contradiction detection; static HTML renderer | "rejected 2/2 … not in scope (decided, not deferred)" | NLI **C**; HTML renderer **B**; BM25 **A** (tripwire-gated) | **RE-AFFIRMED** | HTML renderer revisit-if browsing demand |
| 29 | retrieval-substrate hardening | watch-**daemon**; engine-fork / minisearch-class dep | "watch-daemon CUT … no engine-forks (ADR-061)" | watch-daemon **B**; BM25 core **A** (shipped) | **RE-AFFIRMED** | FTS5 pre-decided path |
| 30 | capability-governance | runtime gating **engine** / generic consent machinery | "deferred until N≥2 high-risk domains" | **A**/**B** | DEFERRED (not killed) | reopen at N≥2 high-risk domains; an in-process evaluator is Class A → see `later/road-to-policy-evaluation-core` |
| 31 | governance-moat | per-skill capability registry | "DO NOT BUILD. maintainability theater with no consumer" | **A** | **CLOSED** (demand/theater, positioning asset) | — |
| 32 | mcp-distribution | native SSE server | "explicitly rejected … build a bridge, not native" | **C** | **RE-AFFIRMED** | if revived, build a bridge |
| 33 | mcp-server | tools primitive / engine spawn / state writes / shell exec (Phase 1) | "read-only and instructional … no engine spawn, no state writes, no shell execution" | **C** | **RE-AFFIRMED** (hard read-only floor) | later phases |
| 34 | loop-engineering | closed measure→adjust loops (auto-demotion/pruning, bench-drift blocking) | "REJECT auto; stays manual … no daemon per ADR-088" | **B** | **RE-AFFIRMED** (manual gate adopted) | each row's revisit-if |
| 35 | video-deferred design | skill suite behaving as a runtime | "don't build a skill suite as if it were a runtime" | **B** | **RE-AFFIRMED** (meta-guardrail governing the whole class) | — |
| 36 | mcp-runtime stub | FastMCP / MCP TS SDK (runtime additions) | "FastMCP rejected on safety-audit width; MCP TS SDK on Node-runtime addition" | **C** | **RE-AFFIRMED** | minimal low-level SDK chosen |
| 37 | originality-gate / contributor-funnel (later/) | standalone zero-config validator engine | "KEEP, demand-gated — Phase-3 probe before any extraction" | **A** | DEMAND-GATED (extractable) | ≥N external-repo signals in the 90-day probe window |
| 38 | event-driven-discipline (skipped) | move discipline onto hook dispatcher (event-driven runtime) | "CANCELLED, all steps DROPPED … multi-week engineering" | **B** | **RE-AFFIRMED** (cost-rejected) | — |

## Supporting / engine-adjacent rejects (completeness)

| # | source cycle (anon.) | item | class note |
|---|---|---|---|
| 39 | competitive-borrow | standalone queryable state-store; second similarity engine | **A** — folded into an existing in-process command; do not build a second similarity engine |
| 40 | lean-initial-context | embedding-router; rule-virtualization; task-classifier | embedding-router **C**; others **A**, "do not build unless re-opened" |
| 41 | capability-discoverability | per-skill Skill-DAG auto-chaining | **A** — rejected on a sequencing chicken-egg; reopen when a real dependency appears |
| 42 | contract-integrity (later/) | no-runtime config-surface guard (forbids `vector`/`daemon`/`decay`/`pgvector` keys, `setInterval`/`setTimeout`) | **enforcement mechanism** for B/C rejects — MUST gain a Class-A exception when it lands (ADR-124 § 6); see below |
| 43 | recursive-verification | router-learning loop; GAN builder | **B** — learning loop/daemon |
| 44 | autonomous-verify-loop | opus-pinned 3-agent GAN loop | **C** — LLM-in-loop; N=3 cap + judge discipline kept |

## Class-A re-openings — the queue (sequencing rule: one at a time)

1. **Native code-graph engine** (#1, #24) — RE-OPENED, built by this roadmap.
2. **Command-invoked deferred-rule retriever** (#3) — `later/road-to-deferred-rule-retriever.md`, blocked on Phase-5 verdict + demand.
3. **Deterministic policy-evaluation core** (#12 slice, #30) — `later/road-to-policy-evaluation-core.md`, blocked on Phase-5 verdict + demand.

No other row is scheduled. Every future Class-A adoption exits this table only with a named demand signal and its own roadmap.

## Config-surface guard obligation (ADR-124 § 6)

Entry #42 is the live enforcement point: a planned no-runtime config-surface
guard denylists `vector`/`daemon`/`decay`/`pgvector` keys and
`setInterval`/`setTimeout` outside dev tooling. When that guard lands it MUST
carve out Class-A engine surfaces (this roadmap's `code_graph/` module and the
`hooks.code_graph` setting), or Class-A engines fail CI after the doctrine
flipped. This obligation is recorded here and cited from ADR-124 § 6; the guard
roadmap, when executed, cites this file back.
