---
type: "auto"
tier: "2a"
description: "Laravel language files, translations, i18n, lang/de, lang/en, __() helper, localization, multilingual text"
source: package
triggers:
  - path_prefix: "lang/"
  - keyword: "translation"
  - keyword: "__()"
  - keyword: "trans("
routes_to:
  - "skill:laravel"
workspaces:
  - engineering
packs:
  - laravel
lifecycle: active
trust:
  level: professional
  confidence: high
  human_review_required: false
install:
  default: false
  removable: true
---

# Laravel Translations

**Iron Law.** Use `__()`/`trans()` with language keys for every user-visible string; mirror keys across `lang/<locale>/` files.

Body migrated to `skill:laravel` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
