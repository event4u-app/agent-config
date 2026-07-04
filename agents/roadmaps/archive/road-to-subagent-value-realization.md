---
complexity: structural
---

# Roadmap: Subagent value realization

> Make the already-designed subagent layer actually fire and measurably cut cost — wire the inert pieces, capture realized-cost telemetry, and re-gate the `auto: on` flip on that evidence (never by copying an external "swarm").

## Prerequisites

- [x] Read `AGENTS.md` and `docs/contracts/subagent-boundary.md`
- [x] Read `agents/settings/contexts/orchestration-default-flip-verdict.md` (the honest-null this roadmap respects)
- [x] Read `src/skills/subagent-orchestration/SKILL.md` and `src/rules/delegation-policy.md`
- [x] Confirm `subagents.*` defaults in `src/config/agent-settings.template.yml` (esp. `auto: ask`, `downshift: true`, `max_parallel: 3`)

## Context

This roadmap originates from a deep-dive of an external multi-agent orchestration reference (Source A — see Provenance). **The deep-dive inverted the premise.** Source A's "swarm" is an in-process `Map<string,Agent>` of objects in one process — not OS processes, not host subagent sessions, no per-agent context isolation. Its only real LLM execution is **one direct provider HTTP call per task**; its "consensus/voting" is a randomized stub; its headline "1.3×–1953×" numbers are infra micro-benchmarks (cold start / latency / RSS), and the only multi-agent benchmark artefact is literally named `*mock*`. Source A's single transferable cost mechanism is *cheapest-adequate-model-per-call + ephemeral prompt-cache + one cheap retry-downshift on error*.

