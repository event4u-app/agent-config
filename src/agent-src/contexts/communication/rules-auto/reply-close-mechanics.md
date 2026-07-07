# Reply close — work summary + PR link

Lookup material for the reply-close carve-out in the
[`direct-answers`](../../../rules/direct-answers.md) Brevity Iron Law. The rule
body states the obligation in one line; this file is the detail.

## The carve-out

Brevity governs the reply **body**; the **close** is the exception.

- A reply that landed **substantial work** — a multi-step change, roadmap/branch
  progress, or a created/updated PR — ends with **ONE** compact status summary at
  the very end, never mid-reply: what's done, what remains.
- **Simple one-answer replies still skip the summary** (the Brevity Iron Law is
  unchanged for them). The summary is for work replies, not every turn.

## PR link is the literal last line

If a PR was **created or updated this turn**, its raw GitHub URL is the **literal
last line** of the reply — after the summary, nothing below it — so the user never
hunts for it. One PR → one URL line.

- Only when a PR was actually created/updated **this turn**. No PR → no link line.
- The raw URL (not a masked markdown link) so it is unmistakable and clickable.

## Why it does not collide with sibling rules

- **`language-and-tone`** last-line rule: a raw URL is language-neutral, so it
  satisfies the "every user-visible token mirrors the user's language" gate.
- **`no-pr-progress-comments`** / **`no-attribution-footers`**: those govern
  comments posted *on the PR*. The summary and URL here are the **chat reply
  body**, not a PR comment — so neither rule applies.
- **`user-interaction`**: a numbered-options block, when present, still comes
  last among interactive elements; the PR URL sits below it as the final line and
  is not an "open question," so it does not trip the no-trailing-open-question
  rule.

## Failure modes

- Burying the summary mid-reply, then continuing with more detail below it.
- Emitting the summary for a trivial one-answer reply (brevity says skip it).
- Creating a PR but leaving its URL somewhere in the middle, forcing the user to
  scroll/search.
- Masking the URL behind link text so it is not obviously the PR.
- Adding a PR-link line when no PR was created this turn.
