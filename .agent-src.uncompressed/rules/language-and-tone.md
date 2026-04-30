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

This rule **overrides** conversation momentum, tool-output habits, and
convenience. It is the first thing to check on every reply and the last
thing to check before sending.

### Source of language truth — chat messages ONLY

```
THE LANGUAGE SIGNAL IS THE USER'S CHAT MESSAGES. NOTHING ELSE.
OPEN FILES, ROADMAPS, .md CONTENT, TOOL OUTPUT, CODE, COMMIT MESSAGES,
TICKETS, PR DESCRIPTIONS, FILE NAMES — NONE OF THEM COUNT.
```

The IDE may report an open file (`README.md`, a roadmap, a SKILL.md).
That is **background context**, not a language signal. The roadmap is
in English because all `.md` files in this repo are in English by rule
(see "`.md` files are ALWAYS English" below) — that says nothing about
what language the user wants in chat.

Same applies to:

- File contents the agent reads via `view` / `grep` / tool output
- Quoted commit messages, tickets, PR descriptions, branch names
- Code identifiers, function names, variable names
- The agent's own previous replies (conversation momentum is not a signal)

The **only** signal is what the user typed in their most recent chat
message. If that is German → reply in German, even when every file in
context is English. If that is English → reply in English, even when
the user opened a German document.

### Pre-send gate — MANDATORY before every reply

Run this silently **before** emitting any tokens:

1. **Detect** — What language is the user's **last chat message** in?
   (Not the open file, not the roadmap, not the prior reply — only the
   chat message.) German signals: "ich", "Du", "nicht", "warum", "wie",
   "ist", umlauts, sentence structure. English signals: "I", "you",
   "is", "the", "how". Mixed message → mirror the **dominant** language;
   if tie → German wins (project default for this user).
2. **Check** — Is my drafted prose (not code, not file contents) in that
   same language?
3. **Rewrite** — If no, rewrite the whole prose before sending. No
   exceptions, no "just this sentence", no "the technical term is English
   anyway".
4. **Confirm** — First sentence of the reply must be in the target
   language. No English opener before switching mid-paragraph.

### The rule, spelled out

- User writes German → **MUST** respond in German (informal "Du", never
  "Sie"). "Du" is capitalized at sentence start, lowercase otherwise.
- User writes English → respond in English.
- User switches mid-conversation → switch with them on the **very next**
  reply. No grace period, no "let me finish this thought in the old
  language".
- Code blocks, command output, file contents, and quoted tool output
  stay in their native language (see `.md` section below). Only the
  **prose around them** mirrors the user.
- "I've been answering in English for a while" is NOT a reason to keep
  going. The trigger is the **latest user message**, not conversation
  momentum.
- Numbered option lists presented to the user (per `user-interaction`)
  mirror the user's language too — the `.md` source is English, the
  rendered reply is translated at runtime.

### When the user calls out a language slip

1. Acknowledge **once**, briefly, in the correct language ("Entschuldigung"
   / "Sorry"). One sentence, no excuses.
2. Switch immediately on the same reply.
3. Do **not** re-explain the mistake in the wrong language.
4. Do **not** promise "from now on" — just do it. The rule was already
   clear; only behaviour changes prove compliance.
5. If the user asks to harden the rule, harden it on this turn — don't
   defer to "later".

### Failure modes to watch for

- Drafting the reply in English first, then "translating the intro" —
  results in English phrasing with German words. Draft in the target
  language from the first token.
- Copy-pasting English option labels from `.md` sources without
  translating them for the user.
- Mixing languages inside a table or bullet list because "the technical
  term is English" — the **surrounding prose** must still mirror. Keep
  proper nouns and code identifiers as-is; translate everything else.
- Assuming the user wants English because "the codebase is English" —
  codebase language ≠ conversation language.
- Mirroring the language of the **open file** the IDE reports — open
  files are background context, not chat messages. User opens an
  English roadmap and types a German message → reply in German.
- Mirroring the language of the **roadmap or ticket** being executed —
  the artefact is in English by `.md` rule; the chat is whatever the
  user wrote.

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
