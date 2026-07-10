---
complexity: structural
execution:
  mode: phase-checkpoints
---

# Road to proof under real conditions

> Close the release-engineering gap an external operator review scored weakest
> (6.8/10 vs. 9+ everywhere else): make the published package provably
> installable, upgradeable, and runnable under real consumer conditions, add
> the delegation-quality and semantic-drift proofs the review showed we lack,
> and ship the one functional gap it still names — a governed worktree layer.

## Goal

Every failure class from the review's incident list (published tarball missing
imported trees, release-adjacent workflows red post-tag, kernel-rule semantics
lost in a clean merge, cost-savings claims without a quality dimension) has a
deterministic gate that would have caught it, and the two capability gaps the
review names (governed worktrees, outcome-adjusted delegation quality) are
shipped thin or measurably extended.

## Prerequisites

- [x] Import-completeness guard exists (added after the missing-`src/install/`
      incident) — this roadmap extends, not re-invents it.
- [x] `smoke-public-install.yml` proves tarball-based fresh install on 3 OS ×
      2 Node — the consumer matrix builds on its local-tarball pattern.
- [x] Orchestration telemetry capture path + bench arms exist
      (`road-to-subagent-value-realization-followup`, `internal/bench/orchestration/`).
- [x] `tests/golden/outcomes/*.json` baselines exist for kernel-rule behavior.
- [x] Host-native worktree primitives are live in Claude Code
      (EnterWorktree / ExitWorktree, `isolation: "worktree"` on subagent spawn).

## Context

An external operator review of the 8.x line (supplied inline by the
maintainer, 2026-07-10) rates architecture, governance, and memory 9+ but
release engineering 6.8/10, citing five real incidents: two published minors
whose tarball lacked `src/install/` while published code imported from it;
`tsx` absent from the published package; a release workflow failing on a
missing `go-task` binary; npm publish failing on `npm@latest`→Node-22 drift;
and the MCP worker deploy red across five releases without detection. Its
thesis: the next maturity step is not another subsystem — it is proving what
exists under real install / upgrade / delegation / consumer conditions.

The maintainer's mandate for this roadmap: question earlier decisions rather
than treating them as locks (precedent: the `subagents.auto` default flip from
`ask` to `on`, which our own earlier council had gated and which turned out to
cut cost and strengthen the product). One lock was formally revisited in
council (below): the 2026-06 parity-council rejection of worktree runtime
infrastructure.

A structural finding from this session's research: the
[`release-pr-gating`](../../docs/contracts/release-pr-gating.md) contract
skips the heavy install/test matrices on release PRs, reasoning that a
version-bump diff "cannot regress install behaviour by construction". That
reasoning is sound for the *diff* but blind to the *tarball*: every packaging
incident above entered on ordinary PRs and manifested only at publish time —
exactly the window where nothing pack-based runs today. Phase 1 closes that
window without reopening the (correct) skip of source-level matrices.

## Gap audit (KEEP / FOLD / CUT)

| Review item | Verdict | Where |
|---|---|---|
| Consumer-matrix release gate (pack → install → upgrade → doctor → conformance → MCP → hooks → projections → uninstall) | **KEEP** | Phase 1 |
| Release-adjacent workflow dry-runs pre-tag (npm publish, MCP worker deploy, Pages, plugin bootstrap) | **KEEP** | Phase 1 |
| Hard freeze ("no platform expansion before matrix green") | **CUT** — council split; adopted as phase-ordering inside this roadmap (Phase 1 is the top-priority active work; the gate blocks releases, never unrelated development) | Council notes |
| Semantic assertions per kernel rule | **KEEP** as golden-outcome invariant strings (mechanism (b)) — not a new per-rule assertions file | Phase 2 |
| Governed worktree runtime (`/worktree:*`) | **KEEP** thin subset — lock revisited; the 2026-06 rejection covered daemon/SQLite/auto-write mechanisms, not a thin command layer over host-native primitives | Phase 3 |
| Outcome-adjusted delegation benchmark ("verified successful work per 1M tokens") | **FOLD** into `road-to-subagent-value-realization-followup` measurement scope; this roadmap adds the schema fields + report shape it needs | Phase 4 |
| Five worker-quality telemetry fields | **KEEP 2** (first-pass success, escalation rate); **CUT 3** (parent-rework ≈ inverse of first-pass; verification-failure already implied; regression attribution needs human audit) | Phase 4 |
| Consumer-flow wiring of retrieval / quarantine / domain-truth / routing into `/work` | **KEEP**, tripwire-gated | Phase 5 |
| Retrieval quality metrics (stale-hit rate, poisoned-memory rejection) | **FOLD** into the existing retrieval-precision harness as two added metrics | Phase 5 |
| Release-sizing policy (one product goal per minor, rollback path per subsystem) | **KEEP** as a short contract | Phase 6 |
| Meta-ratio "≥2/3 effort consumer-facing" | **CUT** — gameable vanity metric, both council members agreed | — |
| Marketing / demo visibility | **CUT** — owned by `road-to-adoption-without-narrative-debt` and `road-to-token-proof-and-story` | — |

