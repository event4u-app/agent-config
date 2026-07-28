# Us vs. the category — the honest version

<!-- claim:positioning-honest-nulls -->**We publish our own measured null
results and retire or constrain features when the evidence does not support
them.**<!-- /claim --> That line is deliberately falsifiable: every published
null links the run that produced it — find one that does not resolve and this
line updates; that is the point. The category's growth playbook is headline
numbers nobody can re-run; ours is a claims ledger CI refuses to let drift.

This page is the adoption-context frame around the CI-locked comparison table.
The table itself lives on the proof page — every "our evidence" pointer is
resolved by `task check-comparison` on every build, the category column only
ever describes what is publicly observable, and no competitor is named or
counter-claimed:

**→ [The comparison table, CI-checked on every build](proof.md#4-what-is-checkable--us-vs-the-category)**

## What the rows mean for an adopter

- **No runtime.** Nothing to keep alive, nothing that writes state behind
  you — the whole layer compiles into your host agent's own config surface.
- **Published nulls.** The benchmark page keeps the runs where the package
  changed *nothing* — including the persona-theater question: swapping the
  advisor identities was measured at ~zero effect while the provider choice
  mattered ~15× more, so persona identity was published as a placebo
  (<!-- claim:persona-identity-placebo-null -->the persona-identity A/B is a
  backed honest null<!-- /claim -->) instead of shipped as a feature. A
  council implementation with falsifiable verdicts — including about itself.
- **A wedge, not a funnel trap.** The 30-second entry is one read-only
  subagent with a scoped, published eval behind its promise
  ([what it catches](wedge/production-validator/README.md)) — the platform is
  the second date, not the first.

## Verify it yourself

Every command on the [proof page § Verify it yourself](proof.md#5-verify-it-yourself)
runs on a fresh checkout. If a claim here does not resolve, CI is red before
you ever read it.
