---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "The nearest owner is road-to-rule-triggers-and-links-that-hold, whose ticked step 1.5 produced the audit this roadmap corrects; it is a trigger-and-link repair roadmap with two owner-ABI blockers, and adding a schema change to how enforced_by binds would widen it past its subject and tie this work to its ABI gate. The stubs road-to-kernel-instruction-only-migration (one kernel rule's enforced_by value) and road-to-instruction-path-obligation (two prose obligations held by the per-spawn budget) each own one rule's value, not the granularity of the field. No live roadmap owns release finding bfe1d6e6d8ca."
estate_growth_exempt: "Grows active_roadmaps by one: the owner asked on 2026-10-06 for this round's roadmaps to land as ready in one change; the over-credit finding has no owner and its fix is a structural change that needs its own council challenge."
relates:
  - slug: road-to-rule-triggers-and-links-that-hold
    relation: disjoint
    note: "Its step 1.5 wrote the obligation-mechanism audit; this roadmap corrects the audit's gate class and edits none of that roadmap's steps."
  - slug: road-to-kernel-instruction-only-migration
    relation: disjoint
    note: "Stub. Owns one kernel rule's enforced_by value; kernel rules stay rule-level here."
  - slug: road-to-instruction-path-obligation
    relation: disjoint
    note: "Stub. Owns two prose obligations held by the per-spawn budget; nothing here adds rule-body prose."
---
# Road to enforcement per obligation

> **Source:** an external review round (opaque id inbox-2026-10-e), round
> `agents/tmp.old/inbox-2026-10-e/`. Every anchor below was re-read at `main`
> @ `a75bb3210` on 2026-10-06. Class: external review corpus.

## Goal

A gate is credited with the obligation it refuses, not with every obligation
of the rule it is declared on. Each extracted rule law has a stable id; an
`enforced_by` entry names the law ids it carries; and the coverage report
counts obligations beside rules. The sixteen rules credited today as "carried
by a gate that can refuse" are re-read obligation by obligation and the delta
is published. Whether to change the field's granularity at all is put to the
council first.

## Context

- `agents/evidence/analysis/obligation-mechanism-audit-2026-10.md` (produced
  at `01b4a2219`, 2026-10-02) defines its gate class as "a validator, hook or
  test blocks the forbidden outcome" (`:41`) and splits 121 rules
  16 gate / 10 observer / 15 declared gap / 80 undeclared (`:39-45`). Its own
  framing warns that a slot existing is "necessary and never sufficient"
  (`:17`).
- The classification is per rule: `check_enforcement_coverage` reads one
  `enforced_by` list from each rule's frontmatter
  (`src/scripts/check_enforcement_coverage.ts:589-599`) and resolves it for the
  whole rule.
- Worked example: `src/rules/git-history-discipline.md:25-26` declares
  `enforced_by: ["hook:block-no-verify"]`, and the audit counts the rule as
  gated (`obligation-mechanism-audit-2026-10.md:128`). The guard refuses
  `--no-verify` and `core.hooksPath` overrides; the rule's Iron Laws against
  unsolicited rebase, squash and amend are refused by nothing. The audit rows
  for `language-and-tone` (`:135`) and `secret-vcs-guard` (`:175`) have the
  same shape.
- Release finding `bfe1d6e6d8ca`
  (`agents/evidence/release-findings/16.3.0.json:22`): the 16/10/15/80 split
  "overstates mechanical coverage". It has no disposition.
- The committed coverage report, `internal/reports/enforcement-coverage.json`,
  summary at this commit: `total` 120, `blocking` 16, `blocking_pct` 13.3,
  `observer` 10, `kernel_denied` 9, `carrier_less` 1. The rule count differs
  from the audit's 121 because the two were taken at different commits.
- Laws are already extracted per rule — `src/scripts/lint_rule_law_section.ts`
  asserts every routed rule has one law section, and
  `src/scripts/_lib/thin_rules.ts:372-373` marks a stub's copied law block by
  its sha256 — but no law, and no obligation inside a law, has a stable id.
  The only per-obligation pointer is the hand-kept `# obligation: line N`
  frontmatter marker, which "nothing in the tree reads" except the audit
  (`obligation-mechanism-audit-2026-10.md:35`).
