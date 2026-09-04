# A push closes its own loop — the measurement

Reference for [`git-workflow`](../SKILL.md) § A push closes its own loop. The
obligation lives in the skill; this file carries the evidence behind it and the
two deterministic carriers that now exist, so neither has to be re-derived and
neither inflates the skill body.

## What was measured

Corpus: the 30 most recent local session transcripts and the 50 most recent
pull requests on this repository, read on 2026-09-04. Session events are counted
from git's and `gh`'s own literal output in the transcripts, never from prose
about them; PR workflow runs come from `actions/runs?event=pull_request`, which
paginates out at 1,000 runs and therefore covers **36** of the 50 PRs — the
older 14 are unmeasured, not clean, and are excluded from that row rather than
counted as green.

### Half one — the stale base

| Signal | Count |
|---|---|
| PRs carrying ≥ 1 `Merge branch 'main' into <branch>` commit | **25 / 50** |
| Such merge commits in total | **52** |
| Sessions hitting a literal `CONFLICT (content)` / `Automatic merge failed` | **10 / 30** |
| Sessions hitting a rejected push (`Updates were rejected` / non-fast-forward) | **20 / 30** |

The worst single PRs needed four and five separate base merges. What that
buys is not only conflict work: the three workflows that failed most —
**Tests (18), Consistency (16), Rule Backstops (13)** — are the base-relative
ones. Ratchets, budgets and generated counts are green against the base a branch
forked from and red against the base it merges into, so a branch pushed behind
its base was verified against a question nobody asked.

### Half two — the unsettled push

| Signal | Count |
|---|---|
| Sessions running `gh run view --log-failed` (a red job was investigated) | **22 / 30** |
| PRs with ≥ 1 FAILED workflow run (of the 36 readable) | **17** |
| Failed runs in total | **56** |
| PRs carrying a follow-up `fix(ci\|gates\|budget\|deps\|tests)` commit | **20 / 50** |
| Such repair commits in total | **41** |

Every one of those pushes SUCCEEDED. What failed was the ending: the push
returned 0, the turn closed, and the red arrived where the user found it.

**Only 19 of 50 PRs landed with neither half.**

## The two carriers

| Half | Carrier | Behaviour |
|---|---|---|
| Stale base | `check_branch_freshness` in the pre-push hook (`src/scripts/install-hooks.sh`) | Asks the REMOTE, one `ls-remote`, ~4.5 s. Refuses only on a VERIFIED behind state and points at `task push-ready`. Never merges. |
| Unsettled push | the `push-settle` PostToolUse concern (`src/scripts/hooks/push_settle_hook.ts`) | Fires on git's own ref-advance report, resolves the PR number, and names the literal `ci_settle` command. Warn only. |

### What each one does NOT do

- **The hook never merges.** Resolution belongs to a step run with the result in
  front of you; a hook that rewrites the tree at the moment the contributor
  believes their work is finished turns one refused push into an unreviewed
  commit. It refuses and names `task push-ready`.
- **The hook cannot see an unverifiable base.** Offline, in CI, on a detached
  HEAD, or standing on the base itself, `check_branch_freshness` exits 0 and
  says which — so an unreachable network never blocks a push, and a green there
  means "did not refuse", not "current".
- **The concern cannot block.** It is `severity: advisory`,
  `fail_closed: false`. Leaving a push deliberately unsettled is legitimate;
  ending the turn silently on one is what the reminder exists to stop. Whether
  the reminder changes behaviour is unmeasured — it ships as a carrier, not as a
  claim.
- **Neither reaches a host without the slot.** `agent-config hooks:status`
  answers which slots are bound where you actually are; `post_tool_use` is
  unbound on windsurf and copilot, and there the settle obligation is
  model-carried by the skill alone.

## Cost, stated rather than implied

The pre-push gate set was already measured at 36.05 s against the 25 s
`pre_push_budget_seconds` ceiling in `src/config/ci-local-parity.yml`, and the
freshness gate adds ~4.5 s on the green path. That is a real cost on an already
over-budget hook, and it is recorded here rather than hidden: the trade is 4.5 s
per push against 52 base merges and 56 failed runs across 50 PRs. On the RED
path the hook gets *cheaper*, not dearer — the refusal exits before the ~10 s
regeneration and the preflight set, because everything after it would be
answered against a base that is about to move.

## Revisit-if

- A later corpus shows base merges and post-push repair commits at a rate the
  carriers cannot explain — then the carriers are firing and not landing, and
  the next lever is delivery, not another reminder.
- `pre_push_budget_seconds` is enforced by something. Today nothing measures the
  hook, which is how the set grew past its own ceiling with no signal; once it
  is measured, this gate is one of the entries that has to justify its slice.
