---
complexity: lightweight
review_by: 2026-12-24
---

# Stub: the paired-session efficacy run

> **Stub — not active work.** Carries steps **2.3, 2.4 and 2.5** out of
> `road-to-override-efficacy-proof`, which closed on 2026-08-23 with Phases 1 and 3
> shipped and its efficacy question deliberately unmeasured. The three steps were
> `[~]` there; this file is where they wait, so the Iron-Law-3 closure gate resolves
> against a destination rather than a promise.

## What waits here

- **2.3** Run the paired sessions — both arms, same corpus, same host, same session
  shape. Record **every** pair, including the uninteresting ones: dropping
  uninteresting pairs is how a null becomes a positive.
- **2.4** Publish the number either way, with its honesty label. A measured lift is a
  `PASS` row; no measurable difference is an `HONEST NULL` row and is equally
  publishable. `docs/benchmark.md` carried **9** `HONEST` sections at the time of
  writing, so the honest outcome has a shipped precedent and needs no new argument.
- **2.5** Record what a null would mean, **in the same commit as the null**: the
  override layer costs prose in `override-system.md`, a lint, a registry and a
  contract, and a null means that surface bought no observed behaviour change. Do not
  leave a null sitting as a neutral fact.

## Everything the run needs already exists

`agents/evidence/override-efficacy-prereg.md` is **written and frozen**: the question,
the arms, the observable (`agents/overrides/rules/verify-before-complete.md:57`, a
string-level check on the completion message), **20 pairs**, and the bars — pass at
≥ 14/20, honest null at ≤ 12/20, 13/20 reported as inconclusive rather than rounded
toward either. It was written before any budget conversation, deliberately, so the bar
cannot move to meet a result.

So this is a **run**, not a design. Whoever picks it up executes the pre-registration
rather than re-deciding it.

## Why it is deferred — and it is not the money

`b-paired-session-spend` resolved to option (b) by AI council 2026-08-23, 2 of 2
convergent, and the reasoning matters more than the verdict: **spend was
pre-authorized and the deferral still held.** Both seats concluded that a
pre-authorized budget is *permission without a reason* and does not refute a
**population-validity** objection.

The objection: there is exactly **one** real override in the tree, so 20 pairs measure
that one file twenty times. A `PASS` would license "this override was honoured", never
"overrides work"; a null would license "this override changed nothing measurable",
never "overrides do nothing". Buying that now buys a result about one file.

## Promotion criterion

**A second real override exists in `agents/overrides/rules/`** — at which point the
population is wide enough for the result to say something about overrides rather than
about one file, and the pre-registration is executed as written.

The precedence table (`agents/evidence/reports/override-precedence-table.md`,
generated) is where a reader sees whether that has happened; it is regenerated and
diffed in CI, so its count cannot go stale.

**If it is picked up while the population is still one**, that is a legitimate choice
and the constraint travels with it: the published section must carry the n=1-in-overrides
limit in the same words the pre-registration uses, rather than reporting a lift as
though it generalised.
