---
estate_offset_exempt: "Authored by the 2026-08-22 inbox drain, which consumed 25 dropped artefacts carrying 53 pre-written roadmap drafts in one pass. It ships status: draft, so it is not active work and moves none of the three gated metrics; there is nothing yet to offset. The offset alternatives all cost more than this line: no active roadmap sits at zero open steps, so archiving buys nothing; parking these in later/ is what the estate register calls burial and would hide twenty verified defect sets behind a disposition nobody reviews; and terminating another session's roadmap would be a judgement about their work rather than mine. The blockers these drafts carry will charge this ratchet on the day the maintainer flips one to ready, which is the point at which an offset is a real decision. Charged as one reviewable line, per this gate's own instruction."
complexity: lightweight
status: draft
execution:
  mode: phase-checkpoints
---
# Road to a spec axis in review

> **Source:** `agents/tmp.old/better-review` — an external analysis dropped into
> the inbox on 2026-08-22. Every `file:line` below was re-verified against this
> worktree before it was written; where the source's reference had drifted, the
> current line is written here.

## Goal

Post-hoc review of a change can answer **"was the right thing built?"**, not
only "was it built right". Today it cannot: every judge on the default review
path asks a craft or correctness question, and the one judge in the tree that
asks a spec question is reachable only through a specific orchestration mode
that requires the acceptance criteria to be handed in. When this is finished, a
change that is correct, clean, well-tested, architecturally sound — and does
not do what was asked — is caught by the default path, and the synthesis step
does not dissolve that finding into a severity ranking where it competes with a
naming nit.

## Context — the axis that is missing, and the two defects beside it

**All five default judges ask a craft-or-correctness question.** The judge
table in `src/domains/engineering-base/review/changes/command.md:75-79` lists
bug-hunter (correctness, null-safety, edge cases, races, error handling),
security-auditor (authz/authn, injection, secrets, SSRF, XSS), test-coverage
(missing assertions, uncovered branches, over-mocking), code-quality (naming,
SRP, DRY, dead code) and architecture-review-lens (layer violations, dependency
direction, leaky abstractions). None of them reads a requirement.

**The one spec judge in the tree is not on that path.**
`src/skills/subagent-orchestration/prompts/do-and-judge-two-stage.md:62-72` is
the SPEC COMPLIANCE judge — *"your ONLY job is: does the diff satisfy every
acceptance criterion as stated?"* — and it consumes `{{acceptance_criteria}}`
at `:69`, which the caller must supply. It is stage 1 of mode 2 of nine
(`src/skills/subagent-orchestration/SKILL.md:163`), never the review default.

**The eval corpus has no spec scenario.** `src/skills/code-review/evals/evals.json`
carries exactly 4 scenarios: `diff-with-multiple-issues`,
`clean-diff-few-findings`, `golden-sqli-must-block`,
`golden-benign-lookalike-no-injection`. Nothing measures spec compliance, so
adding the axis has no baseline to move against until Phase 1 supplies one.

**Synthesis fuses everything onto one severity axis — and this roadmap owns
that file.** `src/skills/judge-synthesis/SKILL.md:45-46` states that *"the
three verdict vocabularies in the suite map onto one ordered severity axis"*,
`:54` orders them worst→best, and `:138` collapses the result into one
recommendation word. A spec finding entering that pipeline becomes a severity,
and a severity is comparable to a naming nit. It should not be.

> **Ownership note.** `src/skills/judge-synthesis/SKILL.md` (222 lines, cap 400)
> is **this roadmap's file**. The sibling roadmap `road-to-review-independence`
> wants a consensus-confidence field in the same three anchors and defers to
> this one — its Phase 2.3 is reference-only and asserts an empty diff over
> that path. If both are live, the consensus-confidence field lands here or
> waits.

Two pure defects sit beside the missing axis in the same command file. They
need no borrow, no design and no spike, which is why they go first.

## Phase 0 — the two defects that need nothing but a fix

- [ ] **0.1 Verify the base ref before diffing against it.**
      `src/domains/engineering-base/review/changes/command.md:54-55` runs
      `git diff origin/main..HEAD --stat` and `git diff origin/main..HEAD`
      unconditionally. `origin/main` is assumed to exist and to be the right
      base; nothing checks. The file already knows how to ask git a question —
      `:35` detects the current branch with `git rev-parse --abbrev-ref HEAD` —
      so the shape is present and simply not applied to the base. Add a
      `git rev-parse --verify` on the base ref, and a named stop when it does
      not resolve.
      verify: `grep -n 'rev-parse --verify' src/domains/engineering-base/review/changes/command.md`
      returns a hit; `git show HEAD:src/domains/engineering-base/review/changes/command.md | grep -c 'rev-parse --verify'`
      returns `0` (the pre-state assertion).
