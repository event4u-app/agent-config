<!-- evidence-type: analysis -->

# An owner search in the exemption: keep the policy, report before refusing

AI council, 2026-10-16. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present after the run, `$0.00` (both seats subscription-authed), prompt
mode `design`. The prompt is committed verbatim beside this file as
`intake-exemption-search-2026-10-16.question.md`. Raw response:
`agents/runtime/council/responses/intake-exemption-search-2026-10-16.md`
(local, gitignored). For `road-to-an-intake-the-queue-can-carry` step 2.1.

## Verdict

- **anthropic — do not land as written.** The predicate is *"simultaneously too
  loose (accepts disconnected prose) and too strict"*. Land instead: proximity
  between verb, scope and result; a quoted search pattern or `roadmap:context`;
  a decided archive scope; report-only enforcement, measured, then blocking.
- **openai — land with changes, but do not enable the blocking gate as
  written.** *"Preserve the search-before-create policy, but replace the
  disconnected prose predicate, resolve positive-result and archive semantics,
  and stage enforcement with explicit rollback criteria."*

Neither seat accepted a blocking gate on the first predicate. Both kept the
policy.

## Agreed by both seats, and what the change now does

1. **Three independent regex tests accept a non-search.** Both quoted
   `grep was considered; agents/roadmaps contains plans; another check returned
   0 hits`. → All four parts must now sit in one clause (split on `;` and on a
   sentence-ending period); that string is a pinned negative test.
2. **The query is not required.** `rg agents/roadmaps returned 0 hits` passed.
   → A quoted pattern or `for <identifiers>` is required (`roadmap:context`
   carries its own).
3. **Scope completeness is undecided, archive included.** → The scope must be
   the whole roadmap tree (its root, `/*`, or a brace set naming `later` and
   `stubs`); one subdirectory alone does not pass. Archive is not an owner of a
   new arrival — an archived file lands nothing, the same rule Phase 1 of the
   roadmap added to `depends`.
4. **Report-only first.** → `unsearched` is a warning the estate gate prints
   and never fails on; the blocking findings (`shapeless`, `duplicate`) are
   unchanged.

## Raised by one seat and adopted

- **openai: a positive result contradicts the workflow.** `→ 2 files` passed,
  though a found owner means landing on it. → Only an empty result passes, or
  `only <named non-owners>` ("returns only archived files"). The bare-arrow
  form (`-> pending` passed) is gone.

## Raised and not adopted, with the reason

- **openai: a structured record (query, scope, revision, count, paths) and a
  CI-executed search.** Not built: it is a new frontmatter format and a gate
  that runs searches, and the roadmap's K5 keeps ledgers in Markdown. The
  objection behind it — *"using author-controlled prose as the blocking CI
  representation of provenance"* — is why this reports and does not refuse.
- **openai: two branches can each search an empty tree and add a file.** Real,
  and not closed by a self-reported search; recorded as a known gap.
- **openai: a warning-only kill switch with an owner and an expiry.** The
  check ships warning-only, so there is nothing to switch off; the flip to
  blocking is the open half of step 2.1.
- **anthropic: support `fd | awk` and `git log -S`.** openai disagreed (history
  is a different search); not adopted.

## Measured after the change

The stricter predicate over the tree (active, `later/`, `stubs/`, `archive/`):
23 of 296 exemption reasons pass, 15 of 34 among active files (the first
predicate passed 26 and 18). Only added files are judged, so none of them
turns into a warning retroactively.

## What closes step 2.1

Blocking is enabled only after a report-only window shows, on real additions,
how many warnings were legitimate refusals and how many were false; Phase 6 of
the roadmap reads that window. Until then step 2.1 stays open.
