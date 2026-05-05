# Chat-history platform hooks

> Phase 1 deliverable for [`road-to-stable-chat-history.md`](../roadmaps/road-to-stable-chat-history.md).
> Locks in what each of the six supported agent platforms actually
> offers as a lifecycle-hook surface, so Phase 2 can wire
> `scripts/chat_history.py` to native events instead of relying on
> agent discipline. Every classification is cited; stale assumptions
> are the failure mode this phase exists to prevent.
>
> Last refreshed: 2026-05-05.

## Strategy taxonomy

Mirrors the roadmap's authoritative definitions:

- **HOOK** — platform fires a lifecycle event, our wrapper runs `chat_history.py append`. Zero agent involvement. Crash-safe.
- **CHECKPOINT** — no automatic hook, but a thin user-invoked command (e.g. `./agent-config chat-history:checkpoint`) takes ~1 s. Fallback when HOOK is impossible or misfires.
- **MANUAL** — accept that the platform cannot be automated; document the gap. The agent never reads or writes `.agent-chat-history` cooperatively.

## Decision matrix

`Verification` column reflects whether the dispatcher's payload extraction
(`scripts/chat_history.py::_extract_hook_text`) has been confirmed
against a real platform payload, against vendor documentation only, or
not yet at all.

| Platform | Surface | Decision | Verification | Primary lifecycle hook(s) | Notes |
|---|---|---|---|---|---|
| Claude Code | CLI + IDE | **HOOK** | docs-verified | `SessionStart`, `Stop`, `UserPromptSubmit`, `PostToolUse` | 3 cadences (per session / per turn / per tool); most mature. `Stop` carries only `session_id` + `transcript_path`; dispatcher reads the JSONL and pulls the last assistant text-block. |
| Cowork (Claude desktop) | local-agent-mode VM | **HOOK** (blocked upstream) · **MANUAL** (today) | docs-verified · upstream-blocked | `SessionStart`, `Stop`, `UserPromptSubmit`, `PostToolUse` | Claude Code under the hood — same vocabulary and payload shape. `anthropics/claude-code#40495`: Cowork sandbox ignores all three settings sources (user / project / env). `#27398`: `--setting-sources user` excludes plugin-scope `hooks/hooks.json`. Mapping + trampoline shipped (cowork-dispatcher.sh) but lifecycle events do not fire until upstream resolves. |
| Cursor | IDE (full) · CLI (partial) | **HOOK** (IDE) · **CHECKPOINT** (CLI) | discovery-pending | `sessionStart`, `stop`, `afterAgentResponse` | Beta since 1.7. CLI fires only `beforeShellExecution`/`afterShellExecution`. Payload shape unverified — falls back to top-level keys. |
| Cline | VS Code + JetBrains | **HOOK** (non-Windows) | discovery-pending | `TaskStart`, `TaskComplete`, `UserPromptSubmit`, `PreCompact` | Hooks unsupported on Windows as of `cline/cline#8073`. Payload shape unverified — falls back to top-level keys. |
| Windsurf | Cascade | **HOOK** | discovery-pending | `pre_user_prompt`, `post_cascade_response`, `post_setup_worktree` | 12 events; shipped v1.12.41. Payload shape unverified — falls back to top-level keys. |
| Gemini CLI | CLI | **HOOK** | discovery-pending | `SessionStart`, `SessionEnd`, `BeforeAgent`, `AfterAgent` | `SessionStart` is advisory (cannot block). Payload shape unverified — falls back to top-level keys. |
| Augment Code | CLI + IDE plugin (VSCode + IntelliJ) | **HOOK** | docs-verified | `SessionStart`, `SessionEnd`, `Stop`, `PreToolUse`, `PostToolUse` | Hooks read from `~/.augment/settings.json` (user scope) or `/etc/augment/settings.json` (system); same surface for CLI and IDE. With `includeConversationData: true` the `Stop` payload nests `conversation.userPrompt` + `conversation.agentTextResponse`; without the flag both fields are absent. |

### Augment payload shape — `Stop` with `includeConversationData`

```json
{
  "hook_event_name": "Stop",
  "session_id": "…",
  "conversation": {
    "userPrompt":        "Add error handling…",
    "agentTextResponse": "I'll add try/except…",
    "agentCodeResponse": [{ "path": "…", "changeType": "edit", "content": "…" }]
  }
}
```

