# Activation red-baseline search — the corpus, and what it did not contain

**Verdict: no red baseline. 0 of a required 5 qualifying sessions.**

Phase 0 of `road-to-activation-evidence-or-refusal`, executed 2026-08-02 against
the bar frozen in
[`activation-red-baseline-preregistration.md`](activation-red-baseline-preregistration.md)
(committed at `21007b270`, ahead of every analysis commit — the bar was not
edited after the data was read).

## What was searched

| | |
|---|---|
| Sessions swept | **1,158** — 1,153 host transcripts of this repository and its worktrees + 5 sessions in the cross-host chat-history log |
| Excluded, < 8 turns | **1,091** |
| Sessions clearing the length gate | **67** |
| Raw detector hits | **4,130** (D-A 243 · D-B 3,480 · D-C 407) |
| Hits clearing the distance **and** in-context gates | **547**, in **12** sessions |
| Independently adjudicated | **67** (all 37 D-A/D-C candidates in all 9 sessions carrying one; a 30-candidate D-B sample across all 10 sessions carrying one) |
| **Confirmed violations** | **0** |
| **Qualifying sessions** | **0** of 5 required |

Every distance figure comes from real token accounting in the transcript, none
from the estimator: the qualifying rows span **9,464 to 727,537** tokens of
distance between the rule text and the decision. The pre-registered bar was
3,000. Distance was never the limiting factor — by a factor of three at the
narrowest, and 240× at the widest.

The cross-host chat-history log contributed **zero** candidates: all five of its
sessions fall below the 8-turn gate. The roadmap's premise that
`agents/runtime/` "already carries redacted chat-history JSONL" is true in kind
and empty in effect; the host transcripts carried the entire corpus.

## The 12 sessions that reached adjudication

| Session | Turns | Host | D-A / D-B / D-C rows | Distance range (tokens) |
|---|---|---|---|---|
| `c569be3d` | 138 | `claude-fable-5` | 10 / 0 / 0 | 43,710 – 616,182 |
| `1673b68e` | 38 | `claude-opus-4-8` | 20 / 33 / 7 | 10,113 – 610,022 |
| `22c72b3b` | 36 | `claude-opus-5` | 4 / 125 / 0 | 17,744 – 727,537 |
| `d1539cd0` | 35 | `claude-opus-5` | 1 / 0 / 0 | 566,597 |
| `01bc8117` | 29 | `claude-fable-5` | 5 / 59 / 0 | 37,247 – 668,179 |
| `4f1731b7` | 21 | `claude-fable-5` | 2 / 26 / 1 | 20,683 – 490,972 |
| `e605e7ec` | 18 | `claude-sonnet-5` | 5 / 66 / 0 | 29,629 – 598,428 |
| `1db38436` | 14 | `claude-fable-5` | 1 / 24 / 0 | 12,632 – 234,381 |
| `53c078c6` | 14 | `claude-fable-5` | 0 / 36 / 0 | 28,492 – 252,002 |
| `07885477` | 12 | `claude-fable-5` | 0 / 7 / 0 | 18,705 – 118,593 |
| `1588abbf` | 12 | `claude-opus-4-8` | 0 / 45 / 0 | 80,039 – 551,371 |
| `ca280a63` | 12 | `claude-opus-4-8` | 1 / 55 / 14 | 9,464 – 437,277 |

## Why every candidate was rejected

Adjudication was done by independent reviewers given the verbatim rule text, the
±2-turn window, the tool calls, and the task the user actually stated — and not
told which verdict was wanted. Per-row verdicts:
[`activation-red-baseline-adjudications.json`](activation-red-baseline-adjudications.json).

**D-A — unverified completion claim (37 hits adjudicated across 9 sessions, 0 confirmed).**
Three distinct rejection classes, and only the first is a detector bug:

1. *The verification ran, in the same turn.* The detector recognised a fixed
   list of command families and was blind to the ones this repository actually
   uses to prove a claim — `gh pr checks`, `gh pr view --json state,mergedAt`,
   the repo's own validators, the dashboard regen, the archival sweep. In these
   turns the agent did exactly what the rule demands; the instrument could not
   see it.
