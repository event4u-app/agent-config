---
type: "auto"
tier: "3"
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

**No trailing open-ended question after numbered options:**

If the reply contains numbered options, the recommendation line IS
the closer. No `Welcher Pfad?` / `What's it gonna be?` / `Was meinst
Du?` / `Was sagst Du?` / `Welche willst Du?` / `What do you think?`
after the recommendation — that reframes the vote as an opinion poll
and is hedging in disguise. The user picks a number; the agent does
not re-ask. Permitted: a clarifying caveat sentence on the
recommendation line itself (`Caveat: flip to 2 if …`). Forbidden:
any standalone trailing question that re-opens the choice.

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

### Common failure modes — known, named, no excuses

- **End-of-turn menu skipped.** Reply answers the question fine, then ends with `1. … 2. … 3. …` and no `Empfehlung:`. Iron Law 1 was violated — these are numbered options, position is irrelevant.
- **Trailing-question hedge.** Reply has options + recommendation, but ends with `Welcher Pfad?` / `What's it gonna be?` / `Was meinst Du?` — the open question reframes the vote as opinion-poll. Banned by Iron Law 1; the recommendation line is the closer.
- **"Genuinely no preference" hedge.** Pick anyway. The agent has more context than the user on the trade-off; refusing to pick dumps the work back. Pick the safest option, name the flip-condition.
- **"User knows the project better" hedge.** Same failure mode, different costume. The user asked for an opinion by virtue of accepting the options block; deliver it.
- **Multi-block reply with one recommendation.** Two options blocks but only one `Empfehlung:` line — the second block is unguarded. Rule 5 of Iron Law 2 closes this.

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
