---
proposed_by: claude-code session 726708e6 (roadmap-process-full run, 2026-10-01)
implemented_by: claude-code session 726708e6 (same session — see § Independence)
reviewed_by: ai-council, 2 of 2 seats present (anthropic, openai), 1 round
providers: [anthropic, openai]
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/tree-keeps-neighbours-20261001`

## What was proposed

`road-to-a-tree-that-keeps-its-neighbours`, all three phases. The subject is
coexistence: this package installs beside other agent packages and was
destroying their artefacts at install time.

| Surface | Change |
|---|---|
| `src/scripts/_lib/host_hook_merge.ts` | new — per-event hook merge by content signature |
| `src/scripts/_lib/json_merge.ts` | the merge primitives, moved out of `install.ts` |
| `src/scripts/_lib/json_pointers.ts` | a shared `hooks.<event>` array records a signature, not a whole-list hash |
| `src/install/host_rule_ownership.ts` | new — ownership for the rule emitter, read from the install manifest |
| `src/scripts/_lib/reserved_name_sweep.ts` | new — the builtin-name sweep, gated on ownership |
| `src/scripts/_lib/neighbour_census.ts` + `_cli/cmd_doctor_neighbours.ts` | new — `doctor neighbours`, seven shape classes |
| **`src/scripts/hook_manifest.yaml`** | **the gated surface** — an `effect:` field on all 62 concerns |
| `src/scripts/lint_hook_manifest.ts` | enum check for `effect:`, plus a `severity` consistency check |
| `src/scripts/code_graph/foreign.ts` | new — adapt a consumer's `links`-shaped graph |
| `src/scripts/code_graph/{types,validate,query,detect,verbs}.ts` | `foreign` joins the guess set; three gate verbs refuse an all-foreign graph |
| `docs/CLAIMS.md` | `surgical-uninstall` names the shared-array case |

## Independence

`proposed_by` and `implemented_by` are the same session, which is the shape the
Iron Law forbids reviewing itself; `reviewed_by` is the council — two seats, two
providers, neither of them the author. Quorum was 0/2 before the run (both seats
read `live_probe: unknown`, which is a cold-start artefact and not an
availability signal) and 2/2 after. Both seats are subscription-authed; spend
$0.0000 against a $0.0000 estimate.

**One seat read the branch directly; the other read the described delta plus
what it could reach.** Both are recorded as such below rather than merged into
one voice, because their findings differ in exactly the place that matters —
the seat that read the tree found a defect the other did not.

## The prompt

Recorded because a verdict whose prompt is not recoverable is not evidence, and
the response file lives under `agents/runtime/`, which is gitignored and pruned.
The prompt gave the branch and the commands to reach it, stated that the gated
surface is one file, described all four commits, and set out the author's claim
that `effect:` expands no authority with the four reasons behind it. It then
asked six open questions: whether the addition is authority-expanding and to
classify it; whether the `severity: blocking` ⟺ `effect: permission` equivalence
holds across all 62; whether the individual values are right; whether anything
else in the diff touches a governance surface the gate did not flag; whether the
new install-side ownership gate is sound or creates a new deletion path; and
whether taking the command HEAD is sufficient to keep a secret out of the
census. It closed with "If you find none in a given area, say so for that area
explicitly rather than omitting it."

It named no expected outcome, in either direction, and carried no statement that
the branch was believed clean. It also stated the host-rule recording gap
against the author's own interest and asked whether reporting it was the right
call.

## Verdict on the gated surface: `confirmed-non-expanding`, 2/2

Both seats found the `effect:` field descriptive. The openai seat stated it
directly: "The metadata and lint constraint do not change hook binding or
runtime capability. No increase in agent power was found." Both confirmed the
`blocking` ⟺ `permission` equivalence holds in both directions across the 62,
conditional on `permission` meaning "can refuse" — which both asked be written
down rather than left implicit, and which now is.

## Three defects found, all taken

The verdict on the gated surface is clean. The verdict on the BRANCH was not:
both seats raised merge-blocking defects elsewhere in the diff, and all three
are real.

| Severity | Finding | Seat | Taken as |
|---|---|---|---|
| high | A neighbour's rule file sharing one of our basenames is OVERWRITTEN before ownership is consulted — `_cleanDir` skips every name this run emitted, so by the time it looks the file is gone | both | `mayWriteRuleFile`, checked BEFORE each write; four end-to-end fixtures through `emitCursor` / `emitWindsurf` |
| high | Ownership discarded the recorded SHA-256 and compared paths only, so a file of ours the consumer had EDITED was deletable and a recorded `.windsurfrules` since replaced was overwritable | openai | `classifyOwnership` — only `recorded-unchanged` is removable; the `.windsurfrules` manifest shortcut deleted outright, the header is the only route in |
| high | `command_head` disclosed secrets — a leading `VAR=secret` assignment IS the first token, a credential-bearing URL passed verbatim, and the non-shell-aware `;` split promoted quoted-argument fragments | both | assignments dropped, shape gate, then `secret_detector` as the last gate; six fixtures over the named shapes |
| medium | `source-first-gate` is `telemetry`, not `verification` — its own header says it "emits nothing to the model and never blocks" | both | reclassified |
| medium | the `permission` / `verification` boundary is under-specified | anthropic | the taxonomy is now written at the head of `hook_manifest.yaml`, with the axis named as observable delivery |

## What the review caught that I had wrong

**The second finding is the one worth naming.** I imported
`recordedOwnership.readRecordedHashes` — a module whose entire purpose is
telling `recorded-unchanged` from `recorded-modified`, and whose header says so
— and then called `.has()` on it. The openai seat put it exactly: "the helper is
named `RecordedHashes`, but callers discard the hashes."

**And my fixture concealed it.** `consumerWithManifest` recorded a constant
`"deadbeef"` for every file, so every claimed file would have classified
`recorded-modified` — and the deletion assertions passed anyway, because the
code never looked. A fixture that cannot fail for the right reason is not
evidence, and this one was mine. It now records the real digest of each body,
and two new cases pin the modified-since-install branch in both directions.

**The secret finding is the second.** I had written that taking the first token
was sufficient and tested it with `node script.js --flag`, which exercises
nothing. The three shapes both seats supplied all defeat it. The placeholder
token was also unrealistic — dictionary words, so neither credential-shaped nor
high-entropy — which means it would have exercised the shape rules and silently
skipped any detector gate behind them. The fixture now uses a real credential
shape, and the residual that remains is pinned as a test rather than left
unstated.

## Sensitivity, probed rather than asserted

Six mechanism-neutralisation runs, each restored immediately:

| Neutralised | Result |
|---|---|
| per-event merge keeps nothing | 6 failed / 10 passed |
| rule-file ownership returns "ours" always | 4 failed / 10 passed |
| reserved-name sweep ownership always true | (same run as above) |
| ownership by path membership, hashes ignored | 3 failed / 17 passed |
| `mayWriteRuleFile` always true | 2 failed / 18 passed |
| the emitter's pre-write gate bypassed | 1 failed / 23 passed |
| `commandHead` returns the whole command | 5 failed / 27 passed |
| `foreignRefusal` returns null | 4 failed / 19 passed |

## Where I disagreed, and why

**The council split on whether to split the branch.** The openai seat proposed
separating the code-graph work; the anthropic seat argued against, on the
grounds that all four commits serve one subject and splitting would leave graph
coexistence broken while hook and rule coexistence landed. I followed the
anthropic seat. The branch is one roadmap and the natural boundary is before it
or after it.

## The gap that remains, sharpened by the review

The host-rule emitter runs from `install.sh` and nothing records its output in
the install manifest. I reported that as "its files are all unclaimed and
therefore all KEPT". The anthropic seat sharpened it correctly: the consequence
is not only that stale files survive, it is that **this package's own host rules
survive its own uninstall**, because uninstall sees them unclaimed too.

That is worse than I stated and it is now stated properly, here and in the
commit. I did not close it in this branch: the fix is a writer for that
inventory, the available project-manifest reader drops nested `files[]` by
design so a read-modify-write through it would erase other tools' inventories,
and choosing the right store is a decision this lane's roadmap did not take. The
direction the gate now fails in — keeping a file it cannot prove is ours — is
the safe one, and it is the direction this whole lane chose.

## What the reviewer checked, and what it could not

Supplied: the branch itself, reachable by one seat directly. The other seat
limited its verdict to the described delta plus what it could read, and said so.

**Not independently re-reviewed:** the fixes taken from this round. The round
closed with the findings; the repairs and their sensitivity probes are the
author's, recorded above so a later reader can check them rather than take them.

## Not claimed

**That the census cannot leak a secret.** A credential that is neither
credential-shaped nor high-entropy and is the whole command is indistinguishable
from a program of that name. The module says so and a fixture pins it.

**That the `effect:` values are right.** Two seats checked the equivalence and
the least-obvious assignments and found one wrong, which is taken. Nothing here
claims the other 61 were audited line by line.
