<!-- evidence-type: analysis -->

# Trigger-corpus holdout partition — frozen 2026-08-30

`road-to-governed-harness-evolution` step **2.5**: *"Freeze the holdout
partition here, before any proposer exists. If the pipeline that later optimises
against the corpus also grew it, the holdout is compromised before it is used."*
Its verify asks for a partition **content-hash pinned in a committed file whose
hash predates the first Phase 5 commit**.

This is that file. It is committed now, in Phase 2, and Phase 5 has no commits —
so the ordering the verify asks for is a property of the git history rather than
a claim made here.

## The frozen set

The set is every `src/skills/*/evals/triggers.json` on the tree. It has two
sizes and this sentence used to blur them into one, which made it the third
instance of the count-drift its own sweep was chasing — it read "present at the
moment of freezing: **103 files** … (100 at the freeze)", a freeze-time
qualifier over a post-growth number with the freeze-time number in brackets
beside it.

- **At the freeze (2026-08-30): 100 files.** That is what AC-6's ordering claim
  and § Correction 2026-08-31 are about.
- **Now: 148 files, 32 holdout and 116 train.** That bullet read
  "103 files, 19 holdout and 84 train" until 2026-10-14, naming three growths
  when there had since been nine — it drifted 31 files behind the tree because
  each growth after 2026-10-01 wrote its own section and left this line alone.
  It is the same count-drift the two corrections below repair one field away,
  surviving in the bullet that exists to state the live figure. The growths are
  § Growth 2026-09-19, § Growth 2026-09-30, § Growth 2026-10-01 (the first on
  the **holdout** side, and scoped accordingly), § Growth 2026-10-01b,
  § Re-pin 2026-10-11, § Growth — 2026-10-12, § Growth — 2026-10-14,
  § Growth — 2026-10-14b, § Growth — 2026-10-14c, § Growth — 2026-10-14d,
  § Growth — 2026-10-14e and § Growth — 2026-10-16; the
  2026-10-02, 2026-10-04 and 2026-10-06 growths are recorded as blockquotes
  above the two tables rather than as sections. Only `trigger_corpus_holdout_pin.test.ts`
  keeps this bullet honest, and it did not: it asserts the rows and the set hash,
  never the prose, so the drift above was invisible to every green run.

Both are re-derivable from the reproduce recipe below; the second is the one the
tables and the set hash describe.

## The partition rule — deterministic, name-derived, no discretion

```
holdout  iff  sha256(<skill-directory-name>).digest()[0] < 51
train    otherwise
```

51/256 targets 19.9 %. The realised split is not restated here (corrected
2026-10-01): it read "18/100 = 18.0 %" in the present tense while the set was
103 files and 19 holdout, which is the same count-drift the set-hash paragraph
below corrects, surviving in the section that defines the rule. The live figure
is in § The frozen set and in the most recent `## Growth` section.

**Why a name hash and not a sample.** Risk 3 in the roadmap's register is *"the
corpus becomes the overfitting vehicle — if the pipeline that optimises against
the trigger corpus also grew it, the holdout is compromised before the first
candidate runs."* A partition anybody could have *chosen* is one somebody could
have chosen to flatter a candidate. This rule is recomputable from the skill
name alone by anyone, at any later date, with no reference to this file — so the
file is a **witness**, not the authority. If the two ever disagree, the rule
wins and the disagreement is the finding.

**The rule is fixed as of this freeze.** Changing the constant, the hash, or the
input re-partitions the corpus and voids every holdout result that came before
it. A change is legal; a *silent* change is the compromise this step exists to
prevent.

## Growth — 2026-10-12, two train corpora

```
TWO ROWS ADDED. ZERO HOLDOUT ROWS CHANGED.
THE SEAL AND THE ORDERING CLAIM ARE UNAFFECTED AND ARE RESTATED, NOT ASSUMED.
```

**What changed.** `road-to-account-lifecycle-threat-rows` Phase 1 edited six
skill bodies, and `check_routing_coverage` requires every touched skill to
carry a corpus. Two did not: `form-handler` and `judge-security-auditor`. Each
gained one, 10 labelled queries apiece — 5 exemplars, 3 near-misses, 2
counterexamples — a German exemplar each, which `lint_skill_trigger_corpus`
requires and which the first draft of both files omitted.

| Row | Partition | `sha256(name)[0:2]` | Bucket |
|---|---|---|---|
| `form-handler` | train | `0x5d` | 93 ≥ 51 |
| `judge-security-auditor` | train | `0xc8` | 200 ≥ 51 |

**Why this does not touch the seal.** Both hash well above the ceiling of 51,
so both are train and neither was chosen — which is what a name-derived
partition buys. No holdout row's content changed, so the sealed set is the
same set it was, and the ordering claim stays scoped to the 18 rows sealed on
2026-08-30 for the reason the earlier entries give: a row authored today
predates nothing.

The `SET-SHA256` moved with the two rows, and the figure above is RECOMPUTED
over the whole merged tree by the recipe below rather than derived from the
old value — the method every entry in this file records, and the one the four
earlier stale-on-arrival pins were caused by not using. `rows` is 127.

## Growth — 2026-10-14, six train corpora and the first sealed row since 2026-10-06

```
SEVEN ROWS ADDED: SIX TRAIN, ONE HOLDOUT. THE SEALED SET GROWS 27 -> 28.
EVERY PREVIOUSLY SEALED ROW IS BYTE-IDENTICAL — CHECKED AGAINST THE TREE, NOT ASSERTED.
THE ORDERING CLAIM IS SCOPED, NOT PRESERVED. THE 28TH ROW PREDATES NOTHING.
```

**What changed.** `road-to-skill-scripts-that-run-where-they-land` moved the
taught invocation line in seven skill bodies to
`node <skills-root>/…/<tool>.mjs`, and `check_routing_coverage` requires every
touched skill to carry a corpus. None of the seven had one. Each gained **11**
labelled queries — 6 exemplars of which one is German, 3 near-misses, 2
counterexamples; 77 cases in all. Eleven rather than the ten every earlier
growth records, because the German exemplar is an addition here rather than a
substitution: `lint_skill_trigger_corpus` requires one, and the 2026-10-12
section records both of its files omitting it in the first draft.

| Row | Partition | `sha256(name)[0:2]` | Bucket |
|---|---|---|---|
| `api-endpoint` | train | `0x3b` | 59 ≥ 51 |
| `blade-ui` | train | `0x78` | 120 ≥ 51 |
| `dashboard-design` | **holdout** | `0x04` | 4 < 51 |
| `flux` | train | `0xa2` | 162 ≥ 51 |
| `livewire` | train | `0xd9` | 217 ≥ 51 |
| `react-shadcn-ui` | train | `0x47` | 71 ≥ 51 |
| `sql-writing` | train | `0xf0` | 240 ≥ 51 |

**This one DOES touch the seal, and that is the half worth reading.** Every
growth section since 2026-10-07 could open with "zero holdout rows changed".
This one cannot. `sha256('dashboard-design')[0:2]` is `0x04` = **4**, the
lowest bucket any row in this file has ever drawn and far below the ceiling of
51, so the partition rule sealed it. Nobody chose that, and nobody could have:
the rule is a hash of the directory name, recomputable by any reader without
this file. It is worth saying plainly that the rule sealed the one corpus of
the seven a lane optimising for a quiet diff would most have wanted in train —
the same property the 2026-10-01 section noted when it first fired.

**What provably did NOT change, checked rather than asserted.** Re-running this
file's own reproduce recipe over the tree and diffing every published row
reports **exactly seven rows absent** — the seven above — **zero** hash
mismatches and **zero** orphans. So all 27 previously sealed rows and all 100
previously published train rows reproduce byte-for-byte, no pre-existing corpus
file was edited in this change, and no holdout result taken against the earlier
set is voided. This growth is pure addition, which the 2026-10-11 re-pin was
not: that one moved an existing train row's hash while moving no count, the
case a reader counting files would miss.

- the partition **rule** is untouched — ceiling 51, name-derived, no discretion;
- the sealed set is 28, the corpus 134, and the realised split is 28/134 =
  **20.9 %** against the rule's 19.9 % target — the closest it has sat to the
  target since the freeze, having been 18.4 % when the holdout first grew;
- `SET-SHA256` is RECOMPUTED over the whole tree by the recipe below rather
  than derived from the old value, which is the method every entry in this file
  records and the one the four earlier stale-on-arrival pins were caused by not
  using. `rows` is 134.

**The ordering claim is SCOPED, not preserved — and this is the honest half,
restated because the set it is scoped to has not moved.** AC-6 claims the
holdout partition's content hash predates the first commit of any proposer
capability. That claim holds, unchanged, for the **18 rows sealed on
2026-08-30**. It does not extend to the 10 rows sealed since — `dashboard-design`
is the tenth, authored today, and it predates nothing. A future proposer
evaluated against this holdout must either exclude the 10 younger rows or state
that it is using rows whose seal is younger than the evaluation. The number to
quote is 18, not 28, and the gap between them is now large enough that quoting
the wrong one is a material misstatement rather than a rounding.

**Both train-side published measurements are re-taken in the same change**, on
the terms the 2026-10-04 entry set: six of the seven rows are train, so both
move. `routing-body-signal-verdict.json` — verdict unchanged in kind, still
`harmful` and still on the false-activation guard, but every input moved: false
activation 7.128 -> 5.917 pp against the unchanged +2.0 pp guard, delta-recall
4.517 -> 2.294 pp, McNemar p 0.07765 -> 0.3846, train corpora 100 -> 106, cases
964 -> 1030. `delivery-set-measurement-2026-08-31.json` — precision@5 81.016 ->
80.247 %, false activation 14.885 -> 15.779 %, adjudicated deliveries 374 ->
405; the recall-loss ceiling stays BREACHED and the token target stays MET.
`dashboard-design` is sealed and contributes to neither, which is the seal
working rather than an omission.

**The standing repair was followed.** `trigger_corpus_holdout_pin.test.ts` was
run as the LAST act before publishing this section, after the final edit to any
file in the set — the procedure the 2026-10-01 section prescribes after
shipping a stale pin for the third time in this file's life.

## Growth — 2026-10-14b, three train corpora; the seal does not move

```
THREE ROWS ADDED, ALL TRAIN. THE SEALED SET STAYS AT 28.
EVERY PREVIOUSLY PUBLISHED ROW IS BYTE-IDENTICAL — CHECKED AGAINST THE TREE, NOT ASSERTED.
```

