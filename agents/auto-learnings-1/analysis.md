# Auto-learnings 1: friction in the last 100 sessions

> **Window:** 100 most recent interactive sessions, 2026-10-20 → 2026-11-03,
> benchmark clones and scratchpad probes excluded (`*.jsonl` > 20 KB).
> **Method:** a dialogue skeleton per session (user prompts, the tail of the
> agent text before each prompt, structured questions, `!` / slash commands the
> user ran, denied tool calls), then four parallel readers of 25 sessions each,
> plus deterministic counts over the skeletons. Reader counts are lower bounds;
> deterministic counts are exact over the skeleton.
> **Roadmap:** `road-to-an-agent-the-owner-does-not-drive`, parked under
> `agents/roadmaps/later/` until the owner promotes it.

## Hard numbers (deterministic, exact over the skeletons)

| Signal | Count |
|---|---|
| User prompts in total | 691 |
| Bare `1` as the whole reply (picking an offered option) | 111 |
| Bare `2` / `3` as the whole reply | 20 |
| Sessions with at least one bare-number reply | 45 of 100 |
| Prompts starting with "continue" (`weiter`, `mach weiter …`) | 63 |
| Prompts mentioning merge | 69 |
| Prompts ordering cleanup of worktrees / branches | 21 |
| `git push` run by the user via `!` | 21 |
| …of which with `AGENT_CONFIG_SKIP_PREPUSH_PREFLIGHT=1` | 18 |
| `gh pr merge` run by the user via `!` | 10 |
| `/analyze:inbox` invocations | 43 |
| `/clear` | 34 |

Roughly **one prompt in five** was the user unblocking the agent (a bare option
number, a "continue", a merge order, or a cleanup order) rather than giving new
work.

## Findings by category (reader counts, lower bounds)

### A. Questions the user should not have had to answer — ~125

| Pattern | ~Count | Evidence (session) | Why it happened |
|---|---|---|---|
| Numbered menus where the recommended option dominates; the user answers `1` | ~70 | s003 (≥10× `1` across council rounds 7–14), s020, s034, s049, s080 | `user-interaction` makes every decision a block with a recommendation; `no-cheap-questions` check 4 ("one option obviously dominant") is model-carried and is not applied |
| Re-asking for push / PR / merge / cleanup after the user already said "until merged" | ~30 | s003, s034, s046, s077, s091 ("not merging because you haven't approved a merge"), s094 | `commit-policy` one-shot clause + Hard Floor read **per PR**, so one mandate never covers the follow-up PR, the fix-up push, or the cleanup |
| Owner / design questions asked mid-run instead of routing to the AI council | ~27 | s002, s021, s030, s048, s055, s060, s074, s088, s090 | the owner said "council first" in at least 7 sessions; that preference lives only in host memory and in `decision-revisit-gate` prose, and `/analyze:inbox` + roadmap runs do not apply it by default |
| Force-push / history-rewrite asks on the agent's own same-day branch (commit-subject lint) | 4 | s077, s079, s095 | `git-history-discipline` requires a this-turn ask even for own unshared branches |
| Session-collision / worktree-choice / release-location menus | ~8 | s020, s024, s062, s066, s083, s095 | session-register advisory turned into a blocking question although a separate worktree is the established default |
| Stuck-subagent status menus ("nudge / stop / keep waiting") | ~4 | s064 | no self-healing rule for a stalled lane |
| Options naming internal step ids without meaning | 1 | s003 | option text cites ids, not consequences |

### B. Manual work the agent should have done — ~135

| Pattern | ~Count | Evidence | Why |
|---|---|---|---|
| Typing the long resume prompt ("continue exactly where you were, with the subagents, so neither restarts") | ~55 | s006, s023, s031, s043, s054 (4×), s074 (10×), s077–s100 (~18×) | context compaction, API errors, spend limits and turn ends drop the run; no persisted run state + no automatic resume |
| Telling the agent a PR is merged / CI is green / "finish the release" | ~25 | s027, s034 ("CI is long done"), s091 (3×), s092, s094 | the agent ends its turn at every wait instead of settling CI and continuing |
| Running `git push` / `gh pr merge --admin` / `filter-branch` themselves | ~30 | s034, s043, s058 (14×), s079, s089 | the agent chose paths the auto-mode classifier denies (`SKIP_PREPUSH_PREFLIGHT`, `--admin`, force-push, history rewrite) and handed them back instead of finding a compliant path |
| Ordering worktree / branch cleanup | ~21 | s013, s043, s047, s049, s076–s079, s094 | cleanup is reported ("can go") but not part of the finish-PR flow |
| External steps (ssh-add, settings toggle, fork deletion) | ~4 | s016, s064 | genuinely user-side; acceptable |

### C. Irritation — ~40 signals

Clustered by trigger (quotes withheld; sessions named so they can be re-read):

- **Stalling and questions during accepted runs** — s002, s003, s034, s071 ("process-full is not that hard: no steps, no phases").
- **Gates the owner did not want** — s058 (owner merge bypass repeatedly proposed for removal; owner had to say "keep it" twice), s089 (an owner/council review put in front of a release), s037 (an opt-in `--enrol` flag nobody asked for).
- **Claims without testing** — s027 (UI toggle shipped "without function" twice), s054 (design zip not followed, "I see neither 3D nor dots"), s085 (banner instructions partly ignored), s079 (steps "committed" but never pushed).
- **Instructions not carried** — s096 (Laravel-only overlay where all languages were wanted), s081 (review delivered where a code graph was asked for).

### D. Other failure patterns

- **Promissory stops** (~10): "round 10 next turn", "I'll tick 11.3 when CI is green", "then I push" — then the turn ends (s003, s009, s013, s090).
- **Unbounded ratification loops**: s003 ran 14 council rounds with the user answering `1` each time; the fix-loop ladder was not applied.
- **Context exhaustion** in ≥ 6 long sessions; s077 measured 1,186 Bash calls, 58 council calls and 69 vitest runs in one run.
- **Attribution leak**: commits carried `Co-Authored-By` against the owner's standing rule (s006, s027) — the host's attribution reminder won over `no-attribution-footers`.
- **Language slips**: English replies or an English `Recommendation:` label in German sessions (s008, s091).
- **Multi-question blocks** ("answer both as `1 / 1`", s091).

## Recurrence — this is not the first time

The archive already holds roadmaps for most of these:
`road-to-user-out-of-the-loop`, `road-to-autonomous-roadmap-execution`,
`road-to-gate-autonomy`, `road-to-worktrees-that-leave-after-the-merge`,
`road-to-asked-not-parked`, `road-to-the-question-only-the-owner-can-answer`.
Per `recurring-criticism`, the repetition is evidence the earlier dispositions
did not hold. Classification (own analysis):

| Theme | Outcome | What broke |
|---|---|---|
| Council-first for owner questions | right, recorded, **unreachable** | lives in host memory + rule prose; no command or gate applies it |
| Per-PR merge consent under a "until merged" mandate | disposition **wrong** for this owner | the floor is read per operation; the owner's mandate is per goal |
| Worktree cleanup after merge | right, recorded, **unreachable** | the archived roadmap shipped a mechanism the finish flow does not call |
| Dominant-option menus | right, recorded, **unreachable** | the check is model-carried only; nothing measures it |
| Resume after compaction | **never recorded** as a mechanism | each run re-explains state by hand |