- Nine kernel rules cannot carry `enforced_by` at all; the agent cannot write
  them (`check_enforcement_coverage.ts:666` and the `kernel_denied` count).

## Phase 1 — The granularity question goes to the council

- [ ] **1.1 Challenge the change before building it.** Put blocker
      `obligation-granularity` to the council with the audit, the three worked
      rows above and the coverage summary. The verdict, the dissent and the
      prompt are recorded at the blocker, and its `Status` closes.
      verify: `grep -A1 '^### blocker: obligation-granularity' agents/roadmaps/road-to-enforcement-per-obligation.md | grep -c 'resolved'` -> /^1$/

## Phase 2 — Every extracted law has a stable id

- [ ] <!-- blocked-by: obligation-granularity | asked: no — the question is routed to the council in step 1.1, not to the owner --> **2.1 Ids in frontmatter, not in bodies.** Each non-kernel rule with a law
      section declares its obligations as `<rule>.<obligation>` ids in
      frontmatter, so no rule body grows. A lint asserts ids are unique,
      prefixed with their own rule id, and stable across a reword of the law
      text (a fixture rewords a law and keeps the id).
      verify: `npx vitest run tests/scripts/rule_obligation_ids.test.ts` -> 0
- [ ] <!-- blocked-by: obligation-granularity | asked: no — the question is routed to the council in step 1.1, not to the owner --> **2.2 The old marker is read or retired.** Where a rule carries
      `# obligation: line N`, its first id points at the same law; the marker is
      then either read by the lint or removed, never left as a second source.
      verify: `npx vitest run tests/scripts/rule_obligation_ids.test.ts` -> 0

## Phase 3 — `enforced_by` binds to an id, and coverage counts obligations

- [ ] <!-- blocked-by: obligation-granularity | asked: no — the question is routed to the council in step 1.1, not to the owner --> **3.1 An entry names what it carries.** An `enforced_by` entry may name
      the law ids it refuses. `check_enforcement_coverage` credits only those
      ids; an entry with no ids keeps today's rule-level credit and is counted
      as unbound, so nothing in the tree changes class on the day this lands.
      verify: `npx vitest run tests/scripts/check_enforcement_coverage_obligations.test.ts` -> 0
- [ ] <!-- blocked-by: obligation-granularity | asked: no — the question is routed to the council in step 1.1, not to the owner --> **3.2 Obligations beside rules.** The report's summary prints obligation
      counts per class next to the existing rule counts, and every existing
      rule-level field keeps its name and meaning. No new failing condition is
      added.
      verify: `npx vitest run tests/scripts/check_enforcement_coverage_obligations.test.ts` -> 0

## Phase 4 — The sixteen, re-read

- [ ] <!-- blocked-by: obligation-granularity | asked: no — the question is routed to the council in step 1.1, not to the owner --> **4.1 Bind the gated rules per obligation.** For each of the sixteen rules
      counted as gated, its `enforced_by` entries name the ids each one
      actually refuses, read from the gate's own code, not from the rule's
      prose.
      verify: `npx vitest run tests/scripts/check_enforcement_coverage_obligations.test.ts` -> 0
- [ ] <!-- blocked-by: obligation-granularity | asked: no — the question is routed to the council in step 1.1, not to the owner --> **4.2 Publish the delta.** A page lists, per rule, obligations gated
      before and after, with the command that reproduces it, at
      `agents/evidence/analysis/enforcement-per-obligation-2026-10.md`, carrying
      `<!-- evidence-type: analysis -->`. Finding `bfe1d6e6d8ca` gets its
      `status` and `rationale` in `16.3.0.json` pointing at that page.
      verify: `grep -c 'road-to-enforcement-per-obligation' agents/evidence/release-findings/16.3.0.json` -> /^[1-9]/

## Phase 5 — Observer candidates, named

