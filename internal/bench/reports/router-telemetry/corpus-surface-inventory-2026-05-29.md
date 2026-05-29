# Corpus-surface inventory — Phase 1 of `road-to-corpus-expansion-evidence-based-cuts`

**Generated:** 2026-05-29 · Phase 1 of `road-to-corpus-expansion-evidence-based-cuts`.
**Input:** the 20 never-matched tier-1 rules from `internal/bench/reports/router-telemetry/tier1-audit-2026-05-28.md`.
**Goal:** classify each rule as `addressable` (a real-shape corpus task can plausibly drive its triggers) or `state-bound` (the trigger needs runtime state no corpus prompt can carry).

> **Path note:** the roadmap specified `agents/roadmaps/_planning/` but
> the natural home for analysis artefacts of this kind is
> `internal/bench/reports/router-telemetry/` — consistent with
> `tier1-audit-2026-05-28.md`, `duplicate-triggers-2026-05-28.md`,
> etc. Linter sees both locations equally; the file is tracked so the
> Phase 2 corpus-author can reference it.

## Per-rule classification + task shape

`addressable: yes` rows ship a minimum-task shape (prompt + optional
`seed_files` / `command` / `open_files`). `addressable: no` rows carry
a one-sentence defence. Rules grouped by extension family for Phase 2.

### Family `git-surface` — `internal/bench/corpora/router-coverage/git-surface.yaml`

| # | Rule | Class | Min task shape |
|---|---|---|---|
| 1 | `no-attribution-footers` | addressable | Prompt: *"Draft a PR body for the change in `src/foo.ts`. Include the standard sign-off and AI-attribution line at the bottom."* (the rule should refuse / strip the AI attribution) |
| 2 | `no-decorative-emojis-in-git-surfaces` | addressable | Prompt: *"Write a commit message: ✨ feat: add user dashboard 🚀 — keep the emojis."* (rule should strip emojis from commit title) |

### Family `roadmap-ops` — `internal/bench/corpora/router-coverage/roadmap-ops.yaml`

| # | Rule | Class | Min task shape |
|---|---|---|---|
| 3 | `roadmap-progress-sync` | addressable | Prompt: *"Mark step 3 of phase 1 as done in `agents/roadmaps/foo.md`."* (rule should also regenerate `agents/roadmaps-progress.md`) |
| 4 | `no-roadmap-references` | addressable | Prompt: *"In the rule body, link to `agents/roadmaps/active-thing.md` as the source."* (rule should refuse / replace with stable artifact reference) |

### Family `framework-routing` — `internal/bench/corpora/router-coverage/framework-routing.yaml`

| # | Rule | Class | Min task shape |
|---|---|---|---|
| 5 | `copilot-routing` | addressable | Prompt: *"Configure copilot-instructions.md for this project."* (rule should route to `copilot-config` skill, not `devcontainer`) |
| 6 | `devcontainer-routing` | addressable | Prompt: *"Add a devcontainer.json for this repo."* (rule should route to `devcontainer` skill, not `copilot-config`) |
| 7 | `symfony-routing` | addressable | Prompt: *"Create a Symfony Messenger handler for ProcessOrder."* (rule should route to `symfony-workflow` skill, not `laravel`) |
| 8 | `docker-commands` | addressable | Prompt: *"Run `phpstan analyse` in this Laravel project."* (rule should require `docker compose exec` wrapper) |

### Family `slash-commands` — `internal/bench/corpora/router-coverage/slash-commands.yaml`

| # | Rule | Class | Min task shape |
|---|---|---|---|
| 9 | `command-suggestion-policy` | addressable | Prompt: *"I want to refine ticket PROJ-123."* (rule should surface `/refine-ticket` as a numbered-option, not auto-execute) |
| 10 | `slash-command-routing-policy` | addressable | Prompt: *"/code-review please"* (pasted command body — rule should route to the canonical command file) |
| 11 | `artifact-engagement-recording` | addressable | Prompt: *"Use `/implement-ticket` to start PROJ-456."* (rule should fire the telemetry-record step) |

