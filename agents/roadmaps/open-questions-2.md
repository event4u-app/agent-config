# Open Questions 2 — Autonomous-Pass Blockers

> Created during the autonomous roadmap-closeout pass on **2026-04-22**.
> Collects every decision the agent could not make from context alone,
> grouped by the roadmap that surfaced it. Each entry maps 1:1 to a
> `[-]` **skipped** item in the originating roadmap — ticking the
> question here unblocks the corresponding roadmap item.
>
> See [`open-questions.md`](open-questions.md) for the earlier pass
> (Q1-Q25). This file is **Pass 2**, started at Q26.

## How to read this file

- **Grouped by roadmap** — same pattern as `open-questions.md`.
- **Each entry is a Question**, not a task. Answer it, then return to
  the roadmap and flip the `[-]` to `[x]` (or re-triage if the
  decision changes scope).
- **Autonomy-blocked items** are tagged:
  - 🛑 `artifact-drafting` — requires Understand → Research → Draft
  - 🌐 `cross-repo` — belongs in `@event4u/agent-memory` or consumer repo
  - 🎯 `strategic` — needs user sign-off on scope / priority
  - 🔬 `architecture` — contract-shape / data-model decision
  - 💰 `budget` — requires paid API access or external service
  - 📦 `external-dependency` — blocked on a package/service not yet shipped

## Triage summary — Pass 2 (2026-04-22)

| Category | Count (fill in after pass) |
|---|---|
| 🛑 Artifact drafting | TBD |
| 🌐 Cross-repo | TBD |
| 🎯 Strategic | TBD |
| 🔬 Architecture | TBD |
| 💰 Budget | TBD |
| 📦 External dependency | TBD |

## Questions by roadmap

### `road-to-ticket-refinement.md`

- **Q26** 🛑 `artifact-drafting` — **Output-template presence
  enforcement in `skill_linter.py`.** Should the linter validate
  that skills with an `Output template` section contain the
  expected markdown shape (e.g., `refine-ticket` → three `##`
  headers: `Refined ticket`, `Top-5 risks`, `Persona voices`)?
  Minimal version: schema-per-skill in `evals/` (e.g.,
  `output-schema.yml`) plus a linter pass that verifies the
  section exists and matches. Deferred because it expands the
  linter contract — should ride on `road-to-trigger-evals.md`
  Phase 3 rather than live alone.

- **Q27** 🎯 `strategic` — **Q19 README demo adoption gate.**
  When is a "paste a messy Jira ticket → watch it get refined"
  block worth adding to `README.md`? Proposed gate: after ≥ 1
  consumer project has used `/refine-ticket` on ≥ 3 real tickets
  and reports back. Until then, Phase 5 item stays `[-]` skipped
  with this rationale.

## See also

- [`open-questions.md`](open-questions.md) — Pass 1 (Q1-Q25)
- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
