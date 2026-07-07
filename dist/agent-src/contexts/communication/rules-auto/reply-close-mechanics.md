# Reply close — work summary + PR link

Lookup material for the reply-close carve-out in the
[`direct-answers`](../../../rules/direct-answers.md) Brevity Iron Law. Rule body
states the obligation in one line; this file is the detail.

## The carve-out

Brevity governs the reply **body**; the **close** is the exception.

- Reply that landed **substantial work** — multi-step change, roadmap/branch
  progress, or a created/updated PR — ends with **ONE** compact status summary at
  the very end, never mid-reply: what's done, what remains.
- **Simple one-answer replies still skip the summary** (Brevity Iron Law unchanged
  for them). Summary is for work replies, not every turn.

## PR link is the literal last line

PR **created or updated this turn** → its raw GitHub URL is the **literal last
line**, after the summary, nothing below it — so the user never hunts for it. One
PR → one URL line.

- Only when a PR was actually created/updated **this turn**. No PR → no link line.
- Raw URL (not a masked markdown link) so it is unmistakable and clickable.

## Why it does not collide with sibling rules

- **`language-and-tone`** last-line rule: a raw URL is language-neutral → satisfies
  the "every user-visible token mirrors the user's language" gate.
- **`no-pr-progress-comments`** / **`no-attribution-footers`**: those govern
  comments posted *on the PR*. Summary + URL here are the **chat reply body**, not
  a PR comment — neither applies.
- **`user-interaction`**: a numbered-options block, when present, still comes last
  among interactive elements; the PR URL sits below it as the final line and is not
  an "open question" → does not trip the no-trailing-open-question rule.

## Failure modes

- Burying the summary mid-reply, then continuing with more detail below it.
- Emitting the summary for a trivial one-answer reply (brevity says skip).
- Creating a PR but leaving its URL mid-reply, forcing the user to scroll/search.
- Masking the URL behind link text so it is not obviously the PR.
- Adding a PR-link line when no PR was created this turn.
