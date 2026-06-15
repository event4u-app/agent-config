<!-- analyzed: 2026-05-27 | commit: 57588489 | files: 3 -->
# Analysis — external feedback rounds 9–13 triage (for roadmap routing)

## Goal

Five external review files (`agents/tmp/feedback9.txt … feedback13.txt`) score
`agent-config` as a product. Decide which suggestions genuinely apply and are
**not already tracked or deliberately deferred**, then group the survivors into
new or existing roadmaps. This analysis is the triage; the council is asked to
critique its dedup, evidence quality, and roadmap-readiness.

## Source caveat (read first)

The five files are from an external AI (Packagist citation shows
`utm_source=chatgpt.com`). It **reconstructed** repo state by scraping
Glama.ai and Packagist, not by reading the tree. Symptoms:

- Artefact counts drift between files (218 vs 173 skills/rules/commands).
- It claims state it could not fetch ("ich rekonstruiere den Delta").
- Several concrete claims are **stale or hallucinated** (verified below).

Treat scores ("10/10", "Internal AI OS 9.2") as motivational noise. Treat the
prose recommendations as hypotheses to verify, not facts.

## Verified against the actual repo (2026-05-27, main @ 4.3.0)

| Feedback claim | Verdict | Evidence |
|---|---|---|
| Packagist stuck at 1.0.4 | **Registry-side only** | repo is `4.3.0` (`package.json`); composer is git-tag driven. Two-track staleness is real but is a registry/human chore, not a code gap. |
| New `agency` + `ops` profiles | **TRUE** | `packages/core/.agent-src.uncondensed/profiles/{agency,ops}.yml` exist. Nothing to do — already shipped. |
| `agents/recruit-sessions/` is empty | **FALSE / STALE** | dir has `README.md`, `_template.md`, `_runbook.md`, `_findings-distribution.md`. Only the per-session reports (`01-galabau…`) are missing — already tracked as human-owner gate in the employee-product roadmap Phase 1. |
| `docs/mcp-submission-checklist.md` exists | **FALSE / HALLUCINATED** | only `docs/distribution/registries.md` exists. |
| No `BREAKING_CHANGES.md` | **TRUE** | `CHANGELOG.md` exists; no dedicated breaking-change doc. |
| SSE wizard edge-case tests missing | **TRUE** | no `test_wizard_sse.py` / abort-on-disconnect / malformed-NDJSON / no-terminal-frame tests found. |
| Glama "unclaimed" / C maintenance | **Plausible, human-only** | 5-minute maintainer login action; not agent-doable. |

## Already tracked or deliberately Hard-Floor-deferred — REJECT as new work

`agents/roadmaps/road-to-employee-product-and-external-proof.md` already owns
the bulk of the feedback's "big" asks. Re-adding them would be the exact
"build more framework / scope creep" the feedback itself warns against.

| Feedback theme (rounds 9/12) | Where it already lives |
|---|---|
| Org model (auth/users/roles/quotas/audit) | Hard-Floor cancelled; stubs `road-to-team-sso.md`, `road-to-central-policy.md`, gated on "real first customer + funded security audit". |
| Connectors (Jira/GitHub/Confluence/CRM, OAuth) | Hard-Floor cancelled; `road-to-internal-connectors.md` stub. Local-only subset shipped as Phase 2 knowledge ingestion. |
| Employee workspace / chat / quick actions | Phases 4–9 (workspace shell, launcher, history, documents, plain-explain, analytics). |
| Non-dev role surfaces | Phase 3 role experiences (galabau / content-creator / consultant). |
| Shared company memory (SOP/pricing/tone) | Partially: `docs/deploy/small-team-recipe.md` (shared overrides + NAS). |
| Recruit sessions (external proof) | Phase 1, human-owner-gated, scaffolds shipped. |
| MCP registry listing / CI hardening | Phase 0 Steps 1–4. |

The roadmap explicitly states feedback rounds that re-ask for "team SSO when?"
are answered by the cancelled-with-reason wall. Feedback 9 and 12 are exactly
those rounds. **Product-identity "decide control-plane vs employee-product"
(feedback12 P0#1) is already answered** by that roadmap's "What this roadmap is
not" section + the pending README positioning anchor (Phase 0 Step 5). Not new.

## Genuinely new, in-scope, credible — CANDIDATES

Items not tracked anywhere, verified against the repo, and consistent with the
package's own values (size-enforcement, kernel budget, verify-before-complete).

### Cluster 1 — Abstraction-budget / simplicity audit (strongest recurring theme)
- feedback9 §4 (product complexity) + §5 (scope-creep), feedback12 §5 (scope drift) + P1#6 (simplicity audit), feedback11 (keep frontmatter lean — "packs + frontmatter necessary, too many governance fields = danger").
- Concrete sub-asks: (a) audit whether any abstraction (pack / role / directive / council / trust field / flow / command) is now dead weight and can be merged or removed; (b) frontmatter field-bloat audit — minimum viable contract, optional fields only when used.
- Evidence grade: **inferred** (qualitative, but repeated 3× and self-consistent with kernel-budget discipline).
- Risk: a "simplicity audit" must be a **reduction** exercise; it must not itself spawn new abstraction. The feedback warns explicitly against "more meta-roadmaps".

### Cluster 2 — Release & distribution communication hygiene
- (a) `BREAKING_CHANGES.md` / explicit semver note: two major bumps (3→4) in ~6 days with no public breaking-change notes (feedback13). Needs human input on *what actually broke*.
- (b) Commit-message discipline: "commit leftovers" is the 3rd sloppy subject in recent releases (feedback13). Likely a rule/learning, maybe not a roadmap.
- (c) Packagist 1.0.x → npm pointer / deprecation in `composer.json` description (agent-doable, small). Glama claim + quality-score = human-only chores; capture as a checklist, not agent steps.
- Evidence grade: **confirmed** for (a) and (c); **confirmed** but minor for (b).

### Cluster 3 — Wizard SSE test hardening
- Three named edge-case tests (feedback13): abort-on-disconnect kills child, malformed-NDJSON does not break stream, no-terminal-frame emits synthetic done. Plus CSRF-rejection path.
- The feature (`road-to-single-install-source-of-truth`) just landed/archived; these are its natural follow-up tests.
- Evidence grade: **confirmed** (tests verified absent; feature verified present).

## Proposed roadmap routing (the decision the council critiques)

1. **CREATE** `road-to-abstraction-budget-audit.md` — Cluster 1. Reduction-only charter; output is "merge/remove/keep" verdicts per abstraction + a lean frontmatter contract, not new machinery.
2. **CREATE** `road-to-release-and-distribution-hygiene.md` — Cluster 2 (BREAKING_CHANGES, composer pointer, commit-message lint, Glama/Packagist human-chore checklist).
3. **Cluster 3** — small. Option A: a short standalone `road-to-wizard-sse-hardening.md`; Option B: a section appended to an existing install/test roadmap. Lean toward A only if no install roadmap is active.
4. **EDIT** `road-to-employee-product-and-external-proof.md` Phase 0 — add the Glama-claim + Packagist-pointer as explicit human-owner chores if not better homed in #2.

## Question for the council

Given the source caveat and the "already tracked / Hard-Floor" rejections:
which of Clusters 1–3 are genuinely roadmap-worthy vs noise, is the proposed
3-roadmap split right (or should Cluster 3 fold into Cluster 2), and is there
any **verified-new** item I dropped that deserves a home? Rank roadmap-ready
findings first.
