---
status: draft
complexity: lightweight
parent_roadmap: road-to-employee-product-and-external-proof
---

# Roadmap: External-Proof Upgrade — recruit sessions, beta promotion, v1.0 activation events

> Blocked until a human owner schedules the first recruit session (Phase 1) — everything in this roadmap is human-owner or release-event gated by design.

Spawned from the deferred items of `road-to-employee-product-and-external-proof.md` (archived) so that roadmap could close honestly without cancelling work that stays valuable. Per the AI-council decision of 2026-06-08 (claude-sonnet-4-5 + gpt-4o, design mode), recruit sessions are **de-gated, not cancelled**: nothing downstream blocks on them anymore, but running them is the one external-proof upgrade the self-improvement loop cannot fabricate — *can a cold-start external user get in at all?* This roadmap is the standing home for that upgrade plus the two v1.0 activation events that were intentionally not pre-flipped.

## Prerequisites

- [x] Templates + runbook ready — `agents/recruit-sessions/README.md` (recruit definition, personas, consent/redaction floor) and `agents/recruit-sessions/_template.md` (checklist, 8-question script, report skeleton) shipped by the parent roadmap.
- [x] Evidence-basis ledger in place — `agents/roles/EVIDENCE_BASIS.md` records the `beta-internal` (internal-authoring) basis and the upgrade rule: a filed recruit-session report promotes the matching role `beta-internal → beta`.
- [x] Encryption wiring complete behind the flag — ADR-062/063/064 landed wrap/unwrap, per-store wiring, migrate / decrypt-all / rekey across sessions, documents, document-history, analytics. Only the default-flip is outstanding (this roadmap, Phase 3).

## Phase 1: Recruit sessions — human-owner, optional external proof

All three sessions are 60-minute recorded screen-shares with someone who has no prior package exposure; consent + redaction per `agents/recruit-sessions/README.md`. Never fabricated, never simulated by an agent.

- [ ] **Step 1:** Run recruit session 1 — galabau owner, target task: produce a customer offer from a one-paragraph brief. File the report at `agents/recruit-sessions/01-galabau-owner.md`.
- [ ] **Step 2:** Run recruit session 2 — content creator, target task: produce a 4-shot storyboard for a 30-second social video. File `agents/recruit-sessions/02-content-creator.md`.
- [ ] **Step 3:** Run recruit session 3 — consultant, target task: refine a fuzzy client brief into a structured investor memo. File `agents/recruit-sessions/03-consultant.md`.
- [ ] **Step 4:** Consolidate the session reports into `agents/recruit-sessions/_findings.md` — top friction points ranked, each with a proposed roadmap home. Depends on Steps 1–3 (any subset that has run).

## Phase 2: Role promotion + release-notes honesty

- [ ] **Step 1:** For each filed session report, promote the matching role `beta-internal → beta` in `agents/roles/<role>/index.md` (set `recruit_session_ref`) and update `agents/roles/EVIDENCE_BASIS.md`. The `lint_role_experiences.py` status↔recruit_session_ref coupling check must stay green.
- [ ] **Step 2:** When v1.0 ships, state the role-validation basis honestly in the release notes: the internal-authoring basis (`agents/roles/EVIDENCE_BASIS.md`) as default, or a verbatim recruit-participant quote per role where a session has run. Validation ≠ marketing (AI-council 2026-06-08).
- [ ] **Step 3:** Replace the empty-state knowledge-pane screenshot path in `docs/walkthroughs/daily-workspace.md` with a recruit-session-informed capture (real ingested corpus, redacted) and add verbatim quotes — only if at least one session has run; otherwise the maintainer-captured first-run screenshots stand.

## Phase 3: Encrypt-at-rest activation — v1.0 event

> Hard-Floor adjacent: flipping the default changes every user's on-disk data shape on next write. Explicit maintainer decision per `non-destructive-by-default`; never autonomous.

- [ ] **Step 1:** Flip `workspace.encrypt_at_rest` default `false → true` per `docs/contracts/at-rest-encryption.md` — including the user-facing migration modal (detect plaintext stores, encrypt in place, surface the recovery path) that the contract pins to the flip.
- [ ] **Step 2:** Re-run the threat-model checklist from the contract against the flipped default; verify migrate / decrypt-all / rekey paths once on a real plaintext store before release.

## Acceptance Criteria

- [ ] At least one recruit-session report filed and consolidated, with its role promoted to `beta` — or an explicit maintainer decision recorded here that the upgrade is dropped.
- [ ] v1.0 release notes state the validation basis honestly (internal-authoring or recruit-quoted, per role).
- [ ] `workspace.encrypt_at_rest` defaults to `true` with the migration modal shipped — flipped only at the v1.0 activation event.

## Notes

- **Human-owner gated.** No phase here runs autonomously: Phases 1–2 need a real person and a recorder; Phase 3 is a release-event decision under the Hard Floor.
- **Parent:** `archive/road-to-employee-product-and-external-proof.md` — Phases 0–9 shipped; this roadmap carries only what was deferred there (Phase 1 Steps 3–6, the v1.0 release-notes clause, the Phase 8 default-flip).
- **No commit / push / merge implied.** Per `commit-policy`.
