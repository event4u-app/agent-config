<!-- evidence-type: analysis -->

# The warn-only window for `concern_sla_ms`, read out and tallied

Closes blocker `warn-only-window-not-elapsed` on
`road-to-a-kernel-that-guards-its-plumbing`. That blocker refused "a span of
runs a human can read" as a judgement and replaced it with four quantified
conditions; this is the reading against them, taken 2026-10-03.

The window was never a measurement to TAKE. `concern_sla_ms` was registered on
2026-10-01 and has not changed since (`db000c50c`, the only commit touching
those rows). The CI `Static Checks` job runs `bench_hook_latency` three times
per job — one gated `--gate --via-cli` pass and two ungated diagnostic passes —
and each pass prints one `warn-only window:` line. So the readings accumulated
on their own and this harvests them.

## The tally against (a)-(d)

| Condition | Floor | Read | Verdict |
|---|---|---|---|
| (a) bench runs printing a clean `warn-only window:` line | 10 | **69** | met, 6.9x |
| (b) distinct CI runner sessions | 2 | **23** | met, 11.5x |
| (c) runs reporting INCOMPLETE | 0 | **0** | met |
| (d) the 1 vCPU `hardware_reference.floor` class sampled, or a recorded decision to flip without it | 1 sample or a decision | **3 passes, sampled** | met by sampling, not by decision |

Every one of the 69 lines is the clean form verbatim:

```
✅  warn-only window: 9 of 9 bounded and measured, none over `sla_ms × 3` on this run.
```

Zero `INCOMPLETE` lines and zero overrun lines, so the reset rule
("any run naming an overrun ENDS the window") never fired.

## The runs, each one a distinct ubuntu-latest runner session

Harvested from the `Static Checks (ESLint · typecheck · prepack)` job of the
`tests.yml` workflow on `main`, every run created after the registration
commit. Three lines per job, all clean.

| Run | Created (UTC) | Commit | Clean lines | INCOMPLETE | Over |
|---|---|---|---|---|---|
| `37096453979` | 2026-10-03T04:24:50Z | `ab516fc19` | 3 | 0 | 0 |
| `37092879847` | 2026-10-03T03:20:39Z | `7fdfd0a4d` | 3 | 0 | 0 |
| `37084585520` | 2026-10-03T01:03:15Z | `95dc7bfb1` | 3 | 0 | 0 |
| `37074099201` | 2026-10-02T22:44:37Z | `59824fd95` | 3 | 0 | 0 |
| `37069532368` | 2026-10-02T21:54:10Z | `cd26c2e17` | 3 | 0 | 0 |
| `37065608566` | 2026-10-02T21:14:12Z | `9e2fe189e` | 3 | 0 | 0 |
| `37011226901` | 2026-10-02T13:10:18Z | `6bdc2b25b` | 3 | 0 | 0 |
| `37007924252` | 2026-10-02T12:38:44Z | `a3c839340` | 3 | 0 | 0 |
| `37002675404` | 2026-10-02T11:44:33Z | `48712607a` | 3 | 0 | 0 |
| `36996765797` | 2026-10-02T10:40:27Z | `379cd535c` | 3 | 0 | 0 |
| `36990490914` | 2026-10-02T09:33:45Z | `21da71917` | 3 | 0 | 0 |
| `36975956505` | 2026-10-02T06:56:03Z | `4399b5a0d` | 3 | 0 | 0 |
| `36969637076` | 2026-10-02T05:35:42Z | `495880908` | 3 | 0 | 0 |
| `36967902937` | 2026-10-02T05:12:29Z | `074eee688` | 3 | 0 | 0 |
| `36964927573` | 2026-10-02T04:31:29Z | `90a0ad522` | 3 | 0 | 0 |
| `36958552044` | 2026-10-02T03:04:51Z | `aead73d28` | 3 | 0 | 0 |
| `36916391769` | 2026-10-01T19:43:33Z | `c399d097e` | 3 | 0 | 0 |
| `36883767577` | 2026-10-01T15:22:40Z | `213d87055` | 3 | 0 | 0 |
| `36861207018` | 2026-10-01T12:21:25Z | `29b183256` | 3 | 0 | 0 |
| `36838005596` | 2026-10-01T08:42:31Z | `9bc8cd4f2` | 3 | 0 | 0 |
| `36830900123` | 2026-10-01T07:32:19Z | `396fbbc27` | 3 | 0 | 0 |
| `36828325651` | 2026-10-01T07:05:20Z | `d9ae1da3f` | 3 | 0 | 0 |
| `36824668894` | 2026-10-01T06:25:12Z | `4e803d620` | 3 | 0 | 0 |

