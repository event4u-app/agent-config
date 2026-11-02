---
complexity: standard
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-12-31
tree_pin: c183b82358
estate_growth_exempt: "Operator asked for this roadmap to be made active and processed in the same invocation (2026-11-02, /analyze:inbox … then /roadmap:process-full, one PR, merged). It closes and archives in that PR."
estate_offset_exempt: "grep -rlE 'promotes:|assurance-capability-registry|behavior-spec|dangling roadmap link|status values' over agents/roadmaps/*.md agents/roadmaps/later agents/roadmaps/stubs (whole roadmap tree) — no roadmap owns the registry truth, the ADR link repair or the template status wording; stubs/road-to-executable-specification-adapter owns only the executable-spec adapter (not promoted here)."
relates:
  - slug: stubs/road-to-executable-specification-adapter
    relation: disjoint
    note: "Arrival counted (18); promotion condition still unmet."
---

# Road to records that say what is true

> **Source:** `agents/tmp.old/inbox-2026-11-i/` (topic t2) — two agent drafts
> on acceptance that outlives its roadmap, beside an owner transcript.
> Re-verified at `tree_pin` on 2026-11-02.

## Goal

Before anything new records what a closed roadmap made true, the records that
already exist stop saying false things: the capability registry, the ADR links
to roadmaps, the decision-record location and the roadmap template's status
wording. All repairs, no new gate.

## Context — re-verified at `tree_pin`

| # | Claim | Status | Evidence |
|---|---|---|---|
| C04 | Registry says the trace format has "1 of 25" declarers; live run says 0 of 8 | still-true | `src/config/assurance-capability-registry.json:219`; `check_requirements_trace` |
| C09 | `behavior-spec` is `available` though `AGENTS.md` presence passes the grader | still-true | registry `:52-60`; `grade_target_readiness.ts:349-356` |
| C11 | Two decision-record locations | still-true | `technical-specification/SKILL.md:147` vs `adr-create/SKILL.md:8-10` |
| C03 | 40 dangling roadmap links in ADRs | still-true | `docs/decisions/` path sweep |
| C13 | Executable-spec stub arrival counter stale (17) | still-true | stub `:8` |
| C02 | Template says no other status values; `later/` uses `later` | still-true | `src/agent-src/templates/roadmaps.md:31` |
| C20 | Archive index lacks a disposition | **never-true** — `disposition` is derived | `src/scripts/build_archive_index.ts:18-29` |
| C21 | No currentness preflight | **overtaken** | `docs/contracts/roadmap-revalidation-v1.md` |

## Phase 1 — Registry and docs say the live truth

- [ ] **1.1 Trace-format text from live output (C04).**
      verify: `grep -c '1 of 25' src/config/assurance-capability-registry.json` = 0, and the new count matches `check_requirements_trace`.
- [ ] **1.2 `behavior-spec` to `degraded` with its limitation named (C09).**
      verify: `jq -r '.capabilities["behavior-spec"].state' src/config/assurance-capability-registry.json` prints `degraded`; registry and grader tests stay green.
- [ ] **1.3 One decision-record path (C11).**
      verify: `grep -c 'agents/decisions/' src/skills/technical-specification/SKILL.md` = 0.
- [ ] **1.4 Template status wording (C02).** Scope "no other status values" to
      the active tree and name `later` / stub values.
      verify: `grep -c 'There are no other status values' src/agent-src/templates/roadmaps.md` = 0.

## Phase 2 — Links and counters

- [ ] **2.1 Repoint dangling ADR roadmap links (C03).**
      verify: every `agents/roadmaps/…\.md` path in `docs/decisions/` exists (sweep prints 0 dangling).
- [ ] **2.2 Arrival count on the executable-spec stub (C13).**
      verify: `grep -c 'Arrivals:\*\* 18' agents/roadmaps/stubs/road-to-executable-specification-adapter.md` = 1.

## Owner decisions — carried, not executed here

| ID | Decision | Recommendation |
|---|---|---|
| E1/E3 | `promotes:` receipt at archive time (new gate) | Warn-first, then hard |
| E4 | `<slug>#AC-n` resolver + ratchet (council-reserved) | Report-only resolver first (55/123 test files unambiguous today) |
| E5 | Spec judge on the consumer `/work` path | Shadow first |
| M7.2 | Grader stops passing on `AGENTS.md` presence (flips consumer grades) | Yes |
| M6.4 | Narrow the Doc-Impact `.md` glob in the consumer template | Yes, WARN stays |
| D5 | Structured partial supersession (18 ADRs) | Yes, with migration |
| M6.1 | Ticket `acceptance` object form | Optional field, strings stay valid |

## Kill / decline register

| ID | Item | Reason |
|---|---|---|
| K12 | Tracked archive index | Untracked on purpose (`.gitignore`) |
| K20 | Legacy status normaliser | `disposition` already derived (C20) |
