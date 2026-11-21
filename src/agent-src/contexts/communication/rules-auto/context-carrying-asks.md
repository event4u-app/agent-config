# Context-carrying asks — mechanics

Lookup material for Iron Law 4 of the
[`user-interaction`](../../../rules/user-interaction.md) rule (a question
carries its own context). Split out of
[`user-interaction-mechanics`](user-interaction-mechanics.md) to stay under the
per-file depth budget.

**Why.** The agent asks at the end of a long run of reads, greps and
reasoning; the user saw none of it. A question that is obvious from inside
that context is a riddle from outside — the user has to reply "was meinst
du?" or guess, and either way the ask cost a round trip instead of saving
one. On hosts with a native ask (Claude Code's `AskUserQuestion`), the dialog
can cover the reply text above it, so even context written in the same reply
may be invisible while the user decides.

**The three facts every ask carries** — in the question itself, or in the
one or two sentences directly above a text block:

1. **What is being decided** — the subject in plain words, not only its id.
2. **Why it blocks now** — what was found that forces the choice, and what
   the agent cannot settle alone (otherwise it is a cheap question —
   [`no-cheap-questions`](../../../rules/no-cheap-questions.md)).
3. **What each option changes** — the consequence, not the option's name
   restated.

**Bare references — name what it is.** A file, ADR number, roadmap slug,
branch, PR number, commit hash, setting key or finding id reaches the user
with a short gloss: `ADR-104 (council config is read user-global only)`, not
`ADR-104`; `the stale-lock branch (PR #2990, already merged)`, not
`stale-lock`. A reference into material only the agent saw — "option B of the
three", "the second finding", "the failing one" — is restated, never pointed
at.

**Failure modes — measured.** Audit of 39 recent transcripts across several
projects and profiles (2026-11-21): 123 questions, ~20 drew a confused reply,
a counter-question, an "Other" correction, or were ignored. Counts below are
per class over all context-poor asks, and one ask can fall in several. Native-ask dialogs
were mostly well-formed (≈35 of 46); the misses cluster in plain-text asks and
in naming/design questions.

- **ID soup** (most frequent, ~18). Decision, blocker, ADR-section, stage,
  round, PR and script ids stand in for what they mean — "B-20 to B-24:
  (1) D-319 … (2) D-320 …". When the owner cannot decode them they hand the
  choice off ("settle it in the council"), a quiet sign the ask was not
  answerable. Fix: one gloss per id.
- **Unintroduced term.** The agent asks what a term from a source doc or its
  own earlier draft should mean ("what should the 'also in tabs' option
  do?") without saying where the term came from or what problem it solves.
  Reply: "no idea" or "this thing seems pointless". Fix: state origin and
  purpose before asking for meaning.
- **Buried at the end of a report** (~5, 4 ignored). The question is the last
  line after a status report, or a leftover "still open from earlier: …".
  The user answers the report; the question is re-asked and ignored again.
  Fix: open the reply with one line naming the open decision ("Open decision
  below: …"), keep the block and its recommendation line in their usual place
  (the end-summary still closes a work reply), or ask it in its own reply —
  and when re-presenting it (Iron Law 3) give it the same context again.
- **Options on a wrong or partial premise.** The option set skips what the
  user already said, or assumes the wrong place ("which line in the
  equipment window?" — it was the chat). Fix: restate the premise in one
  clause so a wrong one is visible and correctable.
- **Tool-output pointer.** "Should I fix 2 and 3 as well?" after output the
  user never saw. Fix: name the items and what fixing them changes.
- **Hidden-preamble native ask.** The context sits in the reply prose, the
  dialog covers it, and the dialog's question reads "Which approach?". The
  native question repeats the needed facts itself.

**Brevity is not a waiver.** `direct-answers` Iron Law 3 cuts narration, not
the facts a decision needs: one sentence of context that prevents a "what do
you mean?" round trip is the short path. Context ≠ a transcript recap — give
the facts the answer depends on, nothing else.

**Example.**

Bad (native ask):

> **Which way?** 1. Separate PR  2. Bundle

Good:

> **`ask-when-uncertain` is a kernel rule, and kernel edits need their own PR
> with 24 h soak before the next kernel PR merges. This change touches it and
> `no-cheap-questions`. How should it ship?**
> 1. Two PRs, 24 h apart — follows the soak rule; the second change lands a day later.
> 2. One PR with the `bundled-always-rules-acknowledged` label — lands today; the PR body must justify the bundle.
>
> **Recommendation: 1 — Two PRs** — the soak exists to isolate a regression to one edit. Caveat: flip to 2 if both edits only make sense together.

On a native ask the same recommendation is the default option instead of the line.

**Carrier, stated honestly.** Model-carried. `check_reply_consistency` checks
the recommendation line's shape and cannot judge whether a question is
answerable from outside the agent's context; no detector claims to.