23 jobs × 3 = **69**. Each job ran on its own ephemeral runner — the 22 jobs
whose runner name was also captured carry 22 distinct `GitHub Actions NNNNNNN`
identifiers, so (b)'s "not ten pushes on one machine" is satisfied by
construction rather than by assumption.

## (d): the 1 vCPU reference class, sampled rather than waived

The budget's own `_what_these_numbers_do_NOT_cover` block says both measured
classes behind the registered values are FASTER than the 1 vCPU container
`hardware_reference.floor` documents, and that nothing had sampled it. The
blocker allowed either a sample or a recorded decision to flip without one.
This takes the sample.

Environment, as the container reported it:

```
nproc=1  cpu.max=100000 100000  cpuset=0
node=v20.20.2 availableParallelism=1 platform=linux-arm64
```

Three `--runs 20` passes. All three printed the clean window line. Worst
per-concern p95 across the three passes, against the bound `sla_ms × 3`:

| Concern | `sla_ms` | bound (ms) | worst 1 vCPU p95 (ms) | margin |
|---|---|---|---|---|
| `evidence-independence` | 0.956 | 2.868 | 0.565 | **5.08x** |
| `block-kernel-rule-writes` | 0.639 | 1.917 | 0.310 | 6.18x |
| `run-continuation` | 1.232 | 3.696 | 0.463 | 7.98x |
| `one-question-per-ask` | 0.733 | 2.199 | 0.249 | 8.83x |
| `block-plumbing-writes` | 0.614 | 1.842 | 0.186 | 9.90x |
| `block-no-verify` | 0.921 | 2.763 | 0.263 | 10.51x |
| `block-config-weakening` | 0.637 | 1.911 | 0.134 | 14.26x |
| `turn-end-gate` | 1.587 | 4.761 | 0.282 | 16.88x |
| `block-speaking-inbox-dir` | 0.564 | 1.692 | 0.098 | 17.27x |

Tightest margin on the documented floor class: **5.08x**, `evidence-independence`
in pass 3. The raw bench output of all three passes is in the branch's PR body
rather than committed here, because the per-slot numbers it also carries are a
measurement of one container and would read as a second budget source.

## What this window does and does not license

It licenses the bound as an **observation**, which is all the blocker asked of
it: "harness observation is what this blocker asks for. Widening it to a runtime
warn-only path is a dispatcher change and belongs to step 3.3."

It does **not** license `sla_ms × 3` as a runtime timeout, and step 3.3
declines to wire it for a reason these readings cannot answer. `concern_sla_ms`
is derived from the dispatcher's own per-concern `duration_ms`, which brackets
the concern's own work; a `spawnSync` timeout must also cover fork, interpreter
start and module load. The same bench runs that produced the 69 clean lines
measure that term alone — the `control (node -e 0)` row — at p95 **17 ms** on
the 1 vCPU class and **26 ms** on the GitHub runner, against a whole bound of
1.7 to 4.8 ms.

Wired anyway and probed against the real dispatcher on this branch: with
`AGENT_CONFIG_HOOKS_ISOLATED=1` on `claude/pre_tool_use`, all six blocking
concerns returned `ETIMEDOUT`, left no verdict, and were resolved by the new
severity branch into a deny — exit 2 on an ordinary `Read`. That is Risk 1 of
the owning roadmap firing on every host rather than on a slow one.

So the window closes clean and the timeout clause stays unwired. The two facts
are not in tension: the readings validate the number as a thing to watch, and
the unit mismatch is what stops it being a thing to enforce. A reading taken on
the in-process route cannot bound a spawn, however many of them there are.
