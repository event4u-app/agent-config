<!-- evidence-type: analysis -->

# The table may stand, the trust boundary under it may not

AI council, 2026-10-24. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds with peer review, design mode, CLI transport, `$0.00`
(both seats subscription-authed). No chairman synthesis was produced; the two
final-round answers are summarised here and quoted where the wording matters.

The prompt is the **unchanged** question file from the failed 2026-10-21
attempts: `gate-aggregation-truth-table-20261021.question.md`, beside this
file. It was sent byte-for-byte as that file's no-quorum record said it should
be. This is therefore the first answered round on that question, not a second
round on an answered one. The draft it asks about is
`agents/evidence/analysis/gate-aggregation-truth-table-20261021.md`.

## Verdict: both seats say no to fixtures and to a schema draft now

- anthropic: *"Don't proceed with fixtures or schema."* Confidence high.
- openai: *"Conditional no-go: preserve 'any enforcing aspect blocks', but
  define the producer trust protocol, policy-state durability, coverage
  invariant, and governed rollback controls before fixtures or a report-only
  schema are drafted."* Confidence high.

So D24's items 3 and 4 do **not** proceed, and step 7.1 stays open. Neither
seat approved the table as complete.

## Where the seats converge

1. **The producer is the trust boundary the draft left open.** A central
   validator removes policy discretion from each check, but it still trusts
   check-authored output. openai: *"It centralizes policy application while
   leaving decisive facts under producer control."* anthropic: *"A malicious
   or buggy check could emit `pass` for any aspect, any revision, at any
   time."* What is owed: who writes the per-aspect output, in what format, and
   how it is bound to revision, invocation and evaluator.
2. **`excepted` is a disposition, not a result.** An exception suppresses
   enforcement; it must not replace the evaluation it covers, or the
   diagnostic truth (still failing, worse, changed shape) is lost.
3. **Report-only needs its own completeness status.** Exit 0 in report-only
   mode will be read as "all fine". A run must report `complete`,
   `incomplete` or `invalid` independently of its non-blocking exit code.
4. **Cell B — snapshot unavailable: block once authoritative, never fall back
   to invariant semantics.** Both seats reject the working-tree fallback,
   because it turns "do not regress from an accepted state" into "reach zero"
   and masks deletion. Both want the causes kept distinct (missing baseline,
   malformed baseline, unresolvable target, unsupported version) even though
   each blocks. anthropic also names a parent-baseline fallback as a third
   option, at medium confidence; openai names "last authenticated baseline" as
   the same idea, but only with authenticated state.
5. **Cell A — snapshot below baseline: does not block the check.** Both seats
   reject a bare, ownerless `tighten` warning as the whole answer, and both
   say a mechanically verified, monotonic reduction (lower only, equal to the
   measured value, same revision) may take a narrower path than an ordinary
   governed assertion. They differ on how narrow: see the split below.
6. **"Previous enforced class" is only safe from an authenticated, immutable
   policy snapshot.** Without one, bad provenance must block rather than
   guess a class. That ties it to the owner-reserved blocker
   `external-bootstrap-boundary-for-phases-2-3`.
7. **A formerly governed check that becomes unregistered is coverage loss and
   must block.** "An unregistered check keeps its existing CI behaviour" holds
   only for a genuinely new check outside declared coverage, and coverage must
   be anchored outside the mutable registry.
8. **The rollback table is incomplete.** Both name registry corruption and
   version skew as missing. openai adds duplicate, partial, replayed and
   wrong-revision output, clock disagreement, revoked assertions and
   kill-switch expiry. anthropic adds the missing activation criteria.
9. **The kill switch needs a protected control path.** openai rejects a plain
   environment variable as an unauthenticated bypass; anthropic proposed one.
   The stricter reading is taken.

## Where the seats split

| Question | anthropic | openai | Taken here |
|---|---|---|---|
| Does `error` block every enforcing class? | No: a distinct error result, an error budget, block only past the budget | Yes, implicitly: keeps the uniform column and treats a crash that passes as fail-open | Undecided. The uniform column stands until a round decides it, because the 2026-10-13 standing finding lists fail-open as disqualifying |
| Tolerance aggregation | Grace-period semantics, or drop tolerance until one exists | "Any enforcing aspect blocks" is coherent: tolerance already has its bound | Undecided. Zero tolerances exist (D14), so nothing depends on it yet |
| Cell A authority | No approval if the validator proposes the lowering and CI verifies it; flags owner decision anyway | Narrower delegated path for provably monotonic reductions; same-change review if that path cannot be built | Undecided between the two mechanisms; both reject routing every improvement through general governance |
| Next item | Register all 16 first, then fixtures, then schema; resolve D14's abstentions first | A short protocol and threat-model amendment first, then D24's order unchanged | The amendment, because it is the only item both lists contain (anthropic's "design gaps" 1-2 are the same producer, format and trust questions) |
| Report-only as a mode | False binary; replace with per-check shadow → advisory → enforcement | Keep, with `complete/incomplete/invalid` status and measurable promotion criteria | Undecided; both agree report-only must not read as success |

## What is owed next

A **producer protocol and threat-model amendment**, drafted and put to the
council before any fixture or schema file. openai's list is the concrete one;
anthropic's design gaps 1 to 5 fall inside it:

1. Producer identity and trust.
2. Binding to source revision, target revision, invocation, evaluator version
   and registry version.
3. Evidence digest, production time and freshness.
4. Raw evaluation versus policy disposition.
5. Duplicate, omission, replay, partial-output and version-skew behaviour.
6. Run-level `complete | incomplete | invalid` semantics.
7. Registry coverage invariants.
8. The authenticated source of the previous enforced policy.

Items 1, 2 and 8 reach the owner-reserved blocker wherever "authenticated"
means a second principal. The amendment can state what it requires there; it
cannot supply it.
