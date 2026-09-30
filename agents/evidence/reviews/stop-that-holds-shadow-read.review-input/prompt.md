# Review prompt — stop-that-holds-shadow-read

Committed verbatim per `evaluator-independence` item 3: a recorded verdict whose
prompt is not recoverable is not evidence, because nobody can check what was
asked. The text below is exactly what the reviewing subagent received.

- **dispatched:** 2026-09-30
- **head:** `54e09d713719e5d3ab72f1216c5c90611733eb95`
- **base:** `origin/main` (`a129277d5`)
- **scope:** the whole branch diff, `origin/main...HEAD`, 6 files — not a subset
  chosen by the author.
- **reviewer:** fresh general-purpose subagent, no prior context from this session.

---

```text
Review a branch diff in the `event4u/agent-config` repository and report what
you find.

WHERE
  Worktree: /Users/mathiasberg/projects/galawork/galawork-packages/event4u/agent-config/.claude/worktrees/agent-adb9c217d1771e758
  Run every command from that directory with absolute paths. `node_modules` is
  installed. Do not `cd` to the parent checkout.

SCOPE
  The whole diff `origin/main...HEAD`. Six files:
    src/scripts/hooks/turn_end_gate_hook.ts
    src/scripts/_lib/turn_end_refusals.ts
    tests/scripts/turn_end_gate_hook.test.ts
    tests/scripts/turn_end_refusals.test.ts
    docs/contracts/turn-end-detector-demotion.md
    agents/roadmaps/road-to-a-stop-that-holds.md
  Review all six. Do not narrow the scope.

WHAT THE BRANCH CLAIMS TO DO
  It restructures the turn-end stop gate's `main()` so detector inputs are
  assembled once, then adds a "shadow read": on either re-entrancy allow path
  (`stop_hook_active`, or the gate's own `refused_turn` marker) it runs the
  detectors without acting on them and records which would have fired again.
  It also promotes six prose obstacles in the roadmap to structured blockers.

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
    - Does the restructured `main()` change any verdict on any path?
    - Can anything in the shadow path wedge or crash a turn?
    - Do the new tests fail when the behaviour they name is removed?
    - Does any state the branch writes grow without bound?
    - Do the roadmap's blockers and its `Resolved when` conditions describe
      what the tree actually contains?

  Give your own verdict on whether this is mergeable on the evidence you saw.
  Report what you found, including finding nothing.
```
