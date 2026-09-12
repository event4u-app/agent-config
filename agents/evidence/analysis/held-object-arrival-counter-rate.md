# False-positive rate of the held-object arrival-counter check

<!-- evidence-type: analysis -->

Measured 2026-09-12, before the check was wired anywhere, on the tree carrying
`src/scripts/check_held_object_arrivals.ts`. The roadmap step that requires it
states the reason plainly: absent this measurement the check ships advisory,
because a measurement is not a gate. It was taken first and it decided the
outcome; the check was not tuned until the number looked acceptable.

## What the check asserts

A **held object** is a stub or a parked roadmap — an argument the estate
decided not to run now. Every one was created by a round that raised its
subject, and that creating round is an arrival the object records by existing.
So a held object nobody has raised again owes no counter: a first arrival has
nothing to count.

A **citation** is what changes that. A live roadmap naming the object inside a
blocker is the estate saying the held thing is in the way of work happening
now, which is the subject arriving a second time. From that point the number is
the fact the next reader needs, and its absence is what the check notices.

## The scope decision, measured rather than assumed

Three readings of "cited as a blocked finding", taken over the same tree on the
same day. The rate column is the share of the cited population that the check
would fire on.

| Citer set | Citation scope | Population | Fires | Rate |
|---|---|---|---|---|
| every markdown file under `agents/` and `docs/` | any line containing "block", or within 15 lines below a blocker heading | 72 | 56 | 77.8 % |
| every markdown file under `agents/` and `docs/` | inside a `## Blockers` section or a `### blocker:` block | 66 | 54 | 81.8 % |
| **active and parked roadmaps only** | **inside a `## Blockers` section or a `### blocker:` block** | **9** | **4** | **44.4 %** |

The first two populations are dominated by records that are historical by
construction. Of the 66 in the second row, the citers are overwhelmingly
archived roadmaps and stored review inputs: an archived roadmap asserts what
was true when it closed, and a stored review input asserts what a reviewer saw
on a scope that no longer exists. Neither is the estate asking again. A check
reading them as live citations reds on four fifths of its corpus on the day it
lands, which is the suppression target this roadmap's risk register names as
risk 2.

The third row is the shipped definition. Parked roadmaps are citers as well as
held objects, because a parked roadmap resumes and its blockers resume with it;
a parked roadmap citing itself is excluded, since one held argument pointing at
its own name is not a second arrival.

## The false-positive rate

Firing rate over the live corpus: **4 of 9 (44.4 %)**.

A firing is a *false* positive when the object owes no counter — that is, when
the citation is not really a second arrival. Each of the four was adjudicated by
reading the citing blocker. All four are genuine.

| Held object | Citing blocker | Verdict |
|---|---|---|
| `later/road-to-composite-dispatch-topology.md` | named as already carrying the same capture-rate resume condition the citer is blocked on | true positive |
| `later/road-to-cost-parity-2-state-aware-dispatch.md` | same blocker, same resume condition | true positive |
| `stubs/road-to-task-completion-observability.md` | the citer's blocker instructs the reader into the stub's probe verdict table and its recorded falsifier | true positive |
| `stubs/road-to-token-saving-residue.md` | named as holding a resume gate that three roadmaps are waiting on | true positive |

**False positives: 0 of 4 firings (0.0 %).**

Two limits on that figure, stated rather than implied. The denominator is
**nine**, which is a reading and not a rate — one estate on one day. And the
adjudication is a human read of four blockers; the check cannot perform it, and
a later citation shaped differently could be a false positive without anything
here noticing.

## The decision: advisory

A 0 % false-positive rate would permit blocking. It does not happen today, for
a reason the rate does not capture: the check is **red on four live objects the
moment it lands**, and a gate that arrives red is a backlog rather than a
control — the same reasoning `check_gate_completeness` records for its own
population.

So it ships advisory. It exits 0 and prints its findings; `--enforce` exits 1.
The promotion is a flag rather than an edit.

