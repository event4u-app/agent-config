# Open Questions — Roadmap Blockers

> Central decision queue for all active roadmaps. Every entry here blocks
> at least one TODO in a roadmap. Once you answer, the corresponding
> checkbox in the linked roadmap can be ticked and execution continues.

## How to read this file

- **Grouped by roadmap** — scan vertically per area.
- **Each entry is a Question**, not a task. Answer it in the roadmap
  itself (or here and port over), then the roadmap TODO unblocks.
- **Cross-repo items** (everything under `agent-memory/`) are marked and
  cannot be resolved from this repo alone.
- **Autonomy-blocked items** are marked with `🛑 artifact-drafting` —
  these require the full Understand → Research → Draft user flow per
  [`artifact-drafting-protocol`](../../.agent-src.uncompressed/rules/artifact-drafting-protocol.md)
  and cannot be drafted silently.

## Triage summary — 2026-04-22 pass

Across 18 active roadmaps with **461 open TODOs**:

| Category | Count | Actionable by agent alone? |
|---|---|---|
| 🛑 Artifact drafting (new skill / rule / command / guideline / script) | ~280 | No — requires Understand→Research→Draft |
| 🌐 Cross-repo (belongs in `@event4u/agent-memory` or consumer repo) | ~70 | No — wrong codebase |
| 🎯 Strategic decision (phase start, priority, scope) | ~45 | No — user sign-off |
| 🔬 Architecture choice (contract shape, data model, option A/B/C) | ~40 | No — user sign-off |
| ⚙️ Mechanical / verification | ~15 | Yes — handled inline |
| 📦 Implementation of already-agreed spec | ~10 | Depends on size |

Autonomously resolvable right now: **the 15 mechanical items below**.
Everything else surfaces here as a question.

## Verified / shipped during this pass (autonomous, 2026-04-22)

| Item | Roadmap | Result |
|---|---|---|
| No hard dep on agent-memory in manifests | `road-to-memory-self-consumption.md` Phase 0 | ✅ Ticked off |
| No-circular-dep clause in `CONTRIBUTING.md` | `road-to-memory-self-consumption.md` Phase 0 | ✅ Ticked off |
| Skill count drift (roadmap said 116, reality 121) | `road-to-stronger-skills.md` | ✅ Roadmap text updated to match reality |
| `.gitattributes.fragment` template shipped | `road-to-memory-merge-safety.md` Phase 0 | ✅ Committed under `templates/agents/` |
| Arxiv citations (6 skills: Self-Refine, CoVe, Reflexion, ToT, CoT, LLM-as-Judge) | `road-to-autonomous-agent.md` §8 | ✅ All retrofits done, uncompressed + compressed in sync |
| Master-frame link to decision hub | `road-to-agent-outcomes.md` | ✅ Linked |
| Compression sync + hash verification | repo-wide | ✅ `compress.py --check-hashes` clean |
| CI checks (lint-skills, check-refs, check-portability) | repo-wide | ✅ All green |

## Questions by roadmap

### `road-to-trigger-evals.md` (2 open, both strategic)

