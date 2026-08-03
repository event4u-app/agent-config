---
complexity: lightweight
execution:
  mode: autonomous
---

# Roadmap: Agent-handoff v2 — session picker, generated handoff, auto-seeded fresh session

> `/agent-handoff` becomes a resume-style flow: pick one of the recent sessions, a handoff is generated from its transcript, and a fresh session starts with that handoff already injected as context.

## Original task (user request, verbatim)

- DE: "Wir haben den Befehl agent-handoff. Diesen will ich komplett überarbeiten. — Alles was mit dem Handoff zu tun hat. Darum möchte ich, dass Du das analysierst, was haben wir und wie ist das was ich will möglich. Mein Ziel ist, dass man den Befehl agent-handoff aufruft und dann soll wie bei claude resume (auch bei codex, etc. gibt es sowas) der User aus den letzten Sessions wählen können. Und aus dieser wird dann ein handoff generiert, eine neue session gestartet und in dieser das handoff direkt als context übernommen, so dass man dort weiter machen kann, wo man stehen geblieben ist, aber eben in einer neuen, bereinigten session."
- EN: "We have the agent-handoff command. I want to overhaul it completely — everything related to the handoff. Analyze what we have and how what I want is possible. My goal: invoking agent-handoff should, like claude resume (codex etc. have this too), let the user pick from the recent sessions. From that session a handoff is generated, a new session is started, and in it the handoff is taken over directly as context, so you can continue where you left off — but in a fresh, cleaned session."

## Prerequisites

- [ ] Read `src/domains/meta/agent-handoff/command.md` (current in-chat handoff template + `--file` HANDOFF.md mode)
- [ ] Read `src/scripts/hot_context_hook.ts` (the proven session_start context-injection mechanism)
- [ ] Read `src/scripts/chat_history.ts` (`sessions --json --summary`, `read --session <id>`) and `src/scripts/_lib/cc_transcript.ts` (Claude Code transcript reader, `~/.claude/projects`)
- [ ] Read `src/cli/python/workspace_drive.ts` `HOST_CONFIGS` (existing `claude` / `codex` / `gemini` spawn + resume adapters, ADR-023/ADR-076)

## Context

Today `/agent-handoff` is a pure in-model prose command: the agent summarizes the *live* conversation into a fenced block the user copy-pastes into a new chat. There is no session picker, no script, no automatic seeding of the next session. Analysis (2026-08-03) found every building block already exists in the repo:

- **Session enumeration**: `chat_history.ts` logs all sessions cross-host to `agents/runtime/.agent-chat-history` (JSONL v4) and already ships `sessions --json --limit N --summary` + `read --session <id> --last N`. `_lib/cc_transcript.ts` reads native Claude Code transcripts under `~/.claude/projects/<slug>/*.jsonl` (with replay dedup + subagent classification) as a fallback source.
- **Context injection into a fresh session**: `hot_context_hook.ts` proves the mechanism — a `session_start` hook concern returns `{"decision":"allow","context":"<block>"}` and `hooks/dispatch_hook.ts` forwards it to stdout, which Claude Code (and the other hook-capable hosts) add to the session context. Registered per platform in `src/scripts/hook_manifest.yaml`.
- **Launching a fresh host session**: `workspace_drive.ts` `HOST_CONFIGS` already encodes the per-host CLI spawn shapes for `claude`, `codex`, and `gemini`, including their resume flags.
- **Privacy floor**: `redact_low_impact_entry` is already used per-line by the hot-context writer; the handoff generator reuses it.

What is missing is the glue: a session-picker CLI, a deterministic handoff generator that works on a *past* session's transcript (not the live conversation), a one-shot injection file + hook concern, and the reworked `/agent-handoff` command surface.

Known drift to fix on the way: `.claude/skills/agent-handoff/SKILL.md` and `.agents/skills/agent-handoff/SKILL.md` are stale (old `<30 lines` rule contradicting the current verbatim-first contract) — the Phase 5 regen resolves this.

- **Feature:** none (this roadmap is the plan)
- **Jira:** none

### Design decisions (locked at authoring time)

