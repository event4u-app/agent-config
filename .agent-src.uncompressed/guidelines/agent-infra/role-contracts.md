# Role Contracts

Six named working modes with a fixed output contract per mode. Loading
a role frame stabilizes smaller models: they stop inventing a frame per
task and produce reproducible outputs on the same input.

Referenced by `road-to-role-modes.md` Phase 1. Each contract is a
*skeleton*, not a form — fields without evidence become questions via
`ask-when-uncertain`, never fabrications.

## The six modes

| Mode | Entry signal | Default skills | Output contract |
|---|---|---|---|
| **Developer** | "implement X", `/jira-ticket`, `/bug-fix` | `php-coder`, `laravel`, `test-driven-development`, `quality-tools` | Goal / Plan / Changes / Tests / Open questions |
| **Reviewer** | `/review-changes`, `/judge`, PR open on branch | `judge-bug-hunter`, `judge-code-quality`, `judge-security-auditor`, `judge-test-coverage` | Summary / Risks / Findings / Required actions / Verdict |
| **Tester** | "add tests", "why does X fail", test output in context | `pest-testing`, `api-testing`, `e2e-plan`, `test-performance` | Behaviour under test / Edge cases / Negative paths / Reproduction / Coverage gaps |
| **PO** | "I want a feature", `/feature-explore`, `/feature-plan` | `validate-feature-fit`, `api-design`, `threat-modeling` | Goal / Assumptions / Acceptance criteria / Impacted modules / Risks / Open questions for stakeholder |
| **Incident** | "production is down", `break-glass: true`, hotfix branch | `bug-investigate`, `systematic-debugging`, `authz-review` | Symptom / Reproduction / Minimal reversible change / Deferred verification / Follow-up commitment / Incident learning |
| **Planner** | "what's the strategy", `/feature-roadmap`, multi-step work with unclear order | `feature-plan`, `feature-roadmap`, `blast-radius-analyzer` | Goal / Constraints / Option set / Recommendation / Dependencies / Rollback |

## Contract skeletons

### Developer

```
**Goal:** <what the user asked for, one sentence>
**Plan:** <ordered steps, ≤5>
**Changes:** <files touched, one line each>
**Tests:** <added/updated tests + how to run>
**Open questions:** <unresolved items, none if blank>
```

### Reviewer

```
**Summary:** <one-paragraph overview of the diff>
**Risks:** <ranked list: high/medium/low>
**Findings:** <file:line → issue → fix suggestion>
**Required actions:** <numbered list the author must address>
**Verdict:** approve | request changes | block
```

### Tester

```
**Behaviour under test:** <the invariant, one sentence>
**Edge cases:** <boundary + error paths covered>
**Negative paths:** <expected failures, error types>
**Reproduction:** <how to run a single failing case>
**Coverage gaps:** <what stayed untested and why>
```

### PO

```
**Goal:** <user-facing outcome>
**Assumptions:** <each marked `verify with: {name}` if unconfirmed>
**Acceptance criteria:** <testable, numbered>
**Impacted modules:** <paths, not speculation>
**Risks:** <business + technical>
**Open questions for stakeholder:** <blocking decisions only>
```

### Incident

```
**Symptom:** <what users see, not the hypothesis>
**Reproduction:** <minimal steps or "not reproduced">
**Minimal reversible change:** <the smallest fix>
**Deferred verification:** <what was skipped under break-glass>
**Follow-up commitment:** <PR/ticket for full verification, due date>
**Incident learning:** <intake signal id, OR `/memory-add incident-learnings` draft ref>
```

**Memory-write is the final field, not a nice-to-have.** Before the
mode exits, the agent MUST either emit an intake signal via
[`memory-access`](memory-access.md) (`scripts/memory_signal.py`
append — one line, fire-and-forget) or draft a curated entry with
[`/memory-add incident-learnings`](../../commands/memory-add.md).
Pattern + consequence + guardrail, redacted. Skipping this field
means the incident did not produce a learning — log the absence,
do not pretend verification happened.

### Planner

```
**Goal:** <target state, one paragraph>
**Constraints:** <hard limits: time, deps, policy>
**Option set:** <2-4 options with trade-offs>
**Recommendation:** <which option + one-line justification>
**Dependencies:** <what must ship first>
**Rollback:** <how to revert if it fails>
```

## Integration rules

- **`ask-when-uncertain`** — any contract field without evidence becomes
  a question, not a guess. The contract does not license fabrication.
- **`scope-control`** — `Reviewer` mode forbids implementation work.
  `Developer` mode forbids producing review verdicts on own code.
  `PO` mode forbids committing to absent stakeholders' decisions.
- **`preservation-guard`** — no mode justifies rewriting or removing
  existing skills. Modes *compose* skills, they do not replace them.
- **`verify-before-complete`** — the final field of every contract is
  an evidence field (Tests, Verdict, Reproduction, Acceptance criteria,
  Deferred verification, Rollback). No mode ships without it.

## When to load a contract

- **Explicit**: user invokes a command in the entry-signal column.
- **Inferred**: first message matches a signal — surface one line
  (`> entering {mode} mode — contract: {fields}`) and continue.
- **Overridden**: user says "no mode" or invokes `/mode none` — drop
  the frame and fall back to default conversation.

## Structured mode markers

Every contract output MUST begin with a one-line HTML comment so
session captures, log scrapers, and the measurement hook in
[`road-to-role-modes.md`](../../../agents/roadmaps/road-to-role-modes.md#phase-4--measurement-hook-closes-q2-of-master-frame)
can count contract-conformant outputs per mode:

```
<!-- role-mode: developer | contract: goal,plan,changes,tests,open-questions -->
```

The marker is:

- **Invisible** in rendered markdown — no UI noise.
- **Greppable** with a stable prefix (`role-mode:`).
- **Self-describing** — `contract:` lists the fields in kebab-case and
  in the order they must appear, so a scraper can verify conformance
  without hardcoding the mode→contract map.

Reserved values for `role-mode`:

- `developer` · `reviewer` · `tester` · `po` · `incident` · `planner`

Any other value is treated as non-conformant. A reply with no marker
counts as the default "no-mode" conversation and does not feed the
mode statistics.

## Anti-patterns

- **Do NOT** mix two contracts in one reply. If the task shifts
  (review → fix), close the current contract first with its evidence
  field, then enter the next mode.
- **Do NOT** invent fields the contract does not list. The skeleton
  is the maximum surface, not the minimum.
- **Do NOT** hand-wave the final evidence field ("tests should pass").
  Run the verification or mark it as deferred with a follow-up commit.
- **Do NOT** treat the default-skills list as mandatory. The skills
  are pre-loaded; the contract decides which get invoked.

## See also

- [`road-to-role-modes.md`](../../../agents/roadmaps/road-to-role-modes.md) — roadmap this guideline implements
- [`output-patterns.md`](output-patterns.md) — generic output conventions modes inherit
- [`agent-interaction-and-decision-quality.md`](agent-interaction-and-decision-quality.md) — how modes interact with the numbered-options protocol
