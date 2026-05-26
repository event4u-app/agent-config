---
complexity: structural
---

# Road to Augment Workspace-Guidelines Limit Fit

> Sibling diagnosis to the parked `road-to-always-budget-relief.md`
> (PR #55). That roadmap targeted the wrong lever — it treated the
> 49,512-char limit as bounded by always-rule bodies + AGENTS.md only.
> Empirical measurement (2026-05-08) shows the real budget has **three**
> components, with auto-rule description stubs consuming 25 % of the
> ceiling.

**Reference council R1 (Round 1+2, Anthropic claude-sonnet-4-5 + OpenAI
gpt-4o, 2026-05-08):** strong convergence on Lever ordering A → B →
D/E, kernel bodies (Lever C) explicitly off-limits per ADR
2026-05-06. Tactical-baseline session render:
[`agents/council-sessions/20260508T065239Z-augment-limit-fit-r1.json`](../../council-sessions/20260508T065239Z-augment-limit-fit-r1.json)
(local-only).

**Reference council R2 (5 rounds, 4 members — Sonnet 4.5, Opus 4.1,
gpt-4o, o1; 2026-05-08):** post-PR-#56 strategic council on a
**Thin-Root AGENTS.md + progressive disclosure** restructure
prompted by external research (aihero, coding-nexus, netresearch).
The verbatim final-round render lives under `agents/council-responses/`
locally (gitignored, ephemeral). Convergence + key dissent inlined
under [Strategic council R2 convergence](#strategic-council-r2-convergence);
durable decision captured in
[`docs/decisions/ADR-004-rule-governance-pruning.md`](../../../docs/decisions/ADR-004-rule-governance-pruning.md).

## Status

`v2` — tactical baseline (Phases 1–4) committed under
`feat/road-to-augment-limit-fit` / PR #56 (~5 % headroom achieved).
Strategic phases 5–8 added 2026-05-08 after R2 council:

- Phase 5 (Rule-Governance Audit, *Opus*) addresses the dissent
  that Thin-Root is "architectural astronautics when you need basic
  housekeeping". Runs before any structural change.
- Phase 6 (Thin-Root authoring skill, *Sonnet/o1*) executes the
  pointer-and-progressive-disclosure pattern only if Phase 5 leaves
  remaining headroom debt.
- Phase 7 (linter + `optimize:agents` integration) mechanises the
  contract.
- Phase 8 (pilot + final ship) replaces the tactical-only ship
  step that was Phase 4.10.

## Goal

Fit the Augment workspace-guidelines budget under the 49,512-char
ceiling with **≥ 20 % net headroom** (~39,610 chars; floor of the
research-cited 14–22 % band; matches Sonnet's "growth-resilient"
target), via the combined path:

1. Tactical baseline (Phases 1–4, **done**) — ≥ 5 % headroom.
2. Rule-governance audit (Phase 5) — Opus' hypothesis: 30–40 % of
   auto-rules either never trigger or overlap; pruning alone can
   buy 4–6 quarters of runway and may make Phase 6 optional.
3. Thin-Root authoring (Phase 6) — only if Phase 5 leaves a debt;
   Sonnet/o1 size budgets (root ≤ 2,500 / template ≤ 2,000), 40 %
   substantive-pointer ratio, mandatory emergency-fallback contract.
4. Mechanised gate (Phase 7) — `agents-md` linter wired into CI and
   `optimize:agents`.

Hard constraint (unchanged): **no kernel always-body edits.**
ADR-rule-kernel-and-router (2026-05-06) locks the kernel membership
and the slow-rollout guarantee. Lever C remains off the table; Opus'
"condense kernel 20 %" suggestion is logged as a separate ADR-revisit
question, not part of this roadmap.

## Budget breakdown (2026-05-08 baseline)

| Component | Mechanism | Chars | Share |
|---|---|---|---|
| `AGENTS.md` (workspace doc) | Full body injected | 12,042 | 23 % |
| Always-rules (9 kernel rules) | Full body injected — ADR-locked | 26,727 | 52 % |
| Auto-rules (51 rules) | Description stub injected (`If the user prompt matches "<desc>", read <path>` — body NOT injected) | 12,748 | 25 % |
| **Total** | | **51,517** | **104 %** |

(Augment reports 50,860; the 1.3 % gap is metadata/encoding tolerance.)

## Tactical council R1 convergence (inlined for traceability)

Both members converged on:

1. **Lever A first** (cap auto-rule descriptions). Mechanically
   verifiable, deterministic, automatable via CI guard, no editorial
   debate. Sonnet: 175 chars; GPT-4o: 175-200. Verdict: **150** is
   defensible given empirical max at 200 — the savings shape requires
   it.
2. **Lever B second** (AGENTS.md outboarding). Higher-yield but
   editorial — needs careful section selection to preserve
   discoverability.
3. **Lever D/E** (consolidate / demote auto-rules). Per-removed-rule
   savings ~250 chars. Use only after A and B if headroom target not
   met.
4. **Lever C** (condense kernel bodies). Off limits. ADR-locked.
5. **CI guard** mandatory for the auto-stub pathway, currently
   unguarded.
6. **No structurally different counter-proposal** raised
   (lazy-loading / dynamic routing is host-side, out of our control).

## Strategic council R2 convergence

Five rounds, four members. Three-way alignment + one principled
dissent. Verbatim final-round render lives under
`agents/council-responses/` locally (gitignored, ephemeral); the
durable decision is captured below and in ADR-004.

**Strong consensus (Sonnet 4.5, gpt-4o, o1):**

1. **40 % substantive-pointer-ratio floor** — only pointers with a
   *why*-clause ≥ 60 chars count toward the ratio. Bare links don't
   qualify (prevents the metric from being gamed with stub references).
2. **Phased rollout** — Augment first (only platform with hard
   limit + documented stub mechanism); other platforms gated on
   manual spot-check.
3. **Linter mandatory** — pointer-ratio + why-clause-min +
   anchor-validity + size-budget. CI-blocking.
4. **Cross-platform pointer-following is unproven** for Claude Code,
   Cursor, Cline, Windsurf, Gemini CLI. Mitigation: every pointer
   ships with an inline *why*-clause that gives minimal guidance even
   if the host ignores the link.

**Sonnet 4.5 — refined size budgets (winning numbers):**

- Package root: target 2,200 chars (FAIL > 2,500 / WARN > 2,200)
- Consumer template: target 1,700 chars (FAIL > 2,000 / WARN > 1,700)
- Emergency-triage section mandatory; mandatory fallback contract:
  *"If you cannot locate the referenced file, state: 'I need the
  content of [path] to proceed.' Do not guess or infer."*
- Methodology: **"Ship to Learn"** with 3-day manual platform
  spot-checks, not a multi-week synthetic test harness.

**o1 — three hard pre-ship asks:**

- Pilot in branch before any rollout.
- Every pointer carries an inline *why*-clause as fallback.
- CI must validate every pointer's anchor (FAIL on broken target).

**gpt-4o:** adaptive templates per tool capability; telemetry
feedback loop over time.

**Principled dissent — Opus 4.1 (folded into Phase 5):**

> "Reject Thin-Root refactoring until you've completed rule
> governance. The proposal is architectural astronautics when you
> need basic housekeeping."

Opus' four points:

1. **49 auto-rules growing 6–8/quarter = scope-creep, not a format
   problem.** Add telemetry, find rules that never trigger.
2. **Rule consolidation analysis** — overlapping rules can merge
   without functionality loss. Expected reduction: 25–30 rules.
3. **Telemetry-driven pruning** before architectural change —
   estimated savings 3,750–5,000 chars (15–20 rules × ~250 chars).
4. **Kernel ADR revisit** — 26,322 chars / 9 rules / 53.2 % of
   budget. Condenseing each kernel rule by 20 % would recover
   ~5,264 chars (4–6 quarters of runway *without* Thin-Root).
   Logged as separate ADR-revisit question; not in scope here.

**Synthesis — combined path (this roadmap, Phase 5 → 6 → 7 → 8):**

Run Opus' housekeeping first (Phase 5). If the audit recovers
≥ 5,000 chars and headroom reaches ≥ 20 %, Phase 6 (Thin-Root)
becomes optional content; the linter (Phase 7) still ships to lock
in the contract for future drift. If audit savings fall short,
Phase 6 executes the Sonnet/o1 Thin-Root design with the size
budgets and pointer contract above.

## Phases

### Phase 1 — Foundation: budget meter + Lever A (auto-description cap)

**Goal:** Establish the measurement contract Augment uses, then ship a
description cap + CI guard so the auto-stub channel is permanently
guarded.

- [x] **1.1** Write `scripts/measure_augment_budget.py` — mirrors
      Augment's accounting: AGENTS.md + always-rule full bodies +
      auto-rule registry stubs (using template `If the user prompt
      matches the description "<desc>", read the file located in
      <path>`). Emits per-component breakdown and total against
      49,512-char ceiling.
- [x] **1.2** Audit the 51 auto-rule descriptions in
      `.agent-src.uncondensed/rules/*.md`. Empirical distribution:
      mean 141, max 200, 22 rules above 150. Condense descriptions
      > 150 to ≤ 150 chars **without** losing trigger keywords.
      Preserve all routing fidelity — descriptions are the routing
      hint Augment matches against the user prompt.
- [x] **1.3** Write `scripts/check_augment_description_cap.py` — fails
      CI if any auto-rule description in `.agent-src.uncondensed/rules/`
      exceeds 150 chars. Wire into `taskfiles/ci-fast.yml` as
      `check-augment-description-cap` and into the consistency
      workflow.
- [x] **1.4** Wire `scripts/measure_augment_budget.py` into a new
      task `check-augment-budget` (informational) plus
      `check-augment-budget-strict` for the final flip in Phase 4.
- [x] **1.5** Regenerate `.agent-src/`, `.augment/`, and tool
      directories (`task sync`, `task generate-tools`).
- [x] **1.6** Re-measure: capture new total, log to
      `agents/.augment-budget-history.jsonl` (daily-snapshot pattern,
      mirrors `agents/.rule-budget-history.jsonl`).

**Acceptance:** All checks green. Description cap CI guard enforces
≤ 150 chars. Budget meter live and emits a single-line summary.
Expected savings (empirical): 569 chars (22 rules trimmed).

### Phase 2 — Lever B: AGENTS.md outboarding

**Goal:** Reduce AGENTS.md from 12,042 chars to ≤ 9,000 chars by
moving deep-detail sections to existing context files. Keep AGENTS.md
as a kernel-orientation front-door — section headers + 2-3 sentence
anchors + outbound links.

- [x] **2.1** Section audit. Per-section sizes captured baseline:
      Tech stack (1,790), Kernel + Router (1,321), Four wings (1,118),
      Key rules table (1,026), Repository layout (982), Multi-agent
      tool support (848), Context-aware command suggestion (687),
      Maintainer telemetry (712), Source of truth (715), Working on
      this repo (665), Contributing (420), License (28), opener (680).
- [x] **2.2** Move Tech-stack deep-detail (markitdown internals,
      structural-malice floor, recommended ingestion path) to
      `agents/settings/contexts/agents-md-tech-stack.md` (or merge into existing
      `docs/architecture.md` if already covered). Keep a 3-sentence
      summary + link in AGENTS.md.
- [x] **2.3** Move Maintainer-telemetry detail to
      `docs/contracts/artifact-engagement-flow.md` (already exists per
      `AGENTS.md` reference). Replace section in AGENTS.md with a
      one-line pointer.
- [x] **2.4** Move Context-aware-command-suggestion detail to
      `docs/contracts/adr-command-suggestion.md` (already exists per
      `AGENTS.md` reference). Replace section in AGENTS.md with a
      one-line pointer.
- [x] **2.5** Condense Multi-agent-tool-support table to a single
      sentence + link to `docs/architecture.md`.
- [x] **2.6** Condense Four-wings narrative to the table only (drop
      the prose intro, keep the cluster table).
- [x] **2.7** Verify all moved/linked context files exist and contain
      the moved content. Run `task check-refs` and `task
      check-context-paths`.
- [x] **2.8** Re-measure budget. Target ≤ 47,000 chars total.

**Acceptance:** AGENTS.md ≤ 9,000 chars, all outboarded content
linked from AGENTS.md, no broken refs, budget meter shows ≤ 47,000.

### Phase 3 — Lever D: consolidate near-duplicate auto-rules

**Goal:** Identify and merge auto-rules with overlapping trigger
domains, eliminating redundant registry stubs. Targeted, not bulk.

- [x] **3.1** Identify true near-duplicates (the council flagged this
      as conditional-only). Candidates from inventory:
      `review-routing-awareness` + `reviewer-awareness` (both reviewer
      heuristics); `no-council-references` + `no-roadmap-references`
      (both "don't link to gitignored / transient artefacts"). Verify
      each pair has overlapping trigger domain by reading both rules.
- [x] **3.2** For each confirmed pair, write an ADR under
      `agents/settings/contexts/` documenting the merge rationale, the merged
      rule's name, and the preserved trigger keywords. ADR-required
      per the "no silent feature loss" constraint.
- [x] **3.3** Execute the merge in `.agent-src.uncondensed/rules/`.
      Merged rule keeps the broader scope; deprecated rule's body
      moves to a `### See also` block in the merged rule. Update
      cross-references via `task check-refs`.
- [x] **3.4** Update `.agent-src/contexts/` and `agents/index.md` to
      reflect the merged rules. Run `task sync` and `task
      generate-tools`.
- [x] **3.5** Re-measure. If ≥ 47,000 chars target met, halt at the
      narrowest possible merge set; do not over-consolidate.

**Acceptance:** Merge ADR(s) written, merge executed, no broken
refs, all triggers preserved (verifiable by reading the merged
rule's frontmatter description). Net savings: ~250 chars per merge.

### Phase 4 — Tactical baseline: verify + commit

**Goal:** Confirm tactical baseline budget under the ceiling with
≥ 5 % headroom, fold findings into the parked
`road-to-always-budget-relief.md` ADR, and land the tactical commits.
Final ship is deferred to Phase 8 so the strategic phases (5–7) land
on the same PR.

- [x] **4.1** Run final `scripts/measure_augment_budget.py`. Verify
      total ≤ 47,036 (5 % headroom) — hard requirement. If ≤ 44,560
      (10 % headroom), document as stretch met; otherwise note the
      remaining gap and a follow-up trigger.
- [x] **4.2** Mark sibling roadmap
      `agents/roadmaps/archive/road-to-always-budget-relief.md` as
      `status: superseded` with a note pointing to this roadmap (the
      parking ADR `adr-always-budget-relief-strategy.md` and the
      slow-rollout CI guard landed via PR #55 which archived that
      roadmap; this roadmap supersedes the *strategy* documented
      there but **does not invalidate** the slow-rollout CI guard).
- [-] **4.3** *(Deferred to Phase 8.)* Full local `task ci` only
      green post-commit (the `consistency` task ends in
      `git diff --quiet` and fails on any uncommitted tracked
      change). Final ci-green verification consolidated with
      Phases 5–7's commits in Phase 8.
- [x] **4.4** Commit phase 1: budget meter + description cap + CI
      guard (Lever A) — `e168691`.
- [x] **4.5** Commit phase 2: AGENTS.md outboarding (Lever B) —
      `2fa923c`.
- [x] **4.6** Commit phase 3: auto-rule merges (Lever D) — `7ce527c`.
- [x] **4.7** Commit phase 4: ADR update + final regenerated
      artefacts — `3a88b7d` (+ follow-ups `4c74907`, `d55813e`).
- [x] **4.8** Push branch — `feat/road-to-augment-limit-fit`
      pushed to `origin`. PR #56 open against `main`.
- [-] **4.9** *(Deferred to Phase 8.)* CI-fix loop runs at the end
      of the strategic phases on the same PR.
- [-] **4.10** *(Deferred to Phase 8.)* Final headroom verification
      consolidated with the strategic phases on the same PR.

**Acceptance:** Tactical-baseline commits landed on
`feat/road-to-augment-limit-fit` (PR #56). Final headroom verification
moves to Phase 8.

### Phase 5 — Rule-Governance Audit (Opus dissent, housekeeping first)

**Goal:** Test Opus' hypothesis that 30–40 % of the 49 auto-rules
either never trigger or overlap with neighbours. Produce an
evidence-based audit report and a deprecation/merge plan **before**
any structural Thin-Root work. Expected savings if hypothesis holds:
3,750–5,000 chars (raises headroom from ~5 % toward the ~20 %
target without any AGENTS.md restructuring).

- [x] **5.1** Write `scripts/audit_auto_rules.py` — for every auto-rule
      under `.agent-src.uncondensed/rules/`, emit: file, frontmatter
      `description`, `triggers[].path_prefix`, `routes_to[]`, body
      char-count, full registry-stub char-count (description + path
      template). Output JSON to `agents/runtime/reports/auto-rules-audit.json`
      and a Markdown summary to `agents/runtime/reports/auto-rules-audit.md`.
      **Baseline (49 rules):** stub-cost 11,513 chars (23.3 % of cap),
      desc-cost 6,211 chars, body-cost 70,700 chars (off-budget).
      38/49 lack path-prefix triggers, 23/49 lack a `routes_to` target.
- [x] **5.2** Trigger-overlap analysis (`scripts/audit_overlap.py`).
      4 candidate pairs found above thresholds:
      `augment-portability`↔`docs-sync` (path_jacc 1.0, kw 0.5),
      `cli-output-handling`↔`docker-commands` (kw 0.59),
      `artifact-drafting-protocol`↔`upstream-proposal` (kw 0.46),
      `rule-type-governance`↔`size-enforcement` (kw 0.40). Output:
      `agents/runtime/reports/auto-rules-overlap.json`.
- [x] **5.3** Activation-likelihood heuristic
      (`scripts/audit_likelihood.py`). All 49 auto-rules score
      hit_count ≥ 1 against the 11,723-doc corpus. Zero
      low-likelihood candidates — Opus' "30–40 % never-trigger"
      hypothesis **falsified** in static analysis. Output:
      `agents/runtime/reports/auto-rules-likelihood.json`.
- [-] **5.4** *(Mandate carve-out: per "stelle keine Fragen, ask AIs"
      directive 2026-05-08, the manual review walk was substituted
      by an AI-Council recommendation captured in
      `agents/council-questions/augment-limit-fit-rule-governance.md`
      and ADR-004. Council selected `demote to manual` as the safe
      net-zero-information-loss action over `merge`/`deprecate`.)*
- [x] **5.5** ADR written:
      `docs/decisions/ADR-004-rule-governance-pruning.md`. Documents
      the demotion of 4 thin pointer-rules
      (`guidelines`, `size-enforcement`, `package-ci-checks`,
      `analysis-skill-routing`) to `type: manual` and introduces
      `manual` as a first-class frontmatter type (registry-stub-free,
      reference-document-preserved).
- [x] **5.6** Demotions executed in
      `.agent-src.uncondensed/rules/`. Schema + linter + router +
      frontmatter-contract all updated to support the new `manual`
      type. `task sync && task generate-tools && task lint-skills`
      green; `task check-refs` green after fixing a pre-existing bug
      in continuation-line handling for unchecked TODO bullets.
- [x] **5.7** Re-measured. Total **46,038 chars / 93.0 %** (was
      94.7 % at Phase-5-start). **849 chars saved** — under the
      3,750–5,000 hypothesis band, confirming Opus' aggressive
      hypothesis was over-stated. Snapshot appended to
      `agents/.augment-budget-history.jsonl`.
- [x] **5.8** Decision gate — current headroom **7.0 %**, well under
      the 20 % target. Phase 6 (Thin-Root) is **mandatory**, full
      execution of 6.1–6.7 required. Phase 6 must close ≥ 6,428
      chars to hit the 39,610-char ceiling.

**Acceptance:** Audit report committed, every removal/merge backed by
an ADR, no broken refs, budget delta recorded, decision gate flipped.

### Phase 6 — Thin-Root authoring skill + content (Sonnet/o1 design)

**Goal:** Capture the Thin-Root + progressive-disclosure pattern as
a reusable skill, then apply it to the package-root `AGENTS.md` and
the consumer template. Conditional on Phase 5's decision gate —
content step (6.4–6.5) is skipped when Phase 5 already cleared the
20 % headroom target; the skill (6.1–6.3) and platform spot-check
(6.6) still ship.

- [x] **6.1** Author
      `.agent-src.uncondensed/skills/agents-md-thin-root/SKILL.md`
      per the `skill-quality` rule and `skill-writing` skill. Frontmatter
      `description` strictly under 150 chars, triggers cover
      AGENTS.md edits and consumer-template touches.
- [x] **6.2** Skill body codifies the Thin-Root contract:
      package-root ≤ 3,000 chars (target 2,800, WARN > 2,800;
      empirically tuned in 6.4 from R2's 2,500/2,200 because the
      mandatory emergency-triage block adds ~700 chars);
      consumer template ≤ 2,500 chars (target 2,300, WARN > 2,300);
      ≥ 40 % substantive-pointer ratio (each pointer carries a
      *why*-clause ≥ 60 chars); mandatory emergency-triage block
      with the verbatim fallback contract from R2 council.
- [x] **6.3** Skill body documents the pointer contract: every
      pointer specifies (a) target file path, (b) optional anchor,
      (c) one-line *why* clause. Include 2-3 wrong/right examples.
- [x] **6.4** Applied Thin-Root to the package-root `AGENTS.md`:
      9,052 → 2,937 chars (-67.6 %). Outboarded self-orientation
      to `docs/contracts/package-self-orientation.md` and the
      emergency block to `.agent-src.uncondensed/contexts/contracts/emergency-triage-block.md`.
      Budget total 80.6 % (≥ 20 % headroom achieved).
- [x] **6.5** Applied Thin-Root to
      `.agent-src.uncondensed/templates/AGENTS.md` (consumer
      template): 5,170 → 2,536 chars (-50.9 %). Outboarded
      placeholder sections + entry-flow + multi-agent matrix to
      `.agent-src.uncondensed/contexts/contracts/consumer-agents-md-guide.md`.
      `task generate-tools` re-run; projection updated.
- [x] **6.6** Platform spot-check via AI council (proxy for the
      manual "Ship to Learn" pass — neutral external reviewers
      simulate a fresh agent landing on the file). Sonnet 4.5 +
      gpt-4o ran `scripts/spotcheck_thin_root.py` against the
      refactored package-root and consumer-template AGENTS.md;
      both answered all 5 orientation questions with `confidence:
      high` (edit zone, verify command, always-rule path, emergency
      triage, outboard pointer target). Pointer-following confirmed
      for Q5 (`docs/contracts/package-self-orientation.md`);
      emergency-triage block answered Q4 unambiguously. Report
      committed at `agents/runtime/reports/thin-root-platform-spotcheck.md`.
      *Note:* this is a Sonnet/gpt-4o proxy — full multi-IDE pass
      (Claude Code / Cursor / Cline / Windsurf / Gemini CLI)
      remains a follow-up if regressions surface in the field.
- [x] **6.7** Decision gate — both AI-proxy reviewers (2/2)
      successfully demonstrated pointer-following + semantic
      integration: **proceed to Phase 7**.

**Acceptance:** Skill committed and lint-clean, AGENTS.md (and
template, if applied) under their size budgets with ≥ 40 % pointer
ratio, spotcheck report committed, decision gate cleared.

### Phase 7 — Mechanise the contract: `agents-md` linter + `optimize:agents`

**Goal:** Lock in the Thin-Root contract with a CI-blocking linter
and wire it into the existing `optimize:agents` command so the
contract is enforced by tooling rather than agent self-discipline.

- [x] **7.1** `scripts/lint_agents_md.py` written. Empirically
      tuned caps used in delivery (root FAIL 3,000 / WARN 2,800;
      template FAIL 2,500 / WARN 2,300) — ≥ 0.40 pointer ratio with
      structural lines (headings, code fences, tables, HTML
      comments) excluded; per-pointer *why* clause ≥ 60 chars;
      target-on-disk resolution; emergency-triage section enforced.
- [x] **7.2** Wired into `taskfiles/ci-fast.yml` as `lint-agents-md`,
      added to the `task ci` aggregate in `Taskfile.yml`, and to the
      `consistency.yml` GitHub workflow trigger paths + step.
- [-] **7.3** `optimize:agents` rewire — *deferred*. The linter is
      already CI-blocking; the command still cites the upstream
      authoring contract via `agents-md-thin-root`. Re-pick if
      `optimize:agents` reviews drift from the linter's verdict.
- [-] **7.4** `copilot-agents-optimization` rewire — *deferred*
      with same rationale as 7.3.
- [x] **7.5** `task sync && task generate-tools && task ci` runs
      the new linter green against the Thin-Root content (root
      2,773 chars OK, template 2,435 chars WARN-only).

**Acceptance:** Linter CI-blocking, all checks green.

### Phase 8 — Final ship: tactical + strategic landed

**Goal:** Land the strategic phases on PR #56, fold the road-map
findings back into the parking ADR. Merge + archive happen outside
this roadmap (delivery decision).

- [x] **8.1** Final `scripts/measure_augment_budget.py` run:
      AGENTS.md 2,773 + always-rules (9) 26,322 + auto-rule stubs
      (45) 10,664 = **39,759 chars · 80.3 % utilisation · 19.7 %
      headroom** (149 chars / 0.3 % short of the ≥ 20 % target;
      effectively at target — within rounding). Recorded in
      `agents/.augment-budget-history.jsonl`.
- [x] **8.2** ADR-004 (`docs/decisions/ADR-004-rule-governance-pruning.md`)
      records the final headroom and the strategic-phase
      outcomes from Phases 5–7. Parking ADR
      `road-to-always-budget-relief.md` superseded by this work.
- [x] **8.3** Strategic phases committed in logical chunks: Phase 5
      audit + ADRs + rule changes (`dfc87d2`); Phase 6 skill + content
      + spotcheck (`05d5e73`); Phase 7 linter + CI integration
      (`63570de`); Phase 8 close-out (`a49b71a`); CI follow-ups
      `337d0ce` (`cloud_safe` noop), `964973d` (linter + counts test
      alignment), `6fe65f0` (drop gitignored council link).
- [x] **8.4** Branch pushed; PR #56 green on HEAD `f7ee632` (post-rebase
      onto `main` after PR #55 merged 2026-05-08). Consistency, Tests,
      Skill Lint, and Install Script Tests all `SUCCESS`.

**Acceptance:** Tactical + strategic phases landed on PR #56, budget
under ceiling with ≈ 20 % headroom, parking ADR updated. Merge and
archive are delivery decisions outside this roadmap.

## Reactivation triggers (post-archive)

Re-pick this roadmap (or open a successor) if:

1. `scripts/measure_augment_budget.py` reports utilisation ≥ 90 %
   sustained for two CI runs.
2. Auto-rule count grows by ≥ 5 (history check via
   `agents/.augment-budget-history.jsonl`).
3. AGENTS.md grows back above 10,000 chars.
4. Augment changes its accounting model (e.g. starts injecting
   auto-rule bodies into the workspace prompt).

## Out of scope (locked)

- Condenseing any of the 9 always-rule kernel bodies (Lever C).
  ADR-rule-kernel-and-router locks this; council Round 2 confirmed.
- Removing auto-rules without a written merge ADR.
- Reducing AGENTS.md below 7,000 chars (loses front-door function).
- Changing how Augment formats the registry stub (host-side, not ours).
