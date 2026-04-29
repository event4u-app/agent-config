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
```

### Rules

- **Every question with choices** must use numbered options — no exceptions.
- **Keep options short** — one line each, with a brief explanation after the dash.
- **Always include a "skip" or "no change" option** when applicable.
- **Always state a recommendation** — see iron law below.
- **Use the user's language** for the question and options.
- **Accept both** the number and a natural language answer (e.g., "1" or "the first one").

### Iron Law — ALWAYS recommend

```
EVERY numbered-option question MUST state which option the agent recommends and WHY.
"Egal, was bevorzugst Du?" / "no preference" is NEVER an acceptable agent stance.
```

The user is asking the agent because the agent has read the code, the
contracts, the trade-offs. Refusing to take a position dumps that work
back on the user. Take the position; be wrong out loud if needed.

**Format:**

- Mark the recommended option inline: `1. Do X — short explanation (recommended)`.
- After the option block, state **WHY** in 1–3 sentences: the trade-off
  that tips the balance, plus the **caveat** that would flip it.
- **Consistency Iron Law** — the option marked `(recommended)` inline and
  the option named in the "I recommend N" / "Empfehlung N" prose MUST
  be the same number. Other numbers may appear as caveats ("escalate to
  2 if …"), but the primary recommendation in inline tag and prose
  match. **Pre-send gate**: before emitting, locate the `(recommended)`
  tag → locate the first "recommend N" / "Empfehlung N" in the prose
  → if N differs, rewrite. Mismatch is a rule violation, not a slip.
- If the agent genuinely cannot pick (rare — true 50/50 with missing
  data), say what data would break the tie and ask for that instead.

**Example:**

```
> 1. Hybrid contract — keys + query (recommended)
> 2. Key-based — extend the package
> 3. Semantic — change all call sites

I recommend 1: solves the acute consult-flow without a cross-repo PR,
and the file-fallback stays trivial. Caveat — if hit-rate on the
concat-shim turns out poor in practice, escalate to 2.
```

**What does NOT count as a recommendation:**

- "Both work" / "either is fine" / "depends on what you prefer"
- Listing pros and cons without picking
- "I'd lean towards X" without a reason
- Hiding behind "you know the project better" (the agent just researched it)

### Examples

**Binary choice (with recommendation):**
```
> 1. Interactive — ask before each comment (recommended)
> 2. Automatic — handle all independently

I recommend 1: the comments touch security-sensitive code, so a wrong
auto-fix is more expensive than the friction of approving each one.
Switch to 2 if the comments turn out to be pure formatting.
```

**Multiple choice with skip (with recommendation):**
```
> 1. Fix the code (recommended)
> 2. Fix the test
> 3. Skip

I recommend 1: the test is asserting the documented behavior; the
production code drifted from the contract. Pick 2 only if the contract
itself is wrong.
```

**Confirmation with context (recommendation implicit in framing):**
```
> Found PR #1399 on branch `chore/refactor-agent-setup-2`.
>
> 1. Yes, that's the right PR (recommended — branch matches)
> 2. No, different PR — I'll provide the URL
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
