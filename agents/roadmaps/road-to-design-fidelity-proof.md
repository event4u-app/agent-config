---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
relates: []
estate_growth_exempt: >-
  The finding with the highest measured complaint frequency in the source (31 of 189 user turns,
  16 %) has zero measurement coverage: `src/rules/design-fidelity.md` carries no `enforced_by`,
  sits at line 22 of `src/config/rule-enforcement-baseline.json` among 81 grandfathered rules,
  and no linter, hook or test asserts a fidelity comparison anywhere in the tree. Every phase
  below is net-negative or neutral on the gated standing payload, and Phase 1 removes a baseline
  entry rather than adding one — the estate gets one active roadmap and one fewer un-declared rule.
estate_offset_exempt: >-
  No offset is available. No active roadmap owns design-fidelity enforcement — the subject has
  never had one, which is the gap this file exists for. The five adjacent design gates
  (`lint_design_slop`, `lint_design_quality`, `lint_design_antipattern_parity`, `design_slop_hook`,
  `design_pass_hook`) all ship and all measure generic quality, so there is no stale sibling to
  archive in exchange.
---
# Road to design fidelity proof

> **Source:** `agents/tmp.old/optimize-ac-by-sessions.md` — a self-authored analysis of 30 working
> sessions (10.–17.09.2026, ~189 real user turns), analysed 2026-09-18. Claim verification at HEAD:
> 14 of 20 checkable claims still true, 3 already fixed, 1 never true as stated, 2 out of repo.
> Four of the source's own proposals are unbuildable here and are recorded under § Out of scope
> (verified) rather than planned.

## Goal

`src/rules/design-fidelity.md` stops being the longest rule in the estate that asserts an
obligation nothing records. After this roadmap it (a) declares its own enforcement honestly in
frontmatter and in its body, (b) carries a proof clause in its Iron Law that names a *committed
artefact* as the evidence of 1:1, (c) is shorter than it is today, and (d) routes to an executable
procedure that produces that artefact. Separately, the 373,354 characters of `auto`-tier rule prose
that `check_always_budget` does not see get a ratchet, because the source's own Phase 3 states —
correctly — that without that number every decision about rule volume is opinion.

## Phase 1 — `design-fidelity` wird nachweispflichtig und dabei kürzer

The source's own 1.3 requires both halves in one change: the rule gains a proof obligation **and**
loses depth, because ADR-264 forbids standing-rule growth without a compensating reduction and
`check_preamble_payload_budget` measures zero net headroom at HEAD.

- [ ] **1.1 Migrate the trigger-authoring detail out of `## Routing`.** The section's second half
      is about *how to write a trigger* (near-miss direction, the `*.html` over-breadth argument,
      the withdrawn builder-link trigger) and already cites
      `docs/guidelines/design-fidelity-routing.md` three times. Move that prose verbatim into that
      guideline and leave the rule the trigger classes plus one pointer. Guidelines are not in the
      gated payload bucket, so the characters leave the standing cost without leaving the tree.
      verify: `./scripts-run src/scripts/measure_rule_budget | grep design-fidelity` reports fewer
      body chars than the 9,713 at HEAD, and every migrated paragraph is findable in
      `docs/guidelines/design-fidelity-routing.md`.
- [ ] **1.2 Add the proof clause to the Iron Law.** The Iron Law says *build it 1:1* eleven times
      and *prove it 1:1* zero times. Add one clause: a 1:1 claim is discharged by a committed
      artefact naming, per handover chapter, the evidence that was taken — never by a behaviour
      test and never by a sentence in a reply. Keep it to a clause; the procedure is Phase 2.
      verify: `grep -c 'nachweis\|proof\|prove' src/rules/design-fidelity.md` is non-zero inside
      the fenced Iron Law block, and `./scripts-run src/scripts/check_condensation` is green.
- [ ] **1.3 Declare the enforcement honestly and tighten the baseline.** Add
      `enforced_by: ["instruction-only: <reason>"]` naming that no artefact records a fidelity
      comparison, add the matching one-line body statement the honesty convention requires, and
      delete `"design-fidelity.md"` from `src/config/rule-enforcement-baseline.json`. The baseline
      is a shrink-only ratchet, so removing an entry strengthens it 81 → 80.
      verify: `./scripts-run src/scripts/lint_rule_enforcement_declaration` reports
      `scanned=41 planned=121 skipped=80` and does not name `design-fidelity.md`.
- [ ] **1.4 Prove the phase is net-negative on the gated payload.**
      verify: `./scripts-run src/scripts/check_preamble_payload_budget` is green and its
      `project-scope rules` figure is at or below the 122,757 tok measured at HEAD.

## Phase 2 — Das Nachweisverfahren bekommt einen Ort

The source proposes a new `skill:design-fidelity-proof`. That form is blocked (§ Out of scope), so
the procedure lands on the skill that already owns design verdicts. The mechanism it needs —
element-scoped `toHaveScreenshot`, built into Playwright, no new dependency — is already documented
in `src/skills/playwright-testing/SKILL.md`; what is missing is the obligation to produce a matrix
and the route to it.

- [ ] **2.1 Add a `## Fidelity proof — the chapter matrix` section to `design-review`.** It states:
      derive one row per numbered handover chapter; each row carries exactly one evidence kind —
      an element-scoped screenshot baseline, a `toHaveCSS` assertion on the value the handover
      names, a behaviour spec with a sensitivity probe, or an explicit *not implemented* with a
      reason; the matrix is committed, not written into a reply. Name the staleness trap the source
      measured: a new handover version with baselines still pinned to the old one.
      verify: `./scripts-run src/scripts/lint_skills -- design-review` is green and the section
      exists with all four evidence kinds enumerated.
