# fix-this-now-checklist

## Purpose

This checklist captures the highest-priority corrections needed after PR #3.

Goal:
- keep the structural wins of PR #3
- restore strict execution quality
- prevent clean-but-weak skills
- prevent guidelines from replacing workflows
- prevent stale generated outputs
- ensure routing only targets strong skills

This is a focused stabilization checklist, not a full redesign.

---

## Current state summary

Compared to `main`, PR #3 is better in:

- overall structure
- rule vs skill separation
- guideline coverage
- source-of-truth editing workflow
- analysis routing
- reduction of micro-skills and duplicate skills

Compared to `main`, PR #3 is weaker or riskier in:

- linter strictness
- enforcement of concrete validation
- risk of skills becoming too dependent on guidelines
- risk of routing into weak but formally valid skills
- risk of drift between `.augment.uncompressed/` and generated outputs

---

## Priority order

### P0 — Must fix first
- Harden the linter again
- Re-establish executable-skill guarantees
- Add guideline-vs-skill boundary
- Add review/CI protection for stale generated outputs

### P1 — Fix next
- Strengthen analysis routing safety
- Add compression-preservation checks
- Refactor optimize commands so they cannot weaken skills or rules

### P2 — Follow-up
- Audit merged and trimmed skills for lost sharpness
- Add explicit preservation rules for future merges/refactors

---

# P0 — Harden the quality guardrails

## 1. Make `Procedure` required again for skills

### Problem

PR #3 relaxed the linter so `Procedure` is no longer a hard requirement.

### Why this is bad

A skill without a real procedure can be:
- formally clean
- structurally complete
- but operationally weak

That leads to:
- generic outputs
- shallow workflows
- more inference burden on the model

### What was better on `main`

`main` was less formally advanced, but the system pressure favored stronger workflow content because the structure was not yet optimized for “clean but thin” skills.

### Fix

Restore:

- `Procedure` = required section for every skill

### Acceptance criteria

Fail lint if:
- `Procedure` section is missing
- `Procedure` exists but is empty

---

## 2. Make `missing_validation` an error again

### Problem

PR #3 made the linter more flexible and downgraded missing validation.

### Why this is bad

Without strict validation:
- weak skills still pass review
- compressed skills can lose their strongest safety lines
- “looks good” can replace “works well”

### What was better before

Before the relaxation, the system pressure favored sharper skills with explicit checks.

### Fix

Restore:

- `missing_validation` = error

### Acceptance criteria

Every skill must contain at least one explicit validation block or validation step.

Good examples:
- exact checks
- expected outcomes
- concrete inspection criteria

Bad examples:
- "check if it works"
- "validate"
- "verify manually"

---

## 3. Require concrete validation, not symbolic validation

### Problem

A skill can contain the word “Validate” and still be useless.

### Why this is bad

This creates fake quality:
- formal structure present
- real safety missing

### Fix

Add a linter rule:

Validation must contain at least one of:
- explicit checks
- expected behavior
- concrete output criteria
- negative condition to avoid

### Acceptance criteria

These should fail:
- “Validate”
- “Check if it works”
- “Verify correctness”

These should pass:
- “Check route appears in route:list output”
- “Confirm no nested triple backticks remain”
- “Verify test fails before and passes after the change”

---

## 4. Re-add executable-skill guarantees

### Problem

PR #3 improved structure, but some skills can now be too clean and too abstract.

### Why this is bad

A skill must answer:
1. When do I use this?
2. What exactly do I do?
3. How do I know it worked?
4. What failure must I avoid?

If one of these is missing, the skill is incomplete.

### Fix

Add a reviewer/linter rule:

A skill is invalid if it lacks:
- trigger clarity
- executable procedure
- concrete validation
- anti-failure guidance

### Acceptance criteria

Each skill must have:
- `When to use`
- `Procedure`
- `Output format`
- `Gotchas`
- `Do NOT`

---

# P0 — Prevent guidelines from replacing skills

## 5. Add explicit guideline-vs-skill boundary

### Problem

PR #3 greatly improved and expanded the guideline system.