**Promote to enforcing when** the four objects above carry their arrival lines,
so a clean run is the starting state. Re-take the rate at that point: the
population moves as blockers open and close, and a rate measured over nine
objects should not be carried forward as though it were stable.

## Sensitivity: observed red, then observed green

A check never seen firing has unknown sensitivity — it can be quiet because the
corpus is clean or because it reads nothing, and a passing run cannot tell
those apart. So the firing direction was exercised against the live corpus, not
only against a synthetic fixture.

Fixture: `agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md`,
which carries a five-line arrival blockquote and is cited inside the blocker of
an active roadmap. Its counter was removed, the check run, and the file
restored byte-for-byte (sha256
`8af04da9a5c24a6b77344e00de8ced971893312eebad17e42908784a2e5263c4`, identical
before and after).

Before, advisory:

```
scanned: 9
⚠️  4 of 9 held object(s) cited inside a live blocker carry no arrival line:
  · agents/roadmaps/later/road-to-composite-dispatch-topology.md
  · agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md
  · agents/roadmaps/stubs/road-to-task-completion-observability.md
  · agents/roadmaps/stubs/road-to-token-saving-residue.md
```

Counter removed, run with `--enforce` — the red reading, exit 1:

```
scanned: 9
❌  5 of 9 held object(s) cited inside a live blocker carry no arrival line:
  · agents/roadmaps/later/road-to-composite-dispatch-topology.md
      cited by agents/roadmaps/later/road-to-evidence-calibrated-model-orchestration.md
  · agents/roadmaps/later/road-to-cost-parity-2-state-aware-dispatch.md
      cited by agents/roadmaps/later/road-to-evidence-calibrated-model-orchestration.md
  · agents/roadmaps/stubs/road-to-runtime-orchestration-substrate.md
      cited by agents/roadmaps/road-to-the-substrate-stub-meeting-its-open-gate.md
  · agents/roadmaps/stubs/road-to-task-completion-observability.md
      cited by agents/roadmaps/later/road-to-episode-finalizer-and-outcome-attribution-v2.md
  · agents/roadmaps/stubs/road-to-token-saving-residue.md
      cited by agents/roadmaps/later/road-to-catalogue-host-fit.md
```

Counter restored — the green reading, back to four and the fixture gone from
the list:

```
scanned: 9
⚠️  4 of 9 held object(s) cited inside a live blocker carry no arrival line:
  · agents/roadmaps/later/road-to-composite-dispatch-topology.md
```

Both directions observed on the live corpus. The synthetic polarities — an
uncited first-arrival object, a mention outside blocker scope, a cited object
that carries its line, and an empty held corpus — are the five cases in
`check_held_object_arrivals --self-test` and the 23 cases in
`tests/scripts/held_object_arrivals.test.ts`.

## The reporter, and the denominator finding that came out of testing it

The counter itself stays human-authored; `src/scripts/report_held_object_arrivals.ts`
derives the figure and writes nothing. Testing it against the counters already
on the tree produced a finding worth recording on its own.

### The written counters do not share a denominator

Of the counters this estate carries, most say "distinct prior round directories
under the consumed-inbox tree, subject-matched floor". At least one counts
something else entirely — `stubs/the-14-21-0-ledger-is-ingestible.md` counts
**release cycles**, and its fifth arrival is a release rather than a round. And
of the majority that do count rounds, most record the *unit* while recording no
*pattern*, so the question they answered cannot be recovered.

That matters because the reporter's headline unit is the top-level entry of the
tree — a round directory, or a loose file dropped at the top level, both being
one arrival. The written counters that say "round directories" are the
directory sub-figure, which the reporter prints separately for exactly this
reason. A number compared across those two units is not a comparison.

So the reporter prints the pattern, the unit split, the denominator it was taken
over, the tree it read and the round names. Not decoration: it is the minimum a
later reader needs to tell whether two counters answered the same question.