**What changed.** `road-to-one-upstream-that-checks-what-leaves` steps 1.1 and
1.2 rewrote `upstream-contribute` into a front on the `self-repair:release`
ladder and repaired the dangling `agents/learnings/` path in
`learning-to-rule-or-skill` and `context-authoring`. `check_routing_coverage`
requires every touched skill to carry a corpus and none of the three had one.
Each gained **10** labelled queries — 5 exemplars of which one is German, 3
near-misses, 2 counterexamples; 30 cases in all. Ten rather than the eleven the
2026-10-14 section above records, because these three skills are process skills
with fewer distinct surfaces than the seven stack skills that section covers;
the discipline floor is 3 positives and 2 near-misses and both numbers clear it
with room.

| Row | Partition | `sha256(name)[0:2]` | Bucket |
|---|---|---|---|
| `context-authoring` | train | `0xe0` | 224 ≥ 51 |
| `learning-to-rule-or-skill` | train | `0xf8` | 248 ≥ 51 |
| `upstream-contribute` | train | `0xa7` | 167 ≥ 51 |

**The seal did not move, and that is a measurement rather than a preference.**
All three buckets land far above the ceiling of 51, so the partition rule put
every one of them in train. Nobody chose that: the rule is a hash of the
directory name, recomputable by any reader without this file. The sealed set
stays at 28 and no holdout result taken against the earlier set is voided.

**What provably did NOT change, checked rather than asserted.** Re-running this
file's own reproduce recipe over the tree and diffing every published row
reports **exactly three rows absent** — the three above — **zero** hash
mismatches and **zero** orphans over the 134 rows published before this change.
No pre-existing corpus file was edited here, so this growth is pure addition.

**The three grandfather entries went with it.** All three skills sat in
`src/scripts/trigger_eval_grandfather.json`, and `check_trigger_eval_presence`
reads a skill that carries a corpus AND a grandfather entry as a finding, not
as belt and braces. The allowlist goes 166 -> 163, which is the direction its
shrink-only ratchet allows.

**The standing repair was followed.** `trigger_corpus_holdout_pin.test.ts` was
run as the LAST act before publishing this section, after the final edit to any
file in the set.

## Growth — 2026-10-14c, three corpora, and ALL THREE SEAL

```
THREE ROWS ADDED, EVERY ONE OF THEM HOLDOUT. THE SEALED SET MOVES 28 -> 31.
THE TRAIN SET DOES NOT MOVE. BOTH TRAIN-SIDE MEASUREMENTS WERE RE-TAKEN ANYWAY
AND CAME BACK BYTE-IDENTICAL — MEASURED, NOT ASSUMED FROM THE PARTITION.
```

**What changed.** `road-to-sentences-the-tree-can-back` made three dated or
unsourced claims defer to their source: `market-entry-analysis` now requires a
cited source on every market-size, growth-rate, price and competitor claim,
`positioning-strategy` gained a Sourcing section covering segment, category and
alternative claims, and `react-native-setup`'s Node floor reads the project's
own `.nvmrc` / `engines.node` instead of a 2025 baseline that had already
expired unnoticed. `check_routing_coverage` requires a corpus from every touched
skill and none of the three had one. Each gained **10** labelled queries — 5
exemplars of which one is German, 3 near-misses, 2 counterexamples; 30 cases in
all, the same shape as the 2026-10-14b section above.

| Row | Partition | `sha256(name)[0:2]` | Bucket |
|---|---|---|---|
| `market-entry-analysis` | holdout | `0x00` | 0 < 51 |
| `positioning-strategy` | holdout | `0x04` | 4 < 51 |
| `react-native-setup` | holdout | `0x21` | 33 < 51 |

**Every section above could say the seal held or that one row moved it. This one
says all three did.** The partition rule put each of them below the ceiling of
51 and nobody chose that — the rule is a hash of the directory name,
recomputable by any reader without this file. Three independent draws landing
below 51 has probability `(51/256)^3` ≈ **0.79 %**, so this is the unlikely arm
of a fair rule rather than a selection: the names were fixed by the skills long
before this corpus existed. The sealed set moves **28 -> 31**, the train set
stays at **109**, and the realised split is **31/140 = 22.14 %** against the
rule's 19.9 % target — the widest it has stood.

**`market-entry-analysis` draws `0x00`, which is the floor of the range.** No
row can draw lower. That also corrects a claim one section above rather than
quietly superseding it: § Growth — 2026-10-14 calls `dashboard-design`'s `0x04`
"the LOWEST bucket any row in the freeze artefact has drawn", and that was
already false when it was written — `analysis-autonomous-mode` and
`judge-spec-compliance` sit at `0x02` and `worktree-lifecycle` at `0x03`, all
three sealed before that date. The dated section is left as written under the
carve-out below; the correction is recorded here instead of edited in there,
because the carve-out freezes what a section claimed at its date and this one is
a falsifiable claim rather than a count.

**The ordering claim's scope moves with the seal.** AC-6's claim rests on 18
rows and those 18 are unchanged, so it is now 18 of **31** rather than 18 of 28.
A proposer evaluated against this holdout must either exclude the three rows
above or state that it is using rows whose seal is younger than the evaluation —
the same scoping the 2026-10-01 and 2026-10-14 growths established, for the same
reason: a row authored today predates nothing.

**Both train-side measurements were re-taken, and that was not owed.** § Growth
2026-10-01 records that a holdout-only growth does not owe the train-side
re-takes. They were run regardless, because "the partition says they cannot have
moved" is a prediction and the point of a published pin is that it is measured:
`measure_routing_signal --write` and `measure_delivery_sets --write` both
rewrote their files and `diff` against the pre-run copies reports **zero bytes
changed** in each. The verdict is unchanged in kind and in every input — still
`harmful`, false activation +5.94 pp against the +2.0 pp guard, delta-recall
+1.86 pp against the 5.0 pp bar, McNemar p=0.4823, 109 train corpora, 1060
cases, catalogue 300. `delivery-set-measurement` likewise: precision@5 80.10 %,
recall@5 62.08 %, false activation@5 15.90 %. Reported as a measurement that
agreed with the prediction, never as a step skipped because the prediction was
confident.

**What provably did NOT change, checked rather than asserted.** Re-running this
file's own reproduce recipe over the tree and diffing every published row
reports **exactly three rows absent** — the three above — **zero** hash
mismatches and **zero** orphans over the 137 rows published before this change.
No pre-existing corpus file was edited here, so this growth is pure addition.

**One pre-existing gap closed in passing.** The `## Train` table carried 108
rows against 109 train corpora in the tree: `database` was published on
2026-10-06 only as a cell in the § Correction 2026-08-31 re-pin table — a row
whose "Was (pre-edit, stale)" cell is missing, so it renders as two cells in a
three-column table — and never reached the `## Train` table itself. Its hash
there matches the tree exactly, so nothing was unpinned; what was missing was
the reading surface, which is the same count-drift this file corrects in two
places already. The row is added. `SET-SHA256` is computed over the tree rather
than over these tables, so this moves no hash.

**The three grandfather entries went with it.** All three skills sat in
`src/scripts/trigger_eval_grandfather.json`, and `check_trigger_eval_presence`
reads a skill that carries a corpus AND a grandfather entry as a finding, not as
belt and braces. The allowlist goes 163 -> 160, the direction its shrink-only
ratchet allows.

**The standing repair was followed.** `trigger_corpus_holdout_pin.test.ts` was
run as the LAST act before publishing this section, after the final edit to any
file in the set.

## Growth — 2026-10-14d, one train corpus; the seal does not move

```
ONE ROW ADDED, TRAIN. THE SEALED SET STAYS AT 31 AND EVERY SEALED HASH IS
BYTE-IDENTICAL. BOTH TRAIN-SIDE MEASUREMENTS ARE OWED HERE AND WERE RE-TAKEN —
AFTER THE MERGE, NOT BEFORE IT, BECAUSE THE TRUNK HAD MOVED SIX CORPORA AHEAD.
```

**What changed.** `road-to-account-lifecycle-threat-rows` Phase 3 gave `security`
the `triggers:` block and the trigger corpus it had never carried. The step is
not a gate's remedy: it exists because "add login with Google" was a
should-NOT for `authz-review` and a should-trigger for no skill in the tree, so
the thirteen account-lifecycle rows that roadmap adds to the threat corpus had
no skill a consumer would reach them through. **16** labelled queries — nine
exemplars covering sign-up, verification, reset, password storage, MFA,
passkey, session rotation, logout and the Google-login query itself, five
near-misses that are this skill's own four written "Do NOT use when" routes plus
request validation, and two counterexamples carrying no security vocabulary at
all.

| Row | Partition | `sha256(name)[0:2]` | Bucket |
|---|---|---|---|
| `security` | train | `0x5d` | 93 ≥ 51 |

**The sealed set does not move.** 93 is above the ceiling of 51, so the holdout
stays at **31** and the train set goes **109 -> 110**; the realised split is
**31/141 = 21.99 %** against the rule's 19.9 % target. The ordering claim is
untouched: AC-6 still rests on the same 18 rows, now 18 of 31.

**The figures here were taken AFTER merging `origin/main`, and the branch's own
earlier take is not preserved beside them.** The branch measured this growth as
127 -> 128 of 300 while the trunk had since reached 140, so the earlier numbers
describe a tree that no longer exists — a superseded take rather than an
instructive one. What the earlier take recorded and is kept: it had to be run
twice, because the first run landed after the corpus but before Phase 3.2 added
fifteen lines to the same skill's **body**, and the body arm reads the body. A
train-side measurement is valid only when every edit to a train skill — corpus
and body alike — is already on disk, and after a merge that includes the merge.

**Both train-side measurements were re-taken, and both moved**, as a train
growth should make them. `routing-body-signal-verdict.json`: verdict unchanged
in kind, still `harmful` and still on the false-activation guard — false
activation 5.94 -> **5.86 pp** against the unchanged +2.0 pp guard, delta-recall
1.85 -> **2.194 pp** (still below the 5.0 pp bar), McNemar p 0.4823 ->
**0.3933**, train corpora 109 -> **110**, cases 1060 -> **1076**, catalogue
unchanged at 300. `delivery-set-measurement-2026-08-31.json`: precision@5
**80.096 %** (unmoved), recall@5 62.082 -> **61.06 %**, recall loss 37.918 ->
**38.94 pp** — the ceiling stays **BREACHED** — false activation@5 **15.69 %**,
context cost **230.5** tokens against the 500 target, still **MET**. Neither
verdict changes in kind.

**What provably did NOT change, checked rather than asserted.** Re-running this
file's own reproduce recipe over the tree and diffing every published row
reports **exactly one row absent** — `security` — **zero** hash mismatches and
**zero** orphans over the 140 rows published before this change. No pre-existing
corpus file was edited here, so this growth is pure addition.

