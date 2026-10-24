<!-- evidence-type: analysis -->

# Check 16 re-inventory and mapping review: the prompts given

D46's behaviour fix changed `check_composite_arming`, so check 16's branch
inventory and mapping review had to be redone. Two separate agent sessions did
that work on 2026-10-24.

Rounds 26 and 27 noted that their independence was asserted rather than shown.
This file records the exact prompts each session received. A reader can then
check two things:

- what each session was allowed to read;
- what it was told about the ledger.

Each session's output is committed in the matching file:

| Session | Output file |
|---|---|
| Inventory | `gate-branch-inventory-20261024.json` (check 16) |
| Review | `gate-branch-mapping-review-20261024.json` (`c16-store-absent`, `c16-store-unreadable`, `c16-armable`) |

What this shows and what it does not:

- **It does show** the boundary each session was given. The inventory session
  was given the source and a list of existing branch ids, and was told not to
  read `agents/`. The review session was given the ledger's row definitions and
  the three proposed mappings. Both are the same inputs the original revision-8
  inventory and review used.
- **It does not show** that a session obeyed its instruction. Nothing in the
  tree can prove that. Both sessions run on the same provider as the author;
  they are separate sessions, not separate providers.

## Prompt 1 — inventory session

> You are producing an independent branch inventory for ONE TypeScript check
> script. Work only in the worktree (use absolute paths; never run anything from
> any other directory). Do not edit, commit or push anything. Do not read any
> file under agents/ (no ledgers, mappings, reviews, roadmaps, council records)
> — your output must be derived from source code only, so it stays independent
> of the classification it will be checked against.
>
> Read: src/scripts/check_composite_arming.ts, and the helpers it calls where a
> branch's effect depends on them (src/scripts/_lib/gate_self_test.ts,
> src/scripts/_lib/gate_ledger.ts, src/scripts/_lib/scan_scope.ts).
>
> Enumerate every branch of a CLI run (`main(argv)`) that ends the run or
> reports a finding: every return of an exit code, every throw that can escape,
> every printed finding/warning, every write mode. For each branch give a JSON
> object: "check"; "id" (a short id prefixed `c16-`, reusing the existing ids
> c16-selftest, c16-store-missing-value, c16-store-unreadable, c16-ledger-skip,
> c16-ledger-throw, c16-accounting-mismatch, c16-all-malformed, c16-dead-scope,
> c16-rethrow, c16-publish, c16-publish-write-throw, c16-malformed-warn,
> c16-not-armable-readings, c16-not-armable-sessions, c16-unusable-dropped where
> the branch is the same thing, and a new descriptive id for a genuinely new
> branch); "where" (exact current line ranges covering the condition and the
> return/throw/print lines, so that every `return 1`/`return 2`/`throw` line
> falls inside some branch's range); "finding"; "effect" (exactly one of
> `error-exit-nonzero`, `throw`, `warning-exit-zero`, `exit-code-only`,
> `warning-exit-nonzero-only-with-flag`); "exit_code"; "predicates".
>
> Return ONLY the JSON array, plus one line stating which ids are new or whose
> behaviour differs from what the id name suggests.

## Prompt 2 — review session

> You are an independent reviewer. Do not edit, commit or push anything. Work
> only read-only in the worktree. You may read
> src/scripts/check_composite_arming.ts to check the branches. Do not read
> anything under agents/ — everything you need is below.
>
> [The five R16 row definitions (R16.a observation, arming verdict; R16.b
> invariant, store yields a usable record; R16.c observation, partial
> malformation; R16.d observation, store absent; R16.e invariant, self-test),
> the nine `op:` categories with their definitions, and the three remapped
> branches with their line ranges, behaviour and proposed target: c16-store-absent
> → R16.d, c16-store-unreadable → op:could-not-run, c16-armable → R16.a.]
>
> For each, give a verdict `agree`, `disagree` (with the row or category you
> suggest) or `unsure` (with what is uncertain), and a reason of at least one
> sentence. Return ONLY a JSON array.

The bracketed passage in Prompt 2 summarises a block the prompt quoted in full.
The quoted row definitions match the ledger rows R16.a to R16.e word for word,
apart from the D46 note on R16.d, which was added after the review.
