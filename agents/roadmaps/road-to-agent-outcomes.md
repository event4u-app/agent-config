# Roadmap: Agent Outcomes — from governed behaviour to visible impact

> Status: **stub / discussion input** — captures a strategic critique
> raised during PR #17 review. Nothing here is decided. Existing skills,
> rules, and commands are **not scheduled for removal** by this document.

## Why this roadmap exists

By PR #17 the package has reached a point where reviewers describe it as
"well-governed but without a flagship outcome":

- **Quality** of skills, rules, commands, guidelines is strong
- **Activation** (trigger sharpness) was improved in PR #15 + #16
- **Defensive discipline** (Waves 1-3) is wired into CI

But external reviewers consistently name the same gap:

- The catalogue has no obvious **Top-5 entry point** for a new adopter
- The implemented flows (`/jira-ticket`, `/bug-fix`, `/feature-plan`,
  `/create-pr`, `/review-changes`) are effective but do **not** compose
  into one visible "ticket → merged PR" storyline
- There is no measurement of whether any flow actually solved the
  incoming task — no outcome loop back into the evals

This roadmap is the **place to discuss that gap** before deciding
whether the next PR focuses on outcomes or on more governance work.

## Principle — preservation first

Applied to every open question below:

1. **No existing skill, rule, command, or guideline is removed** on the
   argument "a review said so". Removal requires the same diligence as
   creation (see [`preservation-guard`](../../.augment/rules/preservation-guard.md)).
2. External reviews are **input**, not verdicts. Each point below is
   marked as *verified*, *partially verified*, or *opinion* so the
   signal-to-noise stays honest.
3. Structural change only happens after we can **reproduce** the
   reported issue from inside the package.

## Open questions (not decisions)

### Q1. Discoverability — does the package need a "Top-5 for new teams" surface?

- Source: Claude review (PR #17), GPT review (PR #17)
- Status: *partially verified* — `commands/` has 59 entries; no curated
  starter list exists in README or `templates/AGENTS.md`
- Candidate artefacts (if we decide yes — none exist yet):
  - a new agent-infra guideline `starter-subset` listing the 5-10
    flows new teams should adopt first, with reasoning
  - README section "First week with event4u/agent-config"
- What it is **not**: a reason to delete or demote the other 54 commands

### Q2. Outcome measurement — how do we know a flow worked?

- Source: GPT review (PR #17)
- Status: *partially verified* — the eval system measures skill
  activation, not task completion; `agents/sessions/` captures flow
  traces but is not aggregated
- Candidate artefacts (if we decide yes — none exist yet):
  - a new `measure_outcomes` script under `scripts/` that reads closed
    PRs + linked tickets and emits a success-rate report per flow
  - a new agent-infra guideline `outcome-telemetry` defining the format
    for flow success / failure markers in sessions
- Explicit caveat: outcome attribution is hard; any number here is a
  **heuristic**, not a KPI

### Q3. Killer-flow framing — is `/jira-ticket` underadvertised?

- Source: GPT review (PR #17, "no killer flow exists")
- Status: *opinion* — `/jira-ticket` already implements the flow GPT
  describes (ticket → analysis → code → PR). The gap is framing and
  adoption, not implementation
- Candidate artefacts (if we decide yes):
  - Rewrite of `commands/jira-ticket.md` intro to position it as the
    primary entry point
  - Walk-through docs with a real ticket
- What it is **not**: a mandate to replace `/jira-ticket` with a new
  mega-command

### Q4. Runtime assumptions — which flows actually run autonomously?

- Source: GPT review (PR #17)
- Status: *opinion* — the package is prompt-centric by design; how
  autonomous a flow runs depends on the consumer's agent setup
  (parallel subagents, tool permissions, MCP servers)
- Candidate artefacts (if we decide yes — none exist yet):
  - a new agent-infra guideline `runtime-expectations` that documents
    what each flow needs (tools, permissions, parallelism) to run
    end-to-end
- What it is **not**: a plan to bundle an agent runtime into the
  package

## Out of scope for this roadmap

- Removing skills on "surface area" grounds
- Replacing any existing rule with a new paradigm
- Adopting any specific vendor agent runtime
- Shipping project-specific content in `.agent-src.uncompressed/`

## Next step

Before any artefact here is built, a **design session** produces:

1. A go / no-go per question Q1-Q4 with rationale
2. For each "go", a concrete artefact spec that passes
   [`artifact-drafting-protocol`](../../.augment/rules/artifact-drafting-protocol.md)
3. A sign-off from the maintainer that no existing artefact is
   collateral damage

Until that session happens, this file stays a stub — referenced from
the PR #17 description so the critique is visible without committing
the package to a direction.

## See also

- [`road-to-defensive-agent.md`](road-to-defensive-agent.md) — the
  governance track this roadmap does **not** replace
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — the
  content-quality track this roadmap does **not** replace
- [`road-to-trigger-evals.md`](road-to-trigger-evals.md) — the
  activation track this roadmap would extend into outcome evals
