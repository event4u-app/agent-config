
# Road to 1.16.0 Follow-ups

**Status:** DRAFT v1.1 (2026-05-03) — Round-1 council close-out folded in (Anthropic A1–A7 + F13-gap, OpenAI verification-tightening). Phase 0 split into 0a (immediate) + 0b (gated on structural-opt 0.4) per Option A. F8 (golden tests) promoted to Phase 0b. F13 reassigned (was a numbering gap; now covers golden-test failure-mode replay).
**Started:** 2026-05-03
**Trigger:** External review feedback after release 1.16.0. Reviewer 1 (consolidation-quality lens): score 9.5/10 — surface still large, README dense, context-layer young. Reviewer 2 (commit-level audit): score A−, with a P0/P1/P2 fix stack: README on `main` shows pre-1.15.0 state; budget headroom ~141 chars after `no-cheap-questions`; AI Council Phase 3–4 grew without external-user signal.
**Mode:** Sequential by phase. Phase 0a is the reviewer's P0/P2 stack — independent, ≤30 min total. Phase 0b is the budget-headroom + golden-test work, **strictly gated** on `road-to-structural-optimization` v3.1 Phase 0.4 (Option A). Phase 1 depends on the same gate. Phase 2 is opportunistic polish.
**Sources:**
- Reviewer 1 — release-quality bewertung 1.16.0 (positive: catalog package-safe, autonomous-execution split, agent-authority router; gaps: surface size, README density, context-layer rollout pace).
- Reviewer 2 — commit-level analysis with `raw.githubusercontent.com` verification: README drift on `main`, top-5 cap headroom 141 chars, council overgrowth, archive-verification gap.
- Sammelliste F1–F14 (conversation 2026-05-03), captured in observe-only mode. F13 was a numbering gap in the original list; v1.1 reassigns F13 to the golden-test failure-mode replay item (previously unnumbered strategy note).
- Council Round 1 (2026-05-03T08-06-27Z): Anthropic claude-sonnet-4-5 + OpenAI gpt-4o. Verdict: LOCK_AFTER_REVISIONS. v1.1 folds in all blocking findings.

## Purpose

Close the visible-quality regression Reviewer 2 surfaced (Phase 0), extend the `load_context:` pattern to remaining safety-floor rules under existing contracts (Phase 1), and apply low-risk polish (Phase 2). This roadmap **does not** introduce new architecture; every item maps to an existing contract or one already locked in `road-to-structural-optimization` v3.1.

**Out of scope:**
- New skills, rules, commands (consolidation, not feature work).
- Council Phase-5+ features (F11 mitigation = labeling, not redesign).
- Marketing / "holy-shit demos" (F7 strategy note, not a roadmap item).
- Onboarding redesign beyond a single README anchor (F1 scoped to anchor + path).

## Scope (locked once v1.1 ships)

| Phase | Theme | Source items | Effort | Gate |
|---|---|---|---|---|
| **0a** | Immediate fixes (P0/P2, independent) | F9, F11, F14 | ≤30 min | None — launchable now |
| **0b** | Budget-headroom + golden-test replay (P1, gated) | F10, F13 | ~0.5 d after gate | `road-to-structural-optimization` v3.1 Phase 0.4 must be locked (worked-example contract green) |
| **1** | `load_context:` rollout + archive audit | F2, F12 | ~2 d | Same gate as 0b — verify per 0b.0 before launch |
| **2** | Polish & onboarding | F1, F3, F4 | ~0.5 d | None — opportunistic |

**Option A gating note (R8 mitigation):** Phase 0b and Phase 1 share the same gate because they both touch the same budget surface. Sequencing them under one gate eliminates the hidden coupling Anthropic R1 flagged as the single biggest under-weighted risk in v1. F8 (golden-test failure-mode replay, renumbered F13 in v1.1) is promoted from Phase 2 to Phase 0b so trim-correctness can be verified before commit.

## Phase 0a — Immediate fixes (independent, ≤30 min)

Three items, no shared state. Each can land or revert independently. Phase 0a is **not** gated on anything and is sequenced first for visible-quality recovery.

### 0a.1 README sync on `main` (F9 — P0) — RESOLVED (no-op)

**Status (2026-05-03):** All four reviewer-supplied SHAs are already on `main`; `git diff 1.16.0..main -- README.md` is empty. The reviewer's snapshot was outdated. No cherry-pick needed.

