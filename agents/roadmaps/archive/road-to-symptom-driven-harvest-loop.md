---
complexity: lightweight
---

# Road to the symptom-driven harvest loop — make the process that found V1–V9 repeatable

> **The ask (2026-08-12):** the roadmap
> [`road-to-subagent-lifecycle-integrity`](../road-to-subagent-lifecycle-integrity.md)
> was produced by a specific loop: an operator's symptom report → pinned-commit
> defect confirmation with file:line provenance → external triangulation
> (upstream issues, official docs, practitioner reports) → three iterations,
> each feeding the next → an inverted-form roadmap. If that loop earned its
> keep, encode it. This roadmap builds the **smallest** version of that —
> intake surface first, codified procedure second, and only if the first two
> runs survive their own falsifier.

> **Adopted 2026-08-12 at tip `1432c7a45`.** Context claims re-verified:
> `agents/tickets/symptoms/` does not exist, no upstream watchlist exists, and
> `docs/install-friction-report.md` still reads `status: template — awaiting
> sessions (no real data yet)`. Program amendments applied inline: Phase 1
> backfills **all three** 2026-08 operator reports, Phase 3's entry schema gains
> `kind` (X5), and Phase 2's falsifier ledger records runs 2 and 3.
> Source (consumed inbox): the `optimize-agent-config` batch under
> [`agents/tmp.old/`](../../tmp.old/), adopted by
> [`/analyze:inbox`](../../../src/domains/analysis-workbench/analyze/inbox/command.md).

## Context / What is verified

**The existing harvest machinery is source-driven, not symptom-driven.** The
inbox-harvest family starts from external material pushed onto the repo
(`agents/roadmaps/archive/road-to-inbox-harvest-2026-08-b.md` triages a batch of
dropped files) and ADR-211 C/D already corrected the direction once: start from
a confirmed repo defect, draw sources in. What has no surface at all is the
step **before** that — a production symptom arriving from an operator. The
2026-08-12 report (three symptoms, verbal, via chat) had nowhere to land in the
tree; it exists only in this roadmap's Context.

**The one intake instrument that exists has never run.**
`docs/install-friction-report.md` frontmatter reads `status: template —
awaiting sessions (no real data yet)` — the standing finding across release
reviews. It is also the wrong shape for this: it measures first-install
friction with recruited developers, not in-production symptoms from existing
operators. Repurposing it would conflate two populations.

