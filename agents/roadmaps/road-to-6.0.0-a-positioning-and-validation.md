---
status: ready
complexity: structural
parent_roadmap: null
---

# Road to 6.0.0-A — Positioning, Validation, and the Execution-Model decision

> First of three `road-to-6.0.0-*` roadmaps for the experience-first rebuild
> (source: `agents/tmp/feedback-6.0.0-part1.{1..5}.txt`, an external
> product/platform review of 5.7.0). This roadmap is the **cheap, high-leverage,
> de-risking** front of the rebuild: fix the *perception* problem (README sells
> "223 skills · 146 commands" instead of an experience), surface profile-first
> install, and — critically — make the **one architectural decision the whole
> rebuild hinges on** before any migration code is written: *is the breaking
> change a "resolver" or just projection-time filtering?*
>
> Sequenced FIRST per the AI-council convergence (claude-sonnet-4-5 + gpt-4o,
> 2 rounds + peer-review, 2026-06-02): "validation → positioning → projection →
> governance; the resolver-first plan is product-backwards." It must complete
> before [`road-to-6.0.0-b-pack-scoped-projection.md`](road-to-6.0.0-b-pack-scoped-projection.md).

## Goal

A new visitor lands on the README and immediately understands: *choose a role,
add packs, get a focused command set* — not "here are 520 artefacts". AI-video
moves out of the hero into a Creative-Pack callout. The install wizard asks
"which experience?" first (today it asks cost-tier only). And the single
load-bearing architecture question — where pack-scoped surfacing is *enforced*
in a package that only projects files — is answered in an ADR before 6.0.0-B
touches the build.

## Context

**Verified reality (re-audit 2026-06-02 — the feedback is ~50% stale).** Much
of what the reviewer assumes is missing already exists; the rebuild is narrower
and sharper than "rebuild everything":

- 6 profiles EXIST (`packages/core/.agent-src.uncondensed/profiles/`,
  `docs/contracts/profile-system.md`): developer, content_creator, founder,
  agency, finance, ops. 3 packs EXIST
  (`packages/core/.agent-src.uncondensed/packs/`) with declared surface caps
  (commands ≤12, skills ≤15, personas ≤4).
- Command namespacing is DONE: 89/150 commands already `cluster:sub` across 28
  clusters (ADR-003); visibility tiers 0/1/2 exist
  (`docs/contracts/command-surface-tiers.md`).
- The install wizard (`docs/wizard.md`) asks **cost profile / rule tier**
  (minimal/balanced/full), NOT "which experience" — profile selection is not
  the install-time surface.
- README hero (`README.md:1–14`) = "Universal AI Agent OS for Founders, Content
  Creators, Consultants, Sales, Finance, Engineering" + a "Cinematic AI video"
  callout in the hero block. `README.md:135` lists "Opinionated skill-resolver
  algorithm" as explicitly **out of scope**.

**The council's central correction.** What the part1 feedback (and my first
plan) called a "runtime resolver" is architecturally incoherent for a package
that only *projects* files into `.claude/`/`.cursor/`/`.augment/`. The real
mechanism is **projection-time filtering**: enhance `build_discovery_manifest.py`
/ the install projection to write only the active profile+packs' artefacts.
Host tools then read a pre-filtered static set; there is no runtime daemon and
no interception. A *true* runtime resolver (mid-session pack switching) is a
separate, **conditional** later phase, gated on evidence that users actually
want it — it lives at the end of 6.0.0-C, not here.

> **Council convergence (claude-sonnet-4-5 + gpt-4o, 2026-06-02, 2 rounds,
> peer-review, $0.22):** "The single most damaging ambiguity is a 'resolver'
> that runs 'at runtime' in a package that 'only projects files'. Decode it as
> projection-time filtering. The biggest *unnamed* risk is validator capture —
> the rebuild rests on an N=1 external review. Front-load a validation gate;
> make positioning (cheap) precede projection (medium) precede governance."

**Validation-gate honesty.** The council's "30-user research sprint" is the same
human-owner recruit-session gate that `road-to-employee-product` Phase 1 has had
blocked for months. We do not pretend a 30-user study is autonomously runnable.
Instead Phase 0 below records the *owner-intent* signal (the maintainer
explicitly directed this rebuild) as the minimum validation, and keeps the
recruit-session gate as the stronger, human-owner upgrade — so the breaking
change is not justified by N=1 alone, and the gate is honest about what
evidence exists.

## Phase 0: Validation gate + the Execution-Model ADR (blocks 6.0.0-B)

