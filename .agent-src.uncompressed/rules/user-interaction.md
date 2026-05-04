---
type: "auto"
description: "Asking the user a question, presenting options, or summarizing progress — numbered-options Iron Law, single-recommendation rule, progress indicators"
alwaysApply: false
source: package
load_context:
  - .agent-src.uncompressed/contexts/communication/rules-auto/user-interaction-mechanics.md
---

# User Interaction

Two Iron Laws govern every reply that contains numbered options. They
override conversation momentum, brevity, and the urge to defer to the
user. **Missing a recommendation is a rule violation, not a slip.**

## Iron Law 1 — Single-Source Recommendation

```
EXACTLY ONE LINE NAMES THE RECOMMENDED NUMBER. NO INLINE TAG. NO SECOND PROSE NUMBER.
THE OPTION BLOCK STAYS NEUTRAL. THE RECOMMENDATION LINE IS THE ONLY SOURCE OF TRUTH.
DRIFT BETWEEN OPTION-BLOCK AND PROSE IS STRUCTURALLY IMPOSSIBLE WHEN THE TAG DOES NOT EXIST.
MISSING RECOMMENDATION = RULE VIOLATION, NOT A SLIP.
POSITION-AGNOSTIC. END-OF-TURN MENUS COUNT. NEXT-STEP LISTS COUNT. NO EXCEPTIONS.
```

The agent has read the code, the contracts, the trade-offs. Refusing
to take a position dumps that work back on the user. Take the
position; be wrong out loud if needed. "Egal, was bevorzugst Du?" /
"no preference" is NEVER acceptable.

**Position-agnostic — closes the most common slip:** End-of-turn
"Wie weiter?" / "What next?" / "How to proceed?" / "How should we
continue?" blocks with numbered options are **numbered-options
blocks**. Same Iron Law applies — exactly one `Empfehlung: N` /
`Recommendation: N` line, every time. There is no "these are just
follow-up suggestions" exception, no "the user knows better here"
exception, no "I genuinely don't have a preference" exception. If
the agent prints `1. … 2. … 3. …` anywhere in the reply, the
recommendation line is mandatory.

**Format — non-negotiable:**

- Options block stays NEUTRAL — no `(recommended)`, no `(rec)`, no `←`, no bold, no checkmark.
- Directly after the options block, ONE line, bolded, in the user's language:
  - English: `**Recommendation: N — <option-name>** — <why>. Caveat: <flip-condition>.`
  - German:  `**Empfehlung: N — <option-name>** — <warum>. Caveat: <flip-bedingung>.`
- Other numbers MAY appear later in the prose, but ONLY as caveats
  (`escalate to 3 if …`, `flip to 1 when …`). NEVER as a primary recommendation.
- If the agent genuinely cannot pick (rare — true 50/50 with missing data),
  say what data would break the tie and ask for that instead.

**What does NOT count as a recommendation:**

- "Both work" / "either is fine" / "depends on what you prefer"
- Listing pros and cons without picking a number
- "I'd lean towards X" without a reason
- Hiding behind "you know the project better"
- Inline `(recommended)` tag with no follow-up `Recommendation: N` line

**Slip handling — same protocol as [`language-and-tone`](language-and-tone.md#slip-handling).**
User calls out a missing or wrong recommendation → acknowledge once
in the user's language, rewrite the reply with a recommendation,
ship. No "from now on" promises — only the next reply proves
compliance.

## Iron Law 2 — Pre-Send Self-Check

```
EVERY REPLY WITH NUMBERED OPTIONS RUNS THE SELF-CHECK. NO EXCEPTIONS.
SKIPPING IT IS A RULE VIOLATION, NOT A SLIP.
```

Before emitting any reply that contains numbered options, scan the
**entire drafted reply** — top to bottom, including end-of-turn
"Wie weiter?" / "What next?" continuation menus, follow-up
suggestion blocks, and any list of `1. … 2. … 3. …` regardless of
its position or framing:

1. Count occurrences of `(recommended)` / `(rec)` / `(empfohlen)` inline next to a numbered option → MUST be **zero**. Found one → rewrite, drop the tag.
2. Count `1\.\s` / `2\.\s` / `3\.\s` patterns inside blockquotes or top-level prose → if **any** numbered-option block exists anywhere in the reply, the recommendation line is mandatory.
3. Count distinct `Recommendation:\s*N` / `Empfehlung:\s*N` lines (case-insensitive) → MUST be **exactly one per options block**. Zero → add one. Two or more distinct numbers → rewrite, pick one.
4. The number on the recommendation line MUST exist in the option block it follows.
5. If the reply has multiple options blocks (e.g. a clarification block AND an end-of-turn menu), each block gets its own `Recommendation: N` line directly underneath.

Mechanical backstop: `python3 scripts/check_reply_consistency.py --stdin < draft.md`
(non-zero exit on any rule above). Self-scan is the primary gate; the
script is the deterministic safety net for ambiguous cases.

Common failure modes (end-of-turn menu skipped, "no preference"
hedges, multi-block reply with one recommendation) and the named
slip catalog live in
[`contexts/communication/rules-auto/user-interaction-mechanics.md`](../contexts/communication/rules-auto/user-interaction-mechanics.md)
§ Common failure modes.

## Numbered Options — Always

When asking the user a question with predefined choices, **always
present numbered options**. The user should be able to reply with
just a number (e.g., `1`) instead of typing a sentence.

### Format

```
> 1. First option — brief explanation
> 2. Second option — brief explanation
> 3. Third option — brief explanation

**Recommendation: 2 — Second option** — <one-sentence reason>. Caveat: <flip-condition>.
```

### Rules

- **Every question with choices** must use numbered options — no exceptions.
- **Every numbered list with `1. … 2. … 3. …`** is a numbered-options block, regardless of position. End-of-turn "Wie weiter?" / "What next?" / "How to proceed?" menus, mid-reply continuation prompts, and clarification blocks all count.
- **Keep options short** — one line each, with a brief explanation after the dash.
- **Always include a "skip" or "no change" option** when applicable.
- **Always state a recommendation** — Iron Law 1 above. Per options block, every time, position-agnostic.
- **Use the user's language** for the question and options.
- **Accept both** the number and a natural language answer (e.g., "1" or "the first one").

### Examples and "when NOT to use" — see mechanics

Worked examples (binary choice, multiple choice with skip,
confirmation with context), the "when NOT to use numbered options"
catalog, progress indicators, and summary-table patterns live in
[`contexts/communication/rules-auto/user-interaction-mechanics.md`](../contexts/communication/rules-auto/user-interaction-mechanics.md).
