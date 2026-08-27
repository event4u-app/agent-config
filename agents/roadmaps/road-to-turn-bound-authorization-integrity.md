---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-27
relates: []
# relates: `agent-config roadmap:context` on 2026-08-27 — scanned 2 PRs,
# 783 roadmap file(s) across active/later/stubs/archive, 348 remote branch(es),
# 3 live session record(s), 0 inbox file name(s). No sibling roadmap on the
# topic, no remote branch carrying the slug, and no open-PR file overlap for
# this roadmap. Context fingerprint 1fad1aa7901bc34b, base 0be1cf6b7.
estate_offset_exempt: "No disposal is available in this change: the dashboard reports 6/205 steps done across the seven active roadmaps, so nothing is near archival, and parking this would grow the later_roadmaps floor instead of the active one. It cannot fold into a sibling either — a tree-wide grep over agents/roadmaps/**/*.md for `git_authorization_hook`, `authorization ledger` and `authorized: []` returns the evidence report and this file only; `stubs/road-to-gate-preauth-authorization.md` is a different subject (a human-signed budget line for the live-trigger-eval abort), not the wake-classification defect below."
---
# Road to turn-bound authorization integrity — a notification is not a user turn

> **Source:** `agents/tmp.old/mixed-analysis/` (2026-08-27), item R1.6 of an
> external synthesis drafted against `3738c23e3`. The item arrived as one line
> ("durable AuthorizationLedger"); the defect below is this repository's own,
> re-derived from `agents/evidence/pr-drain-run-summary.md` and the hook source,
> and the proposed remedy is `corrected-from-reproduction`: the source asked for
> **durability**, and durability is the wrong fix.

## Goal

An agent-originated wake — a background task notification, a scheduled
continuation, any turn the user did not type — no longer consumes turn-bound git
authorization. When this is finished, the ledger writer can tell a human prompt
from a machine one, a machine wake leaves an existing authorization standing,
and the distinction is proved by a test that fails when the classifier is
neutralised.

## Context — the defect, and why "make it durable" is the wrong repair

`src/scripts/git_authorization_hook.ts:28` states the replacement is deliberate:
*"Each user turn REPLACES the ledger — that is the point"*, so that a consent
given three turns ago cannot authorize today's push. That design is correct and
this roadmap does not touch it.

What breaks it is the **input classification**, not the retention. Measured
during the 2026-08-26 PR drain and recorded at
`agents/evidence/pr-drain-run-summary.md:13`: *"a background wait produces a task
notification, the notification counts as a prompt, and the prompt rewrites the
git-authorization ledger to `authorized: []` mid-run."* The same run records the
operational consequence at `:116` — **two authorization stalls**, and a working
method that exists only to route around the defect: wait for CI in the
**foreground**, because backgrounding the wait spends the authorization.

So the observable failure is a *correctly retained* authorization being
correctly cleared by an input that should never have counted as a turn. Making
the ledger durable would break the property at `:28` to hide a symptom of a
different bug.

Two consequences worth stating because they are what makes this worth a roadmap
rather than a note: the workaround is undocumented outside one evidence report,
and it silently forbids the background-wait pattern the harness otherwise
encourages.

## What already exists — read this before proposing a mechanism

- `src/scripts/git_authorization_hook.ts` — the `user_prompt_submit` concern that
  writes the ledger; per-session path via `ledgerFileFor` (`:89`), a measured
  2026-08-18 defect already repaired at the *path* layer.
- `src/scripts/hooks/block_unauthorized_git.ts` — the `pre_tool_use` reader that
  turns the ledger into a deny.
- `src/scripts/hook_manifest.yaml` — where the concern's slot binding is declared.
- `docs/contracts/hook-architecture-v1.md:210-226` — concerns run sequentially in
  manifest order, with the reduction order stated.

The repair therefore has a home: it is a predicate in the existing writer, not a
new store, not a new slot, and not a new contract.

## Independently verified, 2026-08-27 — the claim no longer rests on one file

> The PR that landed this roadmap carried a **critical** blocking-advisory from
> its own adversarial-review gate (`45e24dabfed9`): the defect claim depended on
> a single evidence file with no independent verification. It was correct. Two
> legs were added; the claim survives both, and the verification answered part of
> Phase 1 before it ran. Full working:
> `agents/evidence/analysis/mixed-analysis-inbox-verification-2026-08-27.md`
> § The authorization defect, independently verified.

- **Leg 1, the host's own record.** A `<task-notification>` is stored as
  `"type":"user","message":{"role":"user"}` — **561 occurrences across 92 of 167**
  session transcripts in this project's store. It is not merely treated as a
  prompt by one hook; it **is** a user turn to the host.
- **Leg 2, the writer.** `git_authorization_hook.ts:468-513` returns early only
  on empty prompt text (`:490`), then rebuilds and writes the ledger from
  `classifyAuthorization(prompt)` (`:494`). Nothing in the path reads origin.
- **A second instance, same function.** `takePending` (`:427`) is called on every
  prompt (`:499`) and `rmSync`s the pending-refusal file at `:440` **before** any
  affirmative or origin check. A notification arriving between a refusal and the
  user's "ja" deletes the pending record, so the affirmative confirms nothing.
  Step 3.2's sweep therefore starts from one confirmed sibling, not from zero.

## Phase 1 — Establish what the writer actually receives

> **Partly answered before execution (2026-08-27).** The discriminator exists:
> the prompt text begins with the literal element `<task-notification>` and
> carries `<task-id>`, `<tool-use-id>`, `<status>` and `<summary>` children, in
> all 561 measured occurrences. The "no field differs, so stop here" branch does
> not fire. Phase 1 is now confirmation and capture, not discovery.

