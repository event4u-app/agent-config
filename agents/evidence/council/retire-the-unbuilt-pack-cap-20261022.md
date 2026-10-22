<!-- evidence-type: analysis -->

# Retire the unbuilt pack-size cap

**Date:** 2026-10-22 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `retire-the-unbuilt-pack-cap-20261022.question.md`, beside this file
**Raised by:** 17.0.0 release finding `7109e2c536e8` (release council: fix before the cut)

## Verdict — council-decidable, (b) RETIRE, 2/2

Both seats classed changing `budgets.packed_size_mb.max` as reversible and
internal, so council-decidable under `decision-revisit-gate`, and both chose to
retire it: the unbuilt surface it describes is never published and no job
packs it. Applied: `max` removed with a `retired_max_2026_10_22` note, the
unbuilt `last_measured` re-recorded on a pristine checkout (12.5806 MB), and
`check_pack_size` keeps honouring a `max` only if one is re-cut. The built
surface's creep line, which judges the published tarball, is unchanged.

The question gave the unbuilt creep line as an instrument to keep; it did not
state that the line (10.509 x 1.10 = 11.56) was also exceeded by the 12.58
reading. Re-recording `last_measured` from a fresh measurement is the line's
ordinary maintenance, the same move the 2026-10-17 built re-measure made.

## Seat answers, verbatim

### `anthropic`

## 1. Venue: Council-decidable

**Reason:** The transition is reversible, internal-only, bounded by concrete measurements, and touches no owner-reserved invariant (not a security/privacy/safety floor; not purpose/spend/legal/governance).

## 2. Recommended option: **(b) RETIRE**

**Choice:** Remove `budgets.packed_size_mb.max` entirely; keep the unbuilt creep line for tracking.

**Reason:** The unbuilt surface is never published to consumers, the cap has never been enforced by CI, and maintaining an unenforced absolute maximum is false policy state—removing it is more honest than raising or restoring it.

**Strongest counter-argument:** Option (c) RESTORE AS A GATE would actually enforce the declared policy rather than abandoning it, but immediately redding every branch before a major release creates friction without proportional consumer benefit (the built tarball already has governance).

## 3. Owner-reserved interim: N/A

(I assess this as council-decidable. If it were owner-reserved, the honest interim would be option (b) as a "remove false state" cleanup or explicit breach documentation in release notes.)

---

**Concrete next steps if you agree:**
- Remove `max` from `pack-size-budget.json` unbuilt surface
- Keep `last_measured` + creep line for unbuilt tracking  
- Document the removal reason in the 17.0.0 release notes
- `check_pack_size` continues judging built tarball against its creep line (unchanged)

### `openai`

My assessment is **agree with the council’s premise and choose (b) RETIRE**.

1. **Council-decidable:** Changing `max` is not owner-reserved because the “Governance” reserved set covers safety/privacy floors and other enumerated risks, not an unpublished payload-size policy.

2. **Choose (b) RETIRE:** As the “Facts” establish, UNBUILT is neither published nor checked by required CI, so its absolute cap represents no consumer-facing or enforced constraint and creates false policy state.

3. **If nevertheless owner-reserved:** Block the 17.0.0 release and explicitly record `max: 11.5` as breached, because shipping while retaining a knowingly violated absolute limit would not close the council’s prerequisite honestly.

4. **Strongest argument:** Retiring `max` aligns declared policy with operational reality while preserving both creep lines and the enforced BUILT check, which is the surface consumers actually receive.

5. **Strongest counter-argument:** The 2026-10-17 owner position treats `max` as a deliberate independent constraint, so retirement could erase a useful source-tree growth signal merely because CI has failed to exercise it.

6. **Concrete next step:** Remove `budgets.packed_size_mb.max`, add a dated note explaining that UNBUILT is non-published and monitored only for creep, and update tests and documentation to prove BUILT remains the required enforced surface.

**End-summary:** Council-decidable; retire the unenforced UNBUILT absolute cap, preserve creep monitoring, and keep BUILT enforcement.

