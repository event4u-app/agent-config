---
type: "auto"
tier: "3"
description: "Writing/reviewing PHP — strict types, naming, comparisons, early returns, Eloquent conventions"
source: package
triggers:
  - file_pattern: "*.php"
  - keyword: "phpstan"
  - keyword: "ecs"
routes_to:
  - "guideline:php/php-coding-patterns"
workspaces:
  - engineering
packs:
  - php
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---

# Php Coding

**Iron Law.** PHP: strict types, named comparisons, early returns, Eloquent conventions — full pattern library in the guideline.

Body migrated to `guideline:php/php-coding-patterns` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
