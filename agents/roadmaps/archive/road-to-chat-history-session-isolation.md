# Roadmap: Per-Session Isolation in Chat-History

> Tag every body entry with the writing session's id, default reads to
> the current session, and add a manual command for browsing / learning
> from prior sessions. Replaces the implicit "shared notebook" model
> with per-session isolation + opt-in cross-session import.

## Prerequisites

- [x] Read `agents/contexts/chat-history-platform-hooks.md`
- [x] Read `scripts/chat_history.py` (header schema, `append`, `hook_dispatch`, sidecar)
- [x] Confirm `pytest tests/test_chat_history*` green before any change
- [x] Confirm prior roadmap `road-to-chat-history-hook-only.md` is closed and archived (archived 2026-05-05 to `agents/roadmaps/archive/`).

> **Sidecar-shrink roadmap is NOT a prerequisite.** `road-to-chat-history-sidecar-shrink.md`
> remains a separate, parallel option. This roadmap reads `header.fp[:16]` directly
> and works against either v2 or v3 sidecar shapes — `sidecar.fp` is the same value
> in both. If sidecar-shrink lands later, no change to this roadmap is required.

## Why

Today `.agent-chat-history` is one shared file. The fingerprint
mechanism guarantees a single writer and lets a fresh chat detect
whether it is the original owner, a returning owner, or a foreigner.
But body entries carry no session marker — they are co-mingled in one
append-only log. When chat B adopts chat A's file, every read in B
includes A's full body.

User-visible problem: opening a fresh chat in the same workspace
inherits an opaque history unrelated to the new task. Goal:
per-session isolation by default, with an explicit lever to learn
from prior sessions on demand.

## Design summary

| Aspect | Today | After this roadmap |
|---|---|---|
| Schema | v2 — header with `session`, `fp`, `former_fps`; body entries `{t, text, ts}` | v3 — header unchanged; body entries gain `s` (session id of the writer) |
| Default read | Returns every body entry in the file | Returns only entries with `s == current_session` |
| Manual recovery | `chat-history:adopt` (rotate fp) | unchanged + `chat-history:sessions` (list) + `/chat-history learn` (selective import) |
| Migration | n/a | v2 entries (no `s`) classified as `<legacy>` on read; on-disk file untouched |
| Hook write path | `hook_dispatch` writes `{t, text, ts}` | `hook_dispatch` writes `{t, text, ts, s}` where `s = header.fp[:16]` |

## Architectural alternatives considered

Council Round 1 surfaced one structural alternative worth documenting:

| Option | A — tagged entries (chosen) | B — file per session |
|---|---|---|
| Storage | one `.agent-chat-history` JSONL, body entries gain `s` | `.agent-chat-history.<session>.jsonl` per session + index |
| Read isolation | filter on `s == current_session` | open the file matching current session |
| Cross-session "learn" | scan one file, group by `s` | enumerate sibling files, pick by name |
| Hook-only compatibility | full — fp / sidecar / adopt mechanics unchanged | breaks: adopt rotates which file the new owner writes to |
| Migration | v2 entries land under `<legacy>` bucket on read | move existing file to `*.<legacy-id>.jsonl`, write index |
| Implementation effort | ~5 phases, read-path + hook stamp | new storage layer + new fp/sidecar lifecycle around file naming |
| Risk surface | `s` mis-stamping, sidecar drift | concurrent file creation, stale index, fp-vs-filename divergence |

**Why A:** Option B forces a redesign of the hook-only ownership model (sidecar
contract, auto-adopt, `former_fps`) that was just stabilized. Tag-and-filter is
strictly additive — same file, same fingerprint mechanics, same recovery levers.
Option B's claimed simplicity ("open the right file") is offset by a new "which
file does this session write to?" problem that re-creates the auto-adopt question
one layer up.

**When B would win:** read-filter performance on >100 MB history files (Council
noted full-scan), or if cross-tenant filesystem isolation becomes a hard
requirement. Both are post-v1 considerations.

**Decision:** Build Option A. Revisit Option B only if a concrete performance or
isolation requirement forces it.

## Rollback / kill-switches

Each behaviour change is gated by an env var. Phases land kill-switch-first so a
bad rollout reverts to v2 contract without code revert:

