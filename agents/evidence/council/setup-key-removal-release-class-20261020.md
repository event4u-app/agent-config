<!-- evidence-type: analysis -->

# Round 2 — Phase 4 lands when ready, on the Node-floor major: 2/2 for (a)

**Date:** 2026-10-20 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, two rounds, blind chairman · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 present before and after the run · **Prompt:**
`setup-key-removal-release-class-20261020.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen
entscheidungen im ai council zu lösen") <!-- md-language-check: ignore -->
**Round 1:** `setup-key-removal-release-class-20261018.md` — split, nothing decided

## Verdict — convergent

| Seat | Option | Agent may execute Phase 4 | Reopen if |
|---|---|---|---|
| `anthropic` | **(a)** | yes — author and land the removal commits on `main`; may NOT cut the release or influence its timing | ADR-290's major is cancelled or postponed indefinitely, OR a critical fix forces cutting a minor from `main` before Phase 4 and the Node floor are ready together |
| `openai` | **(a)** | yes, without another owner turn, provided the commits cannot enter an earlier minor | Phase 4 can no longer be guaranteed to ship in the same release as the Node 22 floor — not merely if that release is cancelled |

**(a) = land Phase 4 when ready, on the same major as the Node floor.** ADR-290
supplies an already-justified major, so `anthropic`'s round-1 precondition ("not
alone on a major") is satisfied by a release that is actually coming, and
`openai`'s ("do not couple to an unrelated schedule") is satisfied because no
work waits.

## The constraint both seats made load-bearing

```
AN AGENT LANE MAY IMPLEMENT PHASE 4. IT MAY NOT CUT THE RELEASE,
AND IT MAY NOT LET THESE COMMITS ENTER AN EARLIER MINOR.
```

`openai` named it as the one condition on its yes; `anthropic` sharpened it into
the operational case that makes it real. If a critical fix arrives between Phase 4
landing on `main` and the Node-floor major shipping, the package has three
answers and only one is clean: ship Phase 4 in a minor (a semver violation),
delay the fix, or cut the release from a commit before Phase 4. The third is the
answer, and it is work that option (c) would have avoided by keeping the commits
off `main`. `anthropic` states plainly that this discipline is a human gate and
is **not enforced by tooling** — recorded here rather than implied, because a
reader of this verdict could otherwise take the containment for a mechanism.

## The one disagreement, recorded

`openai` rejects the framing that (a) involves "no artificial coupling": there IS
deliberate release coupling under (a); it is justified by ADR-290 rather than
absent. The two reopen conditions differ in strength and the stronger one governs:
`openai`'s fires when the same-release guarantee lapses for any reason, which is
a superset of `anthropic`'s cancellation-or-critical-fix pair.

## What this does not decide

Whether the keys are removed at all (the owner directed that on 2026-10-12), the
release class (settled: major, round 1, both seats), and who cuts the release —
the owner, and nothing here authorises cutting one.
