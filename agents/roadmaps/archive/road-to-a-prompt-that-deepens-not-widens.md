---
complexity: lightweight
status: ready
tree_pin: ac6c60802a
execution:
  mode: phase-checkpoints
relates:
  - slug: road-to-the-question-only-the-owner-can-answer
    relation: disjoint
    note: That one owns asking the user; the depth pass here asks nothing and only a SCOPE item may halt.
estate_offset_exempt: >-
  Owner search before writing: `grep -rlF -e prompt-optimizer -e Lyra
  -e verification-mechanics -e refine-prompt -- agents/roadmaps/*.md agents/roadmaps/later
  agents/roadmaps/stubs` over the whole roadmap tree returned no hit; the nearest
  (`later/road-to-a-step-that-costs-what-it-changes-carried`) owns per-step ceremony, not
  prompt depth or the evidence table. Created active because the invocation asked for
  `/roadmap:process-full` on it (directive 2026-10-24 § 3 exception).
---
# Road to a prompt that deepens, not widens

> **Source:** `agents/tmp.old/inbox-2026-10-be/` topic `t02` — a transcript plus a supplied
> three-loop plan about a four-question "deeper, not bigger" prompt rewrite. Claims C1–C14
> re-verified at `ac6c60802a`: all still true; C11 now names seven judges, C14 fourteen
> `user_prompt_submit` concerns.

## Goal

The per-task evidence table exists once, names no single stack's tools, and has rows for
work that is not code; the prompt optimizer asks for methods and instruments instead of a
bare role. The measured parts of the depth idea (corpus, depth block, personas, oracle at
completion) are parked behind their measurement, not built on belief.

## Point ledger (inbox round)

- **Owner demand (transcript turn 1):** analyse and improve AC from the video → adopted as
  this roadmap.
- **Supplied plan Phase 1 (1.1–1.3):** steps 1.1–1.3 here. **1.4 / OQ-A (Lyra persona):**
  owner-decision (OQ-27, step 2.1). **OQ-B, OQ-D:** fold into the parked depth block.
  **OQ-C (maintainer fence):** same subject as OQ-26 of the sibling roadmap.
- **Supplied plan Phases 0, 2–5:** `[~]` here behind the bench. Phase 2's settings-free
  shape is kept; a `prompt_optimization.depth` key stays killed (ADR-293 owner line).

## Phase 1 — Measurement-free fixes

- [x] **1.1 One evidence table, host-neutral.** `verification-mechanics.md` becomes the
      single authority with stack-neutral wording; `verify-completion-evidence` cites it
      instead of carrying a second, drifted copy.
      verify: `grep -c PHPStan src/agent-src/contexts/execution/verification-mechanics.md` → 0 (positive control: 5 at `ac6c60802a`).
- [x] **1.2 Rows for work that is not code.** Documentation, analysis with numbers,
      research, rendered artifacts and media each name their required evidence and an
      oracle class (tool / data / external artifact / other model / self).
      verify: `grep -c 'No verification needed' src/agent-src/contexts/execution/verification-mechanics.md` → 0.
- [x] **1.3 Methods, not roles, in the optimizer.** "Assign role" becomes "name the
      methods and instruments the task needs; a role label only alongside them", and a
      bare role becomes the fourth de-inflation pattern (own analysis: a role names
      vocabulary, not a method — the in-tree example is the performance persona, whose
      workflow reasons about a diff and never profiles).
      verify: `grep -c 'Assign role' src/skills/prompt-optimizer/SKILL.md` → 0.

## Phase 2 — Parked: owner decision and measured depth

- [~] **2.1 The optimizer's Lyra role-play welcome (supplied 1.4).** <!-- blocked-by: lyra-persona-is-a-taste-decision | asked: no — queued as OQ-27 in agents/owner-questions.md per the 2026-10-24 directive --> <!-- deferred-resolution: carried-to=road-to-a-prompt-that-deepens-not-widens-carried -->
      verify: OQ-27 answered and applied in both files.
- [~] **2.2 Depth corpus with script oracles and pre-registered arms (supplied Phase 0).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus --> <!-- deferred-resolution: carried-to=road-to-a-prompt-that-deepens-not-widens-carried -->
      verify: a lint fails a corpus prompt without an oracle command.
- [~] **2.3 Opt-in `depth:` block with witnesses and the deeper-not-bigger invariant (supplied Phase 2).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus --> <!-- deferred-resolution: carried-to=road-to-a-prompt-that-deepens-not-widens-carried -->
      verify: an invariant test with a positive control that adds a deliverable.
- [~] **2.4 Instruments and an oracle line on the seven review personas (supplied Phase 3).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus --> <!-- deferred-resolution: carried-to=road-to-a-prompt-that-deepens-not-widens-carried -->
      verify: a warn-only lint names personas without a runnable instrument.
- [~] **2.5 Run the arms; the intake oracle runs before the judges (supplied Phases 4–5).** <!-- blocked-by: depth-block-waits-on-a-scripted-corpus --> <!-- deferred-resolution: carried-to=road-to-a-prompt-that-deepens-not-widens-carried -->
      verify: the bench report carries every pre-registered metric.

## Blockers

### blocker: lyra-persona-is-a-taste-decision

- **Status:** resolved — carried, still open, to `road-to-a-prompt-that-deepens-not-widens-carried` with the steps it blocks (was: open — raised 2026-10-27 by inbox round `inbox-2026-10-be`.)
- **Class:** 3 — owner-reserved taste.
- **Owner:** user — `agents/owner-questions.md` OQ-27.
- **Run:** `grep -n 'OQ-27' agents/owner-questions.md`
- **Blocks:** 2.1.
- **What to do:** answer OQ-27 (options a / b / c) in `agents/owner-questions.md`.
- **Resolved when:** OQ-27 sits under `## Answered`.
- **Recommendation:** keep the name, drop the role-play welcome.
- **If you do nothing:** the welcome stays; nothing else depends on it.

### blocker: depth-block-waits-on-a-scripted-corpus

- **Status:** resolved — carried, still open, to `road-to-a-prompt-that-deepens-not-widens-carried` with the steps it blocks (was: open — raised 2026-10-27.)
- **Class:** 1 — a measurement, no decision owed.
- **Owner:** the next run of this roadmap's carry.
- **Run:** `ls tests/eval/depth-corpus.yaml`
- **Blocks:** 2.2–2.5.
- **What to do:** write `tests/eval/depth-corpus.yaml` — the twenty-prompt corpus whose oracles are scripts, pre-register arms and the flip threshold, then build and bench the block.
- **Resolved when:** the corpus file exists and its lint passes.
- **Recommendation:** start with the ten non-dev prompts; they have no oracle today.
- **If you do nothing:** intake keeps refining for clarity only; Phase 1 still ships.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Documentation stops being exempt | implementation | a doc-only change now owes link and embedded-command checks, which adds work to every doc edit | the row names checks the repo already runs (reference and claims checks) | Phase 1 — Measurement-free fixes |
| 2 | A fourth de-inflation pattern widens stripping | implementation | the archived de-inflation work capped stripping at three named patterns so it cannot discard intent | the fourth pattern is named with its cost, as the three are, and strips only a role with no method | Phase 1 — Measurement-free fixes |

## Acceptance Criteria

- [x] AC-1 — one per-task evidence table exists, stack-neutral, with rows for non-code work.
- [x] AC-2 — the optimizer no longer prescribes a bare role.
