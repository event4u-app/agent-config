---
complexity: lightweight
---

<!-- evidence-type: analysis -->

# `classify()` over this repository — the distribution, and two refuted premises

> `road-to-component-granularity-vocabulary` steps 0.2 and 0.4, measured
> 2026-08-26 on `drain/component-granularity`. The roadmap's own field
> measurement covers a production component library; this covers the half it
> could not — this tree.

## Method

```bash
git ls-files | grep -E '\.(tsx?|css|scss|blade\.php)$'   # 2,888 files fed
# each pair (relpath, text) passed to buildArtefact(), which applies the same
# isUiPath / isUiTreePath filter the command uses, then classify() per survivor
```

`buildArtefact` is the pure core, so this is the classifier the command runs,
not a re-implementation of it.

## The distribution

| kind | count | share |
|---|---:|---:|
| `component` | 51 | **64.6 %** |
| `style` | 16 | 20.3 % |
| `page` | 10 | 12.7 % |
| `view` | 2 | 2.5 % |
| **total** | **79** | |

Design-system markers detected: `css-tokens`, `shadcn`, `tailwind`.
`audit_path`: `high_confidence`.

## Refuted premise 1 — the catch-all is 64.6 % here, not 100 %

D2 says the `return 'component'` fallback *"swallows"* granularity, and the
roadmap's field measurement recorded **60 of 60 → `component`** on a levelled
library. On this tree the share is **64.6 %**.

Both numbers are real and they measure different things. That library is a flat
component tree where every path shape looks alike; this repository has a
`pages/` directory, a `.css` population and Blade fixtures, so three of the four
branches actually fire. **The fallback rate is a property of the corpus, not of
the classifier** — which is worth recording, because "the classifier is a
constant function" is a fair description of one tree and a wrong one of the
other.

## Refuted premise 2 — `view` is not dead

The roadmap records `view` as **"0 in any JS tree"** and the natural reading is
that the branch is unused. Two independent council reviewers read it that way
and both recommended removing the branch.

**Measured: `view` = 2.**

```
tests/eval/frontend-corpus/cases/blade-view/resources/views/bookings/index.blade.php
tests/eval/frontend-corpus/cases/livewire-flux/resources/views/livewire/seat-map.blade.php
```

`view` is the **Blade** branch — `*.blade.php` and `resources/views/`. "Zero in
a JS tree" is true of it the way "zero cats in a dog show" is true: the
instrument was pointed at the wrong corpus. Removing it would have deleted this
suite's only Laravel classification, in a suite whose framework-neutrality rule
exists specifically to keep such carve-outs.

**The branch was also reordered as a result.** `view` is now tested *before*
`pages|app`, so a Laravel project with `resources/views/pages/` classifies as
`view` rather than `page`. That ordering bug was latent and is covered by a
fixture.

## The barrel false positive — reproduced, then fixed

`page` matched `index.[jt]sx?`. Constructed against the pure core:

| input | before | after |
|---|---|---|
| `src/ui/components/index.tsx`, two `export {X} from './X'` lines | **`page`** | `component` |
| `src/ui/components/index.ts`, same | **`page`** | `component` |
| `src/ui/app/settings/page.tsx`, a real screen | `page` | `page` |
| `src/ui/pages/Settings.tsx` | `page` | `page` |
| `index.tsx` that re-exports **and** declares | `page` | `page` |

The last row is the deliberate conservatism: a hybrid keeps its page label. A
false negative costs a page label; a false positive silently reclassifies a real
screen.

**This tree has zero tracked `index.[jt]sx` files**, so the repo distribution is
byte-identical before and after. The fix is for a latent defect, and saying so
is more honest than implying it moved a number here.

## 0.4 — the four candidate discriminators

Not re-run. The roadmap's field measurement already tested composition depth,
state, sub-component count and prop count against a levelled tree and found
**every one overlaps or inverts** — and this repository has no levelled
component tree to test them against, so a second run here would measure nothing.
Recorded as **no candidate survived**, with the parent's table as the evidence
and this note as the reason no independent replication is offered.

## What this does NOT establish

The 64.6 % is one repository, and this one is not a React product — it is a
CLI and governance suite with a small settings UI. Neither this distribution nor
the parent's 100 % generalises to "the classifier is broken" or "the classifier
is fine". What both together establish is narrower and is the thing the roadmap
needed: **the fallback share is corpus-dependent, so any decision resting on it
needs the corpus named.**