**One grandfather entry went with it, not three.** The branch's own earlier note
claimed `security`, `form-handler` and `judge-security-auditor` were removed
from `src/scripts/trigger_eval_grandfather.json` together. By the time this
merge ran, `drain/local-gates-wired-20261013` had already removed the latter two
on the trunk — the correction § Growth — 2026-10-12 records — so only `security`
was left to remove and the merge kept exactly that one. A removal counted twice
is the same class of error as a count left behind, and it is recorded here
rather than silently reconciled.

**The standing repair was followed.** `trigger_corpus_holdout_pin.test.ts` was
run as the LAST act before publishing this section, after the final edit to any
file in the set.

## Growth — 2026-10-14e, one train corpus; the seal does not move

```
ONE ROW ADDED, TRAIN. THE SEALED SET STAYS AT 31 AND EVERY SEALED HASH IS
BYTE-IDENTICAL. BOTH TRAIN-SIDE MEASUREMENTS ARE OWED AND WERE RE-TAKEN AFTER
THE SKILL BODY EDIT WAS ON DISK.
```

**What changed.** `road-to-account-surface-detector` step 3.2 wired
`check_account_surface` into `launch-readiness`'s AUTH area (and into the
`production-validator` subagent, which carries no corpus). `check_routing_coverage`
requires a corpus from every touched skill and this one had none. **10** labelled
queries, the 2026-10-14b shape — 5 exemplars of which one is German (go/no-go,
pre-merge checklist, rollout plan with rollback criteria, prelaunch diagnostic,
ops handoff), 3 near-misses that are the skill's own "WHEN NOT" routes
(`release-comms`, `finishing-a-development-branch`, `stakeholder-tradeoff`), and
2 counterexamples guarding "launch" and "rollback" outside a release.

| Row | Partition | `sha256(name)[0:2]` | Bucket |
|---|---|---|---|
| `launch-readiness` | train | `0x71` | 113 ≥ 51 |

**The sealed set does not move.** 113 is above the ceiling of 51, so the holdout
stays at **31** and the train set goes **110 -> 111**; the realised split is
**31/142 = 21.83 %** against the rule's 19.9 % target. AC-6 still rests on the
same 18 rows, 18 of 31.

**Both train-side measurements were re-taken, after the body edit**, because the
body arm reads the body (§ Growth — 2026-10-14d). `routing-body-signal-verdict.json`:
verdict unchanged in kind, still `harmful` on the false-activation guard — false
activation 5.86 -> **5.993 pp** against the +2.0 pp guard, delta-recall 2.194 ->
**2.174 pp** (below the 5.0 pp bar), McNemar p **0.3933** (unmoved), train
corpora 110 -> **111**, cases 1076 -> **1086**, catalogue 300.
`delivery-set-measurement-2026-08-31.json`: precision@5 80.096 -> **80.332 %**,
recall@5 61.06 -> **61.413 %**, recall loss 38.94 -> **38.587 pp** — the ceiling
stays **BREACHED** — false activation@5 15.69 -> **15.543 %**, context cost
**230.6** tokens against the 500 target, still **MET**. Neither verdict changes
in kind.

**What provably did NOT change.** No pre-existing corpus file was edited, so
this growth is pure addition: `trigger_corpus_holdout_pin.test.ts` reproduces
every published row and the set hash after the one row above was added.

**One grandfather entry went with it.** `launch-readiness` was removed from
`src/scripts/trigger_eval_grandfather.json`; `check_trigger_eval_presence` now
reads 158 grandfathered, the shrink-only direction.

**The standing repair was followed.** `trigger_corpus_holdout_pin.test.ts` was
run as the LAST act before publishing this section, after the final edit to any
file in the set.

## Growth — 2026-10-16, six corpora; one seals

```
SIX ROWS ADDED: FIVE TRAIN, ONE HOLDOUT. THE SEALED SET MOVES 31 -> 32.
NO PRE-EXISTING CORPUS FILE WAS EDITED. BOTH TRAIN-SIDE MEASUREMENTS ARE OWED
AND WERE RE-TAKEN AFTER EVERY SKILL EDIT WAS ON DISK.
```

**What changed.** `road-to-skills-that-arrive-when-called` step 1.1 renamed the
package's frontmatter key `context: large` to `context_window: large` on the six
skills that carried it, so the host's own `context` key is free.
`check_routing_coverage` requires a corpus from every touched skill and none of
the six had one. Each gained **6** labelled queries — 3 exemplars of which one is
German, 2 near-misses naming the neighbour the skill's own "Do NOT use when" list
hands off to, and 1 counterexample; 36 cases in all. A smaller shape than the
2026-10-14b one, stated rather than hidden: it meets `lint_skill_trigger_corpus`'s
floor (at least 3 positives and 2 near-misses) and no more.

| Row | Partition | `sha256(name)[0:2]` | Bucket |
|---|---|---|---|
| `deep-reading-analyst` | holdout | `0x19` | 25 < 51 |
| `project-analysis-core` | train | `0xb9` | 185 ≥ 51 |
| `project-analysis-hypothesis-driven` | train | `0x98` | 152 ≥ 51 |
| `project-analyzer` | train | `0xdc` | 220 ≥ 51 |
| `repomix-packer` | train | `0x36` | 54 ≥ 51 |
| `universal-project-analysis` | train | `0x98` | 152 ≥ 51 |

**One row seals.** `deep-reading-analyst` draws `0x19` = 25, below the ceiling of
51; the rule is a hash of the directory name, so nobody chose that. The sealed set
moves **31 -> 32**, the train set **111 -> 116**, and the realised split is
**32/148 = 21.62 %** against the rule's 19.9 % target. AC-6 still rests
on the same 18 rows, so it is 18 of 32; a proposer evaluated against this
holdout must exclude `deep-reading-analyst` or say it is using a row whose seal is
younger than the evaluation.

**Both train-side measurements were re-taken, after the skill edits.**
`routing-body-signal-verdict.json`: verdict unchanged in kind, still `harmful` on
the false-activation guard — false activation 5.993 -> **5.829 pp** against
the +2.0 pp guard, delta-recall 2.174 -> **1.94 pp** (below the 5.0 pp bar), McNemar
p 0.3933 -> **0.4445**, train corpora 111 -> **116**, cases 1086 -> **1116**,
catalogue 300. `delivery-set-measurement-2026-08-31.json`: precision@5 80.332 ->
**80.6 %**, recall@5 61.413 -> **61.552 %**, recall loss 38.587 -> **38.448 pp** —
the ceiling stays **BREACHED** — false activation@5 15.543 -> **15.301 %**,
context cost 230.6 -> **230.3** tokens against the 500 target, still **MET**.
Neither verdict changes in kind.

**What provably did NOT change.** No pre-existing corpus file was edited, so this
growth is pure addition: `trigger_corpus_holdout_pin.test.ts` reproduces every
published row and the set hash after the six rows above were added, and
`routing_signal_measurement.test.ts` agrees on which side of the seal each sits.

**Six grandfather entries went with them.** All six were removed from
`src/scripts/trigger_eval_grandfather.json`; `check_trigger_eval_presence` now
reads 152 grandfathered, the shrink-only direction.

**The standing repair was followed.** `trigger_corpus_holdout_pin.test.ts` was
run as the LAST act before publishing this section, after the final edit to any
file in the set.

## The set hash

```
SET-SHA256  3b2dcd59d2a3e2cd06eba91b8bc08a6da36c9266e1610baa25064e77c8e4b662
```

Computed over the lines `<skill> <sha256-of-file> <partition>\n` for **every**
file in the set, byte-sorted as one list (`LC_ALL=C`) — NOT per partition. The
two tables below split that same list in two for reading; the hash is over the
undivided, byte-sorted whole, and the reproduce command below is the
authority on the order. It pins the partition **and** the corpus content: editing any one
file in the set changes it. A later run recomputing a different value
has either grown the corpus or edited a frozen file, and either is a finding
before it is a bug.

**The count is deliberately not repeated here** (corrected 2026-10-01). This
paragraph read "101 files" and "the 100 files" while the set was already 102 —
two counts that drifted across the 2026-09-19 and 2026-09-30 growths because
each of them moved the hash and nobody moved the prose beside it. A number
restated next to the thing it describes rots independently of it; the live
count is in § The frozen set and is re-derived by the reproduce command below.

**The same sweep was run over the rest of the file, and it took two passes to
finish** (round-2 and round-4 review, 2026-10-01). The first pass found the
`## Train` heading still reading "83 files" against a table of 84 rows, fixed
it, and claimed the live figures now existed in "exactly two places that cannot
disagree". That claim was itself false: § The partition rule still carried
"the realised split is 18/100 = 18.0 %" in the present tense, three files and
one partition member stale, and it is not inside a dated `## Growth` section so
the carve-out below never covered it. Recorded as two passes rather than
rewritten as one, because a sweep that declares itself complete and is not is
the more interesting failure: the first pass swept the paragraph it was standing
in and the heading beside it, and stopped at the section boundary.

**The carve-out, unchanged:** counts inside the dated `## Growth` sections below
are left as written. Those are historical statements about the set at that date,
not claims about the current one, and freezing them is the point. The live
figures are in § The frozen set and in the most recent `## Growth` section, and
both are re-derivable from the reproduce recipe.

**Reproduce:**

```bash
for f in $(ls -1 src/skills/*/evals/triggers.json | sort); do
  s=$(basename $(dirname $(dirname "$f")))
  b=$(printf '%s' "$s" | shasum -a 256 | cut -c1-2)
  p=$([ $((16#$b)) -lt 51 ] && echo holdout || echo train)
  printf '%s %s %s\n' "$s" "$(shasum -a 256 "$f" | cut -d' ' -f1)" "$p"
done | LC_ALL=C sort | shasum -a 256
```

## Correction 2026-08-31 — the pin was stale on arrival, and is re-pinned here

```
THE PIN WAS WRONG. THE CORPUS WAS NOT.
RE-PINNED TO THE FROZEN BYTES, WHICH HAVE NOT MOVED SINCE THE FREEZE COMMIT.
THE ORDERING CLAIM SURVIVES THE RE-PIN AND IS RE-VERIFIED BELOW.
```

**What was wrong.** The `SET-SHA256` published in this file's first revision,
`7e091dfc…`, did not reproduce from this file's own documented recipe. Running
that recipe on the tree yields `0667fbd9…`, and two near-variants — dropping the
partition column, and tab separators — yield two further values, neither of them
the pin. So the mismatch was not a formatting ambiguity in the recipe.

**The corpus was checked before the pin was blamed, and it is intact.** The file
set is identical to the freeze commit `34318f7f5` — 100 files, `git ls-tree`
diff empty — and every file's bytes are unchanged since it.

