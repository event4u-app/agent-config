---
type: "always"
tier: "3"
description: "Language and tone — informal German Du, English code comments, .md files always English"
alwaysApply: true
source: package
---

# Language and Tone

## Iron Law — mirror the user's language, ALWAYS

```
MIRROR THE LANGUAGE OF THE USER'S LAST/CURRENT MESSAGE. ALWAYS.
THE FIRST TOKEN OF EVERY REPLY MUST BE IN THAT LANGUAGE.
EVERY USER-VISIBLE TOKEN MUST BE IN THAT LANGUAGE — NO EXCEPTIONS.
A REPLY IN THE WRONG LANGUAGE IS A RULE VIOLATION, NOT A SLIP.
NO MOMENTUM EXCEPTION. NO TECHNICAL-CONTEXT EXCEPTION.
NO "SWITCH MID-PARAGRAPH". NO "LAST 20 TURNS WERE ENGLISH".
NO "INTER-TOOL COMMENT IS JUST A NOTE" EXCEPTION.
```

Trigger is the user's last **chat message** — not turn count, open
file, roadmap, ticket, codebase, `view` / `grep` output, prior reply,
or files just edited. Short German (`3`, `weiter`, `mach das`) after
many English turns flips the reply to German.

### What counts as "user-visible prose" — exhaustive

The Iron Law applies to **every** token the user sees in the reply,
not just the main answer. All of these MUST mirror the user's
language:

- The opening line and the closing line.
- **Inter-tool commentary** between function calls — `"Found it"`,
  `"Let me check X"`, `"Now running Y"`, `"Confirmed"`, `"OK"`,
  `"Alright"`, `"Here's"`, `"So"`, `"Got it"`. These are prose, not
  internal notes — the user reads them.
- Section headings (`##`, `###`), table headers and table cell text,
  bullet text, blockquote text, status lines.
- The recommendation line under a numbered-options block (per
  [`user-interaction`](user-interaction.md) Iron Law 1) — including
  the literal label: `Recommendation:` (English) vs `Empfehlung:`
  (German). Wrong label = violation.
- Error explanations, "what this means" summaries, status tables.

Stays in source language: code blocks, command output, file
contents, quoted tool output, frontmatter keys, file paths,
identifier names, log lines.

### Pre-send gate — MANDATORY before every reply

Run silently before any output:

1. **Detect** — language of the user's last chat message. Mixed →
   **dominant** language; tie → German (project default).
2. **Scan** — every user-visible token per the catalog above. Inter-
   tool commentary, headings, table headers, bullet text, the
   `Recommendation:` / `Empfehlung:` label — all included.
3. **Rewrite** — if any token is in the wrong language, rewrite
   the whole reply. No "just this sentence", no "technical term is
   English anyway", no "the inter-tool note doesn't matter".
4. **Confirm** — first sentence in target language; recommendation
   label matches target language; no English filler-phrase opener
   (`Let me`, `Now`, `Found`, `Confirmed`, `OK`, `Alright`,
   `Here's`, `So`) when target is German, no German opener
   (`Lass mich`, `Jetzt`, `Gefunden`, `Bestätigt`) when target is
   English.

### Spelled out

- German → respond in German, informal "Du" (never "Sie"). "Du"
  capitalized at sentence start, lowercase otherwise.
- Code blocks, command output, file contents, and quoted tool output
  stay in their native language; only the **prose around them**
  mirrors the user.
- Numbered options (per `user-interaction`) — `.md` source English,
  rendered reply translated at runtime.

### Slip handling

Acknowledge **once**, briefly, in the correct language
("Entschuldigung" / "Sorry"). Switch on the same reply. Do **not**
re-explain in the wrong language; do **not** promise "from now on" —
just do it.

Full failure-mode list and wrong-vs-correct examples in
[`../../docs/guidelines/agent-infra/language-and-tone-examples.md`](../../docs/guidelines/agent-infra/language-and-tone-examples.md).

## Other language rules

- Code comments in English.
- `.md` documentation files in English (see section below).
  Translate existing German `.md` files when you touch them.
- Two spaces after icons `❌`, `✅`, `⚠️` in CLI output; one space
  for other icons.
- One blank line max; no double or triple blank lines.
- Every file ends with exactly one newline.

## `.md` files are ALWAYS English — no exceptions

**Every** piece of text inside `.md` files in `.augment/`,
`.agent-src/`, `.agent-src.uncompressed/`, and `agents/` must be in
English: headings, paragraphs, bullets, option labels, example
prompts, template placeholders, ASCII-art labels, table headers and
content. The agent translates to the user's language **at runtime**.

### Labeled-anchor exception

Quoting German examples inside English prose is **not allowed**.
Two correct ways:

1. **Translate to English** — trigger recognition is semantic.
2. **Use a labeled `DE: … · EN: …` anchor list** when the
   multilingual nature of recognition is the point. This is the
   **only** allowed location for German prose in an English `.md`;
   reference phrases abstractly elsewhere and link to the anchor.

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

Hit → translate it or move it into a `DE: … · EN: …` block.
