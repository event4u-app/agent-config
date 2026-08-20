---
complexity: lightweight
---

# Stub: road to the live trigger-eval reading

> **Stub — not active work.** One evidence gap under two names, transferred out
> of **two** parent roadmaps on 2026-08-20 by the drain-run disposition
> framework
> [`agents/evidence/council/drain-blocker-dispositions-a.md`](../../evidence/council/drain-blocker-dispositions-a.md)
> — disposition **B**, outcome `transferred`, recorded there as
> "`skill-activation-window | B | transferred | Create one live-trigger-eval
> stub shared with human-gated-live-trigger-eval.`" and
> "`human-gated-live-trigger-eval | B | transferred | Merge into
> skill-activation-window's single live-trigger-eval stub.`" That framework file
> is present in this tree and resolves.
>
> Neither parent's Phase 1 was started, and not on effort: the reading needs a
> live model run on a maintainer machine behind an interactive terminal gate.
> Nothing here was attempted and rejected on merit.

## Parents

| Parent roadmap | Blocker id it closes | Its share of this gap |
|---|---|---|
| [`road-to-skill-description-measurement.md`](../road-to-skill-description-measurement.md) | `human-gated-live-trigger-eval` | Owns the **pre-registration** — the ≥ 100 requests / ≥ 3 shapes / ≤ 20 % degradation bar. Its whole Phase 1 moved here. |
| [`road-to-cost-parity-1-rule-payload-diet.md`](../road-to-cost-parity-1-rule-payload-diet.md) | `skill-activation-window` | Consumes that pre-registration as its own window. Its blocker text says so directly: the sibling's pre-registration "IS the bar Phase 2 needs". |

The council merged them because they are one gap, and its recorded dissent asked
the question this table answers: *"when merged, which roadmap owns the stub?"*
The pre-registration owner does. **The cost-parity roadmap has not been drained
yet; when it is, its blocker closes against this file as-is** — its criterion,
its steps and its probe are all already recorded below, so nothing here needs
editing to accept it.

## Resolved-when criteria, verbatim

Both, unaltered, because a merged stub that paraphrases either one has lost the
thing it was created to preserve.

From `road-to-skill-description-measurement.md`:

> **Resolved when:** a predictions JSON exists for the pre-rewrite and the
> post-rewrite tree state, produced by the same protocol.

From `road-to-cost-parity-1-rule-payload-diet.md`:

> **Resolved when:** the pilot tranche PR cites its activation baseline and
> the window it was measured over.

## Transferred work — the complete dependent-step list

### From `road-to-skill-description-measurement.md` — all of Phase 1

Verbatim step headings; the full text stays in the parent, which keeps each line
as `[-]` with a pointer here.

- **1.1 Capture the pre-rewrite baseline.** "Check out the tree state before the
  9 descriptions were rewritten, run the live trigger-eval to produce a
  predictions JSON, and score it."
- **1.2 Capture the post-rewrite rate** "on the current tree, same fixture set,
  same protocol."
- **1.3 Emit the verdict** "against the three pre-registered criteria, all of
  which must hold" — (i) per-cluster hit-rate improvement against that
  instrument's own measured baseline, (ii) no individual skill degrading by more
  than 20 %, (iii) ≥ 100 requests across ≥ 3 request shapes.
- **1.4 Publish the outcome either way.** "A null is a result."

All four of the parent's Success criteria depend on 1.1–1.4 and move with them.

### From `road-to-cost-parity-1-rule-payload-diet.md`

The council named "Phase 1.3's skill-usage column, and Phase 2's
trigger-accuracy bars". Read against that roadmap's text, that is exactly three
places, and they are enumerated rather than gestured at:

- **1.3, the skill-usage half only.** "`report_skill_activation` for skill usage
  (with its window depth stated — see the blocker)". The other two evidence
  columns in that step (`check_enforcement_coverage` at a measured 12.9 %, and
  git churn) do not depend on this eval and do **not** transfer.
- **2.1c in full.** "Once that eval has run, the bar adopts **its**
  pre-registration rather than a fresh number — ≥ 100 requests, ≥ 3 shapes, no
  skill degrading more than 20 % … The adoption is one line in the tranche
  template citing that roadmap."
