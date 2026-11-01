---
complexity: standard
status: later
tree_pin: 5a66c1bf19
review_by: 2026-12-15
entry_condition:
  what: "owner answer to blocker floor-reach-repair, and a free active slot"
  when: "when the owner answers"
  who: owner
execution:
  mode: phase-checkpoints
owner: maintainer
estate_growth_exempt: "Receiver for round inbox-2026-11-a topic T3 (owner request: analyse a finance-agent-teams video against AC). Written to later/ because floor reach is an owner-reserved floor decision and the investor chain needs the domain-adoption gates; grows open_blockers by one."
estate_offset_exempt: "Owner search at 5a66c1bf19 (grep -rlF for floor reach, FIRST_WIN, review_probe, xlsx_audit, finance-investor over agents/roadmaps, later, stubs) found none. The subagent return contract and the hook re-probe found owners and were folded there (stubs/road-to-subagent-return-gate.md, stubs/road-to-host-primitive-lowering.md); portfolio identifiers belong to later/road-to-placeholders-on-the-wire.md."
---
# Road to a reason that is still there

> **Source:** `agents/tmp.old/inbox-2026-11-a/` (topic T3: transcript, one supplied plan, one proposal).
> **Arrivals:** 1 — `inbox-2026-11-a` (2026-11-01).

## Goal

A safety floor reaches every skill it names; a pack's first-win guide claims
only what exists; a recorded reason for a decision can be re-checked; money
figures leave a skill as a workbook whose formulas were audited; and the
investor's question — is the reason for this position still there after the
new numbers? — has a workflow, built from those primitives.

The stale-text halves (finance floor naming `fundraising-narrative`, the
engineering floor's `core` sentence, the comp-banding description, the dead
screenshot references, the DCF hand-off line) landed in
`archive/road-to-numbers-a-skill-can-stand-behind` Phase 1.

## Verified at the pin

- Floors name skills outside their packs: `finance-safety-floor.md:51`
  names `forecast-accuracy` (gtm-sales); `strategy-safety-floor.md:53` names
  `positioning-strategy` (gtm-marketing) and `org-design` (ops-people). Those
  three reach no domain floor; nothing checks reach.
- `time_to_first_value_minutes` is mandatory (`lint_pack_first_win.ts:44`) and
  never measured (values 6–10 in four `pack.yaml`).
- `adr_cite_check.ts:184,545-558` evaluates date triggers only; 130 of 243 ADRs
  carry `review_trigger`; revisit-if lines and premortem tripwires have no reader.
- `dcf-modeling` emits computed values as markdown (`SKILL.md:95-98`);
  `spreadsheet-authoring` is `execution: manual` with no script (`:17-18`).
- No finance command; `src/profiles/finance.yaml:6` is finance-basic only.

## Phase 1 — Truth lints

- [ ] **1.1 Floor reach check.** Every skill a floor names in its holds-for
      list or `routes_to` shares a pack with the floor; lands after blocker
      `floor-reach-repair` so it can be green.
      verify: a fixture floor naming an out-of-pack skill fails.
- [ ] **1.2 First-win honesty.** `lint_pack_first_win` requires named paths to
      exist and minutes to carry `basis: estimate|measured`.
      verify: `npx vitest run tests/scripts/lint_pack_first_win.test.ts` -> 0 with a missing-path fixture failing.

## Phase 2 — A reason can be re-checked

- [ ] **2.1 `review_probe:` beside `review_trigger`**, piloted on 10 ADRs,
      extending `adr_cite_check`'s date arm; a fired probe yields a candidate,
      never an automatic reopen.
      verify: `npx vitest run tests/scripts/adr_cite_check.test.ts` -> 0 with a fired probe producing a candidate and no status change.

## Phase 3 — Money leaves as an audited workbook

- [ ] **3.1 Spreadsheet sensor.** A real handler for `spreadsheet-authoring`
      (formula audit, offline).
      verify: a fixture workbook with a pasted value where a formula belongs fails the audit.
- [ ] **3.2 DCF outputs a workbook** through it; its eval updated (an output
      contract change).
      verify: the `dcf-modeling` eval passes with workbook output and the audit green on it.

## Phase 4 — Investor chain (after the domain-adoption gates)

- [ ] **4.1 Earnings review → thesis check → position view** as commands over
      the existing finance skills, the video's flow as the acceptance test.
      Gated on proposal decisions E2 (new pack vs finance-advanced), E5
      (data sources: recipe plus degradation), E6 (portfolio privacy), E7
      (command language) and `domain-adoption-policy`'s three gates.
      verify: the video's three-step flow runs end to end on a fixture filing.

## Blockers

### blocker: floor-reach-repair
- **Status:** open — raised 2026-11-01.
- **Owner:** owner (which floor governs a skill is a safety-floor decision).
- **Blocks:** step 1.1.
- **Question:** for `forecast-accuracy`, `positioning-strategy` and `org-design`: (a) add their pack to the floor's `packs:`; (b) embed the Iron Law in the skill; (c) move the skill.
- **Recommendation:** (a) — the floor then activates wherever the skill is installed, and no skill moves.

## Risk Register

| Risk | Mitigation |
|---|---|
| More agents read as more reliability | primitives first; the chain is an acceptance test, not the product |
| A probe auto-reopens a decision | a fired probe produces a candidate only |

## Acceptance Criteria

- No floor names a skill it does not reach.
- A DCF figure can be traced to an audited formula.
