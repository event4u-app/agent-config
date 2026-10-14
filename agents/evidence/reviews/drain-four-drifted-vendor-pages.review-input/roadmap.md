<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Carries a red that is already live on main and has nobody: the Host Docs Digest Watch has reported four drifted vendor pages on 2026-10-05 and 2026-10-12 with no row re-established. There is nothing to offset — no active roadmap owns host_lowering.yaml's provenance rows, and the alternative to this file is a PR-body line, which fix-what-you-see names as not a disposition. It ships `status: draft`, so it is excluded from the gated active_roadmaps count; this exemption covers the growth half only."
relates:
  - slug: road-to-a-search-answer-a-model-can-choose-from
    relation: extends
    note: "That roadmap's 0.2 added the sibling page list and ran the watcher's fetch path to fill its digest. The same run surfaced the four drifted rows below, which belong to the LOWERING table and were out of its scope: re-establishing one is a plumbing edit carrying a ratification artifact. Split out rather than absorbed."
---
# Road to re-establishing four drifted vendor pages

> **Source:** [REDACTED:src-conf]
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

**Correction, 2026-10-14 — it was six, not four.** The re-fetch on the day
the rows were re-established (`main@55782c253`) reported two more pages moved
since 2026-10-13: the `codex` lowering row
(`developers.openai.com/codex/hooks.md`, `724881d8…c630` → `57166ef0…5f92`)
and the sibling page row `claude-code-skills` in `host_docs_pages.yaml`
(`code.claude.com/docs/en/skills.md`, `35fd2c11…602a` → `3f53e70c…4764`).
AC-1 asks for `--fetch` to exit 0, which it cannot do with either left red,
so both are read and re-established here under the same terms. The title
keeps "four" because it names the item as it was opened.

## Findings — the 2026-10-14 re-read

Each body was fetched once on 2026-10-14 and its sha256 matched what
`check_host_docs_digest --fetch` printed the same day. Every finding below is
a reading, not an adoption: no `block_exit`, `native` or `answered_at` value
was changed, because none of the six readings contradicts a committed one.

| row | what the page says now about refusing | committed row | finding |
|---|---|---|---|
| `claude` | exit 2 blocks `PreToolUse`, `UserPromptSubmit`, `Stop`, `SubagentStop`, `PreCompact`; not `PostToolUse`, `SessionStart`, `SessionEnd`, `SubagentStart` | `block_exit: 2` on `stop`, `user_prompt_submit`, `pre_tool_use`; null elsewhere | No contradiction. The three committed 2s are still documented. `pre_compact` and `subagent_stop` are documented as blockable and stay null: null means this package has not established a refusal there, and arming them is an enforcement change, not a dating pass. All nine bound events are still documented. |
| `augment` | "Exit code 2: Blocking error - Prevents tool execution (PreToolUse only)"; the same five events | `block_exit: null` everywhere, `fail_policy: discard` | Unchanged. The row's own finding (the host documents a refusal, the trampoline discards every verdict) still holds word for word. |
| `cline` | the page is still a one-line pointer to the SDK plugins page; the body gained an index header | five slots bound to events the page does not name | Unchanged. The digest moved on a header, not on content; the row's comment about the missing event names still describes the page exactly. |
| `windsurf` | exit 2 blocks the pre-hooks only, `pre_user_prompt` among them; post-hooks cannot block | `post_setup_worktree`, `pre_user_prompt`, `post_cascade_response`, all null | No contradiction. All three bound events are still documented. `pre_user_prompt` is documented as blockable and stays null for the same reason as claude's two. |
| `codex` | the twelve events and the exit 2 + `decision: "block"` contract are still documented | `slots: {}`, the 2026-10-01 live probe that did not reproduce the deny | Unchanged. The page still describes the contract the probe failed to reproduce; the probe finding is the row's evidence and a docs read cannot overturn it. |
| `pages/claude-code-skills` | budget at 1% of the context window, each entry capped at 1,536 characters, descriptions dropped least-invoked first, every name kept | the four numbers `_lib/host_listing_model.ts` reads off this page | The four modelled facts still hold. One citation did NOT: the page no longer prints the "≈8,000 characters on 200k" illustration the `budget-unit-is-chars` assumption quoted as present. That assumption's text and the file header now date the illustration to the 2026-08-22 reading instead of asserting it of the current page. The page also names two settings this tree does not model (`skillListingMaxDescChars`, `SLASH_COMMAND_TOOL_CHAR_BUDGET`); neither changes a default the model uses. |

