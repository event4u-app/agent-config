---
complexity: structural
status: later
review_by: 2026-12-21
entry_condition:
  what: "the owner rules on blocker goal-scope-hard-floor-reach, or later/road-to-typed-grants-that-persist lands ADR-268 §§ 2-3 in the kernel; Phase 4 is the only open work and needs one of the two"
  when: "on that ruling or that landing"
  who: "owner"
tree_pin: 811cea61d6
estate_growth_exempt: "Owner instruction of 2026-11-21 ('erstelle Roadmaps für die P0-Maßnahmen ... Lass uns alle Learnings einplanen und abarbeiten'), P0 measure 3 of the session retro of the same day. The two roadmaps that own the neighbouring work are parked in later/ and keep their scope; this file carries only the delta neither of them names (see relates). Growth: +1 active roadmap, +2 open blockers (goal-scope-hard-floor-reach, a Hard-Floor reach only the owner can rule on; goal-record-ratification, a split ratification verdict only the owner can resolve)."
estate_offset_exempt: "road-to-mandates-scoped-to-the-goal is added on the owner's order of 2026-11-21 to plan every measure of that day's session retro as its own roadmap. No active roadmap is finished, so none was archived to offset it, and folding it into a parked later/ roadmap would hold asked-for work behind that roadmap's entry condition. Owner record: agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md."
execution:
  mode: autonomous
relates:
  - slug: later/road-to-an-agent-the-owner-does-not-drive
    relation: extends
    note: "Its 1.1 names the goal-scoped mandate as a kernel amendment and its 0.1 a friction report. This file adds what 1.1 does not name — a generated, hook-written goal record that reaches later turns and subagents, the session PR as default target for PR commands, and a narrow re-ask counter — and hands its two metrics to that file's Phase 8 re-measure (5.1). It edits no kernel rule, so 1.1's kernel text stays owned there."
  - slug: later/road-to-typed-grants-that-persist
    relation: depends
    note: "Owns landing ADR-268 §§ 2-3 in the kernel rules (commit-policy one-shot retirement under a mission, the Hard-Floor push and prod-merge rows) and the delivery.pr_topology cascade. Phase 4 here waits on that landing or on this file's own owner blocker, whichever comes first; Phases 0-3 do not."
depends:
  - road-to-typed-grants-that-persist
---

# Road to mandates scoped to the goal

> **Source:** the owner's session retrospective of 2026-11-21 (about 380 Claude
> Code sessions across all profiles, 643 extracted incidents), pattern B
> ("questions and repeated permissions land on the owner", at least 12 chunks)
> and P0 measure 3 ("goal-scoped mandate as the default"). The same-day AI
> council round (analysis mode, one round, members anthropic and openai, both
> answered) rated measure 3 *ready for a roadmap* (anthropic) and *pilot it*
> (openai), and warned that two "1" answers in a row are weak evidence of a
> delegation. Drafted against `main@811cea61d6` on 2026-11-21.

## Goal

An owner sentence that names an end state — "bis zum merge", "mach PR und <!-- md-language-check: ignore -->
merge", "arbeite die roadmap ab", "until merged" — is recorded by a hook, <!-- md-language-check: ignore -->
verbatim, the moment it is typed, and every later turn and every subagent of
that session sees it. Commits, PR opens and updates, follow-up fix PRs, CI
waits and cleanup that serve that goal are taken without a re-ask. A PR command
run without a URL in a session that opened exactly one PR takes that PR and says
so in one line. A generated counter shows both re-ask kinds at their baseline
and, after landing, at their new level.

## Context

**What the retro measured.** In the galawork performance roadmap the owner
typed "erstelle den PR für X und mach mit Y weiter" about 25 times; a merge <!-- md-language-check: ignore -->
permission for a follow-up PR was re-asked despite a stored goal-scoped
mandate; and on 2026-11-10 `/fix:pr-comments-loop` asked for the URL of a PR
the same session had just opened (owner: "den den du hier erstellt hast"). The <!-- md-language-check: ignore -->
retro's causal reading: `commit-policy` and `scope-control` read a permission as
one-shot per operation, and the host-memory preference that says otherwise does
not reach subagents. The counts are a lower bound over a sample, not a rate
(council, openai); Phase 0 generates a reproducible baseline instead of
re-typing them.

**What the tree already says** (verified at `811cea61d6`):

