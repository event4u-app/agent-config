# Roadmap: Role Modes — explicit frames and output contracts

> Give the agent six named working modes (Developer / Reviewer / Tester /
> PO / Incident / Planner) with a fixed output contract per mode. A
> smaller model stabilizes when it loads the right frame instead of
> inventing one per task.

## Prerequisites

- [x] [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) master frame adopted
- [x] `ask-when-uncertain`, `scope-control`, `verify-before-complete` rules active — role contracts must integrate with them, not bypass them
- [x] `.agent-settings` mechanism exists — switching can land there without new infrastructure
- [x] [`road-to-stronger-skills.md`](road-to-stronger-skills.md) tier system — role defaults reuse existing skills rather than cloning them

## Vision

A role mode is a **loaded mental frame**, not a new command surface. When
the agent enters `reviewer` mode:

- Allowed actions narrow (no implementation, no scope creep)
- Expected output follows a fixed contract (summary / risks / findings / recommendation)
- Default skill set is pre-selected (`judge-*`, `authz-review`, `threat-modeling`)
- Escalation paths are explicit (who gets called when a risk is flagged)

The mode's job is to **replace ad-hoc reasoning with a reproducible
frame** so that Sonnet and Opus produce comparable outputs on the same
task.

## Non-goals (explicit)

- **No** new agent runtime. Modes are loaded via existing mechanisms
  (`.agent-settings`, `/mode` command, or task-inferred).
- **No** rewrite of existing skills. Modes *compose* existing skills
  under a contract; they do not replace them.
- **No** auto-switch without user visibility. Inferred mode switches
  must surface a one-line acknowledgement ("entering reviewer mode").
- **No** contracts that force the model to hallucinate missing inputs.
  Every contract integrates with `ask-when-uncertain`: fields the user
  did not provide become questions, not fabrications.

## The six modes

| Mode | Entry signal | Default skills | Output contract (skeleton) |
|---|---|---|---|
| **Developer** | "implement X", `/jira-ticket`, `/bug-fix` | `php-coder`, `laravel`, `test-driven-development`, `quality-tools` | Goal / Plan / Changes / Tests / Open questions |
| **Reviewer** | `/review-changes`, `/judge`, PR open on branch | `judge-bug-hunter`, `judge-code-quality`, `judge-security-auditor`, `judge-test-coverage` | Summary / Risks / Findings / Required actions / Verdict |
| **Tester** | "add tests", "why does X fail", test output in context | `pest-testing`, `api-testing`, `e2e-plan`, `test-performance` | Behaviour under test / Edge cases / Negative paths / Reproduction / Coverage gaps |
| **PO** | "I want a feature", `/feature-explore`, `/feature-plan` | `validate-feature-fit`, `api-design`, `threat-modeling` | Goal / Assumptions / Acceptance criteria / Impacted modules / Risks / Open questions for stakeholder |
| **Incident** | "production is down", `break-glass: true`, hotfix branch | `bug-investigate`, `systematic-debugging`, `authz-review` | Symptom / Reproduction / Minimal reversible change / Deferred verification / Follow-up commitment |
| **Planner** | "what's the strategy", `/feature-roadmap`, multi-step work with unclear order | `feature-plan`, `feature-roadmap`, `blast-radius-analyzer` | Goal / Constraints / Option set / Recommendation / Dependencies / Rollback |

Each contract is a *skeleton*, not a form. Fields without evidence
become questions back to the user (per `ask-when-uncertain`).

## Phases

### Phase 1 — contracts as guidelines (no runtime change)

- [x] New agent-infra guideline `role-contracts` — the six contract skeletons verbatim *(2026-04-22: [`role-contracts.md`](../../docs/guidelines/agent-infra/role-contracts.md))*
- [x] Each contract cross-linked from its entry-point commands *(2026-04-22: `See also` section with `role-contracts.md#<mode>` anchors added to `jira-ticket`, `bug-fix`, `review-changes`, `judge`, `feature-explore`, `feature-plan`, `feature-roadmap`, `tests-create`, `bug-investigate`)*
- [x] Skill linter warns if a command references a contract field not present in the guideline *(2026-04-22: [`lint_role_contract_refs`](../../scripts/skill_linter.py) in `skill_linter.py` — parses H3 mode slugs from `Contract skeletons` section of `role-contracts.md`, warns on `role-contracts.md#<unknown-slug>` references; bootstrap-safe (no-op when guideline is missing); covered by `test_role_contract_ref_*` in `tests/test_skill_linter.py`)*

Ship first because it requires no mode-switching mechanism.

