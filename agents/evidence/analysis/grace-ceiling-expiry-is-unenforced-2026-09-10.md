<!-- evidence-type: analysis -->

# The standing-payload grace ceiling has no expiry mechanism

Measured 2026-09-10 in a worktree at `origin/main` `7bf325f3b` (v14.23.0), while executing
step 4.4 of `road-to-delivery-for-every-host`. Every figure below was re-derived with the
repository's own instruments; nothing is carried over from the roadmap's own text, which is
the artifact this finding corrects.

## The claim that turned out to be false

The roadmap, its Risk 3 row, one of its acceptance criteria, `ADR-264`'s `review_trigger`, and
two AI-council rounds all rest on one sentence, quoted here in the form the second council
round received it:

> On 2026-11-10 the gate compares ~138,413 against `design_ceiling` 107,646 and reds every
> pull request, whether or not `grace_ceiling` is deleted, so doing nothing is deferral rather
> than safety.

Nothing in the tree implements that behaviour.

## Reproduction

Every consumer of `ci_delivery.grace_end_date`, excluding `dist/` (a projection) and
`node_modules`:

```
$ grep -rn "grace_end_date" --include="*.ts" --include="*.yml" --include="*.yaml" --include="*.json" .
tests/scripts/check_preamble_payload_budget.test.ts:165   function rawCiDelivery(): { … grace_end_date: string … }
tests/scripts/check_preamble_payload_budget.test.ts:168   ) as { ci_delivery: { … grace_end_date: string … } }
.github/workflows/standing-payload-delta.yml:129          end="$(python3 … ['ci_delivery']['grace_end_date'])"
src/config/preamble-payload-budget.json:83                "grace_end_date": "2026-11-10",
```

The two test hits are the return-type annotation of a helper. No test asserts anything about
the date. The workflow hit is consumed on exactly one line:

```yaml
# .github/workflows/standing-payload-delta.yml:130
echo "grace ceiling $ceiling (expires $end) — design ceiling is lower; see ci_delivery"
```

It is echoed into the job log. And the gate carries no date logic at all:

```
$ grep -n "new Date\|Date.now\|toISOString\|expire\|expiry" src/scripts/check_preamble_payload_budget.ts
(no matches)
```

`taskfiles/ci-fast.yml` reads `grace_ceiling` (`:884`) and does not read the date.

### The grep above is CODE-scoped, and that mattered

`--include=*.ts --include=*.yml --include=*.yaml --include=*.json` cannot see a
markdown consumer, so the first version of this artifact established "no code
reads the date" and the ADR built on it said "the only consumers **in the tree**".
The completion review caught the gap. The `.md` sweep, run afterwards:

```
$ grep -rln "2026-11-10" --include="*.md" .   # minus node_modules, dist/, archive/, runtime/
agents/roadmaps/road-to-delivery-for-every-host.md          (this roadmap, corrected)
agents/roadmaps/stubs/road-to-preamble-transfer-debt-221.md (probe step, corrected)
agents/roadmaps/later/road-to-database-erd-landing.md       (wake trigger, corrected)
agents/roadmaps/later/road-to-database-relational-modeling.md (wake trigger, corrected)
agents/settings/contexts/cache-injection-anatomy.md         (a `review by:` date, unrelated)
```

Two of those were **live parked roadmaps** carrying the expiry as a `Revisit-if`
wake trigger — *"The `grace_end_date` of 2026-11-10 is a second trigger: at that
date the design ceiling of 107,646 applies"*. A park whose exit condition is an
event no code produces is a park with no exit, so both were repaired in the same
change rather than left as stale prose. The remaining hits in
`agents/roadmaps/archive/` and in dated evidence artifacts are historical records
and are deliberately untouched.

The distinction the first draft blurred is worth keeping: **a code consumer makes
the date do something; a prose consumer makes a reader plan around it.** Only the
first was searched, and the second was where the live damage was.

## What actually happens on 2026-11-10

The workflow reads `ci_delivery.grace_ceiling` — 138,490 — passes it as `--ceiling`, and the
gate compares the measured total against it exactly as it does today. Measured now: **138,413**,
so the run is green with 77 tokens of headroom. That is unchanged by the calendar. The design
ceiling of 107,646 becomes the operative bound only if a human edits the config, and the date
is the note reminding them to. It is a documented commitment, not a mechanism.

## Why this matters beyond the one date

Three artefacts describe the expiry as automatic:

- `ci_delivery.why_a_grace_ceiling`: *"It expires at the milestone-1 date, at which point the
  design ceiling applies."*
- `ADR-264`'s `review_trigger`: *"the milestone-1 date arrives and the design ceiling of
  107,646 applies, retiring the grace ceiling and this record with it."*
- `.github/workflows/standing-payload-delta.yml:130`: `(expires $end)`.

All three state a behaviour no code performs. This is the shape the same config file names in
its own `decision_record` field as the thing to avoid — *"wording without enforcement … is an
exploitable trust gap"* — and the shape `road-to-delivery-for-every-host` step 4.2 refused to
create when it declined to write a `rules_bucket_ceiling` key no gate reads. The gap is the
same; it was already here.

The measurement is not in question. The gate's ratchet limb is real and enforced: a rise of
`grace_ceiling` against the base ref is refused (`assertBoundsDidNotRise`), the measured total
is compared against whichever ceiling applies, and growth past it reds. What does not exist is
the **time** limb.

## Consequences for the decisions built on it

- **The urgency argument dissolves.** "Doing nothing is deferral, not safety" required a cliff.
  There is none, so doing nothing is stable. Extending `grace_end_date` edits a JSON string and
  an echo line and has no effect a gate can observe.
- **The decisive argument against the undated-growth-bound proposal dissolves too.** It was
  rejected on the ground that it *"prevents the design ceiling from ever applying"*. The design
  ceiling does not apply on any date today, so that proposal would prevent nothing that was
  going to happen. Whether it should be adopted is a separate question, decided elsewhere; what
  is settled here is that it may not be rejected on that ground.
- **`ADR-264`'s third review trigger cannot fire.** It is written to fire on a date-driven
  event that does not occur.

## Honest limits of this finding

This establishes what the tree does, not what it should do. It does not say the concession is
wrong, that the date should move, or that the ceiling should be retired — building the missing
expiry would arm a repository-wide stop that does not exist today, on a date on which
`status_2026_08_24.committed_reduction_mechanism` is still the string `"NONE"`. That is a
decision, and it is recorded where decisions are recorded rather than inferred from this file.

Nor does it establish anything about whether a failing check blocks a merge; that stays
branch-protection configuration, as `ci_delivery.honest_limit` already says.