| Fact | Where |
|---|---|
| "Create the PR" is spent on the first branch + commit + push + PR | `src/rules/commit-policy.md:34-42` |
| A standing instruction not yet revoked authorises commits | `src/rules/commit-policy.md:28`; `src/agent-src/contexts/authority/commit-mechanics.md:17` |
| Permission for one operation never carries to another | `src/rules/scope-control.md:36` |
| IL 4 mandate triggers list settings and roadmap commands, no goal sentence | `src/agent-src/contexts/execution/cheap-question-mechanics.md:19-27` |
| A roadmap contract grants one branch, one PR; merges always outside it | `src/agent-src/contexts/authority/scope-mechanics.md:61-84`; `src/agent-src/contexts/execution/roadmap-execution-contract.md:170,201-212` |
| Owner's own words in the session are the merge confirmation of a routine PR "for the run it starts" | `docs/decisions/ADR-282-auto-merge-authority-with-a-council-danger-gate.md:62-67` |
| A `/pr:merge` invocation never reaches a PR that arrived later | `src/domains/git/pr/merge/command.md:34-36` |
| Mission grants persist; the one-shot clause is retired under a mission — decided, not landed | `docs/decisions/ADR-268-mission-scoped-authority-persistence-and-ratified-self-amendment.md:154-173` |
| The loop requires a URL and forbids reusing an earlier PR number | `src/domains/engineering-base/fix/pr-comments-loop/command.md:31-33`; `src/domains/engineering-base/fix/pr-comments/command.md:35-42` |
| The session's own PRs are already recorded from `gh pr create` output and injected per prompt | `src/scripts/_lib/session_pr_watch.ts:1-26,101,160`; `src/scripts/pr_url_reminder_hook.ts:158`; `src/scripts/session_register_hook.ts:934` |
| A subagent-start concern exists that can carry a line into every subagent | `src/scripts/hook_manifest.json` (`claude.subagent_start` → `subagent-constraints`); `src/scripts/hooks/subagent_constraints_hook.ts` |
| `delivery.pr_topology` is read by no code yet | `src/agent-src/templates/roadmaps.md:284-291` |

**The delta.** The owner decision on mission scope exists (ADR-268, ADR-282);
its kernel landing is owned by `later/road-to-typed-grants-that-persist`, and
the goal-scope kernel amendment is also named in
`later/road-to-an-agent-the-owner-does-not-drive` 1.1. Neither names a carrier
that makes the owner's sentence visible to a later turn or a subagent, nor the
PR-target default. This file builds those carriers in the non-kernel layer
(hooks, commands, context files) and edits **no** kernel rule — so the
`kernel-rule-edits` soak and the ratification gate do not apply here. Every
reach into a Hard-Floor row (a push to another ref, the merge of a follow-up
PR that did not exist when the sentence was typed) waits on
`goal-scope-hard-floor-reach` below.

**Owner constraint, 2026-11-21:** no hand-maintained or owner-written context.
The goal record is written by a hook from the owner's own prompt; the baseline
is written by a script from transcripts; nothing here asks the owner to author
a file.

## Phase 0 — A baseline the repo generates

- [x] **0.1 Route the blocker before any build.** Run `agent-config <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/goal_phrases.ts -->
      council:status`; when CONFIGURED, put `goal-scope-hard-floor-reach` to the
      council with `decision-revisit-gate`'s owner-reserved table attached and a
      neutral prompt (the transition, the two ADR excerpts cited in Context, no
      expected verdict). Write the verdict into the blocker's `Routed:` field.
      verify: `grep -c 'Routed:\*\* council 20' agents/roadmaps/later/road-to-mandates-scoped-to-the-goal.md` -> /^1$/
      Done 2026-11-21: council `analysis`, two rounds, anthropic + openai, 2/2
      present, $0 (subscription seats). Both seats ESCALATE on the row "cannot
      be bounded from available evidence"; the verdict is in the blocker's
      `Routed:` field. One council run carried the four questions of 0.1, 2.1,
      3.1 and 3.3 as separate items.
- [x] **0.2 Failing test for the re-ask counter.** Write <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/goal_phrases.ts -->
      `tests/scripts/mandate_reask_report.test.ts` against fixture transcripts
      under `tests/fixtures/mandate-reask/`: (a) a goal sentence followed in a
      later user turn by "erstelle den PR" / "push it" / "merge it" counts one
      `reask_after_goal`; (b) a `gh pr create` result carrying a PR URL followed
      by an assistant turn asking for a PR URL counts one
      `pr_target_asked_after_create`; (c) the rendered output contains no
      substring of any fixture prompt.
      verify: `npx vitest run tests/scripts/mandate_reask_report.test.ts` -> 1 failing on the missing module.
      production entry: src/scripts/mandate_reask_report.ts
      Done 2026-11-21: seen red on `Failed to resolve import
      "../../src/scripts/mandate_reask_report.js"`. The fixture store also
      covers a replayed turn, a subagent file, a synthetic turn and a revoked
      goal, each pinned to zero.