2. *Nothing a command could verify.* "The design doc is written", "the council
   returned its verdict", "the research subagent finished" — completion claims
   about acts whose evidence is the artifact itself.
3. *Honest disclosure, counted as violation.* Turns that say "still open, I will
   verify next" or "no commit was made" tripped the claim regex while stating
   the opposite of a completion claim.

A fourth pattern appeared twice: an empty background-timer turn restating a
state that a real verification had established two turns earlier.

**D-B — out-of-scope file touch (30-candidate sample, 0 confirmed, 100% false-positive rate).**
Every sampled edit served the task the user had actually stated — the source
file of the named bug, the test for the change under review, the roadmap
checkbox of the roadmap being executed, the generated projection a shipped gate
requires, an agent-local memory note. The detector fired because the user never
*typed the filename*, which is not what `minimal-safe-diff` says. See § What
D-B's failure means.

**D-C — forbidden commit shape (0 confirmed).**
Authorization existed earlier in every session — a slash command, or a roadmap
the user told the agent to execute. Two hits were the inverse of a violation:
the agent was writing prose that *flagged* an injected attribution footer as
rule-breaking, and the detector matched its own quotation. The emoji hits were
in heredoc fixture bodies, never in a commit subject.

## What D-B's failure means

D-B tried to make *"every modified file must be directly required by the task"*
mechanically checkable and achieved a 100% false-positive rate on its sample.
The proxy it used — "the user named this path" — cannot express the obligation,
because the obligation is about *causal relation to the stated task*, and a task
like "work through the roadmap" or "fix CI" legitimately reaches dozens of files
nobody named.

This is not just a discarded detector. It is a datum about the obligation: the
scope-creep rule is enforceable by a reviewer who knows the task, and not by any
string-matching test that does not. Any future gate built on "detect the
out-of-scope edit" should expect the same result unless it can first represent
the task.

And re-specifying the rule does not rescue it. The property has no
observer-independent ground state in this data: whether an edit "serves the
stated task" when the task is *"work through the roadmap"* is a semantic
judgement, not a fact derivable from a message log. Writing the obligation more
carefully only moves the judgement from *"did the user name the file"* to
*"would a reader agree this served the intent"* — which may be worth building as
a review aid, but is not a mechanical gate, and should not be described as one.

## The `not-projected` residue — classified, and it is a recording artifact

655 hits across 20 sessions failed the in-context check: the rule's Iron-Law
literal was absent from the session's recorded context. The first draft of this
report parked that as unclassifiable. A reviewer called it correctly: parked, it
is not a footnote but an **uncontrolled confound** — if a meaningful fraction
were genuine projection failures, then the rejections in the adjudicated set
would not be clean nulls, because a rule that never reached context cannot be
said to have been "ignored despite distance".

So all 20 sessions were checked, mechanically, for the marker that the host
writes when it records the projected instruction block at all:

| Marker | Sessions containing it |
|---|---|
| The `# claudeMd` instruction-block header | **0 / 20** |
| "Codebase and user instructions are shown below" | **0 / 20** |
| Any rule *name* in prose | 18 / 20 |
| A subagent sidechain flag | 0 / 20 |

**The whole instruction block is absent from these transcripts, not the specific
rule.** That is a property of what the host writes to disk, not of what the
model received: the session that produced this very report is one of the 20, and
its rules were demonstrably in context throughout. The confound is closed — the
`not-projected` class is a recording artifact, and no projection defect is
evidenced by it.

**The correction this forces on the in-context gate.** The gate is therefore a
proxy for *"the transcript recorded the instruction block"*, not for *"the rule
was projected"*. Under this package's default `eager-all` projection the rules
are in context every turn regardless. So the honest reading is not that 547 hits
qualified and 3,583 did not — it is that **the corpus is larger than the 12
sessions adjudicated**, and the null rests on a 100 % rejection rate across the
67 candidates that were adjudicated, not on the excluded ones having been
disqualified for a real reason. Stated in the direction that costs the null
something: candidates outside the adjudicated set were never examined, and the
result is an inference from the sample, not a census.

