<!-- evidence-type: analysis -->

# A released-surface fixture modified outside a cut — the single-writer repair

**Date:** 2026-10-22 · **Members:** `anthropic`, `openai` (CLI transport, nothing billed) · one round
**Prompt:** `single-writer-20261022.question.md`, beside this file.

## Verdict — convergent on option A

Both seats chose (A): remove `egress.placeholders.mode` from the fixture now, so
a file stamped `16.5.0` no longer claims a key tag 16.5.0 never shipped, and
record #2449 (`3a9b54d4c`) as the one historical non-cut write. Option (B) was
rejected by both: it leaves knowingly false release evidence in place until the
next cut.

## The removal is itself a non-cut writer

Both seats said yes, and both rejected naming it by sha, which a squash merge
makes unknowable in advance. Both proposed recognising it by content. The seats
differed in breadth, and the stricter reading was implemented:

- one seat allowed any commit whose result is byte-identical to a tagged
  release's fixture;
- the other restricted it to **one exact blob transition** — before-blob is the
  offender's blob, after-blob is the blob before the offender — and explicitly
  rejected a general "restoring a released state is allowed" rule as a
  permanent second writer class.

Implemented: the transition rule, with both blobs derived from the one
recorded offender, and each exception (offender, repair) asserted to match
**exactly once**. The exception list's length is pinned at 1.

## What must not weaken

Both seats: the exact two-file `writeReleasedSurface(` caller set, and "every
fixture-modifying commit is a package-version cut or an exactly-asserted
recorded exception". Both kept.

## Shallow history — in scope

Both seats put it in scope; they differed on shape (a warning plus a separate
full-history job, versus a full-history CI run where missing history fails).
Implemented the stricter: a step in `rule-backstops.yml` (full checkout) runs
the test file with `RELEASE_SURFACE_REQUIRE_HISTORY=1`, under which missing
history throws instead of skipping. Elsewhere the skip condition is now named
and deliberate — history does not reach the offender's parent — rather than
any `git log` error. The repository's shallow flag was tried as the condition
and rejected: a grafted local clone is shallow yet holds every commit the
check reads, and the flag silently skipped the check there.

## Sensitivity

A temporary commit appending a newline to the fixture without touching
`package.json` turned the test red, naming that commit's sha; dropping the
commit turned it green. The probe was not committed.