Without the opt-in flag, only the envelope (`hook_event_name`,
`session_id`, `workspace_roots`, `cwd`) is populated. The dispatcher
emits two body entries from a single `Stop` payload — a `user_prompt`
(t=user) followed by the `stop` (t=agent) — when both fields are
non-empty and cadence allows it.

### Claude Code payload shape — `Stop`

```json
{
  "hook_event_name": "Stop",
  "session_id": "…",
  "transcript_path": "/Users/…/transcripts/<sid>.jsonl"
}
```

The transcript is JSONL with one event per line; the dispatcher walks
to the last `{"type": "assistant", …}` line and concatenates its text
content blocks. Returns empty when the file is missing, partial, or
holds no assistant message yet (best-effort; never raises).

## Claude Code

- **Hook surface:** `.claude/settings.json` `hooks` block; command (stdin/stdout) or HTTP variants.
- **Lifecycle events:** three cadences. Per-session: `SessionStart`, `SessionEnd`. Per-turn: `UserPromptSubmit`, `Stop`, `StopFailure`. Per-tool: `PreToolUse`, `PostToolUse`, plus `PreCompact`, `Setup`, `UserPromptExpansion`, `PermissionRequest`, `PermissionDenied`.
- **Execution model:** subprocess; JSON on stdin, JSON on stdout. Synchronous for blocking events (`PreToolUse` can `deny`); `Stop` can `block`.
- **Failure semantics:** non-zero exit on a blocking hook denies the action. `Stop` hooks that loop are explicitly called out as a failure mode in the docs.
- **stdout reach:** `additionalContext` from `SessionStart`/`UserPromptSubmit` is injected into the model context. Decision fields use a most-restrictive merge across multiple hooks.
- **Decision: HOOK.** Best-fit target; map `SessionStart` → init (lazy — only writes the header if the file is missing), `Stop`/`UserPromptSubmit` → append at cadence boundaries. Each entry self-tags via `s = derive_session_tag(session_id)`; multiple sessions coexist in one file.
- **Sources:**
  - <https://docs.claude.com/en/docs/claude-code/hooks>
  - <https://docs.claude.com/en/docs/claude-code/hooks-guide>
  - <https://code.claude.com/docs/en/agent-sdk/hooks>

## Cowork (Claude desktop app — local-agent-mode)

- **Hook surface:** inherits the Claude Code lifecycle (`SessionStart`,
  `Stop`, `UserPromptSubmit`, `PostToolUse`, `SessionEnd`,
  `PreCompact`) because Cowork runs the Claude Code CLI inside a
  sandbox VM. Settings paths are the same (`.claude/settings.json`
  project-scope, `~/.claude/settings.json` user-scope) — but see
  upstream blockers below.
- **Lifecycle events:** identical to Claude Code (PascalCase native
  names; `Stop` payload carries only `session_id` + `transcript_path`).
- **Execution model:** subprocess (matches Claude Code).
- **Failure semantics:** matches Claude Code when the surface fires;
  currently **does not fire** because of the upstream bugs below.
- **stdout reach:** matches Claude Code (`additionalContext` from
  `SessionStart` / `UserPromptSubmit` injected into the model context).
- **Workspace shape:** Cowork sessions live under
  `~/Library/Application Support/Claude/local-agent-mode-sessions/<session-id>/<sub-id>/local_<id>/`.
  The user's selected project is mounted into that sandbox; the hook
  payload is expected to carry `cwd` (Claude Code standard) once
  upstream lands the fix. The trampoline accepts both `cwd` and
  `workspace_roots[0]` to hedge against either shape.
- **Upstream blockers (HOOK currently inert):**
  - <https://github.com/anthropics/claude-code/issues/40495> — Cowork
    sandbox ignores **all three** Claude Code settings sources (user,
    project, env). "Sandbox platform mismatch breaks all settings
    resolution."
  - <https://github.com/anthropics/claude-code/issues/27398> — Cowork
    spawns the CLI with `--setting-sources user`, which excludes
    plugin-scope `hooks/hooks.json` discovery. Skills, commands, and
    MCP servers from the same plugin still load; only hooks fall out.
