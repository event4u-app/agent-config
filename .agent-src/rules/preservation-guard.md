---
type: "auto"
alwaysApply: false
description: "When merging, refactoring, compressing, or restructuring skills, rules, commands, or guidelines — prevent quality loss"
source: package
---

# Preservation Guard

Transformations (merge, refactor, compress, split) must produce output **at least as strong** as input.

## Checklist — verify before completing

- [ ] Strongest validation step preserved
- [ ] Strongest example preserved
- [ ] Strongest anti-pattern / "Do NOT" preserved
- [ ] Essential decision hints (if/when/unless) preserved
- [ ] Required sections preserved
- [ ] Single clear responsibility preserved
- [ ] Strong language ("MUST"/"NEVER") not weakened

## Reject if

- Validation, example, or anti-pattern removed without replacement
- Decision logic weakened
- Scope broadened by merging unrelated concerns
- Strong language downgraded

→ Skills: `skill-management`, `skill-reviewer` · Command: `/compress` · Linter: `check_compression_quality()`
