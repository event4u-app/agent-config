# Collector operations — stopping it, what it may cost, and which mode you are in

The supervised telemetry collector is **default-off**. This page is for the
moment when it is on and you need it to stop, or you need to know whether it is
running at all. It is deliberately short and deliberately not in a roadmap: a
kill switch documented inside a planning file is a kill switch nobody finds
under pressure.

Source of truth for every number and mechanism here:
`src/scripts/_lib/collector_supervision.ts`. Where this page and that module
disagree, the module is right and this page is a bug.

## Stop it now

```bash
touch ~/.event4u/agent-config/agent-collector/STOP
```

That is the whole switch. Its **presence** is the signal; nothing reads its
contents. Two things follow immediately:

- No collector can start. `acquireRuntimeLock` refuses while the marker exists,
  so a supervisor restart loop cannot bring it back.
- Every dispatch resolves in **static mode** — the no-collector path. Nothing is
  captured and nothing blocks.

To also end a process that is already running:

```bash
./scripts-run src/scripts/collector_daemon stop
```

It latches the switch first (so a supervisor cannot restart what you just
stopped), then sends `SIGTERM` and escalates to `SIGKILL` after a grace period.
The escalation is not optional — a collector that has installed a `SIGTERM`
handler and does not honour it is stopped by `SIGKILL`, which is why the two
supported platform rows are both Unix.

Two flags exist and neither is a default:

| Flag | What it does | When you want it |
|---|---|---|
| `--no-latch` | stop the process WITHOUT creating the `STOP` marker | you want it to come back on the next start |
| `--signal-stale` | signal a heartbeat older than 90 s anyway | you know that pid is still the collector |

**`stop` refuses a stale heartbeat by default, and that refusal is deliberate.**
A beat older than the staleness threshold names a pid this package can no longer
vouch for — the process it belonged to may be long gone and the number recycled
onto something else — so aiming a `SIGKILL` at it is the worst thing the kill
switch could do. You get `stale-refused` and an explanation instead of a dead
stranger.

> This page previously said the verb did not exist and that "until it lands
> there is no process to end". The collector landed and the paragraph was not
> replaced; a completion review caught it. The sentence is kept as a note rather
> than deleted because an operator page that was wrong once is worth being able
> to date.

**Undo:** delete the marker.

```bash
rm ~/.event4u/agent-config/agent-collector/STOP
```

## Is it running?

```bash
cat ~/.event4u/agent-config/agent-collector/heartbeat.json
```

Three states, and the middle one is why this is a file rather than a boolean:

| State | What you see | What it means |
|---|---|---|
| `absent` | no heartbeat file | nothing claims to be running |
| `stale` | `last_heartbeat` older than 90 s | something claimed to be running and has stopped beating — **likely dead** |
| `running` | `last_heartbeat` within 90 s | alive |

A silently dead collector that still looks healthy is the failure this
three-valued reading exists to prevent: an understated capture rate reads as a
product finding rather than as an outage.

## What it is allowed to cost

Four budgets. Crossing a ceiling **stops** the collector — it never throttles
it, because an observer that has become a load is no longer an observer.

| Resource | Ceiling | Expected peak | Headroom | Peak from |
|---|---|---|---|---|
| CPU | 2 % of one core, 60 s average | 0.2 % | 1.8 % | derived |
| Resident memory | 192 MiB | 128 MiB | 64 MiB | **measured** |
| Disk (collector directory, incl. quarantine) | 64 MiB | 12 MiB | 52 MiB | derived |
| Open file descriptors | 128 | 48 | 80 | **measured** |

**Two rows are measured and two are still derived, and the table says which.**
The first draft derived all four. The first real daemon start falsified two of
them within seconds — resident memory read 116.2 MiB against a 96 MiB ceiling
and the collector budget-stopped itself — so those rows were re-measured rather
than the ceiling being nudged up to make the reading fit.

The measurement is **macOS, under `tsx`**, which loads a TypeScript transpiler
into the same process. A built-JS daemon would very likely read far lower; the
budget is calibrated to the mode this repository actually runs. `RESOURCE_BUDGETS`
carries the per-row basis and the conditions that would re-open each number.

## Static mode and daemon mode

They are **mutually exclusive per OS user**, and the exclusion is enforced by a
lock rather than by convention:

```
~/.event4u/agent-config/agent-collector/collector.lock
```

Two checkouts of this repository — two worktrees, the common case — resolve to
the same lock. The second one does not get a second collector; it gets static
mode. That refuses duplicate capture (one dispatch counted twice) and version
skew (two revisions disagreeing about the schema), neither of which is worth
solving for an instrument whose entire purpose is an accurate ratio.

A lock whose recorded pid is not alive is **fenced** — taken over — so a crashed
collector does not lock its successor out forever.

## Which platforms are supervised

Positively probed, never assumed.

| Platform | Supervisor | Tier |
|---|---|---|
| macOS | per-user `launchd` agent under `~/Library/LaunchAgents/` | supported |
| Linux with a user session bus | `systemd --user` under `~/.config/systemd/user/` | supported |
| Linux without a user session bus (containers, minimal images, CI runners) | none | static fallback |
| Windows | none evaluated | static fallback |

Neither supported row needs administrator privilege, and neither installs
anything outside your home directory. **`systemd` being installed is not the
condition** — a user session bus must exist, which is what the probe checks.
Windows is `static fallback` because no Windows supervisor has been evaluated:
unevaluated, not refused.

## If something went wrong

| Symptom | Where to look |
|---|---|
| A record with a field the schema forbids | the write was **refused**, not dropped — `collector_store.writeRecord` returns `refusal: 'invalid-record'` with every error |
| A store this revision cannot read | it was moved to `agent-collector/quarantine/`, unread and byte-for-byte. It is never deleted, including by `uninstall` — it is evidence |
| Two collectors | cannot happen inside one OS user; if you believe it did, the lock file and both heartbeats are the evidence to keep |
| `stop` says `stale-refused` | the heartbeat is older than 90 s, so its pid may have been recycled. Confirm the pid is really the collector (`ps -p <pid> -o args=`), then re-run with `--signal-stale` |
| `stop` says `unreachable` | the process exists and did not die after `SIGKILL` — almost always a permissions mismatch (a collector started by another OS user). The `STOP` marker still latched, so nothing will restart it |

## See also

- `docs/contracts/resident-process-floors.md` — the observation-only contract
  and the five questions every resident process answers.
- `src/scripts/_lib/collector_supervision.ts` — the module this page describes.
- `src/scripts/_lib/collector_store.ts` — opt-out, deletion, quarantine.
