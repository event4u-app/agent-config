---
type: "always"
tier: "3"
description: "Language and tone — informal German Du, English code comments, .md files always English"
alwaysApply: true
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule scopes the .md-English mandate to the authoring tree."
workspaces:
  - agent-config-maintainer
packs:
  - meta
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

Trigger = user's last **chat message**. Not turn count, open file, roadmap, ticket, codebase, tool output, prior reply, or files just edited. Short German (`3`, `weiter`, `mach das`) after many English turns flips the reply to German.

## User-visible prose — every token mirrors

Applies to opening / closing line, **inter-tool commentary** (`Found it`, `Let me check`, `OK`, `Alright`, `Here's`, `So`), section headings, table headers and cells, bullet text, blockquote text, status lines, and the `Recommendation:` / `Empfehlung:` label under numbered-options blocks (per [`user-interaction`](user-interaction.md) Iron Law 1). Wrong label = violation.

Stays in source language: code blocks, command output, file contents, quoted tool output, frontmatter keys, file paths, identifier names, log lines.

## Pre-send gate — MANDATORY

1. **Detect** — language of user's last chat message. Mixed → dominant; tie → German.
2. **Scan** — every user-visible token per catalog above.
3. **Rewrite** — wrong-language token → rewrite the whole reply.
4. **Confirm** — first sentence in target language; recommendation label matches; no wrong-language filler-phrase opener. Blocklist: [`language-and-tone-examples § Pre-send gate`](../../docs/guidelines/agent-infra/language-and-tone-examples.md#pre-send-gate--filler-phrase-blocklist).

## Spelled out

- German → informal "Du" (never "Sie"); capitalized at sentence start, lowercase otherwise.
- Code blocks / command output / file contents / quoted tool output stay native; only surrounding prose mirrors.
- Numbered options — `.md` source English; rendered reply translated at runtime.
- Code comments in English. `.md` files in English (see below). Translate existing German `.md` files when touched.

## Slip handling

Acknowledge **once** in the correct language ("Entschuldigung" / "Sorry"). Switch on the same reply. No re-explain in wrong language; no "from now on" promise.

Examples + CLI spacing rules + wrong-vs-correct: [`language-and-tone-examples`](../../docs/guidelines/agent-infra/language-and-tone-examples.md).

## `.md` files — ALWAYS English

All `.md` text under `src/`, `docs/`, `.augment/`, `.agent-src/`, `.agent-src.uncondensed/`, `agents/` — prose AND examples, **including generated output** (fix the generator's source strings, never hand-edit the generated page). Agent translates at runtime.

Genuinely-required German uses a sanctioned escape only: a labeled `DE: … · EN: …` anchor (German *prose*), or a per-line `<!-- md-language-check: ignore -->` marker (one quoted trigger example / verbatim provenance quote — never scattered through a generated file).

Generated-output rule, escape mechanics, pre-save detection heuristic: [`language-and-tone-examples`](../../docs/guidelines/agent-infra/language-and-tone-examples.md#md-files--pre-save-detection-heuristic).
