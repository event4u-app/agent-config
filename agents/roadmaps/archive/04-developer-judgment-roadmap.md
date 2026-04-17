# Developer Judgment Activation Roadmap

> **Status: ✅ COMPLETED** (2026-04-17)

## Problem

The agent infrastructure is becoming technically capable, but it still lacks **active judgment**.
A more capable agent that blindly executes is just a more efficient mistake machine.

Currently missing:

- No systematic challenge of weak or contradictory feature requests
- No validation of whether a request fits the existing architecture
- No heuristic to detect when a plan needs refinement before implementation
- Skills execute what the user says, even when the request is underspecified or harmful

## Goal

Ensure the agent **improves weak or contradictory requests** before implementation,
and **actively contributes to code quality** rather than just following instructions.

## What this changes for the user

- Agent pushes back on vague or contradictory requirements before coding
- Agent validates that a feature fits existing architecture before implementing
- Agent suggests better approaches when the requested approach has known problems
- Agent still respects the user's final decision — challenge ≠ refuse

## The judgment spectrum

| Situation | Agent behavior |
|---|---|
| Clear, well-defined request | Execute immediately |
| Ambiguous request | Ask one clarifying question |
| Request contradicts existing code | Challenge with evidence |
| Request violates architecture | Propose alternative, explain why |
| Request duplicates existing functionality | Point out the existing solution |
| Request is technically harmful | Warn, propose safe alternative |
| User insists after challenge | Execute with explicit warning |

## PR series

### PR 1: Rule — `improve-before-implement`

A new auto-rule that triggers before implementation of features, refactors, or architectural changes.

**Content:**
- Before implementing: check if the request is clear, consistent, and fits the codebase
- If underspecified → ask a focused question (max 1-2, not an interrogation)
- If contradicts existing patterns → show evidence, propose alternative
- If duplicates existing code → point it out
- **Never refuse** — challenge, explain, then execute if user insists

**Trigger:** When user requests a feature, refactor, or architectural change.

**Does NOT trigger for:** Bug fixes, config changes, documentation, quality fixes.

**Acceptance:**
- Rule is `type: auto` with clear trigger description
- Linter passes (0 FAIL)
- Rule is concise — constraints only, no step-by-step workflow

---

### PR 2: Skill — `validate-feature-fit`

A skill for deeper analysis when the rule detects a potential misfit.

**Procedure:**
1. Analyze the requested feature against existing architecture
2. Check for duplicates (similar functionality already exists?)
3. Check for contradictions (breaks existing patterns?)
4. Check for scope creep (request is bigger than it appears?)
5. Present findings with evidence (file references, code snippets)
6. Offer numbered options: implement as-is, implement with suggested changes, discuss further

**Acceptance:**
- Skill has complete structure (When to use, Procedure, Output format, Gotchas, Do NOT)
- Linter passes (0 FAIL)
- Skill references the `improve-before-implement` rule

---

### PR 3: Update reference skills with challenge behavior

Add judgment guidance to 2-3 implementation-heavy skills:

- `laravel` skill — add section on validating request against existing architecture
- `php-service` skill — add section on checking for duplicate services
- `feature-plan` skill — add requirement validation step before planning

**Acceptance:**
- Each skill has an explicit "validate before implementing" step
- Steps are concrete (not "think carefully" but "check X, Y, Z")
- Linter passes on all modified skills

---

### PR 4: Linter heuristic for challenge behavior

Add a linter check that flags skills missing validation/challenge guidance.

**Logic:**
- Skills with `execution: assisted` that have a "Procedure" section
  should contain at least one validation or requirement-checking step
- Warning (not failure) if missing — encourages but doesn't block

**Files:**
- Modified: `scripts/skill_linter.py`
- New: `tests/test_linter_judgment.py`

**Acceptance:**
- Linter warns on assisted skills without validation steps
- Existing skills are not broken by the new check (warning, not error)
- Test coverage for the new heuristic

---

### PR 5: Documentation — when to challenge, when to proceed

**Deliverable:**
- New: `.augment.uncompressed/guidelines/agent-infra/developer-judgment.md`
- Compressed: `.augment/guidelines/agent-infra/developer-judgment.md`

**Content:**
- Decision table: when to challenge vs. when to proceed
- Examples of good challenges (with evidence) vs. bad challenges (nitpicking)
- The golden rule: "Challenge to improve, never to refuse"
- Integration with `ask-when-uncertain` rule

## Dependencies

- No hard dependencies on other Phase 4 roadmaps
- Can be started in parallel with Roadmap 1-3
- Benefits from tagged skills (Roadmap 2) for linter heuristic in PR 4

## Risk

- Agent becomes annoying (challenges everything, slows down workflow)
- Mitigation: only trigger on implementation tasks, max 1-2 questions, respect "just do it"
- False positives in linter heuristic
- Mitigation: warning-only, not blocking
