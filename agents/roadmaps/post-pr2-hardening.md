# Post-PR#2 Hardening Roadmap

Source: External review of PR #2 against `main`.
Goal: Address identified risks and consolidate the gains from the restructuring.

## Phase 1: Guardrail Enforcement

Ensure the new systems are used consistently — not just documented.

### 1.1 Skill-Guideline Boundary Enforcement
- [ ] Add linter check: detect skills that delegate core workflow to guidelines ("see guideline X for details" without own procedure)
- [ ] Review existing skills for guideline dependency — flag any that become useless without guideline
- [ ] Add anti-pattern to skill-reviewer: "guideline-dependent skill"

### 1.2 Consistency CI Hardening
- [x] `task sync-check-hashes` — CI check that source hash matches stored hash (fails if /compress not run)
- [x] Added to `.github/workflows/consistency.yml` as separate step
- [ ] Verify `task sync-check` catches ALL derived output drift (compressed files, symlinks, .windsurfrules, GEMINI.md)
- [ ] Add `task sync-check` as pre-push hook recommendation in AGENTS.md or contributing guide
- [ ] Ensure consistency workflow blocks merge on failure (not just warning)

### 1.3 Linter Coverage Expansion
- [ ] Add linter check for command size limits (>1000 words = warning)
- [ ] Add linter check for guideline size (>1500 words = info)
- [ ] Add linter check for rule `type` correctness (flag always-rules that look like auto candidates)

## Phase 2: Optimize Commands Alignment

Adapt optimize commands to use all new rules and guardrails.

### 2.1 optimize-agents
- [ ] Verify it checks always-vs-auto per rule-type-governance
- [ ] Verify it checks AGENTS.md size per size-and-scope guideline
- [ ] Verify it checks copilot-instructions.md size per size-and-scope guideline
- [ ] Add check: flag rules >100 lines as "review for split"

### 2.2 optimize-skills
- [ ] Verify it references size-and-scope guideline for all size checks
- [ ] Add check: detect skills with high guideline dependency (many "see guideline" references, few own steps)
- [ ] Add check: detect skills with weak Output format sections

## Phase 3: Meta-Complexity Management

Keep the growing system maintainable.

### 3.1 Roadmap Hygiene
- [ ] Archive completed roadmaps: fix-this-now-checklist, skills-rules-restructuring, taxonomy-audit, compare-with-main
- [ ] Review remaining roadmaps for overlap and merge candidates
- [ ] Add "last reviewed" dates to active roadmaps

### 3.2 Cross-Reference Integrity
- [x] Script: `scripts/check_references.py` — scans all .md for broken paths, skill/rule name refs
- [x] Taskfile: `task check-refs` target added
- [x] CI workflow: added to `.github/workflows/consistency.yml`
- [x] CI pipeline: part of `task ci`
- [ ] Reduce false positives in check_references.py: skip example paths in commands, skip `.json`/non-`.md` refs
- [ ] Fix existing broken references found by initial scan (~89 items, many are example paths)
- [ ] Add `/fix-references` command for interactive broken ref resolution

### 3.3 Package Portability
- [x] Script: `scripts/check_portability.py` — scans for project-specific references in package files
- [x] Taskfile: `task check-portability` target
- [x] CI workflow: added to `.github/workflows/consistency.yml`
- [x] CI pipeline: part of `task ci`
- [ ] Fix 4 existing violations in `override-system.md` (references `event4u-app/agent-config`)
- [ ] Add `/fix-portability` command for interactive violation resolution
- [ ] Expand pattern list as new projects adopt the package

### 3.3 Token Budget Monitoring
- [ ] Count total always-loaded tokens (all always-rules + AGENTS.md overhead)
- [ ] Set target: always-loaded < X tokens
- [ ] Add to optimize-agents output: "Always-loaded token budget: {current}/{target}"

## Phase 4: Boundary Maintenance

Prevent the three identified drift patterns.

### 4.1 Guidelines ≠ Skills
- [ ] Document the boundary in size-and-scope guideline (already done — verify clarity)
- [ ] Add periodic audit step to skill-improvement-pipeline: "check guideline dependency"

### 4.2 Commands ≠ Rules/Skills
- [ ] Review commands for logic that should be in skills
- [ ] Verify commands only orchestrate, not implement

### 4.3 Rules stay small
- [ ] Run linter on ALL rules (not just --changed) — flag any >100 lines
- [ ] Create split plan for any that exceed limits

## Priority Order

1. **Phase 1.1** — Skill-guideline boundary is the highest risk from the review
2. **Phase 3.1** — Roadmap cleanup reduces cognitive overhead immediately
3. **Phase 1.3** — Linter expansion catches more issues automatically
4. **Phase 2** — Optimize commands ensure ongoing quality
5. **Phase 3.2–3.3** — Cross-reference and token monitoring
6. **Phase 4** — Ongoing maintenance checks
