---
type: "auto"
tier: "2b"
description: "Generating markdown with code blocks — prevent broken nesting"
alwaysApply: false
source: package
triggers:
  - intent: "markdown with code blocks"
  - keyword: "triple backticks"
  - file_pattern: "*.md"
workspaces:
  - agent-config-maintainer
packs:
  - meta
lifecycle: active
trust:
  level: core
  confidence: high
  human_review_required: false
install:
  default: true
  removable: false
---

# Markdown Safe Codeblocks

When generating markdown that contains code blocks:

- **NEVER** nest triple backticks inside triple backticks — breaks rendering and copy/paste.
- Content to be wrapped contains ``` blocks → **use `~~~` as the outer fence. This is the default.** Inner ``` renders correctly inside `~~~`.
- Four-backtick outer fences render inconsistently across clients — **do not use**.
- 4-space indented blocks: acceptable fallback only when plain text without language highlighting is enough.
- Prefer stability over pretty formatting.
- Always validate before sending: no broken rendering, no prematurely closed blocks, entire content selectable and copyable.
