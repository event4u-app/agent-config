---
complexity: lightweight
review_by: 2026-10-07
---

# Stub: nothing runs the ingest step, so the ledger goes missing once per release

> **THE TITLE IS NOW FALSE, AND THAT IS THE POINT — 2026-09-11, owner decision
> after arrival 6.** Something runs the ingest: the `ingest-release-ledger` job
> in `self-review-gate.yml` commits the ledger to the release branch as soon as
> it has reviewed the head, and `release.ts` gained step 7, which **verifies**
> that the ledger is on the remote branch and that the disposition gate passes —
> and stops the release otherwise.
>
> **The ingest is in CI rather than in the release, and that took two review
> rounds to establish.** The first attempt put it in `release.ts` between the
> check wait and the merge. An independent reviewer showed that path is
> unreachable: `finding-dispositions` runs on the release PR and reds while the
> ledger lacks a finding the review reported, so the check wait had already
> killed the release before the step could run — and moving the step earlier
> pushed a commit whose checks had not started. The job that holds the artifact
> is the one place the ledger can exist before any gate looks for it. Everything
> the release needed to discover a run, download an artifact and match its head
> became unnecessary and was deleted rather than left as a second path.
>
> **A second defect was found while fixing the first, and it is why a diligent
> maintainer could still not have closed this by hand.** `--ingest` rebuilt the
> ledger from `{schema_version, release, findings}` and dropped every integrity
> field the artifact carries — `review_independence`, `context_relation`,
> `acceptance_status`, `assurance`, `reviewers`, `coverage`. `check_review_schema`
> derives `acceptance_status` and `assurance` from `review_independence` and reds
> a ledger that declares neither, so the ingest path produced a file the gate
> reading it could not accept. Every committed ledger from 14.19.0 on carries the
> full set; only the ingest produced files without it. Measured against
> `14.23.0.json`, an ingested ledger is now field-identical.
>
> **What remains open, and it is not the mechanism.** The 15.0.0 instance is
> still unclosed: 50 findings, 4 critical and 13 high, needing an adjudication
> per blocking finding that no automation may write. Step 7 does not
> retroactively produce a ledger for a release that already shipped — it stops
> the *next* one. The count below stands at six arrivals and five instance
> fixes; the sixth instance is the owner's, and the mechanism column finally
> moves off zero.

