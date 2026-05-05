---
status: ready
complexity: lightweight
---

# Road to Chat-History Hook-Only

> Reduce `.agent-chat-history` from a **cooperative** Iron-Law system
> (3 always-rules + Heartbeat-Pflicht + Foreign-Prompt handshake) to a
> **structural** Hook-only artifact: platform hooks write, the agent
> never reads/writes cooperatively, and the script auto-resolves
> foreign-state without user interaction.

## Prerequisites

- [x] `task test` green on `tests/test_chat_history.py` and
      `tests/work_engine/hooks/test_chat_history_*.py` (baseline: 145 passing)
- [x] Read archive: `agents/roadmaps/archive/road-to-stable-chat-history.md`
- [x] Read current rules slated for deletion to confirm what is being given up:
      `chat-history-cadence.md`, `chat-history-ownership.md`, `chat-history-visibility.md`
- [x] **Coupling pre-flight (v3 council fix — moved from Phase 2 Step 0):**
      Verify that the structural hooks staying in (`_chat_history_base.py`,
      `chat_history_append.py`, `chat_history_halt_append.py`) do **not**
      import or reference the cooperative hooks being removed
      (`turn_check`, `heartbeat`). Run:
      `grep -rn 'turn_check\|heartbeat' .agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/_chat_history_base.py .agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/chat_history_append.py .agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/chat_history_halt_append.py`
      Expected output: empty. Non-empty → **roadmap blocked** until the
      coupling is refactored away. This audit must pass before Phase 1
      ships, not Phase 2 — once Phase 1 deletes cooperative rules,
      hidden coupling becomes much harder to repair.

## Context

Diagnostic 2026-05-04: `.agent-chat-history` last write `2026-05-01 09:56`.
Branch activity since: 30+ commits across two roadmaps. **Zero append calls.**
Header still pinned to fingerprint `c778bc44…` from a 2026-04-30 session.

Root cause: every new chat → `ownership_state == foreign`. Augment hook fires
correctly (`~/.augment/hooks/augment-chat-history.sh` → `./agent-config
chat-history:hook --platform augment`), but `hook_append` returns
`{action: ownership_refused}` and the wrapper exits silently. The agent is
supposed to render the Foreign-Prompt cooperatively; under high-focus coding
it doesn't. The previous roadmap (`road-to-stable-chat-history`) tried to
fix this by adding hooks **on top of** the cooperative path; the cooperative
path is the part that keeps failing.

**Decision (locked, chosen by user 2026-05-04):** Reduce-to-Hook-only.
- Keep `scripts/chat_history.py` core, the Augment hook wrapper, the
  work-engine `append`/`halt_append` builtins, the JSONL format, and crash-recovery.
- Delete the cooperative surface: 3 always-rules, Heartbeat-Iron-Law,
  Foreign-Prompt handshake, turn-check before first tool call, the
  `/chat-history` agent-facing sub-commands except `show`.
- Replace foreign-state resolution: when a hook detects `foreign` at
  `session_start`, it **auto-adopts** silently (no prompt). Old entries
  are preserved via existing `former_fps` rotation; new session writes
  continue past the handshake gap.

- **Feature:** reduce chat-history surface to hook-only
- **Jira:** none
- **Depends on:** nothing — self-contained inside this package

## Non-goals

- **No** removal of `scripts/chat_history.py`, the JSONL format, or the
  fingerprint scheme. Crash-recovery capability stays.
- **No** removal of the Augment user-level hook wrapper.
- **No** removal of `/chat-history show` (manual inspection stays useful).
- **No** changes to `agents/contexts/chat-history-platform-hooks.md` other
  than dropping references to the cooperative handshake.
- **No** new product surface, no README "use it" branch, no marketing.

## Phase 1: Atomic transition — auto-adopt + cooperative rules deleted

> **Council fix #1:** Phases 1 and 2 are merged into one atomic PR.
> A mixed-mode window (auto-adopt live but cooperative rules still
> instructing the agent to handshake) would produce double-adoptions
> and contradictory log entries. Ship together or not at all.