**`expires` and `answered_at`.** Every re-dated row's `expires` moved forward
to `docs_at` + 1 year, 2027-10-14, the table's stated policy — except
`claude`, which keeps its committed 2027-09-06 because the table header
records that value as predating the policy and it is still in the future;
moving it would have been a second decision riding on a dating pass.
`answered_at` stays 2026-09-29 on every slot: no slot's answer changed, so no
slot was re-answered, and the generated enforcement table that prints that
column stays byte-identical.

**Ratification.** `agents/evidence/ratifications/drain-four-drifted-vendor-pages.md`,
four council rounds on 2026-10-14 (anthropic + openai, CLI, $0), final
`ratified` from both seats. Round 1 found a stale "read on 2026-09-29" comment
above a re-dated row; answering round 2 surfaced a stale install bundle over the
`host_listing_model.ts` string. Both were fixed in their own commits before the
final round.

## The two-week silence — a process gap

**Process gap: the red had no route to anyone who acts.** GitHub mails a
scheduled failure only to whoever last edited the cron line; the job writes
nothing, and nothing an agent session reads lists scheduled-workflow outcomes.
The council (2026-10-14, two rounds, anthropic + openai) agreed on that line and,
in round 2, on the one change: a scheduled red now opens one issue under a fixed
title in `host-docs-digest.yml`, or comments on it while it stays open, with
`issues: write` granted to that job only. `tests/scripts/host_docs_digest_workflow.test.ts`
pins the route, the schedule-only condition, the job-scoped grant and the
no-`--write` bound; it was seen red with the step absent.

Both seats named the same limit: an issue is a route, not an owner, and a route
nobody reads is the same silence elsewhere. Who triages it is the maintainer's
decision and is not taken here. The same gap is open on the other 13 scheduled
workflows; that is recorded in `agents/roadmaps/stubs/road-to-scheduled-reds-that-reach-someone.md`
rather than special-cased file by file.

## Phase 1 — Read the four pages and re-establish their rows

- [x] **1.1 Re-read each of the four pages and record what changed about the
      refusal contract.** For each host: what the page now says about blocking
      a tool call, which exit code it names, and whether that contradicts the
      row's committed `block_exit`. A row whose contract did NOT change is a
      first-class outcome and is written down as one — the digest moved because
      a vendor edited a page, which is usually not about this tree at all.
      verify: `./scripts-run src/scripts/check_host_docs_digest --fetch` -> 0
- [x] **1.2 Re-establish the four rows by hand, with the ratification artifact
      the table requires.** `docs_at` to the day of the read, `docs_digest` to
      the body that read hashed, `expires` moved FORWARD. Nothing moves
      `expires` forward automatically, so a row left half-fixed stays red in
      `lint_hook_manifest`. `host_lowering.yaml` is on `check_kernel_edit_ratified`'s
      plumbing list: the edit carries a ratification artifact whose
      `reviewed_by` differs from `proposed_by` and `implemented_by`.
      verify: `./scripts-run src/scripts/compile_hook_manifest --table host-lowering` -> 0
- [x] **1.3 Say whether the two-week silence was a process gap or a reading
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

- [x] AC-1 — `check_host_docs_digest --fetch` exits 0 over the committed
      lowering table because all four rows carry a current digest and a
      forward `expires`, not because any row was removed, narrowed or
      exempted.
- [x] AC-2 — Each of the four re-reads has a recorded finding, including the
      rows where nothing this tree depends on changed, and no row's slots were
      edited without one.
- [x] AC-3 — The plumbing edit carries a ratification artifact whose
      `reviewed_by` differs from both `proposed_by` and `implemented_by`.
