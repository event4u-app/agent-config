---
complexity: structural
---

# Road to Feedback Consolidation

**Status:** READY FOR EXECUTION (Phase 1 first; later phases parallelisable
on green Phase 1).
**Started:** 2026-05-04
**Trigger:** Eight consecutive external feedback slots (1.17.0 verdict, PR #29
deep dive, hardening-tier review, autonomy/commit rule changes, PR #36 update,
Senior-Staff PR #29 review, 1.18.0 release evaluation, next-release
recommendations) all converged on the same conclusion: the **rule and
governance fundament is now strong, but the package has not yet proven
outcome, decision-engine surfacing, or memory visibility**, and the
58-rule tier system + the always-rule budget are operationally unfinished.
The user requested *"DAS ULTIMATIVE package"* — a roadmap whose completion
makes none of the eight slot critiques re-issuable on the next review.
**Mode:** Structural roadmap. Seven new phases plus two cross-roadmap
delegations. One council pass already folded in (Round 1 — Verdict
block below).
**Source:** consolidated synthesis at `tmp/feedback-synthesis-2026-05-04.md`
(temporary working note, will be deleted on this roadmap's first archival).
**Branch discipline:** every step ships into `feat/better-skills-and-profiles`.
No spillover branches, no PRs to other branches without explicit user permission.

## Purpose

Close the eight-slot critique surface against the package — turn each
recurring complaint into measurable, shipped, mockability-resistant
behaviour. After this roadmap finishes, an external reviewer running
the same critique pass should not be able to legitimately repeat any
of: *"outcome unproven"*, *"memory invisible"*, *"decision engine
implicit"*, *"tiers unenforced"*, *"always-rule budget unsolved"*,
*"hooks missing for verify/minimal-diff"*, *"taskfile sprawls"*,
*"showcase has no recorded sessions"*, or *"hook layer is
Augment+Claude-only — Cursor/Cline/Windsurf/Gemini/Copilot users get
no parity"*.

## Acceptance — the "no longer mockable" criterion

Every phase declares an acceptance line of the form:

> **Mockable until:** *<critique that can still legitimately fire today>*
> **Resolved when:** *<observable artefact + CI gate + test that
> would catch a regression>*

A phase is not "done" purely on diff merge — it is done when the named
critique can no longer be raised in good faith on the next review.

## Horizon (8-week visible plate)

**Inside the plate (this 8-week window):**

- Phase 1 — Outcome System & 3 Holy-Shit Demos (W1).
- Phase 2 — Tier-Bulk-Retrofit + linter (W2).
- Phase 3 — Decision-Engine Surfacing + rule-interaction tests (W4).
- Phase 4 — Memory Visibility (W5).
- Phase 5 — Tier-1 Hooks for `verify-before-complete` + `minimal-safe-diff` (W7),
  riding Phase 7's dispatcher.
- Phase 6 — Hygiene sweep: Taskfile modularization, one-off purge policy,
  README 3-path entry, commands count, untracked-files report (W8).
- Phase 7 — Cross-Agent Hook Coverage: dispatcher refactor, manifest,
  Cursor + Cline + Windsurf + Gemini support, Copilot fallback,
  concurrency-safe state writes, post-install verification (W6 → W9,
  partly parallel to Phase 4–6, gates Phase 5).

**Out-of-horizon (deferred to siblings):**

- W3 (Always-rule budget strategy) — delegated to
  `road-to-always-budget-relief.md`. **This roadmap activates it**
  (status `draft → ready`) the moment Phase 2 lands, because demote/
  collapse decisions interact with tier metadata.
- W6 (Architect + Risk-Officer personas) — already covered by
  `road-to-better-skills-and-profiles.md` Block A. Cross-referenced,
  not duplicated.
- W9 (MCP Server Phase 1) — already covered by `road-to-mcp-server.md`.
  Cross-referenced, not duplicated.

## Cross-roadmap delegation matrix

| Stream | Delegated to | Action this roadmap takes |
|---|---|---|
| W3 — Always-rule budget | `road-to-always-budget-relief.md` (DRAFT → READY) | Phase 2 step 2.6 flips status, regenerates dashboard |
| W6 — Architect + Risk-Officer | `road-to-better-skills-and-profiles.md` Block A | Phase 3 step 3.5 cites the Block-A acceptance as the only place these personas are scored |
| W9 — MCP Server Phase 1 | `road-to-mcp-server.md` Phase 1 | None. Independent track. |
| Block Q — Audit-as-Memory | `road-to-distribution-and-adoption.md` Phase 4 | Phase 4 step 4.5 wires the visibility output to feed Block Q's audit pipeline |

## Risk register (delta from sibling roadmaps)

| Risk | Owner phase | Mitigation |
|---|---|---|
| Decision-engine surfacing becomes performative theatre (scores printed but not honoured) | Phase 3 | Each scored decision must cite the rule-id it followed, and a regression test asserts that scoring output and rule path agree |
| Tier retrofit triggers cascading rule rewrites (scope creep) | Phase 2 | Retrofit is **frontmatter-only**; Iron-Law rewrites are out of scope and explicitly forbidden in the phase exit criteria |
| Memory visibility leaks privacy (e.g., showing redacted memory content) | Phase 4 | Visibility output is **counts + ids**, not bodies; existing redaction floor in `agent-memory-contract.md` stays intact |
| Holy-shit demos drift to staged transcripts (not real sessions) | Phase 1 | Each transcript carries a SHA of the host-agent log + commit hash + before/after metric; CI verifies SHA presence |
| Hygiene sweep balloons (W8) into general refactor | Phase 6 | Hard scope: only the 6 enumerated items (taskfile, one-off purge, README, counts, untracked, council CLI), no opportunistic edits |
| Council disabled → blind-spot feedback | All phases | Each phase exit criterion includes "council pass deferred until `ai_council.enabled: true`; reopen if council finds gap" |
| Per-(concern × platform) trampoline sprawl — O(N×M) shell files diverge over time (Council Round 1, anthropic) | Phase 7 | One universal dispatcher per platform + manifest-driven wiring; trampolines static, install reads `hook_manifest.yaml` |
| Concurrent agents (Cursor + Windsurf same workspace) race on `agents/state/*.json` (Council Round 1, anthropic) | Phase 7 | Atomic writes via `os.rename` + per-file `flock`; concurrency regression test |
| Install ships hook configs but the hook never actually fires on the platform (test-strategy gap, Council Round 1) | Phase 7 | Three-layer test stack: parser unit, install snapshot, event-shape contract; post-install smoke step in `install.py` |
| Copilot users assume hooks fire silently when they don't | Phase 7 | `task hooks-status` runtime command + Copilot rule-only fallback path documented per concern |

## Phase 1 — Outcome System & 3 Holy-Shit Demos

**Mockable until:** *"Outcome unproven, no holy-shit moment, showcase
has no recorded sessions"* (Slots 1, 3, 4, 6, 8).
**Resolved when:** `docs/showcase.md` carries 3 recorded sessions
backed by SHA-pinned transcripts under `docs/showcase/sessions/` plus
a metrics table; `agents/contexts/outcome-baseline.md` defines the
metrics + baselines; CI gate `lint_showcase_sessions.py` fails if a
session loses its transcript or metric.

- [x] **1.1 Define outcome metrics.** Author
      `agents/contexts/outcome-baseline.md` with the 4 metrics the
      package commits to: (a) average tool-call count per
      `/implement-ticket` run, (b) average chars in agent reply per
      task class, (c) hit/miss ratio of memory in `/work` runs,
      (d) verify-gate pass rate before first user re-prompt. Each
      metric carries a definition, a measurement command, and a
      baseline number captured this week.
- [x] **1.2 Author session capture script.**
      `scripts/capture_showcase_session.py` — wraps a
      `/implement-ticket` or `/work` run, snapshots the chat log
      under `docs/showcase/sessions/<slug>.log`, computes the four
      metrics from 1.1, writes a frontmatter block (commit SHA,
      host agent, model, started, ended, metrics).
- [ ] **1.3 Record session A — `/implement-ticket` end-to-end.**
      Pick a real ticket from `agents/roadmaps/`, drive
      `/implement-ticket` to PR-ready state, capture under
      `docs/showcase/sessions/implement-ticket.log` + reflection
      block in `docs/showcase.md`.
- [ ] **1.4 Record session B — `/work` free-form prompt.** Drive
      `/work "<medium-complexity prompt>"` end-to-end, capture log
      and metrics. Acceptance: confidence-band gating + memory hit
      visible in transcript.
- [ ] **1.5 Record session C — `/review-changes` solo audit.**
      Run `/review-changes` against a real diff on this branch,
      capture the four-judge verdict, and document the dispatch
      table (which judge fired, why).
- [ ] **1.6 CI gate `lint_showcase_sessions.py`.** Fails if any
      session referenced from `docs/showcase.md` loses its log SHA
      or metric block. Hooked into `task ci`.
- [ ] **1.7 README counter update.** Update `README.md` headline
      stats (commands count = 47, recorded sessions = 3, rules =
      58, tier coverage % once Phase 2 lands).

**Phase exit:** `docs/showcase.md` ≥ 3 sessions; baseline file
present; CI gate green; README headline numbers reflect reality.

## Phase 2 — Tier-Bulk-Retrofit + Linter

**Mockable until:** *"58 rules, 0 tier frontmatter; tier system
unenforced"* (Slots 2, 3).
**Resolved when:** every rule under `.agent-src.uncompressed/rules/`
declares `tier:` frontmatter (1, 2a, 2b, 3); `lint_rule_tiers.py`
fails if a new rule lands without one; `road-to-always-budget-relief`
status flips `draft → ready`.

- [x] **2.1 Tier-classification spreadsheet.** Generated
      `tmp/tier-classification.md` (58 rules) from the matrix in
      `agents/contexts/rule-trigger-matrix.md` via
      `scripts/_one_off/2026-05/_one_off_tier-retrofit.py`.
- [x] **2.2 Apply frontmatter (mechanical).** All 58 rule files
      under `.agent-src.uncompressed/rules/` carry `tier: "<value>"`
      (quoted-string per the schema enum at
      `scripts/schemas/rule.schema.json`). Diff is frontmatter-only.
- [x] **2.3 Compress + sync.** `task sync` regenerated
      `.agent-src/`, `.augment/`, and tool projections; the retrofit
      mirrored the tier line into `.agent-src/rules/` so the body
      compression remains untouched.
- [x] **2.4 Linter `lint_rule_tiers.py`.** Hard-fails CI if any
      rule lacks a valid `tier:` value. Wired into `task ci` after
      `task lint-skills` via `task lint-rule-tiers`.
- [-] **2.5 Tier-3 first-audit run.** Deferred — `tier-disposition-
      audit` skill is out-of-horizon for this package slot; the
      tier classifications stay locked at the values written by
      `_one_off_tier-retrofit.py` until a future slot picks it up.
- [x] **2.6 Activate `road-to-always-budget-relief`.** Status
      flipped `draft → ready`; dashboard regenerated.

**Phase exit:** `lint_rule_tiers.py` green; tier coverage = 58 / 58;
sibling roadmap activated; dashboard regenerated.

## Phase 3 — Decision-Engine Surfacing + Rule-Interaction Tests

**Mockable until:** *"Decision engine implicit; rule interactions
(autonomy × scope × memory × verify) not formalised"* (Slots 4, 6).
**Resolved when:** every `/implement-ticket` and `/work` run prints a
**decision-trace block** with rule-ids consulted, confidence band,
and risk classification; the rule-interaction matrix is encoded as
test fixtures; CI gate fails on regression.

- [x] **3.1 Decision-trace contract.** Author
      `docs/contracts/decision-trace-v1.md` — fields: `rule_id`,
      `applied / skipped / conflicted-with`, `confidence_band`,
      `risk_class`. Stable artefact, no roadmap refs (per
      `no-roadmap-references` rule).
- [x] **3.2 Surface in `work_engine` template.** Decision-trace
      hook implemented at
      `.agent-src.uncompressed/templates/scripts/work_engine/hooks/builtin/decision_trace.py`;
      opt-in via `.agent-settings.yml` `decision_engine.surface_traces: true`
      mirrored into `hooks.decision_trace.enabled` by the settings
      loader. JSON envelope written next to the WorkState file
      (`agents/state/work/<id>/decision-trace-<phase>.json`). Tests
      under `tests/work_engine/hooks/test_decision_trace_hook.py`
      and `tests/work_engine/hooks/test_settings.py`.
- [x] **3.3 Rule-interaction matrix.** Pytest fixtures at
      `tests/contracts/test_rule_interactions.py` exercise the four
      2-axis cases (autonomy×scope → `scope-control` senior;
      autonomy×commit → `commit-policy` senior;
      scope×verify → `verify-before-complete` senior;
      memory×commit aliased onto `autonomy-x-commit-policy` since
      standing instructions surface as the autonomy rule on disk).
      Structural layer validates every pair in
      `docs/contracts/rule-interactions.yml` against the on-disk
      rules and evidence anchors. New pair
      `scope-x-verify-before-complete` added to the matrix.
- [x] **3.4 Confidence-band heuristic.** Implemented in
      `.agent-src.uncompressed/templates/scripts/work_engine/scoring/decision_trace.py`
      (`derive_confidence_band`). Inputs: (a) `memory.hits` from
      `state.memory`, (b) ambiguity flag from `state.questions`
      populated by `refine-prompt` and the directive layers,
      (c) `verify.first_try_passes` / `verify.claims` from
      `state.verify`. Heuristic + edge cases covered by
      `tests/work_engine/scoring/test_decision_trace_scoring.py`.
- [x] **3.5 Cross-link Block A.** `docs/contracts/decision-trace-v1.md`
      § Cross-references points to the durable persona library
      (`.agent-src.uncompressed/personas/`) as the home of
      Architect + Risk-Officer personas. Direct link to the
      Block-A roadmap file is intentionally avoided per
      `no-roadmap-references` — the contract names the durable
      destination instead.

**Phase exit:** decision-trace contract published; opt-in trace
output on a real `/work` run; rule-interaction matrix green; no
trace-related claim in subsequent reviews can fire without the
trace JSON to back it up.

## Phase 4 — Memory Visibility

**Mockable until:** *"Memory invisible in output; user can't tell
what the agent retrieved or what it ignored"* (Slots 4, 6, 8).
**Resolved when:** every memory-using run prints a
`Memory: <hits>/<asks> · ids=[…]` line; redaction floor preserved;
output feeds the audit-as-memory pipeline (Block Q in
`road-to-distribution-and-adoption.md`).

- [x] **4.1 Visibility contract.** Author
      `docs/contracts/memory-visibility-v1.md` — line shape,
      privacy floor (counts + ids only, no bodies), opt-out, and
      interaction with `agent-memory-contract.md`.
- [x] **4.2 Hook surface in `work_engine` template.** When the
      engine calls `memory_retrieve`, capture (asked-types,
      hit-ids, miss-reason) into WorkState; emit a one-line summary
      at end-of-run.
- [x] **4.3 Stop-hook integration.** Wire the visibility line to
      the `chat-history` heartbeat so the user sees it on every
      memory-using turn (gated on `cost_profile` heartbeat cadence).
- [x] **4.4 Privacy regression test.**
      `tests/contracts/test_memory_visibility_redaction.py` asserts
      the line never contains an entry body, secret, or path
      outside the allowlist.
- [x] **4.5 Block-Q wire-up note.** Append a short pointer in
      `road-to-distribution-and-adoption.md` Phase 4 explaining
      that the audit-as-memory feed will consume the visibility
      output produced here. **Edit-in-place; no new roadmap.**

**Phase exit:** visibility line on every memory-using run; privacy
test green; sibling roadmap pointer added.

## Phase 5 — Tier-1 Hooks for `verify-before-complete` + `minimal-safe-diff`

**Mockable until:** *"Verification + minimal-diff are still
text-only — no mechanical enforcement"* (Slot 3).
**Resolved when:** two new hook concerns exist, registered in the
Phase 7 manifest, fire on every supported platform that has the
matching event slot, with parity tests; pre-existing tier-3 audit
can no longer flag these two rules as "soft, audit-bound only".

**Depends on:** Phase 7.1–7.3 (manifest contract + universal
dispatcher + Augment/Claude refactored to dispatcher pattern).
Phase 5 does not author per-platform trampolines — it adds two
**concerns** to the manifest and lets the dispatcher route them.

- [x] **5.1 `verify_before_complete_hook.py`.** Concern script (no
      platform code). Pre-completion gate: blocks the assistant from
      claiming "done" if no fresh verification command was logged
      this turn (per the rule's Iron Law). Reads platform name +
      event payload from the dispatcher's stdin contract.
- [x] **5.2 `minimal_safe_diff_hook.py`.** Concern script. Pre-edit
      gate: warns (not blocks) when a planned edit touches > N
      unrelated files or reformats untouched code. Threshold
      tunable in `.agent-settings.yml`
      `hooks.minimal_safe_diff.threshold`.
- [x] **5.3 Manifest registration.** Add both concerns to
      `scripts/hook_manifest.yaml` against every platform whose
      event surface supports the matching slot (per
      `agents/contexts/chat-history-platform-hooks.md`). Copilot
      gets the rule-only fallback path.
- [x] **5.4 Parity tests under `tests/hooks/`.** Run both concerns
      against fixture transcripts for every platform listed in the
      manifest; assert identical fire/skip decisions across
      harnesses.
- [x] **5.5 Tier promotion.** Update tier frontmatter on
      `verify-before-complete` and `minimal-safe-diff` from 3 →
      2a (now hook-backed). Run `lint_rule_tiers.py` to confirm.

**Phase exit:** both concerns shipped + manifest-registered +
parity-tested across all supported platforms; the two rules move
from tier-3 to tier-2a in frontmatter; tier-disposition-audit no
longer reports them as soft.

## Phase 6 — Hygiene Sweep (Taskfile, One-Off Purge, README, Counts, Untracked Report, Council CLI)

**Mockable until:** *"Taskfile sprawls (40+ tasks); one-off scripts
becoming a graveyard; README has no 3-path entry; commands count
outdated; untracked files in completion reports are silent; council
passes need ad-hoc Python orchestrators every time"* (Slots 1, 5, 7
+ surfaced live during Council Round 1, 2026-05-04).
**Resolved when:** Taskfile is split into named groups; one-off
purge policy lives in a contract; README has 3 documented entry
paths; counts auto-checked; completion reports always list
untracked files explicitly; council passes run via a stable
`./agent-config council:*` CLI that respects the `ai_council.enabled`
gate and the cost-confirmation contract.

- [ ] **6.1 Taskfile modularization.** Split top-level `Taskfile.yml`
      into `taskfiles/ci-fast.yml`, `taskfiles/content.yml`,
      `taskfiles/engine.yml`, `taskfiles/release.yml`; root file
      includes them. Tasks unchanged; namespace prefixes only where
      ambiguous.
- [x] **6.2 One-off purge policy contract.**
      `docs/contracts/one-off-script-lifecycle.md` — naming
      (`_one_off_*.py`), location (`scripts/_one_off/<YYYY-MM>/`),
      max age (60 days from move date), purge action (delete on
      `task ci`'s `lint-one-off-age` step).
- [x] **6.3 `lint_one_off_age.py`.** Fails CI for any
      `scripts/_one_off/` script older than the contract age and
      not explicitly extended via a TTL frontmatter line.
- [ ] **6.4 README 3-path entry.** Add a "3 ways to start" block
      near the top of `README.md`: (a) `/onboard` for new users,
      (b) `task ci` for contributors, (c) `task generate-tools` for
      multi-agent users. Link each into the relevant file.
- [ ] **6.5 Counts drift sentinel.** Extend the existing README
      drift test to cover `commands count = 47`, `rules count =
      58`, and `tier coverage` (after Phase 2). Test fails if
      headline numbers diverge from the actual filesystem state.
- [x] **6.6 Untracked-files report contract.** Soft-rule patch in
      `commit-policy` notes is **out of scope here** (rule-prose
      change). Instead, update the
      `verify-completion-evidence` skill to require a
      `git status --short` line in the report whenever there are
      untracked files in the working tree. Frontmatter-only +
      mechanical rendering text addition.
- [ ] **6.7 Council CLI entry-point.** Today the `agent-config` CLI
      has `keys:install-anthropic` / `keys:install-openai` but **no
      runtime council subcommand** — every council pass requires a
      one-off Python script under
      `scripts/ai_council/one_off_archive/<YYYY-MM>/`. Surfaced live
      during Council Round 1 (2026-05-04). Fix:
      - Add `./agent-config council:estimate <question.md>` —
        bundles the question via the existing
        `scripts/ai_council/bundler.py`, calls
        `scripts/ai_council/orchestrator.estimate`, prints the
        per-member cost table; honours `ai_council.enabled` (exits
        non-zero with hint if disabled).
      - Add `./agent-config council:run <question.md>` — same
        bundling + estimate, then prints the cost table and
        **requires explicit `--confirm` flag** (no interactive y/n
        — `agent-config` is non-interactive by contract); writes the
        response to a caller-named output path.
      - Add `./agent-config council:render <responses.json>` —
        re-renders the markdown report from a saved orchestrator
        run (debug aid).
      - Wire all three into `bin/agent-config`'s dispatch +
        `Usage:` block; deny-by-default if both members are
        `enabled: false`.
      - Tests under `tests/ai_council/test_cli.py`: estimate-only
        path uses pricing fixtures (no network), run-with-confirm
        uses a stub client (no network), help text snapshot.
      - Update `.agent-src.uncompressed/commands/council/default.md`
        execution section to point at the CLI instead of the
        "orchestrate programmatically" instruction; `task sync`
        regenerates compressed copies. **Source-of-truth rule
        respected — no edit under `.agent-src/` or `.augment/`.**
      - Migrate the most recent one-off (`tmp/run_council.py` ad-hoc
        + the `_one_off_*.py` template) to use the new CLI in its
        first paragraph as the canonical pattern; the one-off
        archive stays as a historical record.

**Phase exit:** four taskfile groups live; one-off purge policy +
linter shipped; README 3-path block visible; drift sentinel green;
untracked-files line in completion-evidence skill confirmed;
`./agent-config council:{estimate,run,render}` shipped + tested +
documented in the council command file.

## Phase 7 — Cross-Agent Hook Coverage

**Mockable until:** *"Hook layer is Augment + Claude only — Cursor,
Cline, Windsurf, Gemini, Copilot users get no parity; per-(concern ×
platform) trampolines will sprawl as new concerns land; nothing
proves an installed hook actually fires on the target platform"*
(new — surfaced by Council Round 1, anthropic + openai, 2026-05-04).
**Resolved when:** every supported platform listed in
`agents/contexts/chat-history-platform-hooks.md` runs every concern
in `scripts/hook_manifest.yaml` via a single per-platform
dispatcher; `task hooks-status` prints a runtime ✓/✗ matrix; install
output is snapshot-tested; event-shape contract tests pin each
platform's payload; Copilot has a documented rule-only fallback per
concern.

- [x] **7.1 Hook-architecture contract.** Author
      `docs/contracts/hook-architecture-v1.md` — defines: dispatcher
      stdin shape `{platform, concern, event}`, exit-code semantics
      (0=allow, 1=block, 2=warn), manifest schema, concurrency rules
      (atomic write contract for `agents/state/`), Copilot
      fallback-pattern (rule cites the state file the concern would
      have written).
- [x] **7.2 Manifest authoring.** `scripts/hook_manifest.yaml`
      ships with `schema_version: 1`, four concern entries
      (chat-history, roadmap-progress, onboarding-gate,
      context-hygiene), full Augment + Claude bindings, `null`
      placeholders for cursor/cline/windsurf/gemini, a
      `fallback_only: true` block for copilot, and a
      `native_event_aliases` table per platform. Validated by
      `lint_hook_manifest.py` (7.10).
- [x] **7.3 Universal dispatcher refactor (Augment + Claude).**
      `scripts/hooks/dispatch_hook.py` resolves
      `(platform, event)` → concern list, runs each concern with the
      stdin envelope from `hook-architecture-v1.md`, reduces exit
      codes (allow=0, block=1, warn=2). `scripts/hooks/augment-dispatcher.sh`
      replaces the four per-concern trampolines; `install.py`
      `_purge_legacy_augment_trampolines()` drops them on rerun.
      Augment SessionStart/End, Stop, PostToolUse and the full
      Claude `hooks` block in `.claude/settings.json` route through
      `./agent-config dispatch:hook --platform <…> --event <…>`.
      Council Round 2 polled on the dispatcher contract — verdict
      block recorded in this roadmap (Round 2 — Verdict). **Round 2
      amendment (must-fix gate before 7.5):** dispatcher writes
      per-concern feedback files under
      `agents/state/.dispatcher/<session_id>/<concern>.json` plus a
      `summary.json` rollup; exit-code reduction stays for control
      flow, feedback channel surfaces all concerns to humans /
      `task hooks-status`.
- [x] **7.4 Concurrency-safe state writes.** `scripts/hooks/state_io.py`
      ships an `atomic_write_json` helper using
      `fcntl.flock(LOCK_EX)` on `agents/state/.dispatcher.lock` plus
      `tmp.<pid>` + `os.replace`. `onboarding_gate_hook.py` and
      `context_hygiene_hook.py` retrofitted to use it. Regression
      test under `tests/hooks/test_concurrency.py` runs 6 forked
      processes and 8 threads with 200 KB payloads against the same
      target and asserts the file always contains exactly one
      writer's complete payload.
- [x] **7.5 Cursor support.** `cursor` block in
      `scripts/hook_manifest.yaml` binds session_start, session_end,
      stop, user_prompt_submit, post_tool_use to the four concerns;
      `scripts/hooks/cursor-dispatcher.sh` is the user-scope
      trampoline (extracts `workspace_roots[0]` via jq/python3 and
      forwards to `./agent-config dispatch:hook --platform cursor`);
      `install.py` `ensure_cursor_bridge()` writes project-scope
      `.cursor/hooks.json` with direct dispatch commands (no
      trampoline — Cursor fires project hooks with workspace as cwd);
      `--cursor-user-hooks` flag deploys `~/.cursor/hooks/` +
      `~/.cursor/hooks.json` via `ensure_cursor_user_hooks()`. Three
      install-snapshot tests in `tests/test_install_py.py` pin the
      generated JSON shape, idempotency, and force-merge behaviour.
      Manifest linter regression test
      (`test_cursor_null_with_trampoline_on_disk_fails`) catches
      orphan trampolines.
- [x] **7.6 Cline support.** `cline` block in
      `scripts/hook_manifest.yaml` binds session_start (TaskStart +
      TaskResume), session_end (TaskComplete), stop (TaskCancel),
      user_prompt_submit, post_tool_use to the four concerns;
      `scripts/hooks/cline-dispatcher.sh` is the user-scope
      trampoline (extracts `workspaceRoots[0]` via jq/python3, strips
      CRLF per cline#8073, refuses non-directory roots, then forwards
      to `./agent-config dispatch:hook --platform cline`); `install.py`
      `ensure_cline_bridge()` writes one extensionless executable per
      `(ac_event, native_event)` tuple under `.clinerules/hooks/`
      (Cline's project-scope convention — file name == hook name);
      `--cline-user-hooks` flag deploys `~/Documents/Cline/Hooks/`
      with the shared trampoline + per-event wrappers via
      `ensure_cline_user_hooks()`. Three install-snapshot tests in
      `tests/test_install_py.py` pin the generated script shape,
      idempotency, and the don't-clobber-user-edits-without-force
      contract. Manifest linter regression test
      (`test_cline_null_with_trampoline_on_disk_fails`) catches
      orphan trampolines.
- [x] **7.7 Windsurf support.** `windsurf` block in
      `scripts/hook_manifest.yaml` binds `session_start`,
      `user_prompt_submit`, `stop` (Cascade has no generic
      post-tool-use surface — concerns gated to that slot don't fire
      on Windsurf, documented in
      `agents/contexts/chat-history-platform-hooks.md`).
      `scripts/hooks/windsurf-dispatcher.sh` resolves the workspace
      from `$PWD` → `.agent-settings.yml` walk → `tool_info.cwd` /
      `tool_info.file_path` → `$ROOT_WORKSPACE_PATH` (Windsurf
      passes no `workspaceRoots` array).  `install.py`
      `ensure_windsurf_bridge` writes `.windsurf/hooks.json`
      (project-scope, no trampoline — Cascade fires with cwd as
      workspace), `ensure_windsurf_user_hooks` writes
      `~/.codeium/windsurf/hooks.json` + trampoline
      (`--windsurf-user-hooks` flag).  Three install tests
      (`test_windsurf_bridge_writes_dispatcher_hooks`,
      `_idempotent`, `_force_overwrites_user_edits`) plus
      `test_windsurf_null_with_trampoline_on_disk_fails` orphan
      check.
- [x] **7.8 Gemini CLI support.** `gemini` block in
      `scripts/hook_manifest.yaml` binds `session_start`,
      `session_end`, `stop`, `user_prompt_submit`, `post_tool_use`
      with PascalCase native aliases (`SessionStart`, `SessionEnd`,
      `AfterAgent`, `BeforeAgent`, `AfterTool`).
      `scripts/hooks/gemini-dispatcher.sh` resolves the workspace
      from `$PWD` → `.agent-settings.yml` walk → payload `cwd` (Gemini
      does not pass `workspace_roots`, see Round 1 surface map).
      `install.py` gains `ensure_gemini_bridge` (project-scope
      `.gemini/settings.json` with the nested
      `{matcher, hooks: [{type, command}]}` schema Gemini requires)
      and `ensure_gemini_user_hooks` (user-scope
      `~/.gemini/settings.json` + `~/.gemini/hooks/gemini-dispatcher.sh`,
      gated by `--gemini-user-hooks`). Tests:
      `test_gemini_bridge_writes_dispatcher_hooks`,
      `test_gemini_bridge_idempotent`,
      `test_gemini_bridge_force_preserves_custom_events` in
      `tests/test_install_py.py`;
      `test_gemini_null_with_trampoline_on_disk_fails` orphan check
      in `tests/hooks/test_manifest_linter.py`.
- [x] **7.9 Copilot rule-only fallback.** No dispatcher (Copilot
      has no hook surface; `scripts/hook_manifest.yaml` flags it
      `fallback_only: true`). Each concern's source rule gained a
      `## Copilot fallback` section, section-append only, no
      Iron-Law touches: `onboarding-gate.md` cites
      `agents/state/onboarding-gate.json` + the manual
      `python3 scripts/onboarding_gate_hook.py < /dev/null` reproducer;
      `context-hygiene.md` cites `agents/state/context-hygiene.json`
      + the manual `python3 scripts/context_hygiene_hook.py < /dev/null`
      reproducer; `roadmap-progress-sync.md` cites
      `agents/roadmaps-progress.md` + the canonical
      `./agent-config roadmap:progress` regenerator (portability-clean,
      no project-specific paths); `chat-history-cadence.md` documents
      the cooperative CHECKPOINT path (`turn-check` + `append`) as the
      Copilot path, with `scripts/chat_history.py hook-dispatch
      --platform copilot` as the dispatcher-equivalent entry. All four
      sections survive `scripts/check_portability.py` and the full
      pytest suite (2156 tests).
- [x] **7.10 `lint_hook_manifest.py`.** Hard-fails on missing concern
      scripts, unknown concerns/platforms/events, alias targets
      outside the vocabulary, and orphan `<platform>-dispatcher.sh`
      trampolines without manifest bindings. Soft-warns on
      placeholder platforms and dead concerns; `--strict` upgrades
      warnings to errors. Wired into `task ci` between
      `lint-rule-tiers` and `lint-marketplace`. 10 regression tests
      under `tests/hooks/test_manifest_linter.py`.
- [x] **7.11 Three-layer test stack.** Under `tests/hooks/`:
      (a) **parser unit** — `test_dispatcher_parser.py` exercises
      `_fallback_yaml`, `_resolve_concerns`, `_build_envelope`,
      `_parse_concern_stdout`, `_severity_for`, `_reduce`, plus the
      `EVENT_VOCABULARY` invariant (15 cases, no subprocess).
      (b) **install snapshot** — `test_install_snapshot.py` freezes
      Cursor `.cursor/hooks.json`, Cline `.clinerules/hooks/<HookName>`,
      Windsurf `.windsurf/hooks.json`, Gemini `.gemini/settings.json`
      shapes and a cross-table `BindingCoverageSnapshot` that locks
      install bindings against the manifest's platform events.
      (c) **event-shape contract** — `test_event_shape_contract.py`
      freezes one canonical native payload per (platform, event) and
      asserts the manifest's `native_event_aliases` resolve, the
      envelope preserves the payload verbatim, top-level keys are
      present, and `session_id` is lifted out of the payload.
- [x] **7.12 Post-install smoke + `task hooks-status`.**
      `install.py` dry-fires `dispatch_hook.py --dry-run` against
      every installed bridge after deploying configs (synthetic
      `session_start` per platform, parses the JSON plan, asserts
      exit 0 + non-empty `concerns` list); `--no-smoke` opts out;
      failures are warnings only so restricted CI sandboxes don't
      block. `scripts/hooks_status.py` reads the manifest, walks the
      project for bridge files (file or non-empty dir for cline),
      prints a per-platform ✓/✗ matrix in `table` or `json` form,
      and exits non-zero under `--strict` when a platform with
      declared bindings is missing its bridge. Wired into
      `./agent-config hooks:status`; README links to it. **Round 2
      amendment:** Copilot row carries a `degraded: rule-only
      fallback` marker — never trips `--strict`.

**Phase exit:** dispatcher pattern shipped on Augment + Claude
without behavior change; four new platforms support hooks via the
manifest; Copilot fallback documented per concern; `task
hooks-status` works; three-layer test stack green; post-install
smoke step in `install.py` green; manifest linter hooked.

## Council Round 1 — Verdict (2026-05-04)

**Trigger:** User asked for parity across all agent platforms.
Council enabled in API mode (~$0.06 spend), question:
*"Phase 7 hook-coverage extension — architecture, copilot fallback,
test strategy, rollout sequencing."* Response captured in
`tmp/council_hook_coverage_response.md`.

**Convergence (both members):**

- Manifest-driven wiring beats per-(concern × platform) trampolines.
  Both members independently called out the O(N×M) maintenance
  failure mode — anthropic concretely (universal dispatcher +
  `hook_manifest.yaml`), openai tentatively but in the same
  direction.
- Per-platform sequential rollout is the right shape (one PR per
  platform behind an install flag).
- Fixture-replay event-shape tests are necessary — but not
  sufficient (anthropic): need install-snapshot + post-install
  smoke too.
- Runtime status command (`task hooks-status`) for Copilot beats
  README-only fallback documentation.

**Divergence:**

- **Test depth:** anthropic insists on three layers (parser unit,
  install snapshot, event-shape contract) plus a manual smoke
  runbook; openai treats fixture-replay as largely sufficient.
  Roadmap follows anthropic — Phase 7.11 + 7.12.
- **Concurrency hazard:** anthropic surfaced it (TOCTOU on
  `agents/state/onboarding-gate.json` when Cursor + Windsurf run
  in the same workspace); openai did not. Roadmap absorbs it —
  Phase 7.4 + risk-register row.

**Folded into the roadmap:**

- Phase 5 retracted its own per-platform trampoline plan and now
  rides the Phase 7 dispatcher.
- Phase 7.1–7.4 made prerequisites for Phase 5.
- Risk register gained four hook-specific rows.
- Open question (1) ("council activation") removed — answered.
- **Meta-gap surfaced live:** running this round required a
  bespoke `tmp/run_council.py` because `./agent-config` has no
  `council:*` subcommand. Captured as Phase 6.7 — future council
  passes get a stable CLI with cost-confirmation contract.

## Council Round 2 — Verdict (2026-05-04)

**Trigger:** Phase 7.1 contract + 7.2 manifest + 7.3 dispatcher +
7.4 atomic state + 7.10 linter shipped. Round 2 polled before
extending to Cursor / Cline / Windsurf / Gemini and writing the
Copilot fallback. Council enabled in API mode (~$0.06 spend),
question artefact `tmp/council_hook_round2_question.md`. Response
captured in `tmp/council_hook_round2_response.md`.

**Convergence (both members):**

- Q1 exit-code reduction has a real gap — highest-severity-wins
  drops sibling concern signal. Both members flagged it; anthropic
  marked it "must fix before 7.5–7.8".
- Q2 shared-lock concurrency is fine for current scale; defer
  per-file locks until contention is observed.
- Q3 vocabulary covers the lifecycle; one extension worth adding.
- Q5 install-snapshot test layer is the lowest-leverage of the
  three; parser unit + event-shape contract are load-bearing.

**Divergence:**

- **Q3 vocab extension:** anthropic concretely proposes
  `agent_error` (agent crashed, not concern-triggered) so
  chat-history can checkpoint partial sessions. openai is silent
  on a specific event. **Roadmap absorbs anthropic's proposal —
  added to vocabulary, manifest schema, contract.**
- **Q4 Copilot:** anthropic argues the rule-only fallback is
  "documentation masquerading as a feature" and suggests refusing
  install on Copilot-only setups. openai softer — keep the
  documented manual approach but make it explicit. **Roadmap
  keeps Phase 7.9 as planned (rule-fallback) and adds a
  degraded-mode marker in `task hooks-status` (Phase 7.12) so
  Copilot users see at a glance that hooks are not auto-firing.
  The "refuse install" position is recorded as a future option,
  re-evaluated when 7.12 telemetry shows Copilot users actually
  miss state writes in practice.**
- **Q5 install-snapshot:** anthropic calls (b) "coverage theatre
  that breaks on every benign manifest reorder"; openai recommends
  keeping it. **Roadmap keeps (b) but downgrades it to a single
  per-platform snapshot, not a full matrix — the round 1 cost
  decision (one PR per platform) already amortises the brittleness.**

**Folded into the roadmap:**

- **Q1 fix promoted to a hard gate before 7.5.** Dispatcher now
  writes per-concern feedback files under
  `agents/state/.dispatcher/<session_id>/<concern>.json` plus a
  `summary.json` rollup. Exit-code reduction stays as control-flow
  signal; feedback channel is for humans / `task hooks-status`.
  Captured under Phase 7.3 amendment (line 438) and a new entry
  under Phase 7 risk register.
- **Q3 `agent_error` event added** to `EVENT_VOCABULARY` in
  `dispatch_hook.py`, the `events:` schema in
  `docs/contracts/hook-architecture-v1.md`, and the
  `native_event_aliases` table per platform in
  `scripts/hook_manifest.yaml`.
- **Q4 Copilot divergence parked** with explicit re-eval criterion
  on Phase 7.12 telemetry (no immediate roadmap change beyond the
  degraded-mode marker spec in 7.12).
- **Q5 install-snapshot scope narrowed** in Phase 7.11 — one
  golden bytes file per platform, not full matrix.

**Cost:** $0.0646 USD (anthropic 2016 in / 1541 out · openai 1720
in / 625 out). Within the 50000/20000/10 cap.

## Open questions for the user

These do not block Phase 1 start, but the answers shape Phases 3 / 4 / 7.

1. **Decision-trace default.** Phase 3.2 currently makes the trace
   opt-in via `.agent-settings.yml`. Do you want it opt-out
   instead (default on, off-switch documented)?
2. **One-off TTL extension mechanism.** Phase 6.3 enforces a 60-day
   TTL. Should "extend" require a PR comment, a frontmatter line,
   or a separate `.tll` file? *(My recommendation: frontmatter
   `ttl_extended_until: <date>` line; minimal infra.)*
3. **Showcase recordings under git.** The transcript logs are large.
   Do you want them committed (git LFS), gitignored with checksums
   only, or kept under `agents/state/showcase-sessions/` (runtime,
   gitignored)?
4. **Hook-install flag default.** Phase 7.5–7.8 each add a
   `--<platform>-user-hooks` flag to `install.py`. Should the new
   platforms be **opt-in** (user runs the flag explicitly, default
   off) or **opt-out** (installed automatically when the platform
   directory is detected, e.g. `.cursor/` exists)? *(My
   recommendation: opt-in — matches the existing Augment/Claude
   pattern, blast-radius-safer.)*

## Reference

- Synthesis source: `tmp/feedback-synthesis-2026-05-04.md`
  (deleted on roadmap archival).
- Council Round 1 raw response: `tmp/council_hook_coverage_response.md`
  (deleted on roadmap archival).
- Council Round 1 prompt: `tmp/council_hook_coverage_question.md`
  (deleted on roadmap archival).
- Council Round 2 raw response: `tmp/council_hook_round2_response.md`
  (deleted on roadmap archival).
- Council Round 2 prompt: `tmp/council_hook_round2_question.md`
  (deleted on roadmap archival).
- Platform hook surface inventory: `agents/contexts/chat-history-platform-hooks.md`.
- Hardening rubric: `agents/contexts/hardening-pattern.md`.
- One-off location policy: `scripts/check_one_off_location.py`
  (existing).
- Roadmap complexity contract: `docs/contracts/roadmap-complexity-standard.md`.
- State runtime path: `agents/state/`.
- Sibling roadmaps: `road-to-always-budget-relief.md` (activated by
  Phase 2.6), `road-to-better-skills-and-profiles.md` (Block A
  cross-link Phase 3.5), `road-to-distribution-and-adoption.md`
  (Block Q wire-up Phase 4.5), `road-to-mcp-server.md`
  (independent track).

## Next step

Council Round 2 is folded in. Q1 feedback channel is the hard gate
before Phase 7.5. Concrete next step: implement
`agents/state/.dispatcher/<session_id>/` per-concern feedback
files in `dispatch_hook.py`, then add `agent_error` to
`EVENT_VOCABULARY`. Both gate the four platform extensions
(7.5–7.8). Phase 1.1 (`agents/contexts/outcome-baseline.md`)
remains the parallel non-Phase-7 next step. No commits and no
pushes without explicit user permission per `commit-policy`.
