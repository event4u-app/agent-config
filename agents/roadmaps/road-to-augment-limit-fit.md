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

**Reference council (Round 1+2, Anthropic claude-sonnet-4-5 + OpenAI
gpt-4o, 2026-05-08):** strong convergence on Lever ordering A → B →
D/E, kernel bodies (Lever C) explicitly off-limits per ADR
2026-05-06. Verbatim render:
[`agents/council-sessions/20260508T065239Z-augment-limit-fit-r1.json`](../council-sessions/20260508T065239Z-augment-limit-fit-r1.json)
(local-only; convergence inlined below).

## Status

`v1` — drafted post-council. All phases unstarted. Convergence locked
at the level of "primary lever ordering"; per-phase numbers refined
against empirical distribution measurement (descriptions max at 200
chars in current data, not 311 — that figure was full-stub size, not
description-only).

## Goal

Fit the Augment workspace-guidelines budget under the 49,512-char
ceiling with **≥ 5 % net headroom** (~47,036 chars), stretch target
**10 %** (~44,560 chars) per council Round 2 (Sonnet) reasoning that
historic auto-rule growth (~6-8 rules/quarter) at avg ~250 chars/stub
otherwise refills headroom in 2-3 quarters.

Hard constraint per council convergence: **no kernel always-body
edits.** ADR-rule-kernel-and-router (2026-05-06) locks the kernel
membership and the slow-rollout guarantee. Lever C is off the table
for this roadmap.

## Budget breakdown (2026-05-08 baseline)

| Component | Mechanism | Chars | Share |
|---|---|---|---|
| `AGENTS.md` (workspace doc) | Full body injected | 12,042 | 23 % |
| Always-rules (9 kernel rules) | Full body injected — ADR-locked | 26,727 | 52 % |
| Auto-rules (51 rules) | Description stub injected (`If the user prompt matches "<desc>", read <path>` — body NOT injected) | 12,748 | 25 % |
| **Total** | | **51,517** | **104 %** |

(Augment reports 50,860; the 1.3 % gap is metadata/encoding tolerance.)

## Council convergence (inlined for traceability)

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
4. **Lever C** (compress kernel bodies). Off limits. ADR-locked.
5. **CI guard** mandatory for the auto-stub pathway, currently
   unguarded.
6. **No structurally different counter-proposal** raised
   (lazy-loading / dynamic routing is host-side, out of our control).

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
      `.agent-src.uncompressed/rules/*.md`. Empirical distribution:
      mean 141, max 200, 22 rules above 150. Compress descriptions
      > 150 to ≤ 150 chars **without** losing trigger keywords.
      Preserve all routing fidelity — descriptions are the routing
      hint Augment matches against the user prompt.
- [x] **1.3** Write `scripts/check_augment_description_cap.py` — fails
      CI if any auto-rule description in `.agent-src.uncompressed/rules/`
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
      `agents/contexts/agents-md-tech-stack.md` (or merge into existing
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
- [x] **2.5** Compress Multi-agent-tool-support table to a single
      sentence + link to `docs/architecture.md`.
- [x] **2.6** Compress Four-wings narrative to the table only (drop
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
      `agents/contexts/` documenting the merge rationale, the merged
      rule's name, and the preserved trigger keywords. ADR-required
      per the "no silent feature loss" constraint.
- [x] **3.3** Execute the merge in `.agent-src.uncompressed/rules/`.
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

### Phase 4 — Verify + ship

**Goal:** Confirm the budget is under the ceiling with the agreed
headroom, fold this roadmap's findings back into the parked
`road-to-always-budget-relief.md` ADR, and ship.

- [x] **4.1** Run final `scripts/measure_augment_budget.py`. Verify
      total ≤ 47,036 (5 % headroom) — hard requirement. If ≤ 44,560
      (10 % headroom), document as stretch met; otherwise note the
      remaining gap and a follow-up trigger.
- [x] **4.2** Mark sibling roadmap
      `agents/roadmaps/road-to-always-budget-relief.md` as
      `status: superseded` with a note pointing to this roadmap (the
      parking ADR `adr-always-budget-relief-strategy.md` lives on
      open PR #55 and was never merged to main; this roadmap
      supersedes that PR's plan but **does not invalidate** the
      slow-rollout CI guard from #55, which lands independently).
- [ ] **4.3** Run full local CI: `task sync && task generate-tools &&
      task ci`. Confirm green.
- [ ] **4.4** Commit phase 1: budget meter + description cap + CI
      guard (Lever A).
- [ ] **4.5** Commit phase 2: AGENTS.md outboarding (Lever B).
- [ ] **4.6** Commit phase 3: auto-rule merges (Lever D), if executed.
- [ ] **4.7** Commit phase 4: ADR update + final regenerated artefacts.
- [ ] **4.8** Push branch, open PR `feat: fit Augment workspace-guidelines
      budget under 49,512 ceiling`. Ready for review.
- [ ] **4.9** Fix any CI failures on the PR until green.
- [ ] **4.10** When PR merged and 0 open boxes — archive this roadmap
      to `agents/roadmaps/archive/`.

**Acceptance:** PR green, budget under ceiling with ≥ 5 % headroom,
parking ADR updated, roadmap archived.

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

- Compressing any of the 9 always-rule kernel bodies (Lever C).
  ADR-rule-kernel-and-router locks this; council Round 2 confirmed.
- Removing auto-rules without a written merge ADR.
- Reducing AGENTS.md below 7,000 chars (loses front-door function).
- Changing how Augment formats the registry stub (host-side, not ours).
