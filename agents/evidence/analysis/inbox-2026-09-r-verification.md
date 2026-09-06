<!-- evidence-type: analysis -->
# Inbox round 2026-09-r — verification and disposition

> Analysed 2026-09-06 against `main@6af83a64b`. Eleven topic folders, 67 files,
> ~55,800 lines — the largest round this store has taken. Each folder is a
> completed external analysis loop: several roadmap iterations converging on one
> consolidated `master` proposal, plus the transcript that produced it.
>
> The proposals arrive already in this repository's roadmap format — frontmatter,
> declared parent set, tree pin, `estate_growth_exempt`, `relates:`, kill
> register, per-step `verify:` lines. That is what makes the result worth
> stating plainly: **all eleven were verified claim by claim, and none was
> adoptable unchanged.**

## Phase 1 — naming

The eleven folders arrived under speaking names, several of them the names of
external projects. They were moved under one opaque round id before any deep
read; `TMP_QUOTE_RE` matches only the first path segment, so a tracked
`Source:` line reads `agents/tmp.old/inbox-2026-09-r/` and the topic names never
leave the gitignored tree. True source: one `ENC1:` token in the round's intake
note. Several folders carry an `ANNEX-provenance` file whose own title says it is
not for the repository; those stayed where they are.

## Triage

| # | genre | age | drafted-against | recurrence | lineage | disposition |
|---|---|---|---|---|---|---|
| 1–11 | external-review (consolidated proposal) + transcript | same day | `99d14b2e` or `6af83a64` — both real, the second is HEAD | see below | 10 × `n/a` / 1 × `ghost:` + `omits:` | deep-read, 11 parallel verifications |

`lint_consolidation_lineage --root <round>` reported **2 findings across 11
folders**: one master declares a parent no file provides and omits a sibling
that is present. Discharged below.

Transcript recurrence markers were near-zero — one hit across twelve transcripts.
The recurrence in this round is **structural, not rhetorical**: measured over
distinct round directories in `agents/tmp.old/`, the code-graph subject appears
in **72**, `eager-all` in **19**, `lean_projection` in **18**, standing-payload
in **15**. None of the four objects holding that work carried an arrival count
before this change; all four now do.

## The structural finding

Across the eleven `master` and `final` files, **48** distinct `road-to-*` slugs
are referenced and **35 do not exist** anywhere under `agents/roadmaps/`. The
thirteen that do exist are: `road-to-asked-not-parked`,
`road-to-bounded-reference-harvest-loop`, `road-to-host-enforcement-truth`,
`road-to-observed-learning-signal`, `road-to-one-motion-authority`,
`road-to-scan-that-fails-closed`, `road-to-the-activation-census-consequence`,
`road-to-the-skill-size-park-fired` (active), `road-to-routing-assurance-live-floors`,
`road-to-tell-detector-promotions` (later), and three in `archive/`.

Every other fold target is either a sibling proposal from this same round or
nothing at all. Eleven parallel sessions each folded their substance into
receivers they assumed the others would land. Full statement, reproduction
command and the owner question: `agents/roadmaps/stubs/road-to-a-proposal-that-can-be-adopted.md`.

## Per-proposal verdicts

| proposal | verdict | the load-bearing reason |
|---|---|---|
| 1 | (b) after corrections, one part owner-reserved | its docs waves reverse an owner lock of 2026-07-22 recorded in `archive/road-to-starlight-project-docs.md` that the proposal does not know exists; four cited figures do not reproduce |
| 2 | **(d) blocked** | composes an engine that does not exist under that name — declared honestly as its own blocker, but the roadmap it waits on is `ready` with **0 of 28** steps done |
| 3 | (b) after corrections | five wrong counts (57 not 116 catalog ids, 12 not 10 bench scripts, 11 not 10 graph files, 9 not 7 verbs); scope is 31 steps against an 18-times-archived design line; its own fallback is the better first adoption |
| 4 | (b) after corrections, realistically two adoptions | three wrong word counts; `work_engine` cited at a path that does not exist; one verify expects 7 failures where the tree gives 0; frontmatter names an external source in plaintext |
| 5 | (b) both files, neither alone | the two contradict each other on eight axes and each is right on some; the master's "parent set complete" is falsified by its own folder sibling; both are blind to `detect_silent_catch.ts`, the existing template for their detector |
| 6 | (b) after corrections | the wave it names as its reason to exist is already built — scope-hash binding and reader-recomputes freshness ship in `dispatch_r2_reviewer.ts:317-345` and `check_completion_review.ts:1322`; names a denylisted source at three lines |
| 7 | (b), correction list longer than the proposal admits | its consolidation dropped the `verify:` clauses of nearly every step, a complexity budget and a decay path — while asserting nothing was dropped, citing a register the file does not contain |
| 8 | **do not adopt as a roadmap** | a routing table whose targets do not exist: 10 of 13 owner-masters absent; its one real delta is already owned by an active roadmap it does not name |
| 9 | (b) after six text corrections | claims this tree's own HEAD is unresolvable (it is `origin/main`); its exit verify names a Python file deleted with the retirement |
| 10 | (b) after corrections | both fold targets absent; a coverage claim with denominator 3 where the contract names 6 consumers; a publish step that does not cite the Hard Floor it crosses |
| 11 | (b), reduced to one phase | phases 3–4 are already owned by a decision packet with **better** numbers, a fourth blocker it does not list, and a tripwire test it does not know; its blocker restates an unanswered owner question for the eleventh time |

