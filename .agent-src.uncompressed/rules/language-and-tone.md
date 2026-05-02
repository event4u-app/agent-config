---
type: "always"
description: "Language and tone — informal German Du, English code comments, .md files always English"
alwaysApply: true
source: package
---

# Language and Tone

## Iron Law — mirror the user's language, ALWAYS

```
MIRROR THE LANGUAGE OF THE USER'S LAST/CURRENT MESSAGE. ALWAYS.
THE FIRST TOKEN OF EVERY REPLY MUST BE IN THAT LANGUAGE.
A REPLY IN THE WRONG LANGUAGE IS A RULE VIOLATION, NOT A SLIP.
NO MOMENTUM EXCEPTION. NO TECHNICAL-CONTEXT EXCEPTION.
NO "SWITCH MID-PARAGRAPH". NO "LAST 20 TURNS WERE ENGLISH".
```

**Overrides** conversation momentum, tool-output habits, prior-reply
language, codebase language, open-file language, files-just-edited
language, convenience. First thing to check on every reply, last thing
to check before sending.

Canonical failure: agent edited English `.md` for many turns; user
types short German (`3`, `weiter`, `mach das`, `und jetzt X`); agent
answers English because momentum wins. **Trigger is the user's last
message, not the turn count.** Length irrelevant — `3` after a German
question still means German continues.

### Source of language truth — chat messages ONLY

```
THE LANGUAGE SIGNAL IS THE USER'S CHAT MESSAGES. NOTHING ELSE.
OPEN FILES, ROADMAPS, .md CONTENT, TOOL OUTPUT, CODE, COMMIT MESSAGES,
TICKETS, PR DESCRIPTIONS, FILE NAMES — NONE OF THEM COUNT.
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
   German signals: "ich", "Du", "nicht", "warum", "wie", "ist", umlauts. <!-- md-language-check: ignore -->
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

### Failure modes

See [`docs/guidelines/language-and-tone-examples.md`](../../docs/guidelines/language-and-tone-examples.md)
for the full failure-mode list (drafting in EN then translating, copy-pasting
EN labels, codebase ≠ conversation, mirroring the open file or roadmap).

## Other language rules

- All code comments must be in English.
- All `.md` documentation files must be in English (see section below). If
  an existing file is in German, translate it when you touch it.
- Use two spaces after icons like ❌, ✅, ⚠️ in CLI output. One space is not enough. For other icons, one space is fine.
- Avoid double and triple blank lines in code and output — one blank line is enough.
- Every file MUST end with exactly one newline — no trailing blank lines.

## `.md` files are ALWAYS English — no exceptions

**Every** piece of text inside `.md` files in `.augment/` and `agents/`
must be in English: headings, paragraphs, bullets, example option labels,
example prompts/questions, template placeholders, ASCII-art labels in
formatted output blocks, table headers and content.

The agent translates to the user's language **at runtime** when
presenting options. The `.md` source files are the English blueprint —
they define WHAT to say, not in which language. Concrete wrong-vs-correct
examples live in [`docs/guidelines/language-and-tone-examples.md`](../../docs/guidelines/language-and-tone-examples.md).

### Quoted user-input examples — labeled-anchor exception

Drift pattern: a rule writes quoted German examples inside English prose.
**Not allowed**. Two correct ways:

1. **Translate to English.** Trigger recognition is semantic; the agent
   matches intent across languages regardless of the example.
2. **Use a labeled `DE: … · EN: …` anchor list** when the multilingual
   nature of recognition is the point — the **only** allowed location
   for German prose in an English `.md`. Reference established phrases
   abstractly later and link back to the anchor block.

Wrong-vs-correct snippets in
[`docs/guidelines/language-and-tone-examples.md`](../../docs/guidelines/language-and-tone-examples.md).

### Detection heuristic

Before saving an `.md` file under `.augment/`, `.agent-src/`,
`.agent-src.uncompressed/`, or `agents/`, scan for:

- Umlauts (`ä`, `ö`, `ü`, `Ä`, `Ö`, `Ü`, `ß`) outside fenced code,
  file paths, and the labeled anchor block.
- German function words in unquoted prose: `für`, `nicht`, `dass`,
  `wenn`, `sollte`, `werden`, `arbeite`, `selbstständig`, `jetzt`,
  `einfach`, `weiter`, `lösche`, `frag`, `schreib`, `mach`.
- Non-English quoted phrases in body text (paragraphs, list items,
  table cells) when the surrounding prose is English.

Hit → translate the fragment or move it into a `DE: … · EN: …` block.
