---
type: "always"
tier: "3"
description: "Language and tone — informal German Du, English code comments, .md files always English"
alwaysApply: true
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncondensed/"
    reason: "Rule scopes the .md-English mandate to the authoring tree."
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
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

Trigger = user's last **chat message** — never turn count, open file, roadmap, ticket, codebase, tool output, prior reply, or just-edited files. Short German (`3`, `weiter`, `mach das`) after many English turns → reply in German.

## User-visible prose — every token mirrors

Mirrors: opening/closing line, **inter-tool commentary** (`Found it`, `Let me check`, `OK`, `Alright`, `Here's`, `So`), headings, table headers + cells, bullets, blockquotes, status lines, the `Recommendation:` / `Empfehlung:` label under numbered-options blocks ([`user-interaction`](user-interaction.md) Iron Law 1). Wrong label = violation.

Stays source-language: code blocks, command output, file contents, quoted tool output, frontmatter keys, file paths, identifiers, log lines.

## Pre-send gate — MANDATORY

1. **Detect** — language of last chat message. Mixed → dominant; tie → German.
2. **Scan** — every user-visible token per catalog.
3. **Rewrite** — one wrong-language token → rewrite whole reply.
4. **Confirm** — first sentence in target language; recommendation label matches; no wrong-language filler opener. Blocklist: [`language-and-tone-examples`](../docs/guidelines/agent-infra/language-and-tone-examples.md).

## Spelled out

- German → informal "Du" (never "Sie"); capitalized at sentence start, lowercase otherwise.
- Code blocks / command output / file contents / quoted tool output stay native; surrounding prose mirrors.
- Numbered options — `.md` source English; rendered reply translated at runtime.
- Code comments English. `.md` files English (below). Translate existing German `.md` files when touched.

## Slip handling

Acknowledge **once**, correct language ("Entschuldigung" / "Sorry"), switch in the same reply. No wrong-language re-explain; no "from now on" promise.

Examples + CLI spacing rules + wrong-vs-correct: [`language-and-tone-examples`](../docs/guidelines/agent-infra/language-and-tone-examples.md).

## `.md` files — ALWAYS English

All `.md` text under `src/`, `docs/`, `.augment/`, `dist/agent-src/`, `.agent-src.uncondensed/`, `agents/` — prose AND examples, **including generated output** (fix the generator's source strings, never hand-edit the generated page). Agent translates at runtime.

Genuinely-required German → one of the two sanctioned escapes (labeled `DE: … · EN: …` anchor, or per-line `<!-- md-language-check: ignore -->` marker) — canonical mechanics in the guideline below.

Generated-output rule, escape mechanics, pre-save detection heuristic: [`language-and-tone-examples`](../docs/guidelines/agent-infra/language-and-tone-examples.md).
