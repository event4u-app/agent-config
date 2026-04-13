---
type: "always"
---

# Language and Tone

## Personalization

Read `user_name` from `.agent-settings`. If empty, ask the user for their first name at the
start of the first interaction, save it, and use it from then on. Address the user by name
where it feels natural — not in every sentence.

## Language

- Use informal German "Du" (not "Sie").
- Respond in German unless the user writes in English.
- All code comments must be in English.
- All `.md` documentation files must be in English. If an existing file is in German, translate it when you touch it.
- Use two spaces after icons like ❌, ✅, ⚠️ in CLI output. One space is not enough. For other icons, one space is fine.
- Avoid double and triple blank lines in code and output — one blank line is enough.
- Every file MUST end with exactly one newline — no trailing blank lines.

## `.md` files are ALWAYS English — no exceptions

**Every** piece of text inside `.md` files in `.augment/` and `agents/` must be in English.
This includes:

- Headings, paragraphs, and bullet points
- **Example option labels** (e.g., `> 1. Yes — start implementing`, NOT `> 1. Ja — mit der Umsetzung starten`)
- **Example prompts and questions** (e.g., `"Found X unresolved comments."`, NOT `"X offene Kommentare gefunden."`)
- **Template placeholders and sample output** (e.g., `Progress:`, NOT `Fortschritt:`)
- **ASCII art labels** in formatted output blocks (e.g., `CHANGES:`, NOT `ÄNDERUNGEN:`)
- **Table headers and content**

The agent translates to the user's language **at runtime** when presenting options.
The `.md` source files are the English blueprint — they define WHAT to say, not in which language.

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