- **2.5, the bar-gated half only.** "Once 2.1c's bar exists, a tranche that
  misses its margin reverts as a tranche and the miss is published". The
  interim rule in the same step — revert on "a **reported regression in the
  observed activation counts** plus the maintainer's call" — is already live and
  does **not** transfer.

**Step 2.1b does not transfer and must not be closed.** It is the standing
record that *no bar is asserted while the instrument is unverified*, and it is
load-bearing for exactly as long as this stub exists.

## Re-entry producer and detection probes

Promotion is not "when someone runs the eval". Four preconditions, each with a
named producer and a probe returning a decidable answer, each measured today.

| # | Precondition | Producer — who makes it true | Detection probe | Measured 2026-08-20 |
|---|---|---|---|---|
| P1 | A pre-rewrite predictions JSON | The maintainer, on a machine with a controlling terminal and a live API key | A predictions JSON of shape `{fixture_id: selected_skill}` exists for the tree state **before** the 9 description rewrites, and names that state | **FAIL** — no predictions JSON exists anywhere in the tree |
| P2 | A post-rewrite predictions JSON from the *same* protocol | Same producer, same sitting | A second predictions JSON for the current tree, sharing protocol metadata with P1 — same scorer version, same fixture file, same harness mode | **FAIL** — absent; and see blocker 3, two sittings is the failure mode |
| P3 | A fixture corpus that can satisfy criterion (iii) | The maintainer, as a reviewed decision — not an agent (blocker 2) | `tests/fixtures/skill_selection/fixtures.yml` carries ≥ 100 fixtures across ≥ 3 request shapes | **FAIL** — **34** fixtures, 7 clusters, 34 distinct prompts, and **2** of the 3 documented `kind` values in use (`clear-A` 23, `ambiguous` 11, `clear-B` **0**) |
| P4 | The cost-parity side's citation | Whoever lands the pilot tranche PR in that roadmap | The pilot tranche PR cites an activation baseline **and** the window it was measured over | **FAIL** — no tranche has landed; no baseline exists to cite |

P1 and P2 need a human and a live run. P3 is a maintainer decision about the
measuring instrument, not a coding task. P4 is downstream of all three.

## Blockers carried across in full

Four, each measured rather than argued.

**1. The council named the wrong producer command, and the correction matters.**
The disposition records the re-entry producer as "maintainer running
`rule_trigger_eval`", and both parents' blocker text says the same
(`./scripts-run src/scripts/rule_trigger_eval`, "hard-aborts under automation on
purpose"). Two things in that are wrong against the tree:

- `rule_trigger_eval.ts` is the **rules-scope** harness — its catalogue is
  "rule id + frontmatter description from `dist/agent-src/rules/<id>.md`", ids
  from `dist/router.json` tier_1 + tier_2 (`src/scripts/rule_trigger_eval.ts:14-17`).
  It does not select skills, so it cannot produce a skill-selection predictions
  JSON.
- It also does **not** hard-abort under automation; it is the deliberate
  automation-safe sibling — "this script is the **CI-only live path**"
  (`:25-29`), gated on a key file (`loadKeyFromFile('anthropic.key')`, `:315`)
  with no env-var fallback.

The interactive gate the blockers describe is real, and it lives in the
**skill-scope** sibling: `src/scripts/skill_trigger_eval.ts:500-503` throws
`ConfirmationAborted` — "Confirmation requires a controlling terminal
(/dev/tty). Refusing to run under automation." — when `fs.openSync('/dev/tty',
'r')` fails (`:497`). So the producing chain is **`skill_trigger_eval` →
predictions JSON → `score_skill_selection`**, and the class-3 human-only
classification is *correct* on the substance while naming the wrong binary.
Recorded, not silently substituted: the council's command stands in the
disposition record, and this is the tree's reading of it.

**2. The pre-registration cannot currently be satisfied, and widening the
fixture set is the hazard the parent's own Risk 2 names.** Criterion (iii) is
≥ 100 requests across ≥ 3 shapes; the corpus is 34 fixtures with 2 of 3 kinds
populated. So a live sitting run today would fail (iii) by construction, and the
run would have been spent. But growing the corpus is exactly "tuning the
fixtures instead of the descriptions" — rank-2 risk in
`road-to-skill-description-measurement.md`'s register. That makes P3 a reviewed
maintainer decision with the trade stated, not a gap for an agent to fill. An
agent that authored 66 more fixtures and then measured against them would be
grading its own paper.

**3. Two sittings produce two files that look comparable and are not.** Both
parents' recommendation fields say this and it is carried unweakened: the
Resolved-when requires both JSONs from the *same* protocol. Run both tree states
in one sitting, or record that the question is closed unmeasured. A protocol that
drifted between runs is worse than no reading, because nothing marks it.

**4. The scorer's zero-skill failure mode is contained, not eliminated.**
`score_skill_selection.ts` resolves skills through `SKILLS_DIR = SRC_SKILLS()`
(`:52`) and reads **290** today. Its own header records why that line exists
(`:22-29`): pointed at a missing directory, "its glob yields nothing, every
fixture scores against an empty skill set, and the output is a baseline of
silent zeros". `_globSkillMd` still swallows `ENOENT` (`:509-514`) to preserve
CPython glob semantics, so the shape that produced a confident wrong answer is
reachable if the resolver is ever repointed. Whoever runs the sitting should
record the resolved skill count alongside the predictions JSON.

## Baseline readings on the transfer date

Run from the parent checkout (a worktree has its own empty transcript store and
reports zero invocations — a measurement artefact, not a reading):

```
./scripts-run src/scripts/report_skill_activation
  skills shipped                         290
  with a machine-matchable trigger key   4 (1.4%)
  with a deterministic obligation        30 (10.3%)
  invocations total                      13   (30 sessions)
  distinct skills invoked                5 of 290 (1.7%)
