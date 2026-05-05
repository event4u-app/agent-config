---
complexity: structural
---

# Roadmap: event-driven agent discipline

> Move agent-self-discipline rules onto the existing universal hook
> dispatcher so the contract is enforced by code, not memory — shrinking
> the always-rule budget and turning "agent forgot" failure modes into
> deterministic platform events.

## Prerequisites

- [ ] Read `docs/contracts/hook-architecture-v1.md` (dispatcher contract)
- [ ] Read `scripts/hook_manifest.yaml` (current concern wiring)
- [ ] Read `agents/contexts/chat-history-platform-hooks.md` (per-platform surface)
- [ ] Confirm `task hooks-status` runs cleanly on a clean working tree

## Context

The universal hook dispatcher (`scripts/hooks/dispatch_hook.py`) already
ships six concerns: `chat-history`, `roadmap-progress`, `onboarding-gate`,
`context-hygiene`, `verify-before-complete`, `minimal-safe-diff`. The
contract is stable (beta), per-platform trampolines exist for six host
agents, and the feedback surface in `agents/state/` is wired.

A second cohort of rules currently relies on agent discipline in the
inner loop — language mirroring, model recommendation, commit policy,
chat-history size, MD language scan, size enforcement, docs-sync.
Every such rule pays a context-window cost and fails open if the agent
forgets. Each one is a hook-shaped problem.

This roadmap selects, orders, and ships that second cohort, plus the
foundation work the dispatcher needs before fan-out doubles.

- **Feature:** none (infra)
- **Jira:** none

## Out of scope

- Brand-new platforms beyond the seven already wired (`augment`,
  `claude`, `cowork`, `cursor`, `cline`, `windsurf`, `gemini`).
- Replacing rule files with concerns one-for-one — most rules stay,
  the concern is the **enforcement** path; the rule body shrinks to
  the contract + a "Copilot fallback" section.
- MCP-server-side enforcement — separate roadmap.
- Cowork upstream resolution (tracked in `road-to-stable-chat-history.md`).

## Decision matrix — candidate concerns

ICE = Impact (loop minutes saved + failure-class eliminated) ·
Confidence (architecture readiness) · Effort (LOC + test surface).
Tier 1 ships first; Tier 3 is post-foundation. ICE is a planning aid,
not a number — re-scored against measured baseline at the end of
Phase 0.

| # | Concern | Event(s) | Decision | Depends on Phase -1 artefact | Rule(s) it carries | Tier | ICE |
|---|---|---|---|---|---|---|---|
| C1 | `git-ops-gate` | `pre_tool_use` | **block** | A1 permission-cache · A2 roadmap-state-API · A3 protected-ref-list | commit-policy · scope-control § git-ops · non-destructive-by-default | 1 | high |
| C2 | `chat-length-warner` | `stop`, `user_prompt_submit` | **warn** | — | context-hygiene § chat-length | 1 | high |
| C3 | `model-mismatch-warner` | `session_start`, `user_prompt_submit` | **warn** | A4 platform-capability-map (active-model field) | model-recommendation | 1 | high |
| C4 | `md-language-check` | `post_tool_use` | **warn** | A5 concern-composition rules | language-and-tone § `.md`-always-English | 2 | medium |
| C5 | `size-enforcement` | `post_tool_use` | **warn** | A6 skill-linter `--budget-only` mode · A5 | size-enforcement | 2 | medium |
| C6 | `markdown-safe-codeblocks` | `post_tool_use` | **warn** | A5 | markdown-safe-codeblocks | 2 | medium |
| C7 | `docs-sync-check` | `post_tool_use` | **warn** | A7 path-glob suppression · A5 | docs-sync | 2 | medium |
| C8 | `artifact-engagement-telemetry` | `stop` | **allow** (record-only) | — | artifact-engagement-recording | 3 | medium |
| C9 | `command-suggestion-surface` | `user_prompt_submit` | **warn** (advisory) | A4 (`additional_context`-honoured field) | command-suggestion-policy · slash-command-routing-policy | 3 | low |
| C10 | `learning-pattern-detector` | `stop` | **warn** (advisory) | — | capture-learnings · skill-improvement-trigger | 3 | low |

## Phase -1: Architectural prerequisites

