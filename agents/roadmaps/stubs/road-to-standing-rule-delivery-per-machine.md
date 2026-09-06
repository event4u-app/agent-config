---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: road to a standing-rule-delivery reading on every team machine

> **Stub — not active work.** Drain-run transfer, 2026-08-21, from
> [`road-to-standing-context-40k.md`](../archive/road-to-standing-context-40k.md)
> step 0.1 and AC-0. Council disposition **B**, outcome state **transferred**,
> 2/2 quorum — record in
> [`standing-context-40k-disposition.md`](../../evidence/council/standing-context-40k-disposition.md),
> framework in
> [`drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md).
> Moved here because the remaining criterion needs two things no repository
> automation can supply: another person's filesystem, and a write to a
> per-machine settings file.

> **Arrivals:** the standing-payload subject appears in **15** consumed inbox
> rounds under `agents/tmp.old/` (measured 2026-09-06, `grep -rl "standing
> payload\|138k\|138,273"`, distinct round directories). Latest
> `inbox-2026-09-r`. A floor on the recurrence, not a count of asks for this
> stub. Written here so the next round meets a number.

## The original criterion, verbatim

> **0.1** Run the standing-rule-delivery dev task on the maintainer machine and
> on each affected colleague machine. A red result means the machine predates the
> installer gate: apply the `claudeMdExcludes` suppression for the unchosen
> layer — one settings entry, no deletion of anything.
> `verify:` the task's own output, recorded per machine with its date.

> **AC-0:** every machine in the team reports under the governed cap on that
> gate, or carries a dated exemption note saying why it does not.

## What moved here — the complete list

1. Step 0.1 in full, including the maintainer machine's **remedy**.
2. AC-0 in full.

Nothing else from the parent moved to this stub. Steps 2.1 / 2.2 went to the
payload-diet roadmap and step 3.0 / 3.1 to
[`road-to-instructions-loaded-observer.md`](road-to-instructions-loaded-observer.md).

## What the drain run DID execute, and why it does not close the step

The maintainer machine's reading was taken, which is the half an agent can reach:

```
$ task dev:standing-rule-delivery          # 2026-08-21, maintainer machine
  global    115 file(s)    115781 tok
  project    92 file(s)     81577 tok
  overlap    91 rule(s) in both layers (85 duplicate, 6 divergent)
  TOTAL           197358 tok / 110000 cap (179.4%)
❌  exceeds the 110000 cap
```

Full probe record:
[`standing-context-40k-host-and-machine-probes.md`](../../evidence/investigations/standing-context-40k-host-and-machine-probes.md) § 2.

Two reasons that reading does not discharge the step, and the council split on
the first one:

- **AC-0's population is the team, not a machine.** One dated red reading is
  evidence; the criterion asks that *every* machine report. This is the adopted
  (openai) reading. The anthropic seat would have read the step as `narrowed`
  with the measurement obligation discharged; the dissent is recorded in the
  council file and changes nothing about the work below.
- **Every remedy is a Rule 3 act.** `claudeMdExcludes` is a per-machine settings
  write — a host-env modification — so the council may record its preference and
  may not record the action as done. This holds for the maintainer's own machine
  too, which is why the maintainer remedy is in this stub rather than closed in
  the parent.

The defect is also **growing**, which is the argument for not letting this sit:

| Date | Delivered rule prose | Cap |
|---|---:|---:|
| 2026-08-08 | 176,354 tok | 110,000 |
| 2026-08-21 | **197,358 tok** | 110,000 |

**+21,004 tok in thirteen days**, and 6 of the 91 doubled rules are *divergent* —
the same basename with different content in the two layers, which a filesystem
sum can see and a reader cannot.

## Named producer

**`matze4u` (Mathias Berg)**, the repository maintainer, is the accountable
producer, and each affected machine's own owner performs the local run.

Naming the colleague machine owners is **not possible from this tree**, and that
is stated rather than papered over with a role label: no artefact under
`agents/` enumerates the team, and
[`road-to-maintainer-bus-factor.md`](../archive/road-to-maintainer-bus-factor.md)
measured **1** distinct reviewer over the trailing 90 days. If the affected set
turns out to be one machine, this stub closes with one run and one settings
entry.

## Probe — re-entry, per machine, mechanically decidable

Per machine, one command and one of two outcomes:

```bash
task dev:standing-rule-delivery      # exit 0 = under cap
```

- **Exit 0** → that machine reports green; record the output with its date.
- **Non-zero** → apply the suppression for the unchosen layer, then re-run:

```bash
agent-config install --layer=global   # or --layer=project
task dev:standing-rule-delivery       # must now exit 0
```

The stub closes when every machine in the affected set carries either a dated
exit-0 output or a dated exemption note saying why it does not.

**Baseline at transfer (2026-08-21):** maintainer machine **non-zero**, 197,358
tok / 110,000 cap (179.4 %). Colleague machines: **no reading exists**, and none
can be taken from here.

## What this stub does NOT authorise

The suppression is reversible and deletes nothing, but it is still a settings
write on someone's machine: it needs its own this-turn approval naming the exact
object (which layer, which machine), exactly as it would have inside the parent.
Nothing here pre-approves it.
