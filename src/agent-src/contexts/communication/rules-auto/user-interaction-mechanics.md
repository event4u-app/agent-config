# User Interaction — mechanics

Rationale, failure-mode catalog, format examples, progress
indicators, and summary patterns for the
[`user-interaction`](../../../rules/user-interaction.md) rule. The
rule body holds the Iron Law fenced blocks (single-source
recommendation, pre-send self-check, decision outlives the turn, context-carrying
asks); this file is the lookup
material for everything else.

## Why the agent must take a position

The agent has read the code, the contracts, the trade-offs.
Refusing to take a position dumps that work back on the user. Take
the position; be wrong out loud if needed. "Egal, was bevorzugst
Du?" / "no preference" is NEVER acceptable.

## Position-agnostic — the most common slip

End-of-turn "Wie weiter?" / "What next?" / "How to proceed?" / "How
should we continue?" blocks with numbered options ARE numbered-options
blocks. Same Iron Law applies — exactly one `Empfehlung: N` /
`Recommendation: N` line, every time. No "these are just follow-up
suggestions" exception, no "the user knows better here" exception, no
"I genuinely don't have a preference" exception. If the agent prints
`1. … 2. … 3. …` anywhere in the reply, the recommendation line is
mandatory.

## Format — non-negotiable

- Options block stays NEUTRAL — no `(recommended)`, no `(rec)`, no
  `←`, no bold, no checkmark.
- Directly after the options block, ONE line, bolded, in the user's
  language:
  - English: `**Recommendation: N — <option-name>** — <why>. Caveat: <flip-condition>.`
  - German:  `**Empfehlung: N — <option-name>** — <warum>. Caveat: <flip-bedingung>.`
- Other numbers MAY appear later in the prose, but ONLY as caveats
  (`escalate to 3 if …`, `flip to 1 when …`). NEVER as a primary
  recommendation.
- Genuine tie (rare — true 50/50 with missing data) → say what data
  would break the tie and ask for that instead.

## No trailing open-ended question

Reply contains numbered options → the recommendation line IS the
closer. No `Welcher Pfad?` / `What's it gonna be?` / `Was meinst
Du?` / `Was sagst Du?` / `Welche willst Du?` / `What do you think?`
after the recommendation — that reframes the vote as opinion-poll
and is hedging in disguise. The user picks a number; the agent does
not re-ask. Permitted: a clarifying caveat sentence on the
recommendation line itself (`Caveat: flip to 2 if …`). Forbidden:
any standalone trailing question that re-opens the choice.

## What does NOT count as a recommendation

- "Both work" / "either is fine" / "depends on what you prefer"
- Listing pros and cons without picking a number
- "I'd lean towards X" without a reason
- Hiding behind "you know the project better"
- Inline `(recommended)` tag with no follow-up `Recommendation: N` line

## Pre-send self-check details

Before emitting any reply that contains numbered options, scan the
**entire drafted reply** — top to bottom, including end-of-turn
"Wie weiter?" / "What next?" continuation menus, follow-up
suggestion blocks, and any list of `1. … 2. … 3. …` regardless of
position or framing:

1. Count occurrences of `(recommended)` / `(rec)` / `(empfohlen)`
   inline next to a numbered option → MUST be **zero**. Found one →
   rewrite, drop the tag.
2. Count `1\\.\\s` / `2\\.\\s` / `3\\.\\s` patterns inside blockquotes
   or top-level prose → if **any** numbered-option block exists
   anywhere in the reply, the recommendation line is mandatory.
3. Count distinct `Recommendation:\\s*N` / `Empfehlung:\\s*N` lines
   (case-insensitive) → MUST be **exactly one per options block**.
   Zero → add one. Two or more distinct numbers → rewrite, pick one.
4. The number on the recommendation line MUST exist in the option
   block it follows.
5. Multiple options blocks (e.g. clarification block AND end-of-turn
   menu) → each block gets its own `Recommendation: N` line directly
   underneath.
6. Context (Iron Law 4) → read the ask as a user who saw none of this
   turn's tool output. Every identifier explained, the blocker named,
   every option's consequence stated? Any "no" → add it before sending.

