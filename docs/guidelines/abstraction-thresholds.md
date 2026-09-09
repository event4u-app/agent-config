# Abstraction Thresholds — the per-class canon

> The single source of truth for "how many repetitions before you extract". Every
> other artifact that states a numeric extraction threshold cites this table and
> names its artifact class — a bare number outside this file is drift
> (enforced by `src/scripts/lint_abstraction_thresholds.ts`).

_Origin: council convergence 2026-08-03 (claude-sonnet-4-5 + gpt-4o, unanimous), recorded in ADR-213. Before this file, four artifacts stated four bare numbers (2 / 3+ / ≥4 / ≥3) with no scope tags — an agent loading them together received contradictory instructions._

## Why the bars differ — cost scales with the artifact class

Extracting a pure helper function is a near-zero-cost act; extracting a stateful
UI component creates a file, a props contract, and a test surface. The threshold
is a price signal: the heavier the extraction, the more proven repetition it
must buy. These are **deliberately different bars for different acts**, not
editorial drift.

## The canon

| Artifact class | Concrete tag (what to check) | Threshold |
|---|---|---|
| **Code-level abstraction** — helper, method, class, Strategy, generic, config layer | any non-UI code shape | **2 real repetitions** (or a genuine second axis of change) |
| **Pure-markup UI shell** — props-only fragment, no state (button shell, card frame, header) | renders props, holds no state | **3+ uses** |
| **Stateful UI component** — carries real props/state (form, table, filter) | repeats **AND** has varying props / local state | **~4+ repeats AND real state** (both conditions) |
| **Utility-class string** (Tailwind et al.) — repeated class list | identical class string | **≥ 3 duplications** (mechanism table: [`tailwind-engineer`](../../src/skills/tailwind-engineer/SKILL.md)) |

The code-level bar of **two** is this suite's settled base decision (the
borrowed "Rule of Three" for code was evaluated and not adopted — see
[`minimal-safe-diff-mechanics`](agent-infra/minimal-safe-diff-mechanics.md)).
The UI rows are scoped carve-outs **above** that base bar, never a license to
lower it.

## The qualitative floor — applies to every row

A number alone never justifies an extraction. In every class, a reviewer must
be able to name the **concrete duplication or the concrete second axis of
change** the abstraction removes. One occurrence is not a component; one branch
is not a Strategy; a repeat with no varying props is inlined, not extracted.

## Precedence

[`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) / YAGNI win on every
conflict: these thresholds authorize extraction when repetition is **already
present in the diff** — never speculative abstraction for "this could grow
later". See [`component-oriented-and-oop-development`](component-oriented-and-oop-development.md)
§ The load-bearing caveat.

## The provided-artifact clause — repetition observable before the code exists

ADR-213 authorises extraction on repetition **already present in the diff**. A
handed-over **runnable** artifact makes repetition observable before any code
exists at all: four `<Card>` instances are visible in the handover, so a port
that writes them one at a time and extracts on the second is doing the
threshold's own arithmetic in the wrong order.

This is a **different mechanism** than the one the threshold tested, not a
loophole in it. `adr_cite_check ADR-213` reports the record LIVE with an
**indeterminate** review trigger and `reopen_policy: unclassified`, so
investigation is permitted; the numbers themselves — 2 · 3+ · ~4+ — are
**unchanged**, and this clause moves only *when* the count may be taken.

**Two guards, both required. The first alone is insufficient.**

1. **A runnable artifact, not a design comp.** A comp shows a picture of four
   cards; a runnable artifact carries four instances of a thing. Counting
   rectangles in an image is not counting repetition, and a comp therefore does
   not qualify.
2. **Repetition of the ELEMENT, not of its compositional context.** Four
   `<Card>` instances show that Card is used four times. They do **not** show
   that a `CardGrid` is needed — that needs multiple distinct contexts each
   arranging several cards. Without this guard the clause would license
   extracting a wrapper for every layout the artifact happens to contain once,
   which is speculative abstraction with an artifact as its excuse.

**Enforcement, stated honestly: guard (2) is model-carried and audit-enforced.**
Nothing mechanical separates *"I saw four Cards"* from *"I saw a CardGrid
pattern"* — the distinction is about what the repetition MEANS, and
`lint_abstraction_thresholds.ts` checks numeric threshold drift, which is a
different property. Guard (1) is checkable (is the handover runnable), guard (2)
is not, and claiming otherwise would be the coverage inflation this tree forbids
elsewhere. The discipline is the control.

## See also

- [`architecture`](../../src/rules/architecture.md) — the rule that carries the code-level bar.
- [`fe-design`](../../src/skills/fe-design/SKILL.md) § Component granularity — the UI-shell bar in context.
- [`ui-component-architect`](../../src/skills/ui-component-architect/SKILL.md) § Componentization threshold — the stateful-component bar in context.
- ADR-213 — the decision record scoping the bars.
