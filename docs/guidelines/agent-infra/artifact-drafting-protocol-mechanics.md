# Artifact Drafting Protocol — Mechanics

> Phase A/B/C detail and the roadmap batch-mode carve-out for the `artifact-drafting-protocol` rule

_Origin: migrated from `src/rules/artifact-drafting-protocol.md` per the P4 pattern of `road-to-kernel-and-router.md`. The Iron Law, the trigger surface, and the golden rules stay in the rule; this file carries the per-phase procedure._

## Phase A — Understand

**Question zero, asked first: should this artifact exist at all?**

Before the five below, put the extend-versus-create question to the user —
*is there an existing artifact this belongs in?* It used to live in Phase B,
after the research, and it was measured moving: one source found that the same
stop placed after work had begun was passed straight through, because mid-build
momentum beats restraint. A stop that only fires once you are invested is a stop
that does not fire.

Asking it first costs one question and is answerable without the research: the
user usually knows whether they are extending something. Phase B still runs the
overlap scan — that is what turns a guess into a verdict — but it now *confirms
or overturns* an answer already on the record rather than raising the question
for the first time at the point where a draft is half-formed.

Ask up to **5** further clarifying questions (numbered options, each with a
*"skip / I don't know yet"* escape):

1. **Problem** — what does this solve that no existing artifact solves?
2. **Trigger surface** — which user phrasings should fire this?
3. **Should-trigger examples** — 2-3 in the user's words.
4. **Near-miss cases** — 2-3 phrasings that must **not** fire.
5. **Artifact type** — skill, rule, command, or guideline? Offer a
   3-line primer if unsure.

If the user skips Q1 or Q5, stop and surface the ambiguity — don't guess.

## Phase B — Research

Run the **search protocol** from
[`learning-to-rule-or-skill` § 4](../../../src/skills/learning-to-rule-or-skill/SKILL.md)
— `ls` all four surfaces (`skills/`, `rules/`, `guidelines/`, `commands/`),
grep with **solution-words AND problem-words**, scan sub-directory
taxonomies, then **open and skim** the 3 nearest matches. A negative grep
alone is not proof of no overlap. Report the top 3-5 most-similar
artifacts and ask (numbered options) — this **confirms or overturns** the
question-zero answer from Phase A with evidence, rather than raising it for the
first time:

- Extend an existing one?
- Create a new one — gap is real?
- Show overlap first?
- Promote via `learning-to-rule-or-skill` instead?

A Phase-B verdict that contradicts the Phase-A answer is the useful outcome, not
an embarrassment: it is the research doing its job. Surface the contradiction
and let the user re-decide.

