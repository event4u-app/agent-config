---
proposed_by: road-to-a-setup-that-decides-itself step 3.3 (merge of origin/main carrying #2635 into the ratified binding)
implemented_by: claude-opus-5.5 session on drain/setup-decides-itself-20261024
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 6 (merge confirm) of 2026-10-24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: confirmed-non-expanding
effective_after: merge
subject: 57cedbe47349bd71c60aad20e90b1bc189c4f80b00faa5e6cf993c9545e35bff
---

<!-- evidence-type: ratification -->

# Ratification — the `layer-promote` binding after merging #2635

Round 5 ratified the `layer-promote` binding
(`agents/evidence/ratifications/layer-promote-binding-20261024.md`, subject `a4fd91f3…`). Merging
`origin/main`, which carries #2635's `subagent-constraints` concern, conflicted in the gated
`hook_manifest.yaml` and `hook-bundle-budget.json`, so the gated content changed. This record covers
the resolved tree at `ebadf663e0`; the `subject:` digest was computed with
`./scripts-run src/scripts/ratification_subject --files $(git diff --name-only origin/main...HEAD) --base-ref origin/main`.

## What was ratified

Both concern rows and both claude bindings kept (`layer-promote` on `session_start`,
`subagent-constraints` on `subagent_start`), `hook_manifest.json` regenerated, both chunk ceilings
kept, `max_bytes` unchanged at 1,554,800 with one sentence appended to this branch's raise_log entry
recording the combined reading of 1,554,582 B (218 B left).

## Review

One neutral confirm round on the merge delta only, CLI transport, USD 0.00. Prompt:
`agents/evidence/council/layer-promote-binding-ratification-r6-merge-20261024.question.md`.
anthropic: `ratified`; openai: `confirmed-non-expanding`. Both found nothing dropped, duplicated or
altered, the ceiling holding and the appended sentence accurate, and no authority beyond the two
separate ratifications. The openai seat named 218 B as thin headroom against esbuild churn and
asked that the next dispatch-bundle change look for room before another raise — not a blocker.
