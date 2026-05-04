---
type: "auto"
tier: "2b"
description: "Generating markdown output that contains code blocks — prevent broken nesting"
alwaysApply: false
source: package
---

# Markdown Safe Codeblocks

When generating markdown with code blocks:

- **NEVER** nest triple backticks inside triple backticks — this breaks rendering and copy/paste.
- If content already contains triple backticks, use one of:
  - Plain text blocks (indented by 4 spaces) — **preferred**
  - `~~~` fences instead of backtick fences
  - Four backticks (``````) as outer fence
- Prefer stability over pretty formatting.
- Always validate: no broken rendering, no prematurely closed blocks, entire content is selectable and copyable.
