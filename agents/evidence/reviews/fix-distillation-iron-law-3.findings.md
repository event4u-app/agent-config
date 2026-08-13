# Findings: fix-distillation-iron-law-3

**Skipped:** no code surface for this completion — the branch changes four markdown files (a roadmap relocation, its successor, the archived predecessor and the regenerated dashboard) and no executable path, scope a575a47661fc8e64481a57d080c7599b90ef7cc42f51ed7eb187276d6a405eb1, declared 2026-08-13

## Why a skip is honest here rather than convenient

The gate's own count is the evidence: **0 code paths of 4 changed files.** There
is nothing a fresh reviewer could execute, and the R2 review's value is that its
findings are probed rather than read.

What *would* have deserved a review, and was verified by other means instead:

- **The relocation loses nothing.** Both blockers are carried into the successor
  with `What to do` and `Resolved when` unchanged, and the deferred step's
  reasoning is quoted rather than summarised.
- **`Status: resolved` is not a claim that the questions were answered.** Both
  blocker bodies say in those words that it means discharged *for that roadmap*,
  with the open question owned in the successor.
- **The links resolve.** Eleven outbound links broke when the archival sweep
  moved the file one directory deeper. Every relative link in both files was
  resolved against the filesystem, not read by eye — the first check matched two
  path prefixes and missed a `../../docs/` link, so it was widened before its
  green was believed.
- **The roadmap gate is green**, which is the observable this branch exists to
  produce: `roadmap:progress-check` reports the dashboard up to date with no
  Iron-Law-3 and no pending-archival findings.
