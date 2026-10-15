<!-- evidence-type: analysis -->

# A content handle: split on what it may replace, agreed on what it returns

AI council, 2026-10-15. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present before and after the run, blind peer review, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`tool-results-content-delivery-2026-10-15.question.md`. Raw response:
`agents/runtime/council/responses/tool-results-content-delivery-2026-10-15.md`
(local, gitignored). For `road-to-tool-results-that-leave-a-handle`, row D12.

## Verdict — split on the main question

- **openai — (b), conditionally.** Shorten only byte-identical content already
  delivered, and do not move past `observe` until the duplicate-byte saving is
  measured. *"Option (b) is the only policy that avoids guessing what matters
  … configuration values, comments, and implementation details may appear
  anywhere."* Its own strongest counter: the evidence does not show that
  repeated identical results carry meaningful volume, and the existing advisory
  hook may already suppress many repeats.
- **anthropic — (a), constrained, and "none of the options solve the stated
  problem".** (b) addresses an unmeasured problem (re-read frequency) while the
  measured one is large first reads. If forced: (a) only for very large code
  files with reliable symbol extraction, failing open for every other type. It
  proposed a 100 KB bound; no evidence was offered for that number.
- **(c) was chosen by neither seat.**

A split is not a decision. Neither (a) nor (b) is adopted by this record.

## Agreed by both seats

1. **The handle returns the bytes stored at delivery, never a re-read from
   disk.** openai: *"Re-reading by path creates a time-of-check/time-of-use
   mismatch and may return content that no longer matches the reference or
   digest."* anthropic: *"handles retrieve stored bytes, never re-read from
   disk."*
2. **Measure before building either.** Both name a missing reading: how many
   bytes are byte-identical repeats of content already delivered this session,
   after the advisory hook.
3. **The privacy view and the delivered view must match.** openai: a reference
   is permitted only when *"stored bytes == earlier model-visible bytes"*;
   otherwise decline the replacement or weaken the recoverability claim.
   anthropic: if the filter is lossy, "without losing anything" already fails
   in `protect`.
4. **"Already in context" is the wrong condition after compaction** (openai):
   the condition is "previously delivered this session and still recoverable
   by an immutable handle".

## What each seat said the options missed

- Identity over the exact delivered byte sequence plus digest and range, not
  path or whole-file digest (openai).
- Deterministic missing, expired and corrupted-handle failures, never a silent
  fallback to the current file (openai).
- Lossy first-read navigation, if ever wanted, as a separate, explicitly
  requested policy (openai); a model-requested outline mode (anthropic).
- Outlines only for file types with reliable structural extraction, fail open
  otherwise (anthropic).
