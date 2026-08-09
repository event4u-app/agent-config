# Pre-mortem blind retro-validation — 4 closed-null initiatives, outcome withheld

> Gate (pre-authorised in `road-to-judgment-and-forensic-evidence` Phase 1.4):
> >= 2 of 4 blind pre-mortems must name the actual failure cause in their top
> three ranked causes of death. Below that, the protocol adds ceremony rather
> than foresight -> honest null, skill stays default-off and unrecommended.
>
> **Result: 3 of 4 hit — all three at rank 1. Gate PASSES.**
> The `premortem` skill remains default-off either way (per Phase 1.1); what
> the pass changes is that the skill ships as *validated*, not as ceremony.

## Method

Selection rule: the last 4 initiatives that closed as an honest null, by
recency of closure, subject to one structural exclusion:

| Closed | Initiative | Used? |
|---|---|---|
| 2026-08-07 | orchestrator-first execution | yes — plan 2 |
| 2026-08-02 | activation red-baseline | yes — plan 3 |
| 2026-07-31 | thin-projection quality (anchor-scoring pass) | **excluded** — the outcome is embedded in the plan text's own phase headings and running prose (`agents/roadmaps/later/road-to-thin-flip-under-anchor-scoring.md:34-63`); removing it leaves a torso with no Phase-1 mechanics, so no blindable plan text exists |
| 2026-07-21 | adversarial-council Mode 9 | yes — plan 1 |
| 2026-07-06 | reminder-injection Δ=0 | yes — plan 4 |

Known dependence, recorded rather than hidden: the activation red-baseline
plan text cites the reminder-injection null as its own revisit condition (it
was genuinely available at that plan's authoring time, so it stays in the
blinded text). The two draws are therefore not fully independent; both their
actual failure causes differ, so the dependence does not manufacture a hit.

Blinding procedure (mechanical, per plan):

- Plan 1 — `agents/roadmaps/archive/road-to-adversarial-council-benchmark.md`,
  full file; checkboxes reset to `[ ]`, HTML comments stripped.
- Plan 2 — `agents/roadmaps/archive/road-to-orchestrator-first-execution.md`
  lines 1–392; `<!-- done ... -->` / `<!-- cancelled ... -->` comments
  stripped, checkboxes reset.
- Plan 3 — `agents/roadmaps/archive/road-to-activation-evidence-or-refusal.md`
  lines 1–159; two outcome-anticipating phrases removed ("its most likely
  outcome is a deletion", "(the expected outcome)"), all HTML comments
  stripped, checkboxes reset. The pre-registered Branch A/B structure stays —
  it is legitimate pre-registration text, not a leak.
- Plan 4 — `agents/settings/contexts/reminder-injection-verdict.md` lines
  1–50 only (the pre-registered design; the readout starts at line 52).

Each blinded text went to an isolated writer session (fresh context, no
repository access, no web access) with the identical four-part register
instruction from the `premortem` skill: three ranked causes of death, one
untested hidden dependency, one survivable-failure modification, one tripwire
metric with a horizon. The writers were not told the initiatives had failed
beyond the pre-mortem framing itself ("imagine this plan failed").

Scoring rule (fixed before reading the registers): HIT iff the recorded
actual failure cause — the mechanism, not the topic — appears in the
register's top-three ranked causes. Adjacent-but-different mechanisms score
as MISS.

## Scoring

### Plan 1 — adversarial-council Mode 9 — MISS

- Actual cause (`docs/CLAIMS.md` `adversarial-council-finding-coverage`):
  zero lift — the second vendor's residual catches were a strict subset of
  the first's (redundancy between vendors), both recall thresholds missed;
  plus 100% FP on the clean controls under the skeptic posture.
- Register top-3: (1) residual pool too small to clear the dual threshold
  statistically, (2) corpus curation stalls against its own validity gate,
  (3) the maintainer spend gate never fires.
- Verdict: cause 1 is adjacent (small residual, thresholds unclearable) but
  names statistical undecidability, not vendor redundancy — the run was
  decisive, not noisy. Strict rule -> MISS.

### Plan 2 — orchestrator-first execution — HIT (rank 1)

- Actual cause (`docs/CLAIMS.md` `orchestration-value-gate`-family entry,
  resolved 2026-08-07): `gateVerdict()`'s two inputs both unmeasurable from
  the corpus — `net_win` needs a counterfactual not on disk and flips between
  fail/pass on the choice of baseline method (pre-registered as
  INDETERMINATE), `quality_held` needs paired outputs a single-arm corpus
  does not hold.
- Register rank 1: "`gateVerdict()` is structurally unrunnable on a
  single-arm retrospective corpus … the counterfactual 'is not on disk' …
  any defensible baseline estimate is method-sensitive — two methods
  plausibly flip fail<->pass for the same family."
- Verdict: the named mechanism is the recorded mechanism, including the
  method-sensitivity flip. HIT.

### Plan 3 — activation red-baseline — HIT (rank 1)

- Actual cause (`agents/evidence/analysis/activation-red-baseline.md`,
  `agents/settings/contexts/feedback-9x-council-cut.md`): the corpus could
  not produce the pre-registered bar — 0 of a required 5 qualifying
  sessions; Branch A recorded.
- Register rank 1: "The pre-registered bar is unsatisfiable by the corpus
  that exists … the initiative then closes on Branch A — 'no red baseline
  found' — but the honest reading is 'the corpus cannot answer the
  question'."
- Verdict: HIT. (The register's refinement — that a data-quality failure and
  an evidential null are distinguishable exits — is the one thing the real
  run answered better than the pre-mortem feared: adjudication was run and
  confirmed 0, and the refusal was recorded as design-scoped, not epistemic.)

### Plan 4 — reminder-injection — HIT (rank 1)

- Actual cause (`agents/settings/contexts/reminder-injection-verdict.md`
  readout): Δ = 0 pp on both hosts — baseline at ceiling; with the rule
  present in context at all, both hosts comply, so there is no salience gap
  for injection to close.
- Register rank 1: "The pressure corpus cannot generate a measurable baseline
  miss rate … the experiment reads out < 5 pp and triggers the pre-committed
  teardown — not because reminders don't work, but because the corpus never
  manufactured the failure regime" — the floor/ceiling effect, named before
  the readout was visible.
- Verdict: HIT.

## Gate resolution

3 of 4 registers name the actual failure cause at rank 1 of their top three.
The pre-registered gate (>= 2 of 4) **passes**. Consequence per Phase 1.4:
the `premortem` skill ships default-off with this validation recorded; the
null branch (remove the skill as ceremony) is not taken.

Honest bounds, so this is not over-read:

- n = 4, one writer model family, retrospective selection from a repo whose
  nulls share a culture of pre-registration — plans this explicit are easier
  to pre-mortem than the average plan. The pass says the protocol can extract
  foresight from plan text of this quality; it does not say +30% effect size
  (see Phase 1.5 — the cited prospective-hindsight number is deliberately not
  imported as support).
- All three hits are failures of measurability (unrunnable gate, unproducible
  corpus, ceiling baseline). The one miss is the one initiative that failed
  by *redundancy of the mechanism itself*. A fair reading: blind pre-mortems
  on this corpus are good at spotting "the experiment cannot answer its
  question" and did not spot "the mechanism works but adds nothing" — the
  register class to strengthen if this is revisited.

## Full registers (verbatim)

The four registers as returned by the blind writers, unedited, are archived
alongside this file in
`agents/evidence/analysis/premortem-blind-registers/plan-{1,2,3,4}.md`.
