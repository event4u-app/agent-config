<!-- evidence-type: analysis -->
# Why work stops on blockers — 2026-10-20

Owner question: why does work so often stop on blockers, and which of them are
avoidable? Two read-only passes over the tree and the host transcripts, then a
two-seat council pass. Aggregates only: no prompt text or session id beyond the
one reproduction named in Phase 1 of
`agents/roadmaps/road-to-blockers-routed-before-they-are-filed.md`. Counts
marked ≈ are regex-classified (±10 %) or hand-classified; the rest are counted.

## A — Sessions (top-level transcripts, 2026-09-21..10-20)

71 transcripts exist (the request said 100); 11 one-turn harness probes and 4
sessions unrelated to the repository were dropped, leaving 56 sessions, 399 owner
turns and ≈327 points where the agent stopped and the owner had to reply.

| Class | Count | Sessions | Avoidable? |
|---|---:|---:|---|
| Owner questions / hand-backs | ≈166 | 35 | mostly — ≈60 roadmap or policy decisions the council could take; 16 commit/push/PR asks after "PR + merge" was already said; 14 merge-authority asks; 15 routed to the owner because the council was unavailable; ≈6 genuine paid-measurement decisions |
| Platform interruptions (usage limit, logged out, network) | 39 | ≈20 | no — external |
| turn-end-gate refusals | 184 | 38 | language 110 (103 false positives), verification 73 (unclassified), pending-decision 6 |
| Host auto-mode classifier denials | 45 | 19 | mixed |
| Repo guard denials (`block-no-verify` 19, inbox-dir guard 14) | 34 | ≈14 | mostly false positives |
| Premature turn ends (promissory close, ending while CI or lanes run) | 47 | ≈25 | yes |

- When the agent offered numbered options with a recommendation, the owner took
  the recommendation **86 of 91** times, 66 with a bare digit.
- 58 bare continuations ("mach weiter"): 39 after platform failures, 19 after the
  agent stopped although a standing order already answered the question.

## B — Roadmap blockers (131 files: 26 active, 105 in `later/`)

- 148 entries: **82 open**, 66 resolved (kept as history).
- **65 of 82** open entries sit in `later/`, which no routine sweep re-reads.
- **74 of 82** carry a human `Owner:` (maintainer 47, user 16, owner 11). The
  template offered only `user | maintainer | external`; the linter already
  treats `council` and `implementer` as non-human owners.
- Last two days: 10 blockers resolved, **all by the council** (2/2, $0.00),
  including all 7 labelled owner or maintainer; the owner resolved none.
- Sample of 15 open owner-labelled entries: 3 satisfied by the letter of their
  own `Resolved when` (2 genuinely — closed by Phase 3 — and 1 only because the
  file was parked), 7 council-decidable, 1 agent work, 2 genuinely the owner's,
  1 a calendar wait, 1 mixed.
- Hand estimate of the 82 by kind: waiting for data 21 · genuine owner decision
  19 · council-decidable but owner-labelled 16 · another roadmap 7 · a human
  must act 5 · CI/infra 4 · calendar 4 · already true 3 · plain agent work 3.

## C — One language-pin mechanism, reproduced

A subagent hand-back or cross-session message reaches `user_prompt_submit` as
`Another Claude session sent a message:` followed by the wrapper tag. The
synthetic-prompt filter anchored the tag at character zero, so the wrapper was
read as the owner's words: in the reproduced session the English pin (2,188
chars, 68 English markers) was written 149 ms after such a message, and the
German owner's replies were refused as wrong-language for the rest of the run.
This is in addition to the command-body class
`language-refusals-by-pin-source-2026-10-19.md` measured; the two overlap only
where a command-opened run also dispatched subagents.

## Council, 2026-10-20 (anthropic claude-sonnet-4-5 + openai codex-default, 2 rounds, $0.00)

Seven levers were put to it neutrally, with the owner-reserved table attached.

- **Agreed (2/2):** fix the language-pin mechanism first; fix the short `-n`
  guard misfire while keeping `commit -n` blocked; route human-owned blockers
  through the council at authoring time, fail-open when the council is down;
  run the backlog drain as a separate, auditable operation; do not add the
  sub-findings' percentages — the units (refusals, entries, stops) overlap.
- **Owner-reserved (openai; anthropic dissenting on the second):** letting a
  council "cancel" verdict execute `[-]`, and treating "create and merge the PR"
  as covering follow-up CI-fix commits. The second edits a kernel rule.
- **Deferred:** scheduling the drain (no measured rate to set a cadence from).
- **Missing levers named:** a reason code on every hand-back; classifying the
  73 verification refusals before changing that detector; workflow kinds
  (`waiting-data`, `calendar`, `dependency`) separate from decisions.
