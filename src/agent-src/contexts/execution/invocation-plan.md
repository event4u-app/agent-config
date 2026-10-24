# Invocation Plan — the order the work chooses

An input that names several stages is run in the order the work needs, not the
order it was typed. "First write the roadmap, then work it off, then update the
PR" describes the **end state** — one PR carrying both — not a schedule that
pushes, opens a PR and waits for CI twice. The order is decided by
`src/scripts/_lib/invocation_plan.ts` (`linearize`), a pure function with zero
model calls: the agent supplies the stages, the function decides.

```
THE USER NAMES THE WORK. THE ORDER IS THE AGENT'S — UNLESS THE USER FENCED IT.
AN ENUMERATION IS NOT A SEQUENCE: "ERST … DANN …" / "FIRST … THEN …" ORDERS NOTHING
BY ITSELF. AN ORDER MARKER, A REVIEW FENCE, A STATED REASON OR A DATA DEPENDENCY DO.
DELIVERY HAPPENS ONCE: AFTER THE LAST STAGE THAT WRITES THE SAME OBJECT.
NEVER WAIT ON A RESULT THE SAME INVOCATION WILL MAKE OBSOLETE.
A REORDER NEVER WIDENS AUTHORITY AND NEVER MOVES AN OUTWARD OR IRREVERSIBLE EFFECT.
STATE A CHANGED ORDER IN ONE LINE. NEVER ASK FOR PERMISSION TO REORDER.
```

## When it fires

On an input with **two or more stages**, or **one stage with a sink**. A single
sink-free stage skips it entirely — no plan, no line, no extra call (G11). A
stage is a command, or a verb phrase in free text (`PR erstellen`, "push",
"run the full suite", "deploy", "send the mail", "regenerate").

## The procedure

1. **Split** the input into stages.
2. **Tag effects** per stage, each with the object it touches (usually the
   branch): `local-write`, `commit`, `read` · sinks `regenerate`, `full-suite`,
   `push`, `pr-open`, `pr-update`, `ci-settle` (superseded by a later write to
   the same object) · `council` (kept in place) · `outward-message`, `merge`,
   `release`, `deploy`, `destructive` (C5, never moved).
3. **Classify the constraints** — each one keeps the stated order:

   | C | Constraint | Markers (DE / EN) |
   |---|---|---|
   | C1 | Explicit order | `in dieser Reihenfolge`, `genau so` / `strictly in this order`, `exactly as listed` |
   | C2 | Review fence — the run stops after it | `zeig mir erst…`, `warte auf mein OK` / `plan only`, `review first` ([`scope-control`](../../rules/scope-control.md) § Fenced step) |
   | C3 | Stated reason | `erst den PR, damit X reviewen kann` / `open the PR so X can review` |
   | C4 | Data dependency | stage B reads stage A's output (`dependsOn`) |
   | C5 | Outward or irreversible effect | mail, comment, merge, release, deploy, destructive — a barrier nothing crosses |

4. **Apply the rules**, each only where no constraint blocks it:

   | R | Rule |
   |---|---|
   | R0 | Methodology first: analysis before authoring or implementing, tests before implementation |
   | R1 | Deferred delivery: a sink moves after the last later stage that writes its object |
   | R2 | Coalesce: repeated sinks on one object collapse to one at the join; an open and an update of one PR become one open |
   | R3 | Fail fast: a cheap check that can void a later stage runs before it |
   | R4 | Waits last: a stage that still ends in a CI wait goes after the independent stages behind it |
   | R5 | Everything else keeps the stated order; parallelism stays with [`auto-dispatch-classification`](auto-dispatch-classification.md) |

5. **Linearise** and run. When the order differs, emit the `Order` line from
   [`mandated-lines`](mandated-lines.md) — `Order: <what moved> — <why>.` — once,
   before the first moved stage runs. Unchanged order: silence.

## Authorization — a reorder is not a new operation

Moving an operation the invocation authorised to a later point, or merging two
authorised sinks into one, is **not a new operation** and needs no ask. It never
authorises an operation the input did not name, and it never makes a fenced or
gated one autonomous: [`scope-control`](../../rules/scope-control.md) and
[`non-destructive-by-default`](../../rules/non-destructive-by-default.md) decide
*whether*; this plan decides only *when* and *how often*. The clause lives here
because `scope-control` is a kernel rule.

## Delivery and failure

A command run as a **non-terminal stage** of a composed invocation stops at
`committed` — `analysis_publish` with `stage: 'inner'`, ADR-288 Amendment 1. The
terminal stage owns publication: it updates the open PR on the branch, or opens
the first one, once. When a later stage fails or blocks, the deferred delivery
still runs for what finished and says partial progress in its first line
(`deliveryOnFailure`). Deferral never means nothing lands.

A mid-flight amendment — same mission, a stage added, removed or re-ordered — is
re-planned over the remaining stages and the run continues
([`user-interrupt-priority`](../../rules/user-interrupt-priority.md), the
Amendment bucket); `replan` drops the stages already done.

## Fixtures — `tests/scripts/invocation_plan.test.ts`

| G | Input | Expected |
|---|---|---|
| G1 | "analyse the inbox in a worktree and a PR, first the roadmap, then `/roadmap:process-full`, then update the PR" | inbox stops at commit; one push, one PR, one settle after process-full; one order line |
| G2 | G1 + `in dieser Reihenfolge` | literal order (C1) |
| G3 | `zeig mir erst die Roadmap, dann arbeite sie ab` | stops after the roadmap, no reorder (C2) |
| G4 | `erstelle den PR, damit X reviewen kann, dann mach weiter` | early PR kept (C3) |
| G5 | "implement, then write tests" | tests first (R0) |
| G6 | "build it, then check whether the library already supports it" | check first (R3) |
| G7 | "fix, push, then also refactor Y" | refactor before the one push (R1); a wait on another object goes last (R4) |
| G8 | two "update the PR" | one update (R2) |
| G9 | "deploy, then run the migrations" | kept (C5) |
| G10 | "send the customer mail, then fix the bug" | kept (C5) |
| G11 | a single sink-free stage | no plan, no line |
| G12 | a later stage fails | the delivery that finished stages owe still lands, marked partial |
| G13 | mid-run: `PR erst am Ende, bitte` | re-plan the remaining stages, no stop, no ask |
| G14 | free text: "fix it, run the full suite, then also rename Y" | one full suite, after the rename |

## Not here

How deep a stage runs, and whether a CI wait runs in the foreground or the
background, are owned elsewhere. The council does not choose orders — reorders
are reversible. It is asked only when a constraint is ambiguous **and** the
reorder would change content rather than timing; any other ambiguity keeps the
stated order.
