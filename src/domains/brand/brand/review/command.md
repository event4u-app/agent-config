---
model_tier: high
name: brand-review
pack: brand
visibility: internal
cluster: brand
sub: review
skills: [brand-audit]
description: Audit emitted UI, copy, and assets against the active brand tokens and voice profile — flag any value not traceable to a brand token or voice rule.
argument-hint: "<artifact-path | description>"
suggestion:
  eligible: false
  rationale: "Cluster sub-command — reached via its cluster head's routing or its explicit /cluster:sub name; not independently suggested (surface-consolidation)."
workspaces:
  - small-business
packs:
  - brand
---

# /brand:review

Run the [`brand-audit`](../../skills/brand-audit/SKILL.md) skill — audit
emitted UI / copy / assets against the active brand tokens (from
`state.ui_design` / the consumer's `tokens.json`) and the voice profile, per
the `brand-source-of-truth` § Iron Law 2 checklist. A value not traceable to a brand token or voice
rule is flagged off-brand. Args: `"<artifact path or description>"`.

**Deterministic checks first, before any model judgement.** For copy,
pipe the text on stdin to
`npx tsx node_modules/@event4u/agent-config/src/scripts/check_voice_lexicon.ts --draft - --slot agents/context-spine/brand-voice.md` <!-- ref-ignore -->
(drop `--slot` when `agent-config brand:status --json` does not report the
slot valid). For CSS or markup, run the design-tokens palette reading,
`node <skills-root>/design-tokens/scripts/tokens.mjs validate --dir <path> --json --tokens <registered tokens.json>`. Report every located
finding — `avoid` term with its note, `unbacked-claim` with "needs proof",
`off-palette` with its nearest token — and flag, never block. Exit 2 from
the checker is a broken invocation: say so, never report the copy as clean. The audit's
judgement comes after and never overrides a located finding.