- [x] **0.3 Build the counter.** Implement `src/scripts/mandate_reask_report.ts` <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/goal_phrases.ts -->
      on `src/scripts/_lib/cc_transcript.ts` (`listTranscriptFiles`, main
      bucket only, replay-deduped), flags `--sessions N`, `--since <iso>`,
      `--json`, `--write-baseline <path>`. Counts and session ids only. Not a
      gate: exit 1 only when the store is unreadable or empty.
      verify: the 0.2 test passes; `./scripts-run src/scripts/mandate_reask_report --sessions 50 --json` exits 0.
      production entry: src/scripts/mandate_reask_report.ts
      Done 2026-11-21: 7/7 green; the 50-session run exits 0. It reads user
      turns as well as assistant turns, so it shares `listTranscriptFiles` and
      the main-bucket rule with `cc_transcript.ts` but dedups by record `uuid`.
      The phrase set lives in `src/scripts/_lib/goal_phrases.ts`, shared with the
      Phase 2 hook so the baseline and the live recognizer cannot disagree.
      `--root` (repeatable) exists for the fixture store.
- [x] **0.4 Write the baseline by command.** Run it with <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/goal_phrases.ts -->
      `--write-baseline agents/evidence/mandate-reask/2026-11-baseline.json`
      over the host transcript store. The file records the command line, the
      transcript count and the two metrics; nobody edits it.
      verify: the file exists, parses as JSON, and its `command` field equals the invocation used.
      Done 2026-11-21 over the current host profile's store (1,008 sessions):
      `reask_after_goal` 3 (4 sessions carried a goal sentence),
      `pr_target_asked_after_create` 0 (49 sessions ran `gh pr create`). A lower
      bound — the retro's sample spanned several host profiles, and the record
      names no store path.

## Phase 1 — The session's PR is the default target

- [~] **1.1 Failing selector test.** Add cases to <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/session_pr_watch.ts -->
      `tests/scripts/session_pr_watch.test.ts` for a new
      `default_pr_target(store)`: exactly one `OPEN` tracked PR → that PR; two
      `OPEN` → `null`; only `MERGED`/`CLOSED` → `null`; empty store → `null`.
      verify: `npx vitest run tests/scripts/session_pr_watch.test.ts` -> 1 failing on the missing export.
      Done 2026-11-21: seen red, `TypeError: default_pr_target is not a function`
      (five cases; a sixth pins that two open PRs put no default in the block).
      Deferred 2026-11-21 (D6): the cases leave with the selector, see 1.2.
- [~] **1.2 Selector and block line.** Implement `default_pr_target` in <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/session_pr_watch.ts -->
      `src/scripts/_lib/session_pr_watch.ts`; `pr_watch_block` appends one line
      `Default PR target for PR commands: #<n> <url>` when it is non-null.
      Existing assertions in the same test file stay unchanged.
      verify: `npx vitest run tests/scripts/session_pr_watch.test.ts` -> 0
      Done 2026-11-21: 17/17 green, the existing eleven assertions untouched.
      Deferred 2026-11-21 (D6): the block line measured 1,595,667 B against the
      1,595,300 ceiling, so the selector and the line were withdrawn; the PR
      commands read the one `OPEN` row of the existing `<session-prs>` block
      instead. Both move to `road-to-goal-record-live-wiring` 2.4.