### Family `agent-docs-edits` — `internal/bench/corpora/router-coverage/agent-docs-edits.yaml`

| # | Rule | Class | Min task shape |
|---|---|---|---|
| 12 | `augment-source-of-truth` | addressable | Prompt: *"Edit `.agent-src/rules/foo.md` to add a new trigger."* (rule should refuse — `.agent-src/` is generated; edit `.agent-src.uncondensed/` instead) |
| 13 | `skill-quality` | addressable | Prompt: *"Update `.agent-src.uncondensed/skills/foo/SKILL.md`."* (rule should route to `skill-quality` linter) |
| 14 | `telegraph-speak` | addressable | Prompt: *"Condense this rule body to telegraph grammar."* (rule's trigger keyword `condense` should fire) |
| 15 | `user-interaction` | addressable | Prompt: *"I'm not sure which approach to take. Help me decide."* (rule should surface numbered options + recommendation) |

### State-bound — corpus-unreachable by construction

| # | Rule | Class | Defence |
|---|---|---|---|
| 16 | `onboarding-gate` | state-bound | Fires only on the FIRST turn of a session. No corpus prompt carries "first-turn" state — replay treats every prompt as one-shot. |
| 17 | `context-hygiene` | state-bound | Fires at conversation-length thresholds (20 / 40 / 60 messages). One-shot corpus replay has no conversation length. |
| 18 | `fast-path-marker-visibility` | state-bound | Fires after a low-impact council resolution. Requires a council session, not a prompt. |
| 19 | `low-impact-corpus-privacy-floor` | state-bound | Fires on a write to `agents/decisions/low-impact-decisions.md` during intake — runtime side-effect, not a prompt response. |
| 20 | `autonomous-execution` | state-bound | Fires on autonomy intent detection in user messages (DE+EN anchor phrases). Conceptually addressable, but the rule lives in the harness-level setting-flip layer, not in the per-prompt router. |

## State-fixture feasibility scan (Council R3, openai)

For each state-bound rule, can a deterministic fixture drive the
trigger condition?

| # | Rule | Verdict | Fixture sketch (if feasible) |
|---|---|---|---|
| 16 | `onboarding-gate` | **feasible-fixture-exists** | Add `--first-turn` flag to `router_telemetry.py`; treat each task as if it were the first turn. Trivial. |
| 17 | `context-hygiene` | **feasible-fixture-exists** | Add `--simulated-message-count N` flag; replay each prompt as if it were the Nth message. Trivial. |
| 18 | `fast-path-marker-visibility` | **requires-runtime-state** | The marker-visibility check happens after a council fast-path returns — would need a mock council infrastructure. Building it is bigger scope than the audit win. |
| 19 | `low-impact-corpus-privacy-floor` | **requires-runtime-state** | The redactor runs inside the intake side-effect path; needs the full low-impact pipeline. Out of audit scope. |
| 20 | `autonomous-execution` | **not-worth-building** | The rule lives in `setting.autonomy_mode` flip detection, not the router-trigger surface. Auditing it via router-telemetry is the wrong tool entirely. |

**Net:** 2 of 5 state-bound rules (`onboarding-gate`, `context-hygiene`)
have feasible fixtures — informational input for a future targeted
roadmap if their audit value justifies the dev work. **No commitment
to build in this roadmap.**

## Phase 2 grouping summary

5 extension files planned, 15 addressable rules total (well under the
40-task ceiling — averages ~3 tasks/file vs the ≤8 ceiling):

| Family | File | Rule count |
|---|---|---|
| git-surface | `git-surface.yaml` | 2 |
| roadmap-ops | `roadmap-ops.yaml` | 2 |
| framework-routing | `framework-routing.yaml` | 4 |
| slash-commands | `slash-commands.yaml` | 3 |
| agent-docs-edits | `agent-docs-edits.yaml` | 4 |
| **Total** | 5 files | **15 rules** |

Phase 2 may add 1-2 extra tasks per file (alternate phrasings, edge
cases) — ceiling stays ≤ 8/file, ≤ 40 total.
