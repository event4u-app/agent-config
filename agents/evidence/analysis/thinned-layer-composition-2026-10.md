<!-- evidence-type: analysis -->

# The thinned layer, in one unit — composition, form, and what each move is worth

> Evidence for `road-to-a-thinned-layer-measured-in-one-unit`, steps 1.4, 2.4,
> 3.1 and 3.2. Measured on 2026-10-06 against the branch
> `drain/thinned-layer-one-unit-20261006`, whose base at measurement time was
> `main` @ `31e3da5ba`. The base moved twice afterwards and the reading was
> re-taken; see § The reading survived the base moving.

## The unit, stated before any number

Every figure on this page that is not explicitly labelled otherwise is in
**characters of the installed rule file after its frontmatter and its HTML
comments are stripped** — the unit `installed_layer.ts` reports, produced by
`ruleBody`, which is the same strip `project_thin_rules` and the delivery
carrier apply. It is **not bytes** and **not tokens**, and it is strictly
smaller than any raw-file figure in this tree, by whatever that corpus spends
on frontmatter and comments.

Three units appear on this page and they are never mixed in one sum:

| Unit | What it counts | Where it is used here |
|---|---|---|
| report characters | body after the frontmatter and comment strip | every unlabelled number below |
| raw file characters | the file as written, frontmatter included | the receipt's `365283 -> 123485` line only |
| GPT tokens | `tiktoken cl100k_base` | the projector's own measurement line only |

## The method

```bash
# 1. A fresh, empty HOME with the opt-in on the user-global layer.
#    <HOME>/.event4u/agent-config/settings/.agent-settings.yml:
#      lean_projection:
#        mode: delivery
#        hosts:
#          - claude-code
HOME=<fresh> EVENT4U_CONFIG_HOME=<fresh>/.event4u/agent-config \
  AGENT_CONFIG_NO_UI=1 CI=1 \
  bash src/scripts/install --global --tools=claude-code --yes

# 2. The reading, through the library every other reader uses.
#    buildInstalledLayerReport({ home, projectRoot, manifestPath: null })
#    over <HOME>/.claude/rules, classifying each file with `is_thin_entry`
#    and the stub law marker, and the bucket membership from
#    dist/router.json (kernel) and src/config/rule-consequence-class.json.

# 3. The projector's own figure, for comparison only.
./scripts-run src/scripts/project_thin_rules --measure --workspaces engineering
```

## The reading

**111,197 characters, 105 files, `claude-code` global scope.**

| Figure | Characters | Files |
|---|---|---|
| total | 111,197 | 105 |
| unconditional — what stands every session | 97,496 | 103 |
| path-scoped — what waits for a path match | 13,701 | 2 |
| package-owned | 111,197 | 105 |

The two path-scoped files are `design-review-after-ui-write` (7,588) and
`ui-audit-gate` (6,113).

Ownership resolved from the **global deploy inventory**
(`deployed-files.json`), not from a project manifest — a global-only install
writes no project manifest, and before step 1.2 of this roadmap both readers
reported `0 package-owned / 105 foreign` for a layer the installer had just
written itself.

## Composition — five buckets

Unconditional characters only. The five sum to 97,496 exactly, which is the
property that makes them a decomposition rather than a sample.

| Bucket | Rules | Characters | Mean |
|---|---|---|---|
| kernel, full-bodied | 9 | 25,704 | 2,856 |
| non-kernel kept full (`no_stub`) | 5 | 18,867 | 3,773 |
| other kept full | 0 | 0 | — |
| stubs carrying a law | 21 | 22,656 | 1,079 |
| plain stubs | 68 | 30,269 | 445 |
| **total** | **103** | **97,496** | |

The nine kernel rules: `agent-authority` (1,275), `ask-when-uncertain` (2,306),
`commit-policy` (2,805), `direct-answers` (3,123), `language-and-tone` (3,035),
`no-cheap-questions` (3,282), `non-destructive-by-default` (3,938),
`scope-control` (3,565), `verify-before-complete` (2,375).

The five `no_stub` members: `autonomous-execution` (6,146),
`legal-safety-floor` (5,583), `question-not-instruction` (2,435),
`runtime-safety` (1,131), `tool-safety` (3,572).

