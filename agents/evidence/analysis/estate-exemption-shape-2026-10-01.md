# Estate offset exemptions — what the population actually says

<!-- evidence-type: analysis -->

> **Produced by:** `./scripts-run src/scripts/estate_exemption_shape` over the
> active, `later/` and `archive/` roadmap trees at
> `drain/roadmap-claims-shape-20261001` on 2026-10-01. Step 1.1 of
> `road-to-roadmap-claims-with-a-shape`. Every number below is that command's
> output; rerun it to reproduce them.

## Why this was measured before the check was written

`exemptionReason` (`src/scripts/check_estate_count.ts`) accepted any non-empty
string, so `estate_offset_exempt` was free text and nobody knew what it held.
Step 1.2 proposes to refuse a reason that names no **rejected alternative** —
the disposition the author considered instead of adding a file. A refusal
vocabulary chosen without reading the population is a guess, and a guess that
reds the house style is withdrawn within a week. So the population was read
first, and the vocabulary the gate now refuses on is the one it uses.

## The population

| Tree | Files carrying `estate_offset_exempt` |
|---|---|
| `agents/roadmaps/` (active) | 26 |
| `agents/roadmaps/later/` | 26 |
| `agents/roadmaps/archive/` | 169 |
| **total** | **221** |

`stubs/` and `skipped/` carry none, so they are outside the scan.

## Finding 1 — 38 of 221 reasons were unreadable to the gate

`parse_frontmatter` (`src/agent-src/scripts/update_roadmap_progress.ts:269`) is
a flat line parser: it splits each frontmatter line on its first colon and takes
the remainder as the value. It has no YAML block-scalar support. **38 of the 221
exemptions are written as `estate_offset_exempt: >-` with the reason indented
beneath**, and for every one of them `exemptionReason` returned the literal
two-character string `>-`.

That string is non-empty, so the gate accepted it. A key whose stated purpose is
that the claim "shows up in the diff of the change that makes it, and a reviewer
sees it without being told to look" was, for one file in six, being checked
against a YAML punctuation mark. This is a read defect, not a shape defect, and
it had to be fixed before any shape rule could mean anything: a shape check
reading `>-` would have refused every block-scalar exemption in the house style.
Fixed in this change by a block-scalar reader local to `exemptionReason`; the
shared parser is untouched, because its other callers read single-token values
where block support buys nothing and a rewrite risks the dashboard.

## Finding 2 — how many name a rejected alternative

Counted over the 221 reasons, block-scalar bodies included, by widening
vocabularies:

| Vocabulary | Covers | Misses |
|---|---|---|
| `archive` · `park` · `merge` (the three the roadmap named) | 178 / 221 | 43 |
| …plus a literal `later/` path | 183 / 221 | 38 |
| …plus `offset` · `defer` | 207 / 221 | 14 |
| …plus `fold` · `consolidate` · `absorb` · `retire` | **215 / 221** | **6** |

Per-lemma hits over the same population: `archive` 161, `offset` 135, `park` 83,
`later/` 48, `fold` 28, `merge` 27, `retire` 30, `defer` 25, `absorb` 8,
`consolidate` 5.

The three-word vocabulary the roadmap named misses 43 files — one in five — and
the misses are not boilerplate. "Offsetting it individually is not possible
without splitting the set" and "no completed roadmap to retire against this
addition" both name a rejected alternative in words the three-word set does not
carry. **So the implemented vocabulary is the widest row above**, the measured
house vocabulary rather than an invented one. `close` is deliberately excluded
despite being the most common verb in these reasons (52 hits): it almost always
refers to closing *work*, not to disposing of a file, so accepting it would make
the check pass on a sentence that named nothing.

## Finding 3 — the six the widest vocabulary still misses

Reported rather than accommodated, because each one is the shape the check
exists to notice:

| File | Reason, abridged |
|---|---|
| `road-to-a-menu-whose-precision-is-measured.md` | `lane 5 of road-to-leading-every-row` |
| `archive/road-to-hooks-on-every-host.md` | `lane 7 of road-to-leading-every-row` |
| `road-to-neighbours-that-pull-their-weight.md` | `lane of road-to-leading-every-row; the set's growth is declared there` |
| `road-to-leading-every-row.md` | names itself the receiver two other roadmaps cite |
| `later/road-to-web-launch-readiness-benchmark.md` | `Split-out, not authored` |
| `archive/road-to-chained-clip-continuity-and-provider-truth.md` | `Ships status: draft, so the estate charge waits for the owner's flip` |

Three of the six are the one-clause `lane N of <parent>` form. It names a parent
and no alternative at all — Risk 1 of the commissioning roadmap ("a required
phrase becomes a template line pasted into every reason") observed in the tree
*before* the requirement that would produce it exists. All six predate this
change and are grandfathered: the check reads added files only.

## Finding 4 — verbatim repetition

Five groups of identical reasons cover 15 files:

| Size | Group |
|---|---|
| 6 | six archived roadmaps added by one 2026-09-b inbox round |
| 3 | three archived roadmaps, `A genuine addition, so this key is the right instrument here…` |
| 2 | `later/road-to-elicitation-front-door`, `later/road-to-evidence-calibrated-model-orchestration` |
| 2 | `later/road-to-experience-lifecycle-operational-proof`, `later/road-to-experience-loop-owner-decisions` |
| 2 | `archive/road-to-skill-ecosystem-eval-integrity`, `archive/road-to-skill-ecosystem-runtime-enforcement` |

Every group is one round writing one reason into every file it added, which is
exactly what the in-diff duplicate rule refuses going forward.

An earlier reading of the same population — taken through the unfixed flat
parser — reported **six** groups covering **51** files, because all 38
block-scalar exemptions collapsed into one group whose shared "reason" was the
string `>-`. That artefact is worth recording: a duplicate rule built on the
unfixed reader would have refused the entire house style as self-plagiarism.

## What this grounds

1. `exemptionReason` reads block scalars before it judges them.
2. The shape vocabulary is the measured ten lemmas, not the three the roadmap
   named from memory.
3. The in-diff duplicate rule has five historical precedents, so it closes an
   observed practice rather than a hypothetical one.
4. Nothing here argues for re-reading existing files. 43 of 221 would fail the
   three-word rule and 6 fail the widest one; grandfathering is what keeps this
   a control rather than a backlog.