Mechanical backstop:
`./scripts-run src/scripts/check_reply_consistency --stdin < draft.md`
(non-zero exit on any rule above). Self-scan is the primary gate;
the script is the deterministic safety net for ambiguous cases.

## Common failure modes — known, named, no excuses

- **End-of-turn menu skipped.** Reply answers fine, then ends with
  `1. … 2. … 3. …` and no `Empfehlung:`. Iron Law 1 violated — these
  are numbered options, position is irrelevant.
- **Trailing-question hedge.** Reply has options + recommendation,
  but ends with `Welcher Pfad?` / `What's it gonna be?` — reframes
  the vote as opinion-poll. Banned by Iron Law 1.
- **"Genuinely no preference" hedge.** Pick anyway. Agent has more
  context than user on the trade-off; refusing to pick dumps the
  work back. Pick the safest option, name the flip-condition.
- **"User knows the project better" hedge.** Same failure mode,
  different costume. The user asked for an opinion by virtue of
  accepting the options block; deliver it.
- **Multi-block reply with one recommendation.** Two options blocks
  but only one `Empfehlung:` line — second block unguarded. Rule 5
  of Iron Law 2 closes this.

## Slip handling

Same protocol as
[`language-and-tone § slip-handling`](../../../rules/language-and-tone.md#slip-handling).
User calls out a missing or wrong recommendation → acknowledge once
in the user's language, rewrite the reply with a recommendation,
ship. No "from now on" promises — only the next reply proves
compliance.

## Numbered Options — rules

- **Every question with choices** must use numbered options — no
  exceptions.
- **Every numbered list with `1. … 2. … 3. …`** is a
  numbered-options block, regardless of position. End-of-turn "Wie
  weiter?" / "What next?" / "How to proceed?" menus, mid-reply
  continuation prompts, and clarification blocks all count.
- **Keep options short** — one line each, with a brief explanation
  after the dash.
- **Always include a "skip" or "no change" option** when applicable.
- **Always state a recommendation** — Iron Law 1.
- **Use the user's language** for the question and options.
- **Accept both** the number and a natural-language answer ("1" or
  "the first one").

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

## Bullet floor

Multi-step content earns bullets; each bullet is a complete 1–2-sentence
statement, never a fragment masquerading as a list item ("Faster." /
"Better UX." with no subject or verb). A decline or refusal is **never**
rendered as a bulleted list of reasons — declines are short prose (one or
two sentences), because a bulleted refusal reads as a checklist to argue
against rather than a direct answer.

Full example set: [`asking-and-brevity-examples § Bullet floor`](../../../../../docs/guidelines/agent-infra/asking-and-brevity-examples.md#bullet-floor).

## Summaries

After completing a batch of actions, provide a summary table:

```
| # | File | Action |
|---|---|---|
| 1 | `file.php` | Fixed null check |
| 2 | `test.php` | Updated assertion |
| 3 | `config.php` | Skipped (intentional) |
```

## Context-carrying asks (Iron Law 4)

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
a counter-question, an "Other" correction, or were ignored. Native-ask dialogs
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
  Fix: put the open question first, or ask it in its own reply — and when
  re-presenting it (Iron Law 3) give it the same context again.
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

**Carrier, stated honestly.** Model-carried. `check_reply_consistency` checks
the recommendation line's shape and cannot judge whether a question is
answerable from outside the agent's context; no detector claims to.

## Pasted output — keep the reply narrow

Moved from the rule body on 2026-11-21 to pay for Iron Law 4 under the
per-spawn preamble budget. When the user pastes large tool output, logs,
JSON, or API responses, keep the reply narrow: extract only the relevant
fields with targeted filters (`jq`, `rg`, `grep`) before quoting, instead of
echoing the whole blob back.

## The trigger is a decision, not a format — the measurement behind it

Migrated out of `user-interaction.md` on 2026-09-11 to pay for Iron Law 3
under the per-spawn preamble budget. The obligation stays in the rule; this
is the evidence for it.

Measured (30-session conformance audit, 2026-08-06): **every** malformed ask
was a one-line parenthetical or a trailing free-text offer — a German
"say the word if I should take the three lines along", an English "shall I
implement it this way?" — while the same sessions formatted their **large**
asks perfectly. So the rule is being read as *if numbered options, then a
recommendation line*. It is the other way round, and an ask that feels too
small for a block is exactly the one that escapes the format.

Three further caught shapes: a contentless filler option; an inline
"(recommended)" tag **beside** the recommendation line (the dual source
Iron Law 1 forbids); an option set answerable only as `1,3,4`.

**No gate ships for this.** `check_reply_consistency` can read a draft on
stdin, but it inspects *numbered-option blocks* — and every measured failure
had no block by construction, so it scans exactly the surface that did not
fail. `conformance:behavior` deliberately does not score ask-shape, so an
unmoved rate is a finding rather than a silence.

## Iron Law 3 — why laws 1 and 2 do not reach across a turn boundary

Iron Laws 1 and 2 are discharged by the shape of the reply that carries the
block. Neither survives a turn boundary, which is the gap Iron Law 3 closes:
a second assistant execution with no user message between it and the ask is
not a new conversation, and from the user's side a thread that ends without
the question ended without the question.

**The measured failure.** A turn put three numbered options and a
recommendation line to the user. A `stop` concern then produced a second
assistant execution with no intervening user message, and that second reply
handled the concern while demoting the open question to a subordinate clause.
The four rules that could have caught it did not, each for a stated reason:
Iron Law 1 inspects a reply that HAS an options block, `check_reply_consistency`
receives a draft rather than a transcript, `active-remediation` governs
findings rather than issued decisions, and `no-cheap-questions` guards the
opposite direction.

**Carrier, stated honestly.** The deterministic half is the
`pending-decision` detector in `src/scripts/hooks/turn_end_gate_hook.ts` —
it refuses a turn-end when an earlier reply in the same user turn carried a
block and the closing reply carries none. It sees one user turn on one host,
so everything outside that is model-carried, exactly like Iron Law 2's own
"no gate ships for this" note. `check_reply_consistency` reads a single draft
and holds no cross-turn state; it cannot see this law at all.

## The native ask — per host, and what it changes

> **Why this is here and not in the rule.** `user-interaction` is a
> project-scope rule, so its every byte is re-written into the preamble on
> **every subagent spawn**, and `check_preamble_payload_budget` is a measured
> ratchet with no headroom — a four-line addition to the rule measured +219
> tokens per spawn and failed it. The rule's own § Mechanics already routes
> "everything you look up rather than obey" here, and the ask SHAPE is lookup
> material: Iron Law 1 governs the recommendation identically on both shapes,
> so the rule needed no new obligation, only this contract to point at.

`ask: native | text` is declared per host in `src/scripts/hook_manifest.yaml`
and printed by `agent-config hooks:status`. It is **declared, not probed**: the
row records what the host's documented tool surface offers. A host declaring
`native` whose primitive turns out to be absent degrades to the text block —
the same question, the same content — so a wrong row costs a missed upgrade and
never a broken ask. Absent reads `text`.

| Shape | What the ask is | Where the recommendation lives |
|---|---|---|
| `native` | the host's structured-ask tool call | the **default option** of the native ask |
| `text` | the numbered block, per Iron Law 1 | the `Recommendation:` / `Empfehlung:` line directly under the block |

Four obligations hold on both shapes, and three of them are why the native
form is preferred rather than merely available:

1. **One decision point per turn.** A native ask presenting several unrelated
   questions is the same violation as several text blocks. One number — or one
   selection — answers it, or it is two asks.
2. **Every option says what changes by answering it.** Not the option's name
   again: the consequence. A native ask makes this structural, because an
   option carries a description field the text form leaves to discipline.
3. **The recommendation has exactly ONE source.** On a native ask that source
   is the default option; naming it a second time in the prose above is the
   drift Iron Law 1 exists to make structurally impossible.
4. **The answer is recorded before the next step runs.** Where the ask came out
   of a plan-closure pass, it becomes a `## Decisions` row — id, ownership,
   `resolved by: owner`, the decision, its evidence, its `revisit if`. An
   answer that lives only in the transcript is re-derived after the next
   context reset, which is the repeat the ask census counts as a defect.

**What the native shape does NOT change.** It is not a license to ask more: the
one-question-per-turn floor, the no-cheap-questions floor and the ownership
routing all run first, and a question that should not have been asked is not
improved by a better widget. Nor does it change who may be asked — a technical
decision does not reach the owner on any host.
