---
complexity: structural
status: ready
parent_roadmap: road-to-structure-grounding
---

# Roadmap: Structure-grounding v2 — global cross-project card sharing

> The v1 evidence discipline + project-local cards shipped (ADR-098).
> v1's Phase-4 gated the global layer behind 4–6 weeks of measured reuse and
> was then **killed** (ADR-098 Decision-10). **The operator reversed that kill
> 2026-06-15:** build the global cross-project sharing layer **now**, gated by a
> user-global `.agent-settings.yml` setting, **default ON**, off-able later.
> This roadmap is the council-designed follow-up the v1 Phase-4 anticipated.

**Trigger:** Operator wants knowledge cards to be reusable across projects, not
just within one repo — promoted to a per-user global store and surfaced in any
project, automatically for the safe cases, settable, default-on.

> **Council convergence (2026-06-15, claude-sonnet-4-5 + gpt-4o, design mode).**
> Both members converged independently. **File-first is viable** — plain card
> files under `~/.event4u/agent-config/knowledge/`, lazy-read, **no daemon / DB /
> vector index / background decay** — which preserves the 2026-06-14 Layer-2
> sunset's *core* (no runtime). Anthropic's caveat: the global store is
> **unversioned** (not in git), so it is *storage*, not *governed* like
> project-local cards — an **accepted-risk** (provenance footer = audit trail;
> it is a cache, never a source of truth). **Promotion = hybrid:** auto-*suggest*
> when a card is seen in ≥2 distinct repos + **manual one-tap confirm** — never
> silent auto-promote (preserves the v1 manual prereq; default-on turns *sharing*
> on, not *promotion* automatic). **Global cards = leads / negative-facts only,
> never positive-structure build-inputs** (version skew, schema drift,
> confidential leakage) — global-sourced positive structure loads as "Assumed
> (GLOBAL, unverified)" and is re-confirmed in the consuming project. **Privacy
> via origin-tier scoping** (operator-confirmed 2026-06-15): **public** (npm /
> GitHub / docs) auto-shareable; **vendor** (Stripe/AWS/…) shareable **with
> redaction**; **proprietary** (in-house DB/API, client schemas) **default-OFF +
> manual only**, regardless of the global setting — this is what makes default-on
> defensible (no client-A schema leaking into client-B's session). Redaction on
> write via `low-impact-corpus-privacy-floor` + `source-confidentiality`,
> halt-on-trigger. Full kill-switch leaves v1 intact.

## Goal

Ship a **file-first, tier-scoped, privacy-guarded** global knowledge-card layer:
expensive *public/vendor* evidence promoted (auto-suggest + confirm) to a
per-user store and reused across projects as **leads only**, while *in-house /
proprietary* structure never auto-crosses a project boundary. Default-on for the
safe tiers, one setting to disable, v1 fully intact when off.

## Scope line

- **In scope:** the `knowledge.global_sharing` user-global setting (default on);
  the file-first global store + origin-tier detection; write-time redaction +
  tier gating; hybrid promotion (suggest ≥2 + confirm); leads-only global trust
  posture + Evidence-Report wiring; the `knowledge global list|show|forget|trace`
  command surface + provenance footer; guardrails (pointer-CI strict, freshness
  flip, lead-only enforcement, a `validate` command); the kill-switch + `purge`;
  ADR-099 reversing the kill + documenting the Layer-2-sunset override.
- **Out of scope:** any runtime (daemon, DB, vector index, background decay);
  auto-promote without confirm; proprietary-tier auto-share; positive structure
  as a global build-input.

## Phase 0 — Setting + global store + tier detection
- [ ] Add `knowledge.global_sharing` to the user-global `.agent-settings.yml` template: `enabled: true` (default on), `allowed_tiers: [public, vendor]` (proprietary excluded by design), `redaction: { enabled: true, halt_on_trigger: true }`, `auto_promote_threshold: 2` (suggest, not silent). Document the off-switch = full no-op.
- [ ] Resolve the file-first global store path `~/.event4u/agent-config/knowledge/` (install `global` scope); create lazily; no index, no daemon.
- [ ] **Origin-tier detection** helper: classify a card source as `public` (registry/GitHub/docs URL), `vendor` (known SaaS API hosts), or `proprietary` (in-house DB / private API / repo-relative) — written to the card frontmatter `tier:`.

## Phase 1 — Tier-scoped sharing + redaction (the privacy crux)
- [ ] Write-time redaction on any card eligible to go global: run `low-impact-corpus-privacy-floor` + `source-confidentiality` patterns (API keys, internal hostnames, emails, blocklisted field/table names); **halt-and-prompt** on a trigger, never silent-share.
- [ ] Tier gating: `public` + `vendor` (post-redaction) are auto-eligible under default-on; **`proprietary` is default-off + manual-only**, regardless of `enabled`. Per-source opt-out via a project `share-blocklist`.
- [ ] A global card is a **distillation**, not a copy: negative facts + pointers (`trust: durable`) + positive structure as explicit `hypothesis`.

## Phase 2 — Hybrid promotion + leads-only trust
- [ ] Rebuild the usage signal **file-first** (replaces the removed `knowledge_card_usage.py`): per card, `seen_in: [repo-slug,…]` (identity not path; privacy floor). No global write on its own.
- [ ] Promotion: when a card is `public`/`vendor` and `len(seen_in) >= threshold`, **suggest** promotion with a one-tap confirm; `proprietary` always manual. Never auto-promote silently.
- [ ] **Leads-only consumption:** a global card loaded in a project enters the Evidence Report as **"Assumed (from card · GLOBAL, unverified)"**; positive structure must be re-confirmed against the live source this session before use. Negative facts + pointers are usable as leads.

## Phase 3 — Command surface + provenance
- [ ] `knowledge global list` / `show <card>` / `trace <card>` (where-used) / `forget <card>` / `forget --tier proprietary`.
- [ ] Provenance footer on every global card: `first_seen` (repo-slug + date), `promoted_at`, `last_verified`, `tier`, `seen_in`. The audit trail that substitutes for git history (council accepted-risk).

## Phase 4 — Guardrails
- [ ] Extend `check_knowledge_cards.py` for global cards (strict pointer-CI; tier ∈ {public,vendor,proprietary}; redaction patterns must have fired for vendor cards carrying secrets).
- [ ] A `knowledge global validate` command (offline by default; opt-in URL check) for the untracked store; freshness flip (≥90d → `hypothesis`, ≥180d → `stale`, skipped until re-verified).
- [ ] Lead-only enforcement: surface a post-task violation if a `GLOBAL` positive-structure line was used without this-session re-confirmation.

## Phase 5 — Kill-switch, ADR, sync
- [ ] `enabled: false` → global store never read/written; no `promote`; Evidence Reports revert to project-local; existing global cards inert. `knowledge global purge --confirm` removes the store + strips provenance from project cards. v1 regression: project-local path unchanged.
- [ ] **ADR-099** (via `adr-create`): reverse ADR-098 Decision-10 (un-kill v2); record the **deliberate Layer-2-sunset override** with the council's reconciliation (file-first ≠ runtime) + the accepted risks (unversioned cache, last-write-wins, lazy freshness, residual manual-promotion leak); `supersedes: ADR-098` partial (Decision-10 only). Update ADR-098 with a `superseded_by` pointer on Decision-10.
- [ ] Update catalog/discovery + see-also (new commands, setting, extended skill/rule); regenerate derived projections; CI/lint green.

## Acceptance criteria

1. With `global_sharing.enabled: true` (default), a `public`/`vendor` card seen in ≥2 repos triggers a **promotion suggestion**; on confirm it lands in `~/.event4u/agent-config/knowledge/` (file-first, no runtime) and is reusable in other projects **as a lead**.
2. A `proprietary` (in-house DB/API/client-schema) card is **never auto-shared** — manual-only regardless of the setting; write-time redaction halts on confidential triggers.
3. A global card's positive structure loads as **"Assumed (GLOBAL, unverified)"** and is re-confirmed against the live source before use; negative facts + pointers are usable leads; pointer-CI strict + freshness flip enforced.
4. `enabled: false` fully no-ops the layer; v1 (project-local discipline + cards) is byte-for-byte unaffected; `purge` cleanly removes the store.
5. ADR-099 records the kill-reversal + the Layer-2-sunset override + the accepted risks; ADR-098 Decision-10 carries a `superseded_by` pointer.
6. No runtime introduced (no daemon/DB/vector/decay-loop); all lint/CI gates green.