Goal — close the eight undefined-interface gaps that block Phase 0/1
implementation. Nothing in this phase ships a concern; all of it is
contracts, schemas, and one linter mode that downstream phases will
import. Each artefact gets a unique ID (`A1`–`A8`) so the matrix
above and individual concern Steps can reference them.

- [ ] **A1: Permission-cache contract.** Spec at
      `docs/contracts/git-ops-permission-cache-v1.md`. Defines:
      storage path (`agents/state/git-ops-permissions.jsonl`,
      mode 0600), schema (one JSON line per grant: `granted_at`,
      `granted_for_tool`, `granted_for_args_glob`, `expires_at`,
      `revoked_at`), TTL semantics (default `per_turn` —
      cleared on next `user_prompt_submit`; optional
      `per_session` for standing instructions), revoke surface
      (UserPromptSubmit text containing `revoke permission` or
      `vergiss die freigabe` clears the JSONL). The `git-ops-gate`
      concern reads this file and writes a redacted audit line to
      `agents/state/git-ops-audit.jsonl` for every decision.
      **Compaction:** dispatcher rewrites the file atomically
      (`.tmp` + rename) on `session_start`, dropping entries with
      `revoked_at != null` or `expires_at < now`. **Corruption:**
      unparseable lines are skipped, the read returns the parseable
      subset, and one `severity=warn` feedback entry is written via
      A8. **Index:** when the post-compaction file has > 100 lines,
      the dispatcher caches an in-memory `tool_name → grants` index
      for the session — performance contract, not on-disk format.
- [ ] **A2: Roadmap-state API.** Spec at
      `docs/contracts/roadmap-state-api-v1.md` + helper module
      `scripts/roadmap_state.py` exposing
      `roadmap_authorises(operation: str, ref: str) -> tuple[bool, str]`.
      Returns `(authorized, source)` where `source` is
      `"roadmap-step-<n>"` on hit, `"none"` on miss, or
      `"roadmap-not-found"` when the active roadmap cannot be
      resolved. The API is **advisory** — C1 logs `source` into
      the audit trail and combines the result with explicit
      user-permission grants (A1); the API alone never produces a
      hard `block`. Reads the active roadmap (resolved by branch
      name or env) and only returns `True` when the current open
      step contains a parsable `Commit:` or `Push:` directive
      matching the operation. Out of scope: roadmap discovery
      heuristics (deferred to consumer use).
- [ ] **A3: Protected-ref list.** Settings key
      `git_ops.protected_refs: ["main", "master", "prod",
      "release/*", "production"]` plus per-project override.
      Default list ships in `config/agent-settings.template.yml`.
      `git-ops-gate` matches via fnmatch.
- [ ] **A4: Platform-capability map.** YAML at
      `docs/contracts/platform-capabilities.yaml` listing per
      platform the support flags concerns must check before
      attempting a behaviour: `pre_tool_use`, `post_tool_use`,
      `additional_context_surfaced`, `active_model_in_envelope`,
      `block_decision_honoured`. Loaded by `dispatch_hook.py` and
      injected into the concern envelope as `capabilities: {…}`.
      Concerns SHOULD branch on this; the dispatcher does NOT
      filter dispatch by capability — silent skipping is worse
      than an explicit warn entry.
      **Platform tiers.** Aggregates the per-flag matrix into
      one `tier: 1 | 2 | 3 | unsupported` per platform plus an
      optional `tier_reason` (free text — e.g.
      `"upstream-blocked: anthropics/claude-code#40495"`) and an
      optional `re_assess_after: <YYYY-MM-DD>` (soft monitor; on
      hit the dispatcher emits one `severity=warn` feedback
      entry per session pointing at the YAML line — no
      auto-action, no auto-downgrade).
      **Degradation rules** keyed off the tier:
      - Tier 1 — all concerns active as authored.
      - Tier 2 — `block` decisions degrade to `warn`, the
        concern's `additional_context` is prefixed
        `[tier-2: block→warn]`. User sees the degradation; the
        operation proceeds.
      - Tier 3 — only `allow` concerns run; `warn` and `block`
        concerns are no-op AND emit one `severity=warn`
        feedback entry per session naming concern + tier (so
        the gap is visible, never silent).
      - Unsupported — dispatcher refuses to initialise hooks on
        this platform. `task hooks-doctor` (Phase 0 Step 4)
        prints the reason and the migration target from the
        appendix below.
      Concerns MAY override the default by declaring
      `min_tier: 1 | 2 | 3` in their manifest entry;
      lower-tier registrations are rejected by
      `lint_hook_manifest.py`. The Council session that shaped
      this design is recorded at
      `agents/council-sessions/_inputs/deferred-hook-execution-iter1.json`
      (Opus + GPT-4o, iter1, 2026-05-05) — a Deferred-Execution
      alternative was evaluated and rejected on `block`-cannot-be-deferred grounds.
