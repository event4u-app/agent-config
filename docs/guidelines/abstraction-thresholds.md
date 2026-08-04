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

## See also

- [`architecture`](../../src/rules/architecture.md) — the rule that carries the code-level bar.
- [`fe-design`](../../src/skills/fe-design/SKILL.md) § Component granularity — the UI-shell bar in context.
- [`ui-component-architect`](../../src/skills/ui-component-architect/SKILL.md) § Componentization threshold — the stateful-component bar in context.
- ADR-213 — the decision record scoping the bars.
