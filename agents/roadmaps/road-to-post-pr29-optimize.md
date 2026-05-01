# Road to Post-PR-29 Optimize

**Status:** READY FOR EXECUTION — decisions synthesized 2026-05-01.
**Started:** 2026-05-01
**Trigger:** Senior-staff-level review of `agent-config` post-1.14.0 — focus on
runtime maturity, rule-system robustness, and outcome validation (not skill catalogue).
**Mode:** Phase 1 (housekeeping 1.15.0 + P0 packaging/positioning) approved.
Phase 2 (rule-interaction matrix, demo cases, outcome telemetry) approved
sequentially after Phase 1 lands.

## Purpose

Consolidate feedback on the **engine / rule-system / runtime / outcome** layer of
`event4u/agent-config` after PR #29, synthesize cross-source themes, and propose
ICE-prioritized actions to harden what is shipped — not to grow it.

**Sibling roadmap:** [`road-to-better-skills.md`](road-to-better-skills.md) covers
the persona / stakeholder-skill / per-skill-tool / orchestration-DSL track. This
roadmap covers everything else: engine, rules, runtime, demos, outcome proof.

**Out of scope** for this roadmap (handled in `road-to-better-skills.md`):

- Persona layer, stakeholder skills, per-skill Python tools, orchestration DSL,
  marketing / reach, multi-tool expansion, audit-as-memory.

## Decisions (synthesized 2026-05-01)

Synthesized from Claude + ChatGPT review rounds on the open-questions handoff.
Each decision cites the reviewer alignment and is anchored on the constraints
declared in `road-to-governance-cleanup.md` (engine = beta orchestration
contract, no new rules/skills, ~49k always-rule budget).

### Sequencing — Phase 1 (housekeeping 1.15.0) before any feature work

Both reviewers agreed: ship a **1.15.0 housekeeping release first**, then resume
feature tracks. Phase 1 contents (in order):

1. **Packaging fix (P0)** — adopt option **(b) `docs/contracts/`**. Move public
   contracts out of `agents/contexts/` (which is excluded from npm + Composer
   archives) into `docs/contracts/`. Redirect README links. `agents/` stays
   internal-only. Smallest persistent fix; option (a) "ship `agents/contexts`"
   bleeds internal notes into the public surface.
2. **Positioning sentence (P0)** — adopt verbatim:
   > *"`agent-config` is not a runtime, but it ships a deterministic
   > orchestration contract / state machine for host agents."*
   Apply to README headline, AGENTS.md, `docs/architecture.md`. Resolves the
   "not a runtime" vs "Engine" contradiction without backtracking on either.
3. **Counter-drift fix (P0)** — make `update_counts.py` mandatory in
   `task sync` with a build-breaking guard covering README + AGENTS.md +
   `docs/architecture.md`. One commit, blocking CI.
4. **Term separation (P0)** — split `runtime_dispatcher.py` (experimental
   shell-skill runner) from `work_engine` (shipped beta orchestration) from
   tool adapters (experimental) in README + architecture doc. Stability
   label: **Work Engine = beta** (locked here).
5. **State-default + migration safety** — change `DEFAULT_STATE_FILE` in
   `work_engine/cli.py` to `.work-state.json`; make migration backup
   collision-safe (`.bak` → `.bak.1` rotation or hard-fail). Ship
   `MIGRATION.md` for `implement_ticket → work_engine`.
6. **Lint regressions cleared** — fix the warnings shipped in
   `scope-control`, `autonomous-execution`, `commit-policy`,
   `direct-answers`. CI must surface a visible green status.
7. **Test coverage gaps** — `implement-ticket` without `--state-file`;
   `/work` UI-prompt + medium-prompt + resume + pre-existing
   `.work-state.json`.

### Phase 2 — sequenced after 1.15.0 lands

