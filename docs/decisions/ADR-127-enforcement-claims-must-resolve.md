---
adr: 127
status: accepted
date: 2026-07-25
decision: enforcement-claims-must-resolve
supersedes: —
superseded_by: —
phase: road-to-enforcement-proof · P1–P5
type: structural
review_trigger: >-
  When resolved enforcement coverage stops rising across two consecutive
  releases while rules keep being added — that would mean the field is being
  filled in to satisfy the gate rather than to record a real backstop, and the
  ratchet has become ceremony. Also reopen if a `validator:` declaration is
  found resolving green through an indirection that does not actually execute
  it, which would mean the reachability test has itself become fail-open.
---

# ADR-127 — An enforcement claim must resolve, not merely exist

## Status

**Accepted** · 2026-07-25.

## Context

A source-level comparison against an external governance reference surfaced one
defect class this package could not see from the inside: **prose that asserts
enforcement the code does not deliver.** Four verification agents re-read every
load-bearing claim against this repo's own source. Five instances survived
verification:

- `src/rules/output-discipline.md` asserted "violations cause a CI exit-code-2"
  while `lint_output_slop.ts` shipped and was wired into nothing.
- `check_kernel_rule_bundle.ts` — the one-kernel-rule-per-PR slow-rollout gate —
  watched `.agent-src.uncondensed/rules`, a tree retired in the ADR-051 move to
  `src/`. A path that cannot exist never matches, so the gate reported "no kernel
  rule touched" for every kernel-rule edit, indefinitely.
- `docs/contracts/subagent-boundary.md` stated as fact that "every floor applies
  inside the subagent"; the brief schema, the spawn composer, and all eight
  worker-prompt templates contained no floor text at all.
- The override layer documented no non-overridable class, so the shipped consumer
  README described unconditional whole-file shadowing — an empty file at
  `agents/overrides/rules/non-destructive-by-default.md` reading as a way to
  remove the Hard Floor.
- 128 ADRs, zero naming a revisit condition, because ADR frontmatter was
  **entirely unvalidated** — `validate_frontmatter.ts` covered skills, rules,
  commands, and personas and nothing covered `docs/decisions/`.

Nothing in the existing gate set could detect any of them, for one shared reason:
**every gate checked that a pointer resolves, never that a claim is true.** The
claims ledger is the clearest case — three evidence forms, all existence checks
(file present, substring present, URL carries a date), and a `last_verified`
field that is parsed and compared to nothing.

The reference object's most transferable norm, and the one adopted here: a rule
with no feasible enforcement tier is deleted rather than kept as honor-system
theatre, and a check with no real input is left unwired rather than run as
decoration. Notably, the reference violates its own version of this in two places
(a nucleus its ADR sizes at "~15 lines" that is 9; a freshness check its ADR
promises as FAIL that registers WARN) — which is itself evidence that the defect
class is structural, not a lapse of care.

## Decision

**An enforcement claim is credited only when it resolves against the filesystem
AND the wiring. Declaration is not evidence.**

1. Rules carry `enforced_by:` — `hook:` / `validator:` / `test:` / `observer:` /
   `none` — and `check_enforcement_coverage.ts` **resolves** each value. A
   `validator:` whose script exists but is reachable from no taskfile, workflow,
   or hook manifest resolves to `unwired`, not covered. Reachability is
   transitive, so a sub-check running under a wired umbrella counts; a mention in
   a comment does not.
2. **Blocking and instrumenting are different tiers.** A hook registered
   `fail_closed: false` resolves to `observer`, never `validator`. Of 18
   registered hooks, exactly one can block.
3. `none` is legal and **counted**. Undeclared rules count as uncovered, not as
   excluded — a coverage number over only the rules that opted in would be
   flattering and useless. The published figure is 14 of 107 (13.1%).
4. **Kernel and safety-floor rules are non-overridable, with a registry.** A
   `replace`-mode override on one is refused; an `extend` (a tightening) requires
   an entry in `agents/overrides/kernel-exceptions.yml`. Direction matters, not
   identity — this package's own legitimate override *tightens*
   `verify-before-complete`, and a blanket name ban would forbid it.
5. **The override audit reports; it does not pretend to police.** A build-failing
   lint on kernel-named override files would guard one of several routes by which
   a consumer can tell a model to ignore a rule, and would relocate the rest out
   of sight while reading as coverage. It hard-fails only on this package's own
   authoring surface, where the coverage claim is true.
6. **The subagent floor is generated and delivered.** Derived from the kernel rule
   list, written into every dispatch prompt in `src/` **and** the shipped
   `dist/agent-src/` projection, drift-gated with a FAIL.
7. **ADRs name a revisit condition, not a cadence.** Required from 2026-07-25
   forward, grandfathered by date rather than by an allowlist. A bare "annually"
   is rejected — a calendar review is ignored; an event fires.
8. **`exec:` evidence is scheduled by measurement, not by appeal.** The threshold
   (≥ 10 pp of the backed ledger) was pre-registered before the count was taken;
   the measured figure is 10 of 25 feasible (40 pp) against 0 today, so it
   proceeds — in its own PR, not this one.

## Consequences

**Good.** The defect class is now continuously measurable and ratcheted: blocking
coverage may not fall and unwired declarations may not rise. Two live defects
were closed on the first run (D1, and the kernel gate watching a dead path), and
a third — the floor missing from the shipped projection — was caught by grepping
`dist/` after the generator's first pass. The kernel rule list is single-sourced,
ending three copies and two "kept in sync with…" comments.

**Cost.** 86 rules are undeclared and drag the published number down; that is
intended, and it means the headline figure will look bad until the field is
filled in honestly. `enforced_by` is a schema change on an
`additionalProperties: false` schema, so it cannot be added ad hoc.

**Accepted limits, stated rather than papered over.** The override carve-out is a
norm with a partial gate: the layer is model-resolved, so an `extend` block whose
prose says "ignore the above" passes, and other relax routes (a persona file,
host config, a direct instruction) are outside its view. The subagent floor
covers dispatches through this package's templates; whether a host-native spawn
inherits anything is a host property this package does not control and does not
claim. `non-destructive-by-default` remains `enforced_by: none` — no script can
enforce "ask before you deploy", and adjacent hooks guard hook-bypass rather than
destructive intent, so claiming them would inflate the number.

## Alternatives

- **Declaration-only `enforced_by`.** Rejected: it would have rated
  `output-discipline` as enforced, which is the exact defect that motivated this.
- **Blanket ban on kernel overrides.** Rejected on both council members'
  reasoning: it forbids legitimate tightening, including this repo's own.
- **A build-failing kernel-override lint.** Rejected as security theatre — see
  Decision 5.
- **Build `exec:` evidence first.** Rejected on sequencing: without the coverage
  baseline there was no way to know whether a new evidence form, validator, and
  renderer would move falsifiability by 7% or 60%.
- **Retrofit `review_trigger` across all 83 structural/security ADRs.** Rejected:
  it would mean inventing ~80 conditions to satisfy a field. Three ADRs with
  demonstrably time-bound premises were retrofitted (ADR-016, ADR-109, ADR-110).

## References

- `internal/reports/enforcement-coverage.json` — the ratcheted baseline.
- `internal/reports/exec-evidence-feasibility.json` — the pre-registered
  measurement and its decision.
- `docs/proof.md` § 2b — the published coverage figure and the ledger's own limit.
- `docs/contracts/subagent-boundary.md` § Honest scope of the floor guarantee.
- `src/agent-src/contexts/override-system.md` § The non-overridable class.
- ADR-051 (`src/` as source of truth) — the move that silently disarmed the
  kernel-bundle gate.
