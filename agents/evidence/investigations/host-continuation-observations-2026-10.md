# Host continuation observations — resume and fork on Claude Code

<!-- evidence-type: analysis -->

> Phase 1 rows for `road-to-a-cold-start-paid-once` (steps 1.4 and 1.6), filed
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
