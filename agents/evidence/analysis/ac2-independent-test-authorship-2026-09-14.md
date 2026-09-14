<!-- evidence-type: analysis -->

# Independent test authorship and validation over the adversarial fixture set

The validator record for `road-to-adversarial-verification-and-long-runs` AC-2:
*independent test provenance is recorded per test, and critical tests are at L3 or
L4 wherever two providers are configured.* The provenance markers in
`tests/e2e/adversarial-verification-fixtures.test.ts` cite this file by slug; this
is what they cite.

## Identity and provider — the part an unattributed validation cannot supply

| | |
|---|---|
| **Date** | 2026-09-14 |
| **Members** | `anthropic` and `openai` — two distinct providers, so the reachable level is **L4** (a multi-provider council), not L3 |
| **Transport** | both seats CLI, subscription-authed; `billable=0`, `$0.0000` spent |
| **Quorum** | `2/2 present` **after** each run, which is the line that reports a result — the before-the-run line is a presence check |
| **Rounds** | peer-review: each seat saw the other's round-one findings and had to state agreement, disagreement and new points |
| **Runs** | three, scoped by the 51,200-byte bundle ceiling |

`evaluator-independence` § Enforcement is honest that item 2 — an honestly chosen
scope — is enforced by nothing. The scope here was set by the bundle ceiling and
by group, not by outcome: **every** group in the file is covered by exactly one of
the three runs, and the prompts are reproduced below so a reader can check that
none of them states an expected verdict.

## The three runs

| Run | Groups | Modules inlined |
|---|---|---|
| **A** | `T1` · `T6` · `T9` · `T10` | `mission_record` · `typed_op_grant` · `council_transport` |
| **B** | `T7 / T8` · `AC-7` | `continuation_ladder` · `mission_record` |
| **C** | `T2 / Phase 2` · `G8 / G9` · `3.1` · `3.2` · `T5 / 5.1` · `T4 / 5.2` · `7.2` | `cascade_base` · `delivery_ready` · `forge_protection` |

A fourth, earlier attempt asked the seats to READ the files from the repository.
Both reported they could not reach a filesystem and returned no findings. That is
recorded rather than dropped: it is an honest null, it spent two quota units, and
it is the reason every later run inlines the code verbatim.

## The prompt — recorded, per `evaluator-independence` item 3

One prompt shape across all three runs, varying only in the groups and modules
named. In full:

> You are acting as an **independent test author and validator**. The tests below
> were written by the same lineage that wrote the code they test, which is the
> self-confirmation this pass exists to break. Decide what these tests should
> assert, independently, then say where the shipped assertions fall short.
>
> Per group: (1) What should this group assert? Derive it from the module's
> behaviour and from what the group's name claims — not from the assertions that
> are there. (2) Would the shipped assertions fail under a plausible wrong
> implementation? Name the wrong implementation. If a test would pass against it,
> that test is a tautology and you should say so. (3) What assertion is missing?
> Boundary case, error path, abuse case, the negative polarity of a positive
> claim. Give the concrete assertion, not a category. (4) Is anything asserted
> that is not a contract?
>
> Also report tautologies, algorithm duplication, over-mocking, any place where
> the expectation looks like it was changed to fit the code, and any test whose
> failure mode you cannot construct at all.
>
> Findings only. If a group yields nothing, say so for that group in one line.

**It states no expected outcome, in either direction** — not a verdict, and not a
prediction of one, which `evaluator-independence` § The softer form treats as the
same violation. It does not say the tests are believed sound, it does not say
findings are welcome, and it does not narrow the scope to a subset the author
chose for comfort.

## What the pass changed, folded in the same day

Seven findings both seats agreed on, each now an assertion:

1. **`T1` first test was a tautology** — it passed against a `findingFor` that
   always returned `null`. Now asserts all three polarities: compliant, code-only
   (a finding naming the path), test-only (not a code change).
2. **`T1` halt mapping** — `terminalStateFor(halt) !== null` passed against an
   implementation mapping every halt to `success`. Now asserts the exact map.
3. **`T1` rung vocabulary** — the `/ask|question|confirm|owner/` regex was evaded
   by a rung named `escalate` or `await-input`. The action set is now enumerated,
   and the regex widened.
4. **`T6` used `Date.now()`** — which made the boundary cases unwritable. Fixed
   clock, and five expiry cases: future, past, exactly-at, unreadable, none.
5. **`T6` ledger precedence was asserted in one direction** — now both: the ledger
   revokes a live snapshot, and cannot revive a revoked one.
6. **`T6` field completeness** — dropping only `head_sha` proved one field was
   checked. Now every one of the fourteen, each asserted to be reported by name.
7. **`T7 / T8` tested a hand-picked five of eleven delivery states** — an
   implementation recognising only those five passed. Now driven over the whole
   `DELIVERY_STATES` vocabulary as a partition, with `deliveryBlocksCompletion`
   asserted in both polarities.

Plus two from run C, folded the same way: **`G8`'s finding content** is now
asserted rather than its non-nullness, and **`G9` was renamed**. Its title read
*"test-first across two sessions is GREEN"* while its own body conceded the gate
cannot see a session boundary — both seats called that a title-body contradiction,
and they were right. It now says what it establishes: a code change with a
qualifying test delta is green.

## What the pass found that is NOT folded in, and why

**Four findings are about the implementation, not the tests, and all four sit on
an authority surface.** Writing a red test for them here would be the right move
in a run whose scope included changing authority code; this run's did not, and
`security-sensitive-stop` puts a threat pass before the first edit to a surface
like this rather than after. They are carried as a roadmap instead —
`road-to-authority-object-exactness` — which is the tracked-follow-up disposition
rather than a note that closes nothing:

- `objectIsExact` in `typed_op_grant.ts` accepts any string of ≥8 characters
  containing a non-letter, so `!!!!!!!!` and `all-branches` pass as "an exact
  object" and can carry a grant. Both seats, `must`, independently.
- The same function never validates `op`: an empty or whitespace-only op with an
  exact-looking object grants.
- `confirmed` is a bare boolean with no turn or session provenance, so "this
  turn" is not something the type can enforce.
- `restore` in `mission_record.ts` ignores `ledger.grant`: a record carrying grant
  A and a ledger describing grant B resumes.

**One finding is a real limitation this file cannot close and now states instead.**
Both seats observed that `AC-7` composes pure functions rather than exercising a
live write-restore-continue cycle, so a defect in how the record is persisted or
when `restore` is invoked would pass. That is accurate. The modules are pure by
design and the tree has no harness that runs a mission across two processes;
claiming otherwise would be the coverage inflation this whole roadmap is named
after, so the fixture says what it does and does not prove.

**Run C's broader verdict is recorded and not acted on here.** Both seats
converged that several older groups assert that documentation *wording* exists
rather than that behaviour occurs — *"prose-as-enforcement-proof"*, in
`anthropic`'s phrase, with the sharper claim that a passing prose test is worse
than a gap because a reader infers enforcement from it. That is a finding about a
whole class of fixture in this repository, not about this roadmap's remaining
criteria, and folding it in here would have meant rewriting eleven groups under an
acceptance criterion that did not ask for it. It is stated here so the next reader
of this file finds it rather than re-deriving it.

## Honest limits of this record

The level recorded per group is **L4 for every group these three runs covered**,
and L4 means a multi-provider council participated as an evaluator on that group —
it does not mean the council wrote the group from scratch. The original assertions
were authored by the same lineage as the code; the council's contribution was
adversarial review that materially changed nine of them. Reading the marker as
"this test was independently authored end to end" would over-claim, which is why
this paragraph is here and not left to inference.
