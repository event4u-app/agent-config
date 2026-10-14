---
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Carries a red that is already live on main and has nobody: the Host Docs Digest Watch has reported four drifted vendor pages on 2026-10-05 and 2026-10-12 with no row re-established. There is nothing to offset — no active roadmap owns host_lowering.yaml's provenance rows, and the alternative to this file is a PR-body line, which fix-what-you-see names as not a disposition. It ships `status: draft`, so it is excluded from the gated active_roadmaps count; this exemption covers the growth half only."
relates:
  - slug: road-to-a-search-answer-a-model-can-choose-from
    relation: extends
    note: "That roadmap's 0.2 added the sibling page list and ran the watcher's fetch path to fill its digest. The same run surfaced the four drifted rows below, which belong to the LOWERING table and were out of its scope: re-establishing one is a plumbing edit carrying a ratification artifact. Split out rather than absorbed."
---
# Road to re-establishing four drifted vendor pages

> **Source:** `check_host_docs_digest --fetch` run on 2026-10-13 at
> `main@c107aaf0f`, while executing
> `road-to-a-search-answer-a-model-can-choose-from` 0.2. Four rows of
> `src/scripts/hooks/host_lowering.yaml` reported `changed`. The scheduled
> `Host Docs Digest Watch` workflow has reported the same red on `main` on
> 2026-10-05 and 2026-10-12 — two consecutive weeks with no row
> re-established, which is what makes this a tracked item rather than a
> notification that is already working.

## Goal

The four lowering rows whose cited pages moved are re-established by hand
against the pages as they now read: `docs_at` on the day somebody read them,
`docs_digest` on the body that reading hashed, and `expires` moved FORWARD
again. The weekly watcher returns to green for a reason — the rows are current
— and not because the watcher was narrowed. Whatever the re-read finds about
each host's actual refusal contract is recorded as a finding, including
"nothing changed that this tree depends on".

## Context — the four rows, with their evidence

Every pair below is the watcher's own output, verbatim, on 2026-10-13. `was`
is the digest the committed row records; `now` is what the page hashes to.

| host | page | was | now |
|---|---|---|---|
| `claude` | `code.claude.com/docs/en/hooks.md` | `9dd68316…fe88` | re-fetch to read |
| `augment` | `docs.augmentcode.com/cli/hooks.md` | `e500823b…98fa` | `93f421dc…5378` |
| `cline` | `docs.cline.bot/customization/hooks.md` | `ef875617…084b` | `73b6df1b…37c2` |
| `windsurf` | `docs.devin.ai/desktop/cascade/hooks.md` | `460ffe7a…35a2` | `b9e0cd47…1170` |

`cursor`, `gemini`, `copilot` and `codex` were unchanged in the same run;
`cowork` cites no page. The digests are abbreviated here deliberately — a
64-character hash copied by hand into prose is a hash nobody re-derives, and
the authoritative pair is whatever the re-fetch prints on the day the row is
re-established.

**A changed digest is evidence the page MOVED, never a reading of what it now
says.** That is the watcher's own contract and it is the reason this roadmap
exists as a reading task rather than an update task: nothing here may adopt
upstream text.

## Phase 1 — Read the four pages and re-establish their rows

- [ ] **1.1 Re-read each of the four pages and record what changed about the
      refusal contract.** For each host: what the page now says about blocking
      a tool call, which exit code it names, and whether that contradicts the
      row's committed `block_exit`. A row whose contract did NOT change is a
      first-class outcome and is written down as one — the digest moved because
      a vendor edited a page, which is usually not about this tree at all.
      verify: `./scripts-run src/scripts/check_host_docs_digest --fetch` -> 0
- [ ] **1.2 Re-establish the four rows by hand, with the ratification artifact
      the table requires.** `docs_at` to the day of the read, `docs_digest` to
      the body that read hashed, `expires` moved FORWARD. Nothing moves
      `expires` forward automatically, so a row left half-fixed stays red in
      `lint_hook_manifest`. `host_lowering.yaml` is on `check_kernel_edit_ratified`'s
      plumbing list: the edit carries a ratification artifact whose
      `reviewed_by` differs from `proposed_by` and `implemented_by`.
      verify: `./scripts-run src/scripts/compile_hook_manifest --table host-lowering` -> 0
- [ ] **1.3 Say whether the two-week silence was a process gap or a reading
      gap.** The watcher fired correctly, weekly, twice. Either nobody was
      looking at that job, or looking at it did not lead anywhere. Name which,
      in one line, and change the one thing that makes the next occurrence
      land — a pointer, an owner, or nothing with a stated reason.
      verify: `grep -c 'Host Docs Digest Watch' .github/workflows/host-docs-digest.yml` -> /^[1-9]/

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-13 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The re-read adopts upstream text instead of reading it | product | A page is re-read under time pressure and its new wording is copied into the row's slots, turning a vendor's edit into this tree's claim without anybody deciding | 1.1 separates the READING from the row edit and requires a per-host finding first; the ratification artifact in 1.2 puts a second pair of eyes on whatever the reading concluded | Phase 1 — Read the four pages and re-establish their rows |
| 2 | A row is half-fixed and stays red | implementation | `--fetch --write` pulls `expires` BACK on drift and nothing moves it forward; a run that writes and stops leaves the row stale and the gate red for a different reason than it started | 1.2 names all three fields explicitly and its verify recompiles the sibling, which is hashed over the YAML text and fails on a partial edit | Phase 1 — Read the four pages and re-establish their rows |
| 3 | The digests move again before the rows land | implementation | Vendor pages are edited on their own schedule; a digest read today can be stale by the time the ratification artifact clears | The authoritative pair is whatever the re-fetch prints on the DAY the row is re-established, which is why the Context abbreviates its hashes instead of pinning them | Phase 1 — Read the four pages and re-establish their rows |

## Acceptance Criteria

- [ ] AC-1 — `check_host_docs_digest --fetch` exits 0 over the committed
      lowering table because all four rows carry a current digest and a
      forward `expires`, not because any row was removed, narrowed or
      exempted.
- [ ] AC-2 — Each of the four re-reads has a recorded finding, including the
      rows where nothing this tree depends on changed, and no row's slots were
      edited without one.
- [ ] AC-3 — The plumbing edit carries a ratification artifact whose
      `reviewed_by` differs from both `proposed_by` and `implemented_by`.
