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
population of emitted intent lines:  0
disagreement rate:                   undefined (no denominator)
```

The counter exits 2 rather than 0 on this, on the repository's own dead-scope
discipline (`src/scripts/_lib/scan_scope.ts:80-95`): a rate over an empty
population is not a reading, and an empty scan must never present as a pass.

## Surface map — normative surface versus inspected surface

The council of 2026-09-08 required this table before the null could be worded,
on the ground that absence from a surface where a line is not owed is not
evidence of anything.

| Surface | Normative for these lines? | Inspectable here? | Units read | Emissions |
|---|---|---|---|---|
| Assistant reply at the decision point | **Yes — all five.** `mandated-lines.md:38-42`, `:114-117` | Yes, via the local session store | 35,516 assistant text blocks in 2,535 transcript files | **0** |
| Pull-request body | **Yes for `Pending`.** `mandated-lines.md:98-102` names the PR reviewer as the line's recipient | Yes | 400 merged PR bodies | **0** |
| Commit message | **No.** The `Commit` line is emitted in the reply *before* committing (`:78-84`), not into the message | Yes | full `git log --all` | 0 — **not evidence** |
| Tracked tree | No | Yes | `src`, `docs`, `agents`, `tests` | only `mandated-lines.md`'s own examples |

Both surfaces where a line is genuinely owed, and which can be inspected at all,
read zero.

## The null is not specific to the intent line

The step asked only about the intent line. Extending the same extraction to all
five labels over assistant prose only, with fenced blocks stripped:

| Label | Emitted (outside fences) | Occurrences incl. fenced |
|---|---|---|
| `Intent:` | **0** | 2 |
| `Authorization:` | **0** | 0 |
| `Commit:` | **0** | 2 |
| `Pending:` | **0** | 0 |
| `Sibling search:` | **0** | 0 |

The four fenced occurrences are verbatim quotations of the contract's own
`parseDate` and merged-block examples. Fence-stripping is what separates them
from an emission, and it is the linter's own pass
(`src/scripts/lint_mandated_lines.ts:107-122`), reused rather than reimplemented
— that file records the same illustration as a working bypass when it is not
applied.

`Sibling search` appears somewhere in 71 transcript files and `Commit:
authorized` 17 times, both as prose inside quoted rule text rather than as a
line at the start of an emitted reply. The distinction is the whole measurement.

## What this does and does not establish

**Establishes:** zero qualifying emissions on every inspected durable surface,
for all five lines. The store demonstrably captures the normative surface — it
holds 35,516 assistant text blocks — so for the assistant-reply surface this is
not an observability artefact. The lines are not there.

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
# exit 2, population 0
```

Sensitivity, run before the null was trusted — the counter separates all three
classes on a synthetic report:

```
1. [distinct]    overlap=0.111  three slots that disagree
2. [restatement] overlap=0.667  three slots that restate each other
3. [malformed]   overlap=0      two slots
```

The per-line `overlap` figure is published for every line the counter reports so
a later reader can recompute at a threshold other than the stated default of
`0.6`, which is a chosen default and not a measured optimum.