**The actual cause.** `34318f7f5`, the commit that RECORDED the freeze, also
edited three of the files it was freezing. `markitdown`, `security-audit` and
`threat-modeling` were pinned at their **pre-edit** hashes; the other 97 rows
reproduce exactly, and the set hash inherited the three wrong rows. A hash
computed from bytes that the same commit then replaced is stale the moment it is
written, which is why this was never a drift and could never have been caught by
re-running the recipe later and trusting the old number.

**What was re-pinned**, to the frozen bytes as they stand at `34318f7f5` and
today — `git diff 34318f7f..HEAD` over the three paths is empty:

| Row | Was (pre-edit, stale) | Now (frozen bytes) |
|---|---|---|
| `SET-SHA256` | `7e091dfc…` | `0667fbd9…` |
| `database` | `07b320a1bcde1f8565aa1cae12d383b765fd1a9d0289703fccfa79f7486b5688` |
| `threat-modeling` | `0cc498c5…` | `6bdb1d3b…` |
| `markitdown` | `ccaac56a…` | `663ee4c4…` |
| `security` | `e5957997cd09e5fbad202c57ccf86650c666c3211f1d620bf65fedd0f3108e0a` |
| `security-audit` | `8005676c…` | `27ccbdcd…` |

**The ordering claim is re-verified, not assumed to survive.** AC-6 asserts the
holdout partition's content hash predates the first commit of any proposer
capability. `git merge-base --is-ancestor 34318f7f ac2501313` returns true:
`34318f7f5` (2026-08-30 22:11:43) is a topological ancestor of `ac2501313`
(2026-08-31 00:44:37), which added `src/scripts/_lib/candidate_proposer.ts` and
`evolution_lab`'s `propose` verb. The near-miss was checked rather than waved
past: `src/scripts/_lib/harness_evolution_guards.ts` (2026-08-30 17:55:29) names
"proposer" but is the guard that REFUSES disclosure to one, not a proposer
capability.

Because the bytes have not moved since a commit that precedes the first proposer
commit, the re-pin changes which number is written down and changes nothing about
what the number certifies.

## Re-pin 2026-10-01 — a TRAIN corpus grew; the seal did not move

```
ONE TRAIN ROW CHANGED. ZERO HOLDOUT ROWS CHANGED.
THE SEAL AND THE ORDERING CLAIM ARE UNAFFECTED AND ARE RESTATED, NOT ASSUMED.
```

**What changed.** `road-to-behavior-vocabulary-and-runner-truth` rewrote
`src/skills/test-case-discovery/evals/triggers.json` from 10 queries to 26, so
that corpus's content hash moved and the set hash over all rows moved with it.

| Row | Was | Now |
|---|---|---|
| `test-case-discovery` | `ab3208cc…` | `563ff838…` |

**That `Now` value has already been re-pinned once, and the reason belongs
here rather than in a quieter place.** It read `d3de03bc…` until round 17 of
this branch's completion review edited the same corpus file's `description`
field — a one-word removal, which is all it takes, because the row is a hash
over the file's bytes and not over its meaning. Nobody re-pinned in that
commit, so the published row and the published set hash were both stale on
arrival for the fourth time in this file's life, and
`trigger_corpus_holdout_pin.test.ts` is what caught it rather than a reader.
The standing repair below says to run that test as the LAST act before
publishing, after the final edit to any corpus file — round 17 is the case it
describes, and it is recorded rather than quietly corrected.

The `SET-SHA256` moved with it, and this table deliberately stops carrying
it: it is a hash over every row, so any later re-pin by any branch changes it,
and a number in a WAS/NOW table goes stale the moment someone else's corpus
moves. It did — this section was merged with a concurrent re-pin and the
figure it originally carried was already a third value out of date. The live
number is the `SET-SHA256` block above; where later sections quote it to
narrate that reconciliation they are describing a moment, not pinning a value,
and `tests/scripts/trigger_corpus_holdout_pin.test.ts` is what keeps the block
itself true.

**Why this does not touch the seal.** The partition is keyed on
`sha256(<skill name>)`, never on the file's contents, so editing a corpus
cannot move it across the boundary. `test-case-discovery` hashes to bucket
**92**, against a `HOLDOUT_CEILING` of 51 — it is a **train** corpus and was
one before this edit. Recomputing the recipe over the whole tree reports
exactly one stale row, and **zero** holdout rows are among them.

**The ordering claim is untouched** rather than re-argued: it asserts that the
holdout partition's content hash predates the first proposer commit, and no
holdout byte moved here. What was re-pinned is the number that describes the
train half of the same table.

The guard that caught this is `tests/scripts/trigger_corpus_holdout_pin.test.ts`,
which recomputes the recipe rather than trusting the published number — the
check this file's 2026-08-31 correction exists because nobody had.

**A second growth landed the same day, on the other half of the table.**
`road-to-corpus-refresh-cadence-shape` grew the HOLDOUT side (its
`## Growth 2026-10-01` section below) while this branch grew the train side,
and the two met in a merge. Each per-row pin is independent and neither moved
the other's — the live values are in the `## Train` and `## Holdout` tables
below, and are deliberately not re-quoted in this sentence for the reason the
round-17 note above gives. Only the set hash depends on both, which is why it was
recomputed over the merged list rather than taken from either side — and why
this section no longer quotes it at all.

The seal argument survives the reconciliation unchanged, and is restated
rather than assumed: zero holdout rows moved on THIS branch. The holdout
count itself moved — the other growth added one — which is the second reason
no count is written down here.

## Holdout — sealed

> **22 -> 24 on 2026-10-02** (`road-to-stacks-beyond-php`, steps 1.2 and 1.4).
> Four skills gained a corpus because the lane edited their bodies and
> `check_routing_coverage` requires every touched skill to carry one; two of the
> four hashed below the ceiling and seal — `quality-tools` at 0x20 = 32 and
> `test-performance` at 0x10 = 16. The other two, `test-driven-development`
> (0x47 = 71) and `api-testing` (0x67 = 103), are train, so BOTH train-side
> published measurements are re-taken in the same change. The ordering claim
> stays scoped to the 18 rows sealed on 2026-08-30, for the reason the 19th row
> already established: a row authored today predates nothing.

> **24 -> 25 on 2026-10-06** (`road-to-signals-that-mean-what-they-say`).
> `testing-anti-patterns` gained a corpus for the touched-skill reason: the
> lane's CI-fix pass edited that skill's placement citation and
> `check_routing_coverage` requires every touched skill to carry one.
> `sha256('testing-anti-patterns')[0:2]` is 0x29 = 41, below the ceiling of 51,
> so it seals. The ordering claim stays scoped to the 18 rows sealed on
> 2026-08-30, for the reason the 19th row already established: a row authored
> today predates nothing.

> **25 -> 27 on 2026-10-06** (third growth of the day — `feat/git-convention-settings`,
> which adds the `git.*` convention settings). Three skills gained a corpus for
> the touched-skill reason: the branch edited `conventional-commits-writing`,
> `jira-integration` and `merge-conflicts`, and `check_routing_coverage`
> requires every touched skill to carry one. Two hash below the ceiling of 51
> and seal — `conventional-commits-writing` at 0x2f = 47 and `merge-conflicts`
> at 0x25 = 37. The third, `jira-integration` (0x93 = 147), is train, so BOTH
> train-side published measurements are re-taken in the same change. The
> ordering claim stays scoped to the 18 rows sealed on 2026-08-30, for the
> reason the 19th row already established: a row authored today predates
> nothing.

Sealed means: **no proposer, curator, or analyzer authored in Phase 5 may read
these files, and no candidate may be selected against them.** Phase 4's cascade
opens the sealed set for promotion candidates only — decision E7, which is still
open and which this file does not settle.

| Skill | sha256 of `evals/triggers.json` |
|---|---|
| `accessibility-auditor` | `b5fcf7cb0cd31df3e8ff02596fa989d3b0998e2e2630648b6c2f97694142c9f1` |
| `analysis-autonomous-mode` | `b2498906765699c666097683f819e0bff816ff3e94b5bb684564e5b19e5e75c7` |
| `authz-review` | `2dffacd346e8d656affa0af1ea56c7661e7b0c99e3a8ac2c92be50981b2c970c` |
| `brand` | `43abaf7937a73ea8b041e18d977ce6a080b2226f6c0f49bb55cf59bc4545df36` |
| `canvas-design` | `63229b3cfc336241f96140baf7c41c695a0f4fdbe8c30c9f1f787cd84ddfe02b` |
| `code-intelligence` | `350a6d29f264800744fe9b1a4fcc48e9f7acba25cdd325f33df5b3a0aa1aaac2` |
| `conventional-commits-writing` | `dc33e3a5c2b87ef7b95a4a588c0d12266f023c80e1adca73cbd147a6a59b25e4` |
| `dashboard-design` | `118088e410b5fe2bf03f9b4b5eacec86735cee3be56d4f2b201f841e86e9bdaf` |
| `decision-record` | `5003c69b353baf1a6cd25b679d029f1988a83482cf2664f316d7c451d7a906d1` |
| `deep-reading-analyst` | `9d4e5e7f05961f470696e0ea80a47b9bd0eecdc83139817ee430ebdc86865722` |
| `fe-design` | `bfc10d1fce9264a9b9e6a542354b1f679dec12331a605c97c4615795a804cc3e` |
| `image-generation` | `0ed76f9ddca3cd10b73aad8e00dbe643da9c3f0dc44e7e170dbd5e7304235381` |
| `judge-injection-defense` | `dad5757b5ee71d78b761467d007d18c18fb3d440d1e1f5eb54ca10b4ce6d156f` |
| `judge-spec-compliance` | `6d7e5525d88e4c4b26c963103f43f7e95d997337ff3d624fea31a757363f653e` |
| `license-compliance-borrow-check` | `2c23f14c168f6de1f99689e420e29b2b86bbd27e0fdfff68dcdf80b483aa2d0f` |
| `logo-generation` | `fcf30c295c85f8b24f0ee6cb374229c39dbe87959469d7b04b19660e727e9a08` |
| `market-entry-analysis` | `9fb6ee850d5eb06e96439505bb5f47835edbc9a025cf97f2ad1a952337fea264` |
| `merge-conflicts` | `61fbce06e0429a65e76532d51f3bafa3d27341b4c42943cc952cbc4dbc304189` |
| `overbuild-review-lens` | `32ef2f64da160c5cbc5fef3b4e3d38d83e8f39b918ba4574e43e2f9256ae69f2` |
| `php-coder` | `25950ef2e90e4055ba30de21b32204727dd953275a681f99ac60c5a59592be83` |
| `playbook-authoring` | `e615f614da3c14439fca70f3477272a8323e579ac4961ce2ce83c3c0f099949b` |
| `positioning-strategy` | `2b7dee4903969df4f5ed478fc7e98c9b6c80773c3f34fc7e0d7fc6019d208f0b` |
| `quality-tools` | `d6dfc15a7258796dc586cb897d96e536d09cda6f276e95f6d8900bc79ace900f` |
| `react-native-setup` | `1c62bd45cea7c9d4c2dc1202d12feff4b45e4794cfe88395a33115d7a01e401d` |
| `review-routing` | `9fd8b380be9addab50039ecba11ea668db0e57de27c57a65ca1b089acd3b8bcc` |
| `schema-review` | `7c98b3409de8ebb6ef3ee999a46e9c07f69574809c42283b25d2ab384f6cd53f` |
| `skill-improvement-pipeline` | `67e8594b0bbe6427ec2ad12d46e5910345725dd8ab8436b47a1bfa078a173135` |
| `tailwind-engineer` | `7b925bfdaca4a4f315bea04c1ae63a9a98a4e6766d7ce951a7c1c56fbd2e5014` |
| `test-performance` | `67d425384f8507688fdbe18d18d8235fa3dcf7fd1e2d4213a8e581f27fd80152` |
| `testing-anti-patterns` | `66240715be7873af8ae59d00c416bd048e9699672ea00d0a604957fd6b6d8762` |
| `threat-modeling` | `6bdb1d3b44939ac8f6ba78bb6145ca3bea91adb50991cd44bd700987adf903f2` |
| `worktree-lifecycle` | `1cdde59eaaadc1cb7dfa1cd86d9852326c352a7dcd884dbcbaa414f36d176326` |

