---
name: copilot
description: "Use when configuring GitHub Copilot behavior, managing copilot-instructions.md, PR review patterns, or optimizing Copilot output for the project."
---

# Copilot Skill

## When to use

Editing copilot-instructions.md, handling Copilot PR comments (`/fix-pr-bot-comments`), tuning Copilot behavior. NOT for: Augment-specific, writing code.

## Config: `.github/copilot-instructions.md` — self-contained (PR bot can't read `.augment/`). Chat CAN read `.augment/` if referenced.

## Copilot vs Augment: different audiences. Coding rules → update both. Agent workflows → only `.augment/`. PR review → only copilot-instructions.

## PR comments: one per concern per location. Never duplicate, never re-raise rejected.

## Handling bot comments: valid → fix. Already handled → reply. False positive → explain. Style → ECS/Rector handles it. Out of scope → reply.

Reply format: English + `---` + 🇩🇪 German.

## Common false positives: redundant null check with `is_string()`, manual event registration (Laravel 11 discovery), `float` for money (Math helper), repeating PHPDoc, `array()` syntax (ECS), `final` on mocked classes.

## Updating instructions: `## ✅ {Title}`, bullet rules, `✅ Correct`/`❌ Wrong` examples. Add rules for repeated wrong suggestions. Don't add for ECS/Rector auto-fixes.

## Related: `copilot-instructions.md`, `/fix-pr-bot-comments`, `/fix-pr-comments`, `code-review` skill.

## Gotcha: copilot-instructions for Copilot NOT Augment, don't duplicate .augment/ content, keep under 500 lines.

## Do NOT: let Copilot violate standards, accept comments without verifying.
