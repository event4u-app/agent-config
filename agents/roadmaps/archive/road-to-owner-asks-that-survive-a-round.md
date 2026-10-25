---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-ak. Searched the whole roadmap tree (agents/roadmaps/*.md, later/, stubs/) for star_ask, star prompt, owner-directives and human_directed: the only hit owning the subject is road-to-an-update-that-installs-itself-only-when-it-is-safe, which records the star prompt as CUT and owns the update channel, not the ask; no roadmap owns the ADR owner-attribution defect. This file is opened, executed and archived in the same change, so the active count returns to its floor when the PR lands."
estate_growth_exempt: "Same change as its own archival: one active roadmap in, the same one archived, net zero on active_roadmaps; no blocker is added."
relates:
  - slug: road-to-an-update-that-installs-itself-only-when-it-is-safe
    relation: disjoint
    note: shares only the claude user channel; its CUT row for the star prompt is corrected in 1.1
---
# Road to owner asks that survive a round

> **Source:** `agents/tmp.old/inbox-2026-10-ak/` — a chat transcript in which the
> owner learns his star ask was refused in his name, an agent-written change
> specification, and an implementation patch. Codename only; the source is not
> recorded elsewhere.

## Goal

The monthly GitHub-star ask the owner requested on 2026-10-16 ships to claude
users, stoppable by the user's own word, with no network call and no identity
read. And the mechanism that refused it in his name is closed for the next
case: a newly added ADR that says the owner decided must point at the owner's
own recorded words, and an analysis round may no longer discharge an owner's
demand as `declined` or fold it into an option the owner did not pick for it.

## Point ledger (round inbox-2026-10-ak)

Three files, one source set. Anchors: transcript 4 separators / 2 user turns;
spec 4 headings, 7 invariants, 8 sequence steps, 6 ACs; patch 18 files.

| Id | Point | Source | Disposition |
|---|---|---|---|
| T-U1 | "ac soll doch user um einen stern bitten — warum passiert das nicht?" | chat.txt:7 | answered by T-C1 |
| T-U2 | Reopen and implement the star ask; the round closed it in my name | chat.txt:73 | **adopted** → Phase 1 |
| T-U3 | The mechanism that closed it is wrong ("Bullshit Mechanismus") | chat.txt:73 | **adopted** → Phase 2 |
| T-C1 | ADR-286 § D2 refused the ask; ADR records it as an owner ruling | chat.txt:17-19 | still-true (ADR-286:120-130, :277-279) |
| T-C2 | The star ask was bundled into option 1 (adoption in full) the owner rejected | ADR-286:56-67, :213-217 | still-true — the defect Phase 2 closes |
| S-B1 | Cadence ≤ 3 per rolling year, first after 5 tasks / 3 days | spec:20-21 | **declined** — agent proposal; the owner's own cadence is "monthly until starred" (ADR-286:84), settled as D1 |
| S-B2 | CLI verbs `star-reminder status/dismiss/already-starred/enable` | spec:24 | **declined** — `agent-config settings:set star_ask.starred true` / `star_ask.mode off` cover it without a new verb surface |
| S-B3 | No network, no identity, local state only, no LLM call, no CI | spec:23-28 | already-satisfied by the patch (star_ask_hook.ts) |
| S-C1 | Owner-claimed ADR must trace to explicit owner approval | spec:37 | **adopted** → 2.1 |
| S-C2 | A council / round may not convert a recommendation into an owner disposition | spec:36,40 | **adopted** → 2.2 |
| S-C3 | Regression fixture reconstructing the 2026-10-16 reversal | spec:46 | **adopted** → 2.1 |
| S-C4 | Full ten-field directive ledger with CI transition detection | spec:32,39 | **declined** — `agents/evidence/owner-directives/` already is that ledger (one dated file per directive); 2.1 makes it load-bearing for ADRs; a parallel ledger is ceremony the 2026-10-24 throughput directive cut |
| P-1 | Patch: `star-ask` concern, ADR-301, settings, admission row | patch | **adopted** → 1.1 with one correction (1.2) |

## Decisions

| Id | Decision | Why |
|---|---|---|
| D1 | Cadence is the owner's: first after 7 days, then ≤ 1 per 30 days, until `star_ask.starred: true` | Owner's own wording "monthly until starred"; the 3-per-year cap was an agent's proposal in both rounds |
| D2 | One roadmap, opened and archived in one PR | WIP is at its cap of 5; net zero |

## Phase 1 — The star ask ships

- [x] **1.1 Apply the inbox patch onto current main.** `git apply --3way` of the
      round's patch: `star-ask` concern, ADR-301, settings keys, admission row,
      ADR-286 amendment note, update-roadmap CUT row corrected.
      verify: `npx vitest run tests/scripts/star_ask_hook.test.ts tests/scripts/lint_hook_manifest.test.ts` -> 0
- [x] **1.2 Quote the owner verbatim.** The owner-directive file claims a
      verbatim quote but carries a spelling-corrected one; replace it with the
      exact text of chat turn 73.
      verify: `grep -cF 'Dass ging bei allen' agents/evidence/owner-directives/2026-10-25-star-ask.md` -> /^1$/
- [x] **1.3 Correct ADR-286's history.** Add a 2026-10-25 History line: the
      owner's option choice on 2026-10-16 was a choice between bundles, not a
      ruling on the star ask, and ADR-301 records his ruling on it.
      verify: `./scripts-run src/scripts/check_adr_frontmatter` -> 0

## Phase 2 — An owner's ask cannot be closed in his name

- [x] **2.1 New owner-claimed ADRs cite the owner's words.** In
      `check_new_adr_evidence`, an added accepted record whose provenance says
      `human_directed: true` or lists `owner` in `decision_makers` must name an
      existing `agents/evidence/owner-directives/*.md` file in `evidence.basis`.
      Regression case reconstructs 2026-10-16: an owner-claimed refusal with no
      directive file reds.
      verify: `./scripts-run src/scripts/check_new_adr_evidence --self-test` -> 0
- [x] **2.2 The inbox round may not decline an owner's demand.** In
      `/analyze:inbox` Phase 5b: a demand from the owner's own turn takes
      `adopted`, `already-satisfied` or `owner-decision` — never `declined` —
      and an owner-decision option never bundles one owner demand with other
      items.
      verify: `grep -c 'NEVER BUNDLES' src/domains/analysis-workbench/analyze/inbox/command.md` -> /^1$/

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-25 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Bundle budget | implementation | The new concern pushes the composed hook bundle over its ceiling on current main | Concern loads from its own lazy chunk; measured with `check_hook_bundle_composition` in 1.1 | Phase 1 — The star ask ships |
| 2 | Gate false red | implementation | 2.1 reds a legitimate owner ADR that cites the owner another way | Diff-scoped to added records only; remedy text names the directory | Phase 2 — An owner's ask cannot be closed in his name |
| 3 | Users annoyed | product | Up to twelve asks a year for a user who starred and never said so | Every ask states how to stop it; owner chose this over an identity lookup (ADR-301) | Phase 1 — The star ask ships |

## Acceptance Criteria

- [x] AC-1 — A claude session on a machine past its 7-day grace shows the star
      ask through the user channel, at most once per 30 days, and never again
      after `star_ask.starred: true`, with no network call.
      (tests/scripts/star_ask_hook.test.ts, incl. a real claude envelope)
- [x] AC-2 — A newly added accepted ADR claiming an owner decision without an
      owner-directive file in its basis fails `check_new_adr_evidence`.
      (unit tests + `--self-test` 9/9)
- [x] AC-3 — `/analyze:inbox` offers no `declined` discharge for an owner's own
      demand and forbids bundling it into a multi-item option.
