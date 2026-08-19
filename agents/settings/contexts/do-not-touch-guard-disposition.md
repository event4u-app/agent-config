# Disposition — the `do_not_touch` write-guard, and the field contract under it

**Decided 2026-08-19.** Blind two-member council, 2/2 concluded, unanimous on the
shape. Recorded here rather than in a council session file because that file is
gitignored and auto-pruned, and the conclusion outlives it
(`no-roadmap-references`).

## The question

`road-to-inbox-harvest-2026-08-b-dispatch-safety` § 3.4 asked for a
`pre_tool_use` concern that warns when a write targets a path the current
handoff envelope listed under `do_not_touch`. The step had been left open by its
own authors with a stated measurement: the field had zero non-empty producers, so
a concern reading it on every tool call would read an always-absent list.

## What the tree said that the step did not have

`validateRecycleEnvelope` applied the ref **character budget** to
`do_not_touch` and **no shape rule at all** (`checkList` asserts only "array of
single lines within a budget"). So a field documented as "a list of path refs"
accepted arbitrary prose — and the one real non-empty instance, written by a
composing model on a maintainer machine, was prose sentences naming files.

That reframes the blocker. It was not "wait for data to accumulate". Nothing in
the tree made the data path-shaped, so the count of matchable entries would have
stayed zero indefinitely and the step was blocked on a condition nothing could
satisfy. A blocker nobody can discharge is a cancellation wearing a deferral's
clothes.

## The decision

1. **The shape is enforced, hard, at both call sites** — `isPathRef` in
   `src/scripts/_lib/subagent_capsule.ts`, applied to `do_not_touch` only. A
   violating entry is named in the error, because "one of your twelve entries is
   wrong" is not actionable.
2. **The guard is preserved, not dropped** — relocated intact to
   `road-to-subagent-lifecycle-integrity` Phase 4 Step 4, blocked on two
   conditions that are now measurable: a real producer emitting non-empty
   path-shaped entries, and a per-turn cost decision for what would be the
   twelfth `pre_tool_use` concern.
3. **`road-to-inbox-harvest-2026-08-b-dispatch-safety` archives**, its last step
   closed by this decision.

## The council's own hedge, and why the tree overrules it

Both members qualified the hard error with a migration worry — one called it a
"one-time local correction", the other made staged create-vs-read enforcement its
explicit fallback *if a hard failure would abort recycling without a repair path*.

Neither hedge survives contact with the file:

- The envelope expires at `RECYCLE_MAX_AGE_HOURS = 48`
  (`_lib/recycle_envelope_paths.ts:26`) and is discarded on read past it. There
  is no "legacy state" class to migrate — the entire population a hard check
  could break is at most two days old and regenerates on the next recycle.
- The write path (`_cli/cmd_session_recycle.ts:205`) refuses with an itemised
  violation list and writes nothing, so the composing session sees exactly which
  entry is wrong. That is a repair path.
- The module states the governing precedent itself, for the v2→v3 required-field
  bump: *"an envelope is consume-once and expires in hours, so the migration
  window is a session, not a release."* The same reasoning already licensed a
  strictly harder break in this file.

So: one hard rule, both call sites, no staged mode. Staged enforcement would have
been two semantic modes bought for a population that does not exist.

## The grammar, and why it is only whitespace

`isPathRef` rejects entries containing whitespace and nothing else. The narrower
candidate raised in council — a character class such as `^[a-zA-Z0-9/_.-]+$` —
rejects entries this tree really uses (a sibling worktree ref, a glob, a
`file:line` ref), and a rule that rejects valid input to catch invalid input is
worse than the gap. Whitespace is what separates one token from a sentence, which
is the only distinction the failure needed.

**Stated default, not a measured optimum:** zero tracked paths in this repo carry
whitespace, so the rule costs nothing here. *Revisit-if* a consumer legitimately
needs a path containing a space — that calls for a quoting convention, not a
wider character class.

## Known and deliberately not fixed here

The same construct — a list field whose own documentation calls its entries
paths, validated by `checkList` + `MAX_REF_CHARS` with no shape rule — recurs at
**four** further sites in `subagent_capsule.ts`: `touched_files` (:227),
`open_worker_envelopes` (:662), `artifact_paths` (:663), `uncommitted_paths`
(:689). They are left alone on purpose, and the reason is not tidiness:
`uncommitted_paths` is machine-generated from git status, which **quotes** a path
containing a space, so extending the rule there needs its own verification rather
than a copy of this one. `suggested_skills` (:664) is not in the set at all — it
carries skill names, not paths — and `assumptions.basis` is explicitly "file:line,
id, path, **or command**", where a command with spaces is legal.