### Why this is good

This was a major improvement over `main`:
- broader knowledge coverage
- cleaner reference layer
- less repeated convention text inside skills

### New risk introduced

A skill can now become:
- “read the guideline”
- plus a weak checklist

That makes the guideline layer stronger, but the skill layer weaker.

### Fix

Add this to `guidelines.md` or a dedicated rule:

- Guidelines contain conventions and reference knowledge
- Skills contain executable workflows
- A skill may reference guidelines, but must never outsource its core workflow
- If removing guideline references makes the skill useless, the skill is too weak

### Acceptance criteria

A skill must still be useful if the guideline is not opened.

That means the skill itself must contain:
- core procedure
- core decision points
- core validation

---

## 6. Add reviewer check for guideline dependency

### Problem

The current system can accept skills that mostly point elsewhere.

### Fix

Add a reviewer/linter warning or fail mode:

Warn if:
- the skill mostly says “follow the guideline”
- procedure is too small to execute independently

Fail if:
- no operational workflow remains inside the skill

### Acceptance criteria

The reviewer must detect:
- pointer-only skills
- guideline-heavy but workflow-light skills

---

# P0 — Restore output consistency protections

## 7. Add a required pre-review sync checkpoint

### Problem

PR #3 improved editing workflow by removing immediate compress-after-edit.

### Why PR #3 is better than `main`

This is better for real editing:
- less interruption
- fewer pointless compress cycles
- safer while drafting

### What was better on `main`

`main` kept source and derived output aligned more continuously.

### New risk introduced

- `.augment/` can remain stale too long
- reviewers can inspect outdated generated output
- PRs can land with source-of-truth updated but generated artifacts stale

### Fix

Add an explicit rule/checkpoint:

Before review or PR:
- run `task sync-changed`
- regenerate derived outputs
- verify no stale generated files remain

### Acceptance criteria

A PR should fail consistency checks if:
- `.augment.uncompressed/` changed
- but derived files are not regenerated

---

## 8. Add CI consistency workflow

### Problem

Editing workflow is now safer, but consistency is less continuously enforced than on `main`.

### Fix

Require CI to run:
- sync check
- tool generation consistency check
- fail if generated artifacts differ

### Acceptance criteria

Add required CI checks for:
- `task sync-check`
- `task sync`
- `task generate-tools`
- no git diff after generation

---

# P1 — Strengthen routing and compression safety

## 9. Strengthen `analysis-skill-routing`

### Problem

PR #3 added `analysis-skill-routing`, which is a real improvement over `main`.

### Why it is better than `main`

`main` had no equivalent rule-level safeguard against overusing broad analysis.

### New risk introduced

A good router can still send work into weak specialist skills.

### Fix

Add to `analysis-skill-routing`:

- Only route to the narrower skill if that skill still has executable workflow and concrete validation
- If the specialist skill is too weak, route through the broader analysis path and mark the gap

### Acceptance criteria

Routing must consider not only scope match, but also target skill quality.

---

## 10. Add compression-preservation guardrails

### Problem

PR #3 introduced strong compression ideas, but the system still risks over-compressing skills.

### Why this matters

A compressed skill can remain structurally valid while losing:
- concrete checks
- examples
- anti-patterns
- decision power

### Fix

Add this rule to compression behavior:

Reject compression if it removes:
- concrete validation
- strongest example
- strongest anti-pattern
- essential decision criteria

### Acceptance criteria

Compression must preserve:
- trigger quality
- procedure quality
- validation quality
- anti-failure guidance

---

# P1 — Refactor optimize commands so they cannot weaken the system

## 11. Refactor `optimize-skills`

### Problem

`optimize-skills` still makes sense, but not in its current form.

### Risks
- works on `.augment/` instead of `.augment.uncompressed/`
- has its own quality logic
- could recommend merges/deletions that weaken preserved sharpness

### Fix

Keep only:
- duplicate detection
- merge candidate detection
- baseline / counts / overlap analysis

Remove or replace:
- independent quality judgments already handled by linter/reviewer
- anything that auto-weakens skills
- anything that works on generated output instead of source-of-truth

