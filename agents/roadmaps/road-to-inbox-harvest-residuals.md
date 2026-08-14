---
complexity: lightweight
status: ready
---

# Road to the inbox-harvest residuals — four deferrals that outlived their parent

> **Source:** `road-to-inbox-harvest-2026-08.md`, closed and archived 2026-08-14
> with all steps disposed. Four items were deferred `[~]` there rather than
> done or cancelled. The maintainer disposed them on 2026-08-14 by migrating
> them here (option 1 of the Iron Law 3 deferral menu), so the parent could
> archive without burying them.
>
> **Nothing here is new work proposed by an agent.** Every item below is
> carried over with the reasoning that deferred it, because in each case that
> reasoning is the useful part — three of the four are deferred for a *stated
> structural reason*, not for lack of time, and re-deriving those reasons is
> what this file exists to prevent.

## Goal

Each of the four residuals reaches a terminal state — done, cancelled against a
named lock, or reopened on a trigger that has actually fired. None of them is
urgent, and this roadmap deliberately asserts no deadline: it exists so the
items stay visible on the dashboard instead of dissolving into an archived
parent.

## Phase 1 — The four residuals

- [ ] **R1 JSON as the binding R1/R2 findings format — the rendering half.**
      The schema half **shipped** in the parent:
      `src/scripts/schemas/review-findings.schema.json` exists, and it is
      deliberately the shape that already existed on the other track
      (`self_review_gate`'s `{schema_version, findings[]}` with the sha256
      `findingId()`), so there is one format rather than two — which was the
      reviewers' actual complaint.

      **What is deferred, and why it is not simply "finish it":** the acceptance
      clause reads *"Markdown becomes a rendering of the JSON"*. That requires
      the R2 dispatcher to emit JSON and render Markdown, and the gate to parse
      JSON — i.e. re-formatting every committed artefact under
      `agents/evidence/reviews/`. **§ 2.7 of the completion-review contract
      forbids editing a round record in place**, so the clause as written demands
      exactly the corpus migration the contract prohibits.
      **Reopen only with a migration story for the committed corpus.**

      **Do not "tidy" the schema.** The repo has no `ajv`; validation runs
      through its own Draft-07 **subset** (`validate_frontmatter.ts`), which
      enforces `enum` at top level and under `items` but **silently ignores
      `$ref` and `const`**. The item shape is therefore INLINED and the version
      pin is a one-member `enum`. Written the obvious way — `const: 1` plus a
      `$ref`-ed definition — the schema would validate **nothing at all**, which
      is the gate-that-scans-nothing class this package keeps finding. Two tests
      pin the spellings.

- [ ] **R2 Deferred-finding owner + expiry.** Blocked — see
      `blocker: deferred-finding-decision-reopen`. This needs a stable-finding-id
      index that was **explicitly declined** in-source at
      `src/scripts/check_review_dispositions.ts:16-22`, on measured grounds: the
      declined design assumed dispositions live *outside* the round records, and
      measured across the corpus they do not — records are terminal in place. An
      index would be a second artefact to keep in sync, i.e. a new drift source,
      guarding a failure mode that has not occurred.

      **The named revisit trigger is precise and has NOT fired:** *"a disposition
      that genuinely cannot be recorded in the round record itself."* Recorded
      here so the next reader checks the trigger against reality before building
      the index — the blanket grant of 2026-08-14 released the *permission* to
      reopen, and no authorization creates the case the trigger names.

- [ ] **R3 Level A/B/C snapshot preference order** into `design-system-capture`.
      Carried from `claude-design.txt` as the one genuinely new idea in it, and
      independent of any bridge. Deferred with the plainest of the four reasons:
      **worth doing, not urgent.** No structural obstacle is recorded against it,
      which makes it the only one of the four that is simply unscheduled — and
      therefore the first candidate when capacity appears.

- [ ] **R4 God-file LOC ratchet.** Carried from `crytical-analysis.txt`. Seven
      files confirmed oversized, plus `chat_history.ts` (2397) and
      `orchestrator.ts` (2106), with no ratchet and no roadmap.
      **Deliberately ratchet-before-split**, and that ordering is the decision,
      not an implementation detail: splitting first is how a refactor becomes
      unreviewable. A ratchet freezes the numbers where they are and makes every
      later split a lowering commit; a split without one is a large diff with
      nothing asserting it improved anything.

**Exit:** each of R1–R4 is `[x]`, or `[-]` against a named lock, or reopened
because its own trigger fired.
**Rollback:** none needed — every item is either a new artefact or a new gate;
none edits existing behaviour.

## Blockers

### blocker: deferred-finding-decision-reopen