**Nothing is kept full for a reason outside those two classes.** The "other
kept full" row is zero, and it is reported rather than omitted: a reader
checking whether some third mechanism keeps a rule full-bodied gets an answer
instead of an absence.

## Form — what the 89 stubs pay for their own description

The 89 stubs hold 52,925 characters between them, 595 on average. **Every term
below is computed from its own construction, and the seven sum to 52,925
exactly** — there is no residual row, which is what makes this a decomposition
rather than six measurements and a remainder.

| Term | Characters | Shape |
|---|---|---|
| pointer | 17,356 | `Body: [\`<id>\`](<prefix><id>.md)`, 89 times |
| law text | 12,676 | byte-copied from the rule, on the 21 stubs that carry one |
| description | 10,614 | the rule's own one-line description, 119 on average |
| trigger hint content | 4,808 | the triggers themselves |
| marker sentence | 4,183 | 47 characters, 89 times |
| heading repeating the file name | 2,181 | `## <Title>` + newline, 89 times |
| `Fires on:` label and its full stop | 1,044 | 12 characters, 87 times |
| law join | 63 | 3 characters, on the 21 law stubs only |
| **total** | **52,925** | |

Of the pointer's 17,356, **12,371 is the package-root prefix alone** — 139
characters, 89 times — and 4,985 is the link syntax plus the rule id, which the
pointer writes twice.

**The law row is listed separately because it was invisible.** An earlier draft
of this table had six rows and obtained `description` by subtracting the other
five from the total, which silently folded the 21 law stubs' 12,676 characters
of byte-copied law — and their 63 characters of join — into it. Descriptions
then read as 23,353, 44 % of the stub form; they are 10,614, nearer 20 %, and
the largest single term is not a description at all but the pointer. A row
obtained by subtraction is not a measurement of the thing it is labelled; it is
whatever the other rows did not account for.

### The root length is in the number, so the root length is stated

The pointer is absolute and rooted at the package the install was made from, so
the layer's size depends on where that package sits on disk. The package root
measured here gives a **139-character** body-link prefix. Step 1.3 of this
roadmap pins the arithmetic as a test rather than an observation:

```
Δ characters = Δ prefix length × number of stubs
```

With 89 stubs, each character of root costs 89. At the 97-character prefix of
an ordinary checkout of this repository the same layer reads **107,459** in
all and **93,758** unconditional — 3,738 lower, which is 42 × 89.

Any figure on this page may be moved to another root the same way. None of the
conclusions below turn on the difference: at either root the layer is above the
recorded ceiling by more than the whole form saving.

## Three instruments, three numbers — and which answers which question

| Instrument | Reads | Figure | Unit |
|---|---|---|---|
| `project_thin_rules --measure --workspaces engineering` | the projected rule layer in `dist/agent-src/rules` | 106,686 (eager 415,704) | report characters, of a different corpus |
| the install receipt's thinning line | the installed files as written | `365283 -> 123485` | raw file characters |
| the install receipt's budget line | the installed layer | 111,197 package-owned | report characters |
| `buildInstalledLayerReport` | the installed layer | 111,197 = 97,496 + 13,701 | report characters |

The first is **not** the installed layer and never was: it measures the
maintainer-side projection over a different file set, under a workspace filter,
and the page that first published it says of itself that it "**does not
establish** that 106,800 is the installed layer's standing total". The recorded
over-ceiling verdict was read off that instrument. The second and third are the
same install measured in two units, which is why they differ by the frontmatter
every file carries. Since step 1.2 the receipt and the report agree on the
figure and on where ownership came from, which is what makes the last two rows
one reading rather than two.

## Against the recorded ceiling

The ceiling is "hard 75,000 with ≥10 % headroom" — a council's figure, recorded
in `agents/evidence/council/inbox-2026-10-c-standing-form.md`. The roadmap it
belongs to phrases its AC-1 in package-owned characters read by the
installed-layer report.

| Reading | Characters | Against 75,000 |
|---|---|---|
| unconditional | 97,496 | 130 % |
| all | 111,197 | 148 % |