### Phase 2 — explicit mode switching via .agent-settings

- [x] `.agent-settings` gains `default_role` and `active_role` keys *(2026-04-22: [`agent-settings.md` template](../../.agent-src.uncompressed/templates/agent-settings.md) adds `roles:` section with `default_role` + `active_role`; Settings Reference table lists both keys; six modes allowed)*
- [x] `/mode <name>` command prints the contract, default skills, and refuses work outside the contract *(2026-04-22: [`/mode`](../../.agent-src.uncompressed/commands/mode.md) — validates against H3 slugs in `role-contracts.md`, prints contract body, writes `roles.active_role`, refuses forbidden work with numbered prompt)*
- [x] Rule `role-mode-adherence` (auto-triggered when `active_role` is set) — agent must close with the contract's output *(2026-04-22: [`role-mode-adherence`](../../.agent-src.uncompressed/rules/role-mode-adherence.md) — auto-type rule, closing outputs must use contract fields + emit the structured mode marker, three forbidden-work examples, inert when `active_role` is empty)*

### Phase 3 — inferred mode switching with user acknowledgement

- [x] Router guideline maps common entry signals → mode (see table above) *(2026-04-22: [`role-mode-router.md`](../../docs/guidelines/agent-infra/role-mode-router.md) — entry signal table, precedence order, "when NOT to infer" clauses, scratch list for candidate signals)*
- [x] Inferred switch surfaces as `> entering {mode} mode — contract: …` before any work *(2026-04-22: [`role-mode-router.md` "Surfacing the inferred switch"](../../docs/guidelines/agent-infra/role-mode-router.md#surfacing-the-inferred-switch) — exactly one line, no reasoning narration, proceeds on silence)*
- [x] User can veto with `/mode none` *(2026-04-22: [`role-mode-router.md` "Veto path"](../../docs/guidelines/agent-infra/role-mode-router.md#veto-path) — numbered prompt with switch/stay/clear options; `/mode none` path documented in [`/mode`](../../.agent-src.uncompressed/commands/mode.md) step 1)*

### Phase 4 — measurement hook (closes Q2 of master frame)

- [x] Each contract output emits a structured header the consumer can grep *(2026-04-22: [`role-contracts.md` "Structured mode markers" section](../../docs/guidelines/agent-infra/role-contracts.md#structured-mode-markers) — HTML-comment marker `<!-- role-mode: <mode> | contract: <kebab-case-fields> -->` — invisible in render, greppable in session captures; six reserved mode values)*
- [x] Session capture counts contract-conformant outputs per mode *(2026-04-22: [`memory_report._role_mode_stats`](../../scripts/memory_report.py) scans `agents/sessions/`, `agents/reports/`, `agents/handoffs/`, `agents/learnings/` for the structured mode marker, counts per mode, flags unknown slugs; 4 tests in `tests/test_memory_report.py`)*
- [x] Feeds [`road-to-curated-self-improvement.md`](road-to-curated-self-improvement.md) success signal *(2026-04-22: `memory_report`'s role-mode block is printed alongside the quarterly block in the text output — consumed by the weekly [`proposal-drift.yml`](../../.agent-src.uncompressed/templates/github-workflows/proposal-drift.yml) job that already pipes `memory_report.py --quarterly`)*

## Integration with existing artefacts

- **`ask-when-uncertain`** — contracts defer to it; no field is ever invented
- **`scope-control`** — `reviewer` mode explicitly forbids implementation; `developer` mode forbids review verdicts on own code
- **`preservation-guard`** — modes do not justify rewriting or removing existing skills
- **`verify-before-complete`** — every contract's closing field is an evidence field; no mode can skip the gate

## Open questions

- **Switch conflict**: what happens when `active_role=reviewer` and the user
  says "fix this"? Default: refuse, point at `developer` mode. Needs decision.
- **Role stacking**: can Developer + Tester run together (TDD-style)? Phase 1
  treats them as separate modes with a hand-off boundary; stacking is deferred.
- **PO mode risk**: the contract must not let the agent pretend to
  represent absent stakeholders. Every "Assumption" field needs a
  "verify with: {name}" marker.

## Acceptance criteria

Phase 1 is shipped when: six contract skeletons exist as a guideline,
three commands reference their contract, and the linter enforces the link.

## See also

- [`road-to-agent-outcomes.md`](road-to-agent-outcomes.md) — master frame
- [`road-to-stronger-skills.md`](road-to-stronger-skills.md) — skill quality base
- [`output-patterns.md`](../../docs/guidelines/agent-infra/output-patterns.md) — existing output conventions modes must respect