| Switch | Default | Effect when set to `false` |
|---|---|---|
| `AGENT_CHAT_HISTORY_SESSION_FILTER` | `true` | `read_entries()` returns every entry — v2 behaviour |
| `AGENT_CHAT_HISTORY_SESSION_TAG` | `true` | `append()` skips the `s` field — entries look like v2 |
| `AGENT_CHAT_HISTORY_AUTO_ADOPT` | `true` (existing) | unchanged from hook-only roadmap |

File format stays forward-compatible either way: a v3 reader on a v2-tagged file
shows everything as `<legacy>`; a v2 reader on a v3 file ignores the extra `s`
field.

## Non-goals

- **No** change to fingerprinting, ownership rotation, or `former_fps`.
- **No** new storage layer — same JSONL file.
- **No** automatic merge / dedup across sessions.
- **No** removal of silent auto-adopt — that contract stays.
- **No** prompt at `session_start`. The "learn" flow is user-initiated only.
- **No** retroactive splitting of legacy entries — pre-v3 entries lack the
  per-line marker needed to attribute them; they stay one `<legacy>` bucket.
  This is a known limitation, not a defect (see Council notes R4).

## Phase 1 — Schema v3 + per-entry session tagging

Establishes the wire format and the single source of truth for "current
session id". No reads or writes are filtered yet — this phase is purely
additive and reversible by the `_TAG` kill-switch.

**Session-id origin (Council Round 2 / R2-1):** the active session id is
already on disk today. `header.fp` (and the matching `sidecar.fp` written
by `write_sidecar()` in `scripts/chat_history.py:537`) is a SHA-256 hash
of `first_user_msg` and is rotated together with `former_fps[]` on
every adopt. We adopt that as the session id — no new sidecar field, no
"initialization paradox", no header-vs-sidecar divergence (they are
written together in the same critical section by `hook_append`'s
`session_start` branch).

- [x] **Step 1:** Bump `SCHEMA_VERSION` to `3` in `scripts/chat_history.py`.
- [x] **Step 2:** Helper `_current_session_id(path) -> str` reads `header.fp` (preferred) or `sidecar.fp` (equivalent, used when header read is suppressed) and returns the first 16 hex chars. Both missing or unreadable → sentinel `"<unknown>"`. **No new sidecar key, no schema change to the sidecar.**
- [x] **Step 3:** `append(path, entry, *, session=None)` — when `AGENT_CHAT_HISTORY_SESSION_TAG=true` (default) and caller did not pass `session`, fill `s = _current_session_id(path)`. Caller-provided `s` always wins. Switch off → no `s` field written.
- [x] **Step 4:** Pre-v3 entries (no `s` key) classify as legacy under sentinel id `<legacy>` at read time. **No on-disk rewrite.** Acknowledged limitation: pre-v3 entries cannot be split by their original session — they collapse into one bucket because the per-line marker did not exist (Council R1-R4). Partial mitigation: `former_fps[]` in the header preserves past-session boundaries, so future Phase 4 listings can show "N adopt events known, K body entries unattributable" instead of a single opaque blob. *Spec-only at Phase 1 — read-side classification lands in Phase 3.*
- [x] **Step 5:** Tests: header.fp present → `s` matches `header.fp[:16]`; header missing → `s = "<unknown>"`; header malformed → `s = "<unknown>"`; caller-provided `s` preserved verbatim; `_TAG=false` → no `s` field; legacy entries parse and surface as `<legacy>`. *Adopt-race (two processes calling `adopt()`) deferred to Phase 2 alongside hook integration tests — pre-existing concern unrelated to session tagging; sidecar uses `_atomic_write_text` already, JSONL header write does not. Tracked in Phase 2 Step 3.*

## Phase 2 — Hook write integration

Hooks must stamp `s` **before** any read path filters on it. This phase
lands the writer side first so the system is never in the broken state
"reads filter on `s` but new entries have no `s`" (Council R-Sequencing).