## Council notes (2026-07-10, debate, 2 rounds)

Members: anthropic/claude-sonnet-4-5 + openai/gpt-4o. Convergence:

- **Worktree lock revisit — REOPENED, build thin subset.** Both members:
  the 2026-06 rejection targeted daemon/auto-write infrastructure; wrapping
  host-native primitives is a different mechanism ("documentation made
  executable"). Keep out: auto-merge, daemons, multi-worktree orchestration
  beyond single-agent scope.
- **Release gate — unanimous.** Minimal matrix that catches all five
  historical failures: pack-based fresh global install, npm publish dry-run
  on both supported Node majors, MCP worker deploy dry-run, post-install
  doctor from the tarball. Upgrade-path and projection legs are worth adding
  (round 2) because the historical set is not the future set.
- **Freeze — SPLIT.** claude-sonnet-4-5 argued for a blunt freeze
  (cognitive-load limiter for a single maintainer; "a blocking gate that
  never passes IS a freeze"); gpt-4o argued opportunity cost of blocking
  unrelated low-risk work. Synthesis adopted: no repository-wide freeze;
  instead (a) Phase 1 is ordered first and other phases of this roadmap
  gate on its exit, and (b) the gate blocks *releases* unconditionally —
  which converges to the sonnet position exactly when it matters (a red
  matrix stops shipping) without stopping unrelated content work.
- **Telemetry — extend the existing follow-up, two fields only.** The
  proposed headline metric "verified successful work per 1M tokens" is
  definitionally circular; report quality (first-pass success rate) and
  cost (tokens saved) as separate dimensions, never cost alone.
- **Semantic drift — mechanism (b) unanimous.** Extend golden outcomes with
  grep-able invariant strings, checked in CI; no per-rule assertions file
  (maintenance explosion), no semantic merge-differ (fragile or expensive).
- **Meta-ratio — CUT unanimous.**
- **Shape — one roadmap** with release-proof ordered first.

## Provenance

Source: an operator-authored external review of this package's 8.x release
line, measured against an external operator-runtime reference suite (the same
neutral reference as the 2026-06 parity council). Supplied inline by the
maintainer in-session; no external link exists to retain.

## Phase 1 — Consumer-proof release gate

The window today: ordinary PRs run source-level tests; release PRs run shape
checks; nothing between merge and tag exercises the *published tarball* as a
consumer. Build the missing pack-based E2E and pull release-adjacent
workflows into the gate.

- [x] Build `scripts/consumer_matrix.ts` (or extend the
      `smoke-public-install` harness): `npm pack` → fresh global install from
      the tarball → `agent-config init` into a fresh consumer project →
      `doctor` → `conformance` → MCP server start (handshake only) → one
      managed-hook invocation → Cursor + Windsurf projection presence check →
      uninstall leaves no orphaned files. Each leg asserts exit code +
      expected artifact, no LLM calls. <!-- carve-out: new-gate-verification --> <!-- src/scripts/consumer_matrix.ts; 9 legs green locally incl. ADR-020 global-scope adaptation + hermetic HOME; found+documented the headless default-scope trap -->
- [x] Add the upgrade leg: install the last published minor from the npm
      registry into a fixture project, then upgrade to the packed tarball;
      `doctor` green afterwards; settings-sync produces the expected
      upgrade-delta (catches cached-state breakage the fresh leg cannot). <!-- upgrade leg green: registry latest → tarball, conformance (embeds doctor --ci + firing checks) as the post-upgrade probe -->
- [x] Wire the matrix as a required check on release PRs in
      `release-validation.yml` (it is fast enough there; the source-level
      skip from `release-pr-gating` stays) and as a weekly cron against the
      last published version (catches registry/upstream drift between
      releases, the mode that kept the MCP deploy red unnoticed). <!-- wired as own consumer-matrix.yml with release-PR trigger + weekly cron (separate heavy jobs); release-validation.yml untouched, kept-surface table in release-pr-gating.md lists the four jobs; required-check flip is a branch-protection setting, noted in the contract -->
- [x] Pull release-adjacent workflows into the gate: add dry-run legs for
      `publish-npm.yml` (both supported Node majors, npm version pinned —
      assert the pin, not `npm@latest`), `deploy-mcp-worker.yml` (pack +
      deploy `--dry-run`, installing root deps so `scripts-run`/`tsx`
      resolve), and the plugin bootstrap. Each dry-run must run on the
      release PR, not first post-tag. <!-- publish-dry-run (npm-pin assertion + publish steps sans publish, node 20+22), mcp-worker-dry-run (root deps + pack + wrangler --dry-run, verified locally), plugin-bootstrap (marketplace lint + symlink resolution) -->
- [x] Add a red-workflow tripwire: a scheduled job that fails loudly (issue
      or commit-status on `main`) when any release-adjacent workflow's last
      run on `main` is red for > 48h — the "red for five releases without
      anyone noticing" detector. <!-- release-adjacent-health.yml + check_release_adjacent_health.ts -->
- [x] Amend `docs/contracts/release-pr-gating.md`: document that the
      pack-based consumer matrix is exempt from the release-PR skip (the
      skip's "cannot regress by construction" argument covers source diffs,
      not tarball shape), and cross-link the matrix contract.
- [x] Counterfactual check, recorded in the matrix contract doc: for each of
      the five historical failures, name the matrix leg that catches it. A
      failure with no leg → add the leg or record why it is out of scope.
      <!-- docs/distribution/consumer-matrix.md § Counterfactual map -->

**Exit criteria:** matrix green on a real `npm pack` of current `main`; all
five historical failures map to a named leg; release-PR wiring merged; weekly
cron scheduled; tripwire fires in a forced-red test.
**Rollback:** the matrix is additive CI — disable the workflow file; no
consumer-visible surface changes.

## Phase 2 — Kernel semantic invariants (golden-outcome presence check)

Real incident: two merged PRs' rule semantics vanished from `main` in a
syntactically clean merge and had to be re-landed. Hashes and
preservation-guard protect condensation, not merges.

- [x] Extraction pass: for each kernel rule (per
      `docs/contracts/kernel-membership.md`), identify 1–3 invariant strings
      whose absence means the rule's behavior guarantee is gone (e.g. the
      no-duration-estimates clause in `direct-answers`). Target 15–20
      invariants total — highest-value only, per council. <!-- 19 invariants across the 9 locked kernel rules -->
- [x] Encode them in the existing `tests/golden/outcomes/` layer (or a
      sibling `tests/golden/invariants.json`): rule file → required literal
      (or normalized-regex) strings, checked against `src/rules/` AND
      `dist/agent-src/rules/` so both source and projection are covered.
- [x] Add the CI check (extends the golden-outcomes runner or a new
      `check_rule_invariants.ts`), failing with the rule + missing string.
      <!-- carve-out: new-gate-verification --> <!-- task target check-rule-invariants wired into ci + ci-strict -->
- [x] Counterfactual check: confirm the check would have caught the known
      content-loss incident (assert the re-landed action-authority +
      direct-answers strings are in the invariant set); record the result in
      the check's header comment. <!-- #847/#849 re-landed strings are in the set; recorded in script header -->

**Exit criteria:** invariant set covers every kernel rule; CI check red when
an invariant string is deleted (verified by a mutation test), green on
current `main`.
**Rollback:** delete the invariants file + CI step; no behavior surface.

## Phase 3 — Governed worktree layer (thin, host-native)

Lock revisited in council (above): build the thin subset, wrapping host
primitives — no daemon, no auto-write, no auto-merge.

- [x] Author a `worktree-lifecycle` skill: when to isolate work in a
      worktree, scope-lock declaration (which paths this worktree owns),
      status/merge-ready checklist (verification evidence attached, no
      inherited-commit drops per `git-history-discipline`), cleanup
      discipline. Wraps host-native EnterWorktree/ExitWorktree and
      `isolation: "worktree"` dispatch; degrades to plain
      `git worktree add` guidance on hosts without the primitive.
- [x] Add the command cluster — minimal core per council:
      `/worktree:create` (create + scope-lock note), `/worktree:status`
      (ownership, dirty state, merge-readiness across active worktrees),
      `/worktree:verify` (run the scoped verification for the worktree's
      declared change), `/worktree:cleanup` (safe removal gate — refuses on
      unmerged unique commits). Explicitly out: `dispatch` beyond the
      existing subagent `isolation` option, merge execution, background
      watchers.
- [x] Downstream surface per the standalone-command checklist (packs.yml,
      discovery, README counts, capability index) — reuse ≥ 2 existing
      skills (`using-git-worktrees`, `git-workflow`) instead of restating
      their content. <!-- surface-map mapped; sync ran (268 skills / 177 cmds); dist twins + projections generated; marketplace is a bootstrap shim since the plugin retirement — no skills[] entry needed -->
- [x] Trigger evals: 5 should-trigger / 5 should-not-trigger fixtures for
      the skill (presence-ratchet requires them). <!-- queries shape, 5 true + 5 false, DE+EN, near-miss negatives; presence-ratchet green -->

**Exit criteria:** cluster visible in discovery; skill linter green; trigger
fixtures pass; `/worktree:cleanup` refuses removal of a worktree with unique
commits in a scripted test.
**Rollback:** remove cluster + skill (standalone-command downstream checklist
in reverse); host primitives remain untouched.

## Phase 4 — Delegation quality dimension (extend, don't duplicate)

Measurement stays owned by `road-to-subagent-value-realization-followup`;
this phase gives it the quality dimension the review showed is missing.

- [x] Extend the orchestration telemetry schema
      (`src/scripts/_lib/orchestration_record.ts`) with exactly two fields:
      `first_pass_success` (subagent return adopted without parent rework)
      and `escalated` (retried on a higher tier after verification failure).
      PII-exclusion-by-construction shape stays (ids + counters only).
      <!-- boolean|null additive fields; non-boolean rejected; 21 unit tests green -->
- [x] Update `orchestration_savings_report.ts` / `/cost:report` to report
      quality and cost as paired dimensions — first-pass success rate
      alongside tokens saved; never emit the savings number without the
      quality column once ≥ 20 dispatches carry the new fields.
      <!-- QUALITY_GATE_MIN_LINES=20; no savings-only render path exists -->
- [x] Add the two fields to the bench arms in `internal/bench/orchestration/`
      so the follow-up's corpus runs populate them from day one.
      <!-- no JSONL fixtures exist there; the run contracts (README + 5 corpus files) now require recording the pair -->
- [x] Update `road-to-subagent-value-realization-followup` Phase 1 exit
      criteria to include the quality columns (annotate, don't rewrite its
      scope).

**Exit criteria:** one real dispatch produces a telemetry line carrying both
new fields; report renders the paired columns; bench arms populate them.
**Rollback:** fields are additive JSONL — revert schema + report change; old
lines remain parseable.

## Phase 5 — Consumer-flow wiring (tripwire-gated)

The 8.9-era capabilities (retrieval, injection quarantine, domain-truth
fixtures, tier routing) exist as separate surfaces. Wire them into the
standard `/work` flow so a consumer gets them without invoking each
capability by name — gated so the wiring costs nothing when a layer is empty.

- [x] Add the retrieve step to `/work` intake: consult the knowledge/retrieval
      layer only above the existing index tripwire; budgeted response shape
      (the compact retrieval answer, not raw hits).
- [x] Add the quarantine step: found-instructions in retrieved/ingested
      content route through the existing `untrusted-input-defense`
      quarantine before any of it can influence the plan — assert the
      sanitize floor fires on a seeded hostile fixture.
- [x] Add the domain-truth step: when fixtures exist for the touched domain,
      run the deterministic scorer on the change; no fixtures → zero-cost
      skip.
- [x] Record-back gate: only validated learnings (verification passed this
      session) may be persisted by the flow — wire the existing sidecar
      verdicts in as the write condition.
- [x] Extend the retrieval-precision harness with the two folded metrics:
      stale-hit rate and poisoned-memory rejection rate (seeded fixtures for
      both). <!-- stale_hit_rate 0.114 baseline (no supersede weighting yet — honest), poisoned_rejection_rate 1.0; seeded stale+poisoned store entries -->
- [x] End-to-end fixture: one `/work` run on a seeded project exercises all
      four steps and each tripwire's skip path (empty index, no fixtures) —
      the skip paths must add zero LLM calls. <!-- tests/scripts/consumer_flow_wiring.test.ts — 10 deterministic tests, all four gates + skip paths, hostile fixture quarantined, single-origin never promotes -->

**Exit criteria:** E2E fixture green including skip paths; hostile fixture
quarantined; persisted-learning write refused without a verification verdict.
**Rollback:** each step is a guarded insertion in the `/work` flow — remove
the insertion; capabilities remain independently invocable.

## Phase 6 — Release-sizing contract

- [x] Author `docs/contracts/release-sizing.md`: one primary product goal
      per minor; independently disableable subsystems where feasible (flag
      or config key named in the release notes); every major subsystem names
      its rollback path in the CHANGELOG entry; the consumer matrix (Phase 1)
      is the floor for every release. Explicitly record the CUT meta-ratio
      and why (gameable), so it is not re-proposed.
- [x] Wire the one mechanizable check: extend the CHANGELOG conventions
      linter to require a `Rollback:` line for entries that introduce or
      substantially rework a subsystem (heuristic: new top-level capability
      area or new workflow file in the release diff).
      <!-- lint_changelog_rollback.ts: every ## [X.Y.0] section above the current version needs a Rollback: line — simpler decidable heuristic than diff inspection; wired as task lint-changelog-rollback in ci + ci-strict -->
- [x] Cross-link from `release-pr-gating.md` and the release runbook so the
      contract is on the release path, not shelf documentation.

**Exit criteria:** contract merged and linked; linter fails a fixture
CHANGELOG entry lacking a rollback line.
**Rollback:** contract doc + linter step revert cleanly.

## Blockers

### blocker: real-release-verification

- **Status:** open — resolves mechanically; `consumer-matrix.yml` triggers
  on every `release/*` PR by construction, so acceptance criterion 2 is
  verified automatically the next time a release is cut. All build steps in
  Phases 1–6 are complete; the roadmap archives with this blocker as the
  documented release-event gate.
- **Owner:** maintainer
- **Blocks:** final acceptance criterion 2 (first release through the full
  gate) — not any build step in Phases 1–6.
- **What to do:** cut the next regular release once this branch is merged;
  the gate legs run on that release PR without further action.
- **Resolved when:** a release PR shows the consumer matrix + all dry-run
  legs green before the tag exists (probe: `gh pr checks` on the next
  `release/*` PR).

## Acceptance criteria

1. Each of the five historical release failures names the exact gate leg
   that now catches it (recorded in the matrix contract; verified by
   counterfactual checks in Phases 1–2).
2. The next release after Phase 1 passes the consumer matrix and all
   release-adjacent dry-runs on the release PR, before tagging (see blocker).
3. Kernel semantic-invariant check is red under mutation, green on `main`.
4. `/cost:report` shows delegation quality and cost as paired columns on
   real telemetry.
5. `/worktree:*` thin cluster shipped with trigger evals; no daemon, no
   auto-merge anywhere in it.
6. `/work` E2E fixture proves the wired flow including all zero-cost skip
   paths.
7. Anti-dump litmus: no new artifact in this roadmap duplicates an existing
   one; every new command reuses ≥ 2 existing skills; `FOLD`/`CUT` verdicts
   above are the audit trail.
