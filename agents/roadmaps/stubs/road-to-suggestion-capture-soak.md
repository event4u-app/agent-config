---
complexity: lightweight
review_by: 2026-12-24
---
# Stub: the suggestion-capture soak window

> **Stub — not active work, and a DRAIN-RUN TRANSFER** in the sense
> [`README.md`](README.md) § The two classes defines: work already planned and
> specified in an active roadmap, transferred out when an autonomous drain run
> reached it and found it needed something no repository automation can supply.
> **Capability-gated, never demand-gated** — the shared promotion criteria
> (recruited customer, funded audit, ADR sign-off) do NOT govern it. It is
> promoted by its own named probe returning true, and by nothing else.

## What was transferred, verbatim

From `agents/roadmaps/archive/road-to-suggestion-block-capture.md` Phase 3, on an AI
council verdict of 2026-08-24 (2/2 convergent after a first attempt reached only
1 of 2 — `anthropic/claude-sonnet-4-5` + `openai/codex-default`; the maintainer
delegated capability-gated dispositions to the council for that drain run).

- **3.1 Run the soak window** (length fixed in the claim entry before the window
  starts) with a contemporaneous manual emission log kept by the maintainer, so
  "blocks emitted" has a reading independent of the instrument under test.
- **3.2 Resolve `claim:suggestion-capture-rate`** — greater than zero and rising,
  or DROP. Publish the figure in the claim entry in the citable form the parked
  consumers' resume conditions name.
  verify: the verdict PR flips the claim status and `check_claims` resolves the
  cited figures; the consumer roadmaps' resume text needs no edit to point at it.
- **AC-2's remaining half** — *"On the maintainer workspace, … one-live-turn-demonstrated"*.
  Transferred 2026-08-24 after the integration defect it was blocked on was found
  and fixed; see § What this stub does NOT cover for what changed and why the
  earlier carve-out is void.
- **AC-4**, transferred **unresolved** rather than re-scoped: *"`claim:suggestion-capture-rate`
  carries a resolved verdict with a citable figure, in the form the parked
  consumers' resume conditions name — or a recorded DROP that parks them
  honestly."*

## Why no automation can supply it

The window's **denominator is a human's record**. The claim's own falsification
clause requires "blocks emitted" to have a reading **independent of the
instrument under test** — without it the instrument measures only itself and no
rate is claimable. An autonomous run cannot manufacture that independence: it
would be counting its own output twice and calling the second count a control.
Both council seats reached this independently; the second put it as *"an
autonomous run cannot manufacture the independent denominator without making the
measurement circular."*

Fourteen days is also wall-clock a run does not have, but that is the lesser
half — a shorter window with a real independent denominator would still be
science; a fourteen-day window without one would not.

## Probe and its named producer

**Producer:** the maintainer, on a workspace with
`hooks.suggestion_capture.enabled: true`.

**Probe — `probe:suggestion-capture-soak-evidence-ready`.** Returns true only
when **all** of:

1. `agents/runtime/state/audit/suggestion-capture.jsonl` carries lines whose
   timestamps span an uninterrupted **14-day** window (the length fixed in
   `src/config/suggestion-capture.json` § soak_window **before** any capture code
   ran);
2. a maintainer-kept emission log covering **the same** window exists and is
   readable — the independent denominator;
3. the two are comparable, i.e. the log records block emissions in a form the
   sink's `block_emitted` count can be divided into.

```bash
# Condition 1, mechanically:
python3 - <<'PY'
import json, datetime as dt
rows = [json.loads(l) for l in open('agents/runtime/state/audit/suggestion-capture.jsonl')]
ts = sorted(dt.datetime.fromisoformat(r['ts'].replace('Z','+00:00')) for r in rows)
print(len(rows), 'lines', (ts[-1]-ts[0]).days if ts else 0, 'day span')
PY
```

Conditions 2 and 3 are **not** mechanically checkable, and that is the point
rather than a gap: the whole reason this is a stub is that a repository gate
cannot see a human's notebook.

**Baseline on the transfer date, so a later reader can tell movement from noise:**
the sink does not exist. Zero lines, zero days of span. The instrument is live
and default-OFF; nothing has been captured on any workspace.

### The 14-day clock starts at verified deployment of the FIXED instrument