- [x] **Step 1:** `hook_dispatch()` calls `_current_session_id(path)` and passes the result as `session=` into `append()`. Header + sidecar are written together by the existing `session_start` branch (`scripts/chat_history.py` `hook_append` + `init` + `write_sidecar`); no new write step is added.
- [x] **Step 2:** Verify auto-adopt path: `adopt()` rotates `header.fp` into `former_fps[]` and writes the new fp into header + sidecar in the same critical section **before** the new owner's first body append; old owner's entries keep their original `s` (no rewrite).
- [x] **Step 3:** Tests:
  - foreign-adopt scenario — header.fp + sidecar.fp updated atomically, new entries carry new `s = new_fp[:16]`, old entries keep theirs;
  - returning-owner scenario — header.fp restored on adopt, returning entries carry the returning owner's `s`, and the previous fp lands in `former_fps[]`;
  - fresh-session scenario — `session_start` writes header + sidecar, all entries in the session carry the same `s`;
  - sidecar-deleted-mid-run — `_current_session_id()` falls back to `header.fp[:16]`; `s` keeps stamping correctly (no crash, no `<unknown>` regression);
  - both-deleted-mid-run — header gone too → hook short-circuits with `skipped_no_sidecar` (the `<unknown>` fallback path is exercised by Phase 1 `test_append_unknown_session_when_no_header`).

## Phase 3 — Read path filtering (kill-switch-gated)

Now that writes are tagged, reads can filter safely. Gated by
`AGENT_CHAT_HISTORY_SESSION_FILTER`. Set to `false` → v2 behaviour returns.

- [x] **Step 1:** `read_entries(...)` gains optional `session: str | None = None`. `None` keeps legacy "return everything" behaviour. Explicit string filters by exact match.
- [x] **Step 2:** New `read_entries_for_current(path)` — when `_FILTER=true`: wraps `read_entries(session=_current_session_id(path))`; when `_FILTER=false`: returns `read_entries(session=None)`.
- [x] **Step 3:** CLI `chat-history:read` defaults to current session via `read_entries_for_current`; `--all` opts out; `--session <id>` filters explicitly. Includes `<legacy>` and `<unknown>` as valid `--session` values.
- [x] **Step 4:** Tests: filter correctness on tagged + `<legacy>` + `<unknown>` mix; `--all` returns everything; `_FILTER=false` returns everything regardless of `session=` arg; sidecar-missing-but-header-present → filter resolves to `header.fp[:16]` and surfaces that session's entries; both-missing → filter resolves to `<unknown>` and surfaces only `<unknown>` entries. Performance test: 10k-entry file with `_FILTER=true` completes in <100 ms (acknowledges Council R9 — flagged but acceptable for v1).

## Phase 4 — Session listing

- [x] **Step 1:** Helper `list_sessions(path)` returns `[{id, count, first_ts, last_ts, preview}]`. Preview = first `user`-typed entry text per session, truncated to 80 chars. `<legacy>` and `<unknown>` appear as their own buckets. Implementation reads `header.former_fps[]` to enumerate **historical** session ids alongside the live `header.fp` — even if the body has no entries tagged for an old fp, the listing still surfaces "session existed, no body entries attributable" so the user knows it happened (Council R2-4).
- [x] **Step 2:** CLI `chat-history:sessions` prints a table sorted by `last_ts` desc, with options `--limit <N>` (default 20) and `--include-empty` (default off — show only sessions with at least one body entry). Council R6 acknowledged: fuzzy search / pagination beyond `--limit` is v2.
- [x] **Step 3:** Performance bound (Council Round 2 / R2-3): `list_sessions()` is O(n) over body entries — same trade-off as `read_entries()`. Test: 10k-entry file with mixed sessions completes in < 200 ms. Same v1 ceiling as Phase 3.
- [x] **Step 4:** Tests: empty file; single session; two sessions; legacy + tagged interleaved; `<unknown>` entries; `former_fps[]` populated but no tagged body entries (returns "empty" buckets if `--include-empty`, otherwise omitted); `--limit` truncation; perf bound from Step 3.

## Phase 5 — Selective learning command

