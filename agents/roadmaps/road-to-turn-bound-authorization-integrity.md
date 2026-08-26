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

## Phase 1 — Establish what the writer actually receives

- [ ] **1.1 Capture the raw payload of a machine wake.** Record one
      `user_prompt_submit` payload produced by a background task notification and
      one produced by a typed human prompt, both to `agents/runtime/tmp/`, and
      diff their fields.
      verify: two captured payloads exist and the diff names at least one field
      that differs; if no field differs, this roadmap stops here and says so —
      an undetectable wake cannot be classified and Phase 2 is void.
- [ ] **1.2 State the discriminator, or state that there is none.** Write the
      field and value that separates the two, in one sentence, into the roadmap
      itself.
      verify: the sentence names a field that appears in the 1.1 capture, quoted
      verbatim from it rather than from documentation.

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
      `user_prompt_submit` concern replaces per turn and would be cleared by the
      same wake.
      verify: the count and the file list are reported, zero included. One
      instance is a sample, not the population.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-27 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The two payloads are indistinguishable | implementation | The host may deliver a task notification through the identical shape as a typed prompt. Then no predicate exists and every later phase is building on a field that is not there | 1.1 is written to terminate the roadmap rather than to proceed on an assumption, and 1.2 forces the discriminator to be quoted from the capture rather than from documentation | Phase 1 — Establish what the writer actually receives |
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
      count and a file list. Zero is a reported answer.
