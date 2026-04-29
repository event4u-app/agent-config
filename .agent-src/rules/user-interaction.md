---
type: "always"
description: "User interaction — numbered options, progress indicators, summaries"
alwaysApply: true
source: package
---

# User Interaction

## Numbered Options — Always

When asking the user a question with predefined choices, **always present numbered options**.
The user should be able to reply with just a number (e.g., `1`) instead of typing a sentence.

### Format

```
> 1. First option — brief explanation
> 2. Second option — brief explanation
> 3. Third option — brief explanation

**Recommendation: 2 — Second option** — <one-sentence reason>. Caveat: <flip-condition>.
```

### Rules

- **Every question with choices** must use numbered options — no exceptions.
- **Keep options short** — one line each, with a brief explanation after the dash.
- **Always include a "skip" or "no change" option** when applicable.
- **Always state a recommendation** — see iron law below.
- **Use the user's language** for the question and options.
- **Accept both** the number and a natural language answer (e.g., "1" or "the first one").

### Iron Law — Single-Source Recommendation

```
EXACTLY ONE LINE NAMES THE RECOMMENDED NUMBER. NO INLINE TAG. NO SECOND PROSE NUMBER.
THE OPTION BLOCK STAYS NEUTRAL. THE RECOMMENDATION LINE IS THE ONLY SOURCE OF TRUTH.
DRIFT BETWEEN OPTION-BLOCK AND PROSA IS STRUCTURALLY IMPOSSIBLE WHEN THE TAG DOES NOT EXIST.
```

The agent has read the code, the contracts, the trade-offs. Refusing to take a position
dumps that work back on the user. Take the position; be wrong out loud if needed.
"Egal, was bevorzugst Du?" / "no preference" is NEVER acceptable.

**Format — non-negotiable:**

- Options block stays NEUTRAL — no `(recommended)`, no `(rec)`, no `←`, no bold, no checkmark.
- Directly after the options block, ONE line, bolded, in the user's language:
  - English: `**Recommendation: N — <option-name>** — <why>. Caveat: <flip-condition>.`
  - German:  `**Empfehlung: N — <option-name>** — <warum>. Caveat: <flip-bedingung>.`
- Other numbers MAY appear later in the prose, but ONLY as caveats
  (`escalate to 3 if …`, `flip to 1 when …`). NEVER as a primary recommendation.
- If the agent genuinely cannot pick (rare — true 50/50 with missing data),
  say what data would break the tie and ask for that instead.

### Iron Law — Pre-Send Self-Check

Before emitting any reply that contains numbered options, run this scan
on the drafted text:

1. Count occurrences of `(recommended)` / `(rec)` / `(empfohlen)` inline next to a numbered option → MUST be **zero**. Found one → rewrite, drop the tag.
2. Count distinct `Recommendation:\s*N` / `Empfehlung:\s*N` lines (case-insensitive) → MUST be **exactly one**. Two or more distinct numbers → rewrite, pick one.
3. The number on the recommendation line MUST exist in the option block.

Mechanical backstop available: `python3 scripts/check_reply_consistency.py --stdin < draft.md`
(non-zero exit on any rule above). Self-scan is the primary gate; the script is the
deterministic safety net for ambiguous cases.

**Mismatch is a rule violation, not a slip.** When a slip happens, the user calls it out → acknowledge once, rewrite, ship — same handling as `language-and-tone` slip protocol.

### What does NOT count as a recommendation

- "Both work" / "either is fine" / "depends on what you prefer"
- Listing pros and cons without picking a number
- "I'd lean towards X" without a reason
- Hiding behind "you know the project better"
- Inline `(recommended)` tag with no follow-up `Recommendation: N` line

### Examples

**Binary choice:**

```
> 1. Interactive — ask before each comment
> 2. Automatic — handle all independently

**Recommendation: 1 — Interactive** — the comments touch security-sensitive code,
so a wrong auto-fix is more expensive than approving each one. Caveat: flip to 2
if the comments turn out to be pure formatting.
```

**Multiple choice with skip:**

```
> 1. Fix the code
> 2. Fix the test
> 3. Skip

**Recommendation: 1 — Fix the code** — the test asserts the documented behaviour;
the production code drifted from the contract. Caveat: pick 2 only if the contract
itself is wrong.
```

**Confirmation with context:**

```
> Found PR #1399 on branch `chore/refactor-agent-setup-2`.
>
> 1. Yes, that's the right PR
> 2. No, different PR — I'll provide the URL

**Recommendation: 1 — Yes** — the branch name matches the PR title exactly.
Caveat: flip to 2 if the PR was reopened from a different branch.
```

### When NOT to use numbered options

- **Open-ended questions** where the answer is free text (e.g., "What should the class be named?").
- **Simple yes/no** can use numbered options OR accept "ja"/"nein" directly.
  Even for yes/no, prefer numbered options if there's additional context to show.

## Progress Indicators

When processing multiple items (e.g., review comments, test failures), show progress:

```
**Comment 3/7** — `filename.php:42`
```

## Summaries

After completing a batch of actions, provide a summary table:

```
| # | File | Action |
|---|---|---|
| 1 | `file.php` | Fixed null check |
| 2 | `test.php` | Updated assertion |
| 3 | `config.php` | Skipped (intentional) |
```
