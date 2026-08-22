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
| `judge-spec-compliance` | per criterion: `SATISFIED` / `PARTIAL` / `MISSING` — plus a `criteria_source` state that is not a verdict |

Ordered worst→best: **`reject`/`incomplete`/`breached` > `revise`/`partial` > `apply`/`complete`/`defended`**.

`judge-spec-compliance` is deliberately absent from that axis. Its verdicts
answer a different question — *did the change do what was asked* — and mapping
`MISSING` onto `reject` would let a craft-clean diff average it away, which is
the miss this judge was added to catch. It gets its own dimension in § 4c.

## Procedure

### 1. Inspect the inputs and tabulate

First check that ≥2 judge verdict blocks are present (if only one, stop — nothing
to synthesize). Then tabulate one row per judge: judge · target · verdict ·
finding count. Preserve each
judge's own verdict word (do not normalise away `breached` into `reject`); add a
severity tier (worst/mid/clean) only as a sort key.

**A sort key, never a filter.** Severity orders the synthesis; it never decides
what enters it. Dropping a judge's low-severity finding during synthesis
reproduces the pre-filter defect one layer up — the finding was found, the
reviewer reported it, and the aggregator withheld it. Filtering is the
consumer's pass, after the ledger is whole. Output shape, the separate
`Confidence` field, and the preserve-an-unverified-S0 rule are specified once in
[`adversarial-review-protocol`](../../../docs/contracts/adversarial-review-protocol.md)
§ 3.

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
- **Advisory** — single-judge low-severity suggestions. **Emitted in full,
  never elided.** This is the tier with no downstream consumer, which makes it
  the one where quiet dropping costs nothing visible — and that is exactly why
  it is stated: a finding that reached a judge and not the reader was suppressed
  by the aggregator, whatever the tier was called.

Each entry carries **provenance**: which judge(s) raised it. Never merge two
judges' findings into one unattributed line.

### 4b. Mark an uncited assertion — never drop it

A panelist assertion carrying neither fresh evidence produced this run (a
`file:line`, a command's output, a diff hunk) nor a citation is **marked
`uncited`** where it appears. It still ships.

```
FLAG THE UNCITED ASSERTION. NEVER DROP IT.
A SUPPRESSED FINDING IS INDISTINGUISHABLE FROM A FINDING NOBODY MADE.
```

The distinction is load-bearing and it is the reason this is a marking rule
rather than a filter: an unevidenced assertion may still be the most valuable
line in the report — a judge noticing something it could not yet prove is
exactly the signal a human wants. What the reader needs is to know which
category they are reading, not to be protected from one of them.

**Drop was considered and rejected against this file.** The formulation this
was adapted from offers "drop or flag"; the drop half contradicts § 4's
Advisory tier three paragraphs up — *"Emitted in full, never elided … a finding
that reached a judge and not the reader was suppressed by the aggregator"*.
Taking it would have put two rules in one skill in direct conflict, with the
newer one silently winning. Marking satisfies the same goal (the reader can
tell evidence from assertion) at zero information cost.

Scope: this marks **panelist** assertions inside a synthesis. It does not reach
the reviewed change, and it is not the `code-provenance` knowledge-layer
obligation, which governs what a durable artefact asserts rather than what a
transient review does.

### 4c. Spec compliance is its own dimension — never folded into the tiers

```
A SPEC FINDING NEVER BECOMES A CRAFT FINDING.
REPORT THE SPEC DIMENSION SEPARATELY, WITH ITS `criteria_source` STATE.
A CRAFT-CLEAN DIFF THAT MISSES ITS CRITERION IS NOT A CLEAN REVIEW.
NO CRITERIA SUPPLIED IS AN UNVERIFIED DIMENSION, NEVER A PASS.
```

`judge-spec-compliance` findings do **not** enter must-fix / should-fix /
advisory. They form a separate block carrying, in this order: the
`criteria_source` state, the per-criterion table, and the count of `MISSING`
plus `PARTIAL`.

The separation is the whole point. Folded into the craft tiers a `MISSING`
criterion competes with five other judges' findings and can be outvoted by
their silence; kept apart it cannot be, because there is nothing to average it
against. Consensus (§ 2) and conflict (§ 3) do not apply either: no other judge
reads the criteria, so a spec finding has no possible second voter and its
absence of corroboration says nothing about it.

Three `criteria_source` states, and each says something different about what
this review established:

| State | What the synthesis reports |
|---|---|
| `supplied` | the dimension was verified; report the per-criterion verdicts |
| `not_provided` | the dimension was **not verified** — say so, never report it as clean |
| `supplied_unparseable` | an **error**, not a no-criteria run: criteria were handed over and could not be read, so the reader must know their review silently skipped a dimension it was asked to check |

### 5. Overall recommendation

One sentence, not a number: `block` (any worst-tier verdict), `revise` (any
mid-tier, no worst-tier), or `proceed` (all clean). This is a recommendation the
human acts on — it does not gate anything.

**The sentence names the spec dimension explicitly, in every case.** A `MISSING`
criterion is a `block` and a `PARTIAL` one is at least a `revise`, whatever the
craft judges said. Where no criteria were supplied, the sentence says what was
and was not established — *"craft quality verified; requirement compliance NOT
verified (no criteria supplied)"* — because a bare `proceed` over an unverified
dimension reads as a full pass, and that reading is the defect: a reviewer
cannot tell "we checked and it complies" from "nobody checked" unless the
sentence distinguishes them.

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
- Dispatchers that feed this: [`/review-changes`](../../commands/review/changes.md)
  (5 code judges), [`subagent-orchestration`](../subagent-orchestration/SKILL.md)
  (parallel judge fan-out).
- Cross-model review families (disambiguation): [`ai-council`](../ai-council/SKILL.md)
  (independent breadth), [`/team`](../../commands/team.md) (collaborative repo-access
  depth) — this skill consolidates in-session same-weights judges.
- **LLM-as-a-Judge** — Zheng et al. (2023), [arxiv.org/abs/2306.05685](https://arxiv.org/abs/2306.05685);
  this skill is the consolidation layer over the specialized-judge pattern, with
  consensus/conflict surfacing instead of a single aggregate score.
