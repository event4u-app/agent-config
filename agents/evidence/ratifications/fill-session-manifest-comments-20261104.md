---
proposed_by: road-to-a-fill-the-session-sees-coming step 1.4
implemented_by: claude-opus-5.5 session on feat/road-to-a-fill-the-session-sees-coming
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 5 of 2026-11-04
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: c58b57a00e267fe854d6e8e208ae801ec0f2fd2066fc7bda74aedb5d822f85bc
---

<!-- evidence-type: ratification -->

# Ratification — manifest comment corrections

`check_kernel_edit_ratified` gates two files on this branch: `src/scripts/hook_manifest.yaml`
and its compiled projection `src/scripts/hook_manifest.json`. The `subject:` digest covers both,
computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `504868fe4d`. The header is the output of
`ratification_header --seat anthropic=confirmed-non-expanding --seat openai=confirmed-non-expanding`.

## What was ratified

- **Two manifest comments corrected (step 1.4).** `quota-notice` said "one per session at 80 %
  context fill"; it has emitted a context line per prompt at or above the band since
  `road-to-a-memory-that-arrives` 2.1. `turn-end-gate` said "FIVE detectors"; `DetectorId` carries
  six. Comments only: no parsed key changes, and `hook_manifest.json` differs in its source-text
  `fingerprint` alone — its `body_fingerprint` over the parsed manifest is identical.
- **No budget raise.** Rounds 3 and 4 also reviewed a `max_bytes` raise in
  `src/config/hook-bundle-budget.json` for the code of steps 2.1 and 2.2. origin/main then moved
  the self-repair concern out of the dispatch bundle; on the merged branch the gate measures
  1,562,807 B against origin/main's 1,585,000 B ceiling, so the raise was withdrawn and the file
  is byte-identical to origin/main.

## How it got here

Five rounds, CLI subscription transport, USD 0.00. Prompts committed verbatim:
`agents/evidence/council/fill-session-manifest-comment-ratification-r1-20261104.question.md`
through `…-r5-20261104.question.md`.

- **Round 1, both `confirmed-non-expanding`** on the YAML diff. `check_generator_sync` then
  required the compiled JSON to be regenerated, which changed the gated set.
- **Round 2, split:** one seat approved on the identical `body_fingerprint`; the other asked for
  the YAML diff in the same prompt rather than by reference to round 1.
- **Round 3, both `confirmed-non-expanding`** on the complete diff of both manifest files.
  `check_hook_bundle_composition` then failed, and a budget raise joined the set.
- **Round 4, both `ratified`** on all three gated files.
- **Round 5, both `confirmed-non-expanding`** on the two manifest files after the merge with
  origin/main removed the raise. Transport: the openai seat first failed on a ChatGPT usage
  limit (reset 07:25 CET); after the reset the council's codex transport still returned `exit_1`
  with an empty stderr while `codex exec` answered directly. The openai verdict was therefore
  taken by running the committed round-5 prompt unchanged through `codex exec`; the anthropic
  verdict is the council seat's. Both readings of the prompt by codex returned the same verdict.

Residuals named by seats and not built: "every prompt" in the manifest comment is more precisely
"once per prompt key"; the JSON `fingerprint` suffix is a JavaScript string length, not a byte
length (the round-2 and round-5 prompts said "byte length").
