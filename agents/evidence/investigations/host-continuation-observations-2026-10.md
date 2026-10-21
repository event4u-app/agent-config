# Host continuation observations — resume and fork on Claude Code

<!-- evidence-type: analysis -->

> Phase 1 rows for `road-to-a-cold-start-paid-once` (steps 1.4 and 1.6; step 1.9 and a 1.4
> follow-up in the 2026-10-21 addendum at the end), filed
> under the observation protocol in
> `src/agent-src/contexts/execution/host-capability-manifest.md` § Observation
> protocol: host, host version, transcript or artifact reference, date. Taken
> **2026-10-17** in a live session on this machine, tree at `origin/main` @
> `2d7b4c090`. Every figure below is copied from a usage block or a ledger
> line; nothing is asserted from the host's documentation.

## Host pin

```
$ claude --version
2.1.302 (Claude Code)
```

Every row below was observed on **2.1.302**. The plan's Context read the host
binary at 2.1.296; nothing here was observed on that version.

## Method

The observing leg was itself a subagent of a roadmap-drain session. It spawned
two children and read two sources for each:

1. **The subagent ledger** —
   `agents/runtime/state/subagent-ledger/2026-10.jsonl` in the main checkout,
   which keys every leg by `ref` (the first 12 hex digits of a SHA-256 of the
   host's per-run id, `subagent_ledger_hook.ts::refFor`). The host id itself is
   not reproduced here, per the plan's AC-4.
2. **The child's own transcript**, read with `jq` for the `usage` block of
   every assistant message and nothing else: `input_tokens`,
   `cache_creation_input_tokens`, `cache_read_input_tokens`. Cache-read share
   is `cache_read / (input + cache_creation + cache_read)`.

Both children were given a one-word task and told to call no tool, so the
first call of each run is the run's cold-or-warm reading with no tool output
mixed in.

## `worker_resume` — step 1.4

One `general-purpose` child on the `haiku` tier, ledger `ref` `57100bbe8a82`,
session `9cc9825f-6723-42e1-8153-5c781ffba2da`. Resumed twice with the host's
message tool.

| Run | Ledger `subagent_start` | Gap since previous request | First call: written | First call: read | Read share |
|---|---|---|---|---|---|
| 1 — fresh spawn | 00:04:53.641Z | — | 198,489 | 0 | 0.0 % |
| 2 — resume | 00:05:03.482Z | ~7 s | 536 | 198,542 | **99.7 %** |
| 3 — resume after a gap | 00:11:57.646Z | 6 min 51 s | 199,657 | 0 | **0.0 %** |

All three starts carry the **same** ledger `ref`, so a resume re-enters the
leg rather than opening a new one — the shape step 1.1's run segmentation
already splits on.

**What run 2 establishes.** A finished leg re-tasked inside the cache window
starts warm: 99.7 % of its first call came from cache, against 0 % for the same
leg's fresh spawn. That is the `worker_resume` criterion's measurable half.

**What run 3 establishes.** After a gap longer than five minutes the resumed
run's first call wrote the whole transcript again and read nothing: a resume
outside the window is a full-price cold start that also replays everything the
worker accumulated. This is the run the plan expected to be cold, and it was.
It is the reading condition (b) of `_lib/worker_reuse.ts` exists for, and it
matches the plan's K1.

**What it does NOT establish — and why the registry row stays absent.** The
criterion says *re-tasked by name*. The dispatch surface this leg had offers no
name parameter at spawn, so the resume was addressed by the host-issued per-run
id, which the host's message tool echoed back as the agent's name. A resume by
a durable, operator-chosen name was not exercised. `worker_resume` is
therefore left out of the `claude` registry row: the warm half is observed, the
addressing half is not, and step 3.1 assumes the latter.

Also observed in passing: `post_tool_use` fires on the message tool that
performs the resume (`agents/runtime/state/tool-result-census.jsonl`, a record
for that tool at 00:05:03.563Z). Whether the pre-tool slot fires there — step
1.5's question — is not answered by this file.

## `fork_shares_cache` — step 1.6

One fork of the observing leg (Opus tier, the parent's model), told to hand
back its own tool list.

| Call | Written | Read | Read share |
|---|---|---|---|
| Fork's first own call | 601 | 248,334 | **99.8 %** |

The fork's transcript opens with the parent's conversation copied in; the
first call **made by the fork** is the first assistant entry timestamped after
the parent's spawning call, and that is the row above.

Tool list reported by the fork: `Agent, Artifact, Bash, Edit, Read, Skill,
ToolSearch, Write, SubagentHandback`, three document-connector tools, and the
two deferred tools the parent had loaded before forking. That is the parent's
list, including the two tools the parent loaded mid-session. The list is the
fork's own report of its tool surface, not a transcript field.

**Verdict:** `fork_shares_cache` — observed `true` on Claude Code 2.1.302. The
fork ran in background mode and still read the parent's prefix, so the premise
in `subagent-orchestration` that background mode "changes the tool set and
invalidates the very prefix" does not hold on this host and version. Written
into the `claude` registry row in `src/scripts/_lib/host_capability.ts`.

## Not observed in this file

Steps 1.5 (the pre-tool admission point on a resume, and whether a resume
counts against the host's concurrency cap), 1.7 (the instruction-skip flag),
1.8 (named spawns under the teams flag) and 1.9 (the rate surfaces) need either
a project-scope agent definition, an environment flag set before the session
starts, or a hook binding this leg cannot add. They stay open; this file does
not stand in for them.

## Addendum 2026-10-21 — rate surfaces (step 1.9) and the spawn surface on 2.1.305

Taken **2026-10-21** on **Claude Code 2.1.305** (`claude --version`), tree at
`origin/main` @ `a2aa408ab`. The observer was a dispatched drain leg; it ran
two child `claude -p --output-format stream-json --verbose` sessions, each in an
empty scratch project holding a one-line `CLAUDE.md`, so this package's rules
could not shape the reply. Both children report `apiKeySource: none` in their
`init` event, i.e. a subscription login rather than an API key. Transcript
references are the children's host session ids: `3c30c4d3-7219-4688-82d7-ac67637fdc79`
(probe A, no extra settings) and `f5be7cd5-3297-47d3-8492-e81a5811e5d3`
(probe B, one `StopFailure` hook bound through `--settings`).

### Step 1.9 — the four rate surfaces

| Surface | Verdict | Host version | Date | What was seen |
|---|---|---|---|---|
| status-line `rate_limits` after the first response | **not reached** | 2.1.305 | 2026-10-21 | Both probes ran in print mode, which runs no status line. No interactive session was opened, so the field was neither seen nor ruled out. |
| `StopFailure` with matcher `rate_limit` | **not reached** | 2.1.305 | 2026-10-21 | Probe B bound it through `--settings`; the session printed nothing on stderr and finished `result:success`, and the hook's log file was never created. No limit was hit, so the event had nothing to fire on. Whether the settings loader would reject an unknown event name was not established: the control probe with a made-up event name was refused by the host's permission classifier and not retried. |
| `api_retry` in a print-mode stream | **not reached** | 2.1.305 | 2026-10-21 | Neither stream carried one. The event types were `system:init`, `system:hook_started`, `system:hook_response`, `system:thinking_tokens`, `assistant`, `rate_limit_event` and `result:success`. No request was retried, so its absence says nothing about whether the type exists. |
| `quota_auto_resume_*` notifications | **not reached** | 2.1.305 | 2026-10-21 | No quota was exhausted in either session. |

**One rate surface that was present, though the step did not name it.** Each
print-mode stream carried exactly one `rate_limit_event`, after the assistant
messages and before the `result` event. Probe B's, copied field for field:

```
{"type":"rate_limit_event","rate_limit_info":{"status":"allowed","rateLimitType":"five_hour",
 "overageStatus":"rejected","isUsingOverage":false,
 "unifiedWindows":{"five_hour":{"utilization":0.67},"seven_day":{"utilization":0.5}}}}
```

(the reset timestamps and the event's own ids are dropped above). Probe A, a
few minutes earlier in the same window, read `five_hour.utilization` 0.63 and
`seven_day` 0.49. So on 2.1.305 a subscription session's five-hour and
seven-day window utilisation is machine-readable in the print-mode stream — a
`claude -p` worker's stdout, not a hook payload. It is not a status-line field
and not a hook event, so no hook-carried guard here can read it as it stands.

### Step 1.4 — the spawn surface still offers no name

Probe A was asked, with no tool call, to list its subagent tool's parameters. On
2.1.305 it reported `description, effort, isolation, model, prompt,
run_in_background, subagent_type`, and reported `SendMessage` as present but
deferred; its `init` event lists the subagent tool as `Task`. There is no name
parameter, so a durable, operator-chosen address at spawn time is still not
offered on this version. This is the parameter list as the child described it,
not a schema dump. The by-name half of step 1.4 stays unobserved, as on
2026-10-17.

### Step 1.5 — attempted, refused, not retried

A third child session was prepared to settle step 1.5: a `PreToolUse` hook bound
through `--settings` to `SendMessage`, which only logs its payload (and, in a
second arm, returns a deny), and a prompt telling the child to spawn one `haiku`
subagent and then re-task it with `SendMessage`. The host's auto-mode
permission classifier refused to run it before it started. It was not
re-attempted in another form. Step 1.5 is therefore still unobserved; what it
needs is a session in which the operator binds that hook themselves.
*Later the same day, the operator approved the same probe at a prompt; its rows
are in the second addendum below.*

## Addendum 2026-10-21 (second) — steps 1.5, 1.7 and 1.8, and 1.4's by-name half

Taken **2026-10-21** on **Claude Code 2.1.306** (`claude --version`), tree at
`origin/main` @ `aaaba3a2f`. The host had moved from 2.1.305 to 2.1.306 since the
first addendum. The operator had left auto mode, so each child session below
ran only after the operator approved its permission prompt. None was denied.

The method is the same as in the first addendum. Each child is a
`claude -p --output-format stream-json --verbose` session in its own empty
scratch project with a one-line `CLAUDE.md`, and every `init` event reports
`apiKeySource: none`. Hooks were bound only through `--settings` for that one
session, and they only append their payload to a log file. The deny arm's hook
also returns a `PreToolUse` deny. Usage figures come from the `usage` block of
each subagent's own transcript. Agent ids are shortened to seven characters.

| Probe | Host session id | What it settles |
|---|---|---|
| 1.5 allow | `a3519a1c-1741-405d-9dac-466aae2a12ca` | `PreToolUse` on a resume |
| 1.5 deny | `fd83fb74-dd9a-41a1-9ded-c1b6fe6ccc0e` | a deny on a resume |
| 1.5 cap | `6f58eab7-7add-45ba-b906-2311fb6b636b` | a resume against the concurrency cap |
| 1.7 | `5372ae89-4931-49a0-9d3a-c9d9602559e0` | what the skip flag sheds |
| 1.8 flag unset | `1a84f53e-2ea6-4f2a-b7b3-b46e37cc95e1` | naming without agent teams |
| 1.8 flag set | `a10a2359-236e-4ac4-a01b-aeb63b5fe48f` | naming with agent teams, and the by-name resume |

### Step 1.5 — SendMessage pre_tool_use, the deny, and the cap

| Question | Verdict | Host version | Date | Evidence |
|---|---|---|---|---|
| Does `PreToolUse` fire on the `SendMessage` that resumes a worker? | **yes** | 2.1.306 | 2026-10-21 | Allow arm hook log: `05:24:17Z PreToolUse SendMessage`, then `05:24:18Z SubagentStart general-purpose` for the resumed agent. The tool result was `{"success":true,"message":"Resuming agent a7dda5d",…}`. |
| Is a deny returned there honoured? | **yes** | 2.1.306 | 2026-10-21 | Deny arm: `05:24:54Z PreToolUse SendMessage` is the last hook event — no `SubagentStart` follows. The tool result was `<error>PreToolUse:SendMessage hook error: probe-deny: resume refused by PreToolUse</error>`, and the agent was never re-entered. |
| Does a resume count against `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS`? | **no — a resume ran past the cap** | 2.1.306 | 2026-10-21 | Cap arm, run with `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS=1`; details below. |

How the cap arm ran:

- **A**, a foreground agent, ran and stopped at 05:25:21–26Z.
- **B**, a background agent, started at `05:25:30Z` and stopped at `05:25:38Z`.
- **C** is the control: a second **fresh** background spawn issued at 05:25:30Z while B was running. The host refused it with `Concurrent subagent limit reached. You can run 1 subagents at once. Do not retry. If the user wants more concurrent subagents, ask them to increase CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS.`
- **A was resumed** with `SendMessage` at `05:25:32Z`. Its `SubagentStart` fired at 05:25:32Z, it answered, and it stopped at 05:25:33–35Z — all while B was still open. For those seconds two subagents were running under a cap of one.

**Reading.** On 2.1.306 the cap checks new spawns only, and a resume is admitted
past it. The guard's own count is now the only one that can cover resumes, and
the `pre_tool_use` slot it needs on `SendMessage` exists and can deny. This is
risk 1 of the roadmap, observed.

### Step 1.7 — what skipping project instructions sheds

Two agents were defined for the one session through `--agents`, identical in
description, prompt, model (`haiku`) and an empty tool list. The only
difference was that `probe-skip` set `"omitClaudeMd": true`. The host accepted
both definitions; the `init` event lists `probe-full` and `probe-skip`. Each was
spawned once in the foreground with the same one-line task. The task asked the
agent to quote a canary token from the project `CLAUDE.md`, and to say whether
its context held a heading that exists only in the operator's user-level
`~/.claude/rules` layer.

| Agent | First call: input | Written | Read | Written-or-uncached | Total input | Canary reply |
|---|---|---|---|---|---|---|
| `probe-full` | 2 | 143,352 | 0 | 143,354 | 143,354 | `PROBE-CANARY-7731 · YES` |
| `probe-skip` | 2 | 819 | 1,033 | 821 | 1,854 | `NONE; NO` |

**Gross delta.** Measured on total input, which does not depend on which spawn
ran first and warmed the shared prefix, the gap is **141,500 tokens**.

**Net delta.** For the net delta: a skipping worker must still be given, in its dispatch, the
kernel floor and the user's constraints verbatim (`subagent-spawn-contract.md`
§ Worker-prompt rules). The package's own floor-carrying definition,
`src/subagents/ac-worker.md`, is **3,582 bytes in total**, so carrying it costs
on the order of 1,000 tokens. The net delta is therefore about
**140,000 tokens** — about 58 % of the 242,891-token median cold start. Step
2.5's threshold is 10 %.

**The `~/.claude/rules` layer is skipped too.** Both the canary reply (`NO`) and
the collapse of total input show it, although the host documentation names
`CLAUDE.md` files only. So the flag sheds the whole instruction hierarchy, not
just the project file.

**Bounds.** This is one pair. The scratch project's own `CLAUDE.md` is one line,
so nearly all of the delta is the operator's user-level layer, which is unusually
large on this machine. The flag was exercised through `--agents` JSON, not
through a definition file's frontmatter.

### Step 1.8 — naming under agent teams

Both arms ran the same prompt: name the spawned agent `probe-worker` if the
spawning tool takes a name, then re-task it by sending to `probe-worker`.

| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | `name` sent at spawn | `SendMessage` to `probe-worker` | Kind per the tool results |
|---|---|---|---|
| unset | no — the tool input was `{description, subagent_type, model, run_in_background}`, and the child reported no naming parameter | `{"success":false,"message":"No agent named 'probe-worker' is reachable.…"}`; reachable only by its raw id | subagent |
| `1` | **yes** — `"name":"probe-worker"` in the tool input | `{"success":true,"message":"Resuming agent probe-worker","resumedAgentId":"ab43c10…","pin":{…,"name":"probe-worker",…}}` | **subagent** (`SubagentHandback`, `[Subagent hand-back]`), not a teammate |

So with the teams flag set, a named spawn yields a **resumable subagent that
answers to its name**. Without the flag there is no name to give.

### Step 1.4 — the by-name half, observed

The 1.8 flag-set arm is the run step 1.4 was missing.

- The finished agent `probe-worker` was re-tasked **by its operator-chosen name**.
- The resume's `SubagentStart` (`05:27:50Z`) carries the same host agent id,
  `ab43c10`, as the original spawn. The ledger's `ref` is a deterministic hash
  of that id (`subagent_ledger_hook.ts::refFor`), so the ref is the same too.
  The scratch project has no ledger, so this equality is derived rather than
  read; the 2026-10-17 row read it from a ledger.
- The resumed run's first call wrote 318 tokens, read **165,304** from cache and
  had 4 uncached — **99.8 %** read share, about 6 s after the previous request.
- The cold-after-gap reading is the 2026-10-17 run 3 above.

**Condition.** The name is accepted only when
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set before the session starts.
`worker_resume` is therefore true on 2.1.306 **only under an experimental
flag**. Whether the registry row should record that is a decision this file
does not make, so the row was not edited.

## Version floors — every observed field and the host it was seen on (step 1.10)

| Field | Observed value | Host version | Date |
|---|---|---|---|
| warm resume by host id (`worker_resume`, warm half) | 99.7 % first-call read share | 2.1.302 | 2026-10-17 |
| cold resume after a 6 min 51 s gap (host default cache TTL) | 0 % read share | 2.1.302 | 2026-10-17 |
| `fork_shares_cache` | 99.8 %, parent's tool list | 2.1.302 | 2026-10-17 |
| rate surfaces (status line, `StopFailure`, `api_retry`, `quota_auto_resume_*`) | not reached | 2.1.305 | 2026-10-21 |
| `rate_limit_event` on a print-mode stream | present | 2.1.305 | 2026-10-21 |
| no `name` parameter without the teams flag | absent | 2.1.305, 2.1.306 | 2026-10-21 |
| `SendMessage` pre_tool_use fires · deny honoured | yes · yes | 2.1.306 | 2026-10-21 |
| `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` refuses a fresh spawn · bounds a resume | yes · no | 2.1.306 | 2026-10-21 |
| skip flag (`omitClaudeMd`) sheds `CLAUDE.md` and `~/.claude/rules` | about 141,500 tokens gross | 2.1.306 | 2026-10-21 |
| named spawn under agent teams → resumable subagent, by-name resume warm | yes, 99.8 % | 2.1.306 | 2026-10-21 |

These are the versions each field was **seen on**, not the releases it first
shipped in. No earlier version was probed, so no field's true floor is
established. The subagent cache-TTL **setting** (`subagentPromptCacheTtl`) was
never exercised; only the default TTL's effect was seen.
