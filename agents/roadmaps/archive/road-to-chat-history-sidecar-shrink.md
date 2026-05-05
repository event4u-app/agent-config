---
status: ready
complexity: lightweight
---

# Roadmap: Chat-History Sidecar Shrink

> Drop `first_user_msg` from `.agent-chat-history.session`; keep only
> `{fp, started_at}`. Hooks read `sidecar.fp` directly instead of
> re-deriving fp from the cached prompt. Removes the only PII surface
> in the chat-history persistence layer and reduces the sidecar from
> ~175 bytes to ~80. Pre-requisite for the parked
> `road-to-chat-history-session-isolation.md`.

## Prerequisites

- [x] Read `scripts/chat_history.py` — `sidecar_path`, `read_sidecar`, `write_sidecar`, `hook_append`, `append`, `ownership_state`
- [x] Confirm `pytest tests/test_chat_history*` and `pytest tests/test_auto_adopt_fresh_session.py` green before any change
- [x] Acknowledge: `agents/roadmaps/road-to-chat-history-session-isolation.md` parks behind this roadmap and resumes once Phase 5 lands

## Why

Today `write_sidecar()` (`scripts/chat_history.py:537`) persists the full
first user message in plaintext on disk. For platforms that supply the
real prompt at `SessionStart` (e.g. Claude Code) this is a privacy
regression — the prompt may contain PII, secrets, code paths, customer
data. The cached value is only used to recompute the SHA-256 fingerprint
on subsequent stateless hook calls; the fingerprint itself is sufficient
for every cross-call use case (ownership guard, foreign detection,
auto-adopt). Storing `fp` directly is strictly more information-poor and
strictly sufficient.

Secondary win: the sidecar shrinks ~55 %, the schema becomes "fp + when",
and `hook_append`'s non-`session_start` branch loses one
`fingerprint(fum)` call per event.

## Design summary

| Aspect | Today | After this roadmap |
|---|---|---|
| Sidecar payload | `{first_user_msg, fp, started_at}` | `{fp, started_at}` |
| Sidecar size | ~175 bytes | ~80 bytes |
| `hook_append` non-`session_start` | read `sidecar.first_user_msg` → `fingerprint()` → compare with header | read `sidecar.fp` → direct compare with header |
| `append()` ownership guard | `first_user_msg=` → recompute fp | new `expected_fp=` (additive); `first_user_msg=` kept for back-compat |
| `ownership_state` | `(first_user_msg, *, path)` | adds `ownership_state_for_fp(fp, *, path)` thin core; `ownership_state` becomes wrapper |
| Privacy on disk | full first user prompt persisted | only SHA-256 hex |
| CLI surface | `--first-user-msg` everywhere | unchanged |

## Rollback / kill-switches

| Switch | Default | Effect when set |
|---|---|---|
| `AGENT_CHAT_HISTORY_SIDECAR_LEGACY=true` | unset | `write_sidecar()` includes `first_user_msg` again — pre-roadmap behaviour |

Reader is forward- and backward-compatible either way: a v2-shape sidecar
(with `first_user_msg`) and a v3-shape sidecar (without) both surface
`fp` to callers; the extra `first_user_msg` key is silently ignored.
File rotation is automatic — the next `session_start` rewrites the
sidecar in whatever shape the running code produces.

## Non-goals

- **No** change to fingerprint computation, ownership rotation, or `former_fps[]` semantics.
- **No** removal of the sidecar file — it is shrunk, not dropped (Pfad A was rejected; see § Architectural alternatives).
- **No** CLI signature change. `--first-user-msg` stays on `init`, `adopt`, `reset`, `state`, `append`.
- **No** on-disk migration. The next `session_start` after upgrade rewrites the sidecar; legacy sidecars stay readable until then.
- **No** schema version field on the sidecar. Shape-based detection (presence of `fp`) is sufficient.

## Architectural alternatives considered

| Option | A — drop sidecar entirely | B — shrink to `{fp, started_at}` (chosen) |
|---|---|---|
| Disk surface | sidecar deleted | sidecar kept, ~80 bytes |
| Cross-hook identity | none — hooks compare `header.fp` to itself | preserved — `sidecar.fp` is the writer's identity, distinct from `header.fp` (file owner) |
| Mid-session foreign-write detection | lost — hook cannot tell "I am foreign" because there is nothing to compare against | preserved — `sidecar.fp != header.fp` ⇒ another process adopted underneath |
| Privacy | best (no file at all) | strong (no `first_user_msg`, only fp) |
| Migration cost | hooks need fp from elsewhere (env, platform session id) — env doesn't survive process boundaries | minimal — same file, smaller payload |

**Why B:** Pfad A loses a real safety property — today a stateless hook
running mid-session can detect that another process has adopted the
file underneath it (`sidecar.fp != header.fp`). Without the sidecar,
the hook only sees `header.fp` and has no second opinion to compare
against. Env-var carriers (Pfad A.2) don't work because each platform
hook invocation is an independent process. B keeps the safety property,
gives us the privacy win, and drops the redundant data.

