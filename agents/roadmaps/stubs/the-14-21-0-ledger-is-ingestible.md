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

> **Arrivals:** 4 — latest 2026-09-08 (release 14.22.0, **instance CLOSED the same
> day by PR #1947**, `71510872c` — see the arrival-4 note, corrected below), see
> below); earlier: 2026-09-07 (release 14.21.0, closed in the change that created
> this stub), [`road-to-the-unwritten-ledger.md`](../archive/road-to-the-unwritten-ledger.md)
> (fixed 14.16.0) and [`road-to-the-ledger-two-releases-skipped.md`](../archive/road-to-the-ledger-two-releases-skipped.md)
> (recorded 14.17.0 + 14.18.0, arrivals 2). Both archived. Every arrival before
> the fourth fixed its instance and left the mechanism in place — which is why
> the count is written here rather than only in a commit message.

> **CORRECTED 2026-09-08, hours after it was written: the instance WAS closed,
> by a different lane.** PR #1947 (`71510872c`, "disposition the eleven 14.22.0
> blocking findings") landed `agents/evidence/release-findings/14.22.0.json` on
> `main` at `55ba5d2ce`, and `check_finding_dispositions --release 14.22.0` now
> exits 0. So arrival 4 joins the other three: **every arrival so far has fixed
> its instance and left the mechanism in place**, which is the sentence this
> stub's whole existence rests on and which the paragraph below temporarily
> contradicted. The instance record
> (`road-to-the-14-22-0-findings-ledger.md`) is deleted in the same change, on
> its own stated criterion — the ledger exists and the gate exits 0.
>
> **That last sentence was wrong when written, and is corrected here on
> 2026-09-09 rather than edited away.** The instance record was NOT deleted in
> the same change: PR #1950 landed the ledger and left the roadmap standing with
> all four of its boxes open, so it sat complete-and-unticked on the dashboard
> for a day. It was closed on verification and archived to
> `agents/roadmaps/archive/road-to-the-14-22-0-findings-ledger.md` — archived,
> not deleted, because its closure record carries the verdict mix (8
> `false_positive` / 2 `accepted_risk` / 1 `fixed`) and the fact that both
> accepted risks named a receiver which has since fired. The arrival count is
> unaffected: still **4 arrivals, 4 instance fixes, 0 mechanism fixes**.
>
> Two things survive the correction, and they are why this is a correction
> rather than a deletion. The count is now **4 arrivals, 4 instance fixes, 0
> mechanism fixes** — a cleaner statement of the problem than "three fixed, one
> open" was. And the discovery path is unchanged and still the finding: a
> code-graph delivery branch with no release surface in it was where this
> surfaced, because the gate fires one release too late for anyone but a
> bystander to notice.
>
> The paragraph below is kept verbatim as it was written, including its "first
> instance nobody closed" claim, because a stub that silently edits its own
> arrival record is a stub whose count cannot be trusted.

> **Arrival 4 — 2026-09-08, release 14.22.0, and it is the first that did NOT fix
> its instance.** Found while settling CI on `drain/graph-shipped-close`, a
> code-graph delivery branch with no release surface in it. Exactly the shape this
> stub predicts: `Self-review gate` on `release: 14.22.0` (run `34214806821`)
> **succeeded** and uploaded artifact `10051643231` — 56 findings, 3 critical,
> 12 high, coverage 253/253 — and nothing ingested it, so
> `Sync + Generate Tools Consistency` reds on `main` at `2cc536be2` and on every
> branch inheriting it. § What closes it below was already correct before this
> arrival; the arrival adds no new mechanism, only the fourth data point and the
> first instance nobody closed.
>
> **Why this one was left open**, stated because the three before it were closed:
> the finding set is 56 items against a release that branch did not produce, three
> of them critical and five of them security. § What this stub deliberately does
> not claim already says the dispositions are the judgement and stay human — and
> the 14.21.0 closure measured what that judgement costs: ten blocking findings
> split one fix / three accepted risks / six false positives, three of which cited
> line numbers that no longer resolved. A run that closed 56 of those in a
> delivery branch would be manufacturing the ledger, not writing it. The instance
> record, with the artifact id and the finding breakdown, is
> [`road-to-the-14-22-0-findings-ledger.md`](../archive/road-to-the-14-22-0-findings-ledger.md)
> (archived 2026-09-09; the link above pointed at a sibling path that never
> existed, since the record lived one directory up).
>
> **What the fourth arrival changes about the priority, and nothing else.** Three
> arrivals could each be read as an unlucky release. Four, with the mechanism
> measured and three named options sitting unchosen since 2026-09-07, is the
> mechanism being left in place deliberately. The options are unchanged and still
> need the same owner call; this line is only the count.

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