- [ ] **0.2 Fix the four-vs-five judge-count drift.** The same file says
      **four** specialized judges at `:27`, `:111`, `:118` and `:250`, and
      **five** at `:12`, `:68`, `:81`, `:90`, `:93`, `:143`, `:176` and `:221`.
      Five is correct — the table at `:75-79` has five rows. Fix the four
      occurrences. **Do not touch `:140`**: that line is the settings-ask
      protocol's four slots, not a judge count, and changing it would introduce
      a real error while removing a cosmetic one.
      verify: `grep -c -i '\bfour\b' src/domains/engineering-base/review/changes/command.md`
      returns `1`, and that single remaining hit is `:140`.

## Phase 1 — a spec axis reachable from the default path

- [ ] **1.1 Add the spec question to the default review path.** Reuse the
      wording that already works — `do-and-judge-two-stage.md:65-67` is a
      one-job prompt that explicitly refuses to review style or craft, which is
      exactly the separation this axis needs. Extend the judge set in
      `review/changes/command.md`, do not fork the prompt.
      verify: the judge table at `:75-79` gains a spec row and the count prose
      is consistent with it; `grep -c -i '\bfive\b' src/domains/engineering-base/review/changes/command.md`
      and the new count agree.
- [ ] **1.2 Add the eval scenario that makes the axis falsifiable.** A fixture
      diff that is **correct, clean and tested** and does **not** satisfy its
      stated criterion. Add it to `src/skills/code-review/evals/evals.json`
      beside the existing four.
      verify: the scenario is present and the pre-change judge set does **not**
      catch it — recorded by running the eval against
      `git show HEAD:src/skills/code-review/evals/evals.json`'s judge set first
      and capturing the miss, before 1.1 lands.
- [ ] **1.3 Handle the case where there is no spec.** An ad-hoc review of a
      local branch may have no acceptance criteria at all. The spec judge must
      say "no criteria available" rather than inventing them from the diff — a
      judge that infers the requirement from the change it is judging always
      finds the change compliant. `dispatch_r2_reviewer.ts:728` already models
      the honest version of this for its own extraction failure, distinguishing
      "declares none" from "declares them in an unrecognised shape".
      verify: a fixture with no criteria produces an explicit no-criteria
      outcome, not a `satisfied` verdict; asserted by a committed test.

## Phase 2 — stop fusing spec findings onto the severity axis

- [ ] **2.1 Give spec findings their own dimension in synthesis.**
      `src/skills/judge-synthesis/SKILL.md:45-46` and `:54` map every verdict
      vocabulary onto one ordered severity axis. A spec finding is not a
      severity — "this does not do what was asked" does not compare to "this
      variable is badly named", and ranking them on one scale means the second
      can outrank the first when three judges raise nits and one raises the
      spec gap. Add the dimension; keep the existing axis intact for the
      judges that legitimately share it.
      verify: `wc -l < src/skills/judge-synthesis/SKILL.md` stays under `400`;
      a synthesis fixture with one spec finding and three cosmetic findings
      surfaces the spec finding, and the same fixture on
      `git show HEAD:src/skills/judge-synthesis/SKILL.md`'s rules does not.
- [ ] **2.2 Make the overall recommendation reflect it.**
      `:138` collapses to `block` / `revise` / `proceed` from worst-tier
      presence alone. Decide — and write down — whether an unsatisfied
      criterion is a `block`, and say so explicitly rather than leaving it to
      the severity mapping.
      verify: the sentence at the overall-recommendation section names the spec
      dimension by name; the fixture from 2.1 produces the documented outcome.

## Phase 3 — spec-source binding

A spec axis is only as good as the criteria it reads. Where those come from on
an ad-hoc review is an open question, and it is a **blocker**, not a step —
see `blocker: spec-source-binding`.

- [ ] **3.1 Bind the criteria to a source, once the blocker is resolved.**
      Whatever the answer, record the source in the review artefact so a later
      reader can tell which criteria the verdict was measured against. The
      dispatcher already does exactly this for its own inputs — it snapshots
      the roadmap verbatim and writes `acceptance-criteria.md` beside the
      prompt (`src/scripts/dispatch_r2_reviewer.ts:1218-1221`).
      verify: a review artefact produced with criteria names its criteria
      source; one produced without criteria says so.
- [ ] **3.2 Do not let an inferred spec pass as a bound one.** If the criteria
      were derived rather than supplied, the artefact says `derived`. Silence
      must not read as `supplied`.
      verify: a test asserts the two states are distinguishable in the artefact
      and that absence maps to neither.

## Phase 4 — review-surface telemetry

