---
proposed_by: claude-opus-5.5/drain-road-to-one-detector-and-the-senders-we-own-20261018b
implemented_by: claude-opus-5.5/drain-road-to-one-detector-and-the-senders-we-own-20261018b
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-18
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: fc6c5632f1024f46a88626186f2168833619c86df1cb6e38eaa843d2c62ee935
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — every credential consumer reads the one rule table

Covers branch `drain/road-to-one-detector-and-the-senders-we-own-20261018b`, step 2.2 of
`road-to-one-detector-and-the-senders-we-own`.

## Decision

The owner delegated delivery of this roadmap's machine-executable steps (ADR-237); the
ratification ladder of ADR-268 § 4 terminates here at the AI council, two providers, both
CLI seats. Classification, accepted from both seats in round 1: **authority-expanding** —
six credential rows join the table, so `secret_detector` and therefore
`check_secret_leak` can refuse shapes it passed before. That is why this record is
`ratified` and not `confirmed-non-expanding`. No consumer's policy for a hit changes, and
no consumer catches less than before the move.

## The gated surface

The ratification gate classifies one file of this diff as gated,
`src/scripts/_lib/egress_rules.ts` (hook-plumbing source: the dispatcher's egress stage
bundles it). The subject above is `ratification_subject` over the branch's whole
changed-file list at `35ee7a32f`, the commit round 2 reviewed. The hook bundle reads
1,546,845 B against its unchanged 1,550,000 B ceiling.

## The review — two rounds, both seats

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