**The loop's three iterations each changed the outcome, which is the evidence
it did work worth encoding.** Round 1 (repo-only) found V1–V4 and V9. Round 2
(external) refuted a standing blocker with the official payload spec (V6),
imported the #20221 constraint that reshaped Phase 2 from "block on invalid"
to "command-hook, disk-fallback, block-once", and imported #55754 which created
Phase 3 Step 2. Round 3 (consistency pass) found the reopen-clause deadlock
(V2's PREMISE-STALE half) — the single finding that justifies reopening
cancelled work at all. A one-pass version would have shipped a roadmap that
re-proposed cancelled items with no reopening argument and a Phase 2 the host
would have broken.

**What must NOT be built.** No new subsystem, no tracker, no web anything. The
tree already has `agents/tickets/`, a roadmap-writing skill, and harvest
conventions; this is an extension of those (solution-minimalism lens:
`road-to-solution-minimalism.md` scopes additions to the absent part only).

## Phase 1: Symptom intake — one convention, one lint

- [x] **Step 1:** A file convention under `agents/tickets/symptoms/`
      *(proposal)*: one markdown file per report with frontmatter
      `{reported: date, reporter: role-not-name, host: <tool + version if
      known>, symptoms: [one line each]}`. Free-form body. Nothing else.
      <!-- done: agents/tickets/symptoms/README.md carries the convention plus
      the two resolution blocks; _template.md is the copy-target. Shape follows
      agents/recruit-sessions/ (README + _template), the closest existing intake
      surface. The tickets/ row in docs/contracts/agents-layout.md was widened in
      the same change — it described bundles only. agents/tickets/ is already an
      allowed top-level dir and lint_agents_layout only walks top level, so the
      subdirectory needed no allowlist entry. -->

      A **`null:` resolution is a first-class outcome**, not a failure to act:
      the README states it, because an intake surface that only records
      confirmed defects teaches its readers to stop filing the ambiguous ones.
- [x] **Step 2:** One lint rule: a symptom file older than 30 days must carry
      either a `confirmed:` block (defect + file:line at a pinned commit) or a
      `null:` block (checked, not reproducible, evidence ref). Unresolved
      staleness is a lint warning, not an error — intake must stay cheaper
      than the work it triggers.
      <!-- done: src/scripts/lint_symptom_intake.ts + tests/scripts/
      lint_symptom_intake.test.ts (12 tests) + taskfiles/ci-fast.yml task +
      Taskfile.yml ci aggregate. Extend-before-create was checked: the existing
      freshness gates (lint_eval_freshness, lint_behavioural_eval_freshness,
      check_*_freshness) all key on corpus manifests and upstream SHAs, none on a
      markdown resolution block, so none was extendable. Adopted _lib/gate_ledger
      rather than a `// ledger-exempt:` marker — the gate has real per-target
      verdicts, and exempting it would be the "suppression wearing a
      justification's clothes" that check_gate_completeness warns about; the
      ledger-adoption ratchet moved 217 → 216 and the baseline was lowered to
      match. README.md and _template.md are planned and accounted as
      not_applicable_kind so the gate cannot go dead when the last entry
      resolves. -->

      The only exit-1 path is a dead scan scope. **A gate that reds CI because a
      human has not yet investigated a symptom teaches people to stop filing
      symptoms** — which would destroy the surface it is meant to protect.
- [x] **Step 3:** Backfill the 2026-08-12 operator reports as the first entries,
      each with its `confirmed:` block: the three-symptom subagent report →
      `road-to-subagent-lifecycle-integrity.md`, and the
      screenshot-instead-of-source frontend report →
      `road-to-source-first-frontend.md`.
      <!-- done: agents/tickets/symptoms/2026-08-12-subagent-runs-and-returns.md
      and 2026-08-12-frontend-built-from-screenshots.md. -->

      **Correction to the program's X6 count, found while executing this step:
      there are two symptom reports, not three.** The program counted the
      design-system / crawler request as a third operator report, and this
      roadmap's own amendment inherited that. It is not a symptom — it is a
      feature request, which `agents/tickets/symptoms/README.md` § What NOT to
      put here explicitly excludes, because an intake surface that accepts
      requests stops measuring production failures. It is owned as a roadmap
      (`road-to-design-system-onramp.md`) and needs no intake entry. The
      falsifier's "zero entries beyond the backfill" count is therefore against
      **two**, not three.

**Falsifier.** Two release cycles with zero entries beyond the backfill → the
surface has no demand; delete the directory and the lint, record the null.
(The install-friction template's fate is the cautionary precedent: an
instrument nobody feeds is estate weight.)

**Rollback.** Delete one directory and one lint rule.

## Phase 2: Codify the loop — an extension of roadmap-writing, not a new skill

- [x] **Step 1:** Add a "symptom-driven harvest" section to the existing
      roadmap-writing skill *(proposal — extension, not a new skill)* encoding
      the loop as run: (1) confirm each symptom against the live tree at a
      pinned commit, per-claim file:line, before any external search;
      (2) triangulate externally per confirmed defect — upstream issue
      tracker of the host tool, official docs fetched fresh, practitioner
      reports — inverted form throughout; (3) iterate ≥2 further rounds, each
      round stating its delta over the last (a round with no delta ends the
      loop early, honestly); (4) emit the roadmap with a symptom→defect map
      and per-phase falsifiers.
- [x] **Step 2:** The section's own worked example is the V6 refutation from
      the first run: a repo comment ("cannot be marked per-spawn") standing
      for months, refuted in one round by fetching the current payload spec —
      the argument for why round 2 is mandatory, not optional.
      <!-- done: docs/guidelines/agent-infra/symptom-driven-harvest-loop.md
      § Worked example. -->

**Where the section actually landed, and the pre-registered reason.** Risk
Register rank 3 said: ship it condensed, measure the skill against the
token-budget band, and if it does not fit, move the procedure to a guideline with
a pointer in the skill. It did not fit — `roadmap-writing/SKILL.md` measures
~4.8k tokens, already 1.4× the 3,500-token band before any addition — so the
procedure is
[`guideline:agent-infra/symptom-driven-harvest-loop`](../../../docs/guidelines/agent-infra/symptom-driven-harvest-loop.md)
and the skill carries a three-line route in § When to use. The mitigation fired
as written rather than being re-decided under pressure.

**One honest cost, not papered over.** The skill sat at *exactly* 400 lines, and
`skill_linter`'s size check fires above 400 — so any compliant execution of this
step trips one advisory `skill_too_large` warning (403 lines). It is a warning,
the linter still exits 0, and no baseline ratchets on it; the alternative was to
leave the loop undiscoverable from the skill that authors roadmaps, which is the
step's whole purpose. Trimming three lines of unrelated content to buy the margin
would have been a drive-by edit on untouched prose.

**Step 5 the loop did not have.** The guideline carries a fifth step the draft
could not know: **re-verify at adoption when the pin has aged.** It is not
invented — it is what adopting these very roadmaps 81 commits past their pin
actually produced (one defect had fixed itself, one claim was wrong at the pin
too, three anchors had drifted, and one cross-roadmap conflict was invisible
until two drafts were read together).

**Falsifier.** The next symptom-loop run, followed with the codified steps,
produces a roadmap the maintainer rejects as duplicate or unfounded → the
codification failed to transfer the judgment; revert the section and record
what the text missed.

**Falsifier ledger.** Run 1 = `road-to-subagent-lifecycle-integrity` (the loop
that produced V1–V9). **Run 2** = `road-to-source-first-frontend`, **run 3** =
`road-to-design-system-onramp` — both produced by the same loop before it was
codified, both adopted rather than rejected, and adoption re-verification found
32 of 36 repo claims still true across all three. That is three data points for
"the loop transfers", not one; the falsifier now needs a *rejected* run to fire.

**Rollback.** One skill section.

## Phase 3: Upstream watchlist — a re-check step, gated on Phase 2 surviving

- [x] **Step 1:** A pinned list `agents/settings/contexts/upstream-watchlist.md`
      *(proposal)* of **everything this tree pins upstream** whose status changes
      AC's own design — program X5 widened the scope from host issues alone, and
      each entry carries `kind: host-issue | vendored-corpus | consumed-tool`.
      Seeded with: #58109 (return truncation — Phase 2 of the sibling roadmap
      leans on its status), #20221 (prompt-hook non-blocking), #55754
      (stop-gate loop), #68619 (recursive spawn) — plus the `vendored-corpus`
      entry that proves the widening was necessary (the uupm pin drifted
      `b7e3af80` → `97eb2a20` unnoticed for two months) and the `consumed-tool`
      entries the design-system survey named. Each entry: one line on what in
      this tree depends on it.
