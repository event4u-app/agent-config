---
type: "auto"
alwaysApply: false
description: "When merging, refactoring, compressing, or restructuring skills, rules, commands, or guidelines — prevent quality loss"
source: package
---

# Preservation Guard

Transformations (merge, refactor, compress, split) must produce output **at least as strong** as input.

## Iron Laws — every passage stays, caveman is fine

Sections marked **Iron Law** (heading matches `# Iron Law`, `# Iron Laws`,
`# The Iron Law`, any level, numbered like `Iron Law 1`, `Iron Law 2`)
are **non-negotiable**, strictest preservation:

- [ ] **Heading verbatim** — exact text, exact level. Drop heading → law gone, even if code block survives.
- [ ] **Fenced code blocks byte-for-byte** — the law itself.
- [ ] **Negation clauses kept** — `NO X`, `NEVER Y`, `NOT Z` stay. Load-bearing exception denials, not filler.
- [ ] **Every passage stays** — every paragraph, every list item, every fenced code block from source survives in compressed output, in order. One paragraph → one paragraph; one bullet → one bullet. Dropping whole sentences, merging two paragraphs, skipping a list item is forbidden, even if surviving prose still "makes the point".
- [ ] **No Iron Law downgrades** — `## Iron Law` MUST NOT become `### Iron Law`, `**Iron Law:**`, or inline prose. Heading level is part of prominence.

**Caveman style encouraged for Iron Law bodies** — drop articles ("the", "a"), shorten phrasing, primitive grammar, terse cave-speak. Word count not a budget; structural unit count is. Every paragraph, bullet, code block from source present → compress as hard as you want. Forbidden is **deletion**: rationale paragraph stays, canonical-failure example stays, every "NEVER X" bullet stays.

`scripts/check_compression.py` enforces mechanically — any violation is `error`, not warning.

## Checklist — verify before completing

- [ ] **Iron Law sections** preserved per rules above — heading, body, fenced blocks, rationale
- [ ] Strongest validation step preserved
- [ ] Strongest example preserved
- [ ] Strongest anti-pattern / "Do NOT" preserved
- [ ] Essential decision hints (if/when/unless) preserved
- [ ] Required sections preserved
- [ ] Single clear responsibility preserved
- [ ] Strong language ("MUST"/"NEVER") not weakened

## Reject if

- Iron Law heading removed or downgraded
- Paragraph, list item, or fenced code block dropped from Iron Law section
- Negation clauses or canonical-failure prose stripped from Iron Law
- Validation, example, or anti-pattern removed without replacement
- Decision logic weakened
- Scope broadened by merging unrelated concerns
- Strong language downgraded

→ Skills: `skill-management`, `skill-reviewer` · Command: `/compress` · Linter: `check_compression_quality()`
