<!-- evidence-type: analysis -->

# Question: should a pack-scoped safety-floor rule ship wherever a skill that names it ships?

## Facts (verified in the tree at c073ca2e5a, agent-config 18.2.0)

- Since 18.0.0 (`projection.rule_packs` retired, owner directive 2026-10-24) a non-kernel rule is installed only when one of its `packs:` is in the active pack set. `runtime.active_packs` defaults to `[]`.
- Skills are scoped differently per host: claude-code and codex have a listing lever and receive EVERY skill and command (scoped by visibility); every other host receives only the active profile's packs plus `runtime.active_packs`.
- Four rules carry `consequence_class` and are pack-scoped:
  - `legal-safety-floor` (`authority-bypass`, `packs: [legal-review-prep]`, `routes_to`: contract-review, nda-triage, dpa-review, legal-intake-triage). It holds the RDG individual-case STOP, the EU/DE-only refusal, the mandatory attorney-review line and the consent gate. `contract-review/SKILL.md:84` says it "Obeys `legal-safety-floor`".
  - `finance-safety-floor` (`authority-bypass`, `packs: [finance-basic, finance-advanced]`, `routes_to`: runway-cognition, dcf-modeling, scenario-modeling, unit-economics-modeling).
  - `strategy-safety-floor` (`authority-bypass`, `packs: [founder-strategy]`, `routes_to`: vision-articulation, positioning-strategy, competitive-moat-analysis, market-entry-analysis).
  - `image-likeness-and-rights` (`irreversible-external`, `packs: [ai-image]`, no `routes_to`; triggers include `/image:` and "image generation").
- Consequence: on claude-code and codex with no active pack, `contract-review`, `dcf-modeling` etc. are installed and can be invoked, while the floor rule they obey is not installed. On every other host both are absent together.
- The audit that accepted the eight-rule loss (`agents/evidence/analysis/rule-packs-eight-rule-audit-20261024.md`) rated these rules "scoped correctly" without considering hosts that receive every skill.
- `road-to-a-setup-that-decides-itself` decision D14 records a revisit-if: "a rule that applies regardless of its pack".
- Cost side: every installed rule is standing context on each spawn on claude-code. These four rules are tier 2a (`type: auto`, keyword-triggered), not always-loaded kernel rules.

## Options

1. A pack-scoped rule with a `consequence_class` ships whenever any skill in its `routes_to` is projected on that host (lever hosts: whenever the skill ships). `image-likeness-and-rights`, which routes to no skill, stays pack-scoped.
2. Option 1, and additionally `image-likeness-and-rights` ships unconditionally because its triggers name host-side image generation that no pack controls.
3. Keep the 18.0.0 behaviour (floors only with their pack) and instead make each guarded skill refuse to run when its floor rule is not installed.
4. Keep the 18.0.0 behaviour unchanged.

Answer with the option you choose, the reason, the risk you see in it, and what observation would make you revisit it.
