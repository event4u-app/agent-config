---
complexity: lightweight
status: ready
tree_pin: ac6c60802a
execution:
  mode: phase-checkpoints
depends: [road-to-typed-grants-that-persist]
relates:
  - slug: road-to-decision-closure
    relation: extends
    note: >-
      Owns the kernel `ask-when-uncertain` packet (its step 3.1) and the native-default
      wording. This roadmap does not edit a kernel rule; D6 and D10 arrived there as an
      `Arrivals:` line instead of a step here.
  - slug: road-to-typed-grants-that-persist
    relation: depends
    note: >-
      Its step 1.4 ships `personal.autonomy: on` (ADR-260 § 3). The "ask less" half of this
      roadmap stands on it; D11 arrived there as an `Arrivals:` line.
estate_offset_exempt: >-
  Owner search before writing: `grep -rlF -e _USER_FENCE_MARKERS -e _ACTION_VERBS
  -e "interview me" -e trigger_description -- agents/roadmaps/*.md agents/roadmaps/later
  agents/roadmaps/stubs` over the whole roadmap tree returned no owner of the trigger,
  fence, scorer or interview-format subjects; the two hits (decision-closure,
  typed-grants) own only the kernel and autonomy halves, which landed there as arrivals.
  Created active because the invocation asked for `/roadmap:process-full` on it
  (directive 2026-10-24 § 3 exception); the active count is 2 before this file.
---
# Road to the question only the owner can answer

> **Source:** `agents/tmp.old/inbox-2026-10-be/` topic `t01` — a transcript plus a supplied
> three-loop plan about ending prompts with an "interview me" sentence. Every tree claim
> was re-verified at `ac6c60802a` (D1–D13 all still true; none overtaken).

## Goal

A user who asks to be interviewed — in English or German — reaches the interview, is
fenced as owner-consulted, is scored the same as an English speaker, and gets questions
in the form Iron Law 1 prescribes; and a technical gap on a plain prompt is decided and
stated rather than handed back. What only the owner can unblock is parked with a named
question, never silently dropped.

## Point ledger (inbox round)

- **Owner demand (transcript turn 3):** "Können wir diesen Satz auch automatisch
  anhängen? Mit einem Hook oder so?" → `owner-decision` (OQ-22, step 3.1): the form —
  personal hook vs. shipped opt-in concern — is a product choice, and a shipped opt-in key
  collides with the 2026-10-12 owner line against new form settings (ADR-293).
- **Supplied plan D1–D13:** D1, D3 (fence half), D4, D7, D8 (check half), D12 → steps
  1.1–2.3 here. D2 → owner-decision (OQ-23). D5, D9, D13 → `[~]` here. D6, D10 → arrival
  on `road-to-decision-closure`. D11 → arrival on `road-to-typed-grants-that-persist`.
- **Kill register K1–K10 of the plan:** adopted as written (no suffix by default, no
  ambiguity hook, no new `/interview` command, no subagent asks).

## Phase 1 — "Interview me" reaches the interview and is fenced

