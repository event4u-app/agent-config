# Design reconciliation — artifact values against a project's own tokens

Split out of [`design-fidelity-mechanics`](design-fidelity-mechanics.md) on
2026-09-09, and the reason is a real constraint rather than tidiness: that file
crossed `check_depth_budget`'s 16,000-character per-file ceiling, which is a
shrink-only growth ratchet. The subject splits cleanly — that guideline answers
*how do I port an artifact faithfully*, and this one answers *what happens when
the artifact's values meet a project that already has its own*. The two rules
that arbitrate between an artifact and a brand both point here, and neither can
hold the arbitration itself: a consumer receives `design-fidelity`
(`engineering-base`) or `brand-source-of-truth` (`brand`), rarely both.

## Tolerance — why the mechanism ships and the number does not

`design-fidelity`'s `strict` mode says EVERY visible deviation needs explicit
confirmation. The owner directive that motivated
`road-to-design-intent-conformance` asks for an unprompted approximation within
a tolerance. Read literally, those contradict — and the contradiction is real
rather than a wording problem: `grep -cE 'reconcil|tolerance|approximat|nearest'`
over the rule and this guideline returned 0 / 0 before this section existed.

**The re-frame, and its condition.** A value inside a configured tolerance stops
being an unconfirmed deviation and becomes a **reported reconciliation**: the
project's token is written, and the distance from the artifact's own value is
reported on the row. Everything outside the tolerance stays confirmation-bound,
and structure — layout, control types, component set, ordering, breakpoints —
is never in scope at any setting, because it is not a value question.

**The condition is load-bearing, not a hedge.** `design.approximation` ships
`enabled: false` with `tolerance.color` and `tolerance.length` both `null`, so
in a default install the paragraph above describes nothing that happens: every
deviation stays confirmation-bound exactly as before, and no consumer default
moved. `hard-floor` disables the mechanism outright, so the strictest mode
cannot be loosened by configuring a tolerance under it.

**Why no threshold ships**, decided by the AI council on 2026-09-09 (anthropic +
openai, 2/2), and worth re-reading before adding one: *a number in a config
file, even flagged unmeasured, shapes behavior and creates path dependency.*
Zero of seven design-to-code benchmarks in the evidence set score token
conformance, so a shipped threshold would be a guess wearing a default's
authority. Two proposals were examined and rejected on their merits rather than
on caution — `±5 per RGB channel`, because RGB channel distance is not
perceptually uniform and "likely imperceptible" does not follow from it; and
`max(1px, 2%)`, because it grows steadily more permissive at large dimensions
with no evidence that this is wanted. GitHub Primer's ±1px spacing widening is
the one real measurement available and is recorded as an externally observed
**candidate**, not adopted.

**The metric IS fixed, and that is the half that could be settled.** Colour
distance is OKLab ΔEOK, length distance is absolute CSS pixels
(`src/scripts/_lib/design_tolerance.ts`). Fixing the method mattered before
fixing any number: RGB Euclidean, ΔE LAB, CIEDE2000 and OKLab/ΔEOK give
different numbers for the same pair, so a threshold quoted without its metric
is not a threshold.

**The distance is reported on every row regardless.** Preserved values carry it
too. That is what makes the deferred half decidable: a window over rows that
report distances yields a distribution, where a window over rows reporting only
"kept" or "changed" yields nothing to read a threshold off.

## Artifact versus brand

Both `design-fidelity` and `brand-source-of-truth` point here rather than
carrying this arbitration themselves, and the pointers are **operative**: apply
this section before reconciling a value, not as a reference to consult if
curious. Two standing rules cannot each hold half of an arbitration between
them — a consumer receives one of them without the other, because
`design-fidelity` ships in `engineering-base` and `brand-source-of-truth` in
`brand` — so the split has to be somewhere both can reach.

**Values reconcile onto the brand token, with the distance reported.** Colour,
type and spacing are the axes where the field converges, unanimously and at
error severity, across the design systems surveyed. Where a registered brand
token exists, it wins, and the artifact's own value is not silently absorbed:
the distance between the two is reported on the same row, so what changed is
visible before it is cumulative.

**Structure is the artifact's, and is never adjusted to suit a token.** Layout,
control types, component set, ordering, breakpoints and behavior are not value
questions at all, and no brand token is evidence about any of them. A structural
deviation stays what `design-fidelity`'s Iron Law says it is: a proposal needing
explicit confirmation.