Both CANDIDATE readings — unconditional and all — are over. (The path-scoped
row is a population, not a candidate ceiling; it is listed so the two candidates
are decomposable, not as a third reading.) **Which candidate the ceiling is
about is not settled here** — it is the question step 4.1 puts to the council
that set the figure, and this page records both rather than choosing.

## The reading after the form change

Steps 2.2 and 2.3 changed what a stub writes about itself, and nothing else.
The marker went from 47 characters to 27, keeping the instruction; the pointer
went from a markdown link whose text repeated the rule id to the bare path the
link already ended in. Re-measured the same way, from the same package root, on
the same tree:

| Figure | Before | After | Delta |
|---|---|---|---|
| total | 111,197 | 107,058 | −4,139 |
| unconditional | 97,496 | 93,357 | −4,139 |
| path-scoped | 13,701 | 13,701 | 0 |
| files | 105 | 105 | 0 |

The saving is 1,780 from the marker (20 × 89) plus 2,359 from the pointer
(534 of link syntax plus the rule id written a second time, 1,825 characters
across the 89 ids). It lands entirely on the stubs, which is the check that it
is a form change: `law_stub` 22,656 → 21,655 and `plain_stub` 30,269 → 27,131,
while kernel (25,704), `no_stub` (18,867) and both path-scoped rules are
byte-for-byte unchanged.

Form terms after the change, within the stubs' 48,786 characters:

| Term | Before | After |
|---|---|---|
| pointer | 17,356 | 14,997 |
| law text | 12,676 | 12,676 |
| description | 10,614 | 10,614 |
| trigger hint | 4,808 | 4,808 |
| marker | 4,183 | 2,403 |
| heading | 2,181 | 2,181 |
| `Fires on:` label | 1,044 | 1,044 |
| law join | 63 | 63 |
| **total** | **52,925** | **48,786** |

Of the pointer's remaining 14,997, **12,371 is still the package-root prefix** —
82.5 % of it, and untouchable from here: moving it is decision D5, behind the
open install-layout blocker.

**Six of the eight terms are byte-identical, and that is the check.** Only the
marker and the pointer were changed, so a form change that moved anything else
would be a measurement error rather than a saving. Both columns sum to their
stated totals from construction alone, and the two deltas account for the
whole difference: 4,183 − 2,403 = 1,780 and 17,356 − 14,997 = 2,359, which is
4,139.

The pointer delta reconciles term by term: 2,359 = 6 × 89 + 1,825 — the link
syntax dropped on each of the 89 stubs, plus the 1,825 characters of rule id
the old pointer wrote a second time.

Both corrections this table has needed came from reading it rather than from
re-running anything, and both were in the same direction — a number obtained by
subtraction looking like a measurement. The first draft reported the pointer at
15,039 from a pattern whose `\s*$` swallowed each stub's trailing newline, and
parked the missing 42 characters as a description movement; the second reported
descriptions at 23,353 because the law text had nowhere else to go.

### The expectation this reproduces, once the root is normalised

Step 2.4 predicted 84,991 unconditional and 98,744 in all. Those were computed
at a 45-character body-link prefix; this measurement is from a 139-character
one. Step 1.3's formula moves between them at 89 characters per character of
root, so 94 × 89 = 8,366:

- 93,357 − 8,366 = **84,991 unconditional** — the predicted figure exactly.
- 107,058 − 8,366 = 98,692 against the predicted 98,744, a 52-character
  difference which is entirely in the two path-scoped rules (13,701 here
  against the 13,753 recorded at the pin). Their bodies changed on the trunk
  between the two readings; no stub differs.

The agreement is worth stating because it is the only independent check this
page has that the formula is a formula and not a fitted constant: the
prediction was written before the change and measured from a different root.

## Against the recorded ceiling, after the form change

| Reading | Characters | Against 75,000 |
|---|---|---|
| unconditional | 93,357 | 124 % |
| all | 107,058 | 143 % |

At the 97-character prefix of an ordinary checkout: 89,619 unconditional and
103,320 in all — 119 % and 138 %.

**The form change is about four per cent of the layer and does not approach the
ceiling.** That is stated here rather than left to be inferred, because 4,139
characters is a real saving and a page that reported it without this line would
read as progress toward a target it does not move.

