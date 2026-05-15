---
stability: beta
keep-beta-until: 2026-08-13
---


# Universal Skills — Allowlist Contract

> **Status:** beta · **Owner:** step-12 Phase 3 · **Stability:** additive only (no removals without a migration note in `STABILITY.md`)

## Purpose

When `agent-config init --interactive` writes a `.agent-config.local.json` with a `user_type` (e.g., `creator`, `founder`, `consultant`), the host agent filters its loaded skill set to that user-type's recommended skills + this allowlist. **Skills on this allowlist are loaded for every user-type regardless of profile.**

The allowlist solves the over-siloing risk identified by the AI Council 2026-05-15 review: a `consultant` user still needs `decision-record` and `risk-officer`; a `creator` still needs `refine-prompt` and `verify-completion-evidence`. These are not domain skills — they are agent-OS primitives.

## The 15

| Skill | Why universal |
|---|---|
| [`refine-prompt`](../../.agent-src/skills/refine-prompt/SKILL.md) | Every free-form request needs AC + assumption + confidence band before the engine runs. |
| [`refine-ticket`](../../.agent-src/skills/refine-ticket/SKILL.md) | Every ticket (Jira / Linear / GH issue) needs scoped AC before plan. |
| [`estimate-ticket`](../../.agent-src/skills/estimate-ticket/SKILL.md) | Sizing + split + risk — applies to any work item, technical or not. |
| [`verify-completion-evidence`](../../.agent-src/skills/verify-completion-evidence/SKILL.md) | Iron-Law gate: fresh evidence before any "done" claim. Survives every mode. |
| [`threat-modeling`](../../.agent-src/skills/threat-modeling/SKILL.md) | Pre-implementation abuse-case enumeration — same lens applies to a marketing form and a payment endpoint. |
| [`systematic-debugging`](../../.agent-src/skills/systematic-debugging/SKILL.md) | Reproduce → isolate → hypothesize → verify — works on broken pipelines, broken docs, broken funnels. |
| [`doc-coauthoring`](../../.agent-src/skills/doc-coauthoring/SKILL.md) | 3-stage write loop (context → section → reader-test) for any long-form doc. |
| [`deep-reading-analyst`](../../.agent-src/skills/deep-reading-analyst/SKILL.md) | Article / long-form analysis via SCQA + mental models — used by every role that reads. |
| [`decision-record`](../../.agent-src/skills/decision-record/SKILL.md) | Trade-off framing before any commit. ADR-shape works for tech, hiring, and pricing. |
| [`adr-create`](../../.agent-src/skills/adr-create/SKILL.md) | Naming + numbering + index regen — the file mechanics of `decision-record`. |
| [`risk-officer`](../../.agent-src/skills/risk-officer/SKILL.md) | Blast-radius framing + residual-risk verdict before any commit. |
| [`adversarial-review`](../../.agent-src/skills/adversarial-review/SKILL.md) | Devil's advocate stress-test — opt-in but always available. |
| [`customer-research`](../../.agent-src/skills/customer-research/SKILL.md) | Discovery-slice shaping (JTBD, switch-event) — used by founder, GTM, consultant, creator. |
| [`stakeholder-tradeoff`](../../.agent-src/skills/stakeholder-tradeoff/SKILL.md) | Per-lens framing when stakeholders disagree — applies in every org. |
| [`md-language-check`](../../.agent-src/skills/md-language-check/SKILL.md) | Hard gate: `.md` files stay English; the agent translates at runtime. |

## Inclusion criteria

A skill earns the universal label when **all three** hold:

1. **Cross-role payback.** ≥ 4 of the 6 seeded user-types (creator / founder / consultant / GTM / finance-ops / developer) reach for it in week-one workflows. The non-dev eval corpus ([`tests/eval/corpus-non-dev.yaml`](../../tests/eval/corpus-non-dev.yaml)) is the empirical test.
2. **No stack assumption.** The skill body does not rely on a specific language, framework, or repo shape. `laravel`, `nextjs-patterns`, `pest-testing` are domain skills, not universal.
3. **Agent-OS primitive.** The skill encodes a meta-pattern of agent behavior (refine, verify, decide, debug, document, threat-model) rather than a domain deliverable (write a launch email, draft an ADR for the auth module).

## Exclusion criteria

- **Domain anchor.** `voice-and-tone-design` (creator), `runway-cognition` (founder), `quality-tools` (developer), `pipeline-strategy` (GTM) — strong-fit for one user-type, weak for the other five. These tag via `recommended_for_user_types:` ([`step-5`](../../agents/roadmaps/step-5-schema-rigor.md) frontmatter contract).
- **Tool-specific.** `laravel-horizon`, `nextjs-patterns`, `mcp-builder`, `terraform` — load only when the matching stack flag is set.
- **Council / role review.** `judge-bug-hunter`, `judge-security-auditor`, `architecture-review-lens` — load via subagent orchestration, not via universal allowlist.

## How loading works (forward-compatible)

```json
// .agent-config.local.json — written by `agent-config init --interactive`
{
  "user_type": "consultant",
  "stack": "none",
  "verbosity": "normal",
  "enabled_skill_prefixes": ["consulting/*", "writing/*"],
  "default_persona": "discovery-lead"
}
```

The host agent's skill loader is expected to:

1. Resolve `enabled_skill_prefixes` against the per-user-type recommendation list (Phase 5 `recommended_for_user_types:` tags).
2. Union with this universal allowlist (always, no opt-out).
3. Surface a `loaded_skills_count` in the agent's debug / status output so the operator can verify filtering ran.

**Runtime filter status:** the prefix-filter pass is gated on [`step-9-user-types-axis`](../../agents/roadmaps/step-9-user-types-axis.md) shipping the `user-types/` directory and `--user-type` flag. Until then, every skill loads (current v2.x behavior); this contract is the forward declaration of the eventual filter, not its implementation.

## Change procedure

Adding a skill to this allowlist:

1. Open a PR that edits this file + the relevant skill's `recommended_for_user_types:` (omitted = universal).
2. Cite ≥ 4 user-type prompts from `tests/eval/corpus-non-dev.yaml` that select the skill.
3. Require approval from one Tier-1 reviewer (architecture-review-lens or skill-writing).
4. Document the inclusion in `agents/eval-findings/` with the supporting eval prompts.

Removing a skill is breaking. It must be announced in `STABILITY.md` with a deprecation window ≥ one minor release.

## Versioning

- This contract is **beta**. Once non-dev selection-accuracy ≥ 0.60 sustains across two consecutive `task bench --corpus non-dev` runs, status promotes to **stable** and entries become semver-protected.
- Tracked against [`step-12-universal-os-reframe`](../../agents/roadmaps/step-12-universal-os-reframe.md) Phase 3 + Phase 5.

## Related

- [`STABILITY.md`](STABILITY.md) — public-identifier stability surface.
- [`agent-memory-contract.md`](agent-memory-contract.md) — companion contract for the cross-cutting memory layer.
- [`docs/getting-started-by-role.md`](../getting-started-by-role.md) — consumer-facing role docs that reference these skills.
- [`tests/eval/corpus-non-dev.yaml`](../../tests/eval/corpus-non-dev.yaml) — empirical test corpus.