**A conflict is surfaced, never merged.** Where the artifact and the brand
genuinely disagree on something that is not resolvable by the two rules above —
an artifact whose type scale contradicts the brand's, say — the agent surfaces
both readings as a numbered choice and builds neither until the human picks.
Averaging them produces a third design nobody approved.

**Where no brand exists**, there is nothing to reconcile onto: the artifact's
values are the values, and `brand-source-of-truth`'s own "when NOT to fire"
already says so. The reconciliation above is a rule about *two* sources, not a
license to normalize one.

**What this section does NOT decide** is whether an in-tolerance value may be
reconciled *without asking*. That needs a tolerance to exist and a default to be
chosen, and both are recorded as open decisions rather than answered here —
`design.tolerance.*` ships empty and the approximation ships disabled.

## Icons on a provided artifact

`icon-consistency` owns the icon axis and, until 2026-09-09, carried **zero**
occurrences of `artifact` / `artefact` / `provided` — so no surface in the
package handled a handed-over artifact's icons at all. Its "ad-hoc inline SVGs
alongside a chosen set" clause is exactly the shape a faithful port produces,
which made a port read as a violation of the rule it was obeying.

**The fix is a new rung, not a re-ordering.** Rung 1 of the iconography ladder
is the project's brand token, and the artifact does **not** outrank it. What the
carve-out changes is which findings are violations, not which source wins.

**The obligation that survives is traceability, not conformity.** An
artifact-sourced icon is legitimate when it traces to the artifact and that
provenance is stated. An inline `<svg>` that traces to neither the adopted icon
set nor a named artifact is untraceable, and still fires.

**A swap is still a deviation.** Replacing the artifact's icon with the
project's nearest equivalent is a substitution of a control the artifact
specified, so it needs the same explicit confirmation as any other deviation
under `design-fidelity`'s Iron Law. The carve-out permits keeping the
artifact's icon; it never permits changing it silently.

**What is deliberately NOT here:** an assertion that an artifact's icons are
*reconcilable* onto the project's set by default. `tailwind-engineer` carried
that claim in the opposite direction — icons "stay 1:1 with the artifact", with
no citation — and it was deleted rather than inverted. The contrary evidence and
the two conditions that would reverse the silence are recorded in
`road-to-design-intent-conformance` § The icon evidence.

## The 2026-07-31 lock, and why its own reopening condition cannot discharge it

A council lock of 2026-07-31 names its reopening condition as *"a measured run
showing the polish loop still edits away from a provided artifact"*. No such run
exists, which makes running one look like the cheap way to close or reopen it.
**It is not, and this paragraph exists so the next reader meets the argument
instead of re-deriving it and spending the run.**

The mechanism is **structural, not probabilistic**. Three facts, each checkable:
`polish.ts:135-167` drops findings flagged `artifact_covered: true`;
`src/skills/design-tokens/SKILL.md` wired `token_violation` findings into the
same loop **without** setting that flag; and the paragraph above states that an
unmarked finding is treated as actionable. Those compose into a path that edits
away from the artifact whenever a token-violation finding fires on an
artifact-derived value. Nothing about that path is stochastic.

So a green measured run would establish *"this did not trigger in the sample"*
— it could never establish *"this cannot trigger"*, which is the claim the lock
would need to be discharged in the useful direction. A run whose only possible
informative outcome is the one nobody wants is not a measurement, it is a
lottery ticket, and it costs a real run to buy.

**The structural fix is the discharge, and it is `blocker:
findings-actionability-default`** on `road-to-design-intent-conformance`.
Resolved by the AI council on 2026-09-09 to option (b): set `artifact_covered`
on the `token_violation` path, changing no package-wide default. Option (a) —
inverting the default so a finding is non-actionable unless escalated — was
rejected on blast radius: it changes the meaning of every existing unmarked
finding across the package to fix one known producer.

**No measurement is scheduled against this lock.** If a later reader wants to
reopen it, the thing to change is the falsifiability of its condition, not the
sample size.

## See also

- [`design-fidelity-mechanics`](design-fidelity-mechanics.md) — the porting
  half, including § Provided-artifact precedence and the `artifact_covered`
  flag whose default the lock section above turns on.
- [`design-fidelity-routing`](design-fidelity-routing.md) — how the rule's own
  trigger set is authored, split out in the same change.
- `src/scripts/_lib/design_tolerance.ts` — the metric and the shipped-null
  thresholds this file argues for.
