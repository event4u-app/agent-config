<!-- evidence-type: analysis -->

# The #2455 release note is a breaking-change Pending row: second round

**Date:** 2026-10-19 · **Members asked:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 1/2 present — DEGRADED · **Prompt:** `hook-carrier-release-note-class-20261019.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")
**Prior round:** `setup-key-removal-release-class-20261018.md` (Part B), split `anthropic` B2 / `openai` B1

## What happened

- `anthropic` answered, "MIXED, leaning toward B1 (breaking)": a behaviour change
  that introduces new refusals is breaking by semver definition whatever its
  intent; "it was supposed to fail" explains why the change is made, not why it
  is not breaking. It named the counter-argument (a bug fix honouring a promised
  contract) and did not adopt it. It noted the cost is low because ADR-290 makes
  the next release a major anyway. Its answer did not end with the requested
  `CHOICE:` / `OWNER-ONLY:` lines; nothing in it requires a human action.
- `openai` did not answer: the codex CLI exited 1 within 5 s (its stderr tail is
  an MCP OAuth refresh failure for an unrelated server). A retry started the same
  morning found the seat marked unavailable before dispatch and would have
  re-asked only `anthropic`; it was stopped, because a second evaluation of the
  same subject by the same seat is verdict shopping, not a second seat.

## Reading

This round alone is not convergence (1/2). Taken with round one, **both seats'
latest answers are B1**: `openai` chose B1 on 2026-10-18 and was not contradicted
by any new input it saw; `anthropic` moved from B2 to B1 once told that the trailer
loss is fixed (#2479) and that the next release is a major regardless (ADR-290).
No seat now holds B2 or B3.

**Disposition:** B1 — a `BREAKING_CHANGES.md` "Pending" row naming
`block-no-verify`, `block-kernel-rule-writes` and `block-plumbing-writes`, landed
now; the release that carries it moves the row into its per-major table and
writes the `### Breaking` entry, as the file's own Pending contract states.

**Revisit if:** a full 2/2 round on the same prompt returns anything other than
B1, or the release that carries the row is cut as a minor.
