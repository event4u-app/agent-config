<!-- evidence-type: analysis -->

# One verification classifier — the before and after reading, and one live host probe

Produced by `agents/roadmaps/road-to-one-verification-classifier.md` steps 2.3 and 2.4.
Both readings were taken on 2026-09-30 against the same corpus by the same instrument,
`measure_turn_end_gate --store ~/.claude/projects/<this repo>`. The "before" reading was
taken by restoring the pre-fix selector from `HEAD~1` into the working tree, measuring,
and restoring `HEAD` — so the two differ in the selector and in nothing else.

## Corpus

**30 sessions · 184 turns · ~2157 assistant entries.** Turns that edited a file at all:
**43** — detector C's precondition, printed because a rate over all turns is not a rate
over the turns the detector can apply to.

## Detector C, before and after

| Detector | Before | After | Delta |
|---|---|---|---|
| A (promissory) | 10 turns · 5.4 % | 10 turns · 5.4 % | 0 |
| B (language) | 85 turns · 46.2 % | 85 turns · 46.2 % | 0 |
| **C (unverified edit)** | **13 turns · 7.1 %** | **18 turns · 9.8 %** | **+5 turns** |
| E (dropped) | 5 turns · 2.7 % | 5 turns · 2.7 % | 0 |
| F (untested) | 0 turns | 0 turns | 0 |

Only C moves, which is the change's whole surface — A, B, E and F read the reply text and
never the command list, so their invariance is a check on the measurement rather than a
finding about the fix.

**The direction is the intended one and the sign matters.** C fires MORE often after the
change, because commands that used to clear an unverified edit no longer do: the pre-fix
selector matched a verification token anywhere on the line, so `ls tests`, `cat build.log`
and `echo test` all cleared it. Five turns in this corpus were being let through on a word
match. Risk 1 of the roadmap is that a combined fire rate moves with neither side
attributable; here the two sides are separable by construction, because the G1 and G2
fixtures pin each direction against the regex it refuted (`verification_command_anchoring.test.ts`).

**What this reading is not.** It is a fire-rate delta, not a precision measurement. None of
the five newly-caught turns was hand-checked to confirm it genuinely lacked verification;
the claim here is only that the selector no longer clears on an argument-position token,
which the fixtures prove directly. A precision reading would need a labelled corpus that
does not exist.

## Step 2.3 — per-host rows, and why only one is filled

The step's own instruction: *"No row may be inferred; an unprobed host reads `unknown`."*

| Host | Tool output on `post_tool_use` | Failed exit distinguishable | Observed field | Probe date |
|---|---|---|---|---|
| `claude` | **yes** | **partially — see below** | `exit_code`, `exit_source: "response_shape"`, `stdout_tail`, `stderr_tail` | 2026-09-30 |
| `augment` | unknown | unknown | — | — |
| `cursor` | unknown | unknown | — | — |
| `cline` | unknown | unknown | — | — |
| `gemini` | unknown | unknown | — | — |
| `windsurf` | unknown | unknown | — | — |
| `copilot` | unknown | unknown | — | — |
| `cowork` | unknown | unknown | — | — |

The `claude` row is a **live** probe, not a fixture reading: it is taken from this
session's own witness file under `agents/state/verify-before-complete/`, written by the
hook while the session ran. A representative record:

```json
{"command":"npx vitest run …","tool":"Bash","exit_code":0,
 "exit_source":"response_shape","stdout_tail":" Tests  1 passed …",
 "runner":"vitest","after_edits":15,"at":"2026-09-30T21:50:26+00:00"}
```

So on `claude`: output is surfaced, the exit code is present and its provenance is
recorded, and the ordinal `after_edits` comparison detector C needs is populated.

**Why the second column reads `partially` rather than `yes`.** Across 24 records in this
session's witness, **zero carried a non-zero `exit_code`** — including after a command
that genuinely failed (`npx tsc --noEmit <missing file>`, exit 2), which does not appear
in `verification_runs` at all. That is not explained by the per-turn cap:
`_cap_runs` deliberately preserves the *earliest failing record* alongside the newest 23,
so a recorded failure should have survived eviction. Either the failure was never
recorded, or it was recorded and the preservation rule did not hold.

**This is an observation with an undetermined cause, and it is filed as one.** Writing
`yes` on the strength of the fixtures — which do feed non-zero exits and do classify them
correctly — would be asserting about the host what was only demonstrated about the parser.
The dedicated probe this needs is a failing command observed end to end with the raw
`post_tool_use` envelope captured, which this run did not do.

It matters because it is the direction that fails silently: if a failing verification is
not recorded on a host, detector C's record path sees a turn with no failing run and the
transcript fallback sees a verification command by name — which is the pre-fix behaviour
for exactly the case the record path exists to catch. Risk 2 of the roadmap names this
shape ("a host that surfaces no tool output keeps today's name-match behaviour while the
page reads as fixed"); what is new here is that it may also apply to a host that surfaces
output for *passing* runs.
