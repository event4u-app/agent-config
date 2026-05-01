# Chat-history platform hooks

> Phase 1 deliverable for [`road-to-stable-chat-history.md`](../roadmaps/road-to-stable-chat-history.md).
> Locks in what each of the six supported agent platforms actually
> offers as a lifecycle-hook surface, so Phase 2 can wire
> `scripts/chat_history.py` to native events instead of relying on
> agent discipline. Every classification is cited; stale assumptions
> are the failure mode this phase exists to prevent.
>
> Last refreshed: 2026-05-01.

## Strategy taxonomy

Mirrors the roadmap's authoritative definitions:

- **HOOK** — platform fires a lifecycle event, our wrapper runs `chat_history.py append`. Zero agent involvement. Crash-safe.
- **CHECKPOINT** — no automatic hook, but a thin user- or agent-invoked command (e.g. `/checkpoint`) takes ~1 s and is socially enforceable. Fallback when HOOK is impossible.
- **MANUAL** — accept that the platform cannot be automated; document the gap; keep the cooperative rule active **only** for that platform.

## Decision matrix

| Platform | Surface | Decision | Primary lifecycle hook(s) | Notes |
|---|---|---|---|---|
| Claude Code | CLI + IDE | **HOOK** | `SessionStart`, `Stop`, `UserPromptSubmit`, `PostToolUse` | 3 cadences (per session / per turn / per tool); most mature. |
| Cursor | IDE (full) · CLI (partial) | **HOOK** (IDE) · **CHECKPOINT** (CLI) | `sessionStart`, `stop`, `afterAgentResponse` | Beta since 1.7. CLI fires only `beforeShellExecution`/`afterShellExecution`. |
| Cline | VS Code + JetBrains | **HOOK** (non-Windows) | `TaskStart`, `TaskComplete`, `UserPromptSubmit`, `PreCompact` | Hooks unsupported on Windows as of `cline/cline#8073`. |
| Windsurf | Cascade | **HOOK** | `pre_user_prompt`, `post_cascade_response`, `post_setup_worktree` | 12 events; shipped v1.12.41. |
| Gemini CLI | CLI | **HOOK** | `SessionStart`, `SessionEnd`, `BeforeAgent`, `AfterAgent` | `SessionStart` is advisory (cannot block). |
| Augment Code | CLI + IDE plugin (VSCode + IntelliJ) | **HOOK** | `SessionStart`, `SessionEnd`, `Stop`, `PreToolUse`, `PostToolUse` | Hooks read from `~/.augment/settings.json` (user scope) or `/etc/augment/settings.json` (system); same surface for CLI and IDE. A project-local `settings.json` inside the `.augment/` projection is plugin enablement only. |

## Claude Code

- **Hook surface:** `.claude/settings.json` `hooks` block; command (stdin/stdout) or HTTP variants.
- **Lifecycle events:** three cadences. Per-session: `SessionStart`, `SessionEnd`. Per-turn: `UserPromptSubmit`, `Stop`, `StopFailure`. Per-tool: `PreToolUse`, `PostToolUse`, plus `PreCompact`, `Setup`, `UserPromptExpansion`, `PermissionRequest`, `PermissionDenied`.
- **Execution model:** subprocess; JSON on stdin, JSON on stdout. Synchronous for blocking events (`PreToolUse` can `deny`); `Stop` can `block`.
- **Failure semantics:** non-zero exit on a blocking hook denies the action. `Stop` hooks that loop are explicitly called out as a failure mode in the docs.
- **stdout reach:** `additionalContext` from `SessionStart`/`UserPromptSubmit` is injected into the model context. Decision fields use a most-restrictive merge across multiple hooks.
- **Decision: HOOK.** Best-fit target; map `SessionStart` → init/turn-check, `Stop`/`UserPromptSubmit` → append at cadence boundaries.
- **Sources:**
  - <https://docs.claude.com/en/docs/claude-code/hooks>
  - <https://docs.claude.com/en/docs/claude-code/hooks-guide>
  - <https://code.claude.com/docs/en/agent-sdk/hooks>

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
- **Decision: HOOK.** Map `pre_user_prompt` → init/turn-check, `post_cascade_response` → append (async OK for cadence ≥ `per_phase`).
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
- **Decision: HOOK.** Map `SessionStart` → init/turn-check, `Stop` → append at end-of-turn, `PostToolUse` → per-tool cadence, `SessionEnd` → consolidation.
- **Sources:**
  - <https://docs.augmentcode.com/cli/hooks>
  - <https://docs.augmentcode.com/cli/hooks-examples>
  - <https://docs.augmentcode.com/using-augment/agent>

## Open questions (unblocked, but tracked)

1. **Cursor CLI parity** — `beforeSubmitPrompt`/`stop` are IDE-only as of 2026-01. Track the changelog and flip the CLI row when they ship.
2. **Cline Windows parity** — patch landed in `cline/cline#8201`; verify before Phase 4 dogfooding on a Windows host.
3. **Async vs sync semantics** — Windsurf's `post_cascade_response` is async; Gemini's `SessionEnd` is best-effort. Phase 2 wrapper must tolerate both (write-then-fsync, single-line append, no read-modify-write).