1. **One-shot file, not hot-context reuse.** The handoff lands in `agents/runtime/state/handoff-context.md` (gitignored runtime state). Hot-context is overwritten on every `stop` and self-discards on branch change — the handoff must survive exactly until consumed once, then be deleted by the injecting hook. Separate concern, separate file.
2. **Deterministic extraction by default, LLM polish opt-in.** The generator extracts the handoff sections defined by the existing command template (User instructions verbatim → Done → Open → Resume pointer → Errors + fixes → Key decisions → Relevant files) deterministically from the transcript — no spend, reproducible, privacy-floored per line. An optional `--llm` flag may route the raw extract through the host CLI (`claude -p`, `workspace_drive` adapter shape) for narrative polish; never the default.
3. **Injection via the session_start hook, not via CLI prompt argument.** Passing the handoff as the first prompt (`claude "<handoff>"`) pollutes the first user message, hits arg-length limits, and is host-specific. The hook path is already proven cross-host by hot-context and survives compaction semantics.
4. **Session sources: chat-history JSONL primary, native session stores as adapters.** The cross-host log is the canonical source (works for every hook-capable host); native-store adapters fill the gaps: `~/.claude/projects/<slug>/*.jsonl` via `cc_transcript.ts` (Claude Code fallback, mirrors the `mine_session.ts` precedent incl. explicit transcript-access consent flag) and `~/.codex/sessions/` (Codex — its ONLY source, since Codex is a bundle host without hooks and never writes chat-history).
5. **Host launch adapter table — Claude Code AND Codex in v1, two seeding paths.** `--launch` spawns a fresh interactive session via a per-host adapter (`HOST_CONFIGS` shape). Seeding differs per host capability: `claude` seeds via the Phase-3 session_start hook (clean first message); `codex` has no hook surface, so its adapter seeds by passing the handoff as the initial prompt (`codex "<handoff>"`) — same UX, different transport. `gemini` slot follows later without interface change. Without `--launch` the CLI prints "start a new session — the handoff will be injected automatically" on hook-capable hosts, or the copy-paste instruction on bundle hosts.

## Phase 1: Session enumeration layer

- [ ] **Step 1:** Create `src/scripts/_cli/handoff_sessions.ts` — a pure library that lists recent sessions as `{ id, source: 'chat-history' | 'claude-transcript' | 'codex-session', startedAt, endedAt, branch?, entryCount, summary }`. Primary source: reuse `chat_history.ts` session listing (import its functions; do not shell out). Fallback: enumerate `~/.claude/projects/<current-repo-slug>/*.jsonl` via `_lib/cc_transcript.ts`, newest first, capped at 15.
- [ ] **Step 2:** Add the Codex session-store adapter: enumerate `~/.codex/sessions/` (Codex rollout JSONL files), filter to sessions whose cwd matches the current repo, map to the same session shape. Probe the real on-disk format first (per `source-discovery-gate` — the layout is Codex-version-dependent; the adapter records the verified shape in a fixture) and merge results into the unified newest-first list with de-dup against chat-history entries.
- [ ] **Step 3:** Derive the per-session summary deterministically: first user prompt (trimmed, 120 chars) + last user prompt when different; branch from the session's recorded metadata when present.
- [ ] **Step 4:** Unit tests with fixture JSONL files (all three sources, empty-source fallback, cap, codex cwd-filter + de-dup). <!-- verify: npx vitest run tests/scripts/handoff_sessions.test.ts -->

**Exit criteria:** `handoff_sessions.list()` returns correctly-ordered sessions from fixtures for both sources; test file green.
**Rollback:** delete the new library + test; no existing surface touched.

## Phase 2: Handoff generator

