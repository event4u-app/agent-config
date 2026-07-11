---
status: later
complexity: lightweight
---

# Road to opt harness discipline — port the native-harness behaviors weaker hosts don't have

> **Parked in `later/` by maintainer decision (2026-07-12).**
> Blocked until: the pre-existing active roadmap portfolio (the
> roadmaps that were active before the 2026-07-11 `road-to-opt-*`
> cluster landed) is worked down, OR the maintainer explicitly and
> exclusively requests execution of this roadmap. Do NOT pick this
> file up as part of another task or an autonomous sweep.

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). Two source pools:
> (a) harness-engineering references analyzed with the 2026-07-10
> loop-engineering lock strictly honored (zero new autonomous loop
> surfaces — outer bash loops, scheduled automations, timer lints, and
> standing goal-watchers all stay rejected), and (b) the maintainer's own
> draft discipline artifacts in `agents/tmp.old/fable/`, whose content a
> leaked current-generation coding-harness prompt confirms almost
> verbatim as NATIVE behavior on the strongest host — and absent on
> every other host this package targets. That reframes the drafts from
> "make weak models act stronger" to "cross-tool ports of proven harness
> discipline", which is exactly this package's mandate.

## Goal

Land three verified harness-discipline gaps (environment bootstrap,
machine-checkable step verification, error-signature triage) plus the
promotion of the `agents/tmp.old/fable/` draft rules — and resolve one
flagged style-contract tension — without creating any new loop surface.

## Prerequisites

- Loop-engineering lock (council 2026-07-10) read and honored: nothing in
  this roadmap runs unattended or on a timer.
- Verified 2026-07-11: no rule/skill named `grounding-before-action`,
  `self-verification-before-done`, `effort-and-stop-discipline`, or an
  operating-loop skill exists in `src/`; behaviors are only partially
  covered piecemeal (`verify-before-complete`, `think-before-action`,
  `notes-first-reasoning`, `context-hygiene`).

## Provenance

Sources referenced anonymously per `source-confidentiality`; real links
retained encrypted:

- Source A (harness-engineering article): `ENC1:T2AazJOvB/Wc+n9g0dUdJNfM+aDDKNHUDt62l622l+dNOQc09e3b6HL0toWpAXFxpLKqAxnpPK+y05O3dQpGUpBTB5E4uyvOhMcuCKBI3u0BfAWD7yFqIJOeyWDKPoEKo6rAtezd7Drf2c6o3CunEHAGGMyp+AhvoD75gNFIZD+JZPWt0yD1118Rz/dNGLOJZA==`
- Source B (loop-discipline article): `ENC1:V5YP6M74y3B/Rw7b1zkwAFYagP29JU8aE/IZbZKx2F46TT286cnZAETdoov2BeCPFmXQsgAsG6m7wb23qbl5KfRzmjvW4lavvhc7H7sHgk78P8kDM7/9GP6O5a2MiFwt33vXbMMaFK/AISCc6jpKAUXhGEhRWWeJXoBYW0OiFB72OS4SkEav0w==`
- Source C (leaked harness profile): `ENC1:OkDMSw1H8riL2IYYW/e3LT2hIqXkBbkG3LMCx80RM7pKgvKYGp51LJB+EynSrmJQv3HrBVd7D7+WPGM2VJaIRGCfvaXw8hJ13jBKVM1hdDMKWZxhA5C5O2eRS//M8eitODHDKZ7utWJRSJy453Hbg1WPNYnCcEaQbNY85P9G/kR8uI6IrSYOJdyAr9Ejep2YEr0xOWoK`

## Phase 1 — deterministic environment bootstrap (S)

Hot-context restores MEMORY across sessions; nothing restores the
ENVIRONMENT. Long-running work re-derives "how do I stand this project
up" every session.