## Phase 1 — Additive: `expected_fp=` on append() and helpers

Pure-additive phase. No behaviour change for existing callers.

- [x] **Step 1:** Add `ownership_state_for_fp(fp: str, *, path: Path | None = None) -> str` returning the same `match` / `returning` / `foreign` / `missing` states as `ownership_state()`.
- [x] **Step 2:** Refactor `ownership_state(first_user_msg, *, path=None)` to compute `fp = fingerprint(first_user_msg)` and delegate to `ownership_state_for_fp(fp, path=path)`. Behaviour unchanged.
- [x] **Step 3:** Add `expected_fp: str | None = None` kwarg to `append()`. Validation rule: at most one of `first_user_msg` / `expected_fp` may be set; both set → `ValueError`.
- [x] **Step 4:** When `expected_fp` is set, the ownership-guard branch uses it directly: `state = ownership_state_for_fp(expected_fp, path=p)`; `OwnershipError.current_fp` is `expected_fp` verbatim.
- [x] **Step 5:** Tests: parity between `append(..., first_user_msg=fum)` and `append(..., expected_fp=fingerprint(fum))` — same accept/reject behaviour, same `OwnershipError` payload; both-args raises `ValueError`; `ownership_state_for_fp("<unknown>")` returns `foreign` (or `missing` if no header).

## Phase 2 — Hook write path uses `sidecar.fp` directly

No on-disk format change yet — sidecar still contains `first_user_msg`.