- **Q1 — API budget + ownership.** Who approves the $50 Claude budget
  ceiling for Phase 2 evals? Who rotates the key? → [Prereq](road-to-trigger-evals.md#prerequisites)
- **Q2 — Model pin decision.** One model or two profiles (Augment +
  Claude-Code)? → [Open Q1](road-to-trigger-evals.md#open-questions)

### `road-to-role-modes.md` (12 open, all 🛑 artifact-drafting)

- **Q3 — Phase 1 start.** Build the `role-contracts` guideline with 6
  contract skeletons? Triggers artifact-drafting-protocol.
  → [Phase 1](road-to-role-modes.md#phase-1)
- **Q4 — Switch conflict rule.** `active_role=reviewer` + user says "fix
  this" → refuse or redirect to developer mode? → [Open Qs](road-to-role-modes.md#open-questions)

### `road-to-engineering-memory.md` (11 open, 🛑 new schemas)

- **Q5 — Four new YAML schemas + four guidelines?** Big Phase 1 commit.
  Confirm scope and naming before drafting. → [Phase 1](road-to-engineering-memory.md#phase-1)

### `road-to-project-memory.md` (25 open, 🛑 settings + schemas + scripts)

- **Q6 — Phase 0 scope.** New `.agent-project-settings` layering plus
  `config-agent-settings` command extension — big structural change.
  Confirm vs. defer. → [Phase 0](road-to-project-memory.md)

### `road-to-agent-memory-integration.md` (15 open, depends on agent-memory repo)

- **Q7 — Can we build the `scripts/memory_status.py` file-fallback path
  before `agent-memory` ships Phase 2 of the retrieval contract?** All
  Phase 0-1 items here assume the contract shape is frozen. → [Phase 0](road-to-agent-memory-integration.md#phase-0)

### `road-to-curated-self-improvement.md` (11 open, 🛑 new template + script + guideline)

- **Q8 — Phase 1 start.** Build `templates/agents/proposal`,
  `scripts/check_proposal.py`, and `guidelines/agent-infra/self-improvement-pipeline`
  in one PR? → [Phase 1](road-to-curated-self-improvement.md#phase-1)

### `road-to-memory-merge-safety.md` (15 open, 🛑 scripts + fixtures)

- **Q9 — Accept this doc as canonical?** Phase 1 item #1 is explicit
  acceptance. → [Phase 1](road-to-memory-merge-safety.md)

### `road-to-memory-self-consumption.md` (7 open after tick, 🛑 + cross-repo)

- **Q10 — Phase 0 Item #1 acceptance.** Reference no-circular-dep clause
  from contribution docs (README / CONTRIBUTING)? → [Phase 0](road-to-memory-self-consumption.md#phase-0-clauses-freeze)

### `road-to-defensive-agent.md` (24 open, 🛑 5 new skills + Wave-2 scope)

- **Q11 — Wave 2 start.** `dependency-risk-review`, `data-exposure-review`,
  `migration-safety`, `queue-safety`, `secrets-and-config-review` —
  five new skills. Batch all, or pilot one? → [Wave 2](road-to-defensive-agent.md)

### `road-to-stronger-skills.md` (70 open, 🛑 skill rewrites + count drift)

- **Q12 — Skill count drift.** Roadmap text references "116-skill total"
  — actual count is **121**. Update roadmap, or were 5 skills added
  out-of-process? → [L266](road-to-stronger-skills.md)
- **Q13 — Rewrite sequencing.** 70 skills across 4 batches (Tier 1-4).
  Which tier first, or parallel? This is months of work. → [Batches](road-to-stronger-skills.md)

### `road-to-autonomous-agent.md` (70 open, 🛑 spike + commands + skills)

- **Q14 — Spike-exec-runtime gate.** Phase 2 is a benchmark gate (≥70%
  token savings). Green-light the spike? → [Phase 2 gate](road-to-autonomous-agent.md)
- **Q15 — `/brainstorm`, `/plan`, `/implement` commands.** Phase 4.
  Three new top-level commands — strategic scope. → [Phase 4](road-to-autonomous-agent.md)
- **Q16 — `/reflect` command + new mcp-builder skill.** Phase 5-6. Big
  surface additions (rename `mcp` → `mcp-usage`, add companion
  authoring skill). → [Phases 5-6](road-to-autonomous-agent.md)
- **Q17 — Arxiv reference retrofit.** Phase 9 adds `## References` to
  ~6 skills. Small, but touches existing skills — confirm OK.
  → [Phase 9](road-to-autonomous-agent.md)

## Cross-repo questions (`agents/roadmaps/agent-memory/*`)

All 6 specs (`road-to-consumer-integration-guide`, `road-to-promotion-flow`,
`road-to-decay-calibration`, `road-to-retrieval-contract`,
`road-to-cross-project-learning`, `road-to-agents-md-fix`) are **specs
authored from agent-config for agent-memory**. They are not actionable
in this repo. Open questions are either:

- **Cross-project decisions** carried in each spec under their own
  `Open questions` heading (they live with the spec).
- **Phase transitions** that depend on agent-memory repo work landing.

No entry for these in this file — the spec carries its own.

## How to reopen autonomous execution

After you answer questions above, the agent can unblock specific
phases. Recommended batch sizes:

- **1 roadmap at a time** for Phase 1 (new-artifact) work — keeps
  artifact-drafting-protocol runs focused.
- **Parallel small items** (Q1, Q17) OK if unrelated.
- **Never bundle** cross-repo work into a local PR.

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
- [`README.md`](../README.md) — repo-level overview (if present)