- [ ] **Step 1:** Author the **Execution-Model ADR** (next free number, ~ADR-040)
  — "Pack-scoped surfacing is projection-time filtering, not a runtime
  resolver." It MUST answer: *where* the filtering runs (Node build/install +
  `npx agent-config use --profile=X` switch), *how* it integrates with host
  tools (zero — they read static projected files), *when* projection happens
  (install + explicit profile/pack switch), and the trust boundary (the
  projector writes `.claude/`/`.cursor/`/`.augment/`; host tools read-only).
  Explicitly scope a *runtime* resolver OUT of 6.0.0 and mark it conditional.
  Supersede the `README.md:135` "skill-resolver out of scope" line via this ADR.
- [ ] **Step 2:** Author the **validation-gate context note** under
  `agents/settings/contexts/` recording the validation evidence for the
  breaking change: (a) owner-intent (maintainer-directed rebuild, this turn),
  (b) the standing recruit-session gate (human-owner, stronger evidence when it
  runs), (c) the decision rule — "ship 6.0.0-B's projection filtering as
  **opt-in** (legacy-all default) until recruit-session evidence or telemetry
  confirms the 'too many surfaces' hypothesis; only then flip the default in
  6.1.0". This makes the staged rollout (6.0.0-B) the validation mechanism
  rather than a blocking 30-user study.
- [ ] **Step 3:** Author the **rollback-criteria note** (can live in the same
  context file): the staged-rollout default-flip (6.1.0) reverts to legacy-all
  if the post-flip support/issue signal spikes; legacy-all is *retained* (not
  removed) until <10% usage — evidence-based, not calendar-based.

## Phase 1: README + positioning rewrite (experience-first)

- [ ] **Step 4:** Rewrite the `README.md` hero (lines ~1–14) experience-first:
  lead with "Choose your experience (developer · founder · content · agency ·
  finance · ops), add packs, get a focused command set." Replace the artefact
  badges (`Skills-223 · Rules-79 · Commands-150`) in the hero with a one-line
  "choose a profile + packs" value statement; move the raw counts to the
  catalog/docs (per feedback part1.5 §9). Keep the badges row available below
  the fold for maintainers.
- [ ] **Step 5:** Move "Cinematic AI video" out of the hero into a clearly
  labelled **Creative Pack** callout further down (per feedback part1.1 §3 +
  part1.2 "agent-config-creative"). The capability stays first-class; it just
  stops competing with "implement a ticket" for the package's identity. Keep
  the `ai-video` keyword in `package.json`/`.github/topics.yml` but ensure the
  hero copy no longer reads as "video tool".
- [ ] **Step 6:** Update the `check_command_count_messaging.py` expectations +
  any docs the hero-rewrite touches so the canonical-count gate stays green
  with the new hero shape (the gate guards drift between README counts and the
  real artefact counts — the rewrite must keep it satisfied, not bypass it).
  <!-- carve-out: new-gate-verification -->

## Phase 2: Profile-first install surface

- [ ] **Step 7:** Add a profile/experience selection step to the install wizard
  (`docs/wizard.md` flow + the wizard backend) so the first question is "which
  experience?" mapping to the 6 existing profiles, with cost-tier as a
  secondary knob. This is UI/flow only — it sets `profile:` in
  `.agent-settings.yml`; it does NOT yet change projection (that is 6.0.0-B).
  Surfacing the choice early is the cheap perception fix; the behavioural change
  is gated behind 6.0.0-B's staged rollout.
- [ ] **Step 8:** Wire `npx agent-config use --profile=<id>` (and surface it in
  `docs/`) as the explicit profile-switch entry point the Execution-Model ADR
  names — even before projection filtering lands, it writes the setting and is
  the seam 6.0.0-B hooks into.

## Acceptance Criteria

- [ ] Execution-Model ADR merged; `README.md:135` "skill-resolver out of scope"
  superseded; runtime resolver explicitly scoped out of 6.0.0 (conditional).
- [ ] Validation-gate + rollback-criteria context note filed under
  `agents/settings/contexts/`.
- [ ] README hero is experience-first; AI-video relocated to a Creative-Pack
  callout; `check_command_count_messaging` green.
- [ ] Install wizard asks profile/experience first; `agent-config use
  --profile=<id>` writes the setting (no projection change yet).
- [ ] No projection-behaviour change shipped in this roadmap (that is 6.0.0-B);
  this roadmap is perception + the architectural decision only.
