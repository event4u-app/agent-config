# Skill Linter Script Design

> Planning document for the automated skill/rule linter. Implements the `skill-linter` skill as a CLI tool.
> Referenced by: `agents/roadmaps/archive/controlled-self-optimization.md` (Phase 2.2, archived)

## Purpose

Local and CI-friendly linter that validates skills and rules in the repository.

Goals:
- Fail early on broken or weak skills
- Detect structural issues
- Detect duplication risk
- Ensure compression safety
- Actionable output for manual review

## Scope

Lint targets:
- Uncompressed skills (`.agent-src.uncompressed/skills/`)
- Compressed skills (`.augment/skills/`)
- Rules (`.agent-src.uncompressed/rules/`, `.augment/rules/`)
- Optional: pair checks between uncompressed and compressed

Supported modes:
- Single file
- Changed files only
- Full repository

## Command Interface

    # Single file
    skill-linter lint path/to/SKILL.md

    # Full repo
    skill-linter lint --all

    # Changed files only
    skill-linter lint --changed

    # Compare source and compressed pair
    skill-linter lint --pair .agent-src.uncompressed/skills/x/SKILL.md .augment/skills/x/SKILL.md

    # JSON output for CI
    skill-linter lint --all --format json

    # Human-readable (default)
    skill-linter lint --changed --format text

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Pass |
| 1 | Warnings only (non-blocking by default) |
| 2 | Fail (errors found) |
| 3 | Internal script error |

CI default: warnings do not block unless `--strict` enabled.

## Checks

### A. File type detection
- Detect: skill / rule / unknown (via frontmatter + path conventions)
- Fail if unknown type in linted target path

### B. Required section checks (skills)
**Required (fail if missing):**
- When to use, Procedure, Output format, Gotchas, Do NOT

**Recommended (warn if missing):**
- Preconditions, Decision hints, Anti-patterns, Examples, Environment notes

### C. Rule quality checks
- Warn if: too long, procedural, excessive explanation
- Fail if: masquerading as skill without skill structure

### D. Trigger quality checks
- Description trigger-oriented, not generic, not overly broad
- Warn: description > 200 chars, no "Use when..." pattern
- Warn: "Laravel skill", "General coding helper"

### E. Procedure checks
- Warn: fewer than 3 steps, no inspect step, vague steps
- Fail: no validation step, purely descriptive
- Vague keywords: "do it", "check if it works", "handle stuff", "add logic"

### F. Validation quality checks
- Good: exact checks, expected outputs, concrete commands
- Bad: "verify it works", "check manually", no explicit criteria
- Fail if missing or purely vague

### G. Output format checks
- Must exist, contain 2+ ordered requirements, control verbosity
- Warn if generic or empty

### H. Gotchas / Do NOT checks
- Gotchas: 1+ realistic failure mode
- Do NOT: 1+ enforceable constraint
- Warn if generic or duplicated from other sections
- Fail if either missing

### I. Duplication checks
- Compare normalized name, keyword overlap, section headings
- Warn on high overlap with existing file
- Suggest: merge, update existing, or split scope

### J. Compression safety checks (pair mode)
- Compressed must preserve: trigger, validation, anti-failure, procedure skeleton
- Warn: examples removed but core preserved
- Fail: validation lost, trigger broadened, critical warnings dropped

## Severity Model

| Severity | Meaning | CI behavior |
|---|---|---|
| error | Merge-blocking | Always fails |
| warning | Quality concern | Fails only in `--strict` |
| info | Optional improvement | Never blocks |

## Output Examples

### Text output

    [FAIL] .agent-src.uncompressed/skills/example/SKILL.md
    - [error] Missing section: Output format
    - [error] Validation vague: "check if it works"
    - [warn] Overlap risk: markdown-safe-codeblocks

    Suggested fixes:
    - Add ordered output requirements
    - Replace vague validation with explicit checks
    - Consider merge or narrower scope

### JSON output

    {
      "status": "fail",
      "file": "...",
      "issues": [
        {"severity": "error", "code": "missing_section", "message": "..."},
        {"severity": "warning", "code": "duplication_risk", "message": "..."}
      ],
      "suggestions": ["..."]
    }


## File Structure

    scripts/
      skill_linter.py
    tests/
      test_skill_linter.py
      fixtures/
        valid_skill.md
        invalid_missing_output.md
        invalid_vague_validation.md
        valid_rule.md
        invalid_broad_skill.md
        compressed_pair_ok/
        compressed_pair_fail/
    config/
      skill_linter.yml          # optional

