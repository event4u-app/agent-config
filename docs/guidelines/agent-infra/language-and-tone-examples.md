# language-and-tone — examples and failure modes

> Reference companion to [`.agent-src/rules/language-and-tone.md`](../../.agent-src/rules/language-and-tone.md).
> Pulled out so the always-active rule stays under its character budget.
> Linked from the rule via the **Examples** section; agents do not load this file
> automatically, only when they want concrete demonstrations or are debugging a
> language-mirroring drift.

## Failure modes to watch for

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

## `.md` example labels — wrong vs correct

The agent translates option labels to the user's language **at runtime**.
The `.md` source files are the English blueprint — they define WHAT to say,
not in which language.

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

Same rule applies to: example prompts and questions, template placeholders,
ASCII art labels in formatted output blocks, table headers and content.

## Quoted user-input examples — same rule, with one labeled exception

Common drift pattern: a rule documents trigger phrases the agent should
recognize and writes them as quoted German examples inside English prose.
**Not allowed**, even when demonstrative.

**Wrong** (DE quote embedded in EN prose):

```md
Single-decision delegation ("für diesen Schritt entscheide du") →
handle that step autonomously.

A standing "arbeite selbstständig" never lifts the floor.
```

**Correct** — two ways:

1. **Translate to English.** Trigger recognition is semantic; the agent
   matches intent across languages regardless of the example.
   `("you decide for this step")` works as well as the German.
2. **Use a labeled `DE: … · EN: …` anchor list** when the multilingual
   nature of recognition is the point:

   ```md
   - DE: "arbeite selbstständig" · "frag nicht jedes Mal" · "tue es einfach"
   - EN: "work autonomously" · "don't ask" · "just do it"
   ```

The labeled-anchor block is the **only** allowed location for German prose
in an English `.md` file. Body text, example sentences, prompt templates,
agent-rendered strings, and failure modes must be English. Reference
established phrases abstractly later (e.g. "a standing autonomy directive")
and link back to the anchor block.
