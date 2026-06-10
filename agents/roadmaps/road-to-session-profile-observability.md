---
status: active
complexity: structural
---

# Roadmap: Session-Profile Observability for Employees — make "which profile, what changed, why" legible without a CLI

> Derived from an external 5.8.0 product review (delivered in chat 2026-06-09) and hardened by the
> AI council before becoming a plan. The review's correct headline: Session Profiles are the strongest
> part of the 5.8.0 line, but they add a new mental load for non-technical employees — *which profile is
> active? what does it surface/hide? is it stale? why is the agent behaving differently?* The shipped
> observability surface (`/profile show|surface` + the staleness hook) answers all of that **for a
> developer at a CLI**. This roadmap closes the *legibility* gap for a non-technical employee, and nothing
> else. It deliberately does **not** add a fifth axis, does **not** change overlay semantics, does **not**
> build new workspace UI infrastructure (host agents own their UX), and does **not** touch the Hard-Floor
> connector surface. Two of the review's five asks survive as genuinely-new work; the rest are
> already-shipped or Hard-Floor-cancelled and are recorded here so a later review round does not re-ask.

## Council convergence (vetting the feedback)

Council round (anthropic/claude-sonnet-4-5 + openai/gpt-4o, design lens, 2026-06-09, actual $0.078).
Both members converged on **fold-in over a standalone sprawl** and implicitly rejected the
positioning-roadmap as the home (wrong theme — that roadmap owns doc-drift + 227-skill governance). The
maintainer chose a **focused standalone roadmap** for the two surviving NEW items, cross-referencing the
employee-product roadmap rather than reopening it. Per-item verdict, with the host applying the
convener-and-skeptic duty over the council:

- **P0 Profile UX visible — CONFIRMED-NEW (small).** `/profile show|surface` is CLI/developer-oriented.
  The gap is a *plain-language* status a non-technical employee can read. Council agreed the agent's
  pre-read undersold this.
- **P0 Employee Workflows — ALREADY-DONE (host correction).** The council reasoned about "additive role
  prompts" without the full role inventory. Ground truth: the `support`, `sales`, `leadership` roles
  already ship exactly the named task types — `support/summarise-ticket-thread.md` (ticket summary),
  `support/draft-reply.md` + `sales/answer-customer.md` (customer reply), `sales/prep-discovery-call.md`
  + `leadership/one-on-one-prep.md` (meeting prep), `sales/draft-offer.md` + `galabau/offer-from-brief.md`
  (proposal draft), `support/escalation-risk-analysis.md` + `leadership/risk-analysis-memo.md` (incident
  review). Reduced here to a one-step **gap audit**, not a build phase.
- **P0 Profile Complexity Gate — DOWNGRADED (host rejection of the P0 escalation).** Sonnet escalated to
  "CONFIRMED-NEW P0" on a `tone: [casual, formal]` overlap example. The premise is false: the `/profile`
  overlay unions **pack-id sets only** (order-independent, no precedence), and scalar hints (`preset_id`,
  personas) live in the **single** persistent `profile.id`, never unioned. Sonnet named the exact
  refuting evidence — "show me where `activate()` handles scalar conflicts; I see only set unions" — and
  the ground truth is precisely that. So there is no scalar-precedence bug to gate. It survives only as a
  cheap **preventative guard** that keeps overlays set-only and documents why precedence is a non-concept.
- **P1 Knowledge Connectors — DUPLICATE / Hard-Floor-CANCELLED.** Jira/Confluence/GitHub/CRM sit behind
  OAuth and stay cancelled in `road-to-internal-ai-os-deployment.md` Phase 5; the shipped non-OAuth
  substitute is local-only `/knowledge:ingest`. Both members agreed. Out of scope here.
- **P1 Human Explain Mode for Profile — CONFIRMED-NEW.** A `profile-overlay` explain envelope rendered by
  the existing plain-mode renderer. **Council amendment (Sonnet, accepted):** template-based rendering
  only — no LLM-generated explain text, which would open a hallucination + hidden-pack-name leak surface.

## Prerequisites

- [x] Verify the shipped profile surface — `/profile show` reports `active_packs`, `commands_shown`,
      `skills_shown`, `hidden_total`; `/profile surface --json` lists hidden artefacts + their packs.
      Library/CLI: `scripts/config/session_profiles.py` (`activate|deactivate|show|surface|stale-notice`).
- [x] Verify staleness already exists — `scripts/profile_staleness_hook.py` (`session_start`) emits a
      staleness notice on IDE restart; the overlay never silently resets.
- [x] Verify overlay semantics — `docs/contracts/session-profile-overlay.md`: multiple `/profile activate`
      names **union their `requires_hint` closures** (pack sets); the overlay never sets scalar audience
      hints. Zero mentions of "precedence" or "overlap" because union is order-independent by design.
