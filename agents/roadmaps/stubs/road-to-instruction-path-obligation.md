---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: the agent-side instruction-path obligation, and the tree-edge sweep

> **Stub — not active work.** A **drain-run transfer**, created 2026-08-26 when
> [`road-to-consumer-repo-reality`](../archive/road-to-consumer-repo-reality.md)
> was drained. Two steps — **1.5** and **5.1** — are prose obligations that
> cannot land while the standing per-spawn payload sits at its grace ceiling.
> Outcome state on the parent: **transferred**.
>
> **Transferred, not completed. Neither obligation ships, and the code that
> discharges half of 1.5 does.**

## Why they did not land — a budget, not a doubt

Both steps were **built, measured, and removed**. Nothing about their content is
in question; the council did not dispute the need, and 1.5's placement was
already settled by a separate council on 2026-08-26.

`check_preamble_payload_budget` measures the standing per-spawn payload:
project-scope rules + the preloaded skills catalog + the CLAUDE.md hierarchy.
Its CI ceiling is a **grace ceiling pinned exactly at HEAD's measurement**, and
the config says why in its own words:

> "HEAD measures 138,212 against a design ceiling of 107,646 — 28.4 % over.
> Making the gate blocking at the design ceiling would fail EVERY pull request
> from the moment it lands … The grace ceiling is set AT the measurement so
> growth beyond today reds immediately while today's total is tolerated."

**So any addition to the rule corpus reds it. That is the design, not a
defect** — and it is why this is a transfer rather than a shortfall.

Measured on the branch, against the same tree at `origin/main`:

| State | project-scope rules | total | vs grace |
|---|--:|--:|--:|
| `origin/main` | 122,605 | 138,212 | — |
| + rule `instruction-path-verification` (107 lines) | 124,275 | 139,882 | **+1,670** |
| + the same rule trimmed to 83 lines | 123,919 | 139,526 | **+1,314** |
| + step 5.1's `downstream-changes` section only | 122,985 | 138,629 | **+417** |
| shipped state — both removed | 122,605 | 138,212 | **0** |

Trimming the rule from 107 to 83 lines removed worked explanation and kept the
Iron Law, the direction-vs-sibling table, the four-step obligation, the
three-outcome contract and the diagnostic pointer. **Trimming further removes
obligation surface, not prose**, which is the point at which shrinking stops
being a saving.

## The council decision

**2026-08-26, both seats, convergent on D — fund it by an audited reduction, and
until then do not ship it.** Recorded at
[`preamble-ceiling-vs-new-rule`](../../evidence/council/preamble-ceiling-vs-new-rule.md).

Two dispositions were **rejected explicitly**, and the reasons bind whoever
promotes this stub:

- **Raising the grace ceiling** — its stated property is that it reds on ANY
  growth, so raising it on the first addition is the precedent that makes it
  inert. *"Every later rule cites this one."*
- **Shipping with a red check** — *"a red check that a reviewer must be told to
  ignore is how a gate becomes background noise."*

One seat put the standard the promoter has to meet:

> "Any addition to over-budget corpus requires demonstrating it's more valuable
> than existing content, or that existing content is redundant. Neither has been
> shown yet."

And the other closed a shortcut before anyone reaches for it:

> "I disagree with … the suggestion that excluding `type: auto` might merely
> 'fix the census': the budget is explicitly defined as standing per-spawn
> payload, so exemption is valid only after proving through actual spawn traces
> that the rule is never preloaded, not from its label."

`instruction-path-verification` is `type: auto`. **Do not exempt it on that
label.** Instrument the loading first, or fund it.

## What already landed, so the promoter does not rebuild it

**The deterministic half of 1.5 ships in the parent change.**
`agent-config doctor --check instruction-path-reach` parses the root instruction
files, resolves every repository-relative path, and reports each as present,
dangling, or unresolvable **with a stated reason**. On this repository it finds
**8 dangling paths, all real** — three `scripts/install.sh` references left by
the `scripts/` → `src/scripts/` move, two scripts retired by py2ts, and three
absent generated directories.

It does **not** discharge the obligation, and the roadmap says why: a command
answers when somebody runs it, while an agent mid-session routing on an
unresolved path never invoked it. Step 1.5 asks for the discipline *"on the
agent side, not only in a command"*. That half is what is transferred.

The rule text itself is recoverable from the parent change's history — it was
committed and then removed, deliberately, rather than never written.

## Probe

- **Producer:** a maintainer or agent run that can first fund ~1,400 tokens of
  project-scope rule payload by an audited reduction.
- **Probe:** does a rule named `instruction-path-verification` exist under
  `src/rules/`, and does `check_preamble_payload_budget` measure at or below its
  grace ceiling?
- **Measured 2026-08-26 (transfer-date baseline):** the rule does not exist; the
  payload measures exactly 138,212 against a grace ceiling of 138,212 — zero
  headroom.

## Seed content on promotion

1. **Run the value-and-overlap audit first.** Both seats asked for it by name,
   and both refused an arbitrary deletion. Consolidation and deduplication are
   the preferred sources; an unrelated rule deleted to make room is the shape
   they rejected.
2. **1.5's placement is already decided** — a sibling rule, not an extension of
   `missing-skill-recovery`, because that rule's remedy (`suggest_skill_for_task`,
   which ranks the tree) has nothing to say about a path in a markdown file that
   does not resolve. Do not relitigate it; the record is
   [`instruction-path-placement`](../../evidence/council/instruction-path-placement.md),
   and it is honestly marked **DEGRADED 1/2**.
3. **The diagnostic already names the rule in its `fail` output**, so
   reachability runs both ways the moment the rule exists. Nothing to wire.
4. **5.1 is the cheaper half.** Its `downstream-changes` section cost ~417
   tokens against 1.5's ~1,314, and its verify is narrow: the sweep names the
   boundary when an exported surface is touched and does not when nothing is
   exported. If only one can be funded, this is the one that fits.

## Closing in the other direction

A measured finding that the payload has fallen far enough that both fit without
an audit closes this stub by simply landing them. So does a decision that the
grace ceiling should track a different denominator — but that is a change to the
gate, with its own review surface, and **not** something a promoter of this stub
may do as a side effect of promoting it.