- [x] **1.1 Interview phrasings in the challenge-me / grill-me triggers (D1).** Add EN and
      DE interview phrasings ("interview me", "ask me follow-up questions", "stell mir
      Rückfragen", "interview mich", "frag mich aus") to both `trigger_description` lines.
      verify: `npx vitest run tests/scripts/command_suggester_interview_triggers.test.ts`
      — each phrasing tops at `challenge-me` or `grill-me` with confidence ≥ 0.6.
- [x] **1.2 German and recipe phrasings fence as owner-consulted (D3, marker half).** Add
      "interview me", "interview mich", "rückfragen", "stell mir fragen", "bevor du
      loslegst" to `_USER_FENCE_MARKERS` in `src/scripts/ai_council/necessity.ts`.
      verify: a test asserts `classify_impact` returns `user_required` for the five
      phrasings and leaves a control prompt unchanged.

## Phase 2 — The intake reads German fairly and asks in one form

- [x] **2.1 German action verbs in the intake scorer (D4).** Add German imperative stems
      beside the English set in `confidence.ts` `_ACTION_VERBS`.
      verify: `npx vitest run tests/scripts/work_engine/scoring_confidence.test.ts` with
      ≥ 10 EN/DE pairs landing in the same band.
- [x] **2.2 The interview speaks Iron Law 1 (D7).** Replace the bold-option-1 rule in
      `src/domains/meta/challenge-me/vision/command.md` with a neutral option block plus
      exactly one recommendation line under it; on a native host the recommendation is the
      first option. Drop the self-rated `~XX%` display.
      verify: `grep -c 'always \*\*option 1\*\* and labelled \*\*bold\*\*' src/domains/meta/challenge-me/vision/command.md` → 0.
- [x] **2.3 One check that picker declarations agree (D8, check half).** A test asserts
      that `hook_manifest.yaml` `ask: native` holds for exactly the hosts whose
      `host_capability` row reads `structured_ask: true`.
      verify: the test fails when one `ask:` row is flipped (sensitivity shown once).
- [x] **2.4 Intake pass on a plain prompt, model-carried (D12).** A section in
      `cheap-question-mechanics.md`: look up facts, decide and state technical choices
      as the agent's call, and put one owner question before work only when a product,
      business or taste gap remains.
      verify: `grep -n '## Intake pass' src/agent-src/contexts/execution/cheap-question-mechanics.md` returns one line.

## Phase 3 — Parked: owner decisions, measurements, headroom

- [~] **3.1 Append the interview sentence automatically (owner demand).** <!-- blocked-by: interview-suffix-form-is-an-owner-decision | asked: no — queued as OQ-22/OQ-23 in agents/owner-questions.md per the 2026-10-24 directive --> <!-- deferred-resolution: carried-to=road-to-the-question-only-the-owner-can-answer-carried -->
      verify: OQ-22 answered and the chosen form ships with a fixture.
- [~] **3.2 Interview reachable outside the maintainer workspace (D2).** <!-- blocked-by: interview-suffix-form-is-an-owner-decision | asked: no — queued as OQ-22/OQ-23 in agents/owner-questions.md per the 2026-10-24 directive --> <!-- deferred-resolution: carried-to=road-to-the-question-only-the-owner-can-answer-carried -->
      verify: OQ-23 answered; `lint_discovery_vocabulary` green.
- [~] **3.3 Absence scored as unknown, plus a taste dimension (D5).** <!-- blocked-by: intake-band-shift-needs-a-baseline --> <!-- deferred-resolution: carried-to=road-to-the-question-only-the-owner-can-answer-carried -->
      verify: G4 fixtures — "make it better", a taste-gap prompt and a full prompt land on three distinct outcomes.
- [~] **3.4 Skill-level `effort` lowering, benched on ≤ 3 skills (D13).** <!-- blocked-by: intake-band-shift-needs-a-baseline --> <!-- deferred-resolution: carried-to=road-to-the-question-only-the-owner-can-answer-carried -->
      verify: a CLAIMS row stays `unbacked` until the bench lands.
- [~] **3.5 The contact ledger counts native picker calls (D9).** <!-- blocked-by: ledger-change-needs-hook-bundle-headroom --> <!-- deferred-resolution: carried-to=road-to-the-question-only-the-owner-can-answer-carried -->
      verify: a transcript with a picker `tool_use` records class `native`.

## Blockers

### blocker: interview-suffix-form-is-an-owner-decision

- **Status:** resolved — carried, still open, to `road-to-the-question-only-the-owner-can-answer-carried` with the steps it blocks (was: open — raised 2026-10-27 by inbox round `inbox-2026-10-be`.)
- **Class:** 3 — owner-reserved: product reach and a possible new settings key.
- **Owner:** user — `agents/owner-questions.md` OQ-22 and OQ-23.
- **Run:** `grep -n 'OQ-22\|OQ-23' agents/owner-questions.md`
- **Blocks:** 3.1, 3.2.
- **What to do:** answer OQ-22 (options a / b / c) and OQ-23 (options a / b / c) in `agents/owner-questions.md`.
- **Resolved when:** both rows sit under `## Answered`.
- **Recommendation:** OQ-22 (a) the personal hook, zero package change; OQ-23 (a) widen.
- **If you do nothing:** the suffix stays a manual tool; Phase 1 still routes it.

### blocker: intake-band-shift-needs-a-baseline

- **Status:** resolved — carried, still open, to `road-to-the-question-only-the-owner-can-answer-carried` with the steps it blocks (was: open — raised 2026-10-27.)
- **Class:** 1 — a measurement, no decision owed.
- **Owner:** the next run of this roadmap's carry.
- **Run:** `ls agents/evidence/analysis/ | grep owner-question-baseline`
- **Blocks:** 3.3, 3.4.
- **What to do:** freeze a before-baseline of band outcomes, then change the scorer or bench `effort`.
- **Resolved when:** a baseline file exists and the change is compared against it.
- **Recommendation:** do 3.3 first; 3.4 only after the step-cost work.
- **If you do nothing:** vague and taste-open prompts keep sharing one score.

### blocker: ledger-change-needs-hook-bundle-headroom

- **Status:** resolved — carried, still open, to `road-to-the-question-only-the-owner-can-answer-carried` with the steps it blocks (was: open — raised 2026-10-27.)
- **Class:** 1 — a size budget, no decision owed.
- **Owner:** the next run of this roadmap's carry.
- **Run:** `./scripts-run src/scripts/check_hook_bundle_freshness`
- **Blocks:** 3.5.
- **What to do:** edit `src/scripts/hooks/interruption_ledger_hook.ts`, rebuild with `./scripts-run src/scripts/rebuild_hook_bundle`, and land it only when the bundle-size test stays green.
- **Resolved when:** the change is bundled and the size gate is green.
- **Recommendation:** pair it with a byte-saving change in the same bundle.
- **If you do nothing:** native asks stay uncounted, which flatters the contact metric.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Broader fence markers | implementation | "rückfragen" also appears in prompts that do not ask to be consulted, so more decisions route to the user | the test carries a control prompt; markers are phrases, not single common words | Phase 1 — "Interview me" reaches the interview and is fenced |
| 2 | German stems over-match | implementation | a stem like "bau" matches nouns and lifts goal clarity on a vague prompt | stems are verb-shaped; the EN/DE pair test also pins one vague German prompt to low | Phase 2 — The intake reads German fairly and asks in one form |

## Acceptance Criteria

- [x] AC-1 — "interview me" and "stell mir Rückfragen" both route to the interview and fence as `user_required`.
- [x] AC-2 — German and English prompts of the same content land in the same band.
- [x] AC-3 — the interview command's question block has one recommendation line and no bold inline tag.
