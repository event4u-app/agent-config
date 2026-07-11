---
complexity: lightweight
---

# Road to opt subagent harvest — the post-flip second look at orchestration references

> **Un-parked 2026-07-12:** the `later/` resume trigger fired — the
> maintainer explicitly and exclusively requested this roadmap's
> execution (`/roadmap:process-full`). The remaining five `road-to-opt-*`
> roadmaps stay parked.

> Part of the `road-to-opt-*` cluster (2026-07-11 sweep). ADR-117 flipped
> `subagents.auto` to `on`; per the maintainer's standing directive, every
> rejection made under the "subagents off" assumption was re-examined at
> source level against four external orchestration references. Result: one
> genuine REJECT-FLIPPED (the topology form-gate), four cheap ADOPTs, three
> ADAPTs — and a long confirmed REJECT-STILL list that stays closed.

## Goal

Land the eight verified borrow items on the shipped subagent surface
(ADR-109 contract + `subagent-orchestration` + `delegation-policy`)
without importing any engine, daemon, auto-write hook, or ungoverned
agent-definition corpus.

## Prerequisites

- Verified 2026-07-11: `orchestration-telemetry.md` already carries
  per-subagent cost attribution + `verdict_changed_outcome` (lines 22/47)
  — that previously-proposed item is DONE, not scheduled here.

## Provenance

Sources referenced anonymously per `source-confidentiality`; real links
retained encrypted:

- Source A (agent-runtime reference): `ENC1:IlxheJKbFP1wWeKaZsaiu1kCCwia4yVbVfcKn6NRSRNtXK4qYawGrHPh4UXTKLBASixoCME5nWssoZEQmR1llGnzB6UbltFrnMnVn4rdNZj7j/gwn5mGv7JOio5yEQs=`
- Source B (agent-collection reference): `ENC1:0VGF0oQGy1++2LZ7J08eq/9/u/4CHfXgmsKIKkpiyYxtsdKB3sjHIcD8pqFzRWyw3Mc3Q/THxUjU+YEWQUpfGBlGssQPglkM98w62uaxZmt08UIe1BWr5YFKHPmk62I=`
- Source C (agency-toolkit reference): `ENC1:pMcCJPiF4aJk2EXmSEXNhWnyOwffE7bD6egqIdQS8qH56ex8qkyT8oS+6o6+D1XQp6G6fQX3MBYGWY5hqS/G3AW7doi3nW/NK1f1fGZzRAx8aOhjoL/MPuB1lCT4iZDnq3rdfK0OF4wK03eJvA==`
- Source D (agent-catalog reference): `ENC1:MksmcIO40Qxua7Fuzw4iXID96m1+jteECu4f9TuUby2lWE3osfaoHNhyyyU6fdU0Fj6ZXh1tAHAjPDC+jV3hG+xms0Q8Bg5upQd5z73kk/Vos4bL4r2mfz65txi8wsGPHcS0LKveFe6kGnkfuIH5TQ==`

## Phase 1 — cheap hardening ADOPTs (all S)

- [x] **Prompt-defense preamble** (Source B): a standardized
      injection-defense block (role-override refusal, secret
      non-disclosure, homoglyph/unicode suspicion, untrusted-content
      handling) injected as a template partial into every projected
      subagent body. No schema change; composes with
      `untrusted-input-defense`. Every auto-dispatched subagent is an
      untrusted-content ingestion point — this hardens the fleet
      uniformly.
      <!-- done 2026-07-12: src/subagents/_prompt-defense.md partial
      (own wording, composed with untrusted-input-defense: role-takeover,
      secrets, hidden-unicode, authorization-transitivity, tool-grant);
      generate_claude_subagents injects it at the top of every projected
      body, skips _-prefixed partials, never double-injects (marker
      check). 2 new tests in generate_claude_subagents.test.ts (6/6). -->
