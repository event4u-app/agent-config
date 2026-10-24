---
proposed_by: claude-opus-5.5 session ab54e45a (feat/code-graph-auto-refresh), on the owner's request of 2026-10-23
implemented_by: claude-opus-5.5 session ab54e45a (feat/code-graph-auto-refresh)
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), sixteen rounds of 2026-10-23/24
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: c55ba2cb2162eb09b24712b6fe644b4dc2df49685491d57dbf42840bc7cc34b1
---

<!-- evidence-type: ratification -->

# Code-graph auto-refresh — ratified 2/2 after sixteen rounds

**Final state (rounds 9–16, 2026-10-24).** The header now answers for the change as it
merges into PR #2603's branch: the auto-refresh (rounds 1–8 below), the three follow-ups,
and a hook-bundle ceiling raise. The gated set against that base is
`hook-bundle-budget.json`, `hook_manifest.yaml` + its compiled twin, and
`_lib/egress_rules.ts`.

| Round | anthropic | openai | What it found or decided |
|---|---|---|---|
| 9 | confirmed-non-expanding | refused | the egress head `=(?![=>])` lost the shell form `name==value`; `map-render.json` had no contract; no test for a failed second rename |
| 10 | confirmed-non-expanding | refused | the map tests were missing from the prompt; `swapIn` had no protection against concurrent writers; rollback failure undefined |
| 11 | ratified | ratified | head `(?::|=(?!==|=\s|>)=?)`; `buildMap` enforces a single writer (in-process and across processes via the refresh lock); a failed restore names the old generation's path |
| 12 | ratified | ratified | raise 1,550,500 → 1,551,000 after the merge onto #2603 (each branch fit alone, together 117 B over; moving `handoff-context` out was measured at a 319–581 KB chunk per `session_start` and refused) — on the condition that #2603's dropped `provider_id` check comes back and the final size is recorded |
| 13 | ratified | ratified | the condition carried out: the check restored, final 1,550,751 / 1,551,000 B in the raise_log |
| 14 | refused | refused | a review follow-up another session pushed to the branch (merged in whole): its CLI probe, outcome records, graph-generation map freshness and working-tree discard kept; its 30-minute reclaim of a live same-host owner and its automatic clearing of a leftover reclaim mutex both refused |
| 15 | ratified | refused | age cap only for another host's owner (documented availability compromise), mutex clearing reverted (status names a leftover), real four-process contention test, capability check via `cliPackage()` — refused only because a record without `host` was judged as local |
| 16 | ratified | ratified | a host-less owner is judged by age alone; the contention test asserts clean exits and no remaining holder |

The concern's chunk ceiling, new in this PR, was re-derived to 15,400 B after the follow-up
grew the chunk (14,284 B measured); round 14's prompt carried that change.

The three items the round-8 record left open are resolved in this PR
(roadmap `road-to-code-graph-refresh-follow-ups`, archived): the egress false positive,
one-generation map publication, and the development-hook install boundary with its
trust model stated in `install-hooks.sh`. Windows hosts still get no session refresh.

---

## Rounds 1–8 (2026-10-23) — confirmed-non-expanding 2/2, after seven refusals

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
