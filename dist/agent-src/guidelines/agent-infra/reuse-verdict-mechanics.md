# Reuse-verdict mechanics — the verdict set, the cheap question, and the routing that was refused

> The detail behind § 8b of
> [`agent-interaction-and-decision-quality`](agent-interaction-and-decision-quality.md),
> which [`improve-before-implement`](../../../src/rules/improve-before-implement.md)
> routes to. It lives here rather than inline because that guideline sits at the
> 16,000-char depth ceiling `check_depth_budget` holds as a growth ratchet, and
> the gate states plainly that raising its baseline is a defect rather than a fix.

## 8b-verdict. The verdict set, and what `new` owes

The ladder's answer is a **named verdict, never a yes/no**:

| verdict | meaning |
|---|---|
| `reuse` | the existing thing carries the requirement as-is |
| `extract` | it carries it once a shared part is pulled out |
| `refactor` | it carries it once reshaped, same responsibility |
| `extend` | it carries it with an added, non-distorting case |
| `migrate` | it should carry it, and the move is the work |
| `new` | nothing carries it, and the search that establishes that is the evidence |

**`new` owes negative evidence** — the closest existing candidate **by name and
path**, and why it does not carry the requirement. *"Nothing similar exists"*
naming no candidate is an unrun search, not an answer, and it is the shape this
verdict set exists to make visible.

Two clauses hold the set honest, and both cut against reading it as a ranking:

- **The order is a thinking preference, not a ranking.** A `new` after a real
  search beats an `extend` that bends a helper out of shape. Preferring reuse is
  not preferring reuse *at any cost*.
- **Textual similarity alone is never grounds for an abstraction.** Two blocks
  that read alike and change for different reasons are two blocks — the
  per-class bars are in [`abstraction-thresholds`](../abstraction-thresholds.md).

**Reach the verdict with the engine, not a fresh grep protocol.** `agent-config
code-graph query` and `code-graph affected`;
[`external-code-graph-interop`](../../../src/rules/external-code-graph-interop.md)
already mandates query-before-grep and names grep the fallback, so a second
search specification here would contradict it rather than add to it.

## 8b-cheap. Why the exclusions buy the checks and never the question

The rule excludes bug fixes, config changes, user-fenced tasks and trivial
changes from the **three heavy checks**. The one cheap question — *does this
already exist in the tree* — fires on all four rows anyway.

The reason is empirical rather than tidy: **bug fixes and renames re-add an
existing helper more often than features do**, because the author is inside one
file and reaching for something small. Switching the reuse rung off there
switches it off where it pays most.

Cheap means cheap, on the [`ui-audit-gate`](../../../src/rules/ui-audit-gate.md)
precedent: one `code-graph query`, one named verdict, no interview.

**The skip is decidable from the diff alone** — ≤ 1 file, ≤ 5 changed lines, no
new symbol, no new dependency. A typo satisfies all four with no state to
consult; an added symbol never does.

## 8b-routing. Why this is not routed through the TDD cluster

Two source proposals put the existence question in `/tdd`'s design mode, as the
one point every behavior passes through. **It cannot live there, and the reason
is delivery rather than design:**
`src/domains/engineering-base/tdd/command.md` carries `visibility: internal` and
`disable-model-invocation: true`, so **a consumer cannot reach it.** The routing
is undeliverable, not merely unwanted.

Recorded here so the next author does not re-derive the proposal and re-propose
it.
