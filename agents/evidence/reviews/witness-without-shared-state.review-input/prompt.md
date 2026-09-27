# Reviewer prompt — verbatim, as issued

Dispatched to a fresh subagent with no prior context on this change: it had not seen the
implementer's reasoning, the roadmap, or any expectation about the outcome. Recorded here
because `evaluator-independence` § "A self-commissioned review is admissible as gate evidence
only when the prompt is recorded alongside the verdict" makes the prompt part of the evidence,
not a footnote to it.

```text
You are reviewing a single git commit diff in the repository at
<repo root>

Read this file first — it is the full diff of one commit, touching exactly one file:
<scratch>/witness_diff.patch   (committed here as ./diff.patch)

The changed file is tests/scripts/witness/reach_doctor_readonly.test.ts — you may also read
its current (post-diff) content directly from the repo at that path, and read
src/scripts/reach_doctor.ts and the other files under src/scripts/ that the test's
REACH_SOURCES constant names, if you want to verify any claim the diff's comments make about
them.

An automated gate in this repository (check_test_weakening) flagged this diff: it computes
that the test file's assertion count went down net (not just line-level +/-, an actual count
of assertion-shaped lines removed vs added), and such a net decrease requires an independent
reviewer's verdict before it can be treated as legitimate.

Your task: determine whether this diff is a legitimate re-architecture of the test (removing an
old, unreliable instrument and compensating with different/better instruments and coverage) or
whether it silently weakens the test's overall claim ("the reach:doctor CLI command mutates
nothing in the git worktree") by dropping coverage that mattered, without adequate replacement.

Do not assume either answer going in. Specifically check:

1. What exactly got removed (functions, assertions, an entire test case) and why the diff's own
   comments say it was removed.
2. What got added to compensate, and whether it actually covers the same failure modes the
   removed code covered, or a narrower/different set.
3. Whether the diff's own stated rationale is internally consistent and technically accurate —
   verify any factual claim you can check against the actual source files (e.g. a claim that a
   command contains no filesystem write primitive, or that a particular directory is gitignored).
4. Whether any REAL coverage gap was introduced that a reviewer should flag as a genuine
   regression, even if minor.

Run the actual test suite for this one file if that helps you verify anything (from the repo
root: `npx vitest run tests/scripts/witness/reach_doctor_readonly.test.ts`).

Report your findings as a short table: severity (high/medium/low, or none) | finding | your
reasoning. End with one explicit verdict line: either "VERDICT: legitimate re-architecture,
adequate replacement coverage" or "VERDICT: weakening — coverage gap found" (state which), or a
qualified verdict if genuinely mixed. Keep your report under 400 words. This is an independent
review — report what you actually find, not what would be convenient.
```

## What the prompt deliberately does not contain

No expectation of the outcome, in either direction — no "this should be clean", no "I believe
the removal is justified", no "just confirm". `evaluator-independence` § The softer form treats
a stated expectation as authoring the verdict even when it names no verdict, so the scope is
the whole diff and the question is open on its face. Both outcome strings are offered
symmetrically, and the reviewer was told in the same sentence that a qualified verdict is
available — a two-option forced choice is its own kind of steer.

The scope was not narrowed by the implementer either: the reviewer received the entire commit,
not a chosen subset of it, plus standing permission to read the production sources and run the
suite itself rather than trusting the diff's own claims about them.
