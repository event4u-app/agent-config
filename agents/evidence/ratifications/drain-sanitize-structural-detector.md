---
proposed_by: claude-code session 97f38eee (roadmap-process-full run, 2026-09-30)
implemented_by: claude-code session 97f38eee (same session — see § Independence)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai), 1 round
providers: [anthropic, openai]
verdict: request-changes-taken
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `roadmap/sanitize-list-generated`, Phase 3

## What was proposed

`road-to-a-sanitize-list-that-is-generated`, Phase 3 — the structural-hiding
detector, returning after an independent review refused it on 2026-09-29 and
it was reverted.

| Surface | Change |
|---|---|
| `src/scripts/_lib/structural_hiding.ts` | new — tokenizer plus a tree walk over an open-element stack |
| `tests/scripts/structural_hiding.test.ts` | new — per-channel, non-channel and adversarial fixtures |
| `src/scripts/_lib/retrieval_sanitize.ts` | `sanitize_markup` composes the pre-pass ahead of the codepoint floor |
| `src/scripts/check_read_surface_coverage.ts` | the no-percentage rule returns, plus a gap-register citation check |
| `docs/contracts/retrieval-read-surfaces.md` | the second layer, its register, and why `aria-hidden` is not a channel |

## Independence

`proposed_by` and `implemented_by` are the same session, which is the shape the
Iron Law forbids reviewing itself; `reviewed_by` is the council — two seats,
two providers, neither of them the author.

**The CLI rung was unavailable and the run used the metered API rung.** Both
seats read `live_probe: unknown — no exchange with this provider has ever been
recorded`, so quorum was 0/2 before the run and the CLI seats were skipped.
`--mode-override api` reached both; quorum after the run was 2/2. Spend
$0.1021 against a $0.4689 estimate, inside the run's ceiling.

**Scope was narrowed by a byte ceiling, not by the author's judgement.** The
full delta is 61,808 bytes against a 51,200 bundle ceiling. Round 1 carried the
detector and its fixture suite in full — the artefact the previous review
refused. The prompt said so, and said that round 2 would carry the gate, the
contract doc and the roadmap. **Round 2 was not run**; what the council did and
did not see is stated in § What the reviewer checked below rather than implied.

## The prompt

Recorded because a verdict whose prompt is not recoverable is not evidence, and
the response file lives under `agents/runtime/`, which is gitignored and pruned.
The prompt stated the scope and the narrowing reason, gave the 2026-09-29
history and its four return conditions, described the module's threat model,
and then asked six open questions: whether the tokenizer handles the shapes it
claims and where it does not; whether adversarial inputs exist that the fixtures
miss; whether the removal policy is sound or introduces a problem of its own;
whether the channel list is right in both directions; whether anything is
claimed in the header that the code does not support; and whether the fixtures
discriminate or would pass against a broken implementation. It closed with
"Report findings with file and line. If you find none in a given area, say so
for that area."

It named no expected outcome, in either direction, and carried no statement
that the branch was believed clean.

## One round. Verdict `REQUEST_CHANGES`, 2/2 — and every finding was taken.

**Both seats found the tokenizer correct for every case they examined.** The
confirmed set: the four named adversarial shapes, attribute parsing across
quoting styles, the sentinel never echoing input, the both-directions structure
of the per-channel fixtures, `aria-hidden` defended and tested, no false entry
on the channel list, and the removal policy sound.

The findings were about **fixture discriminating power** — branches the code
already takes correctly with no test that fails when it stops. One seat put it
directly: the other seat's APPROVE "evaluates correctness but not fixture
discriminating power, which the scope explicitly requested".

| Severity | Finding | Taken as |
|---|---|---|
| critical | `hidden="until-found"` asserted only at the predicate, not end-to-end | end-to-end fixture; sensitivity probed |
| high | an end tag running to EOF without `>` | two fixtures — hidden and visible |
| high | hidden siblings either side of a visible one, where `hiddenAt` must reset | one fixture, asserting two removals |
| high | an orphan `=` in a tag | one fixture |
| medium | a bogus comment carrying a payload, and an unterminated one | two fixtures |
| medium | a hidden VOID element | one fixture |
| medium | the stray end-tag test not asserting `removals` is empty | assertion added |
| low | `textarea` / `title` declared RAWTEXT, never exercised | two fixtures |
| partial | "no corpus exists" reads as "we have not got to it" | the header now states which |

## What the review caught that I had wrong

The critical finding is the one worth naming, because it is the same failure
mode that got the first version refused. `hidden="until-found"` content is
visible to find-in-page, so the module must KEEP it — and that claim was
asserted only in a unit test of the predicate. A stripper that misread the
predicate's return would delete visible text while that test stayed green.
`aria-hidden` shipped as a defect the first time by exactly this route: a claim
about visible content with no end-to-end assertion behind it.

**One finding also caught a wrong fixture of mine rather than a wrong
behaviour.** My first unterminated-end-tag case put the payload in a VISIBLE
`<div>` and asserted it was stripped. The code refused, correctly — visible
text is not this module's to delete. The fixture was rewritten around a hidden
element and a second case pins the visible half.

## Sensitivity, probed rather than asserted

Five mechanism-neutralisation runs, each restored from a pristine copy:

| Neutralised | Result |
|---|---|
| RAWTEXT state off | shapes 2, 2b red — 2 failed / 48 passed |
| comment tokenization off | comment channel + shapes 1, 1b, 4 red — 6 failed / 44 passed |
| nesting depth untracked inside a hidden subtree | shape 3 red — 1 failed / 49 passed |
| `aria-hidden` restored as a channel | both retention tests red — 2 failed / 48 passed |
| `until-found` exemption removed | predicate + end-to-end red — 2 failed / 58 passed |

The first probe caught a weak fixture before the council saw the branch: shape
2 passed for the wrong reason, because escaped quotes made the payload
not-a-tag under any parser.

## What the reviewer checked, and what it could not

Supplied verbatim: the detector in full and its fixture suite in full.

**Not supplied, and therefore not reviewed:** `check_read_surface_coverage.ts`
and its self-test cases, the contract-doc section, the `sanitize_markup`
composition in `retrieval_sanitize.ts` and its tests, and the roadmap evidence.
The gate's own `--self-test` covers its rejecting behaviour deterministically
(11/11, 8 rejecting) but that is a machine check, not an independent read. A
reviewer wanting the remaining surfaces should treat them as unreviewed.

The nine fixtures taken from this round were also not re-reviewed — the round
closed with the findings, and the fixes are the author's.

## Not claimed

**Detection adequacy for the class.** The 2026-09-29 review was explicit that a
frozen corpus is required before such a claim, and none exists. Step 3.3 of the
roadmap forbids the percentage that would imply one, and
`check_read_surface_coverage` now enforces its absence. What is claimed is the
declared channel list, with its gap register cited beside it on every surface
that makes the claim.
