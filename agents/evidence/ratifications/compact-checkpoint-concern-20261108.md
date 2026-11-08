---
proposed_by: the repository owner, in session on 2026-11-08 ("hol die roadmap aus later und starte phase 1", then "commit, PR und merge wenn grün")
implemented_by: claude-opus-5.5 session on feat/compact-checkpoint-phase-1
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 1-15 of 2026-11-08
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 59020ae84e32ac864339f0251510d06414ec6ae4b71b77a5adfbf86871989726
---

<!-- evidence-type: ratification -->

# Ratification — the compact-checkpoint concern and its budget row

`check_kernel_edit_ratified` gates three files on this branch:
`src/scripts/hook_manifest.yaml`, its compiled `hook_manifest.json`, and
`src/config/hook-bundle-budget.json`. The `subject:` digest above covers them,
computed with
`./scripts-run src/scripts/ratification_subject --files <the branch's changed files>`
at commit `22adcaee0d`. Named for the branch, because the pre-push gate reads
this file before the pull request exists.

## What was ratified

A new concern, `compact-checkpoint`, bound on claude only to `pre_compact` and
`session_start`, loaded as a lazy chunk with its own ceiling row (20,200 B; measured
18,296 B). At `pre_compact` it writes a keys-only
marker (session key, transcript hash, package version, time, random
generation) under the user-global runtime directory; at `session_start` with
source `compact` it classifies what an injection would have met and consumes
the marker. It prints nothing, injects nothing and exits 0 on every path. The
main dispatch-bundle ceiling is unchanged.

**The authority it adds:** file creation, replacement, append and deletion
under `~/.event4u/agent-config/state/compact-checkpoint/`, and reading the
package's own `package.json`. Both seats judged that expansion acceptable for
a telemetry-only concern in the final round; neither found a path to the
model's context, a denial, a rewrite, or a weakened gate.

## How the verdict was reached

Fifteen rounds, prompts committed verbatim under `agents/evidence/council/`
(`compact-checkpoint-concern-20261108.question.md` for round 1,
`.roundN.question.md` for rounds 2-15). Every round before 15 ended in
`request_changes` or `refused` on a concrete defect, each fixed with a
regression test shown red before the fix and green after:

| Rounds | Defect class found | Resolution |
|---|---|---|
| 1-2 | malformed marker read as a match; unbounded log; predictable temp name; symlinks | validation, bounds, random `wx` temp files, symlink refusal |
| 3-5 | unguarded reads reachable through shared readers (counters, claims, roadmap, git refs, package.json); FIFOs | the marker stopped carrying task state, so no shared reader is called; one bounded, non-following, non-blocking reader |
| 6 | repository-supplied paths and a check-then-mkdir race | storage moved to the user-global runtime directory |
| 7-12 | retention, sweep work bound, sweep completeness, capacity reserve, cleanup progress claims | 24 h sweep bounded by entries inspected; writes only below 480 while a sweep reads 512; the comment states progress, not a hard ceiling |
| 13-14 | same-session replacement between read and removal; identical timestamps | removal compares a per-marker random generation; invalid files are removed only if still invalid |
| 15 | none blocking | — |

**Round 15, anthropic:** "RATIFIED — This expands authority … and the
expansion is acceptable within its telemetry-only scope." Blocking defects:
none.

**Round 15, openai:** "The filesystem authority expansion is acceptable for
this telemetry feature … Merge-blocking defects: None established by the
supplied material. … APPROVE."

## Follow-ups both seats listed as non-blocking

- `mkfifo`-based tests are POSIX-only; guard them if Windows becomes a test platform.
- An end-to-end replacement-during-observation test would need internals exposed; the components are tested.
- The cleanup progress argument assumes fewer than `SWEEP_MAX` non-expiring foreign files in the directory; the comment says so.
- The read-compare-remove windows are narrowed, not closed, without a cross-process lock; documented.

## Process note

The council's verdicts are recorded as given. The number of rounds reflects a
change whose first design reached into shared, unguarded readers; the round-4
redesign (no task state in the marker) and the round-6 move out of the
repository removed whole defect classes rather than patching instances.
