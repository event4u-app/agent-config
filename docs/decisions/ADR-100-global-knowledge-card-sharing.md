---
adr: 100
status: accepted
date: 2026-06-15
decision: global-knowledge-card-sharing
supersedes: ADR-098
superseded_by: —
phase: structure-grounding-v2
type: structural
---

# ADR-100 — Global cross-project knowledge-card sharing

## Status

Accepted (2026-06-15). Council-designed (claude-sonnet-4-5 + gpt-4o, design
mode — both members converged independently). Implements
`agents/roadmaps/archive/road-to-structure-grounding-v2.md`. **Partially supersedes
[ADR-098](ADR-098-evidence-first-structure-discovery.md) Decision-10 only** —
the rest of ADR-098 (the evidence-first invariant, the Evidence Report,
card trust-tiering, the project-local layer) stands unchanged.

## Context

ADR-098 shipped the v1 evidence discipline + project-local knowledge cards and
**killed** the global/registry/promotion layer (Decision-10, "v2 KILLED"): the
operator exercised the kill option directly rather than wait out the measurement
window, because the layer looked **runtime-shaped** and re-opened the 2026-06-14
Layer-2 sunset (no daemon, no vector DB, no writable per-user store).

The operator **reversed that kill on 2026-06-15**: build the global
cross-project sharing layer now, gated by a user-global setting, **default ON**,
off-able later. The council was asked whether this can be done without
re-opening the Layer-2 sunset.

## Decision

1. **File-first is not a runtime — the sunset's core is preserved.** Global
   cards are plain files under `~/.event4u/agent-config/knowledge/`, lazy-read,
   with **no daemon, no DB, no vector index, no background decay**. This is the
   reconciliation: the 2026-06-14 sunset killed *runtime* (a writable per-user
   service), not *storage*. A lazy-read file store is storage.

2. **The global store is storage, not governed.** It is **unversioned** (not in
   git), so unlike a committed project-local card it carries no git provenance.
   It is a **cache, never a source of truth, never a build input**. The per-card
   **provenance footer** (`first_seen` · `promoted_at` · `last_verified` ·
   `tier` · `seen_in`) is its audit trail — the deliberate substitute for git
   history (accepted risk).

3. **Leads only.** A global card's `trust: durable` core (negative facts +
   pointers) is usable as a lead. Its **positive structure loads as "Assumed
   (from card · GLOBAL, unverified)"** and must be re-confirmed against the live
   source *this session* before use — never "Verified" on the global card alone
   (version skew / schema drift across projects).

4. **Origin-tier scoping is the privacy floor that makes default-on defensible.**
   `public` (registry / GitHub / docs) auto-shareable; `vendor` (Stripe / AWS /
   …) shareable **post-redaction**; `proprietary` (in-house DB / private API /
   client schemas) **manual-only, default-off regardless of `enabled`** — so no
   client-A schema leaks into client-B's session. Unknown / hostless sources
   classify conservatively as `proprietary`.

5. **Redaction on write, halt-on-trigger.** Promotion runs the
   `low-impact-corpus-privacy-floor` + `source-confidentiality` pattern set and
   **halts** on any hit — never silent-shares, never auto-rewrites. The manual
   proprietary override does **not** bypass redaction.

6. **Promotion is hybrid, never silent.** A `public`/`vendor` card seen in
   ≥ `auto_promote_threshold` (default 2) distinct repos triggers a one-tap
   **suggestion**; the write happens only on confirm. Default-on turns *sharing*
   on, not *promotion* automatic — preserving the v1 manual prereq.

7. **Full kill-switch.** `knowledge.global_sharing.enabled: false` no-ops the
   layer: the store is never read or written, no promotion is suggested, Evidence
   Reports revert to project-local, existing global cards go inert. v1 is
   byte-for-byte unaffected. `knowledge global purge --confirm` removes the store
   and strips provenance from project cards.

## Accepted risks

- **Unversioned cache.** No git history on the global store; the provenance
  footer is the only audit trail (Decision 2).
- **Last-write-wins.** Concurrent promotions of the same card-id race on the
  file; no locking (file-first, no runtime). The footer records the last write.
- **Lazy freshness.** No background decay — staleness is surfaced at read/validate
  time (≥90d → hypothesis, ≥180d → stale), never auto-pruned.
- **Residual manual-promotion leak.** A determined operator can `--manual`-promote
  a proprietary card; redaction still halts on confidential patterns, but tier
  misclassification of a *novel* host defaults conservative (proprietary), not
  permissive.

## Consequences

- New user-global setting `knowledge.global_sharing` (whitelisted in
  `MERGEABLE_KEYS`), default on for `public`/`vendor`.
- New `_lib` modules: `knowledge_global` (store path / config / tier detection /
  provenance footer), `knowledge_global_redaction` (gate + redaction scan),
  `knowledge_global_promote` (file-first usage signal + suggestion).
- New command surface `src/scripts/knowledge_global_cli.py`
  (`list|show|trace|forget|promote|validate|lead-check|purge`) + `task
  knowledge-global[-validate]`. Deliberately **not** a `/knowledge` slash
  sub-command — that cluster is unrelated local-file ingestion; the
  structure-grounding global store is a separate concern.
- `check_knowledge_cards.py --global` adds G1 (tier) / G2 (provenance footer) /
  G3 (redaction-clean) checks; `evidence_report.py add --origin global` tags
  GLOBAL leads; the `source-discovery` skill + `evidence-discipline` context
  document the leads-only consumption.
- ADR-098 Decision-10 is marked `superseded_by: ADR-100`.

## Alternatives

- **Keep the kill (do nothing).** Rejected — the operator reversed it; measured
  v1 reuse + the cross-project value case justified building it.
- **A writable per-user service / DB / vector index.** Rejected — that *is* the
  Layer-2 runtime the sunset killed. File-first preserves the sunset's core.
- **Auto-promote on ≥2 without confirm.** Rejected — silent cross-project writes
  break the v1 manual prereq and the privacy posture.
- **A `/knowledge global` slash sub-command.** Rejected — collides semantically
  with the existing local-file-ingestion `/knowledge` cluster (whose `forget`
  means something else). A standalone CLI is v1-consistent
  (`check_knowledge_cards.py` / `evidence_report.py`) and collision-free.

## References

- `agents/roadmaps/archive/road-to-structure-grounding-v2.md` — the roadmap (council
  convergence inlined in its header).
- [ADR-098](ADR-098-evidence-first-structure-discovery.md) — v1; Decision-10
  partially superseded here.
- The 2026-06-14 Layer-2 sunset decision (no runtime) — reconciled, not reversed.
- `src/scripts/_lib/knowledge_global*.py`, `src/scripts/knowledge_global_cli.py`,
  `src/scripts/check_knowledge_cards.py` (`--global`),
  `src/agent-src/contexts/execution/evidence-discipline.md` § Global layer.
