# Analysis loop

The shared vocabulary of the four analysis doors — `analyze:reference`,
`analyze:and-optimize`, `analyze:pr` and `analyze:inbox` — loaded on demand by
each of them. The decision behind the family and every default named here is
[`ADR-288`](../../../../docs/decisions/ADR-288-analysis-family-one-engine-four-doors.md);
the mechanics are code under `src/scripts/analysis_*.ts`. This file is the
lookup surface, not a contract: ADR-118 forbids a loop-design contract, so the
caps live in each door's `limits:` block.

## Vocabulary

| Word | Means | Never means |
|---|---|---|
| **pass** | one extraction read of an inbox source set (inbox Phases 3–5) | a deepening iteration |
| **loop** | one deepening iteration by one analyst over its own analysis **and** its own roadmap | a re-read of the same draft |
| **round** | one exchange: every analyst reads the others' finals and reconciles | a loop |
| **run** | one invocation of a door, from scope resolution to its end state | a round |

## The brief

Every analyst of a run receives the **same brief**, digested; a brief digest
that differs between two analysts is a defect, not a variation. The brief is
frozen after scope resolution and at most one blocking scope question. A
mid-run owner message opens a **new brief revision**, recorded in the run with
its reason — it never edits the frozen one in place.

## The scope line

Every door prints, before any read:

```
Scope: <repo|module|subdir> <name> at <path> (anchor: <…>)
```

Resolved by `src/scripts/analysis_target.ts`. Inside a module the scope names
the module and `project_root` stays the outer project, with or without a marker
in the module's own `agents/`.

## The loop shape

Each loop is declared before it runs, in one line:

```
Loop N/M — <lens> — <falsifiable goal> — inputs: <…> — must produce: <…> — stop-if: <…>
```

### Deepening lenses (seed + three loops, all three always run)

1. **coverage** — what is there. Read code, not the README. What is wrongly
   marked missing.
2. **adversary** — every retained item tested against named
   counter-hypotheses: already present, contradicts a recorded decision, only
   different, cost, license. Killing nothing is legal when every test is
   recorded.
3. **overbuild-sequencing** — the smallest rung, duplicates folded, order.

Loops 4–5 (`--loops`, cap 5) run only while the previous loop added a top-tier
item. The summary prints the real loop count.

### Exchange loops (one round)

Each analyst receives the others' final analysis and roadmap, relabelled
A / B / C, and runs:

1. **inventory** — every foreign claim checked at the pin:
   `still-true / never-true / unverifiable`, with its tier.
2. **cross-exam** — the disputed claims, picked by `selectCrossExamTarget`; the
   prompt quotes each claim verbatim.
3. **converge** — the own roadmap revised, with a disagreement ledger.

Facts are settled by the tree, never by majority. A minority finding is
accepted or rejected with a reason, never dropped (`auditMinorityRetention`).

**After every exchange the run prints the gate's numbers** — `reason`,
`settleable`, `band` and `estimate`, the four fields `analysis_gate.ts`
returns. A gate whose numbers stay inside the process cannot be audited
afterwards: the run reads as *"it ran one more round"* with no trace of why.

**An offer is not a decision.** `offer: true` says a further round is
affordable and plannable, never that it happens. A further round runs only on
a **recorded council** verdict or a **recorded owner** answer, written where
the run's reader finds it; the estimate is an input to that decision and never
a substitute for it.

## Stages a door runs from the shell

```bash
./scripts-run src/scripts/analysis_target                 # the scope line
./scripts-run src/scripts/analysis_validate --run <run-dir> --root <project-root> <emitted file>…
./scripts-run src/scripts/analysis_run_record --run <run-dir>   # checks run.json
```

`analysis_validate` moves an `emitted` run to `validated` or names each failure;
`--content-only` skips the five tree gates and says so, for a run on a project
whose tree those gates do not read.

## Evidence tiers

| Tier | Means | Counts for stopping or "verified" |
|---|---|---|
| `executed` | a command or test was run and its output read | yes |
| `read` | the file or line was opened at the pin | yes |
| `claimed` | a source or an analyst says so | no |
| `inferred` | reasoned, not observed | no |

A loop with no `executed` or `read` evidence tied to a changed conclusion is
`no-external-signal` and does not count as a loop.

## Council roles

- **seat** — answers a question; never edits, runs or fetches.
- **synthesizer** — folds the seats' answers, names dissent.
- **gate judge** — decides the one-more-round offer (`src/scripts/analysis_gate.ts`).

Quorum is two seats from two providers; anything less is `single-voice`, said
in the run and never counted as a clearance. On safety or data-integrity
questions a critical dissent outweighs a majority.

## The `handoff-v1` shape for external analysts

An analyst outside this host returns one Markdown file:

```yaml
---
handoff: v1
phase: seed | deepen | exchange
loop: <N>
pin: <commit sha the analysis was made against>
consolidates: [<files this one folds, for lint_consolidation_lineage>]
---
```

Sections, in order: **Findings vs tree** · **Kills** · **Decisions** · **Steps
with `verify:`** · **Loop log**. Source names appear only in a sibling
`*.annex.md`, never in the handoff itself. The owner drops the file into
`agents/tmp/<round-id>/`; the engine never writes there.
