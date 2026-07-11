---
complexity: lightweight
status: ready
execution:
  mode: autonomous
---

# Road to flow learnings — adopt the real fifth of an external orchestration suite, reject the theater

> **Near-archive (verified 2026-07-12, road-to-opt-portfolio-consolidation
> Phase 3):** 18 of 19 steps done. The single open step is the real org
> fleet run (`blocker: org-fleet-run`, maintainer-owned) — nothing else
> blocks archival.

> Source-level comparison against **Source F** — an external
> agent-orchestration / scaffolding suite (a stale, zero-own-commit fork
> of a high-star upstream) — re-verified on both sides this session.
> Source F's execution core is verifiably simulated (hardcoded
> `success: true` returns, fabricated resource metrics, placeholder
> monitors), but five subsystems are genuinely engineered: init
> pre-flight validation with `--validate-only`, parallel multi-project
> init, an MCP capability surface over real transports, a correct-but-
> unwired circuit breaker + dependency graph, and a benchmark matrix
> harness with pluggable report sinks. This roadmap adopts the verified
> gaps only; the council cut the rest (see gap-table + council notes).

## Goal

Close the three verified capability gaps Source F exposes — (1) a
consumer-CI conformance contract plus init pre-flight typed findings,
(2) fleet rollout across org repos, (3) explicit failure/dependency
wording in the delegation layer — plus one bench-rig ergonomics gap.
Every phase lands behind a deterministic gate; nothing ships on the
strength of "Source F has it". The MCP deferred-rule-retrieval idea is
**rejected** with recorded re-open conditions, not deferred silently.

## Provenance

Source referenced anonymously per `source-confidentiality`; real links
retained encrypted:

- Source F (analyzed fork): `ENC1:Exnjh9YUX/Ls44XiuI2EAMGe8mSS+lBTJYU4MYo3TBvNfx/IfU7rZkf6mfh8zKkF231TtY8QMydUC2MSnAdDFA==`
- Source F upstream lineage: `ENC1:s9s7R3CH+NoNzRXB0OxYTl7TSwflkmLvUR4yYFLfO46qeUDzenhrxN79Bf85peAsaFDPYKNbWenrBHYKJKrkgA==`

Anti-stale-clone discipline: comparison verified against **this repo at
HEAD (2026-07-07)**, not the third-party analysis alone. Source-F claims
were spot-checked in a fresh clone (simulated task engine, pre-flight
validator checks, batch-init resource manager, tool-count on the MCP
surface, circuit-breaker states, consumer-shipped test tree — all
confirmed). Agent-config claims were re-verified against `src/` and
produced **five material corrections** that reshaped the plan:

1. Doctor (`src/scripts/_cli/cmd_doctor.ts`) already has a 0/1/2
   exit-code contract and 13 checks — missing are only `--ci` and a
   `task conformance` consumer wrapper.
2. The init path already ships `--dry-run` and `--minimal`
   (`src/cli/initRouting.ts`, `src/cli/main.ts`) — missing are
   pre-flight typed findings and `--validate-only`.
3. The shipped memory MCP server already exposes read tools
   (`list_rules`, `list_skills`, `memory_lookup`, `read_resource_body`)
   — "no retrieval channel exists" was overstated.
4. `subagent-steering` locks "no automatic cohort-disable; the only
   automatic stop is the per-target N=3 budget", and `do-in-steps`
   already encodes ordered dependencies with a judge gate.
