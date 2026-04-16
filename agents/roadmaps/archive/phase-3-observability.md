# Phase 3 Roadmap — 9.2 → 9.8 — ✅ COMPLETE

## Goal

Upgrade the package from a **production-ready agent config framework** to a **high-observability, safely evolving, nearly self-optimizing agent system**.

## Status: COMPLETE

All items implemented. See `phase-3-pr-plan.md` for implementation details.

Summary of what was delivered:

* ✅ Observability layer (lint reports, per-file quality, regression detection)
* ✅ Safe optimization commands (were already safe, verified)
* ✅ Compression preservation guard (new rule + linter checks)
* ✅ Quality score / review report (per-file breakdown in --report)
* ✅ Feedback aggregation loop (category tags in pipeline)
* ❌ Execution memory (intentionally skipped — no runtime consumer)
* ✅ PR comment / artifact reporting (CI summary + regression report)

---

Previously identified gaps (now resolved):

* ~~weak observability~~ → lint reports, regression detection, quality scoring
* ~~limited feedback aggregation~~ → category tags in improvement pipeline
* ~~unsafe or outdated optimize commands~~ → verified safe, synced
* ~~no quality scoring / trend visibility~~ → per-file quality report + regression delta
* ~~no strong preservation guard~~ → preservation-guard rule + compression-aware linting

---

# Phase 3 priorities

## P0 — Highest impact

1. Observability layer
2. Safe optimization commands
3. Compression preservation guard

## P1 — Next layer

4. Quality score / review report
5. Feedback aggregation loop

## P2 — Optional advanced layer

6. Execution memory / lightweight run history
7. PR comment / artifact reporting

---

# 1. Add observability layer

## Problem

The package has strong rules and guardrails, but weak visibility into:

* which skills are used often
* where warnings/failures cluster
* where regressions are introduced
* which areas are weak but still passing

## Goal

Make quality visible.

## Deliverables

### 1.1 Lint summary artifact

Generate structured output after lint:

* number of skills/rules checked
* pass / warning / fail counts
* top issue codes
* files with most warnings/errors

Output:

* JSON artifact
* optional markdown summary

### 1.2 Skill usage / hot-spot report (manual or lightweight)

Track at least:

* recently changed skills
* frequently lint-failing skills
* frequently refactored skills

Even a simple file-based report is enough.

### 1.3 Regression visibility

Highlight:

* new failures introduced by branch
* skills that moved from pass → warning
* skills that moved from warning → fail

## Definition of done

You can answer:

* Where is the system weak?
* What is improving?
* What is getting worse?

---

# 2. Refactor optimize commands into safe audit commands

## Problem

`optimize-skills` and `optimize-agents` still risk operating like autonomous changers instead of safe auditors.

## Goal

Keep their value, remove their danger.

## Deliverables

### 2.1 `optimize-skills`

Convert to:

* duplicate finder
* overlap detector
* merge-candidate reporter
* sharpness-risk reporter

Must:

* read from `.augment.uncompressed/`
* respect linter output
* never weaken automatically
* produce suggestions only

### 2.2 `optimize-agents`

Convert to:

* rule overlap audit
* AGENTS.md consistency audit
* system complexity / duplication reporter
* token-budget awareness report

Must:

* read from `.augment.uncompressed/`
* never silently weaken rules
* never suggest `always -> auto` without explicit proof

### 2.3 Safe output contract

All optimize commands should output:

1. findings
2. risks
3. suggestions
4. no auto-application

## Definition of done

Optimize commands can no longer damage the system.

---

# 3. Add compression preservation guard

## Problem

Compression is structurally safer now, but still vulnerable to hidden quality loss.

## Goal

Ensure compression preserves skill quality, not just file shape.

## Deliverables

### 3.1 Manual preservation checklist

For compressed output, confirm preservation of:

* concrete validation
* strongest example
* strongest anti-pattern
* essential decision hints
* required sections

### 3.2 Linter pair-check enhancement

Extend `--pairs` or equivalent comparison mode to detect:

* missing validation content
* collapsed examples
* weaker anti-pattern coverage
* reduced decision clarity

Start simple:

* section comparison
* keyword preservation
* validation phrase comparison

### 3.3 Compression reject criteria

Reject compression if it:

* removes concrete validation
* removes strongest example without replacement
* removes strongest anti-pattern without replacement
* weakens routing / decision logic

## Definition of done

Compressed skills remain as strong as source skills.

---

# 4. Add quality score / review report

## Problem

The system enforces quality, but does not summarize it clearly.

## Goal

Create a lightweight health view for the package.

## Deliverables

### 4.1 Per-file quality summary

For each skill/rule:

* structure: pass/fail
* validation: strong/weak
* scope: focused/broad
* guideline dependency: low/medium/high
* compression risk: low/medium/high

### 4.2 Repo-level report

Summarize:

* total pass/warn/fail
* top weak areas
* top risky skills
* merge candidates
* pointer-only risk candidates

### 4.3 CI artifact

Upload:

* JSON report
* optional markdown summary

## Definition of done

Weaknesses are visible before they become regressions.

---

# 5. Add feedback aggregation loop

## Problem

You can capture learnings, but not yet systematically aggregate them.

## Goal

Turn repeated feedback into prioritized system improvement.

## Deliverables

### 5.1 Feedback capture categories

Classify feedback into:

* skill weakness
* rule weakness
* routing issue
* unclear questioning
* bad assumptions
* verification gap
* optimization overreach

### 5.2 Repetition threshold

If the same pattern appears multiple times:

* generate candidate rule/skill/linter improvement

### 5.3 Feedback summary artifact

Keep a simple log/report of:

* repeated failure patterns
* candidate improvements
* promoted changes

## Definition of done

Repeated mistakes reliably turn into improvements.

---

# 6. Optional: lightweight execution memory

## Problem

The config system is strong, but there is little memory of what happened during runs.

## Goal

Store minimal execution history without building a full runtime framework.

## Deliverables

Examples:

* last changed skills
* most failing checks
* recently promoted learnings
* recent risky merges/compressions

This can be:

* JSON file
* markdown log
* CI artifact history

## Definition of done

The system gains continuity without becoming overly stateful.

---

# 7. Optional: PR / review reporting

## Goal

Make CI findings easier to consume in pull requests.

## Deliverables

* markdown summary comment
* changed-file focused issues
* pass/warn/fail summary
* top 3 actions required

## Definition of done

Reviewers can understand quality impact quickly without opening raw artifacts.

---

# Suggested implementation order

## Phase 3A — Safety and visibility first

1. Refactor `optimize-skills`
2. Refactor `optimize-agents`
3. Add lint/quality summary artifact

## Phase 3B — Quality preservation

4. Add compression preservation checklist
5. Extend pair-check / compression comparison

## Phase 3C — Intelligence layer

6. Add quality score / review report
7. Add feedback aggregation summary

## Phase 3D — Nice-to-have polish

8. Add PR summary output
9. Add lightweight execution memory

---

# Success criteria

Phase 3 is complete when:

* optimize commands are safe
* quality trends are visible
* compression cannot silently weaken skills
* repeated feedback becomes structured improvement
* CI outputs are useful, not just pass/fail
* the package evolves safely with less manual detective work

---

# Final target state

After Phase 3, the package should be:

* stronger than a prompt collection
* safer than a loose config repo
* more observable than before
* harder to regress silently
* easier to maintain at scale

Target outcome:

> A governed, observable, self-improving agent configuration system
