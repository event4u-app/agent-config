---
name: doc-coauthoring
description: "Use when co-authoring a PRD, design doc, RFC, decision doc, or technical spec — 3-stage flow (context → section-by-section → reader-test) — even if the user just says 'help me write this spec'."
source: package
domain: process
---

# doc-coauthoring

## When to use

Use this skill when:

* User starts a substantial writing task — PRD, RFC, design doc, decision doc, technical spec, proposal
* User says "help me write this up", "draft a proposal", "we need a doc for X"
* The output is a structured prose document the user will own and ship

Do NOT use when:

* Authoring agent docs / module docs / AGENTS.md → `agent-docs-writing`
* Writing a README → `readme-writing` / `readme-writing-package`
* Writing an ADR (process is fixed, no co-authoring loop) → `adr-create`
* Code documentation, inline comments, docstrings

## Goal

Move from a fuzzy ask to a complete document the user owns, by:

1. Closing the context gap before drafting
2. Building each section through brainstorm → curate → draft → refine
3. Testing the draft with a fresh-context reader before declaring done

## Preconditions

* User explicitly wants a document (not a quick answer)
* `save-file` and `str-replace-editor` available
* Target path and filename agreed up front

## Procedure

### 0. Inspect existing material

Before any drafting, **inspect** the landscape: search `agents/` and
the repo for related prior docs (`grep -ril "{topic}" agents/ docs/`),
check the user's named ticket / thread for context, and confirm no
in-flight document already covers the ask. If a near-duplicate exists,
surface it and ask whether to extend or supersede.

### 1. Context gathering

Close the gap between what the user knows and what you know.

1. **Meta-questions** — one numbered-options block (per `user-interaction`): doc type? primary audience? desired impact? template/format constraint? existing related docs / threads / tickets?
2. **Info dump** — invite stream-of-consciousness context: plain text, paths to existing docs, ticket links, thread paste.
3. **Clarifying questions** — 5–10 numbered questions to fill remaining gaps. User answers shorthand (`1: yes`, `2: see #channel`, `3: backwards-compat reason`).
4. **Exit gate** — ask "ready to draft, or more context?" — wait for confirmation. Do not start scaffolding the file until the user confirms.

### 2. Refinement & structure

Build the document section by section.

1. **Agree on structure** — propose 3–5 sections based on doc type and context. Ask user to confirm or adjust.
2. **Scaffold the file** — use `save-file` to create the doc with placeholder text per section (`[To be written]`). One commit-equivalent action; review with the user before populating.
3. **Pick the starting section** — suggest the one with the most unknowns (usually the core decision / proposal). Never start with the summary.
4. **Per-section loop** — repeat for each section:
   - **Clarifying questions** — 5–10 numbered questions about what this section covers
   - **Brainstorm** — 5–20 numbered options of what could go in. Offer "more options?" at the end.
   - **Curation** — user picks: `keep 1,4,7,9` / `remove 3 (dupes 1)` / `combine 11+12`. Parse freeform feedback if the user gives `"looks good but ..."`.
   - **Gap check** — "anything missing for this section?"
   - **Draft** — `str-replace-editor` to replace the placeholder. Never reprint the whole doc.
   - **Iterate** — user feedback in, surgical edits out. After 3 iterations with no substantial change, ask "anything to remove without losing value?"
   - **Section exit gate** — "section done — move to next?"
5. **Whole-doc review at 80% complete** — re-read the full file. Surface contradictions, redundancy, generic filler. Apply final edits.

### 3. Reader test

Verify the doc works for someone without your context.

1. **Predict reader questions** — generate 5–10 questions a real reader would ask after reading.
2. **Run the test** — pick one:
   - **`ai-council` available** → invoke with the doc + predicted questions; treat each council member as a fresh reader.
   - **Otherwise** → instruct the user to open a fresh Claude / ChatGPT, paste the doc, ask the questions one by one. Capture answers.
3. **Additional fresh-reader checks** (always): "what is ambiguous?" · "what context does this doc assume readers have?" · "internal contradictions?"
4. **Report** — surface where the fresh reader got it wrong, where assumptions break.
5. **Loop back to Stage 2** for problematic sections until the fresh reader answers cleanly and surfaces no new gaps.

### 4. Handover

1. Final read-through by the user (they own the doc).
2. Verify facts, links, technical details.
3. Confirm intended impact achieved.
4. Surface the final file path. Done.

## Output format

1. Target document file at the agreed path (e.g. `agents/proposals/{slug}.md`)
2. One concluding line stating "Doc complete at {path} — ready for owner review"

## Gotcha

* **One question per turn** (Iron Law from `ask-when-uncertain`) — never bundle clarifying + brainstorm + curate prompts in one message.
* **Never reprint the full doc** during iteration — always use `str-replace-editor`. Reprinting wastes tokens and creates merge drift.
* **Reader test is not optional** — without it, you ship the version that makes sense to you, not to readers. Skip only on explicit user override.
* **Sub-agent absence** — `ai-council` may not be configured. Have the manual fresh-Claude fallback ready (Stage 3 step 2).
* **Image alt-text** — if the doc embeds images, add alt-text inline; without it, fresh-reader tools can't see them.
* **Language discipline** — keep the doc body in English (per `language-and-tone`). For verbatim German user phrases or interview quotes, use `DE: … · EN: …` anchor blocks.

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md).

* Per the default-terse rule, each section opens with content, not "In this section …".
* Per the cheap-question check, numbered-options blocks only when consequences differ — skip "yes / no, continue?" type prompts.
* Per the post-action summary suppression, the final output is the doc — no wrapping "Summary of what we did" block.

**Pre-save self-check:**

1. Does any section open with a narrative preamble instead of content?
2. Are clarifying questions bundled when one-at-a-time would surface user priorities better?
3. Is the reader-test stage skipped or merged into a "we're done" claim?
4. Is non-English prose present outside `DE: / EN:` anchor blocks?

## Do NOT

* Skip Stage 1 — straight-to-drafting produces docs that miss audience and impact
* Bundle 5+ questions into one numbered block — breaks one-question-per-turn
* Reprint the whole doc on every iteration
* Declare "done" without the Stage 3 reader test
* Generate doc content from scratch when the user has existing context — gap-closing is the whole point
