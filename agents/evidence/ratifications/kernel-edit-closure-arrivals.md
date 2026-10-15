---
proposed_by: claude-opus-5.5/fix-kernel-edit-closure-arrivals
implemented_by: claude-opus-5.5/fix-kernel-edit-closure-arrivals
reviewed_by: ai-council/anthropic-claude-sonnet-4-5+openai-codex-default-2026-10-15
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
subject: cef13a3ef416a11e740100ea9a902b9b320e22b87110954e33420f780455db76
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the gate reads both sides of the dispatcher closure at named commits

Covers branch `fix/kernel-edit-closure-arrivals`. Named for the branch because
the pre-push gate reads this file before the PR exists.

## The gated surfaces

Both the base revision's gate and the head's gate classify two files of this
diff as the ratification mechanism itself:

- `src/scripts/check_kernel_edit_ratified.ts` — `derivedFor` reads the head side
  of the dispatcher import closure at the resolved `--rev` and the base side at
  the resolved `--base-ref`, both from Git objects, in every execution shape;
  `main` resolves the base once for the diff and the closure; `evaluate` and
  `expectedSubjectFor` resolve the revision once for the closure and the digest.
- `src/scripts/_lib/dispatch_import_closure.ts` — `dispatchImportClosure`
  accepts a `ClosureTree` reader (a checkout or a commit's objects) and reads
  each path at most once per walk.

The digest above is `ratification_subject` over those two files at
`621943fc9`, computed with the base revision's gate (`38542f8ee`) against this
tree and, identically, with the head's gate run locally with
`--base-ref origin/main`. The gated content is byte-identical at `e31314353`
(round 3) and at the head: the only later commit adds one test assertion.

Not gated, in the same diff: `src/scripts/_lib/ratification_subject.ts` (gains
`treeAtRevision`, the object-store reader), `src/scripts/ratification_subject.ts`
(gains `--base-ref`), the tests, and the contract paragraph in
`docs/contracts/ratification-artifact.md`. The first of these now decides part
of the gated set and sits outside the gate's watched set; that predates this
branch (the subject digest already lived there) and is left as a named gap.

## What the change does to authority

It widens what the gate gates on a local run — the set now equals the CI set
for the same two commits, where before a local run gated fewer files — and it
removes the working tree as an input. It narrows nothing: the CI branch's base
was the base checkout, which is the same tree as the objects at `--base-ref`
when the workflow's `BASE_SHA` names that checkout. One behaviour change is
stated in the contract: an invalid `--rev` over an ungated change used to pass
and now refuses. Recorded as `ratified` because it edits the ratification
mechanism.

## The review — three rounds, both seats each round

Prompts and dispositions:
`agents/evidence/council/kernel-edit-closure-arrivals-review.md` and the three
`kernel-edit-closure-arrivals-review*-20261015.question.md` prompts beside it.
Every round reached quorum 2 of 2 through the CLI seats, nothing billed.

| Round | Reviewed | anthropic/claude-sonnet-4-5 | openai/codex-default |
|---|---|---|---|
| 1 | `c240e47f2` (full diff) | REQUEST_CHANGES | REQUEST_CHANGES |
| 2 | `c240e47f2..d6f436404` | REQUEST_CHANGES | REQUEST_CHANGES |
| 3 | `d6f436404..e31314353` | APPROVE | APPROVE |

Round-3 stances, in the seats' words:

- anthropic: "**APPROVE** — The round-2 blocker is conclusively disproven, the
  regression tests prove the gating mechanism works for name-matched plumbing
  files outside the closure, and the refactoring is minimal and correct."
- openai: "**APPROVE — the alleged literal-plumbing regression is disproven and
  now directly covered; the single highest-leverage pre-merge change is to
  assert that the writer’s output contains `no-such-revision`, ensuring its
  failure is caused by invalid-revision refusal.**"

That suggested assertion was taken in `621943fc9` (test-only). The seats
answered APPROVE / REQUEST_CHANGES; this record maps the final APPROVE of both
to `ratified`.

## What this record does not establish

The seat verdicts are transcribed by the implementing session; the council
responses are gitignored and not committed. The prompts are committed, so what
was asked can be checked; what was answered rests on this transcription.
