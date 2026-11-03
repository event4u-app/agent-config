---
complexity: structural
status: ready
tree_pin: b234d08480
execution:
  mode: phase-checkpoints
review_by: 2026-12-31
estate_growth_exempt: "+1 active_roadmaps over the WIP cap of 5, owner-directed 2026-11-03 (agents/evidence/owner-directives/2026-11-03-process-inbox-2026-11-n-roadmaps.md): one of eight roadmaps of round inbox-2026-11-n landed active so /roadmap:process-full executes them in the same run."
estate_offset_exempt: "Owner search at b234d08480: grep -rlF for skill-overrides.json, knownBareForHost, ReDoS, pipefail, 'expression injection', 'tier: core | specialty' over agents/roadmaps, later, stubs found later/road-to-catalogue-host-fit (step 2.2, parked, which names that step as the tail to pull forward first), later/road-to-host-inputs-the-installer-honours (H1, window and fraction only — not the order, not the hook), later/road-to-skill-ecosystem-security-and-conformance (a new agentic-CI audit skill, not the github-ci teaching line). No active roadmap owns any step below; the parked owners keep their remainder and are cross-referenced."
relates:
  - slug: road-to-catalogue-host-fit
    relation: extends
    note: "Step 1.1 is that file's 2.2, pulled forward as its parking note instructs; tick it there with a pointer."
  - slug: road-to-host-inputs-the-installer-honours
    relation: disjoint
    note: "That file owns the window and fraction inputs (H1); this one owns the order and the hook. Neither changes the installer default here."
---
# Road to a resident set chosen on purpose

> **Source:** `agents/tmp.old/inbox-2026-11-n/` (topic T6).
> **Arrivals:** 1 — `inbox-2026-11-n` (2026-11-03).

## Goal

Listing descriptions go to skills by stated priority, not the alphabet. At the pin, 45 of 303 owned skills
stay described, cut alphabetically after `complexity-first-planning`, so
`systematic-debugging`, `test-driven-development`, `verify-repair-loop`,
`sql-writing` and `security-audit` are installed but listed bare
(`src/scripts/_lib/skill_listing_overrides.ts:105-110`,
`src/scripts/_lib/host_listing_model.ts:158-161`). Three content gaps found by the
same analysis are closed in existing skills. No skill is removed and the
installer's default output does not change in this roadmap: that switch waits for
the measured listing-arm baseline its owner requires.

## Phase 1 — The priority order exists and is measured

- [x] **1.1 Pure priority order.** Add `residentPriorityOrder(catalogue, routesTo,
      packMembers)` to `src/scripts/_lib/host_listing_model.ts`: skills named by a
      deployed rule's `routes_to:` first (more referencing rules first), then
      `engineering-base` pack members, then the rest; name is only the final
      tie-break inside a band. Pure, no I/O. Add the loader that reads `routes_to:`
      from `src/rules/*.md` and `packs:` from skill frontmatter in a separate
      function so the order stays testable.
      verify: `npx vitest run tests/scripts/host_listing_model.test.ts` -> 0, with new
      cases written red first: a fixture where a `routes_to` target sorts last
      alphabetically lands first; every permutation of the input yields the same
      output; an empty `routesTo` and empty `packMembers` reproduce the alphabetical
      fallback exactly.
- [x] **1.2 Resident-set report (report, never a gate).** New
      `src/scripts/report_resident_set.ts`: for windows 200,000 and 1,000,000, the
      described/bare split under today's alphabetical fill and under
      `residentPriorityOrder` as `usageOrder`, plus the status of every skill named by a
      `routes_to:` edge. Exit 0 always.
      verify: `npx vitest run tests/scripts/report_resident_set.test.ts` -> 0 — a fixture
      catalogue yields the expected two splits, and a run on the repo tree reports 45
      described at 200,000 alphabetical (the pinned number), failing the test if the
      alphabetical arm stops matching `computeOverrides`.
- [x] **1.3 Mark the parked step.** In `agents/roadmaps/later/road-to-catalogue-host-fit.md`
      tick 2.2 with a one-line pointer to 1.1 here, leaving its verify text intact.
      verify: `grep -n "road-to-a-resident-set-chosen-on-purpose" agents/roadmaps/later/road-to-catalogue-host-fit.md` -> one hit.

## Phase 2 — The hook knows what the installer stripped

- [x] **2.1 Sidecar as a second bare source.** In
      `src/scripts/hooks/skill_route_hook.ts`, `knownBareForHost` unions the
      observation-log set with the `name-only` entries of the installer sidecar
      (`recordPath()` from `src/scripts/_lib/skill_listing_overrides.ts`) when the host
      is `claude`. Fail open unchanged: a missing, unreadable or malformed sidecar
      contributes nothing and never turns `null` into a filter on its own; only
      entries whose recorded value is `name-only` count.
      verify: `npx vitest run tests/hooks/skill_route_hook.test.ts` -> 0, with new cases
      written red first under a scratch `EVENT4U_CONFIG_HOME`: a sidecar marking X
      `name-only` means the pointer never names X on `claude`; the same sidecar on
      another host changes nothing; no sidecar is byte-identical to today; a corrupt
      sidecar is byte-identical to today.
- [x] **2.2 Cost stays inside the hook budget.** The sidecar read happens inside the
      existing `bareProvider` thunk, so a prompt that ranks nothing reads no file.
      verify: a test in `tests/hooks/skill_route_hook.test.ts` asserts the thunk is not
      called (spy) when the ranker returns no rows.

## Phase 3 — The turnkey server offers declared arguments, and three content lines