There is no telemetry on the review surface, so the effect of Phases 1–3 is
unmeasurable: nothing records how often a review runs, which judges fire, or
whether the spec axis ever changes a verdict.

- [ ] **4.1 Record one line per review.** Which judges ran, whether the spec
      axis was reachable, and whether it changed the recommendation. Structural
      counters only — the event type carries no field able to hold free-form
      content, prompt text, file bodies or identifiers, the same
      exclusion-by-construction the existing telemetry event uses.
      verify: the emitted record's type has no free-form field; a test asserts
      the shape and fails if a `payload` / `notes` / `extra` field is added.
- [ ] **4.2 Report the spec axis's effect after an observation window.**
      Whether the axis ever flipped a recommendation, stated as a number,
      including the honest answer that it did not.
      verify: the report exists under `agents/evidence/` and names the window
      and the count, whatever the count is.

## Blockers

### blocker: spec-source-binding

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 3 in full; Phase 1.3's fallback wording
- **What to do:** pick exactly one — (a) the spec axis reads criteria only when
  a roadmap or ticket is explicitly supplied, and reports "no criteria" on
  every ad-hoc review, or (b) the axis may derive criteria from the branch's
  commit messages and PR body, marked `derived` in the artefact and never
  presented as supplied.
- **Resolved when:** the choice is recorded at Phase 3 in this file, and
  Phase 1.3's fixture asserts the chosen behaviour.
- **Recommendation:** (a). Reporting "no criteria" is the honest answer and it
  is cheap; deriving criteria from the branch is the failure mode Risk 1
  names, and option (b) is only safe once the `derived` label is enforced
  rather than requested.
- **If you do nothing:** Phase 3 stays blocked and Phase 1.3 has no fixture to
  assert against, so the spec judge ships with an undefined behaviour on
  ad-hoc reviews — the single case where inferring the spec from the diff is
  most tempting.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The spec judge infers the criteria from the diff and always finds compliance | product | A judge with no supplied criteria that is asked "does this satisfy the spec" will reconstruct the spec from the change it is reading, and then it is measuring the change against itself. This is the failure that makes a spec axis worse than no spec axis, because it produces a confident green. | Phase 1.3 requires an explicit no-criteria outcome and a committed fixture; the spec-source-binding blocker gates Phase 3 until the source is decided. | Phase 1 — a spec axis reachable from the default path |
| 2 | Editing `judge-synthesis/SKILL.md` collides with the sibling roadmap | implementation | The sibling wants a consensus-confidence field in the same three anchors of a 222-line file. Two uncoordinated edits lose one obligation in the merge. | The ownership note in Context assigns the file to this roadmap; the sibling's matching item is reference-only and asserts an empty diff over the path. | Phase 2 — stop fusing spec findings onto the severity axis |
| 3 | The judge-count fix silently changes the settings-ask line | implementation | `:140` says "four" and is not a judge count. A blanket four→five replace introduces a real error while removing a cosmetic one. | 0.2 names `:140` explicitly as excluded and its verify asserts exactly one remaining `four`, which must be that line. | Phase 0 — the two defects that need nothing but a fix |
| 4 | A sixth judge makes the default path slower and the axis gets switched off | product | Five sequential judges is already the default (`:86`); a sixth lengthens the common path, and the cheapest response is to stop running it. | Phase 4 measures whether the axis ever changes a recommendation, so the decision to keep or drop it rests on a number rather than on impatience. | Phase 4 — review-surface telemetry |
| 5 | The eval scenario is written after the axis and cannot show a miss | implementation | A scenario authored once the spec judge exists will be authored to pass it, and then it measures nothing. | 1.2's verify requires the pre-change miss to be captured against the HEAD judge set **before** 1.1 lands. | Phase 1 — a spec axis reachable from the default path |

## Acceptance Criteria

- [ ] AC-1 — a fixture change that is correct, clean, tested and **off-spec** is
      caught by the default review path, and the same fixture measurably was
      **not** caught before. Both results are committed.
- [ ] AC-2 — a spec finding is distinguishable from a craft finding in the
      synthesis output; it is no longer expressible only as a point on the
      severity axis.
- [ ] AC-3 — a review with no acceptance criteria says so explicitly. No path
      produces a `satisfied` spec verdict from criteria the judge inferred from
      the diff it was judging.
- [ ] AC-4 — the review command file states one judge count, and that count
      matches the number of rows in its own judge table.
- [ ] AC-5 — the base ref is verified before it is diffed against, and an
      unresolvable base stops the review with a named reason instead of
      producing an empty or wrong diff.
- [ ] AC-6 — the effect of the spec axis is reported as a number after an
      observation window, including the honest result that it changed nothing.