- [ ] <!-- blocked-by: obligation-granularity | asked: no — the question is routed to the council in step 1.1, not to the owner --> **5.1 A list, no wiring.** The 4.2 page gains a section naming each
      obligation in the observer set that an existing backstop could refuse,
      with the backstop's path and the slot it would bind to. Nothing is wired.
      verify: `grep -c -i 'observer candidates' agents/evidence/analysis/enforcement-per-obligation-2026-10.md` -> /^[1-9]/

## What this roadmap deliberately does not do

- No new hooks and no new gates.
- No gate that fails on coverage. The obligation counts are printed.
- No kernel rule edits. The nine `kernel_denied` rules stay rule-level.
- No rule-body prose. Ids live in frontmatter, so the per-spawn payload does
  not grow.

## Acceptance Criteria

- [ ] AC-1 — The council's verdict on `obligation-granularity` is recorded at
      the blocker with its prompt.
- [ ] AC-2 — If option (a) is chosen: every non-kernel rule with a law section
      has stable obligation ids, and `check_enforcement_coverage` reports
      obligation counts per class beside rule counts with an unchanged exit
      code. If option (b) is chosen: the audit and the coverage report mark
      partial credit per rule, and Phases 2–3 are re-deferred with that reason.
- [ ] AC-3 — A published page states, for each of the sixteen gated rules,
      which obligations a gate refuses.
- [ ] AC-4 — Release finding `bfe1d6e6d8ca` carries a disposition.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council: blocker obligation-granularity | Granularity of `enforced_by` | Blocker `obligation-granularity`; the over-credit is shown in three audit rows | The council splits |
| D2 | reversible-technical | agent | Ids live in frontmatter | Rule bodies are paid on every spawn; a frontmatter key adds no body text | A host is found reading frontmatter into context |
| D3 | deterministic | evidence | An entry without ids keeps rule-level credit, counted as unbound | Changing every row's class in one change would make the delta unreadable | Unbound entries are still present after Phase 4 |

## Blockers

### blocker: obligation-granularity
- **Status:** open
- **Owner:** council
- **Blocks:** 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 5.1
- **What to do:** pick exactly one — (a) stable law ids `<rule>.<obligation>` in each non-kernel rule's frontmatter under `src/rules/`, and `enforced_by` entries bind to those ids in `src/scripts/check_enforcement_coverage.ts`; or (b) keep `enforced_by` rule-level and add a partial-credit annotation per rule that `./scripts-run src/scripts/report_obligation_mechanism --table` prints, with no id scheme.
- **Resolved when:** this entry records the council's choice, its dissent and the prompt sent, and `Status` reads resolved.
- **Recommendation:** (a). An annotation in (b) is prose a gate cannot read, so the next audit would over-credit the same way; ids make the credit checkable and let the delta in 4.2 be computed rather than written.
- **If you do nothing:** the coverage report keeps crediting whole rules for one gated clause, the 16/120 blocking figure keeps reading higher than what is refused, and finding `bfe1d6e6d8ca` stays undispositioned.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-06 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Ids drift from the law text they name | implementation | A reworded law can keep an id whose meaning changed. | 2.1's lint pins ids to rule prefixes and a reword fixture; 4.1 reads credit from gate code, not from prose. | Phase 2 — Every extracted law has a stable id |
| 2 | The blocking figure drops and reads as a regression | product | Per-obligation counting lowers the gated share without any gate changing. | 3.2 prints obligation counts beside the unchanged rule counts; 4.2 explains the delta per rule. | Phase 4 — The sixteen, re-read |
| 3 | A schema change to rule frontmatter trips the frontmatter validators | implementation | New keys meet `validate_frontmatter` and the rule schema. | 2.1 extends the schema in the same change and its test runs the validator over a fixture rule. | Phase 2 — Every extracted law has a stable id |
| 4 | Building before the council answers | implementation | Phases 2–5 assume option (a). | Every step after 1.1 carries the blocker marker; AC-2 states the (b) path. | Phase 1 — The granularity question goes to the council |
