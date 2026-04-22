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
  section exists and matches.
  **Decision (2026-04-22): deferred to
  [`road-to-trigger-evals.md`](road-to-trigger-evals.md) Phase 3.**
  Will ride on that roadmap's linter-infra upgrade instead of
  landing as a one-off. Revisit when Phase 3 starts (currently
  blocked on Q28 budget).

- **Q27** ✅ `resolved` (2026-04-22) — **Q19 README demo adoption
  gate.** Gate met: two real tickets refined (DEV-6182, DEV-6155)
  with stable output and seven concrete findings captured in
  [`agents/docs/refine-ticket-in-practice.md`](../docs/refine-ticket-in-practice.md).
  README demo can use a real before/after — recommended template
  source is DEV-6155 (smallest scope, no customer names or
  security specifics). Live-run findings tracked in
  [`road-to-refine-ticket-hardening.md`](road-to-refine-ticket-hardening.md)
  (F1–F7). Archived roadmap Phase-5 item flipped to `[x]`.

### `road-to-multi-stack.md`

- **Q30** ✅ `resolved` (2026-04-22) — **Stack-specific authoring
  skills sequencing.** Decisions:
  - **Priority:** Track B first. **Wave B.1 (React core)** is the
    pilot wave — larger external adoption market than Symfony,
    faster feedback loop.
  - **PR granularity:** **one wave = one PR.** Small, reviewable,
    gives a triage checkpoint per wave (does the pattern hold or
    need adjusting?). Track-sized PRs are rejected.
  - **Community policy:** **maintainer-only until Wave B.1 ships
    and is pattern-proven.** After that, community PRs are
    welcomed per wave, following the established pattern. This
    prevents pattern drift before the reference exists.
  - Each wave still requires its own Understand → Research →
    Draft session; Q30 only fixes sequencing + structure, not
    start date. Opening the first wave is gated on the user
    deciding when to allocate the session.

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

- **Q29** 🟢 `parked-open` (2026-04-22) — **Phase 2 of
  `road-to-memory-self-consumption.md` waits on
  `@event4u/agent-memory` shipping.** Since the package is ours, this
  is a prio decision, not an external blocker. Stays open so it
  doesn't disappear, but **does not gate other Q-items**.
  - **Absent path** (no package installed): production-ready, wired,
    file-fallback via `scripts/memory_lookup.py`.
  - **Present path** (package installed): wired but unexecutable
    until the package ships.
  - **Integrity check shipped 2026-04-22:**
    [`agents/contexts/agent-memory-contract.md`](../contexts/agent-memory-contract.md)
    pins the expected interface + flags known drift (`source` /
    `score` naming vs. spec envelope) so we see the diff in one
    place when the package lands.
  - **Revisit triggers:** any tagged `agent-memory` release · a
    consumer explicitly asks for the present path · an integration
    PR opens against this repo · the file fallback's public shape
    changes (then refresh the contract doc *first*).

### `road-to-trigger-evals.md`

- **Q28** ✅ `resolved` (2026-04-22) — **Claude API key + budget
  for live trigger eval runs.** Decisions:
  - **Budget:** $50 ceiling confirmed (PoC + rollout combined);
    realistic PoC spend ~$1.50 (3 skills × 10 queries at
    Sonnet-4-5 rates).
  - **Provisioning:** user-level key, already installed at
    `~/.config/agent-config/anthropic.key` (mode 0600).
  - **Model pin:** `claude-sonnet-4-5` for the pilot + initial
    rollout. Opus pass follows as a delta report, not in parallel.
  - **Phase 2 live run is now unblocked.** Actual execution is a
    manual step (`task test-triggers-live -- <skill>`) — each
    invocation requires tty `yes` confirmation, so the agent never
    spends budget silently.

## See also

- [`open-questions.md`](open-questions.md) — Pass 1 (Q1-Q25)
- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