- [x] **0a.1.1** ~~Verify drift exists~~ — `git log --oneline main..1.16.0 -- README.md` returned empty; `git log --oneline 1.16.0..main -- README.md` also empty. <!-- verified: 2026-05-03 · main = 1.16.0 for README.md -->
- [x] **0a.1.2** ~~Verify reviewer SHAs reachable on 1.16.0~~ — all four reachable on tag AND already on main: 1053d56, d26bf68, 2fa8022, c282ae3. <!-- verified: 2026-05-03 · git merge-base --is-ancestor each → ON main -->
- [-] **0a.1.3** SKIPPED — no cherry-pick needed (drift = 0).
- [-] **0a.1.4** SKIPPED — counts already correct on main.
- [-] **0a.1.5** SKIPPED — no PR needed.
- [x] **0a.1.6** External verification post-fact: `curl -fsSL https://raw.githubusercontent.com/event4u-app/agent-config/refs/heads/main/README.md` shows old tagline ABSENT and `129 Skills · 57 Rules · 69 Commands · 47 Guidelines` PRESENT. <!-- verified: 2026-05-03 · live raw.githubusercontent.com fetch -->

**Note:** the original roadmap referenced `event4u/agent-config`; correct org slug is `event4u-app/agent-config`. `0a.1.6` curl URL fixed accordingly.

### 0a.2 AI Council experimental labeling (F11 — P2)

- [x] **0a.2.1** Banner block added to:
  - `.agent-src.uncompressed/skills/ai-council/SKILL.md` (after frontmatter, before `# ai-council`).
  - `.agent-src/skills/ai-council/SKILL.md` (compressed mirror — manual sync since `compress.py` does not auto-rewrite).
  - `docs/customization.md` (immediately before the "Council API tokens are installed via…" paragraph at line ~70).
- [x] **0a.2.2** `task sync` + `task generate-tools` ran clean. Verified:
  - `.agent-src/skills/ai-council/SKILL.md` carries the banner.
  - `.claude/skills/ai-council/SKILL.md` (symlink) inherits it.
  - `.cursor/` and `.clinerules/` only host rules; no AI Council rule exists, so no projection there is required.
- [ ] **0a.2.3** Commit pending — bundled with the 0a.1 / 0a.3 docs commits at end of Phase 0a.

### 0a.3 Release-tag-to-main workflow drift — investigation only (F14, descoped per A6)

Council A6 finding: original 0.4 mixed investigation with auto-fix and was over-scoped for "≤1 h immediate." v1.1 descopes to **investigation + documentation only**; CI-gate work moves to a follow-up roadmap if findings warrant it.