- [x] **Step 1:** In `hook_append()` non-`session_start` branch: replace `fum = first_user_msg or (side or {}).get("first_user_msg")` and downstream `append(entry, path=p, first_user_msg=fum)` with reading `sidecar_fp = (side or {}).get("fp")` and `append(entry, path=p, expected_fp=sidecar_fp)`.
- [x] **Step 2:** `skipped_no_sidecar` action triggers when `sidecar_fp` is missing/empty (was: when `fum` was missing). Hint message updated.
- [x] **Step 3:** Bootstrap path in `hook_dispatch` (sidecar synthesis on first non-`session_start` event when sidecar missing) is unchanged — it still computes fp from the synthesized prompt and writes the sidecar via `session_start`.
- [x] **Step 4:** Tests: hook write parity with Phase 0 baseline — same entries appended, same actions returned; sidecar-missing → `skipped_no_sidecar`; sidecar present but `fp` key missing (corrupted/older) → `skipped_no_sidecar` with clear hint; foreign-adopt scenario still works (new owner's `session_start` rewrites both header and sidecar; subsequent hook reads new fp).

## Phase 3 — Drop `first_user_msg` from sidecar writes (privacy win)

This is the load-bearing change.

- [x] **Step 1:** `write_sidecar(first_user_msg, *, path=None)` keeps its signature (callers unchanged) but the persisted payload becomes `{"fp": fingerprint(first_user_msg), "started_at": _now()}` — no `first_user_msg` key.
- [x] **Step 2:** Kill-switch: when `AGENT_CHAT_HISTORY_SIDECAR_LEGACY=true`, payload reverts to `{"first_user_msg", "fp", "started_at"}` for downgrade-friendly rollouts.
- [x] **Step 3:** Reader (`read_sidecar`) is unchanged — it already returns the dict as-is; downstream code reads `fp` (Phase 2) which is present in both shapes.
- [x] **Step 4:** Tests: written sidecar contains exactly `{fp, started_at}` and **no** `first_user_msg` key (privacy regression test); legacy sidecar fixture (with `first_user_msg`) still readable and `hook_append` works on it; kill-switch produces legacy shape; downgrade scenario — old code reads new sidecar, falls through to `skipped_no_sidecar`, next `session_start` rewrites sidecar in old code's expected shape (self-healing, one-event blip).

## Phase 4 — Cleanup + docs

- [x] **Step 1:** Update `agents/contexts/chat-history-platform-hooks.md` — describe the post-shrink sidecar shape and why `fp` (not `first_user_msg`) is the cross-hook identity.
- [x] **Step 2:** Audit `scripts/chat_history.py` docstrings (module header, `write_sidecar`, `hook_append`) for stale references to "first_user_msg in sidecar". Replace.
- [x] **Step 3:** No README or AGENTS.md change — sidecar is implementation detail, not user-facing surface.
- [x] **Step 4:** `task ci` green; `pytest tests/test_chat_history*` green; `pytest tests/test_auto_adopt_fresh_session.py` green; skill linter clean.

## Phase 5 — AI Council pass on the diff

- [x] **Step 1:** Run `/council` on the merged diff with the question "Does this change actually land the privacy win, or is `first_user_msg` still leaking through some other persistence path (logs, error messages, OwnershipError fields, hook return values)?" Estimated cost: ~$0.05–$0.10.
- [x] **Step 2:** Address findings or document explicit reject rationale. Append to `### Council notes` below.

## Phase 6 — Archive + unblock session-isolation

- [ ] **Step 1:** `git mv` this file to `agents/roadmaps/archive/` and regenerate the dashboard.
- [x] **Step 2:** Edit `agents/roadmaps/road-to-chat-history-session-isolation.md` § Notes to remove the "parked behind sidecar-shrink" marker and signal the dependency is cleared. *(N/A — session-isolation roadmap already landed and archived in the prior session.)*

## Acceptance criteria

- [x] `.agent-chat-history.session` written by current code contains no `first_user_msg` key.
- [x] `hook_append` non-`session_start` path uses `sidecar.fp` directly; no `fingerprint()` recomputation per hook event.
- [x] Legacy sidecar (with `first_user_msg`) remains readable; existing user files do not need manual migration.
- [x] `AGENT_CHAT_HISTORY_SIDECAR_LEGACY=true` restores pre-roadmap sidecar shape verbatim.
- [x] No change to fingerprint, ownership rotation, `former_fps[]`, or any CLI signature.
- [x] `OwnershipError` payload format unchanged (downstream callers unaffected).
- [x] All quality gates pass (`task ci`, pytest, skill linter).

## Notes

- The chosen identity for the cross-hook handshake is the SHA-256 hex of the first user message, not the message itself. This is the same identity already stored in `header.fp` and `header.former_fps[]`, just persisted in a different file with different lifetime semantics (sidecar = current writer; header = current owner; they normally agree, diverge under foreign-adopt).
- `expected_fp=` on `append()` is intentionally kept as a separate kwarg from `first_user_msg=` rather than refactoring the latter to the former. The CLI uses `--first-user-msg` and existing test fixtures pass the prompt directly; rewriting them was out of scope and not worth the churn.
- Session-isolation Roadmap (`road-to-chat-history-session-isolation.md`) parks behind Phase 5 of this roadmap. Once this lands, that roadmap's Phase 1 (`s = header.fp[:16]`) is unaffected — we only changed *where* fp is cached cross-call, not what it is.

### Council notes

**Round 1 — 2026-05-05** (`agents/council-sessions/2026-05-05-sidecar-shrink/responses.json`,
actual cost $0.0593).

**Members:** anthropic/claude-opus-4-1, openai/gpt-4o.

**Convergent verdict:** *Mixed.* Sidecar privacy win lands. Both members
flag the JSONL header `preview` field as the primary remaining leak.

**Findings & dispositions:**

| # | Finding | Verified | Disposition |
|---|---|---|---|
| 1 | Sidecar no longer persists `first_user_msg`; `OwnershipError` carries only SHA hexes; hook return dicts carry only fp hexes; no raw prompt in exception traces. | ✅ Code-walked `OwnershipError.__init__` (`scripts/chat_history.py:60`) and both `raise` sites (lines 220, 229) — message is `f"chat-history ownership refused: state={state}"`, payload is `header_fp` + `current_fp` (both fp hex). | **Win lands.** This is the roadmap's primary objective. |
| 2 | JSONL header `preview` field still persists ≤80 chars of the raw prompt (`init` at line 160, `adopt` at line 336). Council estimated 200 chars; actual is 80 (`_preview` default `n=80`). | ✅ Verified. | **Out of scope — explicit reject.** Header preview is the user-facing identifier surfaced by `list_sessions()` (line 487) and consumed by `/chat-history learn` for the numbered-options pick. Removing it would break the selective-learning UX (user cannot identify sessions by SHA hex). Treating preview as a separate privacy/UX trade-off in a follow-up roadmap (`road-to-chat-history-header-preview-redaction.md`, not yet created). |
| 3 | `list_sessions()` body-derived `preview` (first user-typed entry text, truncated to 80 chars). | ✅ Verified at line 487. | **Out of scope — same rationale as #2.** Same UX surface, same trade-off, same follow-up roadmap. |
| 4 | CLI `--first-user-msg` accepts the raw prompt as argv → shell history exposure. | ✅ Acknowledged. | **Out of scope — known limitation.** argv is process-local; persistence is the user's shell-history setting. Documented here as known limitation; not addressable inside this package without breaking the CLI contract. |
| 5 | Add a regression test asserting raw prompt bytes are absent from the on-disk sidecar. | ✅ Already present: `test_write_sidecar_default_shape_no_first_user_msg` (`tests/test_chat_history.py:1481`) reads the sidecar bytes and asserts `"super secret prompt" not in raw`. | **Closed.** |

**Net:** Phase 5 lands the sidecar-scoped privacy win as scoped by this
roadmap. Header-preview redaction is a real, distinct concern that the
council surfaced cleanly; deferring to a follow-up roadmap rather than
expanding this one keeps the diff narrow and the trade-off (privacy vs
session-pick UX) negotiable on its own merits.
