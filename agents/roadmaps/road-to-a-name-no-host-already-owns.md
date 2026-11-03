---
complexity: standard
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "Owner search at b234d08480 (grep -rlF for claude_builtin_names, lint_agent_skill_names, user-invocable, 'reserved name', name-no-host-already-owns over agents/roadmaps, later, stubs) found no owner: later/road-to-skill-menu-economy and later/road-to-a-canvas-the-code-owns cite the files but own neither the collision nor the gate; agents/roadmaps-owned.md has no row. No active roadmap is archived to offset it."
---

# Road to a name no host already owns

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T1).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03).

## Goal

A name this package ships is owned by exactly one of its artefacts and never by
a host built-in. Today the skill `mcp` takes `/mcp` away from Claude Code and
the skill `code-review` takes `/code-review`, while the name lint is green
because it accepts `user-invocable: false` as an escape
(`src/scripts/lint_agent_skill_names.ts:195-210`). That key only blocks the user
from invoking the skill; it does not give the name back. Phase 1 is the hotfix
and proves that existing installs heal. Phase 2 keeps it from coming back:
witnessed reserved names, a gate on same-name twins, and a doctor section that
sees the user's machine. Nothing is deleted — every fix renames or reports.

## Phase 1 — Give `/mcp` and `/code-review` back

- [ ] **1.1 Rename `mcp` to `mcp-tool-use`.** Move `src/skills/mcp/` to
      `src/skills/mcp-tool-use/`, set `name: mcp-tool-use`, drop the
      `user-invocable: false` line and the comment above it, and update every
      referrer found by `grep -rlE '(skills/mcp/|^\s*-\s*mcp\s*$|skill:mcp\b|"mcp")' src docs tests`
      that names the skill (not MCP servers in general): flows, `src/domains/meta/pack.yaml`,
      `src/rules/tool-safety.md`, catalog, `docs/contracts/file-ownership-matrix.json`,
      trigger evals, budget configs. Regenerate with `task sync` and `task generate-tools`.
      verify: `test ! -e src/skills/mcp && test -f src/skills/mcp-tool-use/SKILL.md && ./scripts-run src/scripts/check_references && ./scripts-run src/scripts/lint_agent_skill_names --quiet` -> exit 0
- [ ] **1.2 Rename `code-review` to `code-review-lens`.** Same procedure for
      `src/skills/code-review/` and its referrers (`src/flows/{delivery,implementation,review}.yaml`,
      `src/domains/engineering-base/review/changes/command.md`, `src/config/skill-body-budget.json`,
      `src/config/skill-output-shape.json`, `src/scripts/compile_trigger_evals.ts`,
      `src/scripts/report_skill_menu_census.ts`, `src/scripts/activation_receipt.ts`,
      `docs/contracts/routing-assurance-floors.json`, the listed tests and fixtures).
      verify: `test ! -e src/skills/code-review && npx vitest run tests/scripts/compile_trigger_evals.test.ts tests/scripts/report_skill_menu_census.test.ts tests/scripts/routing_arms.test.ts tests/contracts/review_spec_axis.test.ts` -> 0 failed
- [ ] **1.3 Close the escape in the lint.** In `src/scripts/lint_agent_skill_names.ts`
      a reserved skill name is a violation whatever the frontmatter says; extract
      the check as an exported pure `_reserved_name_violation(dirname, text)` and
      remove `_opts_out_of_slash` if nothing else uses it. Correct the claim in
      `src/scripts/_lib/claude_builtin_names.ts:17-20` (layer 3) and the
      passthrough reason in `src/config/host-skill-frontmatter-keys.json:51`
      ("controls who may invoke, not who owns the name").
      verify: `npx vitest run tests/scripts/lint_agent_skill_names.test.ts` -> 0 failed, with a new case where `mcp` + `user-invocable: false` returns a violation and `mcp-tool-use` returns none
- [ ] **1.4 Compare names the way the host does.** `is_claude_builtin_name` in
      `src/scripts/_lib/claude_builtin_names.ts` applies NFKC, removes whitespace
      and format characters (`\p{Cf}`), then lowercases.
      verify: `npx vitest run tests/scripts/claude_builtin_names.test.ts` -> 0 failed, with cases for full-width `ｍｃｐ`, `m​cp`, ` MCP ` (all reserved) and `mcp-tool-use` (not reserved)