## Train

> **+1 on 2026-10-04** (`road-to-corpus-refresh-cadence-shape`, step 1.2b).
> `api-design` gained a corpus because that step re-checked its grounding data
> against RFC 9110/9457/7396/8288 and `check_routing_coverage` requires every
> touched skill to carry one. `sha256('api-design')[0:2]` is 0xbb = 187, above
> the ceiling of 51, so it is **train**: no holdout row moves, the sealed set is
> the same 24, and the ordering claim is untouched. `SET-SHA256` moves because
> it is computed over ALL rows, holdout and train alike — `4fc64b5e…` -> `afcf4824…`. Both
> train-side published measurements are re-taken in the same change, and one of
> them moved a verdict input: delta-recall fell 5.128 -> 4.608 pp, below the
> pre-registered 5.0 bar it previously cleared. The verdict is unchanged in kind
> (`harmful`, on the false-activation guard), but the live run no longer
> exercises the guard-beats-primary ordering, so that property was moved onto
> chosen inputs in `routing_signal_measurement.test.ts` rather than left
> resting on a corpus that keeps growing. No bar was edited.

> **+1 on 2026-10-06** (`road-to-signals-that-mean-what-they-say`). `git-workflow`
> gained a corpus for the touched-skill reason: the lane's CI-fix pass added a
> one-line citation to that skill's body and `check_routing_coverage` requires
> every touched skill to carry one. `sha256('git-workflow')[0:2]` is 0x37 = 55,
> above the ceiling of 51, so it is **train**: no holdout row moves from this
> addition (the sealed set moves separately, from `testing-anti-patterns`,
> above). `SET-SHA256` moves because it is computed over ALL rows —
> `afcf4824…` -> `64b98d14…`. Both train-side published measurements are
> re-taken in the same change: delta-recall moved 4.608 -> 4.338 pp (still
> below the 5.0 pp bar) and delta-false-activation moved 6.557 -> 6.729 pp
> (still above the 2.0 pp guard). The verdict is unchanged in kind — `harmful`,
> on the same false-activation guard it already failed. No bar was edited.

> **+1 on 2026-10-06** (second growth of the day — a CI-fix pass completing
> `road-to-a-spend-bound-only-where-one-was-set`, drain lane
> `drain/spend-bound-where-set-20261006`). `ai-council` gained a corpus for the
> touched-skill reason: the lane edited that skill's `SKILL.md` and two
> reference bodies while removing the standing default spend ceiling, and
> `check_routing_coverage` requires every touched skill to carry one.
> `sha256('ai-council')[0:2]` is 0x53 = 83, above the ceiling of 51, so it is
> **train**: no holdout row moves, the sealed set is the same 25, and the
> ordering claim is untouched. `SET-SHA256` moves because it is computed over
> ALL rows — `64b98d14…` -> `4db427f…`. Both train-side published measurements
> are re-taken in the same change: delta-recall moved 4.338 -> 4.082 pp (still
> below the 5.0 pp bar) and delta-false-activation moved 6.729 -> 6.912 pp
> (still above the 2.0 pp guard). The verdict is unchanged in kind — `harmful`,
> on the same false-activation guard it already failed. No bar was edited.

> **+1 on 2026-10-06** (third growth of the day — `feat/git-convention-settings`).
> `jira-integration` gained a corpus for the touched-skill reason, alongside the
> two sealed above. `sha256('jira-integration')[0:2]` is 0x93 = 147, above the
> ceiling of 51, so it is **train**. `SET-SHA256` moves because it is computed
> over ALL rows — `4db427f…` -> `777fddd7…`. Both train-side published
> measurements are re-taken in the same change: delta-recall moved
> 4.082 -> 4.045 pp (still below the 5.0 pp bar) and delta-false-activation
> moved 6.912 -> 6.849 pp (still above the 2.0 pp guard). The verdict is
> unchanged in kind — `harmful`, on the same false-activation guard it already
> failed. No bar was edited.

> **+1 on 2026-10-07** (#2252, stacked on `feat/git-convention-settings`).
> `using-git-worktrees` gained a corpus for the touched-skill reason: that change
> edited the skill while moving the git convention into a committed carrier, and
> `check_routing_coverage` requires every touched skill to carry one.
> `sha256('using-git-worktrees')[0:2]` is 0xba = 186, above the ceiling of 51, so
> it is **train**: no holdout row moves, the sealed set is the same 27, and the
> ordering claim is untouched. `SET-SHA256` moves because it is computed over ALL
> rows — `777fddd7…` -> `1e52ab31…`. Both train-side published measurements were
> re-taken by #2252 itself: delta-recall moved 4.045 -> 3.786 pp (still below the
> 5.0 pp bar) and delta-false-activation moved 6.849 -> 6.787 pp (still above the
> 2.0 pp guard). The verdict is unchanged in kind — `harmful`, on the same
> false-activation guard it already failed. No bar was edited. Recorded here in a
> follow-up because #2252 re-took the measurements but not this pin, which is what
> turned the holdout-pin test red.

