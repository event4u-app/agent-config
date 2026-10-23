---
proposed_by: claude-opus-5.5 session ab54e45a (feat/code-graph-auto-refresh), on the owner's request of 2026-10-23
implemented_by: claude-opus-5.5 session ab54e45a (feat/code-graph-auto-refresh)
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), eight rounds of 2026-10-23
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: 94d93c8d87f005008fbe21bdecf9b756f4ce891302db17f3320576f94c5a98ba
---

<!-- evidence-type: ratification -->

# Code-graph auto-refresh — confirmed-non-expanding 2/2, after seven refusals

`check_kernel_edit_ratified` gates three hook-plumbing surfaces on
`feat/code-graph-auto-refresh`: `src/config/hook-bundle-budget.json` (a new chunk
ceiling for the `code-graph-refresh` concern; `max_bytes` unchanged), and
`src/scripts/hook_manifest.yaml` with its compiled twin (the new concern, bound on
`session_start` for all seven hosts, and the new `execution` effect value).

## What the change is

- The package's own git hooks refresh the code graph after merge and rebase too,
  not only after commit and checkout; a fast-forward `git pull` fires post-merge
  alone (measured with a probe repository).
- `code-graph refresh` gains `--single-flight` and `--map`; a build during which
  HEAD moved or could not be read is discarded.
- A consumer project — which never receives those git hooks — can opt in with
  `code-graph auto-refresh on`; the `code-graph-refresh` session concern then
  spawns a detached `refresh --single-flight --map` at session start.

## The review, round by round

Each prompt stated the change, the diff of the gated files and the code they wire,
and asked for one of the four verdicts with no stated expectation. Each round after
the first named the previous round's findings and what changed for them.

| Round | anthropic | openai | What it found |
|---|---|---|---|
| 1 | refused | refused | the concern ran `<root>/agent-config`, a repository-controlled file; an existing cache was treated as consent; a live lock could be reclaimed on age and a late release could delete a successor; an unreadable HEAD published; `effect: formatting` understated a detached process |
| 2 | refused | refused | a FAILED work-tree probe mapped to the "not a repository" value, so two failures compared equal |
| 3 | ratified | refused | `headOf()` walked lexical ancestors; a root symlinked into a repository subdirectory could read as no repository |
| 4 | refused | refused | the concern's `repoRoot()` still used `existsSync`, so an uninspectable inner `.git` could select an opted-in outer repository |
| 5 | ratified | refused | `isStale()` returned true when the lock could not be stat-ed |
| 6 | refused | refused | check-then-delete reclaim could delete a successor's live lock; two lock protocols (shell and engine) shared one directory; two map writers could interleave |
| 7 | refused | refused | the git-hook block runs `./agent-config` from the repository |
| 8 | confirmed-non-expanding | confirmed-non-expanding | — |

Every finding of rounds 1–6 was fixed in the branch, each with a test that was
seen red with the fix neutralised: opt-in marker plus a git-tracked refusal; CLI
taken only from an absolute PATH entry resolving outside the repository; nonce-owned
locks reclaimed only on positive evidence and only under a re-checked mutex; one
lock protocol for hooks, concern and `map`; HEAD read from the canonical root, any
inspection error discarding the build; the `execution` effect.

Round 7's objection was not changed in code. Round 8 was asked whether it is a
blocker for this change, given facts the round-7 prompt had not carried:
`install-hooks.sh` runs only through this package's own `prepare`
(`[ -d .git ] && …`); the same four hooks already run `./agent-config
chat-history:checkpoint`, `task sync`, `npm run build:cli` and `./scripts-run`
from the checkout on `origin/main`; the code-graph block on `origin/main` already
ran `./agent-config code-graph refresh` and `map`; and a global `agent-config` is an
older build that lacks the new flags. Both seats answered
`confirmed-non-expanding`: the objection is a property of the package's
development-hook trust model, not a boundary this branch adds, and replacing only
this call would leave every other block as it is while running a stale engine.

## Conditions the seats attached, and their state

- openai, round 8: the added hook paths must be covered for lock contention,
  timeout, non-zero exits and preservation of the parent git operation. Contention,
  budget and failure are covered in `tests/scripts/code_graph_refresh*.test.ts`;
  a test added after round 8 runs each of the four hooks against a refresh that
  sleeps and exits 7 and asserts the hook exits 0 within three seconds — red with
  the block run in the foreground.

## Recorded, not resolved here

- **Development-hook executable trust** (round 7, both seats; round 8 called it a
  separate policy question): if checkout-local executables in this package's own
  git hooks are to be prohibited, that applies to every block of
  `install-hooks.sh`, not to this one.
- **A false positive in the council's egress row `review-assignment`**: it reads
  `o.token === 'string'` as an assignment of the value `==`, after which the run
  refuses every payload containing `==`. It blocked one round of this review;
  the branch renamed the field to `nonce` instead of touching the egress rules.
- `agents/map/` is serialized by the lock but not published as one atomic
  generation; a reader opening it mid-redraw can see a mix.
- Windows hosts get no session refresh: the CLI shim there is a `.cmd` that needs a
  shell to spawn, and the concern does nothing rather than invoke one.