## Every remaining move, with its owner and its price

Each row names a move that could lower the standing layer, states who it is
permitted by and where that is recorded, and gives what it is worth **on the
layer as measured after the form change**, at a 139-character body-link
prefix. The rows are a price list, not a
plan: nothing here is a recommendation, and three of the five are not the
council's or the agent's to take at all.

### The arithmetic the law-heading rows use

A stub that carries a law is, on all 21 that exist today, exactly:

```
plain stub  +  the law text  +  3
```

The 3 is the join; the `<!-- law: … -->` markers are HTML comments and the
report's unit strips them. Measured across all 21 law stubs the figure is 3
with no variance, so the saving for a rule that gains a law heading is

```
saving = its full body  −  its plain stub  −  its law  −  3
```

and the only unknown in it is **which block becomes the law** — which is the
question step 4.2 puts to a council, one rule at a time. Each row below is
therefore a range across the blocks the rule already states, never a single
number.

### Row 1 — the four `no_stub` rules gain a law heading

| Rule | Full body | Plain stub | Candidate law | Saving |
|---|---|---|---|---|
| `tool-safety` | 3,572 | 336 | `## Core principle` 566 … `## Constraints` 774 | 2,459–2,667 |
| `runtime-safety` | 1,131 | 361 | `## Constraints` 554 | 213 |
| `question-not-instruction` | 2,435 | 443 | the opening fence 273 … `## The trap` 392 | 1,597–1,716 |
| `autonomous-execution` | 6,146 | 367 | a single fence 147 … the validation-loop fence 696 | 5,080–5,629 |
| **together** | | | | **9,349–10,225** |

**Permitted by** — and the row is not actionable by anyone else: a council, one verdict per rule, per decision D4 and step 4.2;
recorded at `agents/evidence/council/law-heading-<rule>.md`. The class file
states the reason itself — promoting a block to a law heading "is authoring a
law, which is a change to what the rule obligates", and the rule stays
full-bodied "until a law section is written deliberately"
(`src/config/rule-consequence-class.json`). The archived decision that put that
authoring under `artifact-drafting-protocol` is named in the roadmap.

Every candidate above is under the 1,200-character law target and far under the
2,000 hard ceiling (`lint_rule_law_section`), so none of them needs the law
shortened to fit.

### Row 2 — `legal-safety-floor`

| Full body | Plain stub | Its law today | Law stub would be | Saving |
|---|---|---|---|---|
| 5,583 | 410 | 2,023 | 2,436 | 3,147 |

**Permitted by the owner, and by nobody else.** Its law is already 2,023
characters — 23 over the hard ceiling, carried as a recorded exception whose
own `reason` field says the review is "about whether the STOP block belongs in
the law or beside it". So this row cannot be taken the way the four above can:
fitting the ceiling means shortening the law, and shortening a law is lowering
what stands. "Lowers or removes a recorded security / privacy / safety /
data-handling floor" is an owner-reserved row of `decision-revisit-gate`, which
is decision D6. **Priced here and deliberately not touched.**

### Row 3 — counting unconditional characters only

**Worth 13,701** — the two path-scoped rules, `design-review-after-ui-write`
(7,588) and `ui-audit-gate` (6,113).

This is not a change to anything. It is a reading of the ceiling: whether "hard
75,000" was set against what the host loads every session or against everything
the install writes. **Permitted by the council that set the figure**, which is
exactly what step 4.1 asks. Nothing in this roadmap chooses it.

### Row 4 — narrowing the consequence class

**Worth each moved rule's own law plus 3.** Across the corpus as it stands, a
law stub averages 1,031 characters and a plain stub 399, so a rule moved from
the first arm to the second is worth **632 on average** — but the mean is a
description of today's 21, not a price for any particular rule, and the honest
per-rule figure is its law.

**Permitted by a council**, on the same grounds as row 1 and in the same
direction: deciding a rule's law need not stand is the same kind of decision as
deciding it must, and the class file's criterion is where it is recorded.

### Row 5 — a pointer into a directory the installer owns