- [x] **1.3 Failing command-contract test.** Write <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/session_pr_watch.ts -->
      `tests/scripts/pr_command_target.test.ts` asserting that
      `fix/pr-comments-loop/command.md` and `fix/pr-comments/command.md` name the
      order *explicit URL → session default target → current-branch detection →
      ask once*, and no longer carry "Never reuse a PR number from earlier in the
      conversation" verbatim.
      verify: the test fails on today's text.
      Done 2026-11-21: seen red, 6 failed / 1 passed (the prod-trunk pin passes
      on today's text, as it must).
- [x] **1.4 Rewrite the two input sections.** Edit the two command files: a <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/session_pr_watch.ts -->
      session default target or a single current-branch PR is used and named in
      one line, without a confirmation question; reuse of a PR number from
      conversation memory stays forbidden, and the text says why the session
      store is not memory (written from `gh pr create` output by a hook). The
      prod-trunk refusal of the loop stays verbatim.
      verify: 1.3 test passes; `task sync` leaves `bash src/scripts/condense.sh --changed` empty.
      Done 2026-11-21: test green; `condense.sh --changed` prints "Every .md
      projection matches its source". The loop's `argument-hint` became
      `[pr-url]`, since the URL is no longer required.
- [x] **1.5 Sweep the other PR-taking commands.** Run <!-- receipt: class=R2 · shadow · would-skip=revalidation · bound=production code touched: src/scripts/_lib/session_pr_watch.ts -->
      `grep -rln -i -E 'PR URL|pr-url' src/domains --include=command.md`; each
      hit that asks the owner for a PR either takes the 1.4 order or the Done
      note names it with the reason it must keep asking.
      verify: the Done note lists every grep hit with one of the two outcomes.
      Done 2026-11-21, eleven hits. 1.4 order: `fix/pr-comments-loop`,
      `fix/pr-comments`, `prepare-for-review` (ticket search kept as source 2,
      added to the 1.3 test); the `fix` router's two loop descriptions now name
      the default. Keep asking or never ask, with reason: `fix/route`, `analyze`
      (a URL is a routing signal); `analyze/pr` (its own coded resolver asks
      only as last resort); `analyze/and-optimize`, `roadmap/next`, `pr/create`
      (print a URL); `pr/create/description-only` (falls back to the branch diff).

## Phase 2 — The goal sentence is recorded and reaches every turn

- [x] **2.1 Council picks the recognizer form.** First action: run the council <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/subagent_constraints_hook.ts -->
      on two options with their cost — (a) a phrase set in code, DE + EN, seeded
      from the goal sentences `mandate_reask_report` finds in the transcripts;
      (b) a model-carried classification the agent confirms in one line. Record
      the verdict as a `## Decisions` row resolved by `council:<date>`.
      verify: `grep -cE '^\| D[0-9]+ \|.*\| council:2026' agents/roadmaps/later/road-to-mandates-scoped-to-the-goal.md` -> /^[1-9][0-9]*$/
      Done 2026-11-21: D4. The council asked for discovery rather than picking;
      D4 records that and the revisit trigger instead of claiming a verdict.
- [x] **2.2 Failing recognizer tests.** Write <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/subagent_constraints_hook.ts -->
      `tests/scripts/goal_mandate.test.ts`: "mach weiter bis zum merge",
      "bis zum merge durchziehen", "arbeite die roadmap ab", "mach PR und merge",
      "until merged" each record the sentence verbatim; a slash-command
      expansion, a `<task-notification>` turn and pasted tool output record
      nothing; "stop", "nicht mergen", "halt" set `revoked_by` verbatim.
      verify: `npx vitest run tests/scripts/goal_mandate.test.ts` -> 1 failing on the missing module.
      Done 2026-11-21: seen red, `Cannot find module
      '../../src/scripts/_lib/goal_mandate.js'`. A quoted chat line joins the
      three negatives.
- [~] **2.3 Store and per-prompt block.** Implement <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/subagent_constraints_hook.ts -->
      `src/scripts/_lib/goal_mandate.ts` on the pattern of `session_pr_watch.ts`
      (store `<git-common-dir>/agent-session-mandates/<session>.json`, one writer,
      atomic write, never throws). The `session-register` `user_prompt_submit`
      beat records and emits one line: the verbatim sentence, its time, and what
      it covers — commits, PR open/update, follow-up fix PRs, CI waits, cleanup
      serving that goal — plus "Hard-Floor reach: per blocker
      goal-scope-hard-floor-reach".
      verify: 2.2 passes; a `session_register_hook` fixture test shows the line after a goal prompt.
      Deferred 2026-11-21 (D6): store, recorder and block land as library code
      with their tests (per D5 the line grants nothing); the `session-register`
      call site and its hook tests move to `road-to-goal-record-live-wiring` 2.1-2.2.
- [~] **2.4 Reach subagents.** Make `subagent_constraints_hook.ts` emit the same <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/scripts/hooks/subagent_constraints_hook.ts -->
      line at `subagent_start` when the parent session holds an unrevoked
      record. Failing test first in the hook's test file.
      verify: the new test passes; `./scripts-run src/scripts/lint_hook_manifest` exits 0 with no manifest change.
      Done 2026-11-21: seen red on the first case, then 29/29 green; the goal
      rides ahead of the pins. `lint_hook_manifest` exits 0, manifest
      untouched. Known gap, named by the council: a revoke typed after a
      subagent started does not reach that subagent.
      Deferred 2026-11-21 (owner decision, option 2): `goal_mandate_for_subagent`
      lands as library code; the `subagent-constraints` call site, its two hook
      tests and the chunk raise (28,500 to 34,000 B) move to
      `road-to-goal-record-live-wiring` 2.3.

## Phase 3 — The non-kernel layer reads the record

- [x] **3.1 Council checks the clause against the kernel.** First action: put <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json -->
      to the council whether a recorded goal sentence, read as `commit-policy`
      exception 2 (a standing instruction not yet revoked) for commits, PR opens
      and follow-up fix PRs serving that goal, is consistent with
      `commit-policy.md:34-42` as written. ESCALATE or "needs the kernel text"
      appends the question to `goal-scope-hard-floor-reach` and marks 3.2
      `[-]` with that reason; otherwise record the row in `## Decisions`.
      verify: a `## Decisions` row or a blocker amendment dated with the council run exists.
      Done 2026-11-21: ESCALATE from both seats (Q3 of the 0.1 council run). D5
      records it and the question is appended to `goal-scope-hard-floor-reach`
      as its part (c); 3.2 is `[-]`.
- [-] **3.2 Context clauses.** On a consistent verdict: add the clause to
      `src/agent-src/contexts/authority/commit-mechanics.md` § exception 2 and a
      fifth trigger "a recorded, unrevoked goal sentence" to
      `src/agent-src/contexts/execution/cheap-question-mechanics.md` § Mandate
      triggers. Hard-Floor rows are not named as covered. Failing text-contract
      test first in `tests/scripts/pr_command_target.test.ts` or a sibling.
      verify: the test passes; `git diff --name-only origin/main -- src/rules/` is empty.
      Skipped 2026-11-21 per 3.1: the council answered ESCALATE, so the clause is
      not written. It needs the owner's ruling on part (c) of
      `goal-scope-hard-floor-reach`, or `commit-policy` amended by
      `later/road-to-typed-grants-that-persist` (ADR-268 § 2). No context file
      changed.
- [x] **3.3 Hand the per-step PR plan to its owner.** The galawork case was a <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json -->
      roadmap that planned one PR per step; `delivery.pr_topology` knows only
      `single` and `stacked` and is read by no code. First action: council on
      whether a per-step value belongs in that vocabulary. Write the verdict as
      an arrival note into `later/road-to-typed-grants-that-persist` step 2.2,
      which owns the cascade; build nothing here.
      verify: `grep -c 'road-to-mandates-scoped-to-the-goal' agents/roadmaps/later/road-to-typed-grants-that-persist.md` -> /^[1-9][0-9]*$/
      Done 2026-11-21: Q4 of the same council run, both seats *discovery first*
      — no value added; the arrival note in typed-grants 2.2 names the two
      questions its consumer has to settle.

## Phase 4 — Hard-Floor reach, once decided

- [ ] **4.1 Extend the record's reach per the owner ruling.** <!-- blocked-by: goal-scope-hard-floor-reach | asked: no — routed: council 2026-11-21 ESCALATE (owner-reserved); the first execution run was a non-interactive workflow subagent that may not ask the owner -->
      When the owner has answered, the agent writes the owner-directive record
      from the owner's verbatim words (ADR-282 Part B), and the 2.3 line names
      the reach the ruling grants: pushes to branches this session created for
      the goal, and merges of follow-up PRs through the `/pr:merge` § 9a danger
      gate for `routine` PRs only. Deploys, prod data and every
      `needs-owner` PR stay outside. Failing fixture first: "bis zum merge"
      followed by a second PR in a later turn.
      verify: the fixture test passes; `git diff --name-only origin/main -- src/rules/` is empty.

## Phase 5 — Close the loop into the owning roadmap

- [x] **5.1 Hand the metrics over.** Append the two metrics and the 0.4 <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/hook-bundle-budget.json -->
      baseline path to the metric table of
      `later/road-to-an-agent-the-owner-does-not-drive` (Goal table) so its
      closing re-measure (its Phase 8) also invokes `mandate_reask_report` with `--since` set to the
      merge time of this roadmap's PR, alongside its own counts.
      verify: `grep -c 'mandate_reask_report' agents/roadmaps/later/road-to-an-agent-the-owner-does-not-drive.md` -> /^[1-9][0-9]*$/
      Done 2026-11-21: two Goal-table rows with the 0.4 baseline path, and 8.1
      names the `--since` re-run.

## Phase 6 — Roadmap commands follow the owner's merge order and the project's workflow

The retro found two command texts that contradict an owner order. At
`811cea61d6`, `/roadmap:process-full` already merges on `--merge` or the
owner's own words in the session (`src/domains/product-basic/roadmap/process-full/command.md:108-119`,
ADR-282), but `/roadmap:next`, which hands off to it, still says
"No merge, ever" (`src/domains/product-basic/roadmap/next/command.md:372`). Its
§ 4 Workspace defaults to a feature branch, or a worktree on request
(`next/command.md:224-235`), and reads no project rule. In azeroth that default
overrode the project's own rule: work on `main`, commit only after an in-game
test.

