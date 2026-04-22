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

- **Q31** ✅ `resolved` (2026-04-22) — **Wave A.4 plain-PHP
  leakage verification.** Decision: scaffold a minimal ~50 LOC
  fixture (single `index.php`, one class, PSR-4 autoload, no
  Composer package) **when Wave A.4 actually starts** — not now.
  Rationale: real plain-PHP repos are rare in 2026 and the delta
  to our skill assumptions isn't predictable until we have the
  Track A skills in hand. Scaffolding preemptively is wasted
  context. The fixture task is attached to Wave A.4's drafting
  session, not to today.

- **Q32** ✅ `resolved` (2026-04-22) — **Wave C.2 adoption-gating
  signal.** Decision: drop the "≥ 2 installs / quarter" trigger
  (not measurable without telemetry) and replace it with
  engagement-based signals that track commitment, not intent:
  - **≥ 1 concrete pull request** targeting a Laminas authoring
    skill (strongest possible signal — someone does the work), or
  - **≥ 2 independent issues / GitHub Discussions** citing a real
    Laminas use case for authoring (not just analysis),
  - measured over **2 quarters** (6 months) — Laminas migration
    timelines are slow; one quarter is too short.
  Until one threshold is met, Wave C.2 stays parked. No
  automatic cancel — just "not prioritised". Wave C.1
  (analysis-only deepening) and Wave C.3 (migration skills)
  are **not** adoption-gated by Q32 and can progress
  independently.

### `road-to-autonomous-agent.md`

- **Q34** ✅ `resolved` (2026-04-22) — **Autonomous-agent
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

  **Resolved 2026-04-22. Decisions:**
  - **Phase 0 (exec-runtime spike)** ships first — 1 dev-day,
    measurable go/no-go gate (≥ 70 % token savings across
    3 bulk-edit benchmarks). Infrastructure unblocks everything.
  - **Phase 4 collapses** to a thin `/plan` wrapper that calls
    `/refine-ticket` → `/estimate-ticket` → `/feature-plan` as
    sub-skills. No new `/brainstorm` or `/implement` commands
    — the three shipped commands already cover the planning
    chain. Saves two full drafting sessions and prevents
    duplication.
  - **Phase 7 (MCP builder)** next — standalone, user-visible,
    no dependencies on Phases 4 or 5.
  - **Phases 5 and 9** last — Phase 5 needs Phase 4's `/plan`
    wrapper; Phase 9 (AGENTS.md synthesis) lands last by design.
  - **Phase 6.2, 1.3, 1.5** stay event-triggered (first real
    parallel session · drift observed · consumer evidence) —
    no active scheduling.
  - Ship order within a phase still follows Q30's pattern:
    one skill / wrapper / command per PR, `/review-changes`
    per PR.

### `road-to-stronger-skills.md`

- **Q35** ✅ `resolved` (2026-04-22) — **Pattern-backport across
  the pre-existing skill catalogue.** ~109 skills across 4 tiers
  (Tier 1: 12, Tier 2: 24, Tier 3: 50, Tier 4: 23). New skills
  shipped after 2026-04 are pattern-compliant on day 1
  (`threat-modeling`, `authz-review`, `data-flow-mapper`,
  `blast-radius-analyzer`, `context-authoring`, the four
  `judge-*` skills, `test-driven-development`,
  `systematic-debugging`, `verify-before-complete`,
  `subagent-orchestration`, `refine-ticket`, `estimate-ticket`).
  The backport covers only the pre-2026-04 catalogue.

  **Decisions:**
  - **Ship order: Tier 4 first** — 23 lowest-risk skills. Builds
    pattern-application muscle before touching high-leverage
    Tier 1. If the pattern itself needs adjustment, we discover
    it on low-stakes skills.
  - **Batch size: 1 skill per commit** — consistent with Q30,
    Q33, Q34. Reviewable, revertable, no hidden breakage.
    Original "3 skills per commit" dropped.
  - **Review cadence: `/review-changes` per batch**. Weekly
    batch review loses the four-judge signal that the whole
    roadmap is built around.
  - **Word-budget cap: +10 % held** (not tightened to +5 %).
    Tightening risks losing important context during backport;
    total skill count doesn't change the per-skill budget math.
  - Resequences the phases: Phase 4 (Tier 4) first, then
    Phases 3 → 2 → 1. Phase 0 (baseline linter) still ships
    before any phase begins.

### `road-to-defensive-agent.md`

- **Q33** ✅ `resolved` (2026-04-22) — **Wave 2 + Wave 3 +
  post-wave integration for defensive-agent.** Wave 1 shipped
  (6 skills + 5 context templates). What remains:
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

  **Decisions:**
  - **Wave 2 before Wave 3** — higher leverage, no stack gating.
    Wave 3 includes the Laravel-stack-scoped skill and the
    `bug-analyzer` incident-mode section, both of which benefit
    from Wave 2's review skills being in place.
  - **One PR per skill** (wave integration items included) —
    consistent with Q30, Q34, Q35. Each skill is its own
    `artifact-drafting-protocol` session.
  - **Synthetic fixture diff in this repo** for the
    `/review-changes` smoke test — reproducible, no cross-repo
    leak, can be kept as a regression anchor. A past PR from
    another project is a one-shot; a fixture re-runs on every
    defensive-agent update.
  - **Rule + command-extension items** ride along with the
    skill PR that most directly produces them
    (`never-help-...` rule with `secrets-and-config-review`;
    Risk-Scorecard extension as its own PR after the 5 Wave-2
    skills land).

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