> **Arrival 6 — 2026-09-11, release 15.0.0, instance OPEN and deliberately left
> open.** Count: **6 arrivals, 5 instance fixes, 0 mechanism fixes.** Found the
> same way as arrival 5 — settling CI on a roadmap-only PR (#2003) that inherited
> the red from `main`, whose own last Consistency run predates the tag. The gate
> line is verbatim: *"15.0.0 has shipped and carries no findings ledger"* — at the
> `15.0.0.json` that would sit beside its five predecessors in
> `agents/evidence/release-findings/`. The filename is named apart from its
> directory on purpose: it is precisely the path that does not exist.
>
> **It is ingestible, not absent, and this was checked before anything was
> written.** The `self-review-gate` run for `release/15.0.0` (2026-09-10T21:56Z)
> **succeeded** and carries an unexpired `self-review-findings` artifact of
> 71,629 B. Downloaded and read: schema_version 1, `review_independence:
> single-member`, `acceptance_status: provisional`, `assurance: single-pass`,
> reviewers `[anthropic]`, coverage 181 of 258 files over 6 chunks, and **50
> findings — 4 critical, 13 high, 22 medium, 11 low.** It lacks only the
> `release` field the ingest step adds.
>
> **Why this lane did not ingest it.** `--ingest` merges findings with an *empty*
> disposition and validation stays red until a human fills each one, so ingesting
> converts one red into a red carrying **17 blocking findings with no
> disposition**. Each needs a status, a rationale and a `verified_by` — an
> adjudication of the 15.0.0 release record that no agent has standing to write,
> and that has nothing to do with the inbox round this PR carries. Arrivals 1–5
> were each closed by someone doing exactly that adjudication under time
> pressure while settling an unrelated PR. This one is recorded instead.
>
> **What that makes visible.** Five instance fixes have not reduced the arrival
> rate at all: the interval between arrivals 5 and 6 is two days, and 15.0.0 is
> a major. The mechanism question in this stub's own title is now six releases
> old, and the sixth arrival is the first that was not paid for by a passing lane.

> **Arrival 5 — 2026-09-09, release 14.23.0, instance CLOSED BY A PARALLEL LANE,
> and option 1's open question is now ANSWERED.** Found while settling CI on a
> roadmap-only PR (#1971) that inherited the red from `main`. Count: **5
> arrivals, 5 instance fixes, 0 mechanism fixes.** The instance closure is
> `agents/evidence/release-findings/14.23.0.json`, landed by **PR #1972** while
> this lane was verifying the same 13 findings independently — so 14.23.0 has two
> first-hand dispositions of one finding set, which is worth more than either
> alone and is recorded rather than deduplicated away.
>
> **Where the two readings agreed and where they did not.** Both ingested 49
> findings and dispositioned all 13 blocking ones; #1972's mix is 6
> `accepted_risk` / 5 `false_positive` / 2 `fixed`, this lane's was 11
> `false_positive` / 1 `fixed` / 1 `accepted_risk`. #1972's record is the one that
> shipped and is left standing, with **one row corrected**: it dispositioned
> `549923656232` (option injection in `graph_impact`'s rev) as `false_positive`
> on the sentence "the `..HEAD` suffix means an attacker cannot land a clean
> option at all". A probe refutes that — `--output=<file>` absorbs the suffix
> into its VALUE, so `--output=/tmp/x..HEAD` is well-formed and git writes the
> file at exit 0. The earlier probe tested nine boolean-FLAG shapes, where the
> suffix does break the token, and no value-taking option; it named its own scope
> and the gap sits exactly at that boundary, which is the argument for writing
> the scope down. The row is now `fixed`, with a guard at the shared path.
>
> **Two independent dispositions of one finding set is the cheapest disagreement
> detector this process has, and it happened by accident.** Nothing scheduled it,
> nothing would have noticed if only one lane had run, and the one row they
> disagree on is the one with a live exploit behind it.
>
> **What this arrival adds that the four before it could not.** § What closes it,
> option 1, asks to "establish whether that invocation can see an un-ingested
> artifact, because if it can, the gate is already in the right place and only
> its trigger is wrong." It was established, and the answer is neither half:
> **the gate is already in the right place, runs on the release PR exactly as
> option 1 hoped, and always runs BEFORE the evidence it reads exists.** On
> `release/14.23.0`, job `102484975847` ("Blocking review findings
> dispositioned") ran 13:15:27 → 13:15:45 and printed `scanned: 0`; the
> `self-review-gate` machine block it reads landed as a PR comment at **13:21:36**
> — six minutes later. The earlier run repeats it: release-validation finished
> 12:31:52, comment 12:36:48. The job is fast and the model call is slow, so the
> race is not close and not intermittent; it is structural.
>
> So option 1 as written — move the trigger — buys nothing, because the trigger
> is already right. What the measurement replaces it with is **1a: order the two
> jobs, or fail closed when the self-review has not yet reported.** `scanned: 0`
> is currently indistinguishable from "no findings" and from "the review has not
> spoken yet", and the second is the state it is always in. That is a workflow
> ordering change on the release path, so it stays an owner call — but it is now
> a one-line question rather than an investigation.

> **Stub — not active work.** The 14.21.0 instance is CLOSED in this change: the
> artifact was pulled, all 40 findings ingested and all 10 blocking ones
> dispositioned, and `check_finding_dispositions` is green. What is NOT closed is
> the reason it went missing, and that is what this stub owns. Found 2026-09-07
> by [`/analyze:inbox`](../../../src/domains/analysis-workbench/analyze/inbox/command.md)
> on an unrelated round, from a CI red inherited from `main`.

> **Arrivals:** 5 — the fifth is the block above (2026-09-09, release 14.23.0);
> the four this paragraph counts are unchanged and it is kept as written.
> Latest of those four: 2026-09-08 (release 14.22.0, **instance CLOSED the same
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
