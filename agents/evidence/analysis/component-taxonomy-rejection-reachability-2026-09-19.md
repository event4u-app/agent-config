<!-- evidence-type: analysis -->
# The component-taxonomy rejection, and why nothing was allowed to cite it

**Why this file exists.** A recorded rejection of the five-level component
taxonomy arrived a second time. Under
[`recurring-criticism`](../../../src/rules/recurring-criticism.md) a repetition is
evidence about the **system**, so the disposition that dismissed it was reopened
before anything was re-derived. It was reopened, read, and found **right** — and
found to live in the one location every stable artefact in this repository is
forbidden to cite. This record is the reachability repair. It is not the
decision.

**Not an adoption, and not a refusal.** Nothing below reverses the rejection,
upholds it, or narrows the three options the owner holds. The decision stays
open under the `taxonomy-reversal-is-a-second-arrival` blocker. What changes is
that the decision's basis is now on a surface a stable artefact may link to.

## 1. Which store was checked, and what it held

| Store | Searched for | Result |
|---|---|---|
| `docs/decisions/` | `granular`, `taxonom`, `component`, `atomic` in filenames; `five-level`, `atomic design`, `atom.*molecule.*organism` in bodies | **no ADR exists on this subject** |
| `agents/settings/contexts/` (80 files) | same body patterns | nothing |
| `agents/evidence/` | same body patterns | one unrelated hit (a lineage record) |
| the project memory store | the whole index | nothing on component taxonomy |
| `agents/roadmaps/archive/` | the archived granularity roadmap | **the sole record — found here** |

The disposition is a single table row in
`agents/roadmaps/archive/road-to-component-granularity-vocabulary.md`, under its
*Dropped — and what killed each part* table:

> importing Frost's five-level taxonomy (atom/molecule/organism/template/page) —
> **not adopted, deliberately.** `grep -rniF 'atomic design' src/ docs/` → 0; the
> five levels have never been this repository's vocabulary. Adopting them would
> replace a three-tier distinction that already exists and is already
> load-bearing, and would import the classification churn the source's own
> critique documents.

Two further findings from the same file bear on the decision and are recorded
here rather than left to be re-derived a third time:

- **Its step 0.4 measured four candidate discriminators** — composition depth,
  state, sub-component count, prop count — against a levelled library of 55
  atoms, 3 molecules and 2 organisms, and **no candidate survived**: all four
  overlap across the two lower levels, several inverting. That is the
  "not computable" measurement the current blocker refers to. It measures
  *inference*, not *declaration*.
- **Its Phases 1 to 4 were cancelled as measured-null.** The three-tier
  granularity vocabulary the rejection above names as the thing a five-level set
  would *replace* was therefore never built. Whoever decides should weigh that
  the second leg of the rejection's stated reason no longer describes a shipped
  artefact. `AUDIT_KINDS` in `src/cli/commands/uiAudit.ts` is
  `component | view | style | page` — four audit kinds, not a granularity tier
  set.

## 2. The reachability failure, and why it is structural

`check_no_roadmap_refs` forbids every stable artefact from citing any `*.md`
under `agents/roadmaps/` **at any depth, `archive/` included**. Verified against
the gate's own source: `ROADMAP_FILE_RE` matches the nested path, and
`STABLE_TREES` covers `src/rules`, `src/skills`, `src/agent-src/commands`,
`src/agent-src/contexts`, `src/agent-src/templates`, `src/agent-src/personas`,
`agents/settings/contexts`, `docs/guidelines` and `docs/contracts`, with
`AGENTS.md`, `README.md` and `docs/architecture.md` named individually.

So the only record of the rejection sits behind a gate that stops any rule,
skill, command, context, guideline or contract from pointing at it. A reader who
meets the subject in a skill cannot be sent to the reason, and the rule that
forbids the link names the repair in its own Iron Law: promote the durable
conclusion and cite that instead.

This is a second reachability failure, independent of the one already recorded on
the blocker. That one was a guard whose claim outran its test; this one is a
location nothing is permitted to reference. Fixing the first did not touch the
second.

## 3. Which of the three `recurring-criticism` outcomes applies

**The third: the disposition was right, it was recorded, and the carrier that
was supposed to make it reachable did not carry it.** Not the first — the
measurement the rejection rests on has not been re-measured by this round or the
last one, and a repetition opens the question rather than answering it. Not the
second — it was recorded, in prose, with its evidence.

What failed was delivery, twice over:

1. the guard the archived risk register specified was never written, and the
   claim that a shipped test covered it was false — measured 2026-09-13 by
   planting `organism` into both surfaces and observing 36 of 36 tests green;
2. the prose record is in a location stable artefacts may not cite, so no
   surface a later round reads could point at it.

Repair 1 landed as the fourth `describe` block in
`tests/cli/uiAudit_design_system.test.ts` — it asserts the archived step's own
named set (`atom`, `molecule`, `organism`, `template`) against `AUDIT_KINDS` and
against the skill's declared list independently, so a coordinated edit turns both
red. Repair 2 is this file.

## 4. A defect in the decision packet, corrected

The blocker's § What to do instructs the reader to run:

```
grep -n 'no order is prescribed' src/skills/ui-component-architect/SKILL.md
```

That returns **nothing**. The sentence begins a bolded line and the word is
capitalised, so the case-sensitive pattern misses it. An owner following the
blocker's own instructions would conclude the statement does not exist. The
working command and the location:

```
grep -n 'No order is prescribed' src/skills/ui-component-architect/SKILL.md
# src/skills/ui-component-architect/SKILL.md:88
```

**What the statement actually says matters to option (c).** It is not recorded as
a taste. It reads that no primary source states a required order, that
Storybook's own tutorial writes the component before the story, that Atomic
Design's author calls the process non-linear, and that measured evidence
comparing build orders is *absent, not merely weak* — concluding that a claimed
order is a preference someone holds rather than the skill's instruction.
Reversing it therefore means prescribing an order the tree has recorded as
evidentially unsupported. That may still be the right call; it is not the
zero-cost edit the blocker's recommendation describes, and the owner should see
the difference before choosing.

## 5. What this record does not settle

The three options stay exactly as the blocker states them, untouched: reverse
both, uphold both and record the arrival, or reverse only the ordering
statement. Choosing among three conventions with no measurable discriminator is
`product-owned` under ADR-268 § 10 — two valid user-visible semantics with no
source of truth — and that class is owner-locked. A council may advise on it and
may not rule on it.
