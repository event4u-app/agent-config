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

Trigger is the user's last chat message, not turn count or message
length — short German (`3`, `weiter`, `mach das`) after many English
turns still flips the reply to German.

### Source of language truth — chat messages ONLY

Only the most recent **chat message** sets the language. `.md` files,
file contents read via `view` / `grep`, quoted commits / tickets / PRs,
code identifiers, and the agent's own previous replies do **not** count.
User opens an English roadmap and types German → reply in German.

### Pre-send gate — MANDATORY before every reply

Run silently **before** emitting any tokens:

1. **Detect** — language of user's last **chat message** (not the open
   file, not the roadmap, not the prior reply). Mixed → mirror the
   **dominant** language; tie → German wins (project default).
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

Acknowledge **once**, briefly, in the correct language ("Entschuldigung" /
"Sorry"). Switch immediately on the same reply. Do **not** re-explain in
the wrong language. Do **not** promise "from now on" — just do it. If
user asks to harden the rule, harden it on this turn.

### Failure modes

See [`../../docs/guidelines/language-and-tone-examples.md`](../../docs/guidelines/language-and-tone-examples.md)
for the full failure-mode list.

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
examples live in [`../../docs/guidelines/language-and-tone-examples.md`](../../docs/guidelines/language-and-tone-examples.md).

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
[`../../docs/guidelines/language-and-tone-examples.md`](../../docs/guidelines/language-and-tone-examples.md).

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
