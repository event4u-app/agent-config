<!-- evidence-type: analysis -->

# ADR-225's skill-size park: which half of the condition fired, and which did not

Measured on `drain/the-skill-size-park-fired`, based on `origin/main` @
`9b75231ed`, 2026-09-06. Phase 1 of
`agents/roadmaps/road-to-the-skill-size-park-fired.md`.

ADR-225 parks a skill-size ceiling behind a two-term disjunction, quoted from
`docs/decisions/ADR-225-cross-corpus-proposal-verification.md:97-99`:

> **Reopen when** p95 crosses 3,000 words, or when more than ten skills exceed
> 2,500.

This file records which term fired, which did not, and the command behind every
number, so a later reader can re-derive all of it rather than trust the summary.
It answers no part of the park — the routing is the council's.

## Verdict in one line

**The count term fired; the p95 term did not.** Twelve skills exceed 2,500
words (the threshold is "more than ten"), and p95 is 2,380 — 620 words below
the 3,000 threshold. The disjunction is satisfied, so the record is reopenable,
and the p95 half is the one a reader is most likely to assume also fired.

## The population and the command

```bash
wc -w src/skills/*/SKILL.md | grep -v ' total$'
```

The population is every `src/skills/*/SKILL.md`, one file per skill, counted by
`wc -w`. `n = 299`:

```bash
ls -d src/skills/*/SKILL.md | wc -l          # 299
```

`references/` sidecars and `src/domains/*/` pack skills are **not** in the
population, matching how ADR-225's own census was taken — see the reproduction
below, which recovers that ADR's published numbers exactly from this same glob.

## Term 1 — more than ten skills above 2,500: **FIRED** (12)

```bash
wc -w src/skills/*/SKILL.md | grep -v ' total$' | sort -rn | awk '$1 > 2500'
```

| Skill | Words |
|---|---|
| `ai-council` | 3,031 |
| `memory-consolidation` | 3,012 |
| `git-workflow` | 2,884 |
| `conventional-commits-writing` | 2,771 |
| `decision-review` | 2,763 |
| `testing-anti-patterns` | 2,747 |
| `existing-ui-audit` | 2,707 |
| `roadmap-writing` | 2,698 |
| `react-shadcn-ui` | 2,669 |
| `systematic-debugging` | 2,668 |
| `adr-create` | 2,515 |
| `subagent-orchestration` | 2,503 |

Twelve is more than ten. ADR-225 measured **six** at its own pinned commit, so
the count doubled.

## Term 2 — p95 above 3,000: **DID NOT FIRE**

```bash
wc -w src/skills/*/SKILL.md | grep -v ' total$' | awk '{print $1}' | sort -n \
  | awk '{v[NR]=$1} END {print v[int(0.95*NR+0.999999)]}'      # 2380
```

**2,380 at n=299** — 620 below the threshold, and it did not fire under any
convention tried.

### Which percentile convention, and how that was established

The convention matters here because two plausible ones disagree by 13 words,
and ADR-225 records a p95 without naming its method. It was recovered rather
than guessed: reproducing the ADR's census at its own pinned commit
`26c575f66` and testing three conventions against its four published
percentile figures, only **nearest-rank** (`v[ceil(q·n)]`, 1-indexed ascending)
matches all four.

```bash
for f in $(git ls-tree -r --name-only 26c575f66 -- src/skills | grep 'SKILL.md$'); do
  git show "26c575f66:${f}" | wc -w
done | sort -n
```

| Figure | ADR-225 (`:94`) | nearest-rank | `v[int(q·(n−1))]` |
|---|---|---|---|
| n | 289 | 289 | 289 |
| mean | 1,187 | 1,187 | 1,187 |
| median | 1,077 | 1,077 | 1,077 |
| p90 | 1,867 | **1,867** | 1,821 |
| p95 | 2,294 | **2,294** | 2,249 |
| p99 | 3,851 | **3,851** | 3,012 |
| max | 7,094 | 7,094 | 7,094 |

Nearest-rank reproduces the ADR's own numbers exactly, so it is the convention
the park's threshold is written in, and 2,380 is the figure the condition is
evaluated against.

**The roadmap's stated 2,367 is the other convention** — `v[int(0.95·(n−1))+1]`
— and it reproduces at n=299:

```bash
wc -w src/skills/*/SKILL.md | grep -v ' total$' | awk '{print $1}' | sort -n \
  | awk '{v[NR]=$1} END {print v[int(0.95*(NR-1))+1]}'          # 2367
```

Linear interpolation gives 2,368.3. All three are between 2,367 and 2,380 and
all three are far below 3,000, so the verdict on this term is
convention-independent. The discrepancy is recorded rather than smoothed over
because a later reader re-deriving 2,380 against a roadmap that says 2,367
would otherwise have to assume the tree moved.

## The distribution then and now

Same population, same `wc -w`, nearest-rank percentiles.

