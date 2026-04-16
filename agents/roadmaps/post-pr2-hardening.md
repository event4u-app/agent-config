# Post-PR#2 Hardening Roadmap

Source: External review of PR #2 against `main`.
Goal: Close the gap from 8.8 → 9.5+ by fixing the 4 identified weaknesses
and strengthening the areas with the largest remaining score gaps.

## Score Gaps (PR #2 vs target 9.5)

| Area | PR #2 | Gap | Phase |
|---|---|---|---|
| Commands/Tooling | 7.8 | 1.7 | Phase 6 |
| Guidelines Overuse Risk | 7.5 (risk) | — | Phase 1.1, 4.1 |
| Complexity/Onboarding | 7.0 | 2.5 | Phase 3 |
| Compression Quality | not checked | — | Phase 7 |
| Rule Compliance | ~7.0 (est.) | 2.5 | Phase 5 |

## Phase 1: Guardrail Enforcement

Ensure the new systems are used consistently — not just documented.

### 1.1 Skill-Guideline Boundary Enforcement

Core principle: **A skill must remain executable without opening a guideline.**

→ Detailed items in `road-to-10.md` Phase 1 + Phase 2 + Phase 4.

- [x] Linter: `guideline_dependent_skill` error + `pointer_only_skill` warning
- [x] Initial scan: 0 existing skills flagged
- [ ] Remaining items tracked in `road-to-10.md` (skill-writing, skill-reviewer, merge preservation, compression quality)

### 1.2 Consistency CI Hardening
- [x] `task sync-check-hashes` — CI check that source hash matches stored hash (fails if /compress not run)
- [x] Added to `.github/workflows/consistency.yml` as separate step
- [ ] Verify `task sync-check` catches ALL derived output drift (compressed files, symlinks, .windsurfrules, GEMINI.md)
- [ ] Add `task sync-check` as pre-push hook recommendation in AGENTS.md or contributing guide
- [ ] Ensure consistency workflow blocks merge on failure (not just warning)
- [ ] Stale hash cleanup: `--check-hashes` should also warn about hashes for deleted source files
- [ ] Add `--clean-hashes` subcommand for standalone stale hash removal (currently only in `--sync`)

### 1.3 Linter Coverage Expansion
- [ ] Add linter check for command size limits (>1000 words = warning)
- [ ] Add linter check for guideline size (>1500 words = info)
- [ ] Add linter check for rule `type` correctness (flag always-rules that look like auto candidates)
- [ ] Add linter check for command frontmatter (required fields, valid structure)
- [ ] Add linter check for skill `Procedure` section presence and minimum quality

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

### 3.4 Token Budget Monitoring
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

## Phase 5: Rule Compliance Hardening

