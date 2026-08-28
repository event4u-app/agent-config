---
adr: 124
status: accepted
date: 2026-07-23
decision: embedded-engine-doctrine
supersedes: ADR-088, ADR-094
supersedes_scope: engine-adoption interpretation only
superseded_by: ADR-249
superseded_scope: >-
  § 4 Class-B row only (`:111`, "Resident service / daemon … PROHIBITED in
  core"), superseded by ADR-249 on a maintainer-directed reversal. Everything
  else in this record stands: the Class-A adoption path (`:110`), the Class-C
  network/LLM build-path prohibition, the § 6 state-store test, and this
  record's own scoped supersession of ADR-088 and ADR-094.
phase: road-to-native-code-intelligence
type: structural
---

# ADR-124 — Embedded-engine doctrine: this suite may own deterministic in-process engines; the service/daemon prohibition stands

## Status

**Accepted** · 2026-07-23. **Maintainer-directed reversal** of the
engine-rejection *interpretation* accumulated across ADR-088, ADR-094 and the
archived harvest-cycle REJECT records of 2026-06/07. The council ratification
round reviewed the *boundary wording*, not the direction — the direction is a
maintainer product decision: the prior councils optimized for scope discipline
and, in doing so, systematically excluded a capability class (deterministic
code/corpus intelligence) that competing suites ship as their headline
feature. The ratification round ran 2026-07-23 (see References); its three
convergent wording patches — the tightened `--watch` termination clause, the
maintainer-approves-per-dep ladder note, and the "changes *what* the tool can
answer, not just *how fast*" state-store test in § 6 — are folded in, and the
ADR is accepted on that sealed wording.

## Context

### What the record actually prohibits (verified 2026-07-23)

The "no runtime" identity rests on instruments whose literal scope is narrower
than the posture they produced:

1. **ADR-088** prohibits **cross-vendor runtime federation**: "agent-config
   does not bridge to, or drive, external tool runtimes. It is a content suite
   (skills, rules, commands) for AI coding tools — not a runtime coordinator."
   It says nothing about whether this suite may run an in-process algorithm of
   its own. The frequently-cited gloss "no runtime orchestration (work
   stealing, load balancing)" is a harvest-cycle REJECT line (council,
   2026-07-07) that *cites* ADR-088 — it is not ADR-088's text.
2. **ADR-094** removed one specific companion package (Layer 2:
   PostgreSQL + pgvector + MCP memory server + decay engine) because "its
   PostgreSQL + MCP runtime contradicted the suite's 'no app runtime'
   positioning." It is a removal record, not a forward-looking ban list.
