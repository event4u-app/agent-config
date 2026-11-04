---
proposed_by: road-to-a-fill-the-session-sees-coming step 1.4
implemented_by: claude-opus-5.5 session on feat/road-to-a-fill-the-session-sees-coming
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 1 of 2026-11-04
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: 4151d470f9c0a14c2444c85d5cb2a756369c81bedc57a781fcfef23ff036875f
---

<!-- evidence-type: ratification -->

# Ratification — two comment corrections in the hook manifest

`check_kernel_edit_ratified` gates one hook-plumbing file on this branch:
`src/scripts/hook_manifest.yaml`. The `subject:` digest covers it, computed with
`./scripts-run src/scripts/ratification_subject --files src/scripts/hook_manifest.yaml --base-ref origin/main`
at revision `f238c5ab69`. The header is the output of
`ratification_header --seat anthropic=confirmed-non-expanding --seat openai=confirmed-non-expanding`.

## What was reviewed

- The `quota-notice` comment said "one per session at 80 % context fill"; the hook has emitted a
  context line on every prompt at or above the band since `road-to-a-memory-that-arrives` 2.1. The
  comment now says so and names where the band lives (`CONTEXT_NOTICE_PCT`, `_lib/pressure.ts`).
- The `turn-end-gate` comment said "FIVE detectors"; `DetectorId` carries six since `untested`
  joined. The comment now lists all six.

Comments only: no binding, script, argument, severity, effect, `fail_closed` value or other parsed
key changes. `hook_manifest.json` is byte-identical.

## Round 1

One round, CLI subscription transport, USD 0.00. Prompt committed verbatim:
`agents/evidence/council/fill-session-manifest-comment-ratification-r1-20261104.question.md`.
Both seats answered `confirmed-non-expanding` and found no parsed-key change.

Residuals named by seats and not built: both suggested "once per prompt key" as more precise than
"every prompt" (the dedup key exists so a double hook run prints one line); the history clause
("Two", then "FIVE") is not verifiable from the facts the prompt supplied. Neither is a runtime
defect, and editing the text would invalidate the reviewed digest, so the text stands as reviewed.
