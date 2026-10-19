---
proposed_by: claude-opus-5.5/drain-road-to-one-detector-and-the-senders-we-own-20261018b
implemented_by: claude-opus-5.5/drain-road-to-one-detector-and-the-senders-we-own-20261018b
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-18
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: b5014dbe36a252b3f241257a18468ab2862929faedce11601a8b0733d2fc445e
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — every credential consumer reads the one rule table

Covers branch `drain/road-to-one-detector-and-the-senders-we-own-20261018b`: steps 2.2
(the shared rule table), 2.2b (the egress engine as a conditional chunk) and 1.1 (the
credential-read guard) of `road-to-one-detector-and-the-senders-we-own`.

## Decision

The owner delegated delivery of this roadmap's machine-executable steps (ADR-237); the
ratification ladder of ADR-268 § 4 terminates here at the AI council, two providers, both
CLI seats. Classification, accepted from both seats in round 1: **authority-expanding** —
six credential rows join the table, so `secret_detector` and therefore
`check_secret_leak` can refuse shapes it passed before. That is why this record is
`ratified` and not `confirmed-non-expanding`. No consumer's policy for a hit changes, and
no consumer catches less than before the move.

## The gated surface

The ratification gate classifies eight files of this diff as gated:
`src/config/hook-bundle-budget.json`, `src/config/hook-latency-budget.json`,
`src/scripts/_lib/egress_engine.ts`, `src/scripts/_lib/egress_rules.ts`,
`src/scripts/hook_manifest.json`, `src/scripts/hook_manifest.yaml`,
`src/scripts/hooks/block_credential_reads.ts` and `src/scripts/hooks/egress_engine_loader.ts`.
The subject above is `ratification_subject` over the branch's whole changed-file list at
`f6c887efc` (the merge of origin/main onto `925e2da65`, the commit round 4c's tenth pass
reviewed; the merge touches no gated file). The hook bundle reads 1,543,028 B against its
unchanged 1,550,000 B ceiling; the egress chunk is 18,478 B of 28,000 B.

## The review — step 2.2, two rounds, both seats

Prompts: `agents/evidence/council/one-detector-shared-detection-review-20261018.question.md`
(round 1, reviewed `34824a346`) and
`agents/evidence/council/one-detector-shared-detection-review-20261018-r2.question.md`
(round 2, reviewed `35ee7a32f`). Quorum 2 of 2 through the CLI seats each round, nothing
billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `34824a346` | REQUEST_CHANGES | REQUEST_CHANGES |
| 2 | `35ee7a32f` | APPROVE | APPROVE |

Round 1 findings and their disposition, all closed in round 2 by both seats:

1. **High** — the council bundler masked an unproven key block (BEGIN and END labels
   differ) only through its header. Fixed by `maskingEnd`, the one masking extent every
   masking consumer reads; a drift-matrix test asserts no body survives in three
   consumers and was seen red with the bundler reverted.
2. **Medium** — the MCP config lint promoted the heuristic keyword assignment into its
   HIGH tier. Fixed: `hasInlineSecret` excludes it, recorded as an explicit policy
   exclusion in the drift matrix.
3. **Low** — token-start semantics were inferred from regex source text. Fixed: rows
   declare `tokenStart`, checked by a behavioural test that was seen red with the flag
   removed from one row.
4. Authority classification — accepted as expanding (above).
5. Test visibility — the legacy-superset suite was supplied in full in round 2.

Stances, in the seats' words:

- anthropic: "**APPROVE** — All five round-1 findings closed with centralized behavior,
  explicit metadata, and deterministic tests."
- openai: "**APPROVE** — the round-1 regressions are closed without introducing a
  demonstrated blocker".

The single highest-leverage change both seats named — direct table-driven tests for every
`maskingEnd` fallback branch — landed after round 2 as
`src/scripts/_lib/egress_masking_end.test.ts`, a test-only file that leaves the subject
unchanged.

The seat verdicts are transcribed by the implementing session; the council responses are
gitignored and not committed. The prompts are committed, so what was asked can be
checked; what was answered rests on this transcription.

## The review — steps 2.2b and 1.1

Every prompt is committed under `agents/evidence/council/` as
`one-detector-bundle-budget-20261018.question.md`,
`one-detector-engine-chunk-review-20261018.question.md` and
`one-detector-round4{a,b,b2..b5,c,c2..c10}-20261018.question.md`. Quorum 2 of 2 through the
CLI seats each round, nothing billed.

| Round | Subject | anthropic | openai |
|---|---|---|---|
| budget | how the egress engine leaves the bundle | options C+B | options C+B |
| 3 (attempts a–c) | engine chunk | timed out | timed out |
| 3 (attempt d) | engine chunk | REQUEST_CHANGES | REQUEST_CHANGES |
| 4a | engine chunk, round-3 fixes | REQUEST_CHANGES | REQUEST_CHANGES |
| 4b, 4b2–4b4 | loader failure policy, callers | REQUEST_CHANGES | REQUEST_CHANGES |
| 4b5 | loader failure policy, callers | APPROVE | APPROVE |
| 4c, 4c2–4c6 | credential-read guard (1.1) | REQUEST_CHANGES | REQUEST_CHANGES |
| 4c7 | credential-read guard | APPROVE with a documentation caveat | REQUEST_CHANGES |
| 4c8, 4c9 | credential-read guard | REQUEST_CHANGES | REQUEST_CHANGES |
| 4c10 | credential-read guard, reviewed `925e2da65` | APPROVE | APPROVE |

The timed-out attempts carried no verdict and count for nothing. Each REQUEST_CHANGES round's
findings were fixed test-first before the next round; every fix commit names the round. The
guard's findings were bypasses (copy and source of a credential file, wrapper commands, option
values, `env -S`, attached redirections, escapes and quote joins) and then false positives
(quote-blind escape reading, re-serialised words, and backslashes read as separators where the
host does not separate on them). The one stated conservative false positive the tenth pass
accepted: on a Windows host a redirection attached to the command word is judged with its
backslashes as separators, because `invokedSegments` has already stripped that word's quotes;
both seats named preserving quote metadata upstream as a later improvement, not a blocker.

Stances in round 4c10, in the seats' words:

- anthropic: "**APPROVE** ... The guard is ready to ratify."
- openai: "the remaining false positive is narrow and fail-safe ... **Stance:** APPROVE".

As above, the verdicts are transcribed by the implementing session; the prompts are committed.
