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
- Uncompressed skills (`.augment.uncompressed/skills/`)
- Compressed skills (`.augment/skills/`)
- Rules (`.augment.uncompressed/rules/`, `.augment/rules/`)
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
    skill-linter lint --pair .augment.uncompressed/skills/x/SKILL.md .augment/skills/x/SKILL.md

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

    [FAIL] .augment.uncompressed/skills/example/SKILL.md
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