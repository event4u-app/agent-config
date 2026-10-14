# Completion review, round 2 — `drain/project-contract-written-down-20261013`

You are reviewing a change you did not write, in a repository you should read
before judging. Report what you find.

## Scope

The whole diff against `origin/main`, committed beside this file as
`diff.patch` — every changed file, not a subset. Nothing in the delta is out of
scope for you, including the roadmap prose, the evidence artifacts, and the
generated output under `dist/`.

A round-1 review of this branch reported findings and the author changed the
code in response. Round 1's own report is committed at
`agents/evidence/reviews/drain-project-contract-written-down-r2.findings.md`
and its brief at
`agents/evidence/reviews/drain-project-contract-written-down-r2.review-input/prompt.md`.
Read them. **Round 1's verdict is not evidence for yours** — it was written
over a different tree, by a different reviewer, and it may itself have been
wrong. Check its claims against the current code rather than inheriting them.

## What the change claims to do

It closes Phase 2 of
`agents/roadmaps/archive/road-to-a-project-contract-written-down.md` (archived
in this same diff). A consumer repository's `AGENTS.md` can carry a `## No-gos`
section. The change classifies each bullet there into `path`, `command` or
`prose`, renders the first two as host permission deny rules, shows them, asks
once, and appends them to the consumer's settings file on consent.

Read the roadmap's Phase 2 steps, its Decisions table and its Risk Register for
what it set out to do, and judge the code against those rather than against
this summary.

## What to report

Findings, each with a `file:line` and what is wrong. In particular:

- Whether each round-1 finding is actually fixed, partially fixed, or
  unfixed — and whether any fix introduced a new defect. A fix that narrows one
  input class while leaving an equivalent one open is a partial fix; say so.
- Defects in the classifier's logic, including inputs it would classify wrongly
  and inputs it would classify at all when it should refuse.
- Defects in the deny-rule rendering, judged against the host documentation the
  change pins at `https://code.claude.com/docs/en/permissions.md` — a rule that
  is accepted by a settings file and enforced over less than it appears to
  cover is the failure class the change says it is guarding against.
- Defects in the settings-file append: anything that could lose, reorder or
  corrupt content the consumer already had, or produce a file that is not valid
  JSON.
- Tests that cannot fail for the reason they claim to test, assertions that
  would stay green under a broken implementation, and fixtures that cannot
  discriminate.
- Claims in the roadmap, the commit messages or the code comments that the diff
  does not support.
- Anything the change says it does not do, which it in fact does.

If you find nothing in a category, say so for that category. If you find the
change unsound, say that.

## Working method

Open the files. The diff is the subject, but the repository around it is
evidence: a function's callers, the gates that read a file, and the contracts
the change cites are all readable here. Do not take a comment's word for what
the code does. Where a claim is about the host's documented behaviour, check
the quoted text against the page rather than against the quote.