- [ ] **1.1 Capture the raw payload of a machine wake.** Record one
      `user_prompt_submit` payload produced by a background task notification and
      one produced by a typed human prompt, both to `agents/runtime/tmp/`, and
      diff their fields.
      verify: two captured payloads exist and the diff shows the
      `<task-notification>` element present in one and absent in the other. The
      transcript measurement is over stored turns; this confirms the same
      element survives into the payload the hook actually receives, which is the
      one thing a transcript cannot show.
- [ ] **1.2 State the discriminator, or state that there is none.** Write the
      field and value that separates the two, in one sentence, into the roadmap
      itself.
      verify: the sentence names a field that appears in the 1.1 capture, quoted
      verbatim from it rather than from documentation or from the 2026-08-27
      transcript measurement above — a payload key and a stored-turn key are not
      guaranteed to be the same key.

## Phase 2 — Classify the wake, and leave a machine wake's ledger alone

- [ ] **2.1 Add the predicate.** A single exported function in
      `git_authorization_hook.ts` answering "did a human type this turn?", with
      the unknown case answering **yes** — an unrecognised payload must fall back
      to today's behaviour (clear the ledger), never to retention, because a
      wrongly retained authorization is the failure the whole gate exists to
      prevent.
      verify: `npm run typecheck` is clean and the function's unknown-input case
      is covered by a unit test asserting the clearing branch.
- [ ] **2.2 Wire it.** On a machine wake, the writer leaves the existing ledger
      untouched instead of replacing it; on a human turn nothing changes.
      verify: a test that drives the writer with the 1.1 machine payload and
      asserts the ledger file's mtime and content are unchanged.
- [ ] **2.3 Prove the test is sensitive.** Neutralise the predicate so it always
      answers "human", observe 2.2 fail, restore it, observe it pass.
      verify: both observations are recorded in the step's completion note. A
      test never seen red has unknown sensitivity.

## Phase 3 — Retire the workaround, in writing

- [ ] **3.1 Record the repair where the workaround is recorded.** Amend
      `agents/evidence/pr-drain-run-summary.md` with a dated line stating that
      the foreground-wait requirement was a workaround for this defect and what
      replaced it.
      verify: the file names this roadmap and the commit that landed Phase 2.
- [ ] **3.2 Check for siblings.** Grep the tree for other state that a
      `user_prompt_submit` concern replaces or consumes per turn and would be
      cleared by the same wake. **One sibling is already confirmed** and is the
      floor, not the answer: `takePending` (`git_authorization_hook.ts:427`,
      called at `:499`) `rmSync`s the pending-refusal file at `:440` before any
      affirmative or origin check.
      verify: the count and the file list are reported, zero included, and the
      count is ≥ 1 because the sibling above is known. One instance is a sample,
      not the population.
- [ ] **3.3 Decide whether the pending path takes the same predicate.** The
      Phase 2 predicate answers "did a human type this turn?"; `takePending`
      needs the same answer before it deletes. State whether it reuses the
      predicate or is left alone, with the reason.
      verify: the decision is written into the roadmap, and if it reuses the
      predicate, a test drives `takePending` with the 1.1 machine payload and
      asserts the pending file still exists afterwards.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The stored turn and the hook payload carry different keys | implementation | Downgraded 2026-08-27 from "the two payloads are indistinguishable", which the transcript measurement refutes: the `<task-notification>` element is present in all 561 measured turns. The residual risk is narrower and real — the transcript records what the host STORED, and the hook reads what the host SENDS. A host that strips the element on the way to the payload would leave 1.1 with nothing to match | 1.1 captures the payload the hook actually receives rather than trusting the transcript, and 1.2 forbids quoting the discriminator from the transcript measurement for exactly this reason | Phase 1 — Establish what the writer actually receives |
| 2 | The fallback is set the wrong way | product | A predicate that answers "machine" on an unrecognised payload would retain authorization across turns — a strictly worse failure than the one being fixed, and a silent one | 2.1 fixes the unknown case to the clearing branch and requires a unit test on exactly that branch, so the safe direction is asserted rather than intended | Phase 2 — Classify the wake, and leave a machine wake's ledger alone |
| 3 | The repair is proved by a test that never could fail | implementation | A test driving a writer whose predicate is stubbed, or asserting on a file the test itself wrote, passes against any implementation | 2.3 makes sensitivity an explicit step with both observations recorded, not an implied property of a green run | Phase 2 — Classify the wake, and leave a machine wake's ledger alone |
| 4 | Only this one consumer is repaired | product | The wake misclassification is a property of the slot, not of this concern, so any other per-turn state has the same defect and would keep it | 3.2 makes the sibling sweep a step with a reported count rather than a closing remark | Phase 3 — Retire the workaround, in writing |

## Acceptance Criteria

- [ ] AC-1 — A background task notification arriving mid-run leaves an existing
      git authorization standing, demonstrated by a test that fails when the
      classifier is neutralised and passes when it is restored. Both observations
      are on the record.
- [ ] AC-2 — An unrecognised `user_prompt_submit` payload clears the ledger, and
      a unit test asserts that branch directly. The safe direction is proved, not
      assumed.
- [ ] AC-3 — The foreground-wait workaround is documented as retired at the place
      it was documented as required, naming the commit that replaced it.
- [ ] AC-4 — The sibling sweep for other per-turn state has run and reported a
      count and a file list. The count is **≥ 1**: `takePending` is a confirmed
      instance, so zero here means the sweep is broken, not that the population
      is empty.
- [ ] AC-5 — The pending-refusal path has an explicit written decision — reuse
      the wake predicate or leave it alone — and if it reuses it, a test drives
      `takePending` with a machine payload and asserts the pending file survives.
