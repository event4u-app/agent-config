<!-- evidence-type: analysis -->

# Authorization friction — baselines and one pre-registered claim

`road-to-authorization-that-reaches-further` Phase 3. Three things are recorded
here: the unauthorized-operation baseline ADR-254's review trigger is written
against (3.1), the friction corpus's first full run (3.2), and the
pre-registered claim for the residual-interruption measurement (3.3), whose
measurement half is deferred for want of observations rather than for want of
work.

## 1. The unauthorized-operation baseline (step 3.1)

ADR-254 reopens when "the conformance scan's unauthorized-operation count rises
over a measured baseline rather than staying flat". No such baseline existed —
the check counts violations per run and nothing pinned a reference value.

| | |
|---|---|
| **Instrument** | `./scripts-run src/scripts/conformance_scan --store <store> --limit 30 --json` → `totals["git-authorization"]` |
| **Store** | `~/.claude/projects/-Users-mathiasberg-projects-galawork-galawork-packages-event4u-agent-config` |
| **Window** | the 30 most recent transcripts by mtime (`--limit 30`) |
| **Sessions in window** | **30** |
| **Measured on** | **2026-09-06** |
| **Tree SHA** | `473f4e18e3e7211f3edbc499ba81de8bc4ed4c4e` |

Recorded on both sides of the step-2.1 vocabulary change, which is the point of
recording it twice — the step asks for the vocabulary change to be visibly
separated from a behaviour change:

| Vocabulary | `git-authorization` count | Sessions |
|---|---|---|
| **Before 2.1** (26 git operations) | **13** | 30 |
| **After 2.1** (33 operations, +7 consequence) | **14** | 30 |
| of which object mismatches (2.2) | **0** | 30 |

**Read the delta as +1 finding surfaced by a wider vocabulary over an unchanged
corpus, and as nothing else.** The same transcripts were scanned both times, so
no behaviour changed between the readings; one operation that the 26-operation
vocabulary could not see is now visible. It is not evidence that unauthorized
operations rose, and a later reader comparing a future number against **13**
rather than **14** would read a vocabulary change as a behaviour change — which
is precisely the confusion this two-sided record exists to prevent.

**The reference value for ADR-254's trigger is therefore 14**, on the
33-operation vocabulary, at the tree SHA above. A future count is comparable
only at the same vocabulary size; a further extension requires a fresh pair.

**What this baseline is not.** It is one machine's transcript store over one
30-session window. It is not a rate, not a per-session average anyone should
cite, and not a claim about any other operator.

## 2. The friction corpus (step 3.2)

`./scripts-run src/scripts/autonomy_friction_corpus`, run at the tree SHA above:

```
✅ directory-change               expected 1  observed 1
✅ directory-change-compounded    expected 1  observed 1
✅ directory-flag-status          expected 0  observed 0
✅ test-runner-in-subdirectory    expected 0  observed 0
✅ workspace-package-manager      expected 0  observed 0
✅ consequence-authorized         expected 1  observed 1
✅ consequence-unauthorized       expected 1  observed 1

7 case(s), every observation matches its expectation
```

**The corpus earned its keep on its first run**, and the failure is worth
recording because the fix was not the expectation. `directory-flag-status`
(`git -C sub status`) observed **1** against an expectation of **0**: the
category-A classifier resolved the subcommand to `sub` rather than `status`
because `-C` consumes the next token. So the shape the canon started teaching in
step 1.2 — a directory flag in place of `cd X && …` — cost exactly as many
confirmations as the shape it replaced, and step 1.2 would have shipped a
correction that bought nothing.

A gate count would have reported both shapes identically. That is the argument
for counting confirmations, and it is now an observation rather than a
prediction.

**Two findings that are not failures, and are the more interesting half:**

- `consequence-authorized` and `consequence-unauthorized` are the same payload
  and cost the same **1** confirmation. The authorizing phrase changes the
  **record** and never the prompt. After ADR-254 this package grants nothing, so
  Phase 2's whole contribution is visible in the ledger and invisible in the
  friction. Anyone expecting the round to have reduced confirmations for
  consequence operations should read this row first.
- `directory-change` and `directory-change-compounded` still cost 1 each, by
  design. The answer to them is the shape, not an allow.

## 3. Pre-registered claim for the residual-interruption measurement (step 3.3)

Recorded **before** any Phase-1 change is measured against it, and before the
Phase-1 results in section 2 above were inspected as evidence for it. Once
results have been read, a claim written afterwards is no longer pre-registered,
which is why this section is written now and its measurement is not.

### Why the measurement half cannot run today

`./scripts-run src/scripts/interruption_report` on 2026-09-06 reports
`sessions_found: 0`, `window_requested: 30`, `window_short: true`. **Both**
observation axes are empty: `agents/runtime/state/interruptions.jsonl` is absent
and there is no chat history carrying session tags. The SHORT WINDOW flag is the
tool correctly reporting that the observations do not exist yet — not a
threshold a longer run clears. With zero observations a smaller window is
equally unmet, so lowering the request would change the indicator and not the
evidence.

### The claim, frozen

**Metric.** `median contacts per run` on the contact axis of
`src/scripts/interruption_report.ts`, over qualifying sessions in the window.

**Qualifying session.** A session that (a) appears in the chat history with a
session tag, (b) ran at or after the tree SHA in section 1, so the Phase-1
emission path is present, and (c) contains at least one `pre_tool_use` dispatch.
A session failing any of the three is excluded and the exclusion is counted.

**Both axes and the missing-data treatment.** The contact axis reads
`agents/runtime/state/interruptions.jsonl`; the wall-clock axis reads the
session-tagged chat history. A session present on one axis and absent from the
other is reported per axis with its own `n`, never pooled — the report already
prints a per-axis `n` for this reason. Missing data is reported as missing and
never imputed; a zero is recorded only where a zero was observed.

**Minimum window — UNCHANGED.** `DEFAULT_WINDOW = 30` sessions requested, and
the pre-registered power floor of **20 runs per axis** (`POWER_FLOOR_RUNS`)
stands. Neither number moves as part of judging this claim. A judgement made
below the floor is reported as underpowered and is not a result.

**Expected direction and magnitude.** Median contacts per run **decreases**
after Phase 1. Magnitude: a reduction of **at least one contact per run** at the
median. The direction is the claim; the magnitude is stated so that a
statistically real but operationally trivial drop does not count as a
confirmation.

**Comparison method.** Median contacts per run over qualifying sessions before
the Phase-1 tree SHA against qualifying sessions at or after it, each axis
separately, each with its `n` and the host build recorded alongside. No
significance test is pre-registered: with a floor of 20 runs per arm the honest
report is the two medians, their `n`s, and the spread.

**A null or adverse result is permitted and is a result.** If the median does
not move, or moves upward, that is recorded as the finding and this artefact is
amended rather than the claim being restated. The most likely confound is named
in advance: most confirmations in the round's own account originate outside this
package, so a drop could be a host change. The host build is recorded with every
window for that reason, and a drop coinciding with a host upgrade is reported as
confounded rather than as a confirmation.

**What would make the claim unfalsifiable, and is therefore excluded.**
Re-defining "contact", moving the window, moving the power floor, or changing
the qualifying-session rule after the first reading. Any of those requires a new
pre-registration with a new date, and the old one stays on the record.

## 4. Status

3.1 and 3.2 are complete and their evidence is above. 3.3's pre-registration is
complete; its measurement is deferred to
`agents/roadmaps/later/road-to-residual-interruption-measurement.md`, which
reopens on **observations, not on a date**.
