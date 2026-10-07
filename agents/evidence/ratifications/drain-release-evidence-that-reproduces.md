---
proposed_by: claude-code drain lane, road-to-release-evidence-that-reproduces (2026-10-07)
implemented_by: claude-code drain lane, road-to-release-evidence-that-reproduces (same session)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai), round 4 of 4, 2026-10-07
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/road-to-release-evidence-that-reproduces-20261007`

The header above was printed by `ratification_header` from the two seats' final
verdicts, which is the mechanism this change adds; it is the first artifact
written under it.

## What was proposed

Step 3.1 of `road-to-release-evidence-that-reproduces`. The gated surface is the
ratification reader itself (`src/scripts/_lib/ratification_artifact.ts`): a
required `seats:` map (provider to that seat's final verdict), a writer
(`src/scripts/ratification_header.ts`) that derives `providers` and `verdict`
from it, and reader refusals when the recorded header differs from that
derivation. Nothing else in this PR touches a surface `check_kernel_edit_ratified`
gates.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` are the same session, so the review is the AI
council: two providers, neither the author. Every round was shown the complete
diff of the gated files against the base, never a description of it; each
prompt package is committed verbatim under `agents/evidence/analysis/`
(`release-evidence-seats-ratification-prompt.md`, `-r2.md`, `-r3.md`, `-r4.md`).
The prompts state the question and the earlier rounds' points; they state no
expected outcome.

## What the review changed

- **Round 1 — both seats REQUEST_CHANGES, both `confirmed-non-expanding`.** A
  present-but-malformed `seats:` read as absent; the header was checked for two
  contradictions but not for equality with its derivation; provider ids were
  rendered unescaped into YAML; trimmed keys could collide; whitespace ids passed
  the writer. All fixed: fail-closed parsing, a provider-id grammar at writer and
  reader, a duplicate-seat refusal, an exact-equality check
  (`header-not-derived`), and a test per case.
- **Round 2 — anthropic no defects; openai REQUEST_CHANGES.** `seats:` was
  optional, so an author could still free-write the header. Fixed: `seats:` is
  required (`no-seats`). The gate reads only the artifacts in the diff, so merged
  artifacts are not re-read and are not migrated. One openai attempt failed on
  transport (`ENOBUFS`) and was re-run; the failed attempt is not counted.
- **Round 3 — one seat present (openai transport failed again).** The anthropic
  seat raised a quoted-key duplicate. Measured: this repository's frontmatter
  parser keeps quotes in a key, so `"openai":` already failed the provider-id
  grammar. The duplicate scan now compares keys as a YAML parser would, and a
  test pins the duplicate refusal itself (seen red with the normalisation
  removed). Round 3 is not counted as a verdict: it was degraded.
- **Round 4 — 2/2 present, both `confirmed-non-expanding`.** anthropic: no
  defects. openai: REQUEST_CHANGES on two points. (a) A repeated comment line
  inside `seats:` read as a repeated seat — fixed, with a test seen red. (b) The
  `seats:` entries are themselves author-written, so the mechanism binds the
  header to the recorded seats without authenticating them. That is true and is
  not closed here: council responses are gitignored and pruned, so no runner
  could check a seat against them. The contract now says so in a "What this does
  NOT establish" paragraph rather than claiming more. Closing it is a follow-up,
  recorded in the PR as owner residue.

## Classification

Both seats, every round: `confirmed-non-expanding`. The change adds refusals and
grants no action; an artifact that passed before can now fail, never the
reverse.

## Dispositions the seats were asked about

Round 4: `541a64c5b619` `still_open` from both seats (prompt construction is not
in this diff). `2c9959f7262d` and `13568e8fe68a`: anthropic `fixed` (the
mechanism is closed going forward), openai `still_open` (the named artifacts are
unchanged). Recorded as `still_open`, the reading both seats share for the named
artifacts.
