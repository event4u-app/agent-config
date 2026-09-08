<!-- evidence-type: analysis -->
# Mandated-line emission — the counter reading, and a null on all five lines

Step 2.0 of `road-to-candidate-moves-floor`. Measured on `drain/cmf-lane`, based
on `origin/main` @ `e010b1c2f`, 2026-09-08.

The step exists because `src/agent-src/contexts/execution/mandated-lines.md:169-174`
§ Honest scope names one cheap observation and then names it as a precondition:

> track how often an emitted intent line has its three slots **disagree**. If
> disagreements are effectively never found, the line is decorating decisions
> already made and the set should shrink. [...] That observation costs one
> counter and is **the first thing to look at before adding a sixth line.**

The counter is `src/scripts/count_intent_disagreement.ts`. This file is its
first reading.

## The reading

```
labelled `Intent:` matches:            18
  of which the contract's own example:  5   (`parseDate …`, quoted verbatim)
  of which prose section labels:       13   (fewer than three slots)
well-formed three-slot intent lines:    0
disagreement rate:                  undefined (no denominator)
```

**Corrected mid-run, and the correction is the more useful half of this file.**
The first reading of this counter said `population 0`, and it was wrong for a
reason that would have made the null self-confirming — see § The correction
below. The number that survives scrutiny is not zero labelled matches; it is
**zero well-formed lines**, which is what the lock's rate needs a denominator
of.

Every one of the 18 is either the contract's own blockquote example carried into
a session's context, or `Intent:` used as a prose heading in a prompt or roadmap
carrying no `·`-separated slots at all. Not one is the three-slot artifact the
contract specifies, emitted at a decision point.

## Surface map — normative surface versus inspected surface

The council of 2026-09-08 required this table before the null could be worded,
on the ground that absence from a surface where a line is not owed is not
evidence of anything.

| Surface | Normative for these lines? | Inspectable here? | Units read | Labelled matches | Well-formed lines |
|---|---|---|---|---|---|
| Assistant reply at the decision point | **Yes — all five.** `mandated-lines.md:38-42`, `:114-117` | Yes, via the local session store | 4,917 files, 3,739 of them JSON/JSONL with string leaves decoded | 18 | **0** |
| Pull-request body | **Yes for `Pending`.** `mandated-lines.md:98-102` names the PR reviewer as the line's recipient | Yes | 400 merged PR bodies | 0 | **0** |
| Commit message | **No.** The `Commit` line is emitted in the reply *before* committing (`:78-84`), not into the message | Yes | full `git log --all` | 0 | 0 — **not evidence** |
| Tracked tree | No | Yes | `src`, `docs`, `agents`, `tests` | only `mandated-lines.md`'s own examples | — |

Both surfaces where a line is genuinely owed, and which can be inspected at all,
yield zero well-formed lines.

## The null is not specific to the intent line

The step asked only about the intent line. Extending an emphasis-tolerant
extraction to all five labels over assistant prose only, with fenced blocks
stripped:

| Label | Labelled matches | Well-formed per the contract |
|---|---|---|
| `Intent:` | 1 | 0 — German prose, no three slots |
| `Authorization:` | 3 | 1 at best — one quotes (`"execute this irreversible operation"`), two paraphrase |
| `Commit:` | 2 | 0 — both are commit-status reports (`` `0eb145b5d` on `drain/…` ``), not the three-slot pre-commit line |
| `Pending:` | 0 | 0 |
| `Sibling search:` | 0 | 0 |

Six labelled matches across 35,612 assistant text blocks in 2,537 files. The two
paraphrasing `Authorization:` lines are notable in their own right: *"Within
autonomous authority as defect repair"* is exactly the
documentation-is-not-authorization failure `mandated-lines.md:64-68` denies in
as many words, so where the mechanism does fire it fires in the form the
contract rejects.

Fence-stripping is what separates a quoted illustration from an emission, and it
is the linter's own pass (`src/scripts/lint_mandated_lines.ts:107-122`), reused
rather than reimplemented — that file records its own § Brevity example as a
working bypass when the pass is not applied.

## The correction — how the first reading was wrong, and why it mattered

The first version of this counter imported `INTENT_RE` from
`lint_mandated_lines.ts`, reasoning that reusing the shipped gate's own pattern
makes the reading authoritative. **That was backwards, and it produced a false
null.** The shipped pattern anchors the bare label at line start and matches no
markdown emphasis, so `**Intent:**` — the form an assistant actually writes for
a labelled line — is invisible to it.

