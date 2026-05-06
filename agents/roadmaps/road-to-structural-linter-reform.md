---
status: ready
complexity: medium
---

# Road to Structural Linter Reform

**Status:** READY — opened 2026-05-06 after a 2-round AI Council
review (anthropic/claude-sonnet-4-5 + openai/gpt-4o) of the
size-budget calibration. Council convergence is inlined below; the
raw transcript is local-only and not linked from this roadmap by
contract.
**Trigger:** Option 2 of the council review (threshold-bump + light
structural gates) shipped in the same session; the council
independently flagged that **raw line / word counts are the wrong
axis** and recommended a structural-density linter as the durable
fix. Sonnet's verbatim warning: _"raising limits without structural
enforcement creates ratchet drift."_ This roadmap is the durable
follow-up to Option 2.
**Mode:** Medium roadmap. Phase 1 is design + dry-run only; nothing
ships before the design is reviewed.

## Purpose

Replace the current line-/word-count heuristics in
`scripts/skill_linter.py` with a **structural-density model** that
distinguishes legitimate complexity (orchestrators, reference
catalogues, Iron-Law verbatim blocks) from genuine bloat (inlined
logic, missing delegation, unscoped prose). The deliverable is a
linter that fires fewer false positives **without weakening the
ratchet** that prevents files growing unchecked.

## Why a roadmap, not an immediate edit

Council convergence:

- Sonnet: "the linter needs a routing/modularity check, not a size
  check. A 500-line skill with 10 independent procedures should
  split. A 500-line skill with one 10-step procedure should not."
- GPT-4o: "introduce structural checks, such as decision branches or
  explicit delegation, to better qualify when a command is too long."

Both agree: the right primitives are density, delegation, and
multi-workflow detection — not raw size. That is several hundred
lines of linter code, a frontmatter contract, and a calibration
sweep over 289 files. Not a one-commit drive-by.

## Phases

### Phase 1 — Design + Dry-Run (≤ 1 day)

Produce a single design document that picks one model, with
calibration evidence on the current corpus.

- [ ] **1.1 Density score.** Define a density score per artifact
      type. Inputs: fenced-content ratio, sub-section count,
      delegation/route count, table count, code-block count, prose
      paragraph count. Output: a 0–1 density value where higher = more
      structured. Sweep all 289 artifacts, record the score, plot the
      distribution.
- [ ] **1.2 Multi-workflow detector for skills.** Detect when a skill
      ships ≥ 2 independently invocable procedures (e.g. `## When to
      use` paired with multiple `## Procedure` blocks or numbered
      sub-procedures with their own preconditions). Validate against
      `quality-tools` (single procedure, should NOT fire) vs a
      hypothetical merged skill (should fire).
- [ ] **1.3 Delegation detector for commands.** Detect when a command
      delegates to sub-commands vs inlines the work. Inputs: presence
      of `cluster:` frontmatter + `routes_to:` keys + sub-command
      links + per-section step delegation. Validate against
      `optimize/augmentignore.md` (1679 words, delegating
      orchestrator) vs a hypothetical inline 1679-word command.
- [ ] **1.4 Iron-Law block recogniser for rules.** Detect verbatim
      Iron-Law blocks (the `\`\`\`...\`\`\`` ALL-CAPS imperative blocks)
      and worked-example blocks. Validate against `commit-policy`,
      `ask-when-uncertain`, `direct-answers` (multiple Iron-Law
      blocks, should be exempt) vs a prose-only rule (should not).

### Phase 2 — Frontmatter contract (≤ 0.5 day)

- [ ] **2.1 Decide: optional `iron_law: true` frontmatter** for rules
      that ship a verbatim Iron-Law block, OR auto-detection only.
      Weighing: explicit tag is reviewable + greppable; auto-detection
      removes a maintenance burden. Sonnet's preference: implicit
      detection. GPT-4o's preference: explicit tag. Decide and
      document.
- [ ] **2.2 Decide: optional `density_exempt: true` escape hatch** for
      reference-catalogue skills that legitimately exceed the density
      threshold (e.g. `quality-tools`). Must be justified in the
      frontmatter comment.
- [ ] **2.3 Update `validate_frontmatter.py` schema.**

### Phase 3 — Linter rewrite (≤ 1.5 days)

- [ ] **3.1 Replace skill size check** with density score + multi-
      workflow detector. Warn on (large AND low density) OR (multi-
      workflow without `cluster:` split).
- [ ] **3.2 Replace command size check** with delegation detector.
      Warn on (large AND no delegation signal AND not in a cluster).
- [ ] **3.3 Replace rule size check** with Iron-Law block recogniser
      + prose-density gate. Warn on (long AND prose-dominant AND no
      Iron-Law block AND no worked-example block).
- [ ] **3.4 Drop the temporary 30 % fenced-content gate** and the
      `> 400` skill threshold from Option 2 — superseded by the new
      structural model. Keep the Option 2 thresholds active until
      Phase 3 lands so the corpus stays observable in the meantime.

### Phase 4 — Calibration + rollout (≤ 0.5 day)

- [ ] **4.1 Re-run lint on all 289 artifacts.** Record before/after
      warning counts per artifact type. Target: ≤ 5 % of files in any
      warning band, with each remaining warning citing a concrete
      structural defect (not size).
- [ ] **4.2 Update `docs/guidelines/agent-infra/size-and-scope.md`**
      to describe the structural model. Remove the Option 2 transition
      notes once Phase 3 lands.
- [ ] **4.3 Document the model** in
      `docs/contracts/linter-structural-model.md` with the calibration
      curve, false-positive analysis, and the override contract.

## Out of scope

- Hard error thresholds beyond the existing 200-line rule cap. Scope
  stays warnings-only; CI does not block on warnings, intentionally.
- Reformatting any existing artifact to fit the new model — Option 2
  already adjusted thresholds; structural splits are caller-driven.
- Cross-artifact dependencies (a skill referencing 4 other skills is
  not a defect; that's `routes_to` doing its job).

## Success criteria

- Council-convergent failure mode "ratchet drift" is closed: the new
  linter cannot rubber-stamp a 2400-word command with a fake
  delegation marker.
- The 28 % rule-warning band reported in the 2026-05-06 calibration
  drops to ≤ 10 % without raising any threshold.
- `quality-tools` (411 lines, single workflow, dense reference) no
  longer warns. A hypothetical 411-line skill with 3 independent
  procedures DOES warn.

## References

- `scripts/skill_linter.py` (Option 2 implementation, council review
  comments inline)
- `docs/guidelines/agent-infra/size-and-scope.md` (Option 2 thresholds
  documented)
