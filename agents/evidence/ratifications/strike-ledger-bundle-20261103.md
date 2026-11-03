---
proposed_by: road-to-a-strike-the-session-keeps 3.2 (round inbox-2026-11-m, owner directive 2026-11-03)
implemented_by: claude-opus-5.5 session on analysis/inbox-2026-11-strike
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 1-7 of 2026-11-03
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 139be6984907f497e2872b5ae19b3c1b6230b58b091ab1ebf4b22d2ba0616ab5
---

<!-- evidence-type: ratification -->

# Ratification — hook-bundle ceiling raised for the shadow strike ledger

`check_kernel_edit_ratified` gates one hook-plumbing file on this branch:
`src/config/hook-bundle-budget.json`, whose `max_bytes` goes from 1,567,400 to
1,578,600 with a `raise_log` entry. The `subject:` digest covers it, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `97cfe64cd1`, the commit round 7 reviewed. The header is the output of
`./scripts-run src/scripts/ratification_header --seat anthropic=ratified --seat openai=ratified`.

## What the raise pays for

The verification recorder (`src/scripts/before_complete_hook.ts`) hands the run
record it appends for an event, and the full command, to a shadow strike ledger
(`src/scripts/_lib/strike_ledger.ts`, `strike_ledger_io.ts`) at the gitignored
`agents/state/strike-ledger.json`. Nothing reads it back to the model, a gate or a
decision path. 8,898 bytes of the raise are the ledger; 2,015 bytes are base
overage the trunk carried before this branch, attributed by commit in the
`raise_log` entry.

## The rounds

Prompt packages are committed beside this record:
`agents/evidence/council/strike-ledger-bundle-ratification-r{1..7}-20261103.question.md`.
Each was neutral — it named what changed, never an expected outcome.

| Round | anthropic | openai | What the round found, and what changed |
|---|---|---|---|
| 1 | confirmed-non-expanding | request-changes | entries cast not rebuilt; edits counted root-wide; observed run inferred; lock could delay the recorder; base overage unattributed → all fixed |
| 2 | refused | request-changes | recency did not prove which event appended a run; edit counters unbounded → recorder hands over the appended record; TTL and caps |
| 3 | refused | request-changes | counter evicted while its entry lived; caps exceeded after insert → owned counters kept, prune after fold |
| 4 | refused | request-changes | prune-after-fold revived expired streaks → expire before the fold, cap after |
| 5 | refused | request-changes | target key from the 512-char, whitespace-normalised copy → full command, unchanged |
| 6 | ratified | approve | asked for the exact headroom (287 B, not "about 500") and a recorder-isolation test → both done |
| 7 | ratified | approve | confirmed the text-only change |

Every defect a round named has a regression test that was seen red under
mutation before it was accepted as fixed.

**openai's verdict word.** In rounds 6 and 7 the openai seat closed with
`APPROVE` instead of the requested verdict line. It is recorded as `ratified`
because APPROVE is the affirmative answer to question 1 and the seat named no
remaining defect; this is the author's mapping, stated so a reader can reject it.

## What this does not establish

Both seats noted they could not verify the bundle measurements or the test
results from the prompt alone; they are the author's, reproducible with
`npm run build:hooks` and `npx vitest run tests/scripts/strike_ledger*.test.ts`.
Council responses are gitignored and pruned, so the seat verdicts above are this
author's transcription.