- [x] **6.1 Failing command-contract test.** Write <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      `tests/scripts/roadmap_next_contract.test.ts` over
      `src/domains/product-basic/roadmap/next/command.md`: (a) no line contains
      `No merge, ever`; (b) the Rules section links process-full's `--merge`
      section and names both triggers, `--merge` and the owner's own words in
      the session; (c) § 4 Workspace names the order *explicit user
      instruction → the project's own delivery rule, read per
      `playbook-precedence` (branch, worktree, or trunk-plus-manual-test) →
      feature-branch default*, and says that the project rule wins over the
      default; (d) the five-disqualifier screen text is unchanged (a snapshot of
      § 2's table rows).
      verify: `npx vitest run tests/scripts/roadmap_next_contract.test.ts` -> 1 failing on (a)-(c) and passing (d) on today's text.
      Done 2026-11-21: seen 3 failed (a-c) / 1 passed (d). § 2 holds a numbered
      list rather than a table, so (d) pins the sha256 of its five items.
- [x] **6.2 Rewrite the two passages.** Edit `next/command.md` § 4 and the <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      Rules bullet to match 6.1. The merge bullet points at process-full's
      `--merge` section instead of restating it. It stays bound by that
      section's danger gate and the `needs-owner` exclusion, so this step
      grants no new merge authority. A project delivery rule that forbids a
      branch or a PR ends the run at "work done on the project's terms, nothing
      pushed", and the run says so in one line.
      verify: 6.1 passes; `task sync` then `bash src/scripts/condense.sh --changed` prints nothing; `./scripts-run src/scripts/lint_roadmap_ci_steps` and `task lint-skills` exit 0.
      Done 2026-11-21: 4/4 green; `condense.sh --changed` reports every
      projection matching; `lint_roadmap_ci_steps` 0; `task lint-skills` 0 (456
      pass, 1 unrelated warn). ADR-239:141 still quotes "No merge, ever" as the
      text it recorded at the time; a decision record is not rewritten.
- [x] **6.3 Sweep the sibling command texts.** Run <!-- receipt: class=R1 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=test-only change -->
      `grep -rn -i -E 'no merge, ever|never merges?\b' src/domains/product-basic/roadmap src/agent-src/contexts/execution/roadmap-*.md`.
      Each hit either states its scope (it is a different actor, as
      `roadmap-process-loop-run.md:203` is for `run:supervise`) or gets the 6.2
      pointer. The Done note lists every hit with one of these two outcomes.
      verify: the Done note lists every grep hit; the 6.1 test passes again after the sweep.
      Done 2026-11-21, two hits, both already state their scope:
      - `roadmap-execution-contract.md:170` — "Acceptance never merges … merging
        is § 5's one exception", and § 5 names the owner auto-merge instruction.
      - `roadmap-process-loop-run.md:203` — `run:supervise --once`, a different
        actor. 6.1 green after the sweep.

<!-- Release holds — none. Every phase lands independently: Phase 1 and 2 add
     carriers that change no permission, Phase 3 edits context files only after a
     council verdict, Phase 4 is blocked until the owner rules, Phase 6 points a command at a merge
     path process-full already carries. No intermediate
     tree state misdescribes what a release does. -->

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | No kernel rule file is edited by this roadmap | `kernel-rule-edits.md` soak + ratification; kernel text owned by `later/road-to-typed-grants-that-persist` Phase 1 | typed-grants is archived without landing ADR-268 §§ 2-3 |
| D2 | reversible-technical | agent | The goal store mirrors `session_pr_watch.ts` (per-session JSON under the git common dir, one writer) | `src/scripts/_lib/session_pr_watch.ts:12-21` | a second writer per session appears |
| D3 | reversible-technical | agent | No new hook concern; reuse `session-register` and `subagent-constraints` | `src/scripts/hook_manifest.json` claude `user_prompt_submit` / `subagent_start` lists | either concern is removed from the manifest |
| D4 | reversible-technical | council:2026-11-21 mandates-goal-scope Q2 | The recognizer is option (a), a DE + EN phrase set in code (`src/scripts/_lib/goal_phrases.ts`), shared by the hook and `mandate_reask_report`; it records the owner's own prose line verbatim, after the host-frame and paste filters of `_lib/prompt_shape.ts` | Council 2026-11-21, anthropic + openai, two rounds, 2/2 present, $0. Neither seat picked an option outright; both set two requirements — the stored span is verbatim owner text, and grant and revocation recognition are tested separately — and the anthropic seat named the deciding difference: (a) fixes the span before recording, (b) depends on an in-turn agent confirmation that can fail silently. (a) meets both requirements by construction; (b) cannot be unit-tested. Adopted by the agent within those requirements | a labelled comparison over transcript goal sentences (the council's discovery ask) shows (a) missing paraphrases at a rate the 5.1 re-measure can see, or a false grant is observed |
| D5 | reversible-technical | council:2026-11-21 mandates-goal-scope Q3 | The goal line names the work that serves the goal and says that what it authorises is still decided by `commit-policy` as written; it grants nothing on its own | Both seats answered Q3 (is the record a standing instruction under exception 2) with ESCALATE: the one-shot section names "create the PR" as spent and calls "exception 2 misread as standing" the forbidden inference, so that reading needs the kernel text first | the owner rules on `goal-scope-hard-floor-reach`, or typed-grants lands ADR-268 § 2 in `commit-policy` |
| D6 | product-owned | owner | 2026-11-21: blocker `goal-record-ratification` resolved by option 2 — the hook bundle raise was withdrawn by owner decision; both ceilings in `src/config/hook-bundle-budget.json` stay at `main`'s values, the goal record lands as library code with its tests, `default_pr_target` is withdrawn, the PR commands read the existing `<session-prs>` block, and the hook call sites move to `road-to-goal-record-live-wiring` | the owner's in-session choice of option 2 on 2026-11-21; owner record `agents/evidence/owner-directives/2026-11-21-session-retro-roadmaps.md` | the wiring roadmap makes room under the ceilings, or the owner ratifies a raise there |

