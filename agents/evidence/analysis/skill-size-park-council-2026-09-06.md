<!-- evidence-type: analysis -->

# The council on ADR-225's fired skill-size park: prompt, verdicts, convergence

Run 2026-09-06 on `drain/the-skill-size-park-fired`, based on `origin/main` @
`9b75231ed`. Phase 2.1 of `agents/roadmaps/archive/road-to-the-skill-size-park-fired.md`.

The council's own output lives under the gitignored, auto-pruned runtime tree,
so it is reproduced here in full rather than linked — a linked verdict rots
three ways and `check_council_references` forbids the citation. This file is the
durable artifact.

## Run metadata

| | |
|---|---|
| date | 2026-09-06 |
| members | 2 of 2 present — `anthropic/claude-sonnet-4-5`, `openai/codex-default` |
| rounds | 2 |
| blind chairman | yes; `Response-A` = `anthropic`, `Response-B` = `openai` |
| quorum before / after | 2/2 present, threshold 1 — concluded, both times |
| cost | estimated $0.0000 / spent $0.0000 — both seats subscription-authed, nothing billed |
| input | the Phase 1 reproduction, `agents/evidence/analysis/skill-size-park-fired-2026-09-06.md` |

## Why the prompt ships with the verdict

`evaluator-independence`: the same run that would prefer a convenient verdict
also authors the evaluator's prompt, so a recorded verdict whose prompt is not
recoverable is not evidence. The prompt is reproduced verbatim below, before the
answers, so a reader can check it for steering rather than take the claim on
trust. It states no expectation of the outcome in either direction, names four
answer shapes including one that rejects the question's framing, and hands over
the measured numbers rather than a summary of them.

## The prompt, verbatim

