---
proposal_id: test-through-the-entry-point
type: skill
scope: package
stage: proposed
author: claude-opus-5.5/drain-self-modification-20261021
created: 2026-10-21
last_updated: 2026-10-21
changed_files:
  - src/skills/testing-anti-patterns/SKILL.md
ratification_record: agents/evidence/ratifications/drain-self-modification-6-2-20261021.md
---

# Proposal: behaviour promised at an entry point is tested through it

The worked example step 6.2 of
`road-to-self-modification-that-a-council-must-pass` asks for, and the
criterion the archived `road-to-curated-self-improvement` left open: one real
learning from this repository's own history, walked through the pipeline.

## 1. Learning

A suite can cover a function completely and still leave the behaviour it
promises untested, because the promise is made at an entry point — a CLI flag,
a CI step, a hook binding — and the entry point decides whether the function's
result reaches anyone. Testing the function proves construction; only a test
that drives the entry point proves delivery.

## 2. Classification

- **Type:** skill — an 8th Iron Law, one paragraph and one dated Gotcha in
  `testing-anti-patterns`.
- **Scope:** package. It came from this suite's own gates and generalises to
  any consumer who ships a CLI or a CI step around a pure function.
- **Why not a rule:** it applies while writing tests, which is the surface
  `testing-anti-patterns` already owns; a rule would be always loaded for an
  obligation that binds on one kind of edit.
- **Nearest existing law:** law 1, *never test mock behaviour*. Law 8 differs:
  nothing is mocked, the function is real, and the gap is the caller.

## 3. Evidence

```yaml
evidence:
  - kind: review
    ref: agents/evidence/council/escalation-shape-review-r3-20261021.question.md
    summary: >
      Round 3 of the step 5.2 modification review, 2026-10-21. Both seats
      refused on one finding: 21 cases called evaluate() and proved the gate
      built the owner's question, while main() under --quiet printed none of
      it on a passing change to the mechanism. The later rounds' tests drove
      main(argv) once per flag combination and read stdout and stderr; that
      code is not on the trunk (the step's review did not pass), and the
      prompts of every round are committed beside this one.
  - kind: roadmap
    ref: agents/roadmaps/archive/road-to-what-was-built-and-never-ran.md
    summary: >
      Two lints were built with passing suites and invoked by no workflow,
      task or hook, so CI never ran them; the roadmap existed to wire them.
      Same shape: the function was tested, the entry point that delivers it
      was not.
```

## 4. Proposed artefact

In `src/skills/testing-anti-patterns/SKILL.md`, Iron Law 8 — "NEVER stop at
the function when the claim is about delivery — behaviour promised at an entry
point (a CLI flag, an output stream, a hook) is tested by driving the narrowest
faithful invocation of it in an isolated fixture and asserting the promised
observable." — a paragraph defining "narrowest faithful" (in-process
`main(argv)` unless parsing, packaging or process exit status is the claim),
the fixture's isolation (no network, credentials or real hooks unless they are
the contract) and "the promised observable"; and one Gotcha stating the failure
shape without a dated anecdote.

## 5. Quality gate expectations

`skill_linter` zero errors on the changed skill; `check_portability` clean (the
Gotcha names this repository's own gate, not a consumer's); `check_references`
resolves; the skill stays inside its size budget.

## 6. Replacement justification

Nothing is replaced or weakened. Laws 1 to 7 are untouched; law 8 is added
after them.

## 7. Success signal

- Metric: the share of review records under `agents/evidence/` written in the
  quarter whose findings include "the function is tested, its entry point is
  not", over all review records written in that quarter that report at least
  one test-coverage finding; counted by reading each record, and a quarter
  with no such record reports "no data", never zero
- Baseline: 2 instances in October 2026 (the two evidence entries above),
  denominator to be counted at evaluation over October 2026 with the same rule
- Target: a lower share than the October 2026 baseline
- Evaluation date: 2027-01-21
- Falsified if the share does not fall, or if the entry-point cases added under
  the law are later found to catch nothing the function-level cases did not

## 8. Risks and alternatives rejected

- **Risk:** every pure function gains a slow end-to-end twin. The law binds
  only where a claim is made AT an entry point; a function with no delivery
  promise needs none.
- **Risk:** a literal reading drives real hooks or hosted CI with ambient
  credentials. The law's own text confines it to an isolated fixture and the
  narrowest faithful invocation.
- **Rejected:** a lint that flags suites calling only an exported function.
  It cannot tell which functions carry a delivery promise, so it would be
  noise.
- **Rollback:** revert the skill edit. The `dist/agent-src/` copy is a
  byte-exact projection that CI's "Verify dist == rewrite(src)" step rejects if
  it differs, so a revert regenerates with `task sync` and installs pick it up
  on their next update. Revert if the law is cited to justify a test with real
  side effects, or if the evaluation above falsifies it.
- **Sequence:** source reviewed at a digest → owner authorization bound to the
  same digest moves the proposal to `gated` → merge, after which the projection
  ships. Nothing here is published before the owner's merge.

## 9. Gate verdict

`proposal:check` returns PASS at `stage: proposed`. The change was reviewed by
the council's modification review named in `ratification_record:`. The
proposal stays at `stage: proposed`: under ADR-281 as amended a package
proposal reaches `stage: gated` only with an `owner_authorization:` bound to
the same digest, and that approval is the owner's act, not an agent's. Writing
`gated` here would be an agent asserting it.

## 10. Upstream PR

Not opened: the proposal is not `stage: gated`. The change ships in this
repository's own pull request, whose merge is the owner's.