### The reproduction case

The one counter on the tree that records its own pattern verbatim is
`stubs/road-to-standing-rule-delivery-per-machine.md`: **15**, measured
2026-09-06, `grep -rl "standing payload\|138k\|138,273"`, distinct round
directories. Run under exactly that pattern:

```
object:  agents/roadmaps/stubs/road-to-standing-rule-delivery-per-machine.md
pattern: /standing payload|138k|138,273/  (given on the command line)
tree:    .../agents/tmp.old  (via the main checkout behind this worktree)

arrivals: 18 distinct round(s) of 381 examined — 17 round director(ies), 1 loose drop(s)
```

Seventeen directories match, of which `inbox-2026-09-u` and `inbox-2026-09-y`
postdate the measurement: 17 − 2 = **15**, exactly. The eighteenth entry is a
loose top-level drop, which that convention did not count and this reporter
counts and labels separately. That is the reproduction — and it is reproducible
only because the counter stated its pattern.

### The non-reproduction, recorded rather than tuned away

`stubs/road-to-subagent-return-gate.md` records **24 (at least)**, "counted as
distinct prior round directories … subject-matched floor". It names no pattern.
The reporter does not reproduce it, and no attempt was made to make it:

| Pattern | Entries | Directories |
|---|---|---|
| slug-derived `subagent[-_ .]return[-_ .]gate` | 5 | — |
| subject-matched `subagent.{0,40}return\|return.{0,40}subagent` | 23 | 19 |
| broad `subagent` | 135 | 79 |

The recorded 24 sits between the subject-matched 19 and the broad 79, and
nothing in the tree says which question produced it. Picking the pattern that
lands on 24 would be fitting the instrument to the answer, which is the failure
this whole measurement exists to avoid — so the figure stays unreproduced and
the reason is the finding: **a counter that records its unit but not its
pattern is not reproducible, even on the machine that took it.**

`stubs/road-to-code-graph-benchmark-rerun.md` is the intermediate case. It
records **72** directories under a stated pattern, `code.graph|code_graph`; the
reporter returns 75 top-level entries today, of which two postdate the
measurement, leaving 73 — one above the recorded figure, and 57 when counted as
directories alone. A stated pattern gets the reconciliation to within one; the
remaining gap is the unit, and it is the same unit gap as above.

### An unreachable tree is not a count of zero

An explicitly named tree is an **override**, not the first of several
candidates. Naming a path that does not exist reports it unreadable rather than
quietly reading some other tree — otherwise the unreadable branch could not be
exercised on any machine where the real tree exists, which is every machine this
runs on, and the one behaviour the roadmap specifically requires would be the
one nobody could demonstrate.

```
tree:    unreadable
  · flag: /nonexistent/tree — absent

no prior rounds readable — the consumed-inbox tree is gitignored and
machine-local, so this environment cannot see it. This is NOT a count of
zero arrivals: no reading was taken. Point --tree at the tree, or run
where it lives.
```

Exit 0 in both the present-tree and absent-tree cases. The reporter gates on
nothing.

## What is not covered

- The rate is one estate on one day over nine objects. It is a reading.
- The check cannot tell a genuine second arrival from a citation that merely
  mentions a held object inside a blocker. The blocker scope is a structural
  proxy for that judgement, and it is a proxy.
- Nothing verifies that a counter a held object carries is *correct*. The check
  sees presence, not truth, and the reporter that could check it reads a tree
  that exists on one machine.
- The consumed-inbox tree is gitignored, so none of the reporter's figures are
  reproducible from a clone. The ordering is the finding; the exact figure is
  not.
- One of three recorded counters reproduces. The other two do not share the
  reporter's unit, and one of them names no pattern at all — so "the reporter
  reproduces a known count" is true of a single object, and the reason the
  other two fail is a property of how the counters were written rather than of
  the reporter.
