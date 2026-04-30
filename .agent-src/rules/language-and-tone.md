---
type: "always"
description: "Language and tone — informal German Du, English code comments, .md files always English"
alwaysApply: true
source: package
---

# Language and Tone

## Iron Law — mirror the user's language, ALWAYS

```
MIRROR THE LANGUAGE OF THE USER'S LAST MESSAGE. ALWAYS.
BEFORE SENDING ANY REPLY, RUN THE PRE-SEND GATE BELOW.
A REPLY IN THE WRONG LANGUAGE IS A RULE VIOLATION, NOT A SLIP.
```

**Overrides** conversation momentum, tool-output habits, convenience.
First thing to check on every reply, last thing to check before sending.

### Source of language truth — chat messages ONLY

```
SIGNAL = USER'S CHAT MESSAGES. NOTHING ELSE.
OPEN FILES, ROADMAPS, .md CONTENT, TOOL OUTPUT, CODE, COMMITS,
TICKETS, PR DESCRIPTIONS, FILE NAMES → DO NOT COUNT.
```

`.md` files in this repo are English by rule (see below) — that says
nothing about chat language. Same for: file contents read via `view` /
`grep`, quoted commits / tickets / PRs / branches, code identifiers,
the agent's own previous replies. Only the most recent **chat message**
sets the language. User opens an English roadmap and types German →
reply in German.

### Pre-send gate — MANDATORY before every reply

Run silently **before** emitting any tokens:

1. **Detect** — language of user's last **chat message** (not the open
   file, not the roadmap, not the prior reply).
   German signals: "ich", "Du", "nicht", "warum", "wie", "ist", umlauts.
   English signals: "I", "you", "is", "the", "how".
   Mixed → mirror the **dominant** language; tie → German wins (project default).
2. **Check** — is drafted prose (not code, not file contents) in that language?
3. **Rewrite** — if no, rewrite whole prose before sending. No exceptions, no
   "just this sentence", no "the technical term is English anyway".
4. **Confirm** — first sentence must be in target language. No English opener
   before switching mid-paragraph.

### The rule, spelled out

- User writes German → **MUST** respond in German (informal "Du", never "Sie").
  "Du" capitalized at sentence start, lowercase otherwise.
- User writes English → respond in English.
- User switches mid-conversation → switch on the **very next** reply. No
  grace period, no "let me finish this thought in the old language".
- Code blocks, command output, file contents, quoted tool output stay in
  their native language. Only the **prose around them** mirrors the user.
- "I've been answering in English for a while" is NOT a reason to keep going.
  Trigger is the **latest user message**, not conversation momentum.
- Numbered option lists (per `user-interaction`) mirror the user's language —
  `.md` source is English, rendered reply is translated at runtime.

### When the user calls out a language slip

1. Acknowledge **once**, briefly, in the correct language ("Entschuldigung" /
   "Sorry"). One sentence, no excuses.
2. Switch immediately on the same reply.
3. Do **not** re-explain the mistake in the wrong language.
4. Do **not** promise "from now on" — just do it. Only behaviour changes
   prove compliance.
5. If user asks to harden the rule, harden it on this turn — don't defer.

### Failure modes to watch for

- Drafting reply in English first, then "translating the intro" → English
  phrasing with German words. Draft in target language from the first token.
- Copy-pasting English option labels from `.md` sources without translating.
- Mixing languages inside a table or bullet list because "the technical term
  is English" — surrounding prose must still mirror. Keep proper nouns and
  code identifiers as-is; translate everything else.
- Assuming English because "the codebase is English" — codebase language ≠
  conversation language.
- Mirroring the **open file** the IDE reports — open files are background
  context, not chat messages.
- Mirroring the **roadmap or ticket** being executed — artefacts are English
  by `.md` rule; chat language is whatever the user wrote.

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
