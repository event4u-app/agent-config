# Notes-first reasoning — horizon and reopening mechanics

Migrated out of [`notes-first-reasoning`](../../../src/rules/notes-first-reasoning.md)
on 2026-09-08. That rule is delivered on **every subagent spawn**, so its body is
paid per spawn; this material is reference read on demand. Nothing was dropped —
the four passages below are the rule's own text, verbatim, and the rule keeps
both Iron Laws and points here.

Same reason, and the same remedy, as the 2026-08-29 drain run recorded for
`source-confidentiality`: the addition had no room under the per-spawn ceiling,
and raising that ceiling is the config-weakening move this repository refuses.

### Why reasoning stays out of the reply, and what grounds the notes file

Reasoning dumped into the user-facing answer is both noise and a
`reasoning_extraction` refusal risk (see `rdp-gate`). Keep it in the notes file.

The notes file is grounded in the documented cross-run lessons memory
(consolidated via [`memory-consolidation`](../../../src/skills/memory-consolidation/SKILL.md));
the rule's in-task sections are a local derivation for within-task scope. The
gate itself reads settings + task-signal + host self-assessment.

### The two section fields, in full

`## Predictions` carries **chosen form** · prediction · confidence · result ·
lesson — the calibration loop: hypothesis → prediction → reality →
calibration. The form is named first because a prediction with no subject
cannot be contradicted: when the observation comes back, "the prediction
missed" has to point at *what* it was a prediction about, or nothing reopens.

`## Decisions` escalates to
[`decision-record`](../../../src/skills/decision-record/SKILL.md)/ADR when the
decision is cross-task or architectural — litmus: would a dev on a different
component next month need this context? And `next-commitment` is the boundary
this choice authorises work up to, not the plan for it: choosing a form is not
permission to execute a twelve-step plan on it without re-reading the position.

### The horizon — which boundaries count

The boundary is the nearest of these that the plan actually reaches: a **test
result** · a **type or schema inspection** · a **compile** · a **runtime probe**
· a **call-site inventory** · a **dry run** · a **browser observation** · a
**dependency-contract read**. The set is enumerable, which is the whole point —
"the work up to the nearest of those" is decidable from the plan, and `next
justified commitment` as prose degrades to *"implement solution"*, which is the
starting point wearing a label.

### Width scales with reversibility, never with task size

| The action is… | The horizon runs to… |
|---|---|
| a reversible local edit | a whole implementation slice — stopping at the first boundary costs more than it saves |
| stateful or cross-layer | the next boundary from the list above |
| irreversible or a public contract | **before** the irreversible step, unless direct evidence already covers it |

### The look-ahead ladder is a CEILING, never a quota

Three to five moves is the *maximum*, and only for a forcing, irreversible or
externally observable line. Stateful or cross-layer gets two to three. A quiet
reversible line gets **one, deliberately** — and no artifact anywhere requires a
minimum depth. Always-three-to-five across all variants is 1024 leaves at four
branches and depth five, which buys nothing and costs the run its budget.

### Reopening — the two consequences

A reopen driven by ritual rather than by contradicting evidence is ceremony, and
an uncapped reopen is a loop with better manners. Two consequences:

- **A rejection whose premise is falsified is not a rejection.** A candidate
  killed by an assumption that later turns out false is *un-evaluated*, not
  dead — it returns to the set. That is what makes a stated `killed-if`
  condition worth carrying: without it, "we ruled that out" is unfalsifiable.
- **The first failure reads the candidate list before the retry**, where one
  exists — see [`autonomy-mechanics`](../../../src/agent-src/contexts/execution/autonomy-mechanics.md)
  § Retry-budget escalation ladder. Where none exists the ladder is unchanged.
  This adds a branch; it does not move the N=3 budget.

## See also

- [`notes-first-reasoning`](../../../src/rules/notes-first-reasoning.md) — the
  rule this material was paid for in, and which keeps both Iron Laws.
- [`rdp-gate`](../../../src/agent-src/contexts/execution/rdp-gate.md) — the
  engagement gate that decides whether the notes discipline runs at all.
- [`decision-record`](../../../src/skills/decision-record/SKILL.md) — where a
  cross-task or architectural decision escalates to.
