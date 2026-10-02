---
complexity: lightweight
status: ready
execution:
  mode: autonomous
estate_offset_exempt: "Round inbox-2026-10-c measured that 35 of 106 routed rules have no Iron-Law section, and an AI council (2/2, 2026-10-01) decided that both the thinned stub and the 8,000-char runtime delivery carry exactly that section, copied from source and never summarized. Without this file the carrier and the installed-layer flip would ship a standing form 35 rules cannot fill. No active roadmap owns rule-body structure: the last payload diet closed on a different lever, and folding this into the flip would make one PR change both what a rule says and where it lands."
relates:
  - slug: road-to-a-rule-carrier-that-works-outside-the-repo
    relation: disjoint
    note: Same round. That file delivers law sections at runtime; this one makes sure every routed rule has one, and declares the class whose law stands.
  - slug: road-to-an-installed-layer-that-is-thinned
    relation: disjoint
    note: Same round. That file writes the stub form this one defines into the installed layer.
---
# Road to rule laws that can stand

> **Source:** `agents/tmp.old/inbox-2026-10-c/` — a round of four roadmap drafts
> and one transcript on the host's 150k instruction-budget notice, pinned to
> `main` @ `9bc8cd4f2` (16.2.0). Verified against `main` @ `a03f60c46` on
> 2026-10-01. Council record:
> `agents/evidence/council/inbox-2026-10-c-standing-form.md`.

## Goal

Every routed rule states its obligation in one section short enough to stand on
its own, and a declared class of high-consequence rules carries that section in
its thinned stub. Done means: no routed rule lacks a law section, no law section
exceeds 2,000 characters without a reviewed, expiring exception, history and
mechanism discussion live behind `load_context` without moving an obligation,
and `build_thin` writes stub-plus-law for exactly the class a falsifiable
criterion selects.

## Context

Reproduced on 2026-10-01:

- A heading match `^#+ .*Iron Law` over the router's 106 tier rules finds 71
  with a law section and 35 without, among them `runtime-safety` and
  `tool-safety`. Several of the 35 state a law in bold text or a fence rather
  than under a heading, so the count is an upper bound on what is missing.
- Law sections: median 511, p90 1,787, max 5,392 (`roadmap-progress-sync`).
- `session-canary` strips to 8,392 characters, of which the Iron-Law section is
  343 and one enforcement-history section 5,672. The host named it, together
  with `decision-revisit-gate` (9,959) and `design-fidelity` (9,116), as the
  three largest instruction files on a default install.
- 107 rule files carry an `# obligation: line N` marker, and
  `report_obligation_carriers` counts carriers per rule, so an obligation move
  has a before-and-after witness already.
- `load_context` already routes depth out of 18 rule files.

## Phase 1 — Law first, in the source

- [x] **1.1 Every routed rule has a law section.** A lint with a shrink-only
      baseline: the rules without one are recorded by id and may only leave the
      baseline. A new routed rule without one fails.
      verify: `npx vitest run tests/scripts/lint_rule_law_section.test.ts` -> 0
- [x] **1.2 Ceilings on the law section.** Target 1,200 characters, reported;
      hard 2,000, failing. A rule above 2,000 today is baselined by name with an
      owner and a review date; a baselined rule may only shrink.
      verify: `npx vitest run tests/scripts/lint_rule_law_section.test.ts -t ceiling` -> 0
- [x] **1.3 A ceiling on the whole body.** 8,000 characters after frontmatter
      and comment strip, shrink-only, with today's larger rules baselined by
      name. A body is what a full runtime delivery carries, so it is priced in
      the same unit.
      verify: `npx vitest run tests/scripts/lint_rule_law_section.test.ts -t body-ceiling` -> 0
- [x] **1.4 History behind `load_context`.** Move enforcement history and
      mechanism discussion out of `session-canary`, `decision-revisit-gate` and
      `design-fidelity` first, into a context file each rule names in
      `load_context`. Nothing is deleted and no obligation moves: the obligation
      marker still resolves to the same sentence, and
      `report_obligation_carriers` reads the same counts before and after.
      verify: `npx vitest run tests/scripts/report_obligation_carriers.test.ts -t moved-history` -> 0

