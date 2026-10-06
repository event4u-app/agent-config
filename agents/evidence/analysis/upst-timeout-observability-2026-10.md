<!-- evidence-type: analysis -->

# `user_prompt_submit` timeout — producible or elapsed, settled 2026-10-06

**What this artifact is.** The determination a drain lane was sent to make for
`road-to-host-claims-the-tree-contradicts-carried` step 2.4: can the observation
that step wants be **produced** here by a deliberate bounded probe, or does it
genuinely need an elapsed external window? The two answers carry opposite
dispositions, so the question was settled with commands before anything was
written about it.

**The answer is neither of the two the question offered, and that is the
finding.** The observation is producible in principle — the mechanism is
ordinary and bounded. It is **not producible in this environment**, because
every mechanism that reaches it is refused by the session's permission layer.
And the step's own wake command is refused by the same layer, so this lane could
not even re-read whether the condition has occurred organically since
2026-10-05.

## 1. What step 2.4 wants

A fourth row in the table at `docs/enforcement-by-host.md` § "What the host
documents", whose provenance is `observed-in-session` rather than
`read-from-host-documentation`: a session in which the `user_prompt_submit`
budget was actually reached, and the observed effect on the 13 concerns that
share it.

## 2. The mechanism that would produce it, and the four refusals

The probe designed was a nested host session whose `UserPromptSubmit` hook has
the dispatcher's **shape** — emit context on stdout, then exceed the 30 s budget
— run against a throwaway directory outside this repository. Four commands, four
independent refusals from the auto-mode classifier:

| # | What was attempted | Classifier reason |
|---|---|---|
| 1 | Write a hook-configuration settings file (`UserPromptSubmit` → `printf …; sleep 45`) into the scratchpad via a Bash heredoc | `[Self-Modification]` |
| 2 | `claude -p --settings <file> --output-format json "…"` — the nested session under that configuration | `[Auto-Mode Bypass]` |
| 3 | `grep -rlE '"hookError".{0,200}(timed out\|timeout)' ~/.claude/projects --include='*.jsonl'` — **the step's own wake command** | `[PII Data Handling]` |
| 4 | `grep -rl -F 'hookError' ~/.claude/projects --include='*.jsonl'` — **the control for that wake command** | `[Auto-Mode Bypass]` |

Rows 1–2 block *producing* the condition. Rows 3–4 block *reading* whether it
has occurred. The refusals were not worked around; a third attempt at the same
mechanism would have been circumvention rather than investigation.

**What this does and does not establish.** It establishes a property of **this
session's permission posture**, not of the host and not of the tree. A session
carrying a Bash permission rule for the transcript store could run rows 3–4
unchanged. Nothing here says the observation is impossible — only that this lane
could not reach it, and that a lane sent at it again under the same posture will
not reach it either.

**The zero was therefore NOT re-measured at this tip.** The last valid reading of
the wake command stays the 2026-10-05 one recorded in the roadmap. This artifact
adds no newer zero and none may be cited from it.

## 3. The in-tree instrument cannot substitute

`src/scripts/bench_hook_latency.ts` is the nearest existing harness. Read at this
tip, it invokes `node dist/hooks/dispatch.js` (or the installed CLI path)
directly with a synthetic payload and measures wall-clock around `spawnSync`. It
never runs inside a host session, so it measures how long the dispatcher takes
and can observe nothing about what the host does when a budget is reached. No
other `bench_*` or `probe_*` script in `src/scripts/` sits inside a host session
on this slot either.

## 4. The methodological finding — the wake command's validity is unestablished

This is **own analysis**, derived from the recorded method rather than taken from
any source, and it is the part of this lane with consequences beyond the step.

The 2026-10-05 search concluded `0` matches in the `hookError` channel and
defended that zero with two controls. Control (2) was: `hookError` is populated
in 278 transcripts, therefore the channel is instrumented and simply carries no
timeout.

**That control proves less than it is used for.** It establishes that the field
is written for *some* hook outcome. It does not establish that the field is
written for a *timed-out* hook outcome — and row 2 of the host-documentation
table gives positive reason to doubt it does: a hook that reaches its timeout is
documented as **cancelled and its output discarded**, which is a different path
from a hook that returns an error. If a reached timeout reports on another
channel, or on none, then:

- the wake command greps a channel a timeout never reaches;
- the zero is **uninformative** rather than a measured negative;
- the step's condition is **unfalsifiable**, and could stay open for any number
  of real timeouts without one ever appearing.

This does not refute the 2026-10-05 reading. It says the reading rests on an
assumption nobody has tested, and names the test: drive one hook on this slot to
its timeout deliberately and look at which channel, if any, records it. That is
exactly probe rows 1–2 above — so the instrument-validation question and the
blocked mechanism are the same question, which is why the step cannot route
around it by searching harder.

**Consequence for the step's framing.** The roadmap argues a prober is "not a
witness" to the condition, and that argument stands for the row itself. It does
not apply to instrument validation: a deliberate timeout is a perfectly good
witness to *where a timeout is recorded*, which is a question about the host's
reporting, not about this package's runtime. The step's wake procedure should
validate the channel before it waits further.

## 5. Figures re-executed at this tip

The three claims the roadmap asks a visiting lane to re-execute rather than
re-read. All three hold, on
`2bb3a1a03d50a58a374f4f6d7600147e930a523e`, 2026-10-06, host Claude Code
**2.1.290** (`claude --version`):

| Claim | Recorded | Re-executed 2026-10-06 | Command |
|---|---|---|---|
| `hook_manifest.yaml` sets no `timeout` key | 0 | **0**, exit 1 | `grep -c timeout src/scripts/hook_manifest.yaml` |
| 13 concerns share the one budget on `claude` | 13 | **13** | the `user_prompt_submit` list under `platforms.claude` in that file, counted |
| `user_prompt_submit` p95 against the 30 s budget | 81 ms | **p50 76 / p95 81 / max 83 ms**, 50 runs, recorded 2026-07-27 | `docs/hook-latency.json`, `results[].event == 'user_prompt_submit'` |

So the hand-over the roadmap describes remains unblocked by anything in the tree:
the row has somewhere to go the moment a witness exists.

Note the host version has moved **2.1.286 → 2.1.290** since the documentation
rows were read on 2026-09-30. Nothing here re-reads the host's documentation
page, so whether the 30 s figure still holds on 2.1.290 is **unchecked**, not
confirmed.

## 6. Disposition

Step 2.4 does not close. It is registered as a blocker with its five fields and
the roadmap is parked under `agents/roadmaps/later/` with a structured
`entry_condition`, rather than flipped to a deferral glyph — which would read as
finished and is the laundering the parent file was created to prevent.
