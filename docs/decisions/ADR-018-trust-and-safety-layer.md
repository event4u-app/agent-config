---
adr: 018
status: accepted
date: 2026-05-21
decision: trust-and-safety-layer
supersedes: —
superseded_by: —
phase: v2.x · monorepo-phase-5-trust-safety-layer
type: prospective
---

# ADR-018 — Trust & Safety Layer

## Status

**Accepted** · 2026-05-21 · external AI Council pass on the Phase 5
roadmap (`claude-sonnet-4-5` + `gpt-4o`, `design` lens). Council
confirmed the closed-enum trust ladder, the per-pack safety-floor
rule, and the condenseor-injected HRR banner; refinement folded into
the lint script and the installer's confirm copy.

Session: [`agents/runtime/council/responses/phase-5-trust-safety.json`](../../agents/runtime/council/responses/phase-5-trust-safety.json) <!-- council-ref-allowed: ADR decision-trace -->

Companion artefacts:
- Contract: [`docs/contracts/trust-and-safety.md`](../contracts/trust-and-safety.md)
- Roadmap: [`agents/roadmaps/monorepo-phase-5-trust-safety-layer.md`](../../agents/roadmaps/monorepo-phase-5-trust-safety-layer.md)
- Lint: [`scripts/lint_trust_coherence.py`](../../src/scripts/lint_trust_coherence.py) + [`tests/test_lint_trust_coherence.py`](../../tests/test_lint_trust_coherence.py)
- Condenseor: [`scripts/condense.py`](../../src/scripts/condense.py) (`_inject_hrr_banner`)
- Installer: [`packages/core/installer/src/trust-escalation.ts`](../../packages/core/installer/src/trust-escalation.ts)

## Context

[`ADR-013`](ADR-013-discovery-frontmatter-contract.md) added the three
trust fields (`trust.level`, `trust.confidence`,
`trust.human_review_required`) as the discovery-frontmatter contract
in Phase 1 of the monorepo migration. Phase 2's discovery manifest
([`ADR-015`](ADR-015-discovery-manifest-contract.md)) rolled them up
into `packs[].trust_summary`. Phases 3 and 4 wired the TypeScript
installer ([`ADR-016`](ADR-016-installer-architecture.md)) and moved
sources into `packages/` ([`ADR-017`](ADR-017-monorepo-physical-layout.md)).

After Phase 4 we had the **metadata** end-to-end but **no enforcement**:

- Installer treated all packs identically — no surface for advisory
  content, no confirm step before opting into legally-flavoured
  finance / strategy material.
- Condenseor preserved frontmatter but did not propagate the
  `human_review_required` signal into the compiled artefact, so the
  runtime had no parser-stable hook to gate output on.
- Domain-specific safety floors (finance, founder-strategy,
  engineering) existed only as drafts under
  `agents/tmp/refactor-package.txt`; they were not first-class
  artefacts shipped with their packs.
- No lint existed to catch drift between declared trust level and
  the absence of the matching guardrail rule.

The existing universal floors (`non-destructive-by-default`,
`commit-policy`, `scope-control § git-ops`, `security-sensitive-stop`)
covered the **action** surface — destruction, push, secrets, prod —
but said nothing about **output** quality on advisory domains
(investment calls, valuation verdicts, strategic recommendations).
Without a Phase 5, a user installing `pack-finance-basic` could
receive a final "yes, invest" answer with no review banner and no
sensitivity required.

## Decision

Ship a four-piece trust & safety layer:

