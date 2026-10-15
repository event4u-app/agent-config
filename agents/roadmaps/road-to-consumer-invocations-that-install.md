---
complexity: lightweight
status: draft
estate_offset_exempt: "Follow-up split out of PR #2367 by its own review: the remaining sites of a defect class that PR fixed for one verb. Rejected merging into later/road-to-credible-install.md, the closest relative: it is parked with one unrelated cadence-observation item, so this work would land parked and unread. Rejected parking this file in later/: Phase 1 is a council decision that can run now. Nothing to archive offsets it; no active roadmap covers consumer script invocations."
execution:
  mode: phase-checkpoints
---
# Road to consumer invocations that install

> **Source:** PR #2367 (merged `7c728f35b`). Its council review found that
> shipped text told the agent to run
> `npx tsx node_modules/@event4u/agent-config/src/scripts/<x>.ts`, and its
> packed-install test (`tests/test_release_install_e2e.sh` § consumer-ci-settle)
> proved two things: that form fails on a global or ephemeral install, because
> there is no `node_modules/` path to name and `tsx` is a dev dependency that
> `npx` fetches from the registry; and `npm exec --no -- agent-config <verb>`
> reaches a project-local and a global install alike. #2367 converted the CI
> waiter (`ci:settle`). The follow-up lane that opened this file checked every
> remaining site against the CLI registry (`src/cli/registry.ts`) and the
> dispatcher (`src/scripts/_dispatch.bash`): **no existing verb covers any of
> them**, so none could be converted without adding surface.

## Goal

Every executable instruction in shipped text that runs one of this package's
scripts uses a form that works from a project-local, a global and an ephemeral
install with no TypeScript runner and no registry access — and the ratchet
in `tests/scripts/consumer_invocations.test.ts` reaches an empty baseline.

## Context

### Why "just add the verbs" is not a step here

Each verb is a line in `src/cli/registry.ts`, and the CLI command count is a
budgeted surface (`cli_help_command_count` in `src/config/evaluator-budgets.json`,
112 of 112 on 2026-10-15). Twenty-four scripts would move it by up to 24. That is
an owner/council call, not a mechanical conversion.

### Why a verb alone is not enough either

`exec_ts` in `src/scripts/_dispatch.bash` runs a script under plain `node` only
when a prebuilt bundle exists in `dist/cli-delegate/` (built from
`src/scripts/_cli/cmd_*.ts` and `src/agent-src/scripts/*.ts`). Otherwise it
falls back to `require_tsx`, which a consumer install does not have. So any
option below must also bundle the script, which moves the packed size.

### The remaining sites (2026-10-15, 38 invocations in 21 markdown files)

Line numbers drift; the file and the script are the stable key.

| Script | Sites |
|---|---|
| `scripts/append_contested.ts` | `src/skills/systematic-debugging/SKILL.md:302` |
| `scripts/check_account_surface.ts` | `src/skills/launch-readiness/SKILL.md:80`, `src/subagents/production-validator.md:119` |
| `scripts/check_branch_freshness.ts` | `src/domains/git/pr/create/command.md:73`, `src/skills/git-workflow/SKILL.md:58` |
| `scripts/check_finding_dispositions.ts` | `src/skills/forensics-report/SKILL.md:52` |
| `scripts/check_gitignore_freshness.ts` | `src/domains/meta/sync/gitignore/fix/command.md:172` |
| `scripts/check_tracked_but_ignored.ts` | `src/domains/meta/sync/gitignore/fix/command.md:146` |
| `scripts/design_system_import.ts` | `src/domains/engineering-base/design-system/import/command.md:26`, `src/skills/design-system-capture/references/design-system-json.md:116` |
| `scripts/detect_ai_tells.ts` | `src/skills/humanizer/SKILL.md:71` |
| `scripts/detect_target_license.ts` | `src/skills/license-compliance-borrow-check/SKILL.md:56` |
| `scripts/emit_knowledge_event.ts` | `src/skills/project-analysis-core/SKILL.md:164`, `src/skills/source-discovery/SKILL.md:178`, `:181`, `src/skills/systematic-debugging/SKILL.md:284` |
| `scripts/evidence_report.ts` | `src/skills/source-discovery/SKILL.md:41`, `:42`, `:43` |
| `scripts/forensics_report.ts` | `src/skills/forensics-report/SKILL.md:40` |
| `scripts/lint_design_slop.ts` | `src/skills/design-review/SKILL.md:356` |
| `scripts/lint_persistence.ts` | `src/skills/schema-review/SKILL.md:42` |
| `scripts/lint_provenance.ts` | `src/skills/license-compliance-borrow-check/SKILL.md:90`, `src/skills/license-compliance-credits/SKILL.md:20`, `:42`, `:49` |
| `scripts/lint_svg_asset.ts` | `src/skills/svg-authoring/SKILL.md:78`, `:124` |
| `scripts/prediction-pool/poisson_sim.ts` | `src/skills/prediction-pool-optimizer/SKILL.md:214` |
| `scripts/prediction-pool/pool_winsim.ts` | `src/skills/prediction-pool-optimizer/SKILL.md:184` |
| `scripts/prediction-pool/score_ev.ts` | `src/skills/prediction-pool-optimizer/SKILL.md:151`, `:153` |
| `scripts/prelaunch_diagnostics.ts` | `src/skills/launch-readiness/SKILL.md:95` |
| `scripts/security_audit_config.ts` | `src/skills/agent-security-review/SKILL.md:51` |
| `scripts/select_analysis_mode.ts` | `src/skills/project-analysis-core/SKILL.md:137` |
| `scripts/worktree_cleanup_check.ts` | `src/skills/worktree-lifecycle/SKILL.md:109`, `:137` |
| `skills/corpus-grounding/scripts/ground.ts` | `src/domains/engineering-base/design-system/generate/command.md:26` |

