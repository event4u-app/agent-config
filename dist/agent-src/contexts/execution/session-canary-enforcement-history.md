# Session Canary — Enforcement History

Loaded by [`session-canary`](../../rules/session-canary.md). Four dated
conformance audits of the canary carrier, moved here verbatim so the rule
states its obligation and this file holds the record behind it. Nothing was
rewritten; the measurements and their stated limits are as they were written.

**What that fixed, stated because it was measured.** Conformance audit, 30
sessions, 2026-08-06, under session-scope-only injection: opening canary dropped
on ~13 of 15 task starts, often present only in the closing summary, twice
carrying a name the settings chain did not resolve; the honesty clause fired
zero times. The frequency join in `check_enforcement_coverage.ts` now reports the
carrier as covering the obligation — which is a claim about firing, not about
compliance.

**What the second audit found: the carrier fires and compliance did not
follow.** Conformance round 5, 2026-08-07, reading the five highest-turn
sessions with the carrier bound per turn: opening canary dropped on **24 of 29**
task starts, the honesty clause fired **0** times, and the wrong name was
emitted **twice** — "Mathias", which resolves from no layer of the chain
(`identity.name` is `Matze`, `git config user.name` is `matze4u`), i.e. inferred
from the ambient environment rather than read from settings. 24/29 against the
earlier 13/15 is not a fall, and the two windows are not identical, so they are
stated side by side rather than as a trend — but nothing here supports the claim
that the miss rate moved. A reminder in context is therefore not a mechanism for
this obligation: at higher frequency it is the same request, more often.

**What the next mechanism has to be.** Not another injection. It has to be able
to **refuse** — a check at delivery (`stop` is block-capable on this host, so a
refused turn-end continues in the same turn) that rejects a task-start reply
carrying no greeting. Proposed, not shipped; until it is, this obligation is
model-carried in practice, whatever the frequency join reports.

**Round 7 downgrade: that proposed mechanism is UNDECIDABLE as written, and the
obligation splits into a measured half and an unmeasurable one.** A *task* start
is recorded nowhere in a transcript — there is no task event on any host, and
`user-interrupt-priority`'s continuation/clarification/interrupt distinction is a
judgement, not a field. So a delivery check "that rejects a task-start reply" has
no way to know a task started. The proposal is not merely unbuilt; as specified it
cannot be built, and saying "proposed, not shipped" implied otherwise.

What IS decidable is the per-**session** instance, and it was measured rather than
asserted — reproducibly, which took a correction: the probe resolves the name
through the same settings layers this rule names and REFUSES when no layer carries
one, so the figure below is reproduced with the name passed explicitly
(`./scripts-run src/scripts/probe_session_canary --limit 30 --name <your name>`;
the first version hardcoded a maintainer's nickname as its default, which made the
number irreproducible for anyone else and silently read 0 %). Over 30 sessions on
2026-08-12: the opening greeting is present in **25 of 28** sessions carrying
assistant prose (89.3 %), and in **24 of 25** post-carrier (96.0 %). Of the three
misses, two predate the carrier (2026-07-21, 2026-07-29) and one is a session whose
first thirty turns were tool calls.

Both halves of that are load-bearing. The carrier works exactly where it has a
slot — `session_start` — which is why the session-scope figure is high; and the
24-of-29 task-start figure above is not contradicted by it, because the two count
different events. The honest statement is therefore: **session-scope compliance is
measured and good; task-scope compliance is unmeasured and unmeasurable with
today's transcript, and no gate can change that until a task boundary is recorded
somewhere.** Do not read the 96 % as covering the obligation as a whole.

**The wrong-name half needs nothing, and that is worth stating.** The beat
already carries the resolved value — `build_canary_reminder` emits
`Canary active for "<name>"`, and the hook no-ops when no layer resolves a name —
and both wrong-name occurrences predate it: 2026-08-04, where the per-turn beat
landed 2026-08-06. The inference path they measure is already closed, so a third
audit should not re-open it.
