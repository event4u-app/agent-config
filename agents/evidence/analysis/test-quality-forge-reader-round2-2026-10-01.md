<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

# Test-quality validation — the forge-read suites

The artefact the `provenance: level=L4` markers on `tests/scripts/forge_reader.test.ts` and
`tests/scripts/doctor_forge_block.test.ts` cite. AC-2 requires `evidence` at L3/L4 on the
stated ground that an unattributed claim of independence cannot be checked for the
independence it claims — so this file exists to be checkable, not to be decorative.

## What ran

| | |
|---|---|
| Question | `agents/runtime/council/questions/test-quality-forge-reader-round2-2026-10-01.md` |
| Seats | **anthropic** and **openai**, 2/2 present, quorum concluded |
| Transport | CLI, subscription-authed; `$0.00` billed |
| Date | 2026-10-01 |
| Mode | `analysis`, depth `deep`, peer-review enabled |

The question is the Phase 2.3 one, asked of evaluators that did not author the tests: *would
these tests fail under plausible wrong implementations?* It asked for tautologies, assertions
restating the implementation, missing boundary and error cases, over-mocking, expectations
shaped to fit the code, and any test never shown red.

The council transcript is not linked: `agents/runtime/council/` is gitignored and auto-pruned
after the retention window, so a stable artifact may not cite a path there. The findings that
mattered are reproduced below instead, which is the convention this repository already uses.

## The first attempt failed honestly, and that is recorded rather than hidden

The first pass was handed a *description* of the two suites instead of the suites. One seat
refused to assess on exactly that ground — the question cannot be answered without the test
code — and called out the other for producing a plausible-sounding reconstruction from the
problem statement. **That pass establishes nothing and is cited for nothing.** The second
pass embedded both files in full. The council bundle is capped at 51,200 bytes, so the
implementation source was dropped and the tests kept; at 32,674 bytes it ran.

## What the council found, and what was done about it

1. **The effort was inverted.** The suites spent their cases on acquisition choreography —
   budget, pagination, call order, offline identity — while the five rows `doctor --json`
   actually emits, the user-visible trust boundary, were barely asserted: no case named the
   row ids or their order, none falsified one input field to check row isolation, none
   covered multiple rulesets with one inactive. *Folded in:* the `the five rows — the product
   output itself` group in `doctor_forge_block.test.ts` — row ids and order, per-row
   isolation, an inactive ruleset, source presence on every row.
2. **The scripted `api()` fake dropped the `paginate` argument.** Consumption of pages was
   tested; the *request* for them was not, so an implementation that read page one and parsed
   it correctly passed every pagination case. *Folded in:* the fake records the flag, and a
   case asserts the three list endpoints are asked for paginated while the single-object read
   is not.
3. **The "non-boolean" case supplied a MISSING field, not a wrong-typed one.** A truthy
   string or a `1` is the shape a loose serialiser actually produces and the one where a
   coercing implementation reports `satisfied`. *Folded in:* wrong-type cases over
   `allow_auto_merge` and `default_branch`.
4. **Substitution completeness.** The assertion proved no `{owner}` remained and that at
   least one action carried the slug, not that the format was right. *Partly folded in:* the
   row-source and action-line cases assert the `repos/<slug>/` shape.

## The honest limit

L4 means a multi-provider council participated as an **evaluator** on these suites and its
findings were folded in. It does not mean the suites were independently **authored** — they
were written by the implementing session, which is L0 authorship — and reading the marker as
end-to-end independence would over-claim. The same limit is stated on the AC-2 artefact of
2026-09-14 and is repeated here rather than assumed inherited.

Four independent R2 review rounds over the same change are recorded separately under
`agents/evidence/reviews/drain-adversarial-verification-close*.findings.md`; this file covers
only the council pass over the tests.
