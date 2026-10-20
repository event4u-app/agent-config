---
proposed_by: claude-opus-5 session 42c8753e (drain/tool-results-handle-20261020)
implemented_by: claude-opus-5 session 42c8753e (drain/tool-results-handle-20261020)
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round of 2026-10-20
providers: [anthropic, openai]
verdict: refused
seats:
  anthropic: refused
  openai: refused
effective_after: merge
subject: 3247328fc3c189f74fea240a6d2e17fade06a01b889b3242ac3a5e3fb8ffabad
---

<!-- evidence-type: ratification -->

# Tool-output store — REFUSED 2/2, and what the refusal actually says

`check_kernel_edit_ratified` gates five hook-plumbing surfaces on
`drain/tool-results-handle-20261020` (Phase 2 of
`road-to-tool-results-that-leave-a-handle`): `src/config/hook-bundle-budget.json`
and the four `_lib` modules `content_class.ts`, `tool_output_selection.ts`,
`tool_output_spool.ts`, `tool_output_spool_loader.ts`. +501 lines, all additions.

Both seats returned **`refused`**. This record exists so the round is not
re-run and the reasoning is not re-derived.

## What was submitted, and what was claimed

The submission argued `confirmed-non-expanding`: the shipped
`SPOOL_SELECTED_CLASSES` is `new Set()`, so no install reaches the store; the
loader refuses a chunk whose sha256 does not match its sidecar and stores
nothing on refusal. The submission also named three ways it might be wrong,
rather than only its case — the reviewers took up all three.

## Why both seats refused

Converged on one point: **the activation boundary, not the present runtime.**
Both accept the store is inert as shipped. Both refuse the inference from
*inert* to *non-expanding*, because the distance from `new Set()` to a
populated set is one line, and whether that line is itself gated was asserted
rather than shown.

Further, from the seats:

- "Fails closed" was established only for CHUNK LOADING. It says nothing about
  partial writes, cleanup failure, corrupt records, expired handles, or
  retrieval authorization.
- An **authenticated** handle is not an **authorized** one. Possession alone
  should not grant indefinite access; a handle wants an audience, a session
  boundary, an expiry and a permitted range.
- Content addressing leaks equality: identical sensitive outputs produce
  identical hashes across a trust boundary.
- A byte cap is not a retention guarantee — cleanup needs a bounded age,
  deterministic triggering and crash recovery.
- The integrity sidecar protects CODE loading, not STORED-DATA
  confidentiality. Two threat models, currently argued as one.
- The gate must cover every equivalent activation path, not only the named
  selection file: alternate imports, config overrides, a classifier change
  that broadens an already-selected class, and changes to the loader's
  conditions.

## One submitted uncertainty resolved AFTER the round, recorded as a partial answer and not as a rebuttal

A seat wrote that the selection file's gate coverage "is not established by the
submitted artefact. This must be verified from the actual diff." It was then
verified: `check_kernel_edit_ratified` lists
`src/scripts/_lib/tool_output_selection.ts` among its five gated surfaces, so a
change from `new Set()` to a populated set re-triggers ratification today.

That answers condition 1 **for the named file only**, and the second seat's
wider form of the same condition — every equivalent activation path — is
untouched by it. Coverage also arrives through the dispatch import closure
rather than through `PLUMBING_SOURCE_RE`, which lists fixed paths and does not
match this file; so the coverage is a consequence of the module being reachable
from the dispatcher, and a refactor that removes it from the closure removes the
gate silently. Recorded as a fact for the next round, not as grounds to treat
the refusal as overtaken.

## Conditions the seats set for reconsideration

1. Show that EVERY activation or broadening path triggers ratification.
2. Tests proving an empty selection never loads the store, writes, issues a
   handle, withholds output, or changes existing behaviour.
3. Document and test authorization scope, expiry, replay, range requests,
   equality leakage, retention, cleanup failure, partial writes, corruption.
4. Separate the code-integrity claim from the stored-data security claim.
5. Return the complete diff and the test evidence for renewed review.

One seat added that if those controls hold, the right verdict is **`ratified`**
— an accepted expansion — and not `confirmed-non-expanding`. That is a finding
about the submission's framing, and it stands whatever the tests show.

## Disposition

The branch does not land in this form. The five conditions are Phase 2 work on
`road-to-tool-results-that-leave-a-handle`, recorded there as the blocker
`tool-output-store-refused-until-activation-is-gated`. The merge of `origin/main`
into this branch is resolved and committed locally; it cannot be pushed, because
the pre-push ratification gate reads the whole governed diff and a `refused`
verdict does not clear it.