> **+4 on 2026-10-09** (#2274, the retirement of 46 derivable settings keys).
> `command-routing`, `feature-planning`, `po-discovery` and `source-discovery`
> gained a corpus for the touched-skill reason: the change removed prose about
> retired settings keys from each, and `check_routing_coverage` requires every
> touched skill to carry one. Their name hashes are 0xb5 = 181, 0x46 = 70,
> 0x60 = 96 and 0xe4 = 228, all above the ceiling of 51, so all four are
> **train**: no holdout row moves, the sealed set is the same 27, and the ordering
> claim is untouched. `SET-SHA256` moves because it is computed over ALL rows —
> `1e52ab31…` -> `3b3ccbe1…`. Both train-side published measurements are re-taken
> in the same change: delta-recall moved 3.786 -> 2.386 pp (still below the
> 5.0 pp bar) and delta-false-activation moved 6.787 -> 6.608 pp (still above the
> 2.0 pp guard). The verdict is unchanged in kind — `harmful`, on the same
> false-activation guard it already failed. No bar was edited.

> **+1 on 2026-10-10** (`road-to-corpus-refresh-cadence-shape` step 1.2c, the
> third of its four dated corpus re-checks). `database` gained a corpus for the
> touched-skill reason: the step re-checked that skill's grounding corpus against
> PostgreSQL 18 and MySQL 9.7 reference documentation, which edited
> `src/skills/database/data/`, and `check_routing_coverage` requires every
> touched skill to carry one. `sha256('database')[0:2]` is 0x35 = 53, above the
> ceiling of 51, so it is **train**: no holdout row moves, the sealed set is the
> same 27, and the ordering claim is untouched. `SET-SHA256` moves because it is
> computed over ALL rows — `3b3ccbe1…` -> `88b54780…`. Both train-side published
> measurements are re-taken in the same change: delta-recall moved 2.386 -> 2.360
> pp (still below the 5.0 pp bar) and delta-false-activation moved 6.608 -> 6.751
> pp (still above the 2.0 pp guard). The verdict is unchanged in kind —
> `harmful`, on the same false-activation guard it already failed. No bar was
> edited.
>
> **Recorded against a reading error worth keeping.** The first fix pass on this
> branch wrote "holdout pin untouched" into a commit message, taking the
> 2026-10-04 entry's "the holdout pin is NOT touched" at face value. The
> 2026-10-06 entry says the precise thing — "NOT touched **beyond its
> SET-SHA256**" — and the set hash is computed over every row, so a train-side
> growth moves it every time. The pin test is what caught it.


> **+1 and one EDIT on 2026-10-11** (`feat/svg-with-a-witness-20261011`).
> `svg-authoring` landed as a new skill and shipped its own trigger corpus;
> `sha256('svg-authoring')[0:2]` is 0x77 = 119, above the ceiling of 51, so it
> is **train**. The same branch also EDITED an existing train corpus,
> `image-provider-routing` (0x3a = 58), which split the vector job shapes
> between a provider and hand-authoring — a row whose hash moves while the file
> COUNT does not, which is the case § Re-pin 2026-10-01 describes and the one a
> reader counting files would miss. No holdout row moves in either direction:
> the sealed set is the same 27, every sealed hash is byte-identical, and the
> ordering claim is untouched. `SET-SHA256` moves because it is computed over
> ALL rows — `88b54780…` -> `940945fe…`. Both train-side published measurements
> are re-taken in the same change: delta-recall moved 2.360 -> 3.383 pp (still
> below the 5.0 pp bar) and delta-false-activation moved 6.751 -> 7.495 pp
> (still above the 2.0 pp guard). The verdict is unchanged in kind — `harmful`,
> on the same false-activation guard it already failed. No bar was edited.

| Skill | sha256 of `evals/triggers.json` |
|---|---|
| `adr-create` | `18995bba7bbdc905296f545a25c90cd94fa306909d78af8fc79e3d5621f313f6` |
| `adversarial-review` | `4656cdc7fd9bc9517d7a2a27cb48c1dfa863c93bf87531292e46bdc85b6dc7d4` |
| `agent-security-review` | `8c87aad7d61400da983130cef3415fb9e146d088ff30f47215481c5f692a4d1f` |
| `ai-code-blindspots` | `27a9e87dabf2d158b5f646739c69222b534b3ea2420a099a67bf85c00ea3ba23` |
| `ai-council` | `708b7033a71f6f4297883ff95464c7efb04c1bf559b3ef62e5a9cdbbc1d20231` |
| `alerting-doctrine` | `bded213edcbeeee6e3bf078e478ab4fdaa553855bdafda147813cf6198d8b8ba` |
| `analysis-skill-router` | `df90b10374f26c8c267ff0bdecc5039d9cfb58e501ed000f02a70d4b3b8269fd` |
| `api-design` | `c31fca74eb9330bf63341858f51b46a23fd56e48253eda0a12165892cac576c3` |
| `api-endpoint` | `2f41577abd3fbc6b748e7bcb7991e31222276738e9bedeebddcb42daea5093be` |
| `api-testing` | `599a7998d6cc58e71cbaf6c72154a334e0831e085516ee0fb345dbefd7ce1b88` |
| `architecture-review-lens` | `0aea3490d1337d4d72688e35164191f510fbf0dbda3db2408585d18d0746aada` |
| `blade-ui` | `4231ec1aed4180304c75e1b958a24703e9d9cf27d92a31c40c1bcbec92caf83a` |
| `blameless-post-mortem` | `719dabb662d9937dabb178d097dc73e458c6b31210532b309896580aefd6c48c` |
| `blast-radius-analyzer` | `353806c436295cd6e83c4e9e7ac0e4de61501e01cec65a9b0d57e2c183f9a391` |
| `brand-asset-generation` | `ebbc94b7467f4240ec56d8b95ee2aae225540e8e51f665edfd7a9704be5dd731` |
| `brand-audit` | `77bbac810a28d2c0fba32c6ce75e38e50aff783ce8775e4bc215893e04a42a8c` |
| `brand-identity` | `50be404a9317ca4321de6966c84815d23721bfb092bf90c4f24ae781b26c1caf` |
| `brand-strategy` | `8a9a7ea586b7de9e0a3b7a8e0b3ffd776ca1260ab79d77b2804ed4c9e6911606` |
| `brand-to-tokens` | `b58dc2a919d0f8a242120e4b04853546c226c4e22645919f0bee39e799bcc094` |
| `bug-analyzer` | `c2eb95aada033854401cdb6a951fac9b7cac633b0ee4142f126eece78b1953eb` |
| `code-refactoring` | `a6147167bd6c11a4c4f2b0a4bae924f403f54d16aa0334b089b6bba744d66f77` |
| `code-review` | `68dfc344a28c8d4b7bf79ff57c57642b6904ad25cc3f1815d34a1ab73de99224` |
| `command-routing` | `8fdb24b80711a22212c9c31913630e2b06a5fade150f9de87b3ecdde6f23d0d4` |
| `competitive-moat-analysis` | `e149d75967c3d407ba74512527934b77fb3ede128c1bbcdecdd88e3c51448b67` |
| `complexity-first-planning` | `7377795a8aca39c574ed4a1bc2074f7da451bf1ce7095bdb0ccdc50e60b9757b` |
| `context-authoring` | `0c3412f197fb3b5210496e39bfe5dc286b1348651fa132c4ade4cb43617f05b7` |
| `contract-review` | `9b5e4a70563ed2e07e463d59a1f179b79f44d37f38323b23013227bbd5aec73b` |
| `corpus-grounding` | `f87d7497f5705b0ef84bd61137623984faaac39f202bf9f5fea206855fbd6c3f` |
| `customer-research` | `be1760092dfc0e70006ac1313709d8acdd48a62b1e3b81f354590df95e23fbc6` |
| `data-flow-mapper` | `535e42defa307b3a40d68cdcd6eeeef101c120d5c5c1b9740330199a5acc2203` |
| `database` | `07b320a1bcde1f8565aa1cae12d383b765fd1a9d0289703fccfa79f7486b5688` |
| `design-intelligence` | `81361d4cd038b77ae78ddc988e3fdc247b93112f217ed455ce9437ac3576ac21` |
| `design-system-capture` | `afdefd4e0141ef85eb7277def08c84abf1bf4b9f30d7cbed32a4bc39039b23f6` |
| `design-tokens` | `a39661a7b95f92c7f649d4a82b33c07be346053d4529ae7a6a9626609b30be40` |
| `design-variations` | `ab58c78688a1f4f41cbbdd9c6302c3eea975bc2c25a565b67fcfb961cea9d590` |
| `doc-coauthoring` | `025530a4b9bb40834cd9054c40e8c9518c55e55d2adcead638b1a8919d856f1b` |
| `docx-authoring` | `75b784449debd2009b332b91edd75116ceccd8ae18866405dd689c48b2e8fb67` |
| `dpa-review` | `e0ded718f20941ad84a7ce87cb69aa3e1059d68234ca312c4846f5fb601d1279` |
| `eloquent` | `d61c6ada4b28e29f5e7a97aca87917cf6942e5da7f39741d9f4ef0b7ade27185` |
| `estimate-ticket` | `4f882334316f1d694cb605854527736d237f5c21288e18e427601e184d2dfe69` |
| `evaluate-llm-feature` | `0208ae44de28e4a96ebc116d329250e4a6006b00cbb0b2d638aaf4a005423f13` |
| `existing-ui-audit` | `1cec11b0fc1696d5186a30c8a73fe3b10efa7ccb9a956d17a995e7415180a35e` |
| `experiment-loop` | `7b64978277e8b29b2e58080914329d14274375f0195b59119cad7cede6ec55c0` |
| `feature-planning` | `53747ead011ed29c480d407f66ff3803b43e585f390916ce0e5187340973142c` |
| `flux` | `6af79f646de538883690b4ae485055191d08049df947dd7da4c949b7523dedf4` |
| `forensics-report` | `ae4a0a37cd21eeb99b798839d99195e580dbd5bdb017642ace5e462db0593234` |
| `form-handler` | `5e88a2223f79b275411ba720155768414f4fe5bd99d8099a381ed9103e511805` |
| `frontend-render-security` | `a881e51be1fb62289f71f02ae53177629734e23e5fd5aa3a4a43c972fb23b7f1` |
| `gated-reach` | `8d39468e75ff725b8e4454fc3a783c2490447ac3f8658ec91e62dbc48352c8a1` |
| `git-workflow` | `508cdaa8fac1ca9fe1da6934db8a6e1496fc6c46b39dd19ef068b752966b271d` |
| `history-design` | `50825f6db0683e20a9c16c6a190b52e197caa9a8f20ea85dfa1f6294e70f5145` |
| `html-deck` | `6bad648f124ea1af4c39f9af19f3fedfb077edc595d63816a8abcf450d2be35d` |
| `humanizer` | `76c89f2ed3146d11d0f08c97d2595b60b35c1c912ad5c8c9707c0799c52dd221` |
| `iconography` | `6a94e7c7811e8e893654620ccb6ee2f04ed747671174eaf218846c7f75be3720` |
| `image-analyser` | `47735add726cdb3b86e8a08c66fca17a824acc63ac4a788fe29083b61f5a8ebb` |
| `image-creator` | `0c4b5598b10ae0f53ccbef2a6e0c863f353b849e152dcf51a197652266954292` |
| `image-editing` | `2b3fe1109fb8be12a9e42bcfb9ff587f07a37ad3fb926dc538b335f5c8fbf3b8` |
| `image-provider-routing` | `63ad30ab3ce1548a7f067a97c77019e55c9fd8c63caa711dde02acb9ae1ce102` |
| `incident-commander` | `7e9371f328c7b1751c083688f77a34af2db2b901befc78eed7c8400ae5b2019e` |
| `jira-integration` | `fe9ba2d101335b5446f7efb6fcc22e8db93edf21be00e4cd23774789a01ec28d` |
| `js-library-packaging` | `8b64d0222ee1228950056004a752b4dc168f8f571e037ec38791258ec305bacd` |
| `judge-artifact-completeness` | `4b1d517726313827781746169d30009b2b0655bbc0392740ebcd6e712c58cd50` |
| `judge-security-auditor` | `b1915f90c4e7648f8cca7de9e43c73eb08616382827d69ee359dd3fa33b5f72f` |
| `judge-synthesis` | `378e0eec013fbf2a96cda58a6ba318884fc141fc0f722fae23a488a8a7ca6155` |
| `launch-readiness` | `6de2444a376a49d7ac29affc839a1cd8ef157cee0071b17ef64277b744debc34` |
| `learning-to-rule-or-skill` | `954cea1f3b230004cff27ad4d138a442869ad6ad65281514edbb907340380240` |
| `learning-tutor` | `3facfb90fa1ee593cf779862bfc79f88f70a915dc9638dc4af6ef5bbf98d9fd7` |
| `legal-intake-triage` | `4b6afb88a3a7912ab8666d5e000172224e3e26f5940bbf09988e750a0d89b6fc` |
| `legal-practice-profile` | `be472d98368803e6b0f31652069f2ce01b802b97a3ec7976635a602667a6ba14` |
| `license-compliance-audit` | `6ea08eade2a25c2f95c44a727084adbd4f4f2b073d9eae6e95bc169ab4cfdf93` |
| `license-compliance-credits` | `d2838c7b4b722351d54ae91fd226a3314752a038769093f59b505a6e29d63bdf` |
| `livewire` | `1f092537121622bdd4b78f0be1367cfa123e166516e162f0e45ecd7893a80ad1` |
| `llm-provider-knowledge` | `9cfb3639dd7dee51520aebf2f180ce41ae752229b76716774468f6a9598461a1` |
| `logging-monitoring` | `5e8406b3c814db3d1e100a1c817a9fce388afd40f4f3caa8230cd8f69e44f0f4` |
| `markitdown` | `663ee4c4f9d5c707ff96208d1723d9817639fca7c00b346e43be2cb557610f6a` |
| `monorepo-workspace` | `766a958aae4898bd938e493be8597b6d8b9ee38914ed95ab87ed867422e38233` |
| `nda-triage` | `01e4becd20b129780d82d2889099f07a8fe4ee241b31f909d1084af427f4323d` |
| `operational-readiness` | `da1b223e882ce0a02637befb436d97df4264f96003ce1c55425c75ec62535322` |
| `pdf-tools` | `3f7814305369b9e2b5d367fa0253caf2448aa93435989e2dfa9f2149241e90bc` |
| `persona-improvement` | `510402b135807db3ead05e2e6ab3c315d86caeb55b7bf45b4919d2ba69e56804` |
| `po-discovery` | `ac9cf914b69004d4d351272fbaf790126ff6dd255263f8020213bded6226b8b5` |
| `prediction-pool-optimizer` | `5eab312a114476b7fc8dc1ef3846b40d759c0db580c75e14b7abbdc541bc2b7f` |
| `project-analysis-core` | `48fada14ae5c23d493aadc189db3256964da73ee2484e7ee6575556cc7b7435e` |
| `project-analysis-hypothesis-driven` | `57e22d3611f6d11081f5650c3081f8bf4fdd8381b962f28b4d4b87116a95efbd` |
| `project-analyzer` | `fbbec0a0941da77d517fca42a3de9056ca019d272c04b5dc9cb53e7aa502b76a` |
| `prompt-engineering-image` | `d00e1aeb325be93ad2b510e3438f54368b9130eb0688f177dd5c68e473f87237` |
| `prompt-engineering-patterns` | `4c7db08fbc25fdca01a72f2175785d5b8e0d805c1479a7b18bd972968e6d4240` |
| `prompt-validator` | `daeecf1063775e3c4671de74f3b292fe30fb6d3e4ce8e1c490c2935ef5e5af07` |
| `react-shadcn-ui` | `c09d357232b10629dd11c552cac4513a0712c72de5f584ffc017a16935b428fb` |
| `reasoning-orchestrator` | `a968ef1f04693b46eb3838b43eb83b092429149069599c3aef2c2e4628701b85` |
| `refine-ticket` | `bab09021f8664cd0676e9613bd511a3f87d115583ea5f4639fb4800df9715328` |
| `repomix-packer` | `62489a82ccd7a01c53d8a4ca265a3f9249782c12d5b74ac7ae2e3d1a12df478e` |
| `roadmap-writing` | `3559ef4117112f053288fb55da5b3ced3cebe2ab914e2e5d82e8f726f20339d2` |
| `screenshot-hygiene` | `2493ae6cee8869c659e34610c7ec6a7d7a6f5c76098136c98fa35c90484adb2c` |
| `security-audit` | `27ccbdcd02b8cf7fbd6b85da1043c680233a6ed840697eac6ef9dace37cb0993` |
| `security-maturity-assessment` | `071894293d4c9a1997843d9bfc78f69b2fc64c0e5306544756cb6853bfd31b30` |
| `server-hardening` | `8301bedcbcd9129f8c55d3640e66164baec4753e92a55a8b56df54449e3f3f46` |
| `skill-writing` | `d2beba3976f5918450cc4fa5c96f7fdae488ef5ffebe1f3b05fe3519acbb8a26` |
| `source-discovery` | `e32a41fdd41414cc4734ebf440a253f592775046f603c9daeec6a28f1b05eee3` |
| `spreadsheet-authoring` | `959466aba0e7f34aae0d8eb69ee427d94049627d905410b322045ac6be0a1599` |
| `sql-writing` | `3afe3f13210573d0e6f41be15836f3be0b3c01bc7db3a3625a35fb64e64356df` |
| `storybook-workshop` | `3aff4c3fddd06e0e265ca4afbb02cdbce16b000dd2d3fd6405504d015a1efd27` |
| `supply-chain-intake` | `e61b2fcb6409cf0817ea8527a1fda3b1cdabb35e28264146a0d449991e9fe87c` |
| `svg-authoring` | `3dd3e8463a2f8383a9e86a5ee7785661a0e9b73eda5f09d4aac0669ec66abe9f` |
| `test-case-discovery` | `563ff838264c39c9e132e1e18206c7b0d52639bd42203f790109f9ec0df2603d` |
| `test-driven-development` | `9a1ec696c72915adde002efffdc6a887c967b63f5330c616126d07617be7aa0b` |
| `typography-system` | `ab3dbde9a42077d682115a1707d6fa4686e5d3155eef0998f1e240b0b86bb73a` |
| `ui-apply-generic` | `e3f02e3ba53fb96def30fca6752f400d15b6b63209072928bff9e239aaac7ec5` |
| `ui-component-architect` | `a9b864a568aa32d2bccd96f524a69d24042f05cdd29b339d45bf9ff6b95b9da5` |
| `universal-project-analysis` | `969eb38cf45fbd0f85b81ac0656bdff36a20a5946b911ead54449da0bb05b61c` |
| `upstream-contribute` | `563a1ab0381b7a96f9a993381119403f81064426d7b3aaf17fbf81467534cdea` |
| `using-git-worktrees` | `66f8a8709d975f3c98103341469ea0af34b909ce1ca7042170690707a61878da` |
| `verify-repair-loop` | `0e66da5e7daac823b400f9493cc2865f9521a40dc7a01bf74ed81702680cb47b` |
| `wireframe` | `a8d5417a0cdc00557cbc7e55db8184943d971f60d279b4d68eb549cb2ab6a77a` |
| `workspace-link` | `b4733d41b6460c62cfb91bbbdaf6e764124d115035ee6d780f782ca4e3aae675` |

## Growth 2026-09-19 — the corpus gained one TRAIN file; the seal did not move

```
THE CORPUS GREW. THE HOLDOUT DID NOT.
ALL 18 SEALED ROWS ARE BYTE-IDENTICAL. THE RULE IS UNCHANGED.
NO HOLDOUT RESULT IS VOIDED, BECAUSE NO HOLDOUT FILE WAS TOUCHED.
```

**What changed.** `road-to-release-holds-that-refuse` step 1.4 authored
`src/skills/roadmap-writing/evals/triggers.json` — one file, nine cases — and
removed that skill's now-false entry from `trigger_eval_grandfather.json`. The
corpus is **101 files, 18 holdout and 83 train**, and `SET-SHA256` is re-pinned
to `6cac7051…` from `0667fbd9…`.

**This is recorded rather than re-pinned quietly, which is what § The partition
rule requires**: *"A change is legal; a silent change is the compromise this
step exists to prevent."* The § Set hash section already predicted this exact
case — *"A later run recomputing a different value has either grown the corpus
or edited a frozen file, and either is a finding before it is a bug."* It grew.

**What provably did NOT change, checked rather than asserted.** Re-running this
file's own reproduce recipe and diffing every row against the published tables
leaves **exactly one** row absent from the artefact — `roadmap-writing`, on the
`train` side. All 18 holdout rows and all 82 pre-existing train rows reproduce
byte-for-byte:

- the partition **rule** is untouched — ceiling 51, name-derived, no discretion;
- `sha256('roadmap-writing')[0:2]` places it in **train**, so the holdout
  membership is the same 18 skills, and the seal AC-6 rests on is intact;
- no holdout file's bytes moved, so no holdout result is voided.

**The ordering claim is unaffected and is worth restating, because a re-pin is
exactly where it would be quietly lost.** AC-6's claim is that the holdout's
content hash predates the first proposer commit. That claim is about the 18
holdout rows and the git history that carries them, and neither moved here. A
growth on the train side cannot retro-fit a holdout that was fixed before it.

**The residual, stated because it is real.** `SET-SHA256` is computed over the
undivided list, so it changes whenever the corpus grows on either side — it
cannot distinguish "grew on train" from "edited a frozen file" on its own. What
distinguishes them is the per-row diff above, which is why this section carries
it rather than only the new number. A future growth owes the same check.

## Growth 2026-09-30 — the corpus gained one TRAIN file; the seal did not move

```
THE CORPUS GREW. THE HOLDOUT DID NOT.
ALL 18 SEALED ROWS ARE BYTE-IDENTICAL. THE RULE IS UNCHANGED.
NO HOLDOUT RESULT IS VOIDED, BECAUSE NO HOLDOUT FILE WAS TOUCHED.
```

**What changed.** `road-to-a-component-taxonomy-we-follow-but-never-force`
authored `src/skills/ui-component-architect/evals/triggers.json` — one file, ten
cases. It was not a coverage push: that branch edits the skill's placement
section, and `check_routing_coverage` requires a corpus for every skill a diff
touches, so the file is that gate's remedy. The corpus is **102 files, 18
holdout and 84 train**, and `SET-SHA256` is re-pinned to `034f791e…` from
`6cac7051…`.

**Recorded rather than re-pinned quietly**, per § The partition rule: *"A change
is legal; a silent change is the compromise this step exists to prevent."*

**What provably did NOT change, checked rather than asserted.** Re-running this
file's own reproduce recipe and diffing every row against the published tables
leaves **exactly one** row absent from the artefact — `ui-component-architect`,
on the `train` side. All 18 holdout rows and all 83 pre-existing train rows
reproduce byte-for-byte:

- the partition **rule** is untouched — ceiling 51, name-derived, no discretion;
- `sha256('ui-component-architect')[0:2]` is `0xde` = **222**, far above the
  ceiling, so it lands in **train** and the holdout membership is the same 18
  skills;
- no holdout file's bytes moved, so no holdout result is voided.

**The ordering claim is unaffected.** AC-6's claim is about the 18 holdout rows
and the git history that carries them. Neither moved; a growth on the train side
cannot retro-fit a holdout fixed before it.

**The residual the 2026-09-19 section named is unchanged and was paid again.**
`SET-SHA256` is computed over the undivided list, so it moves whenever the
corpus grows on either side and cannot on its own distinguish "grew on train"
from "edited a frozen file". The per-row diff above is what distinguishes them,
which is why this section carries it rather than only the new number. That
section said a future growth owes the same check; this is that check.

## Growth 2026-10-01 — the corpus gained one HOLDOUT file, and the seal's claim is now scoped

```
THE HOLDOUT GREW FOR THE FIRST TIME: 18 -> 19.
ALL 18 ORIGINALLY SEALED ROWS ARE BYTE-IDENTICAL. THE RULE IS UNCHANGED.
NO PRE-EXISTING HOLDOUT RESULT IS VOIDED, BECAUSE NO PRE-EXISTING HOLDOUT FILE WAS TOUCHED.
THE 19TH ROW CARRIES NO PRE-DATING CLAIM. IT WAS SEALED TODAY, NOT BEFORE PHASE 5.
```

**What changed.** `road-to-corpus-refresh-cadence-shape` step 1.2a re-checked
the `accessibility-auditor` grounding corpus against WCAG 2.2 and the APG. That
edited `src/skills/accessibility-auditor/data/`, which put the skill into
`check_routing_coverage`'s touched-skill scope, so
`src/skills/accessibility-auditor/evals/triggers.json` was authored as that
gate's remedy — ten cases, not a coverage push. The corpus is **103 files, 19
holdout and 84 train**, and `SET-SHA256` is re-pinned to `bb2df6f4…` from
`034f791e…`.

**`bb2df6f4…` is superseded and the reason is a merge, not an error** (recorded
2026-10-01, at the merge). This section measured a tree in which the
`accessibility-auditor` holdout growth was the only growth of the day. It was
not: `road-to-behavior-vocabulary-and-runner-truth` rewrote
`src/skills/test-case-discovery/evals/triggers.json` on the **train** side in
parallel — § Re-pin 2026-10-01 above — and the two landed in one merge. The set
hash is computed over the undivided list, so it cannot be the value either
branch measured alone. It is whatever § The set hash publishes — not repeated
here, because a value copied into prose is a value that goes stale on the next
re-pin, which is what happened to this very sentence — and
`trigger_corpus_holdout_pin.test.ts` recomputes it over the merged tree. The row
counts in this section are unaffected (the train growth edited a file already in
the set, it did not add one), and so is every per-row pin, including
`accessibility-auditor`'s `b5fcf7cb…`. This is the fourth time a figure in this
file has been overtaken between measurement and publication, and the first time
the cause was a concurrent branch rather than a later edit on the same one — the
standing repair below is the same either way, and the shape it guards is now
one branch wider than it was.

**Recorded rather than re-pinned quietly**, per § The partition rule: *"A change
is legal; a silent change is the compromise this step exists to prevent."*

**Why this growth is not like the previous two.** 2026-09-19 and 2026-09-30 both
landed on the `train` side, so each could say the holdout membership was
unchanged. This one cannot: `sha256('accessibility-auditor')[0:2]` is `0x2f` =
**47**, below the ceiling of 51, so the file lands in **holdout**. The partition
rule chose it — nobody did — which is exactly the property the name-hash rule
exists to provide, and it is worth noting that the rule placed a file in the
sealed set at the moment it would have been most convenient to place it in train.

**This section shipped a STALE PIN first, for the third time in this file's
life, and the correction is recorded here rather than silently applied.** The
first published values — row `174b5e85…`, `SET-SHA256 7445c18a…` — were computed
from a snapshot of `accessibility-auditor/evals/triggers.json` taken before two
later edits to that same file's `description` field in the same branch. The
provenance was proved rather than guessed by the round-4 reviewer: dropping the
new row from the computed list reproduces the OLD pin `034f791e…` exactly, and
substituting the stale row hash reproduces the first-published `7445c18a…`
exactly. The live row value below is `b5fcf7cb…`; the live SET hash is
whatever § The set hash publishes, deliberately not repeated here, and
`tests/scripts/trigger_corpus_holdout_pin.test.ts` passes 5 of 5 against them.

**This is the same defect as § Correction 2026-08-31**, where the commit that
recorded the freeze also edited three of the files it was freezing. The shape
recurs because the pin is computed by hand at one moment and the file keeps
moving afterwards. **The standing repair, for whoever writes the next growth
section:** `trigger_corpus_holdout_pin.test.ts` recomputes the whole recipe from
the tree and asserts every row and the set hash. Run it as the LAST act before
publishing a growth section, after the final edit to any corpus file in the
change — not when the numbers are first computed. It caught this; it would have
caught 2026-08-31; it is cheap and it is the only thing in this tree that can
tell a stale pin from a compromised seal.

**What provably did NOT change, checked rather than asserted — re-run against
the committed bytes after the re-pin.** Re-running this file's own reproduce
recipe and diffing every row against the published tables leaves **no**
mismatched and **no** absent row. All 18 originally sealed holdout rows and all
84 train rows reproduce byte-for-byte, and so does the 19th:

- the partition **rule** is untouched — ceiling 51, name-derived, no discretion;
- no pre-existing holdout file's bytes moved, so no holdout result taken against
  the original 18 is voided;
- the realised split is now 19/103 = 18.4 % against the rule's 19.9 % target.

**The ordering claim is SCOPED, not preserved — and this is the honest half.**
AC-6 claims the holdout partition's content hash predates the first commit of
any proposer capability. That claim holds, unchanged, for **the 18 rows sealed
on 2026-08-30**: their bytes and their git history are untouched. It does **not**
extend to the 19th row, which was authored on 2026-10-01 and therefore predates
nothing. A future proposer evaluated against this holdout must either exclude
`accessibility-auditor` or state that it is using a row whose seal is younger
than the evaluation. Saying so is cheaper than letting a reader infer that a
19-row holdout carries a claim only 18 rows can support.

**The residual the 2026-09-19 and 2026-09-30 sections named is unchanged and was
paid again.** `SET-SHA256` is computed over the undivided list, so it moves
whenever the corpus grows on either side and cannot on its own distinguish
"grew" from "edited a frozen file". The per-row diff above is what distinguishes
them, which is why this section carries it rather than only the new number.

## Growth 2026-10-01b — four corpora, three of them HOLDOUT-side

```
THE CORPUS GREW BY FOUR. THREE OF THEM LANDED IN THE HOLDOUT.
THE SEAL'S ORDERING CLAIM COVERS THE 18 ORIGINALLY SEALED ROWS AND NO OTHERS.
THE THREE ADDED HERE ARE SEALED FROM NOW ON, NOT RETROACTIVELY.
```

**What changed.** `road-to-a-trunk-whose-own-gates-are-green` de-linked
cross-pack references in four skills that shipped no routing corpus, and
`check_routing_coverage` requires a corpus for every skill a diff touches — so
the four files are the gate's own remedy rather than a coverage push, the same
shape as the 2026-09-30 and 2026-10-01 entries above. Their four grandfather
entries came off `trigger_eval_grandfather.json` in the same change.

| Row | Partition | `sha256(name)[0:2]` | Now |
|---|---|---|---|
| `review-routing` | holdout | `0x29` = 41 | `9fd8b380…` |
| `skill-improvement-pipeline` | holdout | `0x29` = 41 | `67e8594b…` |
| `tailwind-engineer` | holdout | `0x2e` = 46 | `7b925bfd…` |
| `design-system-capture` | train | `0x90` = 144 | `afdefd4e…` |

Three fall below the ceiling of 51 and one does not; nothing was chosen, which
is what a name-derived partition buys.

**What the ordering claim does and does not cover.** The 2026-10-01 entry above
already scoped it to the 18 originally sealed rows when `accessibility-auditor`
became the 19th. These three make 22. The claim — that the sealed bytes predate
the first proposer commit — is a statement about those 18 and is not extended
here: a row authored today obviously does not predate a commit from 2026-08-31.
What the seal means for them going forward is unchanged and immediate: no
proposer, curator or analyzer may read them.

**Both train-side measurements ARE re-taken here**, unlike the 2026-10-01 entry
above, and the difference is the partition rather than the date.
`design-system-capture` is train-side, so the train input moved and the
obligation the 2026-09-19 entry sets applies in full:
`routing-body-signal-verdict.json` and
`delivery-set-measurement-2026-08-31.json` are both re-run in this change.
`routing-coverage-seed.json` rises 0.3445 → 0.3579 with them.

The stale-by-two-corpora condition the 2026-10-01 entry records for
`delivery-set-result-2026-08-31.md` is NOT repaired here and is not inherited
silently either: that is a prose record, this change re-ran the JSON the test
reads, and conflating the two is the error that entry was written to stop. (The
prose record had no re-take section; since 2026-10-07 it carries a note that
names the JSON as the current reading, release finding `237f203916c5`.)

## What this freeze does NOT establish

- **It does not seal anything mechanically.** No code reads this file today.
  Nothing prevents a future proposer from opening a holdout corpus; what exists
  is a recomputable partition and a hash that makes a violation *detectable
  afterwards*. The enforcing check belongs with the proposer, in Phase 5, and
  saying so is cheaper than implying a gate that is not here.
- **It does not make the corpus adequate.** 100 of 287 routable skills
  carry a corpus at all; the holdout is 18 % of a third of the population. A
  paired verdict over it will be underpowered for most questions, and
  `paired_verdict` refuses to call `underpowered` a pass.
- **It freezes the files that exist, not the ones that will.** A corpus authored
  in wave 2 is outside this frozen set. Whether it joins the holdout, joins the
  train set, or forms a second frozen generation is a Phase 5 decision; the
  honest default is that this generation's hash stops describing the corpus the
  moment a file is added, which the set hash makes visible rather than silent.

## Re-pin 2026-10-11 — two TRAIN corpora re-hashed; the corpus did not grow

```
NEITHER ROW IS NEW. BOTH ARE TRAIN-SIDE RE-HASHES.
NO HOLDOUT FILE'S BYTES CHANGED, AND THE HOLDOUT ROW COUNT IS UNMOVED AT 27.
THE SEAL'S ORDERING CLAIM IS UNTOUCHED, AND IT STILL COVERS ONLY THE
18 ROWS SEALED ON 2026-08-30 — THIS SECTION ADDS NOTHING TO IT.
```

**What changed.** Both rows were already in the tables; both carried bytes that
no longer existed. `road-to-svg-with-a-witness` added the `svg-authoring` skill
with a routing corpus earlier in the same branch, and the vector split moved two
rows of `image-provider-routing`'s — neither re-pinned at the time.
`lint_skill_trigger_corpus` then required a declared case class per query, a
counterexample and a German positive on both files, which re-wrote their bytes a
second time. The discipline is the gate's own remedy, the same shape as the
2026-09-30, 2026-10-01 and 2026-10-01b entries; the difference here is that this
is a correction of two stale rows rather than growth, so no count moves.

| Row | Partition | `sha256(name)[0:2]` | Now |
|---|---|---|---|
| `svg-authoring` | train | `77` = 119 ≥ 51 | re-hashed |
| `image-provider-routing` | train | `3a` = 58 ≥ 51 | re-hashed |

**What provably did NOT change, checked rather than asserted.** Recomputing this
file's own recipe over the tree and diffing every row against the published
tables leaves **zero** mismatched holdout rows — the check printed the holdout
subset of the stale list and it was empty, which is the direction that matters:
a train-side growth cannot be confused with an edit to a frozen file unless
somebody looks.

- the partition **rule** is untouched — ceiling 51, name-derived, no discretion;
- no holdout file's bytes moved, so no holdout result is voided;
- the corpus is **125 files, 27 holdout and 98 train**, unchanged by this
  section — a realised split of 21.6 % against the rule's 19.9 % target.

**The standing repair was followed, and a SECOND gate was needed.**
`trigger_corpus_holdout_pin.test.ts` was run as the LAST act after the final edit
to both corpus files, and it is what caught the two stale rows. It did NOT catch
the first attempt at this re-pin, which inserted the `svg-authoring` row into the
sealed table instead of the train one: that test asks only whether
``| `skill` | `hash` |`` appears somewhere in the document, so a row in the wrong
table satisfies it. `routing_signal_measurement.test.ts` § 5.1 is what refused —
it reads the partition the loader derives and compares it against the published
holdout rows, so it saw the holdout count go 27 → 28 and named the row. Whoever
writes the next section should run BOTH: one checks that the hashes are current,
the other that they are on the correct side of the seal, and neither substitutes
for the other.

**The residual every section since 2026-09-19 has named is unchanged and was
paid again.** `SET-SHA256` is computed over the undivided list, so it moves
whenever the corpus grows on either side and cannot on its own distinguish
"grew" from "edited a frozen file". The per-row holdout diff above is what
distinguishes them, which is why this section carries it rather than only the
new number.