- **Decision: HOOK.** Mapping (`PLATFORM_EVENT_MAP[cowork]`),
  manifest binding (`platforms.cowork`), and trampoline
  (`scripts/hooks/cowork-dispatcher.sh`) are shipped and
  dispatcher-ready. **Install plumbing is intentionally deferred**
  until at least one of #40495 / #27398 lands and the canonical
  Cowork settings location is documented — otherwise the install
  step would write a hooks file that no agent reads.
- **Distinguishing Cowork from CLI Claude Code in the chat-history:**
  body entries written via the cowork platform carry
  `agent: "cowork"`; CLI / IDE entries carry `agent: "claude"`. Both
  share the same fingerprint and session boundary semantics so a
  developer who runs Cowork and CLI Claude Code against the same
  project sees one merged log, attributed per turn.
- **Sources:**
  - <https://github.com/anthropics/claude-code/issues/40495>
  - <https://github.com/anthropics/claude-code/issues/27398>
  - <https://docs.claude.com/en/docs/claude-code/hooks>

## Cursor

- **Hook surface:** `.cursor/hooks.json` (project) or `~/.cursor/hooks.json` (user). Also reads `.claude/settings.json` so Claude hooks transparently apply.
- **Lifecycle events:** `sessionStart`, `sessionEnd`, `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`/`Stop`, `beforeShellExecution`/`afterShellExecution`, `beforeMCPExecution`/`afterMCPExecution`, `beforeReadFile`/`afterFileEdit`, `beforeSubmitPrompt`, `preCompact`, `stop`, `afterAgentResponse`, `afterAgentThought`.
- **Execution model:** subprocess. Beta status as of 1.7 (Sept 2025), still beta in 2026-Q1.
- **Failure semantics:** pre-hooks can block via exit code. Cursor watches the config file and reloads it on change.
- **stdout reach:** observability-style; comparable to Claude's `additionalContext`.
- **Known gap:** Cursor **CLI** only fires `beforeShellExecution`/`afterShellExecution`. `beforeSubmitPrompt`, `stop`, etc. only fire in the IDE — documented limitation as of 2026-01.
- **Decision: HOOK (IDE) · CHECKPOINT (CLI).** For CLI users, fall back to the `/checkpoint` command from Phase 3.
- **Sources:**
  - <https://cursor.com/docs/hooks>
  - <https://cursor.com/docs/reference/third-party-hooks>
  - <https://cursor.com/changelog/1-7>

## Cline

- **Hook surface:** `.cline/hooks/` directory (file-based), `fail_open` / `fail_closed` policies per docs.
- **Lifecycle events:** `TaskStart`, `TaskResume`, `TaskCancel`, `TaskComplete`, `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `PreCompact`. 8 events total. Note: "task" rather than "session" — each task is a discrete conversation in Cline's model.
- **Execution model:** subprocess; ClineCore SDK orchestrates the lifecycle.
- **Failure semantics:** policy-driven. `fail_open` continues on hook error, `fail_closed` blocks the task.
- **Known gap:** **Hooks unsupported on Windows** (`cline/cline#8073`). Toggle is being patched but feature parity not promised.
- **Decision: HOOK (non-Windows) · CHECKPOINT (Windows).** Map `TaskStart` → init, `TaskComplete` / `UserPromptSubmit` → append.
- **Sources:**
  - <https://docs.cline.bot/customization/hooks>
  - <https://docs.cline.bot/features/hooks>
  - <https://github.com/cline/cline/issues/8073>

## Windsurf

- **Hook surface:** `.windsurf/hooks.json` (per-project).
- **Lifecycle events (12):** `pre_user_prompt`, `pre_read_code`, `pre_write_code`, `pre_run_command`, `pre_mcp_tool_use`, `post_cascade_response`, `post_cascade_response_with_transcript`, `post_setup_worktree`, `post_write_code`, plus pre/post variants for the rest.
- **Execution model:** shell commands. Pre-hooks block via exit code 2. Post-hooks are observe-only.
- **Failure semantics:** non-zero non-2 exits are warnings; exit 2 in a pre-hook cancels the action. `post_cascade_response` runs **asynchronously** — not on the critical path.
- **stdout reach:** `post_cascade_response_with_transcript` receives the full Cascade response; ideal for our append.
- **Decision: HOOK.** Map `pre_user_prompt` → init (lazy), `post_cascade_response` → append (async OK for cadence ≥ `per_phase`).
- **Sources:**
  - <https://docs.windsurf.com/windsurf/cascade/hooks>
  - <https://docs.windsurf.com/windsurf/cascade/worktrees>

