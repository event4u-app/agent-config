---
decision: mcp-write-exec-cut-2026-07-07
status: accepted
date: 2026-07-07
phase: road-to-mcp-full-power
---

# MCP write/exec tool cut — Phase 3 council verdict

AI council (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2-round debate,
`agents/runtime/council/responses/mcp-full-power-write-exec-cut.json`, actual
cost $0.1202) on `agents/runtime/council/questions/mcp-full-power-write-exec-cut.md`.
Telemetry window: ~24h (71 calls), explicitly waived by the operator per the
2026-05-12 coverage-cut precedent — see `Blockers` resolution in
`road-to-mcp-full-power.md`.

## Correction to the debate's own premise

The debate's tables classified `doctor_report`, `conformance_check`,
`telemetry_report`, and `council_estimate` as `fs-write-in-tree` /
"billable". Per the actual shipped catalog entries
(`src/scripts/mcp_server/consumer_tool_catalog.json`, added in Phase 1 of
this roadmap) and `agents/settings/contexts/mcp-tool-tier-map.md`, all four
are **read-only** (`side_effect: "ro"`, no network call). Read-only tools
do not require this write/exec unlock gate at all — they are addressed
here for completeness but their implementation authorization does not
depend on this verdict.

## Decision 1 — cut list

| Tool | Tier | Verdict | Basis |
|---|---|---|---|
| `memory_signal` | fs-write-in-tree | **Ship — Phase 4** | Unanimous across all 3 positions (both round-1 answers + round-2 anthropic). 281-call demand signal, append-only, bounded blast radius (single JSONL file). |
| `roadmap_progress` | fs-write-in-tree | **Ship — Phase 4** | Unanimous. Structured write to a known file, deterministic. |
| `capabilities_index` | fs-write-in-tree | **Ship — Phase 4** | Unanimous. Regenerates a deterministic artifact; failure mode is a stale index, non-destructive. |
| `roadmap_archive` | fs-write-in-tree | **Ship — Phase 4** | Majority (round-1 openai + round-2 anthropic; round-1 anthropic deferred, no dissent in round 2). `git mv` only, no push. |
| `doctor_report` | read-only | **Ship — Phase 4** (read-only path, not gated by this verdict) | Council's `fs-write` framing was incorrect per the shipped catalog entry — reclassified here. |
| `conformance_check` | read-only | **Ship — Phase 4** (read-only path) | Same correction. |
| `telemetry_report` | read-only | **Ship — Phase 4** (read-only path) | Same correction. |
| `council_estimate` | read-only | **Ship — Phase 4** (read-only path) | Same correction — it computes a cost estimate without calling the network or billing; distinct from `council:run`. |
| `chat_export` (maps to `chat-history:checkpoint` in the tier map) | fs-write-in-tree | **Defer to Phase 4 catalog addition** | Surfaced independently by both round-1 positions citing the 25 `chat_history_append` calls as demand evidence, but no catalog stub exists yet — add the stub first, then it follows the same ship path as the items above. |
| `dispatch:hook` | shell-exec | **Reject** | Unanimous. Generic hook dispatcher can trigger arbitrary registered hook scripts — open-ended arbitrary execution. |
| `hooks:replay` | shell-exec | **Reject** | Unanimous, same reasoning as `dispatch:hook`. |
| `council:run` | network | **Defer** | Billable, real network spend. Ships only once the A0 amendment's per-call confirmation envelope (explicit confirmation flag echoed in the tool result) is implemented — never silent-default. |
| `lint:fix`, `skills:generate`, `pack:create`, `memory:expire`, `prompts:test` | fs-write-in-tree / shell-exec | **Defer** | Raised only by round-1 anthropic; no demand signal in telemetry, unclear autonomous use case, or destructive without a retention/rollback story (`memory:expire`). Re-evaluate on named demand. |
| `skills:test` (first shell-exec pilot) | shell-exec | **Ship — Phase 5, ONE tool only** | Both round-1 positions independently proposed this as the first shell-exec candidate. Concrete implementation maps to a scoped subset of the already-catalogued `run_tests` stub — Phase 5 execution picks the exact scope. |
| `workspace:init`/`clone`, `install:*` family | — | **No new decision — already `hard-floor-never`** | Independently re-flagged by round-1 anthropic; consistent with the existing tier-map classification (global/outside-repo operations). |

## Decision 2 — bridge shape

**Verdict: pure build-time codegen (model b) for every approved tier,
including shell-exec.** This overturns the generic-bridge-for-shell-exec
half of the A0 draft amendment's "hybrid (a+b)" framing written in Phase 3
Step 1.

Rationale (round-2 anthropic's argument, unrebutted on its core security
claim): the package's own existing pattern for `chat_history_append` is
already a **compiled tool with a hardcoded path guard**, not a
generic write-to-arbitrary-target bridge gated by a runtime-editable
setting. A `mcp.tools.allow` YAML allowlist is editable by the same agent
session it is meant to constrain — the security property "this deployment
cannot run `dispatch:hook`" must be true because the tool does not exist in
the build, not because a config file says so. Full codegen also makes the
`hard-floor-never` exclusion structural (the tool literally isn't in
`tools/list`) rather than a load-time rejection check.

**Safety envelope for the one Phase 5 shell-exec tool** — compiled, not
configured: fixed argv (no shell interpolation of caller-supplied strings),
a compile-time timeout constant, output truncation to a fixed byte cap, and
no network access from the spawned subprocess. Implemented via a
`wrapWithSafetyEnvelope`-style decorator that makes an un-timeboxed or
network-capable shell-exec tool a type error at build time, not a runtime
possibility.

## What changes as a result

- `docs/contracts/mcp-phase-1-scope.md` draft amendment — the "Bridge
  shape (Phase 5)" paragraph is revised to name codegen as the decided
  shape, not an open Phase-3 question.
- `agents/settings/contexts/mcp-tool-tier-map.md` — Phase 5 bridge note
  updated to reflect codegen-only, no generic subcommand tool.
- No `mcp.tools.allow` setting ships — superseded by the codegen decision;
  enabling a new tool is a code change (tier-map entry + rebuild), not a
  settings edit.

## Confidence

- **High** on the cut list — near-unanimous across all three positions,
  and the "read-only, not fs-write" correction is verified directly
  against the shipped catalog file, not asserted.
- **High** on rejecting the generic bridge for shell-exec — the security
  argument was not rebutted, and it matches an existing, working pattern
  in this codebase (compiled + hardcoded guard).
- **Medium** on the exact first shell-exec pilot tool (`skills:test`) — the
  precise scope is a Phase 5 implementation decision, not fully specified
  by this debate.
