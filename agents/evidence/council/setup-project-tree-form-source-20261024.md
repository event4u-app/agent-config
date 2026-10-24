<!-- evidence-type: analysis -->

# CONVERGED 2/2 — the project tree keeps its record, on the live path, scoped by type

**Date:** 2026-10-24 · **Members:** `anthropic` (claude-sonnet-4-5), `openai`
(codex-default) · **Present: 2 of 2.** · **Mode:** design, two rounds, blind
chairman · **Cost:** $0.00 (subscription transport, nothing billed) ·
**Prompt:** `setup-project-tree-form-source-20261024.question.md`, beside this
file · **Raw responses:**
`agents/runtime/council/responses/setup-project-tree-form-source-20261024.json`
(local, not committed) · **Authority:** the owner's delegation of 2026-10-18
("versuche die offenen entscheidungen im ai council zu lösen") and blocker
`project-tree-form-source-needs-a-full-quorum`, owner `council`
<!-- md-language-check: ignore -->

This round is the full quorum the 2026-10-20 reading
(`setup-project-tree-form-source-20261020.md`, one seat) could not supply.

## Verdict

Both seats chose **(c)**: keep the record as the project tree's source — (b)
would replace ADR-267's positive measurement with an absence of unrelated
installed-layer evidence — but only together with a change to how it meets the
live path. 3.6 may close once that change is on the live path and tested.

| Point | `anthropic` | `openai` |
|---|---|---|
| Option | (c) | (c) |
| Strongest for | routing through the current verdict replaces measured proof with `delivery-unobserved`, an absence of evidence | (b) trades ADR-267's project-tree measurement for the absence of installed-layer evidence |
| Strongest against | — | added plumbing before any project-tree observer exists |
| Defect named | `projectTreeForm()` is not on the live path; the verdict's evidence scope is the installed layer, not the project tree | precedence decided by a reason STRING lets an installed-layer verdict cross into the project tree; provenance must be structural |
| Required before 3.6 closes | `projectTreeForm()` reached through `shippedProjection()`; verdict scope enforced to project-tree observations; fallback to the record integration-tested | accept only project-scoped evidence; refuse installed-layer verdicts whatever their reason; fall back to the record when absent; a tested kill switch forcing `full` |
| Reopen when | project-tree observations show delivery breaks parity or reachability | trustworthy project-tree observations contradict ADR-267, or parity / reachability / near-miss results regress |

## What was built on it

- `shippedProjection()` resolves every row through `projectTreeForm()`, so the
  precedence rule is on the path `resolveLeanProjection` takes.
- `FormVerdict.scope`: a verdict decides only with `scope: 'project-tree'`. The
  decision function's verdict carries no scope and is refused whatever its
  reason.
- `noProjectTreeObservation` is the live verdict source, because no
  project-tree observer exists; the record therefore stands, byte for byte.
- `AGENT_CONFIG_PROJECT_TREE_FORM=full` forces the full form for every host —
  the operator rollback, alongside deleting the record.
- `tests/scripts/project_tree_form.test.ts`: 15 cases; the four new ones
  (installed-layer refusal, kill switch on the function and on the live path,
  an observed project-tree `full` on the live path) were red against the
  previous implementation.
