---
stability: experimental
---

# Host-tool vocabulary — one capability, several spellings, and the absences

> `road-to-skill-ecosystem-runtime-enforcement` Phase 3 Step 3. Status: active ·
> Owner: maintainer.

An artifact that names a capability by one host's spelling is portable only by
accident. This page records the spellings this repository can **verify from its
own tree**, and — the part the step asks for explicitly — every case where a host
has **no equivalent**, because *an absent equivalent documented is worth more
than an invented mapping*.

## The evidence rule this page follows

Every row below is derived from a file in this repository. Nothing is filled in
from recollection of a vendor's documentation. Where this tree does not know a
host's spelling, the cell says **unverified** and names what would settle it —
never a plausible guess, which is the failure
[`direct-answers`](../../src/rules/direct-answers.md) Iron Law 2 forbids and
which a portability table makes especially cheap to commit.

## Lifecycle events — VERIFIED, all eight hosts

Source: `native_event_aliases` and `platforms` in
`src/scripts/hook_manifest.yaml`. The left column is this package's canonical
slot; each cell is the host's own name for it.

| capability (slot) | augment | claude | cowork | cursor | cline | windsurf | gemini | copilot |
|---|---|---|---|---|---|---|---|---|
| `session_start` | `SessionStart` | `SessionStart` | `SessionStart` | `sessionStart` | `TaskResume` | `post_setup_worktree` | `SessionStart` | — |
| `session_end` | `SessionEnd` | `SessionEnd` | `SessionEnd` | `sessionEnd` | `TaskComplete` | — | `SessionEnd` | — |
| `stop` | `Stop` | `Stop` | `Stop` | `stop` | `TaskCancel` | `post_cascade_response` | `AfterAgent` | — |
| `user_prompt_submit` | — | `UserPromptSubmit` | `UserPromptSubmit` | `beforeSubmitPrompt` | `UserPromptSubmit` | `pre_user_prompt` | `BeforeAgent` | — |
| `pre_tool_use` | `PreToolUse` | `PreToolUse` | `PreToolUse` | `preToolUse` *(aliased, unbound)* | `PreToolUse` *(aliased, unbound)* | — | `BeforeTool` *(aliased, unbound)* | — |
| `post_tool_use` | `PostToolUse` | `PostToolUse` | `PostToolUse` | `postToolUse` | `PostToolUse` | — | `AfterTool` | — |
| `pre_compact` | — | `PreCompact` | `PreCompact` *(aliased, unbound)* | `preCompact` *(aliased, unbound)* | `PreCompact` *(aliased, unbound)* | — | — | — |
| `subagent_start` | — | `SubagentStart` | `SubagentStart` | — | — | — | — | — |
| `subagent_stop` | — | `SubagentStop` | `SubagentStop` | — | — | — | — | — |

Reading the annotations:

- **`—`** — the host has no equivalent event. Not "we did not look": the alias
  table is the exhaustive record of what this package knows how to bind.
- **`*(aliased, unbound)*`** — the host *names* the event and this package binds
  nothing to it. That distinction is load-bearing and is the one most often got
  wrong: `pre_tool_use` is aliased on cursor, cline and gemini and bound on none
  of them, so a rule claiming "the guard has nowhere to bind" on those hosts is
  wrong — it is unbound, not unbindable.
- **copilot has no row at all.** This package binds nothing there and has measured
  nothing there, so every slot is an absence rather than a gap. A reader looking for why a guard does not fire there
  should find this line rather than infer a bug.

Two further absences worth stating separately, because they change what a rule
may claim: **windsurf has neither `pre_tool_use` nor `post_tool_use`**, and
**only `claude` honours a deny** — the other hosts that bind a pre-tool slot run
the concern and discard its verdict.

## Tool capabilities — VERIFIED for one host, unverified for the rest

Source for the `claude` column: the tool names this package's own hooks match on
(`src/scripts/hooks/*.ts` — `Write`, `Read`, `Edit`, `MultiEdit`, `Bash`,
`Grep`, `Glob`, `Task`, `NotebookEdit`) and the `allowed_tools` grants in
`src/skills/*/SKILL.md`, which use the scoped form `Bash(cmd:*)`.

| capability | claude | every other host |
|---|---|---|
| shell run | `Bash`, scoped as `Bash(<cmd>:*)` | **unverified** |
| file read | `Read` | **unverified** |
| file create | `Write` | **unverified** |
| file edit | `Edit`, `MultiEdit` | **unverified** |
| search — by content | `Grep` | **unverified** |
| search — by path | `Glob` | **unverified** |
| subagent dispatch | `Task` | **unverified** |
| notebook edit | `NotebookEdit` | **unverified** |

**Why one column and not eight.** This repository generates rule and skill
projections for eight hosts, and its `allowed_tools` vocabulary is Claude's:
`tool-safety`'s Least-Agency guidance says to prefer the scoped-grant syntax
*"where the host supports it"*, and no file in this tree records which of the
other seven do. Filling those cells would mean writing down what a vendor's
documentation is remembered to say, on a page whose entire purpose is to be
relied on when porting an artifact.

**What closes a cell.** One of: a projection this package generates that carries
the host's tool name; a host config file in the tree that names it; or a
recorded observation with a date and a source, in the shape
`src/config/host-capabilities.yml` already uses for measured capability facts.
A vendor doc URL alone is the weakest admissible evidence and must carry its
fetch date, because these names change between releases.

**What an unverified cell means for an author today:** do not write a
tool-restriction key for that host. `tool-safety` already says a tool name must
match the registry; this page says which registry is known. An artifact that
declares a grant a host does not recognise is not restricted — the loader
ignores the unrecognised key and the artifact inherits everything, which is the
failure Phase 3 Step 6 exists to catch.

## Subagent dispatch — capability, not spelling

Whether a host can dispatch a subagent at all is a separate question from what
the tool is called, and it has its own committed answer:
`src/scripts/_lib/host_capability.ts`'s `HOST_CAPABILITY_REGISTRY`, resolved
through `probeHostCapabilities`. Read that before assuming a host cannot
delegate: the registry holds ONE row, so on every other host the six fields are
the all-false safe default — which records that *nobody answered*, not that the
host cannot spawn. `agent-config routing:doctor` prints the value **and** its
provenance per field.

## See also

- `src/scripts/hook_manifest.yaml` — the source of the event table.
- [`hook-architecture-v1`](hook-architecture-v1.md) — which hosts carry
  `pre_tool_use`, and which honour a deny.
- [`tool-safety`](../../src/rules/tool-safety.md) — Least Agency and the
  allowlist rule this page supplies the vocabulary for.
- `src/scripts/_lib/host_capability.ts` — subagent capability, with provenance.