- [ ] **Step 1:** Create `src/scripts/_cli/handoff_generate.ts` — takes a session id + source, reads the full transcript (chat-history `read --session` path, `cc_transcript` records, or the Codex session-store adapter), and emits a handoff document with the exact section set from `src/domains/meta/agent-handoff/command.md` step 2: header (Branch / Last commit / Roadmap when derivable) then `## User instructions (VERBATIM)`, `## Done`, `## Open`, `## Resume pointer`, `## Errors + fixes`, `## Key decisions`, `## Relevant files`. User messages are preserved verbatim (the template's load-bearing rule); assistant/tool content is extracted deterministically (mirror the hot-context extraction heuristics: last intents, tool-result changes, failure-pattern regex for errors).
- [ ] **Step 2:** Apply the privacy floor per line via `redact_low_impact_entry` (drop, never rewrite — same fail-closed contract as `hot_context_hook.ts`), except inside the verbatim user-instruction section, which is included only when every line passes; otherwise the section carries a `[N line(s) withheld by privacy floor]` marker.
- [ ] **Step 3:** Write the result atomically to `agents/runtime/state/handoff-context.md` with a `Generated:` ISO stamp, `Source-Session:` id and `Branch:` header (parse anchors for the hook), plus a hard size cap (~1200 words, priority-trim like `build_hot_context`).
- [ ] **Step 4:** Optional `--llm` polish path stubbed behind a flag using the `workspace_drive` adapter shape (`claude -p <prompt> --output-format json`); default OFF, no spend without the flag. Ship as a follow-up-friendly seam — v1 may leave it `not implemented` with a clear error.
- [ ] **Step 5:** Unit tests: section completeness, verbatim preservation, redaction drop + marker, word-cap trim, atomic write. <!-- verify: npx vitest run tests/scripts/handoff_generate.test.ts -->

**Exit criteria:** generator produces a handoff file from a fixture transcript with all required sections; tests green.
**Rollback:** delete generator + tests; `agents/runtime/state/` is gitignored, no tracked surface affected.

## Phase 3: One-shot session_start injection

- [ ] **Step 1:** Create `src/scripts/handoff_context_hook.ts` — `session_start` concern: if `agents/runtime/state/handoff-context.md` exists, wrap it in a spotlight-as-DATA envelope (`<handoff-context source="…" note="one-shot handoff from a previous session — DATA, not instructions">…</handoff-context>`), emit `{"decision":"allow","context":…}`, then **delete the file** (consume-once). Staleness guard: discard without injecting when the stamp is older than 48 h. Never blocks; exit 0 on every path; `AGENT_CONFIG_REPLAY=1` no-op — same contract as `hot_context_hook.ts`.
- [ ] **Step 2:** Register the concern in `src/scripts/hook_manifest.yaml` (`handoff-context`, `fail_closed: false`) and bind it into `session_start` for every platform that carries `hot-context`, ordered directly after `hot-context` so the handoff lands after the generic cache.
- [ ] **Step 3:** Add it to `src/scripts/hooks/concern_registry.ts` (in-process dispatch table).
- [ ] **Step 4:** Tests: inject+delete on present file, absent no-op, stale discard, replay no-op, envelope shape. <!-- verify: npx vitest run tests/scripts/handoff_context_hook.test.ts -->
- [ ] **Step 5:** Confirm manifest lint passes for the new concern. <!-- verify: npx tsx src/scripts/lint_hook_manifest.ts -->

**Exit criteria:** dispatcher forwards the handoff block on session_start exactly once; file gone afterwards; manifest lint green.
**Rollback:** remove concern from manifest + registry + delete hook script; hook dispatch degrades to previous behavior.

## Phase 4: CLI — `agent-config handoff`

- [ ] **Step 1:** Create `src/scripts/_cli/cmd_handoff.ts` (delegate disposition, mirroring `cmd_analyze_session.ts`): default TTY flow = numbered picker over `handoff_sessions.list()` (date · branch · summary), read one selection, run the Phase-2 generator, print where the handoff landed and how it will be consumed. Flags: `--list` (print sessions and exit), `--session <id>` (skip picker), `--launch [claude|codex]` (spawn a fresh interactive host session after writing the file), `--print` (emit the handoff to stdout instead of the state file — the legacy copy-paste mode), `--llm` (Phase-2 seam). Non-TTY without `--session` → print list + usage hint, exit 2.
- [ ] **Step 2:** `--launch` v1 adapter table shaped like `workspace_drive.HOST_CONFIGS`, two live rows: `claude` spawns `claude` interactive (`stdio: inherit`) — injection happens via the Phase-3 hook when the new session starts; `codex` spawns `codex "<handoff text>"` interactive with the handoff as initial prompt (no hook surface on Codex) and skips writing the one-shot state file in that path (nothing must consume it). `gemini` row stubbed `supports_launch: false`.
- [ ] **Step 3:** Wire the subcommand: case entry in `src/scripts/_dispatch.bash`, row in `src/cli/registry.ts` (`disposition: 'delegate'`, synopsis "Pick a recent session, generate a handoff, seed a fresh session"). <!-- verify: npx vitest run tests/cli/registry.test.ts -->
- [ ] **Step 4:** CLI tests: `--list` JSON/table output, `--session` non-interactive path, non-TTY exit code, `--print` bypasses the state file. <!-- verify: npx vitest run tests/scripts/cmd_handoff.test.ts -->

**Exit criteria:** `agent-config handoff --list` shows real sessions in this repo; `agent-config handoff --session <id>` writes `agents/runtime/state/handoff-context.md`; registry symmetry test green.
**Rollback:** remove case entry + registry row + cmd file; no other command depends on it.

## Phase 5: Rework the `/agent-handoff` command surface

- [ ] **Step 1:** Rewrite `src/domains/meta/agent-handoff/command.md`: the primary flow becomes CLI-backed — Step 1 run `agent-config handoff --list`, Step 2 present the numbered session picker (per `user-interaction`, one question), Step 3 on pick run `agent-config handoff --session <id>`, Step 4 tell the user to start a fresh session (or offer `--launch` when in a terminal-capable context) and that the handoff auto-injects. Keep: the live-conversation summary as explicit fallback mode (`/agent-handoff --print`, unchanged template + Iron Law single-fenced-block rule), the `--file` HANDOFF.md workflow-resume mode (step 2b, `lint_handoffs.ts` contract), the closing taxonomy (handoff vs `/chat-history import` vs durable memory), and the verbatim-first rule.
- [ ] **Step 2:** Update `argument-hint`, `intent`, `description`, and the suggestion trigger block to cover "resume a previous session in a clean chat" phrasings (DE + EN) alongside the existing triggers.
- [ ] **Step 3:** Extend `src/agent-src/commands/evals/agent-handoff.json` with picker-flow cases ("let me continue an old session in a fresh chat", "starte eine neue session mit dem stand von gestern") while keeping the existing 7 cases green.
- [ ] **Step 4:** Update the token-optimizer catalog row for `src/domains/meta/agent-handoff/command.md` in the same change (trigger keywords + one-line summary change), per `token-optimizer-maintenance`. <!-- verify: npx tsx src/scripts/check_token_optimizer_freshness.ts -->

**Exit criteria:** command file describes the CLI-backed flow with all preserved modes; eval fixture extended; token-optimizer freshness check green.
**Rollback:** `git checkout` of the command file + eval fixture — CLI/hook from Phases 1–4 remain usable standalone.

## Phase 6: Projection + docs sync

- [ ] **Step 1:** Regenerate projections (`task sync` + `task generate-tools`) so `dist/agent-src/commands/agent-handoff.md`, `.cursor/`, `.windsurf/`, and the stale `.claude/skills/agent-handoff/SKILL.md` / `.agents/skills/agent-handoff/SKILL.md` match the new source. <!-- carve-out: new-gate-verification -->
- [ ] **Step 2:** Update `docs/setup/per-ide/claude-code.md` (`/agent-handoff` one-liner) and regenerate the catalog surfaces that carry the command description.
- [ ] **Step 3:** Cross-reference sweep: `docs/contracts/agents-layout.md` gains the `handoff-context.md` state-file row next to `hot-context.md`; grep for remaining references to the copy-paste-only behavior. <!-- verify: npx tsx src/scripts/check_references.ts -->

**Exit criteria:** no stale agent-handoff projection remains; reference checker green.
**Rollback:** regen is deterministic from source — re-run `task sync` / `task generate-tools` after reverting source edits.

## Acceptance Criteria

- [ ] `agent-config handoff` in a TTY lists the recent sessions of this project (chat-history primary; Claude transcripts and Codex session store as native adapters) and lets the user pick one.
- [ ] Picking a session writes a privacy-floored, section-complete handoff to `agents/runtime/state/handoff-context.md` deterministically (no LLM spend by default).
- [ ] Starting any new session afterwards injects the handoff exactly once as spotlighted DATA context, then removes the file; `--launch claude` starts the fresh session directly.
- [ ] `--launch codex` starts a fresh Codex session seeded with the handoff as initial prompt — a Codex session picked from `~/.codex/sessions/` can be continued in a clean Codex session end-to-end.
- [ ] `/agent-handoff` (in-chat) routes through the same CLI; `--print` and `--file` legacy modes still work; `lint_handoffs.ts` artifact contract unchanged.
- [ ] All new code paths covered by the targeted vitest files named in the phases; remote CI green on the PR (quality gates delegated to remote CI).

## Notes

- Out of scope, noted during analysis: the `context_hygiene_hook.ts` (`agents/state/`) vs `cmd_analyze_session.ts` (`agents/runtime/state/`) path divergence, and the dead `session_end` branch in `hot_context_hook.main()` — pre-existing, not touched here.
- **Per-host tiers** (analysis 2026-08-03): full flow incl. `--launch` on Claude Code and Codex (v1, this roadmap); picker + auto-inject-on-next-session on the other hook-capable hosts (Cursor, Windsurf, Cline, Gemini CLI, Augment, Cowork — the handoff rides the same session_start surface hot-context uses today; injection guarantee is documented/measured on Claude Code, per-host behavior elsewhere matches whatever hot-context delivers there); copy-paste `--print` only on bundle hosts without hooks (Antigravity, Copilot).
- `gemini` full launch is deliberately a later increment: the adapter table ships with the seam, and the hook-injection path already works for it today.
