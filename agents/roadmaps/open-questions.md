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
| `package.json` / `marketplace.json` version drift to 1.8.0 + release guard | release-infra | ✅ Both synced, CI workflow asserts tag == package.json == marketplace.json on tag push; `task release:bump` keeps all three aligned going forward. Externally visible bug (Packagist showed 1.4.0 while git was at 1.8.0) flagged by a repo-review pass on 2026-04-22. |

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

### External adoption feedback (2026-04-22 review pass)

Surfaced by an external tech-lead-style review of the public repo. Praise
and non-actionable framing (productivity, "AI-OS", "no real thinking") are
not captured here — only items that imply a concrete open decision.

- **Q18 — Positioning: Laravel-first vs. broad multi-stack?** The core
  catalog (laravel, eloquent, flux, pest-testing, artisan-commands,
  jobs-events, laravel-*) is Laravel-dense, while the analysis layer
  (`project-analysis-{react,nextjs,node-express,symfony,zend-laminas}`)
  advertises multi-stack breadth. External reviewers read this as an
  inconsistency. Two roadmap-level options:
    1. **Laravel-first** — README/AGENTS.md lead with "Laravel + multi-
       stack analysis"; broaden analysis skills only, not authoring.
    2. **Multi-stack breadth** — commit to parity (authoring + analysis)
       for at least one non-PHP stack before calling the package
       framework-agnostic. Adds a large new roadmap.
  → No matching roadmap yet. Decide before the next README pass.

- **Q19 — Install preset for solo devs / side projects.** 122 skills +
  42 rules is a lot of agent surface for a one-dev project. Currently
  `scripts/install.sh` installs the full set; `.agent-settings.yml`
  has per-feature toggles but no named preset. Options:
    1. Add a `preset: lite|full|enterprise` key to `.agent-settings.yml`
       with curated skill/rule subsets per preset.
    2. Lean on `.augmentignore` + per-tool ignore files (exists today
       but undocumented for this purpose).
    3. No preset — document the trim path instead.
  → Partially touches `road-to-project-memory.md` Q6. Independent
     decision.

- **Q20 — Onboarding / first-15-minutes experience.** No dedicated doc
  or command that walks a new adopter from `composer require` to
  "first skill triggered in my editor". `task first-run` exists
  (`scripts/first-run.sh`) — is it enough, or does it need a
  companion `/onboard` command + a 15-minute tutorial in `docs/`?
  → No matching roadmap. Small but externally visible gap.

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