3. **Archived REJECT records** (council convergences, 2026-06 → 2026-07,
   quoted inline per the transient-reference rule): the MCP deferred-rule
   retrieval **server** ("council REJECT, 2026-07-07", three re-open
   conditions); "SQLite memory *service*, vector clocks, distributed memory —
   the second-brain verdict and Layer-2 sunset stand"; a web console ("no
   runtime to monitor"); a browser daemon + compiled runtime ("compiled
   runtime betrays no-runtime identity" — routed to `agent-ide-plugin`); an
   in-process swarm/topology engine ("an in-process actor runtime is
   identity-rejected").
4. **`src/rules/external-code-graph-interop.md`** codified the resulting
   ceiling: "This suite is an **orchestrator, not a competitor**: query the
   existing index first … NEVER REBUILD WHAT THE INDEX ALREADY ANSWERS." This
   is the single most on-point prior commitment against a native code-graph
   engine — an active tier-2a rule, and it is amended by this ADR (§ 2).

In practice these instruments were *interpreted* wider than written: a
2026-07-23 inventory sweep across all roadmap dispositions (active, archive,
later, skipped, stubs) found **44 engine-shaped rejects across ~30 cycles** —
harvests of at least six external references (a code-graph suite, an
orchestration runtime, a control-plane/enforcement suite, and three memory
systems) adopted **protocol discipline only** and reflexively rejected every
**engine**, including engines that are neither services nor daemons.

### The precedent — read honestly

**ADR-116** pre-decided SQLite FTS5 via `node:sqlite` — a persisted,
incrementally-updated engine, in-process — as compatible with the Layer-2
sunset: "no service, no always-on worker, zero npm dependency." Two facts keep
this precedent honest rather than convenient:

- **That engine was never built.** The activation path was re-resolved to a
  hand-rolled stdlib BM25 + trigram prefilter (`_lib/lexical_index.ts`); only
  the engine choice moved, per the ADR-116 amendment banner.
- **Its compatibility argument rested on being a zero-npm-dep Node built-in.**
  ADR-116 explicitly rejected `better-sqlite3` and a minisearch dependency
  *for being npm deps*. It is therefore precedent for "embedded engine ≠
  runtime" **in principle**, and **counter-precedent on the dependency axis**.
  This ADR does its own work on that axis (§ 1, Class A) instead of borrowing
  authority ADR-116 does not carry.

### Dependency reality

The package ships **13 runtime npm dependencies** today (fastify, commander,
execa, tsx, zod, js-yaml, the MCP SDK, …). No package-wide "zero
dependencies" commitment exists — the closest claim was a README bullet
deliberately dropped before 2.2.0. The zero-dep virtue in ADR-061/ADR-116 is a
*feature-level* stdlib preference, not a distribution-level promise. An engine
dependency is therefore a **cost to justify per adoption**, not a broken vow.

### The product goal has changed

The maintainer directs: the suite should be able to natively own capability
classes (deterministic code intelligence first) when owning them makes the
package better, closes gaps and improves agent behavior — not merely defer to
whatever index a consumer happens to ship.

## Decision

### 1. Three engine classes; the boundary moves, it does not vanish

| Class | Definition | Verdict |
|---|---|---|
| **A — Embedded engine** | Deterministic, in-process, invoked-per-command, no resident process, no listening socket, no network in the build path; state only as gitignored, rebuildable build/index artifacts under the suite's own runtime dirs (`agents/runtime/state/`). **Termination clause (council patch, 2026-07-23): a Class-A engine terminates after command completion; in-memory state never spans CLI invocations** — a memory-only long-lived process that "never touches disk" is Class B regardless of its storage story. The sole exception is an explicit `--watch` flag on a stateless file-regeneration command where (a) the process lifecycle is bounded to file-system event observation, (b) **each regeneration cycle is a fresh Class-A invocation with no shared in-memory state between cycles**, and (c) the flag emits a first-launch notice that a long-running process started; any other persistent process (REPL, server, daemon, background worker) is Class B regardless of flag naming, and the `--watch` mode itself is a Class-B escalation under § 5. Implementation preference in order: Node built-ins / stdlib → exact-pinned pure-npm or WASM dependencies (admissible with a per-dependency justification in the adopting ADR — the justification states why a lighter dependency does not suffice, and the maintainer approves it in that ADR, not in a downstream feature PR) → native-compiled (node-gyp) deps only via an explicit per-dependency exception on the same terms. Every subprocess it spawns routes through `hardenedSpawnEnv()` per ADR-123 and `docs/spawn-site-policy.md`. | **ADOPTABLE.** This suite may build, fork, or vendor Class-A engines natively. |
| **B — Resident service / daemon** | Anything with a lifecycle beyond one command: DB servers, MCP *servers* run as memory/retrieval backends, watchers, browser daemons, background workers, web consoles. (In-process actor runtimes/swarms are equally out of scope, but by the ADR-109 identity floor preserved in § 3 — not by this lifecycle definition; they can terminate within one command and are still excluded.) | **PROHIBITED in core**, unchanged. Route to `agent-ide-plugin` or a sibling package where genuinely needed. ADR-088/094 remain authoritative here. |
| **C — Network/LLM-dependent build path** | Any index/graph/corpus *build* step that requires network or model calls (embedding pipelines included — ADR-061's "embeddings only on measured recall failure" remains the sole doorway). | **PROHIBITED by default**, unchanged. Query-time LLM use follows existing council/budget governance. |

> **Class B was reversed on 2026-08-27 — see [ADR-249](ADR-249-supervised-resident-process-permitted-under-governance.md).**
> A **supervised** resident process is permitted in core, under the four
> governance conditions that record states. The row above is retained as the
> superseded text rather than rewritten, so a reader who cited it finds the
> transition instead of a silent change. **Classes A and C are unaffected**, as
> is the § 6 state-store test, and the ADR-109 identity-floor clause this row
> cites is itself only partially superseded — its `no auto-write`, `no
> in-process swarm` and `no dispatch we enforce` clauses stand.

### 2. What is explicitly superseded

- The **blanket engine-rejection interpretation** of ADR-088 and ADR-094.
  Their literal text (no cross-vendor federation; Layer-2 removal) stands; any
  archived REJECT that cites them against a Class-A engine is void and must be
  re-evaluated (§ 4).
- The **"orchestrator, not a competitor" ceiling** in
  `external-code-graph-interop.md`. New wording: "orchestrator *first* —
  query a consumer-shipped index when present and fresh; owner *where it
  wins* — the suite's native engines cover the gap when none is shipped or
  ours is measurably better." Interop behavior toward existing indexes is
  unchanged.

### 3. What is explicitly NOT superseded

- **Falsifiability-first.** Every native engine ships **default-off**,
  activates via tripwire or explicit setting, and earns default-on only
  through a pre-registered benchmark with an honest-null publication path.
  The evidence gates now govern *defaults*, no longer *existence*.
- Claims Ledger, budget/spend gates, minimal-safe-diff, source
  confidentiality, and the security posture (ADR-123 spawn hardening applies
  to every engine subprocess; the no-network floor applies to every build
  path).
- The `agent-ide-plugin` routing for genuinely runtime-shaped capability.
- ADR-109's no-runtime identity floor for subagent artifacts (no daemon, no
  auto-write, no in-process swarm, no dispatch we enforce) — a command-invoked,
  non-dispatching engine does not touch it.

### 4. Mandatory re-evaluation sweep

Every engine-shaped REJECT recorded 2026-06-01 → 2026-07-22 is re-classified
A/B/C. Class-A rejects are re-opened as candidates (adoption still demand- and
benchmark-gated); Class-B/C rejects are re-affirmed with the class cited. The
population was inventoried on 2026-07-23 (44 entries); the classification
table is committed as `docs/decisions/engine-reclassification-2026-07.md` by
the implementing roadmap — no silent re-openings, no silent re-affirmations.

### 5. Extension clause

Opening Class B (e.g., a resident index server for very large fleets) requires
its own ADR with: a named consumer demand signal, a measured Class-A failure
(the embedded engine demonstrably cannot serve the need), and a security
review under ADR-123. This clause exists so the next escalation is a decision,
not a drift.

### 6. Contract reconciliation — obligations this ADR creates

The doctrine is not landed until the published claims agree with it. The
implementing roadmap carries, in the same change-set as the first engine:

- **`docs/contracts/no-runtime-boundary.md`** — the "Cross-session persistent
  state stores" prohibition row gains an explicit carve-out: *gitignored,
  deterministic, rebuildable build/index artifacts under
  `agents/runtime/state/` are build outputs, not state stores* (they carry no
  authority, are reproducible from the working tree, and are never
  auto-written memory). One-shot subprocess spawning is already sanctioned by
  the contract's Allowed table; daemons remain prohibited. **State-store test
  (council ratification patch): if deleting the artifact changes *what* the
  tool can answer rather than only *how fast* it answers, it is a state store,
  not a build artifact — even if deterministically rebuildable.** A code-graph
  cache passes the test (deleting it only slows the next query; the answer is
  identical, recomputed from source); a learned index that enables query
  semantics absent from the source tree (vector/embedding search) fails it and
  stays Class C.
- **`docs/comparison.yaml` row 1** — "no state database" is reworded to "no
  resident database or service; deterministic, rebuildable file indexes only",
  so the machine-checked claim stays true rather than quietly weakening.
- **`src/rules/external-code-graph-interop.md`** — ceiling sentence amended
  per § 2.
- **Config-surface guard alignment** — a planned no-runtime config-surface
  guard (parked in a later-disposition roadmap) denylists `vector`/`daemon`/
  `decay`/`pgvector` keys and `setInterval`/`setTimeout` outside dev tooling.
  Its denylist must except Class-A engine surfaces when it lands, or Class-A
  engines will fail CI after this doctrine flips; this ADR is the anchor that
  guard must cite.

## Consequences

- The suite may natively own: code-graph extraction/query (first instance —
  WASM tree-sitter, Class A), lexical/FTS index engines (in-principle
  precedent: ADR-116, with the honest reading above), deterministic
  clustering/analysis over its own graph outputs, and comparable future
  engines — each behind the § 3 gates.
- **Sequencing rule:** no second native engine starts before the first has a
  published benchmark verdict. The § 4 table is the queue, not a starting gun.
- Positioning language changes from "no engines, governance only" to "no
  *resident runtime*; deterministic embedded intelligence is in scope."
  README/docs claims still bind to bench rows via the Claims Ledger.
- **Named cost:** the first engine introduces parser-class runtime
  dependencies (exact-pinned WASM). That breaks the feature-level stdlib
  pattern ADR-061/116 prize — accepted deliberately, justified per dependency
  in the adopting artifact, never silently.
- **Named risk:** scope-dilution pressure on a single-maintainer package with
  a live adoption gap. Mitigation is structural, not aspirational — the § 3
  gates, the sequencing rule, and the § 4 table as the only intake path for
  further engines.

### Addendum 2026-07-28 — the first engine under this doctrine returned an honest null

The doctrine stands; its **first application did not pay off**, and that is
recorded here rather than only in the implementing roadmap (which is now
archived).

- **What was built:** the native code-graph engine (extract / build / query /
  detect / affected / update), the `code-intelligence` routing skill, and the
  PreToolUse nudge — merged and working.
- **What was measured:** on a pre-registered 2-arm run (18 hand-verified
  questions, 3 real consumer-shaped repos, truth hash-bound before the run,
  zero model calls), the graph scored mean recall **0.365 vs disciplined grep
  0.797** on graph-shaped questions (**Δ −43.2 pp** against a pre-declared
  +10 pp win threshold), and 0.111 vs 0.833 on negative controls.
- **Measured root cause — a category limit, not a bug:** TS arrow-function
  exports produce no symbol nodes (170 TS vs 13,428 PHP symbol nodes on
  same-shaped repos), and string-keyed dynamic consumers have no static edge.
  Static indexes cannot represent dynamic dispatch or runtime-constructed
  identifiers.
- **Consequence:** `code_graph.enabled: false`, deprecation at the
  next major and removal the major after (`docs/CLAIMS.md`
  `code-graph-retrieval-null`; tracked in `docs/MIGRATION.md` § Scheduled
  deprecations). The doctrine's own § 3 gates worked as designed — they
  produced a measurement that retired the feature instead of shipping it.
- **Reopen condition, supplied by the measurement rather than by a calendar.**
  The null rests on a *category* limit, so the condition is that the category
  limit is shown not to hold: a static index that represents dynamic dispatch or
  runtime-constructed identifiers, or a TS extractor that emits symbol nodes for
  arrow-function exports at a density comparable to the PHP side (the measured
  gap is 170 vs 13,428 on same-shaped repos). Absent one of those, a re-run
  cannot move the result and is not the condition. Stated because the earlier
  wording read "`false` permanently", which asserts a permanence the
  measurement does not support — a category limit is a fact about today's
  extractor, not about all possible ones.
- **Sequencing rule — satisfied, and now advisory in the other direction.**
  The rule ("no second native engine before the first publishes its verdict")
  is met: the verdict is published. It no longer blocks the § 4 queue. But the
  null's root cause generalizes to any static index over dynamic code, so the
  queued Class-A retrieval engines (`policy-evaluation-core`,
  `deferred-rule-retriever`) carry a recorded warning to run the
  pre-registered comparison against the already-shipped cheap baseline
  (`_lib/lexical_index.ts`) **before** building, not after. That inversion —
  measure the cheap baseline first — is the concrete lesson this doctrine's
  first cycle bought, and the § 4 table row records it.
- **Not changed by this addendum:** the Class A / B / C boundaries, the
  service/daemon prohibition, and the § 4 table as the only intake path. One
  null on one instance does not falsify the doctrine; it prices it.

## Alternatives considered

- **Keep the orchestrator-only posture** — rejected by maintainer directive:
  it structurally cedes the headline capability class to peer suites and makes
  the interop rule a promise with no machine behind it when consumers ship no
  index (the common case).
- **Repeal ADR-088/094 outright** — rejected: their literal scope
  (cross-vendor federation; resident memory runtime) is correct and keeps the
  differentiation that a reversal must not destroy.
- **Class-A via native node-gyp bindings** — rejected: perpetual
  consumer-install failure tax on a solo-maintainer package; WASM carries the
  same fidelity without the toolchain.

## References

- ADR-061 (engine-fork ban; embeddings doorway) · ADR-088 (no external-runtime
  federation) · ADR-094 (Layer-2 removal) · ADR-109 (subagent contract,
  no-runtime identity floor) · ADR-116 (FTS5 pre-decision + amendment) ·
  ADR-123 (spawn hardening).
- `docs/contracts/no-runtime-boundary.md` · `docs/comparison.yaml` ·
  `docs/spawn-site-policy.md` · `src/rules/external-code-graph-interop.md`.
- Pre-landing adversarial council review: 2026-07-23, debate mode, 2 rounds,
  members claude-sonnet-4-5 (Anthropic) + gpt-4o (OpenAI). Convergence:
  A/B/C taxonomy well-drawn; the rebuildable-build-artifact carve-out judged
  honest (deterministic from source, no runtime decisions recorded, byte-stable
  rebuild) and categorically distinct from a state store; code-graph confirmed
  as the correct first engine (retriever too incremental, policy evaluator
  needs its predicate language designed first); benchmark thresholds sound.
  Adopted patches: the Class-A termination clause (§ 1) and the benchmark
  confound controls (implementing roadmap, Phase 5). A round-1 proposal to
  block engine *construction* on an external adoption signal was rebutted by
  both members in round 2 (capability-before-adoption causality; the engine is
  the differentiation the launch story needs) — the adopted middle path is the
  bench-as-launch-story inversion plus the existing default-off gates.
- Council ratification round on wording: 2026-07-23, debate mode, 1 round,
  members claude-sonnet-4-5 (Anthropic, verdict FLAG-with-patches) + gpt-4o
  (OpenAI, verdict RATIFY-with-patches). Both converged on three wording
  patches, all folded in on acceptance: (1) the `--watch` termination clause
  now requires each regeneration cycle to be a fresh Class-A invocation with
  no shared in-memory state (§ 1); (2) the dependency ladder names the
  maintainer as the per-dep approver in the adopting ADR, not a downstream PR
  (§ 1); (3) the state-store test — "changes *what* the tool can answer, not
  just *how fast*" — is added to the § 6 no-runtime-boundary carve-out, which
  explicitly keeps vector/embedding indexes on the Class-C side. No member
  flagged the direction; the round sealed the wording and the ADR is accepted
  on it.