### Acceptance criteria

`optimize-skills` must:
- read `.augment.uncompressed/`
- respect linter findings
- propose only, never weaken automatically
- include preservation check before merge recommendations

---

## 12. Refactor `optimize-agents`

### Problem

`optimize-agents` still has value, but is dangerous if it can weaken rules or skill selection logic.

### Risks
- works on `.augment/`
- could push `always -> auto` too aggressively
- could conflict with new rule/router/linter design

### Fix

Keep only:
- baseline measurement
- overlap audit
- AGENTS.md review
- rule trigger / duplication checks

Remove or constrain:
- autonomous weakening suggestions
- anything that reduces rule safety without explicit proof

### Acceptance criteria

`optimize-agents` must:
- use `.augment.uncompressed/`
- never weaken rules blindly
- never suggest `always -> auto` without explicit safety reasoning
- defer quality judgment to linter/reviewer

---

# P2 — Prevent future regression after merges/refactors

## 13. Add merge-preservation checklist

### Problem

PR #3 improved structure by merging and deleting skills, but future merges could still remove the best parts.

### Fix

Whenever merging skills:
- list source skills
- preserve the best validation from each source
- preserve the strongest example from each source
- preserve the strongest anti-pattern from each source
- verify the merged skill is still narrow enough to execute

### Acceptance criteria

A merge is invalid if:
- validation got weaker
- examples were lost without replacement
- anti-pattern coverage got weaker
- the merged skill became an umbrella doc

---

## 14. Add a “minimum sharpness” rule for all skills

### Problem

PR #3 cleaned up the system, but that also makes it easier to hide weak skills under clean formatting.

### Fix

Add this rule:

Every skill must answer:
1. When should I use this?
2. What exactly do I do?
3. How do I verify it worked?
4. What common failure must I avoid?

If one answer is weak, the skill is not done.

### Acceptance criteria

Reviewer/linter must fail or warn clearly when:
- trigger is too generic
- workflow is too abstract
- validation is too vague
- anti-failure guidance is missing

---

# Immediate implementation checklist

## Do now

- [x] Make `Procedure` required again — `REQUIRED_SKILL_SECTIONS` in linter
- [x] Make `missing_validation` an error again — line 309 in linter
- [x] Require concrete validation, not symbolic validation — `vague_validation` check
- [x] Add explicit guideline-vs-skill boundary — `guidelines.md` "Boundary" section
- [x] Add reviewer check for pointer-only skills — linter `pointer_only_skill` heuristic
- [x] Add `task sync-changed` pre-review rule — `augment-source-of-truth.md`
- [x] Add CI consistency check — `consistency.yml`
- [x] Strengthen `analysis-skill-routing` — routing quality gate
- [x] Add compression-preservation check — `--compression-quality` in linter
- [x] Refactor `optimize-skills` — uses `.augment.uncompressed/`, preservation gate, defers quality to linter, suggest-only
- [x] Refactor `optimize-agents` — uses `.augment.uncompressed/`, safety gate for always→auto, preservation gate, suggest-only
- [x] Add merge-preservation checklist — `skill-quality.md` rule
- [x] Add minimum-sharpness rule — `skill-quality.md` rule
- [x] Fix `broad_scope` false positives — narrowed heuristic to description + "When to use" only

---

# Definition of done

This stabilization pass is complete when:

- rules remain stronger than `main`
- skills cannot pass without real workflow + real validation
- guidelines cannot hollow out skills
- routing only targets strong specialist skills
- generated artifacts cannot silently drift
- optimize commands can no longer weaken the system blindly

---

# Final principle

Do NOT undo the direction of PR #3.

Keep:
- the cleaner structure
- the better rule layer
- the broader guideline coverage
- the reduced skill bloat

But restore:
- strict execution-quality enforcement
- workflow independence of skills
- consistency checkpoints
- preservation checks during optimization and compression

The target state is:

- cleaner than `main`
- safer than `main`
- sharper than `main`
- and harder to accidentally weaken in the future