- [x] **Step 2:** One re-check step in the release-review procedure: walk the
      watchlist, note status changes, open or close the dependent items.
      *(Proposal only — whether it becomes a 13th scoring dimension or a
      pre-flight checklist line is the maintainer's call, not this roadmap's.)*
      <!-- done: docs/release-runbook.md § 1 Pre-flight, one checklist line.
      Chose the pre-flight line over a 13th scoring dimension: the walk is a
      binary "did anything move", not something that scores on a scale, and a
      dimension would have to invent a rubric the walk does not have. The line
      carries the falsifier inline so a reviewer who sees it change nothing twice
      knows what to do. -->

      Phase 3 was gated on Phase 2 surviving; it did — Phase 2 landed above with
      its procedure in a guideline rather than the skill body, which is the
      pre-registered fallback, not a scope reduction.

**Falsifier.** Two consecutive release reviews where the walk changes nothing
→ the watchlist is ceremony; fold it into the sibling roadmap's own files and
delete the standalone.

**Rollback.** One context file, one procedure line.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-12 | reviewer: claude/host -->
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | An instrument nobody feeds | product | The estate already has exactly this failure in `docs/install-friction-report.md`, which has read `status: template — awaiting sessions (no real data yet)` across every release review since it was created. A symptom directory that collects three backfilled entries and nothing else is the same artifact with a different name, and it will read as coverage while measuring nothing | Phase 1's falsifier is pre-registered and deletes the directory plus the lint after two release cycles with zero entries beyond the backfill; the backfill itself is excluded from the count so it cannot mask the null | Phase 1 |
| 2 | A 130th lint script guarding a three-file directory | implementation | The tree already carries 129 `lint_*` scripts, and each one is a permanent CI surface with its own registration, test, and maintenance cost. A dedicated staleness linter for a directory that may never exceed three files inverts the cost/benefit the solution-minimalism lens exists to protect | Step 2 is scoped to a warning, never an error, and the extend-before-create question is answered explicitly against the existing freshness gates before a new file is written; the Phase-1 falsifier removes the lint together with the directory | Phase 1 Step 2 |
| 3 | The roadmap-writing skill grows past what a reader loads | implementation | `src/skills/roadmap-writing/SKILL.md` is already 400 lines. Adding a full loop procedure inline risks pushing a routinely-loaded skill past its budget, at which point the new section is paid for on every roadmap authoring turn whether the loop is in play or not | Phase 2 ships the section condensed and measures the file against the token-budget band in the same change; if it does not fit, the procedure moves to a guideline and the skill carries a pointer, which is the established split in this tree | Phase 2 |
| 4 | The watchlist walk becomes ceremony | product | A recurring checklist line that changes nothing is worse than no line: it consumes release-review attention and trains the reviewer to skip it, which then hides the one walk that would have mattered | Phase 3 is gated on Phase 2 surviving, and its own falsifier folds the watchlist into the sibling roadmaps and deletes the standalone after two consecutive reviews where the walk changes nothing | Phase 3 |

## Non-goals

- No automation of the loop (no cron, no bot filing symptoms) — intake is
  human-reported by design; automating it would flood the lint.
- No metrics dashboard, no symptom SLA — the 30-day lint is the entire
  freshness mechanism.
- No repurposing of `install-friction-report.md` — different population,
  different question; its template-only status is tracked where it is tracked.
