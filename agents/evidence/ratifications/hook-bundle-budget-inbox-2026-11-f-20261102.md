---
proposed_by: claude-opus-5.5 session on analysis/inbox-2026-11-f (task ci preflight red on an inherited overage)
implemented_by: claude-opus-5.5 session on analysis/inbox-2026-11-f
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), round 1 of 2026-11-02
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: 8f59c8c1457161c895c8888d53501b1e0f6220d89850bed52991447a949e1621
---

<!-- evidence-type: ratification -->

# Ratification — hook-bundle budget 1,562,000 → 1,563,000

`check_kernel_edit_ratified` gates one file on this branch:
`src/config/hook-bundle-budget.json`. The `subject:` digest was computed with
`./scripts-run src/scripts/ratification_subject --files src/config/hook-bundle-budget.json --base-ref origin/main`
at revision `a1fc142cb3`. The header is the output of
`ratification_header --seat anthropic=confirmed-non-expanding --seat openai=confirmed-non-expanding`.

## What was reviewed

`max_bytes` 1,562,000 → 1,563,000 with one `raise_log` entry. The bundle measures
1,562,998 bytes on this branch and the same with the branch's only bundle-adjacent
source reverted to `origin/main`; the branch adds nothing to it. Prompt committed
verbatim: `agents/evidence/council/hook-bundle-budget-raise-inbox-2026-11-f-r1-20261102.question.md`.
CLI subscription transport, USD 0.00.

## Verdicts and what changed after them

Both seats returned `confirmed-non-expanding`: the ceiling changes which bundle sizes
pass and expands no agent or hook authority. Both asked for wording changes to the
`raise_log` entry, made in commit `a1fc142cb3` without changing the number:

- the attribution to the main merge range is labelled **inferred**, separated from the
  measured no-contribution of this branch (openai);
- "cannot shrink" became a scope statement (openai);
- `what_would_have_caught_it` now states the enforcement fact rather than lamenting it:
  the composition gate runs only in the local `task ci` preflight and no workflow
  invokes `task ci` (both seats asked for this);
- the 2-byte headroom is stated as deliberate (anthropic asked why 1,000).

The amended wording was not put to a second round; it is the text the seats asked for,
on a file whose only numeric change they reviewed.

## Residual named by the seats, not built here

Running `check_hook_bundle_composition` in a remote workflow, so the merge that grows
the bundle is the one that pays for it. Out of this branch's scope.
