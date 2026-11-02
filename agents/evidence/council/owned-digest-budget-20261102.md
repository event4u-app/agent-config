<!-- evidence-type: analysis -->

# Council record — owned-digest token budget (2026-11-02)

**Question:** `agents/runtime/council/owned-digest-budget-20261102.question.md`
(promoted here because runtime council files are gitignored and pruned).
`generate_owned_digest` rendered just under its 10,000-token budget on
origin/main; one new `later/` roadmap and one new stub put it at 10,052. Options:
(A) raise the budget with a reason and a revisit condition · (B) shorten other
roadmaps' goals · (C) drop the stub and shorten the new rows (still ~28 over, so
also B) · (D) a terser renderer for every row.

**Members:** anthropic, openai — 2/2 present after the run. Mode `design`.

**Verdict:** (A). Both seats: the digest is a view, not a constraint; B edits
unrelated files, C hides a cross-reference the digest exists to carry, D trades
precision on every row for a round number.

**Dissent / refinement:** both seats rejected vague revisit triggers ("~105
roadmaps", "noticeable latency"). Adopted: revisit when the digest renders above
10,000 again, and at that point split it into a triage index and a human
summary instead of raising a second time.

**Applied:** `BUDGET_TOKENS = 10_500` in `src/scripts/generate_owned_digest.ts`,
with this record cited beside it.