- [ ] **A5: Concern-composition rules.** Section in
      `docs/contracts/hook-architecture-v1.md` (extends the
      existing contract). Reduce semantics for multiple concerns
      on the same `(platform, event)`:
      - **Decision reduce:** `block` > `warn` > `allow`. First
        `block` short-circuits remaining concerns of the same
        event. `warn` and `allow` always run all concerns.
      - **`additional_context` merge:** concatenated as a list,
        each entry prefixed with concern name + severity, in
        manifest order. The agent sees one block, multi-line.
      - **`reason` merge:** only the first `block`'s reason is
        surfaced to the platform; warn-reasons go into the
        merged `additional_context`.
      - **State-write contract:** concerns declare
        `state_reads: [path, …]` and `state_writes: [path, …]` in
        `hook_manifest.yaml`. Each path under `agents/state/` has
        **exactly one writer** — `scripts/lint_hook_manifest.py`
        rejects manifests where two concerns declare overlapping
        `state_writes`. Readers may overlap freely. Writers MUST
        use atomic replace (`.tmp` + rename); appenders MUST use
        `O_APPEND` open-mode and write one line per `write()`
        syscall. Parallel-eligible concerns (`parallel: true`,
        see Phase 0 Step 3) MAY only read paths that no parallel
        sibling writes; the same lint rule enforces it.
- [ ] **A6: Skill-linter `--budget-only` mode.** Add to
      `scripts/skill_linter.py`. Skips structural checks; runs
      only the line-budget check from `size-enforcement` rule
      and emits one machine-readable line per breach
      (`{path}\t{actual}\t{ceiling}\t{tier}`). Used by C5
      directly without re-implementing the budget logic.
- [ ] **A7: Concern-suppression flag.** Settings key
      `hooks.<concern>.suppress_paths: [glob, …]` plus runtime
      env var `AGENT_HOOKS_SUPPRESS=<concern-list>`. Used by C7
      (`docs-sync-check`) to disable itself during deliberate
      sync sessions (`task sync`, `task generate-tools`,
      manual roadmap edits). Dispatcher honours both — env var
      wins on conflict.
- [ ] **A8: Hook-feedback contract.** Spec at
      `docs/contracts/hook-feedback-v1.md`. Defines the
      dispatcher-owned write path for every per-concern
      execution record: storage at
      `agents/state/hooks/feedback.jsonl` (mode 0600), one JSON
      line per concern invocation (`ts`, `platform`, `event`,
      `concern`, `decision`, `latency_ms`, `severity`,
      `reason_redacted`, `tool_args_glob`). **Writer:**
      `dispatch_hook.py` exclusively — concerns return a result
      envelope and the dispatcher serialises and writes;
      concerns MUST NOT touch this file. **Retention:**
      dispatcher truncates entries older than 7 days on
      `session_start`; window configurable via
      `hooks.feedback_retention_days`. **Reader:** `task
      hooks-doctor` (Phase 0 Step 4) consumes the file
      read-only. **Failure mode:** if the dispatcher cannot
      write feedback (disk full, permission denied), it
      degrades gracefully — the concern's decision still
      applies, one stderr warning per session, no hook is
      blocked by feedback-write failure.

### Phase -1 Validation Checkpoint

- [ ] All eight artefacts (A1–A8) merged. CI lint added to
      `scripts/lint_hook_manifest.py` blocks Phase 0+ work that
      references an unmerged artefact, and rejects manifests
      with overlapping `state_writes` per A5.

## Phase 0: Foundation hardening

Goal — keep dispatcher overhead bounded as fan-out doubles from 6 to 16.

- [ ] **Step 1:** Measure current per-concern p95 wall time on `augment`
      `post_tool_use` against two fixture sets:
      `tests/hooks/fixtures/synthetic/` (deterministic, in-tree) and
      `tests/hooks/fixtures/realistic/` (replayed redacted production
      payloads). Bench script lands at `scripts/bench_hooks.py`.
      Record baseline in `tests/hooks/benchmarks/baseline.json`
      (test infrastructure, not `agents/state/`).
