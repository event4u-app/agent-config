# A verify-expectation ratchet, replayed against thirty real merges

<!-- evidence-type: analysis -->

> **Produced by:** `./scripts-run src/scripts/check_verify_expectation_delta --replay 30`
> over `origin/main` at `a03f60c46` on 2026-10-01. Step 2.1 of
> `road-to-roadmap-claims-with-a-shape`. Rerun the command to reproduce every
> number below.

## The question

Step 2.2 proposes a diff-scoped check: an added or changed `verify:` clause
that names a command and no expectation fails. Before writing it, the cost had
to be known — a gate that reds a quarter of ordinary merges gets weakened until
it finds nothing, and the roadmap's own D2 records the threshold it would be
withdrawn at ("2.1 shows the false-positive share above one in four").

So the proposed rule was **replayed** against the last thirty merges on
`origin/main` that touched `agents/roadmaps/*.md`, each diffed against its own
first parent.

## What the replay found

| | Count |
|---|---|
| Merges replayed | 30 |
| Added command-bearing `verify:` clauses across them | 145 |
| …carrying an expectation already | 96 |
| …**bare** — a command, no expectation | **49** |
| …bare **after the pointer carve-out below** — what the shipped gate fires on | **41** |
| **Merges that would have gone red** | **6 of 30 (20%)** |

The shipped `--replay` prints the 41, because that is what the gate does; the 49
is the same replay read before the carve-out, and it is kept here because the
difference between the two numbers is the finding in the next section.

20% is under the one-in-four threshold D2 names, so the ratchet stands as
designed. The distribution matters more than the share: of the 41 the gate would
fire on, **31 sit in a single merge** (`3671542d0`, the September inbox round
that added twenty-two roadmaps at once). The other five merges carry 5, 2, 1, 1
and 1. A normal roadmap-touching merge carries one bare clause or none; the rule
is cheap except on a bulk-authoring round, which is exactly the change that
should be asked to state its oracles. The carve-out does not change which merges
are red — all eight pointers sit inside `3671542d0`, which is red for 31 other
reasons.

## Of the 49 bare clauses, how many could carry `-> 0` without loss

| Class | Count | What the gate should do |
|---|---|---|
| A real command whose exit status already decides | 34 | demand an expectation — `-> 0` is free and real |
| A real command whose exit status decides nothing | 7 | demand an expectation — but `-> /regex/`, not `-> 0` |
| **Not a command at all** — a backticked file path or test id | **8** | **must not fire** |

### The third class is the one finding that changed the design

Eight of the 49 — one in six — are not commands. They are backticked file paths
and test identifiers written after `verify:`, which the shared clause parser
reads as commands because a backticked token after the label is what a command
looks like to it:

```
tests/scripts/block_plumbing_writes.test.ts
tests/scripts/dispatch_integrity.test.ts
tests/scripts/hooks/dispatch_hook.test.ts
tests/eval/routing-matrix/README.md
tests/scripts/verification_evidence.test.ts
turn_end_gate_hook.test.ts:1427
docs/CLAIMS.md
ONBOARDING.md
```

Demanding `-> 0` from `` `docs/CLAIMS.md` `` is nonsense, and a gate that does
it teaches authors to paste a meaningless arrow — Risk 2 of the roadmap arriving
through the front door. So the shipped check carves these out by shape: a
single-token backticked value ending in a source or document extension, with an
optional `:line` suffix, is a POINTER and not a command. The carve-out is
narrow on purpose — anything with a space in it is a command, so `cat file.md`
still has to state its oracle.

This also leaves the parser alone. Widening `verify_clause.ts` to reject
pointers would change what `closure_scan` and the run-continuation hook see, and
those two readers were measured on the current grammar.

### The seven that need a regex rather than an exit code

```
grep -c "comparison" src/scripts/external_sources_denylist.json
grep -c 'cannot decide' src/scripts/self_review_gate.ts          (x2 — same clause, two merges)
grep -c 'expected' tests/design-artifacts/fixtures/ui-conformance/README.md
grep -c "comparison" …                                            (x2 — same clause, two merges)
git log --oneline -- src/agent-src/templates/roadmaps.md | head -3
wc -w src/skills/test-case-discovery/SKILL.md
```

`grep -c` exits 0 on a count of zero, and `wc` and `head` exit 0 on anything, so
`-> 0` on any of these is an expectation that still cannot fail. The gate's
refusal message names the regex form for exactly this reason; it cannot tell
which form a clause needs, and a gate that guessed would be wrong seven times in
49.

## What this grounds

1. The false-positive share is 20%, under D2's withdrawal threshold, and
   concentrated in one bulk-authoring merge rather than spread across ordinary
   ones.
2. Backticked pointers are carved out by shape, measured at 8 of 49 rather than
   assumed.
3. `-> 0` is a real oracle for 34 of the 41 genuine commands and a vacuous one
   for 7, so the refusal message names both forms instead of recommending the
   exit code.
4. Nothing here argues for gating the estate. 173 clauses sit in the active tree
   and most carry no expectation; diff-scoping is what keeps this a control
   rather than a 139-file backlog.
