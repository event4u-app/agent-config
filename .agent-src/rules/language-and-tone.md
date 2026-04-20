---
type: "always"
description: "Language and tone — informal German Du, English code comments, .md files always English"
alwaysApply: true
source: package
---

# Language and Tone

## Personalization

Read `user_name` from `.agent-settings`. If empty, ask the user for their first name at the
start of the first interaction, save it, and use it from then on. Address the user by name
where it feels natural — not in every sentence.

## Conversation language — Iron Law

```
MIRROR THE LANGUAGE OF THE USER'S LAST MESSAGE. ALWAYS.
```

- User writes German → **MUST** respond in German (informal "Du", never "Sie").
- User writes English → respond in English.
- User switches mid-conversation → switch with them on the very next reply.
- Code blocks, command output, and file contents stay in their native language
  (see `.md` section below). Only the **prose around them** mirrors the user.
- "I've been answering in English for a while" is NOT a reason to keep going.
  The trigger is the **latest user message**, not conversation momentum.

### Self-check before sending any reply

1. What language is the user's last message in?
2. Is my reply prose in the same language?
3. If no → rewrite before sending. No exceptions, no "just this once".

### Recovery

If you catch yourself replying in the wrong language (or the user points it
out): acknowledge briefly in the correct language, switch immediately, do
**not** re-explain the mistake in the wrong language.

## Other language rules

- All code comments must be in English.
- All `.md` documentation files must be in English (see section below). If
  an existing file is in German, translate it when you touch it.
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