```
NO OBSERVATION MADE BEFORE THE 2026-08-24 SIGNATURE FIX IS ADMISSIBLE.
A ZERO READING FROM THAT PERIOD MEASURED A BROKEN INSTRUMENT, NOT AN ABSENCE.
THE CLOCK STARTS AT VERIFIED DEPLOYMENT, NEVER AT THE COMMIT TIMESTAMP.
```

AI council 2/2 on 2026-08-24, and the reason is sharper than "it was broken":
the concern returned exit 0 with no output, so a zero reading during that period
is **ambiguous** — nothing to capture, or nothing capturable? The claim's own
falsification clause reads *"a window in which the maintainer's log records
blocks emitted and the sink carries zero lines DROPS this claim"*. Applied to
the broken period that clause would have dropped the claim **for the wrong
reason**, and the drop would have parked three consumer roadmaps as
permanently unsatisfiable on the strength of a bug.

One seat added the refinement that is now normative here: the clock starts at
**verified deployment to the maintainer workspace**, not at the fix commit. A
repaired instrument that has not reached the workspace still cannot collect a
valid observation.

The same seat noted that AC-2's remaining half and this clock start can be
discharged by ONE session: run the four classified cases plus an ordinary turn
on the real host, verify the persisted lines, record the deployment timestamp,
and begin the fourteen days there.

## What this stub does NOT cover

- **The instrument itself.** It shipped: `suggestion_capture_hook.ts`, 30 unit
  tests, manifest entry on claude `stop` + `user_prompt_submit`, latency measured
  at p95 71 ms / 109 ms against a 250 ms cap with the budget file untouched.
- ~~**AC-2's live-turn half**~~ — **that carve-out is void as of 2026-08-24 and
  AC-2 is now transferred here too.** The sentence below is kept verbatim rather
  than edited away, because it was correct when written and the reason it stopped
  being correct is the useful part.

  > *"which is a DIFFERENT gap and deliberately stayed with the active roadmap:
  > it is an integration failure to isolate, not a missing human."*

  The integration failure WAS isolated, and it was not what anyone suspected:
  `main(now: Date = new Date())` did not match the `main(argv)` shape the
  dispatcher calls, so `now.getTime()` threw on every live turn and the
  instrument's own catch swallowed it — exit 0, no output, indistinguishable from
  a disabled hook. Fixed, with six regression tests through `CONCERN_REGISTRY`
  and a registry-wide signature contract test. All four classifications then
  reproduced live through `./agent-config dispatch:hook`.

  What is LEFT of AC-2 is its first three words — *"On the maintainer
  workspace"*. AI council 2/2 (2026-08-24) read that as an environmental
  qualifier rather than description: a temp project driven by the CLI proves the
  mechanism CAN fire, not that it fires where a user meets it. An autonomous run
  cannot supply a real host session with a real user picking an option without a
  user round-trip, which is exactly the class this stub carries. So AC-2's
  remaining half is now *a missing human*, and the carve-out that excluded it no
  longer applies.
- **The three consumer roadmaps.** `later/road-to-composite-dispatch-topology`,
  `later/road-to-cost-parity-2-state-aware-dispatch` and
  `later/road-to-elicitation-front-door` name a citable capture rate in their
  resume conditions. Those conditions are unchanged and still unmet — this stub
  is where the reading they wait for will come from, and it is honest that they
  wait rather than being re-pointed at something weaker.

## Council dissent, recorded because it was not adopted

One seat argued for **archiving** the parent roadmap on transfer, on the ground
that an 11-of-13 roadmap kept active overstates the automatable estate. The other
refused, and the refusal carried: acceptance criteria gate completion
*individually*, so transferring one blocked criterion does not erase a separate
failed one, and AC-2 is unproven for a reason that has nothing to do with this
stub. The parent therefore stays active and the estate count does not drop.

**That refusal's premise expired on 2026-08-24, and the parent is now archived.**
The refusal rested on AC-2 being unproven *"for a reason that has nothing to do
with this stub"* — an integration failure to isolate. It was isolated and fixed;
what remains of AC-2 is a real-host session, which is precisely this stub's
reason for existing. With both open criteria resting on the same missing human,
the first seat's position is the one the evidence now supports, and the parent
was archived with explicit closure language: **closed with two acceptance
criteria transferred, never "fully accepted"**. Recorded this way rather than
rewritten because the dissent was right about the estate and wrong about the
timing, and both halves are worth keeping.

The first seat's alternative probe name —
`fourteen-day-manual-observation-window-complete` — is recorded here rather than
used: it names the duration, and the second seat's name states the *condition*,
which is what a probe has to return true on.