- [ ] **Step 2:** Add a per-concern `timeout_ms` field to
      `hook_manifest.yaml` (default 5000); thread through
      `dispatch_hook._run_concern`. Concerns that breach are
      surfaced as `severity=warn` and recorded in feedback.
- [ ] **Step 3:** Introduce parallel concern execution behind a
      `parallel: true` flag in the manifest (per-event). Default off.
      Constraint: only concerns with `decision: warn|allow` may run
      in parallel; `block`-capable concerns stay sequential to keep
      reduce-semantics deterministic. **Smoke-test path:** ship two
      synthetic concerns under `tests/hooks/concerns/parallel_*` —
      one CPU-bound, one IO-bound — to exercise the parallel runner
      without putting production concerns on the hot path. Real
      concerns opt into `parallel: true` only after Phase 1 Step 4
      composition tests pass and the A5 state-write lint is green.
      Document resource-contention observations (CPU, FD count,
      `agents/state/` lock contention) in the bench README under
      `tests/hooks/benchmarks/`.
- [ ] **Step 4:** Ship `task hooks-doctor` — surfaces enabled
      concerns, last 50 invocations, p95 per concern, recent blocks.
      Adds a **Platform status** section: detected platform, its
      tier from A4, the active degradation rule, the list of
      concerns currently no-op'd or downgraded on this tier, and
      any `re_assess_after` date that has passed. Backed by
      `scripts/hooks_status.py`; reads A8 `feedback.jsonl`
      exclusively (no live re-execution).
- [ ] **Step 5:** Lock the concern-author template at
      `scripts/hooks/concerns/_template.py` and document the move
      from `scripts/<name>_hook.py` to
      `scripts/hooks/concerns/<name>.py`. No retro-migration of
      shipped concerns yet — that is Phase 4.

### Phase 0 Validation Checkpoint

- [ ] `task hooks-bench` green against both fixture sets; baseline
      committed under `tests/hooks/benchmarks/`.
- [ ] `task hooks-doctor` runs cleanly on a freshly cloned repo.
- [ ] **ICE re-score:** decision matrix above re-evaluated against
      measured Phase 0 baseline; tier reassignments (if any)
      recorded in this roadmap before Phase 1 begins.

#### Phase 0 Kill-switch

- Settings: `hooks.parallel_execution: false` reverts to sequential.
  No concern is shipped in Phase 0; rollback = revert the PRs.

## Phase 1: Tier-1 concerns (block-capable, highest impact)

- [ ] **Step 1:** `git-ops-gate` (C1). Concern reads `tool_name` +
      `tool_input` from envelope, intercepts `git commit`,
      `git push`, `git merge`, `git rebase`, `git tag`,
      `gh pr create`, `gh pr merge`. Decision matrix:
      - permission-cache hit (per A1) for the exact tool+args glob
        → allow + audit
      - roadmap-state API (per A2) returns `roadmap_authorises=true`
        → allow + audit
      - protected ref (per A3) → block (default) or follow Phase 5
        strict_mode
      - bulk-deletion diff (≥5 files removed or directory removed) → warn
        + emit `additional_context` requesting confirmation; explicit
        confirmation by the user is captured into the permission-cache
        for THIS tool invocation only
      Wired on `pre_tool_use` for `augment`, `claude`, `cowork`,
      `cursor`, `cline`, `gemini`. (Windsurf — no PreTool surface;
      see Platform Capabilities Appendix for the manual fallback.)
