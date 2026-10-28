<!-- evidence-type: analysis -->

# Release 19.0.0 — what the cut cost, and what changed because of it

Written 2026-10-28, the day 19.0.0 was cut, after the owner asked for one pass
over the whole release: what went well, what went badly, what was unnecessary,
and a fix for each in one pull request. It asserts what was true when written.

## Timeline, by the run

| # | What happened | Cost | Cause class |
|---|---|---|---|
| 1 | `task release` refused: a scheduled deprecation (`projection.rule_packs`) was due in 19.0.0 | one PR (#2731) | gate worked |
| 2 | Refused again: `BREAKING_CHANGES.md` had no 19.0.0 row | one PR (#2732) | gate worked |
| 3 | Test-count probe `ETIMEDOUT` at 180 s; the `Tests:` footer was written by hand | manual edit | probe budget too small |
| 4 | Release PR body 65,569 chars against GitHub's 65,536 cap | one PR (#2733) | release tool defect |
| 5 | Release PR red: the commit-subject lint refused `release: 19.0.0` (body under 10 chars) | part of #2736 | regression from #2723 |
| 6 | Release PR red: `node_modules_mb` 141 against a max of 140; main's nightly already read 140 | part of #2736 | budget at cap, not visible on main |
| 7 | `release-prepare` regenerated the evidence census, whose header named the HEAD commit; the merge of main made it a one-line diff, a commit, and a full CI cycle | ~15 min CI | unnecessary step |
| 8 | Branch push died: `ssh: connect to host github.com port 22` | manual resume | no retry on a transport drop |
| 9 | Laptop slept; `git fetch` inside the resumed run hung **1 h 47 min** with no output | 1 h 47 min | no ssh keepalive |
| 10 | The agent reported the hung run as "still in the pre-push checks" without inspecting the process | the same 1 h 47 min | agent behaviour |
| 11 | Tag push died: `Connection reset by peer` after the pre-push hook re-ran the content gates for minutes with the session open | manual resume | hook gated a tag-only push |
| 12 | A resume after the merge ran the vitest collection again for a footer already written | ~3 min | redundant work on resume |
| 13 | MCP Registry publish 400: npm accepted 19.0.0 but did not serve it yet | manual re-run | no wait for npm |
| 14 | After the cut, `pr-risk-review.yml` still installed `@18` and `advisories-daily.yml` `@16`; a test on main went red | a red run on the next PR | the bump rewrote one template pin only |

## What went well

- **The refusals were real and early.** Items 1 and 2 stopped the cut before a
  branch was pushed, with the exact file and row named.
- **`--resume` held across four interruptions** (items 8, 9, 11 and the merge).
  Every completed step was skipped correctly, including the merge-commit tag.
- **The failure messages named the right layer.** The push error said "not the
  fetch-and-retry case"; the budget gate named both the cap and the drift
  against the committed record.

## What was unnecessary

- Item 7 — a generated report in the release path whose only change per commit
  was the commit it was generated at.
- Item 11's gate run — a tag names a commit that was already gated on its
  branch; the gates read the checked-out tree, not the tag.
- Item 12 — a full collection on resume for a number already in the changelog.

## What changed in this pull request

| Item | Change | Verified by |
|---|---|---|
| 7 | The census is removed from `release-prepare` (owner decision); the release-PR shape gate and both contracts no longer list it | `tests/scripts/check_release_pr_shape.test.ts` — a stray census now fails the shape, and `release-prepare` is asserted not to call the census |
| 8, 11 | Branch push, tag push and the fetch retry twice on a transport drop (5 s, 20 s); credentials, gate refusals and protection still fail on the first attempt | `tests/scripts/release_network_retry.test.ts`, with the 19.0.0 stderr verbatim in both directions |
| 9 | Every git subprocess of the release runs with ssh `ServerAliveInterval=15`, `ServerAliveCountMax=4`, `ConnectTimeout=30` and HTTP low-speed limits, so a dead connection ends in about a minute; an operator's own `GIT_SSH_COMMAND` / `core.sshCommand` is never overridden | same file, `git_network_env` |
| 11 | The pre-push hook skips its content gates for a tag-only push, like it already did for a delete-only push | `tests/scripts/prepush_delete_only.test.ts` — seen red against the old hook |
| 3, 12 | The probe timeout is 600 s; a resume reuses the `Tests:` footer already in the target's changelog section | `_test_trend_line_in_section` tests |
| 13 | The MCP Registry job waits until npm serves the version (up to 10 min) before publishing | the 19.0.0 failure, re-run green after npm served it |
| 14 | The version bump rewrites every `@event4u/agent-config@<major>` pin in the shipped workflow templates; both templates are on `@19`; the release-PR shape admits them | `bump_workflow_major_pins` tests, including one that every shipped template carries the current major |
| 5 | Fixed in #2736 before the cut: the strict `release: X.Y.Z` subject is exempt from the length rule | `tests/scripts/lint_commit_subjects.test.ts` |
| — | The published `BREAKING_CHANGES.md` Pending row is deleted, per that file's own contract | `lint_breaking_changes_index` |
| — | `obligation-settle-shadow-bar` gains clause (10): the one-machine corpus is accepted (owner, option (a)), and a passing reading is stated not to be evidence about a consumer; the carried roadmap that held the question is archived | `lint_roadmap_blockers` |

## Not changed, with the reason

- **Item 6, the budget at cap on main.** The gate's posture is warn on main,
  fail on release — by design the release is the conscious-decision point, and
  it worked as one: the owner raised the cap to 150 in #2736. A "zero headroom"
  advisory was considered and not built: `cli_help_command_count` holds zero
  headroom on purpose, so the advisory would fire on every run and be ignored.
- **Item 4** was a defect, fixed in #2733 before the cut.

## Learning for the agent, item 10

A silent background job is not evidence of progress. Before reporting the state
of a long-running command, read its process tree and elapsed time
(`ps -o pid,etime,command`); a child that has run for longer than its step can
take is a hang until shown otherwise. Watching a run's output with a filter that
matches every terminal state, not only progress, is what made items 11–13
visible within seconds instead of hours.
