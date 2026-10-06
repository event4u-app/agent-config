---
complexity: lightweight
review_by: 2026-12-31
---

# Stub: review inputs out of the hot tree

> **Arrivals:** 1 — latest `inbox-2026-10-e` (2026-10-06), where two release
> reviews of 16.3.0 name the committed review inputs as the largest single
> source of the release's line count and ask for content-addressed storage
> with only a manifest, the findings and the hashes kept in the tree.

> **Stub — not active work.** Decision-gated: the move reopens a recorded
> decision, and the venue for that is the council before any step is written.

## What moved here

Measured at `main` @ `a75bb3210` on 2026-10-06:

- 16.2.0..16.3.0 touched 790 files; 223 of them sit under `agents/evidence/`,
  and 151,749 of the 206,871 inserted lines are evidence (`git diff --shortstat`).
- The tree holds 641 review-input files, about 30 MB of the 41 MB under
  `agents/evidence/`; the largest single `diff.patch` has 29,167 lines.
- The evidence-temperature reading
  (`agents/evidence/analysis/evidence-temperature-2026-10-05.md`) counts 1,036
  files inside the scan roots of gates, which keeps them hot by construction.

## The lock, and why it may not apply

`agents/roadmaps/archive/road-to-an-evidence-tree-with-a-cold-half.md` decided
(D1, council 2026-10-01) that there is no cold location, after testing the move
of UNREFERENCED files. This proposal moves files a gate DOES enumerate and
replaces them with a manifest the gate verifies by hash — a different
mechanism. The review-input type is `permanent` in
`docs/contracts/evidence-artifact-types.md`, and evaluator independence item 3
requires the prompt package to be recoverable, so any answer must keep the
bytes reachable by hash.

## What would promote it

A council verdict on one question: may a gate-enumerated review input be
replaced in the tree by a manifest entry plus a content hash, with the payload
held as a release artifact, given that D1 tested a different mechanism? A yes
becomes a roadmap whose first step is the gate-reader change; a no is recorded
here with its `revisit-if` and the stub is archived.
