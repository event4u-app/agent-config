---
proposed_by: claude-code drain lane L, road-to-what-was-built-and-never-ran (2026-10-13)
implemented_by: claude-code drain lane L, same session — see § Independence
reviewed_by: ai-council 2026-10-13 — anthropic/claude-sonnet-4-5 (cli) + openai/codex-default (cli)
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/what-was-built-never-ran-20261013`

Named for the branch, because the gate reads this file on the first push,
before a PR number exists.

## What was proposed

Phases 1, 2 and 3 of `road-to-what-was-built-and-never-ran`. Gated surfaces in
the diff:

| Surface | Change |
|---|---|
| `src/scripts/check_kernel_edit_ratified.ts` (self-watched) | COMMENT ONLY. One paragraph called the kernel-write tool-call deny "the retired hook". It is not retired: `block-kernel-rule-writes` has a row in `hook_manifest.yaml` and sits in the `pre_tool_use` list of three host sections, which the file's own header already says. No executable line changes. |
| `.github/workflows/rule-backstops.yml` | two steps invoking the two newly wired roadmap lints |
| `src/config/gate-coverage.yml` | two rows, each with a scanned floor, a `ci_invocation` and a canary or a `no_canary_reason` |

Reviewed alongside, not gated: `report_required_checks_drift.ts` (comment
only), `adr_cite_check.ts` (a new read-only output line),
`classify_merge_risk.ts` (two fail-open repairs),
`lint_ticked_unmet_criteria.ts` and `lint_blocker_citations.ts` (the two lints
themselves), `taskfiles/ci-fast.yml` and `Taskfile.yml`.

## Why `ratified` rather than `confirmed-non-expanding`

The seats split on this label across the rounds and converged on `ratified`.
The reason the stronger label is recorded: wiring two dormant lints into a
workflow turns them into merge-affecting controls, which is an expansion of
what CI refuses. `confirmed-non-expanding` would be inaccurate for that, even
though every other part of the diff is a tightening or a comment.

## Rounds

Four council invocations, all 2026-10-13, all subscription CLI, $0. Responses
are runtime artefacts and are not cited by path.

1. **Round 1 — split.** anthropic `confirmed-non-expanding`; openai
   **`refused`**. The blocking finding: the historical exemption in
   `lint_ticked_unmet_criteria` keyed on a `MET YYYY-MM-DD` / `CLOSED
   YYYY-MM-DD` marker anywhere in a criterion block — *"an author-controlled
   suppression ... the same author whose change is being checked ... the regex
   even accepts impossible dates such as `CLOSED 2026-99-99`"*. Its own
   alternative: *"grandfather legitimate historical cases through a checked-in
   baseline keyed by path, criterion, and content hash."*
2. **Fix commit `227bd1018`.** The marker is gone. `HISTORICAL` is a frozen
   list in the gate's own source pinning two criteria by path, criterion id and
   the SHA-256 of the criterion block. An edited block changes its digest and is
   reported; an entry matching nothing is itself an error, printed alongside the
   hits rather than instead of them. Pinned by tests seen red: a self-typed
   `CLOSED 2026-08-31` over a bare `NOT met` fails, an impossible date is not
   special, and editing one word inside a grandfathered block reports it.
3. **Round 2 — split.** anthropic `confirmed-non-expanding`; openai
   **`refused`**, accepting the digest list as closing its round-1 finding and
   raising a new blocker: the two new workflow invocations live in
   `rule-backstops.yml`, which `check_kernel_edit_ratified` does not watch, so a
   later change could delete either one with no record. It named its own
   discharge: show that an independently enforced checker verifies every
   `status: enforced` row's `ci_invocation`.
4. **Fix commit `e9cc6055a`** for its two minor findings: duplicate `HISTORICAL`
   keys are now an error, and `adr_cite_check`'s scoped-successor scan gained
   focused tests (partial ADR-number match, several successors, a successor with
   no scope, the first-sentence extraction).
5. **Round 3 — split, seats swapped.** openai **`ratified`**; anthropic
   **`refused`** on the residual the round-3 artefact itself disclosed:
   deleting the `gate-coverage.yml` ROW together with the workflow step greens
   `check_gate_coverage`. openai named one evidence gap: only ONE of the two
   gates had been deleted and measured, while protection of both was claimed.
6. **Round 4 — 2/2 `ratified`**, after measurements B and C below. Both seats
   named measurement C as the one that moved them.

## The three measurements

Each deletion was made on this tree on 2026-10-13, the gate run, and the
deletion reverted.

**A — delete the `lint_ticked_unmet_criteria` workflow step, nothing else.**
`check_gate_coverage` exits 1: *"`.github/workflows/rule-backstops.yml` — no
invocation of `src/scripts/lint_ticked_unmet_criteria` — the workflow does not
call this gate"*, plus *"1 row(s) declare a `ci_invocation` their workflow no
longer matches"*.

**B — the same for `lint_blocker_citations`.** The gap round 3 named. Same two
lines, same exit 1. The generalization is now measured rather than assumed.

**C — the coordinated deletion round 3 refused on:** both workflow steps AND
both `gate-coverage.yml` rows deleted, the `ci-fast` tasks left in place.
`check_gate_coverage` exits 0, as round 3 predicted — and
`check_ci_local_parity` exits 1 at *132 violation(s) against a baseline of
130*. It is a shrink-only ratchet over gates `task ci` runs and no workflow
does, and its own record states the property: *"a NEW gate registered in `task
ci` with no workflow reds immediately."*

The enforcement chain behind A and B: each row carries `ci_invocation`, the
manifest header defines it as *"that file must contain an invocation of the
gate whose argument list equals `argv` exactly"*, `check_gate_coverage`
enforces it, and `check_gate_coverage` is invoked at
`.github/workflows/consistency.yml:507` — a file that IS the `WORKFLOW_PATH` of
`check_kernel_edit_ratified`, so removing that step demands its own record.

## What the reviewers said that is adopted, and what is not

- **Adopted:** round 1's blocking finding, in full, by implementing that seat's
  own alternative. Round 2's duplicate-key and supersession-test findings.
  Round 3's evidence gap, by running measurement B.
- **Recorded as a residual, not fixed:** `gate-coverage.yml` is not watched by
  `check_kernel_edit_ratified`, so a four-file deletion — workflow steps,
  manifest rows, `ci-fast` tasks, `Taskfile.yml` entries — removes these gates
  with no ratification record. The property is the manifest's and not this
  diff's: all 113 rows that predate this change have it identically. Both
  round-4 seats accepted that reading and both recommended a separate follow-up
  proposing the widening on its own merits. Widening the ratification gate's
  watched set is itself a change to the ratification mechanism and would need
  its own record; doing it inside this diff, to clear this diff's review, is the
  shape a reviewer should be most suspicious of.
- **Correction adopted into this record rather than argued with.** Round 4's
  openai seat found the round-4 artefact's own claim too absolute: silencing the
  gates does not *require* exactly those four deletions — raising the
  `check_ci_local_parity` baseline, or modifying that gate, would also do it.
  True. What the measurements establish is narrower and is stated that way
  above: no PARTIAL deletion is silent. Every remaining route is a conspicuous
  edit to an enforcement mechanism rather than a quiet removal of a registration.
- **Not adopted:** nothing was proposed and refused.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` are the same agent session; `reviewed_by` is
the council, run by that session. The session wrote the prompts, which is the
evaluator-independence risk, and they are preserved below so the steering can be
checked. No prompt states an expected outcome; rounds 2 to 4 each report that an
earlier round refused and on what, which the reviewer needed in order to judge
the fixes.