1. **Closed-enum trust ladder.** `core` · `professional` · `advisory`
   · `restricted` · `experimental`. Authoritative table and meaning
   live in [`trust-and-safety § 1`](../contracts/trust-and-safety.md#-1--trust-levels).
2. **HRR banner injection.** The condenseor scans frontmatter and
   prepends `<!-- agent-config:human-review-banner -->\n> HUMAN REVIEW
   REQUIRED · trust: <level> · owner: <domain>` to any artefact with
   `trust.human_review_required: true`. Idempotent on re-condensation.
3. **Per-pack safety-floor rules.** `core` ships
   `engineering-safety-floor.md`; `pack-finance-basic` ships
   `finance-safety-floor.md`; `pack-founder-strategy` ships
   `strategy-safety-floor.md`. Each is itself `advisory` +
   `human_review_required: true`, so it carries the banner and loads
   automatically with the pack.
4. **Installer confirm + lockfile escalation.** The pack picker shows
   the trust mix per pack; selecting an advisory/restricted pack
   triggers a confirm prompt (or `--accept-advisory=<pack-id>` in
   non-interactive mode). Accepted trust counts are recorded in
   `.agent-config.lock.json`. Subsequent `sync` runs that find an
   escalation re-confirm before applying.
5. **Coherence lint.** `scripts/lint_trust_coherence.py` enforces:
   (a) safety-floor presence per advisory/restricted pack;
   (b) HRR banner presence in compiled output;
   (c) kernel rules declare `trust.level: core`. Wired into
   `ci-fast` and `ci-full`.

## Consequences

### Good

- **Single source of trust truth.** The frontmatter field is the
  one input; the installer, condenseor, lint, and runtime all read
  it. No parallel registry, no duplicated copy.
- **Banner is parser-stable.** The HTML-comment marker survives every
  downstream surface (Augment, Claude, Cursor, Windsurf) because it is
  Markdown comment syntax, not prose. Runtime detection greps the
  marker, never the human-readable line.
- **Coherence is enforceable in CI.** A pack that ships advisory
  content without its safety-floor rule fails the build. A kernel
  rule downgraded to advisory fails the build. A
  `human_review_required` artefact whose compiled output drifted
  fails the build.
- **Lockfile catches drift across releases.** An upgrade that
  escalates a previously-`professional` artefact to `advisory`
  re-confirms with the user instead of silently applying.

### Trade-offs

- **One more lint** (~200 LOC + 7 tests) added to `ci-fast`. Live
  manifest run is sub-second; budget impact negligible.
- **Closed enum** means new trust levels (e.g. a future `regulated`)
  require a follow-on ADR. Accepted as the price for stable lint
  invariants.
- **Banner is visible in compiled output**, so users browsing
  `.agent-src/` will see "HUMAN REVIEW REQUIRED" on advisory rules.
  Treated as a feature, not a leak: the banner is the gate.

### Rejected alternatives

- **Per-user permission system.** Considered and rejected: trust is a
  property of artefacts, not users. The installer's once-per-install
  confirm is the gate; a runtime per-action authorisation would
  duplicate the universal floors (`non-destructive-by-default` etc.)
  without adding signal.
- **Re-declaring the Iron-Law floors here.** The four floors stay
  where they live (`kernel-membership`, `safety-model`); this ADR
  references them, never restates them. Avoids contradictory edits.
- **Open-ended trust enum.** A free-form string would let packs invent
  their own levels and bypass the lint. Closed enum keeps the
  contract enforceable.

## Open questions

- A future `regulated` level for healthcare / regulated-finance content
  is anticipated but not in scope; will follow `pack-healthcare` or
  similar.
- Per-artefact `owner` field is currently derived (first pack id).
  Future ADR may promote `trust.owner` to an explicit frontmatter
  key when more than one pack ships the same artefact under different
  ownership stories.

## References

- Contract: [`docs/contracts/trust-and-safety.md`](../contracts/trust-and-safety.md)
- Roadmap: [`agents/roadmaps/monorepo-phase-5-trust-safety-layer.md`](../../agents/roadmaps/monorepo-phase-5-trust-safety-layer.md)
- Predecessors: [`ADR-013`](ADR-013-discovery-frontmatter-contract.md)
  · [`ADR-015`](ADR-015-discovery-manifest-contract.md)
  · [`ADR-016`](ADR-016-installer-architecture.md)
  · [`ADR-017`](ADR-017-monorepo-physical-layout.md)
- Sibling: [`safety-model`](../contracts/safety-model.md) ·
  [`kernel-membership`](../contracts/kernel-membership.md)