## Blockers

### blocker: goal-scope-hard-floor-reach
- **Status:** open
- **Owner:** owner
- **Routed:** council 2026-11-21 ESCALATE — owner-reserved under "cannot be bounded from available evidence" (analysis mode, two rounds, anthropic and openai, 2/2 present, convergent in round 2). ADR-282 grants the merge "for the run it starts" and ADR-268 § 2 spends a mission grant "once, on the final green head"; neither establishes that a follow-up PR opened in a later turn belongs to that run, nor separates pushes to an existing PR branch from pushes to a new branch. Both seats asked for an operation-by-operation reconciliation (push to the PR branch, push to a new branch, PR open, separate merge) and named one open case: a revocation typed after a subagent started does not reach that subagent before it acts.
- **Blocks:** Phase 4 — Hard-Floor reach, once decided
- **Question:** Does an owner goal sentence ("bis zum merge", "mach PR und merge") reach, for that goal and until revoked, (a) pushes to further branches the session creates for it and (b) the routine-class merge of follow-up PRs opened in later turns — ahead of the kernel landing ADR-268 §§ 2-3 schedule? <!-- md-language-check: ignore -->
- **Recommendation:** Yes for both, bounded to branches this session created for the goal and to `routine` PRs through the § 9a danger gate. ADR-268 § 2 already decided mission persistence and ADR-282 already accepts the owner's own words as the merge confirmation; this answer only says that a follow-up PR of the same goal is inside "the run it starts".
- **If you do nothing:** commits and PR opens stop being re-asked (Phases 1-3), but every follow-up push to a new branch and every follow-up merge still needs a fresh owner sentence — the retro's "erstelle den PR für X" turns stay at their baseline for the push half. <!-- md-language-check: ignore -->
- **What to do:**
  1. In any session in this repo, say the ruling in one sentence, for example: "Ein Ziel wie 'bis zum merge' deckt Pushes auf eigene Branches und Routine-Merges von Folge-PRs dieses Ziels." <!-- md-language-check: ignore -->
  2. The agent writes `agents/evidence/owner-directives/<date>-<id>.md` from those words (ADR-282 Part B) and cites it here.