## Gemini CLI

- **Hook surface:** lifecycle hooks shipped via `feat(hooks)` PR `#14307`; `SessionStart` context-injection completed in `#15746`.
- **Lifecycle events:** `SessionStart`, `SessionEnd`, `BeforeAgent`, `AfterAgent`, `BeforeModel`, `AfterModel`, `BeforeToolSelection`, `BeforeTool`, `AfterTool`, `PreCompress`, `Notification`.
- **Execution model:** subprocess; JSON in/out matching Claude's shape.
- **Failure semantics:** `SessionStart` and `SessionEnd` are **advisory** — `continue` and `decision` ignored, startup never blocked. `BeforeAgent`, `BeforeModel`, `BeforeToolSelection` can block / mock.
- **stdout reach:** `additionalContext` from `SessionStart` prepended to the user prompt; `systemMessage` shown in stderr.
- **Decision: HOOK.** Map `SessionStart` → init, `AfterAgent` → append.
- **Sources:**
  - <https://www.geminicli.com/docs/hooks/>
  - <https://www.geminicli.com/docs/hooks/reference/>
  - <https://github.com/google-gemini/gemini-cli/pull/14307>
  - <https://github.com/google-gemini/gemini-cli/pull/15746>

## Augment Code

- **Hook surface:** `~/.augment/settings.json` (user scope) or `/etc/augment/settings.json` (system); same surface for CLI **and** the IDE plugins (VSCode + IntelliJ). A project-local `settings.json` inside the `.augment/` projection is plugin enablement only — not read for hooks.
- **Script extension constraint:** hook commands must point at scripts with a `.sh` extension and live under one of the documented hook directories (e.g. `~/.augment/hooks/`). The package ships `scripts/hooks/augment-chat-history.sh` as a workspace-routing trampoline that satisfies this constraint.
- **Lifecycle events:** `SessionStart`, `SessionEnd`, `PreToolUse`, `PostToolUse`, `Stop`. Matchers via regex on tool name.
- **Execution model:** subprocess; synchronous for `PreToolUse`/`PostToolUse`/`Stop`. `Stop` can return `decision: "block"` to prevent termination.
- **Failure semantics:** `PreToolUse` can deny tool calls; `PostToolUse` cannot block; `Stop` can block agent finish.
- **Workspace routing:** hooks fire at user scope (one install per developer, shared across all projects). The trampoline reads `workspace_roots[0]` from the event payload and dispatches into the active project's `./agent-config chat-history:hook --platform augment`. Silent no-op when the workspace has no `agent-config` wrapper.
- **Deployment:** opt-in via `python3 scripts/install.py --augment-user-hooks`. Writes `~/.augment/hooks/augment-chat-history.sh` and merges hook entries into `~/.augment/settings.json`.
- **Decision: HOOK.** Map `SessionStart` → init (lazy), `Stop` → append at end-of-turn, `PostToolUse` → per-tool cadence, `SessionEnd` → consolidation.
- **Sources:**
  - <https://docs.augmentcode.com/cli/hooks>
  - <https://docs.augmentcode.com/cli/hooks-examples>
  - <https://docs.augmentcode.com/using-augment/agent>

## Open questions (unblocked, but tracked)

1. **Cursor CLI parity** — `beforeSubmitPrompt`/`stop` are IDE-only as of 2026-01. Track the changelog and flip the CLI row when they ship.
2. **Cline Windows parity** — patch landed in `cline/cline#8201`; verify before Phase 4 dogfooding on a Windows host.
3. **Async vs sync semantics** — Windsurf's `post_cascade_response` is async; Gemini's `SessionEnd` is best-effort. Phase 2 wrapper must tolerate both (write-then-fsync, single-line append, no read-modify-write).

## Multi-session coexistence

