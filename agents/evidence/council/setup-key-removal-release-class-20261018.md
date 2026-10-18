<!-- evidence-type: analysis -->

# Key-removal timing and the #2455 note: split on both parts

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `setup-key-removal-release-class-20261018.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")

## Verdict — no convergence; nothing is decided

| Seat | Part A (Phase 4 timing) | Part B (#2455 note) | Owner-only |
|---|---|---|---|
| `anthropic` | **A2** — hold Phase 4 until a major is cut for another reason (the Node floor), land both together; A1 as fallback if no major comes within a reasonable window | **B2** — not breaking (no right to bypass a safety guard); a `notice`, recovered by a manual release-head line naming the three guards | no |
| `openai` | **A1** — land when ready; waiting for an unrelated major creates indefinite coupling | **B1** — a `BREAKING_CHANGES.md` Pending row now: some upgrades move from silent success to refusal, which is observable backward incompatibility | no |

Under the delegation a split is not a resolution, so both parts stay open. What
the two seats share, and what the next round would start from:

- **Phase 4 ships as a major** whatever its timing — neither seat questions the
  `what-a-minor-may-remove` reading. The disagreement is only coupling versus
  independence. The node-floor question of the same sweep resolved 2/2 to a
  semver-major (ADR-290), which removes A2's main uncertainty — whether another
  major is coming at all; that is new input for a second round, not a decision.
- **#2455 needs a note in the next release** — both seats; they split on its
  class (behaviour notice versus breaking) and therefore on its home (the
  curated release head versus a `BREAKING_CHANGES.md` Pending row).
- **The squash-trailer loss is a release-tooling defect** — both seats.

## The defect both seats named

Measured 2026-10-18 by running `parse_impact_trailers` over the first-parent
span `16.5.0..origin/main` (161 commits): 5 squash commits carry
`Consumer-Impact:` lines only inside inner paragraphs, because the squash body
GitHub writes ends with a `Co-authored-by:` paragraph and the parser reads the
final paragraph only. Two of the five carried `notice`: `3f8c98e74` (#2455) and
`3245c7e7c`. As the tree stands, the next release records neither notice.