Carry the summary into the commit message (*"Reviewed before drafting:
X, Y"*).

### Where the answer is written — `composition_review:`

A commit message is not a tree artefact. Measured 2026-08-27 over the twenty most
recently added skills and rules
(`agents/evidence/analysis/authoring-search-record-sample-2026-08-27.md`), **1 of
20** carried a machine-readable record of the Phase-B verdict; 9 carried a strict
prose one, and the rest carried a `See also` gloss or a routing row. So an
artefact authored after a thorough scan and one authored after none were
indiscernible in the tree — which is why the overlap tools
(`audit_overlap`, `audit_skill_overlap`, `report_layer_overlap`) run over a
corpus rather than over a decision.

The record is a frontmatter block, defined in `skill.schema.json` and
`rule.schema.json`, and **optional on existing artefacts by design — nothing is
backfilled**:

```yaml
composition_review:
  - candidate: skill:existing-ui-audit      # skill: / rule: / command: / guideline: / none
    disposition: create_separate            # what happened to this candidate
    rationale: audits what exists before a write; this governs the write itself
```

Four dispositions, and the discriminator for each:

| Value | Means |
|---|---|
| `extend_incumbent` | the incumbent absorbed the change; no new artefact was created |
| `compose_with_incumbent` | the new artefact routes to the incumbent rather than restating it |
| `create_separate` | the incumbent exists, was evaluated, and a separate artefact was authored anyway |
| `none_found` | the search ran and found no credible incumbent — pairs only with `candidate: none` |

`none_found` exists so an author is never pushed to **invent** an incumbent to
satisfy the schema. That failure would manufacture the pro-forma record the
mechanism is supposed to measure, using the mechanism.

`create_separate` is the value no other disposition vocabulary in this tree can
express, and it is why this is a fifth enum rather than a reuse. The nearest
incumbent is the harvest ledger's `adopt | adapt`
(`lint_harvest_provenance.ts:76`), which deliberately **excludes** rejection
(`:222`) because a rejected harvest has no artefact to cite. This record is the
mirror image — it is written *on* the artefact being created — so rejection is
the value it most needs. The finding, review and archive vocabularies are about
defects, review rows and roadmap files respectively; none of them has a slot for
"an incumbent existed and I built anyway".

**What the lint does and does not do.** `lint_composition_review` fails a record
whose `candidate` resolves to no artefact, or whose `none` / `none_found` pair
disagrees — a record naming an incumbent that is not in the tree reads as
evidence of a search that cannot have happened. It *reports without failing* an
addition carrying no record at all. It cannot check that the search happened,
that the rationale is true, or that the named incumbent is the nearest one;
flipping the advisory half to a block needs a false-positive rate from at least
one release of advisory operation, which does not exist yet.

## Phase C — Draft

Propose **2-3 description variants** — Conservative / Pushy
(per `skill-quality`) / Concrete (embedded trigger example). User picks
or merges. Only then draft the body. Surface every structural choice
(size class, section order) as numbered options if in doubt.

Enforce size live: *"Body is at 420/500 lines. Split?"* (budgets per
`size-enforcement`). New skills also get an `evals/triggers.json` stub
(5 should-trigger + 5 should-not-trigger). See `skill-writing` § 1c.

## Roadmap-run batch mode — the ONE structured bypass

When a `/roadmap:process-*` run starts under an **accepted execution
contract** (`roadmap-execution-contract`) whose pre-scan detected
artifact-authoring steps, the protocol runs in batch mode for exactly
those artifacts:

- **Phase B (Research) runs ONCE at contract time, against the CURRENT
  artifact state** — one overlap scan covering every artifact the
  roadmap plans; results (nearest matches, extend-vs-create verdicts)
  are surfaced inside the contract summary the user accepts. This is
  why authoring-time-only checking is not enough: a sibling roadmap may
  have landed overlapping artifacts between authoring and execution.
- **Phases A (Understand) and C (Draft) run non-interactively during
  the run** — the roadmap step text is the Understand input; the
  contract acceptance is the approval that the per-phase prompts exist
  to obtain.
- **Scope is the batch, nothing more.** An artifact NOT declared in the
  roadmap (discovered mid-run) triggers the full interactive protocol —
  or, under the contract, the scope-out-of-roadmap halt. That halt is the
  **default** and stays the default; see § Late artifacts below for the one
  declared value that changes it.
- Batch mode never skips the Research pass itself — it relocates and
  batches it. `artifact_protocol: skip` does not exist.

### Late artifacts — `halt` by default, `auto-research` only when declared

The bullet above is the whole rule when the contract says nothing. A contract
may instead declare `late_artifacts: auto-research`
([`roadmap-execution-contract § 2a`](../../../src/agent-src/contexts/execution/roadmap-execution-contract.md)),
and then a mid-run discovery runs **this** procedure rather than halting:

1. **Re-run Phase B against current state** — the same overlap scan the batch
   ran at contract time, now over the artifact the run just found. Nothing new
   is invented: this is the accepted-as-non-interactive procedure, later.
2. **Extend verdict → extend silently.** The nearest match is edited. This is
   the outcome the overlap scan exists to produce and it needs no approval it
   did not already have.
3. **Create verdict → derive Phase A from what is already on the record.** The
   understand-answers come from the roadmap step text plus the decision-sheet
   answers the user accepted. No new question is opened.
4. **Genuine overlap conflict → halt.** Two plausible extend targets, or a
   match whose scope contradicts the step, is a real decision and stops the
   run.
5. **Cap: three per run, then halt regardless of verdict.**

`halt` remains the shipped default (`decision 2026-08-20`, AI council 2/2 on
the `autonomy-defaults-sheet` fork; record
`agents/evidence/council/drain-blocker-dispositions-a.md`). The reasoning is
short: the cap bounds how far an unplanned artifact can drift the run, but it
does not decide whether the drift is wanted, and the conservative side of that
fork is the behaviour the tree already had. Making `auto-research` a declared
value rather than an inherited one is also what makes its own kill criterion —
the late-artifact revisit rate — attributable to the runs that chose it.
Reverting is one word in each of the two tables; no mechanism depends on the
default's direction.

**Kill criterion for `auto-research`, at the site rather than in a roadmap:**
a late-artifact revisit rate above 20 % — an auto-authored or auto-extended
artifact later reworked or reverted — removes the value and returns every
late discovery to `halt`. **No instrument today:** nothing counts late
artifacts or their revisits, so the rate is unmeasured rather than low, and
the cap of three is the only live bound. Recorded here because a criterion
that lives only in the roadmap that flipped the default becomes unreachable
the moment that roadmap is archived.


## Complexity budget — the six questions before a new artefact

Folded here from the 9.4.0 review (Prio 5), which named the failure mode:
"das Paket kann fast jede Kritik mit einem weiteren Mechanismus beantworten"
(Problem → Regel → Lint → Hook → Report → Roadmap → Claim → Test = governance
inflation). This REPLACES the ad-hoc "should this exist" prose — it is a
checklist, not a new gate/rule (adding a gate to enforce "add less" would be
the very inflation it guards against). Before drafting any new skill / rule /
command / hook / gate, answer all six; a "no" on **replaces** or **removable**
is a strong signal to fold into an existing artefact instead:

1. **Replaces?** — what existing mechanism does this retire or subsume? (If
   nothing, justify why the surface must grow.)
2. **Overlaps?** — does it duplicate a trigger / responsibility another
   artefact already owns?
3. **Discoverable?** — will a user actually find it, or does it just raise the
   catalog count?
4. **Measurable?** — is there a signal that would show it earning its place
   (or a null that would retire it)?
5. **Removable?** — can it be demoted / de-eligibled / deleted later without a
   migration?
6. **Who debugs it?** — is the maintenance owner real, given bus-factor?

The load-bearing question the review elevates: not "how do we prevent this
error in future?" but **"which existing mechanism gets removed or replaced?"**

## See also

- `artifact-drafting-protocol` (rule) — Iron Law, triggers, golden rules.
- `ask-when-uncertain` · `improve-before-implement` · `user-interaction` · `skill-quality` — the protocol extends these; cross-link, don't restate.