- **Amended 2026-11-21 (step 3.1):** part (c) — is a recorded, unrevoked goal sentence a standing instruction under `commit-policy` exception 2 for commits, PR opens and follow-up fix PRs that serve the goal? The council answered ESCALATE (both seats): `commit-policy` calls exactly that reading ("exception 2 misread as standing") the forbidden inference, so it needs the owner or the kernel text that `later/road-to-typed-grants-that-persist` owns. Until then the goal line names the owner's words and grants nothing (D5).
- **Resolved when:** an owner-directive record citing `goal-scope-hard-floor-reach` exists under `agents/evidence/owner-directives/`.

### blocker: goal-record-ratification
- **Status:** resolved — 2026-11-21, owner option 2 (D6): the raise was withdrawn by owner decision; the branch lands without growing the hook bundle, and the live wiring moved with this question to `road-to-goal-record-live-wiring`. The 18 ratification prompts stay under `agents/evidence/council/` as the record.
- **Owner:** owner
- **Routed:** council 2026-11-21 ESCALATE — split verdict across 18 ratification rounds, which the decision-revisit gate routes to the owner (split → user).
- **Evidence:** 18 ratification rounds (anthropic and openai, prompts `agents/evidence/council/mandates-scoped-to-the-goal-ratification-r1-20261121.question.md` to `-r18-`). The goal record and the PR default make the hook bundle grow past both ceilings in `src/config/hook-bundle-budget.json` (dispatch 1,595,300 to 1,606,550 B, subagent chunk 28,500 to 34,000 B, each with a `raise_log` entry), and that file is on the ratification gate's watched set, which needs a passing verdict from two distinct providers (ADR-268 § 4). The anthropic seat returned `confirmed-non-expanding` or `ratified` in 17 of 18 rounds. The openai seat named one new landing blocker in each round from round 7; every one was fixed with a failing-first test (store stem, escaping, mention and negation filters, ordered and locked writes, stop files, stop slot, user-level stop fallback, fresh read after write, broader and longer cancellations, process-start stamps). In round 18 it found the round-17 fix right and asked for an ordering guarantee no hook here can give: that every supported host starts hook processes in the owner's submission order, or a host-supplied submission sequence. Its stance lines: none in rounds 1-10, 12, 14 and 18; `refused` in 11, 13, 15, 16 and 17.
- **Blocks:** AC-7 (the ratification gate is a blocking step of `task ci` and of the pre-push CI mirror), and so the push, the PR and the merge of this branch.
- **Question:** Land the goal record with its two ceiling raises on the anthropic seat's `ratified` plus an owner ratification, or hold it until a host-supplied submission order exists? <!-- md-language-check: ignore -->
- **Recommendation:** Land it. The goal line grants nothing (D5); the residual is a goal resurfacing after a stop only when a host launches an earlier prompt's hook after a later prompt's hook has finished, and the line shows the owner's words on every turn, so such a case is visible and revocable.
- **If you do nothing:** the branch stays local and unmerged; Phases 0-3, 5 and 6 are done on it but none of it reaches main.
- **What to do:** say the ruling in one sentence; the agent writes `agents/evidence/owner-directives/<date>-<id>.md` from it and a ratification record under `agents/evidence/ratifications/` naming the owner as the second reviewing party, or drops the goal-record half of the branch.
- **Resolved when:** a ratification record for this branch's `hook-bundle-budget.json` subject passes `check_kernel_edit_ratified`.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-11-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Recognizer over-reach | implementation | A goal phrase inside pasted text, a quoted log or another task arms a record for the wrong goal, and later commits or PR opens follow it | Owner prose only (synthetic-turn negatives in 2.2), verbatim sentence shown every turn, revoke phrases, no Hard-Floor reach until 4.1 | Phase 2 — The goal sentence is recorded and reaches every turn |
| 2 | Context clause contradicts the kernel | product | The agent reads `commit-policy.md:34-42` and the new context clause as conflicting and behaves unpredictably | Council check in 3.1 before any edit; ESCALATE routes to the blocker and to typed-grants instead of editing | Phase 3 — The non-kernel layer reads the record |
| 3 | Wrong default PR | implementation | A session that opened several PRs gets a default and the loop pushes review fixes to the wrong branch | Selector returns a PR only when exactly one is `OPEN`; the loop's prod-trunk refusal stays verbatim | Phase 1 — The session's PR is the default target |
| 4 | Transcript text leaks into tracked evidence | implementation | The counter writes prompt text into `agents/evidence/` | Counts and session ids only; 0.2 (c) asserts no fixture prompt substring in the output | Phase 0 — A baseline the repo generates |
| 5 | Duplicate ownership with the parked roadmaps | product | This file and its two siblings each claim the goal-scope change and drift apart | relates notes, no kernel edits (D1), arrival notes in 3.3 and 5.1 | Phase 5 — Close the loop into the owning roadmap |
| 6 | Command text widens merge authority | product | Rewriting "No merge, ever" in `/roadmap:next` reads as a new merge grant, and a run merges without an owner word | 6.2 only points at process-full's `--merge` section (ADR-282 danger gate, `needs-owner` excluded); 6.1 (b) asserts both triggers are named; the project-rule branch ends without a push | Phase 6 — Roadmap commands follow the owner's merge order and the project's workflow |