- [ ] **1.5 Prove an existing install heals.** A regression case in
      `tests/lib/global_deploy_inventory.test.ts`: an inventory that recorded
      `skills/mcp/SKILL.md` and a current set holding `skills/mcp-tool-use/SKILL.md`
      makes `reap_stale` (`src/scripts/_lib/global_deploy_inventory.ts:397`) delete
      the old directory; an unrecorded foreign `skills/mcp/` under the same anchor
      survives. Same pair for `code-review`.
      verify: `npx vitest run tests/lib/global_deploy_inventory.test.ts` -> 0 failed
- [ ] **1.6 Tell the user.** One `CHANGELOG.md` `[Unreleased]` entry: after the
      update `/mcp` and `/code-review` open Claude Code's own commands again; the
      skills are now `mcp-tool-use` and `code-review-lens`.
      verify: `grep -n 'mcp-tool-use' CHANGELOG.md` -> at least one line under `## [Unreleased]`

## Phase 2 — Keep it from coming back

- [ ] **2.1 Witnessed reserved names.** Add the current host names missing from
      `src/scripts/_lib/claude_builtin_names.ts`, each carried by a fixture with
      its witness: `tests/fixtures/host-builtins/session-listing-2026-11-03.json`
      (observed in a Claude Code session skill listing: `update-config`,
      `keybindings-help`, `workflow-authoring`, `plugin-authoring`,
      `artifact-design`, `artifact-diagramming`, `artifact-capabilities`) and
      `tests/fixtures/host-builtins/docs-2026-10-22.json` (the command and alias
      names the T1 source read from the host's commands page, with `read` naming
      that date and that it is second-hand). The `pinned-host-control` test
      iterates every fixture in the directory. No current package name is in
      either set (checked at the pin), so nothing new turns red.
      verify: `npx vitest run tests/scripts/claude_builtin_names.test.ts` -> 0 failed and `./scripts-run src/scripts/lint_agent_skill_names --quiet` -> exit 0
- [ ] **2.2 A gate on same-name twins.** `lint_agent_skill_names` fails when a
      skill directory name equals a command `name:` slug, except the eight twins
      present at the pin, listed by name in `src/config/name-twin-baseline.json`
      with the owner decision that closes them. A ninth twin fails; deleting a
      line from the baseline is the only way it shrinks.
      verify: `npx vitest run tests/scripts/lint_agent_skill_names.test.ts` -> 0 failed, with a fixture twin that is red and the real repo green
- [ ] **2.3 Doctor sees shadows on the user's machine.** New
      `src/scripts/_cli/doctor_reserved_names.ts`, wired into
      `src/scripts/_cli/cmd_doctor.ts`: lists every directory under
      `~/.claude/skills/` and `<project>/.claude/skills/` whose name is reserved,
      marks it `ours` (recorded in the global deploy inventory) or `foreign`,
      names the fix, writes nothing.
      verify: `npx vitest run tests/scripts/doctor_reserved_names.test.ts` -> 0 failed, over a temp HOME with one ours and one foreign reserved dir

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The opt-out was the earlier accepted fix | product | The 2026-07 fix kept the name and relied on `user-invocable: false`; reopening it could look like churn | The lint itself is green with the defect live (`lint_agent_skill_names.ts:195-210`) and the user reports `/mcp` unusable; the fix renames, it removes no capability | Phase 1 — Give `/mcp` and `/code-review` back |
| 2 | A rename misses a referrer | implementation | Flows, packs, catalog or trigger evals keep the old name and route to nothing | `check_references` plus the named vitest files in 1.1/1.2; the grep in 1.1 is the enumerated set | Phase 1 — Give `/mcp` and `/code-review` back |
| 3 | The reaper deletes a user's own `mcp` skill | security | A same-name skill the user wrote must survive | 1.5 asserts the foreign directory survives; 2.3 only reports | Phase 1 — Give `/mcp` and `/code-review` back |
| 4 | Second-hand docs names are wrong | implementation | A name reserved without being a built-in only withholds a package name | No package artefact uses any added name at the pin; the fixture states its witness and date | Phase 2 — Keep it from coming back |

## Acceptance Criteria

- [ ] AC-1 — No package skill or command ships under a name in the reserved set;
      the lint has no frontmatter escape.
- [ ] AC-2 — An existing install that had `skills/mcp/` loses it on update; a
      foreign one is kept and reported.
- [ ] AC-3 — A new skill/command twin fails CI; the eight existing ones are named
      and cannot grow.

## Non-goals

- N1 Deleting or merging skills to lower the count (capability-first override).
- N2 Prefixing every skill name; only colliding names move.
- N3 Writing host settings (`skillOverrides` and similar) to hide built-ins.
- N4 Fetching host documentation in CI; reserved names are pinned fixtures.
