---
complexity: structural
---

# Roadmap: Autonomous roadmap execution

> Make `/roadmap:process-full` run to completion without interruptions: capture the desired execution mode ONCE at roadmap creation, convert it into a single run-start "execution contract" confirmation that pre-authorizes everything a run legitimately needs (branch, commits, push to the run's own feature branch, PR-open, batched artifact drafting, council-on), and keep only the five irreducible safety floors as halt conditions.

## Context

Audit finding (2026-07-05): the process loop (`src/agent-src/contexts/execution/roadmap-process-loop.md`) has ~17 halt/ask points. Five are legitimate safety floors (Hard Floor push/prod/bulk-delete, context-hygiene read-loop abort, N=3 validation budget, security-sensitive-stop, deferred-items archival gate). The rest is friction with no per-roadmap lever:

- `scope-control` git-ops: a step needing a branch/PR halts the run; not pre-authorizable today.
- `artifact-drafting-protocol`: every step that authors a skill/rule/command/guideline runs a 3-phase interactive flow — in this repo that is most steps.
- Council-off + open question → halt; council enablement is not part of the roadmap contract.
- Roadmap frontmatter today carries only `status` / `complexity` / `parent_roadmap` — no execution policy; `/roadmap:create` never asks how the roadmap should be executed.

## Council notes

Council debate (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2026-07-05, 2 rounds, converged):

- **Minimal frontmatter, not a permissions DSL.** Frontmatter carries only `execution.mode: autonomous | phase-checkpoints | interactive` — a declaration of intent. Permissions encoded in YAML weeks ago are neither "this-turn" nor "standing conversational permission"; a rich `git:`/`artifact_protocol:` block would be stale-prone false precision.
- **Run-start execution contract is the authorization.** Invoking `/roadmap:process-*` is a this-turn action; an enhanced pre-scan derives everything (branch name, commit count, push target, artifact batch, council need), surfaces ONE summary, and the user's single confirmation converts the declared mode into this-turn grants cached for the run. This extends the existing commit-pre-scan precedent (loop §3).
- **Never `artifact_protocol: skip`.** Overlap detection must run against CURRENT artifact state (serial-roadmap counter-example: authoring-time checks cannot see artifacts a sibling roadmap creates later). Instead: batch the Research/overlap pass at run start, cache the approval, run drafting phases non-interactively during the run.
- **Push boundary:** run-start grant covers push to the run's OWN feature branch only; push anywhere else stays Hard Floor; merge is always conversational, never autonomous.
- **Definition of done (autonomous run):** all steps `[x]`, quality green per cadence, committed in chunks on the feature branch, pushed, PR open — stop before merge.
- Follow-up roadmaps inherit the parent's mode as a suggested default but re-prompt at creation.

## Constraints

- The five safety floors stay untouched: per-commit Hard-Floor diff check, context-hygiene aborts, N=3 budget, security-sensitive-stop, deferred-`[~]` archival gate.
- Kernel rules (`scope-control`, `commit-policy`, `non-destructive-by-default`) get at most a pointer sentence; the actual carve-out mechanics land in `src/agent-src/contexts/authority/scope-mechanics.md` and the loop context — kernel-rule edits require their own PR + 24h soak, so keep them minimal and last.
- Host-portable: prose loop + deterministic linters only, no runtime daemon.
- Edit `src/` only; regenerate projections via the condensation pipeline.

## Phase 1: Execution-mode declaration (schema + creation flow)

- [x] **Step 1:** Add the `execution.mode` frontmatter field (`autonomous` | `phase-checkpoints` | `interactive`; absent = `interactive`, today's behavior) to the roadmap template `src/agent-src/templates/roadmaps.md` — field semantics, the three modes, and an explicit "declaration of intent, not a permission grant" note. Verify: template renders the field with all three values documented.
- [x] **Step 2:** Extend `/roadmap:create` (`src/domains/product-basic/roadmap/create/command.md`): after the review loop and before the hard stop, ask ONE numbered-options question — "How should this roadmap be executed?" (1. fully autonomous, 2. checkpoint at phase boundaries, 3. interactive) — write the answer to frontmatter. Follow-up roadmaps (`parent_roadmap` set) pre-select the parent's mode as the recommended option but still ask. The step must NOT weaken the existing "CREATE = ARTIFACT ONLY, never offer execution" hard stop. Verify: command file shows the question inserted before step 9 and the hard stop unchanged.
- [x] **Step 3:** Teach the field to `src/skills/roadmap-writing/SKILL.md` and `src/skills/roadmap-management/SKILL.md` (authoring guidance + closure-table note that mode never affects archival semantics). Verify: both skills document the field; grep for `execution.mode` hits both.
- [x] **Step 4:** Add deterministic validation: extend the roadmap frontmatter lint (wherever `status`/`complexity` are validated — locate via `rg "complexity" src/scripts/ src/agent-src/scripts/`) to reject unknown `execution.mode` values. Verify: lint run on a fixture with `execution.mode: bogus` exits non-zero; valid values pass.

## Phase 2: Run-start execution contract (loop §2/§3 rework)

- [x] **Step 5:** Extend the pre-scan in `src/agent-src/contexts/execution/roadmap-process-loop.md`: in addition to commit steps, detect (a) steps needing a branch/PR (git-shaped verbs), (b) artifact-authoring steps (new skill/rule/command/guideline), (c) steps with open questions / ambiguity markers. Verify: loop §3 text enumerates all four detection classes with examples. <!-- detection-class examples live in contexts/execution/roadmap-execution-contract.md §1, loaded by loop §3 -->
- [x] **Step 6:** Define the execution-contract summary block in the loop (mode, feature-branch name derived from the roadmap slug, planned commit shape, push target = own feature branch only, PR-open (never merge), artifact batch with overlap-check result, council enablement, plus the always-active safety floors listed verbatim). ONE confirmation activates all grants for the run; grants are cached exactly like the existing commit authorization. `mode: interactive` keeps today's behavior; `mode: phase-checkpoints` additionally halts at each phase boundary with a compact status + continue prompt. Verify: loop contains the contract template and a mode × gate decision table. <!-- template + mode table landed in contexts/execution/roadmap-execution-contract.md, referenced from loop §3, to respect the loop's size budget -->
- [x] **Step 7:** Wire the three wrappers (`src/domains/product-basic/roadmap/process-full/command.md`, `process-phase`, `process-step`) to read `execution.mode` and route through the contract; `process-step` needs no contract (single step, existing behavior). Verify: each wrapper cites the contract section; scope-delta table updated.
- [x] **Step 8:** Amend the halt-conditions block (loop §5) so that under an active contract the ONLY halts are the five safety floors + quality-red + contract-exceeding scope; "council off + ambiguity" is eliminated under `mode: autonomous` because the contract auto-enables council for the run (high_impact / user_required questions still escalate per `ask-when-uncertain`). Verify: §5 halt list updated; explicit sentence that the contract never lifts a Hard Floor.

## Phase 3: Gate re-wiring (artifact protocol, git-ops, council)

- [x] **Step 9:** Artifact-protocol batch mode: add a "roadmap-run batch" section to `src/rules/artifact-drafting-protocol.md` — when a run-start contract covers planned artifacts, the Research/overlap pass runs ONCE at run start against current state (results cached in the contract), and Understand/Draft phases execute non-interactively during the run; the protocol still fires interactively for any artifact NOT declared in the roadmap. Verify: rule documents the carve-out with the serial-roadmap rationale; no weakening for non-roadmap invocations.
- [x] **Step 10:** Git-ops carve-out in `src/agent-src/contexts/authority/scope-mechanics.md` (and a one-line pointer in `src/agent-src/contexts/authority/commit-mechanics.md`): an accepted execution contract IS standing conversational permission for (a) creating the run's feature branch, (b) chunked commits on it, (c) pushing to that branch only, (d) opening a PR — never merge, never push elsewhere, Hard-Floor diffs still gate per-commit. Verify: scope-mechanics section exists; kernel rule `scope-control` untouched except at most one pointer sentence (flagged for its own PR if needed).
- [x] **Step 11:** Council auto-enable: document in the loop that `mode: autonomous` + contract acceptance enables council resolution for in-run open questions for the duration of the run (respecting `ai-council` config; if no council configured, the contract summary must say so and in-run ambiguity falls back to halting — never silent guessing). Verify: loop text covers both council-available and council-absent paths.
- [x] **Step 12:** Definition-of-done: encode the autonomous end state in the loop §6 (all `[x]`, quality green, committed, pushed to feature branch, PR open via the existing description-only flow, archival sweep runs, merge explicitly out of scope). Verify: §6 shows the end-state checklist per mode.

## Phase 4: Docs, lint, and verification

- [x] **Step 13:** Update `src/config/agent-settings.template.yml` docs where roadmap keys are described: clarify precedence — per-roadmap `execution.mode` overrides nothing global except the interaction pattern of the run; global keys (`quality_cadence`, `dashboard_regen_cadence`, `skip_pre_run_gate`) keep their meaning. Verify: template comments name the precedence explicitly.
- [x] **Step 14:** Add an authoring-time warning to `/roadmap:create` and the roadmap lint: a roadmap created with `mode: autonomous` that already contains `[~]` deferred items or vague steps (matches the `ask-when-uncertain` vague-trigger patterns) gets a lint warning at authoring time — vagueness is resolved when it is cheap, not mid-run. Verify: lint fixture with a vague step + autonomous mode warns; precise steps pass.
- [x] **Step 15:** Fixture dry-run: create a throwaway fixture roadmap (`mode: autonomous`, 2 phases, one artifact-authoring step, one commit step) under a test path, walk `/roadmap:process-full` far enough to confirm: one contract prompt, zero further asks until a safety floor, correct flip cadence. Record the transcript-level result inline in this step. Verify: dry-run notes cite zero non-floor interruptions. <!-- dry-run 2026-07-05: fixture lints green, zero authoring warnings; loop trace = §2 inline (no wait) → §3 contract detects commit step + artifact step + delivery need → ONE Accept → §5 steps run with per-step flip+regen, commit under grant (Hard-Floor diff gate evaluated per commit), phase boundary silent → §6 DoD push-own-branch + PR-open. Non-floor interruptions: 0 after Accept. Finding fixed in-run: §5b flip-guard used `git diff` which is blind to untracked roadmap files (fresh-worktree case) → switched to `git status --porcelain` with honest caveat -->
- [x] **Step 16:** Run the condensation + targeted lints for every touched file (condense pipeline for changed `src/` files, roadmap lint, frontmatter validation) and confirm green; update `docs/customization.md` with a short "autonomous roadmap execution" section. Verify: targeted lint output green; customization section present. <!-- 2026-07-05: condense --sync + per-file dist condensation + --mark-done → --check-hashes exit 0; generate-tools green; check-refs green; check-condensed-paths exit 0; check-token-regression green (+0.1% max); lint_roadmap_complexity green for all touched files. Two PRE-EXISTING reds on main, untouched by this branch: ADR-107 umlaut (check-md-language) + road-to-py2ts-teardown-completion.md missing complexity frontmatter -->

## Acceptance criteria

- A roadmap created via `/roadmap:create` carries an explicit `execution.mode`, chosen by the user in one question.
- `/roadmap:process-full` on a `mode: autonomous` roadmap asks exactly ONCE (the execution contract) and then runs to the defined end state (all `[x]`, quality green, pushed to its own feature branch, PR open) with no interruptions other than the five safety floors.
- No safety floor is weakened; merge remains conversational; the artifact-drafting protocol still runs its overlap check against current state (batched at run start).