This is not a hypothetical. The paid treatment run described in
`RESULTS-candidates-treatment-2026-09-08.md` emitted its one compliant line as
`**Candidates:**`, and a checker built on the shipped pattern shape reported
`Candidates line present: 0` across 32 transcripts. A detector that cannot see
what it counts reports that the thing was not emitted, silently, in the
direction that looks like a finding.

**A counter must be wider than the gate it reports on.** Sharing the gate's
blind spot makes the null self-confirming: the gate cannot see the line, so the
counter cannot see the line, so the counter reports the line is not emitted —
which is a fact about the regex, not about the tree.

Widening was then wrong in the other direction on the first attempt. Adding an
`i` flag took the count from 0 to **172**, and essentially every new match was a
lowercase `intent:` YAML key in a prompt-pattern or command config — a line
anchor turned into a prose detector. The label is capitalised in the contract, so
the pattern is emphasis-tolerant and **case-sensitive**. Replacing a false null
with a false population would have been the worse error, because a population
looks like evidence.

## The shipped gap, recorded rather than fixed

`lint_mandated_lines.ts`'s `INTENT_RE` and `AUTHORIZATION_RE` carry the same
blind spot: a report emitting `**Intent:** a · b · c` satisfies the contract and
fails the gate, and a report claiming a behaviour change while emitting only a
bolded intent line is reported as `missing-intent`.

Not fixed in this change, deliberately. That file is a shipped gate with 19
tests of its own, sitting against the contract the 2026-09-07 council blocked
from changing, and widening its discrimination changes what it accepts from
every future report — its own change, with its own review. It is named here so
the next reader does not have to rediscover it.

## What this does and does not establish

**Establishes:** zero well-formed emissions on every inspected durable surface,
for all five lines, with at most one arguable `Authorization:` line. The store
demonstrably captures the normative surface — it holds 35,612 assistant text
blocks — so for the assistant-reply surface this is not an observability
artefact. The labels appear a handful of times; the artifact the contract
specifies does not.

**Does not establish** that the obligation has never been emitted anywhere. The
transcript store is one machine's local history, spans several projects, and is
not a controlled sample of this repository's work. A reply emitted in a session
whose transcript was never written, or on another operator's machine, is outside
this reading. The wording is therefore *"zero qualifying emissions on inspected
durable surfaces"* and never *"never emitted"* — a distinction the council of
2026-09-08 made a condition of publishing the null.

**Does not set a threshold.** The prior council of 2026-09-07 flagged a proposed
"≥ 80 % zero disagreement = ceremony" figure as invented, and no number is
adopted here. A population of zero needs none: there is no distribution to read
one off.

## Why this is stronger than the reading the lock expected

The lock anticipated a *rate*: high disagreement means the three slots are doing
work, near-zero means the line decorates a decision already made. The measured
answer is neither. The channel carries nothing — the mechanism's first and
already-mandatory member produced no observable output at all, on the one surface
where it is owed.

That is a finding about **carrier reach**, not about whether a candidate-forms
floor would help. The two are separate defects, and the 2026-09-08 council ruled
the carrier finding out of scope for this roadmap while making it
**shipment-gating**: no efficacy result may authorise shipping a sixth line while
the first five reach nothing.

## Reproduction

```bash
gh pr list --state merged --limit 400 --json number,body > /tmp/prs.json
./scripts-run src/scripts/count_intent_disagreement \
  --git-log \
  --pr-bodies /tmp/prs.json \
  --dir ~/.claude/projects
# 18 labelled matches; 13 malformed, 5 the contract's own example
```

The local session store is one machine's and is not tracked, so the third source
is not reproducible off this machine. The first two are.

Sensitivity — the counter separates all three classes on a synthetic report,
and `tests/scripts/count_intent_disagreement.test.ts` pins it:

```
1. [distinct]    overlap=0.111  three slots that disagree
2. [restatement] overlap=0.667  three slots that restate each other
3. [malformed]   overlap=0      two slots
```

The test file also pins the two directions the correction above was wrong in: a
bold, underscored, starred, blockquoted and bulleted label must all be seen, and
an empty population must exit 2 while warning against the "no disagreements
found" reading rather than merely avoiding the phrase.

The per-line `overlap` figure is published for every line the counter reports so
a later reader can recompute at a threshold other than the stated default of
`0.6`, which is a chosen default and not a measured optimum.