- [ ] **Step 2:** `chat-length-warner` (C2). Reads
      `agents/.agent-chat-history` size + estimated turn-token budget on
      `stop` and `user_prompt_submit`. Thresholds from
      `chat_history.warn_size_kb` / `warn_token_budget` (defaults
      256 KB / 80% of model context). Decision: `warn` with a
      one-line `additional_context` ("history at 240 KB / 80%
      context — consider /agent-handoff").
- [ ] **Step 3:** `model-mismatch-warner` (C3). On `session_start`,
      reads first `user_prompt_submit` text + the platform-reported
      active model when present (per A4 capability map; concern
      no-ops on platforms that do not surface `active_model`).
      Heuristic complexity score (existing in `model-recommendation`
      rule body, ported as a small Python module). If score >
      threshold and active model is below the recommended tier,
      surface `additional_context` ("complexity: high, active:
      Sonnet, recommended: Opus"). Never blocks.
- [ ] **Step 4:** Snapshot tests under `tests/hooks/concerns/`
      cover each Tier-1 concern × 7 platforms × 3 payload shapes
      (allow / warn / block). Reuse the `tests/hooks/fixtures/`
      pattern shipped with `verify-before-complete`. Composition
      tests (per A5): two concerns on the same event, verify the
      dispatcher's reduce semantics produce the contracted merge.
- [ ] **Step 5:** Source rules updated: `commit-policy`,
      `scope-control`, `non-destructive-by-default`,
      `model-recommendation` get a "Copilot fallback" section that
      points at the new concern and shrinks the inline-checklist
      body.

### Phase 1 Validation Checkpoint

- [ ] Live dogfooding for ≥5 sessions on this repo without a
      false-positive `block` on `git-ops-gate`. Audit log
      reviewed manually.
- [ ] Ten redacted production-trace samples replayed through the
      bench (Phase 0 Step 1 realistic set) → p95 stays ≤ 1.3× the
      synthetic baseline.

#### Phase 1 Kill-switch

- `hooks.git_ops_gate.disabled: true` removes C1 entirely.
- Auto-disable rule: 3 consecutive sessions with `git-ops-gate`
  p95 > 2× synthetic baseline → dispatcher writes a feedback
  entry + flips `disabled: true` for the local install only;
  CI never auto-flips.
- Source-rule rollback: every "Copilot fallback" section in the
  rule body keeps the original inline checklist as the
  un-removed baseline; if C1 is killed the rule still works.

## Phase 2: Tier-2 concerns (`post_tool_use` advisors)

- [ ] **Step 1:** `md-language-check` (C4). Concern reads written
      file path; if it ends in `.md` and is under `.augment/`,
      `.agent-src*/`, or `agents/`, runs the same scanner the
      `md-language-check` skill uses. Decision: `warn` with file +
      line list of hits.
- [ ] **Step 2:** `size-enforcement` (C5). On writes to
      `.agent-src.uncompressed/{rules,skills,commands}/`, runs the
      skill linter in `--budget-only` mode (per A6). Warns when the
      hard ceiling is breached.
- [ ] **Step 3:** `markdown-safe-codeblocks` (C6). On writes to any
      `.md`, runs the nesting check from the rule body. Warn-only.
- [ ] **Step 4:** `docs-sync-check` (C7). On create/rename/delete
      under `.agent-src.uncompressed/`, runs `check-refs` +
      counter-update preview. Warn when counts in `AGENTS.md` /
      `copilot-instructions.md` would drift. **Suppression (A7):**
      honours `hooks.docs-sync-check.suppress_paths` and
      `AGENT_HOOKS_SUPPRESS=docs-sync-check` so deliberate sync
      sessions (`task sync`, `task generate-tools`, batch roadmap
      edits) do not produce a warning storm.
- [ ] **Step 5:** Source rules updated: `language-and-tone`,
      `size-enforcement`, `markdown-safe-codeblocks`, `docs-sync`
      get the same "Copilot fallback" treatment.

### Phase 2 Validation Checkpoint

- [ ] All four concerns reviewed by a maintainer for false-positive
      rate on the last 50 PRs (replay against PR-touched files).
- [ ] Suppression mechanism (A7) verified on `task sync` — zero
      warnings emitted during deliberate sync.

#### Phase 2 Kill-switch

- Per-concern: `hooks.<concern>.disabled: true`.
- Auto-disable rule: ≥10 warnings per session for 3 consecutive
  sessions where the user dismissed every one (signalled by no
  follow-up edit) → flip `disabled: true` for local install.
- Source-rule rollback: same as Phase 1 — original rule bodies
  retain the inline checklist as fallback baseline.

## Phase 3: Tier-3 concerns (advisory)

- [ ] **Step 1:** `artifact-engagement-telemetry` (C8). Replaces
      the `./agent-config telemetry:record` manual call by emitting
      the same JSONL line on `stop`, gated by
      `telemetry.artifact_engagement.enabled`. Default-off, opt-in
      per maintainer. Redaction floor honoured.
- [ ] **Step 2:** `command-suggestion-surface` (C9). On
      `user_prompt_submit`, runs the `scripts/command_suggester/`
      engine; if matches found, returns `additional_context` with
      the numbered list. Concern reads
      `capabilities.additional_context_surfaced` from the envelope
      (per A4) and no-ops when the platform does not honour the
      field — emits a single feedback line ("suggestion surface
      unavailable on <platform>") rather than silent drop.
- [ ] **Step 3:** `learning-pattern-detector` (C10). On `stop`,
      reads the last N chat-history entries and applies the
      pattern detector from `learning-to-rule-or-skill`. Warn-only;
      proposes `/capture-learnings` invocation.

### Phase 3 Validation Checkpoint

- [ ] Telemetry JSONL on `stop` matches the schema produced by the
      manual `./agent-config telemetry:record` call (golden file
      under `tests/hooks/concerns/telemetry/`).
- [ ] Command-suggestion concern verified on Augment + Claude Code;
      no-op verified on Cursor / Cline / Windsurf / Gemini fixtures.

#### Phase 3 Kill-switch

- Per-concern: `hooks.<concern>.disabled: true`.
- Telemetry kill is also reachable via the existing
  `telemetry.artifact_engagement.enabled: false` toggle (no new
  surface needed).

## Phase 4: Concern migration

- [ ] **Step 1:** Move `scripts/<name>_hook.py` → `scripts/hooks/
      concerns/<name>.py` for the existing six concerns. Manifest
      `script:` paths flip in lockstep. CI gate
      (`lint_hook_manifest.py`) blocks legacy paths.
- [ ] **Step 2:** Drop the per-concern `--platform` argv hack in
      favour of reading `envelope.platform` from stdin only.
- [ ] **Step 3:** Update `docs/contracts/hook-architecture-v1.md`
      to b1 (drop `beta` marker), reflecting the foundation
      hardening from Phase 0 and the migration in this phase.

### Phase 4 Validation Checkpoint

- [ ] All concerns under `scripts/hooks/concerns/`; legacy
      `scripts/<name>_hook.py` paths absent. CI lint enforces it.
- [ ] No concern script reads `sys.argv` for platform — fixture
      replay covers the stdin-only path for all seven platforms.

#### Phase 4 Kill-switch

- Migration is an in-tree refactor; rollback = revert the PR.
  The previous concern files are kept in git history; no
  on-disk fallback shim is shipped.

## Phase 5: Graduated strict mode (opt-in)

- [ ] **Step 1:** Add `hooks.strict_floor: log | confirm | block`
      to `.agent-settings.yml` (default `confirm` — current
      behaviour). Semantics:
      - `log`: every protected-ref / bulk-deletion event is
        recorded to `agents/state/git-ops-audit.jsonl`; concern
        returns `allow`. Used to measure false-positive rate
        before rolling out `confirm` or `block`.
      - `confirm`: protected-ref / bulk-deletion events return
        `warn` + `additional_context` requesting explicit
        permission; user grant goes through A1 permission-cache.
      - `block`: protected-ref / bulk-deletion events return
        `block` outright; user must lift `strict_floor` for the
        operation. `fail_closed: true` semantics.
- [ ] **Step 2:** Document the three levels in
      `non-destructive-by-default` rule body. Migration note:
      a project moving from `confirm` to `block` loses the
      per-turn permission surface — the dispatcher refuses.
- [ ] **Step 3:** Strict-mode integration tests, one per level:
      `log` → exit-code 0 + audit line; `confirm` → exit-code 0
      + warn surface; `block` → exit-code 1 + block surface.

### Phase 5 Validation Checkpoint

- [ ] Switching levels via `.agent-settings.yml` produces the
      expected behaviour change in the integration tests above.
- [ ] Audit log under `log` mode populated with realistic
      payloads after a 5-session dogfood window.

#### Phase 5 Kill-switch

- `hooks.strict_floor: log` reduces the strict mode to
  recording-only without touching concern wiring.
- `hooks.git_ops_gate.disabled: true` removes C1 entirely —
  Phase 5 is a no-op when C1 is killed.

## Acceptance Criteria

- [ ] Always-rule budget reduced — at minimum, the 4 rules with
      the largest line counts that ship a Tier-1/Tier-2 concern
      drop ≥30% of their always-active body to the concern.
- [ ] Dispatcher p95 stays ≤ 1.5× the **synthetic** Phase 0
      baseline AND ≤ 1.3× the **realistic** Phase 0 baseline
      despite adding 10 concerns. Verified by
      `task hooks-bench` against both fixture sets.
- [ ] All ten concerns have snapshot tests across seven
      platforms PLUS at least one composition test per event
      with multiple concerns wired (per A5). CI gate blocks
      merging a concern without them.
- [ ] `task hooks-doctor` shows enabled concerns + last 50
      invocations on a freshly cloned project after `task ci`.
- [ ] All quality gates pass (PyTest, skill linter, marketplace
      lint, hook-manifest lint).

## Platform Capabilities Appendix

Source of truth: `docs/contracts/platform-capabilities.yaml`
(lands in Phase -1 / A4). Snapshot at roadmap-write time:

| platform | tier | pre_tool_use | post_tool_use | user_prompt_submit | session_start | stop | additional_context_surfaced | active_model_in_envelope | block_decision_honoured |
|---|---|---|---|---|---|---|---|---|---|
| augment | 1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | partial | ✅ |
| claude | 1 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| cowork | 3 | ✅ | ✅ | ✅ | partial | ✅ | partial | ❌ | ✅ |
| cursor (IDE) | 2 | ✅ | ✅ | ✅ | ❌ | ✅ | partial | ❌ | partial |
| cursor (CLI) | 3 | partial | partial | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| cline (non-Windows) | 2 | partial | partial | ✅ | ❌ | ✅ | ❌ | ❌ | partial |
| cline (Windows) | unsupported | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| gemini | 2 | ✅ | ✅ | ✅ | ❌ | partial | partial | ❌ | partial |
| windsurf | 2 | ❌ | ❌ | ✅ | ❌ | partial | ❌ | ❌ | ❌ |

Tier reasons (snapshot — authoritative source is the YAML):

- **cowork — tier 3:** upstream-blocked by
  `anthropics/claude-code#40495` and `#27398`; hooks do not
  fire at all until the fix lands. `re_assess_after`
  recommended ≈ one upstream cycle from roadmap-write date.
- **cursor (CLI) — tier 3:** only `before/afterShellExecution`
  fire; the IDE surface (full hooks) is the migration target.
- **cline (Windows) — unsupported:** `cline/cline#8073`;
  fix-in-flight `cline/cline#8201`. Migration target =
  WSL2 + cline (non-Windows).

Concerns C1, C4, C5, C6, C7 require `pre_tool_use` or
`post_tool_use` and therefore do not run on Windsurf. Concern C3
requires `active_model_in_envelope` and runs only on Claude Code
(and partially on Augment) at roadmap-write time. Tier-driven
degradation (per A4) applies on top of these per-flag gaps:
e.g. `git-ops-gate` (C1, `block`) downgrades to `warn` on Tier 2
and is no-op on Tier 3 / unsupported, with one feedback entry per
session naming the concern + tier.

**Manual fallback for low-capability platforms.** A concern that
cannot run as a hook on a given platform is reachable via slash
command (`/hooks-run <concern>`) — out of scope for this roadmap,
tracked in a follow-up. The Notes below list the gap explicitly so
no concern silently disappears.

## Notes

- **Concern decision semantics.** `block` is reserved for cases
  where allowing the operation would be unrecoverable (commit to
  protected ref, bulk deletion). `warn` covers reversible drift
  (history too long, model mismatch, MD language slip). `allow`
  + `additional_context` is the soft surface the agent reads
  without the user seeing it (telemetry, suggestion).
- **Per-platform parity.** Windsurf has no `pre_tool_use` /
  `post_tool_use` surface — documented gap, manual fallback
  follow-up tracked separately. Cline on Windows lacks hook
  support upstream — same.
- **Settings shape.** Every new concern lands with an
  `.agent-settings.yml` block under `hooks.<concern_name>` so
  consumer projects can disable it without manifest edits.
  Every concern also honours `hooks.<concern>.disabled: true`
  as a kill-switch (per the per-phase Kill-switch sections).
- **Phase -1 artefact references.** Phases 0–5 reference
  artefacts as `A1`–`A8`. Adding a Phase that depends on a new
  artefact requires extending Phase -1 with `A9+`, NOT
  inlining the design.
- **No release pinning.** Per `scope-control`, no version numbers
  or release dates in this roadmap. Phase ordering is the
  authoritative sequence; ship-when-ready.
