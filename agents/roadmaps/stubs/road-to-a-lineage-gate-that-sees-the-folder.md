---
complexity: lightweight
review_by: 2026-12-07
---

# Stub: road to a lineage gate that sees the whole inbox folder

> **Stub — not active work.** Found 2026-09-07 while landing the source-fidelity
> change to [`/analyze:inbox`](../../../src/domains/analysis-workbench/analyze/inbox/command.md),
> which cites `lint_consolidation_lineage` as the mechanism behind its Phase 2
> `lineage` column. Measuring that run's own worst round showed the gate does not
> see most of the folder it is pointed at. Recorded here rather than repaired
> drive-by: the two defects below change the gate's scan population and its
> finding semantics, and its shape was set by a recorded council decision
> (2026-08-27, anthropic + openai, 2/2 convergent, E1=b / E2=report) that a
> widening must be argued against, not around.

## The two defects

**1. The scan population is a `road-to-*` glob, and an inbox folder is not.**

```ts
// src/scripts/lint_consolidation_lineage.ts
const ROADMAP_RE = /^road-to-.*\.md$/i;
```

Files arriving in an inbox round are routinely named `AC-<TOPIC>-...md`,
`ac-<topic>-loop-N-...md`, `agent-config-<topic>-deep-roadmap-...md` and
`ANNEX-*`. None matches. Measured over round `inbox-2026-09-r`: **31 of 55
supplied `.md` files scanned**, leaving 284 checkbox steps and ~36,500 lines
outside the gate's view. The `omitted-sibling` finding is computed against the
set of files the glob admitted, so an omission whose parent is a non-`road-to-*`
sibling cannot be expressed.

**2. An artifact that declares zero parsed parents is skipped in silence.**

```ts
if (a.decl.parents.length === 0) continue;
```

`unparseable` — a prose claim with no extractable set — is a finding.
`parents.length === 0` after a successful parse is not, and the two are not
distinguishable to a reader of the output. Two consolidation masters in that
round each assert a complete parent set in prose while omitting a later sibling
that openly criticises them, and neither produces a finding. The re-run on
2026-09-07 reports **2 findings, both in one topic**; the two omissions measured
by hand are in two other topics.

## Why this is not a one-line widening

Widening `ROADMAP_RE` raises `scanned`, which is the safe direction for the
`min_scanned` floor in `src/config/gate-coverage.yml`. It also raises the
sibling set every `omitted-sibling` finding is computed against, and the gate's
own header records that an unrestricted predicate fired **9/9 false positives**
on its first run over the census folders — the reason the current predicate is
deliberately narrow. A wider glob without a matching narrowing of what counts as
an omission reproduces that storm on a larger population.

The zero-parent skip is a semantics question, not a bug fix: making it a finding
turns every non-consolidating file in a folder into a row. The useful shape is
probably a third state — *declares a consolidation, parses a set, and the set is
empty* — but that requires deciding what `parseDeclaration` returning `[]` means
for each of its six recognised spellings.

## What closes this stub

1. A measured false-positive rate for the widened predicate over the four census
   folders named in `agents/evidence/analysis/consolidation-lineage-census-2026-08-26.md`,
   at or below the rate the current predicate carries.
2. The zero-parent state either given its own finding code or documented in the
   gate's header as deliberate, with the reason.
3. `scanned` re-measured and the `gate-coverage.yml` row updated in the same
   change.
4. A `--self-test` case per new finding code, per that row's existing contract.

Any of the three that turns out to be the wrong move is a complete outcome if it
is recorded as such — an honest "the narrow predicate is correct and the inbox
population should be scanned by something else" closes this stub as legitimately
as a widening.

## Why it matters to the caller, not just to the gate

`/analyze:inbox` Phase 2 fills its `lineage` column from this gate, and Phase 5
turns anything other than `n/a` / `complete` into a mandatory discharge — fold
the omitted parent in, kill it with a reason, or state it was read and adds
nothing. A gate that reports `n/a` for an unscanned file hands that phase a clean
bill for a folder it never looked at, and the discharge obligation never fires.

The caller's own mitigation, landed in the same change that found this: Phase 2b
groups a folder into source sets by filename stem and requires a hand diff across
each revision family, which reaches the undeclared families this gate is not
looking for. That mitigation is model-carried prose. This stub is what would make
it deterministic.
