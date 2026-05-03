# User Interaction — mechanics

Format examples, common failure modes, progress indicators, and
summary patterns for the [`user-interaction`](../../../rules/user-interaction.md)
rule. Iron Law 1 (single-source recommendation) and Iron Law 2
(pre-send self-check) live in the rule; this file is the lookup
material for the format details.

## Common failure modes — known, named, no excuses

- **End-of-turn menu skipped.** Reply answers the question fine, then ends with `> 1. Foo > 2. Bar > 3. Stop` and no `Empfehlung:`. Iron Law 1 was violated — these are numbered options, position is irrelevant.
- **"Genuinely no preference" hedge.** Pick anyway. The agent has more context than the user on the trade-off; refusing to pick dumps the work back. Pick the safest option, name the flip-condition.
- **"User knows the project better" hedge.** Same failure mode, different costume. The user asked for an opinion by virtue of accepting the options block; deliver it.
- **Multi-block reply with one recommendation.** Two options blocks but only one `Empfehlung:` line — the second block is unguarded. Rule 5 of Iron Law 2 closes this.

## Examples

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

## When NOT to use numbered options

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
