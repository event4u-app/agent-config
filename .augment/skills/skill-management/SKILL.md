---
name: skill-management
description: "Use when compressing, decompressing, refactoring, or improving existing skills. Covers the full skill lifecycle from verbose → sharp → maintained."
source: project
---

# skill-management

## When to use

Use this skill when:
* Compressing a verbose skill into a sharper version
* Expanding a compressed skill into a maintainable source-of-truth
* Refactoring a skill to fix structure, scope, or quality issues
* Migrating skills to new standards

Do not use when:
* Creating a new skill from scratch (use `skill-writing`)
* Reviewing/validating a skill (use `skill-reviewer`)

## Procedure: Manage a skill

### Mode: Compress
**Trigger:** "compress skill", "shorten skill", "make skill sharper"

1. Inspect — what is the core job? Which lines are redundant?
2. Preserve critical skeleton: When to use, Procedure, Output format, Gotchas, Do NOT
3. Compress trigger — rewrite description for fast matching
4. Compress decision logic — explanations → direct choices
5. Compress procedure — each step short and executable
6. Remove obvious content — keep only what model forgets or misuses
7. Validate — compressed version must be: easier to scan, easier to trigger, at least as safe

**Iron rule:** Compression must NOT weaken validation or remove decision hints that prevent mistakes.
**Linter gate:** After compression, run `python3 scripts/skill_linter.py` on the file — must be 0 FAIL.

### Mode: Decompress
**Trigger:** "expand skill", "decompress skill", "make skill clearer"

1. Inspect — which parts are unclear or too condensed?
2. Restore full structure (all required sections)
3. Expand trigger — make "When to use" clearer
4. Expand procedure — turn terse steps into clear actions
5. Strengthen validation — make checks explicit and testable
6. Add minimal explanations only where they improve execution
7. Validate — expanded version must be: clearer, still executable, not noisy

**Iron rule:** Expansion must NOT turn skills into documentation. Add context, not prose.
**Linter gate:** After expansion, run `python3 scripts/skill_linter.py` on the file — must be 0 FAIL.

### Mode: Refactor
**Trigger:** "refactor skill", "improve skill", "fix skill structure"

1. Inspect — identify missing sections, weak areas, anti-patterns
2. Clean structure — ensure required sections exist
3. Improve procedure — make steps concrete, add validation
4. Remove noise — delete obvious/redundant content, merge duplicate bullets
5. Refine scope — ensure single responsibility, split if multiple workflows
6. Compare before/after — must be clearer, at least as executable, not broader

**Linter gate:** After refactoring, run `python3 scripts/skill_linter.py` on the file — must be 0 FAIL.

**Independence check:** After refactoring, verify the skill is still executable without opening any guideline.
If the refactor introduced guideline delegations ("see guideline X"), ensure the Procedure still works standalone.

**Decision hints:**
* Too long → compress or split
* Too generic → narrow scope
* Missing validation → add it
* Too dependent on guidelines → inline essential steps
* Multiple workflows → split into separate skills

## Common anti-patterns

* Same idea repeated in Goal, Core rules, and Gotchas
* Long paragraphs where one bullet would do
* Vague procedure steps ("think about X")
* Compression that deletes safety-critical checks
* Over-expansion that turns skills into documentation
* Refactoring scope instead of structure
* Removing gotchas because they "look verbose"

## Output format

1. Updated skill file(s) passing linter with 0 FAIL
2. Before/after line count comparison

## Gotchas

* Over-compression removes important nuance
* Some examples look verbose but are load-bearing
* Shorter is not better if trigger quality drops
* Changing intent instead of improving structure
* Compressed versions must be derived from uncompressed source, not the other way around
* **Validation steps are non-negotiable** — every Procedure must end with a concrete verify/confirm step. Skills without validation pass the linter today but cause failures when the linter is tightened.
* **Renaming headings to "Procedure:" without adding steps** creates false structure — the linter now requires ordered steps or sub-headings inside Procedure blocks.

## Do NOT

* Do NOT remove validation steps
* Do NOT compress away decision hints that prevent mistakes
* Do NOT change the skill's core intent
* Do NOT merge unrelated workflows to save space
* Do NOT expand everything blindly — only where it helps execution
* Do NOT rewrite without understanding original intent

## Auto-trigger keywords

* compress skill
* decompress skill
* refactor skill
* improve skill
* shorten skill
* expand skill
* caveman compress
* make skill sharper
