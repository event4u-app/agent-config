---
trigger: model_decision
description: Laravel language files, translations, i18n, lang/de, lang/en, __() helper, localization, multilingual text
globs: 
---

# Laravel Translations

**Iron Law.** Use `__()`/`trans()` with language keys for every user-visible string; mirror keys across `lang/<locale>/` files.

Body migrated to `skill:laravel` (per P4 of `road-to-kernel-and-router.md`).
Trigger-set above activates this routing under the `balanced` and `full` profiles.
