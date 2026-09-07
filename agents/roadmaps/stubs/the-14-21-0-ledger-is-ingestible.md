---
complexity: lightweight
review_by: 2026-10-07
---

# Stub: nothing runs the ingest step, so the ledger goes missing once per release

> **Stub — not active work.** The 14.21.0 instance is CLOSED in this change: the
> artifact was pulled, all 40 findings ingested and all 10 blocking ones
> dispositioned, and `check_finding_dispositions` is green. What is NOT closed is
> the reason it went missing, and that is what this stub owns. Found 2026-09-07
> by [`/analyze:inbox`](../../../src/domains/analysis-workbench/analyze/inbox/command.md)
> on an unrelated round, from a CI red inherited from `main`.

> **Arrivals:** 3 — latest 2026-09-07 (release 14.21.0, closed in this change);
> earlier: [`road-to-the-unwritten-ledger.md`](../archive/road-to-the-unwritten-ledger.md)
> (fixed 14.16.0) and [`road-to-the-ledger-two-releases-skipped.md`](../archive/road-to-the-ledger-two-releases-skipped.md)
> (recorded 14.17.0 + 14.18.0, arrivals 2). Both archived. Every arrival so far
> has fixed its instance and left the mechanism in place — including this one,
> which is why the count is written here rather than only in a commit message.

## The mechanism, measured

`check_finding_dispositions --ingest` has **no automated caller anywhere in the
tree.** Every occurrence is prose:

| Occurrence | What it is |
|---|---|
| `.github/workflows/self-review-gate.yml:78` | a comment |
| `src/scripts/release_publication.ts:238` | a string printed for a human to run |
| `src/scripts/forensics_report.ts:35` | a docstring |
| `src/scripts/self_review_gate.ts:860` | a comment |

So the pipeline is: `self-review-gate.yml` uploads `self-review-findings`, and
then a human is expected to notice, download it, and run a command that nothing
schedules. The gate that catches the omission — `check_finding_dispositions`,
bound at `.github/workflows/consistency.yml:386` — fires only **after the tag
exists**, which is to say after the release has already shipped without a
ledger. Detection is downstream of the failure by one release.

## Why the earlier arrivals hid this

For 14.17.0–14.20.0 there was nothing to ingest: the self-review returned
HTTP 400 `prompt is too long` (413191 / 450336 / 260998 tokens against the
200000 cap) and uploaded zero artifacts. The honest ledger was a `NOT REVIEWED`
null, and the recorded cause was the prompt size. That cause was real, it was
fixed in the 14.21.0 span, and fixing it **revealed** the second cause that had
been masked for four releases: with a working review, the ledger still does not
get written, because writing it was never wired.

The `14.20.0.json` ledger predicted `14.21.0` would reproduce the HTTP 400. It
did not — `live-advisory` succeeded on `release/14.21.0` (run `34130214783`,
model call 13:57:39 → 14:01:23) and uploaded a real 11148-byte artifact. The
prediction is refuted and the reason it looked right for four releases is that
the two causes are independent.

## What closes it

Pick one; the first is the smallest and the third is the only one that removes
the human step.

1. **Move the gate upstream.** Run `check_finding_dispositions` on the
   `release/*` pull request, not only after the tag — the release PR is where a
   missing ledger is still cheap. `release-validation.yml:388` already runs it
   there under a `--release` argument; establish whether that invocation can see
   an un-ingested artifact, because if it can, the gate is already in the right
   place and only its trigger is wrong.
2. **Make the printed instruction a refusal.** `release_publication.ts:238`
   prints the ingest command as advice. Have the publication step refuse while
   the artifact exists and the ledger does not.
3. **Ingest in the workflow.** `self-review-gate.yml` already holds the findings
   file at `/tmp/self-review-findings.json` in the same job that produced it. A
   step there could ingest it and commit the un-dispositioned ledger, leaving a
   human only the dispositions — which is the part that genuinely needs judgement.

Option 3 changes what a workflow may commit and is therefore the one that needs
an owner ruling, not just a patch.

## What this stub deliberately does not claim

That dispositioning should be automated. It should not: the ten blocking
findings closed in this change split into one fix, three accepted risks and six
false positives, and each false positive took a first-hand read to establish —
three of the ten cited line numbers that no longer resolve, and two described a
gap the file already documents. A machine writing `accepted_risk` into those
rows would be the fabricated-ledger failure that
`road-to-the-ledger-two-releases-skipped` ranks first in its Risk Register. The
gap is the **ingest**, which is mechanical. The dispositions are the judgement,
and they stay human.

## Why a stub and not a roadmap

One measured mechanism, three named options, and the choice between them is an
owner call about what a workflow may commit. An active roadmap would sit on
that decision with nothing an autonomous run may do. Promotion is a move up one
directory plus the complexity frontmatter.
