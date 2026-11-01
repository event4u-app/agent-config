---
proposed_by: the repository owner, in session on 2026-11-01 (answer "1" — approve the council ratification of the consistency.yml change and the pack-size row)
implemented_by: claude-opus-5.5 session on roadmap/docs-that-sell-20261101
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 1-3 of 2026-11-01
providers: [anthropic, openai]
verdict: confirmed-non-expanding
seats:
  anthropic: confirmed-non-expanding
  openai: confirmed-non-expanding
effective_after: merge
subject: e544cab513e1ea55a00b1571cf963f69cacf5357fefaf668fcf61871da36f457
---

<!-- evidence-type: ratification -->

# Ratification — the legacy-path guard and the actionlint step read the PR diff from git

`check_kernel_edit_ratified` gates one file on this branch,
`.github/workflows/consistency.yml`, because that workflow also runs the
ratification gate. The ratification step itself is not touched. The `subject:`
digest above covers that file, computed with
`./scripts-run src/scripts/ratification_subject --files <the branch's changed files>`
at commit `0a0e1aeabe`.

## What was ratified

Two `pull_request` steps read the PR's changes through `gh pr diff`, which
answers HTTP 406 on a pull request with more than 300 changed files. This
branch has 315. Both steps now diff `base.sha...head.sha` from the job's
`fetch-depth: 0` checkout, in which both commits are the merge commit's
parents:

- **Guard — no new legacy path under src/ (ADR-051):** `git diff --no-renames`
  piped into the checker, under `set -o pipefail`, so an unreadable diff fails
  the step instead of handing the checker empty input.
- **Lint workflow files (actionlint):** the changed workflow list comes from
  `git diff --name-only --diff-filter=d` in a plain assignment, so a failure
  stops the step under `bash -e`; deleted files are left out because nothing is
  left to lint.

## The review

Three rounds, prompts committed beside this record as
`agents/evidence/council/consistency-large-pr-diff-ratification-r{1,2,3}-20261101.question.md`.

- **Round 1 — both seats `refused`.** The first draft fell back to the paginated
  files API, which omits the patch of a large file and stops at 3,000 files, so
  an omitted patch would pass unchecked.
- **Round 2 — both seats `refused`.** The redraft diffed `base...HEAD`, but
  `HEAD` is the synthetic merge commit: a line the base added independently
  vanishes from that diff. A scratch repository confirmed it: `base...merge`
  lost the line, `base...<PR head>` kept it.
- **Round 3 — both seats `confirmed-non-expanding`.** No case where a step newly
  passes a real violation. Both noted that `--no-renames` can make the guard
  stricter on a pure rename that carries an existing legacy reference — a
  possible false failure, never a false pass — and asked for proof that a diff
  read failure stops both steps. Run in the scratch repository with an
  unresolvable range, both step shapes exited 128.