- [x] **Witness-check on user-facing claims** (anti-lesson from Source A,
      which ships one unbacked benchmark claim in 12 files): a CI check
      that every quantified claim in README/CAPABILITIES-class surfaces
      either cites a proof artifact under `internal/bench/reports/` or
      carries an explicit unverified marker. Extends the existing claims
      discipline; failing claim = failing build.
      <!-- done 2026-07-12: witness sweep added to check_claims.ts
      (already CI-wired via task check-claims): quantified figures
      (%, x-multiplier) on README.md + CAPABILITIES.yaml lines must carry
      a claim marker or an 'unverified' annotation; fenced blocks skipped;
      docs/proof.md + comparison.yaml stay structurally witnessed by their
      own linters. Both surfaces currently clean → gate ships green and
      guards the future. New fixture test: unmarkered 65% fails exit 2,
      markered/unverified/fenced passes (check_claims.test.ts 6/6). -->
- [x] **Shingle-overlap originality linter** (Source C): entity-neutralized
      8-word shingle comparison across personas/skills/subagent bodies to
      catch re-skin near-duplicates mechanically. Slots beside
      `persona-governance` / `skill-quality`; report-only first run, then
      threshold-gated.
      <!-- done 2026-07-12: src/scripts/lint_originality_shingles.ts —
      entity-masked (~50 stack/product names → §entity§) 8-word shingles,
      Jaccard %, across 271 docs (skills+personas+subagents); report-only
      default + --threshold arming + inline allowlist (<20 policy).
      Positioned as SIBLING of the existing lint_skill_originality
      (token-Jaccard, skills-only) — the entity mask catches the
      swap-the-framework re-skin that plain Jaccard scores low.
      Calibration: top pair 27.6% (flux↔livewire sibling carve-outs), no
      re-skin epidemic; task lint-originality-shingles wired; 2 tests. -->
- [x] **Hook resilience pattern** (Source A): for any dispatch-degrade
      hook wiring (host without `subagent_spawn`), adopt the exit-0 shim +
      local-binary-then-npx fallback shape so a broken hook can never
      block the agent loop. Document in the hooks contract; apply to
      existing hooks where the pattern is missing.
      <!-- done 2026-07-12, with one deliberate adaptation: the fallback is
      local-binary → PATH → SILENT exit 0, NOT npx (an npx fallback would
      network-install on every hook fire — wrong cost shape for per-event
      hooks). Gap was real: Cursor/Windsurf/Gemini commands ran bare
      ./agent-config (error-spam on uninstalled repos) and the Claude
      matrix had binary fallback but no missing-binary guard. All four
      factories shimmed; dispatcher exit codes still PROPAGATE so
      fail_closed concerns (block-no-verify) keep their deny; plugin
      hooks.json regenerated (byte-parity), install bundle rebuilt;
      contract § Hook-resilience shim documents the shape with the Augment
      trampoline as reference. 12/12 hook tests green. -->

**Exit criteria:** preamble present in every projected subagent body
(assert via lint); claims check + originality linter wired and green;
hook shim pattern documented and applied.

## Phase 2 — the flipped rejection: topology form-gate (S)

Previously moot while dispatch defaulted to `ask`; with auto-dispatch
live, mode selection happens without a human in the loop and deserves a
deterministic gate ahead of it.

- [x] Add a static decision table (task shape → orchestration form) that
      runs BEFORE the 7-mode selection in `subagent-orchestration`:
      independent slices → parallel; ordered → steps; risk/correctness →
      +judge; single-slice/below floor → no dispatch. Static table only —
      no learned routing, no self-modifying selector (that stays
      REJECT-STILL).
      <!-- done 2026-07-12: "## Form gate — deterministic, BEFORE mode
      selection" section in subagent-orchestration (4-row static table
      bound to classifyTask's structural signals; ambiguous → none, never
      speculative spawn). -->
- [x] Record the chosen form in the existing orchestration telemetry line
      so the form-gate's value is measurable against the ADR-117
      prove-or-drop window.
      <!-- done 2026-07-12: additive `dispatch_mode` enum field
      (7 mode ids + none, null = pre-extension) in the telemetry lib,
      CLI --dispatch-mode flag, shape + field-table row in
      orchestration-telemetry.md — same additive pattern as
      verdict_changed_outcome. Lib tests 11/11; dry-run line verified
      carrying the field. -->

**Exit criteria:** form-gate documented in the skill + exercised by the
existing orchestration corpus fixtures; telemetry field present.

