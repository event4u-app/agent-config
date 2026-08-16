# Does the archive index pay? — the before/after file-open reading

> **Produced by:** step 1.3 of the archive-index roadmap, in an isolated
> worktree against `main` @ `ffec3acb7`, 2026-08-16.
> **Pre-registered bar:** at least **80 % fewer archive files opened** to answer
> a dedup question. Below the bar the index is reverted and this reading is
> published as a null.
> **Verdict: the bar is cleared in aggregate — 82 % (140 → 24 files opened).**
> **6 of 14 individual questions fall below it.** The index pays on a large
> candidate set and is a wash below roughly five candidates. Both halves are
> load-bearing; the second is the one a reader should carry away.

## What was measured

The dedup question a screen actually asks is *"has this already been tried,
closed, or refuted?"*. Answering it means, for each archived roadmap that might
be about the topic: know its title, and know how it closed.

- **Without the index**, neither is visible from outside the file. Slugs are
  suggestive, dispositions are not written anywhere but the body. So the cost
  is **one open per slug-matching archived roadmap**.
- **With the index**, one read of `INDEX.md` yields slug, title, disposition,
  phase count and step tally for every match. A file is still opened for any
  row the index marks `not-extractable` — a roadmap with no checkbox anywhere,
  where the index genuinely cannot say how it closed.

The baseline is deliberately the *cheapest* honest procedure available today,
not the soundest. A slug filter misses every archived roadmap whose name does
not carry the term, and the index does not (it carries titles too). Counting
the sound baseline — open enough files to be sure — would inflate the saving,
so it is not counted.

## The question set, and why it is not hand-picked

Term choice is exactly the selection this reading cannot afford, so the set is
derived by a rule instead of by judgement: **every token appearing in at least
two active roadmap slugs**, minus structural stopwords.

```bash
ls agents/roadmaps/*.md | sed 's/\.md$//' | tr '-' '\n' | grep -v '^$' |
  grep -Ev '^(road|to|inbox|harvest|2026|08|a|b|c|d|the|of|for|and|followup)$' |
  sort | uniq -c | sort -rn | awk '$1>=2 {print $2}'
```

That yields 14 terms, all of which are kept — including the weak ones (`run`,
`first`, `ci`), because dropping a term after seeing its number is the same
selection under a different name.

**An earlier, hand-picked 8-term probe read 70 %** and is published here rather
than discarded: `index 1→1 · prompt 2→1 · evidence 9→2 · reach 3→1 ·
description 1→1 · orchestration 7→1` (plus two terms with no candidate at all),
pooling to 23 → 7. It was replaced because the terms were chosen by hand, and a
70 % reading dropped in favour of an 82 % one would be indistinguishable from
denominator shopping if only the survivor were shown. The two differ for a
substantive reason, not a favourable one: the hand-picked set is dominated by
one- and two-candidate questions, which is precisely the regime where the index
does not pay.

## The reading

| Question | Files opened without | `not-extractable` | Files opened with | Saving |
|---|---:|---:|---:|---:|
| `ci` | 36 | 1 | 2 | 94 % |
| `skill` | 24 | 4 | 5 | 79 % |
| `ecosystem` | 17 | 0 | 1 | 94 % |
| `gate` | 13 | 0 | 1 | 92 % |
| `run` | 9 | 2 | 3 | 66 % |
| `rule` | 7 | 2 | 3 | 57 % |
| `orchestration` | 7 | 0 | 1 | 85 % |
| `integrity` | 6 | 0 | 1 | 83 % |
| `subagent` | 5 | 0 | 1 | 80 % |
| `economy` | 5 | 0 | 1 | 80 % |
| `lifecycle` | 4 | 1 | 2 | 50 % |
| `measurement` | 3 | 0 | 1 | 66 % |
| `first` | 3 | 0 | 1 | 66 % |
| `frontend` | 1 | 0 | 1 | 0 % |
| **Total** | **140** | **10** | **24** | **82 %** |

Read once per sweep rather than once per question — which is what a screen
actually does, since the index stays in context across the questions it asks —
the same 14 questions cost 11 opens instead of 24, i.e. **92 %**. The 82 %
figure is the conservative one and is the one the verdict rests on.

## What the number does not say

- **Six of fourteen questions fall below the bar** (`run`, `rule`,
  `measurement`, `lifecycle`, `first`, `frontend`). The break-even is around
  five candidates: below it, opening the index costs about what opening the
  files costs. A screen with one narrow question should not expect a saving.
- **"Refuted?" is largely not answered.** Only 3 archived roadmaps carry a
  frontmatter `verdict:`, so the index answers *tried?* and *closed?* and sends
  the reader to the file for *why*. This is a property of the archive, not a
  gap in the extractor — inventing the missing verdicts is the non-goal the
  roadmap opens with.
- **`disposition` describes shape, not intent.** It is derived from the
  checkbox tally, acceptance-criteria boxes included. `completed` means every
  box is ticked, never that the work succeeded.
- **Bytes are not files.** `INDEX.md` is ~95 KB; nobody reads it whole. The
  measured unit is files opened, per the pre-registered bar, and a grep over
  one file returns matching rows only. A reader who loads the whole index into
  context has spent more than the files would have cost.

## Reproducing it

```bash
./scripts-run src/scripts/build_archive_index          # regenerate
./scripts-run src/scripts/build_archive_index --check   # drift gate

# per-term: candidates without the index vs rows the index cannot resolve
T=gate
ls agents/roadmaps/archive/*.md | xargs -n1 basename | grep -Fi -- "$T" | grep -vc '^INDEX.md$'
grep -Fi -- "$T" agents/roadmaps/archive/INDEX.md | grep '^| \[' | grep -c 'not-extractable |'
```
