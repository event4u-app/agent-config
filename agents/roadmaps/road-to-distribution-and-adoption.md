---
complexity: lightweight
---

# Road to Distribution and Adoption

**Status:** PARTIALLY DEFERRED — see "Post process-full audit
(2026-05-11)" below. Active scope = G1, G2, Q1, Q2, Q3 (separate-PR
shipping). Sibling-roadmap-gated steps (`[~]`) and human-gated steps
(`[-]`) excluded from this PR per AI Council convergence.
**Started:** 2026-05-01 (split out of `road-to-better-skills-and-profiles.md`
after AI #5 review).
**Trigger:** Multi-AI review identified marketing, multi-tool expansion,
orchestration DSL, and audit-as-memory as Block H/I/G/Q. AI #5 flagged
these as scope creep relative to the Thinking Layer's foundation set.
**Mode:** Four phases (H · I · G · Q), one per block. Recommended
sequencing in pre-conditions section — not enforced; the user picks
the active phase.

## Purpose

Track the four distribution / adoption / orchestration blocks
(Marketing · Multi-tool expansion · Orchestration DSL · Audit-as-Memory)
that were originally synthesised under
`road-to-better-skills-and-profiles.md` and split out 2026-05-01 to
keep the Thinking Layer roadmap focused on its core scope.

## Out of scope (this roadmap)

- Skill / persona / stakeholder work — sibling roadmap.
- Engine, governance, packaging — `road-to-post-pr29-optimize.md`,
  `road-to-governance-cleanup.md`.
- MCP server — `road-to-mcp-server.md`.

## Phase ordering

- **Phase 2 (I — Multi-tool expansion)** — next-in-line once sibling
  Block B (projection-layer review) finishes. I1–I3 are cheap once
  the abstraction is clean.
- **Phase 1 (H — Marketing)** — gated on four pre-conditions stacked
  (Thinking A+C ≥80% shipped, post-pr29 1.15.0, `docs/contracts/`
  policy, named owner with 1 day/week cap).
- **Phase 3 (G — Orchestration DSL)** — gated on Thinking Layer A + C
  ≥80% shipped.
- **Phase 4 (Q — Audit-as-Memory)** — gated on Phase 3 (G) shipping.

The dashboard treats every phase as ready (per "Phase pre-conditions"
section); this block makes dependency ordering explicit so reviewers
know which phase is the next-in-line candidate.

## Phase pre-conditions (recommended sequencing)

Originally a hard promotion gate; kept here as **recommended**
sequencing after promotion. The dashboard treats every phase as
ready; the user decides when to start a phase based on these
conditions:

1. Thinking Layer Blocks A + C are ≥80% shipped (POWERFUL eval tier)
   — required for **Phase 3 (G)** and **Phase 1 (H, marketing)**.
2. Phase 1 of `road-to-post-pr29-optimize.md` shipped 1.15.0 with green
   CI and counter-drift guard active — required for **Phase 1 (H)**.
3. `docs/contracts/` stability policy is in force (no public links into
   `agents/`) — required for **Phase 1 (H)**.
4. Block owner is named and 1 day/week cap is committed for ≥6 weeks
   — required for **Phase 1 (H)**.
5. Sibling roadmap Block B (projection-layer review) finished
   — required for **Phase 2 (I)**.
6. Phase 3 (G) shipped — required for **Phase 4 (Q)**.

## Phase 1: Block H — Marketing

**Goal:** 200 stars / 5 external consumers / 1 talk in 6 months *after
this phase ships*. Hard cap 1 day/week per person on marketing work,
locked from the Thinking Layer decisions.

**Pre-conditions:** items 1, 2, 3, 4 of "Phase pre-conditions".

**Risk if started early:** marketing eats engineering, depth narrative
backfires (no depth to point at).

- [~] **H1** — README rewrite for OSS-light positioning. **Deferred
      2026-05-11**: waits on sibling roadmap F7 shipping; that
      roadmap is not present in this branch. Promote to `[ ]` when
      the sibling roadmap exists and F7 ships.
- [~] **H2** — Skill-bundle landing pages. **Deferred 2026-05-11**:
      waits on sibling roadmap Block A personas; sibling roadmap not
      present in this branch.
- [~] **H3** — Comparison page vs `alirezarezvani/claude-skills`.
      **Deferred 2026-05-11**: waits on eval thresholds producing
      numbers (sibling roadmap not present).
- [-] **H4** — Medium / dev.to articles, conference CFP. **Cancelled
      2026-05-11** via AI Council convergence (category error: "owner
      + budget assigned first" is non-agent action). Moved to
      [`docs/DISTRIBUTION_CHECKLIST.md`](../../docs/DISTRIBUTION_CHECKLIST.md)
      § "Medium / dev.to articles + conference CFP".
- [-] **H5** — Screencasts / asciinema casts per primary surface.
      **Cancelled 2026-05-11** via AI Council convergence (terminal
      capture on a maintainer machine is non-agent action; substrate
      already shipped via archived `road-to-simplicity-and-everywhere.md`).
      Moved to [`docs/DISTRIBUTION_CHECKLIST.md`](../../docs/DISTRIBUTION_CHECKLIST.md)
      § "Screencasts / asciinema casts per primary surface".

## Phase 2: Block I — Multi-tool expansion

**Goal:** Add Aider, Kilo Code, OpenCode, Codex projections to
`task generate-tools`. AI #2 ranked these as cheap wins after the
projection-layer review.

**Pre-conditions:** item 5 of "Phase pre-conditions" — sibling roadmap
Block B (projection-layer review) must produce a clean abstraction;
otherwise each new tool re-implements the projection logic.

- [~] **I1** — Per-tool projection scripts for Aider, Kilo Code,
      OpenCode, Codex (one script per target). **Deferred 2026-05-11**:
      sibling-roadmap Block B (projection-layer review) is not
      present in this branch; without the abstraction each new tool
      re-implements emitter logic in `scripts/compress.py`.
- [~] **I2** — Integration tests against each tool's loader.
      **Deferred 2026-05-11**: gates on I1.
- [~] **I3** — Installation docs in `docs/installation.md` under
      `advanced`. **Deferred 2026-05-11**: gates on I1.

## Phase 3: Block G — Orchestration DSL

**Goal:** YAML pipeline definition + `/orchestrate` command chaining
personas / skills / sub-agents into reproducible flows. AI #2 ranked
this **after** A + C complete because the DSL is empty without
personas to compose.

**Pre-conditions:** item 1 of "Phase pre-conditions".

**Risk if started early:** DSL ships without enough personas to
compose → becomes a prettier `/work`.

- [x] **G1** — DSL schema + linter. **Scope note**: own PR; no
      external dep, but ships orphan-schema unless paired with G2
      (its consumer) in the same review window.
      *Shipped 2026-05-11 in
      [`orchestration-dsl-v1.md`](../../docs/contracts/orchestration-dsl-v1.md)
      + [`scripts/lint_orchestration_dsl.py`](../../scripts/lint_orchestration_dsl.py)
      + 12-case pytest suite. YAML pipelines under
      `.agent-config/orchestrations/`, kinds: `skill` · `command` ·
      `persona` · `subagent`, two-namespace interpolation.*
- [x] **G2** — `/orchestrate` command + state machine in `work_engine`.
      **Scope note**: own PR; multi-week design + implementation
      surface. Pair with G1 for review.
      *Shipped 2026-05-11 in
      [`.agent-src.uncompressed/commands/orchestrate.md`](../../.agent-src.uncompressed/commands/orchestrate.md)
      + [`work_engine/orchestration.py`](../../.agent-src.uncompressed/templates/scripts/work_engine/orchestration.py)
      + 9-case pytest suite. State machine: lazy step iteration,
      two-namespace interpolation, `when` guards (`success` / `failure` /
      equality), halt-on-failure.*
- [~] **G3** — Reference pipelines for the 4 demo scenarios.
      **Deferred 2026-05-11**: referenced `road-to-post-pr29-optimize.md`
      does not exist in this repo; demo-track substrate is missing.
      Promote to `[ ]` when the demo-track roadmap lands.

## Phase 4: Block Q — Audit-as-Memory

**Goal:** Persistent agent-action log + promotion gate that turns
repeated successful patterns into validated skills/rules. The honest
version of the "self-improving agent" claim that AI #2 ruled out.

**Pre-conditions:** item 6 of "Phase pre-conditions" — Phase 3 (G) must
ship first; without orchestrated pipelines there are no repeated
patterns to mine.

- [x] **Q1** — Append-only audit log schema (extends existing
      chat-history split). **Input feed:** consumes the memory-visibility
      line shipped by archived `road-to-feedback-consolidation.md`
      Phase 4 (contract:
      [`memory-visibility-v1.md`](../../docs/contracts/memory-visibility-v1.md))
      — counts + ids only, no bodies, redaction floor preserved.
      *Shipped 2026-05-11 in
      [`audit-log-v1.md`](../../docs/contracts/audit-log-v1.md) — JSONL
      append-only, monthly files under `agents/state/audit/`, producer
      hook on phase boundary, supersede semantics for corrections.*
- [ ] **Q2** — Pattern-extraction script + human review gate (no
      auto-promotion). **Scope note**: own PR; gates on Q1 + G-phase
      (no patterns to mine without orchestrated pipelines).
- [ ] **Q3** — Integration with `learning-to-rule-or-skill` skill.
      **Scope note**: own PR; gates on Q1.

## Risk register (delta from sibling roadmap)

| Risk | Mitigation |
|---|---|
| Phases started before pre-conditions met | Pre-conditions section; user picks active phase, dashboard shows readiness |
| Phase 3 (G) started as "tooling looks easy" before A + C deliver depth | Pre-condition item 1 (≥80% A + C shipped) |
| Phase 1 (H, marketing) consumes engineering capacity | 1 day/week cap is non-negotiable |
| Phase 4 (Q) rebrands as "self-improving agent" | Title locked at "Audit-as-Memory"; AI #2 explicit non-goal |

## External distribution (human-gated, not agent-executable)

Marketplace submissions, npm publish, GitHub repo settings, content
authoring (Medium / dev.to / CFP), and terminal screencast recording
are **deliberately not** tracked as roadmap steps. They cannot be
shipped by a code change and would pollute the dashboard step counter
if listed here. They live in
[`docs/DISTRIBUTION_CHECKLIST.md`](../../docs/DISTRIBUTION_CHECKLIST.md)
with their own status vocabulary (`Prepared` / `Submitted` /
`In Review` / `Live` / `Blocked`), owner field, and `Last Reviewed`
timestamp.

The checklist gates on engineering substrate shipped via the
archived [`road-to-simplicity-and-everywhere.md`](archive/road-to-simplicity-and-everywhere.md)
(in-tree prep) and, for the Smithery item, on
[`road-to-mcp-full-coverage.md`](road-to-mcp-full-coverage.md)
Phase 3. See the "Post-merge addendum" of the archived roadmap for
the lessons-learned that led to this split.

## Post process-full audit (2026-05-11)

Triggered by `/roadmap:process-full` invocation against this roadmap.
AI Council (Anthropic Sonnet 4.5 + OpenAI GPT-4o, two rounds) reached
convergent verdict on roadmap-shape issues before step execution:

| Council Q | Verdict | Applied to |
|---|---|---|
| Q1 — H4/H5 outside agent scope | unanimous **B** (move to checklist) | H4, H5 → `[-]` cancelled, entries added to `DISTRIBUTION_CHECKLIST.md` |
| Q2 — "waits on sibling roadmap" steps | unanimous **B** (block on external gates) | H1–H3 → `[~]` deferred; I1–I3 → `[~]` deferred (Block B abstraction missing); G3 → `[~]` deferred (referenced roadmap absent) |
| Q3 — PR scope | split (Anthropic: 3 PRs · OpenAI: stack on #102) | Pragmatic compromise: shape-fix on #102, G/Q phases reserved for own-PR shipping |
| Q4 — commit cadence | split (1/PR vs 1/phase) | One logical commit per chunk on #102 |

**Lesson reinforced:** before the loop processes a single step, the
roadmap shape must pass the same agent-executable filter that
produced `DISTRIBUTION_CHECKLIST.md`. Half of this roadmap's steps
referenced sibling roadmaps that don't exist in this branch
(`road-to-better-skills-and-profiles.md`, `road-to-post-pr29-optimize.md`)
— a pre-flight ref check should be added to
[`/roadmap:process-full`](../../.agent-src.uncompressed/commands/roadmap/process-full.md).

**Active scope after audit:** G1, G2 (own PR, paired review), Q1, Q2,
Q3 (own PR, Q-phase cluster). Five `[ ]` steps remain; the rest are
parked as `[~]` (sibling-gated) or `[-]` (human-gated, moved to
checklist).

**Council artefact:** `.tmp/council/distribution-strategy.md` (not
committed — derived).

## Reference

- Thinking Layer: `road-to-better-skills-and-profiles.md`
- Engine + governance: `road-to-post-pr29-optimize.md`,
  `road-to-governance-cleanup.md`
- MCP: `road-to-mcp-server.md`
- External distribution: [`docs/DISTRIBUTION_CHECKLIST.md`](../../docs/DISTRIBUTION_CHECKLIST.md)

## Next step

User picks the first phase to start when its pre-conditions are met.
Recommended order: Phase 2 (I) first if sibling Block B is closest to
done; otherwise Phase 3 (G) once Thinking Layer A + C are ≥80%
shipped. Phase 1 (H) gates on the most pre-conditions; Phase 4 (Q)
gates on Phase 3.
