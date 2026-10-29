---
proposed_by: owner answer OQ-25 (2026-10-28), road-to-the-question-only-the-owner-can-answer-carried step 3.1
implemented_by: claude-opus-5.5 session on feat/owner-answers-oq21-27
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 3 of 2026-10-28
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 41caab4015ce1a9f9cc224f4d148b0f86dca1e4035ce0751a6aed1401841ecd2
---

<!-- evidence-type: ratification -->

# Ratification — the `intake-pass` concern and its bundle-budget row

`check_kernel_edit_ratified` gates three hook-plumbing files on this branch:
`src/config/hook-bundle-budget.json`, `src/scripts/hook_manifest.yaml` and its compiled
projection `src/scripts/hook_manifest.json`. The `subject:` digest covers all three, computed
with `./scripts-run src/scripts/ratification_subject --files <the three>` at revision
`36bd8fb5bd`, which is the revision round 3 reviewed; no gated file changed after it. The
header is the output of `ratification_header --seat anthropic=ratified --seat openai=ratified`.
It is typed rather than rendered by `ratification_record`, because the round-3 prompt asked for
a `VERDICT:` line and not the `STANCE:` line that renderer parses; the two seat verdicts are
copied from the round-3 replies, below. A fourth evaluation only to change the line format was
not run.

## What was ratified

- **A new concern `intake-pass`** (`src/scripts/hooks/intake_pass_hook.ts`), `severity:
  advisory`, `effect: context`, `fail_closed: false`, on `user_prompt_submit` of every platform
  that binds the slot, dropped for worker sessions. On a prompt it classifies as a task it emits
  one self-contained context line naming the intake pass; it never rewrites the prompt and never
  blocks. Kill switch `AGENT_CONFIG_NO_INTAKE_PASS=1`. Owner decision OQ-25: shipped, on by
  default, no settings key, and the agent decides whether a gap is owner-owned.
- **The classifier's deliberate boundaries.** A question (last sentence ends in `?`, or the first
  word is interrogative) is silent, including a polite request phrased as a question, per the
  rule `question-not-instruction`; a resume order is silent at any length.
- **`max_bytes` 1,556,670 → 1,556,764** with a `raise_log` entry: the body ships as a lazy chunk,
  so the dispatch bundle grows by the one `LAZY_CONCERNS` row (+94 B); the base sat 1 B under its
  ceiling. A chunk ceiling of 10,800 B over a measured 9,807 B.
- **The cost, named in the manifest:** the chunk loads and the classifier runs on every prompt;
  a task prompt adds about 470 B of context on every bound host; a false positive may prompt one
  unneeded owner question.

## How it got here

Three rounds, CLI subscription transport, USD 0.00. Prompts committed verbatim:
`agents/evidence/council/intake-pass-concern-ratification-r{1,2,3}-20261028.question.md`.

- **Round 1 — refused, both seats.** The compiled manifest was missing from the review diff;
  the question test read only a trailing `?`; a leading "go ahead" silenced a task; the release
  vocabulary was narrow; the injected line pointed at a file path. All fixed in `34613b01b5`.
- **Round 2 — refused, both seats, on the record only.** No code defect; the cost comment did not
  say the chunk loads and the classifier runs on every prompt. Fixed in `36bd8fb5bd`.
- **Round 3 — ratified, both seats.** Closing lines, verbatim: anthropic `**VERDICT: ratified**`;
  openai `VERDICT: ratified`. Both asked for two tests pinning a classifier boundary (an
  interrogative start followed by an instruction; a resume prefix carrying a further task); added
  after the round in `tests/hooks/intake_pass_hook.test.ts`, which is not a gated file.

## What this record does not establish

The seat verdicts above are typed by the implementing session. Council responses are gitignored
and pruned; the committed prompts and the quoted closing lines are what a reader checks them
against.
