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

### `road-to-multi-stack.md`

- **Q30** 🛑 `artifact-drafting` — **Stack-specific authoring
  skills (Waves A.1-A.3, B.1-B.4, C.1, C.3).** Each named skill
  (~30 total across Symfony, React/Next.js, Laminas migration) is
  a separate Understand → Research → Draft session — they cannot
  be bulk-generated without violating skill-quality and
  artifact-drafting-protocol. Scope and capability matrix are
  frozen in [`agents/contexts/multi-stack-inventory.md`](../contexts/multi-stack-inventory.md).
  Sequencing question for the user:
  - Do we open Track A (Symfony) first, or prioritise Track B
    (Next.js/React) based on incoming adoption signals?
  - One wave per PR, or bundled per track?
  - Community contributions accepted per wave, or maintainer-only
    until the pattern is proven on Wave A.1?

- **Q31** 🎯 `strategic` — **Wave A.4 plain-PHP leakage
  verification.** Needs a real plain-PHP test repository (no
  Laravel). Does the user have one to point at, or should we
  scaffold a minimal fixture (~50 LOC, no framework)?

- **Q32** 🎯 `strategic` — **Wave C.2 adoption-gating signal.**
  Laminas authoring skills only ship when adoption justifies.
  What's the trigger? Proposal: ≥ 2 external consumers install
  the package against a Laminas project within a quarter. Until
  then, analysis-only coverage (`project-analysis-zend-laminas`)
  is the commitment.

### `road-to-autonomous-agent.md`

- **Q34** 🛑 `artifact-drafting` + 🎯 `strategic` — **Autonomous-agent
  backlog (Phases 0, 4, 5, 7, 9 + leftover items in 1, 6, 8).**
  Shipped: Phases 1-3, 6.1, 8 (target list) — foundation is live
  (TDD, systematic debugging, four judges, subagent orchestration,
  `/review-changes` dispatch, git worktrees, citations on target
  skills). What remains:
  - **Phase 0** — exec-runtime spike (1 dev-day, go/no-go gate on
    ≥ 70 % token savings across 3 bulk-edit benchmarks).
  - **Phase 4 — planning chain** — `/brainstorm`, `/plan`,
    `/implement`. **Scope overlap question for the user:**
    `/refine-ticket` + `/estimate-ticket` + `/feature-plan` shipped
    after this roadmap was written. Does the three-command chain
    still carry its weight, or does `/plan` collapse into the
    existing stack? If it ships, each command is a separate
    `artifact-drafting-protocol` session.
  - **Phase 5 — reflection loop** — `/reflect` + wiring into
    `learning-to-rule-or-skill`. Blocked on Phase 4.
  - **Phase 6.2** — one real multi-worktree case study. Captures on
    first real parallel session; no action until then.
  - **Phase 7 — MCP creation depth** — rename `mcp` → `mcp-usage`
    and add `mcp-builder` with Node/TS + Python + PHP guides.
    Separate session; Phase-0 spike findings may change the shape.
  - **Phase 8 — last retrofit item** — depends on Phases 1-7
    finishing so there are post-Phase-3 skills to retrofit.
  - **Phase 9 — AGENTS.md synthesis** — lands last by design; only
    unblocked after Phases 4, 5, 7 ship.
  - **Phase 1.3** — rule↔skill sync linter; deferred as
    low-leverage until drift is observed.
  - **Phase 1.5** — "one real ticket" evidence; requires consumer
    project usage.

  Single question for the user: **sequencing.** Which phase ships
  next — Phase 0 spike (infrastructure), Phase 4 planning chain
  (ship or drop after reviewing the overlap), or Phase 7 MCP
  builder? Or park the whole backlog and drive from
  `open-questions-2.md` when a consumer need arises?

### `road-to-stronger-skills.md`