- [ ] Define the convention: an optional per-project bootstrap entry
      (an `env-bootstrap` script or documented equivalent in the
      project's runner file) that a session/worktree start may run to
      stand up services, deps, and fixtures deterministically.
- [ ] Wire the detection into the session-start surface (hot-context
      hook or worktree-create path): if the bootstrap entry exists,
      surface it to the agent as the first suggested action — suggest,
      never auto-execute (no new autonomous surface).
- [ ] Consumer template: document the convention in the consumer-facing
      templates so installed projects can adopt it.

**Exit criteria:** convention documented; detection surfaced at session
start on a fixture project; zero auto-execution.

## Phase 2 — machine-checkable step verification (M)

Roadmap checkboxes are agent-asserted today. `think-before-action`
already mandates a `verify:` per step as prose; the delta is making the
flip verifiable.

- [ ] Extend the roadmap-step convention: a step MAY carry a named
      `verify:` command; when present, the process-loop's flip-guard
      treats a checkbox flip without a fresh green run of that command
      as a violation (deterministic check in the existing flip-guard,
      not a new loop).
- [ ] Author-side support: `roadmap-writing` documents when to bind a
      `verify:` (behavior-changing steps yes; doc-only steps optional).
- [ ] Retro-fit the opt-cluster roadmaps' own high-risk steps with
      `verify:` commands as the first consumers.

**Exit criteria:** flip-guard rejects an unverified flip on a fixture
roadmap; convention documented; opt-cluster steps carry `verify:` where
behavior-changing.

## Phase 3 — error-signature triage in the failure counter (S)

`context-hygiene`'s 3-failure rule counts attempts but treats all
failures alike. Verified gap: no same-error-vs-new-error discrimination,
no hard-blocker classes.

- [ ] Amend `context-hygiene` § 3-Failure Rule: define failure identity
      (same test + same error signature = same failure); same failure
      twice → stop and pivot strategy (don't burn the third attempt on
      an identical retry); new error each attempt = progress, counter
      continues.
- [ ] Define hard-blocker classes that skip retries entirely and go
      straight to ask/surface: missing credentials, permission denials,
      spend limits, external-service 5xx — retrying cannot fix these.
- [ ] Cross-link from `systematic-debugging`'s micro-loop so both
      surfaces state the same taxonomy.

**Exit criteria:** rule amended within its existing size budget;
taxonomy identical in both artifacts (grep-verified).

## Phase 4 — promote the fable draft rules as cross-tool harness ports (S)

Source C (a leaked current-generation coding-harness prompt, ~1800
lines) contains near-verbatim the behaviors the
`agents/tmp.old/fable/` drafts propose: an end-of-turn promissory-
closing check ("your last paragraph is a plan/promise → do that work
now; end only when complete or blocked on user-only input") and
evidence-before-state-changing-command ("a signal that pattern-matches
a known failure may have a different cause"). These are NATIVE on that
host and absent on the other hosts this package projects to.

- [ ] Promote `grounding-before-action` and
      `self-verification-before-done` +
      `effort-and-stop-discipline` from the drafts into `src/rules/`
      (or fold into the nearest existing rule where overlap is > 50% —
      check `verify-before-complete`, `think-before-action` first and
      extend rather than duplicate), reframed as cross-tool ports of
      proven harness discipline.
- [ ] Evaluate the drafts' unified operating-loop skill
      (GROUND → PLAN → BUILD → SELF-VERIFY → STOP) + `deep-work` flow
      overlay: adopt as ONE skill only if the promoted rules leave a
      real routing gap; otherwise record the fold decision.
- [ ] Trigger-eval stubs for whatever lands (should-trigger /
      should-not-trigger per `skill-writing` § 1c).
- [ ] Move the processed `agents/tmp.old/fable/` drafts' disposition
      note into the change description (files stay in tmp.old; they are
      already in the graveyard — the promotion is the disposition).

**Exit criteria:** promoted artifacts pass the skill/rule linters; no
duplicate of an existing rule's scope (overlap check documented);
trigger evals present.

## Phase 5 — style-contract tension: decision step (no silent resolve)

- [ ] Surface to the maintainer: Source C's harness mandates complete
      sentences and bans fragment/arrow-chain prose, which directly
      conflicts with `telegraph-speak`'s condensation grammar for reply
      prose. Present the trade-off (readability-for-humans vs token
      frugality; current `speak_scope` default) as a numbered-options
      decision; record the outcome in the telegraph-speak rule or a
      context note. This roadmap does NOT pre-decide it.

## Acceptance criteria

- Zero new autonomous loop surfaces — every mechanism here is
  suggest-only, check-on-action, or a prose/rule amendment (the
  loop-engineering lock survives intact).
- No duplicated rule scope: every promotion either extends an existing
  artifact or documents why a new one is warranted.
- The style tension is decided by the maintainer, not resolved silently.