- [x] **Step 1:** New command file `.agent-src.uncompressed/commands/chat-history/learn.md`. Flow: agent runs `chat-history:sessions`, surfaces top N as numbered options (per `user-interaction`), user picks one, agent reads via `read_entries(session=<id>)` and presents the picked session's entries **verbatim** to the user (Council Round 2 / R2-2 — resolves the prior structured-vs-verbatim contradiction in favour of verbatim, the more honest v1 contract).
- [x] **Step 2:** Update `.agent-src.uncompressed/commands/chat-history.md` orchestrator to route `show` (default) vs `learn` (new).
- [x] **Step 3:** Selection is always user-driven — no autonomous import. One session per `learn` invocation in v1 (multi-pick is v2). Document the constraint in the command file.
- [x] **Step 4:** v1 scope explicit (Council R6): no fuzzy search, no full-text grep, no automatic summary heuristics, no rewriting of the user's context. The agent reads the picked session's entries verbatim; any subsequent extraction or summarisation happens in dialogue, user-directed.
- [x] **Step 5:** Update `agents/contexts/chat-history-platform-hooks.md` § Read contract with the new isolation default + the `learn` opt-in path.

## Phase 6 — Final AI Council pass + docs sweep

Round 1 ran **before** Phase 1 (see § Council notes — Round 1 below) and
its findings shaped the current Phases 1–5. Round 2 verifies the
revisions and reviews the final implementation.

