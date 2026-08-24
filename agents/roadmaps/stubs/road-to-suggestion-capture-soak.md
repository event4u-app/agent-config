---
complexity: lightweight
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

From `agents/roadmaps/road-to-suggestion-block-capture.md` Phase 3, on an AI
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

## The named producer and its probe

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

## What this stub does NOT cover

- **The instrument itself.** It shipped: `suggestion_capture_hook.ts`, 30 unit
  tests, manifest entry on claude `stop` + `user_prompt_submit`, latency measured
  at p95 71 ms / 109 ms against a 250 ms cap with the budget file untouched.
- **AC-2's live-turn half**, which is a DIFFERENT gap and deliberately stayed with
  the active roadmap: it is an integration failure to isolate, not a missing
  human. Both seats were explicit that transferring one blocked criterion does
  not erase a separate unproven one.
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

The first seat's alternative probe name —
`fourteen-day-manual-observation-window-complete` — is recorded here rather than
used: it names the duration, and the second seat's name states the *condition*,
which is what a probe has to return true on.