| | ADR-225 @ `26c575f66` | HEAD @ `9b75231ed` | Δ |
|---|---|---|---|
| n | 289 | 299 | +10 |
| mean | 1,187 | 1,236 | +49 |
| median | 1,077 | 1,133 | +56 |
| p90 | 1,867 | 2,028 | +161 |
| p95 | 2,294 | 2,380 | +86 |
| p99 | 3,851 | 2,884 | **−967** |
| max | 7,094 | 3,031 | **−4,063** |
| above 2,500 | 6 | 12 | +6 |
| above 3,000 | 4 | 2 | −2 |

**The tail got shorter while the count above 2,500 doubled.** The two skills
ADR-225 measured at 7,094 and 4,666 words — `ai-council` and `skill-writing` —
are now 3,031 and below 2,500; `roadmap-management` fell from 3,851. The
condition fired by the body of the distribution shifting up against a fixed
threshold, not by the heavy tail growing. That is the fact most likely to be
misread from "the park fired", and it is the input the routing needs.

## What moved inside the 14.16 → 14.18 window

Window endpoints are the release commits, there being no tags:

```bash
git log --oneline -S'"version": "14.16.0"' -- package.json   # a4fe5aee1
git log --oneline -S'"version": "14.18.0"' -- package.json   # 3cef53944
```

Three of the twelve moved in that window; the other nine are byte-identical at
both ends.

```bash
git show "a4fe5aee1:src/skills/<skill>/SKILL.md" | wc -w
git show "3cef53944:src/skills/<skill>/SKILL.md" | wc -w
```

| Skill | 14.16 | 14.18 | Δ | Crossed 2,500 in-window? |
|---|---|---|---|---|
| `conventional-commits-writing` | 779 | 2,771 | +1,992 | yes |
| `testing-anti-patterns` | 2,314 | 2,747 | +433 | yes |
| `git-workflow` | 2,558 | 2,884 | +326 | no — already above |

Two crossers and one riser, which is what the roadmap's Phase 1.2 predicted.
Without them the count would be **ten**, which is not "more than ten": these
three commits are the difference between a fired condition and an unfired one.

### Per-commit attribution and classification

```bash
git log --oneline a4fe5aee1..3cef53944 -- "src/skills/<skill>/SKILL.md"
git show "<commit>^:src/skills/<skill>/SKILL.md" | wc -w
```

| Commit | Date | Skill | Words | Classification |
|---|---|---|---|---|
| `7651c884d` | 2026-09-04 | `conventional-commits-writing` | 779 → 2,065 (+1,286) | deliberate content |
| `152af29b7` | 2026-09-04 | `conventional-commits-writing` | 2,065 → 2,078 (+13) | deliberate content |
| `ef33f9212` | 2026-09-04 | `conventional-commits-writing` | 2,078 → 2,771 (+693) | deliberate content |
| `e7958998d` | 2026-09-04 | `testing-anti-patterns` | 2,314 → 2,747 (+433) | deliberate content |
| `72acd36a8` | 2026-09-05 | `testing-anti-patterns` | 2,747 → 2,747 (±0) | neither — dialect edit, word-neutral |
| `e3f681df0` | 2026-09-04 | `git-workflow` | 2,558 → 2,875 (+317) | deliberate content |
| `4658fdfe5` | 2026-09-04 | `git-workflow` | 2,875 → 2,884 (+9) | deliberate content |

**Falsifier for every "deliberate content" row.** The classification is not an
opinion about intent — it is the claim that each commit's additions are a named
new section or a review-driven repair, checkable from the diff:

- `7651c884d` *"feat(rules): measured house commit convention outranks the
  shipped default"* adds a nine-heading procedure —
  `## Procedure: Establish the house convention (run FIRST, before any message)`
  with steps 1–7, plus `## What a measurement may never lower`. A new
  capability, in one commit, with its own headings.
- `ef33f9212` *"fix: repair the defects a neutral review found in both
  procedures"* replaces a non-functional filter-repo callback with a verified
  worked example, repairs a verification that could not distinguish a rewrite
  from a no-op, fixes a `--reset-author=false` parse error, and anchors an
  unanchored `--author` regex. Four named defects a neutral review found; the
  commit body states each with its reproduction.
- `e7958998d` adds `### The named smells — canonical vocabulary, and what it
  does NOT cover`, a single new section.
- `e3f681df0` adds `## A push closes its own loop`, a single new section.
- `152af29b7` and `4658fdfe5` are +13 and +9 words — below any plausible drift
  signal, and both are follow-up repairs on the same day as the section they
  amend.

**Drift, had it been present, would look like the opposite**: additions with no
new heading, restated rationale inside existing sections, or migration
leftovers. `git show <commit> -- 'src/skills/*/SKILL.md' | grep -E '^\+#{2,4} '`
returns a heading for each of the four large additions, which is the check that
would have failed had any of them been drift. None of the seven commits is
drift, and the tail-shortening in the table above is the corroborating
signal: an estate accumulating drift does not lose 4,063 words off its maximum
in the same period.

## What this file does not do

It does not propose a threshold, a sweep, a mechanism, or a re-park, and it
takes no position on which the council should choose. Per
`decision-revisit-gate`, a fired condition is surfaced and routed; the routing
is Phase 2's, and the input it carries is this file.