The agent never reads or writes `.agent-chat-history` cooperatively.
Schema v4 treats the file as a **multi-session** log: every body
entry self-tags via `s = derive_session_tag(session_id)` (16-char
SHA-256 prefix of the platform's `session_id`). Sessions coexist in
one file; there is no ownership layer, no sidecar, no auto-adopt.

When a hook fires:

- If the file is missing, the dispatcher writes a v4 header
  (`{t:"header", v:4, started, freq}`) and appends the entry.
- If the file exists, the dispatcher appends the entry with its own
  `s` tag — regardless of which session previously wrote.

There is no manual recovery lever in v4. A "wrong" session writing
to the file is not a failure mode — the entry simply joins the log
under its own `s`. To wipe the file, delete `.agent-chat-history`
manually (it is git-ignored and recreated on the next hook fire). To
inspect or import a prior session, use `/chat-history learn`.


## Read contract — session isolation (schema v4)

Schema v4 tags every body entry with `s = derive_session_tag(session_id)`
— the first 16 chars of the SHA-256 of the platform's `session_id` —
and treats the log as a **multi-session** file partitioned by `s`.
Sessions are derived per-entry from the body alone; the v4 header
carries no per-session state.

Read paths respect the partition by default; cross-session reads are
an explicit opt-in:

- **`read_entries_for_current(path, last)`** — the default reader.
  Filters to the most recent session in the body — i.e. the `s` of
  the last body entry. Used by every internal reader unless the
  caller has an explicit reason to widen the scope. Kill-switch
  `AGENT_CHAT_HISTORY_SESSION_FILTER=false` reverts to the v2
  "return everything" behaviour.
- **`read_entries(path, last, session=None)`** — the low-level
  reader. With `session=None` it returns all entries (used by
  `--all`); with `session=<id>` it filters to an exact `s` match.
  The literals `<legacy>` (no `s` field) and `<unknown>` (empty
  `session_id` at write time) are valid filter values.
- **`list_sessions(path)`** — returns
  `[{id, count, first_ts, last_ts, preview}]` for every distinct
  session id observed in the body, ordered by `last_ts` descending.
  v4 derives buckets from the body alone; there is no header-level
  registry of former sessions.

CLI surface:

| Command | Default scope | Override |
|---|---|---|
| `chat-history:read` | current session | `--all` (all sessions), `--session <id>` (exact match) |
| `chat-history:sessions` | top 20 buckets by `last_ts` desc | `--limit N`, `--json` (`--include-empty` is a v3 vestige; v4 has no empty buckets to surface) |

### `learn` opt-in path

`/chat-history learn` is the only sanctioned cross-session import
surface. It runs `chat-history:sessions`, surfaces sessions as
numbered options (per `user-interaction`), waits for the user's
pick (per `ask-when-uncertain` — one question per turn), and
renders the picked session's entries **verbatim** via
`chat-history:read --session <id>` (Council Round 2 / R2-2 — the
honest v1 contract is verbatim, not pre-summarised). v1 is
single-pick and read-only; multi-pick, fuzzy search, and
summarisation are explicitly out of scope.

## State on disk

Schema v4 is **fully stateless** between hook invocations. There is
no sidecar, no ownership file, no header-tracked former-session
registry. The single source of truth is `.agent-chat-history`
itself:

- **Header** (line 1): `{t:"header", v:4, started, freq}`. Written
  on first append; never rewritten thereafter.
- **Body** (line 2..N): one JSONL entry per event. Each entry
  carries its own `s` tag derived deterministically from the
  platform's `session_id`. Stateless: two hook invocations with
  the same `session_id` always produce the same `s` without
  consulting any cached state.

Per-session state that v3 stored in a sidecar (fingerprint, started-at,
ownership) is replaced in v4 by the determinism of
`derive_session_tag(session_id)` and the canonical recency of the
file body itself (`prune_sessions` ranks by body position, not
timestamps).

### Kill-switches

| Variable | Default | Effect when `false` |
|---|---|---|
| `AGENT_CHAT_HISTORY_SESSION_TAG` | `true` | body entries written without `s` (rolls back tagging) |
| `AGENT_CHAT_HISTORY_SESSION_FILTER` | `true` | `read_entries_for_current` returns all entries (rolls back filtering) |

`AGENT_CHAT_HISTORY_FILE` overrides the default file path
(`.agent-chat-history` in CWD); used by tests.