- [x] Verify the scalar axis is single-valued — profile ymls (`src/agent-src/profiles/*.yml`) carry
      `preset_id` + `personas` under one `profile.id`; the session overlay touches only the `pack` axis
      (ADR-010 addendum). No code path unions two audience profiles.
- [x] Verify the explain surface to reuse — `docs/contracts/explain-modes.md` + `ADR-026`: plain mode is a
      pure renderer over an envelope; `workspace_explain.py render` ships plain (default) + `--mode
      technical`; `/why` quick command exists. Employee-product Phase 6 (this surface) is closed (`[x]`).
- [x] Verify the role-prompt inventory — `agents/roles/{galabau,content-creator,consultant,support,sales,
      leadership}/prompts/` already ship the five reviewer-named task types (see council note above).
- [x] Verify connectors are cancelled-with-reason — `road-to-internal-ai-os-deployment.md` Phase 5
      (OAuth, Hard-Floor); local `/knowledge:ingest|list|forget` is the shipped substitute.
- [x] Confirm gating rules — `non-destructive-by-default` (Hard Floor), `roadmap-progress-sync` (regen
      dashboard same response), `commit-policy` (no commit steps written unsolicited), `scope-control`
      (no version/release/date pins in steps), `augment-source-of-truth` (edit `src/`),
      `framework-neutrality-in-generic-skills`, `preservation-guard`.

## Context

`@event4u/agent-config` turns host agents into reliable team members. The 5.8.0 line shipped Session
Profiles — an ephemeral, runtime modulation of the pack axis that lets a user surface only the packs
relevant to the current session. The capability is strong; the **legibility** of its effect is
CLI-shaped. A non-technical employee does not run `python3 -m scripts.config.session_profiles show
--json`; they notice "the agent offers different things than yesterday" and have no plain-language way to
see why. This roadmap adds a plain surface and a plain explanation over the **existing** state and the
**existing** renderer, plus a one-line guard that keeps the overlay model honest. It builds no new axis,
no new UI substrate, and no connector. The two real phases are small; Phase 3 is a guard + an audit.

---

## Phase 1 — Plain-language profile surface (read the existing state, say it in human words)

Goal: a non-technical employee can see the active profile, what it surfaces/hides, and how stale it is, in
one plain-language reply — over the **existing** `session_profiles.py` state, with zero new overlay logic.

