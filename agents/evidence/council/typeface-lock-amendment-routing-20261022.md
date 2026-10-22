<!-- evidence-type: analysis -->

# Did the 2026-10-16 typeface-lock amendment need owner authorization?

**Date:** 2026-10-22 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `typeface-lock-amendment-routing-20261022.question.md`, beside this file
**Raised by:** 17.0.0 release finding `341079d844b6` (release council: fix before the cut)

## Verdict — SPLIT (A / B), escalated

`anthropic` classed the transition council-routable (A); `openai` classed it
owner-reserved (B). Under `decision-revisit-gate` a split is an escalation
condition, so the classification is an open OWNER decision. Applied meanwhile,
fail-closed: the amendment's effect is suspended — the three committed typeface
binaries are removed from the tree, `tests/fixtures/fonts/fixtures.json`
records the suspension, and the bound test requires the binaries ABSENT until
an owner authorization record is named there. The pinned upstream commit and
SHA-256 per family stay, so lifting the suspension restores byte-identical files.

## Seat answers, verbatim

### `anthropic`

**Answer: (A)**

**Decisive reason**: The consumer-facing licensing commitment ("no typeface binary reaches consumers through any distribution channel") remains mechanically enforced, and committing OSI-licensed test fixtures to the repository creates no new licensing burden because OSI approval inherently authorizes redistribution—the licenses themselves permit exactly this use.

**Record sentence**: "This transition was council-routable because it clarifies scope without weakening the licensing commitment: the consumer-facing prohibition ('no typeface binary in any published artefact') remains mechanically verified via tarball inspection, and repository-only OSI-licensed fixtures create no licensing obligation beyond what the OSI licenses already authorize, as OSI approval exists precisely to permit such redistribution; git repository storage under these licenses does not constitute a weakening of the 'no typeface bundler' consumer-protection rule."

---

**Key supporting points**:
1. The OSI licenses (OFL-1.1, etc.) explicitly permit public redistribution—that's their defining characteristic
2. The mechanical check (`typeface_fixture_bound.test.ts`) ensures the original consumer commitment is enforced
3. "Bundler" in the original decision suggests packaging for consumers, not internal repository storage
4. No new licensing obligation is created; the licenses themselves authorize this use

The council's routing was defensible, but the 2026-10-16 record should carry this reasoning explicitly so the "why not owner-reserved" question is answered on the record.

### `openai`

**B.** Although npm consumers remain protected, the amendment permits public Git redistribution of third-party font binaries—a new licensing commitment and weakening of the prior lock—so owner authorization was required but is not evidenced; suspend the amendment and remove the binaries pending written authorization.

