# PREREG — content profile: which file-content results a handle may shorten

> Pre-registration for the redesign of
> [`road-to-tool-results-that-leave-a-handle`](../../agents/roadmaps/road-to-tool-results-that-leave-a-handle.md)
> (owner decision 2026-10-15, row D10 there). Committed **before** any reading of
> the fresh window it names and before any code that classifies a result into
> the content profile. A later change to anything below is a new registration,
> not an edit of this one.

## How pre-registered this registration actually is — the honest limit

One reading was seen before this file was written, and it is an **anchor, not a
result**: the D6 selection over `agents/evidence/analysis/model-visible-bytes-2026-10-14.md`
and its supplementary census (text Read p95 42,029 B; Bash p95 6,282 B; 2,599
Bash results above 8,192 B carrying 36.7 % of Bash bytes, the large ones being
`sed`, `cat` and `git diff`; 13 of those 2,599 carrying a failure line).

Three consequences, stated so a reader can discount them:

1. **The class definitions below were informed by that reading.** A content
   profile is proposed *because* the large results were file-content reads. What
   is pre-registered is that the definitions are fixed by tool semantics (what
   the body is a function of), never by size, and cannot be re-cut after the
   fresh window is read.
2. **Text Read is expected to pass.** Its D6 p95 is five times the threshold.
   This registration does not pretend otherwise; its value for text Read is the
   null branch and the sample floor, not suspense.
3. **No threshold here is new.** The byte threshold is D1's 8,192 B, stated on
   2026-10-14 before any distribution existed. No second numeric bar was placed
   near a seen number — in particular no tail-mass share, which D6 rejected as a
   fit.

## The fresh window

- **Source:** this machine's Claude Code transcripts for this repository, read
  by `scanToolResults` in `src/scripts/_lib/cc_transcript.ts` with the same
  project-prefix scope as `report_reducible_classes` (default
  `projectStoreSlug(REPO)`), payload metric `tool-result-payload-bytes`.
- **Boundary:** only tool results whose transcript timestamp is **strictly
  after** the committer date of the commit that adds this file, and before that
  date plus 14 days. Every result of the D6 window is outside it by construction.
- **Reading date:** no earlier than the window's end. A reading taken earlier is
  a peek and is reported as one, never used for selection.

## The content classes — fixed by semantics, frozen here

A result is **content** when its body is a function of file or repository bytes
at call time, not of executing project code. Exactly these classes, nothing
added later:

| Class | Membership |
|---|---|
| `Read:text` | a `Read` result that is not an image (an image is K7 and stays out) |
| `Bash:file-print` | a Bash command that is one simple command or a pipeline, every stage of which is one of `cat`, `head`, `tail`, `nl`, `wc`, or `sed` with `-n` and a print-only script, operating on file operands or the previous stage |
| `Bash:vcs-content` | a Bash command that is one simple command or a pipeline whose first stage is `git diff`, `git show` or `git log -p` and whose later stages are `Bash:file-print` programs |

Every other Bash result stays in the **execution** profile. A command with a
leading `cd`, an `&&`, `;` or `||` chain, a redirect or a subshell is not
content, whatever it prints; the count of such Bash results above 8,192 B is
**reported as residue**, never moved into a content class after the reading.

## The selection criterion

A content class is **selected** when all three hold over the fresh window:

1. **Size:** its model-visible p95 (nearest rank with floor, as in
   `nearestRankP95`) exceeds **8,192 B** (D1, unchanged).
2. **Sample floor:** it has at least **200 results** in the window, so its p95 is
   not set by a handful of outliers. A class under the floor is reported
   `insufficient`, not `out`.
3. **No non-goal:** no K-row of the roadmap excludes it.

The execution profile keeps the 1.1 criterion of the roadmap unchanged (D1 plus
a failure-line structure); it is re-run on the same window and reported beside
the content classes.

## Nulls and consequences, fixed now

- **No content class selected** (and the execution profile still empty): the
  roadmap closes on its second null. There is no third criterion; a further
  arrival of this subject starts from that record.
- **A class `insufficient`:** it is not selected; the window is not extended to
  reach 200, because an extension chosen after seeing a count is a fit.
- **A class selected:** Phase 1's corpus is frozen for it before any summariser
  is written, and the floors the roadmap states before that corpus exists bind it.

## What this registration does not decide

The delivery form of a selected content class — whether a first read is
shortened, or only content already in context — is a roadmap decision (D12),
not a selection question. This file selects which results the profile *may*
touch; it grants no reduction.