| Item | Decision | Rationale |
|---|---|---|
| **Chat-history redesign (C9)** | **Split into three artefacts** per Claude: `chat-history-ownership.md` (turn-check state machine, always-floor), `chat-history-cadence.md` (per_turn/per_phase/per_tool, auto-trigger), `chat-history-visibility.md` (heartbeat modes, auto-trigger). The 12-iteration signal means the 13th patch is wrong. ADR captures the split before any code edit. |
| **Rule-interaction matrix (C5/C14)** | **Both forms.** Machine-readable YAML (`agents/contracts/rule-interactions.yml`) consumed by a new linter; rendered diagram in `docs/contracts/`. Anchor pair: `non-destructive-by-default` (top priority per AI #4) × {`autonomous-execution`, `scope-control`, `commit-policy`, `ask-when-uncertain`, `verify-before-complete`}. |
| **`work_engine/cli.py` modularisation (C13)** | **Follow the named split** — `cli_args.py · state_io.py · input_builders.py · hook_bootstrap.py · runner.py · emitters.py`, `cli.py` keeps orchestration glue. Schedule **after** Phase 1 housekeeping; before R5+ feature work. Bounded refactor, zero behavior change verified by golden replay. |
| **CI performance budget (C12)** | **Introduce now.** PR CI target ≤ 8–10 min wall-clock. Smoke subset of GTs on PRs; nightly full replay (24 capture packs) as separate workflow. Engine-path changes trigger full replay on PR. Measurement gate: `task ci` must emit a duration line. |
| **Install-path pruning (C11)** | **Prune now.** Composer + npm = primary. curl, manual clone, cloud, Linear → labelled `advanced` / `experimental` / `staged` in `docs/installation.md`. No removals — relabelling only. Cloud + Linear stay shipped, just demoted from the front page. |
| **Telemetry redesign (C10)** | **Pause artefact-engagement counts; build feedback loop first.** With 0 external users, telemetry mirrors own dev work. Sequence: (a) issue templates ("which skill did not trigger?"), discussions category, "did this help?" minimal UX; (b) re-aim telemetry at behavioural outcomes (blocks · memory-relevance · directive-set failures · partial verifications · stop-rules); (c) keep opt-in privacy contract. Existing R6 telemetry stays installed but inert until users exist. |
| **Demo-track scope** | **Roadmap deliverable, not marketing.** Four named scenarios per AI #4: backend ticket · `/work` free-form · UI track · mixed flow. Concrete before/after reports in `agents/demos/`. Marketing reuse is out-of-scope here (lives in `road-to-better-skills-and-profiles.md` Block H). |
| **Decision engine "explicit"** | **ADR + spike, not implementation.** Capture the future contract (scoring + confidence + risk surfaces) as an architectural-decision record. No code until the rule-interaction matrix lands and proves the decision shape. |
| **Memory-visibility surface** | **Heartbeat-style line + opt-in `/memory-impact` command.** Heartbeat reuses chat-history visibility plumbing. Dedicated command for inspection. Rejected: implicit-via-summaries (too invisible to count as "behavior gets better"). |
| **Stop-growing iron rule** | **Roadmap-level guidance, not project-level meta-policy.** Tied to budget recovery in `road-to-governance-cleanup.md`. Promote to meta-policy only after Phase 1 ships and budget returns under 49k. |
| **AI #2 merge-blockers** | Folded into Phase 1 housekeeping above (state-default, migration safety, lint regressions, test coverage, intent-router doc). PR #29 already shipped as 1.14.0; these are 1.15.0 fixes, not retro-blockers. |
| **AI #3 ship-before-next-feature trio** | All three in Phase 1: README rewrite (1), chat-history split (2 — Phase 2 ADR + Phase 3 implementation), `update_counts.py` enforced (3 — Phase 1). |
| **AI #4 P1 — UI-track 1-page mental model** | **In Phase 1.** Single `docs/ui-track-mental-model.md` answering: when UI? when ui-trivial? when mixed? what must the agent never do? where does it stop? Linked from README. |

### Out of scope (confirmed)

- New rules / skills / commands until budget + matrix land.
- Persona layer, stakeholder skills (sibling roadmap).
- MCP server (sibling roadmap).
- OSS marketing push (sibling roadmap; identity = OSS-light governed alternative,
  locked in `road-to-governance-cleanup.md`).

**Phase 1 (housekeeping 1.15.0) is approved for execution.**
Phase 2 unlocks once Phase 1 ships green CI and an updated counter table.

## Sources (append per AI)

| # | Source / model | Date | Scope | Status |
|---|---|---|---|---|
| 1 | AI #1 (senior-staff / product-architect review) | 2026-05-01 | Final review of PR #29 + new rules (`autonomous-execution`, `commit-policy`, `/commit-in-chunks`, `scope-control`) — scored across product / vision / architecture / behavior axes | Captured below |
| 2 | AI #2 (merge-readiness / code-review hat) | 2026-05-01 | Concrete merge-blocker review of PR #29 — CI status, state-file defaults, migration backup safety, intent-router gap, chat-history invasiveness, lint regressions | Captured below |
| 3 | AI #3 (1.14.0 release retrospective hat) | 2026-05-01 | Full 1.14.0 release retrospective — 8 named problems, 3 refactorings, 4 missing artefacts, README/identity drift, chat-history 12-iteration signal, telemetry-without-users critique | Captured below |
| 4 | AI #4 (1.14.0 maturity / consolidation hat) | 2026-05-01 | 6-axis score table + P0/P1/P2 refactor list — README ↔ Engine positioning contradiction, `docs/architecture.md` counter drift, packaging bug (`agents/` excluded but README links into it), `cli.py` modularisation, UI-track onboarding, rule-interaction matrix as artefact | Captured below |

## Raw feedback — AI #1

### Overall scoring

| Dimension | Score |
|---|---:|
| Product (today, real) | 9.5 / 10 |
| Product (with roadmap delivered) | 9.8 / 10 |
| Vision fit | 9.4 / 10 |
| Architecture quality | 9.7 / 10 |
| Rule / behavior system | 9.3 / 10 |

### What PR #29 changed (positively, called out explicitly)

1. **Tool → execution system.** `work_engine` is *the* runtime, not a refactor.
   Biggest correct move in the repo.
2. **Golden transcripts + replay.** GT-1..GT-5, GT-P1.., byte-equal replay,
   freeze-guard in CI, deterministic execution. *Production-grade reliability
   thinking, rare in AI tooling.*
3. **Prompt-driven `/work`.** Unstructured-entry sibling to `/implement-ticket`
   makes the system universally usable.
4. **WorkState v1.** Versioned state, migration, forward-compat, directive sets —
   "agent runtime infrastructure", not just tooling.
5. **Chat-history 3-gate hardening.** turn-check + append-refusal + heartbeat
   addresses silent failure / state drift "brutally well".
6. **Rules are now operationalised.** Guidelines → runtime behavior.

### Per-rule deep dive

| Rule | Strengths | Weaknesses | Score |
|---|---|---|---:|
| `autonomous-execution` | clear trivial-vs-blocking split · clean opt-in/opt-out · speech-act detection ("very strong") · autonomy bounded · integrated with scope-control. Agent feels notably more senior. | "too complex for LLMs without strong tests" · "trivial" is contextual ("fix 3 issues" — trivial or scope expansion?) · needs heuristics / scoring / examples long-term. | 9.0 |
| `commit-policy` | iron law "NEVER COMMIT. NEVER ASK." is "perfect" · clean exceptions · roadmap integration · independent of autonomy. "Extreme good UX + safety." | standing instructions could get tricky · memory ↔ commit interaction not fully thought through. | 9.5 |
| `/commit-in-chunks` | realistic (matches good-dev workflow) · no over-fragmentation · no pushes · fail-fast. "Production-ready command." | untracked-file handling soft · no conflict strategy on dirty states. | 9.2 |
| `scope-control` (with new tightening) | clear boundaries · no drift · git-ops cleanly gated · no release leaks in roadmaps. "Extremely important for trust." | sometimes too restrictive · depends heavily on `ask-when-uncertain` recognition quality. | 9.3 |

### What is now better than before

- Behavior is **more consistent** across the loop.
- Runtime is **real** (work_engine + dispatcher + state + golden tests).
- Failure modes are **actively addressed** (chat-history, commit safety, autonomy).
- Feels like a **product**, no longer a rule collection.

### What is still critical (open risks)

1. **Rule complexity is climbing** — many rules, many interactions, many edge
   cases → emergent misbehavior risk.
2. **Rule interactions are implicit, not explicit.** Examples flagged:
   - autonomy ↔ scope-control
   - memory ↔ decision-making
   - commit-policy ↔ roadmap
3. **Outcome is still unproven.** "Perfect architecture, no proven effect yet."
   This is named the *biggest* remaining gap.

### Meta-classification

- ✔ Engineering system — strong.
- ✔ Behavioral system — good.
- ✔ Runtime system — good.
- ❗ Outcome system — still weak.

### What NOT to add (explicit non-goals)

- No more rules.
- No more skills.
- No more architecture.

### What IS needed (AI #1 priority list, in order)

1. **"Holy shit" demos.** Mandatory. End-to-end, visible, undeniable.
2. **Rule-interaction tests** — e.g. `autonomy + scope-control + memory + verify
   → expected behavior?`. Currently no such matrix exists.
3. **Memory → visible-in-behavior.** User must perceive "the system gets better".
4. **Decision engine explicit.** Today implicit; future = explicit scoring +
   confidence + risk.

### Final framing (verbatim spirit)

> PR #29 is an **extremely strong foundation for a top-tier product**.
> The next step decides whether it actually becomes one.

Goal shift: not "looks correct" → **"reliably delivers"**.

### Offered next moves (AI #1, deferred — capture only)

- A concrete **test set for rules + flows** (rule-interaction matrix).
- **3 perfect demo scenarios at "holy shit" level**.

## Raw feedback — AI #2

**Stance:** "Don't merge PR #29 without follow-up fixes."

### Concrete merge blockers (named)

1. **CI status not proven.** PR claims `task test` / CI green, but the commit
   status surfaces no status checks. Bot also reports a lint regression and new
   rule warnings.
2. **State-file naming inconsistent.** Docs / command say `.work-state.json`,
   but `work_engine/cli.py` keeps `.implement-ticket-state.json` as the default.
   Consumers who forget `--state-file` keep using the old file silently.
3. **Migration can clobber existing backups.** `migrate_file()` refuses to
   overwrite `.work-state.json`, but the backup step blindly moves to
   `.implement-ticket-state.json.bak`. If that file already exists →
   overwrite / platform-dependent error.
4. **`/work` uses backend directive-set for prompt-work.** `backend` now
   accepts both `ticket` and `prompt`, but blocks UI prompts later inside
   `refine`. Tolerable interim, but semantically prompt-work is being treated
   as backend-work — risky until a real intent router exists.
5. **Chat-history rule is very invasive.** Requires `turn-check` as the
   first tool action and a heartbeat at the end of every reply. Technically
   solid, but pollutes agent replies and depends on correct tool execution.
   Settings modes (`on` / `off` / `hybrid`) exist but need clear docs +
   tests.

### Concrete fix list (verbatim, before merge)

- Make CI visibly green and surface status checks on the PR.
- Resolve lint warnings in `scope-control`, `autonomous-execution`,
  `commit-policy`, `direct-answers`.
- Change `DEFAULT_STATE_FILE` in `work_engine/cli.py` to `.work-state.json`,
  or document + test the legacy default deliberately.
- Make migration backup-safe: refuse to overwrite an existing `.bak`, e.g.
  rotate to `.bak.1` or hard-fail.
- Add explicit test for `./agent-config implement-ticket` without `--state-file`.
- Add explicit tests for `/work` with: UI prompt · medium prompt · resume ·
  pre-existing `.work-state.json`.
- Document chat-history heartbeat default + hybrid behavior clearly in
  README + AGENTS.

### Verdict

> Content is strong, but the PR is **too large** and carries multiple
> infrastructure risks. At minimum, **CI**, **state default**, **migration
> backup safety**, and **lint regression** should be merge blockers.

### Out-of-scope for AI #2 (not commented on)

- No persona / skill / orchestration view.
- No outcome / demo view.
- No memory / decision-engine view.
- No score table.

Treat as **merge-readiness input**, not strategic-direction input.

## Raw feedback — AI #3

**Stance:** Full 1.14.0 release retrospective — *"the package grew faster
than its self-documentation"*. Grade moves **A → A−**.

### What the release actually shipped (acknowledged strengths)

- **R1 fully complete** (all 7 phases). `implement_ticket/` → `work_engine/`,
  compatibility shim in place, state-schema v1 round-trip, golden transcripts
  CI-secured via replay-harness, `./agent-config migrate-state` registered.
- **R2 (Prompt-Driven Execution) shipped.** `/work` accepts stakeholder input
  without a Jira ticket. Confidence scoring, refine-dispatch on vague input,
  prompt envelope.
- **R3 fully complete.** UI-track with stack detection, `ui` /
  `ui-trivial` / `mixed` directive sets, high-confidence vs ambiguous-audit
  branching, reclassification, `react-shadcn-ui` skill, shadcn version
  mismatch halts.
- **R4 (Visual Review Loop) shipped.** A11y-gate on review step, preview-
  envelope render contract, a11y-ceiling golden transcripts. Stub → complete
  in one release.
- **Iron Law Prominence Linter** in CI — enforces that iron laws are
  *placed* prominently, not just *present*.
- **Telemetry with privacy gate.** Local JSONL, redaction validator, export
  gate, privacy contract documented, `telemetry:report` CLI, opt-in.
- **Cloud distribution.** T3-H artefact classification, bundle builder,
  cloud-release workflow attaching bundles to GitHub Releases, Linear-digest
  builder for three layers.
- **Command-suggestion frontmatter on all 75 commands.** Validated by
  linter, ADR-documented.

### Eight named problems (AI #3 verbatim)

1. **README counters demonstrably stale.** README shows `124 Skills · 46
   Rules · 73 Commands · 46 Guidelines`. Release added `react-shadcn-ui`
   (commit `305fb28` bumps to 128), `direct-answers` rule,
   `autonomous-execution` rule, `commit-policy` rule, `/commit-in-chunks`,
   `/work`. `update_counts.py` is not run on every commit — *governance gap*.
2. **Chat-history touched 12× in one release.** Iron Law · per-phase cadence
   · HOOK vs CHECKPOINT · heartbeat · heartbeat modes · turn-check gate ·
   append refusal · no-fake-marker clause · crash-recovery tests · platform
   bridges · git-hook fallback · Augment hooks via user-level settings ·
   ownership enforcement · roadmap archived. *Signal of incremental
   exploration, not upfront design.* 4–5 iterations would have been fine.
3. **The package no longer describes itself.** README still says "teach
   your AI agents Laravel, PHP, testing…" but 1.14.0 ships `/work`
   (stack-agnostic), UI-track with a11y, telemetry, cloud distribution,
   Linear-digest. "Built for PHP/Laravel teams" was correct in 2024;
   today it is incomplete.
4. **Telemetry without proven usage.** Architecture clean, but with **0
   external users** it measures only own development work. Effort (6
   commits, R6 roadmap, 25 tests) better invested in adoption.
5. **`work_engine/` vs `implement_ticket/` dualism.** Compatibility shim
   in place, but a fresh installer in 2026 sees both directories and asks
   why two engine namespaces exist. No `MIGRATION.md`, no prominent note
   in `docs/architecture.md`.
6. **Golden transcripts do not scale.** GT-1..GT-5 + GT-P1..GT-P4 +
   GT-U1..GT-U15 = **24 capture packs**. Freeze-guard CI must replay all
   of them. *Zero commits in this release address CI duration or
   parallelisation.* Becomes a problem when R5+ lands.
7. **`autonomous-execution` rule is conceptually under-documented.**
   "Intent-based opt-in" allows the agent to act autonomously when intent is
   recognised. Boundaries vs `security-sensitive-stop` and
   `minimal-safe-diff` not derivable from release notes. *A rule that
   permits autonomy without documented limits is a potential safety issue.*
   Needs an ADR.
8. **Four install paths are too many for 0 external users.** `docs/installation.md`
   now documents local (Composer/npm), plugin, cloud, Linear. Each path
   raises the chance consumers pick the wrong / broken one. Cloud and
   Linear are not battle-tested.

### Three named refactorings (AI #3 verbatim)

1. **README radical rewrite.** Engine, UI-track, telemetry, cloud-
   distribution are generic. Two-layer README needed: "Laravel quick-start"
   and "the engine for teams going deeper". Currently neither.
2. **Chat-history consolidation.** 12 patches signal redesign needed, not a
   13th commit. Split into two artefacts: a rule describing *behaviour*,
   and a separate doc / context describing *platform integration* (HOOK,
   CHECKPOINT, heartbeat, ownership, hooks, fallbacks).
3. **`update_counts.py` must be part of `task sync`, mandatory.** Guard
   that breaks the build when counts drift. The script exists; it just
   is not enforced.

### Four named gaps (AI #3 verbatim)

1. **External feedback system.** Telemetry without users measures self.
   Need an issue template "which skill did not trigger?", a discussions
   category "skill suggestions", a "did this help?" minimal UX. *The
   package cannot learn without external signal.*
2. **`MIGRATION.md` for `implement_ticket → work_engine`.** Existing users
   with `.implement-ticket-state.json` must be told to run
   `./agent-config migrate-state`. Not documented prominently anywhere.
3. **ADR for `autonomous-execution`.** Explicit safety analysis: which
   commands may the agent autonomously execute, what is *never* allowed
   without confirmation, how does it interact with `security-sensitive-stop`
   and `minimal-safe-diff`.
4. **CI performance budget.** 24 GT packs · freeze-guard · replay-harness
   · linters · schema-validation · portability-check · marketplace-drift-
   linter · iron-law-prominence-linter. Growing CI debt with zero
   measurement. *The technical debt that grows quietest.*

### Final framing (verbatim spirit)

> Engine is better than ever. The package no longer describes itself
> correctly. Chat-history is the most visible design problem (12 iterations
> = explored, not designed). The three named refactors are one-commit jobs
> with focus and should ship before the next feature release.

### Out-of-scope for AI #3 (not commented on)

- No persona / skill catalogue view.
- No outcome / demo view (orthogonal to AI #1).
- No score table per rule (orthogonal to AI #1).
- No reviewer-suggestion / orchestration-DSL view.

## Raw feedback — AI #4

**Stance:** 1.14.0 is *"no longer a toy"*, but has a clear **maturity
problem**: product surface grows faster than its architecture / packaging
narrative. **Next step is consolidation, not expansion.**

### Score table (verbatim, 6 axes)

| Axis | Score |
|---|---:|
| Product impact | **9.2 / 10** |
| Architecture / maintainability | **8.4 / 10** |
| Agent behaviour governance | **9.5 / 10** |
| Runtime / execution reality | **8.3 / 10** |
| Doc / packaging consistency | **7.4 / 10** |
| Vision-fit | **9.1 / 10** |

Aggregate verdicts:

- *As an AI delivery system:* **9.2 / 10**
- *As a clean, consistent release:* **8.2 / 10**
- *As foundation for a must-have product:* unambiguous yes.

### What is very good (acknowledged strengths)

- **`/implement-ticket` + `/work` are now a real product axis.** Not just
  skills — a *working mode*. `/work` is arguably more valuable than
  `/implement-ticket` because real stakeholders rarely formulate
  ticket-shaped input.
- **Product UI-track is genuine added value.** Audit-before-apply hard
  gate · trivial-UI hard limits · mixed-flow separates contract / UI /
  stitching · a11y has priority over subjective polish-ceiling.
- **Safety layer matured.** `autonomous-execution` correctly delegates
  the hard floor to `non-destructive-by-default`. The hard floor itself
  is "exactly the kind of safety logic agents need".
- **Golden Replay / CI / maintainer discipline.** The Taskfile shows a
  very wide quality layer: golden replay, schema validation, cloud-
  bundle gates, Linear digest, iron-law-prominence, reply-consistency,
  memory checks, runtime E2E, count checks. *"You're testing not just
  code but behaviour contracts."*
- **Memory better integrated.** Optional npm peer + Composer suggest —
  no hard coupling, clear extensibility.

### Critical findings (named, in priority order)

1. **README says "not a runtime", product describes an "Engine".**
   README explicitly: *"agent-config is not a runtime; agent loop, LLM
   dispatcher, tool orchestration stay with the host tool."* Same README
   describes `/implement-ticket`, `/work`, product UI-track, directive
   sets, engine actions, the full `refine → memory → analyze → plan →
   implement → test → verify → report` chain. Work Engine CLI itself
   says it edits no code, runs no tests, opens no PRs — it dispatches
   via `@agent-directive` markers. *Not wrong, but positioning is
   unclear.* **Refactor framing:** `agent-config` is not a runtime, but
   it ships a deterministic **orchestration contract / delivery
   protocol / state machine** for host agents.
2. **`docs/architecture.md` is out of sync.** Lists 93 Skills · 31 Rules
   · 51 Commands · 34 Guidelines. README + AGENTS say 128 / 53 / 77 / 46.
   *"For a governance package, this is a real problem. You're selling
   consistency, but a core doc is desynchronised."* **Must be fixed,
   immediately.** (Concrete extension of AI #3's `update_counts.py`-not-
   enforced theme: counter drift now reaches `docs/architecture.md`,
   not just README.)
3. **Packaging bug — likely the most concrete defect.** `package.json`
   does **not** include `agents/` in `files`. `composer.json` *explicitly
   excludes* `/agents` from the archive. README repeatedly links to
   `agents/contexts/agent-memory-contract.md`, `…/implement-ticket-flow.md`,
   `…/ui-track-flow.md`, `…/artifact-engagement-flow.md`,
   `…/command-suggestion-flow.md`. **Installed npm / Composer packages
   have broken README links.** *Real release-quality bug.* Three
   options: (a) ship `agents/contexts` in the package; (b) move public
   contracts to `docs/contracts/`; (c) only link to files actually
   shipped. **AI #4 recommendation: `docs/contracts/` for public,
   `agents/` internal-only.**
4. **Surface size is now very large.** 128 skills · 53 rules · 77
   commands · 46 guidelines · personas · memory · work engine · UI track
   · cloud bundles · Linear digest · command suggestions · telemetry.
   *The danger isn't "too many files" — the danger is contradictory
   rules, too many entry points, unclear priorities, agents loading the
   wrong guidance, users not knowing what to use first.* **You need
   consolidation, not expansion.** (Strongly aligns with AI #1 "stop
   adding rules / skills / architecture".)
5. **Work Engine code is good, but `cli.py` is at the limit.** Ticket
   · prompt · diff · file · personas · hooks · v0/v1 state · migration
   · directive-set routing · UI routing · chat-history hooks · resolvers
   · state sync · format-preserving save — all in one file. Refactor:
   split into `cli_args.py` · `state_io.py` · `input_builders.py` ·
   `hook_bootstrap.py` · `runner.py` · `emitters.py`; keep `cli.py` as
   orchestration glue.
6. **UI Track is strong but very dense.** Audit · design · apply ·
   review · a11y · preview · polish · token extraction · mixed contract
   · stitching · trivial reclassification. Good for maintainers, hard
   for new contributors *and* agents. **Missing:** a 1-page "UI Track
   Quick Mental Model" — when UI? when ui-trivial? when mixed? what must
   the agent never do? where does it stop?
7. **"Experimental modules" framing is stale.** README still describes
   runtime as experimental with two pilot skills in CI, while the same
   README presents Work Engine + `/implement-ticket` + `/work` + UI
   track as the product core. **Term separation needed:**
   `runtime_dispatcher.py` = experimental shell-skill runner ·
   `work_engine` = shipped orchestration protocol · tool adapters =
   experimental · host execution = external.

### Refactor list (P0 / P1 / P2, verbatim priority)

**P0 — immediately:**

1. Fix the packaging-link bug (ship `agents/contexts` or move public
   contracts to `docs/contracts/`).
2. Synchronise `docs/architecture.md` (counts + layer model) to 1.14.0.
3. Clarify terms: runtime dispatcher (old) · Work Engine (shipped
   orchestration / state contract) · host agent · tool adapters.

**P1 — very important:**

4. Split `work_engine/cli.py` into the 6 sub-files above.
5. Simplify UI-track onboarding — one-page mental model.
6. Build a **rule-interaction matrix** as a *visual + machine-readable*
   artefact. Named rules: `autonomous-execution` ·
   `non-destructive-by-default` · `scope-control` · `commit-policy` ·
   `ask-when-uncertain` · `verify-before-complete`.
   `non-destructive-by-default` is the explicit top priority.
   (Direct extension of AI #1's "rule-interaction matrix" theme — same
   ask, but AI #4 specifies the *form*.)

**P2 — after that:**

7. Public **demo cases** — backend ticket · `/work` free-form ·
   UI track · mixed flow. Concrete before/after reports, not contracts.
   (Aligns with AI #1's "3 holy-shit demos".)
8. **Outcome telemetry on real usage** — extend beyond "which artefacts
   were used" to: where was the agent blocked? · where was memory
   decision-relevant? · which directive sets fail? · how often is
   verification partial? · which rules trigger stops? (Direct extension
   of AI #3's "telemetry without users" critique: re-aim telemetry at
   *behavioural outcomes*, not artefact-engagement counts.)

### Still-missing (named gaps)

- **Proof of real-world impact.** Without real cases, the package stays
  "impressive"; with them, "indispensable".
- **Product simplification.** README is now very long; needs a
  30-second story plus deep dives. (Cross-references AI #3 README-
  rewrite refactor.)
- **Public Contract API in `docs/contracts/`.** If `agents/contexts/`
  stays internal, the public-facing contracts need a stable home.
- **Stability statement on the Work Engine.** Is it stable / beta /
  experimental? Must be made explicit.

### Final framing (verbatim spirit)

> 1.14.0 is extremely strong but not flawless. The biggest mismatch is
> that product story, architecture doc, and package structure are no
> longer fully synchronised — exactly what happens when a product
> matures faster than its docs and packaging. The next big step should
> not be more feature build-out, but: **consolidate, clarify terms, fix
> packaging, modularise Work Engine, show real demos.**

### Out-of-scope for AI #4 (not commented on)

- No persona / skill-depth view (orthogonal to better-skills roadmap).
- No 6-month sequencing / ICE scoring.
- No memory-internal-architecture view.
- No specific commit-by-commit verdict on the chat-history history
  (treats chat-history as part of "surface size + consolidation needed",
  not a 12-iteration design call like AI #3).

## Synthesized themes (updated as feedback accumulates)

| Theme | Source(s) | Confidence | Notes |
|---|---|---|---|
| Outcome / real-world proof is the #1 remaining gap | AI #1, AI #4 | **medium** (cross-source, same ask) | AI #1: "perfect architecture, no proven effect yet". AI #4: "without real cases, the package stays *impressive*; with them, *indispensable*". Drives demand for demos + outcome-telemetry on real usage. |
| Rule-interaction matrix is missing | AI #1, AI #4 | **medium** (cross-source, AI #4 specifies form) | AI #1: pairwise / triple interactions implicit; concrete pairs autonomy↔scope · memory↔decisions · commit↔roadmap. AI #4: build it as a *visual + machine-readable* artefact; named rules: `autonomous-execution` · `non-destructive-by-default` · `scope-control` · `commit-policy` · `ask-when-uncertain` · `verify-before-complete`; `non-destructive-by-default` is explicit top priority. |
| Rule complexity is climbing — emergent misbehavior risk | AI #1, AI #2, AI #3 | **high** (3-source agreement, abstract + concrete + pattern) | AI #1: abstract risk. AI #2: concrete evidence — lint regressions in `scope-control`, `autonomous-execution`, `commit-policy`, `direct-answers` shipped in PR #29. AI #3: pattern evidence — `chat-history` rule edited 12× in a single release. Three independent failure shapes pointing at the same root cause: rules are being explored, not designed. |
| "Holy shit" / public demo cases are mandatory next step | AI #1, AI #4 | **medium** (cross-source, AI #4 names the four scenarios) | AI #1: 3 end-to-end "holy shit" scenarios. AI #4 (P2): four concrete cases — backend ticket · `/work` free-form · UI track · mixed flow; "concrete before/after reports, not contracts". |
| Memory must become visible in behavior | AI #1 | low (single source) | Today memory exists but isn't perceived. Tied to outcome gap. |
| Decision engine should become explicit (scoring / confidence / risk) | AI #1 | low (single source) | Today implicit. AI #1 frames as future direction, not immediate work. |
| `autonomous-execution` needs ADR + safety boundaries (heuristics + interaction with `security-sensitive-stop` / `minimal-safe-diff`) | AI #1, AI #3 | **medium** (cross-source, both naming the artefact gap) | AI #1: heuristics for trivial edge cases ("fix 3 issues" class). AI #3: full ADR — which commands may run autonomously, what is *never* allowed, how does it interact with safety rules. Both want the same artefact; AI #3 frames it as a safety issue, not just UX. |
| `commit-policy` × memory interaction underspecified | AI #1 | low (single source) | Standing-instruction lifecycle. |
| `/commit-in-chunks` untracked-file + dirty-state handling soft | AI #1 | low (single source) | Concrete-fixable, smallest item on the list. |
| `scope-control` may be over-restrictive without strong `ask-when-uncertain` | AI #1 | low (single source) | Coupling risk — both rules need to evolve in lockstep. |
| **Stop adding rules / skills / architecture — consolidate, don't expand** | AI #1, AI #4 | **medium** (cross-source, identical conclusion from independent angles) | AI #1: iron non-goal — no new rules / skills / architecture. AI #4: surface size (128 / 53 / 77 / 46 + personas + memory + engine + UI track + cloud bundles + Linear digest + suggestions + telemetry) is now the danger; "you need consolidation, not expansion". Pruning install paths *is* consolidation, not expansion — no conflict. |
| PR #29 is too large to merge cleanly | AI #2 | low (single source, but concrete) | "Content is strong, but the PR is too large and carries multiple infrastructure risks." Merge-blocker framing. |
| CI status not visibly green on PR #29 | AI #2 | low (single source, verifiable) | PR claims `task test` green, but commit status surfaces no checks. Easy to verify; if true, it is a merge blocker, not a roadmap item. |
| State-file naming inconsistency: `.work-state.json` vs `.implement-ticket-state.json` (CLI default) | AI #2 | low (single source, verifiable) | Docs / `/work` say `.work-state.json`; `work_engine/cli.py` `DEFAULT_STATE_FILE` still legacy. Silent-fallback risk for consumers. |
| Migration backup is not collision-safe | AI #2 | low (single source, verifiable) | `.implement-ticket-state.json.bak` overwritten if pre-existing. Fix: rotate to `.bak.1` or hard-fail. |
| `/work` semantically routes prompts through `backend` directive-set | AI #1 (implied via "decision engine"), AI #2 (concrete) | low → **medium** (concrete + thematic alignment) | AI #2: `backend` accepts both `ticket` and `prompt`, blocks UI prompts inside `refine`. Tolerable interim — risk persists until a real intent router exists. Aligns with AI #1's "decision engine should become explicit". |
| Chat-history rule needs structural redesign, not patching | AI #2, AI #3 | **medium → high** (cross-source, distinct angles) | AI #2: invasiveness — `turn-check` + heartbeat-last-line is hard, doc/test coverage thin. AI #3: 12 iterations in one release ⇒ explored not designed; refactor proposal: split into a behaviour rule + a separate platform-integration context (HOOK / CHECKPOINT / heartbeat / ownership / hooks / fallbacks). The 13th patch is the wrong move. |
| Lint regressions shipped in PR #29 (`scope-control`, `autonomous-execution`, `commit-policy`, `direct-answers`) | AI #2 | low (single source, verifiable) | Concrete fixable. Already folded into "rule complexity climbing" as evidence; tracked separately for the merge-readiness checklist. |
| Test coverage gaps for new flows | AI #2 | low (single source) | Named: `implement-ticket` without `--state-file`; `/work` UI-prompt + medium-prompt + resume + pre-existing `.work-state.json`. |
| Counter drift across README *and* `docs/architecture.md`; `update_counts.py` not enforced | AI #3, AI #4 | **medium** (cross-source, AI #4 widens scope to architecture.md) | AI #3: README shows `124/46/73/46`; release added `react-shadcn-ui` (→128), `direct-answers`, `autonomous-execution`, `commit-policy`, `/commit-in-chunks`, `/work`. AI #4: `docs/architecture.md` still lists `93/31/51/34` — even further out of date. Refactor: make `update_counts.py` mandatory in `task sync`, with a build-breaking guard that covers *all* counter surfaces (README, AGENTS, architecture.md). One-commit fix. |
| README / package identity drift — "not a runtime" vs "Engine" / "Laravel team" vs stack-agnostic | AI #3, AI #4 | **medium → high** (cross-source, distinct angles converging) | AI #3: "Laravel/PHP teams" no longer matches what 1.14.0 ships (`/work` stack-agnostic, UI-track + telemetry + cloud + Linear-digest generic). AI #4: positioning contradiction — README explicitly says *"not a runtime; agent loop / LLM dispatcher / tool orchestration stay with host tool"*, while same README describes `/implement-ticket`, `/work`, UI track, directive sets, engine actions, the `refine→…→report` chain. Both want a re-framing. AI #4 proposes the form: *"`agent-config` is not a runtime, but it ships a deterministic orchestration contract / delivery protocol / state machine for host agents"*. |
| `work_engine/` vs `implement_ticket/` dualism — no `MIGRATION.md` | AI #2, AI #3 | low → **medium** (cross-source, same root: state-default and engine-namespace clarity) | AI #2: silent-fallback risk via `DEFAULT_STATE_FILE`. AI #3: dualism is visible to fresh installers; needs `MIGRATION.md` + prominent note in `docs/architecture.md`. Both point at "consumers don't know which path is current". |
| Telemetry mis-aimed — artefact-engagement counts ≠ outcome signal | AI #3, AI #4 | **medium** (cross-source, AI #4 reframes the *what*) | AI #3: telemetry without external users measures only own dev work — the architecture is clean, the audience doesn't exist yet. AI #4: even with users, "which artefacts were used" is the wrong question; re-aim at *behavioural outcomes* — where was the agent blocked? · where was memory decision-relevant? · which directive sets fail? · how often is verification partial? · which rules trigger stops? Pairs with the missing-external-feedback gap below. |
| External feedback system missing — package cannot learn without external signal | AI #3 | low (single source) | Need: issue template "which skill did not trigger?", discussions category "skill suggestions", "did this help?" minimal UX. Telemetry-as-internal-mirror is the symptom, missing-feedback-loop is the cause. |
| Golden Transcripts CI cost not measured / parallelised | AI #3 | low (single source) | 24 capture packs (GT-1..5 + GT-P1..4 + GT-U1..15) replayed by freeze-guard. Zero commits in 1.14.0 address CI duration or parallelisation. AI #3: "the technical debt that grows quietest". Becomes blocking when R5+ lands. |
| Four install paths for 0 external users | AI #3 | low (single source) | `docs/installation.md`: local (Composer/npm) · plugin · cloud · Linear. AI #3: pruning / staging recommended; cloud + Linear not battle-tested. Tension with the "stop adding architecture" iron rule from AI #1. |
| **Packaging bug — README links to `agents/contexts/` but `agents/` is excluded from npm + Composer artefacts** | AI #4 | low (single source, verifiable, **release-quality bug**) | `package.json` does not include `agents/` in `files`; `composer.json` explicitly excludes `/agents` from the archive. README links into `agents/contexts/agent-memory-contract.md`, `…/implement-ticket-flow.md`, `…/ui-track-flow.md`, `…/artifact-engagement-flow.md`, `…/command-suggestion-flow.md`. Installed packages have **broken README links**. Three options: (a) ship `agents/contexts` in package; (b) move public contracts to `docs/contracts/`; (c) only link to files that actually ship. AI #4 recommendation: **(b)** — `docs/contracts/` for public, `agents/` internal-only. |
| `work_engine/cli.py` is at the complexity limit — modularise | AI #4 | low (single source, concrete refactor named) | One file currently owns: ticket · prompt · diff · file · personas · hooks · v0/v1 state · migration · directive-set routing · UI routing · chat-history hooks · resolvers · state sync · format-preserving save. Split into `cli_args.py` · `state_io.py` · `input_builders.py` · `hook_bootstrap.py` · `runner.py` · `emitters.py`; keep `cli.py` as orchestration glue. P1, not P0. |
| UI-track onboarding density — missing 1-page mental model | AI #4 | low (single source) | UI contract is "fachlich gut, aber schwer für neue Contributor und Agenten". Audit · design · apply · review · a11y · preview · polish · token extraction · mixed contract · stitching · trivial reclassification all in one contract. Needed: 1-page "UI Track Quick Mental Model" — when UI? when ui-trivial? when mixed? what must the agent never do? where does it stop? P1. |
| "Experimental modules" framing is stale; term separation needed | AI #4 | low (single source) | README still describes runtime as experimental (two pilot skills in CI), while same README presents Work Engine + `/implement-ticket` + `/work` + UI track as product core. AI #4: separate `runtime_dispatcher.py` (experimental shell-skill runner) from `work_engine` (shipped orchestration protocol) from tool adapters (experimental) from host execution (external). P0 (part of "clarify terms" alongside packaging fix and architecture.md sync). |
| Stability statement on Work Engine missing | AI #4 | low (single source) | Is the Work Engine stable, beta, or experimental? Must be made explicit. Affects how consumers read upgrade guarantees and breaking-change risk. Pairs with the term-separation theme above. |
| Public Contract API needs a stable home (`docs/contracts/`) | AI #4 | low (single source, but flows from packaging bug) | If `agents/contexts/` stays internal-only (AI #4's preferred packaging fix), the public-facing contracts (memory, implement-ticket flow, UI-track flow, artifact-engagement, command-suggestion) need a stable shipped location. Implies: redirect README links + freeze public contract files. |

## Open questions for the user

> **Resolved 2026-05-01.** All items below were answered in the
> "Decisions (synthesized)" section near the top of this file. Kept here
> as historical context for the synthesis trail.

- **Demo-track scope:** is "3 holy-shit demos" a roadmap deliverable, or a
  marketing artefact (and therefore out of this roadmap)?
- **Rule-interaction matrix:** new test directory under `tests/`, or an
  extension of the golden-transcript harness?
- **Decision engine "explicit":** is this a research line (ADR + spike) or a
  block to schedule?
- **Memory-visibility:** what is the surface — heartbeat-style line, dedicated
  command (`/memory-impact`), or implicit via session summaries?
- **Stop-growing iron rule:** elevate to a project-level meta-policy, or keep
  as situational guidance from this roadmap?
- **AI #2 merge-blockers vs. post-merge follow-ups:** PR #29 is already
  released as 1.14.0 (this roadmap is post-merge). Do AI #2's "blockers"
  become a 1.14.1 hotfix track, a 1.15.0 cleanup, or get folded into the
  general optimize backlog? Per item: CI green-status (post-hoc verify),
  state-file default (breaking-change consideration), migration backup
  (still actionable), lint regressions (any version), `/work` intent-router
  (larger design line). Some may already be fixed since 1.14.0 — verify
  before scheduling.
- **AI #3 "ship before next feature release" trio:** README rewrite ·
  chat-history split · `update_counts.py` enforced. AI #3 calls these
  one-commit jobs. Do they form a 1.14.1 / 1.15.0 *housekeeping release*
  before the next track (R5+) opens, or do they get interleaved with
  feature work? Decision affects roadmap sequencing.
- **Identity / README scope:** does the README rewrite stay
  Laravel-first-with-engine-second (current audience), or flip to
  engine-first-with-Laravel-as-flagship-stack (matches what 1.14.0
  actually ships)? Affects positioning, install funnel, and which
  audience the next release optimises for.
- **Chat-history redesign authority:** if AI #3's "split into behaviour
  rule + platform-integration context" is accepted, who owns the
  redesign? It crosses `chat-history.md` rule, hooks layer, settings
  schema, and at least 3 docs. A spike + ADR before the 13th patch.
- **Telemetry pause vs. external-feedback build-out:** does R6 stay live
  while no external users exist, or pause until consumers exist? Pairs
  with: do we *first* invest in adoption / external feedback (issue
  templates, discussions, "did this help?" UX) before the telemetry
  measurement makes sense?
- **Install-path pruning:** are 4 install paths sustainable at 0 external
  users? AI #3 implies cloud + Linear should be marked experimental /
  staged until evidence of real use. Tension with AI #1's "stop adding
  architecture" iron rule — pruning *is* removing surface, not adding it.
- **CI performance budget:** introduce an explicit time budget for the
  freeze-guard / replay-harness now (before R5 lands), or reactively
  when it hurts? AI #3 calls this "the debt that grows quietest".
- **Packaging fix path (AI #4 P0):** of the three options — (a) ship
  `agents/contexts` in npm + Composer; (b) move public contracts to
  `docs/contracts/` and keep `agents/` internal; (c) only link to files
  actually shipped — which is the chosen direction? AI #4 recommends (b),
  but (a) is the smallest diff. Decision determines the shape of the
  P0 housekeeping release.
- **Positioning framing (AI #4 P0):** adopt *"`agent-config` is not a
  runtime, but it ships a deterministic orchestration contract / state
  machine for host agents"* as the official positioning sentence — yes
  / no? Affects README rewrite, AGENTS.md, `docs/architecture.md`, and
  the marketing surface in one stroke.
- **Work Engine stability label (AI #4):** stable · beta · experimental?
  Required for the README rewrite and for any consumer who reads
  upgrade-guarantee language. Separates `work_engine` (likely beta or
  stable) from `runtime_dispatcher.py` (clearly experimental) and tool
  adapters (clearly experimental).
- **`work_engine/cli.py` modularisation timing (AI #4 P1):** ship as a
  follow-up to the P0 housekeeping release, interleave with R5+ feature
  work, or hold until the next major refactor window? The split is
  named (`cli_args` · `state_io` · `input_builders` · `hook_bootstrap`
  · `runner` · `emitters`) — implementation effort is bounded.
- **Outcome-telemetry redesign (AI #4 P2):** replace artefact-engagement
  counts with behavioural-outcome metrics (blocks · memory-relevance ·
  directive-set failures · partial-verifications · stop-rules), or run
  both in parallel? Pairs with the telemetry-pause question above —
  if R6 stays live, the redesign is the better answer than pausing.
- **Rule-interaction matrix as deliverable form (AI #4 P1):** AI #1
  asks for the matrix; AI #4 specifies *visual + machine-readable*.
  Concrete shape: a YAML / JSON file consumed by a linter, or a
  rendered diagram in `docs/`, or both? `non-destructive-by-default`
  is the unambiguous top priority — that anchors the matrix.

## Proposed actions

> See "Decisions (synthesized)" near the top of this file. Phase 1
> (housekeeping 1.15.0) is the active execution slice; Phase 2 unlocks
> after Phase 1 ships green CI.

## Risk register

> Per-source risk captures remain in the AI feedback blocks above.
> Consolidated forward-looking risk lives inside each Phase 2 row of
> the Decisions section (CI budget, modularisation behaviour-equiv,
> chat-history split scope).

## Next step

> Phase 1 P0 items are queued. Start with the packaging fix
> (`docs/contracts/`), positioning sentence, counter-drift guard,
> and term-separation in README + `docs/architecture.md`.