- [x] Author a plain-mode contract addendum (`docs/contracts/session-profile-overlay.md` § "Plain status
      surface") — the human-readable shape of an active-profile summary: active profile name, "you'll see
      X tasks / Y are hidden behind packs you haven't turned on", staleness age in days, and a one-line
      "what changed vs the full surface" sentence. **Template-based only** — the summary is a deterministic
      render of `show`/`surface` JSON, never LLM-generated prose (no hidden-pack-name leak, no
      hallucination surface).
- [x] Extend `/profile show` with a `--plain` flag (and make plain the default when invoked through the
      employee-facing surface) that renders the addendum's template from the existing
      `session_profiles.py show|surface` JSON. No change to `activate|deactivate|surface` semantics.
- [x] Coverage — extend `tests/test_session_profiles.py` with golden plain-render cases: no overlay (full
      surface), single-pack overlay, multi-pack overlay, and a stale overlay (staleness age rendered).
      Run the targeted test once locally to confirm the goldens. <!-- carve-out: new-gate-verification -->
- [x] Cross-reference note — record that when the daily-workspace right-rail (employee-product Phase 4)
      next gets touched, this plain summary is the content it should surface. Do **not** build new
      workspace UI here; this roadmap stays CLI + contract + tests (host agents own their UX).

## Phase 2 — Profile-overlay explain envelope ("why is the agent behaving differently?")

Goal: `/why` answers the profile question, not just the memory/trust question — in plain language, over a
new envelope rendered by the **existing** plain renderer, template-based only.

- [x] Author the `profile-overlay` explain-envelope shape in `docs/contracts/explain-modes.md` (a new
      `envelope_type` alongside `explain-v1`) — fields: active profile, activated seed tokens, expanded
      pack closure, counts surfaced/hidden, staleness age, and the deterministic "what this changed"
      delta. **Trust boundary (council amendment):** the renderer is a pure template over these fields; it
      never calls an LLM to generate the explanation and never reads beyond the overlay state it is given.
- [x] Implement the renderer path — `workspace_explain.py` (or a sibling `profile_explain.py` if the
      shared module would couple awkwardly) renders the `profile-overlay` envelope in plain mode by
      default, `--mode technical` for the engineering-lead view, reusing the explain-modes plumbing and the
      4-band/3-band convention. Build the envelope from `session_profiles.py show|surface` output.
- [x] Wire `/why profile` (or extend `/why` to detect "why is the surface different / why these
      commands") to emit the `profile-overlay` plain render. One question per turn if the intent is
      ambiguous (memory-explain vs profile-explain), per `ask-when-uncertain`.
      <!-- done: wired as `session_profiles explain --mode plain|technical` (a script subcommand) + agent-intent routing documented in explain-modes.md § profile-overlay — same model as /why for memory. Deliberately NOT a new top-level command verb (that needs an ADR-041 verb addition; the /why intent routes to the explain subcommand, no new surface). -->
- [x] **(renderer detail)** Built `src/scripts/config/profile_explain.py` (sibling to session_profiles, not a shared workspace module — the workspace one doesn't exist post-`src/` move and would couple awkwardly).
- [x] Coverage — `tests/` golden cases for the `profile-overlay` renderer: no overlay, single overlay,
      multi-pack overlay, stale overlay, and a missing-field placeholder (renderer never throws). Run the
      targeted test once locally. <!-- carve-out: new-gate-verification -->

## Phase 3 — Overlay-integrity guard + employee task-type gap audit

Goal: keep the overlay model provably set-only (so the "precedence" concern stays a non-concept), and
confirm the reviewer's employee workflows are genuinely covered rather than assumed.

- [ ] Overlay-integrity guard — a cheap lint (`src/scripts/lint_profile_overlay_set_only.py`, or a check
      folded into the existing discovery-vocabulary lint) asserting that every `/profile activate` token
      resolves only to pack-id sets and that no profile/pack path injects a **scalar** audience hint into
      the `runtime.active_packs` overlay. This freezes the order-independent union invariant and makes a
      future scalar-precedence regression fail the build. Add one contract sentence to
      `session-profile-overlay.md` stating precedence is intentionally undefined because overlays are
      set-only. Run the lint once locally to confirm it passes today. <!-- carve-out: new-gate-verification -->
- [ ] Employee task-type gap audit — confirm the five reviewer-named workflows (ticket summary, customer
      reply, meeting prep, proposal draft, incident review) each resolve to an existing role prompt under
      `agents/roles/*/prompts/`; record the mapping in a short note. If exactly one is genuinely missing a
      dedicated prompt (candidate: a first-class "incident review" distinct from `escalation-risk-analysis`
      / `risk-analysis-memo`), add **one** additive role prompt following the existing
      `role-experience` contract — no orchestration, no new system. Anything that wants multi-step
      orchestration is explicitly **out of scope** (see below).

---

## Out of scope — do NOT do in this roadmap

- **Knowledge connectors** (Jira / Confluence / GitHub / CRM / Support KB) — Hard-Floor OAuth, cancelled
  in `road-to-internal-ai-os-deployment.md` Phase 5. Local `/knowledge:ingest` is the shipped substitute.
- **Orchestrated multi-step "workflows"** (state-machine ticket→summary→reply→review loops) — a separate,
  much larger surface (a flow engine). The reviewer's task types are standalone prompts, already shipped.
- **New workspace UI infrastructure** — the daily-workspace surface lives in
  `road-to-employee-product-and-external-proof.md` Phase 4; this roadmap feeds it content, never builds it.
- **A fifth profile axis / new overlay semantics** — the overlay stays an ephemeral pack-axis modulation
  (ADR-010 addendum). No precedence engine, no scalar-hint unioning.
- **LLM-generated profile explanations** — template-based rendering only (council trust-boundary amendment).
- **Renaming / reconciling the overloaded "profile" word** — already documented in the overlay contract's
  reconciliation table; no rename here.

## Acceptance criteria

- `/profile show --plain` renders a deterministic, template-based human summary (active profile, surfaced
  vs hidden, staleness age, what-changed) from the existing `session_profiles.py` JSON; golden tests green.
- A `profile-overlay` explain envelope + plain renderer ships; `/why profile` answers "why is the surface
  different" in plain language, technical mode available; golden tests green; the renderer never calls an
  LLM and never reads beyond the overlay state.
- An overlay-integrity guard asserts the overlay stays set-only, with a contract sentence stating
  precedence is intentionally undefined; the lint passes today and would fail on a scalar-hint regression.
- The five reviewer-named employee workflows are mapped to existing role prompts; at most one additive
  prompt is added (incident review) following the `role-experience` contract.
- No step pins a version, release target, or date; no connector or workspace-UI work is performed.

## Notes / cross-references

- **Depends on:** the shipped 5.8.0 profile surface (`road-to-session-profile-activation.md`, archived) and
  employee-product Phase 6 explain-modes (`road-to-employee-product-and-external-proof.md`, Phase 6 closed).
- **Feeds:** `road-to-employee-product-and-external-proof.md` Phase 4 daily-workspace right-rail (the plain
  profile summary is the content that surface should show when it is next touched). Coordinate timing;
  do not duplicate that roadmap's workspace work.
- **Council provenance:** anthropic/claude-sonnet-4-5 + openai/gpt-4o, design lens, 2026-06-09 — converged
  on fold-in; host downgraded the Profile-Complexity-Gate P0 escalation and reclassified Employee Workflows
  as already-shipped after verifying the full role inventory.
- **No commit / push / merge implied** — release shape and commit timing decided per turn per `commit-policy`.
