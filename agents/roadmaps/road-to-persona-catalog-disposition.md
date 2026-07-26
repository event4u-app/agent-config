---
complexity: lightweight
status: ready
---

# Road to persona-catalog disposition — four mechanisms audited, one insight kept, no fourth ontology

> **Source:** a source-level comparison intake (archived local-only in the
> processed-inbox archive) — a comparison
> (written @ the 9.2/9.3 era) against a content-first, governance-light
> persona catalog (**Source R**: ~263 persona agents / 17 divisions, bash
> multi-tool converter, prose orchestration doctrine, CI-blocking
> originality gate, lazy router; headline non-technical lesson: a
> contribution funnel that produced a large external-PR stream — figure
> unverified). The analyst's own verdict: structural inverse of this
> package; adopt four mechanisms, bulk import rejected as "prompt zoo".
> **Verified against today's repo before cutting** — the analysis is 4+
> minors old and its Phase 1 shipped in the meantime.
> **Council:** AI council debate 2026-07-27 (anthropic/claude-sonnet-4-5 +
> openai/gpt-4o, 2 rounds; round 2 converged both soft spots to
> rejection). **Activated 2026-07-27 by maintainer decision.**

## Provenance

Anonymized per source-confidentiality; maintainer-recoverable link:

- Source R: `ENC1:aNaQPVyUSdjYv2/i8mY6fuZQUVxpF0PAMBJVOCQ9UzJcDtljPWvjFoVf/NNhOJsHz2+DUjx973tmnlJocKLfergXdAXqldSXftrtAcNeXlQVjmdyx1H6Xc7ef5vxC9W6FJ9WhpOmbqzWaW9XRw==`

## Goal

Close the intake with an auditable disposition: the one already-shipped
adoption is recorded, the genuinely novel insight (severity-conditioned
team composition) is captured as guidance inside the EXISTING orchestration
surface instead of a new object class, the catalog-router constraints are
recorded for the track that owns them, and everything else is rejected or
kept dormant with named triggers. Zero new ontologies, near-zero new build.

## Verified disposition table

| Draft item | Today-state / verdict |
|---|---|
| Phase 1 — entity-neutralized shingle originality gate | **SHIPPED since**: `lint_originality.ts` + `lint_originality_shingles.ts` + committed `agents/reports/originality.*`. CLOSED |
| Phase 3 — lazy catalog router (search/inspect/load) | **Intent already council-catalogued as STUBS** (`catalog_search`/`catalog_inspect`/`catalog_load`, `implemented_on: []`, stub-by-default pillar). Implementation OWNED by the parked `later/road-to-mcp-full-power.md` N0 unlock; token measurement OWNED by the active `road-to-request-scoped-rule-load.md`. Constraints recorded below. ROUTED |
| Phase 2 — roster object (scenario → phased team) | **REJECTED** — a fourth scoping ontology (pack / flow / roster / orchestration-mode), exactly the proliferation this week's external review warned against; flows already validate team refs, `/team`/`/council` assemble teams ad hoc, no logged demand. The one novel piece (CONDITIONS axis) survives — Phase 1 below |
| Phase 4 — `--link` symlink install mode | **REJECTED** — dev-QoL with no logged demand; the installer dereferences symlinks deliberately; doctor would false-positive on linked projections (unmet prerequisite, not a parking trigger). Reopen only on ≥3 distinct stakeholder requests |
| Phase 2.5 — handoff prompt templates | **REJECTED** — governance scaffolding without a demand signal; maintenance cost (template × persona × mode drift) ignored by the "it's cheap" framing; the CONDITIONS guidance replaces the need |
| Phase 5 — curated non-engineering division harvest | **STAYS DORMANT** as designed — the draft's own three gates (logged demand per the adoption-signal floor, per-persona originality-lint pass, integration home) hold; "a marker, not a plan" |
| 16-tool convert matrix, TTY wizard, parallel install | ALREADY-HAVE, superior (surface matrix across 23 hosts + doctor/converge; GUI wizard). CLOSED |
| Contribution funnel (issue form + originality gate → external-PR stream) | The gate half is shipped; the FUNNEL half is adoption work → ROUTED to `road-to-adoption-without-narrative-debt.md` (the intake's own top lesson: this is the #1 structural topic, and it is owned there) |
| NEXUS prose doctrine, i18n, bulk 263-agent import, extra host targets | REJECTED per the draft's own verdicts (unfalsifiable doctrine; no demand; prompt zoo; breadth is the other side's axis) — affirmed |

## Recorded constraints for the routed catalog-router work

For whoever picks up the stubs under the mcp-full-power N0 unlock:

1. **Kill threshold (pre-declared by the draft, adopted):** <20%
   initial-context reduction vs the current thin projection on the eval
   scenario → the tools do NOT ship; stubs stay; honest null recorded.
2. **Index carries metadata + token sets, never bodies**; deterministic
   sorted output; `--check` drift mode mirroring the registry-manifest
   builder.
3. **One lexical scorer:** reuse the existing BM25/trigram primitives —
   never a second scoring implementation.
4. **No delegate tool:** `catalog_load` returns a body wrapped in a neutral
   preamble with a subordination clause; the HOST decides activation —
   auto-activation violates default-off (the draft's own cut, affirmed).

## Phase 1 — Capture the one novel insight (guidance, not object)

- [ ] **Severity-conditioned team composition as orchestration guidance:**
  add a short conditions-pattern section to the existing
  subagent-orchestration surface (skill guidance / flow entry — extend,
  don't create): incident-style severity tiers map to team composition and
  activation (e.g. highest severity → full parallel team; low → solo with
  async review). No schema, no linter, no new object class — a documented
  pattern the existing modes already support.
  *Verify:* guidance present on the existing surface; zero new artifact
  classes; discovery/consistency gates green.

## Phase 2 — Intake honesty records

- [ ] **This disposition table is the record** — shipped / routed /
  rejected / dormant, each with its trigger; the funnel routing note is
  filed with the adoption roadmap's inputs.
  *Verify:* adoption roadmap references the funnel lesson; no rejected
  item rebuilt without its named trigger.

## Acceptance criteria (roadmap-level)

1. The conditions-pattern guidance lands on the existing orchestration
   surface with no new artifact class (Phase 1).
2. Every intake item has exactly one recorded disposition; the
   catalog-router constraints are recorded where the owning tracks will
   find them (this file + routing notes).
3. Locks respected: stub-by-default pillar untouched, no fourth ontology,
   freeze unblock list unchanged, harvest marker still gated by its three
   conditions.
