---
proposed_by: claude-opus-5/worktree-agent-a7b7c6cec19bb98e6
implemented_by: claude-opus-5/worktree-agent-a7b7c6cec19bb98e6
reviewed_by: ai-council/kernel-plumbing-3-3-severity-2026-10-03
providers:
  - anthropic
  - openai
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the dispatcher resolves a no-verdict by declared severity

Covers `worktree-agent-a7b7c6cec19bb98e6`, which lands step 3.3 of
`road-to-a-kernel-that-guards-its-plumbing`. Four of its files sit on the
gated-surface list — `src/scripts/hook_manifest.yaml`, its compiled sibling
`src/scripts/hook_manifest.json`, `src/scripts/hooks/dispatch_hook.ts` and
`src/scripts/hooks/exit_codes.ts` through the dispatcher — and the rest are
tests, a roadmap and an evidence artifact. Named for the branch rather than a
PR number, because the pre-push gate reads this file before the pull request
exists.

## Why `ratified` and not `confirmed-non-expanding`

```
THE EXISTENCE OF A SEPARATE `fail_closed:` FIELD IS THE PROOF THAT CRASH POLICY
WAS A DISTINCT DIMENSION. WIDENING `severity` TO ABSORB IT IS AN EXPANSION.
"BRINGING THE RUNTIME INTO LINE WITH THE DECLARATION" WAS THE AUTHOR'S READING
AND BOTH SEATS REFUSED IT.
```

The change was drafted as an alignment: `severity: blocking` already authorises
a refusal, `_is_advisory` already enforces it as a ceiling, so reading it as the
floor too looked like closing a gap rather than opening one. Both reviewers
reached the opposite classification independently and on the same evidence.

The openai seat: "`severity` constrained deliberate verdicts while `fail_closed`
explicitly governed execution failures. `_resolve_execution_failure` gives
`severity` a new meaning: 'must refuse when no verdict exists.'" The anthropic
seat put the corroborating fact beside it — the `turn-end-gate` comment states
`fail_closed: false` was chosen *because* "a crash must let the turn END", which
is a designer treating crash handling as separable from refusal authority.

A field whose only job was to answer this question is strong evidence that
`severity` did not already answer it. The missing D3 record (below) removes the
last candidate source of prior authority. So this is recorded as an expansion.

## What is expanded, and what bounds it

| File | Classification | What it does |
|---|---|---|
| `src/scripts/hooks/dispatch_hook.ts` | **expanding** | `rc >= 3` on a `severity: blocking` concern refuses, where the branch previously read `fail_closed:`; a signalled spawn is a no-verdict instead of an exit 0 |
| `src/scripts/hook_manifest.yaml` | non-expanding | comment-only: says what `fail_closed:` still decides. No concern, slot, severity or flag changed |
| `src/scripts/hook_manifest.json` | non-expanding | the regenerated fingerprint over the YAML above |
| `src/scripts/hooks/exit_codes.ts` | non-expanding | the `authorizedBy` string on the error row, corrected to name what the runtime now reads |

Six of the nine `severity: blocking` concerns gain the power to refuse when they
break. The bounds, each checkable:

- **No concern's declaration changed.** Nine blocking concerns before, nine
  after; the same slots, the same flags. What changed is which field the
  dispatcher consults on one branch.
- **The ceiling is untouched.** `_is_advisory` still downgrades an advisory
  BLOCK to warn, and `_resolve_execution_failure` returns `EXIT_ALLOW` for
  anything that is not an explicit `blocking` — an absent or misspelt severity
  inherits the historical fail-open rather than a refusal it was never granted.
- **The `stop` slot spends its refusal once.** On the retry the host marks with
  `stop_hook_active`, an `rc >= 3` falls back to fail-open and the turn ends. A
  concern that *decided* to refuse returns 1 and never reaches the branch.
- **Every refusal is traceable.** All three no-verdict paths — in-process throw,
  spawn error or timeout, signal termination — write an `execution_failed` row
  to `dispatch-issues.jsonl` before the resolution runs.
- **The escape is printed, not documented.** A `pre_tool_use` refusal produced
  by this branch names `AGENT_CONFIG_HOOKS_ISOLATED=1` and the issue log on
  stderr, because an escape an operator cannot find from inside a wedged
  session is not an escape.

## The blocking finding, and that it was real

Both seats, independently, on the same line:

```ts
const status = proc.status ?? 0;
```

A child terminated by a signal has `status === null` and `signal` set, and
reaches that line with no `proc.error` whenever the signal came from outside
this process — an OOM kill, a supervisor SIGTERM, an abort in the child's own
runtime. The coalescing default read every one of those as exit 0, which is
ALLOW. It had been latent since the spawn path was written and was harmless
while the error band meant fail-open for six of nine blocking concerns; with
this change it is a fail-open at exactly the moment the branch exists to fail
closed.

