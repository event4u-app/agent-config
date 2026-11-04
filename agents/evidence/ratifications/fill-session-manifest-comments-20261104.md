---
proposed_by: road-to-a-fill-the-session-sees-coming step 1.4
implemented_by: claude-opus-5.5 session on feat/road-to-a-fill-the-session-sees-coming
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 3 of 2026-11-04
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: c58b57a00e267fe854d6e8e208ae801ec0f2fd2066fc7bda74aedb5d822f85bc
---

<!-- evidence-type: ratification -->

# Ratification — two comment corrections in the hook manifest

`check_kernel_edit_ratified` gates two hook-plumbing files on this branch:
`src/scripts/hook_manifest.yaml` and its compiled projection `src/scripts/hook_manifest.json`.
The `subject:` digest covers both, computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`
at revision `e975afaefe`. The header is the output of
`ratification_header --seat anthropic=confirmed-non-expanding --seat openai=confirmed-non-expanding`.

## What was reviewed

- The `quota-notice` comment said "one per session at 80 % context fill"; the hook has emitted a
  context line on every prompt at or above the band since `road-to-a-memory-that-arrives` 2.1. The
  comment now says so and names where the band lives (`CONTEXT_NOTICE_PCT`, `_lib/pressure.ts`).
- The `turn-end-gate` comment said "FIVE detectors"; `DetectorId` carries six since `untested`
  joined. The comment now lists all six.

Comments only: no binding, script, argument, severity, effect, `fail_closed` value or other parsed
key changes. `hook_manifest.json` changes in its `fingerprint` alone (sha256 and length of the YAML
text, comments included); its `body_fingerprint` over the parsed manifest is identical.

## How it got here

Three rounds, CLI subscription transport, USD 0.00. Prompts committed verbatim:
`agents/evidence/council/fill-session-manifest-comment-ratification-r1-20261104.question.md`
through `…-r3-20261104.question.md`.

- **Round 1, both `confirmed-non-expanding`** on the YAML diff. `check_generator_sync` then
  required the compiled JSON to be regenerated, which changed the gated set and its digest.
- **Round 2, split:** one seat approved on the identical `body_fingerprint`; the other asked for
  the YAML diff in the same prompt rather than by reference to round 1.
- **Round 3, both `confirmed-non-expanding`** on the complete gated diff of both files in one
  prompt.

Residuals named by seats and not built: both suggested "once per prompt key" as more precise than
"every prompt" (the dedup key exists so a double hook run prints one line); the history clause
("Two", then "FIVE") is not verifiable from the facts the prompt supplied. Neither is a runtime
defect, and editing the text would invalidate the reviewed digest, so the text stands as reviewed.