- **Q35** 🛑 `artifact-drafting` — **Pattern-backport across the
  pre-existing skill catalogue.** ~109 skills across 4 tiers
  (Tier 1: 12, Tier 2: 24, Tier 3: 50, Tier 4: 23) grouped into
  17 batches across 5 phases. Each batch is a single commit;
  each skill inside a batch is a separate
  `preservation-guard`-gated edit. The roadmap explicitly
  prohibits bulk transformations — that is the rule this roadmap
  is built on.

  New skills shipped after 2026-04 are pattern-compliant on day 1
  (e.g., `threat-modeling`, `authz-review`, `data-flow-mapper`,
  `blast-radius-analyzer`, `context-authoring`, the four
  `judge-*` skills, `test-driven-development`,
  `systematic-debugging`, `verify-before-complete`,
  `subagent-orchestration`, `refine-ticket`, `estimate-ticket`).
  The backport covers only the pre-2026-04 catalogue.

  User questions:
  - Ship order — Tier 1 first (highest leverage) or Tier 4 first
    (lowest risk, builds muscle memory)?
  - Batch size — 3 skills per commit (current plan) or
    1-skill-per-commit for easier reviews?
  - Should each batch get a `/review-changes` judge pass before
    merge, or batch-reviewed weekly?
  - Is the +10 % word-budget cap still acceptable given the
    total skill count, or tighten to +5 %?

### `road-to-defensive-agent.md`

- **Q33** 🛑 `artifact-drafting` — **Wave 2 + Wave 3 + post-wave
  integration for defensive-agent.** Wave 1 shipped (6 skills + 5
  context templates). What remains:
  - **Wave 2 (5 skills + rule + command extension):**
    `dependency-risk-review`, `data-exposure-review`,
    `migration-safety`, `queue-safety`, `secrets-and-config-review`,
    plus a "never-help-build-offensive-cyber-capability" rule with
    10-prompt red-team regression, plus `/review-changes`
    Risk-Scorecard extension.
  - **Wave 3 (4 skills + 1 extension):** `input-validation-review`,
    `multi-tenant-boundary-review`, `secure-laravel-architecture`
    (stack-scoped), `regression-hunter`, plus `bug-analyzer`
    incident-mode section.
  - **Post-waves (3 integrations):** `/review-changes` dispatch
    globs, `/feature-plan` calls `threat-modeling` +
    `data-flow-mapper`, `finishing-a-development-branch`
    cross-links `secrets-and-config-review`.

  Every skill is its own `artifact-drafting-protocol` session;
  bulk creation is not allowed by `skill-quality`. Also needs a
  live `/review-changes` smoke test on a real diff. User questions:
  - Ship Wave 2 before or after Wave 3? (proposal: Wave 2 first —
    higher leverage, no stack gating)
  - One PR per skill, or bundled per wave?
  - Ok to use a past PR from another project as the smoke-test
    diff, or scaffold a synthetic fixture diff in this repo?

### `road-to-memory-self-consumption.md`

- **Q29** 📦 `external-dependency` — **Phase 2 of
  `road-to-memory-self-consumption.md` needs
  `@event4u/agent-memory` published.** All three remaining items
  (local install, operational store, `/memory-promote` walkthrough)
  share the same blocker. The absent-path flow is production-ready;
  the present-path flow is wired but cannot execute until the
  package exists. No agent-config change unblocks this — the
  agent-memory repo owns the shipping decision. Revisit when a
  release is tagged there.

### `road-to-trigger-evals.md`

- **Q28** 💰 `budget` — **Claude API key + budget for live trigger
  eval runs.** Phase 2 of `road-to-trigger-evals.md` needs a
  prepaid key (target: $50 ceiling across all PoC + rollout runs
  combined) and confirmation of which model the user's sessions
  actually run (undertriggering is model-specific; runner defaults
  to `claude-sonnet-4-5`, override with `--model`). Ship wiring
  has been done; execution is the only gate. Decision from user:
  - Is the $50 ceiling still the agreed budget?
  - Who provisions the key (user account vs. project account)?
  - Which model name should the runner lock to, or do we keep
    `--model` manual per run?

## See also

- [`open-questions.md`](open-questions.md) — Pass 1 (Q1-Q25)
- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