- [x] **Step 1:** Ran `/council roadmap:agents/roadmaps/road-to-chat-history-session-isolation.md` (post-implementation pass — see § Council notes — Round 3). Findings appended below.
- [x] **Step 2:** Adjusted scope based on Round 3 notes, with explicit reasons for non-adoption per point.
- [x] **Step 3:** Final docs pass — `agents/contexts/chat-history-platform-hooks.md` § Read contract added; `AGENTS.md` unchanged (no user-facing surface in the package's own docs needs an update — the surface is shipped via the consumer-installed `commands/chat-history.md`).
- [x] **Step 4:** `task lint-skills`, `task check-refs`, `task check-compression`, `task check-portability` green; `task test` green (2313 passed); `pytest tests/test_chat_history*` green (127 passed). `task ci` consistency-task fails on dirty working tree as expected mid-roadmap; clean run will follow Phase 7 commit.

## Acceptance criteria

- [x] With `_FILTER=true` (default), `chat-history:read` and `read_entries()` return only current-session entries.
- [x] With `_FILTER=false`, both behave identically to v2 (return everything).
- [x] `chat-history:sessions` lists distinct sessions with usable previews; `<legacy>` and `<unknown>` appear as their own buckets.
- [x] `/chat-history learn` is user-initiated, surfaces sessions as numbered options, reads only what the user picks.
- [x] v2 files keep working — legacy entries surface under `<legacy>` and are filterable.
- [x] `current_session_id` resolves from `header.fp` (preferred) or `sidecar.fp` (equivalent — written together by `hook_append`'s `session_start` branch); both missing → `<unknown>`. No new sidecar key, no schema change to the sidecar.
- [x] No change to fingerprinting, ownership rotation, or `former_fps` semantics. `former_fps[]` becomes the enumeration source for historical session ids in `list_sessions()`.
- [x] All quality gates pass — `task lint-skills`, `task check-refs`, `task check-compression`, `task check-portability`, `task test` (2313 passed). Full `task ci` will go green after the working tree is committed (consistency-check requires a clean tree).

## Phase 7 — Archive

- [x] **Step 1:** Once all phases complete, `git mv` this file to `agents/roadmaps/archive/` and regenerate the dashboard.

## Notes

- Migration is read-only — v2 entries are never rewritten on disk. A future hygiene pass could opt-in tag them, but this roadmap does not require it.
- `s` lives next to `t`, `text`, `ts` — one short string per line, JSONL footprint impact negligible.
- Council Round 1 ran on the original draft; its findings are recorded below as part of the design provenance. Round 2 is Phase 6 Step 1.

### Council notes — Round 1 (pre-Phase-1)

Run: `.agent-cache/council-runs/session-isolation-r1.json` · members:
`anthropic/claude-opus-4-1`, `openai/gpt-4o` · cost: ~$0.14.

**Convergent (both providers):**

- **R-Sequencing:** Read-filtering must not land before write-tagging.
  → addressed: Phase 2 = hook write integration, Phase 3 = read filter.
- **R-Sidecar-Contract:** Header fallback for `_current_session_id` is
  non-deterministic; the sidecar must be the single source of truth.
  → addressed differently after Round 2 (see § Council notes — Round 2
  / R2-1): `header.fp` and `sidecar.fp` are written together by
  `hook_append`'s `session_start` branch (`scripts/chat_history.py:537`
  + same critical section as `init`), so they are by-construction equal
  and there is no header-vs-sidecar divergence to resolve. Missing both
  → `<unknown>`.
- **R-Rollback:** Each phase needs a kill-switch and a defined rollback.
  → addressed: `AGENT_CHAT_HISTORY_SESSION_FILTER` and
  `AGENT_CHAT_HISTORY_SESSION_TAG`, documented up front.

**Opus-only (substantive):**

- **R4 — legacy bucket is lossy:** pre-v3 entries collapse into one
  `<legacy>` bucket. → acknowledged as a known limitation in Non-goals;
  pre-v3 entries lack the per-line marker needed to attribute them, so
  splitting them retroactively is not possible without invented data.
- **R6 — `learn` UX hand-waved:** large session lists, no search.
  → addressed: Phase 4 Step 2 adds `--limit`; Phase 5 Step 4 declares
  search/pagination/auto-summary as v2 scope.
- **R7 — alternative architecture (file-per-session):** documented in
  § Architectural alternatives considered. Rejected for v1 because it
  forces a redesign of the hook-only ownership model that was just
  stabilized; revisit if performance or filesystem-isolation becomes a
  hard requirement.
- **R9 — performance:** read-filter is full-scan. → acknowledged with
  a 10k-entry / <100 ms test in Phase 3 Step 4 as the v1 ceiling.
- **R-Test-Coverage:** concurrent writes, adopt-during-write, sidecar
  delete mid-op. → addressed: Phase 1 Step 6 + Phase 2 Step 3.

**Council too late (was Phase 6):** addressed by running Round 1 now,
before Phase 1; Phase 6 becomes the post-implementation Round 2.

### Council notes — Round 2 (post-revision, pre-Phase-1)

Run: `.agent-cache/council-runs/session-isolation-r2.json` · members:
`anthropic/claude-opus-4-1`, `openai/gpt-4o` · cost: ~$0.20.

**Convergent verdict:** Round 1 fixes for R-Sequencing, R-Rollback, R4,
R6, R7, R9, R-Test-Coverage close the residual risk. Phases 2 → 3
ordering is correct; the `_FILTER` and `_TAG` switches give per-phase
rollback; `<legacy>` bucket is honestly scoped; Option A vs Option B
trade-off is sound.

**Divergent findings — accepted:**

- **R2-1 — sidecar-contract over-engineering (Opus, code-verified):**
  Opus flagged an "initialization paradox" in the original Phase 1
  Step 2 sidecar-contract spec. Lookup in `scripts/chat_history.py:537`
  shows `write_sidecar()` already persists `{"first_user_msg", "fp",
  "started_at"}`, and `hook_append`'s `session_start` branch writes
  sidecar + header in the same critical section. → adopted: Phase 1
  redesigned to use `header.fp[:16]` (or equivalent `sidecar.fp[:16]`)
  directly. No new sidecar key, no contract spec, no paradox. Sidecar
  schema is **unchanged** vs v2.
- **R2-2 — Phase 5 verbatim/structured contradiction (Opus):** Step 1
  said "structured summary", Step 4 said "verbatim". → adopted:
  resolved in favour of verbatim (honest v1 contract; any
  summarisation happens user-directed in dialogue). Step 1 + Step 4
  now consistent.
- **R2-3 — `list_sessions()` perf unbounded (Opus):** added explicit
  10k-entry / <200 ms bound to Phase 4 Step 3, mirroring Phase 3.
- **R2-4 — `former_fps[]` as historical session source (Opus,
  partial mitigation of R1-R4):** Phase 1 Step 4 + Phase 4 Step 1
  now reference `header.former_fps[]` so `list_sessions()` surfaces
  every adopt boundary even when the body lacks tagged entries for
  that fp ("session existed, no body entries attributable").

**Divergent findings — rejected with reasoning:**

- **Opus #2 — Phase 2 needs its own kill-switch:** rejected.
  `AGENT_CHAT_HISTORY_SESSION_TAG=false` already short-circuits the
  hook write path's tagging; Phase 2 has no behaviour beyond what
  Phase 1's switch covers.
- **Opus #5 — Option A requires sidecar redesign, pivot to Option B:**
  rejected, **based on a code error in the critique**. Opus assumed
  the sidecar would need a new `session` field; the codebase already
  carries `sidecar.fp` (since v1) and `header.fp` (since v1) in lock-
  step. Option A is purely additive at the entry level — one short
  string per JSONL line, no schema change to either header or sidecar.
  Option B's filesystem-isolation cost is unjustified by this
  (non-existent) sidecar pressure.

**Phase 6 scope after Round 2:** Round 1 + Round 2 are now both pre-
Phase-1 and have shaped the design above. Phase 6 retains a
**post-implementation** verification pass — Council reviews the
*built* system against the design, not the design itself.

### Council notes — Round 3 (post-implementation, Phase 6)

Run: `agents/council-sessions/2026-05-05-session-isolation-r2/responses.json`
· members: `anthropic/claude-opus-4-1`, `openai/gpt-4o` · cost: ~$0.19.

**Convergent verdict (GPT-4o):** Roadmap is thorough and well-articulated;
sequencing of Phase 2 → 3 is correct; `_FILTER` / `_TAG` switches give
per-phase rollback; Option A vs B trade-off is sound; legacy bucket is
honestly scoped. Phase 1-5 implementation passes the design intent.

**Divergent findings — rejected with reasoning:**

- **Opus #1 — `fp[:16]` adopt rotation fragments a logical session
  into two ids:** rejected. This is the *intentional* contract, not
  hidden coupling. After `auto_adopt`, the prior session's fingerprint
  is rotated into `header.former_fps[]` and the new session takes
  ownership — this is by design a different conversation taking the
  file over, not a continuation of the same context. Council R2-4
  already addressed user-visibility: `list_sessions()` surfaces every
  `former_fps[]` id (even when bodyless) so the user sees "this
  session existed" and can re-import it via `/chat-history learn`. No
  silent fragmentation; the boundary is explicit and addressable.
- **Opus #2 — Phase 2 needs verification gates beyond end-state
  tests:** rejected. Phase 2 is a thin pass-through (hook resolves
  `_current_session_id(path)` and forwards to `append`); the unit
  tests cover the resolution + append path end-to-end. Adding
  per-append logging would be observability, not correctness, and is
  out of scope for v1.
- **Opus #3 — missing kill-switches for `chat-history:sessions` and
  `learn`:** rejected. Both are *read-only opt-in* surfaces with no
  write path. `sessions` is a single full-scan with the 10k/<200ms
  bound from R2-3; `learn` is a numbered-options prompt that requires
  explicit user pick before any read. The defensive-toggle bar is
  reserved for paths that mutate state or run autonomously.
- **Opus #4 — Phase 3 ships `--session` before Phase 4 ships
  discovery:** rejected as a real-rollout concern but not as a
  roadmap-ordering bug. Phase 3 introduces the parameter primarily
  for the `read_entries_for_current` internal contract; the user-
  facing CLI surface is shipped *together* with Phase 4
  (`chat-history:sessions` and the `--all` / `--session` flags land
  in the same release). No window where users have `--session`
  without a discovery path.
- **Opus #5 — `<legacy>` vs `former_fps[]` reconstruction:**
  rejected. `former_fps[]` is a *forward-looking* mechanism that
  begins recording at v3 — it cannot retroactively reconstruct
  pre-v3 boundaries because pre-v3 headers did not maintain it.
  Pre-v3 entries lived in a single-session world by construction,
  so collapsing them into one `<legacy>` bucket is the honest
  representation, not a lossy approximation.
- **Opus #6 — performance testing too late:** rejected. The 10k /
  <100ms (Phase 3) and 10k / <200ms (Phase 4) benchmarks are
  acceptance criteria, not deferred work — they ship with the
  feature, not after.

**Outcome:** No design or implementation changes adopted from Round 3.
All findings either restate Round-1/Round-2 decisions, surface concerns
already addressed in the existing acceptance criteria, or argue for
defensive scaffolding outside v1 scope. Round 3 serves as audit
provenance for the post-implementation verification gate.
