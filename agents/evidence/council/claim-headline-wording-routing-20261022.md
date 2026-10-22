<!-- evidence-type: analysis -->

# What may the npm description and README headline say about claim checking?

**Date:** 2026-10-22 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `claim-headline-wording-routing-20261022.question.md`, beside this file
**Raised by:** 17.0.0 release finding `edbc325c594d` (release council: fix before the cut)

## Verdict — SPLIT (correction / owner-reserved), escalated

`anthropic` held the replacement a council-decidable correction; `openai` held
it owner-reserved and the release not publishable until the owner decides. A
split escalates, so the headline wording on `package.json`, `README.md` and the
docs site is an open OWNER decision for the 17.0.0 cut. Both seats agree the
current wording is contradicted by `docs/CLAIMS.md` ("Unmarkered prose is never
checked"). Not changed by an agent lane.

## Seat answers, verbatim

### `anthropic`

here's my assessment:

## 1. Weakening or correction?

**Correction (council-decidable).** The current headline claims universal machine-checking that the code never implemented — only markered claims are checked, 37% of ledger entries remain unbacked, and zero exec-evidence is currently re-verifiable (`internal/reports/exec-evidence-feasibility.json` states it plainly). Replacing it doesn't weaken a real commitment; it corrects a materially false claim to match what the package actually delivers. The code's behavior is the floor; the headline overstated it.

## 2. Which replacement?

**Candidate (d):**

**"— governed artifact library with public-claim verification, including the counts in these badges."**

**Reason:** Accurate (there *is* a verification system, it *does* cover marked claims including counts), distinctive positioning (few repos verify claims mechanically), drops the false universal "every," and states what ships without promising what doesn't.

Shorter alternative if space-constrained: **"— governed artifact library with verified claims, including these counts."**

**(a)** is technically precise but "markered" is jargon; **(b)** drops the load-bearing "marked" constraint (not all public claims, only marked ones); **(c)** backing every claim pre-17.0.0 is likely infeasible given the ruling closed this as a blocker.

## 3. If owner-reserved (interim state)?

**"— governed artifact library; see [claim verification](docs/proof.md) for coverage."**

**Reason:** Removes the false universal claim, points to actual coverage docs, makes no scope commitment (neither universal nor partial) — lets owner decide later. But I assess this as correction, not weakening, so this interim likely doesn't apply.

### `openai`

## Assessment: Disagree

Treating this as merely council-decidable would bypass the governance rule: narrowing “every claim machine-checked” to the gate’s actual behavior plainly removes part of the existing public commitment, even though that commitment is inaccurate.

1. **Owner-reserved:** Replacing “every claim machine-checked” with the narrower truth is a weakening because it reduces the published assurance, and the rule contains no exception for correcting inaccurate commitments.

2. **Choice (d), after owner approval:** Use “— marked claims must resolve to backed ledger entries; badge artifact counts are re-derived by the build,” because it describes enforcement without implying that evidence pointers independently verify claim truth.

3. **Interim state: block the 17.0.0 release:** Publishing the current wording repeats a known falsehood, while narrowing or removing it without owner approval would violate the decision gate.

**Strongest argument:** The current headline is directly contradicted by `docs/CLAIMS.md` (“Unmarkered prose is never checked”), the 43 unbacked entries, and the report recording zero claims as presently machine-re-verifiable.

**Strongest counter-argument:** A false statement arguably cannot constitute a valid “commitment,” so correcting it could be characterized as ordinary accuracy maintenance—but that exception is not present in the quoted governance rule.

**Next steps:** Obtain an explicit owner decision covering all four public surfaces, adopt the precise wording above consistently, remove the withdrawn “zero runtime” claim, and record that the change corrects scope rather than proving every ledger claim.

**Bottom line:** Owner approval is required; until then, the honest release state is “not ready to publish.”