**Worth 89 characters per character of prefix** — step 1.3's formula, with the
stub count as the multiplier. The current prefix is 139 characters, of which
**12,371 is in the layer**. It is the single largest remaining form term, 82 %
of what the pointer costs and 13 % of the whole standing layer.

**Permitted by the owner**, behind the open blocker
`rule-link-targets-change-the-frozen-install-abi`. Decision D5: the pointer
directory and any change to what an install deploys stay with the install-layout
blocker, and `docs/contracts/install-layout.md` is where that is recorded. This
roadmap moves nothing here.

## Whether the ceiling is reachable at all

> **The unit these sums are read in is not settled.** A provider-diverse
> council (2/2 present, 2026-10-06) returned `unresolved-as-asked`, recorded at
> `agents/evidence/council/thinned-ceiling-unit-2026-10.md`. The record that set
> the figure says "**standing** target ~65,000, hard 75,000"; the installed-layer
> report that AC-1 binds itself to counted **all** characters and could not
> express the distinction until step 1.1 of this roadmap. Both readings are
> therefore given below, and neither is chosen here.

The recorded ceiling is "hard 75,000 with ≥10 % headroom". Read as the extended
roadmap's gate states it — **the measured total plus ten per cent, never above
75,000** — the working figure is 68,181, and both are given below.

Two sums, from the layer as it stands after the form change.

### Sum 1 — the form change plus the four law headings

| Reading | Characters | vs 75,000 | vs 68,181 |
|---|---|---|---|
| unconditional | 83,132–84,008 | 111–112 % | 122–123 % |
| all | 96,833–97,709 | 129–130 % | 142–143 % |

### Sum 2 — the form change plus both law moves, the fifth included

| Reading | Characters | vs 75,000 | vs 68,181 |
|---|---|---|---|
| unconditional | 79,985–80,861 | 107–108 % | 117–119 % |
| all | 93,686–94,562 | 125–126 % | 137–139 % |

At the 97-character prefix of an ordinary checkout each figure is 3,738 lower;
at the 45-character prefix the roadmap's own expectation was computed from,
8,366 lower — which puts sum 2 at 71,619–72,495 unconditional, under 75,000 and
still above the headroom-adjusted 68,181.

### What the two sums DO and DO NOT include

Stated explicitly, because the first draft of this page did not and a
provider-diverse council caught it: **sums 1 and 2 exclude row 5**, the pointer
prefix. They subtract the four law headings and, in sum 2, `legal-safety-floor`
— nothing else. Row 5 is excluded because it is behind an open blocker and
cannot be taken; but a sentence claiming "every move, taken together" while the
arithmetic omits the largest row is false, however the row is justified.

So here is the third sum, with row 5 included, and it changes the conclusion.

### Sum 3 — both law moves plus the pointer prefix

The prefix cannot go to zero — a path has a length. Two readings: the ceiling
of the row (12,371, the whole current prefix) and a realistic short
installer-owned prefix such as `~/.claude/rules/` at 16 characters, which
recovers (139 − 16) × 89 = 10,947.

| Reading | Row 5 at its ceiling | Row 5 realistic | Realistic vs 75,000 | Realistic vs 68,181 |
|---|---|---|---|---|
| unconditional | 67,614–68,490 | 69,038–69,914 | 92–93 % | 101–103 % |
| all | 81,315–82,191 | 82,739–83,615 | 110–111 % | 121–123 % |

**The two percentage columns read the REALISTIC column, not the ceiling one** —
stated rather than left to inference, because an unlabelled percentage beside
two candidate figures is the same defect the 4.1 council found in the first
draft of this page. At the row's ceiling the unconditional reading is
67,614–68,490, which is 90–91 % of 75,000 and 99–100 % of 68,181.

**The corrected conclusion, in three parts.**

1. **Under 75,000 on the unconditional reading: reachable** — but only with
   every row taken, including the one reserved to the owner and the one behind
   an open blocker. Neither is the council's to take and neither is the
   agent's.
2. **Under the headroom-adjusted 68,181: not reachable at a realistic prefix**
   — 69,038–69,914, which is 101–103 %. At the pointer row's unreachable
   CEILING, where the prefix would be zero characters long, the range is
   67,614–68,490 and its lower bound is 567 characters under 68,181. So the
   honest statement is not "never": the only combination that closes requires a
   prefix no path can have.
