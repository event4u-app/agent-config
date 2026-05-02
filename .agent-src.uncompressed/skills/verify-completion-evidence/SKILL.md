---
name: verify-completion-evidence
description: "Use when claiming 'done', suggesting a commit, push, or PR — runs the evidence gate so completion claims come from fresh output in this message, not memory or earlier runs."
source: package
---

# verify-completion-evidence

## When to use

* Just before claiming a task, feature, fix, or refactor is complete
* Just before proposing `/commit`, `/create-pr`, or pushing
* Before answering "is it ready?", "can I merge?", "does it work?"
* After a sequence of edits, when next step would be reporting to the user
* Whenever the wording "should work", "looks good", "probably fine" is
  about to appear in a reply

Do NOT use when:

* Still actively editing — run targeted tests, not the full gate
* Pure documentation changes with no executable impact
* The user explicitly asks for a draft / exploration, not a final answer

## Goal

Make every completion claim **traceable to captured output from this
message**. No claim survives unless the command that proves it was run
and its output was read inside the current turn.

## The Iron Law

```
NO COMPLETION CLAIMS WITHOUT FRESH EVIDENCE IN THIS MESSAGE.
```

"I already ran it earlier in the conversation" does not count. Earlier
runs are stale the moment another edit lands.

## Procedure

### 1. Identify the claim you are about to make

Examples: *"all tests pass"*, *"this is ready for PR"*, *"the refactor
is done"*, *"the bug is fixed"*.

Each claim maps to a specific verification command. Write down the
mapping before running anything:

| Claim | Evidence command |
|---|---|
| "tests pass" | full or targeted test suite |
| "no static errors" | PHPStan / TypeScript / mypy on changed scope |
| "style is clean" | ECS / Prettier / ESLint |
| "no automated refactor pending" | Rector --dry-run clean |
| "endpoint works" | curl / Postman / integration test output |
| "UI renders" | Playwright snapshot or manual browser check |
| "bug is fixed" | regression test passes |

### 2. Run the command fresh

* Run against the current working tree, not a cached summary.
* For PHP projects inside Docker: run inside the container (see
  [`docker`](../docker/SKILL.md) and [`tests-execute`](../tests-execute/SKILL.md)).
* Use targeted runs during iteration (`--filter=`, `--testNamePattern`).
  Run the full suite only in the final verification pass.

### 3. Read the full output

* Check the exit code.
* Count failures, errors, warnings.
* Do not rely on the last line — scroll through the output for
  deprecations, skipped tests, silent retries.

### 4. Match output against the claim

Ask: *"Does this output actually support what I am about to say?"*

* 248/250 tests passed with 2 skipped → do not say "all green"; name the skips.
* PHPStan exit 0 but only analyzed one file → do not say "no static
  errors"; name the scope that was checked.
* `curl` returned 200 → check the body, not just the status.

### 5. Only then make the claim

Reference the evidence: *"Tests: 250/250 passed. PHPStan: level 8, 0
errors on `app/Services/`."* — not *"everything looks good"*.

## The end-of-work sequence (PHP projects)

When all code changes are done and you are ready to report completion:

1. **Targeted tests** — the test(s) covering the changed code pass
2. **Full test suite** — only after targeted pass is green
3. **PHPStan** → **Rector --dry-run** → **ECS** → **PHPStan** (second pass
   catches issues Rector / ECS may have introduced)
4. Fix any output from steps 1–3 and restart the sequence
5. Only then: claim completion or suggest `/commit`, push, or PR

Do not run the full quality pipeline between intermediate edits — it
burns time and tokens. Use it once, at the end.

See [`quality-tools`](../quality-tools/SKILL.md) for the exact commands
per tool.

## Minimum evidence per task type

| Task type | Required evidence |
|---|---|
| Code change (logic) | Targeted tests + PHPStan on changed scope |
| New feature | Tests (new + suite) + PHPStan + smoke check (curl/UI) |
| Bug fix | Regression test (RED → GREEN) + full suite |
| Refactoring | Full suite + PHPStan + Rector dry-run |
| Config / env change | Relevant command or service output (not just file diff) |
| Migration | Migration run output + rollback dry-run + tests |
| API endpoint | HTTP response body + status + content-type |
| Frontend component | Rendered state (Playwright or manual) + unit tests |
| Documentation only | No verification needed |

**Never accept** as proof: "should work", "looks correct", "the logic
is sound", "compiles" (unless compilation itself is the contract).

## Output format

When reporting completion to the user:

1. **What was changed** — one line summary per changed file / component
2. **Verification run** — the exact command and its exit code
3. **Result** — numeric breakdown (tests passed/failed/skipped, errors,
   warnings)
4. **Caveats** — anything the output flagged but you chose to accept
5. **Next step** — e.g. "Ready for `/commit`" or "Awaiting review"

## Gotchas

* A "no output" result from a linter is not proof it ran — check the
  exit code and the analyzed-file count.
* Silencing a warning with `@phpstan-ignore-next-line` or `// @ts-expect-error`
  without a reason code passes the linter but defers the real problem.
* Running tests with `--stop-on-failure` then reporting "passed" — it
  only ran until the first failure; the green streak after it is
  unexamined.
* Cached static-analysis results (`--cache` directories) can report
  clean after you have broken something; clear the cache when the
  change is large.
* Running the test suite on the wrong branch (forgot to switch or
  rebase) — verify `git status` and `git log -1` before the final gate.
* A previously green PHPStan run in the same conversation is stale as
  soon as any edit lands. Run it again.

## Red flags — STOP and run the gate

* About to write "done", "ready", "works", "passes" without a
  command-output reference in the same message
* About to suggest `/commit` / push / PR without a verification block
* Relying on an earlier-in-conversation test run
* Partial evidence (tests green, PHPStan not run — or vice versa)
* "The failing test is unrelated, let me skip it" — verify first, then
  decide
* Reporting a green run by paraphrasing instead of quoting exit code
  and counts

## Do NOT

* Do NOT claim completion without running the mapping command in this
  message
* Do NOT trust a summary written earlier in the conversation
* Do NOT suppress warnings or skip tests to pass the gate
* Do NOT report only the last line of output — read the whole thing
* Do NOT run the full quality pipeline between intermediate edits —
  run it once at the end

## When to hand over to another skill

* Exact PHPStan / Rector / ECS commands → [`quality-tools`](../quality-tools/SKILL.md)
* Running tests inside Docker → [`tests-execute`](../tests-execute/SKILL.md)
* Writing the regression test that the gate requires →
  [`test-driven-development`](../test-driven-development/SKILL.md)
* Diagnosing why the gate failed → [`systematic-debugging`](../systematic-debugging/SKILL.md)
* Committing once the gate is green → [`git-workflow`](../git-workflow/SKILL.md)

## Validation checklist

Before sending a completion message:

* [ ] Every claim in the message maps to a command run in this turn
* [ ] Exit code of each command is read and matches the claim
* [ ] Output is quoted with numeric counts, not paraphrased
* [ ] No warnings or skips are hidden
* [ ] Targeted tests green → full suite green → quality pipeline clean
* [ ] `git status` reflects only the intended change set
