# Standing context 40k — host-capability and maintainer-machine probes

<!-- evidence-type: analysis -->

> Read-only evidence for the four open steps of
> [`road-to-standing-context-40k`](../../roadmaps/archive/road-to-standing-context-40k.md).
> Measured 2026-08-21 against `origin/main` @ `d0fad2ccd`. Every number below
> carries the command that produced it. Nothing is carried over from an earlier
> note; where a figure supersedes one already in the roadmap, both are shown.

## Summary — what moved and what did not

| Step | Prior recorded state | This probe | Consequence |
|---|---|---|---|
| `0.1` | not executed, "hardware an agent cannot reach" | **executed on the maintainer machine — RED** | measurement half done; the remedy is a per-machine settings write |
| `2.1` / `2.2` | precondition unmet | **still unmet, re-checked three ways** | unchanged |
| `3.0` | premise **refuted** — "the host fires that event" not established | **premise CONFIRMED on the installed host** | the refutation was about *this tree*, never about the host |
| blocker | window unfilled, producer absent (PR #1484) | probe re-read, **unchanged** | settled; not re-litigated here |

The one substantive reversal is `3.0`.

## 1. Step 3.0 — `InstructionsLoaded` exists on the installed host

Step 3.0's own closing condition: *"one recorded observation that the installed
host emits the event (version-stamped, like the `subagent_start`/`subagent_stop`
evidence that justified those two rows)."* This is that observation.

### Host pin

```
$ claude --version
2.1.238 (Claude Code)

$ readlink -f "$(which claude)"
/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
```

The precedent measurement
([`subagent-lifecycle-phase0-host-pin.md`](subagent-lifecycle-phase0-host-pin.md))
pinned **2.1.229**. This is a fresh extract at **2.1.238**.

### Exact-token counts — same method as the precedent

Method: `strings -a <binary> | grep -c '^<token>$'`. The control set is
reproduced first so the method is visibly the same one that justified the
`SubagentStart` / `SubagentStop` rows, not a new instrument invented to reach a
conclusion.

| Native event | exact @ 2.1.229 | exact @ 2.1.238 | bound in this tree? |
|---|---:|---:|---|
| `SessionStart` | 24 | 24 | yes |
| `SessionEnd` | 12 | 13 | yes |
| `UserPromptSubmit` | 16 | 19 | yes |
| `PreToolUse` | 25 | 28 | yes |
| `PostToolUse` | 25 | 26 | yes |
| `PreCompact` | 11 | 11 | yes |
| `Notification` | 14 | 14 | no |
| `SubagentStart` | 12 | 12 | yes — bound on this evidence |
| `SubagentStop` | 24 | 24 | yes — bound on this evidence |
| `PostToolBatch` | 10 | 11 | no |
| **`InstructionsLoaded`** | not probed | **9** | **no — the gap this closes** |

`InstructionsLoaded` reads a non-zero exact-token count on the installed binary.
That alone is the same class of evidence the two subagent rows were bound on.

### Three stronger observations, beyond a bare string

A string-table presence is *necessary and not sufficient* — the precedent file
says so itself, and the three findings below are why this probe does not stop
there.

**(a) It is a member of the host's own hook-event enum.** The binary carries one
contiguous run of event names, twice; `InstructionsLoaded` sits inside it:

```
UserPromptExpansion · SessionStart · SessionEnd · Stop · StopFailure ·
SubagentStart · SubagentStop · PreCompact · PostCompact · PermissionRequest ·
PermissionDenied · Setup · TeammateIdle · TaskCreated · TaskCompleted ·
Elicitation · ElicitationResult · ConfigChange · WorktreeCreate ·
WorktreeRemove · InstructionsLoaded · CwdChanged · FileChanged ·
DirectoryAdded · MessageDisplay · PreToolUse · PostToolUse ·
PostToolUseFailure · PostToolBatch · Notification
```

**(b) The host carries hook-execution machinery named for it.** Two function
identifiers, each exact-token count 1:

```
executeInstructionsLoadedHooks
hasInstructionsLoadedHook
```

An event name can appear in a string table for many reasons; a
`has…Hook` / `execute…Hooks` pair is the host's dispatch path for that event.

**(c) The payload fields are the ones step 3.0 described.** Adjacent to the
event name, in the same payload-field run that carries `CwdChanged`'s
`old_cwd` / `new_cwd` and `FileChanged`'s `globs`:

```
InstructionsLoaded
load_reason
trigger_file_path
parent_file_path
```

Step 3.0 was written as *"the host fires that event per loaded `CLAUDE.md` /
`.claude/rules/*.md` with a **load-reason matcher**"*. `load_reason` plus
`trigger_file_path` plus `parent_file_path` is exactly that shape, and it was
described before it was measured.

### What this does and does not overturn

**Overturned:** the reading that step 3.0 rests on a *refuted* premise. It does
not. The tree-side facts the roadmap cited are all still true —
`InstructionsLoaded` is in no `EVENT_VOCABULARY`
(`src/scripts/hooks/dispatch_hook.ts:99-110`, ten events), in no
`native_event_aliases` row (`src/scripts/hook_manifest.yaml:1099`), and the two
modules that name it document it as unbound
(`src/scripts/check_standing_rule_delivery.ts:192`,
`src/scripts/routing_doctor.ts:315`). Those were statements about **this suite's
bindings**. The host-side question — does the event exist to bind — had never
been probed, and the answer is yes.

**Not overturned:** the step's `verify:` line, *"the observer records a load
event with its reason on this tree."* A string table proves the event exists in
the host; it does not prove a bound concern receives a fire. That needs the
vocabulary + alias + platform-row change **and** a subsequent session, because a
hook binding takes effect on session start and cannot observe its own
registration. So the step is now **actionable and still unmet** — a materially
different position from the one on record.

## 2. Step 0.1 — the maintainer-machine reading, executed

Step 0.1 names `the standing-rule-delivery dev task`
(`taskfiles/dev.yml:136` → `task dev:standing-rule-delivery`) and asks for
*"the task's own output, recorded per machine with its date."* Executed
2026-08-21 on the maintainer machine, from the primary checkout:

```
$ ./scripts-run src/scripts/check_standing_rule_delivery
check_standing_rule_delivery · input: filesystem · tokens_gpt: exact (tiktoken cl100k_base)
  global    115 file(s)    115781 tok
  project    92 file(s)     81577 tok
  overlap    91 rule(s) in both layers (85 duplicate, 6 divergent)
  TOTAL           197358 tok / 110000 cap (179.4%)
scanned: 207
❌  exceeds the 110000 cap
```

**Machine:** maintainer (`mathiasberg`, macOS, Claude Code 2.1.238).
**Date:** 2026-08-21. **Verdict:** RED, 179.4 % of cap.

Per the step's own text, a red result *"means the machine predates the installer
gate"* and the remedy is the `claudeMdExcludes` suppression for the unchosen
layer — **one settings entry per machine**, no deletion.

### The double delivery is not merely unfixed; it grew

| Date | Reading | Source |
|---|---:|---|
| 2026-08-08 | 176,354 tok | `check_standing_rule_delivery.ts:11` docblock |
| (undated, later) | 195,383 tok | `road-to-session-closeout.md:360` |
| **2026-08-21** | **197,358 tok** | this probe |

**+21,004 tok since 2026-08-08**, against an unchanged 110,000 cap. 91 of the
rules arrive twice, and 6 of those 91 are **divergent** — the same basename with
different content in the two layers, which is the failure mode a filesystem sum
can see and a reader cannot.

What is **not** established here: any reading for a colleague machine. That
remains unreachable — an agent cannot read another person's filesystem.

## 3. Steps 2.1 / 2.2 — the sequencing precondition, re-checked three ways

The precondition is the per-rule `norm:` pin from
`road-to-cost-parity-1-rule-payload-diet`. All three checks re-run on
`d0fad2ccd`:

1. **Owning steps still open.** `road-to-cost-parity-1-rule-payload-diet.md:200`
   (`3.1`, the `norm:` field) and `:204` (`3.2`, the drift lint) are both `[ ]`.
2. **No script.** `ls src/scripts/ | grep -i norm` → no match.
3. **The field does not exist where it would have to.**
   `src/scripts/schemas/rule.schema.json` declares no `norm` property, and
   `grep -rlE '^norm:' src/rules/ | wc -l` → **0** of 119 rules.

Unchanged. A fourth observation worth recording, because it bears on ownership
rather than on readiness: `road-to-cost-parity-1-rule-payload-diet` Phase 3 owns
the `norm:` pin (`3.1`), the drift lint (`3.2`), verbatim preservation of
prohibitions (`3.3`), the marker-delimited `norm` / `rationale` / `examples`
split (`3.4`), and the payload-delta measurement before that phase commits
(`3.5c`) — i.e. it owns both the precondition **and** the body-diet mechanism
that steps 2.1 / 2.2 describe. Its `3.5` additionally excludes the nine kernel
rules from all of `3.1`–`3.4`.

## 4. Payload numbers on this tree, before any change

### The `always` budget measures the locked kernel, and only it

```
$ ./scripts-run src/scripts/check_always_budget
✅  always-rule raw budget: 29,466 / 49,000 chars (60.1%) across 9 rule(s)
      extended (raw + load_context closure): 60,252 / 60,254 chars (100.0%)
```

The nine files it measures are `scope-control`, `non-destructive-by-default`,
`commit-policy`, `verify-before-complete`, `no-cheap-questions`,
`language-and-tone`, `direct-answers`, `ask-when-uncertain`, `agent-authority` —
**exactly** the locked kernel set of
[`kernel-membership.md` § 4.1](../../../docs/contracts/kernel-membership.md).
Two consequences, both load-bearing for Phase 2:

- Nothing an agent may edit appears in this gate's corpus.
  `block-kernel-rule-writes` is bound blocking with `fail_closed: true`, and
  kernel edits additionally carry a ≥24 h soak between merges. A condense pass
  cannot move this number at all.
- Its extended ratchet reads **60,252 / 60,254 — two characters of headroom**.
  The set is already at its floor by its own instrument.

So this gate is *not* the metric AC-2 speaks to. AC-2 asks for
*"the unconditional-corpus token count"*, which is the next section.

### The unconditional corpus — the number Phase 2 actually targets

```
$ ./scripts-run src/scripts/check_preamble_payload_budget
  project-scope rules                      119481 tok
  preloaded skills catalog                  14408 tok
  CLAUDE.md hierarchy (project only)          746 tok
  measured total                           134635 tok (baseline 102520, +32115; ceiling 107646)
❌  per-spawn preamble payload grew past the ratchet: 134635 > 107646 tok.
```

Pre-existing red, and **worse than the roadmap's D-1 records**: D-1 quotes
"~23k ABOVE" at registration; the measured excess is now **+32,115**. Raising the
baseline is on this roadmap's own CUT list and is not proposed.

Project-scope rules are **119,481 of 134,635 = 88.7 %** of the gated payload, so
Phase 2 is aimed at the dominant term. That is the finding, not a licence to act
on it before the pin exists.

### The projection carries almost no frontmatter — measure the payload, never the source

```
$ ls src/rules/*.md | wc -l                                  # 119
$ ls .claude/rules/*.md | wc -l                              # 113
$ # files whose first line is '---':
$ for f in .claude/rules/*.md; do head -1 "$f" | grep -q '^---$' && echo "$f"; done | wc -l   # 4
```

**4 of 113** projected rule files carry frontmatter —
`design-review-after-ui-write`, `roadmap-progress-sync`, `source-of-truth`,
`ui-audit-gate`. The other **109 load unconditionally**, which is D-2's
mechanism confirmed on the current corpus (D-2 counted 6 path-only of 117; the
corpus has since grown to 119 source rules and the projection carries 113).

The operational consequence for 2.2: a frontmatter-field change costs ~0 bytes
on this carrier, and body prose costs everything. Only the body is worth moving.

## 5. Step 2.1's prioritisation input, regenerated

The roadmap says to regenerate rather than trust the table it carries, *"because
a stale prioritisation is worse than none."* Regenerated 2026-08-21:

```
$ ./scripts-run src/scripts/check_rule_stub_ceiling --report
```

| | roadmap's frozen table | 2026-08-21 |
|---|---:|---:|
| rules declaring a migrated body | 44 | **43** |
| body tokens | 24,845 | **25,084** |
| floor | 7,463 | **7,816** |
| residue | 17,383 | **17,269** |

Top rows, with the drift against the frozen table shown where it moved:

| rule | residue | floor | vs frozen |
|---|---:|---:|---|
| `context-hygiene` | 2252 | 218 | +23 |
| `design-fidelity` | 1662 | 583 | — |
| `autonomous-execution` | 1550 | 83 | — |
| `active-remediation` | 1309 | 293 | — |
| `ui-audit-gate` | 1171 | 108 | — |
| `roadmap-progress-sync` | 912 | 1273 | +73 residue, +688 floor |
| `architecture` | 873 | 82 | — |
| `git-history-discipline` | 836 | 369 | — |
| `legal-safety-floor` | 736 | 665 | new to the top band |

The set drifted by one rule and the ordering changed at rank 6, which is the
argument for regenerating it rather than citing it.

## 6. The blocker probe — re-read, unchanged, not re-litigated

PR **#1484** (merged 2026-08-20T16:21:34Z) settled `b-rules-efficiency-signal`:
the window is unfilled because the **producer is absent**, not because no
sessions occurred — the broken-instrument case, established there by four
checks. That finding is cited, not re-derived. Its own re-entry probe, re-run:

```
$ ./scripts-run src/scripts/dispatch_economy_report
rules_efficiency:
  envelopes with pair=0 · median quota=— · low-quota signal (< 0.2): no data
```

`envelopes with pair` is still **0**. Unchanged.

**One consequence of § 1 does reach this blocker, and it is recorded rather than
acted on.** The blocker's Recommendation is *"land step 3.0's observer first and
re-date this blocker against it"*, and Correction A declared that route
unavailable **because the host capability was unestablished**. That ground is
now measured false: the capability exists. Correction B's finding is untouched —
nothing in the tree writes the `rules_carried` pair today — but the named filler
Correction A ruled out is available again, so the two corrections no longer
close off the same route. The blocker's disposition is not reopened here; what
changes is that its Recommendation has a route for the first time.
