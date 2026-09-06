<!-- evidence-type: analysis -->

# ADR-134's dated expiry is unrouted — a pre-registered compliance finding

Recorded 2026-09-06 by the autonomous drain run of
`road-to-a-dated-trigger-that-decides`, Phase 3. It closes that roadmap's
Phase 3 and closes **nothing** about ADR-134.

## The two things this file separates, because they are easy to conflate

**Roadmap closure.** The roadmap's Phase 3 asked for one thing an agent can do:
make the choice ADR-134 puts to the maintainer visible and dated, and record the
outcome. That is done, and this file is the record.

**Substantive resolution.** ADR-134's own terms give the maintainer exactly two
actions — post the launch decision, or commit a superseding deferral record with
a signed reason and a new expiry at most 90 days out. **Neither has been taken,
neither is taken here, and neither may be taken by an agent.** Both are public,
external commitments about this package and sit in `decision-revisit-gate`'s
owner-reserved set. Nothing in this file changes ADR-134's status, extends its
expiry, or discharges the action it names.

## The finding

`docs/decisions/ADR-134-launch-decision-dated-defer.md:10-16` opens its
`review_trigger` with `Expiry 2026-09-15` and states the consequence of a lapse
in its own words:

> A lapsed expiry with neither action is an open compliance finding for the next
> review cycle, not a silent extension.

As of 2026-09-06 the expiry is **nine days out and unrouted**: no record in
`docs/decisions/` supersedes ADR-134, and no launch decision has been posted.
The finding is filed now rather than on 2026-09-16 so that the record exists
before the date rather than after it; if either owner action is taken before
2026-09-15 this finding is spent, and the action supersedes it.

Reproduce the state at any date:

```bash
./scripts-run src/scripts/adr_cite_check ADR-134 --as-of=2026-09-14T00:00:00Z   # trigger state not-fired
./scripts-run src/scripts/adr_cite_check ADR-134 --as-of=2026-09-15T00:00:00Z   # trigger state fired
```

Before this run the same command reported `trigger state indeterminate` on every
date, because the tool treated every `review_trigger` as a semantic condition. A
date is not one, and that is the whole of what changed.

## What is NOT claimed here

The expired-action question is **not** answered, and this file must not be read
as answering it. It does not say the action is unnecessary, that it is deferred,
that the expiry is extended, or that anything about it is satisfied. It says
only that the date is on the calendar, that the action is unrouted, and that
ADR-134 already wrote down what a lapse means.

## Where the substantive question lives

`agents/roadmaps/stubs/road-to-adr-134-expiry.md` — the date carrier created for
exactly this, which also records the ADR-133 consequence: condition (d) of
ADR-133's freeze is met only through ADR-134's OR arm, so the freeze re-arms on
2026-09-15 unless ADR-134 is resolved or succeeded first. That stub is not
duplicated here and is not superseded by this file.

## The decision behind the transfer

AI council, 2026-09-06, two seats, two rounds, under the maintainer's standing
delegation for the drain run. **Unanimous:** posting the ADR-134 launch action
and writing a superseding deferral are owner-reserved public commitments, so the
blocker `adr-134-expiry-owner-action` descopes — the roadmap dependency closes,
the substantive decision transfers to the owner and to the stub above. A council
may refuse a proposal that would lower a floor; it may not accept one that
creates an external commitment, and neither may this run.