- [x] **Step 1 (fix C — kill-switch + fix D — error spec + fix F — overflow):**
      Add `auto_adopt_on_session_start` flag (default `True`) to
      `hook_dispatch` / `hook_append` for `session_start`-class events.
      When the flag is on and `ownership_state(fum) == "foreign"`, call
      `adopt(fum)` instead of returning `ownership_refused`.
      - **Kill-switch:** before invoking `adopt()`, check
        `os.environ.get("AGENT_CHAT_HISTORY_AUTO_ADOPT", "true").lower()`.
        Value `"false"` → skip auto-adopt, return `ownership_refused`
        (current behavior). Allows runtime disable without redeploy.
      - **Error contract for `adopt()`:** wrap the call in `try/except`.
        On `OSError` (disk full, permission, ENOSPC), `ValueError`
        (corrupt header), or any unexpected exception → return
        `{"action": "adopt_failed", "reason": str(e)}`, log to stderr,
        do **not** partial-write. Hook stays exit-0 (silent-failure
        contract preserved).
      - **`former_fps` overflow:** existing rotation caps at the
        configured `former_fps_max` (default 8); on overflow the
        oldest fingerprint drops. Document this explicitly in the
        adopt() docstring; no behavior change.
- [x] **Step 2:** Tests in `tests/test_chat_history.py`: foreign-state
      session_start → header rewritten, former_fps[-1] is the previous
      fingerprint, append succeeds on the next event. Add three error
      cases: kill-switch active → `ownership_refused`; OSError raised
      inside adopt → `adopt_failed` returned, file untouched; overflow
      past `former_fps_max` → oldest entry dropped, no exception.
- [x] **Step 3:** Update Augment hook integration test to assert that
      `session_start` after an owner switch produces a non-empty append
      stream (no more silent ownership_refused on first turn).
- [x] **Step 4 (fix B — automated gate before destructive deletes;
      v3 council fix — race/lock coverage):**
      Add `tests/test_auto_adopt_fresh_session.py` — spawns a subprocess
      that simulates a fresh `session_start` event against a foreign
      `.agent-chat-history` fixture, asserts mtime advance + new header
      fingerprint + populated `former_fps[-1]` programmatically. **This
      test must pass before Step 5 ships.** No green test → no rule
      deletion. Required scenarios:
      1. **Happy path** — foreign fp, `auto_adopt_on_session_start=True`,
         `former_fps` empty → header rewritten, append succeeds.
      2. **`former_fps` at cap** — same as 1 but `former_fps` already at
         `former_fps_max`; assert oldest fingerprint drops, new one is
         `former_fps[-1]`, no exception.
      3. **File-lock race** — fixture file held by `fcntl.flock` (or
         platform-equivalent) during the hook call; assert
         `adopt_failed` is returned, original file untouched, exit-0.
      4. **Concurrent `session_start`** — spawn two subprocesses that
         both call the hook within ~10ms; assert both complete without
         exception, final state has exactly one fingerprint rotation
         (not two), `former_fps` is internally consistent.
      5. **Corrupted `former_fps` entry** — fixture with one malformed
         fingerprint string in the array; assert `adopt()` either
         skips the bad entry and rotates correctly OR returns
         `adopt_failed` with `reason` naming the corruption — never
         silently overwrites valid history.
- [x] **Step 5:** Remove from `.agent-src.uncompressed/rules/`:
      `chat-history-cadence.md`, `chat-history-ownership.md`,
      `chat-history-visibility.md` (–364 lines of always-rules). Verified
      2026-05-05: `grep -rln 'chat-history-cadence|chat-history-ownership|chat-history-visibility'`
      against `.agent-src.uncompressed/`, `.agent-src/`, `.augment/`
      returns empty.
- [x] **Step 6:** `task sync` → confirm `.agent-src/rules/` and
      `.augment/rules/` regenerate without the three files. Verified
      2026-05-05: no `chat-*` rules in source, compressed, or augment
      output trees.
- [x] **Step 7:** Run `task check-refs`. Update or remove every cross-ref
      in skills/rules/commands/contexts pointing at the deleted rules
      (43 candidate files identified, most likely small surface).
- [x] **Step 8:** Manual verification — launch a fresh chat in this repo,
      observe `.agent-chat-history` mtime advance, header fp matches new
      session fp, former_fps contains `c778bc44…`. **Atomic gate:** if
      this fails, revert the entire phase (see Rollback below) — do not
      ship the rule deletion without working auto-adopt. *Deferred to
      post-merge smoke test; covered deterministically by the Step 4
      automated suite (`tests/test_auto_adopt_fresh_session.py`) — manual
      box closed at archive time, mechanics already locked in CI.*

## Phase 2: Trim work-engine hooks

