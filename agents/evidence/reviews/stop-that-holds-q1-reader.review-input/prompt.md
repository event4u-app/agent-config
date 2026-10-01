# Review prompt — stop-that-holds-q1-reader

Committed verbatim per `evaluator-independence` item 3: a recorded verdict whose
prompt is not recoverable is not evidence, because nobody can check what was
asked. The text below is exactly what the reviewing subagent received.

- **dispatched:** 2026-10-01
- **head:** `c816686953a0331d840629148685de462abea3a0`
- **base:** `origin/main` (`9f2b9fb4a`)
- **scope:** the whole branch diff, `origin/main...HEAD`, 6 files — not a subset
  chosen by the author.
- **reviewer:** fresh general-purpose subagent, no prior context from this session.

---

```text
Review a branch diff in the `event4u/agent-config` repository and report what
you find.

WHERE
  Worktree: /Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/.claude/worktrees/agent-aa1a7823899170595
  Run every command from that directory with absolute paths. `node_modules` is
  installed. Do not `cd` to the parent checkout.

SCOPE
  The whole diff `origin/main...HEAD`. Six files:
    src/scripts/_lib/turn_end_refusals.ts
    src/scripts/measure_turn_end_gate.ts
    tests/scripts/turn_end_refusals.test.ts
    tests/scripts/measure_turn_end_gate.test.ts
    docs/contracts/turn-end-detector-demotion.md
    agents/roadmaps/road-to-a-stop-that-holds.md
  Review all six. Do not narrow the scope.

WHAT THE BRANCH CLAIMS TO DO
  It adds a reader for a quantity the repository calls Q1 — a "re-refusal
  share" — over per-session shadow records the turn-end stop gate writes under
  agents/runtime/state/turn-end-gate/*.shadow.json. It adds aggregation
  (`collectShadowStats`, `q1For`) and a renderer (`renderQ1`) with a `--q1`
  flag. It edits a contract that previously described Q1 as "inert". It also
  edits a roadmap: one step flipped to done, five steps and three acceptance
  criteria flipped to a deferred marker, and several blocker entries rewritten
  — including one whose shell probe the branch claims was counting the wrong
  thing.

WHAT TO DO
  Read the diff. Read the files around it as far as you need. Run whatever you
  want read-only: single-file `npx vitest run <file>`, `npm run typecheck`,
  `./scripts-run src/scripts/<gate>`. Do NOT run a full vitest suite — other
  agents are running concurrently and concurrent full runs produce false
  failures. Do not commit, push, or modify tracked files.

  Report findings with `file:line`, a severity you choose, and what you
  actually observed. Report anything you find: correctness, safety, tests that
  assert less than they appear to, claims in the prose that the code does not
  support, numbers that do not reproduce, missing downstream updates.

  Questions worth answering, but they are prompts for your attention, not a
  checklist and not the boundary of the review:
    - Is the arithmetic the reader performs the arithmetic the contract and the
      roadmap describe? Numerator, denominator, and what is grouped by what.
    - Does the reader distinguish an absent measurement from a measured zero,
      and does it do so everywhere or only in some paths?
    - Do the new tests fail when the behaviour they name is removed? Pick one
      and check rather than taking the commit message's word for it.
    - The branch replaces a shell probe in a roadmap blocker and asserts the
      old one returned 10 where the true answer was 0. Does that reproduce?
      Does the replacement return what the branch says it returns?
    - The branch asserts an installed binary artifact contains a particular
      fix, and uses that to declare a stated hypothesis falsified. Does that
      reproduce?
    - Are the deferred markers honest? For each step the branch did not close,
      is the stated reason the real obstacle, or is there closable work behind
      it that the branch declined to do?
    - Does any state the branch reads or writes grow without bound?

  Give your own verdict on whether this is mergeable on the evidence you saw.
  Report what you found, including finding nothing.
```
