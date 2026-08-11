---
adr: 222
status: proposed
date: 2026-08-11
decision: blocker-handover-at-reply-close
supersedes: —
superseded_by: —
phase: —
type: structural
review_trigger: >-
  Revisit when either (a) a consumer session closes on a blocker using
  `gates --reply` and the user still asks "what do I do now?", which falsifies
  the claim that a delivered, decidable handover is what was missing and moves
  the question back to enforcement rather than supply, or (b) ad-hoc blockers
  with no roadmap entry — a missing credential, an exhausted quota, an
  unreachable service — are observed to end sessions in a measured sample,
  which is the evidence this record explicitly declines to assume and the
  trigger to extend the form beyond roadmap blockers. Neither is a date: both
  are observable events, and the second one is a counting exercise nobody has
  run.
---

# ADR-222 — The blocker handover belongs at reply-close, and is delivered rather than remembered

## Status

**Proposed** · 2026-08-11. Adds one section to a non-kernel mechanics file and
one flag to an existing command. No kernel rule is edited, so no soak window
applies; see *Consequences* for why that was a finding rather than a choice.

## Context

The five-field blocker structure already exists and is already enforced. A
roadmap gate that only a human can clear becomes `### blocker: <id>` carrying
`Status`, `Owner`, `Blocks`, `What to do:` and `Resolved when:`;
`lint_roadmap_blockers.ts` fails CI when a field is missing; `agent-config
gates` renders the open ones action-first, ordered by how much each unblocks.

