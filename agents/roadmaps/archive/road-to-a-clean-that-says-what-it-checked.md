---
complexity: lightweight
status: ready
tree_pin: a3b91da693
execution:
  mode: autonomous
estate_offset_exempt: "Owner-directed in the invocation of round inbox-2026-11-s (2026-11-02): analyse, then run /roadmap:process-full on the emitted roadmaps in one PR. Written, executed and archived in the same change, so the active count is unchanged when the change lands. Owner search at a3b91da693 (grep -rlF for judge-security-auditor, security_ledger, SARIF, EOL_PRODUCT, unsupportedLockfiles, break-glass over agents/roadmaps/*.md, later/, stubs/) hit only stubs/road-to-sarif-and-stateful-residual-row (SARIF upload/export — a different mechanism from the import here) and later/road-to-authority-routing-mechanism (agent-internal break-glass)."
relates:
  - slug: road-to-a-security-chain-measured
    relation: disjoint
    note: "Its bench fixtures gain the needs_validation and look-alike-with-control cases (arrival recorded there); bench spend stays with that stub."
  - slug: road-to-a-release-record-that-says-what-it-reviewed-carried
    relation: disjoint
    note: "Self-review assessed rows, deterministic clustering and commit reachability (draft D6–D8) arrive there; not executed here."
---
# Road to a clean that says what it checked

> **Source:** `agents/tmp.old/inbox-2026-11-s/t2/` (round `inbox-2026-11-s`,
> topic t2 — an analysis of an external active-testing reference).

## Goal

A security verdict of "clean" from this suite always names what was walked and
how each candidate was closed. A rejected candidate names the control that
closes it, a confirmed one names the evidence against it and what would change
its severity, a static trace never claims high confidence, and a judge `apply`
carries the rows it assessed. Findings from an external scanner can enter the
ledger — as unverified input, never as coverage.

The detect → reproduce → fix → verify loop already exists natively for static
analysis plus the consumer's own test suite (`/audit code full|retest`,
`security-audit` § 1b and § 6). This roadmap closes the field and closure gaps
in it; it builds no dynamic testing runtime.

## Non-goals

- No native live/dynamic probe kit, no run-adapter for a third-party tool, no
  egress guard, no scheduled dynamic scan — owner question OQ-59.
- No mandatory third-party dependency, no new CLI verb (a mode under
  `audit:code` only), no default-on telemetry, no LLM dedup as a gate.
- The external reference is never named in the tree.

## Phase 1 — The ledger records how a candidate was closed

- [x] **1.1 Schema v2.** `security_ledger.ts` and <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `schemas/security-ledger.schema.json` accept `schema_version` 1 or 2.
      Under v2 a `rejected` finding carries `control: {path_line, quote}` — the
      control that closes it — and a `confirmed` finding carries
      `counterevidence` and `severity_change`. v1 ledgers stay valid, so no
      ledger already written breaks.
      verify: `npx vitest run tests/scripts/security_ledger.test.ts` -> 0
- [x] **1.2 Confidence is capped by proof.** Optional `confidence: <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      low|medium|high`; `high` requires `proof: test`, at any version.
      verify: `npx vitest run tests/scripts/security_ledger.test.ts -t "caps confidence"` -> 0
- [x] **1.3 Fix verification is recorded whole.** Optional <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `fix_verification: {retrace, bypass_note, proof_green}`; present means
      all three are present.
      verify: `npx vitest run tests/scripts/security_ledger.test.ts -t "partial fix_verification"` -> 0
- [x] **1.4 The report shows it.** `renderLedger` prints the control of each <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      rejected candidate and the counterevidence of each confirmed one.
      verify: `npx vitest run tests/scripts/security_ledger.test.ts -t "prints the control"` -> 0
- [x] **1.5 The skill says it.** `security-audit` § 1b/§ 6 output: "no callers <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      found, the build failed or the rollout state is unclear ⇒ `needs_validation`,
      never `rejected`", and the v2 fields. Verify: `tests/scripts/security_ledger.test.ts`
      — a v2 `rejected` with only a reason, a v2 `confirmed` without
      counterevidence, a static-trace `high`, and a partial `fix_verification`
      each produce a problem (red before 1.1–1.3).
      verify: `grep -c "unknown rollout state is" src/skills/security-audit/SKILL.md` -> /^[1-9]/

## Phase 2 — A judge `apply` carries its rows

- [x] **2.1 Coverage block.** `judge-security-auditor` output gains a <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `Coverage:` block (`surface · closure · anchor`); an `apply` with zero
      rows is not an `apply`.
      verify: `grep -c "Coverage (every verdict" src/skills/judge-security-auditor/SKILL.md` -> /^1$/
- [x] **2.2 Synthesis renders it.** `judge-synthesis` prints <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `apply (0 findings · N rows assessed)` and reads "clean, with gaps" when a
      row is `needs_validation`, never a bare `apply (0)`.
      verify: `grep -c "apply (0)" src/skills/judge-synthesis/SKILL.md` -> /^0$/