## Taskfile Commands

    task lint:skills              # lint all skills
    task lint:skills:changed      # lint changed only
    task lint:skills:strict       # strict mode (warnings = errors)
    task lint:skills:pairs        # check uncompressed/compressed pairs

## Implementation Phases

### Phase 1 (MVP)
- File type detection
- Required section checks
- Validation quality check
- Output format check
- Gotchas / Do NOT check
- Text output

### Phase 2
- Duplication heuristics
- Compression pair checks
- JSON output
- Changed-files mode

### Phase 3
- Configurable rules (YAML config)
- Severity overrides
- Ignore paths
- Better semantic duplicate detection

## Design Principles

- Fail on missing structure
- Warn on weak quality
- Keep heuristics simple first
- Optimize for actionable feedback
- Prefer false-positive warnings over false-negative passes

## Future Extensions

- Auto-fix simple issues
- Suggest nearest existing skill on duplication
- Scorecard per skill
- Repo quality report
- PR comment integration

## Warning Policy (current baseline)

As of the last cleanup pass, the full-repo run reports `135 pass, 92 warn,
0 fail, 227 total`. CI stays green on warnings — **warnings are advisory,
only `[FAIL]` breaks the build**. This section classifies what we tolerate
and what belongs in the backlog, so drive-by fixes stay focused.

### Tolerated — no action planned

These warnings fire heuristically on content that is intentionally shaped
differently from the target. Fixing them would make the artifact worse.

| Warning | Count | Why tolerated |
|---|---|---|
| `procedural_rule` | 13 | Some rules are inherently procedural (`verify-before-complete`, `context-hygiene`, `downstream-changes`). Converting them to skills would hide always-on guardrails behind a trigger description. |
| `long_rule` (42–101 lines) | 18 | The largest rules are meta-rules that govern whole workflows (`language-and-tone`, `token-efficiency`, `think-before-action`). They are policy documents, not recipes. |
| `short_procedure` | 10 | Small commands (e.g. `agent-status`) and narrow skills do not need ≥3 ordered steps to be useful. |
| `skill_too_large` (4 skills) | 4 | Flagged skills (`laravel`, `agent-docs-writing`, …) are reference compendia that consumers expect to read end-to-end. |

### Backlog — fix opportunistically

These are real gaps that should be closed the next time the affected
artifact is touched for another reason. Do not open dedicated PRs.

| Warning | Count | Fix |
|---|---|---|
| `missing_inspect_step` | 42 | Add an explicit inspect/check step to the procedure (usually `Read relevant file` or `Run grep/rg` before editing). |
| `large_command` (6 commands) | 6 | Commands over ~1000 words (`agents-audit`, `compress`, `copilot-agents-optimize`, `optimize-augmentignore`, `project-analyze`, `rule-compliance-audit`). Split into sub-commands or move deep detail into a linked context doc. |
| `weak_output_format` | 6 | Output format section needs ≥2 ordered requirements. |
| `missing_efficient_tooling_guidance` | 5 | Mention targeted filters (jq, rg, grep) in CLI-heavy artifacts. |
| `missing_anti_bruteforce_guidance` | 4 | Add "max N retries, then stop and ask" language to execution guidance. |
| `no_steps` (3 commands) | 3 | Command needs a Steps section or numbered sub-headings. `feature-dev` also has `missing_description`. |
| `missing_verification_tool_mapping` | 3 | Name concrete verification tools (curl, Playwright, Xdebug) instead of generic "test it". |
| `missing_clarification_guard` | 3 | Add an ask-when-uncertain hook to implementation guidance. |
| `command_missing_skill_references` | 3 | Command should orchestrate skills instead of embedding domain logic. |
| `missing_backend_verification_example` | 3 | Backend skills should mention curl / Postman / http::fake. |
| `missing_frontend_verification_example` | 2 | Frontend skills should mention Playwright / browser / screenshot. |
| `missing_validation_step` | 2 | Assisted skills need a validation/challenge step. |
| `missing_runtime_debug_guidance` | 2 | Debug skills should mention Xdebug / breakpoints. |
| `question_strategy_missing` | 1 | Distinguish grouped vs sequential questions. |
| `missing_cli_verification_example` | 1 | CLI skills should mention exit-code / command-output checks. |
| `handoff_order_missing` | 1 | Handoff guidance should ask handoff questions last. |
| `missing_description` | 1 | `feature-dev` needs frontmatter description. |

### Review cadence

Re-run `task lint-skills` at the end of every multi-skill cleanup batch.
If a category drops to zero, move it out of the table. If a new category
appears with ≥3 hits, add it here with a short rationale.