3. **On the all-characters reading: not reachable**, by a margin of at least
   6,315 even with every row taken at that same unreachable ceiling
   (81,315 − 75,000).

The first part is a correction of what this page said before the council read
it. The earlier text said the ceiling was not reachable by these moves, full
stop; that was true of the sums as computed and false of the moves as
described, because the largest move was named in the prose and missing from the
arithmetic.

**The second part is a correction of the correction**, recorded rather than
quietly amended because it is the same defect twice. Its first version read
"not reachable by any combination on this list, on any reading, at any root" —
contradicted by the Sum 3 table a few lines above it, whose own ceiling column
dips 567 under the figure. Conclusion 3 reads that very column, so the
exclusion could not even be defended as treating it as hypothetical. An
absolute quantifier is the easiest sentence to write and the hardest to hold;
both times the way to catch it was to read the sentence against the table
directly above it, and both times something other than the author did.

What has not changed: **no combination here reaches the ceiling the way it was
recorded**, which is 75,000 *with ≥10 % headroom*. Reading the ceiling as a bare
75,000 and the unit as unconditional is the only combination that closes, and
both of those are the open questions rather than settled ones.

### Where this differs from the roadmap's own expectation, and why

Step 3.2 predicted 75,900–77,900 unconditional with the four headings and
72,600–74,600 with the fifth. Normalised to the 45-character prefix those
predictions are for, this page reads 74,766–75,642 and 71,619–72,495 — about
1,100–2,200 lower in each case.

Two causes, both nameable. The candidate law blocks here are measured from the
rules as they stand today and are not the same blocks the prediction assumed —
`autonomous-execution`'s was priced there at the validation-loop section through
its first paragraph (1,385) where this page prices the fence alone (696) as the
lower bound. And the plain-stub figures here are post-form-change, so each of
the four is cheaper as a stub than when the prediction was written — by
`20 + 6 + len(id)`, which is 37 for `tool-safety`, 40 for `runtime-safety`, 46
for `autonomous-execution` and 50 for `question-not-instruction`. The direction
of the difference is consistent with both.

(An earlier draft gave 47 for all four. That is 4,139/89, the corpus mean, and
it is the figure for none of these rules — it is also, coincidentally, the old
marker's own length, which is how a mean comes to read like a measurement in a
sentence that is load-bearing for a 1,100–2,200 character reconciliation.)

## The reading survived the base moving

The branch's base advanced twice after these figures were taken, and one of the
commits edited a rule this layer carries — `context-hygiene`, three prose
changes in its body. Re-running the whole method at the new head:

| Figure | At the pin | At the current head |
|---|---|---|
| installed layer, report characters | 107,058 | **107,058** |
| the installer's pre-thinning raw total | 365,283 | 365,276 |

**Unchanged, and the way it is unchanged is the mechanism working.**
`context-hygiene` projects as a stub, and a stub is built from the rule's
frontmatter — its description and its trigger hint — not from its body. Editing
the body moved the pre-thinning figure by 7 raw characters and moved the
installed layer by zero.

That is the property the whole thinned form rests on, observed rather than
asserted: what a consumer stands under does not grow when a routed rule's prose
does. It also means every figure on this page is current at the head it is
published from, not only at the pin it was taken at.

## An adjacent defect, noted and not fixed here

The install receipt's budget block prints `no published limit recorded — not
measured` for `claude-code`, while the same rows resolve a 150,000 limit when
the library is called from source. `defaultHostLimitsPath` derives its path from
`import.meta.url`, which inside the bundled installer
(`dist/install/install.mjs`) resolves two levels up to the package root and then
looks for `config/host-instruction-limits.json` — a directory that exists only
as `src/config/`. So the receipt has never measured a consumer's layer against
a host limit, and the 80 % warning it exists to print cannot fire.

This is pre-existing, it is outside every step of this roadmap, and it is left
untouched here rather than fixed in passing. It is recorded because the receipt
is one of the two readers this roadmap makes agree, and a reader comparing the
receipt against this page would otherwise find a missing warning and no reason
for it.