Two things a reader should weigh. The seats disagreed in every round but the
last, and they swapped sides between rounds 2 and 3 — which is evidence the
prompts were not steering toward a verdict, since a steered pair does not
produce a seat moving from `ratified` to `refused` on the same artefact.
Against that: the round-4 prompt is the longest and most argued of the four,
carrying a four-point case for accepting the residual. It was written by the
party seeking the ratification. A reader weighing this record should read that
section as advocacy and the three measurements as the evidence.

## The prompts

Four prompt files, each the full text sent to both seats, with the diff appended
for rounds 1 and 2:

- Round 1 — the change, five parts, and four questions ending *"What would
  change your verdict?"*, plus `git diff origin/main...HEAD` of the five changed
  source and workflow files.
- Round 2 — a "Revision since an earlier review round" section quoting the
  refusing seat verbatim, then the diff of the four files round 1 could not see
  or that the revision rewrote. The full diff exceeded the council's 51,200-byte
  bundle ceiling, so the four files unchanged since round 1 were named rather
  than resent, and the prompt says so.
- Round 3 — measurement A, the enforcement chain, and an explicit *"What the
  measurement does NOT establish"* section disclosing the coordinated-deletion
  residual before any seat found it.
- Round 4 — measurements B and C, and the four-point case for accepting the
  residual, offered as *"for you to accept or reject"*.

Prompt text for every round is reproduced in the pull-request description of the
branch this record names, because council response files are gitignored and
pruned and cannot be cited by path.

## What would have changed the verdict

Round 4 named it on both seats: evidence that either gate can disappear while
its local registration still looks active with all required checks green, or
that this diff weakens `check_gate_coverage`, `check_ci_local_parity` or the
protection governing them. Measurement C tested the first and it failed to
disappear quietly; the second is not attempted anywhere in the diff.

## Spend

$0. All four rounds ran on subscription CLI seats; the council reported
`billable=0` on every invocation and `TOTAL: $0.0000`.
