# Design-corpus upstream — harvest verdicts (2026-08-13)

> Durable record of what this suite takes, refuses, and parks from **Source C**,
> the upstream of the vendored design corpus. Its real identity and pin live in
> [`design-intelligence/ATTRIBUTION.md`](../../../src/skills/design-intelligence/ATTRIBUTION.md)
> — the one place licence attribution belongs, per `source-confidentiality`.
> Cite this file rather than re-reading the upstream.

## Why the verdicts exist

Source C ships a generative design-system skill that is installed **beside**
agent-config in real setups. Its Step 2 instructs regeneration as a required
first move for new pages and projects, with no carve-out for the case where the
user already handed over a finished artifact. Nothing in this tree said which
wins, so a co-installed skill could quietly outrank a supplied spec.

The precedence answer is now written where the agent reads it
(`design-fidelity-mechanics` § Provided-artifact precedence — the chain's fourth
member). These are the harvest verdicts on the rest.

## Adopt

- **File-persisted master + per-page overrides with an explicit retrieval
  order.** The pattern is right and this tree lacked it: a design decision that
  lives only in a session is re-derived — or re-screenshotted — next session.
  Consumed by the browser-handover work, which owns the retrieval order
  (project token file → extraction artifact → live page).
- **Skip-if-exists unless explicitly forced.** A regeneration that silently
  discards prior decisions is the same failure as a port that silently drops a
  handler. The forced path stays available and stays explicit.
- **A pre-delivery checklist as a gate rather than a suggestion.** This tree
  already has the shape elsewhere (verdict scoping in `design-review`); the
  borrow is the placement — before delivery, not after review.

## Reject

- **Generative-first as the default for a port.** Correct on a greenfield brief,
  wrong the moment an artifact exists, and wrong in a way nothing downstream can
  repair: the generative step runs *before* the artifact is read, so no later
  gate gets the chance to override it.
- **A `--design-system` step marked REQUIRED.** A required generative step is
  the mechanism by which the above becomes unavoidable. Rejected as a default;
  unobjectionable as an opt-in.

## Park

- **BM25 CSV search as a corpus-grounding retrieval alternative.** Plausible,
  and it overlaps this tree's existing 16-stack corpus rather than extending it.
  Comparing the two is only worth doing if the corpus track asks the question;
  until then a second retrieval mechanism is a maintenance surface with no
  named beneficiary.
  **Un-park when:** the corpus track raises a retrieval-quality question that
  the current lookup measurably fails, with the failure named. Absent that, this
  stays parked rather than "not yet done".

## What this record does NOT claim

The adopt list is a verdict on the **pattern**, not a licence to copy code.
Anything actually borrowed at the code layer runs through `code-provenance` in
full — the user-supplied-artifact carve-out in `design-fidelity-mechanics`
§ Adopt the code covers a **user's own handover**, and an upstream repository is
the opposite of that.