Fixed. `tests/hooks/fixtures/concern_self_signals.ts` gets the spawned process
killed — it signals its PARENT, because `node_modules/.bin/tsx` runs the script
as a separate child and a self-kill is converted by the wrapper into exit 137,
a status rather than a signal. Two cases: a blocking concern killed this way
refuses, an advisory one allows and the issue row names `SIGKILL`. Both were
seen red against the old `?? 0` before being seen green.

## The D3 record the plan asserts, and that it does not exist

Step 3.3's verify line calls the stop-slot reversal "lane 1's file, this lane's
decision, recorded in the programme as D3", and the plan's Prerequisites assert
that D3 and D4 "are recorded". An exhaustive search of this repository finds
neither. The line came verbatim from an externally supplied draft and carries no
`file:line`, so it was never verified.

That is stated here rather than quietly dropped, because it is the reason this
review exists: the reversal of a recorded crash policy shipped with no prior
authority behind it, and this artifact is now that authority. The anthropic seat
judged the gap documentation rather than defect and the openai seat judged it
part of the ratification case; both are compatible with recording it.

## What the reviewers found, and what changed because of it

| # | Seat | Finding | Disposition |
|---|---|---|---|
| 1 | both | `proc.status ?? 0` fails open on a signalled child | **fixed**, with a fixture and two cases, each seen red first |
| 2 | both | classify as `ratified`, not `confirmed-non-expanding` | **accepted** — this artifact |
| 3 | both | `fail_closed:` comments explain a decision the flag no longer makes | **fixed** — the comments now say the flag decides the stdin-read-failure deny, and changing it changes that |
| 4 | openai | the contract claims every `rc >= 3` logs a "full traceback" | **fixed** — the row names the diagnostic each failure actually produces |
| 5 | openai | two different window tallies inside one diff (66/22 in a comment, 69/23 in the context) | **fixed** — no count is repeated in code; the comment carries the artifact path |
| 6 | both | `pre_tool_use` denial is unbounded and the escape is undiscoverable | **partly fixed** — the asymmetry is stated in the contract and the escape is printed beside the refusal. No circuit breaker or retry budget is added; that is a larger change than this step |
| 7 | both | a synchronous in-process hang still wedges and no clause releases it | **recorded, not fixed** — stated in the contract as an unbounded case. Bounding it needs preemptible isolation, not more timing data |
| 8 | both | the `sla_ms × 3` refusal is correct | **no change** — the narrowing stands, with the measurement in the roadmap and the evidence artifact |
| 9 | anthropic | no incremental rollout for nine concerns at once | **not taken** — recorded here. The six that change are already repo-owned and CI-exercised, and a per-concern flag would re-introduce the second policy dimension this change removes |
| 10 | openai | the title understates the blast radius; this is a policy bundle | **accepted** — the PR body presents the three separable concerns |

Finding 5 is worth keeping for its shape rather than its size: a safety
justification that embeds a count in an implementation comment will eventually
embed a stale one, and the fix is a path, not a more careful paste.

## A gap the extraction surfaced, recorded rather than accepted

`dispatch_hook.ts` sat at exactly 1,500 lines on `main` — precisely on the
`check_source_size_budget` cap — so the step's additions were a ratchet
violation on arrival. The fix was the move the ratchet's own doctrine asks for:
the no-verdict policy now lives in `src/scripts/hooks/concern_failure_policy.ts`
and the dispatcher re-exports it, so no importer changed.

**The gated-surface pattern did not follow it.**
`check_kernel_edit_ratified`'s regex names `src/scripts/hooks/dispatch_hook.ts`
and `src/scripts/hooks/*-dispatcher.sh` and nothing else under `hooks/`, so
`_resolve_execution_failure` — the function this artifact ratifies — now sits in
a file the ratification gate does not watch. Verified by running the gate on
this diff: three gated surfaces reported, and the new module is not among them.

That is this roadmap's own subject reappearing one file down, and it is stated
rather than left to be discovered. It is deliberately NOT fixed here: widening
the pattern edits the gate, which is on the gated list as the ratification
mechanism itself, so it needs its own ratification and its own change. The
reviewers of this diff reviewed the logic, not the gate, and a self-gated edge
case is exactly the thing not to slip into a diff that was reviewed for
something else.

## What the reviewers could not check

Both seats saw the source diff and the narrative; neither saw the test files,
the repository's callers, the host protocol or the measurement artifacts. The
openai seat named that explicitly ("tests are not demonstrated… this supplied
diff contains no test modifications") and it is accurate about what it was
given. The behavioural matrix it asked for — blocking/advisory/absent severity,
first Stop and marked retry, deliberate `rc = 1`, throw, explicit exit ≥ 3,
signal termination — exists in `tests/scripts/hooks/dispatch_hook.test.ts`, and
the three dispatcher-level cases run the real dispatcher rather than the helper.
The reviewers' inability to confirm that is a property of the review package,
not of the branch, and is recorded rather than used as a rebuttal.