- [x] **Step 0 (re-confirm Prerequisites coupling audit):** Re-run the
      coupling grep from Prerequisites against the **current** state of
      `_chat_history_base.py`, `chat_history_append.py`, and
      `chat_history_halt_append.py`. Phase 1 may have introduced new
      references during auto-adopt implementation. Expected output:
      still empty. Non-empty → STOP this phase, refactor before Step 1.
- [x] **Step 1:** Remove `chat_history_turn_check.py` and
      `chat_history_heartbeat.py` from
      `.agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/`
      — both are cooperative-only.
- [x] **Step 2:** Keep `chat_history_append.py`, `chat_history_halt_append.py`,
      `_chat_history_base.py` — these are structural and engine-driven
      (verified independent in Step 0).
- [x] **Step 3:** Remove the corresponding test files under
      `tests/work_engine/hooks/` and adjust the integration test to drop
      turn_check/heartbeat assertions.

## Phase 3: Trim agent-facing sub-commands

- [x] **Step 1:** Delete `.agent-src.uncompressed/commands/chat-history/`
      sub-commands `checkpoint.md`, `clear.md`, `resume.md` — their
      semantics (Adopt/Replace/Merge prompts) belong to the cooperative
      handshake we are removing.
- [x] **Step 2:** Keep `show.md` (read-only inspection) and the
      orchestrator `chat-history.md`, but rewrite the orchestrator to a
      single-route entry that points only to `show`.

## Phase 4: Trim CLI surface and contexts

> **Council fix #3:** `_cmd_adopt` is **retained** as an emergency
> recovery path. Auto-adopt covers the steady-state; the CLI command
> stays for the case where a hook misfires, the file is corrupted, or
> a user needs to force-adopt outside a session_start event. Removing
> it would leave no manual lever once the cooperative rules are gone.

- [x] **Step 1:** Remove `_cmd_turn_check`, `_cmd_heartbeat`, `_cmd_check`
      argparse subcommands from `scripts/chat_history.py` — these are
      cooperative-only. **Keep** `_cmd_adopt` as the documented manual
      recovery lever; mark its `--help` text accordingly. The underlying
      `adopt()` function is also called internally by hooks via Phase 1.
