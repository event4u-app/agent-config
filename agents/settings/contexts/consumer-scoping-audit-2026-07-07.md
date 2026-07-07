# Consumer-Scoping Misclassification Audit (2026-07-07)

> The blocking audit gate of `road-to-request-scoped-rule-load` Phase 1.
> Council-checked (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2-round
> debate, 2026-07-07, converged round 2).

## Headline correction

The external analysis read "63 of 95 rules exclusively
`agent-config-maintainer` ≈ 50k tok consumer dead weight" off the raw tags.
The audit found the tags did NOT encode consumer-relevance: 5 of the 63
were kernel rules, ~30 were universal agent-behavior rules — the product
core a consumer install exists to deliver. Filtering on unaudited tags
would have silently stripped consumers of the discipline layer (the exact
failure the audit gate existed to catch).

**Corrected numbers: 46 rules reclassified (kept `agent-config-maintainer`,
additive); 16 rules stay exclusively-maintainer.** The consumer-scoping
lever is the measured size of those 16, not ~50k.

## Classification principle (council-converged)

A rule stays exclusively-maintainer iff it is a **specification rule** —
its obligations bind the authoring/governance of the agent-config package
itself (source tree, artifact pipeline, package CI, suite budgets).
Consumers receive the *output* of those constraints (compliant artifacts),
not the enforcement apparatus. **Runtime-governance rules** (how the agent
behaves in a session) ship to consumers. Unsure → ship it: a
silently-missing rule is the harm; an extra rule is the status quo.

## STAY exclusively-maintainer (16)

`augment-edit-discipline` · `domain-adoption-policy` ·
`framework-neutrality-in-generic-skills` · `low-impact-corpus-privacy-floor`
· `no-roadmap-references` · `package-ci-checks` · `persona-governance` ·
`preservation-guard` · `rule-type-governance` · `size-enforcement` ·
`skill-quality` · `source-confidentiality` · `source-of-truth` ·
`telegraph-speak` · `token-budget-discipline` · `token-optimizer-maintenance`

## Reclassified (46, four audited groups — one commit each)

- **A — kernel tag hygiene (5, full consumer list):** agent-authority,
  ask-when-uncertain, direct-answers, language-and-tone,
  no-cheap-questions. Kernel always ships; the tags feed golden-set
  consumer-scope accounting.
- **B — universal behavior (17, full consumer list):** user-interaction,
  user-interrupt-priority, context-hygiene, token-efficiency,
  autonomous-execution, command-suggestion-policy,
  slash-command-routing-policy, markdown-safe-codeblocks,
  missing-tool-handling, model-recommendation, no-attribution-footers,
  content-quoting-floor, onboarding-gate, role-mode-adherence,
  domain-safety-{disclaimer,pii,retention}.
- **C — engineering surface (21, +engineering):** architecture,
  analysis-skill-routing, cli-output-handling, copilot-routing,
  devcontainer-routing, ui-audit-gate, roadmap-progress-sync,
  roadmap-ci-steps-policy, reviewer-awareness, runtime-safety, tool-safety,
  artifact-drafting-protocol, artifact-engagement-recording,
  skill-improvement-trigger, upstream-proposal,
  fast-path-marker-visibility, guidelines, notes-first-reasoning,
  decision-revisit-gate, external-reference-deep-dive, invite-challenge.
- **D — media surface (4, +engineering +gtm):** image-likeness-and-rights,
  media-governance-routing, media-sync-ground-truth,
  provider-lifecycle-discipline.

## Locked design points

- **No `core` workspace id** — the full workspace list is mechanically
  identical for filtering and adds no schema primitive. Revisit only if
  the universal list becomes unwieldy (>50 rules).
- **Phase 1 keeps its weight** with the corrected framing: honest consumer
  scoping infrastructure (workspace-filtered projection, CI fixture
  guards), not a "-50k" headline. The measured 16-rule delta is recorded
  at the opt-in build; the default flip stays a human gate.
- Downstream corrections owed: golden-set consumer universe grows
  accordingly (recomputed by `check_token_quality_golden --scope consumer`
  from the router, never from stale counts).