## Phase 2 — The class whose law stands

- [x] **2.1 A falsifiable consequence criterion.** A rule is high-consequence
      when its obligation governs an irreversible external action, a security or
      data-exposure boundary, or an authority bypass. The criterion is written
      into the rule schema's documentation, and each class member records which
      clause it meets. The list is what the criterion produces, not a list
      chosen first.
      verify: `npx vitest run tests/scripts/rule_consequence_class.test.ts` -> 0
- [x] **2.2 The standing law is the source law.** `build_thin` gains one form:
      stub plus the rule's own law section, byte-copied and digest-checked, for
      class members only. A class member whose law section is missing or over
      2,000 characters fails the projection rather than shipping a shortened
      copy.
      verify: `npx vitest run tests/scripts/project_thin_rules.test.ts -t law-in-stub` -> 0
- [ ] **2.3 The thinned weight, measured.** Record the default- and
      maintainer-scope standing totals of the thinned tree with the class in
      place, in the installed-layer report's unit, against the 65,000 target and
      75,000 hard ceiling.
      verify: `grep -c 'law-in-stub' agents/evidence/analysis/thinned-standing-weight-*.md` -> /^[1-9]/

## What this roadmap deliberately does not do

- No compiled or summarized contract. The council rejected an authoritative
  second representation of a rule: a contract that omits a clause reads as
  permission.
- No rule shortened to fit a number. A rule that cannot state its law under
  2,000 characters takes a reviewed exception, and many exceptions are evidence
  the format is wrong.
- No change to which rules are installed or how. That is
  `road-to-an-installed-layer-that-is-thinned`.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | contested-technical | council:inbox-2026-10-c-standing-form | The standing text is the source law section, copied and digest-checked, never compiled | Both seats, 2/2: a compiled contract is a new trust boundary whose omissions read as permission | A schema plus clause-level traceability exists that makes a compiled form checkable |
| D2 | contested-technical | council:inbox-2026-10-c-standing-form | Law target 1,200, hard 2,000 with expiring exceptions | Both seats; current p90 is 1,787, so 2,000 covers the distribution without truncation | More than a handful of rules need exceptions |
| D3 | contested-technical | council:inbox-2026-10-c-standing-form | The class is selected by a consequence criterion, not by the name "safety" | Both seats called the 14-rule list ungoverned | A class member's obligation turns out to be advisory, or a rule outside it causes an irreversible action |
| D4 | reversible-technical | agent | Existing rules are baselined, not rewritten in bulk | A bulk rewrite spends authoring effort on text the flip may still move; the baseline only lets them shrink | — |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-01 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A law section is written to pass the lint, not to carry the rule | product | A rule gains a heading over a sentence that is not its obligation, and the stub then stands with the wrong text. | 1.4's obligation-marker check ties the law to the marked sentence; 2.2 copies only what the marker resolves into. | Phase 1 — Law first, in the source |
| 2 | Moving history breaks an inbound link | implementation | Other rules, skills and docs link into the sections 1.4 moves. | The reference checker runs over the change; moved sections keep their anchor in the new context file. | Phase 1 — Law first, in the source |
| 3 | The criterion admits too many rules | product | A broad reading of "security boundary" pulls most rules in and erases the standing saving. | 2.3 records the weight against 65,000; a class that overshoots is a criterion to narrow, not a ceiling to raise. | Phase 2 — The class whose law stands |

## Acceptance Criteria

- [ ] AC-1 — Every routed rule has a law section or is in a shrink-only baseline.
- [ ] AC-2 — No law section above 2,000 characters without a dated exception.
- [ ] AC-3 — `build_thin` writes stub-plus-law for exactly the criterion's class,
      byte-equal to the source section.
- [ ] AC-4 — The thinned standing weight is recorded against the 65,000 target.