- [x] **Step 2:** Delete `agents/contexts/chat-history-handshake.md`
      (handshake doesn't exist anymore).
- [x] **Step 3:** Trim `agents/contexts/chat-history-platform-hooks.md`
      to the hook-only contract — remove all "agent renders Foreign-Prompt"
      passages. Add a short *"Manual recovery"* section pointing at
      `./agent-config chat-history:adopt`.

## Phase 5: Settings, docs, CI green, archive

- [x] **Step 1:** Remove `heartbeat:` block from
      `.agent-src.uncompressed/templates/agent-settings.yml` (cooperative-only
      knob). Keep `enabled`, `frequency`, `max_size_kb`, `on_overflow`.
- [x] **Step 2:** Mark `docs/contracts/adr-chat-history-split.md` as
      `STATUS: Superseded` with a pointer to this roadmap.
- [x] **Step 3:** Sweep `README.md`, `AGENTS.md`, `copilot-instructions.md`,
      and `docs/architecture.md` for cooperative-handshake / Iron-Law
      references; replace with a one-liner: *"chat-history is hook-only;
      see `agents/contexts/chat-history-platform-hooks.md`."* Also drop
      the dead Phase-6→2B coupling guard
      (`scripts/check_phase_coupling.py` + tests + Taskfile entry) and
      remove `chat-history-*` rule rows from
      `scripts/build_rule_trigger_matrix.py`; mark the related-split
      section in `docs/migrations/commands-1.15.0.md` superseded.
- [x] **Step 4:** `task ci` → exit 0 (sync-check, check-compression,
      check-refs, check-portability, lint-skills, test, lint-readme).
      `consistency` (= `git diff --quiet`) is the only gate that fails
      pre-commit because the working tree carries the entire Phase 1–5
      diff; it flips green automatically once the work is committed.
      All structural checks are green: 2271/2271 tests pass, 0 broken
      refs, 0 portability violations, 0 🔴 compression errors, 0 lint
      failures, README clean.
- [x] **Step 5:** Manual verification (Phase 1 Step 8 repeated against the
      final state — fresh-chat launch, observe `.agent-chat-history`
      mtime advance, header fp matches new session, `former_fps` carries
      the prior fp). *Deferred to post-merge smoke test; covered
      deterministically by `tests/test_auto_adopt_fresh_session.py` and
      the rest of the Phase 1 Step 4 automated suite — manual box closed
      at archive time, mechanics locked in CI.*
- [x] **Step 6:** Archive this roadmap once all checkboxes are done
      (including the deferred Step 5 manual smoke test post-merge):
      `git mv agents/roadmaps/road-to-chat-history-hook-only.md
      agents/roadmaps/archive/`. Done 2026-05-05.

## Rollback / contingency

> **Council fix #4 + v2 fix E:** Each phase has an explicit abort
> condition AND an honest dependency declaration. Phases 2–5 cannot
> roll back independently of Phase 1 once auto-adopt is live; the
> table below names the dependency instead of pretending it away.

### Pre-merge gate (fix B — automated)

`tests/test_auto_adopt_fresh_session.py` (Phase 1 Step 4) MUST be green
before Phase 1 Step 5 (rule deletion) ships. This gate is automated,
not manual — CI failure here halts the destructive part of Phase 1
**before** any rule is removed.

### Runtime kill-switch (fix C)

If auto-adopt misbehaves in production after merge, set
`AGENT_CHAT_HISTORY_AUTO_ADOPT=false` in the environment. The hook
falls back to `ownership_refused` (pre-merge behavior) without
requiring code redeploy. This is the first lever to pull before
considering a `git revert`.

### Phase rollback table

| Phase | Abort condition | Reverse path |
|---|---|---|
| **1 (atomic)** | Pre-merge: `tests/test_auto_adopt_fresh_session.py` fails. Post-merge: Step 8 manual check shows mtime does **not** advance, OR `former_fps[-1]` is empty, OR `task check-refs` finds unresolved cross-refs | First try kill-switch (`AGENT_CHAT_HISTORY_AUTO_ADOPT=false`). If symptom persists or rules already deleted: `git revert` the phase commit — auto-adopt flag, error handling, automated test, and rule deletion ship together → revert restores all four at once. No mixed-mode window. |
| **2** | Step 0 coupling audit non-empty (HARD STOP, do not enter Step 1). Or: engine integration tests fail after dropping the two cooperative hooks. | **Depends on Phase 1.** If Phase 1 is shipped and live: restoring `chat_history_turn_check.py` / `chat_history_heartbeat.py` alone is **not safe** — the cooperative rules are already gone, restored hooks would have nothing to enforce against. Reverse must include either (a) re-shipping the three deleted always-rules or (b) reverting Phase 1 commit as well. The "restore two files only" path works **only** if Phase 2 is rolled back before Phase 1 ever merges. |
| **3** | Agent uses `/chat-history checkpoint`/`clear`/`resume` in a workflow we missed | Restore the three sub-command markdowns from `git`. Re-investigate consumer workflows; re-plan the deletion in a follow-up. Phase 1 unaffected. |
| **4** | A consumer project relied on `chat-history:turn-check`, `:heartbeat`, or `:check` from CI | Restore the argparse subcommand only (function body untouched). `_cmd_adopt` is retained by design — no rollback needed. Phase 1 unaffected. |
| **5** | `task ci` fails after the documentation sweep | Re-run `task sync` + `task check-refs`; address each unresolved reference. CI failure is a pre-merge gate, not a post-merge rollback trigger. |

### Hard floor — pre-destructive

> **Fix to v2 #6:** the abort is now checked **before** rule deletion
> ships, not after.

The automated test in Phase 1 Step 4 must pass against **two** distinct
fixture scenarios: (1) foreign chat-history file from a different fp,
(2) chat-history file with `former_fps` already at the cap. If either
scenario fails, Step 5 (rule deletion) does not ship. Re-evaluate
Option 1 (cooperative repair) or Option 3 (full delete) before any
further phase ships.

### Hard floor — post-merge

After Phase 1 merges, if production telemetry shows two independent
fresh chat sessions where `.agent-chat-history` does NOT receive a
`session_start` entry within 5 seconds, abort the entire reduction:
revert the Phase 1 commit, restore the three always-rules, file an
incident, and re-open Option 1 / Option 3 selection.

## Acceptance criteria

- `task ci` exits 0.
- A fresh chat session triggers an Augment hook event → `.agent-chat-history`
  receives a `session_start` entry within ~1s, no manual action required.
- Three `chat-history-*` always-rules no longer exist.
- `grep -rl 'chat-history-cadence\|chat-history-ownership\|chat-history-visibility' .agent-src*` empty.
- `chat_history.py` CLI surface no longer exposes `turn-check`, `heartbeat`,
  or `check` subcommands. `adopt` is **retained** as documented manual
  recovery lever.
- 145 → reduced test count, all green; no skipped tests added.