5. `docs/benchmark.md` is **deliberately** hand-curated (two-host
   composite; a single-report render would bury one host's finding),
   and a deterministic renderer (`src/scripts/render_benchmark_md.ts`)
   already exists.

Prior adopt-the-engineering/reject-the-runtime decisions this continues:
`archive/road-to-operator-runtime-harvest.md`,
`archive/road-to-competitive-borrow.md`.

## Council notes (2026-07-07, anthropic/claude-sonnet-4-5 + openai/gpt-4o, debate, 2 rounds)

- **Conformance + init shape:** unanimous — merge into ONE phase on the
  existing doctor/validate/plan substrate; splitting was artificial.
- **Fleet rollout:** adopt, with one trim — the fleet deliverable is the
  install + aggregate report (`{repo, status, findings, duration}` plus
  the per-repo conformance JSONL); no post-install verification
  orchestration beyond that.
- **MCP deferred-rule retrieval: REJECT** (unanimous after round 2; the
  second member opened with "keep as a gated phase" and flipped after
  the rebuttal that this council would itself be the N0 gate while the
  demand evidence is absent). Grounds: the ≥3-tool batch trips the
  locked Discovery-First N0 forcing function; the token-saving Phase-10
  triage already rated MCP deferred-loading marginal-ROI at today's
  ~3k-token tool surface; thin projection is deferred until the
  `essential` discipline profile is baseline-measured, so the phase's
  premise sequences before its own decision gate; read tools partially
  exist already. Re-open conditions recorded in the REJECT list below.
- **Dispatch failure policy:** narrow — governance-text clarification
  (an *application* of the existing N=3 budget, no new mechanism, no
  automatic flip) plus one deterministic parent-verified check.
- **Bench:** narrow — matrix expansion on the existing runner + extend
  the existing renderer per-pinned-section; the curated two-host
  composite decision stands.
- **Packaging:** one roadmap, order = conformance → fleet → dispatch
  clarification → bench. The council suggested `structural`; the
  complexity-standard's structural tier requires a contract-layer
  trigger plus explicit user opt-in — not met after the MCP cut — so
  this ships `lightweight` (4 phases, bounded, ≤600 lines).

## Gap-table (KEEP / FOLD / CUT / ALREADY-HAVE)

| Source-F item | Verdict | Evidence |
|---|---|---|
| Pre-flight typed findings (permissions / disk / conflicts / host sanity) | **KEEP** | no pre-flight stage in `src/install/` (only a Node-builtin launcher check) |
| `--validate-only` init flag | **KEEP** | absent on the init path; `cmd_validate` exists but is not an init gate |
| Post-install conformance as a consumer-CI contract | **KEEP** | doctor has exit codes but no `--ci`, no `task conformance` |
| Parallel multi-project init (fleet) | **KEEP** | no batch/fleet path anywhere in `src/cli`, `src/install`, docs |
| Consumer-shipped conformance test tree | FOLD | into `task conformance` — deterministic checks, not a shipped test tree |
| Circuit breaker | FOLD | governance clarification: 2 verification-fails + escalation = the existing N=3 budget; `subagent-steering` Iron Law unchanged |
| Dependency graph | FOLD | `do-in-steps` already orders slices; add one deterministic parent-verified check |
| Bench matrix runner | FOLD | extend `bench_ab_v2_run.ts` (arms hardcoded today; `--host` adapter exists) with a matrix YAML |
| Report sinks / rendered bench doc | FOLD | extend `render_benchmark_md.ts` per-pinned-section; curated composite stays |
| `--dry-run` / `--minimal` init flags | ALREADY-HAVE | `src/cli/initRouting.ts:37`, `src/cli/main.ts` |
| MCP read access to rules/skills | ALREADY-HAVE | `list_rules`, `list_skills`, `read_resource_body` in `src/scripts/mcp_server/tools.ts` |
| MCP deferred-rule retrieval (search + trigger-eval tools) | **CUT** (council) | see REJECT list — three locked-decision collisions |
| Memory caps in the fleet resource manager | CUT | concurrency bound suffices; no resource theater |
| SQLite memory service / vector clocks / distributed memory | CUT | second-brain verdict + Layer-2 sunset stand |
| 17-role mode sprawl | CUT | flows + subagent frontmatter cover the mechanism, schema-linted |
| Web console / real-time monitor | CUT | simulated in source; no runtime to monitor |
| Work-stealing / load balancing runtime | CUT | governance package, not a runtime (ADR-088) |
| Simulated execution / fabricated metrics | CUT (anti-lesson) | the production-validator mandate is the inverse of this |

## Phase 0 — Install & conformance contract

Merged per council: one coherent surface answering "is agent-config
installed *and firing* in this repo?" — built on the existing
doctor/`cmd_validate`/`plan.ts`/`conflict.ts`/txlog substrate, never
rebuilding it.

- [x] Add `--ci` to `cmd_doctor`: machine-readable output (reuse
      `--json`), documented 0/1/2 exit contract, zero interactive output.
- [x] `task conformance` — thin wrapper over `cmd_doctor --ci` plus the
      consumer checks: (a) install txlog tail clean (no abandoned
      incomplete run); (b) rules INDEX parses and every router pointer
      resolves; (c) hook dispatcher answers synthetic `session_start` +
      `stop` envelopes on the detected host, run against the *installed*
      copy; (d) `lean_projection.mode` consistent with projected
      artifacts on disk; (e) host-capability manifest matches the
      detected host. All deterministic, no LLM.
- [x] One negative fixture per check: sabotage → that check red, exit
      non-zero.
- [x] Pre-flight stage in the install plan builder
      (`src/install/plan.ts`): permissions on every target root,
      free-disk floor, conflicting-file detection (reuse `conflict.ts`),
      host-detection sanity — each a typed finding, never a crash.
- [x] `--validate-only` on the init path: pre-flight only, non-zero exit
      on any blocking finding. Explicitly NOT rebuilding `--dry-run` /
      `--minimal` — both ship today; document them as the canonical
      quickstart instead.
- [x] Emit a machine-readable conformance report (JSONL line, txlog
      shape) so fleet runs (Phase 1) can aggregate it.
- [x] Consumer contract doc page: "green `task conformance` = the OS is
      installed and firing in this repo". Check (c)'s per-host result
      feeds the token-saving host-compliance evidence file — reuse that
      probe, never duplicate it.

**Exit gate:** `task conformance` green in agent-config itself and in
one real consumer repo; red on every sabotaged fixture; `--validate-only`
non-zero on a seeded permission conflict.

## Phase 1 — Fleet rollout (`init --fleet fleet.yaml`)

Genuinely new; rebuilt on the existing atomic/txlog substrate. Framing
per ADR-020/ADR-088: this installs *agent-config itself* across repos —
it never bridges to or drives another tool's runtime.

- [x] `fleet.yaml`: list of repo paths (or git URLs + clone dir), each
      with profile/pack selection; global `max_concurrency` (default 3)
      — concurrency bound only, no memory-cap theater.
- [x] Per-repo isolation: each install runs the full pipeline
      (pre-flight → apply) with its own txlog scope; one repo failing
      pre-flight or apply never aborts the others.
- [x] Aggregate report: one JSON summary (per repo: status, findings,
      duration, Phase-0 conformance JSONL result) + human table to
      stdout. Council trim: nothing beyond install + conformance — no
      post-install verification orchestration.
- [x] Fixture test: ≥3 fixture repos with one seeded failure — failing
      repo red with its finding, siblings green, aggregate JSON
      schema-validated.
- [ ] Real org fleet run (internal-adoption lever + dogfood corpus).
      <!-- blocked-by: org-fleet-run -->

**Exit gate:** fixture test green (deterministic); org fleet run
recorded via the blocker below.

## Phase 2 — Dispatch failure-policy clarification

Governance text plus one deterministic check — never a runtime. The
breaker *semantics* transfer; the mechanism is already the N=3 budget.
Coordinate with the active subagent telemetry follow-up roadmap: text
plus one check only, no new telemetry fields, no change to
`subagents.auto` (orchestration-default-flip verdict stands).

- [x] Extend `delegation-policy` / `subagent-steering` text: two
      consecutive verification-failed returns from the same subagent
      type in one session = an **application of the existing per-target
      N=3 budget** (2 failures + 1 escalation) — stop dispatching that
      type, surface the failures to the human, run the remaining slices
      in-session. NO new mechanism, NO automatic cohort-disable; the
      subagent-steering Iron Law is restated, not amended.
- [x] Make the `do-in-steps` dependency contract explicit and lintable:
      an ordered slice declares its parent; no slice dispatches before
      its parent's return is verified.
- [x] One deterministic check in the work-engine dispatch directive:
      refuse a slice whose declared parent lacks a verified return in
      session state; unit tests both ways (parent unverified → refused;
      verified → allowed).

**Exit gate:** rule text merged with lint green; dispatch-refusal unit
tests green; no telemetry-contract diff.

## Phase 3 — Bench matrix expansion + per-section render

The harness *architecture* transfers, never its numbers (they measured
simulated execution). ab-v2's science (paired, placebo, honesty labels)
is untouched; the deliberate curated two-host composite in
`docs/benchmark.md` is **preserved**, not replaced.

- [x] Matrix YAML (task-family × host × arm) expanding to the existing
      `bench_ab_v2_run.ts` invocations; de-hardcode the `ARMS` record;
      reuse the existing `--host` adapter — no new runner.
- [x] Extend the existing `render_benchmark_md.ts`: render each pinned
      section independently from its pinned report; never collapse to a
      single-latest render (the in-file curation rationale stands);
      honesty labels are part of the template, not re-typed prose.
- [x] Deterministic verification: matrix expansion snapshot-tested in
      dry-run; render byte-stable across two runs from the same pinned
      inputs; `docs/benchmark.md` regenerated with zero manual table
      edits while retaining the two-host composite structure.
- [x] Live matrix run (≥2 task families × 2 hosts) producing one
      schema-valid report.
      <!-- done 2026-07-10: operator ran `bench_matrix --config
      internal/bench/matrix.yaml --run` in a non-auto session → 4 schema-valid
      ab-v2 cells (claude×2 families, codex×2 families, n=14/host). HONEST-NULL:
      zero discipline lift on either host, every pair a tie. claude ceilings
      (1.000/1.000 — no headroom, confirms the lift is family-specific); codex
      capability_pass=0.000 on every task (confounded surface, not a lift
      signal). Recorded in docs/benchmark.md § Two-host matrix (flow-learnings)
      as curated prose — a bare table without the codex-capability caveat would
      overclaim. Two-host composite pipeline demonstrated end-to-end. -->

**Exit gate:** deterministic checks green; live run recorded via the
blocker below.

## REJECT list (verified anti-patterns + council additions)

- **MCP deferred-rule retrieval server** — council REJECT (2026-07-07).
  Re-open only when ALL hold: (a) the `essential` discipline profile has
  shipped and is baseline-measured (weak-host-lift verdict), (b) the MCP
  tool surface has grown materially beyond today's ~3k tokens
  (token-saving Phase-10 triage condition), and (c) telemetry shows real
  retrieval demand (Discovery-First N0 gate; the demand-gate precedent
  that rejected a speculative MCP helper applies). Aspiration to source
  parity is not demand evidence.
- Simulated execution paths or fabricated metrics of any kind — a bench
  or probe that cannot run for real reports "not run", never a number.
- SQLite memory *service*, vector clocks, distributed memory — the
  second-brain verdict and Layer-2 sunset stand; the >500-file tripwire
  path is embedded SQLite FTS5 via built-in `node:sqlite` (no service, no
  npm dep), pre-decided per ADR-116 (supersedes the earlier "in-memory
  minisearch" wording).
- Enterprise facade modules and README claims that outrun the code.
- Role-mode sprawl — flows + subagent frontmatter cover the mechanism;
  new modes require the standard evidence path.
- Web console / live monitoring UI — no runtime to monitor.
- Runtime orchestration (work stealing, load balancing) inside a
  governance package (ADR-088).
- Build artifacts and pid files in git.

## Blockers

### blocker: org-fleet-run
- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 1 — Fleet rollout
- **What to do:**
  1. After the fixture test is green, run the fleet init across ≥3 real
     org repos (`fleet.yaml` listing the app/package repos) with one
     intentionally mis-permissioned repo as the seeded failure.
  2. Capture the aggregate JSON report.
- **Resolved when:** aggregate JSON is schema-valid; the seeded repo is
  red with its pre-flight finding; all siblings are green and
  conformance-passing.

### blocker: live-matrix-run
- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 3 — live matrix run (live API spend)
- **Resolved 2026-07-10:** operator ran the run in a non-auto session (the
  `--run` agent-spawn is gated out of auto-mode). 4 schema-valid ab-v2 cells
  produced; the HONEST-NULL result (no cross-host lift; claude ceilings, codex
  capability-confounded) is recorded in `docs/benchmark.md` § Two-host matrix
  (flow-learnings). The composite pipeline is demonstrated end-to-end.
- **What to do:**
  1. Invoke the matrix runner for ≥2 task families × 2 hosts from the
     matrix YAML (paired arms per the existing ab-v2 discipline). The config
     is committed at `internal/bench/matrix.yaml` (2 families × 2 hosts × arms
     `vanilla`,`rules-kernel-dc`; host-compatible — codex rejects the plugin
     `package` arm) and dry-verified: `npx tsx src/scripts/bench_matrix.ts
     --config internal/bench/matrix.yaml --expand` → 4 cells. Run it with
     `--run` (per-cell `--budget` caps spend; 4 cells).
  2. Pin the resulting report alongside the existing pinned reports; regen
     `docs/benchmark.md` via the per-section renderer (zero manual edits).
- **Resolved when:** one schema-valid matrix report exists and the
  per-section render consumes it without manual edits.
- **Why not autonomous (beyond spend):** `--run` spawns the real `claude` +
  `codex` host CLIs as unattended coding agents (sandbox/approvals off) — an
  auto-mode agent-spawn gate blocks it independently of the paid-run
  authorization. Run it in a non-auto session (or approve the permission
  prompt); the numbers become published benchmark evidence, so the PR review
  that pins them is the integrity sign-off.

## Acceptance criteria (anti-dump)

- Every new visible surface reuses ≥2 existing artefacts (doctor,
  `cmd_validate`, `plan.ts`/`conflict.ts`, txlog, the ab-v2 runner, the
  benchmark renderer) — no parallel rebuilds of shipped substrate.
- No duplicate artefact against the ALREADY-HAVE rows in the gap-table.
- Every phase lands behind a deterministic gate; operator-gated evidence
  (org fleet run, live bench run) is tracked as structured blockers,
  never claimed from fixtures.