Against that, **this package is already ahead on design**: 7 orchestration modes, a real cross-model judge discipline (Iron Law: never judge on the implementer's model+context), model **downshift**, a `verify-budget`, host-capability gating, a telemetry spec, and genuine host `Task` spawning. Copying Source A's swarm would be a **downgrade**, not an upgrade.

The real, evidenced problem (from the internal inventory) is that this strong design is **inert**:

- The orchestration `_lib` functions (`resolveSubagentRouting`, `classifyTask`, `selectVerifyMode`, `composeSpawnBrief`, `budgetHalt`, `breachedGuardrails`) are imported **only by their own tests** — nothing applies them at dispatch time. Cost wins are agent-discipline-dependent, not enforced (this is by design — no-runtime).
- `subagent-orchestration` SKILL.md dispatches to commands `/do-and-judge`, `/do-in-steps`, `/judge` that **do not exist** — broken refs in a shipped skill.
- `orchestration-telemetry` defines a `{spawn_count, tiers, token_delta, wall_clock_ms, verify_mode}` object, but **nothing captures it**, so the central cost lever (`downshift`) is **unmeasured** and the `breachedGuardrails` thresholds are inert.
- `subagents.auto` is blocked at `ask` since the 2026-06-26 honest-null: the flip re-gates on **accumulated real telemetry**, which does not yet exist.

So the answer to "can we get the cost benefits?" is **yes — by making our own design fire and measuring it**, not by chasing Source A parity.

- **Feature:** none (closes existing design debt)
- **Jira:** none

## Governance preflight (anti-dump, per `roadmap-writing` § 8.D)

- **`domain-adoption-policy`** — no new domain opened; subagent orchestration already ships (ADR-105). Gate does not fire.
- **`persona-governance`** — no new personas.
- **`framework-neutrality`** — all artefacts are stack-agnostic (orchestration, telemetry); no framework leak.
- **`size-enforcement`** — applies per artefact; new commands (Phase 1) must stay within the meta pack's `size_class` budget.

## Gap-table — KEEP / FOLD / CUT (per `roadmap-writing` § 8.A)

Every candidate audited against the existing surface. Source A contributes **zero** new KEEP items — its only real idea already exists here. The KEEPs are all our own inert-design debt.

| Candidate | Origin | Disposition | Where |
|---|---|---|---|
| Cheapest-adequate-model per call | Source A | **FOLD** → `subagents.downshift` + `subagent-routing.ts` (same idea, already designed) | Phase 1 (note) |
| Ephemeral prompt-cache per call | Source A | **CUT** → host/SDK feature (`cache_control`), not a package artefact; agent-discipline reminder only | — |
| Cheap retry-downshift on transient error | Source A | **FOLD** → `subagent-steering` guardrails (`spawn_failure` threshold already exists) | Phase 1 (note) |
| In-process "swarm" Map / topology engine | Source A | **CUT** → we have richer topology *hints*; an in-process actor runtime is identity-rejected (no-runtime) | — |
| Consensus / majority voting | Source A | **CUT** → ours is a real cross-model judge; Source A's is a randomized stub | — |
| Fix broken command refs (`/do-and-judge`, `/do-in-steps`, `/judge`) | internal gap | **KEEP** | Phase 1 |
| Realized-cost telemetry capture loop | internal gap | **KEEP** | Phase 2 |
| Delegable-task corpus + bench arm toggling `subagents.auto` | internal gap | **KEEP** | Phase 3 |
| `parallelizable:` frontmatter adoption + classification tightening | internal gap | **KEEP** | Phase 4 |
| Re-gate the `auto: on` flip via accumulated telemetry | internal gap | **KEEP** | Phase 5 |

## Phase 0: Decide the no-runtime-compatible capture mechanism

The one genuinely contested fork. The 2026-06-26 council already converged that **telemetry (not a synthetic bench) is the instrument** to re-gate the flip — so the instrument is decided. What remains is the *mechanism*: how to capture `token_delta` / `wall_clock_ms` without crossing into a daemon / runtime (the package's identity floor). The proposed no-runtime-compatible shape: the orchestrator agent **emits** a structured telemetry line at end-of-dispatch; an existing PostToolUse-style hook **appends** it to the `audit-log-v1` JSONL the spec already names. No daemon, no SQLite, no auto-write memory.

- [x] **Step 1:** Confirm the reframe with the maintainer: ruflo/Source-A parity is a downgrade; scope is "make our own design fire + measure," not "build a swarm."
- [x] **Step 2:** Decide the capture mechanism. Recommended default: agent-emitted telemetry line + existing-hook append to `audit-log-v1` JSONL. Surface the `token_delta` sourcing sub-question — real host usage vs. agent self-estimate (self-estimate is unreliable; prefer host-reported usage where the host exposes it, else mark the field `estimated`).
- [x] **Step 3:** Per `roadmap-writing` § 8.B, route the mechanism sub-question (does hook-append telemetry cross the no-runtime line?) through `/council:design` if the maintainer wants the convergence on record. Inline the verdict under `## Council notes` below.

**Exit criteria:** mechanism chosen and recorded (council-blessed or maintainer-decided); `token_delta` sourcing rule fixed.
**Rollback:** none (decision-only phase).

## Phase 1: Make the design self-consistent

Cheap, high-value, no dependency on Phase 0. Removes broken refs from a shipped skill and folds in Source A's one real idea where it already half-lives.

- [x] **Step 1:** Resolve the three broken command refs in `src/skills/subagent-orchestration/SKILL.md` (`:312-314` + Handover table). Decide per-ref: either author the command file under `src/agent-src/commands/` (each must reuse ≥ 2 existing skills — anti-dump) **or** rewrite the ref to "orchestrated inline via this skill." No dangling references survive.
- [x] **Step 2:** Add a one-line downshift/retry note to `subagent-steering` (or `subagent-routing`): on transient subagent failure, retry once at the next-lower tier before escalating — folding Source A's cheap-retry-downshift into the existing `spawn_failure` guardrail.
- [x] **Step 3:** Add a prompt-cache discipline reminder to the dispatch prompts (`prompts/*.md`): reuse a stable system-prompt prefix across sibling subagents so the host's prompt cache applies. Discipline, not a built artefact.
- [x] **Step 4:** Run `check-refs` to confirm no broken internal references remain.

**Exit criteria:** zero broken command refs; `check-refs` green on the touched skill; retry-downshift + cache-reuse notes landed.
**Rollback:** revert the skill/context edits; refs return to prior (broken) state — no behavioural risk.

## Phase 2: Realized-cost telemetry capture (the re-gate prerequisite)

Gated on Phase 0's mechanism decision. This is the exact dependency the flip-verdict names: without captured telemetry the `downshift` cost win is unmeasured and the guardrails are inert.

- [x] **Step 1:** Implement the agent-emit → hook-append path chosen in Phase 0. Telemetry object shape stays as `orchestration-telemetry.md` defines (`spawn_count, tiers, token_delta, wall_clock_ms, verify_mode`); add the `token_delta` provenance field (`measured` | `estimated`).
- [x] **Step 2:** Make `breachedGuardrails` thresholds read live telemetry (e.g. `token_blowup > 2× baseline`) so the steering guardrails stop being inert. Surface a breach, never auto-disable (per `subagent-steering`).
- [x] **Step 3:** Add a tiny read-side: `/cost:report` (or a sibling) surfaces accumulated orchestration telemetry — spawn count, realized `token_delta` distribution, downshift savings. This is the maintainer's window into whether the cost lever materializes.
- [-] **Step 4:** Verify end-to-end on one real `do-in-parallel` dispatch: a telemetry line is emitted, appended, and reportable. Cite the JSONL line. <!-- moved: tracked in road-to-subagent-value-realization-followup.md -->

**Exit criteria:** a real orchestrated dispatch produces a captured, reportable telemetry line with a sourced `token_delta`; guardrails read it.
**Rollback:** disable the hook append (telemetry capture is additive; removing it returns to the pre-capture state with no behavioural change).

## Phase 3: Delegable-task corpus + bench arm

The flip-verdict names the missing measurement substrate explicitly: no delegable-task corpus, no bench arm toggling `subagents.auto`. Build the smallest honest substrate. This does **not** require an agent-tool-execution harness — Phase 2 telemetry from real `ask`-mode usage is the primary signal; the corpus is a controlled supplement.

- [x] **Step 1:** Assemble a small delegable-task corpus (multi-part / parallelizable / ordered-plan tasks) under the existing bench fixtures dir — distinct from `ab-tracka`/`ab-trackb-v2`/`router-coverage` (none of which are delegable).
- [x] **Step 2:** Add a bench arm that toggles `subagents.auto` (off vs ask vs on) and records the Phase-2 telemetry per run, so orchestrated-vs-single is comparable at held quality.
- [x] **Step 3:** Document the corpus + arm honestly: what it measures (realized telemetry on controlled delegable tasks) and what it does **not** (it is not a full agent-tool-execution runtime; real `ask`-mode telemetry remains the primary signal).

**Exit criteria:** corpus exists; bench arm runs and emits per-arm telemetry; the "what this does/doesn't measure" caveat is recorded.
**Rollback:** remove the corpus + arm; benchmark surface returns to prior state.

## Phase 4: Auto-detection coverage

The v1 deterministic classifier fires only on `parallelizable:` frontmatter, explicit ordered plans, or N-identical-slices — so implicitly-delegable work falls through to `ask`/no-op. Widen coverage *without* the deferred v2 LLM-classifier (still behind the same evidence gate).

- [x] **Step 1:** Inventory how many skills/commands actually declare `parallelizable: steps|files|independent`. If adoption is near-zero, classifier signal #1 is dead.
- [x] **Step 2:** Add `parallelizable:` to the skills/commands where it is genuinely true and high-value (multi-file edits, ordered pipelines, fan-out research) — the cheapest lift in classification recall.
- [x] **Step 3:** Tighten the structural heuristics in `auto-dispatch-classification.md` v1 where a clear, deterministic signal exists (e.g. numbered multi-step plan bodies) — staying deterministic, no per-turn LLM call.

**Exit criteria:** `parallelizable:` adoption inventory recorded; high-value declarations added; classifier recall improved on the Phase-3 corpus (measured, not asserted).
**Rollback:** revert frontmatter additions; classifier returns to prior recall.

## Phase 5: Re-gate the `auto: on` flip on accumulated telemetry

Strictly gated on Phases 2–4. Does **not** relitigate the honest-null; it feeds it the evidence it asked for.

- [-] **Step 1:** After a meaningful sample of real `ask`-mode orchestration telemetry accumulates, feed it through the existing `gateVerdict()` / `resolveShippedDefault()`. <!-- moved: tracked in road-to-subagent-value-realization-followup.md -->
- [-] **Step 2:** If (and only if) the data shows a net token-or-time win at held quality, propose flipping `subagents.auto` default `ask → on` as a maintainer decision; otherwise record the renewed honest-null and keep `ask`. <!-- moved: tracked in road-to-subagent-value-realization-followup.md -->
- [-] **Step 3:** Update `agents/settings/contexts/orchestration-default-flip-verdict.md` with the new evidence pass (date + outcome), per `no-roadmap-references` (inline, no session path). <!-- moved: tracked in road-to-subagent-value-realization-followup.md -->

**Exit criteria:** `gateVerdict()` run on real telemetry; flip decision recorded with evidence either way.
**Rollback:** none (decision is evidence-gated; `ask` is the safe default if evidence is insufficient).

## Acceptance Criteria

- [x] Zero broken command references in `subagent-orchestration` (`check-refs` green).
- [-] A real orchestrated dispatch emits a captured, reportable telemetry line with a sourced `token_delta`; `breachedGuardrails` reads live telemetry. <!-- moved: tracked in road-to-subagent-value-realization-followup.md -->
- [x] A delegable-task corpus + `subagents.auto`-toggling bench arm exist, with an honest "measures realized telemetry, not a runtime" caveat.
- [-] `parallelizable:` adoption inventory recorded; classifier recall improvement measured on the corpus. <!-- moved: tracked in road-to-subagent-value-realization-followup.md -->
- [-] The `auto: on` flip is re-evaluated through `gateVerdict()` on real telemetry, with the outcome recorded — flip only if evidenced. <!-- moved: tracked in road-to-subagent-value-realization-followup.md -->
- [x] **Anti-dump:** no new artefact duplicates an existing one; any new command reuses ≥ 2 existing skills and stays within the meta pack `size_class` budget; governance preflight (above) recorded.
- [x] All quality gates pass (`task lint-skills`, `check-refs`).

## Council notes

**Mechanism decision (2026-06-30, maintainer, no council spend).**

The capture mechanism question (does hook-append telemetry cross the no-runtime line?) was routed to the maintainer rather than a council session (user explicitly chose no council, option 1). Verdict:

- **Mechanism:** Agent-direct write to `agents/runtime/state/audit/YYYY-MM.jsonl` — the existing audit-log-v1 path. No hook, no daemon, no persistent process. The orchestrating agent writes the telemetry line as its final dispatch action, using its standard file-write tool.
- **Why no hook:** A PostToolUse hook would require creating `.claude/settings.json` and a hook script, adding infrastructure that exceeds the complexity of agent-direct-write. Agent-direct-write is already used for all other agent-written artifacts and is fully within the no-runtime identity.
- **token_delta_provenance:** `"measured"` when host response metadata carries `usage` counts (Claude Code exposes this); `"estimated"` otherwise. Self-estimates are lossy but acceptable — they still show the sign of the delta (saved or spent) and the order-of-magnitude.
- **Prior council convergence (2026-06-26, claude-sonnet-4-5 + gpt-4o, 2 rounds):** telemetry is the re-gate instrument for the `auto: on` flip — this decision does not relitigate that convergence, only resolves the implementation-mechanism sub-question below it.

## Provenance

- **Source A:** an external TypeScript multi-agent "swarm" orchestration reference (a repackaged actor-map coordinator; marketing claims unverified, only-real cost mechanism = cheapest-model + prompt-cache + retry-downshift). Anonymized per `source-confidentiality`. Link via `src/scripts/_lib/link_crypto.ts decrypt`: `ENC1:IlxheJKbFP1wWeKaZsaiu1kCCwia4yVbVfcKn6NRSRNtXK4qYawGrHPh4UXTKLBASixoCME5nWssoZEQmR1llGnzB6UbltFrnMnVn4rdNZj7j/gwn5mGv7JOio5yEQs=`
- **Deep-dive method:** repo tree + key source files inspected (coordinator, agent-lifecycle, MCP agent-tools, the real provider-call path), not README summary, per `external-reference-deep-dive`.
