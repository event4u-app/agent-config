---
complexity: lightweight
status: ready
tree_pin: 81788b6e63
execution:
  mode: phase-checkpoints
review_by: 2026-12-15
estate_offset_exempt: "Operator asked in the invocation itself for the round's roadmaps to be processed with /roadmap:process-full in the same run (2026-11-03); this file is executed and archived in the same change. Owner search at 81788b6e63 (grep -rlF for 'managed hooks', harness-expectations, supply-chain-intake, gemini-veo, likeness over agents/roadmaps, later, stubs): the mod surfaces belong to later/road-to-mod-surfaces-that-read-what-ac-knows.md and the host switches to later/road-to-host-inputs-the-installer-honours.md; none of the steps below is owned there."
relates:
  - slug: later/road-to-mod-surfaces-that-read-what-ac-knows
    relation: disjoint
    note: "Owns the mod sensor, holder and live arm probes; nothing here measures load order."
  - slug: later/road-to-a-witness-for-made-and-found-media
    relation: extends
    note: "Took the media remainder of the same round as 2.5 and 2.6 (video verify, dated model limits)."
---
# Road to host and media steps that say what ran

> **Source:** `agents/tmp.old/inbox-2026-11-r/` (one topic: host mods, foreign
> skill intake and media-stack model truth). The mod half was largely
> overtaken by round `inbox-2026-10-av` (ADR-302, `host_mod_census.ts`).
> **Arrivals:** 1 — `inbox-2026-11-r` (2026-11-03).

## Goal

Every surviving defect of the round where a user-facing text, a doc or an
adapter says less than what happens: the hook wording, the order a host mod
runs in, which foreign assets go through intake, a silent duration clamp, an
image reference nobody counts, and a reference photo of a person.

## Phase 1 — Host truth in words and docs

Evidence (read): `src/scripts/_lib/runtime_wiring_checks.ts:428` — "managed hooks"
in user-visible doctor text collides with the host's managed-settings tier;
`docs/contracts/harness-expectations.md:27` lists Classes A–C and no mod case.

- [x] **1.1 "managed hooks" becomes "agent-config hooks".** User-visible doctor
      and installer text only (`runtime_wiring_checks.ts`, `install.ts`); the
      internal enum stays. A test asserts no hook-wiring message says
      "managed"; seen red first.
      verify: `npx vitest run tests/scripts/runtime_wiring_checks.test.ts` -> 0
- [x] **1.2 Class D — a host mod can override a refusal.** A section in
      `harness-expectations.md` stating only tree-established facts
      (ADR-302, `host_mod_census.ts`): load order is the host's, per-arm order
      is unmeasured and owned by the mod-surfaces roadmap, diagnose with
      `agent-config doctor neighbours`.
      verify: `grep -c 'doctor neighbours' docs/contracts/harness-expectations.md` -> ≥1 and `./scripts-run src/scripts/check_references` -> 0

## Phase 2 — Foreign agent assets go through intake

Evidence (read): `src/skills/supply-chain-intake/SKILL.md:4` — the description
routes dependencies only; third-party skills and skill archives are uncovered.

- [x] **2.1 Intake routes plugins, mods and agent skills.** Description and
      scope name them; the plugin/mod section gains the archive step (list
      before unpack; refuse `..`, absolute, symlink and nested entries; name
      every script); trigger cases added, with a near-miss for writing a new
      skill.
      verify: `./scripts-run src/scripts/skill_linter src/skills/supply-chain-intake/SKILL.md` -> 0

## Phase 3 — Media steps that do not change silently

Evidence (read): `src/scripts/ai-video/adapters/gemini-veo.sh:134` — a requested
duration is clamped to {4,6,8} with no notice; `src/skills/prompt-validator/`
has no reference-index check; `agents/settings/policies/media/likeness.md:12`
has no trigger for a supplied reference photo.

- [x] **3.1 The Veo clamp says so.** A requested duration outside {4,6,8}
      prints `requested <n>s -> rendered <m>s` on stderr; the song-to-script
      skill tells planners the Veo grid.
      verify: `npx vitest run tests/scripts/ai_video_veo_duration.test.ts` -> 0
- [x] **3.2 Reference-index check.** A script refuses a prompt that cites
      image N when fewer than N inputs are supplied; the validator skill calls
      it before the prose check.
      verify: `npx vitest run tests/scripts/ai_video_ref_index.test.ts` -> 0
- [x] **3.3 A supplied photo of a person is a likeness trigger.** Policy and
      rule name it and route it to the existing consent path.
      verify: `grep -ci 'reference image' agents/settings/policies/media/likeness.md src/rules/image-likeness-and-rights.md` -> ≥1 each

## Decisions

| # | Decision | Decided by | Revisit-if |
|---|---|---|---|
| D1 | E1–E3 of the source's owner batch are moot: round `inbox-2026-10-av` chose and shipped the delivery path | tree evidence (`archive/road-to-a-mod-that-decides-nothing-new.md`) | — |
| D2 | E10 (an upstream issue to the host vendor) stays owner-reserved and is not taken: an external public post | rule `non-destructive-by-default` | the owner asks for it |
| D3 | The Veo clamp is announced, not refused: refusing changes adapter behaviour for every caller | own analysis, reversible | a caller reports a clamp it did not expect |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-03 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Doc claims a measured order | product | Class D overstates what is known about mod load order | Only tree-established facts; arm order named as unmeasured | Phase 1 — Host truth in words and docs |
| 2 | Intake description over-triggers | implementation | Widening the description steals routing from skill-writing | Near-miss trigger case for "write a new skill" | Phase 2 — Foreign agent assets go through intake |
| 3 | Reference check refuses valid prompts | implementation | A literal "image 2" in prose is read as a reference | Patterns limited to explicit reference forms; tests for pass and fail | Phase 3 — Media steps that do not change silently |

## Outcome (2026-11-03)

Every step closed with a test seen red first where behaviour changed.

- 1.1 sibling sweep: the construct "managed hook(s)" in user-visible text
  matched 9 further sites outside the two named files (`wizard-plan.ts`,
  `hooks_status.ts`, `cloud_reach.ts`, `cmd_uninstall.ts` ×2,
  `check_installed_hooks_fresh.ts`, `docs/getting-started.md`,
  `docs/setup/per-ide/gemini-cli.md`, one test expectation); all renamed.
  Code comments and internal ids were left as they are.
- 2.1 dropped "marketplace" from the description because it grew the
  description-token estate; it stays in the scope bullet and the body.
- 3.1 touched `song-to-script`, so it gained its trigger corpus, left the
  grandfather list, and the routing-coverage seed rose (198 of 303).
- 3.1 announces the clamp on a live submit only; a dry run refuses before the
  duration is computed.
