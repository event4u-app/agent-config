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

## Blocker handover — when the reply leaves work stuck

A work reply that stops because something is waiting on the **user** closes
with the blocker, in the same one summary, above the PR-URL line. Not a second
summary — this is what "what remains" looks like when what remains is not yours
to do.

`agent-config gates --reply` renders it. Call it, paste what it returns, and
mirror the labels into the user's language. It prints **nothing** when nothing
is owned by the user, so it is safe to call unconditionally: the "no blocker →
no block" rule is a property of the command, not a judgement you have to make.

Three obligations the command cannot carry for you:

- **The options ARE the blocker decision — never a choice of substitute work.**
  This is the measured failure, not a hypothetical one: a session that ended
  every reply with well-formed numbered options still left its real blockers
  unresolved for nine rounds, because each option block asked *"which work
  should I do while your decision sits there"* (option 3 was reliably "nothing
  more autonomously"). The user answered every one of them with a digit and
  decided nothing. Offering the agent's next task is not a handover.
- **The action travels, not a pointer to it.** "The three readings are in the
  roadmap" is not a decidable option — the user cannot answer without reading
  first. Where a real choice exists, write the alternatives out, one line each
  for what speaks for them, then the single recommendation line
  ([`user-interaction`](../../../rules/user-interaction.md)).
- **Owner ≠ agent.** If you could clear it with a tool or a command, it is not
  a blocker, it is unfinished work — do it now. A blocker whose owner is the
  agent, announced instead of executed, is the promissory close that
  [`verify-before-complete`](../../../rules/verify-before-complete.md) forbids.

## Why the blocker handover is not a trailing checklist

[`mandated-lines`](../../execution/mandated-lines.md) bans the end-of-reply
checklist, and this shape has to answer that ban rather than sit beside it.

- **It fires only when owed.** Nothing waiting on the user ⇒ nothing emitted,
  enforced by the renderer. It never appears as evidence that blockers were
  checked for — which is exactly the ceremony the ban targets.
- **The end of the reply IS the decision point here.** The turn stops because
  the decision is the user's. A line emitted where the decision lands is the
  rule's own criterion, not an exception to it.
- **One blocker in full, the rest as a count.** The blocking one is written
  out; everything else is `N other decisions also wait on you` plus the
  command. A roster is the failure mode — "twelve decisions across two
  documents, ~850 lines" produced no decision at all.

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
- **`ask-when-uncertain`** (one question per turn): reporting N blockers is
  **zero** questions — it is a report. What the turn may carry is at most ONE
  numbered-options block, for the one blocking decision, with one recommendation
  line. Per-blocker questions are the violation that rule names.
- **`no-cheap-questions`** IL4: the handover ends on `Done when:` — a decidable
  signal, not "shall I continue once you've sorted this out?".
- **`scope-control`** post-artifact hard stop: the steps address the **user**.
  A handover that routes a slash-command back to the agent ("Blocker X — shall I
  start Phase 1?") is the execution menu that rule forbids, wearing a new label.

## Failure modes

- Burying the summary mid-reply, then continuing with more detail below it.
- Emitting the summary for a trivial one-answer reply (brevity says skip it).
- Creating a PR but leaving its URL somewhere in the middle, forcing the user to
  scroll/search.
- Masking the URL behind link text so it is not obviously the PR.
- Adding a PR-link line when no PR was created this turn.
- Closing on a blocker while offering the agent's next task instead of the
  decision the blocker actually needs.
- Handing over options as a count ("four options, see the template") or as a
  file reference — the user cannot answer either without reading first.
- Listing every open blocker flat, leaving the user to work out which one is
  the one holding the chain.
- Reporting the same blocker again, turn after turn, with no resolution path —
  a repeat with nothing moved is itself the finding, and belongs in the reply
  as such.