- [x] **0a.3.1** Hypothesis verified: `git merge-base --is-ancestor 08daac9 main` → **ON_MAIN**. Tag `1.16.0` and `origin/main` both point at the same commit `08daac9` (the PR-#35 release-merge commit). `git log main..1.16.0` and `git log 1.16.0..main` are both empty. No drift exists on the live repo. <!-- verified: 2026-05-03 · main HEAD == tag 1.16.0 == 08daac9 -->
- [-] **0a.3.2** SKIPPED — `DRIFTED` path did not trigger.
- [-] **0a.3.3** SKIPPED — no CI/workflow fix warranted; no follow-up roadmap needed.

**Investigation note:** The reviewer-2 finding (F14) most likely captured a transient state during the release-PR window — at that moment `main` had not yet absorbed the `release/1.16.0` branch and the tag was created on the release branch. Once PR #35 merged into `main`, the tag and `main` re-aligned. No structural process bug; no recurrence prevention required at this layer. If a future release exhibits actual durable drift, file it then.

### Phase 0a success criteria

- `raw.githubusercontent.com/.../main/README.md` shows post-1.15.0 tagline and counts.
- AI Council carries the `Experimental` banner in skill doc and `docs/customization.md`.
- Release tag → main drift is documented in `docs/release-process.md`; follow-up gate (if needed) lives in its own roadmap.

### Phase 0a abort / rollback

- **Per-fix independence:** 0a.1, 0a.2, 0a.3 are fully independent. Any single item can revert without affecting the other two.
- **0a.1 SHA-mismatch:** abort path is in 0a.1.2; do not improvise commit selection.
- **0a.3 scope creep:** if investigation surfaces a deeper git/CI issue, fork to the named follow-up roadmap; do not expand scope here.

## Phase 0b — Budget-headroom + golden-test replay (gated)

**Gate:** `road-to-structural-optimization` v3.1 **Phase 0.4 must be locked** — `agents/roadmaps/structural-optimization-2A4-example.md` exists, council-reviewed, and the 2A.4 obligation-keyword-diff contract is green.

### 0b.0 Gate verification (Tier 2: A4 + A5)

- [ ] **0b.0.1** Confirm gate artefact: `test -f agents/roadmaps/structural-optimization-2A4-example.md && grep -E "^Status:.*locked" agents/roadmaps/structural-optimization-2A4-example.md`. Both must succeed.
- [ ] **0b.0.2** Confirm structural-optimization Phase 0.4 closure commit on `main`: `git log --oneline --grep="structural-optimization.*0\.4" main | head -5`. Expected: ≥1 closure commit.
- [ ] **0b.0.3** If either check fails, **stop**. Phase 0b cannot start. Re-check on the next session start.

### 0b.1 Golden-test failure-mode replay (F13 — was F8, promoted)

Promoted from Phase 2 per A6: trim correctness must be verifiable before 0b.2 commits. Bias toward failure-mode replay, not happy-path expansion (Reviewer 1 F8).

- [ ] **0b.1.1** Audit `tests/golden/` for missing scenarios on the four reviewer-cited surfaces: trivial-question suppression, commit-policy never-ask, README/main drift detection, top-5 cap exceedance.
- [ ] **0b.1.2** Add at most one new golden test per uncovered surface. Each test must replay a concrete failure mode (e.g. "agent commits without explicit user permission" → fixture asserts refusal).
- [ ] **0b.1.3** Run `pytest tests/golden/ -v`; all new tests green before 0b.2 starts.

### 0b.2 Budget headroom recovery (F10 — P1)

Top-5 always-rule cap currently has ~141 chars headroom (Reviewer 2 measurement after `no-cheap-questions` trim commit `41e575b`). Target: **≥ 2,000 chars** headroom post-trim.

- [ ] **0b.2.1** Run `pytest tests/test_always_budget.py -v`; capture which 5 rules occupy the top-5 cap and their char counts.
- [ ] **0b.2.2** Select the largest rule that is **not** a safety-floor rule. Q3=A from `road-to-structural-optimization` v3.1 excludes `non-destructive-by-default`, `commit-policy`, `scope-control`, `verify-before-complete` from slim work.
- [ ] **0b.2.3** Apply the 2A.4 obligation-keyword-diff contract (locked by gate 0b.0). Trim redundancy only — no semantic cuts. Produce the per-rule keyword table the contract requires; attach to commit message.
- [ ] **0b.2.4** Re-run `pytest tests/test_always_budget.py tests/golden/` post-trim; both green; headroom delta ≥ 1,859 chars (target 2,000 minus current 141). Commit.

### Phase 0b success criteria

- Top-5 always-rule cap headroom ≥ 2,000 chars after 0b.2.4.
- Golden tests cover ≥1 failure-mode scenario per reviewer-cited surface.
- 2A.4 obligation-keyword-diff table attached to the trim commit.

### Phase 0b abort / rollback

- **0b.0 gate failure:** stop; Phase 0b is not launchable until structural-opt 0.4 is locked. Re-check next session.
- **0b.2 trim infeasibility:** if no non-safety-floor rule yields 1,859 chars of redundancy under the 2A.4 contract without semantic loss, stop trimming, raise the top-5 cap by 2,000 chars **temporarily** with a `# TODO(1.17): re-tighten after Phase 2A` marker, and queue the rule for Phase 2A of `road-to-structural-optimization`. Do not silently let the cap stay at 141 chars headroom.

## Phase 1 — `load_context:` rollout + archive audit

**Gate:** Same as Phase 0b — `road-to-structural-optimization` v3.1 Phase 0.4 must be locked. Phase 1 applies the contract; it does **not** re-derive it. **Verify the gate per 0b.0 before launching 1.1**, even if 0b shipped earlier in the same session.

**Sequencing constraint with structural-optimization Phase 2A (R7 mitigation):** before each 1.1.2 PR, run `git log main..structural-optimization-2A --oneline -- .agent-src.uncompressed/rules/ 2>/dev/null | head -20`. If any rule listed in the 1.1.2 batch appears in that diff, **stop**: a 2A PR is in flight on the same file. Wait for it to land or be rebased before continuing.

### 1.1 `load_context:` rollout to remaining policy rules (F2)

Reviewer 1 named four candidates. Treat them as a graded list, not a batch:

| Rule | Risk class | Treatment |
|---|---|---|
| `commit-policy` | medium | Mechanics → context (`commit-mechanics.md` already exists per F2 audit). Iron Law stays inline. |
| `scope-control` | medium | Mechanics → context (`scope-mechanics.md` already exists). Iron Law stays inline. |
| `verify-before-complete` | medium | Mechanics → context (`verification-mechanics.md` already exists). Iron Law + Gate stay inline. |
| `non-destructive-by-default` | **high** | **Hard-Floor content stays inline.** Only failure-mode catalog and worked-examples may move to context. Reviewer 1 explicit warning. |

- [ ] **1.1.1** Confirm each rule already passes the Phase 0.4 worked-example contract: `pytest tests/test_load_context.py -k "<rule_name>" -v`. If the test file or the per-rule assertion does not exist yet, **stop** — Phase 0.4 contract is incomplete; surface to Matze. **Do not proceed to 1.1.2 without a green per-rule assertion.**
- [ ] **1.1.2** Apply `load_context:` to `commit-policy`, `scope-control`, `verify-before-complete` in that order. **One PR per rule, with a wait-time between merges** (Anthropic A7 / F5 slow-rollout): after each PR merges to `main`, run `task ci` on a fresh checkout and wait at least 24 h before the next PR opens. Each PR runs `pytest tests/test_always_budget.py tests/test_load_context.py tests/golden/ -v`; all green required.
- [ ] **1.1.3** For `non-destructive-by-default`: only move the failure-mode catalog and worked-examples to context. Hard-Floor table, Iron Law, and Cloud Behavior section stay inline. **Council-review protocol** (Anthropic A3 resolution): run `scripts/ai_council/council.py --bundle <diff-bundle> --reviewers anthropic,openai --prompt "Verify Hard-Floor table, Iron Law, and Cloud Behavior section are still inline; flag any obligation that moved to context"` before merge. Both reviewers must return `PASS` on the inline-content audit.
- [ ] **1.1.4** Re-run `pytest tests/test_always_budget.py -v` after each merge; record headroom delta (chars) in the PR description and append to the followup-archive entry. **If headroom drops below 1,500 chars at any point, stop further 1.1.x rollouts** and re-run 0b.2 trim before continuing.

### 1.2 `road-to-1-15-followups` archive verification (F12)

The previous followups roadmap is presumed complete. Reviewer 2 flagged it as unverified.

- [ ] **1.2.1** Open `agents/roadmaps/road-to-1-15-followups.md`; check every Phase-0 task box.
- [ ] **1.2.2** For each unchecked-but-claimed item: verify on `main` (not on tag) and **record evidence inline in the roadmap file** in this format, appended to the item line: `<!-- verified: <commit-sha> · <file:path> · <YYYY-MM-DD> -->`. Evidence lives in the roadmap file itself, not in a separate log (Anthropic A4 resolution).
- [ ] **1.2.3** If any item is still actually open, re-open the roadmap (status `draft`); do **not** mark it complete to clean the directory.
- [ ] **1.2.4** Once all items verified, set status `archived` and move to `agents/roadmaps/archive/` per existing convention.

### Success criteria

- Three medium-risk policy rules adopt `load_context:` without breaching the budget contract.
- `non-destructive-by-default` retains every Hard-Floor obligation inline; council audit returns `PASS` from both reviewers.
- `road-to-1-15-followups` is either correctly archived with inline evidence comments or correctly re-opened.

## Phase 2 — Polish & onboarding

Opportunistic. None of these block a release; they reduce reviewer-cited friction. F8 (golden tests) was originally here; promoted to Phase 0b per A6.

### 2.1 README single "Start here" anchor (F1, F3)

- [ ] **2.1.1** Add **one** anchor section near the top of `README.md` (after the elevator pitch, before the Tech-stack table): a 60-second onboarding path with three links — install, first command, where the rules live. **No** new content beyond the three links. Reviewer 1's "do not inflate the README" constraint is hard. **Forcing function** (Anthropic A5): before commit, `[ "$(git diff main -- README.md | grep -c '^+')" -le 15 ] || { echo \"README delta exceeds 15 added lines — abort\"; exit 1; }`. If exceeded, cut content (extra paragraphs, prose around the three links) until it fits, or move overflow to `docs/onboarding.md`.
- [ ] **2.1.2** Move any net-new explanatory prose to `docs/onboarding.md` (create if needed). README delta target: ≤ +15 lines (enforced by 2.1.1 forcing function).

### 2.2 Wording precision: agent vs. host agent (F4)

- [ ] **2.2.1** Search `README.md`, `AGENTS.md`, `docs/` for the broadened pattern (Anthropic A5): `grep -rEn "the agent (runs|implements|commits|executes|performs|applies|deploys|pushes|merges)" README.md AGENTS.md docs/`. Scope-boundary: only fix instances where "agent" appears **without** "host" modifier in the same sentence and where the literal claim is the host agent's behaviour, not the package's contract. Replace with "the host agent is instructed to…" or equivalent.
- [ ] **2.2.2** Do **not** rewrite skills/rules — those are the instruction-side; the wording fix is consumer-doc-side only.

### Success criteria

- README grows by ≤ 15 lines (enforced by 2.1.1 grep) and has one explicit "Start here" anchor.
- No instance of the package claiming "the agent runs/implements/commits/executes/performs/applies/deploys/pushes/merges" remains in consumer-facing docs without a `host` modifier.

## Risk register

| # | Severity | Risk | Mitigation | Source |
|---|---|---|---|---|
| **R1** | HIGH | 0a.1 cherry-pick SHAs are reviewer-supplied and may not exist locally → wrong commits land on main | 0a.1.2 explicit `merge-base --is-ancestor` loop with abort path; re-derive on miss | F9 |
| **R2** | MEDIUM | 0b.2 trim cannot find 1,859 chars of redundancy without semantic loss → headroom stays critical | 0b.2 abort/rollback: temporary cap raise with `# TODO(1.17)` marker + queue for 2A of structural-optimization | F10 |
| **R3** | MEDIUM | 1.1.3 `non-destructive-by-default` mechanics extraction silently weakens the Hard Floor | Council-review protocol (1.1.3) requires `PASS` from both reviewers on inline-content audit; failure-mode catalog only, never Iron Law content | F2 (reviewer 1 explicit) |
| **R4** | MEDIUM | 1.2 archive audit reveals 1.15-followups items are not actually done → roadmap status was wrong | 1.2.3 re-open the roadmap; do not paper over with a status flip; 1.2.2 inline `<!-- verified -->` comments make audit reproducible | F12 |
| **R5** | LOW | 2.1 "Start here" anchor balloons during review into a full onboarding rewrite | 2.1.1 grep-based forcing function (≤15 added lines, hard abort); overflow → `docs/onboarding.md` | F1, F3 |
| **R7** | MEDIUM | Phase 1.1.2 and `road-to-structural-optimization` Phase 2A both touch the same rules → merge conflicts | **Verifiable mitigation** (Anthropic A2): pre-flight `git log main..structural-optimization-2A --oneline -- .agent-src.uncompressed/rules/` per 1.1.2 PR; abort if rule overlap detected | F2 + structural-roadmap interaction |
| **R8** | HIGH | **Hidden coupling between 0b (budget trim) and 1.1 (load_context rollout)** — both modify the same budget surface; independent sequencing risks cascade re-trims and invalid 1.1.4 headroom measurements | **Option A gating** (R1 mitigation): both 0b and 1.1 share the same gate (structural-opt 0.4 locked); 0b runs to completion before 1.1.2 starts; 1.1.4 acts as a continuous re-measurement loop with the 1,500-char floor | Anthropic Round-1 "biggest under-weighted risk" |

R6 (release-workflow false positives) is removed in v1.1: the auto-fix portion was descoped per A6, so the false-positive risk no longer applies. The investigation-only step 0a.3 carries no gate logic.

## Sequencing rationale

- **Phase 0a first** — visible-quality regression on `main` (F9) is the only item Reviewer 2 anchored a score-recovery contract to. ≤30 min cost, A-grade impact, zero shared state with later phases.
- **Phase 0b gated on structural-optimization Phase 0.4** — Option A: budget trim uses the locked 2A.4 obligation-keyword-diff contract instead of a conservative fallback. Eliminates Anthropic's biggest under-weighted risk (R8). F13 (golden tests) lands in 0b before 0b.2 commit so trim correctness is verifiable.
- **Phase 1 same gate as 0b** — extending `load_context:` without the locked worked-example pattern would re-derive the same gaps Round-5 council resolved. 1.1.2 wait-times implement F5 slow-rollout (Anthropic A7). 1.1.4 re-measurement loop closes R8.
- **Phase 2 last** — none of it changes behaviour; landing it before Phase 1 would mean re-touching the same files twice.

## Locked decisions reference

- Hard-Floor rules excluded from slim work: Q3=A from `road-to-structural-optimization` v3.1.
- `load_context:` budget model: Phase 0.2 of `road-to-structural-optimization` v3.1 (with 2% tolerance band per G3 resolution).
- Worked-example contract for safety-floor split: Phase 0.4 of `road-to-structural-optimization` v3.1 (gates Phase 0b and Phase 1 here).
- Option A (gate Phase 0b on structural-opt 0.4): user decision 2026-05-03 after Council Round 1 surfaced R8 hidden-coupling risk.
- F13 reassignment: original list had a numbering gap (F12 → F14); v1.1 fills with golden-test failure-mode replay, promoted from Phase 2 to Phase 0b per Anthropic A6.