- [x] **2.3 The diff mode widens to callers of a touched guard.** `/audit code <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      diff` (`audit/command.md` § 7) and `security-audit` § 1b: a diff touching
      a guard, policy or middleware adds the guard's callers via code-graph
      impact; the widening is never reported as full-repo coverage.
      verify: `grep -c "callers of it via" src/domains/engineering-base/audit/command.md` -> /^1$/

## Phase 3 — The threat model survives, and dual-use wording points at a rule that exists

- [x] **3.1** `/threat-model` option 3 writes the report into the change's plan <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      or roadmap (a `## Threat model` section) instead of an unnamed deliverable.
      verify: `grep -c "## Threat model" src/domains/engineering-base/threat-model/command.md` -> /^[1-9]/
- [x] **3.2** `judge-security-auditor` reads an existing `## Threat model` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      first and amends it rather than re-deriving; "threat model unclear" is a
      verdict only when none exists.
      verify: `grep -c "## Threat model" src/skills/judge-security-auditor/SKILL.md` -> /^[1-9]/

- [x] **3.3** `threat-modeling` and `authz-review` cite <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `never-help-build-offensive-cyber-capability`, which is no rule in this
      tree (and no rule covers it). Drop the citation, keep the refusal inline, and state once that a
      negative test against the project's own code in its own suite is not an
      offensive step. Verify: `grep -rn never-help-build-offensive src` → 0.
      verify: `grep -rc never-help-build-offensive src --include=SKILL.md` -> /^(?!.*:[1-9]).*$/

## Phase 4 — Shipped CI templates pin the package

- [x] **4.1** `memory-hygiene.yml` and `roadmap-progress-check.yml` call <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `npx @event4u/agent-config` without a major; pin `@<major>` so
      `release_env` bumps it with the others.
      verify: `grep -c "agent-config@19" src/agent-src/templates/github-workflows/memory-hygiene.yml` -> /^1$/
- [x] **4.2** A test asserts every `@event4u/agent-config` invocation under <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `src/agent-src/templates/github-workflows/` carries `@<major>` (red on 2
      files before 4.1). Action SHA pinning stays an owner choice (OQ-59).
      verify: `npx vitest run tests/scripts/workflow_templates_pin.test.ts` -> 0

## Phase 5 — An external scanner's findings enter as input

- [x] **5.1** `agent-config audit:code import <sarif> [--root]` maps a SARIF <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      2.1.0 file into a new ledger: every result becomes `needs_validation`
      with open fact "imported, not re-verified", every location a
      `model`-enumerated row, so coverage does not move. No network, no
      dependency.
      verify: `npx vitest run tests/scripts/code_audit.test.ts` -> 0
- [x] **5.2** `audit/command.md` § 7 documents the mode. Verify: <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `tests/scripts/code_audit.test.ts` — an import yields 0 confirmed and
      unchanged coverage; today the mode exits 2.
      verify: `grep -c "audit:code import" src/domains/engineering-base/audit/command.md` -> /^[1-9]/

## Phase 6 — Arrivals on the owners that hold the rest

- [x] **6.1** `stubs/road-to-a-security-chain-measured` gains the <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      `needs_validation` and look-alike-with-control fixture cases and an
      `Arrivals:` line.
      verify: `grep -c "Arrivals:\*\* 2" agents/roadmaps/stubs/road-to-a-security-chain-measured.md` -> /^1$/
- [x] **6.2** `later/road-to-a-release-record-that-says-what-it-reviewed-carried` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      gains the assessed-rows, clustering and commit-reachability items and an
      `Arrivals:` line.
      verify: `grep -c "A.3 A commit pin resolves" agents/roadmaps/later/road-to-a-release-record-that-says-what-it-reviewed-carried.md` -> /^1$/

## Decisions

| # | Decision | Rung | Revisit-if |
|---|---|---|---|
| 1 | Keep `rejected`/`needs_validation`, add fields under schema v2 rather than renaming states | tree evidence: v1 consumer schema is shipped | a v1 ledger reader outside this package appears |
| 2 | Dynamic/live testing is not built here; the two source drafts contradict each other on it | owner question OQ-59 | owner answers OQ-59 |
| 3 | SARIF import, not a run-adapter, is the tool-neutral integration | constraint: no mandatory third-party dependency | a consumer needs findings the import cannot carry |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-02 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Imported findings read as verified | implementation | A SARIF result counts as coverage or as confirmed | Import writes only `needs_validation` + `model` rows; the test pins 0 confirmed and unchanged coverage | Phase 5 |
| 2 | v2 breaks existing ledgers | compatibility | A required field rejects a ledger written before | v2 rules apply only at `schema_version: 2`; v1 test cases stay green | Phase 1 |

## Acceptance Criteria

- [x] AC-1 — A v2 ledger cannot reject a candidate without naming its control.
- [x] AC-2 — A static-trace finding cannot claim `high` confidence.
- [x] AC-3 — A judge `apply` renders the rows it assessed.
- [x] AC-4 — `grep -rn never-help-build-offensive src` returns nothing.
- [x] AC-5 — Every shipped workflow template pins the package major.
- [x] AC-6 — A SARIF import leaves coverage unchanged and confirms nothing.
