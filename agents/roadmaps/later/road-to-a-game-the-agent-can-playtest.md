---
complexity: structural
status: later
tree_pin: 81788b6e63
review_by: 2027-01-31
entry_condition:
  what: "a first engine project (Godot, Unity or Unreal) is committed in a repository this package is installed into, and the owner has answered the engine and estate blockers below"
  when: "after road-to-toolchains-the-gate-can-see archives"
  who: owner
execution:
  mode: phase-checkpoints
estate_growth_exempt: "+1 later roadmap: the game-specific remainder of round inbox-2026-11-q. The owner steered the round onto game development; the remainder needs a pack id, three skills and an engine choice that only the owner can grant, so it is parked here instead of being dropped into a decline line. Owner search at 81788b6e63 (grep -rliF for godot, unreal, playtest, engine, asset licence over agents/roadmaps, later, stubs) found no owner; every 'game' hit was 'gameable'."
relates:
  - slug: road-to-toolchains-the-gate-can-see
    relation: depends
    note: "Detection, runner precedence and the engine-is-not-plain verdict land there first."
depends:
  - road-to-toolchains-the-gate-can-see
---
# Road to a game the agent can playtest

> **Source:** `agents/tmp.old/inbox-2026-11-q/` — the agent draft of the round,
> re-verified at `81788b6e63`, plus the items the draft dropped from the two
> external plans.
> **Arrivals:** 1 — `inbox-2026-11-q` (2026-11-03).

## Goal

Playtests prove a game done. Edits inside stateful
creative apps are guarded and checkpointed, assets carry their licence, and the
work is planned as a vertical slice before content breadth. Constraint from the source: the name of the owner's planned game
appears in no artefact.

## Phase 1 — Evidence for a game

Evidence (read): `src/cli/commands/uiRender.ts:1` — Chromium is the only render
witness; `src/skills/verify-completion-evidence/SKILL.md:120` has no runtime row.

- [ ] **1.1 Declared verification commands.** A Class-C setting naming a
      project's own verify commands (engine test runners), fenced by
      `block_config_weakening`; name it so it does not collide with the
      existing `verification:` namespace.
      verify: a turn running a declared command passes the turn-end gate in a hook test
- [ ] **1.2 Evidence ladder for runtime output.** Rungs `compiled` →
      `asserted` (engine test runner) → `captured` → `captured+read`, reusing
      the SVG witness ladder; a capture counts only when a reader cites
      anchors from it.
      verify: the ladder table lands in `verify-completion-evidence` with one fixture per rung
- [ ] **1.3 Playtest capture and read.** Godot Movie Maker
      (`--write-movie --fixed-fps --quit-after`) as the first adapter, read
      through the `media:bundle` contact sheets; headless CI reports
      `unverified`, never a pass.
      verify: a fixture capture yields a contact sheet and an anchor-citing read

## Phase 2 — Edits inside stateful apps

Evidence (read): `src/scripts/hook_manifest.yaml:1008` — the MCP observation
concern records tool names only and is telemetry; no tier for app-side code
tools.

- [ ] **2.1 Tier app-side MCP tools from their definitions.** Code-exec tools
      of a creative app (`execute_*_code`) are classified; opt-in host-native
      `ask` rows through the consent-gated deny-row splice.
      verify: a fixture tool list classifies the code-exec tool and nothing else
- [ ] **2.2 Checkpoint before writing a binary-state file.** Only apps whose
      state git does not hold (`.blend`, `.umap`, `.uasset`); Godot text
      scenes are excluded.
      verify: the obligation fires on a `.blend` write fixture and not on a `.tscn`
- [ ] **2.3 Path allowlist and backup before move/delete** inside the app
      project, plus "proxy up is not editor alive" in the capability probe.
      verify: fixture escapes (`..`, symlink) are refused

## Phase 3 — Plan and ship a game like a game

Evidence (executed): `src/agent-src/templates/scripts/work_engine/intent/classify.ts:188`
— "build me a game" classified as `backend-coding`.

- [ ] **3.1 Game nouns in the classifier** and a vertical-slice step (one level
      end to end on the target device) before the content ladder.
      verify: `npx vitest run tests/scripts/work_engine/intent_classify.test.ts` -> 0 with the game prompts
- [ ] **3.2 Runtime budgets declared per project and measured on device** —
      no default numbers.
      verify: a budget file with a measured row passes, one without a measurement is reported
- [ ] **3.3 Asset provenance ledger.** Kind, author, licence, attribution,
      `ai_generated`; store AI-disclosure and consent checks before release.
      verify: a ledger lint refuses an asset row with no licence
- [ ] **3.4 Engine rows** for GUT, Unity Test Runner and UE Automation in the
      resolver, once their command strings are doc-pinned. Carried from the
      sibling roadmap: add the engine markers to the detect and runner cache
      keys, and suppress `dotnet test` for a Godot .NET root and for the
      behaviour-axis `reqnroll`/`specflow` rows under an engine root.
      verify: resolver tests assert each row on an engine fixture

## Blockers

### blocker: game-engine-choice

- **Status:** open — raised 2026-11-03.
- **Owner:** owner — which engine the owner's own game uses is a product fact no tree evidence settles. The draft says Godot-first from an owner steer that is not in the transcript; one external plan says Unreal-first.
- **Blocks:** 1.3, 3.4.
- **What to do:** name the engine; recommended Godot (text scenes diff in git, Movie Maker capture is offline).
- **Resolved when:** the answer is recorded here.

### blocker: game-pack-id-and-skills

- **Status:** open — raised 2026-11-03.
- **Owner:** owner — a new pack id amends a closed public vocabulary, and `skill_count` has no growth allowance; the analogous skill-growth question is already pending in `later/road-to-stacks-beyond-php.md`.
- **Blocks:** shipping 1.3 and 3.x as a pack; the steps themselves can land as sections on existing skills.
- **What to do:** answer together with the pending skill-growth question: pack-only `gamedev` with up to three skills, or sections on existing skills.
- **Resolved when:** the answer is recorded here.

## Decisions

| # | Decision | Decided by | Revisit-if |
|---|---|---|---|
| D1 | No kernel edit: the stateful-app Hard Floor row lives in the pack rule, not in `non-destructive-by-default` | own analysis — a kernel amendment is owner-reserved and nothing here needs it | the pack never ships and the row has no carrier |
| D2 | Unreal and Unity get detector and runner rows only; no engine skills before a consumer | source draft K3, re-checked | a consumer commits an Unreal or Unity project |
| D3 | Dropped items of the external plans (session lease, fault injection, governed-vs-ungoverned benchmark, remote runner, LFS locks) are not taken: none is a verified defect | own analysis | a playtest run shows one of them as the failure |