None of that reaches the person who has to act. The renderer's own header says
so, and has said so since it was written: *"The fields exist, are CI-enforced
by `lint_roadmap_blockers`, and never reach the user in a form they can act
on."* The reply-close contract — `direct-answers` Iron Law 3, detailed in
`reply-close-mechanics` — requires one end-summary ("what's done, what
remains") and the PR URL as the literal last line. It does not contain the word
*blocker*.

So the structure is a **pull** channel that only someone who already knows to
ask will read.

### What the transcripts show

Forensics over three consumer sessions (2026-08-07 … 2026-08-11) found five
follow-ups of the form *"what do I do now?"*. The sharpest one is a user pasting
a tool's full output back into the chat — output that named the gate holding
everything up and pointed at the roadmap's blocker block — and asking, right
next to it, what he should do. Same message: *"Ich will nciht alles lesen,
analysieren."* The blocker was reported. The pointer was there. The question
stood anyway.

Twelve failure patterns were catalogued. Four carry this record: the action
placed after four sections of forensics; a flat list of "three things are on
you" when only one held the chain; options handed over as a file reference
("the three readings are in the roadmap") so the user could not answer without
reading first; and options handed over as a bare count ("the remote — template
ready, four options").

### The alternative this record rejects, and why

A council round proposed that no new channel is needed: one session in the
corpus had **zero** follow-ups, and in it the agent wrote numbered options into
the reply. Read as a natural A/B test, that would make in-reply formatting
sufficient and any tooling premature.

Checking it dissolved it, on four counts:

1. **No control arm.** The session contains no stretch where a blocker was
   handed over *without* options. One arm is an observation, not an experiment.
2. **Its premise is false.** That session ran `roadmap:progress` 53 times,
   `claims-ledger-check` 81 times, `task ci` 60 times — and the dashboard's step
   count appears *verbatim* inside the option blocks. Deterministic output was
   present throughout; it is the confounder the claim needs to exclude.
3. **Zero follow-ups was not success.** Seven of the eight option blocks offered
   a choice of *substitute work* (option 3 reliably "nothing more
   autonomously"), not the blocker decision. The real blockers stayed open
   across nine further rounds, during which the user pasted the identical
   "carry on autonomously" directive nine times, and then vanished from the
   conversation unresolved. The absence of a question was the absence of a
   decision.
4. **The mechanism is not exclusive.** That session's last handover that
   actually worked was prose without numbers.

The check also produced the finding this record is built on, which neither the
proposal nor the council had: **a well-formed option block resolves nothing
when its options are the agent's next task rather than the user's decision.**
Eight of eight option blocks drew a digit in reply. One of eight was a blocker
decision.

What the same session does establish, cleanly, is that a tool's output gets
carried into the reply verbatim. That is the lever: the agent does not need to
be forced to format, it needs to be handed the finished text.

## Decision

1. **`agent-config gates --reply`** renders the reply-close form: the single
   highest-unblocking user-owned blocker in full — what to do, and how you know
   it is done — and every other one as a count plus the command. `Status` and
   `Owner` are dropped; they are file metadata a reader of a reply cannot act
   on. **Empty output when nothing is owned by the user**, which makes "no
   blocker → no block" a property of the command rather than a judgement call,
   and makes the command safe to invoke unconditionally.

2. **`reply-close-mechanics` gains a blocker-handover section** stating the
   three obligations no renderer can carry: the options are the blocker
   decision and never a choice of substitute work; the action travels rather
   than a pointer to it; owner ≠ agent, or it is unfinished work to be done
   now.

3. **Roadmap blockers only.** Ad-hoc blockers — credentials, quota, a missing
   tool, a 5xx — are out of scope. The corpus contains none; all five follow-ups
   were roadmap-related. Building for them now would be scope taken on faith.

4. **One blocker in full, never a roster.** Directly against the observed
   "twelve decisions across two documents, ~850 lines", which produced no
   decision at all.

## Consequences

- The handover is **supplied**, not remembered. F11 ("the format was in front of
  me and I did not use it") is answered by delivery rather than by another
  instruction to remember.
- **No kernel edit, so one PR.** The kernel budget looked like a hard
  sequencing constraint (≤ 25 000 chars across five rules, own PR, ≥ 24 h soak).
  It turned out not to bind: `direct-answers` Iron Law 3 already routes to
  `reply-close-mechanics`, so the contract is reachable through a link that
  exists. Placing the body in the non-kernel file is not a workaround — it is
  where that file's own header says detail belongs.
- **Enforcement is honest and partial.** Emptiness-when-none is mechanical.
  *Calling* the command at reply-close is model-carried; nothing refuses a turn
  that skips it. Stating that is the point — the same corpus shows a contract
  nobody could observe being violated is a contract that reports itself as
  followed. The `stop` slot could refuse such a close; that is a maintainer
  decision and deliberately not taken here.
- **Bad blocker entries become visible.** One live entry's `What to do:` runs
  1 556 characters. The form does not hide it, and `mandated-lines` already
  names what that means: a line needing a paragraph is a line whose decision was
  not made. The renderer surfaces the entry's quality instead of padding over
  it.
- **The pull channel is unchanged.** `gates`, `gates --all`, `gates --json` keep
  their behaviour; `--reply` is a fourth projection over the same parser.

## Alternatives considered

- **A rule alone.** Rejected on F11/F12: the format existed in the same repo and
  the good shape appeared only *after* the user asked. Adding prose to a tree
  that already had the answer repeats the failure.
- **A blocking `stop` hook that refuses a blocker-less close.** The only
  mechanism that could enforce the call. Not taken now: no measurement yet
  distinguishes "was not delivered" from "was delivered and ignored", and a
  refusal built on the wrong one of those is a gate to fight. It is the named
  escalation if the review trigger fires.
- **A single line per blocker** (`Blocked: … Do: … Done when: …`). Measured
  against live data and rejected: real `What to do:` fields run 250, 253 and
  1 556 characters. Compressing them means either summarising (model-carried
  again) or pointing at the file — which is the failure being fixed.
- **Including ad-hoc blockers.** Rejected as unevidenced; see review trigger (b).

## References

- `src/agent-src/scripts/roadmap_gates.ts` — the renderer and the `--reply` form
- `src/agent-src/contexts/communication/rules-auto/reply-close-mechanics.md` — the contract
- `src/agent-src/templates/roadmaps.md` — the five-field blocker shape
- `src/scripts/lint_roadmap_blockers.ts` — the CI floor under it
- `src/agent-src/contexts/execution/mandated-lines.md` — the trailing-checklist ban this form answers