- [ ] **2.2 Route `design-fidelity` § See also to it, and back.** One line each way, so the rule's
      proof clause has a reachable procedure and the procedure names the rule it discharges.
      verify: `./scripts-run src/scripts/check_references` is green.

## Phase 3 — Der `auto`-Bucket bekommt einen Ratchet

`check_always_budget` gates the nine kernel rules (29,426 chars). `measure_rule_budget` already
measures all 121 rules (402,710 chars, 373,354 of them `auto`), already writes a trend file, and
already runs in CI — with `--kernel-budget-check` only. The measurement exists; the gate does not.

- [ ] **3.1 Add `--auto-budget-check` to `measure_rule_budget`.** Reads an auto-bucket baseline
      from config, fails on growth, prints the delta against the base ref. Shrink-only, same shape
      as the kernel check beside it — a growth ratchet, never a deletion mandate.
      verify: the flag fails on a seeded +1 char and passes at HEAD; the red is proven by sabotage,
      not asserted.
- [ ] **3.2 Count the simultaneously binding obligations, not the files.** The source's 3.2 is
      right that a rule is not an instruction — `token-efficiency` alone carries five Iron Laws.
      Add an Iron-Law count per rule and a total to the existing output.
      verify: the printed total matches `grep -c '^## .*Iron Law' src/rules/*.md` summed, modulo
      the documented `docs/contracts/iron-law-overrides.txt` exemptions.
- [ ] **3.3 Wire the flag into the CI step that already runs.** `taskfiles/ci-fast.yml:596` invokes
      the script with `--kernel-budget-check`; add the second flag to the same step rather than a
      new one, so `check_ci_local_parity` sees no new gate.
      verify: `./scripts-run src/scripts/check_ci_local_parity` is green.

## Out of scope (verified)

Four of the source's proposals were verified as unbuildable or already built. Each is recorded with
its evidence rather than planned, per the source's own rule that a finding leaves with a named
disposition.

| Source item | Disposition | Evidence at HEAD |
|---|---|---|
| Phase 5 — Reichweitenklausel in `verify-before-complete` | **owner** | That rule is one of the nine in `src/scripts/_lib/kernel_rules.ts`; `block_kernel_rule_writes` denies agent writes to it. The source calls this its cheapest measure; it is agent-impossible. |
| 1.1 — `skill:design-fidelity-proof` as a new skill | **declined, blocked** | `check_preamble_payload_budget` reports `ceiling 138348 = base 138348 — zero net growth`; `check_estate_count` reports `skill_count 299 (floor 299, +0)`. A catalogue entry costs ~53 tok against 0 headroom. Phase 2 carries the substance instead. |
| 3.3 — Prosa-nach-Gate-Streichung | **owner / council** | The source states it itself: the phase proposes removing existing protection, and the party that benefits would be the deciding one. Phases 3.1–3.2 build the number it says must exist first. |
| 4.4 item 2 — `check_single_delivery` as release precondition | **declined** | Measured on a two-layer install: the gate reds on five paths that lie outside the repo, so arming it as a release precondition would block every release on such a machine by construction. Item 1 of the same proposal (`.agent-settings.yml` parses) already ships as `_settings-readable` in `taskfiles/release.yml`. |
| B5 / 4.2 — Worktree-Isolation | **out of repo** | The string *"This session is isolated in the worktree"* exists nowhere in `src/`; it is a host message, and ADR-229 removed the `worktrees.mode` setting. Nothing here can change it. |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-18 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The migration drops a passage | implementation | `preservation-guard` forbids losing any paragraph, list item or fenced block in a transform; the Routing section carries argued prose that reads as expendable and is not | Every migrated paragraph is checked present in the destination guideline before the phase closes, and `check_condensation` asserts the projection stays byte-exact | Phase 1 — `design-fidelity` wird nachweispflichtig und dabei kürzer |
| 2 | Phase 1 lands net-positive on the payload | implementation | The Iron-Law clause and the honesty line add characters; if the migration removes fewer, ADR-264's no-growth cap reds the PR | Step 1.4 measures the bucket explicitly rather than assuming, and the migration target is ~2,100 chars against ~600 added | Phase 1 — `design-fidelity` wird nachweispflichtig und dabei kürzer |
| 3 | The auto-bucket ratchet reds on the day it lands | implementation | Seeding a ratchet above the measurement makes it inert; seeding it below makes it red immediately, which is the failure the preamble budget file records for itself | Seed at the measured HEAD figure, shrink-only, and prove both directions by sabotage before wiring it into CI | Phase 3 — Der `auto`-Bucket bekommt einen Ratchet |
| 4 | Phase 2 duplicates `design-review` | product | A fidelity section on a skill that already reviews design could restate what the existing sections say, adding prose that changes nothing | The section is scoped to the one artefact nothing else produces — the committed chapter matrix — and cites rather than restates the evidence kinds | Phase 2 — Das Nachweisverfahren bekommt einen Ort |

## Acceptance Criteria

- [ ] AC-1 — `src/rules/design-fidelity.md` carries an `enforced_by` declaration and a body line
      naming the gap, and is absent from `src/config/rule-enforcement-baseline.json`.
- [ ] AC-2 — The rule's body character count is lower than the 9,713 measured at HEAD, and
      `check_preamble_payload_budget` is green.
- [ ] AC-3 — A reader following `design-fidelity` reaches a procedure that names the four evidence
      kinds and requires the matrix to be committed.
- [ ] AC-4 — `measure_rule_budget` fails on `auto`-bucket growth and reports an Iron-Law total, and
      the CI step that already runs it exercises both checks.
- [ ] AC-5 — Every source proposal not executed is named in § Out of scope (verified) with the
      command or file that establishes its disposition.
