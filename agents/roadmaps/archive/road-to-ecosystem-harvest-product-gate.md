---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Pre-Build Product-Demand Gate

**Trigger:** Ecosystem survey (see [`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**A** = a multi-harness marketplace, **J** = a
pre-build product-demand gate skill); full provenance in the index § Provenance.

**Priority: P3.** A small gap one altitude *above* the suite's engineering-fit
check: nothing reflexively asks "should this feature exist at all?" before an
agent starts building on a "build me X" ask.

## Goal

Add a **tiny** demand-validation sub-routine (not a heavy product-management
framework) that fires on "build me an app / add this feature" and helps the user
distinguish founder-anxiety from a real retention-blocker — without the source's
remote case-memory API (an egress concern).

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Engineering-fit challenge | Shipped | `improve-before-implement`, `invite-challenge` |
| Market/positioning depth | Shipped (heavy) | `market-entry-analysis`, `positioning-strategy`, `validate-feature-fit`, `activation-design` (finance/strategy packs) |
| A lightweight reflexive "should this exist?" pre-build gate | **Gap** | none — the pieces are scattered and heavy |

- [x] Reality check complete — the gap is a **lightweight reflexive gate**, not more strategy depth.

## Phase 1 — Adopt-now plate (kept deliberately tiny)

- [x] <!-- done 2026-07-13: § 8-pre in agent-interaction-and-decision-quality
      guideline — three questions (who asked / what breaks if unbuilt / what
      evidence) + the compressed L0–L4 feature-demand hierarchy as a build/
      defer table (build only L3–L4; L0–L2 defer/validate with the missing
      evidence named). Advisory, never blocks. Founder-anxiety→defer,
      users-churning→build encoded in the table. -->
      **U1 — Three-question demand validator.** A ~40-line sub-routine that, on a "build a feature/app" ask, poses three questions — *who requested this? what happens if you don't build it? what's the demand evidence?* — and emits a **build / defer** recommendation. Compress the source's Feature-Demand-Hierarchy (L0 founder-anxiety → L4 retention-blocker; build now only for L3–L4) into the recommendation logic. *Source A/J.* Verify: a "founder-anxiety" input yields "defer/validate"; a "users are churning without it" input yields "build".
- [x] <!-- done 2026-07-13: folded into improve-before-implement (rule) as a
      reflexive pre-check before the three checks — NOT a new skill; detail
      routes to the guideline § 8-pre. Rule stub tightened to clear the
      long_rule density warning. Source's remote case-memory API dropped
      (lethal-trifecta egress) — no network call anywhere in the gate. -->
      **U2 — Wire it in, don't stand it alone.** Fold U1 into the existing `roadmap` / `improve-before-implement` surface as a validate-demand sub-routine rather than a new heavyweight skill. Skip the source's remote case-memory API (lethal-trifecta egress). *Source J, de-scoped.* Verify: the gate fires from the existing surface; no network call.

## Council convergence (2026-07-11)

Council (claude-sonnet-4-5 + gpt-4o) explicitly **de-scoped** this: the L0–L4
multi-tier hierarchy is over-engineered as a standalone artifact — the right
granularity is a three-question advisor folded into an existing skill. Adopt
the reasoning, drop the framework and the remote API.

## Acceptance criteria

- [x] A three-question build/defer validator exists, folded into an existing surface (no new heavyweight skill).
- [x] No remote/network dependency. <!-- verified: prose-only advisory; source's remote lookup explicitly dropped. -->
- [x] Dashboard regenerated.
