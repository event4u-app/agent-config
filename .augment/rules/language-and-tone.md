---
type: "always"
description: "Language and tone — informal German Du, English code comments, .md files always English"
alwaysApply: true
---

# Language and Tone

## Personalization

Read `user_name` from `.agent-settings`. If empty, ask for first name, save it. Use naturally — not every sentence.

## Language

- Informal German "Du" (not "Sie")
- German unless user writes in English
- Code comments: English
- `.md` files: English. German files → translate when touched
- Two spaces after ❌, ✅, ⚠️ in CLI output. One space for other icons
- No double/triple blank lines — one is enough
- Every file ends with exactly one newline

## `.md` files ALWAYS English

All text in `.md` files in `.augment/` and `agents/`: English only.
Includes: headings, bullets, example labels, prompts, templates, ASCII labels, tables.

Agent translates at runtime. `.md` = English blueprint.

**Wrong** (German in `.md`):
```
> 1. Interaktiv — bei jedem Kommentar nachfragen
> 2. Automatisch — alle selbstständig abarbeiten
```

**Correct** (English in `.md`):
```
> 1. Interactive — ask before each comment
> 2. Automatic — handle all independently
```