```

Two of the three facts the parents recorded have moved, and neither movement
changes the disposition — the eval is human-gated either way:

- **"0 skills declare a machine-matchable trigger" is refuted.** Four do:
  `src/skills/merge-conflicts/SKILL.md:10`,
  `src/skills/systematic-debugging/SKILL.md:11`,
  `src/skills/threat-modeling/SKILL.md:13`,
  `src/skills/authz-review/SKILL.md:14`. The field is schema-declared
  (`src/scripts/schemas/skill.schema.json:290`) and its own comment says it
  shipped "empty of adopters" (`:305`) — so 0 was true when written and a
  4-skill tranche has since landed. `src/scripts/report_skill_activation.ts:27-28`
  still asserts "There are none: 0 of 288 skills carry a `triggers:` key" and is
  stale on both numbers.
- **"6 of 288 ever invoked" is window-dependent and its denominator is stale.**
  The 6-figure census is 59 sessions / 31 invocations / 6 distinct of 288
  (`agents/roadmaps/later/road-to-skill-ecosystem-executable-payloads.md:133-135`);
  a competing census for the same instrument records 4 distinct of 288 over 30
  sessions (`agents/roadmaps/archive/road-to-rule-delivery-integrity.md:57-60`).
  Today: 5 of 290 over 30 sessions. The substance — single-digit distinct skills
  against a ~290 catalogue — holds in every reading.
- **Host catalogue truncation is confirmed, on one host.**
  `agents/evidence/analysis/scoped-projection-host-delivery.md:17-20` measures
  `legacy-all` 297 offered / 402 dropped and `scoped` 226 / 330, descriptions
  "all stripped" in both arms. That artefact states its own limit at `:40-47`:
  one host, and the dropped count is not a survivor count. The Claude-side half
  is a single-session first-party observation
  (`agents/evidence/analysis/skill-catalogue-description-delivery.md:27-41`),
  and the "not measurable from transcripts" mechanism is at `:6-8` — the
  injected catalogue is not persisted.

## Promotion

Per `README.md`, a drain-run transfer is gated only by its own per-item probe —
the shared org-mode promotion criteria do not apply. Promote **per item**: P1
and P2 together discharge `human-gated-live-trigger-eval`; P4 discharges
`skill-activation-window`; P3 gates whether P1/P2 can satisfy criterion (iii) at
all. Delete this stub when its last item is gone.
