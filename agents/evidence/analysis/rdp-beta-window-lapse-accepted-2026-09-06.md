<!-- evidence-type: analysis -->

# The reasoning-discipline-protocol beta window lapses, and the lapse is accepted

> `road-to-a-beta-window-that-is-not-a-surprise` step **3.1**. That step routes
> a decision to its owner; it does not take it. This record exists because the
> owner delegated the routing to an AI council for the run of 2026-09-06, the
> council declined to take the substantive decision, and the roadmap's own
> `Resolved when:` accepts a fourth outcome — *"an evidence record names the
> lapse as deliberately accepted"*. This is that record.

## What lapses, and when

`docs/contracts/reasoning-discipline-protocol.md:3` carries
`keep-beta-until: 2026-09-14`. It is absent from
`src/config/lapsed-beta-baseline.json`, so on **2026-09-15** it enters
`check_beta_review_markers`'s FRESH branch — `LAPSED_SEVERITY_FRESH = 'error'`
— rather than the inherited-warning branch that holds the other 84. A single
fresh lapse takes the gate's exit code to 1, which reds **every** pull request
in the repository, not only reasoning-surface changes.

Measured at the commit carrying this file:

```
$ ./scripts-run src/scripts/check_beta_review_markers
84 violation(s) across 84 distinct contract(s)
Frozen baseline: 85 entries · 84 still reported as lapsed · 1 inert
exit 0

Upcoming FRESH lapses within 14 day(s) — advisory, exit code unchanged:
   docs/contracts/release-sizing.md: keep-beta-until=2026-09-10 in 4 day(s) [fresh]
   docs/contracts/reasoning-discipline-protocol.md: keep-beta-until=2026-09-14 in 8 day(s) [fresh]
   docs/contracts/harness-expectations.md: keep-beta-until=2026-09-15 in 9 day(s) [fresh]
   docs/contracts/install-layout.md: keep-beta-until=2026-09-15 in 9 day(s) [fresh]
   docs/contracts/install-scopes.md: keep-beta-until=2026-09-15 in 9 day(s) [fresh]
   docs/contracts/surface-tiers.md: keep-beta-until=2026-09-15 in 9 day(s) [fresh]
```

**The roadmap named one contract; the horizon it asked for names six.**
`docs/contracts/release-sizing.md` lapses on **2026-09-10**, four days out —
sooner than the contract this roadmap was written about, and unowned by any
roadmap, stub or blocker at the time of writing. That is the report doing the
job it was added for, on its first run, and it is recorded here because it is a
finding this roadmap did not predict rather than a confirmation of one it did.

## Why nothing was decided

The three actions the contract's own rules allow — promote to `stable`, extend
the window with a new date, record it superseded — are each a public statement
about what consumers may rely on. `decision-revisit-gate`'s reserved set puts
"creates / removes / weakens a … public commitment" out of agent reach, and the
blocker's `Recommendation:` field says so in terms: *"none; this is the owner's
call."*

The owner delegated blocker disposition to an AI council for this run. The
council was asked twice.

**Round 1** (2 seats, 2026-09-06) split. Both seats held, without qualification,
that promotion, extension and supersession are all owner-reserved. They differed
on whether a bounded, factual record about the contract is itself a reserved
act.

**Round 2** asked the narrower question the run's own instructions supply: given
that the owner cannot be reached, does this re-scope (meet the criterion now
without a reserved choice) or descope (transfer the substantive decision)? It
split again, and the two positions were **not symmetric**:

- One seat proposed a minimal one-month bridge to 2026-10-15, conceding that
  descoping was available and merely preferring the bridge.
- The other held that moving a published lapse date is itself a commitment
  change, and that *"urgency does not enlarge delegated authority."*

The disposition adopted is the one **neither** seat calls unauthorized:
**descope. The date is not moved.** A bridge is authorized by one seat and
refused by the other; leaving the date alone is refused by neither.

## What is accepted, in terms

On **2026-09-15**, absent an owner disposition,
`docs/contracts/reasoning-discipline-protocol.md` lapses fresh and
`check_beta_review_markers` exits non-zero repository-wide. **This consequence
is recorded and accepted rather than avoided through an unauthorized commitment
change.**

The protocol remains `stability: beta`. Its `keep-beta-until: 2026-09-14` marker
is unchanged. Nothing here waives, extends, satisfies, or defers the underlying
review obligation, and nothing here is a statement about the protocol's quality
or its readiness for promotion.

**Roadmap closure is not substantive resolution.** The roadmap
`road-to-a-beta-window-that-is-not-a-surprise` closes because the mechanism it
was written to build — a horizon that makes the next lapse visible before it
lands — is built and tested. The decision it routed remains outstanding and is
carried in `agents/roadmaps/stubs/road-to-fresh-beta-lapses-2026-09.md`.

## What would change this

Any of the three authorized actions, taken by the owner. The stub carries them
with their commands. This record is not a lock and does not need superseding to
be acted against: promoting, extending, or superseding the contract before
2026-09-15 makes the accepted consequence not occur, which is the outcome this
record would prefer and has no authority to produce.