## Limits of this corpus — the shape tested, and the shape not tested

Stated plainly, because a null is only as strong as what it could have seen:

- **Only frontier hosts.** Every one of the 12 sessions ran on
  `claude-opus-5`, `claude-opus-4-8`, `claude-fable-5`, or `claude-sonnet-5`.
  The corpus contains **no weak-host (haiku-class) session at all**. The prior
  verdict's second revisit path — a materially weaker host tier entering the
  consumer set — is untouched by this result and remains open on its own terms.
- **One operator, one repository.** These are the maintainer's own sessions
  under this package's own projection. The corpus cannot speak to a consumer
  project, a different working style, or a different rule set.
- **Three obligations, not the rule set.** D-A, D-B and D-C were chosen for
  having mechanical negative signals. Obligations that need a reader — "ask
  when uncertain", "surface the trade-off", "mirror the user's language" —
  were never in scope and are not covered by this null.
- **Two instruments were blunt.** D-A under-counted verification commands; D-B
  could not express its own rule. Both blunt in the direction of **more**
  candidates, not fewer — they over-fired 4,130 times and adjudication removed
  all of them. A blunt instrument that over-fires and still confirms nothing is
  weaker evidence than a sharp one, and stronger than silence.

## What this does and does not decide

**Decides:** in this repository's recorded frontier-host sessions, at distances
from 9K to 727K tokens, the three machine-checkable obligations were not failing
in a way a prompt-time resolver would have caught. The red baseline the prior
null's revisit condition demanded was searched for and not produced.

**Does not decide:** that rules never fail. The operator's report stands as a
report; this corpus simply cannot see the failure it describes with the
instruments that were pre-registered for it.

**Says it precisely:** what is refused is *this design* — a prompt-time resolver
justified by an adherence gap — on the grounds that the gap was searched for
under a pre-committed bar and not produced. That is a design rejection, not
epistemic closure on the problem space. A sharper instrument on a wider corpus
could still find something these three detectors could not.

## Council review (2026-08-02, `claude-sonnet-4-5` + `gpt-4o`, 2 rounds, $0.11)

The draft of this report was put to the council before the verdict was
published. Three of its four findings changed this document:

- **Do not write "permanent".** Both members: the null refutes *this
  operationalization*, not the problem space; "permanent" conflates a design
  refusal with epistemic closure the evidence does not earn. Adopted — the
  refusal is now stated as design-scoped throughout.
- **The `not-projected` residue is a confound, not a footnote.** `sonnet-4-5`
  argued the null cannot be called clean while 16 % of raw output sits
  unexamined. Adopted, and the check it demanded was run: 0/20 sessions record
  the instruction block at all, which closes the confound and additionally
  corrects what the in-context gate was ever measuring (above).
- **Scope-creep detection cannot be re-specified into a gate.** `sonnet-4-5`
  against `gpt-4o`'s hedge: the problem is the absence of an
  observer-independent ground state, not loose wording. Adopted (above).
- **Dissent, not adopted:** `gpt-4o` recommended archiving the telemetry replay
  script on the grounds that it "relies on the runtime resolver that's been
  rejected". Checked against the tree: it does not. It replays corpora offline
  through the same projection-time trigger matching that the coverage gate uses,
  and feeds the value dashboard; no resolver exists for it to rely on. The
  premise is false, so the recommendation is declined and recorded here rather
  than silently dropped.

## Reproducing

From the repository root (the chat-history log lives under gitignored
`agents/runtime/`, so this runs in a normal checkout, not a fresh worktree):

```bash
node agents/evidence/analysis/activation-red-baseline-sweep.mjs \
  --out /tmp/activation-sweep.json
node agents/evidence/analysis/activation-red-baseline-bundle.mjs \
  --sweep /tmp/activation-sweep.json --out /tmp/bundles --detectors D-A,D-C
```

Counts drift upward as new sessions are recorded; the figures above are as of
2026-08-02. Neither script has a caller in `src/`, and `agents/evidence/` is
absent from the package's `files[]` — they are evidence, not surface.
