---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "lane 5 of road-to-leading-every-row"
relates:
  - slug: road-to-skill-menu-economy
    relation: extends
    note: "parked; its K2 (no byte-shaving budget) is honoured — this lane measures precision, it does not shave descriptions"
  - slug: road-to-delivery-on-hook-hosts
    relation: extends
    note: "parked; § Phase 3 here uses the observed-true row shape its blocker at :817 defines, so there is one instrument, not two"
  - slug: road-to-deferred-rule-retriever
    relation: extends
    note: "parked; ADR-272's review_trigger (a conditional-loading mechanism tested under a 2,048-byte hook surface) is that roadmap's wake, not this lane's"
---
# Road to a menu whose precision is measured

> **Source:** ten-package code audit (2026-09-28), rows Skill routing 3,
> Context discipline 5 against S9 at 6/7. Tree facts at `8de8a4c`: routing
> precision is measured on **26 labelled prompts**
> (`tests/eval/corpus-{dev,non-dev}.yaml`, `measure_skill_ranker_baseline.ts:10-13`);
> the routing matrix (`tests/eval/routing-matrix/`) carries no expected-skill
> labels (its Defect A); trigger corpus 101/299 (`check_routing_coverage`
> ratchet); descriptions capped at 200 chars by `skill.schema.json:28` with
> median 181; the skills-catalog byte bucket is already a shrink-only ceiling
> (`check_preamble_payload_budget.ts`, `preamble-payload-budget.json:11`);
> install already refuses global/project rule overlap
> (`install.ts:2069-2140`, three tests); `rule-inject` cap already lowered to
> 16,384 on 2026-09-08 with measured truncation (`hook-token-budget.json:35-42`).

> **corrected-from-reproduction (2026-09-29, /analyze:inbox t06).** The supplied
> file was reproduced against `main` read-only. Every `file:line` in its Source
> block resolved. ONE correction applied: the Risk Register `Risk type` column
> used values outside the enum `lint_plan_risk_register` enforces (`product` |
> `implementation`), which `status: draft` exempts and which reds the file the
> moment it flips to `ready`. The column is normalised; nothing else changed.

## Goal

Routing precision is a number with an interval on a labelled corpus large
enough to carry one (≥ 100 prompts, ≥ 3 per pack), every skill has a trigger
corpus, the menu census is per profile, and path-scoped rule delivery is
tested on one consumer before anyone argues about routers or byte budgets.

## Prerequisites

- `measure_skill_ranker_baseline.ts`, `check_routing_coverage.ts`,
  `report_skill_menu_census.ts`, `report_host_injection_effect.ts` exist and
  run.

## Phase 1 — A corpus that can carry a number

- [ ] **1.1 Label the routing matrix.** Add `expected_skills: []` to every
      prompt in `tests/eval/routing-matrix/` (496 lines today) and add prompts
      until every pack has ≥ 3 labelled prompts and the total is ≥ 100; labels
      are written by a person or a fresh council seat, never by the ranker
      under test. Record the labelling protocol in the corpus README.
      verify: `tests/eval/routing-matrix/README.md` states the protocol;
      `measure_skill_ranker_baseline --corpus routing-matrix` reads ≥ 100
      labelled rows.
- [ ] **1.2 Precision with an interval.** `measure_skill_ranker_baseline`
      reports top-1 and top-3 hit rate with `wilsonInterval`
      (`_lib/capture_rate.ts:90`) and refuses to print a verdict below
      n = 100 (`underpowered`).
      verify: report for the 26-prompt corpus prints `underpowered`; for the
      labelled matrix prints two intervals.
- [ ] **1.3 The number lands in the scorecard.** The skill-routing row of lane
      9's register cites the report as `evidence_uri`; evidence state
      `exercised`.
      verify: register row updated; `check_scorecard_register` green.

## Phase 2 — Coverage to 299

- [ ] **2.1 Touched-skill ratchet in `check_routing_coverage`.** A PR that
      touches a skill without `evals/triggers.json` fails; the census lists
      the remaining 198 by pack in `docs/SKILL_CENSUS.md`.
      verify: fixture PR touching a corpus-less skill fails; census section exists.

## Phase 3 — Path-scoped delivery, measured once

- [ ] **3.1 Emit `paths:` frontmatter on projected `type: auto` rules for the
      hosts whose rule loader honours it**, behind a setting default off;
      measure on one consumer with `report_host_injection_effect` using the
      `observed-true` row shape `later/road-to-delivery-on-hook-hosts.md:817`
      defines.
      verify: one before/after report committed under
      `agents/evidence/analysis/`; the setting flips default on only if the
      report shows the rule absent from sessions that never touch its paths,
      else the step is marked `[-]` with the report cited.

## Phase 4 — Census per profile

- [ ] **4.1 `report_skill_menu_census --profile minimal|balanced|full`**
      (`install.ts:301 SUPPORTED_PROFILES`) writes `menu_bytes` per profile;
      the existing skills-catalog ceiling stays the gate (no second ratchet).
      verify: report prints three numbers; `check_preamble_payload_budget`
      unchanged and green.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-28 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Labels written by the ranker's author encode the ranker | product | Precision looks high because labels agree with lexical matches | Labelling protocol excludes anyone who read the ranker's scoring; a 10 % blind relabel by a second seat is recorded | Phase 1 — A corpus that can carry a number |
| 2 | Path-scoped rules hide a rule a session needed | product | A rule absent when a touched path fell outside its glob | Default off; measured once; flip only on the report | Phase 3 — Path-scoped delivery, measured once |

## Acceptance Criteria

- [ ] AC-1 — The routing matrix carries ≥ 100 labelled prompts with a written
      protocol and the baseline prints top-1/top-3 with Wilson intervals.
- [ ] AC-2 — The skill-routing register row cites the report.
- [ ] AC-3 — A PR touching a corpus-less skill fails the coverage ratchet.
- [ ] AC-4 — One path-scoping effect report exists and the setting default
      matches its conclusion.

## Provenance

Source-derived (template rule 19). Pre-council draft.

| Descriptor | Token | Drawn in, per defect |
|---|---|---|
| S7 — best-practice curation | `ENC1:<mint>` | path-scoped rules via `paths:` frontmatter (3.1) |
| S9 — phase-loop reference | `ENC1:<mint>` | 100-char description lint noted and **not** adopted (K2 of the parked economy roadmap) |

Gap-table: KEEP 1.1–1.3, 2.1, 3.1, 4.1; CUT "description byte budget"
(schema cap 200 exists; economy K2), "menu-bytes ratchet"
(`check_preamble_payload_budget` exists), "install single-copy check"
(`_gate_rule_layer_overlap` exists), "lower rule-inject to 8192" (already
lowered with measured truncation; argument inverted), "retire ADR-272
downward" (its trigger is the deferred-rule-retriever, not a measurement).
