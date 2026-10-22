<!-- evidence-type: analysis -->

# How eight egress-refused test files are covered by the 17.0.0 self-review

**Date:** 2026-10-22 · **Members:** `anthropic`, `openai` (CLI transport, nothing billed) · one round
**Prompt:** `release-17-egress-refused-review-20261022.question.md`, beside this file.

## Verdict — convergent on option 1, a redacted external review

Both seats chose option 1. Option 2 (in-session review) gives up reviewer
independence; option 3 (a recorded gap) breaks "every in-scope file reviewed";
option 4 (lowering the guard) disables the control exactly for the files built to
exercise it.

## The conditions both seats attached, and how they were met

- **Redact before the vendor CLI sees anything, then rescan.** `--redact-egress`
  replaces every detected value through `CouncilEgress.replace()` before the
  request is built, and the client's own `check()` still runs on the final
  payload before the spawn.
- **A redaction defect must not leak.** The first redacted run was refused by
  that final check: a fixture password the rules saw in one place stood bare on
  another line. `replace()` now substitutes every occurrence of a detected value,
  pinned by a test that fails without the fix — the check worked as the backstop
  it is meant to be.
- **Tell the reviewer what the tokens are.** The request opens with a note that
  credential-shaped literals were replaced by typed placeholders and are not
  findings.

## Result

All 8 files reviewed in one request, 4 findings (1 medium claim, 3 low), none
blocking.