## Phase 3 — ADAPTs (M)

- [x] **Auto-surface knowledge at dispatch** (Source A, half-flip): at
      dispatch time, auto-ATTACH relevant knowledge cards/memory hits to
      the subagent prompt (read-only retrieval via `memory_lookup`).
      The write half stays rejected: no auto-persistence of subagent
      output into memory — human-commit floor (ADR-098) unchanged.
      <!-- done 2026-07-12: worker-prompt contract rule (e) in
      subagent-orchestration — auto-surface top memory/knowledge hits as
      LEADS (hypothesis discipline per source-discovery), write half
      explicitly forbidden (ADR-098 floor restated at the spawn point). -->
- [x] **Live-app judge mode** (Source B, re-granulated from a rejected
      framing): an 8th orchestration mode for UI-heavy tasks — the
      implementer ships and starts the dev server; the judge drives the
      RUNNING app via Playwright against a rubric, instead of reading the
      diff. Gate adoption on the existing `verdict_changed_outcome`
      efficacy field showing the mode changes outcomes; strip all
      self-play/"GAN" framing.
      <!-- done 2026-07-12: mode 8 `do-with-live-app-judge` in
      subagent-orchestration (rubric written BEFORE dispatch; judge never
      reads the diff; experimental until verdict_changed_outcome shows it
      flips real verdicts — cost-without-value removal clause inline).
      Along the way the form-gate/telemetry mode ids were corrected to the
      skill's REAL mode names (judge-with-debate + do-in-worktrees — the
      draft table had invented do-with-fresh-eyes); enum, telemetry doc,
      description, and delegation-policy cross-refs updated. No GAN
      framing anywhere. -->
- [x] **Cross-host projection table extension** (Source C): extend the
      ADR-109 §4 degradation table toward the real ecosystems (Codex,
      Gemini CLI, opencode) using a declarative per-target contract +
      CI drift check. Exotic targets fail `domain-adoption-policy` Gate 1
      and are not added.
      <!-- done 2026-07-12 — GATE CHECKED, NOT ADDED: domain-adoption-policy
      Gate 1 requires citeable demand (≥2 consumer projects on the target
      host, a named user direction with target, or an incident pull).
      Verified: the codex surface exists only as an INTERNAL bench adapter
      (discipline replication), gemini exists as a council/key surface —
      neither is a consumer-project demand signal for subagent-context
      projection, and no ask names opencode at all. Per the step's own
      gate clause the targets are NOT added; re-open when a real consumer
      project on one of those hosts asks for the subagent surface. The
      existing §4 table (Claude native + cursor/windsurf passive contexts)
      stands unchanged. -->

**Exit criteria:** each ADAPT lands behind its named gate (read-only
retrieval, efficacy telemetry, Gate-1 demand evidence respectively);
none introduces a runtime service.

## Confirmed REJECT-STILL (stays closed — recorded so it is not relitigated without new evidence)

- Source D's agent corpus wholesale: ungoverned near-uniform broad tool
  grants, no lifecycle/trust fields, scrape/aggregation signals — our
  ADR-109 schema is strictly richer. Only permissible use: skim its
  category taxonomy as a coverage brainstorm, no imports.
- Source A: self-evolving router / autonomous capability-evolution loop
  (self-modifying routing), unconditional auto-memory-write hooks,
  in-process swarm/hive-mind runtime.
- Source B: daemon control plane (alpha, non-GA; Claude Code IS our
  dispatch runtime), opt-out auto-persistence defaults, GAN/self-play
  framing.
- Source C: prose orchestrator + scenario rosters (our typed-status
  contract is stricter).
- Follow-up flag (uninvestigated, small): Source B's newer `orch-*`
  orchestrator skill family — a targeted read only if orchestration-mode
  borrowing (Phase 3) proceeds.

## Acceptance criteria

- Zero new runtime surfaces: no daemon, no service, no auto-write, no
  learned routing.
- Every adopted mechanism has a deterministic enforcement hook (lint /
  CI check / telemetry field), not prose-only guidance.
- The ADR-109 subagent contract is extended, never bypassed; schema
  changes (if any) go through the contract doc with validation.