- **Status:** open
- **Owner:** maintainer
- **Blocks:** R2 only
- **What to do:** R2 needs a stable-finding-id index that was explicitly declined
  at `src/scripts/check_review_dispositions.ts:16-22` with a named revisit
  trigger. Reopening a recorded decision is a maintainer call under
  `decision-revisit-gate`, not something an agent does because a reviewer asked.
  **Migrated from `road-to-inbox-harvest-2026-08` on 2026-08-14** when that
  roadmap archived; the blocker is unchanged, only its home is.

  **The 2026-08-14 blanket grant approved reopening, and that is not sufficient
  on its own** — recorded here because it is the trap. `decision-revisit-gate`'s
  first step is a mechanism-match check, and this decline names a specific
  falsifiable trigger: *a disposition that genuinely cannot be recorded in the
  round record itself.* No such case is on record. A grant releases the
  permission to revisit; it does not supply the evidence the trigger asks for.
  So the honest branch today is **cancel R2 against the decline** — which the
  Resolved-when already allows — and let it reopen by itself the day the trigger
  fires.
- **Resolved when:** the decision is reopened with the trigger cited (i.e. a real
  case exists), or R2 is cancelled against it.

### blocker: spent-inbox-artifacts-await-deletion

- **Status:** open
- **Owner:** maintainer
- **Blocks:** nothing — pure housekeeping, carried so it is not lost
- **What to do:** four spent items under `agents/tmp.old/` should be removed:
  both `council-q-*.md` files (answered and shipped verbatim), `bench-local/`
  (null published, roadmap archived), and the byte-identical `(1).md` duplicate
  plus `chat.txt` inside `memory-mcp/`.

  **Migrated from `road-to-inbox-harvest-2026-08` on 2026-08-14, and NOT executed
  under the blanket grant, for a reason found while trying to execute it.** The
  grant did approve these deletions. Two facts stopped it:

  1. **The description does not name its objects.** It says *"both
     `council-q-*.md` files"*, but that glob matches **12 files** in
     `agents/tmp.old/` (`ls council-q-*.md | wc -l`, measured 2026-08-14 — the
     9 sibling `council-question-*.md` files do *not* match, since the glob
     requires `council-q-`). Which two were meant is not recoverable from the
     text. `non-destructive-by-default` requires an approval to name its exact
     object, and "both" against a 12-match glob names none of them — acting on
     the glob would delete 10 files nobody approved.
  2. **`agents/tmp.old/` is gitignored and does not follow a worktree.** It is
     empty in every worktree and populated only in the main checkout, so a
     deletion made here would be invisible and a deletion made there would not
     appear in any diff a reviewer reads. Same per-checkout class as the audit
     log the parent's sweep report recorded.

  So the item needs the two filenames, not a broader authorization.
- **Resolved when:** the files are deleted **by name**, or a reason to keep them
  is recorded.
- **Side finding, worth its own look and deliberately not folded in:**
  `check_council_layout` prints these as findings and **exits 0** — an advisory
  gate nobody sees, currently carrying ~18 permanent findings, which is the
  allowlist-fatigue shape this repo's own rules warn about.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-14 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | R1 is "finished" by migrating the committed review corpus | implementation | The acceptance clause reads as a small formatting change, but delivering it literally means rewriting every artefact under `agents/evidence/reviews/` — which § 2.7 of the completion-review contract forbids outright. A reader who skips the deferral reason will do the forbidden thing and it will look like progress | The prohibition and the required precondition (a migration story for the committed corpus) are stated in the step itself, not only in the parent's archived history | Phase 1 |
| 2 | The R1 schema is "tidied" into validating nothing | implementation | The schema's inlined item shape and one-member `enum` look like mistakes; rewriting them as `$ref` + `const` is the natural cleanup and would silently disarm the gate, because the repo's Draft-07 subset ignores both keywords | Two tests pin the spellings, and the step states the reason the schema looks wrong | Phase 1 |
| 3 | R2's index is built because a grant said "reopen approved" | product | The declined design is measured, and its revisit trigger names a case that has not occurred. Building the index on an authorization alone adds a second artefact to keep in sync — a new drift source guarding a failure mode with no instances | The blocker states the mechanism-match check explicitly and names cancellation as the honest branch today | Phase 1 |
| 4 | The spent-artifact deletion is executed against the glob | implementation | "Both `council-q-*.md` files" matches 12 files; acting on the pattern deletes 10 unapproved ones, in a gitignored directory where no diff would show it | The blocker records the measured match count, the per-checkout visibility problem, and requires the two filenames before any deletion | Blockers |

## Provenance

Migrated 2026-08-14 from `road-to-inbox-harvest-2026-08.md` (archived the same
day at 100 %) under the maintainer's Iron Law 3 deferral disposition — option 1,
"migrate all four to one successor roadmap". The parent's own council pass,
measurements and cancellations stay in its archived record; only the four
undisposed items and the two blockers that outlived it moved here.