- [ ] **3.1 Turnkey `arguments` from `inputs:`.** Add `inputs` to `ContentEntry` in
      `src/cli/mcp/content.ts` (prompts only, read from the already-parsed
      frontmatter: `name`, `description`, `required === true`), and map it in
      `listPrompts` in `src/cli/mcp/dispatch.ts` instead of `arguments: []`. An entry
      that declares nothing still serves `[]`.
      verify: `npx vitest run src/cli/mcp/dispatch.test.ts` -> 0, with a red-first case:
      a fixture skill declaring one required input lists exactly that argument, and an
      undeclared one lists `[]`; plus `npx vitest run src/cli/mcp/content.test.ts` -> 0.
- [ ] **3.2 Expression injection in workflows.** In `src/skills/github-ci/SKILL.md`
      (Conventions → Workflow structure, and Do NOT) and
      `src/skills/code-review/checklists/infra.md`: attacker-controlled
      `${{ github.event.* }}` / `github.head_ref` never interpolated into `run:`; pass
      it through `env:` and quote the variable.
      verify: `grep -n "github.event" src/skills/github-ci/SKILL.md src/skills/code-review/checklists/infra.md` -> at least one hit in each file.
- [ ] **3.3 ReDoS and shell rows.** Two rows in the surface table of
      `src/skills/ai-code-blindspots/SKILL.md`: **Regex on untrusted input** (no nested
      or overlapping quantifiers, anchored, bounded input length, a must-match and a
      must-not-match test) and **Shell script** (`set -euo pipefail`, every expansion
      quoted, ShellCheck when present).
      verify: `grep -nE "ReDoS|pipefail" src/skills/ai-code-blindspots/SKILL.md` -> two hits.
- [ ] **3.4 Persona template value.** `src/skills/persona-writing/SKILL.md:90` reads
      `tier: core | specialist`, matching `docs/contracts/persona-schema.md:25`.
      verify: `grep -c "core | specialty" src/skills/persona-writing/SKILL.md` -> 0, then
      `task sync` and `bash src/scripts/condense.sh --changed` lists nothing.

## Decisions

| Decision | Alternatives | Reason | Revisit-if |
|---|---|---|---|
| The loader lives in `src/scripts/_lib/resident_priority_inputs.ts`, not in `host_listing_model.ts`. | Same file. | `host_listing_model.ts` states "Pure — no I/O"; keeping the read apart keeps that true. | Never — reversible by a move. |
| `ownedCatalogue` in `skill_listing_overrides.ts` is exported and reused by the report. | A second catalogue reader in the report. | The alphabetical arm must be the installer's own input; a copy could drift silently. | The installer changes its catalogue source. |
| The repo-tree test asserts the alphabetical arm equals `computeOverrides`, not the literal 45. | Assert `45`. | Parallel work renames skills and their descriptions; the match is the failing condition the step names, and a literal would go red on any description edit. Observed at the run: 45 of 303 described at 200,000 under both arms; 228 at 1,000,000. | The owner wants the count itself pinned. |
| The sidecar read ignores the record's `settings_path` and reads only `entries` whose value is `name-only`. | Re-validate against `~/.claude/settings.json` like `loadRecord` does. | The hook has no settings path in its envelope; the record is the package's own and is rewritten on every install. A stale record can over-suppress at worst, never invent a pointer. | A stale-record over-suppression is observed. |
| `routeDecision` returns before the provider when `rank` yields no rows, which is the 2.2 guarantee. | Leave the provider call after an empty rank. | Byte-identical result (an empty ranking produces no pointer either way); the provider was the only file read on that path. | Never. |
| Finding, recorded not acted on: at 200,000 the priority arm keeps none of `systematic-debugging`, `test-driven-development`, `verify-repair-loop`, `sql-writing`, `security-audit` — the 72 `routes_to:` targets fill the 8,000-char budget first. | Re-weight bands now. | The roadmap fixes the band order; re-weighting is the owner's call together with the default switch. | The listing-arm baseline is measured. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The hook goes silent on skills a user relies on | product | Filtering name-only skills drops pointers the model could still have used by name. | Same doctrine as the landed observation filter; fail open on any read problem; only the package's own recorded `name-only` counts, never a user value. | Phase 2 — The hook knows what the installer stripped |
| 2 | The order is read as a shipped default | product | A report showing a better split invites flipping `computeOverrides` without the measured baseline. | Phase 1 changes no installer output; the switch is named under Non-goals and stays with the owner of the listing-arm baseline. | Phase 1 — The priority order exists and is measured |
| 3 | Turnkey and kernel arguments diverge | implementation | Two readers of `inputs:` can disagree on an unusual block form. | Turnkey reads through a real YAML parse; the kernel's `check_inputs_parity` already pins the kernel reader to a YAML parse, so both agree with the same reference. | Phase 3 — The turnkey server offers declared arguments, and three content lines |

## Acceptance Criteria

- [ ] AC-1 — `report_resident_set` shows, at the pin, which named core skills the
      priority order would keep described, and the alphabetical arm matches the
      installer.
- [ ] AC-2 — The skill-route hook never names a skill the installer recorded as
      `name-only` on `claude`, and is byte-identical without a sidecar.
- [ ] AC-3 — `prompts/list` on the turnkey server carries the declared arguments of
      every skill or command that declares `inputs:`.
- [ ] AC-4 — The three content lines and the persona template value are present.

## Non-goals

- Changing what the installer writes by default (needs the listing-arm baseline in
  `road-to-routing-assurance-live-floors`, a paid run).
- Removing, merging or shortening any skill or description.
- The window and fraction inputs (owned by `road-to-host-inputs-the-installer-honours`).
- The Cloudflare worker's `arguments`, a pack filter for turnkey prompts, migrating
  `argument-hint` to `inputs:`, renaming the skill `tier` field, a prompt-harvest
  pipeline, new dedicated regex or shell skills.
- Importing or copying text from the external catalogue.
