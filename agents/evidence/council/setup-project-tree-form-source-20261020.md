<!-- evidence-type: analysis -->

# DEGRADED — one seat of two on where the project tree's form comes from

**Date:** 2026-10-20 · **Members asked:** `anthropic` (claude-sonnet-4-5),
`openai` (codex-default) · **Present: 1 of 2.**
`anthropic` returned `cli_quota_exhausted` and contributed nothing.
**Mode:** prompt, two rounds, blind chairman · **Cost:** $0.00 (subscription
transport, nothing billed) · **Prompt:**
`setup-project-tree-form-source-20261020.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen
entscheidungen im ai council zu lösen") <!-- md-language-check: ignore -->

```
ONE SEAT IS A READING, NEVER A VERDICT. STEP 3.6 STAYS OPEN.
```

This file records a reading. It does not close step 3.6, and the blocker
`project-tree-form-source-needs-a-full-quorum` carries the confirmation.

## What was asked

ADR-292 removes `lean_projection.*`. The shipped template was the last layer of
the cascade `resolveLeanProjection` read, so removing the key would have flipped
the project tree on the first host from `delivery` — which ADR-267 chose on
measured evidence: 616/616 byte-equal deliveries, 101/101 labelled rules
reachable, 0 of 212 near-misses fired — to the full form, and closed the
delivery mechanism's only live gate. That is step 3.6's open question reached
from the other side.

## The reading, from the one seat present

**(a)** — the project tree keeps ADR-267's evidence as its proof, carried in a
shipped non-settings record, until the decision function can issue a verdict
that is not `delivery-unobserved`.

| Point | `openai` |
|---|---|
| Strongest argument for (a) | Option (b) would discard the only validated behaviour and disable Phase 5's live comparison arm **without producing contrary evidence**. An `unobserved` result is absence of evidence, not evidence that delivery failed. |
| Strongest argument against | The fallback could quietly become permanent and bypass the decision function's conservative policy indefinitely. |
| Required of the record | host and project-tree scope · the form · ADR and corpus provenance · a corpus or fixture fingerprint · **an explicit precedence rule: any valid observed verdict supersedes it** · tests for that precedence and for rejecting stale or mismatched rows. "Evidence metadata, not user-configurable policy." |
| Reopen when | a valid observed effect row or arrival record lets the decision function issue a non-`unobserved` verdict — then follow that verdict. |

## What was built on it, and why that is defensible at one seat

`src/config/project-tree-form.json` and `_lib/project_tree_form.ts`, carrying
every field the seat named, with `shippedProjection()` as the projector's one
reader and `projectTreeForm()` as the precedence rule — an observed `full`
verdict wins over a record saying `delivery`, which is the direction that stops
the record being a bypass.

Acting on a degraded reading is bounded by what the option does: **(a) changes
no behaviour at all.** It reproduces what the template produced, byte for byte,
and every other option on the table did not. A reading that selects the
only behaviour-preserving option cannot make the package worse, which is the
owner's own constraint of 2026-10-12. The decision it does not make — whether
the project tree keeps this record or routes through the decision function —
is step 3.6's, and that step stays open.
