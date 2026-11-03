---
complexity: lightweight
status: archived
tree_pin: 04be82bc75
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_growth_exempt: "+1 active_roadmaps, owner-directed 2026-11-03 in the /analyze:inbox invocation itself (\"danach arbeite die roadmaps ab mit /roadmap:process-full\"); closed and archived in the same PR, so the active estate returns to its prior count."
estate_offset_exempt: "Owner search at 04be82bc75: grep -rlF -e allowed_durations -e 'agent-asset' -e archive_precheck -e 'managed-settings-block' over agents/roadmaps/*.md, agents/roadmaps/later and agents/roadmaps/stubs found no owner of a duration grid key, a third-party agent-asset intake reference, an archive pre-check or the block rename. archive/road-to-host-and-media-steps-that-say-what-ran shipped the Veo clamp notice, Class D and the archive-listing step this file builds on; later/road-to-mod-surfaces-that-read-what-ac-knows owns the host-side mod work."
relates:
  - slug: archive/road-to-host-and-media-steps-that-say-what-ran
    relation: extends
    note: "Same source set, worked in parallel; this file carries only what that one did not ship."
  - slug: later/road-to-mod-surfaces-that-read-what-ac-knows
    relation: disjoint
    note: "Owns live-arm reach probes, the trace sensor, the holder and further surfaces; this round's mod findings landed there as an arrival."
  - slug: later/road-to-a-game-the-agent-can-playtest
    relation: disjoint
    note: "Its 3.1 (game noun, vertical slice) landed in this PR and is flipped there."
---
# Road to limits the surfaces already state

> **Source:** `agents/tmp.old/inbox-2026-11-r/` (topic T1: owner transcript, two
> supplied plans and a revision set on a prompt/workflow site and Claude Code mods;
> sources referenced as S1–S4).
> **Arrivals:** 1 — `inbox-2026-11-r` (2026-11-03). A parallel run over the same
> set shipped first; this file is the remainder it did not cover.

## Goal

Every place that states a limit says it where a reader acts on it: the Veo grid
is a manifest fact the planner reads, the deny-row consent screen and the README
say that a user-installed mod can lift a hook refusal, the package's own settings
block no longer borrows the host's term "managed settings", and a third-party
skill or zip has a reference gate and a pre-check that reads the archive without
extracting it.

## Phase 1 — A grid the planner reads

- [x] 1.1 Optional `allowed_durations` key in the capability manifests; `gemini-veo.json`
  carries `[4,6,8]` marked as assumed. verify: `npx vitest run tests/scripts/ai_video_model_capabilities_schema.test.ts` -> 0
- [x] 1.2 `song-to-script` keeps scene lengths on `allowed_durations` when present;
  `motion-choreographer` states its provider grammar is undated.
  verify: `grep -n allowed_durations src/skills/song-to-script/SKILL.md` -> /allowed_durations/

## Phase 2 — Say where the refusal stops

- [x] 2.1 Red first: the enforceable `claude` deny-plan consent text names the mod limit.
  verify: `npx vitest run tests/install/no_go_deny_rows.test.ts` -> 0
- [x] 2.2 `enforcement-by-host.md` host-switch note, a consent-screen line in Class D,
  README scope qualifier. verify: `grep -n 'Host switches' docs/enforcement-by-host.md` -> /## Host switches/
- [x] 2.3 Rename `managed-settings-block` → `ac-owned-settings-block`; the lint refuses the old
  value with a hint. verify: `npx vitest run tests/scripts/lint_surface_matrix_hooks_value.test.ts` -> 0

## Phase 3 — Third-party agent assets through the same intake

- [x] 3.1 `supply-chain-intake/references/agent-asset-intake.md`: pin, read every file before
  activation, scripts raise the class, re-review on update. verify: `task lint-skills` -> 0
- [x] 3.2 `archive_precheck.ts`: reads a ZIP central directory without extracting; refuses
  traversal, symlinks, nested archives, ZIP64, encrypted entries, oversize/ratio bombs; names
  executables. verify: `npx vitest run tests/scripts/archive_precheck.test.ts` -> 0

## Phase 4 — Close

- [x] 4.1 Projections regenerated; touched tests and typecheck green.
  verify: `npm run -s typecheck` -> 0

## Decisions

| # | Decision | By | Reason |
|---|---|---|---|
| D1 | The Veo off-grid duration stays clamped with a notice, not refused | lock | `road-to-host-and-media-steps-that-say-what-ran` D3: refusing changes adapter behaviour for every caller; its revisit-if (a caller reports an unexpected clamp) has not fired. |
| D2 | No Seedance / Veo / Kling manifest refresh, no credit cost unit | owner | Needs a provider source (network) and an operator plan value. |
| D3 | Mod-side carrier-independent counter not built | owner | Outside ADR-302's call surface; recorded as an arrival on the mod-surfaces roadmap. |

## Acceptance Criteria

- The Veo manifest names its grid; the planner keeps scenes on it.
- The consent screen and README state the mod limit without a measured-arm claim.
- A zip with `../` or a symlink entry is refused; a clean one passes.