## Acceptance Criteria

- [x] AC-1 — `agents/evidence/mandate-reask/2026-11-baseline.json` exists and was
      written by `mandate_reask_report --write-baseline`, carrying both metrics.
- [x] AC-2 — After `gh pr create` in a session, `/fix:pr-comments-loop` without a
      URL resolves that PR from the one `OPEN` row of the injected
      `<session-prs>` block with no question (1.3 test green; the
      selector and its dedicated default line are deferred per D6).
- [~] AC-3 — A goal sentence typed by the owner is recorded verbatim and shown in
      every later prompt and at every subagent start of that session; synthetic
      turns record nothing (2.2-2.4 tests green). Deferred per D6: the recorder
      and reader land with their tests; the live call sites are
      `road-to-goal-record-live-wiring` AC-1.
- [x] AC-4 — `commit-mechanics.md` and `cheap-question-mechanics.md` read the
      record, or `goal-scope-hard-floor-reach` carries the council's ESCALATE
      for that clause (3.1).
- [x] AC-5 — `git diff --name-only origin/main -- src/rules/` lists no file for
      the whole roadmap branch.
- [x] AC-6 — `/roadmap:next` no longer says "No merge, ever", links
      process-full's `--merge` section, and § 4 lets the project's own delivery
      rule win over the branch default (6.1 test green).
- [x] AC-7 — `task ci` exits 0 on the roadmap branch.
      2026-11-21: with the raise withdrawn (D6) no ratification-watched file is
      in the diff; `./scripts-run src/scripts/ci_mirror` exits 0 on the
      landing branch `feat/mandates-scoped-to-the-goal-unwired`.