A 39th occurrence, in a `baseline_note` of `src/config/evaluator-budgets.json`,
is prose recording why `ci:settle` became a verb, not an instruction.

### Two constraints any conversion inherits

- **Generic skills may not name `npm exec`.** `lint_framework_leakage` reads it
  as a JS-stack mandate. #2367's precedent: a generic skill points at the command
  that carries the invocation (`git-workflow` points at `/fix ci` § 0) instead of
  emitting the line. Never grow the leakage allowlist to fit a site.
- **The ratchet.** `tests/scripts/consumer_invocations.test.ts` pins the table
  above per file; a converted site must shrink that baseline in the same change.

## Phase 1 — Decide the shape

- [ ] **1.1 Put the shape to the council.** Two options, mutually exclusive:
      (a) **one verb per script**, each with a `_cli/cmd_*.ts` wrapper that the
      existing cli-delegate build bundles — up to 24 registry lines and 24
      bundles, but each verb has a synopsis and a usage refusal; or
      (b) **one generic dispatcher** such as `agent-config run <script> [args]`,
      one registry line, resolving an allowlisted script name to a bundle — one
      line of surface, but a second naming scheme and an allowlist to keep in
      sync. A mixed answer (verbs for the gate-shaped scripts a command runs,
      the dispatcher for the rest) is a third reading the council may return.
      The budget raise either option needs is part of the question, not
      assumed. Record the verdict, the dissent and the budget delta here.
      verify: a `## Decisions` entry in this file citing the council run.

## Phase 2 — Convert

- [ ] **2.1 Implement the chosen shape and bundle every script it reaches.**
      verify: `tests/test_release_install_e2e.sh` gains a section that runs one
      converted invocation from a `--omit=dev` project-local and a global install
      offline, the way § consumer-ci-settle does.
- [ ] **2.2 Rewrite every site in the table, shrinking the ratchet baseline per
      file in the same change.** Generic skills point at a command, per the
      constraint above.
      verify: `npx vitest run tests/scripts/consumer_invocations.test.ts` green
      with an empty `BASELINE`, and `lint_framework_leakage` green with no new
      allowlist entry.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-15 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A verb that runs only under tsx | implementation | A registry line is added but the script is not bundled, so the verb works in this checkout and exits 127 on a consumer install | Step 2.1's packed-install section runs a converted invocation with `--omit=dev` and no registry access | Phase 2 — Convert |
| 2 | Surface growth decided by drift | product | Verbs get added one at a time in unrelated PRs, moving the command budget without the decision Phase 1 asks for | The ratchet test blocks new fragile sites but not new verbs; Phase 1 is the only place the shape is decided | Phase 1 — Decide the shape |

## Acceptance Criteria

- [ ] AC-1 — No markdown file under `src/` contains
      `npx tsx node_modules/@event4u/agent-config/src/`, and the ratchet
      baseline in `tests/scripts/consumer_invocations.test.ts` is empty.
- [ ] AC-2 — The packed-install test runs at least one converted invocation
      from a project-local and a global install without a TypeScript runner.
