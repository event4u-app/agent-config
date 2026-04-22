---
name: receiving-code-review
description: "Use when processing code review feedback (bot or human) before changing anything — triages, verifies, and pushes back with technical reasoning — even when the user just says 'fix the comments'."
source: package
---

# receiving-code-review

## When to use

* A PR has review comments (from bots like Copilot, Greptile, Augment,
  or from human reviewers) and the next step is to address them
* Someone pasted review feedback into the conversation and asks you
  to "fix it" or "handle it"
* A pair-programming partner gave verbal suggestions about code you
  just wrote
* You are tempted to reply "you are absolutely right" before reading
  the rest of the comment

Do NOT use when:

* You are writing a review yourself (different discipline)
* The user explicitly asks for blind implementation of a specific change
  that is not framed as review feedback
* The feedback is pure style/formatting that a linter should decide
  automatically — just run the linter

## Goal

Treat review feedback as **suggestions to evaluate**, not orders to
execute. Separate correct feedback from reviewer confusion. Push back
with technical reasoning when the suggestion is wrong for this
codebase. Never agree performatively.

## The Iron Law

```
NO IMPLEMENTATION UNTIL THE FEEDBACK IS UNDERSTOOD AND VERIFIED.
```

A "fix" implemented against a misread comment is worse than no fix —
it ships the wrong behavior under the label of "addressed feedback".

## Procedure

### 1. Read the full comment set before touching code

Read **every** open comment on the PR first. Comments often relate to
each other — fixing comment #3 in isolation can conflict with comment
#5. Group them:

* **Blocking** — breaks behavior, introduces a bug, security issue
* **Important** — logic is correct but design / readability issue
* **Minor** — naming, comment style, formatting the linter missed
* **Wrong** — reviewer misunderstood the code, or suggestion would
  regress another behavior

### 2. Restate each comment in your own words

For every comment, write (internally or to the user): *"The reviewer
is asking me to X because Y."*

If you cannot complete that sentence confidently → the comment is
unclear. Ask for clarification **before** implementing anything. Do
not implement the clear ones first and ask later — they may be linked.

### 3. Verify each claim against the code

For each comment classified as blocking/important:

* Reproduce the alleged issue locally (run the test, hit the endpoint,
  read the actual runtime value — see [`systematic-debugging`](../systematic-debugging/SKILL.md))
* Check what the code actually does, not what the reviewer **thinks**
  it does
* Check whether the suggested fix would break another test or caller
* Check `git blame` / history — the current code may be the way it is
  for a reason
* **Consult memory for prior context.** Via
  [`memory-access`](../../guidelines/agent-infra/memory-access.md),
  call `retrieve(types=["historical-patterns", "architecture-decisions"],
  keys=<files in the review>, limit=3)`. A registered historical pattern
  may confirm the reviewer's concern (accept) or an architecture
  decision may explain why the current shape is intentional (push back
  with the cited `id`).

### 4. Decide: accept, push back, or escalate

| Situation | Response |
|---|---|
| Reviewer is right, fix is local, no caller impact | Implement, reference the comment in the commit message |
| Reviewer is right but fix affects other callers | Note the downstream effects in the reply, then implement |
| Reviewer is wrong — based on misreading the code | Reply with evidence (specific line / test / value), do not change code |
| Reviewer suggests a feature the codebase does not use (YAGNI) | Reply asking whether the feature is actually needed, do not build speculatively |
| Reviewer and user / architecture disagree | Escalate to the user before implementing either path |

### 5. Reply in the right place, with the right tone

* For inline PR comments → reply **in the thread** of that comment,
  not as a top-level PR comment
* Quote **evidence**, not opinion — "line 47 already handles this via
  `$x->isNull()`" beats "I think that's fine"
* No flattery. No "great catch", "absolutely right", "thanks for
  noticing". The existing `language-and-tone` rule already bans this —
  actions are the acknowledgement
* If you were wrong in your earlier pushback, state it factually and
  move on. No long apology

### 6. Implement in priority order, one at a time

1. Blocking issues first
2. Important issues next
3. Minor issues last (or bundle them into a single commit)
4. Wrong / YAGNI: no code change, only a reply with reasoning

Run the relevant tests and linters **between** each group — do not
batch four changes and then run tests once. See
[`verify-before-complete`](../verify-before-complete/SKILL.md).

## Output format

When reporting back to the user after handling review:

1. **Triage table** — comment → classification → decision
2. **Implemented changes** — bullet per change with file + commit ref
3. **Pushed back** — bullet per rejected comment with the evidence
4. **Outstanding** — anything awaiting clarification, with the
   specific question

## Gotchas

* Bot comments (Copilot, Greptile) are **not** automatically right.
  They frequently flag false positives on patterns the codebase uses
  deliberately. Verify like you would a human comment.
* A comment that reads like a question ("should this be X?") is often
  a polite way of saying "change it to X". Ask if unclear instead of
  guessing the register.
* Resolving a comment in the GitHub UI without an accompanying fix or
  reply silently marks it handled — reviewers may not notice the lack
  of substance.
* Stacked PRs — a comment on the base PR may already be fixed in the
  child PR. Check both before touching code.
* A suggestion that passes review aesthetics but fails the test suite
  is still a regression. Run tests even when "the change is trivial".
* Flattery leaks in as "good point" or "thanks". Delete before
  sending. The code change itself is the acknowledgement.

## Do NOT

* Do NOT reply "you are absolutely right", "great catch", or any
  flattery variant — actions acknowledge, words do not
* Do NOT implement a suggestion before verifying it against the code
* Do NOT fix the clear items first and ask about the unclear ones
  later when the items are linked
* Do NOT accept a reviewer's suggestion that conflicts with an
  explicit architectural decision without raising it
* Do NOT batch multiple unrelated fixes into one commit — reviewers
  cannot re-review selectively
* Do NOT mark a comment resolved without either a code change or a
  reply with reasoning

## Anti-patterns

* Replying "Fixed!" after a commit that does not actually address the
  comment (wrong file, missed case)
* Rewriting the comment author's suggestion into your own words
  without checking whether the reinterpretation still matches intent
* Implementing the YAGNI-suggested feature "just in case" the reviewer
  comes back
* Silent disagreement — ignoring a comment without a reply

## When to hand over to another skill / command

* Executing the fixes across many comments → [`fix-pr-comments`](../../commands/fix-pr-comments.md)
  (handles both bot + developer), [`fix-pr-bot-comments`](../../commands/fix-pr-bot-comments.md),
  [`fix-pr-developer-comments`](../../commands/fix-pr-developer-comments.md)
* Running the full verification gate before pushing replies →
  [`verify-before-complete`](../verify-before-complete/SKILL.md)
* Writing the commit message that references the review →
  [`conventional-commits-writing`](../conventional-commits-writing/SKILL.md)
* Digging into *why* the reviewer's scenario actually fails →
  [`systematic-debugging`](../systematic-debugging/SKILL.md)

## Validation checklist

Before considering review handling done:

* [ ] Every open comment has been read, classified, and has a decision
* [ ] No comment was implemented without a one-sentence restatement
* [ ] Every implemented fix has been verified by a test or runtime check
* [ ] Every rejected comment has a reply quoting evidence
* [ ] No comment was marked resolved without code change or reply
* [ ] No reply contains flattery
* [ ] Linters and relevant tests pass after the changes
