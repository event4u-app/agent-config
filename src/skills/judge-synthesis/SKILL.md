---
model_tier: high
name: judge-synthesis
description: "Use to consolidate multiple already-run judge verdicts into one report — consensus, conflicts, must-fix/should-fix with per-judge provenance. Consume-only, no opaque score, never auto-gates."
domain: quality
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# judge-synthesis

> You are the **synthesizer** across an already-run set of judges. You do **not**
> run the judges and you do **not** re-judge — you **consume** their emitted
> verdict blocks and produce one structured report: a side-by-side verdict
> table, the **consensus** findings (flagged by ≥2 judges = highest confidence),
> the **conflicts** (judges that disagree), and a synthesized
> **must-fix / should-fix / advisory** split with per-finding judge provenance.
> No opaque single score. Never auto-gates — the human decides.

## When to use

* Two or more judges have run on the same target and their verdict blocks need
  to become one decision-ready report.
* A **mixed** review spanning code judges + the artifact/defence judges (e.g. a
  PR that ships a roadmap + code + an injection-defense fixture) — no single
  existing command consolidates across all seven lenses.
* `/review-changes` step 5 (consolidation) wants the canonical synthesis format
  instead of an ad-hoc merge.

Do NOT use when:

* Only one judge ran — there is nothing to synthesize; surface that judge's
  block directly.
* You need to **produce** a verdict — that is the individual judge's job
  ([`judge-bug-hunter`](../judge-bug-hunter/SKILL.md),
  [`judge-artifact-completeness`](../judge-artifact-completeness/SKILL.md),
  [`judge-injection-defense`](../judge-injection-defense/SKILL.md), etc.).
* You are tempted to compute a single quality number — forbidden (see Do NOT).

## Inputs

The verdict blocks the judges already emit. Each carries at minimum a judge
name, a verdict, and zero or more findings with a severity. The three verdict
vocabularies in the suite map onto one ordered severity axis:

| Judge family | Verdict vocabulary |
|---|---|
| code judges (`judge-bug-hunter`, `-code-quality`, `-security-auditor`, `-test-coverage`, `architecture-review-lens`) | `apply` / `revise` / `reject` |
| `judge-artifact-completeness` | `complete` / `partial` / `incomplete` |
| `judge-injection-defense` | `defended` / `partial` / `breached` |

Ordered worst→best: **`reject`/`incomplete`/`breached` > `revise`/`partial` > `apply`/`complete`/`defended`**.

## Procedure

### 1. Inspect the inputs and tabulate

First check that ≥2 judge verdict blocks are present (if only one, stop — nothing
to synthesize). Then tabulate one row per judge: judge · target · verdict ·
finding count. Preserve each
judge's own verdict word (do not normalise away `breached` into `reject`); add a
severity tier (worst/mid/clean) only as a sort key.

### 2. Find consensus (highest confidence)

A finding flagged by **≥2 judges** (same file:line / same dimension / same
technique) is a **consensus finding** — the highest-confidence item. List these
first. Consensus is by overlap of the finding, never by counting votes for a
score.

### 3. Find conflicts

Two judges reaching opposite verdicts on the same target (one `apply`, another
`reject`) is a **conflict**. **Surface both verdicts and the disagreement
explicitly — never silently resolve it by averaging or vote-count.** The human
adjudicates. The only deterministic rule: for the **must-fix list**, the most
severe verdict wins (a single `reject` puts the target in must-fix even if four
judges said `apply`) — but the conflict is still shown so the human sees it was
contested.

### 4. Synthesize the action split

- **Must-fix** — every finding from a worst-tier verdict (`reject` / `incomplete`
  / `breached`) + every consensus finding at the highest severity.
- **Should-fix** — mid-tier (`revise` / `partial`) findings.
- **Advisory** — single-judge low-severity suggestions.

Each entry carries **provenance**: which judge(s) raised it. Never merge two
judges' findings into one unattributed line.

### 5. Overall recommendation

One sentence, not a number: `block` (any worst-tier verdict), `revise` (any
mid-tier, no worst-tier), or `proceed` (all clean). This is a recommendation the
human acts on — it does not gate anything.

## Validation

1. Every judge that ran appears exactly once in the table.
2. Every must-fix/should-fix/advisory entry names its source judge(s).
3. No single numeric quality score appears anywhere.
4. Conflicts are shown, not silently resolved.
5. The recommendation follows the severity rule (worst-tier → block), not a vote.

## Output format

```
Synthesis: <N> judges over <target>
Recommendation: block | revise | proceed

Verdicts:
  judge-bug-hunter          reject    (2 findings)
  judge-security-auditor    apply     (0)
  judge-artifact-completeness  partial (1)
  ...

Consensus (≥2 judges — highest confidence):
  🔴 path:line — <finding> [judge-bug-hunter, judge-code-quality]

Conflicts (judges disagree — human adjudicates):
  <target>: judge-bug-hunter=reject vs judge-security-auditor=apply

Must-fix:
  🔴 <finding> [judge]
Should-fix:
  🟡 <finding> [judge]
Advisory:
  🟢 <finding> [judge]
```

Required fields (ordered):

1. **Synthesis header + Recommendation** — judge count, target, one-word rec
2. **Verdicts** — one row per judge, its own verdict word + finding count
3. **Consensus** — ≥2-judge findings, with provenance (omit if none)
4. **Conflicts** — opposing verdicts on one target (omit if none)
5. **Action split** — must-fix / should-fix / advisory, each with provenance

## Gotcha

* **No opaque score** — the value is the *structure* (consensus + conflict +
  provenance), not a rolled-up number that hides which lens objected.
* **Don't normalise verdict words away** — `breached` and `reject` sort the same
  but mean different things; keep each judge's own word in the table.
* **A single reject blocks** — even against a majority of `apply`; but show the
  conflict so the human sees it was contested, never bury it.
* **Consume, don't dispatch** — if no judge blocks exist yet, stop and run the
  judges first (or hand back to `/review-changes`); synthesis has nothing to do
  on empty input.
* **Recommendation ≠ gate** — surface it; the human decides.

## Do NOT

* NEVER compute or emit a single numeric quality score
* NEVER resolve a conflict silently (averaging, vote-count) — surface it
* NEVER drop a judge's verdict because it disagrees with the majority
* NEVER run or re-run the judges — this skill consumes their output
* NEVER auto-gate, auto-reject, or auto-merge on the synthesized recommendation

## References

- Code judges: [`judge-bug-hunter`](../judge-bug-hunter/SKILL.md),
  [`judge-code-quality`](../judge-code-quality/SKILL.md),
  [`judge-security-auditor`](../judge-security-auditor/SKILL.md),
  [`judge-test-coverage`](../judge-test-coverage/SKILL.md),
  [`architecture-review-lens`](../architecture-review-lens/SKILL.md).
- Artifact / defence judges: [`judge-artifact-completeness`](../judge-artifact-completeness/SKILL.md),
  [`judge-injection-defense`](../judge-injection-defense/SKILL.md).
- Dispatchers that feed this: [`/review-changes`](../../commands/review-changes.md)
  (5 code judges), [`subagent-orchestration`](../subagent-orchestration/SKILL.md)
  (parallel judge fan-out).
- **LLM-as-a-Judge** — Zheng et al. (2023), [arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685);
  this skill is the consolidation layer over the specialized-judge pattern, with
  consensus/conflict surfacing instead of a single aggregate score.