## What became work

Four roadmaps, all `ready`, none of them a proposal's plan — each carries a
defect this run reproduced in the tree:

| roadmap | reproduction |
|---|---|
| `road-to-a-beta-window-that-is-not-a-surprise` | `reasoning-discipline-protocol.md:3` lapses 2026-09-14 and is absent from the lapsed baseline, so it enters the checker's **error** branch; separately 84 violations exit 0 under a baseline whose 2026-11-23 clearance nothing owns |
| `road-to-the-reasoning-surface-that-is-wired` | 21 fixtures with zero validators and five references to deleted Python; `mcp.json` is `{"servers": {}}` while a skill instructs calls to a tool; a grandfather entry excusing a skill from a requirement it has no directory to meet; three skills declaring explicit-request-only while publishing auto-trigger keywords |
| `road-to-figures-that-name-their-denominator` | `proof.md:307` says 81 rules carry no `enforced_by` "yet" while 9 are `kernel_denied` and never can; one command says six judges in three places and seven in four, listing seven; a workflow comment says the site is unpublished while its sibling has deployed it since 2026-07-05 |
| `road-to-a-readme-that-stays-short` | 638 lines / 5,550 words / first command at line 160, against an archived roadmap that completed this exact goal on 2026-05-18 — and a 750-**line** ceiling with 112 lines of headroom that measures neither words nor first-command position |

Plus one stub carrying the structural finding and its owner question, and
arrival counters written onto four held objects that had none.

## The point ledger

```
claims        323 extracted → 254 still-true / 12 already-fixed / 45 never-true / 12 unverifiable
instructions    9 selected  →  0 reproduced /  4 diverged /  5 unexecutable
                              /  0 out-of-bound / rest not-attempted (selection)
demands        38 extracted →  4 adopted / 19 already-satisfied / 12 declined
                              /  3 owner-decision
```

**Instructions: 9 selected, and this time the phase produced findings.** Unlike
the previous round, several proposal steps pair an instruction with an asserted
outcome — a `verify:` line stating what running it yields — which is Phase 4b
criterion (a). Nine were selected on that basis and executed against the tree.
Five are **`unexecutable`**: a verify naming a file the Python retirement
deleted; an exit criterion demanding `enforced_by` on nine rules a guard forbids
from carrying it; a step recommending the one hook slot that returns before
emitting; a census bucket that cannot drop because the counter does not read the
field the step sets; a verify whose scanner cannot by construction match the
paraphrases it is aimed at. Four **`diverged`**: two verifies whose premise is a
defect the tree does not have (both already green), one expecting seven failures
where the tree gives zero, one asserting an empty grep that returns two hits. No
step was reproduced as written. Everything else is `not-attempted` by selection —
"build X in this repository" is a change to make, not a procedure to run, and
neither membership criterion admits it. The ceiling never fired.

**Demands: the 12 declines, grouped.** Six are scope preferences about how large
a roadmap should be, which this round answered by writing four narrow ones
instead. Four re-propose a mechanism a recorded decision already settled — a
delivery-mode flip whose packet exists with fresher numbers, a coverage
denominator change, a second negation vocabulary, a per-detector registry — and
re-proposing without new evidence is the mechanism-match failure
`decision-revisit-gate` names. Two are self-contradicting inside their own
document.

## Discharges

**The lineage finding.** One master declares a parent no file provides and omits
a present sibling. Discharged by discharge 3 of Phase 5: both were read. The
declared-but-absent parent is a naming error for a file that is present under a
different name in the same folder; the omitted sibling adds a single wave that
the master's own kill register rejects on a stated ground. Neither changes a
verdict.

**The two completeness claims.** Two masters assert a complete parent set and no
later synthesis; in both cases a sibling in the same folder claims the same
parents, and one cites a register for its no-loss claim that does not appear in
the file. Recorded here rather than folded in — the claim is the finding.

**Source confidentiality.** Seven of eleven name external projects in plaintext
within their first forty lines; one names a source listed in
`src/scripts/external_sources_denylist.json`. Nothing from any of them entered a
tracked artifact: the four roadmaps this round wrote cite the round codename and
nothing else.

## Two owner decisions

Neither is agent-decidable and both are carried on objects rather than in this
file: the beta-window contract that lapses in eight days (blocker on the
beta-window roadmap), and what makes a prepared proposal adoptable at all (the
stub above).