Problem: Agents (colleagues' AI tools) silently ignore rules — especially auto-rules
with weak trigger descriptions. Rules are only effective if they reliably activate.

### 5.1 Audit rule trigger quality
- [ ] Review all auto-rule descriptions: would a model reliably match them to user intent?
- [ ] Test: for each auto-rule, write 3 sample prompts that SHOULD trigger it — does the description match?
- [ ] Fix weak descriptions (too vague, too short, missing keywords)
- [ ] Document trigger-testing methodology in skill-reviewer or rule-type-governance

### 5.2 Add rule-compliance smoke tests
- [ ] Script: `scripts/check_rule_triggers.py` — given a sample prompt, list which rules WOULD trigger
- [ ] Build a test matrix: sample prompts × expected rules → verify coverage
- [ ] Add to CI as optional (informational, not blocking)

### 5.3 Strengthen critical rules against being ignored
- [ ] Identify top 5 most-ignored rules (from experience/observation)
- [ ] For each: add redundant reinforcement points (AGENTS.md mention, skill cross-reference)
- [ ] For `always` rules: verify they are short enough to be reliably followed (< 60 lines ideal)
- [ ] For `auto` rules: verify description contains the exact keywords users would type

### 5.4 Multi-agent consistency
- [ ] Verify `.cursor/rules/`, `.clinerules/`, `.windsurfrules` contain the same constraints
- [ ] Check symlink integrity: all tool-specific rule files point to correct `.augment/` sources
- [ ] Add to `task generate-tools` verification: rule count matches across all tool directories
- [ ] Consider: should critical rules be duplicated into AGENTS.md as fallback for tools that ignore rule files?

### 5.5 Observability
- [ ] Add `/rule-compliance-audit` command: agent reviews own behavior against all active rules
- [ ] Track which rules were activated in a session (self-report at end of conversation)
- [ ] Identify rules that are never activated — candidates for rewording or removal

## Phase 6: Command Quality (Score: 7.8 → target 9.0)

Weakness: "Commands still not linter-aware" — biggest structural gap after CI.

### 6.1 Command Linting
- [ ] Add command validation to skill_linter.py: frontmatter, required sections, size
- [ ] Required command sections: title, at least one `## Step`, clear outcome
- [ ] Detect commands that contain implementation logic (should be in skills)
- [ ] Detect commands that duplicate skill content

### 6.2 Command Structure Audit
- [ ] Review all 47 commands for consistent structure
- [ ] Verify all commands follow orchestration pattern (delegate to skills, not implement)
- [ ] Flag commands without clear "when to use" / trigger description
- [ ] Standardize command frontmatter across all commands

### 6.3 Command-Skill Boundary
- [ ] For each command, verify it references skills for execution (not inline logic)
- [ ] Identify commands that could be merged (overlapping scope)
- [ ] Identify commands that should be split (doing too much)

## Phase 7: Compression Quality Verification (Score: not measured)

Weakness: "Compression quality not yet verified" — compressed files may lose meaning.

### 7.1 Compression Diff Audit
- [ ] Script: compare uncompressed vs compressed — flag files where sections were lost
- [ ] Check: all headings in source present in compressed version
- [ ] Check: all code blocks preserved exactly (byte-compare fenced blocks)
- [ ] Check: YAML frontmatter identical between source and compressed

### 7.2 Compression Quality Metrics
- [ ] Calculate word-count ratio per file (target: 20-50% reduction)
- [ ] Flag files with >60% reduction (likely lost content)
- [ ] Flag files with <10% reduction (compression not effective)
- [ ] Add to `task ci` as informational report

### 7.3 Automated Compression Validation
- [ ] Add to linter: compare section headings between source and compressed
- [ ] Add to linter: verify no inline code was modified during compression
- [ ] Add to CI: `task check-compression-quality` target

## Phase 8: Complexity Reduction (Score: 7.0 → target 8.5)

Weakness: "Meta-complexity has increased" — harder for new users to onboard.

### 8.1 Onboarding Path
- [ ] Create `agents/docs/onboarding.md` — "start here" guide for new team members
- [ ] Document: which rules matter most, which skills to learn first, how to run CI
- [ ] Add quick-start section to AGENTS.md (3-step setup)

### 8.2 Simplification Opportunities
- [ ] Identify rules that could be merged without losing enforcement
- [ ] Identify skills that overlap significantly (merge candidates)
- [ ] Review: are all roadmaps still needed or can some be archived?
- [ ] Consider: flatten guideline directory structure if only 2-3 categories

## Priority Order

1. **Phase 1.1** — Skill-guideline boundary is the highest risk (Guidelines Overuse: 7.5)
2. **Phase 6.1–6.2** — Command quality is the biggest score gap (7.8)
3. **Phase 5.1–5.3** — Rule compliance directly impacts all agent work quality
4. **Phase 7.1** — Compression quality is unmeasured (unknown risk)
5. **Phase 3.1** — Roadmap cleanup reduces cognitive overhead immediately
6. **Phase 1.3** — Linter expansion catches more issues automatically
7. **Phase 2** — Optimize commands ensure ongoing quality
8. **Phase 8** — Complexity reduction improves onboarding (7.0)
9. **Phase 3.2–3.4** — Cross-reference, portability, token monitoring
10. **Phase 4** — Ongoing boundary maintenance
11. **Phase 5.4–5.5** — Multi-agent consistency and observability
12. **Phase 7.2–7.3** — Compression metrics and automation
