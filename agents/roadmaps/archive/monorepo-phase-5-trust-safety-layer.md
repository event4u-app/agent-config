---
complexity: lightweight
status: ready
---

# Monorepo Phase 5 — Trust & Safety Layer

> Fifth of six monorepo roadmaps. Phase 1 stamped every artefact with
> `trust.level`, `trust.confidence`, and `trust.human_review_required`.
> This phase **enforces** them: the installer surfaces them, the
> runtime gates them, and domain-specific safety prompts ride on top.
> Lightweight on purpose — the metadata already exists; this phase
> wires consumers.

## Goal

When a user (or agent) selects a pack containing `advisory` or
`restricted` artefacts, the installer surfaces a banner. At runtime,
any artefact with `human_review_required: true` injects a mandatory
review prompt before final output. Domain-specific safety carve-outs
(finance, legal/tax, strategy, engineering) are enforced via
auto-loaded guardrail rules.

## Prerequisites

- [ ] Phases 1–3 shipped and green
- [ ] Read `agents/tmp/refactor-package.txt` sections "Trust- und
      Safety-Metadaten" and "Safety-Regeln nach Domäne"
- [ ] Existing rules referenced as the model:
      [`domain-safety-disclaimer`](../../.augment/rules/domain-safety-disclaimer.md),
      [`domain-safety-pii`](../../.augment/rules/domain-safety-pii.md),
      [`domain-safety-retention`](../../.augment/rules/domain-safety-retention.md)

## Acceptance criteria

- [ ] Installer prints a one-line summary per pack with trust mix
      (`Finance: 18 core · 4 advisory · human-review on 6`)
- [ ] Installer requires `--accept-advisory` (or interactive confirm)
      when selecting a pack containing any `advisory` or `restricted`
      artefact
- [ ] Every artefact with `human_review_required: true` carries a
      visible HUMAN_REVIEW banner at the top of its compiled output,
      auto-injected by the compressor
- [ ] Per-domain guardrail rules ship with each domain pack and
      auto-activate when the pack is installed
- [ ] `task lint-trust-coherence` catches drift between declared
      `trust.level` and the absence of required guardrail references

## Non-goals

- **Not** rebuilding the existing security-sensitive-stop or
  non-destructive-by-default rules — those are Iron-Law kernel
  rules that already cover the universal floor
- **Not** introducing per-user permission systems — trust is a
  property of artefacts, not of users

## Phase 1 — Trust surfaces in the installer

- [ ] Installer's pack picker shows trust mix per pack from the
      `trust_summary` field in the manifest (Phase 2 produced it)
- [ ] Selecting a pack with any `advisory`/`restricted` artefact
      triggers a confirm prompt; non-interactive mode requires
      `--accept-advisory=pack.finance,pack.legal` explicitly
- [ ] Agent-mode emits a `confirm` question type with the trust
      details inline; the agent must relay it verbatim to the user
- [ ] Lockfile records the accepted trust levels per pack so future
      `sync` operations re-confirm if levels escalate

## Phase 2 — Runtime guardrails per domain

- [ ] `packages/pack-finance/rules/finance-safety-floor.md` —
      no final investment recommendation, sensitivity required,
      assumptions explicit, human review on high-impact decisions
- [ ] `packages/pack-governance/rules/legal-tax-safety-floor.md` —
      preparatory analysis only, no binding advice, jurisdiction
      mandatory, human review always
- [ ] `packages/pack-strategy/rules/strategy-safety-floor.md` —
      alternatives presented, assumptions visible, risks listed,
      confidence level named
- [ ] `packages/pack-engineering-base/rules/engineering-safety-floor.md`
      — references existing minimal-safe-diff, scope-control,
      verify-before-complete; no new mandates, just the routing rule

## Phase 3 — Compressor banner injection

- [ ] Extend the caveman compressor to scan frontmatter and inject
      a HUMAN_REVIEW banner block at the top of any artefact where
      `human_review_required: true`
- [ ] Banner format is short and parser-stable (Iron-Law style):
      `> HUMAN REVIEW REQUIRED · trust: advisory · owner: finance`
- [ ] Roundtrip test: compress → decompress → re-compress yields
      identical banner placement

## Phase 4 — Coherence lint

- [ ] `scripts/lint_trust_coherence.py` walks the manifest and
      flags: pack with mixed trust levels and no domain-safety rule,
      artefact with `human_review_required: true` but no banner in
      compiled output, kernel-level rule incorrectly marked as
      `restricted`
- [ ] `task lint-trust-coherence` wired into `task ci` <!-- carve-out: new-gate-verification -->
- [ ] Unit tests in `tests/scripts/test_lint_trust_coherence.py`

## Phase 5 — Documentation

- [ ] `docs/contracts/trust-and-safety.md` documents the contract,
      the four domain floors, and the installer's confirm flow
- [ ] ADR `docs/decisions/ADR-017-trust-and-safety-layer.md`
- [ ] Update `AGENTS.md` pointer table to include the trust contract

## Quality gates

```bash
task lint-trust-coherence            # new — must be green
task lint-artefact-frontmatter       # Phase 1 prereq
task build-discovery                 # trust_summary fresh
task installer-e2e                   # advisory-pack confirm flow
# remote CI runs the full pipeline; local full runs are skipped
```

## Failure modes guarded against

- **Silent advisory install.** Installer refuses to proceed without
  explicit acceptance per advisory/restricted pack.
- **Missing banner.** Lint catches `human_review_required: true`
  artefacts without the compiled banner.
- **Drifted domain floor.** Lint catches a finance pack shipping
  without `finance-safety-floor.md`.
- **Trust level escalation across releases.** Lockfile records
  accepted levels; `sync` flags escalations for re-confirmation.
