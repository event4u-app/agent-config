# Citation, Quoting, Domain-Overlays & Claim Self-Check Contract

Phase 6 of `road-to-frontier-quality-operating-system`. Planning contract for
`FQ-10` (citation/quoting — covered), `FQ-11` (domain overlays), `FQ-12` (claim
self-check) in [`mechanism-matrix.md`](mechanism-matrix.md).

## Citation contract (FQ-10 — extends, never weakens, `content-quoting-floor`)

The broader citation contract WRAPS the existing `content-quoting-floor`
**without touching its caps** (≤15-word verbatim quotes, one quote per source
per deliverable, no complete short work, no displacive summary):

- cite only sources that **materially support** the answer;
- **paraphrase by default**, quote only when the wording itself is the point;
- **never reconstruct an article's structure** (the displacive-summary ban);
- prefer **primary sources**; state conflicts between sources.

`content-quoting-floor` stays the enforced floor; this contract adds the
positive citation discipline around it.

## Domain overlays (FQ-11 — detection + existing owners)

| Domain | Detection cue | Overlay | Existing owner |
|---|---|---|---|
| finance | a financial figure enters a **spreadsheet** surface | source comment + official-source-first | `spreadsheet-source-quality` |
| legal | laws / compliance / jurisdiction asked | jurisdiction + freshness tag; not-advice | `legal-safety-floor`, `domain-safety-disclaimer` |
| research | a research report | primary-source preference, no displacive summary | `content-quoting-floor`, `research:deep` |
| recommendation | spend/time-risk-meaningful rec | current product/source check | FQ-01 currentness |

The overlays are **detection + routing to existing floors**, not new advice
rules. Boundary discipline: ordinary prose is NOT overburdened with citations;
high-stakes answers are NOT under-cited.

## Claim self-check (FQ-12)

Before a final answer that used retrieval: **every factual claim is either (a)
stable knowledge, (b) a cited source, or (c) an explicit uncertainty note.**
Extends `direct-answers` Iron-Law-2 (no invented facts) into a post-retrieval
pass; the follow-up adds it as an auto-rule with the FQ-12 eval.

## Evals (overlay boundaries)

`eval-harness.md` FQ-11/FQ-12 arms: positive (finance figure → source comment;
legal → jurisdiction; post-retrieval claim → cited/uncertain) + negative
(ordinary prose → NOT over-cited; stable-knowledge answer → no forced citation).

## Disposition

FQ-11 + FQ-12 → follow-up implementation roadmap (domain-overlay detection +
claim self-check auto-rule). FQ-10 → covered by `content-quoting-floor` (this
contract wraps, does not weaken it). No src change here.