```markdown
# ADR-225's parked skill-size ceiling: its reopen condition has fired. What should the estate do?

You are being asked for a verdict on a recorded decision whose own reopen
condition is now satisfied. State whichever verdict the evidence supports;
no outcome is preferred here and none is expected.

## The record

`event4u/agent-config` is a governed suite of agent skills, rules and commands.
Skills are markdown files at `src/skills/<name>/SKILL.md`; each one is loaded
into an agent's context when it activates, so a skill's word count is a direct
cost paid on every activation.

ADR-225 (accepted 2026-08-12) considered a word or token ceiling on the skills
that carry no `token_budget_class` and **parked** it. Its stated reason, quoted
verbatim:

> A word or token ceiling for the 285 skills that carry no `token_budget_class`.
> Three size gates already exist — `lint_token_budget_discipline.ts` enforces a
> hard 3,500-**token** ceiling on the 4 skills that declare `rich`,
> `skill_linter.ts:1643` warns at 400 **lines**, `check_pack_size.ts` caps
> **bytes** per skill — and a fourth gate would fire on **4–6 files** on the day
> it ships. Measured distribution, so a future check is one command rather than
> a fresh census: n=289, mean 1,187, median 1,077, p90 1,867, p95 2,294,
> p99 3,851, max 7,094.
>
> **Reopen when** p95 crosses 3,000 words, or when more than ten skills exceed
> 2,500. Not before: a gate whose finding set is six files trains its readers to
> skip it, which is the failure it would exist to prevent.

The same ADR also rejected, in an "alternatives considered" section:

> **Ship the skill-size ceiling anyway, advisory.** Rejected: this package has
> repeatedly recorded that a gate measured before it is built either fires on a
> real population or is recorded as a decision instead. Six files is the second
> case.

## The measurement, re-derived today

Measured at `origin/main` @ `9b75231ed`, 2026-09-06, over `src/skills/*/SKILL.md`
with `wc -w`. Percentiles are nearest-rank, the convention recovered by
reproducing ADR-225's own four published percentile figures exactly at its
pinned commit.

|  | ADR-225 @ `26c575f66` | today @ `9b75231ed` |
|---|---|---|
| n | 289 | 299 |
| mean | 1,187 | 1,236 |
| median | 1,077 | 1,133 |
| p90 | 1,867 | 2,028 |
| p95 | 2,294 | **2,380** |
| p99 | 3,851 | 2,884 |
| max | 7,094 | 3,031 |
| skills above 2,500 words | 6 | **12** |
| skills above 3,000 words | 4 | 2 |

**One term of the disjunction fired and the other did not.** Twelve exceeds
"more than ten", so the count term is satisfied. p95 at 2,380 is 620 words below
the 3,000 threshold, so the p95 term is not.

The twelve, with word counts: `ai-council` 3,031 · `memory-consolidation` 3,012 ·
`git-workflow` 2,884 · `conventional-commits-writing` 2,771 · `decision-review`
2,763 · `testing-anti-patterns` 2,747 · `existing-ui-audit` 2,707 ·
`roadmap-writing` 2,698 · `react-shadcn-ui` 2,669 · `systematic-debugging` 2,668 ·
`adr-create` 2,515 · `subagent-orchestration` 2,503.

Nine of the twelve sit between 2,500 and 2,800.

## Two facts about *how* it fired

**1. The tail got shorter while the count doubled.** Max fell from 7,094 to
3,031 (`ai-council`), p99 from 3,851 to 2,884, and skills above 3,000 went from
four to two. The two largest skills ADR-225 measured were subsequently split or
migrated. The condition fired because the body of the distribution shifted up
against a fixed threshold, not because a heavy tail grew.

**2. Three skills moved inside the last two releases, and without them the count
is ten.** `conventional-commits-writing` 779 → 2,771 (a new seven-step
"establish the house convention" procedure, plus review-driven repairs);
`testing-anti-patterns` 2,314 → 2,747 (one new section naming two test smells);
`git-workflow` 2,558 → 2,884 (one new section, already above 2,500 before).
Each addition introduces a named new section or repairs a defect a neutral
review found — none is duplicated prose or migration residue.

## The question

ADR-225's park has fired and must be answered rather than silently extended.
The ADR itself frames three shapes of answer, and you are not limited to them:

- **(a) A disclosure sweep for the heavy tail** — no gate; the large skills
  declare their size, or carry `token_budget_class`, or state why their length
  is irreducible. This suite already has a `rich` class with a justification
  requirement and a 15 % cap; the twelve do not currently use it.
- **(b) A re-park on new numbers and a new condition** — the ceiling stays
  parked, but on a threshold that is not the one that just fired, with a stated
  reason why the new number is the right one. Re-parking on the same threshold
  would be a silent extension and is not an available answer.
- **(c) A mechanism** — a fourth size gate ships. ADR-225's own objection was
  that a gate firing on four to six files trains readers to skip it; today's
  finding set would be twelve, or fewer at a higher threshold.
- **(d) Something else** — including that the condition, as written, does not
  measure what it was meant to measure, and the disjunction itself should change.

## What to answer

1. **Your verdict**: (a), (b), (c), (d), or a combination — one paragraph
   stating what the estate should do.
2. **The load-bearing reason**, in terms of the numbers above rather than in
   general principle.
3. **If (b) or (c): the specific number**, and why that number rather than a
   neighbouring one.
4. **The strongest argument against your own verdict**, and why it does not
   change it.
5. **What would falsify your verdict later** — the condition under which the
   estate should revisit whatever you recommend.

Answer at the size the question needs. Where the evidence does not settle
something, say so rather than filling it in.
```

## Verdict — `anthropic/claude-sonnet-4-5` (Response-A), verbatim

```markdown
## Agreement and disagreement with prior rounds

### Points I agree with

**Reviewer A and B: The tail got shorter, this isn't unhealthy growth**

The evidence is unambiguous: max fell 4,063 words (7,094 → 3,031), p99 down 967 (3,851 → 2,884), skills >3,000 went from four to two. This is distribution compression, the opposite of the runaway expansion a size ceiling would address. Both reviewers are right that this fired on distribution health improvement, not deterioration.

**Reviewer B: "The trigger was a promise to reopen the decision, not a predetermined instruction to impose a ceiling"**

Exactly correct. ADR-225 parked the question with a condition for reconsideration. It did not encode "when this fires, ship the gate automatically." The condition fired; the answer can still be "no ceiling needed."

**Reviewer A: Recent growth was legitimate**

The three skills that moved (`conventional-commits-writing`, `testing-anti-patterns`, `git-workflow`) each added documented procedures or review-driven repairs. This isn't bloat; it's functional expansion. A gate that would have blocked that work is measuring the wrong thing.

**Both: No hard ceiling yet**

Agree. Nine of twelve flagged skills cluster tightly at 2,500–2,800 words. A hard gate firing on a dense boundary cluster trains the skip-warning habit ADR-225's park existed to prevent.

### Points I disagree with

**Reviewer A: 2,800-word disclosure threshold**

Too high. It catches only the three outliers (3,031 / 3,012 / 2,884) and exempts the clustered nine at 2,500–2,800. The purpose of disclosure isn't to flag only the most extreme cases—it's to make size a conscious, justified decision throughout the upper range. At 2,800 you've already lost that for most of the population the condition detected.

**Reviewer A: "p95 crosses 2,800" as a revisit condition**

This recreates the original problem: an absolute number that doesn't account for distribution shape or estate growth. If the entire distribution shifts up 200 words while maintaining health (same concentration, same tail thinness), p95 crossing 2,800 signals nothing meaningful. It's the absolute-count failure reapplied to a percentile.

**Both reviewers: Revisit conditions don't scale with estate growth**

Neither proposal addresses that the estate grew from 289 to 299 skills between the two measurements, and will continue growing. Reviewer A's "more than five skills exceed 3,000 words" and Reviewer B's revised "p95 ≥ 3,000" both become progressively easier to satisfy as the skill count increases, independent of distribution health. The percentile scales naturally; the count doesn't.

### New points and refinements

**1. The original disjunction was structurally defective**

ADR-225 combined a percentile (p95 crosses 3,000) with an absolute count (more than ten skills exceed 2,500). The percentile naturally scales with estate size; the count doesn't. At 299 skills, "more than ten" is 3.3%; at 500 skills it's 2.0%; at 1,000 it's 1.0%. This makes the condition progressively easier to satisfy through growth alone, which is the opposite of what a reopen condition should do. **The condition fired, but it fired on a structural defect in its own design.**

**2. Disclosure should tie to distribution, not fixed thresholds**

The right disclosure threshold is: **skills at or above `min(p95, 2500)` words**. This ensures:
- Today (p95=2,380): disclosure required at 2,380+ words
- If p95 shifts to 2,700: disclosure still at 2,500 (floor holds)
- If p95 compresses to 2,200: disclosure at 2,200+ (percentile wins)

This scales with the distribution and prevents the threshold from becoming either too permissive (if p95 falls) or too strict (if it rises while the distribution stays healthy).

**3. The real metric is distribution concentration, not absolute position**

What matters isn't where p95 sits in absolute terms—it's whether the distribution is becoming less predictable. A healthy distribution has most skills near the median with a thin tail. The failing distributions are those where:
- **Ratio p95/median exceeds ~2.2** (today: 2,380/1,133 = 2.1, just under)
- **More than 15% of skills exceed 2× median** (today: 2× median = 2,266 words; would need >45 skills above that, currently have 9)

These scale with estate growth and measure shape rather than absolute size.

**4. The three recent movers deserve explicit handling**

`conventional-commits-writing` (779 → 2,771), `testing-anti-patterns` (2,314 → 2,747), `git-workflow` (2,558 → 2,884) all grew for documented, legitimate reasons (new procedures, review repairs). They should not be retrospectively classified as budget overruns. Give them a one-time grandfather provision: declare size + reason in frontmatter, without forcing `rich` classification unless a future expansion crosses that threshold again.

**5. ADR-225's six-file objection still applies at twelve**

The park said six files is too few because "a gate whose finding set is six files trains its readers to skip it." At twelve files (4.0% of 299), we're still in that zone. The gate becomes worth enforcing when it catches a **material fraction**—probably 10–15% of the estate, which at today's count would be 30–45 skills. We're nowhere near that.

---

**My refined position:** **(d) — the condition doesn't measure what it was meant to, replace it with a distribution-health condition, and add percentile-tied disclosure.**
```

## Verdict — `openai/codex-default` (Response-B), verbatim

```markdown
Matze, my assessment is **mixed: adopt (a) + (d), with a failing disclosure check but no hard word ceiling.**

1. **Prior points I agree with**

I agree with both Reviewer A and Reviewer B that the original absolute-count condition is not a reliable proxy for a worsening heavy tail. The strongest evidence is the simultaneous improvement in every extreme-tail measure: max fell from 7,094 to 3,031, p99 from 3,851 to 2,884, and the number above 3,000 halved from four to two.

I especially agree with Reviewer B that firing the condition obliges the estate to reconsider the decision, not mechanically adopt the previously parked ceiling. I also agree with B’s proposal to require reviewable disclosure for every skill above **2,500 words**.

2. **Prior points I disagree with**

I disagree with Reviewer A’s proposed **2,800-word disclosure floor**. It is fitted to today’s convenient gap and excludes nine of the twelve files whose growth triggered reconsideration. Nothing in the evidence establishes that 2,771 words is materially harmless while 2,884 requires explanation. The recorded 2,500 threshold is the least arbitrary place to require scrutiny because it preserves continuity with ADR-225 without declaring that crossing it is a defect.

I also disagree with A’s three-part replacement trigger. “Twenty or more above 2,500” repeats the same non-scaling absolute-count problem, while the 2,800 p95 and five-over-3,000 thresholds are not supported by observed activation cost or quality data.

3. **Verdict and load-bearing reason**

Supersede ADR-225 with **(a) + (d)**:

- Require every skill above **2,500 words** to declare an appropriate `token_budget_class` and provide a concise size justification.
- Make missing disclosure a failing governance check.
- Do not make word count itself a failure.
- Remove the fixed “more than ten” reopen limb and retain **p95 ≥ 3,000 words** as the distribution-level reconsideration trigger.

The load-bearing reason is that only **12 of 299 skills (4.0%)** exceed 2,500, nine lie within 300 words of that boundary, and the extreme tail materially contracted. Those numbers support targeted accountability, but not a conclusion that the twelve skills should be shortened regardless of content.

The evidence does not establish whether `rich` is semantically appropriate for all twelve. If `token_budget_class` represents expected context cost, classify them consistently; do not permit an alternative free-form note that bypasses the classification system. If the current taxonomy cannot represent them, amend the taxonomy explicitly.

4. **Strongest counter-argument**

ADR-225 chose “more than ten” because twelve findings may be enough for a useful gate, and every word is paid on activation. Refusing a ceiling could therefore look like moving the goalposts precisely when enforcement becomes consequential.

That argument justifies action, but not a hard ceiling. The observed action-worthy problem is **unreviewed context cost**, while the data show no growing extreme tail. A disclosure gate addresses the demonstrated governance failure without treating legitimate procedures and defect repairs as violations.

5. **Concrete next steps**

1. Record a superseding ADR acknowledging that the original condition fired.
2. Define one canonical word-count command and percentile convention.
3. Require classification and justification above **2,500 words**.
4. Review and remediate the current twelve disclosures.
5. Keep **p95 ≥ 3,000 words** as the next estate-wide reopening condition.
6. Start measuring activation frequency and context consumption; word count alone cannot reveal aggregate cost.

This verdict would be falsified if p95 reaches 3,000 words, or if activation data show that skills above 2,500 cause material context pressure or task-quality degradation. Either result would justify reconsidering a hard ceiling, preferably in tokens rather than words.

**End summary:** Require governed disclosure above 2,500 words, retire the non-scaling count trigger, and reserve a hard ceiling for evidence of distribution-wide or measured runtime harm.
```

## One prompt claim, checked after the fact

The prompt asserts that "the two largest skills ADR-225 measured were
subsequently split or migrated". That sentence was written from the before/after
counts rather than from the commits, so it is checked here rather than left as
an assertion the council was handed:

```bash
git log --oneline 26c575f66..HEAD -- src/skills/ai-council/SKILL.md
```

returns `b26128927 refactor(skills): retrofit the four K6 offenders into router
heads`, and both skills now carry a `references/` directory
(`src/skills/ai-council/references`, `src/skills/skill-writing/references`).
The claim holds: `ai-council` 7,094 to 3,031 and `skill-writing` 4,666 to 1,753
are deliberate splits into disclosure sidecars, not deletions. No verdict rests
on it — both members reason from the percentile movement, which is measured —
but a prompt claim that had turned out false would have been steering, so it is
recorded either way.

## Convergence

Read against each other, the two verdicts agree on four things and split on one.

### Agreed — the four

1. **No hard size ceiling ships.** Both reject the parked mechanism on the
   numbers rather than on principle. A: a gate on a dense boundary cluster
   "trains the skip-warning habit ADR-225's park existed to prevent". B: the
   numbers "support targeted accountability, but not a conclusion that the
   twelve skills should be shortened regardless of content".
2. **The condition fired on a defect in its own design.** Both name the
   absolute-count limb as non-scaling. A states it as arithmetic: "more than
   ten" is 3.3 % at 299 skills, 2.0 % at 500, 1.0 % at 1,000 — "progressively
   easier to satisfy through growth alone, which is the opposite of what a
   reopen condition should do". B: "the original absolute-count condition is not
   a reliable proxy for a worsening heavy tail".
3. **The count limb is retired.** Neither keeps it in any form. B keeps
   `p95 >= 3,000` as the surviving distribution-level trigger; A wants shape
   ratios instead of any fixed number, and objects to count-based replacements
   for the same non-scaling reason.
4. **The upper range owes a reviewable justification of its size.** Both answer
   (a) — disclosure, not a ceiling — as the operative half of the verdict.

### Split — the one

**How the disclosure is represented, and at what threshold.** The two proposals
are not variants of one shape; their intersection is empty.

| | A (`anthropic`) | B (`openai`) |
|---|---|---|
| threshold | `min(p95, 2500)` — 2,380 today, scales with the distribution | fixed 2,500 |
| vehicle | frontmatter note: "declare size + reason in frontmatter, **without** forcing `rich` classification" | `token_budget_class` + justification; "**do not** permit an alternative free-form note that bypasses the classification system" |
| enforcement | not specified | "make missing disclosure a failing governance check" |
| new reopen condition | distribution shape — p95/median ratio above ~2.2 (today 2.1), or more than 15 % of skills above 2x median (today 9 of 299) | `p95 >= 3,000` retained, count limb dropped |

A's vehicle is precisely the one B forbids by name, and B's vehicle is precisely
the one A declines to force. Both flag the taxonomy question as unsettled by the
evidence — B explicitly: "The evidence does not establish whether `rich` is
semantically appropriate for all twelve. ... If the current taxonomy cannot
represent them, amend the taxonomy explicitly."

### What the split means for execution

Per `decision-revisit-gate`, a council split is an escalation condition for the
transition it splits on, not for the record as a whole. The four agreed points
carry; the disclosure mechanism does not. Implementing either vehicle would be
this run picking a side of a live split on its own authority — the shape the
roadmap's own risk 1 exists to prevent — so the mechanism is recorded as an open
transition with a named condition rather than built. The four agreed points are
recorded as Amendment 1 on ADR-225.

